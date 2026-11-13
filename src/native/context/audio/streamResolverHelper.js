import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { applyStandardAudioMode, ensureBackgroundAudioMode } from './audioModeConfig';
import NetInfo from '@react-native-community/netinfo';
import { API_BASE_URL } from '../../config';
import {
  resolveAudioStream,
  clearStreamCache,
  extractYouTubeId,
  isStreamUrlLikelyExpired,
} from '../../services/youtubeResolver';
import { isQuranContent, isRadioTrack } from '../../../utils/quranUtils';
import {
  reanchorDocumentUri,
  updateTrackDownloadRecord,
  getDownloadedTracks,
  findDownloadedTrackFast,
  getTrackDedupeKey,
} from '../../services/download/storageManifestService';

const verifiedLocalUriCache = new Set();

/**
 * Checks if a candidate URI points to a valid, playable local file (>= 1000 bytes or content://).
 */
export const verifyLocalAudioFile = async (rawUri) => {
  if (!rawUri || typeof rawUri !== 'string') return null;

  let reanchored = reanchorDocumentUri(rawUri);
  if (!reanchored || typeof reanchored !== 'string') return null;
  if (reanchored.startsWith('/')) reanchored = `file://${reanchored}`;
  if (!reanchored.startsWith('file://') && !reanchored.startsWith('content://')) return null;

  if (verifiedLocalUriCache.has(reanchored)) {
    return { uri: reanchored, size: 5000, exists: true };
  }

  const candidateUris = [reanchored];
  for (const fn of [decodeURI, encodeURI]) {
    try {
      const alt = fn(reanchored);
      if (alt !== reanchored && !candidateUris.includes(alt)) candidateUris.push(alt);
    } catch {}
  }

  for (const testUri of candidateUris) {
    if (verifiedLocalUriCache.has(testUri)) {
      return { uri: testUri, size: 5000, exists: true };
    }
    try {
      const info = await FileSystem.getInfoAsync(testUri);
      if (info?.exists) {
        const size = typeof info.size === 'number' ? info.size : 5000;
        if (size >= 1000 || testUri.startsWith('content://')) {
          verifiedLocalUriCache.add(testUri);
          return { uri: testUri, size, exists: true };
        }
      }
    } catch {}
  }

  return null;
};

const pickLocalUriField = (obj) =>
  obj?.localAudioUri ||
  (obj?.nativeAudioUri && (obj.nativeAudioUri.startsWith('file://') || obj.nativeAudioUri.startsWith('content://') || obj.nativeAudioUri.startsWith('/') || obj.nativeAudioUri.includes('rivo_tracks/')) ? obj.nativeAudioUri : null) ||
  (obj?.audioUrl && (obj.audioUrl.startsWith('file://') || obj.audioUrl.startsWith('content://') || obj.audioUrl.startsWith('/') || obj.audioUrl.includes('rivo_tracks/')) ? obj.audioUrl : null);

/**
 * Resolves the playback URI for a track:
 * 1. Re-anchors and validates local offline file.
 * 2. Falls back transparently to online stream resolution if missing/damaged.
 */
