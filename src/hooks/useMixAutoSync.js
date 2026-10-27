import { useEffect } from 'react';
import { useDownloadManager } from '../context/DownloadContext';

// localStorage key for user download consent on a given Mix playlist
export const CONSENT_KEY = (playlistId) => `rivo_mix_consented_${playlistId}`;

export function useMixAutoSync(mixPlaylists = [], tracks = []) {
  const downloadManager = useDownloadManager();
  const { downloadTrack } = downloadManager || {};

  useEffect(() => {
    if (!downloadTrack || !Array.isArray(mixPlaylists) || mixPlaylists.length === 0) return;

    mixPlaylists.forEach(mix => {
      const pId = mix?.id || mix?._id;
      if (!pId) return;

      // Check if user previously consented to download this Mix
      if (typeof window !== 'undefined' && localStorage.getItem(CONSENT_KEY(pId))) {
        const trackIdSet = new Set((mix.trackIds || []).map(String));
        const unDownloaded = (tracks || []).filter(t => {
          const tId = String(t.id || t._id);
          return trackIdSet.has(tId) && !t.downloaded;
        });

        // Silently download newly added tracks
        unDownloaded.forEach(t => {
          try {
            downloadTrack(t);
          } catch (e) {
            console.warn('[useMixAutoSync] Failed to auto-download track:', t.title, e);
          }
        });
      }
    });
  }, [mixPlaylists, tracks, downloadTrack]);
}
