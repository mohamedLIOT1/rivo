const mongoose = require('mongoose');

const ArtistSchema = new mongoose.Schema({
  id: { type: String, unique: true, index: true },
  name: { type: String, required: true, unique: true, index: true },
  bio: { type: String, default: '' },
  cover: { type: String, default: '' },
  avatar: { type: String, default: '' },
  banner: { type: String, default: '' },
  isVerified: { type: Boolean, default: false },
  genres: [{ type: String }],
  customLinks: [{ label: String, url: String }],
  updatedBy: { type: String, default: 'admin' }
}, { timestamps: true });

ArtistSchema.index({ name: 1, isVerified: 1 });
ArtistSchema.index({ createdAt: -1 });

// Prevent collaborative artist names from being saved as standalone artist documents
ArtistSchema.pre('save', function(next) {
  const COLLAB_REGEX = /(?:\s*[,،;&+]\s*|\s+(?:ft\.?|feat\.?|featuring|with|مع|vs\.?)\s+|\s+[xX]\s+|\s+و\s+)/i;
  if (this.name && COLLAB_REGEX.test(this.name)) {
    return next(new Error(`Collaborative artist profiles like "${this.name}" cannot be created as standalone artists.`));
  }
  next();
});

module.exports = mongoose.models.Artist || mongoose.model('Artist', ArtistSchema);
