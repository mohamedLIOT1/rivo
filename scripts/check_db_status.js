const mongoose = require('mongoose');
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}
require('dotenv').config();
const { Album, Track, Artist } = require('../server/models');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const totalAlbums = await Album.countDocuments();
  const totalTracks = await Track.countDocuments();
  const totalArtists = await Artist.countDocuments();
  const quranAlbums = await Album.countDocuments({ isQuran: true });
  const singleAlbums = await Album.countDocuments({ releaseType: 'single' });
  const singleTracks = await Track.countDocuments({ album: 'Single' });
  
  const distinctAlbumArtists = await Album.distinct('artist');
  const distinctTrackArtists = await Track.distinct('artist');

  console.log('=== DATABASE STATUS ===');
  console.log({
    totalAlbums,
    totalTracks,
    totalArtists,
    quranAlbums,
    singleAlbums,
    singleTracks,
    albumArtistsCount: distinctAlbumArtists.length,
    trackArtistsCount: distinctTrackArtists.length
  });

  const topArtists = await Track.aggregate([
    { $group: { _id: '$artist', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 15 }
  ]);
  console.log('\nTop Artists in Tracks:', topArtists);

  // Check any album with trackCount <= 1
  const smallAlbums = await Album.find({ trackCount: { $lte: 1 } }).select('title artist trackCount releaseType');
  console.log(`\nAlbums with <= 1 tracks: ${smallAlbums.length}`);
  if (smallAlbums.length > 0) {
    console.log(smallAlbums.slice(0, 5));
  }

  // Check Shehab albums and tracks
  const shehabTracks = await Track.countDocuments({ artist: 'Shehab' });
  const shehabAlbums = await Album.find({ artist: 'Shehab' }).select('title trackCount releaseType');
  console.log(`\nShehab tracks: ${shehabTracks}`);
  console.log('Shehab albums:', shehabAlbums);

  await mongoose.disconnect();
}
check().catch(console.error);
