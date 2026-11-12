const mongoose = require('mongoose');
require('dotenv').config({ path: '/home/ubuntu/rivo/.env' });

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const Track = mongoose.connection.db.collection('tracks');

  const youtubeTracks = await Track.find({ 
    $or: [
      { album: 'YouTube' },
      { album: 'youtube' },
      { source: 'YouTube', album: { $in: ['', null, 'Single'] }, duration: { $lt: 60 } }
    ]
  }).toArray();

  console.log(`Tracks with album YouTube or short snippets: ${youtubeTracks.length}`);
  for (const t of youtubeTracks) {
    console.log(`- [${t._id}] "${t.title}" | artist: "${t.artist}" | album: "${t.album}" | dur: ${t.duration}s`);
  }

  await mongoose.disconnect();
}
main().catch(console.error);
