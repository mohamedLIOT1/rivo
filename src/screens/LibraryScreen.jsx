import React, { useState, useMemo } from 'react';
import { 
  Heart, Plus, Download, Grid, List, Search, Disc, Music, 
  User, Link2, DownloadCloud, Trash2, FolderOpen, BookOpen, ChevronDown, Sparkles 
} from 'lucide-react';
import { isQuranContent } from '../utils/quranUtils';
import { usePreferences } from '../context/PreferencesContext';
import { useMixAutoSync } from '../hooks/useMixAutoSync';

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
  openAddSongModal,
  onDeletePlaylist, 
  toggleLike, 
  globalTheme = 'dark', 
  libraryTitle = 'Your Library' 
}) {
  const isDark = globalTheme === 'dark';
  const { showMusic, showQuran } = usePreferences();
  
  // Section selector: 'music' | 'quran'
  const defaultSection = !showMusic ? 'quran' : 'music';
  const [activeSection, setActiveSection] = useState(defaultSection);
  const [filter, setFilter] = useState('all'); // 'all' | 'playlists' | 'albums' | 'downloads'
  const [search, setSearch] = useState('');
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  // ── 1. QURAN DATA ──
  const quranPlaylists = useMemo(() => {
    return (playlists || []).filter(isQuranContent);
  }, [playlists]);

  const quranAlbums = useMemo(() => {
    return (albums || []).filter(isQuranContent);
  }, [albums]);

  const quranTracks = useMemo(() => {
    return (tracks || []).filter(isQuranContent);
  }, [tracks]);

  // ── 2. MUSIC DATA ──
  const mixPlaylists = useMemo(() => {
    if (activeSection === 'quran') return [];
    return (playlists || []).filter(item => {
      if (isQuranContent(item)) return false;
      return Boolean(item.isMix || (item.name && item.name.toUpperCase().includes('MIX')));
    });
  }, [playlists, activeSection]);

  // Auto-sync newly added tracks for consented mixes
  useMixAutoSync(mixPlaylists, tracks);

  const musicPlaylists = useMemo(() => {
    const list = (playlists || []).filter(item => {
      if (isQuranContent(item)) return false;
      const name = (item.name || '').trim().toLowerCase();
      if (name === 'liked songs' || name === 'liked prescriptions' || item.id === 'liked' || item.isLikedSongs) return false;
      if (item.isMix || item.name?.toUpperCase()?.includes('MIX')) return false;
      return true;
    });

    // First liked song cover if available, otherwise high-quality music favorites artwork
    const firstLikedTrack = (tracks || []).find(t => (likedTrackIds || []).map(String).includes(String(t.id || t._id)));
    const likedCover = firstLikedTrack?.cover || 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400';

    const likedPl = {
      id: 'liked',
      _id: 'liked',
      name: 'Liked Songs',
      description: 'Your favorite tracks in one place.',
      cover: likedCover,
      isLikedSongs: true,
      trackIds: (likedTrackIds || []).map(String),
    };
    return [likedPl, ...list];
  }, [playlists, likedTrackIds, tracks]);

  const musicAlbums = useMemo(() => {
    return (albums || []).filter(item => !isQuranContent(item));
  }, [albums]);

  const musicTracks = useMemo(() => {
    return (tracks || []).filter(item => !isQuranContent(item));
  }, [tracks]);

  // Set of all track IDs that actually belong to the user's saved playlists and liked tracks
  const savedPlaylistTrackIds = useMemo(() => {
    const ids = new Set();
    (playlists || []).forEach(pl => {
      (pl.trackIds || []).forEach(id => ids.add(String(id)));
    });
    (likedTrackIds || []).forEach(id => ids.add(String(id)));
    return ids;
  }, [playlists, likedTrackIds]);

  // Determine current active datasets based on activeSection
  const activePlaylists = useMemo(() => {
    if (activeSection === 'quran') return quranPlaylists;
    return musicPlaylists;
  }, [activeSection, quranPlaylists, musicPlaylists]);

  const activeAlbums = useMemo(() => {
    if (activeSection === 'quran') return quranAlbums;
    return musicAlbums;
  }, [activeSection, quranAlbums, musicAlbums]);

  // ONLY show songs that are saved in playlists or liked, NOT the whole database
  const activeTracks = useMemo(() => {
    if (activeSection === 'quran') return quranTracks;
    return musicTracks.filter(t => savedPlaylistTrackIds.has(String(t.id || t._id)));
  }, [activeSection, quranTracks, musicTracks, savedPlaylistTrackIds]);

  const downloadedTracks = activeTracks.filter((t) => t.downloaded);

  // Search filtering
  const filteredMixPlaylists = useMemo(() => {
    if (!search) return mixPlaylists;
    const s = search.toLowerCase();
    return mixPlaylists.filter(item => item.name && item.name.toLowerCase().includes(s));
  }, [mixPlaylists, search]);

  const filteredPlaylists = activePlaylists.filter(item => {
    if (!search) return true;
    return item.name && item.name.toLowerCase().includes(search.toLowerCase());
  });

  const filteredAlbums = activeAlbums.filter(item => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (item.name && item.name.toLowerCase().includes(s)) || (item.artist && item.artist.toLowerCase().includes(s));
  });

  const filteredTracks = activeTracks.filter(item => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (item.title && item.title.toLowerCase().includes(s)) || (item.artist && item.artist.toLowerCase().includes(s));
  });

  return (
    <div 
      className={`flex-1 overflow-y-auto select-none p-4 sm:p-6 ${
        isDark ? 'bg-[#081210] text-[#fdfbf7]' : 'bg-[#eef8f6] text-[#081210]'
      }`}
      style={{ 
        paddingBottom: 'calc(var(--player-height) + 50px)',
      }}
    >
      {/* ── TOP SECTION: HEADER & ACTIONS ── */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-white flex items-center gap-2">
              <span>Your Library</span>
            </h1>
            <p className="text-xs text-emerald-300/70 mt-0.5 font-medium">
              Your organized personal library: playlists, saved songs, and favorite recitations.
            </p>
          </div>

          {/* Quick Actions Menu */}
          <div className="flex items-center gap-2 shrink-0 relative">
            {openCreatePlaylistModal && (
              <button
                onClick={openCreatePlaylistModal}
                className="px-3.5 py-1.5 rounded-xl text-xs font-display font-black bg-emerald-400 text-black hover:bg-emerald-300 transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus size={14} strokeWidth={3} />
                <span>New Playlist</span>
              </button>
            )}

            {/* Consolidated "+ Add / Import" Menu */}
            <div className="relative">
              <button
                onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                className="px-3 py-1.5 rounded-xl text-xs font-display font-black brutal-border bg-[#0e221d] hover:bg-emerald-500 hover:text-black text-emerald-300 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} />
                <span>Add / Import</span>
                <ChevronDown size={13} className={`transition-transform ${isAddMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isAddMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsAddMenuOpen(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-56 rounded-xl bg-[#0c1e19] border border-emerald-500/30 shadow-2xl p-1.5 z-50 text-xs font-display font-bold">
                    {openAddSongModal && (
                      <button
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          openAddSongModal();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-emerald-200 hover:bg-emerald-500 hover:text-black transition-colors text-left cursor-pointer"
                      >
                        <Search size={14} />
                        <span>Search & Add Song</span>
                      </button>
                    )}
                    {openImportSongModal && (
                      <button
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          openImportSongModal();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-emerald-200 hover:bg-emerald-500 hover:text-black transition-colors text-left cursor-pointer"
                      >
                        <Link2 size={14} />
                        <span>Import Track by Link</span>
                      </button>
                    )}
                    {openImportPlaylistModal && (
                      <button
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          openImportPlaylistModal();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-emerald-200 hover:bg-emerald-500 hover:text-black transition-colors text-left cursor-pointer"
                      >
                        <DownloadCloud size={14} />
                        <span>Import Playlist by Link</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── SECTION TABS (Music Library vs Quran Library) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-1.5 bg-[#050f0d] rounded-2xl border border-emerald-500/25">
          {/* Music Library */}
          {showMusic && (
            <button
              onClick={() => { setActiveSection('music'); setFilter('all'); }}
              className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-xs font-display font-black transition-all cursor-pointer ${
                activeSection === 'music'
                  ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.35)] scale-[1.01]'
                  : 'text-emerald-300/80 hover:text-white hover:bg-emerald-950/40'
              }`}
            >
              <Music size={16} />
              <span>Music Library</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${activeSection === 'music' ? 'bg-black/20 text-black font-bold' : 'bg-emerald-950 text-emerald-300'}`}>
                {activeTracks.length} tracks
              </span>
            </button>
          )}

          {/* Quran Library */}
          {showQuran && (
            <button
              onClick={() => { setActiveSection('quran'); setFilter('all'); }}
              className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-xs font-display font-black transition-all cursor-pointer ${
                activeSection === 'quran'
                  ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.35)] scale-[1.01]'
                  : 'text-emerald-300/80 hover:text-white hover:bg-emerald-950/40'
              }`}
            >
              <BookOpen size={16} />
              <span>Quran Library</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${activeSection === 'quran' ? 'bg-black/20 text-black font-bold' : 'bg-emerald-950 text-emerald-300'}`}>
                {quranTracks.length} recitations
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── SUB-FILTER CHIPS & SEARCH ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'All' },
            { id: 'playlists', label: activeSection === 'quran' ? 'Surahs & Playlists' : 'Playlists' },
            ...(activeSection === 'music' ? [
              { id: 'albums', label: 'Albums' },
            ] : []),
            { id: 'downloads', label: `Downloads (${downloadedTracks.length})` }
          ].map(chip => {
            const active = filter === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setFilter(chip.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-display font-black transition-colors cursor-pointer ${
                  active
                    ? 'bg-emerald-400 text-black shadow-sm'
                    : 'bg-[#0b1c18] text-emerald-200/80 border border-emerald-900/60 hover:bg-[#0f2621]'
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400/60 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search in library..."
            className="w-full text-xs font-bold pl-8 pr-3 py-2 rounded-xl bg-[#091714] text-white border border-emerald-900/70 placeholder-emerald-500/40 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* ── LIBRARY CONTENT DISPLAY ── */}
      {/* 0. YOUR DJ MIXES SECTION */}
      {(filter === 'all' || filter === 'playlists') && activeSection === 'music' && filteredMixPlaylists.length > 0 && (
        <div className="mb-7">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">🎛️</span>
            <h2 className="text-sm font-black font-display text-[#17a398] uppercase tracking-wider">
              YOUR MIXES
            </h2>
            <span className="text-[10px] font-mono bg-[#17a398]/20 text-[#17a398] px-2 py-0.5 rounded-full font-bold">
              {filteredMixPlaylists.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredMixPlaylists.map(mix => {
              const mixTrackIds = (mix.trackIds || []).map(String);
              const mixTracks = tracks.filter(t => mixTrackIds.includes(String(t.id || t._id)));
              const notDownloaded = mixTracks.filter(t => !t.downloaded).length;
              const isAllDownloaded = notDownloaded === 0 && mixTracks.length > 0;
              return (
                <div
                  key={mix.id || mix._id}
                  onClick={() => onSelectPlaylist(mix)}
                  className={`group p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-3 brutal-shadow-sm hover:scale-[1.02] ${
                    isDark ? 'bg-[#091714]' : 'bg-[#fdfbf7]'
                  } ${
                    notDownloaded > 0
                      ? 'border-[#f59e0b] hover:border-amber-400'
                      : 'border-[#17a398] hover:border-emerald-400'
                  }`}
                >
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-black/40 border border-[#17a398]/30">
                    <img
                      src={mix.cover || (mixTracks[0] ? mixTracks[0].cover : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400')}
                      alt={mix.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <span className="absolute bottom-1 right-1 text-[8px] font-mono font-black bg-black/80 text-[#17a398] px-1 rounded">
                      🎛️
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-bold text-xs sm:text-sm truncate text-white group-hover:text-[#17a398]">
                        {mix.name}
                      </h3>
                      <span className="text-[8px] font-mono font-black bg-[#17a398] text-[#0b1110] px-1 py-0.2 rounded shrink-0">
                        MIX
                      </span>
                    </div>
                    <div className="text-[10px] font-mono mt-1 flex items-center gap-1.5">
                      {isAllDownloaded ? (
                        <span className="text-[#17a398] font-bold flex items-center gap-1">
                          <span>✓</span> ALL DOWNLOADED
                        </span>
                      ) : notDownloaded > 0 ? (
                        <span className="text-[#f59e0b] font-bold flex items-center gap-1">
                          <span>⬇</span> {notDownloaded} songs not downloaded
                        </span>
                      ) : (
                        <span className="text-zinc-400">
                          {mixTracks.length} tracks
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 1. PLAYLISTS & ALBUMS GRID */}
      {(filter === 'all' || filter === 'playlists') && filteredPlaylists.length > 0 && (
        <div className="mb-7">
          <h2 className="text-sm font-black font-display text-emerald-300 uppercase tracking-wider mb-3">
            {activeSection === 'quran' ? 'Quran Playlists & Mushafs' : 'Playlists'}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
            {filteredPlaylists.map(pl => {
              const count = (pl.trackIds || []).length;
              return (
                <div
                  key={pl.id || pl._id}
                  onClick={() => onSelectPlaylist(pl)}
                  className="group p-3 rounded-xl border border-emerald-950/70 bg-[#091714] hover:bg-[#0d221d] hover:border-emerald-500/40 transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-2.5 bg-black/40 border border-emerald-900/40">
                    <img
                      src={pl.cover || (pl.isLikedSongs ? 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400' : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400')}
                      alt={pl.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono font-bold text-emerald-300">
                      {count} {count === 1 ? 'track' : 'tracks'}
                    </span>
                  </div>
                  <h3 className="font-bold text-xs truncate text-white group-hover:text-emerald-300">
                    {pl.name}
                  </h3>
                  <p className="text-[10px] text-emerald-300/70 truncate mt-0.5 font-medium">
                    {pl.isLikedSongs ? 'Favorites' : pl.description || 'Saved Playlist'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. TRACKS LIST (Only showing playlist & liked tracks) */}
      {(filter === 'all' || filter === 'downloads') && (
        <div>
          <h2 className="text-sm font-black font-display text-emerald-300 uppercase tracking-wider mb-3">
            {filter === 'downloads' 
              ? 'Offline Downloaded Tracks' 
              : (activeSection === 'quran' ? 'Saved Recitations' : 'Saved Playlist Tracks')}
          </h2>

          {(filter === 'downloads' ? downloadedTracks : filteredTracks).length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-emerald-900/60 bg-[#091714]">
              <Disc size={36} className="mx-auto mb-2 text-emerald-400 opacity-60" />
              <p className="text-xs font-bold text-white mb-1">No saved tracks in this section yet</p>
              <p className="text-[11px] text-emerald-300/70">Like songs or add them to playlists to organize them in your library</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {(filter === 'downloads' ? downloadedTracks : filteredTracks).slice(0, 50).map((t, idx) => (
                <div
                  key={t.id || t._id || idx}
                  onClick={() => onSelectTrack && onSelectTrack(t, filteredTracks)}
                  className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl border border-emerald-950/60 bg-[#091714] hover:bg-[#0c201b] hover:border-emerald-500/40 transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono font-bold text-emerald-500/60 w-5 text-center">
                      {idx + 1}
                    </span>
                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-emerald-900/40 bg-black/30">
                      <img src={t.cover} alt={t.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold truncate text-white group-hover:text-emerald-300">
                        {t.title}
                      </h4>
                      <p className="text-[11px] text-emerald-300/70 truncate mt-0.5">
                        {t.artist}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {toggleLike && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(t.id || t._id);
                        }}
                        className="p-1 text-zinc-500 hover:text-red-500 cursor-pointer"
                      >
                        <Heart size={15} />
                      </button>
                    )}
                    <span className="text-[10px] font-mono text-emerald-400/70 hidden sm:inline">
                      {t.album || ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
