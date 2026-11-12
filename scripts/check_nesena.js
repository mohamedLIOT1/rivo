const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const tracks = await mongoose.connection.db.collection('tracks').find({
    title: /nesena|نسينا/i
  }).project({
    title: 1,
    artist: 1,
    album: 1,
    lyricsVerified: 1,
    source: 1,
    duration: 1,
    createdAt: 1
  }).toArray();

  console.log(JSON.stringify(tracks, null, 2));
  await mongoose.disconnect();
}
main().catch(console.error);
