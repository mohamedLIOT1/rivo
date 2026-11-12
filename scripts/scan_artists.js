const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Track = mongoose.model('Track', new mongoose.Schema({}, { strict: false }));
  const Album = mongoose.model('Album', new mongoose.Schema({}, { strict: false }));
  
  const artists = await Track.distinct('artist', { isQuran: { $ne: true } });
  console.log('Total non-Quran artists in DB:', artists.length);
  
  // Count tracks per artist
  const counts = [];
  for (const a of artists) {
    if (!a || !a.trim()) continue;
    const cnt = await Track.countDocuments({ artist: a, isQuran: { $ne: true } });
    const albCnt = await Album.countDocuments({ artist: a });
    counts.push({ artist: a, tracks: cnt, albums: albCnt });
  }
  counts.sort((a, b) => b.tracks - a.tracks);
  
  console.log('\nTop Artists by Track Count:');
  counts.slice(0, 35).forEach(c => {
    console.log(`- ${c.artist}: ${c.tracks} tracks (Albums in DB: ${c.albums})`);
  });

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(console.error);
