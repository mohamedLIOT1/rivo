/**
 * Rivo Backend API Server — FULL FEATURED & OPTIMIZED
 */

const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const express = require('express');
const http = require('http');
const fs = require('fs');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const axios = require('axios');
const { Server } = require('socket.io');

try { require('dotenv').config({ path: path.join(__dirname, '../.env') }); } catch (e) {}

const app = express();

// Security Headers (Helmet)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: false // Allows dynamic audio/video streams, external CDNs & native WebView
}));

// CORS Configuration
app.use(cors({ origin: '*', credentials: true }));

// Global Rate Limiting (DoS prevention)
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', generalLimiter);

// Strict Rate Limiting for Authentication (Brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again after 15 minutes.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, '../dist'), {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ico)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

// Real-time Presence: Track active socket connections per user ID (Map<userId, Set<socketId>>)
const userSocketMap = new Map();

const ACTIVE_JWT_SECRET = process.env.JWT_SECRET;
if (!ACTIVE_JWT_SECRET) {
  console.error('❌ [Security Warning] JWT_SECRET is not set in environment variables! Please set JWT_SECRET in .env.');
}
const JWT_SECRET = ACTIVE_JWT_SECRET || 'rivo_jwt_fallback_secret_must_change_in_env_998341';
const verifyJwt = (t) => {
  return jwt.verify(t, JWT_SECRET);
};

// Global Error Handlers
process.on('uncaughtException', (err) => console.warn('[Uncaught]:', err.message));
process.on('unhandledRejection', (reason) => console.warn('[Unhandled]:', reason?.message));

// MongoDB Connection (Strictly environment variable - No hardcoded fallback credentials)
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ [Fatal Config] MONGO_URI is missing from environment variables (.env)!');
}
async function purgeSoundCloudData() {
  try {
    const scQuery = {
      $or: [
        { source: { $regex: /soundcloud/i } },
        { audioUrl: { $regex: /soundcloud\.com|sndcdn\.com/i } },
        { album: { $regex: /soundcloud/i } },
        { originalUrl: { $regex: /soundcloud\.com/i } },
        { id: { $regex: /^sc-/i } },
      ]
    };
    const res = await Track.deleteMany(scQuery);
    if (res.deletedCount > 0) {
      console.log(`[SoundCloud Purge] Deleted ${res.deletedCount} SoundCloud tracks from MongoDB.`);
    }
  } catch (err) {
    console.warn('[SoundCloud Purge] DB error:', err.message);
  }
}

async function connectDB() {
  try { 
    await mongoose.connect(MONGO_URI); 
    console.log('✅ DB Connected'); 
    purgeSoundCloudData();
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
  source: { type: String, default: 'manual' },
  isVerified: { type: Boolean, default: false },
  verifiedBy: { type: String, default: '' },
  verifiedAt: { type: Date, default: null }
}, { timestamps: true });

const SongLyrics = mongoose.model('SongLyrics', LyricsSchema);

// ──────────────────────────────────────────
// Website-Wide Album Collection (Playlists not tied to individual user account)
// ──────────────────────────────────────────
const AlbumSchema = new mongoose.Schema({
  id: { type: String, unique: true, index: true },
  name: { type: String, required: true },
  artist: { type: String, required: true },
  cover: { type: String },
  trackIds: [{ type: String }],
  releaseDate: { type: String },
  genre: { type: String },
  isAlbum: { type: Boolean, default: true },
  isSystem: { type: Boolean, default: true },
  isPublic: { type: Boolean, default: true },
  source: { type: String, default: 'album_detection' }
}, { timestamps: true });

const Album = mongoose.model('Album', AlbumSchema);

// ──────────────────────────────────────────
// Website-Wide Artist Profiles Collection (Editable by Admins)
// ──────────────────────────────────────────
const ArtistSchema = new mongoose.Schema({
  id: { type: String, unique: true, index: true },
  name: { type: String, required: true, unique: true, index: true },
  bio: { type: String, default: '' },
  cover: { type: String, default: '' },
  banner: { type: String, default: '' },
  isVerified: { type: Boolean, default: false },
  genres: [{ type: String }],
  customLinks: [{ label: String, url: String }],
  updatedBy: { type: String, default: 'admin' }
}, { timestamps: true });

const Artist = mongoose.model('Artist', ArtistSchema);

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

// Permanently purge any SoundCloud tracks from database
Track.deleteMany(
  { $or: [{ source: { $regex: /soundcloud/i } }, { audioUrl: { $regex: /soundcloud\.com|sndcdn\.com/i } }, { album: { $regex: /soundcloud/i } }] }
).then(r => { if (r.deletedCount > 0) console.log(`[DB] Purged ${r.deletedCount} SoundCloud tracks`); }).catch(() => {});

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
  role: { type: String, enum: ['admin', 'user'], default: 'user' },
  isAdmin: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
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
    isQuran: { type: Boolean, default: false },
    isMix: { type: Boolean, default: false },
    transitions: { type: Object, default: {} }
  }],
  currentListening: { type: Object, default: null },
  lastActiveAt: { type: Date, default: Date.now },
  totalListeningSeconds: { type: Number, default: 0 },
  weeklyListeningSeconds: { type: Number, default: 0 },
  weeklyWeek: { type: String, default: '' },
  topTrack: {
    id: String,
    title: String,
    artist: String,
    cover: String,
    plays: { type: Number, default: 0 },
    seconds: { type: Number, default: 0 }
  }
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
// Auth Helpers & Administrator Security
// ──────────────────────────────────────────
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'mohamedmustafat79@gmail.com')
  .toLowerCase()
  .split(',')
  .map(e => e.trim())
  .filter(Boolean);

function isAdminUser(userOrObj) {
  if (!userOrObj) return false;
  if (typeof userOrObj === 'string') {
    return ADMIN_EMAILS.includes(userOrObj.trim().toLowerCase());
  }
  if (userOrObj.role === 'admin' || userOrObj.isAdmin === true) {
    return true;
  }
  const email = (userOrObj.email || '').trim().toLowerCase();
  if (email && ADMIN_EMAILS.includes(email)) return true;
  return false;
}

function isVerifiedUser(userOrObj) {
  if (!userOrObj) return false;
  if (isAdminUser(userOrObj)) return true;
  if (typeof userOrObj === 'object' && userOrObj.isVerified === true) return true;
  return false;
}

// Auto-verify designated admin email in MongoDB if present
setTimeout(async () => {
  try {
    if (mongoose.connection.readyState === 1 && ADMIN_EMAILS.length > 0) {
      await User.updateMany(
        { email: { $in: ADMIN_EMAILS } },
        { $set: { role: 'admin', isAdmin: true, isVerified: true } }
      );
      console.log('✅ [Admin Security] Designated super-admin email verified in MongoDB');
    }
  } catch (err) {
    console.warn('[Admin Security] Startup admin check error:', err.message);
  }
}, 4000);

const QURAN_REGEX = /(\bسورة|\bسوره|\bقرآن|\bقران|\bالمصحف|\bمصحف|\bتلاوة|\bتلاوه|\bترتيل|\bتجويد|المنشاوي|عبد\s*الباسط|الحصري|البناء|الطبلاوي|العفاسي|ماهر\s*المعيقلي|السديس|الشريم|ياسر\s*الدوسري|مشاري\s*العفاسي|أحمد\s*العجمي|سعد\s*الغامدي|\bsurah\b|\bquran\b|\bkoran\b|\brecitation\b|\btajweed\b|\btartil\b|\bmushaf\b)/i;

function isQuranContent(title, artist, album, genre, description) {
  const str = `${title || ''} ${artist || ''} ${album || ''} ${genre || ''} ${description || ''}`;
  return QURAN_REGEX.test(str);
}

const SERVER_FAMOUS_RECITERS = [
  {
    name: 'مشاري راشد العفاسي',
    aliases: [
      'مشاري العفاسي', 'العفاسي', 'العفاسى', 'مشاري راشد', 'مشارى العفاسى', 'مشارى راشد', 'مشاري', 'مشارى', 
      'mishary rashid alafasy', 'mishary rashid', 'mishari rashid', 'mishary alafasy', 'mishari alafasy', 
      'alafasy', 'mishary', 'mishari', 'al-afasy', 'al afasy', 'al-afasi', 'al afasi'
    ]
  },
  {
    name: 'محمود خليل الحصري',
    aliases: [
      'محمود خليل الحصرى', 'الحصري', 'الحصرى', 'خليل الحصري', 'خليل الحصرى', 
      'mahmoud khalil al-hussary', 'mahmoud khalil al hussary', 'al-hussary', 'al-hosary', 'al-husary', 
      'al-hosari', 'al hussary', 'al hosary', 'hussary', 'hosary', 'husary', 'hosari'
    ]
  },
  {
    name: 'محمد صديق المنشاوي',
    aliases: [
      'محمد صديق المنشاوى', 'المنشاوي', 'المنشاوى', 'صديق المنشاوي', 'صديق المنشاوى', 
      'mohamed siddiq el-minshawi', 'mohamed el minshawi', 'al-minshawi', 'al minshawi', 
      'minshawi', 'menshawy', 'al-menshawy', 'al menshawy'
    ]
  },
  {
    name: 'عبد الباسط عبد الصمد',
    aliases: [
      'عبدالباسط عبدالصمد', 'عبد الباسط', 'عبدالباسط', 'عبد الصمد', 'عبدالصمد', 
      'abdul basit abdel samad', 'abdelbasset abdessamad', 'abdulbasit', 'abdelbasset', 
      'abdul basit', 'abdul-basit', 'abdel-basset', 'abd el basit'
    ]
  },
  {
    name: 'ماهر المعيقلي',
    aliases: [
      'ماهر المعيقلى', 'المعيقلي', 'المعيقلى', 
      'maher al muaiqly', 'maher al-muaiqly', 'maher al-moaikli', 'maher al moaikli', 
      'al-muaiqly', 'al muaiqly', 'muaiqly', 'moaikli', 'maher'
    ]
  },
  {
    name: 'سعد الغامدي',
    aliases: ['سعد الغامدى', 'الغامدي', 'الغامدى', 'saad al ghamdi', 'saad al-ghamdi', 'al-ghamdi', 'al ghamdi', 'ghamdi']
  },
  {
    name: 'ياسر الدوسري',
    aliases: [
      'ياسر الدوسرى', 'الدوسري', 'الدوسرى', 
      'yasser al dossari', 'yasser al-dossari', 'yasser al dosari', 'yasser al-dosari', 
      'yasser aldosari', 'yasser aldossari', 'yasser dosari', 'yasser dossari',
      'yaser al dosari', 'yaser al-dosari', 'yaser al dossari', 'yaser al-dossari', 
      'yaser dosari', 'yaser dossari', 'al-dosari', 'al dosari', 'al-dossari', 'al dossari', 
      'aldosari', 'aldossari', 'dosari', 'dossari'
    ]
  },
  {
    name: 'عبد الرحمن السديس',
    aliases: [
      'عبدالرحمن السديس', 'السديس', 'abdul rahman al-sudais', 'abdul rahman al sudais', 
      'abdurrahman al-sudais', 'al-sudais', 'al sudais', 'sudais'
    ]
  },
  {
    name: 'سعود الشريم',
    aliases: ['سعود الشريم', 'الشريم', 'saud al-shuraim', 'saud al shuraim', 'al-shuraim', 'al shuraim', 'shuraim']
  },
  {
    name: 'أحمد بن علي العجمي',
    aliases: [
      'أحمد العجمي', 'احمد العجمي', 'أحمد العجمى', 'احمد العجمى', 'العجمي', 'العجمى', 
      'ahmed al-ajmi', 'ahmed al ajmi', 'al-ajmy', 'al-ajmi', 'al ajmi', 'ajmi'
    ]
  },
  {
    name: 'فارس عباد',
    aliases: ['فارس عباد', 'عباد', 'fares abbad', 'fares abad', 'abbad', 'abad']
  },
  {
    name: 'ناصر القطامي',
    aliases: ['ناصر القطامى', 'القطامي', 'القطامى', 'nasser al-qatami', 'nasser al qatami', 'al-qatami', 'al qatami', 'qatami']
  },
  {
    name: 'إدريس أبكر',
    aliases: ['ادريس ابكر', 'أبكر', 'ابكر', 'idris abkar', 'idrees abkar', 'abkar']
  },
  {
    name: 'خالد الجليل',
    aliases: ['خالد الجليل', 'الجليل', 'khalid al jalil', 'khalid al-jalil', 'al-jalil', 'al جلil', 'jalil']
  },
  {
    name: 'علي عبد الله جابر',
    aliases: ['علي جابر', 'على جابر', 'ali jaber', 'ali abdullah jaber', 'jaber']
  },
  {
    name: 'محمد أيوب',
    aliases: ['محمد ايوب', 'أيوب', 'ايوب', 'mohamed ayyoub', 'mohammed ayoub', 'ayyoub', 'ayoub']
  },
  {
    name: 'أبو بكر الشاطري',
    aliases: ['ابو بكر الشاطري', 'ابوبكر الشاطري', 'الشاطري', 'الشاطرى', 'abu bakr al shatri', 'abu bakr al-shatri', 'al-shatri', 'shatri']
  },
  {
    name: 'محمود علي البنا',
    aliases: ['محمود على البنا', 'على البنا', 'علي البنا', 'البنا', 'al-banna', 'mahmoud ali al banna']
  },
  {
    name: 'محمد محمود الطبلاوي',
    aliases: ['الطبلاوي', 'الطبلاوى', 'محمود الطبلاوي', 'tablawi', 'al-tablawi', 'al tablawi']
  },
  {
    name: 'إسلام صبحي',
    aliases: ['إسلام صبحى', 'اسلام صبحي', 'اسلام صبحى', 'islam sobhi', 'islam subhi', 'islam sobhy']
  }
];

function normalizeArabic(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim();
}

function detectQuranReciter(title = '', artist = '', album = '', description = '') {
  const combined = `${title || ''} ${artist || ''} ${album || ''} ${description || ''}`;
  const normCombined = normalizeArabic(combined);
  const lowerCombined = combined.toLowerCase();

  for (const r of SERVER_FAMOUS_RECITERS) {
    for (const alias of r.aliases) {
      const normAlias = normalizeArabic(alias);
      if (normAlias.length >= 3 && (normCombined.includes(normAlias) || lowerCombined.includes(alias.toLowerCase()))) {
        return r.name;
      }
    }
  }

  const prefixMatch = combined.match(/(?:بصوت\s+(?:الشيخ\s+|القارئ\s+)?|(?:فضيلة\s+)?الشيخ\s+|(?:فضيلة\s+)?القارئ\s+|تلاوة\s+(?:الشيخ\s+|القارئ\s+)?)([\u0621-\u064A\s]{4,28})/);
  if (prefixMatch && prefixMatch[1]) {
    const candidate = prefixMatch[1].trim();
    if (candidate.length > 3 && !/قرآن|قناة|مصحف|تلاوات|islam/i.test(candidate)) {
      return candidate;
    }
  }

  const enMatch = combined.match(/(?:recited\s+by\s+(?:sheikh\s+|qari\s+)?|(?:by\s+)?(?:sheikh\s+|qari\s+))([A-Za-z\s'-]{3,30})/i);
  if (enMatch && enMatch[1]) {
    const candidate = enMatch[1].trim();
    for (const r of SERVER_FAMOUS_RECITERS) {
      for (const alias of r.aliases) {
        if (candidate.toLowerCase().includes(alias.toLowerCase())) {
          return r.name;
        }
      }
    }
    if (candidate.length > 3 && !/channel|quran|sound|audio/i.test(candidate)) {
      return candidate;
    }
  }

  return null;
}

// Auto-migrate & classify existing Quran tracks, canonicalize reciters, and deduplicate albums on startup
setTimeout(async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      // 1. Auto-categorize Quran tracks and canonicalize generic reciter artists
      const tracks = await Track.find({});
      for (const t of tracks) {
        const isQuran = Boolean(t.isQuran || isQuranContent(t.title, t.artist, t.album, t.genre));
        if (!t.isQuran && isQuran) {
          await Track.updateOne({ _id: t._id }, { $set: { isQuran: true } });
        }
        if (isQuran) {
          const normArtist = normalizeArabic(t.artist || '');
          const isGenericArtist = !t.artist || /quran|balligho|artist|قرآن|تلاوات|unknown/i.test(normArtist);
          if (isGenericArtist) {
            const detected = detectQuranReciter(t.title, t.artist, t.album);
            if (detected && detected !== t.artist) {
              await Track.updateOne({ _id: t._id }, { $set: { artist: detected, isQuran: true } });
            }
          }
        }
      }

      // 2. Playlists isQuran flag
      const users = await User.find({});
      for (const u of users) {
        let changed = false;
        if (Array.isArray(u.playlists)) {
          for (const pl of u.playlists) {
            if (!pl.isQuran && isQuranContent(pl.name, '', '', '', pl.description)) {
              pl.isQuran = true;
              changed = true;
            }
          }
        }
        if (changed) {
          await u.save();
        }
      }

      // 3. Deduplicate albums by name
      const allAlbums = await Album.find().lean();
      const albumGroups = {};
      for (const a of allAlbums) {
        const key = (a.name || '').trim().toLowerCase();
        if (!albumGroups[key]) albumGroups[key] = [];
        albumGroups[key].push(a);
      }
      for (const [key, list] of Object.entries(albumGroups)) {
        if (list.length > 1) {
          list.sort((a, b) => (b.trackIds?.length || 0) - (a.trackIds?.length || 0));
          const keep = list[0];
          const duplicates = list.slice(1);
          const allTrackIds = new Set(keep.trackIds?.map(String) || []);
          for (const dup of duplicates) {
            (dup.trackIds || []).forEach(tid => allTrackIds.add(String(tid)));
          }
          await Album.updateOne({ _id: keep._id }, { $set: { trackIds: Array.from(allTrackIds) } });
          const dupIds = duplicates.map(d => d._id);
          await Album.deleteMany({ _id: { $in: dupIds } });
        }
      }

      console.log('✅ [Quran & Albums] Auto-categorized Quran tracks, canonicalized reciters & deduplicated albums');
    }
  } catch (err) {
    console.warn('[Quran] Migration warning:', err.message);
  }
}, 4500);

