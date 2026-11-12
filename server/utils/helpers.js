/**
 * Rivo Server Helpers - Modularized Facade
 * All specialized modules are extracted into dedicated sub-modules (< 400 lines each)
 * to maintain clean separation of concerns and avoid monolithic files.
 */

const quranUtils = require('./quranUtils');
const artistAlbumUtils = require('./artistAlbumUtils');
const youtubeSearch = require('./youtubeSearch');
const trackMetadataUtils = require('./trackMetadataUtils');
const trackSearchInternal = require('./trackSearchInternal');
const playlistScraper = require('./playlistScraper');
const audioCacheUtils = require('./audioCacheUtils');
const ytDlpWorker = require('./ytDlpWorker');
const youtubeStreamResolver = require('./youtubeStreamResolver');
const lyricsService = require('./lyricsService');

// Bind fetchTrackCover with searchYouTubeId
const fetchTrackCover = (title, artist) => {
  return trackMetadataUtils.fetchTrackCover(title, artist, youtubeSearch.searchYouTubeId);
};

// Bind invalidateAudioCache with directStreamCache and streamFallbackProvider memory cache
const invalidateAudioCache = (videoIdOrUrl, deleteDiskFile = false) => {
  if (videoIdOrUrl) {
    youtubeStreamResolver.clearStreamMemoryCache(videoIdOrUrl);
  }
  return audioCacheUtils.invalidateAudioCache(videoIdOrUrl, deleteDiskFile, youtubeStreamResolver.directStreamCache);
};

// Periodic cache cleanup
const startupCleanupTimer = setTimeout(audioCacheUtils.cleanupAudioCache, 5000);
if (typeof startupCleanupTimer.unref === 'function') startupCleanupTimer.unref();
const periodicCleanupTimer = setInterval(audioCacheUtils.cleanupAudioCache, 6 * 3600 * 1000);
if (typeof periodicCleanupTimer.unref === 'function') periodicCleanupTimer.unref();

module.exports = {
  // Quran Utils
  escapeRegex: quranUtils.escapeRegex,
  QURAN_REGEX: quranUtils.QURAN_REGEX,
  isQuranContent: quranUtils.isQuranContent,
  SERVER_FAMOUS_RECITERS: quranUtils.SERVER_FAMOUS_RECITERS,
  normalizeArabic: quranUtils.normalizeArabic,
  detectQuranReciter: quranUtils.detectQuranReciter,

  // Artist & Album Utils
  OFFICIAL_ALBUM_COVERS: artistAlbumUtils.OFFICIAL_ALBUM_COVERS,
  autoFixAlbumCovers: artistAlbumUtils.autoFixAlbumCovers,
  CANONICAL_ARTIST_MAP: artistAlbumUtils.CANONICAL_ARTIST_MAP,
  normalizeArtistName: artistAlbumUtils.normalizeArtistName,
  splitArtistNames: artistAlbumUtils.splitArtistNames,
  getPrimaryArtist: artistAlbumUtils.getPrimaryArtist,
  getCanonicalArtistName: artistAlbumUtils.getCanonicalArtistName,
  getArtistAliases: artistAlbumUtils.getArtistAliases,
  isValidAlbumName: artistAlbumUtils.isValidAlbumName,
  syncTrackToAlbum: artistAlbumUtils.syncTrackToAlbum,

  // YouTube Search
  getYouTubeApiKeys: youtubeSearch.getYouTubeApiKeys,
  getActiveYouTubeApiKey: youtubeSearch.getActiveYouTubeApiKey,
  markYouTubeApiKeyExceeded: youtubeSearch.markYouTubeApiKeyExceeded,
  calculateTitleSimilarity: youtubeSearch.calculateTitleSimilarity,
  searchYouTubeId: youtubeSearch.searchYouTubeId,

  // Track Metadata Utils
  fetchTrackCover,
  fetchTrackMetadata: trackMetadataUtils.fetchTrackMetadata,
  getTrackKey: trackMetadataUtils.getTrackKey,
  isMusicTrackServer: trackMetadataUtils.isMusicTrackServer,
  parseDurationFromLabel: trackMetadataUtils.parseDurationFromLabel,
  autoAddTrackToUserLinksPlaylist: trackMetadataUtils.autoAddTrackToUserLinksPlaylist,

  // Track Search Internal
  searchTracksInternal: trackSearchInternal.searchTracksInternal,

  // Playlist & Album Scraper
  scrapePlaylistOrAlbum: playlistScraper.scrapePlaylistOrAlbum,

  // Audio Cache Utils
  getCookiesPath: audioCacheUtils.getCookiesPath,
  isAudioFileValid: audioCacheUtils.isAudioFileValid,
  getLocalAudioFileDuration: audioCacheUtils.getLocalAudioFileDuration,
  downloadYouTubeAudioToCache: audioCacheUtils.downloadYouTubeAudioToCache,
  invalidateAudioCache,

  // Yt-Dlp Worker
  getYtDlpBin: ytDlpWorker.getYtDlpBin,
  ensureYtDlpBinary: ytDlpWorker.ensureYtDlpBinary,
  initWarmYtWorker: ytDlpWorker.initWarmYtWorker,
  extractViaWarmWorker: ytDlpWorker.extractViaWarmWorker,
  queueBackgroundAudioCache: ytDlpWorker.queueBackgroundAudioCache,

  // Stream Resolution
  extractDirectStreamUrl: youtubeStreamResolver.extractDirectStreamUrl,
  resolveOfficialYouTubeAudioStream: youtubeStreamResolver.resolveOfficialYouTubeAudioStream,
  clearStreamMemoryCache: youtubeStreamResolver.clearStreamMemoryCache,

  // Lyrics Service
  parseLrc: lyricsService.parseLrc,
  parsePlain: lyricsService.parsePlain,
  cleanLyricsMetadata: lyricsService.cleanLyricsMetadata,
  fetchLrclibLyrics: lyricsService.fetchLrclibLyrics,
  fetchGeniusLyrics: lyricsService.fetchGeniusLyrics
};
