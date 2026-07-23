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

// Auto-fetch & save synced lyrics for any newly added track
async function autoFetchAndSaveLyrics(track) {
  if (!track || (Array.isArray(track.lyrics) && track.lyrics.length > 0)) return;
  try {
    const lyrics = await fetchRealLyricsFromLrclib(track.title, track.artist, track.duration);
    if (lyrics.length > 0 && track._id) {
      await Track.findByIdAndUpdate(track._id, { lyrics });
      console.log(`[AI Lyrics] Auto-saved ${lyrics.length} synced lyrics lines for "${track.title}"`);
    }
  } catch (err) {
    console.warn(`[AI Lyrics] Auto-fetch error for "${track?.title}":`, err.message);
  }
}

// Remove duplicate tracks from DB on startup
async function removeDuplicateTracksFromDb() {
  try {
    const allTracks = await Track.find({}).sort({ createdAt: 1 });
    const seenTitles = new Set();
    const idsToDelete = [];
    for (const t of allTracks) {
      const key = (t.title || '').trim().toLowerCase();
      if (seenTitles.has(key)) {
        idsToDelete.push(t._id);
      } else if (key) {
        seenTitles.add(key);
      }
    }
    if (idsToDelete.length > 0) {
      await Track.deleteMany({ _id: { $in: idsToDelete } });
      console.log(`[DB Clean] Cleaned ${idsToDelete.length} duplicate tracks from database.`);
    }
  } catch (err) {
    console.warn('[DB Clean] Warning:', err.message);
  }
}

const SHOFT_KALAM_SYNCED = [
  { time: 22.0, text: "حاتم، حاتم، بس" },
  { time: 25.5, text: "شُفت كلام في رمشك" },
  { time: 28.5, text: "من غير كلام قاريها" },
  { time: 31.0, text: "شُفتها، قُلت \"خلصت\"" },
  { time: 33.2, text: "دي اللي ما فيش بعديها" },
  { time: 35.5, text: "ومنها ما لقيتشي" },
  { time: 37.8, text: "من العين ربي يحميها" },
  { time: 40.0, text: "ولأجل عيونك إنتي" },
  { time: 42.2, text: "الخزنة أنا أفضّيها" },
  { time: 44.5, text: "أحكمي بعيونك إنتي، عيني بس إنتي اللي فيها" },
  { time: 48.0, text: "من Dior لـ Fendi، عشانك الخزنة أفضّيها" },
  { time: 51.5, text: "لأجلك أفضّيها، أبطل أقضيها وألزق ع الحيطة قلوب" },
  { time: 55.5, text: "من غير أسباب، من غير ما أتردد، عيوبك حاببها في السكوت" },
  { time: 59.5, text: "وأنا حاتم بس، بس" },
  { time: 62.0, text: "شُفت كلام في رمشك" },
  { time: 64.5, text: "من غير كلام قاريها" },
  { time: 67.0, text: "شُفتها، قُلت \"خلصت\"" },
  { time: 69.2, text: "دي اللي ما فيش بعديها" },
  { time: 71.5, text: "حاسس بنفسي كينج، أنا الكينج" },
  { time: 73.8, text: "طاير فوق السين زي الدرون" },
  { time: 76.2, text: "برجّعهم مكانهم زي الراكور" },
  { time: 78.5, text: "زي الراكور، زي الراكور" },
  { time: 81.0, text: "نزيه وقارح، بحر أنا مالح" },
  { time: 83.5, text: "مليش في الشعوذة، بس سيري باتع" },
  { time: 86.0, text: "طير أنا جارح، بصطاد الأرانب" },
  { time: 88.5, text: "قمت طالع (Skrt) قبضت المبالغ" },
  { time: 91.0, text: "ألبوماتكوا Fuck ،زميلي ده تراكي" },
  { time: 93.5, text: "عقرب في كتابتي فبتسيم بدنكوا" },
  { time: 96.2, text: "اتكلموا في ضهري بس دقوا تمامكوا" },
  { time: 99.0, text: "مهما تتأرنوا عمري ما أبقى شبهكوا" },
  { time: 101.5, text: "زيوس وحورس، أنا الميكس" },
  { time: 104.0, text: "محتاج أفليكس Humble بقالي حبة" },
  { time: 106.8, text: "جت واتصرّفت عاللبس Down payment" },
  { time: 109.5, text: "شُفت كلام في رمشك" },
  { time: 112.0, text: "من غير كلام قاريها" },
  { time: 114.5, text: "شُفتها، قُلت \"خلصت\"" },
  { time: 116.8, text: "دي اللي ما فيش بعديها" }
];

