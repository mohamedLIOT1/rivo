const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Album = mongoose.connection.db.collection('albums');
  const Track = mongoose.connection.db.collection('tracks');

  const totalAlbums = await Album.countDocuments();
  const albumsWithTrackIds = await Album.countDocuments({ 'trackIds.0': { $exists: true } });
  const albumsWithEmbeddedTracks = await Album.countDocuments({ 'tracks.0': { $exists: true } });
  const totalTracks = await Track.countDocuments();

  console.log(`Total albums in DB: ${totalAlbums}`);
  console.log(`Albums with trackIds: ${albumsWithTrackIds}`);
  console.log(`Albums with embedded tracks: ${albumsWithEmbeddedTracks}`);
  console.log(`Total tracks in DB: ${totalTracks}`);

  // Distinct albums in tracks collection
  const trackAlbums = await Track.distinct('album');
  console.log(`Distinct album names in tracks collection: ${trackAlbums.length}`);
  console.log('Sample track albums:', trackAlbums.slice(0, 25));

  await mongoose.disconnect();
}
main().catch(console.error);
