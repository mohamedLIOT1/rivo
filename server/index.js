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
const crypto = require('crypto');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const { Server } = require('socket.io');

const { User, Track, Album } = require('./models');
const { auth, adminAuth, optionalAuth } = require('./middleware/auth');
const { uploadsDir } = require('./middleware/upload');
const { validateSafeUrl } = require('./utils/security');
const { handleCloudMediaRequest, scheduleCloudCacheWarmup } = require('./utils/cloudMediaServer');
const { searchTracksInternal, isQuranContent, ensureYtDlpBinary, initWarmYtWorker } = require('./utils/helpers');
const { syncUserLikedTracks } = require('./utils/likedTracksSync');

const app = express();
app.set('trust proxy', 1);
app.set('etag', 'strong');

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: false,
  contentSecurityPolicy: false
}));

const allowedCorsOrigins = [
  'https://rivo-m.duckdns.org',
  'http://localhost:5000',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5000',
  'http://127.0.0.1:5173',
  'capacitor://localhost',
  'https://tauri.localhost',
  'tauri://localhost'
];

const corsOriginHandler = (origin, callback) => {
  // Allow non-browser requests (e.g., mobile native apps, curl, Capacitor/Tauri, server-to-server)
  if (!origin) {
    return callback(null, true);
  }
  // Block untrusted null origin from credentials reflection
  if (origin === 'null') {
    return callback(null, false);
  }
  const isAllowed = allowedCorsOrigins.includes(origin) ||
    /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*duckdns\.org(:\d+)?$/.test(origin) ||
    /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*rivo\.app(:\d+)?$/.test(origin) ||
    /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
    /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin);

  if (isAllowed) {
    return callback(null, origin);
  }

  if (process.env.ALLOWED_ORIGINS) {
    const extra = process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim());
    if (extra.includes(origin)) return callback(null, origin);
  }

  // Strict CORS: reject unauthorized third-party origins
  return callback(null, false);
};

const corsOptions = {
  origin: corsOriginHandler,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'Content-Length', 'Accept-Ranges']
};

app.use(cors(corsOptions));

const shouldCompress = (req, res) => {
  if (req.headers['x-no-compression']) {
    return false;
  }
  const path = req.path || '';
  if (path.includes('/stream') || path.includes('/proxy-audio') || path.includes('/downloads/')) {
    return false;
  }
  return compression.filter(req, res);
};

app.use(compression({
  filter: shouldCompress,
  threshold: 1024
}));

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

// Static serving for web dist with robust multi-directory lookup
app.use((req, res, next) => {
  if (req.path.includes('/assets/')) {
    const assetPart = req.path.substring(req.path.indexOf('/assets/'));
    const candidatePaths = [
      path.join('/home/ubuntu/dist', assetPart),
      path.join(__dirname, '../dist', assetPart),
      path.join('/home/ubuntu/rivo/dist', assetPart)
    ];
    for (const safePath of candidatePaths) {
      if (fs.existsSync(safePath)) {
        if (assetPart.endsWith('.js')) res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        if (assetPart.endsWith('.css')) res.setHeader('Content-Type', 'text/css; charset=utf-8');
        return res.sendFile(safePath);
      }
    }
  }
  next();
});

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

// Cloud media streaming (Telegram + Backblaze B2 + bounded LRU cache)
app.get('/uploads/cloud/:file', handleCloudMediaRequest);
app.get('/api/tracks/media/:file', handleCloudMediaRequest);

// Static uploads & downloads
app.use('/uploads', express.static(uploadsDir));
app.use('/public', express.static(path.join(__dirname, '../public')));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOriginHandler,
    credentials: true,
    methods: ['GET', 'POST']
  }
});

const { userSocketMap } = require('./sockets');

app.set('io', io);
app.use((req, res, next) => {
  req.io = io;
  req.userSocketMap = userSocketMap;
  next();
});

// Mount System Versioning, OTA, and Deploy Webhook Routes
const {
  router: systemRouter,
  APP_VERSIONS_DATA,
  BETA_VERSIONS_DATA,
  BETA_TESTER_EMAILS,
  isBetaTester
} = require('./routes/system');
app.use(systemRouter);

