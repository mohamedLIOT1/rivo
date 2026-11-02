const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { auth, makeToken, isAdminUser, isVerifiedUser, revokedTokens } = require('../middleware/auth');
const { sanitizeText } = require('../utils/security');

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Name, email and password must be valid strings' });
    }
    const cleanName = sanitizeText(name).trim();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanName || !cleanEmail || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({ error: 'Invalid email address format' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }
    const existing = await User.findOne({ email: cleanEmail });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName || 'U')}&background=1DB954&color=000&size=512&bold=true&format=png`;

    const isInitAdmin = isAdminUser({ email: cleanEmail });
    const user = await new User({
      name: cleanName,
      email: cleanEmail,
      password: hashed,
      avatar: defaultAvatar,
      bio: '',
      role: isInitAdmin ? 'admin' : 'user',
      isAdmin: isInitAdmin,
      isVerified: isInitAdmin,
      likedTrackIds: [],
      followers: [],
      following: [],
      playlists: [{ id: 'liked', name: 'Liked Songs', trackIds: [], isLikedSongs: true, isPublic: false }]
    }).save();

    const userObj = user.toObject();
    delete userObj.password;
    userObj.isAdmin = isAdminUser(userObj);
    userObj.role = userObj.isAdmin ? 'admin' : (userObj.role || 'user');
    userObj.isVerified = isVerifiedUser(userObj.name);
    res.json({ success: true, user: userObj, token: makeToken(user) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const rawInput = req.body.identifier || req.body.email || req.body.username || '';
    if (typeof rawInput !== 'string' || typeof req.body.password !== 'string') {
      return res.status(400).json({ error: 'Email/username and password must be valid strings' });
    }
    const rawIdentifier = rawInput.trim();
    const { password } = req.body;
    if (!rawIdentifier || !password) {
      return res.status(400).json({ error: 'Email or username and password are required' });
    }

    const isEmail = rawIdentifier.includes('@');
    let user = null;

    if (isEmail) {
      user = await User.findOne({ email: rawIdentifier.toLowerCase() });
    } else {
      user = await User.findOne({
        name: { $regex: new RegExp(`^${rawIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      });
    }

    if (!user) return res.status(400).json({ error: 'User not found' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid password' });

    const userObj = user.toObject();
    delete userObj.password;
    userObj.isAdmin = isAdminUser(userObj);
    userObj.role = userObj.isAdmin ? 'admin' : (userObj.role || 'user');
    userObj.isVerified = isVerifiedUser(userObj.name);
    userObj.followersCount = (user.followers || []).length;
    userObj.followingCount = (user.following || []).length;
    res.json({ success: true, user: userObj, token: makeToken(user) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      revokedTokens.add(token);
      try {
        const decoded = require('jsonwebtoken').decode(token);
        if (decoded?.id) {
          await User.findByIdAndUpdate(decoded.id, { $set: { tokenInvalidBefore: new Date() } });
        }
      } catch {}
    }
    res.json({ success: true, message: 'Logged out successfully.' });
  } catch (e) {
    res.json({ success: true });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.avatar && user.avatar.includes('format=svg')) {
      user.avatar = user.avatar.replace('format=svg', 'format=png');
    }
    const userObj = user.toObject ? user.toObject() : { ...user._doc };
    userObj.isAdmin = isAdminUser(userObj);
    userObj.role = userObj.isAdmin ? 'admin' : (userObj.role || 'user');
    userObj.isVerified = isVerifiedUser(userObj.name);
    userObj.followersCount = (user.followers || []).length;
    userObj.followingCount = (user.following || []).length;
    res.json({ success: true, user: userObj });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/update-profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (req.body.name !== undefined) {
      if (typeof req.body.name !== 'string') return res.status(400).json({ error: 'Name must be a string' });
      const cleanName = sanitizeText(req.body.name).trim();
      if (!cleanName) return res.status(400).json({ error: 'Name cannot be empty' });
      user.name = cleanName.slice(0, 100);
    }
    if (req.body.bio !== undefined) {
      user.bio = typeof req.body.bio === 'string' ? sanitizeText(req.body.bio).trim().slice(0, 500) : '';
    }
    if (req.body.avatar && typeof req.body.avatar === 'string') {
      const cleanAv = req.body.avatar.trim();
      if (!cleanAv.toLowerCase().startsWith('javascript:') && !cleanAv.toLowerCase().startsWith('data:text/html')) {
        user.avatar = cleanAv.slice(0, 2048);
      }
    }
    await user.save();
    const userObj = user.toObject();
    delete userObj.password;
    userObj.isAdmin = isAdminUser(userObj);
    userObj.role = userObj.isAdmin ? 'admin' : (userObj.role || 'user');
    userObj.isVerified = isVerifiedUser(userObj.name);
    res.json({ success: true, user: userObj });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
