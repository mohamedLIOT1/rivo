import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  downloadTrack,
  getDownloadedTracks,
  removeDownloadedTrack as rawRemoveDownloadedTrack,
  removeDownloadedTracksBatch as rawRemoveDownloadedTracksBatch,
  deduplicateTrackList,
  subscribeToDownloadedTracks,
  getTrackDedupeKey,
} from '../../services/downloadManager';
import { updateDownloadProgress, clearDownloadProgress } from '../AudioProgressContext';
import { updateMediaNotification, hideMediaNotification } from '../../services/mediaControls';

export const useAudioDownloads = ({
  showToast = () => {},
  currentTrackRef,
  isPlayingRef,
  repeatModeRef,
  isShuffleRef,
  likedTrackIds = [],
}) => {
  const [downloadedTracks, setDownloadedTracks] = useState([]);
  const downloadedTracksRef = useRef([]);
  downloadedTracksRef.current = downloadedTracks;

  // Local ref tracking active downloads to avoid rapid re-render storms on general AudioProvider
  const downloadingIdsRef = useRef({});

  const [autoDownloadFinished, setAutoDownloadFinishedState] = useState(true);
  const autoDownloadFinishedRef = useRef(true);

  useEffect(() => {
    AsyncStorage.getItem('@rivo_auto_download_finished').then((val) => {
      if (val !== null) {
        const b = val === 'true';
        autoDownloadFinishedRef.current = b;
        setAutoDownloadFinishedState(b);
      }
    }).catch(() => {});
  }, []);

  const toggleAutoDownloadFinished = useCallback(() => {
    setAutoDownloadFinishedState((prev) => {
      const next = !prev;
      autoDownloadFinishedRef.current = next;
      AsyncStorage.setItem('@rivo_auto_download_finished', String(next)).catch(() => {});
      return next;
    });
  }, []);

  useEffect(() => {
    const unsub = subscribeToDownloadedTracks((updated) => {
      const cleaned = deduplicateTrackList(updated || []);
      setDownloadedTracks(cleaned);
      downloadedTracksRef.current = cleaned;
    });
    return unsub;
  }, []);

  const refreshDownloadedTracks = useCallback(async () => {
    try {
      const list = await getDownloadedTracks();
      const cleaned = deduplicateTrackList(list || []);
      setDownloadedTracks(cleaned);
      downloadedTracksRef.current = cleaned;
      return cleaned;
    } catch {
      return [];
    }
  }, []);

  const downloadedTrackIds = useMemo(() => {
    return new Set((downloadedTracks || []).map(t => String(t._id || t.id)).filter(Boolean));
  }, [downloadedTracks]);

  const isTrackDownloaded = useCallback((trackOrId) => {
    if (!trackOrId) return false;
    const tId = (typeof trackOrId === 'object' && trackOrId !== null)
      ? String(trackOrId._id || trackOrId.id || '')
      : String(trackOrId);
    const dList = downloadedTracksRef.current || [];
    if (tId && dList.some(t => String(t._id || t.id) === tId)) return true;
    if (typeof trackOrId === 'object' && trackOrId !== null) {
      const curKey = getTrackDedupeKey(trackOrId);
      if (curKey && dList.some(t => getTrackDedupeKey(t) === curKey)) return true;
    }
    return false;
  }, []);

  const removeDownloadedTracksBatch = useCallback(async (tracksOrIds) => {
    const updated = await rawRemoveDownloadedTracksBatch(tracksOrIds);
    const cleaned = deduplicateTrackList(updated || []);
    setDownloadedTracks(cleaned);
    downloadedTracksRef.current = cleaned;
    return cleaned;
  }, []);

  const removeDownloadedTrack = useCallback(async (trackOrId) => {
    const updated = await rawRemoveDownloadedTrack(trackOrId);
    const cleaned = deduplicateTrackList(updated || []);
    setDownloadedTracks(cleaned);
    downloadedTracksRef.current = cleaned;
    return cleaned;
  }, []);

  const handleDownloadTrack = useCallback(async (t, isSilent = false) => {
    if (!t) return;
    const id = String(t._id || t.id);
    if (isTrackDownloaded(id)) {
      if (!isSilent) showToast(`"${t.title || 'Track'}" is already in offline vault`, 'info');
      return;
    }
    if (downloadingIdsRef.current[id] !== undefined) {
      if (!isSilent) showToast(`"${t.title || 'Track'}" is already downloading...`, 'info');
      return;
    }
    try {
      if (!isSilent) {
        showToast(`Downloading "${t.title || 'Track'}" to device...`, 'info');
      }
      downloadingIdsRef.current[id] = 0;
      updateDownloadProgress(id, 0);

      let trackToDownload = { ...t };
      if (currentTrackRef.current && String(currentTrackRef.current._id || currentTrackRef.current.id) === id) {
        if (currentTrackRef.current.resolvedAudioUrl) {
          trackToDownload.resolvedAudioUrl = currentTrackRef.current.resolvedAudioUrl;
        }
        if (currentTrackRef.current.duration) {
          trackToDownload.duration = currentTrackRef.current.duration;
        }
      }

      await downloadTrack(trackToDownload, (prog) => {
        downloadingIdsRef.current[id] = prog;
        updateDownloadProgress(id, prog);
      });

      await refreshDownloadedTracks();
      if (!isSilent) showToast(`"${t.title || 'Track'}" saved to offline vault`, 'success');
    } catch (err) {
      if (!isSilent) showToast(`Download failed: ${err?.message || 'Could not save track'}`, 'error');
    } finally {
      delete downloadingIdsRef.current[id];
      clearDownloadProgress(id);
    }
  }, [isTrackDownloaded, showToast, currentTrackRef, refreshDownloadedTracks]);

  const handleDownloadPlaylist = useCallback(async (tracksToDownload) => {
    if (!tracksToDownload || tracksToDownload.length === 0) return;
    const wasPlayingBeforeDownload = isPlayingRef.current;
    try {
      updateMediaNotification(true, 'off', false, false, {
        title: `Downloading Playlist (${tracksToDownload.length} tracks)`,
        artist: 'Rivo Vault • Keep in Background',
        duration: tracksToDownload.length * 60,
        currentTime: 0,
      });

      for (let idx = 0; idx < tracksToDownload.length; idx++) {
        const track = tracksToDownload[idx];
        updateMediaNotification(true, 'off', false, false, {
          title: `Downloading (${idx + 1}/${tracksToDownload.length}): ${track.title || 'Track'}`,
          artist: track.artist || 'Rivo Vault',
          duration: tracksToDownload.length,
          currentTime: idx + 1,
        });
        await handleDownloadTrack(track, false);
        await new Promise(r => setTimeout(r, 300));
      }
      showToast('All tracks downloaded offline', 'info');
    } finally {
      if (!wasPlayingBeforeDownload && !isPlayingRef.current) {
        hideMediaNotification();
      } else if (currentTrackRef.current) {
        const cur = currentTrackRef.current;
        const isLikedTrack = likedTrackIds.some(id => String(id) === String(cur._id || cur.id));
        updateMediaNotification(isPlayingRef.current, repeatModeRef.current, isShuffleRef.current, isLikedTrack, cur);
      }
    }
  }, [
    isPlayingRef, handleDownloadTrack, showToast, currentTrackRef,
    likedTrackIds, repeatModeRef, isShuffleRef
  ]);

  return {
    downloadedTracks,
    downloadedTracksRef,
    downloadedTrackIds,
    downloadingIds: downloadingIdsRef.current,
    downloadingIdsRef,
    autoDownloadFinished,
    autoDownloadFinishedRef,
    toggleAutoDownloadFinished,
    refreshDownloadedTracks,
    isTrackDownloaded,
    removeDownloadedTracksBatch,
    removeDownloadedTrack,
    handleDownloadTrack,
    handleDownloadPlaylist,
  };
};
