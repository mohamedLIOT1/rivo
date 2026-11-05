import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useUI } from './UIContext';

const SleepTimerContext = createContext(null);

export const webSleepTimerSignal = {
  isEndOfTrackActive: false,
  consume() {
    if (this.isEndOfTrackActive) {
      this.isEndOfTrackActive = false;
      return true;
    }
    return false;
  }
};

export function SleepTimerProvider({ children, onStopPlayback }) {
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(null);
  const [sleepTimerMode, setSleepTimerMode] = useState('off'); // 'off' | 'minutes' | 'end_of_track'
  const sleepTimerRef = useRef(null);
  const onStopPlaybackRef = useRef(onStopPlayback);
  const { showToast } = useUI() || {};

  useEffect(() => {
    onStopPlaybackRef.current = onStopPlayback;
  }, [onStopPlayback]);

  const clearTimer = useCallback(() => {
    if (sleepTimerRef.current) {
      clearInterval(sleepTimerRef.current);
      sleepTimerRef.current = null;
    }
    webSleepTimerSignal.isEndOfTrackActive = false;
  }, []);

  const cancelSleepTimer = useCallback(() => {
    clearTimer();
    setSleepTimerRemaining(null);
    setSleepTimerMode('off');
    if (showToast) {
      showToast('Sleep timer cancelled');
    }
  }, [clearTimer, showToast]);

  const startSleepTimer = useCallback((option) => {
    clearTimer();

    if (option === 'end_of_track' || option === -1) {
      webSleepTimerSignal.isEndOfTrackActive = true;
      setSleepTimerMode('end_of_track');
      setSleepTimerRemaining(null);
      if (showToast) {
        showToast('Sleep timer: Stopping after current track');
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
      showToast(`Sleep timer set: ${minutes} min`);
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
          showToast('Playback stopped by sleep timer');
        }
      }
    }, 1000);
  }, [clearTimer, cancelSleepTimer, showToast]);

  useEffect(() => {
    return () => {
      if (sleepTimerRef.current) clearInterval(sleepTimerRef.current);
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
