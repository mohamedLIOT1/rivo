import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translate, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../i18n';
import { useUser } from './UserContext';

const LANGUAGE_STORAGE_KEY = '@rivo_language_preference';
const LEGACY_STORAGE_KEY = '@rivo_language';

export const LocalizationContext = createContext({
  language: DEFAULT_LANGUAGE,
  isRTL: false,
  dir: 'ltr',
  textAlign: 'left',
  flexDirection: 'row',
  supportedLanguages: SUPPORTED_LANGUAGES,
  setLanguage: () => {},
  t: (key, params) => key,
  isLanguageLoaded: false,
});

export const LocalizationProvider = ({ children }) => {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);
  const [isLanguageLoaded, setIsLanguageLoaded] = useState(false);

  // Safely extract UserContext if wrapped inside UserProvider
  let currentUser = null;
  let updateProfile = null;
  try {
    const userContext = useUser();
    if (userContext) {
      currentUser = userContext.currentUser;
      updateProfile = userContext.updateProfile;
    }
  } catch {
    // LocalizationProvider can function independently if mounted outside UserProvider
  }

  // 1. Initial Storage Hydration
  useEffect(() => {
    let isMounted = true;

    const loadLanguage = async () => {
      try {
        const [storedLang, legacyLang] = await Promise.all([
          AsyncStorage.getItem(LANGUAGE_STORAGE_KEY),
          AsyncStorage.getItem(LEGACY_STORAGE_KEY),
        ]);

        const saved = storedLang || legacyLang;

        if (isMounted) {
          if (saved === 'ar' || saved === 'en') {
            setLanguageState(saved);
          } else if (currentUser?.preferredLanguage === 'ar' || currentUser?.preferredLanguage === 'en') {
            setLanguageState(currentUser.preferredLanguage);
          }
        }
      } catch (err) {
        console.warn('[LocalizationContext] Error loading stored language:', err);
      } finally {
        if (isMounted) {
          setIsLanguageLoaded(true);
        }
      }
    };

    loadLanguage();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.preferredLanguage]);

  // 2. Set Language Handler (Immediate state update + Persistent Storage + Profile Sync)
  const setLanguage = useCallback(async (newLang) => {
    if (newLang !== 'ar' && newLang !== 'en') return;

    setLanguageState(newLang);

    try {
      await Promise.all([
        AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, newLang),
        AsyncStorage.setItem(LEGACY_STORAGE_KEY, newLang),
      ]);
    } catch (err) {
      console.warn('[LocalizationContext] Failed to persist language:', err);
    }

    // Optional background sync with server profile
    if (updateProfile && typeof updateProfile === 'function') {
      try {
        updateProfile({ preferredLanguage: newLang }).catch(() => {});
      } catch {}
    }
  }, [updateProfile]);

  // 3. Translation Helper
  const t = useCallback((keyPath, params) => {
    return translate(language, keyPath, params);
  }, [language]);

  // 4. RTL / Directional Helpers
  const isRTL = language === 'ar';
  const dir = isRTL ? 'rtl' : 'ltr';
  const textAlign = isRTL ? 'right' : 'left';
  const flexDirection = isRTL ? 'row-reverse' : 'row';

  // 5. Memoized Provider Value (Strict AGENTS.md rule)
  const value = useMemo(() => ({
    language,
    isRTL,
    dir,
    textAlign,
    flexDirection,
    supportedLanguages: SUPPORTED_LANGUAGES,
    setLanguage,
    t,
    isLanguageLoaded,
  }), [
    language,
    isRTL,
    dir,
    textAlign,
    flexDirection,
    setLanguage,
    t,
    isLanguageLoaded,
  ]);

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
};

export const useTranslation = () => useContext(LocalizationContext);
export const useLocalization = useTranslation;

export default LocalizationContext;
