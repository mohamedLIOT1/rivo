import { useState, useRef, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { API_BASE_URL } from '../../config';
import { resolveAudioStream } from '../../services/youtubeResolver';
import { isQuranContent } from '../../../utils/quranUtils';
import { flushListeningStats } from './audioApiHelpers';

export const useDjCrossfade = ({
  currentTrackRef,
  queueRef,
  soundRef,
  volumeRef,
  isPlayingRef,
  isLoadingRef,
  shouldBePlayingRef,
  loadedTrackIdRef,
  downloadedTracksRef,
  isOfflineRef,
  isVocalOnlyRef,
  setCurrentTrack,
  setIsPlaying,
  setIsLoading,
  onPlaybackStatusUpdate,
  playNextTrackCallbackRef,
  updateMediaNotificationCallback,
  likedTrackIds = [],
  repeatModeRef,
  isShuffleRef,
  autoPersistFinishedTrack,
  handleDownloadTrack,
  autoDownloadFinishedRef,
  trackCompletionHandledRef,
}) => {
  const [isMixMode, setIsMixModeState] = useState(false);
  const isMixModeRef = useRef(false);

  const [mixDuration, setMixDurationState] = useState(6);
  const mixDurationRef = useRef(6);

  const [mixStyle, setMixStyleState] = useState('equal_power');
  const mixStyleRef = useRef('equal_power');

  const nextSoundRef = useRef(null);
  const nextTrackRef = useRef(null);
  const nextSoundPlayingRef = useRef(false);
  const nextSoundRateRef = useRef(1.0);
  const speedEaseTimersRef = useRef([]);
  const isMixPreloadingRef = useRef(false);
  const isMixTransitioningRef = useRef(false);
  const isHandoffRunningRef = useRef(false);
  const lastMixBridgeUpdateRef = useRef({ time: 0, volA: -1, volB: -1, speedA: 1.0 });

  const clearSpeedEaseTimers = useCallback(() => {
    if (speedEaseTimersRef.current.length > 0) {
      speedEaseTimersRef.current.forEach((id) => clearTimeout(id));
      speedEaseTimersRef.current = [];
    }
  }, []);

  useEffect(() => {
    return () => {
      clearSpeedEaseTimers();
    };
  }, [clearSpeedEaseTimers]);

  const [activeTransitions, setActiveTransitions] = useState({});
  const activeTransRef = useRef({});

  useEffect(() => {
    activeTransRef.current = activeTransitions;
  }, [activeTransitions]);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem('@rivo_mix_mode'),
      AsyncStorage.getItem('@rivo_crossfade_duration'),
      AsyncStorage.getItem('@rivo_mix_style'),
      AsyncStorage.getItem('@rivo_active_transitions'),
    ]).then(([mixVal, durVal, styleVal, transVal]) => {
      if (mixVal !== null) {
        const b = mixVal === 'true';
        isMixModeRef.current = b;
        setIsMixModeState(b);
      }
      if (durVal !== null) {
        const d = Number(durVal);
        if (!isNaN(d)) {
          mixDurationRef.current = d;
          setMixDurationState(d);
        }
      }
      if (styleVal) {
        mixStyleRef.current = styleVal;
        setMixStyleState(styleVal);
      }
      if (transVal) {
        try {
          const parsed = JSON.parse(transVal);
          if (parsed && typeof parsed === 'object') {
            activeTransRef.current = parsed;
            setActiveTransitions(parsed);
          }
        } catch {}
      }
    }).catch(() => {});
  }, []);

  const updateActiveTransitions = useCallback((transitionsOrFn) => {
    setActiveTransitions((prev) => {
      const next = typeof transitionsOrFn === 'function' ? transitionsOrFn(prev) : transitionsOrFn;
      const safe = next && typeof next === 'object' ? next : {};
      activeTransRef.current = safe;
      try {
        AsyncStorage.setItem('@rivo_active_transitions', JSON.stringify(safe)).catch(() => {});
      } catch {}
      return safe;
    });
  }, []);

  const setIsMixMode = useCallback((val) => {
    const b = Boolean(val);
    isMixModeRef.current = b;
    setIsMixModeState(b);
    AsyncStorage.setItem('@rivo_mix_mode', String(b)).catch(() => {});
    if (!b && nextSoundRef.current) {
      try { nextSoundRef.current.unloadAsync().catch(() => {}); } catch {}
      nextSoundRef.current = null;
      nextTrackRef.current = null;
      nextSoundPlayingRef.current = false;
    }
  }, []);

  const setMixDuration = useCallback((sec) => {
    const num = Math.max(0, Math.min(12, Number(sec) || 0));
    mixDurationRef.current = num;
    setMixDurationState(num);
    AsyncStorage.setItem('@rivo_crossfade_duration', String(num)).catch(() => {});
    if (num === 0) {
      isMixModeRef.current = false;
      setIsMixModeState(false);
      AsyncStorage.setItem('@rivo_mix_mode', 'false').catch(() => {});
      if (nextSoundRef.current) {
        try { nextSoundRef.current.unloadAsync().catch(() => {}); } catch {}
        nextSoundRef.current = null;
        nextTrackRef.current = null;
        nextSoundPlayingRef.current = false;
      }
    } else {
      isMixModeRef.current = true;
      setIsMixModeState(true);
      AsyncStorage.setItem('@rivo_mix_mode', 'true').catch(() => {});
    }
  }, []);

  const setMixStyle = useCallback((style) => {
    mixStyleRef.current = style;
    setMixStyleState(style);
    AsyncStorage.setItem('@rivo_mix_style', style).catch(() => {});
  }, []);

  const preloadNextTrackForDjMix = useCallback(async (inPointSec = 0, speedB = 1.0) => {
    if (isMixPreloadingRef.current || nextSoundRef.current || !isMixModeRef.current) return;
    const cur = currentTrackRef.current;
    if (isQuranContent(cur)) return;
    const q = queueRef.current;
    if (!q || q.length <= 1) return;

    const curId = String(cur?._id || cur?.id || '');
    const curIdx = q.findIndex(t => String(t._id || t.id) === curId);
    const nextIdx = (curIdx >= 0) ? (curIdx + 1) % q.length : 0;
    const nTrack = q[nextIdx];
    if (!nTrack || isQuranContent(nTrack)) return;

    isMixPreloadingRef.current = true;
    try {
      const nId = String(nTrack._id || nTrack.id || '');
      const local = (downloadedTracksRef.current || []).find(t => String(t._id || t.id) === nId);
      let nextUri = local?.nativeAudioUri || local?.localAudioUri || local?.audioUrl || nTrack.nativeAudioUri || nTrack.localAudioUri;

      if (!nextUri && !isOfflineRef.current) {
        if (nTrack.resolvedAudioUrl && nTrack.resolvedAudioUrl.startsWith('http')) {
          nextUri = nTrack.resolvedAudioUrl;
        } else {
          nextUri = await resolveAudioStream(nTrack, isVocalOnlyRef.current).catch(() => null);
        }
      }

      if (!nextUri) {
        isMixPreloadingRef.current = false;
        return;
      }
      if (nextUri.startsWith('/')) nextUri = `${API_BASE_URL}${nextUri}`;

      const safeRate = Math.max(0.5, Math.min(2.0, Number(speedB) || 1.0));
      const soundSource = { uri: nextUri };
      const { sound } = await Audio.Sound.createAsync(
        soundSource,
        {
          shouldPlay: false,
          positionMillis: Math.max(0, Math.floor(inPointSec * 1000)),
          rate: safeRate,
          shouldCorrectPitch: true,
          volume: 0,
          progressUpdateIntervalMillis: 250,
        }
      );
      nextSoundRef.current = sound;
      nextTrackRef.current = nTrack;
      nextSoundPlayingRef.current = false;
      nextSoundRateRef.current = safeRate;
      lastMixBridgeUpdateRef.current = { time: 0, volA: -1, volB: -1, speedA: safeRate };
    } catch (err) {
      if (nextSoundRef.current) {
        try { nextSoundRef.current.unloadAsync().catch(() => {}); } catch {}
        nextSoundRef.current = null;
        nextTrackRef.current = null;
      }
    } finally {
      isMixPreloadingRef.current = false;
    }
  }, [currentTrackRef, queueRef, downloadedTracksRef, isOfflineRef, isVocalOnlyRef]);

  const completeSeamlessHandoff = useCallback(async () => {
    if (isHandoffRunningRef.current) return;
    isHandoffRunningRef.current = true;

    try {
      if (nextSoundRef.current && nextTrackRef.current) {
        const prevSound = soundRef.current;
        const prevTrack = currentTrackRef.current;
        const newActiveSound = nextSoundRef.current;
        const newActiveTrack = nextTrackRef.current;
        const newActiveId = String(newActiveTrack._id || newActiveTrack.id || '');

        if (prevTrack) {
          const finishedTrack = {
            ...prevTrack,
            resolvedAudioUrl: prevTrack.resolvedAudioUrl || prevSound?._uri || null,
          };
          autoPersistFinishedTrack?.(finishedTrack);
          flushListeningStats?.(null, true);
          const isAutoDownload = autoDownloadFinishedRef?.current ?? true;
          if (isAutoDownload && handleDownloadTrack) {
            handleDownloadTrack(finishedTrack, true);
          }
        }

        if (prevSound) {
          try { prevSound.setOnPlaybackStatusUpdate(null); } catch {}
          prevSound.setVolumeAsync(0).catch(() => {});
          setTimeout(() => {
            try {
              prevSound.stopAsync().catch(() => {});
              prevSound.unloadAsync().catch(() => {});
            } catch {}
          }, 480);
        }

        soundRef.current = newActiveSound;
        nextSoundRef.current = null;
        nextTrackRef.current = null;
        nextSoundPlayingRef.current = false;
        const startRate = Number(nextSoundRateRef.current) || 1.0;
        nextSoundRateRef.current = 1.0;
        lastMixBridgeUpdateRef.current = { time: 0, volA: -1, volB: -1, speedA: startRate };
        loadedTrackIdRef.current = newActiveId;
        if (trackCompletionHandledRef) {
          trackCompletionHandledRef.current = newActiveId;
        }
        currentTrackRef.current = newActiveTrack;
        setCurrentTrack(newActiveTrack);

        shouldBePlayingRef.current = true;
        isPlayingRef.current = true;
        setIsPlaying(true);
        isLoadingRef.current = false;
        setIsLoading(false);

        newActiveSound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
        const targetVol = volumeRef.current !== undefined ? volumeRef.current : 0.8;
        newActiveSound.setVolumeAsync(targetVol).catch(() => {});

        // Smoothly glide playback rate back toward 1.0 over ~1.8s instead of abrupt speed/pitch snap
        clearSpeedEaseTimers();
        if (Math.abs(startRate - 1.0) > 0.01) {
          const easeSteps = 4;
          for (let s = 1; s <= easeSteps; s++) {
            const frac = s / easeSteps;
            const easedRate = Number((startRate + (1.0 - startRate) * frac).toFixed(3));
            const tid = setTimeout(() => {
              if (soundRef.current === newActiveSound) {
                try { newActiveSound.setRateAsync(easedRate, true).catch(() => {}); } catch {}
              }
            }, s * 450);
            speedEaseTimersRef.current.push(tid);
          }
        }

        const isLiked = likedTrackIds.some(id => String(id) === newActiveId);
        if (updateMediaNotificationCallback) {
          updateMediaNotificationCallback(true, repeatModeRef.current, isShuffleRef.current, isLiked, newActiveTrack);
        }
      } else if (playNextTrackCallbackRef.current) {
        playNextTrackCallbackRef.current();
      }
    } catch (err) {
      if (playNextTrackCallbackRef.current) {
        playNextTrackCallbackRef.current();
      }
    } finally {
      setTimeout(() => {
        isHandoffRunningRef.current = false;
        isMixTransitioningRef.current = false;
      }, 500);
    }
  }, [
    soundRef, loadedTrackIdRef, currentTrackRef, setCurrentTrack,
    shouldBePlayingRef, isPlayingRef, setIsPlaying, isLoadingRef, setIsLoading,
    onPlaybackStatusUpdate, volumeRef, likedTrackIds, updateMediaNotificationCallback,
    repeatModeRef, isShuffleRef, playNextTrackCallbackRef,
    autoPersistFinishedTrack, handleDownloadTrack, autoDownloadFinishedRef
  ]);

  const triggerManualMix = useCallback(async () => {
    if (!isPlayingRef.current || !soundRef.current) {
      if (playNextTrackCallbackRef.current) playNextTrackCallbackRef.current();
      return;
    }
    if (!nextSoundRef.current) {
      await preloadNextTrackForDjMix();
    }
    const masterVol = volumeRef.current || 0.8;
    const steps = 8;
    const stepMs = 120;

    if (nextSoundRef.current) {
      nextSoundPlayingRef.current = true;
      await nextSoundRef.current.setVolumeAsync(0.01).catch(() => {});
      await nextSoundRef.current.playAsync().catch(() => {});
    }

    for (let i = 1; i <= steps; i++) {
      const p = i / steps;
      let factorA = Math.cos((p * Math.PI) / 2);
      let factorB = Math.sin((p * Math.PI) / 2);
      const style = mixStyleRef.current || 'auto';
      if (style === 'rise') {
        factorA = Math.pow(1 - p, 2);
        factorB = Math.pow(p, 0.5);
      } else if (style === 'blend' || style === 'bass_cut') {
        factorA = Math.pow(1 - p, 1.5);
        factorB = Math.pow(p, 0.7);
      } else if (style === 'cut') {
        factorA = p >= 0.5 ? 0 : 1;
        factorB = p >= 0.5 ? 1 : 0;
      }
      if (soundRef.current) soundRef.current.setVolumeAsync(Math.max(0.01, masterVol * factorA)).catch(() => {});
      if (nextSoundRef.current) nextSoundRef.current.setVolumeAsync(Math.max(0.01, masterVol * factorB)).catch(() => {});
      await new Promise(r => setTimeout(r, stepMs));
    }

    await completeSeamlessHandoff();
  }, [
    isPlayingRef, soundRef, playNextTrackCallbackRef, preloadNextTrackForDjMix,
    volumeRef, completeSeamlessHandoff
  ]);

  const previewDjTransition = useCallback(async (tA, tB, transConfig = null, seekTo = null, playTrack = null) => {
    if (!tA || !tB) return;
    const tAId = String(tA._id || tA.id || '');
    const tBId = String(tB._id || tB.id || '');
    const pairKey = `${tAId}___${tBId}`;
    const dur = Math.max(3, Math.min(12, Number(transConfig?.duration) || mixDurationRef.current || 6));
    const mixInPoint = Math.max(0, Number(transConfig?.mixInPoint) || 0);
    const speedB = Number(transConfig?.speedB) || 1.0;

    const configToSave = {
      ...transConfig,
      duration: dur,
      mixInPoint,
      speedB
    };

    updateActiveTransitions(prev => ({
      ...prev,
      [pairKey]: configToSave,
      [`${tAId}_${tBId}`]: configToSave
    }));

    setIsMixMode(true);

    // Preload tB immediately
    await preloadNextTrackForDjMix(mixInPoint, speedB);

    // Seek tA to near its end (transition audition cue-in)
    const tADur = Number(tA.duration) || 180;
    const seekPoint = Math.max(0, tADur - dur - 3);

    const curId = String(currentTrackRef.current?._id || currentTrackRef.current?.id || '');
    if (curId === tAId && typeof seekTo === 'function') {
      seekTo(seekPoint);
    } else if (typeof playTrack === 'function') {
      playTrack(tA, [tA, tB], false, seekPoint);
    }
  }, [mixDurationRef, updateActiveTransitions, setIsMixMode, preloadNextTrackForDjMix, currentTrackRef]);

  return {
    isMixMode,
    isMixModeRef,
    setIsMixMode,
    mixDuration,
    mixDurationRef,
    setMixDuration,
    mixStyle,
    mixStyleRef,
    setMixStyle,
    activeTransitions,
    activeTransRef,
    updateActiveTransitions,
    nextSoundRef,
    nextTrackRef,
    nextSoundPlayingRef,
    isMixPreloadingRef,
    isMixTransitioningRef,
    isHandoffRunningRef,
    lastMixBridgeUpdateRef,
    preloadNextTrackForDjMix,
    completeSeamlessHandoff,
    triggerManualMix,
    previewDjTransition,
  };
};
