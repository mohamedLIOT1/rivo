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

export default function MobileModals({
  isFullPlayerOpen,
  setIsFullPlayerOpen,
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
