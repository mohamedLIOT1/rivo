import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Download, Play, Pause, Trash2, HardDrive, WifiOff, Disc, Wifi } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useToast } from '../context/ToastContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';
import { getDownloadedTracks, removeDownloadedTrack } from '../services/downloadManager';

const TRACKS_DIR = `${FileSystem.documentDirectory}rivo_tracks/`;

export default function OfflineScreen() {
  const { playTrack, currentTrack, isPlaying, togglePlay } = useAudioPlayer();
  const { showToast } = useToast();
  const [offlineTracks, setOfflineTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storageUsed, setStorageUsed] = useState(0);

  useEffect(() => {
    loadOffline();
  }, []);

  const loadOffline = async () => {
    setLoading(true);
    try {
      const list = await getDownloadedTracks();
      setOfflineTracks(list);

      // Calculate total storage used by downloaded tracks
      try {
        const dirInfo = await FileSystem.getInfoAsync(TRACKS_DIR);
        if (dirInfo.exists) {
          const files = await FileSystem.readDirectoryAsync(TRACKS_DIR);
          let totalSize = 0;
          for (const file of files) {
            try {
              const fInfo = await FileSystem.getInfoAsync(TRACKS_DIR + file);
              if (fInfo.exists && fInfo.size) totalSize += fInfo.size;
            } catch {}
          }
          setStorageUsed(totalSize);
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
  };

  const handleDelete = (track) => {
    Alert.alert(
      'REMOVE OFFLINE TAPE',
      `Delete "${track.title}" from local device storage?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const id = track._id || track.id;
            await removeDownloadedTrack(id);
            setOfflineTracks((prev) => prev.filter((t) => (t._id || t.id) !== id));
            showToast('Track removed from storage', 'info');
          },
        },
      ]
    );
  };

  const handlePlayOffline = (track) => {
    if (!track) return;
    const trackId = String(track._id || track.id || '');
    const currentId = String(currentTrack?._id || currentTrack?.id || '');
    if (trackId && trackId === currentId) {
      togglePlay();
      return;
    }
    const audioUri = track.localAudioUri || track.nativeAudioUri || track.audioUrl;
    playTrack({
      ...track,
      id: trackId,
      _id: trackId,
      title: track.title || 'Untitled',
      artist: track.artist || 'Unknown Artist',
      audioUrl: audioUri,
      nativeAudioUri: audioUri,
    }, (offlineTracks || []).filter(Boolean));
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Offline Storage Status Card */}
      <View style={styles.heroOuter}>
        <View style={styles.heroShadow} />
        <View style={styles.heroCard}>
          <View style={styles.topRow}>
            <View style={styles.storagePill}>
              <HardDrive size={13} color={colors.ink} />
              <Text style={styles.storagePillText}>DEVICE FLASH STORAGE</Text>
            </View>
            <CassetteTag label="NO WI-FI REQUIRED" bg={colors.ink} textColor={colors.mint} />
          </View>

          <Text style={styles.heroTitle}>OFFLINE TAPES</Text>
          <Text style={styles.heroSub}>
            Physical audio files cached directly to local NAND storage for zero-latency, airplane mode listening.
          </Text>

          <View style={styles.meterBox}>
            <View style={styles.meterHeader}>
              <Text style={styles.meterLabel}>CACHED RECORDINGS:</Text>
              <Text style={styles.meterValue}>{offlineTracks.length} TAPES</Text>
            </View>
            <View style={styles.meterHeader}>
              <Text style={styles.meterLabel}>STORAGE USED:</Text>
              <Text style={styles.meterValue}>{formatBytes(storageUsed)}</Text>
            </View>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(offlineTracks.length * 5, 100)}%` },
                ]}
              />
            </View>
          </View>
        </View>
      </View>

      {/* Offline Tracks List */}
      <View style={styles.listSection}>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>DOWNLOADED AUDIO CASSETTES</Text>
          <Text style={styles.listCount}>{(offlineTracks || []).length} SAVED</Text>
        </View>

        {(!offlineTracks || offlineTracks.length === 0) ? (
          <View style={styles.emptyCard}>
            <WifiOff size={40} color={colors.teal} />
            <Text style={styles.emptyTitle}>No offline tapes saved</Text>
            <Text style={styles.emptySub}>
              Switch to online mode and tap the download icon on any song to save it for offline playback — no Wi-Fi needed.
            </Text>
            <View style={styles.goOnlineBanner}>
              <Wifi size={13} color={colors.teal} />
              <Text style={styles.goOnlineText}>
                Use the toggle button to go online and download tapes
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.tracksList}>
            {(offlineTracks || []).filter(Boolean).map((track, idx) => {
              const trackId = String(track?._id || track?.id || idx);
              const currentId = String(currentTrack?._id || currentTrack?.id || '');
              const active = Boolean(currentTrack && trackId === currentId);

              return (
                <View key={trackId} style={styles.trackCard}>
                  <Image
                    source={{
                      uri:
                        track?.coverUrl ||
                        track?.cover ||
                        'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400',
                    }}
                    style={styles.cover}
                  />

                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={styles.trackTitle} numberOfLines={1}>
                      {track?.title || 'Untitled'}
                    </Text>
                    <Text style={styles.trackArtist} numberOfLines={1}>
                      {track?.artist || 'Unknown Artist'}
                    </Text>
                    <View style={styles.badgeRow}>
                      <View style={styles.localPill}>
                        <Text style={styles.localPillText}>MP3 LOCAL</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.playBtn}
                      onPress={() => handlePlayOffline(track)}
                    >
                      {active && isPlaying ? (
                        <Pause size={15} color={colors.ink} fill={colors.ink} />
                      ) : (
                        <Play size={15} color={colors.ink} fill={colors.ink} />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(track)}
                    >
                      <Trash2 size={15} color={colors.rust} />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  content: {
    padding: 14,
    paddingBottom: 110,
  },
  heroOuter: {
    marginBottom: 16,
    position: 'relative',
  },
  heroShadow: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: -5,
    bottom: -5,
    backgroundColor: colors.tealDark,
    borderRadius: 12,
  },
  heroCard: {
    backgroundColor: colors.surfaceDark,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 12,
    padding: 16,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  storagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 5,
  },
  storagePillText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 9,
    color: colors.ink,
  },
  heroTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 22,
    color: colors.paper,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 11,
    color: colors.paperMuted,
    lineHeight: 15,
    marginBottom: 14,
  },
  meterBox: {
    backgroundColor: colors.deepForest,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 8,
    padding: 10,
  },
  meterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  meterLabel: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 10,
    color: colors.paperMuted,
  },
  meterValue: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.mint,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.ink,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.mint,
  },
  listSection: {
    marginTop: 4,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 6,
  },
  listTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.tealLight,
  },
  listCount: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.paperMuted,
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceDark,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 10,
  },
  emptyTitle: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 14,
    color: colors.paper,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 11,
    color: colors.paperMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  tracksList: {
    gap: 8,
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    padding: 10,
  },
  cover: {
    width: 46,
    height: 46,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  trackTitle: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 12,
    color: colors.paper,
  },
  trackArtist: {
    fontSize: 10,
    color: colors.paperMuted,
    marginTop: 2,
  },
  badgeRow: {
    marginTop: 4,
  },
  localPill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.ink,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.teal,
  },
  localPillText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 8,
    color: colors.mint,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playBtn: {
    padding: 8,
    backgroundColor: colors.mint,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
  },
  deleteBtn: {
    padding: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1.5,
    borderColor: colors.rust,
    borderRadius: 6,
  },
  goOnlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(23,163,152,0.1)',
    borderWidth: 1.5,
    borderColor: colors.teal,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 14,
  },
  goOnlineText: {
    fontFamily: 'monospace',
    fontWeight: '700',
    fontSize: 9,
    color: colors.teal,
    flex: 1,
  },
});
