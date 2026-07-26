import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Play, Pause, SkipForward } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';

export default function MiniPlayer({ onOpenFullPlayer }) {
  const { currentTrack, isPlaying, isLoading, togglePlay, playNextTrack, currentTime, duration } = useAudioPlayer();

  if (!currentTrack) return null;

  const defaultCover = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=80';
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onOpenFullPlayer} 
      activeOpacity={0.9}
    >
      {/* Progress Bar Top Edge */}
      <View style={styles.progressTrack}>
        <View style={[styles.fillProgress, { width: `${Math.min(progressPercent, 100)}%` }]} />
      </View>

      <View style={styles.content}>
        <Image 
          source={{ uri: currentTrack.coverUrl || currentTrack.cover || defaultCover }} 
          style={styles.cover} 
        />

        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={1}>
            {currentTrack.title || 'Untitled'}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {currentTrack.artist || 'Unknown Artist'}
          </Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity onPress={togglePlay} style={styles.playBtn} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : isPlaying ? (
              <Pause size={20} color="#000" />
            ) : (
              <Play size={20} color="#000" style={{ marginLeft: 2 }} />
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={playNextTrack} style={styles.iconBtn}>
            <SkipForward size={22} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 60,
    left: 12,
    right: 12,
    backgroundColor: '#18181b',
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  progressTrack: {
    height: 3,
    backgroundColor: '#27272a',
    width: '100%',
  },
  fillProgress: {
    height: '100%',
    backgroundColor: '#1DB954',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  cover: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#27272a',
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  artist: {
    fontSize: 12,
    color: '#a1a1aa',
    marginTop: 2,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1DB954',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBtn: {
    padding: 6,
  },
});
