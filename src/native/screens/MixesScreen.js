import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
} from 'react-native';
import { Play, Shuffle, Disc, Sparkles, ArrowLeft, Music } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';
import BrutalCard from '../ui/BrutalCard';
import SongItem from '../ui/SongItem';
import { isQuranContent } from '../../utils/quranUtils';

const { width } = Dimensions.get('window');

const MOODS = [
  {
    id: 'Daily',
    label: 'Daily Mix ✨',
    desc: 'Personalized mix dynamically generated from your daily taste & rotation',
    words: [],
    cover: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600',
    color: '#17a398',
  },
  {
    id: 'Chill',
    label: 'Chill & Lofi ☕',
    desc: 'Smooth lofi, acoustic rhythms, and laid-back Cairo midnight beats',
    words: ['chill', 'lofi', 'acoustic', 'ambient', 'slow', 'peace', 'relax', 'calm'],
    cover: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600',
    color: '#a855f7',
  },
  {
    id: 'Energy',
    label: 'High Energy ⚡',
    desc: 'High-octane Egyptian rap, drill, trap, and heavy bass lines',
    words: ['energy', 'rap', 'trap', 'rock', 'power', 'fast', 'drill', 'hype'],
    cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600',
    color: '#ef4444',
  },
  {
    id: 'Happy',
    label: 'Feel Good ☀️',
    desc: 'Upbeat melodies, summer festival anthems, and sunshine pop',
    words: ['happy', 'pop', 'summer', 'dance', 'fun', 'joy', 'smile'],
    cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
    color: '#f59e0b',
  },
  {
    id: 'Focus',
    label: 'Deep Focus 🧠',
    desc: 'Instrumental concentration, minimal synthesizers, and study background',
    words: ['focus', 'classical', 'instrumental', 'study', 'deep', 'piano'],
    cover: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=600',
    color: '#06b6d4',
  },
  {
    id: 'Party',
    label: 'Club Banger 🎉',
    desc: 'Heavy club remixes, electronic drops, and weekend bangers',
    words: ['party', 'dance', 'edm', 'club', 'house', 'remix', 'shaabi'],
    cover: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600',
    color: '#ec4899',
  },
];

