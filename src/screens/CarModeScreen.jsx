import React from 'react';
import { Play, Pause, SkipBack, SkipForward, Car, X } from 'lucide-react';

export default function CarModeScreen({ currentTrack, isPlaying, togglePlay, playNext, playPrev, exitCarMode }) {
  if (!currentTrack) return null;

  return (
    <div className="flex-1 bg-[#17a398] p-6 md:p-12 flex flex-col justify-between items-center text-center select-none pb-32 min-h-screen">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2 bg-[#082621] text-[#26c4b7] font-mono font-black text-xs uppercase px-4 py-2 brutal-border brutal-shadow-sm">
          <Car size={16} />
          <span>RIVO TRANSIT / MOBILE DISPENSARY CONSOLE</span>
        </div>
        <button 
          onClick={exitCarMode} 
          className="brutal-btn px-4 py-2 bg-[#fdfbf7] hover:bg-[#ede5d3] text-[#0b1110] font-mono font-black text-xs uppercase brutal-border brutal-shadow-sm flex items-center gap-2"
        >
          <X size={16} />
          <span>EXIT CONSOLE</span>
        </button>
      </div>

      {/* Center Large Track Display */}
      <div className="my-auto flex flex-col items-center max-w-lg bg-[#fdfbf7] p-8 brutal-border-thick brutal-shadow-lg w-full">
        <div className="relative mb-6">
          <img 
            src={currentTrack.cover} 
            alt={currentTrack.title} 
            className="w-48 h-48 md:w-60 md:h-60 brutal-border-thick object-cover bg-[#ede5d3]"
            onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=R&background=082621&color=26c4b7`; }}
          />
          <div className="absolute top-0 right-0 bg-[#082621] text-[#f59e0b] text-[9px] font-mono font-black px-2 py-0.5">
            ACTIVE DOSE
          </div>
        </div>
        <h1 className="text-2xl md:text-4xl font-display font-black text-[#082621] truncate max-w-full tracking-tight">
          {currentTrack.title}
        </h1>
        <p className="text-base font-mono font-bold text-[#17a398] mt-1 truncate">
          {currentTrack.artist}
        </p>
      </div>

      {/* Extra Large Driving Tactile Controls */}
      <div className="w-full max-w-md flex items-center justify-around gap-6 my-auto">
        <button 
          onClick={playPrev}
          className="brutal-btn w-18 h-18 bg-[#ede5d3] text-[#082621] brutal-border-thick brutal-shadow flex items-center justify-center cursor-pointer"
        >
          <SkipBack size={32} fill="currentColor" />
        </button>

        <button 
          onClick={togglePlay}
          className="brutal-btn w-24 h-24 bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] brutal-border-thick brutal-shadow flex items-center justify-center cursor-pointer"
        >
          {isPlaying ? <Pause size={44} fill="currentColor" /> : <Play size={44} fill="currentColor" className="ml-1" />}
        </button>

        <button 
          onClick={playNext}
          className="brutal-btn w-18 h-18 bg-[#ede5d3] text-[#082621] brutal-border-thick brutal-shadow flex items-center justify-center cursor-pointer"
        >
          <SkipForward size={32} fill="currentColor" />
        </button>
      </div>
    </div>
  );
}
