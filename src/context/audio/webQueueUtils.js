import { QURAN_LIVE_STATIONS } from '../../data/quranLiveStations';
import { isRadioTrack, isQuranContent } from '../../utils/quranUtils';
import { isPodcastContent, buildPodcastSeedQueue } from '../../utils/podcastUtils';
import { PODCAST_SHOWS_EPISODES } from '../../data/podcastsData';
import { getSmartTasteAndMoodTracks, getTrackDedupeKey } from '../../utils/tasteAlgorithm';
import {
  splitQueueSections,
  resolveQueueContextLabel,
  getStoredFollowedArtists,
  serializeQueueForStorage,
  loadPersistedQueueState,
} from './webQueueStorage';

export {
  splitQueueSections,
  resolveQueueContextLabel,
  getStoredFollowedArtists,
  serializeQueueForStorage,
  loadPersistedQueueState,
};

let queueUidSeq = 1;

export function shuffleArray(array) {
  if (!Array.isArray(array)) return [];
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getTrackId(track) {
  return String(track?.id || track?._id || '');
}

export function isSameTrack(a, b) {
  const idA = getTrackId(a);
  const idB = getTrackId(b);
  return Boolean(idA && idB && idA === idB);
}

export function getContentKind(track) {
  if (!track) return 'music';
  if (isRadioTrack(track)) return 'radio';
  if (isQuranContent(track)) return 'quran';
  if (isPodcastContent(track)) return 'podcast';
  return 'music';
}

export function isMatchingContentKind(track, targetKind) {
  if (!track) return false;
  if (targetKind === 'radio') return isRadioTrack(track);
  if (targetKind === 'quran') return isQuranContent(track) || isRadioTrack(track);
  if (targetKind === 'podcast') return isPodcastContent(track);
  return !isRadioTrack(track) && !isQuranContent(track) && !isPodcastContent(track);
}

export function attachQueueMeta(arr, source = null) {
  const target = Array.isArray(arr) ? arr : [];
  if (!source) return target;
  if (source._transitions !== undefined) target._transitions = source._transitions;
  if (source._isMix !== undefined) target._isMix = source._isMix;
  if (source._isExplicitPlaylist !== undefined) target._isExplicitPlaylist = source._isExplicitPlaylist;
  if (source._playlistId !== undefined) target._playlistId = source._playlistId;
  if (source._playlistName !== undefined) target._playlistName = source._playlistName;
  if (source.name !== undefined) target.name = source.name;
  if (source._contextType !== undefined) target._contextType = source._contextType;
  return target;
}

export function filterQueueByContentKind(list, targetTrack) {
  if (!Array.isArray(list)) return [];
  const kind = getContentKind(targetTrack);
  return attachQueueMeta(
    list.filter((t) => isMatchingContentKind(t, kind)),
    list
  );
}

export function areQueuesSameOrder(qA, qB) {
  if (qA === qB) return true;
  if (!Array.isArray(qA) || !Array.isArray(qB)) return false;
  if (qA.length !== qB.length) return false;
  for (let i = 0; i < qA.length; i++) {
    if (getTrackId(qA[i]) !== getTrackId(qB[i])) return false;
  }
  return true;
}

export function findTrackIndexInQueue(queue, track, preferredIndex = null, minIndex = -1) {
  if (!Array.isArray(queue) || queue.length === 0 || !track) return -1;
  const tid = getTrackId(track);
  const tUid = track._queueUid;
  if (
    preferredIndex !== null &&
    preferredIndex !== undefined &&
    preferredIndex >= 0 &&
    preferredIndex < queue.length &&
    getTrackId(queue[preferredIndex]) === tid &&
    (!tUid || !queue[preferredIndex]?._queueUid || queue[preferredIndex]._queueUid === tUid)
  ) {
    return preferredIndex;
  }
  if (tUid) {
    const byUid = queue.findIndex((t) => t?._queueUid === tUid);
    if (byUid >= 0) return byUid;
  }
  if (minIndex >= 0 && minIndex < queue.length) {
    const afterIdx = queue.findIndex((t, i) => i >= minIndex && getTrackId(t) === tid);
    if (afterIdx >= 0) return afterIdx;
  }
  return tid ? queue.findIndex((t) => getTrackId(t) === tid) : -1;
}

export function createQueueEntry(track, isUserQueued = false) {
  if (!track) return null;
  const uid = track._queueUid || `q_${getTrackId(track) || 't'}_${Date.now().toString(36)}_${queueUidSeq++}`;
  if (isUserQueued) {
    return { ...track, _isUserQueued: true, _queueUid: uid };
  }
  return track._queueUid ? track : { ...track, _queueUid: uid };
}

/**
 * Spotify-style queue insertion:
 * - playNext = true: inserts right after the currently playing track (top of "Next in Queue")
 * - playNext = false: inserts at the end of "Next in Queue" (_isUserQueued), BEFORE context/playlist tracks
 */
export function insertIntoSpotifyQueue(currentList, currentIndex, currentTrack, tracksToAdd, playNext = false) {
  const base = Array.isArray(currentList) ? [...currentList] : [];
  const entries = (Array.isArray(tracksToAdd) ? tracksToAdd : [tracksToAdd])
    .filter(Boolean)
    .map((t) => createQueueEntry({ ...t, _queueUid: undefined }, true));

  if (entries.length === 0) return attachQueueMeta(base, currentList);

  const curIdx = findTrackIndexInQueue(base, currentTrack, currentIndex);
  if (curIdx < 0) {
    const combined = playNext ? [...entries, ...base] : [...base, ...entries];
    return attachQueueMeta(combined, currentList);
  }

  let insertAt = curIdx + 1;
  if (!playNext) {
    while (insertAt < base.length && base[insertAt]?._isUserQueued) {
      insertAt++;
    }
  }
  base.splice(insertAt, 0, ...entries);
  return attachQueueMeta(base, currentList);
}

/**
 * Resolve next queue + active index when playTrack runs, preventing accidental wipes or 30-song truncation.
 */
export function resolveQueueForPlayTrack({
  trackToPlay,
  newQueue,
  queueIndex,
  isSmartMood,
  preserveQueue,
  queueContextMeta,
  currentQueue,
  currentQueueIndex,
  currentTrack,
  allTracks,
  currentUser,
  likedTrackIds,
  playedSmartSongIds,
  isShuffle,
  activeTransitions,
  isMixMode,
}) {
  const targetId = getTrackId(trackToPlay);
  const targetKind = getContentKind(trackToPlay);
  const curQ = Array.isArray(currentQueue) ? currentQueue : [];
  const matchTarget = (t) => isMatchingContentKind(t, targetKind);

  const sameAsCurrentQueue = Boolean(newQueue && Array.isArray(newQueue) && areQueuesSameOrder(newQueue, curQ));
  const isQueueNavigation = Boolean(
    preserveQueue ||
      (queueIndex !== null && queueIndex !== undefined && (!newQueue || sameAsCurrentQueue))
  );
  const isSameTrackReload = Boolean(
    !newQueue && currentTrack && isSameTrack(currentTrack, trackToPlay) && curQ.length > 0
  );

  let resolvedQueue = curQ;
  let resolvedIndex = currentQueueIndex >= 0 ? currentQueueIndex : 0;
  let isSmartQueue = false;
  let nextContext = queueContextMeta || null;
  let unshuffledBase = null;

  if (preserveQueue || isQueueNavigation || isSameTrackReload) {
    const sanitized = curQ.filter(matchTarget);
    resolvedQueue = attachQueueMeta(sanitized.length > 0 ? sanitized : [trackToPlay], curQ);
    const idx = findTrackIndexInQueue(resolvedQueue, trackToPlay, queueIndex, currentQueueIndex);
    resolvedIndex = idx >= 0 ? idx : 0;
    isSmartQueue = Boolean(isSmartMood || resolvedQueue.some((t) => t?.isSmartMoodQueue));
    return { resolvedQueue, resolvedIndex, isSmartQueue, nextContext, unshuffledBase };
  }

  // Extract upcoming manual user-queued items matching the target content kind so Spotify queue survives context switches
  const curActiveIdx = findTrackIndexInQueue(curQ, currentTrack, currentQueueIndex);
  const preservedManual = curQ
    .filter((t, i) => i > curActiveIdx && t?._isUserQueued && matchTarget(t) && getTrackId(t) !== targetId)
    .map((t) => createQueueEntry(t, true));

  const isExplicitPlaylist = Boolean(
    newQueue &&
      Array.isArray(newQueue) &&
      (newQueue._isExplicitPlaylist ||
        newQueue._isMix ||
        newQueue.isMix ||
        newQueue.length > 1)
  );

  if (targetKind === 'radio') {
    const radioPool =
      newQueue && newQueue.length > 0 && newQueue.some(isRadioTrack)
        ? newQueue.filter(isRadioTrack)
        : QURAN_LIVE_STATIONS;
    resolvedQueue = radioPool.length > 0 ? [...radioPool] : [trackToPlay];
    resolvedIndex = Math.max(0, findTrackIndexInQueue(resolvedQueue, trackToPlay, queueIndex));
    nextContext = { type: 'radio', name: 'Quran Live Radio' };
  } else if (targetKind === 'podcast') {
    const podcastPool =
      allTracks.filter((t) => isPodcastContent(t)).length > 0
        ? allTracks.filter((t) => isPodcastContent(t))
        : PODCAST_SHOWS_EPISODES;
    const seeded = buildPodcastSeedQueue(trackToPlay, podcastPool, 25);
    resolvedQueue = insertPreservedManualAfterCurrent(seeded, trackToPlay, preservedManual);
    resolvedIndex = Math.max(0, findTrackIndexInQueue(resolvedQueue, trackToPlay, queueIndex));
    nextContext = { type: 'podcast', name: trackToPlay.artist || 'Podcasts' };
  } else if (targetKind === 'quran') {
    if (newQueue && Array.isArray(newQueue) && newQueue.length > 0) {
      const sanitized = newQueue.filter(matchTarget);
      const base = sanitized.length > 0 ? sanitized.slice(0, 500) : [trackToPlay];
      resolvedQueue = insertPreservedManualAfterCurrent(base, trackToPlay, preservedManual);
    } else {
      const pool = allTracks.filter(matchTarget);
      const foundIdx = pool.findIndex((t) => getTrackId(t) === targetId);
      const startIdx = foundIdx >= 0 ? Math.max(0, foundIdx - 10) : 0;
      const base = pool.length > 0 ? pool.slice(startIdx, startIdx + 100) : [trackToPlay];
      resolvedQueue = insertPreservedManualAfterCurrent(base, trackToPlay, preservedManual);
    }
    resolvedIndex = Math.max(0, findTrackIndexInQueue(resolvedQueue, trackToPlay, queueIndex));
    nextContext = {
      type: 'quran',
      name: newQueue?._playlistName || newQueue?.name || 'Quran Queue',
    };
  } else if (isExplicitPlaylist) {
    const sanitized = newQueue.filter(matchTarget);
    const pool = (sanitized.length > 0 ? sanitized : allTracks.filter(matchTarget)).slice(0, 500);
    let orderedPool = pool.length > 0 ? [...pool] : [trackToPlay];
    if (!orderedPool.some((t) => getTrackId(t) === targetId)) {
      orderedPool = [trackToPlay, ...orderedPool];
    }

    if (isShuffle && orderedPool.length > 1) {
      unshuffledBase = attachQueueMeta([...orderedPool], newQueue);
      const others = orderedPool.filter((t) => getTrackId(t) !== targetId);
      orderedPool = [trackToPlay, ...preservedManual, ...shuffleArray(others)];
    } else {
      orderedPool = insertPreservedManualAfterCurrent(orderedPool, trackToPlay, preservedManual);
    }

    resolvedQueue = attachQueueMeta(orderedPool, newQueue);
    resolvedIndex = Math.max(0, findTrackIndexInQueue(resolvedQueue, trackToPlay));
    isSmartQueue = Boolean(
      isSmartMood || newQueue?.some((t) => t?.isSmartMoodQueue) || trackToPlay.isSmartMoodQueue
    );
    nextContext = nextContext || {
      type: newQueue?._isMix || newQueue?.isMix ? 'mix' : 'playlist',
      name: newQueue?._playlistName || newQueue?.name || (isSmartQueue ? 'Rivo Smart Mix' : null),
    };
  } else {
    // Direct single track tap (Search / Home single / Chat) -> generate 20 smart suggestions after preserved manual queue
    const pool = allTracks.filter(matchTarget);
    const followed = getStoredFollowedArtists();
    const excludeSet = new Set(playedSmartSongIds);
    const targetKey = getTrackDedupeKey(trackToPlay);
    if (targetKey) excludeSet.add(targetKey);
    if (targetId) excludeSet.add(targetId);
    preservedManual.forEach((t) => {
      const mid = getTrackId(t);
      if (mid) excludeSet.add(mid);
    });

    const smartUpcoming = getSmartTasteAndMoodTracks({
      allTracks: pool,
      currentUser,
      followedArtists: followed,
      likedTrackIds: likedTrackIds || [],
      excludeTrackIds: excludeSet,
      currentTrack: trackToPlay,
      limit: 20,
      maxPerArtist: 2,
    });

    const taggedUpcoming = (smartUpcoming || []).map((t) => ({
      ...t,
      isSmartMoodQueue: true,
      isAiSuggestion: true,
    }));

    resolvedQueue = [trackToPlay, ...preservedManual, ...taggedUpcoming];
    resolvedIndex = 0;
    isSmartQueue = true;
    nextContext = nextContext || { type: 'smart', name: 'Rivo Smart Mix' };
  }

  // Mix metadata detection & preservation
  const isExplicitSingle = Boolean(
    Array.isArray(newQueue) && newQueue.length === 1 && !trackToPlay?.isMix && !newQueue._isMix && !newQueue.isMix
  );
  const isMixDetected = Boolean(
    targetKind === 'music' &&
      ((newQueue &&
        (newQueue._isMix ||
          newQueue.isMix ||
          (newQueue.name && String(newQueue.name).toUpperCase().includes('MIX')) ||
          (newQueue._transitions && Object.keys(newQueue._transitions).length > 0))) ||
        trackToPlay?.isMix ||
        trackToPlay?._isMix ||
        (isMixMode && !isExplicitSingle) ||
        resolvedQueue?._isMix ||
        resolvedQueue?.isMix ||
        (resolvedQueue?._transitions && Object.keys(resolvedQueue._transitions).length > 0))
  );

  if (resolvedQueue) {
    resolvedQueue._transitions = newQueue?._transitions || resolvedQueue._transitions || activeTransitions;
    resolvedQueue._isMix = isMixDetected;
    resolvedQueue._isExplicitPlaylist = Boolean(
      newQueue?._isExplicitPlaylist ||
        resolvedQueue._isExplicitPlaylist ||
        isMixDetected ||
        (isExplicitPlaylist && !isSmartQueue)
    );
    resolvedQueue._playlistId = newQueue?._playlistId || resolvedQueue._playlistId;
    resolvedQueue._playlistName = newQueue?._playlistName || newQueue?.name || resolvedQueue._playlistName;
    if (resolvedQueue._playlistName && !trackToPlay.mixName) {
      trackToPlay.mixName = resolvedQueue._playlistName;
    }
  }

  return { resolvedQueue, resolvedIndex, isSmartQueue, nextContext, unshuffledBase, isMixDetected };
}

function insertPreservedManualAfterCurrent(baseList, currentTrack, manualTracks) {
  if (!manualTracks || manualTracks.length === 0) return [...baseList];
  const idx = findTrackIndexInQueue(baseList, currentTrack);
  const out = [...baseList];
  const pos = idx >= 0 ? idx + 1 : 1;
  out.splice(Math.min(pos, out.length), 0, ...manualTracks);
  return out;
}
