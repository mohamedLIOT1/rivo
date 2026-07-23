import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { initAudioEngine, setEqualizerBands, setMasterVolume, resumeAudioContext } from '../utils/audioEngine';
import { getOfflineTrackAudioUrl } from '../utils/offlineStorage';
import { API_BASE_URL } from '../config';

const AudioPlayerContext = createContext(null);

// ── Extract YouTube video ID from URL ─────────────────────────────
function extractYtId(url) {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

// ── Load YouTube IFrame API script once ───────────────────────────
let ytApiLoaded = false;
let ytApiReady = false;
const ytReadyCallbacks = [];

function loadYouTubeApi() {
  if (ytApiLoaded) return;
  ytApiLoaded = true;
  window.onYouTubeIframeAPIReady = () => {
    ytApiReady = true;
    ytReadyCallbacks.forEach(cb => cb());
    ytReadyCallbacks.length = 0;
  };
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

function onYtReady(cb) {
  if (ytApiReady) { cb(); return; }
  ytReadyCallbacks.push(cb);
  loadYouTubeApi();
}

// ──────────────────────────────────────────────────────────────────

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
    '60Hz': 7, '230Hz': 5, '910Hz': 0, '3.6kHz': -2, '14kHz': 1
  });

  const isRepeatRef       = useRef(isRepeat);
  const isShuffleRef      = useRef(isShuffle);
  const currentQueueRef   = useRef(currentQueue);
  const tracksRef         = useRef(tracks);
  const currentTrackRef   = useRef(currentTrack);
  const volumeRef         = useRef(0.8);

  useEffect(() => { isRepeatRef.current     = isRepeat;    }, [isRepeat]);
  useEffect(() => { isShuffleRef.current    = isShuffle;   }, [isShuffle]);
  useEffect(() => { currentQueueRef.current = currentQueue;}, [currentQueue]);
  useEffect(() => { tracksRef.current       = tracks;      }, [tracks]);
  useEffect(() => { currentTrackRef.current = currentTrack;}, [currentTrack]);

  // ── Regular HTML Audio element (for uploaded/SoundCloud tracks) ──
  const audioRef = useRef(null);

  // ── YouTube IFrame Player ────────────────────────────────────────
  const ytPlayerRef       = useRef(null);   // YT.Player instance
  const ytContainerRef    = useRef(null);   // DOM div for YT player
  const ytIntervalRef     = useRef(null);   // polling interval for currentTime
  const isYtTrackRef      = useRef(false);  // is current track a YouTube track?
  const isYtReadyRef      = useRef(false);  // is YT player ready?

  // Create Audio element + EQ
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audioRef.current = audio;
    initAudioEngine(audio);

    let lastTimeUpdate = 0;
    const handleTimeUpdate = () => {
      if (isYtTrackRef.current) return; // YT handles its own time
      if (audio && !isNaN(audio.currentTime)) {
        const now = Date.now();
        if (now - lastTimeUpdate > 250) {
          lastTimeUpdate = now;
          setCurrentTime(audio.currentTime);
        }
      }
    };
    const handleLoadedMetadata = () => {
      if (!isNaN(audio.duration) && audio.duration > 0) setDuration(audio.duration);
    };
    const handleEnded = () => {
      if (isYtTrackRef.current) return;
      if (isRepeatRef.current) { audio.currentTime = 0; audio.play().catch(() => {}); }
      else playNextTrack();
    };
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', () => { audio.crossOrigin = null; });

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
    };
  }, []);

  // Create hidden YouTube IFrame player div
  useEffect(() => {
    const div = document.createElement('div');
    div.id = 'liofy-yt-player';
    div.style.cssText = 'position:fixed;bottom:-9999px;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1';
    document.body.appendChild(div);
    ytContainerRef.current = div;

    // Load YouTube IFrame API
    onYtReady(() => {
      ytPlayerRef.current = new window.YT.Player('liofy-yt-player', {
        height: '1',
        width: '1',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            isYtReadyRef.current = true;
            ytPlayerRef.current.setVolume(volumeRef.current * 100);
            console.log('[YT] Player ready');
          },
          onStateChange: (event) => {
            const YT = window.YT;
            if (event.data === YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              setDuration(ytPlayerRef.current.getDuration() || 210);
              // Poll currentTime every 500ms
              if (ytIntervalRef.current) clearInterval(ytIntervalRef.current);
              ytIntervalRef.current = setInterval(() => {
                if (ytPlayerRef.current && isYtTrackRef.current) {
                  const t = ytPlayerRef.current.getCurrentTime() || 0;
                  setCurrentTime(t);
                }
              }, 500);
            } else if (event.data === YT.PlayerState.PAUSED) {
              setIsPlaying(false);
              if (ytIntervalRef.current) clearInterval(ytIntervalRef.current);
            } else if (event.data === YT.PlayerState.ENDED) {
              if (ytIntervalRef.current) clearInterval(ytIntervalRef.current);
              if (isRepeatRef.current) {
                ytPlayerRef.current.seekTo(0, true);
                ytPlayerRef.current.playVideo();
              } else {
                playNextTrack();
              }
            }
          },
          onError: (event) => {
            console.warn('[YT] Player error:', event.data);
            // Try to play next track on error
            setTimeout(() => playNextTrack(), 1000);
          },
        },
      });
    });

    return () => {
      if (ytIntervalRef.current) clearInterval(ytIntervalRef.current);
      if (div.parentNode) div.parentNode.removeChild(div);
    };
  }, []);

  // EQ sync
  useEffect(() => { setEqualizerBands(eqBands, eqEnabled); }, [eqBands, eqEnabled]);

  const setVolume = (val) => {
    volumeRef.current = val;
    setVolumeState(val);
    setMasterVolume(val);
    if (audioRef.current) audioRef.current.volume = val;
    if (ytPlayerRef.current && isYtReadyRef.current) {
      ytPlayerRef.current.setVolume(val * 100);
    }
  };

  // ── Main track playback logic ──────────────────────────────────
  useEffect(() => {
    if (!currentTrack || !currentTrack.audioUrl) return;

    const ytId = extractYtId(currentTrack.audioUrl);

    if (ytId) {
      // ── YouTube track ──────────────────────────────────────────
      isYtTrackRef.current = true;

      // Pause HTML audio if playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }

      setCurrentTime(0);
      setDuration(currentTrack.duration || 210);

      const loadYt = () => {
        if (!ytPlayerRef.current || !isYtReadyRef.current) {
          setTimeout(loadYt, 300);
          return;
        }
        try {
          ytPlayerRef.current.loadVideoById(ytId);
          if (isPlaying) {
            ytPlayerRef.current.playVideo();
          } else {
            ytPlayerRef.current.pauseVideo();
          }
          ytPlayerRef.current.setVolume(volumeRef.current * 100);
        } catch (e) {
          console.warn('[YT] loadVideoById error:', e);
        }
      };
      loadYt();

    } else {
      // ── Regular audio (Upload / SoundCloud) ───────────────────
      isYtTrackRef.current = false;

      // Stop YouTube player
      if (ytPlayerRef.current && isYtReadyRef.current) {
        try { ytPlayerRef.current.stopVideo(); } catch {}
      }
      if (ytIntervalRef.current) clearInterval(ytIntervalRef.current);

      // Build proxied URL
      let targetUrl = currentTrack.audioUrl;
      if (targetUrl && targetUrl.startsWith('http') && !targetUrl.includes('/api/proxy-audio')) {
        targetUrl = `${API_BASE_URL}/api/proxy-audio?url=${encodeURIComponent(targetUrl)}`;
      }

      const audio = audioRef.current;
      if (!audio) return;
      if (audio.src !== targetUrl) { audio.src = targetUrl; }

      if (isPlaying) {
        resumeAudioContext();
        audio.play().catch(e => console.warn('Audio play error:', e));
      } else {
        audio.pause();
      }
    }

    // MediaSession API
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title:  currentTrack.title  || 'Liofy',
          artist: currentTrack.artist || 'Artist',
          album:  currentTrack.album  || 'Single',
          artwork: [{ src: currentTrack.cover || '', sizes: '512x512', type: 'image/jpeg' }],
        });
        navigator.mediaSession.setActionHandler('play',  () => setIsPlaying(true));
        navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
        navigator.mediaSession.setActionHandler('previoustrack', () => playPrevTrack());
        navigator.mediaSession.setActionHandler('nexttrack',     () => playNextTrack());
      } catch {}
    }
  }, [currentTrack]);

  // Sync play/pause state changes for YouTube
  useEffect(() => {
    if (!isYtTrackRef.current) return;
    if (!ytPlayerRef.current || !isYtReadyRef.current) return;
    try {
      if (isPlaying) ytPlayerRef.current.playVideo();
      else           ytPlayerRef.current.pauseVideo();
    } catch {}
  }, [isPlaying]);

  // Sync play/pause for HTML audio
  useEffect(() => {
    if (isYtTrackRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      resumeAudioContext();
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  const togglePlay = () => {
    if (!currentTrack) return;
    resumeAudioContext();
    setIsPlaying(prev => !prev);
  };

  const playTrack = useCallback(async (track, newQueue = null) => {
    if (!track) return;
    let trackToPlay = { ...track };

    const offlineAudioUrl = await getOfflineTrackAudioUrl(track.id);
    if (offlineAudioUrl) trackToPlay.audioUrl = offlineAudioUrl;

    if (newQueue?.length > 0) setCurrentQueue(newQueue);
    else if (!currentQueueRef.current.length && tracksRef.current.length > 0)
      setCurrentQueue(tracksRef.current);

    if (setTracks) {
      setTracks(prev => {
        const exists = prev.some(t => t.id === trackToPlay.id);
        if (!exists) return [trackToPlay, ...prev];
        return prev.map(t => t.id === trackToPlay.id ? { ...t, plays: (Number(t.plays) || 0) + 1 } : t);
      });
    }

    setCurrentTrack(trackToPlay);
    setIsPlaying(true);
  }, []);

  const playNextTrack = useCallback(() => {
    const rawQueue = currentQueueRef.current.length > 0 ? currentQueueRef.current : tracksRef.current;
    if (!rawQueue?.length) return;
    const activeList = isOfflineMode ? rawQueue.filter(t => t.downloaded) : rawQueue;
    if (!activeList.length) return;
    if (isShuffleRef.current) {
      playTrack(activeList[Math.floor(Math.random() * activeList.length)]);
    } else {
      const idx = activeList.findIndex(t => t.id === currentTrackRef.current?.id);
      playTrack(activeList[(idx + 1) % activeList.length]);
    }
  }, [isOfflineMode, playTrack]);

  const playPrevTrack = useCallback(() => {
    const rawQueue = currentQueueRef.current.length > 0 ? currentQueueRef.current : tracksRef.current;
    if (!rawQueue?.length) return;
    const activeList = isOfflineMode ? rawQueue.filter(t => t.downloaded) : rawQueue;
    if (!activeList.length) return;
    const idx = activeList.findIndex(t => t.id === currentTrackRef.current?.id);
    playTrack(activeList[idx <= 0 ? activeList.length - 1 : idx - 1]);
  }, [isOfflineMode, playTrack]);

  const seekTo = (seconds) => {
    if (isNaN(seconds)) return;
    setCurrentTime(seconds);
    if (isYtTrackRef.current && ytPlayerRef.current && isYtReadyRef.current) {
      try { ytPlayerRef.current.seekTo(seconds, true); } catch {}
    } else if (audioRef.current) {
      audioRef.current.currentTime = seconds;
    }
  };

  const applyEqPreset = (name) => {
    setEqPreset(name);
    let b = { '60Hz': 0, '230Hz': 0, '910Hz': 0, '3.6kHz': 0, '14kHz': 0 };
    if (name === 'Bass Booster')   b = { '60Hz': 7,  '230Hz': 5,  '910Hz': 0,  '3.6kHz': -2, '14kHz': 1 };
    if (name === 'Vocal Booster')  b = { '60Hz': -2, '230Hz': 1,  '910Hz': 6,  '3.6kHz': 5,  '14kHz': 2 };
    if (name === 'Electronic')     b = { '60Hz': 5,  '230Hz': 4,  '910Hz': 1,  '3.6kHz': 4,  '14kHz': 6 };
    if (name === 'Rock')           b = { '60Hz': 6,  '230Hz': 3,  '910Hz': -1, '3.6kHz': 3,  '14kHz': 5 };
    if (name === 'Acoustic')       b = { '60Hz': 3,  '230Hz': 1,  '910Hz': 2,  '3.6kHz': 4,  '14kHz': 3 };
    setEqBands(b);
  };

  const value = {
    currentTrack, setCurrentTrack,
    currentQueue, setCurrentQueue,
    isPlaying, setIsPlaying,
    currentTime, duration,
    volume, setVolume,
    isShuffle, setIsShuffle,
    isRepeat, setIsRepeat,
    isOfflineMode, setIsOfflineMode,
    eqEnabled, setEqEnabled,
    eqPreset, setEqPreset,
    eqBands, setEqBands,
    applyEqPreset,
    togglePlay, playTrack,
    playNextTrack, playPrevTrack,
    seekTo, audioRef,
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error('useAudioPlayer must be used within an AudioProvider');
  return ctx;
}
