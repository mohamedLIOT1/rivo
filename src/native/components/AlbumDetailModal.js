import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  Dimensions,
  Platform,
  Animated,
  BackHandler,
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
import { useTranslation } from '../context/LocalizationContext';
import { colors } from '../theme/colors';
import { normalizeCoverUri } from '../utils/coverUtils';
import { formatDuration, sanitizeDuration } from '../utils/timeUtils';
import { isArabicText } from '../theme/typography';
import { API_BASE_URL } from '../config';
import { INITIAL_TRACKS } from '../data/initialTracks';

import MiniPlayer from './MiniPlayer';

const { width } = Dimensions.get('window');


function areEqualAlbumRow(prev, next) {
  const prevId = String(prev.track?._id || prev.track?.id || '');
  const nextId = String(next.track?._id || next.track?.id || '');
  return (
    prevId === nextId &&
    prev.isCurrent === next.isCurrent &&
    prev.isLiked === next.isLiked &&
    prev.isDl === next.isDl &&
    prev.isDark === next.isDark &&
    prev.index === next.index
  );
}

const AlbumTrackRow = React.memo(({
  track,
  index,
  isCurrent,
  isLiked,
  isDl,
  coverUri,
  albumArtist,
  onPlay,
  onOpenFullPlayer,
  onDownload,
  onToggleLike,
  onTrackAction,
  styles,
  isDark = true,
}) => {
  const numStr = (index + 1) < 10 ? `0${index + 1}` : `${index + 1}`;
  const trackCover = normalizeCoverUri(track.coverUrl || track.cover || coverUri);
  const isTitleArabic = isArabicText(track?.title);
  const isArtistArabic = isArabicText(track?.artist || albumArtist);

  return (
    <TouchableOpacity
      style={[styles.trackRow, isCurrent && styles.trackRowActive]}
      onPress={() => {
        if (isCurrent) {
          if (onOpenFullPlayer) {
            onOpenFullPlayer();
          } else {
            onPlay(track);
          }
        } else {
          onPlay(track);
        }
      }}
      activeOpacity={0.8}
    >
      <Text style={[styles.trackNum, isCurrent && styles.trackNumActive]}>
        {numStr}
      </Text>

      <Image source={{ uri: trackCover }} style={styles.trackThumb} resizeMode="cover" fadeDuration={0} />

      <View style={styles.trackDetails}>
        <Text
          style={[
            styles.trackTitle,
            !isDark && styles.trackTitleLight,
            isCurrent && styles.trackTitleActive,
            isTitleArabic && { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
          ]}
          numberOfLines={1}
        >
          {track.title || 'Untitled Track'}
        </Text>
        <Text
          style={[
            styles.trackArtist,
            !isDark && styles.trackArtistLight,
            isArtistArabic && { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
          ]}
          numberOfLines={1}
        >
          {track.artist || albumArtist}
        </Text>
      </View>

      <Text style={styles.trackDuration}>{formatDuration(track.duration, 210)}</Text>

      <TouchableOpacity
        style={styles.iconBtn}
        onPress={() => onDownload && onDownload(track)}
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
        onPress={() => onToggleLike && onToggleLike(String(track._id || track.id || ''))}
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
        onPress={() => onTrackAction && onTrackAction(track)}
        activeOpacity={0.7}
      >
        <MoreVertical size={16} color="#9ca3af" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}, (prev, next) => {
  return (
    prev.isCurrent === next.isCurrent &&
    prev.isLiked === next.isLiked &&
    prev.isDl === next.isDl &&
    prev.isDark === next.isDark &&
    prev.coverUri === next.coverUri &&
    prev.albumArtist === next.albumArtist &&
    (prev.track?._id || prev.track?.id) === (next.track?._id || next.track?.id) &&
    prev.track?.title === next.track?.title &&
    prev.track?.duration === next.track?.duration
  );
});

export default function AlbumDetailModal({
  visible,
  album,
  onClose,
  allTracks = [],
  onTrackAction,
  onSelectArtist,
  onOpenFullPlayer,
}) {
  const { playTrack, currentTrack, isPlaying, addMultipleToQueue, downloadedTracks = [], handleDownloadTrack, handleDownloadPlaylist, openFullPlayer: contextOpenFullPlayer } = useAudioPlayer();
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
  const { token, syncUserData, playlists = [], likedTrackIds = [], toggleLikeTrack, tracks: contextTracks = [] } = useUser();
  const { showToast } = useToast();
  const { isDark } = useTheme();
  const { t, isRTL } = useTranslation();

  const rtlTextStyle = useMemo(() => (
    isRTL ? {
      letterSpacing: 0,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    } : null
  ), [isRTL]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (!album) return;
    const targetId = String(album._id || album.id || '');
    const altTargetId = String(album.id || album._id || '');
    const already = (playlists || []).some(p => {
      const pId = String(p.id || '');
      const pObjId = String(p._id || '');
      const pSrcId = String(p.sourcePlaylistId || '');
      return (targetId && (pId === targetId || pObjId === targetId || pSrcId === targetId)) ||
             (altTargetId && (pId === altTargetId || pObjId === altTargetId || pSrcId === altTargetId));
    });
    setIsSaved(already);
  }, [album, playlists]);

  const [remoteTracks, setRemoteTracks] = useState([]);

  // Resolve album tracks
  const albumTracks = useMemo(() => {
    if (!album) return [];
    if (Array.isArray(album.tracks) && album.tracks.length > 0 && typeof album.tracks[0] === 'object' && album.tracks[0].title) {
      return album.tracks;
    }

    const pool = (allTracks && allTracks.length > 0) ? allTracks : (contextTracks && contextTracks.length > 0 ? contextTracks : (INITIAL_TRACKS || []));
    const rawIds = [
      ...(Array.isArray(album.trackIds) ? album.trackIds : []),
      ...(Array.isArray(album.tracks) ? album.tracks : []),
    ];

    if (rawIds.length > 0) {
      const idMatches = rawIds.map(item => {
        if (!item) return null;
        if (typeof item === 'object' && item.title) return item;
        const id = (typeof item === 'object' && item !== null) ? String(item._id || item.id || '') : String(item || '');
        if (!id) return null;
        return (pool || []).find(t => t && String(t._id || t.id) === id);
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

  // Always fetch full tracks from API to avoid truncated local fallback lists
  useEffect(() => {
    if (!visible || !album) {
      setRemoteTracks([]);
      return;
    }

    let isMounted = true;
    const albId = String(album._id || album.id || '');
    const isAlb = Boolean(album.isAlbum || albId.startsWith('album-'));
    const isPl = Boolean(album.isPlaylist) && !isAlb;

    const tryFetch = async () => {
      try {
        if (isAlb && albId) {
          const res = await fetch(`${API_BASE_URL}/api/albums/${encodeURIComponent(albId)}`);
          if (res.ok) {
            const d = await res.json();
            const list = d.album?.tracks || d.tracks || [];
            if (isMounted && Array.isArray(list) && list.length > 0) {
              setRemoteTracks(list);
              return;
            }
          }
        }

        if (isPl && albId) {
          const res = await fetch(`${API_BASE_URL}/api/playlists/${encodeURIComponent(albId)}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          if (res.ok) {
            const d = await res.json();
            const list = d.playlist?.tracks || d.tracks || [];
            if (isMounted && Array.isArray(list) && list.length > 0) {
              setRemoteTracks(list);
              return;
            }
          }
        }

        const cleanId = albId.replace(/^album-/, '');
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
            return;
          }
        }

        // Fallback: If album has no tracks in DB by album name, query by artist
        const artName = album.artist;
        if (artName && artName !== 'Various Artists') {
          const artRes = await fetch(`${API_BASE_URL}/api/tracks?artist=${encodeURIComponent(artName)}`);
          if (artRes.ok) {
            const artD = await artRes.json();
            const artList = artD.tracks || (Array.isArray(artD) ? artD : []);
            if (isMounted && Array.isArray(artList) && artList.length > 0) {
              setRemoteTracks(artList);
            }
          }
        }
      } catch {}
    };

    tryFetch();

    return () => {
      isMounted = false;
    };
  }, [visible, album?.id, album?._id, album?.name, album?.isPlaylist]);

  const effectiveAlbumTracks = useMemo(() => {
    const list = remoteTracks.length > 0 ? remoteTracks : albumTracks;
    const seenIds = new Set();
    const seenTitles = new Set();
    const unique = [];
    for (const t of list) {
      if (!t || typeof t !== 'object' || !t.title) continue;
      const tid = String(t._id || t.id || '');
      const normTitle = String(t.title || '').trim().toLowerCase().replace(/[/\\?%*:|"<>_()\-]/g, ' ').replace(/\s+/g, ' ').trim();
      if (tid && seenIds.has(tid)) continue;
      if (normTitle && seenTitles.has(normTitle)) continue;
      if (tid) seenIds.add(tid);
      if (normTitle) seenTitles.add(normTitle);
      unique.push(t);
    }
    return unique;
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
    const totalSec = effectiveAlbumTracks.reduce((acc, t) => acc + sanitizeDuration(t.duration, 210), 0);
    return Math.round(totalSec / 60);
  }, [effectiveAlbumTracks]);

  const isPlaylist = Boolean(album?.isPlaylist);
  const coverUri = album?.cover || album?.coverUrl || effectiveAlbumTracks[0]?.cover || effectiveAlbumTracks[0]?.coverUrl;
  const albumTitle = album?.name || (isPlaylist ? 'Untitled Playlist' : 'Untitled Album');
  const albumArtist = album?.artist || effectiveAlbumTracks[0]?.artist || (isPlaylist ? 'Curator' : 'Various Artists');
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
    if (!token) {
      showToast('Please sign in to save playlists', 'info');
      return;
    }
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);
    try {
      const albId = String(album._id || album.id || album.name || '');
      const isPl = Boolean(album.isPlaylist || !album.isAlbum);
      const plTracks = (effectiveAlbumTracks && effectiveAlbumTracks.length > 0 ? effectiveAlbumTracks : (album.tracks || []))
        .map(t => (t && typeof t === 'object') ? String(t._id || t.id) : String(t))
        .filter(Boolean);
      const res = await fetch(`${API_BASE_URL}/api/playlists/${encodeURIComponent(albId)}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: nextSaved ? 'save' : 'unsave',
          name: albumTitle,
          cover: coverUri,
          artist: albumArtist,
          isAlbum: !isPl,
          tracks: plTracks,
          playlist: {
            id: String(albId),
            name: albumTitle,
            cover: coverUri,
            description: album.description || (albumArtist ? `By ${albumArtist}` : 'Saved playlist'),
            trackIds: plTracks.length > 0 ? plTracks : (album.trackIds || []),
            isPublic: true,
            isAlbum: !isPl,
          }
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const finalSaved = data.saved !== undefined ? data.saved : nextSaved;
        setIsSaved(finalSaved);
        showToast(finalSaved ? (isPl ? 'Saved playlist to your library!' : 'Saved album to your library!') : 'Removed from library', 'success');
        if (syncUserData) await syncUserData();
      } else {
        setIsSaved(!nextSaved);
        showToast('Failed to save to library', 'error');
      }
    } catch {
      setIsSaved(!nextSaved);
      showToast('Failed to update library', 'error');
    }
  };

  const { height: SCREEN_HEIGHT } = Dimensions.get('window');
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: Platform.OS === 'android' ? 0 : 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: SCREEN_HEIGHT,
      duration: Platform.OS === 'android' ? 0 : 180,
      useNativeDriver: true,
    }).start(() => {
      onClose && onClose();
    });
  };

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => sub.remove();
  }, [visible]);
  if (!visible || !album) return null;

  const curTrackId = String(currentTrack?._id || currentTrack?.id || '');
  const likedSet = new Set((likedTrackIds || []).map(String));
  const downloadedSet = new Set((downloadedTracks || []).map(d => String(d._id || d.id)));

  const handlePlayRow = (selected) => {
    playTrack(selected, effectiveAlbumTracks);
  };

  const handleDownloadRow = (selected) => {
    if (handleDownloadTrack) handleDownloadTrack(selected);
  };

  const handleToggleLikeRow = (id) => {
    if (toggleLikeTrack) toggleLikeTrack(id);
  };

  const renderTrackItem = ({ item: t, index }) => {
    const trackId = String(t._id || t.id || '');
    const isCurrent = curTrackId !== '' && curTrackId === trackId;
    const isLiked = likedSet.has(trackId);
    const isDl = downloadedSet.has(trackId) || Boolean(t.isDownloaded || t.localAudioUri);

    return (
      <AlbumTrackRow
        track={t}
        index={index}
        isCurrent={isCurrent}
        isLiked={isLiked}
        isDl={isDl}
        coverUri={coverUri}
        albumArtist={albumArtist}
        onPlay={handlePlayRow}
        onOpenFullPlayer={handleOpenFull}
        onDownload={handleDownloadRow}
        onToggleLike={handleToggleLikeRow}
        onTrackAction={handleTrackAction}
        styles={styles}
        isDark={isDark}
      />
    );
  };

  return (
    <Animated.View
      style={[
        styles.fullScreenWrapper,
        !isDark && styles.containerLight,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
      renderToHardwareTextureAndroid={true}
    >
      <View style={[styles.container, !isDark && styles.containerLight]}>
        {/* Top Header Bar matching Image 3 */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={handleClose} style={[styles.backBtn, !isDark && styles.backBtnLight]} activeOpacity={0.8}>
            <ArrowLeft size={20} color={!isDark ? '#0b1110' : '#fdfbf7'} strokeWidth={2.5} style={isRTL && { transform: [{ rotate: '180deg' }] }} />
            <Text style={[styles.backText, !isDark && styles.backTextLight, rtlTextStyle]}>
              {isRTL ? 'رجوع' : 'RETURN'}
            </Text>
          </TouchableOpacity>

          <View style={[styles.batchBadge, !isDark && styles.batchBadgeLight]}>
            <Text style={[styles.batchText, !isDark && styles.batchTextLight, rtlTextStyle]}>
              {isRTL ? `وصفة صوتية رسمية • تشغيلة #${batchNumber}` : `OFFICIAL AUDIO PRESCRIPTION • BATCH #${batchNumber}`}
            </Text>
          </View>
        </View>

        <FlatList
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          data={filteredTracks}
          keyExtractor={(t, idx) => String(t._id || t.id || idx)}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          windowSize={7}
          updateCellsBatchingPeriod={30}
          removeClippedSubviews={Platform.OS === 'android'}
          ListHeaderComponent={(
            <View>
              {/* Hero Card matching Image 3 */}
              <View style={[styles.heroCard, !isDark && styles.heroCardLight]}>
                <View style={styles.heroLayout}>
                  {/* Cover Art with RIVO-TAPE badge */}
                  <View style={styles.coverWrapper}>
                    <Image
                      source={{ uri: normalizeCoverUri(coverUri) }}
                      style={styles.heroCover}
                      resizeMode="cover"
                      fadeDuration={0}
                    />
                    <View style={styles.tapeBadge}>
                      <Text style={styles.tapeText}>RIVO-TAPE</Text>
                    </View>
                  </View>

                  {/* Title & Meta Info */}
                  <View style={styles.heroInfo}>
                    <View style={[styles.albumBadge, isPlaylist && { borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.15)' }]}>
                      <Text style={[styles.albumBadgeText, isPlaylist && { color: '#f59e0b' }, rtlTextStyle]}>
                        {isPlaylist ? (isRTL ? 'قائمة تشغيل رسمية' : 'OFFICIAL PLAYLIST') : (isRTL ? 'ألبوم رسمي' : 'OFFICIAL ALBUM')}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.albumTitle,
                        !isDark && styles.albumTitleLight,
                        (isRTL || isArabicText(albumTitle)) && {
                          letterSpacing: 0,
                          fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
                        },
                      ]}
                      numberOfLines={2}
                    >
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
                      <Text
                        style={[
                          styles.albumArtist,
                          !isDark && styles.albumArtistLight,
                          (isRTL || isArabicText(albumArtist)) && {
                            letterSpacing: 0,
                            fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
                          },
                        ]}
                      >
                        {isPlaylist ? (isRTL ? 'إعداد: ' : 'Curated by ') : (isRTL ? 'ألبوم للفنان: ' : 'Album by ')}
                        <Text style={styles.artistHighlight}>{albumArtist}</Text>
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.statsPillRow}>
                      <View style={[styles.statsPill, !isDark && styles.statsPillLight, isPlaylist && { backgroundColor: 'rgba(23,163,152,0.18)', borderColor: '#17a398' }]}>
                        <Text style={[styles.statsPillText, !isDark && styles.statsPillTextLight, isPlaylist && { color: '#17a398' }, rtlTextStyle]}>
                          {isPlaylist ? (isRTL ? 'قائمة تشغيل' : 'PLAYLIST') : (isRTL ? 'ألبوم' : 'ALBUM')}
                        </Text>
                      </View>
                      {(album?.isMix || (album?.name && album.name.toLowerCase().includes('mix'))) && (
                        <View style={[styles.statsPill, { backgroundColor: 'rgba(245,158,11,0.18)', borderColor: '#f59e0b', marginLeft: 4 }]}>
                          <Text style={[styles.statsPillText, { color: '#f59e0b' }, rtlTextStyle]}>
                            {isRTL ? 'مكس DJ' : 'DJ MIX'}
                          </Text>
                        </View>
                      )}
                      {isPlaylist && (
                        <View style={[styles.statsPill, { backgroundColor: album?.isPublic !== false ? 'rgba(23,163,152,0.15)' : 'rgba(107,114,128,0.15)', borderColor: album?.isPublic !== false ? '#17a398' : '#4b5563', marginLeft: 4 }]}>
                          <Text style={[styles.statsPillText, { color: album?.isPublic !== false ? '#17a398' : '#9ca3af' }, rtlTextStyle]}>
                            {isRTL ? (album?.isPublic !== false ? 'عام' : 'خاص') : (album?.isPublic !== false ? 'PUBLIC' : 'PRIVATE')}
                          </Text>
                        </View>
                      )}
                      <Text style={styles.statsDot}>•</Text>
                      <Text style={[styles.statsMeta, !isDark && styles.statsMetaLight, rtlTextStyle]}>
                        {effectiveAlbumTracks.length} {isRTL ? 'مقاطع' : 'TRACKS'}
                      </Text>
                      <Text style={styles.statsDot}>•</Text>
                      <Text style={[styles.statsMeta, !isDark && styles.statsMetaLight, rtlTextStyle]}>
                        {totalMinutes} {isRTL ? 'دقيقة' : 'MIN'}
                      </Text>
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
                    accessibilityLabel={album?.isMix ? (isRTL ? 'تشغيل مكس DJ' : 'PLAY DJ MIX') : (isRTL ? 'تشغيل الكل' : 'PLAY ALL')}
                  >
                    <Play size={22} color="#0b1110" fill="#0b1110" style={{ marginLeft: 2 }} />
                  </TouchableOpacity>

                  {/* Queue Playlist Button */}
                  <TouchableOpacity
                    style={[styles.actionBtn, !isDark && styles.actionBtnLight]}
                    onPress={() => {
                      if (addMultipleToQueue && effectiveAlbumTracks.length > 0) {
                        addMultipleToQueue(effectiveAlbumTracks);
                      }
                    }}
                    activeOpacity={0.8}
                  >
                    <ListPlus size={15} color="#26c4b7" strokeWidth={2.2} />
                    <Text style={[styles.actionBtnText, !isDark && styles.actionBtnTextLight, rtlTextStyle]}>
                      {isRTL ? 'إضافة للانتظار' : (isPlaylist ? 'QUEUE PLAYLIST' : 'QUEUE ALL')}
                    </Text>
                  </TouchableOpacity>

                  {/* Save to Library Button */}
                  <TouchableOpacity
                    style={[styles.actionBtn, !isDark && styles.actionBtnLight, isSaved && styles.actionBtnActive]}
                    onPress={handleToggleSave}
                    activeOpacity={0.8}
                  >
                    {isSaved ? (
                      <BookmarkCheck size={15} color="#17a398" strokeWidth={2.4} />
                    ) : (
                      <BookmarkPlus size={15} color={!isDark ? '#0b1110' : '#fdfbf7'} strokeWidth={2.2} />
                    )}
                    <Text style={[styles.actionBtnText, !isDark && styles.actionBtnTextLight, rtlTextStyle]}>
                      {isSaved ? (isRTL ? 'محفوظ' : 'SAVED') : (isRTL ? 'حفظ' : 'SAVE')}
                    </Text>
                  </TouchableOpacity>

                  {/* Download All Button */}
                  <TouchableOpacity
                    style={[styles.actionBtn, !isDark && styles.actionBtnLight]}
                    onPress={handleDownloadAll}
                    activeOpacity={0.8}
                  >
                    <Download size={15} color="#26c4b7" strokeWidth={2.2} />
                    <Text style={[styles.actionBtnText, !isDark && styles.actionBtnTextLight, rtlTextStyle]}>
                      {isRTL ? `تنزيل الكل (${effectiveAlbumTracks.length})` : `DOWNLOAD (${effectiveAlbumTracks.length})`}
                    </Text>
                  </TouchableOpacity>

                  {/* Shuffle Button */}
                  <TouchableOpacity
                    style={[styles.actionBtn, !isDark && styles.actionBtnLight]}
                    onPress={() => handlePlayAll(true)}
                    activeOpacity={0.8}
                  >
                    <Shuffle size={15} color="#f59e0b" strokeWidth={2.2} />
                    <Text style={[styles.actionBtnText, !isDark && styles.actionBtnTextLight, rtlTextStyle]}>
                      {isRTL ? 'عشوائي' : 'SHUFFLE'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Prescription Search Bar matching Image 3 */}
                <View style={[styles.searchBar, !isDark && styles.searchBarLight]}>
                  <Search size={16} color={!isDark ? '#57534e' : '#6b7280'} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[styles.searchInput, !isDark && styles.searchInputLight, isRTL && { textAlign: 'right' }, rtlTextStyle]}
                    placeholder={isRTL ? 'ابحث في قائمة المقاطع...' : 'Search in prescription list...'}
                    placeholderTextColor={!isDark ? '#78716c' : '#6b7280'}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Table Header matching Image 3 */}
              <View style={[styles.tableHeader, !isDark && styles.tableHeaderLight]}>
                <Text style={[styles.colHeader, !isDark && styles.colHeaderLight, { width: 34 }, rtlTextStyle]}>#</Text>
                <Text style={[styles.colHeader, !isDark && styles.colHeaderLight, { flex: 1, paddingLeft: 8 }, rtlTextStyle]}>
                  {isRTL ? 'العنوان والفنان' : 'TITLE & ARTIST'}
                </Text>
                <Text style={[styles.colHeader, !isDark && styles.colHeaderLight, { width: 90, textAlign: 'right' }, rtlTextStyle]}>
                  {isRTL ? 'إجراءات' : 'ACTIONS'}
                </Text>
              </View>
            </View>
          )}
          renderItem={renderTrackItem}
          ListFooterComponent={<View style={{ height: currentTrack ? 120 : 60 }} />}
        />

        {/* Floating Mini Player matching home screen experience */}
        {currentTrack && (
          <MiniPlayer
            onOpenFullPlayer={handleOpenFull}
            bottomOffset={Platform.OS === 'ios' ? 24 : 12}
          />
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fullScreenWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0b1110',
    zIndex: 120,
    elevation: Platform.OS === 'android' ? 0 : 20,
  },
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
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
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
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
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
      android: { elevation: 0 },
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
      android: { elevation: 0 },
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
  // ── Light Theme Adaptations ──
  backBtnLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  backTextLight: {
    color: '#0b1110',
  },
  batchBadgeLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  batchTextLight: {
    color: '#082621',
  },
  heroCardLight: {
    backgroundColor: '#fdfbf7',
    borderColor: '#0b1110',
  },
  albumTitleLight: {
    color: '#0b1110',
  },
  albumArtistLight: {
    color: '#57534e',
  },
  statsPillLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  statsPillTextLight: {
    color: '#0b1110',
  },
  statsMetaLight: {
    color: '#57534e',
  },
  actionBtnLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  actionBtnTextLight: {
    color: '#0b1110',
  },
  searchBarLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  searchInputLight: {
    color: '#0b1110',
  },
  tableHeaderLight: {
    borderBottomColor: '#d6c8b0',
  },
  colHeaderLight: {
    color: '#57534e',
  },
  trackTitleLight: {
    color: '#0b1110',
  },
  trackArtistLight: {
    color: '#57534e',
  },
});
