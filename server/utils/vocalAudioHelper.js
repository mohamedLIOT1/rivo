const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { uploadsDir } = require('../middleware/upload');
const { isAudioFileValid, downloadYouTubeAudioToCache, getCookiesPath } = require('./audioCacheUtils');
const { getYtDlpBin } = require('./ytDlpWorker');

/**
 * Pre-downloads remote stream (GoogleVideo/YouTube) locally with cookies / yt-dlp fallback.
 * Strictly prevents passing 403 Forbidden URLs to ffmpeg.
 */
async function prepareLocalAudioInput(source, safe, aliases, tempDir, task) {
  if (typeof source !== 'string' || (!source.startsWith('http://') && !source.startsWith('https://'))) {
    return source;
  }

  console.log(`[VocalSeparator] Pre-downloading remote audio stream to local buffer for: ${safe}`);
  task.eta = 'Buffering stream...';
  task.progress = 10;

  const downloadedRaw = path.join(tempDir, 'raw_input.m4a');
  const cacheDir = path.join(uploadsDir, 'audio-cache');

  // Extract YouTube ID if present
  let targetVid = null;
  const allKeys = [safe, ...(aliases || [])];
  for (const k of allKeys) {
    if (typeof k === 'string') {
      const m = k.match(/^yt_([a-zA-Z0-9_-]{11})$/);
      if (m) { targetVid = m[1]; break; }
      if (/^[a-zA-Z0-9_-]{11}$/.test(k) && !/^[0-9a-f]{32}$/i.test(k)) {
        targetVid = k; break;
      }
    }
  }
  if (!targetVid) {
    const m = source.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
    if (m) targetVid = m[1];
  }

  // 1. Check audio-cache disk first if video ID known
  if (targetVid) {
    const cM4a = path.join(cacheDir, `${targetVid}.m4a`);
    const cMp3 = path.join(cacheDir, `${targetVid}.mp3`);
    if (fs.existsSync(cM4a) && isAudioFileValid(cM4a)) return cM4a;
    if (fs.existsSync(cMp3) && isAudioFileValid(cMp3)) return cMp3;

    try {
      task.eta = 'Resolving stream via Innertube / yt-dlp...';
      task.progress = 12;
      const cachedDl = await downloadYouTubeAudioToCache(targetVid, cacheDir, null, getYtDlpBin);
      if (cachedDl && isAudioFileValid(cachedDl)) return cachedDl;
    } catch (e) {
      console.warn(`[VocalSeparator] Cache resolver error: ${e.message}`);
    }
  }

  // 2. Pre-download using authenticated cookies and YouTube headers
  const cp = getCookiesPath();
  let cookieHeader = '';
  if (cp && fs.existsSync(cp)) {
    try {
      const raw = fs.readFileSync(cp, 'utf8');
      const lines = raw.split(/\r?\n/);
      const cookies = [];
      for (const line of lines) {
        if (!line || line.startsWith('#')) continue;
        const parts = line.split('\t');
        if (parts.length >= 7) cookies.push(`${parts[5]}=${parts[6]}`);
      }
      cookieHeader = cookies.join('; ');
    } catch {}
  }

  let axiosSuccess = false;
  try {
    const axios = require('axios');
    const dlHeaders = {
      'User-Agent': (source.includes('c=ANDROID') || source.includes('cver=20.'))
        ? 'com.google.android.youtube/20.01.35 (Linux; U; Android 11) gzip'
        : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Referer': 'https://www.youtube.com/',
      'Origin': 'https://www.youtube.com',
      'Range': 'bytes=0-'
    };
    if (cookieHeader) dlHeaders['Cookie'] = cookieHeader;

    const dlRes = await axios({
      method: 'get',
      url: source,
      responseType: 'stream',
      headers: dlHeaders,
      timeout: 45000
    });

    const writer = fs.createWriteStream(downloadedRaw);
    await new Promise((resDl, rejDl) => {
      dlRes.data.pipe(writer);
      writer.on('finish', resDl);
      writer.on('error', rejDl);
    });

    if (fs.existsSync(downloadedRaw) && fs.statSync(downloadedRaw).size > 10000 && isAudioFileValid(downloadedRaw)) {
      axiosSuccess = true;
      return downloadedRaw;
    }
  } catch (dlErr) {
    console.warn(`[VocalSeparator] Axios download failed (${dlErr.message}), falling back to yt-dlp`);
  }

  // 3. Fallback to yt-dlp if direct download failed (e.g. GoogleVideo 403 Forbidden)
  if (!axiosSuccess) {
    try {
      const bin = typeof getYtDlpBin === 'function' ? getYtDlpBin() : 'yt-dlp';
      const ytdlpUrl = targetVid ? `https://www.youtube.com/watch?v=${targetVid}` : source;
      const nodeBinDir = path.dirname(process.execPath);
      const execEnv = { ...process.env, PATH: `${nodeBinDir}:/usr/local/bin:/usr/bin:/bin:` + (process.env.PATH || '') };

      const ytdlpArgs = [
        '--no-check-certificates',
        '--no-playlist',
        '--no-warnings',
        '-f', '140/ba[ext=m4a]/ba/bestaudio/18/b',
        '-o', downloadedRaw
      ];
      if (cp && fs.existsSync(cp)) ytdlpArgs.push('--cookies', cp);
      ytdlpArgs.push(ytdlpUrl);

      await new Promise((resYt) => {
        execFile(bin, ytdlpArgs, { timeout: 45000, env: execEnv }, () => {
          resYt();
        });
      });

      if (fs.existsSync(downloadedRaw) && fs.statSync(downloadedRaw).size > 10000 && isAudioFileValid(downloadedRaw)) {
        return downloadedRaw;
      }
    } catch (ytErr) {
      console.warn(`[VocalSeparator] yt-dlp stream recovery failed: ${ytErr.message}`);
    }
  }

  throw new Error('Could not download audio stream for separation (GoogleVideo 403 or stream unavailable)');
}

module.exports = {
  prepareLocalAudioInput
};
