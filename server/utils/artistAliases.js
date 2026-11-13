/**
 * Canonical Artist Aliases & Deduplication Dictionary (Server)
 * Unifies Arabic, Latin, and transliterated artist spellings.
 * Strictly modularized (< 400 lines).
 */

const { FLAT_ALIAS_MAP } = require('./canonicalArtistData');
const { getCanonicalArtistName } = require('./artistAlbumUtils');

const CANONICAL_ARTIST_MAP = FLAT_ALIAS_MAP;

function normalizeString(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '')
    .replace(/[\-_|–—:]/g, ' ')
    .replace(/[^a-zA-Z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveCanonicalArtist(rawNorm) {
  if (!rawNorm || typeof rawNorm !== 'string') return '';
  const trimmed = rawNorm.trim();
  const lower = trimmed.toLowerCase();

  // Exact lookup in flat alias dictionary first
  if (CANONICAL_ARTIST_MAP[lower]) {
    return CANONICAL_ARTIST_MAP[lower];
  }

  // Lookup via centralized canonical artist algorithm (handles bilingual, brackets, etc.)
  const canonical = getCanonicalArtistName(trimmed);
  if (canonical && canonical.toLowerCase() !== lower) {
    return canonical.toLowerCase();
  }

  return trimmed;
}

function getPrimaryArtistNormalized(artist) {
  if (!artist || typeof artist !== 'string') return 'unknown';
  const trimmed = artist.trim();

  // Try direct canonical resolution for the full string first (handles bilingual names like "Shehab - شهاب")
  const canonical = getCanonicalArtistName(trimmed);
  if (canonical && canonical.toLowerCase() !== trimmed.toLowerCase()) {
    return canonical.toLowerCase();
  }

  // Split on collaboration delimiters if not resolved as a single bilingual artist
  const clean = trimmed.toLowerCase().split(/\b(ft\.?|feat\.?|featuring|with|x|vs\.?)\b|[,&،\+]/i)[0];
  const norm = normalizeString(clean);
  return resolveCanonicalArtist(norm) || 'unknown';
}

module.exports = {
  CANONICAL_ARTIST_MAP,
  resolveCanonicalArtist,
  getPrimaryArtistNormalized
};
