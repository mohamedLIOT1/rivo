import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { API_BASE_URL } from '../config';
import { resolveAudioStream } from './youtubeResolver';
import { parseLrcLyrics } from '../../utils/lrcParser';
import { isQuranContent } from '../../utils/quranUtils';
import { isPodcastContent, getPodcastCategory } from '../utils/podcastUtils';

export {
  getTrackDedupeKey,
  deduplicateTrackList,
  subscribeToDownloadedTracks,
  notifyDownloadedTracksChanged,
  flushDownloadedTracksSave,
  saveDownloadedTracks,
  reanchorDocumentUri,
  updateTrackDownloadRecord,
  getDownloadedTracks,
  isTrackDownloaded,
  listeners,
} from './download/storageManifestService';

export {
  extractId3Metadata,
  parseAudioMetadataFromFilename,
} from './download/id3TagService';

export {
  scanOfflineVault,
  getStorageLocationInfo,
  updateDownloadedTrackLyrics,
  exportTrackAudioFile,
  importAudioFolderFromDevice,
  importLocalAudioFiles,
  TRACKS_DIR,
  COVERS_DIR,
  ensureDirs,
} from './download/deviceVaultService';

import {
  getDownloadedTracks,
  saveDownloadedTracks,
  deduplicateTrackList,
  getTrackDedupeKey,
  PERSISTENT_DIR,
} from './download/storageManifestService';
import { embedId3v2TagsToMp3File as rawEmbedId3v2TagsToMp3File } from './download/id3TagService';
import { TRACKS_DIR, COVERS_DIR, ensureDirs } from './download/deviceVaultService';

