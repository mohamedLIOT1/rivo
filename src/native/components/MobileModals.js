import React from 'react';
import FullPlayerModal from './FullPlayerModal';
import TrackActionMenuModal from './TrackActionMenuModal';
import PlaylistPickerModal from './PlaylistPickerModal';
import CreatePlaylistModal from './CreatePlaylistModal';
import AddSongModal from './AddSongModal';
import ChatModal from './ChatModal';
import SettingsModal from './SettingsModal';
import JamRoomModal from './JamRoomModal';
import FriendActivityModal from './FriendActivityModal';
import IntroAuthModal from './IntroAuthModal';
import UserDetailModal from './UserDetailModal';
import AlbumDetailModal from './AlbumDetailModal';
import ArtistDetailModal from './ArtistDetailModal';
import { useUser } from '../context/UserContext';

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
      {Boolean(selectedAlbum) && (
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
      )}

      {Boolean(selectedArtist) && (
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
      )}
      {isFullPlayerOpen && (
        <FullPlayerModal
          visible={isFullPlayerOpen}
          onClose={() => setIsFullPlayerOpen(false)}
          onTrackAction={(track) => setActionTrack(track)}
        />
      )}

      {Boolean(actionTrack) && (
        <TrackActionMenuModal
          visible={!!actionTrack}
          track={actionTrack}
          onClose={() => setActionTrack(null)}
          onOpenAddToPlaylist={(track) => setPlaylistTrack(track)}
        />
      )}

      {Boolean(playlistTrack) && (
        <PlaylistPickerModal
          visible={!!playlistTrack}
          track={playlistTrack}
          onClose={() => setPlaylistTrack(null)}
        />
      )}

      {isCreatePlaylistOpen && (
        <CreatePlaylistModal
          visible={isCreatePlaylistOpen}
          onClose={() => setIsCreatePlaylistOpen(false)}
          onSuccess={() => setIsCreatePlaylistOpen(false)}
          allTracks={propTracks}
        />
      )}

      {isAddSongOpen && (
        <AddSongModal
          visible={isAddSongOpen}
          onClose={() => setIsAddSongOpen(false)}
          onSuccess={() => setIsAddSongOpen(false)}
        />
      )}

      {isChatOpen && (
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
              setActiveTab('profile');
            } else {
              setViewingUser(target);
            }
          }}
        />
      )}

      {Boolean(viewingUser) && (
        <UserDetailModal
          visible={Boolean(viewingUser)}
          user={viewingUser}
          userId={viewingUser?._id || viewingUser?.id}
          onClose={() => setViewingUser(null)}
          onOpenChat={(target) => {
            setViewingUser(null);
            setChatTargetUser(target);
            setIsChatOpen(true);
          }}
          onOpenJam={() => {
            setViewingUser(null);
            setIsJamOpen(true);
          }}
          onOpenFullPlayer={() => setIsFullPlayerOpen(true)}
          onSelectAlbum={(alb) => setSelectedAlbum && setSelectedAlbum(alb)}
        />
      )}

      {isSettingsOpen && (
        <SettingsModal
          visible={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {isJamOpen && (
        <JamRoomModal
          visible={isJamOpen}
          onClose={() => setIsJamOpen(false)}
        />
      )}

      {isFriendActivityOpen && (
        <FriendActivityModal
          visible={isFriendActivityOpen}
          onClose={() => setIsFriendActivityOpen(false)}
        />
      )}

      {isIntroAuthOpen && (
        <IntroAuthModal
          visible={isIntroAuthOpen}
          onClose={() => setIsIntroAuthOpen(false)}
        />
      )}
    </>
  );
}