function makeToken(u) {
  const isAdmin = isAdminUser(u);
  return jwt.sign({
    id: u._id,
    email: u.email,
    name: u.name,
    role: isAdmin ? 'admin' : (u.role || 'user'),
    isAdmin
  }, JWT_SECRET, { expiresIn: '90d' });
}

function auth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  if (!t) return res.status(401).json({ error: 'Auth required' });
  try {
    req.user = verifyJwt(t);
    next();
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
}

function adminAuth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  if (!t) return res.status(401).json({ error: 'Auth required' });
  try {
    const decoded = verifyJwt(t);
    req.user = decoded;
    if (!isAdminUser(decoded)) {
      return res.status(403).json({ error: 'Permission denied. Administrator access required.' });
    }
    next();
  } catch {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
}

function optionalAuth(req, res, next) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  if (t) {
    try { req.user = verifyJwt(t); } catch {}
  }
  next();
}

// ──────────────────────────────────────────
// Search Cache Engine
// ──────────────────────────────────────────
const searchCache = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const ytSearchCache = new Map();

async function searchYouTubeId(query) {
  if (!query || !query.trim()) return null;
  const q = query.trim();
  const cacheKey = q.toLowerCase();
  if (ytSearchCache.has(cacheKey)) {
    return ytSearchCache.get(cacheKey);
  }

  // 1. YouTube Data API v3 (Official, unblocked on Railway)
  const apiKey = process.env.YOUTUBE_API_KEY || 'AIzaSyD9GLRXh9UgmhFbuhNqRfr-WPIT3QlWxJs';
  if (apiKey) {
    try {
      const res = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'id',
          q,
          type: 'video',
          maxResults: 1,
          key: apiKey
        },
        timeout: 4500
      });
      const videoId = res.data?.items?.[0]?.id?.videoId;
      if (videoId && videoId.length === 11) {
        if (ytSearchCache.size > 2000) ytSearchCache.clear();
        ytSearchCache.set(cacheKey, videoId);
        return videoId;
      }
    } catch (err) {
      console.warn('[searchYouTubeId] YouTube API error:', err?.response?.data?.error?.message || err.message);
    }
  }

  // 2. Invidious & Piped fallback
  const invidiousEndpoints = [
    'https://inv.nadeko.net/api/v1/search',
    'https://invidious.jing.rocks/api/v1/search',
    'https://yewtu.be/api/v1/search'
  ];
  for (const ep of invidiousEndpoints) {
    try {
      const invRes = await axios.get(`${ep}?q=${encodeURIComponent(q)}&type=video`, { timeout: 2500 });
      if (invRes.data && Array.isArray(invRes.data) && invRes.data[0]?.videoId) {
        const vid = invRes.data[0].videoId;
        ytSearchCache.set(cacheKey, vid);
        return vid;
      }
    } catch {}
  }

  // 3. Fallback scraping
  try {
    const res = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 3500
    });
    const matches = [...res.data.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g)].map(m => m[1]);
    const valid = matches.filter(id => id && id.length === 11);
    if (valid[0]) {
      ytSearchCache.set(cacheKey, valid[0]);
      return valid[0];
    }
  } catch {}

  return null;
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

async function fetchTrackMetadata(title, artist) {
  const q = `${artist || ''} ${title || ''}`.trim();
  if (!q) return null;
  try {
    const res = await axios.get(`https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=1`, { timeout: 3000 });
    const item = res.data?.results?.[0];
    if (item) {
      const art = item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : null;
      return {
        cover: art,
        album: item.collectionName || '',
        artist: item.artistName || artist,
        releaseDate: item.releaseDate ? item.releaseDate.split('-')[0] : '',
        genre: item.primaryGenreName || ''
      };
    }
  } catch {}
  return null;
}

