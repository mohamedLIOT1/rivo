import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, 
  Heart, Volume2, VolumeX, Download, Disc, Sparkles, Languages, Loader2,
  MoreHorizontal, ListMusic
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { useAudioPlayer } from '../context/AudioContext';

export default function FullPlayerModal({
  currentTrack,
  isPlaying,
  togglePlay,
  playNext,
  playPrev,
  toggleLike,
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
  openAddToPlaylist
}) {
  // Get audioRef & isYtTrack directly for frame-perfect lyrics sync
  const { audioRef, isYtTrack } = useAudioPlayer();

  const [activeTab, setActiveTab] = useState('player');
  const [isVinylMode, setIsVinylMode] = useState(false);
  const lyricRefs = useRef({});

  // ── RAF-based live time for lyrics sync (reads audio directly at ~60fps) ──
  const [liveTime, setLiveTime] = useState(currentTime);
  const rafRef = useRef(null);
  const ytPlayerRef = useRef(null); // reference to YT player via window

  useEffect(() => {
    if (!isOpen || activeTab !== 'lyrics') {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const tick = () => {
      if (isYtTrack) {
        // YT player: read via window reference
        try {
          const yt = window.__liofyYTPlayer;
          if (yt && typeof yt.getCurrentTime === 'function') {
            setLiveTime(yt.getCurrentTime() || 0);
          } else {
            setLiveTime(t => t); // fallback: keep prop-based currentTime
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



  const rawLyrics = currentTrack && Array.isArray(currentTrack.lyrics) ? currentTrack.lyrics : [];
  const baseLyrics = (showTranslation && translatedLyrics) ? translatedLyrics : rawLyrics;

  const lyrics = baseLyrics;

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
          duration: currentTrack.duration || 180
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.lyrics) && data.lyrics.length > 0) {
        currentTrack.lyrics = data.lyrics;
        setTranslatedLyrics(null);
        setShowTranslation(false);
      }
    } catch (e) {
      console.warn('AI Generate Lyrics error:', e);
    }
    setIsGeneratingLyrics(false);
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

  if (!isOpen || !currentTrack) return null;

  const formatTime = (secs) => {
    if (!secs || isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const trackColor = currentTrack.color || '#1DB954';

  return (
    <div 
      className={`fixed inset-0 z-[300] bg-[#121212] transition-all duration-300 flex flex-col overflow-hidden select-none ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      style={{
        background: '#121212'
      }}
    >
      {/* ── Dynamic Background Gradient ── */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(180deg, ${trackColor}66 0%, ${trackColor}15 45%, #121212 100%)`,
          transition: 'background 1s ease',
        }}
      />
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'rgba(0,0,0,0.5)' }}
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
                  <div className="w-full h-full rounded-lg overflow-hidden shadow-[0_32px_64px_rgba(0,0,0,0.8)]"
                    style={{ borderRadius: '8px' }}
                  >
                    <img 
                      src={currentTrack.cover} 
                      alt={currentTrack.title}
                      className="w-full h-full object-cover"
                      style={{ transition: 'transform 0.3s ease' }}
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
                  title={currentTrack.liked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
                >
                  <Heart 
                    size={28} 
                    className={currentTrack.liked ? 'fill-[#1DB954] text-[#1DB954]' : 'text-[#b3b3b3] hover:text-white'}
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
                  className="absolute top-0 left-0 h-full rounded-full transition-all"
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
                    onClick={() => toggleDownload(currentTrack.id)}
                    className="p-2 transition-all hover:scale-105"
                    title="Download"
                  >
                    <Download 
                      size={18} 
                      style={{ color: currentTrack.downloaded ? '#1DB954' : '#b3b3b3' }}
                    />
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
            className="flex-1 overflow-y-auto rounded-lg py-4 scroll-smooth"
            style={{ scrollbarWidth: 'none' }}
          >
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[#1DB954]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#1DB954]">
                  {showTranslation ? 'Live Synced Lyrics (Arabic AI)' : 'Live Synced Lyrics'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerateLyrics}
                  disabled={isGeneratingLyrics}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-xs font-bold text-white transition-all active:scale-95 disabled:opacity-50"
                  title="Force AI to re-fetch & re-sync lyrics"
                >
                  {isGeneratingLyrics ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Sparkles size={13} className="text-[#1DB954]" />
                  )}
                  <span>{isGeneratingLyrics ? 'Syncing...' : 'AI Sync 🪄'}</span>
                </button>

                <button
                  onClick={handleTranslateLyrics}
                  disabled={isTranslating || !rawLyrics.length}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1DB954]/20 hover:bg-[#1DB954]/30 border border-[#1DB954]/40 rounded-full text-xs font-bold text-[#1DB954] transition-all active:scale-95 disabled:opacity-50"
                >
                  {isTranslating ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Translating...</span>
                    </>
                  ) : (
                    <>
                      <Languages size={13} />
                      <span>{showTranslation ? 'Original' : 'AI Translate 🪄'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>


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
                      transform: isActive ? 'none' : 'none',
                    }}
                  >
                    {line.text}
                  </p>
                );
              })
            ) : (
              <div className="text-center py-16 px-4" style={{ color: '#b3b3b3' }}>
                <ListMusic size={48} className="mx-auto mb-4 text-[#1DB954] opacity-60" />
                <p className="font-extrabold text-white text-base mb-1">No lyrics available for this song</p>
                <p className="text-xs text-zinc-400 max-w-xs mx-auto mb-6">
                  Click below to let AI search, generate & sync timed lyrics for "{currentTrack?.title}"
                </p>
                <button
                  onClick={handleGenerateLyrics}
                  disabled={isGeneratingLyrics}
                  className="inline-flex items-center gap-2 px-5 py-3 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs rounded-full shadow-lg shadow-[#1DB954]/25 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isGeneratingLyrics ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Generating & Syncing Lyrics...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>🪄 Generate & Sync Lyrics with AI</span>
                    </>
                  )}
                </button>
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
                  className="flex items-center gap-3 py-2 px-2 rounded-md cursor-pointer hover:bg-white/5 transition-colors"
                  style={isActive ? { background: 'rgba(255,255,255,0.07)' } : {}}
                >
                  <img src={track.cover} alt={track.title} className="w-10 h-10 rounded object-cover shadow-md" />
                  <div className="flex-1 truncate">
                    <p className="text-sm font-semibold truncate" style={{ color: isActive ? '#1DB954' : 'white' }}>
                      {track.title}
                    </p>
                    <p className="text-xs truncate" style={{ color: '#b3b3b3' }}>{track.artist}</p>
                  </div>
                  {isActive && (
                    <div className="flex items-end gap-0.5 h-4">
                      <div className="sp-eq-bar" />
                      <div className="sp-eq-bar" />
                      <div className="sp-eq-bar" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
