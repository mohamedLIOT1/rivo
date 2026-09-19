import React, { useState, useMemo } from 'react';
import { 
  Play, Pause, Plus, Heart, Search, BookOpen, DownloadCloud, 
  Link2, Disc, User, Check, Sparkles, Volume2 
} from 'lucide-react';
import { 
  isQuranContent, 
  getQuranReciterName, 
  cleanQuranTrackTitle, 
  normalizeArabicText 
} from '../utils/quranUtils';

export default function QuranScreen({
  tracks = [],
  playlists = [],
  onSelectTrack,
  onSelectPlaylist,
  onSelectArtist,
  toggleLike,
  openCreatePlaylistModal,
  openImportPlaylistModal,
  openImportSongModal,
  openAddSongModal,
  currentTrack,
  isPlaying,
  globalTheme = 'dark',
}) {
  const isDark = globalTheme === 'dark';
  const [activeTab, setActiveTab] = useState('surahs'); // 'surahs' | 'playlists' | 'reciters'
  const [searchQuery, setSearchQuery] = useState('');

  // Strictly filter only Quranic tracks & playlists
  const quranTracks = useMemo(() => {
    return (tracks || []).filter(isQuranContent);
  }, [tracks]);

  const quranPlaylists = useMemo(() => {
    return (playlists || []).filter(isQuranContent);
  }, [playlists]);

  // Extract unique reciters using smart Arabic name detection
  const reciters = useMemo(() => {
    const map = new Map();
    quranTracks.forEach(t => {
      const name = getQuranReciterName(t, quranPlaylists);
      if (!map.has(name)) {
        map.set(name, { 
          name, 
          count: 0, 
          cover: t.cover,
          searchKey: name
        });
      }
      const item = map.get(name);
      item.count += 1;
      if (!item.cover && t.cover) {
        item.cover = t.cover;
      }
    });

    // Also check playlists if any playlist has a reciter not yet in tracks
    quranPlaylists.forEach(pl => {
      const plReciter = getQuranReciterName(pl, quranPlaylists);
      if (!map.has(plReciter) && plReciter !== 'تلاوات قرآنية' && plReciter !== 'قارئ غير معروف') {
        map.set(plReciter, {
          name: plReciter,
          count: (pl.trackIds || []).length || 1,
          cover: pl.cover,
          searchKey: plReciter
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [quranTracks, quranPlaylists]);

  // Search filter
  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return quranTracks;
    const q = searchQuery.toLowerCase().trim();
    const normQ = normalizeArabicText(q);

    return quranTracks.filter(t => {
      const reciter = getQuranReciterName(t, quranPlaylists);
      const title = t.title || '';
      const artist = t.artist || '';
      const album = t.album || '';

      const combined = `${title} ${artist} ${album} ${reciter}`;
      const normCombined = normalizeArabicText(combined);

      return normCombined.includes(normQ) || combined.toLowerCase().includes(q);
    });
  }, [quranTracks, quranPlaylists, searchQuery]);

  const filteredPlaylists = useMemo(() => {
    if (!searchQuery.trim()) return quranPlaylists;
    const q = searchQuery.toLowerCase().trim();
    const normQ = normalizeArabicText(q);

    return quranPlaylists.filter(p => {
      const reciter = getQuranReciterName(p, quranPlaylists);
      const name = p.name || '';
      const desc = p.description || '';

      const combined = `${name} ${desc} ${reciter}`;
      const normCombined = normalizeArabicText(combined);

      return normCombined.includes(normQ) || combined.toLowerCase().includes(q);
    });
  }, [quranPlaylists, searchQuery]);

  const isTrackActive = (t) => {
    if (!currentTrack || !t) return false;
    const curId = currentTrack.id || currentTrack._id;
    const tId = t.id || t._id;
    return Boolean(curId && tId && String(curId) === String(tId));
  };

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div 
      className={`flex-1 overflow-y-auto select-none p-4 sm:p-6 transition-colors ${
        isDark ? 'bg-[#081715] text-[#fdfbf7]' : 'bg-[#0f4c45] text-[#fdfbf7]'
      }`}
      style={{ paddingBottom: 'calc(var(--player-height) + 40px)' }}
    >
      {/* ── Quran Hero Banner ── */}
      <section className="mb-6 bg-[#041d1a] rounded-2xl brutal-border-thick p-5 sm:p-7 text-[#fdfbf7] brutal-shadow-teal relative overflow-hidden border-[#17a398]">
        {/* Subtle Calligraphy/Watermark */}
        <div className="absolute -right-4 -bottom-6 opacity-10 text-white font-serif font-black text-8xl sm:text-9xl select-none pointer-events-none tracking-tighter">
          قرآن
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="max-w-xl text-left">
            <div className="inline-flex items-center gap-2 bg-[#17a398] text-[#041d1a] px-3 py-0.5 rounded-full brutal-border text-[11px] font-mono font-black mb-2.5 shadow-sm">
              <BookOpen size={14} />
              <span>القرآن الكريم • THE HOLY QURAN</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black font-display leading-tight mb-2 text-white">
              تلاوات خاشعة <span className="text-[#26c4b7]">ومصاحف كاملة</span>
            </h1>

            <p className="text-emerald-100/90 text-xs sm:text-sm font-medium leading-relaxed mb-4">
              استمع للمصاحف المرتلة والمجودة لكبار القراء بأعلى نقاوة صوتية وبدون أي إعلانات، مع دعم كامل لكافة السور والأجزاء بدون حدود.
            </p>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              {filteredTracks.length > 0 && (
                <button
                  onClick={() => onSelectTrack(filteredTracks[0])}
                  className="bg-[#26c4b7] hover:bg-[#17a398] text-[#041d1a] font-display font-black text-xs sm:text-sm px-4 py-2 rounded-xl brutal-border brutal-shadow-sm brutal-btn flex items-center gap-2 cursor-pointer transition-all"
                >
                  <Play size={15} fill="currentColor" />
                  <span>تشغيل الكل ({filteredTracks.length} تلاوة)</span>
                </button>
              )}

              {openImportPlaylistModal && (
                <button
                  onClick={openImportPlaylistModal}
                  className="bg-[#fdfbf7] hover:bg-white text-[#0b1110] font-display font-bold text-xs px-3.5 py-2 rounded-xl brutal-border brutal-shadow-sm brutal-btn flex items-center gap-1.5 cursor-pointer"
                  title="استيراد مصحف كامل أو قائمة سور من يوتيوب أو سبوتيفاي"
                >
                  <DownloadCloud size={15} strokeWidth={2.5} className="text-[#0f756d]" />
                  <span>استيراد مصحف / قائمة</span>
                </button>
              )}

              {openImportSongModal && (
                <button
                  onClick={openImportSongModal}
                  className="bg-[#0b1110] hover:bg-zinc-900 text-emerald-300 font-display font-bold text-xs px-3.5 py-2 rounded-xl brutal-border border-[#17a398] brutal-btn flex items-center gap-1.5 cursor-pointer"
                  title="إضافة تلاوة سورة برابط مباشر"
                >
                  <Link2 size={15} strokeWidth={2.5} />
                  <span>+ إضافة سورة برابط</span>
                </button>
              )}

              {openCreatePlaylistModal && (
                <button
                  onClick={openCreatePlaylistModal}
                  className="bg-amber-400 hover:bg-amber-300 text-black font-display font-bold text-xs px-3 py-2 rounded-xl brutal-border brutal-btn flex items-center gap-1.5 cursor-pointer"
                  title="إنشاء قائمة سور جديدة"
                >
                  <Plus size={15} strokeWidth={2.5} />
                  <span>إنشاء قائمة</span>
                </button>
              )}
            </div>
          </div>

          {/* Badge Widget */}
          <div className="shrink-0 bg-[#082621]/90 rounded-xl brutal-border border-[#26c4b7] p-4 text-center min-w-[170px] shadow-lg">
            <span className="text-[10px] font-mono font-bold text-[#26c4b7] block mb-1 uppercase tracking-wider">
              المكتبة القرآنية
            </span>
            <div className="text-3xl font-black font-display text-white mb-0.5">
              {quranTracks.length}
            </div>
            <div className="text-xs text-emerald-200/80 font-medium">سورة وتلاوة متوفرة</div>
            <div className="mt-2 pt-2 border-t border-emerald-900/60 text-[11px] text-emerald-400 font-mono">
              {quranPlaylists.length} مصحف وقائمة
            </div>
          </div>
        </div>
      </section>

      {/* ── Navigation Tabs & Search ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'surahs', label: `السور والتلاوات (${quranTracks.length})` },
            { id: 'playlists', label: `المصاحف والقوائم (${quranPlaylists.length})` },
            { id: 'reciters', label: `القراء (${reciters.length})` },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-display font-bold transition-all brutal-btn whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#26c4b7] text-[#041d1a] font-black brutal-border brutal-shadow-sm'
                    : isDark
                      ? 'bg-[#102421] text-emerald-200 border border-emerald-900/80 hover:bg-[#15312d]'
                      : 'bg-[#fdfbf7] text-[#0b1110] brutal-border hover:bg-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Bar inside Quran */}
        <div className="relative w-full sm:w-72">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400/70 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن سورة أو قارئ (المنشاوي، البقرة...)"
            className={`w-full text-xs font-bold pl-9 pr-3 py-2 rounded-lg brutal-border focus:outline-none transition-colors ${
              isDark 
                ? 'bg-[#0c201d] text-white border-emerald-800 placeholder-emerald-400/50 focus:bg-[#102a26]' 
                : 'bg-[#fdfbf7] text-[#0b1110] border-black placeholder-zinc-500 focus:bg-white'
            }`}
          />
        </div>
      </div>

      {/* ── TAB 1: SURAHS & TRACKS ── */}
      {activeTab === 'surahs' && (
        <div>
          {filteredTracks.length === 0 ? (
            <div className={`p-8 text-center rounded-xl brutal-border ${
              isDark ? 'bg-[#0f2421] border-emerald-900 text-white' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
            }`}>
              <BookOpen size={40} className="mx-auto mb-3 text-[#26c4b7] opacity-60" />
              <h3 className={`text-base font-bold mb-1 ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>لا توجد سور مطابقة للبحث</h3>
              <p className={`text-xs mb-4 ${isDark ? 'text-emerald-300/70' : 'text-zinc-600'}`}>يمكنك استيراد مصحف كامل أو إضافة سور بروابط خارجية بدون حدود</p>
              {openImportPlaylistModal && (
                <button
                  onClick={openImportPlaylistModal}
                  className="px-4 py-2 bg-[#26c4b7] text-black font-black text-xs rounded-lg brutal-border brutal-shadow-sm"
                >
                  استيراد مصحف الآن
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredTracks.map((track, idx) => {
                const active = isTrackActive(track);
                const reciterName = getQuranReciterName(track, quranPlaylists);
                const cleanTitle = cleanQuranTrackTitle(track.title);

                return (
                  <div
                    key={track.id || track._id || idx}
                    onClick={() => onSelectTrack(track)}
                    className={`group flex items-center justify-between p-2.5 rounded-xl brutal-border cursor-pointer transition-all ${
                      active
                        ? 'bg-[#17a398] text-[#041d1a] brutal-shadow-sm font-black'
                        : isDark
                          ? 'bg-[#0e221f] hover:bg-[#132c28] text-white border-emerald-950'
                          : 'bg-[#fdfbf7] hover:bg-white text-[#0b1110] border-[#082621]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Number or Equalizer */}
                      <div className={`w-7 text-center font-mono text-xs font-bold shrink-0 ${
                        active 
                          ? 'text-[#041d1a]' 
                          : isDark 
                            ? 'text-emerald-400/80 group-hover:text-white' 
                            : 'text-zinc-600 group-hover:text-black'
                      }`}>
                        {active && isPlaying ? (
                          <Volume2 size={16} className="animate-pulse text-[#041d1a] mx-auto" />
                        ) : (
                          <span>{idx + 1}</span>
                        )}
                      </div>

                      {/* Cover */}
                      <div className="w-10 h-10 rounded-lg brutal-border overflow-hidden shrink-0 bg-[#041d1a] relative">
                        <img 
                          src={track.cover || 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=300'} 
                          alt={track.title} 
                          className="w-full h-full object-cover" 
                          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=300'; }}
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                          <Play size={14} fill="currentColor" />
                        </div>
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <h4 className={`text-xs sm:text-sm font-bold truncate leading-tight transition-colors ${
                          active 
                            ? 'text-[#041d1a]' 
                            : isDark 
                              ? 'text-white group-hover:text-[#26c4b7]' 
                              : 'text-[#0b1110] group-hover:text-[#0f756d]'
                        }`}>
                          {cleanTitle}
                        </h4>
                        <p className={`text-[11px] truncate mt-0.5 font-medium ${
                          active 
                            ? 'text-[#041d1a]/80 font-bold' 
                            : isDark 
                              ? 'text-emerald-300/80' 
                              : 'text-[#084c41]'
                        }`}>
                          <span className="font-bold">{reciterName}</span>
                          {track.album ? ` • ${cleanQuranTrackTitle(track.album)}` : ''}
                        </p>
                      </div>
                    </div>

                    {/* Actions & Duration */}
                    <div className="flex items-center gap-3 shrink-0 ml-2">
                      <span className={`text-[11px] font-mono font-bold ${
                        active 
                          ? 'text-[#041d1a]' 
                          : isDark 
                            ? 'text-emerald-400/80' 
                            : 'text-zinc-600'
                      }`}>
                        {formatDuration(track.duration)}
                      </span>

                      {toggleLike && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLike(track.id || track._id);
                          }}
                          className="p-1 rounded hover:scale-110 transition-transform cursor-pointer"
                        >
                          <Heart 
                            size={16} 
                            className={track.liked ? 'text-red-500 fill-red-500' : active ? 'text-[#041d1a]' : isDark ? 'text-zinc-400' : 'text-zinc-500'} 
                          />
                        </button>
                      )}

                      <div className={`w-8 h-8 rounded-lg brutal-border flex items-center justify-center ${
                        active ? 'bg-[#041d1a] text-[#26c4b7]' : 'bg-[#26c4b7] text-[#041d1a]'
                      }`}>
                        <Play size={14} fill="currentColor" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: PLAYLISTS & MUSHAFS ── */}
      {activeTab === 'playlists' && (
        <div>
          {filteredPlaylists.length === 0 ? (
            <div className={`p-8 text-center rounded-xl brutal-border ${
              isDark ? 'bg-[#0f2421] border-emerald-900 text-white' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
            }`}>
              <BookOpen size={40} className="mx-auto mb-3 text-[#26c4b7] opacity-60" />
              <h3 className={`text-base font-bold mb-1 ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>لا توجد قوائم أو مصاحف حالياً</h3>
              <p className={`text-xs mb-4 ${isDark ? 'text-emerald-300/70' : 'text-zinc-600'}`}>اضغط على زر استيراد لجلب مصحف كامل من يوتيوب برابط واحد</p>
              {openImportPlaylistModal && (
                <button
                  onClick={openImportPlaylistModal}
                  className="px-4 py-2 bg-[#26c4b7] text-black font-black text-xs rounded-lg brutal-border brutal-shadow-sm"
                >
                  استيراد مصحف الآن
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredPlaylists.map((pl, idx) => {
                const count = (pl.trackIds || []).length;
                const reciterName = getQuranReciterName(pl, quranPlaylists);

                return (
                  <div
                    key={pl.id || pl._id || idx}
                    onClick={() => onSelectPlaylist(pl)}
                    className={`rounded-2xl brutal-border p-3.5 flex flex-col justify-between cursor-pointer brutal-shadow hover:brutal-shadow-lg transition-all group ${
                      isDark 
                        ? 'bg-[#0e221f] border-emerald-900 hover:bg-[#132e2a]' 
                        : 'bg-[#fdfbf7] border-[#082621] hover:bg-white'
                    }`}
                  >
                    <div>
                      <div className="w-full aspect-video rounded-xl brutal-border mb-3 overflow-hidden bg-black/20 relative">
                        <img 
                          src={pl.cover || 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=600'} 
                          alt={pl.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                          onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=600'; }}
                        />
                        <span className="absolute bottom-2 right-2 text-[10px] font-mono font-black bg-[#041d1a]/90 text-[#26c4b7] px-2 py-0.5 rounded brutal-border border-emerald-800">
                          {count} {count > 100 ? 'سورة (كامل)' : 'سورة'}
                        </span>
                      </div>

                      <h4 className={`font-display font-black text-sm line-clamp-1 transition-colors ${
                        isDark 
                          ? 'text-white group-hover:text-[#26c4b7]' 
                          : 'text-[#0b1110] group-hover:text-[#0f756d]'
                      }`}>
                        {cleanQuranTrackTitle(pl.name)}
                      </h4>
                      <p className={`text-[11px] line-clamp-2 mt-1 font-medium ${
                        isDark 
                          ? 'text-emerald-300/80' 
                          : 'text-[#0a3832]'
                      }`}>
                        {pl.description ? cleanQuranTrackTitle(pl.description) : `مصحف كامل بصوت ${reciterName}`}
                      </p>
                    </div>

                    <div className={`mt-3 pt-3 border-t flex items-center justify-between text-xs ${
                      isDark ? 'border-emerald-900/60' : 'border-zinc-300'
                    }`}>
                      <span className={`font-mono text-[10px] font-bold ${
                        isDark ? 'text-[#26c4b7]' : 'text-[#084c41]'
                      }`}>
                        قائمة تشغيل
                      </span>
                      <div className="w-7 h-7 rounded-lg bg-[#26c4b7] text-[#041d1a] flex items-center justify-center font-bold">
                        <Play size={12} fill="currentColor" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: RECITERS ── */}
      {activeTab === 'reciters' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {reciters.map((reciter, idx) => (
            <div
              key={idx}
              onClick={() => {
                setSearchQuery(reciter.searchKey || reciter.name);
                setActiveTab('surahs');
              }}
              className={`p-3.5 rounded-xl brutal-border text-center cursor-pointer transition-all hover:scale-[1.02] group ${
                isDark 
                  ? 'bg-[#0e221f] border-emerald-900 hover:bg-[#14322d]' 
                  : 'bg-[#fdfbf7] border-[#082621] hover:bg-white shadow-sm'
              }`}
            >
              <div className="w-16 h-16 rounded-full mx-auto mb-2.5 brutal-border overflow-hidden bg-[#041d1a] ring-2 ring-[#26c4b7]/30 group-hover:scale-105 transition-transform">
                <img 
                  src={reciter.cover || 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=300'} 
                  alt={reciter.name} 
                  className="w-full h-full object-cover" 
                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=300'; }}
                />
              </div>
              <h4 className={`text-xs sm:text-sm font-display font-black truncate px-1 ${
                isDark 
                  ? 'text-white group-hover:text-[#26c4b7]' 
                  : 'text-[#0b1110] group-hover:text-[#0f756d]'
              }`}>
                {reciter.name}
              </h4>
              <p className={`text-[10px] font-mono font-bold mt-1 ${
                isDark ? 'text-[#26c4b7]' : 'text-[#084c41]'
              }`}>
                {reciter.count} سورة
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
