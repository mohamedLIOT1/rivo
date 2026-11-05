const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');
const { execFile, execFileSync } = require('child_process');

const EMBEDDED_YOUTUBE_COOKIES = `# Netscape HTTP Cookie File
# https://curl.haxx.se/rfc/cookie_spec.html
# This is a generated file! Do not edit.

.youtube.com	TRUE	/	FALSE	1827141845	HSID	AQbU9Tf375bT4QpZs
.youtube.com	TRUE	/	TRUE	1827141845	SSID	AclKQ8_TaNTLqZD3K
.youtube.com	TRUE	/	FALSE	1827141845	APISID	3zneGuIfvKtozDjN/AXOz5H_n5FGLInD6k
.youtube.com	TRUE	/	TRUE	1827141845	SAPISID	zaADyK14sfPJt3MY/A8mozLAyeplCY2a3o
.youtube.com	TRUE	/	TRUE	1827141845	__Secure-1PAPISID	zaADyK14sfPJt3MY/A8mozLAyeplCY2a3o
.youtube.com	TRUE	/	TRUE	1827141845	__Secure-3PAPISID	zaADyK14sfPJt3MY/A8mozLAyeplCY2a3o
.youtube.com	TRUE	/	TRUE	1806394086	__Secure-BUCKET	CNwH
.youtube.com	TRUE	/	TRUE	1828279814	PREF	f6=40000000&f7=100&tz=Africa.Cairo
.youtube.com	TRUE	/	FALSE	1827141845	SID	g.a000Dwn7uN5mThPtCUM-3wae_zpIHD5Cl7Sb2cor18o1x4ESW1ZkFk3GtoMcaISajUtaI2z2sQACgYKASASARISFQHGX2Mihh8rHmNr7-9nMkhuI0W56xoVAUF8yKoOfUkWGe4ikoU9i0vnsdws0076
.youtube.com	TRUE	/	TRUE	1827141845	__Secure-1PSID	g.a000Dwn7uN5mThPtCUM-3wae_zpIHD5Cl7Sb2cor18o1x4ESW1ZkZcR7ZicwZ5nK8Reny4qfsAACgYKAS4SARISFQHGX2MiTI5rRe-BIYBIoHKenMhSihoVAUF8yKpetsu8nrg9c9LolLnHcSGf0076
.youtube.com	TRUE	/	TRUE	1827141845	__Secure-3PSID	g.a000Dwn7uN5mThPtCUM-3wae_zpIHD5Cl7Sb2cor18o1x4ESW1ZkRoeRVdjXRxsiP4X_OSkwZgACgYKAX4SARISFQHGX2MiMBeLd5mC9jclOeOiPyFVCRoVAUF8yKoQScwucgwCtlMFvX_MiBsT0076
.youtube.com	TRUE	/	TRUE	1827152434	LOGIN_INFO	AFmmF2swRAIgLxwOUj2Afdq2fj95ZDcqoBYWUm2ghtMiZTwvM3UbMA8CIA79yuKwJqRTTNZeoPvrKwDDgTziIbNeL9tpBwzzId79:QUQ3MjNmdzFqOWNUZUtSVGxsemxqTXByQmJFbnl6YXZfLXBRZ2JxeEF6ZkpEQ2RYZ3l1NDRScHBreGRHYTVZd2wzQlFjQ0NZLWtpdjhOWldHdml3cnJTNHg2V0VLODV4OWJadmFXWWZhSUhRS0JGMG9lbU1BMmNEMUNQTzI1bGduUmRtNElZMmQyYXhRVXhyZjRQeDhWaVlJV3B1eHlzRmlR
.youtube.com	TRUE	/	FALSE	1793719824	ST-3opvp5	session_logininfo=AFmmF2swRAIgLxwOUj2Afdq2fj95ZDcqoBYWUm2ghtMiZTwvM3UbMA8CIA79yuKwJqRTTNZeoPvrKwDDgTziIbNeL9tpBwzzId79%3AQUQ3MjNmdzFqOWNUZUtSVGxsemxqTXByQmJFbnl6YXZfLXBRZ2JxeEF6ZkpEQ2RYZ3l1NDRScHBreGRHYTVZd2wzQlFjQ0NZLWtpdjhOWldHdml3cnJTNHg2V0VLODV4OWJadmFXWWZhSUhRS0JGMG9lbU1BMmNEMUNQTzI1bGduUmRtNElZMmQyYXhRVXhyZjRQeDhWaVlJV3B1eHlzRmlR
.youtube.com	TRUE	/	TRUE	1825255819	__Secure-1PSIDTS	sidts-CjUBnJZzavLeNlASkEmGSRgadHNZopszfBf9pNbG-5Ef2fU92JH-mWey8fTVym7GPxzeheJVXxAA
.youtube.com	TRUE	/	TRUE	1825255819	__Secure-3PSIDTS	sidts-CjUBnJZzavLeNlASkEmGSRgadHNZopszfBf9pNbG-5Ef2fU92JH-mWey8fTVym7GPxzeheJVXxAA
.youtube.com	TRUE	/	FALSE	1825255819	SIDCC	APD_SKGI_O6jlZFFlAan6LPxE5VNJGq6aLuyVKL1PmyD-Gy-tfbdsVwfuJQ0qJlJ-WomOA7gTQ
.youtube.com	TRUE	/	TRUE	1825255819	__Secure-1PSIDCC	APD_SKHXsrasaDrzcKr8M2PPp6yWlMTyVzFkyLBEB927A9NlEVvxZRqkZ5FDAjG-7JlduZbNwA
.youtube.com	TRUE	/	TRUE	1825255819	__Secure-3PSIDCC	APD_SKGlXnv1RZGUxZPs__-1zz9qtKzPtVxY6KY9f-egS_zQwkyW8p5CrUqKKvLDicultHDnhg
.youtube.com	TRUE	/	TRUE	1809271819	VISITOR_INFO1_LIVE	Jf8osUMeS10
.youtube.com	TRUE	/	TRUE	1809271819	VISITOR_PRIVACY_METADATA	CgJFRxIEGgAgSw%3D%3D
.youtube.com	TRUE	/	TRUE	1809271806	__Secure-YNID	CuwBCAUSngEBDB6PDFBLQsGxauIBU3Om6GKjlq9oYTnVlIoFwQ35p-vLrd8gA03apibVuPr87Bj3qIEOyfm6Lne_Qz6ptmVVM4cNDP1Do9fbEaN7MzMtjrrMMZv9BXiz-bLGb_SbBcspck-LryEjlvQcDN46h2OFTveNetT2juCAaTknJpXMsbKbhq9I-f2hz06hz3sIsVSn6Wc4hDF0qSuFQAwMPigFMkUBHFj1as5Emyy0il60s8VtbAYV2xC7qDVG7pPDHiQB1PKoqMhwAvd9FZdFe1r7bdkZ-zKAMI7qdx-24zXOrRmnzKD4DQU
.youtube.com	TRUE	/	TRUE	0	YSC	9ilY0f8en9k
.youtube.com	TRUE	/	TRUE	1809271806	__Secure-ROLLOUT_TOKEN	CPXGhauU6_yKbRC204iuxJ6WAxiS4bn-juyXAw%3D%3D
`;

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
    if (fs.existsSync(cp) && fs.statSync(cp).size > 100) return cp;
  }
  try {
    const targetFile = fs.existsSync('/home/ubuntu/rivo') ? '/home/ubuntu/rivo/cookies.txt' : path.join(__dirname, '../../cookies.txt');
    fs.writeFileSync(targetFile, EMBEDDED_YOUTUBE_COOKIES, 'utf8');
    return targetFile;
  } catch {}
  return null;
}

