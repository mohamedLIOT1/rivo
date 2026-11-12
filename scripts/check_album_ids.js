const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const coll = mongoose.connection.collection('albums');
  const all = await coll.find().toArray();
  console.log('Total albums in coll:', all.length);
  all.forEach(a => {
    console.log(`_id: ${a._id} | id: "${a.id}" | name: "${a.name}"`);
  });
  await mongoose.disconnect();
}

main().catch(console.error);
