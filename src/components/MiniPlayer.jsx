import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart, Maximize2, Volume2, VolumeX, FileText, PlusCircle } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioContext';
import { ArtistLinks } from '../utils/artistUtils';
import { isQuranContent } from '../utils/quranUtils';

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
  openJamModal,
  onSelectArtist,
  globalTheme = 'dark',
}) {
  const isDark = globalTheme === 'dark';
  const audio = useAudioPlayer();
  const currentTime = propCurrentTime !== undefined ? propCurrentTime : (audio?.currentTime || 0);
  const duration = propDuration !== undefined ? propDuration : (audio?.duration || 210);
  const seekTo = propSeekTo || audio?.seekTo;

  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);

  if (!currentTrack) return null;

  const isQuran = isQuranContent(currentTrack);
  const isTrackLiked = likedTrackIds.some(id => String(id) === String(currentTrack?.id) || String(id) === String(currentTrack?._id)) || Boolean(currentTrack?.liked);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPercent, setScrubPercent] = useState(0);

  const activeDuration = (duration > 0 && isFinite(duration)) ? duration : (currentTrack?.duration || 210);
  const realPercent = activeDuration > 0 ? (currentTime / activeDuration) * 100 : 0;
  const progressPercent = isScrubbing ? scrubPercent : realPercent;

  const formatTime = (secs) => {
    if (!secs || isNaN(secs) || secs < 0 || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const seekFromClientX = (clientX, targetRect) => {
    if (!targetRect || targetRect.width <= 0) return;
    const clickX = clientX - targetRect.left;
    const pct = Math.max(0, Math.min(1, clickX / targetRect.width));
    const targetSec = pct * activeDuration;
    setScrubPercent(pct * 100);
    if (seekTo) seekTo(targetSec);
  };

  const handleDesktopPointerDown = (e) => {
    e.preventDefault();
    setIsScrubbing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    seekFromClientX(e.clientX, rect);
  };

  const handleDesktopPointerMove = (e) => {
    if (!isScrubbing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    seekFromClientX(e.clientX, rect);
  };

  const handleDesktopPointerUp = (e) => {
    if (isScrubbing) {
      setIsScrubbing(false);
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    }
  };

  const handleMobilePointerDown = (e) => {
    e.preventDefault();
    setIsScrubbing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    seekFromClientX(e.clientX, rect);
  };

  const handleMobilePointerMove = (e) => {
    if (!isScrubbing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    seekFromClientX(e.clientX, rect);
  };

  const handleMobilePointerUp = (e) => {
    if (isScrubbing) {
      setIsScrubbing(false);
      try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (seekTo) seekTo(Math.max(0, currentTime - 5));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (seekTo) seekTo(Math.min(activeDuration, currentTime + 5));
    } else if (e.key === 'Home') {
      e.preventDefault();
      if (seekTo) seekTo(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      if (seekTo) seekTo(activeDuration);
    }
  };

  const [isVolScrubbing, setIsVolScrubbing] = useState(false);

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

  return (
    <>
      {/* ── PERSISTENT CASSETTE DECK PLAYER (Bottom Bar) ── */}
      <footer 
        className={`fixed bottom-[52px] md:bottom-0 inset-x-0 brutal-border-thick border-x-0 border-b-0 px-3 py-1.5 md:p-3.5 z-40 brutal-shadow-lg select-none h-[62px] md:h-[var(--player-height)] transition-colors ${
          isDark 
            ? 'bg-[#101716] border-zinc-800 text-white' 
            : 'bg-[#fdfbf7] border-black text-[#0b1110]'
        }`}
      >
        {/* Mobile Scrubber Line (generous 32px touch & drag hitbox) */}
        <div 
          role="slider"
          aria-label="Seek track"
          className="md:hidden absolute -top-3.5 inset-x-0 h-8 pt-3.5 cursor-pointer z-30 flex items-start touch-none select-none"
          onPointerDown={handleMobilePointerDown}
          onPointerMove={handleMobilePointerMove}
          onPointerUp={handleMobilePointerUp}
          onPointerCancel={handleMobilePointerUp}
        >
          <div className={`w-full h-[4px] overflow-hidden pointer-events-none ${isDark ? 'bg-zinc-800' : 'bg-[#ded2bb]'}`}>
            <div 
              className="h-full bg-[#17a398] transition-all pointer-events-none"
              style={{ width: `${isNaN(progressPercent) ? 0 : Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
        </div>

        {/* ─────────────────────────────────────────
            MOBILE COMPACT ROW (< md)
            ───────────────────────────────────────── */}
        <div className="flex md:hidden items-center justify-between w-full h-full gap-2">
          {/* Track Info (Tapping opens Full Player) */}
          <div 
            onClick={openFullPlayer}
            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer pr-1"
          >
            <div className="w-10 h-10 rounded-lg bg-[#0b1110] text-[#17a398] brutal-border flex items-center justify-center shrink-0 overflow-hidden brutal-shadow-sm">
              {currentTrack.cover ? (
                <img 
                  src={currentTrack.cover} 
                  alt={currentTrack.title} 
                  className="w-full h-full object-cover" 
                />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                  <circle cx="8" cy="10" r="2"></circle>
                  <circle cx="16" cy="10" r="2"></circle>
                  <path d="M8 14h8"></path>
                </svg>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <h4 className={`font-display font-black text-xs truncate leading-tight ${
                isDark ? 'text-zinc-100' : 'text-[#0b1110]'
              }`}>
                {currentTrack.title}
              </h4>
              <ArtistLinks
                track={currentTrack}
                onSelectArtist={onSelectArtist}
                className={`text-[10px] font-bold truncate mt-0.5 block ${
                  isDark ? 'text-zinc-400' : 'text-zinc-600'
                }`}
                linkClassName="hover:underline cursor-pointer"
              />
            </div>
          </div>

          {/* Mobile Action Controls */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                toggleLike(currentTrack.id || currentTrack._id);
              }}
              className={`p-1.5 cursor-pointer ${
                isTrackLiked ? 'text-[#dc2626]' : 'text-zinc-400 hover:text-[#dc2626]'
              }`}
            >
              <Heart size={18} fill={isTrackLiked ? 'currentColor' : 'none'} strokeWidth={2.5} />
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="w-9 h-9 rounded-xl bg-[#17a398] text-[#0b1110] brutal-border flex items-center justify-center brutal-shadow-sm brutal-btn cursor-pointer"
            >
              {isPlaying 
                ? <Pause size={17} fill="currentColor" /> 
                : <Play size={17} fill="currentColor" className="ml-0.5" />
              }
            </button>
          </div>
        </div>

        {/* =========================================
            DESKTOP PLAYER LAYOUT
            ========================================= */}
        <div className="hidden md:flex items-center justify-between h-full px-6 gap-4">
          
          {/* LEFT: Cover art & track metadata */}
          <div className="flex items-center gap-3.5 w-3/12 min-w-0">
            <div 
              onClick={openFullPlayer} 
              className="relative w-12 h-12 rounded-xl brutal-border overflow-hidden shrink-0 group cursor-pointer"
            >
              <img 
                src={currentTrack.cover} 
                alt={currentTrack.title} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Maximize2 size={16} className="text-white" />
              </div>
            </div>

            <div 
              onClick={openFullPlayer} 
              className="min-w-0 flex-1 cursor-pointer select-none"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-[8px] font-mono font-bold bg-[#17a398] text-[#0b1110] px-1 py-0.2 rounded brutal-border">
                  {currentTrack.genre || 'STEREO'}
                </span>
              </div>
              <h4 className={`font-display font-black text-xs sm:text-sm truncate leading-tight mt-0.5 hover:underline ${
                isDark ? 'text-zinc-100' : 'text-[#0b1110]'
              }`}>
                {currentTrack.title}
              </h4>
              <ArtistLinks
                track={currentTrack}
                onSelectArtist={onSelectArtist}
                className={`text-[10px] sm:text-[11px] font-bold truncate block ${
                  isDark ? 'text-zinc-400' : 'text-zinc-600'
                }`}
                linkClassName="hover:underline cursor-pointer"
              />
            </div>

            {/* Favorite Heart Button */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                toggleLike(currentTrack.id || currentTrack._id);
              }}
              className={`p-1.5 transition-transform hover:scale-110 active:scale-95 cursor-pointer ${
                isTrackLiked ? 'text-[#dc2626]' : 'text-zinc-400 hover:text-[#dc2626]'
              }`}
              title={isTrackLiked ? (isQuran ? "Saved in Favorites" : "Saved in Liked Songs") : (isQuran ? "Save to Favorites" : "Save to Liked Songs")}
            >
              <Heart size={18} fill={isTrackLiked ? 'currentColor' : 'none'} strokeWidth={2.5} />
            </button>

            {/* Song details modal trigger */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsPrescriptionModalOpen(true);
              }}
              className={`p-1.5 transition cursor-pointer ${
                isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 hover:text-black'
              }`} 
              title={isQuran ? "View Surah Details" : "View Song Details"}
            >
              <FileText size={18} strokeWidth={2.5} />
            </button>

            {/* Add to Playlist button */}
            {openAddToPlaylist && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  openAddToPlaylist();
                }}
                className={`p-1.5 transition cursor-pointer ${
                  isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 hover:text-black'
                }`} 
                title={isQuran ? "Add to Quran Playlist" : "Add to Playlist"}
              >
                <PlusCircle size={18} strokeWidth={2.5} />
              </button>
            )}
          </div>

          {/* CENTER: Cassette Controls & Progress Scrubber */}
          <div className="w-5/12 flex flex-col items-center gap-1">
            {/* Control buttons */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button 
                onClick={toggleShuffle}
                className={`p-1.5 transition cursor-pointer ${
                  isShuffle ? 'text-[#17a398] font-bold' : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-black'
                }`} 
                title="Random Shuffle"
              >
                <Shuffle size={15} strokeWidth={2.5} />
              </button>

              <button 
                onClick={playPrev}
                className={`w-8 h-8 rounded-lg brutal-border flex items-center justify-center brutal-shadow-sm brutal-btn cursor-pointer ${
                  isDark 
                    ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200' 
                    : 'bg-white hover:bg-[#ede5d3] text-[#0b1110]'
                }`} 
                title="Previous Track"
              >
                <SkipBack size={15} className={isDark ? 'text-zinc-200' : 'text-[#0b1110]'} fill="currentColor" />
              </button>

              <button 
                onClick={togglePlay}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border-thick flex items-center justify-center brutal-shadow brutal-btn cursor-pointer" 
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <Pause size={18} fill="currentColor" />
                ) : (
                  <Play size={18} fill="currentColor" className="ml-0.5" />
                )}
              </button>

              <button 
                onClick={playNext}
                className={`w-8 h-8 rounded-lg brutal-border flex items-center justify-center brutal-shadow-sm brutal-btn cursor-pointer ${
                  isDark 
                    ? 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200' 
                    : 'bg-white hover:bg-[#ede5d3] text-[#0b1110]'
                }`} 
                title="Next Track"
              >
                <SkipForward size={15} className={isDark ? 'text-zinc-200' : 'text-[#0b1110]'} fill="currentColor" />
              </button>

              <button 
                onClick={toggleRepeat}
                className={`p-1.5 transition cursor-pointer ${
                  isRepeat ? 'text-[#dc2626] font-bold' : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-black'
                }`} 
                title="Repeat Dose"
              >
                <Repeat size={15} strokeWidth={2.5} />
              </button>
            </div>

            {/* Progress bar & time */}
            <div className={`w-full flex items-center gap-2 text-[10px] sm:text-[11px] font-mono font-bold ${
              isDark ? 'text-zinc-400' : 'text-zinc-700'
            }`}>
              <span className="w-8 text-right tabular-nums">{formatTime(currentTime)}</span>
              <div 
                role="slider"
                tabIndex={0}
                aria-label="Seek track"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progressPercent)}
                onKeyDown={handleKeyDown}
                className="relative flex-1 group h-8 flex items-center cursor-pointer select-none py-2 touch-none focus:outline-none"
                onPointerDown={handleDesktopPointerDown}
                onPointerMove={handleDesktopPointerMove}
                onPointerUp={handleDesktopPointerUp}
                onPointerCancel={handleDesktopPointerUp}
              >
                {/* Track background & vibrant active fill */}
                <div className={`w-full h-2 group-hover:h-2.5 rounded-full overflow-hidden brutal-border transition-all pointer-events-none ${
                  isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-[#ede5d3]'
                }`}>
                  <div 
                    className="h-full bg-[#17a398] group-hover:bg-[#26c4b7] transition-all duration-75 pointer-events-none"
                    style={{ width: `${Math.min(100, Math.max(0, isNaN(progressPercent) ? 0 : progressPercent))}%` }}
                  />
                </div>
                {/* Tactile thumb knob */}
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full brutal-border shadow-md pointer-events-none transition-transform group-hover:scale-125 z-10"
                  style={{ left: `calc(${Math.min(100, Math.max(0, isNaN(progressPercent) ? 0 : progressPercent))}% - 7px)` }}
                />
              </div>
              <span className="w-8 tabular-nums">{formatTime(duration)}</span>
            </div>
          </div>

          {/* RIGHT: Tactile Volume Meter & Expand */}
          <div className="w-1/4 flex items-center justify-end gap-3">
            {/* Tactile Brutalist Volume Fader */}
            <div className={`flex items-center gap-2 brutal-border px-2.5 py-1.5 rounded-xl brutal-shadow-sm ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white'
            }`}>
              <button 
                onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
                className={`cursor-pointer transition-colors ${
                  isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 hover:text-black'
                }`}
                title={volume === 0 ? "Unmute" : "Mute"}
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
                className="relative w-16 lg:w-20 group h-6 flex items-center cursor-pointer select-none touch-none focus:outline-none py-1.5"
                onPointerDown={handleVolPointerDown}
                onPointerMove={handleVolPointerMove}
                onPointerUp={handleVolPointerUp}
                onPointerCancel={handleVolPointerUp}
              >
                <div className={`w-full h-2 rounded-full overflow-hidden brutal-border pointer-events-none ${
                  isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-[#ede5d3]'
                }`}>
                  <div 
                    className="h-full bg-[#17a398] group-hover:bg-[#26c4b7] transition-all duration-75 pointer-events-none"
                    style={{ width: `${Math.min(100, Math.max(0, (volume || 0) * 100))}%` }}
                  />
                </div>
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full brutal-border shadow-md pointer-events-none transition-transform group-hover:scale-125 z-10"
                  style={{ left: `calc(${Math.min(100, Math.max(0, (volume || 0) * 100))}% - 6px)` }}
                />
              </div>
              <span className={`text-[10px] font-mono font-bold w-6 text-right select-none ${
                isDark ? 'text-zinc-400' : 'text-zinc-700'
              }`}>
                {Math.round((volume || 0) * 100)}%
              </span>
            </div>

            {/* Full Player Expand Button */}
            <button 
              onClick={openFullPlayer}
              className="p-2 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border rounded-xl cursor-pointer brutal-btn brutal-shadow-sm"
              title="Expand Master Cassette Deck"
            >
              <Maximize2 size={15} strokeWidth={2.5} />
            </button>
          </div>

        </div>
      </footer>

      {/* ── MODAL: PRESCRIPTION SPECIFICATION SHEET ── */}
      {isPrescriptionModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#fdfbf7] w-full max-w-md rounded-2xl brutal-border-thick p-5 brutal-shadow-lg text-[#0b1110] relative">
            <div className="border-b-2 border-black pb-3 mb-3 flex justify-between items-start">
              <div>
                <span className="text-[10px] font-mono font-bold bg-[#17a398] text-[#0b1110] px-2 py-0.5 rounded uppercase brutal-border">
                  TRACK DETAILS
                </span>
                <h3 className="font-display font-black text-xl mt-1">
                  {currentTrack.title}
                </h3>
              </div>
              <button 
                onClick={() => setIsPrescriptionModalOpen(false)}
                className="p-1 hover:bg-zinc-200 rounded font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-white p-3 rounded-lg brutal-border space-y-1">
                <div className="font-bold text-zinc-500 font-mono">ARTIST & ALBUM:</div>
                <p className="font-semibold text-zinc-800">
                  {currentTrack.artist || 'Unknown Artist'} {currentTrack.album ? `• ${currentTrack.album}` : ''}
                </p>
              </div>

              <div className="bg-white p-3 rounded-lg brutal-border space-y-1">
                <div className="font-bold text-zinc-500 font-mono">AUDIO QUALITY:</div>
                <p className="font-semibold text-zinc-800">
                  High-Fidelity 24-Bit Stereo • Lossless Audio Streaming
                </p>
              </div>

              <div className="p-2.5 bg-[#ded2bb] rounded border border-dashed border-black text-[11px] font-mono font-bold text-zinc-800">
                Rivo Hi-Fi Audio Player
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button 
                onClick={() => setIsPrescriptionModalOpen(false)}
                className="bg-[#0b1110] text-[#fdfbf7] font-display font-bold text-xs px-5 py-2 rounded-lg brutal-border brutal-shadow-sm brutal-btn cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
