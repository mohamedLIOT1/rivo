require('dotenv').config();
const mongoose = require('mongoose');
const { Track } = require('../server/models');

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const tracks = await Track.find({
    $or: [
      { title: { $regex: /ragea|راجع/i } },
      { artist: { $regex: /diab|دياب/i } }
    ]
  }).lean();
  for (const t of tracks) {
    console.log(`ID: ${t._id} | Title: "${t.title}" | Artist: "${t.artist}" | Duration: ${t.duration} | AudioUrl: ${t.audioUrl} | Source: ${t.source}`);
  }
  process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
