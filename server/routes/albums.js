const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const axios = require('axios');
const { Album, Track, User } = require('../models');
const { adminAuth } = require('../middleware/auth');
const {
  scrapePlaylistOrAlbum,
  isQuranContent,
  detectQuranReciter,
  searchYouTubeId,
  fetchTrackCover,
  autoFixAlbumCovers,
  escapeRegex
} = require('../utils/helpers');

// High-speed in-memory cache for albums
let cachedAlbumsJson = null;
let cachedAlbumsTime = 0;
const ALBUMS_CACHE_TTL = 60 * 1000;

function invalidateAlbumsCache() {
  cachedAlbumsJson = null;
  cachedAlbumsTime = 0;
}

// Get all albums
router.get('/', async (req, res) => {
  try {
    if (cachedAlbumsJson && (Date.now() - cachedAlbumsTime < ALBUMS_CACHE_TTL)) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.send(cachedAlbumsJson);
    }
    const albums = await Album.find().sort({ updatedAt: -1 }).lean();
    const formatted = albums.map(a => {
      const trackCount = Array.isArray(a.trackIds) ? a.trackIds.length : (Array.isArray(a.tracks) ? a.tracks.length : 0);
      return {
        ...a,
        title: a.title || a.name || 'Untitled Album',
        name: a.name || a.title || 'Untitled Album',
        trackCount,
        songsCount: trackCount,
        tracks: a.tracks || []
      };
    });
    cachedAlbumsJson = JSON.stringify({ success: true, albums: formatted });
    cachedAlbumsTime = Date.now();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.send(cachedAlbumsJson);
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
        genre: scraped.genre || 'Pop',
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
      genre: albumResult.primaryGenreName || 'Pop',
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
      album = await Album.findOne({
        $or: [
          { id: rawId },
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
    const formattedAlbum = {
      ...album,
      title: album.title || album.name || 'Untitled Album',
      name: album.name || album.title || 'Untitled Album',
      trackCount: formattedTracks.length,
      songsCount: formattedTracks.length,
      tracks: formattedTracks,
      trackIds: album.trackIds && album.trackIds.length > 0 ? album.trackIds : formattedTracks.map(t => t.id)
    };
    res.json({ success: true, album: formattedAlbum, tracks: formattedTracks });
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
      genre: genre ? genre.trim() : 'Pop',
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
const importAlbumHandler = async (req, res) => {
  invalidateAlbumsCache();
  try {
    const { url, name, artist, cover, releaseDate, genre, isQuran, description } = req.body;
    if (!url || !url.trim()) {
      return res.status(400).json({ success: false, error: 'A valid Spotify album or YouTube playlist link is required' });
    }

    const cleanUrl = url.trim();
    let scraped;
    try {
      scraped = await scrapePlaylistOrAlbum(cleanUrl);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message || 'Failed to scrape album link' });
    }

    if (!scraped || !scraped.items || scraped.items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Could not extract tracks from the provided link. Please ensure it is a public Spotify album or YouTube playlist.' 
      });
    }

    const albumName = (name && name.trim()) || scraped.title || 'Imported Album';
    const albumArtist = (artist && artist.trim()) || scraped.artist || 'Unknown Artist';
    const albumCover = (cover && cover.trim()) || scraped.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';
    const finalIsQuran = Boolean(
      isQuran !== undefined 
        ? isQuran 
        : isQuranContent(albumName, albumArtist, '', '') || scraped.items.every(t => isQuranContent(t.title, t.artist || albumArtist))
    );
    const detectedAlbumReciter = finalIsQuran ? detectQuranReciter(albumName, albumArtist, '', '') : null;

    const trackIds = [];
    const createdTracks = [];
    const tracksToInsert = [];

    for (const item of scraped.items) {
      try {
        const duration = item.duration || 180;
        const ytId = item.videoId || (item.audioUrl ? null : await searchYouTubeId(`${item.artist || albumArtist} - ${item.title}`));
        let trackCover = item.cover || (item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : null);
        if (!trackCover && !item.videoId) trackCover = await fetchTrackCover(item.title, item.artist || albumArtist);
        if (!trackCover && ytId) trackCover = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
        if (!trackCover) trackCover = albumCover;

        const audioUrl = item.audioUrl || (ytId ? `https://www.youtube.com/watch?v=${ytId}` : '');
        let trackArtist = (item.artist && item.artist !== 'Artist') ? item.artist : albumArtist;
        const itemIsQuran = Boolean(finalIsQuran || isQuranContent(item.title, trackArtist, albumName, ''));
        if (itemIsQuran) {
          const itemReciter = detectQuranReciter(item.title, trackArtist, albumName) || detectedAlbumReciter;
          if (itemReciter) {
            trackArtist = itemReciter;
          }
        }

        tracksToInsert.push({
          title: item.title,
          artist: trackArtist,
          album: albumName,
          cover: trackCover,
          audioUrl,
          duration,
          genre: itemIsQuran ? 'Quran' : (genre ? genre.trim() : 'Pop'),
          source: item.videoId ? 'YouTube' : 'Spotify',
          isQuran: itemIsQuran
        });
      } catch (itemErr) {
        console.warn('Track import item error:', itemErr.message);
      }
    }

    if (mongoose.connection.readyState === 1 && tracksToInsert.length > 0) {
      const trulyNewTracks = [];
      for (const t of tracksToInsert) {
        let existing = null;
        if (t.audioUrl && t.audioUrl.length > 10) {
          existing = await Track.findOne({ audioUrl: t.audioUrl }).lean();
        }
        if (!existing && t.title && t.artist) {
          existing = await Track.findOne({
            title: new RegExp(`^${escapeRegex(t.title)}$`, 'i'),
            artist: new RegExp(`^${escapeRegex(t.artist)}$`, 'i')
          }).lean();
        }
        if (existing) {
          const tid = String(existing._id);
          trackIds.push(tid);
          createdTracks.push({
            id: tid,
            _id: tid,
            ...existing
          });
        } else {
          trulyNewTracks.push(t);
        }
      }

      if (trulyNewTracks.length > 0) {
        try {
          const inserted = await Track.insertMany(trulyNewTracks, { ordered: false });
          for (const t of inserted) {
            const tid = String(t._id);
            trackIds.push(tid);
            createdTracks.push({
              id: tid,
              _id: tid,
              title: t.title,
              artist: t.artist,
              album: t.album,
              cover: t.cover,
              audioUrl: t.audioUrl,
              duration: t.duration,
              genre: t.genre,
              source: t.source,
              isQuran: t.isQuran
            });
          }
        } catch (insertErr) {
          if (insertErr.insertedDocs && insertErr.insertedDocs.length > 0) {
            for (const t of insertErr.insertedDocs) {
              const tid = String(t._id);
              trackIds.push(tid);
              createdTracks.push({
                id: tid,
                _id: tid,
                title: t.title,
                artist: t.artist,
                album: t.album,
                cover: t.cover,
                audioUrl: t.audioUrl,
                duration: t.duration,
                genre: t.genre,
                source: t.source,
                isQuran: t.isQuran
              });
            }
          }
        }
      }
    }

    if (createdTracks.length === 0) {
      for (const t of tracksToInsert) {
        const tid = `track-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        trackIds.push(tid);
        createdTracks.push({ id: tid, _id: tid, ...t });
      }
    }

    const newAlbum = new Album({
      id: `album-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: albumName,
      artist: albumArtist,
      cover: albumCover,
      trackIds: trackIds,
      releaseDate: releaseDate ? releaseDate.trim() : new Date().getFullYear().toString(),
      genre: finalIsQuran ? 'Quran' : (genre ? genre.trim() : 'Pop'),
      isAlbum: true,
      isSystem: true,
      isPublic: true,
      isQuran: finalIsQuran,
      description: description ? description.trim() : '',
      source: 'link_import',
      createdBy: req.user?.id || req.user?.name || 'admin'
    });

    await newAlbum.save();

    const io = req.app.get('io') || req.io;
    if (io) io.emit('album:created', newAlbum);
    res.json({
      success: true,
      album: newAlbum,
      tracks: createdTracks
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};
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
const deleteAlbumHandler = async (req, res) => {
  invalidateAlbumsCache();
  try {
    const albumId = req.params.id;
    const deleteTracks = req.body?.deleteTracks !== false;

    let album = await Album.findOne({
      $or: [
        { id: albumId },
        ...(mongoose.isValidObjectId(albumId) ? [{ _id: albumId }] : [])
      ]
    });

    let albumName = album?.name;
    let trackIds = album?.trackIds ? [...album.trackIds] : [];

    if (!album) {
      const decoded = decodeURIComponent(albumId);
      const candidateName = albumId.startsWith('album-')
        ? decodeURIComponent(albumId.replace(/^album-/, '').replace(/-/g, ' '))
        : decoded;

      album = await Album.findOne({
        $or: [
          { name: { $regex: new RegExp(`^${escapeRegex(candidateName)}$`, 'i') } },
          { name: { $regex: new RegExp(`^${escapeRegex(decoded)}$`, 'i') } }
        ]
      });
      if (album) {
        albumName = album.name;
        trackIds = album.trackIds ? [...album.trackIds] : [];
      } else {
        albumName = candidateName;
      }
    }

    const albumDeleteFilter = {
      $or: [
        { id: albumId },
        ...(mongoose.isValidObjectId(albumId) ? [{ _id: albumId }] : []),
        ...(album?._id ? [{ _id: album._id }] : []),
        ...(albumName ? [{ name: { $regex: new RegExp(`^${escapeRegex(albumName)}$`, 'i') } }] : [])
      ]
    };

    const matchingAlbums = await Album.find(albumDeleteFilter).lean();
    for (const a of matchingAlbums) {
      if (Array.isArray(a.trackIds)) {
        trackIds.push(...a.trackIds);
      }
    }
    trackIds = Array.from(new Set(trackIds.map(String)));

    const trackQueries = [];
    if (trackIds.length > 0) {
      trackQueries.push({ _id: { $in: trackIds } });
    }
    if (albumName) {
      trackQueries.push({
        album: { $regex: new RegExp(`^${escapeRegex(albumName)}$`, 'i') }
      });
    }

    let deletedTrackIds = [];
    if (trackQueries.length > 0) {
      const associatedTracks = await Track.find({ $or: trackQueries }).lean();
      deletedTrackIds = associatedTracks.map(t => String(t._id || t.id));

      if (deleteTracks) {
        if (deletedTrackIds.length > 0) {
          await Track.deleteMany({ _id: { $in: deletedTrackIds } });

          const users = await User.find({
            $or: [
              { likedTrackIds: { $in: deletedTrackIds } },
              { 'playlists.trackIds': { $in: deletedTrackIds } }
            ]
          });

          for (const u of users) {
            let changed = false;
            if (u.likedTrackIds && u.likedTrackIds.length > 0) {
              const prevLen = u.likedTrackIds.length;
              u.likedTrackIds = u.likedTrackIds.filter(id => !deletedTrackIds.includes(String(id)));
              if (u.likedTrackIds.length !== prevLen) changed = true;
            }
            if (u.playlists && u.playlists.length > 0) {
              for (const pl of u.playlists) {
                if (pl.trackIds && pl.trackIds.length > 0) {
                  const prevLen = pl.trackIds.length;
                  pl.trackIds = pl.trackIds.filter(id => !deletedTrackIds.includes(String(id)));
                  if (pl.trackIds.length !== prevLen) changed = true;
                }
              }
            }
            if (changed) {
              await u.save();
            }
          }

          const io = req.app.get('io') || req.io;
          if (io) {
            deletedTrackIds.forEach(tId => {
              io.emit('track:deleted', { id: tId });
            });
          }
        }
      } else {
        if (deletedTrackIds.length > 0) {
          await Track.updateMany(
            { _id: { $in: deletedTrackIds } },
            { $set: { album: '' } }
          );
        }
      }
    }

    await Album.deleteMany(albumDeleteFilter);

    const io = req.app.get('io') || req.io;
    if (io) io.emit('album:deleted', { id: albumId, albumName, deletedTrackIds });
    res.json({ success: true, deletedTrackIds, albumName });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};
router.delete('/:id', adminAuth, deleteAlbumHandler);
router.post('/:id/delete', adminAuth, deleteAlbumHandler);

module.exports = router;
