import React, { createContext, useContext, useEffect, useRef, useMemo, useCallback } from 'react';
import { INITIAL_TRACKS } from '../data/initialTracks';
import { updateMediaNotification, updateMediaQueue } from '../services/mediaControls';
import { useConnectivity } from './ConnectivityContext';
import { useToast } from './ToastContext';
import { SleepTimerProvider } from './SleepTimerContext';
import { useUser } from './UserContext';
import { AudioProgressProvider } from './AudioProgressContext';
import { applyStandardAudioMode } from './audio/audioModeConfig';

import { useAudioQueue } from './audio/useAudioQueue';
import { useDjCrossfade } from './audio/useDjCrossfade';
import { useAudioDownloads } from './audio/useAudioDownloads';
import { useJamPlaybackSync } from './audio/useJamPlaybackSync';
import { useAudioPlaybackCore } from './audio/useAudioPlaybackCore';
import { useAudioLyrics } from './audio/useAudioLyrics';
import { autoPersistFinishedTrack, broadcastListeningActivity } from './audio/audioApiHelpers';
import { useAudioPersistence } from './audio/useAudioPersistence';
import { useAudioMediaSession } from './audio/useAudioMediaSession';

export const AudioContext = createContext();

export const AudioProvider = ({ children }) => {
  const { showToast } = useToast();
  const conn = useConnectivity();
  const isOffline = conn?.appMode === 'offline';

  let userCtx = {};
  try {
    userCtx = useUser() || {};
  } catch {}
  const { token, currentUser, likedTrackIds = [], tracks: userTracks = [] } = userCtx;

  useEffect(() => {
    applyStandardAudioMode();
  }, []);

  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
    return () => {};
  }, [token]);

  // Full Player Modal trigger registry
  const fullPlayerHandlerRef = useRef(null);
  const registerFullPlayerHandler = useCallback((fn) => {
    fullPlayerHandlerRef.current = fn;
  }, []);
  const openFullPlayer = useCallback(() => {
    if (typeof fullPlayerHandlerRef.current === 'function') {
      fullPlayerHandlerRef.current();
    }
  }, []);

  const autoPersistFinishedTrackHandler = useCallback((track) => {
    autoPersistFinishedTrack(track);
  }, []);

  const broadcastListeningActivityHandler = useCallback((track, playingState, posSeconds = 0) => {
    broadcastListeningActivity(tokenRef.current, track, playingState, posSeconds);
  }, []);

  // Shared forward callback refs
  const playTrackCallbackRef = useRef(null);
  const seekToCallbackRef = useRef(null);
  const playbackStatusUpdateCallbackRef = useRef(null);

  // Audio Downloads Hook
  const currentTrackRef = useRef(null);
  const isPlayingRef = useRef(false);
  const repeatModeRef = useRef('off');
  const isShuffleRef = useRef(false);

  const downloads = useAudioDownloads({
    showToast,
    currentTrackRef,
    isPlayingRef,
    repeatModeRef,
    isShuffleRef,
    likedTrackIds,
  });

  // Jam Sync Hook
  const playbackStatusRef = useRef({ currentTime: 0, duration: 0 });
  const progressRef = useRef({ currentTime: 0, duration: 0 });
  const soundRef = useRef(null);
  const shouldBePlayingRef = useRef(false);
  const loadedTrackIdRef = useRef(null);
  const setCurrentTrackRef = useRef(null);
  const setIsPlayingRef = useRef(null);

  const jamSync = useJamPlaybackSync({
    currentUser,
    currentTrackRef,
    soundRef,
    isPlayingRef,
    shouldBePlayingRef,
    loadedTrackIdRef,
    playbackStatusRef,
    progressRef,
    setCurrentTrack: (t) => setCurrentTrackRef.current?.(t),
    setIsPlaying: (p) => setIsPlayingRef.current?.(p),
    seekToCallbackRef,
    playTrackCallbackRef,
    likedTrackIds,
    repeatModeRef,
    isShuffleRef,
  });

  // Audio Queue Hook
  const isMixModeRef = useRef(false);
  const queue = useAudioQueue({
    userTracks,
    currentUser,
    likedTrackIds,
    showToast,
    downloadedTracks: downloads.downloadedTracks,
    currentTrackRef,
    playbackStatusRef,
    playTrackCallbackRef,
    seekToCallbackRef,
    jamSyncRef: jamSync.jamSyncRef,
    canControlJam: jamSync.canControlJam,
    isJamHost: jamSync.isJamHost,
    repeatModeRef,
    isMixModeRef,
  });

  // DJ Crossfade Hook
  const volumeRef = useRef(0.8);
  const isLoadingRef = useRef(false);
  const isVocalOnlyRef = useRef(false);
  const dj = useDjCrossfade({
    currentTrackRef,
    queueRef: queue.queueRef,
    soundRef,
    volumeRef,
    isPlayingRef,
    isLoadingRef,
    shouldBePlayingRef,
    loadedTrackIdRef,
    downloadedTracksRef: downloads.downloadedTracksRef,
    isOfflineRef: { current: isOffline },
    isVocalOnlyRef,
    setCurrentTrack: (t) => setCurrentTrackRef.current?.(t),
    setIsPlaying: (p) => setIsPlayingRef.current?.(p),
    setIsLoading: (l) => {},
    onPlaybackStatusUpdate: (status) => playbackStatusUpdateCallbackRef.current?.(status),
    playNextTrackCallbackRef: { current: queue.playNextTrack },
    updateMediaNotificationCallback: updateMediaNotification,
    likedTrackIds,
    repeatModeRef,
    isShuffleRef,
    autoDownloadFinishedRef: downloads.autoDownloadFinishedRef,
    handleDownloadTrack: downloads.queueAutoDownloadTrack,
    autoPersistFinishedTrack: autoPersistFinishedTrackHandler,
  });

  isMixModeRef.current = dj.isMixMode;

  // Audio Playback Core Hook
  const playback = useAudioPlaybackCore({
    tokenRef,
    likedTrackIds,
    userTracks,
    isOffline,
    showToast,
    queueRef: queue.queueRef,
    setQueue: queue.setQueue,
    isShuffleRef: queue.isShuffleRef,
    repeatModeRef,
    isMixModeRef: dj.isMixModeRef,
    activeTransRef: dj.activeTransRef,
    setActiveTransitions: dj.setActiveTransitions,
    nextSoundRef: dj.nextSoundRef,
    nextTrackRef: dj.nextTrackRef,
    nextSoundPlayingRef: dj.nextSoundPlayingRef,
    preloadNextTrackForDjMix: dj.preloadNextTrackForDjMix,
    completeSeamlessHandoff: dj.completeSeamlessHandoff,
    isMixTransitioningRef: dj.isMixTransitioningRef,
    lastMixBridgeUpdateRef: dj.lastMixBridgeUpdateRef,
    autoDownloadFinishedRef: downloads.autoDownloadFinishedRef,
    handleDownloadTrack: downloads.queueAutoDownloadTrack,
    autoPersistFinishedTrack: autoPersistFinishedTrackHandler,
    broadcastListeningActivity: broadcastListeningActivityHandler,
    jamSyncRef: jamSync.jamSyncRef,
    canControlJam: jamSync.canControlJam,
    currentUser,
    isVocalOnlyRef,
  });

  // Audio Lyrics Hook
  const lyricsState = useAudioLyrics(playback.currentTrack, isOffline, downloads.downloadedTracks, token);

  // Sync bridge refs
  soundRef.current = playback.soundRef.current;
  playbackStatusRef.current = playback.playbackStatusRef.current;
  currentTrackRef.current = playback.currentTrack;
  isPlayingRef.current = playback.isPlaying;
  setCurrentTrackRef.current = playback.setCurrentTrack;
  setIsPlayingRef.current = playback.setIsPlaying;
  playTrackCallbackRef.current = playback.playTrack;
  seekToCallbackRef.current = playback.seekTo;
  playbackStatusUpdateCallbackRef.current = playback.onPlaybackStatusUpdate;
  playback.playNextTrackRef.current = queue.playNextTrack;

  // Hydrate last played track and queue on cold boot
  useAudioPersistence({
    currentTrackRef,
    setCurrentTrack: playback.setCurrentTrack,
    queueRef: queue.queueRef,
    setQueue: queue.setQueue,
    playbackStatusRef,
    progressRef,
    repeatModeRef,
    isShuffleRef,
  });

  const playbackRef = useRef(playback);
  playbackRef.current = playback;
  const queueRef = useRef(queue);
  queueRef.current = queue;

  // Initialize Audio hardware session once on mount & handle lockscreen/notification actions
  useAudioMediaSession({
    playbackRef,
    queueRef,
    lyrics: lyricsState?.lyrics,
  });

  useEffect(() => {
    updateMediaQueue(queue.queue, playback.currentTrack);
  }, [queue.queue, playback.currentTrack]);

  const stopPlaybackForSleepTimer = useCallback(async () => {
    if (playback.soundRef.current) {
      await playback.soundRef.current.pauseAsync().catch(() => {});
      playback.setIsPlaying(false);
    }
  }, [playback]);

  const startSleepTimer = useCallback((minutes) => {
    // Sleep timer integration
  }, []);

  const cancelSleepTimer = useCallback(() => {
    // Cancel sleep timer
  }, []);

  const previewDjTransitionCallback = useCallback((tA, tB, cfg) => {
    return dj.previewDjTransition(tA, tB, cfg, playback.seekTo, playback.playTrack);
  }, [dj, playback.seekTo, playback.playTrack]);

  // Memoized Context value
  const controls = useMemo(() => {
    const curTime = playback.playbackStatusRef.current?.currentTime || 0;
    const dur = playback.playbackStatusRef.current?.duration || 0;
    // Division-by-zero protection: guard duration <= 0 avoiding division by zero
    const progressFraction = dur > 0 ? Math.min(1, Math.max(0, curTime / dur)) : 0;

    return {
      currentTrack: playback.currentTrack,
      isPlaying: playback.isPlaying,
      isLoading: playback.isLoading,
      isShuffle: queue.isShuffle,
      repeatMode: queue.repeatMode,
      isOfflineMode: isOffline,
      downloadedTracks: downloads.downloadedTracks,
      downloadingIds: downloads.downloadingIds,
      queue: queue.queue,
      progress: {
        currentTime: curTime,
        duration: dur,
        fraction: progressFraction,
      },
      tracks: queue.queue.length > 0 ? queue.queue : INITIAL_TRACKS,
      lyrics: lyricsState.lyrics,
      isLoadingLyrics: lyricsState.isLoadingLyrics,
      setLyrics: lyricsState.setLyrics,
      saveLyrics: lyricsState.saveTrackLyrics,
      volume: playback.volume,
      setVolume: playback.setVolume,

      isVocalOnly: playback.isVocalOnly,
      setIsVocalOnly: playback.setIsVocalOnly,
      toggleVocalOnly: playback.toggleVocalOnly,
      vocalIsolationStatus: playback.vocalIsolationStatus,
      isMixMode: dj.isMixMode,
      setIsMixMode: dj.setIsMixMode,
      mixDuration: dj.mixDuration,
      setMixDuration: dj.setMixDuration,
      mixStyle: dj.mixStyle,
      setMixStyle: dj.setMixStyle,
      triggerManualMix: dj.triggerManualMix,
      previewDjTransition: previewDjTransitionCallback,
      activeTransitions: dj.activeTransitions,
      setActiveTransitions: dj.updateActiveTransitions,

      playTrack: playback.playTrack,
      playPlaylist: playback.playPlaylist,
      togglePlay: playback.togglePlay,
      seekTo: playback.seekTo,
      jumpBy: playback.jumpBy,
      playbackRate: playback.playbackRate,
      setPlaybackRate: playback.setPlaybackRate,
      setIsShuffle: queue.setIsShuffle,
      toggleShuffle: queue.toggleShuffle,
      toggleRepeat: queue.toggleRepeat,
      playNextTrack: queue.playNextTrack,
      playPrevTrack: queue.playPrevTrack,

      addToQueue: queue.addToQueue,
      addMultipleToQueue: queue.addMultipleToQueue,
      setQueue: queue.setQueue,
      removeFromQueue: queue.removeFromQueue,
      reorderQueue: queue.reorderQueue,
      clearQueue: queue.clearQueue,

      startSleepTimer,
      cancelSleepTimer,

      handleDownloadTrack: downloads.handleDownloadTrack,
      handleDownloadPlaylist: downloads.handleDownloadPlaylist,
      removeDownloadedTrack: downloads.removeDownloadedTrack,
      removeDownloadedTracksBatch: downloads.removeDownloadedTracksBatch,
      refreshDownloadedTracks: downloads.refreshDownloadedTracks,

      registerFullPlayerHandler,
      openFullPlayer,

      autoDownloadFinished: downloads.autoDownloadFinished,
      toggleAutoDownloadFinished: downloads.toggleAutoDownloadFinished,

      downloadedTrackIds: downloads.downloadedTrackIds,
      isTrackDownloaded: downloads.isTrackDownloaded,

      syncFromOnlineTrack: jamSync.syncFromOnlineTrack,
      pauseNativePlayback: jamSync.pauseNativePlayback,
      syncRemotePlayState: jamSync.syncRemotePlayState,
      broadcastJamPlayState: jamSync.broadcastPlayState,
      isJamHost: jamSync.isJamHost,

      jamSession: jamSync.jamSession,
      setJamSync: jamSync.setJamSync,
      remoteDevicePlayback: jamSync.remoteDevicePlayback,
    };
  }, [
    playback,
    queue,
    isOffline,
    downloads,
    dj,
    startSleepTimer,
    cancelSleepTimer,
    previewDjTransitionCallback,
    registerFullPlayerHandler,
    openFullPlayer,
    jamSync,
    lyricsState,
  ]);

  return (
    <AudioContext.Provider value={controls}>
      <AudioProgressProvider>
        <SleepTimerProvider onStopPlayback={stopPlaybackForSleepTimer}>
          {children}
        </SleepTimerProvider>
      </AudioProgressProvider>
    </AudioContext.Provider>
  );
};

export const useAudioPlayer = () => useContext(AudioContext);
export { useAudioProgress } from './AudioProgressContext';
export { useSleepTimer } from './SleepTimerContext';