function normalizeArtistName(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let clean = raw.trim();
  clean = clean.replace(/\s*-\s*topic\b/gi, '');
  clean = clean.replace(/\b(official(?:\s*(?:channel|music|video|audio|records|tv|page))?|offical|vevo|topic|channel)\b/gi, '');
  clean = clean.replace(/^["'\[\(]+|["'\]\)]+$/g, '');
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean;
}

const CANONICAL_ARTIST_MAP = [
  {
    canonical: 'Cairokee',
    aliases: [
      'cairokee', 'cairokeeoffical', 'cairokeeofficial', 'cairokee official',
      'amir eid', 'amireid', 'أمير عيد', 'كايروكي'
    ]
  },
  {
    canonical: 'Mohamed Hamaki',
    aliases: ['hamaki', 'mohamed hamaki', 'محمد حماقي', 'حماقي']
  },
  {
    canonical: 'Amr Diab',
    aliases: ['amr diab', 'عمرو دياب', 'elhadaba', 'el hadaba']
  },
  {
    canonical: 'Tamer Hosny',
    aliases: ['tamer hosny', 'tamer hosni', 'تامر حسني']
  },
  {
    canonical: 'Marwan Pablo',
    aliases: ['marwan pablo', 'pablo', 'مروان بابلو', 'بابلو']
  },
  {
    canonical: 'Wegz',
    aliases: ['wegz', 'ويجز']
  },
  {
    canonical: 'Lege-Cy',
    aliases: ['lege-cy', 'lege cy', 'legecy', 'ليجي سي', 'ليجي-سي']
  },
  {
    canonical: 'Abyusif',
    aliases: ['abyusif', 'أبيوسف', 'ابيوسف']
  },
  {
    canonical: 'Marwan Moussa',
    aliases: ['marwan moussa', 'marwan mousa', 'مروان موسى']
  },
  {
    canonical: 'Afroto',
    aliases: ['afroto', 'عفروتو']
  },
  {
    canonical: 'Sharmoofers',
    aliases: ['sharmoofers', 'شارموفرز']
  },
  {
    canonical: 'Massar Egbari',
    aliases: ['massar egbari', 'مسار إجباري', 'مسار اجباري']
  },
  {
    canonical: 'Ahmed Saad',
    aliases: ['ahmed saad', 'أحمد سعد', 'احمد سعد']
  },
  {
    canonical: 'Bahaa Sultan',
    aliases: ['bahaa sultan', 'بهاء سلطان']
  },
  {
    canonical: 'Sherine',
    aliases: ['sherine', 'sherine abdel-wahab', 'sherine abdel wahab', 'شيرين', 'شيرين عبد الوهاب']
  }
];

function getCanonicalArtistName(rawName) {
  if (!rawName || typeof rawName !== 'string') return '';
  const trimmed = rawName.trim();
  const lower = trimmed.toLowerCase();
  const normalized = normalizeArtistName(trimmed).toLowerCase();

  for (const group of CANONICAL_ARTIST_MAP) {
    if (group.aliases.includes(lower) || group.aliases.includes(normalized)) {
      return group.canonical;
    }
  }

  const clean = normalizeArtistName(trimmed);
  return clean || trimmed;
}

function getArtistAliases(artistName) {
  if (!artistName || typeof artistName !== 'string') return [];
  const canonical = getCanonicalArtistName(artistName).toLowerCase();
  for (const group of CANONICAL_ARTIST_MAP) {
    if (group.canonical.toLowerCase() === canonical) {
      return group.aliases;
    }
  }
  return [artistName.toLowerCase().trim()];
}

function isValidAlbumName(albumName) {
  if (!albumName || typeof albumName !== 'string') return false;
  const clean = albumName.trim().toLowerCase();
  const invalid = [
    '', 'single', 'single cassette', 'singles', 'single release',
    'unknown', 'unknown album', 'track', 'audio', 'youtube', 'soundcloud',
    'import', 'spotify', 'spotify playlist', 'imported playlist', 'official audio',
    'playlist', 'my playlist', 'favorites', 'liked songs', 'new playlist'
  ];
  if (invalid.includes(clean)) return false;
  if (clean.startsWith('playlist') || clean.endsWith('playlist')) return false;
  if (clean.length < 2) return false;
  return true;
}

async function syncTrackToAlbum(track) {
  // Albums are strictly admin-created. Only attach to an existing album if one already exists.
  if (!track || !track.title || !track.artist || !track.album) return null;
  const albumTitle = (track.album || '').trim();
  const artistName = track.artist.trim();
  const trackId = String(track._id || track.id);
  if (!isValidAlbumName(albumTitle)) return null;

  try {
    const escapeRegex = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    let album = await Album.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(albumTitle)}$`, 'i') },
      artist: { $regex: new RegExp(`^${escapeRegex(artistName)}$`, 'i') }
    });

    if (album) {
      if (!album.trackIds.includes(trackId)) {
        album.trackIds.push(trackId);
        await album.save();
      }
      return album;
    }
  } catch (err) {
    console.warn('[Album] syncTrackToAlbum error:', err.message);
  }
  return null;
}

async function resolveTrackAudio(title, artist) {
  const query = `${artist || ''} ${title || ''}`.trim();
  if (!query) return null;

  // YouTube Audio Resolution via Official YouTube Data API v3 & scrapers
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
  } catch (err) {
    console.warn('[resolveTrackAudio] YouTube error:', err.message);
  }

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

app.get('/api/auth/me', auth, async (req, res) => {
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
    userObj.isAdmin = isAdminUser(userObj);
    userObj.role = userObj.isAdmin ? 'admin' : (userObj.role || 'user');
    userObj.isVerified = isVerifiedUser(userObj.name);
    res.json({ success: true, user: userObj });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────
// ADMIN MANAGEMENT ROUTES (Admins Only)
// ──────────────────────────────────────────
function escapeRegex(s) {
  return (s || '').replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

// View EVERY account created in the website without searching
app.get('/api/admin/users', adminAuth, async (req, res) => {
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
app.patch('/api/admin/users/:id/role', adminAuth, async (req, res) => {
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
    res.json({
      success: true,
      user: {
        id: user._id,
        role: user.role,
        isAdmin: user.isAdmin,
        isVerified: user.isVerified
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────
// ARTIST PROFILE MANAGEMENT (Admins Only to Edit)
// ──────────────────────────────────────────

app.put('/api/artists/:name', adminAuth, async (req, res) => {
  try {
    const rawName = decodeURIComponent(req.params.name).trim();
    const { name, bio, cover, banner, isVerified, customLinks } = req.body;
    const newName = (name || rawName).trim();
    const artistId = newName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');

    const updated = await Artist.findOneAndUpdate(
      { name: { $regex: new RegExp(`^${escapeRegex(rawName)}$`, 'i') } },
      {
        $set: {
          id: artistId,
          name: newName,
          bio: bio !== undefined ? bio : '',
          cover: cover || '',
          banner: banner || '',
          isVerified: isVerified !== undefined ? Boolean(isVerified) : false,
          customLinks: customLinks || [],
          updatedBy: req.user.name || 'admin'
        }
      },
      { upsert: true, new: true }
    );

    // If name was updated, also update tracks and albums with old artist name
    if (name && rawName.toLowerCase() !== newName.toLowerCase()) {
      await Track.updateMany(
        { artist: { $regex: new RegExp(`^${escapeRegex(rawName)}$`, 'i') } },
        { $set: { artist: newName } }
      ).catch(() => {});
      await Album.updateMany(
        { artist: { $regex: new RegExp(`^${escapeRegex(rawName)}$`, 'i') } },
        { $set: { artist: newName } }
      ).catch(() => {});
    }

    io.emit('artist:updated', updated);
    res.json({ success: true, artist: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
      queryFilter = { name: { $regex: escapeRegex(q), $options: 'i' } };
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
    const rawId = req.params.id;
    let target = null;
    if (mongoose.isValidObjectId(rawId)) {
      target = await User.findById(rawId)
        .select('_id name avatar bio playlists followers following createdAt')
        .lean();
    }
    if (!target) {
      target = await User.findOne({ $or: [{ id: rawId }, { name: rawId }] })
        .select('_id name avatar bio playlists followers following createdAt')
        .lean();
    }
    if (!target) return res.status(404).json({ error: 'User not found' });

    const currentUserId = req.user?.id ? String(req.user.id) : '';
    const isFollowing = currentUserId ? (target.followers || []).map(String).includes(currentUserId) : false;
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
        _id: String(target._id),
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
    const rawId = req.params.id;
    let target = null;
    if (mongoose.isValidObjectId(rawId)) {
      target = await User.findById(rawId);
    }
    if (!target) {
      target = await User.findOne({ $or: [{ id: rawId }, { name: rawId }] });
    }
    if (!target) return res.status(404).json({ error: 'User not found' });

    const targetId = String(target._id);
    const currentUserId = String(req.user.id);
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
    const rawId = req.params.id;
    let target = null;
    if (mongoose.isValidObjectId(rawId)) {
      target = await User.findById(rawId);
    }
    if (!target) {
      target = await User.findOne({ $or: [{ id: rawId }, { name: rawId }] });
    }
    if (!target) return res.status(404).json({ error: 'User not found' });

    const targetId = String(target._id);
    const currentUserId = String(req.user.id);

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
        friends = followedUsers.map(u => {
          const uId = String(u._id);
          const isOnline = Boolean(userSocketMap.has(uId) && userSocketMap.get(uId).size > 0);
          const lastActivityTime = new Date(u.currentListening?.updatedAt || u.lastActiveAt || u.updatedAt || 0).getTime();
          const isRecent = (Date.now() - lastActivityTime) < 180000; // within 3 minutes
          // User is only live if they are currently online AND actively playing AND activity is recent
          const isLive = Boolean(isOnline && u.currentListening?.isPlaying && isRecent);

          return {
            id: uId,
            name: u.name,
            avatar: u.avatar || '',
            bio: u.bio || '',
            isVerified: isVerifiedUser(u.name),
            currentListening: u.currentListening || null,
            lastActiveAt: u.lastActiveAt || u.updatedAt || null,
            isOnline,
            isLive
          };
        });
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
    const now = new Date();
    const updateData = {
      lastActiveAt: now,
      currentListening: track ? {
        id: track.id || track._id,
        title: track.title,
        artist: track.artist,
        cover: track.cover,
        audioUrl: track.audioUrl,
        isPlaying: Boolean(isPlaying),
        updatedAt: now
      } : null
    };

    const user = await User.findByIdAndUpdate(req.user.id, { $set: updateData }, { new: true });
    const uidStr = String(user._id);
    const isOnline = Boolean(userSocketMap.has(uidStr) && userSocketMap.get(uidStr).size > 0);
    
    // Broadcast via socket.io
    io.emit('activity:updated', {
      userId: uidStr,
      name: user.name,
      avatar: user.avatar,
      currentListening: user.currentListening,
      lastActiveAt: user.lastActiveAt,
      isOnline,
      isLive: Boolean(isPlaying && isOnline)
    });

    res.json({ success: true, currentListening: user.currentListening });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Helper for ISO week
function getCurrentISOWeek() {
  const d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// ──────────────────────────────────────────
// Listening Activity & Real Stats APIs
// ──────────────────────────────────────────
app.post('/api/stats/listen', optionalAuth, async (req, res) => {
  try {
    const { trackId, title, artist, cover, seconds = 0, isCompleted = false } = req.body;
    const sec = Math.max(0, Math.min(300, Number(seconds) || 0));
    const currentWeek = getCurrentISOWeek();

    // 1. If user is authenticated, update their real stats
    if (req.user?.id) {
      const user = await User.findById(req.user.id);
      if (user) {
        if (user.weeklyWeek !== currentWeek) {
          user.weeklyWeek = currentWeek;
          user.weeklyListeningSeconds = 0;
        }

        user.totalListeningSeconds = (user.totalListeningSeconds || 0) + sec;
        user.weeklyListeningSeconds = (user.weeklyListeningSeconds || 0) + sec;

        if (title && artist) {
          if (!user.topTrack || !user.topTrack.title) {
            user.topTrack = { id: trackId, title, artist, cover: cover || '', plays: isCompleted ? 1 : 0, seconds: sec };
          } else if (user.topTrack.title === title) {
            user.topTrack.seconds = (user.topTrack.seconds || 0) + sec;
            if (isCompleted) user.topTrack.plays = (user.topTrack.plays || 0) + 1;
            if (cover) user.topTrack.cover = cover;
          } else if (sec > (user.topTrack.seconds || 0) && isCompleted) {
            user.topTrack = { id: trackId, title, artist, cover: cover || user.topTrack.cover || '', plays: 1, seconds: sec };
          }
        }

        user.lastActiveAt = new Date();
        await user.save();
      }
    }

    // 2. Increment real track plays in Track collection if completed
    if (isCompleted && trackId) {
      await Track.updateOne(
        { $or: [{ _id: mongoose.isValidObjectId(trackId) ? trackId : null }, { id: trackId }] },
        { $inc: { plays: 1 } }
      ).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats/leaderboard', optionalAuth, async (req, res) => {
  try {
    const currentWeek = getCurrentISOWeek();
    const users = await User.find({})
      .select('_id name avatar role isAdmin isVerified totalListeningSeconds weeklyListeningSeconds weeklyWeek topTrack')
      .lean();

    const currentUserId = req.user?.id ? String(req.user.id) : '';

    const leaderboard = users.map(u => {
      const isCurWeek = u.weeklyWeek === currentWeek;
      const weeklySec = isCurWeek ? (u.weeklyListeningSeconds || 0) : 0;
      const totalSec = u.totalListeningSeconds || 0;
      const effectiveSec = weeklySec > 0 ? weeklySec : (totalSec > 0 ? totalSec : 0);
      const minutes = Math.floor(effectiveSec / 60);

      return {
        id: String(u._id),
        name: u.name,
        avatar: u.avatar || '',
        minutes,
        seconds: effectiveSec,
        topSong: u.topTrack?.title ? `${u.topTrack.title} - ${u.topTrack.artist}` : 'Various Tracks',
        isVerified: isVerifiedUser(u.name) || Boolean(u.isVerified),
        isCurrentUser: Boolean(currentUserId && String(u._id) === currentUserId)
      };
    });

    leaderboard.sort((a, b) => b.seconds - a.seconds);

    const ranked = leaderboard.map((item, idx) => ({
      ...item,
      rank: idx + 1
    }));

    res.json({
      success: true,
      currentWeek,
      leaderboard: ranked
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user followers list
app.get('/api/users/:id/followers', optionalAuth, async (req, res) => {
  try {
    const rawId = req.params.id;
    let target = null;
    if (mongoose.isValidObjectId(rawId)) {
      target = await User.findById(rawId).select('followers').lean();
    }
    if (!target) {
      target = await User.findOne({ $or: [{ id: rawId }, { name: rawId }] }).select('followers').lean();
    }
    if (!target) return res.status(404).json({ error: 'User not found' });

    const rawIds = (target.followers || []).map(f => {
      if (!f) return null;
      if (typeof f === 'object' && f._id) return String(f._id);
      return String(f);
    }).filter(Boolean);

    const validObjectIds = rawIds.filter(id => mongoose.isValidObjectId(id));
    const followerUsers = await User.find({
      $or: [
        { _id: { $in: validObjectIds } },
        { id: { $in: rawIds } }
      ]
    }).select('_id name avatar bio').lean();

    const followers = followerUsers.map(f => ({
      id: String(f._id),
      _id: String(f._id),
      name: f.name,
      avatar: f.avatar || '',
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
    const rawId = req.params.id;
    let target = null;
    if (mongoose.isValidObjectId(rawId)) {
      target = await User.findById(rawId).select('following').lean();
    }
    if (!target) {
      target = await User.findOne({ $or: [{ id: rawId }, { name: rawId }] }).select('following').lean();
    }
    if (!target) return res.status(404).json({ error: 'User not found' });

    const rawIds = (target.following || []).map(f => {
      if (!f) return null;
      if (typeof f === 'object' && f._id) return String(f._id);
      return String(f);
    }).filter(Boolean);

    const validObjectIds = rawIds.filter(id => mongoose.isValidObjectId(id));
    const followingUsers = await User.find({
      $or: [
        { _id: { $in: validObjectIds } },
        { id: { $in: rawIds } }
      ]
    }).select('_id name avatar bio').lean();

    const following = followingUsers.map(f => ({
      id: String(f._id),
      _id: String(f._id),
      name: f.name,
      avatar: f.avatar || '',
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

    if (!recipientId || recipientId === 'undefined' || recipientId === 'null' || !mongoose.isValidObjectId(recipientId)) {
      return res.json({ success: true, messages: [] });
    }

    // Mark messages from this sender to current user as read
    await Message.updateMany(
      { sender: recipientId, recipient: currentUserId, read: false },
      { $set: { read: true } }
    ).catch(() => {});

    // Notify original sender that their messages were seen
    io.to(`user:${recipientId}`).emit('chat:seen', {
      seenBy: currentUserId,
      senderId: recipientId,
      readAt: Date.now()
    });

    // Dismiss notification on reader's other connected devices (e.g. mobile/desktop sync)
    io.to(`user:${currentUserId}`).emit('chat:dismiss_notification', {
      senderId: recipientId
    });

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

    if (jamInvite && jamInvite.roomCode) {
      io.to(`user:${recipientId}`).emit('jam:invite_received', {
        roomCode: jamInvite.roomCode,
        host: {
          id: req.user.id,
          name: sender?.name || jamInvite.hostName || 'Friend',
          avatar: sender?.avatar || jamInvite.hostAvatar || ''
        },
        createdAt: Date.now()
      });
    }

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
        source: 'Rivo'
      }));

    // 2. Query YouTube Data API v3 FIRST for official releases (Instant & High Quality)
    let ytTracks = [];
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (apiKey) {
      try {
        const ytRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
          params: {
            part: 'snippet',
            q: `${targetQuery}`,
            type: 'video',
            maxResults: 12,
            key: apiKey
          },
          timeout: 4000
        });
        if (ytRes.data?.items && Array.isArray(ytRes.data.items)) {
          ytTracks = ytRes.data.items
            .filter(item => item?.id?.videoId)
            .map(item => {
              const videoId = item.id.videoId;
              let title = item.snippet?.title || targetQuery;
              title = title
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>');
              const artist = (item.snippet?.channelTitle || 'YouTube').replace(/ - Topic$/i, '');
              const cover = item.snippet?.thumbnails?.high?.url ||
                            item.snippet?.thumbnails?.medium?.url ||
                            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
              return {
                id: `yt-${videoId}`,
                title,
                artist,
                album: 'YouTube',
                cover,
                audioUrl: `https://www.youtube.com/watch?v=${videoId}`,
                duration: 240,
                source: 'YouTube'
              };
            })
            .filter(t => isMusicTrackServer(t.title, t.artist));
        }
      } catch (err) {
        console.warn('[Search] YouTube API search error:', err?.response?.data?.error?.message || err.message);
      }
    }

    // Fallback scraping if API returned 0 or quota reached
    if (ytTracks.length === 0) {
      try {
        const ytSearchStr = `${targetQuery} music`;
        const ytRes = await axios.get(`https://www.youtube.com/results?search_query=${encodeURIComponent(ytSearchStr)}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          timeout: 3500
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
              const durText = v.lengthText?.simpleText || v.lengthText?.runs?.[0]?.text || '';
              let durSec = 0;
              if (durText) {
                const parts = durText.split(':').map(p => parseInt(p, 10));
                if (parts.length === 2) durSec = parts[0] * 60 + parts[1];
                else if (parts.length === 3) durSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
              }
              return {
                id: `yt-${v.videoId}`,
                title,
                artist,
                album: 'YouTube',
                cover: v.thumbnail?.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
                audioUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
                duration: (durSec && durSec > 0 && durSec < 86400) ? durSec : 210,
                source: 'YouTube'
              };
            })
            .filter(t => isMusicTrackServer(t.title, t.artist))
            .slice(0, 10);
        }
      } catch {}
    }

    const allTracks = [...formattedDbTracks, ...ytTracks];
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
// PLAYLIST & ALBUM SCRAPER (Spotify, YouTube, Apple Music)
// ──────────────────────────────────────────
async function scrapePlaylistOrAlbum(url) {
  let title = 'Imported Collection';
  let cover = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600';
  let artist = '';
  let rawItems = [];
  let isAlbum = false;

  const isSpotifyAlbum = url.includes('spotify.com/album') || url.includes('spotify:album');
  const isSpotifyPlaylist = url.includes('spotify.com/playlist') || url.includes('spotify:playlist');
  isAlbum = isSpotifyAlbum;

  if (isSpotifyPlaylist || isSpotifyAlbum) {
    const match = isSpotifyAlbum
      ? (url.match(/album\/([a-zA-Z0-9]+)/) || url.match(/spotify:album:([a-zA-Z0-9]+)/))
      : (url.match(/playlist\/([a-zA-Z0-9]+)/) || url.match(/spotify:playlist:([a-zA-Z0-9]+)/));
    const entityId = match ? match[1] : null;

    if (!entityId) throw new Error(`Invalid Spotify ${isSpotifyAlbum ? 'album' : 'playlist'} link`);

    // Fetch Spotify Embed page which has embedded JSON metadata
    try {
      const embedType = isSpotifyAlbum ? 'album' : 'playlist';
      const embedRes = await axios.get(`https://open.spotify.com/embed/${embedType}/${entityId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 10000
      });

      const html = embedRes.data;
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
      if (nextDataMatch) {
        const parsed = JSON.parse(nextDataMatch[1]);
        const entity = parsed?.props?.pageProps?.state?.data?.entity;
        if (entity) {
          title = entity.name || title;
          if (entity.coverArt?.sources?.[0]?.url) cover = entity.coverArt.sources[0].url;

          artist = entity.subtitle || entity.artists?.[0]?.name || '';
          const defaultArtist = artist || 'Artist';
          const trackList = entity.trackList || [];
          rawItems = trackList.map(t => ({
            title: t.title || t.name,
            artist: t.subtitle || t.artists?.[0]?.name || defaultArtist,
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
    if (!listId) throw new Error('Invalid YouTube playlist link');

    try {
      const ytRes = await axios.get(`https://www.youtube.com/playlist?list=${listId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9'
        },
        timeout: 12000
      });
      const html = ytRes.data;

      // Recursive helpers to extract YouTube playlist tracks and continuation tokens
      const extractYTVideos = (node, dest = []) => {
        if (!node || typeof node !== 'object') return dest;
        if (node.lockupViewModel && node.lockupViewModel.contentId) {
          const vm = node.lockupViewModel;
          const videoId = vm.contentId;
          const vTitle = vm.metadata?.lockupMetadataViewModel?.title?.content || 'Unknown Track';
          const metadataRows = vm.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows || [];
          const author = metadataRows[0]?.metadataParts?.[0]?.text?.content || 'Artist';
          const duration = parseDurationFromLabel(vm.rendererContext?.accessibilityContext?.label);
          const vCover = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          dest.push({
            title: vTitle,
            artist: author,
            videoId,
            duration,
            cover: vCover,
            audioUrl: `https://www.youtube.com/watch?v=${videoId}`
          });
        } else if (node.playlistVideoRenderer && node.playlistVideoRenderer.videoId) {
          const p = node.playlistVideoRenderer;
          const videoId = p.videoId;
          const vTitle = p.title?.runs?.[0]?.text || p.title?.simpleText || 'Unknown Track';
          const author = p.shortBylineText?.runs?.[0]?.text || 'Artist';
          const duration = p.lengthSeconds ? parseInt(p.lengthSeconds, 10) : 200;
          const vCover = p.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          dest.push({
            title: vTitle,
            artist: author,
            videoId,
            duration,
            cover: vCover,
            audioUrl: `https://www.youtube.com/watch?v=${videoId}`
          });
        } else if (Array.isArray(node)) {
          for (const el of node) extractYTVideos(el, dest);
        } else {
          for (const k of Object.keys(node)) {
            if (k !== 'lockupViewModel' && k !== 'playlistVideoRenderer') {
              extractYTVideos(node[k], dest);
            }
          }
        }
        return dest;
      };

      const findYTContinuationToken = (node) => {
        if (!node || typeof node !== 'object') return null;
        if (node.continuationItemRenderer) {
          const tok = node.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
          if (tok) return tok;
        }
        if (node.continuationCommand && node.continuationCommand.token) {
          return node.continuationCommand.token;
        }
        if (Array.isArray(node)) {
          for (const el of node) {
            const tok = findYTContinuationToken(el);
            if (tok) return tok;
          }
        } else {
          for (const k of Object.keys(node)) {
            const tok = findYTContinuationToken(node[k]);
            if (tok) return tok;
          }
        }
        return null;
      };

      // Try extracting ytInitialData
      const initialDataMatch = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/ytInitialData\s*=\s*({.+?});/);
      if (initialDataMatch) {
        try {
          const data = JSON.parse(initialDataMatch[1]);
          const headerTitle = data?.metadata?.playlistMetadataRenderer?.title || data?.header?.playlistHeaderRenderer?.title?.simpleText;
          if (headerTitle) title = headerTitle;

          const headerOwner = data?.header?.playlistHeaderRenderer?.ownerText?.runs?.[0]?.text;
          if (headerOwner) artist = headerOwner;

          extractYTVideos(data, rawItems);
          let continuationToken = findYTContinuationToken(data);

          // Extract InnerTube API key
          const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || html.match(/"innertubeApiKey":"([^"]+)"/i) || html.match(/"key":"(AIza[^"]+)"/);
          const apiKey = apiKeyMatch ? apiKeyMatch[1] : null;
          const clientVersionMatch = html.match(/"INNERTUBE_CONTEXT_CLIENT_VERSION":"([^"]+)"/) || html.match(/"clientVersion":"([^"]+)"/);
          const clientVersion = clientVersionMatch ? clientVersionMatch[1] : '2.20240101.00.00';

          // Paginate through continuation tokens
          let pageCount = 0;
          const MAX_PAGES = 30;

          while (continuationToken && apiKey && pageCount < MAX_PAGES) {
            pageCount++;
            try {
              const contRes = await axios.post(
                `https://www.youtube.com/youtubei/v1/browse?key=${apiKey}`,
                {
                  context: {
                    client: {
                      clientName: 'WEB',
                      clientVersion: clientVersion,
                      hl: 'en',
                      gl: 'US'
                    }
                  },
                  continuation: continuationToken
                },
                {
                  headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Content-Type': 'application/json'
                  },
                  timeout: 10000
                }
              );

              const contData = contRes.data;
              const prevLen = rawItems.length;
              extractYTVideos(contData, rawItems);
              continuationToken = findYTContinuationToken(contData);

              if (rawItems.length === prevLen) {
                break;
              }
            } catch (pageErr) {
              console.warn(`[YouTube Scraper] Continuation page ${pageCount} failed:`, pageErr.message);
              break;
            }
          }

          // Deduplicate items by videoId
          const seenVids = new Set();
          rawItems = rawItems.filter(item => {
            if (!item.videoId) return true;
            if (seenVids.has(item.videoId)) return false;
            seenVids.add(item.videoId);
            return true;
          });
        } catch (e) {
          console.warn('ytInitialData parse error:', e.message);
        }
      }

      // Fallback: title from HTML tag
      if (title === 'Imported Collection') {
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
          title = titleMatch[1].replace(' - YouTube', '').trim();
        }
      }

      if (rawItems.length > 0 && rawItems[0].cover) {
        cover = rawItems[0].cover;
      }
    } catch (err) {
      if (err.response?.status === 404) {
        throw new Error('YouTube playlist not found (404). Please verify the link is complete and the playlist is public.');
      }
      console.warn('YouTube playlist scrape failed:', err.message);
      throw err;
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
        title = titleMatch[1].replace(' - Apple Music', '').trim();
      }
    } catch (err) {}
  }

  // Derive artist fallback if empty
  if (!artist && rawItems.length > 0) {
    const artistCounts = {};
    rawItems.forEach(item => {
      if (item.artist && item.artist !== 'Artist') {
        artistCounts[item.artist] = (artistCounts[item.artist] || 0) + 1;
      }
    });
    const sorted = Object.entries(artistCounts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) artist = sorted[0][0];
  }

  return { title, cover, artist, isAlbum, items: rawItems };
}

