import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Play, Plus } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { colors } from '../theme/colors';
import SongItem from '../ui/SongItem';
import { isQuranContent } from '../../utils/quranUtils';

export default function HomeScreen({
  onOpenAddSong,
  onTrackAction,
}) {
  const { playTrack } = useAudioPlayer();
  const { currentUser, tracks: userTracks, fetchPublicTracks } = useUser();
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'music'
  const [refreshing, setRefreshing] = useState(false);

  // Filter music only (strictly exclude Quran from main music home)
  const displayTracks = useMemo(() => {
    return (userTracks || []).filter((t) => !isQuranContent(t));
  }, [userTracks]);

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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#17a398"
          colors={['#17a398']}
        />
      }
    >
      {/* ─────────────────────────────────────────
          HERO BANNER (MUSIC STREAMING LAB)
          Matching exact website layout
          ───────────────────────────────────────── */}
      <View style={styles.heroCard}>
        {/* Subtle Background Watermark */}
        <Text style={styles.watermark}>RIVO</Text>

        {/* Top Pill Badge */}
        <View style={styles.labPill}>
          <View style={styles.pulseDot} />
          <Text style={styles.labPillText}>
            🎵 UNLIMITED HI-FI STREAMING • CAIRO MUSIC LAB
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
          Stream Egyptian rap, indie hits, retro cassettes, and personalized mixes. Crystal-clear 24-bit audio, zero ads, seamless listening.
        </Text>

        {/* 2 Primary CTA Buttons */}
        <View style={styles.heroBtnRow}>
          <TouchableOpacity
            style={styles.playDailyBtn}
            onPress={() => {
              if (displayTracks.length > 0) {
                playTrack(displayTracks[0], displayTracks);
              }
            }}
            activeOpacity={0.85}
          >
            <Play size={14} color="#0b1110" fill="#0b1110" />
            <Text style={styles.playDailyBtnText}>PLAY DAILY MIX</Text>
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
      </View>

      {/* ─────────────────────────────────────────
          TRACKS LIST
          ───────────────────────────────────────── */}
      <View style={styles.tracksContainer}>
        {displayTracks.map((track, index) => (
          <SongItem
            key={track._id || track.id || index}
            track={track}
            onPlay={() => playTrack(track, displayTracks)}
            onMorePress={() => onTrackAction && onTrackAction(track)}
          />
        ))}

        {displayTracks.length === 0 && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Loading dispensary tracks...</Text>
          </View>
        )}
      </View>
    </ScrollView>
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
  playDailyBtn: {
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
  playDailyBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#0b1110',
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
});
