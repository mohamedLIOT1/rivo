import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RotateCcw, RotateCw, Gauge } from 'lucide-react';
import { 
  PODCAST_SPEEDS, 
  getPodcastSpeed, 
  setPodcastSpeed, 
  setPodcastProgress, 
  getPodcastProgress 
} from '../../utils/podcastUtils';

export const usePodcastResumeProgress = (currentTrack, seekTo, isPlaying) => {
  const resumedTrackIdRef = useRef(null);

  useEffect(() => {
    if (!currentTrack) return;
    const trackId = String(currentTrack.id || currentTrack._id || '');
    if (!trackId || resumedTrackIdRef.current === trackId) return;

    resumedTrackIdRef.current = trackId;
    const saved = getPodcastProgress(trackId);
    const dur = currentTrack.duration || 1800;

    // Only resume if saved progress is meaningful (> 5s) and not at the very end
    if (saved > 5 && saved < (dur - 15) && typeof seekTo === 'function') {
      const timer = setTimeout(() => {
        try {
          seekTo(saved);
        } catch {}
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [currentTrack?.id, currentTrack?._id, seekTo]);
};

const PodcastPlayerControls = React.memo(function PodcastPlayerControls({
  audioRef,
  currentTrack,
  currentTime = 0,
  duration = 0,
  seekTo,
  compact = false,
  isDark = true,
}) {
  const [speed, setSpeed] = useState(() => getPodcastSpeed());
  const lastSaveTimeRef = useRef(0);

  // Apply playback speed to native audio element
  const applySpeed = useCallback((newSpeed) => {
    setSpeed(newSpeed);
    setPodcastSpeed(newSpeed);
    if (audioRef?.current) {
      try {
        audioRef.current.playbackRate = newSpeed;
        audioRef.current.defaultPlaybackRate = newSpeed;
      } catch {}
    }
  }, [audioRef]);

  // Keep playbackRate in sync when audio loads or changes
  useEffect(() => {
    if (audioRef?.current) {
      try {
        audioRef.current.playbackRate = speed;
      } catch {}
    }
  }, [audioRef, currentTrack?.id, currentTrack?._id, speed]);

  // Save progress periodically (debounced to every 3 seconds)
  useEffect(() => {
    if (!currentTrack || currentTime <= 0) return;
    const now = Date.now();
    if (now - lastSaveTimeRef.current > 3000) {
      lastSaveTimeRef.current = now;
      const trackId = currentTrack.id || currentTrack._id;
      setPodcastProgress(trackId, currentTime);
    }
  }, [currentTrack, currentTime]);

  const handleCycleSpeed = useCallback(() => {
    const currentIndex = PODCAST_SPEEDS.indexOf(speed);
    const nextIndex = (currentIndex + 1) % PODCAST_SPEEDS.length;
    const nextSpeed = PODCAST_SPEEDS[nextIndex];
    applySpeed(nextSpeed);
  }, [speed, applySpeed]);

  const handleJumpBackward = useCallback(() => {
    if (typeof seekTo !== 'function') return;
    const target = Math.max(0, currentTime - 15);
    seekTo(target);
  }, [seekTo, currentTime]);

  const handleJumpForward = useCallback(() => {
    if (typeof seekTo !== 'function') return;
    const maxDur = duration > 0 ? duration : Infinity;
    const target = Math.min(maxDur, currentTime + 15);
    seekTo(target);
  }, [seekTo, currentTime, duration]);

  if (compact) {
    // Compact layout for MiniPlayer
    return (
      <div className="flex items-center gap-2 shrink-0 px-1 select-none">
        {/* -15s Jump Backward */}
        <button
          onClick={handleJumpBackward}
          className={`relative w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer ${
            isDark 
              ? 'bg-zinc-800/80 hover:bg-zinc-700 text-emerald-400 border border-zinc-700/80' 
              : 'bg-[#ede5d3] hover:bg-[#ded2bb] text-zinc-800 border border-black/20'
          }`}
          title="Jump 15s Backward"
        >
          <RotateCcw size={16} strokeWidth={2.2} />
          <span className="absolute text-[8px] font-mono font-black text-[#10b981]">
            15
          </span>
        </button>

        {/* Speed Pill */}
        <button
          onClick={handleCycleSpeed}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-black border transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1 ${
            speed !== 1.0
              ? 'bg-[#10b981] text-[#041d1a] border-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.35)]'
              : isDark
                ? 'bg-zinc-800/80 text-zinc-200 border-zinc-700/80 hover:text-white hover:bg-zinc-700'
                : 'bg-white text-zinc-800 border-black/30 hover:bg-[#ede5d3]'
          }`}
          title={`Speed: ${speed}x`}
        >
          <Gauge size={12} strokeWidth={2.2} className={speed !== 1.0 ? 'text-[#041d1a]' : 'text-[#10b981]'} />
          <span>{speed}x</span>
        </button>

        {/* +15s Jump Forward */}
        <button
          onClick={handleJumpForward}
          className={`relative w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer ${
            isDark 
              ? 'bg-zinc-800/80 hover:bg-zinc-700 text-emerald-400 border border-zinc-700/80' 
              : 'bg-[#ede5d3] hover:bg-[#ded2bb] text-zinc-800 border border-black/20'
          }`}
          title="Jump 15s Forward"
        >
          <RotateCw size={16} strokeWidth={2.2} />
          <span className="absolute text-[8px] font-mono font-black text-[#10b981]">
            15
          </span>
        </button>
      </div>
    );
  }

  // Full / Modal layout for FullPlayerModal
  return (
    <div className="flex items-center justify-center gap-5 sm:gap-6 my-3 py-1 select-none">
      {/* Jump Backward -15s */}
      <button
        onClick={handleJumpBackward}
        className={`relative w-12 h-12 rounded-2xl flex items-center justify-center brutal-border transition-all duration-150 hover:scale-108 active:scale-95 cursor-pointer ${
          isDark
            ? 'bg-[#102421] hover:bg-[#173b34] text-emerald-300 border-emerald-800/80 shadow-[0_4px_12px_rgba(0,0,0,0.4)]'
            : 'bg-white hover:bg-[#ede5d3] text-[#0b1110] border-black shadow-[2px_2px_0px_#000]'
        }`}
        title="Jump 15s Backward"
      >
        <RotateCcw size={21} strokeWidth={2.2} />
        <span className="absolute text-[9px] font-mono font-black text-[#10b981]">
          15
        </span>
      </button>

      {/* Speed Selector Pill */}
      <button
        onClick={handleCycleSpeed}
        className={`px-4 py-2.5 rounded-2xl font-mono font-black text-xs sm:text-sm brutal-border flex items-center gap-2 transition-all duration-150 hover:scale-108 active:scale-95 cursor-pointer ${
          speed !== 1.0
            ? 'bg-[#10b981] text-[#041d1a] border-[#10b981] shadow-[0_0_16px_rgba(16,185,129,0.45)]'
            : isDark
              ? 'bg-[#102421] text-emerald-200 border-emerald-800/80 hover:bg-[#173b34] shadow-[0_4px_12px_rgba(0,0,0,0.4)]'
              : 'bg-white text-[#0b1110] border-black hover:bg-[#ede5d3] shadow-[2px_2px_0px_#000]'
        }`}
        title="Cycle Playback Speed"
      >
        <Gauge size={16} strokeWidth={2.2} className={speed !== 1.0 ? 'text-[#041d1a]' : 'text-[#10b981]'} />
        <span>{speed}x</span>
      </button>

      {/* Jump Forward +15s */}
      <button
        onClick={handleJumpForward}
        className={`relative w-12 h-12 rounded-2xl flex items-center justify-center brutal-border transition-all duration-150 hover:scale-108 active:scale-95 cursor-pointer ${
          isDark
            ? 'bg-[#102421] hover:bg-[#173b34] text-emerald-300 border-emerald-800/80 shadow-[0_4px_12px_rgba(0,0,0,0.4)]'
            : 'bg-white hover:bg-[#ede5d3] text-[#0b1110] border-black shadow-[2px_2px_0px_#000]'
        }`}
        title="Jump 15s Forward"
      >
        <RotateCw size={21} strokeWidth={2.2} />
        <span className="absolute text-[9px] font-mono font-black text-[#10b981]">
          15
        </span>
      </button>
    </div>
  );
});

export default PodcastPlayerControls;
