/**
 * Rivo Real-Time WebSockets Engine
 * Strictly modularized (< 400 lines), zero unhandled socket exceptions.
 */

const path = require('path');
const fs = require('fs');
const { User } = require('../models');
const { verifyJwt } = require('../middleware/auth');
const discordActivity = require('../discordActivity');
const { registerJamHandlers, handleJamDisconnect, isSocketHost } = require('./jamHandlers');
const { registerChatHandlers } = require('./chatHandlers');

const jamRooms = {};
const jamDisconnectTimeouts = new Map();
const userDeviceSessions = new Map();
const userSocketMap = new Map();
const userDisconnectGraceTimers = new Map();

module.exports = function (io, updateConfig = {}) {
  const {
    BETA_VERSIONS_DATA,
    APP_VERSIONS_DATA,
    isBetaTester,
    BETA_TESTER_EMAILS,
  } = updateConfig;

  if (io && discordActivity.setIo) {
    discordActivity.setIo(io);
  }

  // Authentication middleware for Socket.io
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.query?.token;
      if (token) {
        try {
          const decoded = verifyJwt(token);
          if (decoded?.id) {
            socket.userId = String(decoded.id);
          }
        } catch (e) {}
      }
    } catch (err) {
      console.warn('[Socket Auth Middleware warning]', err.message);
    }
    next();
  });

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

  const getEffectiveManifest = () => {
    const manifest = JSON.parse(JSON.stringify(APP_VERSIONS_DATA || {}));
    manifest.channel = 'stable';
    const dynamicOta = getOtaManifest();
    if (dynamicOta && dynamicOta.enabled && manifest.platforms?.android) {
      manifest.platforms.android.ota = {
        ...manifest.platforms.android.ota,
        ...dynamicOta,
        minAppVersion: dynamicOta.minAppVersion || '1.0.0'
      };
    }
    return manifest;
  };

  // Broadcast live OTA update manifest to all connected clients on server boot/reload
  setTimeout(() => {
    try {
      const manifest = getEffectiveManifest();
      io.emit('app:update_manifest', manifest);
      io.emit('app:update_available', manifest);
    } catch (e) {}
  }, 1500);

  io.on('connection', (socket) => {
    try {
      // Proactively push OTA manifest immediately upon socket connect
      const manifest = getEffectiveManifest();
      socket.emit('app:update_manifest', manifest);
      socket.emit('app:update_available', manifest);
    } catch (e) {}

    // Proactively push beta updates ONLY to verified beta testers on their private socket
    const pushBetaUpdateIfEligible = async (userId) => {
      try {
        const u = await User.findById(userId).select('email role isAdmin isBetaTester').lean();
        const userEmail = (u?.email || '').toLowerCase().trim();
        const isBeta = u?.isBetaTester || u?.role === 'admin' || u?.isAdmin || (userEmail && BETA_TESTER_EMAILS?.has?.(userEmail));
        if (isBeta && BETA_VERSIONS_DATA) {
          const betaManifest = JSON.parse(JSON.stringify(BETA_VERSIONS_DATA));
          socket.emit('app:update_manifest', betaManifest);
          socket.emit('app:update_available', betaManifest);
        } else {
          const m = getEffectiveManifest();
          socket.emit('app:update_manifest', m);
          socket.emit('app:update_available', m);
        }
      } catch (e) {}
    };

    if (socket.userId) {
      const uidStr = socket.userId;
      if (userDisconnectGraceTimers.has(uidStr)) {
        clearTimeout(userDisconnectGraceTimers.get(uidStr));
        userDisconnectGraceTimers.delete(uidStr);
      }
      socket.join(`user:${uidStr}`);
      if (!userSocketMap.has(uidStr)) {
        userSocketMap.set(uidStr, new Set());
      }
      userSocketMap.get(uidStr).add(socket.id);
      pushBetaUpdateIfEligible(uidStr);
    }

    // Helper to notify followers of online/offline status
    const notifyFollowersStatus = async (userId, isOnline) => {
      try {
        const u = await User.findById(userId).select('followers name avatar').lean();
        if (u && Array.isArray(u.followers)) {
          u.followers.forEach(followerId => {
            const fSockets = userSocketMap.get(String(followerId));
            if (fSockets) {
              fSockets.forEach(sid => {
                io.to(sid).emit('friend:status', {
                  userId: String(userId),
                  name: u.name,
                  avatar: u.avatar,
                  status: isOnline ? 'online' : 'offline',
                  isOnline
                });
              });
            }
          });
        }
      } catch (e) {}
    };

    // Register Modular Handlers
    registerChatHandlers(io, socket, {
      userSocketMap,
      userDeviceSessions,
      userDisconnectGraceTimers,
      notifyFollowersStatus,
      pushBetaUpdateIfEligible
    });

    registerJamHandlers(io, socket, {
      jamRooms,
      jamDisconnectTimeouts,
      isSocketHost
    });

    // Disconnect event with 3s Grace Period (prevents offline/online flapping & lag, instant Discord presence clear)
    socket.on('disconnect', async () => {
      try {
        const uidStr = socket.userId;
        if (uidStr) {
          let hasRemainingSockets = false;
          if (userSocketMap.has(uidStr)) {
            const sockets = userSocketMap.get(uidStr);
            sockets.delete(socket.id);
            for (const sid of sockets) {
              if (!io.sockets.sockets.has(sid)) {
                sockets.delete(sid);
              }
            }
            if (sockets.size > 0) {
              hasRemainingSockets = true;
            } else {
              userSocketMap.delete(uidStr);
            }
          }

          if (!hasRemainingSockets) {
            // Mobile devices suspend/disconnect WebSockets when screen locks or app backgrounds.
            // DO NOT kill Discord activity or clear playback synchronously here!
            if (userDisconnectGraceTimers.has(uidStr)) {
              clearTimeout(userDisconnectGraceTimers.get(uidStr));
            }

            const graceTimer = setTimeout(async () => {
              try {
                userDisconnectGraceTimers.delete(uidStr);
                const currentSockets = userSocketMap.get(uidStr);
                if (currentSockets && currentSockets.size > 0) {
                  return;
                }

                userSocketMap.delete(uidStr);

                // Determine if user is still actively listening in background or on lockscreen
                let isDbPlaying = false;
                let dbUser = null;
                try {
                  dbUser = await User.findById(uidStr).select('currentListening discord name avatar').lean();
                  if (dbUser?.currentListening?.isPlaying && dbUser?.currentListening?.title) {
                    const now = Date.now();
                    const trackDur = Number(dbUser.currentListening.duration) > 0 ? Number(dbUser.currentListening.duration) : 240;
                    const curSec = Math.max(0, Number(dbUser.currentListening.currentTime) || 0);
                    const updatedAtTs = dbUser.currentListening.updatedAt ? new Date(dbUser.currentListening.updatedAt).getTime() : now;
                    const elapsedSec = Math.max(0, (now - updatedAtTs) / 1000);
                    const graceSec = 180; // 3-minute grace window for backgrounded playback
                    if (curSec + elapsedSec < trackDur + graceSec) {
                      isDbPlaying = true;
                    }
                  }
                } catch (e) {}

                const isDiscordPlaying = typeof discordActivity.isUserActivelyPlaying === 'function' && discordActivity.isUserActivelyPlaying(uidStr);
                const currentDiscordSession = typeof discordActivity.getActiveSession === 'function' ? discordActivity.getActiveSession(uidStr) : null;
                const hasDiscordSession = Boolean(currentDiscordSession && currentDiscordSession.currentTrack && (currentDiscordSession.isPlaying || (currentDiscordSession.expiresAt && Date.now() < currentDiscordSession.expiresAt)));

                const isActivelyListening = Boolean(isDbPlaying || isDiscordPlaying || hasDiscordSession);

                if (!isActivelyListening) {
                  userDeviceSessions.delete(uidStr);

                  try {
                    await User.findByIdAndUpdate(uidStr, {
                      $set: {
                        'currentListening.isPlaying': false,
                        lastActiveAt: new Date()
                      }
                    });
                  } catch (e) {}

                  io.emit('user:status', {
                    userId: uidStr,
                    isOnline: false,
                    isLive: false
                  });
                  notifyFollowersStatus(uidStr, false);

                  io.emit('activity:updated', {
                    userId: uidStr,
                    isOnline: false,
                    isLive: false
                  });

                  try { await discordActivity.disconnectUserSession(uidStr); } catch (e) {}
                } else {
                  // User is listening in background or on lockscreen: keep currentListening.isPlaying and Discord active!
                  try {
                    await User.findByIdAndUpdate(uidStr, {
                      $set: {
                        lastActiveAt: new Date()
                      }
                    });
                  } catch (e) {}

                  io.emit('user:status', {
                    userId: uidStr,
                    isOnline: false,
                    isLive: true
                  });
                  notifyFollowersStatus(uidStr, false);

                  io.emit('activity:updated', {
                    userId: uidStr,
                    name: dbUser?.name,
                    avatar: dbUser?.avatar,
                    currentListening: dbUser?.currentListening,
                    isOnline: false,
                    isLive: true
                  });
                }
              } catch (gErr) {
                console.error('[Socket Disconnect Grace Timer error]', gErr.message);
              }
            }, 3000);

            userDisconnectGraceTimers.set(uidStr, graceTimer);
          }
        }

        // Handle Jam Room Host Migration & Cleanup
        handleJamDisconnect(io, socket, { jamRooms, jamDisconnectTimeouts });
      } catch (discErr) {
        console.error('[Socket disconnect handler error]', discErr.message);
      }
    });
  });
};

module.exports.userSocketMap = userSocketMap;
module.exports.jamRooms = jamRooms;
module.exports.jamDisconnectTimeouts = jamDisconnectTimeouts;
module.exports.userDeviceSessions = userDeviceSessions;
