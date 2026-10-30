const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { User, Track } = require('../models');
const { auth, optionalAuth, isVerifiedUser } = require('../middleware/auth');
const discordActivity = require('../discordActivity');

function escapeRegex(s) {
  return (s || '').replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

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
    const rawId = req.params.id;
    let target = null;
    if (mongoose.isValidObjectId(rawId)) {
      target = await User.findById(rawId)
        .select('_id name avatar bio playlists followers following createdAt')
        .lean();
    }
    if (!target) {
      target = await User.findOne({ $or: [{ id: rawId }, { name: rawId }] })
        .select('_id name avatar bio playlists followers following createdAt')
        .lean();
    }
    if (!target) return res.status(404).json({ error: 'User not found' });

    const currentUserId = req.user?.id ? String(req.user.id) : '';
    const isFollowing = currentUserId ? (target.followers || []).map(String).includes(currentUserId) : false;
    const rawPublicPlaylists = (target.playlists || []).filter(p => p.isPublic !== false && !p.isLikedSongs);

    const allTrackIds = [];
    rawPublicPlaylists.forEach(p => {
      (p.trackIds || []).forEach(tid => {
        if (tid && !allTrackIds.includes(String(tid))) allTrackIds.push(String(tid));
      });
    });

    let trackMap = new Map();
    if (allTrackIds.length > 0) {
      const validObjIds = allTrackIds.filter(id => mongoose.isValidObjectId(id));
      const dbTracks = await Track.find({
        $or: [
          ...(validObjIds.length > 0 ? [{ _id: { $in: validObjIds } }] : []),
          { id: { $in: allTrackIds } }
        ]
      }).lean();
      dbTracks.forEach(t => {
        const tId = String(t._id || t.id);
        const formatted = { id: tId, _id: tId, ...t };
        trackMap.set(tId, formatted);
        if (t.id) trackMap.set(String(t.id), formatted);
      });
    }

    const publicPlaylists = rawPublicPlaylists.map(p => {
      const pTracks = (p.trackIds || []).map(tid => trackMap.get(String(tid))).filter(Boolean);
      return {
        ...p,
        ownerId: String(target._id),
        ownerName: target.name,
        trackCount: (p.trackIds || []).length,
        tracks: pTracks
      };
    });

    res.json({
      success: true,
      user: {
        id: String(target._id),
        _id: String(target._id),
        name: target.name,
        avatar: target.avatar,
        bio: target.bio || '',
        createdAt: target.createdAt,
        publicPlaylists,
        playlistCount: publicPlaylists.length,
        followersCount: (target.followers || []).length,
        followingCount: (target.following || []).length,
        isFollowing,
        isVerified: isVerifiedUser(target.name)
      }
    });
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
    let friends = [];
    const currentUserId = req.user?.id;

    if (currentUserId) {
      const me = await User.findById(currentUserId).lean();
      if (me && me.following && me.following.length > 0) {
        const objectIds = me.following.map(id => {
          try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
        }).filter(Boolean);

        const followedUsers = await User.find({
          $or: [
            { _id: { $in: objectIds } },
            { _id: { $in: me.following } }
          ]
        })
          .select('_id name avatar bio currentListening lastActiveAt updatedAt isVerified')
          .lean();

        friends = followedUsers.map(u => {
          const uId = String(u._id);
          const isOnline = Boolean(req.userSocketMap?.has(uId) && req.userSocketMap.get(uId).size > 0);
          const lastActivityTime = new Date(u.currentListening?.updatedAt || u.lastActiveAt || u.updatedAt || 0).getTime();
          const isRecent = (Date.now() - lastActivityTime) < 300000;
          const isLive = Boolean(isOnline && u.currentListening?.isPlaying && isRecent);

          return {
            id: uId,
            name: u.name,
            avatar: u.avatar || '',
            bio: u.bio || '',
            isVerified: isVerifiedUser(u.name),
            currentListening: u.currentListening || null,
            lastActiveAt: u.lastActiveAt || u.updatedAt || null,
            isOnline: isOnline || isLive,
            isLive
          };
        });
      }
    }

    // Community Active Listeners Fallback:
    // If the user has no friends currently active or has not followed anyone yet,
    // show other active listeners on Rivo so the activity panel is never dead or zeroed out!
    if (friends.length === 0) {
      const excludeIds = [];
      if (currentUserId && mongoose.isValidObjectId(currentUserId)) {
        try { excludeIds.push(new mongoose.Types.ObjectId(String(currentUserId))); } catch {}
      }

      const activeCommunity = await User.find({
        ...(excludeIds.length > 0 ? { _id: { $nin: excludeIds } } : {}),
        $or: [
          { 'currentListening.isPlaying': true },
          { 'currentListening.title': { $exists: true, $ne: '' } },
          { lastActiveAt: { $gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) } }
        ]
      })
      .sort({ 'currentListening.isPlaying': -1, lastActiveAt: -1 })
      .limit(8)
      .select('_id name avatar bio currentListening lastActiveAt isVerified')
      .lean();

      if (activeCommunity.length > 0) {
        friends = activeCommunity.map(u => {
          const uId = String(u._id);
          const isOnline = Boolean(req.userSocketMap?.has(uId) && req.userSocketMap.get(uId).size > 0);
          const isLive = Boolean(u.currentListening?.isPlaying);

          return {
            id: uId,
            name: u.name,
            avatar: u.avatar || '',
            bio: u.bio || '',
            isVerified: isVerifiedUser(u.name),
            currentListening: u.currentListening || null,
            lastActiveAt: u.lastActiveAt || null,
            isOnline: isOnline || isLive,
            isLive,
            isCommunity: true
          };
        });
      }
    }

    res.json({ success: true, activities: friends });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/listening-activity', auth, async (req, res) => {
  try {
    const { track, isPlaying, currentTime } = req.body;
    const now = new Date();
    const curSec = Math.max(0, Number(currentTime) || 0);
    const updateData = {
      lastActiveAt: now,
      currentListening: track ? {
        id: track.id || track._id,
        title: track.title,
        artist: track.artist,
        cover: track.cover,
        audioUrl: track.audioUrl,
        duration: track.duration,
        isPlaying: Boolean(isPlaying),
        currentTime: curSec,
        updatedAt: now
      } : null
    };

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
        isLive: Boolean(isPlaying && isOnline)
      });
    }

    try { discordActivity.handleUserListening(user, track, isPlaying, curSec); } catch (e) {}

    res.json({ success: true, currentListening: user.currentListening });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Followers
