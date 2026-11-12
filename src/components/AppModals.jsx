import React, { useMemo, Suspense, lazy } from 'react';
import { useUI } from '../context/UIContext';
import { useNavigation } from '../context/NavigationContext';
import { useJam } from '../context/JamContext';
import { isQuranContent, getQuranReciterName } from '../utils/quranUtils';
import { API_BASE_URL } from '../config';

import DesktopUpdateModal from './DesktopUpdateModal';
const FullPlayerModal = lazy(() => import('./FullPlayerModal'));
const CreatePlaylistModal = lazy(() => import('./CreatePlaylistModal'));
const AddToPlaylistModal = lazy(() => import('./AddToPlaylistModal'));
const SettingsModal = lazy(() => import('./SettingsModal'));
const AddSongModal = lazy(() => import('./AddSongModal'));
const EditSongModal = lazy(() => import('./EditSongModal'));
const EditAlbumModal = lazy(() => import('./EditAlbumModal'));
const AuthModal = lazy(() => import('./AuthModal'));
const JamRoomModal = lazy(() => import('./JamRoomModal'));
const ImportPlaylistModal = lazy(() => import('./ImportPlaylistModal'));
const ImportSongModal = lazy(() => import('./ImportSongModal'));
const ChatModal = lazy(() => import('./ChatModal'));
const ShortcutsModal = lazy(() => import('./ShortcutsModal'));
const SleepTimerModal = lazy(() => import('./SleepTimerModal'));