try {
  const srcDist = path.join(__dirname, '../dist');
  const targetDist = '/home/ubuntu/dist';
  if (fs.existsSync(srcDist) && fs.existsSync('/home/ubuntu') && srcDist !== targetDist) {
    if (!fs.existsSync(targetDist)) fs.mkdirSync(targetDist, { recursive: true });
    for (const file of fs.readdirSync(srcDist)) {
      const srcFile = path.join(srcDist, file);
      const targetFile = path.join(targetDist, file);
      if (fs.statSync(srcFile).isFile()) {
        fs.copyFileSync(srcFile, targetFile);
      }
    }
    const srcAssets = path.join(srcDist, 'assets');
    const targetAssets = path.join(targetDist, 'assets');
    if (fs.existsSync(srcAssets)) {
      if (typeof fs.cpSync === 'function') {
        fs.cpSync(srcAssets, targetAssets, { recursive: true });
      } else {
        if (!fs.existsSync(targetAssets)) fs.mkdirSync(targetAssets, { recursive: true });
        for (const af of fs.readdirSync(srcAssets)) {
          const srcAf = path.join(srcAssets, af);
          if (fs.statSync(srcAf).isFile()) {
            fs.copyFileSync(srcAf, path.join(targetAssets, af));
          }
        }
      }
    }
    console.log('[Startup] Successfully synced fresh web dist to /home/ubuntu/dist');
  }
} catch (e) {
  console.error('[Startup] Failed to sync web dist:', e);
}

console.log('🚀 Rivo Server v1.9.3 (Auto-Deploy Enabled)');

// Direct downloads static route
app.use('/downloads', (req, res, next) => {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
}, express.static(path.join(__dirname, '../public/downloads')));

