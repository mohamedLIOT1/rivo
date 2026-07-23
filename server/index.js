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
const MONGO_URI = (process.env.MONGO_URI || 'mongodb+srv://mohamedmustafat79_db_user:LiofyPass12345@cluster0.sr4ypsh.mongodb.net/liofy_db?retryWrites=true&w=majority').trim();
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const SC_CLIENT_ID = process.env.SOUNDCLOUD_CLIENT_ID || '';

// ══════════════════════════════════════════
//  MongoDB Schemas
// ══════════════════════════════════════════

mongoose.set('bufferCommands', false);

if (MONGO_URI) {
  mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 15000,
  })
    .then(() => console.log('✅ MongoDB connected successfully'))
    .catch(err => console.error('⚠️ MongoDB connection error:', err.message));
} else {
  console.warn('⚠️ MONGO_URI is missing in environment variables.');
}

// Middleware to prevent 10s buffering timeouts when DB is disconnected
const checkDbConnection = (req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    if (mongoose.connection.readyState === 1) {
      clearInterval(interval);
      return next();
    }
    if (attempts >= 15) {
      clearInterval(interval);
      return res.status(503).json({
        error: 'قاعدة البيانات غير متصلة حالياً. يرجى التحقق من إعدادات MONGO_URI وإتاحة IP Access List (0.0.0.0/0) في MongoDB Atlas.'
      });
    }
  }, 200);
};

app.use('/api/auth/login', checkDbConnection);
app.use('/api/auth/register', checkDbConnection);
app.use('/api/auth/me', checkDbConnection);

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

