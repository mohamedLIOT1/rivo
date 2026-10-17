const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Message, User } = require('../models');
const { auth, isVerifiedUser, isAdminUser } = require('../middleware/auth');
const { sanitizeText } = require('../utils/security');

const BOT_EMAIL = 'bot@rivo.app';
const BOT_NAME = 'Rivo Bot';
const BOT_AVATAR = 'https://rivo-m.duckdns.org/public/assets/rivo-bot.png';

async function getOrCreateSystemBot() {
  let bot = await User.findOne({ email: BOT_EMAIL });
  if (!bot) {
    bot = await User.findOne({ isBot: true });
  }
  if (!bot) {
    bot = await User.create({
      name: BOT_NAME,
      email: BOT_EMAIL,
      password: 'SYSTEM_BOT_NO_LOGIN_' + Math.random().toString(36),
      isBot: true,
      bio: 'Official Rivo System Bot & Announcements',
      avatar: BOT_AVATAR
    });
  } else {
    let changed = false;
    if (!bot.isBot) {
      bot.isBot = true;
      changed = true;
    }
    if (!bot.avatar || bot.avatar.includes('unsplash.com')) {
      bot.avatar = BOT_AVATAR;
      changed = true;
    }
    if (changed) {
      await bot.save();
    }
  }
  return bot;
}

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
      lastMessage: conversationMap.get(String(u._id)) || (String(u._id) === botId ? {
        text: 'Official Rivo System Bot. Announcements will appear here.',
        createdAt: bot.createdAt || new Date()
      } : null)
    }));

    // Sort: most recent message first
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

router.get('/:recipientId', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const recipientId = req.params.recipientId;

    if (!recipientId || recipientId === 'undefined' || recipientId === 'null' || !mongoose.isValidObjectId(recipientId)) {
      return res.json({ success: true, messages: [] });
    }

    // Mark messages from this sender to current user as read
    await Message.updateMany(
      { sender: recipientId, recipient: currentUserId, read: false },
      { $set: { read: true } }
    ).catch(() => {});

    if (req.io) {
      // Notify original sender that their messages were seen
      req.io.to(`user:${recipientId}`).emit('chat:seen', {
        seenBy: currentUserId,
        senderId: recipientId,
        readAt: Date.now()
      });

      // Dismiss notification on reader's other connected devices (e.g. mobile/desktop sync)
      req.io.to(`user:${currentUserId}`).emit('chat:dismiss_notification', {
        senderId: recipientId
      });
    }

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, recipient: recipientId },
        { sender: recipientId, recipient: currentUserId }
      ]
    })
    .sort({ createdAt: 1 })
    .limit(100)
    .lean();

    res.json({ success: true, messages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/send', auth, async (req, res) => {
  try {
    const { recipientId, text, track, jamInvite } = req.body;
    if (!recipientId) return res.status(400).json({ error: 'Recipient required' });

    const bot = await getOrCreateSystemBot();
    const botId = String(bot._id);
    const isSendingToBot = String(recipientId) === botId;

    const sender = await User.findById(req.user.id).select('_id name avatar role email').lean();
    const cleanText = sanitizeText(text || '');

    // Check for global broadcast command: /send all <message> or /sendall <message>
    const broadcastMatch = cleanText.match(/^\/send\s*all(?:\s+([\s\S]+))?$/i) || cleanText.match(/^\/sendall(?:\s+([\s\S]+))?$/i);
    const isAdmin = isAdminUser(req.user) || isAdminUser(sender);

    if (broadcastMatch) {
      // 1. Record admin's command in the Bot thread
      const userCmdMsg = await new Message({
        sender: req.user.id,
        recipient: botId,
        text: cleanText,
        read: true
      }).save();

      const userCmdPayload = {
        ...userCmdMsg.toObject(),
        senderName: sender?.name || 'You',
        senderAvatar: sender?.avatar || '',
        isBot: false
      };

      if (req.io) {
        req.io.to(`user:${req.user.id}`).emit('chat:message', userCmdPayload);
      }

      if (!isAdmin) {
        // Reject non-admin
        const botReply = await new Message({
          sender: botId,
          recipient: req.user.id,
          text: '⛔ Permission denied: Only system administrators can broadcast announcements.',
          read: false
        }).save();

        if (req.io) {
          req.io.to(`user:${req.user.id}`).emit('chat:message', {
            ...botReply.toObject(),
            senderName: bot.name,
            senderAvatar: bot.avatar,
            isBot: true
          });
        }

        return res.json({ success: true, message: userCmdPayload });
      }

      const broadcastBody = (broadcastMatch[1] || '').trim();
      if (!broadcastBody) {
        const hintMsg = await new Message({
          sender: botId,
          recipient: req.user.id,
          text: '🤖 Broadcast usage:\n`/send all <your announcement message>`\nor\n`/sendall <your announcement message>`',
          read: true
        }).save();

        if (req.io) {
          req.io.to(`user:${req.user.id}`).emit('chat:message', {
            ...hintMsg.toObject(),
            senderName: bot.name,
            senderAvatar: bot.avatar,
            isBot: true
          });
        }
        return res.json({ success: true, message: userCmdPayload });
      }

      // Broadcast to all registered users (excluding bot and the broadcasting admin)
      const allUsers = await User.find({ _id: { $nin: [bot._id, req.user._id, req.user.id] } }).select('_id').lean();

      if (allUsers.length > 0) {
        const bulkMessages = allUsers.map(u => ({
          sender: bot._id,
          recipient: u._id,
          text: broadcastBody,
          read: false
        }));

        await Message.insertMany(bulkMessages);

        // Emit to all users in real-time
        if (req.io) {
          allUsers.forEach(u => {
            const uIdStr = String(u._id);
            req.io.to(`user:${uIdStr}`).emit('chat:message', {
              sender: botId,
              recipient: uIdStr,
              text: broadcastBody,
              senderName: bot.name,
              senderAvatar: bot.avatar,
              isBot: true,
              read: uIdStr === String(req.user.id),
              createdAt: new Date()
            });
          });
        }
      }

      // Send confirmation back to Admin in bot thread
      const confirmMsg = await new Message({
        sender: botId,
        recipient: req.user.id,
        text: `📢 System Announcement successfully broadcasted to ${allUsers.length} users!\n\n"${broadcastBody}"`,
        read: true
      }).save();

      if (req.io) {
        req.io.to(`user:${req.user.id}`).emit('chat:message', {
          ...confirmMsg.toObject(),
          senderName: bot.name,
          senderAvatar: bot.avatar,
          isBot: true
        });
      }

      return res.json({ success: true, message: userCmdPayload });
    }

    // Check if sending a regular message to System Bot
    if (isSendingToBot) {
      // 1. Save user's message to Bot in database
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

      // Non-broadcast message sent to bot
      let helpText = '';
      if (isAdmin) {
        helpText = '🤖 Rivo Bot Admin Console:\n\nTo broadcast an announcement to ALL registered users as a direct message, type:\n`/send all <your message>`\nor\n`/sendall <your message>`';
      } else {
        helpText = '🤖 Hello! I am Rivo Bot. Official system updates, feature releases, and notifications will be delivered to you here. Stay tuned!';
      }

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