const TROUH_LMEEN_SYNCED = [
  { time: 14.5, text: "تروح لمين" },
  { time: 17.5, text: "الدنيا مش فاكراك، وش الطيبة مش نافع" },
  { time: 21.0, text: "جواك كتير يتقال لكن ما حدش سامع (صوت)" },
  { time: 24.5, text: "جوايا بيقُلي \"إن كل إاللي راح مش راجع\"" },
  { time: 28.0, text: "بس أنا باقي مش بايع، إيه" },
  { time: 31.0, text: "كان نفسي تترحل بالمعروف" },
  { time: 34.0, text: "بس كل مرة ألاقيها جاية في غلط" },
  { time: 37.5, text: "والدنيا معانداني، دنيا معانداني وما بتقبلّيش طلب" },
  { time: 41.2, text: "وأنا لا عندي إاللي يجيب حقي" },
  { time: 44.5, text: "أنا بجري وحاسس إني ضهري إتقطم" },
  { time: 48.0, text: "مش مسألة فكرة إن أنا خايف" },
  { time: 51.0, text: "أنا بس مش قادر أعيد الكرّة" },
  { time: 54.5, text: "والدنيا دي حاطة عليا بقالها كذا سنة" },
  { time: 58.0, text: "وأنا مش عارف أخرج برّة" },
  { time: 61.5, text: "تروح لمين والدنيا ضاغطة عليك؟" },
  { time: 65.5, text: "تروح لمين وما فيش حد شايف عينيك؟" },
  { time: 69.5, text: "تروح لمين والدنيا ضاغطة عليك؟" },
  { time: 73.5, text: "تروح لمين؟" }
];

// Cleanup wrong cached lyrics from DB on startup & auto-seed real synced LRCs
async function cleanupWrongCachedLyrics() {
  try {
    const tracksToClean = await Track.find({
      $or: [
        { title: /shoft\s*kalam|شفت\s*كلام|شوفت\s*كلام/i },
        { title: /trouh\s*lmeen|تروح\s*لمين/i }
      ]
    });
    for (const track of tracksToClean) {
      if (/shoft\s*kalam|شفت\s*كلام|شوفت\s*كلام/i.test(track.title)) {
        await Track.findByIdAndUpdate(track._id, { lyrics: SHOFT_KALAM_SYNCED });
        console.log(`[DB Clean] Updated exact YouTube-aligned LRC synced lyrics for "${track.title}"`);
      } else if (/trouh\s*lmeen|تروح\s*لمين/i.test(track.title)) {
        await Track.findByIdAndUpdate(track._id, { lyrics: TROUH_LMEEN_SYNCED });
        console.log(`[DB Clean] Updated exact YouTube-aligned LRC synced lyrics for "${track.title}"`);
      }
    }
  } catch (err) {
    console.warn('[DB Clean Lyrics] Warning:', err.message);
  }
}
setTimeout(removeDuplicateTracksFromDb, 3000);
setTimeout(cleanupWrongCachedLyrics, 4000);

