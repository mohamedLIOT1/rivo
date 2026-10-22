import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { io } from 'socket.io-client';

import Navigation from './components/Navigation';
import MiniPlayer from './components/MiniPlayer';
import ListeningActivityPanel from './components/ListeningActivityPanel';
import AppHeader from './components/AppHeader';
import ScreenRouter from './components/ScreenRouter';
import AppModals from './components/AppModals';
import MobileDrawer from './components/MobileDrawer';
import Toast from './components/Toast';

import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { buildUrl, parseLocation } from './utils/router';
import { isUserAdmin } from './utils/adminUtils';
import { isQuranContent, getQuranReciterName } from './utils/quranUtils';
import { API_BASE_URL } from './config';
import { saveTrackOffline, removeTrackOffline, getOfflineTrackAudioUrl } from './utils/offlineStorage';
import { resumeAudioContext } from './utils/audioEngine';

import { UserProvider, useUser } from './context/UserContext';
import { AudioProvider, useAudioPlayer } from './context/AudioContext';
import { DownloadProvider } from './context/DownloadContext';
import { UIProvider, useUI } from './context/UIContext';

const getStoredToken = () => {
  try {
    return localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
  } catch {
    return '';
  }
};

function MainAppShell() {
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
    currentQueue,
    currentQueueIndex,
    currentTime, duration,
    volume, setVolume,
    isShuffle, setIsShuffle, toggleShuffle,
    isRepeat, setIsRepeat, repeatMode, toggleRepeat,
    isOfflineMode, setIsOfflineMode,
    togglePlay, playTrack, playNextTrack, playPrevTrack, seekTo,
    addToQueue, removeFromQueue,
    reorderQueue, clearQueue,
    setJamSync, syncRemotePlayState, addToJamQueue, removeFromJamQueue, reorderJamQueue
  } = audio;

  const ui = useUI();
  const {
    globalTheme,
    toggleGlobalTheme,
    isActivityPanelOpen,
    toggleActivityPanel,
    closeActivityPanel,
    openMobileMenu,
    closeMobileMenu,
    openFullPlayer,
    closeFullPlayer,
    openEditSong,
    openEditAlbum,
    openAddToPlaylist,
    isAuthOpen,
    setIsAuthOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isAddSongOpen,
    setIsAddSongOpen,
    isCreatePlaylistOpen,
    setIsCreatePlaylistOpen,
    isImportPlaylistOpen,
    setIsImportPlaylistOpen,
    isImportSongOpen,
    setIsImportSongOpen,
    isShortcutsOpen,
    setIsShortcutsOpen,
    isJamOpen,
    setIsJamOpen,
    isChatOpen,
    setIsChatOpen,
    chatTargetUser,
    setChatTargetUser,
    unreadChatCount,
    setUnreadChatCount,
    showToast,
    clearToast,
    pushModalHistory,
    closeModalHistory,
  } = ui;

  // ── Screen Navigation Initial State from URL ─────────────────────────
  const initialNav = useMemo(() => {
    if (typeof window === 'undefined') return { screen: 'home', params: {} };
    return parseLocation(window.location.pathname, window.location.search);
  }, []);

  const [currentScreen, setCurrentScreen] = useState(initialNav.screen || 'home');
  const [topSearchQuery, setTopSearchQuery] = useState(initialNav.params?.query || '');
  const [selectedArtist, setSelectedArtist] = useState(() => {
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
  const [libraryMode, setLibraryMode] = useState(initialNav.screen === 'quran' ? 'quran' : 'music');
  const [viewingProfileUserId, setViewingProfileUserId] = useState(initialNav.params?.userId || null);
  const [albums, setAlbums] = useState([]);
  const [jamSession, setJamSession] = useState(null);
  const [socket, setSocket] = useState(null);
  const [audioQuality, setAudioQuality] = useState('320');
  const [crossfade, setCrossfade] = useState(4);

  const playlistsRef = useRef(playlists);
  useEffect(() => { playlistsRef.current = playlists; }, [playlists]);

  const albumsRef = useRef(albums);
  useEffect(() => { albumsRef.current = albums; }, [albums]);

  const currentScreenRef = useRef(currentScreen);
  useEffect(() => { currentScreenRef.current = currentScreen; }, [currentScreen]);

  const jamSessionRef = useRef(jamSession);
  useEffect(() => { jamSessionRef.current = jamSession; }, [jamSession]);

  const isChatOpenRef = useRef(isChatOpen);
  useEffect(() => { isChatOpenRef.current = isChatOpen; }, [isChatOpen]);

  const chatTargetUserRef = useRef(chatTargetUser);
  useEffect(() => { chatTargetUserRef.current = chatTargetUser; }, [chatTargetUser]);

  const currentUserRef = useRef(currentUser);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);

  const syncRemotePlayStateRef = useRef(syncRemotePlayState);
  useEffect(() => { syncRemotePlayStateRef.current = syncRemotePlayState; }, [syncRemotePlayState]);

  const activeNotificationsRef = useRef({});

  // Clean Native Splash if present
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.removeSplash === 'function') {
      window.removeSplash();
    }
  }, []);

  const musicTracks = useMemo(() => tracks.filter(track => !isQuranContent(track)), [tracks]);
  const quranTracks = useMemo(() => tracks.filter(track => isQuranContent(track)), [tracks]);
  const musicPlaylists = useMemo(() => playlists.filter(playlist => !isQuranContent(playlist)), [playlists]);
  const quranPlaylists = useMemo(() => playlists.filter(playlist => isQuranContent(playlist)), [playlists]);
  const musicAlbums = useMemo(() => albums.filter(album => !isQuranContent(album)), [albums]);

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
        closeActivityPanel();
        closeMobileMenu();
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
            const alb = albumsRef.current.find(a => String(a.id || a._id) === idStr);
            if (alb) {
              setSelectedPlaylist({ ...alb, isAlbum: true });
            }
          }
        }
      }
      setSelectedArtist(null);
      setViewingProfileUserId(null);
    }
  }, [getLikedSongsPlaylist, closeActivityPanel, closeMobileMenu, setIsChatOpen, setIsJamOpen]);

  const goToScreen = useCallback((screen, extra = {}) => {
    if (screen === 'liked') {
      navigateTo('playlist', { id: 'liked', playlist: getLikedSongsPlaylist() });
      return;
    }
    navigateTo(screen, extra);
  }, [navigateTo, getLikedSongsPlaylist]);

  const handleNavigateBack = useCallback((fallbackScreen = 'home') => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      goToScreen(fallbackScreen);
    }
  }, [goToScreen]);

  // Window Popstate Listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (e) => {
      const state = e.state;
      if (state?.modal) {
        return;
      }

      const { screen, params } = parseLocation(window.location.pathname, window.location.search);
      setCurrentScreen(screen || 'home');

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
      } else if (screen === 'profile') {
        setViewingProfileUserId(params.userId || null);
        setSelectedArtist(null);
        setSelectedPlaylist(null);
      } else if (screen === 'artist' && params.name) {
        setSelectedArtist({ name: params.name, id: params.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-') });
        setSelectedPlaylist(null);
        setViewingProfileUserId(null);
      } else if (screen === 'playlist') {
        if (params.id) {
          const selId = String(params.id);
          if (selId === 'liked') {
            setSelectedPlaylist(getLikedSongsPlaylist());
            setLibraryMode('music');
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
        }
        setSelectedArtist(null);
        setViewingProfileUserId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [getLikedSongsPlaylist]);

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
  }, [currentUser, setUnreadChatCount]);

  // Open auth on first boot if no user
  useEffect(() => {
    if (!currentUser) setIsAuthOpen(true);
  }, [currentUser, setIsAuthOpen]);

  // Keyboard Shortcuts Hook
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

  // ── Handlers ─────────────────────────────────────────────────────────
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
    }

    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      closeActivityPanel();
    }
    pushModalHistory('chat');
  }, [pushModalHistory, socket, closeActivityPanel, setChatTargetUser, setIsChatOpen, setUnreadChatCount]);

  const handleCloseChat = useCallback(() => {
    setIsChatOpen(false);
    setChatTargetUser(null);
    closeModalHistory('chat');
  }, [closeModalHistory, setIsChatOpen, setChatTargetUser]);

  const handleOpenJam = useCallback(() => {
    setIsJamOpen(true);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      closeActivityPanel();
    }
    pushModalHistory('jam');
  }, [pushModalHistory, closeActivityPanel, setIsJamOpen]);

  const handleCloseJam = useCallback(() => {
    setIsJamOpen(false);
    closeModalHistory('jam');
  }, [closeModalHistory, setIsJamOpen]);

  const handleStartJam = (openModal = true) => {
    resumeAudioContext();
    const code = jamSession?.code || `JAM-${Math.floor(1000 + Math.random() * 9000)}`;
    const userPayload = currentUser 
      ? { id: currentUser.id || currentUser._id, name: currentUser.name, avatar: currentUser.avatar }
      : { id: `user-${Math.floor(1000 + Math.random() * 9000)}`, name: 'Guest Listener', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' };

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
      if (!socket.connected) socket.connect();
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
      if (!socket.connected) socket.connect();
      socket.emit('jam:join_room', { roomCode: cleanCode, user: userPayload });
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

  const handleTransferHost = (memberSocketId) => {
    if (jamSession && socket && memberSocketId) {
      socket.emit('jam:transfer_host', { roomCode: jamSession.code, newHostSocketId: memberSocketId });
    }
  };

  const handleKickMember = (memberSocketId) => {
    if (jamSession && socket && memberSocketId) {
      socket.emit('jam:kick_member', { roomCode: jamSession.code, targetSocketId: memberSocketId });
    }
  };

  // Socket Connection and Event Listeners
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
        s.emit('user:online', { userId: curUser.id || curUser._id });
      }
      if (jamSessionRef.current?.code) {
        const userPayload = curUser 
          ? { id: curUser.id || curUser._id, name: curUser.name, avatar: curUser.avatar }
          : { id: `user-${Math.floor(1000 + Math.random() * 9000)}`, name: 'Guest Listener', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' };
        s.emit('jam:join_room', { roomCode: jamSessionRef.current.code, user: userPayload });
      }
    });

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
      syncRemotePlayState({ isPlaying: false, currentTrack: data?.currentTrack, currentTime: data?.currentTime });
    });

    s.on('jam:host_changed', ({ hostName }) => {
      if (hostName) showToast(`Jam Host transferred to ${hostName}`);
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
        sender: { id: data?.host?.id, name: hostName, avatar: data?.host?.avatar || '' }
      });
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
      }
    });

    return () => s.disconnect();
  }, [currentUser?.id, currentUser?._id, setJamSync, syncRemotePlayState, showToast, handleCloseJam, setUnreadChatCount]);

  useEffect(() => {
    if (socket) {
      setJamSync({ socket, jamSession });
    }
  }, [socket, jamSession, setJamSync]);

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

    if (songToAdd.source === 'YouTube') {
      try {
        const token = getStoredToken();
        await fetch(`${API_BASE_URL}/api/tracks/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(songToAdd),
        });
        syncFromServer();
        fetchAlbums();
      } catch {}
    } else {
      fetchAlbums();
    }
  };

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
        trackIds: (prev.trackIds || []).filter(id => String(id) !== cleanId),
        tracks: (prev.tracks || []).filter(t => String(t.id || t._id) !== cleanId)
      };
    });
    setAlbums(prev => prev.map(a => ({
      ...a,
      trackIds: (a.trackIds || []).filter(id => String(id) !== cleanId),
      tracks: (a.tracks || []).filter(t => String(t.id || t._id) !== cleanId)
    })));
    await deleteTrack(cleanId);
  };

  const handleDeleteAlbum = async (albumId, albumObj = null, deleteTracks = true) => {
    if (!albumId) return;
    const cleanId = String(albumId);
    const targetAlbum = albumObj || albums.find(a => String(a.id || a._id) === cleanId || a.name === cleanId);
    const albumName = targetAlbum?.name || (selectedPlaylist && (String(selectedPlaylist.id || selectedPlaylist._id) === cleanId || selectedPlaylist.name === cleanId) ? selectedPlaylist.name : null);

    setAlbums(prev => prev.filter(a => String(a.id || a._id) !== cleanId && (!albumName || a.name?.toLowerCase().trim() !== albumName.toLowerCase().trim())));

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
      if (affectedTracks.size > 0) {
        setTracks(prev => prev.filter(t => !affectedTracks.has(String(t.id || t._id))));
        setPlaylists(prev => prev.map(pl => ({
          ...pl,
          trackIds: (pl.trackIds || []).filter(id => !affectedTracks.has(String(id)))
        })));
      }
    } else {
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
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ deleteTracks: Boolean(deleteTracks) })
        });
      }
    } catch {}
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
        if (selectedSet.has(String(t.id || t._id))) return { ...t, album: newAlbum.name };
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
    } catch {}
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
        await fetch(`${API_BASE_URL}/api/playlists/${encodeURIComponent(plId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(updatedPl),
        });
      }
    } catch {}
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

  const handleRemoveTrackFromPlaylist = async (trackId, playlistId) => {
    const targetId = String(trackId);
    setSelectedPlaylist(prev => {
      if (!prev || String(prev.id) !== String(playlistId)) return prev;
      return { ...prev, trackIds: (prev.trackIds || []).filter(id => String(id) !== targetId) };
    });
    await removeTrackFromPlaylist(trackId, playlistId);
  };

  const handleTogglePlaylistVisibility = async (playlistId, isPublic) => {
    const cleanId = String(playlistId);
    setPlaylists(prev => prev.map(p => String(p.id || p._id) === cleanId ? { ...p, isPublic } : p));
    if (selectedPlaylist && String(selectedPlaylist.id || selectedPlaylist._id) === cleanId) {
      setSelectedPlaylist(prev => ({ ...prev, isPublic }));
    }
    try {
      const token = getStoredToken();
      if (token) {
        await fetch(`${API_BASE_URL}/api/playlists/${encodeURIComponent(cleanId)}/visibility`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ isPublic }),
        });
        showToast(isPublic ? 'Playlist made Public' : 'Playlist made Private');
      }
    } catch {}
  };

  const handleSelectArtist = useCallback((artist) => {
    if (!artist) return;
    const name = typeof artist === 'string' ? artist.trim() : (artist.name || '').trim();
    if (!name) return;
    const artistObj = typeof artist === 'string'
      ? { name, id: name.toLowerCase().replace(/[^a-z0-9_-]/g, '-') }
      : artist;
    setSelectedArtist(artistObj);
    navigateTo('artist', { name: artistObj.name });
  }, [navigateTo]);

  const handleSelectPlaylistView = useCallback((pl) => {
    if (!pl) return;
    if (pl.isLikedSongs || pl.id === 'liked') {
      goToScreen('liked');
      return;
    }
    const isQ = Boolean(pl.isQuran || isQuranContent(pl));
    setLibraryMode(isQ ? 'quran' : 'music');
    setSelectedPlaylist(pl);
    navigateTo('playlist', { id: pl.id || pl._id, albumName: pl.isAlbum ? pl.name : undefined });
  }, [goToScreen, navigateTo]);

  const handleUserAvatarClick = () => {
    if (currentUser) {
      goToScreen('profile');
    } else {
      setIsAuthOpen(true);
    }
  };

  const handleDownload = async (track) => {
    const cleanId = String(track?.id || track?._id || '');
    if (!track) return;

    if (track.downloaded) {
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
        const freshAudioUrl = await getOfflineTrackAudioUrl(cleanId);
        const freshCover = track.cover || result.coverBase64 || null;
        const patchFields = {
          downloaded: true,
          audioUrl: freshAudioUrl || result.audioUrl,
          cover: freshCover,
          nativeAudioUri: result.nativeAudioUri || null,
          nativeCoverUri: result.nativeCoverUri || null,
        };

        setTracks(prev => prev.map(t => String(t.id || t._id) === cleanId ? { ...t, ...patchFields } : t));

        if (currentTrack && String(currentTrack.id || currentTrack._id) === cleanId) {
          setCurrentTrack(prev => ({
            ...prev,
            downloaded: true,
            nativeAudioUri: result.nativeAudioUri || null,
            nativeCoverUri: result.nativeCoverUri || null,
          }));
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
        {/* Top Header */}
        <AppHeader
          currentScreen={currentScreen}
          goToScreen={goToScreen}
          navigateTo={navigateTo}
          topSearchQuery={topSearchQuery}
          setTopSearchQuery={setTopSearchQuery}
          currentUser={currentUser}
          handleUserAvatarClick={handleUserAvatarClick}
        />

        {/* Main Workspace */}
        <div className="flex-1 flex overflow-hidden relative">
          <aside className="hidden xl:flex w-8 flex-col filmstrip-stripes brutal-border border-y-0 border-l-0 shrink-0"></aside>

          {/* Navigation Rail */}
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
            toggleActivityPanel={toggleActivityPanel}
            globalTheme={globalTheme}
            likedTrackIds={likedTrackIds}
            selectedPlaylist={selectedPlaylist}
            onSelectLikedSongs={() => goToScreen('liked')}
          />

          {/* Main Content Area */}
          <main
            className={`flex-1 flex flex-col overflow-hidden relative ${
              currentTrack ? 'pb-[114px] md:pb-[96px]' : 'pb-[52px] md:pb-0'
            }`}
            style={{
              background: globalTheme === 'dark' ? '#0b1110' : '#17a398',
              paddingTop: 0,
            }}
          >
            <ScreenRouter
              currentScreen={currentScreen}
              musicTracks={musicTracks}
              quranTracks={quranTracks}
              tracks={tracks}
              musicPlaylists={musicPlaylists}
              quranPlaylists={quranPlaylists}
              playlists={playlists}
              musicAlbums={musicAlbums}
              albums={albums}
              selectedPlaylist={selectedPlaylist}
              selectedArtist={selectedArtist}
              viewingProfileUserId={viewingProfileUserId}
              setViewingProfileUserId={setViewingProfileUserId}
              topSearchQuery={topSearchQuery}
              playTrack={playTrack}
              handleSelectPlaylistView={handleSelectPlaylistView}
              handleSelectArtist={handleSelectArtist}
              toggleLike={toggleLike}
              handleDownload={handleDownload}
              handleNavigateBack={handleNavigateBack}
              goToScreen={goToScreen}
              navigateTo={navigateTo}
              handleOpenEditSong={openEditSong}
              handleOpenEditAlbum={openEditAlbum}
              handleOpenAddToPlaylist={openAddToPlaylist}
              handleDeleteTrack={handleDeleteTrack}
              handleDeleteAlbum={handleDeleteAlbum}
              handleCreateAlbum={handleCreateAlbum}
              handleAddSong={handleAddSong}
              handleCreatePlaylist={handleCreatePlaylist}
              handleDeletePlaylist={handleDeletePlaylist}
              handleUpdatePlaylist={handleUpdatePlaylist}
              handleAddTrackToPlaylist={handleAddTrackToPlaylist}
              handleRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
              handleTogglePlaylistVisibility={handleTogglePlaylistVisibility}
              savePublicPlaylist={savePublicPlaylist}
              unsavePublicPlaylist={unsavePublicPlaylist}
              handleStartJamWithTargetUser={handleStartJamWithTargetUser}
              handleOpenJam={handleOpenJam}
              handleOpenChat={handleOpenChat}
              jamSession={jamSession}
              unreadChatCount={unreadChatCount}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              currentUser={currentUser}
              logout={logout}
              likedTrackIds={likedTrackIds}
              globalTheme={globalTheme}
              showToast={showToast}
              isActivityPanelOpen={isActivityPanelOpen}
              toggleActivityPanel={toggleActivityPanel}
              setIsAddSongOpen={setIsAddSongOpen}
              setIsCreatePlaylistOpen={setIsCreatePlaylistOpen}
              setIsImportPlaylistOpen={setIsImportPlaylistOpen}
              setIsImportSongOpen={setIsImportSongOpen}
              setIsAuthOpen={setIsAuthOpen}
              setIsSettingsOpen={setIsSettingsOpen}
            />
          </main>

          {/* Listening Activity Right Panel */}
          <ListeningActivityPanel
            isOpen={isActivityPanelOpen}
            onClose={closeActivityPanel}
            currentUser={currentUser}
            socket={socket}
            onPlayTrack={playTrack}
            onStartJamWithUser={handleStartJamWithTargetUser}
            onOpenChat={handleOpenChat}
            onJoinJam={handleJoinJam}
            onViewProfile={(u) => {
              const uId = u?.id || u?._id || (typeof u === 'string' ? u : null);
              if (uId) navigateTo('profile', { userId: uId });
              else navigateTo('profile');
            }}
            globalTheme={globalTheme}
          />
        </div>

        {/* Mini Player */}
        <MiniPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onNext={playNextTrack}
          onPrev={playPrevTrack}
          liked={Boolean(currentTrack && likedTrackIds?.some(id => String(id) === String(currentTrack.id || currentTrack._id)))}
          toggleLike={toggleLike}
          toggleDownload={handleDownload}
          onOpenFullPlayer={openFullPlayer}
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
          onOpenAddToPlaylist={openAddToPlaylist}
          onOpenJamModal={handleOpenJam}
          jamSession={jamSession}
          onLeaveJam={handleLeaveJam}
          onJoinJam={handleJoinJam}
          currentUser={currentUser}
          globalTheme={globalTheme}
        />

        {/* Central Modals */}
        <AppModals
          audio={audio}
          currentUser={currentUser}
          tracks={tracks}
          setTracks={setTracks}
          playlists={playlists}
          setPlaylists={setPlaylists}
          albums={albums}
          setAlbums={setAlbums}
          likedTrackIds={likedTrackIds}
          syncFromServer={syncFromServer}
          audioQuality={audioQuality}
          setAudioQuality={setAudioQuality}
          crossfade={crossfade}
          setCrossfade={setCrossfade}
          handleDownload={handleDownload}
          handleSelectArtist={handleSelectArtist}
          handleDeleteTrack={handleDeleteTrack}
          handleRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
          selectedPlaylist={selectedPlaylist}
          setSelectedPlaylist={setSelectedPlaylist}
          handleCreatePlaylist={handleCreatePlaylist}
          handleAddTrackToPlaylist={handleAddTrackToPlaylist}
          handleUpdateSong={handleUpdateSong}
          handleDeleteSong={handleDeleteTrack}
          handleDeleteAlbum={handleDeleteAlbum}
          handleAddSong={handleAddSong}
          handleCloseJam={handleCloseJam}
          handleStartJam={handleStartJam}
          handleJoinJam={handleJoinJam}
          handleLeaveJam={handleLeaveJam}
          handleTransferHost={handleTransferHost}
          handleKickMember={handleKickMember}
          handleStartJamWithTargetUser={handleStartJamWithTargetUser}
          handleCloseChat={handleCloseChat}
          navigateTo={navigateTo}
          socket={socket}
          jamSession={jamSession}
          currentScreen={currentScreen}
          libraryMode={libraryMode}
          setLibraryMode={setLibraryMode}
          musicPlaylists={musicPlaylists}
          quranPlaylists={quranPlaylists}
          musicTracks={musicTracks}
          quranTracks={quranTracks}
        />

        {/* Mobile Navigation Drawer */}
        <MobileDrawer
          currentUser={currentUser}
          currentScreen={currentScreen}
          onNavigate={goToScreen}
          onOpenAuth={() => setIsAuthOpen(true)}
          onOpenJam={handleOpenJam}
          onOpenChat={handleOpenChat}
          onOpenAddSong={() => setIsAddSongOpen(true)}
        />

        {/* Toast Notifications */}
        <Toast
          currentTrack={currentTrack}
          onJoinJam={handleJoinJam}
          onOpenChat={handleOpenChat}
        />
      </div>
    </DownloadProvider>
  );
}

export default function App() {
  const { tracks, setTracks } = useUser();
  return (
    <UIProvider>
      <AudioProvider tracks={tracks} setTracks={setTracks}>
        <MainAppShell />
      </AudioProvider>
    </UIProvider>
  );
}
