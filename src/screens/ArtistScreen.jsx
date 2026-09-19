import React, { useState, useEffect, useMemo } from 'react';
import { Play, Heart, CheckCircle2, UserPlus, Check, Music2, ArrowLeft, Disc, Layers, Edit, Sparkles, Plus } from 'lucide-react';
import VerifiedBadge from '../components/VerifiedBadge';
import { matchesArtist, ArtistLinks, getCanonicalArtistName, getArtistAliasNote } from '../utils/artistUtils';
import { isUserAdmin } from '../utils/adminUtils';
import { isQuranContent } from '../utils/quranUtils';
import EditArtistModal from '../components/EditArtistModal';
import AddAlbumModal from '../components/AddAlbumModal';
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
  openEditSongModal,
  openEditAlbumModal,
  onAlbumCreated = () => {},
  globalTheme = 'dark' 
}) {
  const isDark = globalTheme === 'dark';
  const { isFollowingArtist, toggleFollowArtist } = useUser();
  const [artist, setArtist] = useState(initialArtist);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddAlbumOpen, setIsAddAlbumOpen] = useState(false);

  useEffect(() => {
    setArtist(initialArtist);
  }, [initialArtist]);

  if (!artist) return null;

  const rawArtistName = (artist.name || artist.artist || (typeof artist === 'string' ? artist : '')).trim();
  const canonicalName = getCanonicalArtistName(rawArtistName);
  const artistName = canonicalName || rawArtistName;
  const artistKey = artistName.toLowerCase();
  const aliasNote = getArtistAliasNote(artistName);

  // Filter artist tracks (case-insensitive, supporting multiple artists per track & aliases)
  const artistTracks = useMemo(() => {
    return (tracks || []).filter((t) => {
      if (!t.artist) return false;
      return matchesArtist(t, artist) || matchesArtist(t, artistName);
    });
  }, [tracks, artist, artistName]);

  const isQuran = Boolean(
    artist?.isQuran ||
    isQuranContent(artist) ||
    (artistTracks.length > 0 && artistTracks.every(t => isQuranContent(t)))
  );

  // Find artist albums strictly from website albums collection (admin created only)
  const artistAlbums = useMemo(() => {
    const albumMap = new Map();

    (albums || []).forEach(a => {
      if (a.artist && (matchesArtist(a, artist) || matchesArtist(a, artistName) || a.artist.trim().toLowerCase() === artistKey)) {
        // Collect all tracks belonging to this album
        const matchingTracks = artistTracks.filter(t => 
          (a.trackIds || []).map(String).includes(String(t.id || t._id)) ||
          (t.album && t.album.toLowerCase().trim() === a.name.toLowerCase().trim())
        );
        const allTrackIds = Array.from(new Set([
          ...(a.trackIds || []).map(String),
          ...matchingTracks.map(t => String(t.id || t._id))
        ]));

        albumMap.set(a.name.toLowerCase().trim(), {
          ...a,
          id: a.id || a._id,
          name: a.name,
          artist: a.artist || artistName,
          trackIds: allTrackIds,
          trackCount: allTrackIds.length,
          cover: a.cover || matchingTracks[0]?.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
          isAlbum: true,
          isPublic: true
        });
      }
    });

    return Array.from(albumMap.values());
  }, [albums, artistTracks, artistKey, artistName, artist]);

  function aIdSafe(name) {
    return 'album-' + encodeURIComponent(name).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  }

  const handleOpenAlbum = (album) => {
    if (!onSelectPlaylist) return;
    const albumTracks = artistTracks.filter(t => t.album && t.album.toLowerCase().trim() === album.name.toLowerCase().trim());
    const albumTrackIds = albumTracks.map(t => String(t.id || t._id));
    const allTrackIds = Array.from(new Set([
      ...albumTrackIds,
      ...(album.trackIds || []).map(String)
    ]));
    const albumPlaylist = {
      ...album,
      id: album.id || aIdSafe(album.name),
      name: album.name,
      artist: artistName,
      cover: album.cover || albumTracks[0]?.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
      trackIds: allTrackIds,
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
                {isQuran ? 'VERIFIED RECITER' : 'VERIFIED ARTIST'}
              </span>
              <VerifiedBadge name={artistName} />
            </div>

            <h1 className={`text-3xl md:text-6xl font-display font-black tracking-tight leading-tight ${
              isDark ? 'text-white' : 'text-[#082621]'
            }`}>
              {artistName}
            </h1>

            {aliasNote && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold bg-[#17a398]/15 text-[#17a398] brutal-border border-[#17a398]/40">
                <Sparkles size={13} className="shrink-0" />
                <span>{aliasNote}</span>
              </div>
            )}

            <div className={`flex flex-wrap items-center justify-center md:justify-start gap-3 mt-3 text-xs font-mono font-bold ${
              isDark ? 'text-zinc-300' : 'text-[#082621]'
            }`}>
              <span className={`px-2 py-0.5 brutal-border rounded-md ${
                isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] border-black'
              }`}>
                {artistTracks.length} {isQuran ? (artistTracks.length === 1 ? 'Surah' : 'Surahs') : (artistTracks.length === 1 ? 'Track' : 'Tracks')}
              </span>
              <span>•</span>
              <span className={`px-2 py-0.5 brutal-border rounded-md ${
                isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] border-black'
              }`}>
                {artistAlbums.length} {isQuran ? (artistAlbums.length === 1 ? 'Collection' : 'Collections') : (artistAlbums.length === 1 ? 'Album' : 'Albums')}
              </span>
              {totalPlays > 0 && (
                <>
                  <span>•</span>
                  <span>{totalPlays.toLocaleString()} {isQuran ? 'Listens' : 'Plays'}</span>
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-center md:justify-start gap-3 mt-6">
              <button 
                onClick={() => artistTracks.length > 0 && onSelectTrack(artistTracks[0], artistTracks)}
                disabled={artistTracks.length === 0}
                className="brutal-btn w-12 h-12 bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] brutal-border-thick brutal-shadow flex items-center justify-center cursor-pointer rounded-xl"
                title={isQuran ? "Play all surahs" : "Play all tracks"}
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
                <>
                  <button
                    onClick={() => setIsAddAlbumOpen(true)}
                    className="brutal-btn flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-black uppercase brutal-border brutal-shadow-sm cursor-pointer rounded-xl bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110]"
                    title={isQuran ? "Admin: Upload Collection for this Reciter" : "Admin: Upload Album for this Artist"}
                  >
                    <Plus size={14} strokeWidth={3} />
                    <span>{isQuran ? 'ADD COLLECTION' : 'ADD ALBUM'}</span>
                  </button>

                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="brutal-btn flex items-center gap-2 px-4 py-2.5 text-xs font-mono font-black uppercase brutal-border brutal-shadow-sm cursor-pointer rounded-xl bg-[#f59e0b] hover:bg-amber-400 text-black"
                    title={isQuran ? "Admin: Edit Reciter Page & Details" : "Admin: Edit Artist Page & Details"}
                  >
                    <Edit size={14} />
                    <span>{isQuran ? 'EDIT RECITER PAGE' : 'EDIT ARTIST PAGE'}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Discography & Albums Section ── */}
      {(artistAlbums.length > 0 || isUserAdmin(currentUser)) && (
        <div className={`brutal-border-thick brutal-shadow-lg p-6 mb-8 rounded-xl ${
          isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#082621]'
        }`}>
          <div className={`flex items-center justify-between pb-3 mb-5 border-b-2 ${
            isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110] text-[#082621]'
          }`}>
            <div className="flex items-center gap-2">
              <Disc size={20} className="text-[#17a398]" />
              <h2 className="text-lg font-mono font-black uppercase">{isQuran ? 'COLLECTIONS / RECITATIONS' : 'DISCOGRAPHY / ALBUMS'}</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`}>
                {artistAlbums.length} {isQuran ? (artistAlbums.length === 1 ? 'COLLECTION' : 'COLLECTIONS') : (artistAlbums.length === 1 ? 'ALBUM' : 'ALBUMS')}
              </span>
              {isUserAdmin(currentUser) && (
                <button
                  onClick={() => setIsAddAlbumOpen(true)}
                  className="brutal-btn flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono font-black uppercase bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border rounded-lg cursor-pointer"
                  title={isQuran ? "Admin: Upload New Collection" : "Admin: Upload New Album"}
                >
                  <Plus size={12} strokeWidth={3} />
                  <span>{isQuran ? 'ADD COLLECTION' : 'ADD ALBUM'}</span>
                </button>
              )}
            </div>
          </div>

          {artistAlbums.length > 0 ? (
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
                    <span className="uppercase font-bold text-[#17a398]">{isQuran ? 'Collection' : 'Album'}</span>
                    {album.trackCount > 0 && (
                      <span>{album.trackCount} {isQuran ? (album.trackCount === 1 ? 'surah' : 'surahs') : (album.trackCount === 1 ? 'song' : 'songs')}</span>
                    )}
                  </div>

                  {isUserAdmin(currentUser) && openEditAlbumModal && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditAlbumModal(album);
                      }}
                      className="w-full mt-2 py-1 px-2 bg-[#f59e0b] hover:bg-amber-400 text-black font-mono text-[10px] font-black uppercase brutal-border rounded-md flex items-center justify-center gap-1 cursor-pointer"
                      title={isQuran ? "Admin: Edit Collection" : "Admin: Edit Album"}
                    >
                      <Edit size={11} />
                      <span>{isQuran ? 'EDIT COLLECTION' : 'EDIT ALBUM'}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className={`p-8 text-center font-mono text-xs rounded-xl brutal-border ${
              isDark ? 'bg-[#182320] border-zinc-700 text-zinc-400' : 'bg-white/60 border-black text-zinc-600'
            }`}>
              <p className="mb-3 font-medium">{isQuran ? 'No official collections added for this reciter yet.' : 'No official albums added for this artist yet.'}</p>
              <button
                onClick={() => setIsAddAlbumOpen(true)}
                className="brutal-btn inline-flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-black uppercase bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border rounded-lg cursor-pointer"
              >
                <Plus size={13} strokeWidth={3} />
                <span>{isQuran ? 'Upload First Collection' : 'Upload First Album'}</span>
              </button>
            </div>
          )}
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
            <h2 className="text-lg font-mono font-black uppercase">{isQuran ? 'ALL SURAHS' : 'ALL SONGS'}</h2>
          </div>
          <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`}>
            {artistTracks.length} {isQuran ? (artistTracks.length === 1 ? 'SURAH' : 'SURAHS') : (artistTracks.length === 1 ? 'TRACK' : 'TRACKS')}
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
                      {track.plays.toLocaleString()} {isQuran ? 'listens' : 'plays'}
                    </span>
                  </div>
                )}

                {isUserAdmin(currentUser) && openEditSongModal && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditSongModal(track);
                    }}
                    className={`p-2 transition-colors cursor-pointer rounded-md ${
                      isDark ? 'text-zinc-400 hover:text-[#17a398]' : 'text-[#0b1110] hover:text-[#17a398]'
                    }`}
                    title={isQuran ? "Admin: Edit Surah" : "Admin: Edit Song"}
                  >
                    <Edit size={15} />
                  </button>
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
            {isQuran ? 'NO SURAHS FOUND FOR THIS RECITER YET.' : 'NO TRACKS FOUND FOR THIS ARTIST YET.'}
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

      {/* Add Album Modal for Admins */}
      {isAddAlbumOpen && (
        <AddAlbumModal
          isOpen={isAddAlbumOpen}
          onClose={() => setIsAddAlbumOpen(false)}
          initialArtistName={artistName}
          artistTracks={artistTracks}
          artistAvatar={artist.headerImage || artist.avatar || artistTracks[0]?.cover}
          onAlbumCreated={(newAlbum, trackIds, newTracks) => {
            if (onAlbumCreated) onAlbumCreated(newAlbum, trackIds, newTracks);
            setIsAddAlbumOpen(false);
          }}
          globalTheme={globalTheme}
        />
      )}
    </div>
  );
}
