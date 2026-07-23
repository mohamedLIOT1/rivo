import React, { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import MiniPlayer from './components/MiniPlayer';
import FullPlayerModal from './components/FullPlayerModal';
import CreatePlaylistModal from './components/CreatePlaylistModal';
import AddToPlaylistModal from './components/AddToPlaylistModal';
import SettingsModal from './components/SettingsModal';
import AddSongModal from './components/AddSongModal';
import EditSongModal from './components/EditSongModal';
import AuthModal from './components/AuthModal';

import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import LibraryScreen from './screens/LibraryScreen';
import ArtistScreen from './screens/ArtistScreen';
import StatsScreen from './screens/StatsScreen';
import PlaylistScreen from './screens/PlaylistScreen';
import PodcastsScreen from './screens/PodcastsScreen';
import ProfileScreen from './screens/ProfileScreen';

import { API_BASE_URL } from './config';
import { saveTrackOffline, removeTrackOffline } from './utils/offlineStorage';
import { UserProvider, useUser } from './context/UserContext';
import { AudioProvider, useAudioPlayer } from './context/AudioContext';

function AppContent() {
  const {
    currentUser, login, logout,
    tracks, setTracks,
    playlists, setPlaylists,
    likedTrackIds, toggleLike,
    syncFromServer,
  } = useUser();

  const audio = useAudioPlayer();
  const {
    currentTrack, setCurrentTrack, isPlaying, setIsPlaying, currentTime, duration,
    volume, setVolume, isShuffle, setIsShuffle, isRepeat, setIsRepeat,
    isOfflineMode, setIsOfflineMode,
    togglePlay, playTrack, playNextTrack, playPrevTrack, seekTo
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

  // ── Add song to global library ───────────────────────
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
    setTracks(prev => prev.filter(t => String(t.id || t._id) !== String(trackId)));
    if (currentTrack && String(currentTrack.id || currentTrack._id) === String(trackId)) {
      setIsPlaying(false);
      setCurrentTrack(null);
    }
    try {
      const token = localStorage.getItem('liofy_token');
      await fetch(`${API_BASE_URL}/api/tracks/${encodeURIComponent(trackId)}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    } catch {}
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
    setPlaylists(prev => prev.map(p => p.id === updatedPl.id ? updatedPl : p));
    if (selectedPlaylist?.id === updatedPl.id) setSelectedPlaylist(updatedPl);

    try {
      const token = localStorage.getItem('liofy_token');
      if (token) {
        await fetch(`${API_BASE_URL}/api/playlists/${updatedPl.id}/update`, {
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
    const target = playlists.find(p => p.id === playlistId);
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
    setPlaylists(prev => prev.map(pl => {
      if (pl.id !== playlistId) return pl;
      return { ...pl, trackIds: (pl.trackIds || []).filter(id => id !== trackId) };
    }));

    try {
      const token = localStorage.getItem('liofy_token');
      if (token) {
        await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/remove-track`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ trackId }),
        });
      }
    } catch {}
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

  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? '' : prev));
    }, 4000);
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
      showToast('تم إزالة الأغنية من التحميلات الأوفلاين');
    } else {
      showToast('جاري تحميل الأغنية لحفظها على مساحة التطبيق...');
      const result = await saveTrackOffline(track);
      if (result) {
        setTracks(prev => prev.map(t => String(t.id || t._id) === cleanId ? { ...t, ...result, downloaded: true } : t));
        if (currentTrack && String(currentTrack.id || currentTrack._id) === cleanId) {
          setCurrentTrack(prev => ({ ...prev, ...result, downloaded: true }));
        }
        showToast('تم تحميل الأغنية بنجاح على مساحة التطبيق للأوفلاين ✓');
      } else {
        showToast('تعذر تحميل الأغنية. يرجى التحقق من اتصال الإنترنت.');
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
        openSettings={() => setIsSettingsOpen(true)}
        openAddSongModal={() => setIsAddSongOpen(true)}
        openAuthModal={handleUserAvatarClick}
        currentUser={currentUser}
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
            playlist={playlists.find(p => p.id === selectedPlaylist.id) || selectedPlaylist}
            tracks={tracks}
            onSelectTrack={playTrack}
            toggleLike={toggleLike}
            toggleDownload={handleDownload}
            onBack={() => setCurrentScreen('library')}
            onAddTrackToPlaylist={handleAddTrackToPlaylist}
            onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
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
          toggleShuffle={() => setIsShuffle(p => !p)}
          isRepeat={isRepeat}
          toggleRepeat={() => setIsRepeat(p => !p)}
          toggleLike={toggleLike}
          likedTrackIds={likedTrackIds}
          openFullPlayer={() => setIsFullPlayerOpen(true)}
          openAddToPlaylist={() => setIsAddToPlaylistOpen(true)}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          setVolume={setVolume}
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
        toggleShuffle={() => setIsShuffle(p => !p)}
        isRepeat={isRepeat}
        toggleRepeat={() => setIsRepeat(p => !p)}
        queue={tracks}
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

      {/* ── Toast Notification Banner (No Native Alert Dialogs!) ── */}
      {toastMessage && (
        <div 
          className="fixed left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-full text-xs font-black shadow-2xl flex items-center gap-2 border border-white/20 transition-all pointer-events-none"
          style={{
            bottom: currentTrack ? 'calc(var(--player-height) + 16px)' : '24px',
            background: 'rgba(18, 18, 18, 0.95)',
            backdropFilter: 'blur(12px)',
            color: '#1DB954',
            boxShadow: '0 10px 30px rgba(0,0,0,0.9)'
          }}
        >
          <span className="w-2 h-2 rounded-full bg-[#1DB954] shrink-0" />
          <span>{toastMessage}</span>
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
