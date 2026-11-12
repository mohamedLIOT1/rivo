const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

const { getCanonicalArtistName } = require('../server/utils/artistAlbumUtils');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Track = mongoose.model('Track', new mongoose.Schema({}, { strict: false }));
  const artists = await Track.distinct('artist');
  console.log('Total distinct artist strings in tracks:', artists.length);
  
  const map = {};
  for (const a of artists) {
    if (!a) continue;
    const c = getCanonicalArtistName(a);
    if (!map[c]) map[c] = [];
    map[c].push(a);
  }

  console.log('\n--- Canonical Groups with multiple variants ---');
  for (const [c, variants] of Object.entries(map)) {
    if (variants.length > 1) {
      console.log(`Canonical "${c}" has variants:`, variants);
      // Merge all variants to the canonical name!
      for (const v of variants) {
        if (v !== c) {
          const res = await Track.updateMany({ artist: v }, { $set: { artist: c } });
          console.log(`  -> Merged ${res.modifiedCount} tracks from "${v}" into "${c}"`);
        }
      }
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
