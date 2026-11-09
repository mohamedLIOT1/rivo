const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');
const { execFile } = require('child_process');

const EMBEDDED_YOUTUBE_COOKIES = '';
let cookiePromptListener = null;

function setCookiePromptHandler(handler) {
  cookiePromptListener = handler;
}

async function promptUserForCookies(reason = 'External stream access requires authentication') {
  console.warn(`[YouTubeStream] ${reason}`);
  console.warn('[YouTubeStream] Please provide a fresh, genuine cookies.txt file in the application root directory.');
  if (typeof cookiePromptListener === 'function') {
    return await cookiePromptListener(reason);
  }
  return null;
}

function isCookiesRequiredError(err) {
  const msg = `${err?.message || ''} ${err?.stderr || ''} ${err || ''}`.toLowerCase();
  return msg.includes('sign in to confirm') || msg.includes('bot verification') || msg.includes('cookies required');
}

function getCookiesPath() {
  const possibleCookiePaths = [
    '/home/ubuntu/rivo/cookies.txt',
    '/home/ubuntu/cookies.txt',
    path.join(__dirname, '../../cookies.txt'),
    path.join(__dirname, '../cookies.txt'),
    path.join(process.cwd(), 'cookies.txt'),
    path.join(process.cwd(), 'server/cookies.txt')
  ];
  for (const cp of possibleCookiePaths) {
    if (fs.existsSync(cp) && fs.statSync(cp).size > 100) {
      try {
        const sample = fs.readFileSync(cp, 'utf8').slice(0, 1024);
        // Never return fake/mock credentials file that sabotages signature solving
        if (sample.includes('session_logininfo=FAKE')) {
          continue;
        }
        return cp;
      } catch {}
    }
  }
  return null;
}

const verifiedAudioFiles = new Set();
function isAudioFileValid(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  if (verifiedAudioFiles.has(filePath)) return true;
  try {
    const stats = fs.statSync(filePath);
    if (stats.size < 30000) return false;

    // Fast non-blocking header check (< 0.05ms) avoiding event loop freeze
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(64);
    const bytesRead = fs.readSync(fd, buffer, 0, 64, 0);
    fs.closeSync(fd);

    if (bytesRead < 16) return false;

    // Check M4A / MP4: 'ftyp' at offset 4
    const isM4A = buffer.toString('latin1', 4, 8) === 'ftyp';
    // Check MP3: 'ID3' or MPEG sync word (0xFF 0xFB, 0xFF 0xF3, 0xFF 0xF2)
    const isMp3Id3 = buffer.toString('latin1', 0, 3) === 'ID3';
    const isMp3Sync = buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
    // Check OGG / OPUS: 'OggS'
    const isOgg = buffer.toString('latin1', 0, 4) === 'OggS';
    // Check FLAC: 'fLaC'
    const isFlac = buffer.toString('latin1', 0, 4) === 'fLaC';
    // Check WAV: 'RIFF'
    const isWav = buffer.toString('latin1', 0, 4) === 'RIFF';
    // Check WebM: 0x1A 0x45 0xDF 0xA3
    const isWebm = buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;

    const valid = isM4A || isMp3Id3 || isMp3Sync || isOgg || isFlac || isWav || isWebm;
    if (valid) {
      if (verifiedAudioFiles.size > 5000) verifiedAudioFiles.clear();
      verifiedAudioFiles.add(filePath);
    }
    return valid;
  } catch {
    return false;
  }
}

const localFileDurationCache = new Map();
function getLocalAudioFileDuration(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return Promise.resolve(null);
  if (localFileDurationCache.has(filePath)) return Promise.resolve(localFileDurationCache.get(filePath));
  return new Promise((resolve) => {
    execFile(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
      { timeout: 4000 },
      (err, stdout) => {
        if (!err && stdout) {
          const durSec = Math.round(Number(stdout.toString().trim()));
          if (durSec > 0 && durSec < 86400) {
            if (localFileDurationCache.size > 2000) localFileDurationCache.clear();
            localFileDurationCache.set(filePath, durSec);
            return resolve(durSec);
          }
        }
        resolve(null);
      }
    );
  });
}

const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

