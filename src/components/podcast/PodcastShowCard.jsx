import React from 'react';
import { Play, Radio, Users } from 'lucide-react';

const PodcastShowCard = React.memo(function PodcastShowCard({
  show,
  onSelectShow = () => {},
  onPlayShow = () => {},
  isDark = true,
  isRTL = true,
  t = (k) => k,
}) {
  if (!show) return null;

  const showName = show.title || show.name;
  const showCreator = show.creator || show.host;
  const episodesCount = show.episodes?.length || show.episodesCount || 0;

  return (
    <div
      onClick={() => onSelectShow(show)}
      className={`group relative rounded-2xl brutal-border overflow-hidden transition-all duration-300 hover:-translate-y-1 cursor-pointer select-none ${
        isDark 
          ? 'bg-[#0f1f1c] hover:bg-[#142925] border-emerald-950/80 hover:border-emerald-700/60' 
          : 'bg-white hover:bg-[#faf7f2] border-black shadow-[3px_3px_0px_#000]'
      }`}
    >
      {/* Cover Image Container */}
      <div className="relative aspect-square w-full overflow-hidden bg-black/40">
        <img
          src={show.cover || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600'}
          alt={showName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

        {/* Quick Play Float Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlayShow(show);
          }}
          className="absolute bottom-3 left-3 w-11 h-11 rounded-xl bg-[#10b981] hover:bg-[#00df81] text-[#041d1a] brutal-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-xl hover:scale-110 active:scale-95 cursor-pointer z-10"
          title={t('podcast.playAll') || 'تشغيل كل الحلقات'}
        >
          <Play size={18} fill="currentColor" className="ml-0.5" />
        </button>

        {/* Category Pill Tag */}
        {show.category && (
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-mono font-bold text-emerald-300 border border-emerald-500/30">
            {show.categoryLabel || show.category}
          </div>
        )}
      </div>

      {/* Info Body */}
      <div className="p-3.5">
        <h3 className={`font-display font-black text-sm sm:text-base leading-snug truncate mb-1 ${
          isDark ? 'text-white group-hover:text-emerald-300' : 'text-[#0b1110]'
        }`}>
          {showName}
        </h3>

        <p className="text-xs text-emerald-400/80 font-bold truncate mb-2">
          {showCreator}
        </p>

        {/* Footer Meta: Episodes count & Followers */}
        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 border-t border-emerald-950/40 pt-2 mt-1">
          <span className="flex items-center gap-1">
            <Radio size={11} className="text-[#10b981]" />
            <span>{episodesCount} {t('podcast.episodes') || 'حلقات'}</span>
          </span>

          {show.followers && (
            <span className="flex items-center gap-1 text-zinc-500">
              <Users size={11} />
              <span>{show.followers}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
});

export default PodcastShowCard;
