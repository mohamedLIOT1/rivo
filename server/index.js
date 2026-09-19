/**
 * Liofy Backend API Server — FULL FEATURED & OPTIMIZED
 */

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const axios = require('axios');
const { Server } = require('socket.io');

try { require('dotenv').config({ path: path.join(__dirname, '../.env') }); } catch (e) {}

const app = express();
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.static(path.join(__dirname, '../dist')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const JWT_SECRET = process.env.JWT_SECRET || 'liofy_secure_key_2025';

// Global Error Handlers
process.on('uncaughtException', (err) => console.warn('[Uncaught]:', err.message));
process.on('unhandledRejection', (reason) => console.warn('[Unhandled]:', reason?.message));

// MongoDB Connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mohamedmustafat79_db_user:LiofyPass12345@cluster0.sr4ypsh.mongodb.net/liofy_db?retryWrites=true&w=majority';
async function connectDB() {
  try { 
    await mongoose.connect(MONGO_URI); 
    console.log('✅ DB Connected'); 
  } catch (err) { 
    console.error('DB connect error:', err.message);
    setTimeout(connectDB, 5000); 
  }
}
connectDB();

// ──────────────────────────────────────────
// Schemas & Models
// ──────────────────────────────────────────
const TrackSchema = new mongoose.Schema({
  title: String,
  artist: String,
  album: String,
  cover: String,
  audioUrl: String,
  duration: Number,
  genre: String,
  source: String,
  addedBy: String,
  lyrics: [{ time: Number, text: String }],
  color: String,
}, { timestamps: true, strict: false });

const Track = mongoose.model('Track', TrackSchema);

// Universal Lyrics Collection (indexed by normalized trackKey and trackId)
const LyricsSchema = new mongoose.Schema({
  trackKey: { type: String, unique: true, index: true },
  trackId: { type: String, index: true },
  title: String,
  artist: String,
  lyrics: [{ time: Number, text: String }],
  updatedBy: String,
  source: { type: String, default: 'manual' }
}, { timestamps: true });

const SongLyrics = mongoose.model('SongLyrics', LyricsSchema);

function getTrackKey(title, artist) {
  const norm = (str) => (str || '')
    .toLowerCase()
    .replace(/[\[\(].*?[\]\)]/g, '')
    .replace(/feat\..*|ft\..*/gi, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
  const t = norm(title);
  const a = norm(artist);
  return `${t}___${a}`;
}

// Clean up any dead/expired audio URLs so they resolve dynamically on play
Track.updateMany(
  { $or: [{ audioUrl: { $regex: 'pixabay' } }, { audioUrl: { $regex: 'sndcdn.com' } }] },
  { $set: { audioUrl: '', source: 'SoundCloud' } }
).then(r => { if (r.modifiedCount > 0) console.log(`[DB] Cleaned ${r.modifiedCount} placeholder/expired tracks`); }).catch(() => {});

// Background task: backfill real track covers for all imported tracks that currently share a playlist cover
setTimeout(async () => {
  try {
    const tracks = await Track.find().limit(100);
    for (const t of tracks) {
      if (t.title && t.artist) {
        const real = await fetchTrackCover(t.title, t.artist);
        if (real && real !== t.cover) {
          await Track.updateOne({ _id: t._id }, { $set: { cover: real } });
        }
      }
    }
    console.log('[DB] Finished backfilling real track covers');
  } catch (err) {
    console.warn('[DB] Cover backfill error:', err.message);
  }
}, 3000);

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, lowercase: true, required: true },
  password: { type: String, required: true },
  avatar: String,
  bio: { type: String, default: '' },
  likedTrackIds: [String],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  playlists: [{
    id: String,
    name: String,
    cover: String,
    trackIds: [String],
    isLikedSongs: Boolean,
    isPublic: { type: Boolean, default: true },
    description: String,
    isMix: { type: Boolean, default: false },
    transitions: { type: Object, default: {} }
  }],
  currentListening: { type: Object, default: null },
  lastActiveAt: { type: Date, default: Date.now }
}, { timestamps: true });

const User = mongoose.model('User', UserSchema);

const MessageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, default: '' },
  track: { type: Object, default: null },
  jamInvite: { type: Object, default: null },
  read: { type: Boolean, default: false }
}, { timestamps: true });

const Message = mongoose.model('Message', MessageSchema);

// ──────────────────────────────────────────
// Auth Helpers & Verified Badges
// ──────────────────────────────────────────
const VERIFIED_USER_NAMES = ['ali', 'lio', 'tester'];
function isVerifiedUser(name) {
  return VERIFIED_USER_NAMES.includes((name || '').trim().toLowerCase());
}

function makeToken(u) {
  return jwt.sign({ id: u._id, email: u.email, name: u.name }, JWT_SECRET, { expiresIn: '90d' });
}

function auth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  if (!t) return res.status(401).json({ error: 'Auth required' });
  try {
    req.user = jwt.verify(t, JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
}

function optionalAuth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  if (t) {
    try { req.user = jwt.verify(t, JWT_SECRET); } catch {}
  }
  next();
}

// ──────────────────────────────────────────
// Dynamic SoundCloud Engine & Stream Cache
// ──────────────────────────────────────────
const searchCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

let cachedSoundCloudClientId = 'Pb72ranhoyt6gw7hM7TkzUItXlMWSNSo';
let lastSoundCloudIdFetch = Date.now();

async function getSoundCloudClientId(forceRefresh = false) {
  if (!forceRefresh && cachedSoundCloudClientId && (Date.now() - lastSoundCloudIdFetch < 2 * 60 * 60 * 1000)) {
    return cachedSoundCloudClientId;
  }
  try {
    const res = await axios.get('https://soundcloud.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 8000
    });
    const scriptUrls = [...res.data.matchAll(/<script[^>]+src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)].map(m => m[1]);
    for (const scriptUrl of scriptUrls.reverse()) {
      try {
        const jsRes = await axios.get(scriptUrl, { timeout: 6000 });
        const match = jsRes.data.match(/client_id[:=]"([a-zA-Z0-9]{32})"/);
        if (match) {
          cachedSoundCloudClientId = match[1];
          lastSoundCloudIdFetch = Date.now();
          console.log('[SoundCloud] Fresh client ID obtained:', cachedSoundCloudClientId);
          return cachedSoundCloudClientId;
        }
      } catch {}
    }
  } catch (err) {
    console.warn('[SoundCloud] Client ID refresh failed:', err.message);
  }
  return cachedSoundCloudClientId || 'Pb72ranhoyt6gw7hM7TkzUItXlMWSNSo';
}

async function resolveSoundCloudStream(url, clientId) {
  let cid = clientId || await getSoundCloudClientId();
  try {
    const res = await axios.get(`${url}${url.includes('?') ? '&' : '?'}client_id=${cid}`, { timeout: 4000 });
    return res.data?.url || null;
  } catch (err) {
    if (err.response?.status === 401) {
      cid = await getSoundCloudClientId(true);
      try {
        const retryRes = await axios.get(`${url}${url.includes('?') ? '&' : '?'}client_id=${cid}`, { timeout: 4000 });
        return retryRes.data?.url || null;
      } catch {}
    }
    return null;
  }
}

async function searchYouTubeId(query) {
  if (!query || !query.trim()) return null;
  try {
    const res = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(query.trim())}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 5000
    });
    const matches = [...res.data.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map(m => m[1]);
    const valid = matches.filter(id => id && id.length === 11);
    return valid[0] || null;
  } catch {
    return null;
  }
}

async function fetchTrackCover(title, artist) {
  const q = `${artist || ''} ${title || ''}`.trim();
  if (!q) return null;
  // 1. iTunes (600x600 high-res)
  try {
    const res = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=1`, { timeout: 2500 });
    const art = res.data?.results?.[0]?.artworkUrl100;
    if (art) return art.replace('100x100bb', '600x600bb');
  } catch {}
  // 2. YouTube Thumbnail fallback
  try {
    const ytId = await searchYouTubeId(q);
    if (ytId) return `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
  } catch {}
  return null;
}

