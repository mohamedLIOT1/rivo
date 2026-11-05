const mongoose = require('mongoose');

const AlbumSchema = new mongoose.Schema({
  id: { type: String, unique: true, index: true },
  name: { type: String, required: true },
  artist: { type: String, required: true },
  cover: { type: String },
  linkUrl: { type: String, default: '' },
  trackIds: [{ type: String }],
  releaseDate: { type: String },
  genre: { type: String },
  isAlbum: { type: Boolean, default: true },
  isSystem: { type: Boolean, default: true },
  isPublic: { type: Boolean, default: true },
  source: { type: String, default: 'album_detection' }
}, { timestamps: true });

AlbumSchema.index({ name: 1, artist: 1 });
AlbumSchema.index({ artist: 1, createdAt: -1 });
AlbumSchema.index({ isPublic: 1, updatedAt: -1 });
AlbumSchema.index({ trackIds: 1 });
AlbumSchema.index({ createdAt: -1 });
AlbumSchema.index({ updatedAt: -1 });

module.exports = mongoose.models.Album || mongoose.model('Album', AlbumSchema);
