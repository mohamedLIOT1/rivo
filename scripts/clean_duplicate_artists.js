const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });
const { getCanonicalArtistName, splitArtistNames } = require('./server/utils/artistAlbumUtils');

async function main() {
  const conn = await mongoose.connect(process.env.MONGO_URI);
  const db = conn.connection.db;

  console.log('--- Checking artists collection for duplicates and bilingual names ---');
  const artists = await db.collection('artists').find({}).toArray();
  console.log(`Total artist documents in DB: ${artists.length}`);

  let deletedArtistDocs = 0;
  for (const doc of artists) {
    const rawName = String(doc.name || '').trim();
    if (!rawName) {
      await db.collection('artists').deleteOne({ _id: doc._id });
      deletedArtistDocs++;
      continue;
    }

    // Check if collaboration string (e.g. "Cairokee, Sary Hany")
    const parts = splitArtistNames(rawName);
    if (parts.length > 1) {
      console.log(`Removing collab artist doc: "${rawName}"`);
      await db.collection('artists').deleteOne({ _id: doc._id });
      deletedArtistDocs++;
      continue;
    }

    // Check if bilingual or alias that maps to canonical name
    const canonical = getCanonicalArtistName(rawName);
    if (canonical && canonical.toLowerCase() !== rawName.toLowerCase()) {
      console.log(`Found non-canonical artist doc "${rawName}" -> canonical "${canonical}"`);
      // Check if canonical artist doc already exists
      const canonicalDoc = await db.collection('artists').findOne({
        name: new RegExp(`^${canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
      });

      if (canonicalDoc) {
        console.log(`Canonical doc already exists for "${canonical}". Deleting duplicate doc "${rawName}".`);
        await db.collection('artists').deleteOne({ _id: doc._id });
        deletedArtistDocs++;
      } else {
        console.log(`Updating artist doc name from "${rawName}" to "${canonical}".`);
        await db.collection('artists').updateOne({ _id: doc._id }, { $set: { name: canonical } });
      }
    }
  }

  console.log(`Deleted ${deletedArtistDocs} duplicate/collab artist documents.`);

  // Now scan tracks collection and normalize artist names
  console.log('--- Normalizing tracks artist names ---');
  const tracks = await db.collection('tracks').find({}, { projection: { _id: 1, artist: 1 } }).toArray();
  let updatedTracks = 0;

  for (const t of tracks) {
    const raw = String(t.artist || '').trim();
    if (!raw) continue;
    const canonical = getCanonicalArtistName(raw);
    if (canonical && canonical !== raw) {
      await db.collection('tracks').updateOne({ _id: t._id }, { $set: { artist: canonical } });
      updatedTracks++;
    }
  }
  console.log(`Updated ${updatedTracks} tracks to their canonical artist names.`);

  // Print remaining artist docs
  const remainingArtists = await db.collection('artists').find({}).toArray();
  console.log(`\nRemaining verified artists (${remainingArtists.length}):`);
  remainingArtists.forEach(a => console.log(` - ${a.name} (verified: ${a.isVerified || false})`));

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
