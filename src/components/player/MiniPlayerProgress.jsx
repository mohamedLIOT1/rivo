import React, { useState } from 'react';
import { useAudioProgress } from '../../context/AudioContext';
import PodcastPlayerControls from '../podcast/PodcastPlayerControls';

function formatTime(secs) {
  if (!secs || isNaN(secs) || secs < 0 || !isFinite(secs)) return '0:00';
  const sVal = secs > 86400 && Math.round(secs / 1000) <= 86400 ? Math.round(secs / 1000) : Math.round(secs);
  const h = Math.floor(sVal / 3600);
  const m = Math.floor((sVal % 3600) / 60);
  const s = Math.floor(sVal % 60);
  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function useNormalizedProgress(propCurrentTime, propDuration, currentTrack) {
  const progress = useAudioProgress();
  const rawCurrentTime = propCurrentTime !== undefined ? propCurrentTime : progress?.currentTime ?? 0;
  const currentTime =
    rawCurrentTime > 86400 && Math.round(rawCurrentTime / 1000) <= 86400
      ? Math.round(rawCurrentTime / 1000)
      : rawCurrentTime;
  const rawDuration = propDuration !== undefined ? propDuration : progress?.duration ?? currentTrack?.duration ?? 210;
  const duration =
    rawDuration > 86400 && Math.round(rawDuration / 1000) <= 86400
      ? Math.round(rawDuration / 1000)
      : rawDuration > 0
      ? rawDuration
      : 210;
  return { currentTime, duration };
}

export const MiniPlayerMobileScrubber = React.memo(function MiniPlayerMobileScrubber({
  currentTrack,
  propCurrentTime,
  propDuration,
  seekTo,
  isDark = true,
}) {
  const { currentTime, duration } = useNormalizedProgress(propCurrentTime, propDuration, currentTrack);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPercent, setScrubPercent] = useState(0);

  const realPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const progressPercent = isScrubbing ? scrubPercent : realPercent;
  const clampedPct = isNaN(progressPercent) ? 0 : Math.min(100, Math.max(0, progressPercent));

  const seekFromClientX = (clientX, targetRect) => {
    if (!targetRect || targetRect.width <= 0) return;
    const pct = Math.max(0, Math.min(1, (clientX - targetRect.left) / targetRect.width));
    setScrubPercent(pct * 100);
    seekTo?.(pct * duration);
  };

  return (
    <div
      role="slider"
      aria-label="Seek track"
      className="md:hidden absolute -top-3.5 inset-x-0 h-8 pt-3.5 cursor-pointer z-30 flex items-start touch-none select-none"
      onPointerDown={(e) => {
        e.preventDefault();
        setIsScrubbing(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        seekFromClientX(e.clientX, e.currentTarget.getBoundingClientRect());
      }}
      onPointerMove={(e) => {
        if (isScrubbing) seekFromClientX(e.clientX, e.currentTarget.getBoundingClientRect());
      }}
      onPointerUp={(e) => {
        if (isScrubbing) {
          setIsScrubbing(false);
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {}
        }
      }}
      onPointerCancel={(e) => {
        if (isScrubbing) {
          setIsScrubbing(false);
          try {
            e.currentTarget.releasePointerCapture(e.pointerId);
          } catch {}
        }
      }}
    >
      <div className={`w-full h-[4px] overflow-hidden pointer-events-none ${isDark ? 'bg-zinc-800' : 'bg-[#ded2bb]'}`}>
        <div className="h-full bg-[#17a398] transition-all pointer-events-none" style={{ width: `${clampedPct}%` }} />
      </div>
    </div>
  );
});

export const MiniPlayerDesktopProgress = React.memo(function MiniPlayerDesktopProgress({
  currentTrack,
  propCurrentTime,
  propDuration,
  seekTo,
  isDark = true,
}) {
  const { currentTime, duration } = useNormalizedProgress(propCurrentTime, propDuration, currentTrack);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPercent, setScrubPercent] = useState(0);

  const realPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const progressPercent = isScrubbing ? scrubPercent : realPercent;
  const clampedPct = isNaN(progressPercent) ? 0 : Math.min(100, Math.max(0, progressPercent));

  const seekFromClientX = (clientX, targetRect) => {
    if (!targetRect || targetRect.width <= 0) return;
    const pct = Math.max(0, Math.min(1, (clientX - targetRect.left) / targetRect.width));
    setScrubPercent(pct * 100);
    seekTo?.(pct * duration);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      seekTo?.(Math.max(0, currentTime - 5));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      seekTo?.(Math.min(duration, currentTime + 5));
    } else if (e.key === 'Home') {
      e.preventDefault();
      seekTo?.(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      seekTo?.(duration);
    }
  };

  return (
    <div className={`w-full flex items-center gap-2 text-[10px] sm:text-[11px] font-mono font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>
      {currentTrack?.isLive ? (
        <div className="w-full flex items-center justify-center gap-2 py-1 text-red-500 font-bold">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          <span>LIVE 24/7 • Holy Quran Radio</span>
        </div>
      ) : (
        <>
          <span className="w-8 text-right tabular-nums">{formatTime(currentTime)}</span>
          <div
            role="slider"
            tabIndex={0}
            aria-label="Seek track"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(clampedPct)}
            onKeyDown={handleKeyDown}
            className="relative flex-1 group h-8 flex items-center cursor-pointer select-none py-2 touch-none focus:outline-none"
            onPointerDown={(e) => {
              e.preventDefault();
              setIsScrubbing(true);
              e.currentTarget.setPointerCapture(e.pointerId);
              seekFromClientX(e.clientX, e.currentTarget.getBoundingClientRect());
            }}
            onPointerMove={(e) => {
              if (isScrubbing) seekFromClientX(e.clientX, e.currentTarget.getBoundingClientRect());
            }}
            onPointerUp={(e) => {
              if (isScrubbing) {
                setIsScrubbing(false);
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {}
              }
            }}
            onPointerCancel={(e) => {
              if (isScrubbing) {
                setIsScrubbing(false);
                try {
                  e.currentTarget.releasePointerCapture(e.pointerId);
                } catch {}
              }
            }}
          >
            <div
              className={`w-full h-2 group-hover:h-2.5 rounded-full overflow-hidden brutal-border transition-all pointer-events-none ${
                isDark ? 'bg-zinc-800 border-zinc-700' : 'bg-[#ede5d3]'
              }`}
            >
              <div
                className="h-full bg-[#17a398] group-hover:bg-[#26c4b7] transition-all duration-75 pointer-events-none"
                style={{ width: `${clampedPct}%` }}
              />
            </div>
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full brutal-border shadow-md pointer-events-none transition-transform group-hover:scale-125 z-10"
              style={{ left: `calc(${clampedPct}% - 7px)` }}
            />
          </div>
          <span className="w-8 tabular-nums">{formatTime(duration)}</span>
        </>
      )}
    </div>
  );
});

export const MiniPlayerPodcastControls = React.memo(function MiniPlayerPodcastControls({
  audioRef,
  currentTrack,
  propCurrentTime,
  propDuration,
  seekTo,
  isDark = true,
}) {
  const { currentTime, duration } = useNormalizedProgress(propCurrentTime, propDuration, currentTrack);
  return (
    <PodcastPlayerControls
      audioRef={audioRef}
      currentTrack={currentTrack}
      currentTime={currentTime}
      duration={duration}
      seekTo={seekTo}
      compact={true}
      isDark={isDark}
    />
  );
});
