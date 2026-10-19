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

// App Version Manifest
const APP_VERSIONS_DATA = {
  version: '1.9.1',
  releaseNotes: "v1.9.1: Opaque full player backdrop fix, Quran vs Songs Jam filter, zero-lag draggable queue, and Discord rich presence.",
  publishedAt: new Date().toISOString(),
  platforms: {
    windows: {
      version: '1.9.1',
      name: 'Rivo for Windows',
      downloadUrl: '/downloads/Rivo.exe',
      directFile: 'Rivo.exe',
      mandatory: false,
      notes: 'Hardware-accelerated ultra-smooth lyrics rendering and audio controls.'
    },
    android: {
      version: '1.9.1',
      build: 60,
      name: 'Rivo for Android',
      downloadUrl: '/downloads/Rivo-v1.9.1.apk',
      directFile: 'Rivo-v1.9.1.apk',
      mandatory: false,
      notes: 'Draggable queue without buttons, smart shuffle with AI recommendations, and background service.'
    },
    ios: {
      version: '1.9.1',
      build: 60,
      name: 'Rivo for iOS',
      downloadUrl: '/downloads/Rivo-v1.9.1.ipa',
      directFile: 'Rivo-v1.9.1.ipa',
      mandatory: false,
      notes: 'Draggable queue without buttons, repeat priority, and live Discord activity.'
    }
  }
};

app.get('/api/app/version', (req, res) => {
  res.json(APP_VERSIONS_DATA);
});

