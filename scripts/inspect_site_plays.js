const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { User, Track } = require('../server/models');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const users = await User.find({}).select('name listeningStats').lean();
  console.log('Total users:', users.length);

  const realPlaysMap = {};
  let totalLoggedPlays = 0;
  for (const u of users) {
    if (u.listeningStats) {
      console.log('User:', u.name, 'stats keys:', Object.keys(u.listeningStats));
      if (u.listeningStats.trackPlays) {
        for (const [tId, pCount] of Object.entries(u.listeningStats.trackPlays)) {
          realPlaysMap[tId] = (realPlaysMap[tId] || 0) + (Number(pCount) || 0);
          totalLoggedPlays += Number(pCount) || 0;
        }
      }
    }
  }

  console.log('Total real logged plays from users:', totalLoggedPlays);
  console.log('Total tracks with user plays:', Object.keys(realPlaysMap).length);

  // Check some sample tracks in DB
  const sampleTracks = await Track.find({}).limit(5).select('title artist plays views').lean();
  console.log('Sample tracks:', sampleTracks);

  await mongoose.disconnect();
}
check().catch(console.error);
