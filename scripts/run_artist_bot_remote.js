const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });
const { organizeArtistAlbumsBot } = require('../server/workers/artistAlbumOrganizerBot');

async function main() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/rivo';
  console.log('Connecting to MongoDB at:', uri.replace(/:[^:@]+@/, ':***@'));
  await mongoose.connect(uri);
  console.log('Running organizeArtistAlbumsBot()...');
  const report = await organizeArtistAlbumsBot();
  console.log('=== BOT EXECUTION REPORT ===');
  console.log(JSON.stringify(report, null, 2));
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error('Bot execution failed:', err);
  process.exit(1);
});
