const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Track } = require('../../models');
const { upload, uploadsDir } = require('../../middleware/upload');
const { safeResolveUpload } = require('../../utils/security');
const {
  escapeRegex,
  resolveOfficialYouTubeAudioStream,
  isAudioFileValid,
  downloadYouTubeAudioToCache,
  searchYouTubeId,
} = require('../../utils/helpers');
const { ensureCloudFileCached } = require('../../utils/cloudMediaServer');

async function resolveTrackStemInfo(req) {
  let { id, trackId, url, title, artist, duration } = req.query;
  trackId = trackId || id;

  let dbTrack = null;
  if (trackId && mongoose.isValidObjectId(trackId)) {
    try { dbTrack = await Track.findById(trackId).lean(); } catch {}
  }
  if (!dbTrack && (title || artist)) {
    try {
      const query = {};
      if (title && artist) {
        query.title = new RegExp(`^${escapeRegex(title)}$`, 'i');
        query.artist = new RegExp(`^${escapeRegex(artist)}$`, 'i');
      } else if (title) {
        query.title = new RegExp(`^${escapeRegex(title)}$`, 'i');
      }
      dbTrack = await Track.findOne(query).lean();
    } catch {}
  }
  if (dbTrack) {
    trackId = trackId || String(dbTrack._id);
    if (dbTrack.cloudStorage?.provider || !url) {
      url = dbTrack.audioUrl || url;
    }
    title = title || dbTrack.title;
    artist = artist || dbTrack.artist;
    duration = duration || dbTrack.duration;
  }

  const aliases = [];
  if (trackId) aliases.push(String(trackId));
  const legacyUrl = dbTrack?.legacyAudioUrl || '';
  for (const candidateUrl of [url, legacyUrl]) {
    if (!candidateUrl) continue;
    const vidMatch = candidateUrl.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
    if (vidMatch && vidMatch[1]) {
      aliases.push(`yt_${vidMatch[1]}`);
      aliases.push(vidMatch[1]);
    }
    aliases.push(crypto.createHash('md5').update(candidateUrl).digest('hex'));
  }
  if (dbTrack?.youtubeId) {
    aliases.push(`yt_${dbTrack.youtubeId}`);
    aliases.push(dbTrack.youtubeId);
  }
  if (title) {
    const cleanT = String(title).toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    const cleanA = String(artist || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    if (cleanT) {
      aliases.push(`ta_${crypto.createHash('md5').update(`${cleanT}_${cleanA}`).digest('hex')}`);
      aliases.push(crypto.createHash('md5').update(`${title}_${artist}`).digest('hex'));
    }
  }

  const uniqueAliases = [...new Set(aliases)];
  const primaryKey = uniqueAliases[0] || (title ? `ta_${crypto.createHash('md5').update(title).digest('hex')}` : 'unknown_' + Date.now());

  return { trackId, url, title, artist, duration, primaryKey, aliases: uniqueAliases, dbTrack };
}

// Check real-time status of vocal isolation
router.get('/vocal-status', async (req, res) => {
  try {
    const { primaryKey, aliases } = await resolveTrackStemInfo(req);
    const { getVocalIsolationStatus } = require('../../utils/vocalSeparator');
    const status = getVocalIsolationStatus(primaryKey, aliases);
    res.json({ success: true, stemKey: primaryKey, ...status });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Vocal-Only Stream (Music-Free) with Stems Caching
router.get('/vocal-stream', async (req, res) => {
  try {
    let { json, priority, prefetch } = req.query;
    const isPriority = priority === '1' || priority === 'true' || (!prefetch && req.headers['x-rivo-priority']);
    const { trackId, url, title, artist, duration, primaryKey, aliases, dbTrack } = await resolveTrackStemInfo(req);
    const { getVocalStemPath, getVocalIsolationStatus, startVocalIsolation } = require('../../utils/vocalSeparator');

    const status = getVocalIsolationStatus(primaryKey, aliases);
    if (status.status === 'ready') {
      const stemFilePath = getVocalStemPath(primaryKey);
      if (json === 'true' || json === '1') {
        return res.json({ success: true, status: 'ready', url: status.url, cached: true });
      }
      return res.sendFile(stemFilePath);
    }

    let sourceAudioPath = url || '';
    if (dbTrack?.cloudStorage?.provider || sourceAudioPath.includes('/uploads/cloud/')) {
      let cloudTrack = dbTrack;
      if (!cloudTrack && sourceAudioPath) {
        const m = sourceAudioPath.match(/\/uploads\/cloud\/([a-fA-F0-9]{24})/);
        if (m?.[1] && mongoose.isValidObjectId(m[1])) {
          try { cloudTrack = await Track.findById(m[1]).lean(); } catch {}
        }
      }
      if (cloudTrack?.cloudStorage?.provider) {
        const localCloud = await ensureCloudFileCached(cloudTrack).catch(() => null);
        if (localCloud && fs.existsSync(localCloud)) {
          sourceAudioPath = localCloud;
        }
      }
    }

    if (sourceAudioPath.startsWith('/uploads/') || sourceAudioPath.startsWith('uploads/')) {
      const resolvedUpload = safeResolveUpload(sourceAudioPath, uploadsDir);
      if (resolvedUpload && fs.existsSync(resolvedUpload)) {
        sourceAudioPath = resolvedUpload;
      }
    } else if (sourceAudioPath.includes('/api/tracks/stream-proxy?url=')) {
      const mUrl = sourceAudioPath.split('/api/tracks/stream-proxy?url=')[1];
      if (mUrl) sourceAudioPath = decodeURIComponent(mUrl);
    }

    const cacheDir = path.join(uploadsDir, 'audio-cache');
    const vidMatch = (sourceAudioPath || '').match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i) ||
                     (url || '').match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
    if (vidMatch && vidMatch[1]) {
      const vid = vidMatch[1];
      const localM4a = path.join(cacheDir, `${vid}.m4a`);
      const localMp3 = path.join(cacheDir, `${vid}.mp3`);
      if (fs.existsSync(localM4a) && isAudioFileValid(localM4a)) {
        sourceAudioPath = localM4a;
      } else if (fs.existsSync(localMp3) && isAudioFileValid(localMp3)) {
        sourceAudioPath = localMp3;
      }
    }

    if (!sourceAudioPath || sourceAudioPath.includes('youtube.com/watch') || sourceAudioPath.includes('youtu.be/')) {
      const directStream = await resolveOfficialYouTubeAudioStream(url || trackId || '', title || '', artist || '', { duration });
      const resolvedUrl = typeof directStream === 'object' && directStream?.url ? directStream.url : (typeof directStream === 'string' ? directStream : (directStream ? String(directStream) : ''));
      if (resolvedUrl) {
        if (resolvedUrl.startsWith('/uploads/') || resolvedUrl.startsWith('uploads/')) {
          sourceAudioPath = safeResolveUpload(resolvedUrl, uploadsDir) || path.join(__dirname, '../..', resolvedUrl);
        } else {
          sourceAudioPath = resolvedUrl;
        }
      }
    }

    let targetVid = null;
    const activeVidMatch = (sourceAudioPath || '').match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i) ||
                           (url || '').match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i) ||
                           (trackId && /^[a-zA-Z0-9_-]{11}$/.test(trackId) && !mongoose.isValidObjectId(trackId) ? [null, trackId] : null);

    if (activeVidMatch && activeVidMatch[1]) {
      targetVid = activeVidMatch[1];
    }

    if (targetVid && /^[a-zA-Z0-9_-]{11}$/.test(targetVid)) {
      if (!fs.existsSync(cacheDir)) {
        try { fs.mkdirSync(cacheDir, { recursive: true }); } catch {}
      }
      const localTarget = path.join(cacheDir, `${targetVid}.m4a`);
      if (fs.existsSync(localTarget) && isAudioFileValid(localTarget)) {
        sourceAudioPath = localTarget;
      } else {
        const downloaded = await downloadYouTubeAudioToCache(targetVid, cacheDir);
        if (downloaded && isAudioFileValid(downloaded)) {
          sourceAudioPath = downloaded;
        }
      }
    }

    if (!sourceAudioPath || sourceAudioPath.includes('youtube.com/watch') || sourceAudioPath.includes('youtu.be/')) {
      return res.status(422).json({ error: 'Audio source could not be resolved for vocal separation' });
    }

    const job = startVocalIsolation(sourceAudioPath, primaryKey, aliases, isPriority);

    if (json !== 'true' && json !== '1' && !prefetch) {
      // Direct stream requested but vocal stem is still being isolated: never return JSON as audio
      return res.status(404).set('Content-Type', 'text/plain').send('Vocal stem is processing');
    }

    return res.status(202).json({
      success: false,
      status: job.status,
      progress: job.progress || 0,
      eta: job.eta || 'Preparing audio...',
      stemKey: primaryKey
    });
  } catch (err) {
    res.status(500).json({ error: 'Vocal separation failed: ' + err.message });
  }
});

const workerAuth = (req, res, next) => {
  const secret = req.headers['x-worker-secret'] || req.query?.secret || req.body?.secret;
  const configuredSecret = process.env.WORKER_SECRET || process.env.DEPLOY_SECRET || process.env.JWT_SECRET;

  if (configuredSecret && secret && typeof secret === 'string') {
    const userHash = crypto.createHash('sha256').update(String(secret)).digest();
    const serverHash = crypto.createHash('sha256').update(String(configuredSecret)).digest();
    if (crypto.timingSafeEqual(userHash, serverHash)) {
      return next();
    }
  }

  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (authHeader) {
    const { verifyJwt, isAdminUser } = require('../../middleware/auth');
    try {
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      const decoded = verifyJwt(token);
      if (isAdminUser(decoded) || decoded?.role === 'admin') {
        return next();
      }
    } catch {}
  }

  return res.status(403).json({ error: 'Unauthorized: Valid worker secret or administrator credentials required.' });
};

router.get('/vocal-worker/next', workerAuth, (req, res) => {
  try {
    const { getNextWorkerJob } = require('../../utils/vocalSeparator');
    const workerId = req.query.worker || 'Colab-Worker';
    const job = getNextWorkerJob(workerId);
    if (!job) {
      return res.json({ hasJob: false });
    }
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.json({
      hasJob: true,
      stemKey: job.stemKey,
      aliases: job.aliases || [],
      title: job.title || job.stemKey,
      audioUrl: `${baseUrl}/api/tracks/vocal-worker/audio/${encodeURIComponent(job.stemKey)}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/vocal-worker/audio/:stemKey', workerAuth, (req, res) => {
  try {
    const { getSafeStemKey, getJobInputSource } = require('../../utils/vocalSeparator');
    const safe = getSafeStemKey(req.params.stemKey);
    const jobSource = getJobInputSource(safe);
    if (jobSource && fs.existsSync(jobSource)) {
      return res.sendFile(jobSource);
    }
    const cacheDir = path.join(uploadsDir, 'audio-cache');
    let audioPath = null;
    if (fs.existsSync(cacheDir)) {
      const files = fs.readdirSync(cacheDir);
      const m = files.find(f => f.startsWith(safe) || safe.includes(path.parse(f).name));
      if (m) audioPath = path.join(cacheDir, m);
    }
    if (audioPath && fs.existsSync(audioPath)) {
      return res.sendFile(audioPath);
    }
    res.status(404).json({ error: 'Source audio not found on server' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/vocal-worker/complete', workerAuth, upload.single('vocalFile'), (req, res) => {
  try {
    const { stemKey, aliases, worker } = req.body;
    if (!stemKey || !req.file) {
      return res.status(400).json({ error: 'Missing stemKey or vocalFile' });
    }
    const { completeWorkerJob } = require('../../utils/vocalSeparator');
    const aliasList = aliases ? aliases.split(',').map(s => s.trim()).filter(Boolean) : [];
    const success = completeWorkerJob(stemKey, req.file.path, aliasList, worker || 'Colab-Worker');
    try { fs.unlinkSync(req.file.path); } catch {}
    res.json({ success });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/vocal-worker/status', workerAuth, (req, res) => {
  try {
    const { getWorkerStatus } = require('../../utils/vocalSeparator');
    res.json({ success: true, ...getWorkerStatus() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.resolveTrackStemInfo = resolveTrackStemInfo;
module.exports = router;

