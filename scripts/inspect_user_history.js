const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { User } = require('../server/models');

async function inspectUsersDetails() {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find({}).lean();
  for (const u of users) {
    const histLen = Array.isArray(u.listeningHistory) ? u.listeningHistory.length : 0;
    const recLen = Array.isArray(u.recentlyPlayed) ? u.recentlyPlayed.length : 0;
    const stats = u.listeningStats ? Object.keys(u.listeningStats) : null;
    console.log(`User ${u.name}: history=${histLen}, recent=${recLen}, statsKeys=${stats}`);
  }
  await mongoose.disconnect();
}
inspectUsersDetails().catch(console.error);
