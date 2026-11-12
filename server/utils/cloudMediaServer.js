const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const mongoose = require('mongoose');
const { Track } = require('../models');
const { uploadsDir } = require('../middleware/upload');
const { isAudioFileValid } = require('./audioCacheUtils');
const {
  fetchTelegramDownloadResponse,
  fetchB2DownloadResponse,
  buildCombinedSignal,
  sleepWithAbort
} = require('./cloudStorageClient');

const cloudCacheDir = path.join(uploadsDir, 'cloud-cache');
const inflightDownloads = new Map();
let cacheCleanupRunning = false;
let cacheWarmupScheduled = false;

function ensureCloudCacheDir() {
  if (!fs.existsSync(cloudCacheDir)) {
    fs.mkdirSync(cloudCacheDir, { recursive: true });
  }
}

function getMaxCacheBytes() {
  const mb = Number(process.env.CLOUD_CACHE_MAX_MB || 3584);
  return Math.max(256, Number.isFinite(mb) ? mb : 3584) * 1024 * 1024;
}

function findCachedCloudFile(trackId, preferredExt = '') {
  ensureCloudCacheDir();
  const candidates = preferredExt
    ? [`${trackId}.${preferredExt}`, `${trackId}.m4a`, `${trackId}.mp3`]
    : [`${trackId}.m4a`, `${trackId}.mp3`];
  for (const name of [...new Set(candidates)]) {
    const full = path.join(cloudCacheDir, name);
    if (fs.existsSync(full) && isAudioFileValid(full)) {
      return full;
    }
  }
  return null;
}

function touchCacheFile(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (Date.now() - stat.mtimeMs > 60000) {
      const now = new Date();
      fs.utimes(filePath, now, now, () => {});
    }
  } catch {}
}

/**
 * Enforces bounded LRU cache size so disk never fills up.
 */
async function enforceCloudCacheLimit() {
  if (cacheCleanupRunning) return;
  cacheCleanupRunning = true;
  try {
    ensureCloudCacheDir();
    const maxBytes = getMaxCacheBytes();
    const entries = await fs.promises.readdir(cloudCacheDir);
    const files = [];
    let total = 0;

    for (const entry of entries) {
      if (entry.endsWith('.tmp')) continue;
      const full = path.join(cloudCacheDir, entry);
      try {
        const st = await fs.promises.stat(full);
        if (st.isFile()) {
          total += st.size;
          files.push({ full, size: st.size, mtimeMs: st.mtimeMs });
        }
      } catch {}
    }

    if (total <= maxBytes) return;
    files.sort((a, b) => a.mtimeMs - b.mtimeMs);
    const target = Math.floor(maxBytes * 0.85);
    for (const f of files) {
      if (total <= target) break;
      try {
        await fs.promises.unlink(f.full);
        total -= f.size;
      } catch {}
    }
  } catch {} finally {
    cacheCleanupRunning = false;
  }
}

/**
 * Copies a freshly migrated local audio file into cloud-cache so first plays are instant.
 */
async function seedCloudCache(trackId, ext, sourceFilePath) {
  try {
    if (!trackId || !sourceFilePath || !fs.existsSync(sourceFilePath)) return null;
    ensureCloudCacheDir();
    const cleanExt = (ext || path.extname(sourceFilePath).replace('.', '') || 'm4a').toLowerCase();
    const dest = path.join(cloudCacheDir, `${trackId}.${cleanExt}`);
    if (fs.existsSync(dest) && isAudioFileValid(dest)) return dest;
    const tmp = `${dest}.${Date.now()}.tmp`;
    await fs.promises.copyFile(sourceFilePath, tmp);
    await fs.promises.rename(tmp, dest);
    enforceCloudCacheLimit().catch(() => {});
    return dest;
  } catch {
    return null;
  }
}

async function downloadStreamToFile(webStream, destFile) {
  const tmpFile = `${destFile}.${Date.now()}.tmp`;
  const nodeReadable = Readable.fromWeb(webStream);
  const writer = fs.createWriteStream(tmpFile);
  try {
    await new Promise((resolve, reject) => {
      nodeReadable.on('error', reject);
      writer.on('error', reject);
      writer.on('finish', resolve);
      nodeReadable.pipe(writer);
    });
    if (!isAudioFileValid(tmpFile)) {
      throw new Error('Downloaded cloud file failed audio header check');
    }
    await fs.promises.rename(tmpFile, destFile);
    return destFile;
  } catch (err) {
    try { await fs.promises.unlink(tmpFile); } catch {}
    throw err;
  }
}

