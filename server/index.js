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
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const { Server } = require('socket.io');

const { User, Track, Album } = require('./models');
const { auth, adminAuth, optionalAuth } = require('./middleware/auth');
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

// Authorized Beta Testing Accounts & Admins
const BETA_TESTER_EMAILS = new Set([
  'whooareyou152@gmail.com',
  'alicrafter85@gmail.com',
  'test@liofy.com',
  'lio@gmail.com',
  'test1@gmail.com',
  'test@gmail.com',
  't1@gmail.com',
  'rio288631@gmail.com'
]);

function isBetaTester(user) {
  if (!user) return false;
  if (user.role === 'admin' || user.isAdmin === true) return true;
  const email = (user.email || '').trim().toLowerCase();
  if (email && BETA_TESTER_EMAILS.has(email)) return true;
  return false;
}

// App Version Manifest — STABLE Channel (Default for normal users)
const APP_VERSIONS_DATA = {
  publishedAt: new Date().toISOString(),
  channel: 'stable',
  platforms: {
    web: {
      version: '1.9.7.4',
      name: 'Rivo Web',
      notes: 'Web browser release with hi-fi streaming, responsive design, and enhanced lyrics sync.'
    },
    windows: {
      version: '1.9.7.4',
      name: 'Rivo Desktop for Windows (EXE)',
      downloadUrl: 'https://github.com/WhooAre-you/Rivo/releases/download/v1.9.3/Rivo_Setup.exe',
      directFile: 'Rivo_Setup.exe',
      mandatory: false,
      notes: 'Native Windows desktop release with in-place auto-updater, smooth lyrics scrolling, and zero network lag.'
    },
    android: {
      version: '1.9.7.4',
      build: 69,
      name: 'Rivo for Android (APK)',
      downloadUrl: 'https://github.com/WhooAre-you/Rivo/releases/download/v1.9.3/Rivo-v1.9.3.apk',
      directFile: 'Rivo-v1.9.3.apk',
      mandatory: false,
      notes: 'Offline folder import full metadata & lyrics extraction, and 60fps buttery-smooth queue dragging.'
    },
    ios: {
      version: '1.9.3',
      build: 63,
      name: 'Rivo for iOS (IPA)',
      downloadUrl: 'https://github.com/WhooAre-you/Rivo/releases/download/v1.9.3/Rivo-v1.9.3.ipa',
      directFile: 'Rivo-v1.9.3.ipa',
      mandatory: false,
      notes: 'Offline folder import full metadata & lyrics extraction, and 60fps buttery-smooth queue dragging.'
    }
  }
};

// Known beta tester IPs for instant cold-boot detection
const knownBetaIps = new Set(['41.47.189.60']);

// App Version Manifest — BETA Channel (For designated testers & admins only)
const BETA_VERSIONS_DATA = {
  publishedAt: new Date().toISOString(),
  channel: 'stable', // Intentionally 'stable' so client-side cold-boot gate doesn't reject it
  platforms: {
    web: {
      version: '1.9.7.4',
      name: 'Rivo Web (Beta)',
      notes: 'Preview build with test features and latest optimisations.'
    },
    windows: {
      version: '1.9.7.4',
      name: 'Rivo Desktop for Windows (Beta)',
      downloadUrl: 'https://github.com/WhooAre-you/Rivo/releases/download/v1.9.6/Rivo_Setup.exe',
      directFile: 'Rivo_Setup.exe',
      mandatory: false,
      notes: 'Beta v1.9.7: Security patches, in-place self-updater, and offline player enhancements.'
    },
    android: {
      version: '1.9.7.4',
      build: 69,
      name: 'Rivo for Android (Beta Testing)',
      downloadUrl: 'https://rivo-m.duckdns.org/downloads/Rivo-v1.9.7.apk',
      directFile: 'Rivo-v1.9.7.apk',
      mandatory: false,
      notes: 'Fix crash during downloads • Instant smooth audio playback • 8 security fixes • OTA engine fixes',
      notesEn: 'Fix crash during downloads • Instant smooth audio playback • 8 security fixes • OTA engine fixes',
      ota: {
        enabled: true,
        version: '1.9.7.4',
        bundleUrl: 'https://rivo-m.duckdns.org/downloads/ota/index.android.bundle',
        minAppVersion: '1.9.0',
        notes: 'Fast update • White branding logo • Auto-exit restart • High performance',
        notesEn: 'Fast update • White branding logo • Auto-exit restart • High performance'
      }
    },
    ios: {
      version: '1.9.6',
      build: 65,
      name: 'Rivo for iOS (Beta Testing)',
      downloadUrl: 'https://github.com/WhooAre-you/Rivo/releases/download/v1.9.6/Rivo-v1.9.6.ipa',
      directFile: 'Rivo-v1.9.6.ipa',
      mandatory: false,
      notes: 'Beta v1.9.6: Unsigned IPA build with automatic installer cache cleaner and offline player stability.'
    }
  }
};

// Helper to read dynamic OTA manifest if present
const getOtaManifest = () => {
  try {
    const otaFile = path.join(__dirname, 'ota-manifest.json');
    if (fs.existsSync(otaFile)) {
      return JSON.parse(fs.readFileSync(otaFile, 'utf8'));
    }
  } catch (e) {}
  return null;
};

