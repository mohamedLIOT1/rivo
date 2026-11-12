const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Album = mongoose.connection.db.collection('albums');
  const Track = mongoose.connection.db.collection('tracks');

  const testIds = [
    'album-1794515454758-caqotm', // معدى الناس
    'album-1794514693422-itkdud', // Barbary
    'album-1794515556176-c20kht', // reputation
    'album-1794515490614-ho6q9i', // Oyouno Lama Ablony
    'album-1794515451091-mbao5q', // بالينى
    'album-1794515453794-z6zh2q', // أحلى و أحلى
    'album-1794515453317-smkvfp', // Allem Alby
  ];

  for (const id of testIds) {
    const alb = await Album.findOne({ $or: [{ id: id }, { _id: id }] });
    if (!alb) {
      console.log(`\n[${id}] NOT FOUND in Album collection`);
      continue;
    }
    console.log(`\n[${id}] name: "${alb.name}", artist: "${alb.artist}", releaseType: "${alb.releaseType}", trackCount: ${alb.trackCount}, trackIds: ${alb.trackIds?.length || 0}, tracks: ${alb.tracks?.length || 0}`);
    if (alb.tracks && alb.tracks.length > 0) {
      console.log('Sample embedded tracks:', alb.tracks.slice(0, 3).map(t => t.title));
    }
  }

  await mongoose.disconnect();
}
main().catch(console.error);