// Delete a track (from MongoDB shared library)
app.delete('/api/tracks/:id', optionalAuth, async (req, res) => {
  try {
    const id = req.params.id;
    let deleted = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      deleted = await Track.findByIdAndDelete(id);
    }
    if (!deleted) {
      deleted = await Track.findOneAndDelete({ $or: [{ _id: id }, { id: id }] });
    }
    res.json({ success: true, deleted: !!deleted });
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
//  6. AUDIO PROXY — YouTube Full Audio (ytdl-core + Piped fallbacks)
// ══════════════════════════════════════════

const { Readable } = require('stream');

// Try to load @distube/ytdl-core (best YouTube support)
let ytdl = null;
try {
  ytdl = require('@distube/ytdl-core');
  console.log('✅ @distube/ytdl-core loaded');
} catch {
  try {
    ytdl = require('ytdl-core');
    console.log('✅ ytdl-core loaded');
  } catch {
    console.warn('⚠️ No ytdl library — will use Piped API fallbacks');
  }
}

// Multiple Piped API instances for fallback
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.adminforge.de',
  'https://piped-api.garudalinux.org',
  'https://api.piped.projectsegfau.lt',
  'https://pipedapi.tokhmi.xyz',
];

// Cache for resolved YouTube URLs (TTL: 5 hours)
const ytUrlCache = new Map();
const YT_CACHE_TTL = 5 * 60 * 60 * 1000;

function extractVideoId(urlOrId) {
  if (!urlOrId) return null;
  const match = urlOrId.match(/(?:v=|\/|embed\/|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : (urlOrId.length === 11 ? urlOrId : null);
}

async function resolveWithYtdl(videoId) {
  if (!ytdl) return null;
  try {
    const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`, {
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120',
          'Accept-Language': 'en-US,en;q=0.9',
        }
      }
    });
    // Pick best audio-only format
    const format = ytdl.chooseFormat(info.formats, {
      quality: 'highestaudio',
      filter: 'audioonly',
    });
    return format?.url || null;
  } catch (e) {
    console.warn(`[ytdl] Failed for ${videoId}:`, e.message?.substring(0, 80));
    return null;
  }
}

async function resolveWithPiped(videoId) {
  for (const base of PIPED_INSTANCES) {
    try {
      const res = await fetch(`${base}/streams/${videoId}`, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.audioStreams?.length) continue;

      // Prefer opus/mp4 audio
      const audio =
        data.audioStreams.find(s => s.mimeType?.includes('audio/mp4') && s.quality?.includes('160')) ||
        data.audioStreams.find(s => s.mimeType?.includes('audio/mp4')) ||
        data.audioStreams.find(s => s.mimeType?.includes('opus')) ||
        data.audioStreams[0];

      if (audio?.url) {
        console.log(`[Piped] Resolved via ${base}`);
        return audio.url;
      }
    } catch {}
  }
  return null;
}

async function resolveWithInvidious(videoId) {
  const instances = [
    'https://inv.zoomerville.com',
    'https://invidious.slipfox.xyz',
    'https://yt.artemislena.eu',
  ];
  for (const base of instances) {
    try {
      const res = await fetch(`${base}/api/v1/videos/${videoId}?fields=adaptiveFormats`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const formats = data.adaptiveFormats || [];
      const audio = formats.find(f => f.type?.includes('audio/mp4')) || formats.find(f => f.type?.includes('audio'));
      if (audio?.url) {
        console.log(`[Invidious] Resolved via ${base}`);
        return audio.url;
      }
    } catch {}
  }
  return null;
}

async function resolveYouTubeAudio(videoId) {
  // Check cache
  const cached = ytUrlCache.get(videoId);
  if (cached && Date.now() - cached.time < YT_CACHE_TTL) {
    return cached.url;
  }

  console.log(`[Audio] Resolving YouTube audio for: ${videoId}`);

  // Try all methods in order
  let audioUrl = await resolveWithYtdl(videoId);
  if (!audioUrl) audioUrl = await resolveWithPiped(videoId);
  if (!audioUrl) audioUrl = await resolveWithInvidious(videoId);

  if (audioUrl) {
    ytUrlCache.set(videoId, { url: audioUrl, time: Date.now() });
    console.log(`[Audio] ✅ Resolved ${videoId}`);
  } else {
    console.warn(`[Audio] ❌ All methods failed for ${videoId}`);
  }

  return audioUrl;
}

// /api/yt-resolve — returns just the URL (for client-side redirect)
app.get('/api/yt-resolve', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Video ID required' });
    const audioUrl = await resolveYouTubeAudio(id);
    if (!audioUrl) return res.status(502).json({ error: 'Could not resolve audio stream' });
    res.json({ success: true, url: audioUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// /api/proxy-audio — streams audio with range support
app.get('/api/proxy-audio', async (req, res) => {
  try {
    let { url } = req.query;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'Valid URL required' });
    }

    // Resolve YouTube URLs
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = extractVideoId(url);
      if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });

      // If ytdl is available, stream directly without proxy
      if (ytdl && ytdl.validateID(videoId)) {
        try {
          const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
          const format = ytdl.chooseFormat(info.formats, {
            quality: 'highestaudio',
            filter: 'audioonly',
          });
          if (format) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Content-Type', format.mimeType || 'audio/mp4');
            if (format.contentLength) res.setHeader('Content-Length', format.contentLength);
            res.setHeader('Accept-Ranges', 'bytes');

            const stream = ytdl(`https://www.youtube.com/watch?v=${videoId}`, {
              format,
              highWaterMark: 64 * 1024,
            });
            stream.pipe(res);
            stream.on('error', (e) => {
              console.warn('[ytdl stream error]', e.message);
              if (!res.headersSent) res.status(500).end();
            });
            return;
          }
        } catch (e) {
          console.warn('[ytdl direct stream failed, falling back to URL]', e.message?.substring(0, 80));
        }
      }

      // Fallback: resolve URL and proxy it
      const audioUrl = await resolveYouTubeAudio(videoId);
      if (!audioUrl) {
        return res.status(502).json({ error: 'Failed to resolve YouTube audio. Please try again.' });
      }
      url = audioUrl;
    }

    // Proxy the resolved URL (with Range support for seeking)
    const rangeHeader = req.headers.range;
    const fetchHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
      'Referer': 'https://www.youtube.com/',
    };
    if (rangeHeader) fetchHeaders['Range'] = rangeHeader;

    const audioRes = await fetch(url, { headers: fetchHeaders });
    if (!audioRes.ok && audioRes.status !== 206) {
      return res.status(502).json({ error: `Upstream error: ${audioRes.status}` });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', audioRes.headers.get('content-type') || 'audio/mp4');
    if (audioRes.headers.get('content-length')) res.setHeader('Content-Length', audioRes.headers.get('content-length'));
    if (audioRes.headers.get('content-range')) res.setHeader('Content-Range', audioRes.headers.get('content-range'));
    res.setHeader('Accept-Ranges', 'bytes');
    res.status(audioRes.status === 206 ? 206 : 200);

    if (typeof Readable.fromWeb === 'function') {
      Readable.fromWeb(audioRes.body).pipe(res);
    } else {
      const buf = await audioRes.arrayBuffer();
      res.send(Buffer.from(buf));
    }
  } catch (e) {
    console.error('[proxy-audio error]', e.message);
    if (!res.headersSent) res.status(500).json({ error: e.message });
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

// Dynamic SoundCloud Client ID Management
let cachedScClientId = null;
let cachedScClientIdTime = 0;

async function getSoundCloudClientId() {
  if (SC_CLIENT_ID) return SC_CLIENT_ID;
  if (cachedScClientId && (Date.now() - cachedScClientIdTime < 3600000)) {
    return cachedScClientId;
  }
  try {
    const res = await fetch('https://soundcloud.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    const scriptUrls = html.match(/https:\/\/a-v2\.sndcdn\.com\/assets\/[^\"]+\.js/g);
    if (scriptUrls) {
      for (let url of scriptUrls.reverse()) {
        try {
          const sRes = await fetch(url);
          const js = await sRes.text();
          const match = js.match(/client_id[:=]\s*["']([a-zA-Z0-9]{32})["']/);
          if (match) {
            cachedScClientId = match[1];
            cachedScClientIdTime = Date.now();
            return cachedScClientId;
          }
        } catch {}
      }
    }
  } catch (e) {
    console.warn('[Liofy Server] Failed to fetch SC homepage for client_id:', e.message);
  }
  return 'Mxv2e5wxnWei6krLywjIXpztX7S0VCeK';
}

async function searchSoundCloud(query) {
  try {
    const clientId = await getSoundCloudClientId();
    if (!clientId) return [];

    const res = await fetch(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${clientId}&limit=15`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
      }
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || !Array.isArray(data.collection)) return [];

    const items = [];
    for (const item of data.collection) {
      if ((item.duration || 0) < 30000) continue;
      const prog = item.media?.transcodings?.find(t => t.format?.protocol === 'progressive');
      if (!prog) continue;

      try {
        const sRes = await fetch(`${prog.url}?client_id=${clientId}`);
        if (!sRes.ok) continue;
        const sData = await sRes.json();
        if (!sData.url) continue;

        items.push({
          id: `sc-${item.id}`,
          title: item.title || 'SoundCloud Track',
          artist: item.user?.username || 'SoundCloud Artist',
          album: 'Single',
          cover: item.artwork_url
            ? item.artwork_url.replace('-large', '-t500x500')
            : (item.user?.avatar_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600'),
          audioUrl: sData.url,
          duration: Math.round((item.duration || 180000) / 1000),
          source: 'SoundCloud',
          isFullSong: true,
        });
      } catch {}
    }
    return items;
  } catch (e) {
    console.error('[Liofy Server] SoundCloud search error:', e.message);
    return [];
  }
}

async function resolveYoutubeAudioStream(videoId) {
  try {
    const pipedRes = await fetch(`https://pipedapi.kavin.rocks/streams/${videoId}`);
    if (pipedRes.ok) {
      const data = await pipedRes.json();
      if (data.audioStreams && data.audioStreams.length > 0) {
        return data.audioStreams[0].url;
      }
    }
  } catch {}
  
  try {
    const pipedRes = await fetch(`https://pipedapi.adminforge.de/streams/${videoId}`);
    if (pipedRes.ok) {
      const data = await pipedRes.json();
      if (data.audioStreams && data.audioStreams.length > 0) {
        return data.audioStreams[0].url;
      }
    }
  } catch {}

  return null;
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
            audioUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
            duration: 210,
            source: 'YouTube',
            isFullSong: true,
          }));
        }
      }
    } catch {}
  }

  // Fallback 1: scrape YouTube HTML
  try {
    const res = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8' 
      }
    });
    const html = await res.text();
    const match = html.match(/var ytInitialData = ({.*?});<\/script>/) || html.match(/ytInitialData\s*=\s*({.*?});<\/script>/);
    if (match) {
      const data = JSON.parse(match[1]);
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
              audioUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
              duration: dur,
              source: 'YouTube',
              isFullSong: true,
            });
          }
        }
      }
      if (items.length > 0) return items.slice(0, 10);
    }
  } catch (e) {
    console.error('[Liofy Server] YouTube scrape error:', e.message);
  }

  // Fallback 2: Invidious API
  try {
    const invRes = await fetch(`https://inv.zoomerville.com/api/v1/search?q=${encodeURIComponent(query)}&type=video`);
    if (invRes.ok) {
      const data = await invRes.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.slice(0, 10).map(item => ({
          id: `yt-${item.videoId}`,
          videoId: item.videoId,
          title: item.title || 'YouTube Track',
          artist: item.author || 'YouTube',
          cover: item.videoThumbnails?.[0]?.url || `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
          audioUrl: `https://www.youtube.com/watch?v=${item.videoId}`,
          duration: item.lengthSeconds || 210,
          source: 'YouTube',
          isFullSong: true,
        }));
      }
    }
  } catch {}

  return [];
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

    // Fetch from DB first (global library) safely
    let dbFormatted = [];
    try {
      if (mongoose.connection.readyState === 1) {
        const dbTracks = await Track.find({
          $or: [
            { title: { $regex: q, $options: 'i' } },
            { artist: { $regex: q, $options: 'i' } },
          ]
        }).limit(20).lean();

        dbFormatted = dbTracks.map(t => ({
          id: String(t._id),
          title: t.title, artist: t.artist, cover: t.cover,
          audioUrl: t.audioUrl, duration: t.duration, source: t.source || 'Liofy',
          inLibrary: true,
          isFullSong: true,
        }));
      }
    } catch (dbErr) {
      console.warn('[Liofy Server] DB search skipped:', dbErr.message);
    }

    // Search external in parallel (SoundCloud full songs + YouTube)
    const [scTracks, ytTracks] = await Promise.all([
      searchSoundCloud(q),
      searchYouTube(q),
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

    const externalTracks = [...scTracks, ...ytTracks].map(t => ({
      ...t,
      lyrics: findLyrics(t.title),
      inLibrary: false,
    }));

    // Deduplicate by title & artist
    const seenMap = new Map();
    [...dbFormatted, ...externalTracks].forEach(t => {
      const key = `${(t.title || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '')}-${(t.artist || '').toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '')}`;
      if (!seenMap.has(key)) {
        seenMap.set(key, t);
      }
    });

    const all = Array.from(seenMap.values());
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
//  9. AUTO-SEED — يملأ DB بأغاني YouTube تلقائياً لو DB فاضي
// ══════════════════════════════════════════

// قائمة أغاني YouTube الأصلية للـ auto-seed
const AUTO_SEED_SONGS = [
  // 🇪🇬 Arab
  { q: 'عمرو دياب نور العين official', artist: 'عمرو دياب', genre: 'Arab Pop' },
  { q: 'عمرو دياب وأنا عشت official', artist: 'عمرو دياب', genre: 'Arab Pop' },
  { q: 'عمرو دياب تملي معاك official', artist: 'عمرو دياب', genre: 'Arab Pop' },
  { q: 'محمد حماقي بحبك official audio', artist: 'محمد حماقي', genre: 'Arab Pop' },
  { q: 'محمد حماقي أنسى official', artist: 'محمد حماقي', genre: 'Arab Pop' },
  { q: 'تامر حسني اتعلمت official', artist: 'تامر حسني', genre: 'Arab Pop' },
  { q: 'أنغام فارقني official', artist: 'أنغام', genre: 'Arab Pop' },
  { q: 'نانسي عجرم أه ونص official', artist: 'نانسي عجرم', genre: 'Arab Pop' },
  { q: 'اليسا بتحبني ليه official', artist: 'اليسا', genre: 'Arab Pop' },
  { q: 'وائل كفوري ما بعرف official', artist: 'وائل كفوري', genre: 'Arab Pop' },
  { q: 'سعد لمجرد ya nass official', artist: 'سعد لمجرد', genre: 'Arab Pop' },
  { q: 'حسن شاكوش روتين official', artist: 'حسن شاكوش', genre: 'Mahragan' },
  { q: 'عمر كمال دلع official', artist: 'عمر كمال', genre: 'Mahragan' },
  { q: 'حكيم والاه زمان official', artist: 'حكيم', genre: 'Sha3bi' },
  // 🌍 International
  { q: 'The Weeknd Blinding Lights official audio', artist: 'The Weeknd', genre: 'Pop' },
  { q: 'The Weeknd Save Your Tears official audio', artist: 'The Weeknd', genre: 'Pop' },
  { q: 'The Weeknd Starboy official audio', artist: 'The Weeknd', genre: 'Pop' },
  { q: 'Ed Sheeran Shape of You official audio', artist: 'Ed Sheeran', genre: 'Pop' },
  { q: 'Ed Sheeran Perfect official audio', artist: 'Ed Sheeran', genre: 'Pop' },
  { q: 'Taylor Swift Anti-Hero official audio', artist: 'Taylor Swift', genre: 'Pop' },
  { q: 'Dua Lipa Levitating official audio', artist: 'Dua Lipa', genre: 'Pop' },
  { q: 'Billie Eilish bad guy official audio', artist: 'Billie Eilish', genre: 'Pop' },
  { q: 'Ariana Grande 7 rings official audio', artist: 'Ariana Grande', genre: 'Pop' },
  { q: 'Bruno Mars Uptown Funk official audio', artist: 'Bruno Mars', genre: 'Pop' },
  { q: 'Harry Styles As It Was official audio', artist: 'Harry Styles', genre: 'Pop' },
  { q: 'Drake God\'s Plan official audio', artist: 'Drake', genre: 'Hip-Hop' },
  { q: 'Eminem Lose Yourself official audio', artist: 'Eminem', genre: 'Hip-Hop' },
  { q: 'Coldplay Yellow official audio', artist: 'Coldplay', genre: 'Rock' },
  { q: 'Imagine Dragons Believer official audio', artist: 'Imagine Dragons', genre: 'Rock' },
  { q: 'Avicii Wake Me Up official audio', artist: 'Avicii', genre: 'Electronic' },
];

const SEED_GENRE_COLORS = {
  'Arab Pop': '#C9A84C', 'Mahragan': '#E94560', 'Sha3bi': '#F5A623',
  'Pop': '#1DB954', 'Hip-Hop': '#9B59B6', 'R&B': '#E74C3C',
  'Rock': '#E67E22', 'Electronic': '#3498DB',
};

async function seedYouTubeTrack({ q, artist, genre }) {
  // Try YouTube official API
  if (YOUTUBE_API_KEY) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}&type=video&videoCategoryId=10&maxResults=3&key=${YOUTUBE_API_KEY}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.items?.length) {
          const item = data.items[0];
          const videoId = item.id.videoId;
          const exists = await Track.findOne({ audioUrl: { $regex: videoId } });
          if (exists) return false;
          const cleanTitle = item.snippet.title
            .replace(/\s*[\(\[](official\s*)?(audio|video|music video|lyric)[\)\]]/gi, '')
            .replace(/\s*-\s*(official\s*)?(audio|video)/gi, '').trim();
          await new Track({
            title: cleanTitle || q,
            artist,
            album: 'Single',
            cover: item.snippet.thumbnails.high?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            audioUrl: `https://www.youtube.com/watch?v=${videoId}`,
            duration: 210,
            genre,
            source: 'YouTube',
            addedBy: 'auto-seed',
            color: SEED_GENRE_COLORS[genre] || '#FF0000',
          }).save();
          return true;
        }
      }
    } catch {}
  }

  // Fallback: Invidious
  const INVIDIOUS = ['https://inv.zoomerville.com', 'https://invidious.slipfox.xyz'];
  for (const base of INVIDIOUS) {
    try {
      const res = await fetch(`${base}/api/v1/search?q=${encodeURIComponent(q)}&type=video&page=1`);
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) continue;
      const v = data.find(x => x.type === 'video' && x.lengthSeconds > 60 && x.lengthSeconds < 600);
      if (!v) continue;
      const exists = await Track.findOne({ audioUrl: { $regex: v.videoId } });
      if (exists) return false;
      const cleanTitle = v.title
        .replace(/\s*[\(\[](official\s*)?(audio|video|music video|lyric)[\)\]]/gi, '')
        .replace(/\s*-\s*(official\s*)?(audio|video)/gi, '').trim();
      await new Track({
        title: cleanTitle || q,
        artist,
        album: 'Single',
        cover: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
        audioUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
        duration: v.lengthSeconds || 210,
        genre,
        source: 'YouTube',
        addedBy: 'auto-seed',
        color: SEED_GENRE_COLORS[genre] || '#FF0000',
      }).save();
      return true;
    } catch {}
  }
  return false;
}