function rankSoundCloudTrack(item, title = '', artist = '') {
  let score = 100;
  const itemTitle = (item.title || '').toLowerCase();
  const userName = (item.user?.username || '').toLowerCase();
  const durSec = (item.duration || 0) / 1000;
  const cleanTitle = (title || '').toLowerCase().trim();
  const cleanArtist = (artist || '').toLowerCase().trim();

  // 1. Duration scoring (normal tracks are between 1:15 and 6:30)
  if (durSec < 60 || durSec > 660) score -= 100;
  else if (durSec >= 110 && durSec <= 360) score += 25;

  // 2. Artist match boost
  if (cleanArtist && (itemTitle.includes(cleanArtist) || userName.includes(cleanArtist))) {
    score += 45;
  }

  // 3. Title keywords match
  const words = cleanTitle.split(/\s+/).filter(w => w.length > 2);
  for (const w of words) {
    if (itemTitle.includes(w)) score += 25;
  }

  // 4. Heavily penalize unwanted covers, remixes, karaoke, instrumental, full albums
  const unwanted = [
    { key: 'remix', ar: 'ريمكس' },
    { key: 'cover', ar: 'كاور' },
    { key: 'piano', ar: 'بيانو' },
    { key: 'instrumental', ar: 'عزف' },
    { key: 'slowed', ar: 'مبطأ' },
    { key: 'sped', ar: 'مسرع' },
    { key: 'album', ar: 'البوم' },
    { key: 'live', ar: 'حفلة' },
    { key: 'karaoke', ar: 'كاريوكي' }
  ];

  for (const u of unwanted) {
    const requested = cleanTitle.includes(u.key) || cleanTitle.includes(u.ar);
    if (!requested) {
      if (itemTitle.includes(u.key) || itemTitle.includes(u.ar)) {
        score -= 75;
      }
    }
  }

  // 5. Official audio indicators
  if (item.user?.verified || itemTitle.includes('official') || itemTitle.includes('الأصلية') || itemTitle.includes('النسخة الأصلية')) {
    score += 35;
  }

  return score;
}

async function resolveSoundCloudTrack(query, rawTitle = '', rawArtist = '') {
  if (!query || !query.trim()) return null;
  let clientId = await getSoundCloudClientId();
  try {
    let res;
    try {
      res = await axios.get('https://api-v2.soundcloud.com/search/tracks', {
        params: { q: query.trim(), client_id: clientId, limit: 15 },
        timeout: 5000
      });
    } catch (err) {
      if (err.response?.status === 401) {
        clientId = await getSoundCloudClientId(true);
        res = await axios.get('https://api-v2.soundcloud.com/search/tracks', {
          params: { q: query.trim(), client_id: clientId, limit: 15 },
          timeout: 5000
        });
      } else {
        throw err;
      }
    }

    const rawCollection = res.data?.collection || [];
    const validItems = rawCollection.filter(item => item.policy !== 'SNIP' && (item.duration || 0) > 45000);
    if (validItems.length === 0) return null;

    // Rank items to pick original version over random remixes/covers
    const ranked = validItems.map(item => ({
      item,
      score: rankSoundCloudTrack(item, rawTitle || query, rawArtist)
    })).sort((a, b) => b.score - a.score);

    for (const { item } of ranked) {
      const prog = item.media?.transcodings?.find(t => t.format?.protocol === 'progressive' && !t.snipped);
      if (prog) {
        const streamUrl = await resolveSoundCloudStream(prog.url, clientId);
        if (streamUrl && !streamUrl.includes('preview')) {
          return {
            streamUrl,
            duration: item.duration ? Math.round(item.duration / 1000) : 180,
            cover: item.artwork_url ? item.artwork_url.replace('-large', '-t500x500') : (item.user?.avatar_url || null),
            title: item.title,
            artist: item.user?.username
          };
        }
      }
    }
  } catch (e) {
    console.warn('[SoundCloud] resolveSoundCloudTrack error:', e.message);
  }
  return null;
}

