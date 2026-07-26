import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';
import * as Network from 'expo-network';
import * as FileSystem from 'expo-file-system';
import { Alert, ToastAndroid, Platform } from 'react-native';
import { API_BASE_URL } from '../config';
import { downloadTrack, getDownloadedTracks, removeDownloadedTrack, isTrackDownloaded } from '../services/downloadManager';

const AudioContext = createContext();

// Temporary directory for playing base64 tracks
const TEMP_PLAY_DIR = `${FileSystem.cacheDirectory}liofy_play/`;

async function resolveYouTubeMobile(inputUrl) {
  if (!inputUrl) return null;
  const match = inputUrl.match(/(?:v=|\/|embed\/|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  const videoId = match ? match[1] : (inputUrl.length === 11 ? inputUrl : null);
  if (!videoId) return null;

  const cobaltEndpoints = [
    'https://api.cobalt.tools/api/json',
    'https://cobalt.stream/api/json',
    'https://co.wuk.sh/api/json'
  ];
  for (const ep of cobaltEndpoints) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          downloadMode: 'audio',
          audioFormat: 'mp3',
          isAudioOnly: true
        })
      });
      if (res.ok) {
        const data = await res.json();
        const streamUrl = data.url || data.audio || (data.picker && data.picker[0]?.url);
        if (streamUrl) return streamUrl;
      }
    } catch (err) {}
  }

  const instances = [
    'https://inv.nadeko.net',
    'https://yewtu.be',
    'https://yt.artemislena.eu',
    'https://invidious.nerdvpn.de',
    'https://inv.us.projectsegfau.lt'
  ];

  for (const base of instances) {
    try {
      const res = await fetch(`${base}/api/v1/videos/${videoId}?fields=adaptiveFormats,formatStreams`);
      if (!res.ok) continue;
      const data = await res.json();
      const formats = data.adaptiveFormats || data.formatStreams || [];
      const audio = formats.find(f => f.type?.includes('audio/mp4')) ||
                    formats.find(f => f.type?.includes('audio')) ||
                    formats.find(f => f.container === 'm4a');
      if (audio?.url) return audio.url;
    } catch (e) {}
  }
  return null;
}

