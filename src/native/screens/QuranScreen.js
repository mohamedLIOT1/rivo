import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
} from 'react-native';
import { BookOpen, Search, Play, Pause, Disc, User, Volume2 } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';
import SongItem from '../ui/SongItem';
import {
  isQuranContent,
  getQuranReciterName,
  FAMOUS_RECITERS,
} from '../../utils/quranUtils';

export default function QuranScreen({ onTrackAction }) {
  const { playTrack, currentTrack, isPlaying, tracks: audioTracks, downloadedTracks = [] } = useAudioPlayer();
  const { tracks: userTracks } = useUser();
  const { appMode } = useConnectivity();
  const { isDark } = useTheme();
  const [selectedReciter, setSelectedReciter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const isOffline = appMode === 'offline';
  const allTracks = isOffline
    ? (Array.isArray(downloadedTracks) ? downloadedTracks : [])
    : ((Array.isArray(userTracks) && userTracks.length > 0) ? userTracks : (audioTracks || []));

  // Filter strictly Quranic tracks
  const quranTracks = useMemo(() => {
    return (allTracks || []).filter(isQuranContent);
  }, [allTracks]);

  // Reciters extracted from quran tracks
  const recitersList = useMemo(() => {
    const map = new Map();
    quranTracks.forEach((t) => {
      const name = getQuranReciterName(t);
      if (!map.has(name)) {
        map.set(name, { name, count: 0, cover: t.coverUrl || t.cover });
      }
      map.get(name).count += 1;
    });
    return Array.from(map.values());
  }, [quranTracks]);

  // Filtered tracks
  const displayedTracks = useMemo(() => {
    let result = quranTracks;
    if (selectedReciter) {
      result = result.filter(
        (t) => getQuranReciterName(t).toLowerCase() === selectedReciter.toLowerCase()
      );
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.artist?.toLowerCase().includes(q) ||
          getQuranReciterName(t).toLowerCase().includes(q)
      );
    }
    return result;
  }, [quranTracks, selectedReciter, searchQuery]);

  return (
    <View style={[styles.container, !isDark && { backgroundColor: '#fdfbf7' }]}>
      {/* Header Banner with Arabic Aesthetic */}
      <View style={styles.bannerOuter}>
        <View style={styles.bannerShadow} />
        <View style={styles.banner}>
          <View style={styles.bannerTopRow}>
            <View style={styles.quranPill}>
              <BookOpen size={13} color={colors.ink} />
              <Text style={styles.quranPillText}>المصحف المرتل الصوتي</Text>
            </View>
            <CassetteTag label="RECITATIONS" bg={colors.ink} textColor={colors.mint} />
          </View>

          <Text style={styles.arabicTitle}>القرآن الكريم</Text>
          <Text style={styles.arabicSub}>
            استمع لتلاوات خاشعة بأصوات كبار القراء بدقة صوتية عالية وبدون إعلانات.
          </Text>

          {/* Search bar inside Quran */}
          <View style={styles.searchBar}>
            <Search size={16} color={colors.ink} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="ابحث عن سورة أو قارئ..."
              placeholderTextColor={colors.grayText}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>
      </View>

      {/* Reciters Horizontal Carousel */}
      <View style={styles.recitersSection}>
        <Text style={styles.sectionHeading}>كبار القراء • RECITERS</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.reciterScroll}
        >
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
              ]}
            >
              الكل (ALL)
            </Text>
          </TouchableOpacity>

          {FAMOUS_RECITERS.slice(0, 8).map((r) => {
            const active = selectedReciter === r.name;
            return (
              <TouchableOpacity
                key={r.name}
                style={[styles.reciterPill, active && styles.reciterPillActive]}
                onPress={() => setSelectedReciter(active ? null : r.name)}
              >
                <Text
                  style={[
                    styles.reciterPillText,
                    active && styles.reciterPillTextActive,
                  ]}
                >
                  {r.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Tracks List */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.listHeader}>
          <Text style={styles.listCount}>
            {displayedTracks.length} تلاوة مسجلة • RECITATIONS
          </Text>
          {selectedReciter && (
            <TouchableOpacity onPress={() => setSelectedReciter(null)}>
              <Text style={styles.clearFilterText}>إلغاء التصفية ✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {displayedTracks.length === 0 ? (
          <View style={styles.emptyCard}>
            <BookOpen size={36} color={colors.mint} />
            <Text style={styles.emptyTitle}>
              {isOffline ? 'لا توجد سور قرآنية محملة' : 'لا توجد تلاوات مطابقة'}
            </Text>
            <Text style={styles.emptySub}>
              {isOffline
                ? 'لم تقم بتحميل أي سور أو تلاوات بعد. قم بالتحميل في الوضع الأون لاين لتستمع إليها بدون إنترنت.'
                : 'جرب البحث باسم سورة أو قارئ آخر.'}
            </Text>
          </View>
        ) : (
          <View style={styles.tracksList}>
            {displayedTracks.map((track, idx) => (
              <SongItem
                key={track._id || track.id || idx}
                track={track}
                index={idx + 1}
                onPlay={(t) => playTrack(t, displayedTracks)}
                onMorePress={() => onTrackAction && onTrackAction(track)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  bannerOuter: {
    margin: 14,
    marginBottom: 10,
    position: 'relative',
  },
  bannerShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.tealDark,
    borderRadius: 12,
  },
  banner: {
    backgroundColor: '#044a37',
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 12,
    padding: 16,
  },
  bannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  quranPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  quranPillText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.ink,
  },
  arabicTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'right',
    marginBottom: 4,
  },
  arabicSub: {
    fontSize: 11,
    color: '#a7f3d0',
    textAlign: 'right',
    lineHeight: 16,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'right',
  },
  recitersSection: {
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  sectionHeading: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.paper,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  reciterScroll: {
    gap: 8,
    paddingRight: 14,
  },
  reciterPill: {
    backgroundColor: colors.surfaceDark,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reciterPillActive: {
    backgroundColor: colors.mint,
    borderColor: colors.ink,
  },
  reciterPillText: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 11,
    color: colors.paperMuted,
  },
  reciterPillTextActive: {
    color: colors.ink,
    fontWeight: '900',
  },
  scrollContent: {
    padding: 14,
    paddingTop: 4,
    paddingBottom: 110,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 6,
  },
  listCount: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.tealLight,
  },
  clearFilterText: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 10,
    color: colors.rust,
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceDark,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 10,
  },
  emptyTitle: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 14,
    color: colors.paper,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 11,
    color: colors.paperMuted,
    marginTop: 4,
  },
  tracksList: {
    gap: 8,
  },
});
