import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  Dimensions,
  Platform,
} from 'react-native';
import {
  ArrowLeft,
  Play,
  Pause,
  Shuffle,
  Disc,
  Heart,
  Download,
  CheckCircle2,
  ListPlus,
  Search,
  MoreVertical,
  CheckSquare,
  BookmarkPlus,
  BookmarkCheck,
} from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';
import { normalizeCoverUri } from '../utils/coverUtils';
import { API_BASE_URL } from '../config';

import MiniPlayer from './MiniPlayer';

const { width } = Dimensions.get('window');

export default function AlbumDetailModal({
  visible,
  album,
  onClose,
  allTracks = [],
  onTrackAction,
  onSelectArtist,
  onOpenFullPlayer,
}) {
  const { playTrack, currentTrack, isPlaying, addMultipleToQueue, downloadedTracks = [], handleDownloadPlaylist } = useAudioPlayer();
  const { token, syncUserData, likedTrackIds = [], toggleLikeTrack, tracks: contextTracks = [] } = useUser();
  const { showToast } = useToast();
  const { isDark } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  const [remoteTracks, setRemoteTracks] = useState([]);

  // Resolve album tracks
  const albumTracks = useMemo(() => {
    if (!album) return [];
    if (Array.isArray(album.tracks) && album.tracks.length > 0 && typeof album.tracks[0] === 'object' && album.tracks[0].title) {
      return album.tracks;
    }

    const pool = (allTracks && allTracks.length > 0) ? allTracks : (contextTracks && contextTracks.length > 0 ? contextTracks : []);
    const rawIds = [
      ...(Array.isArray(album.trackIds) ? album.trackIds : []),
      ...(Array.isArray(album.tracks) ? album.tracks : []),
    ];

    if (rawIds.length > 0) {
      const idMatches = rawIds.map(item => {
        if (item && typeof item === 'object' && item.title) return item;
        const id = typeof item === 'object' ? String(item._id || item.id) : String(item);
        return pool.find(t => String(t._id || t.id) === id);
      }).filter(Boolean);

      if (idMatches.length > 0) {
        return idMatches;
      }
    }

    const albName = (album.name || '').trim().toLowerCase();
    const cleanAlbName = albName.replace(/^album-/, '').replace(/[-_\s]+/g, ' ').trim();

    return (pool || []).filter((t) => {
      if (!t || typeof t !== 'object') return false;
      const tAlb = (t.album || '').trim().toLowerCase();
      const cleanTAlb = tAlb.replace(/[-_\s]+/g, ' ').trim();
      return albName && (tAlb === albName || cleanTAlb === cleanAlbName);
    });
  }, [album, allTracks, contextTracks]);

  // Fallback: Fetch tracks remotely if 0 found locally
  useEffect(() => {
    if (!visible || !album) {
      setRemoteTracks([]);
      return;
    }
    const hasFullTracks = albumTracks.length > 0 && albumTracks.every(t => t && typeof t === 'object' && t.title);
    if (hasFullTracks) {
      setRemoteTracks([]);
      return;
    }
    let isMounted = true;
    const albId = album._id || album.id;
    const cleanId = albId ? String(albId).replace(/^album-/, '') : '';
    const isPl = Boolean(album.isPlaylist || album.trackIds);

    const tryFetch = async () => {
      try {
        if (isPl && (albId || cleanId)) {
          const res = await fetch(`${API_BASE_URL}/api/playlists/${albId || cleanId}`);
          if (res.ok) {
            const d = await res.json();
            const list = d.playlist?.tracks || d.tracks || [];
            if (isMounted && Array.isArray(list) && list.length > 0) {
              setRemoteTracks(list);
              return;
            }
          }
        }

        const queryName = album.name || cleanId || albId || '';
        const targetUrl = (albId && String(albId).length === 24)
          ? `${API_BASE_URL}/api/albums/${albId}`
          : (cleanId && cleanId.length === 24)
            ? `${API_BASE_URL}/api/albums/${cleanId}`
            : `${API_BASE_URL}/api/albums/${encodeURIComponent(cleanId || queryName)}`;

        let r = await fetch(targetUrl);
        if (!r.ok) {
          r = await fetch(`${API_BASE_URL}/api/tracks?album=${encodeURIComponent(queryName)}`);
        }
        if (r.ok) {
          const d = await r.json();
          const list = d.tracks || (Array.isArray(d) ? d : []);
          if (isMounted && Array.isArray(list) && list.length > 0) {
            setRemoteTracks(list);
          }
        }
      } catch {}
    };

    tryFetch();

    return () => {
      isMounted = false;
    };
  }, [visible, album?.id, album?._id, album?.name, album?.isPlaylist, albumTracks.length]);

  const effectiveAlbumTracks = useMemo(() => {
    const list = albumTracks.length > 0 ? albumTracks : remoteTracks;
    return list.filter(t => t && typeof t === 'object' && t.title);
  }, [albumTracks, remoteTracks]);

  // Filtered tracks by search
  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) return effectiveAlbumTracks;
    const q = searchQuery.toLowerCase().trim();
    return effectiveAlbumTracks.filter(
      (t) =>
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.artist && t.artist.toLowerCase().includes(q))
    );
  }, [effectiveAlbumTracks, searchQuery]);

  // Total runtime minutes
  const totalMinutes = useMemo(() => {
    const totalSec = effectiveAlbumTracks.reduce((acc, t) => acc + (parseInt(t.duration, 10) || 210), 0);
    return Math.round(totalSec / 60);
  }, [effectiveAlbumTracks]);

  if (!visible || !album) return null;

  const isPlaylist = Boolean(album.isPlaylist);
  const coverUri = album.cover || album.coverUrl || effectiveAlbumTracks[0]?.cover || effectiveAlbumTracks[0]?.coverUrl;
  const albumTitle = album.name || (isPlaylist ? 'Untitled Playlist' : 'Untitled Album');
  const albumArtist = album.artist || effectiveAlbumTracks[0]?.artist || (isPlaylist ? 'Curator' : 'Various Artists');
  const batchNumber = Math.abs(albumTitle.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)) % 9000 + 1000;

  const handlePlayAll = (shuffle = false) => {
    if (effectiveAlbumTracks.length === 0) return;
    let queue = [...effectiveAlbumTracks];
    if (shuffle) {
      queue.sort(() => Math.random() - 0.5);
    }
    playTrack(queue[0], queue);
  };

  const handleDownloadAll = () => {
    if (handleDownloadPlaylist && effectiveAlbumTracks.length > 0) {
      handleDownloadPlaylist(effectiveAlbumTracks);
      showToast(`Downloading ${effectiveAlbumTracks.length} tracks offline...`, 'info');
    }
  };

  const handleToggleSave = async () => {
    if (!album) return;
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);
    try {
      const albId = album._id || album.id;
      const res = await fetch(`${API_BASE_URL}/api/playlists/${encodeURIComponent(albId)}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: album.name || album.title,
          cover: album.cover || album.coverUrl,
          artist: album.artist,
          isAlbum: true,
        }),
      });
      if (res.ok) {
        showToast(nextSaved ? 'Saved album to your library!' : 'Removed from saved albums', 'success');
        if (syncUserData) await syncUserData();
      }
    } catch {
      showToast('Failed to update album in library', 'error');
    }
  };

  const formatDuration = (sec) => {
    const s = parseInt(sec, 10) || 210;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, !isDark && styles.containerLight]}>
        {/* Top Header Bar matching Image 3 */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.8}>
            <ArrowLeft size={20} color="#fdfbf7" strokeWidth={2.5} />
            <Text style={styles.backText}>RETURN</Text>
          </TouchableOpacity>

          <View style={styles.batchBadge}>
            <Text style={styles.batchText}>OFFICIAL AUDIO PRESCRIPTION • BATCH #{batchNumber}</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Card matching Image 3 */}
          <View style={styles.heroCard}>
            <View style={styles.heroLayout}>
              {/* Cover Art with RIVO-TAPE badge */}
              <View style={styles.coverWrapper}>
                <Image
                  source={{ uri: normalizeCoverUri(coverUri) }}
                  style={styles.heroCover}
                  resizeMode="cover"
                />
                <View style={styles.tapeBadge}>
                  <Text style={styles.tapeText}>RIVO-TAPE</Text>
                </View>
              </View>

              {/* Title & Meta Info */}
              <View style={styles.heroInfo}>
                <View style={[styles.albumBadge, isPlaylist && { borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                  <Text style={[styles.albumBadgeText, isPlaylist && { color: '#f59e0b' }]}>
                    {isPlaylist ? 'OFFICIAL PLAYLIST' : 'OFFICIAL ALBUM'}
                  </Text>
                </View>

                <Text style={styles.albumTitle} numberOfLines={2}>
                  {albumTitle}
                </Text>

                <TouchableOpacity
                  onPress={() => {
                    if (onSelectArtist && !isPlaylist) {
                      onClose();
                      onSelectArtist(albumArtist);
                    }
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.albumArtist}>
                    {isPlaylist ? 'Curated by ' : 'Album by '}
                    <Text style={styles.artistHighlight}>{albumArtist}</Text>
                  </Text>
                </TouchableOpacity>

                <View style={styles.statsPillRow}>
                  <View style={[styles.statsPill, isPlaylist && { backgroundColor: 'rgba(23,163,152,0.18)', borderColor: '#17a398' }]}>
                    <Text style={[styles.statsPillText, isPlaylist && { color: '#17a398' }]}>
                      {isPlaylist ? 'PLAYLIST' : 'ALBUM'}
                    </Text>
                  </View>
                  <Text style={styles.statsDot}>•</Text>
                  <Text style={styles.statsMeta}>{effectiveAlbumTracks.length} TRACKS</Text>
                  <Text style={styles.statsDot}>•</Text>
                  <Text style={styles.statsMeta}>{totalMinutes} MIN</Text>
                </View>
              </View>
            </View>

            {/* Action Buttons Bar matching Image 3 */}
            <View style={styles.actionBar}>
              {/* Big Yellow Play Button */}
              <TouchableOpacity
                style={styles.playBtn}
                onPress={() => handlePlayAll(false)}
                activeOpacity={0.85}
              >
                <Play size={22} color="#0b1110" fill="#0b1110" style={{ marginLeft: 2 }} />
              </TouchableOpacity>

              {/* Queue Playlist Button */}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  if (addMultipleToQueue && effectiveAlbumTracks.length > 0) {
                    addMultipleToQueue(effectiveAlbumTracks);
                  }
                }}
                activeOpacity={0.8}
              >
                <ListPlus size={15} color="#26c4b7" strokeWidth={2.2} />
                <Text style={styles.actionBtnText}>{isPlaylist ? 'QUEUE PLAYLIST' : 'QUEUE ALL'}</Text>
              </TouchableOpacity>

              {/* Save to Library Button */}
              <TouchableOpacity
                style={[styles.actionBtn, isSaved && styles.actionBtnActive]}
                onPress={handleToggleSave}
                activeOpacity={0.8}
              >
                {isSaved ? (
                  <BookmarkCheck size={15} color="#17a398" strokeWidth={2.4} />
                ) : (
                  <BookmarkPlus size={15} color="#fdfbf7" strokeWidth={2.2} />
                )}
                <Text style={styles.actionBtnText}>{isSaved ? 'SAVED' : 'SAVE'}</Text>
              </TouchableOpacity>

              {/* Download All Button */}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={handleDownloadAll}
                activeOpacity={0.8}
              >
                <Download size={15} color="#26c4b7" strokeWidth={2.2} />
                <Text style={styles.actionBtnText}>DOWNLOAD ({effectiveAlbumTracks.length})</Text>
              </TouchableOpacity>

              {/* Shuffle Button */}
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handlePlayAll(true)}
                activeOpacity={0.8}
              >
                <Shuffle size={15} color="#f59e0b" strokeWidth={2.2} />
                <Text style={styles.actionBtnText}>SHUFFLE</Text>
              </TouchableOpacity>
            </View>

            {/* Prescription Search Bar matching Image 3 */}
            <View style={styles.searchBar}>
              <Search size={16} color="#6b7280" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search in prescription list..."
                placeholderTextColor="#6b7280"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Table Header matching Image 3 */}
          <View style={styles.tableHeader}>
            <Text style={[styles.colHeader, { width: 34 }]}>#</Text>
            <Text style={[styles.colHeader, { flex: 1, paddingLeft: 8 }]}>TITLE & ARTIST</Text>
            <Text style={[styles.colHeader, { width: 90, textAlign: 'right' }]}>ACTIONS</Text>
          </View>

          {/* Tracklist Rows */}
          {filteredTracks.map((t, index) => {
            const trackId = String(t._id || t.id || '');
            const isCurrent = String(currentTrack?._id || currentTrack?.id || '') === trackId && trackId !== '';
            const isLiked = Array.isArray(likedTrackIds) ? likedTrackIds.includes(trackId) : false;
            const isDl = (Array.isArray(downloadedTracks) ? downloadedTracks : []).some(
              (d) => String(d._id || d.id) === trackId
            ) || Boolean(t.isDownloaded || t.localAudioUri);

            const numStr = (index + 1) < 10 ? `0${index + 1}` : `${index + 1}`;
            const trackCover = normalizeCoverUri(t.coverUrl || t.cover || coverUri);

            return (
              <TouchableOpacity
                key={trackId || index}
                style={[styles.trackRow, isCurrent && styles.trackRowActive]}
                onPress={() => playTrack(t, effectiveAlbumTracks)}
                activeOpacity={0.8}
              >
                {/* Index # */}
                <Text style={[styles.trackNum, isCurrent && styles.trackNumActive]}>
                  {numStr}
                </Text>

                {/* Cover Thumbnail */}
                <Image source={{ uri: trackCover }} style={styles.trackThumb} resizeMode="cover" />

                {/* Title & Artist */}
                <View style={styles.trackDetails}>
                  <Text style={[styles.trackTitle, isCurrent && styles.trackTitleActive]} numberOfLines={1}>
                    {t.title || 'Untitled Track'}
                  </Text>
                  <Text style={styles.trackArtist} numberOfLines={1}>
                    {t.artist || albumArtist}
                  </Text>
                </View>

                {/* Duration */}
                <Text style={styles.trackDuration}>{formatDuration(t.duration)}</Text>

                {/* Download Button */}
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

                {/* Like Button */}
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

                {/* Action Menu (3 dots) */}
                <TouchableOpacity
                  style={styles.iconBtn}
                  onPress={() => onTrackAction && onTrackAction(t)}
                  activeOpacity={0.7}
                >
                  <MoreVertical size={16} color="#9ca3af" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}

          <View style={{ height: currentTrack ? 120 : 60 }} />
        </ScrollView>

        {/* Floating Mini Player matching home screen experience */}
        {currentTrack && (
          <MiniPlayer
            onOpenFullPlayer={onOpenFullPlayer}
            bottomOffset={Platform.OS === 'ios' ? 24 : 12}
          />
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
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
  batchBadge: {
    backgroundColor: '#141d1b',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  batchText: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '800',
    color: '#9ca3af',
    letterSpacing: 0.5,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  heroCard: {
    backgroundColor: '#141d1b',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.4, shadowRadius: 0 },
      android: { elevation: 4 },
    }),
  },
  heroLayout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  coverWrapper: {
    width: 105,
    height: 105,
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#ded2bb',
  },
  heroCover: {
    width: '100%',
    height: '100%',
  },
  tapeBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#0b1110',
    borderBottomWidth: 1,
    borderLeftWidth: 1,
    borderColor: '#000000',
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  tapeText: {
    fontFamily: 'monospace',
    fontSize: 7,
    fontWeight: '900',
    color: '#26c4b7',
  },
  heroInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  albumBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#082621',
    borderWidth: 1,
    borderColor: '#17a398',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 6,
  },
  albumBadgeText: {
    fontFamily: 'monospace',
    fontSize: 8.5,
    fontWeight: '900',
    color: '#26c4b7',
    letterSpacing: 0.5,
  },
  albumTitle: {
    fontFamily: 'monospace',
    fontSize: 17,
    fontWeight: '900',
    color: '#fdfbf7',
    marginBottom: 4,
    lineHeight: 22,
  },
  albumArtist: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 8,
  },
  artistHighlight: {
    color: '#26c4b7',
    fontWeight: '900',
  },
  statsPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  statsPill: {
    backgroundColor: '#0b1110',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  statsPillText: {
    fontFamily: 'monospace',
    fontSize: 8.5,
    fontWeight: '900',
    color: '#fdfbf7',
  },
  statsDot: {
    color: '#6b7280',
    fontSize: 10,
  },
  statsMeta: {
    fontFamily: 'monospace',
    fontSize: 9.5,
    fontWeight: '800',
    color: '#9ca3af',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 14,
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
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#182320',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 5,
  },
  actionBtnActive: {
    borderColor: '#17a398',
  },
  actionBtnText: {
    fontFamily: 'monospace',
    fontSize: 9.5,
    fontWeight: '900',
    color: '#fdfbf7',
    letterSpacing: 0.3,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b1110',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#fdfbf7',
    padding: 0,
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    marginBottom: 6,
  },
  colHeader: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '900',
    color: '#6b7280',
    letterSpacing: 0.5,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
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
    width: 38,
    height: 38,
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
