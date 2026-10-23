import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import {
  ArrowLeft,
  Play,
  Shuffle,
  Disc,
  Heart,
  Download,
  CheckCircle2,
  ListPlus,
  UserPlus,
  Check,
  Music,
  MoreVertical,
  CheckSquare,
  Plus,
  Edit,
} from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';
import { normalizeCoverUri } from '../utils/coverUtils';
import { matchesArtist } from '../../utils/artistUtils.jsx';
import MiniPlayer from './MiniPlayer';
import AddAlbumModal from './AddAlbumModal';
import EditArtistModal from './EditArtistModal';


const { width } = Dimensions.get('window');
const ALBUM_CARD_WIDTH = (width - 48) / 2;

export default function ArtistDetailModal({
  visible,
  artist,
  onClose,
  allTracks = [],
  allAlbums = [],
  onSelectAlbum,
  onTrackAction,
  onOpenFullPlayer,
}) {
  const { playTrack, currentTrack, addToQueue, downloadedTracks = [], downloadTrack, openFullPlayer: contextOpenFullPlayer } = useAudioPlayer();
  const handleOpenFull = React.useCallback(() => {
    const trigger = onOpenFullPlayer || contextOpenFullPlayer;
    if (!trigger) return;
    if (Platform.OS === 'ios' && typeof onClose === 'function') {
      onClose();
      setTimeout(() => {
        trigger();
      }, 150);
    } else {
      trigger();
    }
  }, [onOpenFullPlayer, contextOpenFullPlayer, onClose]);

  const handleTrackAction = React.useCallback((track) => {
    if (!onTrackAction) return;
    if (Platform.OS === 'ios' && typeof onClose === 'function') {
      onClose();
      setTimeout(() => {
        onTrackAction(track);
      }, 150);
    } else {
      onTrackAction(track);
    }
  }, [onTrackAction, onClose]);
  const { likedTrackIds = [], toggleLikeTrack, currentUser } = useUser();
  const { isDark } = useTheme();
  const [isFollowing, setIsFollowing] = useState(false);
  const [isAddAlbumOpen, setIsAddAlbumOpen] = useState(false);
  const [isEditArtistOpen, setIsEditArtistOpen] = useState(false);
  const isAdmin = Boolean(currentUser?.role === 'admin' || currentUser?.isAdmin);


  // Normalize artist name
  const artistName = useMemo(() => {
    if (!artist) return '';
    if (typeof artist === 'string') return artist.trim();
    return (artist.name || artist.artist || '').trim();
  }, [artist]);

  // Filter artist tracks
  const artistTracks = useMemo(() => {
    if (!artistName) return [];
    return (allTracks || []).filter((t) => {
      if (!t || !t.artist) return false;
      return matchesArtist(t, artistName) || t.artist.toLowerCase().includes(artistName.toLowerCase());
    });
  }, [allTracks, artistName]);

  // Discography Albums for this artist
  const artistAlbums = useMemo(() => {
    if (!artistName) return [];
    const lower = artistName.toLowerCase().trim();
    const map = new Map();

    (allAlbums || []).forEach((alb) => {
      if (alb && alb.artist && (matchesArtist(alb, artistName) || alb.artist.toLowerCase().includes(lower))) {
        const key = (alb.name || '').toLowerCase().trim();
        if (key && !map.has(key)) {
          const albTracks = (Array.isArray(alb.tracks) && alb.tracks.length > 0)
            ? alb.tracks
            : (allTracks || []).filter(t => {
                if (!t) return false;
                const tAlb = (t.album || '').trim().toLowerCase();
                const tId = String(t.id || t._id || '');
                const inIds = Array.isArray(alb.trackIds) && alb.trackIds.map(String).includes(tId);
                return (tAlb && tAlb === key) || inIds;
              });
          map.set(key, {
            ...alb,
            name: alb.name || key,
            artist: alb.artist || artistName,
            cover: alb.cover || alb.coverUrl || albTracks[0]?.coverUrl || albTracks[0]?.cover,
            tracks: albTracks,
          });
        }
      }
    });

    // Also collect and merge from artistTracks
    artistTracks.forEach((t) => {
      if (t.album && t.album.trim()) {
        const key = t.album.toLowerCase().trim();
        const tCover = t.coverUrl || t.cover;
        if (!map.has(key)) {
          map.set(key, {
            id: `album-${key}`,
            name: t.album.trim(),
            artist: artistName,
            cover: tCover,
            tracks: [t],
          });
        } else {
          const existing = map.get(key);
          if (!existing.cover && tCover) existing.cover = tCover;
          if (!existing.tracks) existing.tracks = [];
          const tId = String(t.id || t._id || '');
          if (!existing.tracks.some(x => String(x.id || x._id || '') === tId)) {
            existing.tracks.push(t);
          }
        }
      }
    });

    return Array.from(map.values());
  }, [allAlbums, artistTracks, artistName, allTracks]);

  if (!visible || !artistName) return null;

  // Resolve artist avatar
  const artistCover = (typeof artist === 'object' && (artist.avatar || artist.cover || artist.coverUrl))
    ? (artist.avatar || artist.cover || artist.coverUrl)
    : (artistTracks[0]?.coverUrl || artistTracks[0]?.cover || '');

  const handlePlayAll = (shuffle = false) => {
    if (artistTracks.length === 0) return;
    let queue = [...artistTracks];
    if (shuffle) {
      queue.sort(() => Math.random() - 0.5);
    }
    playTrack(queue[0], queue);
  };

  const formatDuration = (sec) => {
    const s = parseInt(sec, 10) || 210;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const rem = s % 60;
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${rem < 10 ? '0' : ''}${rem}`;
    }
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <View style={[styles.container, !isDark && styles.containerLight]}>
        {/* Top Header Bar matching Image 2 */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.8}>
            <ArrowLeft size={20} color="#fdfbf7" strokeWidth={2.5} />
            <Text style={styles.backText}>BACK</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section matching Image 2 */}
          <View style={styles.heroSection}>
            {/* Centered Big Artist Image */}
            <View style={styles.avatarWrapper}>
              <Image
                source={{ uri: normalizeCoverUri(artistCover) }}
                style={styles.avatarImg}
                resizeMode="cover"
              />
            </View>

            {/* Verified Artist Badge */}
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedText}>VERIFIED ARTIST</Text>
              <CheckCircle2 size={12} color="#17a398" style={{ marginLeft: 4 }} />
            </View>

            {/* Large Artist Name */}
            <Text style={styles.artistName} numberOfLines={2}>
              {artistName}
            </Text>

            {/* Counter Pills */}
            <View style={styles.metaPill}>
              <Text style={styles.metaPillText}>{artistTracks.length} Tracks</Text>
              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.metaPillText}>{artistAlbums.length} Albums</Text>
            </View>

            {/* Action Buttons Row */}
            <View style={styles.actionRow}>
              {/* Big Yellow Play Button */}
              <TouchableOpacity
                style={styles.playBtn}
                onPress={() => handlePlayAll(false)}
                activeOpacity={0.85}
              >
                <Play size={20} color="#0b1110" fill="#0b1110" style={{ marginLeft: 2 }} />
              </TouchableOpacity>

              {/* Queue All */}
              <TouchableOpacity
                style={styles.queueBtn}
                onPress={() => {
                  if (addToQueue && artistTracks.length > 0) addToQueue(artistTracks);
                }}
                activeOpacity={0.8}
              >
                <ListPlus size={15} color="#26c4b7" strokeWidth={2.2} />
                <Text style={styles.queueBtnText}>QUEUE ALL</Text>
              </TouchableOpacity>

              {/* Follow / Following */}
              <TouchableOpacity
                style={[styles.followBtn, isFollowing && styles.followBtnActive]}
                onPress={() => setIsFollowing(!isFollowing)}
                activeOpacity={0.8}
              >
                {isFollowing ? (
                  <Check size={14} color="#0b1110" strokeWidth={3} />
                ) : (
                  <UserPlus size={14} color="#fdfbf7" strokeWidth={2.2} />
                )}
                <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                  {isFollowing ? 'FOLLOWING' : 'FOLLOW'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Admin Controls Dedicated Row — never pushes outside screen bounds */}
            {isAdmin && (
              <View style={styles.adminActionRow}>
                <TouchableOpacity
                  style={styles.addAlbumHeroBtn}
                  onPress={() => setIsAddAlbumOpen(true)}
                  activeOpacity={0.8}
                >
                  <Plus size={13} color="#0b1110" strokeWidth={2.8} />
                  <Text style={styles.addAlbumHeroBtnText}>ADD ALBUM</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.editArtistHeroBtn}
                  onPress={() => setIsEditArtistOpen(true)}
                  activeOpacity={0.8}
                >
                  <Edit size={13} color="#0b1110" strokeWidth={2.5} />
                  <Text style={styles.editArtistHeroBtnText}>EDIT ARTIST PAGE</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Discography / Albums Section matching Image 2 */}
          {(artistAlbums.length > 0 || isAdmin) && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Disc size={16} color="#17a398" />
                  <Text style={styles.sectionTitle}>DISCOGRAPHY / ALBUMS</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={styles.sectionCounter}>{artistAlbums.length} ALBUMS</Text>
                  {isAdmin && (
                    <TouchableOpacity
                      style={styles.headerAddBtn}
                      onPress={() => setIsAddAlbumOpen(true)}
                      activeOpacity={0.8}
                    >
                      <Plus size={11} color="#0b1110" strokeWidth={2.8} />
                      <Text style={styles.headerAddBtnText}>ADD ALBUM</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {artistAlbums.length > 0 ? (
                <View style={styles.albumGrid}>
                  {artistAlbums.map((album, idx) => {
                    const albumKey = album.id || album.name || idx;
                    const albCover = normalizeCoverUri(album.cover || album.coverUrl || artistCover);
                    const songCount = (album.tracks && album.tracks.length) || (album.trackIds && album.trackIds.length) || 0;

                    return (
                      <TouchableOpacity
                        key={albumKey}
                        style={styles.albumCard}
                        onPress={() => onSelectAlbum && onSelectAlbum(album)}
                        activeOpacity={0.85}
                      >
                        <Image source={{ uri: albCover }} style={styles.albumCover} resizeMode="cover" />
                        <Text style={styles.albumCardTitle} numberOfLines={1}>
                          {album.name || 'Untitled Album'}
                        </Text>
                        <Text style={styles.albumCardSub}>
                          ALBUM • {songCount} songs
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyAlbumBox}>
                  <Text style={styles.emptyAlbumText}>No official albums added for this artist yet.</Text>
                  <TouchableOpacity
                    style={styles.uploadFirstBtn}
                    onPress={() => setIsAddAlbumOpen(true)}
                    activeOpacity={0.8}
                  >
                    <Plus size={13} color="#0b1110" strokeWidth={2.8} />
                    <Text style={styles.uploadFirstBtnText}>UPLOAD FIRST ALBUM</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* Popular Tracks Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Music size={16} color="#17a398" />
                <Text style={styles.sectionTitle}>POPULAR TRACKS</Text>
              </View>
              <Text style={styles.sectionCounter}>{artistTracks.length} SONGS</Text>
            </View>

            {artistTracks.map((t, index) => {
              const trackId = String(t._id || t.id || '');
              const isCurrent = String(currentTrack?._id || currentTrack?.id || '') === trackId && trackId !== '';
              const isLiked = Array.isArray(likedTrackIds) ? likedTrackIds.includes(trackId) : false;
              const isDl = (Array.isArray(downloadedTracks) ? downloadedTracks : []).some(
                (d) => String(d._id || d.id) === trackId
              ) || Boolean(t.isDownloaded || t.localAudioUri);

              const numStr = (index + 1) < 10 ? `0${index + 1}` : `${index + 1}`;
              const trackCover = normalizeCoverUri(t.coverUrl || t.cover || artistCover);

              return (
                <TouchableOpacity
                  key={trackId || index}
                  style={[styles.trackRow, isCurrent && styles.trackRowActive]}
                  onPress={() => {
                    if (isCurrent) {
                      if (handleOpenFull) {
                        handleOpenFull();
                      } else {
                        playTrack(t, artistTracks);
                      }
                    } else {
                      playTrack(t, artistTracks);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.trackNum, isCurrent && styles.trackNumActive]}>
                    {numStr}
                  </Text>
                  <Image source={{ uri: trackCover }} style={styles.trackThumb} resizeMode="cover" />
                  <View style={styles.trackDetails}>
                    <Text style={[styles.trackTitle, isCurrent && styles.trackTitleActive]} numberOfLines={1}>
                      {t.title || 'Untitled Track'}
                    </Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>
                      {t.artist || artistName}
                    </Text>
                  </View>
                  <Text style={styles.trackDuration}>{formatDuration(t.duration)}</Text>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => downloadTrack && downloadTrack(t)}
                    activeOpacity={0.7}
                  >
                    {isDl ? (
                      <CheckCircle2 size={16} color="#17a398" />
                    ) : (
                      <Download size={16} color="#6b7280" />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => toggleLikeTrack && toggleLikeTrack(trackId)}
                    activeOpacity={0.7}
                  >
                    <Heart
                      size={16}
                      color={isLiked ? '#dc2626' : '#6b7280'}
                      fill={isLiked ? '#dc2626' : 'transparent'}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={() => handleTrackAction(t)}
                    activeOpacity={0.7}
                  >
                    <MoreVertical size={16} color="#9ca3af" />
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ height: currentTrack ? 120 : 60 }} />
        </ScrollView>

        {/* Floating Mini Player matching home screen experience */}
        {currentTrack && (
          <MiniPlayer
            onOpenFullPlayer={handleOpenFull}
            bottomOffset={Platform.OS === 'ios' ? 24 : 12}
          />
        )}

        {/* Admin Modals */}
        <AddAlbumModal
          visible={isAddAlbumOpen}
          onClose={() => setIsAddAlbumOpen(false)}
          initialArtistName={artistName}
          artistTracks={artistTracks}
          artistAvatar={artistCover}
        />

        <EditArtistModal
          visible={isEditArtistOpen}
          onClose={() => setIsEditArtistOpen(false)}
          artist={artist}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1110',
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
  },
  containerLight: {
    backgroundColor: '#f4ede1',
  },
  topBar: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#141d1b',
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  backText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '900',
    color: '#fdfbf7',
    letterSpacing: 0.5,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    maxWidth: 760,
    width: '100%',
    alignSelf: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarWrapper: {
    width: 140,
    height: 140,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#000000',
    overflow: 'hidden',
    backgroundColor: '#141d1b',
    marginBottom: 14,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.5, shadowRadius: 0 },
      android: { elevation: 4 },
    }),
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#082621',
    borderWidth: 1,
    borderColor: '#17a398',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 8,
  },
  verifiedText: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '900',
    color: '#26c4b7',
    letterSpacing: 0.5,
  },
  artistName: {
    fontFamily: 'monospace',
    fontSize: 24,
    fontWeight: '900',
    color: '#fdfbf7',
    textAlign: 'center',
    marginBottom: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141d1b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 6,
    marginBottom: 16,
  },
  metaPillText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '800',
    color: '#9ca3af',
  },
  metaDot: {
    color: '#6b7280',
    fontSize: 10,
  },
  addAlbumHeroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#17a398',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#0b1110',
  },
  addAlbumHeroBtnText: {
    color: '#0b1110',
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  editArtistHeroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#0b1110',
  },
  editArtistHeroBtnText: {
    color: '#0b1110',
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  headerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#17a398',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1.2,
    borderColor: '#0b1110',
  },
  headerAddBtnText: {
    color: '#0b1110',
    fontSize: 9.5,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  emptyAlbumBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    backgroundColor: '#141d1b',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#243b37',
    marginTop: 8,
    gap: 12,
  },
  emptyAlbumText: {
    color: '#9ca3af',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  uploadFirstBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#17a398',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#0b1110',
  },
  uploadFirstBtnText: {
    color: '#0b1110',
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    width: '100%',
    paddingHorizontal: 8,
  },
  adminActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    width: '100%',
    paddingHorizontal: 8,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f59e0b',
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 2, height: 2 }, shadowOpacity: 0.3, shadowRadius: 0 },
      android: { elevation: 3 },
    }),
  },
  queueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#182320',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 6,
  },
  queueBtnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '900',
    color: '#fdfbf7',
    letterSpacing: 0.3,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141d1b',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    gap: 6,
  },
  followBtnActive: {
    backgroundColor: '#17a398',
  },
  followBtnText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '900',
    color: '#fdfbf7',
    letterSpacing: 0.3,
  },
  followBtnTextActive: {
    color: '#0b1110',
  },
  sectionContainer: {
    backgroundColor: '#141d1b',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.4, shadowRadius: 0 },
      android: { elevation: 4 },
    }),
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '900',
    color: '#fdfbf7',
    letterSpacing: 0.5,
  },
  sectionCounter: {
    fontFamily: 'monospace',
    fontSize: 9.5,
    fontWeight: '800',
    color: '#17a398',
  },
  albumGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  albumCard: {
    width: ALBUM_CARD_WIDTH,
    backgroundColor: '#182320',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 10,
    padding: 10,
  },
  albumCover: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#000000',
    marginBottom: 8,
    backgroundColor: '#0b1110',
  },
  albumCardTitle: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '900',
    color: '#fdfbf7',
    marginBottom: 2,
  },
  albumCardSub: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#26c4b7',
    fontWeight: '700',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: 6,
    marginVertical: 1,
  },
  trackRowActive: {
    backgroundColor: 'rgba(23,163,152,0.12)',
  },
  trackNum: {
    width: 24,
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '800',
    color: '#6b7280',
  },
  trackNumActive: {
    color: '#17a398',
  },
  trackThumb: {
    width: 36,
    height: 36,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#000000',
    marginRight: 10,
    backgroundColor: '#182320',
  },
  trackDetails: {
    flex: 1,
    marginRight: 8,
  },
  trackTitle: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '800',
    color: '#fdfbf7',
    marginBottom: 2,
  },
  trackTitleActive: {
    color: '#26c4b7',
  },
  trackArtist: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#9ca3af',
  },
  trackDuration: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#6b7280',
    marginRight: 8,
  },
  iconBtn: {
    padding: 6,
  },
});
