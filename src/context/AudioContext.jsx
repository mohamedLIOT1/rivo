import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { initAudioEngine, setEqualizerBands, setMasterVolume, resumeAudioContext } from '../utils/audioEngine';
import { getOfflineTrackAudioUrl, removeTrackOffline, saveTrackOffline } from '../utils/offlineStorage';

const AudioPlayerContext = createContext(null);

export function AudioProvider({ children, tracks, setTracks }) {
  const [currentTrack, setCurrentTrack] = useState(() => tracks[0] || null);
  const [currentQueue, setCurrentQueue] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(210);
  const [volume, setVolumeState] = useState(0.8);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // Equalizer State
  const [eqEnabled, setEqEnabled] = useState(true);
  const [eqPreset, setEqPreset] = useState('Bass Booster');
  const [eqBands, setEqBands] = useState({
    '60Hz': 7,
    '230Hz': 5,
    '910Hz': 0,
    '3.6kHz': -2,
    '14kHz': 1
  });

  const isRepeatRef = useRef(isRepeat);
  const isShuffleRef = useRef(isShuffle);
  const currentQueueRef = useRef(currentQueue);
  const tracksRef = useRef(tracks);
  const currentTrackRef = useRef(currentTrack);

  useEffect(() => { isRepeatRef.current = isRepeat; }, [isRepeat]);
  useEffect(() => { isShuffleRef.current = isShuffle; }, [isShuffle]);
  useEffect(() => { currentQueueRef.current = currentQueue; }, [currentQueue]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);

  const audioRef = useRef(null);

  // Create Audio HTML element & connect Web Audio API Engine
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;

    initAudioEngine(audio);

    let lastTimeUpdate = 0;
    const handleTimeUpdate = () => {
      if (audio && !isNaN(audio.currentTime)) {
        const now = Date.now();
        // Throttle React state updates to every 250ms (~4Hz) instead of 60fps
        if (now - lastTimeUpdate > 250) {
          lastTimeUpdate = now;
          setCurrentTime(audio.currentTime);
        }
      }
    };

    const handleLoadedMetadata = () => {
      if (audio && !isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      if (isRepeatRef.current) {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
      } else {
        playNextTrack();
      }
    };

    const handleError = (e) => {
      console.warn('Audio playback handled safely:', e);
      // If anonymous CORS fails, attempt fallback without crossOrigin setting
      if (audio.crossOrigin) {
        audio.crossOrigin = null;
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
    };
  }, []);

  // Synchronize Real Web Audio API DSP Equalizer whenever Bands or Enabled state changes
  useEffect(() => {
    setEqualizerBands(eqBands, eqEnabled);
  }, [eqBands, eqEnabled]);

  // Sync Master Volume
  const setVolume = (val) => {
    setVolumeState(val);
    setMasterVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
  };

  // Synchronize Playback Audio Source & Mobile MediaSession API
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack || !currentTrack.audioUrl) return;

    let targetUrl = currentTrack.audioUrl;
    if (targetUrl.startsWith('http') && !targetUrl.includes('/api/proxy-audio')) {
      const base = API_BASE_URL.replace(/\/$/, '');
      targetUrl = `${base}/api/proxy-audio?url=${encodeURIComponent(targetUrl)}`;
    }

    if (audio.src !== targetUrl) {
      audio.src = targetUrl;
    }

    if (isPlaying) {
      resumeAudioContext();
      audio.play().catch((err) => console.warn('Audio auto-play policy handle:', err));
    } else {
      audio.pause();
    }

    // MediaSession API integration for Lock Screen / Wearables controls
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title || 'Liofy Track',
          artist: currentTrack.artist || 'Liofy Artist',
          album: currentTrack.album || 'Liofy Single',
          artwork: [
            { src: currentTrack.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600', sizes: '512x512', type: 'image/jpeg' }
          ]
        });

        navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
        navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
        navigator.mediaSession.setActionHandler('previoustrack', () => playPrevTrack());
        navigator.mediaSession.setActionHandler('nexttrack', () => playNextTrack());
      } catch (e) {}
    }
  }, [currentTrack, isPlaying]);

  const togglePlay = () => {
    if (!currentTrack) return;
    if (isOfflineMode && !currentTrack.downloaded) {
      alert('Offline mode active! Download track to listen offline.');
      return;
    }
    resumeAudioContext();
    setIsPlaying(prev => !prev);
  };

  const playTrack = async (track, newQueue = null) => {
    if (!track) return;

    let trackToPlay = { ...track };
    const offlineAudioUrl = await getOfflineTrackAudioUrl(track.id);
    if (offlineAudioUrl) {
      trackToPlay.audioUrl = offlineAudioUrl;
    } else if (isOfflineMode && !track.downloaded) {
      alert('Offline mode active! Download track first.');
      return;
    }

    if (newQueue && Array.isArray(newQueue) && newQueue.length > 0) {
      setCurrentQueue(newQueue);
    } else if (currentQueueRef.current.length === 0 && tracksRef.current.length > 0) {
      setCurrentQueue(tracksRef.current);
    }

    if (setTracks) {
      setTracks((prev) => {
        const exists = prev.some((t) => t.id === trackToPlay.id);
        if (!exists) return [trackToPlay, ...prev];
        return prev.map((t) => (t.id === trackToPlay.id ? { ...t, plays: (Number(t.plays) || 0) + 1 } : t));
      });
    }

    setCurrentTrack(trackToPlay);
    setIsPlaying(true);
  };

  const playNextTrack = () => {
    const rawQueue = currentQueueRef.current.length > 0 ? currentQueueRef.current : tracksRef.current;
    if (!rawQueue || rawQueue.length === 0) return;
    const activeList = isOfflineMode ? rawQueue.filter(t => t.downloaded) : rawQueue;
    if (activeList.length === 0) return;

    if (isShuffleRef.current) {
      const randomIdx = Math.floor(Math.random() * activeList.length);
      playTrack(activeList[randomIdx]);
    } else {
      const currentIdx = activeList.findIndex((t) => t.id === (currentTrackRef.current ? currentTrackRef.current.id : ''));
      const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % activeList.length;
      playTrack(activeList[nextIdx]);
    }
  };

  const playPrevTrack = () => {
    const rawQueue = currentQueueRef.current.length > 0 ? currentQueueRef.current : tracksRef.current;
    if (!rawQueue || rawQueue.length === 0) return;
    const activeList = isOfflineMode ? rawQueue.filter(t => t.downloaded) : rawQueue;
    if (activeList.length === 0) return;

    const currentIdx = activeList.findIndex((t) => t.id === (currentTrackRef.current ? currentTrackRef.current.id : ''));
    const prevIdx = currentIdx <= 0 ? activeList.length - 1 : currentIdx - 1;
    playTrack(activeList[prevIdx]);
  };

  const seekTo = (seconds) => {
    if (!isNaN(seconds)) {
      setCurrentTime(seconds);
      if (audioRef.current) {
        audioRef.current.currentTime = seconds;
      }
    }
  };

  const applyEqPreset = (name) => {
    setEqPreset(name);
    let newBands = { '60Hz': 0, '230Hz': 0, '910Hz': 0, '3.6kHz': 0, '14kHz': 0 };
    if (name === 'Bass Booster') {
      newBands = { '60Hz': 7, '230Hz': 5, '910Hz': 0, '3.6kHz': -2, '14kHz': 1 };
    } else if (name === 'Vocal Booster') {
      newBands = { '60Hz': -2, '230Hz': 1, '910Hz': 6, '3.6kHz': 5, '14kHz': 2 };
    } else if (name === 'Electronic') {
      newBands = { '60Hz': 5, '230Hz': 4, '910Hz': 1, '3.6kHz': 4, '14kHz': 6 };
    } else if (name === 'Rock') {
      newBands = { '60Hz': 6, '230Hz': 3, '910Hz': -1, '3.6kHz': 3, '14kHz': 5 };
    } else if (name === 'Acoustic') {
      newBands = { '60Hz': 3, '230Hz': 1, '910Hz': 2, '3.6kHz': 4, '14kHz': 3 };
    }
    setEqBands(newBands);
  };

  const value = {
    currentTrack,
    setCurrentTrack,
    currentQueue,
    setCurrentQueue,
    isPlaying,
    setIsPlaying,
    currentTime,
    duration,
    volume,
    setVolume,
    isShuffle,
    setIsShuffle,
    isRepeat,
    setIsRepeat,
    isOfflineMode,
    setIsOfflineMode,
    eqEnabled,
    setEqEnabled,
    eqPreset,
    setEqPreset,
    eqBands,
    setEqBands,
    applyEqPreset,
    togglePlay,
    playTrack,
    playNextTrack,
    playPrevTrack,
    seekTo,
    audioRef
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioProvider');
  }
  return context;
}
