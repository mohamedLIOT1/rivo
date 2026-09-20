import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform } from 'react-native';
import { Play, Pause, SkipForward, Heart } from 'lucide-react-native';
import { useAudioPlayer, useAudioProgress } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { colors } from '../theme/colors';

export default function MiniPlayer({ onOpenFullPlayer }) {
  const { currentTrack, isPlaying, togglePlay, playNextTrack } = useAudioPlayer();
  const { currentTime, duration } = useAudioProgress();
  const { likedTrackIds, toggleLikeTrack } = useUser();

  if (!currentTrack) return null;

  const trackId = String(currentTrack._id || currentTrack.id);
  const isLiked = likedTrackIds.includes(trackId);
  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const defaultCover = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300';

  return (
    <View style={styles.outerDock}>
      {/* Hard shadow */}
      <View style={styles.hardShadow} />

      <TouchableOpacity
        style={styles.container}
        onPress={onOpenFullPlayer}
        activeOpacity={0.9}
      >
        {/* Progress Line on top */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
        </View>

        <View style={styles.contentRow}>
          {/* Cover */}
          <View style={styles.coverFrame}>
            <Image
              source={{ uri: currentTrack.coverUrl || currentTrack.cover || defaultCover }}
              style={styles.cover}
            />
          </View>

          {/* Title and Artist */}
          <View style={styles.textColumn}>
            <Text style={styles.title} numberOfLines={1}>
              {currentTrack.title || 'Untitled Track'}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {currentTrack.artist || 'Unknown Artist'}
            </Text>
          </View>

          {/* Control buttons */}
          <View style={styles.buttonsRow}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => toggleLikeTrack(trackId)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Heart
                size={18}
                color={isLiked ? colors.crimson : colors.textWhite}
                fill={isLiked ? colors.crimson : 'transparent'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playBtn}
              onPress={togglePlay}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              {isPlaying ? (
                <Pause size={16} color={colors.ink} fill={colors.ink} />
              ) : (
                <Play size={16} color={colors.ink} fill={colors.ink} style={{ marginLeft: 2 }} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={playNextTrack}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <SkipForward size={18} color={colors.textWhite} />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  outerDock: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 76 : 58,
    left: 10,
    right: 10,
    zIndex: 90,
  },
  hardShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.ink,
    zIndex: 0,
  },
  container: {
    backgroundColor: colors.surfaceDark,
    borderWidth: 2.5,
    borderColor: colors.ink,
    zIndex: 1,
    overflow: 'hidden',
  },
  progressTrack: {
    height: 3,
    backgroundColor: colors.ink,
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.teal,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  coverFrame: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 2,
    overflow: 'hidden',
  },
  cover: {
    width: 40,
    height: 40,
    backgroundColor: colors.ink,
  },
  textColumn: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textWhite,
  },
  artist: {
    fontSize: 11,
    color: colors.tealLight,
    fontWeight: '700',
    marginTop: 1,
  },
  buttonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    padding: 6,
  },
  playBtn: {
    width: 32,
    height: 32,
    backgroundColor: colors.teal,
    borderWidth: 2,
    borderColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
