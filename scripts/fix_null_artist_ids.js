const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('No MONGO_URI found in env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const Artist = mongoose.connection.db.collection('artists');

  const nullDocs = await Artist.find({ $or: [{ id: null }, { id: { $exists: false } }] }).toArray();
  console.log(`Found ${nullDocs.length} artists with null or missing id`);

  for (const doc of nullDocs) {
    const slug = (doc.name || 'artist')
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');
    const newId = `artist-${slug}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 4)}`;
    await Artist.updateOne({ _id: doc._id }, { $set: { id: newId } });
    console.log(`Updated artist "${doc.name}" with id: ${newId}`);
  }

  console.log('Finished updating null/missing artist IDs.');
  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Error in fix_null_artist_ids:', err);
  process.exit(1);
});
