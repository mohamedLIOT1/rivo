const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Album = mongoose.connection.db.collection('albums');
  const Track = mongoose.connection.db.collection('tracks');

  const bgd = await Album.findOne({ id: "album-1789813382421-42lo2a" });
  console.log('BGD Album:', bgd);
  if (bgd && bgd.trackIds) {
    const tracks = await Track.find({ _id: { $in: bgd.trackIds.map(id => {
      try { return new mongoose.Types.ObjectId(id); } catch(e) { return id; }
    }) } }).toArray();
    console.log('Tracks in BGD:', tracks.map(t => ({ title: t.title, artist: t.artist, cover: t.cover })));
  }

  // Also check 191-181
  const a191 = await Album.findOne({ name: /191-181/i });
  console.log('\n191-181 Album:', a191);
  if (a191 && a191.trackIds) {
    const tracks191 = await Track.find({ _id: { $in: a191.trackIds.map(id => {
      try { return new mongoose.Types.ObjectId(id); } catch(e) { return id; }
    }) } }).toArray();
    console.log('Tracks in 191-181:', tracks191.map(t => ({ title: t.title, artist: t.artist, cover: t.cover })));
  }

  await mongoose.disconnect();
}

main().catch(console.error);
