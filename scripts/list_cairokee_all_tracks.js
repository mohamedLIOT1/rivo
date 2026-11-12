const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Track = mongoose.connection.db.collection('tracks');

  const cairokeeTracks = await Track.find({ 
    $or: [
      { artist: /cairokee/i },
      { artist: /كايروكي/i },
      { title: /cairokee/i },
      { title: /كايروكي/i }
    ]
  }).toArray();

  console.log(`Found ${cairokeeTracks.length} Cairokee-related tracks:`);
  for (const t of cairokeeTracks) {
    console.log(`- [${t._id}] "${t.title}" | artist: "${t.artist}" | album: "${t.album}" | dur: ${t.duration}s | verified: ${Boolean(t.verifiedLyrics)}`);
  }

  await mongoose.disconnect();
}
main().catch(console.error);
