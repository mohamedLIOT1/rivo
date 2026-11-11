import { getTrackId, isSameTrack, findTrackIndexInQueue } from './webQueueUtils';

/**
 * Partition queue into Spotify-style sections:
 * played, nowPlaying, manualQueue ("Next in Queue"), contextQueue ("Next From: ..."), aiQueue
 */
export function splitQueueSections(queue, currentIndex, currentTrack) {
  const list = Array.isArray(queue) ? queue : [];
  let activeIndex = findTrackIndexInQueue(list, currentTrack, currentIndex);
  if (activeIndex < 0 && currentIndex >= 0 && currentIndex < list.length) {
    activeIndex = currentIndex;
  }

  const played = [];
  const manualQueue = [];
  const contextQueue = [];
  const aiQueue = [];
  let nowPlaying = null;

  for (let i = 0; i < list.length; i++) {
    const track = list[i];
    if (!track) continue;
    const item = { track, index: i };
    if (i === activeIndex) {
      nowPlaying = item;
    } else if (activeIndex >= 0 && i < activeIndex) {
      played.push(item);
    } else if (track._isUserQueued) {
      manualQueue.push(item);
    } else if (track.isAiSuggestion || track.isSmartShuffle) {
      aiQueue.push(item);
    } else {
      contextQueue.push(item);
    }
  }

  return { activeIndex, nowPlaying, played, manualQueue, contextQueue, aiQueue };
}

export function resolveQueueContextLabel({
  queue,
  queueContext,
  selectedPlaylist,
  currentTrack,
  contextQueue = [],
  aiQueue = [],
  isCurQuran = false,
  isCurRadio = false,
  isCurPodcast = false,
  jamSession = null,
  language = 'en',
}) {
  const isAr = language === 'ar';
  if (jamSession) return isAr ? `جلسة جام (${jamSession.code})` : `Jam Session (${jamSession.code})`;
  if (isCurRadio) return isAr ? 'إذاعة القرآن الكريم' : 'Quran Live Radio';
  if (queueContext?.name) return queueContext.name;
  const qName = queue?._playlistName || queue?.name;
  if (qName) return qName;

  if (
    selectedPlaylist?.name &&
    contextQueue.some(
      (item) =>
        item.track?.album === selectedPlaylist.name ||
        item.track?.playlistTitle === selectedPlaylist.name ||
        (Array.isArray(selectedPlaylist.trackIds) && selectedPlaylist.trackIds.includes(getTrackId(item.track)))
    )
  ) {
    return selectedPlaylist.name;
  }

  if (isCurQuran) return isAr ? 'قائمة القرآن' : 'Quran Queue';
  if (isCurPodcast) return currentTrack?.artist || (isAr ? 'حلقات البودكاست' : 'Podcast Episodes');

  if (contextQueue.length > 0) {
    const album = currentTrack?.album;
    if (album && contextQueue.every((item) => item.track?.album === album)) return album;
    const artist = currentTrack?.artist;
    if (artist && contextQueue.every((item) => item.track?.artist === artist)) return artist;
    return isAr ? 'قائمة التشغيل' : 'Playing Queue';
  }

  if (aiQueue.length > 0) return isAr ? 'مقترحات ريفو الذكية' : 'Rivo Smart Mix';
  return isAr ? 'التالي' : 'Up Next';
}

export function getStoredFollowedArtists() {
  try {
    const raw = localStorage.getItem('rivo_followed_artists') || localStorage.getItem('liofy_followed_artists');
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch {}
  return [];
}

function stripHeavyFieldsForStorage(track) {
  if (!track || typeof track !== 'object') return track;
  const { lyrics, ...rest } = track;
  return rest;
}

/**
 * Persist up to 100 items centered around currentIndex so refresh keeps queue position cleanly.
 */
export function serializeQueueForStorage(queue, currentIndex = 0, maxItems = 100) {
  if (!Array.isArray(queue) || queue.length === 0) return { items: [], adjustedIndex: 0 };
  const safeIdx = Math.max(0, Math.min(queue.length - 1, Number(currentIndex) || 0));
  if (queue.length <= maxItems) {
    return {
      items: queue.map(stripHeavyFieldsForStorage),
      adjustedIndex: safeIdx,
    };
  }
  const playedKeep = Math.min(15, safeIdx);
  const start = Math.max(0, safeIdx - playedKeep);
  const end = Math.min(queue.length, start + maxItems);
  const sliced = queue.slice(start, end).map(stripHeavyFieldsForStorage);
  return {
    items: sliced,
    adjustedIndex: safeIdx - start,
  };
}

export function loadPersistedQueueState() {
  let track = null;
  let queue = [];
  let queueIndex = 0;
  let currentTime = 0;
  let queueContext = null;

  try {
    const savedTrack = localStorage.getItem('rivo_last_played_track') || localStorage.getItem('liofy_last_played_track');
    if (savedTrack) track = JSON.parse(savedTrack);
  } catch {}

  try {
    const savedQueue = localStorage.getItem('rivo_last_played_queue');
    if (savedQueue) {
      const parsed = JSON.parse(savedQueue);
      if (Array.isArray(parsed)) queue = parsed;
    }
  } catch {}

  try {
    const savedIdx = Number(localStorage.getItem('rivo_last_played_queue_index'));
    if (Number.isFinite(savedIdx) && savedIdx >= 0 && savedIdx < queue.length) {
      queueIndex = savedIdx;
    }
  } catch {}

  if (track && queue.length > 0 && !isSameTrack(queue[queueIndex], track)) {
    const found = queue.findIndex((t) => isSameTrack(t, track));
    if (found >= 0) queueIndex = found;
  }

  try {
    const savedTime = Number(localStorage.getItem('rivo_last_played_time'));
    if (Number.isFinite(savedTime) && savedTime > 0) currentTime = savedTime;
  } catch {}

  try {
    const savedCtx = localStorage.getItem('rivo_last_played_queue_context');
    if (savedCtx) queueContext = JSON.parse(savedCtx);
  } catch {}

  return { track, queue, queueIndex, currentTime, queueContext };
}
