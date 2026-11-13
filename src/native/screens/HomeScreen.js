import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Play, Plus, Disc } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation, useLiteMode } from '../context/LocalizationContext';
import { API_BASE_URL } from '../config';
import { colors } from '../theme/colors';
import SongItem from '../ui/SongItem';
import FeaturedAlbumCard from '../components/home/FeaturedAlbumCard';
import HeroAiMixCard from '../components/home/HeroAiMixCard';
import UpdateBanner from '../components/home/UpdateBanner';
import AlbumDetailModal from '../components/AlbumDetailModal';
import ArtistDetailModal from '../components/ArtistDetailModal';
import { isQuranContent } from '../../utils/quranUtils';
import { resolveAlbumTracks } from '../utils/resolveAlbumTracks';
import { getCachedMusicTracks, getCachedHomeAlbums } from '../utils/catalogCache';
import { getSmartTasteAndMoodTracks, getCurrentTimeMood } from '../utils/tasteAlgorithm';
import {
  getMemoryCachedAiMoodMix,
  loadCachedAiMoodMix,
  saveCachedAiMoodMix,
} from '../utils/aiMoodMixCache';
import { getListeningStats } from '../context/audio/audioApiHelpers';

const keyExtractor = (item, index) => String(item._id || item.id || index);
const TRACK_ROW_HEIGHT = 68;
const getItemLayout = (_, index) => ({
  length: TRACK_ROW_HEIGHT,
  offset: TRACK_ROW_HEIGHT * index,
  index,
});