/**
 * Ensures a cloud-stored track is downloaded into the local LRU cache.
 */
async function ensureCloudFileCached(track) {
  const trackId = String(track._id || track.id);
  const cs = track.cloudStorage || {};
  const ext = (cs.ext || 'm4a').toLowerCase();

  const existing = findCachedCloudFile(trackId, ext);
  if (existing) {
    touchCacheFile(existing);
    return existing;
  }

  if (inflightDownloads.has(trackId)) {
    return inflightDownloads.get(trackId);
  }

  const job = (async () => {
    ensureCloudCacheDir();
    const destFile = path.join(cloudCacheDir, `${trackId}.${ext}`);
    const { signal, cleanup } = buildCombinedSignal(90000);

    try {
      if (cs.provider === 'telegram') {
        const res = await fetchTelegramDownloadResponse(cs, null, signal);
        if (!res.ok || !res.body) {
          throw new Error(`Telegram file download HTTP ${res.status}`);
        }
        await downloadStreamToFile(res.body, destFile);
      } else if (cs.provider === 'b2') {
        const res = await fetchB2DownloadResponse(cs, null, signal);
        if (!res.ok || !res.body) {
          throw new Error(`Backblaze B2 download HTTP ${res.status}`);
        }
        await downloadStreamToFile(res.body, destFile);
      } else {
        throw new Error('Unsupported cloudStorage provider');
      }

      enforceCloudCacheLimit().catch(() => {});
      return destFile;
    } finally {
      cleanup();
      inflightDownloads.delete(trackId);
    }
  })();

  inflightDownloads.set(trackId, job);
  return job;
}

async function fetchCloudRangeUpstream(cs, rangeHeader, signal) {
  if (cs.provider === 'telegram') {
    return fetchTelegramDownloadResponse(cs, rangeHeader, signal);
  }
  if (cs.provider === 'b2') {
    return fetchB2DownloadResponse(cs, rangeHeader, signal);
  }
  throw new Error('Unsupported cloudStorage provider');
}

