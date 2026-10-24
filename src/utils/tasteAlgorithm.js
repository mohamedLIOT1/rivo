/**
 * Rivo Smart Taste & Mood Engine
 * Dynamically curates 10-track batches aligned with:
 * 1. Real Audio Listening History & Play Duration (+up to 85 pts)
 * 2. Frequent Listened Artists (+up to 45 pts)
 * 3. Followed Artists (+60 pts)
 * 4. Liked Songs (+50 pts)
 * 5. Artists from Liked Songs (+40 pts)
 * 6. Time-of-Day Listening Mood (+30 pts)
 * 7. Track Popularity/Play count (+15 pts)
 * 8. Organic variety micro-jitter (+0-12 pts)
 */

import { getListeningStats } from './listeningTracker';

export function getCurrentTimeMood() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) {
    return {
      id: 'morning',
      label: 'Morning Fresh',
      keywords: ['acoustic', 'indie', 'morning', 'fresh', 'light', 'روقان', 'صباح', 'هادي', 'فيروز'],
      energy: 'fresh',
    };
  } else if (hour >= 12 && hour < 17) {
    return {
      id: 'afternoon',
      label: 'Afternoon Flow',
      keywords: ['chill', 'lofi', 'focus', 'flow', 'smooth', 'موسيقى', 'تركيز', 'عصر', 'رايق'],
      energy: 'chill',
    };
  } else if (hour >= 17 && hour < 23) {
    return {
      id: 'evening',
      label: 'Evening Hype',
      keywords: ['rap', 'trap', 'drill', 'hype', 'party', 'حماس', 'راب', 'سهرة', 'مهرجان', 'طاقة', 'ويجز', 'مروان'],
      energy: 'hype',
    };
  } else {
    return {
      id: 'night',
      label: 'Night Melancholy',
      keywords: ['slowed', 'night', 'deep', 'sad', 'melancholy', 'chill', 'ليل', 'سفر', 'هادية', 'حزين', 'روما', 'دواير'],
      energy: 'deep',
    };
  }
}

export function getSmartTasteAndMoodTracks({
  allTracks = [],
  currentUser = null,
  followedArtists = [],
  likedTrackIds = [],
  excludeTrackIds = new Set(),
  limit = 10,
}) {
  if (!Array.isArray(allTracks) || allTracks.length === 0) return [];

  const mood = getCurrentTimeMood();
  const followedSet = new Set(
    (followedArtists || []).map(a => String(a).toLowerCase().trim())
  );
  if (currentUser?.following && Array.isArray(currentUser.following)) {
    currentUser.following.forEach(f => {
      const name = typeof f === 'string' ? f : f?.name || f?.username;
      if (name) followedSet.add(name.toLowerCase().trim());
    });
  }

  const likedSet = new Set((likedTrackIds || []).map(id => String(id)));

  // Extract artists from liked tracks
  const likedArtistSet = new Set();
  allTracks.forEach(t => {
    const id = String(t._id || t.id);
    if (likedSet.has(id) && t.artist) {
      likedArtistSet.add(t.artist.toLowerCase().trim());
    }
  });

  // Extract real audio listening stats & history
  let trackStatsMap = {};
  let historyList = [];
  const listenedArtistWeights = new Map();
  try {
    const listeningStats = typeof getListeningStats === 'function' ? getListeningStats() : null;
    trackStatsMap = listeningStats?.trackStats || {};
    historyList = Array.isArray(listeningStats?.history) ? listeningStats.history : [];

    Object.values(trackStatsMap).forEach(ts => {
      if (ts && ts.artist) {
        const a = ts.artist.toLowerCase().trim();
        const current = listenedArtistWeights.get(a) || 0;
        const weight = (Number(ts.plays) || 0) * 10 + Math.floor((Number(ts.seconds) || 0) / 30);
        listenedArtistWeights.set(a, current + weight);
      }
    });
  } catch {}

  const recentHistorySet = new Set(historyList.slice(0, 20).map(h => String(h.id || h._id)));

  // Exclude already queued / played tracks if possible
  let candidates = allTracks.filter(t => {
    const id = String(t._id || t.id);
    return !excludeTrackIds.has(id);
  });

  if (candidates.length < limit) {
    candidates = allTracks;
  }

  const scored = candidates.map(track => {
    let score = 0;
    const tArtist = (track.artist || '').toLowerCase().trim();
    const tTitle = (track.title || '').toLowerCase().trim();
    const tGenre = (track.genre || '').toLowerCase().trim();
    const tText = `${tTitle} ${tArtist} ${tGenre}`;
    const tId = String(track._id || track.id);
    const trackKey = String(track.id || track._id || `${tTitle}___${tArtist}`);

    // 1. Real Audio Listening History Match (+up to 85 pts) - True Personalized Listening
    const realStat = trackStatsMap[trackKey] || trackStatsMap[tId] || trackStatsMap[String(track._id)] || trackStatsMap[String(track.id)];
    if (realStat) {
      const realPlays = Number(realStat.plays) || 0;
      const realSecs = Number(realStat.seconds) || 0;
      if (realPlays > 0 || realSecs >= 20) {
        score += 45; // Base listening affinity
        score += Math.min(25, Math.log2(realPlays + 1) * 8); // Repeat listens bonus
        score += Math.min(15, Math.floor(realSecs / 120) * 3); // Duration bonus
      }
    }

    // 2. Real Listened Artist Affinity (+up to 45 pts)
    const artistListeningWeight = listenedArtistWeights.get(tArtist) || 0;
    if (artistListeningWeight > 0) {
      score += Math.min(45, 20 + Math.log10(artistListeningWeight + 1) * 12);
    }

    // 3. Recent Playback Recency (+15 pts)
    if (recentHistorySet.has(trackKey) || recentHistorySet.has(tId)) {
      score += 15;
    }

    // 4. Followed Artist match (+60 pts)
    for (const followed of followedSet) {
      if (followed && tArtist.includes(followed)) {
        score += 60;
        break;
      }
    }

    // 5. Liked song match (+50 pts)
    if (likedSet.has(tId)) {
      score += 50;
    }

    // 6. Artist taste similarity from liked songs (+40 pts)
    if (likedArtistSet.has(tArtist)) {
      score += 40;
    }

    // 7. Time-of-day mood keywords match (+30 pts)
    for (const kw of mood.keywords) {
      if (tText.includes(kw)) {
        score += 30;
        break;
      }
    }

    // 8. Popularity / play count bonus (up to +15 pts)
    const plays = Number(track.plays || track.playCount || 0);
    score += Math.min(15, Math.log10(plays + 1) * 4);

    // 9. Dynamic micro-jitter for organic variety (+0 to 12 pts)
    score += Math.random() * 12;

    return { track, score };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(s => s.track);
}
