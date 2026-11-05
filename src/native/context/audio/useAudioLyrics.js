import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseLrcLyrics } from '../../utils/lrcParser';
import { API_BASE_URL } from '../../config';
import { updateDownloadedTrackLyrics } from '../../services/downloadManager';

/**
 * Helper to match a track against the local downloadedTracks list
 * and extract cached lyrics if available.
 */
function findDownloadedLyrics(track, downloadedTracks) {
  if (!track || !Array.isArray(downloadedTracks) || downloadedTracks.length === 0) return null;
  const tId = String(track._id || track.id || track.trackId || '');
  const tTitle = String(track.title || '').trim().toLowerCase();
  const tArtist = String(track.artist || '').trim().toLowerCase();

  const found = downloadedTracks.find(t => {
    if (!t) return false;
    const curId = String(t._id || t.id || '');
    if (tId && curId && tId === curId) return true;
    if (tTitle && t.title) {
      const curTitle = String(t.title).trim().toLowerCase();
      const curArtist = String(t.artist || '').trim().toLowerCase();
      if (curTitle === tTitle && (!tArtist || !curArtist || curArtist === tArtist)) {
        return true;
      }
    }
    return false;
  });

  if (found) {
    const raw = found.lyrics || found.rawLyrics;
    if (raw) {
      return {
        lyrics: raw,
        isVerified: Boolean(found.isVerified || found.isVerifiedLyrics),
        verifiedBy: found.verifiedBy || found.lyricsVerifiedBy || '',
      };
    }
  }
  return null;
}

/**
 * Specialized hook for fetching, parsing, caching, and saving song lyrics.
 * Follows AGENTS.md rules (< 400 lines, strict AbortSignal lifecycle).
 */
