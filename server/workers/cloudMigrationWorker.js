const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { Track, SongLyrics } = require('../models');
const { uploadsDir } = require('../middleware/upload');
const {
  isAudioFileValid,
  getLocalAudioFileDuration,
  searchYouTubeId,
  fetchTrackCover,
  fetchLrclibLyrics,
  getTrackKey
} = require('../utils/helpers');
const {
  TELEGRAM_MAX_BYTES,
  uploadAudioToTelegram,
  uploadAudioToB2,
  buildCombinedSignal,
  sleepWithAbort
} = require('../utils/cloudStorageClient');
const { seedCloudCache } = require('../utils/cloudMediaServer');
const { resolveQuranB2AccountForUpload } = require('../utils/cloudUsageHelper');
const { classifyTrackBeforeMigration } = require('../utils/trackContentClassifier');
const { downloadAudioWithPlanB } = require('../utils/cloudDownloadHelper');

const tempWorkDir = path.join(uploadsDir, 'cloud-tmp');
const QURAN_COMPRESS_MAX_BYTES = 15 * 1024 * 1024;
const GENERIC_GENRE_SET = new Set([
  '', 'other', 'unknown', 'imported', 'music', 'single', 'audio', 'track',
  'various', 'general', 'stereo', 'youtube', 'spotify', 'pop', 'quran', 'arabic pop'
]);

const randomBetween = (minMs, maxMs) => Math.floor(minMs + Math.random() * (maxMs - minMs));