async function extractInnertubeDirectStream(videoId) {
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;

  const clientProfiles = [
    {
      name: 'ANDROID',
      context: { client: { clientName: 'ANDROID', clientVersion: '20.01.35', androidSdkVersion: 30, hl: 'en', gl: 'US' } },
      headers: { 'User-Agent': 'com.google.android.youtube/20.01.35 (Linux; U; Android 11) gzip' }
    },
    {
      name: 'IOS',
      context: { client: { clientName: 'IOS', clientVersion: '20.01.35', deviceMake: 'Apple', deviceModel: 'iPhone15,2', hl: 'en', gl: 'US' } },
      headers: { 'User-Agent': 'com.google.ios.youtube/20.01.35 (iPhone15,2; U; CPU iOS 18_0 like Mac OS X; en_US)' }
    },
    {
      name: 'ANDROID_VR',
      context: { client: { clientName: 'ANDROID_VR', clientVersion: '1.56.21', deviceMake: 'Oculus', deviceModel: 'Quest 3', osName: 'Android', osVersion: '12', hl: 'en', gl: 'US' } },
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Quest 3) AppleWebKit/537.36' }
    },
    {
      name: 'WEB_EMBEDDED_PLAYER',
      context: { client: { clientName: 'WEB_EMBEDDED_PLAYER', clientVersion: '2.20260708.00.00', hl: 'en', gl: 'US' }, thirdParty: { embedUrl: `https://www.youtube.com/embed/${videoId}` } },
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://www.youtube.com/' }
    }
  ];

  const fetchProfile = async (p) => {
    const res = await axios.post(
      `https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_API_KEY}`,
      {
        videoId,
        context: p.context
      },
      {
        headers: Object.assign({ 'Content-Type': 'application/json' }, p.headers),
        timeout: 3800
      }
    );

    const streamingData = res.data && res.data.streamingData;
    const formats = [].concat(
      (streamingData && streamingData.formats) || [],
      (streamingData && streamingData.adaptiveFormats) || []
    );

    const audioFormats = formats.filter(
      f => f && f.url && f.mimeType && f.mimeType.startsWith('audio/')
    );

    if (audioFormats.length > 0) {
      const itag140 = audioFormats.find(f => f.itag === 140);
      const mp4Audio = audioFormats.find(f => f.mimeType && f.mimeType.includes('audio/mp4'));
      audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      const chosen = itag140 || mp4Audio || audioFormats[0];

      if (chosen && chosen.url && chosen.url.startsWith('http')) {
        let duration = null;
        if (chosen.approxDurationMs && !isNaN(Number(chosen.approxDurationMs))) {
          duration = Math.round(Number(chosen.approxDurationMs) / 1000);
        } else if (res.data?.videoDetails?.lengthSeconds) {
          duration = Math.round(Number(res.data.videoDetails.lengthSeconds));
        } else {
          const mDur = chosen.url.match(/[?&]dur=([0-9.]+)/);
          if (mDur && !isNaN(Number(mDur[1]))) {
            duration = Math.round(Number(mDur[1]));
          }
        }

        const resObj = new String(chosen.url);
        resObj.url = chosen.url;
        resObj.duration = duration;
        resObj.itag = chosen.itag;
        resObj.mimeType = chosen.mimeType;
        return resObj;
      }
    }
    throw new Error('No audio format found');
  };

  try {
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000));
    return await Promise.race([
      Promise.any(clientProfiles.map(p => fetchProfile(p))),
      timeoutPromise
    ]);
  } catch {
    return null;
  }
}

