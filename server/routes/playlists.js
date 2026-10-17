const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { User, Track, Album } = require('../models');
const { auth, isAdminUser, JWT_SECRET } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const {
  scrapePlaylistOrAlbum,
  isQuranContent,
  detectQuranReciter,
  searchYouTubeId,
  fetchTrackCover
} = require('../utils/helpers');

// Import playlist from YouTube/Spotify
router.post('/import', auth, async (req, res) => {
  try {
    const { url, isQuran } = req.body;
    if (!url) return res.status(400).json({ error: 'Playlist URL is required' });

    let scraped;
    try {
      scraped = await scrapePlaylistOrAlbum(url);
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Failed to scrape playlist link' });
    }

    if (!scraped || !scraped.items || scraped.items.length === 0) {
      return res.status(400).json({ error: 'Could not extract tracks from playlist. Please verify the link is public.' });
    }

    const playlistTitle = scraped.title || 'Imported Playlist';
    const playlistCover = scraped.cover;
    const isAlbum = scraped.isAlbum;
    const rawItems = scraped.items;

    const finalIsQuran = Boolean(isQuran || isQuranContent(playlistTitle, '', '', ''));
    const detectedPlaylistReciter = finalIsQuran ? detectQuranReciter(playlistTitle, scraped.artist, '', '') : null;
    const trackIds = [];
    const createdTracks = [];
    const tracksToInsert = [];

    for (const item of rawItems) {
      try {
        const duration = item.duration || 180;
        const ytId = item.videoId || (item.audioUrl ? null : await searchYouTubeId(`${item.artist} - ${item.title}`));
        let trackCover = item.cover || (item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : null);
        if (!trackCover && !item.videoId) trackCover = await fetchTrackCover(item.title, item.artist);
        if (!trackCover && ytId) trackCover = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
        if (!trackCover) trackCover = playlistCover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';

        const audioUrl = item.audioUrl || (ytId ? `https://www.youtube.com/watch?v=${ytId}` : '');
        const itemIsQuran = Boolean(finalIsQuran || isQuranContent(item.title, item.artist, playlistTitle, ''));
        const finalAlbumName = isAlbum ? playlistTitle : (item.album || '');

        let trackArtist = item.artist;
        if (itemIsQuran) {
          const itemReciter = detectQuranReciter(item.title, item.artist, finalAlbumName) || detectedPlaylistReciter;
          if (itemReciter) {
            trackArtist = itemReciter;
          }
        }

        tracksToInsert.push({
          title: item.title,
          artist: trackArtist,
          album: finalAlbumName,
          cover: trackCover,
          audioUrl,
          duration,
          genre: itemIsQuran ? 'Quran' : 'Imported',
          source: item.videoId ? 'YouTube' : 'Spotify',
          addedBy: req.user.id,
          isQuran: itemIsQuran
        });
      } catch (itemErr) {
        console.warn('Playlist item import error:', itemErr.message);
      }
    }

    if (mongoose.connection.readyState === 1 && tracksToInsert.length > 0) {
      try {
        const inserted = await Track.insertMany(tracksToInsert, { ordered: false });
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

    if (createdTracks.length === 0) {
      for (const t of tracksToInsert) {
        const tid = `track-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        trackIds.push(tid);
        createdTracks.push({ id: tid, _id: tid, ...t });
      }
    }

    const playlistId = `pl-${Date.now()}`;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const newPlaylist = {
      id: playlistId,
      name: playlistTitle,
      cover: playlistCover || createdTracks[0]?.cover || '',
      trackIds,
      isLikedSongs: false,
      isPublic: true,
      isQuran: finalIsQuran
    };

    user.playlists.push(newPlaylist);
    await user.save();

    res.json({
      success: true,
      playlist: {
        ...newPlaylist,
        tracks: createdTracks
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get playlist by ID
router.get('/:id', async (req, res) => {
  try {
    const plId = String(req.params.id || '');
    if (!plId) return res.status(400).json({ error: 'Playlist ID is required' });

    let authUserId = null;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        authUserId = decoded?.id;
      }
    } catch {}

    const isLikedReq = plId.toLowerCase().includes('liked');
    const isObjId = mongoose.isValidObjectId(plId);
    let owner;
    if (isLikedReq) {
      owner = await User.findById(authUserId || plId).select('name avatar playlists likedTrackIds');
    } else {
      owner = await User.findOne({
        $or: [
          { 'playlists.id': plId },
          ...(isObjId ? [{ 'playlists._id': new mongoose.Types.ObjectId(plId) }] : [])
        ]
      }).select('name avatar playlists likedTrackIds');
    }

    if (!owner) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    const pl = (owner.playlists || []).find(p =>
      String(p.id) === plId ||
      String(p._id) === plId ||
      (isLikedReq && (p.isLikedSongs || p.name === 'Liked Songs'))
    );

    if (!pl && !(isLikedReq && owner.likedTrackIds)) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    // IDOR / Privacy protection: If private, require playlist owner or admin
    const isOwner = authUserId && (String(owner._id) === String(authUserId));
    if (pl && pl.isPublic === false && !isOwner) {
      return res.status(403).json({ error: 'This playlist is private' });
    }

    const isLiked = Boolean(
      isLikedReq ||
      pl?.isLikedSongs ||
      pl?.name === 'Liked Songs' ||
      String(pl?.id || '').startsWith('liked')
    );

    let rawList = [];
    if (isLiked) {
      rawList = owner.likedTrackIds || [];
    } else if (pl) {
      rawList = (Array.isArray(pl.tracks) && pl.tracks.length > 0)
        ? pl.tracks
        : (Array.isArray(pl.trackIds) ? pl.trackIds : []);
    }

    let orderedTracks = [];
    if (rawList.length > 0 && typeof rawList[0] === 'object' && rawList[0].title) {
      orderedTracks = rawList;
    } else {
      const rawIds = rawList.map(item => (item && typeof item === 'object') ? String(item._id || item.id) : String(item)).filter(Boolean);
      const validObjectIds = rawIds.filter(id => mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(id));

      let populatedTracks = [];
      if (validObjectIds.length > 0) {
        populatedTracks = await Track.find({
          $or: [
            { _id: { $in: validObjectIds } },
            { id: { $in: rawIds } }
          ]
        }).lean();
      } else if (rawIds.length > 0) {
        populatedTracks = await Track.find({ id: { $in: rawIds } }).lean();
      }

      const trackMap = new Map();
      populatedTracks.forEach(t => {
        if (t._id) trackMap.set(String(t._id), t);
        if (t.id) trackMap.set(String(t.id), t);
      });
      orderedTracks = rawIds.map(id => trackMap.get(id)).filter(Boolean);
    }

    res.json({
      success: true,
      playlist: {
        id: pl?.id || (isLiked ? 'liked' : (pl?._id || plId)),
        _id: pl?._id || pl?.id || plId,
        name: pl?.name || (isLiked ? 'Liked Songs' : 'Playlist'),
        cover: pl?.cover || (orderedTracks[0]?.coverUrl || orderedTracks[0]?.cover || ''),
        ownerName: owner.name,
        ownerAvatar: owner.avatar,
        isPublic: pl ? pl.isPublic !== false : true,
        isQuran: Boolean(pl?.isQuran),
        isLikedSongs: isLiked,
        trackIds: orderedTracks.map(t => String(t._id || t.id)),
        tracks: orderedTracks,
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create new playlist
router.post('/create', auth, async (req, res) => {
  try {
    const u = await User.findById(req.user.id);
    const newPl = {
      id: `pl-${Date.now()}`,
      name: req.body.name,
      cover: req.body.cover || '',
      trackIds: [],
      isLikedSongs: false,
      isPublic: req.body.isPublic !== false,
      isQuran: Boolean(req.body.isQuran)
    };
    u.playlists.push(newPl);
    await u.save();
    res.json({ success: true, playlist: newPl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add track to playlist
router.post('/:id/add-track', auth, async (req, res) => {
  try {
    let u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ error: 'User not found' });
    let pl = u.playlists.find(p => String(p.id || p._id) === String(req.params.id));
    if (!pl && isAdminUser(req.user)) {
      u = await User.findOne({ $or: [{ 'playlists.id': req.params.id }, { 'playlists._id': req.params.id }] });
      if (u) {
        pl = u.playlists.find(p => String(p.id || p._id) === String(req.params.id));
      }
    }
    if (!pl) return res.status(403).json({ error: 'You do not own this playlist' });
    const trackIdStr = String(req.body.trackId);
    if (req.body.allowDuplicate || !pl.trackIds.map(String).includes(trackIdStr)) {
      pl.trackIds.push(trackIdStr);
    }
    await u.save();
    res.json({ success: true, trackIds: pl.trackIds });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Remove track from playlist
const removeTrackHandler = async (req, res) => {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ error: 'Unauthorized' });
    const playlistId = String(req.params.id || '');
    const trackIdStr = String(req.body.trackId || req.params.trackId || '');
    if (!trackIdStr) return res.status(400).json({ error: 'trackId required' });

    let u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ error: 'User not found' });

    let pl = u.playlists.find(p => String(p.id || p._id) === playlistId);
    if (!pl && isAdminUser(req.user)) {
      const isPlObjId = mongoose.isValidObjectId(playlistId);
      u = await User.findOne(isPlObjId
        ? { $or: [{ 'playlists.id': playlistId }, { 'playlists._id': new mongoose.Types.ObjectId(playlistId) }] }
        : { 'playlists.id': playlistId }
      );
      if (u) {
        pl = u.playlists.find(p => String(p.id || p._id) === playlistId);
      }
    }
    if (!pl) return res.status(403).json({ error: 'You do not own this playlist' });

    pl.trackIds = (pl.trackIds || []).filter(id => String(id) !== trackIdStr);
    await u.save();
    res.json({ success: true, trackIds: pl.trackIds });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
router.post('/:id/remove-track', auth, removeTrackHandler);
router.delete('/:id/tracks/:trackId', auth, removeTrackHandler);

// Update playlist details
router.post('/:id/update', auth, async (req, res) => {
  try {
    let u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ success: false, error: 'User not found' });
    let pl = u.playlists.find(p => String(p.id || p._id) === String(req.params.id));
    if (!pl && isAdminUser(req.user)) {
      const isReqObjId = mongoose.isValidObjectId(req.params.id);
      u = await User.findOne(isReqObjId
        ? { $or: [{ 'playlists.id': req.params.id }, { 'playlists._id': new mongoose.Types.ObjectId(req.params.id) }] }
        : { 'playlists.id': req.params.id }
      );
      if (u) {
        pl = u.playlists.find(p => String(p.id || p._id) === String(req.params.id));
      }
    }
    if (!pl) return res.status(403).json({ success: false, error: 'You do not own this playlist' });
    if (req.body.name) pl.name = req.body.name;
    if (req.body.description !== undefined) pl.description = req.body.description;
    if (req.body.cover !== undefined) pl.cover = req.body.cover;
    if (req.body.isPublic !== undefined) pl.isPublic = Boolean(req.body.isPublic);
    u.markModified('playlists');
    await u.save();
    res.json({ success: true, isPublic: pl.isPublic, playlist: pl });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Toggle visibility (public / private)
router.post('/:id/toggle-visibility', auth, async (req, res) => {
  try {
    let u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ success: false, error: 'User not found' });
    let pl = u.playlists.find(p => String(p.id) === String(req.params.id) || String(p._id) === String(req.params.id));
    if (!pl && isAdminUser(req.user)) {
      const isReqObjId = mongoose.isValidObjectId(req.params.id);
      u = await User.findOne(isReqObjId
        ? { $or: [{ 'playlists.id': req.params.id }, { 'playlists._id': new mongoose.Types.ObjectId(req.params.id) }] }
        : { 'playlists.id': req.params.id }
      );
      if (u) {
        pl = u.playlists.find(p => String(p.id) === String(req.params.id) || String(p._id) === String(req.params.id));
      }
    }
    if (!pl) return res.status(403).json({ success: false, error: 'You do not own this playlist' });
    pl.isPublic = pl.isPublic === false ? true : false;
    u.markModified('playlists');
    await u.save();
    res.json({ success: true, isPublic: pl.isPublic, playlist: pl, playlists: u.playlists });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Delete playlist
router.delete('/:id', auth, async (req, res) => {
  try {
    const targetId = String(req.params.id);
    let u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ error: 'User not found' });
    const initialLen = u.playlists.length;
    u.playlists = u.playlists.filter(p =>
      String(p.id) !== targetId &&
      String(p._id) !== targetId &&
      String(p.sourcePlaylistId || '') !== targetId
    );
    if (u.playlists.length === initialLen) {
      if (isAdminUser(req.user)) {
        const isTargetObjId = mongoose.isValidObjectId(targetId);
        const owner = await User.findOne(isTargetObjId
          ? { $or: [{ 'playlists.id': targetId }, { 'playlists._id': new mongoose.Types.ObjectId(targetId) }] }
          : { 'playlists.id': targetId }
        );
        if (owner) {
          owner.playlists = owner.playlists.filter(p =>
            String(p.id) !== targetId &&
            String(p._id) !== targetId &&
            String(p.sourcePlaylistId || '') !== targetId
          );
          owner.markModified('playlists');
          await owner.save();
          return res.json({ success: true });
        }
      }
      return res.status(403).json({ error: 'Playlist not found or not owned by you' });
    }
    u.markModified('playlists');
    await u.save();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Save another user's public playlist into current user's library
router.post('/:id/save', auth, async (req, res) => {
  try {
    const targetId = String(req.params.id);
    const { action, playlist: bodyPlaylist, tracks: bodyTracks } = req.body || {};
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    const isTargetObjId = mongoose.isValidObjectId(targetId);
    let sourceOwner = await User.findOne(isTargetObjId
      ? { $or: [{ 'playlists.id': targetId }, { 'playlists._id': new mongoose.Types.ObjectId(targetId) }] }
      : { 'playlists.id': targetId }
    ).select('_id name avatar playlists').lean();

    let sourcePlaylist = sourceOwner?.playlists?.find(p => String(p.id || p._id) === targetId);

    if (!sourcePlaylist) {
      const cleanTargetName = targetId.replace(/^album-/i, '').replace(/[-_]/g, ' ').trim();
      const album = await Album.findOne({
        $or: [
          { id: targetId },
          ...(isTargetObjId ? [{ _id: new mongoose.Types.ObjectId(targetId) }] : []),
          { name: new RegExp(`^${targetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          { name: new RegExp(`^${cleanTargetName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
        ]
      }).lean();
      if (album) {
        sourcePlaylist = {
          id: album.id || String(album._id),
          name: album.name || album.title || 'Saved Album',
          cover: album.cover || '',
          description: album.description || `Album by ${album.artist || 'Various Artists'}`,
          trackIds: album.trackIds || [],
          isPublic: true,
          isAlbum: true
        };
      }
    }

    if (!sourcePlaylist && bodyPlaylist) {
      const altId = String(bodyPlaylist.id || bodyPlaylist._id || '');
      if (altId && altId !== targetId) {
        const isAltObjId = mongoose.isValidObjectId(altId);
        const altOwner = await User.findOne(isAltObjId
          ? { $or: [{ 'playlists.id': altId }, { 'playlists._id': new mongoose.Types.ObjectId(altId) }] }
          : { 'playlists.id': altId }
        ).select('_id name avatar playlists').lean();
        if (altOwner) {
          sourceOwner = altOwner;
          sourcePlaylist = altOwner.playlists?.find(p => String(p.id || p._id) === altId);
        }
      }
      if (!sourcePlaylist) {
        sourcePlaylist = bodyPlaylist;
      }
    }

    if (!sourcePlaylist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    if (sourcePlaylist.isPublic === false && sourceOwner?._id && String(sourceOwner._id) !== String(currentUser._id)) {
      return res.status(403).json({ error: 'Cannot save a private playlist' });
    }

    const existingIndex = (currentUser.playlists || []).findIndex(p =>
      String(p.sourcePlaylistId || '') === targetId ||
      String(p.id || '') === targetId ||
      (isTargetObjId && String(p._id || '') === targetId) ||
      (bodyPlaylist?.id && String(p.sourcePlaylistId || '') === String(bodyPlaylist.id)) ||
      (bodyPlaylist?._id && String(p.sourcePlaylistId || '') === String(bodyPlaylist._id))
    );

    // Support explicit action: 'save' vs 'unsave'
    if (action === 'unsave') {
      if (existingIndex >= 0) {
        currentUser.playlists.splice(existingIndex, 1);
        currentUser.markModified('playlists');
        await currentUser.save();
      }
      return res.json({
        success: true,
        removed: true,
        saved: false,
        playlists: currentUser.playlists
      });
    }

    if (action === 'save') {
      if (existingIndex >= 0) {
        return res.json({
          success: true,
          alreadySaved: true,
          saved: true,
          playlist: currentUser.playlists[existingIndex],
          playlists: currentUser.playlists
        });
      }
    } else {
      // Toggle behavior if no explicit action
      if (existingIndex >= 0) {
        currentUser.playlists.splice(existingIndex, 1);
        currentUser.markModified('playlists');
        await currentUser.save();
        return res.json({
          success: true,
          removed: true,
          saved: false,
          playlists: currentUser.playlists
        });
      }
    }

    // Determine track IDs
    let trackIds = [];
    if (Array.isArray(bodyTracks) && bodyTracks.length > 0) {
      trackIds = bodyTracks.map(t => (t && typeof t === 'object') ? String(t._id || t.id) : String(t)).filter(Boolean);
    } else if (Array.isArray(sourcePlaylist.trackIds) && sourcePlaylist.trackIds.length > 0) {
      trackIds = sourcePlaylist.trackIds.map(t => (t && typeof t === 'object') ? String(t._id || t.id) : String(t)).filter(Boolean);
    } else if (Array.isArray(sourcePlaylist.tracks) && sourcePlaylist.tracks.length > 0) {
      trackIds = sourcePlaylist.tracks.map(t => (t && typeof t === 'object') ? String(t._id || t.id) : String(t)).filter(Boolean);
    } else if (bodyPlaylist && Array.isArray(bodyPlaylist.trackIds) && bodyPlaylist.trackIds.length > 0) {
      trackIds = bodyPlaylist.trackIds.map(t => (t && typeof t === 'object') ? String(t._id || t.id) : String(t)).filter(Boolean);
    } else if (bodyPlaylist && Array.isArray(bodyPlaylist.tracks) && bodyPlaylist.tracks.length > 0) {
      trackIds = bodyPlaylist.tracks.map(t => (t && typeof t === 'object') ? String(t._id || t.id) : String(t)).filter(Boolean);
    }

    const resolvedOwnerName = sourceOwner?.name || req.body?.artist || bodyPlaylist?.ownerName || bodyPlaylist?.artist || 'Listener';
    const newId = `pl-saved-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const savedPlaylist = {
      id: newId,
      name: sourcePlaylist.name || bodyPlaylist?.name || 'Saved Playlist',
      cover: sourcePlaylist.cover || bodyPlaylist?.cover || '',
      description: sourcePlaylist.description || (resolvedOwnerName ? `Saved from ${resolvedOwnerName}` : 'Saved playlist'),
      trackIds: Array.from(new Set(trackIds)),
      isPublic: false,
      isLikedSongs: false,
      isQuran: Boolean(sourcePlaylist.isQuran || bodyPlaylist?.isQuran),
      sourcePlaylistId: targetId,
      sourceOwnerName: resolvedOwnerName,
      sourceOwnerId: sourceOwner?._id ? String(sourceOwner._id) : (bodyPlaylist?.ownerId ? String(bodyPlaylist.ownerId) : ''),
      createdAt: new Date()
    };

    currentUser.playlists.push(savedPlaylist);
    currentUser.markModified('playlists');
    await currentUser.save();

    res.json({
      success: true,
      saved: true,
      playlist: savedPlaylist,
      playlists: currentUser.playlists
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Unsave / remove a saved playlist from user's library
router.post('/:id/unsave', auth, async (req, res) => {
  try {
    const targetId = String(req.params.id);
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    const isTargetObjId = mongoose.isValidObjectId(targetId);
    const initialLen = currentUser.playlists.length;
    currentUser.playlists = currentUser.playlists.filter(p =>
      String(p.sourcePlaylistId || '') !== targetId &&
      String(p.id || '') !== targetId &&
      (!isTargetObjId || String(p._id || '') !== targetId)
    );
    currentUser.markModified('playlists');
    await currentUser.save();

    res.json({
      success: true,
      removed: currentUser.playlists.length < initialLen,
      saved: false,
      playlists: currentUser.playlists
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Upload playlist cover image
router.post('/:id/upload-cover', auth, (req, res, next) => {
  upload.single('cover')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No image uploaded' });
    const coverUrl = `/uploads/${req.file.filename}`;
    const targetId = String(req.params.id);

    let u = await User.findById(req.user.id);
    let pl = u ? u.playlists.find(p => String(p.id || p._id) === targetId) : null;

    if (!pl) {
      const isTargetObjId = mongoose.isValidObjectId(targetId);
      const anyUser = await User.findOne(isTargetObjId
        ? { $or: [{ 'playlists.id': targetId }, { 'playlists._id': new mongoose.Types.ObjectId(targetId) }] }
        : { 'playlists.id': targetId }
      );
      if (anyUser) {
        u = anyUser;
        pl = u.playlists.find(p => String(p.id || p._id) === targetId);
      }
    }

    try {
      const alb = await Album.findOne({ $or: [{ id: targetId }, { _id: mongoose.isValidObjectId(targetId) ? targetId : undefined }] });
      if (alb) {
        alb.cover = coverUrl;
        await alb.save();
      }
    } catch {}

    if (pl && u) {
      pl.cover = coverUrl;
      u.markModified('playlists');
      await u.save();
      return res.json({ success: true, cover: coverUrl, playlist: pl });
    }

    res.json({ success: true, cover: coverUrl });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Playlist transitions
router.post('/:id/transitions', auth, async (req, res) => {
  try {
    const { transitions, isMix } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const pl = user.playlists.find(p => String(p.id || p._id) === String(req.params.id));
    if (!pl) return res.status(403).json({ error: 'You do not own this playlist' });

    if (transitions !== undefined) pl.transitions = transitions;
    if (isMix !== undefined) pl.isMix = Boolean(isMix);
    user.markModified('playlists');
    await user.save();

    res.json({ success: true, transitions: pl.transitions, isMix: pl.isMix });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
