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

async function purgeSoundCloudData() {
  try {
    const scQuery = {
      $or: [
        { source: { $regex: /soundcloud/i } },
        { audioUrl: { $regex: /soundcloud\.com|sndcdn\.com/i } },
        { album: { $regex: /soundcloud/i } },
        { originalUrl: { $regex: /soundcloud\.com/i } },
        { id: { $regex: /^sc-/i } },
      ]
    };
    const res = await Track.deleteMany(scQuery);
    if (res.deletedCount > 0) {
      console.log(`[SoundCloud Purge] Deleted ${res.deletedCount} SoundCloud tracks from MongoDB.`);
    }
  } catch (err) {
    console.warn('[SoundCloud Purge] DB error:', err.message);
  }
}

async function restoreAndCleanAttackData() {
  try {
    const duplicateIds = [
      '6ad8f0227dd3f2c5ba1fe409', '6ad8eb847dd3f2c5ba1fe1cc', '6ad83a6ffee6e2e779efeb80',
      '6ad7e05db0f581602eb4aa15', '6ad7c66d78e1082780925207', '6ad78191617a463fd2b60cb2',
      '6ad7696bb288ab16291fd1ae', '6ad76928b288ab16291fd09a', '6ad7572c82b546ebaa1b240f',
      '6ad7572b82b546ebaa1b240b', '6ad7569082b546ebaa1b23fc', '6ad74ff13d91785d70eeb625',
      '6ad74ff13d91785d70eeb623', '6ad74e28bfc0379104021376'
    ];
    const delRes = await Track.deleteMany({ _id: { $in: duplicateIds } });
    if (delRes.deletedCount > 0) {
      console.log(`[Attack Cleanup] Purged ${delRes.deletedCount} corrupted duplicate tracks.`);
    }

    // Restore broken 404 cache URLs back to official streaming URLs
    await Track.updateMany(
      { title: /ولاد الحلال|Wlad ElHalal/i, audioUrl: /audio-cache/i },
      { $set: { source: 'YouTube' } }
    );
    await Track.updateOne(
      { title: /تامر عاشور - ولاد الحلال|Wlad ElHalal/i, artist: /Tamer Ashour/i },
      { $set: { audioUrl: 'https://www.youtube.com/watch?v=tcZgr2oM6kg', source: 'YouTube' } }
    );
    await Track.updateOne(
      { title: /ولاد الحلال/i, artist: /حماقي|Hamaki/i },
      { $set: { audioUrl: 'https://www.youtube.com/watch?v=5F2Px-e7Lo8', source: 'YouTube' } }
    );

    // Restore Cairokee studio tracks from live/orchestra overrides
    await Track.updateOne(
      { title: /^Helmy Ana$/i, artist: /Cairokee/i },
      { $set: { audioUrl: 'https://www.youtube.com/watch?v=S4gx6GZ_w6o' } }
    );
    await Track.updateOne(
      { title: /^Ethbat Makanak$/i, artist: /Cairokee/i },
      { $set: { audioUrl: 'https://www.youtube.com/watch?v=0hhXwSen-Vw' } }
    );
    await Track.updateOne(
      { title: /^Kont Faker$/i, artist: /Cairokee/i },
      { $set: { audioUrl: 'https://www.youtube.com/watch?v=9r8SwBg8YLc' } }
    );
    await Track.updateOne(
      { title: /Ya Abyad Ya Eswed/i, artist: /Cairokee/i },
      { $set: { audioUrl: 'https://www.youtube.com/watch?v=vbe6HnIPJVk' } }
    );
    console.log('[Attack Cleanup] Database tracks restored successfully.');
  } catch (err) {
    console.warn('[Attack Cleanup] Error:', err.message);
  }
}

async function connectDB() {
  try { 
    await mongoose.connect(MONGO_URI); 
    console.log('✅ DB Connected'); 
    await User.updateMany({}, { $set: { 'currentListening.isPlaying': false } }).catch(() => {});
    purgeSoundCloudData();
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
