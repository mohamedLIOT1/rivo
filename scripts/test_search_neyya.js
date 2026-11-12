const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const Track = mongoose.connection.db.collection('tracks');
  const tracks = await Track.find({
    $or: [
      { title: /neyya/i },
      { title: /نيه/i },
      { title: /نية/i },
      { artist: /lege/i },
      { artist: /ليجي/i }
    ]
  }).toArray();

  console.log(`Found ${tracks.length} tracks matching query:`);
  for (const t of tracks) {
    console.log(`- [${t._id}] "${t.title}" by "${t.artist}" (album: "${t.album}")`);
  }
  await mongoose.disconnect();
}
check().catch(console.error);
