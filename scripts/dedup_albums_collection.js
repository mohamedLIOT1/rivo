const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Album = mongoose.connection.db.collection('albums');

  const all = await Album.find({}).toArray();
  const seen = new Map();
  const toDelete = [];

  for (const a of all) {
    const key = `${String(a.artist || '').trim().toLowerCase()}:::${String(a.name || '').trim().toLowerCase().replace(/^album\s*-\s*/i, '')}`;
    if (!seen.has(key)) {
      seen.set(key, a);
    } else {
      const existing = seen.get(key);
      const existingCount = Number(existing.trackCount || existing.tracks?.length || 0);
      const thisCount = Number(a.trackCount || a.tracks?.length || 0);
      if (thisCount > existingCount) {
        toDelete.push(existing._id);
        seen.set(key, a);
      } else {
        toDelete.push(a._id);
      }
    }
  }

  if (toDelete.length > 0) {
    console.log(`Deleting ${toDelete.length} duplicate album documents...`);
    await Album.deleteMany({ _id: { $in: toDelete } });
  }

  const finalCount = await Album.countDocuments();
  console.log(`Final unique albums in DB: ${finalCount}`);
  await mongoose.disconnect();
}
main().catch(console.error);
