import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
} from 'react-native';
import { Search as SearchIcon, X, Disc, Music, Sparkles, Filter } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';
import SongItem from '../ui/SongItem';
import { isQuranContent } from '../../utils/quranUtils';

const { width } = Dimensions.get('window');

const DISPENSARY_GENRES = [
  { id: 'rap', label: 'EGYPTIAN RAP', color: '#17a398', tag: 'TRAP / DRILL' },
  { id: 'indie', label: 'INDIE ARABIC', color: '#f59e0b', tag: 'ACOUSTIC' },
  { id: 'mahraganat', label: 'MAHRAGANAT', color: '#dc2626', tag: 'STREET BASS' },
  { id: 'tarab', label: 'TARAB RETRO', color: '#8b5cf6', tag: 'CLASSIC CASSETTE' },
  { id: 'lofi', label: 'CAIRO LOFI', color: '#06b6d4', tag: 'CHILL BEATS' },
  { id: 'electronic', label: 'CLUB SYNTH', color: '#ec4899', tag: 'TECHNO / HOUSE' },
  { id: 'pop', label: 'ARABIC POP', color: '#10b981', tag: 'TOP CHARTS' },
  { id: 'shaabi', label: 'SHAABI RETRO', color: '#f97316', tag: 'VINTAGE TAPE' },
  { id: 'rock', label: 'ORIENTAL ROCK', color: '#ef4444', tag: 'DISTORTION' },
  { id: 'quran', label: 'QURAN TARTIL', color: '#047857', tag: 'RECITATION' },
  { id: 'ambient', label: 'NIGHT AMBIENT', color: '#6366f1', tag: 'FOCUS DEEP' },
];

export default function SearchScreen({ onTrackAction }) {
  const { playTrack, tracks: audioTracks } = useAudioPlayer();
  const { tracks: userTracks } = useUser();
  const [query, setQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState(null);

  const allTracks = userTracks.length > 0 ? userTracks : audioTracks;

  const filteredTracks = useMemo(() => {
    let result = allTracks || [];

    if (selectedGenre) {
      if (selectedGenre === 'quran') {
        result = result.filter(isQuranContent);
      } else {
        const key = selectedGenre.toLowerCase();
        result = result.filter(
          (t) =>
            t.genre?.toLowerCase().includes(key) ||
            t.title?.toLowerCase().includes(key) ||
            t.artist?.toLowerCase().includes(key) ||
            t.tags?.some?.((tag) => tag.toLowerCase().includes(key))
        );
      }
    }

    if (query.trim()) {
      const q = query.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.artist?.toLowerCase().includes(q) ||
          t.album?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [allTracks, query, selectedGenre]);

  return (
    <View style={styles.container}>
      {/* Header & Search Bar */}
      <View style={styles.searchHeader}>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>DISPENSARY SEARCH</Text>
          <CassetteTag label="REALTIME MATRIX" bg={colors.ink} textColor={colors.mint} />
        </View>

        <View style={styles.inputContainer}>
          <SearchIcon size={18} color={colors.ink} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search tracks, artists, reciters, tapes..."
            placeholderTextColor={colors.grayText}
            value={query}
            onChangeText={setQuery}
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
              <X size={16} color={colors.ink} />
            </TouchableOpacity>
          )}
        </View>

        {/* Selected Genre Pill */}
        {selectedGenre && (
          <View style={styles.activeGenreBanner}>
            <Text style={styles.activeGenreText}>
              FILTERING: {DISPENSARY_GENRES.find((g) => g.id === selectedGenre)?.label}
            </Text>
            <TouchableOpacity onPress={() => setSelectedGenre(null)} style={styles.removeGenreBtn}>
              <X size={12} color={colors.ink} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* If no query and no selected genre: Show 12 Genre Blister Packs */}
        {!query.trim() && !selectedGenre && (
          <View style={styles.genresSection}>
            <View style={styles.sectionTitleRow}>
              <Disc size={16} color={colors.mint} />
              <Text style={styles.sectionHeading}>DISPENSARY GENRES & SHELVES</Text>
            </View>

            <View style={styles.genresGrid}>
              {DISPENSARY_GENRES.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.genreCard, { backgroundColor: g.color }]}
                  activeOpacity={0.85}
                  onPress={() => setSelectedGenre(g.id)}
                >
                  <View style={styles.genreCardInner}>
                    <Text style={styles.genreLabel}>{g.label}</Text>
                    <Text style={styles.genreTag}>{g.tag}</Text>
                    <View style={styles.genreDecoDisc}>
                      <Disc size={36} color="rgba(0,0,0,0.2)" />
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Search Results */}
        {(query.trim().length > 0 || selectedGenre) && (
          <View style={styles.resultsSection}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>
                FOUND {filteredTracks.length} TAPES IN ARCHIVE
              </Text>
            </View>

            {filteredTracks.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Disc size={36} color={colors.teal} />
                <Text style={styles.emptyText}>No matching recordings found.</Text>
                <Text style={styles.emptySub}>Try searching for another artist or tape title.</Text>
              </View>
            ) : (
              <View style={styles.tracksList}>
                {filteredTracks.map((track, index) => (
                  <SongItem
                    key={track._id || track.id || index}
                    track={track}
                    index={index + 1}
                    onMorePress={() => onTrackAction && onTrackAction(track)}
                  />
                ))}
              </View>
            )}
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
  searchHeader: {
    backgroundColor: colors.deepForest,
    borderBottomWidth: 2.5,
    borderBottomColor: colors.ink,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  headerTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 18,
    color: colors.paper,
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'monospace',
    fontWeight: '700',
    color: colors.ink,
  },
  clearBtn: {
    padding: 4,
  },
  activeGenreBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.mint,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: 8,
  },
  activeGenreText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.ink,
  },
  removeGenreBtn: {
    padding: 2,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 110,
  },
  genresSection: {
    marginBottom: 20,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionHeading: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 13,
    color: colors.paper,
    letterSpacing: 0.5,
  },
  genresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  genreCard: {
    width: (width - 38) / 2,
    height: 84,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  genreCardInner: {
    flex: 1,
    padding: 10,
    justifyContent: 'space-between',
    position: 'relative',
  },
  genreLabel: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 13,
    color: colors.ink,
    letterSpacing: 0.3,
  },
  genreTag: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 9,
    color: 'rgba(0,0,0,0.6)',
  },
  genreDecoDisc: {
    position: 'absolute',
    right: -8,
    bottom: -8,
  },
  resultsSection: {
    marginTop: 4,
  },
  resultsHeader: {
    marginBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 6,
  },
  resultsCount: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.tealLight,
    letterSpacing: 0.5,
  },
  emptyContainer: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceDark,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
  },
  emptyText: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 13,
    color: colors.paper,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 11,
    color: colors.paperMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  tracksList: {
    gap: 8,
  },
});
