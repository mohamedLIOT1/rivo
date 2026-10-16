const mongoose = require('mongoose');

const LyricsSchema = new mongoose.Schema({
  trackKey: { type: String, unique: true, index: true },
  trackId: { type: String, index: true },
  title: String,
  artist: String,
  lyrics: [{ time: Number, text: String }],
  updatedBy: String,
  source: { type: String, default: 'manual' },
  isVerified: { type: Boolean, default: false },
  verifiedBy: { type: String, default: '' },
  verifiedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.models.SongLyrics || mongoose.model('SongLyrics', LyricsSchema);
