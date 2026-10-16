const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { User, Track, Album } = require('../models');
const { adminAuth, isAdminUser, isVerifiedUser } = require('../middleware/auth');

// Analytics Endpoint
router.get('/analytics', adminAuth, async (req, res) => {
  try {
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const [
      totalUsers, newUsersWeek, newUsersMonth,
      totalTracks, onlineNow
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      User.countDocuments({ createdAt: { $gte: monthAgo } }),
      Track.countDocuments(),
      User.countDocuments({ lastActiveAt: { $gte: new Date(now - 5 * 60 * 1000) } })
    ]);
    const topListeners = await User.find()
      .sort({ totalListeningSeconds: -1 })
      .limit(5)
      .select('name avatar totalListeningSeconds isVerified');
    res.json({
      success: true,
      data: { totalUsers, newUsersWeek, newUsersMonth, totalTracks, onlineNow, topListeners }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Broadcast Message Endpoint
router.post('/broadcast', adminAuth, (req, res) => {
  const { message, type = 'info' } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  if (req.io) {
    req.io.emit('system:broadcast', { message, type, timestamp: Date.now() });
  }
  res.json({ success: true, sent: true });
});

// View all users
router.get('/users', adminAuth, async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 }).lean();
    const formatted = users.map(u => ({
      id: String(u._id),
      _id: String(u._id),
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      bio: u.bio || '',
      role: isAdminUser(u) ? 'admin' : (u.role || 'user'),
      isAdmin: isAdminUser(u),
      isVerified: isVerifiedUser(u),
      playlistsCount: (u.playlists || []).length,
      likedSongsCount: (u.likedTrackIds || []).length,
      followersCount: (u.followers || []).length,
      followingCount: (u.following || []).length,
      createdAt: u.createdAt || (u._id && mongoose.Types.ObjectId.isValid(u._id) ? u._id.getTimestamp() : new Date())
    }));
    res.json({ success: true, users: formatted, total: formatted.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user role or verified status
router.patch('/users/:id/role', adminAuth, async (req, res) => {
  try {
    const { role, isVerified } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (role !== undefined) {
      user.role = role === 'admin' ? 'admin' : 'user';
      user.isAdmin = user.role === 'admin' || isAdminUser(user);
    }
    if (isVerified !== undefined) {
      user.isVerified = Boolean(isVerified);
    }
    await user.save();
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all playlists across website
router.get('/playlists', adminAuth, async (req, res) => {
  try {
    const users = await User.find({ 'playlists.0': { $exists: true } }, 'name username email playlists').lean();
    const allPlaylists = [];
    for (const u of users) {
      for (const pl of u.playlists || []) {
        allPlaylists.push({
          ...pl,
          id: pl.id || String(pl._id),
          ownerId: String(u._id),
          ownerName: u.name || u.username || 'User',
          ownerEmail: u.email
        });
      }
    }
    res.json({ success: true, playlists: allPlaylists });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Get all albums across website
router.get('/albums', adminAuth, async (req, res) => {
  try {
    const albums = await Album.find().sort({ updatedAt: -1 }).lean();
    res.json({ success: true, albums });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

module.exports = router;
