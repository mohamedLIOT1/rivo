import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import NetInfo from '@react-native-community/netinfo';
import { API_BASE_URL } from '../../config';
import { resolveAudioStream, clearStreamCache } from '../../services/youtubeResolver';
import { isQuranContent } from '../../../utils/quranUtils';
import {
  reanchorDocumentUri,
  updateTrackDownloadRecord,
  getDownloadedTracks,
  getTrackDedupeKey,
} from '../../services/download/storageManifestService';

/**
 * Checks if a candidate URI points to a valid, playable local file (>= 1000 bytes or content://).
 */
export const verifyLocalAudioFile = async (rawUri) => {
  if (!rawUri || typeof rawUri !== 'string') return null;

  // Re-anchor if needed
  let reanchored = reanchorDocumentUri(rawUri);
  if (!reanchored || typeof reanchored !== 'string') return null;

  // Support raw absolute paths without file:// scheme
  if (reanchored.startsWith('/')) {
    reanchored = `file://${reanchored}`;
  }

  // Accept file:// and Android SAF content:// URIs
  if (!reanchored.startsWith('file://') && !reanchored.startsWith('content://')) {
    return null;
  }

  // Build candidate URIs testing raw, decoded, and encoded forms
  const candidateUris = [reanchored];
  try {
    const decoded = decodeURI(reanchored);
    if (decoded !== reanchored && !candidateUris.includes(decoded)) {
      candidateUris.push(decoded);
    }
  } catch {}
  try {
    const encoded = encodeURI(reanchored);
    if (encoded !== reanchored && !candidateUris.includes(encoded)) {
      candidateUris.push(encoded);
    }
  } catch {}

  for (const testUri of candidateUris) {
    try {
      const info = await FileSystem.getInfoAsync(testUri);
      if (info && info.exists) {
        const size = typeof info.size === 'number' ? info.size : 5000;
        if (size >= 1000 || testUri.startsWith('content://')) {
          return { uri: testUri, size, exists: true };
        }
      }
    } catch {}
  }

  return null;
};

/**
 * Resolves the playback URI for a track:
 * 1. Re-anchors local path against current FileSystem.documentDirectory (fixing iOS sandbox UUID shifts).
 * 2. Validates local file existence & size (>= 5000 bytes).
 * 3. If local file is missing/damaged (< 5000 bytes):
 *    - Cleans up corrupt partial file.
 *    - Falls back transparently to online stream resolution if network is available.
 *    - Auto-heals download storage manifest.
 */
