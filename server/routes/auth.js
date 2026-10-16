const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { auth, makeToken, isAdminUser, isVerifiedUser, revokedTokens } = require('../middleware/auth');

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password required' });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=1DB954&color=000&size=512&bold=true&format=png`;

    const isInitAdmin = isAdminUser({ email });
    const user = await new User({
      name,
      email: email.toLowerCase(),
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
    const rawIdentifier = (req.body.identifier || req.body.email || req.body.username || '').trim();
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
    if (req.body.name) user.name = req.body.name;
    if (req.body.bio !== undefined) user.bio = req.body.bio;
    if (req.body.avatar) user.avatar = req.body.avatar;
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
