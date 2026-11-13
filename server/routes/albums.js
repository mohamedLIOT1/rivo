const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto');
const { Album, Track } = require('../models');
const { adminAuth } = require('../middleware/auth');
const { isQuranContent } = require('../utils/helpers');
const { handleImportAlbum, handleDeleteAlbum } = require('./albums/albumAdminService');
const { handleAlbumLookup } = require('./albums/albumLookupService');
const { createAlbumHandler, updateAlbumHandler } = require('./albums/albumCrudService');
const { curateFeaturedAlbums } = require('./albums/albumCurator');

// High-speed in-memory cache for albums
let cachedAlbumsJson = null;
let cachedAlbumsTime = 0;
let cachedAlbumsEtag = null;

let cachedFeaturedJson = null;
let cachedFeaturedTime = 0;
let cachedFeaturedEtag = null;

const ALBUMS_CACHE_TTL = 60 * 1000;

function invalidateAlbumsCache() {
  cachedAlbumsJson = null;
  cachedAlbumsTime = 0;
  cachedAlbumsEtag = null;
  cachedFeaturedJson = null;
  cachedFeaturedTime = 0;
  cachedFeaturedEtag = null;
}

// GET /api/albums - List albums with slim projection by default or top 16 curated releases
router.get('/', async (req, res) => {
  try {
    const isFeatured = req.query.featured === 'true';
    const includeTracks = req.query.includeTracks === 'true';
    const includeSingles = req.query.includeSingles === 'true';
    const hasArtist = Boolean(req.query.artist);
    const isDefault = !hasArtist && !includeTracks && !includeSingles && !isFeatured;
    const clientEtag = req.headers['if-none-match'];

    // 1. In-memory cache hit for default album list
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

    // 2. In-memory cache hit for featured curated list
    if (isFeatured && !hasArtist && !includeTracks && cachedFeaturedJson && (Date.now() - cachedFeaturedTime < ALBUMS_CACHE_TTL)) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      if (cachedFeaturedEtag) {
        res.setHeader('ETag', cachedFeaturedEtag);
        if (clientEtag && (clientEtag === cachedFeaturedEtag || clientEtag === `W/${cachedFeaturedEtag}`)) {
          return res.status(304).end();
        }
      }
      return res.send(cachedFeaturedJson);
    }

    // Base query filter
    const filter = {
      isQuran: { $ne: true },
      genre: { $nin: ['Holy Quran', 'Quran', 'Quran Recitation'] }
    };

    if (hasArtist) {
      const rawArt = req.query.artist.trim();
      const escaped = rawArt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const flexible = escaped.replace(/[-_\s]+/g, '[-_\\s]*');
      filter.$or = [
        { artist: new RegExp(flexible, 'i') },
        { name: new RegExp(flexible, 'i') }
      ];
    }

    // Slim projection: strictly excludes the heavy embedded `tracks` array unless includeTracks=true
    const projection = includeTracks
      ? null
      : { id: 1, name: 1, artist: 1, cover: 1, releaseDate: 1, genre: 1, releaseType: 1, trackCount: 1, isVerified: 1, isQuran: 1, trackIds: 1 };

    const albums = await Album.find(filter, projection).sort({ updatedAt: -1 }).lean();

    const formatted = albums.map(a => {
      const explicitCount = Number(a.trackCount || 0);
      const arrCount = Array.isArray(a.trackIds) ? a.trackIds.length : (Array.isArray(a.tracks) ? a.tracks.length : 0);
      const trackCount = explicitCount > 0 ? explicitCount : arrCount;
      const name = String(a.name || a.title || 'Untitled Album');
      const lowerName = name.toLowerCase().trim();

      let releaseType = a.releaseType;
      if (!releaseType) {
        if (lowerName.endsWith('- single') || lowerName.endsWith('(single)') || trackCount === 1) {
          releaseType = 'single';
        } else if (lowerName.endsWith('- ep') || lowerName.endsWith('(ep)') || (trackCount >= 2 && trackCount <= 6)) {
          releaseType = 'ep';
        } else {
          releaseType = 'album';
        }
      }

      // If full tracks are requested, keep rich fields
      if (includeTracks) {
        return {
          id: a.id || String(a._id),
          _id: a._id,
          name,
          title: name,
          artist: a.artist || '',
          cover: a.cover || '',
          releaseDate: a.releaseDate || '',
          genre: a.genre || '',
          releaseType,
          trackCount,
          songsCount: trackCount,
          isVerified: Boolean(a.isVerified),
          isQuran: Boolean(a.isQuran),
          tracks: a.tracks || [],
          trackIds: a.trackIds || []
        };
      }

      // Default slim projection: ONLY return the required lightweight metadata fields
      return {
        id: a.id || String(a._id),
        name,
        artist: a.artist || '',
        cover: a.cover || '',
        releaseDate: a.releaseDate || '',
        genre: a.genre || '',
        releaseType,
        trackCount,
        isVerified: Boolean(a.isVerified),
        isQuran: Boolean(a.isQuran)
      };
    });

    const finalAlbums = formatted.filter(a => {
      // Strictly isolate Quran content from music albums
      if (a.isQuran || a.genre === 'Holy Quran' || a.genre === 'Quran') return false;
      const rawName = String(a.name || '');
      if (isQuranContent(rawName, a.artist, rawName, a.genre)) return false;

      // Strictly isolate 1-track single items from music albums grid
      const count = Number(a.trackCount || 0);
      if (!includeSingles && (a.releaseType === 'single' || count <= 1)) return false;

      // Never return empty albums with 0 tracks
      if (count === 0 && (!a.tracks || a.tracks.length === 0)) return false;

      return true;
    });

    // Support ?featured=true to return top 16 curated releases
    if (isFeatured) {
      const featured = curateFeaturedAlbums(finalAlbums, { limit: 16 });
      cachedFeaturedJson = JSON.stringify({ success: true, albums: featured });
      cachedFeaturedTime = Date.now();
      cachedFeaturedEtag = `"${crypto.createHash('md5').update(cachedFeaturedJson).digest('hex')}"`;

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.setHeader('ETag', cachedFeaturedEtag);

      if (clientEtag && (clientEtag === cachedFeaturedEtag || clientEtag === `W/${cachedFeaturedEtag}`)) {
        return res.status(304).end();
      }
      return res.send(cachedFeaturedJson);
    }

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
router.get('/lookup', handleAlbumLookup);

// Get Album Details by ID or Name (resolves full tracks)
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
    if (album.isQuran || album.genre === 'Holy Quran' || album.genre === 'Quran' || isQuranContent(album.name, album.artist)) {
      return res.status(404).json({ success: false, error: 'Quran recitation is not accessible via music albums API' });
    }

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
router.post('/', adminAuth, (req, res) => createAlbumHandler(req, res, { invalidateAlbumsCache }));
router.post('/create', adminAuth, (req, res) => createAlbumHandler(req, res, { invalidateAlbumsCache }));

// Admin: Import Album from Link
router.post('/import', adminAuth, (req, res) => handleImportAlbum(req, res, { invalidateAlbumsCache }));

// Admin: Edit / Update Album
router.put('/:id', adminAuth, (req, res) => updateAlbumHandler(req, res, { invalidateAlbumsCache }));
router.post('/:id/update', adminAuth, (req, res) => updateAlbumHandler(req, res, { invalidateAlbumsCache }));

// Admin: Delete Album
router.delete('/:id', adminAuth, (req, res) => handleDeleteAlbum(req, res, { invalidateAlbumsCache }));
router.post('/:id/delete', adminAuth, (req, res) => handleDeleteAlbum(req, res, { invalidateAlbumsCache }));

module.exports = router;
