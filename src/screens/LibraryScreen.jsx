import React, { useState, useMemo } from 'react';
import { 
  Heart, Plus, Download, Grid, List, Search, Disc, Music, 
  User, Link2, DownloadCloud, Trash2, FolderOpen, BookOpen, Mic, Sparkles 
} from 'lucide-react';
import { ArtistLinks } from '../utils/artistUtils';
import { isQuranContent, cleanQuranTrackTitle, getQuranReciterName } from '../utils/quranUtils';
import { normalizeCoverUrl } from '../utils/coverUtils';
import { isTauriDesktop, openDesktopDownloadsDir } from '../utils/offlineStorage';
import { PODCASTS_AND_AUDIOBOOKS } from '../data/podcastsAndBooks';
import { usePreferences } from '../context/PreferencesContext';

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
  const { showMusic, showQuran, showPodcasts } = usePreferences();
  
  // Vault Mode selector: 'quran' | 'music' | 'podcasts'
  const defaultSection = !showMusic ? 'quran' : (libraryTitle?.toLowerCase().includes('quran') ? 'quran' : 'music');
  const [vaultSection, setVaultSection] = useState(defaultSection);
  const [filter, setFilter] = useState('all'); // 'all' | 'playlists' | 'albums' | 'downloads'
  const [search, setSearch] = useState('');

  // ── 1. QURAN VAULT DATA ──
  const quranPlaylists = useMemo(() => {
    return (playlists || []).filter(isQuranContent);
  }, [playlists]);

  const quranAlbums = useMemo(() => {
    return (albums || []).filter(isQuranContent);
  }, [albums]);

  const quranTracks = useMemo(() => {
    return (tracks || []).filter(isQuranContent);
  }, [tracks]);

  // ── 2. MUSIC VAULT DATA ──
  const musicPlaylists = useMemo(() => {
    const list = (playlists || []).filter(item => {
      if (isQuranContent(item)) return false;
      const name = (item.name || '').trim().toLowerCase();
      return name !== 'liked songs' && name !== 'liked prescriptions' && item.id !== 'liked' && !item.isLikedSongs;
    });

    const likedPl = {
      id: 'liked',
      _id: 'liked',
      name: 'Liked Songs (المفضلة)',
      description: 'أغانيك وقوائمك المفضلة في مكان واحد.',
      isLikedSongs: true,
      trackIds: (likedTrackIds || []).map(String),
    };
    return [likedPl, ...list];
  }, [playlists, likedTrackIds]);

  const musicAlbums = useMemo(() => {
    return (albums || []).filter(item => !isQuranContent(item));
  }, [albums]);

  const musicTracks = useMemo(() => {
    return (tracks || []).filter(item => !isQuranContent(item));
  }, [tracks]);

  // ── 3. PODCASTS & BOOKS VAULT DATA ──
  const podcastItems = useMemo(() => {
    return PODCASTS_AND_AUDIOBOOKS;
  }, []);

  // Determine current active datasets based on vaultSection
  const activePlaylists = useMemo(() => {
    if (vaultSection === 'quran') return quranPlaylists;
    if (vaultSection === 'podcasts') return [];
    return musicPlaylists;
  }, [vaultSection, quranPlaylists, musicPlaylists]);

  const activeAlbums = useMemo(() => {
    if (vaultSection === 'quran') return quranAlbums;
    if (vaultSection === 'podcasts') return [];
    return musicAlbums;
  }, [vaultSection, quranAlbums, musicAlbums]);

  const activeTracks = useMemo(() => {
    if (vaultSection === 'quran') return quranTracks;
    if (vaultSection === 'podcasts') return podcastItems;
    return musicTracks;
  }, [vaultSection, quranTracks, podcastItems, musicTracks]);

  const downloadedTracks = activeTracks.filter((t) => t.downloaded);

  // Search filtering
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
      {/* ── TOP SECTION: VAULT CATEGORY SELECTOR (Quran vs Music vs Podcasts) ── */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-display font-black tracking-tight text-white flex items-center gap-2">
              <span>الخزنة والمكتبة (Vault)</span>
            </h1>
            <p className="text-xs text-emerald-300/70 mt-0.5 font-medium">
              مكتبتك الشخصية المنظمة: تصفح القرآن، الأغاني، والبودكاست في مساحات مستقلة تماماً.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {openImportSongModal && (
              <button
                onClick={openImportSongModal}
                className="px-3 py-1.5 rounded-xl text-xs font-display font-black brutal-border bg-[#0e221d] hover:bg-emerald-500 hover:text-black text-emerald-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="إضافة عنصر برابط"
              >
                <Link2 size={14} />
                <span>+ رابط</span>
              </button>
            )}

            {openImportPlaylistModal && (
              <button
                onClick={openImportPlaylistModal}
                className="px-3 py-1.5 rounded-xl text-xs font-display font-black brutal-border bg-[#0e221d] hover:bg-emerald-500 hover:text-black text-emerald-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                title="استيراد قائمة"
              >
                <DownloadCloud size={14} />
                <span>استيراد</span>
              </button>
            )}

            {openCreatePlaylistModal && vaultSection !== 'podcasts' && (
              <button
                onClick={openCreatePlaylistModal}
                className="px-3.5 py-1.5 rounded-xl text-xs font-display font-black bg-emerald-400 text-black hover:bg-emerald-300 transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Plus size={14} strokeWidth={3} />
                <span>إنشاء قائمة</span>
              </button>
            )}
          </div>
        </div>

        {/* ── 3-WAY VAULT MENU TABS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-1.5 bg-[#050f0d] rounded-2xl border border-emerald-500/25">
          {/* Quran Vault */}
          <button
            onClick={() => { setVaultSection('quran'); setFilter('all'); }}
            className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-xs font-display font-black transition-all cursor-pointer ${
              vaultSection === 'quran'
                ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.35)] scale-[1.02]'
                : 'text-emerald-300/80 hover:text-white hover:bg-emerald-950/40'
            }`}
          >
            <BookOpen size={16} />
            <span>خزنة القرآن الكريم</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${vaultSection === 'quran' ? 'bg-black/20 text-black font-bold' : 'bg-emerald-950 text-emerald-300'}`}>
              {quranTracks.length}
            </span>
          </button>

          {/* Music Vault (if enabled) */}
          {showMusic && (
            <button
              onClick={() => { setVaultSection('music'); setFilter('all'); }}
              className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-xs font-display font-black transition-all cursor-pointer ${
                vaultSection === 'music'
                  ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.35)] scale-[1.02]'
                  : 'text-emerald-300/80 hover:text-white hover:bg-emerald-950/40'
              }`}
            >
              <Music size={16} />
              <span>خزنة الأغاني والموسيقى</span>
              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${vaultSection === 'music' ? 'bg-black/20 text-black font-bold' : 'bg-emerald-950 text-emerald-300'}`}>
                {musicTracks.length}
              </span>
            </button>
          )}

          {/* Podcasts & Books Vault */}
          <button
            onClick={() => { setVaultSection('podcasts'); setFilter('all'); }}
            className={`flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl text-xs font-display font-black transition-all cursor-pointer ${
              vaultSection === 'podcasts'
                ? 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.35)] scale-[1.02]'
                : 'text-emerald-300/80 hover:text-white hover:bg-emerald-950/40'
            }`}
          >
            <Mic size={16} />
            <span>خزنة البودكاست والكتب</span>
            <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${vaultSection === 'podcasts' ? 'bg-black/20 text-black font-bold' : 'bg-emerald-950 text-emerald-300'}`}>
              {podcastItems.length}
            </span>
          </button>
        </div>
      </div>

      {/* ── SUB-FILTER CHIPS & SEARCH ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: 'الكل' },
            ...(vaultSection !== 'podcasts' ? [
              { id: 'playlists', label: vaultSection === 'quran' ? 'المصاحف والقوائم' : 'قوائم التشغيل' },
              { id: 'albums', label: vaultSection === 'quran' ? 'السلاسل' : 'الألبومات' },
            ] : []),
            { id: 'downloads', label: `التنزيلات (${downloadedTracks.length})` }
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
            placeholder="ابحث في الخزنة..."
            className="w-full text-xs font-bold pl-8 pr-3 py-2 rounded-xl bg-[#091714] text-white border border-emerald-900/70 placeholder-emerald-500/40 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* ── VAULT CONTENT DISPLAY ── */}
      {/* 1. PLAYLISTS & ALBUMS GRID (when in all or playlists/albums) */}
      {(filter === 'all' || filter === 'playlists') && filteredPlaylists.length > 0 && (
        <div className="mb-7">
          <h2 className="text-sm font-black font-display text-emerald-300 uppercase tracking-wider mb-3">
            {vaultSection === 'quran' ? 'المصاحف والقوائم القرآنية' : 'قوائم التشغيل'}
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
                      src={pl.cover || 'https://images.unsplash.com/photo-1542816417-0983c9c9ad53?w=400'}
                      alt={pl.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono font-bold text-emerald-300">
                      {count} سورة/مقطع
                    </span>
                  </div>
                  <h3 className="font-bold text-xs truncate text-white group-hover:text-emerald-300">
                    {pl.name}
                  </h3>
                  <p className="text-[10px] text-emerald-300/70 truncate mt-0.5 font-medium">
                    {pl.isLikedSongs ? 'المفضلة' : pl.description || 'قائمة محفوظة'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. TRACKS / EPISODES LIST */}
      {(filter === 'all' || filter === 'downloads') && (
        <div>
          <h2 className="text-sm font-black font-display text-emerald-300 uppercase tracking-wider mb-3">
            {filter === 'downloads' ? 'الملفات المحملة للتشغيل بدون إنترنت' : (vaultSection === 'quran' ? 'التلاوات والسور' : vaultSection === 'podcasts' ? 'الحلقات والكتب المتاحة' : 'الأغاني والمقاطع')}
          </h2>

          {(filter === 'downloads' ? downloadedTracks : filteredTracks).length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-emerald-900/60 bg-[#091714]">
              <Disc size={36} className="mx-auto mb-2 text-emerald-400 opacity-60 animate-spin" />
              <p className="text-xs font-bold text-white mb-1">لا توجد عناصر لعرضها في هذا القسم حالياً</p>
              <p className="text-[11px] text-emerald-300/70">أضف تلاوات أو قوائم جديدة لحفظها داخل الخزنة</p>
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
