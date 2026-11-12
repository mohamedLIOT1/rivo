import { useCallback } from 'react';
import { isRadioTrack } from '../../utils/quranUtils';
import {
  shuffleArray,
  getTrackId,
  getContentKind,
  isMatchingContentKind,
  attachQueueMeta,
  findTrackIndexInQueue,
  getTrackDedupeKey,
} from './webQueueUtils';
import {
  fetchNextSmartMusicBatch,
  fetchNextSmartMusicBatchAsync,
  pickSmartShuffleNext,
  resolvePodcastNextTarget,
  resolveQuranNextTarget,
  resolveRadioPool,
  resolveContentIsolatedPool,
} from './webQueueNextHelpers';

export function useWebQueueNavigation({
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
}) {
  const playNextTrack = useCallback(
    (isAutoAdvance = false) => {
      isContinuousPlaybackRef.current = Boolean(isAutoAdvance);
      if (jamSessionRef.current && socketRef.current) {
        if (jamSessionRef.current.queue && jamSessionRef.current.queue.length > 0) {
          socketRef.current.emit('jam:next_track', { roomCode: jamSessionRef.current.code });
          return;
        }
        const myId = socketRef.current?.id;
        const isHost =
          jamSessionRef.current.hostId === myId ||
          jamSessionRef.current.members?.find((m) => m.socketId === myId)?.isHost;
        if (!isHost) {
          socketRef.current.emit('jam:next_track', { roomCode: jamSessionRef.current.code });
          return;
        }
      }

      const cur = currentTrackRef.current;
      const navOpts = { preserveQueue: true, isQueueNavigation: true };

      if (isRadioTrack(cur)) {
        if (audioRef.current) audioRef.current.pause();
        const radioPool = resolveRadioPool(currentQueueRef.current);
        const curIdx = findTrackIndexInQueue(radioPool, cur, currentQueueIndexRef.current);
        const nextIdx = curIdx >= 0 && curIdx < radioPool.length - 1 ? curIdx + 1 : 0;
        setCurrentQueue(radioPool);
        setCurrentQueueIndex(nextIdx);
        playTrackRef.current?.(radioPool[nextIdx], radioPool, false, nextIdx, false, isAutoAdvance, navOpts);
        setIsPlaying(true);
        return;
      }

      const targetKind = getContentKind(cur);
      const matchQueueType = (t) => isMatchingContentKind(t, targetKind);
      const rawQueue = currentQueueRef.current.length > 0 ? currentQueueRef.current : tracksRef.current;
      if (!rawQueue?.length) return;

      const activeList = resolveContentIsolatedPool(rawQueue, tracksRef.current, targetKind, isOfflineMode);
      if (!activeList.length) return;

      if (audioRef.current) audioRef.current.pause();

      const curIdx = findTrackIndexInQueue(activeList, cur, currentQueueIndexRef.current);

      if (targetKind === 'podcast') {
        const { queue: nextQ, nextIdx, replacedQueue } = resolvePodcastNextTarget({
          cur,
          curIdx,
          activeList,
          allTracks: tracksRef.current || [],
        });
        if (replacedQueue) setCurrentQueue(nextQ);
        setCurrentQueueIndex(nextIdx);
        playTrackRef.current?.(nextQ[nextIdx], nextQ, false, nextIdx, false, isAutoAdvance, navOpts);
        setIsPlaying(true);
        return;
      }

      if (targetKind === 'quran') {
        const { queue: nextQ, nextIdx, replacedQueue } = resolveQuranNextTarget({
          cur,
          curIdx,
          activeList,
          allTracks: tracksRef.current || [],
        });
        if (replacedQueue) setCurrentQueue(nextQ);
        setCurrentQueueIndex(nextIdx);
        playTrackRef.current?.(nextQ[nextIdx], nextQ, false, nextIdx, false, isAutoAdvance, navOpts);
        setIsPlaying(true);
        return;
      }

      // Priority 1: Always play upcoming user-queued ("Next in Queue") items next
      if (curIdx >= 0 && curIdx + 1 < activeList.length && activeList[curIdx + 1]?._isUserQueued) {
        const nextIdx = curIdx + 1;
        setCurrentQueueIndex(nextIdx);
        playTrackRef.current?.(activeList[nextIdx], activeList, false, nextIdx, false, isAutoAdvance, navOpts);
        return;
      }

      const appendSmartBatchAndPlay = async (shuffleIt = false) => {
        try {
          activeList.forEach((t) => {
            const id = getTrackId(t);
            if (id) playedSmartSongIdsRef.current?.add(id);
            const k = getTrackDedupeKey(t);
            if (k) playedSmartSongIdsRef.current?.add(k);
          });
          const allAvailable = (tracksRef.current?.length > 0 ? tracksRef.current : activeList).filter(matchQueueType);
          const batch = await fetchNextSmartMusicBatchAsync({
            allAvailable,
            currentUser: currentUserRef.current,
            likedTrackIds: likedTrackIdsRef.current,
            playedSmartSongIdsRef,
            currentTrack: cur,
            limit: 20,
          });
          if (batch && batch.length > 0) {
            const ordered = shuffleIt && batch.length > 1 ? shuffleArray(batch) : batch;
            const nextIdx = activeList.length;
            const newQueue = [...activeList, ...ordered];
            setCurrentQueue(newQueue);
            isSmartMoodQueueRef.current = true;
            setCurrentQueueIndex(nextIdx);
            playTrackRef.current?.(newQueue[nextIdx], newQueue, false, nextIdx, true, isAutoAdvance, navOpts);
            setIsPlaying(true);
            return;
          }
        } catch (err) {
          console.warn('[Queue Navigation] Smart batch fetch error, looping queue:', err);
        }
        if (activeList.length > 0) {
          setCurrentQueueIndex(0);
          playTrackRef.current?.(activeList[0], activeList, false, 0, true, isAutoAdvance, navOpts);
          setIsPlaying(true);
        }
      };

      const isLockedPlaylistOrMix = Boolean(
        isMixModeRef?.current ||
          rawQueue?._isMix ||
          rawQueue?.isMix ||
          rawQueue?._isExplicitPlaylist
      );

      const isSmartQueue =
        !isLockedPlaylistOrMix &&
        (isSmartMoodQueueRef.current || activeList.some((t) => t.isSmartMoodQueue));
      if (isSmartQueue) {
        // Lookahead auto-replenishment: if remaining queue length <= 3, preload in background
        if (curIdx >= activeList.length - 4) {
          const allAvailable = (tracksRef.current?.length > 0 ? tracksRef.current : activeList).filter(matchQueueType);
          fetchNextSmartMusicBatchAsync({
            allAvailable,
            currentUser: currentUserRef.current,
            likedTrackIds: likedTrackIdsRef.current,
            playedSmartSongIdsRef,
            currentTrack: cur,
            limit: 15,
          }).then((extra) => {
            if (extra?.length > 0) {
              setCurrentQueue((prev) => {
                const existingIds = new Set(prev.map(getTrackId));
                const fresh = extra.filter((t) => !existingIds.has(getTrackId(t)));
                return fresh.length > 0 ? [...prev, ...fresh] : prev;
              });
            }
          }).catch(() => {});
        }

        if (curIdx >= 0 && curIdx < activeList.length - 1) {
          const nextIdx = curIdx + 1;
          setCurrentQueueIndex(nextIdx);
          playTrackRef.current?.(activeList[nextIdx], activeList, false, nextIdx, true, isAutoAdvance, navOpts);
          setIsPlaying(true);
          return;
        }
        appendSmartBatchAndPlay(Boolean(isShuffleRef.current));
        return;
      }

      if (isShuffleRef.current === 'smart' && !isLockedPlaylistOrMix) {
        const { chosen, candidatesCount } = pickSmartShuffleNext(activeList, cur);
        if (candidatesCount <= 3 && cur) fetchSmartShuffleTracks(cur, activeList);
        const chosenIdx = Math.max(0, activeList.indexOf(chosen));
        setCurrentQueueIndex(chosenIdx);
        playTrackRef.current?.(chosen, activeList, false, chosenIdx, false, isAutoAdvance, navOpts);
        return;
      }

      if (isShuffleRef.current) {
        const nextIdx = curIdx + 1;
        if (!isLockedPlaylistOrMix && (nextIdx >= activeList.length - 2 || activeList.length <= 3) && cur) {
          fetchSmartShuffleTracks(cur, activeList);
        }
        if (nextIdx >= activeList.length) {
          const isExplicitPlaylistQueue =
            isLockedPlaylistOrMix ||
            (!isSmartMoodQueueRef.current && !activeList.some((t) => t.isSmartMoodQueue || t.isAiSuggestion));
          if (isExplicitPlaylistQueue) {
            if (repeatModeRef.current === 'all' || isRepeatRef.current || !isAutoAdvance) {
              const contextTracks = activeList.filter((t) => !t._isUserQueued);
              const reshuffled = attachQueueMeta(
                shuffleArray(contextTracks.length > 0 ? contextTracks : activeList),
                activeList
              );
              setCurrentQueue(reshuffled);
              setCurrentQueueIndex(0);
              playTrackRef.current?.(reshuffled[0], reshuffled, false, 0, false, isAutoAdvance, navOpts);
            } else {
              setIsPlaying(false);
            }
            return;
          }
          appendSmartBatchAndPlay(true);
          return;
        }
        setCurrentQueueIndex(nextIdx);
        playTrackRef.current?.(activeList[nextIdx], activeList, false, nextIdx, false, isAutoAdvance, navOpts);
        return;
      }

      if (isOfflineMode) {
        const offlineQueue = activeList.filter((t) => t.downloaded || t.isOffline);
        if (offlineQueue.length === 0) return;
        const idx = findTrackIndexInQueue(offlineQueue, cur);
        const nextIdx = (idx + 1) % offlineQueue.length;
        setCurrentQueueIndex(nextIdx);
        playTrackRef.current?.(offlineQueue[nextIdx], offlineQueue, false, nextIdx, false, isAutoAdvance, navOpts);
        return;
      }

      const normalTracks = activeList.filter((t) => !t.isAiSuggestion && !t.isSmartShuffle && !t._isUserQueued);
      const isExplicitPlaylistQueue =
        isLockedPlaylistOrMix ||
        (!isSmartMoodQueueRef.current && !activeList.some((t) => t.isSmartMoodQueue || t.isAiSuggestion));

      if (curIdx >= activeList.length - 1) {
        if (isExplicitPlaylistQueue) {
          if ((repeatModeRef.current === 'all' || isRepeatRef.current || !isAutoAdvance) && normalTracks.length > 0) {
            const firstNormalIdx = activeList.findIndex(
              (t) => !t.isAiSuggestion && !t.isSmartShuffle && !t._isUserQueued
            );
            const nextIdx = firstNormalIdx >= 0 ? firstNormalIdx : 0;
            setCurrentQueueIndex(nextIdx);
            playTrackRef.current?.(activeList[nextIdx], activeList, false, nextIdx, false, isAutoAdvance, navOpts);
          } else {
            setIsPlaying(false);
          }
          return;
        }
        appendSmartBatchAndPlay(false);
        return;
      }

      const nextIdx = curIdx + 1;
      setCurrentQueueIndex(nextIdx);
      playTrackRef.current?.(activeList[nextIdx], activeList, false, nextIdx, false, isAutoAdvance, navOpts);
    },
    [
      isOfflineMode,
      isMixModeRef,
      fetchSmartShuffleTracks,
      setCurrentQueue,
      setCurrentQueueIndex,
      setIsPlaying,
      isContinuousPlaybackRef,
      jamSessionRef,
      socketRef,
      currentTrackRef,
      audioRef,
      currentQueueRef,
      currentQueueIndexRef,
      tracksRef,
      currentUserRef,
      likedTrackIdsRef,
      playTrackRef,
      playedSmartSongIdsRef,
      isSmartMoodQueueRef,
      isShuffleRef,
      repeatModeRef,
      isRepeatRef,
    ]
  );

  const playPrevTrack = useCallback(
    (isFromRemoteJam = false) => {
      if ((currentTimeRef.current || 0) > 3) {
        if (seekToRef.current) seekToRef.current(0);
        return;
      }
      isTransitionTriggeredRef.current = false;
      isSeamlessYtHandoffRef.current = false;

      if (!isFromRemoteJam && jamSessionRef.current && socketRef.current) {
        const roomCode = jamSessionRef.current.code || jamSessionRef.current.roomCode;
        if (roomCode) {
          if (!canControlJam()) return;
          socketRef.current.emit('jam:prev_track', { roomCode });
          return;
        }
      }

      const cur = currentTrackRef.current;
      const navOpts = { preserveQueue: true, isQueueNavigation: true };

      if (isRadioTrack(cur)) {
        if (audioRef.current) audioRef.current.pause();
        const radioPool = resolveRadioPool(currentQueueRef.current);
        const curIdx = findTrackIndexInQueue(radioPool, cur, currentQueueIndexRef.current);
        const prevIdx = curIdx > 0 ? curIdx - 1 : radioPool.length - 1;
        setCurrentQueue(radioPool);
        setCurrentQueueIndex(prevIdx);
        playTrackRef.current?.(radioPool[prevIdx], radioPool, false, prevIdx, false, false, navOpts);
        setIsPlaying(true);
        return;
      }

      const targetKind = getContentKind(cur);
      const matchPrevType = (t) => isMatchingContentKind(t, targetKind);

      if (targetKind === 'quran') {
        if (audioRef.current) audioRef.current.pause();
        const q = (currentQueueRef.current || []).filter(matchPrevType);
        const idx = findTrackIndexInQueue(q, cur, currentQueueIndexRef.current);
        const prevIdx = idx > 0 ? idx - 1 : q.length > 1 ? q.length - 1 : 0;
        setCurrentQueue(q);
        setCurrentQueueIndex(prevIdx);
        if (q[prevIdx]) {
          playTrackRef.current?.(q[prevIdx], q, false, prevIdx, false, false, navOpts);
        }
        setIsPlaying(true);
        return;
      }

      if (historyStackRef.current.length > 0) {
        const prevItem = historyStackRef.current.pop();
        if (prevItem && prevItem.track && matchPrevType(prevItem.track)) {
          isHistoryNavRef.current = true;
          try {
            const curQ = currentQueueRef.current || [];
            let foundIdx = findTrackIndexInQueue(curQ, prevItem.track, prevItem.queueIndex);
            let targetQueue = curQ;
            if (foundIdx < 0) {
              targetQueue = attachQueueMeta([prevItem.track, ...curQ], curQ);
              setCurrentQueue(targetQueue);
              foundIdx = 0;
            }
            setCurrentQueueIndex(foundIdx);
            playTrackRef.current?.(prevItem.track, targetQueue, false, foundIdx, false, false, navOpts);
          } finally {
            setTimeout(() => {
              isHistoryNavRef.current = false;
            }, 150);
          }
          return;
        }
      }

      const rawQueue = currentQueueRef.current.length > 0 ? currentQueueRef.current : tracksRef.current;
      if (!rawQueue?.length) return;
      const activeList = resolveContentIsolatedPool(rawQueue, tracksRef.current, targetKind, isOfflineMode);
      if (!activeList.length) return;

      if (audioRef.current) audioRef.current.pause();
      const idx = findTrackIndexInQueue(activeList, cur, currentQueueIndexRef.current);
      const prevIdx = idx > 0 ? idx - 1 : activeList.length - 1;
      setCurrentQueueIndex(prevIdx);
      playTrackRef.current?.(activeList[prevIdx], activeList, false, prevIdx, false, false, navOpts);
      setIsPlaying(true);
    },
    [
      isOfflineMode,
      currentTimeRef,
      seekToRef,
      isTransitionTriggeredRef,
      isSeamlessYtHandoffRef,
      jamSessionRef,
      socketRef,
      canControlJam,
      currentTrackRef,
      audioRef,
      currentQueueRef,
      currentQueueIndexRef,
      setCurrentQueue,
      setCurrentQueueIndex,
      playTrackRef,
      setIsPlaying,
      historyStackRef,
      isHistoryNavRef,
      tracksRef,
    ]
  );

  return { playNextTrack, playPrevTrack };
}
