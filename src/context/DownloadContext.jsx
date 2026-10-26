import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { saveTrackOffline, removeTrackOffline, getOfflineTrackAudioUrl } from '../utils/offlineStorage';
import { API_BASE_URL } from '../config';

const DownloadContext = createContext(null);

export function DownloadProvider({ children, tracks, setTracks, showToast }) {
  const [downloadingTrackId, setDownloadingTrackId] = useState(null);
  const [queuedTrackIds, setQueuedTrackIds] = useState([]);
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const [batchStats, setBatchStats] = useState({ current: 0, total: 0, playlistName: '' });
  const [downloadProgress, setDownloadProgress] = useState({ percent: 0, speedText: '0 KB/s', loadedMb: '0', totalMb: '0' });

  const activeAbortControllerRef = useRef(null);
  const isCancelledRef = useRef(false);
  const queueRef = useRef([]);
  const isProcessingRef = useRef(false);
  const tracksRef = useRef(tracks);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);

  // Cancel an individual track download
  const cancelTrackDownload = useCallback((trackId) => {
    const cleanId = String(trackId);

    // If it's the currently downloading track
    if (downloadingTrackId === cleanId) {
      if (activeAbortControllerRef.current) {
        activeAbortControllerRef.current.abort();
        activeAbortControllerRef.current = null;
      }
      setDownloadingTrackId(null);
    setDownloadProgress({ percent: 0, speedText: '0 KB/s', loadedMb: '0', totalMb: '0' });
      showToast?.('Cancelled download for this track');
      return;
    }

    // If it's in the queued list
    setQueuedTrackIds(prev => prev.filter(id => id !== cleanId));
    queueRef.current = queueRef.current.filter(t => String(t.id || t._id) !== cleanId);
    showToast?.('Removed track from download queue');
  }, [downloadingTrackId, showToast]);

  // Cancel all downloads
  const cancelAllDownloads = useCallback(() => {
    isCancelledRef.current = true;
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    queueRef.current = [];
    setQueuedTrackIds([]);
    setDownloadingTrackId(null);
    setIsBatchDownloading(false);
    setBatchStats({ current: 0, total: 0, playlistName: '' });
    isProcessingRef.current = false;
    showToast?.('All downloads cancelled');
  }, [showToast]);

  // Process the queue one-by-one sequentially
  const processNextInQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    if (isCancelledRef.current) {
      isProcessingRef.current = false;
      return;
    }

    if (queueRef.current.length === 0) {
      setDownloadingTrackId(null);
      setIsBatchDownloading(false);
      isProcessingRef.current = false;
      return;
    }

    isProcessingRef.current = true;
    const nextTrack = queueRef.current.shift();
    const cleanId = String(nextTrack.id || nextTrack._id);

    setDownloadingTrackId(cleanId);
    setQueuedTrackIds(queueRef.current.map(t => String(t.id || t._id)));

    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;

    try {
      const result = await saveTrackOffline(nextTrack, {
        signal: abortController.signal,
        onProgress: (p) => setDownloadProgress(p)
      });

      if (result && !abortController.signal.aborted && !isCancelledRef.current) {
        const freshAudioUrl = await getOfflineTrackAudioUrl(cleanId);
        const freshCover = nextTrack.cover || result.coverBase64 || null;

        const patchFields = {
          downloaded: true,
          audioUrl: freshAudioUrl || result.audioUrl,
          cover: freshCover,
          nativeAudioUri: result.nativeAudioUri || null,
          nativeCoverUri: result.nativeCoverUri || null,
        };

        if (setTracks) {
          setTracks(prev => prev.map(t => String(t.id || t._id) === cleanId ? { ...t, ...patchFields } : t));
        }

        // Web browser file trigger - web desktop only (never in native app or Tauri desktop)
        const isNativeApp = typeof window !== 'undefined' && (
          Boolean(window.RIVO_NATIVE) ||
          Boolean(window.ReactNativeWebView) ||
          Boolean(window.Capacitor) ||
          Boolean(window.__RIVO_NATIVE_INJECTED) ||
          Boolean(window.__TAURI_INTERNALS__) ||
          Boolean(window.__TAURI__)
        );
        if (typeof window !== 'undefined' && !isNativeApp) {
          try {
            const cleanTitle = (nextTrack.title || 'Song').replace(/https?:\/\/\S+/gi, '').replace(/[\[\(]?(?:official|lyrics|video|audio|hd|4k|remastered)[\]\)]?/gi, '').replace(/[/\\?%*:|"<>]/g, '').trim() || 'Song';
            const cleanArtist = (nextTrack.artist || 'Artist').replace(/https?:\/\/\S+/gi, '').replace(/[/\\?%*:|"<>]/g, '').trim() || 'Artist';
            const dlLink = document.createElement('a');
            dlLink.href = `${API_BASE_URL}/api/tracks/download?url=${encodeURIComponent(nextTrack.audioUrl || '')}&title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}&id=${encodeURIComponent(cleanId)}`;
            dlLink.setAttribute('download', `${cleanArtist} - ${cleanTitle}.mp3`);
            document.body.appendChild(dlLink);
            dlLink.click();
            document.body.removeChild(dlLink);
          } catch (e) {}
        }

        setBatchStats(prev => ({
          ...prev,
          current: prev.current + 1
        }));
      }
    } catch (err) {
      console.warn(`Download error for ${nextTrack.title}:`, err);
    } finally {
      activeAbortControllerRef.current = null;
      isProcessingRef.current = false;
      setDownloadingTrackId(null);

      // Continue to next track in queue if not cancelled
      if (!isCancelledRef.current && queueRef.current.length > 0) {
        setTimeout(() => {
          processNextInQueue();
        }, 300);
      } else {
        setIsBatchDownloading(false);
        if (!isCancelledRef.current && batchStats.total > 1) {
          showToast?.(`Downloaded all songs in ${batchStats.playlistName || 'playlist'} ✓`);
        }
      }
    }
  }, [setTracks, showToast, batchStats.total, batchStats.playlistName]);

  // Download a single track
  const downloadTrack = useCallback(async (track) => {
    if (!track) return;
    const cleanId = String(track.id || track._id);

    // If already downloaded: remove it
    if (track.downloaded) {
      if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'DELETE_TRACK',
          trackId: cleanId,
        }));
      }
      await removeTrackOffline(cleanId);
      if (setTracks) {
        setTracks(prev => prev.map(t => String(t.id || t._id) === cleanId ? { ...t, downloaded: false } : t));
      }
      showToast?.('Song removed from offline downloads');
      return;
    }

    // If already queued or downloading
    if (downloadingTrackId === cleanId || queuedTrackIds.includes(cleanId)) {
      showToast?.('Song is already downloading');
      return;
    }

    isCancelledRef.current = false;
    showToast?.(`Downloading "${track.title || 'Song'}"...`);

    // In native app, dispatch to native storage vault
    if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'DOWNLOAD_TRACK',
        track: {
          id: cleanId,
          _id: cleanId,
          title: track.title,
          artist: track.artist,
          audioUrl: track.audioUrl,
          cover: track.cover,
          duration: track.duration,
        }
      }));
    }

    // If nothing currently downloading, process right away
    if (!downloadingTrackId && queueRef.current.length === 0) {
      queueRef.current = [track];
      setQueuedTrackIds([cleanId]);
      processNextInQueue();
    } else {
      // Add to queue
      queueRef.current.push(track);
      setQueuedTrackIds(prev => [...prev, cleanId]);
    }
  }, [downloadingTrackId, queuedTrackIds, setTracks, showToast, processNextInQueue]);

  // Download all tracks in a playlist one-by-one sequentially
  const downloadAllTracks = useCallback((trackList = [], playlistName = 'Playlist') => {
    if (!trackList || trackList.length === 0) return;

    // Filter out already downloaded tracks
    const toDownload = trackList.filter(t => !t.downloaded && String(t.id || t._id) !== downloadingTrackId && !queuedTrackIds.includes(String(t.id || t._id)));

    if (toDownload.length === 0) {
      showToast?.('All songs in this playlist are already downloaded ✓');
      return;
    }

    isCancelledRef.current = false;
    setIsBatchDownloading(true);
    setBatchStats({ current: 0, total: toDownload.length, playlistName });
    showToast?.(`Queued ${toDownload.length} songs for download...`);

    queueRef.current = [...queueRef.current, ...toDownload];
    setQueuedTrackIds(queueRef.current.map(t => String(t.id || t._id)));

    if (!isProcessingRef.current) {
      processNextInQueue();
    }
  }, [downloadingTrackId, queuedTrackIds, showToast, processNextInQueue]);

  const isTrackDownloading = useCallback((trackId) => {
    return downloadingTrackId === String(trackId);
  }, [downloadingTrackId]);

  const isTrackQueued = useCallback((trackId) => {
    return queuedTrackIds.includes(String(trackId));
  }, [queuedTrackIds]);

  const removeOfflineTrack = useCallback(async (trackId) => {
    const cleanId = String(trackId);
    if (typeof window !== 'undefined' && window.ReactNativeWebView?.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'DELETE_TRACK',
        trackId: cleanId,
      }));
    }
    await removeTrackOffline(cleanId);
    if (setTracks) {
      setTracks(prev => prev.map(t => String(t.id || t._id) === cleanId ? { ...t, downloaded: false } : t));
    }
    showToast?.('Song removed from offline downloads');
  }, [setTracks, showToast]);

  const value = {
    downloadingTrackId,
    queuedTrackIds,
    isBatchDownloading,
    batchStats,
    downloadTrack,
    removeOfflineTrack,
    cancelTrackDownload,
    downloadAllTracks,
    cancelAllDownloads,
    isTrackDownloading,
    isTrackQueued,
  };

  return (
    <DownloadContext.Provider value={value}>
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownloadManager() {
  const ctx = useContext(DownloadContext);
  return ctx;
}
