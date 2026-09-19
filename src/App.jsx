import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Search as SearchIcon, X, Plus, Radio, MessageSquare, ChevronDown, Users, Sun, Moon, Menu, Disc, Sparkles, ShieldCheck } from 'lucide-react';
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

import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import LibraryScreen from './screens/LibraryScreen';
import ArtistScreen from './screens/ArtistScreen';
import StatsScreen from './screens/StatsScreen';
import PlaylistScreen from './screens/PlaylistScreen';
import PodcastsScreen from './screens/PodcastsScreen';
import ProfileScreen from './screens/ProfileScreen';
import MixesScreen from './screens/MixesScreen';
import QuranScreen from './screens/QuranScreen';
import AdminScreen from './screens/AdminScreen';
import { isUserAdmin } from './utils/adminUtils';
import { isQuranContent, getQuranReciterName } from './utils/quranUtils';

import { API_BASE_URL } from './config';
import { saveTrackOffline, removeTrackOffline, getOfflineTrackAudioUrl } from './utils/offlineStorage';
import { resumeAudioContext } from './utils/audioEngine';
import { UserProvider, useUser } from './context/UserContext';
import { AudioProvider, useAudioPlayer } from './context/AudioContext';

const getStoredToken = () => {
  try {
    return localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
  } catch {
    return '';
  }
};

