import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
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
import ChatModal from './components/ChatModal';
import ShortcutsModal from './components/ShortcutsModal';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import LibraryScreen from './screens/LibraryScreen';
import ArtistScreen from './screens/ArtistScreen';
import StatsScreen from './screens/StatsScreen';
import PlaylistScreen from './screens/PlaylistScreen';
import PodcastsScreen from './screens/PodcastsScreen';
import ProfileScreen from './screens/ProfileScreen';

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
    currentTime, duration,
    volume, setVolume, isShuffle, setIsShuffle, toggleShuffle, isRepeat, setIsRepeat,
    isOfflineMode, setIsOfflineMode,
    togglePlay, playTrack, playNextTrack, playPrevTrack, seekTo,
    setJamSync, syncRemotePlayState, addToJamQueue, removeFromJamQueue
  } = audio;

  // Screen Navigation
  const [currentScreen, setCurrentScreen]     = useState('home');
  const [selectedArtist, setSelectedArtist]   = useState(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);

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
  const [isChatOpen,          setIsChatOpen]          = useState(false);
  const [isShortcutsOpen,     setIsShortcutsOpen]     = useState(false);
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
      } catch {}
    }
  };

  const handleOpenEditSong = (track) => { setEditingTrack(track); setIsEditSongOpen(true); };

  const handleDeleteTrack = async (trackId) => {
    if (!trackId) return;
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

  const handleAddTrackToPlaylist = async (trackId, playlistId) => {
    setPlaylists(prev => prev.map(pl => {
      if (pl.id !== playlistId) return pl;
      const ids = pl.trackIds || [];
      if (ids.includes(trackId)) return pl;
      return { ...pl, trackIds: [...ids, trackId] };
    }));

    try {
      const token = localStorage.getItem('liofy_token');
      if (token) {
        await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/add-track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ trackId }),
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

  const handleSelectArtist = (artist) => { setSelectedArtist(artist); setCurrentScreen('artist'); };
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
              const notif = new Notification(`Liofy • Message from ${senderName}`, {
                body: preview,
                icon: msg.senderAvatar || '/favicon.ico',
                tag: `liofy-chat-${msg.sender}`
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
    <div className="flex text-white overflow-hidden select-none" style={{ height: '100dvh', background: '#000' }}>

      {/* ── Sidebar / Bottom Nav ── */}
      <Navigation
        currentScreen={currentScreen}
        setCurrentScreen={goToScreen}
        playlists={playlists}
        openCreatePlaylistModal={() => setIsCreatePlaylistOpen(true)}
        openImportPlaylistModal={() => setIsImportPlaylistOpen(true)}
        openJamModal={() => setIsJamOpen(true)}
        openSettings={() => setIsSettingsOpen(true)}
        openAddSongModal={() => setIsAddSongOpen(true)}
        openAuthModal={handleUserAvatarClick}
        currentUser={currentUser}
        openChatModal={() => handleOpenChat(null)}
        openShortcutsModal={() => setIsShortcutsOpen(true)}
        unreadChatCount={unreadChatCount}
      />

      {/* ── Main Content ── */}
      <main
        className="flex-1 flex flex-col overflow-hidden"
        style={{
          background: '#121212',
          paddingBottom: currentTrack ? 'var(--player-height)' : 0,
          paddingTop: 0,
        }}
      >
        {currentScreen === 'home' && (
          <HomeScreen
            tracks={tracks}
            playlists={playlists}
            onSelectTrack={playTrack}
            onSelectPlaylist={handleSelectPlaylistView}
            toggleLike={toggleLike}
            onSelectArtist={handleSelectArtist}
            openAddSongModal={() => setIsAddSongOpen(true)}
            openEditSongModal={handleOpenEditSong}
            onDeleteTrack={handleDeleteTrack}
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
          />
        )}

        {currentScreen === 'search' && (
          <SearchScreen
            tracks={tracks}
            onSelectTrack={playTrack}
            toggleLike={toggleLike}
            onOpenAddSongModal={() => setIsAddSongOpen(true)}
            onAddToLibrary={handleAddSong}
          />
        )}

        {currentScreen === 'library' && (
          <LibraryScreen
            playlists={playlists}
            tracks={tracks}
            onSelectPlaylist={handleSelectPlaylistView}
            onSelectTrack={playTrack}
            openCreatePlaylistModal={() => setIsCreatePlaylistOpen(true)}
            toggleLike={toggleLike}
          />
        )}

        {currentScreen === 'playlist' && selectedPlaylist && (
          <PlaylistScreen
            playlist={playlists.find(p => String(p.id) === String(selectedPlaylist.id)) || selectedPlaylist}
            tracks={tracks}
            currentUser={currentUser}
            onSelectTrack={playTrack}
            toggleLike={toggleLike}
            toggleDownload={handleDownload}
            onBack={() => setCurrentScreen('library')}
            onAddTrackToPlaylist={handleAddTrackToPlaylist}
            onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
            onDeleteTrack={handleDeleteTrack}
            onUpdatePlaylist={handleUpdatePlaylist}
            onDeletePlaylist={handleDeletePlaylist}
            onTogglePlaylistVisibility={handleTogglePlaylistVisibility}
          />
        )}

        {currentScreen === 'podcasts' && (
          <PodcastsScreen onPlayEpisode={handlePlayPodcastEpisode} />
        )}

        {currentScreen === 'artist' && selectedArtist && (
          <ArtistScreen
            artist={selectedArtist}
            tracks={tracks}
            onSelectTrack={playTrack}
            toggleLike={toggleLike}
          />
        )}

        {currentScreen === 'stats' && <StatsScreen tracks={tracks} currentUser={currentUser} />}

        {currentScreen === 'profile' && (
          <ProfileScreen
            currentUser={currentUser}
            playlists={playlists}
            onBack={() => setCurrentScreen('home')}
            logout={logout}
            onSelectPlaylist={(pl) => { handleSelectPlaylistView(pl); }}
            onOpenChat={(target) => {
              handleOpenChat(target);
            }}
            onStartJamWithUser={(target) => {
              handleStartJam();
              handleOpenChat(target);
            }}
            onTogglePlaylistVisibility={handleTogglePlaylistVisibility}
          />
        )}
      </main>

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
        queue={jamSession?.queue?.length ? jamSession.queue : tracks}
        jamSession={jamSession}
        onRemoveFromJamQueue={removeFromJamQueue}
        openAddToPlaylist={() => setIsAddToPlaylistOpen(true)}
        onPlayTrack={playTrack}
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
          className={`fixed left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-full text-xs font-black shadow-2xl flex items-center gap-3 border border-white/20 transition-all ${
            typeof toastMessage === 'object' && toastMessage?.sender ? 'cursor-pointer pointer-events-auto hover:scale-105 active:scale-95 text-white' : 'pointer-events-none'
          }`}
          style={{
            bottom: currentTrack ? 'calc(var(--player-height) + 16px)' : '24px',
            background: typeof toastMessage === 'object' && toastMessage?.sender ? 'rgba(20, 20, 28, 0.96)' : 'rgba(18, 18, 18, 0.95)',
            backdropFilter: 'blur(12px)',
            color: typeof toastMessage === 'object' && toastMessage?.sender ? '#fff' : '#1DB954',
            boxShadow: '0 10px 30px rgba(0,0,0,0.9)'
          }}
        >
          {typeof toastMessage === 'object' && toastMessage?.sender ? (
            <>
              {toastMessage.sender.avatar ? (
                <img src={toastMessage.sender.avatar} alt="" className="w-6 h-6 rounded-full object-cover border border-[#1DB954]/50 shrink-0" />
              ) : (
                <span className="w-2.5 h-2.5 rounded-full bg-[#1DB954] shrink-0 animate-pulse" />
              )}
              <div className="flex flex-col text-left">
                <span className="font-extrabold text-[#1DB954] text-[11px]">{toastMessage.title}</span>
                <span className="text-gray-300 font-medium text-[11px] max-w-[220px] truncate">{toastMessage.body}</span>
              </div>
              <span className="text-[10px] text-[#1DB954] font-bold ml-1 bg-white/10 px-2 py-0.5 rounded-full hover:bg-white/20">Open</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-[#1DB954] shrink-0" />
              <span>{typeof toastMessage === 'string' ? toastMessage : toastMessage?.text || ''}</span>
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