// ──────────────────────────────────────────
// PLAYLIST IMPORT (Spotify, YouTube, Apple Music)
// ──────────────────────────────────────────
app.post('/api/playlists/import', auth, async (req, res) => {
  try {
    const { url, isQuran } = req.body;
    if (!url) return res.status(400).json({ error: 'Playlist URL is required' });

    let scraped;
    try {
      scraped = await scrapePlaylistOrAlbum(url);
    } catch (err) {
      return res.status(400).json({ error: err.message || 'Failed to scrape playlist link' });
    }

    if (!scraped || !scraped.items || scraped.items.length === 0) {
      return res.status(400).json({ error: 'Could not extract tracks from playlist. Please verify the link is public.' });
    }

    const playlistTitle = scraped.title || 'Imported Playlist';
    const playlistCover = scraped.cover;
    const isAlbum = scraped.isAlbum;
    const rawItems = scraped.items;

    // Save tracks to database (no limit, full support for Quran playlists)
    const finalIsQuran = Boolean(isQuran || isQuranContent(playlistTitle, '', '', ''));
    const detectedPlaylistReciter = finalIsQuran ? detectQuranReciter(playlistTitle, scraped.artist, '', '') : null;
    const trackIds = [];
    const createdTracks = [];

    const tracksToInsert = [];
    for (const item of rawItems) {
      try {
        const duration = item.duration || 180;
        const ytId = item.videoId || (item.audioUrl ? null : await searchYouTubeId(`${item.artist} - ${item.title}`));
        let trackCover = item.cover || (item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : null);
        if (!trackCover && !item.videoId) trackCover = await fetchTrackCover(item.title, item.artist);
        if (!trackCover && ytId) trackCover = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
        if (!trackCover) trackCover = playlistCover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';

        const audioUrl = item.audioUrl || (ytId ? `https://www.youtube.com/watch?v=${ytId}` : '');
        const itemIsQuran = Boolean(finalIsQuran || isQuranContent(item.title, item.artist, playlistTitle, ''));
        const finalAlbumName = isAlbum ? playlistTitle : (item.album || '');

        let trackArtist = item.artist;
        if (itemIsQuran) {
          const itemReciter = detectQuranReciter(item.title, item.artist, finalAlbumName) || detectedPlaylistReciter;
          if (itemReciter) {
            trackArtist = itemReciter;
          }
        }

        tracksToInsert.push({
          title: item.title,
          artist: trackArtist,
          album: finalAlbumName,
          cover: trackCover,
          audioUrl,
          duration,
          genre: itemIsQuran ? 'Quran' : 'Imported',
          source: item.videoId ? 'YouTube' : 'Spotify',
          isQuran: itemIsQuran
        });
      } catch (err) {}
    }

    if (mongoose.connection.readyState === 1 && tracksToInsert.length > 0) {
      try {
        const inserted = await Track.insertMany(tracksToInsert, { ordered: false });
        for (const t of inserted) {
          const tid = String(t._id);
          trackIds.push(tid);
          createdTracks.push({
            id: tid,
            _id: tid,
            title: t.title,
            artist: t.artist,
            album: t.album,
            cover: t.cover,
            audioUrl: t.audioUrl,
            duration: t.duration,
            genre: t.genre,
            source: t.source,
            isQuran: t.isQuran
          });
        }
      } catch (insertErr) {
        if (insertErr.insertedDocs && insertErr.insertedDocs.length > 0) {
          for (const t of insertErr.insertedDocs) {
            const tid = String(t._id);
            trackIds.push(tid);
            createdTracks.push({
              id: tid,
              _id: tid,
              title: t.title,
              artist: t.artist,
              album: t.album,
              cover: t.cover,
              audioUrl: t.audioUrl,
              duration: t.duration,
              genre: t.genre,
              source: t.source,
              isQuran: t.isQuran
            });
          }
        }
      }
    }

    if (createdTracks.length === 0) {
      for (const t of tracksToInsert) {
        const tid = `track-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        trackIds.push(tid);
        createdTracks.push({ id: tid, _id: tid, ...t });
      }
    }

    // Add new playlist to user
    const newPlaylist = {
      id: `pl-${Date.now()}`,
      name: playlistTitle,
      cover: playlistCover,
      trackIds,
      isLikedSongs: false,
      isAlbum: Boolean(isAlbum),
      isPublic: true,
      isQuran: Boolean(finalIsQuran),
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

    if (isAlbum && isAdminUser(req.user)) {
      try {
        const albumArtist = rawItems[0]?.artist || 'Artist';
        const escapeRegex = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        let siteAlbum = await Album.findOne({
          name: { $regex: new RegExp(`^${escapeRegex(playlistTitle)}$`, 'i') },
          artist: { $regex: new RegExp(`^${escapeRegex(albumArtist)}$`, 'i') }
        });
        if (siteAlbum) {
          siteAlbum.trackIds = Array.from(new Set([...siteAlbum.trackIds, ...trackIds]));
          siteAlbum.cover = playlistCover || siteAlbum.cover;
          await siteAlbum.save();
        } else {
          siteAlbum = new Album({
            id: `album-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            name: playlistTitle,
            artist: albumArtist,
            cover: playlistCover,
            trackIds,
            genre: 'Imported',
            isAlbum: true,
            isSystem: true,
            isPublic: true
          });
          await siteAlbum.save();
        }
      } catch (err) {
        console.warn('Could not register imported album to Album collection:', err.message);
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
// TRACK IMPORT BY LINK (Spotify, YouTube, SoundCloud, Apple Music, Direct)
// ──────────────────────────────────────────
app.post(['/api/tracks/import', '/api/tracks/import-link'], optionalAuth, async (req, res) => {
  try {
    const rawUrl = (req.body.url || '').trim();
    if (!rawUrl) return res.status(400).json({ error: 'Song link / URL is required' });

    let title = '';
    let artist = '';
    let album = 'Single';
    let cover = '';
    let audioUrl = '';
    let duration = 200;
    let source = 'Imported';

    // 1. Detect Spotify Track
    if (rawUrl.includes('spotify.com/track') || rawUrl.includes('spotify:track:')) {
      const match = rawUrl.match(/track\/([a-zA-Z0-9]+)/) || rawUrl.match(/spotify:track:([a-zA-Z0-9]+)/);
      const trackId = match ? match[1] : null;
      if (!trackId) return res.status(400).json({ error: 'Invalid Spotify track link' });

      source = 'Spotify';
      try {
        const embedRes = await axios.get(`https://open.spotify.com/embed/track/${trackId}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          timeout: 8000
        });
        const html = embedRes.data;
        const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
        if (nextDataMatch) {
          const parsed = JSON.parse(nextDataMatch[1]);
          const entity = parsed?.props?.pageProps?.state?.data?.entity;
          if (entity) {
            title = entity.name || entity.title || '';
            if (Array.isArray(entity.artists) && entity.artists.length > 0) {
              artist = entity.artists.map(a => a.name).filter(Boolean).join(', ');
            } else {
              artist = entity.subtitle || '';
            }
            if (entity.duration) duration = Math.round(entity.duration / 1000);
            const imgs = entity.visualIdentity?.image || [];
            if (imgs.length > 0) {
              cover = imgs[imgs.length - 1]?.url || imgs[0]?.url;
            }
          }
        }
      } catch (err) {
        console.warn('[Import Track] Spotify embed fetch failed:', err.message);
      }

      // Fallback via Spotify oEmbed if embed failed to provide title/artist
      if (!title) {
        try {
          const oRes = await axios.get(`https://open.spotify.com/oembed?url=https://open.spotify.com/track/${trackId}`, { timeout: 5000 });
          title = oRes.data?.title || '';
          artist = oRes.data?.author_name || 'Spotify Artist';
          if (!cover && oRes.data?.thumbnail_url) cover = oRes.data.thumbnail_url;
        } catch {}
      }

      if (!title) {
        return res.status(400).json({ error: 'Could not extract metadata from Spotify track link' });
      }

      // High-res cover & metadata via iTunes
      if (!cover || cover.includes('unsplash')) {
        const metaCover = await fetchTrackCover(title, artist);
        if (metaCover) cover = metaCover;
      }

      // Resolve audio stream via YouTube search
      const ytId = await searchYouTubeId(`${artist} - ${title}`);
      if (ytId) {
        audioUrl = `https://www.youtube.com/watch?v=${ytId}`;
        if (!cover) cover = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
      }
    }
    // 2. Detect YouTube Video / Shorts
    else if (rawUrl.includes('youtube.com') || rawUrl.includes('youtu.be')) {
      source = 'YouTube';
      let videoId = null;
      const vMatch = rawUrl.match(/(?:v=|\/v\/|embed\/|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (vMatch) videoId = vMatch[1];

      if (!videoId) return res.status(400).json({ error: 'Invalid YouTube link or video ID not found' });

      audioUrl = `https://www.youtube.com/watch?v=${videoId}`;
      cover = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

      // Try YouTube oEmbed first for clean title and author
      try {
        const ytOembed = await axios.get(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, { timeout: 5000 });
        const rawTitle = ytOembed.data?.title || '';
        const author = ytOembed.data?.author_name || '';

        // Clean common suffixes like (Official Music Video), (Lyric Video), [4K], etc.
        const cleanedTitle = rawTitle
          .replace(/\s*[\(\[]\s*(official\s*(music\s*)?video|official\s*audio|lyric\s*video|audio|lyrics|4k|hd|visualizer|remastered|hq)\s*[\)\]]/gi, '')
          .replace(/\s*-\s*official\s*(music\s*)?video/gi, '')
          .trim();

        if (cleanedTitle.includes(' - ')) {
          const parts = cleanedTitle.split(' - ');
          artist = parts[0].trim();
          title = parts.slice(1).join(' - ').trim();
        } else {
          title = cleanedTitle || rawTitle;
          artist = author.replace(/ - Topic$/i, '').trim() || 'YouTube Artist';
        }
      } catch (err) {
        console.warn('[Import Track] YouTube oembed failed:', err.message);
      }

      // Fetch high-res cover via iTunes if available
      if (title && artist) {
        const metaCover = await fetchTrackCover(title, artist);
        if (metaCover) cover = metaCover;
      }
      if (!title) {
        title = `YouTube Track (${videoId})`;
        artist = 'YouTube';
      }
    }
    // 3. Reject SoundCloud
    else if (rawUrl.includes('soundcloud.com')) {
      return res.status(400).json({ error: 'SoundCloud is not supported. Please use a YouTube or Spotify link.' });
    }
    // 4. Detect Apple Music Track
    else if (rawUrl.includes('music.apple.com')) {
      source = 'Apple Music';
      try {
        const appleRes = await axios.get(rawUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          timeout: 7000
        });
        const html = appleRes.data;
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
          const raw = titleMatch[1].replace(' on Apple Music', '').replace(' - Apple Music', '').trim();
          const parts = raw.split(' by ');
          if (parts.length >= 2) {
            title = parts[0].trim();
            artist = parts.slice(1).join(' by ').trim();
          } else {
            title = raw;
            artist = 'Apple Music';
          }
        }
        const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/);
        if (ogImage) cover = ogImage[1];
      } catch (err) {}

      if (title && artist) {
        const ytId = await searchYouTubeId(`${artist} - ${title}`);
        if (ytId) {
          audioUrl = `https://www.youtube.com/watch?v=${ytId}`;
          if (!cover) cover = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
        }
      }
    }
    // 5. Direct Audio File Link
    else if (/\.(mp3|m4a|wav|aac|ogg|flac)(\?.*)?$/i.test(rawUrl) || rawUrl.includes('stream') || rawUrl.includes('audio')) {
      source = 'Direct Audio';
      audioUrl = rawUrl;
      const cleanPath = rawUrl.split('?')[0];
      const filename = cleanPath.substring(cleanPath.lastIndexOf('/') + 1);
      const nameWithoutExt = decodeURIComponent(filename).replace(/\.[^/.]+$/, '');
      if (nameWithoutExt.includes(' - ')) {
        const parts = nameWithoutExt.split(' - ');
        artist = parts[0].trim();
        title = parts.slice(1).join(' - ').trim();
      } else {
        title = nameWithoutExt || 'Imported Audio';
        artist = 'Direct Stream';
      }
      cover = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600';
    } else {
      // General fallback: query searchYouTubeId
      source = 'Online';
      const ytId = await searchYouTubeId(rawUrl);
      if (ytId) {
        audioUrl = `https://www.youtube.com/watch?v=${ytId}`;
        cover = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
        title = rawUrl;
        artist = 'Online Track';
      } else {
        return res.status(400).json({ error: 'Unsupported link or could not resolve audio stream. Please provide a Spotify, YouTube, Apple Music, or direct audio link.' });
      }
    }

    if (!audioUrl && !title) {
      return res.status(400).json({ error: 'Failed to resolve audio for the provided link.' });
    }

    // Default fallbacks
    if (!cover) cover = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';
    if (!title) title = 'Imported Track';
    if (!artist) artist = 'Various Artists';

    // Save to MongoDB
    let trackId = `track-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    if (mongoose.connection.readyState === 1) {
      try {
        const newTrack = await new Track({
          title,
          artist,
          album,
          cover,
          audioUrl,
          duration,
          genre: 'Imported',
          source,
          addedBy: req.user?.id || 'guest',
        }).save();
        if (newTrack?._id) trackId = String(newTrack._id);
      } catch (dbErr) {
        console.warn('Track DB save error:', dbErr.message);
      }
    }

    const trackObj = {
      id: trackId,
      _id: trackId,
      title,
      artist,
      album,
      cover,
      audioUrl,
      duration,
      genre: 'Imported',
      source,
      addedBy: req.user?.id || 'guest',
      lyrics: [],
      liked: false
    };

    // If album detected, sync to system Album
    syncTrackToAlbum(trackObj).catch(() => {});

    res.json({
      success: true,
      track: trackObj
    });
  } catch (e) {
    console.error('[Import Track Error]:', e);
    res.status(500).json({ error: e.message || 'Server error while importing track' });
  }
});

// ──────────────────────────────────────────
// FULL SYNC & BATCH TRACKS ENDPOINTS

// ──────────────────────────────────────────
app.get('/api/sync', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password').lean();
    if (!user) return res.status(404).json({ error: 'User not found' });

    const allTracks = await Track.find({
      source: { $ne: 'SoundCloud' },
      album: { $ne: 'SoundCloud' },
      audioUrl: { $not: /soundcloud\.com|sndcdn\.com/i }
    }).sort({ createdAt: -1 }).limit(3000).lean();
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
      isQuran: Boolean(t.isQuran || isQuranContent(t.title, t.artist, t.album, t.genre)),
      addedBy: t.addedBy,
      lyrics: t.lyrics || [],
      color: t.color || '#1DB954',
      liked: (user.likedTrackIds || []).includes(String(t._id)),
    }));

    let userPlaylists = user.playlists || [];
    if (!userPlaylists.some(p => p.isLikedSongs || p.id === 'liked' || p.name === 'Liked Songs')) {
      userPlaylists = [
        { id: 'liked', name: 'Liked Songs', trackIds: (user.likedTrackIds || []).map(String), isLikedSongs: true, isPublic: false },
        ...userPlaylists
      ];
    }

    res.json({
      success: true,
      user,
      tracks: formatted,
      playlists: userPlaylists.map(p => ({
        ...p,
        isQuran: Boolean(p.isQuran || isQuranContent(p.name, '', '', '', p.description))
      })),
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
    const tracks = await Track.find({
      _id: { $in: ids },
      source: { $ne: 'SoundCloud' },
      album: { $ne: 'SoundCloud' },
      audioUrl: { $not: /soundcloud\.com|sndcdn\.com/i }
    }).lean();

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
      source: t.source || 'YouTube',
      isQuran: Boolean(t.isQuran),
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
      isPublic: req.body.isPublic !== false,
      isQuran: Boolean(req.body.isQuran)
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
    let u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ error: 'User not found' });
    let pl = u.playlists.find(p => String(p.id || p._id) === String(req.params.id));
    if (!pl && isAdminUser(req.user)) {
      u = await User.findOne({ $or: [{ 'playlists.id': req.params.id }, { 'playlists._id': req.params.id }] });
      if (u) {
        pl = u.playlists.find(p => String(p.id || p._id) === String(req.params.id));
      }
    }
    if (!pl) return res.status(403).json({ error: 'You do not own this playlist' });
    const trackIdStr = String(req.body.trackId);
    if (req.body.allowDuplicate || !pl.trackIds.map(String).includes(trackIdStr)) {
      pl.trackIds.push(trackIdStr);
    }
    await u.save();
    res.json({ success: true, trackIds: pl.trackIds });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Remove track from playlist (Strictly restricted to playlist owner or admin)
const removeTrackFromPlaylistHandler = async (req, res) => {
  try {
    if (!req.user || !req.user.id) return res.status(401).json({ error: 'Unauthorized' });
    const playlistId = String(req.params.id || '');
    const trackIdStr = String(req.body.trackId || req.params.trackId || '');
    if (!trackIdStr) return res.status(400).json({ error: 'trackId required' });

    let u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ error: 'User not found' });

    let pl = u.playlists.find(p => String(p.id || p._id) === playlistId);
    if (!pl && isAdminUser(req.user)) {
      u = await User.findOne({ $or: [{ 'playlists.id': playlistId }, { 'playlists._id': playlistId }] });
      if (u) {
        pl = u.playlists.find(p => String(p.id || p._id) === playlistId);
      }
    }
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
    let u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ success: false, error: 'User not found' });
    let pl = u.playlists.find(p => String(p.id || p._id) === String(req.params.id));
    if (!pl && isAdminUser(req.user)) {
      u = await User.findOne({ $or: [{ 'playlists.id': req.params.id }, { 'playlists._id': req.params.id }] });
      if (u) {
        pl = u.playlists.find(p => String(p.id || p._id) === String(req.params.id));
      }
    }
    if (!pl) return res.status(403).json({ success: false, error: 'You do not own this playlist' });
    if (req.body.name) pl.name = req.body.name;
    if (req.body.description !== undefined) pl.description = req.body.description;
    if (req.body.cover) pl.cover = req.body.cover;
    if (req.body.isPublic !== undefined) pl.isPublic = Boolean(req.body.isPublic);
    await u.save();
    res.json({ success: true, isPublic: pl.isPublic, playlist: pl });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/playlists/:id/toggle-visibility', auth, async (req, res) => {
  try {
    let u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ success: false, error: 'User not found' });
    let pl = u.playlists.find(p => String(p.id || p._id) === String(req.params.id));
    if (!pl && isAdminUser(req.user)) {
      u = await User.findOne({ $or: [{ 'playlists.id': req.params.id }, { 'playlists._id': req.params.id }] });
      if (u) {
        pl = u.playlists.find(p => String(p.id || p._id) === String(req.params.id));
      }
    }
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
    const targetId = String(req.params.id);
    let u = await User.findById(req.user.id);
    if (!u) return res.status(404).json({ error: 'User not found' });
    const initialLen = u.playlists.length;
    u.playlists = u.playlists.filter(p => String(p.id) !== targetId && String(p._id) !== targetId);
    if (u.playlists.length === initialLen) {
      if (isAdminUser(req.user)) {
        const owner = await User.findOne({ $or: [{ 'playlists.id': targetId }, { 'playlists._id': targetId }] });
        if (owner) {
          owner.playlists = owner.playlists.filter(p => String(p.id) !== targetId && String(p._id) !== targetId);
          owner.markModified('playlists');
          await owner.save();
          return res.json({ success: true });
        }
      }
      return res.status(403).json({ error: 'Playlist not found or not owned by you' });
    }
    u.markModified('playlists');
    await u.save();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Save another user's public playlist into current user's library
app.post('/api/playlists/:id/save', auth, async (req, res) => {
  try {
    const targetId = String(req.params.id);
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    // Look up playlist across users
    let sourceOwner = await User.findOne({
      $or: [{ 'playlists.id': targetId }, { 'playlists._id': targetId }]
    }).select('_id name avatar playlists').lean();

    let sourcePlaylist = sourceOwner?.playlists?.find(p => String(p.id || p._id) === targetId);

    // Fallback: look up in Album collection if applicable
    if (!sourcePlaylist) {
      const album = await Album.findOne({ $or: [{ id: targetId }, { _id: targetId }] }).lean();
      if (album) {
        sourcePlaylist = {
          id: album.id,
          name: album.title,
          cover: album.cover || '',
          description: album.description || '',
          trackIds: album.trackIds || [],
          isPublic: true
        };
      }
    }

    // Fallback: client provided playlist payload
    if (!sourcePlaylist && req.body?.playlist) {
      sourcePlaylist = req.body.playlist;
    }

    if (!sourcePlaylist) {
      return res.status(404).json({ error: 'Playlist not found' });
    }

    if (sourcePlaylist.isPublic === false && String(sourceOwner?._id) !== String(currentUser._id)) {
      return res.status(403).json({ error: 'Cannot save a private playlist' });
    }

    // Check if already in user's playlists
    const existingIndex = (currentUser.playlists || []).findIndex(p =>
      String(p.sourcePlaylistId) === targetId ||
      String(p.id) === targetId
    );

    if (existingIndex >= 0) {
      return res.json({
        success: true,
        alreadySaved: true,
        playlist: currentUser.playlists[existingIndex],
        playlists: currentUser.playlists
      });
    }

    const newId = `pl-saved-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const savedPlaylist = {
      id: newId,
      _id: newId,
      name: sourcePlaylist.name,
      cover: sourcePlaylist.cover || '',
      description: sourcePlaylist.description || (sourceOwner?.name ? `Saved from ${sourceOwner.name}` : 'Saved playlist'),
      trackIds: [...(sourcePlaylist.trackIds || [])],
      isPublic: false,
      isLikedSongs: false,
      isQuran: Boolean(sourcePlaylist.isQuran),
      sourcePlaylistId: targetId,
      sourceOwnerName: sourceOwner?.name || '',
      sourceOwnerId: sourceOwner?._id ? String(sourceOwner._id) : '',
      createdAt: new Date()
    };

    currentUser.playlists.push(savedPlaylist);
    currentUser.markModified('playlists');
    await currentUser.save();

    res.json({
      success: true,
      playlist: savedPlaylist,
      playlists: currentUser.playlists
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Unsave / remove a saved playlist from user's library
app.post('/api/playlists/:id/unsave', auth, async (req, res) => {
  try {
    const targetId = String(req.params.id);
    const currentUser = await User.findById(req.user.id);
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    const initialLen = currentUser.playlists.length;
    currentUser.playlists = currentUser.playlists.filter(p =>
      String(p.sourcePlaylistId) !== targetId &&
      String(p.id) !== targetId &&
      String(p._id) !== targetId
    );
    currentUser.markModified('playlists');
    await currentUser.save();

    res.json({
      success: true,
      removed: currentUser.playlists.length < initialLen,
      playlists: currentUser.playlists
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ──────────────────────────────────────────
// ALBUMS & ARTISTS (WEBSITE-WIDE DISCOGRAPHY)
// ──────────────────────────────────────────
app.get('/api/albums', async (req, res) => {
  try {
    const albums = await Album.find().sort({ updatedAt: -1 }).lean();
    res.json({ success: true, albums });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Admin / User: Album Metadata Auto-Lookup (iTunes API & Link Scraper)
// Grabs high-res 1200x1200 cover, release year, genre, and tracklist automatically!
app.get('/api/albums/lookup', async (req, res) => {
  try {
    const { query, url } = req.query;
    if (!query && !url) {
      return res.status(400).json({ success: false, error: 'Query or URL is required' });
    }

    // 1. If Spotify or YouTube URL provided, use scrapePlaylistOrAlbum
    if (url && (url.includes('spotify.com') || url.includes('youtube.com') || url.includes('youtu.be') || url.includes('music.apple.com'))) {
      const scraped = await scrapePlaylistOrAlbum(url.trim());
      return res.json({
        success: true,
        name: scraped.title,
        artist: scraped.artist,
        cover: scraped.cover,
        releaseDate: scraped.releaseDate || new Date().getFullYear().toString(),
        genre: scraped.genre || 'Pop',
        tracks: (scraped.items || []).map(t => ({
          title: t.title,
          artist: t.artist || scraped.artist,
          duration: t.duration || 180,
          cover: t.cover || scraped.cover
        }))
      });
    }

    // 2. Search via Apple iTunes Search API (no API key needed, high reliability)
    const searchTerm = (query || '').trim();
    const itunesRes = await axios.get('https://itunes.apple.com/search', {
      params: {
        term: searchTerm,
        entity: 'album',
        limit: 5
      },
      timeout: 10000
    });

    const albumResult = itunesRes.data?.results?.[0];
    if (!albumResult) {
      return res.status(404).json({ success: false, error: 'No album metadata found for this search' });
    }

    // High resolution cover (replace 100x100 with 1200x1200)
    let highResCover = albumResult.artworkUrl100 || '';
    if (highResCover) {
      highResCover = highResCover.replace(/\/\d+x\d+bb\./, '/1200x1200bb.');
    }

    // Extract release year
    const releaseYear = albumResult.releaseDate ? new Date(albumResult.releaseDate).getFullYear().toString() : new Date().getFullYear().toString();

    // Look up tracks for this album
    let tracks = [];
    try {
      const lookupRes = await axios.get('https://itunes.apple.com/lookup', {
        params: {
          id: albumResult.collectionId,
          entity: 'song'
        },
        timeout: 10000
      });
      const results = lookupRes.data?.results || [];
      // First result is collection, subsequent results are songs
      tracks = results.filter(r => r.wrapperType === 'track').map(r => ({
        title: r.trackName,
        artist: r.artistName || albumResult.artistName,
        duration: Math.round((r.trackTimeMillis || 180000) / 1000),
        trackNumber: r.trackNumber,
        cover: highResCover
      }));
    } catch (lookupErr) {
      console.warn('iTunes album track lookup notice:', lookupErr.message);
    }

    return res.json({
      success: true,
      name: albumResult.collectionName,
      artist: albumResult.artistName,
      cover: highResCover,
      releaseDate: releaseYear,
      genre: albumResult.primaryGenreName || 'Pop',
      trackCount: albumResult.trackCount,
      tracks
    });
  } catch (err) {
    console.error('Album lookup error:', err);
    res.status(500).json({ success: false, error: err.message || 'Album lookup failed' });
  }
});

app.get('/api/albums/:id', async (req, res) => {
  try {
    const album = await Album.findOne({ $or: [{ id: req.params.id }, { _id: req.params.id }] }).lean();
    if (!album) return res.status(404).json({ success: false, error: 'Album not found' });
    const tracks = await Track.find({ _id: { $in: album.trackIds } }).lean();
    const formattedTracks = tracks.map(t => ({
      id: String(t._id),
      _id: String(t._id),
      ...t
    }));
    res.json({ success: true, album, tracks: formattedTracks });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Admin: Create / Upload Album
const createAlbumHandler = async (req, res) => {
  try {
    const { name, artist, cover, releaseDate, genre, trackIds = [], isQuran = false, description = '' } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Album name is required' });
    }
    if (!artist || !artist.trim()) {
      return res.status(400).json({ success: false, error: 'Artist name is required' });
    }

    const cleanName = name.trim();
    const cleanArtist = artist.trim();
    const cleanTrackIds = Array.isArray(trackIds) ? trackIds.map(String) : [];

    const newAlbum = new Album({
      id: `album-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: cleanName,
      artist: cleanArtist,
      cover: cover ? cover.trim() : 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
      trackIds: cleanTrackIds,
      releaseDate: releaseDate ? releaseDate.trim() : '',
      genre: genre ? genre.trim() : 'Pop',
      isAlbum: true,
      isSystem: true,
      isPublic: true,
      isQuran: Boolean(isQuran),
      description: description ? description.trim() : '',
      source: 'admin_upload',
      createdBy: req.user?.id || req.user?.name || 'admin'
    });

    await newAlbum.save();

    // If trackIds are provided, assign those tracks to this album
    if (cleanTrackIds.length > 0) {
      await Track.updateMany(
        { _id: { $in: cleanTrackIds } },
        { $set: { album: cleanName } }
      ).catch(() => {});
    }

    io.emit('album:created', newAlbum);
    res.json({ success: true, album: newAlbum });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};
app.post('/api/albums', adminAuth, createAlbumHandler);
app.post('/api/albums/create', adminAuth, createAlbumHandler);

// Admin: Import Album from YouTube / Spotify Link
const importAlbumHandler = async (req, res) => {
  try {
    const { url, name, artist, cover, releaseDate, genre, isQuran, description } = req.body;
    if (!url || !url.trim()) {
      return res.status(400).json({ success: false, error: 'A valid Spotify album or YouTube playlist link is required' });
    }

    const cleanUrl = url.trim();
    let scraped;
    try {
      scraped = await scrapePlaylistOrAlbum(cleanUrl);
    } catch (err) {
      return res.status(400).json({ success: false, error: err.message || 'Failed to scrape album link' });
    }

    if (!scraped || !scraped.items || scraped.items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Could not extract tracks from the provided link. Please ensure it is a public Spotify album or YouTube playlist.' 
      });
    }

    const albumName = (name && name.trim()) || scraped.title || 'Imported Album';
    const albumArtist = (artist && artist.trim()) || scraped.artist || 'Unknown Artist';
    const albumCover = (cover && cover.trim()) || scraped.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';
    const finalIsQuran = Boolean(
      isQuran !== undefined 
        ? isQuran 
        : isQuranContent(albumName, albumArtist, '', '') || scraped.items.every(t => isQuranContent(t.title, t.artist || albumArtist))
    );
    const detectedAlbumReciter = finalIsQuran ? detectQuranReciter(albumName, albumArtist, '', '') : null;

    const trackIds = [];
    const createdTracks = [];

    const tracksToInsert = [];
    for (const item of scraped.items) {
      try {
        const duration = item.duration || 180;
        const ytId = item.videoId || (item.audioUrl ? null : await searchYouTubeId(`${item.artist || albumArtist} - ${item.title}`));
        let trackCover = item.cover || (item.videoId ? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg` : null);
        if (!trackCover && !item.videoId) trackCover = await fetchTrackCover(item.title, item.artist || albumArtist);
        if (!trackCover && ytId) trackCover = `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`;
        if (!trackCover) trackCover = albumCover;

        const audioUrl = item.audioUrl || (ytId ? `https://www.youtube.com/watch?v=${ytId}` : '');
        let trackArtist = (item.artist && item.artist !== 'Artist') ? item.artist : albumArtist;
        const itemIsQuran = Boolean(finalIsQuran || isQuranContent(item.title, trackArtist, albumName, ''));
        if (itemIsQuran) {
          const itemReciter = detectQuranReciter(item.title, trackArtist, albumName) || detectedAlbumReciter;
          if (itemReciter) {
            trackArtist = itemReciter;
          }
        }

        tracksToInsert.push({
          title: item.title,
          artist: trackArtist,
          album: albumName,
          cover: trackCover,
          audioUrl,
          duration,
          genre: itemIsQuran ? 'Quran' : (genre ? genre.trim() : 'Pop'),
          source: item.videoId ? 'YouTube' : 'Spotify',
          isQuran: itemIsQuran
        });
      } catch (itemErr) {
        console.warn('Track import item error:', itemErr.message);
      }
    }

    if (mongoose.connection.readyState === 1 && tracksToInsert.length > 0) {
      try {
        const inserted = await Track.insertMany(tracksToInsert, { ordered: false });
        for (const t of inserted) {
          const tid = String(t._id);
          trackIds.push(tid);
          createdTracks.push({
            id: tid,
            _id: tid,
            title: t.title,
            artist: t.artist,
            album: t.album,
            cover: t.cover,
            audioUrl: t.audioUrl,
            duration: t.duration,
            genre: t.genre,
            source: t.source,
            isQuran: t.isQuran
          });
        }
      } catch (insertErr) {
        if (insertErr.insertedDocs && insertErr.insertedDocs.length > 0) {
          for (const t of insertErr.insertedDocs) {
            const tid = String(t._id);
            trackIds.push(tid);
            createdTracks.push({
              id: tid,
              _id: tid,
              title: t.title,
              artist: t.artist,
              album: t.album,
              cover: t.cover,
              audioUrl: t.audioUrl,
              duration: t.duration,
              genre: t.genre,
              source: t.source,
              isQuran: t.isQuran
            });
          }
        }
      }
    }

    if (createdTracks.length === 0) {
      for (const t of tracksToInsert) {
        const tid = `track-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        trackIds.push(tid);
        createdTracks.push({ id: tid, _id: tid, ...t });
      }
    }

    const newAlbum = new Album({
      id: `album-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name: albumName,
      artist: albumArtist,
      cover: albumCover,
      trackIds: trackIds,
      releaseDate: releaseDate ? releaseDate.trim() : new Date().getFullYear().toString(),
      genre: finalIsQuran ? 'Quran' : (genre ? genre.trim() : 'Pop'),
      isAlbum: true,
      isSystem: true,
      isPublic: true,
      isQuran: finalIsQuran,
      description: description ? description.trim() : '',
      source: 'link_import',
      createdBy: req.user?.id || req.user?.name || 'admin'
    });

    await newAlbum.save();

    io.emit('album:created', newAlbum);
    res.json({
      success: true,
      album: newAlbum,
      tracks: createdTracks
    });
  } catch (e) {
    console.error('Import album error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
};
app.post('/api/albums/import', adminAuth, importAlbumHandler);

// Admin: Edit / Update Album Details
const updateAlbumHandler = async (req, res) => {
  try {
    const albumId = req.params.id;
    const { name, artist, cover, releaseDate, genre, trackIds } = req.body;
    const album = await Album.findOne({ $or: [{ id: albumId }, { _id: mongoose.isValidObjectId(albumId) ? albumId : null }] });
    if (!album) return res.status(404).json({ success: false, error: 'Album not found' });

    const oldName = album.name;
    if (name) album.name = name.trim();
    if (artist) album.artist = artist.trim();
    if (cover !== undefined) album.cover = cover.trim();
    if (releaseDate !== undefined) album.releaseDate = releaseDate;
    if (genre !== undefined) album.genre = genre;
    if (Array.isArray(trackIds)) album.trackIds = trackIds;

    await album.save();

    // If album name changed, update tracks that belong to this album
    if (name && oldName && name.trim().toLowerCase() !== oldName.trim().toLowerCase()) {
      const escapeRegex = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
      await Track.updateMany(
        { album: { $regex: new RegExp(`^${escapeRegex(oldName)}$`, 'i') } },
        { $set: { album: name.trim() } }
      ).catch(() => {});
    }

    io.emit('album:updated', album);
    res.json({ success: true, album });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};
app.put('/api/albums/:id', adminAuth, updateAlbumHandler);
app.post('/api/albums/:id/update', adminAuth, updateAlbumHandler);

// Admin: Delete Album
const deleteAlbumHandler = async (req, res) => {
  try {
    const albumId = req.params.id;
    const deleteTracks = req.body?.deleteTracks !== false; // default true

    const escapeRegex = (s) => String(s || '').replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

    // 1. Find album by id, _id, or decode if safe-id or name
    let album = await Album.findOne({
      $or: [
        { id: albumId },
        ...(mongoose.isValidObjectId(albumId) ? [{ _id: albumId }] : [])
      ]
    });

    let albumName = album?.name;
    let albumArtist = album?.artist;
    let trackIds = album?.trackIds ? [...album.trackIds] : [];

    if (!album) {
      const decoded = decodeURIComponent(albumId);
      const candidateName = albumId.startsWith('album-')
        ? decodeURIComponent(albumId.replace(/^album-/, '').replace(/-/g, ' '))
        : decoded;

      album = await Album.findOne({
        $or: [
          { name: { $regex: new RegExp(`^${escapeRegex(candidateName)}$`, 'i') } },
          { name: { $regex: new RegExp(`^${escapeRegex(decoded)}$`, 'i') } }
        ]
      });
      if (album) {
        albumName = album.name;
        albumArtist = album.artist;
        trackIds = album.trackIds ? [...album.trackIds] : [];
      } else {
        albumName = candidateName;
      }
    }

    // 2. Build comprehensive filter for ALL matching album documents (including duplicates)
    const albumDeleteFilter = {
      $or: [
        { id: albumId },
        ...(mongoose.isValidObjectId(albumId) ? [{ _id: albumId }] : []),
        ...(album?._id ? [{ _id: album._id }] : []),
        ...(albumName ? [{ name: { $regex: new RegExp(`^${escapeRegex(albumName)}$`, 'i') } }] : [])
      ]
    };

    // Collect trackIds from all matching album documents
    const matchingAlbums = await Album.find(albumDeleteFilter).lean();
    for (const a of matchingAlbums) {
      if (Array.isArray(a.trackIds)) {
        trackIds.push(...a.trackIds);
      }
    }
    trackIds = Array.from(new Set(trackIds.map(String)));

    // 3. Locate all associated tracks
    const trackQueries = [];
    if (trackIds.length > 0) {
      trackQueries.push({ _id: { $in: trackIds } });
    }
    if (albumName) {
      trackQueries.push({
        album: { $regex: new RegExp(`^${escapeRegex(albumName)}$`, 'i') }
      });
    }

    let deletedTrackIds = [];
    if (trackQueries.length > 0) {
      const associatedTracks = await Track.find({ $or: trackQueries }).lean();
      deletedTrackIds = associatedTracks.map(t => String(t._id || t.id));

      if (deleteTracks) {
        if (deletedTrackIds.length > 0) {
          await Track.deleteMany({ _id: { $in: deletedTrackIds } });

          // Clean up from all users' likedTrackIds and playlists
          const users = await User.find({
            $or: [
              { likedTrackIds: { $in: deletedTrackIds } },
              { 'playlists.trackIds': { $in: deletedTrackIds } }
            ]
          });

          for (const u of users) {
            let changed = false;
            if (u.likedTrackIds && u.likedTrackIds.length > 0) {
              const prevLen = u.likedTrackIds.length;
              u.likedTrackIds = u.likedTrackIds.filter(id => !deletedTrackIds.includes(String(id)));
              if (u.likedTrackIds.length !== prevLen) changed = true;
            }
            if (u.playlists && u.playlists.length > 0) {
              for (const pl of u.playlists) {
                if (pl.trackIds && pl.trackIds.length > 0) {
                  const prevLen = pl.trackIds.length;
                  pl.trackIds = pl.trackIds.filter(id => !deletedTrackIds.includes(String(id)));
                  if (pl.trackIds.length !== prevLen) changed = true;
                }
              }
            }
            if (changed) {
              await u.save();
            }
          }

          deletedTrackIds.forEach(tId => {
            io.emit('track:deleted', { id: tId });
          });
        }
      } else {
        // Disassociate tracks
        if (deletedTrackIds.length > 0) {
          await Track.updateMany(
            { _id: { $in: deletedTrackIds } },
            { $set: { album: '' } }
          );
        }
      }
    }

    // 4. Delete ALL matching Album documents in MongoDB
    await Album.deleteMany(albumDeleteFilter);

    io.emit('album:deleted', { id: albumId, albumName, deletedTrackIds });
    res.json({ success: true, deletedTrackIds, albumName });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};
app.delete('/api/albums/:id', adminAuth, deleteAlbumHandler);
app.post('/api/albums/:id/delete', adminAuth, deleteAlbumHandler);

// Admin: Get all playlists across website
app.get('/api/admin/playlists', adminAuth, async (req, res) => {
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

// Admin: Get all albums across website
app.get('/api/admin/albums', adminAuth, async (req, res) => {
  try {
    const albums = await Album.find().sort({ updatedAt: -1 }).lean();
    res.json({ success: true, albums });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/artists', async (req, res) => {
  try {
    const allTracks = await Track.find({}, 'artist album cover plays').lean();
    const allAlbums = await Album.find().lean();

    const artistMap = {};
    for (const t of allTracks) {
      if (!t.artist) continue;
      const canonical = getCanonicalArtistName(t.artist);
      const key = canonical.toLowerCase();
      if (!artistMap[key]) {
        artistMap[key] = {
          id: key,
          name: canonical,
          avatar: t.cover,
          trackCount: 0,
          albumCount: 0,
          totalPlays: 0,
          albums: []
        };
      }
      artistMap[key].trackCount++;
      artistMap[key].totalPlays += (Number(t.plays) || 0);
      if (!artistMap[key].avatar && t.cover) artistMap[key].avatar = t.cover;
    }

    for (const a of allAlbums) {
      if (!a.artist) continue;
      const canonical = getCanonicalArtistName(a.artist);
      const key = canonical.toLowerCase();
      if (artistMap[key]) {
        artistMap[key].albumCount++;
        artistMap[key].albums.push(a);
      }
    }

    const artists = Object.values(artistMap).sort((a, b) => b.trackCount - a.trackCount);
    res.json({ success: true, artists });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/artists/:name', async (req, res) => {
  try {
    const rawName = decodeURIComponent(req.params.name).trim();
    const canonicalName = getCanonicalArtistName(rawName);
    const aliases = getArtistAliases(rawName);
    const allNames = Array.from(new Set([rawName, canonicalName, ...aliases]));
    const escapeRegex = (s) => s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
    const pattern = allNames.map(escapeRegex).join('|');
    const regex = new RegExp(`^(?:${pattern})$`, 'i');

    const [tracks, albums, artistDoc] = await Promise.all([
      Track.find({ artist: { $regex: regex } }).sort({ plays: -1 }).lean(),
      Album.find({ artist: { $regex: regex } }).sort({ createdAt: -1 }).lean(),
      Artist.findOne({ name: { $regex: regex } }).lean()
    ]);

    const formattedTracks = tracks.map(t => ({
      id: String(t._id),
      _id: String(t._id),
      ...t
    }));

    const artistData = {
      id: canonicalName.toLowerCase().replace(/[^a-z0-9_-]/g, '-'),
      name: artistDoc?.name || canonicalName,
      avatar: artistDoc?.cover || artistDoc?.avatar || tracks[0]?.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
      cover: artistDoc?.cover || tracks[0]?.cover || '',
      banner: artistDoc?.banner || '',
      bio: artistDoc?.bio || '',
      isVerified: Boolean(artistDoc?.isVerified),
      aliases,
      trackCount: tracks.length,
      albumCount: albums.length,
      totalPlays: tracks.reduce((sum, t) => sum + (Number(t.plays) || 0), 0),
      tracks: formattedTracks,
      albums
    };

    res.json({ success: true, artist: artistData });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ──────────────────────────────────────────
// TRACKS CRUD
// ──────────────────────────────────────────
app.get('/api/tracks', async (req, res) => {
  try {
    const raw = await Track.find({
      source: { $ne: 'SoundCloud' },
      album: { $ne: 'SoundCloud' },
      audioUrl: { $not: /soundcloud\.com|sndcdn\.com/i }
    }, { lyrics: 0 }).sort({ createdAt: -1 }).limit(1000).lean();
    const tracks = raw.map(t => ({
      ...t,
      id: String(t._id),
      isQuran: Boolean(t.isQuran || isQuranContent(t.title, t.artist, t.album, t.genre))
    }));
    res.json({ success: true, tracks });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

const ALLOWED_AUDIO_EXTS = ['.mp3', '.m4a', '.wav', '.ogg', '.flac', '.aac'];
const ALLOWED_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (file.fieldname === 'audio') {
    if (ALLOWED_AUDIO_EXTS.includes(ext)) {
      return cb(null, true);
    }
    return cb(new Error('Invalid audio file type. Allowed: MP3, M4A, WAV, OGG, FLAC, AAC'), false);
  }
  if (file.fieldname === 'cover') {
    // Strictly block HTML, SVG, scripts or executables to eliminate Stored XSS
    if (ALLOWED_IMAGE_EXTS.includes(ext)) {
      return cb(null, true);
    }
    return cb(new Error('Invalid image file type. Allowed: JPG, PNG, WEBP (SVG and HTML are disallowed)'), false);
  }
  return cb(new Error('Unexpected file upload field'), false);
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${baseName}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter
});

app.post('/api/tracks/upload', auth, upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'cover', maxCount: 1 }]), async (req, res) => {
  try {
    const { title, artist, album, genre, lyrics } = req.body;
    if (!title || !artist) return res.status(400).json({ error: 'Title and artist are required' });

    let audioUrl = '';
    if (req.files?.audio?.[0]) {
      audioUrl = `/uploads/${req.files.audio[0].filename}`;
    }

    let coverUrl = '';
    if (req.files?.cover?.[0]) {
      coverUrl = `/uploads/${req.files.cover[0].filename}`;
    } else {
      coverUrl = await fetchTrackCover(title, artist) || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';
    }

    let parsedLyrics = [];
    if (lyrics) {
      try { parsedLyrics = typeof lyrics === 'string' ? JSON.parse(lyrics) : lyrics; } catch {}
    }

    const newTrack = await new Track({
      title: title.trim(),
      artist: artist.trim(),
      album: (album || '').trim() || 'Single',
      cover: coverUrl,
      audioUrl,
      duration: 210,
      genre: genre || 'Pop',
      source: 'Upload',
      addedBy: req.user ? req.user.id : 'user',
      lyrics: parsedLyrics
    }).save();

    // Auto-detect and sync to website album
    await syncTrackToAlbum(newTrack);

    res.json({ success: true, track: newTrack });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const createTrackHandler = async (req, res) => {
  try {
    const newTrack = await new Track({
      ...req.body,
      addedBy: req.user ? req.user.id : 'user'
    }).save();

    // Auto-detect and sync to website album
    await syncTrackToAlbum(newTrack);

    res.json({ success: true, track: newTrack });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
app.post(['/api/tracks', '/api/tracks/create', '/api/tracks/add'], optionalAuth, createTrackHandler);

// Delete track permanently from database & remove from all playlists & likes (Admin Only)
const deleteTrackHandler = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Permission denied. Only administrators can delete songs from the website.' });
    }

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
app.delete('/api/tracks/:id', adminAuth, deleteTrackHandler);
app.post('/api/tracks/:id/delete', adminAuth, deleteTrackHandler);
app.post('/api/tracks/delete', adminAuth, deleteTrackHandler);

// Edit / Update track details (Admin Only)
const updateTrackHandler = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ error: 'Permission denied. Only administrators can edit songs.' });
    }
    const trackId = String(req.params.id || req.body.id || req.body._id || '');
    if (!trackId) return res.status(400).json({ error: 'Track ID required' });

    const track = await Track.findOne({ $or: [{ _id: mongoose.isValidObjectId(trackId) ? trackId : null }, { id: trackId }] });
    if (!track) return res.status(404).json({ error: 'Track not found' });

    const { title, artist, album, cover, audioUrl, duration, genre, lyrics } = req.body;
    if (title) track.title = title.trim();
    if (artist) track.artist = artist.trim();
    if (album !== undefined) track.album = album.trim();
    if (cover) track.cover = cover.trim();
    if (audioUrl) track.audioUrl = audioUrl.trim();
    if (duration !== undefined) track.duration = Number(duration) || track.duration;
    if (genre !== undefined) track.genre = genre;
    if (Array.isArray(lyrics)) track.lyrics = lyrics;

    await track.save();

    // If lyrics provided, also sync into universal SongLyrics collection
    if (Array.isArray(lyrics) && lyrics.length > 0) {
      const trackKey = getTrackKey(track.title, track.artist);
      if (trackKey && trackKey !== '___') {
        await SongLyrics.findOneAndUpdate(
          { trackKey },
          {
            $set: {
              trackKey,
              trackId: String(track._id),
              title: track.title,
              artist: track.artist,
              lyrics,
              updatedBy: req.user.name || 'Admin',
              isVerified: true,
              verifiedBy: req.user.name || 'Admin',
              verifiedAt: new Date()
            }
          },
          { upsert: true, new: true }
        ).catch(() => {});
      }
    }

    // Auto-sync with album
    await syncTrackToAlbum(track);

    const formatted = {
      ...track.toObject(),
      id: String(track._id)
    };

    io.emit('track:updated', formatted);
    res.json({ success: true, track: formatted });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
app.put('/api/tracks/:id', adminAuth, updateTrackHandler);
app.post('/api/tracks/:id/update', adminAuth, updateTrackHandler);
app.post('/api/tracks/update', adminAuth, updateTrackHandler);

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
    const likedPl = (u.playlists || []).find(p => p.isLikedSongs || p.name === 'Liked Songs' || p.id === 'liked');
    if (likedPl) {
      likedPl.trackIds = [...u.likedTrackIds];
    } else {
      u.playlists = [
        { id: 'liked', name: 'Liked Songs', trackIds: [...u.likedTrackIds], isLikedSongs: true, isPublic: false },
        ...(u.playlists || [])
      ];
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
        headers: { 'User-Agent': 'RivoApp/1.0 (https://github.com/mohamedLIOT1/liofy)' },
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

// ──────────────────────────────────────────
// Official YouTube Audio Stream Resolver & Stream Proxy (Multi-Tier, NO SoundCloud)
// ──────────────────────────────────────────

async function resolveOfficialYouTubeAudioStream(rawUrl, title = '', artist = '') {
  let videoId = null;
  const candidates = [rawUrl];
  for (const cand of candidates) {
    if (!cand || typeof cand !== 'string') continue;
    const m1 = cand.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
    if (m1 && m1[1]) { videoId = m1[1]; break; }
    const m2 = cand.match(/^yt[-_]?([a-zA-Z0-9_-]{11})$/i);
    if (m2 && m2[1]) { videoId = m2[1]; break; }
    if (/^[a-zA-Z0-9_-]{11}$/.test(cand.trim()) && !mongoose.isValidObjectId(cand.trim())) {
      videoId = cand.trim();
      break;
    }
  }
  if (!videoId && (title || artist)) {
    try {
      videoId = await searchYouTubeId(`${artist || ''} ${title || ''}`.trim());
    } catch {}
  }
  if (!videoId && rawUrl) {
    const rawMatch = rawUrl.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
    if (rawMatch && rawMatch[1]) videoId = rawMatch[1];
  }
  if (!videoId) return null;

  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Tier 1: Direct VisionOS / Apple Innertube API Audio Stream Extraction
  try {
    const key = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
    let visitorData = '';

    // Fast official visitor_id token acquisition (immune to datacenter scraping blocks)
    try {
      const vRes = await axios.post(`https://www.youtube.com/youtubei/v1/visitor_id?key=${key}`, {
        context: {
          client: {
            clientName: 'VISIONOS',
            clientVersion: '1.02',
            deviceMake: 'Apple',
            deviceModel: 'RealityDevice17,1',
            osName: 'visionOS',
            osVersion: '26.5.23O471',
            hl: 'en',
            gl: 'US',
          }
        }
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 3000
      });
      visitorData = vRes.data?.responseContext?.visitorData || '';
    } catch (e) {}

    // Fallback: scrape watch page if visitor_id endpoint did not return a token
    if (!visitorData) {
      try {
        const webRes = await axios.get(`https://www.youtube.com/watch?v=${videoId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          timeout: 4000,
        });
        const html = typeof webRes.data === 'string' ? webRes.data : '';
        const visitorMatch = html.match(/"VISITOR_DATA":"([^"]+)"/);
        if (visitorMatch && visitorMatch[1]) visitorData = visitorMatch[1];
      } catch (e) {}
    }

    const playerBody = {
      context: {
        client: {
          clientName: 'VISIONOS',
          clientVersion: '1.02',
          deviceMake: 'Apple',
          deviceModel: 'RealityDevice17,1',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
          osName: 'visionOS',
          osVersion: '26.5.23O471',
          hl: 'en',
          gl: 'US',
          visitorData: visitorData || undefined,
        },
      },
      videoId: videoId,
    };

    const playerHeaders = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
    };

    const playerRes = await axios.post(`https://www.youtube.com/youtubei/v1/player?key=${key}&prettyPrint=false`, playerBody, {
      headers: playerHeaders,
      timeout: 6000,
    });

    if (playerRes.data?.playabilityStatus?.status === 'OK') {
      const formats = (playerRes.data.streamingData?.adaptiveFormats || []).concat(playerRes.data.streamingData?.formats || []);
      const audio140 = formats.find(f => f.itag === 140 && f.url);
      const anyAudio = formats.find(f => f.mimeType?.startsWith('audio') && f.url);
      const chosen = audio140 || anyAudio;
      if (chosen?.url) {
        const rawSec = parseInt(playerRes.data.videoDetails?.lengthSeconds, 10);
        const rawMs = parseInt(chosen.approxDurationMs, 10);
        const durationSec = (rawSec && !isNaN(rawSec) && rawSec > 0)
          ? rawSec
          : (rawMs && !isNaN(rawMs) && rawMs > 0 ? Math.round(rawMs / 1000) : null);
        const retObj = new String(chosen.url);
        retObj.url = chosen.url;
        retObj.duration = durationSec;
        return retObj;
      }
    }
  } catch (e) {}

  // Tier 2: yt-dlp direct stream resolution with modern iOS/TV client headers
  try {
    const { exec } = require('child_process');
    const direct = await new Promise((resolve) => {
      const cmd = `yt-dlp --no-check-certificates --extractor-args "youtube:player_client=ios,tv,mweb,android_creator" --user-agent "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148" -f "ba[ext=m4a]/ba/b/bestaudio/best" -g "${ytUrl}"`;
      exec(cmd, { timeout: 12000 }, (err, stdout) => {
        if (!err && stdout && stdout.trim().startsWith('http')) {
          resolve(stdout.trim().split('\n')[0]);
        } else {
          // Second attempt with tv client
          exec(`yt-dlp --no-check-certificates --extractor-args "youtube:player_client=tv" -f "ba/b/bestaudio/best" -g "${ytUrl}"`, { timeout: 10000 }, (err2, stdout2) => {
            if (!err2 && stdout2 && stdout2.trim().startsWith('http')) {
              resolve(stdout2.trim().split('\n')[0]);
            } else {
              resolve(null);
            }
          });
        }
      });
    });
    if (direct) return direct;
  } catch {}

  // Tier 3: Cobalt API official YouTube audio extraction
  const cobaltEndpoints = [
    'https://api.cobalt.tools/api/json',
    'https://cobalt.stream/api/json',
    'https://co.wuk.sh/api/json',
    'https://cobalt-api.kwiatekm.pl/api/json'
  ];
  for (const ep of cobaltEndpoints) {
    try {
      const cobRes = await axios.post(ep, {
        url: ytUrl,
        downloadMode: 'audio',
      }, {
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        timeout: 6000
      });
      if (cobRes.data?.url && cobRes.data.url.startsWith('http')) {
        return cobRes.data.url;
      }
    } catch {}
  }

  // Tier 4: Invidious / Piped official adaptive format streams
  const streamResolvers = [
    `https://invidious.tiekoetter.com/api/v1/videos/${videoId}?fields=adaptiveFormats`,
    `https://yt.chocolatemoo53.com/api/v1/videos/${videoId}?fields=adaptiveFormats`,
    `https://invidious.f5.si/api/v1/videos/${videoId}?fields=adaptiveFormats`,
    `https://inv.nadeko.net/api/v1/videos/${videoId}?fields=adaptiveFormats`,
    `https://invidious.nerdvpn.de/api/v1/videos/${videoId}?fields=adaptiveFormats`,
    `https://pipedapi.kavin.rocks/streams/${videoId}`,
  ];
  for (const ep of streamResolvers) {
    try {
      const invRes = await axios.get(ep, { timeout: 4000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      const formats = invRes.data?.adaptiveFormats || invRes.data?.audioStreams || [];
      const audio = formats.find(f => f.type?.includes('audio/mp4') || f.mimeType?.includes('audio/mp4')) ||
                    formats.find(f => f.type?.includes('audio') || f.mimeType?.includes('audio'));
      if (audio?.url && audio.url.startsWith('http')) {
        return audio.url;
      }
    } catch {}
  }

  return null;
}

// Dedicated audio stream resolution endpoint with proxy support
app.get('/api/tracks/:id/stream', async (req, res) => {
  try {
    const { id } = req.params;
    let track = null;
    if (mongoose.isValidObjectId(id)) {
      track = await Track.findById(id).lean();
    }
    const rawUrl = req.query.url || track?.audioUrl || '';
    const title = req.query.title || track?.title || '';
    const artist = req.query.artist || track?.artist || '';

    // Direct MP3/M4A non-YouTube stream
    if (rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) && !rawUrl.includes('youtube.com') && !rawUrl.includes('youtu.be') && (rawUrl.endsWith('.mp3') || rawUrl.endsWith('.m4a'))) {
      return res.json({ success: true, url: rawUrl });
    }

    const streamTarget = rawUrl || id || '';
    const streamUrl = await resolveOfficialYouTubeAudioStream(streamTarget, title, artist);
    if (streamUrl) {
      const proxyUrl = `/api/tracks/stream-proxy?url=${encodeURIComponent(streamUrl)}`;
      return res.json({
        success: true,
        url: proxyUrl,
        directUrl: streamUrl,
        duration: streamUrl.duration || track?.duration || 210
      });
    }
    res.status(404).json({ success: false, error: 'Could not resolve audio stream' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Resilient Stream Proxy with full Range header support for zero-lag seeking & buffering
app.get('/api/tracks/stream-proxy', async (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl || !targetUrl.startsWith('http')) {
    return res.status(400).send('Missing url param');
  }

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    };
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const response = await axios({
      method: 'get',
      url: targetUrl,
      responseType: 'stream',
      headers,
      timeout: 30000,
      validateStatus: (status) => status < 400,
    });

    res.status(response.status);
    const forwardHeaders = ['content-type', 'content-length', 'content-range', 'accept-ranges'];
    forwardHeaders.forEach((h) => {
      if (response.headers[h]) {
        res.setHeader(h, response.headers[h]);
      }
    });
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Accept-Ranges', 'bytes');

    response.data.pipe(res);
  } catch (err) {
    res.redirect(targetUrl);
  }
});

// Direct Audio Stream Downloader
app.get('/api/tracks/download', async (req, res) => {
  try {
    let { url, title, artist, id, trackId } = req.query;
    trackId = trackId || id;
    if (trackId && (!url || !title)) {
      try {
        if (mongoose.isValidObjectId(id)) {
          const dbTrack = await Track.findById(id).lean();
          if (dbTrack) {
            url = url || dbTrack.audioUrl;
            title = title || dbTrack.title;
            artist = artist || dbTrack.artist;
          }
        }
      } catch {}
    }

    const sanitizeTag = (str, fallback = 'Rivo') => {
      if (!str) return fallback;
      const cleaned = String(str)
        .replace(/https?:\/\/\S+/gi, '')
        .replace(/www\.\S+/gi, '')
        .replace(/youtube\.com\S*/gi, '')
        .replace(/youtu\.be\S*/gi, '')
        .replace(/liofy\S*/gi, '')
        .replace(/[\[\(]?(?:official|lyrics|video|audio|hd|4k|remastered)[\]\)]?/gi, '')
        .replace(/[/\\?%*:|"<>]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return cleaned || fallback;
    };

    const cleanArtist = sanitizeTag(artist, 'Artist').split(/[|/]/)[0].trim();
    const cleanTitle = sanitizeTag(title, 'Track');
    const cleanFilename = `${cleanArtist} - ${cleanTitle}`;

    let cleanAlbum = sanitizeTag(req.query.album || '', '');
    if (!cleanAlbum && trackId) {
      try {
        const dbTrack = await Track.findById(trackId).lean();
        if (dbTrack && dbTrack.album && !/https?:\/\/|www\.|youtube|liofy/i.test(dbTrack.album)) {
          cleanAlbum = sanitizeTag(dbTrack.album, '');
        }
      } catch (e) {}
    }
    if (!cleanAlbum && (title || artist)) {
      try {
        const dbTrack = await Track.findOne({
          title: new RegExp(`^${cleanTitle}$`, 'i'),
          artist: new RegExp(`^${cleanArtist}$`, 'i')
        }).lean();
        if (dbTrack && dbTrack.album && !/https?:\/\/|www\.|youtube|liofy/i.test(dbTrack.album)) {
          cleanAlbum = sanitizeTag(dbTrack.album, '');
        }
      } catch (e) {}
    }
    if (!cleanAlbum) {
      cleanAlbum = cleanTitle || 'Single';
    }

    let NodeID3 = null;
    try {
      NodeID3 = require('node-id3');
    } catch (e) {}

    const isMp3Buffer = (buf) => {
      if (!buf || buf.length < 4) return false;
      if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true; // ID3
      if (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) return true; // MP3 sync
      return false;
    };

    const applyRivoTags = (buffer) => {
      if (!NodeID3 || !buffer || !Buffer.isBuffer(buffer)) return buffer;
      if (!isMp3Buffer(buffer)) return buffer; // Never corrupt non-MP3 containers (m4a/webm/aac)
      try {
        const tags = {
          title: cleanTitle,
          artist: cleanArtist,
          album: cleanAlbum,
          publisher: 'Rivo',
          encodedBy: 'Rivo',
          comment: {
            language: 'eng',
            text: 'Rivo'
          },
          userDefinedText: [
            { description: 'RIVO_SIGNATURE', value: 'Rivo' },
            { description: 'SOURCE', value: 'Rivo' }
          ]
        };
        const tagged = NodeID3.write(tags, buffer);
        return (tagged && Buffer.isBuffer(tagged)) ? tagged : buffer;
      } catch (err) {
        return buffer;
      }
    };

    // Direct MP3 or Audio URLs (non-YouTube)
    if (url && (url.startsWith('http://') || url.startsWith('https://')) && !url.includes('youtube.com') && !url.includes('youtu.be')) {
      try {
        const directRes = await axios({
          method: 'get',
          url: url,
          responseType: 'stream',
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          timeout: 45000
        });
        const safeAscii = cleanFilename.replace(/[^\x20-\x7E]/g, '').trim() || 'track';
        res.set({
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': `attachment; filename="${safeAscii}.mp3"; filename*=UTF-8''${encodeURIComponent(cleanFilename)}.mp3`,
          'Access-Control-Allow-Origin': '*'
        });
        return directRes.data.pipe(res);
      } catch (e) {}
    }

    // YouTube track resolution
    let videoId = null;
    const candidates = [url, id, trackId, req.query.id, req.query.trackId];
    for (const cand of candidates) {
      if (!cand || typeof cand !== 'string') continue;
      const str = cand.trim();
      const m1 = str.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
      if (m1 && m1[1] && m1[1].length === 11) { videoId = m1[1]; break; }
      const m2 = str.match(/^yt[-_]?([a-zA-Z0-9_-]{11})$/i);
      if (m2 && m2[1] && m2[1].length === 11) { videoId = m2[1]; break; }
      if (/^[a-zA-Z0-9_-]{11}$/.test(str) && !mongoose.isValidObjectId(str)) { videoId = str; break; }
    }
    if (!videoId && (title || artist)) {
      try {
        videoId = await searchYouTubeId(`${cleanArtist} ${cleanTitle}`.trim());
      } catch {}
    }

    if (videoId) {
      // Prioritize fast direct stream resolution first
      const streamTarget = url || `https://www.youtube.com/watch?v=${videoId}`;
      const directStreamUrl = await resolveOfficialYouTubeAudioStream(streamTarget, cleanTitle, cleanArtist);
      if (directStreamUrl) {
        try {
          const streamRes = await axios({
            method: 'get',
            url: directStreamUrl,
            responseType: 'stream',
            headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X)' },
            timeout: 45000,
          });
          const safeAscii = cleanFilename.replace(/[^\x20-\x7E]/g, '').trim() || 'track';
          res.set({
            'Content-Type': 'audio/mp4',
            'Content-Disposition': `attachment; filename="${safeAscii}.m4a"; filename*=UTF-8''${encodeURIComponent(cleanFilename)}.m4a`,
            'Access-Control-Allow-Origin': '*'
          });
          return streamRes.data.pipe(res);
        } catch (streamErr) {
          res.set({ 'Access-Control-Allow-Origin': '*' });
          return res.redirect(directStreamUrl);
        }
      }

      const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const { exec } = require('child_process');
      const os = require('os');
      const path = require('path');
      const fs = require('fs');

      const hasYtDlp = await new Promise(resolve => {
        exec('yt-dlp --version', (err, stdout) => resolve(!err && stdout && stdout.trim().length > 0));
      });

      if (hasYtDlp) {
        const tempFile = path.join(os.tmpdir(), `dl-${Date.now()}-${videoId}.m4a`);
        const ytdlpCmd = `yt-dlp --no-check-certificates --extractor-args "youtube:player_client=ios,tv,mweb,android_creator" --user-agent "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148" -f "ba[ext=m4a]/ba/b/bestaudio/best" -o "${tempFile}" "${ytUrl}"`;
        let dlSuccess = await new Promise(resolve => {
          exec(ytdlpCmd, { timeout: 35000 }, (err) => {
            if (!err && fs.existsSync(tempFile) && fs.statSync(tempFile).size > 10000) {
              resolve(true);
            } else {
              try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (e) {}
              resolve(false);
            }
          });
        });

        // Retry with tv player client if ios client fails
        if (!dlSuccess) {
          const ytdlpCmdTv = `yt-dlp --no-check-certificates --extractor-args "youtube:player_client=tv" -f "ba/b/bestaudio/best" -o "${tempFile}" "${ytUrl}"`;
          dlSuccess = await new Promise(resolve => {
            exec(ytdlpCmdTv, { timeout: 25000 }, (err) => {
              if (!err && fs.existsSync(tempFile) && fs.statSync(tempFile).size > 10000) {
                resolve(true);
              } else {
                try { if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile); } catch (e) {}
                resolve(false);
              }
            });
          });
        }

        if (dlSuccess) {
          const safeAscii = cleanFilename.replace(/[^\x20-\x7E]/g, '').trim() || 'track';
          const encoded = encodeURIComponent(cleanFilename);
          res.set({
            'Content-Type': 'audio/mp4',
            'Content-Disposition': `attachment; filename="${safeAscii}.m4a"; filename*=UTF-8''${encoded}.m4a`,
            'Access-Control-Allow-Origin': '*'
          });
          const fStream = fs.createReadStream(tempFile);
          fStream.on('close', () => {
            try { fs.unlinkSync(tempFile); } catch (e) {}
          });
          fStream.on('error', () => {
            try { fs.unlinkSync(tempFile); } catch (e) {}
          });
          return fStream.pipe(res);
        }
      }
    }

    // Official YouTube Stream Fallback Tier 1: Cobalt API (extracts official audio from YouTube URL)
    if (videoId) {
      const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const cobaltEndpoints = [
        'https://api.cobalt.tools/api/json',
        'https://cobalt.stream/api/json',
        'https://co.wuk.sh/api/json',
        'https://cobalt-api.kwiatekm.pl/api/json'
      ];
      for (const ep of cobaltEndpoints) {
        try {
          const cobRes = await axios.post(ep, {
            url: ytUrl,
            downloadMode: 'audio',
          }, {
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
            timeout: 8000
          });
          const cobUrl = cobRes.data?.url;
          if (cobUrl && cobUrl.startsWith('http')) {
            const streamRes = await axios({
              method: 'get',
              url: cobUrl,
              responseType: 'stream',
              headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X)' },
              timeout: 45000
            });
            const safeAscii = cleanFilename.replace(/[^\x20-\x7E]/g, '').trim() || 'track';
            res.set({
              'Content-Type': 'audio/mpeg',
              'Content-Disposition': `attachment; filename="${safeAscii}.mp3"; filename*=UTF-8''${encodeURIComponent(cleanFilename)}.mp3`,
              'Access-Control-Allow-Origin': '*'
            });
            return streamRes.data.pipe(res);
          }
        } catch {}
      }
    }

    // Official YouTube Stream Fallback Tier 2: Invidious / Piped adaptive audio formats
    const streamTarget = url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '');
    const streamUrl = await resolveOfficialYouTubeAudioStream(streamTarget, cleanTitle, cleanArtist);
    if (streamUrl) {
      try {
        const streamRes = await axios({
          method: 'get',
          url: streamUrl,
          responseType: 'stream',
          headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X)' },
          timeout: 45000
        });

        const safeAscii = cleanFilename.replace(/[^\x20-\x7E]/g, '').trim() || 'track';
        res.set({
          'Content-Type': 'audio/mp4',
          'Content-Disposition': `attachment; filename="${safeAscii}.m4a"; filename*=UTF-8''${encodeURIComponent(cleanFilename)}.m4a`,
          'Access-Control-Allow-Origin': '*'
        });
        return streamRes.data.pipe(res);
      } catch (streamErr) {
        res.set({ 'Access-Control-Allow-Origin': '*' });
        return res.redirect(streamUrl);
      }
    }

    return res.status(404).json({ success: false, error: 'Could not resolve official audio stream for download' });
  } catch (e) {
    console.error('Download audio error:', e.message);
    if (!res.headersSent) res.status(500).json({ success: false, error: e.message });
  }
});


app.post('/api/tracks/update-lyrics', auth, async (req, res) => {
  try {
    const { trackId, title, artist, audioUrl, lyrics, isVerified } = req.body;
    const isAdmin = isAdminUser(req.user);
    const isVer = isAdmin ? (isVerified !== undefined ? Boolean(isVerified) : true) : false;
    const trackKey = getTrackKey(title, artist);

    // If admin marks lyrics as NOT correct / unverified, remove custom record
    // so the song continues using the normal function (LRCLIB / OVH scraper)
    if (!isVer && isAdmin && isVerified === false) {
      if (trackKey && trackKey !== '___') {
        await SongLyrics.deleteOne({ trackKey }).catch(() => {});
      }
      if (trackId) {
        await SongLyrics.deleteOne({ trackId: String(trackId) }).catch(() => {});
        if (mongoose.isValidObjectId(trackId)) {
          await Track.updateOne({ _id: trackId }, { $set: { lyrics: [] } }).catch(() => {});
        }
      }
      io.emit('lyrics:updated', {
        trackKey,
        trackId: String(trackId || ''),
        title,
        artist,
        lyrics: [],
        isVerified: false
      });
      return res.json({ success: true, isVerified: false, message: 'Lyrics unverified; normal scraper will be used.' });
    }

    if (!lyrics || !Array.isArray(lyrics)) {
      return res.status(400).json({ error: 'Lyrics must be an array' });
    }

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
            updatedBy: req.user.name || req.user.username || (isAdmin ? 'Admin' : 'User'),
            isVerified: isVer,
            verifiedBy: isVer ? (req.user.name || 'Admin') : '',
            verifiedAt: isVer ? new Date() : null,
            source: isVer ? 'verified' : 'community'
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
            isVerified: true,
            verifiedBy: req.user.name || 'Admin',
            verifiedAt: new Date(),
            source: 'verified'
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
      lyrics,
      isVerified: true,
      verifiedBy: req.user.name || 'Admin'
    });

    console.log(`[Lyrics] Verified lyrics saved for "${title}" by "${artist}" by admin ${req.user.name}`);
    res.json({ success: true, trackKey, isVerified: true });
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
        return res.json({
          success: true,
          lyrics: found.lyrics,
          source: found.source || 'manual',
          isVerified: Boolean(found.isVerified),
          verifiedBy: found.verifiedBy || ''
        });
      }
    }

    // 2. Try trackId in SongLyrics
    if (trackId) {
      const found = await SongLyrics.findOne({ trackId: String(trackId) }).lean();
      if (found && Array.isArray(found.lyrics) && found.lyrics.length > 0) {
        return res.json({
          success: true,
          lyrics: found.lyrics,
          source: found.source || 'manual',
          isVerified: Boolean(found.isVerified),
          verifiedBy: found.verifiedBy || ''
        });
      }

      // 3. Try Track DB if valid ObjectId
      if (mongoose.isValidObjectId(trackId)) {
        const trk = await Track.findById(trackId).lean();
        if (trk && Array.isArray(trk.lyrics) && trk.lyrics.length > 0) {
          return res.json({
            success: true,
            lyrics: trk.lyrics,
            source: 'manual',
            isVerified: false
          });
        }
      }
    }

    // 4. Fallback to LRCLIB / OVH if title exists
    if (title) {
      const lyrics = await fetchLrclibLyrics(title, artist, 180);
      if (lyrics && lyrics.length > 0) {
        return res.json({ success: true, lyrics, source: 'synced', isVerified: false });
      }
    }

    res.json({ success: false, lyrics: [], isVerified: false });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message, lyrics: [], isVerified: false });
  }
});

app.post('/api/tracks/clear-lyrics', adminAuth, async (req, res) => {
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

    io.emit('lyrics:updated', { trackKey, trackId, lyrics: [], isVerified: false });
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
async function getGeminiMusicSuggestions(seedTracks, vibePrompt = '', followedArtists = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const seeds = seedTracks.slice(0, 6).map(t => `"${t.title}" by ${t.artist}`).join(', ');
    const artistFocus = (followedArtists && followedArtists.length > 0)
      ? `Important: The user specifically follows these artists: [${followedArtists.join(', ')}]. Strongly prioritize recommending tracks by these artists or matching their exact style and vibe.`
      : '';
    const prompt = `You are a world-class Spotify-grade music DJ and recommendation algorithm.
Given these seed tracks from a user's playlist: [${seeds}].
${artistFocus}
${vibePrompt ? `User mood/vibe request: "${vibePrompt}".` : 'Recommend tracks that seamlessly blend with this mood, tempo, and harmonic key for Smart Shuffle.'}
Provide 6 song recommendations.
Respond ONLY with a JSON array of objects with keys: "title", "artist", "reason" (short 4-word reason like "Followed Artist Hit" or "Matching Energy"). No markdown, no formatting.`;

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
    const { currentTrack, seedTracks = [], limit = 6, followedArtists = [] } = req.body;
    const allSeeds = [currentTrack, ...seedTracks].filter(Boolean);

    // 1. Try Gemini AI recommendations first if key exists
    let aiRecs = await getGeminiMusicSuggestions(allSeeds, '', followedArtists);
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
            source: 'Rivo'
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

app.get(['/api/soundcloud/fallback', '/api/tracks/fallback-stream'], async (req, res) => {
  res.status(404).json({ success: false, error: 'SoundCloud fallback disabled' });
});

app.get('/api/proxy-audio', async (req, res) => {
  try {
    const rawUrl = req.query.url;
    if (!rawUrl || typeof rawUrl !== 'string') return res.status(400).end();

    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Only HTTP and HTTPS are permitted' });
    }

    const host = parsed.hostname.toLowerCase();
    // Block internal network scanning / SSRF (localhost, private ranges, cloud metadata 169.254.x)
    const isPrivate = host === 'localhost' ||
      host === '0.0.0.0' ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^::1$/.test(host) ||
      /^fc00:/.test(host) ||
      /^fe80:/.test(host);

    if (isPrivate) {
      return res.status(403).json({ error: 'Access to internal resources is forbidden' });
    }

    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
    if (req.headers.range) {
      headers['Range'] = req.headers.range;
    }

    const r = await axios({
      method: 'get',
      url: rawUrl,
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
// TRACK AUDIO STREAM RESOLVER ENDPOINT (YouTube First)
// ──────────────────────────────────────────
const resolveStreamHandler = async (req, res) => {
  try {
    const { url, title, artist, id, trackId } = req.query;

    // 0. Instant YouTube audio resolution from candidate fields
    const cand = [url, id, trackId, req.params?.id];
    for (const c of cand) {
      if (c && typeof c === 'string') {
        const m1 = c.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
        const m2 = c.match(/^yt[-_]?([a-zA-Z0-9_-]{11})$/i);
        const vidCandidate = (m1 && m1[1] && m1[1].length === 11)
          ? m1[1]
          : ((m2 && m2[1]) ? m2[1] : (/^[a-zA-Z0-9_-]{11}$/.test(c.trim()) && !mongoose.isValidObjectId(c.trim()) ? c.trim() : null));

        if (vidCandidate) {
          const directAudio = await resolveOfficialYouTubeAudioStream(vidCandidate, title || '', artist || '');
          if (directAudio) {
            const proxyUrl = `/api/tracks/stream-proxy?url=${encodeURIComponent(directAudio)}`;
            return res.json({
              success: true,
              url: proxyUrl,
              directUrl: directAudio,
              duration: (directAudio.duration && directAudio.duration > 0) ? directAudio.duration : 210,
              cover: `https://i.ytimg.com/vi/${vidCandidate}/hqdefault.jpg`,
              isYouTube: false
            });
          }
        }
      }
    }

    // Check DB for existing track by ObjectId
    const targetDbId = id || trackId || req.params?.id;
    if (targetDbId && mongoose.isValidObjectId(targetDbId)) {
      try {
        const dbTrack = await Track.findById(targetDbId).lean();
        if (dbTrack) {
          if (dbTrack.audioUrl && (dbTrack.audioUrl.endsWith('.mp3') || dbTrack.audioUrl.endsWith('.m4a')) && !dbTrack.audioUrl.includes('youtube') && !dbTrack.audioUrl.includes('soundcloud')) {
            return res.json({
              success: true,
              url: dbTrack.audioUrl,
              duration: dbTrack.duration || 240,
              cover: dbTrack.cover,
              isYouTube: false
            });
          }
          const directAudio = await resolveOfficialYouTubeAudioStream(dbTrack.audioUrl, dbTrack.title, dbTrack.artist);
          if (directAudio) {
            const proxyUrl = `/api/tracks/stream-proxy?url=${encodeURIComponent(directAudio)}`;
            return res.json({
              success: true,
              url: proxyUrl,
              directUrl: directAudio,
              duration: (directAudio.duration && directAudio.duration > 0) ? directAudio.duration : (dbTrack.duration || 210),
              cover: dbTrack.cover,
              isYouTube: false
            });
          }
        }
      } catch {}
    }

    // 1. YouTube audio stream via title + artist or url
    if (title || artist || url) {
      const directAudio = await resolveOfficialYouTubeAudioStream(url || '', title || '', artist || '');
      if (directAudio) {
        const proxyUrl = `/api/tracks/stream-proxy?url=${encodeURIComponent(directAudio)}`;
        return res.json({
          success: true,
          url: proxyUrl,
          directUrl: directAudio,
          duration: (directAudio.duration && directAudio.duration > 0) ? directAudio.duration : 210,
          isYouTube: false,
        });
      }
    }

    // 2. Direct MP3/M4A if valid and not soundcloud
    if (url && url.startsWith('http') && !url.includes('pixabay.com') && !url.includes('preview') && !url.includes('soundcloud.com') && !url.includes('sndcdn.com')) {
      return res.json({ success: true, url });
    }

    res.status(404).json({ success: false, error: 'Could not resolve audio stream' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

app.get('/api/tracks/resolve-stream', resolveStreamHandler);
app.get('/api/soundcloud/stream', resolveStreamHandler);

// Purge SoundCloud tracks endpoint (Admin Only)
app.post('/api/tracks/purge-soundcloud', adminAuth, async (req, res) => {
  try {
    const scQuery = {
      $or: [
        { source: { $regex: /soundcloud/i } },
        { audioUrl: { $regex: /soundcloud\.com|sndcdn\.com/i } },
        { album: { $regex: /soundcloud/i } },
        { originalUrl: { $regex: /soundcloud\.com/i } },
        { id: { $regex: /^sc-/i } },
      ]
    };
    const r = await Track.deleteMany(scQuery);
    res.json({ success: true, deletedCount: r.deletedCount });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ──────────────────────────────────────────
// SOCKET.IO REAL-TIME JAM & CHAT ENGINE
// ──────────────────────────────────────────
const jamRooms = {};
const jamDisconnectTimeouts = new Map();

io.on('connection', (socket) => {
  // User connects & registers their socket ID
  socket.on('user:online', ({ userId }) => {
    if (!userId) return;
    const uidStr = String(userId);
    socket.userId = uidStr;
    socket.join(`user:${uidStr}`);
    if (!userSocketMap.has(uidStr)) {
      userSocketMap.set(uidStr, new Set());
    }
    userSocketMap.get(uidStr).add(socket.id);

    // Notify all clients that this user is now online
    io.emit('user:status', {
      userId: uidStr,
      isOnline: true
    });
  });

  // Client emits live listening state changes over socket for instant zero-lag sync
  socket.on('activity:listening', async ({ track, isPlaying }) => {
    const uidStr = socket.userId;
    if (!uidStr) return;
    const now = new Date();
    const updateData = {
      lastActiveAt: now,
      currentListening: track ? {
        id: track.id || track._id,
        title: track.title,
        artist: track.artist,
        cover: track.cover,
        audioUrl: track.audioUrl,
        isPlaying: Boolean(isPlaying),
        updatedAt: now
      } : null
    };

    try {
      const user = await User.findByIdAndUpdate(uidStr, { $set: updateData }, { new: true });
      if (user) {
        io.emit('activity:updated', {
          userId: uidStr,
          name: user.name,
          avatar: user.avatar,
          currentListening: user.currentListening,
          lastActiveAt: user.lastActiveAt,
          isOnline: true,
          isLive: Boolean(isPlaying)
        });
      }
    } catch (e) {}
  });

  // Real-time Chat: Mark messages as read / seen and sync across all devices
  socket.on('chat:mark_read', async ({ senderId }) => {
    const currentUserId = socket.userId;
    if (!currentUserId || !senderId) return;

    try {
      await Message.updateMany(
        { sender: senderId, recipient: currentUserId, read: false },
        { $set: { read: true } }
      );

      // 1. Notify the original sender that their messages were seen
      io.to(`user:${senderId}`).emit('chat:seen', {
        seenBy: currentUserId,
        senderId: senderId,
        readAt: Date.now()
      });

      // 2. Notify the reader's other connected devices (mobile/desktop) to dismiss notification
      io.to(`user:${currentUserId}`).emit('chat:dismiss_notification', {
        senderId: senderId
      });
    } catch (e) {}
  });

  // Jam: Direct Invite to another user
  socket.on('jam:invite_user', ({ recipientId, roomCode, host }) => {
    if (!recipientId || !roomCode) return;
    io.to(`user:${recipientId}`).emit('jam:invite_received', {
      roomCode,
      host: host || { id: socket.id, name: 'Friend', avatar: '' },
      createdAt: Date.now()
    });
  });

  // Jam: Host creates or joins room
  socket.on('jam:join_room', ({ roomCode, user }) => {
    if (!roomCode) return;
    socket.join(roomCode);
    if (!jamRooms[roomCode]) {
      jamRooms[roomCode] = {
        code: roomCode,
        hostId: socket.id,
        hostUserId: user?.id || null,
        currentTrack: null,
        isPlaying: false,
        currentTime: 0,
        updatedAt: Date.now(),
        queue: [],
        members: []
      };
    }

    const room = jamRooms[roomCode];

    // Clear any disconnect grace timer for this user in this room
    const disconnectKey = `${roomCode}:${user?.id || socket.id}`;
    if (jamDisconnectTimeouts.has(disconnectKey)) {
      clearTimeout(jamDisconnectTimeouts.get(disconnectKey));
      jamDisconnectTimeouts.delete(disconnectKey);
    }

    // Check if this user was already host or in room
    const existingMember = room.members.find(m => (user?.id && (m.id === user.id || m._id === user.id)) || m.socketId === socket.id);
    const wasHost = existingMember ? Boolean(existingMember.isHost) : Boolean(room.hostUserId && user?.id && room.hostUserId === user.id);

    // Filter out old instance of this user/socket
    room.members = room.members.filter(m => m.socketId !== socket.id && (!user?.id || (m.id !== user.id && m._id !== user.id)));

    const hasActiveHost = room.members.some(m => m.isHost && !m.isDisconnected);
    const isFirstMember = room.members.length === 0;
    const isHost = wasHost || isFirstMember || !hasActiveHost || room.hostId === socket.id;

    if (isHost) {
      room.hostId = socket.id;
      room.hostUserId = user?.id || null;
      room.members.forEach(m => { m.isHost = false; });
    }

    const member = {
      ...user,
      socketId: socket.id,
      isHost,
      isDisconnected: false
    };

    room.members.push(member);

    // Broadcast full room state to everyone and directly to this socket
    io.to(roomCode).emit('jam:room_updated', room);
    socket.emit('jam:room_updated', room);

    // If a track is already set/playing, send immediate sync state to the new joiner
    if (room.currentTrack) {
      let liveTime = Number(room.currentTime) || 0;
      if (room.isPlaying && room.updatedAt) {
        const elapsed = (Date.now() - room.updatedAt) / 1000;
        if (elapsed > 0 && elapsed < 3600) {
          liveTime += elapsed;
        }
      }
      socket.emit('jam:sync_play_state', {
        isPlaying: Boolean(room.isPlaying),
        currentTrack: room.currentTrack,
        currentTime: liveTime,
        updatedAt: room.updatedAt || Date.now(),
        queue: room.queue || [],
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

  // Jam: Add song(s) or playlist to Linked Shared Queue
  socket.on('jam:add_to_queue', ({ roomCode, track, tracks, playNext }) => {
    const room = jamRooms[roomCode];
    if (room) {
      let rawList = [];
      if (Array.isArray(tracks)) {
        rawList = tracks;
      } else if (Array.isArray(track)) {
        rawList = track;
      } else if (track) {
        rawList = [track];
      }

      const validList = rawList.filter(Boolean);
      if (validList.length === 0) return;

      let remainingTracks = [...validList];
      // If nothing is playing currently in room, immediately play the first track
      if (!room.currentTrack) {
        const firstTrack = remainingTracks.shift();
        room.currentTrack = firstTrack;
        room.isPlaying = true;
        room.currentTime = 0;
        room.updatedAt = Date.now();

        io.to(roomCode).emit('jam:on_play_state_changed', {
          isPlaying: true,
          currentTrack: firstTrack,
          currentTime: 0,
          updatedAt: room.updatedAt,
          initiatorId: socket.id
        });
      }

      if (remainingTracks.length > 0) {
        const formatted = remainingTracks.map(t => ({
          ...t,
          queuedBy: socket.id,
          queuedAt: Date.now()
        }));

        if (!room.queue) room.queue = [];
        if (playNext) {
          room.queue.unshift(...formatted);
        } else {
          room.queue.push(...formatted);
        }
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

  // Jam: Reorder Shared Queue (Item 2)
  socket.on('jam:reorder_queue', ({ roomCode, fromIndex, toIndex }) => {
    const room = jamRooms[roomCode];
    if (room && Array.isArray(room.queue)) {
      if (typeof fromIndex === 'number' && typeof toIndex === 'number' &&
          fromIndex >= 0 && fromIndex < room.queue.length &&
          toIndex >= 0 && toIndex < room.queue.length) {
        const [moved] = room.queue.splice(fromIndex, 1);
        room.queue.splice(toIndex, 0, moved);
        io.to(roomCode).emit('jam:room_updated', room);
      }
    }
  });

  // Jam: Transfer Host to Another Participant (Item 3)
  socket.on('jam:transfer_host', ({ roomCode, targetSocketId, targetUserId }) => {
    const room = jamRooms[roomCode];
    if (!room) return;
    if (room.hostId !== socket.id) return; // Only current host can transfer

    const target = (room.members || []).find(m => m.socketId === targetSocketId || (targetUserId && (m.id === targetUserId || m._id === targetUserId)));
    if (!target) return;

    room.hostId = target.socketId;
    room.members = room.members.map(m => ({
      ...m,
      isHost: m.socketId === target.socketId
    }));

    io.to(roomCode).emit('jam:room_updated', room);
    io.to(target.socketId).emit('jam:promoted_to_host', { roomCode });
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

  socket.on('disconnect', async () => {
    // Clean up presence tracking for this user
    const uidStr = socket.userId;
    if (uidStr && userSocketMap.has(uidStr)) {
      const sockets = userSocketMap.get(uidStr);
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        userSocketMap.delete(uidStr);

        // When user has closed all tabs/connections: mark offline and stop live playing
        try {
          await User.findByIdAndUpdate(uidStr, {
            $set: {
              'currentListening.isPlaying': false,
              lastActiveAt: new Date()
            }
          });
        } catch (e) {}

        // Broadcast immediately to all connected clients
        io.emit('user:status', {
          userId: uidStr,
          isOnline: false,
          isLive: false
        });
        io.emit('activity:updated', {
          userId: uidStr,
          isOnline: false,
          isLive: false,
          currentListening: { isPlaying: false }
        });
      }
    }

    // Clean up user from all jam rooms with grace period (avoids glitches on reconnect/refresh/offline-toggle)
    for (const code in jamRooms) {
      const room = jamRooms[code];
      const member = room.members.find(m => m.socketId === socket.id);
      if (member) {
        member.isDisconnected = true;
        const key = `${code}:${member.id || socket.id}`;
        
        // Clear any existing timer
        if (jamDisconnectTimeouts.has(key)) {
          clearTimeout(jamDisconnectTimeouts.get(key));
        }

        const timer = setTimeout(() => {
          jamDisconnectTimeouts.delete(key);
          const currentRoom = jamRooms[code];
          if (!currentRoom) return;

          currentRoom.members = currentRoom.members.filter(m => m.socketId !== socket.id && (!member.id || m.id !== member.id));
          if (currentRoom.members.length === 0) {
            delete jamRooms[code];
          } else {
            if (currentRoom.hostId === socket.id || !currentRoom.members.some(m => m.socketId === currentRoom.hostId)) {
              const activeMembers = currentRoom.members.filter(m => !m.isDisconnected);
              const targetList = activeMembers.length > 0 ? activeMembers : currentRoom.members;
              const newHost = targetList[0];
              currentRoom.members.forEach(m => { m.isHost = (m.socketId === newHost.socketId); });
              currentRoom.hostId = newHost.socketId;
            }
            io.to(code).emit('jam:room_updated', currentRoom);
          }
        }, 30000); // 30 second grace period

        jamDisconnectTimeouts.set(key, timer);
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
