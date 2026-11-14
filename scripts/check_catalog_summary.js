const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const Album = mongoose.connection.db.collection('albums');
  const Artist = mongoose.connection.db.collection('artists');
  const Track = mongoose.connection.db.collection('tracks');

  const totalArtists = await Artist.countDocuments();
  const totalAlbums = await Album.countDocuments();
  const highResAlbums = await Album.countDocuments({ cover: { $regex: '1200x1200' } });
  const missingArtistAvatars = await Artist.countDocuments({
    $or: [
      { avatar: { $exists: false } },
      { avatar: "" },
      { avatar: null },
      { avatar: { $regex: 'unsplash|photo-1514525253161' } }
    ]
  });
  const missingAlbumCovers = await Album.countDocuments({
    $or: [
      { cover: { $exists: false } },
      { cover: "" },
      { cover: null },
      { cover: { $regex: 'unsplash|placeholder' } }
    ]
  });

  const esseilyTrack = await Track.findOne({ title: { $regex: 'Aysheen', $options: 'i' } });

  console.log('=== CATALOG SUMMARY ===');
  console.log({
    totalArtists,
    totalAlbums,
    highResAlbums,
    missingArtistAvatars,
    missingAlbumCovers,
    esseilyGenre: esseilyTrack?.genre,
    esseilyIsPodcast: esseilyTrack?.isPodcast
  });

  await mongoose.disconnect();
  process.exit(0);
}
check().catch(console.error);
