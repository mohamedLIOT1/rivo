import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Platform,
} from 'react-native';
import { BookOpen, Play } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation, useLiteMode } from '../context/LocalizationContext';
import { colors } from '../theme/colors';
import SongItem from '../ui/SongItem';
import QuranRadioModal from '../components/QuranRadioModal';
import QuranHeroBanner from '../components/quran/QuranHeroBanner';
import { styles } from './QuranScreen.styles';

const ReciterPill = React.memo(function ReciterPill({ reciter, active, isRTL, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.reciterPill, active && styles.reciterPillActive]}
      onPress={() => onPress(reciter.name, active)}
    >
      <Text
        style={[
          styles.reciterPillText,
          active && styles.reciterPillTextActive,
          isRTL && { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'sans-serif' }
        ]}
      >
        {reciter.name} ({reciter.count})
      </Text>
    </TouchableOpacity>
  );
});

const ReciterGridCard = React.memo(function ReciterGridCard({ reciter, isDark, isRTL, labelText, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.reciterCard, !isDark && styles.reciterCardLight]}
      onPress={() => onPress(reciter.name)}
      activeOpacity={0.8}
    >
      {reciter.cover ? (
        <Image source={{ uri: reciter.cover }} style={styles.reciterCardCover} fadeDuration={0} />
      ) : (
        <View style={styles.reciterCardCover}>
          <Text style={styles.reciterCardCoverFallbackText}>{reciter.name?.slice(0, 2) || 'ق'}</Text>
        </View>
      )}
      <View style={styles.reciterCardInfo}>
        <Text style={[styles.reciterCardName, !isDark && { color: colors.ink }]} numberOfLines={1}>
          {reciter.name}
        </Text>
        <View style={styles.reciterCardBadge}>
          <Text style={[styles.reciterCardBadgeText, isRTL && { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'sans-serif' }]}>
            {labelText}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});
import {
  isQuranContent,
  getQuranReciterName,
  cleanQuranTrackTitle,
  normalizeArabicText,
  sortQuranTracks,
  getSurahNumber,
  getSurahName,
  isRadioTrack,
  isAyahOrClip,
} from '../../utils/quranUtils';
import {
  getQuranRecitersList,
  getSurahsForReciter,
  filterQuranSurahs,
  fetchMp3QuranReciters,
} from '../../utils/quranRecitersService';