async function downloadYouTubeAudioToCache(videoId, cacheDir, directStreamUrl = null, getYtDlpBinFn = null) {
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;
  if (!fs.existsSync(cacheDir)) {
    try { fs.mkdirSync(cacheDir, { recursive: true }); } catch {}
  }
  const targetFile = path.join(cacheDir, `${videoId}.m4a`);
  if (isAudioFileValid(targetFile)) return targetFile;

  try { if (fs.existsSync(targetFile)) fs.unlinkSync(targetFile); } catch {}

  const nodeBinDir = path.dirname(process.execPath);
  const execEnv = { ...process.env, PATH: `${nodeBinDir}:/usr/local/bin:/usr/bin:/bin:` + (process.env.PATH || '') };

  // 1. Direct fast download from known stream URL or YouTube Innertube stream
  try {
    let streamUrl = directStreamUrl;
    if (!streamUrl) {
      const directRes = await extractInnertubeDirectStream(videoId);
      if (directRes && directRes.url) streamUrl = directRes.url;
    }
    if (streamUrl && streamUrl.startsWith('http')) {
      const fastTarget = path.join(cacheDir, `${videoId}_stream_${Date.now()}.m4a`);
      let streamUa = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
      if (streamUrl.includes('c=ANDROID')) streamUa = 'com.google.android.youtube/20.01.35 (Linux; U; Android 11) gzip';
      else if (streamUrl.includes('c=IOS')) streamUa = 'com.google.ios.youtube/20.01.35 (iPhone15,2; U; CPU iOS 18_0 like Mac OS X; en_US)';
      else if (streamUrl.includes('c=VISIONOS')) streamUa = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15';
      await new Promise((resolve) => {
        execFile('ffmpeg', ['-v', 'error', '-y', '-user_agent', streamUa, '-i', streamUrl, '-c', 'copy', '-movflags', '+faststart', fastTarget], { timeout: 35000, env: execEnv }, (err) => {
          resolve(!err);
        });
      });
      if (fs.existsSync(fastTarget) && isAudioFileValid(fastTarget)) {
        try { fs.renameSync(fastTarget, targetFile); } catch {
          fs.copyFileSync(fastTarget, targetFile);
          try { fs.unlinkSync(fastTarget); } catch {}
        }
        return targetFile;
      }
      try { if (fs.existsSync(fastTarget)) fs.unlinkSync(fastTarget); } catch {}
    }
  } catch {}

  // 2. yt-dlp fallback with robust timeout (45s)
  const bin = typeof getYtDlpBinFn === 'function' ? getYtDlpBinFn() : 'yt-dlp';
  const cp = getCookiesPath();
  const tempTarget = path.join(cacheDir, `${videoId}_dl_${Date.now()}.%(ext)s`);

  const ytdlpArgs = [
    '--ignore-config',
    '--no-check-certificates',
    '--no-playlist',
    '--no-warnings',
    '--js-runtimes', 'node',
    '-f', '140/ba[ext=m4a]/ba/bestaudio/18/b',
    '-x',
    '--audio-format', 'm4a',
    '-o', tempTarget
  ];
  if (cp) {
    ytdlpArgs.splice(1, 0, '--cookies', cp);
  }
  ytdlpArgs.push(`https://www.youtube.com/watch?v=${videoId}`);

  await new Promise((resolve) => {
    execFile(bin, ytdlpArgs, { timeout: 45000, env: execEnv }, async (err, stdout, stderr) => {
      if (err && isCookiesRequiredError(`${err?.message || ''} ${stderr || ''}`)) {
        await promptUserForCookies('yt-dlp download blocked by YouTube bot verification');
      }
      resolve();
    });
  });

  const actualDownloaded = tempTarget.replace('.%(ext)s', '.m4a');
  if (fs.existsSync(actualDownloaded) && isAudioFileValid(actualDownloaded)) {
    const faststartTarget = tempTarget.replace('.%(ext)s', '_fs.m4a');
    try {
      await new Promise((resolve) => {
        execFile('ffmpeg', ['-v', 'error', '-i', actualDownloaded, '-c', 'copy', '-movflags', '+faststart', faststartTarget, '-y'], { timeout: 20000, env: execEnv }, (err) => {
          resolve(!err);
        });
      });
      if (fs.existsSync(faststartTarget) && isAudioFileValid(faststartTarget)) {
        try { fs.unlinkSync(actualDownloaded); } catch {}
        fs.renameSync(faststartTarget, targetFile);
        return targetFile;
      }
    } catch {}
    try {
      fs.renameSync(actualDownloaded, targetFile);
    } catch {
      fs.copyFileSync(actualDownloaded, targetFile);
      try { fs.unlinkSync(actualDownloaded); } catch {}
    }
    return targetFile;
  }
  try { if (fs.existsSync(actualDownloaded)) fs.unlinkSync(actualDownloaded); } catch {}
  return null;
}

function invalidateAudioCache(videoIdOrUrl, deleteDiskFile = false, directStreamCache = null) {
  if (!videoIdOrUrl || typeof videoIdOrUrl !== 'string') return;
  const m = videoIdOrUrl.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
  const vid = m ? m[1] : (/^[a-zA-Z0-9_-]{11}$/.test(videoIdOrUrl.trim()) && !mongoose.isValidObjectId(videoIdOrUrl.trim()) ? videoIdOrUrl.trim() : null);
  if (!vid) return;

  if (directStreamCache && typeof directStreamCache.delete === 'function') {
    directStreamCache.delete(vid);
  }

  if (deleteDiskFile) {
    const audioCacheDirs = [
      path.join(__dirname, '../../uploads/audio-cache'),
      '/home/ubuntu/uploads/audio-cache',
      '/home/ubuntu/rivo/uploads/audio-cache'
    ];
    for (const dir of audioCacheDirs) {
      try {
        const f1 = path.join(dir, `${vid}.m4a`);
        const f2 = path.join(dir, `${vid}.mp3`);
        if (fs.existsSync(f1)) fs.unlinkSync(f1);
        if (fs.existsSync(f2)) fs.unlinkSync(f2);
      } catch {}
    }
  }
}

function cleanupAudioCache() {
  try {
    const audioCacheDir = path.join(__dirname, '../../uploads/audio-cache');
    if (!fs.existsSync(audioCacheDir)) return;
    const files = fs.readdirSync(audioCacheDir);
    const now = Date.now();
    const maxAge = 24 * 3600 * 1000; // 24 hours
    for (const file of files) {
      try {
        const filePath = path.join(audioCacheDir, file);
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
        }
      } catch {}
    }
  } catch {}
}

module.exports = {
  EMBEDDED_YOUTUBE_COOKIES,
  getCookiesPath,
  isAudioFileValid,
  getLocalAudioFileDuration,
  extractInnertubeDirectStream,
  downloadYouTubeAudioToCache,
  invalidateAudioCache,
  cleanupAudioCache,
  promptUserForCookies,
  setCookiePromptHandler,
  isCookiesRequiredError
};