export const useAudioLyrics = (currentTrack, isOffline = false, downloadedTracks = [], token = null) => {
  const [lyrics, setLyrics] = useState(null);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);

  const currentTrackRef = useRef(currentTrack);
  currentTrackRef.current = currentTrack;
  const isOfflineRef = useRef(isOffline);
  isOfflineRef.current = isOffline;
  const downloadedTracksRef = useRef(downloadedTracks);
  downloadedTracksRef.current = downloadedTracks;
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const abortControllerRef = useRef(null);

  /**
   * Fetches lyrics from the server or AI fallback.
   * Cancels cleanly on AbortSignal.
   */
  const fetchTrackLyrics = useCallback(async (trackToFetch = currentTrackRef.current, signal = null) => {
    if (!trackToFetch) {
      setLyrics(null);
      setIsLoadingLyrics(false);
      return null;
    }

    const trackId = String(trackToFetch._id || trackToFetch.id || trackToFetch.trackId || '');
    const title = String(trackToFetch.title || '').trim();
    const artist = String(trackToFetch.artist || '').trim();

    if (!title) {
      setIsLoadingLyrics(false);
      return null;
    }

    setIsLoadingLyrics(true);

    try {
      const url = `${API_BASE_URL}/api/tracks/lyrics?trackId=${encodeURIComponent(trackId)}&title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`;
      const res = await fetch(url, { signal });
      if (signal?.aborted) return null;

      if (res.ok) {
        const data = await res.json();
        if (signal?.aborted) return null;

        if (data?.success && Array.isArray(data.lyrics) && data.lyrics.length > 0) {
          const parsed = parseLrcLyrics(data.lyrics);
          if (parsed && parsed.length > 0) {
            if (data.isVerified) {
              parsed.isVerified = true;
              parsed.verifiedBy = data.verifiedBy || '';
            }
            setLyrics(parsed);

            trackToFetch.lyrics = parsed;
            trackToFetch.isVerifiedLyrics = Boolean(data.isVerified);
            trackToFetch.lyricsVerifiedBy = data.verifiedBy || '';

            if (trackId) {
              updateDownloadedTrackLyrics(trackId, data.lyrics).catch(() => {});
            }
            return parsed;
          }
        }
      }

      // Fallback: AI generate song lyrics for online tracks (not local offline files)
      const isLocal = Boolean(trackToFetch.isLocal || (typeof trackToFetch.uri === 'string' && trackToFetch.uri.startsWith('file:')));
      if (!isLocal) {
        const genRes = await fetch(`${API_BASE_URL}/api/ai/generate-song-lyrics`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trackId,
            title,
            artist,
            duration: trackToFetch.duration || 180,
          }),
          signal,
        });
        if (signal?.aborted) return null;

        if (genRes.ok) {
          const genData = await genRes.json();
          if (signal?.aborted) return null;

          if (genData?.success && Array.isArray(genData.lyrics) && genData.lyrics.length > 0) {
            const parsed = parseLrcLyrics(genData.lyrics);
            if (parsed && parsed.length > 0) {
              if (genData.isVerified) {
                parsed.isVerified = true;
                parsed.verifiedBy = genData.verifiedBy || '';
              }
              setLyrics(parsed);

              trackToFetch.lyrics = parsed;
              trackToFetch.isVerifiedLyrics = Boolean(genData.isVerified);
              trackToFetch.lyricsVerifiedBy = genData.verifiedBy || '';

              if (trackId) {
                updateDownloadedTrackLyrics(trackId, genData.lyrics).catch(() => {});
              }
              return parsed;
            }
          }
        }
      }

      return null;
    } catch (err) {
      if (signal?.aborted) return null;
      console.warn('[useAudioLyrics] Error fetching lyrics:', err?.message);
      return null;
    } finally {
      if (!signal || !signal.aborted) {
        setIsLoadingLyrics(false);
      }
    }
  }, []);

  /**
   * Automatically resolve lyrics whenever currentTrack, offline state, or downloads change.
   */
  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const { signal } = abortController;

    if (!currentTrack) {
      setLyrics(null);
      setIsLoadingLyrics(false);
      return () => {
        abortController.abort();
      };
    }

    // 1. If currentTrack already has lyrics populated
    if (currentTrack.lyrics) {
      const parsed = parseLrcLyrics(currentTrack.lyrics);
      if (parsed && parsed.length > 0) {
        if (currentTrack.isVerifiedLyrics) {
          parsed.isVerified = true;
          parsed.verifiedBy = currentTrack.lyricsVerifiedBy || '';
        }
        setLyrics(parsed);
        setIsLoadingLyrics(false);
        return () => {
          abortController.abort();
        };
      }
    }

    // 2. Check if downloaded tracks have cached lyrics for this track
    const dlMatch = findDownloadedLyrics(currentTrack, downloadedTracks);
    if (dlMatch && dlMatch.lyrics) {
      const parsed = parseLrcLyrics(dlMatch.lyrics);
      if (parsed && parsed.length > 0) {
        if (dlMatch.isVerified) {
          parsed.isVerified = true;
          parsed.verifiedBy = dlMatch.verifiedBy || '';
        }
        setLyrics(parsed);
        setIsLoadingLyrics(false);
        return () => {
          abortController.abort();
        };
      }
    }

    // 3. If in offline mode, do not perform network requests
    if (isOffline) {
      setLyrics(null);
      setIsLoadingLyrics(false);
      return () => {
        abortController.abort();
      };
    }

    // 4. Fetch from API
    setLyrics(null);
    fetchTrackLyrics(currentTrack, signal);

    return () => {
      abortController.abort();
    };
  }, [
    currentTrack?._id || currentTrack?.id,
    currentTrack?.title,
    currentTrack?.artist,
    isOffline,
    downloadedTracks,
    fetchTrackLyrics,
  ]);

  /**
   * Save or update lyrics locally and persist to server.
   */
  const saveTrackLyrics = useCallback(async (updatedLyrics, isVerified = false) => {
    if (!updatedLyrics) return;
    const parsed = parseLrcLyrics(updatedLyrics);
    if (!parsed || parsed.length === 0) return;

    if (isVerified) {
      parsed.isVerified = true;
    }
    setLyrics(parsed);

    const track = currentTrackRef.current;
    if (!track) return;

    const trackId = String(track._id || track.id || track.trackId || '');
    const title = track.title || '';
    const artist = track.artist || '';

    track.lyrics = parsed;
    track.isVerifiedLyrics = Boolean(isVerified);

    if (trackId) {
      updateDownloadedTrackLyrics(trackId, parsed).catch(() => {});
    }

    try {
      const activeToken =
        tokenRef.current ||
        (await AsyncStorage.getItem('@rivo_auth_token_v2')) ||
        (await AsyncStorage.getItem('rivo_token')) ||
        (await AsyncStorage.getItem('token'));

      const headers = {
        'Content-Type': 'application/json',
      };
      if (activeToken) {
        headers.Authorization = `Bearer ${activeToken}`;
      }

      const isMongoId = trackId && /^[0-9a-fA-F]{24}$/.test(trackId);
      const endpoint = isMongoId
        ? `${API_BASE_URL}/api/tracks/${trackId}/lyrics`
        : `${API_BASE_URL}/api/tracks/update-lyrics`;

      await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          trackId,
          title,
          artist,
          lyrics: parsed,
          isVerified: Boolean(isVerified),
        }),
      });
    } catch (err) {
      console.warn('[useAudioLyrics] saveTrackLyrics failed to sync to server:', err?.message);
    }
  }, []);

  return {
    lyrics,
    setLyrics,
    isLoadingLyrics,
    saveTrackLyrics,
    fetchTrackLyrics,
  };
};

export default useAudioLyrics;