export const resolveTrackPlaybackUri = async ({
  track,
  isVocalOnly,
  updateVocalStatus,
  signal,
}) => {
  if (!track) return null;

  const trackId = String(track._id || track.id || '');
  const candidateLocal = track.localAudioUri ||
    (track.nativeAudioUri && (track.nativeAudioUri.startsWith('file://') || track.nativeAudioUri.includes('rivo_tracks/')) ? track.nativeAudioUri : null) ||
    (track.audioUrl && (track.audioUrl.startsWith('file://') || track.audioUrl.includes('rivo_tracks/')) ? track.audioUrl : null);

  let validLocalUri = null;

  // 1. Check direct local candidate with re-anchoring
  if (candidateLocal) {
    const check = await verifyLocalAudioFile(candidateLocal);
    if (check && check.exists) {
      validLocalUri = check.uri;
    }
  }

  // 2. Offline storage manifest lookup fallback
  if (!validLocalUri) {
    try {
      const downloadedList = await getDownloadedTracks();
      if (Array.isArray(downloadedList) && downloadedList.length > 0) {
        const dedupeKey = getTrackDedupeKey(track);
        const match = downloadedList.find((item) => {
          if (!item) return false;
          const itemId = String(item._id || item.id || '');
          if (trackId && itemId && itemId === trackId) return true;
          if (track.youtubeId && item.youtubeId && track.youtubeId === item.youtubeId) return true;
          if (dedupeKey && getTrackDedupeKey(item) === dedupeKey) return true;
          return false;
        });

        if (match) {
          const matchUri = match.localAudioUri ||
            (match.nativeAudioUri && (match.nativeAudioUri.startsWith('file://') || match.nativeAudioUri.startsWith('content://') || match.nativeAudioUri.startsWith('/')) ? match.nativeAudioUri : null) ||
            (match.audioUrl && (match.audioUrl.startsWith('file://') || match.audioUrl.startsWith('content://') || match.audioUrl.startsWith('/')) ? match.audioUrl : null);

          if (matchUri) {
            const check = await verifyLocalAudioFile(matchUri);
            if (check && check.exists) {
              validLocalUri = check.uri;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[streamResolverHelper] Storage manifest lookup error:', e?.message);
    }
  }

  // 3. If candidate wasn't valid, scan candidate files in rivo_tracks / rivo_vault
  if (!validLocalUri && FileSystem.documentDirectory) {
    const docDir = FileSystem.documentDirectory;
    const baseDir = docDir.endsWith('/') ? docDir : `${docDir}/`;
    const candidates = [];

    if (trackId) {
      candidates.push(`${baseDir}rivo_tracks/${trackId}.mp3`);
      candidates.push(`${baseDir}rivo_tracks/${trackId}.m4a`);
      candidates.push(`${baseDir}rivo_tracks/${trackId}`);
      candidates.push(`${baseDir}rivo_vault/${trackId}.mp3`);
      candidates.push(`${baseDir}rivo_vault/${trackId}.m4a`);
      candidates.push(`${baseDir}rivo_vault/${trackId}`);
    }

    if (track.youtubeId && track.youtubeId !== trackId) {
      candidates.push(`${baseDir}rivo_tracks/${track.youtubeId}.mp3`);
      candidates.push(`${baseDir}rivo_tracks/${track.youtubeId}.m4a`);
      candidates.push(`${baseDir}rivo_vault/${track.youtubeId}.mp3`);
      candidates.push(`${baseDir}rivo_vault/${track.youtubeId}.m4a`);
    }

    if (candidateLocal) {
      const filename = candidateLocal.split('/').pop()?.split('?')[0];
      if (filename && filename !== trackId) {
        candidates.push(`${baseDir}rivo_tracks/${filename}`);
        candidates.push(`${baseDir}rivo_vault/${filename}`);
      }
    }

    for (const cand of candidates) {
      const check = await verifyLocalAudioFile(cand);
      if (check && check.exists) {
        validLocalUri = check.uri;
        break;
      }
    }
  }

  // 4. If recovered a valid local file, auto-heal track record in storage
  if (validLocalUri) {
    if (track.localAudioUri !== validLocalUri || track.nativeAudioUri !== validLocalUri) {
      track.localAudioUri = validLocalUri;
      track.nativeAudioUri = validLocalUri;
      if (trackId) {
        updateTrackDownloadRecord(trackId, {
          localAudioUri: validLocalUri,
          nativeAudioUri: validLocalUri,
          audioUrl: validLocalUri,
          isDownloaded: true,
          downloaded: true,
        }).catch(() => {});
      }
    }
    return validLocalUri;
  }

  // 5. If local file was expected but damaged/missing, check network before failing (WITHOUT wiping local download records)
  if (track.isDownloaded || track.downloaded || candidateLocal) {
    const netState = await NetInfo.fetch().catch(() => null);
    const isOnline = netState ? (netState.isConnected && netState.isInternetReachable !== false) : true;
    if (!isOnline) {
      throw new Error('Offline song file is missing or damaged, and device is offline');
    }
  }

  // 6. Seamlessly resolve audio stream URL from backend / YouTube
  let remoteUri = await resolveAudioStream(
    track,
    isQuranContent(track) ? false : isVocalOnly,
    isQuranContent(track) ? null : updateVocalStatus,
    signal
  );

  if (remoteUri && typeof remoteUri === 'string' && remoteUri.startsWith('/')) {
    remoteUri = `${API_BASE_URL}${remoteUri}`;
  }

  if (remoteUri) {
    track.resolvedAudioUrl = remoteUri;
  }
  return remoteUri;
};

/**
 * Creates an Audio.Sound instance with automatic failover protection:
 * If AVPlayer fails on a local file (damaged AVPlayerItem / sandbox shift),
 * transparently falls back to resolving and playing the online audio stream.
 */
export const createAudioSound = async ({
  uri,
  track,
  safeTargetSec = 0,
  volume = 0.8,
  isVocalOnly = false,
  updateVocalStatus = null,
  signal = null,
  autoPlay = true,
}) => {
  let activeUri = uri;

  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {});

    const result = await Audio.Sound.createAsync(
      { uri: activeUri },
      {
        shouldPlay: autoPlay !== false,
        positionMillis: Math.round(safeTargetSec * 1000),
        volume,
        progressUpdateIntervalMillis: 250,
      }
    );
    return { sound: result.sound, status: result.status, uri: activeUri };
  } catch (err) {
    // If local file playback failed in AVPlayer (e.g. damaged AVPlayerItem, container error, or corrupt codec)
    if (activeUri && typeof activeUri === 'string' && (activeUri.startsWith('file://') || activeUri.startsWith('content://')) && (!signal || !signal.aborted)) {
      console.warn('[streamResolverHelper] AVPlayer failed on local file, falling back to online stream:', err?.message);

      // Check network before fallback (DO NOT delete local file or wipe storage record!)
      const netState = await NetInfo.fetch().catch(() => null);
      const isOnline = netState ? (netState.isConnected && netState.isInternetReachable !== false) : true;
      if (!isOnline) {
        throw new Error('This offline media file is damaged and cannot be played while offline');
      }

      // Transparently fall back to resolving online stream (bypassing any stale cache)
      let streamUri = await resolveAudioStream(
        { ...track, isRetry: true, _clearCache: true },
        isQuranContent(track) ? false : isVocalOnly,
        isQuranContent(track) ? null : updateVocalStatus,
        signal
      );

      if (signal?.aborted) return { sound: null, status: null, uri: null };
      if (!streamUri) {
        throw new Error(`This media may be damaged and online stream could not be resolved: ${err.message}`);
      }

      if (streamUri.startsWith('/')) {
        streamUri = `${API_BASE_URL}${streamUri}`;
      }

      const fallbackResult = await Audio.Sound.createAsync(
        { uri: streamUri },
        {
          shouldPlay: autoPlay !== false,
          positionMillis: Math.round(safeTargetSec * 1000),
          volume,
          progressUpdateIntervalMillis: 250,
        }
      );
      return { sound: fallbackResult.sound, status: fallbackResult.status, uri: streamUri };
    }

    // If remote HTTP/HTTPS stream failed in AVPlayer (e.g. error -1008 NSURLErrorResourceUnavailable, expired token, network glitch)
    if (activeUri && typeof activeUri === 'string' && (activeUri.startsWith('http://') || activeUri.startsWith('https://')) && (!signal || !signal.aborted)) {
      console.warn('[streamResolverHelper] AVPlayer failed on remote stream (-1008 or network error), clearing cache and retrying fresh stream:', err?.message);
      const trackId = String(track?._id || track?.id || '');
      if (trackId) {
        clearStreamCache(trackId);
      }

      try {
        const retryTrack = { ...track, isRetry: true, _clearCache: true, audioUrl: '' };
        let freshUri = await resolveAudioStream(
          retryTrack,
          isQuranContent(track) ? false : isVocalOnly,
          isQuranContent(track) ? null : updateVocalStatus,
          signal
        );

        if (signal?.aborted) return { sound: null, status: null, uri: null };

        if (freshUri && typeof freshUri === 'string') {
          if (freshUri.startsWith('/')) {
            freshUri = `${API_BASE_URL}${freshUri}`;
          }

          const retryResult = await Audio.Sound.createAsync(
            { uri: freshUri },
            {
              shouldPlay: autoPlay !== false,
              positionMillis: Math.round(safeTargetSec * 1000),
              volume,
              progressUpdateIntervalMillis: 250,
            }
          );
          return { sound: retryResult.sound, status: retryResult.status, uri: freshUri };
        }
      } catch (retryErr) {
        console.warn('[streamResolverHelper] Fresh stream retry also failed:', retryErr?.message);
      }
    }

    // If vocal-only stream playback failed in AVPlayer, smoothly fall back to high-quality regular audio
    if (isVocalOnly && (!signal || !signal.aborted)) {
      console.warn('[streamResolverHelper] Vocal playback failed, smoothly falling back to standard audio stream:', err?.message);
      if (typeof updateVocalStatus === 'function') updateVocalStatus(null);
      let standardUri = await resolveAudioStream(track, false, null, signal);
      if (signal?.aborted) return { sound: null, status: null, uri: null };
      if (standardUri) {
        if (standardUri.startsWith('/')) standardUri = `${API_BASE_URL}${standardUri}`;
        const fallbackResult = await Audio.Sound.createAsync(
          { uri: standardUri },
          {
            shouldPlay: autoPlay !== false,
            positionMillis: Math.round(safeTargetSec * 1000),
            volume,
            progressUpdateIntervalMillis: 250,
          }
        );
        return { sound: fallbackResult.sound, status: fallbackResult.status, uri: standardUri };
      }
    }

    throw err;
  }
};
