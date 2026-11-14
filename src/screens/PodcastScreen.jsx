import React, { useState, useMemo, useCallback } from 'react';
import { Search, Radio, Sparkles, Disc, Flame } from 'lucide-react';
import { useTranslation } from '../context/PreferencesContext';
import { useAudioPlayer } from '../context/AudioContext';
import { API_BASE_URL } from '../config';
import { buildPodcastSeedQueue, isPodcastContent, getPodcastCategory } from '../utils/podcastUtils';

import PodcastCategoriesBar from '../components/podcast/PodcastCategoriesBar';
import PodcastHeroBanner from '../components/podcast/PodcastHeroBanner';
import PodcastShowCard from '../components/podcast/PodcastShowCard';
import PodcastEpisodeCard from '../components/podcast/PodcastEpisodeCard';
import PodcastShowDetail from '../components/podcast/PodcastShowDetail';

export default function PodcastScreen({
  tracks: propTracks,
  onSelectTrack,
  currentTrack,
  isPlaying,
  toggleLike,
  likedTrackIds = [],
  globalTheme = 'dark',
}) {
  const isDark = globalTheme === 'dark';
  const { t, isRTL } = useTranslation();
  const audio = useAudioPlayer();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShow, setSelectedShow] = useState(null);
  const [backendShows, setBackendShows] = useState([]);

  // Fetch official podcast shows from backend API
  React.useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/api/podcasts/shows`)
      .then(r => r.json())
      .then(data => {
        if (active && data.success && Array.isArray(data.shows)) {
          setBackendShows(data.shows);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const realPodcastEpisodes = useMemo(() => {
    const src = Array.isArray(propTracks) && propTracks.length > 0 ? propTracks : (audio?.tracks || []);
    const local = src
      .filter((tr) => isPodcastContent(tr))
      .map((tr) => ({
        ...tr,
        category: tr.podcastCategory || getPodcastCategory(tr),
      }));

    const backendEpisodes = backendShows.flatMap(s => (s.episodes || []).map(ep => ({
      ...ep,
      artist: ep.host || s.host,
      album: s.title,
      coverUrl: ep.cover || s.cover,
      cover: ep.cover || s.cover,
      isPodcast: true
    })));

    return [...backendEpisodes, ...local];
  }, [propTracks, audio?.tracks, backendShows]);

  const realPodcastShows = useMemo(() => {
    const map = new Map();
    // 1. Add backend shows
    backendShows.forEach(s => {
      map.set(s.id, {
        id: s.id,
        name: s.title,
        title: s.title,
        creator: s.host,
        category: s.category || 'culture',
        cover: s.cover,
        description: s.description,
        episodes: (s.episodes || []).map(ep => ({
          ...ep,
          artist: ep.host || s.host,
          album: s.title,
          coverUrl: ep.cover || s.cover,
          cover: ep.cover || s.cover,
          isPodcast: true
        }))
      });
    });

    // 2. Add local shows from tracks if any
    for (let i = 0; i < realPodcastEpisodes.length; i++) {
      const ep = realPodcastEpisodes[i];
      if (ep.showId && map.has(ep.showId)) continue;
      const showName = String(ep.album || ep.artist || '').trim();
      if (!showName) continue;
      const key = showName.toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          id: `show-${key}`,
          name: showName,
          title: showName,
          creator: ep.artist || showName,
          category: ep.category || 'culture',
          cover: ep.coverUrl || ep.cover || null,
          episodes: [ep],
        });
      }
    }
    return Array.from(map.values());
  }, [backendShows, realPodcastEpisodes]);

  // Play a podcast episode and set seed queue exclusively with other podcasts
  const handlePlayEpisode = useCallback((episode, customQueue = null) => {
    if (!episode) return;
    const queue = customQueue && customQueue.length > 0 
      ? customQueue 
      : buildPodcastSeedQueue(episode, realPodcastEpisodes, 25);
    
    if (typeof onSelectTrack === 'function') {
      onSelectTrack(episode, queue);
    } else if (audio?.playTrack) {
      audio.playTrack(episode, queue);
    }
  }, [onSelectTrack, audio, realPodcastEpisodes]);

  // Play all episodes from a show
  const handlePlayShow = useCallback((show) => {
    if (!show || !show.episodes || show.episodes.length === 0) return;
    const episodes = show.episodes;
    handlePlayEpisode(episodes[0], episodes);
  }, [handlePlayEpisode]);

  // Add episode to current queue
  const handleAddToQueue = useCallback((episode) => {
    if (!episode) return;
    if (audio?.addToQueue) {
      audio.addToQueue(episode);
    }
  }, [audio]);

  // Filter shows based on category & search query
  const filteredShows = useMemo(() => {
    let result = realPodcastShows;

    if (selectedCategory !== 'all') {
      result = result.filter(s => s.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(s => 
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.name && s.name.toLowerCase().includes(q)) ||
        (s.creator && s.creator.toLowerCase().includes(q)) ||
        (s.host && s.host.toLowerCase().includes(q)) ||
        (s.description && s.description.toLowerCase().includes(q))
      );
    }

    return result;
  }, [realPodcastShows, selectedCategory, searchQuery]);

  // Filter episodes based on category & search query
  const filteredEpisodes = useMemo(() => {
    let result = realPodcastEpisodes;

    if (selectedCategory !== 'all') {
      result = result.filter(ep => ep.category === selectedCategory);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(ep =>
        (ep.title && ep.title.toLowerCase().includes(q)) ||
        (ep.showTitle && ep.showTitle.toLowerCase().includes(q)) ||
        (ep.showName && ep.showName.toLowerCase().includes(q)) ||
        (ep.artist && ep.artist.toLowerCase().includes(q)) ||
        (ep.host && ep.host.toLowerCase().includes(q)) ||
        (ep.description && ep.description.toLowerCase().includes(q))
      );
    }

    return result;
  }, [realPodcastEpisodes, selectedCategory, searchQuery]);

  // Pick a featured episode for the Hero banner
  const featuredEpisode = useMemo(() => {
    if (filteredEpisodes.length > 0) return filteredEpisodes[0];
    return realPodcastEpisodes[0] || null;
  }, [filteredEpisodes, realPodcastEpisodes]);

  // If a specific show is selected, render the Show Detail view (the show as an Album)
  if (selectedShow) {
    return (
      <div className={`flex-1 h-full overflow-y-auto px-4 sm:px-6 md:px-8 pt-6 pb-32 ${
        isDark ? 'bg-[#0b1110] text-zinc-100' : 'bg-[#f7f5f0] text-[#0b1110]'
      }`}>
        <PodcastShowDetail
          show={selectedShow}
          onBack={() => setSelectedShow(null)}
          onPlayEpisode={handlePlayEpisode}
          onPlayAllShowEpisodes={(episodes) => handlePlayEpisode(episodes[0], episodes)}
          onAddToQueue={handleAddToQueue}
          toggleLike={toggleLike}
          likedTrackIds={likedTrackIds}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          isDark={isDark}
          isRTL={isRTL}
          t={t}
        />
      </div>
    );
  }

  return (
    <div className={`flex-1 h-full overflow-y-auto px-4 sm:px-6 md:px-8 pt-6 pb-32 ${
      isDark ? 'bg-[#0b1110] text-zinc-100' : 'bg-[#f7f5f0] text-[#0b1110]'
    }`}>
      {/* ── HEADER & SEARCH ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Radio size={20} className="text-[#10b981]" />
            <h1 className={`text-2xl sm:text-3xl font-display font-black tracking-tight ${
              isDark ? 'text-white' : 'text-[#0b1110]'
            }`}>
              {t('podcast.title') || (isRTL ? 'بودكاست ريفو' : 'Rivo Podcasts')}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 font-medium">
            {t('podcast.subtitle') || (isRTL ? 'استمع لأفضل البرامج والبودكاست العربية والعالمية بجودة فائقة' : 'Top podcasts and talk shows with crystal clear audio')}
          </p>
        </div>

        {/* Global Podcast Search Bar */}
        <div className="relative w-full md:w-80">
          <Search size={16} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-emerald-400 pointer-events-none`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('podcast.searchPlaceholder') || (isRTL ? 'ابحث عن بودكاست، حلقة، ضيف، أو موضوع...' : 'Search shows, episodes, guests, topics...')}
            className={`w-full text-xs font-bold ${isRTL ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'} py-2.5 rounded-xl brutal-border focus:outline-none transition-colors ${
              isDark 
                ? 'bg-[#0c1c19] text-white border-emerald-900 placeholder-emerald-400/40 focus:bg-[#102421]' 
                : 'bg-white text-[#0b1110] border-black placeholder-zinc-500'
            }`}
          />
        </div>
      </div>

      {/* ── CATEGORY PARTITIONS BAR ── */}
      <div className="mb-6">
        <PodcastCategoriesBar
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          isDark={isDark}
          isRTL={isRTL}
          t={t}
        />
      </div>

      {/* ── HERO BANNER (Only on 'All' or when not actively searching) ── */}
      {!searchQuery.trim() && featuredEpisode && (
        <PodcastHeroBanner
          featuredEpisode={featuredEpisode}
          onPlayEpisode={handlePlayEpisode}
          onOpenShow={(showId) => {
            const match = realPodcastShows.find(s => s.id === showId);
            if (match) setSelectedShow(match);
          }}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          isDark={isDark}
          isRTL={isRTL}
          t={t}
        />
      )}

      {/* ── SHOWS CAROUSEL / GRID (Only shown when real shows exist) ── */}
      {filteredShows.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame size={18} className="text-[#10b981]" />
              <h2 className={`font-display font-black text-lg sm:text-xl ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
                {t('podcast.popularShows') || (isRTL ? 'أشهر البرامج والبودكاست' : 'Popular Podcast Shows')}
              </h2>
            </div>
            <span className="text-xs font-mono text-zinc-400">
              {filteredShows.length} {t('podcast.shows') || (isRTL ? 'برامج' : 'shows')}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {filteredShows.map((show) => (
              <PodcastShowCard
                key={show.id}
                show={show}
                onSelectShow={setSelectedShow}
                onPlayShow={handlePlayShow}
                isDark={isDark}
                isRTL={isRTL}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── LATEST EPISODES SECTION ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#10b981]" />
            <h2 className={`font-display font-black text-lg sm:text-xl ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
              {t('podcast.latestEpisodes') || (isRTL ? 'أحدث الحلقات' : 'Latest Episodes')}
            </h2>
          </div>
          <span className="text-xs font-mono text-zinc-400">
            {filteredEpisodes.length} {t('podcast.episodes') || (isRTL ? 'حلقة' : 'episodes')}
          </span>
        </div>

        {filteredEpisodes.length === 0 ? (
          <div className={`p-8 text-center rounded-2xl brutal-border ${
            isDark ? 'bg-[#0d1c19] text-zinc-400 border-emerald-950' : 'bg-white text-zinc-600'
          }`}>
            <p className="font-bold text-sm">{t('podcast.noResults') || (isRTL ? 'لم يتم العثور على أي حلقات مطابقة' : 'No episodes found')}</p>
            <p className="text-xs text-zinc-500 mt-1">{t('podcast.noResultsSubtitle') || (isRTL ? 'جرب البحث بكلمات أخرى' : 'Try a different search term or category filter')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEpisodes.slice(0, 30).map((episode, idx) => {
              const epId = String(episode.id || episode._id);
              const isLiked = likedTrackIds.some((id) => String(id) === epId);
              return (
                <PodcastEpisodeCard
                  key={epId || idx}
                  episode={episode}
                  index={idx}
                  onPlayEpisode={(ep) => handlePlayEpisode(ep, filteredEpisodes)}
                  onAddToQueue={handleAddToQueue}
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
}
