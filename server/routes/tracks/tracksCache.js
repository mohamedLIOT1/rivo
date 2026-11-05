// In-memory cache for public tracks catalog
let cachedPublicTracksJson = null;
let cachedPublicTracksTime = 0;
const TRACKS_CACHE_TTL = 45 * 1000;

function invalidateTracksCache() {
  cachedPublicTracksJson = null;
  cachedPublicTracksTime = 0;
}

function getCachedTracks() {
  if (cachedPublicTracksJson && (Date.now() - cachedPublicTracksTime < TRACKS_CACHE_TTL)) {
    return cachedPublicTracksJson;
  }
  return null;
}

function setCachedTracks(json) {
  cachedPublicTracksJson = json;
  cachedPublicTracksTime = Date.now();
}

module.exports = {
  invalidateTracksCache,
  getCachedTracks,
  setCachedTracks,
  TRACKS_CACHE_TTL
};
