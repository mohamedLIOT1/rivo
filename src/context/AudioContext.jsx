import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { initAudioEngine, setMasterVolume, resumeAudioContext, calculateCrossfadeGains, playTrueRivoMix, getAudioContext } from '../utils/audioEngine';
import { getTrackMusicalData, checkHarmonicCompatibility } from '../utils/musicAnalysis';
import { getOfflineTrackAudioUrl } from '../utils/offlineStorage';
import { QURAN_LIVE_STATIONS } from '../data/quranLiveStations';
import { isRadioTrack, isQuranContent } from '../utils/quranUtils';
import { API_BASE_URL } from '../config';
import { recordListeningTick, onTrackStarted, onTrackEnded } from '../utils/listeningTracker';
import { useUser } from './UserContext';
import { getSmartTasteAndMoodTracks } from '../utils/tasteAlgorithm';
import { normalizeCoverUrl } from '../utils/coverUtils';

const AudioPlayerContext = createContext(null);

// ── Duration Sanitizer (handles milliseconds, missing, NaN, or infinite durations) ──
export function sanitizeDuration(val, fallback = 210) {
  if (val === undefined || val === null) return fallback;
  const num = Number(val);
  if (!isFinite(num) || isNaN(num) || num <= 0) return fallback;
  // If value is in milliseconds (e.g. 180,000ms), convert to seconds. Only if > 86400 (24h) to avoid breaking long 2-4 hour recitations/tracks!
  if (num > 86400) {
    const inSec = Math.round(num / 1000);
    if (inSec > 0 && inSec <= 86400) return inSec;
    return fallback;
  }
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

// ── Fisher-Yates Array Shuffler ───────────────────────────────────
export function shuffleArray(array) {
  if (!Array.isArray(array)) return [];
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ── Client-side Stream Cache (Instant 0ms repeated playbacks) ──
const clientStreamCache = new Map();
const activeFullTrackCache = new Map();
const CLIENT_CACHE_TTL = 3 * 3600 * 1000; // 3 hours

export async function resolvePlayableAudioStream(track, signal = null, isPrefetch = false) {
  if (!track) return null;
  const isVocalOnly = typeof window !== 'undefined' && localStorage.getItem('rivo_vocal_only') === 'true';
  const trackId = String(track.id || track._id || '');
  const cacheKey = isVocalOnly ? `${trackId}_vocal` : trackId;
  if (cacheKey && clientStreamCache.has(cacheKey)) {
    const cached = clientStreamCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CLIENT_CACHE_TTL) {
      return cached.data;
    } else {
      clientStreamCache.delete(cacheKey);
    }
  }

  const result = await doResolvePlayableAudioStream(track, signal, isVocalOnly, isPrefetch);
  if (cacheKey && result?.url) {
    clientStreamCache.set(cacheKey, { data: result, timestamp: Date.now() });
    try {
      if (typeof window !== 'undefined' && result.url.startsWith('http')) {
        const preloader = new Audio();
        preloader.preload = 'auto';
        preloader.src = result.url;
      }
    } catch {}
  }
  return result;
}

/* removed legacy duplicate */
function _unused_fn() { return null; }
async function _skip_rest() {
  if (!track) return null;
  const trackId = String(track.id || track._id || '');
  if (trackId && clientStreamCache.has(trackId)) {
    const cached = clientStreamCache.get(trackId);
    if (Date.now() - cached.timestamp < CLIENT_CACHE_TTL) {
      return cached.data;
    } else {
      clientStreamCache.delete(trackId);
    }
  }

  const result = await doResolvePlayableAudioStream(track, signal);
  if (trackId && result?.url) {
    clientStreamCache.set(trackId, { data: result, timestamp: Date.now() });
    // Pre-warm browser audio cache for zero-latency start
    try {
      if (typeof window !== 'undefined' && result.url.startsWith('http')) {
        const preloader = new Audio();
        preloader.preload = 'auto';
        preloader.src = result.url;
      }
    } catch {}
  }
  return result;
}

// ── Direct Audio Stream Resolver (HTML5 <audio> & Web Audio API) ──
async function doResolvePlayableAudioStream(track, signal = null, isVocalOnly = false, isPrefetch = false) {
  if (!track) return null;
  const trackId = String(track.id || track._id || '');
  let targetUrl = track.resolvedAudioUrl || track.audioUrl || '';

  // Vocal-Only Mode: check and stream isolated vocal stem
  const isQuran = isQuranContent(track);
  if (isVocalOnly && !isQuran) {
    const dispatchVocalStatus = (statusObj) => {
      if (isPrefetch) return;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rivo-vocal-status-update', { detail: statusObj }));
      }
    };

    try {
      const qTitle = encodeURIComponent(track.title || '');
      const qArtist = encodeURIComponent(track.artist || '');
      const qDur = encodeURIComponent(track.duration || '');
      const qUrl = encodeURIComponent(targetUrl || '');

      // 1. Initial status check
      const statusRes = await fetch(`${API_BASE_URL}/api/tracks/vocal-status?id=${encodeURIComponent(trackId)}&url=${qUrl}&title=${qTitle}&artist=${qArtist}`, { signal });
      let statusData = statusRes.ok ? await statusRes.json() : null;

      if (statusData?.status === 'ready' && statusData.url) {
        dispatchVocalStatus(null);
        const fullVocalUrl = statusData.url.startsWith('/') ? `${API_BASE_URL}${statusData.url}` : statusData.url;
        return {
          url: fullVocalUrl,
          duration: sanitizeDuration(track.duration, 210),
          cover: normalizeCoverUrl(track.cover || track.coverUrl),
          isVocalOnly: true
        };
      }

      // If this is a background prefetch and stem is not yet ready,
      // queue background isolation quietly and exit immediately without blocking or polling
      if (isPrefetch) {
        fetch(`${API_BASE_URL}/api/tracks/vocal-stream?id=${encodeURIComponent(trackId)}&url=${qUrl}&title=${qTitle}&artist=${qArtist}&duration=${qDur}&json=1&prefetch=1`, { signal }).catch(() => {});
        return null;
      }

      // 2. Trigger isolation for active track (Priority 1)
      dispatchVocalStatus({
        isProcessing: true,
        trackTitle: track.title,
        progress: statusData?.progress || 1,
        eta: statusData?.eta || 'Preparing audio...'
      });

      // Kick off priority background isolation on server
      fetch(`${API_BASE_URL}/api/tracks/vocal-stream?id=${encodeURIComponent(trackId)}&url=${qUrl}&title=${qTitle}&artist=${qArtist}&duration=${qDur}&json=1&priority=1`, { signal }).catch(() => {});

      // 3. Poll status every 1.5s until ready or cancelled
      let pollAttempts = 0;
      let displayProgress = Math.max(8, statusData?.progress || 8);
      while (!signal?.aborted && pollAttempts < 1200) {
        await new Promise(r => setTimeout(r, 1500));
        if (signal?.aborted) break;

        const checkRes = await fetch(`${API_BASE_URL}/api/tracks/vocal-status?id=${encodeURIComponent(trackId)}&url=${qUrl}&title=${qTitle}&artist=${qArtist}`, { signal });
        if (checkRes.ok) {
          const curData = await checkRes.json();
          if (curData.status === 'ready' && curData.url) {
            dispatchVocalStatus({
              isProcessing: true,
              trackTitle: track.title,
              progress: 100,
              eta: 'Ready!'
            });
            setTimeout(() => dispatchVocalStatus(null), 1200);
            const fullVocalUrl = curData.url.startsWith('/') ? `${API_BASE_URL}${curData.url}` : curData.url;
            return {
              url: fullVocalUrl,
              duration: sanitizeDuration(track.duration, 210),
              cover: normalizeCoverUrl(track.cover || track.coverUrl),
              isVocalOnly: true
            };
          } else if (curData.status === 'processing') {
            const realProgress = Number(curData.progress) || 0;
            if (realProgress > 0) {
              displayProgress = realProgress;
            } else {
              displayProgress = Math.min(30, displayProgress + 2);
            }
            dispatchVocalStatus({
              isProcessing: true,
              trackTitle: track.title,
              progress: Math.min(99, displayProgress),
              eta: curData.eta || (displayProgress > 50 ? 'Extracting pure vocals...' : 'Isolating vocals with AI...')
            });
          } else if (curData.status === 'queued') {
            dispatchVocalStatus({
              isProcessing: true,
              trackTitle: track.title,
              progress: 5,
              eta: curData.eta || 'Queued behind active isolation...'
            });
          } else if (curData.status === 'failed') {
            dispatchVocalStatus({
              isProcessing: false,
              error: 'Failed to isolate vocals'
            });
            setTimeout(() => dispatchVocalStatus(null), 4000);
            return null;
          } else {
            // If still preparing / idle, gently show progress and retry kickoff every 4 attempts
            displayProgress = Math.min(15, displayProgress + 1);
            dispatchVocalStatus({
              isProcessing: true,
              trackTitle: track.title,
              progress: displayProgress,
              eta: 'Preparing audio stream...'
            });
            if (pollAttempts > 0 && pollAttempts % 4 === 0) {
              fetch(`${API_BASE_URL}/api/tracks/vocal-stream?id=${encodeURIComponent(trackId)}&url=${qUrl}&title=${qTitle}&artist=${qArtist}&duration=${qDur}&json=1&priority=1`, { signal }).catch(() => {});
            }
          }
        }
        pollAttempts++;
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        dispatchVocalStatus(null);
        throw e;
      }
      console.warn('[AudioContext] Vocal stream resolve notice:', e.message);
    }
    dispatchVocalStatus(null);
    // Strictly prevent fallback to playing with background music when user enabled Vocal-Only mode
    return null;
  }

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

  // 2b. Direct server-uploaded audio files
  if (track.source === 'Upload' || (targetUrl && (targetUrl.startsWith('/uploads/') || targetUrl.includes('/uploads/') || targetUrl.startsWith('/mix-demo/')))) {
    const fullUrl = targetUrl.startsWith('/') ? `${API_BASE_URL}${targetUrl}` : (targetUrl.startsWith('http') ? targetUrl : `${API_BASE_URL}/${targetUrl}`);
    return {
      url: fullUrl,
      duration: sanitizeDuration(track.duration, 210),
      cover: track.cover || track.coverUrl
    };
  }

  // 2c. Direct HTTP audio stream URL (e.g. from Jam host or pre-resolved stream)
  if (targetUrl && (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) && !targetUrl.includes('youtube.com/watch') && !targetUrl.includes('youtu.be/') && !targetUrl.includes('googlevideo.com')) {
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
  const qAlbum = encodeURIComponent(track.album || '');
  const qDuration = encodeURIComponent(track.duration || '');

  // 5. Direct backend audio stream endpoint: /api/tracks/:id/stream
  try {
    const sRes = await fetch(`${API_BASE_URL}/api/tracks/${encodeURIComponent(trackId || 'stream')}/stream?url=${encodeURIComponent(targetUrl)}&title=${qTitle}&artist=${qArtist}&album=${qAlbum}&duration=${qDuration}`, { signal });
    if (sRes.ok) {
      const sData = await sRes.json();
      let cand = sData?.url || sData?.directUrl;
      if (cand && !cand.includes('youtube.com/watch') && !cand.includes('youtu.be/')) {
        if (cand.startsWith('/')) cand = `${API_BASE_URL}${cand}`;
        return {
          url: cand,
          duration: sanitizeDuration(sData.duration || track.duration, 210),
          cover: normalizeCoverUrl(track.cover || track.coverUrl || sData.cover),
          track: sData.track || null
        };
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') throw e;
  }

  // 6. Direct backend resolve-stream endpoint: /api/tracks/resolve-stream?stream=true
  try {
    const res = await fetch(`${API_BASE_URL}/api/tracks/resolve-stream?stream=true&title=${qTitle}&artist=${qArtist}&url=${encodeURIComponent(targetUrl)}&id=${encodeURIComponent(trackId)}&album=${qAlbum}&duration=${qDuration}`, { signal });
    if (res.ok) {
      const d = await res.json();
      if (d.success && d.url && !d.url.includes('youtube.com/watch') && !d.url.includes('youtu.be/')) {
        let cand = d.url;
        if (cand.startsWith('/')) cand = `${API_BASE_URL}${cand}`;
        return {
          url: cand,
          duration: sanitizeDuration(d.duration || track.duration, 210),
          cover: normalizeCoverUrl(track.cover || track.coverUrl || d.cover),
          track: d.track || null
        };
      }
    }
  } catch (e) {
    if (e.name === 'AbortError') throw e;
  }

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
  const userCtx = useUser();
  const { currentUser = null, likedTrackIds = [], toggleLike } = userCtx || {};

    const [currentTrack, setCurrentTrack] = useState(() => {
    try {
      const saved = localStorage.getItem('rivo_last_played_track') || localStorage.getItem('liofy_last_played_track');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [currentQueue, setCurrentQueue] = useState(() => {
    try {
      const savedQ = localStorage.getItem('rivo_last_played_queue');
      if (savedQ) return JSON.parse(savedQ);
    } catch {}
    return [];
  });
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => {
    try {
      const savedTime = localStorage.getItem('rivo_last_played_time');
      if (savedTime) return Number(savedTime) || 0;
    } catch {}
    return 0;
  });
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
  const isYtTrackRef = useRef(false);

  // Rivo DJ Mix DJ Mode
  const [isMixMode, setIsMixMode] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeTransitions, setActiveTransitions] = useState(() => {
    try {
      localStorage.removeItem('rivo_active_transitions');
      localStorage.removeItem('liofy_active_transitions');
    } catch {}
    return {};
  });

  const [jamSession, setJamSessionState] = useState(null);
  const [remoteDevicePlayback, setRemoteDevicePlayback] = useState(null);
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
  const [vocalIsolationStatus, setVocalIsolationStatus] = useState(null);

  useEffect(() => {
    const handleVocalStatus = (e) => {
      setVocalIsolationStatus(e.detail);
    };
    window.addEventListener('rivo-vocal-status-update', handleVocalStatus);
    return () => window.removeEventListener('rivo-vocal-status-update', handleVocalStatus);
  }, []);

  const resumeAutoplay = useCallback(() => {
    setIsAutoplayBlocked(false);
    resumeAudioContext();
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        isPlayingRef.current = true;
      }).catch(err => {
        console.warn('[Audio] play after resume failed:', err);
      });
    }
  }, []);

  const repeatModeRef     = useRef(repeatMode);
  const isRepeatRef       = useRef(isRepeat);
  const isShuffleRef      = useRef(isShuffle);
  const isMixModeRef      = useRef(isMixMode);
  const activeTransRef    = useRef(activeTransitions);
  const currentQueueRef   = useRef(currentQueue);
  const currentQueueIndexRef = useRef(currentQueueIndex);
  const unshuffledQueueRef = useRef([]);
  const tracksRef         = useRef(tracks);
  const currentTrackRef   = useRef(currentTrack);
  const isPlayingRef      = useRef(isPlaying);
  const currentTimeRef    = useRef(currentTime);
  const durationRef       = useRef(duration);
  const pendingInitialSeekRef = useRef(null);
  const jamSessionRef     = useRef(jamSession);

  useEffect(() => { 
    repeatModeRef.current = repeatMode;
    isRepeatRef.current = repeatMode !== 'off';
  }, [repeatMode]);
  const socketRef         = useRef(null);
  const isRemoteActionRef = useRef(false);
  const lastRemoteSeekRef = useRef(0);
  const seekTimeoutRef    = useRef(null);
  const seekListeningSyncTimeoutRef = useRef(null);
  const volumeRef         = useRef(0.8);
  const shouldPlayRef     = useRef(false); // Force autoplay on track change
  const lastLoadedUrlRef  = useRef(null);  // Last URL loaded into audio element (prevents interruption on metadata-only changes)
  const lastLoadedIdRef   = useRef(null);  // Last track ID loaded (detects actual track change vs metadata update)
  const lastLoadedStreamUrlRef = useRef(null);
  const isTransitionTriggeredRef = useRef(false);
  const isSeamlessYtHandoffRef   = useRef(false);
  const isFetchingAiShuffleRef   = useRef(false);
  const watchdogRef       = useRef(null);
  const playNextTrackRef  = useRef(null);
  const playPrevTrackRef  = useRef(null);
  const toggleRepeatRef   = useRef(null);
  const toggleShuffleRef  = useRef(null);
  const toggleLikeRef     = useRef(null);
  const seekToRef         = useRef(null);
  const isUserPauseActionRef = useRef(false);
  const playRequestSeqRef = useRef(0);
  const isChangingTrackRef = useRef(false);
  const historyStackRef   = useRef([]);
  const isHistoryNavRef   = useRef(false);
  const streamAbortControllerRef = useRef(null);
  const lastPauseTimeRef  = useRef(0);
  const stallRecoveryTimerRef = useRef(null);
  const errorAdvanceTimerRef = useRef(null);
  const isSmartMoodQueueRef = useRef(false);
  const playedSmartSongIdsRef = useRef(new Set());
  const currentUserRef = useRef(currentUser);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  useEffect(() => { isRepeatRef.current     = isRepeat;    }, [isRepeat]);
  useEffect(() => { isShuffleRef.current    = isShuffle;   }, [isShuffle]);
  useEffect(() => { isMixModeRef.current    = isMixMode;   }, [isMixMode]);
  useEffect(() => { 
    activeTransRef.current = activeTransitions; 
    if (currentQueueRef.current && activeTransitions) {
      currentQueueRef.current._transitions = {
        ...(currentQueueRef.current._transitions || {}),
        ...activeTransitions
      };
    }
  }, [activeTransitions]);
  useEffect(() => { currentQueueRef.current = currentQueue;}, [currentQueue]);
  useEffect(() => { currentQueueIndexRef.current = currentQueueIndex; }, [currentQueueIndex]);
  useEffect(() => { tracksRef.current       = tracks;      }, [tracks]);
  useEffect(() => {
    currentTrackRef.current = currentTrack;
    if (currentTrack) {
      try {
        localStorage.setItem('rivo_last_played_track', JSON.stringify(currentTrack));
      } catch {}
    }
  }, [currentTrack]);

  // Handle runtime toggle of Vocal-Only Mode: seamlessly reload active track with or without vocals
  useEffect(() => {
    const handleVocalModeToggle = () => {
      const activeTrack = currentTrackRef.current;
      if (!activeTrack || !audioRef.current) return;
      const tid = String(activeTrack.id || activeTrack._id || '');
      clientStreamCache.delete(tid);
      clientStreamCache.delete(`${tid}_vocal`);

      const curPos = audioRef.current.currentTime || 0;
      const wasPlaying = isPlayingRef.current && !audioRef.current.paused;

      resolvePlayableAudioStream(activeTrack).then((res) => {
        if (res?.url && audioRef.current) {
          audioRef.current.src = res.url;
          audioRef.current.currentTime = curPos;
          if (wasPlaying) {
            audioRef.current.play().catch(() => {});
          }
        }
      }).catch(() => {});
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('rivo-vocal-mode-changed', handleVocalModeToggle);
      return () => window.removeEventListener('rivo-vocal-mode-changed', handleVocalModeToggle);
    }
  }, []);

  useEffect(() => {
    // sync track state
    if (currentTrack) {
      try {
        localStorage.setItem('rivo_last_played_track', JSON.stringify(currentTrack));
      } catch {}
    }
  }, [currentTrack]);

  useEffect(() => {
    if (currentQueue && currentQueue.length > 0) {
      try {
        localStorage.setItem('rivo_last_played_queue', JSON.stringify(currentQueue.slice(0, 30)));
      } catch {}
    }
  }, [currentQueue]);
  useEffect(() => { isPlayingRef.current    = isPlaying;   }, [isPlaying]);
  useEffect(() => { currentTimeRef.current = currentTime;  }, [currentTime]);
  useEffect(() => { durationRef.current    = duration;     }, [duration]);
  useEffect(() => { jamSessionRef.current   = jamSession;  }, [jamSession]);

  const isJamHost = useCallback(() => {
    const session = jamSessionRef.current;
    const sock = socketRef.current;
    if (!session) return false;
    const mySockId = sock?.id;
    if (!mySockId) return false;
    if (session.hostId && session.hostId === mySockId) return true;
    if (Array.isArray(session.members)) {
      return session.members.some(m => m.socketId === mySockId && m.isHost);
    }
    return false;
  }, []);

  const canControlJam = useCallback(() => {
    const session = jamSessionRef.current;
    if (!session) return false;
    if (!session.hostOnlyControl) return true;
    return isJamHost();
  }, [isJamHost]);

  // Broadcast live listening activity to server for Friend Activity & Discord Rich Presence
  useEffect(() => {
    if (!currentTrack) return;
    const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';

    const curDur = (durationRef.current > 0 ? durationRef.current : currentTrack.duration) || 0;
    const payloadTrack = {
      ...currentTrack,
      duration: curDur
    };
    const curSec = currentTimeRef.current || 0;

    // If socket is available, emit immediate zero-latency listening update
    if (socketRef.current) {
      socketRef.current.emit('activity:listening', { track: payloadTrack, isPlaying, currentTime: curSec });
    }

    if (!token) return;

    // Fast sync: 50ms if paused so friends/Discord see pause immediately, 500ms when playing to throttle track changes
    const delay = isPlaying ? 500 : 50;
    const timeout = setTimeout(() => {
      const actuallyPlaying = Boolean(isPlaying && audioRef.current && !audioRef.current.paused && !isChangingTrackRef.current);
      fetch(`${API_BASE_URL}/api/users/listening-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ track: actuallyPlaying ? payloadTrack : null, isPlaying: actuallyPlaying, currentTime: curSec })
      }).catch(() => {});
    }, delay);

    return () => clearTimeout(timeout);
  }, [currentTrack?.id || currentTrack?._id, isPlaying]);

  // Continuous sync heartbeat to prevent Discord Presence and Friend Activity drift
  useEffect(() => {
    if (!isPlaying || !currentTrack) return;
    const interval = setInterval(() => {
      if (socketRef.current && currentTrackRef.current && isPlayingRef.current) {
        const curDur = (durationRef.current > 0 ? durationRef.current : currentTrackRef.current.duration) || 0;
        socketRef.current.emit('activity:listening', {
          track: { ...currentTrackRef.current, duration: curDur },
          isPlaying: true,
          currentTime: currentTimeRef.current || 0
        });
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [isPlaying, currentTrack?.id || currentTrack?._id]);

  // Clean up Discord / friend activity when browser tab or desktop window closes
  useEffect(() => {
    const handleUnload = () => {
      if (isPlayingRef.current) {
        if (socketRef.current) {
          socketRef.current.emit('activity:listening', { track: null, isPlaying: false, currentTime: 0 });
          socketRef.current.emit('device:playback_state', { isPlaying: false, track: null, currentTime: 0 });
        }
        if (typeof window !== 'undefined' && window.chrome?.webview?.postMessage) {
          try {
            window.chrome.webview.postMessage(JSON.stringify({ action: 'PAUSE' }));
          } catch (e) {}
        }
        const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
        if (token && navigator.sendBeacon) {
          const payload = JSON.stringify({ track: null, isPlaying: false, currentTime: 0 });
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon(`${API_BASE_URL}/api/users/listening-activity`, blob);
        }
      }
    };

    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, []);

  // ── Regular HTML Audio elements for True Dual-Deck DJ Mixing ──
  const audioRef = useRef(null); // Active Primary Deck
  const secondaryAudioRef = useRef(null); // Standby / Transition Deck
  const isTransitionRunningRef = useRef(false);
  const transitionAnimFrameRef = useRef(null);
  const standbyPreloadedIdRef = useRef(null);
  const transitionActiveTrackIdRef = useRef(null);
  const activeWebAudioMixRef = useRef(null);

  // YouTube IFrame player completely eliminated — pure direct audio streaming
  const stopYouTube = useCallback(() => {}, []);

  const stopHtmlAudio = useCallback(() => {
    if (transitionAnimFrameRef.current) {
      cancelAnimationFrame(transitionAnimFrameRef.current);
      transitionAnimFrameRef.current = null;
    }
    setIsTransitioning(false);
    isTransitionRunningRef.current = false;
    isTransitionTriggeredRef.current = false;
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    const sec = secondaryAudioRef.current;
    if (sec) {
      sec.pause();
      sec.removeAttribute('src');
      sec.load();
    }
  }, []);

  // Create Dual-Deck Audio elements + DJ Transition Engine
  useEffect(() => {
    const audioA = new Audio();
    const audioB = new Audio();
    audioA.preload = 'auto';
    audioB.preload = 'auto';
    audioRef.current = audioA;
    secondaryAudioRef.current = audioB;
    audioA.volume = volumeRef.current;
    audioB.volume = 0;
    initAudioEngine(audioA);

    let lastTimeUpdate = 0;

    // ── Dedicated Dual-Deck Automix Transition Engine ──
    const triggerDualDeckTransition = (
      fromTrack, toTrack, nextIdx, transDur, transStyle, 
      mixInPoint = 0, mixOutPoint = null, crossoverBias = 0.5,
      volA = 100, volB = 100, speedA = 1.0, speedB = 1.0
    ) => {
      if (isTransitionRunningRef.current) return;
      isTransitionRunningRef.current = true;
      isTransitionTriggeredRef.current = true;
      setIsTransitioning(true);

      const fromDeck = audioRef.current;
      const toDeck = secondaryAudioRef.current;
      if (!fromDeck || !toDeck) {
        isTransitionRunningRef.current = false;
        isTransitionTriggeredRef.current = false;
        setIsTransitioning(false);
        return;
      }

      // Ensure primary deck is at master volume and unmuted
      const masterVol = volumeRef.current;
      fromDeck.volume = masterVol;
      fromDeck.muted = false;

      // Apply initial playback speed
      const rateA = (!isNaN(Number(speedA)) && Number(speedA) >= 0.85 && Number(speedA) <= 1.15) ? Number(Number(speedA).toFixed(2)) : 1.0;
      const rateB = (!isNaN(Number(speedB)) && Number(speedB) >= 0.85 && Number(speedB) <= 1.15) ? Number(Number(speedB).toFixed(2)) : 1.0;
      fromDeck.playbackRate = rateA;

      resolvePlayableAudioStream(toTrack).then((res) => {
        if (!isTransitionRunningRef.current) return;
        if (!res?.url) {
          isTransitionRunningRef.current = false;
          isTransitionTriggeredRef.current = false;
          setIsTransitioning(false);
          if (fromDeck) {
            fromDeck.volume = masterVol;
            fromDeck.playbackRate = 1.0;
          }
          return;
        }

        const fullUrl = res.url.startsWith('/') ? `${API_BASE_URL}${res.url}` : res.url;
        const inPoint = Math.max(0, Number(mixInPoint) || 0);

        const setDeckCueIn = () => {
          try {
            toDeck.currentTime = inPoint;
          } catch {}
        };

        if (toDeck.src !== fullUrl) {
          toDeck.src = fullUrl;
          if (toDeck.readyState >= 1) {
            setDeckCueIn();
          } else {
            toDeck.addEventListener('loadedmetadata', setDeckCueIn, { once: true });
          }
        } else {
          setDeckCueIn();
        }

        toDeck.volume = 0;
        toDeck.muted = false;
        toDeck.playbackRate = rateB;

        // Transition runs for at least 3 seconds, up to transDur seconds
        const totalFadeMs = Math.max(3000, transDur * 1000);

        const startCrossfade = () => {
          if (!isTransitionRunningRef.current) return;

          // Double check cue-in position
          if (Math.abs(toDeck.currentTime - inPoint) > 1.5) {
            try { toDeck.currentTime = inPoint; } catch {}
          }

          const startTime = performance.now();
          let totalPausedMs = 0;
          let pauseStart = 0;
          const multA = (Number(volA) || 100) / 100;
          const multB = (Number(volB) || 100) / 100;

          const runFrame = () => {
            if (!isTransitionRunningRef.current) return;

            // Preserve crossfade progress if user paused
            if (!isPlayingRef.current) {
              if (pauseStart === 0) pauseStart = performance.now();
              transitionAnimFrameRef.current = requestAnimationFrame(runFrame);
              return;
            }
            if (pauseStart > 0) {
              totalPausedMs += (performance.now() - pauseStart);
              pauseStart = 0;
            }

            const elapsed = performance.now() - startTime - totalPausedMs;
            const progress = Math.min(1.0, Math.max(0.0, elapsed / totalFadeMs));

            // Accurate non-linear DJ volume gains strictly matching the interactive curve
            const { gainA, gainB } = calculateCrossfadeGains(progress, transStyle, crossoverBias);

            if (fromDeck) {
              fromDeck.volume = Math.max(0.0, Math.min(1.0, masterVol * gainA * multA));
            }
            if (toDeck) {
              toDeck.volume = Math.max(0.0, Math.min(1.0, masterVol * gainB * multB));
            }

            if (progress < 1.0 && !isChangingTrackRef.current) {
              transitionAnimFrameRef.current = requestAnimationFrame(runFrame);
            } else {
              // ── Transition Finished: Swap Decks! ──
              if (fromDeck) {
                fromDeck.pause();
                fromDeck.currentTime = 0;
                fromDeck.volume = masterVol;
                fromDeck.playbackRate = 1.0;
              }
              if (toDeck) {
                toDeck.volume = masterVol;
                toDeck.muted = false;
                toDeck.playbackRate = 1.0;
              }

              // Reference swap: audioRef.current always points to active playing deck!
              const temp = audioRef.current;
              audioRef.current = secondaryAudioRef.current;
              secondaryAudioRef.current = temp;

              if (audioRef.current) {
                audioRef.current.volume = masterVol;
                audioRef.current.muted = false;
                audioRef.current.playbackRate = 1.0;
              }

              isTransitionRunningRef.current = false;
              isTransitionTriggeredRef.current = false;
              setIsTransitioning(false);
              standbyPreloadedIdRef.current = null;

              currentQueueIndexRef.current = nextIdx;
              currentTrackRef.current = toTrack;
              lastLoadedIdRef.current = String(toTrack.id || toTrack._id || '');
              lastLoadedStreamUrlRef.current = fullUrl;
              setCurrentQueueIndex(nextIdx);
              setCurrentTrack(toTrack);
              const targetDur = toDeck.duration && !isNaN(toDeck.duration) && isFinite(toDeck.duration)
                ? Math.round(toDeck.duration)
                : (toTrack.duration || 210);
              setDuration(targetDur);
              durationRef.current = targetDur;
            }
          };

          transitionAnimFrameRef.current = requestAnimationFrame(runFrame);
        };

        const playPromise = toDeck.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            startCrossfade();
          }).catch((e) => {
            console.warn('[RivoMix] Standby play notice:', e);
            startCrossfade();
          });
        } else {
          startCrossfade();
        }
      }).catch((err) => {
        console.warn('[RivoMix] Stream resolve error:', err);
        isTransitionRunningRef.current = false;
        isTransitionTriggeredRef.current = false;
        setIsTransitioning(false);
        if (fromDeck) {
          fromDeck.volume = masterVol;
          fromDeck.playbackRate = 1.0;
        }
      });
    };

    const attachDeckListeners = (deck) => {
      const handleTimeUpdate = () => {
        // Only active primary deck triggers UI and scheduling
        if (deck !== audioRef.current) return;
        if (!deck || isNaN(deck.currentTime)) return;

        if (stallRecoveryTimerRef.current) {
          clearTimeout(stallRecoveryTimerRef.current);
          stallRecoveryTimerRef.current = null;
        }

        const now = Date.now();
        if (now - lastTimeUpdate > 100) {
          lastTimeUpdate = now;
          setCurrentTime(deck.currentTime);
          currentTimeRef.current = deck.currentTime;

          // Periodically sync live playback time with other devices (Rivo Connect) every 2.5s
          if (isPlayingRef.current && (!deck._lastDeviceSync || now - deck._lastDeviceSync >= 2500)) {
            deck._lastDeviceSync = now;
            if (socketRef.current && currentTrackRef.current) {
              socketRef.current.emit('device:playback_state', {
                isPlaying: true,
                track: currentTrackRef.current,
                currentTime: Math.floor(deck.currentTime),
                deviceType: 'web',
                deviceName: 'Web Browser'
              });
            }
          }

          // Periodically emit Jam Room sync every 3.5s when Jam room is active (HOST ONLY)
          if (isPlayingRef.current && jamSessionRef.current && socketRef.current && isJamHost()) {
            if (!deck._lastJamSync || now - deck._lastJamSync >= 3500) {
              deck._lastJamSync = now;
              const roomCode = String(jamSessionRef.current.code || jamSessionRef.current.roomCode || '').trim().toUpperCase();
              if (roomCode) {
                const curUser = currentUserRef.current;
                socketRef.current.emit('jam:sync_play_state', {
                  roomCode,
                  isPlaying: true,
                  currentTrack: currentTrackRef.current,
                  currentTime: deck.currentTime,
                  updatedAt: Date.now(),
                  initiatorId: socketRef.current.id,
                  userId: curUser ? (curUser.id || curUser._id) : undefined,
                  isPeriodic: true,
                });
              }
            }
          }

          // Always accurately sync authentic duration (from audio stream or database metadata fallback)
          const rawDur = (!isNaN(deck.duration) && isFinite(deck.duration) && deck.duration > 5 && deck.duration < 86400)
            ? Math.round(deck.duration)
            : (durationRef.current > 0 ? durationRef.current : (currentTrackRef.current?.duration || 210));
          const rounded = Math.max(10, Math.round(rawDur));

          if (rounded !== durationRef.current) {
            setDuration(rounded);
            durationRef.current = rounded;
            if (currentTrackRef.current) currentTrackRef.current.duration = rounded;
          }

          // ── RIVO DJ MIX MODE Lookahead check & Dual-Deck transition ──
          if (isMixModeRef.current && isPlayingRef.current && !isTransitionRunningRef.current && !isChangingTrackRef.current) {
            const curTrack = currentTrackRef.current;
            if (isQuranContent(curTrack)) return; // 📿 Holy Quran Safeguard: Never crossfade or mix Quran
            const q = currentQueueRef.current;
            const curIdx = currentQueueIndexRef.current;
            if (q && q.length > 1 && curIdx >= 0) {
              const isLast = curIdx === q.length - 1;
              if (!isLast || repeatModeRef.current !== 'off') {
                const nextIdx = (curIdx + 1) % q.length;
                const nextTrack = q[nextIdx];
                if (isQuranContent(nextTrack)) return; // 📿 Holy Quran Safeguard: Never mix into Quran
                const curId = String(curTrack?.id || curTrack?._id || '');
                const nextId = String(nextTrack?.id || nextTrack?._id || '');

                if (curId && nextId && curId !== nextId) {
                  const pairKey = `${curId}___${nextId}`;
                  const pairKeyAlt = `${curId}_${nextId}`;
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
                  }
                  transDur = Math.max(2, Math.min(48, transDur));
                  const transStyle = trans?.style || 'auto';

                  const mixOutPoint = (trans?.mixOutPoint !== undefined && Number(trans.mixOutPoint) > 5 && Number(trans.mixOutPoint) <= rounded)
                    ? Number(trans.mixOutPoint)
                    : Math.max(5, rounded - 2);
                  const mixInPoint = Number(trans?.mixInPoint) || 0;
                  const crossoverBias = Number(trans?.crossoverBias) || 0.5;
                  const volA = Number(trans?.volA) || 100;
                  const volB = Number(trans?.volB) || 100;
                  const speedA = (!isNaN(Number(trans?.speedA)) && Number(trans?.speedA) >= 0.85 && Number(trans?.speedA) <= 1.15) ? Number(Number(trans?.speedA).toFixed(2)) : 1.0;
                  const speedB = (!isNaN(Number(trans?.speedB)) && Number(trans?.speedB) >= 0.85 && Number(trans?.speedB) <= 1.15) ? Number(Number(trans?.speedB).toFixed(2)) : 1.0;
                  const remaining = mixOutPoint - deck.currentTime;

                  // 1. Preload standby deck 15 seconds ahead of transition
                  if (remaining <= transDur + 15 && standbyPreloadedIdRef.current !== nextId) {
                    standbyPreloadedIdRef.current = nextId;
                    const standby = secondaryAudioRef.current;
                    if (standby) {
                      resolvePlayableAudioStream(nextTrack, null, true).then((res) => {
                        if (res?.url && standbyPreloadedIdRef.current === nextId) {
                          const fullUrl = res.url.startsWith('/') ? `${API_BASE_URL}${res.url}` : res.url;
                          if (standby.src !== fullUrl) {
                            standby.src = fullUrl;
                            standby.volume = 0;
                            const setIn = () => {
                              try { standby.currentTime = Math.max(0, mixInPoint); } catch {}
                            };
                            if (standby.readyState >= 1) {
                              setIn();
                            } else {
                              standby.addEventListener('loadedmetadata', setIn, { once: true });
                            }
                            standby.load();
                          }
                        }
                      }).catch(() => {});
                    }
                  }

                  // 2. Launch DJ Crossfade right at the transition trigger point!
                  if (remaining <= transDur && remaining > 0.1) {
                    triggerDualDeckTransition(curTrack, nextTrack, nextIdx, transDur, transStyle, mixInPoint, mixOutPoint, crossoverBias, volA, volB, speedA, speedB);
                  } else if (remaining <= 0.1 && !isTransitionRunningRef.current && deck.currentTime >= mixOutPoint) {
                    // Jumped or reached Mix-Out point: trigger smooth transition (at least 3.5s so never an abrupt cutoff!)
                    triggerDualDeckTransition(curTrack, nextTrack, nextIdx, Math.max(3.5, Math.min(transDur, 12)), transStyle, mixInPoint, mixOutPoint, crossoverBias, volA, volB, speedA, speedB);
                  }
                }
              }
            }
          } else {
            // Seamless prefetch: When within 15s of track completion, ensure next track is resolved & buffered
            if (deck.currentTime >= rounded - 15) {
              const q = currentQueueRef.current;
              const curIdx = currentQueueIndexRef.current;
              if (q && q.length > 1 && curIdx >= 0) {
                const nextIdx = (curIdx + 1) % q.length;
                  const nextTrack = q[nextIdx];
                  const nextId = String(nextTrack?.id || nextTrack?._id || '');
                  if (nextId && !clientStreamCache.has(nextId)) {
                    resolvePlayableAudioStream(nextTrack, null, true).catch(() => {});
                  }
                }
              }
            }
          }
        };

      const handleLoadedMetadata = () => {
        if (deck !== audioRef.current) return;
        if (!isNaN(deck.duration) && isFinite(deck.duration) && deck.duration > 5 && deck.duration < 86400) {
          const rounded = Math.round(deck.duration);
          setDuration(rounded);
          durationRef.current = rounded;
          if (currentTrackRef.current) currentTrackRef.current.duration = rounded;
        }
      };

      const handleDurationChange = () => {
        if (deck !== audioRef.current) return;
        if (!isNaN(deck.duration) && isFinite(deck.duration) && deck.duration > 5 && deck.duration < 86400) {
          const rounded = Math.round(deck.duration);
          setDuration(rounded);
          durationRef.current = rounded;
          if (currentTrackRef.current) currentTrackRef.current.duration = rounded;
        }
      };

      const handleEnded = () => {
        if (deck !== audioRef.current) return;
        if (isChangingTrackRef.current) return;
        // If DJ transition was already running or handled, ignore ended event
        if (isTransitionRunningRef.current || isTransitionTriggeredRef.current) return;

        onTrackEnded(currentTrackRef.current);
        const finished = currentTrackRef.current;
        if (finished && finished.title) {
          const tid = String(finished._id || finished.id || '');
          const isMongo = /^[a-f0-9]{24}$/i.test(tid);
          if (!isMongo || finished.source === 'YouTube' || finished.isExternal) {
            fetch(`${API_BASE_URL}/api/tracks/auto-persist`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: tid,
                title: finished.title,
                artist: finished.artist,
                album: finished.album,
                cover: finished.cover || finished.coverUrl,
                audioUrl: finished.audioUrl,
                duration: finished.duration,
                youtubeId: finished.youtubeId,
                source: finished.source || 'YouTube'
              })
            }).catch(() => {});
          }
        }

        // Live radio continuous stream handler: never advance or stop, always auto-reconnect!
        if (finished && (finished.isLive || finished.isRadio)) {
          setTimeout(() => {
            if (!currentTrackRef.current) return;
            const streamUrl = finished.fallbackUrl && finished._usedFallback ? finished.fallbackUrl : finished.audioUrl;
            if (streamUrl && deck) {
              const sep = streamUrl.includes('?') ? '&' : '?';
              deck.src = `${streamUrl}${sep}_t=${Date.now()}`;
              deck.play().catch(() => {});
            }
          }, 800);
          return;
        }

        if (repeatModeRef.current === 'one') {
          deck.currentTime = 0;
          deck.play().catch(() => {});
        } else {
          // In Jam Session: ONLY the Host auto-advances when track finishes!
          if (jamSessionRef.current) {
            if (isJamHost() && playNextTrackRef.current) {
              playNextTrackRef.current();
            }
          } else if (playNextTrackRef.current) {
            playNextTrackRef.current();
          }
        }
      };

      const handlePlaying = () => {
        if (deck !== audioRef.current) return;
        if (stallRecoveryTimerRef.current) {
          clearTimeout(stallRecoveryTimerRef.current);
          stallRecoveryTimerRef.current = null;
        }
        resumeAudioContext();
        const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
        if (token && currentTrackRef.current) {
          const curDur = (durationRef.current > 0 ? durationRef.current : currentTrackRef.current.duration) || 0;
          const curSec = deck.currentTime || 0;
          const pTrack = { ...currentTrackRef.current, duration: curDur };
          if (socketRef.current) {
            socketRef.current.emit('activity:listening', { track: pTrack, isPlaying: true, currentTime: curSec });
          }
          fetch(`${API_BASE_URL}/api/users/listening-activity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ track: pTrack, isPlaying: true, currentTime: curSec })
          }).catch(() => {});
        }
      };

      const handleStalledOrWaiting = () => {
        if (deck !== audioRef.current) return;
        if (!isPlayingRef.current || isChangingTrackRef.current) return;
        const curId = String(currentTrackRef.current?.id || currentTrackRef.current?._id || '');
        const cachedBlob = activeFullTrackCache.get(curId);
        if (cachedBlob && deck && deck.src !== cachedBlob) {
          const cur = deck.currentTime || currentTimeRef.current || 0;
          deck.src = cachedBlob;
          deck.currentTime = cur;
          resumeAudioContext();
          deck.play().catch(() => {});
          return;
        }
        if (stallRecoveryTimerRef.current) clearTimeout(stallRecoveryTimerRef.current);
        stallRecoveryTimerRef.current = setTimeout(() => {
          if (!isPlayingRef.current || isChangingTrackRef.current) return;
          const cur = deck.currentTime || currentTimeRef.current || 0;
          if (deck && deck.src && cur > 0) {
            const s = deck.src;
            deck.src = s;
            deck.currentTime = cur;
            resumeAudioContext();
            deck.play().catch(() => {});
          }
        }, 1500);
      };

      const handleError = () => {
        if (deck !== audioRef.current) return;
        deck.crossOrigin = null;
        if (isChangingTrackRef.current) return;
        if (!isPlayingRef.current && !shouldPlayRef.current) return;
        const cur = currentTrackRef.current;

        // Live radio auto-reconnect & fallback mirror
        if (cur && (cur.isLive || cur.isRadio)) {
          setTimeout(() => {
            if (!currentTrackRef.current) return;
            const streamUrl = (!cur._usedFallback && cur.fallbackUrl) ? cur.fallbackUrl : cur.audioUrl;
            cur._usedFallback = !cur._usedFallback;
            if (streamUrl && deck) {
              const sep = streamUrl.includes('?') ? '&' : '?';
              deck.src = `${streamUrl}${sep}_t=${Date.now()}`;
              deck.play().catch(() => {});
            }
          }, 1200);
          return;
        }
        if (cur && (cur.title || cur.artist) && !cur._retryDone) {
          cur._retryDone = true;
          fetch(`${API_BASE_URL}/api/tracks/resolve-stream?title=${encodeURIComponent(cur.title || '')}&artist=${encodeURIComponent(cur.artist || '')}`)
            .then(r => r.json())
            .then(d => {
              if (isChangingTrackRef.current || (!isPlayingRef.current && !shouldPlayRef.current)) return;
              const latestCur = currentTrackRef.current;
              if (latestCur && String(latestCur.id || latestCur._id) === String(cur.id || cur._id) && d.success && d.url && deck) {
                stopYouTube();
                const fullUrl = d.url.startsWith('/') ? `${API_BASE_URL}${d.url}` : d.url;
                deck.src = fullUrl;
                resumeAudioContext();
                deck.play().catch(() => {});
              } else {
                if (errorAdvanceTimerRef.current) clearTimeout(errorAdvanceTimerRef.current);
                errorAdvanceTimerRef.current = setTimeout(() => {
                  if (isChangingTrackRef.current) return;
                  if (playNextTrackRef.current && isPlayingRef.current) {
                    playNextTrackRef.current();
                  }
                }, 1500);
              }
            })
            .catch(() => {
              if (errorAdvanceTimerRef.current) clearTimeout(errorAdvanceTimerRef.current);
              errorAdvanceTimerRef.current = setTimeout(() => {
                if (isChangingTrackRef.current) return;
                if (playNextTrackRef.current && isPlayingRef.current) {
                  playNextTrackRef.current();
                }
              }, 1500);
            });
        }
      };

      deck.addEventListener('timeupdate', handleTimeUpdate);
      deck.addEventListener('loadedmetadata', handleLoadedMetadata);
      deck.addEventListener('durationchange', handleDurationChange);
      deck.addEventListener('ended', handleEnded);
      deck.addEventListener('playing', handlePlaying);
      deck.addEventListener('stalled', handleStalledOrWaiting);
      deck.addEventListener('waiting', handleStalledOrWaiting);
      deck.addEventListener('error', handleError);

      return () => {
        deck.removeEventListener('timeupdate', handleTimeUpdate);
        deck.removeEventListener('loadedmetadata', handleLoadedMetadata);
        deck.removeEventListener('durationchange', handleDurationChange);
        deck.removeEventListener('ended', handleEnded);
        deck.removeEventListener('playing', handlePlaying);
        deck.removeEventListener('stalled', handleStalledOrWaiting);
        deck.removeEventListener('waiting', handleStalledOrWaiting);
        deck.removeEventListener('error', handleError);
        deck.pause();
      };
    };

    const cleanupA = attachDeckListeners(audioA);
    const cleanupB = attachDeckListeners(audioB);

    return () => {
      if (stallRecoveryTimerRef.current) clearTimeout(stallRecoveryTimerRef.current);
      if (errorAdvanceTimerRef.current) clearTimeout(errorAdvanceTimerRef.current);
      if (transitionAnimFrameRef.current) cancelAnimationFrame(transitionAnimFrameRef.current);
      cleanupA();
      cleanupB();
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
        audioRef.current.muted = false;
        resumeAudioContext();
        await audioRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    } catch (e) {}
  }, []);

  const reconnectRadioStream = useCallback(() => {
    const cur = currentTrackRef.current;
    if (!cur || (!cur.isLive && !cur.isRadio)) return;
    const audio = audioRef.current;
    if (!audio) return;
    const streamUrl = (cur._usedFallback && cur.fallbackUrl) ? cur.fallbackUrl : cur.audioUrl;
    if (streamUrl) {
      const sep = streamUrl.includes('?') ? '&' : '?';
      audio.src = `${streamUrl}${sep}_t=${Date.now()}`;
      resumeAudioContext();
      audio.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  }, []);

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
    const effectSeq = ++playRequestSeqRef.current;
    let isEffectCancelled = false;

    // Abort any pending stream resolve fetch
    if (streamAbortControllerRef.current) {
      streamAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    streamAbortControllerRef.current = abortController;

    (async () => {
      const newId = String(currentTrack.id || currentTrack._id || '');

      // Guard: if track ID is the same and already loaded, don't reload audio stream on metadata updates
      if (newId && newId === lastLoadedIdRef.current) {
        return;
      }

      // Unconditionally stop previous audio immediately when switching to a different song
      if (audioRef.current && audioRef.current.src && newId && newId !== lastLoadedIdRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.removeAttribute('src');
          audioRef.current.load();
        } catch (e) {}
      }

      lastLoadedIdRef.current = newId;

      // Ensure duration is set
      const sDur = sanitizeDuration(currentTrack.duration, 210);
      setDuration(sDur);
      durationRef.current = sDur;

      let streamResult = null;
      try {
        streamResult = await resolvePlayableAudioStream(currentTrack, abortController.signal);
      } catch (err) {
        if (err.name === 'AbortError') return;
      }

      if (isEffectCancelled || effectSeq !== playRequestSeqRef.current || String(currentTrackRef.current?.id || currentTrackRef.current?._id) !== newId) return;

      if (!streamResult?.url) {
        console.warn('[AudioContext] Could not resolve audio stream for track:', currentTrack.title);
        isChangingTrackRef.current = false;
        setIsPlaying(false);
        isPlayingRef.current = false;
        const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
        if (token) {
          fetch(`${API_BASE_URL}/api/users/listening-activity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ track: null, isPlaying: false, currentTime: 0 })
          }).catch(() => {});
        }
        return;
      }

      let playableUrl = streamResult.url;
      if (playableUrl.startsWith('/')) {
        playableUrl = `${API_BASE_URL}${playableUrl}`;
      }

      if (streamResult.cover && (!currentTrack?.cover || currentTrack.cover.includes('default') || currentTrack.cover.includes('unsplash') || currentTrack.cover.includes('ui-avatars'))) {
        setCurrentTrack(prev => (prev && String(prev.id || prev._id) === newId) ? { ...prev, cover: streamResult.cover } : prev);
      }
      if (streamResult.duration && streamResult.duration > 0) {
        const resolvedDur = sanitizeDuration(streamResult.duration, sDur);
        setDuration(resolvedDur);
        durationRef.current = resolvedDur;
      }

      if (streamResult?.track) {
        const dbTrack = streamResult.track;
        const realId = String(dbTrack._id || dbTrack.id);
        setCurrentTrack(prev => {
          if (!prev || (String(prev.id || prev._id) !== newId && prev.title !== dbTrack.title)) return prev;
          const finalCover = (prev.cover && !prev.cover.includes('default') && !prev.cover.includes('ui-avatars')) ? prev.cover : (dbTrack.cover || prev.cover);
          return { ...prev, ...dbTrack, cover: finalCover, id: realId, _id: realId };
        });
        setCurrentQueue(prevQueue =>
          prevQueue.map(t => {
            if (String(t.id || t._id) === newId || (t.title === dbTrack.title && t.artist === dbTrack.artist)) {
              return { ...t, ...dbTrack, id: realId, _id: realId };
            }
            return t;
          })
        );
        if (typeof setTracks === 'function') {
          setTracks(prev => {
            if (prev.some(t => String(t._id || t.id) === realId)) return prev;
            return [dbTrack, ...prev];
          });
        }
      }

      const audio = audioRef.current;
      if (!audio) {
        isChangingTrackRef.current = false;
        return;
      }

      // Re-verify that no newer request came in while resolving
      if (effectSeq !== playRequestSeqRef.current || String(currentTrackRef.current?.id || currentTrackRef.current?._id) !== newId) return;

            if (lastLoadedStreamUrlRef.current !== playableUrl) {
        lastLoadedStreamUrlRef.current = playableUrl;
        audio.src = playableUrl;
        if (pendingInitialSeekRef.current !== null && isFinite(pendingInitialSeekRef.current) && pendingInitialSeekRef.current > 0) {
          try { audio.currentTime = pendingInitialSeekRef.current; } catch (e) {}
          pendingInitialSeekRef.current = null;
        } else {
          audio.currentTime = 0;
        }

        // Full-track pre-buffering: download entire song into local memory Blob in background
        if (playableUrl.startsWith('http') && typeof fetch !== 'undefined') {
          const bufferKey = newId;
          fetch(playableUrl)
            .then(res => res.ok ? res.blob() : null)
            .then(blob => {
              if (blob && String(currentTrackRef.current?.id || currentTrackRef.current?._id) === bufferKey) {
                const blobUrl = URL.createObjectURL(blob);
                activeFullTrackCache.set(bufferKey, blobUrl);
              }
            })
            .catch(() => {});
        }
      }
      audio.volume = volumeRef.current;
      isChangingTrackRef.current = false;

      if (isPlayingRef.current || shouldPlayRef.current) {
        shouldPlayRef.current = false;
        resumeAudioContext();
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsAutoplayBlocked(false);
          }).catch(e => {
            if (e.name === 'NotAllowedError') {
              setIsAutoplayBlocked(true);
            }
            if (e.name !== 'AbortError') {
              console.warn('[Audio] play() blocked or waiting for gesture:', e.name);
              const retryPlay = () => {
                if (!isPlayingRef.current) return;
                resumeAudioContext();
                audio.play().then(() => {
                  setIsAutoplayBlocked(false);
                }).catch(() => {});
                document.removeEventListener('touchstart', retryPlay);
                document.removeEventListener('click', retryPlay);
              };
              document.addEventListener('touchstart', retryPlay, { once: true, passive: true });
              document.addEventListener('click', retryPlay, { once: true });
            }
          });
        }
        setIsPlaying(true);
      } else {
        audio.pause();
      }
    })();

    return () => {
      isEffectCancelled = true;
      abortController.abort();
    };
  }, [currentTrack?.id || currentTrack?._id]);

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
        ? (currentTime > 86400 ? Math.round(currentTime / 1000) : currentTime)
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

      // Windows Desktop Native App Tray & Discord RPC Bridge (.exe)
      if (typeof window !== 'undefined' && window.chrome?.webview?.postMessage) {
        window.chrome.webview.postMessage(JSON.stringify({
          action: isPlaying ? 'PLAY' : 'PAUSE',
          title: currentTrack.title || 'Rivo',
          artist: currentTrack.artist || 'Rivo Music',
          album: currentTrack.album || 'Rivo',
          artwork: coverSrc,
          currentTime: safeTime,
          duration: safeDuration
        }));
      }
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
              ? (rawT > 86400 ? Math.round(rawT / 1000) : rawT)
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
  const togglePlay = useCallback((isRemoteParam = false) => {
    const isRemote = isRemoteParam === true;
    if (!currentTrackRef.current) return;
    resumeAudioContext();
    const nextPlaying = !isPlayingRef.current;
    isUserPauseActionRef.current = !nextPlaying;
    setIsPlaying(nextPlaying);

    if (!isRemote && jamSessionRef.current && socketRef.current && canControlJam()) {
      const curUser = currentUserRef.current;
      socketRef.current.emit('jam:sync_play_state', {
        roomCode: jamSessionRef.current.code || jamSessionRef.current.roomCode,
        isPlaying: nextPlaying,
        currentTrack: currentTrackRef.current,
        currentTime: currentTimeRef.current || 0,
        initiatorId: socketRef.current.id,
        userId: curUser ? (curUser.id || curUser._id) : undefined,
        isUserAction: true,
        userAction: nextPlaying ? 'play' : 'pause',
      });
    }

    if (!isRemote && socketRef.current && !jamSessionRef.current) {
      socketRef.current.emit('device:playback_state', {
        isPlaying: nextPlaying,
        track: currentTrackRef.current,
        currentTime: currentTimeRef.current || 0,
        deviceType: 'web',
        deviceName: 'Web Browser'
      });
    }

    const audio = audioRef.current;
    const sec = secondaryAudioRef.current;
    if (audio) {
      if (nextPlaying) {
        resumeAudioContext();
        lastPauseTimeRef.current = 0;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.then(() => {
            setIsAutoplayBlocked(false);
          }).catch(e => {
            if (e?.name === 'NotAllowedError') {
              setIsAutoplayBlocked(true);
            }
            console.warn('[Audio] synchronous play rejected on phone:', e);
          });
        }
        if (isTransitionRunningRef.current && sec && sec.src) {
          sec.play().catch(() => {});
        }
      } else {
        lastPauseTimeRef.current = Date.now();
        audio.pause();
        if (sec) sec.pause();
      }
    } else if (sec && !nextPlaying) {
      sec.pause();
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
    window.__RIVO_SYNC_TRACK = (syncData) => {
      if (!syncData || !syncData.track) return;
      const { track, isPlaying: syncPlaying, currentTime: syncTime } = syncData;
      const curId = currentTrackRef.current?.id || currentTrackRef.current?._id;
      const targetId = track.id || track._id;
      if (!curId || String(curId) !== String(targetId)) {
        playTrack(track, tracksRef.current, false);
        if (typeof syncTime === 'number' && syncTime > 0) {
          setTimeout(() => {
            if (seekToRef.current) seekToRef.current(syncTime);
          }, 350);
        }
        if (!syncPlaying && audioRef.current) {
          audioRef.current.pause();
          setIsPlaying(false);
        }
      } else {
        if (typeof syncTime === 'number' && syncTime > 0 && Math.abs((currentTimeRef.current || 0) - syncTime) > 3) {
          if (seekToRef.current) seekToRef.current(syncTime);
        }
        if (syncPlaying && !isPlayingRef.current) {
          resumeAudioContext();
          audioRef.current?.play().catch(() => {});
          setIsPlaying(true);
        } else if (!syncPlaying && isPlayingRef.current) {
          audioRef.current?.pause();
          setIsPlaying(false);
        }
      }
    };
    return () => {
      delete window.__RIVO_MEDIA_ACTION;
      delete window.__RIVO_MEDIA_SEEK;
      delete window.__RIVO_NEXT_TRACK;
      delete window.__RIVO_PREV_TRACK;
      delete window.__RIVO_TOGGLE_PLAY;
      delete window.__RIVO_SYNC_TRACK;
    };
  }, [togglePlay]);

  const playTrack = useCallback(async (track, newQueue = null, isRemote = false, queueIndex = null, isSmartMood = false) => {
    if (!track) return;
    setVocalIsolationStatus(null);

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

    // Track playback history for accurate Previous button navigation (including Shuffle mode)
    if (currentTrackRef.current && !isHistoryNavRef.current) {
      const curId = String(currentTrackRef.current.id || currentTrackRef.current._id || '');
      const nextId = String(track.id || track._id || '');
      if (curId && curId !== nextId) {
        historyStackRef.current.push({
          track: currentTrackRef.current,
          queueIndex: currentQueueIndexRef.current
        });
        if (historyStackRef.current.length > 50) {
          historyStackRef.current.shift();
        }
      }
    }

    if (errorAdvanceTimerRef.current) {
      clearTimeout(errorAdvanceTimerRef.current);
      errorAdvanceTimerRef.current = null;
    }

    isChangingTrackRef.current = true;
    if (!isSeamless) {
      // Immediately stop previous audio synchronously & reset progress to prevent overlap/lag
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
        audioRef.current.volume = volumeRef.current;
        audioRef.current.muted = false;
      }
      setCurrentTime(0);
      currentTimeRef.current = 0;
    }

    let trackToPlay = { ...track };

    // ── STRICT QUEUE ISOLATION (Quran vs Music) & RELEVANT BATCHING ──
    const isTargetRadio = isRadioTrack(trackToPlay);
    const isTargetQuran = !isTargetRadio && isQuranContent(trackToPlay);
    let resolvedQueue = currentQueueRef.current;

    if (isTargetRadio) {
      const radioPool = (newQueue && newQueue.length > 0 && newQueue.some(isRadioTrack))
        ? newQueue.filter(isRadioTrack)
        : QURAN_LIVE_STATIONS;
      resolvedQueue = radioPool.length > 0 ? radioPool : [trackToPlay];
      currentQueueRef.current = resolvedQueue;
      setCurrentQueue(resolvedQueue);
    } else if (newQueue?.length > 0) {
      if (newQueue === currentQueueRef.current) {
        resolvedQueue = currentQueueRef.current;
      } else {
        const sanitized = newQueue.filter(t => isTargetQuran ? isQuranContent(t) : !isQuranContent(t));
        const pool = sanitized.length > 0 ? sanitized : tracksRef.current.filter(t => isTargetQuran ? isQuranContent(t) : !isQuranContent(t));
        const targetId = String(trackToPlay.id || trackToPlay._id || '');
        const foundIdx = pool.findIndex(t => String(t.id || t._id) === targetId);
        if (pool.length <= 50) {
          resolvedQueue = pool;
        } else {
          const startIdx = foundIdx >= 0 ? Math.max(0, foundIdx - 2) : 0;
          resolvedQueue = pool.slice(startIdx, startIdx + 20);
        }
        if (resolvedQueue.length === 0) resolvedQueue = [trackToPlay];
        currentQueueRef.current = resolvedQueue;
        setCurrentQueue(resolvedQueue);
      }
    }

    // Strict Mix Mode Isolation: Only enable dual-deck mix transitions when playing from a designated Mix Playlist (never for Holy Quran)
    if (!isTargetQuran && newQueue && (newQueue._isMix || (newQueue._transitions && Object.keys(newQueue._transitions).length > 0))) {
      setIsMixMode(true);
      isMixModeRef.current = true;
      if (newQueue._transitions) {
        setActiveTransitions(newQueue._transitions);
        activeTransRef.current = newQueue._transitions;
      }
    } else {
      setIsMixMode(false);
      isMixModeRef.current = false;
      setActiveTransitions({});
      activeTransRef.current = {};
    }

    if (isSmartMood || newQueue?.some(t => t.isSmartMoodQueue) || trackToPlay.isSmartMoodQueue) {
      isSmartMoodQueueRef.current = true;
    } else if (newQueue) {
      isSmartMoodQueueRef.current = false;
    } else {
      const curQ = currentQueueRef.current;
      const targetId = String(trackToPlay.id || trackToPlay._id || '');
      const isTrackInCurQ = curQ.some(t => String(t.id || t._id) === targetId);

      // If playing remotely or if track is absent from current queue, build relevant contextual queue (max 10 songs!)
      if (!isTrackInCurQ) {
        const pool = tracksRef.current.filter(t => isTargetQuran ? isQuranContent(t) : !isQuranContent(t));
        let contextual = [];
        if (trackToPlay.album && !isTargetQuran) {
          contextual = pool.filter(t => t.album && t.album.toLowerCase().trim() === trackToPlay.album.toLowerCase().trim());
        }
        if (contextual.length <= 1 && trackToPlay.artist) {
          contextual = pool.filter(t => t.artist && t.artist.toLowerCase().trim() === trackToPlay.artist.toLowerCase().trim());
        }
        if (contextual.length <= 1) {
          const foundIdx = pool.findIndex(t => String(t.id || t._id) === targetId);
          if (foundIdx >= 0) {
            contextual = pool.slice(Math.max(0, foundIdx), Math.min(pool.length, foundIdx + 10));
          } else {
            contextual = [trackToPlay, ...pool.slice(0, 9)];
          }
        }
        resolvedQueue = contextual.length > 0 ? contextual.slice(0, 10) : [trackToPlay];
        currentQueueRef.current = resolvedQueue;
        setCurrentQueue(resolvedQueue);
      } else {
        // Check if current queue is strictly composed of the same type
        const curQMatchesType = curQ.length > 0 && curQ.every(t => isTargetQuran ? isQuranContent(t) : !isQuranContent(t));
        if (!curQMatchesType) {
          const pool = tracksRef.current.filter(t => isTargetQuran ? isQuranContent(t) : !isQuranContent(t));
          resolvedQueue = pool.length > 0 ? pool.slice(0, 10) : [trackToPlay];
          setCurrentQueue(resolvedQueue);
        }
      }
    }

    // If Shuffle mode is active, shuffle the upcoming queue ONLY when starting a fresh/different queue
    const isNewQueueDifferent = Boolean(newQueue && (newQueue !== currentQueueRef.current || resolvedQueue.length !== currentQueueRef.current.length));
    if (isShuffleRef.current && isNewQueueDifferent && resolvedQueue.length > 1) {
      unshuffledQueueRef.current = [...resolvedQueue];
      const targetId = String(trackToPlay.id || trackToPlay._id || '');
      const otherTracks = resolvedQueue.filter(t => String(t.id || t._id) !== targetId);
      const shuffledOthers = shuffleArray(otherTracks);
      resolvedQueue = [trackToPlay, ...shuffledOthers];
      setCurrentQueue(resolvedQueue);
    }

    // Set and track active queue index accurately (handles duplicate tracks in queue)
    const targetId = String(trackToPlay.id || trackToPlay._id || '');
    const foundIdx = resolvedQueue.findIndex(t => String(t.id || t._id) === targetId);
    if (foundIdx >= 0) {
      currentQueueIndexRef.current = foundIdx;
      setCurrentQueueIndex(foundIdx);
    } else if (queueIndex !== null && queueIndex !== undefined && queueIndex >= 0 && queueIndex < resolvedQueue.length) {
      currentQueueIndexRef.current = queueIndex;
      setCurrentQueueIndex(queueIndex);
    } else {
      currentQueueIndexRef.current = 0;
      setCurrentQueueIndex(0);
    }

    onTrackStarted(trackToPlay);

    // Broadcast track play event to Jam room if active and local action
    if (!isRemote && jamSessionRef.current && socketRef.current && canControlJam()) {
      const curUser = currentUserRef.current;
      socketRef.current.emit('jam:sync_play_state', {
        roomCode: jamSessionRef.current.code || jamSessionRef.current.roomCode,
        currentTrack: trackToPlay,
        isPlaying: true,
        currentTime: 0,
        initiatorId: socketRef.current.id,
        userId: curUser ? (curUser.id || curUser._id) : undefined
      });
    }

    if (!isRemote && socketRef.current) {
      socketRef.current.emit('device:playback_state', {
        isPlaying: true,
        track: trackToPlay,
        currentTime: 0,
        deviceType: 'web',
        deviceName: 'Web Browser'
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
    if (!seedTrack || isFetchingAiShuffleRef.current) return [];
    isFetchingAiShuffleRef.current = true;
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
          limit: 8
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
        const markedTracks = data.tracks.map(t => ({
          ...t,
          isAiSuggestion: true,
          isSmartShuffle: true
        }));
        let freshTracks = [];
        setCurrentQueue(prev => {
          const existingIds = new Set(prev.map(t => String(t.id || t._id)));
          freshTracks = markedTracks.filter(t => !existingIds.has(String(t.id || t._id)));
          const updated = [...prev, ...freshTracks];
          currentQueueRef.current = updated;
          return updated;
        });
        return freshTracks;
      }
    } catch (err) {
      console.warn('[Smart Shuffle] fetch error:', err);
    } finally {
      isFetchingAiShuffleRef.current = false;
    }
    return [];
  }, []);

  const addToJamQueue = useCallback((trackOrTracks, playNext = false) => {
    if (!trackOrTracks) return;
    if (jamSessionRef.current && socketRef.current) {
      const isArr = Array.isArray(trackOrTracks);
      socketRef.current.emit('jam:add_to_queue', {
        roomCode: jamSessionRef.current.code,
        track: isArr ? undefined : trackOrTracks,
        tracks: isArr ? trackOrTracks : undefined,
        playNext
      });
    }
  }, []);

  const addToQueue = useCallback((trackOrTracks, playNext = false) => {
    if (!trackOrTracks) return;
    if (jamSessionRef.current?.code && socketRef.current) {
      addToJamQueue(trackOrTracks, playNext);
      return;
    }
    const tracksToAdd = Array.isArray(trackOrTracks) ? trackOrTracks.filter(Boolean) : [trackOrTracks];
    if (tracksToAdd.length === 0) return;

    if (!currentTrackRef.current) {
      playTrack(tracksToAdd[0], tracksToAdd, false, 0);
      return;
    }
    const isCurQuran = isQuranContent(currentTrackRef.current);
    const filteredTracks = tracksToAdd.filter(t => isQuranContent(t) === isCurQuran);
    if (filteredTracks.length === 0) return;

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
          updated.splice(curIdx + 1, 0, ...filteredTracks);
          return updated;
        }
      }
      return [...currentList, ...filteredTracks];
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

  const reorderJamQueue = useCallback((fromIndex, toIndex) => {
    if (jamSessionRef.current?.code && socketRef.current) {
      socketRef.current.emit('jam:reorder_queue', {
        roomCode: jamSessionRef.current.code,
        fromIndex,
        toIndex
      });
      setJamSessionState(prev => {
        if (!prev || !Array.isArray(prev.queue)) return prev;
        const q = [...prev.queue];
        if (fromIndex < 0 || toIndex < 0 || fromIndex >= q.length || toIndex >= q.length) return prev;
        const [moved] = q.splice(fromIndex, 1);
        q.splice(toIndex, 0, moved);
        return { ...prev, queue: q };
      });
    }
  }, []);

  const reorderQueue = useCallback((fromIndex, toIndex) => {
    if (jamSessionRef.current?.code && socketRef.current) {
      reorderJamQueue(fromIndex, toIndex);
    }

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
  }, [reorderJamQueue]);

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
      const nextMode = (!prev || prev === false) ? 'shuffle' : (prev === 'shuffle' || prev === true ? 'smart' : false);
      let curList = currentQueueRef.current;
      const curTrack = currentTrackRef.current;
      const isCurQuran = isQuranContent(curTrack);

      // If curList is empty or only 1 item, ensure we populate from tracksRef so the queue NEVER empties or freezes
      if (!curList || curList.length <= 1) {
        const pool = tracksRef.current.filter(t => isCurQuran ? isQuranContent(t) : !isQuranContent(t));
        curList = pool.length > 0 ? pool : (curList || []);
      }

      const curId = String(curTrack?.id || curTrack?._id || '');
      let curIdx = curId ? curList.findIndex(t => String(t.id || t._id) === curId) : -1;
      if (curIdx === -1 && curTrack) {
        curList = [curTrack, ...curList.filter(t => String(t.id || t._id) !== curId)];
        curIdx = 0;
      }

      if (nextMode === 'shuffle') {
        unshuffledQueueRef.current = [...curList];
        if (curList.length <= 3 && curTrack) {
          fetchSmartShuffleTracks(curTrack, curList);
        }
        if (curList.length > 1) {
          const played = curList.slice(0, Math.max(0, curIdx + 1));
          let upcoming = curList.slice(Math.max(0, curIdx + 1));
          if (upcoming.length === 0) {
            const otherTracks = curList.filter(t => String(t.id || t._id) !== curId);
            const shuffledOthers = shuffleArray(otherTracks);
            const newQueue = curTrack ? [curTrack, ...shuffledOthers] : shuffleArray([...curList]);
            currentQueueRef.current = newQueue;
            setCurrentQueue(newQueue);
            currentQueueIndexRef.current = 0;
            setCurrentQueueIndex(0);
          } else {
            const shuffledUpcoming = shuffleArray(upcoming);
            const newQueue = [...played, ...shuffledUpcoming];
            currentQueueRef.current = newQueue;
            setCurrentQueue(newQueue);
            const newIdx = curId ? newQueue.findIndex(t => String(t.id || t._id) === curId) : curIdx;
            const safeNewIdx = newIdx >= 0 ? newIdx : 0;
            currentQueueIndexRef.current = safeNewIdx;
            setCurrentQueueIndex(safeNewIdx);
          }
        }
      } else if (nextMode === false) {
        if (unshuffledQueueRef.current.length > 0) {
          const original = unshuffledQueueRef.current;
          let origIdx = curId ? original.findIndex(t => String(t.id || t._id) === curId) : -1;
          if (origIdx === -1) origIdx = 0;
          currentQueueRef.current = original;
          setCurrentQueue(original);
          currentQueueIndexRef.current = origIdx;
          setCurrentQueueIndex(origIdx);
        }
      } else if (nextMode === 'smart') {
        if (curTrack) {
          fetchSmartShuffleTracks(curTrack, curList);
        }
      }

      try {
        localStorage.setItem('rivo_shuffle', nextMode ? 'true' : 'false');
      } catch {}

      return nextMode;
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

    const cur = currentTrackRef.current;
    const curId = String(cur?.id || cur?._id || '');
    let curIdx = currentQueueIndexRef.current;
    if (curIdx < 0 || curIdx >= activeList.length || String(activeList[curIdx]?.id || activeList[curIdx]?._id) !== curId) {
      curIdx = curId ? activeList.findIndex(t => String(t.id || t._id) === curId) : -1;
    }

    // ── SMART MOOD / TASTE 10-TRACK QUEUE ROTATION ──
    const isSmartQueue = isSmartMoodQueueRef.current || activeList.some(t => t.isSmartMoodQueue);
    if (isSmartQueue) {
      // 1. Advance to next track within the current 10-track set
      if (curIdx >= 0 && curIdx < activeList.length - 1) {
        const nextIdx = curIdx + 1;
        currentQueueIndexRef.current = nextIdx;
        setCurrentQueueIndex(nextIdx);
        playTrack(activeList[nextIdx], activeList, false, nextIdx, true);
        setIsPlaying(true);
        return;
      }

      // 2. All 10 tracks finished! Exclude played tracks and fetch 10 BRAND NEW tracks matching current mood & taste!
      activeList.forEach(t => playedSmartSongIdsRef.current.add(String(t.id || t._id)));

      let followed = [];
      try {
        const raw = localStorage.getItem('rivo_followed_artists') || localStorage.getItem('liofy_followed_artists');
        if (raw) followed = JSON.parse(raw);
      } catch {}

      const allAvailable = tracksRef.current && tracksRef.current.length > 0 ? tracksRef.current : activeList;
      let next10 = getSmartTasteAndMoodTracks({
        allTracks: allAvailable,
        currentUser: currentUserRef.current,
        followedArtists: followed,
        likedTrackIds: likedTrackIds || [],
        excludeTrackIds: playedSmartSongIdsRef.current,
        limit: 10,
      });

      // If library runs out of unplayed tracks, reset history except current track and fetch again
      if (!next10 || next10.length === 0) {
        playedSmartSongIdsRef.current = new Set(curId ? [curId] : []);
        next10 = getSmartTasteAndMoodTracks({
          allTracks: allAvailable,
          currentUser: currentUserRef.current,
          followedArtists: followed,
          likedTrackIds: likedTrackIds || [],
          excludeTrackIds: playedSmartSongIdsRef.current,
          limit: 10,
        });
      }

      if (next10 && next10.length > 0) {
        const tagged = next10.map(t => ({ ...t, isSmartMoodQueue: true }));
        let newQueue = tagged;
        if (isShuffleRef.current && tagged.length > 1) {
          const [first, ...rest] = tagged;
          newQueue = [first, ...shuffleArray(rest)];
        }
        currentQueueRef.current = newQueue;
        setCurrentQueue(newQueue);
        currentQueueIndexRef.current = 0;
        setCurrentQueueIndex(0);
        playTrack(newQueue[0], newQueue, false, 0, true);
        setIsPlaying(true);
        return;
      }
    }

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
      // In shuffle mode, currentQueue is ALREADY shuffled in place!
      // Simply take the next item in the queue so what was displayed under Up Next plays!
      const cur = currentTrackRef.current;
      const curId = String(cur?.id || cur?._id);
      let idx = currentQueueIndexRef.current;
      if (idx < 0 || idx >= activeList.length || String(activeList[idx]?.id || activeList[idx]?._id) !== curId) {
        idx = activeList.findIndex(t => String(t.id || t._id) === curId);
      }
      let nextIdx = idx + 1;

      // Proactively fetch AI tracks when nearing the end of the queue or if queue is small
      if ((nextIdx >= activeList.length - 2 || activeList.length <= 3) && cur) {
        fetchSmartShuffleTracks(cur, activeList);
      }

      if (nextIdx >= activeList.length) {
        // Priority: If repeat queue is on, reshuffle and repeat THIS queue only!
        if (repeatModeRef.current === 'all' || isRepeatRef.current) {
          const reshuffled = shuffleArray(activeList);
          currentQueueRef.current = reshuffled;
          setCurrentQueue(reshuffled);
          currentQueueIndexRef.current = 0;
          setCurrentQueueIndex(0);
          playTrack(reshuffled[0], reshuffled, false, 0);
          return;
        }

        // When repeat is off: Use AI recommendations to continue playback seamlessly!
        (async () => {
          try {
            const fresh = await fetchSmartShuffleTracks(cur, activeList);
            if (fresh && fresh.length > 0) {
              const updatedQueue = [...currentQueueRef.current];
              const newIdx = activeList.length;
              currentQueueIndexRef.current = newIdx;
              setCurrentQueueIndex(newIdx);
              playTrack(fresh[0], updatedQueue, false, newIdx);
              return;
            }
          } catch (e) {
            console.warn('[AI Shuffle Flow Error]', e);
          }

          // Fallback: pick matching tracks from tracksRef that aren't yet in activeList
          const remainingPool = tracksRef.current.filter(t => 
            !activeList.some(a => String(a.id || a._id) === String(t.id || t._id)) &&
            (isCurQuran ? isQuranContent(t) : !isQuranContent(t))
          );
          if (remainingPool.length > 0) {
            const randomPick = remainingPool[Math.floor(Math.random() * remainingPool.length)];
            const updatedQueue = [...activeList, randomPick];
            currentQueueRef.current = updatedQueue;
            setCurrentQueue(updatedQueue);
            const newIdx = activeList.length;
            currentQueueIndexRef.current = newIdx;
            setCurrentQueueIndex(newIdx);
            playTrack(randomPick, updatedQueue, false, newIdx);
            return;
          }
        })();
        return;
      }
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
      } else if (idx >= activeList.length - 1) {
        // Queue of 10 tracks finished! Exclude played songs and fetch 10 BRAND NEW tracks matching current taste & Quran boundary!
        activeList.forEach(t => playedSmartSongIdsRef.current.add(String(t.id || t._id)));
        let followed = [];
        try {
          const raw = localStorage.getItem('rivo_followed_artists') || localStorage.getItem('liofy_followed_artists');
          if (raw) followed = JSON.parse(raw);
        } catch {}

        const pool = tracksRef.current.filter(t => isCurQuran ? isQuranContent(t) : !isQuranContent(t));
        let next10 = getSmartTasteAndMoodTracks({
          allTracks: pool,
          currentUser: currentUserRef.current,
          followedArtists: followed,
          likedTrackIds: likedTrackIds || [],
          excludeTrackIds: playedSmartSongIdsRef.current,
          limit: 10,
        });

        if (!next10 || next10.length === 0) {
          playedSmartSongIdsRef.current = new Set(curId ? [curId] : []);
          next10 = getSmartTasteAndMoodTracks({
            allTracks: pool,
            currentUser: currentUserRef.current,
            followedArtists: followed,
            likedTrackIds: likedTrackIds || [],
            excludeTrackIds: playedSmartSongIdsRef.current,
            limit: 10,
          });
        }

        if (next10 && next10.length > 0) {
          currentQueueRef.current = next10;
          setCurrentQueue(next10);
          currentQueueIndexRef.current = 0;
          setCurrentQueueIndex(0);
          playTrack(next10[0], next10, false, 0);
          setIsPlaying(true);
          return;
        }
      } else {
        const nextIdx = idx + 1;
        currentQueueIndexRef.current = nextIdx;
        setCurrentQueueIndex(nextIdx);
        playTrack(activeList[nextIdx], activeList, false, nextIdx);
      }
    }
    // Force playing state so song starts automatically
    setIsPlaying(true);
  }, [isOfflineMode, playTrack, fetchSmartShuffleTracks]);

  useEffect(() => {
    playNextTrackRef.current = playNextTrack;
  }, [playNextTrack]);

  const playPrevTrack = useCallback((isFromRemoteJam = false) => {
    if ((currentTimeRef.current || 0) > 3) {
      if (seekToRef.current) seekToRef.current(0);
      return;
    }
    isTransitionTriggeredRef.current = false;
    isSeamlessYtHandoffRef.current = false;

    if (!isFromRemoteJam && jamSessionRef.current && socketRef.current) {
      const roomCode = jamSessionRef.current.code || jamSessionRef.current.roomCode;
      if (roomCode) {
        if (!canControlJam()) return;
        socketRef.current.emit('jam:prev_track', { roomCode });
        return;
      }
    }

    // 1. True Playback History: Pop and play previously played track (essential for Shuffle & skip navigation)
    if (historyStackRef.current.length > 0) {
      const prevItem = historyStackRef.current.pop();
      if (prevItem && prevItem.track) {
        isHistoryNavRef.current = true;
        try {
          playTrack(prevItem.track, currentQueueRef.current, false, prevItem.queueIndex);
        } finally {
          setTimeout(() => {
            isHistoryNavRef.current = false;
          }, 150);
        }
        return;
      }
    }

    // 2. Fallback: linear queue backwards
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

  // Background stream prefetching for next tracks in queue (Instant 0ms transitions)
  useEffect(() => {
    if (!isPlaying || !currentTrack) return;
    const timer = setTimeout(() => {
      if (!isPlayingRef.current) return;
      const q = currentQueueRef.current;
      const curIdx = currentQueueIndexRef.current;
      if (q && q.length > 1 && curIdx >= 0) {
        // Prefetch immediate next track
        const nextIdx = (curIdx + 1) % q.length;
        const nextTrack = q[nextIdx];
        if (nextTrack) {
          const trackId = String(nextTrack.id || nextTrack._id || '');
          if (trackId && !clientStreamCache.has(trackId)) {
            resolvePlayableAudioStream(nextTrack, null, true).catch(() => {});
          }
        }
        // Also prefetch 2nd track ahead for seamless continuous listening
        if (q.length > 2) {
          const secondNextIdx = (curIdx + 2) % q.length;
          const secondNextTrack = q[secondNextIdx];
          if (secondNextTrack) {
            const trackId2 = String(secondNextTrack.id || secondNextTrack._id || '');
            if (trackId2 && !clientStreamCache.has(trackId2)) {
              resolvePlayableAudioStream(secondNextTrack, null, true).catch(() => {});
            }
          }
        }
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [currentTrack?.id || currentTrack?._id, isPlaying]);

  const seekTo = useCallback((seconds, isRemoteParam = false) => {
    const isRemote = isRemoteParam === true;
    if (isNaN(seconds)) return;

    // Immediately halt any running crossfade transition on seek to prevent volume override or cutouts
    if (transitionAnimFrameRef.current) {
      cancelAnimationFrame(transitionAnimFrameRef.current);
      transitionAnimFrameRef.current = null;
    }
    isTransitionRunningRef.current = false;
    isTransitionTriggeredRef.current = false;
    setIsTransitioning(false);
    if (secondaryAudioRef.current) {
      try {
        secondaryAudioRef.current.pause();
        secondaryAudioRef.current.volume = 0;
      } catch {}
    }

    const s = Math.max(0, seconds);
    setCurrentTime(s);
    currentTimeRef.current = s;

    if (audioRef.current) {
      try {
        const dur = audioRef.current.duration;
        if (isFinite(dur) && dur > 0) {
          audioRef.current.currentTime = Math.min(s, Math.max(0, dur - 0.2));
        } else {
          audioRef.current.currentTime = s;
        }
        audioRef.current.volume = volumeRef.current;
        audioRef.current.muted = false;
      } catch (err) {
        console.warn('[WebAudio] seekTo error:', err);
      }
    }

    if (!isRemote && jamSessionRef.current && socketRef.current && canControlJam()) {
      jamSessionRef.current.currentTime = s;
      jamSessionRef.current.updatedAt = Date.now();
      const curUser = currentUserRef.current;
      socketRef.current.emit('jam:sync_play_state', {
        roomCode: jamSessionRef.current.code || jamSessionRef.current.roomCode,
        currentTime: s,
        isPlaying: isPlayingRef.current,
        currentTrack: currentTrackRef.current,
        initiatorId: socketRef.current.id,
        userId: curUser ? (curUser.id || curUser._id) : undefined,
        isSeek: true,
        userAction: 'seek',
      });
    }

    if (!isRemote) {
      if (seekListeningSyncTimeoutRef.current) clearTimeout(seekListeningSyncTimeoutRef.current);
      seekListeningSyncTimeoutRef.current = setTimeout(() => {
        if (socketRef.current && currentTrackRef.current) {
          const curDur = (durationRef.current > 0 ? durationRef.current : currentTrackRef.current.duration) || 0;
          socketRef.current.emit('activity:listening', {
            track: { ...currentTrackRef.current, duration: curDur },
            isPlaying: isPlayingRef.current,
            currentTime: s
          });
        }
      }, 250);
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

  const syncRemotePlayState = useCallback(async ({ isPlaying: syncPlaying, currentTrack: syncTrack, currentTime: syncTime, updatedAt, serverTime, isPeriodic, isSeek, userAction }) => {
    let targetTime = Number(syncTime) || 0;
    const refTimestamp = Number(updatedAt || serverTime || 0);
    if (syncPlaying && refTimestamp > 0) {
      const elapsed = Math.max(0, (Date.now() - refTimestamp) / 1000);
      if (elapsed > 0 && elapsed < 3600) {
        targetTime += elapsed;
      }
    }

    const cur = currentTrackRef.current;
    const isDifferentTrack = syncTrack && String(syncTrack.id || syncTrack._id) !== String(lastLoadedIdRef.current || cur?.id || cur?._id);
    const nowTime = Date.now();

    // ⚡ EXPLICIT USER SEEK: Both Host and Guests MUST seek immediately (zero deadband, zero cooldown)
    if (isSeek || userAction === 'seek') {
      lastRemoteSeekRef.current = nowTime;
      if (jamSessionRef.current) {
        jamSessionRef.current.currentTime = targetTime;
        jamSessionRef.current.updatedAt = Date.now();
        if (syncPlaying !== undefined) jamSessionRef.current.isPlaying = Boolean(syncPlaying);
        if (syncTrack) jamSessionRef.current.currentTrack = syncTrack;
        setJamSessionState({ ...jamSessionRef.current });
      }
      setCurrentTime(targetTime);
      currentTimeRef.current = targetTime;
      if (syncPlaying !== undefined) {
        isPlayingRef.current = Boolean(syncPlaying);
        setIsPlaying(Boolean(syncPlaying));
      }
      seekTo(targetTime, true /* isRemote */);
      return;
    }

    // If remote state is PAUSED: pause immediately without any seeking or playback re-triggering!
    if (syncPlaying === false) {
      window.__RIVO_USER_PAUSED = true;
      setIsPlaying(false);
      isPlayingRef.current = false;
      if (audioRef.current) {
        try { audioRef.current.pause(); } catch(e){}
      }
      if (typeof document !== 'undefined') {
        document.querySelectorAll('audio, video').forEach(el => {
          try { el.pause(); } catch(e){}
        });
      }
      if (isDifferentTrack) {
        setCurrentTrack(syncTrack);
        currentTrackRef.current = syncTrack;
      }
      if (targetTime !== undefined) {
        setCurrentTime(Math.max(0, targetTime));
        currentTimeRef.current = Math.max(0, targetTime);
      }
      if (jamSessionRef.current) {
        jamSessionRef.current.isPlaying = false;
        if (syncTrack) jamSessionRef.current.currentTrack = syncTrack;
        jamSessionRef.current.currentTime = targetTime;
        jamSessionRef.current.updatedAt = Date.now();
        setJamSessionState({ ...jamSessionRef.current });
      }
      return;
    }

    window.__RIVO_USER_PAUSED = false;
    if (isDifferentTrack || !audioRef.current?.src) {
      resumeAudioContext();
      const connectStartTime = Date.now();
      await playTrack(syncTrack || cur, null, true /* isRemote */);
      const streamConnectElapsed = (Date.now() - connectStartTime) / 1000;
      const finalSeekTarget = Math.max(0, targetTime + streamConnectElapsed);
      if (finalSeekTarget > 0) {
        setTimeout(() => {
          seekTo(finalSeekTarget, true /* isRemote */);
        }, 150);
      }
      setIsPlaying(true);
      isPlayingRef.current = true;
    } else {
      // Host is master playback source: ignore periodic time sync updates of the same track!
      if (isJamHost()) {
        if (audioRef.current && audioRef.current.paused) {
          resumeAudioContext();
          audioRef.current.play().then(() => {
            setIsAutoplayBlocked(false);
          }).catch((e) => {
            if (e?.name === 'NotAllowedError') {
              setIsAutoplayBlocked(true);
            }
          });
        }
        return;
      }

      // Guest: intelligent smooth drift compensation (Micro-rate adjustment between 0.3s-2.0s, hard seek > 2.0s)
      const localCur = audioRef.current?.currentTime || currentTimeRef.current || 0;
      const drift = targetTime - localCur;
      const absDrift = Math.abs(drift);

      if (audioRef.current && !audioRef.current.paused) {
        if (absDrift > 2.0 && (nowTime - (lastRemoteSeekRef.current || 0) > 4000)) {
          lastRemoteSeekRef.current = nowTime;
          seekTo(targetTime, true /* isRemote */);
          audioRef.current.playbackRate = 1.0;
        } else if (absDrift >= 0.3 && absDrift <= 2.0) {
          // Micro-tempo shift: catch up smoothly without popping or buffering
          audioRef.current.playbackRate = drift > 0 ? 1.05 : 0.95;
        } else if (absDrift < 0.2 && audioRef.current.playbackRate !== 1.0) {
          // Drift aligned within 200ms: restore normal speed
          audioRef.current.playbackRate = 1.0;
        }
      } else if (absDrift > 2.0 && (nowTime - (lastRemoteSeekRef.current || 0) > 4000)) {
        lastRemoteSeekRef.current = nowTime;
        seekTo(targetTime, true /* isRemote */);
      }

      if (audioRef.current) {
        resumeAudioContext();
        audioRef.current.play().then(() => {
          setIsAutoplayBlocked(false);
        }).catch((e) => {
          if (e?.name === 'NotAllowedError') {
            setIsAutoplayBlocked(true);
          }
        });
      }
      setIsPlaying(true);
      isPlayingRef.current = true;
    }
    if (jamSessionRef.current) {
      jamSessionRef.current.isPlaying = true;
      if (syncTrack) jamSessionRef.current.currentTrack = syncTrack;
      jamSessionRef.current.currentTime = targetTime;
      jamSessionRef.current.updatedAt = Date.now();
      setJamSessionState({ ...jamSessionRef.current });
    }
  }, [playTrack, seekTo, isJamHost]);

  const setJamSync = useCallback(({ socket, jamSession: newJamSession }) => {
    if (socket !== undefined) {
      if (socketRef.current && socketRef.current !== socket) {
        socketRef.current.off('jam:advance_host_queue');
        socketRef.current.off('jam:prev_track');
        socketRef.current.off('jam:get_host_time');
        socketRef.current.off('device:remote_playing');
      }
      socketRef.current = socket;
      if (socket) {
        socket.off('jam:advance_host_queue');
        socket.on('jam:advance_host_queue', () => {
          if (playNextTrackRef.current) {
            playNextTrackRef.current();
          }
        });

        socket.off('jam:prev_track');
        socket.on('jam:prev_track', () => {
          if (playPrevTrackRef.current) {
            playPrevTrackRef.current(true);
          }
        });

        socket.off('jam:get_host_time');
        socket.on('jam:get_host_time', ({ requesterSocketId }) => {
          if (jamSessionRef.current?.isHost) {
            socket.emit('jam:report_host_time', {
              roomCode: jamSessionRef.current.code,
              currentTime: currentTimeRef.current || 0,
              isPlaying: isPlayingRef.current,
              currentTrack: currentTrackRef.current,
              requesterSocketId
            });
          }
        });

        // Cross-Device Connect Sync (Rivo Connect: Auto-pause web if other device is playing)
        socket.off('device:force_pause');
        socket.on('device:force_pause', () => {
          if (audioRef.current) {
            try { audioRef.current.pause(); } catch(e){}
          }
          setIsPlaying(false);
          isPlayingRef.current = false;
          window.__RIVO_USER_PAUSED = true;
        });

        socket.off('device:remote_playing');
        socket.on('device:remote_playing', (remoteSession) => {
          if (remoteSession && remoteSession.track) {
            setRemoteDevicePlayback(remoteSession);
            // If the other device is playing and THIS web browser is playing: PAUSE THIS WEB BROWSER!
            if (remoteSession.isPlaying && isPlayingRef.current) {
              if (audioRef.current) {
                audioRef.current.pause();
              }
              setIsPlaying(false);
              isPlayingRef.current = false;
              window.__RIVO_USER_PAUSED = true;
            }
          } else {
            setRemoteDevicePlayback(null);
          }
        });
      }
    }
    if (newJamSession !== undefined) {
      setJamSessionState(newJamSession);
      jamSessionRef.current = newJamSession;
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

  // ── Rivo DJ Mix: Real Dual-Deck Preview = seek track A near its end into track B ──────────
  const previewDjTransition = useCallback(async (tA, tB, transConfig = null) => {
    if (!tA || !tB) return;
    resumeAudioContext();

    const bpmA = Number(tA.bpm) || 120;
    let dur = 8;
    if (transConfig?.bars) {
      dur = Math.round((transConfig.bars * 240) / bpmA);
    } else if (transConfig?.duration) {
      dur = Number(transConfig.duration);
    }
    dur = Math.min(24, Math.max(2, dur));
    const style = transConfig?.style || 'auto';
    const tAId = String(tA.id || tA._id || '');
    const tBId = String(tB.id || tB._id || '');
    const pairKey = `${tAId}___${tBId}`;
    const pairKeyAlt = `${tAId}_${tBId}`;
    const titleKey = `${tA.title}___${tB.title}`;

    const rawDur = (tA.duration && Number(tA.duration) > 5)
      ? Number(tA.duration)
      : (durationRef.current > 0 ? durationRef.current : 180);
    const trackDur = Math.max(10, Math.round(rawDur));
    const calculatedMixOut = (transConfig?.mixOutPoint !== undefined && Number(transConfig.mixOutPoint) > 5)
      ? Number(transConfig.mixOutPoint)
      : Math.max(5, trackDur - 2);
    const mixInPoint = Number(transConfig?.mixInPoint) || 0;
    const seekPoint = Math.max(0, calculatedMixOut - dur - 3);

    // 1. Save transition config across all matching keys so timeupdate definitely finds it
    const configToSave = {
      ...transConfig,
      style,
      duration: dur,
      mixOutPoint: calculatedMixOut,
      mixInPoint,
      crossoverBias: Number(transConfig?.crossoverBias) || 0.5,
      volA: Number(transConfig?.volA) || 100,
      volB: Number(transConfig?.volB) || 100,
      speedA: (!isNaN(Number(transConfig?.speedA)) && Number(transConfig?.speedA) >= 0.85 && Number(transConfig?.speedA) <= 1.15) ? Number(Number(transConfig?.speedA).toFixed(2)) : 1.0,
      speedB: (!isNaN(Number(transConfig?.speedB)) && Number(transConfig?.speedB) >= 0.85 && Number(transConfig?.speedB) <= 1.15) ? Number(Number(transConfig?.speedB).toFixed(2)) : 1.0,
    };

    const nextTrans = {
      ...(activeTransRef.current || {}),
      [pairKey]: configToSave,
      [pairKeyAlt]: configToSave,
      [titleKey]: configToSave,
    };
    setActiveTransitions(nextTrans);
    activeTransRef.current = nextTrans;
    setIsMixMode(true);
    isMixModeRef.current = true;
    isTransitionTriggeredRef.current = false;
    isTransitionRunningRef.current = false;
    standbyPreloadedIdRef.current = null;

    // 2. Ensure queue contains tA and tB sequentially so lookahead transitions into tB
    const q = currentQueueRef.current || [];
    const idxA = q.findIndex(t => String(t.id || t._id) === tAId);
    if (idxA >= 0 && q[idxA + 1] && String(q[idxA + 1].id || q[idxA + 1]._id) === tBId) {
      currentQueueIndexRef.current = idxA;
      setCurrentQueueIndex(idxA);
    } else {
      const previewQueue = [tA, tB];
      currentQueueRef.current = previewQueue;
      setCurrentQueue(previewQueue);
      currentQueueIndexRef.current = 0;
      setCurrentQueueIndex(0);
    }

    // 3. Preload standby deck immediately with tB so it's ready for instant transition
    resolvePlayableAudioStream(tB, null, true).then((res) => {
      if (res?.url && secondaryAudioRef.current) {
        const fullUrl = res.url.startsWith('/') ? `${API_BASE_URL}${res.url}` : res.url;
        secondaryAudioRef.current.src = fullUrl;
        secondaryAudioRef.current.currentTime = Math.max(0, mixInPoint);
        secondaryAudioRef.current.volume = 0;
        try { secondaryAudioRef.current.load(); } catch (e) {}
      }
    }).catch(() => {});

    const curId = String(currentTrackRef.current?.id || currentTrackRef.current?._id || '');

    if (curId !== tAId) {
      pendingInitialSeekRef.current = seekPoint;
      playTrack(tA, [tA, tB]);
      setCurrentTime(seekPoint);
      setIsPlaying(true);
    } else {
      const deck = audioRef.current;
      if (deck) {
        try { deck.currentTime = seekPoint; } catch {}
        deck.volume = volumeRef.current;
        deck.play().catch(() => {});
      }
      setCurrentTime(seekPoint);
      setIsPlaying(true);
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
    isTransitioning,
    activeTransitions, setActiveTransitions,
    previewDjTransition,
    startDjMode, stopDjMode,
    togglePlay, playTrack,
    playNextTrack, playPrevTrack,
    addToQueue, removeFromQueue,
    reorderQueue, clearQueue,
    seekTo, audioRef,
    // Jam Real-Time Sync & Queue API
    jamSession, setJamSync,
    syncRemotePlayState,
    addToJamQueue, removeFromJamQueue, reorderJamQueue,
    remoteDevicePlayback,
    isAutoplayBlocked, resumeAutoplay,
    vocalIsolationStatus,
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
      {isAutoplayBlocked && (
        <div 
          onClick={resumeAutoplay}
          style={{
            position: 'fixed',
            bottom: 96,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 99999,
            backgroundColor: '#10b981',
            color: '#000',
            padding: '10px 22px',
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            cursor: 'pointer',
            fontWeight: '800',
            fontSize: '13px',
            border: '2px solid #000',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
          }}
        >
          <span style={{ fontSize: '16px' }}>📻</span>
          <span>Click here to unmute and sync Jam audio</span>
        </div>
      )}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) throw new Error('useAudioPlayer must be used within an AudioProvider');
  return ctx;
}
