import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Search as SearchIcon, X, Plus, Radio, MessageSquare, ChevronDown, Users, Sun, Moon, Menu, Disc, Sparkles, ShieldCheck, WifiOff, Activity, Settings } from 'lucide-react';
import Navigation from './components/Navigation';
import MiniPlayer from './components/MiniPlayer';
import FullPlayerModal from './components/FullPlayerModal';
import CreatePlaylistModal from './components/CreatePlaylistModal';
import AddToPlaylistModal from './components/AddToPlaylistModal';
import SettingsModal from './components/SettingsModal';
import AddSongModal from './components/AddSongModal';
import EditSongModal from './components/EditSongModal';
import EditAlbumModal from './components/EditAlbumModal';
import AuthModal from './components/AuthModal';
import JamRoomModal from './components/JamRoomModal';
import ImportPlaylistModal from './components/ImportPlaylistModal';
import ImportSongModal from './components/ImportSongModal';
import ChatModal from './components/ChatModal';
import ShortcutsModal from './components/ShortcutsModal';
import ListeningActivityPanel from './components/ListeningActivityPanel';
import RivoLogo from './components/RivoLogo';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { buildUrl, parseLocation } from './utils/router';
import { APP_VERSION } from './version';

import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import LibraryScreen from './screens/LibraryScreen';
import ArtistScreen from './screens/ArtistScreen';
import StatsScreen from './screens/StatsScreen';
import PlaylistScreen from './screens/PlaylistScreen';
import ProfileScreen from './screens/ProfileScreen';
import MixesScreen from './screens/MixesScreen';
import QuranScreen from './screens/QuranScreen';
import AdminScreen from './screens/AdminScreen';
import DownloadScreen from './screens/DownloadScreen';
import { isUserAdmin } from './utils/adminUtils';
import { isQuranContent, getQuranReciterName } from './utils/quranUtils';

import { API_BASE_URL } from './config';
import { saveTrackOffline, removeTrackOffline, getOfflineTrackAudioUrl } from './utils/offlineStorage';
import { resumeAudioContext } from './utils/audioEngine';
import { UserProvider, useUser } from './context/UserContext';
import { AudioProvider, useAudioPlayer } from './context/AudioContext';
import { DownloadProvider } from './context/DownloadContext';

const getStoredToken = () => {
  try {
    return localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
  } catch {
    return '';
  }
};

const isNewerVersion = (remote, current) => {
  try {
    const r = (remote || '').replace(/[^0-9.]/g, '').split('.').map(Number);
    const c = (current || '').replace(/[^0-9.]/g, '').split('.').map(Number);
    for (let i = 0; i < Math.max(r.length, c.length); i++) {
      const rv = r[i] || 0;
      const cv = c[i] || 0;
      if (rv > cv) return true;
      if (rv < cv) return false;
    }
    return false;
  } catch {
    return false;
  }
};

