import React from 'react';
import { Play, Heart, CheckCircle2, UserPlus } from 'lucide-react';

export default function ArtistScreen({ artist, tracks, onSelectTrack, toggleLike }) {
  if (!artist) return null;

  const artistTracks = tracks.filter((t) => t.artistId === artist.id || t.artist === artist.name);

  return (
    <div className="flex-1 overflow-y-auto pb-32">
      {/* Header Cover Banner */}
      <div className="relative h-72 md:h-96 w-full flex items-end p-6 md:p-8 overflow-hidden">
        <img 
          src={artist.headerImage} 
          alt={artist.name} 
          className="absolute inset-0 w-full h-full object-cover filter brightness-75"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-black/40 to-transparent" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 text-[#1DB954] font-bold text-xs uppercase tracking-wider mb-2">
            <CheckCircle2 size={18} fill="#1DB954" className="text-black" />
            <span>Verified Artist</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight">{artist.name}</h1>
          <p className="text-sm font-semibold text-zinc-300 mt-2">{artist.monthlyListeners} monthly listeners</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 md:p-8 flex items-center gap-4">
        <button 
          onClick={() => artistTracks.length > 0 && onSelectTrack(artistTracks[0])}
          className="w-14 h-14 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all"
        >
          <Play size={26} fill="black" className="ml-1" />
        </button>

        <button className="flex items-center gap-2 px-6 py-2.5 rounded-full border border-zinc-700 text-white font-extrabold text-xs hover:border-white transition-colors">
          <UserPlus size={16} />
          <span>Follow</span>
        </button>
      </div>

      {/* Top Tracks */}
      <div className="px-4 md:px-8 mb-8">
        <h2 className="text-2xl font-extrabold text-white mb-4">Popular</h2>
        <div className="flex flex-col gap-2">
          {artistTracks.map((track, i) => (
            <div
              key={track.id}
              onClick={() => onSelectTrack(track)}
              className="flex items-center gap-4 p-3 rounded-xl hover:bg-zinc-900/80 cursor-pointer group transition-colors border border-transparent hover:border-zinc-800"
            >
              <span className="text-sm font-extrabold text-zinc-500 w-6 text-center">{i + 1}</span>
              <img src={track.cover} alt={track.title} className="w-12 h-12 rounded-lg object-cover" />
              <div className="flex-1 truncate">
                <h4 className="text-sm font-bold text-white truncate group-hover:text-[#1DB954] transition-colors">{track.title}</h4>
                <p className="text-xs text-zinc-400 truncate">{track.album}</p>
              </div>
              <span className="text-xs text-zinc-500 hidden sm:block">{track.plays} plays</span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLike(track.id);
                }}
                className="p-2 text-zinc-400 hover:text-white"
              >
                <Heart size={18} className={track.liked ? 'fill-white text-white' : ''} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Artist Bio Card */}
      <div className="px-4 md:px-8">
        <h2 className="text-2xl font-extrabold text-white mb-4">About</h2>
        <div className="bg-[#181818] p-6 rounded-2xl border border-zinc-800 max-w-2xl">
          <p className="text-sm text-zinc-300 leading-relaxed font-medium">{artist.bio}</p>
        </div>
      </div>
    </div>
  );
}
