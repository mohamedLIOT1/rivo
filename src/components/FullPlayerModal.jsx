import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  ChevronDown, ChevronUp, ArrowUp, ArrowDown, ChevronsUp, ChevronsDown,
  Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, 
  Heart, Volume2, VolumeX, Download, Disc, Sparkles, Languages, Loader2,
  MoreHorizontal, MoreVertical, ListMusic, Mic, Trash2, SlidersHorizontal, CheckCircle2,
  Edit3, Check, Search, X, Sun, Moon, Plus, Minus, ListPlus, BookmarkPlus, BookmarkMinus, Save, GripVertical
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAudioPlayer } from '../context/AudioContext';
import { getJamSocket } from '../utils/jamService';
import ConfirmModal from './ConfirmModal';
import { ArtistLinks } from '../utils/artistUtils';
import { isUserAdmin } from '../utils/adminUtils';
import { isQuranContent, cleanQuranTrackTitle, getQuranReciterName } from '../utils/quranUtils';
import { parseLrcLyrics } from '../utils/lrcParser';

// ── Extract dominant color from an image URL using Canvas ──────────────
// Works for YouTube thumbnails (no CORS needed via CSS hack approach)
const colorCache = new Map();

function extractColorFromImage(src, callback) {
  if (!src || src.startsWith('data:')) { callback(null); return; }
  
  // Check cache first
  if (colorCache.has(src)) { callback(colorCache.get(src)); return; }

  const tryExtract = (imgSrc) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const size = 80;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const data = ctx.getImageData(0, 0, size, size).data;

        let bestR = 0, bestG = 0, bestB = 0, bestScore = 0;
        const buckets = new Map();
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2];
          // Skip very dark or near-white pixels
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const lum = (max + min) / 2;
          if (lum < 30 || lum > 225) continue;
          const sat = max === 0 ? 0 : (max - min) / max;
          if (sat < 0.25) continue; // Skip greys

          const key = `${Math.round(r/32)*32},${Math.round(g/32)*32},${Math.round(b/32)*32}`;
          const count = (buckets.get(key) || 0) + 1;
          buckets.set(key, count);
          const score = count * sat;
          if (score > bestScore) {
            bestScore = score;
            bestR = r; bestG = g; bestB = b;
          }
        }

        if (bestScore > 0) {
          const hex = `#${((1 << 24) + (bestR << 16) + (bestG << 8) + bestB).toString(16).slice(1)}`;
          colorCache.set(src, hex);
          callback(hex);
        } else {
          callback(null);
        }
      } catch (e) {
        callback(null);
      }
    };
    img.onerror = () => callback(null);
    img.src = imgSrc;
  };

  tryExtract(src);
}


