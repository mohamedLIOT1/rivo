import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, 
  Heart, Volume2, VolumeX, Download, Disc, Sparkles, Languages, Loader2,
  MoreHorizontal, ListMusic, Mic, Trash2, SlidersHorizontal, CheckCircle2,
  Edit3, Check, Search, X
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
  jamSession,
  onRemoveFromJamQueue
}) {
  // Get audioRef & isYtTrack directly for frame-perfect lyrics sync
  const { audioRef, isYtTrack, playTrack, currentTime: audioCurrentTime, duration: audioDuration } = useAudioPlayer();

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

  // ── Dynamic background color extracted from album art ──
  const [dynamicColor, setDynamicColor] = useState(null);
  const lastGoodColorRef = useRef(null); // Persists last successfully extracted color

  useEffect(() => {
    if (!currentTrack?.cover) {
      // No cover: use stored color or track.color, but keep lastGoodColor if available
      setDynamicColor(lastGoodColorRef.current || currentTrack?.color || '#1DB954');
      return;
    }
    // Use stored color first for instant display (but keep last good color if cover just changed to a native URI)
    if (currentTrack.color) {
      setDynamicColor(currentTrack.color);
    } else if (lastGoodColorRef.current) {
      // Keep showing last good color while we attempt extraction
      setDynamicColor(lastGoodColorRef.current);
    } else {
      setDynamicColor('#1DB954');
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

  const trackColor = dynamicColor || currentTrack?.color || '#1DB954';

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
      className="flex-1 overflow-y-auto rounded-lg py-4 scroll-smooth relative h-full"
      style={{ scrollbarWidth: 'none' }}
    >
      {lyrics.length === 0 && (
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-[#1DB954]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#1DB954]">
              Song Lyrics
            </span>
          </div>
        </div>
      )}

      {lyrics.length > 0 ? (
        <div className="py-6 px-2 space-y-4">
          {lyrics.map((line, idx) => {
            const isActive = idx === activeLyricIndex;
            return (
              <div 
                key={idx}
                ref={(el) => (lyricRefs.current[idx] = el)}
                onClick={() => seekTo(line.time)}
                className="cursor-pointer transition-all duration-300 py-1"
                style={{
                  transform: isActive ? 'scale(1.03)' : 'scale(1)',
                  transformOrigin: 'left center',
                }}
              >
                <p 
                  className="transition-all duration-300 leading-snug"
                  style={{
                    fontSize: isActive ? '1.85rem' : '1.35rem',
                    fontWeight: isActive ? 900 : 700,
                    letterSpacing: '-0.02em',
                    color: isActive ? '#ffffff' : 'rgba(255, 255, 255, 0.28)',
                    textShadow: isActive ? '0 0 16px rgba(29, 185, 84, 0.5), 0 0 4px rgba(255, 255, 255, 0.8)' : 'none',
                  }}
                >
                  {line.text}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 px-4" style={{ color: '#b3b3b3' }}>
          <ListMusic size={48} className="mx-auto mb-4 text-[#1DB954] opacity-60" />
          <p className="font-extrabold text-white text-lg mb-1">No lyrics available for this song</p>
          <p className="text-xs text-zinc-400 max-w-xs mx-auto mb-6">
            You can search online or enter them manually.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={handleGenerateLyrics}
              disabled={isGeneratingLyrics}
              className="inline-flex items-center gap-2 px-5 py-3 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs rounded-full shadow-lg shadow-[#1DB954]/25 transition-all active:scale-95 disabled:opacity-50"
            >
              {isGeneratingLyrics ? (
                <><Loader2 size={16} className="animate-spin" /><span>Searching...</span></>
              ) : (
                <><Search size={16} /><span>🎵 Search Lyrics</span></>
              )}
            </button>

            <button
              onClick={openManualEdit}
              className="inline-flex items-center gap-2 px-5 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-extrabold text-xs rounded-full shadow-lg transition-all active:scale-95"
            >
              <Edit3 size={16} className="text-amber-400" />
              <span>✏️ Enter Lyrics Manually</span>
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
                <h3 className="text-base font-bold text-white">Add & Edit Lyrics Manually</h3>
              </div>
              <button onClick={() => setIsManualEditOpen(false)} className="text-zinc-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-zinc-400 mb-2 leading-relaxed">
              Type or paste lyrics here. You can add timestamps like <code className="bg-white/10 px-1 py-0.5 rounded text-amber-300">[0:15]</code> before each line, or type plain lines for automatic timestamps.
            </p>

            <textarea
              rows={10}
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="[0:00] First Line&#10;[0:12] Second Line&#10;Or write plain lines without timestamps..."
              className="w-full bg-zinc-900 border border-white/15 rounded-2xl p-4 text-xs font-mono text-white focus:outline-none focus:border-[#1DB954] mb-4 resize-none leading-relaxed"
            />

            <div className="flex gap-3">
              <button
                onClick={handleSaveManualLyrics}
                disabled={isSavingManualLyrics}
                className="flex-1 py-3 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold rounded-full text-xs shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSavingManualLyrics ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                <span>Save Lyrics & Timestamps</span>
              </button>
              <button
                onClick={() => setIsManualEditOpen(false)}
                className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white font-extrabold rounded-full text-xs transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderQueue = () => (
    <div className="flex-1 overflow-y-auto h-full pr-1">
      {jamSession ? (
        <div className="mb-4 pb-3 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <p className="text-xs font-bold uppercase tracking-wider text-cyan-400">
              Jam Linked Queue — {queue.length} songs
            </p>
          </div>
          <span className="text-[10px] font-black bg-cyan-950 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full">
            {jamSession.code}
          </span>
        </div>
      ) : (
        <p className="text-xs font-bold uppercase tracking-wider mb-4 pb-3" 
          style={{ color: '#b3b3b3', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          Now in queue — {queue.length} songs
        </p>
      )}

      {queue.length === 0 ? (
        <div className="py-12 text-center text-zinc-500 text-xs">
          <p>The queue is empty.</p>
          <p className="mt-1 text-zinc-600">Add songs from the library or search to play next.</p>
        </div>
      ) : (
        queue.map((track, i) => {
          const isActive = String(track.id || track._id) === String(currentTrack?.id || currentTrack?._id);
          return (
            <div 
              key={`${track.id || track._id}-${i}`}
              onClick={() => !isActive && handleQueueTrackClick(track)}
              className="flex items-center gap-3 py-2.5 px-3 rounded-xl cursor-pointer hover:bg-white/10 active:bg-white/15 transition-colors group"
              style={isActive ? { background: 'rgba(255,255,255,0.08)' } : {}}
            >
              <div className="relative shrink-0">
                <img src={track.cover} alt={track.title} className="w-11 h-11 rounded-lg object-cover shadow-md" />
                {isActive && (
                  <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center">
                    <div className="flex items-end gap-0.5 h-4">
                      <div className="sp-eq-bar" />
                      <div className="sp-eq-bar" />
                      <div className="sp-eq-bar" />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex-1 truncate">
                <p className="text-sm font-bold truncate" style={{ color: isActive ? '#1DB954' : 'white' }}>
                  {track.title}
                </p>
                <p className="text-xs truncate text-zinc-400 mt-0.5">{track.artist}</p>
              </div>

              {jamSession && onRemoveFromJamQueue && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFromJamQueue(i, track.id || track._id);
                  }}
                  className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove from Jam Queue"
                >
                  <Trash2 size={15} />
                </button>
              )}

              {!isActive && !jamSession && (
                <Play size={14} className="text-zinc-500 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div 
      className={`fixed inset-0 z-[300] transition-all duration-300 flex flex-col overflow-hidden select-none ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      style={{ background: '#121212' }}
    >
      {/* ── Dynamic Glowing Background ── */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 90% 70% at 50% 20%, ${trackColor}55 0%, ${trackColor}15 50%, #121212 90%)`,
          transition: 'background 1.2s ease',
        }}
      />
      <div 
        className="absolute inset-0 pointer-events-none backdrop-blur-3xl"
        style={{ background: 'rgba(0,0,0,0.40)' }}
      />

      {/* ── Top Bar ── */}
      <div className="relative z-10 flex items-center justify-between px-6 py-4 pt-[max(12px,env(safe-area-inset-top))] border-b border-white/5">
        <button 
          onClick={onClose} 
          className="p-2 text-white/80 hover:text-white transition-colors rounded-full hover:bg-white/10"
          title="Minimize"
        >
          <ChevronDown size={24} />
        </button>

        <div className="text-center flex-1 px-4 truncate">
          <p className="text-[11px] font-extrabold tracking-widest uppercase text-white/60">
            Now Playing
          </p>
          <p className="text-sm font-bold text-white truncate mt-0.5">
            {currentTrack.title || 'Unknown Track'}
          </p>
        </div>

        <button
          className="p-2 text-white/80 hover:text-white transition-colors rounded-full hover:bg-white/10"
          title="Options"
          onClick={openAddToPlaylist}
        >
          <MoreHorizontal size={24} />
        </button>
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

        {/* ─── PLAYER COLUMN (Mobile: activeTab === 'player' | Desktop: always visible) ─── */}
        <div className={`flex-1 flex flex-col justify-between max-w-md mx-auto w-full lg:max-w-md lg:h-[530px] ${activeTab === 'player' ? 'flex' : 'hidden lg:flex'}`}>
          {/* Album Artwork */}
          <div className="flex-1 flex items-center justify-center py-4">
            <div className="relative w-full" style={{ maxWidth: 'min(340px, 75vw)', aspectRatio: '1' }}>
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
                  className="w-full h-full overflow-hidden shadow-[0_24px_50px_rgba(0,0,0,0.7)]"
                  style={{ 
                    borderRadius: '16px',
                    transform: isPlaying ? 'scale(1)' : 'scale(0.96)',
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
          <div className="flex items-center justify-between mb-3 mt-2">
            <div className="truncate flex-1 min-w-0">
              <h2 className="text-xl md:text-2xl font-black text-white truncate tracking-tight">
                {currentTrack.title}
              </h2>
              <p className="text-sm md:text-base font-semibold truncate mt-0.5 text-zinc-400">
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
                  size={26} 
                  className={isTrackLiked ? 'fill-[#1DB954] text-[#1DB954]' : 'text-zinc-400 hover:text-white'}
                />
              </button>
            </div>
          </div>

          {/* Seekbar */}
          <div className="mb-3 group">
            <div 
              className="relative h-1.5 w-full rounded-full overflow-visible cursor-pointer bg-white/20"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const pct = Math.max(0, Math.min(1, x / rect.width));
                seekTo(pct * activeDuration);
              }}
            >
              <div 
                className="absolute top-0 left-0 h-full rounded-full bg-white group-hover:bg-[#1DB954] transition-colors"
                style={{ 
                  width: `${progressPercent}%`, 
                  transition: 'width 0.1s linear'
                }}
              />
              <div 
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                style={{ left: `calc(${progressPercent}% - 7px)` }}
              />
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-xs tabular-nums text-zinc-400">{formatTime(activeTime)}</span>
              <span className="text-xs tabular-nums text-zinc-400">{formatTime(activeDuration)}</span>
            </div>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center justify-between mb-3">
            <button 
              onClick={toggleShuffle} 
              className="p-2 relative transition-all hover:scale-110"
              title={isShuffle === 'smart' ? 'Smart Shuffle (AI ✨)' : isShuffle ? 'Shuffle On' : 'Shuffle Off'}
            >
              <Shuffle 
                size={20} 
                style={{ color: isShuffle ? '#1DB954' : '#b3b3b3' }}
              />
              {isShuffle === 'smart' ? (
                <Sparkles size={11} className="absolute -top-0.5 -right-0.5 text-emerald-400 fill-emerald-400 animate-pulse" />
              ) : isShuffle ? (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1DB954] rounded-full" />
              ) : null}
            </button>

            <button 
              onClick={playPrev} 
              className="p-2 text-white hover:scale-110 active:scale-95 transition-transform"
            >
              <SkipBack size={30} fill="white" />
            </button>

            <button 
              onClick={togglePlay} 
              className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-2xl"
            >
              {isPlaying 
                ? <Pause size={24} fill="black" /> 
                : <Play size={24} fill="black" className="ml-1" />
              }
            </button>

            <button 
              onClick={playNext} 
              className="p-2 text-white hover:scale-110 active:scale-95 transition-transform"
            >
              <SkipForward size={30} fill="white" />
            </button>

            <button 
              onClick={toggleRepeat} 
              className="p-2 relative transition-all hover:scale-110"
              title="Repeat"
            >
              <Repeat 
                size={20} 
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
            <div className="flex items-center gap-3 flex-1 max-w-[220px] bg-white/5 py-2 px-3.5 rounded-full border border-white/10">
              <button 
                onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
                className="text-zinc-400 hover:text-white transition-colors shrink-0"
                title={volume > 0 ? "Mute" : "Unmute"}
              >
                {volume > 0 ? <Volume2 size={16} /> : <VolumeX size={16} className="text-red-400" />}
              </button>
              <div className="flex-1 group relative h-2 cursor-pointer flex items-center">
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
              <span className="text-[10px] font-bold text-zinc-400 w-7 text-right">
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

        {/* ─── MOBILE LYRICS TAB ─── */}
        {activeTab === 'lyrics' && (
          <div className="lg:hidden flex-1 flex flex-col overflow-hidden w-full max-w-md mx-auto">
            {renderLyrics()}
          </div>
        )}

        {/* ─── MOBILE QUEUE TAB ─── */}
        {activeTab === 'queue' && (
          <div className="lg:hidden flex-1 flex flex-col overflow-hidden w-full max-w-md mx-auto">
            {renderQueue()}
          </div>
        )}

        {/* ─── DESKTOP RIGHT PANEL (Lyrics & Queue) ─── */}
        <div className="hidden lg:flex flex-1 h-[530px] bg-black/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-6 flex-col overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setDesktopSideTab('lyrics')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  desktopSideTab === 'lyrics' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Lyrics
              </button>
              <button
                onClick={() => setDesktopSideTab('queue')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                  desktopSideTab === 'queue' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
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
                      className={`p-1.5 rounded-full transition-all text-xs flex items-center gap-1 ${
                        showTranslation ? 'text-[#1DB954] bg-[#1DB954]/15' : 'text-zinc-400 hover:text-white'
                      }`}
                      title="Translate Lyrics"
                    >
                      <Languages size={15} />
                    </button>
                    <button
                      onClick={openManualEdit}
                      className="p-1.5 text-zinc-400 hover:text-white rounded-full transition-colors"
                      title="Edit Lyrics"
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => setIsClearLyricsConfirmOpen(true)}
                      className="p-1.5 text-zinc-400 hover:text-red-400 rounded-full transition-colors"
                      title="Clear Lyrics"
                    >
                      <Trash2 size={15} />
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
