/**
 * Reset Track Site Plays & Preserve YouTube Views for Algorithm
 *
 * Requirements:
 * 1. Site play counts (`plays`) must reflect authentic Rivo plays (not inflated YouTube numbers).
 * 2. YouTube view counts are preserved in `views` and `youtubeViews` for algorithms (recommendation,
 *    top charts, 12h featured albums rotation).
 * 3. Verified across all tracks in MongoDB Atlas.
 */

const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const { Track, User } = require('../server/models');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas.');

  // 1. Gather genuine user plays from User.listeningStats if any exist
  const users = await User.find({}).select('listeningStats').lean();
  const realUserPlaysMap = {};
  for (const u of users) {
    if (u.listeningStats && u.listeningStats.trackPlays) {
      for (const [tId, cnt] of Object.entries(u.listeningStats.trackPlays)) {
        realUserPlaysMap[tId] = (realUserPlaysMap[tId] || 0) + (Number(cnt) || 0);
      }
    }
  }
  console.log(`📊 Found ${Object.keys(realUserPlaysMap).length} tracks with genuine user plays.`);

  // 2. Fetch all tracks
  const tracks = await Track.find({}, '_id plays views youtubeViews').lean();
  console.log(`📦 Processing ${tracks.length} tracks...`);

  const bulkOps = [];
  let converted = 0;

  for (const t of tracks) {
    const currentPlays = Number(t.plays) || 0;
    const currentViews = Number(t.views) || Number(t.youtubeViews) || 0;
    const ytScore = Math.max(currentPlays, currentViews);

    const genuinePlays = realUserPlaysMap[String(t._id)] || 0;

    bulkOps.push({
      updateOne: {
        filter: { _id: t._id },
        update: {
          $set: {
            views: ytScore,
            youtubeViews: ytScore,
            plays: genuinePlays
          }
        }
      }
    });
    converted++;
  }

  const chunkSize = 500;
  for (let i = 0; i < bulkOps.length; i += chunkSize) {
    const chunk = bulkOps.slice(i, i + chunkSize);
    await Track.bulkWrite(chunk);
  }
  console.log(`✅ Successfully updated ${converted} tracks.`);

  // 3. Verify sample
  const sample = await Track.find({}).sort({ views: -1 }).limit(5).select('title artist plays views youtubeViews').lean();
  console.log('Sample top views (for algorithm):', sample);

  const samplePlays = await Track.countDocuments({ plays: { $gt: 0 } });
  console.log(`Total tracks with site plays > 0: ${samplePlays}`);

  await mongoose.disconnect();
  console.log('🏁 Done.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
