const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const Track = mongoose.connection.db.collection('tracks');
  const tracks = await Track.find({
    $or: [
      { artist: { $regex: 'عسيلي|esseily', $options: 'i' } },
      { title: { $regex: 'عسيلي|esseily', $options: 'i' } }
    ]
  }).toArray();

  console.log(`Found ${tracks.length} tracks related to Esseily:`);
  for (const t of tracks) {
    console.log(`- "${t.title}" by "${t.artist}" | isPodcast: ${t.isPodcast} | contentType: ${t.contentType} | genre: ${t.genre}`);
  }
  process.exit(0);
}
run();