// Transparent fallback for Windows Desktop EXE downloads — NEVER return 404 or text for .exe
app.use('/downloads', (req, res, next) => {
  if (req.path.toLowerCase().endsWith('.exe')) {
    const candidates = [
      path.join(__dirname, '../public/downloads', path.basename(req.path)),
      path.join(__dirname, '../public/downloads/Rivo.exe'),
      path.join(__dirname, '../dist/downloads/Rivo.exe'),
      path.join('/home/ubuntu/rivo/public/downloads/Rivo.exe'),
      path.join(__dirname, '../public/downloads/Rivo_Setup.exe')
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        res.setHeader('Content-Disposition', 'attachment; filename="Rivo.exe"');
        res.setHeader('Content-Type', 'application/octet-stream');
        return res.sendFile(path.resolve(p));
      }
    }
  }
  next();
});

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

    const allTracks = await Track.aggregate([
      {
        $match: {
          source: { $ne: 'SoundCloud' },
          album: { $ne: 'SoundCloud' },
          audioUrl: { $not: /soundcloud\.com|sndcdn\.com/i }
        }
      },
      { $sort: { createdAt: -1 } },
      { $limit: 500 },
      {
        $project: {
          id: 1,
          title: 1,
          artist: 1,
          album: 1,
          cover: 1,
          audioUrl: 1,
          duration: 1,
          genre: 1,
          source: 1,
          isQuran: 1,
          addedBy: 1,
          youtubeId: 1,
          lyricsVerified: 1,
          isVerifiedLyrics: 1,
          color: 1,
          hasLyrics: { $gt: [{ $size: { $ifNull: ['$lyrics', []] } }, 0] }
        }
      }
    ]);

    const { validLikedIds, extraTracks } = await syncUserLikedTracks(user, allTracks);
    const validLikedSet = new Set(validLikedIds.map(String));

    const formatted = allTracks.map(t => {
      const tid = String(t._id);
      const isLk = validLikedSet.has(tid) || (t.id && validLikedSet.has(String(t.id))) || (t.youtubeId && validLikedSet.has(String(t.youtubeId)));
      return {
        id: tid,
        _id: tid,
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
        hasLyrics: Boolean(t.hasLyrics),
        lyricsVerified: Boolean(t.lyricsVerified || t.isVerifiedLyrics),
        color: t.color || '#1DB954',
        liked: isLk,
      };
    });

    // Merge any newly resolved liked tracks
    for (const xt of extraTracks) {
      if (!formatted.some(t => String(t.id || t._id) === String(xt.id || xt._id))) {
        formatted.unshift({
          ...xt,
          color: '#1DB954',
          liked: true
        });
      }
    }

    let userPlaylists = user.playlists || [];
    if (!userPlaylists.some(p => p.isLikedSongs || p.id === 'liked' || p.name === 'Liked Songs')) {
      userPlaylists = [
        { id: 'liked', name: 'Liked Songs', trackIds: validLikedIds.map(String), isLikedSongs: true, isPublic: false },
        ...userPlaylists
      ];
    } else {
      userPlaylists = userPlaylists.map(p => {
        if (p.isLikedSongs || p.id === 'liked' || p.name === 'Liked Songs') {
          return { ...p, trackIds: validLikedIds.map(String) };
        }
        return p;
      });
    }

    res.json({
      success: true,
      user: { ...user, likedTrackIds: validLikedIds },
      tracks: formatted,
      playlists: userPlaylists.map(p => ({
        ...p,
        isQuran: Boolean(p.isQuran || isQuranContent(p.name, '', '', '', p.description))
      })),
      likedTrackIds: validLikedIds,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Proxy Audio API with SSRF protection and client disconnect abort
app.get('/api/proxy-audio', async (req, res) => {
  const abortController = new AbortController();
  let upstreamStream = null;

  const cleanupStream = () => {
    try {
      abortController.abort();
      if (upstreamStream && typeof upstreamStream.destroy === 'function') {
        upstreamStream.destroy();
      }
    } catch {}
  };

  req.on('close', () => {
    if (!res.writableEnded) cleanupStream();
  });
  res.on('close', () => {
    if (!res.writableEnded) cleanupStream();
  });
  res.on('error', cleanupStream);

  try {
    const rawUrl = req.query.url;
    if (!rawUrl || typeof rawUrl !== 'string') return res.status(400).end();

    const safeUrl = await validateSafeUrl(rawUrl);
    if (!safeUrl || !safeUrl.valid) {
      return res.status(403).json({ error: safeUrl?.error || 'Access to this URL is blocked (SSRF Protection)' });
    }

    const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' };
    if (req.headers.range) headers['Range'] = req.headers.range;

    const r = await axios({
      method: 'get',
      url: safeUrl.parsed.href,
      responseType: 'stream',
      headers,
      signal: abortController.signal,
      timeout: 25000,
      maxRedirects: 0,
      validateStatus: (status) => status < 400
    });

    upstreamStream = r.data;
    upstreamStream.on('error', () => {
      cleanupStream();
      if (!res.headersSent) res.status(500).end();
    });

    const clientOrigin = req.headers.origin;
    if (clientOrigin) {
      corsOriginHandler(clientOrigin, (err, allowed) => {
        if (!err && allowed) {
          res.setHeader('Access-Control-Allow-Origin', clientOrigin);
          res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
      });
    }

    res.set({
      'Content-Type': r.headers['content-type'] || 'audio/mpeg',
      'Accept-Ranges': 'bytes'
    });
    if (r.headers['content-length']) res.set('Content-Length', r.headers['content-length']);
    if (r.headers['content-range']) res.set('Content-Range', r.headers['content-range']);
    res.status(r.status);
    r.data.pipe(res);
  } catch (e) {
    cleanupStream();
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
app.use('/api/recognize', require('./routes/recognize'));
app.use('/api/image-proxy', require('./routes/imageProxy'));



// Fallback SPA routing with fallback search paths and error safety
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads') || req.path.startsWith('/downloads')) return next();
  const candidates = [
    '/home/ubuntu/dist/index.html',
    path.join(__dirname, '../dist/index.html'),
    '/home/ubuntu/rivo/dist/index.html'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return res.sendFile(c, (err) => {
        if (err && !res.headersSent) {
          next(err);
        }
      });
    }
  }
  res.status(503).send('Application bundle is currently syncing. Please refresh in a moment.');
});

// Global Express error handler to prevent 502/crashes on ENOENT
app.use((err, req, res, next) => {
  if (err && err.code === 'ENOENT') {
    return res.status(404).send('Resource not found');
  }
  console.error('[Express Error]', err);
  if (!res.headersSent) {
    res.status(500).send('Internal Server Error');
  }
});

// Socket.IO
require('./sockets')(io, {
  BETA_VERSIONS_DATA,
  APP_VERSIONS_DATA,
  isBetaTester,
  BETA_TESTER_EMAILS,
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Rivo Server running on port ${PORT}`);
  ensureYtDlpBinary().then(() => {
    try { initWarmYtWorker(); } catch {}
  }).catch((err) => console.warn('[yt-dlp] startup check notice:', err.message));
  try { scheduleCloudCacheWarmup(); } catch {}
});

module.exports = { app, server, io };
