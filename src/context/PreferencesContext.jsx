import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

const PreferencesContext = createContext(null);

const DEFAULT_CONTENT_MODES = {
  music: true,
  quran: true,
  podcasts: true,
  audiobooks: true
};

export function PreferencesProvider({ children, currentUser }) {
  const [language, setLanguageState] = useState(() => {
    return localStorage.getItem('rivo_language') || 'ar';
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

  // Update Language
  const setLanguage = async (newLang) => {
    setLanguageState(newLang);
    localStorage.setItem('rivo_language', newLang);

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
  const toggleContentMode = async (modeKey, isEnabled) => {
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
  const showPodcasts = contentModes.podcasts !== false;
  const showAudiobooks = contentModes.audiobooks !== false;

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
      language: 'ar',
      setLanguage: () => {},
      contentModes: DEFAULT_CONTENT_MODES,
      toggleContentMode: () => {},
      showMusic: true,
      showQuran: true,
      showPodcasts: true,
      showAudiobooks: true,
      isPureIslamicMode: false
    };
  }
  return ctx;
}