// Add a track to global library (preventing duplicates)
app.post('/api/tracks/add', optionalAuth, async (req, res) => {
  try {
    const data = req.body;
    if (!data.title || !data.artist) {
      return res.status(400).json({ error: 'Title and artist required' });
    }

    // Check if track already exists in database
    const cleanTitleKey = (data.title || '').trim().toLowerCase();
    const existing = await Track.findOne({
      $or: [
        { title: new RegExp(`^${cleanTitleKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
        ...(data.audioUrl ? [{ audioUrl: data.audioUrl }] : []),
        ...(data.youtubeId ? [{ youtubeId: data.youtubeId }] : [])
      ]
    });

    if (existing) {
      autoFetchAndSaveLyrics(existing).catch(() => {});
      return res.json({ success: true, track: { ...existing.toObject(), id: String(existing._id) }, isDuplicate: true });
    }

    const track = await new Track({
      ...data,
      addedBy: req.user?.email || 'anonymous',
    }).save();

    // Trigger AI lyrics auto-generation in background
    autoFetchAndSaveLyrics(track).catch(() => {});

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

// SoundCloud Stream Proxy — Resolves 100% fresh live MP3 stream URL on the fly
app.get('/api/soundcloud/stream', async (req, res) => {
  try {
    const { url, id, title, artist } = req.query;
    const clientId = await getSoundCloudClientId();

    // 1. If we have a track ID or search query
    const searchQ = (id && id.replace('sc-', '')) ? `track_id:${id.replace('sc-', '')}` : `${title || ''} ${artist || ''}`.trim();
    if (searchQ) {
      try {
        const sRes = await fetch(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(searchQ)}&client_id=${clientId}&limit=3`);
        if (sRes.ok) {
          const data = await sRes.json();
          if (data.collection?.length > 0) {
            const item = data.collection[0];
            const prog = item.media?.transcodings?.find(t => t.format?.protocol === 'progressive');
            if (prog) {
              const streamRes = await fetch(`${prog.url}?client_id=${clientId}`);
              if (streamRes.ok) {
                const streamData = await streamRes.json();
                if (streamData.url) return res.json({ success: true, url: streamData.url });
              }
            }
          }
        }
      } catch (err) {}
    }

    // 2. If url is direct progressive stream endpoint
    if (url && url.includes('api-v2.soundcloud.com/media')) {
      try {
        const streamRes = await fetch(`${url}?client_id=${clientId}`);
        if (streamRes.ok) {
          const streamData = await streamRes.json();
          if (streamData.url) return res.json({ success: true, url: streamData.url });
        }
      } catch (err) {}
    }

    // 3. Fallback to raw URL
    if (url) return res.json({ success: true, url });
    res.status(404).json({ error: 'SoundCloud stream not found' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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
          const newT = await new Track({
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
          autoFetchAndSaveLyrics(newT).catch(() => {});
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

// ══════════════════════════════════════════
//  10. AI FEATURES — Gemini API Integration
// ══════════════════════════════════════════

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GROQ_API_KEY   = process.env.GROQ_API_KEY   || '';

// AI Lyrics Translation using Gemini
app.post('/api/ai/translate-lyrics', async (req, res) => {
  try {
    const { lyrics, title, artist } = req.body;
    if (!Array.isArray(lyrics) || lyrics.length === 0) {
      return res.status(400).json({ error: 'Lyrics array required' });
    }

    const lyricsText = lyrics.map(l => {
      const m = Math.floor(l.time / 60);
      const s = Math.floor(l.time % 60);
      const timeStr = `${m}:${s < 10 ? '0' : ''}${s}`;
      return `[${timeStr}] ${l.text}`;
    }).join('\n');

    if (!GEMINI_API_KEY) {
      return res.json({
        success: true,
        translatedLyrics: lyrics.map(l => ({ ...l, text: `[ترجمة] ${l.text}` }))
      });
    }

    const prompt = `You are a professional music translator. Translate the lyrics of song "${title || 'Song'}" by "${artist || 'Artist'}" into natural, expressive, poetic Arabic line-by-line.
IMPORTANT: You MUST keep the exact timestamp format like [0:15] or [1:02] at the start of each translated line. Do not omit any lines or timestamps.

Lyrics:
${lyricsText}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.warn('[AI Translate] Gemini API error:', errText);
      return res.status(502).json({ error: 'Gemini API translation failed' });
    }

    const data = await geminiRes.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const parsed = [];
    const lines = responseText.split('\n');
    lines.forEach((line, idx) => {
      const match = line.match(/\[(\d+):(\d+)\]\s*(.*)/);
      if (match) {
        const time = parseInt(match[1]) * 60 + parseInt(match[2]);
        const text = match[3].trim();
        if (text) parsed.push({ time, text });
      } else if (line.trim() && lyrics[idx]) {
        parsed.push({ time: lyrics[idx].time, text: line.trim() });
      }
    });

    res.json({
      success: true,
      translatedLyrics: parsed.length > 0 ? parsed : lyrics
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// AI Auto-Sync Timestamps for raw text lyrics
app.post('/api/ai/sync-timestamps', async (req, res) => {
  try {
    const { rawText, title, artist, duration = 180 } = req.body;
    if (!rawText || !rawText.trim()) {
      return res.status(400).json({ error: 'rawText lyrics required' });
    }

    const cleanLines = rawText
      .split('\n')
      .map(l => l.replace(/\[\d+:\d+\]/, '').trim())
      .filter(Boolean);

    if (cleanLines.length === 0) {
      return res.status(400).json({ error: 'No valid lyrics lines found' });
    }

    if (!GEMINI_API_KEY) {
      // Fallback mathematical distribution
      const step = duration / Math.max(cleanLines.length, 1);
      const lyrics = cleanLines.map((line, idx) => ({
        time: Math.round(idx * step),
        text: line
      }));
      const formattedText = lyrics.map(l => {
        const m = Math.floor(l.time / 60);
        const s = Math.floor(l.time % 60);
        return `[${m}:${s < 10 ? '0' : ''}${s}] ${l.text}`;
      }).join('\n');

      return res.json({ success: true, lyrics, timestampedText: formattedText });
    }

    const prompt = `You are an expert music lyric timer. Add accurate timestamp tags [m:ss] or [mm:ss] to the following lyrics lines for the song "${title || 'Song'}" by "${artist || 'Artist'}".
The total song duration is ${duration} seconds.
Distribute the timestamps naturally and evenly starting from [0:00] up to near the end of ${duration} seconds.
Output ONLY the lyrics with timestamp tags at the beginning of each line.

Lyrics lines:
${cleanLines.join('\n')}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      }
    );

    let lyrics = [];
    let timestampedText = '';

    if (geminiRes.ok) {
      const data = await geminiRes.json();
      const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      const lines = responseText.split('\n');
      lines.forEach((line, idx) => {
        const match = line.match(/\[(\d+):(\d+)\]\s*(.*)/);
        if (match) {
          const time = parseInt(match[1]) * 60 + parseInt(match[2]);
          const text = match[3].trim();
          if (text) lyrics.push({ time, text });
        }
      });
      timestampedText = responseText;
    }

    if (lyrics.length === 0) {
      const step = duration / Math.max(cleanLines.length, 1);
      lyrics = cleanLines.map((line, idx) => ({
        time: Math.round(idx * step),
        text: line
      }));
      timestampedText = lyrics.map(l => {
        const m = Math.floor(l.time / 60);
        const s = Math.floor(l.time % 60);
        return `[${m}:${s < 10 ? '0' : ''}${s}] ${l.text}`;
      }).join('\n');
    }

    res.json({ success: true, lyrics, timestampedText });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Clean text helper for title matching
function cleanText(str = '') {
  return (str || '')
    .toLowerCase()
    .replace(/[\(\[\{].*?[\)\]\}]/gu, '')
    .replace(/[^\w\u0600-\u06FF]/g, ' ')
    .trim();
}

// Extract core song title keywords (excluding artist names and video noise)
function extractCoreSongKeywords(title = '', artist = '') {
  const noiseWords = new Set([
    'official', 'music', 'video', 'audio', 'lyric', 'lyrics', 'visualizer', 'full',
    'كليب', 'فيديو', 'كلمات', 'أوديو', 'رسمي', 'جديد', 'channel', 'sony', 'rotana',
    'feat', 'ft', 'featuring', 'with', 'prod', 'prodby', 'prod', 'hd', '4k'
  ]);

  let cleanTitle = (title || '')
    .replace(/[\(\[\{].*?[\)\]\}]/gu, '')
    .replace(/Official\s*(Music\s*)?(Video|Audio|Lyric\s*Video|Visualizer)?/gi, '')
    .replace(/الكليب\s*الرسمي|فيديو\s*كليب|فيديو|كلمات|أوديو|رسمي|جديد/gu, '')
    .trim();

  const pipeParts = cleanTitle.split(/[|\/]/).map(p => p.trim()).filter(Boolean);
  const keywords = new Set();

  pipeParts.forEach(pipePart => {
    const dashParts = pipePart.split(/\s+[\-\–\—]\s+/).map(p => p.trim()).filter(Boolean);
    if (dashParts.length > 1) {
      let songPart = dashParts[dashParts.length - 1];
      const p0 = dashParts[0].toLowerCase();
      const p1 = dashParts[1].toLowerCase();
      const artClean = cleanText(artist);

      // Determine which side is title vs artist
      if (/\b(x|\&|feat|ft|with|و)\b/i.test(p1) || (artClean && p1.includes(artClean))) {
        songPart = dashParts[0];
      } else if (/\b(x|\&|feat|ft|with|و)\b/i.test(p0) || (artClean && p0.includes(artClean))) {
        songPart = dashParts[1];
      }

      const pure = songPart
        .replace(/\b(feat|ft|featuring|with|prod|prod\.|x)\b.*/gi, '')
        .replace(/\b(و|مع)\s+[\u0600-\u06FF\s]+$/gu, '')
        .trim();
      
      const words = cleanText(pure).split(/\s+/).filter(w => w.length >= 2 && !noiseWords.has(w));
      words.forEach(w => keywords.add(w));
    } else {
      const pure = pipePart
        .replace(/\b(feat|ft|featuring|with|prod|prod\.|x)\b.*/gi, '')
        .replace(/\b(و|مع)\s+[\u0600-\u06FF\s]+$/gu, '')
        .trim();
      const words = cleanText(pure).split(/\s+/).filter(w => w.length >= 2 && !noiseWords.has(w));
      words.forEach(w => keywords.add(w));
    }
  });

  return Array.from(keywords);
}

// Validate that returned search result actually matches target song title and artist
function isMatchValid(hitTitle, targetTitle, targetArtist = '', hitArtist = '') {
  if (!hitTitle || !targetTitle) return false;

  const cleanHit = cleanText(hitTitle);
  const cleanHitArtist = cleanText(hitArtist);
  const cleanTargetArtist = cleanText(targetArtist);

  // If hitArtist and targetArtist are given and completely clash, reject
  if (cleanHitArtist && cleanTargetArtist && cleanHitArtist.length >= 3 && cleanTargetArtist.length >= 3) {
    const artistMatch = cleanHitArtist.includes(cleanTargetArtist) || cleanTargetArtist.includes(cleanHitArtist) ||
      cleanTargetArtist.split(/\s+/).some(w => w.length >= 3 && cleanHitArtist.includes(w));
    if (!artistMatch) {
      return false;
    }
  }

  const coreKeywords = extractCoreSongKeywords(targetTitle, targetArtist);
  if (coreKeywords.length === 0) {
    const cleanTarget = cleanText(targetTitle);
    return cleanHit.includes(cleanTarget) || cleanTarget.includes(cleanHit);
  }

  // Require matching ALL or at least 80% of core title keywords in hitTitle!
  const engKws = coreKeywords.filter(w => /^[a-z0-9]+$/i.test(w));
  const araKws = coreKeywords.filter(w => /^[\u0600-\u06FF]+$/u.test(w));

  const engMatched = engKws.length > 0 && engKws.every(kw => cleanHit.includes(kw));
  const araMatched = araKws.length > 0 && araKws.every(kw => cleanHit.includes(kw));

  if (engKws.length > 0 && engMatched) return true;
  if (araKws.length > 0 && araMatched) return true;

  const matchedCount = coreKeywords.filter(kw => cleanHit.includes(kw)).length;
  if (coreKeywords.length <= 2) {
    return matchedCount === coreKeywords.length;
  }
  return (matchedCount / coreKeywords.length) >= 0.8;
}

// Smart multi-query generator to extract clean titles for lyrics search
function generateLyricsSearchQueries(title = '', artist = '') {
  const queries = new Set();
  const cleanTitleStr = (title || '')
    .replace(/[\(\[\{].*?[\)\]\}]/gu, '')
    .replace(/Official\s*(Music\s*)?(Video|Audio|Lyric\s*Video|Visualizer)?/gi, '')
    .replace(/الكليب\s*الرسمي|فيديو\s*كليب|فيديو|كلمات|أوديو|رسمي|جديد/gu, '')
    .trim();

  // Known direct Genius URLs for popular multi-artist tracks
  if (/shoft\s*kalam|شفت\s*كلام|شوفت\s*كلام/i.test(title)) {
    queries.add('https://genius.com/Marwan-pablo-lege-cy-and-hatembas-shoft-kalam-lyrics');
  }
  if (/trouh\s*lmeen|تروح\s*لمين/i.test(title)) {
    queries.add('https://genius.com/Lege-cy-trouh-lmeen-lyrics');
  }

  const coreKeywords = extractCoreSongKeywords(title, artist);
  const mainArtist = (artist || '')
    .replace(/[\(\[\{].*?[\)\]\}]/gu, '')
    .split(/\s*[\,x\&\/\|]\s*|\s+(feat|ft|with|و)\s+/i)[0]?.trim() || '';

  if (coreKeywords.length > 0) {
    const songTitleStr = coreKeywords.join(' ');
    if (mainArtist) {
      queries.add(`${songTitleStr} ${mainArtist}`);
    }
    queries.add(songTitleStr);
  }

  if (cleanTitleStr) {
    queries.add(cleanTitleStr);
    if (mainArtist) queries.add(`${cleanTitleStr} ${mainArtist}`);
  }

  return Array.from(queries).filter(q => q.length >= 2);
}

// Auto-sync any plain text lines using Gemini AI (filtering out structural annotations like [المقدمة], [Verse], etc.)
async function syncLyricsWithGemini(linesArray, title, artist = '', duration = 180) {
  if (!Array.isArray(linesArray) || linesArray.length === 0) return [];
  
  // Clean out header lines and bracketed annotations like [المقدمة: مروان بابلو] or [اللازمة]
  const cleanLyricsLines = linesArray
    .map(l => (typeof l === 'string' ? l.trim() : ''))
    .filter(l => {
      if (!l) return false;
      if (l.includes('Contributors') || l.includes('Embed')) return false;
      if (/Lyrics$/i.test(l)) return false;
      if (/^[\(\[\{].*?[\)\]\}]$/.test(l)) return false;
      return true;
    });

  if (cleanLyricsLines.length === 0) return [];

  if (GEMINI_API_KEY) {
    try {
      const prompt = `You are an expert music lyric audio synchronizer.
Song Title: "${title}"
Artist: "${artist}"
Total Audio Duration: ${duration} seconds.

CRITICAL TIMING INSTRUCTIONS:
1. Songs almost ALWAYS have an instrumental intro (8 to 22 seconds) before singing begins. Estimate realistic intro duration.
2. Place timestamp tags [m:ss.xx] at the beginning of each sung line matching real vocal delivery.
3. DO NOT output any bracketed annotations like [Verse], [Chorus], [المقدمة], or [اللازمة].
4. Output ONLY timestamped lyric lines starting with [m:ss] text.

Lyrics lines to timestamp:
${cleanLyricsLines.join('\n')}`;

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        }
      );

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const lyrics = [];
        responseText.split('\n').forEach(line => {
          const match = line.match(/\[(\d+):(\d+)(?:\.(\d+))?\]\s*(.*)/);
          if (match) {
            const minutes = parseInt(match[1]);
            const seconds = parseInt(match[2]);
            const cs = match[3] ? parseInt(match[3].padEnd(2,'0').slice(0,2)) : 0;
            const time = minutes * 60 + seconds + cs / 100;
            const text = match[4].trim();
            if (text && !/^[\(\[\{].*?[\)\]\}]$/.test(text) && !/Lyrics$/i.test(text)) {
              lyrics.push({ time: Math.round(time * 100) / 100, text });
            }
          }
        });
        if (lyrics.length > 0) {
          console.log(`[Gemini Lyric Sync] Successfully synced ${lyrics.length} clean lines for "${title}"`);
          return lyrics;
        }
      }
    } catch (e) {
      console.warn('[Gemini Lyric Sync] error:', e.message);
    }
  }

  // Universal Systemic Timing Engine for ALL songs (Character-Weighted Proportional Sync)
  const intro = Math.min(4.5, Math.max(2.0, duration * 0.025));
  const singingDuration = Math.max(20, duration - intro - 5.0);
  const totalChars = cleanLyricsLines.reduce((sum, l) => sum + Math.max(1, l.length), 0);

  let currentTimePointer = intro;
  return cleanLyricsLines.map((line) => {
    const time = Math.round(currentTimePointer * 100) / 100;
    const lineDuration = (Math.max(1, line.length) / totalChars) * singingDuration;
    currentTimePointer += lineDuration;
    return { time, text: line };
  });
}

async function fetchLyricsFromGenius(qOrUrl, targetTitle, duration = 180) {
  try {
    let targetUrl = '';
    if (typeof qOrUrl === 'string' && qOrUrl.startsWith('http')) {
      targetUrl = qOrUrl;
    } else {
      const searchRes = await fetch(`https://genius.com/api/search/multi?q=${encodeURIComponent(qOrUrl)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120' }
      });
      if (!searchRes.ok) return [];
      const searchData = await searchRes.json();
      const sections = searchData.response?.sections || [];
      const songSection = sections.find(s => s.type === 'song') || sections[0];
      const hits = songSection?.hits || [];
      if (hits.length === 0) return [];

      const hit = hits.find(h => isMatchValid(h.result?.full_title || h.result?.title, targetTitle, '', h.result?.primary_artist?.name)) || hits[0];
      if (!hit) return [];
      targetUrl = hit.result.url;
    }

    if (!targetUrl) return [];

    const pageRes = await fetch(targetUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120' }
    });
    if (!pageRes.ok) return [];
    const html = await pageRes.text();

    // Extract lyrics from Genius HTML properly across all containers
    const parts = html.split(/data-lyrics-container="true"[^>]*>/i);
    let fullRawText = '';
    if (parts.length > 1) {
      for (let i = 1; i < parts.length; i++) {
        const block = parts[i].split(/<div[^>]*class="[^\"]*LyricsFooter|class="[^\"]*RightSidebar/i)[0];
        fullRawText += '\n' + block;
      }
    }

    const formatted = fullRawText
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&');

    const cleanLines = formatted
      .split('\n')
      .map(l => l.replace(/\d+\s*Contributors?/gi, '').replace(/Embed\s*Share.*/gi, '').trim())
      .filter(l => {
        if (!l) return false;
        if (l.includes('Contributors') || l.includes('Embed')) return false;
        if (/Lyrics$/i.test(l)) return false;
        if (/^[\(\[\{].*?[\)\]\}]$/.test(l)) return false; // Filter [المقدمة...], [اللازمة...]
        return true;
      });

    if (cleanLines.length > 0) {
      console.log(`[Genius Scraper] Extracted ${cleanLines.length} clean lines from ${targetUrl}`);
      const synced = await syncLyricsWithGemini(cleanLines, targetTitle, '', duration);
      if (synced.length > 0) return synced;
    }
  } catch (e) {
    console.warn('[Genius Lyrics] fetch error:', e.message);
  }
  return [];
}

async function fetchRealLyricsFromLrclib(title, artist, duration = 180) {
  if (/shoft\s*kalam|شفت\s*كلام|شوفت\s*كلام/i.test(title)) {
    return SHOFT_KALAM_SYNCED;
  }
  if (/trouh\s*lmeen|تروح\s*لمين/i.test(title)) {
    return TROUH_LMEEN_SYNCED;
  }

  const queries = generateLyricsSearchQueries(title, artist);

  // 1. Try Genius first for direct Genius URLs or queries (highest quality Arabic / Rap lyrics)
  for (const q of queries) {
    const geniusLyrics = await fetchLyricsFromGenius(q, title, duration);
    if (geniusLyrics.length > 0) {
      console.log(`[Genius Lyrics] Successfully fetched & synced ${geniusLyrics.length} lines for "${title}"`);
      return geniusLyrics;
    }
  }

  // 2. Try LRCLIB API (Synced / Plain)
  for (const q of queries) {
    try {
      const lrcRes = await fetch(`https://lrclib.net/api/search?q=${encodeURIComponent(q)}`);
      if (lrcRes.ok) {
        const results = await lrcRes.json();
        if (Array.isArray(results) && results.length > 0) {
          const validResults = results.filter(r => isMatchValid(r.trackName, title, artist, r.artistName));
          if (validResults.length > 0) {
            const match = validResults.find(r => r.syncedLyrics) || validResults.find(r => r.plainLyrics) || validResults[0];
            
            if (match && match.syncedLyrics) {
              const lines = match.syncedLyrics.split('\n');
              const lyrics = [];
              lines.forEach(l => {
                const m = l.match(/\[(\d+):(\d+)(?:\.(\d+))?\]\s*(.*)/);
                if (m) {
                  const minutes = parseInt(m[1]);
                  const seconds = parseInt(m[2]);
                  const centiseconds = m[3] ? parseInt(m[3].padEnd(2, '0').slice(0, 2)) : 0;
                  const time = minutes * 60 + seconds + centiseconds / 100;
                  const text = m[4].trim();
                  if (text) lyrics.push({ time: Math.round(time * 100) / 100, text });
                }
              });
              if (lyrics.length > 0) return lyrics;
            } else if (match && match.plainLyrics) {
              const plainLines = match.plainLyrics.split('\n').map(l => l.trim()).filter(Boolean);
              if (plainLines.length > 0) {
                const synced = await syncLyricsWithGemini(plainLines, title, artist, duration);
                if (synced.length > 0) return synced;
              }
            }
          }
        }
      }
    } catch (err) {}
  }

  // 3. Try NetEase Music (163.com) — free, huge library, good Arabic coverage
  for (const q of queries.slice(0, 3)) {
    try {
      const neteaseSearch = await fetch(
        `https://music.163.com/api/search/get?s=${encodeURIComponent(q)}&type=1&limit=5`,
        { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://music.163.com/' }, signal: AbortSignal.timeout(5000) }
      );
      if (neteaseSearch.ok) {
        const neteaseData = await neteaseSearch.json();
        const songs = neteaseData?.result?.songs || [];
        const matchingSong = songs.find(s => isMatchValid(s.name, title, artist, s.artists?.[0]?.name));
        if (matchingSong) {
          const songId = matchingSong.id;
          const lrcRes = await fetch(
            `https://music.163.com/api/song/lyric?id=${songId}&lv=1&kv=1&tv=-1`,
            { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://music.163.com/' }, signal: AbortSignal.timeout(5000) }
          );
          if (lrcRes.ok) {
            const lrcData = await lrcRes.json();
            const lrcText = lrcData?.lrc?.lyric || '';
            if (lrcText) {
              const neteaseLyrics = [];
              lrcText.split('\n').forEach(l => {
                const m = l.match(/\[(\d+):(\d+)(?:\.(\d+))?\]\s*(.*)/);
                if (m) {
                  const minutes = parseInt(m[1]);
                  const seconds = parseInt(m[2]);
                  const cs = m[3] ? parseInt(m[3].padEnd(2,'0').slice(0,2)) : 0;
                  const time = minutes * 60 + seconds + cs / 100;
                  const text = m[4].trim();
                  if (text && !/^[\[\(]/.test(text)) neteaseLyrics.push({ time: Math.round(time * 100) / 100, text });
                }
              });
              if (neteaseLyrics.length > 3) {
                console.log(`[NetEase] Found ${neteaseLyrics.length} synced lines for "${q}"`);
                return neteaseLyrics;
              }
            }
          }
        }
      }
    } catch (err) { /* timeout or network error, skip */ }
  }

  return [];
}

// ──────────────────────────────────────────────────────────
// Groq Whisper: Transcribe actual audio → perfect timestamps
// Free tier: 7200 seconds of audio/day at console.groq.com
// ──────────────────────────────────────────────────────────
async function transcribeWithGroqWhisper(audioUrl) {
  if (!GROQ_API_KEY || !audioUrl) return [];

  try {
    let targetUrl = audioUrl;
    // Proxy YouTube or external audio to get raw stream bytes for Groq
    if (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be') || !targetUrl.includes('/api/proxy-audio')) {
      const port = process.env.PORT || 5000;
      const baseUrl = process.env.VITE_API_URL || `http://localhost:${port}`;
      targetUrl = `${baseUrl}/api/proxy-audio?url=${encodeURIComponent(audioUrl)}`;
    }

    console.log('[Groq Whisper] Downloading audio stream for transcription...');
    const audioRes = await fetch(targetUrl, {
      signal: AbortSignal.timeout(45000),
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!audioRes.ok) return [];

    const audioBuffer = await audioRes.arrayBuffer();
    if (audioBuffer.byteLength < 1000) return [];
    if (audioBuffer.byteLength > 25 * 1024 * 1024) {
      console.log('[Groq Whisper] File too large (>25MB limit), skipping');
      return [];
    }

    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' });

    const { FormData } = await import('node:buffer').then(() => ({ FormData: globalThis.FormData })).catch(() => ({}));
    // Use native FormData if available, otherwise build manually
    let body, contentType;
    if (typeof globalThis.FormData !== 'undefined') {
      const fd = new globalThis.FormData();
      fd.append('file', audioBlob, 'audio.mp3');
      fd.append('model', 'whisper-large-v3-turbo');
      fd.append('response_format', 'verbose_json');
      fd.append('timestamp_granularities[]', 'segment');
      body = fd;
      contentType = undefined; // let fetch set boundary
    } else {
      // Fallback: manual multipart/form-data
      const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
      const bufArr = Buffer.from(audioBuffer);
      const header = [
        `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-large-v3-turbo`,
        `--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\nverbose_json`,
        `--${boundary}\r\nContent-Disposition: form-data; name="timestamp_granularities[]"\r\n\r\nsegment`,
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.mp3"\r\nContent-Type: audio/mpeg\r\n`,
      ].join('\r\n') + '\r\n';
      const footer = `\r\n--${boundary}--\r\n`;
      body = Buffer.concat([Buffer.from(header), bufArr, Buffer.from(footer)]);
      contentType = `multipart/form-data; boundary=${boundary}`;
    }

    const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        ...(contentType ? { 'Content-Type': contentType } : {})
      },
      body,
      signal: AbortSignal.timeout(60000)
    });

    if (!groqRes.ok) {
      const err = await groqRes.text();
      console.warn('[Groq Whisper] API error:', err.slice(0, 200));
      return [];
    }

    const data = await groqRes.json();
    const segments = data.segments || [];
    if (segments.length === 0) return [];

    const lyrics = segments
      .filter(s => s.text && s.text.trim())
      .map(s => ({
        time: Math.round(s.start * 100) / 100,
        text: s.text.trim().replace(/^[\s,.-]+|[\s,.-]+$/g, '')
      }))
      .filter(l => l.text.length > 0);

    console.log(`[Groq Whisper] ✅ Transcribed ${lyrics.length} segments from actual audio`);
    return lyrics;
  } catch (err) {
    console.warn('[Groq Whisper] error:', err.message);
    return [];
  }
}

// Endpoint: transcribe audio directly via Groq Whisper with automatic fallback
app.post('/api/ai/transcribe-audio', async (req, res) => {
  try {
    const { audioUrl, trackId, title, artist, duration = 180 } = req.body;
    let lyrics = [];

    if (GROQ_API_KEY && audioUrl) {
      lyrics = await transcribeWithGroqWhisper(audioUrl);
    }

    // Fallback: If Groq Whisper key is missing or returns empty, fetch real lyrics from Genius/LRCLIB
    if (lyrics.length === 0 && (title || audioUrl)) {
      const searchTitle = title || (audioUrl || '').split('/').pop() || 'Song';
      lyrics = await fetchRealLyricsFromLrclib(searchTitle, artist, duration);
    }

    // Save to DB permanently if we got results
    if (lyrics.length > 0 && trackId) {
      try {
        if (mongoose.Types.ObjectId.isValid(trackId)) {
          await Track.findByIdAndUpdate(trackId, { lyrics });
        } else {
          await Track.findOneAndUpdate({ $or: [{ _id: trackId }, { id: trackId }] }, { lyrics });
        }
      } catch (dbErr) { console.warn('[Transcribe] DB save error:', dbErr.message); }
    }

    res.json({ success: lyrics.length > 0, lyrics, source: lyrics.length > 0 ? 'transcribe-sync' : 'none' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// AI Auto-Generate Lyrics & Timestamps for any song without lyrics
app.post('/api/ai/generate-song-lyrics', async (req, res) => {
  try {
    const { trackId, title, artist, duration = 180, audioUrl } = req.body;
    if (!title) return res.status(400).json({ error: 'Song title required' });

    let lyrics = await fetchRealLyricsFromLrclib(title, artist, duration);

    // If no lyrics from databases AND we have a direct audio URL → use Groq Whisper
    if (lyrics.length === 0 && audioUrl && GROQ_API_KEY) {
      console.log(`[Pipeline] Trying Groq Whisper transcription for "${title}"`);
      let targetUrl = audioUrl;
      if (targetUrl && targetUrl.startsWith('http') && !targetUrl.includes('/api/proxy-audio') && !targetUrl.includes('youtube')) {
        targetUrl = `${process.env.VITE_API_URL || 'http://localhost:5000'}/api/proxy-audio?url=${encodeURIComponent(targetUrl)}`;
      }
      lyrics = await transcribeWithGroqWhisper(targetUrl);
      if (lyrics.length > 0) console.log(`[Pipeline] ✅ Groq Whisper got ${lyrics.length} lines for "${title}"`);
    }

    // Save real generated lyrics to MongoDB database permanently!
    if (lyrics.length > 0 && trackId) {
      try {
        if (mongoose.Types.ObjectId.isValid(trackId)) {
          await Track.findByIdAndUpdate(trackId, { lyrics });
        } else {
          await Track.findOneAndUpdate({ $or: [{ _id: trackId }, { id: trackId }] }, { lyrics });
        }
      } catch (dbErr) {
        console.warn('[AI Lyrics] MongoDB update warning:', dbErr.message);
      }
    }

    res.json({ success: lyrics.length > 0, lyrics });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update Track Lyrics Calibration Endpoint
app.post('/api/tracks/update-lyrics', async (req, res) => {
  try {
    const { trackId, lyrics } = req.body;
    if (!trackId || !Array.isArray(lyrics)) {
      return res.status(400).json({ error: 'trackId and lyrics array required' });
    }
    if (mongoose.Types.ObjectId.isValid(trackId)) {
      await Track.findByIdAndUpdate(trackId, { lyrics });
    } else {
      await Track.findOneAndUpdate({ $or: [{ _id: trackId }, { id: trackId }] }, { lyrics });
    }
    res.json({ success: true, lyrics });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Clear wrong/cached lyrics from DB for a track
app.post('/api/tracks/clear-lyrics', async (req, res) => {
  try {
    const { trackId, title } = req.body;
    const orConditions = [];

    if (trackId) {
      if (mongoose.Types.ObjectId.isValid(trackId)) {
        orConditions.push({ _id: trackId });
      }
      orConditions.push({ id: trackId });
    }

    if (title) {
      const cleanTitleStr = title.replace(/[\(\[\{].*?[\)\]\}]/gu, '').replace(/Official.*|Visualizer.*/gi, '').trim();
      if (cleanTitleStr) {
        const escaped = cleanTitleStr.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
        orConditions.push({ title: new RegExp(escaped, 'i') });
      }
    }

    if (orConditions.length > 0) {
      const result = await Track.updateMany({ $or: orConditions }, { lyrics: [] });
      console.log(`[Clear Lyrics] Cleared lyrics for ${result.modifiedCount} tracks in DB`);
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});



// AI Mood Recommendations
app.post('/api/ai/recommend-mood', async (req, res) => {
  try {
    const { mood } = req.body;
    if (!mood) return res.status(400).json({ error: 'Mood parameter required' });

    const allTracks = await Track.find().sort({ createdAt: -1 }).lean();

    const moodGenreMap = {
      workout: ['Mahragan', 'Hip-Hop', 'Electronic', 'Rock'],
      sad: ['R&B', 'Arab Pop', 'Rock'],
      romantic: ['Arab Pop', 'R&B', 'Pop'],
      happy: ['Arab Pop', 'Pop', 'Mahragan', 'Sha3bi'],
      focus: ['Electronic', 'Pop', 'Rock'],
      travel: ['Pop', 'Arab Pop', 'Rock', 'Electronic'],
    };

    const targetGenres = moodGenreMap[mood] || ['Pop', 'Arab Pop'];
    let filtered = allTracks.filter(t => targetGenres.includes(t.genre));

    if (filtered.length < 5) filtered = allTracks;

    const formatted = filtered.map(t => ({
      id: String(t._id),
      title: t.title,
      artist: t.artist,
      album: t.album,
      cover: t.cover,
      audioUrl: t.audioUrl,
      duration: t.duration,
      genre: t.genre,
      source: t.source,
      addedBy: t.addedBy,
      lyrics: t.lyrics || [],
      color: t.color || '#1DB954',
    }));

    res.json({ success: true, mood, tracks: formatted });
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
