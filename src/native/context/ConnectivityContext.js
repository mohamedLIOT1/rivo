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

  const [appMode, setAppMode] = useState('online');
  const [ready, setReady] = useState(false);

  // ─── Purge any stale manual user preference ───────────────────
  useEffect(() => {
    AsyncStorage.removeItem(PREF_KEY).catch(() => {});
  }, []);

  // ─── Subscribe to NetInfo for strict real-time enforcement ───
  useEffect(() => {
    const handleConnectivityChange = (state) => {
      const isOnline = !!state.isConnected && state.isInternetReachable !== false;
      const newNetState = {
        isConnected: !!state.isConnected,
        isWifi: state.type === 'wifi',
        type: state.type || 'unknown',
      };
      setNetworkState(newNetState);
      setAppMode(isOnline ? 'online' : 'offline');
      setReady(true);
    };

    const unsubscribe = NetInfo.addEventListener(handleConnectivityChange);

    // Initial fetch
    NetInfo.fetch().then(handleConnectivityChange);

    return () => unsubscribe();
  }, []);

  // Manual toggle is disabled to enforce mandatory network-driven mode switching
  const toggleMode = useCallback(() => {
    // No-op: automatic mode is strictly enforced
  }, []);

  const resetToAuto = useCallback(() => {
    // No-op: always in automatic mode
  }, []);

  const value = {
    networkState,
    appMode,
    isAutoMode: true,
    userPreference: 'auto',
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