function AppContent() {
  const {
    currentUser, login, logout,
    tracks, setTracks,
    playlists, setPlaylists,
    likedTrackIds, toggleLike,
    deleteTrack, deletePlaylist, removeTrackFromPlaylist,
    savePublicPlaylist, unsavePublicPlaylist,
    syncFromServer,
  } = useUser();

  const audio = useAudioPlayer();
  const {
    currentTrack, setCurrentTrack, isPlaying, setIsPlaying,
    currentQueue, setCurrentQueue,
    currentQueueIndex, setCurrentQueueIndex,
    currentTime, duration,
    volume, setVolume, isShuffle, setIsShuffle, toggleShuffle,
    isRepeat, setIsRepeat, repeatMode, toggleRepeat,
    isOfflineMode, setIsOfflineMode,
    togglePlay, playTrack, playNextTrack, playPrevTrack, seekTo,
    addToQueue, removeFromQueue,
    reorderQueue, clearQueue,
    setJamSync, syncRemotePlayState, addToJamQueue, removeFromJamQueue, reorderJamQueue
  } = audio;

  // Screen Navigation Initial State from URL
  const initialNav = useMemo(() => {
    if (typeof window === 'undefined') return { screen: 'home', params: {} };
    return parseLocation(window.location.pathname, window.location.search);
  }, []);

  const [currentScreen, setCurrentScreen]     = useState(initialNav.screen || 'home');
  const [isNativeApp, setIsNativeApp]         = useState(() => {
    return typeof window !== 'undefined' && Boolean(window.RIVO_NATIVE || window.ReactNativeWebView);
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && (window.RIVO_NATIVE || window.ReactNativeWebView)) {
      setIsNativeApp(true);
    }
  }, []);
  const [topSearchQuery, setTopSearchQuery]   = useState(initialNav.params?.query || '');
  const [selectedArtist, setSelectedArtist]   = useState(() => {
    if (initialNav.screen === 'artist' && initialNav.params?.name) {
      return { name: initialNav.params.name, id: initialNav.params.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-') };
    }
    return null;
  });
  const [selectedPlaylist, setSelectedPlaylist] = useState(() => {
    if (initialNav.screen === 'playlist') {
      if (initialNav.params?.id === 'liked') {
        return { id: 'liked', name: 'Liked Songs', isLikedSongs: true };
      }
      if (initialNav.params?.id) {
        return { id: initialNav.params.id, name: 'Playlist' };
      }
      if (initialNav.params?.albumName) {
        return { name: initialNav.params.albumName, isAlbum: true };
      }
    }
    return null;
  });
  const [libraryMode, setLibraryMode]         = useState(initialNav.screen === 'quran' ? 'quran' : 'music');
  const [viewingProfileUserId, setViewingProfileUserId] = useState(initialNav.params?.userId || null);
  const [albums, setAlbums]                   = useState([]);

  const playlistsRef = useRef(playlists);
  useEffect(() => { playlistsRef.current = playlists; }, [playlists]);

  const albumsRef = useRef(albums);
  useEffect(() => { albumsRef.current = albums; }, [albums]);

  const currentScreenRef = useRef(currentScreen);
  useEffect(() => { currentScreenRef.current = currentScreen; }, [currentScreen]);

  const musicTracks = useMemo(() => tracks.filter(track => !isQuranContent(track)), [tracks]);
  const quranTracks = useMemo(() => tracks.filter(track => isQuranContent(track)), [tracks]);
  const musicPlaylists = useMemo(() => playlists.filter(playlist => !isQuranContent(playlist)), [playlists]);
  const quranPlaylists = useMemo(() => playlists.filter(playlist => isQuranContent(playlist)), [playlists]);
  const musicAlbums = useMemo(() => albums.filter(album => !isQuranContent(album)), [albums]);
  const quranAlbums = useMemo(() => albums.filter(album => isQuranContent(album)), [albums]);

  // Modals
  const [isFullPlayerOpen,    setIsFullPlayerOpen]    = useState(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
  const [addToPlaylistTarget, setAddToPlaylistTarget] = useState(null);
  const [isSettingsOpen,      setIsSettingsOpen]      = useState(false);
  const [isAddSongOpen,       setIsAddSongOpen]       = useState(false);
  const [isImportSongOpen,    setIsImportSongOpen]    = useState(false);
  const [isImportPlaylistOpen, setIsImportPlaylistOpen] = useState(false);
  const [isEditSongOpen,      setIsEditSongOpen]      = useState(false);
  const [editingTrack,        setEditingTrack]        = useState(null);
  const [isEditAlbumOpen,     setIsEditAlbumOpen]     = useState(false);
  const [editingAlbum,        setEditingAlbum]        = useState(null);
  const [isAuthOpen,          setIsAuthOpen]          = useState(false);
  const [isJamOpen,           setIsJamOpen]           = useState(false);
  const [jamSession,          setJamSession]          = useState(null);
  const [isChatOpen,          setIsChatOpen]          = useState(false);
  const [isShortcutsOpen,     setIsShortcutsOpen]     = useState(false);
  const [isMobileMenuOpen,    setIsMobileMenuOpen]    = useState(false);
  const [isActivityPanelOpen, setIsActivityPanelOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('rivo_activity_panel_open') ?? localStorage.getItem('liofy_activity_panel_open');
      if (saved !== null) return JSON.parse(saved);
      return typeof window !== 'undefined' && window.innerWidth >= 1200;
    } catch {
      return false;
    }
  });

  const [chatTargetUser,      setChatTargetUser]      = useState(null);
  const [unreadChatCount,     setUnreadChatCount]     = useState(0);
  const [socket,              setSocket]              = useState(null);
  const [updateNotification,  setUpdateNotification]  = useState(null);

  // Sync refs for popstate and background handling
  const isChatOpenRef = useRef(isChatOpen);
  useEffect(() => { isChatOpenRef.current = isChatOpen; }, [isChatOpen]);
  const jamSessionRef = useRef(jamSession);
  useEffect(() => { jamSessionRef.current = jamSession; }, [jamSession]);
  const currentUserRef = useRef(currentUser);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  const activeNotificationsRef = useRef({});

  const isJamOpenRef = useRef(isJamOpen);
  useEffect(() => { isJamOpenRef.current = isJamOpen; }, [isJamOpen]);

  const isActivityPanelOpenRef = useRef(isActivityPanelOpen);
  useEffect(() => { isActivityPanelOpenRef.current = isActivityPanelOpen; }, [isActivityPanelOpen]);

  const isFullPlayerOpenRef = useRef(isFullPlayerOpen);
  useEffect(() => { isFullPlayerOpenRef.current = isFullPlayerOpen; }, [isFullPlayerOpen]);

  const isMobileMenuOpenRef = useRef(isMobileMenuOpen);
  useEffect(() => { isMobileMenuOpenRef.current = isMobileMenuOpen; }, [isMobileMenuOpen]);

  const isClosingModalViaUiRef = useRef(false);

  const chatTargetUserRef = useRef(chatTargetUser);
  useEffect(() => { chatTargetUserRef.current = chatTargetUser; }, [chatTargetUser]);

  // Modal History Stack Handlers (intercepts phone hardware Back button)
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

  const handleOpenChat = useCallback((target = null) => {
    setChatTargetUser(target);
    setIsChatOpen(true);
    setUnreadChatCount(0);

    const targetId = target?.id || target?._id;
    if (targetId) {
      const tag = `rivo-chat-${targetId}`;
      if (activeNotificationsRef.current[tag]) {
        try { activeNotificationsRef.current[tag].close(); } catch {}
        delete activeNotificationsRef.current[tag];
      }
      if (socket) {
        socket.emit('chat:mark_read', { senderId: targetId });
      }
      if (typeof window !== 'undefined' && window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DISMISS_CHAT_NOTIFICATION',
          senderId: targetId
        }));
      }
    }

    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsActivityPanelOpen(false);
    }
    pushModalHistory('chat');
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [pushModalHistory, socket]);

  const handleCloseChat = useCallback(() => {
    setIsChatOpen(false);
    setChatTargetUser(null);
    closeModalHistory('chat');
  }, [closeModalHistory]);

  const handleOpenJam = useCallback(() => {
    setIsJamOpen(true);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsActivityPanelOpen(false);
    }
    pushModalHistory('jam');
  }, [pushModalHistory]);

  const handleCloseJam = useCallback(() => {
    setIsJamOpen(false);
    closeModalHistory('jam');
  }, [closeModalHistory]);

  const handleToggleActivityPanel = useCallback(() => {
    setIsActivityPanelOpen(prev => {
      const next = !prev;
      try {
        localStorage.setItem('rivo_activity_panel_open', JSON.stringify(next));
        localStorage.setItem('liofy_activity_panel_open', JSON.stringify(next));
      } catch {}
      if (typeof window !== 'undefined' && window.innerWidth < 768) {
        if (next) {
          pushModalHistory('activity');
        } else {
          closeModalHistory('activity');
        }
      }
      return next;
    });
  }, [pushModalHistory, closeModalHistory]);

  const handleCloseActivityPanel = useCallback(() => {
    setIsActivityPanelOpen(false);
    try {
      localStorage.setItem('rivo_activity_panel_open', 'false');
      localStorage.setItem('liofy_activity_panel_open', 'false');
    } catch {}
    closeModalHistory('activity');
  }, [closeModalHistory]);

  const handleOpenMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(true);
    pushModalHistory('mobilemenu');
  }, [pushModalHistory]);

  const handleCloseMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
    closeModalHistory('mobilemenu');
  }, [closeModalHistory]);

  const handleOpenFullPlayer = useCallback(() => {
    setIsFullPlayerOpen(true);
    pushModalHistory('fullplayer');
  }, [pushModalHistory]);

  const handleCloseFullPlayer = useCallback(() => {
    setIsFullPlayerOpen(false);
    closeModalHistory('fullplayer');
  }, [closeModalHistory]);

  useKeyboardShortcuts({
    togglePlay,
    playNextTrack,
    playPrevTrack,
    seekTo,
    currentTime,
    duration,
    volume,
    setVolume,
    setIsShuffle,
    setIsRepeat,
    currentTrack,
    toggleLike,
    onToggleShortcutsModal: () => setIsShortcutsOpen((prev) => !prev),
  });

  // Fetch initial unread count on login/mount
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const token = getStoredToken();
        if (token && currentUser) {
          const res = await fetch(`${API_BASE_URL}/api/chat/unread-count`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success && typeof data.count === 'number') {
            setUnreadChatCount(data.count);
          }
        }
      } catch {}
    };
    fetchUnreadCount();
  }, [currentUser]);

  const [audioQuality, setAudioQuality] = useState('320');
  const [crossfade,    setCrossfade]    = useState(4);

  // Global Dark Mode Theme State
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

  const toggleGlobalTheme = () => {
    const root = document.documentElement;
    root.classList.add('disable-transitions');
    const next = globalTheme === 'dark' ? 'light' : 'dark';
    if (next === 'dark') {
      root.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      root.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    setGlobalTheme(next);
    try {
      localStorage.setItem('rivo_global_theme', next);
    } catch {}
    requestAnimationFrame(() => {
      setTimeout(() => {
        root.classList.remove('disable-transitions');
      }, 50);
    });
  };

  // Fetch albums
  const fetchAlbums = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/albums`);
      const data = await res.json();
      if (data.success && Array.isArray(data.albums)) {
        setAlbums(data.albums);
      }
    } catch {}
  };

  useEffect(() => {
    fetchAlbums();
  }, []);

  // Open auth on first boot
  useEffect(() => {
    if (!currentUser) setIsAuthOpen(true);
  }, []);

  const handleAddSong = async (newSong) => {
    if (!newSong) return;
    const isQ = currentScreen === 'quran' || libraryMode === 'quran' || isQuranContent(newSong);
    let artist = newSong.artist;
    if (isQ) {
      const reciter = getQuranReciterName(newSong, playlists);
      if (reciter && reciter !== 'تلاوات قرآنية' && reciter !== 'قارئ غير معروف') {
        artist = reciter;
      }
    }
    const songToAdd = { ...newSong, isQuran: isQ, artist };
    setTracks(prev => {
      const exists = prev.some(x => String(x.id) === String(songToAdd.id));
      if (exists) return prev;
      return [{ ...songToAdd, liked: false }, ...prev];
    });
    playTrack(songToAdd);

    // Save to server (if not already done in AddSongModal)
    if (songToAdd.source === 'YouTube') {
      try {
        const token = getStoredToken();
        await fetch(`${API_BASE_URL}/api/tracks/add`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(songToAdd),
        });
        syncFromServer();
        fetchAlbums();
      } catch {}
    } else {
      fetchAlbums();
    }
  };

  const handleOpenEditSong = (track) => { setEditingTrack(track); setIsEditSongOpen(true); };
  const handleOpenEditAlbum = (album) => { setEditingAlbum(album); setIsEditAlbumOpen(true); };

  const handleDeleteTrack = async (trackId) => {
    if (!trackId || !isUserAdmin(currentUser)) return;
    const cleanId = String(trackId);
    if (currentTrack && String(currentTrack.id || currentTrack._id) === cleanId) {
      setIsPlaying(false);
      setCurrentTrack(null);
    }
    setSelectedPlaylist(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        trackIds: (prev.trackIds || []).filter(id => String(id) !== cleanId)
      };
    });
    await deleteTrack(cleanId);
  };

  const handleDeleteAlbum = async (albumId, albumObj = null, deleteTracks = true) => {
    if (!albumId) return;
    const cleanId = String(albumId);
    const targetAlbum = albumObj || albums.find(a => String(a.id || a._id) === cleanId || a.name === cleanId);
    const albumName = targetAlbum?.name || (selectedPlaylist && (String(selectedPlaylist.id || selectedPlaylist._id) === cleanId || selectedPlaylist.name === cleanId) ? selectedPlaylist.name : null);

    // Remove from albums state
    setAlbums(prev => prev.filter(a => String(a.id || a._id) !== cleanId && (!albumName || a.name?.toLowerCase().trim() !== albumName.toLowerCase().trim())));

    // Collect all tracks belonging to this album
    const affectedTracks = new Set();
    if (targetAlbum?.trackIds && Array.isArray(targetAlbum.trackIds)) {
      targetAlbum.trackIds.forEach(id => affectedTracks.add(String(id)));
    }
    if (albumName) {
      tracks.forEach(t => {
        if (t.album && t.album.toLowerCase().trim() === albumName.toLowerCase().trim()) {
          affectedTracks.add(String(t.id || t._id));
        }
      });
    }

    if (deleteTracks) {
      // Remove tracks from state and user playlists / likes
      if (affectedTracks.size > 0) {
        setTracks(prev => prev.filter(t => !affectedTracks.has(String(t.id || t._id))));
        setLikedTrackIds(prev => prev.filter(id => !affectedTracks.has(String(id))));
        setPlaylists(prev => prev.map(pl => ({
          ...pl,
          trackIds: (pl.trackIds || []).filter(id => !affectedTracks.has(String(id)))
        })));
      }
    } else {
      // Keep tracks on website, only clear their album tag
      if (affectedTracks.size > 0) {
        setTracks(prev => prev.map(t => affectedTracks.has(String(t.id || t._id)) ? { ...t, album: '' } : t));
      }
    }

    if (selectedPlaylist && (
      String(selectedPlaylist.id || selectedPlaylist._id) === cleanId || 
      selectedPlaylist.name === cleanId ||
      (albumName && selectedPlaylist.name?.toLowerCase().trim() === albumName.toLowerCase().trim())
    )) {
      setSelectedPlaylist(null);
      setCurrentScreen(selectedArtist ? 'artist' : 'home');
    }

    try {
      const token = getStoredToken();
      if (token) {
        await fetch(`${API_BASE_URL}/api/albums/${encodeURIComponent(cleanId)}`, {
          method: 'DELETE',
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ deleteTracks: Boolean(deleteTracks) })
        });
      }
    } catch (err) {
      console.warn('Delete album error:', err);
    }
  };

  const handleCreateAlbum = (newAlbum, selectedTrackIds = [], newTracks = []) => {
    if (!newAlbum) return;
    setAlbums(prev => [newAlbum, ...prev.filter(a => String(a.id || a._id) !== String(newAlbum.id || newAlbum._id))]);
    if (Array.isArray(newTracks) && newTracks.length > 0) {
      setTracks(prev => {
        const existingIds = new Set(prev.map(t => String(t.id || t._id)));
        const toAdd = newTracks.filter(t => !existingIds.has(String(t.id || t._id)));
        return [...toAdd, ...prev];
      });
    } else if (Array.isArray(selectedTrackIds) && selectedTrackIds.length > 0) {
      const selectedSet = new Set(selectedTrackIds.map(String));
      setTracks(prev => prev.map(t => {
        if (selectedSet.has(String(t.id || t._id))) {
          return { ...t, album: newAlbum.name };
        }
        return t;
      }));
    }
    fetchAlbums();
  };

  const handleUpdateSong = async (updatedTrack) => {
    const trackId = String(updatedTrack.id || updatedTrack._id);
    setTracks(prev => prev.map(t => (String(t.id || t._id) === trackId ? updatedTrack : t)));
    if (currentTrack && String(currentTrack.id || currentTrack._id) === trackId) {
      setCurrentTrack(updatedTrack);
    }

    try {
      const token = getStoredToken();
      if (token) {
        await fetch(`${API_BASE_URL}/api/tracks/${encodeURIComponent(trackId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            title: updatedTrack.title,
            artist: updatedTrack.artist,
            album: updatedTrack.album,
            genre: updatedTrack.genre,
            cover: updatedTrack.cover,
            audioUrl: updatedTrack.audioUrl,
            lyrics: updatedTrack.lyrics
          }),
        });
      }
    } catch (err) {
      console.warn('Update song error:', err);
    }
  };

  const handleDeleteSong = (trackId) => {
    handleDeleteTrack(trackId);
  };

  const handleCreatePlaylist = async (name, description, cover = '', isPublic = true, isQuranExplicit = false) => {
    const isQ = isQuranExplicit || currentScreen === 'quran' || libraryMode === 'quran' || isQuranContent({ title: name, description });
    const newPl = {
      id: `pl-${Date.now()}`,
      name,
      description: description || '',
      cover: cover || '',
      isPublic: isPublic !== false,
      isQuran: isQ,
      trackIds: [],
    };
    setPlaylists(prev => [...prev, newPl]);
    setSelectedPlaylist(newPl);
    setCurrentScreen('playlist');

    // Sync to server
    try {
      const token = getStoredToken();
      if (token) {
        await fetch(`${API_BASE_URL}/api/playlists/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name, description, cover, isPublic, isQuran: isQ }),
        });
      }
    } catch {}
  };

  const handleUpdatePlaylist = async (updatedPl) => {
    const plId = String(updatedPl.id || updatedPl._id);
    setPlaylists(prev => prev.map(p => String(p.id || p._id) === plId ? updatedPl : p));
    if (selectedPlaylist && String(selectedPlaylist.id || selectedPlaylist._id) === plId) {
      setSelectedPlaylist(updatedPl);
    }

    try {
      const token = getStoredToken();
      if (token) {
        if (updatedPl.isAlbum) {
          await fetch(`${API_BASE_URL}/api/albums/${encodeURIComponent(plId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              name: updatedPl.name,
              artist: updatedPl.artist,
              cover: updatedPl.cover,
              genre: updatedPl.genre,
              releaseDate: updatedPl.releaseDate,
              trackIds: updatedPl.trackIds
            }),
          });
          setAlbums(prev => prev.map(a => String(a.id || a._id) === plId ? { ...a, ...updatedPl } : a));
        } else {
          await fetch(`${API_BASE_URL}/api/playlists/${encodeURIComponent(plId)}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ 
              name: updatedPl.name, 
              description: updatedPl.description, 
              cover: updatedPl.cover, 
              isPublic: updatedPl.isPublic 
            }),
          });
        }
      }
    } catch {}
  };

  const handleTogglePlaylistVisibility = async (playlistId) => {
    const cleanId = String(playlistId);
    const target = playlists.find(p => String(p.id || p._id) === cleanId);
    if (!target) return;
    const newVisibility = target.isPublic === false ? true : false;
    const updated = { ...target, isPublic: newVisibility };
    await handleUpdatePlaylist(updated);
  };

  const handleDeletePlaylist = async (playlistId) => {
    if (!playlistId) return;
    const cleanId = String(playlistId);
    setPlaylists(prev => prev.filter(p => String(p.id) !== cleanId && String(p._id) !== cleanId));
    if (selectedPlaylist && (String(selectedPlaylist.id) === cleanId || String(selectedPlaylist._id) === cleanId)) {
      setSelectedPlaylist(null);
      setCurrentScreen('library');
    }
    try {
      if (deletePlaylist) {
        await deletePlaylist(cleanId);
      } else {
        const token = getStoredToken();
        if (token) {
          await fetch(`${API_BASE_URL}/api/playlists/${encodeURIComponent(cleanId)}`, {
            method: 'DELETE',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
        }
      }
    } catch {}
  };

  const handleAddTrackToPlaylist = async (trackId, playlistId, allowDuplicate = false) => {
    const cleanTrackId = String(trackId);
    setPlaylists(prev => prev.map(pl => {
      if (String(pl.id) !== String(playlistId)) return pl;
      const ids = (pl.trackIds || []).map(String);
      if (!allowDuplicate && ids.includes(cleanTrackId)) return pl;
      return { ...pl, trackIds: [...ids, cleanTrackId] };
    }));

    try {
      const token = getStoredToken();
      if (token) {
        await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/add-track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ trackId: cleanTrackId, allowDuplicate }),
        });
      }
    } catch {}
  };

  const handleOpenAddToPlaylist = (targetTrack) => {
    setAddToPlaylistTarget(targetTrack || null);
    setIsAddToPlaylistOpen(true);
  };

  const handleRemoveTrackFromPlaylist = async (trackId, playlistId) => {
    const targetId = String(trackId);
    setSelectedPlaylist(prev => {
      if (!prev || String(prev.id) !== String(playlistId)) return prev;
      return { ...prev, trackIds: (prev.trackIds || []).filter(id => String(id) !== targetId) };
    });
    await removeTrackFromPlaylist(trackId, playlistId);
  };

  // Liked Songs playlist generator
  const getLikedSongsPlaylist = useCallback(() => ({
    id: 'liked',
    _id: 'liked',
    name: 'Liked Songs',
    description: 'Your favorite tracks in one place.',
    isLikedSongs: true,
    isAlbum: false,
    trackIds: (likedTrackIds || []).map(String),
    cover: '',
  }), [likedTrackIds]);

  // Central Router Navigation Handler
  const navigateTo = useCallback((screen, params = {}, options = {}) => {
    const { replace = false } = options;
    const targetUrl = buildUrl(screen, params);

    if (typeof window !== 'undefined') {
      const currentUrl = window.location.pathname + window.location.search;
      const shouldReplace = replace || Boolean(window.history.state?.modal);
      if (currentUrl !== targetUrl || shouldReplace) {
        if (shouldReplace) {
          window.history.replaceState({ screen, params }, '', targetUrl);
        } else {
          window.history.pushState({ screen, params }, '', targetUrl);
        }
      }

      if (window.innerWidth < 768) {
        setIsChatOpen(false);
        setIsJamOpen(false);
        setIsActivityPanelOpen(false);
        setIsMobileMenuOpen(false);
      }
    }

    setCurrentScreen(screen);

    if (screen === 'home') {
      setSelectedArtist(null);
      setSelectedPlaylist(null);
      setViewingProfileUserId(null);
    } else if (screen === 'search') {
      if (params.query !== undefined) setTopSearchQuery(params.query);
      setSelectedArtist(null);
      setSelectedPlaylist(null);
      setViewingProfileUserId(null);
    } else if (screen === 'library') {
      setLibraryMode('music');
      setSelectedArtist(null);
      setSelectedPlaylist(null);
      setViewingProfileUserId(null);
    } else if (screen === 'quran') {
      setLibraryMode('quran');
      setSelectedArtist(null);
      setSelectedPlaylist(null);
      setViewingProfileUserId(null);
    } else if (screen === 'stats') {
      setSelectedArtist(null);
      setSelectedPlaylist(null);
      setViewingProfileUserId(null);
    } else if (screen === 'admin') {
      setSelectedArtist(null);
      setSelectedPlaylist(null);
      setViewingProfileUserId(null);
    } else if (screen === 'profile') {
      setViewingProfileUserId(params.userId || null);
      setSelectedArtist(null);
      setSelectedPlaylist(null);
    } else if (screen === 'artist') {
      if (params.artist) {
        const artistObj = typeof params.artist === 'string'
          ? { name: params.artist.trim(), id: params.artist.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') }
          : params.artist;
        setSelectedArtist(artistObj);
      } else if (params.name) {
        setSelectedArtist({ name: params.name, id: params.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-') });
      }
      setSelectedPlaylist(null);
      setViewingProfileUserId(null);
    } else if (screen === 'playlist') {
      if (params.playlist) {
        setSelectedPlaylist(params.playlist);
        const isQ = Boolean(params.playlist?.isQuran || isQuranContent(params.playlist));
        setLibraryMode(isQ ? 'quran' : 'music');
      } else if (params.id) {
        const idStr = String(params.id);
        if (idStr === 'liked') {
          setSelectedPlaylist(getLikedSongsPlaylist());
          setLibraryMode('music');
        } else {
          const found = playlistsRef.current.find(p => String(p.id || p._id) === idStr);
          if (found) {
            setSelectedPlaylist(found);
            setLibraryMode(found.isQuran ? 'quran' : 'music');
          } else {
            const foundAlb = albumsRef.current.find(a => String(a.id || a._id) === idStr);
            if (foundAlb) {
              setSelectedPlaylist({ ...foundAlb, isAlbum: true });
            } else {
              setSelectedPlaylist({ id: params.id, name: 'Playlist' });
            }
          }
        }
      } else if (params.albumName) {
        const foundAlb = albumsRef.current.find(a => a.name?.toLowerCase().trim() === params.albumName.toLowerCase().trim());
        setSelectedPlaylist(foundAlb || { name: params.albumName, isAlbum: true });
      }
      setSelectedArtist(null);
      setViewingProfileUserId(null);
    }

    try {
      const mainEl = document.querySelector('main');
      if (mainEl) mainEl.scrollTop = 0;
      window.scrollTo(0, 0);
    } catch {}
  }, [getLikedSongsPlaylist]);

  const handleSelectArtist = useCallback((artist) => {
    if (!artist) return;
    const artistObj = typeof artist === 'string'
      ? { name: artist.trim(), id: artist.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') }
      : artist;
    navigateTo('artist', { name: artistObj.name, artist: artistObj });
  }, [navigateTo]);

  const handleSelectPlaylistView = useCallback((pl) => {
    if (!pl) return;
    const isLiked = pl.isLikedSongs || String(pl.id || pl._id) === 'liked';
    navigateTo('playlist', {
      id: isLiked ? 'liked' : (pl.id || pl._id),
      name: pl.name,
      playlist: pl
    });
  }, [navigateTo]);

  const goToScreen = useCallback((screen, params = {}) => {
    if (screen === 'liked' || screen === 'playlist:liked') {
      handleSelectPlaylistView(getLikedSongsPlaylist());
      return;
    }
    if (typeof screen === 'string' && screen.startsWith('playlist:')) {
      const plId = screen.split(':')[1];
      if (plId === 'liked') {
        handleSelectPlaylistView(getLikedSongsPlaylist());
        return;
      }
      const pl = playlistsRef.current.find(p => String(p.id || p._id) === String(plId));
      if (pl) {
        handleSelectPlaylistView(pl);
      } else {
        navigateTo('playlist', { id: plId, ...params });
      }
    } else {
      navigateTo(screen, params);
    }
  }, [handleSelectPlaylistView, getLikedSongsPlaylist, navigateTo]);

  const handleNavigateBack = useCallback((fallbackScreen = 'home') => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      goToScreen(fallbackScreen);
    }
  }, [goToScreen]);

  // Open profile screen and URL instead of AuthModal when user is logged in
  const handleUserAvatarClick = useCallback(() => {
    if (currentUser) {
      navigateTo('profile');
    } else {
      setIsAuthOpen(true);
    }
  }, [currentUser, navigateTo]);

  // Synchronize deep-linked playlist/album once async data loads
  useEffect(() => {
    if (currentScreen === 'playlist' && selectedPlaylist) {
      const selId = String(selectedPlaylist.id || selectedPlaylist._id || '');
      if (selId === 'liked') return;
      const foundPl = playlists.find(p => String(p.id || p._id) === selId);
      if (foundPl) {
        setSelectedPlaylist(prev => ({ ...prev, ...foundPl }));
        return;
      }
      const foundAlb = albums.find(a => String(a.id || a._id) === selId || (selectedPlaylist.name && a.name?.toLowerCase().trim() === selectedPlaylist.name?.toLowerCase().trim()));
      if (foundAlb) {
        setSelectedPlaylist(prev => ({ ...prev, ...foundAlb, isAlbum: true }));
      }
    }
  }, [playlists, albums, currentScreen]);

  // Handle browser Back / Forward (popstate)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const currentUrl = window.location.pathname + window.location.search;
      if (!window.history.state) {
        window.history.replaceState(
          { screen: initialNav.screen, params: initialNav.params },
          '',
          currentUrl
        );
      }
    }

    const handlePopState = () => {
      // 1. If closing via UI button (X/backdrop) which already triggered history.back(), skip pop action
      if (isClosingModalViaUiRef.current) {
        isClosingModalViaUiRef.current = false;
        return;
      }

      // 2. Close full player modal if open
      if (isFullPlayerOpenRef.current) {
        setIsFullPlayerOpen(false);
        return;
      }
      // 3. Close mobile menu drawer if open
      if (isMobileMenuOpenRef.current) {
        setIsMobileMenuOpen(false);
        return;
      }
      // 4. Close chat if open
      if (isChatOpenRef.current) {
        setIsChatOpen(false);
        setChatTargetUser(null);
        return;
      }
      // 5. Close jam if open
      if (isJamOpenRef.current) {
        setIsJamOpen(false);
        return;
      }
      // 6. Close friend activity if open on mobile
      if (isActivityPanelOpenRef.current && (typeof window !== 'undefined' && window.innerWidth < 768)) {
        setIsActivityPanelOpen(false);
        try {
          localStorage.setItem('rivo_activity_panel_open', 'false');
          localStorage.setItem('liofy_activity_panel_open', 'false');
        } catch {}
        return;
      }

      // 7. Parse target URL
      const { screen, params } = parseLocation(window.location.pathname, window.location.search);

      setCurrentScreen(screen);

      if (screen === 'home') {
        setSelectedArtist(null);
        setSelectedPlaylist(null);
        setViewingProfileUserId(null);
      } else if (screen === 'search') {
        setTopSearchQuery(params.query || '');
        setSelectedArtist(null);
        setSelectedPlaylist(null);
        setViewingProfileUserId(null);
      } else if (screen === 'library') {
        setLibraryMode('music');
        setSelectedArtist(null);
        setSelectedPlaylist(null);
        setViewingProfileUserId(null);
      } else if (screen === 'quran') {
        setLibraryMode('quran');
        setSelectedArtist(null);
        setSelectedPlaylist(null);
        setViewingProfileUserId(null);
      } else if (screen === 'stats') {
        setSelectedArtist(null);
        setSelectedPlaylist(null);
        setViewingProfileUserId(null);
      } else if (screen === 'admin') {
        setSelectedArtist(null);
        setSelectedPlaylist(null);
        setViewingProfileUserId(null);
      } else if (screen === 'profile') {
        setViewingProfileUserId(params.userId || null);
        setSelectedArtist(null);
        setSelectedPlaylist(null);
      } else if (screen === 'artist') {
        if (params.name) {
          setSelectedArtist({ name: params.name, id: params.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-') });
        }
        setSelectedPlaylist(null);
        setViewingProfileUserId(null);
      } else if (screen === 'playlist') {
        if (params.id) {
          const selId = String(params.id);
          if (selId === 'liked') {
            setSelectedPlaylist(getLikedSongsPlaylist());
          } else {
            const foundPl = playlistsRef.current.find(p => String(p.id || p._id) === selId);
            if (foundPl) {
              setSelectedPlaylist(foundPl);
              setLibraryMode(foundPl.isQuran ? 'quran' : 'music');
            } else {
              const foundAlb = albumsRef.current.find(a => String(a.id || a._id) === selId);
              if (foundAlb) {
                setSelectedPlaylist({ ...foundAlb, isAlbum: true });
              } else {
                setSelectedPlaylist({ id: selId, name: 'Playlist' });
              }
            }
          }
        } else if (params.albumName) {
          const foundAlb = albumsRef.current.find(a => a.name?.toLowerCase().trim() === params.albumName.toLowerCase().trim());
          setSelectedPlaylist(foundAlb || { name: params.albumName, isAlbum: true });
        }
        setSelectedArtist(null);
        setViewingProfileUserId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [initialNav, getLikedSongsPlaylist]);

  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 5000);
  };

  const handleStartJam = (openModal = true) => {
    resumeAudioContext();
    const code = jamSession?.code || `JAM-${Math.floor(1000 + Math.random() * 9000)}`;
    const userPayload = currentUser 
      ? { id: currentUser.id || currentUser._id, name: currentUser.name, avatar: currentUser.avatar }
      : { id: `user-${Math.floor(1000 + Math.random() * 9000)}`, name: 'Guest Listener', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' };

    // Optimistically set initial room state so modal renders immediately
    if (!jamSession?.code) {
      const initialRoom = {
        code,
        hostId: socket?.id || 'host',
        hostUserId: userPayload.id,
        hostOnlyControl: false,
        currentTrack: currentTrack || null,
        isPlaying: Boolean(isPlaying),
        currentTime: Number(currentTime) || 0,
        updatedAt: Date.now(),
        queue: [],
        members: [{
          ...userPayload,
          socketId: socket?.id || 'host',
          isHost: true
        }]
      };
      setJamSession(initialRoom);
      setJamSync({ socket, jamSession: initialRoom });
    }

    if (socket) {
      if (!socket.connected) {
        socket.connect();
      }
      socket.emit('jam:join_room', {
        roomCode: code,
        user: userPayload,
        currentTrack: currentTrack || null,
        isPlaying: Boolean(isPlaying),
        currentTime: Number(currentTime) || 0
      });
      showToast(`Jam Session active: ${code}`);
    } else {
      showToast(`Jam Session created: ${code}`);
    }

    if (openModal) {
      handleOpenJam();
    }
    return code;
  };

  const handleStartJamWithTargetUser = (target) => {
    const code = handleStartJam(true);
    const targetId = target?.id || target?._id;
    if (socket && targetId && code) {
      socket.emit('jam:invite_user', {
        recipientId: targetId,
        roomCode: code,
        host: {
          id: currentUser?.id || currentUser?._id,
          name: currentUser?.name || 'Friend',
          avatar: currentUser?.avatar || ''
        }
      });
      showToast(`Invited ${target?.name || 'friend'} to Jam (${code})`);
    }
    return code;
  };

  const handleJoinJam = (code) => {
    if (!code) return;
    resumeAudioContext();
    const cleanCode = code.trim().toUpperCase();
    const userPayload = currentUser 
      ? { id: currentUser.id || currentUser._id, name: currentUser.name, avatar: currentUser.avatar }
      : { id: `user-${Math.floor(1000 + Math.random() * 9000)}`, name: 'Guest Listener', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' };

    if (socket) {
      if (!socket.connected) {
        socket.connect();
      }
      socket.emit('jam:join_room', {
        roomCode: cleanCode,
        user: userPayload
      });
      handleOpenJam();
      showToast(`Joined Jam: ${cleanCode}`);
    } else {
      handleOpenJam();
      showToast(`Connecting to Jam: ${cleanCode}...`);
    }
  };

  const handleLeaveJam = () => {
    if (jamSession && socket) {
      socket.emit('jam:leave_room', { roomCode: jamSession.code });
      setJamSession(null);
      setJamSync({ jamSession: null });
      showToast('Left Jam Session');
    }
  };

  const handleJoinJamRef = useRef(handleJoinJam);
  useEffect(() => { handleJoinJamRef.current = handleJoinJam; }, [handleJoinJam]);

  const handleOpenChatRef = useRef(handleOpenChat);
  useEffect(() => { handleOpenChatRef.current = handleOpenChat; }, [handleOpenChat]);

  useEffect(() => {
    const token = getStoredToken();
    const s = io(API_BASE_URL, {
      auth: { token: token || undefined },
      transports: ['websocket', 'polling']
    });
    setSocket(s);

    s.on('connect', () => {
      const curUser = currentUserRef.current;
      if (curUser?.id || curUser?._id) {
        const uid = curUser.id || curUser._id;
        s.emit('user:online', { userId: uid });
      }
      if (jamSessionRef.current?.code) {
        const userPayload = curUser 
          ? { id: curUser.id || curUser._id, name: curUser.name, avatar: curUser.avatar }
          : { id: `user-${Math.floor(1000 + Math.random() * 9000)}`, name: 'Guest Listener', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' };
        s.emit('jam:join_room', {
          roomCode: jamSessionRef.current.code,
          user: userPayload
        });
      }
    });

    if (currentUser?.id || currentUser?._id) {
      const uid = currentUser.id || currentUser._id;
      s.emit('user:online', { userId: uid });
    }

    s.on('jam:room_updated', (room) => {
      setJamSession(room);
      setJamSync({ socket: s, jamSession: room });
      if (room?.currentTrack && syncRemotePlayStateRef.current && room.initiatorId !== s.id) {
        syncRemotePlayStateRef.current({
          isPlaying: Boolean(room.isPlaying),
          currentTrack: room.currentTrack,
          currentTime: room.currentTime,
          updatedAt: room.updatedAt
        });
      }
    });

    s.on('jam:promoted_to_host', () => {
      showToast('👑 You are now the host of this Jam session!');
    });

    s.on('jam:kicked', (data) => {
      alert(data?.reason || 'You were kicked from the Jam room by the host.');
      setJamSession(null);
      setJamSync({ jamSession: null });
      handleCloseJam();
    });

    s.on('jam:sync_play_state', (data) => {
      if (data?.initiatorId && data.initiatorId === s.id) return;
      setSelectedPlaylist(null);
      syncRemotePlayState(data);
    });

    s.on('jam:pause_all', (data) => {
      setSelectedPlaylist(null);
      syncRemotePlayState({
        isPlaying: false,
        currentTrack: data?.currentTrack,
        currentTime: data?.currentTime
      });
    });

    s.on('jam:host_changed', ({ hostName }) => {
      if (hostName) showToast(`Jam Host transferred to ${hostName}`);
    });

    s.on('jam:you_are_host', () => {
      showToast('👑 You are now the host of this Jam session!');
    });

    s.on('jam:on_play_state_changed', (data) => {
      if (data?.initiatorId && data.initiatorId === s.id) return;
      setSelectedPlaylist(null);
      syncRemotePlayState(data);
    });

    s.on('jam:invite_received', (data) => {
      const hostName = data?.host?.name || 'Someone';
      const roomCode = data?.roomCode;
      if (!roomCode) return;

      showToast({
        type: 'jam',
        title: `📻 Jam Invite from ${hostName}`,
        body: `Invited you to listen together in sync! Tap to join (${roomCode})`,
        roomCode,
        sender: {
          id: data?.host?.id,
          name: hostName,
          avatar: data?.host?.avatar || ''
        }
      });

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const notif = new Notification(`Rivo • Jam Invite from ${hostName}`, {
            body: `Tap to join and listen together in real-time (${roomCode})`,
            icon: data?.host?.avatar || '/favicon.ico',
            tag: `rivo-jam-${roomCode}`
          });
          notif.onclick = () => {
            window.focus();
            handleJoinJamRef.current?.(roomCode);
          };
        } catch (e) {
          console.warn('Desktop notification error:', e);
        }
      }
    });

    s.on('chat:message', (msg) => {
      const cur = currentUserRef.current || currentUser;
      const myId = String(cur?.id || cur?._id || '');
      const recipientId = String(msg.recipient?._id || msg.recipient || '');
      const senderId = String(msg.sender?._id || msg.sender || '');
      if (senderId && senderId === myId) return;
      if (recipientId && myId && recipientId !== myId) return;

      const isOpenWithSender = isChatOpenRef.current && String(chatTargetUserRef.current?.id || chatTargetUserRef.current?._id) === senderId;
      if (isOpenWithSender) {
        // If chat is actively open with sender on this device, mark as read immediately
        s.emit('chat:mark_read', { senderId });
      } else {
        setUnreadChatCount(prev => prev + 1);

        const senderName = msg.senderName || 'Someone';
        const preview = msg.text || (msg.track ? `Shared song: ${msg.track.title || 'a track'}` : (msg.jamInvite ? 'Invited you to a Jam Session' : 'Sent an attachment'));

        if (msg.jamInvite?.roomCode) {
          showToast({
            type: 'jam',
            title: `📻 Jam Session • ${senderName}`,
            body: `Invited you to a live Jam Session! Tap to join (${msg.jamInvite.roomCode})`,
            roomCode: msg.jamInvite.roomCode,
            sender: { id: senderId, name: senderName, avatar: msg.senderAvatar }
          });
        } else {
          showToast({
            type: 'chat',
            title: `💬 ${senderName}`,
            body: preview,
            sender: { id: senderId, name: senderName, avatar: msg.senderAvatar }
          });
        }

        // Native Android & iOS Mobile Phone Push Notification Bridge
        if (typeof window !== 'undefined' && window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
          try {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SHOW_CHAT_NOTIFICATION',
              options: {
                senderId: senderId,
                senderName,
                message: preview,
                isJam: Boolean(msg.jamInvite?.roomCode),
                roomCode: msg.jamInvite?.roomCode,
              }
            }));
          } catch (e) {}
        }

        // Windows Desktop Native App Tray Notification Bridge (.exe)
        if (typeof window !== 'undefined' && window.chrome?.webview?.postMessage) {
          try {
            window.chrome.webview.postMessage(JSON.stringify({
              action: 'CHAT_NOTIFICATION',
              senderName,
              message: preview,
              isJam: Boolean(msg.jamInvite?.roomCode),
              roomCode: msg.jamInvite?.roomCode,
            }));
          } catch (e) {}
        }

        // Browser Desktop Push Notification
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'default') {
            Notification.requestPermission();
          }
        }
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              const isJam = Boolean(msg.jamInvite?.roomCode);
              const tag = isJam ? `rivo-jam-${msg.jamInvite.roomCode}` : `rivo-chat-${msg.sender}`;
              const notif = new Notification(isJam ? `Rivo • Jam Session from ${senderName}` : `Rivo • Message from ${senderName}`, {
                body: preview,
                icon: msg.senderAvatar || '/favicon.ico',
                tag
              });
              activeNotificationsRef.current[tag] = notif;
              notif.onclose = () => {
                delete activeNotificationsRef.current[tag];
              };
              notif.onclick = () => {
                window.focus();
                if (isJam) {
                  handleJoinJamRef.current?.(msg.jamInvite.roomCode);
                } else {
                  handleOpenChatRef.current?.({ id: msg.sender, name: senderName, avatar: msg.senderAvatar });
                }
              };
            } catch (e) {
              console.warn('Desktop notification error:', e);
            }
          }
        }
      });

    // Cross-Device Notification Dismissal Sync
    // If the message is read/seen on phone or another screen, immediately close this device's notification!
    s.on('chat:dismiss_notification', ({ senderId, roomCode }) => {
      const tag = roomCode ? `rivo-jam-${roomCode}` : `rivo-chat-${senderId}`;
      if (activeNotificationsRef.current[tag]) {
        try {
          activeNotificationsRef.current[tag].close();
        } catch {}
        delete activeNotificationsRef.current[tag];
      }
      setToastMessage(prev => {
        if (String(prev?.sender?.id) === String(senderId) || (roomCode && prev?.roomCode === roomCode)) {
          return null;
        }
        return prev;
      });
      setUnreadChatCount(prev => Math.max(0, prev - 1));

      // Dismiss native notification on mobile device
      if (typeof window !== 'undefined' && window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
        try {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'DISMISS_CHAT_NOTIFICATION',
            senderId,
            roomCode
          }));
        } catch (e) {}
      }
    });



      return () => s.disconnect();
    }, [currentUser?.id, currentUser?._id, setJamSync, syncRemotePlayState]);

  useEffect(() => {
    if (socket) {
      setJamSync({ socket, jamSession });
    }
  }, [socket, jamSession, setJamSync]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (jamSession?.code && socket) {
        socket.emit('jam:leave_room', { roomCode: jamSession.code });
      }
      const token = getStoredToken();
      if (token) {
        try {
          const payload = JSON.stringify({ isPlaying: false, track: null, currentTime: 0 });
          const blob = new Blob([payload], { type: 'application/json' });
          navigator.sendBeacon(`${API_BASE_URL}/api/users/listening-activity?token=${encodeURIComponent(token)}`, blob);
        } catch (e) {}
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [jamSession?.code, socket]);

  const handleKickMember = (member) => {
    if (jamSession && socket && member) {
      socket.emit('jam:kick_member', {
        roomCode: jamSession.code,
        memberSocketId: member.socketId,
        memberId: member.id || member._id
      });
      showToast(`Kicked ${member.name} from Jam`);
    }
  };

  const handleTransferHost = (member) => {
    if (jamSession && socket && member) {
      socket.emit('jam:transfer_host', {
        roomCode: jamSession.code,
        targetSocketId: member.socketId,
        targetUserId: member.id || member._id
      });
      showToast(`Transferred host to ${member.name}`);
    }
  };

  const handleDownload = async (trackId) => {
    const cleanId = String(trackId);
    const track = tracks.find(t => String(t.id || t._id) === cleanId) || 
                  (currentTrack && String(currentTrack.id || currentTrack._id) === cleanId ? currentTrack : null);
    if (!track) return;

    const isNativeApp = typeof window !== 'undefined' && (
      Boolean(window.RIVO_NATIVE) ||
      Boolean(window.ReactNativeWebView) ||
      Boolean(window.Capacitor) ||
      Boolean(window.__RIVO_NATIVE_INJECTED)
    );

    if (track.downloaded) {
      if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DELETE_TRACK',
          trackId: cleanId,
        }));
      }
      await removeTrackOffline(cleanId);
      setTracks(prev => prev.map(t => String(t.id || t._id) === cleanId ? { ...t, downloaded: false } : t));
      if (currentTrack && String(currentTrack.id || currentTrack._id) === cleanId) {
        setCurrentTrack(prev => ({ ...prev, downloaded: false }));
      }
      showToast('Song removed from offline downloads');
    } else {
      showToast('Downloading song for offline playback...');
      const result = await saveTrackOffline(track);
      if (result) {
        // Get a fresh playable audio URL (native file URI converted to http:// via Capacitor)
        const freshAudioUrl = await getOfflineTrackAudioUrl(cleanId);

        // Prefer original cover URL for color extraction — native URIs fail CORS canvas extraction
        // Only use native cover as fallback if no original cover exists
        const freshCover = track.cover || result.coverBase64 || null;

        // Full patch for tracks list (for future plays)
        const patchFields = {
          downloaded: true,
          audioUrl: freshAudioUrl || result.audioUrl,
          cover: freshCover,
          nativeAudioUri: result.nativeAudioUri || null,
          nativeCoverUri: result.nativeCoverUri || null,
        };

        setTracks(prev => prev.map(t => String(t.id || t._id) === cleanId ? { ...t, ...patchFields } : t));

        // For currently playing track: ONLY mark downloaded=true.
        // Do NOT change audioUrl (would restart/interrupt playback)
        // Do NOT change cover (would break dynamic background color extraction)
        if (currentTrack && String(currentTrack.id || currentTrack._id) === cleanId) {
          setCurrentTrack(prev => ({
            ...prev,
            downloaded: true,
            nativeAudioUri: result.nativeAudioUri || null,
            nativeCoverUri: result.nativeCoverUri || null,
          }));
        }

        // Trigger browser file download ONLY on desktop web browser (never inside native Android or iOS app)
        if (typeof window !== 'undefined' && !isNativeApp) {
          try {
            const cleanTitle = (track.title || 'Song').replace(/https?:\/\/\S+/gi, '').replace(/[\[\(]?(?:official|lyrics|video|audio|hd|4k|remastered)[\]\)]?/gi, '').replace(/[/\\?%*:|"<>]/g, '').trim() || 'Song';
            const cleanArtist = (track.artist || 'Artist').replace(/https?:\/\/\S+/gi, '').replace(/[/\\?%*:|"<>]/g, '').trim() || 'Artist';
            const dlLink = document.createElement('a');
            dlLink.href = `${API_BASE_URL}/api/tracks/download?url=${encodeURIComponent(track.audioUrl || '')}&title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}&id=${encodeURIComponent(cleanId)}`;
            dlLink.setAttribute('download', `${cleanArtist} - ${cleanTitle}.mp3`);
            document.body.appendChild(dlLink);
            dlLink.click();
            document.body.removeChild(dlLink);
          } catch (e) {}
        }

        showToast('Song downloaded for offline playback ✓');
      } else {
        showToast('Could not download song. Please check internet connection.');
      }
    }
  };

  return (
    <DownloadProvider tracks={tracks} setTracks={setTracks} showToast={showToast}>
      <div className="flex flex-col text-[#0b1110] overflow-hidden select-none font-sans" style={{ height: '100dvh', background: '#082621' }}>


      {/* ── TOP APOTHECARY NAV BAR (Rivo Design) ── */}
      <header className="bg-[#0b1110] text-[#fdfbf7] brutal-border-thick border-x-0 border-t-0 px-2.5 sm:px-5 py-1.5 sm:py-2 flex items-center justify-between gap-1.5 sm:gap-3 z-30 shrink-0">

        {/* Brand identity: RIVO */}
        <div className="flex items-center gap-2 shrink-0 rivo-nav-logo">
          <div 
            onClick={() => goToScreen('home')} 
            className="cursor-pointer flex items-center shrink-0"
          >
            <RivoLogo size={34} showText={true} textClassName="text-white text-lg sm:text-xl" isDark={true} />
          </div>
        </div>

        {/* Retro Search Box */}
        <div className="hidden md:flex flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
              <SearchIcon size={16} strokeWidth={2.5} />
            </span>
            <input 
              type="text" 
              value={topSearchQuery}
              onChange={(e) => {
                const val = e.target.value;
                setTopSearchQuery(val);
                if (currentScreen !== 'search') {
                  navigateTo('search', { query: val });
                } else if (typeof window !== 'undefined') {
                  const targetUrl = buildUrl('search', { query: val });
                  window.history.replaceState({ screen: 'search', params: { query: val } }, '', targetUrl);
                }
              }}
              placeholder="Search by dose, artist, prescription, or cassette..."
              className={`w-full text-xs font-bold py-2 pl-9 pr-8 rounded-full brutal-border focus:outline-none transition-colors brutal-shadow-sm ${
                globalTheme === 'dark' 
                  ? 'bg-[#141d1b] border-zinc-700 text-white placeholder-zinc-500 focus:bg-[#182320]' 
                  : 'bg-[#fdfbf7] border-black text-[#0b1110] placeholder-zinc-500 focus:bg-white'
              }`}
            />
            {topSearchQuery && (
              <button 
                onClick={() => {
                  setTopSearchQuery('');
                  if (currentScreen === 'search' && typeof window !== 'undefined') {
                    window.history.replaceState({ screen: 'search', params: { query: '' } }, '', '/search');
                  }
                }}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-black cursor-pointer"
              >
                <X size={15} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Action Icons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Global Dark / Light Mode Switcher */}
            <button 
              onClick={toggleGlobalTheme}
              className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 flex items-center justify-center cursor-pointer transition shrink-0"
              title={globalTheme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {globalTheme === 'dark' ? <Sun size={15} strokeWidth={2.5} /> : <Moon size={15} strokeWidth={2.5} />}
            </button>

            {/* Friend Activity Quick Toggle */}
            <button
              onClick={handleToggleActivityPanel}
              className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition shrink-0 ${
                isActivityPanelOpen
                  ? 'bg-[#17a398] text-[#0b1110] border-2 border-black font-black'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
              }`}
              title="Friend Activity"
            >
              <Users size={15} strokeWidth={2.5} />
            </button>

            {/* Direct Switch to Offline Vault Button (Mobile / Tablet) */}
            <button
              onClick={() => {
                if (typeof window !== 'undefined' && window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'SET_APP_MODE',
                    mode: 'offline'
                  }));
                } else {
                  goToScreen('library');
                }
              }}
              className="flex lg:hidden items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#17a398]/15 hover:bg-[#17a398]/25 text-[#17a398] border border-[#17a398]/40 cursor-pointer transition shrink-0 font-display font-black text-xs"
              title="Switch to Offline Mode (Local Vault)"
            >
              <WifiOff size={14} strokeWidth={2.5} />
              <span>Offline</span>
            </button>

            {/* Quick Actions Drawer Toggle (☰ 3 bars) */}
            <button
              onClick={handleOpenMobileMenu}
              className="relative w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 flex items-center justify-center cursor-pointer transition shrink-0"
              title="Menu & Quick Tools"
            >
              <Menu size={16} strokeWidth={2.5} />
              {unreadChatCount > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#dc2626] rounded-full border border-black animate-pulse" />
              )}
            </button>
          </div>

          {/* User Profile Badge */}
          <div 
            onClick={handleUserAvatarClick}
            className="flex items-center gap-1.5 pl-1.5 sm:pl-2 border-l border-zinc-700/60 ml-0.5 sm:ml-1 cursor-pointer group shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-[#17a398] brutal-border flex items-center justify-center font-display font-black text-xs text-[#0b1110] brutal-shadow-sm overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                currentUser?.name?.[0] || 'R'
              )}
            </div>
            <div className="hidden sm:flex flex-col justify-center text-left">
              <span className="text-xs font-display font-bold leading-tight text-white truncate max-w-[90px] group-hover:text-[#17a398] transition-colors">
                {currentUser ? currentUser.name : 'Sign In'}
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${currentUser ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className="text-[8.5px] font-mono font-bold text-zinc-300 uppercase">
                  {currentUser ? 'ONLINE' : 'GUEST'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN WORKSPACE WITH FILMSTRIPS ── */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* Left Perforated Filmstrip Rail */}
        <aside className="hidden xl:flex w-8 flex-col filmstrip-stripes brutal-border border-y-0 border-l-0 shrink-0"></aside>

        {/* ── Apothecary Sidebar / Bottom Nav ── */}
        <Navigation
          currentScreen={currentScreen}
          setCurrentScreen={goToScreen}
          playlists={playlists}
          libraryMode={libraryMode}
          openCreatePlaylistModal={() => setIsCreatePlaylistOpen(true)}
          openImportPlaylistModal={() => setIsImportPlaylistOpen(true)}
          openImportSongModal={() => setIsImportSongOpen(true)}
          openJamModal={handleOpenJam}
          openSettings={() => setIsSettingsOpen(true)}
          openAddSongModal={() => setIsAddSongOpen(true)}
          openAuthModal={handleUserAvatarClick}
          currentUser={currentUser}
          openChatModal={() => handleOpenChat(null)}
          openShortcutsModal={() => setIsShortcutsOpen(true)}
          unreadChatCount={unreadChatCount}
          isActivityPanelOpen={isActivityPanelOpen}
          toggleActivityPanel={handleToggleActivityPanel}
          globalTheme={globalTheme}
          likedTrackIds={likedTrackIds}
          selectedPlaylist={selectedPlaylist}
          onSelectLikedSongs={() => goToScreen('liked')}
        />

        {/* ── Main Canvas View ── */}
        <main
          className={`flex-1 flex flex-col overflow-hidden relative ${
            currentTrack ? 'pb-[114px] md:pb-[96px]' : 'pb-[52px] md:pb-0'
          }`}
          style={{
            background: globalTheme === 'dark' ? '#0b1110' : '#17a398',
            paddingTop: 0,
          }}
        >
          {currentScreen === 'home' && (
            <HomeScreen
              tracks={musicTracks}
              playlists={musicPlaylists}
              albums={musicAlbums}
              onSelectTrack={playTrack}
              onSelectPlaylist={handleSelectPlaylistView}
              toggleLike={toggleLike}
              onSelectArtist={handleSelectArtist}
              openAddSongModal={() => setIsAddSongOpen(true)}
              openEditSongModal={handleOpenEditSong}
              openAddToPlaylist={handleOpenAddToPlaylist}
              onDeleteTrack={isUserAdmin(currentUser) ? handleDeleteTrack : undefined}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              currentUser={currentUser}
              logout={logout}
              openAuthModal={() => setIsAuthOpen(true)}
              openProfileScreen={() => navigateTo('profile')}
              openJamModal={handleOpenJam}
              jamSession={jamSession}
              openChatModal={() => handleOpenChat(null)}
              unreadChatCount={unreadChatCount}
              isActivityPanelOpen={isActivityPanelOpen}
              toggleActivityPanel={handleToggleActivityPanel}
              globalTheme={globalTheme}
            />
          )}

          {currentScreen === 'search' && (
            <SearchScreen
              tracks={musicTracks}
              albums={musicAlbums}
              initialQuery={topSearchQuery}
              onSelectTrack={playTrack}
              onSelectPlaylist={handleSelectPlaylistView}
              onSelectArtist={handleSelectArtist}
              toggleLike={toggleLike}
              openEditSongModal={handleOpenEditSong}
              openAddToPlaylist={handleOpenAddToPlaylist}
              onOpenAddSongModal={() => setIsAddSongOpen(true)}
              onAddToLibrary={handleAddSong}
              onDeleteTrack={isUserAdmin(currentUser) ? handleDeleteTrack : undefined}
              currentUser={currentUser}
              onViewProfile={(userId) => {
                navigateTo('profile', { userId });
              }}
              globalTheme={globalTheme}
            />
          )}

          {currentScreen === 'library' && (
            <LibraryScreen
              playlists={musicPlaylists}
              albums={musicAlbums}
              tracks={musicTracks}
              likedTrackIds={likedTrackIds}
              currentUser={currentUser}
              onSelectPlaylist={handleSelectPlaylistView}
              onSelectArtist={handleSelectArtist}
              onSelectTrack={playTrack}
              openCreatePlaylistModal={() => setIsCreatePlaylistOpen(true)}
              openImportPlaylistModal={() => setIsImportPlaylistOpen(true)}
              openImportSongModal={() => setIsImportSongOpen(true)}
              onDeletePlaylist={handleDeletePlaylist}
              toggleLike={toggleLike}
              globalTheme={globalTheme}
            />
          )}

          {currentScreen === 'quran' && (
            <QuranScreen
              tracks={quranTracks}
              playlists={quranPlaylists}
              onSelectTrack={playTrack}
              onSelectPlaylist={handleSelectPlaylistView}
              onSelectArtist={handleSelectArtist}
              toggleLike={toggleLike}
              openCreatePlaylistModal={() => setIsCreatePlaylistOpen(true)}
              openImportPlaylistModal={() => setIsImportPlaylistOpen(true)}
              openImportSongModal={() => setIsImportSongOpen(true)}
              openAddSongModal={() => setIsAddSongOpen(true)}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              globalTheme={globalTheme}
            />
          )}

          {currentScreen === 'playlist' && selectedPlaylist && (
            <PlaylistScreen
              playlist={(() => {
                const selId = String(selectedPlaylist.id || selectedPlaylist._id || '');
                if (selectedPlaylist.isLikedSongs || selId === 'liked') {
                  return {
                    ...selectedPlaylist,
                    name: 'Liked Songs',
                    isLikedSongs: true,
                    trackIds: (likedTrackIds || []).map(String)
                  };
                }
                const userPl = playlists.find(p => String(p.id || p._id) === selId);
                if (userPl) {
                  return { ...userPl, isAlbum: false };
                }
                const alb = albums.find(a => String(a.id || a._id) === selId);
                if (alb) {
                  const albumTracks = (tracks || []).filter(t => t.album && t.album.toLowerCase().trim() === (alb.name || '').toLowerCase().trim());
                  const allTrackIds = Array.from(new Set([
                    ...albumTracks.map(t => String(t.id || t._id)),
                    ...(alb.trackIds || []).map(String),
                    ...(selectedPlaylist?.trackIds || []).map(String)
                  ]));
                  return { ...selectedPlaylist, ...alb, trackIds: allTrackIds, isAlbum: true };
                }
                return selectedPlaylist;
              })()}
              tracks={isQuranContent(selectedPlaylist) ? quranTracks : musicTracks}
              likedTrackIds={likedTrackIds}
              currentUser={currentUser}
              onSelectTrack={playTrack}
              onSelectArtist={handleSelectArtist}
              toggleLike={toggleLike}
              toggleDownload={handleDownload}
              onBack={() => handleNavigateBack(isQuranContent(selectedPlaylist) ? 'quran' : 'library')}
              onAddTrackToPlaylist={handleAddTrackToPlaylist}
              onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
              onDeleteTrack={isUserAdmin(currentUser) ? handleDeleteTrack : undefined}
              openEditSongModal={handleOpenEditSong}
              openEditAlbumModal={handleOpenEditAlbum}
              openAddToPlaylist={handleOpenAddToPlaylist}
              onUpdatePlaylist={handleUpdatePlaylist}
              onDeletePlaylist={handleDeletePlaylist}
              onDeleteAlbum={handleDeleteAlbum}
              onTogglePlaylistVisibility={handleTogglePlaylistVisibility}
              onSavePlaylist={savePublicPlaylist}
              onUnsavePlaylist={unsavePublicPlaylist}
              userPlaylists={playlists}
              globalTheme={globalTheme}
              onToast={showToast}
            />
          )}

          {currentScreen === 'artist' && selectedArtist && (
            <ArtistScreen
              artist={selectedArtist}
              tracks={tracks}
              albums={albums}
              onSelectTrack={playTrack}
              onSelectPlaylist={handleSelectPlaylistView}
              onSelectArtist={handleSelectArtist}
              toggleLike={toggleLike}
              onBack={() => handleNavigateBack('home')}
              currentUser={currentUser}
              openEditSongModal={handleOpenEditSong}
              openEditAlbumModal={handleOpenEditAlbum}
              openAddToPlaylist={handleOpenAddToPlaylist}
              onDeleteTrack={isUserAdmin(currentUser) ? handleDeleteTrack : undefined}
              onAlbumCreated={handleCreateAlbum}
              onDeleteAlbum={handleDeleteAlbum}
              globalTheme={globalTheme}
              onToast={showToast}
            />
          )}

          {currentScreen === 'admin' && (
            <AdminScreen
              currentUser={currentUser}
              tracks={tracks}
              albums={albums}
              playlists={playlists}
              onDeleteTrack={handleDeleteTrack}
              onPlayTrack={playTrack}
              onSelectArtist={handleSelectArtist}
              onSelectPlaylist={handleSelectPlaylistView}
              openEditSongModal={handleOpenEditSong}
              openEditAlbumModal={handleOpenEditAlbum}
              onAlbumCreated={handleCreateAlbum}
              onDeleteAlbum={handleDeleteAlbum}
              onUpdatePlaylist={handleUpdatePlaylist}
              onDeletePlaylist={handleDeletePlaylist}
              onBack={() => handleNavigateBack('home')}
              globalTheme={globalTheme}
            />
          )}

          {currentScreen === 'stats' && (
            <StatsScreen
              tracks={tracks}
              currentUser={currentUser}
              onBack={() => handleNavigateBack('home')}
              globalTheme={globalTheme}
            />
          )}

          {currentScreen === 'download' && (
            <DownloadScreen globalTheme={globalTheme} />
          )}

          {currentScreen === 'profile' && (
            <ProfileScreen
              currentUser={currentUser}
              playlists={playlists}
              onBack={() => handleNavigateBack('home')}
              logout={logout}
              openAuthModal={() => setIsAuthOpen(true)}
              openSettings={() => setIsSettingsOpen(true)}
              onSelectPlaylist={(pl) => { handleSelectPlaylistView(pl); }}
              onOpenChat={(target) => {
                handleOpenChat(target);
              }}
              onStartJamWithUser={handleStartJamWithTargetUser}
              onTogglePlaylistVisibility={handleTogglePlaylistVisibility}
              onSavePlaylist={savePublicPlaylist}
              onUnsavePlaylist={unsavePublicPlaylist}
              userPlaylists={playlists}
              viewingUserId={viewingProfileUserId}
              onClearViewingUser={() => setViewingProfileUserId(null)}
              onNavigateScreen={goToScreen}
              globalTheme={globalTheme}
            />
          )}
        </main>

        {/* Right Perforated Filmstrip Rail */}
        <aside className="hidden xl:flex w-8 flex-col filmstrip-stripes brutal-border border-y-0 border-r-0 shrink-0"></aside>

        {/* ── Listening Activity Panel (Docked on the Right Side) ── */}
        <ListeningActivityPanel
          isOpen={isActivityPanelOpen}
          onClose={handleCloseActivityPanel}
          socket={socket}
          onSelectTrack={(friendTrack) => {
            setSelectedPlaylist(null);
            playTrack(friendTrack, [friendTrack], false, 0);
          }}
          openProfileScreen={(target) => {
            const uid = typeof target === 'object' ? (target?.id || target?._id) : target;
            if (uid && String(uid) !== String(currentUser?.id || currentUser?._id)) {
              navigateTo('profile', { userId: uid });
            } else {
              navigateTo('profile');
            }
          }}
          onStartJamWithUser={handleStartJamWithTargetUser}
          openChatModal={(target) => handleOpenChat(target || null)}
          currentUser={currentUser}
          globalTheme={globalTheme}
        />
      </div>

      {/* ── Now Playing Bar ── */}
      {(currentTrack || audio?.remoteDevicePlayback?.track) && (
        <MiniPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          togglePlay={togglePlay}
          playNext={playNextTrack}
          playPrev={playPrevTrack}
          isShuffle={isShuffle}
          toggleShuffle={toggleShuffle}
          isRepeat={isRepeat}
          repeatMode={repeatMode}
          toggleRepeat={toggleRepeat}
          toggleLike={toggleLike}
          likedTrackIds={likedTrackIds}
          openFullPlayer={handleOpenFullPlayer}
          openAddToPlaylist={() => setIsAddToPlaylistOpen(true)}
          volume={volume}
          setVolume={setVolume}
          currentTime={currentTime}
          duration={duration}
          seekTo={seekTo}
          jamSession={jamSession}
          openJamModal={handleOpenJam}
          onSelectArtist={handleSelectArtist}
          globalTheme={globalTheme}
        />
      )}

      {/* ── Modals ── */}
      <FullPlayerModal
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        togglePlay={togglePlay}
        playNext={playNextTrack}
        playPrev={playPrevTrack}
        toggleLike={toggleLike}
        likedTrackIds={likedTrackIds}
        toggleDownload={handleDownload}
        isOpen={isFullPlayerOpen}
        onClose={handleCloseFullPlayer}
        currentTime={currentTime}
        duration={duration}
        seekTo={seekTo}
        volume={volume}
        setVolume={setVolume}
        isShuffle={isShuffle}
        toggleShuffle={toggleShuffle}
        isRepeat={isRepeat}
        repeatMode={repeatMode}
        toggleRepeat={toggleRepeat}
        queue={(() => {
          const isCurQ = isQuranContent(currentTrack);
          const rawQ = jamSession ? (jamSession.queue || []) : (currentQueue?.length > 0 ? currentQueue : (isCurQ ? quranTracks : musicTracks));
          return rawQ.filter(t => isCurQ ? isQuranContent(t) : !isQuranContent(t));
        })()}
        onRemoveFromJamQueue={removeFromJamQueue}
        openAddToPlaylist={(targetTrack) => {
          setAddToPlaylistTarget(targetTrack || null);
          setIsAddToPlaylistOpen(true);
        }}
        onPlayTrack={playTrack}
        onSelectArtist={(artist) => {
          setIsFullPlayerOpen(false);
          handleSelectArtist(artist);
        }}
        onOpenEditSong={handleOpenEditSong}
        onDeleteTrack={handleDeleteTrack}
        onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
        selectedPlaylist={selectedPlaylist}
        currentQueueIndex={currentQueueIndex}
        onReorderQueue={reorderQueue}
        onClearQueue={clearQueue}
        onAddToQueue={addToQueue}
        onRemoveFromQueue={removeFromQueue}
        currentUser={currentUser}
        globalTheme={globalTheme}
      />

      <CreatePlaylistModal
        isOpen={isCreatePlaylistOpen}
        onClose={() => setIsCreatePlaylistOpen(false)}
        onCreatePlaylist={handleCreatePlaylist}
        isQuran={currentScreen === 'quran' || libraryMode === 'quran'}
      />

      <AddToPlaylistModal
        isOpen={isAddToPlaylistOpen}
        onClose={() => {
          setIsAddToPlaylistOpen(false);
          setAddToPlaylistTarget(null);
        }}
        track={addToPlaylistTarget || currentTrack}
        playlists={libraryMode === 'quran' ? quranPlaylists : musicPlaylists}
        onAddTrackToPlaylist={handleAddTrackToPlaylist}
        onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
        jamSession={jamSession}
        onAddToJamQueue={addToJamQueue}
      />

      <EditSongModal
        isOpen={isEditSongOpen}
        onClose={() => setIsEditSongOpen(false)}
        track={editingTrack}
        onUpdateSong={handleUpdateSong}
        onDeleteSong={handleDeleteSong}
        globalTheme={globalTheme}
      />

      <EditAlbumModal
        isOpen={isEditAlbumOpen}
        onClose={() => setIsEditAlbumOpen(false)}
        album={editingAlbum}
        onSaved={(updated) => {
          setAlbums(prev => prev.map(a => (String(a.id || a._id) === String(updated.id || updated._id) ? { ...a, ...updated } : a)));
          if (selectedPlaylist && (String(selectedPlaylist.id || selectedPlaylist._id) === String(updated.id || updated._id) || selectedPlaylist.name === updated.name)) {
            setSelectedPlaylist(prev => ({ ...prev, ...updated }));
          }
        }}
        onDelete={(albumId, albumObj) => {
          handleDeleteAlbum(albumId, albumObj || editingAlbum);
        }}
        globalTheme={globalTheme}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        audioQuality={audioQuality}
        setAudioQuality={setAudioQuality}
        crossfade={crossfade}
        setCrossfade={setCrossfade}
        isOfflineMode={isOfflineMode}
        setIsOfflineMode={setIsOfflineMode}
        globalTheme={globalTheme}
      />

      <AddSongModal
        isOpen={isAddSongOpen}
        onClose={() => setIsAddSongOpen(false)}
        onAddSong={handleAddSong}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
      />

      <JamRoomModal
        isOpen={isJamOpen}
        onClose={handleCloseJam}
        jamSession={jamSession}
        onStartJam={handleStartJam}
        onJoinJam={handleJoinJam}
        onLeaveJam={handleLeaveJam}
        currentTrack={jamSession?.currentTrack || currentTrack}
        isPlaying={jamSession ? Boolean(jamSession.isPlaying) : isPlaying}
        tracks={tracks}
        onAddToJamQueue={addToJamQueue}
        onRemoveFromJamQueue={removeFromJamQueue}
        onReorderJamQueue={reorderJamQueue}
        onTransferHost={handleTransferHost}
        onPlayTrack={playTrack}
        currentUser={currentUser}
        socket={socket}
        onKickMember={handleKickMember}
        onViewProfile={(uid) => navigateTo('profile', { userId: uid })}
        globalTheme={globalTheme}
      />

      <ImportPlaylistModal
        isOpen={isImportPlaylistOpen}
        onClose={() => setIsImportPlaylistOpen(false)}
        isQuran={currentScreen === 'quran' || libraryMode === 'quran'}
        onPlaylistImported={(newPl, newTracks) => {
          const importedIsQuran = currentScreen === 'quran' || libraryMode === 'quran' || isQuranContent(newPl) || (newTracks || []).some(isQuranContent);
          const taggedPlaylist = { ...newPl, isQuran: importedIsQuran };
          const taggedTracks = (newTracks || []).map(track => {
            const isQ = importedIsQuran || isQuranContent(track);
            let artist = track.artist;
            if (isQ) {
              const reciter = getQuranReciterName(track, [taggedPlaylist]);
              if (reciter && reciter !== 'تلاوات قرآنية' && reciter !== 'قارئ غير معروف') {
                artist = reciter;
              }
            }
            return { ...track, isQuran: isQ, artist };
          });
          if (taggedTracks.length > 0) {
            setTracks(prev => {
              const existingIds = new Set(prev.map(t => String(t.id || t._id)));
              const uniqueNew = taggedTracks.filter(t => !existingIds.has(String(t.id || t._id)));
              return [...uniqueNew, ...prev];
            });
          }
          setPlaylists(prev => [taggedPlaylist, ...prev.filter(p => p.id !== taggedPlaylist.id)]);
          setSelectedPlaylist(taggedPlaylist);
          setLibraryMode(importedIsQuran ? 'quran' : 'music');
          setCurrentScreen('playlist');
          showToast(`Imported "${newPl.name}" (${newPl.trackIds?.length || 0} ${importedIsQuran ? 'surahs' : 'songs'})!`);
          syncFromServer();
        }}
      />

      <ImportSongModal
        isOpen={isImportSongOpen}
        onClose={() => setIsImportSongOpen(false)}
        isQuran={currentScreen === 'quran' || libraryMode === 'quran'}
        onTrackImported={(newTrack) => {
          handleAddSong(newTrack);
          showToast(`Imported "${newTrack.title}" by ${newTrack.artist}!`);
        }}
      />

      <ChatModal
        isOpen={isChatOpen}
        onClose={handleCloseChat}
        targetUser={chatTargetUser}
        currentUser={currentUser}
        socket={socket}
        onStartJamWithUser={handleStartJamWithTargetUser}
        onJoinJam={(code) => {
          handleJoinJam(code);
        }}
        onPlayTrack={(track) => {
          playTrack(track);
        }}
        globalTheme={globalTheme}
        onViewProfile={(user) => {
          setIsChatOpen(false);
          const uId = user?.id || user?._id || (typeof user === 'string' ? user : null);
          if (uId) {
            setViewingProfileUserId(uId);
            navigateTo('profile', { userId: uId });
          } else {
            navigateTo('profile');
          }
        }}
      />

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* ── Slide-out Quick Actions Drawer (☰ 3 bars) ── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end select-none animate-in fade-in duration-200">
          {/* Backdrop */}
          <div 
            onClick={handleCloseMobileMenu} 
            className="fixed inset-0 bg-black/75 backdrop-blur-xs cursor-pointer" 
          />

          {/* Drawer Panel */}
          <div className={`relative w-72 max-w-[85vw] h-full flex flex-col brutal-border-thick border-y-0 border-r-0 shadow-2xl z-10 animate-in slide-in-from-right duration-200 ${
            globalTheme === 'dark' ? 'bg-[#101716] text-white border-zinc-800' : 'bg-[#fdfbf7] text-[#0b1110] border-black'
          }`}>
            {/* Header */}
            <div className={`p-3.5 border-b-2 flex items-center justify-between shrink-0 ${
              globalTheme === 'dark' ? 'border-zinc-800 bg-[#0b1110]' : 'border-black bg-[#ede5d3]'
            }`}>
              <RivoLogo size={28} showText={true} isDark={globalTheme === 'dark'} />
              <button
                onClick={handleCloseMobileMenu}
                className={`w-8 h-8 rounded-lg brutal-border flex items-center justify-center brutal-btn cursor-pointer ${
                  globalTheme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-white hover:bg-[#ded2bb] text-black'
                }`}
              >
                <X size={17} strokeWidth={2.5} />
              </button>
            </div>

            {/* Menu Links & Tools */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 font-display font-bold text-xs">
              {/* Quick Actions */}
              <div className="space-y-1">
                <div className="text-[10px] font-mono font-black uppercase tracking-wider text-zinc-500 mb-1 px-1">
                  Quick Actions
                </div>

                <button
                  onClick={() => { setIsAddSongOpen(true); handleCloseMobileMenu(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border brutal-shadow-sm brutal-btn cursor-pointer font-black"
                >
                  <Plus size={17} strokeWidth={3} />
                  <span>Add Song / Link</span>
                </button>

                <button
                  onClick={() => { handleOpenJam(); handleCloseMobileMenu(); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg brutal-border brutal-shadow-sm brutal-btn cursor-pointer ${
                    globalTheme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-white hover:bg-[#ede5d3] text-[#0b1110]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Radio size={16} className="text-[#f59e0b] animate-pulse" strokeWidth={2.5} />
                    <span>Jam Session</span>
                  </div>
                  <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-[#f59e0b] text-black brutal-border">
                    LIVE
                  </span>
                </button>

                <button
                  onClick={() => { handleOpenChat(null); handleCloseMobileMenu(); }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg brutal-border brutal-shadow-sm brutal-btn cursor-pointer ${
                    globalTheme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-white hover:bg-[#ede5d3] text-[#0b1110]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <MessageSquare size={16} className="text-[#17a398]" strokeWidth={2.5} />
                    <span>Messages & Chat</span>
                  </div>
                  {unreadChatCount > 0 && (
                    <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded-full bg-[#dc2626] text-white">
                      {unreadChatCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => {
                    handleToggleActivityPanel();
                    handleCloseMobileMenu();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg brutal-border brutal-shadow-sm brutal-btn cursor-pointer ${
                    globalTheme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-white hover:bg-[#ede5d3] text-[#0b1110]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Users size={16} className="text-[#17a398]" strokeWidth={2.5} />
                    <span>Listening Activity</span>
                  </div>
                  {isActivityPanelOpen && (
                    <span className="w-2 h-2 rounded-full bg-[#17a398]" />
                  )}
                </button>

                {/* Switch to Offline Mode (Mobile / Tablet Quick Action) */}
                <button
                  onClick={() => {
                    handleCloseMobileMenu();
                    if (typeof window !== 'undefined' && window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'SET_APP_MODE',
                        mode: 'offline'
                      }));
                    } else {
                      setIsOfflineMode(prev => !prev);
                      showToast(!isOfflineMode ? 'Switched to Offline Vault' : 'Switched to Online Mode', 'info');
                    }
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#0b1110] border-2 border-[#17a398] text-[#26c4b7] hover:bg-[#17a398]/20 brutal-shadow-sm brutal-btn cursor-pointer transition font-bold"
                  title="Switch to Offline Vault (Local Storage)"
                >
                  <div className="flex items-center gap-2.5">
                    <WifiOff size={16} className="text-[#17a398]" strokeWidth={2.5} />
                    <span>Switch to Offline Mode</span>
                  </div>
                  <span className="text-[8px] font-mono font-black px-1.5 py-0.5 rounded bg-[#17a398] text-[#0b1110] uppercase">
                    VAULT
                  </span>
                </button>
              </div>

              {/* Navigation */}
              <div className="space-y-1 pt-2 border-t-2 border-dashed border-zinc-800">
                <div className="text-[10px] font-mono font-black uppercase tracking-wider text-zinc-500 mb-1 px-1">
                  Browse & Decks
                </div>


                <a
                  href="/profile"
                  onClick={(e) => {
                    e.preventDefault();
                    handleUserAvatarClick();
                    handleCloseMobileMenu();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg brutal-btn cursor-pointer ${
                    currentScreen === 'profile' 
                      ? 'bg-[#17a398] text-[#0b1110] font-black brutal-border' 
                      : globalTheme === 'dark' ? 'text-zinc-300 hover:bg-zinc-800/80' : 'text-[#0b1110] hover:bg-[#ede5d3]'
                  }`}
                >
                  <Users size={16} />
                  <span>{currentUser ? 'My Profile' : 'Sign In'}</span>
                </a>

                <a
                  href="/stats"
                  onClick={(e) => {
                    e.preventDefault();
                    goToScreen('stats');
                    handleCloseMobileMenu();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg brutal-btn cursor-pointer ${
                    currentScreen === 'stats' 
                      ? 'bg-[#17a398] text-[#0b1110] font-black brutal-border' 
                      : globalTheme === 'dark' ? 'text-zinc-300 hover:bg-zinc-800/80' : 'text-[#0b1110] hover:bg-[#ede5d3]'
                  }`}
                >
                  <Activity size={16} className="text-[#17a398]" strokeWidth={2.5} />
                  <span>Stats & History</span>
                </a>

                {isUserAdmin(currentUser) && (
                  <a
                    href="/admin"
                    onClick={(e) => {
                      e.preventDefault();
                      goToScreen('admin');
                      handleCloseMobileMenu();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg brutal-btn cursor-pointer ${
                      currentScreen === 'admin'
                        ? 'bg-[#f59e0b] text-[#0b1110] font-black brutal-border'
                        : 'bg-[#f59e0b]/20 hover:bg-[#f59e0b]/30 text-[#f59e0b] brutal-border border-[#f59e0b]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <ShieldCheck size={16} strokeWidth={2.5} />
                      <span>Admin Portal</span>
                    </div>
                    <span className="text-[8px] font-mono font-black px-1.5 py-0.5 rounded bg-[#f59e0b] text-black">
                      ADMIN
                    </span>
                  </a>
                )}
              </div>

              {/* Preferences */}
              <div className="space-y-1.5 pt-2 border-t-2 border-dashed border-zinc-800">
                <div className="text-[10px] font-mono font-black uppercase tracking-wider text-zinc-500 px-1">
                  Preferences
                </div>

                <button
                  onClick={toggleGlobalTheme}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg brutal-border brutal-shadow-sm brutal-btn cursor-pointer ${
                    globalTheme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-white text-[#0b1110]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {globalTheme === 'dark' ? <Moon size={15} className="text-amber-400" /> : <Sun size={15} className="text-amber-500" />}
                    <span>{globalTheme === 'dark' ? 'Dark Theme' : 'Light Theme'}</span>
                  </div>
                  <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-zinc-700/50">
                    {globalTheme === 'dark' ? 'NIGHT' : 'DAY'}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setIsSettingsOpen(true);
                    handleCloseMobileMenu();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white brutal-border brutal-shadow-sm brutal-btn cursor-pointer font-bold"
                >
                  <div className="flex items-center gap-2">
                    <Radio size={15} className="animate-pulse text-[#57F287]" />
                    <span>Discord Rich Presence</span>
                  </div>
                  <Settings size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notification Banner ── */}
      {toastMessage && (
        <div 
          onClick={() => {
            if (typeof toastMessage === 'object' && toastMessage?.roomCode) {
              handleJoinJam(toastMessage.roomCode);
              setToastMessage(null);
            } else if (typeof toastMessage === 'object' && toastMessage?.sender) {
              handleOpenChat(toastMessage.sender);
              setToastMessage(null);
            }
          }}
          className={`fixed left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl text-xs font-display font-black brutal-border-thick brutal-shadow-lg flex items-center gap-2.5 transition-all ${
            typeof toastMessage === 'object' && (toastMessage?.sender || toastMessage?.roomCode)
              ? 'cursor-pointer pointer-events-auto hover:scale-105 active:scale-95' 
              : 'pointer-events-none'
          } ${
            toastMessage?.type === 'jam'
              ? 'bg-[#082621] text-[#fdfbf7] border-[#f59e0b]'
              : 'bg-[#fdfbf7] text-[#0b1110]'
          }`}
          style={{
            bottom: currentTrack ? 'calc(var(--player-height) + 16px)' : '24px',
          }}
        >
          {typeof toastMessage === 'object' && toastMessage?.type === 'jam' ? (
            <>
              {toastMessage.sender?.avatar ? (
                <div className="relative shrink-0">
                  <img src={toastMessage.sender.avatar} alt="" className="w-8 h-8 rounded-lg object-cover brutal-border" />
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#f59e0b] border border-black animate-ping" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-[#f59e0b] text-black brutal-border flex items-center justify-center shrink-0">
                  <Radio size={16} className="animate-pulse" />
                </div>
              )}
              <div className="flex flex-col text-left">
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-black text-[#f59e0b] text-[11px] uppercase tracking-wider">{toastMessage.title}</span>
                  <span className="text-[8px] font-mono font-black px-1 py-0.2 rounded bg-[#f59e0b] text-black">LIVE</span>
                </div>
                <span className="text-zinc-300 font-mono font-medium text-[11px] max-w-[220px] truncate">{toastMessage.body}</span>
              </div>
              <span className="text-[10px] text-[#0b1110] font-mono font-black ml-1.5 bg-[#f59e0b] hover:bg-amber-300 brutal-border px-2.5 py-1 rounded shadow-sm flex items-center gap-1 shrink-0">
                <Radio size={11} className="animate-pulse" />
                Join Jam
              </span>
            </>
          ) : typeof toastMessage === 'object' && toastMessage?.sender ? (
            <>
              {toastMessage.sender.avatar ? (
                <img src={toastMessage.sender.avatar} alt="" className="w-6 h-6 rounded-lg object-cover brutal-border shrink-0" />
              ) : (
                <span className="w-2.5 h-2.5 rounded-full bg-[#17a398] shrink-0 animate-pulse" />
              )}
              <div className="flex flex-col text-left">
                <span className="font-display font-black text-[#0f756d] text-[11px]">{toastMessage.title}</span>
                <span className="text-zinc-700 font-mono font-medium text-[11px] max-w-[220px] truncate">{toastMessage.body}</span>
              </div>
              <span className="text-[10px] text-[#0b1110] font-mono font-bold ml-1 bg-[#ede5d3] brutal-border px-2 py-0.5 rounded">Open</span>
            </>
          ) : (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-[#17a398] shrink-0" />
              <span className="font-mono text-xs">{typeof toastMessage === 'string' ? toastMessage : toastMessage?.text || ''}</span>
            </>
          )}
        </div>
      )}
    </div>
    </DownloadProvider>
  );
}

export default function App() {
  const { tracks, setTracks } = useUser();
  return (
    <AudioProvider tracks={tracks} setTracks={setTracks}>
      <AppContent />
    </AudioProvider>
  );
}
