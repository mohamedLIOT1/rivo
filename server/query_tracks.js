const path = require('path');
const fs = require('fs');
const envPath = fs.existsSync('/home/ubuntu/rivo/.env') ? '/home/ubuntu/rivo/.env' : path.join(__dirname, '../.env');
require('dotenv').config({ path: envPath });
const mongoose = require('mongoose');
const { Track, Album } = require('./models');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const albums = await Album.find({ 'tracks.title': { $regex: /ragea/i } }).lean();
  console.log(`Found ${albums.length} albums with Ragea:`);
  for (const a of albums) {
    console.log(`Album: "${a.title || a.name}" by "${a.artist}" (genre: "${a.genre}")`);
    const matching = (a.tracks || []).filter(t => /ragea/i.test(t.title));
    console.log('Matching tracks:', JSON.stringify(matching, null, 2));
  }
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
