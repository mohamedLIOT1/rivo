import { PODCAST_SHOWS_EPISODES } from '../../data/podcastsData';
import {
  shuffleArray,
  getTrackId,
  getContentKind,
  isMatchingContentKind,
  attachQueueMeta,
  findTrackIndexInQueue,
} from './webQueueUtils';

/**
 * Pure removal helper returning next queue list and updated active index.
 */
export function removeTrackFromQueueList(prev, trackIdOrIndex, curIdx) {
  if (!Array.isArray(prev)) return { nextQueue: [], nextIndex: null };
  let removedIndex = -1;
  let nextList = [];
  if (typeof trackIdOrIndex === 'number') {
    removedIndex = trackIdOrIndex;
    nextList = prev.filter((_, idx) => idx !== trackIdOrIndex);
  } else {
    const targetId = String(trackIdOrIndex);
    removedIndex = prev.findIndex((t) => getTrackId(t) === targetId);
    nextList = removedIndex >= 0 ? prev.filter((_, idx) => idx !== removedIndex) : prev;
  }

  let nextIndex = null;
  if (removedIndex >= 0) {
    if (curIdx === removedIndex) {
      if (curIdx >= nextList.length) nextIndex = Math.max(0, nextList.length - 1);
    } else if (curIdx > removedIndex) {
      nextIndex = curIdx - 1;
    }
  }
  return { nextQueue: attachQueueMeta(nextList, prev), nextIndex };
}

/**
 * Pure Spotify-aware reorder helper keeping active index and manual-queue boundary synced.
 */
export function reorderQueueList(prev, fromIndex, toIndex, curIdx) {
  if (
    !Array.isArray(prev) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= prev.length ||
    toIndex >= prev.length ||
    fromIndex === toIndex
  ) {
    return { nextQueue: prev, nextIndex: null };
  }

  const updated = [...prev];
  const [movedRaw] = updated.splice(fromIndex, 1);

  let newCurIdx = curIdx;
  if (curIdx >= 0) {
    if (curIdx === fromIndex) newCurIdx = toIndex;
    else if (fromIndex < curIdx && toIndex >= curIdx) newCurIdx = curIdx - 1;
    else if (fromIndex > curIdx && toIndex <= curIdx) newCurIdx = curIdx + 1;
  }

  let moved = movedRaw;
  if (newCurIdx >= 0 && toIndex > newCurIdx) {
    let lastManualIdx = newCurIdx;
    for (let i = newCurIdx + 1; i < updated.length; i++) {
      if (updated[i]?._isUserQueued) lastManualIdx = i;
      else break;
    }
    if (toIndex <= lastManualIdx + 1 && movedRaw?._isUserQueued) {
      moved = { ...movedRaw, _isUserQueued: true };
    } else if (toIndex > lastManualIdx + 1 && movedRaw?._isUserQueued) {
      moved = { ...movedRaw, _isUserQueued: false };
    }
  }

  updated.splice(toIndex, 0, moved);
  return {
    nextQueue: attachQueueMeta(updated, prev),
    nextIndex: curIdx >= 0 ? newCurIdx : null,
  };
}

/**
 * Compute next queue & index when toggling shuffle ('shuffle' | 'smart' | false) while keeping manual items up next.
 */
export function computeToggledShuffleQueue({
  curList: rawList,
  curTrack,
  curIndexHint,
  nextMode,
  unshuffledQueue,
  allTracks,
}) {
  const targetKind = getContentKind(curTrack);
  let curList = rawList;
  if (!curList || curList.length <= 1) {
    const pool = (allTracks || []).filter((t) => isMatchingContentKind(t, targetKind));
    curList = pool.length > 0 ? pool : targetKind === 'podcast' ? PODCAST_SHOWS_EPISODES : curList || [];
  }

  const curId = getTrackId(curTrack);
  let curIdx = findTrackIndexInQueue(curList, curTrack, curIndexHint);
  if (curIdx === -1 && curTrack) {
    curList = [curTrack, ...curList.filter((t) => getTrackId(t) !== curId)];
    curIdx = 0;
  }

  let nextQueue = null;
  let nextIndex = null;
  let nextUnshuffled = null;
  let shouldFetchSmart = false;

  if (nextMode === 'shuffle') {
    nextUnshuffled = attachQueueMeta([...curList], curList);
    if (curList.length <= 3 && curTrack) shouldFetchSmart = true;
    if (curList.length > 1) {
      const playedAndCurrent = curList.slice(0, Math.max(0, curIdx + 1));
      const upcoming = curList.slice(Math.max(0, curIdx + 1));
      const manualUpcoming = upcoming.filter((t) => t?._isUserQueued);
      const contextUpcoming = upcoming.filter((t) => !t?._isUserQueued);

      if (upcoming.length === 0) {
        const otherTracks = curList.filter((t) => getTrackId(t) !== curId);
        nextQueue = attachQueueMeta(
          curTrack ? [curTrack, ...shuffleArray(otherTracks)] : shuffleArray([...curList]),
          curList
        );
        nextIndex = 0;
      } else {
        nextQueue = attachQueueMeta(
          [...playedAndCurrent, ...manualUpcoming, ...shuffleArray(contextUpcoming)],
          curList
        );
        const newIdx = findTrackIndexInQueue(nextQueue, curTrack, curIdx);
        nextIndex = newIdx >= 0 ? newIdx : 0;
      }
    }
  } else if (nextMode === false && unshuffledQueue?.length > 0) {
    const original = unshuffledQueue;
    const pendingManual = curList.filter((t, i) => i > curIdx && t?._isUserQueued);
    const origIdx = Math.max(0, findTrackIndexInQueue(original, curTrack));
    if (pendingManual.length > 0) {
      const head = original.slice(0, origIdx + 1);
      const tail = original.slice(origIdx + 1).filter((t) => !t?._isUserQueued);
      nextQueue = attachQueueMeta([...head, ...pendingManual, ...tail], original);
    } else {
      nextQueue = original;
    }
    nextIndex = origIdx;
  } else if (nextMode === 'smart' && curTrack) {
    shouldFetchSmart = true;
  }

  return { curList, nextQueue, nextIndex, nextUnshuffled, shouldFetchSmart };
}
