const mongoose = require('mongoose');

const TrackSnapshotSchema = new mongoose.Schema({
  id: String,
  title: String,
  artist: String,
  album: String,
  cover: String,
  duration: Number,
  trackNumber: Number,
  streamUrl: String
}, { _id: false, strict: false });

const AlbumSchema = new mongoose.Schema({
  id: { type: String, unique: true, index: true },
  name: { type: String, required: true },
  artist: { type: String, required: true },
  cover: { type: String },
  linkUrl: { type: String, default: '' },
  trackIds: [{ type: String }],
  releaseDate: { type: String },
  genre: { type: String },
  releaseType: { type: String, enum: ['album', 'ep'], default: 'album', index: true },
  trackCount: { type: Number, default: 0 },
  tracks: [TrackSnapshotSchema],
  isAlbum: { type: Boolean, default: true },
  isSystem: { type: Boolean, default: true },
  isPublic: { type: Boolean, default: true },
  isQuran: { type: Boolean, default: false },
  source: { type: String, default: 'album_detection' }
}, { timestamps: true });

// Pre-save validation: strictly prevent 1-track items or Quran items from being treated as music albums
AlbumSchema.pre('save', function(next) {
  if (this.isQuran || this.genre === 'Holy Quran' || this.genre === 'Quran') {
    return next(new Error('Quran recitations must not be saved in the music albums collection'));
  }
  const effectiveCount = Math.max(
    Number(this.trackCount || 0),
    Array.isArray(this.trackIds) ? this.trackIds.length : 0,
    Array.isArray(this.tracks) ? this.tracks.length : 0
  );
  if (this.releaseType === 'single' || (effectiveCount <= 1 && (!this.tracks || this.tracks.length <= 1) && (!this.trackIds || this.trackIds.length <= 1))) {
    return next(new Error('Single releases (1 track) cannot be saved in the albums collection'));
  }
  next();
});

AlbumSchema.index({ name: 1, artist: 1 });
AlbumSchema.index({ artist: 1, createdAt: -1 });
AlbumSchema.index({ isPublic: 1, updatedAt: -1 });
AlbumSchema.index({ trackIds: 1 });
AlbumSchema.index({ isQuran: 1 });
AlbumSchema.index({ createdAt: -1 });
AlbumSchema.index({ updatedAt: -1 });

module.exports = mongoose.models.Album || mongoose.model('Album', AlbumSchema);