export default function FullPlayerModal({
  currentTrack,
  isPlaying,
  togglePlay,
  playNext,
  playPrev,
  toggleLike,
  likedTrackIds = [],
  toggleDownload,
  isOpen,
  onClose,
  currentTime,
  duration,
  seekTo,
  volume,
  setVolume,
  isShuffle: propIsShuffle,
  toggleShuffle: propToggleShuffle,
  isRepeat: propIsRepeat,
  repeatMode: propRepeatMode,
  toggleRepeat: propToggleRepeat,
  queue = [],
  openAddToPlaylist,
  onPlayTrack,
  jamSession,
  onAddToJamQueue,
  onRemoveFromJamQueue,
  onSelectArtist,
  onOpenEditSong,
  onDeleteTrack,
  onRemoveTrackFromPlaylist,
  selectedPlaylist,
  currentQueueIndex: propQueueIndex = -1,
  onReorderQueue: propReorderQueue,
  onClearQueue: propClearQueue,
  onAddToQueue,
  onRemoveFromQueue,
  currentUser = null,
  globalTheme = 'dark'
}) {
  const isAdmin = isUserAdmin(currentUser);

  // Get audioRef & isYtTrack directly for frame-perfect lyrics sync
  const { 
    audioRef, isYtTrack, playTrack, currentTime: audioCurrentTime, duration: audioDuration,
    isShuffle: ctxIsShuffle, toggleShuffle: ctxToggleShuffle,
    isRepeat: ctxIsRepeat, repeatMode: ctxRepeatMode, toggleRepeat: ctxToggleRepeat, setIsRepeat,
    currentQueueIndex: ctxQueueIndex, reorderQueue: ctxReorderQueue, clearQueue: ctxClearQueue
  } = useAudioPlayer();

  const isShuffle = propIsShuffle !== undefined ? propIsShuffle : ctxIsShuffle;
  const toggleShuffle = propToggleShuffle || ctxToggleShuffle;
  const isRepeat = propIsRepeat !== undefined ? propIsRepeat : ctxIsRepeat;
  const repeatMode = propRepeatMode || ctxRepeatMode || (isRepeat ? 'all' : 'off');
  const toggleRepeat = propToggleRepeat || ctxToggleRepeat || (() => setIsRepeat?.(p => !p));

  const currentQueueIndex = propQueueIndex >= 0 ? propQueueIndex : (ctxQueueIndex !== undefined ? ctxQueueIndex : -1);
  const reorderQueue = propReorderQueue || ctxReorderQueue;
  const clearQueue = propClearQueue || ctxClearQueue;

  const isTrackLiked = likedTrackIds.some(id => String(id) === String(currentTrack?.id) || String(id) === String(currentTrack?._id)) || Boolean(currentTrack?.liked);

  // Detect if current track is a YouTube track (Groq doesn't support YouTube on Railway)
  const isYouTubeTrack = Boolean(
    currentTrack?.audioUrl &&
    (currentTrack.audioUrl.includes('youtube.com') || currentTrack.audioUrl.includes('youtu.be'))
  );

  const [activeTab, setActiveTab] = useState('player');
  const [desktopSideTab, setDesktopSideTab] = useState('lyrics');
  const [isVinylMode, setIsVinylMode] = useState(false);

  // Use global theme directly
  const isDark = globalTheme === 'dark';

  // Strictly isolate queue: Quran only displays Quran; Music only displays Music
  const isCurQuran = isQuranContent(currentTrack);
  const displayQueue = useMemo(() => {
    const raw = (queue || []).filter(t => isCurQuran ? isQuranContent(t) : !isQuranContent(t));
    if (!currentTrack) return raw;
    const curId = String(currentTrack.id || currentTrack._id || '');
    const hasCur = raw.some(t => String(t.id || t._id) === curId);
    if (!hasCur && curId) {
      return [currentTrack, ...raw];
    }
    return raw;
  }, [queue, currentTrack, isCurQuran]);

  // Partition queue into normal playlist queue and AI suggestions with original indices
  const { normalQueue, aiQueue } = useMemo(() => {
    const normal = [];
    const ai = [];
    (displayQueue || []).forEach((t, origIdx) => {
      const item = { track: t, originalIndex: origIdx };
      if (t.isAiSuggestion || t.isSmartShuffle) {
        ai.push(item);
      } else {
        normal.push(item);
      }
    });
    return { normalQueue: normal, aiQueue: ai };
  }, [displayQueue]);

  // Track Action Menu & Toast states
  const [trackMenuTarget, setTrackMenuTarget] = useState(null);
  const [deleteConfirmTrack, setDeleteConfirmTrack] = useState(null);
  const [actionToast, setActionToast] = useState(null);
  const [draggedQueueIdx, setDraggedQueueIdx] = useState(null);
  const [dragOverQueueIdx, setDragOverQueueIdx] = useState(null);

  const showToast = useCallback((msg) => {
    setActionToast(msg);
    setTimeout(() => {
      setActionToast(prev => prev === msg ? null : prev);
    }, 2500);
  }, []);

  // ── Dynamic background color extracted from album art ──
  const [dynamicColor, setDynamicColor] = useState(null);
  const lastGoodColorRef = useRef(null); // Persists last successfully extracted color

  useEffect(() => {
    if (!currentTrack?.cover) {
      // No cover: use stored color or track.color, but keep lastGoodColor if available
      setDynamicColor(lastGoodColorRef.current || currentTrack?.color || '#17a398');
      return;
    }
    // Use stored color first for instant display (but keep last good color if cover just changed to a native URI)
    if (currentTrack.color) {
      setDynamicColor(currentTrack.color);
    } else if (lastGoodColorRef.current) {
      // Keep showing last good color while we attempt extraction
      setDynamicColor(lastGoodColorRef.current);
    } else {
      setDynamicColor('#17a398');
    }

    const coverUrl = currentTrack.cover;

    // Skip native file URIs — they can't be loaded by canvas due to CORS/security restrictions
    const isNativeUri = coverUrl.startsWith('capacitor://') || coverUrl.startsWith('file://') || coverUrl.startsWith('content://') || coverUrl.startsWith('/_capacitor_file_/');
    if (isNativeUri) {
      // Native cover: keep the last good color we extracted from the original URL
      if (lastGoodColorRef.current) setDynamicColor(lastGoodColorRef.current);
      return;
    }

    // Try direct first, then via proxy (bypass YouTube CORS)
    extractColorFromImage(coverUrl, (color) => {
      if (color) {
        lastGoodColorRef.current = color;
        setDynamicColor(color);
      } else {
        // Fallback: use server proxy to bypass CORS for YouTube thumbnails
        const proxiedUrl = `${API_BASE_URL}/api/proxy-image?url=${encodeURIComponent(coverUrl)}`;
        extractColorFromImage(proxiedUrl, (c2) => {
          if (c2) {
            lastGoodColorRef.current = c2;
            setDynamicColor(c2);
          } else if (lastGoodColorRef.current) {
            setDynamicColor(lastGoodColorRef.current);
          }
        });
      }
    });
  }, [currentTrack?.cover, currentTrack?.color]);

  const trackColor = dynamicColor || currentTrack?.color || '#17a398';

  const rawActiveTime = currentTime !== undefined ? currentTime : (audioCurrentTime || 0);
  const activeTime = rawActiveTime > 10000 ? Math.round(rawActiveTime / 1000) : rawActiveTime;
  const rawActiveDur = (duration !== undefined && duration > 0) ? duration : (audioDuration || currentTrack?.duration || 210);
  const activeDuration = rawActiveDur > 10000 ? Math.round(rawActiveDur / 1000) : (rawActiveDur > 0 ? rawActiveDur : 210);

  // High-frequency 50ms sampler to eliminate visual lag during lyrics playback
  const [smoothTime, setSmoothTime] = useState(activeTime);

  useEffect(() => {
    setSmoothTime(activeTime);
  }, [activeTime]);

  useEffect(() => {
    if (!isOpen || !isPlaying) return;
    const interval = setInterval(() => {
      if (audioRef?.current && !isYtTrack && !isNaN(audioRef.current.currentTime)) {
        const curr = audioRef.current.currentTime;
        setSmoothTime(prev => (Math.abs(curr - prev) >= 0.2 ? curr : prev));
      }
    }, 200);
    return () => clearInterval(interval);
  }, [isOpen, isPlaying, isYtTrack, audioRef]);

  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedLyrics, setTranslatedLyrics] = useState(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [syncOffset, setSyncOffset] = useState(0);

  const [localLyrics, setLocalLyrics] = useState(null);
  const [isLyricsVerified, setIsLyricsVerified] = useState(false);
  const [lyricsVerifiedBy, setLyricsVerifiedBy] = useState(null);

  useEffect(() => {
    setSyncOffset(0);
    setLocalLyrics(null);
    setIsLyricsVerified(false);
    setLyricsVerifiedBy(null);
    setTranslatedLyrics(null);
    setShowTranslation(false);

    if (currentTrack) {
      // 1. If track already has embedded or loaded lyrics (LRC string or array), parse and preserve
      if (currentTrack.lyrics) {
        const parsed = parseLrcLyrics(currentTrack.lyrics);
        if (parsed.length > 0) {
          setLocalLyrics(parsed);
          currentTrack.lyrics = parsed;
          return;
        }
      }

      // 2. If track is local import or downloaded, do not generate AI lyrics
      if (currentTrack.isLocalImport || currentTrack.localAudioUri || currentTrack.downloaded) {
        setLocalLyrics([]);
        return;
      }

      const qTitle = currentTrack.title;
      const qArtist = currentTrack.artist;
      const tId = currentTrack.id || currentTrack._id;
      if (qTitle) {
        // First check server for manually saved or cached lyrics
        fetch(`${API_BASE_URL}/api/tracks/lyrics?trackId=${encodeURIComponent(tId || '')}&title=${encodeURIComponent(qTitle || '')}&artist=${encodeURIComponent(qArtist || '')}`)
          .then(r => r.json())
          .then(d => {
            if (d.success && Array.isArray(d.lyrics) && d.lyrics.length > 0) {
              const parsed = parseLrcLyrics(d.lyrics);
              setLocalLyrics(parsed);
              setIsLyricsVerified(Boolean(d.isVerified));
              setLyricsVerifiedBy(d.verifiedBy || null);
              currentTrack.lyrics = parsed;
            } else if (!currentTrack.lyrics || currentTrack.lyrics.length === 0) {
              if (currentTrack.isLocalImport || currentTrack.localAudioUri || currentTrack.downloaded) {
                return;
              }
              setIsLyricsVerified(false);
              setLyricsVerifiedBy(null);
              fetch(`${API_BASE_URL}/api/ai/generate-song-lyrics`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  trackId: tId,
                  title: qTitle,
                  artist: qArtist,
                  duration: currentTrack.duration || 180,
                })
              })
              .then(r => r.json())
              .then(g => {
                if (g.success && Array.isArray(g.lyrics) && g.lyrics.length > 0) {
                  const parsedAi = parseLrcLyrics(g.lyrics);
                  setLocalLyrics(parsedAi);
                  setIsLyricsVerified(false);
                  setLyricsVerifiedBy(null);
                  currentTrack.lyrics = parsedAi;
                }
              })
              .catch(() => {});
            }
          })
          .catch(() => {});
      }
    }
  }, [currentTrack?.id, currentTrack?._id, currentTrack?.title]);

  // Real-time socket listener for lyrics updates from ANY user
  useEffect(() => {
    const s = getJamSocket();
    if (!s) return;
    const onLyricsUpdated = (data) => {
      if (!currentTrack) return;
      const curTitle = (currentTrack.title || '').toLowerCase().trim();
      const curId = String(currentTrack.id || currentTrack._id || '');

      const matches =
        (data.trackId && String(data.trackId) === curId) ||
        (data.title && data.title.toLowerCase().trim() === curTitle);

      if (matches && Array.isArray(data.lyrics)) {
        const parsedSocket = parseLrcLyrics(data.lyrics);
        setLocalLyrics(parsedSocket);
        setIsLyricsVerified(Boolean(data.isVerified));
        setLyricsVerifiedBy(data.verifiedBy || null);
        currentTrack.lyrics = parsedSocket;
      }
    };
    s.on('lyrics:updated', onLyricsUpdated);
    return () => {
      s.off('lyrics:updated', onLyricsUpdated);
    };
  }, [currentTrack?.id, currentTrack?._id, currentTrack?.title]);

  const rawLyrics = localLyrics || (currentTrack?.lyrics ? parseLrcLyrics(currentTrack.lyrics) : []);
  const baseLyrics = (showTranslation && translatedLyrics) ? translatedLyrics : rawLyrics;

  const lyrics = useMemo(() => {
    if (!baseLyrics || !baseLyrics.length) return [];
    if (!syncOffset) return baseLyrics;
    return baseLyrics.map(l => ({
      ...l,
      time: Math.max(0, Math.round((l.time + syncOffset) * 100) / 100)
    }));
  }, [baseLyrics, syncOffset]);

  const effectiveLyricTime = (audioRef?.current && !isYtTrack && !isNaN(audioRef.current.currentTime) && isPlaying)
    ? smoothTime
    : activeTime;

  const activeLyricIndex = lyrics.length > 0
    ? lyrics.findIndex((line, idx) => {
        const nextLine = lyrics[idx + 1];
        return effectiveLyricTime >= line.time && (!nextLine || effectiveLyricTime < nextLine.time);
      })
    : -1;

  const handleNudgeSync = (delta) => {
    setSyncOffset(prev => {
      const next = Math.round((prev + delta) * 10) / 10;
      showToast(next === 0 ? 'Lyrics sync reset' : `Lyrics timing: ${next > 0 ? '+' : ''}${next}s ${next < 0 ? '(earlier)' : '(later)'}`);
      return next;
    });
    setTimeout(() => {
      scrollToActiveLyric('smooth');
    }, 60);
  };

  const [isSavingSync, setIsSavingSync] = useState(false);
  const handleSavePermanentSync = async () => {
    if (!currentTrack || !rawLyrics.length || syncOffset === 0) return;
    setIsSavingSync(true);
    try {
      const shifted = rawLyrics.map(l => ({
        ...l,
        time: Math.max(0, Math.round((Number(l.time || 0) + syncOffset) * 100) / 100)
      }));
      const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || (currentUser && currentUser.token);
      await fetch(`${API_BASE_URL}/api/tracks/update-lyrics`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          trackId: currentTrack.id || currentTrack._id,
          title: currentTrack.title,
          artist: currentTrack.artist,
          audioUrl: currentTrack.audioUrl,
          lyrics: shifted,
          isVerified: isLyricsVerified
        })
      });
      currentTrack.lyrics = shifted;
      setLocalLyrics(shifted);
      setSyncOffset(0);
      showToast('Lyrics sync permanently saved!');
    } catch (err) {
      console.warn('Failed to save sync:', err);
      showToast('Failed to save sync');
    }
    setIsSavingSync(false);
  };


  const handleTranslateLyrics = async () => {
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }
    if (translatedLyrics) {
      setShowTranslation(true);
      return;
    }
    if (!rawLyrics.length) return;
    setIsTranslating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/translate-lyrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lyrics: rawLyrics,
          title: currentTrack?.title,
          artist: currentTrack?.artist
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.translatedLyrics)) {
        setTranslatedLyrics(data.translatedLyrics);
        setShowTranslation(true);
      }
    } catch (e) {
      console.warn('AI Translate error:', e);
    }
    setIsTranslating(false);
  };

  const [isGeneratingLyrics, setIsGeneratingLyrics] = useState(false);
  const [isClearingLyrics, setIsClearingLyrics] = useState(false);
  const [isManualEditOpen, setIsManualEditOpen] = useState(false);
  const [manualText, setManualText] = useState('');
  const [markVerified, setMarkVerified] = useState(true);
  const [isSavingManualLyrics, setIsSavingManualLyrics] = useState(false);

  const openManualEdit = () => {
    if (!isAdmin) return;
    const formatted = rawLyrics
      .map(line => {
        const m = Math.floor(line.time / 60);
        const s = Math.floor(line.time % 60);
        const timeStr = `[${m}:${s < 10 ? '0' : ''}${s}]`;
        return `${timeStr} ${line.text}`;
      })
      .join('\n');
    setManualText(formatted);
    setMarkVerified(isLyricsVerified !== false);
    setIsManualEditOpen(true);
  };

  const handleSaveManualLyrics = async () => {
    if (!currentTrack || !isAdmin) return;
    setIsSavingManualLyrics(true);
    try {
      const lines = manualText
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

      const parsed = lines.map((line, idx) => {
        const match = line.match(/\[?(\d+):(\d+)(?:\.(\d+))?\]?\s*(.*)/);
        if (match) {
          const m = parseInt(match[1]);
          const s = parseInt(match[2]);
          const cs = match[3] ? parseInt(match[3].padEnd(2, '0').slice(0, 2)) : 0;
          const time = m * 60 + s + cs / 100;
          return { time: Math.round(time * 100) / 100, text: match[4].trim() || line };
        } else {
          // Space lines evenly across song duration if no timestamp provided
          const songDur = currentTrack.duration || 180;
          const step = Math.max(2, (songDur - 10) / Math.max(1, lines.length));
          return { time: Math.round((5 + idx * step) * 100) / 100, text: line };
        }
      });

      const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || (currentUser && currentUser.token);

      await fetch(`${API_BASE_URL}/api/tracks/update-lyrics`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          trackId: currentTrack.id || currentTrack._id,
          title: currentTrack.title,
          artist: currentTrack.artist,
          audioUrl: currentTrack.audioUrl,
          lyrics: parsed,
          isVerified: markVerified
        })
      });

      if (markVerified) {
        currentTrack.lyrics = parsed;
        setLocalLyrics(parsed);
        setIsLyricsVerified(true);
        setLyricsVerifiedBy(currentUser?.username || 'Admin');
      } else {
        // If unverified, it removed override, let's reset or fetch dynamic scraper
        setIsLyricsVerified(false);
        setLyricsVerifiedBy(null);
        handleGenerateLyrics();
      }

      setTranslatedLyrics(null);
      setShowTranslation(false);
      setIsManualEditOpen(false);
    } catch (e) {
      console.warn('Save manual lyrics error:', e);
    }
    setIsSavingManualLyrics(false);
  };

  const handleGenerateLyrics = async () => {
    if (!currentTrack) return;
    setIsGeneratingLyrics(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/generate-song-lyrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId: currentTrack.id || currentTrack._id,
          title: currentTrack.title,
          artist: currentTrack.artist,
          duration: currentTrack.duration || 180,
          audioUrl: currentTrack.audioUrl
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.lyrics) && data.lyrics.length > 0) {
        currentTrack.lyrics = data.lyrics;
        setLocalLyrics(data.lyrics);
        setTranslatedLyrics(null);
        setShowTranslation(false);
      }
    } catch (e) {
      console.warn('LRCLIB Lyrics error:', e);
    }
    setIsGeneratingLyrics(false);
  };

  const [isClearLyricsConfirmOpen, setIsClearLyricsConfirmOpen] = useState(false);

  // Clear wrong/cached lyrics from MongoDB immediately (admin only)
  const executeClearLyrics = async () => {
    if (!currentTrack || !rawLyrics.length || !isAdmin) return;
    setIsClearingLyrics(true);
    try {
      const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || (currentUser && currentUser.token);
      await fetch(`${API_BASE_URL}/api/tracks/clear-lyrics`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ 
          trackId: currentTrack.id || currentTrack._id,
          title: currentTrack.title,
          artist: currentTrack.artist
        })
      });
      currentTrack.lyrics = [];
      setLocalLyrics([]);
      setIsLyricsVerified(false);
      setLyricsVerifiedBy(null);
      setTranslatedLyrics(null);
      setShowTranslation(false);
    } catch (e) {
      console.warn('Clear lyrics error:', e);
    }
    setIsClearingLyrics(false);
    setIsClearLyricsConfirmOpen(false);
  };

  const mobileLyricsContainerRef = useRef(null);
  const mobileLyricRefs = useRef({});
  const desktopLyricsContainerRef = useRef(null);
  const desktopLyricRefs = useRef({});

  useEffect(() => {
    mobileLyricRefs.current = {};
    desktopLyricRefs.current = {};
  }, [lyrics]);

  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef(null);
  const isProgrammaticScrollRef = useRef(false);
  const programmaticScrollTimerRef = useRef(null);

  const handleUserInteraction = () => {
    setIsUserScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 3500);
  };

  const handleContainerScroll = () => {
    if (isProgrammaticScrollRef.current) return;
    handleUserInteraction();
  };

  const scrollContainerToActive = useCallback((container, itemEl, behavior = 'smooth') => {
    if (!container || !itemEl) return;
    // Don't scroll if container or item is hidden or has 0 dimensions
    if (container.clientHeight <= 0 || itemEl.clientHeight <= 0) return;

    let offsetTop = itemEl.offsetTop;
    let parent = itemEl.offsetParent;
    while (parent && parent !== container) {
      offsetTop += parent.offsetTop;
      parent = parent.offsetParent;
    }

    const targetScroll = offsetTop - (container.clientHeight / 2) + (itemEl.clientHeight / 2);

    isProgrammaticScrollRef.current = true;
    if (programmaticScrollTimerRef.current) clearTimeout(programmaticScrollTimerRef.current);
    programmaticScrollTimerRef.current = setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 700);

    container.scrollTo({
      top: Math.max(0, targetScroll),
      behavior
    });
  }, []);

  const scrollToActiveLyric = useCallback((behavior = 'smooth') => {
    if (activeLyricIndex === -1) return;

    // Mobile lyrics container
    if (activeTab === 'lyrics') {
      const mContainer = mobileLyricsContainerRef.current;
      const mItem = mobileLyricRefs.current[activeLyricIndex];
      scrollContainerToActive(mContainer, mItem, behavior);
    }

    // Desktop lyrics container
    if (desktopSideTab === 'lyrics') {
      const dContainer = desktopLyricsContainerRef.current;
      const dItem = desktopLyricRefs.current[activeLyricIndex];
      scrollContainerToActive(dContainer, dItem, behavior);
    }
  }, [activeLyricIndex, activeTab, desktopSideTab, scrollContainerToActive]);

  // Auto-scroll on active lyric line change for BOTH desktop side panel and mobile lyrics tab
  useEffect(() => {
    const isShowingLyrics = activeTab === 'lyrics' || desktopSideTab === 'lyrics';
    if (isOpen && isShowingLyrics && activeLyricIndex !== -1 && !isUserScrolling) {
      scrollToActiveLyric('smooth');
    }
  }, [activeLyricIndex, activeTab, desktopSideTab, isOpen, isUserScrolling, scrollToActiveLyric]);

  // Center active lyric immediately upon opening or switching to lyrics view
  useEffect(() => {
    const isShowingLyrics = activeTab === 'lyrics' || desktopSideTab === 'lyrics';
    if (isOpen && isShowingLyrics && activeLyricIndex !== -1) {
      const timer = setTimeout(() => {
        scrollToActiveLyric('auto');
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [activeTab, desktopSideTab, isOpen, currentTrack?.id, currentTrack?._id]);

  // ── Download handler with visual feedback ──
  const [isDownloading, setIsDownloading] = useState(false);

  // ── Scrubbing & volume hooks (must be before early return to respect Rules of Hooks) ──
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPercent, setScrubPercent] = useState(0);
  const [isVolScrubbing, setIsVolScrubbing] = useState(false);

  const handleDownloadClick = async () => {
    if (!currentTrack || isDownloading) return;
    setIsDownloading(true);
    try {
      if (toggleDownload) await toggleDownload(currentTrack.id || currentTrack._id);
    } catch (e) {
      console.error('Download click error:', e);
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen || !currentTrack) return null;

  const formatTime = (secs) => {
    if (!secs || isNaN(secs) || secs < 0 || !isFinite(secs)) return '0:00';
    const sVal = secs > 10000 ? Math.round(secs / 1000) : Math.round(secs);
    const m = Math.floor(sVal / 60);
    const s = Math.floor(sVal % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const realPercent = activeDuration > 0 ? (activeTime / activeDuration) * 100 : 0;
  const progressPercent = isScrubbing ? scrubPercent : realPercent;

  const seekFromClientX = (clientX, targetRect) => {
    if (!targetRect || targetRect.width <= 0) return;
    const clickX = clientX - targetRect.left;
    const pct = Math.max(0, Math.min(1, clickX / targetRect.width));
    const targetDuration = (activeDuration && activeDuration > 0) ? activeDuration : (currentTrack?.duration || 210);
    const targetSec = pct * targetDuration;
    setScrubPercent(pct * 100);
    if (seekTo) seekTo(targetSec);
  };

  const handleSeekPointerDown = (e) => {
    e.preventDefault();
    setIsScrubbing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    seekFromClientX(e.clientX, rect);
  };

  const handleSeekPointerMove = (e) => {
    if (!isScrubbing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    seekFromClientX(e.clientX, rect);
  };

  const handleSeekPointerUp = (e) => {
    if (isScrubbing) {
      setIsScrubbing(false);
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    }
  };

  const handleSeekKeyDown = (e) => {
    const dur = (activeDuration && activeDuration > 0) ? activeDuration : (currentTrack?.duration || 210);
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (seekTo) seekTo(Math.max(0, activeTime - 5));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (seekTo) seekTo(Math.min(dur, activeTime + 5));
    } else if (e.key === 'Home') {
      e.preventDefault();
      if (seekTo) seekTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      if (seekTo) seekTo(dur);
    }
  };

  const setVolumeFromClientX = (clientX, targetRect) => {
    if (!targetRect || targetRect.width <= 0) return;
    const clickX = clientX - targetRect.left;
    const pct = Math.max(0, Math.min(1, clickX / targetRect.width));
    setVolume(Math.round(pct * 100) / 100);
  };

  const handleVolPointerDown = (e) => {
    e.preventDefault();
    setIsVolScrubbing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    setVolumeFromClientX(e.clientX, rect);
  };

  const handleVolPointerMove = (e) => {
    if (!isVolScrubbing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setVolumeFromClientX(e.clientX, rect);
  };

  const handleVolPointerUp = (e) => {
    if (isVolScrubbing) {
      setIsVolScrubbing(false);
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    }
  };

  const handleVolKeyDown = (e) => {
    const cur = volume || 0;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      setVolume(Math.max(0, Math.round((cur - 0.05) * 100) / 100));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      setVolume(Math.min(1, Math.round((cur + 0.05) * 100) / 100));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setVolume(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setVolume(1);
    }
  };

  // Play a track from the queue
  const handleQueueTrackClick = (track, queueIdx = null) => {
    if (onPlayTrack) {
      onPlayTrack(track, displayQueue, false, queueIdx);
    } else if (playTrack) {
      playTrack(track, displayQueue, false, queueIdx);
    }
  };

  const renderLyrics = (containerRef, itemsRef) => (
    <div 
      ref={containerRef}
      onScroll={handleContainerScroll} 
      onTouchStart={handleUserInteraction} 
      onWheel={handleUserInteraction}
      className="flex-1 overflow-y-auto py-16 px-2 relative h-full select-none"
      style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
    >
      {lyrics.length > 0 ? (
        <div className="py-2 px-1 space-y-2 pb-48">
          {isLyricsVerified && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 mb-3 rounded-xl bg-[#17a398]/10 border border-[#17a398]/30 w-fit">
              <CheckCircle2 size={14} className="text-[#17a398]" />
              <span className="text-[11px] font-mono font-bold text-[#17a398]">
                VERIFIED LYRICS {lyricsVerifiedBy ? `• BY @${lyricsVerifiedBy}` : ''}
              </span>
            </div>
          )}
          {lyrics.map((line, idx) => {
            const isActive = idx === activeLyricIndex;
            return (
              <div 
                key={idx}
                ref={(el) => {
                  if (itemsRef && itemsRef.current) {
                    itemsRef.current[idx] = el;
                  }
                }}
                onClick={() => {
                  seekTo(line.time);
                  setIsUserScrolling(false);
                  setTimeout(() => scrollToActiveLyric('smooth'), 50);
                }}
                className={`cursor-pointer transition-[opacity,background-color,border-color] duration-150 p-3 rounded-2xl border-2 ${
                  isActive 
                    ? isDark
                      ? 'bg-[#17a398]/20 border-[#17a398] opacity-100'
                      : 'bg-[#ede5d3] border-[#17a398] opacity-100 shadow-sm' 
                    : isDark
                      ? 'border-transparent opacity-35 hover:opacity-75 hover:bg-zinc-800/30'
                      : 'border-transparent opacity-40 hover:opacity-80 hover:bg-[#ede5d3]/40'
                }`}
              >
                <p 
                  className={`leading-snug font-display text-lg sm:text-xl transition-colors duration-150 ${
                    isActive 
                      ? `font-black ${isDark ? 'text-white' : 'text-[#0b1110]'}` 
                      : `font-semibold ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`
                  }`}
                >
                  {line.text}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`text-center py-12 px-4 ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
          <div className={`w-16 h-16 rounded-2xl brutal-border flex items-center justify-center mx-auto mb-4 brutal-shadow-sm ${isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-[#ede5d3]'}`}>
            <ListMusic size={32} className="text-[#17a398]" />
          </div>
          <p className={`font-display font-black text-lg mb-1 ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>No Lyrics Found</p>
          <p className={`text-xs font-mono max-w-xs mx-auto mb-5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
            Search for lyrics online{isAdmin ? ' or enter and verify them manually.' : '.'}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleGenerateLyrics}
              disabled={isGeneratingLyrics}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-display font-black text-xs rounded-xl brutal-border brutal-shadow-sm brutal-btn cursor-pointer disabled:opacity-50"
            >
              {isGeneratingLyrics ? (
                <><Loader2 size={15} className="animate-spin" /><span>Searching Lyrics...</span></>
              ) : (
                <><Search size={15} /><span>Auto-Search Lyrics</span></>
              )}
            </button>

            {isAdmin && (
              <button
                onClick={openManualEdit}
                className={`inline-flex items-center gap-2 px-4 py-2.5 font-display font-bold text-xs rounded-xl brutal-border brutal-shadow-sm brutal-btn cursor-pointer ${
                  isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700' : 'bg-[#ede5d3] hover:bg-[#ded2bb] text-[#0b1110]'
                }`}
              >
                <Edit3 size={15} className={isDark ? 'text-[#26c4b7]' : 'text-[#0f756d]'} />
                <span>Enter & Verify Manually</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Manual Edit Lyrics Modal Overlay */}
      {isManualEditOpen && (
        <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`${isDark ? 'bg-[#121212] border-2 border-zinc-700 text-white' : 'bg-[#fdfbf7] brutal-border-thick text-[#0b1110]'} brutal-shadow-lg max-w-lg w-full p-6 text-left relative rounded-2xl`}>
            <div className={`flex items-center justify-between pb-3 border-b-2 ${isDark ? 'border-zinc-800' : 'border-[#0b1110]'} mb-4`}>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#17a398] brutal-border" />
                <h3 className={`text-base font-mono font-black uppercase ${isDark ? 'text-white' : 'text-[#082621]'}`}>Admin Lyrics Editor</h3>
              </div>
              <button 
                onClick={() => setIsManualEditOpen(false)} 
                className={`brutal-btn p-1.5 rounded-lg ${isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-[#ede5d3] brutal-border text-[#0b1110]'}`}
              >
                <X size={18} />
              </button>
            </div>

            <p className={`text-xs mb-2 font-sans leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
              Format timestamps like <code className={`px-1 py-0.5 rounded font-mono ${isDark ? 'bg-zinc-800 text-[#26c4b7] border border-zinc-700' : 'bg-[#ede5d3] brutal-border text-[#082621]'}`}>[0:15]</code> before each line for automated karaoke sync.
            </p>

            <textarea
              rows={9}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="[0:00] First Line&#10;[0:12] Second Line..."
              className={`w-full p-3 text-xs font-mono rounded-xl focus:outline-none mb-3 resize-none leading-relaxed ${
                isDark 
                  ? 'bg-zinc-900 border border-zinc-700 text-white focus:border-[#17a398]' 
                  : 'bg-[#ede5d3] brutal-border text-[#0b1110] focus:bg-white'
              }`}
            />

            {/* Admin Verification Checkbox */}
            <label className={`flex items-start gap-2.5 p-3 rounded-xl mb-4 cursor-pointer border ${
              isDark ? 'bg-zinc-900/80 border-zinc-700' : 'bg-[#ede5d3]/50 border-black/20'
            }`}>
              <input
                type="checkbox"
                checked={markVerified}
                onChange={(e) => setMarkVerified(e.target.checked)}
                className="mt-0.5 accent-[#17a398] w-4 h-4 rounded cursor-pointer shrink-0"
              />
              <div className="flex flex-col text-left">
                <span className={`text-xs font-mono font-bold flex items-center gap-1 ${markVerified ? 'text-[#17a398]' : (isDark ? 'text-zinc-400' : 'text-zinc-600')}`}>
                  <CheckCircle2 size={13} />
                  {markVerified ? 'Verify & Lock Lyrics (Official)' : 'Not Verified (Will remove manual override)'}
                </span>
                <span className={`text-[10px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {markVerified 
                    ? 'Verified lyrics are locked with a verified badge across the website.' 
                    : 'If not verified, the manual override will be cleared and the player will continue using the normal lyrics scraper.'}
                </span>
              </div>
            </label>

            <div className="flex gap-3">
              <button
                onClick={handleSaveManualLyrics}
                disabled={isSavingManualLyrics}
                className="brutal-btn flex-1 py-2.5 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-mono text-xs font-black uppercase brutal-border brutal-shadow flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer rounded-xl"
              >
                {isSavingManualLyrics ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                <span>SAVE LYRICS</span>
              </button>
              <button
                onClick={() => setIsManualEditOpen(false)}
                className={`brutal-btn px-5 py-2.5 font-mono text-xs font-black uppercase rounded-xl cursor-pointer ${
                  isDark 
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700' 
                    : 'bg-[#ede5d3] hover:bg-[#ded2bb] text-[#082621] brutal-border brutal-shadow-sm'
                }`}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderQueueItem = (track, queueIdx, isAiItem) => {
    const isActive = (currentQueueIndex >= 0)
      ? queueIdx === currentQueueIndex
      : String(track.id || track._id) === String(currentTrack?.id || currentTrack?._id);
    const isTrackQuran = isQuranContent(track);
    const title = isTrackQuran ? cleanQuranTrackTitle(track.title) : track.title;
    const subtitle = isTrackQuran ? getQuranReciterName(track) : (track.artist || 'Unknown Artist');
    const isDragging = draggedQueueIdx === queueIdx;
    const isDragOver = dragOverQueueIdx === queueIdx && draggedQueueIdx !== queueIdx;

    return (
      <div 
        key={`${track.id || track._id}-${queueIdx}`}
        data-queue-idx={queueIdx}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          if (dragOverQueueIdx !== queueIdx) {
            setDragOverQueueIdx(queueIdx);
          }
        }}
        onDragLeave={() => {
          if (dragOverQueueIdx === queueIdx) {
            setDragOverQueueIdx(null);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          const fromIdx = Number(e.dataTransfer.getData('text/plain'));
          if (!isNaN(fromIdx) && fromIdx !== queueIdx && reorderQueue) {
            reorderQueue(fromIdx, queueIdx);
            showToast('Queue reordered');
          }
          setDraggedQueueIdx(null);
          setDragOverQueueIdx(null);
        }}
        onClick={() => !isActive && handleQueueTrackClick(track, queueIdx)}
        className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-all brutal-btn group select-none ${
          isDragging ? 'opacity-35 scale-[0.98]' : ''
        } ${
          isDragOver ? 'border-t-2 border-[#17a398] bg-[#17a398]/10 ring-2 ring-[#17a398]/40' : ''
        } ${
          isActive 
            ? isDark 
              ? 'bg-[#1b2622] border-2 border-[#26c4b7]/50 text-white font-black shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]' 
              : 'bg-[#ede5d3] brutal-border brutal-shadow-sm font-black' 
            : isDark 
              ? 'bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800 text-zinc-300' 
              : 'bg-white hover:bg-[#ede5d3] brutal-border'
        }`}
      >
        <div className="relative shrink-0">
          <img 
            src={track.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300'} 
            alt={title} 
            className="w-10 h-10 rounded-lg object-cover brutal-border bg-black" 
            onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=R&background=082621&color=26c4b7'; }}
          />
          {isActive ? (
            <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
              <span className="w-2.5 h-2.5 rounded-full bg-[#17a398] animate-ping" />
            </div>
          ) : (
            <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Play size={14} fill="currentColor" className="text-white ml-0.5" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-1.5">
            <p className={`text-xs truncate font-display font-black ${
              isActive ? 'text-[#17a398]' : isDark ? 'text-white' : 'text-[#0b1110]'
            }`}>
              {title}
            </p>
            {isAiItem && (
              <span className="shrink-0 px-1 py-0.2 rounded text-[8px] font-mono font-bold bg-[#17a398]/15 text-[#17a398] border border-[#17a398]/30">
                AI
              </span>
            )}
          </div>
          {isTrackQuran ? (
            <span className={`text-[11px] truncate font-mono mt-0.5 block ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              {subtitle}
            </span>
          ) : (
            <ArtistLinks
              track={track}
              onSelectArtist={onSelectArtist}
              onClickExtra={onClose}
              className={`text-[11px] truncate font-sans mt-0.5 block ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
              linkClassName="hover:underline cursor-pointer"
            />
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {jamSession && onRemoveFromJamQueue && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemoveFromJamQueue(queueIdx, track.id || track._id);
              }}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isDark ? 'text-zinc-400 hover:text-red-400' : 'text-zinc-600 hover:text-red-600'
              }`}
              title="Remove from Jam Queue"
            >
              <Trash2 size={14} />
            </button>
          )}

          {/* 3-Dots Action Menu Trigger */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setTrackMenuTarget({ track, index: queueIdx, isAi: isAiItem });
            }}
            className={`p-1.5 sm:p-2 rounded-lg transition-colors cursor-pointer ${
              isDark 
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' 
                : 'text-zinc-600 hover:text-black hover:bg-[#ded2bb]'
            }`}
            title="Track Options"
            aria-label="Track Options"
          >
            <MoreVertical size={16} />
          </button>

          {/* Drag & Drop Reorder Grip Handle */}
          {reorderQueue && displayQueue.length > 1 && (
            <div 
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.setData('text/plain', String(queueIdx));
                e.dataTransfer.effectAllowed = 'move';
                setDraggedQueueIdx(queueIdx);
              }}
              onDragEnd={() => {
                setDraggedQueueIdx(null);
                setDragOverQueueIdx(null);
              }}
              onTouchStart={() => {
                setDraggedQueueIdx(queueIdx);
              }}
              onTouchMove={(e) => {
                const touch = e.touches[0];
                if (!touch) return;
                const el = document.elementFromPoint(touch.clientX, touch.clientY);
                const queueRow = el?.closest('[data-queue-idx]');
                if (queueRow) {
                  const targetIdx = Number(queueRow.getAttribute('data-queue-idx'));
                  if (!isNaN(targetIdx) && targetIdx !== dragOverQueueIdx) {
                    setDragOverQueueIdx(targetIdx);
                  }
                }
              }}
              onTouchEnd={() => {
                if (draggedQueueIdx !== null && dragOverQueueIdx !== null && draggedQueueIdx !== dragOverQueueIdx) {
                  reorderQueue(draggedQueueIdx, dragOverQueueIdx);
                  showToast('Queue reordered');
                }
                setDraggedQueueIdx(null);
                setDragOverQueueIdx(null);
              }}
              onClick={(e) => e.stopPropagation()}
              className={`p-1.5 rounded-lg transition-colors cursor-grab active:cursor-grabbing select-none touch-none ${
                isDark ? 'text-zinc-500 hover:text-[#26c4b7] hover:bg-zinc-800' : 'text-zinc-400 hover:text-[#17a398] hover:bg-[#ede5d3]'
              }`}
              title="Drag to reorder in queue"
              aria-label="Drag to reorder"
            >
              <GripVertical size={16} />
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderQueue = () => (
    <div 
      className="flex-1 overflow-y-auto space-y-4 pb-24 select-none pr-1 min-h-0 w-full"
      style={{ scrollbarWidth: 'thin' }}
    >
      {/* Jam Session Notice (if connected) */}
      {jamSession && (
        <div className="p-3 bg-[#17a398]/10 border-2 border-[#17a398] rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#17a398] animate-ping" />
            <p className={`text-xs font-mono font-bold uppercase ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
              Jam Session Queue — {displayQueue.length} Tracks
            </p>
          </div>
          <span className="text-[10px] font-mono font-black bg-[#0b1110] text-[#26c4b7] px-2 py-0.5 rounded brutal-border">
            PIN: {jamSession.code}
          </span>
        </div>
      )}

      {/* ── SECTION 1: Normal / Playlist Queue ── */}
      <div>
        <div className={`flex items-center justify-between pb-1.5 border-b-2 border-dashed ${
          isDark ? 'border-zinc-800' : 'border-[#ded2bb]'
        } mb-2.5`}>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-mono font-black uppercase tracking-wider ${isDark ? 'text-zinc-300' : 'text-zinc-800'}`}>
              {(selectedPlaylist && (normalQueue.some(item => item.track.album === selectedPlaylist.name || item.track.playlistTitle === selectedPlaylist.name) || !selectedPlaylist.tracks?.length))
                ? selectedPlaylist.name 
                : (jamSession ? `Jam Session (${jamSession.code})` : (isCurQuran ? 'Quran Queue' : 'Queue'))
              } ({normalQueue.length})
            </span>
            {repeatMode !== 'off' && (
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-black ${
                repeatMode === 'one' 
                  ? 'bg-[#26c4b7]/20 text-[#26c4b7] border border-[#26c4b7]/40' 
                  : 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40'
              } animate-pulse`}>
                {repeatMode === 'one' ? <Repeat1 size={10} /> : <Repeat size={10} />}
                {repeatMode === 'one' ? 'REPEAT 1 (CURRENT SONG)' : 'REPEAT ALL (QUEUE)'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {clearQueue && displayQueue.length > 1 && (
              <button
                onClick={() => {
                  clearQueue();
                  showToast('Queue cleared');
                }}
                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  isDark ? 'text-zinc-400 hover:text-red-400 hover:bg-zinc-800' : 'text-zinc-600 hover:text-red-600 hover:bg-[#ede5d3]'
                }`}
                title="Clear queue (keeps current track)"
              >
                Clear
              </button>
            )}
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
              isDark ? 'bg-zinc-800 text-zinc-300 border border-zinc-700' : 'bg-[#ede5d3] brutal-border text-zinc-700'
            }`}>
              {isCurQuran ? 'QURAN' : 'PLAYLIST'}
            </span>
          </div>
        </div>

        {normalQueue.length === 0 ? (
          <div className={`py-6 text-center text-xs font-mono rounded-xl border border-dashed ${
            isDark ? 'text-zinc-500 border-zinc-800 bg-zinc-950/40' : 'text-zinc-500 border-zinc-300 bg-zinc-50/50'
          }`}>
            No tracks in playlist queue
          </div>
        ) : (
          <div className="space-y-1.5">
            {normalQueue.map((item, i) => renderQueueItem(item.track, item.originalIndex, false))}
          </div>
        )}
      </div>

      {/* ── SECTION 2: AI Suggestions Queue ── */}
      {aiQueue.length > 0 && (
        <div className="pt-2">
          <div className={`flex items-center justify-between pb-1.5 border-b-2 border-dashed ${
            isDark ? 'border-zinc-800' : 'border-[#ded2bb]'
          } mb-2.5`}>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Sparkles size={13} className="text-[#26c4b7]" />
              <span className={`text-[11px] font-mono font-black uppercase tracking-wider ${isDark ? 'text-[#26c4b7]' : 'text-[#082621]'}`}>
                AI Suggestions ({aiQueue.length})
              </span>
              {isRepeat ? (
                <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/30">
                  ⏸ Paused (Repeat active)
                </span>
              ) : (
                <span className="text-[9px] font-mono font-bold text-[#17a398] bg-[#17a398]/10 px-1.5 py-0.5 rounded border border-[#17a398]/30">
                  ▶ Plays after playlist
                </span>
              )}
            </div>
            <span className="text-[10px] font-mono font-black text-[#0b1110] bg-[#17a398] px-1.5 py-0.2 rounded brutal-border">
              AI DISCOVERY
            </span>
          </div>

          <div className="space-y-1.5">
            {aiQueue.map((item, i) => renderQueueItem(item.track, item.originalIndex, true))}
          </div>
        </div>
      )}

      {displayQueue.length === 0 && (
        <div className={`py-12 text-center text-xs font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
          <p className="font-bold">The queue is currently empty.</p>
          <p className={`mt-1 ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
            {isCurQuran ? 'Add surahs from the Quran library.' : 'Queue up songs from your library or search.'}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div 
      className={`fixed inset-0 z-[300] transition-all duration-300 flex flex-col overflow-hidden select-none font-sans ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* ── Dynamic Ambient Cover Art Background ── */}
      {currentTrack.cover ? (
        <div className="absolute inset-0 overflow-hidden pointer-events-none transition-all duration-1000">
          <img 
            src={currentTrack.cover} 
            alt="" 
            className="absolute inset-0 w-full h-full object-cover scale-150 blur-3xl opacity-70 contrast-125 saturate-150 transition-opacity duration-1000" 
          />
          <div className={`absolute inset-0 ${isDark ? 'bg-black/60' : 'bg-black/40'} backdrop-blur-2xl transition-colors duration-500`} />
        </div>
      ) : (
        <div 
          className="absolute inset-0 pointer-events-none transition-all duration-1000"
          style={{
            background: isDark
              ? `radial-gradient(circle at 50% 30%, ${trackColor}55 0%, #060a09 85%)`
              : `radial-gradient(circle at 50% 30%, ${trackColor}88 0%, #0b1c18 85%)`
          }}
        />
      )}

      {/* Studio Acoustic Dot Grid Pattern */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-25 bg-[radial-gradient(#ffffff25_1px,transparent_1px)] [background-size:24px_24px]"
      />

      {/* ── Top Bar ── */}
      <div className="relative z-10 flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 pt-[max(12px,env(safe-area-inset-top))] border-b-2 border-[#0b1110] bg-[#0b1110]/80 backdrop-blur-md">
        <button 
          onClick={onClose} 
          className="w-10 h-10 rounded-xl bg-[#fdfbf7] hover:bg-white text-[#0b1110] brutal-border flex items-center justify-center brutal-shadow-sm brutal-btn cursor-pointer"
          title="Minimize Master Deck"
        >
          <ChevronDown size={22} strokeWidth={2.5} />
        </button>

        <div className="text-center flex-1 px-4 truncate">
          <span className="text-[9px] font-mono font-bold bg-[#17a398] text-[#0b1110] px-2 py-0.5 rounded uppercase brutal-border">
            RIVO HI-FI STEREO • 24-BIT MASTER
          </span>
          <p className="text-sm font-display font-black text-[#fdfbf7] truncate mt-0.5">
            {currentTrack.title || 'Unknown Track'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="w-10 h-10 rounded-xl bg-[#fdfbf7] hover:bg-white text-[#0b1110] brutal-border flex items-center justify-center brutal-shadow-sm brutal-btn cursor-pointer"
            title="Add to Playlist"
            onClick={openAddToPlaylist}
          >
            <MoreHorizontal size={20} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* ── Tab Selector (Mobile only) ── */}
      <div className="relative z-10 flex lg:hidden justify-center gap-1 px-4 py-2">
        {[
          { id: 'player', label: 'Now Playing' },
          { id: 'lyrics', label: 'Lyrics' },
          { id: 'queue', label: `Queue (${displayQueue.length})` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-1.5 text-xs font-bold rounded-full transition-all"
            style={activeTab === tab.id
              ? { background: 'rgba(255,255,255,0.15)', color: '#fff' }
              : { color: '#b3b3b3' }
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Main Content Area ── */}
      <div className="relative z-10 flex-1 flex flex-col lg:flex-row lg:items-center lg:justify-center px-4 md:px-10 pt-2 pb-6 overflow-hidden max-w-6xl mx-auto w-full gap-8">

        {/* ─── LEFT DECK: Master Cassette Audio Console ─── */}
        <div className={`flex-1 flex flex-col justify-between max-w-md mx-auto w-full lg:max-w-md lg:h-[530px] ${
          isDark 
            ? 'bg-[#0e1614] text-[#fdfbf7] border-2 border-[#243632] shadow-[0_0_0_2px_#070b0a,0_16px_40px_rgba(0,0,0,0.9)]' 
            : 'bg-[#fdfbf7] text-[#0b1110] brutal-border-thick brutal-shadow-lg paper-texture'
        } rounded-2xl p-4 sm:p-5 relative ${activeTab === 'player' ? 'flex' : 'hidden lg:flex'}`}>
          
          {/* Deck Header: Mechanical cassette label & model stamp */}
          <div className={`flex items-center justify-between pb-2 border-b-2 ${
            isDark ? 'border-[#1f2e2a]' : 'border-[#0b1110]'
          } mb-1.5 shrink-0`}>
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-full ${isDark ? 'bg-[#17a398] shadow-[0_0_8px_#17a398]' : 'bg-[#17a398]'} animate-pulse`} />
              <span className={`font-mono font-bold text-[10px] ${isDark ? 'text-[#26c4b7]' : 'text-[#082621]'} uppercase tracking-wider`}>
                RIVO STEREO DECK // CR-500
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded border ${
                isDark 
                  ? 'bg-[#060a09] text-[#26c4b7] border-[#17a398]/40 shadow-[0_0_6px_rgba(38,196,183,0.2)]' 
                  : 'bg-[#0b1110] text-[#26c4b7] border-black'
              }`}>
                24-BIT HI-FI
              </span>
            </div>
          </div>

          {/* Cassette / Vinyl / Album Art Bay */}
          <div className="flex-1 flex items-center justify-center py-1 min-h-0">
            <div className="relative w-[185px] h-[185px] xs:w-[195px] xs:h-[195px] sm:w-[205px] sm:h-[205px] max-h-[35vh] flex items-center justify-center shrink-0">
              {isVinylMode ? (
                <div 
                  className={`w-full h-full rounded-full flex items-center justify-center relative overflow-hidden brutal-border brutal-shadow-md ${isPlaying ? 'vinyl-spin' : ''}`}
                  style={{ background: '#111' }}
                >
                  <div className="absolute inset-0" style={{ 
                    background: 'repeating-radial-gradient(circle at 50%, transparent 0, transparent 10px, rgba(255,255,255,0.03) 10px, rgba(255,255,255,0.03) 11px)'
                  }}/>
                  <div className="w-2/5 h-2/5 rounded-full overflow-hidden border-2 border-black shadow-xl z-10">
                    <img src={currentTrack?.cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500'} alt={currentTrack?.title || ''} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute w-4 h-4 rounded-full bg-[#ede5d3] border-2 border-[#0b1110] z-20" />
                </div>
              ) : (
                /* Authentic Retro TV / Monitor Enclosure */
                <div className={`w-full h-full p-2 sm:p-2.5 ${
                  isDark 
                    ? 'bg-gradient-to-b from-[#1d2b27] via-[#16221f] to-[#121a18] border-2 border-[#2f433e] shadow-[0_6px_24px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.12),2px_2px_0px_#050807]' 
                    : 'bg-[#ede5d3] brutal-border brutal-shadow-sm'
                } rounded-2xl flex flex-col justify-between relative overflow-hidden`}>
                  {/* Clean CRT TV Screen Window */}
                  <div className={`relative w-full flex-1 rounded-xl overflow-hidden border-2 ${
                    isDark 
                      ? 'border-[#070b0a] bg-[#050807] shadow-[inset_0_2px_10px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.06)]' 
                      : 'brutal-border bg-[#0b1110] shadow-inner'
                  } flex items-center justify-center min-h-0 bg-black`}>
                    {/* Ambient Glow / Cover Fill (seamlessly eliminates harsh black bars) */}
                    {currentTrack?.cover && (
                      <img 
                        src={currentTrack.cover} 
                        alt="" 
                        aria-hidden="true"
                        className="absolute inset-0 w-full h-full object-cover filter blur-md opacity-35 scale-125 pointer-events-none"
                      />
                    )}
                    {/* Primary Song Image: Centered, never squished or chopped off */}
                    <img 
                      src={currentTrack?.cover || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500'} 
                      alt={currentTrack?.title || 'Song Cover'}
                      className="relative z-1 max-w-full max-h-full w-full h-full object-contain"
                      style={{ 
                        transform: isPlaying ? 'scale(1.02)' : 'scale(1)',
                        transition: 'transform 0.4s ease',
                      }}
                    />
                    {/* CRT Glass Reflection, Scanlines & Vignette (Dark Mode TV Effect) */}
                    {isDark && (
                       <>
                         {/* Subtle CRT Curved Glass Glare */}
                         <div className="absolute inset-0 pointer-events-none bg-gradient-to-tr from-transparent via-white/[0.08] to-transparent z-10" />
                         {/* Authentic Scanline Screen Filter */}
                         <div className="absolute inset-0 pointer-events-none opacity-20 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.6)_3px)] z-10" />
                         {/* Subtle Phosphor Corner Vignette */}
                         <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_14px_rgba(0,0,0,0.85)] z-10" />
                       </>
                    )}
                  </div>

                  {/* Clean Lower TV / Cassette Control & Label Bar */}
                  <div className={`mt-2 pt-1.5 pb-0.5 border-t border-dashed ${
                    isDark ? 'border-[#243531]' : 'border-zinc-400/30'
                  } flex items-center justify-between px-1 shrink-0`}>
                    <div className="flex items-center gap-1.5">
                      {isDark && (
                        <span className={`w-1.5 h-1.5 rounded-full ${isPlaying ? 'bg-[#10b981] shadow-[0_0_6px_#10b981] animate-pulse' : 'bg-[#dc2626] shadow-[0_0_4px_#dc2626]'}`} title={isPlaying ? "ON AIR / PLAYING" : "STANDBY"} />
                      )}
                      <span className={`text-[8px] font-mono font-bold uppercase tracking-wider ${
                        isDark ? 'text-[#26c4b7] drop-shadow-[0_0_6px_rgba(38,196,183,0.35)]' : 'text-zinc-600'
                      }`}>
                        {isCurQuran ? 'QURAN // TAPE' : 'SIDE A // STEREO'}
                      </span>
                    </div>

                    {/* Compact Spool Wheels (Illuminated in Dark Mode) */}
                    <div className="flex items-center gap-1">
                      <div className={`w-2.5 h-2.5 rounded-full border ${
                        isDark ? 'border-[#26c4b7]/80 bg-[#070c0a] shadow-[0_0_4px_rgba(38,196,183,0.3)]' : 'border-zinc-400/80 bg-black/40'
                      } flex items-center justify-center ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }}>
                        <div className={`w-0.5 h-0.5 rounded-full ${isDark ? 'bg-[#26c4b7]' : 'bg-[#17a398]'}`} />
                      </div>
                      <div className={`w-3 h-0.5 ${isDark ? 'bg-[#26c4b7]' : 'bg-[#17a398]/50'} rounded-full`} />
                      <div className={`w-2.5 h-2.5 rounded-full border ${
                        isDark ? 'border-[#26c4b7]/80 bg-[#070c0a] shadow-[0_0_4px_rgba(38,196,183,0.3)]' : 'border-zinc-400/80 bg-black/40'
                      } flex items-center justify-center ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }}>
                        <div className={`w-0.5 h-0.5 rounded-full ${isDark ? 'bg-[#26c4b7]' : 'bg-[#17a398]'}`} />
                      </div>
                    </div>

                    <span className={`text-[8px] font-mono font-bold uppercase tracking-wider ${
                      isDark ? 'text-[#26c4b7] drop-shadow-[0_0_6px_rgba(38,196,183,0.35)]' : 'text-zinc-600'
                    }`}>
                      {isDark ? 'CRT HI-FI' : 'HI-FI 24-BIT'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Song Info & Like */}
          <div className="flex items-center justify-between my-2 shrink-0">
            <div className="truncate flex-1 min-w-0 pr-2">
              <span className={`text-[9px] font-mono font-bold bg-[#17a398] text-[#0b1110] px-1.5 py-0.2 rounded border ${
                isDark ? 'border-[#090e0c] shadow-[2px_2px_0px_#050807]' : 'brutal-border'
              }`}>
                {isCurQuran ? 'QURAN' : (currentTrack.genre || 'STEREO')}
              </span>
              <h2 className={`text-base sm:text-lg font-display font-black truncate tracking-tight mt-0.5 ${
                isDark ? 'text-white' : 'text-[#0b1110]'
              }`}>
                {isCurQuran ? cleanQuranTrackTitle(currentTrack.title) : currentTrack.title}
              </h2>
              {isCurQuran ? (
                <span className={`text-xs font-bold truncate block ${isDark ? 'text-zinc-300' : 'text-[#0f756d]'}`}>
                  {getQuranReciterName(currentTrack)}
                </span>
              ) : (
                <ArtistLinks
                  track={currentTrack}
                  onSelectArtist={onSelectArtist}
                  onClickExtra={onClose}
                  className={`text-xs font-bold truncate block ${
                    isDark ? 'text-zinc-300' : 'text-[#0f756d]'
                  }`}
                  linkClassName="hover:underline cursor-pointer"
                />
              )}
            </div>

            <button 
              onClick={() => toggleLike(currentTrack.id)}
              className={`p-2 rounded-xl brutal-btn hover:scale-105 active:scale-95 cursor-pointer shrink-0 ${
                isDark 
                  ? 'bg-[#182421] hover:bg-[#20302c] border-2 border-[#090e0c] shadow-[2px_2px_0px_#050807,inset_0_1px_0_rgba(255,255,255,0.12)] text-white' 
                  : 'bg-white brutal-border brutal-shadow-sm text-zinc-700'
              }`}
              title={isTrackLiked ? (isCurQuran ? 'Remove from Favorites' : 'Remove from Liked Songs') : (isCurQuran ? 'Save to Favorites' : 'Save to Liked Songs')}
            >
              <Heart 
                size={18} 
                fill={isTrackLiked ? '#dc2626' : 'none'}
                className={isTrackLiked ? 'text-[#dc2626]' : isDark ? 'text-zinc-400' : 'text-zinc-500'}
              />
            </button>
          </div>

          {/* Seekbar */}
          <div className="mb-2 shrink-0">
            <div 
              role="slider"
              tabIndex={0}
              aria-label="Seek track"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progressPercent)}
              onKeyDown={handleSeekKeyDown}
              className="relative w-full group h-8 flex items-center cursor-pointer select-none py-2 touch-none focus:outline-none"
              onPointerDown={handleSeekPointerDown}
              onPointerMove={handleSeekPointerMove}
              onPointerUp={handleSeekPointerUp}
              onPointerCancel={handleSeekPointerUp}
            >
              <div className={`w-full h-2 group-hover:h-2.5 rounded-full overflow-hidden transition-all pointer-events-none ${
                isDark ? 'bg-[#070c0a] border-2 border-[#090e0c] shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]' : 'bg-[#ede5d3] brutal-border'
              }`}>
                <div 
                  className={`h-full bg-[#17a398] group-hover:bg-[#26c4b7] transition-all duration-75 pointer-events-none ${
                    isDark ? 'shadow-[0_0_10px_rgba(23,163,152,0.4)]' : ''
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, isNaN(progressPercent) ? 0 : progressPercent))}%` }}
                />
              </div>
              <div 
                className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full pointer-events-none transition-transform group-hover:scale-125 z-10 ${
                  isDark 
                    ? 'border-2 border-[#090e0c] shadow-[0_0_8px_rgba(23,163,152,0.5),2px_2px_0px_#050807]' 
                    : 'brutal-border shadow-md'
                }`}
                style={{ left: `calc(${Math.min(100, Math.max(0, isNaN(progressPercent) ? 0 : progressPercent))}% - 7px)` }}
              />
            </div>
            <div className={`flex justify-between mt-1 font-mono font-bold text-[10px] ${
              isDark ? 'text-[#26c4b7]' : 'text-zinc-600'
            }`}>
              <span className="tabular-nums">{formatTime(activeTime)}</span>
              <span className="tabular-nums">{formatTime(activeDuration)}</span>
            </div>
          </div>

          {/* Mechanical Transport Controls */}
          <div className="flex items-center justify-between mb-2 shrink-0">
            <button 
              onClick={toggleShuffle} 
              className={`p-1.5 sm:p-2 rounded-xl brutal-btn cursor-pointer ${
                isShuffle 
                  ? isDark
                    ? 'bg-[#17a398] text-[#0b1110] font-bold border-2 border-[#090e0c] shadow-[2px_2px_0px_#050807]'
                    : 'bg-[#17a398] text-[#0b1110] font-bold brutal-border' 
                  : isDark 
                    ? 'bg-[#182421] hover:bg-[#20302c] text-zinc-400 hover:text-white border-2 border-[#090e0c] shadow-[2px_2px_0px_#050807,inset_0_1px_0_rgba(255,255,255,0.1)]' 
                    : 'bg-white text-zinc-600 hover:bg-[#ede5d3] brutal-border'
              }`}
              title="Shuffle"
            >
              <Shuffle size={15} strokeWidth={2.5} />
            </button>

            <button 
              onClick={playPrev} 
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center brutal-btn cursor-pointer ${
                isDark 
                  ? 'bg-[#182421] hover:bg-[#20302c] text-white border-2 border-[#090e0c] shadow-[2px_2px_0px_#050807,inset_0_1px_0_rgba(255,255,255,0.12)]' 
                  : 'bg-white hover:bg-[#ede5d3] text-[#0b1110] brutal-border brutal-shadow-sm'
              }`}
              title="Previous"
            >
              <SkipBack size={17} fill="currentColor" />
            </button>

            <button 
              onClick={togglePlay} 
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] flex items-center justify-center brutal-btn cursor-pointer ${
                isDark 
                  ? 'border-2 border-[#090e0c] shadow-[3px_3px_0px_#050807,0_0_16px_rgba(23,163,152,0.35)]' 
                  : 'brutal-border-thick brutal-shadow-md'
              }`}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying 
                ? <Pause size={20} fill="currentColor" /> 
                : <Play size={20} fill="currentColor" className="ml-0.5" />
              }
            </button>

            <button 
              onClick={playNext} 
              className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center brutal-btn cursor-pointer ${
                isDark 
                  ? 'bg-[#182421] hover:bg-[#20302c] text-white border-2 border-[#090e0c] shadow-[2px_2px_0px_#050807,inset_0_1px_0_rgba(255,255,255,0.12)]' 
                  : 'bg-white hover:bg-[#ede5d3] text-[#0b1110] brutal-border brutal-shadow-sm'
              }`}
              title="Next"
            >
              <SkipForward size={17} fill="currentColor" />
            </button>

            <button 
              onClick={toggleRepeat} 
              className={`p-1.5 sm:p-2 rounded-xl brutal-btn cursor-pointer transition-all ${
                repeatMode === 'one'
                  ? isDark
                    ? 'bg-[#26c4b7] text-[#0b1110] font-bold border-2 border-[#090e0c] shadow-[0_0_10px_rgba(38,196,183,0.5),2px_2px_0px_#050807]'
                    : 'bg-[#26c4b7] text-[#0b1110] font-bold brutal-border'
                  : repeatMode === 'all'
                    ? isDark
                      ? 'bg-[#10b981] text-[#0b1110] font-bold border-2 border-[#090e0c] shadow-[0_0_10px_rgba(16,185,129,0.5),2px_2px_0px_#050807]'
                      : 'bg-[#10b981] text-[#0b1110] font-bold brutal-border'
                    : isDark 
                      ? 'bg-[#182421] hover:bg-[#20302c] text-zinc-400 hover:text-white border-2 border-[#090e0c] shadow-[2px_2px_0px_#050807,inset_0_1px_0_rgba(255,255,255,0.1)]' 
                      : 'bg-white text-zinc-600 hover:bg-[#ede5d3] brutal-border'
              }`}
              title={
                repeatMode === 'one' 
                  ? "Repeat: Current Track (Looping)" 
                  : repeatMode === 'all' 
                    ? "Repeat: All (Queue / Playlist)" 
                    : "Repeat: Off"
              }
            >
              {repeatMode === 'one' ? (
                <Repeat1 size={15} strokeWidth={2.5} />
              ) : (
                <Repeat size={15} strokeWidth={2.5} />
              )}
            </button>
          </div>

          {/* ── Audio Console Level Fader (Tactile Brutalist Volume Console) ── */}
          <div className={`pt-2 border-t-2 border-dashed ${isDark ? 'border-[#1f2e2a]' : 'border-[#ded2bb]'} flex items-center justify-between gap-2 shrink-0`}>
            {/* Tactile Master Volume Fader */}
            <div className={`flex items-center gap-2 ${
              isDark 
                ? 'bg-[#141d1a] border-2 border-[#090e0c] shadow-[2px_2px_0px_#050807,inset_0_1px_0_rgba(255,255,255,0.08)]' 
                : 'bg-white brutal-border brutal-shadow-sm'
            } px-2.5 py-1.5 rounded-xl flex-1 max-w-[220px]`}>
              <button 
                onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
                className={`${isDark ? 'text-zinc-400 hover:text-[#26c4b7]' : 'text-zinc-700 hover:text-black'} cursor-pointer transition-colors shrink-0`}
                title={volume > 0 ? "Mute" : "Unmute"}
              >
                {volume === 0 ? <VolumeX size={15} className="text-red-500" /> : <Volume2 size={15} />}
              </button>
              
              <div 
                role="slider"
                tabIndex={0}
                aria-label="Master volume"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((volume || 0) * 100)}
                onKeyDown={handleVolKeyDown}
                className="relative flex-1 group h-6 flex items-center cursor-pointer select-none touch-none focus:outline-none py-1.5"
                onPointerDown={handleVolPointerDown}
                onPointerMove={handleVolPointerMove}
                onPointerUp={handleVolPointerUp}
                onPointerCancel={handleVolPointerUp}
              >
                <div className={`w-full h-2 rounded-full overflow-hidden pointer-events-none ${
                  isDark 
                    ? 'bg-[#070c0a] border border-[#090e0c] shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]' 
                    : 'bg-[#ede5d3] brutal-border'
                }`}>
                  <div 
                    className="h-full bg-[#17a398] group-hover:bg-[#26c4b7] transition-all duration-75 pointer-events-none"
                    style={{ width: `${Math.min(100, Math.max(0, (volume || 0) * 100))}%` }}
                  />
                </div>
                <div 
                  className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full pointer-events-none transition-transform group-hover:scale-125 z-10 ${
                    isDark 
                      ? 'border-2 border-[#090e0c] shadow-[2px_2px_0px_#050807]' 
                      : 'brutal-border shadow-md'
                  }`}
                  style={{ left: `calc(${Math.min(100, Math.max(0, (volume || 0) * 100))}% - 7px)` }}
                />
              </div>

              <span className={`text-[10px] font-mono font-bold w-6 text-right ${
                isDark ? 'text-[#26c4b7]' : 'text-zinc-800'
              } select-none tabular-nums`}>
                {Math.round((volume || 0) * 100)}%
              </span>
            </div>

            {/* Deck Auxiliary Controls */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Vinyl Mode Toggle */}
              <button 
                onClick={() => setIsVinylMode(!isVinylMode)}
                className={`p-1.5 sm:p-2 rounded-xl brutal-btn cursor-pointer transition-colors ${
                  isVinylMode 
                    ? isDark
                      ? 'bg-[#17a398] text-[#0b1110] font-bold border-2 border-[#090e0c] shadow-[2px_2px_0px_#050807]'
                      : 'bg-[#17a398] text-[#0b1110] brutal-border' 
                    : isDark 
                      ? 'bg-[#182421] hover:bg-[#20302c] text-zinc-400 hover:text-white border-2 border-[#090e0c] shadow-[2px_2px_0px_#050807,inset_0_1px_0_rgba(255,255,255,0.1)]' 
                      : 'bg-white text-zinc-700 hover:bg-[#ede5d3] brutal-border'
                }`}
                title="Vinyl Turntable Mode"
              >
                <Disc size={15} strokeWidth={2.5} />
              </button>

              {/* Quick Lyrics View Toggle */}
              <button 
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    setActiveTab(activeTab === 'lyrics' ? 'player' : 'lyrics');
                  } else {
                    setDesktopSideTab('lyrics');
                  }
                }}
                className={`p-1.5 sm:p-2 rounded-xl brutal-btn cursor-pointer transition-colors ${
                  (activeTab === 'lyrics' || desktopSideTab === 'lyrics')
                    ? isDark
                      ? 'bg-[#17a398] text-[#0b1110] font-bold border-2 border-[#090e0c] shadow-[2px_2px_0px_#050807]'
                      : 'bg-[#17a398] text-[#0b1110] brutal-border' 
                    : isDark 
                      ? 'bg-[#182421] hover:bg-[#20302c] text-zinc-400 hover:text-white border-2 border-[#090e0c] shadow-[2px_2px_0px_#050807,inset_0_1px_0_rgba(255,255,255,0.1)]' 
                      : 'bg-white text-zinc-700 hover:bg-[#ede5d3] brutal-border'
                }`}
                title="Lyrics Display"
              >
                <Mic size={15} strokeWidth={2.5} />
              </button>

              {/* Download Audio */}
              {toggleDownload && (
                <button 
                  onClick={handleDownloadClick}
                  disabled={isDownloading}
                  className={`p-1.5 sm:p-2 rounded-xl brutal-btn cursor-pointer transition-colors disabled:opacity-50 ${
                    isDark 
                      ? 'bg-[#182421] hover:bg-[#20302c] text-zinc-300 border-2 border-[#090e0c] shadow-[2px_2px_0px_#050807,inset_0_1px_0_rgba(255,255,255,0.1)]' 
                      : 'bg-white hover:bg-[#ede5d3] text-zinc-700 brutal-border'
                  }`}
                  title={currentTrack.downloaded ? 'Downloaded ✓' : 'Download Audio'}
                >
                  {currentTrack.downloaded ? (
                    <CheckCircle2 size={15} className="text-[#17a398]" />
                  ) : isDownloading ? (
                    <Loader2 size={15} className="animate-spin text-[#17a398]" />
                  ) : (
                    <Download size={15} />
                  )}
                </button>
              )}
            </div>
          </div>

        </div>

        {/* ─── MOBILE LYRICS TAB ─── */}
        {activeTab === 'lyrics' && (
          <div className={`lg:hidden flex-1 flex flex-col overflow-hidden w-full max-w-md mx-auto ${
            isDark ? 'bg-[#101514] text-[#fdfbf7] border-2 border-zinc-700' : 'bg-[#fdfbf7] text-[#0b1110] brutal-border-thick'
          } rounded-2xl p-4 brutal-shadow-lg`}>
            <div className={`flex items-center justify-between pb-2 mb-2 border-b ${
              isDark ? 'border-zinc-800' : 'border-zinc-300'
            }`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-display font-black text-xs uppercase tracking-wider text-zinc-400">Lyrics</span>
                {isLyricsVerified && (
                  <CheckCircle2 size={13} className="text-[#17a398] shrink-0" title={lyricsVerifiedBy ? `Verified by @${lyricsVerifiedBy}` : 'Verified Lyrics'} />
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {rawLyrics.length > 0 && (
                  <div className="inline-flex items-center rounded-lg overflow-hidden border border-zinc-700/60 bg-black/20 p-0.5 text-[10px] font-mono font-bold">
                    <button
                      onClick={() => handleNudgeSync(-0.5)}
                      className="px-1.5 py-0.5 rounded text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                      title="Nudge lyrics 0.5s earlier"
                    >
                      -0.5s
                    </button>
                    <div className="w-[1px] h-3 bg-zinc-700/60 mx-0.5" />
                    <button
                      onClick={() => handleNudgeSync(0.5)}
                      className="px-1.5 py-0.5 rounded text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                      title="Nudge lyrics 0.5s later"
                    >
                      +0.5s
                    </button>
                    {syncOffset !== 0 && (
                      <>
                        <div className="w-[1px] h-3 bg-zinc-700/60 mx-0.5" />
                        <button
                          onClick={() => setSyncOffset(0)}
                          className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors flex items-center gap-0.5"
                          title="Reset sync offset"
                        >
                          <span>{syncOffset > 0 ? `+${syncOffset}` : syncOffset}s</span>
                          <X size={10} />
                        </button>
                        <button
                          onClick={handleSavePermanentSync}
                          disabled={isSavingSync}
                          className="ml-0.5 px-1.5 py-0.5 rounded bg-[#17a398] text-[#0b1110] font-bold hover:brightness-110 transition-all flex items-center gap-0.5 disabled:opacity-50"
                          title="Save adjusted timing permanently"
                        >
                          {isSavingSync ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                          <span>Save</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
                {rawLyrics.length > 0 && (
                  <button
                    onClick={handleTranslateLyrics}
                    disabled={isTranslating}
                    className={`p-1.5 rounded-lg transition-all text-xs ${
                      showTranslation 
                        ? 'text-[#0b1110] bg-[#17a398]' 
                        : isDark 
                          ? 'bg-[#182421] text-zinc-300 hover:text-white border border-zinc-700/60' 
                          : 'bg-white text-zinc-700 hover:text-black border border-zinc-300'
                    }`}
                    title={showTranslation ? "Hide translation" : "Translate lyrics"}
                  >
                    {isTranslating ? <Loader2 size={13} className="animate-spin" /> : <Languages size={13} />}
                  </button>
                )}
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={openManualEdit}
                      className={`p-1.5 rounded-lg transition-colors ${
                        isDark 
                          ? 'bg-[#182421] text-zinc-300 hover:text-white border border-zinc-700/60' 
                          : 'bg-white text-zinc-700 hover:text-black border border-zinc-300'
                      }`}
                      title="Edit Lyrics (Admin)"
                    >
                      <Edit3 size={13} />
                    </button>
                    {rawLyrics.length > 0 && (
                      <button
                        onClick={() => setIsClearLyricsConfirmOpen(true)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isDark 
                            ? 'bg-[#182421] text-zinc-400 hover:text-red-400 border border-zinc-700/60' 
                            : 'bg-white text-zinc-500 hover:text-red-500 border border-zinc-300'
                        }`}
                        title="Clear Lyrics (Admin)"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {renderLyrics(mobileLyricsContainerRef, mobileLyricRefs)}
          </div>
        )}

        {/* ─── MOBILE QUEUE TAB ─── */}
        {activeTab === 'queue' && (
          <div className={`lg:hidden flex-1 flex flex-col overflow-hidden w-full max-w-md mx-auto min-h-0 ${
            isDark ? 'bg-[#101514] text-[#fdfbf7] border-2 border-zinc-700' : 'bg-[#fdfbf7] text-[#0b1110] brutal-border-thick'
          } rounded-2xl p-4 brutal-shadow-lg`}>
            {renderQueue()}
          </div>
        )}

        {/* ─── DESKTOP RIGHT PANEL (Lyrics & Queue) ─── */}
        <div className={`hidden lg:flex flex-1 h-[530px] ${
          isDark 
            ? 'bg-[#101514] text-[#fdfbf7] border-2 border-zinc-700 shadow-2xl' 
            : 'bg-[#fdfbf7] text-[#0b1110] brutal-border-thick brutal-shadow-lg paper-texture'
        } rounded-2xl p-6 flex-col overflow-hidden`}>
          <div className={`flex items-center justify-between pb-3 border-b-2 ${
            isDark ? 'border-zinc-800' : 'border-black'
          } mb-3 shrink-0`}>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDesktopSideTab('lyrics')}
                className={`px-4 py-1.5 rounded-lg text-xs font-display font-black transition-all ${
                  desktopSideTab === 'lyrics' 
                    ? isDark ? 'bg-[#17a398] text-[#0b1110] font-black' : 'bg-[#0b1110] text-[#fdfbf7] brutal-border brutal-shadow-sm' 
                    : isDark ? 'bg-[#1c2422] text-zinc-400 hover:text-white' : 'bg-white text-[#0b1110] border border-[#0b1110] hover:bg-[#ede5d3]'
                }`}
              >
                Lyrics
              </button>
              <button
                onClick={() => setDesktopSideTab('queue')}
                className={`px-4 py-1.5 rounded-lg text-xs font-display font-black transition-all ${
                  desktopSideTab === 'queue' 
                    ? isDark ? 'bg-[#17a398] text-[#0b1110] font-black' : 'bg-[#0b1110] text-[#fdfbf7] brutal-border brutal-shadow-sm' 
                    : isDark ? 'bg-[#1c2422] text-zinc-400 hover:text-white' : 'bg-white text-[#0b1110] border border-[#0b1110] hover:bg-[#ede5d3]'
                }`}
              >
                Queue ({displayQueue.length})
              </button>
            </div>

            {desktopSideTab === 'lyrics' && (
              <div className="flex items-center gap-1.5 shrink-0">
                {isLyricsVerified && (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#17a398]/10 text-[#17a398] border border-[#17a398]/30 mr-1" title={lyricsVerifiedBy ? `Verified by @${lyricsVerifiedBy}` : 'Verified Lyrics'}>
                    <CheckCircle2 size={12} className="text-[#17a398]" />
                    <span className="text-[10px] font-mono font-bold uppercase">Verified</span>
                  </div>
                )}
                {rawLyrics.length > 0 && (
                  <div className="inline-flex items-center rounded-lg overflow-hidden border border-zinc-700/60 bg-black/20 p-0.5 text-[10px] font-mono font-bold">
                    <button
                      onClick={() => handleNudgeSync(-0.5)}
                      className="px-1.5 py-0.5 rounded text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                      title="Nudge lyrics 0.5s earlier"
                    >
                      -0.5s
                    </button>
                    <div className="w-[1px] h-3 bg-zinc-700/60 mx-0.5" />
                    <button
                      onClick={() => handleNudgeSync(0.5)}
                      className="px-1.5 py-0.5 rounded text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                      title="Nudge lyrics 0.5s later"
                    >
                      +0.5s
                    </button>
                    {syncOffset !== 0 && (
                      <>
                        <div className="w-[1px] h-3 bg-zinc-700/60 mx-0.5" />
                        <button
                          onClick={() => setSyncOffset(0)}
                          className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors flex items-center gap-0.5"
                          title="Reset sync offset"
                        >
                          <span>{syncOffset > 0 ? `+${syncOffset}` : syncOffset}s</span>
                          <X size={10} />
                        </button>
                        <button
                          onClick={handleSavePermanentSync}
                          disabled={isSavingSync}
                          className="ml-0.5 px-1.5 py-0.5 rounded bg-[#17a398] text-[#0b1110] font-bold hover:brightness-110 transition-all flex items-center gap-0.5 disabled:opacity-50"
                          title="Save adjusted timing permanently"
                        >
                          {isSavingSync ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                          <span>Save</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
                {rawLyrics.length > 0 && (
                  <button
                    onClick={handleTranslateLyrics}
                    disabled={isTranslating}
                    className={`px-2 py-1 rounded-lg transition-all text-xs font-bold flex items-center gap-1 ${
                      showTranslation 
                        ? 'text-[#0b1110] bg-[#17a398] font-bold' 
                        : isDark 
                          ? 'bg-[#182421] text-zinc-300 hover:text-white border border-zinc-700/60' 
                          : 'bg-white text-zinc-700 hover:text-black border border-zinc-300'
                    }`}
                    title="Translate Lyrics"
                  >
                    {isTranslating ? <Loader2 size={12} className="animate-spin" /> : <Languages size={13} />}
                    <span className="text-[10px]">Translate</span>
                  </button>
                )}
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={openManualEdit}
                      className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
                        isDark 
                          ? 'bg-[#182421] text-zinc-300 hover:text-white border border-zinc-700/60' 
                          : 'bg-white text-zinc-700 hover:text-black border border-zinc-300'
                      }`}
                      title="Edit Lyrics (Admin)"
                    >
                      <Edit3 size={13} />
                      {rawLyrics.length === 0 && <span className="text-[10px]">Add Lyrics</span>}
                    </button>
                    {rawLyrics.length > 0 && (
                      <button
                        onClick={() => setIsClearLyricsConfirmOpen(true)}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isDark 
                            ? 'bg-[#182421] text-zinc-400 hover:text-red-400 border border-zinc-700/60' 
                            : 'bg-white text-zinc-500 hover:text-red-500 border border-zinc-300'
                        }`}
                        title="Clear Lyrics (Admin)"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {desktopSideTab === 'lyrics' ? renderLyrics(desktopLyricsContainerRef, desktopLyricRefs) : renderQueue()}
          </div>
        </div>

      </div>

      {/* Confirm Clear Lyrics Modal */}
      <ConfirmModal
        isOpen={isClearLyricsConfirmOpen}
        title="Clear Saved Lyrics?"
        message="The current lyrics for this song will be removed so you can search or add them again."
        confirmText="Clear Lyrics"
        cancelText="Cancel"
        onConfirm={executeClearLyrics}
        onCancel={() => setIsClearLyricsConfirmOpen(false)}
      />

      {/* Confirm Delete Song Permanently Modal */}
      {deleteConfirmTrack && (
        <ConfirmModal
          isOpen={Boolean(deleteConfirmTrack)}
          title={`Delete "${deleteConfirmTrack.title}"?`}
          message={`Are you sure you want to permanently delete "${deleteConfirmTrack.title}" by ${deleteConfirmTrack.artist || 'Unknown'} from the Rivo library? This cannot be undone.`}
          confirmText="Delete Permanently"
          cancelText="Cancel"
          onConfirm={async () => {
            const trackToDelete = deleteConfirmTrack;
            setDeleteConfirmTrack(null);
            if (onDeleteTrack && trackToDelete) {
              await onDeleteTrack(trackToDelete.id || trackToDelete._id);
              showToast(`Deleted "${trackToDelete.title}"`);
            }
          }}
          onCancel={() => setDeleteConfirmTrack(null)}
        />
      )}

      {/* ── Track 3-Dots Action Menu (Responsive: Bottom Sheet on Phone, Modal on PC) ── */}
      {trackMenuTarget && (
        <div 
          className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setTrackMenuTarget(null)}
        >
          <div 
            className={`w-full max-w-md rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 text-left border-2 animate-in fade-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 ${
              isDark 
                ? 'bg-[#121816] text-[#fdfbf7] border-zinc-700 shadow-[0_10px_35px_rgba(0,0,0,0.85)]' 
                : 'bg-[#fdfbf7] text-[#0b1110] border-black brutal-shadow-lg paper-texture'
            } max-h-[85vh] overflow-y-auto`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Grab Handle Bar */}
            <div className="w-10 h-1.5 rounded-full bg-zinc-500/40 mx-auto mb-3 sm:hidden" />

            {/* Header: Track Cover + Info + Close */}
            <div className={`flex items-center gap-3 pb-3 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'} mb-3`}>
              <img 
                src={trackMenuTarget.track.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300'} 
                alt={trackMenuTarget.track.title} 
                className="w-12 h-12 rounded-xl object-cover brutal-border shrink-0 bg-black"
                onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=R&background=082621&color=26c4b7'; }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-display font-black truncate">{trackMenuTarget.track.title}</p>
                <p className={`text-xs truncate mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {trackMenuTarget.track.artist || 'Unknown Artist'}
                </p>
                {trackMenuTarget.isAi && (
                  <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-mono font-bold text-[#17a398] bg-[#17a398]/15 px-1.5 py-0.2 rounded border border-[#17a398]/30">
                    <Sparkles size={10} />
                    AI Recommendation
                  </span>
                )}
              </div>
              <button
                onClick={() => setTrackMenuTarget(null)}
                className={`p-2 rounded-xl cursor-pointer transition-colors ${
                  isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-600 hover:text-black hover:bg-[#ede5d3]'
                }`}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Action Items List */}
            <div className="space-y-1 font-mono text-xs font-bold">
              {/* Play Now */}
              <button
                onClick={() => {
                  handleQueueTrackClick(trackMenuTarget.track, trackMenuTarget.index);
                  setTrackMenuTarget(null);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-zinc-800/80 text-zinc-200' : 'hover:bg-[#ede5d3] text-zinc-900'
                }`}
              >
                <Play size={16} className="text-[#17a398]" />
                <span>Play Track Now</span>
              </button>



              {/* Adjust in Queue: Move to Top */}
              {reorderQueue && trackMenuTarget.index !== undefined && trackMenuTarget.index > 0 && (
                <button
                  onClick={() => {
                    reorderQueue(trackMenuTarget.index, 0);
                    showToast('Moved to top of queue');
                    setTrackMenuTarget(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-zinc-800/80 text-zinc-200' : 'hover:bg-[#ede5d3] text-zinc-900'
                  }`}
                >
                  <ChevronsUp size={16} className="text-[#26c4b7]" />
                  <span>Move to Top of Queue</span>
                </button>
              )}

              {/* Adjust in Queue: Move to Bottom */}
              {reorderQueue && trackMenuTarget.index !== undefined && trackMenuTarget.index < displayQueue.length - 1 && (
                <button
                  onClick={() => {
                    reorderQueue(trackMenuTarget.index, displayQueue.length - 1);
                    showToast('Moved to bottom of queue');
                    setTrackMenuTarget(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-zinc-800/80 text-zinc-200' : 'hover:bg-[#ede5d3] text-zinc-900'
                  }`}
                >
                  <ChevronsDown size={16} className="text-[#26c4b7]" />
                  <span>Move to Bottom of Queue</span>
                </button>
              )}

              {/* Add to Queue: Play Next */}
              {onAddToQueue && (
                <button
                  onClick={() => {
                    onAddToQueue(trackMenuTarget.track, true);
                    showToast(currentTrack ? 'Will play next after current song' : 'Now playing');
                    setTrackMenuTarget(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-zinc-800/80 text-zinc-200' : 'hover:bg-[#ede5d3] text-zinc-900'
                  }`}
                >
                  <ListPlus size={16} className="text-[#26c4b7]" />
                  <span>Play Next in Queue</span>
                </button>
              )}

              {/* Add to Queue: End of Queue */}
              {onAddToQueue && (
                <button
                  onClick={() => {
                    onAddToQueue(trackMenuTarget.track, false);
                    showToast(currentTrack ? 'Added to end of queue' : 'Now playing');
                    setTrackMenuTarget(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-zinc-800/80 text-zinc-200' : 'hover:bg-[#ede5d3] text-zinc-900'
                  }`}
                >
                  <Plus size={16} className="text-[#26c4b7]" />
                  <span>Add to Queue</span>
                </button>
              )}

              {/* Remove from Queue */}
              {onRemoveFromQueue && (
                <button
                  onClick={() => {
                    const idxOrId = trackMenuTarget.index !== undefined ? trackMenuTarget.index : (trackMenuTarget.track.id || trackMenuTarget.track._id);
                    onRemoveFromQueue(idxOrId);
                    showToast('Removed from queue');
                    setTrackMenuTarget(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-zinc-800/80 text-zinc-300' : 'hover:bg-[#ede5d3] text-zinc-800'
                  }`}
                >
                  <Minus size={16} className="text-zinc-400" />
                  <span>Remove from Queue</span>
                </button>
              )}

              <div className={`my-1.5 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`} />

              {/* Add to Playlist */}
              {openAddToPlaylist && (
                <button
                  onClick={() => {
                    openAddToPlaylist(trackMenuTarget.track);
                    setTrackMenuTarget(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-zinc-800/80 text-zinc-200' : 'hover:bg-[#ede5d3] text-zinc-900'
                  }`}
                >
                  <BookmarkPlus size={16} className="text-[#f59e0b]" />
                  <span>Add to Playlist...</span>
                </button>
              )}

              {/* Remove from Playlist (when currently browsing a playlist) */}
              {selectedPlaylist && onRemoveTrackFromPlaylist && (
                <button
                  onClick={() => {
                    onRemoveTrackFromPlaylist(trackMenuTarget.track.id || trackMenuTarget.track._id, selectedPlaylist.id || selectedPlaylist._id);
                    showToast(`Removed from ${selectedPlaylist.name}`);
                    setTrackMenuTarget(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer text-amber-500 ${
                    isDark ? 'hover:bg-amber-500/10' : 'hover:bg-amber-100'
                  }`}
                >
                  <BookmarkMinus size={16} />
                  <span>Remove from {selectedPlaylist.name}</span>
                </button>
              )}

              {/* Edit Song Details (Admin) */}
              {isAdmin && onOpenEditSong && (
                <button
                  onClick={() => {
                    onOpenEditSong(trackMenuTarget.track);
                    setTrackMenuTarget(null);
                    onClose();
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                    isDark ? 'hover:bg-zinc-800/80 text-zinc-200' : 'hover:bg-[#ede5d3] text-zinc-900'
                  }`}
                >
                  <Edit3 size={16} className="text-[#17a398]" />
                  <span>Edit Song Details (Admin)</span>
                </button>
              )}

              {/* Delete Song Permanently (Admin) */}
              {isAdmin && onDeleteTrack && (
                <button
                  onClick={() => {
                    setDeleteConfirmTrack(trackMenuTarget.track);
                    setTrackMenuTarget(null);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer text-red-500 ${
                    isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-100'
                  }`}
                >
                  <Trash2 size={16} />
                  <span>Delete Song Permanently</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Toast Notification */}
      {actionToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[500] px-4 py-2 rounded-xl bg-[#0b1110] text-[#fdfbf7] font-mono text-xs font-bold brutal-border brutal-shadow-md flex items-center gap-2 shadow-2xl animate-in slide-in-from-bottom-3 fade-in duration-200">
          <CheckCircle2 size={15} className="text-[#17a398]" />
          <span>{actionToast}</span>
        </div>
      )}
    </div>
  );
}
