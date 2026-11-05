/**
 * Jam Queue & Playback Advancement Real-Time Socket Handlers
 * Strictly modularized (< 400 lines), zero unhandled socket exceptions.
 */

function registerJamQueueHandlers(io, socket, { jamRooms, isSocketHost }) {
  // Jam: Add to queue
  socket.on('jam:add_to_queue', ({ roomCode, track, tracks, playNext, userId }) => {
    try {
      const cleanCode = String(roomCode || '').trim().toUpperCase();
      const room = jamRooms[cleanCode] || jamRooms[roomCode];
      if (room) {
        let rawList = [];
        if (Array.isArray(tracks)) rawList = tracks;
        else if (Array.isArray(track)) rawList = track;
        else if (track) rawList = [track];

        const validList = rawList.filter(Boolean);
        if (validList.length === 0) return;

        const isHost = isSocketHost(room, socket);
        const canControl = isHost || !room.hostOnlyControl;

        let remainingTracks = [...validList];
        if (!room.currentTrack && canControl) {
          const firstTrack = remainingTracks.shift();
          room.currentTrack = firstTrack;
          room.isPlaying = true;
          room.currentTime = 0;
          room.updatedAt = Date.now();

          const payload = {
            isPlaying: true,
            currentTrack: firstTrack,
            currentTime: 0,
            updatedAt: room.updatedAt,
            initiatorId: socket.id
          };
          io.to(cleanCode).emit('jam:on_play_state_changed', payload);
          io.to(cleanCode).emit('jam:sync_play_state', payload);
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
    } catch (err) {
      console.error('[Socket jam:add_to_queue error]', err.message);
    }
  });

  // Jam: Remove from queue
  socket.on('jam:remove_from_queue', ({ roomCode, trackIndex, trackId }) => {
    try {
      const cleanCode = String(roomCode || '').trim().toUpperCase();
      const room = jamRooms[cleanCode] || jamRooms[roomCode];
      if (!room || !Array.isArray(room.queue)) return;

      const member = (room.members || []).find(m => m.socketId === socket.id);
      if (!member) return;

      const isHost = isSocketHost(room, socket);
      if (room.hostOnlyControl && !isHost) return;

      if (typeof trackIndex === 'number' && trackIndex >= 0 && trackIndex < room.queue.length) {
        room.queue.splice(trackIndex, 1);
      } else if (trackId) {
        room.queue = room.queue.filter(t => String(t.id || t._id) !== String(trackId));
      }
      io.to(cleanCode).emit('jam:room_updated', room);
      io.to(cleanCode).emit('jam_updated', room);
    } catch (err) {
      console.error('[Socket jam:remove_from_queue error]', err.message);
    }
  });

  // Jam: Reorder queue
  socket.on('jam:reorder_queue', ({ roomCode, fromIndex, toIndex }) => {
    try {
      const cleanCode = String(roomCode || '').trim().toUpperCase();
      const room = jamRooms[cleanCode] || jamRooms[roomCode];
      if (!room || !Array.isArray(room.queue)) return;

      const member = (room.members || []).find(m => m.socketId === socket.id);
      if (!member) return;

      const isHost = isSocketHost(room, socket);
      if (room.hostOnlyControl && !isHost) return;

      if (typeof fromIndex === 'number' && typeof toIndex === 'number' &&
          fromIndex >= 0 && fromIndex < room.queue.length &&
          toIndex >= 0 && toIndex < room.queue.length) {
        const [moved] = room.queue.splice(fromIndex, 1);
        room.queue.splice(toIndex, 0, moved);
        io.to(cleanCode).emit('jam:room_updated', room);
        io.to(cleanCode).emit('jam_updated', room);
      }
    } catch (err) {
      console.error('[Socket jam:reorder_queue error]', err.message);
    }
  });

  // Jam: Next track
  socket.on('jam:next_track', ({ roomCode }) => {
    try {
      const cleanCode = String(roomCode || '').trim().toUpperCase();
      const room = jamRooms[cleanCode] || jamRooms[roomCode];
      if (room) {
        const isHost = isSocketHost(room, socket);
        const canControl = isHost || !room.hostOnlyControl;
        if (!canControl) return;

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
    } catch (err) {
      console.error('[Socket jam:next_track error]', err.message);
    }
  });

  // Jam: Prev track
  socket.on('jam:prev_track', ({ roomCode }) => {
    try {
      const cleanCode = String(roomCode || '').trim().toUpperCase();
      const room = jamRooms[cleanCode] || jamRooms[roomCode];
      if (room) {
        const isHost = isSocketHost(room, socket);
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
    } catch (err) {
      console.error('[Socket jam:prev_track error]', err.message);
    }
  });
}

module.exports = {
  registerJamQueueHandlers
};
