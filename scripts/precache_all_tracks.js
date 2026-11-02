const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { downloadYouTubeAudioToCache, isAudioFileValid, getLocalAudioFileDuration } = require('../server/utils/helpers');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mohamedmustafat79_db_user:123RiVo.AliLio@cluster0.sr4ypsh.mongodb.net/liofy_db';
const cacheDir = path.join(__dirname, '../uploads/audio-cache');
const CONCURRENCY = 3;

if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

function extractVid(url) {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
  return m ? m[1] : null;
}

async function startPreCache() {
  console.log('=====================================================');
  console.log('🚀 Rivo Full Catalog Audio Pre-Cache Worker Starting');
  console.log('=====================================================');

  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas');

  const Track = mongoose.model('Track', new mongoose.Schema({}, { strict: false }));
  const tracks = await Track.find({
    audioUrl: { $regex: /youtube\.com|youtu\.be/i }
  }).lean();

  console.log(`📋 Total YouTube catalog tracks to audit/cache: ${tracks.length}`);

  let cachedCount = 0;
  let downloadedCount = 0;
  let failedCount = 0;
  let index = 0;

  async function processTrack(track) {
    const videoId = extractVid(track.audioUrl);
    if (!videoId) return;

    const targetFile = path.join(cacheDir, `${videoId}.m4a`);

    if (fs.existsSync(targetFile) && isAudioFileValid(targetFile)) {
      cachedCount++;
      const dur = getLocalAudioFileDuration(targetFile);
      if (dur && dur > 0 && Math.abs((track.duration || 0) - dur) > 2) {
        await Track.updateOne({ _id: track._id }, { $set: { duration: dur } }).catch(() => {});
      }
      return;
    }

    try {
      const res = await downloadYouTubeAudioToCache(videoId, cacheDir);
      if (res && isAudioFileValid(res)) {
        downloadedCount++;
        const realDur = getLocalAudioFileDuration(res);
        if (realDur && realDur > 0) {
          await Track.updateOne({ _id: track._id }, { $set: { duration: realDur } }).catch(() => {});
        }
        console.log(`[CacheWorker] ✅ [${index}/${tracks.length}] Cached "${track.title}" (${realDur}s)`);
      } else {
        failedCount++;
        console.warn(`[CacheWorker] ⚠️ [${index}/${tracks.length}] Failed "${track.title}" (Vid: ${videoId})`);
      }
    } catch (err) {
      failedCount++;
      console.error(`[CacheWorker] ❌ [${index}/${tracks.length}] Error "${track.title}":`, err.message);
    }
  }

  // Pool of workers
  async function worker() {
    while (index < tracks.length) {
      const current = tracks[index++];
      if (!current) break;
      await processTrack(current);
      if (index % 25 === 0 || index === tracks.length) {
        console.log(`\n📊 Progress: ${index}/${tracks.length} (${((index / tracks.length) * 100).toFixed(1)}%) | Already Cached: ${cachedCount} | Freshly Downloaded: ${downloadedCount} | Failed: ${failedCount}\n`);
      }
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, () => worker());
  await Promise.all(workers);

  console.log('=====================================================');
  console.log(`🎉 Pre-Cache Sweep Complete!`);
  console.log(`Total: ${tracks.length} | Cached: ${cachedCount + downloadedCount} | Failed: ${failedCount}`);
  console.log('=====================================================');

  await mongoose.disconnect();
  process.exit(0);
}

startPreCache().catch(err => {
  console.error('Fatal pre-cache worker error:', err);
  process.exit(1);
});
