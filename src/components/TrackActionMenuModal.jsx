import React, { useState } from 'react';
import { 
  Play, ListPlus, Plus, Minus, BookmarkPlus, BookmarkMinus, 
  Edit3, Trash2, X, Sparkles, CheckCircle2 
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { isUserAdmin } from '../utils/adminUtils';
import { useAudioPlayer } from '../context/AudioContext';

export default function TrackActionMenuModal({
  isOpen,
  onClose,
  track,
  playlist = null,
  onPlayTrack,
  onAddToQueue,
  openAddToPlaylist,
  onRemoveTrackFromPlaylist,
  openEditSongModal,
  onDeleteTrack,
  currentUser,
  globalTheme = 'dark',
  onToast
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const isDark = globalTheme === 'dark';
  const isAdmin = isUserAdmin(currentUser);
  const { currentTrack } = useAudioPlayer();

  if (!isOpen || !track) return null;

  const showToast = (msg) => {
    if (onToast) onToast(msg);
  };

  const handlePlayNow = () => {
    if (onPlayTrack) onPlayTrack(track);
    onClose();
  };

  const handlePlayNext = () => {
    if (onAddToQueue) {
      onAddToQueue(track, true);
      showToast(currentTrack ? 'Will play next after current song' : 'Now playing');
    }
    onClose();
  };

  const handleAddToQueue = () => {
    if (onAddToQueue) {
      onAddToQueue(track, false);
      showToast(currentTrack ? 'Added to end of queue' : 'Now playing');
    }
    onClose();
  };

  const handleAddToPlaylist = () => {
    if (openAddToPlaylist) {
      openAddToPlaylist(track);
    }
    onClose();
  };

  const handleRemoveFromPlaylist = () => {
    if (onRemoveTrackFromPlaylist && playlist) {
      const pId = playlist.id || playlist._id;
      const tId = track.id || track._id;
      onRemoveTrackFromPlaylist(tId, pId);
      showToast(`Removed from ${playlist.name || 'playlist'}`);
    }
    onClose();
  };

  const handleEdit = () => {
    if (openEditSongModal) {
      openEditSongModal(track);
    }
    onClose();
  };

  const handleDeleteConfirmed = async () => {
    setDeleteConfirmOpen(false);
    if (onDeleteTrack) {
      await onDeleteTrack(track.id || track._id);
      showToast(`Deleted "${track.title}"`);
    }
    onClose();
  };

  // Determine if track can be removed from current playlist view
  const canRemoveFromPlaylist = Boolean(
    playlist && 
    onRemoveTrackFromPlaylist && 
    !playlist.isLikedSongs
  );

  return (
    <>
      <div 
        className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 select-none"
        onClick={onClose}
      >
        <div 
          className={`w-full max-w-md rounded-t-3xl sm:rounded-2xl p-4 sm:p-5 text-left border-2 animate-in fade-in slide-in-from-bottom-6 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 ${
            isDark 
              ? 'bg-[#121816] text-[#fdfbf7] border-zinc-700 shadow-[0_10px_35px_rgba(0,0,0,0.85)]' 
              : 'bg-[#fdfbf7] text-[#0b1110] border-black brutal-shadow-lg paper-texture'
          } max-h-[85vh] overflow-y-auto`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Mobile Grab Handle Bar */}
          <div className="w-10 h-1.5 rounded-full bg-zinc-500/40 mx-auto mb-3 sm:hidden" />

          {/* Header: Track Cover + Info + Close Button */}
          <div className={`flex items-center gap-3 pb-3 border-b ${isDark ? 'border-zinc-800' : 'border-zinc-200'} mb-3`}>
            <img 
              src={track.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300'} 
              alt={track.title} 
              className="w-12 h-12 rounded-xl object-cover brutal-border shrink-0 bg-black"
              onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=R&background=082621&color=26c4b7'; }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display font-black truncate">{track.title}</p>
              <p className={`text-xs truncate mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {track.artist || 'Unknown Artist'}
              </p>
              {track.album && (
                <p className={`text-[10px] font-mono truncate ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                  {track.album}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl cursor-pointer transition-colors ${
                isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-600 hover:text-black hover:bg-[#ede5d3]'
              }`}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Action List */}
          <div className="space-y-1 font-mono text-xs font-bold">
            {/* Play Now */}
            {onPlayTrack && (
              <button
                onClick={handlePlayNow}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-zinc-800/80 text-zinc-200' : 'hover:bg-[#ede5d3] text-zinc-900'
                }`}
              >
                <Play size={16} className="text-[#17a398]" />
                <span>Play Track Now</span>
              </button>
            )}

            {/* Play Next in Queue */}
            {onAddToQueue && (
              <button
                onClick={handlePlayNext}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-zinc-800/80 text-zinc-200' : 'hover:bg-[#ede5d3] text-zinc-900'
                }`}
              >
                <ListPlus size={16} className="text-[#26c4b7]" />
                <span>Play Next in Queue</span>
              </button>
            )}

            {/* Add to Queue */}
            {onAddToQueue && (
              <button
                onClick={handleAddToQueue}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-zinc-800/80 text-zinc-200' : 'hover:bg-[#ede5d3] text-zinc-900'
                }`}
              >
                <Plus size={16} className="text-[#26c4b7]" />
                <span>Add to Queue</span>
              </button>
            )}

            <div className={`my-1.5 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`} />

            {/* Add to Playlist */}
            {openAddToPlaylist && (
              <button
                onClick={handleAddToPlaylist}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-zinc-800/80 text-zinc-200' : 'hover:bg-[#ede5d3] text-zinc-900'
                }`}
              >
                <BookmarkPlus size={16} className="text-[#f59e0b]" />
                <span>Add to Playlist...</span>
              </button>
            )}

            {/* Remove from Playlist (when in a playlist) */}
            {canRemoveFromPlaylist && (
              <button
                onClick={handleRemoveFromPlaylist}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer text-amber-500 ${
                  isDark ? 'hover:bg-amber-500/10' : 'hover:bg-amber-100'
                }`}
              >
                <BookmarkMinus size={16} />
                <span>Remove from {playlist.name || 'Playlist'}</span>
              </button>
            )}

            {/* Edit Song Details (Admin) */}
            {isAdmin && openEditSongModal && (
              <button
                onClick={handleEdit}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-zinc-800/80 text-zinc-200' : 'hover:bg-[#ede5d3] text-zinc-900'
                }`}
              >
                <Edit3 size={16} className="text-[#17a398]" />
                <span>Edit Song Details (Admin)</span>
              </button>
            )}

            {/* Delete Song Permanently (Admin) */}
            {isAdmin && onDeleteTrack && (
              <button
                onClick={() => setDeleteConfirmOpen(true)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer text-red-500 ${
                  isDark ? 'hover:bg-red-500/10' : 'hover:bg-red-100'
                }`}
              >
                <Trash2 size={16} />
                <span>Delete Song Permanently</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <ConfirmModal
          isOpen={deleteConfirmOpen}
          title={`Delete "${track.title}"?`}
          message={`Are you sure you want to permanently delete "${track.title}" by ${track.artist || 'Unknown'} from the Rivo library? This cannot be undone.`}
          confirmText="Delete Permanently"
          cancelText="Cancel"
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setDeleteConfirmOpen(false)}
        />
      )}
    </>
  );
}
