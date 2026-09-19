import React, { useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart, Maximize2, Volume2, VolumeX, FileText, PlusCircle } from 'lucide-react';
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
  openJamModal,
  globalTheme = 'dark',
}) {
  const isDark = globalTheme === 'dark';
  const audio = useAudioPlayer();
  const currentTime = propCurrentTime !== undefined ? propCurrentTime : (audio?.currentTime || 0);
  const duration = propDuration !== undefined ? propDuration : (audio?.duration || 210);
  const seekTo = propSeekTo || audio?.seekTo;

  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);

  if (!currentTrack) return null;

  const isTrackLiked = likedTrackIds.some(id => String(id) === String(currentTrack?.id) || String(id) === String(currentTrack?._id)) || Boolean(currentTrack?.liked);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (secs) => {
    if (!secs || isNaN(secs) || secs < 0 || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    const targetSec = (val / 100) * duration;
    if (seekTo) seekTo(targetSec);
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
        {/* Mobile Scrubber Line (top 3px) */}
        <div 
          className={`md:hidden absolute top-0 inset-x-0 h-[3px] cursor-pointer overflow-hidden ${
            isDark ? 'bg-zinc-800' : 'bg-[#ded2bb]'
          }`}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = Math.max(0, Math.min(1, clickX / rect.width));
            if (seekTo && duration > 0) seekTo(pct * duration);
          }}
        >
          <div 
            className="h-full bg-[#17a398] transition-all"
            style={{ width: `${isNaN(progressPercent) ? 0 : Math.min(100, Math.max(0, progressPercent))}%` }}
          />
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
              <p className={`text-[10px] font-bold truncate mt-0.5 ${
                isDark ? 'text-zinc-400' : 'text-zinc-600'
              }`}>
                {currentTrack.artist || 'Unknown Compounder'}
              </p>
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
              title={isTrackLiked ? "Saved in Rx Library" : "Save in Rx Library"}
            >
              <Heart size={18} fill={isTrackLiked ? 'currentColor' : 'none'} strokeWidth={2.5} />
            </button>

            <button 
              onClick={togglePlay}
              className="w-9 h-9 rounded-xl bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border flex items-center justify-center brutal-btn cursor-pointer" 
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <Pause size={16} fill="currentColor" />
              ) : (
                <Play size={16} fill="currentColor" className="ml-0.5" />
              )}
            </button>

            <button 
              onClick={playNext}
              className={`w-8 h-8 rounded-lg brutal-border flex items-center justify-center brutal-btn cursor-pointer ${
                isDark 
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700' 
                  : 'bg-white hover:bg-[#ede5d3] text-[#0b1110]'
              }`} 
              title="Next"
            >
              <SkipForward size={14} fill="currentColor" />
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────
            DESKTOP CASSETTE DECK (>= md)
            ───────────────────────────────────────── */}
        <div className="hidden md:flex max-w-7xl mx-auto h-full items-center justify-between gap-4">
          
          {/* LEFT: Track Info & Medical Badge */}
          <div className="w-1/3 flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* Vinyl / Cassette Art box */}
            <div 
              onClick={openFullPlayer}
              className="w-11 h-11 sm:w-12 sm:h-12 bg-[#0b1110] text-[#17a398] rounded-lg brutal-border flex items-center justify-center shrink-0 brutal-shadow-sm relative overflow-hidden cursor-pointer group"
              title="Click for Full Cassette Inspection"
            >
              {currentTrack.cover ? (
                <img 
                  src={currentTrack.cover} 
                  alt={currentTrack.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                />
              ) : (
                <svg className="w-6 h-6 sm:w-7 sm:h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="4" width="20" height="16" rx="2"></rect>
                  <circle cx="8" cy="10" r="2"></circle>
                  <circle cx="16" cy="10" r="2"></circle>
                  <path d="M8 14h8"></path>
                </svg>
              )}
            </div>

            <div className="min-w-0 flex-1 cursor-pointer" onClick={openFullPlayer}>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] font-mono font-bold bg-[#dc2626] text-white px-1.5 py-0.2 rounded brutal-border">
                  ACTIVE DOSE
                </span>
                <span className="text-[9px] font-bold bg-[#17a398] text-[#0b1110] px-1.5 py-0.2 rounded brutal-border truncate max-w-[120px]">
                  {currentTrack.genre || 'RIVO-RX'}
                </span>
              </div>
              <h4 className={`font-display font-black text-xs sm:text-sm truncate leading-tight mt-0.5 hover:underline ${
                isDark ? 'text-zinc-100' : 'text-[#0b1110]'
              }`}>
                {currentTrack.title}
              </h4>
              <p className={`text-[10px] sm:text-[11px] font-bold truncate ${
                isDark ? 'text-zinc-400' : 'text-zinc-600'
              }`}>
                {currentTrack.artist || 'Unknown Compounder'}
              </p>
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
              title={isTrackLiked ? "Saved in Rx Library" : "Save in Rx Library"}
            >
              <Heart size={18} fill={isTrackLiked ? 'currentColor' : 'none'} strokeWidth={2.5} />
            </button>

            {/* Prescription details modal trigger */}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setIsPrescriptionModalOpen(true);
              }}
              className={`p-1.5 transition cursor-pointer ${
                isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 hover:text-black'
              }`} 
              title="View Prescription Details"
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
                title="Add to Blister Pack"
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
                title={isPlaying ? "Pause Dose" : "Dispense Dose"}
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
              <span className="w-8 text-right">{formatTime(currentTime)}</span>
              <div className="relative flex-1 flex items-center">
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={isNaN(progressPercent) ? 0 : progressPercent} 
                  onChange={handleSeek}
                  className={`w-full h-2 rounded-lg appearance-none cursor-pointer brutal-border ${
                    isDark ? 'bg-zinc-800 border-zinc-700 accent-[#17a398]' : 'bg-[#ede5d3] accent-[#0b1110]'
                  }`}
                />
              </div>
              <span className="w-8">{formatTime(duration)}</span>
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
              <div className="relative flex items-center">
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.01" 
                  value={volume} 
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className={`w-16 lg:w-20 h-2 brutal-border rounded-full appearance-none cursor-pointer ${
                    isDark ? 'bg-zinc-800 border-zinc-700 accent-[#17a398]' : 'bg-[#ede5d3] accent-[#0b1110]'
                  }`}
                />
              </div>
              <span className={`text-[10px] font-mono font-bold w-6 text-right select-none ${
                isDark ? 'text-zinc-400' : 'text-zinc-700'
              }`}>
                {Math.round(volume * 100)}%
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
                  CLINICAL AUDIT RECORD
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
                <div className="font-bold text-zinc-500 font-mono">ACTIVE CHEMICAL INGREDIENTS:</div>
                <p className="font-semibold text-zinc-800">
                  {currentTrack.artist || 'Egyptian Compound'} • 100% Cairo Rhythms • Analog Synths
                </p>
              </div>

              <div className="bg-white p-3 rounded-lg brutal-border space-y-1">
                <div className="font-bold text-zinc-500 font-mono">PROJECTED PHYSIOLOGICAL EFFECTS:</div>
                <p className="font-semibold text-zinc-800">
                  Accelerated workflow velocity, involuntary head nodding, instant mitigation of server errors.
                </p>
              </div>

              <div className="p-2.5 bg-[#ded2bb] rounded border border-dashed border-black text-[11px] font-mono font-bold text-zinc-800">
                Certified by Rivo Apothecary Union • Batch No. 1954-CAIRO
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <button 
                onClick={() => setIsPrescriptionModalOpen(false)}
                className="bg-[#0b1110] text-[#fdfbf7] font-display font-bold text-xs px-5 py-2 rounded-lg brutal-border brutal-shadow-sm brutal-btn cursor-pointer"
              >
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
