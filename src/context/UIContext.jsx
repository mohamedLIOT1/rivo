import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const UIContext = createContext(null);

export function UIProvider({ children }) {
  // ── Global Theme State ────────────────────────────────────────────────
  const [globalTheme, setGlobalTheme] = useState(() => {
    try {
      return localStorage.getItem('rivo_global_theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('rivo_global_theme', globalTheme);
    } catch {}
    if (globalTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  }, [globalTheme]);

  const toggleGlobalTheme = useCallback(() => {
    const root = document.documentElement;
    root.classList.add('disable-transitions');
    setGlobalTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (next === 'dark') {
        root.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        root.classList.remove('dark');
        document.body.classList.remove('dark');
      }
      try {
        localStorage.setItem('rivo_global_theme', next);
      } catch {}
      return next;
    });
    requestAnimationFrame(() => {
      setTimeout(() => {
        root.classList.remove('disable-transitions');
      }, 50);
    });
  }, []);

  // ── Modal History Stack Helpers ──────────────────────────────────────
  const isClosingModalViaUiRef = useRef(false);

  const pushModalHistory = useCallback((modalName) => {
    if (typeof window !== 'undefined') {
      const currentUrl = window.location.pathname + window.location.search;
      if (window.history.state?.modal) {
        window.history.replaceState({ modal: modalName }, '', currentUrl);
      } else {
        window.history.pushState({ modal: modalName }, '', currentUrl);
      }
    }
  }, []);

  const closeModalHistory = useCallback((modalName) => {
    if (typeof window !== 'undefined' && window.history.state?.modal === modalName) {
      isClosingModalViaUiRef.current = true;
      window.history.back();
    }
  }, []);

  // ── Modals State ──────────────────────────────────────────────────────
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
  const [addToPlaylistTarget, setAddToPlaylistTarget] = useState(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [isImportSongOpen, setIsImportSongOpen] = useState(false);
  const [isImportPlaylistOpen, setIsImportPlaylistOpen] = useState(false);
  const [isEditSongOpen, setIsEditSongOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState(null);
  const [isEditAlbumOpen, setIsEditAlbumOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isJamOpen, setIsJamOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatTargetUser, setChatTargetUser] = useState(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [isActivityPanelOpen, setIsActivityPanelOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('rivo_activity_panel_open') ?? localStorage.getItem('liofy_activity_panel_open');
      if (saved !== null) return JSON.parse(saved);
      return typeof window !== 'undefined' && window.innerWidth >= 1200;
    } catch {
      return false;
    }
  });

  // ── Toast System ──────────────────────────────────────────────────────
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((msg) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 5000);
  }, []);

  const clearToast = useCallback(() => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(null);
  }, []);

  // ── Action Handlers ───────────────────────────────────────────────────
  const openFullPlayer = useCallback(() => {
    setIsFullPlayerOpen(true);
    pushModalHistory('fullplayer');
  }, [pushModalHistory]);

  const closeFullPlayer = useCallback(() => {
    setIsFullPlayerOpen(false);
    closeModalHistory('fullplayer');
  }, [closeModalHistory]);

  const openMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(true);
    pushModalHistory('mobilemenu');
  }, [pushModalHistory]);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
    closeModalHistory('mobilemenu');
  }, [closeModalHistory]);

  const toggleActivityPanel = useCallback(() => {
    setIsActivityPanelOpen(prev => {
      const next = !prev;
      try {
        localStorage.setItem('rivo_activity_panel_open', JSON.stringify(next));
        localStorage.setItem('liofy_activity_panel_open', JSON.stringify(next));
      } catch {}
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        if (next) pushModalHistory('activity');
        else closeModalHistory('activity');
      }
      return next;
    });
  }, [pushModalHistory, closeModalHistory]);

  const closeActivityPanel = useCallback(() => {
    setIsActivityPanelOpen(false);
    try {
      localStorage.setItem('rivo_activity_panel_open', 'false');
      localStorage.setItem('liofy_activity_panel_open', 'false');
    } catch {}
    closeModalHistory('activity');
  }, [closeModalHistory]);

  const openEditSong = useCallback((track) => {
    setEditingTrack(track);
    setIsEditSongOpen(true);
  }, []);

  const openEditAlbum = useCallback((album) => {
    setEditingAlbum(album);
    setIsEditAlbumOpen(true);
  }, []);

  const openAddToPlaylist = useCallback((targetTrack) => {
    setAddToPlaylistTarget(targetTrack || null);
    setIsAddToPlaylistOpen(true);
  }, []);

  const value = {
    globalTheme,
    setGlobalTheme,
    toggleGlobalTheme,
    isFullPlayerOpen,
    setIsFullPlayerOpen,
    openFullPlayer,
    closeFullPlayer,
    isCreatePlaylistOpen,
    setIsCreatePlaylistOpen,
    isAddToPlaylistOpen,
    setIsAddToPlaylistOpen,
    addToPlaylistTarget,
    setAddToPlaylistTarget,
    openAddToPlaylist,
    isSettingsOpen,
    setIsSettingsOpen,
    isAddSongOpen,
    setIsAddSongOpen,
    isImportSongOpen,
    setIsImportSongOpen,
    isImportPlaylistOpen,
    setIsImportPlaylistOpen,
    isEditSongOpen,
    setIsEditSongOpen,
    editingTrack,
    setEditingTrack,
    openEditSong,
    isEditAlbumOpen,
    setIsEditAlbumOpen,
    editingAlbum,
    setEditingAlbum,
    openEditAlbum,
    isAuthOpen,
    setIsAuthOpen,
    isJamOpen,
    setIsJamOpen,
    isChatOpen,
    setIsChatOpen,
    chatTargetUser,
    setChatTargetUser,
    unreadChatCount,
    setUnreadChatCount,
    isShortcutsOpen,
    setIsShortcutsOpen,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    openMobileMenu,
    closeMobileMenu,
    isActivityPanelOpen,
    setIsActivityPanelOpen,
    toggleActivityPanel,
    closeActivityPanel,
    toastMessage,
    showToast,
    clearToast,
    pushModalHistory,
    closeModalHistory,
    isClosingModalViaUiRef,
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return ctx;
}
