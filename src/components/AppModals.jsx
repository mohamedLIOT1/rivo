import React from 'react';
import { useUI } from '../context/UIContext';
import { useNavigation } from '../context/NavigationContext';
import { useJam } from '../context/JamContext';
import { isQuranContent, getQuranReciterName } from '../utils/quranUtils';

import FullPlayerModal from './FullPlayerModal';
import CreatePlaylistModal from './CreatePlaylistModal';
import AddToPlaylistModal from './AddToPlaylistModal';
import SettingsModal from './SettingsModal';
import AddSongModal from './AddSongModal';
import EditSongModal from './EditSongModal';
import EditAlbumModal from './EditAlbumModal';
import AuthModal from './AuthModal';
import JamRoomModal from './JamRoomModal';
import ImportPlaylistModal from './ImportPlaylistModal';
import ImportSongModal from './ImportSongModal';
import ChatModal from './ChatModal';
import ShortcutsModal from './ShortcutsModal';
import DesktopUpdateModal from './DesktopUpdateModal';

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
    showToast,
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
    currentTime,
    duration,
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
  };

  const handleCloseJam = () => {
    setIsJamOpen(false);
  };

  return (
    <>
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

      <CreatePlaylistModal
        isOpen={isCreatePlaylistOpen}
        onClose={() => setIsCreatePlaylistOpen(false)}
        onCreatePlaylist={handleCreatePlaylist}
        isQuran={currentScreen === 'quran' || libraryMode === 'quran'}
        allTracks={tracks}
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
          navigateTo('playlist');
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

      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <DesktopUpdateModal />
    </>
  );
}
