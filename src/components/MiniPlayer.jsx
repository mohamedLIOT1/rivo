import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart, Maximize2, PlusCircle, Volume2, VolumeX, Laptop2, Radio, Sparkles, Sliders } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioContext';

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
  currentTime: propCurrentTime,
  duration: propDuration,
  seekTo: propSeekTo,
  volume = 0.8,
  setVolume = () => {},
  jamSession,
  openJamModal
}) {
  const audio = useAudioPlayer();
  const currentTime = propCurrentTime !== undefined ? propCurrentTime : (audio?.currentTime || 0);
  const duration = propDuration !== undefined ? propDuration : (audio?.duration || 210);
  const seekTo = propSeekTo || audio?.seekTo;
  if (!currentTrack) return null;

  const isTrackLiked = likedTrackIds.some(id => String(id) === String(currentTrack?.id) || String(id) === String(currentTrack?._id)) || Boolean(currentTrack?.liked);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (secs) => {
    if (!secs || isNaN(secs) || secs < 0 || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    /* ── Spotify Now Playing Bar ── */
    <div 
      className="fixed z-50 select-none transition-all duration-200
        bottom-[68px] left-2 right-2 h-14 rounded-lg bg-[#212121]/95 backdrop-blur-md border border-white/10 shadow-2xl
        md:bottom-0 md:left-0 md:right-0 md:h-[var(--player-height)] md:rounded-none md:bg-[#181818] md:border-t md:border-b-0 md:border-x-0 md:border-white/10"
    >
      {/* Progress Line */}
      <div 
        className="absolute left-0 h-[2px] transition-all duration-200 bottom-0 rounded-b-lg md:bottom-auto md:top-0 md:rounded-none"
        style={{ 
          width: `${progressPercent}%`, 
          background: 'linear-gradient(to right, #1DB954, #1ed760)',
          boxShadow: '0 0 6px rgba(29,185,84,0.5)'
        }} 
      />

      <div className="flex items-center h-full px-3 md:px-4 gap-2 md:gap-4">
        
        {/* ─────────────────────────────────────────
            LEFT: Track Info
            ───────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 md:gap-3 flex-1 min-w-0 md:max-w-[30%]">
          {/* Album Art — click to open full player */}
          <div 
            className="relative shrink-0 cursor-pointer group"
            onClick={openFullPlayer}
          >
            <img 
              src={currentTrack.cover} 
              alt={currentTrack.title} 
              className={`w-10 h-10 md:w-14 md:h-14 object-cover rounded shadow-lg transition-all duration-300 ${isPlaying ? 'shadow-[0_0_12px_rgba(29,185,84,0.25)]' : ''}`}
            />
            {/* Equalizer overlay when playing */}
            {isPlaying && (
              <div className="absolute inset-0 bg-black/30 rounded flex items-center justify-center gap-0.5">
                <div className="sp-eq-bar" style={{ height: '8px' }} />
                <div className="sp-eq-bar" style={{ height: '14px' }} />
                <div className="sp-eq-bar" style={{ height: '6px' }} />
              </div>
            )}
          </div>

          {/* Track Title + Artist */}
          <div className="truncate min-w-0 cursor-pointer flex-1" onClick={openFullPlayer}>
            <p className="text-sm font-semibold text-white truncate hover:underline">
              {currentTrack.title}
            </p>
            <p className="text-xs truncate hover:underline text-[#b3b3b3]">
              {currentTrack.artist}
            </p>
          </div>

          {/* Like Button */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleLike(currentTrack.id || currentTrack._id); }}
            className="shrink-0 p-1.5 transition-all hover:scale-110 active:scale-95"
            title={isTrackLiked ? 'Remove from Liked Songs' : 'Save to Liked Songs'}
          >
            <Heart 
              size={18} 
              className={isTrackLiked ? 'fill-[#1DB954] text-[#1DB954]' : 'text-[#b3b3b3] hover:text-white'}
            />
          </button>
        </div>

        {/* ─────────────────────────────────────────
            CENTER: Transport Controls + Seekbar (DESKTOP ONLY)
            ───────────────────────────────────────── */}
        <div className="hidden md:flex flex-col items-center gap-1 flex-1" style={{ maxWidth: '40%' }}>
          {/* Control Buttons */}
          <div className="flex items-center gap-4">
            {/* Shuffle */}
            <button
              onClick={(e) => { e.stopPropagation(); toggleShuffle?.(); }}
              className={`flex transition-all hover:scale-105 active:scale-95 relative ${isShuffle ? 'text-[#1DB954]' : 'text-[#b3b3b3] hover:text-white'}`}
              title={isShuffle === 'smart' ? 'Smart Shuffle (AI ✨)' : isShuffle ? 'Shuffle On' : 'Shuffle Off'}
            >
              <Shuffle size={16} />
              {isShuffle === 'smart' ? (
                <Sparkles size={9} className="absolute -top-1 -right-1 text-emerald-400 fill-emerald-400 animate-pulse" />
              ) : isShuffle ? (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1DB954] rounded-full" />
              ) : null}
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
              className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-md cursor-pointer"
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
              className={`flex transition-all hover:scale-105 active:scale-95 relative ${isRepeat ? 'text-[#1DB954]' : 'text-[#b3b3b3] hover:text-white'}`}
              title="Repeat"
            >
              <Repeat size={16} />
              {isRepeat && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-[#1DB954] rounded-full" />
              )}
            </button>

            {/* Spotify DJ Mix Toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); audio?.setIsMixMode?.(prev => !prev); }}
              className={`flex transition-all hover:scale-105 active:scale-95 relative ${audio?.isMixMode ? 'text-[#1DB954]' : 'text-[#b3b3b3] hover:text-white'}`}
              title={audio?.isMixMode ? "Spotify DJ Mix ON (Auto Transitions Active)" : "Turn on Spotify DJ Mix (Auto Transitions)"}
            >
              <Sliders size={16} />
              {audio?.isMixMode && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-[#1DB954] rounded-full shadow-[0_0_6px_#1DB954]" />
              )}
            </button>
          </div>

          {/* Seekbar Row (Desktop) */}
          <div className="flex items-center gap-2 w-full max-w-sm">
            <span className="text-[11px] shrink-0 tabular-nums text-[#b3b3b3]">
              {formatTime(currentTime)}
            </span>
            <div className="flex-1 group relative h-1 flex items-center">
              <div className="absolute inset-0 rounded-full overflow-hidden bg-[#535353]">
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
                onChange={(e) => {
                  e.stopPropagation();
                  seekTo?.(Number(e.target.value));
                }}
                className="absolute inset-0 w-full opacity-0 cursor-pointer"
                style={{ height: '100%' }}
              />
            </div>
            <span className="text-[11px] shrink-0 tabular-nums text-[#b3b3b3]">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* ─────────────────────────────────────────
            RIGHT: Volume + Tools (DESKTOP ONLY)
            ───────────────────────────────────────── */}
        <div className="hidden md:flex items-center gap-3 flex-1 justify-end" style={{ maxWidth: '35%' }}>
          {/* Jam Session Indicator on Desktop */}
          {jamSession && (
            <button
              onClick={(e) => { e.stopPropagation(); openJamModal?.(); }}
              className="px-2.5 py-1 rounded-full bg-gradient-to-r from-cyan-950 to-zinc-900 border border-cyan-500/40 text-cyan-300 text-xs font-bold flex items-center gap-1.5 hover:border-cyan-400 transition-colors shadow-md shrink-0"
              title="Spotify Jam Active"
            >
              <Radio size={12} className="text-cyan-400 animate-pulse shrink-0" />
              <span>Jam ({jamSession.members?.length || 1})</span>
            </button>
          )}

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

        {/* ─────────────────────────────────────────
            MOBILE-ONLY: Play + Next Controls
            ───────────────────────────────────────── */}
        <div className="md:hidden flex items-center gap-2 shrink-0">
          {jamSession && (
            <button
              onClick={(e) => { e.stopPropagation(); openJamModal?.(); }}
              className="p-1.5 text-cyan-400 rounded-full hover:bg-white/10 active:scale-95"
              title="Jam Session Active"
            >
              <Radio size={18} className="animate-pulse text-cyan-400" />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center transition-transform active:scale-95 shadow-md cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying 
              ? <Pause size={18} fill="black" /> 
              : <Play size={18} fill="black" className="ml-0.5" />
            }
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); playNext?.(); }}
            className="p-1.5 text-zinc-300 hover:text-white transition-all active:scale-95 cursor-pointer"
            title="Next Track"
          >
            <SkipForward size={22} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}
