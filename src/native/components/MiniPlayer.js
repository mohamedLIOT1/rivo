import React from 'react';
import { View, Text, TouchableOpacity, Image, Platform, ActivityIndicator } from 'react-native';
import { Play, Pause, Heart, Disc, RotateCcw, RotateCw } from 'lucide-react-native';
import { useAudioPlayer, useAudioProgress } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';
import { normalizeCoverUri } from '../utils/coverUtils';
import { isQuranContent } from '../../utils/quranUtils';
import { isPodcastContent } from '../utils/podcastUtils';
import { styles } from './miniPlayerStyles';

const MiniProgressBar = React.memo(function MiniProgressBar({ isLive, isDark, defaultDuration }) {
  const { currentTime, duration } = useAudioProgress();
  const effectiveDuration = (duration && duration > 0) ? duration : (defaultDuration || 240);
  const progressPercent = isLive ? 100 : (effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0);

  return (
    <View style={[styles.progressTrack, !isDark && styles.progressTrackLight]}>
      <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: isLive ? '#ef4444' : colors.mint }]} />
    </View>
  );
});

function MiniPlayer({ onOpenFullPlayer, bottomOffset }) {
  const { isDark = true } = useTheme?.() || {};
  const { currentTrack, isPlaying, isLoading, togglePlay, isMixMode, vocalIsolationStatus, queue, jumpBy } = useAudioPlayer();
  const { likedTrackIds = [], toggleLikeTrack } = useUser();
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [currentTrack?._id, currentTrack?.id]);

  if (!currentTrack) return null;

  const trackId = String(currentTrack?._id || currentTrack?.id || '');
  const isLiked = Array.isArray(likedTrackIds) ? likedTrackIds.includes(trackId) : false;
  const isQuran = isQuranContent(currentTrack);
  const isPodcast = isPodcastContent(currentTrack);
  const isLive = Boolean(currentTrack?.isLive || currentTrack?.genre === 'quran-radio');
  const rawCover = currentTrack?.coverUrl || currentTrack?.cover || '';
  const coverUri = imageError ? normalizeCoverUri(null, currentTrack) : normalizeCoverUri(rawCover, currentTrack);

  const dockBottom = bottomOffset !== undefined ? bottomOffset : (Platform.OS === 'ios' ? 14 : 10);

  return (
    <View style={[styles.outerDock, { bottom: dockBottom }]} renderToHardwareTextureAndroid={true}>

            {/* Real-Time AI Vocal Isolation Progress Banner (Strictly Hidden for Holy Quran) */}
      {!isQuran && vocalIsolationStatus?.isProcessing && (
        <View style={styles.miniVocalBanner}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <View style={styles.miniVocalDot} />
            <Text style={styles.miniVocalTitle} numberOfLines={1}>
              ISOLATING VOCALS (AI): <Text style={{ color: colors.mint }}>{vocalIsolationStatus.progress || 0}%</Text>
            </Text>
          </View>
          <Text style={styles.miniVocalEta} numberOfLines={1} ellipsizeMode="tail">
            {vocalIsolationStatus.eta || 'WAITING'}
          </Text>
        </View>
      )}

      {currentTrack && (
        <TouchableOpacity
          style={[styles.container, !isDark && styles.containerLight]}
          onPress={onOpenFullPlayer}
          activeOpacity={0.9}
        >
        {/* Top Progress Line (Isolated to MiniProgressBar to prevent re-rendering MiniPlayer at 4Hz) */}
        <MiniProgressBar isLive={isLive} isDark={isDark} defaultDuration={Number(currentTrack?.duration || 240)} />

        <View style={styles.contentRow}>
          {/* Cover Art */}
          <View style={[styles.coverFrame, !isDark && styles.coverFrameLight]}>
            <View style={[styles.coverPlaceholder, !isDark && styles.coverPlaceholderLight]}>
              <Disc size={18} color="#17a398" strokeWidth={1.8} />
            </View>
            {!imageError && coverUri ? (
              <Image
                source={{ uri: coverUri }}
                style={styles.cover}
                resizeMode="cover"
                fadeDuration={0}
                onError={() => setImageError(true)}
              />
            ) : null}
          </View>

          {/* Title & Artist */}
          <View style={styles.textColumn}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isLive && (
                <View style={{ backgroundColor: '#ef4444', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                  <Text style={{ color: '#ffffff', fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>LIVE</Text>
                </View>
              )}
              {isPodcast && (
                <View style={{ backgroundColor: 'rgba(23, 163, 152, 0.2)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 0.5, borderColor: colors.mint }}>
                  <Text style={{ color: colors.mint, fontSize: 9, fontWeight: '800', letterSpacing: 0.5 }}>🎙️ PODCAST</Text>
                </View>
              )}
              {Boolean(!isQuran && isMixMode && (currentTrack?.isMix || currentTrack?._isMix || queue?.isMix || queue?._isMix || (queue?.name && String(queue.name).toUpperCase().includes('MIX')) || (queue?._playlistName && String(queue._playlistName).toUpperCase().includes('MIX')))) && (
                <View style={{ backgroundColor: '#f59e0b', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                  <Text style={{ color: '#0b1110', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 }}>🎛️ MIX</Text>
                </View>
              )}
              <Text style={[styles.title, !isDark && styles.titleLight, { flex: 1 }]} numberOfLines={1}>
                {currentTrack.title || 'Untitled'}
              </Text>
            </View>
            {isLoading ? (
              <Text style={styles.connectingText} numberOfLines={1}>
                CONNECTING STREAM...
              </Text>
            ) : (
              <Text style={[styles.artist, !isDark && styles.artistLight]} numberOfLines={1}>
                {isLive ? 'Holy Quran Radio • 24/7' : (currentTrack.artist || 'Unknown Artist')}
              </Text>
            )}
            {!isQuran && Boolean(isMixMode && (currentTrack?.isMix || currentTrack?._isMix || queue?.isMix || queue?._isMix || (queue?.name && String(queue.name).toUpperCase().includes('MIX')) || (queue?._playlistName && String(queue._playlistName).toUpperCase().includes('MIX')))) && (
              <Text style={styles.mixSubtitle} numberOfLines={1}>
                🎛️ {queue?._playlistName || queue?.name || currentTrack?.mixName || 'Mix'}
              </Text>
            )}
          </View>

          {/* Actions */}
          {isPodcast ? (
            <View style={styles.podcastButtonsRow}>
              <TouchableOpacity
                style={[styles.jumpBtn, !isDark && styles.jumpBtnLight]}
                onPress={() => jumpBy?.(-15)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <View style={styles.miniJumpInner}>
                  <RotateCcw size={18} color={!isDark ? '#334155' : '#cbd5e1'} strokeWidth={2.2} />
                  <View style={styles.miniJumpCenter}>
                    <Text style={[styles.miniJumpNumber, !isDark && styles.miniJumpNumberLight]}>15</Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.playBtn}
                onPress={togglePlay}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#0b1110" />
                ) : isPlaying ? (
                  <Pause size={15} color="#0b1110" fill="#0b1110" />
                ) : (
                  <Play size={15} color="#0b1110" fill="#0b1110" style={{ marginLeft: 1 }} />
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.jumpBtn, !isDark && styles.jumpBtnLight]}
                onPress={() => jumpBy?.(15)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
              >
                <View style={styles.miniJumpInner}>
                  <RotateCw size={18} color={!isDark ? '#334155' : '#cbd5e1'} strokeWidth={2.2} />
                  <View style={styles.miniJumpCenter}>
                    <Text style={[styles.miniJumpNumber, !isDark && styles.miniJumpNumberLight]}>15</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => toggleLikeTrack(trackId)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Heart
                  size={18}
                  color={isLiked ? colors.crimson : (!isDark ? '#64748b' : '#94a3b8')}
                  fill={isLiked ? colors.crimson : 'transparent'}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.playBtn}
                onPress={togglePlay}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#0b1110" />
                ) : isPlaying ? (
                  <Pause size={15} color="#0b1110" fill="#0b1110" />
                ) : (
                  <Play size={15} color="#0b1110" fill="#0b1110" style={{ marginLeft: 1 }} />
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>
    )}
  </View>
);
}

export default React.memo(MiniPlayer);
