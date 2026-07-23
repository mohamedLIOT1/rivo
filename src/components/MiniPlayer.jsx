import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart, Maximize2, PlusCircle, Volume2, VolumeX, Laptop2 } from 'lucide-react';

export default function MiniPlayer({
  currentTrack,
  isPlaying,
  togglePlay,
  playNext,
  playPrev,
  isShuffle,
  toggleShuffle,
  isRepeat,
  toggleRepeat,
  toggleLike,
  likedTrackIds = [],
  openFullPlayer,
  openAddToPlaylist,
  currentTime,
  duration,
  volume = 0.8,
  setVolume = () => {}
}) {
  if (!currentTrack) return null;

  const isTrackLiked = likedTrackIds.some(id => String(id) === String(currentTrack?.id) || String(id) === String(currentTrack?._id)) || Boolean(currentTrack?.liked);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (secs) => {
    if (!secs || isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    /* ── Spotify Now Playing Bar ── */
    <div 
      className="fixed left-0 right-0 z-50 select-none"
      style={{ 
        bottom: 0,
        height: 'var(--player-height)',
        background: '#181818',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Progress Line at Top */}
      <div 
        className="absolute top-0 left-0 h-[2px] transition-all duration-200"
        style={{ 
          width: `${progressPercent}%`, 
          background: 'linear-gradient(to right, #1DB954, #1ed760)',
          boxShadow: '0 0 6px rgba(29,185,84,0.5)'
        }} 
      />

      <div className="flex items-center h-full px-4 gap-4">
        
        {/* ─────────────────────────────────────────
            LEFT: Track Info
            ───────────────────────────────────────── */}
        <div className="flex items-center gap-3 flex-1 min-w-0" style={{ maxWidth: '30%' }}>
          {/* Album Art — click to open full player */}
          <div 
            className="relative shrink-0 cursor-pointer group"
            onClick={openFullPlayer}
          >
            <img 
              src={currentTrack.cover} 
              alt={currentTrack.title} 
              className={`w-14 h-14 object-cover rounded shadow-lg transition-all duration-300 ${isPlaying ? 'shadow-[0_0_12px_rgba(29,185,84,0.25)]' : ''}`}
            />
            {/* Equalizer overlay when playing */}
            {isPlaying && (
              <div className="absolute inset-0 bg-black/30 rounded flex items-center justify-center gap-0.5">
                <div className="sp-eq-bar" style={{ height: '10px' }} />
                <div className="sp-eq-bar" style={{ height: '16px' }} />
                <div className="sp-eq-bar" style={{ height: '8px' }} />
              </div>
            )}
          </div>

          {/* Track Title + Artist */}
          <div className="truncate min-w-0 cursor-pointer" onClick={openFullPlayer}>
            <p className="text-sm font-semibold text-white truncate hover:underline">
              {currentTrack.title}
            </p>
            <p className="text-xs truncate hover:underline" style={{ color: '#b3b3b3' }}>
              {currentTrack.artist}
            </p>
          </div>

          {/* Like Button */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleLike(currentTrack.id); }}
            className="shrink-0 transition-all hover:scale-110 active:scale-95 hidden sm:flex"
            title={isTrackLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
          >
            <Heart 
              size={16} 
              className={isTrackLiked ? 'fill-white text-white' : 'text-[#b3b3b3] hover:text-white'}
            />
          </button>
        </div>

        {/* ─────────────────────────────────────────
            CENTER: Transport Controls + Seekbar
            ───────────────────────────────────────── */}
        <div className="flex flex-col items-center gap-1 flex-1" style={{ maxWidth: '40%' }}>
          {/* Control Buttons */}
          <div className="flex items-center gap-4">
            {/* Shuffle */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleShuffle?.(); }}
              className={`hidden sm:flex transition-all hover:scale-105 active:scale-95 relative ${isShuffle ? 'text-[#1DB954]' : 'text-[#b3b3b3] hover:text-white'}`}
              title="Shuffle"
            >
              <Shuffle size={16} />
              {isShuffle && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1DB954] rounded-full" />
              )}
            </button>

            {/* Prev */}
            <button
              onClick={(e) => { e.stopPropagation(); playPrev?.(); }}
              className="text-[#b3b3b3] hover:text-white transition-all hover:scale-105 active:scale-95"
              title="Previous"
            >
              <SkipBack size={20} fill="currentColor" />
            </button>

            {/* Play/Pause — Big Green Circle */}
            <button
              onClick={(e) => { e.stopPropagation(); togglePlay(); }}
              className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-md"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying 
                ? <Pause size={16} fill="black" /> 
                : <Play size={16} fill="black" className="ml-0.5" />
              }
            </button>

            {/* Next */}
            <button
              onClick={(e) => { e.stopPropagation(); playNext?.(); }}
              className="text-[#b3b3b3] hover:text-white transition-all hover:scale-105 active:scale-95"
              title="Next"
            >
              <SkipForward size={20} fill="currentColor" />
            </button>

            {/* Repeat */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleRepeat?.(); }}
              className={`hidden sm:flex transition-all hover:scale-105 active:scale-95 relative ${isRepeat ? 'text-[#1DB954]' : 'text-[#b3b3b3] hover:text-white'}`}
              title="Repeat"
            >
              <Repeat size={16} />
              {isRepeat && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1DB954] rounded-full" />
              )}
            </button>
          </div>

          {/* Seekbar Row (Desktop) */}
          <div className="hidden md:flex items-center gap-2 w-full max-w-sm">
            <span className="text-[11px] shrink-0 tabular-nums" style={{ color: '#b3b3b3' }}>
              {formatTime(currentTime)}
            </span>
            <div className="flex-1 group relative h-1 flex items-center">
              <div className="absolute inset-0 rounded-full overflow-hidden" style={{ background: '#535353' }}>
                <div 
                  className="h-full bg-white group-hover:bg-[#1DB954] transition-colors rounded-full"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <input
                type="range"
                min="0"
                max={duration || 100}
                value={currentTime || 0}
                onChange={(e) => {}}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
                style={{ height: '100%' }}
              />
            </div>
            <span className="text-[11px] shrink-0 tabular-nums" style={{ color: '#b3b3b3' }}>
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* ─────────────────────────────────────────
            RIGHT: Volume + Tools
            ───────────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-3 flex-1 justify-end" style={{ maxWidth: '35%' }}>
          {/* Clear Volume Bar */}
          <div className="flex items-center gap-2 max-w-[130px] flex-1">
            <button 
              onClick={(e) => { e.stopPropagation(); setVolume(volume > 0 ? 0 : 0.8); }}
              className="text-[#b3b3b3] hover:text-white transition-colors p-1"
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
                onChange={(e) => { e.stopPropagation(); setVolume(Number(e.target.value)); }}
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
                style={{ height: '100%' }}
              />
            </div>
          </div>

          {/* Add to Playlist */}
          <button
            onClick={(e) => { e.stopPropagation(); openAddToPlaylist?.(); }}
            className="p-2 rounded text-[#b3b3b3] hover:text-white transition-all hover:scale-105"
            title="Add to playlist"
          >
            <PlusCircle size={16} />
          </button>

          {/* Expand Full Player */}
          <button
            onClick={openFullPlayer}
            className="p-2 rounded text-[#b3b3b3] hover:text-white transition-all hover:scale-105"
            title="Full screen player"
          >
            <Maximize2 size={16} />
          </button>
        </div>

        {/* Mobile-only: Expand + Play buttons */}
        <div className="md:hidden flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center transition-transform active:scale-95"
          >
            {isPlaying 
              ? <Pause size={16} fill="black" /> 
              : <Play size={16} fill="black" className="ml-0.5" />
            }
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); playNext?.(); }}
            className="text-white"
          >
            <SkipForward size={22} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}
