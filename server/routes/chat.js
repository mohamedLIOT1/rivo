const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { Message, User } = require('../models');
const { auth, isVerifiedUser } = require('../middleware/auth');
const { sanitizeText } = require('../utils/security');

router.get('/conversations', auth, async (req, res) => {
  try {
    const myId = String(req.user.id);
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
    const users = await User.find({ _id: { $in: otherUserIds } })
      .select('_id name avatar bio')
      .lean();

    const conversations = users.map(u => ({
      user: {
        id: String(u._id),
        name: u.name,
        avatar: u.avatar || '',
        bio: u.bio || '',
        isVerified: isVerifiedUser(u.name)
      },
      lastMessage: conversationMap.get(String(u._id))
    }));

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

    const sender = await User.findById(req.user.id).select('_id name avatar').lean();

    const cleanText = sanitizeText(text || '');
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
