import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

const PreferencesContext = createContext(null);

const DEFAULT_CONTENT_MODES = {
  music: true,
  quran: true,
  podcasts: false,
  audiobooks: false
};

export function PreferencesProvider({ children, currentUser }) {
  // Default language is English ('en') per user specification
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('rivo_language') || 'en';
  });

  const [contentModes, setContentModesState] = useState(() => {
    try {
      const saved = localStorage.getItem('rivo_content_modes');
      if (saved) return { ...DEFAULT_CONTENT_MODES, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_CONTENT_MODES;
  });

  // Apply HTML direction when language changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = language;
    }
    localStorage.setItem('rivo_language', language);
  }, [language]);

  // Sync preferences from server if user is logged in
  useEffect(() => {
    const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
    if (!token) return;

    fetch(`${API_BASE_URL}/api/users/preferences`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data?.success && data?.preferences) {
          if (data.preferences.language) {
            setLanguageState(data.preferences.language);
          }
          if (data.preferences.contentModes) {
            setContentModesState(prev => ({
              ...prev,
              ...data.preferences.contentModes
            }));
            localStorage.setItem('rivo_content_modes', JSON.stringify(data.preferences.contentModes));
          }
        }
      })
      .catch(() => {});
  }, [currentUser?.id, currentUser?._id]);

  // Update Language with instant synchronous DOM direction update
  const setLanguage = (newLang) => {
    setLanguageState(newLang);
    localStorage.setItem('rivo_language', newLang);
    if (typeof document !== 'undefined') {
      document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = newLang;
    }

    const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
    if (token) {
      fetch(`${API_BASE_URL}/api/users/preferences`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ language: newLang })
      }).catch(() => {});
    }
  };

  // Toggle Content Mode (e.g. disable music for Islamic mode)
  const toggleContentMode = (modeKey, isEnabled) => {
    const updated = {
      ...contentModes,
      [modeKey]: isEnabled
    };

    setContentModesState(updated);
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
  };

  const showMusic = contentModes.music !== false;
  const showQuran = contentModes.quran !== false;
  const showPodcasts = contentModes.podcasts === true;
  const showAudiobooks = contentModes.audiobooks === true;

  return (
    <PreferencesContext.Provider
      value={{
        language,
        setLanguage,
        contentModes,
        toggleContentMode,
        showMusic,
        showQuran,
        showPodcasts,
        showAudiobooks,
        isPureIslamicMode: !showMusic
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) {
    return {
      language: 'en',
      setLanguage: () => {},
      contentModes: DEFAULT_CONTENT_MODES,
      toggleContentMode: () => {},
      showMusic: true,
      showQuran: true,
      showPodcasts: false,
      showAudiobooks: false,
      isPureIslamicMode: false
    };
  }
  return ctx;
}
