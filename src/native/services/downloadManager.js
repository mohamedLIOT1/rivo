import * as FileSystem from 'expo-file-system';
import { API_BASE_URL } from '../config';
import { resolveAudioStream } from './youtubeResolver';
import { parseLrcLyrics } from '../../utils/lrcParser';

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
  embedId3v2TagsToMp3File,
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
import { embedId3v2TagsToMp3File } from './download/id3TagService';
import { TRACKS_DIR, COVERS_DIR, ensureDirs } from './download/deviceVaultService';

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

  const trackId = String(track._id || track.id);
  const audioFileUriMp3 = `${TRACKS_DIR}${trackId}.mp3`;
  const audioFileUriM4a = `${TRACKS_DIR}${trackId}.m4a`;
  const coverFileUri = `${COVERS_DIR}${trackId}.jpg`;
  const cleanTitle = (track.title || 'Track').replace(/[/\\?%*:|"<>]/g, '').trim();
  const cleanArtist = (track.artist || 'Artist').replace(/[/\\?%*:|"<>]/g, '').trim();
  const cleanAlbum = (track.album || cleanTitle || 'Single').replace(/[/\\?%*:|"<>]/g, '').trim();

  let existingLocalUri = null;
  try {
    const infoM4a = await FileSystem.getInfoAsync(audioFileUriM4a);
    if (infoM4a.exists && infoM4a.size > 1000) existingLocalUri = audioFileUriM4a;
    if (!existingLocalUri) {
      const infoMp3 = await FileSystem.getInfoAsync(audioFileUriMp3);
      if (infoMp3.exists && infoMp3.size > 1000) existingLocalUri = audioFileUriMp3;
    }
  } catch {}

  let audioFileUri = existingLocalUri || audioFileUriMp3;

  if (existingLocalUri) {
    if (onProgress) onProgress(100);
    const existing = await getDownloadedTracks();
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
      downloadedAt: new Date().toISOString(),
    };
    const cleaned = deduplicateTrackList([record, ...existing]);
    await saveDownloadedTracks(cleaned);
    return record;
  }

  // Resolve audio stream
  emitProgress(15);
  let streamUrl = track.resolvedAudioUrl || track.audioUrl || track.nativeAudioUri;
  if (!streamUrl || (!streamUrl.startsWith('http') && !streamUrl.startsWith('/'))) {
    streamUrl = await resolveAudioStream(track);
  }

  if (streamUrl && streamUrl.startsWith('/')) {
    streamUrl = `${API_BASE_URL}${streamUrl}`;
  }

  if (!streamUrl) {
    throw new Error('Could not resolve audio stream for download');
  }

  audioFileUri = (streamUrl.includes('.m4a') || streamUrl.includes('mime=audio%2Fmp4'))
    ? audioFileUriM4a
    : audioFileUriMp3;

  emitProgress(30);

  // Download audio binary
  const dlRes = await FileSystem.downloadAsync(
    streamUrl,
    audioFileUri
  );

  // Crucial boundary check: validate downloaded file size > 0
  const check = await FileSystem.getInfoAsync(audioFileUri);
  if (!check.exists || check.size <= 0 || check.size < 1000) {
    await FileSystem.deleteAsync(audioFileUri, { idempotent: true }).catch(() => {});
    throw new Error('Downloaded audio file is empty or corrupt (size <= 0)');
  }

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

  // Non-blocking ID3 tag embedding
  await embedId3v2TagsToMp3File(audioFileUri, {
    title: cleanTitle,
    artist: cleanArtist,
    album: cleanAlbum,
    lyrics: track.lyrics,
  }).catch(() => {});

  // Sync to persistent external directory on Android if available
  if (PERSISTENT_DIR) {
    try {
      const extDst = `${PERSISTENT_DIR}${trackId}.${audioFileUri.endsWith('.m4a') ? 'm4a' : 'mp3'}`;
      await FileSystem.copyAsync({ from: audioFileUri, to: extDst }).catch(() => {});
    } catch {}
  }

  emitProgress(100);

  const existing = await getDownloadedTracks();
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
    fileSize: check.size,
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

  await saveDownloadedTracks(remaining, { immediate: true });
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

  await saveDownloadedTracks(remaining, { immediate: true });
  return remaining;
};
