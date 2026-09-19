import React, { useState, useMemo } from 'react';
import { Heart, Plus, Download, Grid, List, Search, Disc, Music, User, Link2, DownloadCloud, Trash2 } from 'lucide-react';
import { ArtistLinks } from '../utils/artistUtils';
import { isQuranContent } from '../utils/quranUtils';

export default function LibraryScreen({ 
  playlists = [], 
  albums = [],
  tracks = [], 
  likedTrackIds = [],
  currentUser,
  onSelectPlaylist, 
  onSelectArtist,
  onSelectTrack, 
  openCreatePlaylistModal, 
  openImportPlaylistModal, 
  openImportSongModal,
  onDeletePlaylist,
  toggleLike,
  globalTheme = 'dark',
  libraryTitle = 'Your Library'
}) {
  const isDark = globalTheme === 'dark';
  const [filter, setFilter] = useState('all'); // 'all' | 'playlists' | 'albums' | 'downloads'
  const [search, setSearch] = useState('');

  const isQuranMode = libraryTitle?.toLowerCase().includes('quran');

  // Filter out duplicate "Liked Songs" and strictly segregate Quran content
  const safePlaylists = useMemo(() => {
    const list = (playlists || []).filter(item => {
      if (isQuranMode) return isQuranContent(item);
      if (isQuranContent(item)) return false;
      const name = (item.name || '').trim().toLowerCase();
      return name !== 'liked songs' && name !== 'liked prescriptions' && item.id !== 'liked' && !item.isLikedSongs;
    });

    if (!isQuranMode) {
      const likedPl = {
        id: 'liked',
        _id: 'liked',
        name: 'Liked Songs',
        description: 'Your favorite tracks in one place.',
        isLikedSongs: true,
        trackIds: (likedTrackIds || []).map(String),
      };
      return [likedPl, ...list];
    }
    return list;
  }, [playlists, isQuranMode, likedTrackIds]);

  const safeAlbums = useMemo(() => {
    return (albums || []).filter(item => {
      if (isQuranMode) return isQuranContent(item);
      return !isQuranContent(item);
    });
  }, [albums, isQuranMode]);

  const safeTracks = useMemo(() => {
    return (tracks || []).filter(item => {
      if (isQuranMode) return isQuranContent(item);
      return !isQuranContent(item);
    });
  }, [tracks, isQuranMode]);

  const downloadedTracks = safeTracks.filter((t) => t.downloaded);

  const filteredPlaylists = safePlaylists.filter(item => {
    if (!search) return true;
    return item.name && item.name.toLowerCase().includes(search.toLowerCase());
  });

  const filteredAlbums = safeAlbums.filter(item => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (item.name && item.name.toLowerCase().includes(s)) || (item.artist && item.artist.toLowerCase().includes(s));
  });

  return (
    <div 
      className={`flex-1 overflow-y-auto select-none p-4 sm:p-6 transition-colors ${
        isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'
      }`}
      style={{ 
        paddingBottom: 'calc(var(--player-height) + 40px)',
      }}
    >
      {/* ── Library Header ── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h1 className={`text-2xl sm:text-3xl font-display font-black tracking-tight ${
              isDark ? 'text-white' : 'text-[#fdfbf7] drop-shadow-[1.5px_1.5px_0px_#082621]'
            }`}>
              {libraryTitle}
            </h1>
            <span className="text-[10px] font-mono font-bold bg-[#0b1110] text-[#17a398] px-2 py-0.5 rounded-full brutal-border">
              {libraryTitle === 'Quran' ? 'QURAN' : 'LIBRARY'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {openImportSongModal && (
              <button
                onClick={openImportSongModal}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-display font-black brutal-border brutal-shadow-sm brutal-btn cursor-pointer ${
                  isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700' : 'bg-[#fdfbf7] hover:bg-white text-[#0b1110]'
                }`}
                title={isQuranMode ? "Add Surah by Link" : "Add Song by Link"}
              >
                <Link2 size={15} strokeWidth={2.5} className="text-[#17a398]" />
              </button>
            )}

            {openImportPlaylistModal && (
              <button
                onClick={openImportPlaylistModal}
                className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-display font-black brutal-border brutal-shadow-sm brutal-btn cursor-pointer ${
                  isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700' : 'bg-[#fdfbf7] hover:bg-white text-[#0b1110]'
                }`}
                title={isQuranMode ? "Import Quran Playlist" : "Import Playlist"}
              >
                <DownloadCloud size={15} strokeWidth={2.5} className="text-[#17a398]" />
              </button>
            )}

            <button
              onClick={openCreatePlaylistModal}
              className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-display font-black brutal-border brutal-shadow-sm brutal-btn cursor-pointer ${
                isDark ? 'bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] border-zinc-700' : 'bg-[#0b1110] hover:bg-[#082621] text-[#26c4b7]'
              }`}
              title={isQuranMode ? "Create Quran Playlist" : "Create Playlist"}
            >
              <Plus size={16} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Filter Pills + Search */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto">
            {[
              { id: 'all', label: 'All' },
              { id: 'playlists', label: isQuranMode ? 'Quran Playlists' : 'Playlists' },
              { id: 'albums', label: `${isQuranMode ? 'Collections' : 'Albums'} (${safeAlbums.length})` },
              { id: 'downloads', label: isQuranMode ? 'Downloaded Surahs' : 'Downloaded' },
            ].map((f) => {
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition-all brutal-btn ${
                    active
                      ? isDark ? 'bg-amber-400 text-black font-black brutal-border border-zinc-700' : 'bg-[#0b1110] text-[#fdfbf7] brutal-border brutal-shadow-sm'
                      : isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700' : 'bg-[#fdfbf7] text-[#0b1110] brutal-border hover:bg-white'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {/* Search in Library */}
          <div className="relative w-full sm:w-64">
            <Search 
              size={15} 
              className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500" 
              strokeWidth={2.5}
            />
            <input
              type="text"
              placeholder={isQuranMode ? "Search Quran library..." : "Search library..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full text-xs font-bold pl-9 pr-3 py-2 rounded-lg brutal-border focus:outline-none ${
                isDark 
                  ? 'bg-[#141d1b] text-white border-zinc-700 placeholder-zinc-500' 
                  : 'bg-[#fdfbf7] text-[#0b1110] placeholder-zinc-500 border-black'
              }`}
            />
          </div>
        </div>
      </div>

      {/* ── Playlists Section ── */}
      {(filter === 'all' || filter === 'playlists') && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className={`font-display font-black text-xl ${
              isDark ? 'text-white' : 'text-[#fdfbf7] drop-shadow-[1px_1px_0px_#082621]'
            }`}>
              {isQuranMode ? 'Quran Playlists' : 'Playlists'} ({filteredPlaylists.length})
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
            {filteredPlaylists.map((pl, idx) => {
              const count = (pl.trackIds || []).length;
              const colors = ['#1e3a8a', '#f59e0b', '#0f756d', '#dc2626', '#ec4899', '#082621'];
              const color = colors[idx % colors.length];

              return (
                <div
                  key={pl.id || idx}
                  onClick={() => onSelectPlaylist(pl)}
                  className={`rounded-xl brutal-border p-3 flex flex-col justify-between cursor-pointer brutal-shadow hover:brutal-shadow-lg transition brutal-btn group ${
                    isDark ? 'bg-[#141d1b] border-zinc-700 text-white hover:bg-zinc-900' : 'bg-[#fdfbf7] border-black text-[#0b1110] hover:bg-white'
                  }`}
                >
                  <div>
                    <div 
                      className="w-full aspect-square rounded-lg brutal-border mb-2.5 flex items-center justify-center relative overflow-hidden text-white"
                      style={{ backgroundColor: color }}
                    >
                      {pl.isLikedSongs ? (
                        <Heart size={44} fill="currentColor" />
                      ) : pl.cover ? (
                        <img 
                          src={pl.cover} 
                          alt={pl.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <span className="font-display font-black text-4xl">
                          {pl.name ? pl.name[0].toUpperCase() : 'R'}
                        </span>
                      )}
                      <span className="absolute bottom-1 right-1 text-[8px] font-mono font-bold bg-black/70 text-white px-1 rounded">
                        {count} {isQuranMode || isQuranContent(pl) ? (count === 1 ? 'SURAH' : 'SURAHS') : (count === 1 ? 'SONG' : 'SONGS')}
                      </span>
                    </div>

                    <p className={`font-display font-bold text-xs truncate ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
                      {pl.name}
                    </p>
                    <div className="flex items-center justify-between gap-1 mt-0.5">
                      <p className={`text-[10px] font-bold truncate ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        {pl.isLikedSongs ? (isQuranMode ? 'Favorite Surahs' : 'Favorites') : (isQuranMode ? 'Quran Playlist' : 'Playlist')}
                      </p>
                      {!pl.isLikedSongs && onDeletePlaylist && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Are you sure you want to delete the playlist "${pl.name}"?`)) {
                              onDeletePlaylist(pl.id || pl._id);
                            }
                          }}
                          className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-red-100 hover:bg-red-200 text-[#dc2626] brutal-border cursor-pointer shrink-0"
                          title="Delete playlist"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Albums Section ── */}
      {(filter === 'all' || filter === 'albums') && filteredAlbums.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Disc size={18} className="text-amber-400" />
              <h2 className={`font-display font-black text-xl ${
                isDark ? 'text-white' : 'text-[#fdfbf7] drop-shadow-[1px_1px_0px_#082621]'
              }`}>
                {isQuranMode ? 'Collections' : 'Albums'} ({filteredAlbums.length})
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
            {filteredAlbums.map((alb, idx) => {
              const count = (alb.trackIds || []).length;
              return (
                <div
                  key={alb.id || alb._id || idx}
                  onClick={() => onSelectPlaylist(alb)}
                  className={`rounded-xl brutal-border p-3 flex flex-col justify-between cursor-pointer brutal-shadow hover:brutal-shadow-lg transition brutal-btn group ${
                    isDark ? 'bg-[#141d1b] border-zinc-700 text-white hover:bg-zinc-900' : 'bg-[#fdfbf7] border-black text-[#0b1110] hover:bg-white'
                  }`}
                >
                  <div>
                    <div className="w-full aspect-square rounded-lg brutal-border mb-2.5 flex items-center justify-center relative overflow-hidden bg-black/10">
                      <img 
                        src={alb.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600'} 
                        alt={alb.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                        onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600'; }}
                      />
                      <span className="absolute bottom-1 right-1 text-[8px] font-mono font-bold bg-black/70 text-white px-1 rounded">
                        {count} {isQuranMode || isQuranContent(alb) ? (count === 1 ? 'SURAH' : 'SURAHS') : (count === 1 ? 'SONG' : 'SONGS')}
                      </span>
                    </div>

                    <p className={`font-display font-black text-xs truncate group-hover:text-[#17a398] transition-colors ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
                      {alb.name}
                    </p>
                    <ArtistLinks
                      artist={alb.artist}
                      onSelectArtist={onSelectArtist}
                      className={`text-[10px] font-bold truncate block ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
                      linkClassName="hover:underline cursor-pointer"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Downloads Section ── */}
      {(filter === 'all' || filter === 'downloads') && downloadedTracks.length > 0 && (
        <section className="mt-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Download size={18} className={isDark ? "text-[#17a398]" : "text-[#082621]"} strokeWidth={2.5} />
            <h2 className={`font-display font-black text-xl ${
              isDark ? 'text-white' : 'text-[#fdfbf7] drop-shadow-[1px_1px_0px_#082621]'
            }`}>
              {isQuranMode ? 'Downloaded Surahs' : 'Downloaded Songs'} ({downloadedTracks.length})
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {downloadedTracks.map((track) => (
              <div
                key={track.id || track._id}
                onClick={() => onSelectTrack(track, downloadedTracks)}
                className={`flex items-center gap-3 p-3 rounded-xl brutal-border cursor-pointer brutal-shadow-sm hover:brutal-shadow transition brutal-btn ${
                  isDark ? 'bg-[#141d1b] border-zinc-700 text-white hover:bg-zinc-900' : 'bg-[#fdfbf7] border-black text-[#0b1110] hover:bg-white'
                }`}
              >
                <img 
                  src={track.cover} 
                  alt={track.title} 
                  className="w-12 h-12 rounded-lg brutal-border object-cover shrink-0" 
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <div className="flex-1 min-w-0">
                  <p className={`font-display font-bold text-xs truncate ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
                    {track.title}
                  </p>
                  <ArtistLinks
                    track={track}
                    onSelectArtist={onSelectArtist}
                    className={`text-[10px] font-bold truncate block ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
                    linkClassName="hover:underline cursor-pointer"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
