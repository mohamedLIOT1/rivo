const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, lowercase: true, required: true },
  password: { type: String, required: true },
  avatar: String,
  bio: { type: String, default: '' },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  isAdmin: { type: Boolean, default: false },
  isBot: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  tokenInvalidBefore: { type: Date, default: null },
  likedTrackIds: [String],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  playlists: [{
    id: String,
    name: String,
    cover: String,
    trackIds: [String],
    isLikedSongs: Boolean,
    isPublic: { type: Boolean, default: true },
    description: String,
    isQuran: { type: Boolean, default: false },
    isMix: { type: Boolean, default: false },
    transitions: { type: Object, default: {} },
    sourcePlaylistId: { type: String, default: '' },
    sourceOwnerName: { type: String, default: '' },
    sourceOwnerId: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
  }],
  currentListening: { type: Object, default: null },
  lastActiveAt: { type: Date, default: Date.now },
  totalListeningSeconds: { type: Number, default: 0 },
  weeklyListeningSeconds: { type: Number, default: 0 },
  weeklyWeek: { type: String, default: '' },
  topTrack: {
    id: String,
    title: String,
    artist: String,
    cover: String,
    plays: { type: Number, default: 0 },
    seconds: { type: Number, default: 0 }
  },
  discord: {
    id: { type: String, default: '' },
    username: { type: String, default: '' },
    token: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    linkCode: { type: String, default: '' },
    linkCodeExpires: { type: Date, default: null }
  }
}, { timestamps: true });

UserSchema.index({ email: 1 });
UserSchema.index({ lastActiveAt: -1 });
UserSchema.index({ totalListeningSeconds: -1 });

module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
