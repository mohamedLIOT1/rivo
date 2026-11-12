import React from 'react';

const lazyModalsCache = {};
function getLazyModal(key, loader) {
  if (!lazyModalsCache[key]) {
    lazyModalsCache[key] = loader();
  }
  return lazyModalsCache[key];
}

export default function MobileModals({
  tracks: propTracks,
  albums: propAlbums,
  isFullPlayerOpen,
  setIsFullPlayerOpen,
  selectedAlbum,
  setSelectedAlbum,
  selectedArtist,
  setSelectedArtist,
  actionTrack,
  setActionTrack,
  playlistTrack,
  setPlaylistTrack,
  isCreatePlaylistOpen,
  setIsCreatePlaylistOpen,
  isAddSongOpen,
  setIsAddSongOpen,
  isChatOpen,
  setIsChatOpen,
  chatTargetUser,
  setChatTargetUser,
  isJamOpen,
  setIsJamOpen,
  viewingUser,
  setViewingUser,
  isSettingsOpen,
  setIsSettingsOpen,
  isFriendActivityOpen,
  setIsFriendActivityOpen,
  isIntroAuthOpen,
  setIsIntroAuthOpen,
  currentUser,
  setActiveTab,
}) {
  return (
    <>
      {Boolean(selectedAlbum) && (() => {
        const AlbumDetailModal = getLazyModal('album', () => require('./AlbumDetailModal').default);
        return (
          <AlbumDetailModal
            visible={Boolean(selectedAlbum)}
            album={selectedAlbum}
            allTracks={propTracks || []}
            allAlbums={propAlbums || []}
            onClose={() => setSelectedAlbum && setSelectedAlbum(null)}
            onTrackAction={(track) => setActionTrack && setActionTrack(track)}
            onOpenFullPlayer={() => setIsFullPlayerOpen && setIsFullPlayerOpen(true)}
            onSelectArtist={(artistName) => {
              if (setSelectedAlbum) setSelectedAlbum(null);
              if (setSelectedArtist) setSelectedArtist({ name: artistName });
            }}
          />
        );
      })()}

      {Boolean(selectedArtist) && (() => {
        const ArtistDetailModal = getLazyModal('artist', () => require('./ArtistDetailModal').default);
        return (
          <ArtistDetailModal
            visible={Boolean(selectedArtist)}
            artist={selectedArtist}
            allTracks={propTracks || []}
            allAlbums={propAlbums || []}
            onClose={() => setSelectedArtist && setSelectedArtist(null)}
            onOpenFullPlayer={() => setIsFullPlayerOpen && setIsFullPlayerOpen(true)}
            onSelectAlbum={(alb) => {
              if (setSelectedArtist) setSelectedArtist(null);
              if (setSelectedAlbum) setSelectedAlbum(alb);
            }}
            onTrackAction={(track) => setActionTrack && setActionTrack(track)}
          />
        );
      })()}

      {isFullPlayerOpen && (() => {
        const FullPlayerModal = getLazyModal('fullPlayer', () => require('./FullPlayerModal').default);
        return (
          <FullPlayerModal
            visible={true}
            onClose={() => setIsFullPlayerOpen(false)}
            onTrackAction={(track) => track && setActionTrack(track)}
          />
        );
      })()}

      {Boolean(actionTrack) && (() => {
        const TrackActionMenuModal = getLazyModal('trackAction', () => require('./TrackActionMenuModal').default);
        return (
          <TrackActionMenuModal
            visible={!!actionTrack}
            track={actionTrack}
            onClose={() => setActionTrack(null)}
            onOpenAddToPlaylist={(track) => setPlaylistTrack(track)}
          />
        );
      })()}

      {Boolean(playlistTrack) && (() => {
        const PlaylistPickerModal = getLazyModal('playlistPicker', () => require('./PlaylistPickerModal').default);
        return (
          <PlaylistPickerModal
            visible={!!playlistTrack}
            track={playlistTrack}
            onClose={() => setPlaylistTrack(null)}
          />
        );
      })()}

      {isCreatePlaylistOpen && (() => {
        const CreatePlaylistModal = getLazyModal('createPlaylist', () => require('./CreatePlaylistModal').default);
        return (
          <CreatePlaylistModal
            visible={isCreatePlaylistOpen}
            onClose={() => setIsCreatePlaylistOpen(false)}
            onSuccess={() => setIsCreatePlaylistOpen(false)}
            allTracks={propTracks}
          />
        );
      })()}

      {isAddSongOpen && (() => {
        const AddSongModal = getLazyModal('addSong', () => require('./AddSongModal').default);
        return (
          <AddSongModal
            visible={isAddSongOpen}
            onClose={() => setIsAddSongOpen(false)}
            onSuccess={() => setIsAddSongOpen(false)}
          />
        );
      })()}

      {isChatOpen && (() => {
        const ChatModal = getLazyModal('chat', () => require('./ChatModal').default);
        return (
          <ChatModal
            visible={isChatOpen}
            onClose={() => {
              setIsChatOpen(false);
              setChatTargetUser(null);
            }}
            initialTargetUser={chatTargetUser}
            onOpenJam={() => {
              setIsChatOpen(false);
              setIsJamOpen(true);
            }}
            onViewProfile={(target) => {
              setIsChatOpen(false);
              const myId = currentUser?._id || currentUser?.id;
              const targetId = target?._id || target?.id;
              if (targetId && myId && String(targetId) === String(myId)) {
                if (setViewingUser) setViewingUser(null);
              } else {
                if (setViewingUser) setViewingUser(target);
              }
              if (setActiveTab) setActiveTab('profile');
            }}
          />
        );
      })()}

      {isSettingsOpen && (() => {
        const SettingsModal = getLazyModal('settings', () => require('./SettingsModal').default);
        return (
          <SettingsModal
            visible={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
        );
      })()}

      {isJamOpen && (() => {
        const JamRoomModal = getLazyModal('jam', () => require('./JamRoomModal').default);
        return (
          <JamRoomModal
            visible={isJamOpen}
            onClose={() => setIsJamOpen(false)}
          />
        );
      })()}

      {isFriendActivityOpen && (() => {
        const FriendActivityModal = getLazyModal('friendActivity', () => require('./FriendActivityModal').default);
        return (
          <FriendActivityModal
            visible={isFriendActivityOpen}
            onClose={() => setIsFriendActivityOpen(false)}
            onViewProfile={(target) => {
              setIsFriendActivityOpen(false);
              const myId = currentUser?._id || currentUser?.id;
              const targetId = target?._id || target?.id;
              if (targetId && myId && String(targetId) === String(myId)) {
                if (setViewingUser) setViewingUser(null);
              } else {
                if (setViewingUser) setViewingUser(target);
              }
              if (setActiveTab) setActiveTab('profile');
            }}
          />
        );
      })()}

      {isIntroAuthOpen && (() => {
        const IntroAuthModal = getLazyModal('introAuth', () => require('./IntroAuthModal').default);
        return (
          <IntroAuthModal
            visible={isIntroAuthOpen}
            onClose={() => setIsIntroAuthOpen(false)}
          />
        );
      })()}
    </>
  );
}
