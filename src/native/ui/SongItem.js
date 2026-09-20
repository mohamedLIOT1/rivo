import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Play, Pause, Heart, Download, CheckCircle, MoreVertical, Plus } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { colors } from '../theme/colors';

export default React.memo(function SongItem({ track, onPlay, onOpenActionMenu, onMorePress }) {
  const { currentTrack, isPlaying, isLoading, togglePlay, playTrack, handleDownloadTrack, removeDownloadedTrack, downloadedTracks, downloadingIds } = useAudioPlayer();
  const { likedTrackIds, toggleLikeTrack } = useUser();

  const handleAction = onOpenActionMenu || onMorePress;

  const trackId = String(track._id || track.id);
  const isCurrent = String(currentTrack?._id || currentTrack?.id) === trackId;
  const isLiked = likedTrackIds.includes(trackId);

  const downloadedRecord = downloadedTracks.find(t => String(t._id || t.id) === trackId);
  const isDownloaded = !!downloadedRecord || track.isDownloaded;
  const downloadProgress = downloadingIds[trackId];
  const isDownloading = downloadProgress !== undefined;

  const defaultCover = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400';

  return (
    <View style={styles.outerWrapper}>
      {/* Black hard shadow underneath */}
      <View style={styles.hardShadow} />

      <TouchableOpacity
        style={[styles.container, isCurrent && styles.activeContainer]}
        onPress={() => {
          if (isCurrent) togglePlay();
          else if (onPlay) onPlay(track);
          else if (playTrack) playTrack(track);
        }}
        activeOpacity={0.8}
      >
        {/* Cover with brutal border */}
        <View style={styles.coverBox}>
          <Image
            source={{ uri: track.coverUrl || track.cover || defaultCover }}
            style={styles.cover}
          />
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={[styles.title, isCurrent && styles.activeTitle]} numberOfLines={1}>
            {track.title || 'Untitled Tape'}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {track.artist || 'Unknown Artist'}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {/* Like */}
          <TouchableOpacity
            onPress={() => toggleLikeTrack(trackId)}
            style={styles.iconBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Heart
              size={18}
              color={isLiked ? colors.crimson : colors.textMuted}
              fill={isLiked ? colors.crimson : 'transparent'}
            />
          </TouchableOpacity>

          {/* Download */}
          {isDownloading ? (
            <View style={styles.iconBtn}>
              <ActivityIndicator size="small" color={colors.teal} />
            </View>
          ) : isDownloaded ? (
            <TouchableOpacity onPress={() => removeDownloadedTrack(trackId)} style={styles.iconBtn}>
              <CheckCircle size={18} color={colors.teal} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => handleDownloadTrack(track)} style={styles.iconBtn}>
              <Download size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* More options (Context Menu) */}
          {handleAction && (
            <TouchableOpacity onPress={() => handleAction(track)} style={styles.iconBtn}>
              <MoreVertical size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}

          {/* Play / Pause circular button */}
          <View style={[styles.playBtn, isCurrent && styles.activePlayBtn]}>
            {isCurrent && isLoading ? (
              <ActivityIndicator size="small" color={colors.ink} />
            ) : isCurrent && isPlaying ? (
              <Pause size={14} color={colors.ink} />
            ) : (
              <Play size={14} color={isCurrent ? colors.ink : colors.textWhite} style={{ marginLeft: 2 }} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
});

const styles = StyleSheet.create({
  outerWrapper: {
    position: 'relative',
    marginVertical: 4,
    marginRight: 4,
    marginBottom: 6,
  },
  hardShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    backgroundColor: colors.ink,
    zIndex: 0,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
    borderWidth: 2.5,
    borderColor: colors.ink,
    paddingVertical: 8,
    paddingHorizontal: 12,
    zIndex: 1,
  },
  activeContainer: {
    backgroundColor: '#182924',
    borderColor: colors.tealLight,
  },
  coverBox: {
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 2,
    overflow: 'hidden',
  },
  cover: {
    width: 44,
    height: 44,
    backgroundColor: colors.ink,
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textWhite,
  },
  activeTitle: {
    color: colors.tealLight,
  },
  artist: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    fontWeight: '600',
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
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activePlayBtn: {
    backgroundColor: colors.teal,
  },
});
