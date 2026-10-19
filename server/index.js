/**
 * Rivo Backend API Server — Modular & Refactored
 */

const dns = require('dns');
try { dns.setDefaultResultOrder('ipv4first'); dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const path = require('path');
try { require('dotenv').config({ path: path.join(__dirname, '../.env') }); } catch (e) {}

const express = require('express');
const http = require('http');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const { Server } = require('socket.io');

const { User, Track, Album } = require('./models');
const { auth, adminAuth } = require('./middleware/auth');
const { uploadsDir } = require('./middleware/upload');
const { validateSafeUrl } = require('./utils/security');
const { searchTracksInternal, isQuranContent, ensureYtDlpBinary } = require('./utils/helpers');

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: false
}));

app.use(cors({ origin: '*', credentials: true }));

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1500,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use('/api/', generalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
  message: { error: 'Too many authentication attempts, please try again after 15 minutes.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

app.use(express.json({ limit: '15mb' }));

// Static serving for web dist
app.use(express.static(path.join(__dirname, '../dist'), {
  maxAge: '1d',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else if (filePath.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff2?|ico)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// Static uploads & downloads
app.use('/uploads', express.static(uploadsDir));
app.use('/public', express.static(path.join(__dirname, '../public')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.set('io', io);
app.use((req, res, next) => {
  req.io = io;
  next();
});

// App Version Manifest — Independent versioning for each target
const APP_VERSIONS_DATA = {
  publishedAt: new Date().toISOString(),
  platforms: {
    web: {
      version: '1.9.3',
      name: 'Rivo Web',
      notes: 'Web browser release with hi-fi streaming, responsive design, and enhanced lyrics sync.'
    },
    windows: {
      version: '1.9.3',
      name: 'Rivo Desktop for Windows (EXE)',
      downloadUrl: '/downloads/Rivo-v1.9.3.exe',
      directFile: 'Rivo-v1.9.3.exe',
      mandatory: false,
      notes: 'Native Windows desktop release with in-place auto-updater, smooth lyrics scrolling, and zero network lag.'
    },
    android: {
      version: '1.9.3',
      build: 62,
      name: 'Rivo for Android (APK)',
      downloadUrl: '/downloads/Rivo-v1.9.3.apk',
      directFile: 'Rivo-v1.9.3.apk',
      mandatory: false,
      notes: 'Offline folder import full metadata & lyrics extraction, and 60fps buttery-smooth queue dragging.'
    },
    ios: {
      version: '1.9.3',
      build: 62,
      name: 'Rivo for iOS (IPA)',
      downloadUrl: '/downloads/Rivo-v1.9.3.ipa',
      directFile: 'Rivo-v1.9.3.ipa',
      mandatory: false,
      notes: 'Offline folder import full metadata & lyrics extraction, and 60fps buttery-smooth queue dragging.'
    }
  }
};

app.get('/api/app/version', (req, res) => {
  res.json(APP_VERSIONS_DATA);
});

// Dynamic download routes for Windows EXE, Android APK, and iOS IPA releases
app.get('/downloads/:filename', async (req, res) => {
  const filename = path.basename(req.params.filename);
  const localFile = path.join(__dirname, '../public/downloads', filename);

  // 1. Serve local file if already present in public/downloads
  if (fs.existsSync(localFile)) {
    return res.download(localFile, filename);
  }

  const ver = APP_VERSIONS_DATA.platforms.android.version || '1.9.3';

  // 2. Redirect to latest GitHub Release based on file extension
  if (filename.endsWith('.apk')) {
    return res.redirect(`https://github.com/WhooAre-you/Rivo/releases/latest/download/Rivo-v${ver}.apk`);
  }
  if (filename.endsWith('.ipa')) {
    return res.redirect(`https://github.com/WhooAre-you/Rivo/releases/latest/download/Rivo-v${ver}.ipa`);
  }
  if (filename.endsWith('.exe')) {
    return res.redirect(`https://github.com/WhooAre-you/Rivo/releases/latest/download/Rivo-v${ver}.exe`);
  }

  return res.status(404).json({ error: 'File not found' });
});

// Broadcast app update notification to all active web and mobile clients (Admin Only)
app.post('/api/app/broadcast-update', adminAuth, (req, res) => {
  if (io) {
    io.emit('app:update_manifest', APP_VERSIONS_DATA);
    io.emit('app:update_available', APP_VERSIONS_DATA);
  }
  res.json({ success: true, message: 'Update notification broadcasted to all connected clients', data: APP_VERSIONS_DATA });
});

// Direct downloads static route
app.use('/downloads', (req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
}, express.static(path.join(__dirname, '../public/downloads')));

// Search API
app.get(['/api/search', '/api/search/external'], async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ success: true, tracks: [] });
  const tracks = await searchTracksInternal(q);
  res.json({ success: true, tracks });
});

// Sync API
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
      cover: (t.cover && typeof t.cover === 'string' && (t.cover.startsWith('/uploads/') || t.cover.startsWith('uploads/')))
        ? (t.cover.startsWith('/') ? t.cover : `/${t.cover}`)
        : t.cover,
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

// Proxy Audio API with SSRF protection
app.get('/api/proxy-audio', async (req, res) => {
  try {
    const rawUrl = req.query.url;
    if (!rawUrl || typeof rawUrl !== 'string') return res.status(400).end();

    const safeUrl = await validateSafeUrl(rawUrl);
    if (!safeUrl) {
      return res.status(403).json({ error: 'Access to this URL is blocked for security reasons (SSRF Protection)' });
    }

    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
    if (req.headers.range) headers['Range'] = req.headers.range;

    const r = await axios({
      method: 'get',
      url: safeUrl,
      responseType: 'stream',
      headers,
      timeout: 25000,
      maxRedirects: 0,
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
    if (!res.headersSent) res.status(500).end();
  }
});

// Mount Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/tracks',    require('./routes/tracks'));
app.use('/api/playlists', require('./routes/playlists'));
app.use('/api/albums',    require('./routes/albums'));
app.use('/api/artists',   require('./routes/artists'));
app.use('/api/users',     require('./routes/users'));
app.use('/api/chat',      require('./routes/chat'));
app.use('/api/stats',     require('./routes/stats'));
app.use('/api/discord',   require('./routes/discord'));
app.use('/api/ai',        require('./routes/ai'));
app.use('/api/admin',     require('./routes/admin'));

// SoundCloud fallback disabled routes
app.get(['/api/soundcloud/fallback', '/api/tracks/fallback-stream'], (req, res) => {
  res.status(404).json({ success: false, error: 'SoundCloud fallback disabled' });
});

// Fallback SPA routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/downloads')) return next();
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Socket.IO
require('./sockets')(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Rivo Server running on port ${PORT}`);
  ensureYtDlpBinary().catch((err) => console.warn('[yt-dlp] startup check notice:', err.message));
});

module.exports = { app, server, io };
