import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Play, Pause, Heart, MoreVertical } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { colors } from '../theme/colors';

export default React.memo(function SongItem({ track, onPlay, onOpenActionMenu, onMorePress }) {
  const { currentTrack, isPlaying, isLoading, togglePlay, playTrack } = useAudioPlayer();
  const { likedTrackIds, toggleLikeTrack } = useUser();

  const handleAction = onOpenActionMenu || onMorePress;

  const trackId = String(track._id || track.id);
  const isCurrent = String(currentTrack?._id || currentTrack?.id) === trackId;
  const isLiked = likedTrackIds.includes(trackId);

  const defaultCover = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400';

  return (
    <TouchableOpacity
      style={[styles.container, isCurrent && styles.activeContainer]}
      onPress={() => {
        if (isCurrent) togglePlay();
        else if (onPlay) onPlay(track);
        else if (playTrack) playTrack(track);
      }}
      activeOpacity={0.8}
    >
      {/* Cover Image */}
      <View style={styles.coverBox}>
        <Image
          source={{ uri: track.coverUrl || track.cover || defaultCover }}
          style={styles.cover}
        />
      </View>

      {/* Title & Artist */}
      <View style={styles.info}>
        <Text style={[styles.title, isCurrent && styles.activeTitle]} numberOfLines={1}>
          {track.title || 'Untitled'}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track.artist || 'Unknown Artist'}
        </Text>
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
            color={isLiked ? colors.crimson : '#94a3b8'}
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
            <MoreVertical size={16} color="#94a3b8" />
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
    backgroundColor: '#141d1b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#263330',
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  activeContainer: {
    borderColor: '#17a398',
    backgroundColor: '#1a2623',
  },
  coverBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#0b1110',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  info: {
    flex: 1,
    marginLeft: 10,
    marginRight: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  activeTitle: {
    color: '#26c4b7',
  },
  artist: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: 6,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#17a398',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
});
