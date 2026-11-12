const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const crypto = require('crypto');
const { Album, Track } = require('../models');
const { adminAuth } = require('../middleware/auth');
const { classifyGenre } = require('../utils/genreClassifier');
const {
  scrapePlaylistOrAlbum,
  autoFixAlbumCovers,
  escapeRegex
} = require('../utils/helpers');
const { handleImportAlbum, handleDeleteAlbum } = require('./albums/albumAdminService');

// High-speed in-memory cache for albums
let cachedAlbumsJson = null;
let cachedAlbumsTime = 0;
let cachedAlbumsEtag = null;
const ALBUMS_CACHE_TTL = 60 * 1000;

function invalidateAlbumsCache() {
  cachedAlbumsJson = null;
  cachedAlbumsTime = 0;
  cachedAlbumsEtag = null;
}

// Get all albums
router.get('/', async (req, res) => {
  try {
    const isDefault = !req.query.artist;
    const clientEtag = req.headers['if-none-match'];

    if (isDefault && cachedAlbumsJson && (Date.now() - cachedAlbumsTime < ALBUMS_CACHE_TTL)) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      if (cachedAlbumsEtag) {
        res.setHeader('ETag', cachedAlbumsEtag);
        if (clientEtag && (clientEtag === cachedAlbumsEtag || clientEtag === `W/${cachedAlbumsEtag}`)) {
          return res.status(304).end();
        }
      }
      return res.send(cachedAlbumsJson);
    }
    let filter = {};
    if (req.query.artist) {
      const rawArt = req.query.artist.trim();
      const escaped = rawArt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flexible = escaped.replace(/[-_\s]+/g, '[-_\\s]*');
      filter = {
        $or: [
          { artist: new RegExp(flexible, 'i') },
          { name: new RegExp(flexible, 'i') }
        ]
      };
    }
    const albums = await Album.find(filter).sort({ updatedAt: -1 }).lean();
    const formatted = albums.map(a => {
      const explicitCount = Number(a.trackCount || 0);
      const arrCount = Array.isArray(a.trackIds) ? a.trackIds.length : (Array.isArray(a.tracks) ? a.tracks.length : 0);
      const trackCount = explicitCount > 0 ? explicitCount : arrCount;
      const name = String(a.name || a.title || '').toLowerCase().trim();
      let releaseType = a.releaseType;
      if (!releaseType) {
        if (name.endsWith('- single') || name.endsWith('(single)') || trackCount === 1) {
          releaseType = 'single';
        } else if (name.endsWith('- ep') || name.endsWith('(ep)') || (trackCount >= 2 && trackCount <= 6)) {
          releaseType = 'ep';
        } else {
          releaseType = 'album';
        }
      }
      return {
        ...a,
        title: a.title || a.name || 'Untitled Album',
        name: a.name || a.title || 'Untitled Album',
        releaseType,
        trackCount,
        songsCount: trackCount,
        tracks: a.tracks || []
      };
    });
    const includeSingles = req.query.includeSingles === 'true';
    const finalAlbums = formatted.filter(a => {
      // Never return empty albums with 0 tracks
      const hasTracks = (a.trackCount > 0) || (Array.isArray(a.tracks) && a.tracks.length > 0) || (Array.isArray(a.trackIds) && a.trackIds.length > 0);
      if (!hasTracks) return false;
      if (!includeSingles && (a.releaseType === 'single' || a.trackCount <= 1)) return false;
      return true;
    });

    if (isDefault) {
      cachedAlbumsJson = JSON.stringify({ success: true, albums: finalAlbums });
      cachedAlbumsTime = Date.now();
      cachedAlbumsEtag = `"${crypto.createHash('md5').update(cachedAlbumsJson).digest('hex')}"`;

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.setHeader('ETag', cachedAlbumsEtag);

      if (clientEtag && (clientEtag === cachedAlbumsEtag || clientEtag === `W/${cachedAlbumsEtag}`)) {
        return res.status(304).end();
      }
      return res.send(cachedAlbumsJson);
    }

    return res.json({ success: true, albums: finalAlbums });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Admin / User: Album Metadata Auto-Lookup (iTunes API & Link Scraper)
router.get('/lookup', async (req, res) => {
  try {
    const { query, url } = req.query;
    if (!query && !url) {
      return res.status(400).json({ success: false, error: 'Query or URL is required' });
    }

    if (url && (url.includes('spotify.com') || url.includes('youtube.com') || url.includes('youtu.be') || url.includes('music.apple.com'))) {
      const scraped = await scrapePlaylistOrAlbum(url.trim());
      return res.json({
        success: true,
        name: scraped.title,
        artist: scraped.artist,
        cover: scraped.cover,
        releaseDate: scraped.releaseDate || new Date().getFullYear().toString(),
        genre: classifyGenre({ title: scraped.title, artist: scraped.artist, genre: scraped.genre }).genre,
        tracks: (scraped.items || []).map(t => ({
          title: t.title,
          artist: t.artist || scraped.artist,
          duration: t.duration || 180,
          cover: t.cover || scraped.cover
        }))
      });
    }

    const searchTerm = (query || '').trim();
    const itunesRes = await axios.get('https://itunes.apple.com/search', {
      params: {
        term: searchTerm,
        entity: 'album',
        limit: 5
      },
      timeout: 10000
    });

    const albumResult = itunesRes.data?.results?.[0];
    if (!albumResult) {
      return res.status(404).json({ success: false, error: 'No album metadata found for this search' });
    }

    let highResCover = albumResult.artworkUrl100 || '';
    if (highResCover) {
      highResCover = highResCover.replace(/\/\d+x\d+bb\./, '/1200x1200bb.');
    }

    const releaseYear = albumResult.releaseDate ? new Date(albumResult.releaseDate).getFullYear().toString() : new Date().getFullYear().toString();

    let tracks = [];
    try {
      const lookupRes = await axios.get('https://itunes.apple.com/lookup', {
        params: {
          id: albumResult.collectionId,
          entity: 'song'
        },
        timeout: 10000
      });
      const results = lookupRes.data?.results || [];
      tracks = results.filter(r => r.wrapperType === 'track').map(r => ({
        title: r.trackName,
        artist: r.artistName || albumResult.artistName,
        duration: Math.round((r.trackTimeMillis || 180000) / 1000),
        trackNumber: r.trackNumber,
        cover: highResCover
      }));
    } catch (lookupErr) {
      console.warn('iTunes album track lookup notice:', lookupErr.message);
    }

    return res.json({
      success: true,
      name: albumResult.collectionName,
      artist: albumResult.artistName,
      cover: highResCover,
      releaseDate: releaseYear,
      genre: classifyGenre({ title: albumResult.collectionName, artist: albumResult.artistName, genre: albumResult.primaryGenreName }).genre,
      trackCount: albumResult.trackCount,
      tracks
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message || 'Album lookup failed' });
  }
});

// Admin / System: Trigger auto-fix for all album covers to official HD square artwork (Admin only)
router.post('/auto-fix', adminAuth, async (req, res) => {
  try {
    const io = req.app.get('io') || req.io;
    await autoFixAlbumCovers(io);
    res.json({ success: true, message: 'All album covers auto-fixed with official HD artwork' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Get Album Details by ID or Name
router.get('/:id', async (req, res) => {
  try {
    const rawId = req.params.id;
    let album = null;
    if (mongoose.isValidObjectId(rawId)) {
      album = await Album.findById(rawId).lean();
    }
    if (!album) {
      const cleanName = rawId.replace(/^album-/i, '').replace(/[-_]/g, ' ').trim();
      const strippedId = rawId.replace(/^album-/i, '');
      const prefixedId = `album-${strippedId}`;
      album = await Album.findOne({
        $or: [
          { id: rawId },
          { id: strippedId },
          { id: prefixedId },
          { name: new RegExp(`^${rawId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          { name: new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        ]
      }).lean();
    }
    if (!album) return res.status(404).json({ success: false, error: 'Album not found' });

    const trackIds = Array.isArray(album.trackIds) ? album.trackIds : [];
    const validObjectIds = trackIds.filter(id => mongoose.isValidObjectId(id));

    const orConditions = [];
    if (validObjectIds.length > 0) orConditions.push({ _id: { $in: validObjectIds } });
    if (trackIds.length > 0) orConditions.push({ id: { $in: trackIds } });
    if (album.name && album.name.trim()) {
      orConditions.push({ album: new RegExp(`^${album.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });
    }

    const tracks = orConditions.length > 0
      ? await Track.find({ $or: orConditions }).lean()
      : [];

    const formattedTracks = tracks.map(t => ({
      id: String(t._id || t.id),
      _id: String(t._id || t.id),
      ...t
    }));

    const albumNameNorm = (album.name || album.title || '').trim().toLowerCase();
    const seenIds = new Set();
    const seenTitles = new Set();
    const validTracks = [];
    const bogusTrackIds = [];

    for (const t of formattedTracks) {
      if (!t) continue;
      const tid = String(t._id || t.id || '');
      const audioUrl = String(t.audioUrl || '');
      if (audioUrl.includes('watch?v=PL') || (t.videoId && String(t.videoId).startsWith('PL'))) {
        if (tid) bogusTrackIds.push(tid);
        continue;
      }
      if (t.album && albumNameNorm && t.album.trim().toLowerCase() !== albumNameNorm) {
        continue;
      }
      const normTitle = String(t.title || '').trim().toLowerCase().replace(/[/\\?%*:|"<>_()\-]/g, ' ').replace(/\s+/g, ' ').trim();
      if (tid && seenIds.has(tid)) continue;
      if (normTitle && seenTitles.has(normTitle)) continue;
      if (tid) seenIds.add(tid);
      if (normTitle) seenTitles.add(normTitle);
      validTracks.push(t);
    }

    // Merge embedded official tracks from album.tracks if present
    if (Array.isArray(album.tracks) && album.tracks.length > 0) {
      for (const et of album.tracks) {
        if (!et || !et.title) continue;
        const normTitle = String(et.title).trim().toLowerCase().replace(/[/\\?%*:|"<>_()\-]/g, ' ').replace(/\s+/g, ' ').trim();
        if (normTitle && !seenTitles.has(normTitle)) {
          seenTitles.add(normTitle);
          const fullTrack = {
            id: et.id || `track-${album._id}-${validTracks.length + 1}`,
            _id: et.id || `track-${album._id}-${validTracks.length + 1}`,
            title: et.title,
            artist: et.artist || album.artist,
            album: album.name || album.title,
            cover: et.cover || album.cover,
            duration: Number(et.duration) || 180,
            trackNumber: et.trackNumber || (validTracks.length + 1),
            genre: album.genre || 'Arabic',
            source: 'official_album_tracklist',
            isSystem: true
          };
          validTracks.push(fullTrack);
        }
      }
    }

    if (bogusTrackIds.length > 0) {
      Track.deleteMany({ _id: { $in: bogusTrackIds } }).catch(() => {});
    }

    const cleanTrackIds = validTracks.map(t => String(t._id || t.id));
    if (album.trackIds && album.trackIds.length !== cleanTrackIds.length) {
      Album.updateOne({ _id: album._id }, { $set: { trackIds: cleanTrackIds } }).catch(() => {});
      invalidateAlbumsCache();
    }

    const formattedAlbum = {
      ...album,
      title: album.title || album.name || 'Untitled Album',
      name: album.name || album.title || 'Untitled Album',
      trackCount: validTracks.length,
      songsCount: validTracks.length,
      tracks: validTracks,
      trackIds: cleanTrackIds
    };
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ success: true, album: formattedAlbum, tracks: validTracks });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Admin: Create / Upload Album
const createAlbumHandler = async (req, res) => {
  invalidateAlbumsCache();
  try {
    const { name, artist, cover, linkUrl, releaseDate, genre, trackIds = [], isQuran = false, description = '' } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Album name is required' });
    }
    if (!artist || !artist.trim()) {
      return res.status(400).json({ success: false, error: 'Artist name is required' });
    }

    const cleanName = name.trim();
    const cleanArtist = artist.trim();
    const cleanTrackIds = Array.isArray(trackIds) ? trackIds.map(String) : [];

    const newAlbum = new Album({
      id: `album-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: cleanName,
      artist: cleanArtist,
      cover: cover ? cover.trim() : 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
      linkUrl: linkUrl ? linkUrl.trim() : '',
      trackIds: cleanTrackIds,
      releaseDate: releaseDate ? releaseDate.trim() : '',
      genre: Boolean(isQuran) ? 'Holy Quran' : classifyGenre({ title: name, artist, genre, description }).genre,
      isAlbum: true,
      isSystem: true,
      isPublic: true,
      isQuran: Boolean(isQuran),
      description: description ? description.trim() : '',
      source: 'admin_upload',
      createdBy: req.user?.id || req.user?.name || 'admin'
    });

    await newAlbum.save();

    if (cleanTrackIds.length > 0) {
      await Track.updateMany(
        { _id: { $in: cleanTrackIds } },
        { $set: { album: cleanName } }
      ).catch(() => {});
    }

    const io = req.app.get('io') || req.io;
    if (io) io.emit('album:created', newAlbum);
    res.json({ success: true, album: newAlbum });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};
router.post('/', adminAuth, createAlbumHandler);
router.post('/create', adminAuth, createAlbumHandler);

// Admin: Import Album from YouTube / Spotify Link
const importAlbumHandler = (req, res) => handleImportAlbum(req, res, { invalidateAlbumsCache });
router.post('/import', adminAuth, importAlbumHandler);

// Admin: Edit / Update Album Details
const updateAlbumHandler = async (req, res) => {
  invalidateAlbumsCache();
  try {
    const albumId = req.params.id;
    const { name, artist, cover, linkUrl, releaseDate, genre, trackIds } = req.body;
    const album = await Album.findOne({ $or: [{ id: albumId }, { _id: mongoose.isValidObjectId(albumId) ? albumId : null }] });
    if (!album) return res.status(404).json({ success: false, error: 'Album not found' });

    const oldName = album.name;
    if (name) album.name = name.trim();
    if (artist) album.artist = artist.trim();
    if (cover !== undefined) album.cover = cover.trim();
    if (linkUrl !== undefined) album.linkUrl = linkUrl.trim();
    if (releaseDate !== undefined) album.releaseDate = releaseDate;
    if (genre !== undefined) album.genre = genre;
    if (Array.isArray(trackIds)) album.trackIds = trackIds;

    await album.save();

    if (name && oldName && name.trim().toLowerCase() !== oldName.trim().toLowerCase()) {
      await Track.updateMany(
        { album: { $regex: new RegExp(`^${escapeRegex(oldName)}$`, 'i') } },
        { $set: { album: name.trim() } }
      ).catch(() => {});
    }

    const io = req.app.get('io') || req.io;
    if (io) io.emit('album:updated', album);
    res.json({ success: true, album });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};
router.put('/:id', adminAuth, updateAlbumHandler);
router.post('/:id/update', adminAuth, updateAlbumHandler);

// Admin: Delete Album
const deleteAlbumHandler = (req, res) => handleDeleteAlbum(req, res, { invalidateAlbumsCache });
router.delete('/:id', adminAuth, deleteAlbumHandler);
router.post('/:id/delete', adminAuth, deleteAlbumHandler);

// Auto-cleanup any bogus tracks mistakenly imported from YouTube sidebar playlists
setTimeout(async () => {
  try {
    const bogusTracks = await Track.find({
      $or: [
        { audioUrl: /watch\?v=PL/i },
        { audioUrl: /youtube\.com\/watch\?v=PL/i }
      ]
    }).lean();

    if (bogusTracks.length > 0) {
      const bogusIds = bogusTracks.map(t => String(t._id || t.id));
      await Track.deleteMany({ _id: { $in: bogusIds } });
      await Album.updateMany(
        { trackIds: { $in: bogusIds } },
        { $pull: { trackIds: { $in: bogusIds } } }
      );
      invalidateAlbumsCache();
      console.log(`[Auto-Clean] Purged ${bogusIds.length} bogus YouTube playlist entries from database.`);
    }
  } catch (err) {
    console.warn('[Auto-Clean] Notice:', err.message);
  }
}, 5000);

module.exports = router;
