import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AppState, Platform } from 'react-native';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { INITIAL_TRACKS } from '../data/initialTracks';
import {
  downloadTrack,
  getDownloadedTracks,
  removeDownloadedTrack as rawRemoveDownloadedTrack,
  removeDownloadedTracksBatch as rawRemoveDownloadedTracksBatch,
  isTrackDownloaded,
  deduplicateTrackList,
  subscribeToDownloadedTracks,
  updateDownloadedTrackLyrics,
  getTrackDedupeKey,
} from '../services/downloadManager';
import { resolveAudioStream, getStreamDurationFromCache } from '../services/youtubeResolver';
import { showMediaNotification, updateMediaNotification, hideMediaNotification, subscribeToMediaActions } from '../services/mediaControls';
import { useConnectivity } from './ConnectivityContext';
import { useToast } from './ToastContext';
import { useUser } from './UserContext';
import { parseLrcLyrics } from '../../utils/lrcParser';
import { getSmartTasteAndMoodTracks } from '../utils/tasteAlgorithm';
import { isQuranContent, isRadioTrack } from '../../utils/quranUtils';
import { QURAN_LIVE_STATIONS } from '../data/quranLiveStations';
import { calculateCrossfadeGains } from '../utils/musicAnalysis';

const AudioContext = createContext();
const AudioProgressContext = createContext();

const TEMP_PLAY_DIR = `${FileSystem.cacheDirectory}rivo_play/`;

