const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { User, Track } = require('../models');
const { optionalAuth, isVerifiedUser } = require('../middleware/auth');
const { classifyGenre, GENERIC_GENRES } = require('../utils/genreClassifier');

async function resolveListeningGenre({ trackId, title, artist, genre }) {
  const rawGenre = String(genre || '').trim();
  const isGeneric = !rawGenre || GENERIC_GENRES.has(rawGenre.toLowerCase());
  let dbTrack = null;
  if (isGeneric && trackId) {
    try {
      const cond = mongoose.isValidObjectId(trackId) ? { _id: trackId } : { id: String(trackId) };
      dbTrack = await Track.findOne(cond).select('title artist album genre').lean();
    } catch {}
  }
  const cls = classifyGenre({
    title: dbTrack?.title || title || '',
    artist: dbTrack?.artist || artist || '',
    album: dbTrack?.album || '',
    genre: rawGenre || dbTrack?.genre || ''
  });
  return cls?.genre || rawGenre || '';
}

function updateUserHistoryAndGenres(user, { trackId, title, artist, genre, seconds, isCompleted }) {
  if (seconds > 0 && genre) {
    const safeKey = String(genre).replace(/[.$]/g, '_').trim();
    if (safeKey) {
      const prevMap = user.topGenres && typeof user.topGenres === 'object' ? { ...user.topGenres } : {};
      prevMap[safeKey] = (Number(prevMap[safeKey]) || 0) + seconds;
      const entries = Object.entries(prevMap);
      if (entries.length > 40) {
        entries.sort((a, b) => (Number(b[1]) || 0) - (Number(a[1]) || 0));
        user.topGenres = Object.fromEntries(entries.slice(0, 40));
      } else {
        user.topGenres = prevMap;
      }
      if (typeof user.markModified === 'function') user.markModified('topGenres');
    }
  }

  if ((title || trackId) && (seconds > 0 || isCompleted)) {
    const normId = String(trackId || '').trim();
    const normTitle = String(title || '').trim();
    const normArtist = String(artist || '').trim();
    const tLower = normTitle.toLowerCase();
    const aLower = normArtist.toLowerCase();

    const prevHistory = Array.isArray(user.recentHistory) ? user.recentHistory : [];
    const deduped = prevHistory.filter((item) => {
      if (!item) return false;
      if (normId && item.trackId && String(item.trackId) === normId) return false;
      if (tLower && String(item.title || '').trim().toLowerCase() === tLower &&
        String(item.artist || '').trim().toLowerCase() === aLower) {
        return false;
      }
      return true;
    });

    user.recentHistory = [
      {
        trackId: normId,
        title: normTitle,
        artist: normArtist,
        genre: String(genre || '').trim(),
        playedAt: new Date()
      },
      ...deduped
    ].slice(0, 40);
    if (typeof user.markModified === 'function') user.markModified('recentHistory');
  }
}

