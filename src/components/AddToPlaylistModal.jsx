import React from 'react';
import { X, Plus, Check, Radio } from 'lucide-react';

export default function AddToPlaylistModal({ 
  isOpen, 
  onClose, 
  track, 
  playlists = [], 
  onAddTrackToPlaylist,
  jamSession,
  onAddToJamQueue
}) {
  if (!isOpen || !track) return null;

  const customPlaylists = playlists.filter(p => !p.isLikedSongs);

  return (
    <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg max-w-sm w-full p-6 relative">
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#0b1110]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#17a398] brutal-border" />
            <h3 className="text-base font-mono font-black uppercase text-[#082621]">Dispense to Cassette</h3>
          </div>
          <button onClick={onClose} className="brutal-btn p-1 bg-[#ede5d3] brutal-border hover:bg-[#ded2bb] text-[#0b1110]">
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center gap-3 my-4 p-2.5 bg-[#ede5d3] brutal-border">
          <img src={track.cover} alt={track.title} className="w-11 h-11 brutal-border object-cover bg-white" />
          <div className="truncate flex-1">
            <h4 className="font-bold text-xs text-[#0b1110] truncate">{track.title}</h4>
            <p className="text-[11px] text-[#082621]/70 truncate">{track.artist}</p>
          </div>
        </div>

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
            const alreadyAdded = (pl.trackIds || []).includes(track.id);
            return (
              <button
                key={pl.id}
                onClick={() => {
                  onAddTrackToPlaylist(track.id, pl.id);
                  onClose();
                }}
                className={`brutal-btn p-2.5 brutal-border text-left text-xs font-mono font-black uppercase flex items-center justify-between transition-colors ${
                  alreadyAdded 
                    ? 'bg-[#082621] text-[#26c4b7]' 
                    : 'bg-[#ede5d3] text-[#082621] hover:bg-white'
                }`}
              >
                <span className="truncate">{pl.name}</span>
                {alreadyAdded ? <Check size={14} /> : <Plus size={14} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
