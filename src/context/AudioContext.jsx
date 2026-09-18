import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { initAudioEngine, setEqualizerBands, setMasterVolume, resumeAudioContext } from '../utils/audioEngine';
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
  const [activeTransitions, setActiveTransitions] = useState({});

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

  useEffect(() => { isRepeatRef.current     = isRepeat;    }, [isRepeat]);
  useEffect(() => { isShuffleRef.current    = isShuffle;   }, [isShuffle]);
  useEffect(() => { isMixModeRef.current    = isMixMode;   }, [isMixMode]);
  useEffect(() => { activeTransRef.current  = activeTransitions; }, [activeTransitions]);
  useEffect(() => { currentQueueRef.current = currentQueue;}, [currentQueue]);
  useEffect(() => { tracksRef.current       = tracks;      }, [tracks]);
  useEffect(() => { currentTrackRef.current = currentTrack;}, [currentTrack]);
  useEffect(() => { isPlayingRef.current    = isPlaying;   }, [isPlaying]);
  useEffect(() => { currentTimeRef.current = currentTime;  }, [currentTime]);
  useEffect(() => { jamSessionRef.current   = jamSession;  }, [jamSession]);

  // ── Regular HTML Audio element (for uploaded/SoundCloud tracks) ──
  const audioRef = useRef(null);

  // ── YouTube IFrame Player ────────────────────────────────────────
  const ytPlayerRef       = useRef(null);   // YT.Player instance
  const ytContainerRef    = useRef(null);   // DOM div for YT player
  const ytIntervalRef     = useRef(null);   // polling interval for currentTime
  const isYtTrackRef      = useRef(false);  // is current track a YouTube track?
  const isYtReadyRef      = useRef(false);  // is YT player ready?

  // ── Bulletproof Silencers to PREVENT dual-playback ghost player ──
  const stopYouTube = useCallback(() => {
    if (ytPlayerRef.current) {
      try {
        ytPlayerRef.current.mute();
        ytPlayerRef.current.pauseVideo();
        ytPlayerRef.current.stopVideo();
        if (typeof ytPlayerRef.current.cueVideoById === 'function') {
          ytPlayerRef.current.cueVideoById('');
        }
      } catch {}
    }
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
        }
      }
    };
    const handleLoadedMetadata = () => {
      if (!isNaN(audio.duration) && isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
    };
    const handleEnded = () => {
      if (isYtTrackRef.current) return;
      if (isRepeatRef.current) { audio.currentTime = 0; audio.play().catch(() => {}); }
      else playNextTrack();
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

  // Create hidden YouTube IFrame player div
  useEffect(() => {
    let div = document.getElementById('liofy-yt-player');
    if (!div) {
      div = document.createElement('div');
      div.id = 'liofy-yt-player';
      div.style.cssText = 'position:fixed;bottom:-500px;right:-500px;width:200px;height:200px;opacity:0.001;pointer-events:none;z-index:-999;';
      document.body.appendChild(div);
    }
    ytContainerRef.current = div;

    // Load YouTube IFrame API
    onYtReady(() => {
      if (ytPlayerRef.current) return;
      ytPlayerRef.current = new window.YT.Player('liofy-yt-player', {
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
            isYtReadyRef.current = true;
            ytPlayerRef.current.setVolume(volumeRef.current * 100);
            window.__liofyYTPlayer = ytPlayerRef.current;
            console.log('[YT] Player ready');
          },
          onStateChange: (event) => {
            const YT = window.YT;
            if (event.data === YT.PlayerState.PLAYING) {
              if (isYtTrackRef.current) {
                // Ensure HTML audio cannot play at the same time
                stopHtmlAudio();
                setIsPlaying(true);
                setDuration(ytPlayerRef.current.getDuration() || 210);
                if (ytIntervalRef.current) clearInterval(ytIntervalRef.current);
                ytIntervalRef.current = setInterval(() => {
                  if (ytPlayerRef.current && isYtTrackRef.current) {
                    const t = ytPlayerRef.current.getCurrentTime() || 0;
                    setCurrentTime(t);
                  }
                }, 200);
              } else {
                // YouTube played unexpectedly in the background while on HTML audio! Kill it immediately!
                stopYouTube();
              }
            } else if (event.data === YT.PlayerState.PAUSED) {
              if (isYtTrackRef.current) {
                setIsPlaying(false);
              }
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
            const cur = currentTrackRef.current;
            if (cur) fallbackToHtmlAudio(cur);
          },
        },
      });
    });

    return () => {
      if (ytIntervalRef.current) clearInterval(ytIntervalRef.current);
      if (div && div.parentNode) div.parentNode.removeChild(div);
      ytPlayerRef.current = null;
      isYtReadyRef.current = false;
    };
  }, [stopHtmlAudio, stopYouTube]);

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
        if (!ytPlayerRef.current || !isYtReadyRef.current) {
          setTimeout(loadYt, 200);
          return;
        }
        try {
          ytPlayerRef.current.setVolume(volumeRef.current * 100);
          if (shouldPlayRef.current || isPlaying) {
            shouldPlayRef.current = false;
            ytPlayerRef.current.unMute();
            ytPlayerRef.current.loadVideoById(ytId);
            ytPlayerRef.current.playVideo();
            setIsPlaying(true);
          } else {
            // Do not autoplay on site load — prepare video paused
            ytPlayerRef.current.cueVideoById(ytId);
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
          if (isYtTrackRef.current && ytPlayerRef.current) {
            try {
              const state = ytPlayerRef.current.getPlayerState();
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
                  if (!ytPlayerRef.current || !isYtReadyRef.current) {
                    setTimeout(loadYt, 300);
                    return;
                  }
                  try {
                    ytPlayerRef.current.setVolume(volumeRef.current * 100);
                    if (isPlaying || shouldPlayRef.current) {
                      shouldPlayRef.current = false;
                      ytPlayerRef.current.unMute();
                      ytPlayerRef.current.loadVideoById(ytId);
                      ytPlayerRef.current.playVideo();
                      setIsPlaying(true);
                    } else {
                      ytPlayerRef.current.cueVideoById(ytId);
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
          if (isYtTrackRef.current && ytPlayerRef.current && isYtReadyRef.current) {
            try {
              ytPlayerRef.current.unMute();
              ytPlayerRef.current.playVideo();
            } catch {}
          } else if (audioRef.current) {
            audioRef.current.play().catch(() => {});
          }
          setIsPlaying(true);
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          if (isYtTrackRef.current && ytPlayerRef.current && isYtReadyRef.current) {
            try {
              ytPlayerRef.current.pauseVideo();
            } catch {}
          } else if (audioRef.current) {
            audioRef.current.pause();
          }
          setIsPlaying(false);
        });
        navigator.mediaSession.setActionHandler('previoustrack', () => playPrevTrack());
        navigator.mediaSession.setActionHandler('nexttrack',     () => playNextTrack());
      } catch {}
    }
  }, [currentTrack]);

  // Sync play/pause state changes for YouTube (as safety backup)
  useEffect(() => {
    if (!isYtTrackRef.current) return;
    if (!ytPlayerRef.current || !isYtReadyRef.current) return;
    try {
      const state = ytPlayerRef.current.getPlayerState();
      if (isPlaying && state !== 1 && state !== 3) {
        ytPlayerRef.current.unMute();
        ytPlayerRef.current.playVideo();
      } else if (!isPlaying && state === 1) {
        ytPlayerRef.current.pauseVideo();
      }
    } catch {}
  }, [isPlaying]);

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
      if (ytPlayerRef.current && isYtReadyRef.current) {
        try {
          if (nextPlaying) {
            ytPlayerRef.current.unMute();
            ytPlayerRef.current.playVideo();
          } else {
            ytPlayerRef.current.pauseVideo();
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
  }, []);

  const playTrack = useCallback(async (track, newQueue = null, isRemote = false) => {
    if (!track) return;
    resumeAudioContext();

    // Immediately stop previous audio synchronously to prevent overlap
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (ytPlayerRef.current && isYtReadyRef.current) {
      try {
        ytPlayerRef.current.mute();
        ytPlayerRef.current.pauseVideo();
      } catch {}
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

    // Signal that the next currentTrack change should autoplay
    shouldPlayRef.current = true;
    setCurrentTrack(trackToPlay);
    setIsPlaying(true);
  }, [setTracks]);

  const playNextTrack = useCallback(() => {
    // Advance shared room queue if active in Jam
    if (jamSessionRef.current && socketRef.current) {
      socketRef.current.emit('jam:next_track', { roomCode: jamSessionRef.current.code });
      return;
    }

    const rawQueue = currentQueueRef.current.length > 0 ? currentQueueRef.current : tracksRef.current;
    if (!rawQueue?.length) return;
    const activeList = isOfflineMode ? rawQueue.filter(t => t.downloaded) : rawQueue;
    if (!activeList.length) return;

    // Immediately stop current audio
    if (audioRef.current) audioRef.current.pause();
    if (ytPlayerRef.current && isYtReadyRef.current) {
      try { ytPlayerRef.current.pauseVideo(); } catch {}
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
  }, [isOfflineMode, playTrack, fetchSmartShuffleTracks]);

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

  const playPrevTrack = useCallback(() => {
    const rawQueue = currentQueueRef.current.length > 0 ? currentQueueRef.current : tracksRef.current;
    if (!rawQueue?.length) return;
    const activeList = isOfflineMode ? rawQueue.filter(t => t.downloaded) : rawQueue;
    if (!activeList.length) return;

    // Immediately stop current audio
    if (audioRef.current) audioRef.current.pause();
    if (ytPlayerRef.current && isYtReadyRef.current) {
      try { ytPlayerRef.current.pauseVideo(); } catch {}
    }

    const cur = currentTrackRef.current;
    const curId = String(cur?.id || cur?._id || '');
    const idx = activeList.findIndex(t => String(t.id || t._id) === curId);
    const prevIdx = idx > 0 ? idx - 1 : activeList.length - 1;
    playTrack(activeList[prevIdx], activeList);
    // Force playing state so song starts automatically
    setIsPlaying(true);
  }, [isOfflineMode, playTrack]);

  const seekTo = useCallback((seconds, isRemote = false) => {
    if (isNaN(seconds)) return;
    const s = Math.max(0, seconds);
    setCurrentTime(s);
    currentTimeRef.current = s;

    if (isYtTrackRef.current && ytPlayerRef.current && isYtReadyRef.current) {
      try { ytPlayerRef.current.seekTo(s, true); } catch {}
    } else if (audioRef.current) {
      audioRef.current.currentTime = s;
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
        if (isYtTrackRef.current && ytPlayerRef.current && isYtReadyRef.current) {
          try {
            if (syncPlaying) {
              ytPlayerRef.current.unMute();
              ytPlayerRef.current.playVideo();
            } else {
              ytPlayerRef.current.pauseVideo();
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
  }, [playTrack, seekTo]);

  const setJamSync = useCallback(({ socket, jamSession: newJamSession }) => {
    if (socket !== undefined) socketRef.current = socket;
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
