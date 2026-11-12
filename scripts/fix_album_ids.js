const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const coll = mongoose.connection.collection('albums');
  const nullIdDocs = await coll.find({ $or: [{ id: null }, { id: { $exists: false } }] }).toArray();
  console.log('Albums with null or missing id:', nullIdDocs.length);
  for (const d of nullIdDocs) {
    const newId = `album-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    await coll.updateOne({ _id: d._id }, { $set: { id: newId } });
    console.log('Fixed album id:', d.name, '->', newId);
  }
  await mongoose.disconnect();
}

main().catch(console.error);
