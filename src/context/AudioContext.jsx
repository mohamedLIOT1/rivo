import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { initAudioEngine, setEqualizerBands, setMasterVolume, resumeAudioContext, calculateCrossfadeGains, playTrueSpotifyMix, getAudioContext } from '../utils/audioEngine';
import { getOfflineTrackAudioUrl } from '../utils/offlineStorage';
import { API_BASE_URL } from '../config';

const AudioPlayerContext = createContext(null);

// ── Extract YouTube video ID from URL ─────────────────────────────
function extractYtId(input) {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();
  const urlMatch = str.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
  if (urlMatch && urlMatch[1] && urlMatch[1].length === 11) return urlMatch[1];
  const prefixMatch = str.match(/^yt[-_]?([a-zA-Z0-9_-]{11})$/i);
  if (prefixMatch && prefixMatch[1] && prefixMatch[1].length === 11) return prefixMatch[1];
  if ((str.includes('youtube.com') || str.includes('youtu.be')) && /^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  return null;
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

async function resolveTrackAudioUrl(track) {
  if (!track) return null;
  let targetUrl = track.audioUrl;
  const isBlobUrl = targetUrl?.startsWith('blob:');
  const isDownloaded = Boolean(track.downloaded && targetUrl);
  const isLocalNativeUrl =
    targetUrl && (
      targetUrl.includes('/_capacitor_file_/') ||
      targetUrl.includes('capacitor://') ||
      targetUrl.startsWith('file://') ||
      targetUrl.startsWith('content://') ||
      (targetUrl.startsWith('http://localhost') && !targetUrl.includes(':5000'))
    );

  const needsResolution = !isBlobUrl && !isDownloaded && !isLocalNativeUrl && (
    track.id?.toString().startsWith('sc-') ||
    track.source === 'SoundCloud' ||
    track.source === 'Import' ||
    track.source === 'Spotify' ||
    !targetUrl ||
    targetUrl.includes('pixabay.com') ||
    targetUrl.includes('sndcdn.com') ||
    targetUrl.includes('soundcloud.com')
  );

  if (needsResolution) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/soundcloud/stream?url=${encodeURIComponent(targetUrl || '')}&id=${track.id || track._id || ''}&title=${encodeURIComponent(track.title || '')}&artist=${encodeURIComponent(track.artist || '')}`);
      const data = await res.json();
      if (data.success && data.url) {
        return {
          url: data.url,
          ytId: extractYtId(data.url),
          duration: data.duration || track.duration || 180,
          cover: data.cover || track.cover
        };
      }
    } catch (err) {
      console.warn('Track resolution error:', err);
    }
  }

  const ytId = extractYtId(targetUrl);
  if (ytId) {
    return { url: targetUrl, ytId, duration: track.duration || 240, cover: track.cover };
  }

  if (!isBlobUrl && !isLocalNativeUrl && targetUrl && targetUrl.startsWith('http') && !targetUrl.includes('/api/proxy-audio')) {
    targetUrl = `${API_BASE_URL}/api/proxy-audio?url=${encodeURIComponent(targetUrl)}`;
  }
  return { url: targetUrl, ytId: null, duration: track.duration || 180, cover: track.cover };
}

// ──────────────────────────────────────────────────────────────────

export function AudioProvider({ children, tracks, setTracks }) {
  const [currentTrack, setCurrentTrack] = useState(() => tracks[0] || null);
  const [currentQueue, setCurrentQueue] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(210);
  const [volume, setVolumeState] = useState(0.8);
  const [isShuffle, setIsShuffle] = useState(false); // false | 'shuffle' | 'smart'
  const [isRepeat, setIsRepeat] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [isYtTrack, setIsYtTrack] = useState(false); // exposed for RAF-based lyrics sync

  // Spotify Mix DJ Mode
  const [isMixMode, setIsMixMode] = useState(false);
  const [activeTransitions, setActiveTransitions] = useState(() => {
    try {
      const saved = localStorage.getItem('liofy_active_transitions');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Equalizer State
  const [eqEnabled, setEqEnabled] = useState(true);
  const [eqPreset, setEqPreset] = useState('Bass Booster');
  const [eqBands, setEqBands] = useState({
    '60Hz': 7, '230Hz': 5, '910Hz': 0, '3.6kHz': -2, '14kHz': 1
  });

  const [jamSession, setJamSessionState] = useState(null);

  const isRepeatRef       = useRef(isRepeat);
  const isShuffleRef      = useRef(isShuffle);
  const isMixModeRef      = useRef(isMixMode);
  const activeTransRef    = useRef(activeTransitions);
  const currentQueueRef   = useRef(currentQueue);
  const tracksRef         = useRef(tracks);
  const currentTrackRef   = useRef(currentTrack);
  const isPlayingRef      = useRef(isPlaying);
  const currentTimeRef    = useRef(currentTime);
  const jamSessionRef     = useRef(jamSession);
  const socketRef         = useRef(null);
  const isRemoteActionRef = useRef(false);
  const seekTimeoutRef    = useRef(null);
  const volumeRef         = useRef(0.8);
  const shouldPlayRef     = useRef(false); // Force autoplay on track change
  const lastLoadedUrlRef  = useRef(null);  // Last URL loaded into audio element (prevents interruption on metadata-only changes)
  const lastLoadedIdRef   = useRef(null);  // Last track ID loaded (detects actual track change vs metadata update)
  const isTransitionTriggeredRef = useRef(false);
  const isSeamlessYtHandoffRef   = useRef(false);
  const playNextTrackRef  = useRef(null);
  const playPrevTrackRef  = useRef(null);

  useEffect(() => { isRepeatRef.current     = isRepeat;    }, [isRepeat]);
  useEffect(() => { isShuffleRef.current    = isShuffle;   }, [isShuffle]);
  useEffect(() => { isMixModeRef.current    = isMixMode;   }, [isMixMode]);
  useEffect(() => { 
    activeTransRef.current = activeTransitions; 
    try {
      if (activeTransitions && typeof activeTransitions === 'object') {
        localStorage.setItem('liofy_active_transitions', JSON.stringify(activeTransitions));
      }
    } catch {}
  }, [activeTransitions]);
  useEffect(() => { currentQueueRef.current = currentQueue;}, [currentQueue]);
  useEffect(() => { tracksRef.current       = tracks;      }, [tracks]);
  useEffect(() => { currentTrackRef.current = currentTrack;}, [currentTrack]);
  useEffect(() => { isPlayingRef.current    = isPlaying;   }, [isPlaying]);
  useEffect(() => { currentTimeRef.current = currentTime;  }, [currentTime]);
  useEffect(() => { jamSessionRef.current   = jamSession;  }, [jamSession]);

  // Broadcast live listening activity to server for Friend Activity
  useEffect(() => {
    if (!currentTrack) return;
    const token = localStorage.getItem('liofy_token');
    if (!token) return;

    const timeout = setTimeout(() => {
      fetch(`${API_BASE_URL}/api/users/listening-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ track: currentTrack, isPlaying })
      }).catch(() => {});
    }, 1200);

    return () => clearTimeout(timeout);
  }, [currentTrack?.id || currentTrack?._id, isPlaying]);

  // ── Regular HTML Audio element (for uploaded/SoundCloud tracks) ──
  const audioRef = useRef(null);
  const secondaryAudioRef = useRef(null);
  const transitionActiveTrackIdRef = useRef(null);
  const activeWebAudioMixRef = useRef(null);

  // ── Dual-Deck YouTube IFrame Players (Deck 1 & Deck 2 for seamless Spotify Mix) ──
  const ytPlayerRef        = useRef(null);   // active player reference
  const ytPlayer1Ref       = useRef(null);   // Deck 1
  const ytPlayer2Ref       = useRef(null);   // Deck 2
  const activeYtDeckRef    = useRef(1);      // 1 or 2
  const isYtReady1Ref      = useRef(false);
  const isYtReady2Ref      = useRef(false);
  const ytIntervalRef      = useRef(null);   // polling interval for currentTime
  const isYtTrackRef       = useRef(false);  // is current track a YouTube track?

  const getActiveYtPlayer = useCallback(() => {
    return activeYtDeckRef.current === 1 ? ytPlayer1Ref.current : ytPlayer2Ref.current;
  }, []);

  const getSecondaryYtPlayer = useCallback(() => {
    return activeYtDeckRef.current === 1 ? ytPlayer2Ref.current : ytPlayer1Ref.current;
  }, []);

  const isCurrentYtReady = useCallback(() => {
    return activeYtDeckRef.current === 1 ? isYtReady1Ref.current : isYtReady2Ref.current;
  }, []);

  // ── Spotify Mix: Real Audio DJ Transition Execution Engine ───────
  const checkAndRunDjTransition = useCallback((cTime, dur) => {
    if (!dur || isNaN(cTime)) return;

    const remaining = dur - cTime;
    const cur = currentTrackRef.current;
    if (!cur) return;

    const rawQueue = currentQueueRef.current.length > 0 ? currentQueueRef.current : tracksRef.current;
    if (!rawQueue || rawQueue.length < 2) return;

    const curId = String(cur.id || cur._id || '');
    let idx = rawQueue.findIndex(t => String(t.id || t._id) === curId || (t.title && cur.title && t.title.trim().toLowerCase() === cur.title.trim().toLowerCase()));
    if (idx === -1 && tracksRef.current.length > 1) {
      idx = tracksRef.current.findIndex(t => String(t.id || t._id) === curId || (t.title && cur.title && t.title.trim().toLowerCase() === cur.title.trim().toLowerCase()));
    }
    if (idx === -1) return;

    const activeQueue = idx < rawQueue.length ? rawQueue : tracksRef.current;
    const nextTrack = activeQueue[(idx + 1) % activeQueue.length];
    const nextId = String(nextTrack.id || nextTrack._id || '');
    const pairKey = `${curId}___${nextId}`;

    let customTrans = activeTransRef.current[pairKey];
    if (!customTrans) {
      const altKey1 = `${cur._id || cur.id}___${nextTrack._id || nextTrack.id}`;
      const altKey2 = `${cur.id || cur._id}___${nextTrack.id || nextTrack._id}`;
      customTrans = activeTransRef.current[altKey1] || activeTransRef.current[altKey2];
    }
    if (!customTrans) {
      for (const [k, v] of Object.entries(activeTransRef.current || {})) {
        const [kA, kB] = k.split('___');
        const isA = kA === curId || (cur._id && kA === String(cur._id)) || (cur.title && kA.toLowerCase() === cur.title.toLowerCase());
        const isB = kB === nextId || (nextTrack._id && kB === String(nextTrack._id)) || (nextTrack.title && kB.toLowerCase() === nextTrack.title.toLowerCase());
        if (isA && isB) {
          customTrans = v;
          break;
        }
      }
    }

    const isMixEnabled = isMixModeRef.current || Boolean(customTrans) || Object.keys(activeTransRef.current).length > 0;
    if (!isMixEnabled) return;

    const allTransValues = Object.values(activeTransRef.current || {});
    const latestConfigured = allTransValues.length > 0 ? allTransValues[allTransValues.length - 1] : null;
    const trans = customTrans || latestConfigured || { style: 'equal_power', duration: 8 };
    const transDuration = Math.min(30, Math.max(2, Number(trans.duration) || 8));

    // Handle smooth track fade-in on start (first 3 seconds)
    if (cTime < 3 && !transitionActiveTrackIdRef.current) {
      const pIn = Math.min(1, Math.max(0, cTime / 3));
      const inVol = volumeRef.current * Math.sin(pIn * (Math.PI / 2));
      if (!isYtTrackRef.current && audioRef.current) {
        audioRef.current.volume = Math.max(0, Math.min(1, inVol));
      } else if (isYtTrackRef.current) {
        const actYt = getActiveYtPlayer();
        if (actYt) {
          try { actYt.setVolume(Math.round(Math.max(0, Math.min(1, inVol)) * 100)); } catch {}
        }
      }
      return;
    }

    // Handle DJ Transition out window
    if (remaining <= transDuration && remaining >= 0) {
      const pOut = Math.min(1, Math.max(0, 1 - (remaining / transDuration)));
      const { gainA, gainB } = calculateCrossfadeGains(pOut, trans.style || 'equal_power');
      const targetVolA = volumeRef.current * gainA;
      const targetVolB = volumeRef.current * gainB;

      const nextYtId = extractYtId(nextTrack.audioUrl);
      const isCurYt = isYtTrackRef.current;

      // ── Scenario 1: YouTube to YouTube or YouTube involved ──
      if (nextYtId) {
        if (transitionActiveTrackIdRef.current !== nextId) {
          transitionActiveTrackIdRef.current = nextId;
          const secPlayer = getSecondaryYtPlayer();
          if (secPlayer) {
            try {
              secPlayer.unMute();
              secPlayer.setVolume(0);
              secPlayer.loadVideoById(nextYtId);
              secPlayer.playVideo();
            } catch (err) {
              console.warn('[YT Deck 2] Start error:', err);
            }
          }
        }

        // Adjust deck A (outgoing)
        if (isCurYt) {
          const actPlayer = getActiveYtPlayer();
          if (actPlayer) {
            try { actPlayer.setVolume(Math.round(Math.max(0, Math.min(1, targetVolA)) * 100)); } catch {}
          }
        } else if (audioRef.current) {
          audioRef.current.volume = Math.max(0, Math.min(1, targetVolA));
        }

        // Adjust deck B (incoming)
        const secPlayer = getSecondaryYtPlayer();
        if (secPlayer && transitionActiveTrackIdRef.current === nextId) {
          try { secPlayer.setVolume(Math.round(Math.max(0, Math.min(1, targetVolB)) * 100)); } catch {}
        }
      }
      // ── Scenario 2: Direct Audio Files (Web Audio API / HTML5 Audio) ──
      else {
        if (!isCurYt && audioRef.current) {
          audioRef.current.volume = Math.max(0, Math.min(1, targetVolA));
        } else if (isCurYt) {
          const actPlayer = getActiveYtPlayer();
          if (actPlayer) {
            try { actPlayer.setVolume(Math.round(Math.max(0, Math.min(1, targetVolA)) * 100)); } catch {}
          }
        }

        if (transitionActiveTrackIdRef.current !== nextId) {
          transitionActiveTrackIdRef.current = nextId;
          resolveTrackAudioUrl(nextTrack).then(async resolved => {
            if (!resolved?.url) return;
            const ctx = getAudioContext();
            if (ctx) {
              resumeAudioContext();
              try {
                const res = await fetch(resolved.url);
                const ab = await res.arrayBuffer();
                const buf = await ctx.decodeAudioData(ab);
                const src = ctx.createBufferSource();
                src.buffer = buf;
                const g = ctx.createGain();
                g.gain.setValueAtTime(0, ctx.currentTime);
                src.connect(g).connect(ctx.destination);
                src.start(0);
                activeWebAudioMixRef.current = { source: src, gainNode: g, stop: () => { try { src.stop(); } catch {} } };
              } catch {
                if (!secondaryAudioRef.current) secondaryAudioRef.current = new Audio();
                const sec = secondaryAudioRef.current;
                sec.src = resolved.url;
                sec.volume = 0;
                sec.currentTime = 0;
                sec.play().catch(() => {});
              }
            }
          });
        }

        if (activeWebAudioMixRef.current?.gainNode) {
          const ctx = getAudioContext();
          if (ctx) {
            activeWebAudioMixRef.current.gainNode.gain.cancelScheduledValues(ctx.currentTime);
            activeWebAudioMixRef.current.gainNode.gain.setValueAtTime(targetVolB, ctx.currentTime);
          }
        } else if (secondaryAudioRef.current) {
          secondaryAudioRef.current.volume = Math.max(0, Math.min(1, targetVolB));
        }
      }

      // Automatically trigger next track right at transition threshold
      const threshold = trans.style === 'cut' ? 0.25 : 0.45;
      if (remaining <= threshold && !isTransitionTriggeredRef.current) {
        isTransitionTriggeredRef.current = true;

        if (nextYtId) {
          const actPlayer = getActiveYtPlayer();
          const secPlayer = getSecondaryYtPlayer();
          if (actPlayer) {
            try { actPlayer.pauseVideo(); actPlayer.mute(); } catch {}
          }
          if (secPlayer) {
            try { secPlayer.setVolume(Math.round(volumeRef.current * 100)); } catch {}
          }
          // Swap active deck seamlessly
          activeYtDeckRef.current = activeYtDeckRef.current === 1 ? 2 : 1;
          ytPlayerRef.current = getActiveYtPlayer();
          isYtTrackRef.current = true;
          setIsYtTrack(true);
          isSeamlessYtHandoffRef.current = true;
        }

        if (playNextTrackRef.current) {
          playNextTrackRef.current();
        }
      }
    } else {
      // Normal playback volume restored outside transition window
      if (!isYtTrackRef.current && audioRef.current && Math.abs(audioRef.current.volume - volumeRef.current) > 0.05) {
        audioRef.current.volume = volumeRef.current;
      }
      if (isYtTrackRef.current) {
        const actPlayer = getActiveYtPlayer();
        if (actPlayer) {
          try { actPlayer.setVolume(Math.round(volumeRef.current * 100)); } catch {}
        }
      }
      if (activeWebAudioMixRef.current) {
        activeWebAudioMixRef.current.stop();
        activeWebAudioMixRef.current = null;
      }
      if (secondaryAudioRef.current && transitionActiveTrackIdRef.current) {
        secondaryAudioRef.current.pause();
      }
      transitionActiveTrackIdRef.current = null;
    }
  }, [getActiveYtPlayer, getSecondaryYtPlayer]);

  // ── Bulletproof Silencers to PREVENT dual-playback ghost player ──
  const stopYouTube = useCallback(() => {
    [ytPlayer1Ref.current, ytPlayer2Ref.current].forEach(p => {
      if (p) {
        try {
          p.mute();
          p.pauseVideo();
          p.stopVideo();
          if (typeof p.cueVideoById === 'function') {
            p.cueVideoById('');
          }
        } catch {}
      }
    });
    if (ytIntervalRef.current) {
      clearInterval(ytIntervalRef.current);
      ytIntervalRef.current = null;
    }
  }, []);

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
          if (!isNaN(audio.duration) && audio.duration > 0) {
            checkAndRunDjTransition(audio.currentTime, audio.duration);
          }
        }
      }
    };
    const handleLoadedMetadata = () => {
      if (!isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
    };
    const handleEnded = () => {
      if (isYtTrackRef.current) return;
      if (isRepeatRef.current) { audio.currentTime = 0; audio.play().catch(() => {}); }
      else if (playNextTrackRef.current) playNextTrackRef.current();
    };
    // ── Key fix: when audio actually starts playing, ensure AudioContext is running & YouTube is killed ──
    const handlePlaying = () => {
      resumeAudioContext();
      if (!isYtTrackRef.current) {
        stopYouTube();
      }
    };
    // If audio gets stuck/stalled, try to resume
    const handleStalled = () => {
      if (!isYtTrackRef.current) {
        setTimeout(() => {
          resumeAudioContext();
          audio.play().catch(() => {});
        }, 500);
      }
    };
    const handleError = () => {
      audio.crossOrigin = null;
      const cur = currentTrackRef.current;
      if (cur && (cur.title || cur.artist) && !cur._retryDone) {
        cur._retryDone = true;
        fetch(`${API_BASE_URL}/api/soundcloud/stream?title=${encodeURIComponent(cur.title || '')}&artist=${encodeURIComponent(cur.artist || '')}`)
          .then(r => r.json())
          .then(d => {
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

  const fallbackToHtmlAudio = useCallback(async (track) => {
    if (!track) return;
    isYtTrackRef.current = false;
    setIsYtTrack(false);
    stopYouTube();

    try {
      const qTitle = encodeURIComponent(track.title || '');
      const qArtist = encodeURIComponent(track.artist || '');
      const res = await fetch(`${API_BASE_URL}/api/soundcloud/fallback?title=${qTitle}&artist=${qArtist}`);
      const d = await res.json();
      if (d.success && d.url && audioRef.current) {
        stopYouTube(); // Double check YouTube is completely silenced
        audioRef.current.src = d.url;
        audioRef.current.volume = volumeRef.current;
        resumeAudioContext();
        await audioRef.current.play();
        setIsPlaying(true);
        if (d.duration) setDuration(d.duration);
        if (d.cover) setCurrentTrack(prev => prev ? { ...prev, cover: d.cover } : prev);
      }
    } catch (err) {
      console.warn('Fallback play error:', err);
    }
  }, [stopYouTube]);

  // Create hidden YouTube IFrame player divs (Deck 1 & Deck 2)
  useEffect(() => {
    let div1 = document.getElementById('liofy-yt-player-1');
    if (!div1) {
      div1 = document.createElement('div');
      div1.id = 'liofy-yt-player-1';
      div1.style.cssText = 'position:fixed;bottom:-500px;right:-500px;width:200px;height:200px;opacity:0.001;pointer-events:none;z-index:-999;';
      document.body.appendChild(div1);
    }
    let div2 = document.getElementById('liofy-yt-player-2');
    if (!div2) {
      div2 = document.createElement('div');
      div2.id = 'liofy-yt-player-2';
      div2.style.cssText = 'position:fixed;bottom:-500px;right:-500px;width:200px;height:200px;opacity:0.001;pointer-events:none;z-index:-999;';
      document.body.appendChild(div2);
    }

    const handleYtStateChange = (deckNum, event) => {
      const YT = window.YT;
      const player = deckNum === 1 ? ytPlayer1Ref.current : ytPlayer2Ref.current;
      if (!player) return;

      if (event.data === YT.PlayerState.PLAYING) {
        if (activeYtDeckRef.current === deckNum && isYtTrackRef.current) {
          stopHtmlAudio();
          setIsPlaying(true);
          try {
            const d = player.getDuration();
            if (d > 0) setDuration(d);
          } catch {}
          if (ytIntervalRef.current) clearInterval(ytIntervalRef.current);
          ytIntervalRef.current = setInterval(() => {
            const activeP = getActiveYtPlayer();
            if (activeP && isYtTrackRef.current) {
              const t = activeP.getCurrentTime() || 0;
              const d = activeP.getDuration() || 0;
              setCurrentTime(t);
              if (d > 0) {
                checkAndRunDjTransition(t, d);
              }
            }
          }, 150);
        } else if (!isYtTrackRef.current) {
          try { player.pauseVideo(); player.mute(); } catch {}
        }
      } else if (event.data === YT.PlayerState.PAUSED) {
        if (activeYtDeckRef.current === deckNum && isYtTrackRef.current) {
          setIsPlaying(false);
          if (ytIntervalRef.current) clearInterval(ytIntervalRef.current);
        }
      } else if (event.data === YT.PlayerState.ENDED) {
        if (activeYtDeckRef.current === deckNum) {
          if (ytIntervalRef.current) clearInterval(ytIntervalRef.current);
          if (isRepeatRef.current) {
            try {
              player.seekTo(0, true);
              player.playVideo();
            } catch {}
          } else {
            if (playNextTrackRef.current) playNextTrackRef.current();
          }
        }
      }
    };

    onYtReady(() => {
      if (!ytPlayer1Ref.current) {
        ytPlayer1Ref.current = new window.YT.Player('liofy-yt-player-1', {
          height: '200',
          width: '200',
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              isYtReady1Ref.current = true;
              if (activeYtDeckRef.current === 1) {
                ytPlayerRef.current = ytPlayer1Ref.current;
                try { ytPlayer1Ref.current.setVolume(volumeRef.current * 100); } catch {}
              }
              console.log('[YT Deck 1] Ready');
            },
            onStateChange: (e) => handleYtStateChange(1, e),
            onError: (e) => {
              console.warn('[YT Deck 1] error:', e.data);
              if (activeYtDeckRef.current === 1) {
                const cur = currentTrackRef.current;
                if (cur) fallbackToHtmlAudio(cur);
              }
            }
          }
        });
      }

      if (!ytPlayer2Ref.current) {
        ytPlayer2Ref.current = new window.YT.Player('liofy-yt-player-2', {
          height: '200',
          width: '200',
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            playsinline: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: () => {
              isYtReady2Ref.current = true;
              try { ytPlayer2Ref.current.setVolume(0); } catch {}
              console.log('[YT Deck 2] Ready');
            },
            onStateChange: (e) => handleYtStateChange(2, e),
            onError: (e) => {
              console.warn('[YT Deck 2] error:', e.data);
              if (activeYtDeckRef.current === 2) {
                const cur = currentTrackRef.current;
                if (cur) fallbackToHtmlAudio(cur);
              }
            }
          }
        });
      }
    });

    return () => {
      if (ytIntervalRef.current) clearInterval(ytIntervalRef.current);
      if (div1 && div1.parentNode) div1.parentNode.removeChild(div1);
      if (div2 && div2.parentNode) div2.parentNode.removeChild(div2);
      ytPlayer1Ref.current = null;
      ytPlayer2Ref.current = null;
      ytPlayerRef.current = null;
      isYtReady1Ref.current = false;
      isYtReady2Ref.current = false;
    };
  }, [stopHtmlAudio, stopYouTube, checkAndRunDjTransition, fallbackToHtmlAudio, getActiveYtPlayer]);

  // EQ sync
  useEffect(() => { setEqualizerBands(eqBands, eqEnabled); }, [eqBands, eqEnabled]);

  const setVolume = (val) => {
    volumeRef.current = val;
    setVolumeState(val);
    setMasterVolume(val);
    if (audioRef.current) audioRef.current.volume = val;
    const actPlayer = getActiveYtPlayer();
    if (actPlayer && isCurrentYtReady()) {
      try { actPlayer.setVolume(val * 100); } catch {}
    }
  };

  // ── Main track playback logic ──────────────────────────────────
  useEffect(() => {
    if (!currentTrack) return;

    const newId  = String(currentTrack.id || currentTrack._id || '');
    const newUrl = currentTrack.audioUrl || '';

    // Guard: if track ID and audioUrl haven't changed, this is a metadata-only update
    if (newId === lastLoadedIdRef.current && newUrl === lastLoadedUrlRef.current && lastLoadedUrlRef.current) {
      return;
    }

    lastLoadedIdRef.current  = newId;
    lastLoadedUrlRef.current = newUrl;

    const isBlobUrl = newUrl.startsWith('blob:') || newUrl.startsWith('data:');
    const isLocalFile = newUrl.includes('/_capacitor_file_/') || newUrl.includes('capacitor://') || newUrl.startsWith('file://') || newUrl.startsWith('content://') || newUrl.endsWith('.mp3');
    const isDownloaded = Boolean(currentTrack.downloaded || currentTrack.nativeAudioUri);

    // Track is ONLY a YouTube online track if it's NOT a blob, NOT a local device file, and NOT marked as downloaded
    const ytId = (!isBlobUrl && !isLocalFile && !isDownloaded) ? extractYtId(newUrl) : null;

    if (ytId) {
      // ── YouTube track ──────────────────────────────────────────
      isYtTrackRef.current = true;
      setIsYtTrack(true);

      // Stop and unload HTML audio completely
      stopHtmlAudio();

      setCurrentTime(0);
      setDuration(currentTrack.duration || 210);

      let watchdog = null;
      const loadYt = () => {
        const actPlayer = getActiveYtPlayer();
        const secPlayer = getSecondaryYtPlayer();
        if (secPlayer) {
          try {
            secPlayer.pauseVideo();
            secPlayer.mute();
          } catch {}
        }
        if (!actPlayer || !isCurrentYtReady()) {
          setTimeout(loadYt, 200);
          return;
        }
        try {
          actPlayer.setVolume(volumeRef.current * 100);
          if (shouldPlayRef.current || isPlaying) {
            shouldPlayRef.current = false;
            actPlayer.unMute();
            actPlayer.loadVideoById(ytId);
            actPlayer.playVideo();
            setIsPlaying(true);
          } else {
            // Do not autoplay on site load — prepare video paused
            actPlayer.cueVideoById(ytId);
            setIsPlaying(false);
          }
        } catch (e) {
          console.warn('[YT] loadVideoById error:', e);
          if (shouldPlayRef.current || isPlaying) {
            fallbackToHtmlAudio(currentTrack);
          }
        }
      };
      loadYt();

      // Only arm watchdog if playback was actively requested
      if (shouldPlayRef.current || isPlaying) {
        watchdog = setTimeout(() => {
          const actPlayer = getActiveYtPlayer();
          if (isYtTrackRef.current && actPlayer) {
            try {
              const state = actPlayer.getPlayerState();
              if (state !== 1 && state !== 3) {
                console.warn('[YT] Watchdog: YouTube not playing after 6s, falling back to audio stream');
                fallbackToHtmlAudio(currentTrack);
              }
            } catch {}
          }
        }, 6000);
      }

      return () => {
        if (watchdog) clearTimeout(watchdog);
      };

    } else {
      // ── Regular audio (Upload / Downloaded Blob / SoundCloud) ─
      isYtTrackRef.current = false;
      setIsYtTrack(false);

      // Stop YouTube player completely so it cannot play in background
      stopYouTube();

      let targetUrl = newUrl;
      const isDownloaded = Boolean(currentTrack.downloaded || currentTrack.nativeAudioUri);
      const isLocalNativeUrl =
        targetUrl && (
          targetUrl.includes('/_capacitor_file_/') ||
          targetUrl.includes('capacitor://') ||
          targetUrl.startsWith('file://') ||
          targetUrl.startsWith('content://') ||
          (targetUrl.startsWith('http://localhost') && !targetUrl.includes(':5000'))
        );

      const needsResolution = !isBlobUrl && !isDownloaded && !isLocalNativeUrl && (
        currentTrack.source === 'SoundCloud' ||
        currentTrack.source === 'Import' ||
        currentTrack.source === 'Spotify' ||
        !targetUrl ||
        targetUrl.includes('pixabay.com') ||
        targetUrl.includes('sndcdn.com') ||
        targetUrl.includes('soundcloud.com')
      );

      if (needsResolution) {
        if (audioRef.current) audioRef.current.pause();
        fetch(`${API_BASE_URL}/api/soundcloud/stream?url=${encodeURIComponent(targetUrl || '')}&id=${currentTrack.id || currentTrack._id || ''}&title=${encodeURIComponent(currentTrack.title || '')}&artist=${encodeURIComponent(currentTrack.artist || '')}`)
          .then(r => r.json())
          .then(data => {
            if (data.success && data.url) {
              const freshUrl = data.url;
              const ytId = extractYtId(freshUrl);

              if (data.cover) {
                setCurrentTrack(prev => prev ? { ...prev, cover: data.cover } : prev);
              }

              if (ytId) {
                // Switch seamlessly to YouTube player
                isYtTrackRef.current = true;
                setIsYtTrack(true);
                stopHtmlAudio();
                if (data.duration && isFinite(data.duration) && data.duration > 0) {
                  setDuration(data.duration);
                }
                const loadYt = () => {
                  const actPlayer = getActiveYtPlayer();
                  const secPlayer = getSecondaryYtPlayer();
                  if (secPlayer) {
                    try {
                      secPlayer.pauseVideo();
                      secPlayer.mute();
                    } catch {}
                  }
                  if (!actPlayer || !isCurrentYtReady()) {
                    setTimeout(loadYt, 300);
                    return;
                  }
                  try {
                    actPlayer.setVolume(volumeRef.current * 100);
                    if (isPlaying || shouldPlayRef.current) {
                      shouldPlayRef.current = false;
                      actPlayer.unMute();
                      actPlayer.loadVideoById(ytId);
                      actPlayer.playVideo();
                      setIsPlaying(true);
                    } else {
                      actPlayer.cueVideoById(ytId);
                      setIsPlaying(false);
                    }
                  } catch (e) {
                    console.warn('[YT] loadVideoById error:', e);
                  }
                };
                loadYt();
              } else {
                // HTML5 Audio playback
                isYtTrackRef.current = false;
                setIsYtTrack(false);
                stopYouTube();
                const audio = audioRef.current;
                if (data.duration && isFinite(data.duration) && data.duration > 0) {
                  setDuration(data.duration);
                }
                if (audio) {
                  audio.src = freshUrl;
                  audio.volume = volumeRef.current;
                  if (shouldPlayRef.current || isPlaying) {
                    audio.play().catch(e => console.warn('Stream play error:', e));
                  }
                }
              }
            }
          })
          .catch(err => console.warn('Stream resolution error:', err));
      } else {
        // Detect local native device file URLs (Capacitor) — must NOT go through remote proxy
        if (!isBlobUrl && !isLocalNativeUrl && targetUrl && targetUrl.startsWith('http') && !targetUrl.includes('/api/proxy-audio')) {
          targetUrl = `${API_BASE_URL}/api/proxy-audio?url=${encodeURIComponent(targetUrl)}`;
        }

        const audio = audioRef.current;
        if (!audio) return;
        if (audio.src !== targetUrl) { audio.src = targetUrl; }
        audio.volume = volumeRef.current;

        if (isPlaying || shouldPlayRef.current) {
          shouldPlayRef.current = false;
          const playPromise = audio.play();
          if (playPromise !== undefined) {
            playPromise.catch(e => {
              console.warn('[Audio] play() blocked on phone, will retry on next gesture:', e.name);
              const retryPlay = () => {
                resumeAudioContext();
                audio.play().catch(() => {});
                document.removeEventListener('touchstart', retryPlay);
                document.removeEventListener('click', retryPlay);
              };
              document.addEventListener('touchstart', retryPlay, { once: true, passive: true });
              document.addEventListener('click', retryPlay, { once: true });
            });
          }
        } else {
          audio.pause();
        }
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
        navigator.mediaSession.setActionHandler('play', () => {
          resumeAudioContext();
          const actPlayer = getActiveYtPlayer();
          if (isYtTrackRef.current && actPlayer && isCurrentYtReady()) {
            try {
              actPlayer.unMute();
              actPlayer.playVideo();
            } catch {}
          } else if (audioRef.current) {
            audioRef.current.play().catch(() => {});
          }
          setIsPlaying(true);
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          const actPlayer = getActiveYtPlayer();
          if (isYtTrackRef.current && actPlayer && isCurrentYtReady()) {
            try {
              actPlayer.pauseVideo();
            } catch {}
          } else if (audioRef.current) {
            audioRef.current.pause();
          }
          setIsPlaying(false);
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          if (playPrevTrackRef.current) playPrevTrackRef.current();
        });
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          if (playNextTrackRef.current) playNextTrackRef.current();
        });
      } catch {}
    }
  }, [currentTrack, getActiveYtPlayer, isCurrentYtReady]);

  // Sync play/pause state changes for YouTube (as safety backup)
  useEffect(() => {
    if (!isYtTrackRef.current) return;
    const actPlayer = getActiveYtPlayer();
    if (!actPlayer || !isCurrentYtReady()) return;
    try {
      const state = actPlayer.getPlayerState();
      if (isPlaying && state !== 1 && state !== 3) {
        actPlayer.unMute();
        actPlayer.playVideo();
      } else if (!isPlaying && state === 1) {
        actPlayer.pauseVideo();
      }
    } catch {}
  }, [isPlaying, getActiveYtPlayer, isCurrentYtReady]);

  // Sync play/pause for HTML audio (as safety backup)
  useEffect(() => {
    if (isYtTrackRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying && audio.paused && audio.src) {
      resumeAudioContext();
      audio.play().catch(() => {});
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [isPlaying]);

  // ── Synchronous Direct Play/Pause to satisfy Mobile Autoplay & User Gesture ──
  const togglePlay = useCallback((isRemote = false) => {
    if (!currentTrackRef.current) return;
    resumeAudioContext();
    const nextPlaying = !isPlayingRef.current;
    setIsPlaying(nextPlaying);

    if (!isRemote && jamSessionRef.current && socketRef.current) {
      socketRef.current.emit('jam:sync_play_state', {
        roomCode: jamSessionRef.current.code,
        isPlaying: nextPlaying,
        currentTrack: currentTrackRef.current,
        currentTime: currentTimeRef.current
      });
    }

    if (isYtTrackRef.current) {
      const actPlayer = getActiveYtPlayer();
      if (actPlayer && isCurrentYtReady()) {
        try {
          if (nextPlaying) {
            actPlayer.unMute();
            actPlayer.playVideo();
          } else {
            actPlayer.pauseVideo();
          }
        } catch (e) {
          console.warn('[YT] togglePlay error:', e);
        }
      }
    } else {
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
    }
  }, [getActiveYtPlayer, isCurrentYtReady]);

  const playTrack = useCallback(async (track, newQueue = null, isRemote = false) => {
    if (!track) return;
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

    if (!isSeamless) {
      // Immediately stop previous audio synchronously to prevent overlap
      if (audioRef.current) {
        audioRef.current.pause();
      }
      [ytPlayer1Ref.current, ytPlayer2Ref.current].forEach(p => {
        if (p) {
          try {
            p.mute();
            p.pauseVideo();
          } catch {}
        }
      });
    }

    let trackToPlay = { ...track };

    const offlineAudioUrl = await getOfflineTrackAudioUrl(track.id);
    if (offlineAudioUrl) {
      trackToPlay.audioUrl = offlineAudioUrl;
      trackToPlay.downloaded = true;
      trackToPlay.nativeAudioUri = offlineAudioUrl;
    }

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

    // Broadcast track play event to Jam room if active and local action
    if (!isRemote && jamSessionRef.current && socketRef.current) {
      socketRef.current.emit('jam:sync_play_state', {
        roomCode: jamSessionRef.current.code,
        currentTrack: trackToPlay,
        isPlaying: true,
        currentTime: 0
      });
    }

    if (isSeamless) {
      isSeamlessYtHandoffRef.current = false;
      lastLoadedIdRef.current = String(trackToPlay.id || trackToPlay._id || '');
      lastLoadedUrlRef.current = trackToPlay.audioUrl || '';
      currentTrackRef.current = trackToPlay;
      setCurrentTrack(trackToPlay);
      setIsPlaying(true);
      const actPlayer = getActiveYtPlayer();
      if (actPlayer) {
        try {
          const d = actPlayer.getDuration();
          if (d > 0) setDuration(d);
        } catch {}
      }
      return;
    }

    // Signal that the next currentTrack change should autoplay
    shouldPlayRef.current = true;
    setCurrentTrack(trackToPlay);
    setIsPlaying(true);
  }, [setTracks, getActiveYtPlayer]);

  const fetchSmartShuffleTracks = useCallback(async (seedTrack, currentList = []) => {
    if (!seedTrack) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/smart-shuffle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentTrack: seedTrack,
          seedTracks: currentList.slice(0, 5),
          limit: 6
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
        setCurrentQueue(prev => {
          const existingIds = new Set(prev.map(t => String(t.id || t._id)));
          const fresh = data.tracks.filter(t => !existingIds.has(String(t.id || t._id)));
          return [...prev, ...fresh];
        });
      }
    } catch (err) {
      console.warn('[Smart Shuffle] fetch error:', err);
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

    const rawQueue = currentQueueRef.current.length > 0 ? currentQueueRef.current : tracksRef.current;
    if (!rawQueue?.length) return;
    const activeList = isOfflineMode ? rawQueue.filter(t => t.downloaded) : rawQueue;
    if (!activeList.length) return;

    // Immediately stop current audio only if NOT a seamless handoff
    if (!isSeamlessYtHandoffRef.current) {
      if (audioRef.current) audioRef.current.pause();
      const actPlayer = getActiveYtPlayer();
      if (actPlayer && isCurrentYtReady()) {
        try { actPlayer.pauseVideo(); } catch {}
      }
    }

    const isSmart = isShuffleRef.current === 'smart';
    if (isSmart) {
      const cur = currentTrackRef.current;
      const curId = String(cur?.id || cur?._id || '');
      const candidates = activeList.filter(t => String(t.id || t._id) !== curId);
      const smartCandidates = candidates.filter(t => t.isSmartShuffle);
      const chosen = (smartCandidates.length > 0)
        ? smartCandidates[0]
        : (candidates.length > 0 ? candidates[Math.floor(Math.random() * candidates.length)] : activeList[0]);

      if (candidates.length <= 3 && cur) {
        fetchSmartShuffleTracks(cur, activeList);
      }
      playTrack(chosen, activeList);
    } else if (isShuffleRef.current) {
      playTrack(activeList[Math.floor(Math.random() * activeList.length)], activeList);
    } else {
      const cur = currentTrackRef.current;
      const curId = String(cur?.id || cur?._id || '');
      const idx = activeList.findIndex(t => String(t.id || t._id) === curId);
      const nextIdx = idx >= 0 ? (idx + 1) % activeList.length : 0;
      playTrack(activeList[nextIdx], activeList);
    }
    // Force playing state so song starts automatically
    setIsPlaying(true);
  }, [isOfflineMode, playTrack, fetchSmartShuffleTracks, getActiveYtPlayer, isCurrentYtReady]);

  useEffect(() => {
    playNextTrackRef.current = playNextTrack;
  }, [playNextTrack]);

  const playPrevTrack = useCallback(() => {
    isTransitionTriggeredRef.current = false;
    isSeamlessYtHandoffRef.current = false;
    const rawQueue = currentQueueRef.current.length > 0 ? currentQueueRef.current : tracksRef.current;
    if (!rawQueue?.length) return;
    const activeList = isOfflineMode ? rawQueue.filter(t => t.downloaded) : rawQueue;
    if (!activeList.length) return;

    // Immediately stop current audio
    if (audioRef.current) audioRef.current.pause();
    [ytPlayer1Ref.current, ytPlayer2Ref.current].forEach(p => {
      if (p) {
        try { p.pauseVideo(); } catch {}
      }
    });

    const cur = currentTrackRef.current;
    const curId = String(cur?.id || cur?._id || '');
    const idx = activeList.findIndex(t => String(t.id || t._id) === curId);
    const prevIdx = idx > 0 ? idx - 1 : activeList.length - 1;
    playTrack(activeList[prevIdx], activeList);
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

    const actPlayer = getActiveYtPlayer();
    if (isYtTrackRef.current && actPlayer && isCurrentYtReady()) {
      try {
        actPlayer.seekTo(s, true);
        actPlayer.setVolume(Math.round(volumeRef.current * 100));
      } catch {}
    } else if (audioRef.current) {
      audioRef.current.currentTime = s;
      audioRef.current.volume = volumeRef.current;
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
  }, [getActiveYtPlayer, isCurrentYtReady]);

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
        const actPlayer = getActiveYtPlayer();
        if (isYtTrackRef.current && actPlayer && isCurrentYtReady()) {
          try {
            if (syncPlaying) {
              actPlayer.unMute();
              actPlayer.playVideo();
            } else {
              actPlayer.pauseVideo();
            }
          } catch {}
        } else if (audioRef.current) {
          if (syncPlaying) {
            resumeAudioContext();
            audioRef.current.play().catch(() => {});
          } else {
            audioRef.current.pause();
          }
        }
      }
    }
  }, [playTrack, seekTo, getActiveYtPlayer, isCurrentYtReady]);

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

  // ── Spotify Mix: Audition Transition in Real Time ───────────────
  const previewDjTransition = useCallback(async (tA, tB, transConfig = null) => {
    if (!tA || !tB) return;
    resumeAudioContext();
    setIsMixMode(true);
    isMixModeRef.current = true;
    isTransitionTriggeredRef.current = false;
    transitionActiveTrackIdRef.current = null;

    if (audioRef.current) audioRef.current.pause();
    [ytPlayer1Ref.current, ytPlayer2Ref.current].forEach(p => {
      if (p) {
        try { p.pauseVideo(); p.mute(); } catch {}
      }
    });
    if (activeWebAudioMixRef.current) {
      activeWebAudioMixRef.current.stop();
      activeWebAudioMixRef.current = null;
    }

    const dur = Math.min(30, Math.max(2, Number(transConfig?.duration) || 8));
    const style = transConfig?.style || 'equal_power';
    const pairKey = `${String(tA.id || tA._id)}___${String(tB.id || tB._id)}`;

    const nextTrans = {
      ...activeTransRef.current,
      [pairKey]: { style, duration: dur, autoMatchBpm: true }
    };
    setActiveTransitions(nextTrans);
    activeTransRef.current = nextTrans;

    const [resA, resB] = await Promise.all([
      resolveTrackAudioUrl(tA),
      resolveTrackAudioUrl(tB)
    ]);

    if (!resA?.url || !resB?.url) return;

    const ytIdA = resA.ytId || extractYtId(resA.url);
    const ytIdB = resB.ytId || extractYtId(resB.url);

    if (ytIdA || ytIdB) {
      // ── YouTube Dual-Deck Simulation ──
      const deckA = ytPlayer1Ref.current;
      const deckB = ytPlayer2Ref.current;
      if (!deckA || !deckB) {
        console.warn('[SpotifyMix] Dual YouTube decks not ready yet');
        return;
      }

      activeYtDeckRef.current = 1;
      ytPlayerRef.current = deckA;
      isYtTrackRef.current = true;
      setIsYtTrack(true);
      setCurrentTrack(tA);
      currentTrackRef.current = tA;
      setIsPlaying(true);

      try {
        deckA.unMute();
        deckA.setVolume(Math.round(volumeRef.current * 100));
        deckA.loadVideoById(ytIdA, 20);
        deckA.playVideo();
      } catch (e) {
        console.warn('[SpotifyMix] Deck A load error:', e);
      }

      if (ytIdB) {
        try {
          deckB.unMute();
          deckB.setVolume(0);
          deckB.cueVideoById(ytIdB, 0);
        } catch (e) {
          console.warn('[SpotifyMix] Deck B cue error:', e);
        }
      }

      let simInterval = null;
      let deckBStarted = false;
      let isStopped = false;

      const stopSim = () => {
        isStopped = true;
        if (simInterval) clearInterval(simInterval);
        try { deckA.pauseVideo(); deckA.mute(); } catch {}
        try { deckB.pauseVideo(); deckB.mute(); } catch {}
      };

      activeWebAudioMixRef.current = { stop: stopSim };

      const leadInMs = 1500;
      const transMs = dur * 1000;
      const tailMs = 1500;
      const totalMs = leadInMs + transMs + tailMs;
      const startTime = Date.now();

      simInterval = setInterval(() => {
        if (isStopped) return;
        try {
          const elapsed = Date.now() - startTime;

          // Stage 1: Lead-in with Track A full
          if (elapsed < leadInMs) {
            deckA.setVolume(Math.round(volumeRef.current * 100));
            if (ytIdB && deckB) deckB.setVolume(0);
            return;
          }

          // Stage 2: Active DJ Transition Overlap
          if (elapsed <= leadInMs + transMs) {
            if (!deckBStarted && ytIdB) {
              deckBStarted = true;
              try {
                deckB.unMute();
                deckB.setVolume(0);
                deckB.loadVideoById(ytIdB, 0);
                deckB.playVideo();
              } catch (e) {
                console.warn('[SpotifyMix] Deck B start error:', e);
              }
            }

            const p = Math.min(1, Math.max(0, (elapsed - leadInMs) / transMs));
            const { gainA, gainB } = calculateCrossfadeGains(p, style);
            deckA.setVolume(Math.round(volumeRef.current * gainA * 100));
            if (ytIdB && deckB) {
              deckB.setVolume(Math.round(volumeRef.current * gainB * 100));
            }
            return;
          }

          // Stage 3: Transition Complete, Track B takes over
          deckA.pauseVideo();
          deckA.mute();
          if (ytIdB && deckB) {
            deckB.setVolume(Math.round(volumeRef.current * 100));
            activeYtDeckRef.current = 2;
            ytPlayerRef.current = deckB;
            setCurrentTrack(tB);
            currentTrackRef.current = tB;
          }

          if (elapsed >= totalMs) {
            clearInterval(simInterval);
            setTimeout(() => {
              if (activeWebAudioMixRef.current?.stop === stopSim) {
                activeWebAudioMixRef.current = null;
              }
            }, 3000);
          }
        } catch (e) {
          console.warn('[Simulate Transition] tick error:', e);
        }
      }, 50);

      return;
    }

    // ── Direct Audio Files (Web Audio API) ──
    const mix = await playTrueSpotifyMix({
      songUrl1: resA.url,
      songUrl2: resB.url,
      transitionDuration: dur,
      style,
      previewOnly: true,
      onEnd: () => {
        activeWebAudioMixRef.current = null;
      }
    });

    activeWebAudioMixRef.current = mix;
  }, []);

  const value = {
    currentTrack, setCurrentTrack,
    currentQueue, setCurrentQueue,
    isPlaying, setIsPlaying,
    currentTime, duration,
    volume, setVolume,
    isShuffle, setIsShuffle,
    toggleShuffle,
    isRepeat, setIsRepeat,
    isOfflineMode, setIsOfflineMode,
    isYtTrack,
    isMixMode, setIsMixMode,
    activeTransitions, setActiveTransitions,
    previewDjTransition,
    eqEnabled, setEqEnabled,
    eqPreset, setEqPreset,
    eqBands, setEqBands,
    applyEqPreset,
    togglePlay, playTrack,
    playNextTrack, playPrevTrack,
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
