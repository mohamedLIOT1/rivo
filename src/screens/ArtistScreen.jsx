import React, { useState, useEffect, useMemo } from 'react';
import { Play, Heart, CheckCircle2, UserPlus, Check, Music2, ArrowLeft, Disc, Layers, Edit } from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';
import { matchesArtist, ArtistLinks } from '../utils/artistUtils';
import { isUserAdmin } from '../utils/adminUtils';
import EditArtistModal from '../components/EditArtistModal';
import { useUser } from '../context/UserContext';

export default function ArtistScreen({ 
  artist: initialArtist, 
  tracks = [], 
  albums = [],
  onSelectTrack, 
  onSelectPlaylist,
  onSelectArtist,
  toggleLike, 
  onBack,
  currentUser,
  globalTheme = 'dark' 
}) {
  const isDark = globalTheme === 'dark';
  const { isFollowingArtist, toggleFollowArtist } = useUser();
  const [artist, setArtist] = useState(initialArtist);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    setArtist(initialArtist);
  }, [initialArtist]);

  if (!artist) return null;

  const artistName = (artist.name || artist.artist || (typeof artist === 'string' ? artist : '')).trim();
  const artistKey = artistName.toLowerCase();

  // Filter artist tracks (case-insensitive, supporting multiple artists per track)
  const artistTracks = useMemo(() => {
    return (tracks || []).filter((t) => {
      if (!t.artist) return false;
      return matchesArtist(t, artist);
    });
  }, [tracks, artist]);

  // Find artist albums from both website albums collection and artist's tracks
  const artistAlbums = useMemo(() => {
    const albumMap = new Map();

    // 1. From website albums collection
    (albums || []).forEach(a => {
      if (a.artist && (matchesArtist(a, artist) || a.artist.trim().toLowerCase() === artistKey)) {
        albumMap.set(a.name.toLowerCase().trim(), {
          ...a,
          trackCount: a.trackIds?.length || 0,
        });
      }
    });

    // 2. From tracks directly
    artistTracks.forEach(t => {
      if (t.album && !['single', 'single cassette', 'unknown', 'youtube', 'soundcloud'].includes(t.album.toLowerCase().trim())) {
        const key = t.album.toLowerCase().trim();
        if (!albumMap.has(key)) {
          albumMap.set(key, {
            id: aIdSafe(t.album),
            name: t.album,
            artist: artistName,
            cover: t.cover,
            trackIds: [String(t.id || t._id)],
            trackCount: 1,
            isAlbum: true,
            isPublic: true
          });
        } else {
          const alb = albumMap.get(key);
          const tid = String(t.id || t._id);
          if (alb.trackIds && !alb.trackIds.includes(tid)) {
            alb.trackIds.push(tid);
            alb.trackCount = (alb.trackCount || 0) + 1;
          }
        }
      }
    });

    return Array.from(albumMap.values());
  }, [albums, artistTracks, artistKey, artistName]);

  function aIdSafe(name) {
    return 'album-' + encodeURIComponent(name).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  }

  const handleOpenAlbum = (album) => {
    if (!onSelectPlaylist) return;
    const albumTracks = artistTracks.filter(t => t.album && t.album.toLowerCase().trim() === album.name.toLowerCase().trim());
    const albumPlaylist = {
      ...album,
      id: album.id || aIdSafe(album.name),
      name: album.name,
      artist: artistName,
      cover: album.cover || albumTracks[0]?.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
      trackIds: album.trackIds?.length > 0 ? album.trackIds : albumTracks.map(t => String(t.id || t._id)),
      isAlbum: true,
      isPublic: true
    };
    onSelectPlaylist(albumPlaylist);
  };

  const totalPlays = useMemo(() => {
    return artistTracks.reduce((acc, t) => acc + (Number(t.plays) || 0), 0);
  }, [artistTracks]);

  return (
    <div className={`flex-1 overflow-y-auto pb-32 select-none p-4 md:p-8 transition-colors ${
      isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'
    }`}>
      {/* Back Button */}
      {onBack && (
        <button
          onClick={onBack}
          className={`mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-display font-black brutal-border brutal-shadow-sm brutal-btn cursor-pointer transition ${
            isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700' : 'bg-[#fdfbf7] hover:bg-white text-[#0b1110]'
          }`}
        >
          <ArrowLeft size={14} strokeWidth={2.5} />
          <span>Back</span>
        </button>
      )}

      {/* ── Artist Header ── */}
      <div className={`brutal-border-thick brutal-shadow-lg p-6 md:p-8 mb-8 relative transition-colors ${
        isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#082621]'
      }`}>
        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 pt-2">
          {/* Artist Photo */}
          <div className="w-40 h-40 md:w-48 md:h-48 bg-[#ded2bb] brutal-border-thick brutal-shadow shrink-0 relative overflow-hidden rounded-xl">
            <img 
              src={artist.headerImage || artist.avatar || artistTracks[0]?.cover || `https://ui-avatars.com/api/?name=${encodeURIComponent(artistName)}&background=082621&color=26c4b7&size=512&bold=true&format=svg`} 
              alt={artistName} 
              className="w-full h-full object-cover" 
            />
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 mb-2">
              <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono font-black uppercase tracking-wider brutal-border ${
                isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
              }`}>
                VERIFIED ARTIST
              </span>
              <VerifiedBadge name={artistName} />
            </div>

            <h1 className={`text-3xl md:text-6xl font-display font-black tracking-tight leading-tight ${
              isDark ? 'text-white' : 'text-[#082621]'
            }`}>
              {artistName}
            </h1>

            <div className={`flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3 text-xs font-mono font-bold ${
              isDark ? 'text-zinc-300' : 'text-[#082621]'
            }`}>
              <span className={`px-2 py-0.5 brutal-border rounded-md ${
                isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] border-black'
              }`}>
                {artistTracks.length} {artistTracks.length === 1 ? 'Track' : 'Tracks'}
              </span>
              <span>•</span>
              <span className={`px-2 py-0.5 brutal-border rounded-md ${
                isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] border-black'
              }`}>
                {artistAlbums.length} {artistAlbums.length === 1 ? 'Album' : 'Albums'}
              </span>
              {totalPlays > 0 && (
                <>
                  <span>•</span>
                  <span>{totalPlays.toLocaleString()} Plays</span>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center md:justify-start gap-3 mt-6">
              <button 
                onClick={() => artistTracks.length > 0 && onSelectTrack(artistTracks[0], artistTracks)}
                disabled={artistTracks.length === 0}
                className="brutal-btn w-12 h-12 bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] brutal-border-thick brutal-shadow flex items-center justify-center cursor-pointer rounded-xl"
                title="Play all tracks"
              >
                <Play size={22} fill="currentColor" className="ml-0.5 text-[#0b1110]" />
              </button>

              <button 
                onClick={() => toggleFollowArtist(artistName)}
                className={`brutal-btn flex items-center gap-2 px-5 py-2.5 text-xs font-mono font-black uppercase brutal-border brutal-shadow-sm cursor-pointer rounded-xl ${
                  isFollowingArtist(artistName) 
                    ? 'bg-[#17a398] text-[#0b1110] font-black' 
                    : isDark 
                      ? 'bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700' 
                      : 'bg-[#ede5d3] text-[#082621] hover:bg-[#ded2bb] border-black'
                }`}
              >
                {isFollowingArtist(artistName) ? <Check size={14} strokeWidth={3} /> : <UserPlus size={14} strokeWidth={2.5} />}
                <span>{isFollowingArtist(artistName) ? 'FOLLOWING' : 'FOLLOW'}</span>
              </button>

              {isUserAdmin(currentUser) && (
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="brutal-btn flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-black uppercase brutal-border brutal-shadow-sm cursor-pointer rounded-xl bg-[#f59e0b] hover:bg-amber-400 text-black"
                  title="Admin: Edit Artist Page & Details"
                >
                  <Edit size={14} />
                  <span>EDIT ARTIST PAGE</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Discography & Albums Section ── */}
      {artistAlbums.length > 0 && (
        <div className={`brutal-border-thick brutal-shadow-lg p-6 mb-8 rounded-xl ${
          isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#082621]'
        }`}>
          <div className={`flex items-center justify-between pb-3 mb-5 border-b-2 ${
            isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110] text-[#082621]'
          }`}>
            <div className="flex items-center gap-2">
              <Disc size={20} className="text-[#17a398]" />
              <h2 className="text-lg font-mono font-black uppercase">DISCOGRAPHY / ALBUMS</h2>
            </div>
            <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`}>
              {artistAlbums.length} {artistAlbums.length === 1 ? 'ALBUM' : 'ALBUMS'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {artistAlbums.map((album) => (
              <div
                key={album.id || album.name}
                onClick={() => handleOpenAlbum(album)}
                className={`p-3 brutal-border brutal-shadow-sm rounded-xl cursor-pointer group transition-transform hover:-translate-y-1 ${
                  isDark ? 'bg-[#182320] border-zinc-700 hover:bg-[#22332e]' : 'bg-[#ede5d3] border-black hover:bg-white'
                }`}
              >
                <div className="relative aspect-square mb-2.5 overflow-hidden rounded-lg brutal-border bg-black/10">
                  <img
                    src={album.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600'}
                    alt={album.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600'; }}
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-[#f59e0b] text-black flex items-center justify-center brutal-border brutal-shadow-sm shadow-md">
                      <Play size={18} fill="currentColor" className="ml-0.5" />
                    </div>
                  </div>
                </div>

                <h3 className={`font-display font-black text-xs sm:text-sm truncate group-hover:text-[#17a398] transition-colors ${
                  isDark ? 'text-white' : 'text-[#0b1110]'
                }`}>
                  {album.name}
                </h3>
                <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-zinc-400">
                  <span className="uppercase font-bold text-[#17a398]">Album</span>
                  {album.trackCount > 0 && (
                    <span>{album.trackCount} {album.trackCount === 1 ? 'song' : 'songs'}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Popular Songs / Discography Tracks ── */}
      <div className={`brutal-border-thick brutal-shadow-lg p-6 mb-8 rounded-xl ${
        isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#082621]'
      }`}>
        <div className={`flex items-center justify-between pb-3 mb-4 border-b-2 ${
          isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110] text-[#082621]'
        }`}>
          <div className="flex items-center gap-2">
            <Music2 size={18} className="text-[#17a398]" />
            <h2 className="text-lg font-mono font-black uppercase">ALL SONGS</h2>
          </div>
          <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`}>
            {artistTracks.length} {artistTracks.length === 1 ? 'TRACK' : 'TRACKS'}
          </span>
        </div>

        {artistTracks.length > 0 ? (
          <div className="space-y-2">
            {artistTracks.map((track, i) => (
              <div
                key={track.id || track._id || i}
                onClick={() => onSelectTrack(track, artistTracks)}
                className={`flex items-center gap-4 p-3 brutal-border brutal-shadow-sm hover:translate-x-1 transition-transform cursor-pointer group rounded-lg ${
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
                  className="w-11 h-11 brutal-border rounded-md object-cover bg-white shrink-0" 
                  onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=R&background=082621&color=26c4b7`; }}
                />
                <div className="flex-1 truncate">
                  <h4 className={`text-xs sm:text-sm font-bold truncate group-hover:text-[#17a398] transition-colors ${
                    isDark ? 'text-white' : 'text-[#0b1110]'
                  }`}>
                    {track.title}
                  </h4>
                  <div className={`text-[11px] truncate font-medium flex items-center gap-1.5 ${
                    isDark ? 'text-zinc-400' : 'text-[#082621]/70'
                  }`}>
                    <ArtistLinks
                      track={track}
                      onSelectArtist={onSelectArtist}
                      linkClassName="hover:underline hover:text-[#17a398] transition-colors cursor-pointer"
                    />
                    {track.album && <span>• {track.album}</span>}
                  </div>
                </div>

                {track.plays > 0 && (
                  <div className="text-right hidden sm:block">
                    <span className={`text-[11px] font-mono font-bold px-2 py-0.5 brutal-border rounded-md ${
                      isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#fdfbf7] text-[#082621] border-black'
                    }`}>
                      {track.plays.toLocaleString()} plays
                    </span>
                  </div>
                )}

                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike(track.id || track._id);
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
            NO TRACKS FOUND FOR THIS ARTIST YET.
          </div>
        )}
      </div>

      {/* ── Artist Bio / About ── */}
      {artist.bio && (
        <div className="bg-[#082621] text-[#fdfbf7] brutal-border-thick brutal-shadow-lg p-6 max-w-3xl rounded-xl">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#26c4b7]/30">
            <h2 className="text-base font-mono font-black uppercase text-[#26c4b7]">ABOUT {artistName}</h2>
          </div>
          <p className="text-xs sm:text-sm text-[#ded2bb] leading-relaxed font-sans font-medium">
            {artist.bio}
          </p>
        </div>
      )}

      {/* Edit Artist Modal for Admins */}
      {isEditModalOpen && (
        <EditArtistModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          artist={artist}
          onSaved={(updated) => {
            setArtist(prev => ({ ...prev, ...updated }));
          }}
          globalTheme={globalTheme}
        />
      )}
    </div>
  );
}
