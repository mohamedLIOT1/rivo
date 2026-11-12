import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

const ConnectivityContext = createContext(null);

const PREF_KEY = '@rivo_connectivity_pref';
const OFFLINE_DEBOUNCE_MS = 4000;
const RESUME_GRACE_MS = 5500;

/**
 * ConnectivityProvider
 *
 * Tracks network state and provides an appMode ('online' | 'offline')
 * with wake-up grace + debounce so lock-screen unlocks never flash false offline UI.
 */
export function ConnectivityProvider({ children }) {
  const [networkState, setNetworkState] = useState({
    isConnected: true,
    isWifi: true,
    type: 'wifi',
  });

  const [appMode, setAppMode] = useState('online');
  const [ready, setReady] = useState(false);
  const offlineDebounceRef = useRef(null);
  const lastResumeTsRef = useRef(0);
  const currentAppModeRef = useRef('online');
  currentAppModeRef.current = appMode;

  const clearOfflineDebounce = useCallback(() => {
    if (offlineDebounceRef.current) {
      clearTimeout(offlineDebounceRef.current);
      offlineDebounceRef.current = null;
    }
  }, []);

  // Clear any legacy manual preference so it never interferes with automatic mode
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.removeItem(PREF_KEY);
      } catch {}
      setReady(true);
    })();
  }, []);

  // NetInfo real-time listener + AppState foreground resume grace
  useEffect(() => {
    let mounted = true;

    const applyNetState = (state, isInitialFetch = false) => {
      if (!mounted || !state) return;
      const hasCarrier = Boolean(state.isConnected) && state.type !== 'none';
      const isReachable = hasCarrier && state.isInternetReachable !== false;

      const newNetState = {
        isConnected: hasCarrier,
        isWifi: state.type === 'wifi',
        type: state.type || 'unknown',
      };
      setNetworkState(newNetState);
      setReady(true);

      if (isReachable) {
        clearOfflineDebounce();
        if (currentAppModeRef.current !== 'online') {
          setAppMode('online');
        }
        return;
      }

      // Immediately after unlocking / foreground resume, radio often probes reachability for 1-4s.
      // Debounce going offline (even on initial startup if carrier is present and probe hasn't settled).
      if (isInitialFetch && !hasCarrier && state.type === 'none') {
        setAppMode('offline');
        return;
      }

      const sinceResume = Date.now() - lastResumeTsRef.current;
      const delayMs = sinceResume < RESUME_GRACE_MS ? RESUME_GRACE_MS - sinceResume + 1200 : OFFLINE_DEBOUNCE_MS;
      clearOfflineDebounce();
      offlineDebounceRef.current = setTimeout(() => {
        if (!mounted) return;
        NetInfo.fetch()
          .then((latest) => {
            if (!mounted || !latest) return;
            const ok = Boolean(latest.isConnected) && latest.type !== 'none' && latest.isInternetReachable !== false;
            setAppMode(ok ? 'online' : 'offline');
          })
          .catch(() => {
            if (mounted) setAppMode('offline');
          });
      }, delayMs);
    };

    const unsubscribeNet = NetInfo.addEventListener((state) => applyNetState(state, false));
    NetInfo.fetch().then((state) => applyNetState(state, true)).catch(() => {});

    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        lastResumeTsRef.current = Date.now();
        // Give Wi-Fi/Cellular radio a brief moment to re-associate before judging reachability
        NetInfo.fetch().then((state) => applyNetState(state, false)).catch(() => {});
      }
    });

    return () => {
      mounted = false;
      clearOfflineDebounce();
      unsubscribeNet();
      appStateSub?.remove?.();
    };
  }, [clearOfflineDebounce]);

  const toggleMode = useCallback(() => {
    setAppMode(prev => (prev === 'online' ? 'offline' : 'online'));
  }, []);

  const resetToAuto = useCallback(() => {
    const isConnected = networkState.isConnected;
    setAppMode(isConnected ? 'online' : 'offline');
  }, [networkState.isConnected]);

  const setMode = useCallback((mode) => {
    setAppMode(mode);
  }, []);

  const value = useMemo(() => ({
    networkState,
    appMode,
    setAppMode,
    setMode,
    isAutoMode: true,
    userPreference: 'auto',
    toggleMode,
    resetToAuto,
    ready,
  }), [networkState, appMode, setMode, toggleMode, resetToAuto, ready]);

  return (
    <ConnectivityContext.Provider value={value}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity() {
  const ctx = useContext(ConnectivityContext);
  if (!ctx) {
    throw new Error('useConnectivity must be used within ConnectivityProvider');
  }
  return ctx;
}

export default ConnectivityContext;
