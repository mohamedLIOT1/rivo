import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { INITIAL_TRACKS } from '../data/initialTracks';
import { downloadTrack, getDownloadedTracks, removeDownloadedTrack, isTrackDownloaded } from '../services/downloadManager';
import { resolveAudioStream } from '../services/youtubeResolver';
import { showMediaNotification, updateMediaNotification, hideMediaNotification, subscribeToMediaActions } from '../services/mediaControls';
import { useConnectivity } from './ConnectivityContext';
import { useToast } from './ToastContext';
import { useUser } from './UserContext';
import { parseLrcLyrics } from '../../utils/lrcParser';

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

  const { showToast } = useToast();
  const conn = useConnectivity();
  const isOffline = conn?.appMode === 'offline';

  let userCtx = {};
  try {
    userCtx = useUser() || {};
  } catch {}
  const { token, currentUser, likedTrackIds = [], toggleLikeTrack } = userCtx;

  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

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
  const [volume, setVolumeState] = useState(0.8);
  const volumeRef = useRef(0.8);

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

  const removeFromQueue = (trackId) => {
    const newQ = queueRef.current.filter(t => String(t._id || t.id) !== String(trackId));
    setQueue(newQ);
  };

  const clearQueue = () => {
    setQueue([]);
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
        if (soundRef.current) {
          soundRef.current.pauseAsync().catch(() => {});
          setIsPlaying(false);
          updateMediaNotification(false, repeatMode !== 'off', isShuffle, currentTrackRef.current);
        }
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

  const refreshDownloadedTracks = async () => {
    try {
      const list = await getDownloadedTracks();
      setDownloadedTracks(list || []);
    } catch {}
  };

  const onPlaybackStatusUpdate = (status) => {
    if (!status.isLoaded) return;
    if (isPlaying !== status.isPlaying) {
      setIsPlaying(status.isPlaying);
      const isLikedTrack = currentTrackRef.current ? likedTrackIds.some(id => String(id) === String(currentTrackRef.current._id || currentTrackRef.current.id)) : false;
      updateMediaNotification(status.isPlaying, repeatMode, isShuffle, isLikedTrack, currentTrackRef.current);
    }

    const newCurrentTime = Math.floor(status.positionMillis / 1000);
    const newDuration = Math.floor((status.durationMillis || 0) / 1000);

    if (playbackStatusRef.current.currentTime !== newCurrentTime) {
      playbackStatusRef.current = { ...playbackStatusRef.current, currentTime: newCurrentTime, duration: newDuration };
      setProgress({ currentTime: newCurrentTime, duration: newDuration });
    }

    if (status.didJustFinish) {
      const finishedTrack = currentTrackRef.current;
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

      if (repeatMode === 'one') {
        if (soundRef.current) soundRef.current.replayAsync().catch(() => {});
      } else {
        if (playNextTrackRef.current) playNextTrackRef.current();
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
          if (!isNaN(secs) && seekToRef.current) seekToRef.current(secs);
          return;
        }
        const cur = currentTrackRef.current;
        const isLikedTrack = cur ? likedTrackIds.some(id => String(id) === String(cur._id || cur.id)) : false;

        switch (action) {
          case 'play':
            if (soundRef.current) {
              await soundRef.current.playAsync().catch(() => {});
              setIsPlaying(true);
              updateMediaNotification(true, repeatModeRef.current, isShuffleRef.current, isLikedTrack, currentTrackRef.current);
            } else if (togglePlayRef.current) {
              togglePlayRef.current();
            }
            break;
          case 'pause':
            if (soundRef.current) {
              await soundRef.current.pauseAsync().catch(() => {});
              setIsPlaying(false);
              updateMediaNotification(false, repeatModeRef.current, isShuffleRef.current, isLikedTrack, currentTrackRef.current);
            } else if (togglePlayRef.current) {
              togglePlayRef.current();
            }
            break;
          case 'play_pause':
            if (soundRef.current) {
              if (isPlayingRef.current) {
                await soundRef.current.pauseAsync().catch(() => {});
                setIsPlaying(false);
                updateMediaNotification(false, repeatModeRef.current, isShuffleRef.current, isLikedTrack, currentTrackRef.current);
              } else {
                await soundRef.current.playAsync().catch(() => {});
                setIsPlaying(true);
                updateMediaNotification(true, repeatModeRef.current, isShuffleRef.current, isLikedTrack, currentTrackRef.current);
              }
            } else if (togglePlayRef.current) {
              togglePlayRef.current();
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

    if (currentTrack.lyrics) {
      const parsed = parseLrcLyrics(currentTrack.lyrics);
      if (parsed.length > 0) {
        setLyrics(parsed);
        return;
      }
    }

    // Check offline vault for saved lyrics
    const dl = (downloadedTracks || []).find(t => String(t._id || t.id) === String(currentTrack._id || currentTrack.id));
    if (dl?.lyrics) {
      const parsed = parseLrcLyrics(dl.lyrics);
      if (parsed.length > 0) {
        setLyrics(parsed);
        return;
      }
    }

    // Never generate AI lyrics for local files or downloaded tracks or offline mode
    if (isOffline || currentTrack.isLocalImport || currentTrack.localAudioUri || currentTrack.downloaded || dl) {
      setLyrics([]);
      return;
    }

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
            setLyrics(data.lyrics);
            return;
          }
        }

        // Fallback: request AI generation if no lyrics found
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

  const playTrack = async (track, trackList = [], isRetry = false) => {
    if (!track) return;

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
    const requestTs = Date.now();
    playbackStatusRef.current.lastRequestTs = requestTs;

    try {
      setIsLoading(true);

      setCurrentTrack(track);
      if (Array.isArray(trackList) && trackList.length > 0) setQueue(trackList);

      if (soundRef.current) {
        const s = soundRef.current;
        soundRef.current = null;
        await s.stopAsync().catch(() => {});
        await s.unloadAsync().catch(() => {});
      }

      // Prioritize local downloaded version in Online Mode to save mobile data:
      // Match by trackId OR clean title + artist in offline vault
      const cleanTitle = (track.title || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').trim();
      const cleanArtist = (track.artist || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').trim();

      const local = (downloadedTracks || []).find(t => {
        if (trackId && String(t._id || t.id) === trackId) return true;
        const tTitle = (t.title || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').trim();
        const tArtist = (t.artist || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').trim();
        return cleanTitle && tTitle && cleanTitle === tTitle && (!cleanArtist || !tArtist || cleanArtist === tArtist);
      });

      let uri = local?.nativeAudioUri || local?.localAudioUri || local?.audioUrl || track.nativeAudioUri || track.localAudioUri;

      // Direct check on physical storage by trackId (detects local files on device even if not yet in state)
      if (!uri || !uri.startsWith('file://')) {
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

      if (!uri) {
        if (isOffline) {
          setIsLoading(false);
          showToast(`"${track.title || 'Track'}" is not cached offline`, 'warning');
          return;
        }
        uri = await resolveAudioStream(track);
      }

      if (!uri) throw new Error('Could not resolve audio stream');
      if (uri.startsWith('/')) uri = `${API_BASE_URL}${uri}`;

      if (playbackStatusRef.current.lastRequestTs !== requestTs) {
        return;
      }

      const soundSource = uri.startsWith('file://')
        ? { uri }
        : {
            uri,
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
              'Accept': '*/*',
            },
          };

      const { sound } = await Audio.Sound.createAsync(
        soundSource,
        { shouldPlay: true, progressUpdateIntervalMillis: 250 },
        onPlaybackStatusUpdate
      );

      if (playbackStatusRef.current.lastRequestTs !== requestTs) {
        await sound.unloadAsync().catch(() => {});
        return;
      }

      soundRef.current = sound;
      if (volumeRef.current !== undefined) {
        await sound.setVolumeAsync(volumeRef.current).catch(() => {});
      }
      setIsPlaying(true);
      setIsLoading(false);
      try {
        const isLikedTrack = track ? likedTrackIds.some(id => String(id) === String(track._id || track.id)) : false;
        showMediaNotification({
          ...track,
          duration: Number(track.duration || (playbackStatusRef.current?.duration || 240)),
          coverUrl: track.coverUrl || track.cover || '',
          currentTime: 0,
          liked: isLikedTrack,
        }, true, repeatMode, isShuffle, isLikedTrack);
      } catch {}
      broadcastListeningActivity(track, true, 0);
    } catch (err) {
      setIsLoading(false);
      if (!isRetry && !isOffline) {
        return playTrack(track, trackList, true);
      } else {
        showToast(`Could not play: ${track?.title || 'Track'}`, 'error');
      }
    }
  };

  const playPlaylist = async (playlistTracks, startIndex = 0) => {
    if (!Array.isArray(playlistTracks) || playlistTracks.length === 0) return;
    const safeIndex = Math.max(0, Math.min(startIndex, playlistTracks.length - 1));
    const targetTrack = playlistTracks[safeIndex];
    setQueue(playlistTracks);
    return playTrack(targetTrack, playlistTracks);
  };

  const togglePlay = async () => {
    if (isLoading || isResolvingRef.current) return;
    if (!soundRef.current) {
      if (currentTrackRef.current) return playTrack(currentTrackRef.current, queueRef.current);
      if (queueRef.current.length > 0) return playTrack(queueRef.current[0], queueRef.current);
      return;
    }
    const isLikedTrack = currentTrackRef.current ? likedTrackIds.some(id => String(id) === String(currentTrackRef.current._id || currentTrackRef.current.id)) : false;
    if (isPlaying) {
      await soundRef.current.pauseAsync().catch(() => {});
      setIsPlaying(false);
      updateMediaNotification(false, repeatMode, isShuffle, isLikedTrack, currentTrackRef.current);
      broadcastListeningActivity(currentTrackRef.current, false, playbackStatusRef.current?.currentTime || 0);
    } else {
      await soundRef.current.playAsync().catch(() => {});
      setIsPlaying(true);
      updateMediaNotification(true, repeatMode, isShuffle, isLikedTrack, currentTrackRef.current);
      broadcastListeningActivity(currentTrackRef.current, true, playbackStatusRef.current?.currentTime || 0);
    }
  };

  const seekTo = async (secs) => {
    if (!soundRef.current) return;
    const safeSecs = Math.max(0, Number(secs) || 0);
    await soundRef.current.setPositionAsync(safeSecs * 1000).catch(() => {});
    setProgress(p => ({ ...p, currentTime: safeSecs }));
    broadcastListeningActivity(currentTrackRef.current, isPlayingRef.current, safeSecs);
  };

  const playNextTrack = () => {
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

    if (isShuffle) {
      let nextIdx = Math.floor(Math.random() * q.length);
      if (q.length > 1 && nextIdx === i) {
        nextIdx = (nextIdx + 1) % q.length;
      }
      playTrack(q[nextIdx], q);
    } else if (i >= 0 && i < q.length - 1) {
      playTrack(q[i + 1], q);
    } else if (q.length > 0) {
      playTrack(q[0], q);
    }
  };

  const playPrevTrack = () => {
    if ((playbackStatusRef.current.currentTime || 0) > 3) {
      seekTo(0);
      return;
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
      await downloadTrack(t, (prog) => {
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
    for (const track of tracksToDownload) {
      await handleDownloadTrack(track, false);
      await new Promise(r => setTimeout(r, 400));
    }
    showToast('All tracks downloaded offline', 'info');
  };

  const syncFromOnlineTrack = useCallback(({ track, isPlaying: onlinePlaying, currentTime: onlineTime, duration: onlineDur }) => {
    if (track) {
      currentTrackRef.current = track;
      setCurrentTrackState(track);
      isPlayingRef.current = Boolean(onlinePlaying);
      setIsPlaying(Boolean(onlinePlaying));
      if (onlineTime !== undefined && onlineDur !== undefined) {
        setProgress({ currentTime: onlineTime, duration: onlineDur });
      }
    }
  }, []);

  const pauseNativePlayback = useCallback(async () => {
    try {
      if (soundRef.current) {
        await soundRef.current.pauseAsync();
        isPlayingRef.current = false;
        setIsPlaying(false);
      }
    } catch (e) {}
  }, []);

  const controls = useMemo(() => ({
    currentTrack, isPlaying, isLoading, isShuffle, repeatMode, isOfflineMode, downloadedTracks, downloadingIds, queue, progress,
    tracks: queue.length > 0 ? queue : INITIAL_TRACKS,
    sleepTimerRemaining, lyrics, isLoadingLyrics, volume, setVolume,
    playTrack, playPlaylist, togglePlay, seekTo, setIsShuffle, toggleRepeat, playNextTrack, playPrevTrack,
    addToQueue, addMultipleToQueue, setQueue, removeFromQueue, clearQueue,
    startSleepTimer, cancelSleepTimer,
    handleDownloadTrack, handleDownloadPlaylist, removeDownloadedTrack, refreshDownloadedTracks,
    autoDownloadFinished, toggleAutoDownloadFinished,
    syncFromOnlineTrack, pauseNativePlayback,
  }), [currentTrack, isPlaying, isLoading, isShuffle, repeatMode, isOfflineMode, downloadedTracks, downloadingIds, queue, progress, sleepTimerRemaining, lyrics, isLoadingLyrics, volume, setVolume, autoDownloadFinished, toggleAutoDownloadFinished, syncFromOnlineTrack, pauseNativePlayback]);

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
