import { API_BASE_URL } from '../../config';
import { QURAN_LIVE_STATIONS } from '../../data/quranLiveStations';
import { isRadioTrack, isQuranContent } from '../../utils/quranUtils';
import { isPodcastContent, buildPodcastSeedQueue } from '../../utils/podcastUtils';
import { PODCAST_SHOWS_EPISODES } from '../../data/podcastsData';
import {
  getSmartTasteAndMoodTracks,
  getTrackDedupeKey,
  getPrimaryArtistNormalized,
} from '../../utils/tasteAlgorithm';
import { getTrackMusicalData, checkHarmonicCompatibility } from '../../utils/musicAnalysis';
import { getListeningStats } from '../../utils/listeningTracker';
import {
  getTrackId,
  attachQueueMeta,
  isMatchingContentKind,
} from './webQueueUtils';
import { getStoredFollowedArtists } from './webQueueStorage';

export function getStoredAuthToken(explicitToken = '') {
  if (explicitToken && typeof explicitToken === 'string') return explicitToken;
  try {
    return (
      localStorage.getItem('rivo_token') ||
      localStorage.getItem('liofy_token') ||
      localStorage.getItem('token') ||
      ''
    );
  } catch {
    return '';
  }
}

export function getRecentListeningHistory(limit = 10) {
  try {
    const history = getListeningStats()?.history;
    if (!Array.isArray(history)) return [];
    return history.slice(0, limit).filter(Boolean);
  } catch {
    return [];
  }
}

export function fetchNextSmartMusicBatch({
  allAvailable,
  currentUser,
  likedTrackIds,
  playedSmartSongIdsRef,
  currentTrack,
  limit = 20,
}) {
  const followed = getStoredFollowedArtists();
  let nextBatch = getSmartTasteAndMoodTracks({
    allTracks: allAvailable,
    currentUser,
    followedArtists: followed,
    likedTrackIds: likedTrackIds || [],
    excludeTrackIds: playedSmartSongIdsRef.current,
    limit,
    currentTrack,
    maxPerArtist: 2,
  });

  if (!nextBatch || nextBatch.length === 0) {
    const curK = getTrackDedupeKey(currentTrack);
    const curTId = getTrackId(currentTrack);
    const recentList = Array.from(playedSmartSongIdsRef.current).slice(-15);
    playedSmartSongIdsRef.current = new Set([curTId, curK, ...recentList].filter(Boolean));
    nextBatch = getSmartTasteAndMoodTracks({
      allTracks: allAvailable,
      currentUser,
      followedArtists: followed,
      likedTrackIds: likedTrackIds || [],
      excludeTrackIds: playedSmartSongIdsRef.current,
      limit,
      currentTrack,
      maxPerArtist: 2,
    });
  }

  // Fallback recycling if local pool was exhausted
  if (!nextBatch || nextBatch.length === 0) {
    nextBatch = (allAvailable || []).slice(0, limit);
  }

  return (nextBatch || []).map((t) => ({
    ...t,
    isSmartMoodQueue: true,
    isAiSuggestion: true,
  }));
}

