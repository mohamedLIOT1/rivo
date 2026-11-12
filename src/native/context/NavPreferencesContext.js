import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Home, Music, BookOpen, Disc, Download, Radio } from 'lucide-react-native';
import { API_BASE_URL } from '../config';

const NAV_STYLE_STORAGE_KEY = '@rivo_native_nav_style_v1';
const HIDDEN_ITEMS_STORAGE_KEY = '@rivo_native_hidden_items_v1';

export const NAV_MENU_ITEMS = [
  { id: 'music', label: 'Music', icon: Music, screen: 'music' },
  { id: 'podcasts', label: 'Podcasts', icon: Radio, screen: 'podcasts' },
  { id: 'quran', label: 'Quran', icon: BookOpen, screen: 'quran' },
  { id: 'library', label: 'Playlists', icon: Disc, screen: 'library' },
  { id: 'offline', label: 'Vault', icon: Download, screen: 'offline' },
];

const NavPreferencesContext = createContext({
  navStyle: 'classic', // 'classic' (default) | 'fab'
  setNavStyle: () => {},
  hiddenMenuItems: [],
  toggleMenuItemVisibility: () => {},
  isItemVisible: () => true,
  visibleMenuItems: NAV_MENU_ITEMS,
  menuItems: NAV_MENU_ITEMS,
});

export const NavPreferencesProvider = ({ children }) => {
  const [navStyle, setNavStyleState] = useState('classic');
  const [hiddenMenuItems, setHiddenMenuItems] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const hasLocalToggleRef = React.useRef(false);

  // Load from local storage first, then reconcile with remote preferences if logged in
  useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    (async () => {
      let localList = [];
      try {
        const [savedStyle, savedHidden] = await Promise.all([
          AsyncStorage.getItem(NAV_STYLE_STORAGE_KEY),
          AsyncStorage.getItem(HIDDEN_ITEMS_STORAGE_KEY),
        ]);

        if (!mounted) return;
        if (savedStyle === 'fab' || savedStyle === 'classic') {
          setNavStyleState(savedStyle);
        } else {
          setNavStyleState('classic');
        }

        if (savedHidden) {
          const parsed = JSON.parse(savedHidden);
          if (Array.isArray(parsed)) {
            const cleaned = parsed.map(id => id === 'home' ? 'music' : id).filter(id => id !== 'home');
            localList = Array.from(new Set(cleaned));
            setHiddenMenuItems(localList);
          }
        }
      } catch (err) {
        console.warn('Error loading nav preferences:', err);
      } finally {
        if (mounted) setIsLoaded(true);
      }

      try {
        const token = (await AsyncStorage.getItem('@rivo_auth_token_v2')) || (await AsyncStorage.getItem('rivo_token')) || (await AsyncStorage.getItem('token')) || (await AsyncStorage.getItem('liofy_token'));
        if (!token || controller.signal.aborted || hasLocalToggleRef.current) return;

        const res = await fetch(`${API_BASE_URL}/api/users/preferences`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok || controller.signal.aborted || hasLocalToggleRef.current) return;
        const data = await res.json();
        if (data?.success && data?.preferences?.contentModes && mounted && !hasLocalToggleRef.current) {
          const modes = data.preferences.contentModes;
          setHiddenMenuItems((prev) => {
            const next = new Set(prev);
            if (modes.music === false) next.add('music');
            else next.delete('music');
            if (modes.podcasts === false) next.add('podcasts');
            else next.delete('podcasts');
            if (modes.quran === false) next.add('quran');
            else next.delete('quran');
            const arr = Array.from(next);
            AsyncStorage.setItem(HIDDEN_ITEMS_STORAGE_KEY, JSON.stringify(arr)).catch(() => {});
            return arr;
          });
        }
      } catch {}
    })();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, []);

  const setNavStyle = useCallback((style) => {
    if (style !== 'fab' && style !== 'classic') return;
    setNavStyleState(style);
    AsyncStorage.setItem(NAV_STYLE_STORAGE_KEY, style).catch(() => {});
  }, []);

  const hiddenMenuItemsRef = React.useRef(hiddenMenuItems);
  hiddenMenuItemsRef.current = hiddenMenuItems;

  const toggleMenuItemVisibility = useCallback((itemId) => {
    hasLocalToggleRef.current = true;
    const prev = hiddenMenuItemsRef.current || [];
    const isCurrentlyHidden = prev.includes(itemId);
    let next;
    if (isCurrentlyHidden) {
      next = prev.filter((id) => id !== itemId);
    } else {
      const remainingCount = NAV_MENU_ITEMS.length - prev.length - 1;
      if (remainingCount < 1) return;
      next = [...prev, itemId];
    }

    hiddenMenuItemsRef.current = next;
    setHiddenMenuItems(next);
    AsyncStorage.setItem(HIDDEN_ITEMS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});

    (async () => {
      try {
        const token = (await AsyncStorage.getItem('@rivo_auth_token_v2')) || (await AsyncStorage.getItem('rivo_token')) || (await AsyncStorage.getItem('token')) || (await AsyncStorage.getItem('liofy_token'));
        if (token) {
          const contentModes = {
            music: !next.includes('music'),
            podcasts: !next.includes('podcasts'),
            quran: !next.includes('quran'),
          };
          await fetch(`${API_BASE_URL}/api/users/preferences`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ contentModes })
          });
        }
      } catch {}
    })();
  }, []);

  const isItemVisible = useCallback((itemId) => {
    return !hiddenMenuItems.includes(itemId);
  }, [hiddenMenuItems]);

  const visibleMenuItems = useMemo(() => {
    return NAV_MENU_ITEMS.filter((item) => !hiddenMenuItems.includes(item.id));
  }, [hiddenMenuItems]);

  const firstVisibleTab = useMemo(() => {
    return visibleMenuItems[0]?.screen || 'music';
  }, [visibleMenuItems]);

  const value = useMemo(() => ({
    navStyle,
    setNavStyle,
    hiddenMenuItems,
    toggleMenuItemVisibility,
    isItemVisible,
    visibleMenuItems,
    firstVisibleTab,
    menuItems: NAV_MENU_ITEMS,
    isLoaded,
  }), [
    navStyle,
    hiddenMenuItems,
    toggleMenuItemVisibility,
    isItemVisible,
    visibleMenuItems,
    firstVisibleTab,
    isLoaded,
  ]);

  return (
    <NavPreferencesContext.Provider value={value}>
      {children}
    </NavPreferencesContext.Provider>
  );
};

export const useNavPreferences = () => useContext(NavPreferencesContext);
