const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Album = mongoose.connection.db.collection('albums');
  const total = await Album.countDocuments();
  console.log('Current total albums in DB:', total);

  const albums = await Album.find({}).limit(10).toArray();
  for (const a of albums) {
    console.log(`- name: "${a.name}", id: "${a.id}", _id: "${a._id}" (type: ${typeof a._id})`);
  }
  await mongoose.disconnect();
}

main().catch(console.error);
