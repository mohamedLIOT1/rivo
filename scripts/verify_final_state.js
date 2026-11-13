const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Album, Track } = require('../server/models');

async function verify() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas.');

  // 1. Amir Eid / Cairokee - Wana ma nafsy aed
  const wanaAlbums = await Album.find({ name: /وانا مع نفسي قاعد/i }).select('name artist trackCount tracks cover');
  console.log('\n[1] "وانا مع نفسي قاعد" in Albums collection:');
  wanaAlbums.forEach(a => console.log(`  - ${a.name} by ${a.artist} (${a.trackCount} tracks)`));

  // 2. Marwan Pablo - CTRL
  const ctrlAlbums = await Album.find({ artist: /Pablo/i, name: /ctrl/i }).select('name artist trackCount tracks cover');
  console.log('\n[2] "CTRL" in Albums collection:');
  ctrlAlbums.forEach(a => console.log(`  - ${a.name} by ${a.artist} (${a.trackCount} tracks)`));

  // 3. Wegz - Aqareb
  const aqarebAlbums = await Album.find({ artist: /Wegz/i, name: /aqareb/i }).select('name artist trackCount tracks cover');
  console.log('\n[3] "Aqareb" in Albums collection:');
  aqarebAlbums.forEach(a => console.log(`  - ${a.name} by ${a.artist} (${a.trackCount} tracks)`));

  // 4. Quran albums in music albums
  const quranAlbums = await Album.find({ $or: [{ isQuran: true }, { genre: 'Holy Quran' }] });
  console.log(`\n[4] Quran albums in music albums collection: ${quranAlbums.length} (Strictly 0 target)`);

  // 5. 1-track albums in music collection
  const oneTrackAlbums = await Album.find({ trackCount: { $lte: 1 } });
  console.log(`\n[5] Albums with <= 1 tracks: ${oneTrackAlbums.length}`);

  // 6. Overall catalog totals
  const totalAlbums = await Album.countDocuments();
  const totalTracks = await Track.countDocuments();
  const singleTracks = await Track.countDocuments({ album: 'Single' });
  const quranTracks = await Track.countDocuments({ isQuran: true });

  console.log('\n======================================================');
  console.log('🏁 FINAL DATABASE STATE');
  console.log(`- Total Official Multi-Track Albums & EPs: ${totalAlbums}`);
  console.log(`- Total Tracks in Catalog:                 ${totalTracks}`);
  console.log(`- Standalone Single Tracks (album:Single): ${singleTracks}`);
  console.log(`- Holy Quran Tracks (Isolated):            ${quranTracks}`);
  console.log('======================================================');

  await mongoose.disconnect();
}

verify().catch(console.error);
