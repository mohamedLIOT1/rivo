import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translate, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../i18n';
import { useUser } from './UserContext';

const LANGUAGE_STORAGE_KEY = '@rivo_language_preference';
const LEGACY_STORAGE_KEY = '@rivo_language';
export const LITE_MODE_STORAGE_KEY = '@rivo_lite_mode';

export const getDefaultLiteMode = () => {
  if (Platform.OS !== 'android') return false;
  const apiLevel = Number(Platform.Version);
  return Number.isFinite(apiLevel) && apiLevel > 0 && apiLevel <= 27;
};

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
  isLiteMode: getDefaultLiteMode(),
  isLowEndAndroid: getDefaultLiteMode(),
  setLiteMode: () => {},
  toggleLiteMode: () => {},
});

export const LocalizationProvider = ({ children }) => {
  const isLowEndAndroid = useMemo(() => getDefaultLiteMode(), []);
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);
  const [isLanguageLoaded, setIsLanguageLoaded] = useState(false);
  const [isLiteMode, setIsLiteModeState] = useState(isLowEndAndroid);

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

  // 1. Initial Storage Hydration (Language + Lite Mode)
  useEffect(() => {
    let isMounted = true;

    const loadPreferences = async () => {
      try {
        const [storedLang, legacyLang, storedLite] = await Promise.all([
          AsyncStorage.getItem(LANGUAGE_STORAGE_KEY),
          AsyncStorage.getItem(LEGACY_STORAGE_KEY),
          AsyncStorage.getItem(LITE_MODE_STORAGE_KEY),
        ]);

        const saved = storedLang || legacyLang;

        if (isMounted) {
          if (saved === 'ar' || saved === 'en') {
            setLanguageState(saved);
          } else if (currentUser?.preferredLanguage === 'ar' || currentUser?.preferredLanguage === 'en') {
            setLanguageState(currentUser.preferredLanguage);
          }

          if (storedLite === 'true') {
            setIsLiteModeState(true);
          } else if (storedLite === 'false') {
            setIsLiteModeState(false);
          } else {
            setIsLiteModeState(isLowEndAndroid);
          }
        }
      } catch (err) {
        console.warn('[LocalizationContext] Error loading preferences:', err);
      } finally {
        if (isMounted) {
          setIsLanguageLoaded(true);
        }
      }
    };

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, [currentUser?.preferredLanguage, isLowEndAndroid]);

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

  const setLiteMode = useCallback((enabled) => {
    const next = Boolean(enabled);
    setIsLiteModeState(next);
    AsyncStorage.setItem(LITE_MODE_STORAGE_KEY, String(next)).catch(() => {});
  }, []);

  const toggleLiteMode = useCallback((explicitVal) => {
    setIsLiteModeState((prev) => {
      const next = typeof explicitVal === 'boolean' ? explicitVal : !prev;
      AsyncStorage.setItem(LITE_MODE_STORAGE_KEY, String(next)).catch(() => {});
      return next;
    });
  }, []);

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
    isLiteMode,
    isLowEndAndroid,
    setLiteMode,
    toggleLiteMode,
  }), [
    language,
    isRTL,
    dir,
    textAlign,
    flexDirection,
    setLanguage,
    t,
    isLanguageLoaded,
    isLiteMode,
    isLowEndAndroid,
    setLiteMode,
    toggleLiteMode,
  ]);

  return (
    <LocalizationContext.Provider value={value}>
      {children}
    </LocalizationContext.Provider>
  );
};

export const useTranslation = () => useContext(LocalizationContext);
export const useLocalization = useTranslation;

export const useLiteMode = () => {
  const ctx = useContext(LocalizationContext);
  return useMemo(() => ({
    isLiteMode: Boolean(ctx?.isLiteMode),
    isLowEndAndroid: Boolean(ctx?.isLowEndAndroid),
    setLiteMode: ctx?.setLiteMode || (() => {}),
    toggleLiteMode: ctx?.toggleLiteMode || (() => {}),
  }), [ctx?.isLiteMode, ctx?.isLowEndAndroid, ctx?.setLiteMode, ctx?.toggleLiteMode]);
};

export default LocalizationContext;
