import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, Share, ActivityIndicator } from 'react-native';
import { X, Play, ListPlus, Heart, Download, Share2, CheckCircle2 } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';

export default function TrackActionMenuModal({ visible, track, onClose, onOpenAddToPlaylist }) {
  if (!track) return null;

  const { playTrack, addToQueue, handleDownloadTrack, downloadedTracks = [], downloadingIds = {} } = useAudioPlayer();
  const { likedTrackIds = [], toggleLikeTrack } = useUser();

  const trackId = String(track._id || track.id || '');
  const isLiked = Array.isArray(likedTrackIds) ? likedTrackIds.includes(trackId) : false;
  const safeDownloaded = Array.isArray(downloadedTracks) ? downloadedTracks : [];
  const isDownloaded = safeDownloaded.some(t => String(t._id || t.id) === trackId) || Boolean(track?.isDownloaded || track?.localAudioUri);
  const isDownloading = Boolean(downloadingIds && downloadingIds[trackId] !== undefined);
  const defaultCover = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400';

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Listen to "${track.title}" by ${track.artist || 'Unknown'} on Rivo Music!`,
      });
    } catch {}
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheetOuter}>
          <View style={styles.hardShadow} />
          <View style={styles.sheet}>
            {/* Header Track Preview */}
            <View style={styles.header}>
              <View style={styles.coverBox}>
                <Image
                  source={{ uri: track.coverUrl || track.cover || defaultCover }}
                  style={styles.cover}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <CassetteTag label="AUDIO TAPE ACTIONS" bg={colors.ink} textColor={colors.tealLight} />
                <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
                <Text style={styles.artist} numberOfLines={1}>{track.artist || 'Unknown Artist'}</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={colors.ink} />
              </TouchableOpacity>
            </View>

            {/* Actions List */}
            <View style={styles.actionsList}>
              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  playTrack(track);
                  onClose();
                }}
              >
                <Play size={18} color={colors.ink} fill={colors.teal} />
                <Text style={styles.actionText}>Play Now</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  addToQueue(track);
                  onClose();
                }}
              >
                <ListPlus size={18} color={colors.ink} />
                <Text style={styles.actionText}>Add to Queue</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  toggleLikeTrack(trackId);
                  onClose();
                }}
              >
                <Heart
                  size={18}
                  color={isLiked ? colors.crimson : colors.ink}
                  fill={isLiked ? colors.crimson : 'transparent'}
                />
                <Text style={styles.actionText}>{isLiked ? 'Remove from Liked' : 'Save to Liked Tapes'}</Text>
              </TouchableOpacity>

              {onOpenAddToPlaylist && (
                <TouchableOpacity
                  style={styles.actionRow}
                  onPress={() => {
                    onClose();
                    onOpenAddToPlaylist(track);
                  }}
                >
                  <ListPlus size={18} color={colors.tealDark} />
                  <Text style={styles.actionText}>Add to Playlist</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.actionRow, (isDownloaded || isDownloading) && { opacity: 0.9 }]}
                disabled={isDownloading}
                onPress={() => {
                  handleDownloadTrack(track);
                  onClose();
                }}
              >
                {isDownloading ? (
                  <ActivityIndicator size="small" color={colors.teal} />
                ) : isDownloaded ? (
                  <CheckCircle2 size={18} color={colors.tealDark} />
                ) : (
                  <Download size={18} color={colors.ink} />
                )}
                <Text style={[styles.actionText, isDownloaded && { color: colors.tealDark, fontWeight: '700' }]}>
                  {isDownloading
                    ? `Downloading (${downloadingIds[trackId] || 0}%)...`
                    : isDownloaded
                    ? 'Saved in Offline Vault'
                    : 'Download Offline Tape'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionRow}
                onPress={() => {
                  handleShare();
                  onClose();
                }}
              >
                <Share2 size={18} color={colors.ink} />
                <Text style={styles.actionText}>Share Tape</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(8, 38, 33, 0.85)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  sheetOuter: {
    position: 'relative',
  },
  hardShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    backgroundColor: colors.ink,
  },
  sheet: {
    backgroundColor: colors.paper,
    borderWidth: 3.5,
    borderColor: colors.ink,
    padding: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
    marginBottom: 8,
  },
  coverBox: {
    borderWidth: 2,
    borderColor: colors.ink,
    overflow: 'hidden',
  },
  cover: {
    width: 48,
    height: 48,
    backgroundColor: colors.ink,
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
    color: colors.ink,
    marginTop: 4,
  },
  artist: {
    fontSize: 12,
    color: colors.tealDark,
    fontWeight: '700',
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  actionsList: {
    gap: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.paperDark,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.ink,
  },
});