export const resolveTrackPlaybackUri = async ({ track, isVocalOnly, updateVocalStatus, signal }) => {
  if (!track || signal?.aborted) return null;

  const trackId = String(track._id || track.id || '');
  const candidateLocal = pickLocalUriField(track);
  let validLocalUri = null;
  const fastDl = !track._skipLocal ? findDownloadedTrackFast(track) : { ready: true, match: null };
  const rawTrackUrl = String(track.audioUrl || '').trim();

  // Instant fast-path for online tracks that are NOT in local offline vault (avoids 15+ sequential FileSystem calls)
  const shouldScanDiskDirs = Boolean(candidateLocal || track.isDownloaded || track.downloaded || fastDl.match);

  if (!track._skipLocal) {
    if (candidateLocal) {
      const check = await verifyLocalAudioFile(candidateLocal);
      if (signal?.aborted) return null;
      if (check?.exists) validLocalUri = check.uri;
    }

    if (!validLocalUri && (!fastDl.ready || fastDl.match)) {
      try {
        const match = fastDl.ready
          ? fastDl.match
          : await (async () => {
              const downloadedList = await getDownloadedTracks();
              if (signal?.aborted || !Array.isArray(downloadedList) || downloadedList.length === 0) return null;
              const dedupeKey = getTrackDedupeKey(track);
              const cleanT = (track.title || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').trim();
              const cleanA = (track.artist || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').trim();
              return downloadedList.find((item) => {
                if (!item) return false;
                const itemId = String(item._id || item.id || '');
                if (
                  (trackId && itemId && itemId === trackId) ||
                  (track.youtubeId && item.youtubeId && track.youtubeId === item.youtubeId) ||
                  (dedupeKey && getTrackDedupeKey(item) === dedupeKey)
                ) return true;
                if (cleanT) {
                  const iT = (item.title || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').trim();
                  const iA = (item.artist || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').trim();
                  if (iT && cleanT === iT && (!cleanA || !iA || cleanA.includes(iA) || iA.includes(cleanA))) return true;
                }
                return false;
              });
            })();
        if (signal?.aborted) return null;
        const matchUri = pickLocalUriField(match);
        if (matchUri) {
          const check = await verifyLocalAudioFile(matchUri);
          if (signal?.aborted) return null;
          if (check?.exists) validLocalUri = check.uri;
        }
      } catch (e) {
        console.warn('[streamResolverHelper] Storage manifest lookup error:', e?.message);
      }
    }

    // Immediate direct cloud URL shortcut before scanning 12+ fallback directories if not marked downloaded
    if (!validLocalUri && !shouldScanDiskDirs && rawTrackUrl.startsWith('/uploads/')) {
      const directCloudUrl = `${API_BASE_URL}${rawTrackUrl}`;
      track.resolvedAudioUrl = directCloudUrl;
      return directCloudUrl;
    }

    if (!validLocalUri && shouldScanDiskDirs && FileSystem.documentDirectory) {
      const docDir = FileSystem.documentDirectory;
      const baseDir = docDir.endsWith('/') ? docDir : `${docDir}/`;
      const candidates = [];
      const dirs = ['rivo_tracks', 'rivo_vault'];
      if (trackId) {
        for (const dir of dirs) {
          for (const ext of ['.mp3', '.m4a', '']) candidates.push(`${baseDir}${dir}/${trackId}${ext}`);
        }
      }
      if (track.youtubeId && track.youtubeId !== trackId) {
        for (const dir of dirs) {
          for (const ext of ['.mp3', '.m4a']) candidates.push(`${baseDir}${dir}/${track.youtubeId}${ext}`);
        }
      }
      if (candidateLocal) {
        const filename = candidateLocal.split('/').pop()?.split('?')[0];
        if (filename && filename !== trackId) {
          for (const dir of dirs) candidates.push(`${baseDir}${dir}/${filename}`);
        }
      }

      for (const cand of candidates) {
        if (signal?.aborted) return null;
        const check = await verifyLocalAudioFile(cand);
        if (check?.exists) {
          validLocalUri = check.uri;
          break;
        }
      }
    }

    if (signal?.aborted) return null;

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
  }

  if (track.isDownloaded || track.downloaded || candidateLocal) {
    const netState = await NetInfo.fetch().catch(() => null);
    if (signal?.aborted) return null;
    const isOnline = netState ? (netState.isConnected && netState.isInternetReachable !== false) : true;
    if (!isOnline) throw new Error('Offline song file is missing or damaged, and device is offline');
  }

  if (signal?.aborted) return null;

  if (track.isRetry || track._clearCache) {
    clearStreamCache(trackId, track.youtubeId || extractYouTubeId(track.audioUrl || track.url));
  }

  let remoteUri = await resolveAudioStream(
    track,
    isQuranContent(track) ? false : isVocalOnly,
    isQuranContent(track) ? null : updateVocalStatus,
    signal
  );

  if (signal?.aborted || !remoteUri || typeof remoteUri !== 'string') return null;
  if (remoteUri.startsWith('/')) remoteUri = `${API_BASE_URL}${remoteUri}`;
  if (remoteUri.includes('youtube.com/watch') || remoteUri.includes('youtu.be/')) return null;

  track.resolvedAudioUrl = remoteUri;
  return remoteUri;
};

const normalizeStreamUri = (uri) => (uri && typeof uri === 'string' ? (uri.startsWith('/') ? `${API_BASE_URL}${uri}` : uri) : '');

const unloadSoundSafely = async (sound) => {
  if (!sound) return;
  try { await sound.stopAsync().catch(() => {}); } catch {}
  try { await sound.unloadAsync().catch(() => {}); } catch {}
};

const createSoundWithGuard = async (sourceUri, initialStatus, signal, timeoutMs = 15000) => {
  if (signal?.aborted) return null;
  let timedOut = false;
  let timerId = null;
  let onAbort = null;

  const soundPromise = Audio.Sound.createAsync({ uri: sourceUri }, initialStatus);
  soundPromise.then((res) => {
    if ((timedOut || signal?.aborted) && res?.sound) unloadSoundSafely(res.sound);
  }).catch(() => {});

  try {
    const racers = [soundPromise];
    if (timeoutMs > 0) {
      racers.push(new Promise((_, reject) => {
        timerId = setTimeout(() => { timedOut = true; reject(new Error('Audio stream load timed out')); }, timeoutMs);
      }));
    }
    if (signal) {
      racers.push(new Promise((resolve) => {
        if (signal.aborted) return resolve(null);
        onAbort = () => resolve(null);
        signal.addEventListener('abort', onAbort, { once: true });
      }));
    }
    return await Promise.race(racers);
  } finally {
    if (timerId) clearTimeout(timerId);
    if (signal && onAbort) signal.removeEventListener('abort', onAbort);
  }
};

const verifySoundLoaded = async (sound, initialStatus, signal, errMsg) => {
  if (signal?.aborted) {
    await unloadSoundSafely(sound);
    return null;
  }
  const status = initialStatus?.isLoaded ? initialStatus : await sound.getStatusAsync().catch(() => null);
  if (signal?.aborted) {
    await unloadSoundSafely(sound);
    return null;
  }
  if (!status?.isLoaded) {
    await unloadSoundSafely(sound);
    throw new Error(status?.error || initialStatus?.error || errMsg);
  }
  return status;
};

/**
 * Creates and verifies an Audio.Sound instance: unloads on abort/!isLoaded, retries initial seek at 0, and nudges playAsync().
 */
const loadAndVerifySound = async ({ targetUri, safeTargetSec = 0, volume = 0.8, autoPlay = true, signal = null }) => {
  const cleanUri = normalizeStreamUri(targetUri);
  if (!cleanUri || signal?.aborted) return null;

  const isLocal = cleanUri.startsWith('file://') || cleanUri.startsWith('content://');
  const timeoutMs = isLocal ? 10000 : 15000;
  const initialPosMillis = Math.max(0, Math.round((Number(safeTargetSec) || 0) * 1000));

  const createAtPosition = async (posMillis) => {
    const statusPayload = {
      shouldPlay: autoPlay !== false,
      volume,
      progressUpdateIntervalMillis: 250,
    };
    if (posMillis > 0) {
      statusPayload.positionMillis = posMillis;
    }
    const res = await createSoundWithGuard(
      cleanUri,
      statusPayload,
      signal,
      timeoutMs
    );
    if (signal?.aborted) {
      if (res?.sound) await unloadSoundSafely(res.sound);
      return null;
    }
    if (!res?.sound) throw new Error('Audio stream failed to initialize');
    const status = await verifySoundLoaded(res.sound, res.status, signal, 'Audio stream failed to load');
    return status ? { sound: res.sound, status } : null;
  };

  let created;
  try {
    created = await createAtPosition(initialPosMillis);
  } catch (initErr) {
    if (signal?.aborted) return null;
    if (initialPosMillis <= 0) throw initErr;
    created = await createAtPosition(0);
    if (!created) return null;
    await created.sound.setPositionAsync(initialPosMillis).catch(() => {});
    const postSeek = await verifySoundLoaded(created.sound, null, signal, 'Audio stream became unloaded after seek');
    if (!postSeek) return null;
    created.status = postSeek;
  }

  if (!created || signal?.aborted) {
    if (created?.sound) await unloadSoundSafely(created.sound);
    return null;
  }

  let { sound, status } = created;
  if (autoPlay !== false && !status.isPlaying && !status.isBuffering) {
    await sound.playAsync().catch(() => {});
    const nudged = await verifySoundLoaded(sound, null, signal, 'Audio stream failed after play nudge');
    if (!nudged) return null;
    status = nudged;
  }

  return { sound, status, uri: cleanUri };
};

const ABORTED_SOUND_RESULT = { sound: null, status: null, uri: null };

/**
 * Creates an Audio.Sound instance with automatic failover protection across local, remote, and vocal-only streams.
 */
export const createAudioSound = async ({
  uri, track, safeTargetSec = 0, volume = 0.8, isVocalOnly = false, updateVocalStatus = null, signal = null, autoPlay = true,
}) => {
  const activeUri = normalizeStreamUri(uri);
  if (signal?.aborted) return ABORTED_SOUND_RESULT;

  await ensureBackgroundAudioMode(false);
  if (signal?.aborted) return ABORTED_SOUND_RESULT;

  try {
    const primary = await loadAndVerifySound({ targetUri: activeUri, safeTargetSec, volume, autoPlay, signal });
    return primary || ABORTED_SOUND_RESULT;
  } catch (err) {
    if (signal?.aborted) return ABORTED_SOUND_RESULT;

    const trackId = String(track?._id || track?.id || '');
    const ytId = track?.youtubeId || extractYouTubeId(track?.audioUrl || track?.url);
    const vocalEnabled = isQuranContent(track) ? false : isVocalOnly;
    const vocalCb = isQuranContent(track) ? null : updateVocalStatus;

    if (activeUri && (activeUri.startsWith('file://') || activeUri.startsWith('content://'))) {
      console.warn('[streamResolverHelper] AVPlayer failed on local file, falling back to online stream:', err?.message);
      const netState = await NetInfo.fetch().catch(() => null);
      if (signal?.aborted) return ABORTED_SOUND_RESULT;
      if (netState && (!netState.isConnected || netState.isInternetReachable === false)) {
        throw new Error('This offline media file is damaged and cannot be played while offline');
      }

      clearStreamCache(trackId, ytId);
      const streamUri = await resolveAudioStream(
        { ...track, isRetry: true, _clearCache: true, _skipLocal: true, resolvedAudioUrl: null },
        vocalEnabled,
        vocalCb,
        signal
      );
      if (signal?.aborted) return ABORTED_SOUND_RESULT;
      if (!streamUri) throw new Error(`This media may be damaged and online stream could not be resolved: ${err.message}`);

      try {
        const fallback = await loadAndVerifySound({ targetUri: streamUri, safeTargetSec, volume, autoPlay, signal });
        return fallback || ABORTED_SOUND_RESULT;
      } catch (localFallbackErr) {
        if (!vocalEnabled || signal?.aborted) throw localFallbackErr;
      }
    }

    if (activeUri && (activeUri.startsWith('http://') || activeUri.startsWith('https://')) && !signal?.aborted) {
      console.warn('[streamResolverHelper] AVPlayer failed on remote stream, clearing cache and retrying fresh stream:', err?.message);
      clearStreamCache(trackId, ytId);
      try {
        const rawAudioUrl = track?.audioUrl || '';
        const keepAudioUrl = isRadioTrack(track) || track?.isRadio || track?.isLive ||
          rawAudioUrl.includes('youtube.com/watch') || rawAudioUrl.includes('youtu.be/');
        const freshUri = await resolveAudioStream(
          {
            ...track,
            isRetry: true,
            _clearCache: true,
            resolvedAudioUrl: null,
            youtubeId: track?.youtubeId || ytId || undefined,
            audioUrl: keepAudioUrl ? rawAudioUrl : '',
          },
          vocalEnabled,
          vocalCb,
          signal
        );
        if (signal?.aborted) return ABORTED_SOUND_RESULT;
        if (freshUri && typeof freshUri === 'string' && !isStreamUrlLikelyExpired(freshUri, 30)) {
          const retryRes = await loadAndVerifySound({ targetUri: freshUri, safeTargetSec, volume, autoPlay, signal });
          return retryRes || ABORTED_SOUND_RESULT;
        }
      } catch (retryErr) {
        console.warn('[streamResolverHelper] Fresh stream retry also failed:', retryErr?.message);
      }
    }

    if (vocalEnabled && !signal?.aborted) {
      console.warn('[streamResolverHelper] Vocal playback failed, falling back to standard audio stream:', err?.message);
      if (typeof updateVocalStatus === 'function') updateVocalStatus(null);
      clearStreamCache(trackId, ytId);
      const standardUri = await resolveAudioStream({ ...track, _clearCache: true, resolvedAudioUrl: null }, false, null, signal);
      if (signal?.aborted) return ABORTED_SOUND_RESULT;
      if (standardUri) {
        const stdRes = await loadAndVerifySound({ targetUri: standardUri, safeTargetSec, volume, autoPlay, signal });
        return stdRes || ABORTED_SOUND_RESULT;
      }
    }

    throw err;
  }
};
