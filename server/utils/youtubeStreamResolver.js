const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const { execFile } = require('child_process');
const { resolveBulletproofAudioStream, invalidateMemoryCache } = require('./streamFallbackProvider');
const { extractViaWarmWorker, getYtDlpBin, queueBackgroundAudioCache } = require('./ytDlpWorker');
const {
  getCookiesPath,
  isAudioFileValid,
  getLocalAudioFileDuration,
  extractInnertubeDirectStream,
  downloadYouTubeAudioToCache
} = require('./audioCacheUtils');
const { searchYouTubeId } = require('./youtubeSearch');

const directStreamCache = new Map();
const downloadingAudioMap = new Map();

function clearStreamMemoryCache(videoId) {
  if (!videoId) return;
  const vid = String(videoId).trim();
  directStreamCache.delete(vid);
  invalidateMemoryCache(vid);
}

async function extractDirectStreamUrl(videoId, options = {}) {
  const bypassInnertube = Boolean(options?.bypassInnertube);
  // 1. Prioritize direct Innertube player API call (fastest: 250-700ms, no process spawn)
  if (!bypassInnertube) {
    try {
      const itResult = await extractInnertubeDirectStream(videoId);
      if (itResult && itResult.url) {
        return itResult;
      }
    } catch {}
  }

  // 2. Warm yt-dlp worker fallback
  try {
    const warmRes = await extractViaWarmWorker(videoId);
    const warmUrl = warmRes ? (warmRes.url || String(warmRes)) : null;
    if (warmUrl && warmUrl.startsWith('http')) {
      let dur = warmRes?.duration || null;
      if (!dur) {
        const mDur = warmUrl.match(/[?&]dur=([0-9.]+)/);
        if (mDur && !isNaN(Number(mDur[1]))) {
          dur = Math.round(Number(mDur[1]));
        }
      }
      const res = new String(warmUrl);
      res.url = warmUrl;
      res.duration = dur;
      return res;
    }
  } catch {}

  // 3. Fallback to single fast yt-dlp execution (15s timeout, no redundant duplicate execution)
  const bin = getYtDlpBin();
  const cp = getCookiesPath();
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const ytdlpArgs = [
    '--no-check-certificates',
    '--no-playlist',
    '--no-warnings',
    '--js-runtimes', 'node',
    '--print', '%(duration)s'
  ];
  if (cp) {
    ytdlpArgs.push('--cookies', cp);
  }
  ytdlpArgs.push('-g', '-f', '140/ba[ext=m4a]/ba/bestaudio/18/b', ytUrl);

  const nodeBinDir = path.dirname(process.execPath);
  const execEnv = { ...process.env, PATH: `${nodeBinDir}:/usr/local/bin:/usr/bin:/bin:` + (process.env.PATH || '') };
  return new Promise((resolve) => {
    execFile(bin, ytdlpArgs, { timeout: 15000, env: execEnv }, (err, stdout) => {
      if (stdout) {
        const lines = stdout.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const directUrl = lines.find(l => l.startsWith('http')) || null;
        let duration = null;
        const durLine = lines.find(l => !l.startsWith('http') && !isNaN(Number(l)));
        if (durLine && Number(durLine) > 0) {
          duration = Math.round(Number(durLine));
        } else if (directUrl) {
          const mDur = directUrl.match(/[?&]dur=([0-9.]+)/);
          if (mDur && !isNaN(Number(mDur[1]))) {
            duration = Math.round(Number(mDur[1]));
          }
        }
        if (directUrl) {
          const res = new String(directUrl);
          res.url = directUrl;
          res.duration = duration;
          return resolve(res);
        }
      }
      resolve(null);
    });
  });
}

