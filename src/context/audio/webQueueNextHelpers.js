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
import {
  getTrackId,
  attachQueueMeta,
  isMatchingContentKind,
} from './webQueueUtils';
import { getStoredFollowedArtists } from './webQueueStorage';

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

  return (nextBatch || []).map((t) => ({
    ...t,
    isSmartMoodQueue: true,
    isAiSuggestion: true,
  }));
}

export function pickSmartShuffleNext(activeList, cur) {
  const curId = getTrackId(cur);
  const candidates = activeList.filter((t) => getTrackId(t) !== curId);
  const followed = getStoredFollowedArtists();
  const curMusical = getTrackMusicalData(cur);
  const scored = candidates.map((t) => {
    let score = 0;
    const tArtist = (t.artist || '').toLowerCase();
    if (followed.some((fa) => tArtist.includes(fa.toLowerCase()))) score += 50;
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
}) {
  const followed = getStoredFollowedArtists();
  const res = await fetch(`${API_BASE_URL}/api/ai/smart-shuffle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentTrack: seedTrack,
      seedTracks: currentList.slice(0, 5),
      followedArtists: followed,
      limit: 8,
    }),
    signal,
  });
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
