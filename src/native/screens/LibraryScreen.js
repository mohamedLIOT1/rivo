import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
} from 'react-native';
import {
  Heart,
  Plus,
  ArrowLeft,
  Music,
  FolderHeart,
  Download,
  Play,
  Shuffle,
  Disc,
} from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';
import SongItem from '../ui/SongItem';

const { width } = Dimensions.get('window');

export default function LibraryScreen({
  onOpenCreatePlaylist,
  onNavigateOffline,
  onTrackAction,
}) {
  const { playTrack, playPlaylist, tracks: audioTracks } = useAudioPlayer();
  const { currentUser, playlists, likedTrackIds, tracks: userTracks } = useUser();
  const [selectedView, setSelectedView] = useState(null); // 'liked' | playlistObject

  const allTracks = (userTracks && userTracks.length > 0) ? userTracks : (audioTracks || []);
  const safeLikedIds = Array.isArray(likedTrackIds) ? likedTrackIds : [];

  // Liked tracks
  const likedTracks = (allTracks || []).filter((t) =>
    safeLikedIds.includes(String(t?._id || t?.id))
  );

  const handlePlayLiked = (shuffle = false) => {
    if (!likedTracks || likedTracks.length === 0) return;
    const list = [...likedTracks];
    if (shuffle) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
    if (typeof playPlaylist === 'function') {
      playPlaylist(list, 0);
    } else if (typeof playTrack === 'function' && list.length > 0) {
      playTrack(list[0], list);
    }
  };

  const handlePlayPlaylist = (playlist, shuffle = false) => {
    if (!playlist) return;
    const list = (playlist.tracks || []).map((tId) => {
      const found = (allTracks || []).find((t) => String(t?._id || t?.id) === String(tId?._id || tId));
      return found || tId;
    }).filter(Boolean);
    if (list.length === 0) return;
    if (shuffle) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
    if (typeof playPlaylist === 'function') {
      playPlaylist(list, 0);
    } else if (typeof playTrack === 'function' && list.length > 0) {
      playTrack(list[0], list);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {selectedView ? (
          <View style={styles.detailHeaderRow}>
            <TouchableOpacity onPress={() => setSelectedView(null)} style={styles.backBtn}>
              <ArrowLeft size={18} color={colors.ink} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {selectedView === 'liked' ? 'LIKED RECORDINGS' : selectedView.name}
              </Text>
              <Text style={styles.headerSub}>
                DISPENSARY ARCHIVE •{' '}
                {selectedView === 'liked'
                  ? `${likedTracks.length} TAPES`
                  : `${selectedView.tracks?.length || 0} TAPES`}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.headerMainRow}>
            <View>
              <Text style={styles.headerTitle}>YOUR AUDIO VAULT</Text>
              <Text style={styles.headerSub}>CASSETTES, CRATES & OFFLINE</Text>
            </View>
            <TouchableOpacity style={styles.newPlaylistBtn} onPress={onOpenCreatePlaylist}>
              <Plus size={16} color={colors.ink} strokeWidth={3} />
              <Text style={styles.newPlaylistBtnText}>CRATE</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {selectedView === 'liked' ? (
          /* Detailed Liked Tracks */
          <View>
            <View style={styles.likedHeroCard}>
              <View style={styles.hardShadow} />
              <View style={styles.likedHero}>
                <View style={styles.heartBigBox}>
                  <Heart size={32} color={colors.rust} fill={colors.rust} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <CassetteTag label="FAVORITE ARCHIVE" bg={colors.ink} textColor={colors.mint} />
                  <Text style={styles.likedHeroTitle}>LIKED TAPES</Text>
                  <Text style={styles.likedHeroSub}>{likedTracks.length} recordings preserved</Text>
                  <View style={styles.likedBtnRow}>
                    <TouchableOpacity
                      style={styles.playHeroBtn}
                      onPress={() => handlePlayLiked(false)}
                    >
                      <Play size={14} color={colors.ink} fill={colors.ink} />
                      <Text style={styles.playHeroBtnText}>PLAY ALL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.shuffleHeroBtn}
                      onPress={() => handlePlayLiked(true)}
                    >
                      <Shuffle size={14} color={colors.paper} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {likedTracks.length === 0 ? (
              <View style={styles.emptyCard}>
                <Heart size={36} color={colors.rust} />
                <Text style={styles.emptyTitle}>No liked recordings yet</Text>
                <Text style={styles.emptySub}>Tap the heart icon on any tape to archive it here.</Text>
              </View>
            ) : (
              <View style={styles.tracksList}>
                {likedTracks.map((track, idx) => (
                  <SongItem
                    key={track._id || track.id || idx}
                    track={track}
                    index={idx + 1}
                    onMorePress={() => onTrackAction && onTrackAction(track)}
                  />
                ))}
              </View>
            )}
          </View>
        ) : selectedView && typeof selectedView === 'object' ? (
          /* Detailed Playlist View */
          <View>
            <View style={styles.playlistHeroCard}>
              <View style={styles.hardShadow} />
              <View style={styles.playlistHero}>
                <View style={styles.playlistBigBox}>
                  <Disc size={36} color={colors.mint} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <CassetteTag label="CRATE PLAYLIST" bg={colors.ink} textColor={colors.tealLight} />
                  <Text style={styles.playlistHeroTitle}>{selectedView.name}</Text>
                  <Text style={styles.playlistHeroSub}>
                    {selectedView.tracks?.length || 0} recordings compiled
                  </Text>
                  <View style={styles.likedBtnRow}>
                    <TouchableOpacity
                      style={styles.playHeroBtn}
                      onPress={() => handlePlayPlaylist(selectedView, false)}
                    >
                      <Play size={14} color={colors.ink} fill={colors.ink} />
                      <Text style={styles.playHeroBtnText}>PLAY CRATE</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.shuffleHeroBtn}
                      onPress={() => handlePlayPlaylist(selectedView, true)}
                    >
                      <Shuffle size={14} color={colors.paper} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.tracksList}>
              {(selectedView.tracks || []).map((tItem, idx) => {
                const track =
                  allTracks.find(
                    (t) => String(t._id || t.id) === String(tItem._id || tItem)
                  ) || tItem;
                return (
                  <SongItem
                    key={track._id || track.id || idx}
                    track={track}
                    index={idx + 1}
                    onMorePress={() => onTrackAction && onTrackAction(track)}
                  />
                );
              })}
            </View>
          </View>
        ) : (
          /* Main Library Overview */
          <View>
            {/* Liked Songs Cassette Card */}
            <TouchableOpacity
              style={styles.cardOuter}
              activeOpacity={0.9}
              onPress={() => setSelectedView('liked')}
            >
              <View style={styles.cardShadow} />
              <View style={styles.likedBanner}>
                <View style={styles.likedBannerIcon}>
                  <Heart size={28} color={colors.rust} fill={colors.rust} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <CassetteTag label="PRIMARY TAPE" bg={colors.ink} textColor={colors.mint} />
                  <Text style={styles.likedBannerTitle}>LIKED RECORDINGS</Text>
                  <Text style={styles.likedBannerSub}>{likedTracks.length} TAPES ARCHIVED</Text>
                </View>
                <View style={styles.cardArrowPill}>
                  <Play size={14} color={colors.ink} fill={colors.ink} />
                </View>
              </View>
            </TouchableOpacity>

            {/* Offline Recordings Shortcut Card */}
            <TouchableOpacity
              style={styles.cardOuter}
              activeOpacity={0.9}
              onPress={onNavigateOffline}
            >
              <View style={styles.cardShadow} />
              <View style={[styles.likedBanner, { backgroundColor: '#162e2a' }]}>
                <View style={[styles.likedBannerIcon, { backgroundColor: colors.teal }]}>
                  <Download size={24} color={colors.ink} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <CassetteTag label="OFFLINE STORAGE" bg={colors.ink} textColor={colors.tealLight} />
                  <Text style={styles.likedBannerTitle}>CACHED TAPES (NO WI-FI)</Text>
                  <Text style={styles.likedBannerSub}>LOCAL AUDIO REELS READY</Text>
                </View>
                <View style={styles.cardArrowPill}>
                  <Play size={14} color={colors.ink} fill={colors.ink} />
                </View>
              </View>
            </TouchableOpacity>

            {/* User Crates / Playlists */}
            <View style={styles.cratesHeader}>
              <Text style={styles.cratesTitle}>YOUR CRATES ({playlists.length})</Text>
              <CassetteTag label="PHYSICAL DISPENSARY" bg={colors.ink} textColor={colors.mint} />
            </View>

            {playlists.length === 0 ? (
              <View style={styles.emptyCard}>
                <FolderHeart size={36} color={colors.teal} />
                <Text style={styles.emptyTitle}>No crates created yet</Text>
                <Text style={styles.emptySub}>
                  Create custom playlists to organize your favorite Cairo sounds.
                </Text>
              </View>
            ) : (
              <View style={styles.playlistGrid}>
                {playlists.map((playlist) => (
                  <TouchableOpacity
                    key={playlist._id || playlist.id}
                    style={styles.playlistGridCard}
                    activeOpacity={0.85}
                    onPress={() => setSelectedView(playlist)}
                  >
                    <View style={styles.playlistCoverBox}>
                      <Disc size={28} color={colors.mint} />
                    </View>
                    <Text style={styles.playlistCardName} numberOfLines={1}>
                      {playlist.name}
                    </Text>
                    <Text style={styles.playlistCardCount}>
                      {playlist.tracks?.length || 0} TRACKS
                    </Text>
                  </TouchableOpacity>
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
  newPlaylistBtn: {
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
  newPlaylistBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.ink,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 110,
  },
  cardOuter: {
    position: 'relative',
    marginBottom: 14,
  },
  cardShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.tealDark,
    borderRadius: 10,
  },
  likedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 10,
    padding: 12,
  },
  likedBannerIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likedBannerTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 14,
    color: colors.paper,
    marginTop: 2,
  },
  likedBannerSub: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: colors.paperMuted,
    marginTop: 2,
  },
  cardArrowPill: {
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    padding: 8,
  },
  cratesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 6,
  },
  cratesTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 13,
    color: colors.paper,
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
    textAlign: 'center',
  },
  playlistGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  playlistGridCard: {
    width: (width - 38) / 2,
    backgroundColor: colors.surfaceDark,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    padding: 10,
  },
  playlistCoverBox: {
    width: '100%',
    height: 80,
    backgroundColor: colors.deepForest,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  playlistCardName: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: colors.paper,
  },
  playlistCardCount: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: colors.paperMuted,
    marginTop: 2,
  },
  likedHeroCard: {
    position: 'relative',
    marginBottom: 16,
  },
  hardShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.tealDark,
    borderRadius: 10,
  },
  likedHero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 10,
    padding: 14,
  },
  heartBigBox: {
    width: 60,
    height: 60,
    backgroundColor: '#3f1717',
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likedHeroTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 18,
    color: colors.paper,
    marginTop: 2,
  },
  likedHeroSub: {
    fontSize: 11,
    color: colors.paperMuted,
    marginTop: 2,
  },
  likedBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  playHeroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mint,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 4,
  },
  playHeroBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.ink,
  },
  shuffleHeroBtn: {
    backgroundColor: colors.surfaceDark,
    borderWidth: 1.5,
    borderColor: colors.paperMuted,
    borderRadius: 6,
    padding: 6,
  },
  playlistHeroCard: {
    position: 'relative',
    marginBottom: 16,
  },
  playlistHero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 10,
    padding: 14,
  },
  playlistBigBox: {
    width: 60,
    height: 60,
    backgroundColor: colors.deepForest,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistHeroTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 18,
    color: colors.paper,
    marginTop: 2,
  },
  playlistHeroSub: {
    fontSize: 11,
    color: colors.paperMuted,
    marginTop: 2,
  },
  tracksList: {
    gap: 8,
  },
});