async function resolveTrackAudio(title, artist) {
  const query = `${artist || ''} ${title || ''}`.trim();
  if (!query) return null;

  // 1. First attempt to find native direct MP3 audio stream from SoundCloud (guaranteed HTML5 playback without iframe issues)
  try {
    const sc = await resolveSoundCloudTrack(query, title, artist);
    if (sc && sc.streamUrl) return sc;
  } catch {}

  // 2. If direct stream not found, fallback to YouTube
  try {
    const ytId = await searchYouTubeId(query);
    if (ytId) {
      return {
        streamUrl: `https://www.youtube.com/watch?v=${ytId}`,
        ytId,
        duration: 240,
        cover: `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
        title,
        artist,
        isYouTube: true
      };
    }
  } catch {}

  return null;
}

// ──────────────────────────────────────────
// AUTH ROUTES
// ──────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password required' });
    }
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'U')}&background=1DB954&color=000&size=512&bold=true&format=png`;

    const user = await new User({
      name,
      email: email.toLowerCase(),
      password: hashed,
      avatar: defaultAvatar,
      bio: '',
      likedTrackIds: [],
      followers: [],
      following: [],
      playlists: [{ id: 'liked', name: 'Liked Songs', trackIds: [], isLikedSongs: true, isPublic: false }]
    }).save();

    const userObj = user.toObject();
    delete userObj.password;
    userObj.isVerified = isVerifiedUser(userObj.name);
    res.json({ success: true, user: userObj, token: makeToken(user) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const rawIdentifier = (req.body.identifier || req.body.email || req.body.username || '').trim();
    const { password } = req.body;
    if (!rawIdentifier || !password) {
      return res.status(400).json({ error: 'Email or username and password are required' });
    }

    const escapedIdentifier = rawIdentifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const user = await User.findOne({
      $or: [
        { email: rawIdentifier.toLowerCase() },
        { name: { $regex: new RegExp(`^${escapedIdentifier}$`, 'i') } }
      ]
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email/username or password' });
    }
    const userObj = user.toObject();
    delete userObj.password;
    userObj.isVerified = isVerifiedUser(userObj.name);
    userObj.followersCount = (user.followers || []).length;
    userObj.followingCount = (user.following || []).length;
    res.json({ success: true, user: userObj, token: makeToken(user) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.avatar && user.avatar.includes('format=svg')) {
      user.avatar = user.avatar.replace('format=svg', 'format=png');
    }
    const userObj = user.toObject ? user.toObject() : { ...user._doc };
    userObj.isVerified = isVerifiedUser(userObj.name);
    userObj.followersCount = (user.followers || []).length;
    userObj.followingCount = (user.following || []).length;
    res.json({ success: true, user: userObj });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/update-profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (req.body.name) user.name = req.body.name;
    if (req.body.bio !== undefined) user.bio = req.body.bio;
    if (req.body.avatar) user.avatar = req.body.avatar;
    await user.save();
    const userObj = user.toObject();
    delete userObj.password;
    userObj.isVerified = isVerifiedUser(userObj.name);
    res.json({ success: true, user: userObj });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────
// USERS & SOCIAL (Follow, Profile, Chat)
// PRIVACY: Email is NEVER exposed to other users!
// ──────────────────────────────────────────
app.get('/api/users/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    let queryFilter = {};

    if (q) {
      if (q.length < 2) return res.json({ success: true, users: [] });
      queryFilter = { name: { $regex: q, $options: 'i' } };
    }

    // Search ONLY by name, NEVER search or expose email
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

app.get('/api/users/:id/profile', optionalAuth, async (req, res) => {
  try {
    const target = await User.findById(req.params.id)
      .select('_id name avatar bio playlists followers following createdAt')
      .lean();
    if (!target) return res.status(404).json({ error: 'User not found' });

    const currentUserId = req.user?.id;
    const isFollowing = currentUserId ? (target.followers || []).map(String).includes(String(currentUserId)) : false;
    const publicPlaylists = (target.playlists || []).filter(p => p.isPublic !== false && !p.isLikedSongs).map(p => ({
      ...p,
      ownerId: String(target._id),
      ownerName: target.name,
      trackCount: (p.trackIds || []).length
    }));

    res.json({
      success: true,
      user: {
        id: String(target._id),
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

app.post('/api/users/:id/follow', auth, async (req, res) => {
  try {
    const targetId = req.params.id;
    const currentUserId = req.user.id;
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

app.post('/api/users/:id/unfollow', auth, async (req, res) => {
  try {
    const targetId = req.params.id;
    const currentUserId = req.user.id;

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

// Friends list (following or followers)
app.get('/api/users/friends', auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).lean();
    const friendIds = me.following || [];
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

// ──────────────────────────────────────────
// SPOTIFY LISTENING ACTIVITY (FRIEND ACTIVITY)
// ──────────────────────────────────────────
app.get('/api/users/listening-activity', optionalAuth, async (req, res) => {
  try {
    let friends = [];
    const currentUserId = req.user?.id;

    if (currentUserId) {
      const me = await User.findById(currentUserId).lean();
      if (me && me.following && me.following.length > 0) {
        const followedUsers = await User.find({ _id: { $in: me.following } })
          .select('_id name avatar bio currentListening lastActiveAt updatedAt')
          .lean();
        friends = followedUsers.map(u => ({
          id: String(u._id),
          name: u.name,
          avatar: u.avatar || '',
          bio: u.bio || '',
          isVerified: isVerifiedUser(u.name),
          currentListening: u.currentListening || null,
          lastActiveAt: u.lastActiveAt || u.updatedAt || null,
          isLive: Boolean(u.currentListening?.isPlaying && (Date.now() - new Date(u.currentListening?.updatedAt || u.lastActiveAt).getTime() < 300000))
        }));
      }
    }

    res.json({ success: true, activities: friends });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/users/listening-activity', auth, async (req, res) => {
  try {
    const { track, isPlaying } = req.body;
    const updateData = {
      lastActiveAt: new Date(),
      currentListening: track ? {
        id: track.id || track._id,
        title: track.title,
        artist: track.artist,
        cover: track.cover,
        audioUrl: track.audioUrl,
        isPlaying: Boolean(isPlaying),
        updatedAt: new Date()
      } : null
    };

    const user = await User.findByIdAndUpdate(req.user.id, { $set: updateData }, { new: true });
    
    // Broadcast via socket.io
    io.emit('activity:updated', {
      userId: String(user._id),
      name: user.name,
      avatar: user.avatar,
      currentListening: user.currentListening,
      lastActiveAt: user.lastActiveAt,
      isLive: Boolean(isPlaying)
    });

    res.json({ success: true, currentListening: user.currentListening });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get user followers list
app.get('/api/users/:id/followers', optionalAuth, async (req, res) => {
  try {
    const target = await User.findById(req.params.id).populate('followers', '_id name avatar bio').lean();
    if (!target) return res.status(404).json({ error: 'User not found' });
    const followers = (target.followers || []).map(f => ({
      id: String(f._id),
      name: f.name,
      avatar: f.avatar,
      bio: f.bio || '',
      isVerified: isVerifiedUser(f.name)
    }));
    res.json({ success: true, followers, count: followers.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get user following list
app.get('/api/users/:id/following', optionalAuth, async (req, res) => {
  try {
    const target = await User.findById(req.params.id).populate('following', '_id name avatar bio').lean();
    if (!target) return res.status(404).json({ error: 'User not found' });
    const following = (target.following || []).map(f => ({
      id: String(f._id),
      name: f.name,
      avatar: f.avatar,
      bio: f.bio || '',
      isVerified: isVerifiedUser(f.name)
    }));
    res.json({ success: true, following, count: following.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────
// DIRECT CHAT MESSAGES
// ──────────────────────────────────────────
app.get('/api/chat/conversations', auth, async (req, res) => {
  try {
    const myId = String(req.user.id);
    const messages = await Message.find({
      $or: [{ sender: myId }, { recipient: myId }]
    })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

    const conversationMap = new Map();
    for (const msg of messages) {
      const otherId = String(msg.sender) === myId ? String(msg.recipient) : String(msg.sender);
      if (!conversationMap.has(otherId)) {
        conversationMap.set(otherId, msg);
      }
    }

    const otherUserIds = Array.from(conversationMap.keys());
    const users = await User.find({ _id: { $in: otherUserIds } })
      .select('_id name avatar bio')
      .lean();

    const conversations = users.map(u => ({
      user: {
        id: String(u._id),
        name: u.name,
        avatar: u.avatar || '',
        bio: u.bio || '',
        isVerified: isVerifiedUser(u.name)
      },
      lastMessage: conversationMap.get(String(u._id))
    }));

    res.json({ success: true, conversations });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/chat/unread-count', auth, async (req, res) => {
  try {
    const count = await Message.countDocuments({
      recipient: req.user.id,
      read: false
    });
    res.json({ success: true, count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/chat/:recipientId', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const recipientId = req.params.recipientId;

    // Mark messages from this sender to current user as read
    await Message.updateMany(
      { sender: recipientId, recipient: currentUserId, read: false },
      { $set: { read: true } }
    ).catch(() => {});

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: recipientId },
        { sender: recipientId, recipient: currentUserId }
      ]
    })
    .sort({ createdAt: 1 })
    .limit(100)
    .lean();

    res.json({ success: true, messages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/chat/send', auth, async (req, res) => {
  try {
    const { recipientId, text, track, jamInvite } = req.body;
    if (!recipientId) return res.status(400).json({ error: 'Recipient required' });

    const sender = await User.findById(req.user.id).select('_id name avatar').lean();

    const msg = await new Message({
      sender: req.user.id,
      recipient: recipientId,
      text: text || '',
      track: track || null,
      jamInvite: jamInvite || null
    }).save();

    const payload = {
      ...msg.toObject(),
      senderName: sender?.name || 'Friend',
      senderAvatar: sender?.avatar || ''
    };

    // Broadcast via socket if available
    io.to(`user:${recipientId}`).emit('chat:message', payload);
    io.to(`user:${req.user.id}`).emit('chat:message', payload);

    res.json({ success: true, message: payload });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────
// Non-music blacklist regex (cartoons, kids shows, anime, episodes)
const NON_MUSIC_REGEX = /(سبونج\s*بوب|سبونجبوب|spongebob|sponge\s*bob|بوب\s*القطار|bob\s*the\s*train|كرتون|رسوم\s*متحركة|حلقة\s*\d+|الموسم|حلقات|سلسلة|أنمي|انمي|نيكيلوديون|nickelodeon|mbc\s*3|mbc3|سبيستون|spacetoon|أطفال|اطفال|حكايات\s*أطفال|قصة\s*قبل\s*النوم|مسلسل|فيلم\s*كامل|مشهد\s*مضحك|كارتون|براعم|طيور\s*الجنة|كراميش|baby\s*shark|cocomelon|cartoon|animation|episode|full\s*episode)/i;

function isMusicTrackServer(title = '', artist = '') {
  const combined = `${title} ${artist}`.toLowerCase();
  return !NON_MUSIC_REGEX.test(combined);
}

// ──────────────────────────────────────────
async function searchTracksInternal(query) {
  let q = (query || '').trim();
  if (!q) return [];

  // Map generic Pop / Bob query to Arabic Pop Music
  let targetQuery = q;
  if (/^(pop|the pop|pop music|pops|بوب|بوب عربي|arabic pop)$/i.test(q)) {
    targetQuery = 'أغاني بوب عربي عمرو دياب تامر حسني';
  } else if (q === 'بوب') {
    targetQuery = 'أغاني بوب عربي';
  }

  const cacheKey = q.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.tracks.filter(t => isMusicTrackServer(t.title, t.artist));
  }

  try {
    // 1. Check local DB tracks
    const dbTracks = await Track.find({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { artist: { $regex: q, $options: 'i' } }
      ]
    }).limit(10).lean();

    const formattedDbTracks = dbTracks
      .filter(t => isMusicTrackServer(t.title, t.artist))
      .map(t => ({
        id: String(t._id),
        title: t.title,
        artist: t.artist,
        album: t.album || 'Single',
        cover: t.cover,
        audioUrl: t.audioUrl,
        duration: t.duration || 180,
        lyrics: t.lyrics || [],
        bpm: t.bpm,
        key: t.key,
        source: 'Liofy'
      }));

    // 2. Query SoundCloud with dynamic client ID
    let scTracks = [];
    let clientId = await getSoundCloudClientId();
    try {
      let scRes;
      try {
        scRes = await axios.get('https://api-v2.soundcloud.com/search/tracks', {
          params: { q: targetQuery, client_id: clientId, limit: 15 },
          timeout: 4000
        });
      } catch (err) {
        if (err.response?.status === 401) {
          clientId = await getSoundCloudClientId(true);
          scRes = await axios.get('https://api-v2.soundcloud.com/search/tracks', {
            params: { q: targetQuery, client_id: clientId, limit: 15 },
            timeout: 4000
          });
        } else {
          throw err;
        }
      }

      if (scRes?.data?.collection?.length > 0) {
        const valid = scRes.data.collection.filter(item => 
          (item.duration || 0) > 30000 && isMusicTrackServer(item.title, item.user?.username)
        );
        const resolved = await Promise.all(
          valid.slice(0, 10).map(async (item) => {
            const prog = item.media?.transcodings?.find(t => t.format?.protocol === 'progressive');
            if (!prog) return null;
            const streamUrl = await resolveSoundCloudStream(prog.url, clientId);
            if (!streamUrl) return null;

            return {
              id: `sc-${item.id}`,
              title: item.title || q,
              artist: item.user?.username || 'Artist',
              album: 'SoundCloud',
              cover: item.artwork_url
                ? item.artwork_url.replace('-large', '-t500x500')
                : (item.user?.avatar_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600'),
              audioUrl: streamUrl,
              duration: Math.round((item.duration || 180000) / 1000),
              source: 'SoundCloud'
            };
          })
        );
        scTracks = resolved.filter(Boolean);
      }
    } catch (err) {
      console.warn('[Search] SoundCloud search error:', err.message);
    }

    // 3. Query YouTube for official music releases
    let ytTracks = [];
    try {
      const ytSearchStr = `${targetQuery} music`;
      const ytRes = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(ytSearchStr)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 4000
      });
      const jsonMatch = ytRes.data.match(/var ytInitialData = ({.*?});<\/script>/s) || ytRes.data.match(/ytInitialData = ({.*?});<\/script>/s);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        const contents = parsed.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
        ytTracks = contents
          .filter(c => c.videoRenderer && c.videoRenderer.videoId)
          .map(c => {
            const v = c.videoRenderer;
            const title = v.title?.runs?.[0]?.text || q;
            const artist = v.ownerText?.runs?.[0]?.text || 'YouTube';
            return {
              id: `yt-${v.videoId}`,
              title,
              artist,
              album: 'YouTube',
              cover: v.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
              audioUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
              duration: 240,
              source: 'YouTube'
            };
          })
          .filter(t => isMusicTrackServer(t.title, t.artist))
          .slice(0, 10);
      }
    } catch {}

    const allTracks = [...formattedDbTracks, ...ytTracks, ...scTracks];
    searchCache.set(cacheKey, { timestamp: Date.now(), tracks: allTracks });
    return allTracks;
  } catch (e) {
    return [];
  }
}

// FAST MUSIC SEARCH & STREAM RESOLVER (Cached)
// ──────────────────────────────────────────
app.get(['/api/search', '/api/search/external'], async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ success: true, tracks: [] });
  const tracks = await searchTracksInternal(q);
  res.json({ success: true, tracks });
});

function parseDurationFromLabel(label) {
  if (!label) return 200;
  const mMatch = label.match(/(\d+)\s+minute/);
  const sMatch = label.match(/(\d+)\s+second/);
  const minutes = mMatch ? parseInt(mMatch[1], 10) : 0;
  const seconds = sMatch ? parseInt(sMatch[1], 10) : 0;
  const total = minutes * 60 + seconds;
  return total > 0 ? total : 200;
}

// ──────────────────────────────────────────
// PLAYLIST IMPORT (Spotify, YouTube, Apple Music)
// ──────────────────────────────────────────
app.post('/api/playlists/import', auth, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'Playlist URL is required' });

    let playlistTitle = 'Imported Playlist';
    let playlistCover = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600';
    let rawItems = [];

    // 1. Detect Spotify Playlist
    if (url.includes('spotify.com/playlist') || url.includes('spotify:playlist')) {
      const match = url.match(/playlist\/([a-zA-Z0-9]+)/) || url.match(/spotify:playlist:([a-zA-Z0-9]+)/);
      const playlistId = match ? match[1] : null;

      if (!playlistId) return res.status(400).json({ error: 'Invalid Spotify playlist link' });

      // Fetch Spotify Embed page which has embedded JSON metadata
      try {
        const embedRes = await axios.get(`https://open.spotify.com/embed/playlist/${playlistId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          timeout: 10000
        });

        const html = embedRes.data;
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
        if (nextDataMatch) {
          const parsed = JSON.parse(nextDataMatch[1]);
          const entity = parsed?.props?.pageProps?.state?.data?.entity;
          if (entity) {
            playlistTitle = entity.name || playlistTitle;
            if (entity.coverArt?.sources?.[0]?.url) playlistCover = entity.coverArt.sources[0].url;

            const trackList = entity.trackList || [];
            rawItems = trackList.map(t => ({
              title: t.title || t.name,
              artist: t.subtitle || t.artists?.[0]?.name || 'Artist',
              duration: Math.round((t.duration || 180000) / 1000)
            }));
          }
        }
      } catch (err) {
        console.warn('Spotify embed fetch failed:', err.message);
      }
    }
    // 2. Detect YouTube Playlist
    else if (url.includes('youtube.com/playlist') || url.includes('list=')) {
      const match = url.match(/list=([a-zA-Z0-9_-]+)/);
      const listId = match ? match[1] : null;
      if (!listId) return res.status(400).json({ error: 'Invalid YouTube playlist link' });

      try {
        const ytRes = await axios.get(`https://www.youtube.com/playlist?list=${listId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
          },
          timeout: 12000
        });
        const html = ytRes.data;

        // Try extracting ytInitialData
        const initialDataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/ytInitialData\s*=\s*({.+?});/);
        if (initialDataMatch) {
          try {
            const data = JSON.parse(initialDataMatch[1]);
            const headerTitle = data?.metadata?.playlistMetadataRenderer?.title;
            if (headerTitle) playlistTitle = headerTitle;

            const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs;
            const sectionList = tabs?.[0]?.tabRenderer?.content?.sectionListRenderer;
            const sectionContents = sectionList?.contents || [];

            for (const sec of sectionContents) {
              const itemContents = sec.itemSectionRenderer?.contents || [];
              for (const it of itemContents) {
                // 1. Modern lockupViewModel (current YouTube UI)
                if (it.lockupViewModel && it.lockupViewModel.contentId) {
                  const vm = it.lockupViewModel;
                  const videoId = vm.contentId;
                  const title = vm.metadata?.lockupMetadataViewModel?.title?.content || 'Unknown Track';
                  const metadataRows = vm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows || [];
                  const author = metadataRows[0]?.metadataParts?.[0]?.text?.content || 'Artist';
                  const duration = parseDurationFromLabel(vm.rendererContext?.accessibilityContext?.label);
                  const cover = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

                  rawItems.push({
                    title,
                    artist: author,
                    videoId,
                    duration,
                    cover,
                    audioUrl: `https://www.youtube.com/watch?v=${videoId}`
                  });
                }
                // 2. Classic playlistVideoRenderer
                else if (it.playlistVideoRenderer && it.playlistVideoRenderer.videoId) {
                  const p = it.playlistVideoRenderer;
                  const videoId = p.videoId;
                  const title = p.title?.runs?.[0]?.text || p.title?.simpleText || 'Unknown Track';
                  const author = p.shortBylineText?.runs?.[0]?.text || 'Artist';
                  const duration = p.lengthSeconds ? parseInt(p.lengthSeconds, 10) : 200;
                  const cover = p.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

                  rawItems.push({
                    title,
                    artist: author,
                    videoId,
                    duration,
                    cover,
                    audioUrl: `https://www.youtube.com/watch?v=${videoId}`
                  });
                }
              }
            }
          } catch (e) {
            console.warn('ytInitialData parse error:', e.message);
          }
        }

        // Fallback: title from HTML tag
        if (playlistTitle === 'Imported Playlist') {
          const titleMatch = html.match(/<title>([^<]+)<\/title>/);
          if (titleMatch) {
            playlistTitle = titleMatch[1].replace(' - YouTube', '').trim();
          }
        }

        if (rawItems.length > 0 && rawItems[0].cover) {
          playlistCover = rawItems[0].cover;
        }
      } catch (err) {
        console.warn('YouTube playlist scrape failed:', err.message);
      }
    }
    // 3. Detect Apple Music Playlist
    else if (url.includes('music.apple.com')) {
      try {
        const appleRes = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 10000
        });
        const html = appleRes.data;
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
          playlistTitle = titleMatch[1].replace(' - Apple Music', '').trim();
        }
      } catch (err) {}
    }

    if (rawItems.length === 0) {
      return res.status(400).json({ error: 'Could not extract tracks from playlist. Please verify the link is public.' });
    }

    // Save tracks to database
    const trackIds = [];
    const createdTracks = [];

    for (const item of rawItems.slice(0, 100)) { // up to 100 tracks
      try {
        const duration = item.duration || 180;
        const ytId = item.videoId || await searchYouTubeId(`${item.artist} - ${item.title}`);
        let trackCover = item.cover || (item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : null);
        if (!trackCover) trackCover = await fetchTrackCover(item.title, item.artist);
        if (!trackCover && ytId) trackCover = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
        if (!trackCover) trackCover = playlistCover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';

        const audioUrl = item.audioUrl || (ytId ? `https://www.youtube.com/watch?v=${ytId}` : '');

        let trackId = `track-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        if (mongoose.connection.readyState === 1) {
          try {
            const newTrack = await new Track({
              title: item.title,
              artist: item.artist,
              album: playlistTitle,
              cover: trackCover,
              audioUrl,
              duration,
              genre: 'Imported',
              source: 'YouTube'
            }).save();
            if (newTrack?._id) trackId = String(newTrack._id);
          } catch (dbErr) {
            console.warn('Track DB save error, using fallback ID:', dbErr.message);
          }
        }

        const trackObj = {
          id: trackId,
          _id: trackId,
          title: item.title,
          artist: item.artist,
          album: playlistTitle,
          cover: trackCover,
          audioUrl,
          duration,
          genre: 'Imported',
          source: 'YouTube'
        };

        trackIds.push(trackId);
        createdTracks.push(trackObj);
      } catch (err) {}
    }

    // Add new playlist to user
    const newPlaylist = {
      id: `pl-${Date.now()}`,
      name: playlistTitle,
      cover: playlistCover,
      trackIds,
      isLikedSongs: false,
      isPublic: true,
      description: `Imported from ${url.includes('spotify') ? 'Spotify' : url.includes('youtube') ? 'YouTube' : 'External'} (${trackIds.length} tracks)`
    };

    if (mongoose.connection.readyState === 1) {
      try {
        const user = await User.findById(req.user.id);
        if (user) {
          user.playlists.push(newPlaylist);
          await user.save();
        }
      } catch (err) {
        console.warn('Could not persist playlist to user document:', err.message);
      }
    }

    res.json({
      success: true,
      playlist: newPlaylist,
      trackCount: trackIds.length,
      tracks: createdTracks
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────
// FULL SYNC & BATCH TRACKS ENDPOINTS
// ──────────────────────────────────────────
app.get('/api/sync', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const allTracks = await Track.find().sort({ createdAt: -1 }).limit(1000).lean();
    const formatted = allTracks.map(t => ({
      id: String(t._id),
      _id: String(t._id),
      title: t.title,
      artist: t.artist,
      album: t.album,
      cover: t.cover,
      audioUrl: t.audioUrl,
      duration: t.duration || 180,
      genre: t.genre,
      source: t.source,
      addedBy: t.addedBy,
      lyrics: t.lyrics || [],
      color: t.color || '#1DB954',
      liked: (user.likedTrackIds || []).includes(String(t._id)),
    }));

    res.json({
      success: true,
      user,
      tracks: formatted,
      playlists: user.playlists || [],
      likedTrackIds: user.likedTrackIds || [],
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/tracks/by-ids', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.json({ success: true, tracks: [] });
    const tracks = await Track.find({ _id: { $in: ids } }).lean();

    // Asynchronously backfill missing covers in background without blocking response
    setImmediate(async () => {
      for (const t of tracks) {
        if (t.title && (!t.cover || t.cover.includes('unsplash') || t.cover.includes('pixabay') || t.cover.includes('format=svg'))) {
          try {
            const real = await fetchTrackCover(t.title, t.artist);
            if (real) await Track.updateOne({ _id: t._id }, { $set: { cover: real } });
          } catch {}
        }
      }
    });

    const formatted = tracks.map((t) => ({
      id: String(t._id),
      _id: String(t._id),
      title: t.title,
      artist: t.artist,
      album: t.album,
      cover: t.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
      audioUrl: t.audioUrl && !t.audioUrl.includes('pixabay.com') && !t.audioUrl.includes('preview') ? t.audioUrl : '',
      duration: t.duration || 180,
      genre: t.genre,
      source: t.source || 'SoundCloud',
      lyrics: t.lyrics || []
    }));

    res.json({
      success: true,
      tracks: formatted
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────
// PLAYLISTS CRUD
// ──────────────────────────────────────────
app.post('/api/playlists/create', auth, async (req, res) => {
  try {
    const u = await User.findById(req.user.id);
    const newPl = {
      id: `pl-${Date.now()}`,
      name: req.body.name,
      cover: req.body.cover || '',
      trackIds: [],
      isLikedSongs: false,
      isPublic: true
    };
    u.playlists.push(newPl);
    await u.save();
    res.json({ success: true, playlist: newPl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/playlists/:id/add-track', auth, async (req, res) => {
  try {
    const u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ error: 'User not found' });
    const pl = u.playlists.find(p => String(p.id || p._id) === String(req.params.id));
    if (!pl) return res.status(403).json({ error: 'You do not own this playlist' });
    const trackIdStr = String(req.body.trackId);
    if (!pl.trackIds.map(String).includes(trackIdStr)) {
      pl.trackIds.push(trackIdStr);
    }
    await u.save();
    res.json({ success: true, trackIds: pl.trackIds });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Remove track from playlist (Strictly restricted to playlist owner)
const removeTrackFromPlaylistHandler = async (req, res) => {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ error: 'Unauthorized' });
    const playlistId = String(req.params.id || '');
    const trackIdStr = String(req.body.trackId || req.params.trackId || '');
    if (!trackIdStr) return res.status(400).json({ error: 'trackId required' });

    const u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ error: 'User not found' });

    const pl = u.playlists.find(p => String(p.id || p._id) === playlistId);
    if (!pl) return res.status(403).json({ error: 'You do not own this playlist' });

    pl.trackIds = (pl.trackIds || []).filter(id => String(id) !== trackIdStr);
    await u.save();
    res.json({ success: true, trackIds: pl.trackIds });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
app.post('/api/playlists/:id/remove-track', auth, removeTrackFromPlaylistHandler);
app.delete('/api/playlists/:id/tracks/:trackId', auth, removeTrackFromPlaylistHandler);

app.post('/api/playlists/:id/update', auth, async (req, res) => {
  try {
    const u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ success: false, error: 'User not found' });
    const pl = u.playlists.find(p => String(p.id || p._id) === String(req.params.id));
    if (!pl) return res.status(403).json({ success: false, error: 'You do not own this playlist' });
    if (req.body.name) pl.name = req.body.name;
    if (req.body.cover) pl.cover = req.body.cover;
    if (req.body.isPublic !== undefined) pl.isPublic = Boolean(req.body.isPublic);
    await u.save();
    res.json({ success: true, isPublic: pl.isPublic });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/playlists/:id/toggle-visibility', auth, async (req, res) => {
  try {
    const u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ success: false, error: 'User not found' });
    const pl = u.playlists.find(p => String(p.id || p._id) === String(req.params.id));
    if (!pl) return res.status(403).json({ success: false, error: 'You do not own this playlist' });
    pl.isPublic = pl.isPublic === false ? true : false;
    await u.save();
    res.json({ success: true, isPublic: pl.isPublic });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/playlists/:id', auth, async (req, res) => {
  try {
    const u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ error: 'User not found' });
    const initialLen = u.playlists.length;
    u.playlists = u.playlists.filter(p => String(p.id || p._id) !== String(req.params.id));
    if (u.playlists.length === initialLen) {
      return res.status(403).json({ error: 'Playlist not found or not owned by you' });
    }
    await u.save();
    res.json({ success: true });
  } catch (e) {
    res.status(500).end();
  }
});

// ──────────────────────────────────────────
// TRACKS CRUD
// ──────────────────────────────────────────
app.get('/api/tracks', async (req, res) => {
  try {
    const tracks = await Track.find().sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, tracks });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const createTrackHandler = async (req, res) => {
  try {
    const newTrack = await new Track({
      ...req.body,
      addedBy: req.user ? req.user.id : 'user'
    }).save();
    res.json({ success: true, track: newTrack });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
app.post('/api/tracks/create', optionalAuth, createTrackHandler);
app.post('/api/tracks/add', optionalAuth, createTrackHandler);

// Delete track permanently from database & remove from all playlists & likes
const deleteTrackHandler = async (req, res) => {
  try {
    const trackId = String(req.params.id || req.body.trackId || '');
    if (!trackId) return res.status(400).json({ error: 'Track ID required' });

    // 1. Delete from Track collection
    try {
      await Track.deleteOne({ _id: trackId });
    } catch {}

    // 2. Remove from all users' playlists and likedTrackIds
    const users = await User.find({
      $or: [
        { likedTrackIds: trackId },
        { 'playlists.trackIds': trackId }
      ]
    });

    for (const u of users) {
      let changed = false;
      if (u.likedTrackIds && u.likedTrackIds.includes(trackId)) {
        u.likedTrackIds = u.likedTrackIds.filter(id => String(id) !== trackId);
        changed = true;
      }
      if (u.playlists && u.playlists.length > 0) {
        for (const pl of u.playlists) {
          if (pl.trackIds && pl.trackIds.some(id => String(id) === trackId)) {
            pl.trackIds = pl.trackIds.filter(id => String(id) !== trackId);
            changed = true;
          }
        }
      }
      if (changed) {
        await u.save();
      }
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
app.delete('/api/tracks/:id', optionalAuth, deleteTrackHandler);
app.post('/api/tracks/:id/delete', optionalAuth, deleteTrackHandler);
app.post('/api/tracks/delete', optionalAuth, deleteTrackHandler);

// Like / Unlike track toggle endpoint
app.post('/api/tracks/:id/like', auth, async (req, res) => {
  try {
    const trackId = String(req.params.id);
    const u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ error: 'User not found' });

    u.likedTrackIds = u.likedTrackIds || [];
    const idx = u.likedTrackIds.indexOf(trackId);
    let liked = false;
    if (idx >= 0) {
      u.likedTrackIds.splice(idx, 1);
      liked = false;
    } else {
      u.likedTrackIds.push(trackId);
      liked = true;
    }

    // Keep user's Liked Songs playlist in sync
    const likedPl = (u.playlists || []).find(p => p.isLikedSongs || p.name === 'Liked Songs');
    if (likedPl) {
      likedPl.trackIds = [...u.likedTrackIds];
    }

    await u.save();
    res.json({ success: true, liked, likedTrackIds: u.likedTrackIds });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────
// SYNCED LYRICS ENGINE (LRCLIB & AI FALLBACK)
// ──────────────────────────────────────────
function parseLrc(lrcString) {
  if (!lrcString) return [];
  const lines = lrcString.split('\n');
  const result = [];
  for (const line of lines) {
    const match = line.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseFloat(match[2]);
      const time = Math.round((minutes * 60 + seconds) * 10) / 10;
      const text = match[3].trim();
      if (text) result.push({ time, text });
    }
  }
  return result;
}

function parsePlain(plainString, duration = 180) {
  if (!plainString) return [];
  const lines = plainString.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const step = duration / lines.length;
  return lines.map((text, idx) => ({
    time: Math.round(idx * step),
    text
  }));
}

async function fetchLrclibLyrics(title, artist, duration = 180) {
  if (!title) return [];

  // Extract clean parts
  const cleanTitle = (title || '')
    .replace(/\(.*?\)|\[.*?\]|\|.*$/g, '')
    .replace(/(?:ft\.?|feat\.?|featuring)\s+.*$/i, '')
    .trim();
  
  // Extract primary artist (before pipes, slashes, or secondary language delimiters)
  const primaryArtist = (artist || '')
    .split(/[|/•,]/)[0]
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .trim();

  const fullCleanArtist = (artist || '')
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .trim();

  // Search variations in order of relevance
  const queries = [
    `${primaryArtist} ${cleanTitle}`.trim(),
    `${fullCleanArtist} ${cleanTitle}`.trim(),
    cleanTitle
  ].filter(Boolean);

  const uniqueQueries = [...new Set(queries)];

  for (const q of uniqueQueries) {
    try {
      const res = await axios.get('https://lrclib.net/api/search', {
        params: { q },
        headers: { 'User-Agent': 'LiofyApp/1.0 (https://github.com/mohamedLIOT1/liofy)' },
        timeout: 4500
      });
      const items = res.data || [];
      for (const item of items) {
        if (item.syncedLyrics) return parseLrc(item.syncedLyrics);
        if (item.plainLyrics) return parsePlain(item.plainLyrics, duration);
      }
    } catch (err) {}
  }

  // Fallback: Try lyrics.ovh free public API for plain lyrics
  if (primaryArtist && cleanTitle) {
    try {
      const ovhRes = await axios.get(`https://api.lyrics.ovh/v1/${encodeURIComponent(primaryArtist)}/${encodeURIComponent(cleanTitle)}`, {
        timeout: 4000
      });
      if (ovhRes.data?.lyrics) {
        return parsePlain(ovhRes.data.lyrics, duration);
      }
    } catch {}
  }

  return [];
}

app.post('/api/ai/generate-song-lyrics', async (req, res) => {
  try {
    const { trackId, title, artist, duration } = req.body;
    const trackKey = getTrackKey(title, artist);

    // 1. Check DB first for manually saved or previously cached lyrics
    if (trackKey && trackKey !== '___') {
      const saved = await SongLyrics.findOne({ trackKey }).lean();
      if (saved && saved.lyrics && saved.lyrics.length > 0) {
        return res.json({ success: true, lyrics: saved.lyrics, isManual: saved.source === 'manual' });
      }
    }

    if (trackId) {
      const saved = await SongLyrics.findOne({ trackId: String(trackId) }).lean();
      if (saved && saved.lyrics && saved.lyrics.length > 0) {
        return res.json({ success: true, lyrics: saved.lyrics, isManual: saved.source === 'manual' });
      }

      if (mongoose.isValidObjectId(trackId)) {
        const trk = await Track.findById(trackId).lean();
        if (trk && trk.lyrics && trk.lyrics.length > 0) {
          return res.json({ success: true, lyrics: trk.lyrics, isManual: true });
        }
      }
    }

    // 2. Fetch from LRCLIB / OVH
    let lyrics = await fetchLrclibLyrics(title, artist, duration || 180);
    if (lyrics && lyrics.length > 0) {
      if (trackKey && trackKey !== '___') {
        await SongLyrics.findOneAndUpdate(
          { trackKey },
          { $set: { trackKey, trackId: String(trackId || ''), title, artist, lyrics, source: 'synced' } },
          { upsert: true }
        ).catch(() => {});
      }
      if (trackId && mongoose.isValidObjectId(trackId)) {
        await Track.updateOne({ _id: trackId }, { $set: { lyrics } }).catch(() => {});
      }
    }
    res.json({ success: true, lyrics: lyrics || [] });
  } catch (e) {
    res.json({ success: false, lyrics: [] });
  }
});

// Direct Audio Stream Downloader
app.get('/api/tracks/download', async (req, res) => {
  try {
    const { url, title, artist, id } = req.query;
    let streamUrl = null;

    // 1. Direct audio/stream URL passed (mp3, wav, soundcloud progressive)
    if (url && (url.startsWith('http://') || url.startsWith('https://')) && !url.includes('youtube.com') && !url.includes('youtu.be')) {
      streamUrl = url;
    }

    // 2. Resolve via SoundCloud (direct high-quality progressive MP3 stream)
    if (!streamUrl && (title || artist)) {
      const cleanArtist = (artist || '').split(/[|/•]/)[0].trim();
      const cleanTitle = (title || '').replace(/\(.*?\)|\[.*?\]/g, '').trim();
      const query = `${cleanArtist} ${cleanTitle}`.trim() || `${artist || ''} ${title || ''}`.trim();
      const sc = await resolveSoundCloudTrack(query, cleanTitle, cleanArtist);
      if (sc && sc.streamUrl) {
        streamUrl = sc.streamUrl;
      }
    }

    // 3. If YouTube URL or ID, attempt stream resolution
    if (!streamUrl && url) {
      const ytMatch = url.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
      const videoId = ytMatch ? ytMatch[1] : null;
      if (videoId) {
        for (const ep of ['https://api.cobalt.tools/api/json', 'https://co.wuk.sh/api/json']) {
          try {
            const cRes = await axios.post(ep, {
              url: `https://www.youtube.com/watch?v=${videoId}`,
              downloadMode: 'audio',
              audioFormat: 'mp3'
            }, {
              headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
              timeout: 6000
            });
            if (cRes.data?.url) {
              streamUrl = cRes.data.url;
              break;
            }
          } catch {}
        }
      }
    }

    if (!streamUrl) {
      return res.status(404).json({ success: false, error: 'Could not resolve audio stream for download' });
    }

    const cleanFilename = `${(artist || 'Artist').split(/[|/]/)[0].trim()} - ${(title || 'Track').replace(/[/\\?%*:|"<>]/g, '').trim()}`;
    const headRes = await axios({
      method: 'get',
      url: streamUrl,
      responseType: 'stream',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 30000
    });

    res.set({
      'Content-Type': headRes.headers['content-type'] || 'audio/mpeg',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(cleanFilename)}.mp3"`,
      'Access-Control-Allow-Origin': '*'
    });
    headRes.data.pipe(res);
  } catch (e) {
    console.error('Download audio error:', e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/tracks/update-lyrics', async (req, res) => {
  try {
    const { trackId, title, artist, audioUrl, lyrics, updatedBy } = req.body;
    if (!lyrics || !Array.isArray(lyrics)) {
      return res.status(400).json({ error: 'Lyrics must be an array' });
    }

    const trackKey = getTrackKey(title, artist);

    // 1. Save / upsert into universal SongLyrics collection
    if (trackKey && trackKey !== '___') {
      await SongLyrics.findOneAndUpdate(
        { trackKey },
        {
          $set: {
            trackKey,
            trackId: String(trackId || ''),
            title: title || '',
            artist: artist || '',
            lyrics,
            updatedBy: updatedBy || 'user',
            source: 'manual'
          }
        },
        { upsert: true, new: true }
      );
    }

    // 2. Also index by trackId if available
    if (trackId) {
      await SongLyrics.findOneAndUpdate(
        { trackId: String(trackId) },
        {
          $set: {
            lyrics,
            title: title || '',
            artist: artist || '',
            source: 'manual'
          }
        },
        { upsert: true }
      ).catch(() => {});

      // 3. If MongoDB ObjectId, update Track collection as well
      if (mongoose.isValidObjectId(trackId)) {
        await Track.updateOne({ _id: trackId }, { $set: { lyrics } }).catch(() => {});
      }
    }

    // 4. Real-time broadcast to all connected clients & Jam sessions
    io.emit('lyrics:updated', {
      trackKey,
      trackId: String(trackId || ''),
      title,
      artist,
      lyrics
    });

    console.log(`[Lyrics] Successfully saved & broadcasted manual lyrics for "${title}" by "${artist}"`);
    res.json({ success: true, trackKey });
  } catch (e) {
    console.error('Update lyrics error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Dedicated lyrics fetch endpoint for any track (by trackId OR title+artist)
app.get('/api/tracks/lyrics', async (req, res) => {
  try {
    const { trackId, title, artist } = req.query;
    const trackKey = getTrackKey(title, artist);

    // 1. Try trackKey in SongLyrics
    if (trackKey && trackKey !== '___') {
      const found = await SongLyrics.findOne({ trackKey }).lean();
      if (found && Array.isArray(found.lyrics) && found.lyrics.length > 0) {
        return res.json({ success: true, lyrics: found.lyrics, source: found.source || 'manual' });
      }
    }

    // 2. Try trackId in SongLyrics
    if (trackId) {
      const found = await SongLyrics.findOne({ trackId: String(trackId) }).lean();
      if (found && Array.isArray(found.lyrics) && found.lyrics.length > 0) {
        return res.json({ success: true, lyrics: found.lyrics, source: found.source || 'manual' });
      }

      // 3. Try Track DB if valid ObjectId
      if (mongoose.isValidObjectId(trackId)) {
        const trk = await Track.findById(trackId).lean();
        if (trk && Array.isArray(trk.lyrics) && trk.lyrics.length > 0) {
          return res.json({ success: true, lyrics: trk.lyrics, source: 'manual' });
        }
      }
    }

    // 4. Fallback to LRCLIB / OVH if title exists
    if (title) {
      const lyrics = await fetchLrclibLyrics(title, artist, 180);
      if (lyrics && lyrics.length > 0) {
        return res.json({ success: true, lyrics, source: 'synced' });
      }
    }

    res.json({ success: false, lyrics: [] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, lyrics: [] });
  }
});

app.post('/api/tracks/clear-lyrics', async (req, res) => {
  try {
    const { trackId, title, artist } = req.body;
    const trackKey = getTrackKey(title, artist);

    if (trackKey && trackKey !== '___') {
      await SongLyrics.deleteOne({ trackKey }).catch(() => {});
    }
    if (trackId) {
      await SongLyrics.deleteOne({ trackId: String(trackId) }).catch(() => {});
      if (mongoose.isValidObjectId(trackId)) {
        await Track.updateOne({ _id: trackId }, { $set: { lyrics: [] } }).catch(() => {});
      }
    }

    io.emit('lyrics:updated', { trackKey, trackId, lyrics: [] });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/ai/translate-lyrics', async (req, res) => {
  try {
    const { lyrics } = req.body;
    if (!Array.isArray(lyrics) || !lyrics.length) return res.json({ success: true, translatedLyrics: [] });

    // Return lyrics with translated text fallback
    res.json({ success: true, translatedLyrics: lyrics });
  } catch (e) {
    res.json({ success: false, translatedLyrics: req.body.lyrics || [] });
  }
});

// ──────────────────────────────────────────
// SPOTIFY MIX: PLAYLIST TRANSITIONS PERSISTENCE
// ──────────────────────────────────────────
app.post('/api/playlists/:id/transitions', auth, async (req, res) => {
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

// ──────────────────────────────────────────
// AI SMART SHUFFLE & INTELLIGENT RECOMMENDATIONS
// ──────────────────────────────────────────
async function getGeminiMusicSuggestions(seedTracks, vibePrompt = '') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const seeds = seedTracks.slice(0, 6).map(t => `"${t.title}" by ${t.artist}`).join(', ');
    const prompt = `You are a world-class music DJ and recommendation algorithm.
Given these seed tracks from a user's playlist: [${seeds}].
${vibePrompt ? `User mood/vibe request: "${vibePrompt}".` : 'Recommend tracks that seamlessly blend with this mood, tempo, and genre for Smart Shuffle.'}
Provide 6 song recommendations.
Respond ONLY with a JSON array of objects with keys: "title", "artist", "reason" (short 4-word reason like "Matching energy & tempo" or "Same vibe"). No markdown, no formatting.`;

    const model = 'gemini-flash-latest';
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 600 }
      },
      { timeout: 7000 }
    );

    const raw = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (err) {
    console.warn('[Gemini AI] Smart Shuffle recommendations fallback:', err.message);
  }
  return null;
}

app.post('/api/ai/smart-shuffle', async (req, res) => {
  try {
    const { currentTrack, seedTracks = [], limit = 6 } = req.body;
    const allSeeds = [currentTrack, ...seedTracks].filter(Boolean);

    // 1. Try Gemini AI recommendations first if key exists
    let aiRecs = await getGeminiMusicSuggestions(allSeeds);
    let tracks = [];

    if (aiRecs && aiRecs.length > 0) {
      // Find matching songs concurrently in-process without localhost HTTP loop
      const settled = await Promise.allSettled(
        aiRecs.slice(0, limit).map(async (item) => {
          const q = `${item.title} ${item.artist}`;
          const searchResults = await searchTracksInternal(q);
          if (searchResults && searchResults.length > 0) {
            return {
              ...searchResults[0],
              isSmartShuffle: true,
              smartReason: item.reason || 'AI Smart Vibe Match'
            };
          }
          return null;
        })
      );
      for (const res of settled) {
        if (res.status === 'fulfilled' && res.value) {
          tracks.push(res.value);
        }
      }
    }

    // 2. Fallback: Internal Musical Feature & Artist Similarity Algorithm
    if (tracks.length < 3) {
      const artists = [...new Set(allSeeds.map(t => t.artist).filter(Boolean))];
      const titles = allSeeds.map(t => t.title).filter(Boolean);

      // Search DB for tracks by similar artists
      const dbMatches = await Track.find({
        $or: [
          { artist: { $in: artists } },
          { genre: allSeeds[0]?.genre || 'Pop' }
        ]
      }).limit(10).lean();

      const existingIds = new Set(allSeeds.map(t => String(t.id || t._id)));
      for (const t of dbMatches) {
        if (!existingIds.has(String(t._id)) && tracks.length < limit) {
          tracks.push({
            id: String(t._id),
            title: t.title,
            artist: t.artist,
            album: t.album || 'Single',
            cover: t.cover,
            audioUrl: t.audioUrl,
            duration: t.duration || 180,
            isSmartShuffle: true,
            smartReason: 'Matching Artist & Genre',
            source: 'Liofy'
          });
        }
      }

      // If still need tracks, query popular related songs via search
      if (tracks.length < 3 && artists.length > 0) {
        try {
          const topArtist = artists[0];
          const extTracks = await searchTracksInternal(topArtist);
          if (extTracks && extTracks.length > 0) {
            for (const t of extTracks) {
              if (!existingIds.has(String(t.id)) && !tracks.some(x => x.id === t.id) && tracks.length < limit) {
                tracks.push({
                  ...t,
                  isSmartShuffle: true,
                  smartReason: 'Artist Top Track'
                });
              }
            }
          }
        } catch {}
      }
    }

    res.json({ success: true, tracks });
  } catch (e) {
    console.error('Smart Shuffle error:', e.message);
    res.json({ success: false, tracks: [] });
  }
});

// Playlist Recommendations endpoint (for AI Enhance Playlist)
app.post('/api/ai/recommendations', async (req, res) => {
  try {
    const { playlistName, seedTracks = [], prompt = '' } = req.body;
    let aiRecs = await getGeminiMusicSuggestions(seedTracks, prompt || `Songs that fit "${playlistName || 'My Playlist'}"`);
    let recommendations = [];

    if (aiRecs && aiRecs.length > 0) {
      const settled = await Promise.allSettled(
        aiRecs.slice(0, 6).map(async (item) => {
          const q = `${item.title} ${item.artist}`;
          const searchResults = await searchTracksInternal(q);
          if (searchResults && searchResults.length > 0) {
            return {
              ...searchResults[0],
              aiReason: item.reason || 'Perfect match for playlist vibe'
            };
          }
          return null;
        })
      );
      for (const res of settled) {
        if (res.status === 'fulfilled' && res.value) {
          recommendations.push(res.value);
        }
      }
    }

    if (recommendations.length === 0) {
      // Internal heuristic fallback
      const artists = [...new Set(seedTracks.map(t => t.artist).filter(Boolean))];
      const dbTracks = await Track.find({ artist: { $in: artists } }).limit(6).lean();
      recommendations = dbTracks.map(t => ({
        id: String(t._id),
        title: t.title,
        artist: t.artist,
        cover: t.cover,
        audioUrl: t.audioUrl,
        duration: t.duration || 180,
        aiReason: 'Similar to artists in your playlist'
      }));
    }

    res.json({ success: true, recommendations });
  } catch (e) {
    res.json({ success: false, recommendations: [] });
  }
});

// Direct SoundCloud MP3 audio stream fallback for unblocked playback
app.get('/api/soundcloud/fallback', async (req, res) => {
  try {
    const { title, artist } = req.query;
    const q = `${artist || ''} ${title || ''}`.trim();
    if (!q) return res.status(400).json({ error: 'Query required' });

    const sc = await resolveSoundCloudTrack(q, title, artist);
    if (sc && sc.streamUrl) {
      return res.json({ success: true, url: sc.streamUrl, duration: sc.duration, cover: sc.cover });
    }
    res.status(404).json({ success: false, error: 'Stream not found' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/proxy-audio', async (req, res) => {
  try {
    const url = req.query.url;
    if (!url) return res.status(400).end();

    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const r = await axios({
      method: 'get',
      url,
      responseType: 'stream',
      headers,
      timeout: 25000,
      validateStatus: (status) => status < 400
    });

    res.set({
      'Content-Type': r.headers['content-type'] || 'audio/mpeg',
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*'
    });
    if (r.headers['content-length']) res.set('Content-Length', r.headers['content-length']);
    if (r.headers['content-range']) res.set('Content-Range', r.headers['content-range']);
    res.status(r.status);

    r.data.pipe(res);
  } catch (e) {
    res.status(500).end();
  }
});

// ──────────────────────────────────────────
// SOUNDCLOUD STREAM RESOLVER ENDPOINT
// ──────────────────────────────────────────
app.get('/api/soundcloud/stream', async (req, res) => {
  try {
    const { url, title, artist, id } = req.query;

    // 1. Direct SoundCloud media/transcoding URL (only if not preview)
    if (url && (url.includes('api-v2.soundcloud.com/media') || url.includes('/transcodings/')) && !url.includes('/preview/')) {
      const streamUrl = await resolveSoundCloudStream(url);
      if (streamUrl && !streamUrl.includes('preview')) {
        return res.json({ success: true, url: streamUrl });
      }
    }

    // 2. Search full track audio (SoundCloud full or YouTube fallback)
    const result = await resolveTrackAudio(title || '', artist || '');
    if (result && result.streamUrl) {
      return res.json({
        success: true,
        url: result.streamUrl,
        duration: result.duration,
        cover: result.cover,
        isYouTube: Boolean(result.isYouTube)
      });
    }

    // 3. Fallback to existing audioUrl if valid and not a 30s preview snippet
    if (url && url.startsWith('http') && !url.includes('pixabay.com') && !url.includes('preview')) {
      return res.json({ success: true, url });
    }

    res.status(404).json({ success: false, error: 'Could not resolve audio stream' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────
// SOCKET.IO REAL-TIME JAM & CHAT ENGINE
// ──────────────────────────────────────────
const jamRooms = {};

io.on('connection', (socket) => {
  // User connects & registers their socket ID
  socket.on('user:online', ({ userId }) => {
    if (userId) socket.join(`user:${userId}`);
  });

  // Jam: Host creates or joins room
  socket.on('jam:join_room', ({ roomCode, user }) => {
    if (!roomCode) return;
    socket.join(roomCode);
    if (!jamRooms[roomCode]) {
      jamRooms[roomCode] = {
        code: roomCode,
        hostId: socket.id,
        currentTrack: null,
        isPlaying: false,
        currentTime: 0,
        updatedAt: Date.now(),
        queue: [],
        members: []
      };
    }

    const room = jamRooms[roomCode];
    // Avoid duplicate member
    room.members = room.members.filter(m => m.socketId !== socket.id && (!user?.id || m.id !== user.id));
    const hasActiveHost = room.members.some(m => m.socketId === room.hostId);
    const isFirstMember = room.members.length === 0;
    const isHost = isFirstMember || !hasActiveHost || room.hostId === socket.id;
    if (isHost) {
      room.hostId = socket.id;
      room.members.forEach(m => { m.isHost = false; });
    }

    const member = {
      ...user,
      socketId: socket.id,
      isHost
    };

    room.members.push(member);

    // Broadcast full room state (members, queue, currentTrack) to everyone in the room
    io.to(roomCode).emit('jam:room_updated', room);

    // If a track is already set/playing, send immediate sync state to the new joiner
    if (room.currentTrack) {
      let liveTime = room.currentTime || 0;
      if (room.isPlaying && room.updatedAt) {
        const elapsed = (Date.now() - room.updatedAt) / 1000;
        if (elapsed > 0 && elapsed < 3600) {
          liveTime += elapsed;
        }
      }
      socket.emit('jam:sync_play_state', {
        isPlaying: room.isPlaying,
        currentTrack: room.currentTrack,
        currentTime: liveTime,
        updatedAt: room.updatedAt,
        initiatorId: 'server'
      });
    }
  });

  // Jam: Any participant syncs play state (track, play/pause, seek)
  socket.on('jam:sync_play_state', ({ roomCode, isPlaying, currentTrack, currentTime, initiatorId }) => {
    const room = jamRooms[roomCode];
    if (room) {
      let trackChanged = false;
      if (isPlaying !== undefined) room.isPlaying = isPlaying;
      if (currentTrack !== undefined && JSON.stringify(currentTrack) !== JSON.stringify(room.currentTrack)) {
        room.currentTrack = currentTrack;
        trackChanged = true;
      }
      if (currentTime !== undefined) room.currentTime = currentTime;
      room.updatedAt = Date.now();

      // Broadcast play state to other participants
      socket.to(roomCode).emit('jam:on_play_state_changed', {
        isPlaying: room.isPlaying,
        currentTrack: room.currentTrack,
        currentTime: room.currentTime,
        updatedAt: room.updatedAt,
        initiatorId: initiatorId || socket.id
      });

      if (trackChanged) {
        io.to(roomCode).emit('jam:room_updated', room);
      }
    }
  });

  // Jam: Add song to Linked Shared Queue
  socket.on('jam:add_to_queue', ({ roomCode, track }) => {
    const room = jamRooms[roomCode];
    if (room && track) {
      // If nothing is playing currently in room, immediately play this track
      if (!room.currentTrack) {
        room.currentTrack = track;
        room.isPlaying = true;
        room.currentTime = 0;
        room.updatedAt = Date.now();

        io.to(roomCode).emit('jam:on_play_state_changed', {
          isPlaying: true,
          currentTrack: track,
          currentTime: 0,
          updatedAt: room.updatedAt,
          initiatorId: socket.id
        });
      } else {
        // Append to shared queue
        room.queue.push({
          ...track,
          queuedBy: socket.id,
          queuedAt: Date.now()
        });
      }

      io.to(roomCode).emit('jam:room_updated', room);
    }
  });

  // Jam: Remove song from Linked Shared Queue
  socket.on('jam:remove_from_queue', ({ roomCode, trackIndex, trackId }) => {
    const room = jamRooms[roomCode];
    if (room && room.queue) {
      if (typeof trackIndex === 'number' && trackIndex >= 0 && trackIndex < room.queue.length) {
        room.queue.splice(trackIndex, 1);
      } else if (trackId) {
        room.queue = room.queue.filter(t => String(t.id || t._id) !== String(trackId));
      }
      io.to(roomCode).emit('jam:room_updated', room);
    }
  });

  // Jam: Skip / Play Next Track from Linked Queue
  socket.on('jam:next_track', ({ roomCode }) => {
    const room = jamRooms[roomCode];
    if (room) {
      if (room.queue && room.queue.length > 0) {
        const nextTrack = room.queue.shift();
        room.currentTrack = nextTrack;
        room.currentTime = 0;
        room.isPlaying = true;
        room.updatedAt = Date.now();

        io.to(roomCode).emit('jam:on_play_state_changed', {
          isPlaying: true,
          currentTrack: nextTrack,
          currentTime: 0,
          updatedAt: room.updatedAt,
          initiatorId: socket.id
        });
        io.to(roomCode).emit('jam:room_updated', room);
      } else {
        // Shared jam queue is empty: ask host to advance from host's local queue seamlessly
        if (room.hostId) {
          io.to(room.hostId).emit('jam:advance_host_queue', { roomCode });
        }
      }
    }
  });

  // Jam: Host kicks a participant
  socket.on('jam:kick_member', ({ roomCode, memberSocketId, memberId }) => {
    const room = jamRooms[roomCode];
    if (!room) return;
    if (room.hostId !== socket.id) return; // Only host can kick

    const target = room.members.find(m => m.socketId === memberSocketId || (memberId && (m.id === memberId || m._id === memberId)));
    if (!target || target.socketId === room.hostId) return; // Cannot kick host

    // Remove from room members
    room.members = room.members.filter(m => m.socketId !== target.socketId);

    // Notify kicked member
    io.to(target.socketId).emit('jam:kicked', {
      roomCode,
      reason: 'You were removed from the Jam room by the host.'
    });

    const targetSocket = io.sockets.sockets.get(target.socketId);
    if (targetSocket) {
      targetSocket.leave(roomCode);
    }

    io.to(roomCode).emit('jam:room_updated', room);
  });

  // Jam: Leave room
  socket.on('jam:leave_room', ({ roomCode }) => {
    socket.leave(roomCode);
    const room = jamRooms[roomCode];
    if (room) {
      room.members = room.members.filter(m => m.socketId !== socket.id);
      if (room.members.length === 0) {
        delete jamRooms[roomCode];
      } else {
        // If host left, pick a random remaining member to become the new host
        if (room.hostId === socket.id || !room.members.some(m => m.socketId === room.hostId)) {
          const randomIdx = Math.floor(Math.random() * room.members.length);
          room.members.forEach((m, idx) => { m.isHost = (idx === randomIdx); });
          room.hostId = room.members[randomIdx].socketId;
        }
        io.to(roomCode).emit('jam:room_updated', room);
      }
    }
  });

  socket.on('disconnect', () => {
    // Clean up user from all jam rooms
    for (const code in jamRooms) {
      const room = jamRooms[code];
      const hadMember = room.members.some(m => m.socketId === socket.id);
      if (hadMember) {
        room.members = room.members.filter(m => m.socketId !== socket.id);
        if (room.members.length === 0) {
          delete jamRooms[code];
        } else {
          // If host left or refreshed, pick a random remaining member to take host
          if (room.hostId === socket.id || !room.members.some(m => m.socketId === room.hostId)) {
            const randomIdx = Math.floor(Math.random() * room.members.length);
            room.members.forEach((m, idx) => { m.isHost = (idx === randomIdx); });
            room.hostId = room.members[randomIdx].socketId;
          }
          io.to(code).emit('jam:room_updated', room);
        }
      }
    }
  });
});

// Fallback SPA routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server running on port ${PORT}`));
