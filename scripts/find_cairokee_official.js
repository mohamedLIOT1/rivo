const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function findCairokeeOfficial() {
  await mongoose.connect(process.env.MONGO_URI);
  const db = mongoose.connection.db;
  const cols = await db.listCollections().toArray();
  for (const c of cols) {
    const colName = c.name;
    const match = await db.collection(colName).find({
      $or: [
        { name: /cairokeeofficial/i },
        { artist: /cairokeeofficial/i },
        { username: /cairokeeofficial/i }
      ]
    }).limit(10).toArray();
    if (match.length > 0) {
      console.log(`Found in collection "${colName}":`, match.map(m => ({ 
        id: m.id, 
        _id: m._id, 
        name: m.name, 
        title: m.title, 
        artist: m.artist, 
        username: m.username 
      })));
    }
  }
  await mongoose.disconnect();
}
findCairokeeOfficial().catch(console.error);
