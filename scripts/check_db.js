require('./server/node_modules/dotenv').config({ path: '/home/ubuntu/rivo/.env' });
const mongoose = require('./server/node_modules/mongoose');
const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));
const Message = mongoose.model('Message', new mongoose.Schema({}, { strict: false }));
const Track = mongoose.model('Track', new mongoose.Schema({}, { strict: false }));

async function run() {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  console.log('Connecting to Mongo URI...');
  await mongoose.connect(uri);
  
  console.log('=== USERS ===');
  const users = await User.find({}, '_id name email role isBot avatar bio').lean();
  for (const u of users) {
    console.log(`User: ${u.name} | ID: ${u._id} | Email: ${u.email} | isBot: ${u.isBot} | Avatar: ${u.avatar}`);
  }

  console.log('\n=== RECENT MESSAGES (Last 15) ===');
  const msgs = await Message.find().sort({ createdAt: -1 }).limit(15).lean();
  for (const m of msgs) {
    console.log(`[${m.createdAt}] from ${m.sender} to ${m.recipient}: "${m.text}"`);
  }

  const trackCount = await Track.countDocuments();
  console.log(`\n=== TOTAL TRACKS IN DB: ${trackCount} ===`);

  // Find duplicates for "Roma" and "Seneen"
  const romaTracks = await Track.find({ title: /Roma/i }).lean();
  console.log(`\n=== "Roma" tracks count: ${romaTracks.length} ===`);
  for (const t of romaTracks) {
    console.log(`  ID: ${t._id} | title: "${t.title}" | artist: "${t.artist}" | album: "${t.album}" | audioUrl: "${t.audioUrl || t.url}" | duration: ${t.duration}`);
  }

  const seneenTracks = await Track.find({ title: /Seneen/i }).lean();
  console.log(`\n=== "Seneen" tracks count: ${seneenTracks.length} ===`);
  for (const t of seneenTracks) {
    console.log(`  ID: ${t._id} | title: "${t.title}" | artist: "${t.artist}" | album: "${t.album}" | audioUrl: "${t.audioUrl || t.url}" | duration: ${t.duration}`);
  }

  // All duplicates
  const dupes = await Track.aggregate([
    {
      $group: {
        _id: { $toLower: { $trim: { input: "$title" } } },
        count: { $sum: 1 },
        artists: { $addToSet: "$artist" },
        ids: { $push: "$_id" }
      }
    },
    { $match: { count: { $gt: 1 } } },
    { $sort: { count: -1 } }
  ]);
  console.log(`\n=== TOTAL DUPLICATE GROUPS BY TITLE: ${dupes.length} ===`);
  for (const d of dupes.slice(0, 15)) {
    console.log(`Duplicate group: "${d._id}" (${d.count} occurrences) - artists: [${d.artists.join(', ')}]`);
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
