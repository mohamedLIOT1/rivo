const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Album = mongoose.connection.db.collection('albums');
  const albums = await Album.find({}).project({ name: 1, artist: 1, trackCount: 1, releaseType: 1, cover: 1 }).toArray();
  for (const a of albums) {
    console.log(`[${a.releaseType?.toUpperCase()}] "${a.name}" by "${a.artist}" (${a.trackCount || 0} tracks) - cover: ${a.cover?.slice(0, 45)}...`);
  }
  await mongoose.disconnect();
}

main().catch(console.error);
