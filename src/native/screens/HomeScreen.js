import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { Play, Plus, Disc } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';
import SongItem from '../ui/SongItem';
import { isQuranContent } from '../../utils/quranUtils';
import { normalizeCoverUri } from '../utils/coverUtils';

const { width } = Dimensions.get('window');
const ALBUM_CARD_WIDTH = (width - 34) / 2;

export default function HomeScreen({
  onOpenAddSong,
  onTrackAction,
}) {
  const { playTrack, currentTrack, downloadedTracks = [] } = useAudioPlayer();
  const { currentUser, tracks: userTracks, albums = [], likedTrackIds = [], fetchPublicTracks } = useUser();
  const { appMode } = useConnectivity();
  const { isDark } = useTheme();
  const isOffline = appMode === 'offline';
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'music' | 'downloaded'
  const [refreshing, setRefreshing] = useState(false);
  const [visibleCount, setVisibleCount] = useState(30);

  // Filter music only (strictly exclude Quran from main music home)
  const displayTracks = useMemo(() => {
    if (isOffline || activeFilter === 'downloaded') {
      const safeDownloaded = (Array.isArray(downloadedTracks) ? downloadedTracks : []).filter((t) => !isQuranContent(t));
      return safeDownloaded;
    }
    let list = (userTracks || []).filter((t) => !isQuranContent(t));
    return list;
  }, [userTracks, activeFilter, downloadedTracks, isOffline]);

  // Discography Featured Albums (Matching Web UI & Image 3)
  const displayAlbums = useMemo(() => {
    const dbAlbums = (albums || []).filter((alb) => !isQuranContent(alb));
    if (dbAlbums.length > 0) return dbAlbums;

    // Fallback: Group from userTracks
    const map = new Map();
    (userTracks || []).forEach((t) => {
      if (t.album && t.album.trim() && !isQuranContent(t)) {
        const key = t.album.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            name: t.album.trim(),
            artist: t.artist || 'Various Artists',
            cover: t.cover,
            tracks: [t],
          });
        } else {
          map.get(key).tracks.push(t);
        }
      }
    });
    return Array.from(map.values()).slice(0, 16);
  }, [albums, userTracks]);

  const handlePlayAlbum = useCallback((album) => {
    let albTracks = [];
    if (Array.isArray(album.tracks) && album.tracks.length > 0) {
      albTracks = album.tracks;
    } else {
      albTracks = (userTracks || []).filter(t => 
        (t.album && t.album.toLowerCase().trim() === (album.name || '').toLowerCase().trim()) ||
        (album.trackIds && album.trackIds.map(String).includes(String(t.id || t._id)))
      );
    }
    if (albTracks.length > 0) {
      playTrack(albTracks[0], albTracks);
    }
  }, [userTracks, playTrack]);

  const visibleTracks = useMemo(() => {
    return displayTracks.slice(0, visibleCount);
  }, [displayTracks, visibleCount]);

  const curTrackId = String(currentTrack?._id || currentTrack?.id || '');
  const likedSet = useMemo(() => new Set((likedTrackIds || []).map(String)), [likedTrackIds]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchPublicTracks();
    } finally {
      setRefreshing(false);
    }
  };

  const renderHeader = useCallback(() => (
    <View>
      {/* ─────────────────────────────────────────
          HERO BANNER (MUSIC STREAMING LAB)
          Matching exact website layout
          ───────────────────────────────────────── */}
      <View style={styles.heroCard}>
        {/* Subtle Background Watermark */}
        <Text style={styles.watermark}>RIVO</Text>

        {/* Top Pill Badge */}
        <View style={styles.labPill}>
          <View style={[styles.pulseDot, isOffline && { backgroundColor: '#f59e0b' }]} />
          <Text style={styles.labPillText}>
            {isOffline ? '📼 OFFLINE VAULT • ZERO DATA CONSUMPTION' : '🎵 UNLIMITED HI-FI STREAMING • CAIRO MUSIC LAB'}
          </Text>
        </View>

        {/* Heading */}
        <Text style={styles.greetingTitle}>
          {getGreeting()},{' '}
          <Text style={{ color: '#17a398' }}>
            {currentUser?.name ? currentUser.name.split(' ')[0] : 'Listener'}.
          </Text>
        </Text>

        <Text style={styles.heroSubtitle}>
          {isOffline
            ? 'Playing your downloaded songs directly from local storage. 100% offline, zero data usage.'
            : 'Stream Egyptian rap, indie hits, retro cassettes, and personalized mixes. Crystal-clear 24-bit audio, zero ads, seamless listening.'}
        </Text>

        {/* 2 Primary CTA Buttons (Matching Image 3) */}
        <View style={styles.heroBtnRow}>
          <TouchableOpacity
            style={styles.playTopChartsBtn}
            onPress={() => {
              if (displayTracks.length > 0) {
                playTrack(displayTracks[0], displayTracks);
              }
            }}
            activeOpacity={0.85}
          >
            <Play size={14} color="#0b1110" fill="#0b1110" />
            <Text style={styles.playTopChartsBtnText}>PLAY TOP CHARTS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.addTrackBtn}
            onPress={onOpenAddSong}
            activeOpacity={0.85}
          >
            <Plus size={15} color="#0b1110" strokeWidth={2.5} />
            <Text style={styles.addTrackBtnText}>+ Add Track</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─────────────────────────────────────────
          FEATURED ALBUMS SECTION (Matching Image 3)
          ───────────────────────────────────────── */}
      {displayAlbums && displayAlbums.length > 0 && (
        <View style={styles.albumsSection}>
          <View style={styles.albumsHeaderRow}>
            <View style={styles.albumsTitleGroup}>
              <Disc size={18} color="#f59e0b" strokeWidth={2.4} />
              <Text style={[styles.albumsSectionTitle, !isDark && styles.albumsSectionTitleLight]}>
                Featured Albums
              </Text>
              <View style={styles.albumsCountPill}>
                <Text style={styles.albumsCountText}>
                  {displayAlbums.length} {displayAlbums.length === 1 ? 'ALBUM' : 'ALBUMS'}
                </Text>
              </View>
            </View>
          </View>

          {/* 2-Column Grid */}
          <View style={styles.albumsGrid}>
            {displayAlbums.slice(0, 8).map((alb, index) => {
              const coverUri = alb.cover || alb.coverUrl;
              return (
                <TouchableOpacity
                  key={alb.id || alb._id || alb.name || String(index)}
                  style={[styles.albumCard, !isDark && styles.albumCardLight]}
                  onPress={() => handlePlayAlbum(alb)}
                  activeOpacity={0.85}
                >
                  <View style={styles.albumCoverWrap}>
                    <Image
                      source={{ uri: normalizeCoverUri(coverUri) }}
                      style={styles.albumCover}
                      resizeMode="cover"
                    />
                    <View style={styles.albumPlayOverlay}>
                      <View style={styles.albumPlayPill}>
                        <Play size={11} color="#0b1110" fill="#0b1110" style={{ marginLeft: 2 }} />
                      </View>
                    </View>
                  </View>
                  <Text style={[styles.albumTitle, !isDark && styles.albumTitleLight]} numberOfLines={1}>
                    {alb.name}
                  </Text>
                  <Text style={styles.albumArtist} numberOfLines={1}>
                    {alb.artist || 'Various Artists'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* ─────────────────────────────────────────
          SECTION HEADER & FILTER PILLS
          ───────────────────────────────────────── */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Daily Rotation & Favorites</Text>
        <View style={styles.topTracksBadge}>
          <Text style={styles.topTracksText}>TOP TRACKS</Text>
        </View>
      </View>

      {/* Filter Pills Row */}
      <View style={styles.filterPillsRow}>
        <TouchableOpacity
          style={[styles.filterPill, activeFilter === 'all' && styles.filterPillActive]}
          onPress={() => setActiveFilter('all')}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterPillText, activeFilter === 'all' && styles.filterPillTextActive]}>
            All
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterPill, activeFilter === 'music' && styles.filterPillActive]}
          onPress={() => setActiveFilter('music')}
          activeOpacity={0.8}
        >
          <Text style={[styles.filterPillText, activeFilter === 'music' && styles.filterPillTextActive]}>
            Music
          </Text>
        </TouchableOpacity>

        {Array.isArray(downloadedTracks) && downloadedTracks.length > 0 && (
          <TouchableOpacity
            style={[styles.filterPill, activeFilter === 'downloaded' && styles.filterPillActive]}
            onPress={() => setActiveFilter('downloaded')}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterPillText, activeFilter === 'downloaded' && styles.filterPillTextActive]}>
              Downloaded ({downloadedTracks.length})
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  ), [currentUser?.name, displayTracks, displayAlbums, isDark, activeFilter, downloadedTracks, isOffline, onOpenAddSong, playTrack, handlePlayAlbum]);

  const renderFooter = useCallback(() => {
    if (displayTracks.length > visibleCount) {
      return (
        <TouchableOpacity
          style={styles.loadMoreBtn}
          onPress={() => setVisibleCount((c) => c + 30)}
          activeOpacity={0.8}
        >
          <Text style={styles.loadMoreText}>
            + LOAD MORE TRACKS ({displayTracks.length - visibleCount} MORE)
          </Text>
        </TouchableOpacity>
      );
    }

    if (displayTracks.length === 0) {
      return (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>
            {isOffline
              ? 'No offline songs saved yet.\nDownload songs while connected to listen offline here!'
              : 'Loading dispensary tracks...'}
          </Text>
        </View>
      );
    }

    return null;
  }, [displayTracks.length, visibleCount, isOffline]);

  const renderItem = useCallback(({ item }) => {
    const itemId = String(item._id || item.id || '');
    return (
      <SongItem
        track={item}
        isCurrent={curTrackId !== '' && curTrackId === itemId}
        isLiked={likedSet.has(itemId)}
        onPlay={() => playTrack(item, displayTracks)}
        onMorePress={() => onTrackAction && onTrackAction(item)}
      />
    );
  }, [curTrackId, likedSet, displayTracks, onTrackAction, playTrack]);

  return (
    <FlatList
      style={[styles.container, !isDark && { backgroundColor: '#fdfbf7' }]}
      contentContainerStyle={styles.content}
      data={visibleTracks}
      keyExtractor={(item, index) => item._id || item.id || String(index)}
      renderItem={renderItem}
      ListHeaderComponent={renderHeader}
      ListFooterComponent={renderFooter}
      initialNumToRender={10}
      maxToRenderPerBatch={8}
      windowSize={5}
      removeClippedSubviews={Platform.OS === 'android'}
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
  greetingTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    lineHeight: 28,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 11.5,
    color: '#a7f3d0',
    lineHeight: 16,
    opacity: 0.85,
    marginBottom: 14,
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
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
  albumCard: {
    width: ALBUM_CARD_WIDTH,
    backgroundColor: '#141d1b',
    borderWidth: 1.5,
    borderColor: '#263330',
    borderRadius: 14,
    padding: 10,
  },
  albumCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  albumCoverWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#0b1110',
    marginBottom: 8,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#263330',
  },
  albumCover: {
    width: '100%',
    height: '100%',
  },
  albumPlayOverlay: {
    position: 'absolute',
    right: 6,
    bottom: 6,
  },
  albumPlayPill: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#f59e0b',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  albumTitle: {
    color: '#ffffff',
    fontSize: 12.5,
    fontWeight: '800',
    marginBottom: 2,
  },
  albumTitleLight: {
    color: '#0b1110',
  },
  albumArtist: {
    color: '#94a3b8',
    fontSize: 10.5,
    fontWeight: '600',
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