function QuranScreen({ onTrackAction }) {
  const { playTrack, currentTrack, isPlaying, isLoading, tracks: audioTracks, downloadedTracks = [] } = useAudioPlayer();
  const curTrackId = String(currentTrack?._id || currentTrack?.id || '');
  const { tracks: userTracks, likedTrackIds = [] } = useUser();
  const { appMode } = useConnectivity();
  const { isDark } = useTheme();
  const { t, isRTL } = useTranslation();
  const { isLiteMode } = useLiteMode();
  const [selectedReciter, setSelectedReciter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(40);
  const [isRadioModalOpen, setIsRadioModalOpen] = useState(false);

  const likedSet = useMemo(() => new Set((likedTrackIds || []).map(String)), [likedTrackIds]);
  const downloadedSet = useMemo(() => new Set((downloadedTracks || []).map(t => String(t._id || t.id))), [downloadedTracks]);

  React.useEffect(() => {
    setVisibleLimit(40);
  }, [selectedReciter, searchQuery]);

  const isOffline = appMode === 'offline';
  const allTracks = isOffline
    ? (Array.isArray(downloadedTracks) ? downloadedTracks : [])
    : ((Array.isArray(userTracks) && userTracks.length > 0) ? userTracks : (audioTracks || []));

  // Filter strictly Quranic tracks with robust deduplication
  const quranTracks = useMemo(() => {
    const raw = (allTracks || []).filter(t => isQuranContent(t) && !isRadioTrack(t));
    const seenAudio = new Set();
    const seenMeta = new Set();
    const deduped = [];
    for (const t of raw) {
      const reciter = getQuranReciterName(t);
      const cleanTitle = cleanQuranTrackTitle(t.title || '');
      const metaKey = `${normalizeArabicText(reciter)}:::${normalizeArabicText(cleanTitle)}`;
      
      let audioKey = null;
      if (t.audioUrl && typeof t.audioUrl === 'string' && t.audioUrl.length > 10) {
        const ytMatch = t.audioUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || t.audioUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        audioKey = ytMatch ? `yt:${ytMatch[1]}` : `url:${t.audioUrl.trim().toLowerCase()}`;
      }

      if (audioKey && seenAudio.has(audioKey)) {
        continue;
      }
      if (metaKey && seenMeta.has(metaKey)) {
        continue;
      }

      if (audioKey) seenAudio.add(audioKey);
      if (metaKey) seenMeta.add(metaKey);
      deduped.push(t);
    }
    return deduped;
  }, [allTracks]);

  const [apiReciters, setApiReciters] = useState([]);

  // Fetch full mp3quran reciters catalog asynchronously in background with cancellation support
  React.useEffect(() => {
    if (isOffline) return;
    const controller = new AbortController();
    fetchMp3QuranReciters(controller.signal)
      .then((list) => {
        if (!controller.signal.aborted && Array.isArray(list) && list.length > 0) {
          setApiReciters(list);
        }
      })
      .catch(() => {});
    return () => {
      try { controller.abort(); } catch {}
    };
  }, [isOffline]);

  // Reciters catalog combining canonical famous reciters (114 surahs each), custom DB reciters, and mp3quran
  const recitersList = useMemo(() => {
    return getQuranRecitersList({ quranTracks, downloadedTracks, isOffline, apiReciters });
  }, [quranTracks, downloadedTracks, isOffline, apiReciters]);

  // Full Surahs Catalog (1 to 114) for selected reciter or full library sorted
  const displayedTracks = useMemo(() => {
    let result = [];
    if (selectedReciter) {
      result = getSurahsForReciter(selectedReciter, { quranTracks, downloadedTracks, isOffline, apiReciters });
    } else {
      result = sortQuranTracks(quranTracks);
    }
    if (searchQuery.trim()) {
      result = filterQuranSurahs(result, searchQuery);
    }
    return result;
  }, [selectedReciter, searchQuery, quranTracks, downloadedTracks, isOffline, apiReciters]);

  const handlePlayTrack = useCallback((track) => playTrack(track, displayedTracks), [playTrack, displayedTracks]);
  const handleMorePress = useCallback((track) => { if (onTrackAction) onTrackAction(track); }, [onTrackAction]);
  const keyExtractor = useCallback((track, idx) => String(track?._id || track?.id || `quran-${idx}`), []);
  const handlePlayAll = useCallback(() => {
    if (displayedTracks.length > 0) playTrack(displayedTracks[0], displayedTracks);
  }, [displayedTracks, playTrack]);
  const handleClearFilter = useCallback(() => {
    setSelectedReciter(null);
    setSearchQuery('');
  }, []);

  const renderSongItem = useCallback(({ item: track, index }) => {
    const sNum = getSurahNumber(track);
    const isAyah = track.isAyah || isAyahOrClip(track);
    const displayIndex = isAyah ? (isRTL ? 'آية' : 'Ayah') : ((sNum >= 1 && sNum <= 114) ? sNum : (index + 1));
    const trackId = String(track._id || track.id || '');
    const isCurrent = curTrackId !== '' && curTrackId === trackId;
    return (
      <SongItem
        key={trackId || index}
        track={track}
        index={displayIndex}
        isCurrent={isCurrent}
        isPlaying={isCurrent && isPlaying}
        isLoading={isCurrent && isLoading}
        isLiked={likedSet.has(trackId)}
        isDownloaded={downloadedSet.has(trackId)}
        isDark={isDark}
        showBpmKey={false}
        onPlay={handlePlayTrack}
        onMorePress={handleMorePress}
      />
    );
  }, [curTrackId, isPlaying, isLoading, likedSet, downloadedSet, isDark, isRTL, handlePlayTrack, handleMorePress]);

  const isRecitersGridMode = !selectedReciter && !searchQuery.trim();

  const handleToggleReciterPill = useCallback((name, active) => {
    setSelectedReciter(active ? null : name);
  }, []);

  const handleSelectReciterCard = useCallback((name) => {
    setSelectedReciter(name);
  }, []);

  const reciterKeyExtractor = useCallback((item, idx) => String(item?.name || `reciter-${idx}`), []);

  const renderReciterPillItem = useCallback(({ item }) => (
    <ReciterPill
      reciter={item}
      active={selectedReciter === item.name}
      isRTL={isRTL}
      onPress={handleToggleReciterPill}
    />
  ), [selectedReciter, isRTL, handleToggleReciterPill]);

  const renderReciterGridItem = useCallback(({ item }) => (
    <ReciterGridCard
      reciter={item}
      isDark={isDark}
      isRTL={isRTL}
      labelText={t('quran.surahsCount', { count: item.count })}
      onPress={handleSelectReciterCard}
    />
  ), [isDark, isRTL, t, handleSelectReciterCard]);

  const allRecitersPillHeader = useMemo(() => (
    <TouchableOpacity
      style={[
        styles.reciterPill,
        selectedReciter === null && styles.reciterPillActive,
      ]}
      onPress={() => setSelectedReciter(null)}
    >
      <Text
        style={[
          styles.reciterPillText,
          selectedReciter === null && styles.reciterPillTextActive,
          isRTL && { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'sans-serif' }
        ]}
      >
        {t('quran.tabReciters', { count: recitersList.length })}
      </Text>
    </TouchableOpacity>
  ), [selectedReciter, isRTL, t, recitersList.length]);

  const renderHeader = useMemo(() => {
    return (
      <View>
        <QuranHeroBanner
          styles={styles}
          isRTL={isRTL}
          t={t}
          onOpenRadio={() => setIsRadioModalOpen(true)}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        {/* Reciters Horizontal Carousel (Virtualized FlatList) */}
        <View style={styles.recitersSection}>
          <Text style={[styles.sectionHeading, !isDark && { color: colors.ink }, isRTL && { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'sans-serif', textAlign: 'right' }]}>
            {t('quran.reciters')}
          </Text>
          <FlatList
            horizontal
            data={recitersList}
            keyExtractor={reciterKeyExtractor}
            renderItem={renderReciterPillItem}
            ListHeaderComponent={allRecitersPillHeader}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.reciterScroll}
            windowSize={5}
            initialNumToRender={8}
            maxToRenderPerBatch={6}
            removeClippedSubviews={Platform.OS === 'android'}
          />
        </View>

        {/* Subheader / Grid Area */}
        {isRecitersGridMode ? (
          <View style={styles.reciterGridSection}>
            <View style={styles.reciterGridHeader}>
              <Text style={[styles.reciterGridTitle, !isDark && { color: colors.ink }]}>
                {t('quran.selectReciter')}
              </Text>
              <Text style={styles.reciterGridSubtitle}>
                {t('quran.browseSurahs')}
              </Text>
            </View>
          </View>
        ) : (
          <>
            {selectedReciter && (
              <View style={[styles.selectedReciterBanner, !isDark && styles.selectedReciterBannerLight]}>
                <View style={[styles.selectedReciterRow, isRTL && { flexDirection: 'row-reverse' }]}>
                  <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => setSelectedReciter(null)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.backBtnText, isRTL && { letterSpacing: 0 }]}>
                      {t('quran.backToReciters')}
                    </Text>
                  </TouchableOpacity>

                  <View style={{ flex: 1, alignItems: isRTL ? 'flex-start' : 'flex-end' }}>
                    <Text style={[styles.selectedReciterName, !isDark && { color: colors.ink }]} numberOfLines={1}>
                      {t('quran.sheikh', { name: selectedReciter })}
                    </Text>
                    <Text style={styles.selectedReciterCount}>
                      {t('quran.surahsAvailableCount', { count: displayedTracks.length })}
                    </Text>
                  </View>
                </View>

                {displayedTracks.length > 0 && (
                  <TouchableOpacity
                    style={styles.playAllBtn}
                    onPress={handlePlayAll}
                    activeOpacity={0.8}
                  >
                    <Play size={14} color={colors.ink} fill={colors.ink} />
                    <Text style={[styles.playAllBtnText, isRTL && { letterSpacing: 0 }]}>
                      {t('quran.playAllFromSurah', { name: getSurahName(displayedTracks[0]) || (isRTL ? 'البداية' : 'Start') })}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            <View style={[styles.listHeader, isRTL && { flexDirection: 'row-reverse' }]}>
              <Text style={styles.listCount}>
                {t('quran.recitationsAvailable', { count: displayedTracks.length })}
              </Text>
              {(selectedReciter || searchQuery.trim()) && (
                <TouchableOpacity onPress={handleClearFilter}>
                  <Text style={styles.clearFilterText}>{t('quran.clearFilter')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>
    );
  }, [
    isDark,
    isRTL,
    t,
    searchQuery,
    selectedReciter,
    isRecitersGridMode,
    recitersList,
    reciterKeyExtractor,
    renderReciterPillItem,
    allRecitersPillHeader,
    displayedTracks,
    handlePlayAll,
    handleClearFilter,
  ]);

  const renderFooter = useCallback(() => {
    if (!isRecitersGridMode || displayedTracks.length === 0) return null;
    return (
      <View style={{ marginTop: 14, marginBottom: 8, flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 }}>
        <Text style={[styles.sectionHeading, !isDark && { color: colors.ink }, isRTL && { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'sans-serif', textAlign: 'right' }]}>
          {t('quran.allTracksTitle') || (isRTL ? 'جميع التلاوات والآيات المسجلة' : 'All Recitations & Saved Ayahs')} ({displayedTracks.length})
        </Text>
        <TouchableOpacity
          style={[styles.playAllBtn, { marginTop: 0 }]}
          onPress={handlePlayAll}
          activeOpacity={0.8}
        >
          <Play size={12} color={colors.ink} fill={colors.ink} />
          <Text style={[styles.playAllBtnText, isRTL && { letterSpacing: 0 }]}>
            {t('quran.playAllRecitations', { count: displayedTracks.length }) || (isRTL ? 'تشغيل الكل' : 'Play All')}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }, [isRecitersGridMode, displayedTracks.length, isRTL, isDark, t, handlePlayAll]);

  const renderEmpty = useCallback(() => {
    if (isRecitersGridMode) return null;
    return (
      <View style={styles.emptyCard}>
        <BookOpen size={36} color={colors.mint} />
        <Text style={[styles.emptyTitle, isRTL && { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'Geeza Pro' : 'sans-serif' }]}>
          {isOffline ? t('quran.noDownloadedRecitations') : t('quran.noRecitations')}
        </Text>
        <Text style={[styles.emptySub, isRTL && { letterSpacing: 0, lineHeight: 20 }]}>
          {t('quran.noRecitationsSub')}
        </Text>
      </View>
    );
  }, [isRecitersGridMode, isOffline, t, isRTL]);

  return (
    <View style={[styles.container, !isDark && { backgroundColor: '#fdfbf7' }]}>
      <FlatList
        key={isRecitersGridMode ? 'quran_reciters_grid' : 'quran_tracks_list'}
        data={isRecitersGridMode ? recitersList : displayedTracks}
        numColumns={isRecitersGridMode ? 2 : 1}
        columnWrapperStyle={isRecitersGridMode ? { justifyContent: 'space-between' } : undefined}
        keyExtractor={isRecitersGridMode ? reciterKeyExtractor : keyExtractor}
        renderItem={isRecitersGridMode ? renderReciterGridItem : renderSongItem}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        windowSize={5}
        initialNumToRender={isLiteMode ? 6 : 8}
        maxToRenderPerBatch={isLiteMode ? 4 : 6}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === 'android'}
      />
      {isRadioModalOpen && (
        <QuranRadioModal isOpen={isRadioModalOpen} visible={isRadioModalOpen} onClose={() => setIsRadioModalOpen(false)} />
      )}
    </View>
  );
}

export default React.memo(QuranScreen);
