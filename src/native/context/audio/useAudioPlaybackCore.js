import { useState, useRef, useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateMediaNotification } from '../../services/mediaControls';
import { ensurePlaybackPermissions } from './playbackPermissions';
import { updateAudioProgress } from '../AudioProgressContext';
import { handlePlaybackStatusUpdate } from './playbackEngine';
import { resolveTrackPlaybackUri, createAudioSound } from './streamResolverHelper';
import { saveLastPlayedState } from './useAudioPersistence';
import { clearStreamCache } from '../../services/youtubeResolver';
import { sanitizeDuration } from '../../utils/timeUtils';
import { buildSmartSeedQueue } from '../../utils/tasteAlgorithm';
import { isQuranContent, isRadioTrack } from '../../../utils/quranUtils';
import { QURAN_LIVE_STATIONS } from '../../data/quranLiveStations';
import { INITIAL_TRACKS } from '../../data/initialTracks';
import { isPodcastContent, buildPodcastSeedQueue } from '../../utils/podcastUtils';
import { PODCAST_SHOWS_EPISODES } from '../../data/podcastsData';

const disposeSound = (snd) => {
  if (!snd) return;
  try { snd.setOnPlaybackStatusUpdate(null); } catch {}
  snd.pauseAsync().catch(() => {});
  snd.stopAsync().catch(() => {});
  snd.unloadAsync().catch(() => {});
};

