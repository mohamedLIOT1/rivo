const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { User, Track } = require('../models');
const { optionalAuth, isVerifiedUser } = require('../middleware/auth');

function getCurrentISOWeek() {
  const d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

router.post('/listen', optionalAuth, async (req, res) => {
  try {
    const { trackId, title, artist, cover, seconds = 0, isCompleted = false } = req.body;
    const sec = Math.max(0, Math.min(300, Number(seconds) || 0));
    const currentWeek = getCurrentISOWeek();

    // 1. If user is authenticated, update their real stats
    if (req.user?.id) {
      const user = await User.findById(req.user.id);
      if (user) {
        if (user.weeklyWeek !== currentWeek) {
          user.weeklyWeek = currentWeek;
          user.weeklyListeningSeconds = 0;
        }

        user.totalListeningSeconds = (user.totalListeningSeconds || 0) + sec;
        user.weeklyListeningSeconds = (user.weeklyListeningSeconds || 0) + sec;

        const clientTop = req.body.clientTopTrack;
        if (clientTop && clientTop.title && clientTop.artist) {
          user.topTrack = {
            id: clientTop.id || trackId,
            title: clientTop.title,
            artist: clientTop.artist,
            cover: clientTop.cover || cover || user.topTrack?.cover || '',
            plays: Number(clientTop.plays) || 1,
            seconds: Number(clientTop.seconds) || sec
          };
        } else if (title && artist) {
          if (!user.topTrack || !user.topTrack.title) {
            user.topTrack = { id: trackId, title, artist, cover: cover || '', plays: isCompleted ? 1 : 0, seconds: sec };
          } else if (user.topTrack.title === title) {
            user.topTrack.seconds = (user.topTrack.seconds || 0) + sec;
            if (isCompleted) user.topTrack.plays = (user.topTrack.plays || 0) + 1;
            if (cover) user.topTrack.cover = cover;
          }
        }

        user.lastActiveAt = new Date();
        await user.save();
      }
    }

    // 2. Increment real track plays in Track collection if completed
    if (isCompleted && trackId) {
      await Track.updateOne(
        { $or: [{ _id: mongoose.isValidObjectId(trackId) ? trackId : null }, { id: trackId }] },
        { $inc: { plays: 1 } }
      ).catch(() => {});
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/leaderboard', optionalAuth, async (req, res) => {
  try {
    const currentWeek = getCurrentISOWeek();
    const users = await User.find({})
      .select('_id name avatar role isAdmin isVerified totalListeningSeconds weeklyListeningSeconds weeklyWeek topTrack')
      .lean();

    const currentUserId = req.user?.id ? String(req.user.id) : '';

    const leaderboard = users.map(u => {
      const isCurWeek = u.weeklyWeek === currentWeek;
      const weeklySec = isCurWeek ? (u.weeklyListeningSeconds || 0) : 0;
      const totalSec = u.totalListeningSeconds || 0;
      const effectiveSec = weeklySec > 0 ? weeklySec : (totalSec > 0 ? totalSec : 0);
      const minutes = Math.floor(effectiveSec / 60);

      return {
        id: String(u._id),
        name: u.name,
        avatar: u.avatar || '',
        minutes,
        seconds: effectiveSec,
        topSong: u.topTrack?.title ? `${u.topTrack.title} - ${u.topTrack.artist}` : 'Various Tracks',
        isVerified: isVerifiedUser(u.name) || Boolean(u.isVerified),
        isCurrentUser: Boolean(currentUserId && String(u._id) === currentUserId)
      };
    });

    leaderboard.sort((a, b) => b.seconds - a.seconds);

    const ranked = leaderboard.map((item, idx) => ({
      ...item,
      rank: idx + 1
    }));

    res.json({
      success: true,
      currentWeek,
      leaderboard: ranked
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
