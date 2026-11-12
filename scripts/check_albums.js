const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function check() {
  await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
  const Album = mongoose.model('Album', new mongoose.Schema({}, { strict: false }));
  const Track = mongoose.model('Track', new mongoose.Schema({}, { strict: false }));
  
  const albums = await Album.find({}).lean();
  console.log('Total albums:', albums.length);
  albums.forEach(a => console.log('-', a.name, '| Artist:', a.artist, '| Tracks:', (a.trackIds || []).length, '| Cover:', a.cover ? 'yes' : 'no'));

  const ash = await Track.find({ artist: /joker/i, title: /3ash|عايش/i }).lean();
  console.log('3ash tracks for Joker:', ash);
  const talatini = await Album.findOne({ name: /talatini/i }).lean();
  console.log('Talatini album in DB:', talatini);

  const cairokeeTracks = await Track.find({ artist: /cairokee/i }).select('title artist album').lean();
  console.log('\nCairokee tracks count:', cairokeeTracks.length);
  cairokeeTracks.forEach(t => console.log('  *', t.title, '| Album:', t.album));

  await mongoose.disconnect();
}

check().catch(console.error);
