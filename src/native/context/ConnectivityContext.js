import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ConnectivityContext = createContext(null);

const PREF_KEY = '@rivo_connectivity_pref';

/**
 * ConnectivityProvider
 *
 * Tracks real-time network state via NetInfo and exposes an appMode
 * ('online' | 'offline') that drives the top-level mode router.
 *
 * Modes:
 *  - Auto (default): appMode follows WiFi / connectivity state.
 *  - Manual: User overrides mode via toggle; persisted in AsyncStorage.
 */
export function ConnectivityProvider({ children }) {
  const [networkState, setNetworkState] = useState({
    isConnected: true,
    isWifi: true,
    type: 'wifi',
  });

  // 'auto' | 'online' | 'offline'
  const [userPreference, setUserPreference] = useState('auto');
  const [appMode, setAppMode] = useState('online');
  const [ready, setReady] = useState(false);

  // Keep a ref so the NetInfo callback always sees latest preference
  const prefRef = useRef(userPreference);
  prefRef.current = userPreference;

  // ─── Load persisted preference ───────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(PREF_KEY);
        if (saved === 'online' || saved === 'offline') {
          setUserPreference(saved);
          prefRef.current = saved;
        }
      } catch {}
      setReady(true);
    })();
  }, []);

  // ─── Derive appMode from network + preference ───────────────
  const deriveMode = useCallback((netState, pref) => {
    if (pref === 'online') return 'online';
    if (pref === 'offline') return 'offline';
    // Auto: online when connected, offline otherwise
    return netState.isConnected ? 'online' : 'offline';
  }, []);

  // ─── Subscribe to NetInfo ────────────────────────────────────
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const newNetState = {
        isConnected: !!state.isConnected,
        isWifi: state.type === 'wifi',
        type: state.type || 'unknown',
      };
      setNetworkState(newNetState);
      setAppMode(deriveMode(newNetState, prefRef.current));
    });

    // Also do an immediate fetch
    NetInfo.fetch().then((state) => {
      const newNetState = {
        isConnected: !!state.isConnected,
        isWifi: state.type === 'wifi',
        type: state.type || 'unknown',
      };
      setNetworkState(newNetState);
      setAppMode(deriveMode(newNetState, prefRef.current));
    });

    return () => unsubscribe();
  }, [deriveMode]);

  // ─── Re-derive when preference changes ──────────────────────
  useEffect(() => {
    if (ready) {
      setAppMode(deriveMode(networkState, userPreference));
    }
  }, [userPreference, ready]);

  // ─── Toggle between online/offline (manual override) ────────
  const toggleMode = useCallback(async () => {
    const next = appMode === 'online' ? 'offline' : 'online';
    setUserPreference(next);
    prefRef.current = next;
    setAppMode(next);
    try {
      await AsyncStorage.setItem(PREF_KEY, next);
    } catch {}
  }, [appMode]);

  // ─── Reset to auto (follow network) ─────────────────────────
  const resetToAuto = useCallback(async () => {
    setUserPreference('auto');
    prefRef.current = 'auto';
    setAppMode(deriveMode(networkState, 'auto'));
    try {
      await AsyncStorage.setItem(PREF_KEY, 'auto');
    } catch {}
  }, [networkState, deriveMode]);

  const isAutoMode = userPreference === 'auto';

  const value = {
    networkState,
    appMode,
    isAutoMode,
    userPreference,
    toggleMode,
    resetToAuto,
    ready,
  };

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
