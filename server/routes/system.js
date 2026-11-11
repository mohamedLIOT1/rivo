/**
 * System Versioning, Dynamic OTA/Releases Downloads & Deployment Webhooks
 * Strictly modularized (< 400 lines).
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { adminAuth, optionalAuth } = require('../middleware/auth');

// Authorized Beta Testing Accounts & Admins
const defaultBetaEmails = [
  'whooareyou152@gmail.com',
  'alicrafter85@gmail.com',
  'test@liofy.com',
  'lio@gmail.com',
  'test1@gmail.com',
  'test@gmail.com',
  't1@gmail.com',
  'rio288631@gmail.com'
];
const envBetaEmails = process.env.BETA_TESTER_EMAILS
  ? process.env.BETA_TESTER_EMAILS.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  : defaultBetaEmails;
const BETA_TESTER_EMAILS = new Set(envBetaEmails);

function isBetaTester(user) {
  if (!user) return false;
  if (user.role === 'admin' || user.isAdmin === true) return true;
  const email = (user.email || '').trim().toLowerCase();
  if (email && BETA_TESTER_EMAILS.has(email)) return true;
  return false;
}

// App Version Manifest — STABLE Channel
const APP_VERSIONS_DATA = {
  publishedAt: new Date().toISOString(),
  channel: 'stable',
  platforms: {
    web: {
      version: '2.4.11',
      name: 'Rivo Web',
      notes: 'تحديث v2.4.11 • استرجاع التشغيل بعد قفل الشاشة والتنزيل التلقائي واستقرار الأداء.'
    },
    windows: {
      version: '2.4.11',
      displayVersion: '2.4.11',
      name: 'Rivo Desktop for Windows (EXE)',
      downloadUrl: 'https://rivo-m.duckdns.org/downloads/Rivo.exe',
      directFile: 'Rivo-v2.4.11.exe',
      mandatory: false,
      notes: 'تحديث v2.4.11 • استرجاع التشغيل بعد قفل الشاشة والتنزيل التلقائي واستقرار الأداء.'
    },
    android: {
      version: '2.4.11',
      build: 141,
      name: 'Rivo for Android (APK)',
      downloadUrl: 'https://rivo-m.duckdns.org/downloads/Rivo.apk',
      directFile: 'Rivo-v2.4.11.apk',
      mandatory: false,
      notes: 'تحديث v2.4.11 • استرجاع التشغيل عند العودة من قفل الشاشة وتحسين طابور التنزيل التلقائي.',
      notesEn: 'Update v2.4.11 • Lock-screen playback recovery, reliable background downloads queue, and performance fixes.',
      ota: {
        enabled: true,
        version: '2.4.21',
        bundleUrl: 'https://rivo-m.duckdns.org/downloads/ota/index.android.bundle',
        minAppVersion: '1.0.0',
        notes: 'تحديث هوائي فوري v2.4.21 • إصلاح التشغيل بعد قفل الشاشة والتنزيل التلقائي',
        notesEn: 'Instant OTA update v2.4.21 • Fix lock-screen playback recovery and reliable auto-downloads.',
        bundleSize: 5205050,
        sizeMb: '4.96 MB'
      }
    },
    ios: {
      version: '2.4.11',
      build: 141,
      name: 'Rivo for iOS (IPA)',
      downloadUrl: 'https://rivo-m.duckdns.org/downloads/Rivo.ipa',
      directFile: 'Rivo-v2.4.11.ipa',
      mandatory: false,
      notes: 'تحديث v2.4.11 • استرجاع التشغيل عند العودة من قفل الشاشة وتحسين طابور التنزيل التلقائي واستقرار النظام.'
    }
  }
};

const envBetaIps = process.env.BETA_TESTER_IPS
  ? process.env.BETA_TESTER_IPS.split(',').map(ip => ip.trim()).filter(Boolean)
  : ['41.47.189.60'];
const knownBetaIps = new Set(envBetaIps);

// App Version Manifest — BETA Channel
const BETA_VERSIONS_DATA = {
  publishedAt: new Date().toISOString(),
  channel: 'stable',
  platforms: {
    web: {
      version: '2.4.11',
      name: 'Rivo Web (Beta)',
      notes: 'تحديث v2.4.11 • استرجاع التشغيل بعد قفل الشاشة والتنزيل التلقائي.'
    },
    windows: {
      version: '2.4.11',
      displayVersion: '2.4.11',
      name: 'Rivo Desktop for Windows (Beta)',
      downloadUrl: 'https://rivo-m.duckdns.org/downloads/Rivo.exe',
      directFile: 'Rivo-v2.4.11.exe',
      mandatory: false,
      notes: 'تحديث v2.4.11 • استرجاع التشغيل بعد قفل الشاشة والتنزيل التلقائي.'
    },
    android: {
      version: '2.4.11',
      build: 141,
      name: 'Rivo for Android (Beta Testing)',
      downloadUrl: 'https://rivo-m.duckdns.org/downloads/Rivo.apk',
      directFile: 'Rivo-v2.4.11.apk',
      mandatory: false,
      notes: 'تحديث v2.4.11 • استرجاع التشغيل عند العودة من قفل الشاشة وتحسين طابور التنزيل التلقائي.',
      notesEn: 'Update v2.4.11 • Lock-screen playback recovery, reliable background downloads queue, and sync fixes.',
      ota: {
        enabled: true,
        version: '2.4.21',
        bundleUrl: 'https://rivo-m.duckdns.org/downloads/ota/index.android.bundle',
        minAppVersion: '1.0.0',
        notes: 'تحديث هوائي فوري v2.4.21 • إصلاح التشغيل بعد قفل الشاشة والتنزيل التلقائي',
        notesEn: 'Instant OTA update v2.4.21 • Fix lock-screen playback recovery and reliable auto-downloads.',
        bundleSize: 5205050,
        sizeMb: '4.96 MB'
      }
    },
    ios: {
      version: '2.4.11',
      build: 141,
      name: 'Rivo for iOS (Beta Testing)',
      downloadUrl: 'https://rivo-m.duckdns.org/downloads/Rivo.ipa',
      directFile: 'Rivo-v2.4.11.ipa',
      mandatory: false,
      notes: 'تحديث v2.4.11 • استرجاع التشغيل عند العودة من قفل الشاشة وتحسين طابور التنزيل التلقائي واستقرار النظام.'
    }
  }
};

const getOtaManifest = () => {
  try {
    const otaFile = path.join(__dirname, '../ota-manifest.json');
    if (fs.existsSync(otaFile)) {
      const manifest = JSON.parse(fs.readFileSync(otaFile, 'utf8'));
      if (manifest && (!manifest.sizeMb || !manifest.bundleSize)) {
        const bundlePath = path.join(__dirname, '../../public/downloads/ota/index.android.bundle');
        if (fs.existsSync(bundlePath)) {
          const stat = fs.statSync(bundlePath);
          if (!manifest.bundleSize) manifest.bundleSize = stat.size;
          if (!manifest.sizeMb) manifest.sizeMb = `${(stat.size / 1048576).toFixed(2)} MB`;
        }
      }
      return manifest;
    }
  } catch (e) {}
  return null;
};

// Dual-channel version check endpoint
router.get('/api/app/version', optionalAuth, (req, res) => {
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

  const isBetaClient = (clientVersion && (clientVersion.startsWith('1.9.6') || clientVersion.startsWith('1.9.7') || clientVersion.startsWith('1.9.8') || clientVersion.startsWith('1.9.9'))) || reqChannel === 'beta' || (!isLoopback && knownBetaIps.has(cleanIp)) || isBetaTesterUser;

  const manifest = isBetaClient
    ? JSON.parse(JSON.stringify(BETA_VERSIONS_DATA))
    : JSON.parse(JSON.stringify(APP_VERSIONS_DATA));

  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
    if (pkg && pkg.version) {
      if (manifest.platforms && manifest.platforms.web) manifest.platforms.web.version = pkg.version;
      if (manifest.platforms && manifest.platforms.windows) {
        manifest.platforms.windows.displayVersion = pkg.version;
        manifest.platforms.windows.version = '2.2.5';
        manifest.platforms.windows.directFile = `Rivo-v${pkg.version}.exe`;
      }
      if (manifest.platforms && manifest.platforms.android) {
        manifest.platforms.android.version = pkg.version;
        manifest.platforms.android.directFile = `Rivo-v${pkg.version}.apk`;
      }
      if (manifest.platforms && manifest.platforms.ios) {
        manifest.platforms.ios.version = pkg.version;
        manifest.platforms.ios.directFile = `Rivo-v${pkg.version}.ipa`;
        manifest.platforms.ios.downloadUrl = `https://rivo-m.duckdns.org/downloads/Rivo.ipa`;
      }
    }
  } catch (e) {}

  try {
    const downloadsDir = path.join(__dirname, '../../public/downloads');
    const calcSize = (filename) => {
      const p = path.join(downloadsDir, filename);
      if (fs.existsSync(p)) {
        const bytes = fs.statSync(p).size;
        const mb = bytes / (1024 * 1024);
        return mb >= 10 ? `${mb.toFixed(1)} MB` : `${mb.toFixed(2)} MB`;
      }
      return null;
    };
    if (manifest.platforms?.windows) {
      const sz = calcSize(manifest.platforms.windows.directFile) || calcSize('Rivo.exe') || calcSize('Rivo_Setup.exe');
      if (sz) manifest.platforms.windows.fileSize = sz;
    }
    if (manifest.platforms?.android) {
      const sz = calcSize(manifest.platforms.android.directFile) || calcSize('Rivo.apk');
      if (sz) manifest.platforms.android.fileSize = sz;
    }
    if (manifest.platforms?.ios) {
      const sz = calcSize(manifest.platforms.ios.directFile) || calcSize('Rivo.ipa');
      if (sz) manifest.platforms.ios.fileSize = sz;
    }
  } catch (e) {}

  const dynamicOta = getOtaManifest();
  if (dynamicOta && dynamicOta.enabled && manifest.platforms?.android) {
    if (dynamicOta.version) {
      manifest.platforms.android.version = dynamicOta.version;
    }
    manifest.platforms.android.ota = {
      ...(manifest.platforms.android.ota || {}),
      ...dynamicOta,
      bundleUrl: dynamicOta.bundleUrl?.startsWith('http') ? dynamicOta.bundleUrl : `https://rivo-m.duckdns.org${dynamicOta.bundleUrl}`,
      minAppVersion: dynamicOta.minAppVersion || '1.0.0'
    };
  }

  res.json(manifest);
});

// Dedicated OTA update endpoint
router.get('/api/app/ota', optionalAuth, (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const dynamicOta = getOtaManifest();
  if (!dynamicOta || dynamicOta.enabled === false) {
    return res.status(404).json({ error: 'OTA update not available' });
  }

  res.json({
    enabled: true,
    version: dynamicOta.version || '2.4.1',
    bundleUrl: dynamicOta.bundleUrl?.startsWith('http')
      ? dynamicOta.bundleUrl
      : `https://rivo-m.duckdns.org${dynamicOta.bundleUrl || '/downloads/ota/index.android.bundle'}`,
    minAppVersion: dynamicOta.minAppVersion || '1.0.0',
    notes: dynamicOta.notes || 'تحديث هوائي فوري v2.4.1 • أحدث التحسينات والإصلاحات',
    notesEn: dynamicOta.notesEn || 'Instant OTA update v2.4.1 • Smart Queue & performance fixes',
    bundleSize: dynamicOta.bundleSize || 4807809,
    sizeMb: dynamicOta.sizeMb || '4.59 MB',
    updatedAt: dynamicOta.updatedAt || new Date().toISOString()
  });
});

// Dynamic OTA bundle download route
router.get(['/downloads/ota/:filename', '/api/downloads/ota/:filename'], (req, res) => {
  const filename = path.basename(req.params.filename);
  const otaFile = path.join(__dirname, '../../public/downloads/ota', filename);
  if (fs.existsSync(otaFile)) {
    res.setHeader('Content-Type', 'application/javascript');
    return res.sendFile(otaFile);
  }
  return res.status(404).json({ error: 'OTA bundle not found' });
});

// Dedicated handler for Windows Desktop EXE downloads & transparent version fallback
router.get(['/downloads/Rivo*.exe', '/downloads/Rivo-v*.exe', '/api/downloads/Rivo*.exe', '/api/downloads/Rivo-v*.exe'], (req, res) => {
  const reqFilename = path.basename(req.path);
  const candidatePaths = [
    path.join(__dirname, '../../public/downloads', reqFilename),
    path.join(__dirname, '../../dist/downloads', reqFilename),
    path.join('/home/ubuntu/rivo/public/downloads', reqFilename),
    path.join('/home/ubuntu/dist/downloads', reqFilename)
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      res.setHeader('Content-Disposition', `attachment; filename="${reqFilename}"`);
      res.setHeader('Content-Type', 'application/octet-stream');
      return res.sendFile(path.resolve(p));
    }
  }

  // Fallback transparently to Rivo.exe — NEVER return 404 or text for an .exe request!
  const fallbackPaths = [
    path.join(__dirname, '../../public/downloads/Rivo.exe'),
    path.join(__dirname, '../../dist/downloads/Rivo.exe'),
    path.join('/home/ubuntu/rivo/public/downloads/Rivo.exe'),
    path.join('/home/ubuntu/dist/downloads/Rivo.exe'),
    path.join(__dirname, '../../public/downloads/Rivo_Setup.exe')
  ];

  for (const fb of fallbackPaths) {
    if (fs.existsSync(fb)) {
      res.setHeader('Content-Disposition', 'attachment; filename="Rivo.exe"');
      res.setHeader('Content-Type', 'application/octet-stream');
      return res.sendFile(path.resolve(fb));
    }
  }

  // Header protection against 404 text download
  res.setHeader('Content-Disposition', 'attachment; filename="Rivo.exe"');
  res.setHeader('Content-Type', 'application/octet-stream');
  return res.redirect('/downloads/Rivo.exe');
});

// Dynamic download routes
router.get(['/downloads/:filename', '/api/downloads/:filename'], async (req, res) => {
  const filename = path.basename(req.params.filename);
  const localFile = path.join(__dirname, '../../public/downloads', filename);

  if (fs.existsSync(localFile)) {
    return res.download(localFile, filename);
  }

  // Fallback for any requested .exe — NEVER return 404 or text for .exe!
  if (filename.toLowerCase().endsWith('.exe')) {
    const mainExe = path.join(__dirname, '../../public/downloads/Rivo.exe');
    const altExe = path.join(__dirname, '../../public/downloads/Rivo_Setup.exe');
    const target = fs.existsSync(mainExe) ? mainExe : (fs.existsSync(altExe) ? altExe : null);
    if (target) {
      res.setHeader('Content-Disposition', 'attachment; filename="Rivo.exe"');
      res.setHeader('Content-Type', 'application/octet-stream');
      return res.sendFile(path.resolve(target));
    }
    res.setHeader('Content-Disposition', 'attachment; filename="Rivo.exe"');
    res.setHeader('Content-Type', 'application/octet-stream');
    return res.redirect('https://rivo-m.duckdns.org/downloads/Rivo.exe');
  }

  if (filename.toLowerCase().endsWith('.apk')) {
    const mainApk = path.join(__dirname, '../../public/downloads/Rivo.apk');
    if (fs.existsSync(mainApk)) return res.download(mainApk, filename);
  }

  if (filename.toLowerCase().endsWith('.ipa')) {
    const mainIpa = path.join(__dirname, '../../public/downloads/Rivo.ipa');
    if (fs.existsSync(mainIpa)) return res.download(mainIpa, filename);
  }

  const vMatch = filename.match(/Rivo-v([0-9.]+)\.(apk|ipa)/i);
  if (vMatch) {
    const requestedVersion = vMatch[1];
    return res.redirect(`https://github.com/mohamedLIOT1/rivo/releases/download/v${requestedVersion}/${filename}`);
  }

  if (filename.endsWith('.apk')) return res.redirect(`https://rivo-m.duckdns.org/downloads/Rivo.apk`);
  if (filename.endsWith('.ipa')) return res.redirect(`https://rivo-m.duckdns.org/downloads/Rivo.ipa`);

  return res.status(404).json({ error: 'File not found' });
});

// Secure Webhook for automated deployment on GitHub push
const DEPLOY_SECRET = process.env.DEPLOY_SECRET || "rivo-deploy-sec-2026";
let isDeploying = false;
let deployStartedAt = 0;

router.post('/api/deploy-webhook', (req, res) => {
  if (!DEPLOY_SECRET) {
    return res.status(503).json({ error: 'Deployment webhook is disabled. Set DEPLOY_SECRET in .env to enable.' });
  }

  const secret = req.headers['x-webhook-secret'] || req.body?.secret || req.query?.secret;
  if (!secret || typeof secret !== 'string') {
    return res.status(403).json({ error: 'Unauthorized: Missing or invalid deploy secret header/body' });
  }

  const userHash = crypto.createHash('sha256').update(String(secret)).digest();
  const serverHash = crypto.createHash('sha256').update(String(DEPLOY_SECRET)).digest();

  if (!crypto.timingSafeEqual(userHash, serverHash)) {
    return res.status(403).json({ error: 'Unauthorized: Invalid deploy secret' });
  }

  if (isDeploying && Date.now() - deployStartedAt < 120000) {
    return res.status(429).json({ message: 'Deployment already in progress' });
  }

  isDeploying = true;
  deployStartedAt = Date.now();
  res.json({ success: true, message: 'Deployment started in background' });

  const { exec } = require('child_process');
  const projectRoot = path.join(__dirname, '../..');
  const nodeBinDir = path.dirname(process.execPath);
  const fullPath = `${nodeBinDir}:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`;

  const deployCmd = [
    'git config --global --add safe.directory "*" 2>/dev/null || true',
    'if [ -d /home/ubuntu/.git ]; then cd /home/ubuntu && (git remote set-url origin https://github.com/mohamedLIOT1/rivo.git 2>/dev/null || true) && git fetch origin main --force && git reset --hard origin/main && if [ -d /home/ubuntu/rivo ] && [ ! /home/ubuntu -ef /home/ubuntu/rivo ]; then cp -rf src server public package.json vite.config.js index.html /home/ubuntu/rivo/ 2>/dev/null || true; cp -a cookies.txt /home/ubuntu/rivo/cookies.txt 2>/dev/null || true; fi; fi',
    `cd "${projectRoot}" && if [ -d .git ]; then (git remote set-url origin https://github.com/mohamedLIOT1/rivo.git 2>/dev/null || true) && git fetch origin main --force && git reset --hard origin/main; fi`,
    'if curl -fsSL -L "https://github.com/mohamedLIOT1/rivo/releases/download/web-latest/web-dist.tar.gz" -o /tmp/web-dist.tar.gz && [ -s /tmp/web-dist.tar.gz ]; then mkdir -p /home/ubuntu/dist /home/ubuntu/rivo/dist && rm -rf /home/ubuntu/dist/assets /home/ubuntu/rivo/dist/assets && tar -xzf /tmp/web-dist.tar.gz -C /home/ubuntu/dist && tar -xzf /tmp/web-dist.tar.gz -C /home/ubuntu/rivo/dist && (tar -xzf /tmp/web-dist.tar.gz -C /var/www/html 2>/dev/null || sudo -n tar -xzf /tmp/web-dist.tar.gz -C /var/www/html 2>/dev/null || true) && rm -f /tmp/web-dist.tar.gz; fi'
  ].join(' ; ');

  console.log('[DeployWebhook] Starting auto-deployment with bash...');
  exec(deployCmd, { 
    cwd: projectRoot, 
    timeout: 90000,
    killSignal: 'SIGKILL',
    shell: '/bin/bash',
    env: { ...process.env, PATH: fullPath }
  }, (error, stdout, stderr) => {
    isDeploying = false;
    if (error) {
      console.error('[DeployWebhook] Execution error:', error);
      console.error('[DeployWebhook] Stderr:', stderr);
    } else {
      console.log('[DeployWebhook] Deployment finished successfully!');
    }
    console.log('[DeployWebhook] Respawning PM2 process...');
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  });
});

// Broadcast app update notification (Admin Only)
router.post('/api/app/broadcast-update', adminAuth, (req, res) => {
  if (req.io) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
      const manifest = JSON.parse(JSON.stringify(APP_VERSIONS_DATA));
      if (manifest.platforms?.android) manifest.platforms.android.version = pkg.version;
      if (manifest.platforms?.ios) manifest.platforms.ios.version = pkg.version;
      const dynamicOta = getOtaManifest();
      if (dynamicOta && dynamicOta.enabled && manifest.platforms?.android) {
        if (dynamicOta.version) manifest.platforms.android.version = dynamicOta.version;
        manifest.platforms.android.ota = {
          ...(manifest.platforms.android.ota || {}),
          ...dynamicOta,
          bundleUrl: dynamicOta.bundleUrl?.startsWith('http') ? dynamicOta.bundleUrl : `https://rivo-m.duckdns.org${dynamicOta.bundleUrl}`,
          minAppVersion: dynamicOta.minAppVersion || '1.0.0'
        };
      }
      req.io.emit('app:update_manifest', manifest);
      req.io.emit('app:update_available', manifest);
    } catch {}
  }
  res.json({ success: true, message: 'Update notification broadcasted to all connected clients', data: APP_VERSIONS_DATA });
});

module.exports = {
  router,
  APP_VERSIONS_DATA,
  BETA_VERSIONS_DATA,
  BETA_TESTER_EMAILS,
  isBetaTester,
  getOtaManifest
};
