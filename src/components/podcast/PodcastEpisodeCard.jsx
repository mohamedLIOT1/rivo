import React from 'react';
import { Play, Pause, Volume2, Heart, Plus, Clock, Calendar } from 'lucide-react';
import { formatPodcastDuration, getPodcastProgress } from '../../utils/podcastUtils';

const PodcastEpisodeCard = React.memo(function PodcastEpisodeCard({
  episode,
  onPlayEpisode = () => {},
  onAddToQueue = () => {},
  toggleLike = () => {},
  isLiked = false,
  currentTrack,
  isPlaying,
  index = 0,
  isDark = true,
  isRTL = true,
  t = (k) => k,
}) {
  if (!episode) return null;

  const isCurrentActive = currentTrack && String(currentTrack.id || currentTrack._id) === String(episode.id || episode._id);
  const isCurrentlyPlaying = isCurrentActive && isPlaying;
  const savedProgress = getPodcastProgress(episode.id || episode._id);
  const duration = episode.duration || 1800;
  const progressPercent = (savedProgress > 0 && duration > 0) ? Math.min(100, (savedProgress / duration) * 100) : 0;

  return (
    <div
      onClick={() => onPlayEpisode(episode)}
      className={`group relative flex items-center justify-between p-3 rounded-2xl brutal-border transition-all duration-200 cursor-pointer select-none ${
        isCurrentActive
          ? isDark 
            ? 'bg-[#102a24] border-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.25)]' 
            : 'bg-emerald-50 border-emerald-600'
          : isDark
            ? 'bg-[#0c1816] hover:bg-[#112421] border-emerald-950/70 hover:border-emerald-800/50'
            : 'bg-white hover:bg-[#faf7f2] border-black/80'
      }`}
    >
      {/* Left: Index/Status + Cover + Title & Show */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {/* Play State Indicator */}
        <div className={`w-6 text-center shrink-0 font-mono text-xs font-bold ${
          isCurrentActive ? 'text-[#10b981]' : 'text-zinc-500 group-hover:text-white'
        }`}>
          {isCurrentlyPlaying ? (
            <Volume2 size={16} className="animate-pulse mx-auto text-[#10b981]" />
          ) : (
            <span className="group-hover:hidden">{index + 1}</span>
          )}
          <span className="hidden group-hover:block mx-auto text-emerald-300">
            <Play size={14} fill="currentColor" />
          </span>
        </div>

        {/* Cover thumbnail */}
        <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden shrink-0 brutal-border bg-black/50">
          <img
            src={episode.cover || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300'}
            alt={episode.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            loading="lazy"
          />
          {progressPercent > 0 && (
            <div className="absolute bottom-0 inset-x-0 h-1 bg-black/60">
              <div 
                className="h-full bg-[#10b981]" 
                style={{ width: `${progressPercent}%` }} 
              />
            </div>
          )}
        </div>

        {/* Episode Info */}
        <div className="min-w-0 flex-1">
          <h4 className={`font-display font-black text-xs sm:text-sm leading-snug truncate mb-0.5 ${
            isCurrentActive ? 'text-[#10b981]' : isDark ? 'text-zinc-100 group-hover:text-white' : 'text-[#0b1110]'
          }`}>
            {episode.title}
          </h4>

          <div className="flex items-center gap-2 text-[11px] text-zinc-400 font-semibold truncate">
            <span className="text-emerald-400/90 font-bold truncate">
              {episode.showTitle || episode.showName || episode.artist}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 shrink-0">
              <Clock size={10} />
              {episode.formattedDuration || formatPodcastDuration(episode.duration)}
            </span>
            {episode.releaseDate && (
              <>
                <span className="hidden sm:inline">•</span>
                <span className="hidden sm:flex items-center gap-1 shrink-0 text-zinc-500">
                  <Calendar size={10} />
                  {episode.releaseDate}
                </span>
              </>
            )}
            {progressPercent > 0 && (
              <span className="hidden md:inline px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 text-[9px] border border-emerald-800/50">
                {t('podcast.resume') || 'متابعة'} ({Math.round(progressPercent)}%)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 shrink-0 pr-1">
        {/* Add to Queue Button */}
        {onAddToQueue && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToQueue(episode);
            }}
            className={`p-1.5 rounded-lg transition-transform hover:scale-110 active:scale-95 cursor-pointer ${
              isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-black'
            }`}
            title={t('podcast.addToQueue') || 'إضافة لقائمة التشغيل'}
          >
            <Plus size={16} />
          </button>
        )}

        {/* Favorite Heart Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleLike(episode.id || episode._id);
          }}
          className={`p-1.5 rounded-lg transition-transform hover:scale-110 active:scale-95 cursor-pointer ${
            isLiked ? 'text-[#dc2626]' : isDark ? 'text-zinc-500 hover:text-[#dc2626]' : 'text-zinc-400 hover:text-[#dc2626]'
          }`}
          title="Save to favorites"
        >
          <Heart size={16} fill={isLiked ? 'currentColor' : 'none'} strokeWidth={2.5} />
        </button>

        {/* Play/Pause Pill Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlayEpisode(episode);
          }}
          className="w-8 h-8 rounded-xl bg-[#10b981] hover:bg-[#00df81] text-[#041d1a] brutal-border flex items-center justify-center transition-transform hover:scale-105 active:scale-95 cursor-pointer shrink-0"
          title={isCurrentlyPlaying ? "Pause" : "Play"}
        >
          {isCurrentlyPlaying ? (
            <Pause size={14} fill="currentColor" />
          ) : (
            <Play size={14} fill="currentColor" className="ml-0.5" />
          )}
        </button>
      </div>
    </div>
  );
});

export default PodcastEpisodeCard;
