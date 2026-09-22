import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ConnectivityContext = createContext(null);

const PREF_KEY = '@rivo_connectivity_pref';

/**
 * ConnectivityProvider
 *
 * Tracks network state and provides an appMode ('online' | 'offline')
 * Allows user to smoothly toggle between Online and Offline mode anytime.
 */
export function ConnectivityProvider({ children }) {
  const [networkState, setNetworkState] = useState({
    isConnected: true,
    isWifi: true,
    type: 'wifi',
  });

  const [userPreference, setUserPreference] = useState(null); // 'online' | 'offline' | null (auto)
  const [appMode, setAppMode] = useState('online');
  const [ready, setReady] = useState(false);
  const prefRef = useRef(null);

  // Clear any legacy manual preference so it never interferes with automatic mode
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.removeItem(PREF_KEY);
      } catch {}
      setReady(true);
    })();
  }, []);

  // NetInfo real-time listener - strictly automatic mode switching
  useEffect(() => {
    const handleConnectivityChange = (state) => {
      const isConnected = !!state.isConnected && state.isInternetReachable !== false;
      const newNetState = {
        isConnected,
        isWifi: state.type === 'wifi',
        type: state.type || 'unknown',
      };
      setNetworkState(newNetState);
      // Strictly automatic: online when connected, offline when disconnected
      setAppMode(isConnected ? 'online' : 'offline');
      setReady(true);
    };

    const unsubscribe = NetInfo.addEventListener(handleConnectivityChange);
    NetInfo.fetch().then(handleConnectivityChange);

    return () => unsubscribe();
  }, []);

  const toggleMode = useCallback(() => {
    // Mode is automatic; keep stub to prevent crashes if called
  }, []);

  const resetToAuto = useCallback(() => {
    const isConnected = networkState.isConnected;
    setAppMode(isConnected ? 'online' : 'offline');
  }, [networkState.isConnected]);

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
