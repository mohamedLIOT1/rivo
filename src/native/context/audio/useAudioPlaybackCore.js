import { useState, useRef, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateMediaNotification } from '../../services/mediaControls';
import { ensurePlaybackPermissions } from './playbackPermissions';
import { updateAudioProgress } from '../AudioProgressContext';
import { handlePlaybackStatusUpdate } from './playbackEngine';
import { resolveTrackPlaybackUri, createAudioSound } from './streamResolverHelper';
import { saveLastPlayedState } from './useAudioPersistence';
import { buildSmartSeedQueue } from '../../utils/tasteAlgorithm';
import { isQuranContent, isRadioTrack } from '../../../utils/quranUtils';
import { INITIAL_TRACKS } from '../../data/initialTracks';
import { isPodcastContent, buildPodcastSeedQueue } from '../../utils/podcastUtils';
import { PODCAST_SHOWS_EPISODES } from '../../data/podcastsData';

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

    const currentLoadId = ++soundLoadIdRef.current;
    const requestSeq = ++playRequestSeqRef.current;
    const safeTargetSec = Math.max(0, Number(targetTime) || 0);
    trackCompletionHandledRef.current = null;

    isLoadingRef.current = true;
    setIsLoading(true);
    if (autoPlay) shouldBePlayingRef.current = true;
    ensurePlaybackPermissions();

    const curId = String(currentTrackRef.current?._id || currentTrackRef.current?.id || '');
    const nextId = String(track?._id || track?.id || '');
    if (curId && curId === nextId && soundRef.current && loadedTrackIdRef.current === curId && !isRetry) {
      isLoadingRef.current = false;
      setIsLoading(false);
      shouldBePlayingRef.current = true;
      if (autoPlay) {
        await soundRef.current.playAsync().catch(() => {});
        isPlayingRef.current = true;
        setIsPlaying(true);
        const isLikedTrack = likedTrackIds.some(id => String(id) === curId);
        updateMediaNotification(true, repeatModeRef.current, isShuffleRef.current, isLikedTrack, track);
        if (typeof broadcastListeningActivity === 'function') {
          broadcastListeningActivity(track, true, safeTargetSec);
        }
      }
      return;
    }

    currentTrackRef.current = track;
    setCurrentTrackState(track);
    saveLastPlayedState(track, Array.isArray(trackList) && trackList.length > 0 ? trackList : queueRef.current, safeTargetSec);

    playbackStatusRef.current = {
      currentTime: safeTargetSec,
      duration: Number(track.duration || 0),
      lastRequestTs: Date.now(),
      requestSeq,
    };
    progressRef.current = { currentTime: safeTargetSec, duration: Number(track.duration || 0) };
    updateAudioProgress({ currentTime: safeTargetSec, duration: Number(track.duration || 0) });
    setVocalIsolationStatus(null);

    const isLikedTrack = likedTrackIds.some(id => String(id) === String(track._id || track.id));
    updateMediaNotification(false, repeatModeRef.current, isShuffleRef.current, isLikedTrack, {
      ...track,
      currentTime: safeTargetSec,
      duration: Number(track.duration || 240),
    });

    if (autoPlay && typeof broadcastListeningActivity === 'function') {
      broadcastListeningActivity(track, true, safeTargetSec);
    }

    try {
      if (Array.isArray(trackList) && trackList.length > 0) {
        if (trackList.length === 1 && !isRadioTrack(track) && !isQuranContent(track)) {
          if (isPodcastContent(track)) {
            const podcastPool = ((userTracks?.length > 0) ? userTracks : []).filter(t => isPodcastContent(t));
            const fullPool = podcastPool.length > 0 ? podcastPool : PODCAST_SHOWS_EPISODES;
            setQueue(buildPodcastSeedQueue(track, fullPool, 20));
          } else {
            const pool = ((userTracks?.length > 0) ? userTracks : (INITIAL_TRACKS || [])).filter(t => !isQuranContent(t) && !isPodcastContent(t));
            setQueue(buildSmartSeedQueue(track, pool, { currentUser, followedArtists: currentUser?.following || [], likedTrackIds }));
          }
        } else {
          setQueue(trackList);
        }
      }

      const prevSound = soundRef.current;
      soundRef.current = null;
      loadedTrackIdRef.current = null;
      if (prevSound) {
        try { prevSound.setOnPlaybackStatusUpdate(null); } catch {}
      }

      const uri = await resolveTrackPlaybackUri({
        track,
        isVocalOnly: isVocalOnlyRef.current,
        updateVocalStatus,
        signal: abortController.signal,
      });

      if (abortController.signal.aborted || soundLoadIdRef.current !== currentLoadId) {
        if (prevSound) {
          prevSound.stopAsync().catch(() => {});
          prevSound.unloadAsync().catch(() => {});
        }
        return;
      }
      if (!uri) {
        if (prevSound) {
          prevSound.stopAsync().catch(() => {});
          prevSound.unloadAsync().catch(() => {});
        }
        throw new Error('Audio URI could not be resolved');
      }

      track.resolvedAudioUrl = uri;
      if (currentTrackRef.current && String(currentTrackRef.current._id || currentTrackRef.current.id) === String(track._id || track.id)) {
        currentTrackRef.current.resolvedAudioUrl = uri;
      }

      const { sound, status } = await createAudioSound({
        uri,
        track,
        safeTargetSec,
        volume: volumeRef.current,
        isVocalOnly: isVocalOnlyRef.current,
        updateVocalStatus,
        signal: abortController.signal,
        autoPlay,
      });

      if (abortController.signal.aborted || soundLoadIdRef.current !== currentLoadId) {
        await sound?.unloadAsync().catch(() => {});
        if (prevSound) {
          prevSound.stopAsync().catch(() => {});
          prevSound.unloadAsync().catch(() => {});
        }
        return;
      }

      if (prevSound) {
        prevSound.stopAsync().catch(() => {});
        prevSound.unloadAsync().catch(() => {});
      }

      soundRef.current = sound;
      loadedTrackIdRef.current = String(track._id || track.id);
      sound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);

      if (playbackRateRef.current && playbackRateRef.current !== 1.0) {
        await sound.setRateAsync(playbackRateRef.current, true).catch(() => {});
      }

      if (status && status.durationMillis > 1000) {
        const durSec = Math.floor(status.durationMillis / 1000);
        playbackStatusRef.current.duration = durSec;
        progressRef.current.duration = durSec;
        updateAudioProgress({ currentTime: safeTargetSec, duration: durSec });
      }

      if (autoPlay && shouldBePlayingRef.current) {
        await sound.playAsync().catch(() => {});
        isPlayingRef.current = true;
        setIsPlaying(true);
        updateMediaNotification(true, repeatModeRef.current, isShuffleRef.current, isLikedTrack, track);
        if (typeof broadcastListeningActivity === 'function') {
          broadcastListeningActivity(track, true, safeTargetSec);
        }
        if (!Boolean(isRemoteParam) && jamSyncRef?.current?.jamSession && canControlJam()) {
          jamSyncRef.current.broadcastPlayState?.(true, track, safeTargetSec);
        }
      }
    } catch (err) {
      if (!abortController.signal.aborted) {
        showToast?.(`Playback error: ${err.message || 'Stream unavailable'}`, 'error');
        setIsPlaying(false);
        isPlayingRef.current = false;
        updateMediaNotification(false, repeatModeRef.current, isShuffleRef.current, isLikedTrack, track);
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
    canControlJam, jamSyncRef
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
    if (!soundRef.current) {
      const resumePos = playbackStatusRef.current?.currentTime || 0;
      if (curTrack) return playTrack(curTrack, queueRef.current, false, resumePos);
      if (queueRef.current.length > 0) return playTrack(queueRef.current[0], queueRef.current);
      return;
    }

    const isLikedTrack = curTrack ? likedTrackIds.some(id => String(id) === String(curTrack._id || curTrack.id)) : false;
    shouldBePlayingRef.current = nextPlaying;
    isPlayingRef.current = nextPlaying;
    setIsPlaying(nextPlaying);

    const curPos = playbackStatusRef.current?.currentTime || 0;
    const curDur = playbackStatusRef.current?.duration || Number(curTrack?.duration || 240);

    if (nextPlaying) {
      await soundRef.current.playAsync().catch(() => {});
      saveLastPlayedState(curTrack, queueRef.current, curPos);
      updateMediaNotification(true, repeatModeRef.current, isShuffleRef.current, isLikedTrack, {
        ...curTrack,
        currentTime: curPos,
        duration: curDur,
      });
      broadcastListeningActivity(curTrack, true, curPos);
    } else {
      await soundRef.current.pauseAsync().catch(() => {});
      saveLastPlayedState(curTrack, queueRef.current, curPos);
      updateMediaNotification(false, repeatModeRef.current, isShuffleRef.current, isLikedTrack, {
        ...curTrack,
        currentTime: curPos,
        duration: curDur,
      });
      broadcastListeningActivity(curTrack, false, curPos);
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
    const dur = playbackStatusRef.current?.duration || progressRef.current?.duration || currentTrackRef.current?.duration || 0;
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
