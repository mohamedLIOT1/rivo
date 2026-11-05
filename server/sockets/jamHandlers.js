/**
 * Jam Session Real-Time Socket Handlers
 * Strictly modularized (< 400 lines), zero unhandled socket exceptions.
 */

const { registerJamQueueHandlers } = require('./jamQueueHandlers');

const isSocketHost = (room, socket) => {
  if (!room || !socket) return false;
  const effUid = socket.userId ? String(socket.userId) : null;
  return (room.hostId === socket.id) ||
    (Boolean(room.hostUserId && effUid && String(room.hostUserId) === effUid)) ||
    (Array.isArray(room.members) && room.members.some(m => (m.socketId === socket.id || (effUid && String(m.id || m._id) === effUid)) && m.isHost));
};

function registerJamHandlers(io, socket, { jamRooms, jamDisconnectTimeouts }) {
  // Jam Invite
  socket.on('jam:invite_user', ({ recipientId, roomCode, host }) => {
    try {
      if (!recipientId || !roomCode) return;
      io.to(`user:${recipientId}`).emit('jam:invite_received', {
        roomCode,
        host: host || { id: socket.id, name: 'Friend', avatar: '' },
        createdAt: Date.now()
      });
    } catch (err) {
      console.error('[Socket jam:invite_user error]', err.message);
    }
  });

  // Jam: Create Room
  socket.on('jam:create_room', (data = {}, callback) => {
    try {
      const { roomCode, user, currentTrack, isPlaying, currentTime, hostOnlyControl } = (typeof data === 'object' && data !== null) ? data : {};
      let cleanCode = roomCode ? String(roomCode).trim().toUpperCase() : null;
      if (!cleanCode) {
        const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        cleanCode = `JAM-${randomCode}`;
      }
      socket.join(cleanCode);

      const authenticatedUserId = socket.userId ? String(socket.userId) : null;
      const uId = authenticatedUserId || (user?.id ? String(user.id) : (user?._id ? String(user._id) : socket.id));

      const member = {
        ...user,
        id: uId,
        _id: uId,
        name: user?.name || 'Listener',
        avatar: user?.avatar || '',
        socketId: socket.id,
        isHost: true,
        isDisconnected: false
      };

      const room = {
        code: cleanCode,
        roomCode: cleanCode,
        hostId: socket.id,
        hostUserId: authenticatedUserId || uId,
        hostOnlyControl: Boolean(hostOnlyControl),
        currentTrack: currentTrack || null,
        isPlaying: Boolean(isPlaying),
        currentTime: Number(currentTime) || 0,
        updatedAt: Date.now(),
        queue: [],
        history: [],
        members: [member]
      };

      jamRooms[cleanCode] = room;

      socket.emit('jam:room_created', room);
      socket.emit('jam:room_updated', room);
      socket.emit('jam_updated', room);
      io.to(cleanCode).emit('jam:room_created', room);
      io.to(cleanCode).emit('jam:room_updated', room);
      io.to(cleanCode).emit('jam_updated', room);

      if (typeof callback === 'function') {
        callback({ success: true, room, roomCode: cleanCode });
      }
    } catch (err) {
      console.error('[Socket jam:create_room error]', err.message);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  // Jam: Join Room
  socket.on('jam:join_room', (data = {}, callback) => {
    try {
      const { roomCode, user, currentTrack, isPlaying, currentTime } = (typeof data === 'object' && data !== null) ? data : {};
      if (!roomCode) return;
      const cleanCode = String(roomCode).trim().toUpperCase();
      socket.join(cleanCode);

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

      const wasHostReconnecting = Boolean(room.hostUserId && authenticatedUserId && String(room.hostUserId) === authenticatedUserId);
      const isHost = isNewRoom ? true : Boolean(room.hostId === socket.id || wasHostReconnecting || (room.members.length === 0 && !room.hostId));

      room.members = (room.members || []).filter(m => m.socketId !== socket.id && (!uId || String(m.id || m._id) !== String(uId)));

      const member = {
        ...user,
        id: uId,
        _id: uId,
        name: user?.name || (isHost ? 'Host' : 'Listener'),
        avatar: user?.avatar || '',
        socketId: socket.id,
        isHost: isHost,
        isDisconnected: false
      };
      room.members.push(member);

      if (isHost && (!room.hostId || room.hostId !== socket.id)) {
        room.hostId = socket.id;
        if (authenticatedUserId) room.hostUserId = authenticatedUserId;
      }

      io.to(cleanCode).emit('jam:room_updated', room);
      io.to(cleanCode).emit('jam_updated', room);
      socket.emit('jam:room_updated', room);
      socket.emit('jam_updated', room);
      if (isNewRoom) socket.emit('jam:room_created', room);

      if (typeof callback === 'function') {
        callback({ success: true, room, roomCode: cleanCode });
      }

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
    } catch (err) {
      console.error('[Socket jam:join_room error]', err.message);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  // Jam: Sync play state
  socket.on('jam:sync_play_state', ({ roomCode, isPlaying, currentTrack, currentTime, initiatorId, userId, isPeriodic, isSeek, userAction }) => {
    try {
      const cleanCode = String(roomCode || '').trim().toUpperCase();
      const room = jamRooms[cleanCode] || jamRooms[roomCode];
      if (room) {
        const isHost = isSocketHost(room, socket);

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
            serverTime: Date.now(),
            queue: room.queue || [],
            initiatorId: 'server'
          });
          return;
        }

        const validTime = Math.max(0, Number(currentTime) || 0);
        room.isPlaying = Boolean(isPlaying);
        room.currentTime = validTime;
        room.updatedAt = Date.now();
        if (currentTrack) {
          room.currentTrack = currentTrack;
        }

        const syncPayload = {
          isPlaying: room.isPlaying,
          currentTrack: room.currentTrack,
          currentTime: validTime,
          updatedAt: room.updatedAt,
          serverTime: Date.now(),
          initiatorId: socket.id,
          isPeriodic: Boolean(isPeriodic),
          isSeek: Boolean(isSeek),
          userAction: userAction || null,
          queue: room.queue || []
        };

        io.to(cleanCode).emit('jam:sync_play_state', syncPayload);
        if (!isPeriodic) {
          io.to(cleanCode).emit('jam:room_updated', room);
        }
      }
    } catch (err) {
      console.error('[Socket jam:sync_play_state error]', err.message);
    }
  });

  // Jam: Set control mode
  socket.on('jam:set_control_mode', ({ roomCode, hostOnlyControl }) => {
    try {
      const cleanCode = String(roomCode || '').trim().toUpperCase();
      const room = jamRooms[cleanCode] || jamRooms[roomCode];
      if (!room || !isSocketHost(room, socket)) return;
      room.hostOnlyControl = Boolean(hostOnlyControl);
      io.to(cleanCode).emit('jam:room_updated', room);
      io.to(cleanCode).emit('jam_updated', room);
      io.to(cleanCode).emit('jam:control_mode_changed', { hostOnlyControl: room.hostOnlyControl });
    } catch (err) {
      console.error('[Socket jam:set_control_mode error]', err.message);
    }
  });

  // Jam: Request Sync
  socket.on('jam:request_sync', ({ roomCode }) => {
    try {
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
    } catch (err) {
      console.error('[Socket jam:request_sync error]', err.message);
    }
  });

  // Jam: Report Host Time
  socket.on('jam:report_host_time', ({ requesterSocketId, isPlaying, currentTrack, currentTime }) => {
    try {
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
    } catch (err) {
      console.error('[Socket jam:report_host_time error]', err.message);
    }
  });

  // Jam: Transfer host
  socket.on('jam:transfer_host', ({ roomCode, targetSocketId, targetUserId }) => {
    try {
      const cleanCode = String(roomCode || '').trim().toUpperCase();
      const room = jamRooms[cleanCode] || jamRooms[roomCode];
      if (!room || !isSocketHost(room, socket)) return;

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
    } catch (err) {
      console.error('[Socket jam:transfer_host error]', err.message);
    }
  });

  // Jam: Kick member
  socket.on('jam:kick_member', ({ roomCode, memberSocketId, memberId }) => {
    try {
      const cleanCode = String(roomCode || '').trim().toUpperCase();
      const room = jamRooms[cleanCode] || jamRooms[roomCode];
      if (!room || !isSocketHost(room, socket)) return;

      const target = (room.members || []).find(m => m.socketId === memberSocketId || (memberId && (m.id === memberId || m._id === memberId)));
      if (!target || target.socketId === room.hostId) return;

      const targetId = target.id || target._id;
      const kickTimeoutKeys = [
        `${cleanCode}:${target.socketId}`,
        ...(targetId ? [`${cleanCode}:${targetId}`] : [])
      ];
      for (const k of kickTimeoutKeys) {
        if (jamDisconnectTimeouts.has(k)) {
          clearTimeout(jamDisconnectTimeouts.get(k));
          jamDisconnectTimeouts.delete(k);
        }
      }

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
    } catch (err) {
      console.error('[Socket jam:kick_member error]', err.message);
    }
  });

  // Jam: Leave room
  socket.on('jam:leave_room', ({ roomCode }) => {
    try {
      const cleanCode = String(roomCode || '').trim().toUpperCase();
      socket.leave(cleanCode);
      const room = jamRooms[cleanCode] || jamRooms[roomCode];

      const effUid = socket.userId;
      const leaveTimeoutKeys = [
        `${cleanCode}:${socket.id}`,
        ...(effUid ? [`${cleanCode}:${effUid}`] : [])
      ];
      for (const k of leaveTimeoutKeys) {
        if (jamDisconnectTimeouts.has(k)) {
          clearTimeout(jamDisconnectTimeouts.get(k));
          jamDisconnectTimeouts.delete(k);
        }
      }

      if (room && Array.isArray(room.members)) {
        const wasHost = room.hostId === socket.id;
        room.members = room.members.filter(m => m.socketId !== socket.id && (!effUid || String(m.id || m._id) !== String(effUid)));
        if (room.members.length === 0) {
          delete jamRooms[cleanCode];
          if (jamRooms[roomCode]) delete jamRooms[roomCode];
          for (const [k, t] of jamDisconnectTimeouts.entries()) {
            if (k.startsWith(`${cleanCode}:`)) {
              clearTimeout(t);
              jamDisconnectTimeouts.delete(k);
            }
          }
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
    } catch (err) {
      console.error('[Socket jam:leave_room error]', err.message);
    }
  });

  // Register Queue Sub-handlers
  registerJamQueueHandlers(io, socket, { jamRooms, isSocketHost });
}

const { handleJamDisconnect } = require('./jamLifecycle');

module.exports = {
  isSocketHost,
  registerJamHandlers,
  handleJamDisconnect
};
