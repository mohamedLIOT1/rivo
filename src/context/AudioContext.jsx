import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { initAudioEngine, setEqualizerBands, setMasterVolume, resumeAudioContext, calculateCrossfadeGains, playTrueSpotifyMix, getAudioContext } from '../utils/audioEngine';
import { getTrackMusicalData, checkHarmonicCompatibility } from '../utils/musicAnalysis';
import { getOfflineTrackAudioUrl } from '../utils/offlineStorage';
import { isQuranContent } from '../utils/quranUtils';
import { API_BASE_URL } from '../config';
import { recordListeningTick, onTrackStarted, onTrackEnded } from '../utils/listeningTracker';
import { useUser } from './UserContext';

const AudioPlayerContext = createContext(null);

// ── Duration Sanitizer (handles milliseconds, missing, NaN, or infinite durations) ──
export function sanitizeDuration(val, fallback = 210) {
  if (val === undefined || val === null) return fallback;
  const num = Number(val);
  if (!isFinite(num) || isNaN(num) || num <= 0) return fallback;
  if (num > 10000) return Math.max(1, Math.round(num / 1000));
  if (num > 86400) return fallback;
  return Math.round(num);
}

// ── Extract YouTube video ID from URL ─────────────────────────────
function extractYtId(input) {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();
  const urlMatch = str.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
  if (urlMatch && urlMatch[1] && urlMatch[1].length === 11) return urlMatch[1];
  const prefixMatch = str.match(/^yt[-_]?([a-zA-Z0-9_-]{11})$/i);
  if (prefixMatch && prefixMatch[1] && prefixMatch[1].length === 11) return prefixMatch[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  return null;
}

// ── Direct Audio Stream Resolver (HTML5 <audio> & Web Audio API) ──
async function resolvePlayableAudioStream(track) {
  if (!track) return null;
  const trackId = String(track.id || track._id || '');
  let targetUrl = track.audioUrl || '';

  // 1. Prioritize offline storage / IndexedDB
  try {
    const offlineBlob = await getOfflineTrackAudioUrl(trackId, track.title, track.artist);
    if (offlineBlob) {
      return {
        url: offlineBlob,
        duration: sanitizeDuration(track.duration, 210),
        cover: track.cover || track.coverUrl,
        isOffline: true
      };
    }
  } catch (e) {}

  // 2. Local device files (Capacitor / native files) or Blobs
  const isBlobUrl = targetUrl.startsWith('blob:') || targetUrl.startsWith('data:');
  const isLocalNativeUrl =
    targetUrl && (
      targetUrl.includes('/_capacitor_file_/') ||
      targetUrl.includes('capacitor://') ||
      targetUrl.startsWith('file://') ||
      targetUrl.startsWith('content://') ||
      (targetUrl.startsWith('http://localhost') && !targetUrl.includes(':5000'))
    );
  if (isBlobUrl || isLocalNativeUrl) {
    return {
      url: targetUrl,
      duration: sanitizeDuration(track.duration, 210),
      cover: track.cover || track.coverUrl
    };
  }

  // 3. Native mobile device client-side stream resolution (Instant, zero-proxy)
  if (typeof window !== 'undefined' && typeof window.RIVO_RESOLVE_STREAM === 'function') {
    try {
      const nativeStreamPromise = new Promise((resolve) => {
        const onResolved = (ev) => {
          if (ev.detail && (ev.detail.trackId === trackId || (trackId && ev.detail.trackId?.includes(trackId)))) {
            window.removeEventListener('rivo-receive-resolved-stream', onResolved);
            resolve({
              url: ev.detail.url || null,
              duration: ev.detail.duration ? sanitizeDuration(ev.detail.duration) : null
            });
          }
        };
        window.addEventListener('rivo-receive-resolved-stream', onResolved);
        setTimeout(() => {
          window.removeEventListener('rivo-receive-resolved-stream', onResolved);
          resolve(null);
        }, 3000);
      });
      window.RIVO_RESOLVE_STREAM(track);
      const resolvedData = await nativeStreamPromise;
      if (resolvedData?.url) {
        return {
          url: resolvedData.url,
          duration: resolvedData.duration || sanitizeDuration(track.duration, 210),
          cover: track.cover || track.coverUrl
        };
      }
    } catch (e) {}
  }

  // 4. If URL is already a direct stream proxy
  if (targetUrl && (targetUrl.includes('/api/tracks/stream-proxy') || targetUrl.includes('/api/proxy-audio'))) {
    const fullUrl = targetUrl.startsWith('/') ? `${API_BASE_URL}${targetUrl}` : targetUrl;
    return {
      url: fullUrl,
      duration: sanitizeDuration(track.duration, 210),
      cover: track.cover || track.coverUrl
    };
  }

  const qTitle = encodeURIComponent(track.title || '');
  const qArtist = encodeURIComponent(track.artist || '');

  // 5. Direct backend audio stream endpoint: /api/tracks/:id/stream
  try {
    const sRes = await fetch(`${API_BASE_URL}/api/tracks/${encodeURIComponent(trackId || 'stream')}/stream?url=${encodeURIComponent(targetUrl)}&title=${qTitle}&artist=${qArtist}`);
    if (sRes.ok) {
      const sData = await sRes.json();
      let cand = sData?.url || sData?.directUrl;
      if (cand && !cand.includes('youtube.com/watch') && !cand.includes('youtu.be/')) {
        if (cand.startsWith('/')) cand = `${API_BASE_URL}${cand}`;
        return {
          url: cand,
          duration: sanitizeDuration(sData.duration || track.duration, 210),
          cover: sData.cover || track.cover || track.coverUrl
        };
      }
    }
  } catch (e) {}

  // 6. Direct backend resolve-stream endpoint: /api/tracks/resolve-stream?stream=true
  try {
    const res = await fetch(`${API_BASE_URL}/api/tracks/resolve-stream?stream=true&title=${qTitle}&artist=${qArtist}&url=${encodeURIComponent(targetUrl)}&id=${encodeURIComponent(trackId)}`);
    if (res.ok) {
      const d = await res.json();
      if (d.success && d.url && !d.url.includes('youtube.com/watch') && !d.url.includes('youtu.be/')) {
        let cand = d.url;
        if (cand.startsWith('/')) cand = `${API_BASE_URL}${cand}`;
        return {
          url: cand,
          duration: sanitizeDuration(d.duration || track.duration, 210),
          cover: d.cover || track.cover || track.coverUrl
        };
      }
    }
  } catch (e) {}

  // 7. Last-resort fallback for plain mp3/m4a URLs
  if (targetUrl && (targetUrl.endsWith('.mp3') || targetUrl.endsWith('.m4a'))) {
    let proxied = targetUrl;
    if (targetUrl.startsWith('http') && !targetUrl.includes('/api/proxy-audio')) {
      proxied = `${API_BASE_URL}/api/proxy-audio?url=${encodeURIComponent(targetUrl)}`;
    }
    return {
      url: proxied,
      duration: sanitizeDuration(track.duration, 210),
      cover: track.cover || track.coverUrl
    };
  }

  return null;
}

// ──────────────────────────────────────────────────────────────────

export function AudioProvider({ children, tracks, setTracks }) {
  let userCtx = {};
  try {
    userCtx = useUser() || {};
  } catch {}
  const { likedTrackIds = [], toggleLike } = userCtx;

  const [currentTrack, setCurrentTrack] = useState(null);
  const [currentQueue, setCurrentQueue] = useState([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(210);
  const [volume, setVolumeState] = useState(0.8);
  const [isShuffle, setIsShuffle] = useState(false); // false | 'shuffle' | 'smart'
  const [repeatMode, setRepeatMode] = useState(() => {
    try {
      const saved = localStorage.getItem('rivo_repeat_mode');
      if (saved === 'all' || saved === 'one') return saved;
      const legacy = localStorage.getItem('rivo_repeat') === 'true' || localStorage.getItem('liofy_repeat') === 'true';
      return legacy ? 'all' : 'off';
    } catch {
      return 'off';
    }
  }); // 'off' | 'all' | 'one'
  const isRepeat = repeatMode !== 'off';
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isYtTrack, setIsYtTrack] = useState(false); // exposed for RAF-based lyrics sync

  // Spotify Mix DJ Mode
  const [isMixMode, setIsMixMode] = useState(false);
  const [activeTransitions, setActiveTransitions] = useState(() => {
    try {
      localStorage.removeItem('rivo_active_transitions');
      localStorage.removeItem('liofy_active_transitions');
    } catch {}
    return {};
  });

  // Equalizer State
  const [eqEnabled, setEqEnabled] = useState(true);
  const [eqPreset, setEqPreset] = useState('Bass Booster');
  const [eqBands, setEqBands] = useState({
    '60Hz': 7, '230Hz': 5, '910Hz': 0, '3.6kHz': -2, '14kHz': 1
  });

  const [jamSession, setJamSessionState] = useState(null);

  const repeatModeRef     = useRef(repeatMode);
  const isRepeatRef       = useRef(isRepeat);
  const isShuffleRef      = useRef(isShuffle);
  const isMixModeRef      = useRef(isMixMode);
  const activeTransRef    = useRef(activeTransitions);
  const currentQueueRef   = useRef(currentQueue);
  const currentQueueIndexRef = useRef(currentQueueIndex);
  const tracksRef         = useRef(tracks);
  const currentTrackRef   = useRef(currentTrack);
  const isPlayingRef      = useRef(isPlaying);
  const currentTimeRef    = useRef(currentTime);
  const durationRef       = useRef(duration);
  const jamSessionRef     = useRef(jamSession);

  useEffect(() => { 
    repeatModeRef.current = repeatMode;
    isRepeatRef.current = repeatMode !== 'off';
  }, [repeatMode]);
  const socketRef         = useRef(null);
  const isRemoteActionRef = useRef(false);
  const seekTimeoutRef    = useRef(null);
  const volumeRef         = useRef(0.8);
  const shouldPlayRef     = useRef(false); // Force autoplay on track change
  const lastLoadedUrlRef  = useRef(null);  // Last URL loaded into audio element (prevents interruption on metadata-only changes)
  const lastLoadedIdRef   = useRef(null);  // Last track ID loaded (detects actual track change vs metadata update)
  const isTransitionTriggeredRef = useRef(false);
  const isSeamlessYtHandoffRef   = useRef(false);
  const watchdogRef       = useRef(null);
  const playNextTrackRef  = useRef(null);
  const playPrevTrackRef  = useRef(null);
  const toggleRepeatRef   = useRef(null);
  const toggleShuffleRef  = useRef(null);
  const toggleLikeRef     = useRef(null);
  const seekToRef         = useRef(null);
  const isUserPauseActionRef = useRef(false);

  useEffect(() => { isRepeatRef.current     = isRepeat;    }, [isRepeat]);
  useEffect(() => { isShuffleRef.current    = isShuffle;   }, [isShuffle]);
  useEffect(() => { isMixModeRef.current    = isMixMode;   }, [isMixMode]);
  useEffect(() => { 
    activeTransRef.current = activeTransitions; 
  }, [activeTransitions]);
  useEffect(() => { currentQueueRef.current = currentQueue;}, [currentQueue]);
  useEffect(() => { currentQueueIndexRef.current = currentQueueIndex; }, [currentQueueIndex]);
  useEffect(() => { tracksRef.current       = tracks;      }, [tracks]);
  useEffect(() => { currentTrackRef.current = currentTrack;}, [currentTrack]);
  useEffect(() => { isPlayingRef.current    = isPlaying;   }, [isPlaying]);
  useEffect(() => { currentTimeRef.current = currentTime;  }, [currentTime]);
  useEffect(() => { durationRef.current    = duration;     }, [duration]);
  useEffect(() => { jamSessionRef.current   = jamSession;  }, [jamSession]);

  // Broadcast live listening activity to server for Friend Activity
  useEffect(() => {
    if (!currentTrack) return;
    const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';

    // If socket is available, emit immediate zero-latency listening update
    if (socketRef.current) {
      socketRef.current.emit('activity:listening', { track: currentTrack, isPlaying });
    }

    if (!token) return;

    // Fast sync: 50ms if paused so friends see pause immediately, 800ms when playing to throttle track changes
    const delay = isPlaying ? 800 : 50;
    const timeout = setTimeout(() => {
      fetch(`${API_BASE_URL}/api/users/listening-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ track: currentTrack, isPlaying })
      }).catch(() => {});
    }, delay);

    return () => clearTimeout(timeout);
  }, [currentTrack?.id || currentTrack?._id, isPlaying]);

  // ── Regular HTML Audio element (for uploaded tracks) ──
  const audioRef = useRef(null);
  const secondaryAudioRef = useRef(null);
  const transitionActiveTrackIdRef = useRef(null);
  const activeWebAudioMixRef = useRef(null);

  // YouTube IFrame player completely eliminated — pure direct audio streaming
  const stopYouTube = useCallback(() => {}, []);

  const stopHtmlAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
  }, []);

  // Create Audio element + EQ
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.volume = volumeRef.current;
    initAudioEngine(audio);

    let lastTimeUpdate = 0;
    const handleTimeUpdate = () => {
      if (isYtTrackRef.current) return;
      if (audio && !isNaN(audio.currentTime)) {
        const now = Date.now();
        if (now - lastTimeUpdate > 100) {
          lastTimeUpdate = now;
          setCurrentTime(audio.currentTime);

          // Proactive authentic end-of-track detection for iOS WebKit VBR streams
          // Prevents the player from entering silence when WebKit miscalculates stream duration
          if (durationRef.current > 0 && audio.currentTime >= durationRef.current - 0.75) {
            handleEnded();
            return;
          }

          // Only use audio.duration as last-resort fallback if no authentic duration was ever established
          if ((!durationRef.current || durationRef.current <= 0) && !isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0 && audio.duration < 86400) {
            const rounded = Math.round(audio.duration);
            setDuration(rounded);
            durationRef.current = rounded;
            if (currentTrackRef.current) currentTrackRef.current.duration = rounded;
          }
        }
      }
    };
    const handleLoadedMetadata = () => {
      // Only use audio.duration if no authentic duration is already established
      if ((!durationRef.current || durationRef.current <= 0) && !isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0 && audio.duration < 86400) {
        const rounded = Math.round(audio.duration);
        setDuration(rounded);
        durationRef.current = rounded;
        if (currentTrackRef.current) currentTrackRef.current.duration = rounded;
      }
    };
    const handleEnded = () => {
      onTrackEnded(currentTrackRef.current);
      if (isYtTrackRef.current) return;
      if (repeatModeRef.current === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else if (playNextTrackRef.current) {
        playNextTrackRef.current();
      }
    };
    // ── Key fix: when audio actually starts playing, ensure AudioContext is running & YouTube is killed ──
    const handlePlaying = () => {
      resumeAudioContext();
      if (!isYtTrackRef.current) {
        stopYouTube();
      }
    };
    // If audio gets stuck/stalled, try to resume (only if actively playing)
    const handleStalled = () => {
      if (!isYtTrackRef.current && isPlayingRef.current) {
        setTimeout(() => {
          if (!isPlayingRef.current) return;
          resumeAudioContext();
          audio.play().catch(() => {});
        }, 500);
      }
    };
    const handleError = () => {
      audio.crossOrigin = null;
      if (!isPlayingRef.current && !shouldPlayRef.current) return;
      const cur = currentTrackRef.current;
      if (cur && (cur.title || cur.artist) && !cur._retryDone) {
        cur._retryDone = true;
        fetch(`${API_BASE_URL}/api/tracks/resolve-stream?title=${encodeURIComponent(cur.title || '')}&artist=${encodeURIComponent(cur.artist || '')}`)
          .then(r => r.json())
          .then(d => {
            if (!isPlayingRef.current && !shouldPlayRef.current) return;
            if (d.success && d.url && audio) {
              stopYouTube();
              audio.src = d.url;
              resumeAudioContext();
              audio.play().catch(() => {});
            }
          })
          .catch(() => {});
      }
    };
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('stalled', handleStalled);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('stalled', handleStalled);
      audio.removeEventListener('error', handleError);
      audio.pause();
    };
  }, [stopYouTube]);

  // Fallback / stream retry helper for HTML audio
  const fallbackToHtmlAudio = useCallback(async (track) => {
    if (!track || !audioRef.current) return;
    try {
      const streamData = await resolvePlayableAudioStream(track);
      if (streamData?.url && audioRef.current) {
        audioRef.current.src = streamData.url;
        audioRef.current.volume = volumeRef.current;
        resumeAudioContext();
        await audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    } catch (e) {}
  }, []);

  // EQ sync
  useEffect(() => { setEqualizerBands(eqBands, eqEnabled); }, [eqBands, eqEnabled]);

  const setVolume = (val) => {
    volumeRef.current = val;
    setVolumeState(val);
    setMasterVolume(val);
    if (audioRef.current) audioRef.current.volume = val;
  };

  // ── Real Listening Activity Tracker (Ticks accurate seconds when music is playing) ──
  useEffect(() => {
    if (!isPlaying || !currentTrack) return;

    const ticker = setInterval(() => {
      if (audioRef.current && !audioRef.current.paused && !isNaN(audioRef.current.currentTime) && audioRef.current.currentTime > 0) {
        recordListeningTick(currentTrack, 1);
      }
    }, 1000);

    return () => clearInterval(ticker);
  }, [isPlaying, currentTrack]);

  // ── Main track playback logic (100% Direct Audio API) ──
  useEffect(() => {
    if (!currentTrack) return;

    let isEffectCancelled = false;

    (async () => {
      const newId = String(currentTrack.id || currentTrack._id || '');
      const newUrl = currentTrack.audioUrl || '';

      // Guard: if track ID and audioUrl haven't changed, this is a metadata-only update
      if (newId === lastLoadedIdRef.current && newUrl === lastLoadedUrlRef.current && lastLoadedUrlRef.current) {
        return;
      }

      lastLoadedIdRef.current = newId;
      lastLoadedUrlRef.current = newUrl;

      // Ensure duration is set
      const sDur = sanitizeDuration(currentTrack.duration, 210);
      setDuration(sDur);
      durationRef.current = sDur;

      const streamResult = await resolvePlayableAudioStream(currentTrack);
      if (isEffectCancelled) return;

      if (!streamResult?.url) {
        console.warn('[AudioContext] Could not resolve audio stream for track:', currentTrack.title);
        return;
      }

      if (streamResult.cover && streamResult.cover !== currentTrack.cover) {
        setCurrentTrack(prev => prev ? { ...prev, cover: streamResult.cover } : prev);
      }
      if (streamResult.duration && streamResult.duration > 0) {
        const resolvedDur = sanitizeDuration(streamResult.duration, sDur);
        setDuration(resolvedDur);
        durationRef.current = resolvedDur;
      }

      const audio = audioRef.current;
      if (!audio) return;

      if (audio.src !== streamResult.url) {
        audio.src = streamResult.url;
      }
      audio.volume = volumeRef.current;

      if (isPlayingRef.current || shouldPlayRef.current) {
        shouldPlayRef.current = false;
        resumeAudioContext();
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            console.warn('[Audio] play() blocked or waiting for gesture:', e.name);
            const retryPlay = () => {
              if (!isPlayingRef.current) return;
              resumeAudioContext();
              audio.play().catch(() => {});
              document.removeEventListener('touchstart', retryPlay);
              document.removeEventListener('click', retryPlay);
            };
            document.addEventListener('touchstart', retryPlay, { once: true, passive: true });
            document.addEventListener('click', retryPlay, { once: true });
          });
        }
        setIsPlaying(true);
      } else {
        audio.pause();
      }
    })();

    return () => {
      isEffectCancelled = true;
    };
  }, [currentTrack]);

  // ── MediaSession API (Lockscreen & Bluetooth Controls) ──
  useEffect(() => {
    if (!currentTrack || typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
    try {
      const coverSrc = currentTrack.cover || currentTrack.coverUrl || '';
      const cleanAlbum = (!currentTrack.album || /https?:\/\/|www\.|youtube|liofy/i.test(currentTrack.album)) ? 'Rivo' : currentTrack.album;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || 'Rivo',
        artist: currentTrack.artist || 'Artist',
        album: cleanAlbum || 'Rivo',
        artwork: coverSrc ? [{ src: coverSrc, sizes: '512x512', type: 'image/jpeg' }] : [],
      });
      navigator.mediaSession.setActionHandler('play', () => {
        isUserPauseActionRef.current = false;
        resumeAudioContext();
        if (audioRef.current) {
          audioRef.current.play().catch(() => {});
        }
        setIsPlaying(true);
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        isUserPauseActionRef.current = true;
        if (audioRef.current) {
          audioRef.current.pause();
        }
        setIsPlaying(false);
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        isUserPauseActionRef.current = false;
        if (playPrevTrackRef.current) playPrevTrackRef.current();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        isUserPauseActionRef.current = false;
        if (playNextTrackRef.current) playNextTrackRef.current();
      });
      // Explicitly register seekto so system notification slider seeks accurately, while clearing 10s skip handlers
      try {
        navigator.mediaSession.setActionHandler('seekto', (details) => {
          if (details && typeof details.seekTime === 'number') {
            if (seekToRef.current) seekToRef.current(details.seekTime);
          }
        });
        navigator.mediaSession.setActionHandler('seekforward', (details) => {
          const step = details?.seekOffset || 10;
          if (seekToRef.current && currentTimeRef.current != null) {
            seekToRef.current(Math.min(durationRef.current || 999999, (currentTimeRef.current || 0) + step));
          }
        });
        navigator.mediaSession.setActionHandler('seekbackward', (details) => {
          const step = details?.seekOffset || 10;
          if (seekToRef.current && currentTimeRef.current != null) {
            seekToRef.current(Math.max(0, (currentTimeRef.current || 0) - step));
          }
        });
        navigator.mediaSession.setActionHandler('skipforward', () => {
          if (playNextTrackRef.current) playNextTrackRef.current();
        });
        navigator.mediaSession.setActionHandler('skipbackward', () => {
          if (playPrevTrackRef.current) playPrevTrackRef.current();
        });
      } catch {}
    } catch {}
  }, [currentTrack]);

  useEffect(() => {
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        if ('setPositionState' in navigator.mediaSession && duration && duration > 0 && !isNaN(duration)) {
          navigator.mediaSession.setPositionState({
            duration: Math.max(1, duration),
            playbackRate: isPlaying ? 1 : 0,
            position: Math.min(duration, Math.max(0, currentTime || 0))
          });
        }
      } catch {}
    }
  }, [isPlaying, currentTime, duration]);

  // ── Native Media Controls Bridge (Android Lockscreen & Background Notification) ──
  useEffect(() => {
    if (!currentTrack || typeof window === 'undefined' || !window.ReactNativeWebView || !window.ReactNativeWebView.postMessage) return;
    try {
      const isLiked = likedTrackIds.some(id => String(id) === String(currentTrack._id || currentTrack.id));
      const coverSrc = currentTrack.cover || currentTrack.coverUrl || '';
      const safeDuration = sanitizeDuration(duration || currentTrack.duration, 240);
      const safeTime = (currentTime && isFinite(currentTime) && currentTime > 0)
        ? (currentTime > 10000 ? Math.round(currentTime / 1000) : currentTime)
        : 0;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'PLAYBACK_STATE',
        isPlaying: Boolean(isPlaying),
        repeatMode: repeatMode,
        isRepeat: repeatMode !== 'off',
        isShuffle: Boolean(isShuffle),
        isLiked: isLiked,
        duration: safeDuration,
        currentTime: safeTime,
        track: {
          id: currentTrack._id || currentTrack.id,
          _id: currentTrack._id || currentTrack.id,
          title: currentTrack.title || 'Unknown Track',
          artist: currentTrack.artist || 'Unknown Artist',
          coverUrl: coverSrc,
          cover: coverSrc,
          audioUrl: currentTrack.audioUrl || '',
          duration: safeDuration,
          currentTime: safeTime,
          liked: isLiked,
        }
      }));
    } catch (e) {}
  }, [currentTrack, isPlaying, repeatMode, isShuffle, likedTrackIds, duration]);

  // Periodic time sync to keep Android Notification Seekbar accurate
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      if (typeof window !== 'undefined' && window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        try {
          const curT = currentTrackRef.current;
          if (curT) {
            const isLiked = likedTrackIds.some(id => String(id) === String(curT._id || curT.id));
            const coverSrc = curT.cover || curT.coverUrl || '';
            const safeDuration = sanitizeDuration(duration || curT.duration, 240);
            const rawT = currentTimeRef.current || 0;
            const safeTime = (rawT && isFinite(rawT) && rawT > 0)
              ? (rawT > 10000 ? Math.round(rawT / 1000) : rawT)
              : 0;
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'PLAYBACK_STATE',
              isPlaying: true,
              repeatMode: repeatMode,
              isRepeat: repeatMode !== 'off',
              isShuffle: Boolean(isShuffle),
              isLiked: isLiked,
              duration: safeDuration,
              currentTime: safeTime,
              track: {
                id: curT._id || curT.id,
                _id: curT._id || curT.id,
                title: curT.title || 'Unknown Track',
                artist: curT.artist || 'Unknown Artist',
                coverUrl: coverSrc,
                cover: coverSrc,
                audioUrl: curT.audioUrl || '',
                duration: safeDuration,
                currentTime: safeTime,
                liked: isLiked,
              }
            }));
          }
        } catch {}
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [isPlaying, repeatMode, isShuffle, likedTrackIds, duration]);

  

  // Sync play/pause for HTML audio (as safety backup)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying && audio.paused && audio.src) {
      resumeAudioContext();
      audio.play().catch(() => {});
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__RIVO_IS_PLAYING = Boolean(isPlaying);
      if (isPlaying) {
        window.__RIVO_USER_PAUSED = false;
      }
    }
  }, [isPlaying]);

  // ── Synchronous Direct Play/Pause to satisfy Mobile Autoplay & User Gesture ──
  const togglePlay = useCallback((isRemote = false) => {
    if (!currentTrackRef.current) return;
    resumeAudioContext();
    const nextPlaying = !isPlayingRef.current;
    isUserPauseActionRef.current = !nextPlaying;
    setIsPlaying(nextPlaying);

    if (!isRemote && jamSessionRef.current && socketRef.current) {
      socketRef.current.emit('jam:sync_play_state', {
        roomCode: jamSessionRef.current.code,
        isPlaying: nextPlaying,
        currentTrack: currentTrackRef.current,
        currentTime: currentTimeRef.current
      });
    }

    const audio = audioRef.current;
    if (audio) {
      if (nextPlaying) {
        resumeAudioContext();
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            console.warn('[Audio] synchronous play rejected on phone:', e);
          });
        }
      } else {
        audio.pause();
      }
    }
  }, []);

  // Handle media actions dispatched from Native Android notification / lockscreen
  useEffect(() => {
    window.__RIVO_NEXT_TRACK = () => {
      if (playNextTrackRef.current) playNextTrackRef.current();
    };
    window.__RIVO_PREV_TRACK = () => {
      if (playPrevTrackRef.current) playPrevTrackRef.current();
    };
    window.__RIVO_TOGGLE_PLAY = () => {
      togglePlay();
    };
    window.__RIVO_MEDIA_ACTION = (action) => {
      if (action === 'play') {
        if (!isPlayingRef.current) togglePlay();
      } else if (action === 'pause') {
        if (isPlayingRef.current) togglePlay();
      } else if (action === 'play_pause' || action === 'toggle') {
        togglePlay();
      } else if (action === 'next') {
        if (playNextTrackRef.current) playNextTrackRef.current();
      } else if (action === 'prev') {
        if (playPrevTrackRef.current) playPrevTrackRef.current();
      } else if (action === 'repeat') {
        if (toggleRepeatRef.current) toggleRepeatRef.current();
      } else if (action === 'shuffle') {
        if (toggleShuffleRef.current) toggleShuffleRef.current();
      } else if (action === 'like') {
        const cur = currentTrackRef.current;
        if (cur && toggleLikeRef.current) {
          toggleLikeRef.current(cur._id || cur.id);
        }
      } else if (typeof action === 'string' && action.startsWith('seek:')) {
        const secs = parseFloat(action.split(':')[1]);
        if (!isNaN(secs) && seekToRef.current) seekToRef.current(secs);
      }
    };
    window.__RIVO_MEDIA_SEEK = (sec) => {
      if (!isNaN(sec) && seekToRef.current) seekToRef.current(sec);
    };
    return () => {
      delete window.__RIVO_MEDIA_ACTION;
      delete window.__RIVO_MEDIA_SEEK;
      delete window.__RIVO_NEXT_TRACK;
      delete window.__RIVO_PREV_TRACK;
      delete window.__RIVO_TOGGLE_PLAY;
    };
  }, [togglePlay]);

  const playTrack = useCallback(async (track, newQueue = null, isRemote = false, queueIndex = null) => {
    if (!track) return;

    // Track daily listening seed for dynamic personalized mixes
    try {
      const isQuran = (track.genre && track.genre.toLowerCase().includes('quran')) ||
                      (track.artist && (track.artist.includes('القارئ') || track.artist.includes('شيخ')));
      if (!isQuran) {
        const todayStr = new Date().toDateString();
        const existingDate = localStorage.getItem('rivo_daily_seed_date') || localStorage.getItem('liofy_daily_seed_date');
        if (existingDate !== todayStr || (!localStorage.getItem('rivo_daily_seed_track') && !localStorage.getItem('liofy_daily_seed_track'))) {
          localStorage.setItem('rivo_daily_seed_date', todayStr);
          localStorage.setItem('liofy_daily_seed_date', todayStr);
          const seedData = JSON.stringify({
            id: track.id || track._id,
            title: track.title,
            artist: track.artist,
            genre: track.genre,
            cover: track.cover
          });
          localStorage.setItem('rivo_daily_seed_track', seedData);
          localStorage.setItem('liofy_daily_seed_track', seedData);
          window.dispatchEvent(new CustomEvent('rivo:daily-seed-updated'));
          window.dispatchEvent(new CustomEvent('liofy:daily-seed-updated'));
        }
        const lastData = JSON.stringify({
          id: track.id || track._id,
          title: track.title,
          artist: track.artist,
          genre: track.genre,
          cover: track.cover
        });
        localStorage.setItem('rivo_last_played_music_track', lastData);
        localStorage.setItem('liofy_last_played_music_track', lastData);
      }
    } catch {}

    const isSeamless = isSeamlessYtHandoffRef.current;
    isTransitionTriggeredRef.current = false;
    transitionActiveTrackIdRef.current = null;
    if (activeWebAudioMixRef.current) {
      activeWebAudioMixRef.current.stop();
      activeWebAudioMixRef.current = null;
    }
    if (secondaryAudioRef.current && !isSeamless) {
      secondaryAudioRef.current.pause();
      secondaryAudioRef.current.removeAttribute('src');
    }
    resumeAudioContext();
    isUserPauseActionRef.current = false;

    if (!isSeamless) {
      // Immediately stop previous audio synchronously to prevent overlap
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }

    let trackToPlay = { ...track };

    const offlineAudioUrl = await getOfflineTrackAudioUrl(track.id || track._id, track.title, track.artist);
    if (offlineAudioUrl) {
      trackToPlay.audioUrl = offlineAudioUrl;
      trackToPlay.downloaded = true;
      trackToPlay.nativeAudioUri = offlineAudioUrl;
      trackToPlay.album = (!trackToPlay.album || /https?:\/\/|www\.|youtube|liofy/i.test(trackToPlay.album)) ? 'Rivo' : trackToPlay.album;
      trackToPlay.source = 'Rivo';
    }

    // ── STRICT QUEUE ISOLATION (Quran vs Music) ──
    const isTargetQuran = isQuranContent(trackToPlay);
    let resolvedQueue = currentQueueRef.current;
    if (newQueue?.length > 0) {
      const sanitized = newQueue.filter(t => isTargetQuran ? isQuranContent(t) : !isQuranContent(t));
      if (sanitized.length > 0) {
        resolvedQueue = sanitized;
        setCurrentQueue(sanitized);
      } else {
        const pool = tracksRef.current.filter(t => isTargetQuran ? isQuranContent(t) : !isQuranContent(t));
        resolvedQueue = pool.length > 0 ? pool : [trackToPlay];
        setCurrentQueue(resolvedQueue);
      }
    } else {
      const curQ = currentQueueRef.current;
      const targetId = String(trackToPlay.id || trackToPlay._id || '');
      const isTrackInCurQ = curQ.some(t => String(t.id || t._id) === targetId);

      // If playing remotely or if track is completely absent from current queue, build contextual queue from library
      if (!isTrackInCurQ) {
        const pool = tracksRef.current.filter(t => isTargetQuran ? isQuranContent(t) : !isQuranContent(t));
        const hasInPool = pool.some(t => String(t.id || t._id) === targetId);
        resolvedQueue = hasInPool ? pool : [trackToPlay, ...pool];
        setCurrentQueue(resolvedQueue);
      } else {
        // Check if current queue is strictly composed of the same type
        const curQMatchesType = curQ.length > 0 && curQ.every(t => isTargetQuran ? isQuranContent(t) : !isQuranContent(t));
        if (!curQMatchesType) {
          const pool = tracksRef.current.filter(t => isTargetQuran ? isQuranContent(t) : !isQuranContent(t));
          resolvedQueue = pool.length > 0 ? pool : [trackToPlay];
          setCurrentQueue(resolvedQueue);
        }
      }
    }

    // Set and track active queue index accurately (handles duplicate tracks in queue)
    if (queueIndex !== null && queueIndex !== undefined && queueIndex >= 0) {
      currentQueueIndexRef.current = queueIndex;
      setCurrentQueueIndex(queueIndex);
    } else {
      const targetId = String(trackToPlay.id || trackToPlay._id || '');
      const existingIdx = currentQueueIndexRef.current;
      if (existingIdx >= 0 && existingIdx < resolvedQueue.length && String(resolvedQueue[existingIdx]?.id || resolvedQueue[existingIdx]?._id) === targetId) {
        // Keep existing currentQueueIndexRef as is
      } else {
        const foundIdx = resolvedQueue.findIndex(t => String(t.id || t._id) === targetId);
        const safeIdx = foundIdx >= 0 ? foundIdx : 0;
        currentQueueIndexRef.current = safeIdx;
        setCurrentQueueIndex(safeIdx);
      }
    }

    onTrackStarted(trackToPlay);

    if (setTracks) {
      setTracks(prev => {
        const exists = prev.some(t => t.id === trackToPlay.id);
        if (!exists) return [trackToPlay, ...prev];
        return prev.map(t => t.id === trackToPlay.id ? { ...t, plays: (Number(t.plays) || 0) + 1 } : t);
      });
    }

    // Broadcast track play event to Jam room if active and local action
    if (!isRemote && jamSessionRef.current && socketRef.current) {
      socketRef.current.emit('jam:sync_play_state', {
        roomCode: jamSessionRef.current.code,
        currentTrack: trackToPlay,
        isPlaying: true,
        currentTime: 0
      });
    }

    // Signal that the next currentTrack change should autoplay
    shouldPlayRef.current = true;
    currentTrackRef.current = trackToPlay;
    const initDur = (trackToPlay.duration && trackToPlay.duration > 0 && trackToPlay.duration < 86400)
      ? sanitizeDuration(trackToPlay.duration)
      : 0;
    if (initDur > 0) {
      setDuration(initDur);
      durationRef.current = initDur;
    }
    setCurrentTrack(trackToPlay);
    setIsPlaying(true);

    if (typeof window !== 'undefined' && window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      try {
        const isLiked = likedTrackIds.some(id => String(id) === String(trackToPlay._id || trackToPlay.id));
        const coverSrc = trackToPlay.cover || trackToPlay.coverUrl || '';
        const safeTrackDuration = initDur > 0
          ? initDur
          : (durationRef.current > 0 ? durationRef.current : 210);
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'PLAYBACK_STATE',
          isPlaying: true,
          repeatMode: repeatMode,
          isRepeat: repeatMode !== 'off',
          isShuffle: Boolean(isShuffle),
          isLiked: isLiked,
          duration: safeTrackDuration,
          currentTime: 0,
          track: {
            id: trackToPlay._id || trackToPlay.id,
            _id: trackToPlay._id || trackToPlay.id,
            title: trackToPlay.title || 'Unknown Track',
            artist: trackToPlay.artist || 'Unknown Artist',
            coverUrl: coverSrc,
            cover: coverSrc,
            audioUrl: trackToPlay.audioUrl || '',
            album: (!trackToPlay.album || /https?:\/\/|www\.|youtube|liofy/i.test(trackToPlay.album)) ? 'Rivo' : trackToPlay.album,
            duration: safeTrackDuration,
            currentTime: 0,
            liked: isLiked,
          }
        }));
      } catch {}
    }
  }, [setTracks]);

  const fetchSmartShuffleTracks = useCallback(async (seedTrack, currentList = []) => {
    if (!seedTrack) return;
    try {
      let followed = [];
      try {
        const raw = localStorage.getItem('rivo_followed_artists') || localStorage.getItem('liofy_followed_artists');
        if (raw) followed = JSON.parse(raw);
      } catch {}

      const res = await fetch(`${API_BASE_URL}/api/ai/smart-shuffle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentTrack: seedTrack,
          seedTracks: currentList.slice(0, 5),
          followedArtists: followed,
          limit: 6
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
        const markedTracks = data.tracks.map(t => ({
          ...t,
          isAiSuggestion: true,
          isSmartShuffle: true
        }));
        setCurrentQueue(prev => {
          const existingIds = new Set(prev.map(t => String(t.id || t._id)));
          const fresh = markedTracks.filter(t => !existingIds.has(String(t.id || t._id)));
          return [...prev, ...fresh];
        });
      }
    } catch (err) {
      console.warn('[Smart Shuffle] fetch error:', err);
    }
  }, []);

  const addToQueue = useCallback((track, playNext = false) => {
    if (!track) return;
    if (!currentTrackRef.current) {
      playTrack(track, [track], false, 0);
      return;
    }
    const isCurQuran = isQuranContent(currentTrackRef.current);
    if (isCurQuran !== isQuranContent(track)) return;
    setCurrentQueue(prev => {
      const currentList = Array.isArray(prev) ? prev : [];
      const curId = String(currentTrackRef.current?.id || currentTrackRef.current?._id || '');
      if (playNext) {
        let curIdx = currentQueueIndexRef.current;
        if (curIdx < 0 || curIdx >= currentList.length || String(currentList[curIdx]?.id || currentList[curIdx]?._id) !== curId) {
          curIdx = curId ? currentList.findIndex(t => String(t.id || t._id) === curId) : -1;
        }
        if (curIdx >= 0) {
          const updated = [...currentList];
          updated.splice(curIdx + 1, 0, track);
          return updated;
        }
      }
      return [...currentList, track];
    });
  }, [playTrack]);

  const removeFromQueue = useCallback((trackIdOrIndex) => {
    setCurrentQueue(prev => {
      if (!Array.isArray(prev)) return [];
      let removedIndex = -1;
      let nextList = [];
      if (typeof trackIdOrIndex === 'number') {
        removedIndex = trackIdOrIndex;
        nextList = prev.filter((_, idx) => idx !== trackIdOrIndex);
      } else {
        const targetId = String(trackIdOrIndex);
        removedIndex = prev.findIndex(t => String(t.id || t._id) === targetId);
        nextList = prev.filter((_, idx) => idx !== removedIndex);
      }

      if (removedIndex >= 0) {
        const cur = currentQueueIndexRef.current;
        if (cur === removedIndex) {
          if (cur >= nextList.length) {
            currentQueueIndexRef.current = Math.max(0, nextList.length - 1);
            setCurrentQueueIndex(currentQueueIndexRef.current);
          }
        } else if (cur > removedIndex) {
          currentQueueIndexRef.current = cur - 1;
          setCurrentQueueIndex(cur - 1);
        }
      }
      return nextList;
    });
  }, []);

  const reorderQueue = useCallback((fromIndex, toIndex) => {
    setCurrentQueue(prev => {
      if (!Array.isArray(prev) || fromIndex < 0 || toIndex < 0 || fromIndex >= prev.length || toIndex >= prev.length) {
        return prev;
      }
      if (fromIndex === toIndex) return prev;

      const updated = [...prev];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);

      // Accurately adjust currentQueueIndex
      const curIdx = currentQueueIndexRef.current;
      if (curIdx >= 0) {
        let newCurIdx = curIdx;
        if (curIdx === fromIndex) {
          newCurIdx = toIndex;
        } else if (fromIndex < curIdx && toIndex >= curIdx) {
          newCurIdx = curIdx - 1;
        } else if (fromIndex > curIdx && toIndex <= curIdx) {
          newCurIdx = curIdx + 1;
        }
        currentQueueIndexRef.current = newCurIdx;
        setCurrentQueueIndex(newCurIdx);
      }

      return updated;
    });
  }, []);

  const clearQueue = useCallback(() => {
    if (currentTrackRef.current) {
      setCurrentQueue([currentTrackRef.current]);
      currentQueueIndexRef.current = 0;
      setCurrentQueueIndex(0);
    } else {
      setCurrentQueue([]);
      currentQueueIndexRef.current = -1;
      setCurrentQueueIndex(-1);
    }
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle(prev => {
      if (!prev || prev === false) return 'shuffle';
      if (prev === 'shuffle' || prev === true) {
        if (currentTrackRef.current) {
          fetchSmartShuffleTracks(currentTrackRef.current, currentQueueRef.current);
        }
        return 'smart';
      }
      return false;
    });
  }, [fetchSmartShuffleTracks]);

  const toggleRepeat = useCallback(() => {
    setRepeatMode(prev => {
      const next = prev === 'off' ? 'all' : (prev === 'all' ? 'one' : 'off');
      try {
        localStorage.setItem('rivo_repeat_mode', next);
        localStorage.setItem('rivo_repeat', next !== 'off' ? 'true' : 'false');
      } catch {}
      return next;
    });
  }, []);

  const setIsRepeat = useCallback((valOrFn) => {
    setRepeatMode(prev => {
      let nextMode;
      if (typeof valOrFn === 'function') {
        const prevBool = prev !== 'off';
        const res = valOrFn(prevBool);
        if (typeof res === 'boolean') {
          nextMode = res ? (prev === 'off' ? 'all' : (prev === 'all' ? 'one' : 'off')) : 'off';
        } else {
          nextMode = res;
        }
      } else if (typeof valOrFn === 'boolean') {
        nextMode = valOrFn ? (prev === 'off' ? 'all' : prev) : 'off';
      } else {
        nextMode = valOrFn;
      }
      try {
        localStorage.setItem('rivo_repeat_mode', nextMode);
        localStorage.setItem('rivo_repeat', nextMode !== 'off' ? 'true' : 'false');
      } catch {}
      return nextMode;
    });
  }, []);

  const playNextTrack = useCallback(() => {
    // Advance shared room queue if active in Jam
    if (jamSessionRef.current && socketRef.current) {
      if (jamSessionRef.current.queue && jamSessionRef.current.queue.length > 0) {
        socketRef.current.emit('jam:next_track', { roomCode: jamSessionRef.current.code });
        return;
      }
      // If Jam room queue is empty: check if this client is the host
      const myId = socketRef.current?.id;
      const isHost = jamSessionRef.current.hostId === myId ||
        jamSessionRef.current.members?.find(m => m.socketId === myId)?.isHost;
      if (!isHost) {
        // Guest: emit jam:next_track so server asks host to advance
        socketRef.current.emit('jam:next_track', { roomCode: jamSessionRef.current.code });
        return;
      }
      // Host: falls through to advance host's queue below and sync to all listeners!
    }

    const isCurQuran = isQuranContent(currentTrackRef.current);
    const rawQueue = currentQueueRef.current.length > 0 ? currentQueueRef.current : tracksRef.current;
    if (!rawQueue?.length) return;
    const typeIsolated = rawQueue.filter(t => isCurQuran ? isQuranContent(t) : !isQuranContent(t));
    const pool = (typeIsolated.length > 1) ? typeIsolated : (tracksRef.current.filter(t => isCurQuran ? isQuranContent(t) : !isQuranContent(t)).length > 0 ? tracksRef.current.filter(t => isCurQuran ? isQuranContent(t) : !isQuranContent(t)) : typeIsolated);
    const activeList = isOfflineMode ? pool.filter(t => t.downloaded) : pool;
    if (!activeList.length) return;

    // Immediately stop current audio only if NOT a seamless handoff
    if (audioRef.current) audioRef.current.pause();

    const isSmart = isShuffleRef.current === 'smart';
    if (isSmart) {
      const cur = currentTrackRef.current;
      const curId = String(cur?.id || cur?._id || '');
      const candidates = activeList.filter(t => String(t.id || t._id) !== curId);

      let followed = [];
      try {
        const raw = localStorage.getItem('rivo_followed_artists') || localStorage.getItem('liofy_followed_artists');
        if (raw) followed = JSON.parse(raw);
      } catch {}

      // Intelligent AI scoring based on Followed Artists + Harmonic Camelot Key + BPM Proximity
      const curMusical = getTrackMusicalData(cur);
      const scoredCandidates = candidates.map(t => {
        let score = 0;
        const tArtist = (t.artist || '').toLowerCase();
        // 1. Followed Artist match (+50 points)
        if (followed.some(fa => tArtist.includes(fa.toLowerCase()))) {
          score += 50;
        }
        // 2. Harmonic Key & BPM match (+30 points)
        const tMusical = getTrackMusicalData(t);
        const harm = checkHarmonicCompatibility(curMusical.key, tMusical.key, curMusical.bpm, tMusical.bpm);
        score += (harm.score || 50) * 0.3; // up to 30 points

        // 3. Play count popularity bonus (up to 10 points)
        const plays = Number(t.plays) || 0;
        score += Math.min(10, plays * 0.5);

        // 4. Smart Shuffle flag (+20 points)
        if (t.isSmartShuffle) score += 20;

        return { track: t, score };
      });

      scoredCandidates.sort((a, b) => b.score - a.score);
      const chosen = (scoredCandidates.length > 0)
        ? scoredCandidates[0].track
        : activeList[0];

      if (candidates.length <= 3 && cur) {
        fetchSmartShuffleTracks(cur, activeList);
      }
      const chosenIdx = activeList.indexOf(chosen);
      const safeChosenIdx = chosenIdx >= 0 ? chosenIdx : 0;
      currentQueueIndexRef.current = safeChosenIdx;
      setCurrentQueueIndex(safeChosenIdx);
      playTrack(chosen, activeList, false, safeChosenIdx);
    } else if (isShuffleRef.current) {
      const nextIdx = Math.floor(Math.random() * activeList.length);
      currentQueueIndexRef.current = nextIdx;
      setCurrentQueueIndex(nextIdx);
      playTrack(activeList[nextIdx], activeList, false, nextIdx);
    } else if (isOfflineMode) {
      const offlineQueue = activeList.filter(t => t.downloaded || t.isOffline);
      if (offlineQueue.length === 0) return;
      const curId = String(currentTrackRef.current?.id || currentTrackRef.current?._id);
      const idx = offlineQueue.findIndex(t => String(t.id || t._id) === curId);
      const nextIdx = (idx + 1) % offlineQueue.length;
      currentQueueIndexRef.current = nextIdx;
      setCurrentQueueIndex(nextIdx);
      playTrack(offlineQueue[nextIdx], offlineQueue, false, nextIdx);
    } else {
      const curId = String(currentTrackRef.current?.id || currentTrackRef.current?._id);
      let idx = -1;
      if (currentQueueIndexRef.current >= 0 && currentQueueIndexRef.current < activeList.length &&
          String(activeList[currentQueueIndexRef.current]?.id || activeList[currentQueueIndexRef.current]?._id) === curId) {
        idx = currentQueueIndexRef.current;
      } else {
        idx = activeList.findIndex(t => String(t.id || t._id) === curId);
      }
      
      const normalTracks = activeList.filter(t => !t.isAiSuggestion && !t.isSmartShuffle);
      const isCurInNormal = normalTracks.some(t => String(t.id || t._id) === curId);

      // If repeatMode is 'all' (or legacy isRepeat) and user is in the playlist queue, loop strictly within the playlist queue!
      if ((repeatModeRef.current === 'all' || isRepeatRef.current) && isCurInNormal && normalTracks.length > 0) {
        const normalWithIndices = [];
        activeList.forEach((t, i) => {
          if (!t.isAiSuggestion && !t.isSmartShuffle) {
            normalWithIndices.push({ track: t, index: i });
          }
        });
        const currentPosInNormal = normalWithIndices.findIndex(item => item.index === idx);
        const pos = currentPosInNormal >= 0 ? currentPosInNormal : normalWithIndices.findIndex(item => String(item.track.id || item.track._id) === curId);
        const nextPos = (pos >= 0 ? pos + 1 : 0) % normalWithIndices.length;
        const nextIdx = normalWithIndices[nextPos].index;
        currentQueueIndexRef.current = nextIdx;
        setCurrentQueueIndex(nextIdx);
        playTrack(activeList[nextIdx], activeList, false, nextIdx);
      } else {
        let targetList = activeList;
        let nextIdx = (idx + 1) % targetList.length;
        if (targetList.length <= 1 && tracksRef.current && tracksRef.current.length > 1) {
          const pool = tracksRef.current.filter(t => isCurQuran ? isQuranContent(t) : !isQuranContent(t));
          if (pool.length > 1) {
            targetList = pool;
            const curIdxInPool = pool.findIndex(t => String(t.id || t._id) === curId);
            nextIdx = (curIdxInPool + 1) % pool.length;
          }
        }
        currentQueueIndexRef.current = nextIdx;
        setCurrentQueueIndex(nextIdx);
        playTrack(targetList[nextIdx], targetList, false, nextIdx);
      }
    }
    // Force playing state so song starts automatically
    setIsPlaying(true);
  }, [isOfflineMode, playTrack, fetchSmartShuffleTracks]);

  useEffect(() => {
    playNextTrackRef.current = playNextTrack;
  }, [playNextTrack]);

  const playPrevTrack = useCallback(() => {
    if ((currentTimeRef.current || 0) > 3) {
      if (seekToRef.current) seekToRef.current(0);
      return;
    }
    isTransitionTriggeredRef.current = false;
    isSeamlessYtHandoffRef.current = false;
    const isCurQuran = isQuranContent(currentTrackRef.current);
    const rawQueue = currentQueueRef.current.length > 0 ? currentQueueRef.current : tracksRef.current;
    if (!rawQueue?.length) return;
    const typeIsolated = rawQueue.filter(t => isCurQuran ? isQuranContent(t) : !isQuranContent(t));
    const pool = (typeIsolated.length > 1) ? typeIsolated : (tracksRef.current.filter(t => isCurQuran ? isQuranContent(t) : !isQuranContent(t)).length > 0 ? tracksRef.current.filter(t => isCurQuran ? isQuranContent(t) : !isQuranContent(t)) : typeIsolated);
    const activeList = isOfflineMode ? pool.filter(t => t.downloaded) : pool;
    if (!activeList.length) return;

    // Immediately stop current audio
    if (audioRef.current) audioRef.current.pause();

    const cur = currentTrackRef.current;
    const curId = String(cur?.id || cur?._id || '');
    let idx = -1;
    if (currentQueueIndexRef.current >= 0 && currentQueueIndexRef.current < activeList.length &&
        String(activeList[currentQueueIndexRef.current]?.id || activeList[currentQueueIndexRef.current]?._id) === curId) {
      idx = currentQueueIndexRef.current;
    } else {
      idx = activeList.findIndex(t => String(t.id || t._id) === curId);
    }
    const prevIdx = idx > 0 ? idx - 1 : activeList.length - 1;
    currentQueueIndexRef.current = prevIdx;
    setCurrentQueueIndex(prevIdx);
    playTrack(activeList[prevIdx], activeList, false, prevIdx);
    // Force playing state so song starts automatically
    setIsPlaying(true);
  }, [isOfflineMode, playTrack]);

  useEffect(() => {
    playPrevTrackRef.current = playPrevTrack;
  }, [playPrevTrack]);

  const seekTo = useCallback((seconds, isRemote = false) => {
    if (isNaN(seconds)) return;
    isTransitionTriggeredRef.current = false;
    const s = Math.max(0, seconds);
    setCurrentTime(s);
    currentTimeRef.current = s;

    if (audioRef.current) {
      try {
        audioRef.current.currentTime = s;
        audioRef.current.volume = volumeRef.current;
      } catch {}
    }

    if (!isRemote && jamSessionRef.current && socketRef.current) {
      if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
      seekTimeoutRef.current = setTimeout(() => {
        if (jamSessionRef.current && socketRef.current) {
          socketRef.current.emit('jam:sync_play_state', {
            roomCode: jamSessionRef.current.code,
            currentTime: s,
            isPlaying: isPlayingRef.current,
            currentTrack: currentTrackRef.current
          });
        }
      }, 150);
    }
  }, []);

  useEffect(() => {
    toggleRepeatRef.current = toggleRepeat;
  }, [toggleRepeat]);

  useEffect(() => {
    toggleShuffleRef.current = toggleShuffle;
  }, [toggleShuffle]);

  useEffect(() => {
    toggleLikeRef.current = toggleLike;
  }, [toggleLike]);

  useEffect(() => {
    seekToRef.current = seekTo;
  }, [seekTo]);

  const syncRemotePlayState = useCallback(async ({ isPlaying: syncPlaying, currentTrack: syncTrack, currentTime: syncTime, updatedAt }) => {
    let targetTime = Number(syncTime) || 0;
    if (syncPlaying && updatedAt) {
      const elapsed = (Date.now() - updatedAt) / 1000;
      if (elapsed > 0 && elapsed < 3600) {
        targetTime += elapsed;
      }
    }

    const cur = currentTrackRef.current;
    const isDifferentTrack = syncTrack && String(syncTrack.id || syncTrack._id) !== String(cur?.id || cur?._id);

    if (isDifferentTrack) {
      resumeAudioContext();
      await playTrack(syncTrack, null, true /* isRemote */);
      if (targetTime > 0) {
        setTimeout(() => {
          seekTo(targetTime, true /* isRemote */);
        }, 350);
      }
      if (syncPlaying !== undefined) {
        setIsPlaying(syncPlaying);
      }
    } else {
      // Same track: sync drift if > 1.5s
      if (targetTime !== undefined && Math.abs(targetTime - currentTimeRef.current) > 1.5) {
        seekTo(targetTime, true /* isRemote */);
      }
      // Sync play/pause
      if (syncPlaying !== undefined && syncPlaying !== isPlayingRef.current) {
        setIsPlaying(syncPlaying);
        if (audioRef.current) {
          if (syncPlaying) {
            resumeAudioContext();
            audioRef.current.play().catch(() => {});
          } else {
            audioRef.current.pause();
          }
        }
      }
    }
  }, [playTrack, seekTo]);

  const setJamSync = useCallback(({ socket, jamSession: newJamSession }) => {
    if (socket !== undefined) {
      if (socketRef.current && socketRef.current !== socket) {
        socketRef.current.off('jam:advance_host_queue');
      }
      socketRef.current = socket;
      if (socket) {
        socket.off('jam:advance_host_queue');
        socket.on('jam:advance_host_queue', () => {
          if (playNextTrackRef.current) {
            playNextTrackRef.current();
          }
        });
      }
    }
    if (newJamSession !== undefined) {
      setJamSessionState(newJamSession);
      jamSessionRef.current = newJamSession;
    }
  }, []);

  const addToJamQueue = useCallback((track) => {
    if (!track) return;
    if (jamSessionRef.current && socketRef.current) {
      socketRef.current.emit('jam:add_to_queue', {
        roomCode: jamSessionRef.current.code,
        track
      });
    }
  }, []);

  const removeFromJamQueue = useCallback((trackIndex, trackId) => {
    if (jamSessionRef.current && socketRef.current) {
      socketRef.current.emit('jam:remove_from_queue', {
        roomCode: jamSessionRef.current.code,
        trackIndex,
        trackId
      });
    }
  }, []);

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

  // ── Start DJ Mode: enable mix + set default transitions for all track pairs ──
  const startDjMode = useCallback((trackList = null) => {
    const list = trackList || tracksRef.current;
    if (!list || list.length === 0) return;

    // Build default transitions for every consecutive pair in the library
    const defaultPairs = {};
    for (let i = 0; i < list.length - 1; i++) {
      const a = list[i];
      const b = list[i + 1];
      const key = `${String(a.id || a._id)}___${String(b.id || b._id)}`;
      defaultPairs[key] = { style: 'equal_power', duration: 8 };
    }
    setActiveTransitions(prev => ({ ...defaultPairs, ...prev }));
    activeTransRef.current = { ...defaultPairs, ...activeTransRef.current };
    setIsMixMode(true);
    isMixModeRef.current = true;

    // Start playing from the first track with the full list as queue
    isTransitionTriggeredRef.current = false;
    playTrack(list[0], list);
  }, [playTrack]);

  // ── Stop DJ Mode ──────────────────────────────────────────────
  const stopDjMode = useCallback(() => {
    setIsMixMode(false);
    isMixModeRef.current = false;
    setActiveTransitions({});
    activeTransRef.current = {};
    try {
      localStorage.removeItem('rivo_active_transitions');
      localStorage.removeItem('liofy_active_transitions');
    } catch {}
  }, []);

  // ── Spotify Mix: Real Preview = seek current track near its end ──────────
  const previewDjTransition = useCallback(async (tA, tB, transConfig = null) => {
    if (!tA || !tB) return;
    resumeAudioContext();

    const dur = Math.min(30, Math.max(2, Number(transConfig?.duration) || 8));
    const style = transConfig?.style || 'equal_power';
    const pairKey = `${String(tA.id || tA._id)}___${String(tB.id || tB._id)}`;

    // 1. Save transition config so checkAndRunDjTransition picks it up
    const nextTrans = { ...activeTransRef.current, [pairKey]: { style, duration: dur } };
    setActiveTransitions(nextTrans);
    activeTransRef.current = nextTrans;
    setIsMixMode(true);
    isMixModeRef.current = true;
    isTransitionTriggeredRef.current = false;
    transitionActiveTrackIdRef.current = null;

    // 2. Make sure tA is the currently playing track
    const curId = String(currentTrackRef.current?.id || currentTrackRef.current?._id || '');
    const tAId = String(tA.id || tA._id || '');

    const doSeek = () => {
      // Seek to 3s before the transition starts so user hears it immediately
      const trackDur = audioRef.current?.duration || duration || 180;
      const seekPoint = Math.max(0, trackDur - dur - 3);

      if (audioRef.current) {
        audioRef.current.currentTime = seekPoint;
        audioRef.current.volume = volumeRef.current;
        audioRef.current.play().catch(() => {});
      }
      setCurrentTime(seekPoint);
      setIsPlaying(true);
    };

    if (curId !== tAId) {
      // Play tA first, then seek after load
      shouldPlayRef.current = true;
      setCurrentTrack(tA);
      currentTrackRef.current = tA;
      setIsPlaying(true);
      setTimeout(doSeek, 3000); // wait for track to load
    } else {
      doSeek();
    }
  }, [duration]);

  const value = {
    currentTrack, setCurrentTrack,
    currentQueue, setCurrentQueue,
    currentQueueIndex, setCurrentQueueIndex,
    isPlaying, setIsPlaying,
    currentTime, duration,
    volume, setVolume,
    isShuffle, setIsShuffle,
    toggleShuffle,
    isRepeat, setIsRepeat,
    repeatMode, setRepeatMode,
    toggleRepeat,
    isOfflineMode, setIsOfflineMode,
    isYtTrack,
    isMixMode, setIsMixMode,
    activeTransitions, setActiveTransitions,
    previewDjTransition,
    startDjMode, stopDjMode,
    eqEnabled, setEqEnabled,
    eqPreset, setEqPreset,
    eqBands, setEqBands,
    applyEqPreset,
    togglePlay, playTrack,
    playNextTrack, playPrevTrack,
    addToQueue, removeFromQueue,
    reorderQueue, clearQueue,
    seekTo, audioRef,
    // Jam Real-Time Sync & Queue API
    jamSession, setJamSync,
    syncRemotePlayState,
    addToJamQueue, removeFromJamQueue,
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
