import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart, Maximize2, Sliders, Moon, PlusCircle } from 'lucide-react';

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
  openFullPlayer,
  openEqualizer,
  openSleepTimer,
  openAddToPlaylist,
  currentTime,
  duration
}) {
  if (!currentTrack) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed bottom-[56px] md:bottom-0 left-0 right-0 z-30 px-2 md:px-4 pb-2 md:pb-3 select-none pointer-events-none">
      <div 
        onClick={openFullPlayer}
        className="pointer-events-auto max-w-7xl mx-auto glass-player rounded-xl p-2.5 md:p-3 flex items-center justify-between gap-3 shadow-2xl cursor-pointer hover:bg-zinc-900/90 transition-all border border-zinc-800/80 group"
      >
        {/* Left: Artwork + Track Info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative shrink-0">
            <img 
              src={currentTrack.cover} 
              alt={currentTrack.title} 
              className={`w-11 h-11 md:w-12 md:h-12 rounded-lg object-cover shadow-md transition-transform ${isPlaying ? 'scale-105' : 'scale-100'}`}
            />
            {isPlaying && (
              <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center gap-0.5">
                <div className="equalizer-bar"></div>
                <div className="equalizer-bar"></div>
                <div className="equalizer-bar"></div>
              </div>
            )}
          </div>
          <div className="truncate">
            <h4 className="text-sm font-semibold text-white truncate group-hover:text-[#1DB954] transition-colors">
              {currentTrack.title}
            </h4>
            <p className="text-xs text-zinc-400 truncate">{currentTrack.artist}</p>
          </div>
        </div>

        {/* Center: Transport Controls */}
        <div className="flex items-center gap-1 md:gap-2.5 shrink-0">
          {toggleShuffle && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleShuffle();
              }}
              className={`p-1.5 rounded-full transition-colors hidden sm:block ${isShuffle ? 'text-[#1DB954] bg-[#1DB954]/10' : 'text-zinc-400 hover:text-white'}`}
              title="Shuffle"
            >
              <Shuffle size={16} />
            </button>
          )}

          {playPrev && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                playPrev();
              }}
              className="p-1.5 text-zinc-300 hover:text-white transition-transform active:scale-95"
              title="Previous Track"
            >
              <SkipBack size={18} fill="currentColor" />
            </button>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePlay();
            }}
            className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg"
          >
            {isPlaying ? <Pause size={18} fill="black" /> : <Play size={18} fill="black" className="ml-0.5" />}
          </button>

          {playNext && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                playNext();
              }}
              className="p-1.5 text-zinc-300 hover:text-white transition-transform active:scale-95"
              title="Next Track"
            >
              <SkipForward size={18} fill="currentColor" />
            </button>
          )}

          {toggleRepeat && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleRepeat();
              }}
              className={`p-1.5 rounded-full transition-colors hidden sm:block ${isRepeat ? 'text-[#1DB954] bg-[#1DB954]/10' : 'text-zinc-400 hover:text-white'}`}
              title="Repeat"
            >
              <Repeat size={16} />
            </button>
          )}
        </div>

        {/* Right: Tools & Expand */}
        <div className="hidden md:flex items-center gap-2 shrink-0 border-l border-zinc-800 pl-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              openAddToPlaylist();
            }}
            title="Add to Playlist"
            className="p-2 text-zinc-400 hover:text-[#1DB954] transition-colors"
          >
            <PlusCircle size={18} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEqualizer();
            }}
            title="Audio Equalizer"
            className="p-2 text-zinc-400 hover:text-[#1DB954] transition-colors"
          >
            <Sliders size={17} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openSleepTimer();
            }}
            title="Sleep Timer"
            className="p-2 text-zinc-400 hover:text-[#1DB954] transition-colors"
          >
            <Moon size={17} />
          </button>
          <button
            onClick={openFullPlayer}
            title="Full Screen View"
            className="p-2 text-zinc-400 hover:text-white transition-colors"
          >
            <Maximize2 size={17} />
          </button>
        </div>

        {/* Bottom progress bar line */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-800 rounded-b-xl overflow-hidden">
          <div 
            className="h-full bg-[#1DB954] transition-all duration-200"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
