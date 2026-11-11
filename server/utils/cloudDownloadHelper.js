const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { uploadsDir } = require('../middleware/upload');
const {
  isAudioFileValid,
  downloadYouTubeAudioToCache,
  getYtDlpBin,
  getCookiesPath,
  searchYouTubeId
} = require('./helpers');
const { raceAlternativeInstances } = require('./streamFallbackProvider');

const audioCacheDir = path.join(uploadsDir, 'audio-cache');

function detectBanSignal(errText = '') {
  const s = String(errText).toLowerCase();
  return (
    s.includes('sign in to confirm') ||
    s.includes('not a bot') ||
    s.includes('429') ||
    s.includes('too many requests') ||
    s.includes('rate limit') ||
    s.includes('http error 403')
  );
}

function detectPermanentUnavailable(errText = '') {
  const s = String(errText).toLowerCase();
  return (
    s.includes('video unavailable') ||
    s.includes('private video') ||
    s.includes('has been removed') ||
    s.includes('account associated with this video has been terminated') ||
    s.includes('copyright')
  );
}

function findExistingCachedAudio(videoId) {
  if (!videoId) return null;
  for (const ext of ['m4a', 'mp3']) {
    const p = path.join(audioCacheDir, `${videoId}.${ext}`);
    if (fs.existsSync(p) && isAudioFileValid(p)) return p;
  }
  return null;
}

function getExecEnv() {
  const nodeBinDir = path.dirname(process.execPath);
  return { ...process.env, PATH: `${nodeBinDir}:/usr/local/bin:/usr/bin:/bin:` + (process.env.PATH || '') };
}

async function runYtDlpFallback(videoId, outDir, { useProxy = true, useCookies = false, playerClient = '' } = {}, signal) {
  if (!videoId || signal?.aborted) return { filePath: null, stderr: '' };
  const bin = getYtDlpBin();
  const cp = useCookies ? getCookiesPath() : null;
  const proxyUrl = useProxy ? (process.env.YT_PROXY_URL || '').trim() : '';
  const stamp = `${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const tempTpl = path.join(outDir, `${videoId}_pb_${stamp}.%(ext)s`);
  const expectedFile = tempTpl.replace('.%(ext)s', '.m4a');

  const args = [
    '--ignore-config',
    '--no-check-certificates',
    '--no-playlist',
    '--no-warnings',
    '--js-runtimes', 'node',
    '-f', '140/ba[ext=m4a]/ba/bestaudio/18/b',
    '-x',
    '--audio-format', 'm4a',
    '-o', tempTpl
  ];
  if (playerClient) {
    args.push('--extractor-args', `youtube:player_client=${playerClient}`);
  } else {
    args.push('--extractor-args', 'youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416');
  }
  if (proxyUrl) args.splice(1, 0, '--proxy', proxyUrl);
  if (cp) args.splice(1, 0, '--cookies', cp);
  args.push(`https://www.youtube.com/watch?v=${videoId}`);

  const { stderr } = await new Promise((resolve) => {
    const child = execFile(bin, args, { timeout: 120000, env: getExecEnv() }, (err, _out, errText) => {
      resolve({ err, stderr: String(errText || err?.message || '') });
    });
    if (signal) {
      const onAbort = () => { try { child.kill('SIGTERM'); } catch {} };
      signal.addEventListener('abort', onAbort, { once: true });
      child.on('exit', () => signal.removeEventListener('abort', onAbort));
    }
  });

  if (fs.existsSync(expectedFile) && isAudioFileValid(expectedFile)) {
    return { filePath: expectedFile, stderr };
  }
  try { if (fs.existsSync(expectedFile)) fs.unlinkSync(expectedFile); } catch {}
  return { filePath: null, stderr };
}

