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
    // Ensure broken 404 cache URLs are restored to official streaming URLs
    await Track.updateMany(
      { audioUrl: /tcZgr2oM6kg/i },
      { $set: { audioUrl: 'https://www.youtube.com/watch?v=tcZgr2oM6kg', source: 'YouTube' } }
    );
    await Track.updateMany(
      { audioUrl: /5F2Px-e7Lo8/i },
      { $set: { audioUrl: 'https://www.youtube.com/watch?v=5F2Px-e7Lo8', source: 'YouTube' } }
    );
  } catch (err) {}
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
