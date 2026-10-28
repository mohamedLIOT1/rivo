const { User, Message } = require('../models');
const { verifyJwt } = require('../middleware/auth');
const discordActivity = require('../discordActivity');

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

  // Authentication middleware for Socket.io
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      try {
        const decoded = verifyJwt(token);
        if (decoded?.id) {
          socket.userId = String(decoded.id);
        }
      } catch (e) {}
    }
    next();
  });

  const path = require('path');
  const fs = require('fs');

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
        minAppVersion: '1.9.6'
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
    // Proactively push OTA manifest immediately upon socket connect
    try {
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
          const manifest = getEffectiveManifest();
          socket.emit('app:update_manifest', manifest);
          socket.emit('app:update_available', manifest);
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

    // Typing indicator
    socket.on('chat:typing', ({ recipientId, isTyping }) => {
      if (!recipientId) return;
      const payload = {
        senderId: socket.userId,
        isTyping: Boolean(isTyping)
      };
      io.to(`user:${recipientId}`).emit('chat:typing', payload);
      const recipientSockets = userSocketMap.get(String(recipientId));
      if (recipientSockets) {
        recipientSockets.forEach(sid => io.to(sid).emit('chat:typing', payload));
      }
    });

    // Real-time notification sending (strictly authenticated sender)
    socket.on('notification:send', ({ recipientId, title, body, data }) => {
      if (!socket.userId) {
        return; // Reject unauthenticated notification sending
      }
      const recipientSockets = userSocketMap.get(String(recipientId));
      if (recipientSockets) {
        recipientSockets.forEach(sid =>
          io.to(sid).emit('notification:received', {
            senderId: socket.userId,
            title,
            body,
            data,
            timestamp: Date.now()
          })
        );
      }
    });

    // Helper to authenticate socket if token provided in event
    const authenticateSocketEvent = (data) => {
      const token = data?.token || (typeof data === 'string' ? data : null);
      if (token && !socket.userId) {
        try {
          const decoded = verifyJwt(token);
          if (decoded?.id) socket.userId = String(decoded.id);
        } catch (e) {}
      }
      return socket.userId;
    };

    // User online registration (Reject unauthenticated user spoofing)
    socket.on('user:online', (data) => {
      authenticateSocketEvent(data);
      const uidStr = socket.userId;
      if (!uidStr) return; // Ignore unauthenticated claim
      socket.join(`user:${uidStr}`);
      if (!userSocketMap.has(uidStr)) {
        userSocketMap.set(uidStr, new Set());
      }
      userSocketMap.get(uidStr).add(socket.id);

      io.emit('user:status', { userId: uidStr, isOnline: true });
      notifyFollowersStatus(uidStr, true);
      pushBetaUpdateIfEligible(uidStr);
    });

    socket.on('user_connected', (data) => {
      authenticateSocketEvent(data);
      const uidStr = socket.userId;
      if (!uidStr) return; // Ignore unauthenticated claim
      socket.join(`user:${uidStr}`);
      if (!userSocketMap.has(uidStr)) {
        userSocketMap.set(uidStr, new Set());
      }
      userSocketMap.get(uidStr).add(socket.id);

      io.emit('user:status', { userId: uidStr, isOnline: true });
      notifyFollowersStatus(uidStr, true);
      pushBetaUpdateIfEligible(uidStr);
    });

    // Device Playback Coordination
    socket.on('device:playback_state', ({ isPlaying, track, currentTime, deviceType, deviceName }) => {
      const uid = socket.userId;
      if (!uid) return;

      if (isPlaying) {
        socket.to(`user:${uid}`).emit('device:force_pause');
      }

      userDeviceSessions.set(uid, {
        activeSocketId: socket.id,
        deviceType: deviceType || 'web',
        deviceName: deviceName || (deviceType === 'mobile' ? 'Mobile Phone' : 'Web Browser'),
        track,
        isPlaying: Boolean(isPlaying),
        currentTime: Number(currentTime) || 0,
        updatedAt: Date.now()
      });
    });

    socket.on('device:request_state', () => {
      const uid = socket.userId;
      if (!uid) return;
      const session = userDeviceSessions.get(uid);
      if (session && session.activeSocketId !== socket.id) {
        socket.emit('device:remote_playing', session);
      }
    });

    // Live listening activity
    socket.on('activity:listening', async ({ track, isPlaying, currentTime }) => {
      const uidStr = socket.userId;
      if (!uidStr) return;
      const now = new Date();
      const curSec = Math.max(0, Number(currentTime) || 0);
      const updateData = {
        lastActiveAt: now,
        currentListening: track ? {
          id: track.id || track._id,
          title: track.title,
          artist: track.artist,
          cover: track.cover,
          audioUrl: track.audioUrl,
          duration: track.duration,
          isPlaying: Boolean(isPlaying),
          currentTime: curSec,
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
          try { discordActivity.handleUserListening(user, track, isPlaying, curSec); } catch (e) {}
        }
      } catch (e) {}
    });

    // Chat mark read
    socket.on('chat:mark_read', async ({ senderId }) => {
      const currentUserId = socket.userId;
      if (!currentUserId || !senderId) return;

      try {
        await Message.updateMany(
          { sender: senderId, recipient: currentUserId, read: false },
          { $set: { read: true } }
        );

        io.to(`user:${senderId}`).emit('chat:seen', {
          seenBy: currentUserId,
          senderId: senderId,
          readAt: Date.now()
        });

        io.to(`user:${currentUserId}`).emit('chat:dismiss_notification', {
          senderId: senderId
        });
      } catch (e) {}
    });

    // Jam Invite
    socket.on('jam:invite_user', ({ recipientId, roomCode, host }) => {
      if (!recipientId || !roomCode) return;
      io.to(`user:${recipientId}`).emit('jam:invite_received', {
        roomCode,
        host: host || { id: socket.id, name: 'Friend', avatar: '' },
        createdAt: Date.now()
      });
    });

    // Jam: Join Room (secure host verification via authenticated socket.userId)
    socket.on('jam:join_room', ({ roomCode, user, currentTrack, isPlaying, currentTime }) => {
      if (!roomCode) return;
      const cleanCode = String(roomCode).trim().toUpperCase();
      socket.join(cleanCode);

      // Authenticated userId strictly from JWT handshake
      const authenticatedUserId = socket.userId ? String(socket.userId) : null;
      const uId = authenticatedUserId || (user?.id ? String(user.id) : (user?._id ? String(user._id) : socket.id));
      const isNewRoom = !jamRooms[cleanCode];
      if (isNewRoom) {
        jamRooms[cleanCode] = {
          code: cleanCode,
          hostId: socket.id,
          hostUserId: authenticatedUserId,
          hostOnlyControl: false,
          currentTrack: currentTrack || null,
          isPlaying: Boolean(isPlaying),
          currentTime: Number(currentTime) || 0,
          updatedAt: Date.now(),
          queue: [],
          members: []
        };
      }

      const room = jamRooms[cleanCode];
      const disconnectKey = `${cleanCode}:${uId || socket.id}`;
      if (jamDisconnectTimeouts.has(disconnectKey)) {
        clearTimeout(jamDisconnectTimeouts.get(disconnectKey));
        jamDisconnectTimeouts.delete(disconnectKey);
      }

      // Reconnecting host check MUST strictly match authenticated socket.userId to prevent impersonation
      const wasHostReconnecting = Boolean(room.hostUserId && authenticatedUserId && String(room.hostUserId) === authenticatedUserId);
      const isHost = isNewRoom ? true : Boolean(room.hostId === socket.id || wasHostReconnecting || (room.members.length === 0 && !room.hostId));

      room.members = (room.members || []).filter(m => m.socketId !== socket.id && (!uId || String(m.id || m._id) !== String(uId)));

      if (isHost) {
        room.hostId = socket.id;
        room.hostUserId = authenticatedUserId || room.hostUserId || null;
        room.members.forEach(m => { m.isHost = false; });
        if (currentTrack && (!room.currentTrack || isNewRoom)) {
          room.currentTrack = currentTrack;
          room.isPlaying = Boolean(isPlaying);
          room.currentTime = Number(currentTime) || 0;
          room.updatedAt = Date.now();
        }
      }

      const member = {
        ...user,
        id: uId,
        _id: uId,
        name: user?.name || 'Listener',
        avatar: user?.avatar || '',
        socketId: socket.id,
        isHost,
        isDisconnected: false
      };

      room.members.push(member);

      io.to(cleanCode).emit('jam:room_updated', room);
      io.to(cleanCode).emit('jam_updated', room);
      socket.emit('jam:room_updated', room);
      socket.emit('jam_updated', room);

      if (room.currentTrack) {
        let liveTime = Number(room.currentTime) || 0;
        let syncUpdatedAt = room.updatedAt || Date.now();
        if (room.isPlaying && room.updatedAt) {
          const elapsed = (Date.now() - room.updatedAt) / 1000;
          if (elapsed > 0 && elapsed < 3600) {
            liveTime += elapsed;
            syncUpdatedAt = Date.now();
          }
        }
        socket.emit('jam:sync_play_state', {
          isPlaying: Boolean(room.isPlaying),
          currentTrack: room.currentTrack,
          currentTime: liveTime,
          updatedAt: syncUpdatedAt,
          queue: room.queue || [],
          initiatorId: 'server'
        });
      } else if (room.hostId && room.hostId !== socket.id) {
        io.to(room.hostId).emit('jam:get_host_time', { requesterSocketId: socket.id, roomCode: cleanCode });
      }
    });

    // Jam: Sync play state
    socket.on('jam:sync_play_state', ({ roomCode, isPlaying, currentTrack, currentTime, initiatorId, userId, isPeriodic, isSeek, userAction }) => {
      const cleanCode = String(roomCode || '').trim().toUpperCase();
      const room = jamRooms[cleanCode] || jamRooms[roomCode];
      if (room) {
        const effUid = socket.userId ? String(socket.userId) : null;
        const isHost = (room.hostId === socket.id) ||
          (room.hostUserId && effUid && String(room.hostUserId) === effUid) ||
          (room.members || []).some(m => (m.socketId === socket.id || (effUid && String(m.id || m._id) === effUid)) && m.isHost);

        // ONLY the Host may emit periodic playback time / clock synchronization!
        // Non-host members are never allowed to push lagging periodic time updates into the room.
        if (isPeriodic && !isHost) {
          return;
        }

        if (!isHost && room.hostOnlyControl) {
          let liveTime = Number(room.currentTime) || 0;
          let syncUpdatedAt = room.updatedAt || Date.now();
          if (room.isPlaying && room.updatedAt) {
            const elapsed = (Date.now() - room.updatedAt) / 1000;
            if (elapsed > 0 && elapsed < 3600) {
              liveTime += elapsed;
              syncUpdatedAt = Date.now();
            }
          }
          socket.emit('jam:sync_play_state', {
            isPlaying: Boolean(room.isPlaying),
            currentTrack: room.currentTrack,
            currentTime: liveTime,
            updatedAt: syncUpdatedAt,
            queue: room.queue || [],
            initiatorId: 'server'
          });
          return;
        }

        if (isPlaying !== undefined) room.isPlaying = Boolean(isPlaying);
        if (currentTrack !== undefined && currentTrack !== null) {
          const cleanTrack = { ...currentTrack };
          if (cleanTrack.localAudioUri && cleanTrack.localAudioUri.startsWith('file://')) delete cleanTrack.localAudioUri;
          if (cleanTrack.nativeAudioUri && cleanTrack.nativeAudioUri.startsWith('file://')) delete cleanTrack.nativeAudioUri;
          if (cleanTrack.audioUrl && (cleanTrack.audioUrl.startsWith('file://') || cleanTrack.audioUrl.includes('googlevideo.com'))) delete cleanTrack.audioUrl;
          if (cleanTrack.streamUrl && cleanTrack.streamUrl.includes('googlevideo.com')) delete cleanTrack.streamUrl;
          cleanTrack.isDownloaded = false;
          cleanTrack.downloaded = false;

          const oldId = room.currentTrack ? String(room.currentTrack._id || room.currentTrack.id || '') : '';
          const newId = String(cleanTrack._id || cleanTrack.id || '');
          if (room.currentTrack && oldId && newId && oldId !== newId) {
            if (!room.history) room.history = [];
            room.history.push(room.currentTrack);
            if (room.history.length > 25) room.history.shift();
          }
          room.currentTrack = cleanTrack;
        }
        if (currentTime !== undefined) room.currentTime = Number(currentTime) || 0;
        room.updatedAt = Date.now();
        room.initiatorId = initiatorId || socket.id;

        const syncPayload = {
          isPlaying: Boolean(room.isPlaying),
          currentTrack: room.currentTrack,
          currentTime: room.currentTime,
          updatedAt: room.updatedAt,
          serverTime: Date.now(),
          initiatorId: initiatorId || socket.id,
          isPeriodic: Boolean(isPeriodic),
          isSeek: Boolean(isSeek),
          userAction: userAction || (isSeek ? 'seek' : (isPlaying === false ? 'pause' : 'play'))
        };

        // Consolidated clean emission: jam:sync_play_state (only emit room_updated when non-periodic)
        io.to(cleanCode).emit('jam:sync_play_state', syncPayload);
        if (!isPeriodic) {
          io.to(cleanCode).emit('jam:room_updated', room);
        }
      }
    });

    // Jam: Set control mode (Host only can toggle hostOnlyControl)
    socket.on('jam:set_control_mode', ({ roomCode, hostOnlyControl }) => {
      const cleanCode = String(roomCode || '').trim().toUpperCase();
      const room = jamRooms[cleanCode] || jamRooms[roomCode];
      if (!room) return;
      const effUid = socket.userId;
      const isHost = (room.hostId === socket.id) ||
        (room.hostUserId && effUid && String(room.hostUserId) === String(effUid)) ||
        (room.members || []).some(m => (m.socketId === socket.id || (effUid && String(m.id || m._id) === String(effUid))) && m.isHost);

      if (!isHost) return;
      room.hostOnlyControl = Boolean(hostOnlyControl);
      io.to(cleanCode).emit('jam:room_updated', room);
      io.to(cleanCode).emit('jam_updated', room);
      io.to(cleanCode).emit('jam:control_mode_changed', { hostOnlyControl: room.hostOnlyControl });
    });

    socket.on('jam:request_sync', ({ roomCode }) => {
      const cleanCode = String(roomCode || '').trim().toUpperCase();
      const room = jamRooms[cleanCode] || jamRooms[roomCode];
      if (!room) return;

      let liveTime = Number(room.currentTime) || 0;
      let syncUpdatedAt = room.updatedAt || Date.now();
      if (room.isPlaying && room.updatedAt) {
        const elapsed = (Date.now() - room.updatedAt) / 1000;
        if (elapsed > 0 && elapsed < 3600) {
          liveTime += elapsed;
          syncUpdatedAt = Date.now();
        }
      }
      socket.emit('jam:sync_play_state', {
        isPlaying: Boolean(room.isPlaying),
        currentTrack: room.currentTrack,
        currentTime: liveTime,
        updatedAt: syncUpdatedAt,
        serverTime: Date.now(),
        queue: room.queue || [],
        initiatorId: 'server'
      });

      if (room.hostId && room.hostId !== socket.id) {
        io.to(room.hostId).emit('jam:get_host_time', { requesterSocketId: socket.id, roomCode: cleanCode });
      }
    });

    socket.on('jam:report_host_time', ({ requesterSocketId, isPlaying, currentTrack, currentTime }) => {
      if (requesterSocketId) {
        io.to(requesterSocketId).emit('jam:sync_play_state', {
          isPlaying: Boolean(isPlaying),
          currentTrack: currentTrack,
          currentTime: Number(currentTime) || 0,
          updatedAt: Date.now(),
          serverTime: Date.now(),
          initiatorId: socket.id
        });
      }
    });

    socket.on('jam:add_to_queue', ({ roomCode, track, tracks, playNext, userId }) => {
      const cleanCode = String(roomCode || '').trim().toUpperCase();
      const room = jamRooms[cleanCode] || jamRooms[roomCode];
      if (room) {
        let rawList = [];
        if (Array.isArray(tracks)) rawList = tracks;
        else if (Array.isArray(track)) rawList = track;
        else if (track) rawList = [track];

        const validList = rawList.filter(Boolean);
        if (validList.length === 0) return;

        const effUid = socket.userId ? String(socket.userId) : null;
        const isHost = (room.hostId === socket.id) ||
          (room.hostUserId && effUid && String(room.hostUserId) === effUid) ||
          (room.members || []).some(m => (m.socketId === socket.id || (effUid && String(m.id || m._id) === effUid)) && m.isHost);

        const canControl = isHost || !room.hostOnlyControl;

        let remainingTracks = [...validList];
        if (!room.currentTrack && canControl) {
          const firstTrack = remainingTracks.shift();
          room.currentTrack = firstTrack;
          room.isPlaying = true;
          room.currentTime = 0;
          room.updatedAt = Date.now();

          io.to(cleanCode).emit('jam:on_play_state_changed', {
            isPlaying: true,
            currentTrack: firstTrack,
            currentTime: 0,
            updatedAt: room.updatedAt,
            initiatorId: socket.id
          });
          io.to(cleanCode).emit('jam:sync_play_state', {
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
          if (room.queue.length > 25) {
            room.queue = room.queue.slice(0, 25);
          }
        }

        io.to(cleanCode).emit('jam:room_updated', room);
        io.to(cleanCode).emit('jam_updated', room);
      }
    });

    socket.on('jam:remove_from_queue', ({ roomCode, trackIndex, trackId }) => {
      const cleanCode = String(roomCode || '').trim().toUpperCase();
      const room = jamRooms[cleanCode] || jamRooms[roomCode];
      if (!room || !Array.isArray(room.queue)) return;

      // Authorization check: User must be an active member of this room
      const member = (room.members || []).find(m => m.socketId === socket.id);
      if (!member) return;

      // If room has hostOnlyControl enabled, only host can modify queue
      const isHost = room.hostId === socket.id || Boolean(room.hostUserId && socket.userId && String(room.hostUserId) === String(socket.userId));
      if (room.hostOnlyControl && !isHost) return;

      if (typeof trackIndex === 'number' && trackIndex >= 0 && trackIndex < room.queue.length) {
        room.queue.splice(trackIndex, 1);
      } else if (trackId) {
        room.queue = room.queue.filter(t => String(t.id || t._id) !== String(trackId));
      }
      io.to(cleanCode).emit('jam:room_updated', room);
      io.to(cleanCode).emit('jam_updated', room);
    });

    socket.on('jam:reorder_queue', ({ roomCode, fromIndex, toIndex }) => {
      const cleanCode = String(roomCode || '').trim().toUpperCase();
      const room = jamRooms[cleanCode] || jamRooms[roomCode];
      if (!room || !Array.isArray(room.queue)) return;

      // Authorization check: User must be an active member of this room
      const member = (room.members || []).find(m => m.socketId === socket.id);
      if (!member) return;

      // If room has hostOnlyControl enabled, only host can modify queue
      const isHost = room.hostId === socket.id || Boolean(room.hostUserId && socket.userId && String(room.hostUserId) === String(socket.userId));
      if (room.hostOnlyControl && !isHost) return;

      if (typeof fromIndex === 'number' && typeof toIndex === 'number' &&
          fromIndex >= 0 && fromIndex < room.queue.length &&
          toIndex >= 0 && toIndex < room.queue.length) {
        const [moved] = room.queue.splice(fromIndex, 1);
        room.queue.splice(toIndex, 0, moved);
        io.to(cleanCode).emit('jam:room_updated', room);
        io.to(cleanCode).emit('jam_updated', room);
      }
    });

    socket.on('jam:transfer_host', ({ roomCode, targetSocketId, targetUserId }) => {
      const cleanCode = String(roomCode || '').trim().toUpperCase();
      const room = jamRooms[cleanCode] || jamRooms[roomCode];
      if (!room) return;
      if (room.hostId !== socket.id) return;

      const target = (room.members || []).find(m => m.socketId === targetSocketId || (targetUserId && (m.id === targetUserId || m._id === targetUserId)));
      if (!target) return;

      room.hostId = target.socketId;
      room.hostUserId = target.id || target._id || null;
      room.members = room.members.map(m => ({
        ...m,
        isHost: m.socketId === target.socketId
      }));

      io.to(cleanCode).emit('jam:room_updated', room);
      io.to(cleanCode).emit('jam_updated', room);
      io.to(cleanCode).emit('jam:host_changed', { hostId: room.hostId, hostUserId: room.hostUserId, hostName: target.name });
      io.to(target.socketId).emit('jam:you_are_host', { roomCode: cleanCode });
      io.to(target.socketId).emit('jam:promoted_to_host', { roomCode: cleanCode });
    });

    socket.on('jam:next_track', ({ roomCode }) => {
      const cleanCode = String(roomCode || '').trim().toUpperCase();
      const room = jamRooms[cleanCode] || jamRooms[roomCode];
      if (room) {
        const effUid = socket.userId;
        const isHost = (room.hostId === socket.id) ||
          (room.hostUserId && effUid && String(room.hostUserId) === String(effUid)) ||
          (room.members || []).some(m => (m.socketId === socket.id || (effUid && String(m.id || m._id) === String(effUid))) && m.isHost);
        const canControl = isHost || !room.hostOnlyControl;
        if (!canControl) return;

        // Debounce rapid next_track calls within 1.2s to prevent multiple clients skipping queue simultaneously
        const now = Date.now();
        if (room._lastNextTrackTime && (now - room._lastNextTrackTime < 1200)) {
          return;
        }
        room._lastNextTrackTime = now;

        if (room.queue && room.queue.length > 0) {
          const nextTrack = room.queue.shift();
          if (room.currentTrack) {
            if (!room.history) room.history = [];
            room.history.push(room.currentTrack);
            if (room.history.length > 25) room.history.shift();
          }
          room.currentTrack = nextTrack;
          room.currentTime = 0;
          room.isPlaying = true;
          room.updatedAt = Date.now();

          const payload = {
            isPlaying: true,
            currentTrack: nextTrack,
            currentTime: 0,
            updatedAt: room.updatedAt,
            initiatorId: socket.id
          };
          io.to(cleanCode).emit('jam:on_play_state_changed', payload);
          io.to(cleanCode).emit('jam:sync_play_state', payload);
          io.to(cleanCode).emit('jam:room_updated', room);
          io.to(cleanCode).emit('jam_updated', room);
        } else {
          if (room.hostId) {
            io.to(room.hostId).emit('jam:advance_host_queue', { roomCode: cleanCode });
          }
        }
      }
    });

    socket.on('jam:prev_track', ({ roomCode }) => {
      const cleanCode = String(roomCode || '').trim().toUpperCase();
      const room = jamRooms[cleanCode] || jamRooms[roomCode];
      if (room) {
        const effUid = socket.userId;
        const isHost = (room.hostId === socket.id) ||
          (room.hostUserId && effUid && String(room.hostUserId) === String(effUid)) ||
          (room.members || []).some(m => (m.socketId === socket.id || (effUid && String(m.id || m._id) === String(effUid))) && m.isHost);
        const canControl = isHost || !room.hostOnlyControl;
        if (!canControl) return;

        if (room.history && room.history.length > 0) {
          const prevTrack = room.history.pop();
          if (room.currentTrack) {
            if (!room.queue) room.queue = [];
            room.queue.unshift(room.currentTrack);
          }
          room.currentTrack = prevTrack;
          room.currentTime = 0;
          room.isPlaying = true;
          room.updatedAt = Date.now();

          const payload = {
            isPlaying: true,
            currentTrack: prevTrack,
            currentTime: 0,
            updatedAt: room.updatedAt,
            initiatorId: socket.id
          };
          io.to(cleanCode).emit('jam:on_play_state_changed', payload);
          io.to(cleanCode).emit('jam:sync_play_state', payload);
          io.to(cleanCode).emit('jam:room_updated', room);
          io.to(cleanCode).emit('jam_updated', room);
        } else if (room.hostId) {
          io.to(room.hostId).emit('jam:prev_track', { roomCode: cleanCode });
        }
      }
    });

    socket.on('jam:kick_member', ({ roomCode, memberSocketId, memberId }) => {
      const cleanCode = String(roomCode || '').trim().toUpperCase();
      const room = jamRooms[cleanCode] || jamRooms[roomCode];
      if (!room) return;
      if (room.hostId !== socket.id) return;

      const target = room.members.find(m => m.socketId === memberSocketId || (memberId && (m.id === memberId || m._id === memberId)));
      if (!target || target.socketId === room.hostId) return;

      room.members = room.members.filter(m => m.socketId !== target.socketId);

      io.to(target.socketId).emit('jam:kicked', {
        roomCode: cleanCode,
        reason: 'You were removed from the Jam room by the host.'
      });

      const targetSocket = io.sockets.sockets.get(target.socketId);
      if (targetSocket) {
        targetSocket.leave(cleanCode);
      }

      io.to(cleanCode).emit('jam:room_updated', room);
      io.to(cleanCode).emit('jam_updated', room);
    });

    // Jam: Leave room with instant host migration
    socket.on('jam:leave_room', ({ roomCode }) => {
      const cleanCode = String(roomCode || '').trim().toUpperCase();
      socket.leave(cleanCode);
      const room = jamRooms[cleanCode] || jamRooms[roomCode];
      if (room) {
        const wasHost = room.hostId === socket.id;
        room.members = room.members.filter(m => m.socketId !== socket.id);
        if (room.members.length === 0) {
          delete jamRooms[cleanCode];
        } else {
          if (wasHost || !room.members.some(m => m.socketId === room.hostId)) {
            const randomIdx = Math.floor(Math.random() * room.members.length);
            const newHost = room.members[randomIdx];
            room.members.forEach((m, idx) => { m.isHost = (idx === randomIdx); });
            room.hostId = newHost.socketId;
            room.hostUserId = newHost.id || newHost._id || null;
            io.to(cleanCode).emit('jam:host_changed', { hostId: room.hostId, hostUserId: room.hostUserId, hostName: newHost.name });
            if (newHost.socketId) {
              io.to(newHost.socketId).emit('jam:you_are_host', { roomCode: cleanCode });
              io.to(newHost.socketId).emit('jam:promoted_to_host', { roomCode: cleanCode });
            }
          }
          io.to(cleanCode).emit('jam:room_updated', room);
          io.to(cleanCode).emit('jam_updated', room);
        }
      }
    });

    // Disconnect event with 25s Grace Period (prevents offline/online flapping & lag)
    socket.on('disconnect', async () => {
      const uidStr = socket.userId;
      if (uidStr) {
        let hasRemainingSockets = false;
        if (userSocketMap.has(uidStr)) {
          const sockets = userSocketMap.get(uidStr);
          sockets.delete(socket.id);
          if (sockets.size > 0) {
            hasRemainingSockets = true;
          }
        }

        if (!hasRemainingSockets) {
          // Cancel any existing timer and start a fresh 25s grace period
          if (userDisconnectGraceTimers.has(uidStr)) {
            clearTimeout(userDisconnectGraceTimers.get(uidStr));
          }

          const graceTimer = setTimeout(async () => {
            userDisconnectGraceTimers.delete(uidStr);

            // Verify user has not reconnected during grace period
            const currentSockets = userSocketMap.get(uidStr);
            if (currentSockets && currentSockets.size > 0) {
              return; // User reconnected! Keep them online and active without any lag.
            }

            userSocketMap.delete(uidStr);
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
              isLive: false,
              currentListening: { isPlaying: false }
            });

            try { await discordActivity.disconnectUserSession(uidStr); } catch (e) {}
          }, 25000); // 25s grace period

          userDisconnectGraceTimers.set(uidStr, graceTimer);
        }
      }

      // Fast Jam host migration & disconnect handling (3 seconds grace period instead of 120s)
      for (const code in jamRooms) {
        const room = jamRooms[code];
        const member = room.members.find(m => m.socketId === socket.id || (socket.userId && (String(m.id || m._id) === String(socket.userId))));
        const isHostDisconnect = Boolean(room.hostId === socket.id || member?.isHost || (room.hostUserId && socket.userId && String(room.hostUserId) === String(socket.userId)));

        if (member || isHostDisconnect) {
          if (member) member.isDisconnected = true;
          const key = `${code}:${member?.id || socket.userId || socket.id}`;

          if (jamDisconnectTimeouts.has(key)) {
            clearTimeout(jamDisconnectTimeouts.get(key));
          }

          const gracePeriodMs = isHostDisconnect ? 25000 : 10000;

          const timer = setTimeout(() => {
            jamDisconnectTimeouts.delete(key);
            const currentRoom = jamRooms[code];
            if (!currentRoom) return;

            currentRoom.members = currentRoom.members.filter(m => m.socketId !== socket.id && (!member?.id || m.id !== member.id));

            if (currentRoom.members.length === 0) {
              setTimeout(() => {
                if (jamRooms[code] && (!jamRooms[code].members || jamRooms[code].members.length === 0)) {
                  delete jamRooms[code];
                }
              }, 60000);
            } else {
              // If the disconnecting socket was host, immediately transfer to an active remaining member
              if (currentRoom.hostId === socket.id || !currentRoom.members.some(m => m.socketId === currentRoom.hostId)) {
                const activeMembers = currentRoom.members.filter(m => !m.isDisconnected);
                const targetList = activeMembers.length > 0 ? activeMembers : currentRoom.members;
                if (targetList.length > 0) {
                  const newHost = targetList[Math.floor(Math.random() * targetList.length)];
                  currentRoom.members.forEach(m => { m.isHost = (m.socketId === newHost.socketId); });
                  currentRoom.hostId = newHost.socketId;
                  currentRoom.hostUserId = newHost.id || newHost._id || null;

                  io.to(code).emit('jam:host_changed', {
                    hostId: currentRoom.hostId,
                    hostUserId: currentRoom.hostUserId,
                    hostName: newHost.name
                  });
                  if (newHost.socketId) {
                    io.to(newHost.socketId).emit('jam:you_are_host', { roomCode: code });
                    io.to(newHost.socketId).emit('jam:promoted_to_host', { roomCode: code });
                  }
                }
              }
              io.to(code).emit('jam:room_updated', currentRoom);
              io.to(code).emit('jam_updated', currentRoom);
            }
          }, gracePeriodMs);

          jamDisconnectTimeouts.set(key, timer);
        }
      }
    });
  });
};
