import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { API_BASE_URL } from '../config';
import { translate, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE } from '../i18n';

const PreferencesContext = createContext(null);

const DEFAULT_CONTENT_MODES = {
  music: true,
  quran: true,
  podcasts: true
};

export function PreferencesProvider({ children, currentUser }) {
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem('rivo_language') || localStorage.getItem('@rivo_language_preference');
      if (saved === 'ar' || saved === 'en') return saved;
    } catch {}
    return DEFAULT_LANGUAGE;
  });

  const isRTL = language === 'ar';
  // Keep structural shell dir as 'ltr' so modern web app layout (sidebar left, friends right, player bar) stays intact
  const dir = 'ltr';

  // Apply language attributes to document while preserving stable LTR application shell
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = 'ltr';
      document.body.dir = 'ltr';
      document.documentElement.lang = language;
      if (isRTL) {
        document.documentElement.classList.add('rtl');
        document.body.classList.add('rtl');
      } else {
        document.documentElement.classList.remove('rtl');
        document.body.classList.remove('rtl');
      }
    }
  }, [language, isRTL]);

  const [vocalOnlyMode, setVocalOnlyModeState] = useState(() => {
    try {
      return localStorage.getItem('rivo_vocal_only') === 'true';
    } catch {}
    return false;
  });

  const [autoDownloadFinished, setAutoDownloadFinishedState] = useState(() => {
    try {
      const saved = localStorage.getItem('rivo_auto_download_finished');
      if (saved === 'false') return false;
      if (saved === 'true') return true;
    } catch {}
    return true;
  });

  const setAutoDownloadFinished = useCallback((val) => {
    const next = Boolean(val);
    setAutoDownloadFinishedState(next);
    try {
      localStorage.setItem('rivo_auto_download_finished', next ? 'true' : 'false');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rivo-auto-download-changed', { detail: { enabled: next } }));
      }
    } catch {}
  }, []);

  const toggleAutoDownloadFinished = useCallback((overrideVal) => {
    setAutoDownloadFinishedState((prev) => {
      const next = typeof overrideVal === 'boolean' ? overrideVal : !prev;
      try {
        localStorage.setItem('rivo_auto_download_finished', next ? 'true' : 'false');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('rivo-auto-download-changed', { detail: { enabled: next } }));
        }
      } catch {}
      return next;
    });
  }, []);

  const toggleVocalOnlyMode = useCallback((overrideVal) => {
    setVocalOnlyModeState(prev => {
      const next = typeof overrideVal === 'boolean' ? overrideVal : !prev;
      try {
        localStorage.setItem('rivo_vocal_only', next ? 'true' : 'false');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('rivo-vocal-mode-changed', { detail: { enabled: next } }));
        }
      } catch {}
      return next;
    });
  }, []);

  const [contentModes, setContentModesState] = useState(() => {
    try {
      const saved = localStorage.getItem('rivo_content_modes');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          music: parsed.music !== false,
          quran: parsed.quran !== false,
          podcasts: parsed.podcasts !== false,
        };
      }
    } catch {}
    return DEFAULT_CONTENT_MODES;
  });

  // Sync preferences from server if user is logged in
  useEffect(() => {
    const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
    if (!token) return;

    const controller = new AbortController();
    fetch(`${API_BASE_URL}/api/users/preferences`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (controller.signal.aborted) return;
        if (data?.success && data?.preferences) {
          if (data.preferences.contentModes) {
            setContentModesState(prev => ({
              ...DEFAULT_CONTENT_MODES,
              ...prev,
              ...data.preferences.contentModes,
              podcasts: data.preferences.contentModes.podcasts !== false
            }));
            localStorage.setItem('rivo_content_modes', JSON.stringify({
              ...DEFAULT_CONTENT_MODES,
              ...data.preferences.contentModes,
              podcasts: data.preferences.contentModes.podcasts !== false
            }));
          }
          if (data.preferences.preferredLanguage === 'ar' || data.preferences.preferredLanguage === 'en') {
            setLanguageState(data.preferences.preferredLanguage);
            localStorage.setItem('rivo_language', data.preferences.preferredLanguage);
          }
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, [currentUser?.id, currentUser?._id]);

  const setLanguage = useCallback((newLang) => {
    if (newLang !== 'ar' && newLang !== 'en') return;
    setLanguageState(newLang);
    try {
      localStorage.setItem('rivo_language', newLang);
      localStorage.setItem('@rivo_language_preference', newLang);
    } catch {}

    const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
    if (token) {
      fetch(`${API_BASE_URL}/api/users/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ preferredLanguage: newLang })
      }).catch(() => {});
    }
  }, []);

  const t = useCallback((keyPath, params) => {
    return translate(language, keyPath, params);
  }, [language]);

  // Toggle Content Mode (e.g. disable music for Islamic mode)
  const toggleContentMode = useCallback((modeKey, isEnabled) => {
    setContentModesState(prev => {
      const updated = {
        ...prev,
        [modeKey]: isEnabled
      };
      localStorage.setItem('rivo_content_modes', JSON.stringify(updated));

      const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
      if (token) {
        fetch(`${API_BASE_URL}/api/users/preferences`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ contentModes: updated })
        }).catch(() => {});
      }
      return updated;
    });
  }, []);

  const showMusic = contentModes.music !== false;
  const showQuran = contentModes.quran !== false;
  const showPodcasts = contentModes.podcasts !== false;

  const value = useMemo(() => ({
    language,
    isRTL,
    dir,
    setLanguage,
    t,
    supportedLanguages: SUPPORTED_LANGUAGES,
    contentModes,
    toggleContentMode,
    showMusic,
    showQuran,
    showPodcasts,
    showAudiobooks: false,
    isPureIslamicMode: !showMusic,
    vocalOnlyMode,
    toggleVocalOnlyMode,
    autoDownloadFinished,
    setAutoDownloadFinished,
    toggleAutoDownloadFinished
  }), [
    language,
    isRTL,
    dir,
    setLanguage,
    t,
    contentModes,
    toggleContentMode,
    showMusic,
    showQuran,
    showPodcasts,
    vocalOnlyMode,
    toggleVocalOnlyMode,
    autoDownloadFinished,
    setAutoDownloadFinished,
    toggleAutoDownloadFinished
  ]);

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    return {
      language: DEFAULT_LANGUAGE,
      isRTL: false,
      dir: 'ltr',
      setLanguage: () => {},
      t: (k) => k,
      supportedLanguages: SUPPORTED_LANGUAGES,
      contentModes: DEFAULT_CONTENT_MODES,
      toggleContentMode: () => {},
      showMusic: true,
      showQuran: true,
      showPodcasts: true,
      showAudiobooks: false,
      isPureIslamicMode: false,
      vocalOnlyMode: false,
      toggleVocalOnlyMode: () => {},
      autoDownloadFinished: true,
      setAutoDownloadFinished: () => {},
      toggleAutoDownloadFinished: () => {}
    };
  }
  return ctx;
}

export function useTranslation() {
  const { language, isRTL, dir, setLanguage, t, supportedLanguages } = usePreferences();
  return { language, isRTL, dir, setLanguage, t, supportedLanguages };
}