function getCurrentISOWeek() {
  const d = new Date();
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// Ensure trackStats schema path exists on User
if (User && User.schema && !User.schema.path('trackStats')) {
  User.schema.add({ trackStats: { type: Object, default: {} } });
}

router.post('/listen', optionalAuth, async (req, res) => {
  try {
    const { trackId, title, artist, cover, genre, seconds = 0, isCompleted = false } = req.body;
    // Cap single payload at 600 seconds (10 mins) to support background tab flushes
    const sec = Math.max(0, Math.min(600, Number(seconds) || 0));
    const currentWeek = getCurrentISOWeek();

    let updatedTotalSeconds = 0;
    let updatedWeeklySeconds = 0;
    let updatedTopTrack = null;

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

        // Retrieve or initialize per-track stats
        const rawTrackStats = user.trackStats || (user.get && user.get('trackStats')) || {};
        const trackStats = typeof rawTrackStats === 'object' && rawTrackStats !== null ? { ...rawTrackStats } : {};

        // Seed existing topTrack into trackStats if not already present
        if (user.topTrack?.title && user.topTrack?.artist) {
          const seedKey = String(user.topTrack.id || `${user.topTrack.title}___${user.topTrack.artist}`).replace(/\./g, '_');
          if (!trackStats[seedKey]) {
            trackStats[seedKey] = {
              id: user.topTrack.id || '',
              title: user.topTrack.title,
              artist: user.topTrack.artist,
              cover: user.topTrack.cover || '',
              seconds: Number(user.topTrack.seconds) || 0,
              plays: Number(user.topTrack.plays) || 0
            };
          }
        }

        // Record stats for current track if provided
        if ((title && artist) || trackId) {
          const trackKey = String(trackId || `${title}___${artist}`).replace(/\./g, '_');
          const prev = trackStats[trackKey] || {
            id: trackId || '',
            title: title || '',
            artist: artist || '',
            cover: cover || '',
            seconds: 0,
            plays: 0
          };
          prev.seconds = (Number(prev.seconds) || 0) + sec;
          if (isCompleted) prev.plays = (Number(prev.plays) || 0) + 1;
          if (cover && !prev.cover) prev.cover = cover;
          if (title) prev.title = title;
          if (artist) prev.artist = artist;
          trackStats[trackKey] = prev;
        }

        user.set('trackStats', trackStats, { strict: false });
        if (typeof user.markModified === 'function') {
          user.markModified('trackStats');
        }

        // Dynamically compute winning top track based on real playtime across songs
        const clientTop = req.body.clientTopTrack;
        if (clientTop && clientTop.title && clientTop.artist && (clientTop.seconds > 0 || clientTop.plays > 0)) {
          user.topTrack = {
            id: clientTop.id || trackId,
            title: clientTop.title,
            artist: clientTop.artist,
            cover: clientTop.cover || cover || user.topTrack?.cover || '',
            plays: Number(clientTop.plays) || 1,
            seconds: Number(clientTop.seconds) || sec
          };
        } else {
          const allTracks = Object.values(trackStats);
          if (allTracks.length > 0) {
            allTracks.sort((a, b) => {
              const secDiff = (Number(b.seconds) || 0) - (Number(a.seconds) || 0);
              if (secDiff !== 0) return secDiff;
              return (Number(b.plays) || 0) - (Number(a.plays) || 0);
            });
            const topCandidate = allTracks[0];
            if (topCandidate && ((topCandidate.seconds || 0) > 0 || (topCandidate.plays || 0) > 0)) {
              user.topTrack = {
                id: topCandidate.id || trackId,
                title: topCandidate.title,
                artist: topCandidate.artist,
                cover: topCandidate.cover || cover || '',
                plays: topCandidate.plays || (topCandidate.seconds >= 15 ? 1 : 0),
                seconds: topCandidate.seconds || 0
              };
            }
          } else if (title && artist) {
            user.topTrack = {
              id: trackId,
              title,
              artist,
              cover: cover || '',
              plays: isCompleted ? 1 : 0,
              seconds: sec
            };
          }
        }

        const resolvedGenre = (sec > 0 || isCompleted)
          ? await resolveListeningGenre({ trackId, title, artist, genre })
          : '';
        updateUserHistoryAndGenres(user, {
          trackId,
          title,
          artist,
          genre: resolvedGenre,
          seconds: sec,
          isCompleted
        });

        user.lastActiveAt = new Date();
        await user.save();

        updatedTotalSeconds = user.totalListeningSeconds;
        updatedWeeklySeconds = user.weeklyListeningSeconds;
        updatedTopTrack = user.topTrack;
      }
    }

    // 2. Increment real track plays in Track collection if completed
    if (isCompleted && trackId) {
      await Track.updateOne(
        { $or: [{ _id: mongoose.isValidObjectId(trackId) ? trackId : null }, { id: trackId }] },
        { $inc: { plays: 1 } }
      ).catch(() => {});
    }

    res.json({
      success: true,
      totalListeningSeconds: updatedTotalSeconds,
      weeklyListeningSeconds: updatedWeeklySeconds,
      topTrack: updatedTopTrack
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/leaderboard', optionalAuth, async (req, res) => {
  try {
    const currentWeek = getCurrentISOWeek();
    const requestedTimeframe = (req.query.timeframe || 'weekly').toLowerCase();
    const isAllTime = requestedTimeframe === 'all_time' || requestedTimeframe === 'all';

    const users = await User.find({})
      .select('_id name avatar role isAdmin isVerified totalListeningSeconds weeklyListeningSeconds weeklyWeek topTrack')
      .lean();

    const currentUserId = req.user?.id ? String(req.user.id) : '';

    const baseEntries = users.map(u => {
      const isCurWeek = u.weeklyWeek === currentWeek;
      const weeklySec = isCurWeek ? (u.weeklyListeningSeconds || 0) : 0;
      const totalSec = u.totalListeningSeconds || 0;
      const weeklyMinutes = Math.floor(weeklySec / 60);
      const totalMinutes = Math.floor(totalSec / 60);

      // Clean separation: weekly is strictly weekly; all-time is strictly total
      const effectiveSec = isAllTime ? totalSec : weeklySec;
      const effectiveMin = isAllTime ? totalMinutes : weeklyMinutes;

      return {
        id: String(u._id),
        name: u.name,
        avatar: u.avatar || '',
        minutes: effectiveMin,
        seconds: effectiveSec,
        weeklySeconds: weeklySec,
        weeklyMinutes,
        totalSeconds: totalSec,
        totalMinutes,
        topSong: u.topTrack?.title ? `${u.topTrack.title} - ${u.topTrack.artist}` : 'Various Tracks',
        isVerified: isVerifiedUser(u.name) || Boolean(u.isVerified),
        isCurrentUser: Boolean(currentUserId && String(u._id) === currentUserId)
      };
    });

    // 1. Weekly Leaderboard (strictly ranked by weeklySeconds)
    const weeklySorted = [...baseEntries].sort((a, b) => {
      if (b.weeklySeconds !== a.weeklySeconds) return b.weeklySeconds - a.weeklySeconds;
      return b.totalSeconds - a.totalSeconds;
    });
    const rankedWeekly = weeklySorted.map((item, idx) => ({
      ...item,
      seconds: item.weeklySeconds,
      minutes: item.weeklyMinutes,
      rank: idx + 1
    }));

    // 2. All-Time Leaderboard (strictly ranked by totalSeconds)
    const allTimeSorted = [...baseEntries].sort((a, b) => {
      if (b.totalSeconds !== a.totalSeconds) return b.totalSeconds - a.totalSeconds;
      return b.weeklySeconds - a.weeklySeconds;
    });
    const rankedAllTime = allTimeSorted.map((item, idx) => ({
      ...item,
      seconds: item.totalSeconds,
      minutes: item.totalMinutes,
      rank: idx + 1
    }));

    // Primary leaderboard based on requested timeframe
    const primaryLeaderboard = isAllTime ? rankedAllTime : rankedWeekly;

    res.json({
      success: true,
      currentWeek,
      timeframe: isAllTime ? 'all_time' : 'weekly',
      leaderboard: primaryLeaderboard,
      weeklyLeaderboard: rankedWeekly,
      allTimeLeaderboard: rankedAllTime
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
