import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { X, Play, Shuffle, Disc } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';
import { normalizeCoverUri } from '../utils/coverUtils';
import SongItem from '../ui/SongItem';

const { width } = Dimensions.get('window');

export default function AlbumDetailModal({
  visible,
  album,
  onClose,
  allTracks = [],
  onTrackAction,
}) {
  const { playTrack } = useAudioPlayer();
  const { isDark } = useTheme();

  // Resolve album tracks
  const albumTracks = useMemo(() => {
    if (!album) return [];
    if (Array.isArray(album.tracks) && album.tracks.length > 0) {
      return album.tracks;
    }
    const albName = (album.name || '').trim().toLowerCase();
    const trackIds = Array.isArray(album.trackIds) ? album.trackIds.map(String) : [];

    return (allTracks || []).filter((t) => {
      if (!t) return false;
      const tAlb = (t.album || '').trim().toLowerCase();
      const tId = String(t.id || t._id || '');
      return (albName && tAlb === albName) || (trackIds.length > 0 && trackIds.includes(tId));
    });
  }, [album, allTracks]);

  if (!visible || !album) return null;

  const coverUri = album.cover || album.coverUrl || albumTracks[0]?.cover || albumTracks[0]?.coverUrl;
  const albumTitle = album.name || 'Untitled Album';
  const albumArtist = album.artist || albumTracks[0]?.artist || 'Various Artists';

  const handlePlayAll = (shuffle = false) => {
    if (albumTracks.length === 0) return;
    let queue = [...albumTracks];
    if (shuffle) {
      queue.sort(() => Math.random() - 0.5);
    }
    playTrack(queue[0], queue);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, !isDark && styles.containerLight]}>
        {/* Header Bar */}
        <View style={[styles.header, !isDark && styles.headerLight]}>
          <View style={styles.headerTitleGroup}>
            <Disc size={18} color="#f59e0b" strokeWidth={2.2} />
            <Text style={[styles.headerTitle, !isDark && styles.headerTitleLight]} numberOfLines={1}>
              {albumTitle}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, !isDark && styles.closeBtnLight]} activeOpacity={0.8}>
            <X size={20} color={isDark ? '#ffffff' : '#0b1110'} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Album Hero Card */}
          <View style={[styles.heroCard, !isDark && styles.heroCardLight]}>
            <View style={styles.coverWrapper}>
              <View style={styles.coverPlaceholder}>
                <Disc size={48} color="#1f3630" strokeWidth={1.5} />
              </View>
              <Image
                source={{ uri: normalizeCoverUri(coverUri) }}
                style={styles.heroCover}
                resizeMode="cover"
              />
            </View>

            <View style={styles.heroDetails}>
              <View style={styles.albumBadge}>
                <Text style={styles.albumBadgeText}>DISCOGRAPHY ALBUM</Text>
              </View>
              <Text style={[styles.heroTitle, !isDark && styles.heroTitleLight]} numberOfLines={2}>
                {albumTitle}
              </Text>
              <Text style={styles.heroArtist} numberOfLines={1}>
                {albumArtist}
              </Text>
              <Text style={styles.heroTrackCount}>
                {albumTracks.length} {albumTracks.length === 1 ? 'Track' : 'Tracks'}
              </Text>
            </View>
          </View>

          {/* Action Buttons Row */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.playAllBtn}
              onPress={() => handlePlayAll(false)}
              activeOpacity={0.85}
              disabled={albumTracks.length === 0}
            >
              <Play size={15} color="#0b1110" fill="#0b1110" style={{ marginRight: 6 }} />
              <Text style={styles.playAllBtnText}>PLAY ALL</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.shuffleBtn}
              onPress={() => handlePlayAll(true)}
              activeOpacity={0.85}
              disabled={albumTracks.length === 0}
            >
              <Shuffle size={15} color="#0b1110" style={{ marginRight: 6 }} />
              <Text style={styles.shuffleBtnText}>SHUFFLE</Text>
            </TouchableOpacity>
          </View>

          {/* Track List Section */}
          <View style={styles.tracksSection}>
            <View style={styles.tracksHeaderRow}>
              <Text style={[styles.tracksHeaderTitle, !isDark && styles.tracksHeaderTitleLight]}>
                TRACKLIST
              </Text>
              <Text style={styles.tracksHeaderCount}>
                {albumTracks.length} SONGS
              </Text>
            </View>

            {albumTracks.length === 0 ? (
              <View style={[styles.emptyCard, !isDark && styles.emptyCardLight]}>
                <Disc size={32} color="#17a398" />
                <Text style={styles.emptyTitle}>No tracks found in this album</Text>
                <Text style={styles.emptySub}>Tracks for this album have not been indexed yet.</Text>
              </View>
            ) : (
              <View style={styles.tracksList}>
                {albumTracks.map((track, index) => (
                  <SongItem
                    key={track._id || track.id || String(index)}
                    track={track}
                    index={index + 1}
                    onPlay={() => playTrack(track, albumTracks)}
                    onTrackAction={onTrackAction}
                    onMorePress={() => onTrackAction && onTrackAction(track)}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1110',
  },
  containerLight: {
    backgroundColor: '#fdfbf7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: '#172722',
  },
  headerLight: {
    borderBottomColor: '#0b1110',
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    textTransform: 'uppercase',
  },
  headerTitleLight: {
    color: '#082621',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#14201d',
    borderWidth: 2,
    borderColor: '#243b35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    flexDirection: 'row',
    backgroundColor: '#0d1815',
    borderWidth: 2,
    borderColor: '#172722',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 14,
    alignItems: 'center',
  },
  heroCardLight: {
    backgroundColor: '#f6f2e8',
    borderColor: '#0b1110',
  },
  coverWrapper: {
    width: 110,
    height: 110,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#0b1110',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#07100e',
  },
  coverPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCover: {
    width: '100%',
    height: '100%',
  },
  heroDetails: {
    flex: 1,
  },
  albumBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  albumBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#f59e0b',
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 4,
    lineHeight: 22,
  },
  heroTitleLight: {
    color: '#082621',
  },
  heroArtist: {
    fontSize: 13,
    fontWeight: '700',
    color: '#17a398',
    marginBottom: 4,
  },
  heroTrackCount: {
    fontSize: 11,
    color: '#71717a',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  playAllBtn: {
    flex: 1,
    height: 44,
    backgroundColor: '#17a398',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#0b1110',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playAllBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0b1110',
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
  },
  shuffleBtn: {
    flex: 1,
    height: 44,
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#0b1110',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shuffleBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0b1110',
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
  },
  tracksSection: {
    marginTop: 4,
  },
  tracksHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  tracksHeaderTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#ffffff',
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
    letterSpacing: 0.5,
  },
  tracksHeaderTitleLight: {
    color: '#082621',
  },
  tracksHeaderCount: {
    fontSize: 11,
    fontWeight: '800',
    color: '#17a398',
    fontFamily: Platform.OS === 'ios' ? 'Courier-Bold' : 'monospace',
  },
  tracksList: {
    gap: 6,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: '#0d1815',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#172722',
    marginTop: 10,
  },
  emptyCardLight: {
    backgroundColor: '#f6f2e8',
    borderColor: '#0b1110',
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: '#71717a',
    marginTop: 4,
    textAlign: 'center',
  },
});