const isLiteModeActive = async () => {
  try {
    const stored = await AsyncStorage.getItem('@rivo_lite_mode');
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {}
  if (Platform.OS !== 'android') return false;
  const apiLevel = Number(Platform.Version);
  return Number.isFinite(apiLevel) && apiLevel > 0 && apiLevel <= 27;
};

export const embedId3v2TagsToMp3File = async (fileUri, metadata) => {
  if (!fileUri || typeof fileUri !== 'string') return false;
  const cleanPath = fileUri.toLowerCase().split('?')[0];
  // ID3v2 frames corrupt or stall .m4a / MP4 containers
  if (cleanPath.endsWith('.m4a') || cleanPath.endsWith('.mp4') || cleanPath.endsWith('.aac')) {
    return false;
  }
  // Skip heavy ID3 rewriting in Lite Mode / low-RAM Android to avoid eMMC I/O playback freezes
  if (await isLiteModeActive()) {
    return true;
  }
  return rawEmbedId3v2TagsToMp3File(fileUri, metadata);
};

export const downloadTrack = async (track, onProgress) => {
  if (!track) throw new Error('No track provided');
  await ensureDirs();

  let highestPercent = 5;
  const emitProgress = (pct) => {
    const rounded = Math.min(95, Math.max(highestPercent, Math.round(pct)));
    if (rounded > highestPercent) {
      highestPercent = rounded;
      if (onProgress) onProgress(highestPercent);
    }
  };

  emitProgress(5);

  const cleanTitle = (track.title || 'Track').replace(/[/\\?%*:|"<>]/g, '').trim();
  const cleanArtist = (track.artist || 'Artist').replace(/[/\\?%*:|"<>]/g, '').trim();
  const cleanAlbum = (track.album || cleanTitle || 'Single').replace(/[/\\?%*:|"<>]/g, '').trim();
  const trackId = String(track._id || track.id || track.youtubeId || `tr_${cleanTitle}_${cleanArtist}`.replace(/\s+/g, '_'));

  const audioFileUriMp3 = `${TRACKS_DIR}${trackId}.mp3`;
  const audioFileUriM4a = `${TRACKS_DIR}${trackId}.m4a`;
  const coverFileUri = `${COVERS_DIR}${trackId}.jpg`;

  let existingLocalUri = null;
  try {
    const infoM4a = await FileSystem.getInfoAsync(audioFileUriM4a);
    if (infoM4a.exists && infoM4a.size > 8000) existingLocalUri = audioFileUriM4a;
    if (!existingLocalUri) {
      const infoMp3 = await FileSystem.getInfoAsync(audioFileUriMp3);
      if (infoMp3.exists && infoMp3.size > 8000) existingLocalUri = audioFileUriMp3;
    }
  } catch {}

  let audioFileUri = existingLocalUri || audioFileUriMp3;

  if (existingLocalUri) {
    if (onProgress) onProgress(100);
    const existing = await getDownloadedTracks();
    const isQ = Boolean(
      track.isQuran === true ||
      track.isQuran === 'true' ||
      track.category === 'quran' ||
      track.contentType === 'quran' ||
      isQuranContent(track)
    );
    const isP = !isQ && Boolean(
      track.isPodcast === true ||
      track.isPodcast === 'true' ||
      track.contentType === 'podcast' ||
      isPodcastContent(track)
    );
    const detectedCategory = isQ ? 'quran' : (isP ? getPodcastCategory(track) : (track.category === 'quran' ? 'quran' : (track.category || 'music')));
    const record = {
      ...track,
      id: trackId,
      _id: trackId,
      title: cleanTitle,
      artist: cleanArtist,
      album: cleanAlbum,
      source: 'Rivo',
      localAudioUri: existingLocalUri,
      nativeAudioUri: existingLocalUri,
      audioUrl: existingLocalUri,
      isDownloaded: true,
      downloaded: true,
      isQuran: isQ,
      isPodcast: isP,
      category: detectedCategory,
      contentType: isQ ? 'quran' : (isP ? 'podcast' : 'music'),
      downloadedAt: new Date().toISOString(),
    };
    const cleaned = deduplicateTrackList([record, ...existing]);
    await saveDownloadedTracks(cleaned);
    return record;
  }

  // Multi-tier audio stream resolution & download with status validation
  emitProgress(15);

  const downloadHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  const toAbsoluteUrl = (raw) => {
    if (!raw || typeof raw !== 'string') return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('/')) {
      const base = String(API_BASE_URL || '').replace(/\/+$/, '');
      return `${base}${trimmed}`;
    }
    return trimmed;
  };

  const isYouTubeWatchOrUnsupported = (u) => {
    if (!u || typeof u !== 'string') return true;
    const lower = u.toLowerCase();
    return (
      lower.includes('youtube.com/watch') ||
      lower.includes('youtu.be/') ||
      lower.includes('soundcloud.com') ||
      lower.includes('example.com') ||
      lower.includes('freesound.org')
    );
  };

  const isDirectNonYouTubeUrl = (raw) => {
    const abs = toAbsoluteUrl(raw);
    if (!abs || (!abs.startsWith('http://') && !abs.startsWith('https://'))) return false;
    const lower = abs.toLowerCase();
    if (lower.includes('/uploads/cloud/') || lower.includes('/uploads/')) return true;
    if (
      lower.includes('youtube.com') ||
      lower.includes('youtu.be') ||
      lower.includes('soundcloud.com') ||
      lower.includes('example.com') ||
      lower.includes('freesound.org')
    ) {
      return false;
    }
    return true;
  };

  const getHeaderCI = (headersObj, name) => {
    if (!headersObj || typeof headersObj !== 'object') return '';
    const target = name.toLowerCase();
    for (const [k, v] of Object.entries(headersObj)) {
      if (String(k).toLowerCase() === target) return String(v || '');
    }
    return '';
  };

  const attemptedUrls = new Set();

  const tryDownloadCandidate = async (url) => {
    const targetUrl = toAbsoluteUrl(url);
    if (!targetUrl || (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://'))) return null;
    if (isYouTubeWatchOrUnsupported(targetUrl)) return null;
    if (attemptedUrls.has(targetUrl)) return null;
    attemptedUrls.add(targetUrl);

    const isM4aHint = targetUrl.includes('.m4a') || targetUrl.includes('mime=audio%2Fmp4') || targetUrl.includes('audio/mp4');
    const destUri = isM4aHint ? audioFileUriM4a : audioFileUriMp3;

    try {
      const dlRes = await FileSystem.downloadAsync(targetUrl, destUri, {
        headers: downloadHeaders,
      });
      if (dlRes && dlRes.status && (dlRes.status < 200 || dlRes.status >= 300)) {
        await FileSystem.deleteAsync(destUri, { idempotent: true }).catch(() => {});
        return null;
      }
      const contentType = getHeaderCI(dlRes?.headers, 'content-type').toLowerCase();
      const contentDisp = getHeaderCI(dlRes?.headers, 'content-disposition').toLowerCase();
      if (contentType.includes('text/html') || contentType.includes('application/json')) {
        await FileSystem.deleteAsync(destUri, { idempotent: true }).catch(() => {});
        return null;
      }
      const checkInfo = await FileSystem.getInfoAsync(destUri);
      if (checkInfo.exists && checkInfo.size >= 8000) {
        const isActualM4a = isM4aHint || contentType.includes('audio/mp4') || contentType.includes('audio/x-m4a') || contentType.includes('video/mp4') || contentDisp.includes('.m4a');
        if (isActualM4a && destUri !== audioFileUriM4a) {
          try {
            await FileSystem.deleteAsync(audioFileUriM4a, { idempotent: true }).catch(() => {});
            await FileSystem.moveAsync({ from: destUri, to: audioFileUriM4a });
            return { uri: audioFileUriM4a, size: checkInfo.size };
          } catch {}
        }
        return { uri: destUri, size: checkInfo.size };
      }
      await FileSystem.deleteAsync(destUri, { idempotent: true }).catch(() => {});
    } catch {
      await FileSystem.deleteAsync(destUri, { idempotent: true }).catch(() => {});
    }
    return null;
  };

  let downloadedResult = null;
  let lastResolvedUrl = '';

  // 1a. Direct /uploads/cloud/... or non-YouTube HTTP URL (build full ${API_BASE_URL}${track.audioUrl} cleanly)
  if (track.audioUrl && isDirectNonYouTubeUrl(track.audioUrl)) {
    emitProgress(20);
    downloadedResult = await tryDownloadCandidate(track.audioUrl);
  }

  // 1b. Already-resolved playback stream URL (including relative URLs normalized to API_BASE_URL)
  if (!downloadedResult && track.resolvedAudioUrl && typeof track.resolvedAudioUrl === 'string') {
    const absResolved = toAbsoluteUrl(track.resolvedAudioUrl);
    if (absResolved.startsWith('http') && !isYouTubeWatchOrUnsupported(absResolved)) {
      emitProgress(25);
      downloadedResult = await tryDownloadCandidate(absResolved);
    }
  }

  // 2. Fresh stream resolution (only skip if Candidate 1 already attempted that exact URL)
  if (!downloadedResult) {
    emitProgress(35);
    try {
      const freshUrl = await resolveAudioStream({ ...track, isRetry: true, _clearCache: true });
      const absFresh = toAbsoluteUrl(freshUrl);
      if (absFresh) {
        lastResolvedUrl = absFresh;
        if (!attemptedUrls.has(absFresh)) {
          downloadedResult = await tryDownloadCandidate(absFresh);
        }
      }
    } catch {}
  }

  // 3. Fallback to server download endpoint (always attempt if Candidate 1 & 2 failed)
  if (!downloadedResult && API_BASE_URL) {
    emitProgress(50);
    const urlHint = track.audioUrl || (track.youtubeId ? `https://www.youtube.com/watch?v=${track.youtubeId}` : '');
    const srvDlUrl = `${API_BASE_URL}/api/tracks/download?id=${encodeURIComponent(trackId)}&title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}&duration=${encodeURIComponent(track.duration || '')}&url=${encodeURIComponent(urlHint)}`;
    downloadedResult = await tryDownloadCandidate(srvDlUrl);
  }

  // 4. Fallback to server stream proxy if an external stream URL was available
  if (!downloadedResult && API_BASE_URL) {
    emitProgress(65);
    const streamSource = toAbsoluteUrl(lastResolvedUrl || track.resolvedAudioUrl || track.audioUrl || '');
    if (streamSource && streamSource.startsWith('http') && !streamSource.includes(API_BASE_URL) && !isYouTubeWatchOrUnsupported(streamSource)) {
      const proxyUrl = `${API_BASE_URL}/api/tracks/stream-proxy?url=${encodeURIComponent(streamSource)}&title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}`;
      downloadedResult = await tryDownloadCandidate(proxyUrl);
    }
  }

  // 5. Final fallback: standard audioUrl / nativeAudioUri if not yet attempted
  if (!downloadedResult) {
    emitProgress(75);
    const fallbackUrl = toAbsoluteUrl(track.audioUrl || track.nativeAudioUri);
    if (fallbackUrl && !attemptedUrls.has(fallbackUrl)) {
      downloadedResult = await tryDownloadCandidate(fallbackUrl);
    }
  }

  if (!downloadedResult) {
    throw new Error('Could not download audio stream from any available source');
  }

  audioFileUri = downloadedResult.uri;
  const fileSize = downloadedResult.size;

  emitProgress(85);

  // Download cover art
  let localCover = null;
  const rawCover = track.coverUrl || track.cover;
  if (rawCover && typeof rawCover === 'string' && rawCover.startsWith('http')) {
    try {
      await FileSystem.downloadAsync(rawCover, coverFileUri);
      localCover = coverFileUri;
    } catch {}
  }

  // Sync to persistent external directory on Android if available (before async ID3 rewrite)
  if (PERSISTENT_DIR) {
    try {
      const extDst = `${PERSISTENT_DIR}${trackId}.${audioFileUri.endsWith('.m4a') ? 'm4a' : 'mp3'}`;
      await FileSystem.copyAsync({ from: audioFileUri, to: extDst }).catch(() => {});
    } catch {}
  }

  // Non-blocking ID3 tag embedding (skipped automatically for .m4a and Lite Mode)
  embedId3v2TagsToMp3File(audioFileUri, {
    title: cleanTitle,
    artist: cleanArtist,
    album: cleanAlbum,
    lyrics: track.lyrics,
  }).catch(() => {});

  emitProgress(100);

  const existing = await getDownloadedTracks();
  const isQ = Boolean(
    track.isQuran === true ||
    track.isQuran === 'true' ||
    track.category === 'quran' ||
    track.contentType === 'quran' ||
    isQuranContent(track)
  );
  const isP = !isQ && Boolean(
    track.isPodcast === true ||
    track.isPodcast === 'true' ||
    track.contentType === 'podcast' ||
    isPodcastContent(track)
  );
  const detectedCategory = isQ ? 'quran' : (isP ? getPodcastCategory(track) : (track.category === 'quran' ? 'quran' : (track.category || 'music')));
  const record = {
    ...track,
    id: trackId,
    _id: trackId,
    title: cleanTitle,
    artist: cleanArtist,
    album: cleanAlbum,
    source: 'Rivo',
    localAudioUri: audioFileUri,
    nativeAudioUri: audioFileUri,
    audioUrl: audioFileUri,
    coverUrl: localCover || track.coverUrl || track.cover,
    cover: localCover || track.coverUrl || track.cover,
    isDownloaded: true,
    downloaded: true,
    isQuran: isQ,
    isPodcast: isP,
    category: detectedCategory,
    contentType: isQ ? 'quran' : (isP ? 'podcast' : 'music'),
    fileSize: fileSize || 0,
    downloadedAt: new Date().toISOString(),
  };

  const updated = deduplicateTrackList([record, ...existing]);
  await saveDownloadedTracks(updated);
  return record;
};

export const removeDownloadedTrack = async (trackOrId) => {
  if (!trackOrId) return [];
  const targetId = typeof trackOrId === 'object' ? String(trackOrId._id || trackOrId.id) : String(trackOrId);
  const targetKey = typeof trackOrId === 'object' ? getTrackDedupeKey(trackOrId) : '';

  const existing = await getDownloadedTracks();
  const remaining = existing.filter(t => {
    const tId = String(t._id || t.id);
    const tKey = getTrackDedupeKey(t);
    if (targetId && tId === targetId) return false;
    if (targetKey && tKey && tKey === targetKey) return false;
    return true;
  });

  // Delete physical files
  await FileSystem.deleteAsync(`${TRACKS_DIR}${targetId}.mp3`, { idempotent: true }).catch(() => {});
  await FileSystem.deleteAsync(`${TRACKS_DIR}${targetId}.m4a`, { idempotent: true }).catch(() => {});
  await FileSystem.deleteAsync(`${COVERS_DIR}${targetId}.jpg`, { idempotent: true }).catch(() => {});

  await saveDownloadedTracks(remaining);
  return remaining;
};

export const removeDownloadedTracksBatch = async (tracksOrIds = []) => {
  if (!Array.isArray(tracksOrIds) || tracksOrIds.length === 0) {
    return await getDownloadedTracks();
  }

  const idsToDelete = new Set(tracksOrIds.map(item => {
    return typeof item === 'object' && item !== null ? String(item._id || item.id) : String(item);
  }));

  const existing = await getDownloadedTracks();
  const remaining = existing.filter(t => !idsToDelete.has(String(t._id || t.id)));

  for (const id of idsToDelete) {
    await FileSystem.deleteAsync(`${TRACKS_DIR}${id}.mp3`, { idempotent: true }).catch(() => {});
    await FileSystem.deleteAsync(`${TRACKS_DIR}${id}.m4a`, { idempotent: true }).catch(() => {});
    await FileSystem.deleteAsync(`${COVERS_DIR}${id}.jpg`, { idempotent: true }).catch(() => {});
  }

  await saveDownloadedTracks(remaining);
  return remaining;
};
