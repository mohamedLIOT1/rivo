const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Album = mongoose.connection.db.collection('albums');
  const Track = mongoose.connection.db.collection('tracks');

  const allAlbums = await Album.find({}).toArray();
  console.log(`Total albums in DB: ${allAlbums.length}`);

  // Inspect Amarain
  const amarain = await Album.findOne({ name: /amarain/i });
  console.log('Amarain album in DB:', amarain);

  // Check how many have trackCount or are singles
  let singlesCount = 0;
  for (const a of allAlbums) {
    if (a.trackCount === 1 || (a.trackIds && a.trackIds.length === 1)) {
      singlesCount++;
    }
  }
  console.log(`Albums with 1 track: ${singlesCount}`);

  await mongoose.disconnect();
}

main().catch(console.error);
