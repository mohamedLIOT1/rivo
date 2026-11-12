const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function inspect() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to DB');
  
  const albums = await mongoose.connection.db.collection('albums').find({}).toArray();
  console.log(`Total albums in DB: ${albums.length}`);
  for (const a of albums) {
    console.log(`- [${a._id}] id: "${a.id}", name: "${a.name}", artist: "${a.artist}", cover: "${a.cover || 'NONE'}", tracks: ${a.trackIds?.length || 0}`);
  }

  await mongoose.disconnect();
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
