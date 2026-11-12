import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import {
  getDownloadedTracks,
  removeDownloadedTrack,
  removeDownloadedTracksBatch,
  importLocalAudioFiles,
  importAudioFolderFromDevice,
  exportTrackAudioFile,
  exportTracksBatch,
  scanOfflineVault,
  getStorageLocationInfo,
  deduplicateTrackList,
  reanchorDocumentUri,
} from '../services/downloadManager';

export function useOfflineOperations({
  contextRemoveTrack,
  contextRemoveBatch,
  downloadedTracks,
  playTrack,
  currentTrack,
  togglePlay,
  addMultipleToQueue,
  showToast,
}) {
  const [offlineTracks, setOfflineTracks] = useState([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageInfo, setStorageInfo] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadOffline = useCallback(async () => {
    try {
      const list = await getDownloadedTracks();
      setOfflineTracks(deduplicateTrackList(list));

      const info = await getStorageLocationInfo().catch(() => null);
      if (info) {
        setStorageInfo(info);
        setStorageUsed(info.totalBytes || 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadOffline();
  }, [loadOffline]);

  useEffect(() => {
    if (Array.isArray(downloadedTracks)) {
      setOfflineTracks(deduplicateTrackList(downloadedTracks));
    }
  }, [downloadedTracks]);

  const handleImportAudio = useCallback(async () => {
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
  }, [showToast, loadOffline]);

  const handleImportFolder = useCallback(async () => {
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
  }, [showToast, loadOffline]);

  const handleScanVault = useCallback(async () => {
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
  }, [showToast, loadOffline]);

  const formatBytes = useCallback((bytes) => {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
  }, []);

  const handleDelete = useCallback((track) => {
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
  }, [contextRemoveTrack, showToast]);

  const handleBatchDelete = useCallback((sel, onSuccess) => {
    if (!sel || sel.length === 0) return;
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
              const batchFn = contextRemoveBatch || removeDownloadedTracksBatch;
              await batchFn(sel);
              const selSet = new Set(sel.map((t) => String(t._id || t.id)));
              const selTitles = new Set(sel.map((t) => (t.title || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').trim()).filter(Boolean));
              setOfflineTracks((prev) => prev.filter((t) => {
                if (selSet.has(String(t._id || t.id))) return false;
                const tit = (t.title || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').trim();
                if (tit && selTitles.has(tit)) return false;
                return true;
              }));
              onSuccess?.();
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
  }, [contextRemoveBatch, showToast, loadOffline]);

  const handlePlayOffline = useCallback((track) => {
    if (!track) return;
    const trackId = String(track._id || track.id || '');
    const currentId = String(currentTrack?._id || currentTrack?.id || '');
    if (trackId && trackId === currentId) {
      togglePlay();
      return;
    }
    const rawAudioUri = track.localAudioUri || track.nativeAudioUri || track.audioUrl;
    const audioUri = reanchorDocumentUri(rawAudioUri);
    playTrack({
      ...track,
      id: trackId,
      _id: trackId,
      title: track.title || 'Untitled',
      artist: track.artist || 'Unknown Artist',
      localAudioUri: audioUri,
      nativeAudioUri: audioUri,
      audioUrl: audioUri,
    }, (offlineTracks || []).map((t) => ({
      ...t,
      localAudioUri: reanchorDocumentUri(t?.localAudioUri),
      nativeAudioUri: reanchorDocumentUri(t?.nativeAudioUri),
      audioUrl: reanchorDocumentUri(t?.audioUrl),
    })).filter(Boolean));
  }, [currentTrack, togglePlay, playTrack, offlineTracks]);

  const handleExportTrack = useCallback(async (track) => {
    try {
      showToast('Preparing audio export...', 'info');
      await exportTrackAudioFile(track);
      showToast('Export dialog opened!', 'success');
    } catch (e) {
      showToast(e.message || 'Export failed', 'error');
    }
  }, [showToast]);

  const handleBatchExport = useCallback(async (sel, onSuccess) => {
    if (!sel || sel.length === 0) return;
    try {
      setActionLoading(true);
      showToast('Exporting songs to selected folder...', 'info');
      const res = await exportTracksBatch(sel);
      if (res?.cancelled) {
        showToast('Export cancelled', 'info');
        return;
      }
      if (res?.success) {
        if (res.exportedCount === 0 && res.skippedCount > 0) {
          showToast(`All ${res.skippedCount} song(s) already exist in that folder`, 'info');
        } else if (res.skippedCount > 0) {
          showToast(`Exported ${res.exportedCount} song(s) (${res.skippedCount} skipped - already existed)`, 'success');
        } else {
          showToast(`Exported ${res.exportedCount} song(s) successfully!`, 'success');
        }
        onSuccess?.();
      }
    } catch (e) {
      showToast(e.message || 'Export failed', 'error');
    } finally {
      setActionLoading(false);
    }
  }, [showToast]);

  return {
    offlineTracks,
    storageUsed,
    storageInfo,
    actionLoading,
    loadOffline,
    handleImportAudio,
    handleImportFolder,
    handleScanVault,
    formatBytes,
    handleDelete,
    handleBatchDelete,
    handleBatchExport,
    handlePlayOffline,
    handleExportTrack,
  };
}