function AppContent() {
  const {
    currentUser, login, logout,
    tracks, setTracks,
    playlists, setPlaylists,
    likedTrackIds, toggleLike,
    deleteTrack, removeTrackFromPlaylist,
    syncFromServer,
  } = useUser();

  const audio = useAudioPlayer();
  const {
    currentTrack, setCurrentTrack, isPlaying, setIsPlaying,
    currentQueue, setCurrentQueue,
    currentTime, duration,
    volume, setVolume, isShuffle, setIsShuffle, toggleShuffle, isRepeat, setIsRepeat,
    isOfflineMode, setIsOfflineMode,
    togglePlay, playTrack, playNextTrack, playPrevTrack, seekTo,
    setJamSync, syncRemotePlayState, addToJamQueue, removeFromJamQueue
  } = audio;

  // Screen Navigation
  const [currentScreen, setCurrentScreen]     = useState('home');
  const [topSearchQuery, setTopSearchQuery]   = useState('');
  const [selectedArtist, setSelectedArtist]   = useState(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [libraryMode, setLibraryMode] = useState('music');
  const [viewingProfileUserId, setViewingProfileUserId] = useState(null);
  const [albums, setAlbums]                   = useState([]);

  const musicTracks = tracks.filter(track => !isQuranContent(track));
  const quranTracks = tracks.filter(track => isQuranContent(track));
  const musicPlaylists = playlists.filter(playlist => !isQuranContent(playlist));
  const quranPlaylists = playlists.filter(playlist => isQuranContent(playlist));
  const musicAlbums = albums.filter(album => !isQuranContent(album));
  const quranAlbums = albums.filter(album => isQuranContent(album));

  // Modals
  const [isFullPlayerOpen,    setIsFullPlayerOpen]    = useState(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
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

  const toggleActivityPanel = () => {
    setIsActivityPanelOpen(prev => {
      const next = !prev;
      try {
        localStorage.setItem('rivo_activity_panel_open', JSON.stringify(next));
        localStorage.setItem('liofy_activity_panel_open', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const [chatTargetUser,      setChatTargetUser]      = useState(null);
  const [unreadChatCount,     setUnreadChatCount]     = useState(0);
  const [socket,              setSocket]              = useState(null);

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

  const isChatOpenRef = useRef(isChatOpen);
  useEffect(() => { isChatOpenRef.current = isChatOpen; }, [isChatOpen]);

  const chatTargetUserRef = useRef(chatTargetUser);
  useEffect(() => { chatTargetUserRef.current = chatTargetUser; }, [chatTargetUser]);

  const handleOpenChat = (target = null) => {
    setChatTargetUser(target);
    setIsChatOpen(true);
    setUnreadChatCount(0);
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  };

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

  // Open profile screen instead of AuthModal when user is logged in
  const handleUserAvatarClick = () => {
    if (currentUser) {
      setCurrentScreen('profile');
    } else {
      setIsAuthOpen(true);
    }
  };

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
    if (songToAdd.source === 'YouTube' || songToAdd.source === 'SoundCloud') {
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

  const handleCreatePlaylist = async (name, description, cover = '', isPublic = true) => {
    const isQ = currentScreen === 'quran' || libraryMode === 'quran' || isQuranContent({ title: name, description });
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
    setPlaylists(prev => prev.filter(p => p.id !== playlistId));
    if (selectedPlaylist?.id === playlistId) {
      setSelectedPlaylist(null);
      setCurrentScreen('library');
    }
    try {
      const token = getStoredToken();
      if (token) {
        await fetch(`${API_BASE_URL}/api/playlists/${encodeURIComponent(playlistId)}`, {
          method: 'DELETE',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
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

  const handleSelectArtist = (artist) => {
    if (!artist) return;
    const artistObj = typeof artist === 'string'
      ? { name: artist.trim(), id: artist.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-') }
      : artist;
    setSelectedArtist(artistObj);
    setCurrentScreen('artist');
  };
  const handleSelectPlaylistView = (pl) => {
    setSelectedPlaylist(pl);
    const isQ = Boolean(pl?.isQuran || isQuranContent(pl));
    setLibraryMode(isQ ? 'quran' : 'music');
    setCurrentScreen('playlist');
  };

  const handlePlayPodcastEpisode = (episode, podcast) => {
    playTrack({
      id: episode.id,
      title: episode.title,
      artist: podcast.author,
      album: podcast.title,
      cover: podcast.cover,
      audioUrl: episode.audioUrl,
      duration: 180,
      liked: false,
      lyrics: [{ time: 0, text: episode.description }],
    });
  };

  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 5000);
  };

  useEffect(() => {
    const s = io(API_BASE_URL, { transports: ['websocket', 'polling'] });
    setSocket(s);

    if (currentUser?.id || currentUser?._id) {
      const uid = currentUser.id || currentUser._id;
      s.emit('user:online', { userId: uid });
    }

    s.on('jam:room_updated', (room) => {
      setJamSession(room);
      setJamSync({ socket: s, jamSession: room });
    });

    s.on('jam:kicked', (data) => {
      alert(data?.reason || 'You were kicked from the Jam room by the host.');
      setJamSession(null);
      setJamSync({ jamSession: null });
      setIsJamOpen(false);
    });

    s.on('jam:sync_play_state', (data) => {
      syncRemotePlayState(data);
    });

    s.on('jam:on_play_state_changed', (data) => {
      syncRemotePlayState(data);
    });

    s.on('chat:message', (msg) => {
      const myId = String(currentUser?.id || currentUser?._id || '');
      if (myId && String(msg.recipient) === myId) {
        const isOpenWithSender = isChatOpenRef.current && String(chatTargetUserRef.current?.id || chatTargetUserRef.current?._id) === String(msg.sender);
        if (!isOpenWithSender) {
          setUnreadChatCount(prev => prev + 1);

          const senderName = msg.senderName || 'Someone';
          const preview = msg.text || (msg.track ? `Shared song: ${msg.track.title || 'a track'}` : (msg.jamInvite ? 'Invited you to a Jam Session' : 'Sent an attachment'));

          showToast({
            title: `💬 ${senderName}`,
            body: preview,
            sender: { id: msg.sender, name: senderName, avatar: msg.senderAvatar }
          });

          // Browser Desktop Push Notification
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              const notif = new Notification(`Rivo • Telegram from ${senderName}`, {
                body: preview,
                icon: msg.senderAvatar || '/favicon.ico',
                tag: `rivo-chat-${msg.sender}`
              });
              notif.onclick = () => {
                window.focus();
                handleOpenChat({ id: msg.sender, name: senderName, avatar: msg.senderAvatar });
              };
            } catch (e) {
              console.warn('Desktop notification error:', e);
            }
          }
        }
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
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [jamSession?.code, socket]);

  const handleStartJam = (openModal = true) => {
    resumeAudioContext();
    const code = jamSession?.code || `JAM-${Math.floor(1000 + Math.random() * 9000)}`;
    const userPayload = currentUser 
      ? { id: currentUser.id || currentUser._id, name: currentUser.name, avatar: currentUser.avatar }
      : { id: `user-${Math.floor(1000 + Math.random() * 9000)}`, name: 'Guest Listener', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' };

    if (socket && !jamSession?.code) {
      socket.emit('jam:join_room', {
        roomCode: code,
        user: userPayload
      });
      showToast(`Jam Session active: ${code}`);
    }
    if (openModal) {
      setIsJamOpen(true);
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
      socket.emit('jam:join_room', {
        roomCode: cleanCode,
        user: userPayload
      });
      setIsJamOpen(true);
      showToast(`Joined Jam: ${cleanCode}`);
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

  const handleDownload = async (trackId) => {
    const cleanId = String(trackId);
    const track = tracks.find(t => String(t.id || t._id) === cleanId) || 
                  (currentTrack && String(currentTrack.id || currentTrack._id) === cleanId ? currentTrack : null);
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

        // Also trigger browser file download on web platform
        if (typeof window !== 'undefined' && !window.Capacitor) {
          try {
            const dlLink = document.createElement('a');
            dlLink.href = `${API_BASE_URL}/api/tracks/download?url=${encodeURIComponent(track.audioUrl || '')}&title=${encodeURIComponent(track.title || '')}&artist=${encodeURIComponent(track.artist || '')}&id=${encodeURIComponent(cleanId)}`;
            dlLink.setAttribute('download', `${track.artist || 'Track'} - ${track.title || 'Song'}.mp3`);
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

  // Screen nav helper
  const goToScreen = (screen) => {
    if (typeof screen === 'string' && screen.startsWith('playlist:')) {
      const plId = screen.split(':')[1];
      const pl = playlists.find(p => String(p.id || p._id) === String(plId));
      if (pl) handleSelectPlaylistView(pl);
    } else {
      if (screen === 'quran') setLibraryMode('quran');
      if (screen === 'library' || screen === 'home' || screen === 'search' || screen === 'mixes') setLibraryMode('music');
      setCurrentScreen(screen);
    }
  };

  return (
    <div className="flex flex-col text-[#0b1110] overflow-hidden select-none font-sans" style={{ height: '100dvh', background: '#082621' }}>

      {/* ── TOP APOTHECARY NAV BAR (Rivo Design) ── */}
      <header className="bg-[#0b1110] text-[#fdfbf7] brutal-border-thick border-x-0 border-t-0 px-2.5 sm:px-5 py-1.5 sm:py-2 flex items-center justify-between gap-1.5 sm:gap-3 z-30 shrink-0">
        
        {/* Brand identity: RIVO */}
        <div 
          onClick={() => setCurrentScreen('home')} 
          className="cursor-pointer flex items-center shrink-0"
        >
          <RivoLogo size={34} showText={true} textClassName="text-white text-lg sm:text-xl" isDark={true} />
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
                setTopSearchQuery(e.target.value);
                if (currentScreen !== 'search') setCurrentScreen('search');
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
                onClick={() => setTopSearchQuery('')}
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

            {/* Quick Actions Drawer Toggle (☰ 3 bars) */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
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
          openJamModal={() => setIsJamOpen(true)}
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
              onDeleteTrack={isUserAdmin(currentUser) ? handleDeleteTrack : undefined}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              currentUser={currentUser}
              logout={logout}
              openAuthModal={() => setIsAuthOpen(true)}
              openProfileScreen={() => setCurrentScreen('profile')}
              openJamModal={() => setIsJamOpen(true)}
              jamSession={jamSession}
              openChatModal={() => handleOpenChat(null)}
              unreadChatCount={unreadChatCount}
              isActivityPanelOpen={isActivityPanelOpen}
              toggleActivityPanel={toggleActivityPanel}
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
              onOpenAddSongModal={() => setIsAddSongOpen(true)}
              onAddToLibrary={handleAddSong}
              onDeleteTrack={isUserAdmin(currentUser) ? handleDeleteTrack : undefined}
              currentUser={currentUser}
              onViewProfile={(userId) => {
                setViewingProfileUserId(userId);
                setCurrentScreen('profile');
              }}
              globalTheme={globalTheme}
            />
          )}

          {currentScreen === 'library' && (
            <LibraryScreen
              playlists={musicPlaylists}
              albums={musicAlbums}
              tracks={musicTracks}
              onSelectPlaylist={handleSelectPlaylistView}
              onSelectArtist={handleSelectArtist}
              onSelectTrack={playTrack}
              openCreatePlaylistModal={() => setIsCreatePlaylistOpen(true)}
              openImportPlaylistModal={() => setIsImportPlaylistOpen(true)}
              openImportSongModal={() => setIsImportSongOpen(true)}
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
              playlist={playlists.find(p => String(p.id) === String(selectedPlaylist.id)) || albums.find(a => String(a.id) === String(selectedPlaylist.id)) || selectedPlaylist}
              tracks={isQuranContent(selectedPlaylist) ? quranTracks : musicTracks}
              currentUser={currentUser}
              onSelectTrack={playTrack}
              onSelectArtist={handleSelectArtist}
              toggleLike={toggleLike}
              toggleDownload={handleDownload}
              onBack={() => setCurrentScreen(isQuranContent(selectedPlaylist) ? 'quran' : 'library')}
              onAddTrackToPlaylist={handleAddTrackToPlaylist}
              onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
              onDeleteTrack={isUserAdmin(currentUser) ? handleDeleteTrack : undefined}
              openEditSongModal={handleOpenEditSong}
              openEditAlbumModal={handleOpenEditAlbum}
              onUpdatePlaylist={handleUpdatePlaylist}
              onDeletePlaylist={handleDeletePlaylist}
              onTogglePlaylistVisibility={handleTogglePlaylistVisibility}
              globalTheme={globalTheme}
            />
          )}

          {currentScreen === 'podcasts' && (
            <PodcastsScreen onPlayEpisode={handlePlayPodcastEpisode} globalTheme={globalTheme} />
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
              onBack={() => setCurrentScreen('home')}
              currentUser={currentUser}
              openEditSongModal={handleOpenEditSong}
              openEditAlbumModal={handleOpenEditAlbum}
              globalTheme={globalTheme}
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
              onDeleteAlbum={handleDeleteAlbum}
              onUpdatePlaylist={handleUpdatePlaylist}
              onDeletePlaylist={handleDeletePlaylist}
              onBack={() => setCurrentScreen('home')}
              globalTheme={globalTheme}
            />
          )}

          {currentScreen === 'stats' && <StatsScreen tracks={tracks} currentUser={currentUser} globalTheme={globalTheme} />}

          {currentScreen === 'mixes' && (
            <MixesScreen 
              tracks={musicTracks} 
              toggleLike={toggleLike} 
              onSelectArtist={handleSelectArtist} 
              onBack={() => setCurrentScreen('home')}
              globalTheme={globalTheme} 
            />
          )}

          {currentScreen === 'profile' && (
            <ProfileScreen
              currentUser={currentUser}
              playlists={playlists}
              onBack={() => {
                setViewingProfileUserId(null);
                setCurrentScreen('home');
              }}
              logout={logout}
              openAuthModal={() => setIsAuthOpen(true)}
              onSelectPlaylist={(pl) => { handleSelectPlaylistView(pl); }}
              onOpenChat={(target) => {
                handleOpenChat(target);
              }}
              onStartJamWithUser={(target) => {
                handleStartJam();
                handleOpenChat(target);
              }}
              onTogglePlaylistVisibility={handleTogglePlaylistVisibility}
              viewingUserId={viewingProfileUserId}
              onClearViewingUser={() => setViewingProfileUserId(null)}
              globalTheme={globalTheme}
            />
          )}
        </main>

        {/* Right Perforated Filmstrip Rail */}
        <aside className="hidden xl:flex w-8 flex-col filmstrip-stripes brutal-border border-y-0 border-r-0 shrink-0"></aside>

        {/* ── Listening Activity Panel (Docked on the Right Side) ── */}
        <ListeningActivityPanel
          isOpen={isActivityPanelOpen}
          onClose={() => {
            setIsActivityPanelOpen(false);
            try {
              localStorage.setItem('rivo_activity_panel_open', 'false');
              localStorage.setItem('liofy_activity_panel_open', 'false');
            } catch {}
          }}
          onSelectTrack={playTrack}
          openProfileScreen={() => setCurrentScreen('profile')}
          openChatModal={() => handleOpenChat(null)}
          currentUser={currentUser}
          globalTheme={globalTheme}
        />
      </div>

      {/* ── Now Playing Bar ── */}
      {currentTrack && (
        <MiniPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          togglePlay={togglePlay}
          playNext={playNextTrack}
          playPrev={playPrevTrack}
          isShuffle={isShuffle}
          toggleShuffle={toggleShuffle}
          isRepeat={isRepeat}
          toggleRepeat={() => setIsRepeat(p => !p)}
          toggleLike={toggleLike}
          likedTrackIds={likedTrackIds}
          openFullPlayer={() => setIsFullPlayerOpen(true)}
          openAddToPlaylist={() => setIsAddToPlaylistOpen(true)}
          volume={volume}
          setVolume={setVolume}
          currentTime={currentTime}
          duration={duration}
          seekTo={seekTo}
          jamSession={jamSession}
          openJamModal={() => setIsJamOpen(true)}
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
        onClose={() => setIsFullPlayerOpen(false)}
        currentTime={currentTime}
        duration={duration}
        seekTo={seekTo}
        volume={volume}
        setVolume={setVolume}
        isShuffle={isShuffle}
        toggleShuffle={toggleShuffle}
        isRepeat={isRepeat}
        queue={(() => {
          const isCurQ = isQuranContent(currentTrack);
          const rawQ = jamSession?.queue?.length ? jamSession.queue : (currentQueue?.length > 0 ? currentQueue : (isCurQ ? quranTracks : musicTracks));
          return rawQ.filter(t => isCurQ ? isQuranContent(t) : !isQuranContent(t));
        })()}
        onRemoveFromJamQueue={removeFromJamQueue}
        openAddToPlaylist={() => setIsAddToPlaylistOpen(true)}
        onPlayTrack={playTrack}
        onSelectArtist={(artist) => {
          setIsFullPlayerOpen(false);
          handleSelectArtist(artist);
        }}
        currentUser={currentUser}
        globalTheme={globalTheme}
      />

      <CreatePlaylistModal
        isOpen={isCreatePlaylistOpen}
        onClose={() => setIsCreatePlaylistOpen(false)}
        onCreatePlaylist={handleCreatePlaylist}
      />

      <AddToPlaylistModal
        isOpen={isAddToPlaylistOpen}
        onClose={() => setIsAddToPlaylistOpen(false)}
        track={currentTrack}
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
        onDelete={(albumId) => {
          setAlbums(prev => prev.filter(a => String(a.id || a._id) !== String(albumId)));
          if (selectedPlaylist && (String(selectedPlaylist.id || selectedPlaylist._id) === String(albumId) || selectedPlaylist.name === albumId)) {
            setSelectedPlaylist(null);
            setCurrentScreen('home');
          }
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
        onClose={() => setIsJamOpen(false)}
        jamSession={jamSession}
        onStartJam={handleStartJam}
        onJoinJam={handleJoinJam}
        onLeaveJam={handleLeaveJam}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        tracks={tracks}
        onAddToJamQueue={addToJamQueue}
        onRemoveFromJamQueue={removeFromJamQueue}
        onPlayTrack={playTrack}
        currentUser={currentUser}
        socket={socket}
        onKickMember={handleKickMember}
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
          showToast(`Imported "${newPl.name}" (${newPl.trackIds?.length || 0} songs)!`);
          syncFromServer();
        }}
      />

      <ImportSongModal
        isOpen={isImportSongOpen}
        onClose={() => setIsImportSongOpen(false)}
        onTrackImported={(newTrack) => {
          handleAddSong(newTrack);
          showToast(`Imported "${newTrack.title}" by ${newTrack.artist}!`);
        }}
      />

      <ChatModal
        isOpen={isChatOpen}
        onClose={() => {
          setIsChatOpen(false);
          setChatTargetUser(null);
        }}
        targetUser={chatTargetUser}
        currentUser={currentUser}
        socket={socket}
        onStartJamWithUser={async (target) => {
          return handleStartJam(false);
        }}
        onJoinJam={(code) => {
          handleJoinJam(code);
        }}
        onPlayTrack={(track) => {
          playTrack(track);
        }}
        globalTheme={globalTheme}
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
            onClick={() => setIsMobileMenuOpen(false)} 
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
                onClick={() => setIsMobileMenuOpen(false)}
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
                  onClick={() => { setIsAddSongOpen(true); setIsMobileMenuOpen(false); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border brutal-shadow-sm brutal-btn cursor-pointer font-black"
                >
                  <Plus size={17} strokeWidth={3} />
                  <span>Add Song / Link</span>
                </button>

                <button
                  onClick={() => { setIsJamOpen(true); setIsMobileMenuOpen(false); }}
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
                  onClick={() => { handleOpenChat(null); setIsMobileMenuOpen(false); }}
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
                    toggleActivityPanel();
                    setIsMobileMenuOpen(false);
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
              </div>

              {/* Navigation */}
              <div className="space-y-1 pt-2 border-t-2 border-dashed border-zinc-800">
                <div className="text-[10px] font-mono font-black uppercase tracking-wider text-zinc-500 mb-1 px-1">
                  Browse & Decks
                </div>

                <button
                  onClick={() => { setCurrentScreen('mixes'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg brutal-btn cursor-pointer ${
                    currentScreen === 'mixes' 
                      ? 'bg-[#17a398] text-[#0b1110] font-black brutal-border' 
                      : globalTheme === 'dark' ? 'text-zinc-300 hover:bg-zinc-800/80' : 'text-[#0b1110] hover:bg-[#ede5d3]'
                  }`}
                >
                  <Radio size={16} />
                  <span>Mix</span>
                </button>

                <button
                  onClick={() => { setCurrentScreen('stats'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg brutal-btn cursor-pointer ${
                    currentScreen === 'stats' 
                      ? 'bg-[#17a398] text-[#0b1110] font-black brutal-border' 
                      : globalTheme === 'dark' ? 'text-zinc-300 hover:bg-zinc-800/80' : 'text-[#0b1110] hover:bg-[#ede5d3]'
                  }`}
                >
                  <Disc size={16} />
                  <span>Stats & History</span>
                </button>

                {isUserAdmin(currentUser) && (
                  <button
                    onClick={() => { setCurrentScreen('admin'); setIsMobileMenuOpen(false); }}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#f59e0b]/20 hover:bg-[#f59e0b]/30 text-[#f59e0b] brutal-border border-[#f59e0b] cursor-pointer"
                  >
                    <span>Admin Dashboard</span>
                    <span className="text-[8px] font-mono font-black px-1.5 py-0.5 rounded bg-[#f59e0b] text-black">
                      ADMIN
                    </span>
                  </button>
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notification Banner ── */}
      {toastMessage && (
        <div 
          onClick={() => {
            if (typeof toastMessage === 'object' && toastMessage?.sender) {
              handleOpenChat(toastMessage.sender);
              setToastMessage(null);
            }
          }}
          className={`fixed left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl text-xs font-display font-black brutal-border-thick brutal-shadow-lg flex items-center gap-2.5 transition-all bg-[#fdfbf7] text-[#0b1110] ${
            typeof toastMessage === 'object' && toastMessage?.sender ? 'cursor-pointer pointer-events-auto hover:scale-105 active:scale-95' : 'pointer-events-none'
          }`}
          style={{
            bottom: currentTrack ? 'calc(var(--player-height) + 16px)' : '24px',
          }}
        >
          {typeof toastMessage === 'object' && toastMessage?.sender ? (
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
