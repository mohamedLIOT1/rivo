import React, { useState } from 'react';
import { Play, Heart, CheckCircle2, UserPlus, Check, Award, Music2 } from 'lucide-react';

export default function ArtistScreen({ artist, tracks = [], onSelectTrack, toggleLike, globalTheme = 'dark' }) {
  const isDark = globalTheme === 'dark';
  const [isFollowing, setIsFollowing] = useState(false);
  if (!artist) return null;

  const artistTracks = tracks.filter((t) => t.artistId === artist.id || t.artist === artist.name);

  return (
    <div className={`flex-1 overflow-y-auto pb-32 select-none p-4 md:p-8 transition-colors ${
      isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'
    }`}>
      {/* ── Practitioner / Artist Apothecary Header ── */}
      <div className={`brutal-border-thick brutal-shadow-lg p-6 md:p-8 mb-8 relative transition-colors ${
        isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#082621]'
      }`}>
        {/* Top vintage certificate stamp */}
        <div className="flex justify-between items-center mb-4">
          <div className="inline-flex items-center gap-2 bg-[#082621] text-[#26c4b7] px-3 py-1 brutal-border text-[10px] font-mono font-black uppercase">
            <Award size={12} />
            <span>LICENSED ACOUSTIC PRACTITIONER • REG. #{String(artist.id || '88').slice(-4)}</span>
          </div>
          <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`}>RIVO CLINICAL BOARD</span>
        </div>

        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 pt-2">
          {/* Artist Photo */}
          <div className="w-40 h-40 md:w-48 md:h-48 bg-[#ded2bb] brutal-border-thick brutal-shadow shrink-0 relative overflow-hidden">
            <img 
              src={artist.headerImage || artist.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(artist.name)}&background=082621&color=26c4b7&size=512&bold=true&format=svg`} 
              alt={artist.name} 
              className="w-full h-full object-cover" 
            />
            <div className="absolute top-0 right-0 bg-[#0b1110] text-[#f59e0b] text-[9px] font-mono font-black px-1.5 py-0.5">
              ORIGINAL
            </div>
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 brutal-border text-[10px] font-mono font-black uppercase mb-2 ${
              isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
            }`}>
              <CheckCircle2 size={13} className="text-[#17a398]" />
              <span>OFFICIALLY VERIFIED COMPOSER</span>
            </div>

            <h1 className={`text-3xl md:text-6xl font-display font-black tracking-tight leading-tight ${
              isDark ? 'text-white' : 'text-[#082621]'
            }`}>
              {artist.name}
            </h1>

            <div className={`flex items-center justify-center md:justify-start gap-3 mt-3 text-xs font-mono font-bold ${
              isDark ? 'text-zinc-300' : 'text-[#082621]'
            }`}>
              <span className={`px-2 py-0.5 brutal-border ${
                isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] border-black'
              }`}>
                {artist.monthlyListeners || '120,450'} ACTIVE PATIENT LISTENERS
              </span>
              <span>•</span>
              <span>{artistTracks.length} PRESCRIBED COMPOSITIONS</span>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center md:justify-start gap-3 mt-6">
              <button 
                onClick={() => artistTracks.length > 0 && onSelectTrack(artistTracks[0], artistTracks)}
                disabled={artistTracks.length === 0}
                className="brutal-btn w-12 h-12 bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] brutal-border-thick brutal-shadow flex items-center justify-center cursor-pointer"
                title="Dispense all tracks"
              >
                <Play size={22} fill="currentColor" className="ml-0.5 text-[#0b1110]" />
              </button>

              <button 
                onClick={() => setIsFollowing(!isFollowing)}
                className={`brutal-btn flex items-center gap-2 px-5 py-2.5 text-xs font-mono font-black uppercase brutal-border brutal-shadow-sm cursor-pointer ${
                  isFollowing 
                    ? 'bg-[#082621] text-[#26c4b7]' 
                    : isDark 
                      ? 'bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700' 
                      : 'bg-[#ede5d3] text-[#082621] hover:bg-[#ded2bb] border-black'
                }`}
              >
                {isFollowing ? <Check size={14} /> : <UserPlus size={14} />}
                <span>{isFollowing ? 'SUBSCRIBED DOSE' : 'FOLLOW PRACTITIONER'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Popular Compositions Table ── */}
      <div className={`brutal-border-thick brutal-shadow-lg p-6 mb-8 ${
        isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#082621]'
      }`}>
        <div className={`flex items-center justify-between pb-3 mb-4 border-b-2 ${
          isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110] text-[#082621]'
        }`}>
          <div className="flex items-center gap-2">
            <Music2 size={18} className="text-[#17a398]" />
            <h2 className="text-lg font-mono font-black uppercase">PRIMARY FORMULATIONS / POPULAR</h2>
          </div>
          <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`}>SORTED BY CLINICAL DEMAND</span>
        </div>

        {artistTracks.length > 0 ? (
          <div className="space-y-2">
            {artistTracks.map((track, i) => (
              <div
                key={track.id || i}
                onClick={() => onSelectTrack(track, artistTracks)}
                className={`flex items-center gap-4 p-3 brutal-border brutal-shadow-sm hover:translate-x-1 transition-transform cursor-pointer group ${
                  isDark 
                    ? 'bg-[#182320] border-zinc-700 text-white hover:bg-[#22332e]' 
                    : 'bg-[#ede5d3] border-black text-[#0b1110] hover:bg-white'
                }`}
              >
                <span className={`text-xs font-mono font-black w-6 text-center ${
                  isDark ? 'text-zinc-400' : 'text-[#082621]'
                }`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <img 
                  src={track.cover} 
                  alt={track.title} 
                  className="w-11 h-11 brutal-border object-cover bg-white shrink-0" 
                  onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=R&background=082621&color=26c4b7`; }}
                />
                <div className="flex-1 truncate">
                  <h4 className={`text-xs sm:text-sm font-bold truncate group-hover:text-[#17a398] transition-colors ${
                    isDark ? 'text-white' : 'text-[#0b1110]'
                  }`}>
                    {track.title}
                  </h4>
                  <p className={`text-[11px] truncate font-medium ${
                    isDark ? 'text-zinc-400' : 'text-[#082621]/70'
                  }`}>{track.album || 'Single Cassette'}</p>
                </div>

                <div className="text-right hidden sm:block">
                  <span className={`text-[11px] font-mono font-bold px-2 py-0.5 brutal-border ${
                    isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#fdfbf7] text-[#082621] border-black'
                  }`}>
                    {track.plays || 0} DOSES
                  </span>
                </div>

                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike(track.id);
                  }}
                  className={`p-2 transition-colors cursor-pointer ${
                    isDark ? 'text-zinc-400 hover:text-[#dc2626]' : 'text-[#0b1110] hover:text-[#dc2626]'
                  }`}
                  title="Favorite"
                >
                  <Heart size={16} className={track.liked ? 'fill-[#dc2626] text-[#dc2626]' : ''} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className={`text-center py-8 text-xs font-mono ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
            NO TRACKS REGISTERED UNDER THIS PRACTITIONER YET.
          </div>
        )}
      </div>

      {/* ── Practitioner Bio Dossier ── */}
      <div className="bg-[#082621] text-[#fdfbf7] brutal-border-thick brutal-shadow-lg p-6 max-w-3xl">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#26c4b7]/30">
          <h2 className="text-base font-mono font-black uppercase text-[#26c4b7]">PRACTITIONER ARCHIVE DOSSIER</h2>
          <span className="text-[10px] font-mono text-[#ded2bb]">DOCUMENTATION #BIO</span>
        </div>
        <p className="text-xs sm:text-sm text-[#ded2bb] leading-relaxed font-sans font-medium">
          {artist.bio || `${artist.name} is a certified Rivo sonic artisan contributing harmonically therapeutic audio frequencies to our regional dispensary network.`}
        </p>
      </div>
    </div>
  );
}
