const mongoose = require('mongoose');
const Track = require('./Track');
const SongLyrics = require('./SongLyrics');
const Album = require('./Album');
const Artist = require('./Artist');
const User = require('./User');
const Message = require('./Message');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ [Fatal Config] MONGO_URI is missing from environment variables (.env)!');
}

async function restoreAndCleanAttackData() {
  try {
    const duplicateIds = [
      '6ad8f0227dd3f2c5ba1fe409',
      '6ad7c66d78e1082780925207',
      '6ad83a6ffee6e2e779efeb80',
      '6ad7e05db0f581602eb4aa15',
      '6ad7696bb288ab16291fd1ae',
      '6ad76928b288ab16291fd09a',
      '6ad8eb847dd3f2c5ba1fe1cc',
      '6ad78191617a463fd2b60cb2',
      '6ad7572c82b546ebaa1b240f',
      '6ad7572b82b546ebaa1b240b',
      '6ad7569082b546ebaa1b23fc',
      '6ad74ff13d91785d70eeb625',
      '6ad74ff13d91785d70eeb623',
      '6ad74e28bfc0379104021376'
    ];

    // 1. Delete duplicate tracks from Track collection
    const delRes = await Track.deleteMany({ _id: { $in: duplicateIds } });
    if (delRes.deletedCount > 0) {
      console.log(`[Attack Cleanup] Deleted ${delRes.deletedCount} duplicate tracks.`);
    }

    // 2. Remove duplicates and misplaced tracks from Album.trackIds
    await Album.updateMany({}, {
      $pull: {
        trackIds: {
          $in: [
            ...duplicateIds,
            '6ab6feef49510bc9ca38ce68' // Kont Faker belongs to Noaata Beida, remove from Classics Vol 1
          ]
        }
      }
    });

    // Ensure Kont Faker is in Album - Noaata Beida
    await Album.updateOne(
      { name: /Noaata Beida/i },
      { $addToSet: { trackIds: '6ab6feef49510bc9ca38ce68' } }
    );

    // 3. Restore broken cache URLs back to official streaming URLs
    await Track.updateMany(
      { audioUrl: /tcZgr2oM6kg/i },
      { $set: { audioUrl: 'https://www.youtube.com/watch?v=tcZgr2oM6kg', source: 'YouTube' } }
    );
    await Track.updateMany(
      { audioUrl: /5F2Px-e7Lo8/i },
      { $set: { audioUrl: 'https://www.youtube.com/watch?v=5F2Px-e7Lo8', source: 'YouTube' } }
    );

    console.log('✅ [Database Audit & Cleanup] All albums and tracks verified and cleaned.');
  } catch (err) {
    console.warn('[Attack Cleanup] Error:', err.message);
  }
}

async function connectDB() {
  try { 
    await mongoose.connect(MONGO_URI); 
    console.log('✅ DB Connected'); 
    await User.updateMany({}, { $set: { 'currentListening.isPlaying': false } }).catch(() => {});
    restoreAndCleanAttackData();
  } catch (err) { 
    console.error('DB connect error:', err.message);
    setTimeout(connectDB, 5000); 
  }
}

if (MONGO_URI) {
  connectDB();
}

module.exports = {
  Track,
  SongLyrics,
  Album,
  Artist,
  User,
  Message,
  connectDB
};
