const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Message, User } = require('../models');
const { auth, isVerifiedUser, isAdminUser } = require('../middleware/auth');
const { sanitizeText } = require('../utils/security');
const { BOT_EMAIL, getOrCreateSystemBot, handleAdminBroadcast } = require('../utils/chatBot');

// ── GET /conversations ──────────────────────────────────────────────────
router.get('/conversations', auth, async (req, res) => {
  try {
    const myId = String(req.user.id);
    const bot = await getOrCreateSystemBot();
    const botId = String(bot._id);

    const messages = await Message.find({
      $or: [{ sender: myId }, { recipient: myId }]
    })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const conversationMap = new Map();
    for (const msg of messages) {
      const otherId = String(msg.sender) === myId ? String(msg.recipient) : String(msg.sender);
      if (!conversationMap.has(otherId)) {
        conversationMap.set(otherId, msg);
      }
    }

    const otherUserIds = Array.from(conversationMap.keys());
    if (!otherUserIds.includes(botId) && myId !== botId) {
      otherUserIds.push(botId);
    }

    // Calculate unread messages count per conversation sender
    const myObjId = mongoose.isValidObjectId(myId) ? new mongoose.Types.ObjectId(myId) : null;
    const unreadMap = new Map();
    if (myObjId) {
      const unreadCounts = await Message.aggregate([
        {
          $match: {
            recipient: { $in: [myObjId, myId].filter(Boolean) },
            read: false
          }
        },
        {
          $group: {
            _id: '$sender',
            count: { $sum: 1 }
          }
        }
      ]).catch(() => []);
      unreadCounts.forEach(u => unreadMap.set(String(u._id), u.count));
    }

    const users = await User.find({ _id: { $in: otherUserIds } })
      .select('_id name avatar bio isBot email')
      .lean();

    const conversations = users.map(u => ({
      user: {
        id: String(u._id),
        _id: String(u._id),
        name: u.name,
        avatar: u.avatar || '',
        bio: u.bio || '',
        isVerified: isVerifiedUser(u.name),
        isBot: Boolean(u.isBot || String(u.email) === BOT_EMAIL)
      },
      unreadCount: unreadMap.get(String(u._id)) || 0,
      lastMessage: conversationMap.get(String(u._id)) || (String(u._id) === botId ? {
        text: 'Official Rivo System Bot. Announcements will appear here.',
        createdAt: bot.createdAt || new Date()
      } : null)
    }));

    conversations.sort((a, b) => {
      const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    res.json({ success: true, conversations });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /unread-count ───────────────────────────────────────────────────
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await Message.countDocuments({
      recipient: req.user.id,
      read: false
    });
    res.json({ success: true, count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /:recipientId (History) ─────────────────────────────────────────
// NOTE: Must NEVER mark messages as read automatically unless explicitly
// requested via `?markRead=1` by an active focused client on screen!
router.get('/:recipientId', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const recipientId = req.params.recipientId;

    if (!recipientId || recipientId === 'undefined' || recipientId === 'null' || !mongoose.isValidObjectId(recipientId)) {
      return res.json({ success: true, messages: [] });
    }

    const shouldMarkRead = req.query.markRead === '1' || req.query.markRead === 'true';
    if (shouldMarkRead) {
      await Message.updateMany(
        { sender: recipientId, recipient: currentUserId, read: false },
        { $set: { read: true } }
      ).catch(() => {});

      if (req.io) {
        req.io.to(`user:${recipientId}`).emit('chat:seen', {
          seenBy: currentUserId,
          senderId: recipientId,
          readAt: Date.now()
        });

        req.io.to(`user:${currentUserId}`).emit('chat:dismiss_notification', {
          senderId: recipientId
        });

        const unreadCount = await Message.countDocuments({
          recipient: currentUserId,
          read: false
        });
        req.io.to(`user:${currentUserId}`).emit('chat:unread_count', { count: unreadCount });
      }
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const filter = {
      $or: [
        { sender: currentUserId, recipient: recipientId },
        { sender: recipientId, recipient: currentUserId }
      ]
    };

    if (req.query.before) {
      filter.createdAt = { $lt: new Date(req.query.before) };
    }

    const rawMessages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rawMessages.length > limit;
    const messages = hasMore ? rawMessages.slice(0, limit) : rawMessages;
    messages.reverse();

    res.json({ success: true, messages, hasMore });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /:recipientId/read (Explicit Read Mark) ────────────────────────
router.post('/:recipientId/read', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const recipientId = req.params.recipientId;

    if (!recipientId || !mongoose.isValidObjectId(recipientId)) {
      return res.status(400).json({ error: 'Valid recipient ID is required' });
    }

    await Message.updateMany(
      { sender: recipientId, recipient: currentUserId, read: false },
      { $set: { read: true } }
    ).catch(() => {});

    if (req.io) {
      req.io.to(`user:${recipientId}`).emit('chat:seen', {
        seenBy: currentUserId,
        senderId: recipientId,
        readAt: Date.now()
      });

      req.io.to(`user:${currentUserId}`).emit('chat:dismiss_notification', {
        senderId: recipientId
      });

      const unreadCount = await Message.countDocuments({
        recipient: currentUserId,
        read: false
      });
      req.io.to(`user:${currentUserId}`).emit('chat:unread_count', { count: unreadCount });
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /react (Emoji toggle) ──────────────────────────────────────────
router.post('/react', auth, async (req, res) => {
  try {
    const { messageId, emoji } = req.body;
    if (!messageId || !emoji) return res.status(400).json({ error: 'messageId and emoji required' });
    if (!mongoose.isValidObjectId(messageId)) return res.status(400).json({ error: 'Invalid messageId' });

    const msg = await Message.findById(messageId);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    if (!Array.isArray(msg.reactions)) msg.reactions = [];

    const currentUserId = String(req.user.id);
    const existingIdx = msg.reactions.findIndex(
      r => String(r.userId) === currentUserId && r.emoji === emoji
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

    if (req.io) {
      req.io.to(`user:${msg.sender}`).emit('chat:reaction_updated', payload);
      req.io.to(`user:${msg.recipient}`).emit('chat:reaction_updated', payload);
    }

    res.json({ success: true, reactions: msg.reactions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /send (Send Message / Broadcast) ────────────────────────────────
router.post('/send', auth, async (req, res) => {
  try {
    const { recipientId, text, track, jamInvite } = req.body;
    if (!recipientId || typeof recipientId !== 'string') {
      return res.status(400).json({ error: 'Valid recipient ID is required' });
    }

    if (String(recipientId) === String(req.user.id)) {
      return res.status(400).json({ error: 'Cannot send message to yourself' });
    }

    const bot = await getOrCreateSystemBot();
    const botId = String(bot._id);
    const isSendingToBot = String(recipientId) === botId;

    if (!isSendingToBot && !mongoose.isValidObjectId(recipientId)) {
      return res.status(400).json({ error: 'Invalid recipient user ID' });
    }

    const cleanText = typeof text === 'string' ? sanitizeText(text) : '';
    if (!cleanText.trim() && !track && !jamInvite) {
      return res.status(400).json({ error: 'Message content, track or jam invite required' });
    }

    const sender = await User.findById(req.user.id).select('_id name avatar role email').lean();

    // Check for global broadcast command: /send all <message> or /sendall <message>
    const broadcastMatch = cleanText.match(/^\/send\s*all(?:\s+([\s\S]+))?$/i) || cleanText.match(/^\/sendall(?:\s+([\s\S]+))?$/i);
    const isAdmin = isAdminUser(req.user) || isAdminUser(sender);

    if (broadcastMatch) {
      const payload = await handleAdminBroadcast({ req, cleanText, broadcastMatch, bot, sender, isAdmin });
      return res.json({ success: true, message: payload });
    }

    // Message sent to System Bot
    if (isSendingToBot) {
      const userMsg = await new Message({
        sender: req.user.id,
        recipient: botId,
        text: cleanText,
        track: track || null,
        jamInvite: jamInvite || null,
        read: true
      }).save();

      const userMsgPayload = {
        ...userMsg.toObject(),
        senderName: sender?.name || 'You',
        senderAvatar: sender?.avatar || '',
        isBot: false
      };

      if (req.io) {
        req.io.to(`user:${req.user.id}`).emit('chat:message', userMsgPayload);
      }

      let helpText = isAdmin
        ? '🤖 Rivo Bot Admin Console:\n\nTo broadcast an announcement to ALL registered users as a direct message, type:\n`/send all <your message>`\nor\n`/sendall <your message>`'
        : '🤖 Hello! I am Rivo Bot. Official system updates, feature releases, and notifications will be delivered to you here. Stay tuned!';

      const autoReply = await new Message({
        sender: botId,
        recipient: req.user.id,
        text: helpText,
        read: false
      }).save();

      if (req.io) {
        req.io.to(`user:${req.user.id}`).emit('chat:message', {
          ...autoReply.toObject(),
          senderName: bot.name,
          senderAvatar: bot.avatar,
          isBot: true
        });
      }

      return res.json({ success: true, message: userMsgPayload });
    }

    // Normal user-to-user message
    const msg = await new Message({
      sender: req.user.id,
      recipient: recipientId,
      text: cleanText,
      track: track || null,
      jamInvite: jamInvite || null
    }).save();

    const payload = {
      ...msg.toObject(),
      senderName: sender?.name || 'Friend',
      senderAvatar: sender?.avatar || ''
    };

    if (req.io) {
      req.io.to(`user:${recipientId}`).emit('chat:message', payload);
      req.io.to(`user:${req.user.id}`).emit('chat:message', payload);

      if (jamInvite && jamInvite.roomCode) {
        req.io.to(`user:${recipientId}`).emit('jam:invite_received', {
          roomCode: jamInvite.roomCode,
          host: {
            id: req.user.id,
            name: sender?.name || jamInvite.hostName || 'Friend',
            avatar: sender?.avatar || jamInvite.hostAvatar || ''
          },
          createdAt: Date.now()
        });
      }
    }

    res.json({ success: true, message: payload });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
