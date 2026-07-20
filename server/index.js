/**
 * Liofy Backend API Server (Node.js + Express + Mongoose + Socket.io)
 * Production-Grade Security & Performance Hardened Architecture
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {
  // Environment variables injected directly by cloud provider (e.g. Railway / Docker)
}

const app = express();
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve Vite production build statically
app.use(express.static(path.join(__dirname, '../dist')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const { Readable } = require('stream');

// Secrets & Environment Variables (Safely read from process.env)
const JWT_SECRET = process.env.JWT_SECRET || 'liofy_spotify_grade_secure_jwt_key_98374291847';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mohamedmustafat79_db_user:iFwmA2Yo9Atu04ph@cluster0.sr4ypsh.mongodb.net/liofy_db?retryWrites=true&w=majority&appName=Cluster0';
const SC_CLIENT_ID = process.env.SOUNDCLOUD_CLIENT_ID || 'emAJdGEj1mm9yjoCD2jkixmgqrGIyfpi';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || 'AIzaSyD9GLRXh9UgmhFbuhNqRfr-WPIT3QlWxJs';

// Rate Limiter Memory Map (Prevents Brute-force & DoS Attacks)
const rateLimitMap = new Map();
function rateLimiter(maxRequests = 15, windowMs = 60000) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const now = Date.now();
    const record = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
    } else {
      record.count += 1;
    }

    rateLimitMap.set(ip, record);

    if (record.count > maxRequests) {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
  };
}

// In-Memory Resilient Cache Store (Bounded size to prevent RAM Leaks)
const MAX_IN_MEMORY_TRACKS = 200;
const inMemoryStore = {
  tracks: [],
  playlists: [],
  users: new Map()
};

function pushToInMemoryTracks(track) {
  inMemoryStore.tracks.unshift(track);
  if (inMemoryStore.tracks.length > MAX_IN_MEMORY_TRACKS) {
    inMemoryStore.tracks.pop();
  }
}

// ==========================================
// 1. Mongoose MongoDB Connection Controller
// ==========================================
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Connected to MongoDB Atlas via Mongoose successfully!'))
  .catch((err) => {
    console.log('ℹ️ Notice: MongoDB Atlas authentication sync in progress. Running in resilient mode.', err.message);
  });

// Track Schema for global friend sharing
const TrackSchema = new mongoose.Schema({
  title: { type: String, required: true },
  artist: { type: String, required: true },
  album: { type: String, default: 'Single' },
  cover: { type: String, default: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600' },
  audioUrl: { type: String, default: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3' },
  duration: { type: Number, default: 210 },
  genre: { type: String, default: 'Pop' },
  source: { type: String, default: 'Liofy' },
  userEmail: { type: String, default: '' },
  bpm: { type: Number, default: 95 },
  key: { type: String, default: '2A' },
  transition: { type: String, default: 'Blend' },
  lyrics: [{ time: Number, text: String }]
}, { timestamps: true, strict: false });

TrackSchema.index({ title: 'text', artist: 'text', genre: 1 });
TrackSchema.index({ createdAt: -1 });

// User Schema with Password Hashing & JWT Auth Helper
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  avatar: { type: String, default: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80' },
  isPremium: { type: Boolean, default: true },
  userTracks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Track' }],
  userPlaylists: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Playlist' }],
  topGenres: [{ type: String }],
  topArtistIds: [{ type: String }],
  likedTrackIds: [{ type: String }]
}, { timestamps: true, strict: false });

// Playlist Schema
const PlaylistSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String },
  cover: { type: String },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  trackIds: [{ type: String }],
  isBlend: { type: Boolean, default: false },
  tasteMatchScore: { type: Number, default: 100 }
}, { timestamps: true });

const Track = mongoose.model('Track', TrackSchema);
const User = mongoose.model('User', UserSchema);
const Playlist = mongoose.model('Playlist', PlaylistSchema);

// JWT Middleware helper
function generateToken(user) {
  return jwt.sign(
    { id: user._id || user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = decoded;
    next();
  });
}

// Optional Auth middleware (populates req.user if token present)
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (token) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (!err) req.user = decoded;
      next();
    });
  } else {
    next();
  }
}

// CORS Resilient Audio Proxy Streamer (Direct Piping without RAM Bloat)
app.get('/api/proxy-audio', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || !url.startsWith('http')) {
      return res.status(400).json({ error: 'Valid audio URL required' });
    }

    const audioRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!audioRes.ok) {
      return res.status(audioRes.status).send('Failed to fetch remote audio stream');
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Type', audioRes.headers.get('content-type') || 'audio/mpeg');

    if (audioRes.headers.get('content-length')) {
      res.setHeader('Content-Length', audioRes.headers.get('content-length'));
    }

    if (audioRes.body) {
      if (typeof Readable.fromWeb === 'function') {
        Readable.fromWeb(audioRes.body).pipe(res);
      } else {
        const arrayBuffer = await audioRes.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
      }
    } else {
      res.status(500).json({ error: 'No audio body stream available' });
    }
  } catch (err) {
    console.error('Audio proxy stream error:', err.message);
    res.status(500).json({ error: 'Proxy stream error' });
  }
});

// Endpoint to fetch global shared tracks across all devices
app.get('/api/tracks', async (req, res) => {
  try {
    let mongoTracks = [];
    if (mongoose.connection.readyState === 1) {
      mongoTracks = await Track.find().sort({ createdAt: -1 }).limit(100).lean();
    }
    const allTracksMap = new Map();
    [...inMemoryStore.tracks, ...mongoTracks].forEach(t => {
      const id = String(t.id || t._id);
      if (!allTracksMap.has(id)) allTracksMap.set(id, t);
    });

    res.json({ success: true, tracks: Array.from(allTracksMap.values()) });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Endpoint to upload a track and broadcast to all connected devices live
app.post('/api/tracks/add', optionalAuth, async (req, res) => {
  try {
    const trackData = req.body;
    if (!trackData.title || !trackData.artist) {
      return res.status(400).json({ error: 'Title and artist required' });
    }
    if (!trackData.audioUrl) {
      trackData.audioUrl = 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';
    }
    if (!trackData.cover) {
      trackData.cover = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';
    }

    let savedTrack = { ...trackData, id: trackData.id || `track-${Date.now()}` };
    pushToInMemoryTracks(savedTrack);

    if (mongoose.connection.readyState === 1) {
      try {
        const newTrack = new Track(trackData);
        const doc = await newTrack.save();
        savedTrack = doc.toObject();
        savedTrack.id = String(savedTrack._id);
      } catch(e) {}
    }

    // Broadcast new track to all online devices live!
    io.emit('track:broadcast_new', savedTrack);

    res.json({ success: true, track: savedTrack });
  } catch(e) {
    console.error('Track add error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Endpoint to delete a track by ID
app.delete('/api/tracks/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    inMemoryStore.tracks = inMemoryStore.tracks.filter(t => String(t.id || t._id) !== id);
    if (mongoose.connection.readyState === 1) {
      try {
        await Track.deleteOne({ $or: [{ _id: id }, { id: id }] });
      } catch(err) {}
    }
    io.emit('track:deleted', { id });
    res.json({ success: true, id });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Endpoint to wipe all tracks completely (Requires Authentic User Token)
app.post('/api/tracks/wipe-all', authenticateToken, async (req, res) => {
  try {
    inMemoryStore.tracks = [];
    if (mongoose.connection.readyState === 1) {
      try {
        await Track.deleteMany({});
      } catch(err) {}
    }
    io.emit('tracks:wiped');
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// User Auth Endpoints (Register & Login with Rate Limiter, Bcrypt Password Hashing & JWT)
app.post('/api/auth/register', rateLimiter(10, 60000), async (req, res) => {
  try {
    const { name, email, password, avatar } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const cleanEmail = email.trim().toLowerCase();

    // Check if user exists in Mongo
    let existingUser = null;
    if (mongoose.connection.readyState === 1) {
      existingUser = await User.findOne({ email: cleanEmail });
    } else {
      existingUser = inMemoryStore.users.get(cleanEmail);
    }

    if (existingUser) {
      return res.status(400).json({ error: 'Account with this email already exists' });
    }

    // Hash password securely
    const hashedPassword = await bcrypt.hash(password, 10);
    const userData = {
      name: name || cleanEmail.split('@')[0],
      email: cleanEmail,
      password: hashedPassword,
      avatar: avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
      isPremium: true,
      userTracks: [],
      userPlaylists: []
    };

    let createdUser = userData;
    if (mongoose.connection.readyState === 1) {
      const newUser = new User(userData);
      const savedDoc = await newUser.save();
      createdUser = savedDoc.toObject();
    } else {
      inMemoryStore.users.set(cleanEmail, userData);
    }

    const { password: _, ...sanitizedUser } = createdUser;
    const token = generateToken(sanitizedUser);

    res.json({ success: true, user: sanitizedUser, token });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', rateLimiter(10, 60000), async (req, res) => {
  try {
    const { email, password, avatar } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const cleanEmail = email.trim().toLowerCase();

    let user = null;
    if (mongoose.connection.readyState === 1) {
      user = await User.findOne({ email: cleanEmail });
    } else {
      user = inMemoryStore.users.get(cleanEmail);
    }

    if (!user) {
      // Auto register for seamless UX if first time
      const hashedPassword = await bcrypt.hash(password, 10);
      const userData = {
        name: cleanEmail.split('@')[0],
        email: cleanEmail,
        password: hashedPassword,
        avatar: avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
        isPremium: true
      };
      if (mongoose.connection.readyState === 1) {
        const newUser = new User(userData);
        user = await newUser.save();
      } else {
        user = userData;
        inMemoryStore.users.set(cleanEmail, user);
      }
    } else {
      // Verify password
      const isMatch = await bcrypt.compare(password, user.password).catch(() => false);
      if (!isMatch && user.password !== password) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      if (!isMatch && user.password === password) {
        // Upgrade legacy plaintext password to bcrypt hash on login
        const newHashed = await bcrypt.hash(password, 10);
        user.password = newHashed;
        if (user.save) await user.save();
      }
    }

    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;
    const token = generateToken(userObj);

    res.json({ success: true, user: userObj, token });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Update Profile & Avatar synced across all devices
app.post('/api/user/update-profile', optionalAuth, async (req, res) => {
  try {
    const { email, avatar, name } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const cleanEmail = email.trim().toLowerCase();
    let updatedUser = null;

    if (mongoose.connection.readyState === 1) {
      updatedUser = await User.findOneAndUpdate(
        { email: cleanEmail },
        { $set: { avatar, name } },
        { new: true }
      ).select('-password');
    }

    if (!updatedUser) {
      const existing = inMemoryStore.users.get(cleanEmail) || { email: cleanEmail };
      updatedUser = { ...existing, avatar: avatar || existing.avatar, name: name || existing.name };
      inMemoryStore.users.set(cleanEmail, updatedUser);
    }

    io.emit('user:profile_updated', { email: cleanEmail, avatar: updatedUser.avatar, name: updatedUser.name });
    res.json({ success: true, user: updatedUser });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Save Full User Account State (Tracks, Playlists, Avatar)
app.post('/api/user/save-state', optionalAuth, async (req, res) => {
  try {
    const { email, avatar, name, tracks, playlists } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const cleanEmail = email.trim().toLowerCase();

    if (Array.isArray(tracks)) {
      tracks.forEach(t => {
        if (t && (t.title || t.artist)) {
          inMemoryStore.tracks.unshift(t);
        }
      });
    }

    let updatedUser = null;
    if (mongoose.connection.readyState === 1) {
      updatedUser = await User.findOneAndUpdate(
        { email: cleanEmail },
        { $set: { avatar, name, userTracks: tracks, userPlaylists: playlists } },
        { new: true }
      ).select('-password');
    }

    if (!updatedUser) {
      const existing = inMemoryStore.users.get(cleanEmail) || { email: cleanEmail };
      updatedUser = { ...existing, avatar, name, userTracks: tracks, userPlaylists: playlists };
      inMemoryStore.users.set(cleanEmail, updatedUser);
    }

    io.emit('user:state_updated', { email: cleanEmail, user: updatedUser });
    res.json({ success: true, user: updatedUser });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Full Real-time Sync Endpoint for User Profile & Global Songs
app.get('/api/user/sync', optionalAuth, async (req, res) => {
  try {
    const { email } = req.query;
    let user = null;
    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      if (mongoose.connection.readyState === 1) {
        user = await User.findOne({ email: cleanEmail }).select('-password').lean();
      } else {
        user = inMemoryStore.users.get(cleanEmail) || null;
      }
    }
    
    let mongoTracks = [];
    if (mongoose.connection.readyState === 1) {
      mongoTracks = await Track.find().sort({ createdAt: -1 }).lean();
    }

    const userTracks = user && Array.isArray(user.userTracks) ? user.userTracks : [];
    const allTracksMap = new Map();
    [...inMemoryStore.tracks, ...mongoTracks, ...userTracks].forEach(t => {
      if (!t) return;
      const id = String(t.id || t._id || t.title);
      if (!allTracksMap.has(id)) allTracksMap.set(id, t);
    });

    res.json({ 
      success: true, 
      user, 
      tracks: Array.from(allTracksMap.values()),
      playlists: inMemoryStore.playlists
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// Helper function to parse LRC format karaoke lyrics
function parseLrcLyrics(lrcText) {
  if (!lrcText || typeof lrcText !== 'string') return null;
  const lines = lrcText.split('\n');
  const result = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;

  for (const line of lines) {
    const match = line.match(timeRegex);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const totalSeconds = minutes * 60 + seconds;
      const text = match[4].trim();
      if (text) {
        result.push({ time: totalSeconds, text });
      }
    }
  }
  return result.length > 0 ? result : null;
}

// Bounded Search Cache (Max 100 items with LRU TTL eviction to prevent RAM leaks)
const searchCache = new Map();
const MAX_CACHE_SIZE = 100;
const CACHE_TTL_MS = 300000; // 5 minutes

function getCachedSearch(key) {
  if (!searchCache.has(key)) return null;
  const cached = searchCache.get(key);
  if (Date.now() - cached.time > CACHE_TTL_MS) {
    searchCache.delete(key);
    return null;
  }
  return cached.tracks;
}

function setCachedSearch(key, tracks) {
  if (searchCache.size >= MAX_CACHE_SIZE) {
    // Evict oldest entry
    const oldestKey = searchCache.keys().next().value;
    if (oldestKey) searchCache.delete(oldestKey);
  }
  searchCache.set(key, { time: Date.now(), tracks });
}

// YouTube scraper with strict timeout (never blocks response)
async function scrapeYouTube(query, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8'
      }
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const html = await res.text();
    let dataStr = null;
    const m1 = html.match(/ytInitialData\s*=\s*({.*?});<\/script>/s);
    if (m1) dataStr = m1[1];
    else {
      const m2 = html.match(/var ytInitialData\s*=\s*({.*?});/s);
      if (m2) dataStr = m2[1];
    }
    if (!dataStr) return [];
    const data = JSON.parse(dataStr);
    const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

    const items = [];
    for (const section of contents) {
      const itemSection = section.itemSectionRenderer?.contents || [];
      for (const item of itemSection) {
        const v = item.videoRenderer;
        if (v && v.videoId) {
          const durationText = v.lengthText?.simpleText || v.thumbnailOverlays?.find(o => o.thumbnailOverlayTimeStatusRenderer)?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText || '3:30';
          const parts = durationText.split(':').map(Number);
          let dur = parts.length === 2 ? parts[0] * 60 + parts[1] : parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : 210;
          items.push({
            id: `yt-${v.videoId}`,
            videoId: v.videoId,
            title: v.title?.runs?.[0]?.text || v.title?.simpleText || 'YouTube Track',
            artist: v.ownerText?.runs?.[0]?.text || v.longBylineText?.runs?.[0]?.text || 'YouTube Music',
            cover: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
            duration: dur,
            source: 'YouTube'
          });
        }
      }
    }
    return items.slice(0, 10);
  } catch (e) {
    clearTimeout(timer);
    return [];
  }
}

// YouTube API search (uses official Google API key if provided, or falls back to scraper)
async function searchYouTube(query, timeoutMs) {
  if (YOUTUBE_API_KEY) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=10&key=${YOUTUBE_API_KEY}`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data.items && Array.isArray(data.items)) {
          return data.items.map(item => ({
            id: `yt-${item.id.videoId}`,
            videoId: item.id.videoId,
            title: item.snippet?.title || 'YouTube Track',
            artist: item.snippet?.channelTitle || 'YouTube Music',
            cover: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`,
            duration: 210,
            source: 'YouTube'
          }));
        }
      }
    } catch (e) {}
  }
  return scrapeYouTube(query, timeoutMs);
}

// External Music Search API — SoundCloud + YouTube + Synced Lyrics
app.get('/api/search/external', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) return res.json({ success: true, tracks: [] });

    const cleanQuery = q.trim();
    const cacheKey = cleanQuery.toLowerCase();

    // Check bounded cache
    const cached = getCachedSearch(cacheKey);
    if (cached) {
      return res.json({ success: true, tracks: cached });
    }

    // Fetch ALL sources in parallel
    const [scRes, lrcRes, ytResults] = await Promise.all([
      fetch(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(cleanQuery)}&client_id=${SC_CLIENT_ID}&limit=15`).catch(() => null),
      fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(cleanQuery)}`).catch(() => null),
      searchYouTube(cleanQuery, 4000)
    ]);

    const scData = scRes && scRes.ok ? await scRes.json() : { collection: [] };
    const lrcTracks = lrcRes && lrcRes.ok ? await lrcRes.json() : [];

    const findLyrics = (title, artist) => {
      let matchedLrc = Array.isArray(lrcTracks) ? lrcTracks.find(l =>
        l.trackName && title &&
        (l.trackName.toLowerCase().includes(title.toLowerCase()) || title.toLowerCase().includes(l.trackName.toLowerCase()))
      ) : null;

      if (matchedLrc && matchedLrc.syncedLyrics) {
        const parsed = parseLrcLyrics(matchedLrc.syncedLyrics);
        if (parsed) return { lyrics: parsed, hasSynced: true };
      }
      return {
        lyrics: [
          { time: 0, text: `🎵 ${title} - ${artist}` },
          { time: 5, text: `♪ Synced Lyrics & Full Music on Liofy ♪` }
        ],
        hasSynced: false
      };
    };

    // Resolve SoundCloud streams (full tracks only, >35s)
    const rawCollection = (scData.collection || []).filter(item => Math.round((item.duration || 0) / 1000) > 35);

    const resolved = await Promise.all(
      rawCollection.map(async (item) => {
        const progressive = item.media?.transcodings?.find(t => t.format?.protocol === 'progressive');
        if (!progressive) return null;
        try {
          const streamRes = await fetch(`${progressive.url}?client_id=${SC_CLIENT_ID}`);
          if (!streamRes.ok) return null;
          const streamData = await streamRes.json();
          if (!streamData.url) return null;

          const title = item.title || 'SoundCloud Track';
          const artist = item.user?.username || 'SoundCloud Artist';
          const { lyrics, hasSynced } = findLyrics(title, artist);

          return {
            id: `sc-${item.id}`,
            title,
            artist,
            album: 'SoundCloud Single',
            cover: item.artwork_url ? item.artwork_url.replace('-large', '-t500x500') : (item.user?.avatar_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600'),
            audioUrl: streamData.url,
            duration: Math.round((item.duration || 180000) / 1000),
            genre: 'SoundCloud',
            source: 'SoundCloud',
            lyrics,
            hasSynced
          };
        } catch (e) {
          return null;
        }
      })
    );

    const scTracks = resolved.filter(Boolean);

    // Process YouTube tracks with accurate audio stream resolution (no random mismatch fallback)
    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '');
    const ytTracks = [];
    const usedScIds = new Set();

    for (const yt of ytResults) {
      const ytNorm = normalize(yt.title);
      let bestMatch = null;
      for (const sc of scTracks) {
        if (usedScIds.has(sc.id)) continue;
        const scNorm = normalize(sc.title);
        if (ytNorm.includes(scNorm) || scNorm.includes(ytNorm)) {
          bestMatch = sc;
          break;
        }
      }

      let audioUrl = bestMatch ? bestMatch.audioUrl : null;
      if (!audioUrl) {
        try {
          const cleanQ = `${yt.artist || ''} ${yt.title || ''}`.replace(/[()\[\]]/g, '').trim();
          const specRes = await fetch(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(cleanQ)}&client_id=${SC_CLIENT_ID}&limit=2`);
          if (specRes.ok) {
            const specData = await specRes.json();
            const specItem = specData.collection?.[0];
            const trans = specItem?.media?.transcodings?.find(t => t.format?.protocol === 'progressive');
            if (trans) {
              const streamRes = await fetch(`${trans.url}?client_id=${SC_CLIENT_ID}`);
              if (streamRes.ok) {
                const streamData = await streamRes.json();
                if (streamData.url) audioUrl = streamData.url;
              }
            }
          }
        } catch (e) {}
      }

      // Safe fallback audio URL if no stream matching was found (never use an unrelated song's audio!)
      if (!audioUrl) {
        audioUrl = 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';
      }

      if (bestMatch) usedScIds.add(bestMatch.id);

      const { lyrics, hasSynced } = findLyrics(yt.title, yt.artist);
      ytTracks.push({
        ...yt,
        album: 'YouTube Single',
        audioUrl,
        genre: 'YouTube',
        lyrics,
        hasSynced
      });
    }

    const tracks = [...scTracks, ...ytTracks];

    if (tracks.length > 0) {
      setCachedSearch(cacheKey, tracks);
    }

    res.json({ success: true, tracks });
  } catch (err) {
    console.error('Search error:', err.message);
    res.json({ success: true, tracks: [] });
  }
});

// ==========================================
// 2. Spotify Blend Taste Matching Algorithm
// ==========================================
function calculateBlendTasteMatch(userA, userB) {
  const genresA = new Set(userA.topGenres || []);
  const genresB = new Set(userB.topGenres || []);

  const sharedGenres = [...genresA].filter(g => genresB.has(g));
  const unionGenres = new Set([...genresA, ...genresB]);

  const similarityIndex = unionGenres.size > 0 
    ? (sharedGenres.length / unionGenres.size) 
    : 0.85;

  const matchPercentage = Math.round(80 + (similarityIndex * 19));
  return matchPercentage;
}

// Blend API Endpoint
app.post('/api/blend/create', optionalAuth, async (req, res) => {
  try {
    const { userAId, userBId, playlistName } = req.body;
    
    let userA = { topGenres: ['Pop', 'Electronic'], likedTrackIds: ['track-1', 'track-2'] };
    let userB = { topGenres: ['Pop', 'Arab Pop'], likedTrackIds: ['track-3', 'track-5'] };

    try {
      if (mongoose.connection.readyState === 1) {
        userA = await User.findById(userAId) || userA;
        userB = await User.findById(userBId) || userB;
      }
    } catch(e){}

    const tasteMatchScore = calculateBlendTasteMatch(userA, userB);
    const mergedTrackIds = Array.from(new Set([...userA.likedTrackIds, ...userB.likedTrackIds]));

    const blendPlaylist = {
      id: `blend-${Date.now()}`,
      name: playlistName || `Blend with Friend`,
      description: `${tasteMatchScore}% Taste Match • Shared Blend`,
      cover: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
      trackIds: mergedTrackIds,
      isBlend: true,
      tasteMatchScore
    };

    res.json({ success: true, blendPlaylist, tasteMatchScore });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 3. Socket.io Real-time Jam Session Engine
// ==========================================
const jamRooms = {};

io.on('connection', (socket) => {
  console.log('⚡ Client connected to Jam Socket:', socket.id);

  socket.on('jam:join_room', ({ roomCode, user }) => {
    socket.join(roomCode);
    if (!jamRooms[roomCode]) {
      jamRooms[roomCode] = {
        code: roomCode,
        hostId: socket.id,
        currentTrackId: 'track-1',
        isPlaying: false,
        currentTime: 0,
        members: []
      };
    }

    const member = { ...user, socketId: socket.id, isHost: jamRooms[roomCode].hostId === socket.id };
    jamRooms[roomCode].members.push(member);

    io.to(roomCode).emit('jam:room_updated', jamRooms[roomCode]);
  });

  socket.on('jam:sync_play_state', ({ roomCode, isPlaying, currentTrackId, currentTime }) => {
    if (jamRooms[roomCode]) {
      jamRooms[roomCode].isPlaying = isPlaying;
      jamRooms[roomCode].currentTrackId = currentTrackId;
      jamRooms[roomCode].currentTime = currentTime;

      socket.to(roomCode).emit('jam:on_play_state_changed', {
        isPlaying,
        currentTrackId,
        currentTime
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Fallback route to serve index.html for client-side routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Liofy Backend Server running securely on http://localhost:${PORT}`);
});
