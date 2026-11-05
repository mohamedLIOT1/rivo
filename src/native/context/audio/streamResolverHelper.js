import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import NetInfo from '@react-native-community/netinfo';
import { API_BASE_URL } from '../../config';
import { resolveAudioStream } from '../../services/youtubeResolver';
import { isQuranContent } from '../../../utils/quranUtils';
import { reanchorDocumentUri, updateTrackDownloadRecord } from '../../services/download/storageManifestService';

/**
 * Checks if a candidate URI points to a valid, playable local file (>= 5000 bytes).
 */
export const verifyLocalAudioFile = async (rawUri) => {
  if (!rawUri || typeof rawUri !== 'string') return null;
  const reanchored = reanchorDocumentUri(rawUri);
  if (!reanchored || !reanchored.startsWith('file://')) return null;

  try {
    const info = await FileSystem.getInfoAsync(reanchored);
    if (info && info.exists && typeof info.size === 'number' && info.size >= 5000) {
      return { uri: reanchored, size: info.size, exists: true };
    }
    return { uri: reanchored, size: info?.size || 0, exists: Boolean(info?.exists) };
  } catch {
    return null;
  }
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
    if (check && check.exists && check.size >= 5000) {
      validLocalUri = check.uri;
    } else if (check && check.exists && check.size < 5000) {
      // Corrupt/empty file on disk: purge it
      await FileSystem.deleteAsync(check.uri, { idempotent: true }).catch(() => {});
    }
  }

  // 2. If candidate wasn't valid, scan candidate files in rivo_tracks / rivo_vault
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
    }

    if (candidateLocal) {
      const filename = candidateLocal.split('/').pop()?.split('?')[0];
      if (filename && filename !== trackId) {
        candidates.push(`${baseDir}rivo_tracks/${filename}`);
        candidates.push(`${baseDir}rivo_vault/${filename}`);
      }
    }

    for (const cand of candidates) {
      try {
        const cInfo = await FileSystem.getInfoAsync(cand);
        if (cInfo && cInfo.exists && typeof cInfo.size === 'number' && cInfo.size >= 5000) {
          validLocalUri = cand;
          break;
        }
      } catch {}
    }
  }

  // 3. If recovered a valid local file, auto-heal track record in storage
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

  // 4. If local file was expected but missing/corrupt on disk, auto-heal storage record
  if (track.isDownloaded || track.downloaded || candidateLocal) {
    if (trackId) {
      updateTrackDownloadRecord(trackId, {
        isDownloaded: false,
        downloaded: false,
        localAudioUri: null,
        nativeAudioUri: null,
      }).catch(() => {});
    }
  }

  // 5. If local file was expected but damaged/missing, check network before failing
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
}) => {
  let activeUri = uri;

  try {
    const result = await Audio.Sound.createAsync(
      { uri: activeUri },
      {
        shouldPlay: false,
        positionMillis: Math.round(safeTargetSec * 1000),
        volume,
        progressUpdateIntervalMillis: 250,
      }
    );
    return { sound: result.sound, status: result.status, uri: activeUri };
  } catch (err) {
    // If local file playback failed in AVPlayer (e.g. damaged AVPlayerItem, container error, or corrupt codec)
    if (activeUri && typeof activeUri === 'string' && activeUri.startsWith('file://') && (!signal || !signal.aborted)) {
      console.warn('[streamResolverHelper] AVPlayer failed on local file, falling back to online stream:', err?.message);

      // Delete corrupt local file and heal storage record
      await FileSystem.deleteAsync(activeUri, { idempotent: true }).catch(() => {});
      const trackId = String(track?._id || track?.id || '');
      if (trackId) {
        updateTrackDownloadRecord(trackId, {
          isDownloaded: false,
          downloaded: false,
          localAudioUri: null,
          nativeAudioUri: null,
        }).catch(() => {});
      }

      // Check network before fallback
      const netState = await NetInfo.fetch().catch(() => null);
      const isOnline = netState ? (netState.isConnected && netState.isInternetReachable !== false) : true;
      if (!isOnline) {
        throw new Error('This offline media file is damaged and cannot be played while offline');
      }

      // Transparently fall back to resolving online stream
      let streamUri = await resolveAudioStream(
        track,
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
          shouldPlay: false,
          positionMillis: Math.round(safeTargetSec * 1000),
          volume,
          progressUpdateIntervalMillis: 250,
        }
      );
      return { sound: fallbackResult.sound, status: fallbackResult.status, uri: streamUri };
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
            shouldPlay: false,
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
