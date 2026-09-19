import React, { useState, useEffect } from 'react';
import { X, Plus, Check, Radio, AlertTriangle, ArrowLeft } from 'lucide-react';
import { isQuranContent } from '../utils/quranUtils';

export default function AddToPlaylistModal({ 
  isOpen, 
  onClose, 
  track, 
  playlists = [], 
  onAddTrackToPlaylist,
  onRemoveTrackFromPlaylist,
  jamSession,
  onAddToJamQueue
}) {
  const [duplicateConfirmPlaylist, setDuplicateConfirmPlaylist] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setDuplicateConfirmPlaylist(null);
    }
  }, [isOpen]);

  if (!isOpen || !track) return null;

  const isQuran = isQuranContent(track);
  const customPlaylists = playlists.filter(p => !p.isLikedSongs && (isQuran ? isQuranContent(p) : !isQuranContent(p)));
  const trackIdClean = String(track.id || track._id);

  const handlePlaylistClick = (pl) => {
    const isAlreadyAdded = (pl.trackIds || []).map(String).includes(trackIdClean);
    if (isAlreadyAdded) {
      setDuplicateConfirmPlaylist(pl);
    } else {
      onAddTrackToPlaylist?.(track.id || track._id, pl.id, false);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg max-w-sm w-full p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#0b1110]">
          <div className="flex items-center gap-2">
            {duplicateConfirmPlaylist ? (
              <button 
                onClick={() => setDuplicateConfirmPlaylist(null)}
                className="brutal-btn p-1 bg-[#ede5d3] brutal-border hover:bg-[#ded2bb] text-[#0b1110] flex items-center gap-1 text-[10px] font-mono font-bold"
                title="Back to playlists"
              >
                <ArrowLeft size={12} />
              </button>
            ) : (
              <div className="w-3 h-3 bg-[#17a398] brutal-border" />
            )}
            <h3 className="text-base font-mono font-black uppercase text-[#082621]">
              {duplicateConfirmPlaylist ? 'Already in Playlist' : (isQuran ? 'Add to Quran Playlist' : 'Dispense to Cassette')}
            </h3>
          </div>
          <button 
            onClick={() => {
              setDuplicateConfirmPlaylist(null);
              onClose();
            }} 
            className="brutal-btn p-1 bg-[#ede5d3] brutal-border hover:bg-[#ded2bb] text-[#0b1110]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Track preview */}
        <div className="flex items-center gap-3 my-4 p-2.5 bg-[#ede5d3] brutal-border">
          <img src={track.cover} alt={track.title} className="w-11 h-11 brutal-border object-cover bg-white shrink-0" />
          <div className="truncate flex-1">
            <h4 className="font-bold text-xs text-[#0b1110] truncate">{track.title}</h4>
            <p className="text-[11px] text-[#082621]/70 truncate">{track.artist}</p>
          </div>
        </div>

        {/* Duplicate Confirmation View */}
        {duplicateConfirmPlaylist ? (
          <div className="py-1">
            <div className="p-3 bg-amber-500/10 border-2 border-amber-600/30 mb-4 text-center">
              <AlertTriangle className="mx-auto text-amber-600 mb-1.5" size={22} />
              <p className="text-xs font-mono font-bold text-[#082621]">
                "<span className="font-black">{track.title}</span>" is already in <span className="font-black">"{duplicateConfirmPlaylist.name}"</span>.
              </p>
              <p className="text-[11px] font-sans text-[#082621]/70 mt-1">
                Do you want to add it again?
              </p>
            </div>

            {/* The 2 Main Options: Add Again or Cancel */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onAddTrackToPlaylist?.(track.id || track._id, duplicateConfirmPlaylist.id, true);
                  setDuplicateConfirmPlaylist(null);
                  onClose();
                }}
                className="flex-1 py-2.5 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} strokeWidth={3} />
                <span>Add Again</span>
              </button>

              <button
                type="button"
                onClick={() => setDuplicateConfirmPlaylist(null)}
                className="flex-1 py-2.5 bg-[#ede5d3] hover:bg-[#ded2bb] text-[#082621] font-mono text-xs font-black uppercase brutal-border cursor-pointer flex items-center justify-center"
              >
                <span>Cancel</span>
              </button>
            </div>

            {/* 3rd Option: Small text below the 2 options to remove from playlist */}
            <div className="text-center pt-3">
              <button
                type="button"
                onClick={() => {
                  onRemoveTrackFromPlaylist?.(track.id || track._id, duplicateConfirmPlaylist.id);
                  setDuplicateConfirmPlaylist(null);
                  onClose();
                }}
                className="text-[11px] font-mono font-bold text-[#dc2626] hover:text-red-700 hover:underline cursor-pointer bg-transparent border-0 inline-block p-1"
              >
                Remove from playlist
              </button>
            </div>
          </div>
        ) : (
          /* Normal Playlist Selection View */
          <>
            {/* ── Add to Jam Queue (if Jam is Active) ── */}
            {jamSession && (
              <div className="mb-4">
                <button
                  onClick={() => {
                    onAddToJamQueue?.(track);
                    onClose();
                  }}
                  className="brutal-btn w-full p-2.5 bg-[#082621] text-[#26c4b7] brutal-border brutal-shadow-sm flex items-center justify-between text-xs font-mono font-black uppercase"
                >
                  <div className="flex items-center gap-2">
                    <Radio size={14} className="text-[#f59e0b] animate-pulse shrink-0" />
                    <span className="truncate">BROADCAST TO RADIO ({jamSession.code})</span>
                  </div>
                  <Plus size={14} className="text-[#26c4b7]" />
                </button>
              </div>
            )}

            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto mb-2 pr-1">
              {customPlaylists.map((pl) => {
                const alreadyAdded = (pl.trackIds || []).map(String).includes(trackIdClean);
                return (
                  <button
                    key={pl.id}
                    onClick={() => handlePlaylistClick(pl)}
                    className={`brutal-btn p-2.5 brutal-border text-left text-xs font-mono font-black uppercase flex items-center justify-between transition-colors ${
                      alreadyAdded 
                        ? 'bg-[#082621] text-[#26c4b7]' 
                        : 'bg-[#ede5d3] text-[#082621] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="truncate">{pl.name}</span>
                      {alreadyAdded && (
                        <span className="text-[9px] font-mono px-1 py-0.2 bg-[#26c4b7]/20 text-[#26c4b7] brutal-border">
                          IN PLAYLIST
                        </span>
                      )}
                    </div>
                    {alreadyAdded ? <Check size={14} className="shrink-0" /> : <Plus size={14} className="shrink-0" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