async function resolveOfficialYouTubeAudioStream(rawUrl, title = '', artist = '', options = {}) {
  const targetDuration = Number(options?.duration || options?.targetDuration) || null;
  const defaultDur = targetDuration && targetDuration > 0 ? targetDuration : 209;
  const isRetryAlt = Boolean(options?.retryAlt || options?.forceAlternative);
  const bypassCache = Boolean(options?.bypassCache || isRetryAlt);
  const excludedVid = options?.excludeVideoId || null;
  const excludedSet = new Set(
    (Array.isArray(excludedVid) ? excludedVid : [excludedVid]).filter(Boolean).map(String)
  );

  if (!isRetryAlt && rawUrl && typeof rawUrl === 'string' && (rawUrl.startsWith('/uploads/') || rawUrl.includes('/uploads/'))) {
    const cleanUpload = rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`;
    const retObj = new String(cleanUpload);
    retObj.url = cleanUpload;
    retObj.duration = defaultDur;
    return retObj;
  }

  let videoId = null;
  let isExplicitVideoId = false;
  const candidates = [rawUrl];
  for (const cand of candidates) {
    if (!cand || typeof cand !== 'string') continue;
    const m1 = cand.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
    if (m1 && m1[1]) { videoId = m1[1]; isExplicitVideoId = true; break; }
    const m2 = cand.match(/^yt[-_]?([a-zA-Z0-9_-]{11})$/i);
    if (m2 && m2[1]) { videoId = m2[1]; isExplicitVideoId = true; break; }
    if (/^[a-zA-Z0-9_-]{11}$/.test(cand.trim()) && !mongoose.isValidObjectId(cand.trim())) {
      videoId = cand.trim();
      isExplicitVideoId = true;
      break;
    }
  }

  if (videoId && (excludedSet.has(videoId) || isRetryAlt)) {
    if (excludedSet.has(videoId)) {
      clearStreamMemoryCache(videoId);
      videoId = null;
      isExplicitVideoId = false;
    }
  }

  if (!videoId && (title || artist)) {
    try {
      videoId = await searchYouTubeId({ artist, title, targetDuration, excludeVideoIds: Array.from(excludedSet) });
    } catch {}
  }
  if (!videoId && rawUrl && !isRetryAlt) {
    const rawMatch = rawUrl.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
    if (rawMatch && rawMatch[1] && !excludedSet.has(rawMatch[1])) { videoId = rawMatch[1]; isExplicitVideoId = true; }
  }
  if (videoId) {
    if (typeof videoId === 'object') {
      const extracted = videoId.id || videoId.videoId || (typeof videoId.toString === 'function' ? videoId.toString() : '');
      videoId = (extracted && extracted !== '[object Object]') ? extracted : null;
    } else {
      videoId = String(videoId);
    }
  }
  if (videoId) {
    videoId = String(videoId).trim();
    if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
      const m = videoId.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
      videoId = m ? m[1] : null;
    }
  }
  if (!videoId) return null;

  // 0. Fast bulletproof stream & cache resolver (<500ms)
  const uploadsDir = path.join(__dirname, '../../uploads');
  const bypassInnertube = Boolean(options?.bypassInnertube || isRetryAlt);
  try {
    const bulletproofRes = await resolveBulletproofAudioStream({
      videoId,
      uploadsDir,
      primaryExtractor: (vid) => extractDirectStreamUrl(vid, { bypassInnertube }),
      bypassCache
    });
    if (bulletproofRes && bulletproofRes.success && bulletproofRes.url) {
      const streamPath = bulletproofRes.url;
      const dur = bulletproofRes.duration || targetDuration || defaultDur;
      const retObj = new String(streamPath);
      retObj.url = streamPath;
      retObj.duration = dur;
      retObj.videoId = videoId;
      if (streamPath.startsWith('http')) {
        let ttl = 3 * 3600 * 1000;
        const expMatch = streamPath.match(/[?&]expire=([0-9]+)/);
        if (expMatch && !isNaN(Number(expMatch[1]))) {
          const remaining = Number(expMatch[1]) * 1000 - Date.now() - 300000;
          if (remaining > 60000) ttl = Math.min(ttl, remaining);
        }
        directStreamCache.set(videoId, { url: streamPath, duration: dur, expireAt: Date.now() + ttl });
        const targetM4a = path.join(uploadsDir, 'audio-cache', `${videoId}.m4a`);
        queueBackgroundAudioCache(videoId, targetM4a, true, streamPath);
      }
      return retObj;
    }
  } catch (err) {}

  const audioCacheDir = path.join(__dirname, '../../uploads/audio-cache');
  if (!fs.existsSync(audioCacheDir)) {
    try { fs.mkdirSync(audioCacheDir, { recursive: true }); } catch {}
  }

  const cachedM4a = path.join(audioCacheDir, `${videoId}.m4a`);
  const cachedMp3 = path.join(audioCacheDir, `${videoId}.mp3`);

  if (!bypassCache) {
    if (fs.existsSync(cachedM4a) && fs.statSync(cachedM4a).size > 20000) {
      if (isAudioFileValid(cachedM4a)) {
        const realDur = (await getLocalAudioFileDuration(cachedM4a)) || targetDuration || defaultDur;
        const retObj = new String(`/uploads/audio-cache/${videoId}.m4a`);
        retObj.url = `/uploads/audio-cache/${videoId}.m4a`;
        retObj.duration = realDur;
        retObj.videoId = videoId;
        return retObj;
      } else {
        try { fs.unlinkSync(cachedM4a); } catch {}
      }
    }
    if (fs.existsSync(cachedMp3) && fs.statSync(cachedMp3).size > 20000) {
      if (isAudioFileValid(cachedMp3)) {
        const realDur = (await getLocalAudioFileDuration(cachedMp3)) || targetDuration || defaultDur;
        const retObj = new String(`/uploads/audio-cache/${videoId}.mp3`);
        retObj.url = `/uploads/audio-cache/${videoId}.mp3`;
        retObj.duration = realDur;
        retObj.videoId = videoId;
        return retObj;
      } else {
        try { fs.unlinkSync(cachedMp3); } catch {}
      }
    }

    const cachedStream = directStreamCache.get(videoId);
    if (cachedStream && Date.now() < cachedStream.expireAt) {
      if (cachedStream.url && cachedStream.url.includes('.m3u8')) {
        directStreamCache.delete(videoId);
      } else {
        queueBackgroundAudioCache(videoId, cachedM4a, true, cachedStream.url);
        const retObj = new String(cachedStream.url);
        retObj.url = cachedStream.url;
        retObj.duration = cachedStream.duration || targetDuration || defaultDur;
        retObj.videoId = videoId;
        return retObj;
      }
    }
  }

  if (downloadingAudioMap.has(videoId)) {
    try {
      const url = await downloadingAudioMap.get(videoId);
      if (url && !url.includes('.m3u8')) {
        const retObj = new String(url);
        retObj.url = url;
        retObj.duration = url.duration || targetDuration || defaultDur;
        retObj.videoId = videoId;
        return retObj;
      }
    } catch (e) {}
  }

  const extractPromise = (async () => {
    let directResult = null;
    if (!isRetryAlt) {
      try {
        directResult = await extractDirectStreamUrl(videoId, { bypassInnertube });
      } catch {}
    }
    if ((!directResult || isRetryAlt) && (title || artist)) {
      try {
        const toExclude = [videoId, ...Array.from(excludedSet)].filter(Boolean);
        const freshId = await searchYouTubeId({ artist, title, targetDuration, excludeVideoIds: toExclude });
        if (freshId && String(freshId) !== videoId) {
          const freshVidStr = String(freshId);
          const freshStream = await extractDirectStreamUrl(freshVidStr, { bypassInnertube });
          if (freshStream) {
            const fUrl = freshStream.url || String(freshStream);
            const fDur = freshStream.duration || freshId.duration || targetDuration || null;
            let fTtl = 3 * 3600 * 1000;
            const fExp = fUrl.match(/[?&]expire=([0-9]+)/);
            if (fExp && !isNaN(Number(fExp[1]))) {
              const rem = Number(fExp[1]) * 1000 - Date.now() - 300000;
              if (rem > 60000) fTtl = Math.min(fTtl, rem);
            }
            directStreamCache.set(freshVidStr, { url: fUrl, duration: fDur, expireAt: Date.now() + fTtl });
            const resObj = new String(fUrl);
            resObj.url = fUrl;
            resObj.duration = fDur || defaultDur;
            resObj.videoId = freshVidStr;
            return resObj;
          }
        }
      } catch {}
    }

    const directUrl = directResult ? (directResult.url || String(directResult)) : null;
    if (directUrl && !directUrl.includes('.m3u8')) {
      const chosenDur = directResult?.duration || targetDuration || defaultDur;
      let dttl = 3 * 3600 * 1000;
      const dExp = directUrl.match(/[?&]expire=([0-9]+)/);
      if (dExp && !isNaN(Number(dExp[1]))) {
        const rem = Number(dExp[1]) * 1000 - Date.now() - 300000;
        if (rem > 60000) dttl = Math.min(dttl, rem);
      }
      directStreamCache.set(videoId, { url: directUrl, duration: chosenDur, expireAt: Date.now() + dttl });
      queueBackgroundAudioCache(videoId, cachedM4a, true, directUrl);
      const resObj = new String(directUrl);
      resObj.url = directUrl;
      resObj.duration = chosenDur;
      resObj.videoId = videoId;
      return resObj;
    }

    // Direct YouTube download to disk with cookies & format fixup
    const downloadedCache = await downloadYouTubeAudioToCache(videoId, audioCacheDir);
    if (downloadedCache && isAudioFileValid(downloadedCache)) {
      const fileDur = (await getLocalAudioFileDuration(downloadedCache)) || targetDuration || defaultDur;
      const retObj = new String(`/uploads/audio-cache/${videoId}.m4a`);
      retObj.url = `/uploads/audio-cache/${videoId}.m4a`;
      retObj.duration = fileDur;
      retObj.videoId = videoId;
      return retObj;
    }

    if (fs.existsSync(cachedM4a) && fs.statSync(cachedM4a).size > 20000) {
      return `/uploads/audio-cache/${videoId}.m4a`;
    }
    return null;
  })();

  downloadingAudioMap.set(videoId, extractPromise);

  try {
    const resolvedUrl = await extractPromise;
    if (resolvedUrl) {
      const finalUrl = typeof resolvedUrl === 'object' ? (resolvedUrl.url || String(resolvedUrl)) : String(resolvedUrl);
      const finalDur = (typeof resolvedUrl === 'object' && resolvedUrl.duration) ? resolvedUrl.duration : defaultDur;
      const retObj = new String(finalUrl);
      retObj.url = finalUrl;
      retObj.duration = finalDur;
      retObj.videoId = videoId;
      return retObj;
    }
    return null;
  } catch (err) {
    return null;
  } finally {
    downloadingAudioMap.delete(videoId);
  }
}

module.exports = {
  directStreamCache,
  clearStreamMemoryCache,
  extractDirectStreamUrl,
  resolveOfficialYouTubeAudioStream
};
