import React from 'react';
import { isUserAdmin } from '../utils/adminUtils';
import { isQuranContent } from '../utils/quranUtils';

import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import LibraryScreen from '../screens/LibraryScreen';
import ArtistScreen from '../screens/ArtistScreen';
import StatsScreen from '../screens/StatsScreen';
import PlaylistScreen from '../screens/PlaylistScreen';
import ProfileScreen from '../screens/ProfileScreen';
import QuranScreen from '../screens/QuranScreen';
import AdminScreen from '../screens/AdminScreen';
import DownloadScreen from '../screens/DownloadScreen';

export default function ScreenRouter({
  currentScreen,
  musicTracks,
  quranTracks,
  tracks,
  musicPlaylists,
  quranPlaylists,
  playlists,
  musicAlbums,
  albums,
  selectedPlaylist,
  selectedArtist,
  viewingProfileUserId,
  setViewingProfileUserId,
  topSearchQuery,
  playTrack,
  handleSelectPlaylistView,
  handleSelectArtist,
  toggleLike,
  handleDownload,
  handleNavigateBack,
  goToScreen,
  navigateTo,
  handleOpenEditSong,
  handleOpenEditAlbum,
  handleOpenAddToPlaylist,
  handleDeleteTrack,
  handleDeleteAlbum,
  handleCreateAlbum,
  handleAddSong,
  handleCreatePlaylist,
  handleDeletePlaylist,
  handleUpdatePlaylist,
  handleAddTrackToPlaylist,
  handleRemoveTrackFromPlaylist,
  handleTogglePlaylistVisibility,
  savePublicPlaylist,
  unsavePublicPlaylist,
  handleStartJamWithTargetUser,
  handleOpenJam,
  handleOpenChat,
  jamSession,
  unreadChatCount,
  currentTrack,
  isPlaying,
  currentUser,
  logout,
  likedTrackIds,
  globalTheme,
  showToast,
  isActivityPanelOpen,
  toggleActivityPanel,
  setIsAddSongOpen,
  setIsCreatePlaylistOpen,
  setIsImportPlaylistOpen,
  setIsImportSongOpen,
  setIsAuthOpen,
  setIsSettingsOpen,
}) {
  return (
    <>
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
                trackIds: (likedTrackIds || []).map(String),
              };
            }
            const userPl = playlists.find(p => String(p.id || p._id) === selId);
            if (userPl) {
              return { ...userPl, isAlbum: false };
            }
            const alb = albums.find(a => String(a.id || a._id) === selId);
            if (alb) {
              const albumTracks = (tracks || []).filter(
                t => t.album && t.album.toLowerCase().trim() === (alb.name || '').toLowerCase().trim()
              );
              const allTrackIds = Array.from(
                new Set([
                  ...albumTracks.map(t => String(t.id || t._id)),
                  ...(alb.trackIds || []).map(String),
                  ...(selectedPlaylist?.trackIds || []).map(String),
                ])
              );
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
          onSelectPlaylist={(pl) => {
            handleSelectPlaylistView(pl);
          }}
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
        />
      )}
    </>
  );
}
