import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, ActivityIndicator } from 'react-native';
import { Play, Pause, Heart, Disc } from 'lucide-react-native';
import { useAudioPlayer, useAudioProgress } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { colors } from '../theme/colors';
import { normalizeCoverUri } from '../utils/coverUtils';

export default function MiniPlayer({ onOpenFullPlayer, bottomOffset }) {
  const { currentTrack, isPlaying, isLoading, togglePlay } = useAudioPlayer();
  const { currentTime, duration } = useAudioProgress();
  const { likedTrackIds = [], toggleLikeTrack } = useUser();
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    setImageError(false);
  }, [currentTrack?._id, currentTrack?.id]);

  if (!currentTrack) return null;

  const trackId = String(currentTrack?._id || currentTrack?.id || '');
  const isLiked = Array.isArray(likedTrackIds) ? likedTrackIds.includes(trackId) : false;
  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const rawCover = currentTrack?.coverUrl || currentTrack?.cover || '';
  const coverUri = imageError ? normalizeCoverUri(null, currentTrack) : normalizeCoverUri(rawCover, currentTrack);

  const dockBottom = bottomOffset !== undefined ? bottomOffset : (Platform.OS === 'ios' ? 70 : 56);

  return (
    <View style={[styles.outerDock, { bottom: dockBottom }]}>

      {currentTrack && (
        <TouchableOpacity
          style={styles.container}
          onPress={onOpenFullPlayer}
          activeOpacity={0.9}
        >
        {/* Top Progress Line */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>

        <View style={styles.contentRow}>
          {/* Cover Art */}
          <View style={styles.coverFrame}>
            <View style={styles.coverPlaceholder}>
              <Disc size={18} color="#17a398" strokeWidth={1.8} />
            </View>
            <Image
              source={{ uri: coverUri }}
              style={styles.cover}
              onError={() => setImageError(true)}
            />
          </View>

          {/* Title & Artist */}
          <View style={styles.textColumn}>
            <Text style={styles.title} numberOfLines={1}>
              {currentTrack.title || 'Untitled'}
            </Text>
            {isLoading ? (
              <Text style={styles.connectingText} numberOfLines={1}>
                CONNECTING STREAM...
              </Text>
            ) : (
              <Text style={styles.artist} numberOfLines={1}>
                {currentTrack.artist || 'Unknown Artist'}
              </Text>
            )}
          </View>

          {/* Actions */}
          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => toggleLikeTrack(trackId)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Heart
                size={18}
                color={isLiked ? colors.crimson : '#94a3b8'}
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
        </View>
      </TouchableOpacity>
    )}
  </View>
);
}

const styles = StyleSheet.create({
  outerDock: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 70 : 56,
    left: 8,
    right: 8,
    zIndex: 90,
  },
  container: {
    backgroundColor: '#111817',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#263330',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  progressTrack: {
    height: 2.5,
    backgroundColor: '#1e2928',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#17a398',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  coverFrame: {
    width: 38,
    height: 38,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#0b1110',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#12211e',
  },
  textColumn: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  title: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#ffffff',
  },
  artist: {
    fontSize: 10.5,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 1,
  },
  connectingText: {
    fontSize: 9.5,
    color: '#26c4b7',
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 1,
  },
  buttonsRow: {
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
    borderRadius: 8,
    backgroundColor: '#17a398',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0e1614',
    borderWidth: 1,
    borderColor: '#17a398',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 6,
  },
  connectPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#17a398',
  },
  connectTitle: {
    color: '#17a398',
    fontSize: 9.5,
    fontFamily: 'monospace',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  connectSub: {
    color: '#e2e8f0',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  connectSwitchBtn: {
    backgroundColor: '#17a398',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  connectSwitchBtnText: {
    color: '#0b1110',
    fontSize: 9.5,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
});
