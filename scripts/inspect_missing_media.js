const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const Album = mongoose.connection.db.collection('albums');
  const Artist = mongoose.connection.db.collection('artists');
  const Track = mongoose.connection.db.collection('tracks');

  const totalAlbums = await Album.countDocuments();
  const albumsNoCover = await Album.countDocuments({
    $or: [
      { cover: { $exists: false } },
      { cover: "" },
      { cover: null },
      { cover: { $regex: 'unsplash|placeholder' } }
    ]
  });

  const totalArtists = await Artist.countDocuments();
  const artistsNoAvatar = await Artist.countDocuments({
    $or: [
      { avatar: { $exists: false } },
      { avatar: "" },
      { avatar: null },
      { avatar: { $regex: 'unsplash|photo-1514525253161' } }
    ]
  });

  const sampleArtistsWithoutPics = await Artist.find({
    $or: [
      { avatar: { $exists: false } },
      { avatar: "" },
      { avatar: null },
      { avatar: { $regex: 'unsplash|photo-1514525253161' } }
    ]
  }, { projection: { name: 1, avatar: 1 } }).limit(20).toArray();

  const sampleAlbumsWithoutPics = await Album.find({
    $or: [
      { cover: { $exists: false } },
      { cover: "" },
      { cover: null },
      { cover: { $regex: 'unsplash|placeholder' } }
    ]
  }, { projection: { name: 1, artist: 1, cover: 1 } }).limit(20).toArray();

  console.log(JSON.stringify({
    totalAlbums,
    albumsNoCover,
    sampleAlbums: sampleAlbumsWithoutPics.map(a => `${a.name} (${a.artist})`),
    totalArtists,
    artistsNoAvatar,
    sampleArtists: sampleArtistsWithoutPics.map(a => a.name)
  }, null, 2));

  process.exit(0);
}
run();
