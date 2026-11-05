/**
 * Rivo Smart Taste & Mood Engine
 * Features:
 * 1. Intelligent Genre Deduction (Mahraganat, Rap/Hip-Hop, Classic/Tarab, Indie/Alternative, Arabic Pop, Khaleeji, R&B, Electronic, Holy Quran)
 * 2. Artist Diversity Capping (Strict max 2 songs per artist in auto-generated queue to eliminate artist monopolization)
 * 3. Strict Track Deduplication (Normalized title & primary artist to prevent duplicate uploads/variants)
 * 4. Real Audio Listening History & Play Duration Affinity
 * 5. Time-of-Day Listening Mood & Organic Dynamic Micro-Jitter
 */

import { getListeningStats } from './listeningTracker.js';
import { classifyGenre } from './genreClassifier.js';
import { resolveCanonicalArtist } from './artistAliases.js';

export { GENRE_MAP } from './genreClassifier.js';

/**
 * Normalizes title / text strings for robust matching & deduplication
 */
export function normalizeString(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/[\(\[\{][^\)\]\}]*[\)\]\}]/g, '') // remove parentheticals like (Official Video), [Clip]
    .replace(/[\-_|–—:]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')            // preserve Arabic, Latin alphanumeric chars
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts normalized primary artist, stripping featuring / collab markers
 */
export function getPrimaryArtistNormalized(artist) {
  if (!artist || typeof artist !== 'string') return 'unknown';
  const clean = artist.toLowerCase().split(/\b(ft\.?|feat\.?|featuring|with|x|vs\.?)\b|[,&،\+\/]/i)[0];
  const norm = normalizeString(clean);
  return resolveCanonicalArtist(norm) || 'unknown';
}

/**
 * Returns a canonical deduplication key for a track: "normalized_title:::normalized_primary_artist"
 */
export function getTrackDedupeKey(track) {
  if (!track) return '';
  const normTitle = normalizeString(track.title);
  const normArtist = getPrimaryArtistNormalized(track.artist);
  if (!normTitle) return String(track._id || track.id || '');
  return `${normTitle}:::${normArtist}`;
}

/**
 * Intelligently deduces the authentic genre for a track
 */
export function detectTrackGenre(track) {
  if (!track) return 'Pop';
  const res = classifyGenre(track);
  return res.genre || 'Pop';
}

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
      keywords: ['rap', 'trap', 'drill', 'hype', 'party', 'حماس', 'راب', 'سهرة', 'مهرجان', 'طاقة', 'ويجز', 'مروان', 'ليجي'],
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
  limit = 20,
  currentTrack = null,
  maxPerArtist = 2,
}) {
  if (!Array.isArray(allTracks) || allTracks.length === 0) return [];

  const mood = getCurrentTimeMood();
  const maxCap = Math.max(1, Number(maxPerArtist) || 2);

  const followedSet = new Set(
    (followedArtists || []).map(a => getPrimaryArtistNormalized(a))
  );
  if (currentUser?.following && Array.isArray(currentUser.following)) {
    currentUser.following.forEach(f => {
      const name = typeof f === 'string' ? f : f?.name || f?.username;
      if (name) followedSet.add(getPrimaryArtistNormalized(name));
    });
  }

  const likedSet = new Set((likedTrackIds || []).map(id => String(id)));

  // Extract artists from liked tracks
  const likedArtistSet = new Set();
  allTracks.forEach(t => {
    const id = String(t._id || t.id);
    if (likedSet.has(id) && t.artist) {
      likedArtistSet.add(getPrimaryArtistNormalized(t.artist));
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
        const a = getPrimaryArtistNormalized(ts.artist);
        const current = listenedArtistWeights.get(a) || 0;
        const weight = (Number(ts.plays) || 0) * 10 + Math.floor((Number(ts.seconds) || 0) / 30);
        listenedArtistWeights.set(a, current + weight);
      }
    });
  } catch {}

  const recentHistorySet = new Set(historyList.slice(0, 20).map(h => String(h.id || h._id)));

  // Contextual Seed Track: When currently playing a track, extract seed vibe and genre
  const seedArtist = currentTrack ? getPrimaryArtistNormalized(currentTrack.artist) : '';
  const seedGenre = currentTrack ? detectTrackGenre(currentTrack) : null;

  // Identify preferred genres from seed track, top artists, liked artists, and followed artists
  const preferredGenreSet = new Set();
  if (seedGenre) preferredGenreSet.add(seedGenre);

  const sampleArtists = [...likedArtistSet, ...followedSet, seedArtist].filter(Boolean);
  for (const art of sampleArtists.slice(0, 15)) {
    const g = detectTrackGenre({ artist: art });
    if (g && g !== 'Pop') preferredGenreSet.add(g);
  }

  // Pre-seed exclusions (both IDs and normalized dedupe keys)
  const excludeIdSet = new Set();
  const excludeKeySet = new Set();

  if (excludeTrackIds) {
    const arr = excludeTrackIds instanceof Set ? Array.from(excludeTrackIds) : (Array.isArray(excludeTrackIds) ? excludeTrackIds : []);
    arr.forEach(val => {
      const s = String(val || '');
      if (s.includes(':::')) {
        excludeKeySet.add(s);
      } else {
        excludeIdSet.add(s);
      }
    });
  }

  // Current playing track must ALWAYS be excluded from recommended queue
  if (currentTrack) {
    const curId = String(currentTrack._id || currentTrack.id || '');
    if (curId) excludeIdSet.add(curId);
    const curKey = getTrackDedupeKey(currentTrack);
    if (curKey) excludeKeySet.add(curKey);
  }

  // Step 1: Strict Pool Deduplication (eliminate multiple uploads/duplicates of the exact same song)
  const uniquePool = [];
  const poolKeyMap = new Map();

  for (const t of allTracks) {
    if (!t) continue;
    const key = getTrackDedupeKey(t);
    if (!poolKeyMap.has(key)) {
      poolKeyMap.set(key, t);
      uniquePool.push(t);
    } else {
      // If duplicate exists, keep whichever entry has higher plays or valid duration
      const existing = poolKeyMap.get(key);
      const curScore = (Number(t.plays) || 0) + (Number(t.duration) > 0 ? 10 : 0);
      const exScore = (Number(existing.plays) || 0) + (Number(existing.duration) > 0 ? 10 : 0);
      if (curScore > exScore) {
        poolKeyMap.set(key, t);
        const idx = uniquePool.indexOf(existing);
        if (idx !== -1) uniquePool[idx] = t;
      }
    }
  }

  // Step 2: Filter out excluded/already-played tracks
  let candidates = uniquePool.filter(t => {
    const id = String(t._id || t.id);
    const key = getTrackDedupeKey(t);
    return !excludeIdSet.has(id) && !excludeKeySet.has(key);
  });

  // If unplayed candidates are too few, relax historical exclusion but STRICTLY maintain current track exclusion
  if (candidates.length < Math.min(limit, 8)) {
    const curKey = currentTrack ? getTrackDedupeKey(currentTrack) : '';
    const curId = currentTrack ? String(currentTrack._id || currentTrack.id) : '';
    candidates = uniquePool.filter(t => {
      const id = String(t._id || t.id);
      const key = getTrackDedupeKey(t);
      return id !== curId && key !== curKey;
    });
  }

  // Step 3: Score candidates intelligently
  const scored = candidates.map(track => {
    let score = 0;
    const normTitle = normalizeString(track.title);
    const primaryArt = getPrimaryArtistNormalized(track.artist);
    const dedupeKey = getTrackDedupeKey(track);
    const tGenre = detectTrackGenre(track);
    const tText = `${normTitle} ${primaryArt} ${tGenre}`.toLowerCase();
    const tId = String(track._id || track.id);
    const trackKey = String(track.id || track._id || dedupeKey);

    // 1. Real Audio Listening History Match (+up to 85 pts)
    const realStat = trackStatsMap[trackKey] || trackStatsMap[tId] || trackStatsMap[String(track._id)] || trackStatsMap[String(track.id)];
    if (realStat) {
      const realPlays = Number(realStat.plays) || 0;
      const realSecs = Number(realStat.seconds) || 0;
      if (realPlays > 0 || realSecs >= 20) {
        score += 45;
        score += Math.min(25, Math.log2(realPlays + 1) * 8);
        score += Math.min(15, Math.floor(realSecs / 120) * 3);
      }
    }

    // 2. Real Listened Artist Affinity (+up to 40 pts)
    const artistListeningWeight = listenedArtistWeights.get(primaryArt) || 0;
    if (artistListeningWeight > 0) {
      score += Math.min(40, 15 + Math.log10(artistListeningWeight + 1) * 10);
    }

    // 3. Recent Playback Recency (+15 pts)
    if (recentHistorySet.has(trackKey) || recentHistorySet.has(tId)) {
      score += 15;
    }

    // 4. Followed Artist match (+45 pts)
    for (const followed of followedSet) {
      if (followed && (primaryArt.includes(followed) || followed.includes(primaryArt))) {
        score += 45;
        break;
      }
    }

    // 5. Liked song match (+40 pts)
    if (likedSet.has(tId)) {
      score += 40;
    }

    // 6. Artist taste similarity from liked songs (+30 pts)
    if (likedArtistSet.has(primaryArt)) {
      score += 30;
    }

    // 7. Seed Artist context bonus (balanced to prevent flooding)
    if (seedArtist && (primaryArt === seedArtist || primaryArt.includes(seedArtist) || seedArtist.includes(primaryArt))) {
      score += 25;
    }

    // 8. Similar-Vibe Genre Clustering Synergy (+35 pts)
    if (preferredGenreSet.has(tGenre)) {
      score += 35;
    }

    // 9. Time-of-day mood keywords match (+25 pts)
    for (const kw of mood.keywords) {
      if (tText.includes(kw.toLowerCase())) {
        score += 25;
        break;
      }
    }

    // 10. Popularity / play count bonus (up to +15 pts)
    const plays = Number(track.plays || track.playCount || 0);
    score += Math.min(15, Math.log10(plays + 1) * 4);

    // 11. Dynamic micro-jitter for organic variety (+0 to 10 pts)
    score += Math.random() * 10;

    return { track, score, primaryArt, dedupeKey, tGenre };
  });

  scored.sort((a, b) => b.score - a.score);

  // Step 4: STRICT Artist Diversity Capping & Deduplication
  // Strictly enforces max 2 songs per artist in the auto-generated queue to eliminate artist monopolization
  const selected = [];
  const artistCounts = new Map();
  const selectedKeys = new Set();

  // If there is a seed track, count its artist as 1 against the cap
  if (seedArtist) {
    artistCounts.set(seedArtist, 1);
  }

  for (const item of scored) {
    if (selected.length >= limit) break;
    if (selectedKeys.has(item.dedupeKey)) continue;

    const currentArtistCount = artistCounts.get(item.primaryArt) || 0;
    if (currentArtistCount < maxCap) {
      selected.push(item);
      selectedKeys.add(item.dedupeKey);
      artistCounts.set(item.primaryArt, currentArtistCount + 1);
    }
  }

  // If we haven't reached the limit, allow a second pass up to maxCap + 1 (never exceeding 3 per artist)
  if (selected.length < limit) {
    for (const item of scored) {
      if (selected.length >= limit) break;
      if (selectedKeys.has(item.dedupeKey)) continue;

      const currentArtistCount = artistCounts.get(item.primaryArt) || 0;
      if (currentArtistCount < Math.min(maxCap + 1, 3)) {
        selected.push(item);
        selectedKeys.add(item.dedupeKey);
        artistCounts.set(item.primaryArt, currentArtistCount + 1);
      }
    }
  }

  // Return unique tracks with authentic deduced genre
  return selected.map(item => ({
    ...item.track,
    genre: item.tGenre || detectTrackGenre(item.track),
  }));
}

export function buildSmartSeedQueue(track, pool = [], options = {}) {
  if (!track) return [];
  const smartTracks = getSmartTasteAndMoodTracks({
    ...options,
    allTracks: pool,
    currentTrack: track,
    limit: options.limit || 20,
    maxPerArtist: options.maxPerArtist || 2,
  });
  return [track, ...smartTracks];
}
