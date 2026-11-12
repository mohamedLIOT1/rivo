const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function purgeEmptyAndSingleAlbums() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const Album = db.collection('albums');

  console.log('--- Scanning Albums collection for singles and empty albums ---');
  const allAlbums = await Album.find({}).toArray();
  const toDeleteIds = [];

  for (const a of allAlbums) {
    const rawName = String(a.name || a.title || '').trim();
    const isExplicitSingle = a.releaseType === 'single' ||
      /\s*-\s*Single$/i.test(rawName) ||
      /\s*\(Single\)$/i.test(rawName) ||
      /\bSingle\b/i.test(rawName);

    const tIds = Array.isArray(a.trackIds) ? a.trackIds : [];
    const embeddedTracks = Array.isArray(a.tracks) ? a.tracks : [];
    const declaredCount = Number(a.trackCount || 0);

    const actualCount = Math.max(declaredCount, tIds.length, embeddedTracks.length);

    // If it's a single OR has 0 or 1 track, it is NOT an album!
    if (isExplicitSingle || actualCount <= 1 || (tIds.length === 0 && embeddedTracks.length <= 1)) {
      toDeleteIds.push(a._id);
    }
  }

  console.log(`Found ${toDeleteIds.length} singles and empty albums to purge out of ${allAlbums.length} total albums.`);
  if (toDeleteIds.length > 0) {
    const res = await Album.deleteMany({ _id: { $in: toDeleteIds } });
    console.log(`✅ Successfully deleted ${res.deletedCount} single and empty album records.`);
  }

  const remaining = await Album.countDocuments();
  console.log(`✅ Remaining pure, verified Albums in collection: ${remaining}`);

  process.exit(0);
}

purgeEmptyAndSingleAlbums().catch(e => {
  console.error('Purge error:', e);
  process.exit(1);
});
