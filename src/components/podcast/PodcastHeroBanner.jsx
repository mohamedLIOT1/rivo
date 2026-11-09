import React from 'react';
import { Play, Pause, Radio, Clock, Sparkles } from 'lucide-react';
import { formatPodcastDuration } from '../../utils/podcastUtils';

const PodcastHeroBanner = React.memo(function PodcastHeroBanner({
  featuredEpisode,
  onPlayEpisode,
  onOpenShow,
  currentTrack,
  isPlaying,
  isDark = true,
  isRTL = true,
  t = (k) => k,
}) {
  if (!featuredEpisode) return null;

  const isCurrentActive = currentTrack && String(currentTrack.id || currentTrack._id) === String(featuredEpisode.id || featuredEpisode._id);
  const isCurrentlyPlaying = isCurrentActive && isPlaying;

  return (
    <div className="relative w-full rounded-2xl overflow-hidden brutal-border brutal-shadow-lg mb-6 select-none bg-[#091513]">
      {/* Background Image with Dark Gradient Overlay */}
      <div 
        className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-105"
        style={{
          backgroundImage: `url(${featuredEpisode.cover || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200'})`,
          filter: 'blur(20px) brightness(0.35)',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#081311] via-[#091513]/85 to-black/40" />

      {/* Content Container */}
      <div className="relative z-10 p-5 sm:p-7 md:p-9 flex flex-col md:flex-row items-center gap-6">
        {/* Cover Art */}
        <div 
          onClick={() => onOpenShow && onOpenShow(featuredEpisode.showId)}
          className="relative w-36 h-36 sm:w-44 sm:h-44 md:w-48 md:h-48 rounded-2xl overflow-hidden shrink-0 brutal-border shadow-[0_8px_30px_rgba(0,0,0,0.6)] group cursor-pointer"
        >
          <img
            src={featuredEpisode.cover}
            alt={featuredEpisode.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-[#10b981] text-black flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
              <Play size={22} fill="currentColor" className="ml-0.5" />
            </div>
          </div>
        </div>

        {/* Text Metadata & Action Buttons */}
        <div className={`flex-1 text-center md:${isRTL ? 'text-right' : 'text-left'} min-w-0`}>
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-bold tracking-wide mb-3 ${
            isDark ? 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
          }`}>
            <Sparkles size={13} className="text-[#10b981] animate-pulse" />
            <span>{t('podcast.featured') || 'حلقات مميزة ومختارة'}</span>
          </div>

          <h2 className="text-xl sm:text-2xl md:text-3xl font-display font-black text-white leading-tight mb-2 line-clamp-2">
            {featuredEpisode.title}
          </h2>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-xs text-emerald-300/80 mb-3 font-semibold">
            <span className="text-white font-bold">{featuredEpisode.artist || featuredEpisode.showTitle}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {featuredEpisode.formattedDuration || formatPodcastDuration(featuredEpisode.duration)}
            </span>
            {featuredEpisode.releaseDate && (
              <>
                <span>•</span>
                <span>{featuredEpisode.releaseDate}</span>
              </>
            )}
          </div>

          <p className="text-xs sm:text-sm text-zinc-300 line-clamp-2 max-w-2xl mb-5 leading-relaxed">
            {featuredEpisode.description}
          </p>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
            <button
              onClick={() => onPlayEpisode && onPlayEpisode(featuredEpisode)}
              className="px-5 py-2.5 rounded-xl bg-[#10b981] hover:bg-[#00df81] text-[#041d1a] font-display font-black text-xs sm:text-sm brutal-border brutal-shadow flex items-center gap-2 cursor-pointer transition-transform hover:scale-105 active:scale-95"
            >
              {isCurrentlyPlaying ? (
                <>
                  <Pause size={16} fill="currentColor" />
                  <span>{t('podcast.pauseEpisode') || 'إيقاف مؤقت'}</span>
                </>
              ) : (
                <>
                  <Play size={16} fill="currentColor" />
                  <span>{t('podcast.listenNow') || 'استمع الآن'}</span>
                </>
              )}
            </button>

            {featuredEpisode.showId && (
              <button
                onClick={() => onOpenShow && onOpenShow(featuredEpisode.showId)}
                className="px-4 py-2.5 rounded-xl bg-[#102421] hover:bg-[#15312d] text-emerald-200 border border-emerald-800/80 font-display font-bold text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Radio size={15} />
                <span>{t('podcast.showDetails') || 'تفاصيل البرنامج'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default PodcastHeroBanner;
