import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

/**
 * High-frequency web audio progress context.
 * Isolates playback time/duration ticks from AudioProvider so timeupdate
 * events never re-render AudioProvider or the main application tree.
 */
export const AudioProgressContext = createContext({
  currentTime: 0,
  duration: 210,
  progress: 0,
});

const listeners = new Set();

let currentSnapshot = {
  currentTime: 0,
  duration: 210,
};

/**
 * Push a playback progress snapshot to subscribed progress UI components.
 */
export function updateWebAudioProgress({ currentTime, duration } = {}) {
  const parsedTime = Number(currentTime);
  const nextTime =
    currentTime !== undefined && Number.isFinite(parsedTime)
      ? Math.max(0, parsedTime)
      : currentSnapshot.currentTime;
  const parsedDur = Number(duration);
  const nextDur =
    duration !== undefined && parsedDur > 0 && Number.isFinite(parsedDur)
      ? parsedDur
      : currentSnapshot.duration;

  if (nextTime === currentSnapshot.currentTime && nextDur === currentSnapshot.duration) {
    return;
  }

  currentSnapshot = {
    currentTime: nextTime,
    duration: nextDur,
  };

  listeners.forEach((listener) => {
    try {
      listener(currentSnapshot);
    } catch {}
  });
}

/**
 * Reset web progress snapshot back to zero.
 */
export function resetWebAudioProgress(duration = 210) {
  updateWebAudioProgress({ currentTime: 0, duration });
}

/**
 * Imperatively read the latest playback progress without subscribing to re-renders.
 */
export function getWebAudioProgressSnapshot() {
  return currentSnapshot;
}

/**
 * Subscribe imperatively to progress updates (useful for lyrics sync without React re-renders).
 */
export function subscribeWebAudioProgress(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function AudioProgressProvider({ children, initialTime = 0, initialDuration = 210 }) {
  const [state, setState] = useState(() => {
    const safeTime = Math.max(0, Number(initialTime) || 0);
    const safeDur = Number(initialDuration) > 0 ? Number(initialDuration) : 210;
    currentSnapshot = { currentTime: safeTime, duration: safeDur };
    return currentSnapshot;
  });

  useEffect(() => {
    // Sync immediately in case an update occurred before mount effect ran
    setState((prev) =>
      prev.currentTime === currentSnapshot.currentTime && prev.duration === currentSnapshot.duration
        ? prev
        : currentSnapshot
    );

    const handleProgress = (next) => {
      setState((prev) =>
        prev.currentTime === next.currentTime && prev.duration === next.duration ? prev : next
      );
    };

    listeners.add(handleProgress);
    return () => {
      listeners.delete(handleProgress);
    };
  }, []);

  const value = useMemo(() => {
    const { currentTime, duration } = state;
    const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
    return {
      currentTime,
      duration,
      progress,
    };
  }, [state]);

  return (
    <AudioProgressContext.Provider value={value}>
      {children}
    </AudioProgressContext.Provider>
  );
}

export function useAudioProgress() {
  const ctx = useContext(AudioProgressContext);
  return ctx || { currentTime: 0, duration: 210, progress: 0 };
}

export default AudioProgressContext;
