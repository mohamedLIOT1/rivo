import React, { useState, useMemo } from 'react';
import { 
  Heart, Plus, Download, Grid, List, Search, Disc, Music, 
  User, Link2, DownloadCloud, Trash2, FolderOpen, BookOpen, ChevronDown, Sparkles 
} from 'lucide-react';
import { isQuranContent } from '../utils/quranUtils';
import { usePreferences, useTranslation } from '../context/PreferencesContext';
import { useMixAutoSync } from '../hooks/useMixAutoSync';
import LibraryMixesSection from '../components/library/LibraryMixesSection';
import LibraryPlaylistsGrid from '../components/library/LibraryPlaylistsGrid';
import LibraryAlbumsGrid from '../components/library/LibraryAlbumsGrid';
import LibraryTracksList from '../components/library/LibraryTracksList';

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
  libraryTitle = 'Your Library',
  initialFilter = 'all'
}) {
  const isDark = globalTheme === 'dark';
  const { showMusic, showQuran } = usePreferences();
  const { isRTL, t } = useTranslation();
  
  // Section selector: 'music' | 'quran'
  const defaultSection = !showMusic ? 'quran' : 'music';
  const [activeSection, setActiveSection] = useState(defaultSection);
  const [filter, setFilter] = useState(initialFilter || 'all'); // 'all' | 'playlists' | 'albums' | 'downloads'
  const [search, setSearch] = useState('');
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

  React.useEffect(() => {
    if (initialFilter) setFilter(initialFilter);
  }, [initialFilter]);

  // ── 1. QURAN DATA ──
  const quranPlaylists = useMemo(() => (playlists || []).filter(isQuranContent), [playlists]);
  const quranAlbums = useMemo(() => (albums || []).filter(isQuranContent), [albums]);
  const quranTracks = useMemo(() => (tracks || []).filter(isQuranContent), [tracks]);

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

    const firstLikedTrack = (tracks || []).find(t => (likedTrackIds || []).map(String).includes(String(t.id || t._id)));
    const likedCover = firstLikedTrack?.cover || 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400';

    const likedPl = {
      id: 'liked',
      _id: 'liked',
      name: isRTL ? 'الأغاني المفضلة' : 'Liked Songs',
      description: isRTL ? 'جميع أغانيك المفضلة في مكان واحد.' : 'Your favorite tracks in one place.',
      cover: likedCover,
      isLikedSongs: true,
      trackIds: (likedTrackIds || []).map(String),
    };
    return [likedPl, ...list];
  }, [playlists, likedTrackIds, tracks, isRTL]);

  const musicAlbums = useMemo(() => (albums || []).filter(item => !isQuranContent(item)), [albums]);
  const musicTracks = useMemo(() => (tracks || []).filter(item => !isQuranContent(item)), [tracks]);

  // Set of all track IDs belonging to user's saved playlists & liked songs
  const savedPlaylistTrackIds = useMemo(() => {
    const ids = new Set();
    (playlists || []).forEach(pl => {
      (pl.trackIds || []).forEach(id => ids.add(String(id)));
    });
    (likedTrackIds || []).forEach(id => ids.add(String(id)));
    return ids;
  }, [playlists, likedTrackIds]);

  const activePlaylists = useMemo(() => {
    if (activeSection === 'quran') return quranPlaylists;
    return musicPlaylists;
  }, [activeSection, quranPlaylists, musicPlaylists]);

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

  const filteredAlbums = useMemo(() => {
    if (!search.trim()) return musicAlbums;
    const s = search.toLowerCase();
    return musicAlbums.filter(a => (a.name && a.name.toLowerCase().includes(s)) || (a.artist && a.artist.toLowerCase().includes(s)));
  }, [musicAlbums, search]);

  const filteredPlaylists = activePlaylists.filter(item => {
    if (!search) return true;
    return item.name && item.name.toLowerCase().includes(search.toLowerCase());
  });

  const filteredTracks = activeTracks.filter(item => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (item.title && item.title.toLowerCase().includes(s)) || (item.artist && item.artist.toLowerCase().includes(s));
  });

  return (
    <div 
      className={`flex-1 overflow-y-auto select-none p-4 sm:p-6 transition-colors ${
        isDark ? 'bg-[#081210] text-[#fdfbf7]' : 'bg-[#fdfbf7] text-[#082621]'
      }`}
      style={{ 
        paddingBottom: 'calc(var(--player-height) + 50px)',
      }}
    >
      {/* ── TOP SECTION: HEADER & ACTIONS ── */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className={`text-2xl sm:text-3xl font-display font-black tracking-tight flex items-center gap-2 transition-colors ${
              isDark ? 'text-white' : 'text-[#082621]'
            } ${isRTL ? 'font-sans' : ''}`}>
              <span>{isRTL ? 'مكتبتك الصوتية' : (libraryTitle || 'Your Library')}</span>
            </h1>
            <p className={`text-xs mt-0.5 font-medium transition-colors ${
              isDark ? 'text-emerald-300/70' : 'text-[#082621]/70'
            }`}>
              {isRTL
                ? 'مكتبتك الشخصية المنظمة: قوائم التشغيل، الأغاني المحفوظة، والتلاوات المفضلة.'
                : 'Your organized personal library: playlists, saved songs, and favorite recitations.'}
            </p>
          </div>

          {/* Quick Actions Menu */}
          <div className="flex items-center gap-2 shrink-0 relative">
            {openCreatePlaylistModal && (
              <button
                onClick={openCreatePlaylistModal}
                className="px-3.5 py-1.5 rounded-xl text-xs font-display font-black bg-[#17a398] text-[#0b1110] hover:bg-[#26c4b7] transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus size={14} strokeWidth={3} />
                <span>{isRTL ? 'قائمة جديدة' : 'New Playlist'}</span>
              </button>
            )}

            {/* Consolidated "+ Add / Import" Menu */}
            <div className="relative">
              <button
                onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                className={`px-3 py-1.5 rounded-xl text-xs font-display font-black brutal-border transition-colors flex items-center gap-1.5 cursor-pointer ${
                  isDark
                    ? 'bg-[#0e221d] hover:bg-emerald-500 hover:text-black text-emerald-300 border-zinc-700'
                    : 'bg-[#ede5d3] hover:bg-[#ded2bb] text-[#082621] border-[#0b1110]'
                }`}
              >
                <Plus size={14} />
                <span>{isRTL ? 'إضافة / استيراد' : 'Add / Import'}</span>
                <ChevronDown size={13} className={`transition-transform ${isAddMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {isAddMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsAddMenuOpen(false)} 
                  />
                  <div className={`absolute ${isRTL ? 'left-0' : 'right-0'} mt-1.5 w-52 rounded-xl shadow-2xl p-1.5 z-50 text-xs font-medium space-y-0.5 border ${
                    isDark 
                      ? 'bg-[#091714] border-emerald-500/40 text-emerald-200' 
                      : 'bg-[#fdfbf7] border-[#0b1110] text-[#082621]'
                  }`}>
                    {openAddSongModal && (
                      <button
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          openAddSongModal();
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-left cursor-pointer ${
                          isDark 
                            ? 'text-emerald-200 hover:bg-emerald-500 hover:text-black' 
                            : 'text-[#082621] hover:bg-[#ede5d3] hover:text-[#0b1110]'
                        }`}
                      >
                        <Search size={14} />
                        <span>{isRTL ? 'بحث وإضافة أغنية' : 'Search & Add Song'}</span>
                      </button>
                    )}
                    {(openImportSongModal || openImportPlaylistModal) && (
                      <button
                        onClick={() => {
                          setIsAddMenuOpen(false);
                          if (openImportSongModal) openImportSongModal();
                          else if (openImportPlaylistModal) openImportPlaylistModal();
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors text-left cursor-pointer ${
                          isDark 
                            ? 'text-emerald-200 hover:bg-emerald-500 hover:text-black' 
                            : 'text-[#082621] hover:bg-[#ede5d3] hover:text-[#0b1110]'
                        }`}
                      >
                        <Link2 size={14} />
                        <span>{isRTL ? 'استيراد عبر الرابط (مقطع أو قائمة)' : 'Import by Link (Track / Playlist)'}</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── SECTION TABS (Music Library vs Quran Library) ── */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-1.5 rounded-2xl border transition-colors ${
          isDark ? 'bg-[#050f0d] border-emerald-500/25' : 'bg-[#ede5d3] border-[#0b1110]'
        }`}>
          {showMusic && (
            <button
              onClick={() => { setActiveSection('music'); setFilter('all'); }}
              className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-xs font-display font-black transition-all cursor-pointer ${
                activeSection === 'music'
                  ? (isDark 
                      ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.35)] scale-[1.01]' 
                      : 'bg-[#082621] text-[#26c4b7] shadow-sm scale-[1.01]')
                  : (isDark 
                      ? 'text-emerald-300/80 hover:text-white hover:bg-emerald-950/40' 
                      : 'text-[#082621]/70 hover:text-[#082621] hover:bg-white/60')
              }`}
            >
              <Music size={16} />
              <span>{isRTL ? 'مكتبة الموسيقى' : 'Music Library'}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeSection === 'music' 
                  ? (isDark ? 'bg-black/20 text-black' : 'bg-[#26c4b7]/20 text-[#26c4b7]') 
                  : (isDark ? 'bg-emerald-950 text-emerald-300' : 'bg-[#0b1110]/10 text-[#082621]')
              }`}>
                {activeTracks.length} {isRTL ? 'مقطع' : 'tracks'}
              </span>
            </button>
          )}

          {showQuran && (
            <button
              onClick={() => { setActiveSection('quran'); setFilter('all'); }}
              className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-xs font-display font-black transition-all cursor-pointer ${
                activeSection === 'quran'
                  ? (isDark 
                      ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.35)] scale-[1.01]' 
                      : 'bg-[#082621] text-[#26c4b7] shadow-sm scale-[1.01]')
                  : (isDark 
                      ? 'text-emerald-300/80 hover:text-white hover:bg-emerald-950/40' 
                      : 'text-[#082621]/70 hover:text-[#082621] hover:bg-white/60')
              }`}
            >
              <BookOpen size={16} />
              <span>{isRTL ? 'المكتبة القرآنية' : 'Quran Library'}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeSection === 'quran' 
                  ? (isDark ? 'bg-black/20 text-black' : 'bg-[#26c4b7]/20 text-[#26c4b7]') 
                  : (isDark ? 'bg-emerald-950 text-emerald-300' : 'bg-[#0b1110]/10 text-[#082621]')
              }`}>
                {quranTracks.length} {isRTL ? 'تلاوة' : 'recitations'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ── SUB-FILTER CHIPS & SEARCH ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: isRTL ? 'الكل' : 'All' },
            { id: 'playlists', label: activeSection === 'quran' ? (isRTL ? 'السور والمصاحف' : 'Surahs & Playlists') : (isRTL ? 'قوائم التشغيل' : 'Playlists') },
            ...(activeSection === 'music' ? [{ id: 'albums', label: isRTL ? `الألبومات (${musicAlbums.length})` : `Albums (${musicAlbums.length})` }] : []),
            { id: 'downloads', label: isRTL ? `التنزيلات (${downloadedTracks.length})` : `Downloads (${downloadedTracks.length})` }
          ].map(chip => {
            const active = filter === chip.id;
            return (
              <button
                key={chip.id}
                onClick={() => setFilter(chip.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-display font-black transition-colors cursor-pointer ${
                  active
                    ? (isDark ? 'bg-emerald-400 text-black shadow-sm' : 'bg-[#082621] text-[#26c4b7] shadow-sm')
                    : (isDark 
                        ? 'bg-[#0b1c18] text-emerald-200/80 border border-emerald-900/60 hover:bg-[#0f2621]' 
                        : 'bg-[#ede5d3] text-[#082621] border border-[#0b1110] hover:bg-[#ded2bb]')
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search size={14} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${
            isDark ? 'text-emerald-400/60' : 'text-[#082621]/60'
          }`} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={isRTL ? 'ابحث في مكتبتك...' : 'Search in library...'}
            className={`w-full text-xs font-bold ${isRTL ? 'pr-8 pl-3 text-right' : 'pl-8 pr-3'} py-2 rounded-xl transition-colors focus:outline-none ${
              isDark 
                ? 'bg-[#091714] text-white border border-emerald-900/70 placeholder-emerald-500/40 focus:border-emerald-500' 
                : 'bg-[#ede5d3] text-[#082621] border border-[#0b1110] placeholder-[#082621]/40 focus:bg-white focus:border-[#082621]'
            }`}
          />
        </div>
      </div>

      {/* ── 0. DJ MIXES SECTION ── */}
      {(filter === 'all' || filter === 'playlists') && activeSection === 'music' && (
        <LibraryMixesSection
          mixPlaylists={filteredMixPlaylists}
          tracks={tracks}
          isDark={isDark}
          isRTL={isRTL}
          onSelectPlaylist={onSelectPlaylist}
        />
      )}

      {/* ── 1. PLAYLISTS GRID ── */}
      {(filter === 'all' || filter === 'playlists') && (
        <LibraryPlaylistsGrid
          playlists={filteredPlaylists}
          activeSection={activeSection}
          isDark={isDark}
          isRTL={isRTL}
          onSelectPlaylist={onSelectPlaylist}
        />
      )}

      {/* ── 2. ALBUMS GRID (MUSIC ONLY) ── */}
      {(filter === 'all' || filter === 'albums') && activeSection === 'music' && (
        <LibraryAlbumsGrid
          albums={filteredAlbums}
          isDark={isDark}
          isRTL={isRTL}
          onSelectPlaylist={onSelectPlaylist}
        />
      )}

      {/* ── 2. TRACKS LIST ── */}
      {(filter === 'all' || filter === 'downloads') && (
        <LibraryTracksList
          tracks={filter === 'downloads' ? downloadedTracks : filteredTracks}
          filter={filter}
          activeSection={activeSection}
          isDark={isDark}
          isRTL={isRTL}
          onSelectTrack={onSelectTrack}
          toggleLike={toggleLike}
        />
      )}
    </div>
  );
}
