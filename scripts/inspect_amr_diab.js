const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Album = mongoose.connection.db.collection('albums');
  const Track = mongoose.connection.db.collection('tracks');

  const amrAlbums = await Album.find({ artist: /Amr Diab/i }).toArray();
  console.log(`Found ${amrAlbums.length} albums for Amr Diab:`);
  for (const a of amrAlbums) {
    console.log({
      id: a.id,
      name: a.name,
      trackCount: a.trackCount,
      trackIds: a.trackIds?.length || 0,
      tracks: a.tracks?.length || 0,
      releaseType: a.releaseType
    });
  }

  const amrTracks = await Track.find({ artist: /Amr Diab/i }).toArray();
  console.log(`\nFound ${amrTracks.length} tracks for Amr Diab.`);
  const albumsInTracks = {};
  for (const t of amrTracks) {
    const alb = t.album || 'NONE';
    albumsInTracks[alb] = (albumsInTracks[alb] || 0) + 1;
  }
  console.log('Albums grouped by track.album:', albumsInTracks);

  await mongoose.disconnect();
}
main().catch(console.error);