function HomeScreen({
  onOpenAddSong,
  onTrackAction,
  onOpenFullPlayer,
  onSelectAlbum,
  onSelectArtist,
  initialFilter = 'all',
}) {
  const { width } = useWindowDimensions();
  const numColumns = width >= 1024 ? 5 : width >= 768 ? 4 : width >= 600 ? 3 : 2;
  const albumGap = 10;
  const albumPadding = 24;
  const albumCardWidth = useMemo(() => {
    return Math.floor((width - albumPadding - (numColumns - 1) * albumGap) / numColumns);
  }, [width, numColumns]);

  const { playTrack, togglePlay, setQueue, currentTrack, isPlaying, isLoading, downloadedTracks = [] } = useAudioPlayer();
  const { currentUser, token, tracks: userTracks, albums = [], likedTrackIds = [], toggleLikeTrack, fetchPublicTracks } = useUser();
  const { appMode } = useConnectivity();
  const { isDark } = useTheme();
  const { t, isRTL } = useTranslation();
  const { isLiteMode } = useLiteMode();
  const rtlTextStyle = isRTL ? { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' } : null;
  const isOffline = appMode === 'offline';
  const [activeFilter, setActiveFilter] = useState(initialFilter);

  useEffect(() => {
    if (initialFilter) {
      setActiveFilter(initialFilter);
    }
  }, [initialFilter]); // 'all' | 'music' | 'downloaded'
  const [refreshing, setRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(() => (isLiteMode ? 10 : 15));
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [loadingAlbumId, setLoadingAlbumId] = useState(null);
  const albumPlayAbortRef = useRef(null);
  const smartMixAbortRef = useRef(null);

  useEffect(() => {
    return () => {
      albumPlayAbortRef.current?.abort();
      smartMixAbortRef.current?.abort();
    };
  }, []);

  // Filter music only (strictly exclude Quran from main music home) & apply cached popularity sorting
  const displayTracks = useMemo(() => {
    return getCachedMusicTracks({ userTracks, downloadedTracks, isOffline, activeFilter });
  }, [userTracks, activeFilter, downloadedTracks, isOffline]);

  const cacheOwnerId = String(currentUser?._id || currentUser?.id || 'guest');

  // Discography Featured Albums (12h deterministic seeded rotation per ownerId)
  const displayAlbums = useMemo(() => {
    return getCachedHomeAlbums(albums, userTracks, cacheOwnerId);
  }, [albums, userTracks, cacheOwnerId]);

  const [aiMoodMix, setAiMoodMix] = useState(() => getMemoryCachedAiMoodMix(cacheOwnerId, displayTracks) || []);

  const handleSelectAlbumCard = useCallback((album) => {
    if (onSelectAlbum) {
      onSelectAlbum(album);
    } else {
      setSelectedAlbum(album);
    }
  }, [onSelectAlbum]);

  const handlePlayAlbum = useCallback(async (album) => {
    if (!album) return;
    const albKey = String(album._id || album.id || album.name || '');
    albumPlayAbortRef.current?.abort();
    const controller = new AbortController();
    albumPlayAbortRef.current = controller;

    setLoadingAlbumId(albKey);
    try {
      const localPool = [
        ...(Array.isArray(userTracks) ? userTracks : []),
        ...(Array.isArray(downloadedTracks) ? downloadedTracks : []),
      ];
      const albTracks = await resolveAlbumTracks(album, localPool, controller.signal);
      if (controller.signal.aborted) return;
      if (albTracks.length > 0) {
        playTrack(albTracks[0], albTracks);
      } else {
        // Fallback: open album details if no playable tracks could be resolved
        handleSelectAlbumCard(album);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoadingAlbumId(null);
      }
    }
  }, [userTracks, downloadedTracks, playTrack, handleSelectAlbumCard]);

  const visibleTracks = useMemo(() => {
    return displayTracks.slice(0, visibleCount);
  }, [displayTracks, visibleCount]);

  const curTrackId = String(currentTrack?._id || currentTrack?.id || '');
  const likedSet = useMemo(() => new Set((likedTrackIds || []).map(String)), [likedTrackIds]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (isRTL) {
      if (hour >= 21 || hour < 5) return 'ليلة سعيدة';
      if (hour < 12) return 'صباح الخير';
      return 'مساء الخير';
    }
    if (hour >= 21 || hour < 5) return 'Good night';
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const currentMood = getCurrentTimeMood();

  const getMoodLabel = useCallback((mood) => {
    if (!isRTL) return mood?.label ? mood.label.toUpperCase() : 'MUSIC FLOW';
    switch (mood?.id) {
      case 'morning':
        return 'انتعاش الصباح';
      case 'afternoon':
        return 'أجواء الظهيرة';
      case 'evening':
        return 'حماس المساء';
      case 'night':
        return 'سكون الليل';
      default:
        return 'أجواء موسيقية';
    }
  }, [isRTL]);

  // Persisted 12-hour AI Mood Mix (read AsyncStorage first; generate & save at most once per 12h window)
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    (async () => {
      const cached = await loadCachedAiMoodMix(cacheOwnerId, displayTracks);
      if (!mounted) return;
      if (cached && cached.length > 0) {
        setAiMoodMix(cached);
        if (cached.__source === 'server' || isOffline) return;
      }
      if (displayTracks.length === 0 && !(!isOffline && API_BASE_URL)) return;

      const localStats = getListeningStats?.() || {};
      const statTracks = Object.values(localStats.trackStats || {}).slice(0, 10);
      const recentTracks = [
        ...(currentTrack ? [currentTrack] : []),
        ...statTracks,
        ...(Array.isArray(currentUser?.recentTracks) ? currentUser.recentTracks.slice(0, 8) : []),
      ].filter(Boolean).slice(0, 15).map(tr => ({
        id: String(tr._id || tr.id || ''),
        title: tr.title || '',
        artist: tr.artist || '',
        genre: tr.genre || '',
      }));

      const localSeeds = displayTracks.length > 0
        ? getSmartTasteAndMoodTracks({
            allTracks: displayTracks,
            currentUser,
            followedArtists: currentUser?.following || [],
            likedTrackIds,
            listeningStats: { ...localStats, history: recentTracks },
            currentTrack,
            limit: 12,
          })
        : [];

      const commitMix = (list, { bucket12h, source = 'server', moodId } = {}) => {
        const merged = [];
        const seen = new Set();
        for (const tr of list) {
          const tid = String(tr?._id || tr?.id || '');
          if (tid && !seen.has(tid) && !isQuranContent(tr)) {
            seen.add(tid);
            merged.push({ ...tr, isSmartMoodQueue: true, isAiSuggestion: true });
          }
          if (merged.length >= 15) break;
        }
        if (merged.length > 0 && mounted) {
          setAiMoodMix(merged);
          saveCachedAiMoodMix({
            ownerId: cacheOwnerId,
            moodId: moodId || currentMood?.id || 'evening',
            bucket12h,
            source,
            name: isRTL ? 'مُختارات لك • قائمة ذكاء ريفو' : 'Made For You • AI Mood Mix',
            description: `${currentMood?.label || 'Music Flow'} • 12h Mix`,
            tracks: merged,
          });
        }
      };

      if (isOffline || !API_BASE_URL) {
        if (!cached) commitMix(localSeeds, { source: 'local' });
        return;
      }

      const timeoutId = setTimeout(() => {
        try { controller.abort(); } catch {}
      }, 6000);

      try {
        const authToken = token || (await AsyncStorage.getItem('@rivo_auth_token_v2').catch(() => null));
        if (controller.signal.aborted) return;
        const res = await fetch(`${API_BASE_URL}/api/ai/mood-mix`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          body: JSON.stringify({
            mood: currentMood?.id || 'neutral',
            timeOfDay: currentMood?.id || 'evening',
            seedTracks: localSeeds.slice(0, 5),
            followedArtists: currentUser?.following || [],
            limit: 15,
            isQuran: false,
          }),
          signal: controller.signal,
        });
        if (res.ok && !controller.signal.aborted) {
          const data = await res.json();
          const rawRecs = data?.tracks || data?.recommendations || [];
          if (rawRecs.length > 0) {
            commitMix(rawRecs, { bucket12h: data?.bucket12h, source: 'server', moodId: data?.mood });
            return;
          }
        }
      } catch {} finally {
        clearTimeout(timeoutId);
      }

      if (mounted && !cached) commitMix(localSeeds, { source: 'local' });
    })();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [cacheOwnerId, displayTracks, isOffline, token, currentMood?.id, isRTL]);

  const handlePlaySmartCassette = useCallback(() => {
    if (aiMoodMix && aiMoodMix.length > 0) {
      playTrack(aiMoodMix[0], aiMoodMix);
      return;
    }

    const pool = displayTracks.length > 0 ? displayTracks : (userTracks || []);
    const localStats = getListeningStats?.() || {};
    const smart12 = getSmartTasteAndMoodTracks({
      allTracks: pool,
      currentUser,
      followedArtists: currentUser?.following || [],
      likedTrackIds,
      listeningStats: localStats,
      currentTrack,
      limit: 12,
    });

    const initialList = (smart12.length > 0 ? smart12 : displayTracks.slice(0, 12))
      .map(tr => ({ ...tr, isSmartMoodQueue: true, isAiSuggestion: true }));

    if (initialList.length > 0) {
      setAiMoodMix(initialList);
      playTrack(initialList[0], initialList);
    }
  }, [aiMoodMix, displayTracks, userTracks, currentUser, likedTrackIds, currentTrack, playTrack]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchPublicTracks();
    } finally {
      setRefreshing(false);
    }
  };

  const downloadedCount = Array.isArray(downloadedTracks) ? downloadedTracks.length : 0;

  const renderHeader = useCallback(() => (
    <View>
      {/* ─── IN-APP UPDATE BANNER (Only shows when an update is available) ─── */}
      <UpdateBanner />

      {/* ─────────────────────────────────────────
          HERO BANNER (MUSIC STREAMING LAB)
          Matching exact website layout
          ───────────────────────────────────────── */}
      <View style={[styles.heroCard, !isDark && styles.heroCardLight]}>
        {/* Subtle Background Watermark */}
        <Text style={[styles.watermark, !isDark && styles.watermarkLight]}>RIVO</Text>

        {/* Top Pill Badge */}
        <View style={[styles.labPill, !isDark && styles.labPillLight]}>
          <View style={[styles.pulseDot, isOffline && { backgroundColor: '#f59e0b' }]} />
          <Text style={[styles.labPillText, !isDark && styles.labPillTextLight, rtlTextStyle]}>
            {isOffline ? (isRTL ? '📼 الخزنة المحلية • استهلاك صفر للبيانات' : '📼 OFFLINE VAULT • ZERO DATA CONSUMPTION') : `🎵 ${getMoodLabel(currentMood)}`}
          </Text>
        </View>

        {/* Heading */}
        <Text style={[styles.greetingTitle, !isDark && styles.greetingTitleLight, isRTL && { textAlign: 'right' }]}>
          {getGreeting()}{isRTL ? '، ' : ', '}
          <Text style={{ color: '#17a398' }}>
            {currentUser?.name ? currentUser.name.split(' ')[0] : (isRTL ? 'مستمع' : 'Listener')}
          </Text>
        </Text>

        <Text style={[styles.heroSubtitle, !isDark && styles.heroSubtitleLight, isRTL && { textAlign: 'right' }]}>
          {isOffline
            ? (isRTL ? 'تشغيل أغانيك المنزلة مباشرة من ذاكرة الهاتف. بدون إنترنت وبدون استهلاك للبيانات.' : 'Playing your downloaded songs directly from local storage. 100% offline, zero data usage.')
            : (isRTL ? 'استمع للراب المصري، الإندي، كاسيت زمان، وقوائم مخصصة لذوقك. صوت نقي 24-بت وبدون إعلانات.' : 'Stream Egyptian rap, indie hits, retro cassettes, and personalized mixes. Crystal-clear 24-bit audio, zero ads, seamless listening.')}
        </Text>

        {/* 2 Primary CTA Buttons */}
        <View style={styles.heroBtnRow}>
          <TouchableOpacity
            style={styles.playTopChartsBtn}
            onPress={handlePlaySmartCassette}
            activeOpacity={0.85}
            delayPressIn={0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Play size={14} color="#0b1110" fill="#0b1110" />
            <Text style={[styles.playTopChartsBtnText, rtlTextStyle]}>
              {aiMoodMix.length > 0
                ? (isRTL ? `تشغيل قائمة الذكاء (${aiMoodMix.length})` : `PLAY AI MOOD MIX (${aiMoodMix.length})`)
                : (isRTL ? 'تشغيل قائمة الأفضل (10)' : 'PLAY TOP CHARTS (10)')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addTrackBtn}
            onPress={onOpenAddSong}
            activeOpacity={0.85}
            delayPressIn={0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Plus size={15} color="#0b1110" strokeWidth={2.5} />
            <Text style={[styles.addTrackBtnText, rtlTextStyle]}>{isRTL ? '+ إضافة مقطع' : '+ Add Track'}</Text>
          </TouchableOpacity>
        </View>

        {/* Hero AI Mood Mix White Card with 2x2 Mosaic Cover & 12h Persistence */}
        {!isOffline && (
          <HeroAiMixCard
            aiMoodMix={aiMoodMix}
            moodLabel={getMoodLabel(currentMood)}
            isRTL={isRTL}
            onPlayMix={handlePlaySmartCassette}
          />
        )}
      </View>

      {/* ─────────────────────────────────────────
          FEATURED ALBUMS SECTION (Matching Image 3)
          ───────────────────────────────────────── */}
      {displayAlbums && displayAlbums.length > 0 && (
        <View style={styles.albumsSection}>
          <View style={styles.albumsHeaderRow}>
            <View style={styles.albumsTitleGroup}>
              <Disc size={18} color="#f59e0b" strokeWidth={2.4} />
              <Text style={[styles.albumsSectionTitle, !isDark && styles.albumsSectionTitleLight, rtlTextStyle]}>
                {isRTL ? 'ألبومات مميزة' : 'Featured Albums'}
              </Text>
              <View style={styles.albumsCountPill}>
                <Text style={[styles.albumsCountText, rtlTextStyle]}>
                  {isRTL
                    ? `${displayAlbums.length} ألبوم`
                    : `${displayAlbums.length} ${displayAlbums.length === 1 ? 'ALBUM' : 'ALBUMS'}`}
                </Text>
              </View>
            </View>
          </View>

          {/* 2-Column Grid */}
          <View style={styles.albumsGrid}>
            {displayAlbums.slice(0, isLiteMode ? 4 : 8).map((alb, index) => {
              const albKey = String(alb._id || alb.id || alb.name || `album-${index}`);
              return (
                <FeaturedAlbumCard
                  key={albKey}
                  album={alb}
                  isDark={isDark}
                  width={albumCardWidth}
                  isLoading={loadingAlbumId === albKey}
                  onSelect={handleSelectAlbumCard}
                  onPlay={handlePlayAlbum}
                />
              );
            })}
          </View>
        </View>
      )}

      {/* ─────────────────────────────────────────
          SECTION HEADER & FILTER PILLS
          ───────────────────────────────────────── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, rtlTextStyle]}>{isRTL ? 'التشغيل اليومي والمفضلة' : 'Daily Rotation & Favorites'}</Text>
        <View style={styles.topTracksBadge}>
          <Text style={[styles.topTracksText, rtlTextStyle]}>{isRTL ? 'الأكثر استماعاً' : 'TOP TRACKS'}</Text>
        </View>
      </View>

      {/* Filter Pills Row */}
      <View style={styles.filterPillsRow}>
        <TouchableOpacity
          style={[styles.filterPill, activeFilter === 'all' && styles.filterPillActive]}
          onPress={() => setActiveFilter('all')}
          activeOpacity={0.8}
          delayPressIn={0}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        >
          <Text style={[styles.filterPillText, activeFilter === 'all' && styles.filterPillTextActive, rtlTextStyle]}>
            {t('common.all')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, activeFilter === 'music' && styles.filterPillActive]}
          onPress={() => setActiveFilter('music')}
          activeOpacity={0.8}
          delayPressIn={0}
          hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
        >
          <Text style={[styles.filterPillText, activeFilter === 'music' && styles.filterPillTextActive, rtlTextStyle]}>
            {t('nav.music')}
          </Text>
        </TouchableOpacity>

        {downloadedCount > 0 && (
          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'downloaded' && styles.filterPillActive]}
            onPress={() => setActiveFilter('downloaded')}
            activeOpacity={0.8}
            delayPressIn={0}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
          >
            <Text style={[styles.filterPillText, activeFilter === 'downloaded' && styles.filterPillTextActive, rtlTextStyle]}>
              {isRTL ? `المحملة (${downloadedCount})` : `Downloaded (${downloadedCount})`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  ), [currentUser?.name, aiMoodMix, handlePlaySmartCassette, displayAlbums, isDark, activeFilter, downloadedCount, isOffline, isLiteMode, onOpenAddSong, handlePlayAlbum, handleSelectAlbumCard, albumCardWidth, loadingAlbumId, isRTL, currentMood, getMoodLabel, t, rtlTextStyle]);

  const renderFooter = useCallback(() => {
    if (displayTracks.length > visibleCount) {
      return (
        <TouchableOpacity
          style={styles.loadMoreBtn}
          onPress={() => setVisibleCount((c) => c + (isLiteMode ? 15 : 30))}
          activeOpacity={0.8}
          delayPressIn={0}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.loadMoreText, rtlTextStyle]}>
            {isRTL
              ? `+ عرض المزيد من المقاطع (متبقي ${displayTracks.length - visibleCount})`
              : `+ LOAD MORE TRACKS (${displayTracks.length - visibleCount} MORE)`}
          </Text>
        </TouchableOpacity>
      );
    }

    if (displayTracks.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <Text style={[styles.emptyText, rtlTextStyle]}>
            {isOffline
              ? (isRTL ? 'لا توجد أغانٍ محفوظة بدون إنترنت بعد.\nقم بتحميل الأغاني أثناء الاتصال بالإنترنت للاستماع إليها هنا!' : 'No offline songs saved yet.\nDownload songs while connected to listen offline here!')
              : (isRTL ? 'جاري تحميل المقاطع...' : 'Loading tracks...')}
          </Text>
        </View>
      );
    }

    return null;
  }, [displayTracks.length, visibleCount, isOffline, isLiteMode, isRTL, rtlTextStyle]);

  const displayTracksRef = useRef(displayTracks);
  displayTracksRef.current = displayTracks;
  const curTrackIdRef = useRef(curTrackId);
  curTrackIdRef.current = curTrackId;

  const handlePlaySong = useCallback((track) => {
    const tId = String(track?._id || track?.id || '');
    if (tId && curTrackIdRef.current && tId === curTrackIdRef.current) {
      togglePlay?.();
      return;
    }
    const pool = Array.isArray(displayTracksRef.current) ? displayTracksRef.current : [];
    const idx = pool.findIndex((t) => String(t?._id || t?.id || '') === tId);
    const maxWindow = 40;
    let queueSlice;
    if (idx < 0 || pool.length <= maxWindow) {
      queueSlice = pool.length > 0 ? pool : [track];
    } else {
      const tail = pool.slice(idx, idx + maxWindow);
      const wrapCount = Math.max(0, maxWindow - tail.length);
      queueSlice = wrapCount > 0 ? [...tail, ...pool.slice(0, Math.min(idx, wrapCount))] : tail;
    }
    playTrack(track, queueSlice);
  }, [playTrack, togglePlay]);

  const handleMoreSong = useCallback((track) => {
    if (onTrackAction) onTrackAction(track);
  }, [onTrackAction]);

  const renderItem = useCallback(({ item }) => {
    const itemId = String(item._id || item.id || '');
    const isCurrent = curTrackId !== '' && curTrackId === itemId;
    return (
      <SongItem
        track={item}
        isCurrent={isCurrent}
        isPlaying={isCurrent && isPlaying}
        isLoading={isCurrent && isLoading}
        isLiked={likedSet.has(itemId)}
        isDark={isDark}
        onPlay={handlePlaySong}
        onTogglePlay={togglePlay}
        onToggleLike={toggleLikeTrack}
        onMorePress={handleMoreSong}
      />
    );
  }, [curTrackId, isPlaying, isLoading, likedSet, isDark, handlePlaySong, togglePlay, toggleLikeTrack, handleMoreSong]);

  const handleLoadMoreOnEnd = useCallback(() => {
    if (displayTracks.length > visibleCount) {
      setVisibleCount((c) => Math.min(displayTracks.length, c + (isLiteMode ? 12 : 20)));
    }
  }, [displayTracks.length, visibleCount, isLiteMode]);

  return (
    <>
      <FlatList
        style={[styles.container, !isDark && { backgroundColor: '#fdfbf7' }]}
        contentContainerStyle={styles.content}
        data={visibleTracks}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        getItemLayout={getItemLayout}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        initialNumToRender={isLiteMode || Platform.OS === 'android' ? 4 : 6}
        maxToRenderPerBatch={isLiteMode || Platform.OS === 'android' ? 4 : 6}
        windowSize={isLiteMode || Platform.OS === 'android' ? 3 : 5}
        updateCellsBatchingPeriod={Platform.OS === 'android' ? 50 : 40}
        removeClippedSubviews={Platform.OS === 'android'}
        onEndReached={handleLoadMoreOnEnd}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#17a398"
            colors={['#17a398']}
          />
        }
      />
      {!onSelectAlbum && Boolean(selectedAlbum) && (
        <AlbumDetailModal
          visible={Boolean(selectedAlbum)}
          album={selectedAlbum}
          onClose={() => setSelectedAlbum(null)}
          allTracks={userTracks}
          onTrackAction={onTrackAction}
          onOpenFullPlayer={onOpenFullPlayer}
          onSelectArtist={(artistName) => {
            if (onSelectArtist) {
              onSelectArtist(artistName);
            } else {
              setSelectedAlbum(null);
              setSelectedArtist(typeof artistName === 'object' ? artistName : { name: artistName });
            }
          }}
        />
      )}
      {!onSelectArtist && Boolean(selectedArtist) && (
        <ArtistDetailModal
          visible={Boolean(selectedArtist)}
          artist={selectedArtist}
          onClose={() => setSelectedArtist(null)}
          allTracks={userTracks}
          allAlbums={albums}
          onOpenFullPlayer={onOpenFullPlayer}
          onSelectAlbum={(alb) => {
            setSelectedArtist(null);
            setSelectedAlbum(alb);
          }}
          onTrackAction={onTrackAction}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1110',
  },
  content: {
    padding: 12,
    paddingBottom: 110,
    maxWidth: 840,
    width: '100%',
    alignSelf: 'center',
  },
  heroCard: {
    backgroundColor: '#082621',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#0f756d',
    padding: 16,
    marginBottom: 18,
    position: 'relative',
    overflow: 'hidden',
  },
  heroCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#cbd5e1',
  },
  watermark: {
    position: 'absolute',
    right: -10,
    bottom: -20,
    fontSize: 90,
    fontWeight: '900',
    color: '#ffffff',
    opacity: 0.05,
    letterSpacing: -4,
  },
  watermarkLight: {
    color: '#000000',
    opacity: 0.03,
  },
  labPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fdfbf7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 14,
    alignSelf: 'flex-start',
    marginBottom: 10,
    gap: 5,
  },
  labPillLight: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#17a398',
  },
  labPillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#0b1110',
    letterSpacing: 0.2,
  },
  labPillTextLight: {
    color: '#0f172a',
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 28,
    marginBottom: 6,
  },
  greetingTitleLight: {
    color: '#0b1110',
  },
  heroSubtitle: {
    fontSize: 11.5,
    color: '#a7f3d0',
    lineHeight: 16,
    opacity: 0.85,
    marginBottom: 14,
  },
  heroSubtitleLight: {
    color: '#475569',
    opacity: 1,
  },
  heroBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playTopChartsBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fdfbf7',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  playTopChartsBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0b1110',
    letterSpacing: 0.5,
  },
  addTrackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f59e0b',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 4,
  },
  addTrackBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0b1110',
  },
  albumsSection: {
    marginBottom: 20,
  },
  albumsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  albumsTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  albumsSectionTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.2,
  },
  albumsSectionTitleLight: {
    color: '#0b1110',
  },
  albumsCountPill: {
    backgroundColor: '#0b1110',
    borderWidth: 1,
    borderColor: '#17a398',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  albumsCountText: {
    color: '#17a398',
    fontSize: 9,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  albumsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fdfbf7',
  },
  topTracksBadge: {
    backgroundColor: '#0b1110',
    borderWidth: 1,
    borderColor: '#263330',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  topTracksText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#17a398',
    letterSpacing: 0.5,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#141d1b',
    borderWidth: 1,
    borderColor: '#263330',
  },
  filterPillActive: {
    backgroundColor: '#fdfbf7',
    borderColor: '#fdfbf7',
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94a3b8',
  },
  filterPillTextActive: {
    color: '#0b1110',
  },
  tracksContainer: {
    paddingBottom: 20,
  },
  emptyCard: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '600',
  },
  loadMoreBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#141d1b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#263330',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  loadMoreText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#17a398',
    letterSpacing: 0.5,
  },
});

export default React.memo(HomeScreen);