export default function AppModals({
  audio,
  currentUser,
  tracks,
  setTracks,
  playlists,
  setPlaylists,
  albums,
  setAlbums,
  likedTrackIds,
  toggleLike,
  syncFromServer,
  audioQuality,
  setAudioQuality,
  crossfade,
  setCrossfade,
  handleDownload,
  handleDeleteTrack,
  handleRemoveTrackFromPlaylist,
  selectedPlaylist,
  setSelectedPlaylist,
  handleCreatePlaylist,
  handleAddTrackToPlaylist,
  handleUpdateSong,
  handleDeleteSong,
  handleDeleteAlbum,
  handleAddSong,
  musicPlaylists,
  quranPlaylists,
  musicTracks,
  quranTracks,
}) {
  const {
    globalTheme,
    isFullPlayerOpen,
    setIsFullPlayerOpen,
    closeFullPlayer,
    isCreatePlaylistOpen,
    setIsCreatePlaylistOpen,
    isAddToPlaylistOpen,
    setIsAddToPlaylistOpen,
    addToPlaylistTarget,
    setAddToPlaylistTarget,
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
    isEditAlbumOpen,
    setIsEditAlbumOpen,
    editingAlbum,
    isAuthOpen,
    setIsAuthOpen,
    isJamOpen,
    setIsJamOpen,
    isChatOpen,
    setIsChatOpen,
    chatTargetUser,
    setChatTargetUser,
    isShortcutsOpen,
    setIsShortcutsOpen,
    isSleepTimerOpen,
    setIsSleepTimerOpen,
    showToast,
    setUnreadChatCount,
  } = useUI();

  const {
    currentScreen,
    libraryMode,
    setLibraryMode,
    navigateTo,
    handleSelectArtist,
  } = useNavigation();

  const {
    socket,
    jamSession,
    startJam,
    startJamWithTargetUser,
    joinJam,
    leaveJam,
    transferHost,
    kickMember,
  } = useJam();

  const {
    currentTrack,
    isPlaying,
    seekTo,
    volume,
    setVolume,
    isShuffle,
    toggleShuffle,
    isRepeat,
    repeatMode,
    toggleRepeat,
    togglePlay,
    playNextTrack,
    playPrevTrack,
    currentQueue,
    currentQueueIndex,
    playTrack,
    addToQueue,
    removeFromQueue,
    reorderQueue,
    clearQueue,
    isOfflineMode,
    setIsOfflineMode,
    addToJamQueue,
    removeFromJamQueue,
    reorderJamQueue,
  } = audio;

  const handleCloseChat = () => {
    setIsChatOpen(false);
    setChatTargetUser(null);
    try {
      const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
      if (token && setUnreadChatCount) {
        fetch(`${API_BASE_URL}/api/chat/unread-count`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(data => {
            if (data && typeof data.count === 'number') {
              setUnreadChatCount(data.count);
            }
          })
          .catch(() => {});
      }
    } catch {}
  };

  const handleCloseJam = () => {
    setIsJamOpen(false);
  };

  const modalQueue = useMemo(() => {
    const isCurQ = isQuranContent(currentTrack);
    if (!jamSession && currentQueue?.length > 0) {
      const allMatch = currentQueue.every(t => isCurQ ? isQuranContent(t) : !isQuranContent(t));
      if (allMatch) return currentQueue;
    }
    const rawQ = jamSession
      ? (jamSession.queue || [])
      : (currentQueue?.length > 0 ? currentQueue : (isCurQ ? quranTracks : musicTracks).slice(0, 60));
    return rawQ.filter(t => isCurQ ? isQuranContent(t) : !isQuranContent(t));
  }, [currentTrack, jamSession, currentQueue, quranTracks, musicTracks]);

  return (
    <Suspense fallback={null}>
      {isFullPlayerOpen && (
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
          onClose={closeFullPlayer}
          seekTo={seekTo}
          volume={volume}
          setVolume={setVolume}
          isShuffle={isShuffle}
          toggleShuffle={toggleShuffle}
          isRepeat={isRepeat}
          repeatMode={repeatMode}
          toggleRepeat={toggleRepeat}
          queue={modalQueue}
          jamSession={jamSession}
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
          onOpenEditSong={(track) => {
            setEditingTrack(track);
            setIsEditSongOpen(true);
          }}
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
      )}

      {isCreatePlaylistOpen && (
        <CreatePlaylistModal
          isOpen={isCreatePlaylistOpen}
          onClose={() => setIsCreatePlaylistOpen(false)}
          onCreatePlaylist={handleCreatePlaylist}
          isQuran={currentScreen === 'quran' || libraryMode === 'quran'}
          allTracks={tracks}
        />
      )}

      {isAddToPlaylistOpen && (
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
      )}

      {isEditSongOpen && (
        <EditSongModal
          isOpen={isEditSongOpen}
          onClose={() => setIsEditSongOpen(false)}
          track={editingTrack}
          onUpdateSong={handleUpdateSong}
          onDeleteSong={handleDeleteSong}
          globalTheme={globalTheme}
        />
      )}

      {isEditAlbumOpen && (
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
      )}

      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          isOfflineMode={isOfflineMode}
          setIsOfflineMode={setIsOfflineMode}
          globalTheme={globalTheme}
        />
      )}

      {isAddSongOpen && (
        <AddSongModal
          isOpen={isAddSongOpen}
          onClose={() => setIsAddSongOpen(false)}
          onAddSong={handleAddSong}
        />
      )}

      {isAuthOpen && (
        <AuthModal
          isOpen={isAuthOpen}
          onClose={() => setIsAuthOpen(false)}
        />
      )}

      {isJamOpen && (
        <JamRoomModal
          isOpen={isJamOpen}
          onClose={handleCloseJam}
          jamSession={jamSession}
          onStartJam={startJam}
          onJoinJam={joinJam}
          onLeaveJam={leaveJam}
          currentTrack={jamSession?.currentTrack || currentTrack}
          isPlaying={jamSession ? Boolean(jamSession.isPlaying) : isPlaying}
          tracks={tracks}
          onAddToJamQueue={addToJamQueue}
          onRemoveFromJamQueue={removeFromJamQueue}
          onReorderJamQueue={reorderJamQueue}
          onTransferHost={transferHost}
          onPlayTrack={playTrack}
          currentUser={currentUser}
          socket={socket}
          onKickMember={kickMember}
          onViewProfile={(uid) => navigateTo('profile', { userId: uid })}
          globalTheme={globalTheme}
        />
      )}

      {isImportPlaylistOpen && (
        <ImportPlaylistModal
          isOpen={isImportPlaylistOpen}
          onClose={() => setIsImportPlaylistOpen(false)}
          isQuran={currentScreen === 'quran' || libraryMode === 'quran'}
          globalTheme={globalTheme}
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
            navigateTo('playlist');
            showToast(`Imported "${newPl.name}" (${newPl.trackIds?.length || 0} ${importedIsQuran ? 'surahs' : 'songs'})!`);
            syncFromServer();
          }}
        />
      )}

      {isImportSongOpen && (
        <ImportSongModal
          isOpen={isImportSongOpen}
          onClose={() => setIsImportSongOpen(false)}
          isQuran={currentScreen === 'quran' || libraryMode === 'quran'}
          globalTheme={globalTheme}
          onTrackImported={(newTrack) => {
            handleAddSong(newTrack);
            showToast(`Imported "${newTrack.title}" by ${newTrack.artist}!`);
          }}
        />
      )}

      {isChatOpen && (
        <ChatModal
          isOpen={isChatOpen}
          onClose={handleCloseChat}
          targetUser={chatTargetUser}
          currentUser={currentUser}
          socket={socket}
          onStartJamWithUser={startJamWithTargetUser}
          onJoinJam={(code) => {
            joinJam(code);
          }}
          onPlayTrack={(track) => {
            playTrack(track);
          }}
          globalTheme={globalTheme}
          onViewProfile={(user) => {
            handleCloseChat();
            const uId = user?.id || user?._id || (typeof user === 'string' ? user : null);
            if (uId) {
              navigateTo('profile', { userId: uId });
            } else {
              navigateTo('profile');
            }
          }}
        />
      )}

      {isShortcutsOpen && (
        <ShortcutsModal
          isOpen={isShortcutsOpen}
          onClose={() => setIsShortcutsOpen(false)}
        />
      )}

      <DesktopUpdateModal />

      {isSleepTimerOpen && (
        <SleepTimerModal
          isOpen={isSleepTimerOpen}
          onClose={() => setIsSleepTimerOpen(false)}
        />
      )}
    </Suspense>
  );
}