export const AudioProvider = ({ children }) => {
  const soundRef = useRef(null);
  const isResolvingRef = useRef(false);
  const playbackStatusRef = useRef({ currentTime: 0, duration: 0, lastRequestTs: 0 });
  const queueRef = useRef([]);
  const currentTrackRef = useRef(null);
  const sleepTimerRef = useRef(null);
  const isPlayingRef = useRef(false);
  const isShuffleRef = useRef(false);
  const repeatModeRef = useRef('off');
  const togglePlayRef = useRef(null);
  const playNextTrackRef = useRef(null);
  const playPrevTrackRef = useRef(null);
  const seekToRef = useRef(null);
  const historyStackRef = useRef([]);
  const isHistoryNavRef = useRef(false);
  const isSeekingRef = useRef(false);
  const isSmartMoodQueueRef = useRef(false);
  const playedSmartSongIdsRef = useRef(new Set());
  const playedInQueueCycleRef = useRef(new Set());
  const shouldBePlayingRef = useRef(false);
  const loadedTrackIdRef = useRef(null);
  const isLoadingRef = useRef(false);
  const playRequestSeqRef = useRef(0);
  const soundLoadIdRef = useRef(0);
  const playAbortControllerRef = useRef(null);
  const lastRemoteSeekRef = useRef(0);
  const lastSyncPayloadRef = useRef({ time: 0, trackId: '', timestamp: 0 });
  const lastSeekTimestampRef = useRef(0);
  const nextSoundRef = useRef(null);
  const nextTrackRef = useRef(null);
  const isMixPreloadingRef = useRef(false);
  const isMixTransitioningRef = useRef(false);

  const { showToast } = useToast();
  const conn = useConnectivity();
  const isOffline = conn?.appMode === 'offline';

  let userCtx = {};
  try {
    userCtx = useUser() || {};
  } catch {}
  const { token, currentUser, likedTrackIds = [], toggleLikeTrack, tracks: userTracks = [] } = userCtx;

  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // Global Full Player Modal trigger registry
  const fullPlayerHandlerRef = useRef(null);
  const registerFullPlayerHandler = useCallback((fn) => {
    fullPlayerHandlerRef.current = fn;
  }, []);
  const openFullPlayer = useCallback(() => {
    if (typeof fullPlayerHandlerRef.current === 'function') {
      fullPlayerHandlerRef.current();
    }
  }, []);

  // Auto-persist finished external song to server database so it appears in search
  const autoPersistFinishedTrack = useCallback(async (track) => {
    if (!track || !track.title) return;
    const tid = String(track._id || track.id || '');
    const isMongoId = /^[a-f0-9]{24}$/i.test(tid);
    if (isMongoId && track.source === 'Rivo' && !track.isExternal) return;

    try {
      await fetch(`${API_BASE_URL}/api/tracks/auto-persist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: tid,
          title: track.title,
          artist: track.artist,
          album: track.album,
          cover: track.cover || track.coverUrl,
          audioUrl: track.audioUrl || track.streamUrl,
          duration: track.duration,
          youtubeId: track.youtubeId,
          source: track.source || 'YouTube'
        })
      });
    } catch (err) {
      // Non-blocking background sync
    }
  }, []);

  const broadcastListeningActivity = useCallback((track, playingState, posSeconds = 0) => {
    const activeToken = tokenRef.current;
    if (!activeToken) return;

    const payload = {
      track: track ? {
        id: track._id || track.id,
        title: track.title,
        artist: track.artist,
        cover: track.coverUrl || track.cover,
        audioUrl: track.audioUrl,
        duration: track.duration,
      } : null,
      isPlaying: Boolean(playingState),
      currentTime: Math.max(0, Number(posSeconds) || 0)
    };

    fetch(`${API_BASE_URL}/api/users/listening-activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${activeToken}`
      },
      body: JSON.stringify(payload)
    }).catch(() => {});
  }, []);

  const [currentTrack, setCurrentTrackState] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off' | 'all' | 'one'
  const [isOfflineMode, setIsOfflineMode] = useState(isOffline);
  const [downloadedTracks, setDownloadedTracks] = useState([]);
  const [downloadingIds, setDownloadingIds] = useState({});
  const [autoDownloadFinished, setAutoDownloadFinished] = useState(true);
  const autoDownloadFinishedRef = useRef(true);
  autoDownloadFinishedRef.current = autoDownloadFinished;
  const downloadedTracksRef = useRef([]);
  downloadedTracksRef.current = downloadedTracks;
  const downloadingIdsRef = useRef({});
  downloadingIdsRef.current = downloadingIds;
  const isOfflineRef = useRef(isOffline);
  isOfflineRef.current = isOffline;
  const [queue, setQueueState] = useState([]);
  const [progress, setProgress] = useState({ currentTime: 0, duration: 0 });
  const progressRef = useRef({ currentTime: 0, duration: 0 });
  const [volume, setVolumeState] = useState(0.8);
  const volumeRef = useRef(0.8);
  // ── Vocal-Only Mode State (AI Stem Isolation) ──
  const [isVocalOnly, setIsVocalOnlyState] = useState(false);
  const [vocalIsolationStatus, setVocalIsolationStatus] = useState(null);
  const updateVocalStatus = (status) => {
    setVocalIsolationStatus(status);
  };
  const isVocalOnlyRef = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem('@rivo_vocal_only').then((val) => {
      if (val !== null) {
        const b = val === 'true';
        isVocalOnlyRef.current = b;
        setIsVocalOnlyState(b);
      }
    }).catch(() => {});
  }, []);

  const setIsVocalOnly = (val) => {
    const b = Boolean(val);
    isVocalOnlyRef.current = b;
    setIsVocalOnlyState(b);
    AsyncStorage.setItem('@rivo_vocal_only', String(b)).catch(() => {});

    // Seamless runtime switch for active track when user toggles vocal isolation
    const activeTrack = currentTrackRef.current;
    if (activeTrack && !isQuranContent(activeTrack) && (isPlayingRef.current || soundRef.current)) {
      const curPos = (playbackStatusRef.current.positionMillis || 0) / 1000;
      playTrack(activeTrack, false, false, curPos);
    }
  };

  const toggleVocalOnly = () => {
    setIsVocalOnly(!isVocalOnlyRef.current);
  };



  // ── DJ Mix Mode & Crossfade State (Rivo-style 0-12s) ──
  const [isMixMode, setIsMixModeState] = useState(true);
  const isMixModeRef = useRef(true);
  const [mixDuration, setMixDurationState] = useState(6);
  const mixDurationRef = useRef(6);
  const [mixStyle, setMixStyleState] = useState('equal_power');
  const mixStyleRef = useRef('equal_power');
  const nextSoundPlayingRef = useRef(false);
  const [activeTransitions, setActiveTransitions] = useState({});
  const activeTransRef = useRef({});
  useEffect(() => {
    activeTransRef.current = activeTransitions;
  }, [activeTransitions]);

  useEffect(() => {
    AsyncStorage.getItem('@rivo_mix_mode').then((val) => {
      if (val !== null) {
        const b = val === 'true';
        isMixModeRef.current = b;
        setIsMixModeState(b);
      }
    }).catch(() => {});
    AsyncStorage.getItem('@rivo_crossfade_duration').then((val) => {
      if (val !== null) {
        const num = Number(val);
        if (!isNaN(num)) {
          mixDurationRef.current = num;
          setMixDurationState(num);
          if (num === 0) {
            isMixModeRef.current = false;
            setIsMixModeState(false);
          }
        }
      }
    }).catch(() => {});
    AsyncStorage.getItem('@rivo_mix_style').then((val) => {
      if (val) {
        mixStyleRef.current = val;
        setMixStyleState(val);
      }
    }).catch(() => {});
  }, []);

  const setIsMixMode = (val) => {
    const b = Boolean(val);
    isMixModeRef.current = b;
    setIsMixModeState(b);
    AsyncStorage.setItem('@rivo_mix_mode', String(b)).catch(() => {});
    if (!b) {
      if (nextSoundRef.current) {
        try { nextSoundRef.current.unloadAsync().catch(() => {}); } catch {}
        nextSoundRef.current = null;
        nextTrackRef.current = null;
        nextSoundPlayingRef.current = false;
      }
    }
  };

  const setMixDuration = (sec) => {
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
  };

  const setMixStyle = (style) => {
    mixStyleRef.current = style;
    setMixStyleState(style);
    AsyncStorage.setItem('@rivo_mix_style', style).catch(() => {});
  };

  const preloadNextTrackForDjMix = async (inPointSec = 0, speedB = 1.0) => {
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

      const soundSource = { uri: nextUri };
      const { sound, status } = await Audio.Sound.createAsync(
        soundSource,
        {
          shouldPlay: false,
          positionMillis: Math.max(0, Math.floor(inPointSec * 1000)),
          rate: Number(speedB) || 1.0,
          shouldCorrectPitch: true,
          volume: 0,
          progressUpdateIntervalMillis: 250,
        }
      );
      nextSoundRef.current = sound;
      nextTrackRef.current = nTrack;
      nextSoundPlayingRef.current = false;
      console.log(`[RivoDJ] ✅ Successfully cued "${nTrack.title}" for seamless crossfade`);
    } catch (err) {
      console.warn('[RivoDJ] Preload next track notice:', err?.message);
      if (nextSoundRef.current) {
        try { nextSoundRef.current.unloadAsync().catch(() => {}); } catch {}
        nextSoundRef.current = null;
        nextTrackRef.current = null;
      }
    } finally {
      isMixPreloadingRef.current = false;
    }
  };

  const triggerManualMix = async () => {
    if (!isPlayingRef.current || !soundRef.current) {
      if (playNextTrackRef.current) playNextTrackRef.current();
      return;
    }
    if (!nextSoundRef.current) {
      await preloadNextTrackForDjMix();
    }
    const masterVol = volumeRef.current || 0.8;
    const steps = 8;
    const stepMs = 120;

    // Start playing nextSound immediately before fading in
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

    if (nextSoundRef.current && nextTrackRef.current) {
      const prevSound = soundRef.current;
      const newActiveSound = nextSoundRef.current;
      const newActiveTrack = nextTrackRef.current;
      const newActiveId = String(newActiveTrack._id || newActiveTrack.id || '');

      if (prevSound) {
        try { prevSound.setOnPlaybackStatusUpdate(null); } catch {}
        prevSound.stopAsync().catch(() => {});
        prevSound.unloadAsync().catch(() => {});
      }

      soundRef.current = newActiveSound;
      nextSoundRef.current = null;
      nextTrackRef.current = null;
      nextSoundPlayingRef.current = false;
      loadedTrackIdRef.current = newActiveId;
      currentTrackRef.current = newActiveTrack;
        setCurrentTrack(newActiveTrack);
        try {
          newActiveSound.setRateAsync(1.0, true).catch(() => {});
          newActiveSound.setVolumeAsync(volumeRef.current || 0.8).catch(() => {});
        } catch {}

      shouldBePlayingRef.current = true;
      isPlayingRef.current = true;
      setIsPlaying(true);
      isLoadingRef.current = false;
      setIsLoading(false);

      newActiveSound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
      await newActiveSound.setVolumeAsync(masterVol).catch(() => {});
      await newActiveSound.playAsync().catch(() => {}); // GUARANTEES next song plays continuously

      const isLiked = likedTrackIds.some(id => String(id) === newActiveId);
      updateMediaNotification(true, repeatModeRef.current, isShuffleRef.current, isLiked, newActiveTrack);
    } else if (playNextTrackRef.current) {
      playNextTrackRef.current();
    }
  };

  const jamSyncRef = useRef({ socket: null, jamSession: null });
  const [jamSession, setJamSessionState] = useState(null);
  const [remoteDevicePlayback, setRemoteDevicePlayback] = useState(null);

  const isJamHost = useCallback(() => {
    const session = jamSyncRef.current?.jamSession;
    if (!session) return false;
    if (jamSyncRef.current.isHost) return true;
    const sock = jamSyncRef.current?.socket;
    const sockId = sock?.id;
    const myId = String(currentUser?._id || currentUser?.id || '');

    if (session.hostUserId && myId && String(session.hostUserId) === myId) return true;
    if (sockId && session.hostId && session.hostId === sockId) return true;
    if (Array.isArray(session.members)) {
      const me = session.members.find(m => (sockId && m.socketId === sockId) || (myId && String(m.id || m._id) === myId));
      if (me && me.isHost) return true;
    }
    return false;
  }, [currentUser]);

  const canControlJam = useCallback(() => {
    const session = jamSyncRef.current?.jamSession;
    if (!session) return false;
    if (isJamHost()) return true;
    return !session.hostOnlyControl;
  }, [isJamHost]);

  const setJamSync = useCallback(({ socket, jamSession: newJamSession, isHost }) => {
    if (socket !== undefined) {
      if (jamSyncRef.current.socket && jamSyncRef.current.socket !== socket) {
        jamSyncRef.current.socket.off('jam:get_host_time');
        jamSyncRef.current.socket.off('device:remote_playing');
      }
      jamSyncRef.current.socket = socket;
      if (socket) {
        socket.off('jam:get_host_time');
        socket.on('jam:get_host_time', ({ requesterSocketId }) => {
          if (isJamHost()) {
            socket.emit('jam:report_host_time', {
              roomCode: jamSyncRef.current.jamSession?.code || jamSyncRef.current.jamSession?.roomCode,
              currentTime: playbackStatusRef.current?.currentTime || 0,
              isPlaying: isPlayingRef.current,
              currentTrack: currentTrackRef.current,
              requesterSocketId
            });
          }
        });

        // Cross-device connect sync (Rivo Connect: Auto-pause this device if other device plays)
        socket.off('device:force_pause');
        socket.on('device:force_pause', async () => {
          shouldBePlayingRef.current = false;
          if (soundRef.current) {
            await soundRef.current.pauseAsync().catch(() => {});
          }
          setIsPlaying(false);
          isPlayingRef.current = false;
          const curPos = playbackStatusRef.current?.currentTime || 0;
          const curDur = playbackStatusRef.current?.duration || Number(currentTrackRef.current?.duration || 240);
          updateMediaNotification(false, repeatModeRef.current, isShuffleRef.current, false, {
            ...(currentTrackRef.current || {}),
            currentTime: curPos,
            duration: curDur,
          });
        });

        socket.off('device:remote_playing');
        socket.on('device:remote_playing', async (remoteSession) => {
          if (remoteSession && remoteSession.track) {
            setRemoteDevicePlayback(remoteSession);
            // If the other device is playing and THIS mobile device is currently playing: PAUSE THIS DEVICE!
            if (remoteSession.isPlaying && isPlayingRef.current) {
              shouldBePlayingRef.current = false;
              if (soundRef.current) {
                await soundRef.current.pauseAsync().catch(() => {});
              }
              setIsPlaying(false);
              isPlayingRef.current = false;
              const curPos = playbackStatusRef.current?.currentTime || 0;
              const curDur = playbackStatusRef.current?.duration || Number(currentTrackRef.current?.duration || 240);
              updateMediaNotification(false, repeatModeRef.current, isShuffleRef.current, false, {
                ...(currentTrackRef.current || {}),
                currentTime: curPos,
                duration: curDur,
              });
            }
          } else {
            setRemoteDevicePlayback(null);
          }
        });
      }
    }
    if (newJamSession !== undefined) {
      jamSyncRef.current.jamSession = newJamSession;
      setJamSessionState(newJamSession);
    }
    if (isHost !== undefined) {
      jamSyncRef.current.isHost = Boolean(isHost);
    }
  }, [isJamHost]);

  // Automatic periodic drift correction for Jam sessions (guests only)
  useEffect(() => {
    const interval = setInterval(() => {
      const session = jamSyncRef.current.jamSession;
      if (!session || !session.isPlaying || !isPlayingRef.current || !soundRef.current || isSeekingRef.current) return;
      if (isJamHost()) return; // Host is master clock, never drift-correct against self

      let expectedTime = Number(session.currentTime) || 0;
      if (session.updatedAt) {
        const elapsed = (Date.now() - session.updatedAt) / 1000;
        if (elapsed > 0 && elapsed < 3600) expectedTime += elapsed;
      }

      const localTime = playbackStatusRef.current?.currentTime || 0;
      const nowTime = Date.now();
      // Only correct if drift is severe. In the first 15s of the track, do not hard seek unless drift > 8s
      // to give slower devices enough time to buffer naturally without rubber-banding!
      const drift = Math.abs(expectedTime - localTime);
      const isStartPhase = expectedTime < 15 || localTime < 15;
      const driftThreshold = isStartPhase ? 8.0 : 3.5;

      if (drift > driftThreshold && (nowTime - (lastRemoteSeekRef.current || 0) > 4500) && soundRef.current) {
        lastRemoteSeekRef.current = nowTime;
        soundRef.current.setPositionAsync(Math.round(expectedTime * 1000)).catch(() => {});
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isJamHost]);

  useEffect(() => {
    AsyncStorage.getItem('@rivo_auto_download_finished').then((val) => {
      if (val !== null) {
        setAutoDownloadFinished(val === 'true' || val === true);
      }
    }).catch(() => {});
  }, []);

  const toggleAutoDownloadFinished = async (val) => {
    const nextVal = typeof val === 'boolean' ? val : !autoDownloadFinished;
    setAutoDownloadFinished(nextVal);
    await AsyncStorage.setItem('@rivo_auto_download_finished', String(nextVal)).catch(() => {});
  };

  const setVolume = async (val) => {
    const clamped = Math.max(0, Math.min(1, Number(val) || 0));
    volumeRef.current = clamped;
    setVolumeState(clamped);
    if (soundRef.current) {
      try {
        await soundRef.current.setVolumeAsync(clamped);
      } catch {}
    }
  };

  // Sleep Timer
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(null);

  // Lyrics
  const [lyrics, setLyrics] = useState('');
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);

  useEffect(() => {
    setIsOfflineMode(isOffline);
  }, [isOffline]);

  const setCurrentTrack = (track) => {
    currentTrackRef.current = track;
    setCurrentTrackState(track);
  };

  const setQueue = (newQueue) => {
    queueRef.current = Array.isArray(newQueue) ? newQueue : [];
    setQueueState(queueRef.current);
  };

  const addToQueue = (track) => {
    if (!track) return;
    const newQ = [...queueRef.current, track];
    setQueue(newQ);
    showToast(`Added to queue: ${track.title}`, 'info');
  };

  const addMultipleToQueue = (tracksToAdd) => {
    if (!Array.isArray(tracksToAdd) || tracksToAdd.length === 0) return;
    const newQ = [...queueRef.current, ...tracksToAdd];
    setQueue(newQ);
    showToast(`Added ${tracksToAdd.length} track(s) to queue`, 'info');
  };

  const removeFromQueue = useCallback((trackIdOrIdx) => {
    if (typeof trackIdOrIdx === 'number') {
      const newQ = [...queueRef.current];
      newQ.splice(trackIdOrIdx, 1);
      setQueue(newQ);
      return;
    }
    const newQ = queueRef.current.filter(t => String(t._id || t.id) !== String(trackIdOrIdx));
    setQueue(newQ);
  }, []);

  const reorderQueue = useCallback((fromIdx, toIdx) => {
    if (fromIdx < 0 || toIdx < 0 || fromIdx >= queueRef.current.length || toIdx >= queueRef.current.length) return;
    const newQ = [...queueRef.current];
    const [moved] = newQ.splice(fromIdx, 1);
    newQ.splice(toIdx, 0, moved);
    setQueue(newQ);
  }, []);

  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  const toggleShuffle = () => {
    setIsShuffle(prev => {
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
  };

  const startSleepTimer = (minutes) => {
    if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
    if (!minutes || minutes <= 0) {
      setSleepTimerRemaining(null);
      return;
    }
    let remaining = Math.round(minutes * 60);
    setSleepTimerRemaining(remaining);
    showToast(`Sleep timer set: ${minutes} min`, 'info');

    sleepTimerRef.current = setInterval(() => {
      remaining -= 1;
      setSleepTimerRemaining(remaining);
      if (remaining <= 0) {
        clearInterval(sleepTimerRef.current);
        sleepTimerRef.current = null;
        setSleepTimerRemaining(null);
        shouldBePlayingRef.current = false;
        isPlayingRef.current = false;
        setIsPlaying(false);
        if (soundRef.current) {
          soundRef.current.pauseAsync().catch(() => {});
        }
        const curPos = playbackStatusRef.current?.currentTime || 0;
        const curDur = playbackStatusRef.current?.duration || Number(currentTrackRef.current?.duration || 240);
        updateMediaNotification(false, repeatMode !== 'off', isShuffle, {
          ...(currentTrackRef.current || {}),
          currentTime: curPos,
          duration: curDur,
        });
        showToast('Playback stopped by sleep timer', 'info');
      }
    }, 1000);
  };

  const cancelSleepTimer = () => {
    if (sleepTimerRef.current) {
      clearInterval(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    setSleepTimerRemaining(null);
    showToast('Sleep timer cancelled', 'info');
  };

  useEffect(() => {
    const setup = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          playThroughEarpieceAndroid: false,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        });
      } catch {}
    };
    setup();
    refreshDownloadedTracks();

    FileSystem.deleteAsync(TEMP_PLAY_DIR, { idempotent: true })
      .then(() => FileSystem.makeDirectoryAsync(TEMP_PLAY_DIR, { intermediates: true }))
      .catch(() => {});

    return () => {
      if (soundRef.current) soundRef.current.unloadAsync().catch(() => {});
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
      hideMediaNotification();
      broadcastListeningActivity(null, false, 0);
    };
  }, [broadcastListeningActivity]);

  // Periodic heartbeat every 18 seconds to keep Discord Rich Presence active
  useEffect(() => {
    const timer = setInterval(() => {
      if (isPlayingRef.current && currentTrackRef.current) {
        broadcastListeningActivity(currentTrackRef.current, true, playbackStatusRef.current?.currentTime || 0);
      }
    }, 18000);
    return () => clearInterval(timer);
  }, [broadcastListeningActivity]);

  // Clean up Discord Rich Presence / activity when mobile app is paused or put to background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active' && !isPlayingRef.current) {
        broadcastListeningActivity(null, false, 0);
      }
    });
    return () => sub.remove();
  }, [broadcastListeningActivity]);

  // Reactive subscription to downloaded tracks changes
  useEffect(() => {
    const unsub = subscribeToDownloadedTracks((updated) => {
      const cleaned = deduplicateTrackList(updated || []);
      setDownloadedTracks(cleaned);
      downloadedTracksRef.current = cleaned;
    });
    return unsub;
  }, []);

  const refreshDownloadedTracks = async () => {
    try {
      const list = await getDownloadedTracks();
      const cleaned = deduplicateTrackList(list || []);
      setDownloadedTracks(cleaned);
      downloadedTracksRef.current = cleaned;
    } catch {}
  };

  const downloadedTrackIds = useMemo(() => {
    return new Set((downloadedTracks || []).map(t => String(t._id || t.id)).filter(Boolean));
  }, [downloadedTracks]);

  const isTrackDownloaded = useCallback((trackOrId) => {
    if (!trackOrId) return false;
    const tId = (typeof trackOrId === 'object' && trackOrId !== null)
      ? String(trackOrId._id || trackOrId.id || '')
      : String(trackOrId);
    const dList = downloadedTracksRef.current || [];
    if (tId && dList.some(t => String(t._id || t.id) === tId)) return true;
    if (typeof trackOrId === 'object' && trackOrId !== null) {
      const curKey = getTrackDedupeKey(trackOrId);
      if (curKey && dList.some(t => getTrackDedupeKey(t) === curKey)) return true;
    }
    return false;
  }, []);

  const removeDownloadedTracksBatch = async (tracksOrIds) => {
    const updated = await rawRemoveDownloadedTracksBatch(tracksOrIds);
    const cleaned = deduplicateTrackList(updated || []);
    setDownloadedTracks(cleaned);
    downloadedTracksRef.current = cleaned;
    return cleaned;
  };

  const removeDownloadedTrack = async (trackOrId) => {
    const updated = await rawRemoveDownloadedTrack(trackOrId);
    const cleaned = deduplicateTrackList(updated || []);
    setDownloadedTracks(cleaned);
    downloadedTracksRef.current = cleaned;

    const idStr = (typeof trackOrId === 'object' && trackOrId !== null)
      ? String(trackOrId._id || trackOrId.id || '')
      : String(trackOrId);
    const cur = currentTrackRef.current;
    if (cur) {
      const curId = String(cur._id || cur.id);
      const isCurMatch = curId === idStr || (typeof trackOrId === 'object' && trackOrId !== null && getTrackDedupeKey(cur) === getTrackDedupeKey(trackOrId));
      if (isCurMatch) {
        setCurrentTrackState(prev => prev ? {
          ...prev,
          isDownloaded: false,
          downloaded: false,
          localAudioUri: null,
          nativeAudioUri: null,
        } : prev);
      }
    }
    return cleaned;
  };

  const onPlaybackStatusUpdate = (status) => {
    if (!status.isLoaded) return;

    // Safety: Ensure sound matches the active track currently displayed
    const currentActiveId = String(currentTrackRef.current?._id || currentTrackRef.current?.id || '');
    if (loadedTrackIdRef.current && currentActiveId && loadedTrackIdRef.current !== currentActiveId) {
      if (soundRef.current) {
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
        soundRef.current = null;
      }
      return;
    }

    // ─── TRACK COMPLETION / NEXT TRACK / REPEAT ONE HANDLER ───
    const isPlaybackFinished = Boolean(
      status.didJustFinish ||
      (statusDurSec > 5 && newCurrentTime >= statusDurSec - 1 && !status.isPlaying && !status.isBuffering) ||
      (status.positionMillis > 3000 && status.durationMillis > 3000 && status.positionMillis >= status.durationMillis - 600)
    );
    if (isPlaybackFinished && ((status.positionMillis || 0) > 500 || (status.durationMillis || 0) > 500)) {
      const finishedTrack = currentTrackRef.current;
      if (finishedTrack && !isOfflineRef.current) {
        if (typeof autoPersistFinishedTrack === 'function') {
          autoPersistFinishedTrack(finishedTrack);
        }
      }
      if (finishedTrack && !isOfflineRef.current && autoDownloadFinishedRef.current) {
        const fId = String(finishedTrack._id || finishedTrack.id || '');
        const isAlreadyDl = (downloadedTracksRef.current || []).some(d => String(d._id || d.id) === fId);
        if (!isAlreadyDl && !downloadingIdsRef.current[fId]) {
          downloadTrack(finishedTrack)
            .then((rec) => {
              if (rec) {
                setDownloadedTracks(prev => [rec, ...(prev || []).filter(t => String(t._id || t.id) !== fId)]);
                showToast(`Auto-cached "${finishedTrack.title || 'Track'}" to Vault`, 'success');
              }
            })
            .catch(() => {});
        }
      }

      // RIVO DJ ENGINE: Seamless handoff if next sound is already running
      if (isMixModeRef.current && nextSoundRef.current && nextTrackRef.current) {
        console.log('[RivoDJ] ⚡ Completing seamless crossfade to next track');
        const prevSound = soundRef.current;
        const newActiveSound = nextSoundRef.current;
        const newActiveTrack = nextTrackRef.current;
        const newActiveId = String(newActiveTrack._id || newActiveTrack.id || '');

        if (prevSound) {
          try { prevSound.setOnPlaybackStatusUpdate(null); } catch {}
          prevSound.stopAsync().catch(() => {});
          prevSound.unloadAsync().catch(() => {});
        }

        soundRef.current = newActiveSound;
        nextSoundRef.current = null;
        nextTrackRef.current = null;
        nextSoundPlayingRef.current = false;
        loadedTrackIdRef.current = newActiveId; // CRITICAL: keeps active sound alive!
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

        const isLiked = likedTrackIds.some(id => String(id) === newActiveId);
        updateMediaNotification(true, repeatModeRef.current, isShuffleRef.current, isLiked, newActiveTrack);
        return;
      }

      if (repeatModeRef.current === 'one') {
        shouldBePlayingRef.current = true;
        isPlayingRef.current = true;
        setIsPlaying(true);
        if (soundRef.current) {
          soundRef.current.setPositionAsync(0).then(() => {
            if (soundRef.current) soundRef.current.playAsync().catch(() => {});
          }).catch(() => {
            if (soundRef.current) soundRef.current.replayAsync().catch(() => {});
          });
        }
        return;
      }

      // Detach completed sound listener so its trailing events don't pause playback
      if (soundRef.current) {
        try { soundRef.current.setOnPlaybackStatusUpdate(null); } catch {}
      }

      shouldBePlayingRef.current = true;
      isPlayingRef.current = true;

      // Advance to next track
      if (jamSyncRef.current?.jamSession) {
        if (isJamHost() && playNextTrackRef.current) {
          playNextTrackRef.current();
        }
      } else {
        if (playNextTrackRef.current) {
          playNextTrackRef.current();
        }
      }
      return;
    }

    // Hard safeguard: If playback should be paused, immediately kill any rogue playing state
    if (!shouldBePlayingRef.current && !isLoadingRef.current) {
      if (status.isPlaying && soundRef.current) {
        soundRef.current.pauseAsync().catch(() => {});
      }
      setIsPlaying(false);
      isPlayingRef.current = false;
      return;
    }

    if (!isSeekingRef.current && !status.isBuffering) {
      if (isPlayingRef.current !== status.isPlaying) {
        setIsPlaying(status.isPlaying);
        isPlayingRef.current = status.isPlaying;
        if (!isLoadingRef.current && !status.didJustFinish) {
          shouldBePlayingRef.current = status.isPlaying;
        }
        const isLikedTrack = currentTrackRef.current ? likedTrackIds.some(id => String(id) === String(currentTrackRef.current._id || currentTrackRef.current.id)) : false;
        const curSec = Math.floor((status.positionMillis || 0) / 1000);
        const durSec = Math.floor((status.durationMillis || 0) / 1000);
        updateMediaNotification(status.isPlaying, repeatModeRef.current, isShuffleRef.current, isLikedTrack, {
          ...(currentTrackRef.current || {}),
          currentTime: curSec,
          duration: durSec || Number(currentTrackRef.current?.duration || 240),
        });
      }
    }

    // If user is currently seeking or just sought, protect against time jumps
    if (isSeekingRef.current || (Date.now() - (lastSeekTimestampRef.current || 0) < 1200)) {
      return;
    }

    const newCurrentTime = Math.floor(status.positionMillis / 1000);
    const statusDurSec = Math.floor((status.durationMillis || 0) / 1000);
    const knownDur = Number(currentTrackRef.current?.duration || playbackStatusRef.current?.duration || 0);
    const newDuration = statusDurSec > 1 ? statusDurSec : (knownDur > 0 ? knownDur : 240);

    if (playbackStatusRef.current.currentTime !== newCurrentTime) {
      playbackStatusRef.current = { ...playbackStatusRef.current, currentTime: newCurrentTime, duration: newDuration };
      progressRef.current = { currentTime: newCurrentTime, duration: newDuration };
      setProgress({ currentTime: newCurrentTime, duration: newDuration });

      // RIVO DJ ENGINE: Dual-Player Seamless Auto-Crossfade (Full Spotify-Style Lookahead)
      if (isMixModeRef.current && status.isPlaying && statusDurSec > 10) {
        const curTrack = currentTrackRef.current;
        if (isQuranContent(curTrack)) return; // 📿 Holy Quran Safeguard: Never crossfade or mix Quran
        const curId = String(curTrack?._id || curTrack?.id || '');
        const q = queueRef.current || [];
        const curIdx = q.findIndex(t => String(t._id || t.id) === curId);
        const nextTrack = (curIdx >= 0 && curIdx + 1 < q.length) ? q[curIdx + 1] : q[0];
        if (isQuranContent(nextTrack)) return; // 📿 Holy Quran Safeguard: Never mix into Quran
        const nextId = String(nextTrack?._id || nextTrack?.id || '');

        const pairKey = `${curId}_${nextId}`;
        const pairKeyAlt = `${curId}___${nextId}`;
        const titleKey = `${curTrack?.title}___${nextTrack?.title}`;

        const trans = activeTransRef.current?.[pairKey] ||
                      activeTransRef.current?.[pairKeyAlt] ||
                      activeTransRef.current?.[titleKey] ||
                      q?._transitions?.[pairKey] ||
                      q?._transitions?.[pairKeyAlt] ||
                      q?._transitions?.[titleKey];

        let transDur = 8;
        if (trans?.duration) {
          transDur = Number(trans.duration);
        } else if (trans?.bars) {
          const bpm = Number(curTrack?.bpm) || 120;
          transDur = Math.round((trans.bars * 240) / bpm);
        } else if (mixDurationRef.current) {
          transDur = Number(mixDurationRef.current);
        }
        transDur = Math.max(2, Math.min(48, transDur));
        const transStyle = trans?.style || mixStyleRef.current || 'auto';
        const mixOutPoint = (trans?.mixOutPoint !== undefined && Number(trans.mixOutPoint) > 5 && Number(trans.mixOutPoint) <= statusDurSec)
          ? Number(trans.mixOutPoint)
          : Math.max(5, statusDurSec - 2);
        const mixInPoint = Number(trans?.mixInPoint) || 0;
        const crossoverBias = Number(trans?.crossoverBias) || 0.5;
        const volA = Number(trans?.volA) || 100;
        const volB = Number(trans?.volB) || 100;
        const speedA = Number(trans?.speedA) || 1.0;
        const speedB = Number(trans?.speedB) || 1.0;

        const remainingSec = mixOutPoint - newCurrentTime;

        // 1. Cue next track 4 seconds before the transition zone
        if (remainingSec <= (transDur + 4) && remainingSec > 0 && !nextSoundRef.current && !isMixPreloadingRef.current) {
          preloadNextTrackForDjMix(mixInPoint, speedB);
        }

        // 2. Active Crossfade volume curves
        if (remainingSec <= transDur && remainingSec > 0) {
          if (nextSoundRef.current && !nextSoundPlayingRef.current) {
            nextSoundPlayingRef.current = true;
            nextSoundRef.current.playAsync().catch(() => {});
          }
          const rawP = Math.max(0.01, Math.min(1, (transDur - remainingSec) / transDur));
          const { gainA, gainB } = calculateCrossfadeGains(rawP, transStyle, crossoverBias);

          const masterVol = volumeRef.current !== undefined ? volumeRef.current : 0.8;
          const targetVolA = Math.max(0.01, Math.min(1, masterVol * gainA * (volA / 100)));
          const targetVolB = Math.max(0.01, Math.min(1, masterVol * gainB * (volB / 100)));

          if (soundRef.current) {
            soundRef.current.setVolumeAsync(targetVolA).catch(() => {});
            soundRef.current.setRateAsync(speedA, true).catch(() => {});
          }
          if (nextSoundRef.current) {
            nextSoundRef.current.setVolumeAsync(targetVolB).catch(() => {});
          }
        }
      }

      // Periodically sync elapsed playback time with lockscreen / drawer notification
      if (isPlayingRef.current && Math.abs(newCurrentTime - (playbackStatusRef.current._lastNotifSync || 0)) >= 3) {
        playbackStatusRef.current._lastNotifSync = newCurrentTime;
        const cur = currentTrackRef.current;
        if (cur) {
          const isLikedTrack = likedTrackIds.some(id => String(id) === String(cur._id || cur.id));
          updateMediaNotification(
            true,
            repeatModeRef.current,
            isShuffleRef.current,
            isLikedTrack,
            {
              ...cur,
              currentTime: newCurrentTime,
              duration: newDuration,
            }
          );
        }
      }

      // Periodically sync live playback time with other devices (Rivo Connect)
      // Strictly skip if currently inside an active Jam room
      if (isPlayingRef.current && !jamSyncRef.current?.jamSession && Math.abs(newCurrentTime - (playbackStatusRef.current._lastDeviceSync || 0)) >= 3) {
        playbackStatusRef.current._lastDeviceSync = newCurrentTime;
        if (jamSyncRef.current?.socket && currentTrackRef.current) {
          jamSyncRef.current.socket.emit('device:playback_state', {
            isPlaying: true,
            track: currentTrackRef.current,
            currentTime: newCurrentTime,
            deviceType: 'mobile',
            deviceName: Platform.OS === 'ios' ? 'iPhone' : 'Android'
          });
        }
      }

      // Periodically sync live playback state to Jam room every 3.5 seconds (HOST ONLY)
      if (isPlayingRef.current && Math.abs(newCurrentTime - (playbackStatusRef.current._lastJamSync || 0)) >= 3.5) {
        playbackStatusRef.current._lastJamSync = newCurrentTime;
        if (jamSyncRef.current?.socket && jamSyncRef.current?.jamSession && isJamHost()) {
          const roomCode = String(jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode || '').trim().toUpperCase();
          if (roomCode) {
            jamSyncRef.current.socket.emit('jam:sync_play_state', {
              roomCode,
              isPlaying: true,
              currentTrack: currentTrackRef.current,
              currentTime: newCurrentTime,
              updatedAt: Date.now(),
              initiatorId: jamSyncRef.current.socket.id,
              userId: currentUser?._id || currentUser?.id,
              isPeriodic: true,
            });
          }
        }
      }
    }


  };

  // Keep state refs updated for lock screen actions
  isPlayingRef.current = isPlaying;
  isShuffleRef.current = isShuffle;
  repeatModeRef.current = repeatMode;
  currentTrackRef.current = currentTrack;

  // Sync media notification controls with background notification drawer & iOS Lock Screen
  useEffect(() => {
    const unsub = subscribeToMediaActions(async (action) => {
      if (!isOffline && !soundRef.current) return;
      try {
        if (typeof action === 'string' && action.startsWith('seek:')) {
          const secs = parseFloat(action.split(':')[1]);
          if (!isNaN(secs)) {
            progressRef.current = { ...progressRef.current, currentTime: secs };
            setProgress(p => ({ ...p, currentTime: secs }));
            if (playbackStatusRef.current) {
              playbackStatusRef.current.currentTime = secs;
            }
            if (seekToRef.current) {
              seekToRef.current(secs);
            }
          }
          return;
        }
        const cur = currentTrackRef.current;
        const isLikedTrack = cur ? likedTrackIds.some(id => String(id) === String(cur._id || cur.id)) : false;

        switch (action) {
          case 'play':
            shouldBePlayingRef.current = true;
            isPlayingRef.current = true;
            setIsPlaying(true);
            if (soundRef.current) {
              await soundRef.current.playAsync().catch(() => {});
              const curPos = playbackStatusRef.current?.currentTime || 0;
              const curDur = playbackStatusRef.current?.duration || Number(cur?.duration || 240);
              updateMediaNotification(true, repeatModeRef.current, isShuffleRef.current, isLikedTrack, {
                ...(cur || {}),
                currentTime: curPos,
                duration: curDur,
              });
              broadcastListeningActivity(cur, true, curPos);
            } else if (togglePlayRef.current) {
              togglePlayRef.current();
            }
            if (jamSyncRef.current.jamSession && jamSyncRef.current.socket && canControlJam()) {
              const rCode = String(jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode || '').trim().toUpperCase();
              if (rCode) {
                jamSyncRef.current.socket.emit('jam:sync_play_state', {
                  roomCode: rCode,
                  isPlaying: true,
                  currentTrack: cur,
                  currentTime: playbackStatusRef.current?.currentTime || 0,
                  initiatorId: jamSyncRef.current.socket.id,
                  userId: currentUser?._id || currentUser?.id,
                  isUserAction: true,
                  userAction: 'play',
                });
              }
            }
            break;
          case 'pause':
            shouldBePlayingRef.current = false;
            isPlayingRef.current = false;
            setIsPlaying(false);
            if (soundRef.current) {
              await soundRef.current.pauseAsync().catch(() => {});
              const curPos = playbackStatusRef.current?.currentTime || 0;
              const curDur = playbackStatusRef.current?.duration || Number(cur?.duration || 240);
              updateMediaNotification(false, repeatModeRef.current, isShuffleRef.current, isLikedTrack, {
                ...(cur || {}),
                currentTime: curPos,
                duration: curDur,
              });
              broadcastListeningActivity(cur, false, curPos);
            } else if (togglePlayRef.current) {
              togglePlayRef.current();
            }
            if (jamSyncRef.current.jamSession && jamSyncRef.current.socket && canControlJam()) {
              const rCode = String(jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode || '').trim().toUpperCase();
              if (rCode) {
                jamSyncRef.current.socket.emit('jam:sync_play_state', {
                  roomCode: rCode,
                  isPlaying: false,
                  currentTrack: cur,
                  currentTime: playbackStatusRef.current?.currentTime || 0,
                  initiatorId: jamSyncRef.current.socket.id,
                  userId: currentUser?._id || currentUser?.id,
                  isUserAction: true,
                  userAction: 'pause',
                });
              }
            }
            break;
          case 'play_pause':
            if (togglePlayRef.current) {
              togglePlayRef.current();
            } else if (soundRef.current) {
              const nextState = !isPlayingRef.current;
              shouldBePlayingRef.current = nextState;
              isPlayingRef.current = nextState;
              setIsPlaying(nextState);
              if (nextState) {
                await soundRef.current.playAsync().catch(() => {});
              } else {
                await soundRef.current.pauseAsync().catch(() => {});
              }
              const curPos = playbackStatusRef.current?.currentTime || 0;
              const curDur = playbackStatusRef.current?.duration || Number(cur?.duration || 240);
              updateMediaNotification(nextState, repeatModeRef.current, isShuffleRef.current, isLikedTrack, {
                ...(cur || {}),
                currentTime: curPos,
                duration: curDur,
              });
              broadcastListeningActivity(cur, nextState, curPos);
              if (jamSyncRef.current.jamSession && jamSyncRef.current.socket && canControlJam()) {
                const rCode = String(jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode || '').trim().toUpperCase();
                if (rCode) {
                  jamSyncRef.current.socket.emit('jam:sync_play_state', {
                    roomCode: rCode,
                    isPlaying: nextState,
                    currentTrack: cur,
                    currentTime: curPos,
                    initiatorId: jamSyncRef.current.socket.id,
                    userId: currentUser?._id || currentUser?.id,
                    isUserAction: true,
                    userAction: nextState ? 'play' : 'pause',
                  });
                }
              }
            }
            break;
          case 'next':
            if (playNextTrackRef.current) playNextTrackRef.current();
            break;
          case 'prev':
            if (playPrevTrackRef.current) playPrevTrackRef.current();
            break;
          case 'repeat':
            setRepeatMode(prev => prev === 'off' ? 'all' : (prev === 'all' ? 'one' : 'off'));
            break;
          case 'shuffle':
            setIsShuffle(prev => !prev);
            break;
          case 'like': {
            const cur = currentTrackRef.current;
            if (cur && toggleLikeTrack) {
              toggleLikeTrack(String(cur._id || cur.id));
            }
            break;
          }
          case 'forward': {
            const newPos = (playbackStatusRef.current.currentTime || 0) + 10;
            if (seekToRef.current) seekToRef.current(newPos);
            break;
          }
          case 'rewind': {
            const newPos = Math.max(0, (playbackStatusRef.current.currentTime || 0) - 10);
            if (seekToRef.current) seekToRef.current(newPos);
            break;
          }
          default:
            break;
        }
      } catch (e) {}
    });

    return () => unsub();
  }, [toggleLikeTrack]);

  useEffect(() => {
    if (currentTrack) {
      const isLikedTrack = likedTrackIds.some(id => String(id) === String(currentTrack._id || currentTrack.id));
      updateMediaNotification(
        isPlaying,
        repeatMode,
        isShuffle,
        isLikedTrack,
        {
          ...currentTrack,
          duration: Number(currentTrack.duration || (playbackStatusRef.current?.duration || 240)),
          currentTime: Number(playbackStatusRef.current?.currentTime || 0),
          liked: isLikedTrack,
        }
      );
    }
  }, [isPlaying, isShuffle, repeatMode, currentTrack?.id, currentTrack?._id, likedTrackIds]);

  useEffect(() => {
    if (!currentTrack) {
      setLyrics([]);
      return;
    }

    const dl = (downloadedTracks || []).find(t => String(t._id || t.id) === String(currentTrack._id || currentTrack.id));

    // Immediate local lyrics fallback while fetching verified lyrics
    let initialParsed = [];
    if (currentTrack.lyrics) {
      initialParsed = parseLrcLyrics(currentTrack.lyrics);
      if (initialParsed.length > 0) setLyrics(initialParsed);
    } else if (dl?.lyrics) {
      initialParsed = parseLrcLyrics(dl.lyrics);
      if (initialParsed.length > 0) setLyrics(initialParsed);
    }

    // If offline, do not attempt network fetching
    if (isOffline) {
      setLyrics([]);
      return;
    }

    const isLocalTrack = Boolean(currentTrack.isLocalImport || currentTrack.localAudioUri || currentTrack.downloaded || dl);

    setLyrics([]);
    let isMounted = true;
    const fetchLyrics = async () => {
      try {
        setIsLoadingLyrics(true);
        const title = encodeURIComponent(currentTrack.title || '');
        const artist = encodeURIComponent(currentTrack.artist || '');
        const trackId = encodeURIComponent(currentTrack._id || currentTrack.id || '');

        const res = await fetch(`${API_BASE_URL}/api/tracks/lyrics?trackId=${trackId}&title=${title}&artist=${artist}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.success && Array.isArray(data.lyrics) && data.lyrics.length > 0) {
            const parsed = parseLrcLyrics(data.lyrics);
            setLyrics(parsed);
            if (currentTrackRef.current) {
              currentTrackRef.current.lyrics = parsed;
              currentTrackRef.current.isVerified = Boolean(data.isVerified);
              currentTrackRef.current.lyricsVerified = Boolean(data.isVerified);
              currentTrackRef.current.isVerifiedLyrics = Boolean(data.isVerified);
              currentTrackRef.current.lyricsVerifiedBy = data.verifiedBy || null;
              currentTrackRef.current.verifiedBy = data.verifiedBy || null;
            }
            if (isLocalTrack) {
              updateDownloadedTrackLyrics(currentTrack._id || currentTrack.id, data.lyrics).catch(() => {});
            }
            return;
          }
        }

        // Never generate AI lyrics for local/downloaded tracks
        if (isLocalTrack) {
          if (isMounted) setLyrics([]);
          return;
        }

        // Fallback: request AI generation if no lyrics found (online catalog tracks only)
        const genRes = await fetch(`${API_BASE_URL}/api/ai/generate-song-lyrics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackId: currentTrack._id || currentTrack.id,
            title: currentTrack.title,
            artist: currentTrack.artist,
            duration: currentTrack.duration || 180,
          }),
        });
        if (genRes.ok) {
          const genData = await genRes.json();
          if (isMounted && genData?.success && Array.isArray(genData.lyrics)) {
            setLyrics(genData.lyrics);
            return;
          }
        }

        if (isMounted) setLyrics([]);
      } catch {
        if (isMounted) setLyrics([]);
      } finally {
        if (isMounted) setIsLoadingLyrics(false);
      }
    };
    fetchLyrics();

    return () => {
      isMounted = false;
    };
  }, [currentTrack?._id, currentTrack?.id, currentTrack?.title, isOffline]);

  const playTrack = async (track, trackList = [], isRetry = false, targetTime = 0, isRemoteParam = false, isSmartMood = false, autoPlay = true) => {
    const isRemote = isRemoteParam === true;
    if (!track) {
      isLoadingRef.current = false;
      setIsLoading(false);
      return;
    }

    // 1. Abort previous pending fetch requests & mark pending sound loads as canceled
    if (playAbortControllerRef.current) {
      try { playAbortControllerRef.current.abort(); } catch {}
    }
    const abortController = new AbortController();
    playAbortControllerRef.current = abortController;

    const currentLoadId = ++soundLoadIdRef.current;
    const requestSeq = ++playRequestSeqRef.current;
    const requestTs = Date.now();
    const connectStartTime = Date.now();
    const safeTargetSec = Math.max(0, Number(targetTime) || 0);

    isLoadingRef.current = true;
    if (autoPlay) {
      shouldBePlayingRef.current = true;
    }

    if (isSmartMood || (Array.isArray(trackList) && trackList.some(t => t.isSmartMoodQueue)) || track?.isSmartMoodQueue) {
      isSmartMoodQueueRef.current = true;
    } else if (Array.isArray(trackList) && trackList.length > 0) {
      isSmartMoodQueueRef.current = false;
    }

    if (!isHistoryNavRef.current && currentTrackRef.current) {
      const curId = currentTrackRef.current._id || currentTrackRef.current.id;
      const newId = track._id || track.id;
      if (curId && curId !== newId) {
        historyStackRef.current.push(currentTrackRef.current);
        if (historyStackRef.current.length > 50) historyStackRef.current.shift();
      }
    }
    isHistoryNavRef.current = false;

    const trackId = String(track._id || track.id || '');

    // Synchronously set track ref and state immediately to prevent skip race conditions
    currentTrackRef.current = track;
    setCurrentTrackState(track);

    playbackStatusRef.current = {
      currentTime: safeTargetSec,
      duration: Number(track.duration || 0),
      lastRequestTs: requestTs,
      requestSeq,
    };
    setProgress({ currentTime: safeTargetSec, duration: Number(track.duration || 0) });
    setVocalIsolationStatus(null);

    if (isQuranContent(track)) {
      // 📿 Holy Quran Safeguard: Immediately disengage DJ mix mode & vocal isolation
      setVocalIsolationStatus(null);
      isMixModeRef.current = false;
      setIsMixModeState(false);
      activeTransRef.current = {};
      setActiveTransitions({});
      if (nextSoundRef.current) {
        nextSoundRef.current.unloadAsync().catch(() => {});
        nextSoundRef.current = null;
        nextTrackRef.current = null;
        nextSoundPlayingRef.current = false;
      }
    }

    try {
      setIsLoading(true);

      if (Array.isArray(trackList) && trackList.length > 0) {
        let finalQ = trackList;
        if (isShuffleRef.current && trackList.length > 1) {
          const tid = String(track._id || track.id || '');
          const others = trackList.filter(t => String(t._id || t.id) !== tid);
          finalQ = [track, ...[...others].sort(() => Math.random() - 0.5)];
        }
        setQueue(finalQ);
      } else if (!trackList || trackList.length <= 1) {
        const isTargetQuran = Boolean(isQuranContent(track));
        const pool = ((userTracks && userTracks.length > 0) ? userTracks : (INITIAL_TRACKS || []))
          .filter(t => isTargetQuran ? isQuranContent(t) : !isQuranContent(t));
        const tid = String(track._id || track.id || '');
        const others = pool.filter(t => String(t._id || t.id) !== tid);
        let finalQ = [track, ...others];
        if (isShuffleRef.current && others.length > 1) {
          finalQ = [track, ...[...others].sort(() => Math.random() - 0.5)];
        }
        setQueue(finalQ);
      }

      // Proactively broadcast track play event immediately to Jam room if active and user can control
      if (!isRemote && jamSyncRef.current.jamSession && jamSyncRef.current.socket && canControlJam()) {
        const roomCode = String(jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode || '').trim().toUpperCase();
        if (roomCode) {
          jamSyncRef.current.socket.emit('jam:sync_play_state', {
            roomCode,
            isPlaying: true,
            currentTrack: track,
            currentTime: safeTargetSec,
            initiatorId: jamSyncRef.current.socket.id,
            userId: currentUser?._id || currentUser?.id,
            isUserAction: true,
            userAction: 'play_track',
          });
        }
      }

      if (nextSoundRef.current) {
        const prevNext = nextSoundRef.current;
        nextSoundRef.current = null;
        nextTrackRef.current = null;
        try { prevNext.setOnPlaybackStatusUpdate(null); } catch {}
        prevNext.stopAsync().catch(() => {});
        prevNext.unloadAsync().catch(() => {});
      }
      if (soundRef.current) {
        const prevSound = soundRef.current;
        soundRef.current = null;
        loadedTrackIdRef.current = null;
        try { prevSound.setOnPlaybackStatusUpdate(null); } catch {}
        prevSound.stopAsync().catch(() => {});
        prevSound.unloadAsync().catch(() => {});
      }

      // Proactively keep Android MediaNotificationService & WakeLock active during background transition
      if (shouldBePlayingRef.current) {
        const isLikedTrack = likedTrackIds.some(id => String(id) === String(track._id || track.id));
        updateMediaNotification(true, repeatModeRef.current, isShuffleRef.current, isLikedTrack, {
          ...track,
          currentTime: safeTargetSec,
          duration: Number(track.duration || 240)
        });
      }

      // Determine if Vocal-Only Mode is active for this content
      const isVocalActive = isVocalOnlyRef.current && !isQuranContent(track);

      let uri = null;

      if (!isVocalActive) {
        // Prioritize local downloaded version in Online Mode to save mobile data:
        // Match by trackId OR clean title + artist in offline vault
        const cleanTitle = (track.title || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').trim();
        const cleanArtist = (track.artist || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').trim();

        const local = (downloadedTracks || []).find(t => {
          if (trackId && String(t._id || t.id) === trackId) return true;
          if (isUploadedTrack) return false; // For uploaded tracks, only accept exact trackId match
          const tTitle = (t.title || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').trim();
          const tArtist = (t.artist || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').trim();
          return cleanTitle && cleanArtist && tTitle && tArtist && cleanTitle === tTitle && cleanArtist === tArtist;
        });

        uri = local?.nativeAudioUri || local?.localAudioUri || local?.audioUrl || track.nativeAudioUri || track.localAudioUri;

        // Authentic uploaded audio file handling
        if (!uri && isUploadedTrack && track.audioUrl) {
          const rawAudio = track.audioUrl;
          uri = rawAudio.startsWith('/') ? `${API_BASE_URL}${rawAudio}` : (rawAudio.startsWith('http') ? rawAudio : `${API_BASE_URL}/${rawAudio}`);
        }

        // Pre-resolved audio URL (e.g. broadcast from Jam host or cached HTTP audio stream)
        if (!isOffline) {
          if (!uri && !isRetry && track.resolvedAudioUrl && (track.resolvedAudioUrl.startsWith('http://') || track.resolvedAudioUrl.startsWith('https://'))) {
            uri = track.resolvedAudioUrl;
          }
          if (!uri && track.audioUrl && (track.audioUrl.startsWith('http://') || track.audioUrl.startsWith('https://')) && !track.audioUrl.includes('youtube.com/watch') && !track.audioUrl.includes('youtu.be/')) {
            uri = track.audioUrl;
          }
        }

        // Direct check on physical storage by trackId (detects local files on device even if not yet in state)
        if ((!uri || !uri.startsWith('file://')) && !isUploadedTrack) {
          const directMp3 = `${FileSystem.documentDirectory}rivo_tracks/${trackId}.mp3`;
          const directM4a = `${FileSystem.documentDirectory}rivo_tracks/${trackId}.m4a`;
          try {
            const mInfo = await FileSystem.getInfoAsync(directMp3);
            if (mInfo.exists && mInfo.size > 10000) {
              uri = directMp3;
            } else {
              const m4Info = await FileSystem.getInfoAsync(directM4a);
              if (m4Info.exists && m4Info.size > 10000) {
                uri = directM4a;
              }
            }
          } catch {}
        }
      } else {
        // In Vocal-Only Mode: strictly only reuse if track already holds a verified vocal stem URL
        if (track.vocalStemUrl && (track.vocalStemUrl.includes('/stems/') || track.vocalStemUrl.includes('vocal_'))) {
          uri = track.vocalStemUrl.startsWith('/') ? `${API_BASE_URL}${track.vocalStemUrl}` : track.vocalStemUrl;
        }
      }

      if (uri && uri.startsWith('file://')) {
        // Re-anchor iOS container documents if path is from prior app installation
        if (uri.includes('/Documents/')) {
          const rel = uri.split('/Documents/')[1];
          uri = `${FileSystem.documentDirectory}${rel}`;
        }
        try {
          const fileInfo = await FileSystem.getInfoAsync(uri);
          if (!fileInfo.exists || fileInfo.size < 10000) {
            uri = null; // file was missing or corrupt
          }
        } catch {
          uri = null;
        }
      }

      if (uri && uri.startsWith('file://')) {
        console.log(`[AudioContext] ⚡ Offline-first: playing "${track.title}" locally:`, uri);
        track = {
          ...track,
          localAudioUri: uri,
          nativeAudioUri: uri,
          audioUrl: uri,
          isDownloaded: true,
          downloaded: true,
        };
        setCurrentTrack(track);
      }

      if (playRequestSeqRef.current !== requestSeq || String(currentTrackRef.current?._id || currentTrackRef.current?.id) !== trackId || soundLoadIdRef.current !== currentLoadId || abortController.signal.aborted) {
        if (playRequestSeqRef.current === requestSeq) {
          isLoadingRef.current = false;
          setIsLoading(false);
        }
        return;
      }

      if (!uri) {
        if (isOffline) {
          isLoadingRef.current = false;
          setIsLoading(false);
          showToast(`"${track.title || 'Track'}" is not cached offline`, 'warning');
          return;
        }
        uri = await resolveAudioStream(track, isQuranContent(track) ? false : isVocalOnlyRef.current, isQuranContent(track) ? null : updateVocalStatus);
        const cachedDur = getStreamDurationFromCache(trackId);
        if (cachedDur && cachedDur > 0) {
          track = { ...track, duration: cachedDur };
          playbackStatusRef.current.duration = cachedDur;
          progressRef.current.duration = cachedDur;
          setProgress(prev => ({ ...prev, duration: cachedDur }));
        }
      }

      if (playRequestSeqRef.current !== requestSeq || String(currentTrackRef.current?._id || currentTrackRef.current?.id) !== trackId || soundLoadIdRef.current !== currentLoadId || abortController.signal.aborted) {
        if (playRequestSeqRef.current === requestSeq) {
          isLoadingRef.current = false;
          setIsLoading(false);
        }
        return;
      }

      if (!uri) throw new Error('Could not resolve audio stream');
      if (uri.startsWith('/')) uri = `${API_BASE_URL}${uri}`;

      if (isVocalActive) {
        track = { ...track, vocalStemUrl: uri };
      } else {
        track = { ...track, resolvedAudioUrl: uri };
        if (uri.startsWith('http')) {
          track.audioUrl = uri;
        }
      }
      if (playRequestSeqRef.current !== requestSeq || String(currentTrackRef.current?._id || currentTrackRef.current?.id) !== trackId || soundLoadIdRef.current !== currentLoadId || abortController.signal.aborted) {
        if (playRequestSeqRef.current === requestSeq) {
          isLoadingRef.current = false;
          setIsLoading(false);
        }
        return;
      }
      currentTrackRef.current = track;
      setCurrentTrack(track);

      // Clean up previous sound right before creating new one
      if (soundRef.current) {
        const prevSound = soundRef.current;
        soundRef.current = null;
        loadedTrackIdRef.current = null;
        try { prevSound.setOnPlaybackStatusUpdate(null); } catch {}
        prevSound.stopAsync().catch(() => {});
        prevSound.unloadAsync().catch(() => {});
      }

      // Proactively keep Android MediaNotificationService & WakeLock active during background transition
      if (shouldBePlayingRef.current) {
        const isLikedTrack = likedTrackIds.some(id => String(id) === String(track._id || track.id));
        updateMediaNotification(true, repeatModeRef.current, isShuffleRef.current, isLikedTrack, {
          ...track,
          currentTime: safeTargetSec,
          duration: Number(track.duration || 240)
        });
      }

      const soundSource = { uri };
      const initialPosMs = Math.round(safeTargetSec * 1000);
      const willPlay = Boolean(autoPlay && shouldBePlayingRef.current);
      const initialVol = volumeRef.current !== undefined ? volumeRef.current : 1.0;
      const { sound } = await Audio.Sound.createAsync(
        soundSource,
        {
          shouldPlay: willPlay,
          positionMillis: initialPosMs > 0 ? initialPosMs : 0,
          volume: initialVol,
          progressUpdateIntervalMillis: 250,
        },
        onPlaybackStatusUpdate
      );

      const currentActiveId = String(currentTrackRef.current?._id || currentTrackRef.current?.id || '');
      if (
        soundLoadIdRef.current !== currentLoadId ||
        playRequestSeqRef.current !== requestSeq ||
        currentActiveId !== trackId ||
        abortController.signal.aborted
      ) {
        await sound.unloadAsync().catch(() => {});
        if (playRequestSeqRef.current === requestSeq) {
          isLoadingRef.current = false;
          setIsLoading(false);
        }
        return;
      }

      if (soundRef.current && soundRef.current !== sound) {
        try { soundRef.current.setOnPlaybackStatusUpdate(null); } catch {}
        soundRef.current.stopAsync().catch(() => {});
        soundRef.current.unloadAsync().catch(() => {});
      }

      soundRef.current = sound;
      loadedTrackIdRef.current = trackId;
      if (status && status.durationMillis && status.durationMillis > 1000) {
        const authenticSec = Math.floor(status.durationMillis / 1000);
        track = { ...track, duration: authenticSec };
        if (currentTrackRef.current) currentTrackRef.current.duration = authenticSec;
        playbackStatusRef.current.duration = authenticSec;
        progressRef.current.duration = authenticSec;
        setProgress(prev => ({ ...prev, duration: authenticSec }));
      }
      // Volume was already passed to createAsync directly

      // If user/remote paused while sound was creating:
      if (!autoPlay || !shouldBePlayingRef.current || playRequestSeqRef.current !== requestSeq || String(currentTrackRef.current?._id || currentTrackRef.current?.id) !== trackId) {
        if (playRequestSeqRef.current !== requestSeq || String(currentTrackRef.current?._id || currentTrackRef.current?.id) !== trackId) {
          await sound.unloadAsync().catch(() => {});
          if (soundRef.current === sound) soundRef.current = null;
          return;
        }
        setIsPlaying(false);
        isPlayingRef.current = false;
        isLoadingRef.current = false;
        setIsLoading(false);
        return;
      }

      // Position was already set via positionMillis in createAsync

      if (playRequestSeqRef.current !== requestSeq || String(currentTrackRef.current?._id || currentTrackRef.current?.id) !== trackId || soundLoadIdRef.current !== currentLoadId) {
        await sound.unloadAsync().catch(() => {});
        if (soundRef.current === sound) soundRef.current = null;
        return;
      }

      if (willPlay) {
        await sound.playAsync().catch(() => {});
      }

      isLoadingRef.current = false;
      setIsPlaying(true);
      isPlayingRef.current = true;
      setIsLoading(false);

      if (!isRemote && jamSyncRef.current.socket && !jamSyncRef.current.jamSession) {
        jamSyncRef.current.socket.emit('device:playback_state', {
          isPlaying: true,
          track,
          currentTime: safeTargetSec,
          deviceType: 'mobile',
          deviceName: Platform.OS === 'ios' ? 'iPhone' : 'Android'
        });
      }

      // Re-broadcast resolved audio URL to Jam room so guests play the identical audio stream
      if (!isRemote && jamSyncRef.current.socket && jamSyncRef.current.jamSession && canControlJam()) {
        const roomCode = String(jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode || '').trim().toUpperCase();
        if (roomCode && uri && uri.startsWith('http')) {
          jamSyncRef.current.socket.emit('jam:sync_play_state', {
            roomCode,
            isPlaying: true,
            currentTrack: { ...track, audioUrl: uri, resolvedAudioUrl: uri },
            currentTime: safeTargetSec,
            initiatorId: jamSyncRef.current.socket.id,
            userId: currentUser?._id || currentUser?.id,
            isUserAction: true,
            userAction: 'track_resolved'
          });
        }
      }

      try {
        const isLikedTrack = track ? likedTrackIds.some(id => String(id) === String(track._id || track.id)) : false;
        showMediaNotification({
          ...track,
          duration: Number(track.duration || (playbackStatusRef.current?.duration || 240)),
          coverUrl: track.coverUrl || track.cover || '',
          currentTime: safeTargetSec,
          liked: isLikedTrack,
        }, true, repeatMode, isShuffle, isLikedTrack);
      } catch {}
      broadcastListeningActivity(track, true, 0);
    } catch (err) {
      broadcastListeningActivity(null, false, 0);
      if (playRequestSeqRef.current === requestSeq) {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
      if (!isRetry && !isOffline && playRequestSeqRef.current === requestSeq) {
        const cleanRetryTrack = { ...track, resolvedAudioUrl: null };
        return playTrack(cleanRetryTrack, trackList, true, targetTime, isRemote);
      } else if (playRequestSeqRef.current === requestSeq) {
        showToast(`Could not play: ${track?.title || 'Track'}`, 'error');
      }
    } finally {
      if (playRequestSeqRef.current === requestSeq) {
        isLoadingRef.current = false;
        setIsLoading(false);
      }
    }
  };

  const playPlaylist = async (playlistOrTracks, startIndex = 0) => {
    const isMixPl = Boolean(
      playlistOrTracks &&
      (playlistOrTracks.isMix || (playlistOrTracks.name && String(playlistOrTracks.name).toUpperCase().includes('MIX')))
    );
    if (isMixPl) {
      setIsMixMode(true);
    }
    let list = [];
    if (Array.isArray(playlistOrTracks)) {
      list = playlistOrTracks;
    } else if (playlistOrTracks && typeof playlistOrTracks === 'object') {
      const isLiked = Boolean(
        playlistOrTracks.isLikedSongs ||
        playlistOrTracks.id === 'liked' ||
        String(playlistOrTracks.id || '').startsWith('liked') ||
        playlistOrTracks.name === 'Liked Songs'
      );

      if (Array.isArray(playlistOrTracks.tracks) && playlistOrTracks.tracks.length > 0 && typeof playlistOrTracks.tracks[0] === 'object' && playlistOrTracks.tracks[0].title) {
        list = playlistOrTracks.tracks;
      } else {
        const pool = (userTracks && userTracks.length > 0) ? userTracks : (INITIAL_TRACKS || []);
        let rawList = [];
        if (isLiked) {
          rawList = (likedTrackIds && likedTrackIds.length > 0) ? likedTrackIds : (playlistOrTracks.trackIds || []);
        } else {
          rawList = Array.isArray(playlistOrTracks.tracks) ? playlistOrTracks.tracks : (Array.isArray(playlistOrTracks.trackIds) ? playlistOrTracks.trackIds : []);
        }

        list = rawList.map(item => {
          if (item && typeof item === 'object' && item.title) return item;
          const id = typeof item === 'object' ? String(item._id || item.id) : String(item);
          return pool.find(t => String(t._id || t.id) === id);
        }).filter(Boolean);

        const plId = playlistOrTracks.id || playlistOrTracks._id || (isLiked ? 'liked' : null);
        if ((list.length === 0 || list.length < rawList.length) && plId) {
          try {
            const activeToken = tokenRef.current || token;
            const res = await fetch(`${API_BASE_URL}/api/playlists/${plId}`, {
              headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {}
            });
            if (res.ok) {
              const data = await res.json();
              const plTracks = data?.playlist?.tracks || data?.tracks;
              if (Array.isArray(plTracks) && plTracks.length > 0) {
                list = plTracks;
              }
            }
          } catch (e) {}
        }
      }
    }
    if (!Array.isArray(list) || list.length === 0) {
      showToast('No tracks found in playlist', 'info');
      return;
    }
    const safeIndex = Math.max(0, Math.min(startIndex, list.length - 1));
    const targetTrack = list[safeIndex];
    let finalQueue = [...list];
    if (isShuffleRef.current && finalQueue.length > 1) {
      const rest = finalQueue.filter((_, idx) => idx !== safeIndex);
      finalQueue = [targetTrack, ...rest.sort(() => Math.random() - 0.5)];
    }
    setQueue(finalQueue);
    return playTrack(targetTrack, finalQueue);
  };

  const togglePlay = async (isRemoteParam = false) => {
    const isRemote = isRemoteParam === true;
    if (isResolvingRef.current) return;

    // Enforce lock: If in Jam room and locked to host, non-hosts cannot toggle playback
    if (!isRemote && jamSyncRef.current.jamSession && !canControlJam()) {
      return;
    }

    const nextPlaying = !isPlayingRef.current;
    if (isLoading && nextPlaying) return;

    const curTrack = currentTrackRef.current || jamSyncRef.current.jamSession?.currentTrack;

    if (!soundRef.current) {
      if (curTrack) return playTrack(curTrack, queueRef.current);
      if (queueRef.current.length > 0) return playTrack(queueRef.current[0], queueRef.current);
      return;
    }
    const isLikedTrack = curTrack ? likedTrackIds.some(id => String(id) === String(curTrack._id || curTrack.id)) : false;
    shouldBePlayingRef.current = nextPlaying;
    isPlayingRef.current = nextPlaying;
    setIsPlaying(nextPlaying);
    const curPos = playbackStatusRef.current?.currentTime || 0;
    const curDur = playbackStatusRef.current?.duration || Number(curTrack?.duration || 240);

    // ⚡ Optimistic Socket Broadcast IMMEDIATELY (No waiting on hardware pauseAsync!)
    if (!isRemote && jamSyncRef.current.jamSession && jamSyncRef.current.socket && canControlJam()) {
      const roomCode = String(jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode || '').trim().toUpperCase();
      if (roomCode) {
        jamSyncRef.current.jamSession.isPlaying = nextPlaying;
        jamSyncRef.current.jamSession.currentTime = curPos;
        jamSyncRef.current.jamSession.updatedAt = Date.now();
        jamSyncRef.current.socket.emit('jam:sync_play_state', {
          roomCode,
          isPlaying: nextPlaying,
          currentTrack: curTrack,
          currentTime: curPos,
          initiatorId: jamSyncRef.current.socket.id,
          userId: currentUser?._id || currentUser?.id,
          isUserAction: true,
          userAction: nextPlaying ? 'play' : 'pause',
        });
      }
    }

    if (!isRemote && jamSyncRef.current.socket && !jamSyncRef.current.jamSession) {
      jamSyncRef.current.socket.emit('device:playback_state', {
        isPlaying: nextPlaying,
        track: currentTrackRef.current,
        currentTime: curPos || 0,
        deviceType: 'mobile',
        deviceName: Platform.OS === 'ios' ? 'iPhone' : 'Android'
      });
    }

    if (nextPlaying) {
      if (soundRef.current) {
        await soundRef.current.playAsync().catch(() => {});
      }
      updateMediaNotification(true, repeatMode, isShuffle, isLikedTrack, {
        ...currentTrackRef.current,
        currentTime: curPos,
        duration: curDur,
      });
      broadcastListeningActivity(currentTrackRef.current, true, curPos);
    } else {
      if (soundRef.current) {
        await soundRef.current.pauseAsync().catch(() => {});
      }
      updateMediaNotification(false, repeatMode, isShuffle, isLikedTrack, {
        ...currentTrackRef.current,
        currentTime: curPos,
        duration: curDur,
      });
      broadcastListeningActivity(currentTrackRef.current, false, curPos);
    }
  };

  const seekTo = async (secs, isRemoteParam = false) => {
    const isRemote = isRemoteParam === true;
    if (!isRemote && jamSyncRef.current.jamSession && !canControlJam()) {
      return;
    }
    const safeSecs = Math.max(0, Number(secs) || 0);
    const wasPlaying = isPlayingRef.current;

    isSeekingRef.current = true;
    lastSeekTimestampRef.current = Date.now();

    progressRef.current = { ...progressRef.current, currentTime: safeSecs };
    setProgress(p => ({ ...p, currentTime: safeSecs }));
    if (playbackStatusRef.current) {
      playbackStatusRef.current.currentTime = safeSecs;
    }

    // ⚡ Optimistic Socket Broadcast IMMEDIATELY (Zero seek latency!)
    if (!isRemote && jamSyncRef.current.jamSession && jamSyncRef.current.socket && canControlJam()) {
      const roomCode = String(jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode || '').trim().toUpperCase();
      if (roomCode) {
        jamSyncRef.current.jamSession.currentTime = safeSecs;
        jamSyncRef.current.jamSession.updatedAt = Date.now();
        jamSyncRef.current.socket.emit('jam:sync_play_state', {
          roomCode,
          isPlaying: wasPlaying,
          currentTrack: currentTrackRef.current,
          currentTime: safeSecs,
          initiatorId: jamSyncRef.current.socket.id,
          userId: currentUser?._id || currentUser?.id,
          isSeek: true,
          userAction: 'seek',
        });
      }
    }

    if (!soundRef.current) {
      isSeekingRef.current = false;
      return;
    }

    try {
      await soundRef.current.setPositionAsync(Math.round(safeSecs * 1000), {
        toleranceMillisBefore: 0,
        toleranceMillisAfter: 0,
      });
      if (wasPlaying) {
        await soundRef.current.playAsync().catch(() => {});
        shouldBePlayingRef.current = true;
        isPlayingRef.current = true;
        setIsPlaying(true);
      }
    } catch (err) {
      console.warn('[AudioContext] seekTo setPositionAsync failed:', err?.message);
    } finally {
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 1000);
    }

    if (wasPlaying) {
      setIsPlaying(true);
      const isLikedTrack = currentTrackRef.current ? likedTrackIds.some(id => String(id) === String(currentTrackRef.current._id || currentTrackRef.current.id)) : false;
      updateMediaNotification(true, repeatMode, isShuffle, isLikedTrack, {
        ...currentTrackRef.current,
        currentTime: safeSecs,
        duration: playbackStatusRef.current?.duration || Number(currentTrackRef.current?.duration || 240),
      });
    }
    broadcastListeningActivity(currentTrackRef.current, wasPlaying, safeSecs);
  };

  const playNextTrack = (forceLocal = false) => {
    shouldBePlayingRef.current = true;
    isPlayingRef.current = true;
    setIsPlaying(true);
    // 1. Advance shared room queue if active in Jam
    if (!forceLocal && jamSyncRef.current.jamSession && jamSyncRef.current.socket) {
      const roomCode = jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode;
      if (roomCode) {
        if (!canControlJam()) {
          return;
        }
        // If room has tracks in queue, advance shared queue
        if (jamSyncRef.current.jamSession.queue && jamSyncRef.current.jamSession.queue.length > 0) {
          jamSyncRef.current.socket.emit('jam:next_track', { roomCode });
          return;
        }
        // If room queue is empty and host-only control is locked, request host to advance
        if (!isJamHost() && jamSyncRef.current.jamSession.hostOnlyControl) {
          jamSyncRef.current.socket.emit('jam:next_track', { roomCode });
          return;
        }
        // When collaborative control is active, any member advances their local queue and broadcasts new track to room
      }
    }

    let q = queueRef.current;
    if (!q || q.length === 0) {
      q = downloadedTracks.length > 0 ? downloadedTracks : [];
      if (q.length > 0) setQueue(q);
    }

    const cur = currentTrackRef.current;
    const isCurQuran = Boolean(cur && isQuranContent(cur));

    const triggerAutoQueue = async () => {
      try {
        if (cur) {
          playedSmartSongIdsRef.current.add(String(cur._id || cur.id));
        }
        (queueRef.current || []).forEach(t => playedSmartSongIdsRef.current.add(String(t._id || t.id)));

        const pool = ((userTracks && userTracks.length > 0) ? userTracks : (INITIAL_TRACKS || []))
          .filter(t => (isCurQuran ? isQuranContent(t) : !isQuranContent(t)));

        let next10 = getSmartTasteAndMoodTracks({
          allTracks: pool,
          currentUser,
          followedArtists: currentUser?.following || [],
          likedTrackIds,
          excludeTrackIds: playedSmartSongIdsRef.current,
          limit: 30,
        });

        if (!next10 || next10.length === 0) {
          playedSmartSongIdsRef.current = new Set(cur ? [String(cur._id || cur.id)] : []);
          next10 = getSmartTasteAndMoodTracks({
            allTracks: pool,
            currentUser,
            followedArtists: currentUser?.following || [],
            likedTrackIds,
            excludeTrackIds: playedSmartSongIdsRef.current,
            limit: 30,
          });
        }

        if (next10 && next10.length > 0) {
          setQueue(next10);
          playTrack(next10[0], next10);
          return;
        }
      } catch (err) {}

      // Fallback: pick matching tracks from pool
      const pool = ((userTracks && userTracks.length > 0) ? userTracks : (INITIAL_TRACKS || []))
        .filter(t => (isCurQuran ? isQuranContent(t) : !isQuranContent(t)));
      if (pool.length > 0) {
        const remaining = pool.filter(t => String(t._id || t.id) !== currentId);
        const candidates = remaining.length > 0 ? remaining : pool;
        const freshQ = candidates.slice(0, 30);
        setQueue(freshQ);
        playTrack(freshQ[0], freshQ);
      }
    };

    if (!q || q.length === 0) {
      if (cur) triggerAutoQueue();
      return;
    }

    const currentId = String(currentTrackRef.current?._id || currentTrackRef.current?.id || '');
    const currentTitle = String(currentTrackRef.current?.title || '').trim().toLowerCase();
    let i = q.findIndex(t => String(t._id || t.id) === currentId);
    if (i === -1 && currentTitle) {
      i = q.findIndex(t => String(t.title || '').trim().toLowerCase() === currentTitle);
    }

    // Priority 1: Repeat Current Track (if repeat one is active, keep repeating the current track)
    if (repeatModeRef.current === 'one') {
      if (cur) {
        seekTo(0);
        if (soundRef.current) {
          soundRef.current.replayAsync().catch(() => {
            soundRef.current.playAsync().catch(() => {});
          });
        }
        return;
      }
    }

    // Priority 2: Repeat Queue (if repeat queue is active, loop/shuffle within this queue)
    if (repeatModeRef.current === 'all') {
      if (isShuffleRef.current) {
        // User wants to shuffle and repeat ONLY within this existing queue!
        // Never remove songs from queue!
        if (!playedInQueueCycleRef.current) {
          playedInQueueCycleRef.current = new Set();
        }
        if (currentId) {
          playedInQueueCycleRef.current.add(currentId);
        }

        const unplayedInQueue = q.filter(t => !playedInQueueCycleRef.current.has(String(t._id || t.id)));

        if (unplayedInQueue.length > 0) {
          const nextTrack = unplayedInQueue[Math.floor(Math.random() * unplayedInQueue.length)];
          playedInQueueCycleRef.current.add(String(nextTrack._id || nextTrack.id));
          playTrack(nextTrack, q);
          return;
        } else {
          // All songs in this queue have been played once in this cycle!
          // Reshuffle THIS same queue and restart cycle
          playedInQueueCycleRef.current.clear();
          const reshuffled = [...q].sort(() => Math.random() - 0.5);
          setQueue(reshuffled);
          const nextTrack = reshuffled[0];
          playedInQueueCycleRef.current.add(String(nextTrack._id || nextTrack.id));
          playTrack(nextTrack, reshuffled);
          return;
        }
      } else {
        // Sequential repeat for queue
        if (i >= 0 && i < q.length - 1) {
          playTrack(q[i + 1], q);
          return;
        } else {
          playTrack(q[0], q);
          return;
        }
      }
    }

    // Priority 3: Shuffle with Repeat OFF (when queue finishes, queue smart recommendations)
    if (isShuffleRef.current) {
      const remainingQ = q.filter(t => String(t._id || t.id) !== currentId);
      if (remainingQ.length > 0) {
        setQueue(remainingQ);
        playTrack(remainingQ[0], remainingQ);
        return;
      } else {
        // Queue is completely finished!
        // Automatically fetch and play AI smart taste recommendations so music never stops!
        triggerAutoQueue();
        return;
      }
    }

    const isSmartQueue = isSmartMoodQueueRef.current || q.some(t => t.isSmartMoodQueue);
    if (isSmartQueue) {
      if (i >= 0 && i < q.length - 1) {
        playTrack(q[i + 1], q, false, 0, false, true);
        return;
      }

      // Reached the end of smart queue! Refresh and fetch brand new tracks matching current mood & taste
      q.forEach(t => playedSmartSongIdsRef.current.add(String(t._id || t.id)));
      const pool = ((userTracks && userTracks.length > 0) ? userTracks : (INITIAL_TRACKS || []))
        .filter(t => (isCurQuran ? isQuranContent(t) : !isQuranContent(t)));
      let next10 = getSmartTasteAndMoodTracks({
        allTracks: pool,
        currentUser,
        followedArtists: currentUser?.following || [],
        likedTrackIds,
        excludeTrackIds: playedSmartSongIdsRef.current,
        limit: 30,
      });

      if (!next10 || next10.length === 0) {
        playedSmartSongIdsRef.current = new Set(currentId ? [currentId] : []);
        next10 = getSmartTasteAndMoodTracks({
          allTracks: pool,
          currentUser,
          followedArtists: currentUser?.following || [],
          likedTrackIds,
          excludeTrackIds: playedSmartSongIdsRef.current,
          limit: 30,
        });
      }

      if (next10 && next10.length > 0) {
        const tagged = next10.map(t => ({ ...t, isSmartMoodQueue: true }));
        setQueue(tagged);
        playTrack(tagged[0], tagged, false, 0, false, true);
        return;
      }
    }

    if (i >= 0 && i < q.length - 1) {
      playTrack(q[i + 1], q);
    } else if (q.length > 0) {
      // Reached the end of playlist: loop back or trigger smart autoplay so music NEVER stops
      if (repeatModeRef.current === 'all' || isMixModeRef.current) {
        playTrack(q[0], q);
      } else {
        triggerAutoQueue();
      }
    } else {
      triggerAutoQueue();
    }
  };

  const playPrevTrack = (isFromRemoteJam = false) => {
    if ((playbackStatusRef.current.currentTime || 0) > 3) {
      seekTo(0);
      return;
    }

    if (!isFromRemoteJam && jamSyncRef.current.jamSession && jamSyncRef.current.socket) {
      const roomCode = jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode;
      if (roomCode) {
        if (!canControlJam()) {
          return;
        }
        jamSyncRef.current.socket.emit('jam:prev_track', { roomCode });
        return;
      }
    }

    if (historyStackRef.current.length > 0) {
      const prev = historyStackRef.current.pop();
      isHistoryNavRef.current = true;
      playTrack(prev, queueRef.current);
      return;
    }

    let q = queueRef.current;
    if (!q || q.length === 0) {
      q = downloadedTracks.length > 0 ? downloadedTracks : [];
      if (q.length > 0) setQueue(q);
    }
    if (!q || q.length === 0) return;

    const currentId = String(currentTrackRef.current?._id || currentTrackRef.current?.id || '');
    const currentTitle = String(currentTrackRef.current?.title || '').trim().toLowerCase();
    let i = q.findIndex(t => String(t._id || t.id) === currentId);
    if (i === -1 && currentTitle) {
      i = q.findIndex(t => String(t.title || '').trim().toLowerCase() === currentTitle);
    }

    if (i > 0) playTrack(q[i - 1], q);
    else playTrack(q[q.length - 1], q);
  };

  togglePlayRef.current = togglePlay;
  playNextTrackRef.current = playNextTrack;
  playPrevTrackRef.current = playPrevTrack;
  seekToRef.current = seekTo;

  const toggleRepeat = () => {
    if (repeatMode === 'off') setRepeatMode('all');
    else if (repeatMode === 'all') setRepeatMode('one');
    else setRepeatMode('off');
  };

  const handleDownloadTrack = async (t, isSilent = false) => {
    if (!t) return;
    const id = String(t._id || t.id);
    if (await isTrackDownloaded(id)) {
      if (!isSilent) showToast(`"${t.title || 'Track'}" is already in offline vault`, 'info');
      return;
    }
    if (downloadingIds[id] !== undefined) {
      if (!isSilent) showToast(`"${t.title || 'Track'}" is already downloading...`, 'info');
      return;
    }
    try {
      if (!isSilent) {
        showToast(`Downloading "${t.title || 'Track'}" to device...`, 'info');
        setDownloadingIds(p => ({ ...p, [id]: 0 }));
      }
      let trackToDownload = { ...t };
      if (currentTrackRef.current && String(currentTrackRef.current._id || currentTrackRef.current.id) === id) {
        if (currentTrackRef.current.resolvedAudioUrl) {
          trackToDownload.resolvedAudioUrl = currentTrackRef.current.resolvedAudioUrl;
        }
        if (currentTrackRef.current.duration) {
          trackToDownload.duration = currentTrackRef.current.duration;
        }
      }
      await downloadTrack(trackToDownload, (prog) => {
        if (!isSilent) setDownloadingIds(p => ({ ...p, [id]: prog }));
      });
      await refreshDownloadedTracks();
      if (!isSilent) showToast(`"${t.title || 'Track'}" saved to offline vault`, 'success');
    } catch (err) {
      if (!isSilent) showToast(`Download failed: ${err?.message || 'Could not save track'}`, 'error');
    } finally {
      if (!isSilent) setDownloadingIds(p => { const c = { ...p }; delete c[id]; return c; });
    }
  };

  const handleDownloadPlaylist = async (tracksToDownload) => {
    if (!tracksToDownload || tracksToDownload.length === 0) return;
    const wasPlayingBeforeDownload = isPlayingRef.current;
    try {
      // Keep foreground notification and wakeLock active so OS does not freeze JS or network
      updateMediaNotification(true, 'off', false, false, {
        title: `Downloading Playlist (${tracksToDownload.length} tracks)`,
        artist: 'Rivo Vault • Keep in Background',
        duration: tracksToDownload.length * 60,
        currentTime: 0
      });
      for (let idx = 0; idx < tracksToDownload.length; idx++) {
        const track = tracksToDownload[idx];
        updateMediaNotification(true, 'off', false, false, {
          title: `Downloading (${idx + 1}/${tracksToDownload.length}): ${track.title || 'Track'}`,
          artist: track.artist || 'Rivo Vault',
          duration: tracksToDownload.length,
          currentTime: idx + 1
        });
        await handleDownloadTrack(track, false);
        await new Promise(r => setTimeout(r, 300));
      }
      showToast('All tracks downloaded offline', 'info');
    } finally {
      if (!wasPlayingBeforeDownload && !isPlayingRef.current) {
        hideMediaNotification();
      } else if (currentTrackRef.current) {
        const cur = currentTrackRef.current;
        const isLikedTrack = likedTrackIds.some(id => String(id) === String(cur._id || cur.id));
        updateMediaNotification(isPlayingRef.current, repeatModeRef.current, isShuffleRef.current, isLikedTrack, cur);
      }
    }
  };

  const syncFromOnlineTrack = useCallback(({ track, isPlaying: onlinePlaying, currentTime: onlineTime, duration: onlineDur }) => {
    if (track) {
      const prevTrack = currentTrackRef.current;
      const isNewTrack = !prevTrack || String(prevTrack._id || prevTrack.id || prevTrack.title) !== String(track._id || track.id || track.title);
      currentTrackRef.current = track;
      setCurrentTrackState(track);
      isPlayingRef.current = Boolean(onlinePlaying);
      setIsPlaying(Boolean(onlinePlaying));
      if (onlineTime !== undefined && onlineDur !== undefined) {
        setProgress({ currentTime: onlineTime, duration: onlineDur });
      }

      // Broadcast to Jam Room if active and collaborative control permits
      if (isNewTrack && jamSyncRef.current.jamSession && jamSyncRef.current.socket && canControlJam()) {
        const roomCode = String(jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode || '').trim().toUpperCase();
        if (roomCode) {
          jamSyncRef.current.socket.emit('jam:sync_play_state', {
            roomCode,
            isPlaying: Boolean(onlinePlaying),
            currentTrack: track,
            currentTime: Number(onlineTime || 0),
            initiatorId: jamSyncRef.current.socket.id,
            userId: currentUser?._id || currentUser?.id,
            isUserAction: true,
            userAction: 'play_track',
          });
        }
      }
    }
  }, [canControlJam, currentUser]);

  const pauseNativePlayback = useCallback(async () => {
    try {
      shouldBePlayingRef.current = false;
      if (soundRef.current) {
        await soundRef.current.pauseAsync().catch(() => {});
        isPlayingRef.current = false;
        setIsPlaying(false);
      }
    } catch (e) {}
  }, []);

  const syncRemotePlayState = useCallback(async ({ isPlaying: syncPlaying, currentTrack: syncTrack, currentTime: syncTime, updatedAt, serverTime, isPeriodic, isSeek, userAction }) => {
    let targetTime = Number(syncTime) || 0;
    const refTimestamp = Number(updatedAt || serverTime || 0);
    if (syncPlaying && refTimestamp > 0) {
      const elapsed = (Date.now() - refTimestamp) / 1000;
      // Clamp to network transit latency (0 - 0.8s), preventing multi-second device clock skew
      if (elapsed > 0 && elapsed < 0.8) {
        targetTime += elapsed;
      }
    }

    const cur = currentTrackRef.current;
    const curLoadedId = loadedTrackIdRef.current;
    const syncTrackId = syncTrack ? String(syncTrack._id || syncTrack.id) : null;
    const isDifferentTrack = Boolean(syncTrackId && (!curLoadedId || syncTrackId !== curLoadedId));
    const nowTime = Date.now();

    // ⚡ EXPLICIT USER SEEK: Both Host and Guests MUST seek immediately (zero deadband, zero cooldown)
    if (isSeek || userAction === 'seek') {
      lastRemoteSeekRef.current = nowTime;
      if (jamSyncRef.current.jamSession) {
        jamSyncRef.current.jamSession.currentTime = targetTime;
        jamSyncRef.current.jamSession.updatedAt = Date.now();
        if (syncPlaying !== undefined) jamSyncRef.current.jamSession.isPlaying = Boolean(syncPlaying);
        if (syncTrack) jamSyncRef.current.jamSession.currentTrack = syncTrack;
        setJamSessionState({ ...jamSyncRef.current.jamSession });
      }
      progressRef.current = { ...progressRef.current, currentTime: targetTime };
      setProgress(p => ({ ...p, currentTime: targetTime }));
      if (syncPlaying !== undefined) {
        shouldBePlayingRef.current = Boolean(syncPlaying);
        isPlayingRef.current = Boolean(syncPlaying);
        setIsPlaying(Boolean(syncPlaying));
      }
      await seekTo(targetTime, true /* isRemote */);
      return;
    }

    // ONLY debounce duplicate background periodic clock emissions occurring within 350ms for same track and position.
    // NEVER debounce user-initiated actions (play, pause) or play-state transitions!
    const isStateTransition = (syncPlaying !== undefined && Boolean(syncPlaying) !== isPlayingRef.current);
    const isUserAction = Boolean(userAction || !isPeriodic);
    if (!isUserAction && !isStateTransition && !isDifferentTrack && Math.abs(targetTime - (lastSyncPayloadRef.current.time || 0)) < 0.5 && (nowTime - (lastSyncPayloadRef.current.timestamp || 0) < 350)) {
      return;
    }
    lastSyncPayloadRef.current = { time: targetTime, trackId: syncTrackId || '', timestamp: nowTime };

    // ── IF REMOTE STATE IS PAUSED: Pause immediately without seeking or re-triggering! ──
    if (syncPlaying === false) {
      shouldBePlayingRef.current = false;
      setIsPlaying(false);
      isPlayingRef.current = false;
      if (soundRef.current) {
        try {
          await soundRef.current.pauseAsync();
        } catch {}
      }
      if (syncTrack) {
        setCurrentTrack(syncTrack);
      }
      if (targetTime !== undefined) {
        progressRef.current = { ...progressRef.current, currentTime: Math.max(0, targetTime) };
        setProgress(p => ({ ...p, currentTime: Math.max(0, targetTime) }));
      }
      if (jamSyncRef.current.jamSession) {
        jamSyncRef.current.jamSession.isPlaying = false;
        if (syncTrack) jamSyncRef.current.jamSession.currentTrack = syncTrack;
        jamSyncRef.current.jamSession.currentTime = targetTime;
        jamSyncRef.current.jamSession.updatedAt = Date.now();
        setJamSessionState({ ...jamSyncRef.current.jamSession });
      }
      const trackForNotif = syncTrack || cur;
      if (trackForNotif) {
        const isLikedTrack = likedTrackIds.some(id => String(id) === String(trackForNotif._id || trackForNotif.id));
        updateMediaNotification(false, repeatModeRef.current, isShuffleRef.current, isLikedTrack, {
          ...trackForNotif,
          currentTime: targetTime !== undefined ? targetTime : (playbackStatusRef.current?.currentTime || 0),
          duration: playbackStatusRef.current?.duration || Number(trackForNotif?.duration || 240)
        });
      }
      return;
    }

    // ── REMOTE STATE IS PLAYING: Resume playback for ALL parties (Host and Member) ──
    shouldBePlayingRef.current = true;
    isPlayingRef.current = true;
    setIsPlaying(true);

    if (jamSyncRef.current.jamSession) {
      jamSyncRef.current.jamSession.isPlaying = true;
      if (syncTrack) jamSyncRef.current.jamSession.currentTrack = syncTrack;
      if (targetTime !== undefined) jamSyncRef.current.jamSession.currentTime = targetTime;
      jamSyncRef.current.jamSession.updatedAt = Date.now();
      setJamSessionState({ ...jamSyncRef.current.jamSession });
    }

    if (isDifferentTrack || !soundRef.current) {
      await playTrack(syncTrack || cur, null, false /* isRetry */, targetTime, true /* isRemote */);
    } else {
      // Sound is already loaded: resume audio playback immediately!
      try {
        await soundRef.current.playAsync();
      } catch (e) {
        // Fallback: If playAsync failed or sound was unloaded, re-load and play
        await playTrack(syncTrack || cur, null, false, targetTime, true);
      }

      // Host is master playback source: ignore periodic background clock sync of the same track!
      if (isPeriodic && isJamHost()) {
        return;
      }

      // Guest: sync drift only if severe. In first 15s, ignore drift <= 8s to let buffer settle
      const localCur = playbackStatusRef.current?.currentTime || 0;
      const drift = Math.abs((targetTime || 0) - localCur);
      const isStartPhase = (targetTime || 0) < 15 || localCur < 15;
      const driftThreshold = isStartPhase ? 8.0 : 3.5;

      if (!isJamHost() && targetTime !== undefined && drift > driftThreshold && (nowTime - (lastRemoteSeekRef.current || 0) > 4500)) {
        lastRemoteSeekRef.current = nowTime;
        seekTo(targetTime, true);
      }

      const trackToUse = syncTrack || cur;
      if (trackToUse) {
        const isLikedTrack = likedTrackIds.some(id => String(id) === String(trackToUse._id || trackToUse.id));
        updateMediaNotification(true, repeatModeRef.current, isShuffleRef.current, isLikedTrack, {
          ...trackToUse,
          currentTime: targetTime !== undefined ? targetTime : (playbackStatusRef.current?.currentTime || 0),
          duration: playbackStatusRef.current?.duration || Number(trackToUse?.duration || 240)
        });
      }
    }
  }, [playTrack, seekTo, likedTrackIds, isJamHost]);

  const controls = useMemo(() => ({
    currentTrack, isPlaying, isLoading, isShuffle, repeatMode, isOfflineMode, downloadedTracks, downloadingIds, queue, progress: progressRef.current,
    tracks: queue.length > 0 ? queue : INITIAL_TRACKS,
    sleepTimerRemaining, lyrics, isLoadingLyrics, setLyrics, volume, setVolume,

    isVocalOnly, setIsVocalOnly, toggleVocalOnly, vocalIsolationStatus, isMixMode, setIsMixMode, mixDuration, setMixDuration, mixStyle, setMixStyle, triggerManualMix, activeTransitions, setActiveTransitions,
    playTrack, playPlaylist, togglePlay, seekTo, isShuffle, setIsShuffle, toggleShuffle, toggleRepeat, playNextTrack, playPrevTrack,
    addToQueue, addMultipleToQueue, setQueue, removeFromQueue, reorderQueue, clearQueue,
    startSleepTimer, cancelSleepTimer,
    handleDownloadTrack, handleDownloadPlaylist, removeDownloadedTrack, removeDownloadedTracksBatch, refreshDownloadedTracks,
    registerFullPlayerHandler, openFullPlayer,
    autoDownloadFinished, toggleAutoDownloadFinished,
    downloadedTrackIds, isTrackDownloaded,
    syncFromOnlineTrack, pauseNativePlayback, syncRemotePlayState,
    jamSession, setJamSync,
    remoteDevicePlayback,
  }), [currentTrack, isPlaying, isLoading, isShuffle, repeatMode, isOfflineMode, downloadedTracks, downloadedTrackIds, isTrackDownloaded, downloadingIds, queue, sleepTimerRemaining, lyrics, isLoadingLyrics, setLyrics, volume, setVolume, isVocalOnly, vocalIsolationStatus, isMixMode, mixDuration, mixStyle, activeTransitions, autoDownloadFinished, toggleAutoDownloadFinished, syncFromOnlineTrack, pauseNativePlayback, syncRemotePlayState, jamSession, setJamSync, remoteDevicePlayback, removeDownloadedTrack, removeDownloadedTracksBatch, registerFullPlayerHandler, openFullPlayer]);

  return (
    <AudioContext.Provider value={controls}>
      <AudioProgressContext.Provider value={progress}>
        {children}
      </AudioProgressContext.Provider>
    </AudioContext.Provider>
  );
};

export const useAudioPlayer = () => useContext(AudioContext);
export const useAudioProgress = () => useContext(AudioProgressContext);
