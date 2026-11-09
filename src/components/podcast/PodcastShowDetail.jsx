import React, { useState, useMemo, useCallback } from 'react';
import { ArrowLeft, ArrowRight, Play, Heart, Radio, Users, Check, Search, Share2 } from 'lucide-react';
import PodcastEpisodeCard from './PodcastEpisodeCard';

const PodcastShowDetail = React.memo(function PodcastShowDetail({
  show,
  onBack,
  onPlayEpisode,
  onPlayAllShowEpisodes,
  onAddToQueue,
  toggleLike,
  likedTrackIds = [],
  currentTrack,
  isPlaying,
  isDark = true,
  isRTL = true,
  t = (k) => k,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFollowing, setIsFollowing] = useState(() => {
    if (!show?.id || typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(`rivo_podcast_follow_${show.id}`) === 'true';
    } catch {
      return false;
    }
  });

  const toggleFollow = useCallback(() => {
    if (!show?.id) return;
    setIsFollowing((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(`rivo_podcast_follow_${show.id}`, String(next));
      } catch {}
      return next;
    });
  }, [show?.id]);

  const showName = show?.title || show?.name || '';
  const showCreator = show?.creator || show?.host || '';
  const episodes = useMemo(() => show?.episodes || [], [show?.episodes]);

  const filteredEpisodes = useMemo(() => {
    if (!searchQuery.trim()) return episodes;
    const q = searchQuery.toLowerCase().trim();
    return episodes.filter((ep) =>
      (ep.title && ep.title.toLowerCase().includes(q)) ||
      (ep.description && ep.description.toLowerCase().includes(q))
    );
  }, [episodes, searchQuery]);

  const handlePlayAll = useCallback(() => {
    if (episodes.length === 0) return;
    if (onPlayAllShowEpisodes) {
      onPlayAllShowEpisodes(episodes);
    } else if (onPlayEpisode) {
      onPlayEpisode(episodes[0], episodes);
    }
  }, [episodes, onPlayAllShowEpisodes, onPlayEpisode]);

  if (!show) return null;

  return (
    <div className="space-y-6 pb-24">
      {/* ── TOP BACK BUTTON ── */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className={`px-4 py-2 rounded-xl brutal-border font-display font-black text-xs sm:text-sm flex items-center gap-2 cursor-pointer transition-transform hover:scale-105 active:scale-95 ${
            isDark 
              ? 'bg-[#102421] hover:bg-[#15312d] text-emerald-200 border-emerald-800' 
              : 'bg-white hover:bg-[#ede5d3] text-[#0b1110]'
          }`}
        >
          {isRTL ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}
          <span>{t('podcast.backToPodcasts') || 'العودة للبودكاست'}</span>
        </button>

        {show.category && (
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/30">
            {show.categoryLabel || show.category}
          </span>
        )}
      </div>

      {/* ── SHOW HERO BANNER (Album-Style Header) ── */}
      <div className={`relative rounded-3xl p-6 sm:p-8 brutal-border overflow-hidden ${
        isDark ? 'bg-[#0a1815] border-emerald-950' : 'bg-white border-black'
      }`}>
        {/* Subtle blurred background glow */}
        <div 
          className="absolute -top-24 -left-24 w-96 h-96 rounded-full opacity-20 pointer-events-none filter blur-3xl"
          style={{ background: 'radial-gradient(circle, #10b981 0%, transparent 70%)' }}
        />

        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end gap-6 sm:gap-8">
          {/* Cover image */}
          <div className="w-40 h-40 sm:w-48 sm:h-48 md:w-56 md:h-56 rounded-2xl overflow-hidden brutal-border shadow-2xl shrink-0 bg-black/60">
            <img
              src={show.cover}
              alt={showName}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Metadata */}
          <div className={`flex-1 text-center sm:${isRTL ? 'text-right' : 'text-left'} min-w-0`}>
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400 mb-1">
              {t('podcast.title') || 'بودكاست ريفو'}
            </div>

            <h1 className={`text-2xl sm:text-3xl md:text-4xl font-display font-black leading-tight mb-2 ${
              isDark ? 'text-white' : 'text-[#0b1110]'
            }`}>
              {showName}
            </h1>

            <p className="text-sm font-bold text-emerald-400 mb-3">
              {showCreator}
            </p>

            <p className="text-xs sm:text-sm text-zinc-400 line-clamp-3 mb-5 leading-relaxed max-w-2xl">
              {show.description}
            </p>

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
              <button
                onClick={handlePlayAll}
                className="px-6 py-3 rounded-xl bg-[#10b981] hover:bg-[#00df81] text-[#041d1a] font-display font-black text-xs sm:text-sm brutal-border brutal-shadow flex items-center gap-2 cursor-pointer transition-transform hover:scale-105 active:scale-95"
              >
                <Play size={17} fill="currentColor" />
                <span>{t('podcast.playAll') || 'تشغيل كل الحلقات'}</span>
              </button>

              <button
                onClick={toggleFollow}
                className={`px-5 py-3 rounded-xl font-display font-black text-xs sm:text-sm brutal-border flex items-center gap-2 cursor-pointer transition-all ${
                  isFollowing
                    ? 'bg-[#102a24] text-[#10b981] border-[#10b981]'
                    : isDark
                      ? 'bg-[#102421] hover:bg-[#15312d] text-white border-emerald-900'
                      : 'bg-white hover:bg-[#ede5d3] text-black border-black'
                }`}
              >
                {isFollowing ? (
                  <>
                    <Check size={16} />
                    <span>{t('podcast.following') || 'مُتابَع'}</span>
                  </>
                ) : (
                  <span>{t('podcast.follow') || 'متابعة'}</span>
                )}
              </button>

              <div className="hidden md:flex items-center gap-3 text-xs font-mono text-zinc-400 ml-3">
                <span className="flex items-center gap-1">
                  <Radio size={13} className="text-[#10b981]" />
                  <span>{episodes.length} {t('podcast.episodes') || 'حلقات'}</span>
                </span>
                {show.followers && (
                  <span className="flex items-center gap-1">
                    <Users size={13} />
                    <span>{show.followers} {t('podcast.followersCount') || 'متابع'}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── EPISODES SECTION & SEARCH ── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <h2 className={`font-display font-black text-lg sm:text-xl ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
            {t('podcast.allEpisodes') || (isRTL ? 'قائمة الحلقات' : 'All Episodes')} ({filteredEpisodes.length})
          </h2>

          {/* In-Show Search Filter */}
          <div className="relative w-full sm:w-64">
            <Search size={15} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-emerald-400/70 pointer-events-none`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('podcast.searchPlaceholder') || 'ابحث في الحلقات...'}
              className={`w-full text-xs font-bold ${isRTL ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'} py-2 rounded-xl brutal-border focus:outline-none transition-colors ${
                isDark 
                  ? 'bg-[#0c1c19] text-white border-emerald-900 placeholder-emerald-400/40 focus:bg-[#102421]' 
                  : 'bg-white text-[#0b1110] border-black placeholder-zinc-500'
              }`}
            />
          </div>
        </div>

        {/* Episode List */}
        {filteredEpisodes.length === 0 ? (
          <div className={`p-8 text-center rounded-2xl brutal-border ${
            isDark ? 'bg-[#0d1c19] text-zinc-400 border-emerald-950' : 'bg-white text-zinc-600'
          }`}>
            <p className="font-bold text-sm">{t('podcast.noResults') || 'لم يتم العثور على أي حلقات مطابقة'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEpisodes.map((episode, idx) => {
              const epId = String(episode.id || episode._id);
              const isLiked = likedTrackIds.some((id) => String(id) === epId);
              return (
                <PodcastEpisodeCard
                  key={epId || idx}
                  episode={episode}
                  index={idx}
                  onPlayEpisode={(ep) => onPlayEpisode(ep, filteredEpisodes)}
                  onAddToQueue={onAddToQueue}
                  toggleLike={toggleLike}
                  isLiked={isLiked}
                  currentTrack={currentTrack}
                  isPlaying={isPlaying}
                  isDark={isDark}
                  isRTL={isRTL}
                  t={t}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

export default PodcastShowDetail;
