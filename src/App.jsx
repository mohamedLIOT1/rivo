import React, { useState, useEffect, useMemo, useCallback } from 'react';

import Navigation from './components/Navigation';
import MiniPlayer from './components/MiniPlayer';
import ListeningActivityPanel from './components/ListeningActivityPanel';
import AppHeader from './components/AppHeader';
import ScreenRouter from './components/ScreenRouter';
import AppModals from './components/AppModals';
import MobileDrawer from './components/MobileDrawer';
import Toast from './components/Toast';

import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { isUserAdmin } from './utils/adminUtils';
import { isQuranContent, getQuranReciterName } from './utils/quranUtils';
import { saveTrackOffline, removeTrackOffline, getOfflineTrackAudioUrl } from './utils/offlineStorage';
import { dataService } from './services/dataService';

import { UserProvider, useUser } from './context/UserContext';
import { AudioProvider, useAudioPlayer } from './context/AudioContext';
import { DownloadProvider } from './context/DownloadContext';
import { UIProvider, useUI } from './context/UIContext';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import { JamProvider, useJam } from './context/JamContext';

function MainAppShell({ albums: propAlbums, setAlbums: propSetAlbums }) {
  const {
    currentUser, logout,
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
    currentTime, duration,
    volume, setVolume,
    isShuffle, setIsShuffle, toggleShuffle,
    isRepeat, setIsRepeat, repeatMode, toggleRepeat,
    togglePlay, playTrack, playNextTrack, playPrevTrack, seekTo,
  } = audio;

  const {
    globalTheme,
    isActivityPanelOpen,
    toggleActivityPanel,
    closeActivityPanel,
    openFullPlayer,
    openAddToPlaylist,
    setIsAuthOpen,
    setIsSettingsOpen,
    setIsAddSongOpen,
    setIsCreatePlaylistOpen,
    setIsImportPlaylistOpen,
    setIsImportSongOpen,
    setIsShortcutsOpen,
    setIsJamOpen,
    setIsChatOpen,
    unreadChatCount,
    showToast,
  } = useUI();

  const {
    currentScreen,
    selectedPlaylist,
    setSelectedPlaylist,
    libraryMode,
    goToScreen,
    navigateTo,
    handleSelectPlaylistView,
  } = useNavigation();

  const {
    socket,
    jamSession,
    startJam,
    startJamWithTargetUser,
    joinJam,
    leaveJam,
  } = useJam();

  const [localAlbums, setLocalAlbums] = useState([]);
  const albums = propAlbums || localAlbums;
  const setAlbums = propSetAlbums || setLocalAlbums;
  const [audioQuality, setAudioQuality] = useState('320');
  const [crossfade, setCrossfade] = useState(4);

  // Clean Native Splash on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && typeof window.removeSplash === 'function') {
      window.removeSplash();
    }
  }, []);

  // Fetch albums on startup
  const fetchAlbums = useCallback(async () => {
    try {
      const alb = await dataService.fetchAlbums();
      setAlbums(alb);
    } catch {}
  }, []);

  useEffect(() => {
    fetchAlbums();
  }, [fetchAlbums]);

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

  const musicTracks = useMemo(() => tracks.filter(track => !isQuranContent(track)), [tracks]);
  const quranTracks = useMemo(() => tracks.filter(track => isQuranContent(track)), [tracks]);
  const musicPlaylists = useMemo(() => playlists.filter(playlist => !isQuranContent(playlist)), [playlists]);
  const quranPlaylists = useMemo(() => playlists.filter(playlist => isQuranContent(playlist)), [playlists]);
  const musicAlbums = useMemo(() => albums.filter(album => !isQuranContent(album)), [albums]);

  // ── Data Mutations ───────────────────────────────────────────────────
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
        await dataService.addTrack(songToAdd);
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

    if (deleteTracks && affectedTracks.size > 0) {
      setTracks(prev => prev.filter(t => !affectedTracks.has(String(t.id || t._id))));
      setPlaylists(prev => prev.map(pl => ({
        ...pl,
        trackIds: (pl.trackIds || []).filter(id => !affectedTracks.has(String(id)))
      })));
    } else if (affectedTracks.size > 0) {
      setTracks(prev => prev.map(t => affectedTracks.has(String(t.id || t._id)) ? { ...t, album: '' } : t));
    }

    if (selectedPlaylist && (
      String(selectedPlaylist.id || selectedPlaylist._id) === cleanId || 
      selectedPlaylist.name === cleanId ||
      (albumName && selectedPlaylist.name?.toLowerCase().trim() === albumName.toLowerCase().trim())
    )) {
      setSelectedPlaylist(null);
      goToScreen('home');
    }

    try {
      await dataService.deleteAlbum(cleanId, deleteTracks);
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
      await dataService.updateTrack(trackId, updatedTrack);
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
    navigateTo('playlist');

    try {
      await dataService.createPlaylist(name, description, cover, isPublic, isQ);
    } catch {}
  };

  const handleUpdatePlaylist = async (updatedPl) => {
    const plId = String(updatedPl.id || updatedPl._id);
    setPlaylists(prev => prev.map(p => String(p.id || p._id) === plId ? updatedPl : p));
    if (selectedPlaylist && String(selectedPlaylist.id || selectedPlaylist._id) === plId) {
      setSelectedPlaylist(updatedPl);
    }
    try {
      await dataService.updatePlaylist(plId, updatedPl);
    } catch {}
  };

  const handleDeletePlaylist = async (playlistId) => {
    if (!playlistId) return;
    const cleanId = String(playlistId);
    setPlaylists(prev => prev.filter(p => String(p.id) !== cleanId && String(p._id) !== cleanId));
    if (selectedPlaylist && (String(selectedPlaylist.id) === cleanId || String(selectedPlaylist._id) === cleanId)) {
      setSelectedPlaylist(null);
      goToScreen('library');
    }
    try {
      if (deletePlaylist) {
        await deletePlaylist(cleanId);
      } else {
        await dataService.deletePlaylist(cleanId);
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
      await dataService.addTrackToPlaylist(playlistId, cleanTrackId, allowDuplicate);
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
      await dataService.togglePlaylistVisibility(cleanId, isPublic);
      showToast(isPublic ? 'Playlist made Public' : 'Playlist made Private');
    } catch {}
  };

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
            openJamModal={() => setIsJamOpen(true)}
            openSettings={() => setIsSettingsOpen(true)}
            openAddSongModal={() => setIsAddSongOpen(true)}
            openAuthModal={handleUserAvatarClick}
            currentUser={currentUser}
            openChatModal={() => setIsChatOpen(true)}
            openShortcutsModal={() => setIsShortcutsOpen(true)}
            unreadChatCount={unreadChatCount}
            isActivityPanelOpen={isActivityPanelOpen}
            toggleActivityPanel={toggleActivityPanel}
            globalTheme={globalTheme}
            likedTrackIds={likedTrackIds}
            selectedPlaylist={selectedPlaylist}
            onSelectLikedSongs={() => goToScreen('liked')}
            onSelectPlaylist={handleSelectPlaylistView}
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
              musicTracks={musicTracks}
              quranTracks={quranTracks}
              tracks={tracks}
              musicPlaylists={musicPlaylists}
              quranPlaylists={quranPlaylists}
              playlists={playlists}
              musicAlbums={musicAlbums}
              albums={albums}
              playTrack={playTrack}
              toggleLike={toggleLike}
              handleDownload={handleDownload}
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
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              currentUser={currentUser}
              logout={logout}
              likedTrackIds={likedTrackIds}
            />
          </main>

          {/* Listening Activity Right Panel */}
          <ListeningActivityPanel
            isOpen={isActivityPanelOpen}
            onClose={closeActivityPanel}
            currentUser={currentUser}
            socket={socket}
            onPlayTrack={playTrack}
            onStartJamWithUser={startJamWithTargetUser}
            onOpenChat={() => setIsChatOpen(true)}
            onJoinJam={joinJam}
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
          togglePlay={togglePlay}
          onTogglePlay={togglePlay}
          playNext={playNextTrack}
          onNext={playNextTrack}
          playPrev={playPrevTrack}
          onPrev={playPrevTrack}
          liked={Boolean(currentTrack && likedTrackIds?.some(id => String(id) === String(currentTrack.id || currentTrack._id)))}
          toggleLike={toggleLike}
          toggleDownload={handleDownload}
          openFullPlayer={openFullPlayer}
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
          onOpenJamModal={() => setIsJamOpen(true)}
          jamSession={jamSession}
          onLeaveJam={leaveJam}
          onJoinJam={joinJam}
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
          onOpenJam={() => setIsJamOpen(true)}
          onOpenChat={() => setIsChatOpen(true)}
          onOpenAddSong={() => setIsAddSongOpen(true)}
        />

        {/* Toast Notifications */}
        <Toast
          currentTrack={currentTrack}
          onJoinJam={joinJam}
          onOpenChat={() => setIsChatOpen(true)}
        />
      </div>
    </DownloadProvider>
  );
}

export default function App() {
  const { tracks, setTracks, likedTrackIds, playlists } = useUser();
  const [albums, setAlbums] = useState([]);

  useEffect(() => {
    dataService.fetchAlbums().then(alb => setAlbums(alb || [])).catch(() => {});
  }, []);

  return (
    <UIProvider>
      <AudioProvider tracks={tracks} setTracks={setTracks}>
        <JamProvider>
          <NavigationProvider likedTrackIds={likedTrackIds} playlists={playlists} albums={albums}>
            <MainAppShell albums={albums} setAlbums={setAlbums} />
          </NavigationProvider>
        </JamProvider>
      </AudioProvider>
    </UIProvider>
  );
}
