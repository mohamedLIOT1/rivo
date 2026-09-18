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
    description: String
  }]
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
// Auth Helpers
// ──────────────────────────────────────────
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

async function resolveSoundCloudTrack(query) {
  if (!query || !query.trim()) return null;
  let clientId = await getSoundCloudClientId();
  try {
    let res;
    try {
      res = await axios.get('https://api-v2.soundcloud.com/search/tracks', {
        params: { q: query.trim(), client_id: clientId, limit: 6 },
        timeout: 5000
      });
    } catch (err) {
      if (err.response?.status === 401) {
        clientId = await getSoundCloudClientId(true);
        res = await axios.get('https://api-v2.soundcloud.com/search/tracks', {
          params: { q: query.trim(), client_id: clientId, limit: 6 },
          timeout: 5000
        });
      } else {
        throw err;
      }
    }

    const collection = res.data?.collection || [];
    for (const item of collection) {
      // Reject 30-second snippets / preview-only tracks!
      if (item.policy === 'SNIP' || (item.duration || 0) <= 35000) continue;
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

  // 1. Prioritize YouTube: Guaranteed official original version with full uninterrupted audio
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

  // 2. Fallback to SoundCloud only if YouTube fails
  try {
    const sc = await resolveSoundCloudTrack(query);
    if (sc && sc.streamUrl) return sc;
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
    res.json({ success: true, user: userObj, token: makeToken(user) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const userObj = user.toObject();
    delete userObj.password;
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
    res.json({ success: true, user });
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
    if (!q || q.length < 2) return res.json({ success: true, users: [] });

    // Search ONLY by name, NEVER search or expose email
    const users = await User.find({
      name: { $regex: q, $options: 'i' }
    })
    .select('_id name avatar bio playlists followers following')
    .limit(20)
    .lean();

    const sanitized = users.map(u => ({
      id: String(u._id),
      name: u.name,
      avatar: u.avatar,
      bio: u.bio || '',
      publicPlaylists: (u.playlists || []).filter(p => p.isPublic !== false && !p.isLikedSongs),
      followersCount: (u.followers || []).length,
      followingCount: (u.following || []).length
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
        isFollowing
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
        bio: f.bio || ''
      }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────
// DIRECT CHAT MESSAGES
// ──────────────────────────────────────────
app.get('/api/chat/:recipientId', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const recipientId = req.params.recipientId;

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

    const msg = await new Message({
      sender: req.user.id,
      recipient: recipientId,
      text: text || '',
      track: track || null,
      jamInvite: jamInvite || null
    }).save();

    // Broadcast via socket if available
    io.to(`user:${recipientId}`).emit('chat:message', msg);
    io.to(`user:${req.user.id}`).emit('chat:message', msg);

    res.json({ success: true, message: msg });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────
// FAST MUSIC SEARCH & STREAM RESOLVER (Cached)
// ──────────────────────────────────────────
app.get(['/api/search', '/api/search/external'], async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ success: true, tracks: [] });

  const cacheKey = q.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return res.json({ success: true, tracks: cached.tracks });
  }

  try {
    // 1. Check local DB tracks
    const dbTracks = await Track.find({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { artist: { $regex: q, $options: 'i' } }
      ]
    }).limit(10).lean();

    const formattedDbTracks = dbTracks.map(t => ({
      id: String(t._id),
      title: t.title,
      artist: t.artist,
      album: t.album || 'Single',
      cover: t.cover,
      audioUrl: t.audioUrl,
      duration: t.duration || 180,
      source: 'Liofy'
    }));

    // 2. Query SoundCloud with dynamic client ID
    let scTracks = [];
    let clientId = await getSoundCloudClientId();
    try {
      let scRes;
      try {
        scRes = await axios.get('https://api-v2.soundcloud.com/search/tracks', {
          params: { q, client_id: clientId, limit: 15 },
          timeout: 4000
        });
      } catch (err) {
        if (err.response?.status === 401) {
          clientId = await getSoundCloudClientId(true);
          scRes = await axios.get('https://api-v2.soundcloud.com/search/tracks', {
            params: { q, client_id: clientId, limit: 15 },
            timeout: 4000
          });
        } else {
          throw err;
        }
      }

      if (scRes?.data?.collection?.length > 0) {
        const valid = scRes.data.collection.filter(item => (item.duration || 0) > 30000);
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

    // 3. Query YouTube for official releases
    let ytTracks = [];
    try {
      const ytRes = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        timeout: 4000
      });
      const jsonMatch = ytRes.data.match(/var ytInitialData = ({.*?});<\/script>/s) || ytRes.data.match(/ytInitialData = ({.*?});<\/script>/s);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[1]);
        const contents = parsed.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
        ytTracks = contents
          .filter(c => c.videoRenderer && c.videoRenderer.videoId)
          .slice(0, 8)
          .map(c => {
            const v = c.videoRenderer;
            return {
              id: `yt-${v.videoId}`,
              title: v.title?.runs?.[0]?.text || q,
              artist: v.ownerText?.runs?.[0]?.text || 'YouTube',
              album: 'YouTube',
              cover: v.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
              audioUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
              duration: 240,
              source: 'YouTube'
            };
          });
      }
    } catch {}

    const allTracks = [...formattedDbTracks, ...ytTracks, ...scTracks];
    searchCache.set(cacheKey, { timestamp: Date.now(), tracks: allTracks });

    res.json({ success: true, tracks: allTracks });
  } catch (e) {
    res.json({ success: true, tracks: [] });
  }
});

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
          headers: { 'User-Agent': 'Mozilla/5.0' },
          timeout: 10000
        });
        const html = ytRes.data;
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
          playlistTitle = titleMatch[1].replace(' - YouTube', '').trim();
        }
        // Extract video titles
        const videoTitleMatches = [...html.matchAll(/"title":{"runs":\[{"text":"([^"]+)"}\]/g)];
        const seen = new Set();
        for (const m of videoTitleMatches) {
          const t = m[1];
          if (!seen.has(t) && t.length > 2 && !t.includes('YouTube') && seen.size < 50) {
            seen.add(t);
            rawItems.push({ title: t, artist: 'YouTube', duration: 200 });
          }
        }
      } catch (err) {
        console.warn('YouTube scrape failed:', err.message);
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

    // Save tracks to database with SoundCloud on-demand stream resolution
    const trackIds = [];
    const createdTracks = [];

    for (const item of rawItems.slice(0, 50)) { // up to 50 tracks
      try {
        const duration = item.duration || 180;
        const ytId = await searchYouTubeId(`${item.artist} - ${item.title}`);
        let trackCover = await fetchTrackCover(item.title, item.artist);
        if (!trackCover && ytId) trackCover = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
        if (!trackCover) trackCover = playlistCover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';

        const audioUrl = ytId ? `https://www.youtube.com/watch?v=${ytId}` : '';

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

        const trackObj = {
          id: String(newTrack._id),
          _id: String(newTrack._id),
          title: item.title,
          artist: item.artist,
          album: playlistTitle,
          cover: trackCover,
          audioUrl,
          duration,
          genre: 'Imported',
          source: 'YouTube'
        };

        trackIds.push(String(newTrack._id));
        createdTracks.push(trackObj);
      } catch (err) {}
    }

    // Add new playlist to user
    const user = await User.findById(req.user.id);
    const newPlaylist = {
      id: `pl-${Date.now()}`,
      name: playlistTitle,
      cover: playlistCover,
      trackIds,
      isLikedSongs: false,
      isPublic: true,
      description: `Imported from ${url.includes('spotify') ? 'Spotify' : url.includes('youtube') ? 'YouTube' : 'External'} (${trackIds.length} tracks)`
    };

    user.playlists.push(newPlaylist);
    await user.save();

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
    const formatted = await Promise.all(tracks.map(async (t) => {
      let cover = t.cover;
      // If cover is missing or generic unsplash, fetch real track artwork
      if (t.title && (!cover || cover.includes('unsplash') || cover.includes('pixabay') || cover.includes('format=svg'))) {
        const real = await fetchTrackCover(t.title, t.artist);
        if (real) {
          cover = real;
          Track.updateOne({ _id: t._id }, { $set: { cover: real } }).exec().catch(() => {});
        }
      }

      return {
        id: String(t._id),
        _id: String(t._id),
        title: t.title,
        artist: t.artist,
        album: t.album,
        cover: cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
        audioUrl: t.audioUrl && !t.audioUrl.includes('pixabay.com') && !t.audioUrl.includes('preview') ? t.audioUrl : '',
        duration: t.duration || 180,
        genre: t.genre,
        source: t.source || 'SoundCloud',
        lyrics: t.lyrics || []
      };
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
    const pl = u.playlists.find(p => String(p.id) === String(req.params.id));
    if (!pl) return res.status(404).json({ error: 'Playlist not found' });
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

// Remove track from playlist
const removeTrackFromPlaylistHandler = async (req, res) => {
  try {
    const playlistId = String(req.params.id || '');
    const trackIdStr = String(req.body.trackId || req.params.trackId || '');
    if (!trackIdStr) return res.status(400).json({ error: 'trackId required' });

    let u = null;
    if (req.user && req.user.id) {
      u = await User.findById(req.user.id);
    }
    if (!u) {
      u = await User.findOne({ 'playlists.id': playlistId });
    }
    if (!u) return res.status(404).json({ error: 'Playlist or user not found' });

    const pl = u.playlists.find(p => String(p.id) === playlistId);
    if (!pl) return res.status(404).json({ error: 'Playlist not found' });

    pl.trackIds = (pl.trackIds || []).filter(id => String(id) !== trackIdStr);
    await u.save();
    res.json({ success: true, trackIds: pl.trackIds });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
app.post('/api/playlists/:id/remove-track', optionalAuth, removeTrackFromPlaylistHandler);
app.delete('/api/playlists/:id/tracks/:trackId', optionalAuth, removeTrackFromPlaylistHandler);

app.post('/api/playlists/:id/update', auth, async (req, res) => {
  try {
    const u = await User.findById(req.user.id);
    const pl = u.playlists.find(p => String(p.id) === String(req.params.id));
    if (!pl) return res.status(404).end();
    if (req.body.name) pl.name = req.body.name;
    if (req.body.cover) pl.cover = req.body.cover;
    if (req.body.isPublic !== undefined) pl.isPublic = req.body.isPublic;
    await u.save();
    res.json({ success: true });
  } catch (e) {
    res.status(500).end();
  }
});

app.delete('/api/playlists/:id', auth, async (req, res) => {
  try {
    const u = await User.findById(req.user.id);
    u.playlists = u.playlists.filter(p => String(p.id) !== String(req.params.id));
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

async function fetchLrclibLyrics(title, artist, duration) {
  if (!title) return [];
  const cleanTitle = (title || '').replace(/\(.*?\)|\[.*?\]|\|.*$/g, '').trim();
  const cleanArtist = (artist || '').replace(/\(.*?\)|\[.*?\]/g, '').trim();

  try {
    const res = await axios.get('https://lrclib.net/api/search', {
      params: { q: `${cleanArtist} ${cleanTitle}`.trim() },
      headers: { 'User-Agent': 'LiofyApp/1.0 (https://github.com/mohamedLIOT1/liofy)' },
      timeout: 4000
    });
    const items = res.data || [];
    for (const item of items) {
      if (item.syncedLyrics) return parseLrc(item.syncedLyrics);
      if (item.plainLyrics) return parsePlain(item.plainLyrics, duration);
    }
  } catch {}
  return [];
}

app.post('/api/ai/generate-song-lyrics', async (req, res) => {
  try {
    const { trackId, title, artist, duration } = req.body;
    let lyrics = await fetchLrclibLyrics(title, artist, duration || 180);
    if (lyrics && lyrics.length > 0 && trackId) {
      try {
        await Track.updateOne({ _id: trackId }, { $set: { lyrics } });
      } catch {}
    }
    res.json({ success: true, lyrics });
  } catch (e) {
    res.json({ success: false, lyrics: [] });
  }
});

app.post('/api/tracks/update-lyrics', async (req, res) => {
  try {
    const { trackId, lyrics } = req.body;
    if (trackId && Array.isArray(lyrics)) {
      await Track.updateOne({ _id: trackId }, { $set: { lyrics } });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/tracks/clear-lyrics', async (req, res) => {
  try {
    const { trackId } = req.body;
    if (trackId) {
      await Track.updateOne({ _id: trackId }, { $set: { lyrics: [] } });
    }
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

// Direct SoundCloud MP3 audio stream fallback for unblocked playback
app.get('/api/soundcloud/fallback', async (req, res) => {
  try {
    const { title, artist } = req.query;
    const q = `${artist || ''} ${title || ''}`.trim();
    if (!q) return res.status(400).json({ error: 'Query required' });

    const sc = await resolveSoundCloudTrack(q);
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
    socket.join(roomCode);
    if (!jamRooms[roomCode]) {
      jamRooms[roomCode] = {
        code: roomCode,
        hostId: socket.id,
        currentTrack: null,
        isPlaying: false,
        currentTime: 0,
        members: []
      };
    }

    const room = jamRooms[roomCode];
    // Avoid duplicate member
    room.members = room.members.filter(m => m.socketId !== socket.id && m.id !== user?.id);
    const member = {
      ...user,
      socketId: socket.id,
      isHost: room.hostId === socket.id || room.members.length === 0
    };
    if (member.isHost) room.hostId = socket.id;

    room.members.push(member);
    io.to(roomCode).emit('jam:room_updated', room);
  });

  // Jam: Host syncs play state (track, play/pause, seek)
  socket.on('jam:sync_play_state', ({ roomCode, isPlaying, currentTrack, currentTime }) => {
    const room = jamRooms[roomCode];
    if (room) {
      if (isPlaying !== undefined) room.isPlaying = isPlaying;
      if (currentTrack !== undefined) room.currentTrack = currentTrack;
      if (currentTime !== undefined) room.currentTime = currentTime;

      socket.to(roomCode).emit('jam:on_play_state_changed', {
        isPlaying: room.isPlaying,
        currentTrack: room.currentTrack,
        currentTime: room.currentTime
      });
    }
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
        if (room.hostId === socket.id) {
          room.hostId = room.members[0].socketId;
          room.members[0].isHost = true;
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
          if (room.hostId === socket.id) {
            room.hostId = room.members[0].socketId;
            room.members[0].isHost = true;
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