async function streamCloudWithRange(track, req, res) {
  const controller = new AbortController();
  let nodeStream = null;
  const abortAll = () => {
    try { controller.abort(); } catch {}
    try { if (nodeStream && typeof nodeStream.destroy === 'function') nodeStream.destroy(); } catch {}
  };
  req.on('close', () => { if (!res.writableEnded) abortAll(); });
  res.on('close', () => { if (!res.writableEnded) abortAll(); });

  const { signal, cleanup } = buildCombinedSignal(120000, controller.signal);
  try {
    const upstream = await fetchCloudRangeUpstream(track.cloudStorage, req.headers.range, signal);
    if (!upstream.ok && upstream.status !== 206 && upstream.status !== 416) {
      cleanup();
      if (!res.headersSent) return res.status(502).send('Upstream storage error');
      return;
    }

    const ext = (track.cloudStorage?.ext || 'm4a').toLowerCase();
    res.status(upstream.status);
    res.setHeader('Content-Type', ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=604800');
    const len = upstream.headers.get('content-length');
    const cr = upstream.headers.get('content-range');
    if (len) res.setHeader('Content-Length', len);
    if (cr) res.setHeader('Content-Range', cr);

    if (!upstream.body) {
      cleanup();
      return res.end();
    }
    nodeStream = Readable.fromWeb(upstream.body);
    nodeStream.on('error', () => {
      cleanup();
      if (!res.headersSent) res.status(500).end();
    });
    nodeStream.on('end', cleanup);
    nodeStream.pipe(res);
  } catch {
    cleanup();
    if (!res.headersSent) res.status(502).send('Failed to stream cloud media');
  }
}

/**
 * Express handler for /uploads/cloud/:file and /api/tracks/media/:file
 */
async function handleCloudMediaRequest(req, res) {
  try {
    const rawParam = String(req.params.file || '').trim();
    const match = rawParam.match(/^([a-fA-F0-9]{24})(?:\.(m4a|mp3|aac|ogg))?$/);
    if (!match) return res.status(400).send('Invalid track media identifier');

    const trackId = match[1];
    const reqExt = (match[2] || '').toLowerCase();

    const cached = findCachedCloudFile(trackId, reqExt);
    if (cached) {
      touchCacheFile(cached);
      const ext = path.extname(cached).toLowerCase();
      res.setHeader('Content-Type', ext === '.mp3' ? 'audio/mpeg' : 'audio/mp4');
      res.setHeader('Cache-Control', 'public, max-age=604800');
      res.setHeader('Accept-Ranges', 'bytes');
      return res.sendFile(cached);
    }

    if (!mongoose.isValidObjectId(trackId)) {
      return res.status(404).send('Track not found');
    }

    const track = await Track.findById(trackId).select('cloudStorage legacyAudioUrl title artist').lean();
    if (!track || !track.cloudStorage?.provider) {
      return res.status(404).send('Cloud media not found');
    }

    const fileSize = Number(track.cloudStorage.fileSize || 0);
    // Warm NVMe SSD cache in background for fast tracks <= 25MB without blocking byte 1
    if (!(track.cloudStorage.provider === 'b2' && fileSize > 25 * 1024 * 1024)) {
      ensureCloudFileCached(track).catch(() => {});
    }

    return streamCloudWithRange(track, req, res);
  } catch (err) {
    console.warn('[CloudMedia] Stream error:', err.message);
    if (!res.headersSent) res.status(502).send('Cloud audio stream unavailable');
  }
}

/**
 * Serves a migrated cloud track as an attachment for /api/tracks/download.
 */
async function serveCloudDownload(track, cleanFilename, req, res) {
  const cs = track?.cloudStorage;
  if (!cs?.provider) return false;
  const ext = (cs.ext || 'm4a').toLowerCase();
  const safeAscii = cleanFilename.replace(/[^\x20-\x7E]/g, '').trim() || 'track';
  const contentType = ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4';

  res.set({
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${safeAscii}.${ext}"; filename*=UTF-8''${encodeURIComponent(cleanFilename)}.${ext}`,
    'Access-Control-Allow-Origin': '*'
  });

  if (cs.provider === 'b2' && Number(cs.fileSize || 0) > 25 * 1024 * 1024) {
    const { signal, cleanup } = buildCombinedSignal(180000);
    try {
      const upstream = await fetchB2DownloadResponse(cs, null, signal);
      if (!upstream.ok || !upstream.body) throw new Error(`B2 HTTP ${upstream.status}`);
      const stream = Readable.fromWeb(upstream.body);
      req.on('close', () => { cleanup(); try { stream.destroy(); } catch {} });
      stream.on('end', cleanup);
      stream.on('error', () => { cleanup(); if (!res.headersSent) res.status(502).end(); });
      stream.pipe(res);
      return true;
    } catch {
      cleanup();
      return false;
    }
  }

  const cachedPath = await ensureCloudFileCached(track);
  fs.createReadStream(cachedPath).pipe(res);
  return true;
}

/**
 * Gently warms the NVMe cloud cache with popular music tracks (<= 25MB) in the background.
 */
function scheduleCloudCacheWarmup({ limit = 450 } = {}) {
  if (cacheWarmupScheduled) return;
  cacheWarmupScheduled = true;

  const timer = setTimeout(async () => {
    try {
      if (mongoose.connection.readyState !== 1) return;
      ensureCloudCacheDir();
      const maxBytes = Math.floor(getMaxCacheBytes() * 0.85);
      const tracks = await Track.find({
        'cloudStorage.provider': { $in: ['telegram', 'b2'] },
        $or: [
          { 'cloudStorage.fileSize': { $lte: 25 * 1024 * 1024 } },
          { 'cloudStorage.fileSize': { $exists: false } }
        ]
      })
        .sort({ plays: -1 })
        .limit(limit)
        .select('cloudStorage')
        .lean();

      for (const track of tracks) {
        if (mongoose.connection.readyState !== 1) break;
        const ext = (track.cloudStorage?.ext || 'm4a').toLowerCase();
        if (findCachedCloudFile(String(track._id), ext)) continue;

        let currentSize = 0;
        try {
          const names = fs.readdirSync(cloudCacheDir);
          for (const n of names) {
            if (n.endsWith('.tmp')) continue;
            try { currentSize += fs.statSync(path.join(cloudCacheDir, n)).size; } catch {}
          }
        } catch {}
        if (currentSize >= maxBytes) break;

        try {
          await ensureCloudFileCached(track);
        } catch {}
        await sleepWithAbort(120);
      }
    } catch {}
  }, 8000);
  if (typeof timer.unref === 'function') timer.unref();
}

module.exports = {
  cloudCacheDir,
  findCachedCloudFile,
  seedCloudCache,
  ensureCloudFileCached,
  handleCloudMediaRequest,
  serveCloudDownload,
  scheduleCloudCacheWarmup
};
