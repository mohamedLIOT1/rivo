const mongoose = require('mongoose');

const ArtistSchema = new mongoose.Schema({
  id: { type: String, unique: true, index: true },
  name: { type: String, required: true, unique: true, index: true },
  bio: { type: String, default: '' },
  cover: { type: String, default: '' },
  banner: { type: String, default: '' },
  isVerified: { type: Boolean, default: false },
  genres: [{ type: String }],
  customLinks: [{ label: String, url: String }],
  updatedBy: { type: String, default: 'admin' }
}, { timestamps: true });

module.exports = mongoose.models.Artist || mongoose.model('Artist', ArtistSchema);
