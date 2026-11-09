const crypto = require('crypto');
const { RichPresence, Client: SelfClient } = require('discord.js-selfbot-v13');

const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'rivo-music-secret-key-default-2024';
const DISCORD_APP_ID = process.env.DISCORD_CLIENT_ID || '1440997674630250506';

function encryptToken(text) {
  if (!text) return '';
  const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptToken(text) {
  if (!text) return '';
  if (!text.includes(':')) return null;
  try {
    const key = crypto.createHash('sha256').update(String(ENCRYPTION_KEY)).digest();
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts.slice(1).join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return null;
  }
}

const User = require('./models/User');

let ioInstance = null;
function setIo(io) {
  ioInstance = io;
}

const activeUserBots = new Map();
const userIdleTimers = new Map();
const assetPathCache = new Map();
const RIVO_BASE_URL = 'https://rivo-m.duckdns.org';
const DEFAULT_BADGE_URL = `${RIVO_BASE_URL}/discord-badge.png`;

function getTrackImageUrl(track) {
  if (!track) return null;
  const rawCover = track.cover || track.coverUrl || '';
  if (typeof rawCover === 'string' && rawCover.trim()) {
    let clean = rawCover.trim();
    if (clean.startsWith('//')) clean = 'https:' + clean;
    else if (clean.startsWith('/')) clean = RIVO_BASE_URL + clean;
    else if (clean.startsWith('uploads/')) clean = `${RIVO_BASE_URL}/${clean}`;
    else if (clean.startsWith('http://')) clean = clean.replace(/^http:\/\//i, 'https://');

    const ytMatch = clean.match(/(?:v=|youtu\.be\/|\/vi\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
    if (ytMatch && ytMatch[1] && !clean.includes('i.ytimg.com')) {
      return `https://i.ytimg.com/vi/${ytMatch[1]}/hqdefault.jpg`;
    }
    if (clean.startsWith('https://')) return clean;
  }

  const ytCandidates = [track.youtubeId, track.audioUrl, track.url];
  for (const c of ytCandidates) {
    if (!c || typeof c !== 'string') continue;
    const m = c.match(/(?:v=|youtu\.be\/|\/vi\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
    if (m && m[1]) return `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`;
    const m2 = c.match(/^yt[-_]?([a-zA-Z0-9_-]{11})$/i);
    if (m2 && m2[1]) return `https://i.ytimg.com/vi/${m2[1]}/hqdefault.jpg`;
    if (/^[a-zA-Z0-9_-]{11}$/.test(c.trim()) && !/^[0-9a-fA-F]{24}$/.test(c.trim())) {
      return `https://i.ytimg.com/vi/${c.trim()}/hqdefault.jpg`;
    }
  }
  return DEFAULT_BADGE_URL;
}

async function resolveDiscordAsset(client, imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return null;
  if (imageUrl.startsWith('https://cdn.discordapp.com/') || imageUrl.startsWith('https://media.discordapp.net/')) return imageUrl;
  if (imageUrl.startsWith('external/') || imageUrl.startsWith('mp:')) return imageUrl;
  if (assetPathCache.has(imageUrl)) return assetPathCache.get(imageUrl);
  if (!client || !client.token || !client.api) return null;

  try {
    const res = await RichPresence.getExternal(client, DISCORD_APP_ID, imageUrl);
    if (Array.isArray(res) && res[0]?.external_asset_path) {
      const assetPath = res[0].external_asset_path;
      if (assetPathCache.size >= 3000) {
        assetPathCache.delete(assetPathCache.keys().next().value);
      }
      assetPathCache.set(imageUrl, assetPath);
      return assetPath;
    }
  } catch (err) {
    console.warn(`[Discord Activity] Proxy external asset failed for ${imageUrl}:`, err.message);
  }
  return null;
}

function getActiveSession(userId) {
  if (!userId) return null;
  const session = activeUserBots.get(String(userId));
  if (!session) return null;
  return {
    isPlaying: Boolean(session.isPlaying),
    currentTrack: session.currentTrack || null,
    currentTime: session.currentTime || 0,
    status: session.status,
    lastHeartbeat: session.lastHeartbeat,
    lastStartTs: session.lastStartTs,
    expiresAt: session.expiresAt
  };
}

function isUserActivelyPlaying(userId) {
  if (!userId) return false;
  const uidStr = String(userId);
  const session = activeUserBots.get(uidStr);
  if (!session || !session.currentTrack || !session.isPlaying) return false;
  const now = Date.now();
  const trackDur = Number(session.currentTrack.duration) > 0 ? Number(session.currentTrack.duration) : 240;
  const curSec = Math.max(0, Number(session.currentTime) || 0);
  const fallbackExpiry = (session.lastStartTs || session.lastHeartbeat || now) + (trackDur - curSec + 180) * 1000;
  const expiresAt = session.expiresAt || fallbackExpiry;
  return now < expiresAt;
}

const isUserPlaying = isUserActivelyPlaying;

async function disconnectUserSession(userId) {
  if (!userId) return;
  const uidStr = String(userId);

  if (userIdleTimers.has(uidStr)) {
    clearTimeout(userIdleTimers.get(uidStr));
    userIdleTimers.delete(uidStr);
  }

  const session = activeUserBots.get(uidStr);
  if (session) {
    activeUserBots.delete(uidStr);
    session.isPlaying = false;
    session.currentTrack = null;
    session.status = 'disconnected';
    session.lastHeartbeat = 0;
    session.expiresAt = 0;

    if (session.client) {
      try {
        if (session.client.user) {
          try {
            if (typeof session.client.settings?.setCustomStatus === 'function') {
              await session.client.settings.setCustomStatus(null).catch(() => {});
            }
          } catch (e) {}
          try { session.client.user.setActivity(null); } catch (e) {}
          try { session.client.user.setPresence({ activities: [], status: 'online' }); } catch (e) {}
        }
      } catch (e) {}
      try { session.client.removeAllListeners?.(); } catch (e) {}
      try { session.client.destroy(); } catch (e) {}
    }
  }

  try {
    await User.findByIdAndUpdate(uidStr, {
      $set: { 'currentListening.isPlaying': false, lastActiveAt: new Date() }
    });
  } catch (e) {}

  if (ioInstance) {
    const isOnline = Boolean(ioInstance.sockets?.adapter?.rooms?.get(`user:${uidStr}`)?.size > 0);
    ioInstance.emit('activity:updated', {
      userId: uidStr,
      currentListening: { isPlaying: false },
      isLive: false,
      isOnline
    });
  }
}

async function applyTrackPresence(client, track, currentTime = 0) {
  if (!client || !client.user || !track) return;
  try {
    const appId = DISCORD_APP_ID;
    const curSec = Math.max(0, Number(currentTime) || 0);
    const startTs = Date.now() - Math.round(curSec * 1000);
    const durationSec = track.duration && track.duration > 0 ? Math.round(track.duration) : 0;

    const r = new RichPresence(client)
      .setApplicationId(appId)
      .setType('LISTENING')
      .setName('Rivo')
      .setDetails(track.title || 'Unknown Title')
      .setState(track.artist ? ('by ' + track.artist) : 'Rivo Music')
      .setStartTimestamp(startTs);

    const imageUrl = getTrackImageUrl(track);
    let assetKey = null;
    if (imageUrl) {
      assetKey = await resolveDiscordAsset(client, imageUrl);
      if (!assetKey && imageUrl !== DEFAULT_BADGE_URL) {
        assetKey = await resolveDiscordAsset(client, DEFAULT_BADGE_URL);
      }
    }
    if (assetKey) {
      try {
        const cleanAlbum = (track.album || '').trim();
        const isRealAlbum = cleanAlbum && !/youtube|single|none|unknown|rivo|sound\s*cloud/i.test(cleanAlbum) && cleanAlbum.toLowerCase() !== (track.title || '').trim().toLowerCase();

        r.setAssetsLargeImage(assetKey);
        if (isRealAlbum) {
          r.setAssetsLargeText(cleanAlbum);
        }
      } catch (e) {}
    }

    const effectiveDurationSec = durationSec > 0 ? durationSec : 300;
    r.setEndTimestamp(startTs + effectiveDurationSec * 1000);

    try { r.addButton('Listen on Rivo', 'https://rivo-m.duckdns.org'); } catch (e) {}
    try { await client.user.setActivity(r); } catch (e) {}
  } catch (err) {
    console.warn('[Discord Activity] applyTrackPresence error:', err.message);
  }
}

async function handleUserListening(user, track, isPlaying, currentTime = 0) {
  if (!user || !user._id) return;
  const uidStr = String(user._id);

  if (!user.discord || !user.discord.token || user.discord.enabled === false) {
    if (activeUserBots.has(uidStr)) disconnectUserSession(uidStr);
    return;
  }

  // If stopped or paused: IMMEDIATELY clear Discord Rich Presence and destroy session
  if (!isPlaying || !track) {
    await disconnectUserSession(uidStr);
    return;
  }

  // Calculate remaining track duration + 3-minute grace period (up to 120m, min 60s)
  const trackDuration = Number(track.duration) > 0 ? Number(track.duration) : 240;
  const curSec = Math.max(0, Number(currentTime) || 0);
  const remainingTrackSec = Math.max(0, trackDuration - curSec);
  const graceSec = 180; // 3-minute grace period for backgrounded playback
  const remainingMs = Math.min(120 * 60 * 1000, Math.max(60000, (remainingTrackSec + graceSec) * 1000));
  const now = Date.now();
  const sessionExpiresAt = now + remainingMs;

  // Dynamic idle watchdog: keep presence active for track duration + grace instead of 25s cutoff
  if (userIdleTimers.has(uidStr)) {
    clearTimeout(userIdleTimers.get(uidStr));
    userIdleTimers.delete(uidStr);
  }
  userIdleTimers.set(uidStr, setTimeout(() => {
    disconnectUserSession(uidStr).catch(() => {});
  }, remainingMs));

  const rawToken = decryptToken(user.discord.token);
  if (!rawToken) {
    console.warn(`[Discord Activity] Decryption failed for user ${uidStr}`);
    return;
  }

  let session = activeUserBots.get(uidStr);

  // If already ready, update presence with drift check
  if (session && session.status === 'ready' && session.client && session.client.user) {
    const prevTrackId = session.currentTrack ? String(session.currentTrack.id || session.currentTrack._id || '') : '';
    const newTrackId = track ? String(track.id || track._id || '') : '';
    const prevDuration = session.currentTrack?.duration || 0;
    const newDuration = track?.duration || 0;

    const expectedCurSec = session.lastStartTs ? Math.max(0, (now - session.lastStartTs) / 1000) : 0;
    const driftSec = Math.abs(curSec - expectedCurSec);

    const shouldUpdate =
      prevTrackId !== newTrackId ||
      !session.isPlaying ||
      !session.lastStartTs ||
      Math.abs(prevDuration - newDuration) >= 2 ||
      driftSec >= 3;

    session.lastHeartbeat = now;
    session.currentTrack = track;
    session.currentTime = curSec;
    session.isPlaying = true;
    session.expiresAt = sessionExpiresAt;

    if (shouldUpdate) {
      session.lastStartTs = now - Math.round(curSec * 1000);
      applyTrackPresence(session.client, track, curSec);
    }
    return;
  }

  if (session && session.status === 'connecting') {
    if (now - (session.lastHeartbeat || session.lastStartTs || 0) > 30000) {
      try { session.client?.destroy(); } catch (e) {}
      activeUserBots.delete(uidStr);
    } else {
      session.lastHeartbeat = now;
      session.currentTrack = track;
      session.currentTime = curSec;
      session.isPlaying = true;
      session.lastStartTs = now - Math.round(curSec * 1000);
      session.expiresAt = sessionExpiresAt;
      return;
    }
  }

  try {
    const client = new SelfClient({ checkUpdate: false });
    client.on('error', (err) => {
      console.warn(`[Discord Activity] Client error for user ${uidStr}:`, err?.message || err);
    });
    session = {
      client,
      status: 'connecting',
      currentTrack: track,
      currentTime: curSec,
      isPlaying: true,
      lastStartTs: now - Math.round(curSec * 1000),
      lastHeartbeat: now,
      expiresAt: sessionExpiresAt
    };
    activeUserBots.set(uidStr, session);

    client.on('ready', () => {
      console.log(`[Discord Activity] User ${uidStr} logged in to Discord as: ${client.user.tag}`);
      if (!activeUserBots.has(uidStr) || session.status === 'disconnected' || !session.isPlaying || !session.currentTrack) {
        try {
          client.user.setActivity(null);
          client.user.setPresence({ activities: [], status: 'online' });
        } catch (e) {}
        setTimeout(() => { try { client.destroy(); } catch (e) {} }, 500);
        return;
      }
      session.status = 'ready';
      session.expiresAt = Date.now() + remainingMs;
      const elapsedSinceConnect = session.lastStartTs ? Math.max(0, (Date.now() - session.lastStartTs) / 1000) : session.currentTime;
      applyTrackPresence(client, session.currentTrack, elapsedSinceConnect);
    });

    client.login(rawToken).catch((err) => {
      console.warn(`[Discord Activity] Login failed for user ${uidStr}:`, err.message);
      disconnectUserSession(uidStr);
    });
  } catch (err) {
    console.error(`[Discord Activity] Error starting client for user ${uidStr}:`, err.message);
  }
}

// Background failsafe sweeper: checks for expired Discord sessions
setInterval(() => {
  const now = Date.now();
  for (const [uid, session] of activeUserBots.entries()) {
    if (session.currentTrack && (session.isPlaying || (session.expiresAt && now < session.expiresAt))) {
      const trackDuration = Number(session.currentTrack.duration) > 0 ? Number(session.currentTrack.duration) : 240;
      const curSec = Math.max(0, Number(session.currentTime) || 0);
      const remainingSec = Math.max(0, trackDuration - curSec) + 180;
      const dynamicExpiry = (session.lastStartTs || session.lastHeartbeat || now) + (remainingSec * 1000);
      const expiresAt = session.expiresAt || dynamicExpiry;

      if (now > expiresAt) {
        console.log(`[Discord Activity] Auto-expiring finished session for user ${uid} (track elapsed)`);
        disconnectUserSession(uid).catch(() => {});
      }
    } else {
      const lastActive = session.lastHeartbeat || session.lastStartTs || 0;
      if (now - lastActive > 26000) {
        console.log(`[Discord Activity] Auto-expiring inactive session for user ${uid}`);
        disconnectUserSession(uid).catch(() => {});
      }
    }
  }
}, 10000).unref();

function initDiscordBot(UserModel) {
  const { initDiscordBot: runBot } = require('./discordBot');
  return runBot(UserModel, { encryptToken, disconnectUserSession });
}

module.exports = {
  encryptToken,
  decryptToken,
  handleUserListening,
  disconnectUserSession,
  getActiveSession,
  isUserPlaying,
  isUserActivelyPlaying,
  initDiscordBot,
  setIo
};
