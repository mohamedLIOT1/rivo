import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  TextInput,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Download, Play, Pause, Trash2, HardDrive, WifiOff, Disc, Wifi, FolderPlus, RefreshCw, CheckSquare, Square, Check, ListPlus, X, Search } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';
import { normalizeCoverUri } from '../utils/coverUtils';
import {
  getDownloadedTracks,
  removeDownloadedTrack,
  importLocalAudioFiles,
  importAudioFolderFromDevice,
  scanOfflineVault,
  getStorageLocationInfo,
  deduplicateTrackList,
} from '../services/downloadManager';

const TRACKS_DIR = `${FileSystem.documentDirectory}rivo_tracks/`;

export default function OfflineScreen() {
  const { playTrack, currentTrack, isPlaying, togglePlay, addMultipleToQueue, removeDownloadedTrack: contextRemoveTrack, downloadedTracks = [] } = useAudioPlayer();
  const { showToast } = useToast();
  const { isDark } = useTheme();
  const [offlineTracks, setOfflineTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageInfo, setStorageInfo] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOfflineTracks = useMemo(() => {
    if (!searchQuery.trim()) return offlineTracks;
    const q = searchQuery.toLowerCase().trim();
    return (offlineTracks || []).filter(t => {
      const title = (t.title || '').toLowerCase();
      const artist = (t.artist || '').toLowerCase();
      const album = (t.album || '').toLowerCase();
      return title.includes(q) || artist.includes(q) || album.includes(q);
    });
  }, [offlineTracks, searchQuery]);

  useEffect(() => {
    loadOffline();
  }, []);

  useEffect(() => {
    if (Array.isArray(downloadedTracks)) {
      setOfflineTracks(deduplicateTrackList(downloadedTracks));
    }
  }, [downloadedTracks]);

  const loadOffline = async () => {
    setLoading(true);
    try {
      const list = await getDownloadedTracks();
      setOfflineTracks(deduplicateTrackList(list));

      const info = await getStorageLocationInfo().catch(() => null);
      if (info) {
        setStorageInfo(info);
        setStorageUsed(info.totalBytes || 0);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImportAudio = async () => {
    try {
      setActionLoading(true);
      const res = await importLocalAudioFiles();
      if (res && res.success) {
        showToast(`Imported ${res.count} track(s) successfully!`, 'success');
        await loadOffline();
      }
    } catch {
      showToast('Failed to import audio files', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleImportFolder = async () => {
    try {
      setActionLoading(true);
      const res = await importAudioFolderFromDevice();
      if (res && res.success) {
        if (res.count > 0) {
          showToast(`Linked ${res.count} songs from folder without copying!`, 'success');
        } else {
          showToast(res.message || 'Folder songs are already loaded', 'info');
        }
        await loadOffline();
      } else if (res && res.message && res.message !== 'Permission not granted') {
        showToast(res.message, 'info');
      }
    } catch {
      showToast('Could not access folder', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleScanVault = async () => {
    try {
      setActionLoading(true);
      const res = await scanOfflineVault();
      if (res && res.newlyFound > 0) {
        showToast(`Found ${res.newlyFound} new local tracks!`, 'success');
      } else {
        showToast('Vault scanned — all files up to date', 'info');
      }
      await loadOffline();
    } catch {
      showToast('Failed scanning vault', 'error');
    } finally {
      setActionLoading(false);
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
      'REMOVE OFFLINE SONG',
      `Delete "${track.title}" from local device storage?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const id = track._id || track.id;
            const removeFn = contextRemoveTrack || removeDownloadedTrack;
            await removeFn(track);
            const targetKey = (track.title || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').trim();
            setOfflineTracks((prev) => prev.filter((t) => {
              if ((t._id || t.id) === id) return false;
              if (targetKey && (t.title || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').trim() === targetKey) return false;
              return true;
            }));
            showToast('Track removed from storage', 'info');
          },
        },
      ]
    );
  };

  const toggleSelectTrack = (trackId) => {
    const sId = String(trackId);
    setSelectedIds((prev) =>
      prev.includes(sId) ? prev.filter((id) => id !== sId) : [...prev, sId]
    );
  };

  const handleSelectAll = () => {
    const allIds = (offlineTracks || []).map((t) => String(t._id || t.id));
    if (selectedIds.length === allIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
    }
  };

  const getSelectedTracks = () => {
    return (offlineTracks || []).filter((t) => selectedIds.includes(String(t._id || t.id)));
  };

  const handleBatchQueue = () => {
    const sel = getSelectedTracks();
    if (sel.length === 0) return;
    if (typeof addMultipleToQueue === 'function') {
      addMultipleToQueue(sel);
    } else {
      sel.forEach((t) => playTrack(t));
    }
    showToast(`Added ${sel.length} song(s) to queue`, 'info');
    setIsSelectMode(false);
    setSelectedIds([]);
  };

  const handleBatchDelete = () => {
    const sel = getSelectedTracks();
    if (sel.length === 0) return;
    Alert.alert(
      'REMOVE SELECTED SONGS',
      `Delete ${sel.length} song(s) from local device storage?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete All',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionLoading(true);
              const removeFn = contextRemoveTrack || removeDownloadedTrack;
              for (const t of sel) {
                await removeFn(t);
              }
              const selSet = new Set(sel.map((t) => String(t._id || t.id)));
              const selTitles = new Set(sel.map((t) => (t.title || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').trim()).filter(Boolean));
              setOfflineTracks((prev) => prev.filter((t) => {
                if (selSet.has(String(t._id || t.id))) return false;
                const tit = (t.title || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').trim();
                if (tit && selTitles.has(tit)) return false;
                return true;
              }));
              setSelectedIds([]);
              setIsSelectMode(false);
              showToast(`Removed ${sel.length} song(s) from storage`, 'info');
              loadOffline();
            } catch {
              showToast('Error removing some songs', 'error');
            } finally {
              setActionLoading(false);
            }
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
    <View style={{ flex: 1, backgroundColor: !isDark ? '#fdfbf7' : colors.ink }}>
      <ScrollView style={[styles.container, !isDark && { backgroundColor: '#fdfbf7' }]} contentContainerStyle={[styles.content, isSelectMode && { paddingBottom: 110 }]}>
        {/* Offline Storage Status Card */}
        <View style={styles.heroOuter}>
          <View style={styles.heroShadow} />
          <View style={[styles.heroCard, !isDark && styles.heroCardLight]}>
            <View style={styles.topRow}>
              <CassetteTag label="NO WI-FI REQUIRED" bg={!isDark ? '#0b1110' : colors.ink} textColor={colors.mint} />
            </View>

            <Text style={[styles.heroTitle, !isDark && styles.heroTitleLight]}>OFFLINE SONGS</Text>
            <Text style={[styles.heroSub, !isDark && styles.heroSubLight, { marginBottom: 12 }]}>
              Audio tracks saved on your device for zero-latency, offline listening.
            </Text>

            {/* Storage & Location Info Box */}
            <View style={[styles.vaultInfoBox, !isDark && styles.vaultInfoBoxLight]}>
              <View style={styles.vaultInfoRow}>
                <HardDrive size={13} color={colors.mint} />
                <Text style={[styles.vaultPathText, !isDark && styles.vaultPathTextLight]} numberOfLines={1}>
                  {storageInfo?.folderLabel || 'Internal Storage'}
                </Text>
              </View>
              <Text style={[styles.vaultSizeText, !isDark && styles.vaultSizeTextLight]}>
                {formatBytes(storageUsed)} • {(offlineTracks || []).length} SONGS
              </Text>
            </View>

            {/* Action Buttons: Import MP3, Scan Vault, Select */}
            <View style={styles.heroActionsRow}>
              <TouchableOpacity
                style={styles.heroActionBtn}
                onPress={handleImportAudio}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                <FolderPlus size={14} color={colors.ink} />
                <Text style={styles.heroActionText}>IMPORT</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.heroActionBtn, { backgroundColor: '#10b981' }]}
                onPress={handleImportFolder}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                <HardDrive size={13} color={colors.ink} />
                <Text style={styles.heroActionText}>FOLDER</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.heroActionBtn, styles.heroActionBtnSec]}
                onPress={handleScanVault}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                <RefreshCw size={13} color={colors.mint} />
                <Text style={styles.heroActionTextSec}>SCAN</Text>
              </TouchableOpacity>

              {(offlineTracks || []).length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.heroActionBtn,
                    isSelectMode ? { backgroundColor: colors.rust, borderColor: colors.rust } : styles.heroActionBtnSec,
                  ]}
                  onPress={() => {
                    setIsSelectMode((p) => !p);
                    setSelectedIds([]);
                  }}
                  disabled={actionLoading}
                  activeOpacity={0.8}
                >
                  <CheckSquare size={13} color={isSelectMode ? '#ffffff' : colors.mint} />
                  <Text style={[styles.heroActionTextSec, isSelectMode && { color: '#ffffff' }]}>
                    {isSelectMode ? 'CANCEL' : 'SELECT'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Offline Vault Search Bar */}
            {(offlineTracks || []).length > 0 && (
              <View style={styles.vaultSearchBar}>
                <Search size={16} color="#6b7280" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.vaultSearchInput}
                  placeholder="Search in offline vault by title, artist, album..."
                  placeholderTextColor="#6b7280"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7} style={{ padding: 4 }}>
                    <X size={15} color="#9ca3af" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </View>

        {/* Offline Tracks List */}
        <View style={styles.listSection}>
          <View style={[styles.listHeader, !isDark && { borderBottomColor: '#0b1110' }]}>
            <Text style={[styles.listTitle, !isDark && styles.listTitleLight]}>DOWNLOADED SONGS</Text>
            <Text style={[styles.listCount, !isDark && styles.listCountLight]}>{searchQuery ? `${filteredOfflineTracks.length} OF ${(offlineTracks || []).length}` : `${(offlineTracks || []).length} SAVED`}</Text>
          </View>

          {(!offlineTracks || offlineTracks.length === 0) ? (
            <View style={[styles.emptyCard, !isDark && styles.emptyCardLight]}>
              <WifiOff size={40} color={colors.teal} />
              <Text style={[styles.emptyTitle, !isDark && styles.emptyTitleLight]}>No offline songs saved</Text>
              <Text style={[styles.emptySub, !isDark && styles.emptySubLight]}>
                Switch to online mode and tap the download icon on any song to save it for offline playback — no Wi-Fi needed.
              </Text>
              <View style={styles.goOnlineBanner}>
                <Wifi size={13} color={colors.teal} />
                <Text style={styles.goOnlineText}>
                  Use the toggle button to go online and download songs
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.tracksList}>
              {(offlineTracks || []).filter(Boolean).map((track, idx) => {
                const trackId = String(track?._id || track?.id || idx);
                const currentId = String(currentTrack?._id || currentTrack?.id || '');
                const active = Boolean(currentTrack && trackId === currentId);
                const isSelected = selectedIds.includes(trackId);

                return (
                  <TouchableOpacity
                    key={trackId}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (isSelectMode) {
                        toggleSelectTrack(trackId);
                      } else {
                        handlePlayOffline(track);
                      }
                    }}
                    style={[
                      styles.trackCard,
                      !isDark && styles.trackCardLight,
                      isSelected && {
                        borderColor: colors.mint,
                        backgroundColor: 'rgba(52,211,153,0.12)',
                      },
                    ]}
                  >
                    {isSelectMode && (
                      <View style={styles.selectCheckWrapper}>
                        <View style={[styles.selectCheckBox, isSelected && styles.selectCheckBoxActive]}>
                          {isSelected && <Check size={13} color={colors.ink} strokeWidth={3} />}
                        </View>
                      </View>
                    )}

                    <View style={styles.coverBox}>
                      <View style={styles.coverPlaceholder}>
                        <Disc size={20} color="#1c332e" />
                      </View>
                      <Image
                        source={{
                          uri: normalizeCoverUri(track?.coverUrl || track?.cover, track),
                        }}
                        style={styles.cover}
                      />
                    </View>

                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.trackTitle, !isDark && styles.trackTitleLight]} numberOfLines={1}>
                        {track?.title || 'Untitled'}
                      </Text>
                      <Text style={[styles.trackArtist, !isDark && styles.trackArtistLight]} numberOfLines={1}>
                        {track?.artist || 'Unknown Artist'}
                      </Text>
                      <View style={styles.badgeRow}>
                        <View style={[
                          styles.localPill,
                          track?.isLocalImport && {
                            borderColor: colors.mint,
                            backgroundColor: 'rgba(52,211,153,0.12)',
                          }
                        ]}>
                          <Text style={[
                            styles.localPillText,
                            track?.isLocalImport && { color: colors.mint }
                          ]}>
                            {track?.isLocalImport ? 'IMPORTED MP3' : 'OFFLINE SONG'}
                          </Text>
                        </View>
                      </View>
                    </View>

                    {!isSelectMode && (
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
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Tactical Multi-Select Bottom Action Deck */}
      {isSelectMode && (
        <View style={[styles.selectActionBar, { bottom: currentTrack ? (Platform.OS === 'ios' ? 134 : 118) : 20 }]}>
          <View style={styles.selectInfoRow}>
            <Text style={styles.selectCountBadge}>{selectedIds.length}</Text>
            <Text style={styles.selectCountText}>Selected</Text>
          </View>
          <TouchableOpacity onPress={handleSelectAll} style={styles.selectActionBtnSec}>
            <Text style={styles.selectActionBtnTextSec}>
              {selectedIds.length === (offlineTracks || []).length ? 'Deselect All' : 'Select All'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleBatchQueue}
            disabled={selectedIds.length === 0}
            style={[styles.selectActionBtn, selectedIds.length === 0 && { opacity: 0.4 }]}
          >
            <ListPlus size={14} color={colors.ink} />
            <Text style={styles.selectActionBtnText}>Queue</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleBatchDelete}
            disabled={selectedIds.length === 0}
            style={[styles.selectActionBtnDanger, selectedIds.length === 0 && { opacity: 0.4 }]}
          >
            <Trash2 size={14} color="#ffffff" />
            <Text style={styles.selectActionBtnTextDanger}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
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
    maxWidth: 840,
    width: '100%',
    alignSelf: 'center',
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
  heroCardLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },

  heroTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 22,
    color: colors.paper,
    marginBottom: 4,
  },
  heroTitleLight: {
    color: '#0b1110',
  },
  heroSub: {
    fontSize: 11,
    color: colors.paperMuted,
    lineHeight: 15,
    marginBottom: 14,
  },
  heroSubLight: {
    color: '#475569',
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
  listTitleLight: {
    color: '#0b1110',
  },
  listCount: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.paperMuted,
  },
  listCountLight: {
    color: '#57534e',
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
  emptyCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#0b1110',
  },
  emptyTitle: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 14,
    color: colors.paper,
    marginTop: 10,
  },
  emptyTitleLight: {
    color: '#0b1110',
  },
  emptySub: {
    fontSize: 11,
    color: colors.paperMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  emptySubLight: {
    color: '#57534e',
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
  trackCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#0b1110',
  },
  coverBox: {
    width: 46,
    height: 46,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#0a1412',
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  coverPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a1412',
  },
  cover: {
    width: 46,
    height: 46,
    borderRadius: 6,
  },
  trackTitle: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 12,
    color: colors.paper,
  },
  trackTitleLight: {
    color: '#0b1110',
  },
  trackArtist: {
    fontSize: 10,
    color: colors.paperMuted,
    marginTop: 2,
  },
  trackArtistLight: {
    color: '#57534e',
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
  vaultInfoBox: {
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(52, 211, 153, 0.25)',
    padding: 10,
    marginBottom: 12,
  },
  vaultInfoBoxLight: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  vaultInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  vaultPathText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '700',
    color: colors.mint,
    flex: 1,
  },
  vaultPathTextLight: {
    color: '#0f766e',
  },
  vaultSizeText: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '600',
    color: colors.paperMuted,
  },
  vaultSizeTextLight: {
    color: '#64748b',
  },
  vaultSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141d1b',
    borderWidth: 1.5,
    borderColor: '#243b37',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 7,
    marginTop: 14,
  },
  vaultSearchInput: {
    flex: 1,
    color: '#fdfbf7',
    fontSize: 12.5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  heroActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.mint,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  heroActionText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  heroActionBtnSec: {
    backgroundColor: colors.ink,
    borderColor: colors.mint,
  },
  heroActionTextSec: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '900',
    color: colors.mint,
    letterSpacing: 0.5,
  },
  selectCheckWrapper: {
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectCheckBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.mint,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  selectCheckBoxActive: {
    backgroundColor: colors.mint,
    borderColor: colors.ink,
  },
  selectActionBar: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: colors.ink,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.mint,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    gap: 8,
  },
  selectInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  selectCountBadge: {
    backgroundColor: colors.mint,
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: 'monospace',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  selectCountText: {
    color: colors.paper,
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  selectActionBtnSec: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  selectActionBtnTextSec: {
    color: colors.paper,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  selectActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.mint,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  selectActionBtnText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  selectActionBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.rust,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  selectActionBtnTextDanger: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
});
