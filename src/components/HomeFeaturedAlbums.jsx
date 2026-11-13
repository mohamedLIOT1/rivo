import React, { memo } from 'react';
import { Disc, Play, ArrowRight, ArrowLeft } from 'lucide-react';
import { getAlbumArtwork } from '../screens/ArtistScreen';
import { handleCoverImageError } from '../utils/coverUtils';

function HomeFeaturedAlbums({
  albums = [],
  totalCount = 0,
  onSelectAlbum,
  onSelectArtist,
  onViewAll,
  isDark = true,
  isRTL = false,
  t,
}) {
  if (!albums || albums.length === 0) return null;

  const displayCount = albums.length;
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <section className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <Disc size={20} className="text-amber-400" />
            <h2 className="font-display font-black text-xl text-[#fdfbf7] tracking-tight drop-shadow-[1.5px_1.5px_0px_#082621]">
              {t ? t('home.featuredAlbums') : 'Featured Albums'}
            </h2>
            <span className="text-[10px] font-mono font-bold bg-[#0b1110] text-[#17a398] px-2 py-0.5 rounded-full brutal-border">
              {displayCount} {displayCount === 1 ? (t ? t('home.album') : 'Album') : (t ? t('home.albums') : 'Albums')}
            </span>
          </div>
          <div className="text-[11px] font-mono font-bold text-emerald-100/80 mt-0.5">
            {isRTL ? '١٦ ألبوم مختار • يتجدد كل ١٢ ساعة' : '16 Curated Albums • Refreshes every 12h'}
          </div>
        </div>

        {totalCount > displayCount && (
          <button
            type="button"
            onClick={onViewAll}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg brutal-border bg-[#0b1110] hover:bg-[#141d1b] text-[#26c4b7] font-mono font-black text-[11px] uppercase cursor-pointer brutal-shadow-sm transition-transform active:scale-95"
            title={isRTL ? 'عرض كل الألبومات' : 'View All Albums'}
          >
            <span>{isRTL ? 'عرض كل الألبومات' : 'View All Albums'}</span>
            <ArrowIcon size={12} strokeWidth={2.5} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-8 gap-3 sm:gap-3.5">
        {albums.map((alb) => {
          const albumKey = alb.id || alb._id || alb.name;
          const artistName = alb.artist || (t ? t('home.artist') : 'Artist');
          const albumName = alb.name || alb.title || 'Untitled Album';

          return (
            <div
              key={albumKey}
              onClick={() => onSelectAlbum?.(alb)}
              className={`p-2.5 sm:p-3 rounded-xl brutal-border brutal-shadow-sm cursor-pointer group transition-transform hover:-translate-y-1 ${
                isDark ? 'bg-[#141d1b] border-zinc-700 hover:bg-[#182320]' : 'bg-[#fdfbf7] border-black hover:bg-white'
              }`}
            >
              <div className="relative aspect-square mb-2 overflow-hidden rounded-lg brutal-border bg-black/10">
                <img
                  src={getAlbumArtwork(alb, alb.cover)}
                  data-original-src={alb.cover || alb.coverUrl}
                  alt={albumName}
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={handleCoverImageError}
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-9 h-9 rounded-full bg-[#f59e0b] text-black flex items-center justify-center brutal-border brutal-shadow-sm shadow-md">
                    <Play size={16} fill="currentColor" className="ml-0.5" />
                  </div>
                </div>
              </div>
              <div
                className={`font-display font-black text-xs truncate group-hover:text-[#17a398] transition-colors ${
                  isDark ? 'text-white' : 'text-[#0b1110]'
                }`}
                title={albumName}
              >
                {albumName}
              </div>
              <div
                onClick={(e) => {
                  if (onSelectArtist && alb.artist) {
                    e.stopPropagation();
                    onSelectArtist(alb.artist);
                  }
                }}
                className={`text-[10px] font-bold truncate hover:underline cursor-pointer ${
                  isDark ? 'text-zinc-400' : 'text-zinc-600'
                }`}
                title={artistName}
              >
                {artistName}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default memo(HomeFeaturedAlbums);