const verifiedAudioFiles = new Set();
function isAudioFileValid(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  if (verifiedAudioFiles.has(filePath)) return true;
  try {
    const stats = fs.statSync(filePath);
    if (stats.size < 30000) return false;
    const probe = execFileSync(
      'ffprobe',
      ['-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_type', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
      { timeout: 6000 }
    );
    const valid = probe.toString().trim() === 'audio';
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
  if (!filePath || !fs.existsSync(filePath)) return null;
  if (localFileDurationCache.has(filePath)) return localFileDurationCache.get(filePath);
  try {
    const probe = execFileSync(
      'ffprobe',
      ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath],
      { timeout: 4000 }
    );
    const durSec = Math.round(Number(probe.toString().trim()));
    if (durSec > 0 && durSec < 86400) {
      if (localFileDurationCache.size > 2000) localFileDurationCache.clear();
      localFileDurationCache.set(filePath, durSec);
      return durSec;
    }
  } catch {}
  return null;
}

const INNERTUBE_API_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

async function extractInnertubeDirectStream(videoId) {
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;

  const clientProfiles = [
    {
      name: 'ANDROID',
      context: {
        client: {
          clientName: 'ANDROID',
          clientVersion: '20.01.35',
          androidSdkVersion: 30,
          hl: 'en',
          gl: 'US'
        }
      },
      headers: {
        'User-Agent': 'com.google.android.youtube/20.01.35 (Linux; U; Android 11) gzip'
      }
    },
    {
      name: 'IOS',
      context: {
        client: {
          clientName: 'IOS',
          clientVersion: '20.01.35',
          deviceMake: 'Apple',
          deviceModel: 'iPhone15,2',
          hl: 'en',
          gl: 'US'
        }
      },
      headers: {
        'User-Agent': 'com.google.ios.youtube/20.01.35 (iPhone15,2; U; CPU iOS 18_0 like Mac OS X; en_US)'
      }
    },
    {
      name: 'ANDROID_VR',
      context: {
        client: {
          clientName: 'ANDROID_VR',
          clientVersion: '1.56.21',
          deviceMake: 'Oculus',
          deviceModel: 'Quest 3',
          osName: 'Android',
          osVersion: '12',
          hl: 'en',
          gl: 'US'
        }
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Quest 3) AppleWebKit/537.36'
      }
    },
    {
      name: 'WEB_EMBEDDED_PLAYER',
      context: {
        client: {
          clientName: 'WEB_EMBEDDED_PLAYER',
          clientVersion: '2.20260708.00.00',
          hl: 'en',
          gl: 'US'
        },
        thirdParty: {
          embedUrl: `https://www.youtube.com/embed/${videoId}`
        }
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.youtube.com/'
      }
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
        timeout: 2400
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
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1200));
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
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', streamUrl, '-c', 'copy', '-movflags', '+faststart', fastTarget], { timeout: 35000, env: execEnv });
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
    '--extractor-args', 'youtubepot-bgutilhttp:base_url=http://127.0.0.1:4416',
    '-f', '140/ba[ext=m4a]/ba/bestaudio/18/b',
    '-x',
    '--audio-format', 'm4a',
    '-o', tempTarget
  ];
  if (cp) {
    ytdlpArgs.splice(1, 0, '--cookies', cp);
    ytdlpArgs.splice(3, 0, '--extractor-args', 'youtube:player_client=web');
  } else {
    ytdlpArgs.splice(1, 0, '--extractor-args', 'youtube:player_client=web,mweb');
  }
  ytdlpArgs.push(`https://www.youtube.com/watch?v=${videoId}`);

  await new Promise((resolve) => {
    execFile(bin, ytdlpArgs, { timeout: 45000, env: execEnv }, () => resolve());
  });

  const actualDownloaded = tempTarget.replace('.%(ext)s', '.m4a');
  if (fs.existsSync(actualDownloaded) && isAudioFileValid(actualDownloaded)) {
    const faststartTarget = tempTarget.replace('.%(ext)s', '_fs.m4a');
    try {
      execFileSync('ffmpeg', ['-v', 'error', '-i', actualDownloaded, '-c', 'copy', '-movflags', '+faststart', faststartTarget, '-y'], { timeout: 20000, env: execEnv });
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
  cleanupAudioCache
};
