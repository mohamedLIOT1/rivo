const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

const { getCanonicalArtistName } = require('../server/utils/artistAlbumUtils');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Artist = mongoose.model('Artist', new mongoose.Schema({}, { strict: false }));
  const Track = mongoose.model('Track', new mongoose.Schema({}, { strict: false }));
  const Album = mongoose.model('Album', new mongoose.Schema({}, { strict: false }));

  const allArtists = await Artist.find().lean();
  console.log(`Checking ${allArtists.length} Artist documents for duplicates...`);

  // Group artist profiles by their canonical name
  const groups = {};
  for (const a of allArtists) {
    const canonical = getCanonicalArtistName(a.name) || a.name.trim();
    const key = canonical.toLowerCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(a);
  }

  let mergedCount = 0;
  for (const [key, list] of Object.entries(groups)) {
    if (list.length > 1) {
      console.log(`\nFound duplicate artist profiles for "${key}":`);
      list.forEach(a => console.log(`  - [${a._id}] "${a.name}" | verified: ${a.isVerified} | bio: ${Boolean(a.bio)} | image: ${Boolean(a.imageUrl || a.avatar)}`));

      // Choose primary: the one with verified: true, or has bio, or has image, or created first
      list.sort((a, b) => {
        if (a.isVerified !== b.isVerified) return a.isVerified ? -1 : 1;
        if (Boolean(a.bio) !== Boolean(b.bio)) return a.bio ? -1 : 1;
        if (Boolean(a.imageUrl || a.avatar) !== Boolean(b.imageUrl || b.avatar)) return (a.imageUrl || a.avatar) ? -1 : 1;
        return 0;
      });

      const primary = list[0];
      const duplicates = list.slice(1);
      console.log(`  -> Keeping primary: [${primary._id}] "${primary.name}"`);

      // Merge data into primary if primary was missing something
      let updateFields = {};
      for (const d of duplicates) {
        if (!primary.bio && d.bio) { primary.bio = d.bio; updateFields.bio = d.bio; }
        if (!primary.avatar && (d.avatar || d.imageUrl)) { 
          primary.avatar = d.avatar || d.imageUrl; 
          updateFields.avatar = primary.avatar; 
        }
        if (!primary.genres && d.genres) { primary.genres = d.genres; updateFields.genres = d.genres; }
      }
      if (Object.keys(updateFields).length > 0) {
        await Artist.updateOne({ _id: primary._id }, { $set: updateFields });
      }

      // Delete duplicates from Artist collection
      for (const d of duplicates) {
        await Artist.deleteOne({ _id: d._id });
        console.log(`  ❌ Deleted duplicate artist profile: [${d._id}] "${d.name}"`);
        mergedCount++;
      }
    }
  }

  console.log(`\nMerged artist profiles: ${mergedCount}`);

  // Also check tracks for inconsistent artist spellings (e.g. "CairokeeOfficial" -> "Cairokee")
  console.log('\n--- Normalizing Track Artists in DB ---');
  const aliasFixes = [
    { from: /^cairokeeofficial$/i, to: 'Cairokee' },
    { from: /^cairokeeoffical$/i, to: 'Cairokee' },
    { from: /^cairokee official$/i, to: 'Cairokee' },
    { from: /^ليجي-سي$/i, to: 'Lege-Cy' },
    { from: /^ليجي سي$/i, to: 'Lege-Cy' },
    { from: /^مروان بابلو$/i, to: 'Marwan Pablo' },
    { from: /^مروان موسى$/i, to: 'Marwan Moussa' },
    { from: /^الجوكر$/i, to: 'El Joker' },
    { from: /^عمرو دياب$/i, to: 'Amr Diab' },
    { from: /^تامر حسني$/i, to: 'Tamer Hosny' },
    { from: /^تامر عاشور$/i, to: 'Tamer Ashour' }
  ];

  for (const fix of aliasFixes) {
    const res = await Track.updateMany({ artist: fix.from }, { $set: { artist: fix.to } });
    if (res.modifiedCount > 0) {
      console.log(`Fixed ${res.modifiedCount} tracks from "${fix.from}" to "${fix.to}"`);
    }
    const resAlb = await Album.updateMany({ artist: fix.from }, { $set: { artist: fix.to } });
    if (resAlb.modifiedCount > 0) {
      console.log(`Fixed ${resAlb.modifiedCount} albums from "${fix.from}" to "${fix.to}"`);
    }
  }

  await mongoose.disconnect();
}

main().catch(console.error);