export async function fetchNextSmartMusicBatchAsync({
  allAvailable = [],
  currentUser = null,
  likedTrackIds = [],
  playedSmartSongIdsRef,
  currentTrack = null,
  limit = 20,
}) {
  const localBatch = fetchNextSmartMusicBatch({
    allAvailable,
    currentUser,
    likedTrackIds,
    playedSmartSongIdsRef,
    currentTrack,
    limit,
  });

  if (localBatch && localBatch.length >= 8) {
    return localBatch;
  }

  // Fetch dynamically from server smart shuffle API to guarantee non-stop playback
  try {
    const token = typeof localStorage !== 'undefined'
      ? (localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '')
      : '';
    const res = await fetch(`${API_BASE_URL}/api/ai/smart-shuffle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        currentTrack,
        limit,
        followedArtists: currentUser?.following || [],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.tracks) && data.tracks.length > 0) {
        const seen = playedSmartSongIdsRef?.current || new Set();
        const fresh = data.tracks
          .filter(t => t && !seen.has(String(t._id || t.id)) && !isQuranContent(t) && !isRadioTrack(t))
          .map(t => ({ ...t, isSmartMoodQueue: true, isAiSuggestion: true }));
        if (fresh.length > 0) {
          return [...(localBatch || []), ...fresh].slice(0, limit);
        }
      }
    }
  } catch (err) {
    console.warn('[webQueueNextHelpers] Dynamic smart shuffle fetch notice:', err.message);
  }

  return localBatch;
}

export function pickSmartShuffleNext(activeList, cur) {
  const curId = getTrackId(cur);
  const candidates = activeList.filter((t) => getTrackId(t) !== curId);
  const followed = getStoredFollowedArtists();
  const recentHistory = getRecentListeningHistory(10);
  const recentArtistSet = new Set(
    recentHistory.map((h) => getPrimaryArtistNormalized(h.artist)).filter((a) => a && a !== 'unknown')
  );
  const veryRecentIds = new Set(recentHistory.slice(0, 3).map((h) => String(h.id || h._id || '')));
  const curMusical = getTrackMusicalData(cur);
  const scored = candidates.map((t) => {
    let score = 0;
    const tId = getTrackId(t);
    const tArtist = (t.artist || '').toLowerCase();
    const tPrimary = getPrimaryArtistNormalized(t.artist);
    if (followed.some((fa) => tArtist.includes(fa.toLowerCase()))) score += 50;
    if (recentArtistSet.has(tPrimary)) score += 18;
    if (veryRecentIds.has(tId)) score -= 25;
    const tMusical = getTrackMusicalData(t);
    const harm = checkHarmonicCompatibility(curMusical.key, tMusical.key, curMusical.bpm, tMusical.bpm);
    score += (harm.score || 50) * 0.3;
    score += Math.min(10, (Number(t.plays) || 0) * 0.5);
    if (t.isSmartShuffle) score += 20;
    return { track: t, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const chosen = scored.length > 0 ? scored[0].track : activeList[0];
  return { chosen, candidatesCount: candidates.length };
}

export function resolvePodcastNextTarget({
  cur,
  curIdx,
  activeList,
  allTracks,
}) {
  if (curIdx >= 0 && curIdx < activeList.length - 1) {
    return { queue: activeList, nextIdx: curIdx + 1, replacedQueue: false };
  }
  const curId = getTrackId(cur);
  const libraryPodcasts = allTracks.filter((t) => isPodcastContent(t));
  const podcastPool = libraryPodcasts.length > 0 ? libraryPodcasts : PODCAST_SHOWS_EPISODES;
  const seedQ = buildPodcastSeedQueue(cur, podcastPool, 20);
  const unplayed = seedQ.filter((t) => getTrackId(t) !== curId);
  if (unplayed.length > 0) {
    const newQueue = cur ? [cur, ...unplayed] : unplayed;
    return { queue: newQueue, nextIdx: cur ? 1 : 0, replacedQueue: true };
  }
  return { queue: activeList, nextIdx: 0, replacedQueue: false };
}

export function resolveQuranNextTarget({
  cur,
  curIdx,
  activeList,
  allTracks,
}) {
  if (curIdx >= 0 && curIdx < activeList.length - 1) {
    return { queue: activeList, nextIdx: curIdx + 1, replacedQueue: false };
  }
  const curId = getTrackId(cur);
  const quranPool = allTracks.filter((t) => isQuranContent(t) || isRadioTrack(t));
  const unplayedQuran = quranPool.filter((t) => getTrackId(t) !== curId);
  if (unplayedQuran.length > 0) {
    const newQuranQueue = cur ? [cur, ...unplayedQuran] : unplayedQuran;
    return { queue: newQuranQueue, nextIdx: cur ? 1 : 0, replacedQueue: true };
  }
  if (activeList.length > 1) {
    return { queue: activeList, nextIdx: 0, replacedQueue: false };
  }
  return { queue: QURAN_LIVE_STATIONS, nextIdx: 0, replacedQueue: true };
}

export function resolveRadioPool(rawQueue) {
  return Array.isArray(rawQueue) && rawQueue.length > 0 && rawQueue.some(isRadioTrack)
    ? rawQueue.filter(isRadioTrack)
    : QURAN_LIVE_STATIONS;
}

export function resolveContentIsolatedPool(rawQueue, allTracks, targetKind, isOfflineMode) {
  const matchQueueType = (t) => isMatchingContentKind(t, targetKind);
  const typeIsolated = attachQueueMeta(rawQueue.filter(matchQueueType), rawQueue);
  const allMatching = (allTracks || []).filter(matchQueueType);
  let pool =
    typeIsolated.length > 1 ? typeIsolated : allMatching.length > 0 ? allMatching : typeIsolated;
  if (targetKind === 'podcast' && pool.length === 0) pool = PODCAST_SHOWS_EPISODES;
  return isOfflineMode ? attachQueueMeta(pool.filter((t) => t.downloaded), pool) : pool;
}

export async function fetchSmartShuffleTracksApi({
  seedTrack,
  currentList = [],
  existingQueue = [],
  signal = null,
  token = '',
}) {
  if (!seedTrack || signal?.aborted) return [];
  const followed = getStoredFollowedArtists();
  const authToken = getStoredAuthToken(token);
  const recentTracks = getRecentListeningHistory(10);
  const res = await fetch(`${API_BASE_URL}/api/ai/smart-shuffle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: JSON.stringify({
      currentTrack: seedTrack,
      seedTracks: currentList.slice(0, 5),
      recentTracks,
      followedArtists: followed,
      limit: 8,
    }),
    signal,
  });
  if (signal?.aborted || !res.ok) return [];
  const data = await res.json();
  if (signal?.aborted || !data?.success || !Array.isArray(data.tracks) || data.tracks.length === 0) {
    return [];
  }

  const existingIds = new Set(existingQueue.map((t) => getTrackId(t)));
  const existingKeys = new Set(existingQueue.map((t) => getTrackDedupeKey(t)));
  const artistCounts = new Map();
  existingQueue.forEach((t) => {
    const a = getPrimaryArtistNormalized(t.artist);
    artistCounts.set(a, (artistCounts.get(a) || 0) + 1);
  });

  const freshTracks = [];
  for (const t of data.tracks) {
    const tId = getTrackId(t);
    const tKey = getTrackDedupeKey(t);
    if (existingIds.has(tId) || existingKeys.has(tKey)) continue;
    const a = getPrimaryArtistNormalized(t.artist);
    const c = artistCounts.get(a) || 0;
    if (c < 2) {
      freshTracks.push({ ...t, isAiSuggestion: true, isSmartShuffle: true });
      existingIds.add(tId);
      existingKeys.add(tKey);
      artistCounts.set(a, c + 1);
    }
  }
  return freshTracks;
}
