import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, 
  Heart, Volume2, VolumeX, Download, Disc, Sparkles, Languages, Loader2,
  MoreHorizontal, ListMusic, Mic, Trash2, SlidersHorizontal, CheckCircle2,
  Edit3, Check, Search, X, Sliders, Sun, Moon
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAudioPlayer } from '../context/AudioContext';
import { getJamSocket } from '../utils/jamService';
import ConfirmModal from './ConfirmModal';

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
          const color = `rgb(${bestR}, ${bestG}, ${bestB})`;
          colorCache.set(src, color);
          callback(color);
        } else {
          callback(null);
        }
      } catch {
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
  isShuffle,
  toggleShuffle,
  isRepeat,
  toggleRepeat,
  queue = [],
  openAddToPlaylist,
  onPlayTrack,
  jamSession,
  onAddToJamQueue,
  onRemoveFromJamQueue,
  globalTheme = 'dark'
}) {
  // Get audioRef & isYtTrack directly for frame-perfect lyrics sync
  const { audioRef, isYtTrack, playTrack, currentTime: audioCurrentTime, duration: audioDuration, isMixMode, setIsMixMode } = useAudioPlayer();

  const isTrackLiked = likedTrackIds.some(id => String(id) === String(currentTrack?.id) || String(id) === String(currentTrack?._id)) || Boolean(currentTrack?.liked);

  // Detect if current track is a YouTube track (Groq doesn't support YouTube on Railway)
  const isYouTubeTrack = Boolean(
    currentTrack?.audioUrl &&
    (currentTrack.audioUrl.includes('youtube.com') || currentTrack.audioUrl.includes('youtu.be'))
  );

  const [activeTab, setActiveTab] = useState('player');
  const [desktopSideTab, setDesktopSideTab] = useState('lyrics');
  const [isVinylMode, setIsVinylMode] = useState(false);
  const lyricRefs = useRef({});

  // Use global theme directly
  const isDark = globalTheme === 'dark';

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

  const activeTime = currentTime !== undefined ? currentTime : (audioCurrentTime || 0);
  const activeDuration = (duration !== undefined && duration > 0) ? duration : (audioDuration || currentTrack?.duration || 210);

  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedLyrics, setTranslatedLyrics] = useState(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [syncOffset, setSyncOffset] = useState(0);

  const [localLyrics, setLocalLyrics] = useState(null);

  useEffect(() => {
    setSyncOffset(0);
    setLocalLyrics(null);
    setTranslatedLyrics(null);
    setShowTranslation(false);

    if (currentTrack) {
      const qTitle = currentTrack.title;
      const qArtist = currentTrack.artist;
      const tId = currentTrack.id || currentTrack._id;
      if (qTitle) {
        // First check server for manually saved or cached lyrics
        fetch(`${API_BASE_URL}/api/tracks/lyrics?trackId=${encodeURIComponent(tId || '')}&title=${encodeURIComponent(qTitle || '')}&artist=${encodeURIComponent(qArtist || '')}`)
          .then(r => r.json())
          .then(d => {
            if (d.success && Array.isArray(d.lyrics) && d.lyrics.length > 0) {
              setLocalLyrics(d.lyrics);
              currentTrack.lyrics = d.lyrics;
            } else if (!currentTrack.lyrics || currentTrack.lyrics.length === 0) {
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
                  setLocalLyrics(g.lyrics);
                  currentTrack.lyrics = g.lyrics;
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
        setLocalLyrics(data.lyrics);
        currentTrack.lyrics = data.lyrics;
      }
    };
    s.on('lyrics:updated', onLyricsUpdated);
    return () => {
      s.off('lyrics:updated', onLyricsUpdated);
    };
  }, [currentTrack?.id, currentTrack?._id, currentTrack?.title]);

  const rawLyrics = localLyrics || (currentTrack && Array.isArray(currentTrack.lyrics) ? currentTrack.lyrics : []);
  const baseLyrics = (showTranslation && translatedLyrics) ? translatedLyrics : rawLyrics;

  const lyrics = useMemo(() => {
    if (!baseLyrics || !baseLyrics.length) return [];
    if (!syncOffset) return baseLyrics;
    return baseLyrics.map(l => ({
      ...l,
      time: Math.max(0, Math.round((l.time + syncOffset) * 100) / 100)
    }));
  }, [baseLyrics, syncOffset]);

  const activeLyricIndex = lyrics.length > 0
    ? lyrics.findIndex((line, idx) => {
        const nextLine = lyrics[idx + 1];
        return activeTime >= line.time && (!nextLine || activeTime < nextLine.time);
      })
    : -1;


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
  const [isSavingManualLyrics, setIsSavingManualLyrics] = useState(false);

  const openManualEdit = () => {
    const formatted = rawLyrics
      .map(line => {
        const m = Math.floor(line.time / 60);
        const s = Math.floor(line.time % 60);
        const timeStr = `[${m}:${s < 10 ? '0' : ''}${s}]`;
        return `${timeStr} ${line.text}`;
      })
      .join('\n');
    setManualText(formatted);
    setIsManualEditOpen(true);
  };

  const handleSaveManualLyrics = async () => {
    if (!currentTrack) return;
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

      await fetch(`${API_BASE_URL}/api/tracks/update-lyrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trackId: currentTrack.id || currentTrack._id,
          title: currentTrack.title,
          artist: currentTrack.artist,
          audioUrl: currentTrack.audioUrl,
          lyrics: parsed
        })
      });

      currentTrack.lyrics = parsed;
      setLocalLyrics(parsed);
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
          trackId: currentTrack.id,
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

  // Clear wrong/cached lyrics from MongoDB immediately
  const executeClearLyrics = async () => {
    if (!currentTrack || !rawLyrics.length) return;
    setIsClearingLyrics(true);
    try {
      await fetch(`${API_BASE_URL}/api/tracks/clear-lyrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          trackId: currentTrack.id,
          title: currentTrack.title 
        })
      });
      currentTrack.lyrics = [];
      setLocalLyrics([]);
      setTranslatedLyrics(null);
      setShowTranslation(false);
    } catch (e) {
      console.warn('Clear lyrics error:', e);
    }
    setIsClearingLyrics(false);
    setIsClearLyricsConfirmOpen(false);
  };

  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef(null);

  const handleUserScroll = () => {
    setIsUserScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 4000);
  };

  useEffect(() => {
    if (isOpen && activeTab === 'lyrics' && activeLyricIndex !== -1 && lyricRefs.current[activeLyricIndex] && !isUserScrolling) {
      try {
        lyricRefs.current[activeLyricIndex].scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      } catch (err) {}
    }
  }, [activeLyricIndex, activeTab, isOpen, isUserScrolling]);

  // ── Download handler with visual feedback ──
  const [isDownloading, setIsDownloading] = useState(false);

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
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = activeDuration > 0 ? (activeTime / activeDuration) * 100 : 0;

  // Play a track from the queue
  const handleQueueTrackClick = (track) => {
    if (onPlayTrack) {
      onPlayTrack(track, queue);
    } else if (playTrack) {
      playTrack(track, queue);
    }
  };

  const renderLyrics = () => (
    <div 
      onScroll={handleUserScroll} 
      onTouchStart={handleUserScroll} 
      className="flex-1 overflow-y-auto py-2 scroll-smooth relative h-full select-none"
      style={{ scrollbarWidth: 'none' }}
    >
      {lyrics.length > 0 ? (
        <div className="py-3 px-2 space-y-3">
          {lyrics.map((line, idx) => {
            const isActive = idx === activeLyricIndex;
            return (
              <div 
                key={idx}
                ref={(el) => (lyricRefs.current[idx] = el)}
                onClick={() => seekTo(line.time)}
                className={`cursor-pointer transition-all duration-250 p-2.5 rounded-xl ${
                  isActive 
                    ? 'bg-[#ede5d3] brutal-border border-l-8 border-l-[#17a398] brutal-shadow-sm scale-[1.01]' 
                    : 'hover:bg-[#ede5d3]/50 opacity-60 hover:opacity-90'
                }`}
              >
                <p 
                  className={`leading-snug transition-all ${
                    isActive 
                      ? 'font-display font-black text-xl md:text-2xl text-[#0b1110]' 
                      : 'font-display font-bold text-base md:text-lg text-zinc-700'
                  }`}
                >
                  {line.text}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 px-4 text-[#0b1110]">
          <div className="w-16 h-16 rounded-2xl bg-[#ede5d3] brutal-border flex items-center justify-center mx-auto mb-4 brutal-shadow-sm">
            <ListMusic size={32} className="text-[#17a398]" />
          </div>
          <p className="font-display font-black text-[#0b1110] text-lg mb-1">No Prescribed Lyrics Found</p>
          <p className="text-xs font-mono text-zinc-600 max-w-xs mx-auto mb-5">
            Search the clinical archives or enter lyrics manually with timestamps.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleGenerateLyrics}
              disabled={isGeneratingLyrics}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-display font-black text-xs rounded-xl brutal-border brutal-shadow-sm brutal-btn cursor-pointer disabled:opacity-50"
            >
              {isGeneratingLyrics ? (
                <><Loader2 size={15} className="animate-spin" /><span>Searching Archives...</span></>
              ) : (
                <><Search size={15} /><span>Auto-Search Lyrics</span></>
              )}
            </button>

            <button
              onClick={openManualEdit}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#ede5d3] hover:bg-[#ded2bb] text-[#0b1110] font-display font-bold text-xs rounded-xl brutal-border brutal-shadow-sm brutal-btn cursor-pointer"
            >
              <Edit3 size={15} className="text-[#0f756d]" />
              <span>Enter Manually</span>
            </button>
          </div>
        </div>
      )}

      {/* Manual Edit Lyrics Modal Overlay */}
      {isManualEditOpen && (
        <div className="fixed inset-0 z-[400] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg max-w-lg w-full p-6 text-left relative">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#0b1110] mb-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#17a398] brutal-border" />
                <h3 className="text-base font-mono font-black uppercase text-[#082621]">Edit Formulation Lyrics</h3>
              </div>
              <button onClick={() => setIsManualEditOpen(false)} className="brutal-btn p-1 bg-[#ede5d3] brutal-border text-[#0b1110]">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-[#082621]/70 mb-2 font-sans leading-relaxed">
              Format timestamps like <code className="bg-[#ede5d3] px-1 py-0.5 brutal-border text-[#082621] font-mono">[0:15]</code> before each line for automated karaoke sync.
            </p>

            <textarea
              rows={10}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="[0:00] First Line&#10;[0:12] Second Line..."
              className="w-full bg-[#ede5d3] brutal-border p-3 text-xs font-mono text-[#0b1110] focus:outline-none focus:bg-white mb-4 resize-none leading-relaxed"
            />

            <div className="flex gap-3">
              <button
                onClick={handleSaveManualLyrics}
                disabled={isSavingManualLyrics}
                className="brutal-btn flex-1 py-2.5 bg-[#082621] hover:bg-[#0b1110] text-[#26c4b7] font-mono text-xs font-black uppercase brutal-border brutal-shadow flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSavingManualLyrics ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                <span>SAVE LYRICS TRANSCRIPT</span>
              </button>
              <button
                onClick={() => setIsManualEditOpen(false)}
                className="brutal-btn px-5 py-2.5 bg-[#ede5d3] hover:bg-[#ded2bb] text-[#082621] font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm cursor-pointer"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderQueue = () => (
    <div className="flex-1 overflow-y-auto h-full pr-1 space-y-2">
      {jamSession ? (
        <div className="mb-3 p-2.5 bg-[#ede5d3] brutal-border rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#17a398] animate-ping" />
            <p className="text-xs font-mono font-bold uppercase text-[#0b1110]">
              Jam Session Queue — {queue.length} Tracks
            </p>
          </div>
          <span className="text-[10px] font-mono font-black bg-[#0b1110] text-[#26c4b7] px-2 py-0.5 rounded brutal-border">
            PIN: {jamSession.code}
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between pb-2 border-b-2 border-dashed border-[#ded2bb] mb-2">
          <span className="text-[11px] font-mono font-bold uppercase text-zinc-600">
            Formulation Queue ({queue.length} Songs)
          </span>
          <span className="text-[10px] font-mono font-bold bg-[#ede5d3] brutal-border px-1.5 py-0.2 rounded text-zinc-700">
            AUDIO QUEUE
          </span>
        </div>
      )}

      {queue.length === 0 ? (
        <div className="py-12 text-center text-zinc-600 text-xs font-mono">
          <p className="font-bold">The queue is currently empty.</p>
          <p className="mt-1 text-zinc-500">Queue up songs from your dispensary or search.</p>
        </div>
      ) : (
        queue.map((track, i) => {
          const isActive = String(track.id || track._id) === String(currentTrack?.id || currentTrack?._id);
          return (
            <div 
              key={`${track.id || track._id}-${i}`}
              onClick={() => !isActive && handleQueueTrackClick(track)}
              className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-all brutal-btn ${
                isActive 
                  ? 'bg-[#ede5d3] brutal-border brutal-shadow-sm font-black' 
                  : 'bg-white hover:bg-[#ede5d3] brutal-border'
              }`}
            >
              <div className="relative shrink-0">
                <img src={track.cover} alt={track.title} className="w-10 h-10 rounded-lg object-cover brutal-border" />
                {isActive && (
                  <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                    <span className="w-2 h-2 rounded-full bg-[#17a398] animate-ping" />
                  </div>
                )}
              </div>
              <div className="flex-1 truncate">
                <p className={`text-xs truncate font-display font-black ${isActive ? 'text-[#0f756d]' : 'text-[#0b1110]'}`}>
                  {track.title}
                </p>
                <p className="text-[11px] truncate text-zinc-600 font-sans mt-0.5">{track.artist}</p>
              </div>

              {jamSession && onRemoveFromJamQueue && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFromJamQueue(i, track.id || track._id);
                  }}
                  className="p-1.5 text-zinc-600 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                  title="Remove from Jam Queue"
                >
                  <Trash2 size={14} />
                </button>
              )}

              {!isActive && !jamSession && (
                <Play size={13} className="text-zinc-600 shrink-0" />
              )}
            </div>
          );
        })
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
          { id: 'queue', label: `Queue` },
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
            ? 'bg-[#101514] text-[#fdfbf7] border-2 border-zinc-700 shadow-2xl' 
            : 'bg-[#fdfbf7] text-[#0b1110] brutal-border-thick brutal-shadow-lg paper-texture'
        } rounded-2xl p-4 sm:p-5 relative ${activeTab === 'player' ? 'flex' : 'hidden lg:flex'}`}>
          
          {/* Deck Header: Mechanical cassette label & model stamp */}
          <div className={`flex items-center justify-between pb-2 border-b-2 ${
            isDark ? 'border-zinc-800' : 'border-[#0b1110]'
          } mb-1.5 shrink-0`}>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#17a398] animate-pulse" />
              <span className={`font-mono font-bold text-[10px] ${isDark ? 'text-zinc-400' : 'text-[#082621]'} uppercase tracking-wider`}>
                RIVO STEREO DECK // CR-500
              </span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-mono font-black px-1.5 py-0.2 bg-[#0b1110] text-[#26c4b7] rounded">
                24-BIT HI-FI
              </span>
            </div>
          </div>

          {/* Cassette / Vinyl / Album Art Bay */}
          <div className="flex-1 flex items-center justify-center py-2 min-h-0">
            <div className="relative w-full max-h-[260px] flex items-center justify-center" style={{ maxWidth: 'min(280px, 60vw)', aspectRatio: '1' }}>
              {isVinylMode ? (
                <div 
                  className={`w-full h-full rounded-full flex items-center justify-center relative overflow-hidden brutal-border-thick brutal-shadow-md ${isPlaying ? 'vinyl-spin' : ''}`}
                  style={{ background: '#111' }}
                >
                  <div className="absolute inset-0" style={{ 
                    background: 'repeating-radial-gradient(circle at 50%, transparent 0, transparent 10px, rgba(255,255,255,0.03) 10px, rgba(255,255,255,0.03) 11px)'
                  }}/>
                  <div className="w-2/5 h-2/5 rounded-full overflow-hidden border-2 border-black shadow-xl z-10">
                    <img src={currentTrack.cover} alt={currentTrack.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="absolute w-4 h-4 rounded-full bg-[#ede5d3] border-2 border-[#0b1110] z-20" />
                </div>
              ) : (
                /* Authentic Retro Cassette / Album Art Enclosure */
                <div className={`w-full h-full p-2.5 ${
                  isDark ? 'bg-[#141b19] border-2 border-zinc-700' : 'bg-[#ede5d3] brutal-border-thick'
                } rounded-2xl brutal-shadow-sm flex flex-col justify-between relative overflow-hidden`}>
                  {/* Clean Uncluttered Cover Window */}
                  <div className="relative w-full flex-1 rounded-xl overflow-hidden brutal-border bg-[#0b1110] shadow-inner flex items-center justify-center">
                    <img 
                      src={currentTrack.cover} 
                      alt={currentTrack.title}
                      className="w-full h-full object-contain bg-black"
                      style={{ 
                        transform: isPlaying ? 'scale(1.02)' : 'scale(1)',
                        transition: 'transform 0.4s ease',
                      }}
                    />
                  </div>

                  {/* Clean Lower Cassette Tape Bar (Separate from Cover Art) */}
                  <div className="mt-3 pt-2.5 pb-0.5 border-t border-dashed border-zinc-400/30 flex items-center justify-between px-1.5 shrink-0">
                    <span className="text-[7.5px] font-mono font-medium text-zinc-400 uppercase tracking-wider">
                      SIDE A // STEREO
                    </span>
                    {/* Compact Spool Wheels (Separate) */}
                    <div className="flex items-center gap-1">
                      <div className={`w-2.5 h-2.5 rounded-full border border-zinc-400/80 bg-black/40 flex items-center justify-center ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }}>
                        <div className="w-0.5 h-0.5 rounded-full bg-[#17a398]" />
                      </div>
                      <div className="w-3 h-0.5 bg-[#17a398]/50 rounded-full" />
                      <div className={`w-2.5 h-2.5 rounded-full border border-zinc-400/80 bg-black/40 flex items-center justify-center ${isPlaying ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }}>
                        <div className="w-0.5 h-0.5 rounded-full bg-[#17a398]" />
                      </div>
                    </div>
                    <span className="text-[7.5px] font-mono font-medium text-zinc-400 uppercase tracking-wider">
                      HI-FI 24-BIT
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Song Info & Like */}
          <div className="flex items-center justify-between my-2 shrink-0">
            <div className="truncate flex-1 min-w-0 pr-2">
              <span className="text-[9px] font-mono font-bold bg-[#17a398] text-[#0b1110] px-1.5 py-0.2 rounded brutal-border">
                {currentTrack.genre || 'STEREO'}
              </span>
              <h2 className="text-base sm:text-lg font-display font-black text-[#0b1110] truncate tracking-tight mt-0.5">
                {currentTrack.title}
              </h2>
              <p className="text-xs font-bold truncate text-[#0f756d]">
                {currentTrack.artist}
              </p>
            </div>

            <button 
              onClick={() => toggleLike(currentTrack.id)}
              className="p-2 rounded-xl bg-white brutal-border brutal-shadow-sm brutal-btn hover:scale-105 active:scale-95 cursor-pointer shrink-0"
              title={isTrackLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
            >
              <Heart 
                size={18} 
                fill={isTrackLiked ? '#dc2626' : 'none'}
                className={isTrackLiked ? 'text-[#dc2626]' : 'text-zinc-500'}
              />
            </button>
          </div>

          {/* Seekbar */}
          <div className="mb-2 shrink-0">
            <div 
              className="relative h-2 w-full rounded-full overflow-hidden cursor-pointer bg-[#ede5d3] brutal-border"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const pct = Math.max(0, Math.min(1, x / rect.width));
                seekTo(pct * activeDuration);
              }}
            >
              <div 
                className="absolute top-0 left-0 h-full bg-[#0b1110]"
                style={{ 
                  width: `${progressPercent}%`, 
                  transition: 'width 0.1s linear'
                }}
              />
            </div>
            <div className="flex justify-between mt-1 font-mono font-bold text-[10px] text-zinc-600">
              <span>{formatTime(activeTime)}</span>
              <span>{formatTime(activeDuration)}</span>
            </div>
          </div>

          {/* Mechanical Transport Controls */}
          <div className="flex items-center justify-between mb-2 shrink-0">
            <button 
              onClick={toggleShuffle} 
              className={`p-1.5 sm:p-2 rounded-xl brutal-border brutal-btn cursor-pointer ${
                isShuffle ? 'bg-[#17a398] text-[#0b1110] font-bold' : 'bg-white text-zinc-600 hover:bg-[#ede5d3]'
              }`}
              title="Shuffle"
            >
              <Shuffle size={15} strokeWidth={2.5} />
            </button>

            <button 
              onClick={playPrev} 
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white hover:bg-[#ede5d3] text-[#0b1110] brutal-border flex items-center justify-center brutal-shadow-sm brutal-btn cursor-pointer"
              title="Previous"
            >
              <SkipBack size={17} fill="currentColor" />
            </button>

            <button 
              onClick={togglePlay} 
              className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border-thick flex items-center justify-center brutal-shadow-md brutal-btn cursor-pointer"
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying 
                ? <Pause size={20} fill="currentColor" /> 
                : <Play size={20} fill="currentColor" className="ml-0.5" />
              }
            </button>

            <button 
              onClick={playNext} 
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-white hover:bg-[#ede5d3] text-[#0b1110] brutal-border flex items-center justify-center brutal-shadow-sm brutal-btn cursor-pointer"
              title="Next"
            >
              <SkipForward size={17} fill="currentColor" />
            </button>

            <button 
              onClick={toggleRepeat} 
              className={`p-1.5 sm:p-2 rounded-xl brutal-border brutal-btn cursor-pointer ${
                isRepeat ? 'bg-[#dc2626] text-white font-bold' : 'bg-white text-zinc-600 hover:bg-[#ede5d3]'
              }`}
              title="Repeat"
            >
              <Repeat size={15} strokeWidth={2.5} />
            </button>
          </div>

          {/* ── Audio Console Level Fader (Tactile Brutalist Volume Console) ── */}
          <div className={`pt-2 border-t-2 border-dashed ${isDark ? 'border-zinc-800' : 'border-[#ded2bb]'} flex items-center justify-between gap-2 shrink-0`}>
            {/* Tactile Master Volume Fader */}
            <div className={`flex items-center gap-2 ${
              isDark ? 'bg-[#1c2422] border border-zinc-700' : 'bg-white brutal-border'
            } px-2.5 py-1.5 rounded-xl brutal-shadow-sm flex-1 max-w-[220px]`}>
              <button 
                onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
                className={`${isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 hover:text-black'} cursor-pointer transition-colors shrink-0`}
                title={volume > 0 ? "Mute" : "Unmute"}
              >
                {volume === 0 ? <VolumeX size={15} className="text-red-500" /> : <Volume2 size={15} />}
              </button>
              
              <div className="relative flex-1 flex items-center">
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={volume || 0}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className={`w-full h-2 ${
                    isDark ? 'bg-zinc-800 accent-[#17a398]' : 'bg-[#ede5d3] accent-[#0b1110]'
                  } brutal-border rounded-full appearance-none cursor-pointer`}
                />
              </div>

              <span className={`text-[10px] font-mono font-bold w-6 text-right ${
                isDark ? 'text-zinc-300' : 'text-zinc-800'
              } select-none`}>
                {Math.round((volume || 0) * 100)}%
              </span>
            </div>

            {/* Deck Auxiliary Controls */}
            <div className="flex items-center gap-1 shrink-0">
              {/* Vinyl Mode Toggle */}
              <button 
                onClick={() => setIsVinylMode(!isVinylMode)}
                className={`p-1.5 sm:p-2 rounded-xl brutal-border brutal-btn cursor-pointer transition-colors ${
                  isVinylMode 
                    ? 'bg-[#17a398] text-[#0b1110]' 
                    : isDark 
                      ? 'bg-[#1c2422] text-zinc-400 hover:text-white border border-zinc-700' 
                      : 'bg-white text-zinc-700 hover:bg-[#ede5d3]'
                }`}
                title="Vinyl Turntable Mode"
              >
                <Disc size={15} strokeWidth={2.5} />
              </button>

              {/* DJ Mix Mode Toggle */}
              <button 
                onClick={() => setIsMixMode?.(prev => !prev)} 
                className={`p-1.5 sm:p-2 rounded-xl brutal-border brutal-btn cursor-pointer transition-colors ${
                  isMixMode 
                    ? 'bg-[#17a398] text-[#0b1110]' 
                    : isDark 
                      ? 'bg-[#1c2422] text-zinc-400 hover:text-white border border-zinc-700' 
                      : 'bg-white text-zinc-700 hover:bg-[#ede5d3]'
                }`}
                title={isMixMode ? "DJ Mix ON (Auto Crossfade)" : "Turn on DJ Mix (Auto Crossfade)"}
              >
                <Sliders size={15} strokeWidth={2.5} />
              </button>

              {/* Download Audio */}
              {toggleDownload && (
                <button 
                  onClick={handleDownloadClick}
                  disabled={isDownloading}
                  className={`p-1.5 sm:p-2 rounded-xl ${
                    isDark 
                      ? 'bg-[#1c2422] hover:bg-[#25302d] text-zinc-300 border border-zinc-700' 
                      : 'bg-white hover:bg-[#ede5d3] text-zinc-700 brutal-border'
                  } brutal-btn cursor-pointer transition-colors disabled:opacity-50`}
                  title={currentTrack.downloaded ? 'Downloaded ✓' : 'Download Audio Rx'}
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
            {renderLyrics()}
          </div>
        )}

        {/* ─── MOBILE QUEUE TAB ─── */}
        {activeTab === 'queue' && (
          <div className={`lg:hidden flex-1 flex flex-col overflow-hidden w-full max-w-md mx-auto ${
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
                Queue ({queue.length})
              </button>
            </div>

            {desktopSideTab === 'lyrics' && (
              <div className="flex items-center gap-1.5">
                {rawLyrics.length > 0 && (
                  <>
                    <button
                      onClick={handleTranslateLyrics}
                      disabled={isTranslating}
                      className={`px-2 py-1 rounded-lg transition-all text-xs font-bold border border-black flex items-center gap-1 ${
                        showTranslation ? 'text-[#0b1110] bg-[#17a398]' : 'bg-white text-zinc-700 hover:text-black'
                      }`}
                      title="Translate Lyrics"
                    >
                      <Languages size={14} />
                      <span className="text-[10px]">Translate</span>
                    </button>
                    <button
                      onClick={openManualEdit}
                      className="p-1.5 bg-white text-zinc-700 hover:text-black border border-black rounded-lg transition-colors"
                      title="Edit Lyrics"
                    >
                      <Edit3 size={14} />
                    </button>
                    <button
                      onClick={() => setIsClearLyricsConfirmOpen(true)}
                      className="p-1.5 bg-white text-zinc-700 hover:text-red-500 border border-black rounded-lg transition-colors"
                      title="Clear Lyrics"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {desktopSideTab === 'lyrics' ? renderLyrics() : renderQueue()}
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
    </div>
  );
}
