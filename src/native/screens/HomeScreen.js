import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {
  Play,
  Pause,
  Plus,
  Sparkles,
  Disc,
  Radio,
  MessageSquare,
  Flame,
  Music,
  Headphones,
  Sliders,
} from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';
import BrutalCard from '../ui/BrutalCard';
import BrutalButton from '../ui/BrutalButton';
import SongItem from '../ui/SongItem';
import { isQuranContent } from '../../utils/quranUtils';

const { width } = Dimensions.get('window');

export default function HomeScreen({
  onOpenJam,
  onOpenChat,
  onOpenAddSong,
  onOpenEqualizer,
  onTrackAction,
  onNavigateTab,
}) {
  const { currentTrack, isPlaying, playTrack, togglePlayPause, tracks: audioTracks } = useAudioPlayer();
  const { currentUser, tracks: userTracks, fetchPublicTracks } = useUser();
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'music' | 'podcasts'
  const [refreshing, setRefreshing] = useState(false);

  const allTracks = userTracks.length > 0 ? userTracks : audioTracks;

  // Filter music only (strictly exclude Quran from main music home)
  const displayTracks = useMemo(() => {
    const musicOnly = (allTracks || []).filter((t) => !isQuranContent(t));
    if (activeFilter === 'podcasts') {
      const podTracks = musicOnly.filter(
        (t) =>
          t.isPodcast ||
          t.album?.toLowerCase().includes('podcast') ||
          t.artist?.toLowerCase().includes('podcast')
      );
      return podTracks.length > 0 ? podTracks : musicOnly;
    }
    return musicOnly;
  }, [allTracks, activeFilter]);

  const quickRotation = displayTracks.slice(0, 6);
  const vaultTracks = displayTracks.slice(6, 40);

  const badgeColors = ['#0f756d', '#111615', '#17a398', '#dc2626', '#f59e0b', '#1e3a8a'];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const isTrackActive = (t) => {
    if (!currentTrack || !t) return false;
    const curId = currentTrack.id || currentTrack._id;
    const tId = t.id || t._id;
    return Boolean(curId && tId && String(curId) === String(tId));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await fetchPublicTracks();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.teal}
          colors={[colors.teal]}
        />
      }
    >
      {/* ─────────────────────────────────────────
          HERO BANNER (MUSIC STREAMING LAB)
          ───────────────────────────────────────── */}
      <View style={styles.heroOuter}>
        <View style={styles.heroShadow} />
        <View style={styles.heroCard}>
          {/* Subtle Background Watermark */}
          <Text style={styles.watermark}>RIVO</Text>

          {/* Top Pill */}
          <View style={styles.labPill}>
            <View style={styles.pulseDot} />
            <Text style={styles.labPillText}>UNLIMITED HI-FI STREAMING • CAIRO SOUND LAB</Text>
          </View>

          {/* Heading */}
          <Text style={styles.greetingTitle}>
            {getGreeting()},{'\n'}
            <Text style={{ color: colors.mint }}>
              {currentUser?.name ? currentUser.name.split(' ')[0] : 'Listener'}
            </Text>
          </Text>

          <Text style={styles.heroSubtitle}>
            Stream Egyptian rap, indie hits, retro cassettes, and personalized mixes. Crystal-clear 24-bit audio.
          </Text>

          {/* Quick Action Buttons */}
          <View style={styles.heroBtnRow}>
            <TouchableOpacity
              style={styles.playDailyBtn}
              onPress={() => {
                if (displayTracks.length > 0) {
                  playTrack(displayTracks[0], displayTracks);
                }
              }}
            >
              <Play size={16} color={colors.ink} fill={colors.ink} />
              <Text style={styles.playDailyBtnText}>PLAY DAILY MIX</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.addTrackBtn} onPress={onOpenAddSong}>
              <Plus size={16} color={colors.ink} strokeWidth={3} />
              <Text style={styles.addTrackBtnText}>Add Track</Text>
            </TouchableOpacity>
          </View>

          {/* Live Jam & Chat Floating Bar */}
          <View style={styles.communityRow}>
            <TouchableOpacity style={styles.commBtn} onPress={onOpenJam}>
              <Radio size={14} color={colors.rust} />
              <Text style={styles.commBtnText}>JAM LIVE</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.commBtn} onPress={onOpenChat}>
              <MessageSquare size={14} color={colors.teal} />
              <Text style={styles.commBtnText}>COMMUNITY CHAT</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.commBtn} onPress={onOpenEqualizer}>
              <Sliders size={14} color={colors.mint} />
              <Text style={styles.commBtnText}>EQ LAB</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ─────────────────────────────────────────
          FILTER PILLS & HEADER
          ───────────────────────────────────────── */}
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>Daily Rotation & Favorites</Text>
          <Text style={styles.sectionSubtitle}>AUTHENTIC DISPENSARY CRATES</Text>
        </View>

        <View style={styles.filterPills}>
          {['all', 'music', 'podcasts'].map((filter) => {
            const active = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterPill, active && styles.filterPillActive]}
                onPress={() => setActiveFilter(filter)}
              >
                <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>
                  {filter.toUpperCase()}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ─────────────────────────────────────────
          QUICK ROTATION 2-COLUMN BLISTER PACKS
          ───────────────────────────────────────── */}
      <View style={styles.gridContainer}>
        {quickRotation.map((track, index) => {
          const active = isTrackActive(track);
          const color = badgeColors[index % badgeColors.length];

          return (
            <TouchableOpacity
              key={track._id || track.id || index}
              style={[styles.blisterCard, active && styles.blisterCardActive]}
              activeOpacity={0.85}
              onPress={() => {
                if (active) {
                  togglePlayPause();
                } else {
                  playTrack(track, displayTracks);
                }
              }}
            >
              <View style={styles.blisterCoverBox}>
                <Image
                  source={{
                    uri:
                      track.coverUrl ||
                      track.cover ||
                      'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
                  }}
                  style={styles.blisterCover}
                />
                {active && (
                  <View style={styles.playingDiscOverlay}>
                    {isPlaying ? (
                      <Pause size={16} color={colors.paper} fill={colors.paper} />
                    ) : (
                      <Play size={16} color={colors.paper} fill={colors.paper} />
                    )}
                  </View>
                )}
              </View>

              <View style={styles.blisterInfo}>
                <Text style={styles.blisterTitle} numberOfLines={1}>
                  {track.title}
                </Text>
                <Text style={styles.blisterArtist} numberOfLines={1}>
                  {track.artist || 'Unknown Artist'}
                </Text>
              </View>

              <View style={[styles.blisterTag, { backgroundColor: color }]}>
                <Disc size={10} color="#fff" />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─────────────────────────────────────────
          DISPENSARY VAULT TRACKS LIST
          ───────────────────────────────────────── */}
      <View style={styles.vaultHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Flame size={18} color={colors.rust} />
          <Text style={styles.vaultTitle}>Sonic Dispensary Vault</Text>
        </View>
        <CassetteTag label={`${vaultTracks.length} TRACKS`} bg={colors.ink} textColor={colors.tealLight} />
      </View>

      <View style={styles.tracksList}>
        {vaultTracks.map((track, index) => (
          <SongItem
            key={track._id || track.id || index}
            track={track}
            index={index + 7}
            onMorePress={() => onTrackAction && onTrackAction(track)}
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    padding: 14,
    paddingBottom: 110,
  },
  heroOuter: {
    marginBottom: 20,
    position: 'relative',
  },
  heroShadow: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: -5,
    bottom: -5,
    backgroundColor: colors.tealDark,
    borderRadius: 14,
  },
  heroCard: {
    backgroundColor: colors.deepForest,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 14,
    padding: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  watermark: {
    position: 'absolute',
    right: -10,
    bottom: -20,
    fontSize: 90,
    fontFamily: 'monospace',
    fontWeight: '900',
    color: 'rgba(255,255,255,0.04)',
    letterSpacing: -4,
  },
  labPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.ink,
    gap: 6,
    marginBottom: 10,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.teal,
  },
  labPillText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 9,
    color: colors.ink,
  },
  greetingTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 24,
    color: '#ffffff',
    lineHeight: 28,
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#a7f3d0',
    lineHeight: 16,
    marginBottom: 14,
  },
  heroBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  playDailyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  playDailyBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: colors.ink,
  },
  addTrackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 4,
  },
  addTrackBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: colors.ink,
  },
  communityRow: {
    flexDirection: 'row',
    gap: 6,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 10,
  },
  commBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingVertical: 6,
    gap: 4,
  },
  commBtnText: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 9,
    color: '#ffffff',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 15,
    color: colors.paper,
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '800',
    color: colors.tealLight,
    marginTop: 2,
  },
  filterPills: {
    flexDirection: 'row',
    gap: 4,
  },
  filterPill: {
    backgroundColor: colors.surfaceDark,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  filterPillActive: {
    backgroundColor: colors.teal,
    borderColor: colors.mint,
  },
  filterPillText: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 9,
    color: colors.paperMuted,
  },
  filterPillTextActive: {
    color: colors.ink,
    fontWeight: '900',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 8,
  },
  blisterCard: {
    width: (width - 36) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    padding: 8,
    position: 'relative',
  },
  blisterCardActive: {
    borderColor: colors.mint,
    backgroundColor: '#162e2a',
  },
  blisterCoverBox: {
    width: 44,
    height: 44,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.ink,
    overflow: 'hidden',
    position: 'relative',
  },
  blisterCover: {
    width: '100%',
    height: '100%',
  },
  playingDiscOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blisterInfo: {
    flex: 1,
    marginLeft: 8,
    marginRight: 4,
  },
  blisterTitle: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 11,
    color: colors.paper,
  },
  blisterArtist: {
    fontSize: 10,
    color: colors.paperMuted,
    marginTop: 2,
  },
  blisterTag: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vaultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 8,
  },
  vaultTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 14,
    color: colors.paper,
  },
  tracksList: {
    gap: 8,
  },
});
