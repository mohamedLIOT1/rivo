import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Platform } from 'react-native';

const ConnectivityContext = createContext(null);

const PREF_KEY = '@rivo_connectivity_pref';

/**
 * ConnectivityProvider
 *
 * Tracks network state and provides an appMode ('online' | 'offline')
 * Allows user to smoothly toggle between Online and Offline mode anytime.
 * Defaults to offline mode on iOS as requested.
 */
export function ConnectivityProvider({ children }) {
  const isIOS = Platform.OS === 'ios';

  const [networkState, setNetworkState] = useState({
    isConnected: true,
    isWifi: true,
    type: 'wifi',
  });

  const [userPreference, setUserPreference] = useState(isIOS ? 'offline' : null); // 'online' | 'offline' | null (auto)
  const [appMode, setAppMode] = useState(isIOS ? 'offline' : 'online');
  const [ready, setReady] = useState(false);
  const prefRef = useRef(isIOS ? 'offline' : null);

  // Clear any legacy manual preference so it never interferes with automatic mode (except on iOS default offline)
  useEffect(() => {
    (async () => {
      try {
        if (!isIOS) {
          await AsyncStorage.removeItem(PREF_KEY);
        }
      } catch {}
      setReady(true);
    })();
  }, [isIOS]);

  // NetInfo real-time listener
  useEffect(() => {
    const handleConnectivityChange = (state) => {
      const isConnected = !!state.isConnected && state.isInternetReachable !== false;
      const newNetState = {
        isConnected,
        isWifi: state.type === 'wifi',
        type: state.type || 'unknown',
      };
      setNetworkState(newNetState);

      // On iOS, start and stay offline by default unless user toggles; on other platforms, follow network connectivity
      if (!isIOS) {
        setAppMode(isConnected ? 'online' : 'offline');
      }
      setReady(true);
    };

    const unsubscribe = NetInfo.addEventListener(handleConnectivityChange);
    NetInfo.fetch().then(handleConnectivityChange);

    return () => unsubscribe();
  }, [isIOS]);

  const toggleMode = useCallback(() => {
    setAppMode(prev => (prev === 'online' ? 'offline' : 'online'));
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
