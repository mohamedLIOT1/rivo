import React, { useState, memo } from 'react';
import { Play, Heart, MoreVertical, Flame, ChevronDown, ChevronUp } from 'lucide-react';
import { ArtistLinks } from '../../utils/artistUtils';
import { useTranslation } from '../../context/PreferencesContext';
import { normalizeCoverUrl, handleCoverImageError } from '../../utils/coverUtils';
import { formatDuration } from '../../utils/timeUtils';
import { formatCompactPlays } from './ArtistTrackList';

function ArtistTopTracks({
  tracks = [],
  isDark = true,
  onSelectTrack,
  onSelectArtist,
  onOpenActionMenu,
  toggleLike
}) {
  const { t, isRTL } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  if (!tracks || tracks.length === 0) {
    return null;
  }

  const displayedTracks = isExpanded ? tracks : tracks.slice(0, 5);

  return (
    <div className={`brutal-border-thick brutal-shadow-lg p-4 sm:p-6 mb-6 sm:mb-8 rounded-xl ${
      isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#082621]'
    }`}>
      {/* Section Header */}
      <div className={`flex items-center justify-between pb-3 mb-3 sm:mb-4 border-b-2 ${
        isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110] text-[#082621]'
      }`}>
        <div className="flex items-center gap-2">
          <Flame size={18} className="text-[#17a398] sm:w-5 sm:h-5 shrink-0" />
          <h2 className="text-base sm:text-lg font-mono font-black uppercase tracking-wide">
            {isRTL ? 'الأكثر استماعاً على السيرفر' : 'Most Listened on Server'}
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-[#17a398]/20 text-[#17a398]">
            Top {tracks.length}
          </span>
        </div>

        {tracks.length > 5 && (
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            type="button"
            className="flex items-center gap-1 text-xs font-mono font-bold text-[#17a398] hover:underline cursor-pointer"
          >
            <span>{isExpanded ? (isRTL ? 'عرض أقل' : 'Show Less') : (isRTL ? 'عرض الكل' : 'View All')}</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
      </div>

      {/* Tracks Vertical List */}
      <div className="space-y-1.5 sm:space-y-2">
        {displayedTracks.map((track, idx) => {
          const trackPlays = Number(track.plays);
          const rawCount = trackPlays > 0 ? trackPlays : (Number(track.views) || 0);
          const playsFormatted = rawCount >= 10000 ? formatCompactPlays(rawCount) : rawCount.toLocaleString();
          const trackId = String(track.id || track._id || idx);

          return (
            <div
              key={trackId}
              onClick={() => onSelectTrack && onSelectTrack(track, tracks)}
              className={`group flex items-center justify-between p-2 sm:p-2.5 rounded-lg border transition cursor-pointer ${
                isDark
                  ? 'bg-zinc-900/60 hover:bg-zinc-800/80 border-zinc-800 hover:border-zinc-700'
                  : 'bg-white hover:bg-zinc-100 border-zinc-200 hover:border-zinc-300'
              }`}
            >
              <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                {/* Rank Badge */}
                <span className={`w-6 text-center font-mono font-black text-xs sm:text-sm shrink-0 ${
                  idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-zinc-300' : idx === 2 ? 'text-amber-600' : 'text-zinc-500'
                }`}>
                  {idx + 1}
                </span>

                {/* Track Cover Thumbnail */}
                <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-md overflow-hidden shrink-0 brutal-border-sm bg-zinc-800">
                  <img
                    src={normalizeCoverUrl(track.cover || '')}
                    alt={track.title}
                    onError={handleCoverImageError}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play size={16} fill="white" className="text-white ml-0.5" />
                  </div>
                </div>

                {/* Title & Multi-Artist clickable */}
                <div className="min-w-0 flex-1 pr-2">
                  <div className="font-display font-bold text-xs sm:text-sm truncate">
                    {track.title}
                  </div>
                  <div className="text-[11px] sm:text-xs text-zinc-400 truncate">
                    <ArtistLinks
                      track={track}
                      onSelectArtist={onSelectArtist}
                      linkClassName="hover:text-[#17a398] hover:underline transition-colors"
                      separatorClassName="text-zinc-500"
                    />
                  </div>
                </div>
              </div>

              {/* Right Side Stats & Actions */}
              <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                {/* Server Plays Count - Always visible on mobile and desktop */}
                <div
                  className={`flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-mono font-bold shrink-0 ${
                    isDark ? 'bg-zinc-800/80 text-zinc-300' : 'bg-zinc-100 text-[#082621]'
                  }`}
                  title={`${rawCount.toLocaleString()} ${isRTL ? 'استماع' : 'plays'}`}
                >
                  <Flame size={12} className="text-[#17a398] shrink-0" />
                  <span>{playsFormatted}</span>
                  <span className="text-[9px] sm:text-[10px] text-zinc-400 font-normal">
                    {isRTL ? 'استماع' : 'plays'}
                  </span>
                </div>

                {/* Duration */}
                <span className="text-[11px] sm:text-xs font-mono text-zinc-400">
                  {formatDuration(track.duration)}
                </span>

                {/* Like Button */}
                {toggleLike && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLike(track);
                    }}
                    className="p-1 rounded-md text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <Heart size={15} fill={track.isLiked ? 'currentColor' : 'none'} className={track.isLiked ? 'text-red-500' : ''} />
                  </button>
                )}

                {/* 3-dots Menu */}
                {onOpenActionMenu && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenActionMenu(track);
                    }}
                    className="p-1 rounded-md text-zinc-400 hover:text-white transition-colors"
                  >
                    <MoreVertical size={15} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default memo(ArtistTopTracks);
