/**
 * Liofy Backend API Server — Full Rebuild
 * ✅ Real user accounts with cross-device sync
 * ✅ Global shared song library (all users see all songs)
 * ✅ File upload (MP3 + cover) stored as base64 in MongoDB
 * ✅ Per-user liked songs & playlists
 * ✅ YouTube + SoundCloud search
 * ✅ Offline support via Service Worker
 * ❌ Removed: Jam, Blend, AI Mixes
 */

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');

try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

const app = express();
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Serve Vite production build statically
app.use(express.static(path.join(__dirname, '../dist')));

const server = http.createServer(app);

const JWT_SECRET = process.env.JWT_SECRET || 'liofy_secure_key_2025';
const MONGO_URI = process.env.MONGO_URI || '';
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const SC_CLIENT_ID = process.env.SOUNDCLOUD_CLIENT_ID || '';

// ══════════════════════════════════════════
//  MongoDB Schemas
// ══════════════════════════════════════════

mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('⚠️ MongoDB error:', err.message));

// Track Schema — global library shared by all users
const TrackSchema = new mongoose.Schema({
  title:      { type: String, required: true },
  artist:     { type: String, required: true },
  album:      { type: String, default: 'Single' },
  cover:      { type: String, default: '' },       // URL or base64
  audioUrl:   { type: String, default: '' },       // URL or base64
  duration:   { type: Number, default: 210 },
  genre:      { type: String, default: 'Pop' },
  source:     { type: String, default: 'Upload' }, // 'Upload' | 'YouTube' | 'SoundCloud'
  addedBy:    { type: String, default: '' },       // user email who added it
  lyrics:     [{ time: Number, text: String }],
  color:      { type: String, default: '#1DB954' },
}, { timestamps: true, strict: false });

TrackSchema.index({ title: 'text', artist: 'text' });

// User Schema
const UserSchema = new mongoose.Schema({
  name:           { type: String, required: true },
  email:          { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:       { type: String, required: true },
  avatar:         { type: String, default: '' },
  likedTrackIds:  [{ type: String }],              // IDs of liked tracks
  playlists:      [{                               // user's own playlists
    id:           String,
    name:         String,
    description:  String,
    cover:        String,
    trackIds:     [String],
    isLikedSongs: Boolean,
    createdAt:    { type: Date, default: Date.now }
  }],
}, { timestamps: true });

const Track = mongoose.model('Track', TrackSchema);
const User  = mongoose.model('User', UserSchema);

// ══════════════════════════════════════════
//  Auth Helpers
// ══════════════════════════════════════════

function makeToken(user) {
  return jwt.sign(
    { id: user._id || user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '90d' }
  );
}

function authMiddleware(req, res, next) {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
}

function optionalAuth(req, res, next) {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); } catch {}
  }
  next();
}

// Multer — memory storage for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

