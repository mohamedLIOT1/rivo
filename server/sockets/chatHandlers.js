/**
 * Chat, Notification & Device Coordination Real-Time Socket Handlers
 * Strictly modularized (< 400 lines), zero unhandled socket exceptions.
 */

const mongoose = require('mongoose');
const { User, Message } = require('../models');
const { verifyJwt } = require('../middleware/auth');
const discordActivity = require('../discordActivity');

function registerChatHandlers(io, socket, {
  userSocketMap,
  userDeviceSessions,
  userDisconnectGraceTimers,
  notifyFollowersStatus,
  pushBetaUpdateIfEligible
}) {
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

  // Typing indicator (strictly authenticated sender)
  socket.on('chat:typing', ({ recipientId, isTyping }) => {
    try {
      if (!socket.userId || !recipientId) return;
      const payload = {
        senderId: socket.userId,
        isTyping: Boolean(isTyping)
      };
      io.to(`user:${recipientId}`).emit('chat:typing', payload);
      const recipientSockets = userSocketMap.get(String(recipientId));
      if (recipientSockets) {
        recipientSockets.forEach(sid => io.to(sid).emit('chat:typing', payload));
      }
    } catch (err) {
      console.error('[Socket chat:typing error]', err.message);
    }
  });

  // Real-time notification sending (strictly authenticated sender)
  socket.on('notification:send', ({ recipientId, title, body, data }) => {
    try {
      if (!socket.userId || !recipientId) return;
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
    } catch (err) {
      console.error('[Socket notification:send error]', err.message);
    }
  });

  // User online registration (Reject unauthenticated user spoofing)
  const handleUserOnline = (data) => {
    try {
      authenticateSocketEvent(data);
      const uidStr = socket.userId;
      if (!uidStr) return;
      if (userDisconnectGraceTimers.has(uidStr)) {
        clearTimeout(userDisconnectGraceTimers.get(uidStr));
        userDisconnectGraceTimers.delete(uidStr);
      }
      socket.join(`user:${uidStr}`);
      if (!userSocketMap.has(uidStr)) {
        userSocketMap.set(uidStr, new Set());
      }
      userSocketMap.get(uidStr).add(socket.id);

      io.emit('user:status', { userId: uidStr, isOnline: true });
      notifyFollowersStatus(uidStr, true);
      pushBetaUpdateIfEligible(uidStr);
    } catch (err) {
      console.error('[Socket user:online error]', err.message);
    }
  };

  socket.on('user:online', handleUserOnline);
  socket.on('user_connected', handleUserOnline);

  // Device Playback Coordination
  socket.on('device:playback_state', ({ isPlaying, track, currentTime, deviceType, deviceName }) => {
    try {
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
    } catch (err) {
      console.error('[Socket device:playback_state error]', err.message);
    }
  });

  socket.on('device:request_state', () => {
    try {
      const uid = socket.userId;
      if (!uid) return;
      const session = userDeviceSessions.get(uid);
      if (session && session.activeSocketId !== socket.id) {
        socket.emit('device:remote_playing', session);
      }
    } catch (err) {
      console.error('[Socket device:request_state error]', err.message);
    }
  });

  // Send chat message (strictly verified sender for 1-on-1 private messaging)
  socket.on('send_chat_message', async (data, callback) => {
    try {
      if (!data) return;
      const text = typeof data === 'string' ? data : (data.text || data.message || '');
      const cleanText = typeof text === 'string' ? text.trim() : '';
      const recipientId = data.recipientId || data.recipient || null;
      const roomCode = data.roomCode || null;

      // Anti-spoofing: 1-on-1 messages require authenticated socket.userId
      if (recipientId && !socket.userId) {
        if (typeof callback === 'function') callback({ success: false, error: 'Authentication required for private messaging' });
        return;
      }

      const senderId = socket.userId || (roomCode ? (data.senderId || socket.id) : null);
      if (!senderId) return;

      const senderName = data.senderName || 'Listener';
      const senderAvatar = data.senderAvatar || '';

      // Create document in MongoDB FIRST so the message has its real MongoDB _id
      let savedMsg = null;
      if (socket.userId && recipientId && mongoose.isValidObjectId(recipientId)) {
        try {
          savedMsg = await Message.create({
            sender: socket.userId,
            recipient: recipientId,
            text: cleanText,
            track: data.track || null,
            jamInvite: data.jamInvite || null,
            read: false
          });
        } catch (dbErr) {
          console.warn('[Message.create error]', dbErr.message);
        }
      }

      const realId = savedMsg ? String(savedMsg._id) : (data._id || data.id || `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

      const msgPayload = {
        id: realId,
        _id: realId,
        sender: senderId,
        senderId: senderId,
        senderName: senderName,
        senderAvatar: senderAvatar,
        text: cleanText,
        track: data.track || null,
        jamInvite: data.jamInvite || null,
        recipient: recipientId,
        recipientId: recipientId,
        timestamp: savedMsg?.createdAt ? savedMsg.createdAt.toISOString() : (data.timestamp || new Date().toISOString()),
        createdAt: savedMsg?.createdAt || new Date(),
        reactions: []
      };

      if (recipientId) {
        const recStr = String(recipientId);
        io.to(`user:${recStr}`).emit('chat:message', msgPayload);
        io.to(`user:${recStr}`).emit('new_chat_message', msgPayload);
        const recipientSockets = userSocketMap.get(recStr);
        if (recipientSockets) {
          recipientSockets.forEach(sid => {
            io.to(sid).emit('chat:message', msgPayload);
            io.to(sid).emit('new_chat_message', msgPayload);
          });
        }
        if (socket.userId) {
          socket.to(`user:${socket.userId}`).emit('chat:message', msgPayload);
          socket.to(`user:${socket.userId}`).emit('new_chat_message', msgPayload);
        }
      } else if (roomCode) {
        const cleanCode = String(roomCode).trim().toUpperCase();
        io.to(cleanCode).emit('chat:message', msgPayload);
        io.to(cleanCode).emit('new_chat_message', msgPayload);
      } else {
        socket.broadcast.emit('new_chat_message', msgPayload);
      }

      if (typeof callback === 'function') {
        callback({ success: true, message: msgPayload });
      }
    } catch (err) {
      console.error('[Socket send_chat_message error]', err.message);
      if (typeof callback === 'function') callback({ success: false, error: err.message });
    }
  });

  // Live listening activity
  socket.on('activity:listening', async ({ track, isPlaying, currentTime }) => {
    try {
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
    } catch (err) {
      console.error('[Socket activity:listening error]', err.message);
    }
  });

  // Chat mark read
  socket.on('chat:mark_read', async ({ senderId }) => {
    try {
      const currentUserId = socket.userId;
      if (!currentUserId || !senderId) return;

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

      const unreadCount = await Message.countDocuments({
        recipient: currentUserId,
        read: false
      });
      io.to(`user:${currentUserId}`).emit('chat:unread_count', { count: unreadCount });
      const mySockets = userSocketMap?.get(String(currentUserId));
      if (mySockets) {
        mySockets.forEach(sid => io.to(sid).emit('chat:unread_count', { count: unreadCount }));
      }
    } catch (err) {
      console.error('[Socket chat:mark_read error]', err.message);
    }
  });

  // Chat message reaction toggle (real-time)
  socket.on('chat:reaction', async ({ messageId, emoji }) => {
    try {
      const currentUserId = socket.userId;
      if (!currentUserId || !messageId || !emoji) return;

      const msg = await Message.findById(messageId);
      if (!msg) return;

      if (!Array.isArray(msg.reactions)) msg.reactions = [];

      const existingIdx = msg.reactions.findIndex(
        r => String(r.userId?._id || r.userId) === String(currentUserId) && r.emoji === emoji
      );

      if (existingIdx >= 0) {
        msg.reactions.splice(existingIdx, 1);
      } else {
        msg.reactions.push({ emoji, userId: currentUserId });
      }

      msg.markModified('reactions');
      await msg.save();

      const payload = {
        messageId: String(msg._id),
        reactions: msg.reactions,
        senderId: String(msg.sender),
        recipientId: String(msg.recipient)
      };

      io.to(`user:${msg.sender}`).emit('chat:reaction_updated', payload);
      io.to(`user:${msg.recipient}`).emit('chat:reaction_updated', payload);
      const recipientSockets = userSocketMap?.get(String(msg.recipient));
      if (recipientSockets) {
        recipientSockets.forEach(sid => io.to(sid).emit('chat:reaction_updated', payload));
      }
      const senderSockets = userSocketMap?.get(String(msg.sender));
      if (senderSockets) {
        senderSockets.forEach(sid => io.to(sid).emit('chat:reaction_updated', payload));
      }
    } catch (err) {
      console.error('[Socket chat:reaction error]', err.message);
    }
  });
}

module.exports = {
  registerChatHandlers
};
