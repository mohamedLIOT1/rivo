import React, { memo } from 'react';
import { Flame, ArrowRight, ArrowLeft } from 'lucide-react';
import HomeTrackCard from './HomeTrackCard';

const BADGE_COLORS = ['#0f756d', '#111615', '#17a398', '#dc2626', '#f59e0b', '#1e3a8a', '#082621', '#3b82f6'];

function HomePopularTracks({
  tracks = [],
  totalCount = 0,
  isActive,
  isPlaying = false,
  isDark = true,
  onSelectTrack,
  toggleLike,
  onOpenActionMenu,
  onSelectArtist,
  onViewAll,
  t,
  isRTL = false,
}) {
  if (!tracks || tracks.length === 0) return null;

  const displayCount = tracks.length;
  const ArrowIcon = isRTL ? ArrowLeft : ArrowRight;

  return (
    <section className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <Flame size={20} className="text-amber-400" />
            <h2 className="font-display font-black text-xl text-[#fdfbf7] tracking-tight drop-shadow-[1.5px_1.5px_0px_#082621]">
              {t ? t('home.mostPopular') : 'Most Popular & Top Listened'}
            </h2>
            <span className="text-[10px] font-mono font-bold bg-[#0b1110] text-[#17a398] px-2 py-0.5 rounded-full brutal-border">
              {displayCount} {t ? t('home.topChartsBadge') : 'Top Hits'}
            </span>
          </div>
          <div className="text-[11px] font-mono font-bold text-emerald-100/80 mt-0.5">
            {isRTL ? '٢٤ أغنية مختارة • تتجدد كل ١٢ ساعة' : '24 Curated Hits • Refreshes every 12h'}
          </div>
        </div>

        {totalCount > displayCount && (
          <button
            type="button"
            onClick={onViewAll}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg brutal-border bg-[#0b1110] hover:bg-[#141d1b] text-[#26c4b7] font-mono font-black text-[11px] uppercase cursor-pointer brutal-shadow-sm transition-transform active:scale-95"
            title={isRTL ? 'عرض كل الأغاني' : 'View All Tracks'}
          >
            <span>{isRTL ? 'عرض كل الأغاني' : 'View All Tracks'}</span>
            <ArrowIcon size={12} strokeWidth={2.5} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
        {tracks.map((track, index) => (
          <HomeTrackCard
            key={track.id || track._id || index}
            track={track}
            index={index}
            isActive={isActive?.(track)}
            isPlaying={isPlaying}
            isDark={isDark}
            color={BADGE_COLORS[index % BADGE_COLORS.length]}
            onSelectTrack={() => onSelectTrack?.(track, tracks)}
            toggleLike={toggleLike}
            onOpenActionMenu={onOpenActionMenu}
            onSelectArtist={onSelectArtist}
            t={t}
          />
        ))}
      </div>
    </section>
  );
}

export default memo(HomePopularTracks);
