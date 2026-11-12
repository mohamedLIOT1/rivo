import { useState, useRef, useEffect, useCallback } from 'react';
import {
  getContentKind,
  isMatchingContentKind,
  attachQueueMeta,
  insertIntoSpotifyQueue,
  loadPersistedQueueState,
} from './webQueueUtils';
import { useWebQueuePersistence } from './useWebQueuePersistence';
import { fetchSmartShuffleTracksApi } from './webQueueNextHelpers';
import {
  removeTrackFromQueueList,
  reorderQueueList,
  computeToggledShuffleQueue,
} from './webQueueMutations';
import { useWebQueueNavigation } from './useWebQueueNavigation';

export function useWebQueue({
  initialPersisted: externalInitialPersisted = null,
  tracksRef,
  currentTrackRef,
  currentUserRef,
  likedTrackIdsRef,
  currentTimeRef,
  activeTransRef,
  isOfflineMode,
  isPlaying,
  isMixModeRef,
  jamSessionRef,
  socketRef,
  canControlJam,
  audioRef,
  seekToRef,
  playTrackRef,
  isContinuousPlaybackRef,
  isTransitionTriggeredRef,
  isSeamlessYtHandoffRef,
  addToJamQueue,
  reorderJamQueue,
  setIsPlaying,
}) {
  const initialPersistedRef = useRef(null);
  if (!initialPersistedRef.current) {
    initialPersistedRef.current = externalInitialPersisted || loadPersistedQueueState();
  }

  const [currentQueue, setCurrentQueueState] = useState(() => initialPersistedRef.current.queue || []);
  const [currentQueueIndex, setCurrentQueueIndexState] = useState(() => initialPersistedRef.current.queueIndex || 0);
  const [queueContext, setQueueContextState] = useState(() => initialPersistedRef.current.queueContext || null);
  const [isShuffle, setIsShuffle] = useState(false); // false | 'shuffle' | 'smart'
  const [repeatMode, setRepeatMode] = useState(() => {
    try {
      const saved = localStorage.getItem('rivo_repeat_mode');
      if (saved === 'all' || saved === 'one') return saved;
      const legacy = localStorage.getItem('rivo_repeat') === 'true' || localStorage.getItem('liofy_repeat') === 'true';
      return legacy ? 'all' : 'off';
    } catch {
      return 'off';
    }
  });
  const isRepeat = repeatMode !== 'off';

  const currentQueueRef = useRef(currentQueue);
  const currentQueueIndexRef = useRef(currentQueueIndex);
  const queueContextRef = useRef(queueContext);
  const unshuffledQueueRef = useRef([]);
  const repeatModeRef = useRef(repeatMode);
  const isRepeatRef = useRef(isRepeat);
  const isShuffleRef = useRef(isShuffle);
  const historyStackRef = useRef([]);
  const isHistoryNavRef = useRef(false);
  const isSmartMoodQueueRef = useRef(false);
  const playedSmartSongIdsRef = useRef(new Set());
  const isFetchingAiShuffleRef = useRef(false);
  const smartShuffleAbortRef = useRef(null);

  useEffect(() => {
    return () => {
      smartShuffleAbortRef.current?.abort();
    };
  }, []);

  const setCurrentQueue = useCallback((nextOrUpdater) => {
    setCurrentQueueState((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater;
      const safe = Array.isArray(next) ? next : [];
      currentQueueRef.current = safe;
      return safe;
    });
  }, []);

  const setCurrentQueueIndex = useCallback((nextOrUpdater) => {
    setCurrentQueueIndexState((prev) => {
      const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater;
      const safe = typeof next === 'number' && !isNaN(next) ? next : 0;
      currentQueueIndexRef.current = safe;
      return safe;
    });
  }, []);

  const setQueueContext = useCallback((nextCtx) => {
    queueContextRef.current = nextCtx;
    setQueueContextState(nextCtx);
  }, []);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
    isRepeatRef.current = repeatMode !== 'off';
  }, [repeatMode]);

  useEffect(() => {
    isShuffleRef.current = isShuffle;
  }, [isShuffle]);

  useEffect(() => {
    if (currentQueueRef.current && activeTransRef?.current) {
      currentQueueRef.current._transitions = {
        ...(currentQueueRef.current._transitions || {}),
        ...activeTransRef.current,
      };
    }
  }, [currentQueue, activeTransRef]);

  const { flushQueuePersistence } = useWebQueuePersistence({
    currentTrackRef,
    currentQueueRef,
    currentQueueIndexRef,
    queueContextRef,
    currentTimeRef,
    currentQueue,
    currentQueueIndex,
    queueContext,
    isPlaying,
  });

  const fetchSmartShuffleTracks = useCallback(
    async (seedTrack, currentList = [], signal = null) => {
      const q = currentQueueRef.current;
      if (isMixModeRef?.current || q?._isMix || q?.isMix || q?._isExplicitPlaylist) {
        return [];
      }
      if (!seedTrack || isFetchingAiShuffleRef.current || signal?.aborted) return [];
      let effectiveSignal = signal;
      if (!effectiveSignal) {
        smartShuffleAbortRef.current?.abort();
        const controller = new AbortController();
        smartShuffleAbortRef.current = controller;
        effectiveSignal = controller.signal;
      }
      isFetchingAiShuffleRef.current = true;
      try {
        const freshTracks = await fetchSmartShuffleTracksApi({
          seedTrack,
          currentList,
          existingQueue: currentQueueRef.current,
          signal: effectiveSignal,
          token: currentUserRef.current?.token || '',
        });
        if (freshTracks.length > 0 && !effectiveSignal?.aborted) {
          setCurrentQueue((prev) => attachQueueMeta([...prev, ...freshTracks], prev));
        }
        return freshTracks;
      } catch (err) {
        if (err?.name !== 'AbortError') {
          console.warn('[Smart Shuffle] fetch error:', err);
        }
      } finally {
        isFetchingAiShuffleRef.current = false;
      }
      return [];
    },
    [currentUserRef, setCurrentQueue]
  );

  const addToQueue = useCallback(
    (trackOrTracks, playNext = false) => {
      if (!trackOrTracks) return;
      if (jamSessionRef.current?.code && socketRef.current) {
        addToJamQueue(trackOrTracks, playNext);
        return;
      }
      const tracksToAdd = Array.isArray(trackOrTracks) ? trackOrTracks.filter(Boolean) : [trackOrTracks];
      if (tracksToAdd.length === 0) return;

      if (!currentTrackRef.current) {
        playTrackRef.current?.(tracksToAdd[0], tracksToAdd, false, 0);
        return;
      }

      const targetKind = getContentKind(currentTrackRef.current);
      const filteredTracks = tracksToAdd.filter((t) => isMatchingContentKind(t, targetKind));
      if (filteredTracks.length === 0) return;

      setCurrentQueue((prev) =>
        insertIntoSpotifyQueue(prev, currentQueueIndexRef.current, currentTrackRef.current, filteredTracks, playNext)
      );
    },
    [jamSessionRef, socketRef, addToJamQueue, currentTrackRef, playTrackRef, setCurrentQueue]
  );

  const removeFromQueue = useCallback(
    (trackIdOrIndex) => {
      setCurrentQueue((prev) => {
        const { nextQueue, nextIndex } = removeTrackFromQueueList(
          prev,
          trackIdOrIndex,
          currentQueueIndexRef.current
        );
        if (nextIndex !== null) setCurrentQueueIndex(nextIndex);
        return nextQueue;
      });
    },
    [setCurrentQueue, setCurrentQueueIndex]
  );

  const reorderQueue = useCallback(
    (fromIndex, toIndex) => {
      if (jamSessionRef.current?.code && socketRef.current) {
        reorderJamQueue(fromIndex, toIndex);
      }

      setCurrentQueue((prev) => {
        const { nextQueue, nextIndex } = reorderQueueList(
          prev,
          fromIndex,
          toIndex,
          currentQueueIndexRef.current
        );
        if (nextIndex !== null) setCurrentQueueIndex(nextIndex);
        return nextQueue;
      });
    },
    [jamSessionRef, socketRef, reorderJamQueue, setCurrentQueue, setCurrentQueueIndex]
  );

  const moveQueueItem = useCallback(
    (fromIndex, direction) => {
      const q = currentQueueRef.current;
      const curIdx = currentQueueIndexRef.current;
      if (!Array.isArray(q) || fromIndex < 0 || fromIndex >= q.length) return;
      if (direction === 'up' && fromIndex > 0) {
        reorderQueue(fromIndex, fromIndex - 1);
      } else if (direction === 'down' && fromIndex < q.length - 1) {
        reorderQueue(fromIndex, fromIndex + 1);
      } else if (direction === 'top') {
        const topUpcomingIdx = curIdx >= 0 && fromIndex > curIdx ? Math.min(q.length - 1, curIdx + 1) : 0;
        if (fromIndex !== topUpcomingIdx) reorderQueue(fromIndex, topUpcomingIdx);
      } else if (direction === 'bottom' && fromIndex < q.length - 1) {
        reorderQueue(fromIndex, q.length - 1);
      }
    },
    [reorderQueue]
  );

  const clearManualQueue = useCallback(() => {
    setCurrentQueue((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      const curIdx = currentQueueIndexRef.current;
      const nextList = prev.filter((t, idx) => idx <= curIdx || !t?._isUserQueued);
      return attachQueueMeta(nextList, prev);
    });
  }, [setCurrentQueue]);

  const clearQueue = useCallback(() => {
    if (currentTrackRef.current) {
      const single = attachQueueMeta([currentTrackRef.current], currentQueueRef.current);
      setCurrentQueue(single);
      setCurrentQueueIndex(0);
    } else {
      setCurrentQueue([]);
      setCurrentQueueIndex(-1);
    }
  }, [currentTrackRef, setCurrentQueue, setCurrentQueueIndex]);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => {
      const nextMode = !prev ? 'shuffle' : prev === 'shuffle' || prev === true ? 'smart' : false;
      const curTrack = currentTrackRef.current;
      const res = computeToggledShuffleQueue({
        curList: currentQueueRef.current,
        curTrack,
        curIndexHint: currentQueueIndexRef.current,
        nextMode,
        unshuffledQueue: unshuffledQueueRef.current,
        allTracks: tracksRef.current,
      });

      if (res.nextUnshuffled) unshuffledQueueRef.current = res.nextUnshuffled;
      if (res.shouldFetchSmart && curTrack) fetchSmartShuffleTracks(curTrack, res.curList);
      if (res.nextQueue) setCurrentQueue(res.nextQueue);
      if (res.nextIndex !== null) setCurrentQueueIndex(res.nextIndex);

      try {
        localStorage.setItem('rivo_shuffle', nextMode ? 'true' : 'false');
      } catch {}

      return nextMode;
    });
  }, [currentTrackRef, tracksRef, fetchSmartShuffleTracks, setCurrentQueue, setCurrentQueueIndex]);

  const toggleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      const next = prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off';
      try {
        localStorage.setItem('rivo_repeat_mode', next);
        localStorage.setItem('rivo_repeat', next !== 'off' ? 'true' : 'false');
      } catch {}
      return next;
    });
  }, []);

  const setIsRepeat = useCallback((valOrFn) => {
    setRepeatMode((prev) => {
      let nextMode;
      if (typeof valOrFn === 'function') {
        const res = valOrFn(prev !== 'off');
        nextMode = typeof res === 'boolean' ? (res ? (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off') : 'off') : res;
      } else if (typeof valOrFn === 'boolean') {
        nextMode = valOrFn ? (prev === 'off' ? 'all' : prev) : 'off';
      } else {
        nextMode = valOrFn;
      }
      try {
        localStorage.setItem('rivo_repeat_mode', nextMode);
        localStorage.setItem('rivo_repeat', nextMode !== 'off' ? 'true' : 'false');
      } catch {}
      return nextMode;
    });
  }, []);

  const { playNextTrack, playPrevTrack } = useWebQueueNavigation({
    tracksRef,
    currentTrackRef,
    currentUserRef,
    likedTrackIdsRef,
    currentTimeRef,
    currentQueueRef,
    currentQueueIndexRef,
    setCurrentQueue,
    setCurrentQueueIndex,
    isOfflineMode,
    isMixModeRef,
    isShuffleRef,
    repeatModeRef,
    isRepeatRef,
    isSmartMoodQueueRef,
    playedSmartSongIdsRef,
    historyStackRef,
    isHistoryNavRef,
    jamSessionRef,
    socketRef,
    canControlJam,
    audioRef,
    seekToRef,
    playTrackRef,
    isContinuousPlaybackRef,
    isTransitionTriggeredRef,
    isSeamlessYtHandoffRef,
    fetchSmartShuffleTracks,
    setIsPlaying,
  });

  return {
    initialPersisted: initialPersistedRef.current,
    currentQueue,
    setCurrentQueue,
    currentQueueRef,
    currentQueueIndex,
    setCurrentQueueIndex,
    currentQueueIndexRef,
    queueContext,
    setQueueContext,
    isShuffle,
    setIsShuffle,
    isShuffleRef,
    repeatMode,
    setRepeatMode,
    repeatModeRef,
    isRepeat,
    isRepeatRef,
    setIsRepeat,
    toggleShuffle,
    toggleRepeat,
    unshuffledQueueRef,
    historyStackRef,
    isHistoryNavRef,
    isSmartMoodQueueRef,
    playedSmartSongIdsRef,
    addToQueue,
    removeFromQueue,
    reorderQueue,
    moveQueueItem,
    clearManualQueue,
    clearQueue,
    fetchSmartShuffleTracks,
    playNextTrack,
    playPrevTrack,
    flushQueuePersistence,
  };
}
