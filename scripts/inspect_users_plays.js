const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { User, Track } = require('../server/models');

async function checkUsers() {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({}).lean();
  console.log('Total users in DB:', users.length);
  for (const u of users) {
    console.log(`User: ${u.name || u.email || u._id}`);
    if (u.listeningStats) {
      console.log('  listeningStats:', JSON.stringify(u.listeningStats).substring(0, 150));
    }
    if (u.recentlyPlayed) {
      console.log('  recentlyPlayed count:', u.recentlyPlayed.length);
    }
    if (u.listeningHistory) {
      console.log('  listeningHistory count:', u.listeningHistory.length);
    }
  }

  // Also check if any tracks have original plays saved or if views is separate
  const sample = await Track.findOne({ views: { $exists: true } }).lean();
  console.log('Sample track with views:', {
    title: sample?.title,
    plays: sample?.plays,
    views: sample?.views
  });

  await mongoose.disconnect();
}
checkUsers().catch(console.error);
