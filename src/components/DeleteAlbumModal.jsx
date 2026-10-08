import React, { useState } from 'react';
import { Trash2, Disc, AlertTriangle, X, Music, BookOpen, Loader2 } from 'lucide-react';

export default function DeleteAlbumModal({
  isOpen,
  onClose,
  album,
  tracksCount = 0,
  onConfirm,
  globalTheme = 'dark',
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedAction, setSelectedAction] = useState(null); // 'album_only' | 'album_and_tracks'

  if (!isOpen || !album) return null;

  const isDark = globalTheme === 'dark';
  const isQuran = Boolean(album.isQuran);
  const count = tracksCount || (album.trackIds || []).length || 0;
  const itemType = isQuran ? 'سورة' : 'song';
  const itemTypePlural = isQuran ? 'سورة / تلاوة' : (count === 1 ? 'song' : 'songs');

  const handleExecute = async (deleteTracks) => {
    setIsDeleting(true);
    setSelectedAction(deleteTracks ? 'album_and_tracks' : 'album_only');
    try {
      if (onConfirm) {
        await onConfirm(deleteTracks);
      }
      onClose();
    } catch (err) {
      console.error('Delete album error:', err);
    } finally {
      setIsDeleting(false);
      setSelectedAction(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[650] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none animate-fadeIn">
      <div 
        className={`w-full max-w-md p-6 brutal-shadow-lg brutal-border-thick rounded-2xl relative transition-all ${
          isDark ? 'bg-[#0f1715] text-white border-zinc-700' : 'bg-[#fffdfa] text-[#0b1110] border-black'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={isDeleting}
          className={`absolute top-4 right-4 p-1.5 rounded-lg brutal-border transition-colors cursor-pointer ${
            isDark ? 'bg-[#182320] text-zinc-400 hover:text-white border-zinc-700' : 'bg-[#ede5d3] text-zinc-600 hover:text-black border-black'
          }`}
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-500 flex items-center justify-center brutal-border border-red-500 shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <h3 className="text-base font-mono font-black uppercase">
              {isQuran ? 'Delete Collection / Quran' : 'Delete Album'}
            </h3>
            <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              Choose how you want to remove this album.
            </p>
          </div>
        </div>

        {/* Album Preview Card */}
        <div className={`flex items-center gap-3.5 p-3 rounded-xl brutal-border mb-5 ${
          isDark ? 'bg-[#141d1b] border-zinc-800' : 'bg-[#f4efe4] border-black/20'
        }`}>
          <img
            src={album.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300'}
            alt={album.name}
            className="w-14 h-14 rounded-lg object-cover brutal-border shrink-0"
            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300'; }}
          />
          <div className="min-w-0 flex-1">
            <h4 className="font-display font-black text-sm truncate">
              {album.name}
            </h4>
            <p className={`text-xs truncate ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
              {album.artist}
            </p>
            <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#17a398]/20 text-[#26c4b7] brutal-border border-[#17a398]/40">
              {isQuran ? <BookOpen size={11} /> : <Music size={11} />}
              <span>{count} {itemTypePlural}</span>
            </div>
          </div>
        </div>

        {/* Two Delete Choices */}
        <div className="space-y-3 mb-4">
          {/* Choice 1: Delete Album & KEEP Songs */}
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => handleExecute(false)}
            className={`w-full p-3.5 rounded-xl brutal-border text-left transition-all cursor-pointer flex items-start gap-3 group hover:scale-[1.01] ${
              isDark 
                ? 'bg-[#182623] hover:bg-[#1f332f] border-zinc-700 text-white' 
                : 'bg-white hover:bg-[#faf5eb] border-black text-[#0b1110]'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-[#17a398]/20 text-[#26c4b7] flex items-center justify-center brutal-border border-[#17a398]/50 shrink-0 mt-0.5">
              {isDeleting && selectedAction === 'album_only' ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Disc size={16} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono font-black text-xs uppercase flex items-center gap-1.5 text-[#26c4b7]">
                <span>Delete Album Only</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#17a398]/20 border border-[#17a398]/30">
                  Keep Songs
                </span>
              </div>
              <p className={`text-xs mt-1 font-sans ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                Removes the album container, but <strong>keeps all {count} {itemTypePlural}</strong> on the website under the artist.
              </p>
            </div>
          </button>

          {/* Choice 2: Delete Album & ALL Songs */}
          <button
            type="button"
            disabled={isDeleting}
            onClick={() => handleExecute(true)}
            className={`w-full p-3.5 rounded-xl brutal-border text-left transition-all cursor-pointer flex items-start gap-3 group hover:scale-[1.01] ${
              isDark 
                ? 'bg-red-950/20 hover:bg-red-950/40 border-red-800/80 text-white' 
                : 'bg-red-50 hover:bg-red-100 border-red-500 text-red-950'
            }`}
          >
            <div className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center brutal-border border-red-500 shrink-0 mt-0.5">
              {isDeleting && selectedAction === 'album_and_tracks' ? (
                <Loader2 size={16} className="animate-spin text-red-400" />
              ) : (
                <Trash2 size={16} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-mono font-black text-xs uppercase flex items-center gap-1.5 text-red-400">
                <span>Delete Album & All Songs</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-red-500/20 border border-red-500/40">
                  Delete All
                </span>
              </div>
              <p className={`text-xs mt-1 font-sans ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Permanently deletes the album <strong>and all {count} {itemTypePlural}</strong> from the website and user playlists.
              </p>
            </div>
          </button>
        </div>

        {/* Cancel Button */}
        <div className="flex justify-end pt-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className={`px-4 py-2 text-xs font-mono font-bold rounded-lg brutal-border cursor-pointer transition-colors ${
              isDark 
                ? 'bg-[#182320] text-zinc-300 hover:text-white border-zinc-700' 
                : 'bg-[#ede5d3] text-zinc-700 hover:text-black border-black'
            }`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
