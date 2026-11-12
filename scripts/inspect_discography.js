const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Track = mongoose.model('Track', new mongoose.Schema({}, { strict: false }));
  const Album = mongoose.model('Album', new mongoose.Schema({}, { strict: false }));

  console.log('=== Checking 3ASH / عايش ===');
  const ayeshTracks = await Track.find({
    $or: [
      { title: /عايش|3ash/i },
      { artist: /joker|الجوكر/i }
    ]
  }).select('title artist album cover audioUrl duration migration').lean();
  
  console.log(`Found ${ayeshTracks.length} tracks for El Joker / 3ash:`);
  ayeshTracks.forEach(t => {
    console.log(`[${t._id}] "${t.title}" by "${t.artist}" | album: "${t.album}" | dur: ${t.duration}`);
  });

  console.log('\n=== Checking Albums in DB ===');
  const albums = await Album.find().lean();
  console.log(`Found ${albums.length} albums in DB:`);
  albums.forEach(a => {
    console.log(`[${a._id}] "${a.name}" by "${a.artist}" | tracks: ${a.trackIds?.length || 0} | cover: ${a.cover?.slice(0, 70)}...`);
  });

  await mongoose.disconnect();
}

main().catch(console.error);
