import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Home, Music, BookOpen, Disc, Download } from 'lucide-react-native';
import { API_BASE_URL } from '../config';

const NAV_STYLE_STORAGE_KEY = '@rivo_native_nav_style_v1';
const HIDDEN_ITEMS_STORAGE_KEY = '@rivo_native_hidden_items_v1';

export const NAV_MENU_ITEMS = [
  { id: 'music', label: 'Music', icon: Music, screen: 'music' },
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

  // Load from local storage
  useEffect(() => {
    (async () => {
      try {
        const [savedStyle, savedHidden] = await Promise.all([
          AsyncStorage.getItem(NAV_STYLE_STORAGE_KEY),
          AsyncStorage.getItem(HIDDEN_ITEMS_STORAGE_KEY),
        ]);

        if (savedStyle === 'fab' || savedStyle === 'classic') {
          setNavStyleState(savedStyle);
        } else {
          setNavStyleState('classic');
        }

        if (savedHidden) {
          const parsed = JSON.parse(savedHidden);
          if (Array.isArray(parsed)) {
            // Migrate legacy 'home' hidden item to 'music'
            const cleaned = parsed.map(id => id === 'home' ? 'music' : id).filter(id => id !== 'home');
            setHiddenMenuItems(Array.from(new Set(cleaned)));
          }
        }
      } catch (err) {
        console.warn('Error loading nav preferences:', err);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  // Sync with remote user preferences if token exists
  useEffect(() => {
    (async () => {
      try {
        const token = (await AsyncStorage.getItem('rivo_token')) || (await AsyncStorage.getItem('token'));
        if (!token) return;

        const res = await fetch(`${API_BASE_URL}/api/users/preferences`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data?.success && data?.preferences?.contentModes) {
          const modes = data.preferences.contentModes;
          setHiddenMenuItems((prev) => {
            const next = new Set(prev);
            if (modes.music === false) next.add('music');
            else next.delete('music');
            if (modes.quran === false) next.add('quran');
            else next.delete('quran');
            return Array.from(next);
          });
        }
      } catch {}
    })();
  }, []);

  const setNavStyle = useCallback((style) => {
    if (style !== 'fab' && style !== 'classic') return;
    setNavStyleState(style);
    AsyncStorage.setItem(NAV_STYLE_STORAGE_KEY, style).catch(() => {});
  }, []);

  const toggleMenuItemVisibility = useCallback((itemId) => {
    setHiddenMenuItems((prev) => {
      const isCurrentlyHidden = prev.includes(itemId);
      let next;
      if (isCurrentlyHidden) {
        // Unhide
        next = prev.filter((id) => id !== itemId);
      } else {
        // Ensure at least 1 item stays visible
        const remainingCount = NAV_MENU_ITEMS.length - prev.length - 1;
        if (remainingCount < 1) {
          return prev;
        }
        next = [...prev, itemId];
      }

      AsyncStorage.setItem(HIDDEN_ITEMS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});

      // Sync content modes to server if logged in
      (async () => {
        try {
          const token = (await AsyncStorage.getItem('rivo_token')) || (await AsyncStorage.getItem('token'));
          if (token) {
            const contentModes = {
              music: !next.includes('music'),
              quran: !next.includes('quran'),
            };
            fetch(`${API_BASE_URL}/api/users/preferences`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
              },
              body: JSON.stringify({ contentModes })
            }).catch(() => {});
          }
        } catch {}
      })();

      return next;
    });
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

  return (
    <NavPreferencesContext.Provider
      value={{
        navStyle,
        setNavStyle,
        hiddenMenuItems,
        toggleMenuItemVisibility,
        isItemVisible,
        visibleMenuItems,
        firstVisibleTab,
        menuItems: NAV_MENU_ITEMS,
        isLoaded,
      }}
    >
      {children}
    </NavPreferencesContext.Provider>
  );
};

export const useNavPreferences = () => useContext(NavPreferencesContext);
