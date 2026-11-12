const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const Album = mongoose.connection.db.collection('albums');
  const alb = await Album.findOne({ id: 'album-1794515454758-caqotm' });
  console.log('Album query result:');
  console.log('Name:', alb ? alb.name : 'null');
  console.log('Artist:', alb ? alb.artist : 'null');
  console.log('Tracks count:', alb && alb.tracks ? alb.tracks.length : 0);
  console.log('TrackIds count:', alb && alb.trackIds ? alb.trackIds.length : 0);
  console.log('ReleaseType:', alb ? alb.releaseType : 'null');
  await mongoose.disconnect();
}

run().catch(console.error);
