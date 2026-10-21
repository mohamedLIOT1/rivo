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

async function connectDB() {
  try { 
    await mongoose.connect(MONGO_URI); 
    console.log('✅ DB Connected'); 
    await User.updateMany({}, { $set: { 'currentListening.isPlaying': false } }).catch(() => {});
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
