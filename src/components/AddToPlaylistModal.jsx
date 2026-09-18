import React from 'react';
import { X, Plus, Music, Check } from 'lucide-react';

export default function AddToPlaylistModal({ isOpen, onClose, track, playlists, onAddTrackToPlaylist }) {
  if (!isOpen || !track) return null;

  const customPlaylists = playlists.filter(p => !p.isLikedSongs);

  return (
    <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-[#181818] border border-zinc-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <h3 className="text-lg font-extrabold text-white">Add to Playlist</h3>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white rounded-full">
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center gap-3 my-4 p-3 bg-zinc-900 rounded-2xl border border-zinc-800">
          <img src={track.cover} alt={track.title} className="w-12 h-12 rounded-xl object-cover" />
          <div className="truncate">
            <h4 className="font-bold text-sm text-white truncate">{track.title}</h4>
            <p className="text-xs text-zinc-400 truncate">{track.artist}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto mb-4">
          {customPlaylists.map((pl) => {
            const alreadyAdded = (pl.trackIds || []).includes(track.id);
            return (
              <button
                key={pl.id}
                onClick={() => {
                  onAddTrackToPlaylist(track.id, pl.id);
                  onClose();
                }}
                className={`p-3 rounded-xl text-left text-xs font-bold flex items-center justify-between transition-all ${
                  alreadyAdded 
                    ? 'bg-[#1DB954]/10 border border-[#1DB954] text-[#1DB954]' 
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <span className="truncate">{pl.name}</span>
                {alreadyAdded ? <Check size={16} /> : <Plus size={16} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
