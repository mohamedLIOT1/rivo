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
}, { timestamps: true, strict: false });

TrackSchema.index({ title: 1, artist: 1 });
TrackSchema.index({ createdAt: -1 });
TrackSchema.index({ isQuran: 1 });
TrackSchema.index({ album: 1 });
TrackSchema.index({ source: 1 });

module.exports = mongoose.models.Track || mongoose.model('Track', TrackSchema);
