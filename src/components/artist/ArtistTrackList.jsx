import React, { useState, memo } from 'react';
import { Music2, MoreVertical, Heart, ChevronDown, ChevronUp } from 'lucide-react';
import { ArtistLinks } from '../../utils/artistUtils';
import { useTranslation } from '../../context/PreferencesContext';
import { normalizeCoverUrl, handleCoverImageError } from '../../utils/coverUtils';

/**
 * Format play metrics into human-readable compact notation (e.g. 1.2M, 540K, 12.5K).
 * Suppresses misleading single-digit or small unverified play counts (< 100).
 */
export function formatCompactPlays(count) {
  const num = Number(count);
  if (!num || isNaN(num) || num < 100) return null;
  if (num >= 1e9) {
    return (num / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  }
  if (num >= 1e6) {
    return (num / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1e3) {
    const formatted = (num / 1e3).toFixed(num < 100000 ? 1 : 0).replace(/\.0$/, '');
    return formatted + 'K';
  }
  return num.toLocaleString();
}

function ArtistTrackList({
  artistTracks = [],
  isQuran = false,
  isDark = true,
  onSelectTrack,
  onSelectArtist,
  onOpenActionMenu,
  toggleLike
}) {
  const { t, isRTL } = useTranslation();
  const PAGE_SIZE = 10;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [artistTracks]);

  const displayedTracks = artistTracks.slice(0, visibleCount);
  const remainingCount = Math.max(0, artistTracks.length - visibleCount);
  const hasMore = remainingCount > 0;

  return (
    <div className={`brutal-border-thick brutal-shadow-lg p-4 sm:p-6 mb-6 sm:mb-8 rounded-xl ${
      isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#082621]'
    }`}>
      <div className={`flex items-center justify-between pb-3 mb-3 sm:mb-4 border-b-2 ${
        isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110] text-[#082621]'
      }`}>
        <div className="flex items-center gap-2">
          <Music2 size={16} className="text-[#17a398] sm:w-4.5 sm:h-4.5 shrink-0" />
          <h2 className="text-base sm:text-lg font-mono font-black uppercase">
            {isQuran ? t('profile.allSurahs') : t('profile.allTracks')}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {hasMore ? (
            <button
              onClick={() => setVisibleCount(c => Math.min(artistTracks.length, c + PAGE_SIZE))}
              type="button"
              className="flex items-center gap-1 text-xs font-mono font-bold text-[#17a398] hover:underline cursor-pointer"
            >
              <span>{isRTL ? `+${Math.min(PAGE_SIZE, remainingCount)} المزيد` : `+${Math.min(PAGE_SIZE, remainingCount)} More`}</span>
              <ChevronDown size={14} />
            </button>
          ) : visibleCount > PAGE_SIZE ? (
            <button
              onClick={() => setVisibleCount(PAGE_SIZE)}
              type="button"
              className="flex items-center gap-1 text-xs font-mono font-bold text-[#17a398] hover:underline cursor-pointer"
            >
              <span>{isRTL ? 'عرض أقل' : 'Show Less'}</span>
              <ChevronUp size={14} />
            </button>
          ) : null}
          <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`}>
            {isQuran ? t('profile.surahsCount', { count: artistTracks.length }) : t('profile.tracksCount', { count: artistTracks.length })}
          </span>
        </div>
      </div>

      {artistTracks.length > 0 ? (
        <div className="space-y-1.5 sm:space-y-2">
          {displayedTracks.map((track, i) => {
            const sitePlays = Number(track.plays) || 0;
            const formattedPlays = sitePlays > 0 ? (sitePlays >= 1000 ? formatCompactPlays(sitePlays) : String(sitePlays)) : null;

            return (
              <div
                key={track.id || track._id || i}
                onClick={() => onSelectTrack && onSelectTrack(track, artistTracks)}
                className={`flex items-center gap-2.5 sm:gap-4 p-2 sm:p-3 brutal-border brutal-shadow-sm hover:translate-x-1 transition-transform cursor-pointer group rounded-lg ${
                  isDark 
                    ? 'bg-[#182320] border-zinc-700 text-white hover:bg-[#22332e]' 
                    : 'bg-[#ede5d3] border-black text-[#0b1110] hover:bg-white'
                }`}
              >
                <span className={`text-[11px] sm:text-xs font-mono font-black w-5 sm:w-6 text-center shrink-0 ${
                  isDark ? 'text-zinc-400' : 'text-[#082621]'
                }`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <img 
                  src={normalizeCoverUrl(track.cover, track)}
                  alt={track.title} 
                  className="w-9 h-9 sm:w-11 sm:h-11 brutal-border rounded-md object-cover bg-black/10 shrink-0" 
                  onError={handleCoverImageError}
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

                {formattedPlays && (
                  <div className="text-right hidden sm:block">
                    <span className={`text-[11px] font-mono font-bold px-2 py-0.5 brutal-border rounded-md ${
                      isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#fdfbf7] text-[#082621] border-black'
                    }`}>
                      {formattedPlays} {isQuran ? (t('profile.listens') || 'listens') : (t('profile.plays') || 'plays')}
                    </span>
                  </div>
                )}

              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenActionMenu && onOpenActionMenu(track);
                }}
                className={`p-1.5 sm:p-2 transition-colors cursor-pointer rounded-md ${
                  isDark ? 'text-zinc-400 hover:text-white' : 'text-[#0b1110] hover:text-black'
                }`}
                title="Song options"
                aria-label="Song options"
              >
                <MoreVertical size={15} />
              </button>

              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleLike && toggleLike(track.id || track._id);
                }}
                className={`p-1.5 sm:p-2 transition-colors cursor-pointer ${
                  isDark ? 'text-zinc-400 hover:text-[#dc2626]' : 'text-[#0b1110] hover:text-[#dc2626]'
                }`}
                title="Favorite"
              >
                <Heart size={15} className={track.liked ? 'fill-[#dc2626] text-[#dc2626]' : ''} />
              </button>
            </div>
          );
        })}

        {/* Progressive Load / Collapse Toggle Buttons */}
        {(hasMore || visibleCount > PAGE_SIZE) && (
          <div className="pt-3 sm:pt-4 flex flex-wrap items-center justify-center gap-2">
            {hasMore && (
              <button
                type="button"
                onClick={() => setVisibleCount(c => Math.min(artistTracks.length, c + PAGE_SIZE))}
                className={`inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg text-xs font-mono font-bold brutal-border brutal-shadow-sm brutal-btn cursor-pointer transition ${
                  isDark
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-[#17a398] border-zinc-700'
                    : 'bg-[#ede5d3] hover:bg-white text-[#0b1110] border-black'
                }`}
              >
                <ChevronDown size={15} strokeWidth={2.5} />
                <span>
                  {isRTL
                    ? `+${Math.min(PAGE_SIZE, remainingCount)} ${isQuran ? 'سور إضافية' : 'أغانٍ إضافية'} (متبقي ${remainingCount})`
                    : `+${Math.min(PAGE_SIZE, remainingCount)} More ${isQuran ? 'Surahs' : 'Tracks'} (${remainingCount} remaining)`}
                </span>
              </button>
            )}
            {visibleCount > PAGE_SIZE && (
              <button
                type="button"
                onClick={() => setVisibleCount(PAGE_SIZE)}
                className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs font-mono font-bold brutal-border brutal-shadow-sm brutal-btn cursor-pointer transition opacity-80 hover:opacity-100 ${
                  isDark
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700'
                    : 'bg-[#ede5d3] hover:bg-white text-[#0b1110] border-black'
                }`}
              >
                <ChevronUp size={15} strokeWidth={2.5} />
                <span>{isRTL ? 'عرض أقل' : 'Show Less'}</span>
              </button>
            )}
          </div>
        )}
      </div>
      ) : (
        <div className={`text-center py-8 text-xs font-mono ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
          {isQuran ? 'NO SURAHS FOUND FOR THIS RECITER YET.' : 'NO TRACKS FOUND FOR THIS ARTIST YET.'}
        </div>
      )}
    </div>
  );
}

export default memo(ArtistTrackList);
