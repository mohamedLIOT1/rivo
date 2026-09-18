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
// In-Memory Search & Stream Cache
// ──────────────────────────────────────────
const searchCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const SOUNDCLOUD_CLIENT_IDS = [
  'Mxv2e5wxnWei6krLywjIXpztX7S0VCeK',
  'iZ8g4v72mUqvA8jGFBsFoxWYuERgZaWi',
  '2t9loNfteI00aOFmOGUT8gahnev8pMrQ'
];

async function resolveSoundCloudStream(url, clientId) {
  try {
    const res = await axios.get(`${url}?client_id=${clientId}`, { timeout: 4000 });
    return res.data?.url || null;
  } catch {
    return null;
  }
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

    // 2. Query SoundCloud with multi-client rotation
    let scTracks = [];
    for (const clientId of SOUNDCLOUD_CLIENT_IDS) {
      try {
        const scRes = await axios.get('https://api-v2.soundcloud.com/search/tracks', {
          params: { q, client_id: clientId, limit: 12 },
          timeout: 4000
        });

        if (scRes.data?.collection?.length > 0) {
          const valid = scRes.data.collection.filter(item => (item.duration || 0) > 30000);
          const resolved = await Promise.all(
            valid.slice(0, 8).map(async (item) => {
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
          if (scTracks.length > 0) break;
        }
      } catch (err) {
        // try next client_id
      }
    }

    const allTracks = [...formattedDbTracks, ...scTracks];
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

    // Now resolve tracks into database or search stream so they are ready to play
    const trackIds = [];
    const createdTracks = [];
    const clientId = SOUNDCLOUD_CLIENT_IDS[0];

    for (const item of rawItems.slice(0, 50)) { // up to 50 tracks
      try {
        let resolvedAudioUrl = '';
        let coverUrl = playlistCover;
        let duration = item.duration || 180;

        try {
          const scRes = await axios.get('https://api-v2.soundcloud.com/search/tracks', {
            params: { q: `${item.artist} ${item.title}`, client_id: clientId, limit: 1 },
            timeout: 2500
          });
          const match = scRes.data?.collection?.[0];
          if (match) {
            const prog = match.media?.transcodings?.find(t => t.format?.protocol === 'progressive');
            if (prog) {
              resolvedAudioUrl = await resolveSoundCloudStream(prog.url, clientId) || '';
            }
            if (match.artwork_url) coverUrl = match.artwork_url.replace('-large', '-t500x500');
            if (match.duration) duration = Math.round(match.duration / 1000);
          }
        } catch {}

        const newTrack = await new Track({
          title: item.title,
          artist: item.artist,
          album: playlistTitle,
          cover: coverUrl,
          audioUrl: resolvedAudioUrl || 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
          duration,
          genre: 'Imported',
          source: 'Import'
        }).save();

        const trackObj = {
          id: String(newTrack._id),
          _id: String(newTrack._id),
          title: item.title,
          artist: item.artist,
          album: playlistTitle,
          cover: coverUrl,
          audioUrl: resolvedAudioUrl || 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
          duration,
          genre: 'Imported',
          source: 'Import'
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
    res.json({
      success: true,
      tracks: tracks.map(t => ({
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
        lyrics: t.lyrics || []
      }))
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
    const pl = u.playlists.find(p => p.id === req.params.id);
    if (!pl) return res.status(404).json({ error: 'Playlist not found' });
    if (!pl.trackIds.includes(req.body.trackId)) pl.trackIds.push(req.body.trackId);
    await u.save();
    res.json({ success: true });
  } catch (e) {
    res.status(500).end();
  }
});

app.post('/api/playlists/:id/update', auth, async (req, res) => {
  try {
    const u = await User.findById(req.user.id);
    const pl = u.playlists.find(p => p.id === req.params.id);
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
    u.playlists = u.playlists.filter(p => p.id !== req.params.id);
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

app.post('/api/tracks/create', auth, async (req, res) => {
  try {
    const newTrack = await new Track({
      ...req.body,
      addedBy: req.user.id
    }).save();
    res.json({ success: true, track: newTrack });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/proxy-audio', async (req, res) => {
  try {
    const r = await axios({
      method: 'get',
      url: req.query.url,
      responseType: 'stream',
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 25000
    });
    r.data.pipe(res);
  } catch (e) {
    res.status(500).end();
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