export default function MixesScreen({ onTrackAction }) {
  const { playTrack, playPlaylist, tracks: audioTracks } = useAudioPlayer();
  const { tracks: userTracks } = useUser();
  const [selectedMood, setSelectedMood] = useState(null);

  const allTracks = (userTracks.length > 0 ? userTracks : audioTracks).filter(
    (t) => !isQuranContent(t)
  );

  const getMoodTracks = (mood) => {
    if (!mood || mood.id === 'Daily' || mood.words.length === 0) {
      return allTracks;
    }
    const filtered = allTracks.filter((t) => {
      const targetStr = `${t.title || ''} ${t.artist || ''} ${t.genre || ''} ${t.album || ''}`.toLowerCase();
      return mood.words.some((word) => targetStr.includes(word));
    });
    return filtered.length > 0 ? filtered : allTracks.slice(0, 10);
  };

  const handlePlayMood = (mood, shuffle = false) => {
    const list = [...getMoodTracks(mood)];
    if (list.length === 0) return;
    if (shuffle) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
    playPlaylist(list, 0);
  };

  const activeTracks = selectedMood ? getMoodTracks(selectedMood) : [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {selectedMood ? (
          <View style={styles.detailHeaderRow}>
            <TouchableOpacity onPress={() => setSelectedMood(null)} style={styles.backBtn}>
              <ArrowLeft size={18} color={colors.ink} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {selectedMood.label}
              </Text>
              <Text style={styles.headerSub}>MIX TAPE • {activeTracks.length} TRACKS</Text>
            </View>
            <TouchableOpacity
              style={styles.shuffleBtn}
              onPress={() => handlePlayMood(selectedMood, true)}
            >
              <Shuffle size={14} color={colors.ink} />
              <Text style={styles.shuffleBtnText}>SHUFFLE</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.headerMainRow}>
            <View>
              <Text style={styles.headerTitle}>DISPENSARY MIXES</Text>
              <Text style={styles.headerSub}>AI-ALIGNED TASTE CRATES</Text>
            </View>
            <CassetteTag label="STEREO HI-FI" bg={colors.ink} textColor={colors.mint} />
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {selectedMood ? (
          /* Detailed Mood View */
          <View>
            {/* Banner card */}
            <View style={styles.moodBannerOuter}>
              <View style={styles.hardShadow} />
              <View style={[styles.moodBanner, { borderColor: colors.ink }]}>
                <Image source={{ uri: selectedMood.cover }} style={styles.bannerImg} />
                <View style={styles.bannerOverlay}>
                  <CassetteTag label="CURATED DISPENSARY MIX" bg={colors.ink} textColor={colors.tealLight} />
                  <Text style={styles.bannerTitle}>{selectedMood.label}</Text>
                  <Text style={styles.bannerDesc}>{selectedMood.desc}</Text>
                  <TouchableOpacity
                    style={styles.bannerPlayBtn}
                    onPress={() => handlePlayMood(selectedMood, false)}
                  >
                    <Play size={16} color={colors.ink} fill={colors.ink} />
                    <Text style={styles.bannerPlayBtnText}>PLAY FULL CASSETTE</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Song Items */}
            <View style={styles.tracksList}>
              {activeTracks.map((track, idx) => (
                <SongItem
                  key={track._id || track.id || idx}
                  track={track}
                  index={idx + 1}
                  onMorePress={() => onTrackAction && onTrackAction(track)}
                />
              ))}
            </View>
          </View>
        ) : (
          /* Mix Grid Cards */
          <View style={styles.grid}>
            {MOODS.map((mood) => {
              const count = getMoodTracks(mood).length;

              return (
                <TouchableOpacity
                  key={mood.id}
                  style={styles.cardOuter}
                  activeOpacity={0.9}
                  onPress={() => setSelectedMood(mood)}
                >
                  <View style={styles.cardShadow} />
                  <View style={styles.card}>
                    <Image source={{ uri: mood.cover }} style={styles.coverImg} />

                    <View style={styles.cardBody}>
                      <View style={styles.tagRow}>
                        <View style={[styles.moodBadge, { backgroundColor: mood.color }]}>
                          <Text style={styles.moodBadgeText}>{mood.id.toUpperCase()}</Text>
                        </View>
                        <Text style={styles.trackCountText}>{count} TAPES</Text>
                      </View>

                      <Text style={styles.cardTitle}>{mood.label}</Text>
                      <Text style={styles.cardDesc} numberOfLines={2}>
                        {mood.desc}
                      </Text>

                      <View style={styles.btnRow}>
                        <TouchableOpacity
                          style={styles.cardPlayBtn}
                          onPress={() => handlePlayMood(mood, false)}
                        >
                          <Play size={14} color={colors.ink} fill={colors.ink} />
                          <Text style={styles.cardPlayBtnText}>PLAY</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.cardShuffleBtn}
                          onPress={() => handlePlayMood(mood, true)}
                        >
                          <Shuffle size={14} color={colors.paper} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
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
  header: {
    backgroundColor: colors.deepForest,
    borderBottomWidth: 2.5,
    borderBottomColor: colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  headerMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    padding: 6,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    borderRadius: 6,
  },
  headerTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 18,
    color: colors.paper,
    letterSpacing: 0.5,
  },
  headerSub: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '800',
    color: colors.mint,
    marginTop: 2,
  },
  shuffleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mint,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  shuffleBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.ink,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 110,
  },
  grid: {
    gap: 16,
  },
  cardOuter: {
    position: 'relative',
    marginBottom: 4,
  },
  cardShadow: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: -5,
    bottom: -5,
    backgroundColor: colors.tealDark,
    borderRadius: 12,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceDark,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 12,
    overflow: 'hidden',
  },
  coverImg: {
    width: 110,
    height: '100%',
    minHeight: 125,
  },
  cardBody: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
  },
  tagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  moodBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  moodBadgeText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 9,
    color: colors.ink,
  },
  trackCountText: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 10,
    color: colors.paperMuted,
  },
  cardTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 15,
    color: colors.paper,
    marginTop: 4,
  },
  cardDesc: {
    fontSize: 11,
    color: colors.paperMuted,
    lineHeight: 14,
    marginTop: 2,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  cardPlayBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingVertical: 6,
    gap: 4,
  },
  cardPlayBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.ink,
  },
  cardShuffleBtn: {
    backgroundColor: colors.surfaceDark,
    borderWidth: 1.5,
    borderColor: colors.paperMuted,
    borderRadius: 6,
    padding: 6,
  },
  moodBannerOuter: {
    position: 'relative',
    marginBottom: 16,
  },
  hardShadow: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: -5,
    bottom: -5,
    backgroundColor: colors.tealDark,
    borderRadius: 12,
  },
  moodBanner: {
    height: 160,
    borderRadius: 12,
    borderWidth: 2.5,
    overflow: 'hidden',
    position: 'relative',
  },
  bannerImg: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 38, 33, 0.85)',
    padding: 14,
    justifyContent: 'space-between',
  },
  bannerTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 22,
    color: colors.paper,
  },
  bannerDesc: {
    fontSize: 11,
    color: colors.paperMuted,
    lineHeight: 15,
  },
  bannerPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.mint,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  bannerPlayBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.ink,
  },
  tracksList: {
    gap: 8,
  },
});