// Dual-channel version check endpoint
app.get('/api/app/version', optionalAuth, (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const clientIp = req.ip || req.connection?.remoteAddress || '';
  const cleanIp = clientIp.replace(/^.*:/, '');
  const isLoopback = cleanIp === '127.0.0.1' || cleanIp === '1' || cleanIp === '::1';
  const reqEmail = (req.query.email || req.user?.email || '').trim().toLowerCase();
  const reqChannel = (req.query.channel || '').trim().toLowerCase();
  const clientVersion = (req.query.currentVersion || req.headers['x-app-version'] || '').trim();

  const isBetaTesterUser = isBetaTester(req.user) || (reqEmail && BETA_TESTER_EMAILS.has(reqEmail));
  if (isBetaTesterUser && cleanIp && !isLoopback) {
    knownBetaIps.add(cleanIp);
  }

  const isBetaClient = (clientVersion && (clientVersion.startsWith('1.9.6') || clientVersion.startsWith('1.9.7'))) || reqChannel === 'beta' || (!isLoopback && knownBetaIps.has(cleanIp)) || isBetaTesterUser;

  const manifest = isBetaClient
    ? JSON.parse(JSON.stringify(BETA_VERSIONS_DATA))
    : JSON.parse(JSON.stringify(APP_VERSIONS_DATA));

  const dynamicOta = getOtaManifest();
  if (dynamicOta && dynamicOta.enabled && manifest.platforms?.android) {
    manifest.platforms.android.ota = {
      ...(manifest.platforms.android.ota || {}),
      ...dynamicOta,
      bundleUrl: dynamicOta.bundleUrl?.startsWith('http') ? dynamicOta.bundleUrl : `https://rivo-m.duckdns.org${dynamicOta.bundleUrl}`,
      minAppVersion: dynamicOta.minAppVersion || '1.9.0'
    };
  }

  res.json(manifest);
});

// Dynamic OTA bundle download route
app.get(['/downloads/ota/:filename', '/api/downloads/ota/:filename'], (req, res) => {
  const filename = path.basename(req.params.filename);
  const otaFile = path.join(__dirname, '../public/downloads/ota', filename);
  if (fs.existsSync(otaFile)) {
    res.setHeader('Content-Type', 'application/javascript');
    return res.sendFile(otaFile);
  }
  return res.status(404).json({ error: 'OTA bundle not found' });
});

// Dynamic download routes for Windows EXE, Android APK, and iOS IPA releases
app.get(['/downloads/:filename', '/api/downloads/:filename'], async (req, res) => {
  const filename = path.basename(req.params.filename);
  const localFile = path.join(__dirname, '../public/downloads', filename);

  // 1. Serve local file if already present in public/downloads
  if (fs.existsSync(localFile)) {
    return res.download(localFile, filename);
  }

  // 2. Specific version redirect if filename specifies a version (e.g. Rivo-v1.9.6.apk)
  const vMatch = filename.match(/Rivo-v([0-9.]+)\.(apk|ipa|exe)/i);
  if (vMatch) {
    const requestedVersion = vMatch[1];
    return res.redirect(`https://github.com/WhooAre-you/Rivo/releases/download/v${requestedVersion}/${filename}`);
  }

  const ver = APP_VERSIONS_DATA.platforms.android.version || '1.9.3';

  // 3. Fallback redirect to latest GitHub Release based on file extension
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

// Secure Webhook for automated deployment on GitHub push
const DEPLOY_SECRET = process.env.DEPLOY_SECRET;
let isDeploying = false;

app.post('/api/deploy-webhook', (req, res) => {
  if (!DEPLOY_SECRET) {
    return res.status(503).json({ error: 'Deployment webhook is not configured on this server.' });
  }

  const secret = req.headers['x-webhook-secret'] || req.body?.secret;
  if (!secret || typeof secret !== 'string') {
    return res.status(403).json({ error: 'Unauthorized: Missing or invalid deploy secret header/body' });
  }

  const userHash = crypto.createHash('sha256').update(String(secret)).digest();
  const serverHash = crypto.createHash('sha256').update(String(DEPLOY_SECRET)).digest();

  if (!crypto.timingSafeEqual(userHash, serverHash)) {
    return res.status(403).json({ error: 'Unauthorized: Invalid deploy secret' });
  }

  if (isDeploying) {
    return res.status(429).json({ message: 'Deployment already in progress' });
  }

  isDeploying = true;
  res.json({ success: true, message: 'Deployment started in background' });

  const { exec } = require('child_process');
  const projectRoot = path.join(__dirname, '..');
  const nodeBinDir = path.dirname(process.execPath);
  const fullPath = `${nodeBinDir}:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`;

  const deployCmd = 'git fetch origin main && git reset --hard origin/main && npm install --legacy-peer-deps && npm run build';

  console.log('[DeployWebhook] Starting auto-deployment with bash...');
  exec(deployCmd, { 
    cwd: projectRoot, 
    timeout: 300000, 
    shell: '/bin/bash',
    env: { ...process.env, PATH: fullPath }
  }, (error, stdout, stderr) => {
    isDeploying = false;
    if (error) {
      console.error('[DeployWebhook] Execution error:', error);
      console.error('[DeployWebhook] Stderr:', stderr);
      return;
    }
    console.log('[DeployWebhook] Deployment finished successfully! Respawning PM2 process...');
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  });
});

console.log('🚀 Rivo Server v1.9.3 (Auto-Deploy Enabled)');

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
require('./sockets')(io, {
  BETA_VERSIONS_DATA,
  APP_VERSIONS_DATA,
  isBetaTester,
  BETA_TESTER_EMAILS,
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Rivo Server running on port ${PORT}`);
  ensureYtDlpBinary().catch((err) => console.warn('[yt-dlp] startup check notice:', err.message));
});

module.exports = { app, server, io };
