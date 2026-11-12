import React, { useState, useMemo } from 'react';
import { Disc, Play, Edit, Plus, Music2, Layers } from 'lucide-react';
import { useTranslation } from '../../context/PreferencesContext';
import { normalizeCoverUrl, handleCoverImageError } from '../../utils/coverUtils';

export function getReleaseType(album) {
  if (album?.releaseType) return album.releaseType.toLowerCase();
  const name = String(album?.name || album?.title || '').toLowerCase().trim();
  const count = Number(album?.trackCount || (Array.isArray(album?.trackIds) ? album.trackIds.length : 0));
  if (name.endsWith('- single') || name.endsWith('(single)') || count === 1) return 'single';
  if (name.endsWith('- ep') || name.endsWith('(ep)') || (count >= 2 && count <= 6)) return 'ep';
  return 'album';
}

export default function ArtistAlbumsGrid({
  artistAlbums = [],
  isQuran = false,
  isAdmin = false,
  isDark = true,
  onOpenAlbum,
  onOpenAddAlbum,
  openEditAlbumModal
}) {
  const { t, isRTL } = useTranslation();
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'album' | 'ep' | 'single'

  const counts = useMemo(() => {
    let albums = 0;
    let eps = 0;
    let singles = 0;
    artistAlbums.forEach(a => {
      const type = getReleaseType(a);
      if (type === 'single') singles++;
      else if (type === 'ep') eps++;
      else albums++;
    });
    return { albums, eps, singles, total: artistAlbums.length };
  }, [artistAlbums]);

  const filteredAlbums = useMemo(() => {
    if (activeFilter === 'all') return artistAlbums;
    return artistAlbums.filter(a => getReleaseType(a) === activeFilter);
  }, [artistAlbums, activeFilter]);

  if (artistAlbums.length === 0 && !isAdmin) {
    return null;
  }

  return (
    <div className={`brutal-border-thick brutal-shadow-lg p-4 sm:p-6 mb-6 sm:mb-8 rounded-xl ${
      isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#082621]'
    }`}>
      {/* Header */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 mb-4 sm:mb-5 border-b-2 ${
        isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110] text-[#082621]'
      }`}>
        <div className="flex items-center gap-2">
          <Disc size={18} className="text-[#17a398] sm:w-5 sm:h-5 shrink-0" />
          <h2 className="text-base sm:text-lg font-mono font-black uppercase truncate">
            {isQuran ? t('profile.discographyRecitations') : (isRTL ? 'الألبومات والإصدارات' : 'Albums & Releases')}
          </h2>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
          <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`}>
            {isQuran 
              ? t('profile.collectionsCount', { count: artistAlbums.length }) 
              : `${filteredAlbums.length} / ${artistAlbums.length} ${isRTL ? 'إصدار' : 'Releases'}`}
          </span>
          {isAdmin && (
            <button
              onClick={onOpenAddAlbum}
              className="brutal-btn flex items-center gap-1.5 px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-mono font-black uppercase bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border rounded-lg cursor-pointer shrink-0"
              title={isQuran ? "Admin: Upload New Collection" : "Admin: Upload New Album"}
            >
              <Plus size={12} strokeWidth={3} />
              <span>{isQuran ? t('profile.addCollection') : t('profile.addAlbum')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Release Type Filter Tabs (All / Albums / EPs / Singles) */}
      {!isQuran && artistAlbums.length > 0 && (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-mono font-black uppercase brutal-border transition-all cursor-pointer shrink-0 ${
              activeFilter === 'all'
                ? 'bg-[#17a398] text-[#0b1110] shadow-[2px_2px_0px_#000]'
                : isDark ? 'bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700' : 'bg-[#ede5d3] text-zinc-700 hover:text-black border-black'
            }`}
          >
            {isRTL ? `الكل (${counts.total})` : `All (${counts.total})`}
          </button>

          {counts.albums > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilter('album')}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-black uppercase brutal-border transition-all cursor-pointer shrink-0 ${
                activeFilter === 'album'
                  ? 'bg-[#17a398] text-[#0b1110] shadow-[2px_2px_0px_#000]'
                  : isDark ? 'bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700' : 'bg-[#ede5d3] text-zinc-700 hover:text-black border-black'
              }`}
            >
              {isRTL ? `ألبومات (${counts.albums})` : `Albums (${counts.albums})`}
            </button>
          )}

          {counts.eps > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilter('ep')}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-black uppercase brutal-border transition-all cursor-pointer shrink-0 ${
                activeFilter === 'ep'
                  ? 'bg-purple-500 text-[#0b1110] shadow-[2px_2px_0px_#000]'
                  : isDark ? 'bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700' : 'bg-[#ede5d3] text-zinc-700 hover:text-black border-black'
              }`}
            >
              {isRTL ? `ميني ألبوم / EP (${counts.eps})` : `EPs (${counts.eps})`}
            </button>
          )}

          {counts.singles > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilter('single')}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-black uppercase brutal-border transition-all cursor-pointer shrink-0 ${
                activeFilter === 'single'
                  ? 'bg-amber-400 text-[#0b1110] shadow-[2px_2px_0px_#000]'
                  : isDark ? 'bg-zinc-800 text-zinc-400 hover:text-white border-zinc-700' : 'bg-[#ede5d3] text-zinc-700 hover:text-black border-black'
              }`}
            >
              {isRTL ? `سينجل (${counts.singles})` : `Singles (${counts.singles})`}
            </button>
          )}
        </div>
      )}

      {/* Grid */}
      {filteredAlbums.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredAlbums.map((album) => {
            const relType = getReleaseType(album);
            return (
              <div
                key={album.id || album.name}
                onClick={() => onOpenAlbum && onOpenAlbum(album)}
                className={`p-3 brutal-border brutal-shadow-sm rounded-xl cursor-pointer group transition-transform hover:-translate-y-1 ${
                  isDark ? 'bg-[#182320] border-zinc-700 hover:bg-[#22332e]' : 'bg-[#ede5d3] border-black hover:bg-white'
                }`}
              >
                <div className="relative aspect-square mb-2.5 overflow-hidden rounded-lg brutal-border bg-black/10">
                  <img
                    src={normalizeCoverUrl(album.cover)}
                    alt={album.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={handleCoverImageError}
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
                <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono">
                  {isQuran ? (
                    <span className="uppercase font-bold text-[#17a398]">{t('quran.collection') || 'مصحف'}</span>
                  ) : relType === 'single' ? (
                    <span className="uppercase font-black px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-400 brutal-border border-amber-400/40">
                      {isRTL ? 'سينجل' : 'SINGLE'}
                    </span>
                  ) : relType === 'ep' ? (
                    <span className="uppercase font-black px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 brutal-border border-purple-500/40">
                      {isRTL ? 'ميني ألبوم' : 'EP'}
                    </span>
                  ) : (
                    <span className="uppercase font-black px-1.5 py-0.5 rounded bg-[#17a398]/20 text-[#26c4b7] brutal-border border-[#17a398]/40">
                      {isRTL ? 'ألبوم' : 'ALBUM'}
                    </span>
                  )}
                  {album.trackCount > 0 && (
                    <span className="text-zinc-400 font-bold">
                      {isQuran 
                        ? t('profile.surahsCount', { count: album.trackCount }) 
                        : (album.trackCount === 1 ? (isRTL ? '1 تراك' : '1 track') : `${album.trackCount} ${isRTL ? 'تراكات' : 'tracks'}`)}
                    </span>
                  )}
                </div>

                {isAdmin && openEditAlbumModal && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditAlbumModal(album);
                    }}
                    className="w-full mt-2 py-1 px-2 bg-[#f59e0b] hover:bg-amber-400 text-black font-mono text-[10px] font-black uppercase brutal-border rounded-md flex items-center justify-center gap-1 cursor-pointer"
                    title={isQuran ? "Admin: Edit Collection" : "Admin: Edit Album"}
                  >
                    <Edit size={11} />
                    <span>{isQuran ? t('profile.editCollection') : t('profile.editAlbum')}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className={`p-8 text-center font-mono text-xs rounded-xl brutal-border ${
          isDark ? 'bg-[#182320] border-zinc-700 text-zinc-400' : 'bg-white/60 border-black text-zinc-600'
        }`}>
          <p className="mb-3 font-medium">
            {isQuran 
              ? t('profile.noCollections') 
              : (isRTL ? 'لا توجد إصدارات في هذا التصنيف' : 'No releases found in this category')}
          </p>
        </div>
      )}
    </div>
  );
}