// ══════════════════════════════════════════
//  1. AUTH ENDPOINTS
// ══════════════════════════════════════════

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(400).json({ error: 'This email is already registered' });

    const hashed = await bcrypt.hash(password, 12);
    const likedPlaylist = {
      id: `liked-${Date.now()}`,
      name: 'Liked Songs',
      description: 'Songs you liked',
      cover: '',
      trackIds: [],
      isLikedSongs: true,
    };

    const user = await new User({
      name: name || email.split('@')[0],
      email: email.toLowerCase().trim(),
      password: hashed,
      avatar: '',
      likedTrackIds: [],
      playlists: [likedPlaylist],
    }).save();

    const userObj = user.toObject();
    delete userObj.password;
    const token = makeToken(userObj);

    res.json({ success: true, user: userObj, token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'No account found with this email' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Wrong password' });

    const userObj = user.toObject();
    delete userObj.password;
    const token = makeToken(userObj);

    res.json({ success: true, user: userObj, token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get my profile + sync data
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update avatar / name
app.post('/api/auth/update-profile', authMiddleware, async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const updates = {};
    if (name)   updates.name   = name;
    if (avatar) updates.avatar = avatar;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true }
    ).select('-password');

    const token = makeToken(user.toObject());
    res.json({ success: true, user, token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════
//  2. GLOBAL TRACKS (Shared Library)
// ══════════════════════════════════════════

// Get all tracks (shared library — everyone sees all songs)
app.get('/api/tracks', optionalAuth, async (req, res) => {
  try {
    const tracks = await Track.find().sort({ createdAt: -1 }).limit(500).lean();
    const formatted = tracks.map(t => ({
      id:       String(t._id),
      title:    t.title,
      artist:   t.artist,
      album:    t.album,
      cover:    t.cover,
      audioUrl: t.audioUrl,
      duration: t.duration,
      genre:    t.genre,
      source:   t.source,
      addedBy:  t.addedBy,
      lyrics:   t.lyrics || [],
      color:    t.color || '#1DB954',
    }));
    res.json({ success: true, tracks: formatted });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add a track to global library
app.post('/api/tracks/add', optionalAuth, async (req, res) => {
  try {
    const data = req.body;
    if (!data.title || !data.artist) {
      return res.status(400).json({ error: 'Title and artist required' });
    }
    const track = await new Track({
      ...data,
      addedBy: req.user?.email || 'anonymous',
    }).save();

    res.json({ success: true, track: { ...track.toObject(), id: String(track._id) } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete a track (only the one who added it, or later: admin)
app.delete('/api/tracks/:id', authMiddleware, async (req, res) => {
  try {
    const track = await Track.findById(req.params.id);
    if (!track) return res.status(404).json({ error: 'Track not found' });
    if (track.addedBy !== req.user.email) {
      return res.status(403).json({ error: 'Only the uploader can delete this track' });
    }
    await Track.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════
//  3. FILE UPLOAD — MP3 + Cover → base64 → MongoDB
// ══════════════════════════════════════════

// Upload audio file
app.post('/api/upload/audio', authMiddleware, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' });
    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    res.json({ success: true, url: base64 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Upload cover image
app.post('/api/upload/cover', authMiddleware, upload.single('cover'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });
    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    res.json({ success: true, url: base64 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════
//  4. USER PLAYLISTS (per-user)
// ══════════════════════════════════════════

// Get my playlists
app.get('/api/playlists', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('playlists likedTrackIds');
    res.json({ success: true, playlists: user.playlists || [], likedTrackIds: user.likedTrackIds || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create playlist
app.post('/api/playlists/create', authMiddleware, async (req, res) => {
  try {
    const { name, description, cover } = req.body;
    const newPl = {
      id: `pl-${Date.now()}`,
      name,
      description: description || '',
      cover: cover || '',
      trackIds: [],
      isLikedSongs: false,
    };
    await User.findByIdAndUpdate(req.user.id, { $push: { playlists: newPl } });
    res.json({ success: true, playlist: newPl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add track to playlist
app.post('/api/playlists/:id/add-track', authMiddleware, async (req, res) => {
  try {
    const { trackId } = req.body;
    await User.findOneAndUpdate(
      { _id: req.user.id, 'playlists.id': req.params.id },
      { $addToSet: { 'playlists.$.trackIds': trackId } }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Remove track from playlist
app.post('/api/playlists/:id/remove-track', authMiddleware, async (req, res) => {
  try {
    const { trackId } = req.body;
    await User.findOneAndUpdate(
      { _id: req.user.id, 'playlists.id': req.params.id },
      { $pull: { 'playlists.$.trackIds': trackId } }
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete playlist
app.delete('/api/playlists/:id', authMiddleware, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { playlists: { id: req.params.id } }
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════
//  5. LIKED SONGS (per-user)
// ══════════════════════════════════════════

// Toggle like
app.post('/api/tracks/:id/like', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('likedTrackIds playlists');
    const trackId = req.params.id;
    const isLiked = user.likedTrackIds.includes(trackId);

    if (isLiked) {
      // Unlike
      await User.findByIdAndUpdate(req.user.id, {
        $pull: { likedTrackIds: trackId, 'playlists.$[pl].trackIds': trackId }
      }, { arrayFilters: [{ 'pl.isLikedSongs': true }] });
    } else {
      // Like
      await User.findByIdAndUpdate(req.user.id, {
        $addToSet: { likedTrackIds: trackId }
      });
      // Also add to liked songs playlist
      await User.findOneAndUpdate(
        { _id: req.user.id, 'playlists.isLikedSongs': true },
        { $addToSet: { 'playlists.$.trackIds': trackId } }
      );
    }

    res.json({ success: true, liked: !isLiked });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════
//  6. AUDIO PROXY (for CORS issues)
// ══════════════════════════════════════════

const { Readable } = require('stream');

app.get('/api/proxy-audio', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || !url.startsWith('http')) {
      return res.status(400).json({ error: 'Valid URL required' });
    }
    const audioRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!audioRes.ok) return res.status(502).json({ error: 'Upstream error' });

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', audioRes.headers.get('content-type') || 'audio/mpeg');
    if (audioRes.headers.get('content-length')) {
      res.setHeader('Content-Length', audioRes.headers.get('content-length'));
    }

    if (typeof Readable.fromWeb === 'function') {
      Readable.fromWeb(audioRes.body).pipe(res);
    } else {
      const buf = await audioRes.arrayBuffer();
      res.send(Buffer.from(buf));
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════
//  7. SEARCH — YouTube + SoundCloud
// ══════════════════════════════════════════

const searchCache = new Map();

function parseLrc(lrcText) {
  if (!lrcText) return [];
  return lrcText.split('\n').reduce((acc, line) => {
    const m = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (m) {
      const time = parseInt(m[1]) * 60 + parseInt(m[2]);
      const text = m[4].trim();
      if (text) acc.push({ time, text });
    }
    return acc;
  }, []);
}

async function searchYouTube(query) {
  if (YOUTUBE_API_KEY) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=10&key=${YOUTUBE_API_KEY}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.items?.length) {
          return data.items.map(item => ({
            id: `yt-${item.id.videoId}`,
            videoId: item.id.videoId,
            title: item.snippet?.title || 'YouTube Track',
            artist: item.snippet?.channelTitle || 'YouTube',
            cover: item.snippet?.thumbnails?.high?.url || `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`,
            duration: 210,
            source: 'YouTube',
          }));
        }
      }
    } catch {}
  }

  // Fallback: scrape
  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US' }
    });
    const html = await res.text();
    const m = html.match(/ytInitialData\s*=\s*({.*?});<\/script>/s)
           || html.match(/var ytInitialData\s*=\s*({.*?});/s);
    if (!m) return [];
    const data = JSON.parse(m[1]);
    const sections = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
    const items = [];
    for (const s of sections) {
      for (const item of (s.itemSectionRenderer?.contents || [])) {
        const v = item.videoRenderer;
        if (v?.videoId) {
          const dur = (() => {
            const t = v.lengthText?.simpleText || '3:30';
            const p = t.split(':').map(Number);
            return p.length === 2 ? p[0]*60+p[1] : 210;
          })();
          items.push({
            id: `yt-${v.videoId}`,
            videoId: v.videoId,
            title: v.title?.runs?.[0]?.text || 'YouTube',
            artist: v.ownerText?.runs?.[0]?.text || 'YouTube',
            cover: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
            duration: dur,
            source: 'YouTube',
          });
        }
      }
    }
    return items.slice(0, 10);
  } catch { return []; }
}

async function searchSoundCloud(query) {
  if (!SC_CLIENT_ID) return [];
  try {
    const res = await fetch(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${SC_CLIENT_ID}&limit=10`);
    if (!res.ok) return [];
    const data = await res.json();
    const items = [];
    for (const item of (data.collection || [])) {
      if ((item.duration || 0) < 35000) continue;
      const prog = item.media?.transcodings?.find(t => t.format?.protocol === 'progressive');
      if (!prog) continue;
      try {
        const sRes = await fetch(`${prog.url}?client_id=${SC_CLIENT_ID}`);
        if (!sRes.ok) continue;
        const sData = await sRes.json();
        if (!sData.url) continue;
        items.push({
          id: `sc-${item.id}`,
          title: item.title || 'SoundCloud',
          artist: item.user?.username || 'SoundCloud',
          cover: item.artwork_url?.replace('-large', '-t500x500') || '',
          audioUrl: sData.url,
          duration: Math.round((item.duration || 180000) / 1000),
          source: 'SoundCloud',
        });
      } catch {}
    }
    return items;
  } catch { return []; }
}

async function searchITunes(query) {
  try {
    const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=15`);
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.results || !Array.isArray(data.results)) return [];
    return data.results.map(item => ({
      id: `itunes-${item.trackId}`,
      title: item.trackName || 'Music Track',
      artist: item.artistName || 'Artist',
      album: item.collectionName || 'Single',
      cover: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : '',
      audioUrl: item.previewUrl || '',
      duration: Math.round((item.trackTimeMillis || 180000) / 1000),
      genre: item.primaryGenreName || 'Pop',
      source: 'iTunes',
    }));
  } catch { return []; }
}

app.get('/api/search', optionalAuth, async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json({ success: true, tracks: [] });

    const cacheKey = q.toLowerCase();
    if (searchCache.has(cacheKey)) {
      const c = searchCache.get(cacheKey);
      if (Date.now() - c.time < 300000) {
        return res.json({ success: true, tracks: c.tracks });
      }
    }

    // Fetch from DB first (global library)
    const dbTracks = await Track.find({
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { artist: { $regex: q, $options: 'i' } },
      ]
    }).limit(20).lean();

    const dbFormatted = dbTracks.map(t => ({
      id: String(t._id),
      title: t.title, artist: t.artist, cover: t.cover,
      audioUrl: t.audioUrl, duration: t.duration, source: t.source || 'Liofy',
      inLibrary: true,
    }));

    // Search external in parallel (YouTube + SoundCloud + iTunes)
    const [ytTracks, scTracks, itunesTracks] = await Promise.all([
      searchYouTube(q),
      searchSoundCloud(q),
      searchITunes(q),
    ]);

    // Fetch lyrics for external tracks
    let lrcData = [];
    try {
      const lrcRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`);
      if (lrcRes.ok) lrcData = await lrcRes.json();
    } catch {}

    const findLyrics = (title) => {
      const match = lrcData.find(l => l.trackName?.toLowerCase().includes(title.toLowerCase()));
      if (match?.syncedLyrics) return parseLrc(match.syncedLyrics);
      return [];
    };

    const externalTracks = [...scTracks, ...ytTracks, ...itunesTracks].map(t => ({
      ...t,
      lyrics: findLyrics(t.title),
      inLibrary: false,
    }));

    // Deduplicate by title & artist
    const seen = new Set();
    const all = [];
    [...dbFormatted, ...externalTracks].forEach(t => {
      const key = `${(t.title || '').toLowerCase()}-${(t.artist || '').toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(t);
      }
    });

    searchCache.set(cacheKey, { time: Date.now(), tracks: all });

    res.json({ success: true, tracks: all });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ══════════════════════════════════════════
//  8. FULL USER SYNC (login from any device)
// ══════════════════════════════════════════

app.get('/api/sync', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    const allTracks = await Track.find().sort({ createdAt: -1 }).limit(500).lean();
    const formatted = allTracks.map(t => ({
      id:       String(t._id),
      title:    t.title,
      artist:   t.artist,
      album:    t.album,
      cover:    t.cover,
      audioUrl: t.audioUrl,
      duration: t.duration,
      genre:    t.genre,
      source:   t.source,
      addedBy:  t.addedBy,
      lyrics:   t.lyrics || [],
      color:    t.color || '#1DB954',
      liked:    user.likedTrackIds.includes(String(t._id)),
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

// ══════════════════════════════════════════
//  Fallback SPA Route
// ══════════════════════════════════════════
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Liofy Server running on port ${PORT}`);
});
