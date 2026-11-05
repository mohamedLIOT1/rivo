/**
 * Jam Session Disconnection & Host Migration Lifecycle
 * Strictly modularized (< 400 lines), zero unhandled socket exceptions.
 */

function handleJamDisconnect(io, socket, { jamRooms, jamDisconnectTimeouts }) {
  try {
    for (const code in jamRooms) {
      const room = jamRooms[code];
      if (!room || !Array.isArray(room.members)) continue;
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
          try {
            jamDisconnectTimeouts.delete(key);
            const currentRoom = jamRooms[code];
            if (!currentRoom || !Array.isArray(currentRoom.members)) return;

            currentRoom.members = currentRoom.members.filter(m => m.socketId !== socket.id && (!member?.id || String(m.id || m._id) !== String(member.id || member._id)));

            if (currentRoom.members.length === 0) {
              delete jamRooms[code];
              for (const [k, t] of jamDisconnectTimeouts.entries()) {
                if (k.startsWith(`${code}:`)) {
                  clearTimeout(t);
                  jamDisconnectTimeouts.delete(k);
                }
              }
            } else {
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
          } catch (tErr) {
            console.error('[Socket JamDisconnect timeout error]', tErr.message);
          }
        }, gracePeriodMs);

        jamDisconnectTimeouts.set(key, timer);
      }
    }
  } catch (err) {
    console.error('[Socket handleJamDisconnect error]', err.message);
  }
}

module.exports = {
  handleJamDisconnect
};
