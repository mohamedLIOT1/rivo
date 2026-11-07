const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { User } = require('../models');
const { auth, optionalAuth, isVerifiedUser } = require('../middleware/auth');
const discordActivity = require('../discordActivity');
const {
  escapeRegex,
  fetchUserProfileData,
  fetchFollowersList,
  fetchFollowingList,
  fetchListeningActivities
} = require('./users/userHelpers');

// Search users by name only (privacy preserved)
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    let queryFilter = {};

    if (q) {
      if (q.length < 2) return res.json({ success: true, users: [] });
      queryFilter = { name: { $regex: escapeRegex(q), $options: 'i' } };
    }

    const users = await User.find(queryFilter)
      .select('_id name avatar bio playlists followers following')
      .limit(24)
      .lean();

    const sanitized = users.map(u => ({
      id: String(u._id),
      name: u.name,
      avatar: u.avatar,
      bio: u.bio || '',
      publicPlaylists: (u.playlists || []).filter(p => p.isPublic !== false && !p.isLikedSongs),
      followersCount: (u.followers || []).length,
      followingCount: (u.following || []).length,
      isVerified: isVerifiedUser(u.name)
    }));

    res.json({ success: true, users: sanitized });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// User profile
router.get('/:id/profile', optionalAuth, async (req, res) => {
  try {
    const profile = await fetchUserProfileData(req.params.id, req.user?.id);
    if (!profile) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user: profile });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Follow user
router.post('/:id/follow', auth, async (req, res) => {
  try {
    const rawId = req.params.id;
    let target = null;
    if (mongoose.isValidObjectId(rawId)) {
      target = await User.findById(rawId);
    }
    if (!target) {
      target = await User.findOne({ $or: [{ id: rawId }, { name: rawId }] });
    }
    if (!target) return res.status(404).json({ error: 'User not found' });

    const targetId = String(target._id);
    const currentUserId = String(req.user.id);
    if (targetId === currentUserId) return res.status(400).json({ error: 'Cannot follow yourself' });

    await User.findByIdAndUpdate(targetId, { $addToSet: { followers: currentUserId } });
    await User.findByIdAndUpdate(currentUserId, { $addToSet: { following: targetId } });

    const updatedTarget = await User.findById(targetId);
    res.json({
      success: true,
      isFollowing: true,
      followersCount: (updatedTarget.followers || []).length
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Unfollow user
router.post('/:id/unfollow', auth, async (req, res) => {
  try {
    const rawId = req.params.id;
    let target = null;
    if (mongoose.isValidObjectId(rawId)) {
      target = await User.findById(rawId);
    }
    if (!target) {
      target = await User.findOne({ $or: [{ id: rawId }, { name: rawId }] });
    }
    if (!target) return res.status(404).json({ error: 'User not found' });

    const targetId = String(target._id);
    const currentUserId = String(req.user.id);

    await User.findByIdAndUpdate(targetId, { $pull: { followers: currentUserId } });
    await User.findByIdAndUpdate(currentUserId, { $pull: { following: targetId } });

    const updatedTarget = await User.findById(targetId);
    res.json({
      success: true,
      isFollowing: false,
      followersCount: (updatedTarget.followers || []).length
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Friends list
router.get('/friends', auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).lean();
    const friendIds = me?.following || [];
    const friends = await User.find({ _id: { $in: friendIds } })
      .select('_id name avatar bio')
      .lean();
    res.json({
      success: true,
      friends: friends.map(f => ({
        id: String(f._id),
        name: f.name,
        avatar: f.avatar,
        bio: f.bio || '',
        isVerified: isVerifiedUser(f.name)
      }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Listening activity
router.get('/listening-activity', optionalAuth, async (req, res) => {
  try {
    const activities = await fetchListeningActivities(req.user?.id, req.userSocketMap);
    res.json({ success: true, activities });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/listening-activity', auth, async (req, res) => {
  try {
    const { track, isPlaying, currentTime } = req.body;
    const now = new Date();
    const curSec = Math.max(0, Number(currentTime) || 0);

    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    let updatedListening = null;
    const hasNewTrack = track && (track.title || track.name);

    if (hasNewTrack) {
      updatedListening = {
        id: track.id || track._id || currentUser.currentListening?.id,
        title: track.title || track.name,
        artist: track.artist || currentUser.currentListening?.artist || '',
        cover: track.cover || track.coverUrl || currentUser.currentListening?.cover || '',
        audioUrl: track.audioUrl || currentUser.currentListening?.audioUrl || '',
        duration: track.duration || currentUser.currentListening?.duration || 0,
        isPlaying: Boolean(isPlaying),
        currentTime: curSec,
        updatedAt: now
      };
    } else if (currentUser.currentListening && (currentUser.currentListening.title || currentUser.currentListening.name)) {
      // Preserve existing track details, only mark isPlaying: false
      updatedListening = {
        id: currentUser.currentListening.id,
        title: currentUser.currentListening.title,
        artist: currentUser.currentListening.artist || '',
        cover: currentUser.currentListening.cover || '',
        audioUrl: currentUser.currentListening.audioUrl || '',
        duration: currentUser.currentListening.duration || 0,
        isPlaying: false,
        currentTime: curSec || currentUser.currentListening.currentTime || 0,
        updatedAt: now
      };
    }

    const updateData = {
      lastActiveAt: now
    };
    if (updatedListening) {
      updateData.currentListening = updatedListening;
    }

    const user = await User.findByIdAndUpdate(req.user.id, { $set: updateData }, { new: true });
    const uidStr = String(user._id);
    const isOnline = Boolean(req.userSocketMap?.has(uidStr) && req.userSocketMap.get(uidStr).size > 0);
    
    if (req.io) {
      req.io.emit('activity:updated', {
        userId: uidStr,
        name: user.name,
        avatar: user.avatar,
        currentListening: user.currentListening,
        lastActiveAt: user.lastActiveAt,
        isOnline,
        isLive: Boolean(user.currentListening?.isPlaying)
      });
    }

    try { discordActivity.handleUserListening(user, track || user.currentListening, isPlaying, curSec); } catch (e) {}

    res.json({ success: true, currentListening: user.currentListening });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Followers
router.get('/:id/followers', optionalAuth, async (req, res) => {
  try {
    const followers = await fetchFollowersList(req.params.id);
    if (!followers) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, followers, count: followers.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Following
router.get('/:id/following', optionalAuth, async (req, res) => {
  try {
    const following = await fetchFollowingList(req.params.id);
    if (!following) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, following, count: following.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// User Preferences (Language, Content Customization Modes)
router.get('/preferences', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('preferences');
    if (!user) return res.status(404).json({ error: 'User not found' });
    const defaultPrefs = {
      language: 'ar',
      contentModes: { music: true, quran: true, podcasts: true, audiobooks: true }
    };
    res.json({ success: true, preferences: user.preferences || defaultPrefs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/preferences', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (!user.preferences) {
      user.preferences = {
        language: 'ar',
        contentModes: { music: true, quran: true, podcasts: true, audiobooks: true }
      };
    }

    if (req.body.language && ['ar', 'en'].includes(req.body.language)) {
      user.preferences.language = req.body.language;
    }

    if (req.body.contentModes && typeof req.body.contentModes === 'object') {
      user.preferences.contentModes = {
        ...user.preferences.contentModes,
        ...req.body.contentModes
      };
    }

    user.markModified('preferences');
    await user.save();

    res.json({ success: true, preferences: user.preferences });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