function extractYouTubeId(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const s = raw.trim();
  const m1 = s.match(/(?:v=|videoId=|video_id=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
  if (m1?.[1]) return m1[1];
  const m2 = s.match(/^yt[-_]?([a-zA-Z0-9_-]{11})$/i);
  if (m2?.[1]) return m2[1];
  return /^[a-zA-Z0-9_-]{11}$/.test(s) ? s : null;
}

function getAllowedCategories() {
  const raw = (process.env.CLOUD_MIGRATION_PHASE || 'all').toLowerCase();
  if (raw === 'all') return new Set(['music', 'quran', 'podcast']);
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

function isLiveRadioTrack(track) {
  const url = String(track.audioUrl || '').toLowerCase();
  return Boolean(
    track.isRadio || track.isLive || url.includes('radiojar.com') ||
    url.includes('qurango.net') || url.includes('xecod.com') || url.includes('mp3quran.net/')
  );
}

function buildMigrationQuery(allowedCategories, targetCategory = null) {
  const allowedArr = Array.from(allowedCategories);
  const quranOr = [{ isQuran: true }, { contentType: 'quran' }, { genre: /quran|قرآن/i }, { album: /quran|قرآن/i }, { title: /سورة|تلاوة|القرآن/i }];
  const podcastOr = [{ isPodcast: true }, { contentType: 'podcast' }, { genre: /podcast|بودكاست/i }];
  const baseOr = [{ 'migration.status': { $nin: ['migrated', 'skipped', 'deferred'] } }, { 'migration.status': 'deferred', 'migration.category': { $in: allowedArr } }];
  const andClauses = [{ $or: baseOr }, { $or: [{ 'migration.attempts': { $exists: false } }, { 'migration.attempts': { $lt: 3 } }] }];
  if (targetCategory === 'quran') andClauses.push({ $or: quranOr });
  else if (targetCategory === 'podcast') andClauses.push({ $or: podcastOr });
  else if (targetCategory === 'music') {
    andClauses.push({ isQuran: { $ne: true }, isPodcast: { $ne: true }, genre: { $not: /quran|قرآن|podcast|بودكاست/i }, title: { $not: /سورة|تلاوة|القرآن/i } });
  }
  const query = {
    'cloudStorage.provider': { $exists: false },
    audioUrl: { $not: /^\/?uploads\/cloud\//i },
    $and: andClauses,
    contentType: { $nin: ['audiobook', ...(!allowedCategories.has('quran') ? ['quran'] : []), ...(!allowedCategories.has('podcast') ? ['podcast'] : [])] }
  };
  if (!allowedCategories.has('quran')) query.isQuran = { $ne: true };
  if (!allowedCategories.has('podcast')) query.isPodcast = { $ne: true };
  return query;
}

function resolveVerifiedGenreUpdate(track, cls) {
  const aiGenre = String(cls?.genre || '').trim();
  if (!aiGenre) return null;
  const existing = String(track?.genre || '').trim();
  if (cls.category === 'quran' && existing !== 'Holy Quran') return 'Holy Quran';
  if (cls.category === 'podcast' && existing !== 'Podcast') return 'Podcast';
  if (cls.category === 'music' && aiGenre !== existing) {
    if (!existing || GENERIC_GENRE_SET.has(existing.toLowerCase()) || cls.source === 'ai') return aiGenre;
  }
  return null;
}

async function transcodeQuranVoiceAudio(inputFile, trackId, signal) {
  if (!inputFile || signal?.aborted) return null;
  if (!fs.existsSync(tempWorkDir)) fs.mkdirSync(tempWorkDir, { recursive: true });
  const outPath = path.join(tempWorkDir, `${trackId}_quran64k_${Date.now()}.m4a`);
  const nodeBinDir = path.dirname(process.execPath);
  const execEnv = { ...process.env, PATH: `${nodeBinDir}:/usr/local/bin:/usr/bin:/bin:` + (process.env.PATH || '') };
  const args = ['-v', 'error', '-y', '-i', inputFile, '-vn', '-c:a', 'aac', '-b:a', '64k', '-ac', '1', '-movflags', '+faststart', outPath];

  const ok = await new Promise((resolve) => {
    const child = execFile('ffmpeg', args, { timeout: 600000, env: execEnv }, (err) => resolve(!err));
    if (signal) {
      const onAbort = () => { try { child.kill('SIGTERM'); } catch {} };
      signal.addEventListener('abort', onAbort, { once: true });
      child.on('exit', () => signal.removeEventListener('abort', onAbort));
    }
  });
  if (ok && fs.existsSync(outPath) && isAudioFileValid(outPath)) return outPath;
  try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch {}
  return null;
}

async function notifyServerCacheInvalidated(trackId, signal) {
  if (signal?.aborted) return;
  const port = process.env.PORT || 5000;
  const { signal: reqSignal, cleanup } = buildCombinedSignal(3000, signal);
  try {
    await fetch(`http://127.0.0.1:${port}/api/tracks/internal/invalidate-cache`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId: String(trackId) }),
      signal: reqSignal
    });
  } catch {
    // Non-fatal if standalone bot runs while API server is offline
  } finally {
    cleanup();
  }
}

async function enrichCoverAndLyrics(track, videoId) {
  const updates = {};
  const cover = String(track.cover || '');
  const needsCover = !cover || cover.includes('unsplash.com') || cover.includes('pixabay.com') || cover.includes('format=svg');
  if (needsCover) {
    try {
      const fetched = await fetchTrackCover(track.title, track.artist);
      if (fetched) updates.cover = fetched;
      else if (videoId) updates.cover = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    } catch {}
  }
  if (!Array.isArray(track.lyrics) || track.lyrics.length === 0) {
    try {
      const key = getTrackKey(track.title, track.artist);
      const savedLyrics = await SongLyrics.findOne({ $or: [{ trackId: String(track._id) }, { trackKey: key }] }).select('lyrics').lean();
      if (savedLyrics?.lyrics?.length > 0) updates.lyrics = savedLyrics.lyrics;
      else if (typeof fetchLrclibLyrics === 'function') {
        const lrc = await fetchLrclibLyrics(track.title, track.artist, track.duration);
        if (Array.isArray(lrc) && lrc.length > 0) updates.lyrics = lrc;
      }
    } catch {}
  }
  return updates;
}

async function recordDownloadFailure(track, dlResult) {
  if (dlResult.banDetected) {
    await Track.updateOne({ _id: track._id }, {
      $set: { 'migration.lastError': dlResult.errorReason || 'youtube_ban', 'migration.updatedAt': new Date() }
    });
    return;
  }
  await Track.updateOne({ _id: track._id }, {
    $inc: { 'migration.attempts': 1 },
    $set: {
      'migration.status': dlResult.permanentError ? 'skipped' : 'failed',
      'migration.reason': dlResult.permanentError ? 'video_unavailable' : undefined,
      'migration.lastError': dlResult.errorReason || 'Audio download failed or invalid',
      'migration.updatedAt': new Date()
    }
  });
}

/**
 * Processes and migrates a single Track document.
 */
async function processSingleTrack(track, { allowedCategories, dryRun = false, signal } = {}) {
  const trackId = String(track._id);
  const label = `${track.artist || 'Unknown'} - ${track.title || 'Untitled'}`;

  if (isLiveRadioTrack(track)) {
    if (!dryRun) {
      await Track.updateOne({ _id: track._id }, {
        $set: { migration: { status: 'skipped', reason: 'live_radio', category: 'radio', updatedAt: new Date() } }
      });
    }
    return { status: 'skipped', reason: 'live_radio', label };
  }

  // Detect local user-uploaded audio files in /uploads/<file> so they also migrate seamlessly to cloud
  const rawAudioUrl = String(track.audioUrl || '').trim();
  let localUploadPath = null;
  if (/^\/?uploads\//i.test(rawAudioUrl) && !/^\/?uploads\/cloud\//i.test(rawAudioUrl)) {
    const rel = rawAudioUrl.replace(/^\/?uploads\//i, '').split('?')[0];
    const resolved = path.resolve(uploadsDir, rel);
    const uploadsRoot = path.resolve(uploadsDir) + path.sep;
    if (resolved.startsWith(uploadsRoot) && fs.existsSync(resolved) && isAudioFileValid(resolved)) {
      localUploadPath = resolved;
    }
  }

  let videoId = extractYouTubeId(track.youtubeId) || extractYouTubeId(track.audioUrl) || extractYouTubeId(track.id);
  if (!localUploadPath && !videoId && track.title) {
    try {
      const sr = await searchYouTubeId({ artist: track.artist, title: track.title, targetDuration: track.duration });
      videoId = typeof sr === 'string' ? sr : sr?.videoId || null;
    } catch {}
  }

  const cls = await classifyTrackBeforeMigration(track, videoId, signal);
  const category = cls.category;
  const flagUpdates = {};
  if (category === 'quran' && !track.isQuran) { flagUpdates.isQuran = true; flagUpdates.contentType = 'quran'; }
  else if (category === 'podcast' && !track.isPodcast) { flagUpdates.isPodcast = true; flagUpdates.contentType = 'podcast'; }
  const verifiedGenre = resolveVerifiedGenreUpdate(track, cls);
  if (verifiedGenre) flagUpdates.genre = verifiedGenre;

  if (category === 'hindi' || category === 'non_music_video' || category === 'blacklisted') {
    if (!dryRun) {
      await Track.updateOne({ _id: track._id }, {
        $set: { ...flagUpdates, migration: { status: 'skipped', reason: `${category}:${cls.reason}`, category, updatedAt: new Date() } }
      });
    }
    return { status: 'skipped', category, reason: cls.reason, source: cls.source, label };
  }

  if (!allowedCategories.has(category)) {
    if (!dryRun) {
      await Track.updateOne({ _id: track._id }, {
        $set: { ...flagUpdates, migration: { status: 'deferred', reason: `phase_deferred:${category}`, category, updatedAt: new Date() } }
      });
    }
    return { status: 'deferred', category, reason: cls.reason, source: cls.source, label };
  }

  if (!localUploadPath && !videoId) {
    if (!dryRun) {
      await Track.updateOne({ _id: track._id }, {
        $inc: { 'migration.attempts': 1 },
        $set: { 'migration.status': 'failed', 'migration.lastError': 'No YouTube videoId found', 'migration.updatedAt': new Date() }
      });
    }
    return { status: 'failed', reason: 'no_video_id', label };
  }

  if (dryRun) return { status: 'dry_run_ok', category, genre: verifiedGenre || cls.genre, videoId, source: localUploadPath ? 'local_upload' : cls.source, label };

  let localFile = localUploadPath;
  let downloadedFresh = false;
  let usedVideoId = videoId;
  if (!localFile) {
    const dlResult = await downloadAudioWithPlanB({
      videoId, title: track.title, artist: track.artist,
      duration: track.duration || cls.ytMeta?.ytDuration, workDir: tempWorkDir, signal
    });
    localFile = dlResult.filePath;
    downloadedFresh = Boolean(dlResult.downloadedFresh);
    usedVideoId = dlResult.usedVideoId || videoId;

    if (!localFile || !isAudioFileValid(localFile)) {
      if (downloadedFresh && localFile && fs.existsSync(localFile)) try { fs.unlinkSync(localFile); } catch {}
      await recordDownloadFailure(track, dlResult);
      return {
        status: dlResult.permanentError ? 'skipped' : 'failed',
        reason: dlResult.errorReason || 'download_failed',
        banDetected: Boolean(dlResult.banDetected), videoId, label
      };
    }
  }

  let uploadFile = localFile;
  let transcodedFile = null;
  try {
    let fileStat = fs.statSync(localFile);
    const verifiedDuration = (await getLocalAudioFileDuration(localFile)) || track.duration || cls.ytMeta?.ytDuration || 210;

    // Optimize long/large Quran recitations (64kbps mono AAC) to maximize 10GB B2 capacity
    if (category === 'quran' && (verifiedDuration > 1200 || fileStat.size > QURAN_COMPRESS_MAX_BYTES)) {
      transcodedFile = await transcodeQuranVoiceAudio(localFile, trackId, signal);
      if (transcodedFile) {
        const compressedStat = fs.statSync(transcodedFile);
        if (compressedStat.size < fileStat.size) { uploadFile = transcodedFile; fileStat = compressedStat; }
      }
    }

    const ext = path.extname(uploadFile).replace('.', '').toLowerCase() || 'm4a';
    const b2Cat = category === 'quran' ? 'quran' : (category === 'podcast' ? 'podcast' : 'heavy_music');
    let b2Override = null;
    if (b2Cat === 'quran') {
      const qTarget = await resolveQuranB2AccountForUpload();
      b2Override = qTarget.account;
      if (qTarget.switched) {
        console.log(`[CloudBot] 🔄 Primary Quran bucket reached threshold — routing to ${b2Override?.bucketName}`);
      }
    }
    const cloudMeta = (category === 'music' && fileStat.size <= TELEGRAM_MAX_BYTES)
      ? await uploadAudioToTelegram(uploadFile, { title: track.title, artist: track.artist, duration: verifiedDuration, category: 'music', signal })
      : await uploadAudioToB2(uploadFile, `${b2Cat}/${trackId}.${ext}`, { category: b2Cat, accountOverride: b2Override, contentType: ext === 'mp3' ? 'audio/mpeg' : 'audio/mp4', signal });

    await seedCloudCache(trackId, cloudMeta.ext || ext, uploadFile);
    const extraMeta = await enrichCoverAndLyrics(track, usedVideoId);
    const updateDoc = {
      ...flagUpdates,
      ...extraMeta,
      legacyAudioUrl: track.legacyAudioUrl || track.audioUrl || (usedVideoId ? `https://www.youtube.com/watch?v=${usedVideoId}` : ''),
      ...(usedVideoId && !track.youtubeId ? { youtubeId: usedVideoId } : {}),
      audioUrl: `/uploads/cloud/${trackId}.${cloudMeta.ext || ext}`,
      duration: verifiedDuration,
      cloudStorage: cloudMeta,
      migration: {
        status: 'migrated',
        reason: `${cloudMeta.provider}:${cloudMeta.bucketName || cls.reason}`,
        category,
        updatedAt: new Date(),
        attempts: (track.migration?.attempts || 0) + 1
      }
    };

    await Track.updateOne({ _id: track._id }, { $set: updateDoc });
    if (localUploadPath && fs.existsSync(localUploadPath)) {
      try { fs.unlinkSync(localUploadPath); } catch {}
    }
    await notifyServerCacheInvalidated(trackId, signal);
    return {
      status: 'migrated', provider: cloudMeta.provider, botIndex: cloudMeta.botIndex,
      sizeMB: Number((fileStat.size / (1024 * 1024)).toFixed(2)), downloadedFresh,
      category, genre: verifiedGenre || cls.genre, label
    };
  } catch (err) {
    await Track.updateOne({ _id: track._id }, {
      $inc: { 'migration.attempts': 1 },
      $set: { 'migration.status': 'failed', 'migration.lastError': err.message.slice(0, 240), 'migration.updatedAt': new Date() }
    });
    return { status: 'failed', reason: err.message, label };
  } finally {
    if (transcodedFile && fs.existsSync(transcodedFile)) try { fs.unlinkSync(transcodedFile); } catch {}
    if (downloadedFresh && localFile && fs.existsSync(localFile)) try { fs.unlinkSync(localFile); } catch {}
  }
}

/**
 * Runs migration backlog with human-like randomized pacing and Plan B ban cooldowns.
 */
async function runMigrationLoop({ limit = 0, watch = false, dryRun = false, trackId = null, signal } = {}) {
  const allowedCategories = getAllowedCategories();
  const seenIds = [];
  const ninFilter = () => (seenIds.length > 0 ? seenIds.slice(-500) : null);
  const priorityOrder = ['music', 'podcast', 'quran'].filter((c) => allowedCategories.has(c));
  let processed = 0;
  let freshBatchCount = 0;
  let nextHumanBreakAt = Math.floor(randomBetween(18, 29));
  let consecutiveFailures = 0;
  let banWave = 0;

  while (!signal?.aborted) {
    let track = null;
    if (trackId) {
      track = await Track.findById(trackId).lean();
      if (!track) break;
    } else {
      const order = priorityOrder.length > 0 ? [...priorityOrder, null] : [null];
      for (const cat of order) {
        const query = buildMigrationQuery(allowedCategories, cat);
        const nin = ninFilter();
        if (nin) query._id = { $nin: nin };
        track = await Track.findOne(query).sort({ plays: -1, createdAt: -1 }).lean();
        if (track) break;
      }
    }

    if (!track) {
      if (!watch || trackId || (limit > 0 && processed >= limit)) break;
      await sleepWithAbort(randomBetween(25000, 40000), signal).catch(() => {});
      continue;
    }

    seenIds.push(track._id);
    const result = await processSingleTrack(track, { allowedCategories, dryRun, signal });
    processed++;
    const tag = [result.category, result.genre, result.source, result.provider || result.reason].filter(Boolean).join(':');
    console.log(`[CloudBot #${processed}] ${result.status.toUpperCase()} | ${result.label} | ${tag}`);

    if (trackId || (limit > 0 && processed >= limit)) break;
    if (result.status === 'migrated') {
      consecutiveFailures = 0;
      banWave = 0;
      if (result.downloadedFresh) freshBatchCount++;
    } else if (result.status === 'failed') {
      consecutiveFailures++;
    }

    if (result.banDetected || consecutiveFailures >= 3) {
      banWave++;
      consecutiveFailures = 0;
      const cooldownMs = banWave === 1
        ? randomBetween(15 * 60000, 20 * 60000)
        : (banWave === 2 ? randomBetween(40 * 60000, 55 * 60000) : randomBetween(90 * 60000, 125 * 60000));
      console.warn(`[CloudBot] ⏸️ Plan B Ban Cooldown (wave ${banWave}) — resting ${Math.round(cooldownMs / 60000)}m before resuming...`);
      await sleepWithAbort(cooldownMs, signal).catch(() => {});
      continue;
    }

    if (result.downloadedFresh && freshBatchCount >= nextHumanBreakAt) {
      const breakMs = randomBetween(45000, 75000);
      console.log(`[CloudBot] ☕ Human break for ${Math.round(breakMs / 1000)}s after ${freshBatchCount} fresh downloads`);
      freshBatchCount = 0;
      nextHumanBreakAt = Math.floor(randomBetween(25, 38));
      await sleepWithAbort(breakMs, signal).catch(() => {});
      continue;
    }

    const delayMs = dryRun ? 300 : (result.downloadedFresh
      ? randomBetween(7000, 14000)
      : (result.status === 'migrated' ? randomBetween(1500, 3000) : randomBetween(1000, 2000)));
    await sleepWithAbort(delayMs, signal).catch(() => {});
  }

  return processed;
}

module.exports = { extractYouTubeId, processSingleTrack, runMigrationLoop };
