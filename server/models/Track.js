const mongoose = require('mongoose');

const TrackSchema = new mongoose.Schema({
  title: { type: String, required: true },
  artist: { type: String, required: true },
  album: String,
  cover: String,
  audioUrl: { type: String, required: true },
  duration: Number,
  genre: String,
  source: String,
  addedBy: String,
  lyrics: [{ time: Number, text: String }],
  color: String,
  isQuran: { type: Boolean, default: false },
  contentType: { type: String, enum: ['music', 'quran', 'podcast', 'audiobook'], default: 'music' },
  isPodcast: { type: Boolean, default: false },
  isAudiobook: { type: Boolean, default: false },
  plays: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  youtubeViews: { type: Number, default: 0 },
  legacyAudioUrl: String,
  youtubeId: String,
  cloudStorage: {
    provider: { type: String, enum: ['telegram', 'b2'] },
    botIndex: Number,
    chatId: String,
    messageId: Number,
    fileId: String,
    fileUniqueId: String,
    fileSize: Number,
    ext: String,
    accountIndex: Number,
    bucketId: String,
    bucketName: String,
    fileName: String,
    b2FileId: String
  },
  migration: {
    status: { type: String, enum: ['pending', 'migrated', 'skipped', 'deferred', 'failed'] },
    reason: String,
    category: String,
    updatedAt: Date,
    attempts: { type: Number, default: 0 },
    lastError: String
  }
}, { timestamps: true, strict: false });

TrackSchema.index({ title: 1, artist: 1 });
TrackSchema.index({ artist: 1, plays: -1 });
TrackSchema.index({ artist: 1, views: -1 });
TrackSchema.index({ artist: 1, createdAt: -1 });
TrackSchema.index({ album: 1, createdAt: -1 });
TrackSchema.index({ isQuran: 1, plays: -1 });
TrackSchema.index({ source: 1, createdAt: -1 });
TrackSchema.index({ audioUrl: 1 });
TrackSchema.index({ plays: -1 });
TrackSchema.index({ views: -1 });
TrackSchema.index({ createdAt: -1 });
TrackSchema.index({ isQuran: 1 });
TrackSchema.index({ genre: 1 });
TrackSchema.index({ genre: 1, plays: -1 });
TrackSchema.index({ contentType: 1 });
TrackSchema.index({ id: 1 }, { sparse: true });
TrackSchema.index({ addedBy: 1 });
TrackSchema.index({ 'migration.status': 1, createdAt: -1 });
TrackSchema.index({ 'cloudStorage.provider': 1 });
TrackSchema.index({ youtubeId: 1 }, { sparse: true });

module.exports = mongoose.models.Track || mongoose.model('Track', TrackSchema);
