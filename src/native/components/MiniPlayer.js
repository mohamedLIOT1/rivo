import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Platform, ActivityIndicator } from 'react-native';
import { Play, Pause, Heart } from 'lucide-react-native';
import { useAudioPlayer, useAudioProgress } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { colors } from '../theme/colors';

export default function MiniPlayer({ onOpenFullPlayer }) {
  const { currentTrack, isPlaying, isLoading, togglePlay } = useAudioPlayer();
  const { currentTime, duration } = useAudioProgress();
  const { likedTrackIds, toggleLikeTrack } = useUser();

  if (!currentTrack) return null;

  const trackId = String(currentTrack._id || currentTrack.id);
  const isLiked = likedTrackIds.includes(trackId);
  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const defaultCover = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300';

  return (
    <View style={styles.outerDock}>
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
            <Image
              source={{ uri: currentTrack.coverUrl || currentTrack.cover || defaultCover }}
              style={styles.cover}
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
});
