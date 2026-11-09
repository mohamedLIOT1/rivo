const { User, Message } = require('../models');

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

async function handleAdminBroadcast({ req, cleanText, broadcastMatch, bot, sender, isAdmin }) {
  const botId = String(bot._id);

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

    return userCmdPayload;
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
    return userCmdPayload;
  }

  // Broadcast to all registered users (excluding bot and broadcasting admin)
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

  return userCmdPayload;
}

module.exports = {
  BOT_EMAIL,
  BOT_NAME,
  BOT_AVATAR,
  getOrCreateSystemBot,
  handleAdminBroadcast
};
