const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Album = mongoose.connection.db.collection('albums');
  const total = await Album.countDocuments();
  const singles = await Album.countDocuments({ releaseType: 'single' });
  const eps = await Album.countDocuments({ releaseType: 'ep' });
  const albums = await Album.countDocuments({ releaseType: 'album' });
  console.log(`TOTAL: ${total} | ALBUMS: ${albums} | EPS: ${eps} | SINGLES: ${singles}`);
  await mongoose.disconnect();
}

main().catch(console.error);
