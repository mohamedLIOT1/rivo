const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}
require('dotenv').config();
const mongoose = require('mongoose');
const { Track } = require('../server/models');

async function checkPlays() {
  await mongoose.connect(process.env.MONGO_URI);
  const sample = await Track.find({ plays: { $gt: 0 } }).select('title artist plays').sort({ plays: -1 }).limit(15);
  console.log('Top tracks by plays:', sample.map(t => ({ title: t.title, artist: t.artist, plays: t.plays })));

  const zeroPlays = await Track.countDocuments({ $or: [{ plays: 0 }, { plays: { $exists: false } }] });
  const positivePlays = await Track.countDocuments({ plays: { $gt: 0 } });
  console.log({ zeroPlays, positivePlays });

  // Look at tracks with weird or unrealistic play counts
  const highPlays = await Track.find({ plays: { $gt: 100 } }).select('title artist plays');
  console.log('High play tracks count (> 100):', highPlays.length);
  if (highPlays.length > 0) {
    console.log('Sample high plays:', highPlays.slice(0, 10).map(t => ({ title: t.title, artist: t.artist, plays: t.plays })));
  }

  // Check some popular songs that have 0 plays or low plays
  const popularSample = await Track.find({ artist: /Wegz|Cairokee|Amr Diab|Marwan Pablo/i }).select('title artist plays').limit(20);
  console.log('\nSample popular artist tracks plays:', popularSample.map(t => ({ title: t.title, artist: t.artist, plays: t.plays })));

  await mongoose.disconnect();
}
checkPlays().catch(console.error);
