import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as Network from 'expo-network';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import { API_BASE_URL } from '../config';
import { downloadTrack, getDownloadedTracks, removeDownloadedTrack, isTrackDownloaded } from '../services/downloadManager';
import { resolveYouTubeStream } from '../services/youtubeResolver';
import { useToast } from './ToastContext';

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

  const { showToast } = useToast();

  const [currentTrack, setCurrentTrackState] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off' | 'all' | 'one'
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [downloadedTracks, setDownloadedTracks] = useState([]);
  const [downloadingIds, setDownloadingIds] = useState({});
  const [queue, setQueueState] = useState([]);
  const [progress, setProgress] = useState({ currentTime: 0, duration: 0 });

  // Equalizer & Sleep Timer
  const [equalizerPreset, setEqualizerPreset] = useState('flat');
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(null);

  // Lyrics
  const [lyrics, setLyrics] = useState('');
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);

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
          interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
          interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        });
      } catch {}
    };
    setup();
    refreshDownloadedTracks();
    checkNetwork();

    const netInterval = setInterval(checkNetwork, 4000);

    FileSystem.deleteAsync(TEMP_PLAY_DIR, { idempotent: true })
      .then(() => FileSystem.makeDirectoryAsync(TEMP_PLAY_DIR, { intermediates: true }))
      .catch(() => {});

    return () => {
      if (soundRef.current) soundRef.current.unloadAsync().catch(() => {});
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
      clearInterval(netInterval);
    };
  }, []);

  const checkNetwork = async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      setIsOfflineMode(!state.isConnected || !state.isInternetReachable);
    } catch {}
  };

  const refreshDownloadedTracks = async () => {
    try {
      const list = await getDownloadedTracks();
      setDownloadedTracks(list || []);
    } catch {}
  };

  const onPlaybackStatusUpdate = (status) => {
    if (!status.isLoaded) return;
    if (isPlaying !== status.isPlaying) setIsPlaying(status.isPlaying);

    const newCurrentTime = Math.floor(status.positionMillis / 1000);
    const newDuration = Math.floor((status.durationMillis || 0) / 1000);

    if (playbackStatusRef.current.currentTime !== newCurrentTime) {
      playbackStatusRef.current = { ...playbackStatusRef.current, currentTime: newCurrentTime, duration: newDuration };
      setProgress({ currentTime: newCurrentTime, duration: newDuration });
    }

    if (status.didJustFinish) {
      if (repeatMode === 'one') {
        if (soundRef.current) soundRef.current.replayAsync().catch(() => {});
      } else {
        playNextTrack();
      }
    }
  };

  useEffect(() => {
    if (!currentTrack) {
      setLyrics('');
      return;
    }
    const fetchLyrics = async () => {
      try {
        setIsLoadingLyrics(true);
        const title = encodeURIComponent(currentTrack.title || '');
        const artist = encodeURIComponent(currentTrack.artist || '');
        const res = await fetch(`${API_BASE_URL}/api/lyrics?title=${title}&artist=${artist}`);
        if (res.ok) {
          const data = await res.json();
          setLyrics(data.lyrics || 'No lyrics available.');
        }
      } catch {
        setLyrics('');
      } finally {
        setIsLoadingLyrics(false);
      }
    };
    fetchLyrics();
  }, [currentTrack?._id, currentTrack?.id, currentTrack?.title]);

  const playTrack = async (track, trackList = [], isRetry = false) => {
    if (!track || (isResolvingRef.current && !isRetry)) return;
    const trackId = String(track._id || track.id);
    const requestTs = Date.now();
    playbackStatusRef.current.lastRequestTs = requestTs;

    try {
      isResolvingRef.current = true;
      setIsLoading(true);

      if (soundRef.current) {
        const s = soundRef.current;
        soundRef.current = null;
        await s.stopAsync().catch(() => {});
        await s.unloadAsync().catch(() => {});
      }

      if (trackList.length > 0) setQueue(trackList);

      const local = downloadedTracks.find(t => String(t._id || t.id) === trackId);
      let uri = local?.nativeAudioUri || local?.localAudioUri || track.nativeAudioUri || track.localAudioUri || track.audioUrl;

      if (!uri) throw new Error('No audio URL found');
      if (uri.startsWith('/')) uri = `${API_BASE_URL}${uri}`;

      const isRemote = !uri.startsWith('file://') && !uri.startsWith(FileSystem.cacheDirectory);
      if (isRemote && !uri.includes('/api/')) {
        if (track.source === 'YouTube' || uri.includes('youtube.com') || uri.includes('youtu.be')) {
          const direct = await resolveYouTubeStream(trackId);
          uri = direct || `${API_BASE_URL}/api/proxy-audio?url=${encodeURIComponent(track.audioUrl || uri)}&resolve=true`;
        }
      }

      if (playbackStatusRef.current.lastRequestTs !== requestTs) {
        isResolvingRef.current = false;
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 },
        onPlaybackStatusUpdate
      );

      if (playbackStatusRef.current.lastRequestTs !== requestTs) {
        await sound.unloadAsync().catch(() => {});
        return;
      }

      soundRef.current = sound;
      setCurrentTrack(track);
      setIsPlaying(true);
      setIsLoading(false);
      isResolvingRef.current = false;

      if (isRemote && !isOfflineMode) {
        handleDownloadTrack(track, true).catch(() => {});
      }
    } catch (err) {
      setIsLoading(false);
      isResolvingRef.current = false;
      if (!isRetry && !isOfflineMode) {
        return playTrack(track, trackList, true);
      } else {
        showToast(`Could not play: ${track.title}`, 'error');
        setTimeout(() => playNextTrack(), 1200);
      }
    }
  };

  const togglePlay = async () => {
    if (isLoading || isResolvingRef.current) return;
    if (!soundRef.current) {
      if (currentTrackRef.current) return playTrack(currentTrackRef.current, queueRef.current);
      if (queueRef.current.length > 0) return playTrack(queueRef.current[0], queueRef.current);
      return;
    }
    if (isPlaying) {
      await soundRef.current.pauseAsync().catch(() => {});
      setIsPlaying(false);
    } else {
      await soundRef.current.playAsync().catch(() => {});
      setIsPlaying(true);
    }
  };

  const seekTo = async (secs) => {
    if (!soundRef.current) return;
    await soundRef.current.setPositionAsync(secs * 1000).catch(() => {});
    setProgress(p => ({ ...p, currentTime: secs }));
  };

  const playNextTrack = () => {
    const q = queueRef.current;
    if (!q || q.length === 0) return;
    const currentId = String(currentTrackRef.current?._id || currentTrackRef.current?.id);
    const i = q.findIndex(t => String(t._id || t.id) === currentId);

    if (isShuffle) {
      const nextIdx = Math.floor(Math.random() * q.length);
      playTrack(q[nextIdx], q);
    } else if (i >= 0 && i < q.length - 1) {
      playTrack(q[i + 1], q);
    } else if (repeatMode === 'all' && q.length > 0) {
      playTrack(q[0], q);
    }
  };

  const playPrevTrack = () => {
    const q = queueRef.current;
    if (!q || q.length === 0) return;
    const currentId = String(currentTrackRef.current?._id || currentTrackRef.current?.id);
    const i = q.findIndex(t => String(t._id || t.id) === currentId);
    if (i > 0) playTrack(q[i - 1], q);
    else playTrack(q[q.length - 1], q);
  };

  const toggleRepeat = () => {
    if (repeatMode === 'off') setRepeatMode('all');
    else if (repeatMode === 'all') setRepeatMode('one');
    else setRepeatMode('off');
  };

  const handleDownloadTrack = async (t, isSilent = false) => {
    const id = String(t._id || t.id);
    if (await isTrackDownloaded(id)) return;
    try {
      if (!isSilent) setDownloadingIds(p => ({ ...p, [id]: 0 }));
      await downloadTrack(t, (prog) => {
        if (!isSilent) setDownloadingIds(p => ({ ...p, [id]: prog }));
      });
      await refreshDownloadedTracks();
      if (!isSilent) showToast(`Downloaded "${t.title}"`, 'info');
    } catch {
      if (!isSilent) Alert.alert('Download Failed', `Could not save ${t.title}`);
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

  const controls = useMemo(() => ({
    currentTrack, isPlaying, isLoading, isShuffle, repeatMode, isOfflineMode, downloadedTracks, downloadingIds, queue,
    equalizerPreset, sleepTimerRemaining, lyrics, isLoadingLyrics,
    playTrack, togglePlay, seekTo, setIsShuffle, toggleRepeat, playNextTrack, playPrevTrack,
    addToQueue, removeFromQueue, clearQueue,
    setEqualizerPreset, startSleepTimer, cancelSleepTimer,
    handleDownloadTrack, handleDownloadPlaylist, removeDownloadedTrack, refreshDownloadedTracks,
  }), [currentTrack, isPlaying, isLoading, isShuffle, repeatMode, isOfflineMode, downloadedTracks, downloadingIds, queue, equalizerPreset, sleepTimerRemaining, lyrics, isLoadingLyrics]);

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