export const AudioProvider = ({ children }) => {
  const soundRef = useRef(null);

  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1.0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [downloadedTracks, setDownloadedTracks] = useState([]);
  const [downloadingIds, setDownloadingIds] = useState({});
  const [queue, setQueue] = useState([]);

  // Configure Audio Mode on mount
  useEffect(() => {
    const setupAudioMode = async () => {
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
      } catch (err) {
        console.warn('Audio mode setup error:', err);
      }
    };
    setupAudioMode();
    refreshDownloadedTracks();
    checkNetworkState();

    // Ensure temp dir exists
    const ensureTempDir = async () => {
      const info = await FileSystem.getInfoAsync(TEMP_PLAY_DIR);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(TEMP_PLAY_DIR, { intermediates: true }).catch(() => {});
      }
    };
    ensureTempDir();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  // Monitor network state for offline mode
  const checkNetworkState = async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      const offline = !state.isConnected || !state.isInternetReachable;
      setIsOfflineMode(offline);
    } catch (err) {
      console.warn('Network check error:', err);
    }
  };

  const refreshDownloadedTracks = async () => {
    const tracks = await getDownloadedTracks();
    setDownloadedTracks(tracks);
  };

  const onPlaybackStatusUpdate = (status) => {
    if (!status.isLoaded) {
      if (status.error) {
        console.error(`Playback Error: ${status.error}`);
      }
      return;
    }

    setIsPlaying(status.isPlaying);
    setCurrentTime(status.positionMillis / 1000);
    setDuration((status.durationMillis || 0) / 1000);

    if (status.didJustFinish && !status.isLooping) {
      playNextTrack();
    }
  };

  // Play a specific track
  const playTrack = async (track, trackList = [], isRetry = false) => {
    if (!track || isLoading) return;

    try {
      setIsLoading(true);
      if (trackList.length > 0) {
        setQueue(trackList);
      }

      // Check if track is downloaded locally
      const localRecord = downloadedTracks.find(t => (t._id || t.id) === (track._id || track.id));
      let audioSourceUri = localRecord?.nativeAudioUri || localRecord?.localAudioUri || track.nativeAudioUri || track.localAudioUri || track.audioUrl;

      if (!audioSourceUri) {
        throw new Error('Song URL not found');
      }

      // ── CRITICAL FIX: Handle Base64 data strings for APK ──
      // Large base64 strings often fail in native Android URI parser.
      // We save them to a temporary file first.
      if (audioSourceUri.startsWith('data:audio')) {
        try {
          const trackId = track._id || track.id;
          const tempFileUri = `${TEMP_PLAY_DIR}temp_${trackId}.mp3`;

          // Check if it already exists to avoid re-writing
          const fileInfo = await FileSystem.getInfoAsync(tempFileUri);
          if (!fileInfo.exists) {
            const base64Content = audioSourceUri.split(';base64,').pop();
            await FileSystem.writeAsStringAsync(tempFileUri, base64Content, {
              encoding: FileSystem.EncodingType.Base64,
            });
          }
          audioSourceUri = tempFileUri;
          console.log('[AudioPlayer] Converted Base64 to temp file:', audioSourceUri);
        } catch (base64Err) {
          console.error('[AudioPlayer] Base64 conversion failed:', base64Err);
          // fall back to original (might fail, but it's a last resort)
        }
      }

      // If audioSourceUri is already a local file, leave it as is.
      const isLocalFile = audioSourceUri.startsWith('file://') || audioSourceUri.startsWith('content://') || audioSourceUri.includes('/_capacitor_file_/') || audioSourceUri.startsWith(FileSystem.cacheDirectory);
      const isAlreadyProxied = audioSourceUri.includes('/api/proxy-audio') || audioSourceUri.includes('/api/soundcloud/stream');

      if (!isLocalFile && !isAlreadyProxied) {
        if (track.source === 'YouTube' || audioSourceUri.includes('youtube.com') || audioSourceUri.includes('youtu.be') || audioSourceUri.includes('googlevideo.com')) {
          const directMobileStream = await resolveYouTubeMobile(track.audioUrl || audioSourceUri);
          if (directMobileStream) {
            audioSourceUri = directMobileStream;
          } else {
            audioSourceUri = `${API_BASE_URL}/api/proxy-audio?url=${encodeURIComponent(track.audioUrl || audioSourceUri)}`;
          }
        } else if (track.source === 'SoundCloud') {
          audioSourceUri = `${API_BASE_URL}/api/soundcloud/stream?url=${encodeURIComponent(track.audioUrl || audioSourceUri)}`;
        }
      }

      console.log(`[AudioPlayer] Playing (${isRetry ? 'RETRY' : 'INITIAL'}):`, audioSourceUri);

      // Unload previous sound
      if (soundRef.current) {
        try {
          await soundRef.current.unloadAsync();
        } catch (e) {}
        soundRef.current = null;
      }

      // Ensure audioSourceUri is not empty
      if (!audioSourceUri || audioSourceUri === 'undefined') {
        throw new Error('Invalid song URL');
      }

      // Create new sound instance with increased timeout for slow networks
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioSourceUri },
        { shouldPlay: true, volume, androidImplementation: 'MediaPlayer' },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      setCurrentTrack(track);
      setIsPlaying(true);
      setIsLoading(false);
    } catch (err) {
      console.error('[AudioPlayer] Playback Error:', err.message);
      setIsLoading(false);

      // If playback fails and we haven't retried yet, try one more time with a resolved URL
      if (!isRetry && !isOfflineMode) {
        console.log('[AudioPlayer] Attempting retry...');
        return playTrack(track, trackList, true);
      } else {
        const errorMsg = `Could not play song. Please check internet connection and try again.\n(Error: ${err.message || 'Unknown'})`;
        Alert.alert('Playback Error', errorMsg);
      }
    }
  };

  const togglePlay = async () => {
    if (!soundRef.current) {
      if (currentTrack) {
        playTrack(currentTrack);
      }
      return;
    }

    try {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
        setIsPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Error toggling play/pause:', err);
    }
  };

  const seekTo = async (seconds) => {
    if (!soundRef.current) return;
    try {
      await soundRef.current.setPositionAsync(seconds * 1000);
      setCurrentTime(seconds);
    } catch (err) {
      console.error('Error seeking:', err);
    }
  };

  const setVolume = async (val) => {
    setVolumeState(val);
    if (soundRef.current) {
      try {
        await soundRef.current.setVolumeAsync(val);
      } catch (err) {}
    }
  };

  const playNextTrack = () => {
    if (!queue || queue.length === 0) return;
    const currentIndex = queue.findIndex(t => (t._id || t.id) === (currentTrack?._id || currentTrack?.id));
    
    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * queue.length);
      playTrack(queue[randomIndex], queue);
    } else if (currentIndex >= 0 && currentIndex < queue.length - 1) {
      playTrack(queue[currentIndex + 1], queue);
    } else if (isRepeat && queue.length > 0) {
      playTrack(queue[0], queue);
    }
  };

  const playPrevTrack = () => {
    if (!queue || queue.length === 0) return;
    const currentIndex = queue.findIndex(t => (t._id || t.id) === (currentTrack?._id || currentTrack?.id));
    if (currentIndex > 0) {
      playTrack(queue[currentIndex - 1], queue);
    } else {
      playTrack(queue[queue.length - 1], queue);
    }
  };

  // Download track to phone storage
  const handleDownloadTrack = async (track) => {
    const trackId = track._id || track.id;
    try {
      setDownloadingIds(prev => ({ ...prev, [trackId]: 0 }));
      const downloadedRecord = await downloadTrack(track, (progress) => {
        setDownloadingIds(prev => ({ ...prev, [trackId]: progress }));
      });
      await refreshDownloadedTracks();
      return downloadedRecord;
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloadingIds(prev => {
        const copy = { ...prev };
        delete copy[trackId];
        return copy;
      });
    }
  };

  const handleRemoveDownload = async (trackId) => {
    await removeDownloadedTrack(trackId);
    await refreshDownloadedTracks();
  };

  return (
    <AudioContext.Provider value={{
      currentTrack,
      isPlaying,
      isLoading,
      currentTime,
      duration,
      volume,
      isShuffle,
      isRepeat,
      isOfflineMode,
      downloadedTracks,
      downloadingIds,
      queue,
      playTrack,
      togglePlay,
      seekTo,
      setVolume,
      setIsShuffle,
      setIsRepeat,
      setIsOfflineMode,
      playNextTrack,
      playPrevTrack,
      handleDownloadTrack,
      handleRemoveDownload,
      refreshDownloadedTracks,
    }}>
      {children}
    </AudioContext.Provider>
  );
};

export const useAudioPlayer = () => useContext(AudioContext);