export const useAudioPlaybackCore = ({
  likedTrackIds = [], showToast, queueRef, setQueue, isShuffleRef, repeatModeRef,
  isMixModeRef, activeTransRef, setActiveTransitions, nextSoundRef, nextTrackRef,
  nextSoundPlayingRef, preloadNextTrackForDjMix, completeSeamlessHandoff,
  isMixTransitioningRef, lastMixBridgeUpdateRef, autoDownloadFinishedRef,
  handleDownloadTrack, autoPersistFinishedTrack, broadcastListeningActivity,
  jamSyncRef, canControlJam = () => true, userTracks = [], currentUser = null, isVocalOnlyRef: externalVocalOnlyRef,
}) => {
  const soundRef = useRef(null);
  const isResolvingRef = useRef(false);
  const playbackStatusRef = useRef({ currentTime: 0, duration: 0, lastRequestTs: 0 });
  const progressRef = useRef({ currentTime: 0, duration: 0 });
  const isPlayingRef = useRef(false);
  const shouldBePlayingRef = useRef(false);
  const loadedTrackIdRef = useRef(null);
  const isLoadingRef = useRef(false);
  const playRequestSeqRef = useRef(0);
  const soundLoadIdRef = useRef(0);
  const playAbortControllerRef = useRef(null);
  const stallRecoveryTimerRef = useRef(null);
  const isSeekingRef = useRef(false);
  const lastSeekTimestampRef = useRef(0);
  const trackCompletionHandledRef = useRef(null);
  const interruptedByOsRef = useRef(false);

  const [currentTrack, setCurrentTrackState] = useState(null);
  const currentTrackRef = useRef(null);
  const [isPlaying, setIsPlayingState] = useState(false);
  const [isLoading, setIsLoadingState] = useState(false);
  const [volume, setVolumeState] = useState(0.8);
  const volumeRef = useRef(0.8);

  const [isVocalOnly, setIsVocalOnlyState] = useState(false);
  const [vocalIsolationStatus, setVocalIsolationStatus] = useState(null);
  const internalVocalOnlyRef = useRef(false);
  const isVocalOnlyRef = externalVocalOnlyRef || internalVocalOnlyRef;

  const playNextTrackRef = useRef(null);
  const playTrackRef = useRef(null);

  const setCurrentTrack = useCallback((track) => {
    currentTrackRef.current = track;
    setCurrentTrackState(track);
  }, []);

  const setIsPlaying = useCallback((val) => {
    const next = typeof val === 'function' ? val(isPlayingRef.current) : Boolean(val);
    isPlayingRef.current = next;
    setIsPlayingState(next);
  }, []);

  const setIsLoading = useCallback((val) => {
    const next = typeof val === 'function' ? val(isLoadingRef.current) : Boolean(val);
    isLoadingRef.current = next;
    setIsLoadingState(next);
  }, []);

  const setVolume = useCallback((val) => {
    const next = typeof val === 'function' ? val(volumeRef.current) : Number(val);
    const clamped = Math.max(0, Math.min(1, isNaN(next) ? 0.8 : next));
    volumeRef.current = clamped;
    setVolumeState(clamped);
    if (soundRef.current) {
      soundRef.current.setVolumeAsync(clamped).catch(() => {});
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('@rivo_vocal_only').then((val) => {
      if (val !== null) {
        const b = val === 'true';
        isVocalOnlyRef.current = b;
        setIsVocalOnlyState(b);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!AppState || typeof AppState.addEventListener !== 'function') return;
    const sub = AppState.addEventListener('change', async (nextState) => {
      if (nextState !== 'active') return;
      if (!shouldBePlayingRef.current || isLoadingRef.current) return;

      const cur = currentTrackRef.current;
      if (!cur) return;

      const snd = soundRef.current;
      let recovered = false;

      if (snd) {
        try {
          const st = await snd.getStatusAsync();
          if (!shouldBePlayingRef.current || isLoadingRef.current) return;
          if (st?.isLoaded && !st?.error) {
            if (st.isPlaying || st.isBuffering) {
              interruptedByOsRef.current = false;
              if (st.isPlaying && !isPlayingRef.current) {
                setIsPlaying(true);
              }
              recovered = true;
            } else {
              const playRes = await snd.playAsync();
              if (!shouldBePlayingRef.current || isLoadingRef.current) return;
              if (playRes?.isLoaded && !playRes?.error && (playRes.isPlaying || playRes.isBuffering)) {
                interruptedByOsRef.current = false;
                setIsPlaying(true);
                const isLiked = likedTrackIds.some(id => String(id) === String(cur._id || cur.id));
                const isLive = isRadioTrack(cur) || Boolean(cur.isLive);
                if (typeof updateMediaNotification === 'function') {
                  updateMediaNotification(true, repeatModeRef?.current || 'off', isShuffleRef?.current || false, isLiked, {
                    ...cur,
                    currentTime: playbackStatusRef.current?.currentTime || 0,
                    duration: isLive ? 0 : (playbackStatusRef.current?.duration || sanitizeDuration(cur.duration, 0)),
                  });
                }
                recovered = true;
              }
            }
          }
        } catch (e) {}
      }

      if (!recovered && shouldBePlayingRef.current && !isLoadingRef.current) {
        disposeSound(snd);
        soundRef.current = null;
        loadedTrackIdRef.current = null;
        const tid = String(cur._id || cur.id || '');
        if (tid || cur.youtubeId) clearStreamCache(tid, cur.youtubeId);
        playTrackRef.current?.(
          { ...cur, resolvedAudioUrl: null, isRetry: true, _retryDone: false },
          queueRef.current,
          true,
          playbackStatusRef.current?.currentTime || 0,
          false,
          false,
          true
        );
      }
    });
    return () => sub?.remove?.();
  }, [likedTrackIds, repeatModeRef, isShuffleRef, setIsPlaying, queueRef]);

  const updateVocalStatus = useCallback((status) => {
    setVocalIsolationStatus(status);
  }, []);

  const setIsVocalOnly = useCallback((val) => {
    const b = Boolean(val);
    isVocalOnlyRef.current = b;
    setIsVocalOnlyState(b);
    if (!b) setVocalIsolationStatus(null);
    AsyncStorage.setItem('@rivo_vocal_only', String(b)).catch(() => {});
  }, []);

  const toggleVocalOnly = useCallback(() => {
    setIsVocalOnly(!isVocalOnlyRef.current);
  }, [setIsVocalOnly]);

  const onPlaybackStatusUpdate = useCallback((status) => {
    if (status?.didJustFinish) {
      if (repeatModeRef?.current === 'one' && currentTrackRef.current && typeof broadcastListeningActivity === 'function') {
        broadcastListeningActivity(currentTrackRef.current, true, 0);
      }
    }
    handlePlaybackStatusUpdate({
      status,
      playbackStatusRef,
      progressRef,
      currentTrackRef,
      soundRef,
      shouldBePlayingRef,
      isLoadingRef,
      loadedTrackIdRef,
      isSeekingRef,
      lastSeekTimestampRef,
      stallRecoveryTimerRef,
      isMixModeRef,
      activeTransRef,
      queueRef,
      volumeRef,
      lastMixBridgeUpdateRef,
      nextSoundRef,
      nextSoundPlayingRef,
      isMixTransitioningRef,
      completeSeamlessHandoff,
      preloadNextTrackForDjMix,
      playTrack: (...args) => playTrackRef.current?.(...args),
      playNextTrack: () => playNextTrackRef.current?.(),
      repeatModeRef,
      autoPersistFinishedTrack,
      handleDownloadTrack,
      autoDownloadFinishedRef,
      updateMediaNotification,
      likedTrackIds, isShuffleRef,
      setIsPlaying,
      isPlayingRef,
      trackCompletionHandledRef,
      interruptedByOsRef,
    });
  }, [
    isMixModeRef, activeTransRef, queueRef, nextSoundRef, isMixTransitioningRef,
    completeSeamlessHandoff, preloadNextTrackForDjMix, repeatModeRef,
    autoPersistFinishedTrack, handleDownloadTrack, autoDownloadFinishedRef,
    likedTrackIds, isShuffleRef, lastMixBridgeUpdateRef, setIsPlaying,
    broadcastListeningActivity,
  ]);

  const playTrack = useCallback(async (track, trackList = [], isRetry = false, targetTime = 0, isRemoteParam = false, isSmartMood = false, autoPlay = true) => {
    const isRemote = isRemoteParam === true;
    if (!track) {
      isLoadingRef.current = false;
      setIsLoading(false);
      return;
    }

    if (playAbortControllerRef.current) {
      try { playAbortControllerRef.current.abort(); } catch {}
    }
    const abortController = new AbortController();
    playAbortControllerRef.current = abortController;

    if (stallRecoveryTimerRef.current) {
      clearTimeout(stallRecoveryTimerRef.current);
      stallRecoveryTimerRef.current = null;
    }

    const currentLoadId = ++soundLoadIdRef.current;
    const requestSeq = ++playRequestSeqRef.current;
    const safeTargetSec = Math.max(0, Number(targetTime) || 0);
    trackCompletionHandledRef.current = null;

    const isLiveStream = Boolean(isRadioTrack(track) || track.isLive);
    const sanitizedDur = isLiveStream ? 0 : sanitizeDuration(track.duration, 0);
    const cleanTrack = isRetry
      ? { ...track, duration: sanitizedDur }
      : { ...track, _retryDone: false, duration: sanitizedDur };

    isLoadingRef.current = true;
    setIsLoading(true);
    if (autoPlay) {
      shouldBePlayingRef.current = true;
      interruptedByOsRef.current = false;
    }
    ensurePlaybackPermissions();

    const curId = String(currentTrackRef.current?._id || currentTrackRef.current?.id || '');
    const nextId = String(cleanTrack._id || cleanTrack.id || '');
    if (curId && curId === nextId && soundRef.current && loadedTrackIdRef.current === curId && !isRetry) {
      let reuseOk = false;
      try {
        const st = await soundRef.current.getStatusAsync();
        if (abortController.signal.aborted || soundLoadIdRef.current !== currentLoadId) return;
        if (st?.isLoaded && !st?.error) {
          if (!autoPlay) {
            reuseOk = true;
          } else {
            const playSt = await soundRef.current.playAsync();
            if (abortController.signal.aborted || soundLoadIdRef.current !== currentLoadId) return;
            if (playSt?.isLoaded && !playSt?.error && (playSt.isPlaying || playSt.isBuffering)) {
              reuseOk = true;
            }
          }
        }
      } catch {}

      if (abortController.signal.aborted || soundLoadIdRef.current !== currentLoadId) return;

      if (reuseOk) {
        if (currentTrackRef.current) {
          currentTrackRef.current._retryDone = false;
        }
        isLoadingRef.current = false;
        setIsLoading(false);
        if (autoPlay) {
          shouldBePlayingRef.current = true;
          isPlayingRef.current = true;
          setIsPlaying(true);
          const isLikedTrack = likedTrackIds.some(id => String(id) === curId);
          const curDur = isLiveStream ? 0 : (playbackStatusRef.current?.duration || sanitizedDur);
          updateMediaNotification(true, repeatModeRef.current, isShuffleRef.current, isLikedTrack, {
            ...cleanTrack,
            currentTime: playbackStatusRef.current?.currentTime ?? safeTargetSec,
            duration: curDur,
          });
          if (typeof broadcastListeningActivity === 'function') {
            broadcastListeningActivity(cleanTrack, true, safeTargetSec);
          }
        }
        return;
      }

      const deadSound = soundRef.current;
      soundRef.current = null;
      loadedTrackIdRef.current = null;
      disposeSound(deadSound);
      clearStreamCache(curId, cleanTrack.youtubeId);
    }

    // Immediately silence and unload previous sound before resolving next track
    const prevSound = soundRef.current;
    soundRef.current = null;
    loadedTrackIdRef.current = null;
    disposeSound(prevSound);
    isPlayingRef.current = false;
    setIsPlaying(false);

    currentTrackRef.current = cleanTrack;
    setCurrentTrackState(cleanTrack);
    saveLastPlayedState(cleanTrack, Array.isArray(trackList) && trackList.length > 0 ? trackList : queueRef.current, safeTargetSec);

    playbackStatusRef.current = {
      currentTime: safeTargetSec,
      duration: sanitizedDur,
      lastRequestTs: Date.now(),
      requestSeq,
    };
    progressRef.current = { currentTime: safeTargetSec, duration: sanitizedDur };
    updateAudioProgress({ currentTime: safeTargetSec, duration: sanitizedDur });
    setVocalIsolationStatus(null);

    const isLikedTrack = likedTrackIds.some(id => String(id) === nextId);
    updateMediaNotification(false, repeatModeRef.current, isShuffleRef.current, isLikedTrack, {
      ...cleanTrack,
      currentTime: safeTargetSec,
      duration: isLiveStream ? 0 : sanitizedDur,
    });

    if (autoPlay && typeof broadcastListeningActivity === 'function') {
      broadcastListeningActivity(cleanTrack, true, safeTargetSec);
    }

    try {
      const isQuran = isQuranContent(cleanTrack) || isRadioTrack(cleanTrack);
      if (Array.isArray(trackList) && trackList.length > 0) {
        if (trackList.length === 1 && !isQuran) {
          if (isPodcastContent(cleanTrack)) {
            const podcastPool = ((userTracks?.length > 0) ? userTracks : []).filter(t => isPodcastContent(t));
            const fullPool = podcastPool.length > 0 ? podcastPool : PODCAST_SHOWS_EPISODES;
            setQueue(buildPodcastSeedQueue(cleanTrack, fullPool, 20));
          } else {
            const pool = ((userTracks?.length > 0) ? userTracks : (INITIAL_TRACKS || [])).filter(t => !isQuranContent(t) && !isPodcastContent(t));
            setQueue(buildSmartSeedQueue(cleanTrack, pool, { currentUser, followedArtists: currentUser?.following || [], likedTrackIds }));
          }
        } else {
          // Strictly isolate queue according to playing content type
          if (isQuran) {
            const quranList = trackList.filter(t => isQuranContent(t) || isRadioTrack(t));
            setQueue(quranList.length > 0 ? quranList : [cleanTrack]);
          } else if (isPodcastContent(cleanTrack)) {
            const podcastList = trackList.filter(isPodcastContent);
            setQueue(podcastList.length > 0 ? podcastList : [cleanTrack]);
          } else {
            const musicList = trackList.filter(t => !isQuranContent(t) && !isRadioTrack(t) && !isPodcastContent(t));
            setQueue(musicList.length > 0 ? musicList : [cleanTrack]);
          }
        }
      } else {
        // No trackList provided: ensure existing queue is strictly segregated
        if (isQuran) {
          const quranQueue = (queueRef.current || []).filter(t => isQuranContent(t) || isRadioTrack(t));
          setQueue(quranQueue.length > 0 ? quranQueue : (isRadioTrack(cleanTrack) ? QURAN_LIVE_STATIONS : [cleanTrack]));
        } else if (isPodcastContent(cleanTrack)) {
          const podcastQueue = (queueRef.current || []).filter(isPodcastContent);
          setQueue(podcastQueue.length > 0 ? podcastQueue : [cleanTrack]);
        } else {
          const musicQueue = (queueRef.current || []).filter(t => !isQuranContent(t) && !isRadioTrack(t) && !isPodcastContent(t));
          setQueue(musicQueue.length > 0 ? musicQueue : [cleanTrack]);
        }
      }

      const uri = await resolveTrackPlaybackUri({
        track: cleanTrack,
        isVocalOnly: isVocalOnlyRef.current,
        updateVocalStatus,
        signal: abortController.signal,
      });

      if (abortController.signal.aborted || soundLoadIdRef.current !== currentLoadId) {
        return;
      }
      if (!uri) {
        throw new Error('Audio URI could not be resolved');
      }

      cleanTrack.resolvedAudioUrl = uri;
      if (currentTrackRef.current && String(currentTrackRef.current._id || currentTrackRef.current.id) === nextId) {
        currentTrackRef.current.resolvedAudioUrl = uri;
      }

      const { sound, status } = await createAudioSound({
        uri,
        track: cleanTrack,
        safeTargetSec,
        volume: volumeRef.current,
        isVocalOnly: isVocalOnlyRef.current,
        updateVocalStatus,
        signal: abortController.signal,
        autoPlay,
      });

      if (abortController.signal.aborted || soundLoadIdRef.current !== currentLoadId) {
        await sound?.unloadAsync().catch(() => {});
        return;
      }

      soundRef.current = sound;
      loadedTrackIdRef.current = nextId;
      sound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);

      if (playbackRateRef.current && playbackRateRef.current !== 1.0) {
        await sound.setRateAsync(playbackRateRef.current, true).catch(() => {});
      }

      const resolvedTrackDur = isLiveStream ? 0 : sanitizeDuration(cleanTrack.duration, sanitizedDur);
      if (!isLiveStream && status && status.durationMillis > 1000) {
        const durSec = Math.floor(status.durationMillis / 1000);
        playbackStatusRef.current.duration = durSec;
        progressRef.current.duration = durSec;
        cleanTrack.duration = durSec;
        if (currentTrackRef.current) {
          currentTrackRef.current.duration = durSec;
        }
        updateAudioProgress({ currentTime: safeTargetSec, duration: durSec });
        updateMediaNotification(
          Boolean(autoPlay && shouldBePlayingRef.current),
          repeatModeRef.current,
          isShuffleRef.current,
          isLikedTrack,
          { ...cleanTrack, currentTime: safeTargetSec, duration: durSec }
        );
      } else if (!isLiveStream && resolvedTrackDur > 0 && resolvedTrackDur !== sanitizedDur) {
        playbackStatusRef.current.duration = resolvedTrackDur;
        progressRef.current.duration = resolvedTrackDur;
        cleanTrack.duration = resolvedTrackDur;
        if (currentTrackRef.current) {
          currentTrackRef.current.duration = resolvedTrackDur;
        }
        updateAudioProgress({ currentTime: safeTargetSec, duration: resolvedTrackDur });
      }

      if (autoPlay && shouldBePlayingRef.current) {
        await sound.playAsync().catch(() => {});
        isPlayingRef.current = true;
        setIsPlaying(true);
        const finalDur = isLiveStream ? 0 : (playbackStatusRef.current.duration || resolvedTrackDur);
        updateMediaNotification(true, repeatModeRef.current, isShuffleRef.current, isLikedTrack, {
          ...cleanTrack,
          currentTime: safeTargetSec,
          duration: finalDur,
        });
        if (typeof broadcastListeningActivity === 'function') {
          broadcastListeningActivity(cleanTrack, true, safeTargetSec);
        }
        if (!Boolean(isRemoteParam) && jamSyncRef?.current?.jamSession && canControlJam()) {
          jamSyncRef.current.broadcastPlayState?.(true, cleanTrack, safeTargetSec);
        }
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        showToast?.(`Playback error: ${err.message || 'Stream unavailable'}`, 'error');
        setIsPlaying(false);
        isPlayingRef.current = false;
        updateMediaNotification(false, repeatModeRef.current, isShuffleRef.current, isLikedTrack, {
          ...cleanTrack,
          currentTime: safeTargetSec,
          duration: isLiveStream ? 0 : sanitizedDur,
        });
      }
    } finally {
      if (soundLoadIdRef.current === currentLoadId) {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    }
  }, [
    likedTrackIds, repeatModeRef, isShuffleRef, setQueue, updateVocalStatus,
    onPlaybackStatusUpdate, broadcastListeningActivity, showToast, setIsLoading,
    setIsPlaying, canControlJam, jamSyncRef
  ]);

  playTrackRef.current = playTrack;

  const playPlaylist = useCallback(async (playlistOrTracks, startIndex = 0) => {
    let list = Array.isArray(playlistOrTracks) ? playlistOrTracks : (playlistOrTracks?.tracks || []);
    if (!list || list.length === 0) return;
    const safeIdx = Math.max(0, Math.min(startIndex, list.length - 1));
    setQueue(list);
    return playTrack(list[safeIdx], list);
  }, [playTrack, setQueue]);

  const togglePlay = useCallback(async (isRemoteParam = false) => {
    const isRemote = isRemoteParam === true;
    if (isResolvingRef.current) return;
    if (!isRemote && jamSyncRef?.current?.jamSession && !canControlJam()) return;

    const nextPlaying = !isPlayingRef.current;
    if (isLoadingRef.current && nextPlaying) return;

    const curTrack = currentTrackRef.current;
    const resumePos = playbackStatusRef.current?.currentTime || 0;
    if (!soundRef.current) {
      if (curTrack) return playTrack(curTrack, queueRef.current, false, resumePos);
      if (queueRef.current.length > 0) return playTrack(queueRef.current[0], queueRef.current);
      return;
    }

    const reloadDeadTrack = () => {
      const deadSound = soundRef.current;
      soundRef.current = null;
      loadedTrackIdRef.current = null;
      disposeSound(deadSound);
      isPlayingRef.current = false;
      setIsPlaying(false);
      if (curTrack) {
        const tid = String(curTrack._id || curTrack.id || '');
        if (tid || curTrack.youtubeId) clearStreamCache(tid, curTrack.youtubeId);
        return playTrack(
          { ...curTrack, resolvedAudioUrl: null, isRetry: true, _retryDone: false },
          queueRef.current,
          true,
          resumePos
        );
      }
      if (queueRef.current.length > 0) return playTrack(queueRef.current[0], queueRef.current);
      return undefined;
    };

    if (nextPlaying) {
      const st = await soundRef.current.getStatusAsync().catch(() => null);
      if (isLoadingRef.current) return;
      if (!st?.isLoaded || st?.error) {
        return reloadDeadTrack();
      }
    }

    const isLikedTrack = curTrack ? likedTrackIds.some(id => String(id) === String(curTrack._id || curTrack.id)) : false;
    interruptedByOsRef.current = false;
    shouldBePlayingRef.current = nextPlaying;
    isPlayingRef.current = nextPlaying;
    setIsPlaying(nextPlaying);

    const curPos = playbackStatusRef.current?.currentTime || 0;
    const isLive = isRadioTrack(curTrack) || Boolean(curTrack?.isLive);
    const curDur = isLive ? 0 : (playbackStatusRef.current?.duration || sanitizeDuration(curTrack?.duration, 0));

    if (nextPlaying) {
      try {
        const playRes = await soundRef.current?.playAsync();
        if (!playRes?.isLoaded || playRes?.error || (!playRes.isPlaying && !playRes.isBuffering)) {
          throw new Error('Sound failed to resume');
        }
      } catch {
        return reloadDeadTrack();
      }
      saveLastPlayedState(curTrack, queueRef.current, curPos);
      updateMediaNotification(true, repeatModeRef.current, isShuffleRef.current, isLikedTrack, {
        ...curTrack,
        currentTime: curPos,
        duration: curDur,
      });
      broadcastListeningActivity?.(curTrack, true, curPos);
    } else {
      await soundRef.current?.pauseAsync().catch(() => {});
      saveLastPlayedState(curTrack, queueRef.current, curPos);
      updateMediaNotification(false, repeatModeRef.current, isShuffleRef.current, isLikedTrack, {
        ...curTrack,
        currentTime: curPos,
        duration: curDur,
      });
      broadcastListeningActivity?.(curTrack, false, curPos);
    }

    if (jamSyncRef?.current?.jamSession && canControlJam()) {
      jamSyncRef.current.broadcastPlayState?.(nextPlaying, curTrack, curPos);
    }
  }, [
    canControlJam, jamSyncRef, playTrack, queueRef, likedTrackIds,
    repeatModeRef, isShuffleRef, broadcastListeningActivity, setIsPlaying
  ]);

  const seekTo = useCallback(async (secs) => {
    if (isRadioTrack(currentTrackRef.current) || currentTrackRef.current?.isLive) return;
    const safeSecs = Math.max(0, Number(secs) || 0);
    const wasPlaying = isPlayingRef.current;
    isSeekingRef.current = true;
    lastSeekTimestampRef.current = Date.now();

    playbackStatusRef.current.currentTime = safeSecs;
    progressRef.current.currentTime = safeSecs;
    updateAudioProgress({ currentTime: safeSecs, duration: playbackStatusRef.current.duration });

    if (!soundRef.current) {
      isSeekingRef.current = false;
      return;
    }

    try {
      await soundRef.current.setPositionAsync(Math.round(safeSecs * 1000));
      if (wasPlaying) {
        await soundRef.current.playAsync().catch(() => {});
        shouldBePlayingRef.current = true;
        isPlayingRef.current = true;
        setIsPlaying(true);
      }
      if (jamSyncRef?.current?.jamSession && canControlJam()) {
        jamSyncRef.current.broadcastPlayState?.(wasPlaying, currentTrackRef.current, safeSecs, true);
      }
    } catch {} finally {
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 500);
    }
  }, [canControlJam, jamSyncRef, setIsPlaying]);

  const [playbackRate, setPlaybackRateState] = useState(1.0);
  const playbackRateRef = useRef(1.0);

  const setPlaybackRate = useCallback(async (rate) => {
    const r = Number(rate) || 1.0;
    playbackRateRef.current = r;
    setPlaybackRateState(r);
    if (soundRef.current) {
      try {
        await soundRef.current.setRateAsync(r, true);
      } catch {}
    }
  }, []);

  const jumpBy = useCallback(async (deltaSecs) => {
    const cur = playbackStatusRef.current?.currentTime || progressRef.current?.currentTime || 0;
    const dur = playbackStatusRef.current?.duration || progressRef.current?.duration || sanitizeDuration(currentTrackRef.current?.duration, 0);
    const target = dur > 0 ? Math.max(0, Math.min(dur, cur + deltaSecs)) : Math.max(0, cur + deltaSecs);
    await seekTo(target);
  }, [seekTo]);

  return {
    playbackRate,
    setPlaybackRate,
    jumpBy,
    soundRef,
    currentTrack,
    currentTrackRef,
    setCurrentTrack,
    isPlaying,
    isPlayingRef,
    setIsPlaying,
    isLoading,
    isLoadingRef,
    setIsLoading,
    volume,
    volumeRef,
    setVolume,
    isVocalOnly,
    setIsVocalOnly,
    toggleVocalOnly,
    vocalIsolationStatus,
    playbackStatusRef,
    progressRef,
    shouldBePlayingRef,
    loadedTrackIdRef,
    playNextTrackRef,
    playTrack,
    playPlaylist,
    togglePlay,
    seekTo,
    onPlaybackStatusUpdate,
  };
};
