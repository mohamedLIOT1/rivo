import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, 
  Heart, Volume2, VolumeX, Download, Disc, Sparkles, Languages, Loader2,
  MoreHorizontal, ListMusic, Mic, Trash2, SlidersHorizontal, CheckCircle2,
  Edit3, Check, Search
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAudioPlayer } from '../context/AudioContext';
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

        // Find dominant vibrant color using saturation-weighted approach
        let bestR = 0, bestG = 0, bestB = 0, bestScore = 0;
        const buckets = new Map();
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i+1], b = data[i+2];
          const brightness = (r + g + b) / 3;
          if (brightness < 30 || brightness > 225) continue; // skip very dark/light
          
          // Quantize to reduce color buckets
          const key = `${Math.round(r/20)*20},${Math.round(g/20)*20},${Math.round(b/20)*20}`;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const saturation = max === 0 ? 0 : (max - min) / max;
          
          const count = (buckets.get(key) || 0) + 1;
          buckets.set(key, count);
          // Score = count * saturation boost
          const score = count * (1 + saturation * 2);
          if (score > bestScore) {
            bestScore = score;
            bestR = r; bestG = g; bestB = b;
          }
        }

        if (bestScore > 0) {
          // Boost saturation slightly for vibrancy
          const max = Math.max(bestR, bestG, bestB);
          if (max > 0) {
            const factor = Math.min(255 / max, 1.3);
            bestR = Math.min(255, Math.round(bestR * factor));
            bestG = Math.min(255, Math.round(bestG * factor));
            bestB = Math.min(255, Math.round(bestB * factor));
          }
          const color = `rgb(${bestR},${bestG},${bestB})`;
          colorCache.set(src, color);
          callback(color);
        } else {
          callback(null);
        }
      } catch { callback(null); }
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
}) {
  // Get audioRef & isYtTrack directly for frame-perfect lyrics sync
  const { audioRef, isYtTrack, playTrack } = useAudioPlayer();

  const isTrackLiked = likedTrackIds.some(id => String(id) === String(currentTrack?.id) || String(id) === String(currentTrack?._id)) || Boolean(currentTrack?.liked);

  // Detect if current track is a YouTube track (Groq doesn't support YouTube on Railway)
  const isYouTubeTrack = Boolean(
    currentTrack?.audioUrl &&
    (currentTrack.audioUrl.includes('youtube.com') || currentTrack.audioUrl.includes('youtu.be'))
  );

  const [activeTab, setActiveTab] = useState('player');
  const [isVinylMode, setIsVinylMode] = useState(false);
  const lyricRefs = useRef({});

  // ── Dynamic background color extracted from album art ──
  const [dynamicColor, setDynamicColor] = useState(null);

  useEffect(() => {
    if (!currentTrack?.cover) {
      setDynamicColor(currentTrack?.color || '#1DB954');
      return;
    }
    // Use stored color first for instant display
    setDynamicColor(currentTrack.color || '#1DB954');
    
    // Try direct first, then via proxy (bypass YouTube CORS)
    const coverUrl = currentTrack.cover;
    extractColorFromImage(coverUrl, (color) => {
      if (color) {
        setDynamicColor(color);
      } else {
        // Fallback: use server proxy to bypass CORS for YouTube thumbnails
        const proxiedUrl = `${API_BASE_URL}/api/proxy-image?url=${encodeURIComponent(coverUrl)}`;
        extractColorFromImage(proxiedUrl, (c2) => {
          if (c2) setDynamicColor(c2);
        });
      }
    });
  }, [currentTrack?.cover, currentTrack?.color]);

  const trackColor = dynamicColor || currentTrack?.color || '#1DB954';

  // ── RAF-based live time for lyrics sync (reads audio directly at ~60fps) ──
  const [liveTime, setLiveTime] = useState(currentTime);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!isOpen || activeTab !== 'lyrics') {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      if (isYtTrack) {
        try {
          const yt = window.__liofyYTPlayer;
          if (yt && typeof yt.getCurrentTime === 'function') {
            setLiveTime(yt.getCurrentTime() || 0);
          } else {
            setLiveTime(t => t);
          }
        } catch {}
      } else if (audioRef?.current && !isNaN(audioRef.current.currentTime)) {
        setLiveTime(audioRef.current.currentTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isOpen, activeTab, isYtTrack, audioRef]);

  // Sync liveTime from prop when NOT on lyrics tab (so seekbar stays accurate)
  useEffect(() => {
    if (activeTab !== 'lyrics') setLiveTime(currentTime);
  }, [currentTime, activeTab]);

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
  }, [currentTrack?.id]);

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

  // Use liveTime (from RAF at ~60fps) for frame-perfect lyrics sync
  const activeLyricIndex = lyrics.length > 0
    ? lyrics.findIndex((line, idx) => {
        const nextLine = lyrics[idx + 1];
        return liveTime >= line.time && (!nextLine || liveTime < nextLine.time);
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
          trackId: currentTrack.id,
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
    if (!secs || isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Play a track from the queue
  const handleQueueTrackClick = (track) => {
    if (onPlayTrack) {
      onPlayTrack(track, queue);
    } else if (playTrack) {
      playTrack(track, queue);
    }
  };

  return (
    <div 
      className={`fixed inset-0 z-[300] transition-all duration-300 flex flex-col overflow-hidden select-none ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      style={{ background: '#121212' }}
    >
      {/* ── Dynamic Background Gradient ── */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(180deg, ${trackColor}88 0%, ${trackColor}22 45%, #121212 100%)`,
          transition: 'background 1.2s ease',
        }}
      />
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.45)' }}
      />

      {/* ── Top Bar ── */}
      <div className="relative z-10 flex items-center justify-between px-4 py-3 pt-[max(12px,env(safe-area-inset-top))]">
        <button 
          onClick={onClose} 
          className="p-2 text-white hover:text-[#b3b3b3] transition-colors"
          title="Minimize"
        >
          <ChevronDown size={24} />
        </button>

        <div className="text-center flex-1 px-4 truncate">
          <p className="text-xs font-bold tracking-widest uppercase" style={{ color: '#b3b3b3' }}>
            Now Playing
          </p>
          <p className="text-sm font-bold text-white truncate mt-0.5">
            {currentTrack.title || 'Unknown Track'}
          </p>
        </div>

        <button
          className="p-2 text-white hover:text-[#b3b3b3] transition-colors"
          title="Options"
          onClick={openAddToPlaylist}
        >
          <MoreHorizontal size={24} />
        </button>
      </div>

      {/* ── Tab Selector ── */}
      <div className="relative z-10 flex justify-center gap-1 px-4 py-1">
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
      <div className="relative z-10 flex-1 flex flex-col px-6 pt-2 pb-4 overflow-hidden max-w-lg mx-auto w-full">

        {/* ─── PLAYER TAB ─── */}
        {activeTab === 'player' && (
          <div className="flex-1 flex flex-col justify-between">
            {/* Album Artwork */}
            <div className="flex-1 flex items-center justify-center py-4">
              <div className="relative w-full" style={{ maxWidth: 'min(360px, 80vw)', aspectRatio: '1' }}>
                {isVinylMode ? (
                  <div 
                    className={`w-full h-full rounded-full flex items-center justify-center relative overflow-hidden shadow-2xl ${isPlaying ? 'vinyl-spin' : ''}`}
                    style={{ background: '#111' }}
                  >
                    <div className="absolute inset-0" style={{ 
                      background: 'repeating-radial-gradient(circle at 50%, transparent 0, transparent 10px, rgba(255,255,255,0.02) 10px, rgba(255,255,255,0.02) 11px)'
                    }}/>
                    <div className="w-2/5 h-2/5 rounded-full overflow-hidden border-4 border-black shadow-xl z-10">
                      <img src={currentTrack.cover} alt={currentTrack.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="absolute w-4 h-4 rounded-full bg-black border-2 border-white/20 z-20" />
                  </div>
                ) : (
                  <div 
                    className="w-full h-full overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.8)]"
                    style={{ 
                      borderRadius: '8px',
                      transform: isPlaying ? 'scale(1)' : 'scale(0.95)',
                      transition: 'transform 0.4s ease',
                    }}
                  >
                    <img 
                      src={currentTrack.cover} 
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Song Info + Actions */}
            <div className="flex items-center justify-between mb-4 mt-2">
              <div className="truncate flex-1 min-w-0">
                <h2 className="text-2xl font-extrabold text-white truncate tracking-tight">
                  {currentTrack.title}
                </h2>
                <p className="text-base font-semibold truncate mt-0.5" style={{ color: '#b3b3b3' }}>
                  {currentTrack.artist}
                </p>
              </div>

              <div className="flex items-center gap-3 ml-4 shrink-0">
                <button 
                  onClick={() => toggleLike(currentTrack.id)}
                  className="transition-all hover:scale-110 active:scale-95"
                  title={isTrackLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                >
                  <Heart 
                    size={28} 
                    className={isTrackLiked ? 'fill-white text-white' : 'text-[#b3b3b3] hover:text-white'}
                  />
                </button>
              </div>
            </div>

            {/* Seekbar */}
            <div className="mb-4 group">
              <div 
                className="relative h-1 w-full rounded-full overflow-visible cursor-pointer"
                style={{ background: 'rgba(255,255,255,0.2)' }}
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const pct = x / rect.width;
                  seekTo(pct * duration);
                }}
              >
                <div 
                  className="absolute top-0 left-0 h-full rounded-full"
                  style={{ 
                    width: `${progressPercent}%`, 
                    background: 'white',
                    transition: 'width 0.1s linear'
                  }}
                />
                {/* Thumb */}
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  style={{ left: `calc(${progressPercent}% - 6px)` }}
                />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-xs tabular-nums" style={{ color: '#b3b3b3' }}>{formatTime(currentTime)}</span>
                <span className="text-xs tabular-nums" style={{ color: '#b3b3b3' }}>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Transport Controls */}
            <div className="flex items-center justify-between mb-4">
              <button 
                onClick={toggleShuffle} 
                className="p-2 relative transition-all hover:scale-110"
                title="Shuffle"
              >
                <Shuffle 
                  size={22} 
                  style={{ color: isShuffle ? '#1DB954' : '#b3b3b3' }}
                />
                {isShuffle && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1DB954] rounded-full" />
                )}
              </button>

              <button 
                onClick={playPrev} 
                className="p-2 text-white hover:scale-110 active:scale-95 transition-transform"
              >
                <SkipBack size={32} fill="white" />
              </button>

              <button 
                onClick={togglePlay} 
                className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-2xl"
              >
                {isPlaying 
                  ? <Pause size={28} fill="black" /> 
                  : <Play size={28} fill="black" className="ml-1" />
                }
              </button>

              <button 
                onClick={playNext} 
                className="p-2 text-white hover:scale-110 active:scale-95 transition-transform"
              >
                <SkipForward size={32} fill="white" />
              </button>

              <button 
                onClick={toggleRepeat} 
                className="p-2 relative transition-all hover:scale-110"
                title="Repeat"
              >
                <Repeat 
                  size={22} 
                  style={{ color: isRepeat ? '#1DB954' : '#b3b3b3' }}
                />
                {isRepeat && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1DB954] rounded-full" />
                )}
              </button>
            </div>

            {/* Volume + Tools */}
            <div className="flex items-center justify-between">
              {/* Volume Slider */}
              <div className="flex items-center gap-3 flex-1 max-w-[200px] bg-white/5 py-2 px-3 rounded-full border border-white/10">
                <button 
                  onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
                  className="text-zinc-400 hover:text-white transition-colors shrink-0"
                  title={volume > 0 ? "Mute" : "Unmute"}
                >
                  {volume > 0 ? <Volume2 size={18} /> : <VolumeX size={18} className="text-red-400" />}
                </button>
                <div className="flex-1 group relative h-2.5 cursor-pointer flex items-center">
                  <div className="absolute inset-0 rounded-full bg-white/20 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-[#1DB954] transition-all"
                      style={{ width: `${(volume || 0) * 100}%` }}
                    />
                  </div>
                  <input
                    type="range" min="0" max="1" step="0.01" value={volume || 0}
                    onChange={(e) => setVolume(Number(e.target.value))}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                    style={{ height: '100%' }}
                  />
                </div>
                <span className="text-[11px] font-bold text-zinc-400 w-8 text-right">
                  {Math.round((volume || 0) * 100)}%
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setIsVinylMode(!isVinylMode)}
                  className="p-2 transition-all hover:scale-105"
                  title="Vinyl Mode"
                >
                  <Disc size={18} style={{ color: isVinylMode ? '#1DB954' : '#b3b3b3' }} />
                </button>
                {toggleDownload && (
                  <button 
                    onClick={handleDownloadClick}
                    disabled={isDownloading}
                    className="p-2 transition-all hover:scale-105 disabled:opacity-60"
                    title={currentTrack.downloaded ? 'Downloaded ✓' : 'Download'}
                  >
                    {currentTrack.downloaded 
                      ? <CheckCircle2 size={18} style={{ color: '#1DB954' }} />
                      : isDownloading 
                        ? <Loader2 size={18} className="animate-spin text-[#1DB954]" />
                        : <Download size={18} style={{ color: '#b3b3b3' }} />
                    }
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── LYRICS TAB ─── */}
        {activeTab === 'lyrics' && (
          <div 
            onScroll={handleUserScroll} 
            onTouchStart={handleUserScroll} 
            className="flex-1 overflow-y-auto rounded-lg py-4 scroll-smooth relative"
            style={{ scrollbarWidth: 'none' }}
          >
            {/* Header controls */}
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/10 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[#1DB954]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#1DB954]">
                  {showTranslation ? 'Synced Lyrics (Translated)' : 'Live Synced Lyrics'}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Clear wrong lyrics button — only shown when lyrics exist */}
                {rawLyrics.length > 0 && (
                  <button
                    onClick={() => setIsClearLyricsConfirmOpen(true)}
                    disabled={isClearingLyrics}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-red-500/15 hover:bg-red-500/30 border border-red-500/30 rounded-full text-xs font-bold text-red-400 transition-all active:scale-95 disabled:opacity-50"
                    title="مسح الكلمات من قاعدة البيانات"
                  >
                    {isClearingLyrics ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    <span>مسح</span>
                  </button>
                )}

                {/* LRCLIB Search button */}
                <button
                  onClick={handleGenerateLyrics}
                  disabled={isGeneratingLyrics}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#1DB954]/20 hover:bg-[#1DB954]/30 border border-[#1DB954]/40 rounded-full text-xs font-bold text-[#1DB954] transition-all active:scale-95 disabled:opacity-50"
                  title="بحث عن كلمات الأغنية من موقع LRCLIB.net"
                >
                  {isGeneratingLyrics ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Search size={13} />
                  )}
                  <span>{isGeneratingLyrics ? 'جاري البحث...' : 'بحث LRCLIB 🎵'}</span>
                </button>

                {/* Manual Lyrics Edit button */}
                <button
                  onClick={openManualEdit}
                  className="flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-xs font-bold text-white transition-all active:scale-95"
                  title="كتابة أو تعديل كلمات الأغنية يدويًا"
                >
                  <Edit3 size={13} className="text-amber-400" />
                  <span>تعديل يدوي ✏️</span>
                </button>
              </div>
            </div>

            {/* Lyrics content lines */}
            {lyrics.length > 0 ? (
              lyrics.map((line, idx) => {
                const isActive = idx === activeLyricIndex;
                return (
                  <p 
                    key={idx}
                    ref={(el) => (lyricRefs.current[idx] = el)}
                    onClick={() => seekTo(line.time)}
                    className="cursor-pointer transition-all duration-300 py-2 leading-tight"
                    style={{
                      fontSize: isActive ? '2rem' : '1.5rem',
                      fontWeight: 700,
                      letterSpacing: '-0.02em',
                      color: isActive ? '#fff' : 'rgba(255,255,255,0.3)',
                    }}
                  >
                    {line.text}
                  </p>
                );
              })
            ) : (
              <div className="text-center py-12 px-4" style={{ color: '#b3b3b3' }}>
                <ListMusic size={48} className="mx-auto mb-4 text-[#1DB954] opacity-60" />
                <p className="font-extrabold text-white text-lg mb-1">لا توجد كلمات لهذه الأغنية</p>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto mb-6">
                  يمكنك البحث عنها تلقائيًا من قاعدة بيانات LRCLIB.net أو إضافتها وتنسيق توقيتاتها يدويًا.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={handleGenerateLyrics}
                    disabled={isGeneratingLyrics}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs rounded-full shadow-lg shadow-[#1DB954]/25 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isGeneratingLyrics ? (
                      <><Loader2 size={16} className="animate-spin" /><span>جاري البحث في LRCLIB...</span></>
                    ) : (
                      <><Search size={16} /><span>🎵 بحث في LRCLIB.net</span></>
                    )}
                  </button>

                  <button
                    onClick={openManualEdit}
                    className="inline-flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-extrabold text-xs rounded-full shadow-lg transition-all active:scale-95"
                  >
                    <Edit3 size={16} className="text-amber-400" />
                    <span>✏️ إضافة / تعديل الكلمات يدويًا</span>
                  </button>
                </div>
              </div>
            )}

            {/* Manual Edit Lyrics Modal Overlay */}
            {isManualEditOpen && (
              <div className="fixed inset-0 z-[400] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
                <div className="bg-[#181818] border border-white/15 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-left">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                    <div className="flex items-center gap-2">
                      <Edit3 size={20} className="text-amber-400" />
                      <h3 className="text-base font-bold text-white">إضافة وتعديل الكلمات يدويًا</h3>
                    </div>
                    <button onClick={() => setIsManualEditOpen(false)} className="text-zinc-400 hover:text-white">
                      <X size={20} />
                    </button>
                  </div>

                  <p className="text-xs text-zinc-400 mb-2 leading-relaxed">
                    اكتب أو الصق الكلمات هنا. يمكنك إضافة توقيتات مثل <code className="bg-white/10 px-1 py-0.5 rounded text-amber-300">[0:15]</code> قبل كل سطر، أو كتابة سطور عادية وسيقوم النظام بتوزيع التوقيتات تلقائيًا.
                  </p>

                  <textarea
                    rows={10}
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    placeholder="[0:00] السطر الأول&#10;[0:12] السطر الثاني&#10;أو اكتب سطورًا عادية بدون توقيت..."
                    className="w-full bg-zinc-900 border border-white/15 rounded-2xl p-4 text-xs font-mono text-white focus:outline-none focus:border-[#1DB954] mb-4 resize-none leading-relaxed"
                  />

                  <div className="flex gap-3">
                    <button
                      onClick={handleSaveManualLyrics}
                      disabled={isSavingManualLyrics}
                      className="flex-1 py-3 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold rounded-full text-xs shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSavingManualLyrics ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      <span>حفظ الكلمات والتوقيتات</span>
                    </button>
                    <button
                      onClick={() => setIsManualEditOpen(false)}
                      className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-extrabold rounded-full text-xs transition-all"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── QUEUE TAB ─── */}
        {activeTab === 'queue' && (
          <div className="flex-1 overflow-y-auto">
            <p className="text-xs font-bold uppercase tracking-wider mb-4 pb-3" 
              style={{ color: '#b3b3b3', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              Now in queue — {queue.length} songs
            </p>
            {queue.map((track, i) => {
              const isActive = track.id === currentTrack.id;
              return (
                <div 
                  key={`${track.id}-${i}`}
                  onClick={() => !isActive && handleQueueTrackClick(track)}
                  className="flex items-center gap-3 py-2 px-2 rounded-md cursor-pointer hover:bg-white/10 active:bg-white/15 transition-colors"
                  style={isActive ? { background: 'rgba(255,255,255,0.07)' } : {}}
                >
                  <div className="relative shrink-0">
                    <img src={track.cover} alt={track.title} className="w-10 h-10 rounded object-cover shadow-md" />
                    {isActive && (
                      <div className="absolute inset-0 bg-black/40 rounded flex items-center justify-center">
                        <div className="flex items-end gap-0.5 h-4">
                          <div className="sp-eq-bar" />
                          <div className="sp-eq-bar" />
                          <div className="sp-eq-bar" />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 truncate">
                    <p className="text-sm font-semibold truncate" style={{ color: isActive ? '#1DB954' : 'white' }}>
                      {track.title}
                    </p>
                    <p className="text-xs truncate" style={{ color: '#b3b3b3' }}>{track.artist}</p>
                  </div>
                  {!isActive && (
                    <Play size={14} className="text-zinc-500 shrink-0 opacity-0 group-hover:opacity-100" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm Clear Lyrics Modal */}
      <ConfirmModal
        isOpen={isClearLyricsConfirmOpen}
        title="مسح الكلمات المحفوظة؟"
        message="سيتم حذف الكلمات الحالية لهذه الأغنية من قاعدة البيانات حتى تتمكن من إضافتها أو البحث عنها من جديد."
        confirmText="مسح الكلمات"
        cancelText="إلغاء"
        onConfirm={executeClearLyrics}
        onCancel={() => setIsClearLyricsConfirmOpen(false)}
      />
    </div>
  );
}
