import React, { useState } from 'react';
import { Play, Edit, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from '../../context/PreferencesContext';
import { normalizeCoverUrl, handleCoverImageError } from '../../utils/coverUtils';
import { ArtistLinks } from '../../utils/artistUtils';

export default function ArtistHorizontalSection({
  title,
  icon: Icon,
  items = [],
  isDark = true,
  isAdmin = false,
  isTracks = false,
  onOpenAlbum,
  onSelectTrack,
  onSelectArtist,
  openEditAlbumModal
}) {
  const { t, isRTL } = useTranslation();
  const [isGridExpanded, setIsGridExpanded] = useState(false);

  if (!items || items.length === 0) {
    return null;
  }

  return (
    <div className={`brutal-border-thick brutal-shadow-lg p-4 sm:p-6 mb-6 sm:mb-8 rounded-xl ${
      isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#082621]'
    }`}>
      {/* Section Header */}
      <div className={`flex items-center justify-between pb-3 mb-4 border-b-2 ${
        isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110] text-[#082621]'
      }`}>
        <div className="flex items-center gap-2">
          {Icon && <Icon size={18} className="text-[#17a398] sm:w-5 sm:h-5 shrink-0" />}
          <h2 className="text-base sm:text-lg font-mono font-black uppercase tracking-wide truncate">
            {title}
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-[#17a398]/20 text-[#17a398]">
            {items.length}
          </span>
        </div>

        {items.length > 4 && (
          <button
            onClick={() => setIsGridExpanded(prev => !prev)}
            type="button"
            className="flex items-center gap-1 text-xs font-mono font-bold text-[#17a398] hover:underline cursor-pointer"
          >
            <span>{isGridExpanded ? (isRTL ? 'عرض بالعرض' : 'Carousel View') : (isRTL ? 'عرض الكل' : 'View All')}</span>
            {isGridExpanded ? <ChevronUp size={14} /> : <ChevronRight size={14} className={isRTL ? 'rotate-180' : ''} />}
          </button>
        )}
      </div>

      {/* Content: Carousel (Horizontal) vs Expanded Grid */}
      <div className={
        isGridExpanded
          ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4"
          : "flex gap-3 sm:gap-4 overflow-x-auto pb-3 pt-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
      }>
        {items.map((item, idx) => {
          const itemId = String(item.id || item._id || item.name || item.title || idx);
          const coverUrl = normalizeCoverUrl(item.cover || item.coverUrl || '');
          const name = item.name || item.title || 'Untitled';
          const trackCount = item.trackCount || (Array.isArray(item.trackIds) ? item.trackIds.length : (isTracks ? 1 : 0));
          
          const handleClick = () => {
            if (isTracks) {
              if (onSelectTrack) onSelectTrack(item, items);
            } else {
              if (onOpenAlbum) onOpenAlbum(item);
            }
          };

          return (
            <div
              key={itemId}
              onClick={handleClick}
              className={`group relative flex-col rounded-lg brutal-border-sm p-2 sm:p-2.5 transition-all duration-200 cursor-pointer ${
                isGridExpanded ? 'w-full' : 'w-36 sm:w-44 shrink-0'
              } ${
                isDark
                  ? 'bg-zinc-900/80 hover:bg-zinc-800 border-zinc-800 hover:border-zinc-700'
                  : 'bg-white hover:bg-zinc-100 border-zinc-200 hover:border-zinc-300'
              }`}
            >
              {/* Artwork Box */}
              <div className="relative aspect-square w-full rounded-md overflow-hidden bg-zinc-800 brutal-border-sm mb-2 shadow-sm">
                <img
                  src={coverUrl}
                  alt={name}
                  onError={handleCoverImageError}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />

                {/* Hover Play Circle Button */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-[#17a398] text-black flex items-center justify-center brutal-border-sm brutal-shadow-sm hover:scale-110 transition-transform">
                    <Play size={18} fill="currentColor" className="ml-0.5" />
                  </div>
                </div>

                {/* Admin Quick Edit Button */}
                {isAdmin && !isTracks && openEditAlbumModal && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditAlbumModal(item);
                    }}
                    type="button"
                    title="Edit Album"
                    className="absolute top-1.5 right-1.5 p-1 rounded bg-amber-500 hover:bg-amber-400 text-black brutal-border-sm transition-transform hover:scale-110"
                  >
                    <Edit size={12} />
                  </button>
                )}
              </div>

              {/* Title & Metadata */}
              <div className="min-w-0">
                <h3 className="font-display font-bold text-xs sm:text-sm truncate" title={name}>
                  {name}
                </h3>

                <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                  {isTracks ? (
                    <ArtistLinks
                      track={item}
                      onSelectArtist={onSelectArtist}
                      linkClassName="hover:text-[#17a398] hover:underline"
                    />
                  ) : (
                    <span>
                      {trackCount > 0 ? `${trackCount} ${t('common.tracks') || 'tracks'}` : (item.artist || '')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
