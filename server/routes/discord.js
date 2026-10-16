const express = require('express');
const router = express.Router();
const { User } = require('../models');
const { auth } = require('../middleware/auth');
const discordActivity = require('../discordActivity');

router.get('/status', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('discord');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      linked: Boolean(user.discord?.token),
      username: user.discord?.username || '',
      enabled: user.discord?.enabled !== false,
      linkCode: user.discord?.linkCode || ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/link-code', auth, async (req, res) => {
  try {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await User.findByIdAndUpdate(req.user.id, {
      $set: { 'discord.linkCode': code, 'discord.linkCodeExpires': expires }
    });
    res.json({ success: true, code, expires });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/link-token', auth, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || token.length < 40) return res.status(400).json({ error: 'Invalid Discord token format' });

    const { Client: SelfClient } = require('discord.js-selfbot-v13');
    const testClient = new SelfClient({ checkUpdate: false });

    await testClient.login(token);
    const discordTag = testClient.user.tag;
    const discordId = testClient.user.id;
    testClient.destroy();

    const encrypted = discordActivity.encryptToken(token);
    const user = await User.findByIdAndUpdate(req.user.id, {
      $set: {
        'discord.id': discordId,
        'discord.username': discordTag,
        'discord.token': encrypted,
        'discord.enabled': true
      }
    }, { new: true });

    if (user.currentListening?.isPlaying) {
      discordActivity.handleUserListening(user, user.currentListening, true);
    }

    res.json({ success: true, username: discordTag });
  } catch (err) {
    res.status(400).json({ error: 'Failed to verify token: ' + err.message });
  }
});

router.post('/unlink', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $set: {
        'discord.id': '',
        'discord.username': '',
        'discord.token': '',
        'discord.enabled': false
      }
    });
    discordActivity.disconnectUserSession(String(req.user.id));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/toggle', auth, async (req, res) => {
  try {
    const { enabled } = req.body;
    const user = await User.findByIdAndUpdate(req.user.id, {
      $set: { 'discord.enabled': Boolean(enabled) }
    }, { new: true });

    if (!enabled) {
      discordActivity.disconnectUserSession(String(req.user.id));
    } else if (user.currentListening?.isPlaying) {
      discordActivity.handleUserListening(user, user.currentListening, true);
    }
    res.json({ success: true, enabled: user.discord.enabled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
