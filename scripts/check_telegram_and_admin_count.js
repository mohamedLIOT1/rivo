const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Track, Album } = require('../server/models');
const { getCloudStorageTelemetry } = require('../server/utils/cloudUsageHelper');

async function checkCloudAndTelegram() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas.');

  // 1. Telegram tracks count
  const telegramTracks = await Track.countDocuments({ 'cloudStorage.provider': 'telegram' });
  const b2Tracks = await Track.countDocuments({ 'cloudStorage.provider': 'b2' });
  const localUploadTracks = await Track.countDocuments({
    audioUrl: { $regex: /^\/uploads\/|uploads\//i },
    'cloudStorage.provider': { $exists: false }
  });
  const externalTracks = await Track.countDocuments({
    'cloudStorage.provider': { $exists: false },
    $or: [{ audioUrl: { $not: /^\/uploads\/|uploads\//i } }, { audioUrl: { $exists: false } }]
  });

  const totalTracks = await Track.countDocuments();
  const quranTracks = await Track.countDocuments({ isQuran: true });
  const musicTracks = await Track.countDocuments({ isQuran: { $ne: true } });

  console.log('\n--- STORAGE BREAKDOWN ---');
  console.log(`Telegram Bot Storage:   ${telegramTracks} tracks`);
  console.log(`Backblaze B2 Storage:   ${b2Tracks} tracks`);
  console.log(`Local Uploads:          ${localUploadTracks} tracks`);
  console.log(`External Stream/YT:     ${externalTracks} tracks`);
  console.log(`Total Tracks in DB:     ${totalTracks} tracks`);

  // 2. Check telemetry
  try {
    const telemetry = await getCloudStorageTelemetry({ bypassCache: true });
    console.log('\n--- TELEMETRY DATA ---');
    console.log(JSON.stringify(telemetry, null, 2));
  } catch (err) {
    console.error('Telemetry error:', err.message);
  }

  // 3. Search for 2954 in counts
  console.log('\n--- CHECKING FOR 2954 ---');
  // Check music tracks count
  console.log(`musicTracks: ${musicTracks}`);
  // Check tracks with audioUrl
  const withAudioUrl = await Track.countDocuments({ audioUrl: { $exists: true, $ne: '' } });
  console.log(`withAudioUrl: ${withAudioUrl}`);
  // Check tracks without album: 'Single'
  const inAlbums = await Track.countDocuments({ album: { $ne: 'Single' } });
  console.log(`inAlbums: ${inAlbums}`);
  // Check tracks without isQuran: true and without podcast
  const pureSongs = await Track.countDocuments({ isQuran: { $ne: true }, isPodcast: { $ne: true } });
  console.log(`pureSongs (non-Quran, non-Podcast): ${pureSongs}`);

  await mongoose.disconnect();
}

checkCloudAndTelegram().catch(console.error);
