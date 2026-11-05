import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useToast } from './ToastContext';

const SleepTimerContext = createContext(null);

// Shared singleton ref for checking end-of-track sleep timer from outside React render cycle
export const sleepTimerEndOfTrackSignal = {
  isEndOfTrackActive: false,
  consume() {
    if (this.isEndOfTrackActive) {
      this.isEndOfTrackActive = false;
      return true;
    }
    return false;
  }
};

/**
 * Isolated Sleep Timer Provider
 * Isolates high-frequency (1s) countdown ticks so root AudioContext does NOT re-render every second.
 */
export function SleepTimerProvider({ children, onStopPlayback }) {
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(null);
  const [sleepTimerMode, setSleepTimerMode] = useState('off'); // 'off' | 'minutes' | 'end_of_track'
  const sleepTimerRef = useRef(null);
  const onStopPlaybackRef = useRef(onStopPlayback);
  const { showToast } = useToast() || {};

  useEffect(() => {
    onStopPlaybackRef.current = onStopPlayback;
  }, [onStopPlayback]);

  const clearTimer = useCallback(() => {
    if (sleepTimerRef.current) {
      clearInterval(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    sleepTimerEndOfTrackSignal.isEndOfTrackActive = false;
  }, []);

  const cancelSleepTimer = useCallback(() => {
    clearTimer();
    setSleepTimerRemaining(null);
    setSleepTimerMode('off');
    if (showToast) {
      showToast('Sleep timer cancelled', 'info');
    }
  }, [clearTimer, showToast]);

  const startSleepTimer = useCallback((option) => {
    clearTimer();

    // Check if user selected "End of Current Track"
    if (option === 'end_of_track' || option === -1) {
      sleepTimerEndOfTrackSignal.isEndOfTrackActive = true;
      setSleepTimerMode('end_of_track');
      setSleepTimerRemaining(null);
      if (showToast) {
        showToast('Sleep timer: Stop at end of current track', 'info');
      }
      return;
    }

    const minutes = Number(option);
    if (!minutes || minutes <= 0) {
      cancelSleepTimer();
      return;
    }

    let remaining = Math.round(minutes * 60);
    setSleepTimerMode('minutes');
    setSleepTimerRemaining(remaining);
    if (showToast) {
      showToast(`Sleep timer set: ${minutes} min`, 'info');
    }

    sleepTimerRef.current = setInterval(() => {
      remaining -= 1;
      setSleepTimerRemaining(remaining);
      if (remaining <= 0) {
        if (sleepTimerRef.current) {
          clearInterval(sleepTimerRef.current);
          sleepTimerRef.current = null;
        }
        setSleepTimerRemaining(null);
        setSleepTimerMode('off');
        if (typeof onStopPlaybackRef.current === 'function') {
          onStopPlaybackRef.current('timer_expired');
        }
        if (showToast) {
          showToast('Playback stopped by sleep timer', 'info');
        }
      }
    }, 1000);
  }, [clearTimer, cancelSleepTimer, showToast]);

  // Teardown interval on unmount
  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) {
        clearInterval(sleepTimerRef.current);
      }
    };
  }, []);

  const value = useMemo(() => ({
    sleepTimerRemaining,
    sleepTimerMode,
    isSleepTimerActive: sleepTimerMode !== 'off',
    startSleepTimer,
    cancelSleepTimer,
  }), [sleepTimerRemaining, sleepTimerMode, startSleepTimer, cancelSleepTimer]);

  return (
    <SleepTimerContext.Provider value={value}>
      {children}
    </SleepTimerContext.Provider>
  );
}

export function useSleepTimer() {
  const context = useContext(SleepTimerContext);
  if (!context) {
    return {
      sleepTimerRemaining: null,
      sleepTimerMode: 'off',
      isSleepTimerActive: false,
      startSleepTimer: () => {},
      cancelSleepTimer: () => {},
    };
  }
  return context;
}
