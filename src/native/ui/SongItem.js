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
import { isArabicText } from '../theme/typography';

function areEqualSongItem(prev, next) {
  const prevId = String(prev.track?._id || prev.track?.id || '');
  const nextId = String(next.track?._id || next.track?.id || '');
  if (prevId !== nextId) return false;
  if (Boolean(prev.isCurrent) !== Boolean(next.isCurrent)) return false;
  if (Boolean(prev.isPlaying) !== Boolean(next.isPlaying)) return false;
  if (Boolean(prev.isLiked) !== Boolean(next.isLiked)) return false;
  if (Boolean(prev.isLoading) !== Boolean(next.isLoading)) return false;
  if (Boolean(prev.isDark) !== Boolean(next.isDark)) return false;
  if (Boolean(prev.isDownloaded) !== Boolean(next.isDownloaded)) return false;
  if (Boolean(prev.showBpmKey) !== Boolean(next.showBpmKey)) return false;
  if (prev.track?.title !== next.track?.title) return false;
  if (prev.track?.artist !== next.track?.artist) return false;
  if (prev.mixName !== next.mixName) return false;
  if (prev.playlistName !== next.playlistName) return false;
  if (Boolean(prev.isMixMode) !== Boolean(next.isMixMode)) return false;
  return true;
}

export const SongItemPure = React.memo(function SongItemPure({
  track,
  onPlay,
  onTogglePlay,
  onOpenActionMenu,
  onMorePress,
  onToggleLike,
  isCurrent = false,
  isPlaying = false,
  isLoading = false,
  isLiked = false,
  isDownloaded = false,
  showBpmKey = false,
  isDark = true,
  isMixMode = false,
  mixName,
  playlistName,
}) {
  const [failedRawCover, setFailedRawCover] = React.useState(null);

  const rawCover = track?.coverUrl || track?.cover || track?.coverImage || track?.thumbnail || track?.artwork || track?.remoteCoverUrl || track?.originalCoverUrl || track?.albumCover || '';
  const imageError = Boolean(rawCover && failedRawCover === rawCover);

  if (!track) return null;

  const handleAction = onOpenActionMenu || onMorePress;
  const trackId = String(track._id || track.id || '');

  const isQuran = Boolean(
    track.isQuran ||
    track.isQuranTrack ||
    (typeof isQuranContent === 'function' && isQuranContent(track)) ||
    (track.album && /quran|قرآن/i.test(track.album)) ||
    (track.title && /سورة|سوره|قرآن|قران/i.test(track.title))
  );

  const shouldShowBpmKey = !isQuran && (showBpmKey === true);
  const musicalData = React.useMemo(() => shouldShowBpmKey ? getTrackMusicalData(track) : null, [shouldShowBpmKey, track]);
  const camelotColor = React.useMemo(() => musicalData ? getCamelotColor(musicalData.key) : null, [musicalData]);

  const coverSourceUri = imageError ? normalizeCoverUri(null, track) : normalizeCoverUri(rawCover, track);

  const isTitleArabic = isArabicText(track?.title);
  const isArtistArabic = isArabicText(track?.artist);

  return (
    <TouchableOpacity
      style={[
        styles.container,
        !isDark && styles.containerLight,
        isCurrent && (isDark ? styles.activeContainer : styles.activeContainerLight)
      ]}
      onPress={() => onPlay && onPlay(track)}
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
          resizeMethod={Platform.OS === 'android' ? 'resize' : 'auto'}
          onError={() => setFailedRawCover(rawCover || '__err__')}
        />
      </View>

      {/* Title & Artist */}
      <View style={styles.info}>
        <Text
          style={[
            styles.title,
            !isDark && styles.titleLight,
            isCurrent && styles.activeTitle,
            isTitleArabic && { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
          ]}
          numberOfLines={1}
        >
          {track.title || 'Untitled'}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
          <Text
            style={[
              styles.artist,
              !isDark && styles.artistLight,
              isArtistArabic && { letterSpacing: 0, fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif' },
            ]}
            numberOfLines={1}
          >
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
        {!isQuran && (mixName || ((isMixMode || track?.isMix || track?._isMix) && (track?.mixName || playlistName || mixName))) && (
          <Text style={styles.mixNameBadge} numberOfLines={1}>
            🎛️ {mixName || track?.mixName || playlistName || 'Mix'}
          </Text>
        )}
      </View>

      {/* Action Icons */}
      <View style={styles.actions}>
        {/* Heart */}
        <TouchableOpacity
          onPress={() => onToggleLike && onToggleLike(trackId)}
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

        {/* Teal Square Play/Pause Button */}
        <TouchableOpacity
          style={styles.playBtn}
          onPress={() => {
            if (isCurrent && typeof onTogglePlay === 'function') {
              onTogglePlay();
            } else if (onPlay) {
              onPlay(track);
            }
          }}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
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
}, areEqualSongItem);

function ContextSongItem(props) {
  const { isDark = true } = useTheme?.() || {};
  const { currentTrack, isPlaying, isLoading, togglePlay, playTrack, downloadedTracks = [], isMixMode = false, currentQueue } = useAudioPlayer();
  const { likedTrackIds = [], toggleLikeTrack } = useUser();
  const trackId = String(props.track?._id || props.track?.id || '');
  const isCurrent = props.isCurrent !== undefined ? props.isCurrent : (String(currentTrack?._id || currentTrack?.id || '') === trackId && trackId !== '');
  const isLiked = props.isLiked !== undefined ? props.isLiked : (Array.isArray(likedTrackIds) ? likedTrackIds.includes(trackId) : false);

  const handlePlay = props.onPlay || (() => {
    if (isCurrent) togglePlay();
    else if (playTrack) playTrack(props.track);
  });

  return (
    <SongItemPure
      {...props}
      isDark={props.isDark !== undefined ? props.isDark : isDark}
      isCurrent={isCurrent}
      isPlaying={props.isPlaying !== undefined ? props.isPlaying : (isCurrent && isPlaying)}
      isLoading={props.isLoading !== undefined ? props.isLoading : (isCurrent && isLoading)}
      isLiked={isLiked}
      isMixMode={props.isMixMode !== undefined ? props.isMixMode : isMixMode}
      mixName={props.mixName || (props.isMixMode || isMixMode ? (currentQueue?._playlistName || currentQueue?.name || props.playlistName || props.track?.mixName) : null)}
      onPlay={handlePlay}
      onToggleLike={props.onToggleLike || toggleLikeTrack}
    />
  );
}

export default React.memo(function SongItem(props) {
  // If parent screen passes isCurrent and onPlay, bypass context subscription entirely (Zero render storm on playback start!)
  if (props.isCurrent !== undefined && props.onPlay) {
    return <SongItemPure isDark={props.isDark !== undefined ? props.isDark : true} {...props} />;
  }
  return <ContextSongItem {...props} />;
}, areEqualSongItem);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 64,
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
  mixNameBadge: {
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    color: '#34d399',
    marginTop: 2,
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
