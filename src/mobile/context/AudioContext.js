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

  const { showToast } = useToast();

  // --- Main App State ---
  const [currentTrack, setCurrentTrackState] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [downloadedTracks, setDownloadedTracks] = useState([]);
  const [downloadingIds, setDownloadingIds] = useState({});
  const [queue, setQueueState] = useState([]);

  // Wrapper to keep ref and state in sync
  const setCurrentTrack = (track) => {
    currentTrackRef.current = track;
    setCurrentTrackState(track);
  };

  const setQueue = (newQueue) => {
    queueRef.current = newQueue;
    setQueueState(newQueue);
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
      } catch (e) {}
    };
    setup();
    refreshDownloadedTracks();
    checkNetwork();

    // ── Faster Network Sync (3s) ──
    const netInterval = setInterval(checkNetwork, 3000);

    // ── Auto-Clear Play Cache ──
    FileSystem.deleteAsync(TEMP_PLAY_DIR, { idempotent: true })
      .then(() => FileSystem.makeDirectoryAsync(TEMP_PLAY_DIR, { intermediates: true }))
      .catch(() => {});

    return () => {
      if (soundRef.current) soundRef.current.unloadAsync();
      clearInterval(netInterval);
    };
  }, []);

  const checkNetwork = async () => {
    const state = await Network.getNetworkStateAsync();
    setIsOfflineMode(!state.isConnected || !state.isInternetReachable);
  };

  const refreshDownloadedTracks = async () => {
    const list = await getDownloadedTracks();
    setDownloadedTracks(list);
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

    if (status.didJustFinish && !status.isLooping) {
      console.log('[AudioPlayer] Track finished, auto-playing next...');
      playNextTrack();
    }
  };

  // --- Progress State ---
  const [progress, setProgress] = useState({ currentTime: 0, duration: 0 });

  const playTrack = async (track, trackList = [], isRetry = false) => {
    if (!track || (isResolvingRef.current && !isRetry)) return;
    const trackId = String(track._id || track.id);
    const requestTs = Date.now();
    playbackStatusRef.current.lastRequestTs = requestTs;

    try {
      isResolvingRef.current = true;
      setIsLoading(true);

      // Kill existing sound
      if (soundRef.current) {
        const s = soundRef.current;
        soundRef.current = null;
        await s.stopAsync().catch(() => {});
        await s.unloadAsync().catch(() => {});
      }

      if (trackList.length > 0) setQueue(trackList);

      const local = downloadedTracks.find(t => String(t._id || t.id) === trackId);
      let uri = local?.nativeAudioUri || local?.localAudioUri || track.nativeAudioUri || track.localAudioUri || track.audioUrl;

      if (!uri) throw new Error('No URI');
      if (uri.startsWith('/')) uri = `${API_BASE_URL}${uri}`;

      // Handle Base64
      if (uri.startsWith('data:audio')) {
        const path = `${TEMP_PLAY_DIR}temp_${trackId}.mp3`;
        if (!(await FileSystem.getInfoAsync(path)).exists) {
          await FileSystem.writeAsStringAsync(path, uri.split(',').pop(), { encoding: FileSystem.EncodingType.Base64 });
        }
        uri = path;
      }

      const isRemote = !uri.startsWith('file://') && !uri.startsWith(FileSystem.cacheDirectory);

      if (isRemote && !uri.includes('/api/')) {
        if (track.source === 'YouTube' || uri.includes('youtube.com') || uri.includes('youtu.be')) {
           const direct = await resolveYouTubeStream(trackId);
           uri = direct || `${API_BASE_URL}/api/proxy-audio?url=${encodeURIComponent(track.audioUrl || uri)}&resolve=true&ts=${Date.now()}`;
        } else if (track.source === 'SoundCloud') {
           uri = `${API_BASE_URL}/api/soundcloud/stream?url=${encodeURIComponent(uri)}&ts=${Date.now()}`;
        }
      }

      if (playbackStatusRef.current.lastRequestTs !== requestTs) {
        isResolvingRef.current = false;
        return;
      }

      const { sound } = await Audio.Sound.createAsync(
        {
          uri,
          headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36' }
        },
        { shouldPlay: true, progressUpdateIntervalMillis: 1000 },
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

      // AUTO-DOWNLOAD TRIGGER
      if (isRemote && !isOfflineMode) {
        handleDownloadTrack(track, true).catch(() => {});
      }

    } catch (err) {
      setIsLoading(false);
      isResolvingRef.current = false;

      if (!isRetry && !isOfflineMode) {
        return playTrack(track, trackList, true);
      } else {
        console.warn('[AudioPlayer] Fatal playback failure:', err.message);
        showToast(`Skipping: ${track.title} (Stream Error)`, 'error');

        // Auto-skip to next track after a short delay
        setTimeout(() => {
          playNextTrack();
        }, 1500);
      }
    }
  };

  const togglePlay = async () => {
    if (isLoading || isResolvingRef.current) return;
    if (!soundRef.current) return currentTrackRef.current && playTrack(currentTrackRef.current, queueRef.current);
    if (isPlaying) await soundRef.current.pauseAsync();
    else await soundRef.current.playAsync();
  };

  const seekTo = async (secs) => {
    if (!soundRef.current) return;
    await soundRef.current.setPositionAsync(secs * 1000);
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
    } else if (isRepeat && q.length > 0) {
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

  const handleDownloadTrack = async (t, isSilent = false) => {
    const id = String(t._id || t.id);
    if (await isTrackDownloaded(id)) return;

    try {
      if (!isSilent) setDownloadingIds(p => ({ ...p, [id]: 0 }));
      await downloadTrack(t, (prog) => {
        if (!isSilent) setDownloadingIds(p => ({ ...p, [id]: prog }));
      });
      await refreshDownloadedTracks();
    } catch (e) {
      if (!isSilent) Alert.alert('Download Fail', `Could not save ${t.title}`);
    } finally {
      if (!isSilent) setDownloadingIds(p => { const c = { ...p }; delete c[id]; return c; });
    }
  };

  const handleDownloadPlaylist = async (tracksToDownload) => {
    if (!tracksToDownload || tracksToDownload.length === 0) return;
    for (const track of tracksToDownload) {
      await handleDownloadTrack(track, false);
      await new Promise(r => setTimeout(r, 500));
    }
    Alert.alert('Download Complete', 'All tracks from playlist saved offline.');
  };

  const controls = useMemo(() => ({
    currentTrack, isPlaying, isLoading, isShuffle, isRepeat, isOfflineMode, downloadedTracks, downloadingIds, queue,
    playTrack, togglePlay, seekTo, setIsShuffle, setIsRepeat, playNextTrack, playPrevTrack,
    handleDownloadTrack, handleDownloadPlaylist, removeDownloadedTrack, refreshDownloadedTracks
  }), [currentTrack, isPlaying, isLoading, isShuffle, isRepeat, isOfflineMode, downloadedTracks, downloadingIds, queue]);

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
