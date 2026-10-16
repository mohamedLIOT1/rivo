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

module.exports = mongoose.models.Album || mongoose.model('Album', AlbumSchema);
