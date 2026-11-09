import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Radio, Search, X, Flame } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LocalizationContext';
import { colors } from '../theme/colors';
import {
  PODCAST_CATEGORIES,
  PODCAST_SHOWS,
  ALL_DEFAULT_PODCAST_EPISODES,
} from '../data/podcastData';
import { normalizePodcastSearchText } from '../utils/podcastUtils';
import PodcastShowCard from '../components/podcast/PodcastShowCard';
import PodcastEpisodeItem from '../components/podcast/PodcastEpisodeItem';
import PodcastShowDetail from '../components/podcast/PodcastShowDetail';
import { styles } from './PodcastScreen.styles';

const FOLLOWED_PODCASTS_KEY = '@rivo_followed_podcasts_v1';

export function PodcastScreen({ onTrackAction }) {
  const { playTrack, currentTrack, isPlaying } = useAudioPlayer();
  const { isDark } = useTheme();
  const { t, isRTL } = useTranslation();

  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShow, setSelectedShow] = useState(null);
  const [followedShowIds, setFollowedShowIds] = useState(new Set());

  // Load followed podcasts from local storage
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(FOLLOWED_PODCASTS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setFollowedShowIds(new Set(parsed));
          }
        }
      } catch {}
    })();
  }, []);

  const handleToggleFollow = useCallback((showId) => {
    setFollowedShowIds((prev) => {
      const next = new Set(prev);
      if (next.has(showId)) {
        next.delete(showId);
      } else {
        next.add(showId);
      }
      AsyncStorage.setItem(FOLLOWED_PODCASTS_KEY, JSON.stringify(Array.from(next))).catch(() => {});
      return next;
    });
  }, []);

  // Filter shows based on category & search query
  const filteredShows = useMemo(() => {
    const query = normalizePodcastSearchText(searchQuery);
    return PODCAST_SHOWS.filter((show) => {
      // Category filter
      if (selectedCategory !== 'all') {
        const catMatch =
          show.category === selectedCategory ||
          (selectedCategory === 'science' && show.category === 'tech') ||
          (selectedCategory === 'stories' && show.category === 'crime');
        if (!catMatch) return false;
      }
      // Search query filter
      if (!query) return true;
      const combined = normalizePodcastSearchText(
        `${show.title} ${show.creator} ${show.description} ${show.episodes?.map(e => e.title).join(' ')}`
      );
      return combined.includes(query);
    });
  }, [selectedCategory, searchQuery]);

  // Filter all episodes based on category & search query
  const filteredEpisodes = useMemo(() => {
    const query = normalizePodcastSearchText(searchQuery);
    return ALL_DEFAULT_PODCAST_EPISODES.filter((ep) => {
      // Category filter
      if (selectedCategory !== 'all') {
        const catMatch =
          ep.category === selectedCategory ||
          (selectedCategory === 'science' && ep.category === 'tech') ||
          (selectedCategory === 'stories' && ep.category === 'crime');
        if (!catMatch) return false;
      }
      // Search query filter
      if (!query) return true;
      const combined = normalizePodcastSearchText(
        `${ep.title} ${ep.artist} ${ep.album} ${ep.description || ''}`
      );
      return combined.includes(query);
    });
  }, [selectedCategory, searchQuery]);

  const currentTrackId = String(currentTrack?._id || currentTrack?.id || '');

  const handlePlayEpisode = useCallback((episode, queueList) => {
    const targetQueue = (queueList && queueList.length > 0) ? queueList : filteredEpisodes;
    playTrack(episode, targetQueue);
  }, [playTrack, filteredEpisodes]);

  const handlePlayAll = useCallback((episodesList) => {
    if (Array.isArray(episodesList) && episodesList.length > 0) {
      playTrack(episodesList[0], episodesList);
    }
  }, [playTrack]);

  const handleSelectShow = useCallback((show) => {
    setSelectedShow(show);
  }, []);

  const handleBackFromDetail = useCallback(() => {
    setSelectedShow(null);
  }, []);

  // Render Horizontal Carousel of Shows
  const renderShowCardItem = useCallback(({ item }) => (
    <PodcastShowCard
      show={item}
      onSelect={handleSelectShow}
      isDark={isDark}
      isRTL={isRTL}
    />
  ), [handleSelectShow, isDark, isRTL]);

  const showKeyExtractor = useCallback((item) => item.id, []);

  // Render Episode in Main Feed
  const renderMainEpisodeItem = useCallback(({ item }) => (
    <View style={styles.episodesInnerContainer}>
      <PodcastEpisodeItem
        episode={item}
        isCurrentTrack={currentTrackId === String(item.id || item._id)}
        isPlaying={isPlaying}
        onPlay={() => handlePlayEpisode(item, filteredEpisodes)}
        onTrackAction={onTrackAction}
        isDark={isDark}
        isRTL={isRTL}
      />
    </View>
  ), [currentTrackId, isPlaying, handlePlayEpisode, filteredEpisodes, onTrackAction, isDark, isRTL]);

  const episodeKeyExtractor = useCallback((item) => String(item.id || item._id), []);

  // Header Component inside Main FlatList
  const listHeader = useMemo(() => (
    <View>
      {/* ── Banner Header ── */}
      <View style={styles.headerBanner}>
        <View style={[styles.titleRow, !isRTL && styles.titleRowLTR]}>
          <View style={styles.titleIconBadge}>
            <Radio size={18} color={colors.mint} />
          </View>
          <Text style={[styles.screenTitle, !isDark && styles.screenTitleLight]}>
            {isRTL ? 'بودكاست ريفو' : 'Rivo Podcasts'}
          </Text>
        </View>
        <Text style={[styles.screenSubtitle, !isDark && styles.screenSubtitleLight, !isRTL && styles.screenSubtitleLTR]}>
          {isRTL
            ? 'استمع لأفضل البرامج والبودكاست العربية بجودة صوتية فائقة'
            : 'Top podcasts and talk shows with crystal clear audio'}
        </Text>
      </View>

      {/* ── Search Bar ── */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, !isDark && styles.searchBarLight, !isRTL && styles.searchBarLTR]}>
          <Search size={16} color={!isDark ? '#64748b' : '#94a3b8'} />
          <TextInput
            style={[styles.searchInput, !isDark && styles.searchInputLight, !isRTL && styles.searchInputLTR]}
            placeholder={isRTL ? 'ابحث عن بودكاست، حلقة، أو مقدم برنامج...' : 'Search podcasts, shows, episodes...'}
            placeholderTextColor={!isDark ? '#94a3b8' : '#64748b'}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {Boolean(searchQuery) && (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearBtn}>
              <X size={15} color={!isDark ? '#64748b' : '#94a3b8'} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Horizontal Category Partition Selector ── */}
      <View style={styles.categoriesContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
          data={PODCAST_CATEGORIES}
          keyExtractor={(cat) => cat.id}
          renderItem={({ item }) => {
            const active = selectedCategory === item.id;
            const categoryLabel = item.id === 'all'
              ? (isRTL ? 'الكل' : 'All')
              : (isRTL ? item.label : (item.labelEn || item.label));
            return (
              <TouchableOpacity
                style={[
                  styles.categoryPill,
                  !isDark && styles.categoryPillLight,
                  active && (isDark ? styles.categoryPillActive : styles.categoryPillActiveLight),
                  !isRTL && styles.categoryPillLTR,
                ]}
                onPress={() => setSelectedCategory(item.id)}
                activeOpacity={0.75}
              >
                <Text style={styles.categoryIcon}>{item.icon}</Text>
                <Text
                  style={[
                    styles.categoryLabel,
                    !isDark && styles.categoryLabelLight,
                    active && styles.categoryLabelActive,
                  ]}
                >
                  {categoryLabel}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      {/* ── Shows Horizontal Carousel ── */}
      {filteredShows.length > 0 && (
        <View style={styles.carouselContainer}>
          <View style={[styles.sectionHeaderRow, !isRTL && styles.sectionHeaderRowLTR]}>
            <Text style={[styles.sectionTitle, !isDark && styles.sectionTitleLight]}>
              {isRTL ? 'ألبومات صناع البودكاست المعروفين' : 'Popular Podcast Shows'}
            </Text>
            <Text style={styles.sectionBadge}>
              {isRTL ? `${filteredShows.length} برامج` : `${filteredShows.length} shows`}
            </Text>
          </View>

          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselList}
            data={filteredShows}
            keyExtractor={showKeyExtractor}
            renderItem={renderShowCardItem}
            initialNumToRender={5}
            maxToRenderPerBatch={8}
            windowSize={5}
          />
        </View>
      )}

      {/* ── Episodes Section Header ── */}
      <View style={[styles.sectionHeaderRow, !isRTL && styles.sectionHeaderRowLTR]}>
        <Text style={[styles.sectionTitle, !isDark && styles.sectionTitleLight]}>
          {isRTL ? 'أحدث الحلقات' : 'Latest Episodes'}
        </Text>
        <Text style={styles.sectionBadge}>
          {isRTL ? `${filteredEpisodes.length} حلقة` : `${filteredEpisodes.length} episodes`}
        </Text>
      </View>
    </View>
  ), [
    isDark,
    isRTL,
    searchQuery,
    selectedCategory,
    filteredShows,
    filteredEpisodes.length,
    showKeyExtractor,
    renderShowCardItem,
  ]);

  // Empty Search / Filter State
  const emptyComponent = useMemo(() => {
    if (filteredShows.length > 0 || filteredEpisodes.length > 0) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconFrame}>
          <Radio size={28} color={colors.mint} />
        </View>
        <Text style={[styles.emptyTitle, !isDark && styles.emptyTitleLight]}>
          {isRTL ? 'لم يتم العثور على أي نتائج' : 'No results found'}
        </Text>
        <Text style={[styles.emptySubtitle, !isDark && styles.emptySubtitleLight]}>
          {isRTL
            ? 'جرب البحث بكلمات أخرى أو اختر تصنيفاً مختلفاً'
            : 'Try searching with different keywords or choose another category'}
        </Text>
      </View>
    );
  }, [filteredShows.length, filteredEpisodes.length, isDark, isRTL]);

  // If a show is selected, render Show Detail (Album) view
  if (selectedShow) {
    return (
      <View style={[styles.container, !isDark && styles.containerLight]}>
        <PodcastShowDetail
          show={selectedShow}
          onBack={handleBackFromDetail}
          onPlayEpisode={handlePlayEpisode}
          onPlayAll={handlePlayAll}
          onTrackAction={onTrackAction}
          currentTrackId={currentTrackId}
          isPlaying={isPlaying}
          isFollowed={followedShowIds.has(selectedShow.id)}
          onToggleFollow={handleToggleFollow}
          isDark={isDark}
          isRTL={isRTL}
        />
      </View>
    );
  }

  // Main Podcast Screen View
  return (
    <View style={[styles.container, !isDark && styles.containerLight]}>
      <FlatList
        data={filteredEpisodes}
        renderItem={renderMainEpisodeItem}
        keyExtractor={episodeKeyExtractor}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyComponent}
        contentContainerStyle={styles.episodesListContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={10}
        windowSize={9}
        removeClippedSubviews={Platform.OS === 'android'}
      />
    </View>
  );
}

export default React.memo(PodcastScreen);