router.get('/:id/followers', optionalAuth, async (req, res) => {
  try {
    const rawId = req.params.id;
    let target = null;
    if (mongoose.isValidObjectId(rawId)) {
      target = await User.findById(rawId).select('_id followers').lean();
    }
    if (!target) {
      target = await User.findOne({ $or: [{ id: rawId }, { name: rawId }] }).select('_id followers').lean();
    }
    if (!target) return res.status(404).json({ error: 'User not found' });

    const rawIds = (target.followers || []).map(f => {
      if (!f) return null;
      if (typeof f === 'object' && f._id) return String(f._id);
      return String(f);
    }).filter(Boolean);

    const validObjectIds = rawIds.filter(id => mongoose.isValidObjectId(id));
    const objectIdList = validObjectIds.map(id => {
      try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
    }).filter(Boolean);

    const followerUsers = await User.find({
      $or: [
        { _id: { $in: objectIdList } },
        { _id: { $in: validObjectIds } },
        { id: { $in: rawIds } },
        { name: { $in: rawIds } }
      ]
    }).select('_id name avatar bio').lean();

    // If ghost IDs exist (users were deleted), automatically sync database array
    if (target._id && followerUsers.length !== (target.followers || []).length) {
      await User.findByIdAndUpdate(target._id, { $set: { followers: followerUsers.map(u => u._id) } }).catch(() => {});
    }

    const followers = followerUsers.map(f => ({
      id: String(f._id),
      _id: String(f._id),
      name: f.name,
      avatar: f.avatar || '',
      bio: f.bio || '',
      isVerified: isVerifiedUser(f.name)
    }));
    res.json({ success: true, followers, count: followers.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Following
router.get('/:id/following', optionalAuth, async (req, res) => {
  try {
    const rawId = req.params.id;
    let target = null;
    if (mongoose.isValidObjectId(rawId)) {
      target = await User.findById(rawId).select('_id following').lean();
    }
    if (!target) {
      target = await User.findOne({ $or: [{ id: rawId }, { name: rawId }] }).select('_id following').lean();
    }
    if (!target) return res.status(404).json({ error: 'User not found' });

    const rawIds = (target.following || []).map(f => {
      if (!f) return null;
      if (typeof f === 'object' && f._id) return String(f._id);
      return String(f);
    }).filter(Boolean);

    const validObjectIds = rawIds.filter(id => mongoose.isValidObjectId(id));
    const objectIdList = validObjectIds.map(id => {
      try { return new mongoose.Types.ObjectId(String(id)); } catch { return null; }
    }).filter(Boolean);

    const followingUsers = await User.find({
      $or: [
        { _id: { $in: objectIdList } },
        { _id: { $in: validObjectIds } },
        { id: { $in: rawIds } },
        { name: { $in: rawIds } }
      ]
    }).select('_id name avatar bio').lean();

    // If ghost IDs exist (users were deleted), automatically sync database array
    if (target._id && followingUsers.length !== (target.following || []).length) {
      await User.findByIdAndUpdate(target._id, { $set: { following: followingUsers.map(u => u._id) } }).catch(() => {});
    }

    const following = followingUsers.map(f => ({
      id: String(f._id),
      _id: String(f._id),
      name: f.name,
      avatar: f.avatar || '',
      bio: f.bio || '',
      isVerified: isVerifiedUser(f.name)
    }));
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
