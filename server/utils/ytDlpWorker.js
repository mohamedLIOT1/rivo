const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { spawn } = require('child_process');
const { getCookiesPath, isAudioFileValid, downloadYouTubeAudioToCache } = require('./audioCacheUtils');

function getYtDlpBin() {
  const isWin = process.platform === 'win32';
  const binName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
  
  const possiblePaths = [
    '/usr/local/bin/yt-dlp',
    '/usr/bin/yt-dlp',
    '/home/ubuntu/.local/bin/yt-dlp',
    '/home/ubuntu/rivo/bin/yt-dlp',
    '/home/ubuntu/bin/yt-dlp',
    path.join(__dirname, '../../bin', binName),
    path.join(__dirname, '../bin', binName),
    path.join(process.cwd(), 'bin', binName),
    path.join(process.cwd(), '../bin', binName)
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      if (!isWin) {
        try { fs.chmodSync(p, 0o755); } catch {}
      }
      return p;
    }
  }

  return 'yt-dlp';
}

async function ensureYtDlpBinary() {
  const isWin = process.platform === 'win32';
  const binDir = path.join(__dirname, '../../bin');
  if (!fs.existsSync(binDir)) {
    try { fs.mkdirSync(binDir, { recursive: true }); } catch {}
  }
  const localBin = path.join(binDir, isWin ? 'yt-dlp.exe' : 'yt-dlp');
  if (fs.existsSync(localBin) && fs.statSync(localBin).size > 1000000) {
    if (!isWin) {
      try { fs.chmodSync(localBin, 0o755); } catch {}
    }
    return localBin;
  }
  try {
    const dlUrl = isWin
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
    const res = await axios({ method: 'get', url: dlUrl, responseType: 'stream', timeout: 60000 });
    const writer = fs.createWriteStream(localBin);
    await new Promise((resolve, reject) => {
      res.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    if (!isWin) {
      try { fs.chmodSync(localBin, 0o755); } catch {}
    }
  } catch (e) {
    console.warn('[yt-dlp] download notice:', e.message);
  }
  return localBin;
}

let ytWorkerProc = null;
const ytWorkerPending = new Map();
let ytWorkerReqSeq = 0;
let warmWorkerFailedPermanently = false;

function initWarmYtWorker() {
  if (process.platform === 'win32' || ytWorkerProc || warmWorkerFailedPermanently) return;
  try {
    const cp = getCookiesPath();
    const pyScript = `
import sys, os, json
try:
    import yt_dlp
except ImportError:
    try:
        sys.path.insert(0, '/usr/local/bin/yt-dlp')
        import yt_dlp
    except Exception:
        sys.exit(42)

opts = {
    'quiet': True,
    'no_warnings': True,
    'nocheckcertificate': True,
    'noplaylist': True,
    'ignoreconfig': True,
    'extractor_args': {
        'youtubepot-bgutilhttp': {'base_url': ['http://127.0.0.1:4416']},
        'youtube': {'player_client': ['web']}
    },
    'format': '140/ba[ext=m4a]/ba/bestaudio/18/b'
}
cookie_path = ${JSON.stringify(cp || '')}
if cookie_path and os.path.exists(cookie_path):
    opts['cookiefile'] = cookie_path

ydl = yt_dlp.YoutubeDL(opts)
print("READY", flush=True)

for line in sys.stdin:
    line = line.strip()
    if not line: continue
    rid = 0
    try:
        req = json.loads(line)
        rid = req.get('id', 0)
        vid = req.get('videoId', '')
        info = ydl.extract_info(f'https://www.youtube.com/watch?v={vid}', download=False)
        print(json.dumps({'id': rid, 'url': info.get('url'), 'duration': info.get('duration')}), flush=True)
    except Exception as e:
        print(json.dumps({'id': rid, 'url': None, 'error': str(e)}), flush=True)
`;
    const proc = spawn('python3', ['-u', '-c', pyScript], { stdio: ['pipe', 'pipe', 'ignore'] });
    let isReady = false;
    let buf = '';
    proc.stdout.on('data', (chunk) => {
      buf += chunk.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const l of lines) {
        const trimmed = l.trim();
        if (trimmed === 'READY') {
          isReady = true;
          continue;
        }
        if (!trimmed) continue;
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed && ytWorkerPending.has(parsed.id)) {
            const { resolve, timer } = ytWorkerPending.get(parsed.id);
            clearTimeout(timer);
            ytWorkerPending.delete(parsed.id);
            if (parsed.url) {
              const res = new String(parsed.url);
              res.url = parsed.url;
              res.duration = parsed.duration ? Math.round(Number(parsed.duration)) : null;
              resolve(res);
            } else {
              resolve(null);
            }
          }
        } catch {}
      }
    });
    proc.on('exit', (code) => {
      ytWorkerProc = null;
      for (const [, { resolve, timer }] of ytWorkerPending.entries()) {
        clearTimeout(timer);
        resolve(null);
      }
      ytWorkerPending.clear();
      if (!isReady || code === 42) {
        warmWorkerFailedPermanently = true;
      } else {
        setTimeout(initWarmYtWorker, 10000);
      }
    });
    ytWorkerProc = proc;
  } catch (e) {
    warmWorkerFailedPermanently = true;
  }
}

function extractViaWarmWorker(videoId) {
  if (warmWorkerFailedPermanently || !ytWorkerProc || !ytWorkerProc.stdin || !ytWorkerProc.stdin.writable) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const id = ++ytWorkerReqSeq;
    const timer = setTimeout(() => {
      ytWorkerPending.delete(id);
      resolve(null);
    }, 8000);
    ytWorkerPending.set(id, { resolve, timer });
    try {
      ytWorkerProc.stdin.write(JSON.stringify({ id, videoId }) + '\n');
    } catch {
      clearTimeout(timer);
      ytWorkerPending.delete(id);
      resolve(null);
    }
  });
}

const activeBackgroundDownloads = new Set();
const MAX_CONCURRENT_BG_DOWNLOADS = 3;
const bgDownloadQueue = [];

function queueBackgroundAudioCache(videoId, targetFile, highPriority = false, streamUrl = null) {
  try {
    if (fs.existsSync(targetFile) && fs.statSync(targetFile).size > 20000) return;
  } catch {}
  if (activeBackgroundDownloads.has(videoId)) return;
  if (bgDownloadQueue.some(item => item.videoId === videoId)) return;

  if (highPriority) {
    bgDownloadQueue.unshift({ videoId, targetFile, streamUrl });
  } else {
    bgDownloadQueue.push({ videoId, targetFile, streamUrl });
  }
  processNextBgDownload();
}

function processNextBgDownload() {
  if (activeBackgroundDownloads.size >= MAX_CONCURRENT_BG_DOWNLOADS) return;
  if (bgDownloadQueue.length === 0) return;

  const { videoId, targetFile, streamUrl } = bgDownloadQueue.shift();
  try {
    if (fs.existsSync(targetFile) && isAudioFileValid(targetFile)) {
      return processNextBgDownload();
    }
  } catch {}

  activeBackgroundDownloads.add(videoId);
  downloadYouTubeAudioToCache(videoId, path.dirname(targetFile), streamUrl, getYtDlpBin).finally(() => {
    activeBackgroundDownloads.delete(videoId);
    processNextBgDownload();
  });
}

module.exports = {
  getYtDlpBin,
  ensureYtDlpBinary,
  initWarmYtWorker,
  extractViaWarmWorker,
  queueBackgroundAudioCache,
  processNextBgDownload
};