async function downloadViaAlternativeInstance(videoId, outDir, signal) {
  if (!videoId || signal?.aborted) return null;
  const alt = await raceAlternativeInstances(videoId).catch(() => null);
  if (!alt?.url || !alt.url.startsWith('http') || signal?.aborted) return null;

  const outFile = path.join(outDir, `${videoId}_alt_${Date.now()}.m4a`);
  const ok = await new Promise((resolve) => {
    const child = execFile(
      'ffmpeg',
      ['-v', 'error', '-y', '-i', alt.url, '-vn', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', outFile],
      { timeout: 120000, env: getExecEnv() },
      (err) => resolve(!err)
    );
    if (signal) {
      const onAbort = () => { try { child.kill('SIGTERM'); } catch {} };
      signal.addEventListener('abort', onAbort, { once: true });
      child.on('exit', () => signal.removeEventListener('abort', onAbort));
    }
  });

  if (ok && fs.existsSync(outFile) && isAudioFileValid(outFile)) {
    return outFile;
  }
  try { if (fs.existsSync(outFile)) fs.unlinkSync(outFile); } catch {}
  return null;
}

/**
 * Downloads audio with full Plan B fallback chain (cache -> primary -> alt client/direct -> Invidious/Piped -> alt YouTube video).
 */
async function downloadAudioWithPlanB({ videoId, title, artist, duration, workDir, signal }) {
  const existing = findExistingCachedAudio(videoId);
  if (existing) {
    return { filePath: existing, usedVideoId: videoId, downloadedFresh: false, banDetected: false, permanentError: false };
  }

  if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });
  let lastStderr = '';
  let banDetected = false;
  let permanentError = false;

  // 1. Primary path (Innertube + yt-dlp with proxy & bgutil-pot)
  const primary = await downloadYouTubeAudioToCache(videoId, workDir, null, getYtDlpBin);
  if (primary && isAudioFileValid(primary)) {
    return { filePath: primary, usedVideoId: videoId, downloadedFresh: true, banDetected: false, permanentError: false };
  }
  if (signal?.aborted) return { filePath: null, banDetected: false, permanentError: false, errorReason: 'aborted' };

  // 2. Plan B-1: Alternative yt-dlp client & proxy/direct toggle while capturing stderr
  const attempts = [
    { useProxy: true, useCookies: false, playerClient: 'android_vr,tv_simply,ios' },
    { useProxy: false, useCookies: true, playerClient: '' }
  ];
  for (const cfg of attempts) {
    const res = await runYtDlpFallback(videoId, workDir, cfg, signal);
    if (res.filePath) {
      return { filePath: res.filePath, usedVideoId: videoId, downloadedFresh: true, banDetected: false, permanentError: false };
    }
    lastStderr += ' ' + (res.stderr || '');
    if (detectBanSignal(res.stderr)) banDetected = true;
    if (detectPermanentUnavailable(res.stderr)) permanentError = true;
    if (signal?.aborted) break;
  }

  // 3. Plan B-2: Invidious / Piped fallback mirror
  const mirrorFile = await downloadViaAlternativeInstance(videoId, workDir, signal);
  if (mirrorFile) {
    return { filePath: mirrorFile, usedVideoId: videoId, downloadedFresh: true, banDetected: false, permanentError: false };
  }

  // 4. Plan B-3: Search alternative YouTube upload for the same track (when original video failed/unavailable)
  if (!signal?.aborted && (title || artist)) {
    try {
      const altSr = await searchYouTubeId({
        artist,
        title,
        targetDuration: duration,
        excludeVideoIds: [videoId]
      });
      const altVid = typeof altSr === 'string' ? altSr : altSr?.videoId;
      if (altVid && altVid !== videoId) {
        const altCached = findExistingCachedAudio(altVid);
        if (altCached) {
          return { filePath: altCached, usedVideoId: altVid, downloadedFresh: false, banDetected: false, permanentError: false };
        }
        const altPrimary = await downloadYouTubeAudioToCache(altVid, workDir, null, getYtDlpBin);
        if (altPrimary && isAudioFileValid(altPrimary)) {
          return { filePath: altPrimary, usedVideoId: altVid, downloadedFresh: true, banDetected: false, permanentError: false };
        }
        const altMirror = await downloadViaAlternativeInstance(altVid, workDir, signal);
        if (altMirror) {
          return { filePath: altMirror, usedVideoId: altVid, downloadedFresh: true, banDetected: false, permanentError: false };
        }
      }
    } catch {}
  }

  return {
    filePath: null,
    usedVideoId: videoId,
    downloadedFresh: false,
    banDetected,
    permanentError,
    errorReason: banDetected ? 'youtube_ban_or_ratelimit' : (permanentError ? 'video_unavailable' : 'download_failed'),
    stderrSnippet: lastStderr.trim().slice(-240)
  };
}

module.exports = {
  downloadAudioWithPlanB,
  findExistingCachedAudio,
  detectBanSignal
};
