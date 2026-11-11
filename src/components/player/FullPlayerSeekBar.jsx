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

/**
 * Isolated seekbar + podcast transport wrapper for FullPlayerModal.
 * Subscribes to AudioProgressContext locally so FullPlayerModal never re-renders on 500ms ticks.
 */
const FullPlayerSeekBar = React.memo(function FullPlayerSeekBar({
  currentTrack,
  seekTo,
  isDark = true,
  isCurPodcast = false,
  audioRef,
  isPlaying = false,
  propCurrentTime,
  propDuration,
}) {
  const progress = useAudioProgress();
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubPercent, setScrubPercent] = useState(0);

  const rawActiveTime = propCurrentTime !== undefined ? propCurrentTime : progress?.currentTime || 0;
  const activeTime =
    rawActiveTime > 86400 && Math.round(rawActiveTime / 1000) <= 86400
      ? Math.round(rawActiveTime / 1000)
      : rawActiveTime;
  const rawActiveDur =
    propDuration !== undefined && propDuration > 0
      ? propDuration
      : progress?.duration || currentTrack?.duration || 210;
  const activeDuration =
    rawActiveDur > 86400 && Math.round(rawActiveDur / 1000) <= 86400
      ? Math.round(rawActiveDur / 1000)
      : rawActiveDur > 0
      ? rawActiveDur
      : 210;

  const realPercent = activeDuration > 0 ? (activeTime / activeDuration) * 100 : 0;
  const progressPercent = isScrubbing ? scrubPercent : realPercent;
  const clampedPct = Math.min(100, Math.max(0, isNaN(progressPercent) ? 0 : progressPercent));

  const seekFromClientX = (clientX, targetRect) => {
    if (!targetRect || targetRect.width <= 0) return;
    const clickX = clientX - targetRect.left;
    const pct = Math.max(0, Math.min(1, clickX / targetRect.width));
    const targetDuration = activeDuration > 0 ? activeDuration : currentTrack?.duration || 210;
    setScrubPercent(pct * 100);
    if (seekTo) seekTo(pct * targetDuration);
  };

  const handleSeekPointerDown = (e) => {
    e.preventDefault();
    setIsScrubbing(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    seekFromClientX(e.clientX, e.currentTarget.getBoundingClientRect());
  };

  const handleSeekPointerMove = (e) => {
    if (!isScrubbing) return;
    seekFromClientX(e.clientX, e.currentTarget.getBoundingClientRect());
  };

  const handleSeekPointerUp = (e) => {
    if (isScrubbing) {
      setIsScrubbing(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleSeekKeyDown = (e) => {
    const dur = activeDuration > 0 ? activeDuration : currentTrack?.duration || 210;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      seekTo?.(Math.max(0, activeTime - 5));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      seekTo?.(Math.min(dur, activeTime + 5));
    } else if (e.key === 'Home') {
      e.preventDefault();
      seekTo?.(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      seekTo?.(dur);
    }
  };

  return (
    <>
      <div className="mb-2 shrink-0">
        <div
          role="slider"
          tabIndex={0}
          aria-label="Seek track"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(clampedPct)}
          onKeyDown={handleSeekKeyDown}
          className="relative w-full group h-8 flex items-center cursor-pointer select-none py-2 touch-none focus:outline-none"
          onPointerDown={handleSeekPointerDown}
          onPointerMove={handleSeekPointerMove}
          onPointerUp={handleSeekPointerUp}
          onPointerCancel={handleSeekPointerUp}
        >
          <div
            className={`w-full h-2 group-hover:h-2.5 rounded-full overflow-hidden transition-all pointer-events-none ${
              isDark
                ? 'bg-[#070c0a] border-2 border-[#090e0c] shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]'
                : 'bg-[#ede5d3] brutal-border'
            }`}
          >
            <div
              className={`h-full bg-[#17a398] group-hover:bg-[#26c4b7] transition-all duration-75 pointer-events-none ${
                isDark ? 'shadow-[0_0_10px_rgba(23,163,152,0.4)]' : ''
              }`}
              style={{ width: `${clampedPct}%` }}
            />
          </div>
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full pointer-events-none transition-transform group-hover:scale-125 z-10 ${
              isDark
                ? 'border-2 border-[#090e0c] shadow-[0_0_8px_rgba(23,163,152,0.5),2px_2px_0px_#050807]'
                : 'brutal-border shadow-md'
            }`}
            style={{ left: `calc(${clampedPct}% - 7px)` }}
          />
        </div>
        <div
          className={`flex justify-between items-center mt-1 font-mono font-bold text-[10px] ${
            isDark ? 'text-[#26c4b7]' : 'text-zinc-600'
          }`}
        >
          {currentTrack?.isLive ? (
            <div className="flex items-center gap-1.5 text-red-500 font-bold">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span>LIVE 24/7 BROADCAST</span>
            </div>
          ) : (
            <>
              <span className="tabular-nums">{formatTime(activeTime)}</span>
              <span className="tabular-nums">{formatTime(activeDuration)}</span>
            </>
          )}
        </div>
      </div>

      {isCurPodcast && (
        <PodcastPlayerControls
          audioRef={audioRef}
          currentTrack={currentTrack}
          currentTime={activeTime}
          duration={activeDuration}
          seekTo={seekTo}
          compact={false}
          isDark={isDark}
        />
      )}
    </>
  );
});

export default FullPlayerSeekBar;