// Download routes for APK/IPA releases
app.get([
  '/downloads/Rivo.apk',
  '/downloads/Rivo-v1.9.1.apk',
  '/downloads/Rivo-v1.9.0.apk',
  '/downloads/Rivo-v1.8.9.apk',
  '/downloads/Rivo-v1.8.8.apk',
  '/downloads/Rivo-v1.8.7.apk',
  '/downloads/Rivo-v1.8.6.apk',
  '/downloads/Rivo-v1.8.5.apk',
  '/downloads/Rivo-v1.8.4.apk',
  '/downloads/Rivo-v1.8.3.apk',
  '/downloads/Rivo-v1.8.2.apk',
  '/downloads/Rivo-v1.8.1.apk',
  '/downloads/Rivo-v1.8.0.apk',
  '/downloads/Rivo-v1.7.9.apk',
  '/downloads/Rivo-v1.7.8.apk',
  '/downloads/Rivo-v1.7.7.apk',
  '/downloads/Rivo-v1.7.6.apk',
  '/downloads/Rivo-v1.7.5.apk',
  '/downloads/Rivo-v1.7.4.apk',
  '/downloads/app-release.apk'
], async (req, res) => {
  const requestedFile = path.basename(req.path);
  const targetPath = path.join(__dirname, '../public/downloads', requestedFile);
  if (fs.existsSync(targetPath)) return res.download(targetPath, requestedFile);

  const default183 = path.join(__dirname, '../public/downloads/Rivo-v1.8.3.apk');
  if (fs.existsSync(default183)) return res.download(default183, 'Rivo-v1.8.3.apk');

  const default182 = path.join(__dirname, '../public/downloads/Rivo-v1.8.2.apk');
  if (fs.existsSync(default182)) return res.download(default182, 'Rivo-v1.8.2.apk');

  const default181 = path.join(__dirname, '../public/downloads/Rivo-v1.8.1.apk');
  if (fs.existsSync(default181)) return res.download(default181, 'Rivo-v1.8.1.apk');

  const default180 = path.join(__dirname, '../public/downloads/Rivo-v1.8.0.apk');
  if (fs.existsSync(default180)) return res.download(default180, 'Rivo-v1.8.0.apk');

  const default179 = path.join(__dirname, '../public/downloads/Rivo-v1.7.9.apk');
  if (fs.existsSync(default179)) return res.download(default179, 'Rivo-v1.7.9.apk');

  const default178 = path.join(__dirname, '../public/downloads/Rivo-v1.7.8.apk');
  if (fs.existsSync(default178)) return res.download(default178, 'Rivo-v1.7.8.apk');

  const default177 = path.join(__dirname, '../public/downloads/Rivo-v1.7.7.apk');
  if (fs.existsSync(default177)) return res.download(default177, 'Rivo-v1.7.7.apk');

  const default176 = path.join(__dirname, '../public/downloads/Rivo-v1.7.6.apk');
  if (fs.existsSync(default176)) return res.download(default176, 'Rivo-v1.7.6.apk');

  const default175 = path.join(__dirname, '../public/downloads/Rivo-v1.7.5.apk');
  if (fs.existsSync(default175)) return res.download(default175, 'Rivo-v1.7.5.apk');

  const default174 = path.join(__dirname, '../public/downloads/Rivo-v1.7.4.apk');
  if (fs.existsSync(default174)) return res.download(default174, 'Rivo-v1.7.4.apk');

  const defaultGeneric = path.join(__dirname, '../public/downloads/Rivo.apk');
  if (fs.existsSync(defaultGeneric)) return res.download(defaultGeneric, 'Rivo.apk');

  const ghToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (ghToken) {
    try {
      const releaseRes = await axios.get('https://api.github.com/repos/WhooAre-you/Rivo/releases/tags/v1.9.1', {
        headers: { 'Authorization': `Bearer ${ghToken}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Rivo-Server' }
      });
      const apkAsset = (releaseRes.data?.assets || []).find(a => a.name.endsWith('.apk'));
      if (apkAsset) {
        const streamRes = await axios.get(apkAsset.url, {
          headers: { 'Authorization': `Bearer ${ghToken}`, 'Accept': 'application/octet-stream', 'User-Agent': 'Rivo-Server' },
          responseType: 'stream'
        });
        res.setHeader('Content-Disposition', `attachment; filename="${apkAsset.name}"`);
        res.setHeader('Content-Type', 'application/vnd.android.package-archive');
        return streamRes.data.pipe(res);
      }
    } catch (e) {}
  }
  res.redirect('https://github.com/WhooAre-you/Rivo/releases/download/v1.9.1/Rivo-v1.9.1.apk');
});

app.get([
  '/downloads/Rivo.ipa',
  '/downloads/Rivo-v1.9.1.ipa',
  '/downloads/Rivo-v1.9.0.ipa',
  '/downloads/Rivo-v1.8.8.ipa',
  '/downloads/Rivo-v1.8.7.ipa',
  '/downloads/Rivo-v1.8.6.ipa',
  '/downloads/Rivo-v1.8.5.ipa',
  '/downloads/Rivo-v1.8.4.ipa',
  '/downloads/Rivo-v1.8.3.ipa',
  '/downloads/Rivo-v1.8.2.ipa',
  '/downloads/Rivo-v1.8.1.ipa',
  '/downloads/Rivo-v1.8.0.ipa',
  '/downloads/Rivo-v1.7.9.ipa',
  '/downloads/Rivo-v1.7.8.ipa',
  '/downloads/Rivo-v1.7.7.ipa',
  '/downloads/Rivo-v1.7.6.ipa',
  '/downloads/Rivo-v1.7.5.ipa',
  '/downloads/Rivo-v1.7.4.ipa'
], async (req, res) => {
  const localV183Path = path.join(__dirname, '../public/downloads/Rivo-v1.8.3.ipa');
  if (fs.existsSync(localV183Path)) return res.download(localV183Path, 'Rivo-v1.8.3.ipa');

  const localV182Path = path.join(__dirname, '../public/downloads/Rivo-v1.8.2.ipa');
  if (fs.existsSync(localV182Path)) return res.download(localV182Path, 'Rivo-v1.8.2.ipa');

  const localV181Path = path.join(__dirname, '../public/downloads/Rivo-v1.8.1.ipa');
  if (fs.existsSync(localV181Path)) return res.download(localV181Path, 'Rivo-v1.8.1.ipa');

  const localV180Path = path.join(__dirname, '../public/downloads/Rivo-v1.8.0.ipa');
  if (fs.existsSync(localV180Path)) return res.download(localV180Path, 'Rivo-v1.8.0.ipa');

  const localV179Path = path.join(__dirname, '../public/downloads/Rivo-v1.7.9.ipa');
  if (fs.existsSync(localV179Path)) return res.download(localV179Path, 'Rivo-v1.7.9.ipa');

  const localV178Path = path.join(__dirname, '../public/downloads/Rivo-v1.7.8.ipa');
  if (fs.existsSync(localV178Path)) return res.download(localV178Path, 'Rivo-v1.7.8.ipa');

  const localV177Path = path.join(__dirname, '../public/downloads/Rivo-v1.7.7.ipa');
  if (fs.existsSync(localV177Path)) return res.download(localV177Path, 'Rivo-v1.7.7.ipa');

  const localV176Path = path.join(__dirname, '../public/downloads/Rivo-v1.7.6.ipa');
  if (fs.existsSync(localV176Path)) return res.download(localV176Path, 'Rivo-v1.7.6.ipa');

  const localV175Path = path.join(__dirname, '../public/downloads/Rivo-v1.7.5.ipa');
  if (fs.existsSync(localV175Path)) return res.download(localV175Path, 'Rivo-v1.7.5.ipa');

  const localV174Path = path.join(__dirname, '../public/downloads/Rivo-v1.7.4.ipa');
  if (fs.existsSync(localV174Path)) return res.download(localV174Path, 'Rivo-v1.7.4.ipa');

  const localIpaPath = path.join(__dirname, '../public/downloads/Rivo.ipa');
  if (fs.existsSync(localIpaPath)) return res.download(localIpaPath, 'Rivo.ipa');

  res.redirect('https://github.com/WhooAre-you/Rivo/releases/download/v1.9.1/Rivo-v1.9.1.ipa');
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
