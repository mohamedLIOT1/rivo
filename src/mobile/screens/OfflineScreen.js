import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { DownloadCloud, Play, Trash2, HardDrive, Trash } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useToast } from '../context/ToastContext';
import SongItem from '../components/SongItem';

export default function OfflineScreen() {
  const { downloadedTracks, playTrack, handleRemoveDownload } = useAudioPlayer();
  const { showToast } = useToast();

  const handleClearAll = async () => {
    for (const t of downloadedTracks) {
      await handleRemoveDownload(t._id || t.id);
    }
    showToast('Offline library cleared');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header Banner */}
        <View style={styles.banner}>
          <View style={styles.iconCircle}>
            <DownloadCloud size={32} color="#1DB954" />
          </View>
          <Text style={styles.bannerTitle}>Downloaded Songs (Offline)</Text>
          <Text style={styles.bannerSubtitle}>
            Audio files saved as MP3 on your device storage to play without internet connection.
          </Text>

          {downloadedTracks.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={styles.playAllBtn}
                onPress={() => playTrack(downloadedTracks[0], downloadedTracks)}
              >
                <Play size={18} color="#000" fill="#000" />
                <Text style={styles.playAllText}>Play All</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.playAllBtn, { backgroundColor: '#27272a' }]}
                onPress={handleClearAll}
              >
                <Trash size={18} color="#ef4444" />
                <Text style={[styles.playAllText, { color: '#ef4444' }]}>Clear All</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Locally Stored Files ({downloadedTracks.length})</Text>
          </View>

          {(downloadedTracks || []).length === 0 ? (
            <View style={styles.emptyContainer}>
              <HardDrive size={48} color="#3f3f46" />
              <Text style={styles.emptyTitle}>No downloaded songs</Text>
              <Text style={styles.emptyDesc}>
                You can download songs by tapping the download icon on the home screen or search to listen offline anytime.
              </Text>
            </View>
          ) : (
            (downloadedTracks || []).map((track) => (
              <SongItem 
                key={track._id || track.id} 
                track={track} 
                onPlay={(t) => playTrack(t, downloadedTracks)} 
                showDelete={true}
              />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 48,
    paddingBottom: 120,
  },
  banner: {
    backgroundColor: '#18181b',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
  },
  bannerSubtitle: {
    fontSize: 13,
    color: '#a1a1aa',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  playAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1DB954',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 16,
  },
  playAllText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  emptyContainer: {
    alignItems: 'center',
    justify: 'center',
    padding: 32,
    backgroundColor: '#18181b',
    borderRadius: 20,
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#a1a1aa',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
});
