import { useState, useRef, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config';
import { getSmartTasteAndMoodTracks } from '../../utils/tasteAlgorithm';
import { isQuranContent, isRadioTrack } from '../../../utils/quranUtils';
import { INITIAL_TRACKS } from '../../data/initialTracks';
import { getTrackDedupeKey } from '../../services/downloadManager';
import { isPodcastContent, buildPodcastSeedQueue } from '../../utils/podcastUtils';
import { PODCAST_SHOWS_EPISODES } from '../../data/podcastsData';
import { getListeningStats } from './audioApiHelpers';
import { useUser } from '../UserContext';
import { useConnectivity } from '../ConnectivityContext';
import {
  isMatchingContentType,
  handleQuranRadioNext,
  handleQuranContentNext,
  handleQuranPrev
} from './quranQueueHelper';

export const useAudioQueue = ({
  userTracks = [],
  currentUser = null,
  likedTrackIds = [],
  showToast = () => {},
  downloadedTracks = [],
  currentTrackRef,
  playbackStatusRef,
  playTrackCallbackRef,
  seekToCallbackRef,
  jamSyncRef,
  canControlJam = () => true,
  isJamHost = () => true,
  repeatModeRef,
  isMixModeRef,
}) => {
  const [queue, setQueueState] = useState([]);
  const queueRef = useRef([]);

  const [isShuffle, setIsShuffleState] = useState(false);
  const isShuffleRef = useRef(false);

  const [repeatMode, setRepeatModeState] = useState('off'); // 'off' | 'all' | 'one'

  const historyStackRef = useRef([]);
  const isHistoryNavRef = useRef(false);
  const playedInQueueCycleRef = useRef(new Set());
  const isSmartMoodQueueRef = useRef(false);
  const playedSmartSongIdsRef = useRef(new Set());
  const smartShuffleAbortRef = useRef(null);

  let userToken = null;
  try {
    userToken = useUser()?.token || null;
  } catch {}

  let isOfflineMode = false;
  try {
    isOfflineMode = useConnectivity()?.appMode === 'offline';
  } catch {}

  useEffect(() => {
    return () => {
      try { smartShuffleAbortRef.current?.abort(); } catch {}
    };
  }, []);

  const setQueue = useCallback((newQueue) => {
    const safeArr = Array.isArray(newQueue) ? newQueue : [];
    if (Array.isArray(newQueue)) {
      if (newQueue.isMix) safeArr.isMix = true;
      if (newQueue._isMix) safeArr._isMix = true;
      if (newQueue._isExplicitPlaylist) safeArr._isExplicitPlaylist = true;
      if (newQueue.name) safeArr.name = newQueue.name;
      if (newQueue._transitions) safeArr._transitions = newQueue._transitions;
    }
    queueRef.current = safeArr;
    setQueueState(safeArr);
  }, []);

  const addToQueue = useCallback((track) => {
    if (!track) return;
    const cur = currentTrackRef.current;
    if (cur && !isMatchingContentType(cur, track)) return;
    const newQ = [...queueRef.current, track];
    setQueue(newQ);
    showToast(`Added to queue: ${track.title}`, 'info');
  }, [setQueue, showToast, currentTrackRef]);

  const addMultipleToQueue = useCallback((tracksToAdd) => {
    if (!Array.isArray(tracksToAdd) || tracksToAdd.length === 0) return;
    const cur = currentTrackRef.current;
    const allowedTracks = cur ? tracksToAdd.filter(t => isMatchingContentType(cur, t)) : tracksToAdd;
    if (allowedTracks.length === 0) return;
    const newQ = [...queueRef.current, ...allowedTracks];
    setQueue(newQ);
    showToast(`Added ${allowedTracks.length} track(s) to queue`, 'info');
  }, [setQueue, showToast, currentTrackRef]);

  const removeFromQueue = useCallback((trackIdOrIdx) => {
    if (typeof trackIdOrIdx === 'number') {
      const newQ = [...queueRef.current];
      newQ.splice(trackIdOrIdx, 1);
      setQueue(newQ);
      return;
    }
    const newQ = queueRef.current.filter(t => String(t._id || t.id) !== String(trackIdOrIdx));
    setQueue(newQ);
  }, [setQueue]);

  const reorderQueue = useCallback((fromIdx, toIdx) => {
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= queueRef.current.length || toIdx >= queueRef.current.length) return;
    const newQ = [...queueRef.current];
    const [moved] = newQ.splice(fromIdx, 1);
    newQ.splice(toIdx, 0, moved);
    setQueue(newQ);
  }, [setQueue]);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, [setQueue]);

  const setIsShuffle = useCallback((val) => {
    const next = typeof val === 'function' ? val(isShuffleRef.current) : Boolean(val);
    isShuffleRef.current = next;
    setIsShuffleState(next);
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => {
      const next = !prev;
      isShuffleRef.current = next;
      if (next && queueRef.current.length > 1) {
        const cur = currentTrackRef.current;
        const curId = String(cur?._id || cur?.id || '');
        const currentIdx = queueRef.current.findIndex(t => String(t._id || t.id) === curId);
        if (currentIdx >= 0) {
          const played = queueRef.current.slice(0, currentIdx + 1);
          const upcoming = queueRef.current.slice(currentIdx + 1);
          const shuffledUpcoming = [...upcoming].sort(() => Math.random() - 0.5);
          setQueue([...played, ...shuffledUpcoming]);
        } else {
          const shuffled = [...queueRef.current].sort(() => Math.random() - 0.5);
          setQueue(shuffled);
        }
      }
      return next;
    });
  }, [currentTrackRef, setQueue, setIsShuffle]);

  const setRepeatMode = useCallback((val) => {
    const next = typeof val === 'function' ? val(repeatModeRef.current) : val;
    repeatModeRef.current = next;
    setRepeatModeState(next);
  }, [repeatModeRef]);

  const toggleRepeat = useCallback(() => {
    setRepeatMode(prev => {
      if (prev === 'off') return 'all';
      if (prev === 'all') return 'one';
      return 'off';
    });
  }, [setRepeatMode]);

  const playNextTrack = useCallback((forceLocal = false) => {
    if (jamSyncRef?.current?.jamSession && !canControlJam()) {
      return;
    }
    if (!forceLocal && jamSyncRef?.current?.jamSession && jamSyncRef?.current?.socket) {
      const roomCode = jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode;
      if (roomCode) {
        if (!canControlJam()) return;
        if (jamSyncRef.current.jamSession.queue && jamSyncRef.current.jamSession.queue.length > 0) {
          jamSyncRef.current.socket.emit('jam:next_track', { roomCode });
          return;
        }
      }
    }

    const cur = currentTrackRef.current;

    // Strict Quran Radio isolation & continuous wrap-around loop
    if (cur && isRadioTrack(cur)) {
      handleQuranRadioNext(cur, queueRef.current, playTrackCallbackRef.current, setQueue);
      return;
    }

    // Strict Holy Quran Recitation isolation
    if (cur && isQuranContent(cur)) {
      handleQuranContentNext(cur, queueRef.current, userTracks, downloadedTracks, playTrackCallbackRef.current, setQueue);
      return;
    }

    let q = queueRef.current;
    if (!q || q.length === 0) {
      q = downloadedTracks.length > 0 ? downloadedTracks : [];
      if (q.length > 0) setQueue(q);
    }
    const isCurRadio = Boolean(cur && isRadioTrack(cur));
    const isCurQuran = !isCurRadio && Boolean(cur && isQuranContent(cur));
    const isCurPodcast = !isCurRadio && !isCurQuran && Boolean(cur && isPodcastContent(cur));

    const triggerAutoQueue = async () => {
      try {
        // Strict Podcast Auto-Queue: Never recommend songs after a podcast!
        if (isCurPodcast) {
          const podcastPool = ((userTracks && userTracks.length > 0) ? userTracks : [])
            .filter(t => isPodcastContent(t));
          const fullPool = podcastPool.length > 0 ? podcastPool : PODCAST_SHOWS_EPISODES;
          const seedQ = buildPodcastSeedQueue(cur, fullPool, 20);
          const nextBatch = seedQ.filter(t => String(t._id || t.id) !== String(cur?._id || cur?.id));
          if (nextBatch.length > 0) {
            const newQueue = cur ? [cur, ...nextBatch] : nextBatch;
            setQueue(newQueue);
            if (playTrackCallbackRef.current) playTrackCallbackRef.current(nextBatch[0], newQueue);
            return;
          }
          if (seedQ.length > 0) {
            setQueue(seedQ);
            if (playTrackCallbackRef.current) playTrackCallbackRef.current(seedQ[0], seedQ);
            return;
          }
          return;
        }

        if (cur) {
          playedSmartSongIdsRef.current.add(String(cur._id || cur.id));
          const curDedupeKey = getTrackDedupeKey(cur);
          if (curDedupeKey) playedSmartSongIdsRef.current.add(curDedupeKey);
        }
        (queueRef.current || []).forEach(t => {
          if (t) {
            playedSmartSongIdsRef.current.add(String(t._id || t.id));
            const k = getTrackDedupeKey(t);
            if (k) playedSmartSongIdsRef.current.add(k);
          }
        });

        const pool = ((userTracks && userTracks.length > 0) ? userTracks : (INITIAL_TRACKS || []))
          .filter(t => !isQuranContent(t) && !isRadioTrack(t) && !isPodcastContent(t));

        const localStats = getListeningStats?.() || {};
        const statTracks = Object.values(localStats.trackStats || {}).slice(0, 10);
        const recentHistory = [
          ...historyStackRef.current.slice(-8).reverse(),
          ...statTracks,
          ...(Array.isArray(currentUser?.recentTracks) ? currentUser.recentTracks.slice(0, 8) : []),
        ].filter(Boolean).slice(0, 15).map(t => ({
          id: String(t._id || t.id || ''),
          title: t.title || '',
          artist: t.artist || '',
          genre: t.genre || '',
        }));
        const listeningStats = { ...localStats, history: recentHistory };

        let nextBatch = getSmartTasteAndMoodTracks({
          allTracks: pool,
          currentUser,
          followedArtists: currentUser?.following || [],
          likedTrackIds,
          excludeTrackIds: playedSmartSongIdsRef.current,
          limit: 25,
          listeningStats,
          currentTrack: cur || currentTrackRef.current,
          maxPerArtist: 2,
        });

        if (!nextBatch || nextBatch.length === 0) {
          const curK = cur ? getTrackDedupeKey(cur) : '';
          const curTId = String(cur?._id || cur?.id || '');
          const recentList = Array.from(playedSmartSongIdsRef.current).slice(-15);
          playedSmartSongIdsRef.current = new Set([curTId, curK, ...recentList].filter(Boolean));
          nextBatch = getSmartTasteAndMoodTracks({
            allTracks: pool,
            currentUser,
            followedArtists: currentUser?.following || [],
            likedTrackIds,
            excludeTrackIds: playedSmartSongIdsRef.current,
            limit: 25,
            listeningStats,
            currentTrack: cur || currentTrackRef.current,
            maxPerArtist: 2,
          });
        }

        // Personalize via server AI smart-shuffle when online (attaching user token + recentTracks + likedTrackIds)
        if (!isOfflineMode && API_BASE_URL) {
          try { smartShuffleAbortRef.current?.abort(); } catch {}
          const controller = new AbortController();
          smartShuffleAbortRef.current = controller;
          const timeoutId = setTimeout(() => {
            try { controller.abort(); } catch {}
          }, 3500);
          try {
            const authToken = userToken || (await AsyncStorage.getItem('@rivo_auth_token_v2').catch(() => null));
            if (!controller.signal.aborted) {
              const res = await fetch(`${API_BASE_URL}/api/ai/smart-shuffle`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
                },
                body: JSON.stringify({
                  currentTrack: cur || currentTrackRef.current,
                  seedTracks: (queueRef.current || []).slice(-5),
                  recentTracks: recentHistory,
                  likedTrackIds: Array.isArray(likedTrackIds) ? likedTrackIds.slice(0, 50) : [],
                  followedArtists: currentUser?.following || [],
                  limit: 12,
                }),
                signal: controller.signal,
              });
              if (res.ok && !controller.signal.aborted) {
                const data = await res.json();
                if (data?.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
                  const seen = new Set(playedSmartSongIdsRef.current);
                  const aiTracks = [];
                  for (const t of data.tracks) {
                    if (!t || isQuranContent(t) || isRadioTrack(t) || isPodcastContent(t)) continue;
                    const tid = String(t._id || t.id || '');
                    const tkey = getTrackDedupeKey(t);
                    if ((tid && seen.has(tid)) || (tkey && seen.has(tkey))) continue;
                    if (tid) seen.add(tid);
                    if (tkey) seen.add(tkey);
                    aiTracks.push({ ...t, isAiSuggestion: true, isSmartShuffle: true });
                  }
                  if (aiTracks.length > 0) {
                    const remainingLocal = (nextBatch || []).filter(lt => {
                      const lId = String(lt._id || lt.id || '');
                      const lKey = getTrackDedupeKey(lt);
                      return (!lId || !seen.has(lId)) && (!lKey || !seen.has(lKey));
                    });
                    nextBatch = [...aiTracks, ...remainingLocal].slice(0, 25);
                  }
                }
              }
            }
          } catch {} finally {
            clearTimeout(timeoutId);
          }
        }

        if (nextBatch && nextBatch.length > 0) {
          const prevQ = queueRef.current || [];
          const existingIds = new Set(prevQ.map(t => String(t._id || t.id)));
          const freshBatch = nextBatch.filter(t => !existingIds.has(String(t._id || t.id)));
          const newQueue = freshBatch.length > 0 ? [...prevQ, ...freshBatch] : (cur ? [cur, ...nextBatch] : nextBatch);
          setQueue(newQueue);
          const nextTrackToPlay = freshBatch.length > 0 ? freshBatch[0] : nextBatch[0];
          if (playTrackCallbackRef.current && nextTrackToPlay) playTrackCallbackRef.current(nextTrackToPlay, newQueue);
          return;
        }

        // Seamless wrap-around fallback so background playback never dies unexpectedly
        if (q && q.length > 0 && playTrackCallbackRef.current) {
          playTrackCallbackRef.current(q[0], q);
          return;
        }
      } catch (err) {}
    };

    const currentId = String(cur?._id || cur?.id || '');
    let i = q.findIndex(t => String(t._id || t.id) === currentId);

    const isMixQueueLocked = Boolean(q.isMix || q._isMix || q._isExplicitPlaylist || isMixModeRef?.current);
    if (isShuffleRef.current && q.length > 1) {
      const unplayed = q.filter((t, idx) => idx !== i && !playedInQueueCycleRef.current.has(String(t._id || t.id)));
      if (unplayed.length > 0) {
        const randomTrack = unplayed[Math.floor(Math.random() * unplayed.length)];
        playedInQueueCycleRef.current.add(String(randomTrack._id || randomTrack.id));
        if (playTrackCallbackRef.current) playTrackCallbackRef.current(randomTrack, q);
        return;
      }
      playedInQueueCycleRef.current.clear();
      if (cur) playedInQueueCycleRef.current.add(currentId);
    }

    if (i >= 0 && i < q.length - 1) {
      if (i >= q.length - 4 && !isMixQueueLocked && !isOfflineMode) {
        // Pre-fetch next smart batch in background before queue starvation
        triggerAutoQueue();
      }
      if (playTrackCallbackRef.current) playTrackCallbackRef.current(q[i + 1], q);
    } else if (q.length > 0) {
      const isExplicitPlaylist = isMixQueueLocked || !q.some(t => t.isSmartMoodQueue || t.isAiSuggestion);
      if ((repeatModeRef.current === 'all' || isMixQueueLocked) && isExplicitPlaylist) {
        if (playTrackCallbackRef.current) playTrackCallbackRef.current(q[0], q);
      } else {
        triggerAutoQueue();
      }
    } else if (!isMixQueueLocked) {
      triggerAutoQueue();
    }
  }, [
    jamSyncRef, canControlJam, isJamHost, downloadedTracks, setQueue, currentTrackRef,
    userTracks, currentUser, likedTrackIds, playTrackCallbackRef, repeatModeRef, isMixModeRef,
    isOfflineMode, userToken
  ]);

  const playPrevTrack = useCallback((isFromRemoteJam = false) => {
    if (jamSyncRef?.current?.jamSession && !canControlJam()) {
      return;
    }
    if ((playbackStatusRef.current?.currentTime || 0) > 3) {
      if (seekToCallbackRef.current) seekToCallbackRef.current(0);
      return;
    }

    if (!isFromRemoteJam && jamSyncRef?.current?.jamSession && jamSyncRef?.current?.socket) {
      const roomCode = jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode;
      if (roomCode) {
        if (!canControlJam()) return;
        jamSyncRef.current.socket.emit('jam:prev_track', { roomCode });
        return;
      }
    }

    const cur = currentTrackRef.current;

    // Strict Quran Radio & Quran Recitation backwards loop
    if (cur && (isRadioTrack(cur) || isQuranContent(cur))) {
      handleQuranPrev(cur, queueRef.current, playTrackCallbackRef.current, setQueue);
      return;
    }

    if (historyStackRef.current.length > 0) {
      const prev = historyStackRef.current.pop();
      isHistoryNavRef.current = true;
      if (playTrackCallbackRef.current) playTrackCallbackRef.current(prev, queueRef.current);
      return;
    }

    let q = queueRef.current;
    if (!q || q.length === 0) {
      q = downloadedTracks.length > 0 ? downloadedTracks : [];
      if (q.length > 0) setQueue(q);
    }
    if (!q || q.length === 0) return;

    const currentId = String(currentTrackRef.current?._id || currentTrackRef.current?.id || '');
    let i = q.findIndex(t => String(t._id || t.id) === currentId);

    if (i > 0) {
      if (playTrackCallbackRef.current) playTrackCallbackRef.current(q[i - 1], q);
    } else {
      if (playTrackCallbackRef.current) playTrackCallbackRef.current(q[q.length - 1], q);
    }
  }, [
    playbackStatusRef, seekToCallbackRef, jamSyncRef, canControlJam,
    downloadedTracks, setQueue, currentTrackRef, playTrackCallbackRef
  ]);

  return {
    queue,
    queueRef,
    setQueue,
    addToQueue,
    addMultipleToQueue,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    isShuffle,
    isShuffleRef,
    setIsShuffle,
    toggleShuffle,
    repeatMode,
    setRepeatMode,
    toggleRepeat,
    historyStackRef,
    isHistoryNavRef,
    playNextTrack,
    playPrevTrack,
  };
};
