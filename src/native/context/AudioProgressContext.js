import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';

/**
 * AudioProgressContext
 * 
 * High-frequency audio playback and download state isolation context.
 * Isolates 250ms playback ticks (currentTime, duration, progress) and download percentage
 * from the general AudioContext to eliminate UI-wide re-render storms.
 */

const defaultProgressState = {
  currentTime: 0,
  duration: 0,
  progress: 0,
  downloadProgress: {},
  downloadingIds: {},
};

export const AudioProgressContext = createContext(defaultProgressState);

// Global progress update dispatcher using listener set for zero-overhead out-of-tree updates
const listeners = new Set();
let currentProgressSnapshot = {
  currentTime: 0,
  duration: 0,
  downloadProgress: {},
};

export const updateAudioProgress = ({ currentTime = 0, duration = 0 }) => {
  const safeCurrent = Math.max(0, Number(currentTime) || 0);
  const safeDuration = Math.max(0, Number(duration) || 0);
  currentProgressSnapshot.currentTime = safeCurrent;
  currentProgressSnapshot.duration = safeDuration;

  listeners.forEach((listener) => {
    try {
      listener({ type: 'playback', currentTime: safeCurrent, duration: safeDuration });
    } catch {}
  });
};

export const updateDownloadProgress = (trackId, percent) => {
  if (!trackId) return;
  const sId = String(trackId);
  const p = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  currentProgressSnapshot.downloadProgress = {
    ...currentProgressSnapshot.downloadProgress,
    [sId]: p,
  };

  listeners.forEach((listener) => {
    try {
      listener({
        type: 'download',
        downloadProgress: currentProgressSnapshot.downloadProgress,
      });
    } catch {}
  });
};

export const clearDownloadProgress = (trackId) => {
  if (!trackId) return;
  const sId = String(trackId);
  const next = { ...currentProgressSnapshot.downloadProgress };
  delete next[sId];
  currentProgressSnapshot.downloadProgress = next;

  listeners.forEach((listener) => {
    try {
      listener({
        type: 'download',
        downloadProgress: next,
      });
    } catch {}
  });
};

export const resetAudioProgress = () => {
  currentProgressSnapshot = {
    currentTime: 0,
    duration: 0,
    downloadProgress: {},
  };
  listeners.forEach((listener) => {
    try {
      listener({ type: 'reset' });
    } catch {}
  });
};

export const AudioProgressProvider = ({ children }) => {
  const [playbackTime, setPlaybackTime] = useState({ currentTime: 0, duration: 0 });
  const [downloadProgress, setDownloadProgress] = useState({});

  useEffect(() => {
    const handler = (event) => {
      if (event.type === 'playback') {
        setPlaybackTime({
          currentTime: event.currentTime,
          duration: event.duration,
        });
      } else if (event.type === 'download') {
        setDownloadProgress(event.downloadProgress);
      } else if (event.type === 'reset') {
        setPlaybackTime({ currentTime: 0, duration: 0 });
        setDownloadProgress({});
      }
    };

    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const value = useMemo(() => {
    const { currentTime, duration } = playbackTime;
    // Division-by-zero protection: guard duration <= 0
    const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

    return {
      currentTime,
      duration,
      progress,
      downloadProgress,
      downloadingIds: downloadProgress, // Alias for backward compatibility
    };
  }, [playbackTime, downloadProgress]);

  return (
    <AudioProgressContext.Provider value={value}>
      {children}
    </AudioProgressContext.Provider>
  );
};

export const useAudioProgress = () => useContext(AudioProgressContext);

export default AudioProgressContext;
