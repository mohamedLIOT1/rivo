import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Search as SearchIcon, X, Plus, Radio, MessageSquare, ChevronDown, Users, Sun, Moon } from 'lucide-react';
import Navigation from './components/Navigation';
import MiniPlayer from './components/MiniPlayer';
import FullPlayerModal from './components/FullPlayerModal';
import CreatePlaylistModal from './components/CreatePlaylistModal';
import AddToPlaylistModal from './components/AddToPlaylistModal';
import SettingsModal from './components/SettingsModal';
import AddSongModal from './components/AddSongModal';
import EditSongModal from './components/EditSongModal';
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
import AdminScreen from './screens/AdminScreen';
import { isUserAdmin } from './utils/adminUtils';

import { API_BASE_URL } from './config';
import { saveTrackOffline, removeTrackOffline, getOfflineTrackAudioUrl } from './utils/offlineStorage';
import { resumeAudioContext } from './utils/audioEngine';
import { UserProvider, useUser } from './context/UserContext';
import { AudioProvider, useAudioPlayer } from './context/AudioContext';

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
  const [viewingProfileUserId, setViewingProfileUserId] = useState(null);
  const [albums, setAlbums]                   = useState([]);

  // Modals
  const [isFullPlayerOpen,    setIsFullPlayerOpen]    = useState(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
  const [isSettingsOpen,      setIsSettingsOpen]      = useState(false);
  const [isAddSongOpen,       setIsAddSongOpen]       = useState(false);
  const [isEditSongOpen,      setIsEditSongOpen]      = useState(false);
  const [editingTrack,        setEditingTrack]        = useState(null);
  const [isAuthOpen,          setIsAuthOpen]          = useState(false);
  const [isJamOpen,           setIsJamOpen]           = useState(false);
  const [jamSession,          setJamSession]          = useState(null);
  const [isImportPlaylistOpen, setIsImportPlaylistOpen] = useState(false);
  const [isImportSongOpen, setIsImportSongOpen] = useState(false);
  const [isChatOpen,          setIsChatOpen]          = useState(false);
  const [isShortcutsOpen,     setIsShortcutsOpen]     = useState(false);
  const [isActivityPanelOpen, setIsActivityPanelOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('liofy_activity_panel_open');
      if (saved !== null) return JSON.parse(saved);
      return typeof window !== 'undefined' && window.innerWidth >= 1200;
    } catch {
      return false;
    }
  });

  const toggleActivityPanel = () => {
    setIsActivityPanelOpen(prev => {
      const next = !prev;
      try { localStorage.setItem('liofy_activity_panel_open', JSON.stringify(next)); } catch {}
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
        const token = localStorage.getItem('liofy_token');
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
    setGlobalTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
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
    setTracks(prev => {
      const exists = prev.some(x => String(x.id) === String(newSong.id));
      if (exists) return prev;
      return [{ ...newSong, liked: false }, ...prev];
    });
    playTrack(newSong);

    // Save to server (if not already done in AddSongModal)
    if (newSong.source === 'YouTube' || newSong.source === 'SoundCloud') {
      try {
        const token = localStorage.getItem('liofy_token');
        await fetch(`${API_BASE_URL}/api/tracks/add`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(newSong),
        });
        syncFromServer();
        fetchAlbums();
      } catch {}
    } else {
      fetchAlbums();
    }
  };

  const handleOpenEditSong = (track) => { setEditingTrack(track); setIsEditSongOpen(true); };

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

  const handleUpdateSong = (updatedTrack) => {
    setTracks(prev => prev.map(t => (t.id === updatedTrack.id ? updatedTrack : t)));
    if (currentTrack?.id === updatedTrack.id) setCurrentTrack(updatedTrack);
  };

  const handleDeleteSong = (trackId) => {
    handleDeleteTrack(trackId);
  };

  const handleCreatePlaylist = async (name, description, cover = '', isPublic = true) => {
    const newPl = {
      id: `pl-${Date.now()}`,
      name,
      description: description || '',
      cover: cover || '',
      isPublic: isPublic !== false,
      trackIds: [],
    };
    setPlaylists(prev => [...prev, newPl]);
    setSelectedPlaylist(newPl);
    setCurrentScreen('playlist');

    // Sync to server
    try {
      const token = localStorage.getItem('liofy_token');
      if (token) {
        await fetch(`${API_BASE_URL}/api/playlists/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name, description, cover, isPublic }),
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
      const token = localStorage.getItem('liofy_token');
      if (token) {
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
      const token = localStorage.getItem('liofy_token');
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
      const token = localStorage.getItem('liofy_token');
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
  const handleSelectPlaylistView = (pl) => { setSelectedPlaylist(pl); setCurrentScreen('playlist'); };

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

  const handleStartJam = () => {
    resumeAudioContext();
    const code = `JAM-${Math.floor(1000 + Math.random() * 9000)}`;
    const userPayload = currentUser 
      ? { id: currentUser.id || currentUser._id, name: currentUser.name, avatar: currentUser.avatar }
      : { id: `user-${Math.floor(1000 + Math.random() * 9000)}`, name: 'Guest Listener', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop' };

    if (socket) {
      socket.emit('jam:join_room', {
        roomCode: code,
        user: userPayload
      });
      setIsJamOpen(true);
      showToast(`Jam Session created: ${code}`);
    } else {
      setIsJamOpen(true);
    }
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
      const pl = playlists.find(p => p.id === plId);
      if (pl) handleSelectPlaylistView(pl);
    } else {
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
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Add Song Button */}
          <button 
            onClick={() => setIsAddSongOpen(true)}
            className={`font-display font-bold text-xs p-1.5 sm:px-3 sm:py-1.5 rounded-lg brutal-border brutal-shadow-sm brutal-btn flex items-center gap-1.5 cursor-pointer shrink-0 ${
              globalTheme === 'dark' 
                ? 'bg-[#141d1b] hover:bg-[#182320] border-zinc-700 text-white' 
                : 'bg-[#fdfbf7] hover:bg-white border-black text-[#0b1110]'
            }`}
            title="Add Song"
          >
            <Plus size={15} className="text-[#dc2626]" strokeWidth={2.5} />
            <span className="hidden sm:inline">Add Song</span>
          </button>

          {/* Jam Session Button */}
          <button 
            onClick={() => setIsJamOpen(true)}
            className="bg-[#f59e0b] text-[#0b1110] font-display font-black text-xs p-1.5 sm:px-3 sm:py-1.5 rounded-lg brutal-border brutal-shadow-sm brutal-btn flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Jam Session"
          >
            <Radio size={15} className="animate-pulse" strokeWidth={2.5} />
            <span className="hidden sm:inline">Jam</span>
          </button>

          {/* Messages Button */}
          <button 
            onClick={() => handleOpenChat(null)}
            className="relative bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-display font-bold text-xs p-1.5 sm:px-3 sm:py-1.5 rounded-lg brutal-border brutal-shadow-sm brutal-btn flex items-center gap-1.5 cursor-pointer shrink-0"
            title="Messages"
          >
            <MessageSquare size={15} strokeWidth={2.2} />
            <span className="hidden sm:inline">Messages</span>
            {unreadChatCount > 0 && (
              <span className="bg-[#dc2626] text-white text-[9px] font-mono px-1 rounded-full font-bold brutal-border animate-pulse">
                {unreadChatCount}
              </span>
            )}
          </button>

          {/* Activity / Friends Radar Button (Top Header) */}
          <button 
            onClick={() => {
              const nextState = !isActivityPanelOpen;
              setIsActivityPanelOpen(nextState);
              try { localStorage.setItem('liofy_activity_panel_open', String(nextState)); } catch {}
            }}
            className={`relative ${
              isActivityPanelOpen 
                ? 'bg-[#17a398] text-[#0b1110]' 
                : (globalTheme === 'dark' 
                    ? 'bg-[#141d1b] hover:bg-[#182320] border-zinc-700 text-white' 
                    : 'bg-[#fdfbf7] hover:bg-[#ede5d3] border-black text-[#0b1110]')
            } font-display font-bold text-xs p-1.5 sm:px-3 sm:py-1.5 rounded-lg brutal-border brutal-shadow-sm brutal-btn flex items-center gap-1.5 cursor-pointer shrink-0`}
            title="Friend Activity Radar"
          >
            <Users size={15} strokeWidth={2.5} />
            <span className="hidden sm:inline">Activity</span>
            {isActivityPanelOpen && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#0b1110]" />
            )}
          </button>

          {/* Global Dark / Light Mode Switcher */}
          <button 
            onClick={toggleGlobalTheme}
            className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 flex items-center justify-center cursor-pointer transition shrink-0"
            title={globalTheme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {globalTheme === 'dark' ? <Sun size={16} strokeWidth={2.5} /> : <Moon size={16} strokeWidth={2.5} />}
          </button>

          {/* User Profile Badge */}
          <div 
            onClick={handleUserAvatarClick}
            className="flex items-center gap-2 pl-2 border-l border-zinc-700 ml-1 cursor-pointer group"
          >
            <div className="w-8 h-8 rounded-lg bg-[#17a398] brutal-border flex items-center justify-center font-display font-black text-xs text-[#0b1110] brutal-shadow-sm overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
              {currentUser?.avatar ? (
                <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                currentUser?.name?.[0] || 'R'
              )}
            </div>
            <div className="hidden sm:flex flex-col justify-center text-left">
              <span className="text-xs font-display font-bold leading-tight text-white truncate max-w-[100px] group-hover:text-[#17a398] transition-colors">
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
              tracks={tracks}
              playlists={playlists}
              albums={albums}
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
              tracks={tracks}
              albums={albums}
              initialQuery={topSearchQuery}
              onSelectTrack={playTrack}
              onSelectPlaylist={handleSelectPlaylistView}
              onSelectArtist={handleSelectArtist}
              toggleLike={toggleLike}
              onOpenAddSongModal={() => setIsAddSongOpen(true)}
              onAddToLibrary={handleAddSong}
              onDeleteTrack={isUserAdmin(currentUser) ? handleDeleteTrack : undefined}
              onViewProfile={(userId) => {
                setViewingProfileUserId(userId);
                setCurrentScreen('profile');
              }}
              globalTheme={globalTheme}
            />
          )}

          {currentScreen === 'library' && (
            <LibraryScreen
              playlists={playlists}
              albums={albums}
              tracks={tracks}
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

          {currentScreen === 'playlist' && selectedPlaylist && (
            <PlaylistScreen
              playlist={playlists.find(p => String(p.id) === String(selectedPlaylist.id)) || albums.find(a => String(a.id) === String(selectedPlaylist.id)) || selectedPlaylist}
              tracks={tracks}
              currentUser={currentUser}
              onSelectTrack={playTrack}
              onSelectArtist={handleSelectArtist}
              toggleLike={toggleLike}
              toggleDownload={handleDownload}
              onBack={() => setCurrentScreen('library')}
              onAddTrackToPlaylist={handleAddTrackToPlaylist}
              onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
              onDeleteTrack={isUserAdmin(currentUser) ? handleDeleteTrack : undefined}
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
              globalTheme={globalTheme}
            />
          )}

          {currentScreen === 'admin' && (
            <AdminScreen
              currentUser={currentUser}
              tracks={tracks}
              onDeleteTrack={handleDeleteTrack}
              onPlayTrack={playTrack}
              onBack={() => setCurrentScreen('home')}
              globalTheme={globalTheme}
            />
          )}

          {currentScreen === 'stats' && <StatsScreen tracks={tracks} currentUser={currentUser} globalTheme={globalTheme} />}

          {currentScreen === 'mixes' && (
            <MixesScreen tracks={tracks} globalTheme={globalTheme} />
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
            try { localStorage.setItem('liofy_activity_panel_open', 'false'); } catch {}
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
        toggleRepeat={() => setIsRepeat(p => !p)}
        queue={jamSession?.queue?.length ? jamSession.queue : (currentQueue?.length > 0 ? currentQueue : (tracks?.length ? [currentTrack].filter(Boolean) : []))}
        jamSession={jamSession}
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
        playlists={playlists}
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
        onPlaylistImported={(newPl, newTracks) => {
          if (newTracks && newTracks.length > 0) {
            setTracks(prev => {
              const existingIds = new Set(prev.map(t => String(t.id || t._id)));
              const uniqueNew = newTracks.filter(t => !existingIds.has(String(t.id || t._id)));
              return [...uniqueNew, ...prev];
            });
          }
          setPlaylists(prev => [newPl, ...prev.filter(p => p.id !== newPl.id)]);
          setSelectedPlaylist(newPl);
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
        onStartJamWithUser={() => {
          handleStartJam();
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
