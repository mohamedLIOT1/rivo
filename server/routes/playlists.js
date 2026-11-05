const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { User, Album } = require('../models');
const { auth, isAdminUser, JWT_SECRET } = require('../middleware/auth');
const { sanitizeText } = require('../utils/security');
const { upload } = require('../middleware/upload');
const {
  importPlaylistFromUrl,
  resolvePlaylistDetails,
  savePlaylistToLibrary
} = require('./playlists/playlistService');

// Import playlist from YouTube/Spotify
router.post('/import', auth, async (req, res) => {
  try {
    const result = await importPlaylistFromUrl({
      url: req.body.url,
      isQuran: req.body.isQuran,
      userId: req.user.id
    });
    return res.status(result.status).json(result.data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get playlist by ID
router.get('/:id', async (req, res) => {
  try {
    const plId = String(req.params.id || '');
    let authUserId = null;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
        authUserId = decoded?.id;
      }
    } catch {}

    const result = await resolvePlaylistDetails({ plId, authUserId });
    return res.status(result.status).json(result.data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create new playlist
router.post('/create', auth, async (req, res) => {
  try {
    const u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ error: 'User not found' });

    const cleanName = sanitizeText(req.body.name).slice(0, 100) || 'Untitled Playlist';
    let cleanCover = (req.body.cover || '').trim();
    if (cleanCover.toLowerCase().startsWith('javascript:') || cleanCover.toLowerCase().startsWith('data:text/html')) {
      cleanCover = '';
    }
    const isMix = Boolean(req.body.isMix || (cleanName && cleanName.toUpperCase().includes('MIX')));
    const trackIds = Array.isArray(req.body.trackIds) ? req.body.trackIds.map(String) : [];
    const newPl = {
      id: `pl-${Date.now()}`,
      name: cleanName,
      cover: cleanCover,
      trackIds: trackIds,
      isLikedSongs: false,
      isPublic: req.body.isPublic !== false,
      isQuran: Boolean(req.body.isQuran),
      isMix: isMix
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
    if (req.body.name) pl.name = sanitizeText(req.body.name).slice(0, 100);
    if (req.body.description !== undefined) pl.description = sanitizeText(req.body.description).slice(0, 300);
    if (req.body.cover !== undefined && typeof req.body.cover === 'string') {
      const cov = req.body.cover.trim();
      if (!cov.toLowerCase().startsWith('javascript:') && !cov.toLowerCase().startsWith('data:text/html')) {
        pl.cover = cov.slice(0, 2048);
      }
    }
    if (Array.isArray(req.body.trackIds)) {
      pl.trackIds = req.body.trackIds.map(String);
    }
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
    const result = await savePlaylistToLibrary({
      targetId: String(req.params.id),
      bodyPlaylist: req.body?.playlist,
      bodyTracks: req.body?.tracks,
      action: req.body?.action,
      userId: req.user.id,
      bodyArtist: req.body?.artist
    });
    return res.status(result.status).json(result.data);
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

    if (!pl && isAdminUser(req.user)) {
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

    if (isAdminUser(req.user)) {
      try {
        const alb = await Album.findOne({ $or: [{ id: targetId }, { _id: mongoose.isValidObjectId(targetId) ? targetId : undefined }] });
        if (alb) {
          alb.cover = coverUrl;
          await alb.save();
        }
      } catch {}
    }

    if (!pl) {
      return res.status(403).json({ success: false, error: 'You do not own this playlist' });
    }

    pl.cover = coverUrl;
    u.markModified('playlists');
    await u.save();
    return res.json({ success: true, cover: coverUrl, playlist: pl });
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
