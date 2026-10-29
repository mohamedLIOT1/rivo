import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Play, Pause, Heart, MoreVertical, Disc } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';
import { normalizeCoverUri } from '../utils/coverUtils';
import { getTrackMusicalData, getCamelotColor } from '../utils/musicAnalysis';
import { isQuranContent } from '../../utils/quranUtils';

export default React.memo(function SongItem({
  track,
  onPlay,
  onOpenActionMenu,
  onMorePress,
  isCurrent: propIsCurrent,
  isLiked: propIsLiked,
  showBpmKey: propShowBpmKey,
}) {
  const { isDark = true } = useTheme?.() || {};
  const { currentTrack, isPlaying, isLoading, togglePlay, playTrack, downloadedTracks = [], isMixMode } = useAudioPlayer();
  const { likedTrackIds = [], toggleLikeTrack } = useUser();
  const [imageError, setImageError] = React.useState(false);

  if (!track) return null;

  const handleAction = onOpenActionMenu || onMorePress;

  const trackId = String(track._id || track.id || '');
  const isCurrent = propIsCurrent !== undefined 
    ? propIsCurrent 
    : (String(currentTrack?._id || currentTrack?.id || '') === trackId && trackId !== '');
  const isLiked = propIsLiked !== undefined
    ? propIsLiked
    : (Array.isArray(likedTrackIds) ? likedTrackIds.includes(trackId) : false);
  const safeDownloaded = Array.isArray(downloadedTracks) ? downloadedTracks : [];
  const isDownloaded = safeDownloaded.some(t => {
    if (trackId && String(t._id || t.id) === trackId) return true;
    const tTitle = (t.title || '').trim().toLowerCase();
    const tArtist = (t.artist || '').trim().toLowerCase();
    const curTitle = (track.title || '').trim().toLowerCase();
    const curArtist = (track.artist || '').trim().toLowerCase();
    return Boolean(curTitle && tTitle && curTitle === tTitle && (!curArtist || !tArtist || curArtist === tArtist));
  });

  const isQuran = Boolean(
    track.isQuran ||
    track.isQuranTrack ||
    (typeof isQuranContent === 'function' && isQuranContent(track)) ||
    (track.album && /quran|قرآن/i.test(track.album)) ||
    (track.title && /سورة|سوره|قرآن|قران/i.test(track.title))
  );

  const shouldShowBpmKey = !isQuran && (propShowBpmKey === true);
  const musicalData = React.useMemo(() => shouldShowBpmKey ? getTrackMusicalData(track) : null, [shouldShowBpmKey, track]);
  const camelotColor = React.useMemo(() => musicalData ? getCamelotColor(musicalData.key) : null, [musicalData]);

  const rawCover = track.coverUrl || track.cover || track.coverImage || '';
  const coverSourceUri = imageError ? normalizeCoverUri(null, track) : normalizeCoverUri(rawCover, track);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        !isDark && styles.containerLight,
        isCurrent && (isDark ? styles.activeContainer : styles.activeContainerLight)
      ]}
      onPress={() => {
        if (isCurrent) togglePlay();
        else if (onPlay) onPlay(track);
        else if (playTrack) playTrack(track);
      }}
      activeOpacity={0.8}
    >
      {/* Cover Image */}
      <View style={[styles.coverBox, !isDark && styles.coverBoxLight]}>
        <View style={[styles.coverPlaceholder, !isDark && styles.coverPlaceholderLight]}>
          <Disc size={20} color={!isDark ? '#94a3b8' : '#1c332e'} strokeWidth={1.8} />
        </View>
        <Image
          source={{ uri: coverSourceUri }}
          style={styles.cover}
          fadeDuration={0}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
      </View>

      {/* Title & Artist */}
      <View style={styles.info}>
        <Text style={[styles.title, !isDark && styles.titleLight, isCurrent && styles.activeTitle]} numberOfLines={1}>
          {track.title || 'Untitled'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
          <Text style={[styles.artist, !isDark && styles.artistLight]} numberOfLines={1}>
            {track.artist || 'Unknown Artist'}
          </Text>
          {isDownloaded && (
            <View style={[styles.localBadge, !isDark && styles.localBadgeLight]}>
              <Text style={[styles.localBadgeText, !isDark && styles.localBadgeTextLight]}>OFFLINE</Text>
            </View>
          )}
          {shouldShowBpmKey && musicalData && camelotColor && (
            <View style={styles.bpmKeyRow}>
              <View style={[styles.camelotBadge, { backgroundColor: camelotColor.bg, borderColor: camelotColor.border }]}>
                <Text style={[styles.camelotBadgeText, { color: camelotColor.text }]}>{musicalData.key}</Text>
              </View>
              <Text style={styles.bpmBadgeText}>{musicalData.bpm} BPM</Text>
            </View>
          )}
        </View>
      </View>

      {/* Action Icons */}
      <View style={styles.actions}>
        {/* Heart */}
        <TouchableOpacity
          onPress={() => toggleLikeTrack(trackId)}
          style={styles.iconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Heart
            size={16}
            color={isLiked ? colors.crimson : (!isDark ? '#64748b' : '#94a3b8')}
            fill={isLiked ? colors.crimson : 'transparent'}
          />
        </TouchableOpacity>

        {/* 3 Dots */}
        {handleAction && (
          <TouchableOpacity
            onPress={() => handleAction(track)}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MoreVertical size={16} color={!isDark ? '#64748b' : '#94a3b8'} />
          </TouchableOpacity>
        )}

        {/* Teal Square Play Button */}
        <TouchableOpacity
          style={styles.playBtn}
          onPress={() => {
            if (isCurrent) togglePlay();
            else if (onPlay) onPlay(track);
            else if (playTrack) playTrack(track);
          }}
          activeOpacity={0.85}
        >
          {isCurrent && isLoading ? (
            <ActivityIndicator size="small" color="#0b1110" />
          ) : isCurrent && isPlaying ? (
            <Pause size={13} color="#0b1110" fill="#0b1110" />
          ) : (
            <Play size={13} color="#0b1110" fill="#0b1110" style={{ marginLeft: 1 }} />
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 4,
    backgroundColor: '#0c1815',
    borderWidth: 1,
    borderColor: '#152b24',
  },
  containerLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  activeContainer: {
    backgroundColor: '#122621',
    borderColor: '#10b981',
  },
  activeContainerLight: {
    backgroundColor: '#f0fdf4',
    borderColor: '#10b981',
  },
  coverBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#152b24',
  },
  coverBoxLight: {
    backgroundColor: '#f1f5f9',
  },
  coverPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#152b24',
  },
  coverPlaceholderLight: {
    backgroundColor: '#f1f5f9',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  info: {
    flex: 1,
    marginLeft: 10,
    marginRight: 6,
    justifyContent: 'center',
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: '#e2e8f0',
    letterSpacing: -0.2,
  },
  titleLight: {
    color: '#0f172a',
  },
  activeTitle: {
    color: '#10b981',
  },
  artist: {
    fontSize: 11,
    color: '#94a3b8',
    maxWidth: 140,
  },
  artistLight: {
    color: '#64748b',
  },
  localBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderWidth: 0.8,
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  localBadgeLight: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  localBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    color: '#10b981',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  localBadgeTextLight: {
    color: '#15803d',
  },
  bpmKeyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 2,
  },
  camelotBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 0.8,
  },
  camelotBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  bpmBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    padding: 6,
  },
  playBtn: {
    width: 30,
    height: 30,
    borderRadius: 7,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 2,
  },
});