// Endpoint to trigger seeding (can be called from frontend or manually)
app.post('/api/auto-seed', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ error: 'DB not connected' });
    }
    const count = await Track.countDocuments();
    if (count >= 20) {
      return res.json({ success: true, message: `DB already has ${count} tracks`, seeded: 0 });
    }

    res.json({ success: true, message: 'Seeding started in background...', currentCount: count });

    // Run seeding in background (non-blocking)
    (async () => {
      let added = 0;
      for (const song of AUTO_SEED_SONGS) {
        try {
          const ok = await seedYouTubeTrack(song);
          if (ok) added++;
          await new Promise(r => setTimeout(r, 600));
        } catch {}
      }
      console.log(`🌱 Auto-seed complete: added ${added} YouTube tracks`);
    })();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Auto-seed on server startup if DB is empty
async function autoSeedOnStartup() {
  try {
    await new Promise(r => setTimeout(r, 5000)); // Wait for DB connection
    if (mongoose.connection.readyState !== 1) return;
    const count = await Track.countDocuments();
    if (count > 0) {
      console.log(`📦 DB has ${count} tracks — skipping auto-seed`);
      return;
    }
    console.log('🌱 DB is empty — starting auto-seed from YouTube...');
    let added = 0;
    for (const song of AUTO_SEED_SONGS) {
      try {
        const ok = await seedYouTubeTrack(song);
        if (ok) { added++; process.stdout.write(`🎵 +${added} `); }
        await new Promise(r => setTimeout(r, 700));
      } catch {}
    }
    console.log(`\n✅ Auto-seed done: ${added} tracks added!`);
  } catch (e) {
    console.warn('⚠️ Auto-seed error:', e.message);
  }
}

autoSeedOnStartup();

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
