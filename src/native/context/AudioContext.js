import React, { createContext, useContext, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AppState } from 'react-native';
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
import { getSmartTasteAndMoodTracks } from '../utils/tasteAlgorithm';
import { isQuranContent } from '../../utils/quranUtils';

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
  const shouldBePlayingRef = useRef(false);

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

  const jamSyncRef = useRef({ socket: null, jamSession: null });
  const [jamSession, setJamSessionState] = useState(null);
  const [remoteDevicePlayback, setRemoteDevicePlayback] = useState(null);

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
          if (jamSyncRef.current.jamSession?.isHost) {
            socket.emit('jam:report_host_time', {
              roomCode: jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode,
              currentTime: playbackStatusRef.current?.currentTime || 0,
              isPlaying: isPlayingRef.current,
              currentTrack: currentTrackRef.current,
              requesterSocketId
            });
          }
        });

        // Cross-device connect sync (Spotify Connect: Auto-pause this device if other device plays)
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
  }, []);

  const isJamHost = useCallback(() => {
    if (jamSyncRef.current?.isHost) return true;
    const session = jamSyncRef.current?.jamSession;
    const sock = jamSyncRef.current?.socket;
    if (!session || !sock) return false;
    const myId = currentUser?._id ? String(currentUser._id) : (currentUser?.id ? String(currentUser.id) : sock.id);
    if (session.hostId && session.hostId === sock.id) return true;
    if (session.hostUserId && (String(session.hostUserId) === myId || (currentUser?._id && String(session.hostUserId) === String(currentUser._id)) || (currentUser?.id && String(session.hostUserId) === String(currentUser.id)))) return true;
    if (Array.isArray(session.members)) {
      return session.members.some(m =>
        (m.socketId === sock.id || (myId && String(m.id || m._id) === myId) || (currentUser?._id && String(m.id || m._id) === String(currentUser._id)) || (currentUser?.id && String(m.id || m._id) === String(currentUser.id))) && m.isHost
      );
    }
    return false;
  }, [currentUser]);

  // Automatic periodic drift correction for Jam sessions (every 3 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      const session = jamSyncRef.current.jamSession;
      if (!session || !session.isPlaying || !isPlayingRef.current || !soundRef.current || isSeekingRef.current) return;

      let expectedTime = Number(session.currentTime) || 0;
      if (session.updatedAt) {
        const elapsed = (Date.now() - session.updatedAt) / 1000;
        if (elapsed > 0 && elapsed < 3600) expectedTime += elapsed;
      }

      const localTime = playbackStatusRef.current?.currentTime || 0;
      if (Math.abs(expectedTime - localTime) > 2.0 && soundRef.current) {
        soundRef.current.setPositionAsync(Math.round(expectedTime * 1000)).catch(() => {});
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

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

  const refreshDownloadedTracks = async () => {
    try {
      const list = await getDownloadedTracks();
      setDownloadedTracks(list || []);
    } catch {}
  };

  const onPlaybackStatusUpdate = (status) => {
    if (!status.isLoaded) return;

    // Hard safeguard: If playback should be paused, immediately kill any rogue playing state
    if (!shouldBePlayingRef.current && status.isPlaying) {
      if (soundRef.current) {
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
        shouldBePlayingRef.current = status.isPlaying;
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

    const newCurrentTime = Math.floor(status.positionMillis / 1000);
    const newDuration = Math.floor((status.durationMillis || 0) / 1000);

    if (playbackStatusRef.current.currentTime !== newCurrentTime) {
      playbackStatusRef.current = { ...playbackStatusRef.current, currentTime: newCurrentTime, duration: newDuration };
      setProgress({ currentTime: newCurrentTime, duration: newDuration });

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

      // Periodically sync live playback time with other devices (Spotify Connect)
      if (isPlayingRef.current && Math.abs(newCurrentTime - (playbackStatusRef.current._lastDeviceSync || 0)) >= 2) {
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
    }

    if (status.didJustFinish && ((status.positionMillis || 0) > 1000 || (status.durationMillis || 0) > 1000)) {
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

      if (repeatModeRef.current === 'one') {
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
            if (jamSyncRef.current.jamSession && jamSyncRef.current.socket) {
              const rCode = String(jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode || '').trim().toUpperCase();
              if (rCode) {
                jamSyncRef.current.socket.emit('jam:sync_play_state', {
                  roomCode: rCode,
                  isPlaying: true,
                  currentTrack: cur,
                  currentTime: playbackStatusRef.current?.currentTime || 0,
                  initiatorId: jamSyncRef.current.socket.id,
                  userId: currentUser?._id || currentUser?.id,
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
            if (jamSyncRef.current.jamSession && jamSyncRef.current.socket) {
              const rCode = String(jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode || '').trim().toUpperCase();
              if (rCode) {
                jamSyncRef.current.socket.emit('jam:sync_play_state', {
                  roomCode: rCode,
                  isPlaying: false,
                  currentTrack: cur,
                  currentTime: playbackStatusRef.current?.currentTime || 0,
                  initiatorId: jamSyncRef.current.socket.id,
                  userId: currentUser?._id || currentUser?.id,
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
              if (jamSyncRef.current.jamSession && jamSyncRef.current.socket) {
                const rCode = String(jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode || '').trim().toUpperCase();
                if (rCode) {
                  jamSyncRef.current.socket.emit('jam:sync_play_state', {
                    roomCode: rCode,
                    isPlaying: nextState,
                    currentTrack: cur,
                    currentTime: curPos,
                    initiatorId: jamSyncRef.current.socket.id,
                    userId: currentUser?._id || currentUser?.id,
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

  const playTrack = async (track, trackList = [], isRetry = false, targetTime = 0, isRemote = false, isSmartMood = false, autoPlay = true) => {
    if (!track) return;
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
    const requestTs = Date.now();
    const connectStartTime = Date.now();
    const safeTargetSec = Math.max(0, Number(targetTime) || 0);

    playbackStatusRef.current = {
      currentTime: safeTargetSec,
      duration: Number(track.duration || 0),
      lastRequestTs: requestTs,
    };
    setProgress({ currentTime: safeTargetSec, duration: Number(track.duration || 0) });

    try {
      setIsLoading(true);

      setCurrentTrack(track);
      if (Array.isArray(trackList) && trackList.length > 0) {
        const tId = String(track._id || track.id);
        const idx = trackList.findIndex(t => String(t._id || t.id) === tId);
        const startIdx = idx >= 0 ? idx : 0;
        const capped = trackList.slice(startIdx, startIdx + 10);
        setQueue(capped.length > 0 ? capped : [track]);
      }

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

      const soundSource = { uri };

      const initialPosMs = Math.round(safeTargetSec * 1000);
      const willPlay = Boolean(autoPlay && shouldBePlayingRef.current);
      const { sound } = await Audio.Sound.createAsync(
        soundSource,
        {
          shouldPlay: willPlay,
          positionMillis: initialPosMs > 0 ? initialPosMs : 0,
          progressUpdateIntervalMillis: 250,
        },
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

      // If user/remote paused while sound was creating:
      if (!autoPlay || !shouldBePlayingRef.current) {
        await sound.pauseAsync().catch(() => {});
        setIsPlaying(false);
        isPlayingRef.current = false;
        setIsLoading(false);
        return;
      }

      // If playing with target time, compensate for stream connect delay so it stays in exact sync!
      if (safeTargetSec > 0) {
        const streamConnectElapsed = (Date.now() - connectStartTime) / 1000;
        const compensatedTargetSec = safeTargetSec + Math.min(streamConnectElapsed, 8);
        await sound.setPositionAsync(Math.round(compensatedTargetSec * 1000)).catch(() => {});
      }

      setIsPlaying(true);
      isPlayingRef.current = true;
      setIsLoading(false);

      if (!isRemote && jamSyncRef.current.jamSession && jamSyncRef.current.socket) {
        const roomCode = jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode;
        if (roomCode) {
          jamSyncRef.current.socket.emit('jam:sync_play_state', {
            roomCode,
            isPlaying: true,
            currentTrack: track,
            currentTime: safeTargetSec,
            initiatorId: jamSyncRef.current.socket.id,
            userId: currentUser?._id || currentUser?.id,
          });
        }
      }

      if (!isRemote && jamSyncRef.current.socket) {
        jamSyncRef.current.socket.emit('device:playback_state', {
          isPlaying: true,
          track,
          currentTime: safeTargetSec,
          deviceType: 'mobile',
          deviceName: Platform.OS === 'ios' ? 'iPhone' : 'Android'
        });
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
      setIsLoading(false);
      if (!isRetry && !isOffline) {
        return playTrack(track, trackList, true);
      } else {
        showToast(`Could not play: ${track?.title || 'Track'}`, 'error');
      }
    }
  };

  const playPlaylist = async (playlistOrTracks, startIndex = 0) => {
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
    const cappedList = list.slice(safeIndex, safeIndex + 10);
    setQueue(cappedList);
    return playTrack(targetTrack, cappedList);
  };

  const togglePlay = async (isRemote = false) => {
    if (isLoading || isResolvingRef.current) return;
    if (!soundRef.current) {
      if (currentTrackRef.current) return playTrack(currentTrackRef.current, queueRef.current);
      if (queueRef.current.length > 0) return playTrack(queueRef.current[0], queueRef.current);
      return;
    }
    const isLikedTrack = currentTrackRef.current ? likedTrackIds.some(id => String(id) === String(currentTrackRef.current._id || currentTrackRef.current.id)) : false;
    const nextPlaying = !isPlaying;
    shouldBePlayingRef.current = nextPlaying;
    const curPos = playbackStatusRef.current?.currentTime || 0;
    const curDur = playbackStatusRef.current?.duration || Number(currentTrackRef.current?.duration || 240);

    if (isPlaying) {
      await soundRef.current.pauseAsync().catch(() => {});
      setIsPlaying(false);
      isPlayingRef.current = false;
      updateMediaNotification(false, repeatMode, isShuffle, isLikedTrack, {
        ...currentTrackRef.current,
        currentTime: curPos,
        duration: curDur,
      });
      broadcastListeningActivity(currentTrackRef.current, false, curPos);
    } else {
      await soundRef.current.playAsync().catch(() => {});
      setIsPlaying(true);
      isPlayingRef.current = true;
      updateMediaNotification(true, repeatMode, isShuffle, isLikedTrack, {
        ...currentTrackRef.current,
        currentTime: curPos,
        duration: curDur,
      });
      broadcastListeningActivity(currentTrackRef.current, true, curPos);
    }

    if (!isRemote && jamSyncRef.current.jamSession && jamSyncRef.current.socket) {
      const roomCode = String(jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode || '').trim().toUpperCase();
      if (roomCode) {
        jamSyncRef.current.socket.emit('jam:sync_play_state', {
          roomCode,
          isPlaying: nextPlaying,
          currentTrack: currentTrackRef.current,
          currentTime: curPos,
          initiatorId: jamSyncRef.current.socket.id,
          userId: currentUser?._id || currentUser?.id,
        });
      }
    }

    if (!isRemote && jamSyncRef.current.socket) {
      jamSyncRef.current.socket.emit('device:playback_state', {
        isPlaying: nextPlaying,
        track: currentTrackRef.current,
        currentTime: curPos || 0,
        deviceType: 'mobile',
        deviceName: Platform.OS === 'ios' ? 'iPhone' : 'Android'
      });
    }
  };

  const seekTo = async (secs, isRemote = false) => {
    if (!soundRef.current) return;
    const safeSecs = Math.max(0, Number(secs) || 0);
    const wasPlaying = isPlayingRef.current;
    isSeekingRef.current = true;
    try {
      await soundRef.current.setPositionAsync(safeSecs * 1000);
      if (wasPlaying) {
        await soundRef.current.playAsync().catch(() => {});
      }
    } catch {} finally {
      setTimeout(() => {
        isSeekingRef.current = false;
      }, 400);
    }
    setProgress(p => ({ ...p, currentTime: safeSecs }));
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

    if (!isRemote && jamSyncRef.current.jamSession && jamSyncRef.current.socket) {
      const roomCode = String(jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode || '').trim().toUpperCase();
      if (roomCode) {
        jamSyncRef.current.socket.emit('jam:sync_play_state', {
          roomCode,
          isPlaying: wasPlaying,
          currentTrack: currentTrackRef.current,
          currentTime: safeSecs,
          initiatorId: jamSyncRef.current.socket.id,
          userId: currentUser?._id || currentUser?.id,
        });
      }
    }
  };

  const playNextTrack = () => {
    // 1. Advance shared room queue if active in Jam
    if (jamSyncRef.current.jamSession && jamSyncRef.current.socket) {
      const roomCode = jamSyncRef.current.jamSession.code || jamSyncRef.current.jamSession.roomCode;
      if (roomCode) {
        if (jamSyncRef.current.jamSession.queue && jamSyncRef.current.jamSession.queue.length > 0) {
          jamSyncRef.current.socket.emit('jam:next_track', { roomCode });
          return;
        }
        if (!isJamHost()) {
          jamSyncRef.current.socket.emit('jam:next_track', { roomCode });
          return;
        }
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

        const pool = (INITIAL_TRACKS && INITIAL_TRACKS.length > 0 ? INITIAL_TRACKS : (userTracks && userTracks.length > 0 ? userTracks : queueRef.current || []))
          .filter(t => (isCurQuran ? isQuranContent(t) : !isQuranContent(t)));

        let next10 = getSmartTasteAndMoodTracks({
          allTracks: pool,
          currentUser,
          followedArtists: currentUser?.following || [],
          likedTrackIds,
          excludeTrackIds: playedSmartSongIdsRef.current,
          limit: 10,
        });

        if (!next10 || next10.length === 0) {
          playedSmartSongIdsRef.current = new Set(cur ? [String(cur._id || cur.id)] : []);
          next10 = getSmartTasteAndMoodTracks({
            allTracks: pool,
            currentUser,
            followedArtists: currentUser?.following || [],
            likedTrackIds,
            excludeTrackIds: playedSmartSongIdsRef.current,
            limit: 10,
          });
        }

        if (next10 && next10.length > 0) {
          setQueue(next10);
          playTrack(next10[0], next10);
          return;
        }
      } catch (err) {}

      // Fallback: pick matching tracks from pool
      const pool = (INITIAL_TRACKS && INITIAL_TRACKS.length > 0 ? INITIAL_TRACKS : (userTracks && userTracks.length > 0 ? userTracks : queueRef.current || []))
        .filter(t => (isCurQuran ? isQuranContent(t) : !isQuranContent(t)));
      if (pool.length > 0) {
        const remaining = pool.filter(t => String(t._id || t.id) !== currentId);
        const candidates = remaining.length > 0 ? remaining : pool;
        const fresh10 = candidates.slice(0, 10);
        setQueue(fresh10);
        playTrack(fresh10[0], fresh10);
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

    const isSmartQueue = isSmartMoodQueueRef.current || q.some(t => t.isSmartMoodQueue);
    if (isSmartQueue) {
      if (i >= 0 && i < q.length - 1) {
        playTrack(q[i + 1], q, false, 0, false, true);
        return;
      }

      // Reached the end of the 10 songs! Refresh and fetch 10 BRAND NEW tracks matching current mood & taste!
      q.forEach(t => playedSmartSongIdsRef.current.add(String(t._id || t.id)));
      const pool = (INITIAL_TRACKS && INITIAL_TRACKS.length > 0) ? INITIAL_TRACKS : (userTracks && userTracks.length > 0 ? userTracks : q);
      let next10 = getSmartTasteAndMoodTracks({
        allTracks: pool,
        currentUser,
        followedArtists: currentUser?.following || [],
        likedTrackIds,
        excludeTrackIds: playedSmartSongIdsRef.current,
        limit: 10,
      });

      if (!next10 || next10.length === 0) {
        playedSmartSongIdsRef.current = new Set(currentId ? [currentId] : []);
        next10 = getSmartTasteAndMoodTracks({
          allTracks: pool,
          currentUser,
          followedArtists: currentUser?.following || [],
          likedTrackIds,
          excludeTrackIds: playedSmartSongIdsRef.current,
          limit: 10,
        });
      }

      if (next10 && next10.length > 0) {
        const tagged = next10.map(t => ({ ...t, isSmartMoodQueue: true }));
        let newQ = tagged;
        if (isShuffle && tagged.length > 1) {
          const [first, ...rest] = tagged;
          newQ = [first, ...[...rest].sort(() => Math.random() - 0.5)];
        }
        setQueue(newQ);
        playTrack(newQ[0], newQ, false, 0, false, true);
        return;
      }
    }

    if (isShuffle) {
      // Pick next song avoiding immediate recent repeats
      const recentIds = new Set(historyStackRef.current.slice(-5).map(t => String(t._id || t.id)));
      recentIds.add(currentId);
      const candidates = q.filter(t => !recentIds.has(String(t._id || t.id)));
      const nextTrack = (candidates.length > 0)
        ? candidates[Math.floor(Math.random() * candidates.length)]
        : q[(i + 1) % q.length];
      playTrack(nextTrack, q);
    } else if (i >= 0 && i < q.length - 1) {
      playTrack(q[i + 1], q);
    } else if (repeatModeRef.current === 'all' && q.length > 1) {
      playTrack(q[0], q);
    } else {
      // Reached the end of the queue! Autoplay next songs obeying strict Quran/Music boundary!
      triggerAutoQueue();
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
      shouldBePlayingRef.current = false;
      if (soundRef.current) {
        await soundRef.current.pauseAsync().catch(() => {});
        isPlayingRef.current = false;
        setIsPlaying(false);
      }
    } catch (e) {}
  }, []);

  const syncRemotePlayState = useCallback(async ({ isPlaying: syncPlaying, currentTrack: syncTrack, currentTime: syncTime, updatedAt }) => {
    let targetTime = Number(syncTime) || 0;
    if (syncPlaying && updatedAt) {
      const elapsed = (Date.now() - updatedAt) / 1000;
      if (targetTime <= 2 && elapsed > 2) {
        targetTime = Math.min(2, targetTime);
      } else if (elapsed > 0 && elapsed < 3600) {
        targetTime += elapsed;
      }
    }

    const cur = currentTrackRef.current;
    const isDifferentTrack = syncTrack && String(syncTrack.id || syncTrack._id) !== String(cur?.id || cur?._id);

    // If remote state is PAUSED: pause immediately without any seeking or playback re-triggering!
    if (syncPlaying === false) {
      shouldBePlayingRef.current = false;
      setIsPlaying(false);
      isPlayingRef.current = false;
      if (soundRef.current) {
        try {
          await soundRef.current.pauseAsync();
        } catch {}
      }
      if (isDifferentTrack) {
        setCurrentTrack(syncTrack);
      }
      if (targetTime !== undefined) {
        setProgress(p => ({ ...p, currentTime: Math.max(0, targetTime) }));
      }
      if (jamSyncRef.current.jamSession) {
        jamSyncRef.current.jamSession.isPlaying = false;
        jamSyncRef.current.jamSession.currentTime = targetTime;
        jamSyncRef.current.jamSession.updatedAt = Date.now();
      }
      const isLikedTrack = cur ? likedTrackIds.some(id => String(id) === String(cur._id || cur.id)) : false;
      updateMediaNotification(false, repeatModeRef.current, isShuffleRef.current, isLikedTrack, {
        ...(cur || {}),
        currentTime: targetTime !== undefined ? targetTime : (playbackStatusRef.current?.currentTime || 0),
        duration: playbackStatusRef.current?.duration || Number(cur?.duration || 240)
      });
      return;
    }

    shouldBePlayingRef.current = true;
    isPlayingRef.current = true;
    setIsPlaying(true);

    if (isDifferentTrack || !soundRef.current) {
      await playTrack(syncTrack || cur, null, false, targetTime, true);
    } else {
      // Same track while playing: sync drift if > 1.5s
      const localCur = playbackStatusRef.current?.currentTime || 0;
      if (targetTime !== undefined && Math.abs(targetTime - localCur) > 1.5) {
        seekTo(targetTime, true);
      }
      if (soundRef.current) {
        await soundRef.current.playAsync().catch(() => {});
      }
      if (jamSyncRef.current.jamSession) {
        jamSyncRef.current.jamSession.isPlaying = true;
        jamSyncRef.current.jamSession.currentTime = targetTime;
        jamSyncRef.current.jamSession.updatedAt = Date.now();
      }
      const trackToUse = syncTrack || cur;
      const isLikedTrack = trackToUse ? likedTrackIds.some(id => String(id) === String(trackToUse._id || trackToUse.id)) : false;
      updateMediaNotification(true, repeatModeRef.current, isShuffleRef.current, isLikedTrack, {
        ...(trackToUse || {}),
        currentTime: targetTime !== undefined ? targetTime : (playbackStatusRef.current?.currentTime || 0),
        duration: playbackStatusRef.current?.duration || Number(trackToUse?.duration || 240)
      });
    }
  }, [playTrack, seekTo, likedTrackIds]);

  const controls = useMemo(() => ({
    currentTrack, isPlaying, isLoading, isShuffle, repeatMode, isOfflineMode, downloadedTracks, downloadingIds, queue, progress,
    tracks: queue.length > 0 ? queue : INITIAL_TRACKS,
    sleepTimerRemaining, lyrics, isLoadingLyrics, volume, setVolume,
    playTrack, playPlaylist, togglePlay, seekTo, setIsShuffle, toggleRepeat, playNextTrack, playPrevTrack,
    addToQueue, addMultipleToQueue, setQueue, removeFromQueue, clearQueue,
    startSleepTimer, cancelSleepTimer,
    handleDownloadTrack, handleDownloadPlaylist, removeDownloadedTrack, refreshDownloadedTracks,
    autoDownloadFinished, toggleAutoDownloadFinished,
    syncFromOnlineTrack, pauseNativePlayback, syncRemotePlayState,
    jamSession, setJamSync,
    remoteDevicePlayback,
  }), [currentTrack, isPlaying, isLoading, isShuffle, repeatMode, isOfflineMode, downloadedTracks, downloadingIds, queue, progress, sleepTimerRemaining, lyrics, isLoadingLyrics, volume, setVolume, autoDownloadFinished, toggleAutoDownloadFinished, syncFromOnlineTrack, pauseNativePlayback, syncRemotePlayState, jamSession, setJamSync, remoteDevicePlayback]);

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
