import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

const PreferencesContext = createContext(null);

const DEFAULT_CONTENT_MODES = {
  music: true,
  quran: true
};

export function PreferencesProvider({ children, currentUser }) {
  const language = 'en';

  const [vocalOnlyMode, setVocalOnlyModeState] = useState(() => {
    try {
      return localStorage.getItem('rivo_vocal_only') === 'true';
    } catch {}
    return false;
  });

  const toggleVocalOnlyMode = (overrideVal) => {
    const next = typeof overrideVal === 'boolean' ? overrideVal : !vocalOnlyMode;
    setVocalOnlyModeState(next);
    try {
      localStorage.setItem('rivo_vocal_only', next ? 'true' : 'false');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rivo-vocal-mode-changed', { detail: { enabled: next } }));
      }
    } catch {}
  };

  const [contentModes, setContentModesState] = useState(() => {
    try {
      const saved = localStorage.getItem('rivo_content_modes');
      if (saved) return { ...DEFAULT_CONTENT_MODES, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_CONTENT_MODES;
  });

  // Permanently enforce English and LTR layout
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = 'ltr';
      document.documentElement.lang = 'en';
    }
    localStorage.removeItem('rivo_language');
  }, []);

  // Sync preferences from server if user is logged in
  useEffect(() => {
    const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
    if (!token) return;

    fetch(`${API_BASE_URL}/api/users/preferences`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data?.success && data?.preferences?.contentModes) {
          setContentModesState(prev => ({
            ...prev,
            ...data.preferences.contentModes
          }));
          localStorage.setItem('rivo_content_modes', JSON.stringify(data.preferences.contentModes));
        }
      })
      .catch(() => {});
  }, [currentUser?.id, currentUser?._id]);

  const setLanguage = () => {};

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

  return (
    <PreferencesContext.Provider
      value={{
        language: 'en',
        setLanguage,
        contentModes,
        toggleContentMode,
        showMusic,
        showQuran,
        showPodcasts: false,
        showAudiobooks: false,
        isPureIslamicMode: !showMusic,
        vocalOnlyMode,
        toggleVocalOnlyMode
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
      isPureIslamicMode: false,
      vocalOnlyMode: false,
      toggleVocalOnlyMode: () => {}
    };
  }
  return ctx;
}
