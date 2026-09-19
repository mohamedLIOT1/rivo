import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Play, Pause, Heart, Download, CheckCircle, Trash2, Plus } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import PlaylistPickerModal from './PlaylistPickerModal';

export default React.memo(function SongItem({ track, onPlay, showDelete = false }) {
  const { currentTrack, isPlaying, isLoading, togglePlay, handleDownloadTrack, handleRemoveDownload, downloadedTracks, downloadingIds } = useAudioPlayer();
  const { likedTrackIds, toggleLikeTrack, addToPlaylist, removeTrackFromPlaylist } = useUser();
  const { showToast } = useToast();

  const [isPickerVisible, setIsPickerVisible] = useState(false);

  const trackId = track._id || track.id;
  const isCurrent = (currentTrack?._id || currentTrack?.id) === trackId;
  const isLiked = likedTrackIds.includes(trackId);

  const downloadedRecord = downloadedTracks.find(t => (t._id || t.id) === trackId);
  const isDownloaded = !!downloadedRecord || track.isDownloaded;
  const downloadProgress = downloadingIds[trackId];
  const isDownloading = downloadProgress !== undefined;

  const defaultCover = 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=80';

  return (
    <TouchableOpacity 
      style={[styles.container, isCurrent && styles.activeContainer]} 
      onPress={() => {
        if (isCurrent) togglePlay();
        else if (onPlay) onPlay(track);
      }}
      activeOpacity={0.7}
    >
      <Image 
        source={{ uri: track.coverUrl || track.cover || defaultCover }} 
        style={styles.cover} 
      />

      <View style={styles.info}>
        <Text style={[styles.title, isCurrent && styles.activeText]} numberOfLines={1}>
          {track.title || 'Untitled'}
        </Text>
        <Text style={styles.artist} numberOfLines={1}>
          {track.artist || 'Unknown Artist'}
        </Text>
      </View>

      <View style={styles.actions}>
        {/* Delete button (Specific for Offline/Playlists) */}
        {showDelete && (
          <TouchableOpacity
            onPress={() => {
              handleRemoveDownload(trackId);
              showToast('Removed from Offline');
            }}
            style={styles.iconBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Trash2 size={20} color="#ef4444" />
          </TouchableOpacity>
        )}

        {/* Add to Playlist */}
        <TouchableOpacity
          onPress={() => setIsPickerVisible(true)}
          style={styles.iconBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Plus size={20} color="#a1a1aa" />
        </TouchableOpacity>

        {/* Like Button */}
        <TouchableOpacity
          onPress={() => toggleLikeTrack(trackId)}
          style={styles.iconBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Heart size={20} color={isLiked ? '#ef4444' : '#a1a1aa'} fill={isLiked ? '#ef4444' : 'transparent'} />
        </TouchableOpacity>

        {/* Download / Offline File Action */}
        {isDownloading ? (
          <View style={styles.downloadProgressBox}>
            <ActivityIndicator size="small" color="#1DB954" />
            <Text style={styles.progressText}>{downloadProgress}%</Text>
          </View>
        ) : isDownloaded ? (
          <TouchableOpacity onPress={() => handleRemoveDownload(trackId)} style={styles.iconBtn}>
            <CheckCircle size={20} color="#1DB954" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => handleDownloadTrack(track)} style={styles.iconBtn}>
            <Download size={20} color="#a1a1aa" />
          </TouchableOpacity>
        )}

        {/* Play/Pause / Loading Button */}
        <View
          style={[styles.playBtn, isCurrent && styles.activePlayBtn]}
        >
          {isCurrent && isLoading ? (
            <ActivityIndicator size="small" color="#000" />
          ) : isCurrent && isPlaying ? (
            <Pause size={18} color="#000" />
          ) : (
            <Play size={18} color={isCurrent ? '#000' : '#fff'} style={{ marginLeft: 2 }} />
          )}
        </View>
      </View>

      <PlaylistPickerModal
        visible={isPickerVisible}
        onClose={() => setIsPickerVisible(false)}
        trackId={trackId}
        trackTitle={track?.title}
        onSelect={(plId, allowDup) => addToPlaylist(plId, trackId, allowDup)}
        onRemove={(plId) => removeTrackFromPlaylist(plId, trackId)}
      />
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginVertical: 4,
    borderRadius: 12,
    backgroundColor: '#18181b',
  },
  activeContainer: {
    backgroundColor: '#27272a',
    borderColor: '#1DB954',
    borderWidth: 1,
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#27272a',
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
    textAlign: 'left',
  },
  activeText: {
    color: '#1DB954',
  },
  artist: {
    fontSize: 13,
    color: '#a1a1aa',
    marginTop: 2,
    textAlign: 'left',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    padding: 6,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activePlayBtn: {
    backgroundColor: '#1DB954',
  },
  downloadProgressBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  progressText: {
    fontSize: 9,
    color: '#1DB954',
    fontWeight: 'bold',
    marginTop: 2,
  },
});
