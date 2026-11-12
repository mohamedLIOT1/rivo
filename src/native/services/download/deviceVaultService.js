import { Platform, Share } from 'react-native';
import * as FileSystem from 'expo-file-system';
import {
  getDownloadedTracks,
  saveDownloadedTracks,
  deduplicateTrackList,
  getTrackDedupeKey,
  reanchorDocumentUri,
} from './storageManifestService';
import { extractId3Metadata, parseAudioMetadataFromFilename } from './id3TagService';
import { isQuranContent } from '../../../utils/quranUtils';
import { isPodcastContent, getPodcastCategory } from '../../utils/podcastUtils';

export const TRACKS_DIR = `${FileSystem.documentDirectory}rivo_tracks/`;
export const COVERS_DIR = `${FileSystem.documentDirectory}rivo_covers/`;

export const ensureDirs = async () => {
  try {
    await FileSystem.makeDirectoryAsync(TRACKS_DIR, { intermediates: true }).catch(() => {});
    await FileSystem.makeDirectoryAsync(COVERS_DIR, { intermediates: true }).catch(() => {});
  } catch {}
};

export const updateDownloadedTrackLyrics = async (trackIdOrObj, lyrics) => {
  if (!trackIdOrObj) return;
  const idStr = (typeof trackIdOrObj === 'object' && trackIdOrObj !== null)
    ? String(trackIdOrObj._id || trackIdOrObj.id || '')
    : String(trackIdOrObj);
  const targetKey = (typeof trackIdOrObj === 'object' && trackIdOrObj !== null)
    ? getTrackDedupeKey(trackIdOrObj)
    : '';

  const existing = await getDownloadedTracks();
  let found = false;
  const updated = existing.map(t => {
    if (!t) return t;
    const tid = String(t._id || t.id);
    const tKey = getTrackDedupeKey(t);
    if ((idStr && tid === idStr) || (targetKey && tKey && tKey === targetKey)) {
      found = true;
      return {
        ...t,
        lyrics,
        rawLyrics: typeof lyrics === 'string' ? lyrics : (t.rawLyrics || null)
      };
    }
    return t;
  });

  if (found) {
    const cleaned = deduplicateTrackList(updated);
    await saveDownloadedTracks(cleaned);
  }
};

export const exportTrackAudioFile = async (track) => {
  if (!track) throw new Error('No track provided');
  const res = await exportTracksBatch([track]);
  if (res?.cancelled) return { success: false, cancelled: true };
  if (res?.skippedCount > 0) {
    return { success: true, skipped: true, method: 'already_exists' };
  }
  return { success: true, exported: true, method: 'saf' };
};

export const exportTracksBatch = async (tracks = [], { onProgress } = {}) => {
  if (!Array.isArray(tracks) || tracks.length === 0) return { success: false, count: 0 };

  const validTracks = [];
  for (const t of tracks) {
    if (!t) continue;
    const trackId = String(t._id || t.id || '');
    const rawUri = t.localAudioUri || t.nativeAudioUri || t.audioUrl;
    let sourceUri = reanchorDocumentUri(rawUri);

    if (sourceUri && typeof sourceUri === 'string' && sourceUri.startsWith('file://')) {
      const info = await FileSystem.getInfoAsync(sourceUri).catch(() => null);
      if (!info || !info.exists || info.size < 1024) sourceUri = null;
    } else {
      sourceUri = null;
    }

    if (!sourceUri) {
      const candidates = [
        `${TRACKS_DIR}${trackId}.mp3`,
        `${TRACKS_DIR}${trackId}.m4a`,
        `${TRACKS_DIR}${trackId}`,
      ];
      for (const cand of candidates) {
        const info = await FileSystem.getInfoAsync(cand).catch(() => null);
        if (info && info.exists && info.size > 1000) {
          sourceUri = cand;
          break;
        }
      }
    }

    if (sourceUri) {
      const cleanTitle = (t.title || 'Track').replace(/[/\\?%*:|"<>]/g, '_').trim();
      const cleanArtist = (t.artist || 'Rivo').replace(/[/\\?%*:|"<>]/g, '_').trim();
      const ext = sourceUri.endsWith('.m4a') ? 'm4a' : 'mp3';
      const cleanFileName = `${cleanTitle} - ${cleanArtist}.${ext}`;
      validTracks.push({ track: t, sourceUri, cleanFileName, ext });
    }
  }

  if (validTracks.length === 0) {
    throw new Error('No valid offline audio files found on disk for selected tracks.');
  }

  if (Platform.OS === 'ios') {
    const urls = [];
    for (const item of validTracks) {
      const targetUri = `${FileSystem.cacheDirectory}${item.cleanFileName}`;
      try {
        await FileSystem.copyAsync({ from: item.sourceUri, to: targetUri });
      } catch {
        await FileSystem.deleteAsync(targetUri, { idempotent: true }).catch(() => {});
        await FileSystem.copyAsync({ from: item.sourceUri, to: targetUri });
      }
      urls.push(targetUri);
    }
    if (urls.length > 0) {
      await Share.share({ url: urls[0], urls, title: 'Export Audio Files' });
    }
    return { success: true, exportedCount: urls.length, skippedCount: 0, total: validTracks.length };
  }

  // Android: StorageAccessFramework batch export with deduplication
  if (!FileSystem.StorageAccessFramework) {
    throw new Error('StorageAccessFramework is not supported on this platform');
  }

  const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions || !permissions.granted) {
    return { success: false, cancelled: true };
  }

  const directoryUri = permissions.directoryUri;
  let existingNames = new Set();
  try {
    const existingEntries = await FileSystem.StorageAccessFramework.readDirectoryAsync(directoryUri);
    existingNames = new Set(
      (existingEntries || []).map((uri) => {
        try {
          const decoded = decodeURIComponent(uri);
          const fn = decoded.split('/').pop()?.replace(/^.*:/, '').trim().toLowerCase();
          return fn;
        } catch {
          return '';
        }
      }).filter(Boolean)
    );
  } catch {}

  let exportedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < validTracks.length; i++) {
    const item = validTracks[i];
    const normName = item.cleanFileName.toLowerCase();

    // Deduplication check: skip if file already exists in target directory
    if (existingNames.has(normName)) {
      skippedCount++;
      if (typeof onProgress === 'function') onProgress(i + 1, validTracks.length);
      continue;
    }

    try {
      const mimeType = item.ext === 'm4a' ? 'audio/mp4' : 'audio/mpeg';
      const newFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
        directoryUri,
        item.cleanFileName,
        mimeType
      );

      const targetCacheUri = `${FileSystem.cacheDirectory}${item.cleanFileName}`;
      try {
        await FileSystem.copyAsync({ from: item.sourceUri, to: targetCacheUri });
      } catch {
        await FileSystem.deleteAsync(targetCacheUri, { idempotent: true }).catch(() => {});
        await FileSystem.copyAsync({ from: item.sourceUri, to: targetCacheUri });
      }

      try {
        await FileSystem.copyAsync({ from: targetCacheUri, to: newFileUri });
      } catch {
        const base64 = await FileSystem.readAsStringAsync(targetCacheUri, { encoding: FileSystem.EncodingType.Base64 });
        await FileSystem.writeAsStringAsync(newFileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
      }

      existingNames.add(normName);
      exportedCount++;
    } catch (err) {
      console.warn('[VaultExport] Failed to export item:', item.cleanFileName, err);
    }

    if (typeof onProgress === 'function') {
      onProgress(i + 1, validTracks.length);
    }
  }

  return {
    success: true,
    exportedCount,
    skippedCount,
    total: validTracks.length,
  };
};

export const getStorageLocationInfo = async () => {
  await ensureDirs();
  let totalBytes = 0;
  let fileCount = 0;

  try {
    const files = await FileSystem.readDirectoryAsync(TRACKS_DIR);
    fileCount = files.length;
    for (const file of files) {
      const info = await FileSystem.getInfoAsync(`${TRACKS_DIR}${file}`);
      if (info.exists && info.size) {
        totalBytes += info.size;
      }
    }
  } catch {}

  const mb = (totalBytes / (1024 * 1024)).toFixed(1);
  return {
    path: TRACKS_DIR,
    totalBytes,
    totalMegabytes: mb,
    fileCount,
  };
};

export const scanOfflineVault = async () => {
  await ensureDirs();
  const existing = await getDownloadedTracks();
  const existingUris = new Set(existing.map(t => t.localAudioUri || t.nativeAudioUri || t.audioUrl));
  const existingIds = new Set(existing.map(t => String(t._id || t.id)));
  const existingKeys = new Set(existing.map(getTrackDedupeKey).filter(Boolean));

  let newlyFound = 0;
  const newTracks = [];

  try {
    const tFiles = await FileSystem.readDirectoryAsync(TRACKS_DIR);
    for (const f of tFiles) {
      if (!/\.(mp3|m4a|wav|aac|flac|ogg)$/i.test(f)) continue;
      const fileUri = `${TRACKS_DIR}${f}`;
      const baseId = f.replace(/\.(mp3|m4a|wav|aac|flac|ogg)$/i, '');
      if (existingIds.has(baseId) || existingUris.has(fileUri)) continue;

      const info = await FileSystem.getInfoAsync(fileUri);
      if (!info.exists || info.size < 5000) continue;

      const id3Meta = await extractId3Metadata(fileUri, baseId);
      const { title: fTitle, artist: fArtist } = parseAudioMetadataFromFilename(f);
      const title = id3Meta.title || fTitle || 'Offline Track';
      const artist = id3Meta.artist || fArtist || 'Offline Artist';
      const album = id3Meta.album || 'Offline Vault';

      const dedupeKey = getTrackDedupeKey({ title, artist, id: baseId });
      if (dedupeKey && existingKeys.has(dedupeKey)) continue;

      const coverUri = `${COVERS_DIR}${baseId}.jpg`;
      const coverInfo = await FileSystem.getInfoAsync(coverUri).catch(() => ({ exists: false }));
      const coverUrl = id3Meta.coverUrl || (coverInfo.exists ? coverUri : null);

      const isQ = Boolean(
        id3Meta.genre === 'Quran' ||
        id3Meta.isQuran === true ||
        isQuranContent({ title, artist, album, genre: id3Meta.genre })
      );
      const isP = !isQ && Boolean(
        id3Meta.genre === 'Podcast' ||
        id3Meta.isPodcast === true ||
        isPodcastContent({ title, artist, album, genre: id3Meta.genre })
      );
      const detectedCategory = isQ ? 'quran' : (isP ? getPodcastCategory({ title, artist, album, genre: id3Meta.genre }) : 'music');

      const newTrack = {
        id: baseId,
        _id: baseId,
        title,
        artist,
        album,
        source: 'Vault',
        localAudioUri: fileUri,
        nativeAudioUri: fileUri,
        audioUrl: fileUri,
        coverUrl,
        cover: coverUrl,
        lyrics: id3Meta.lyrics || null,
        isDownloaded: true,
        downloaded: true,
        isLocalImport: true,
        isQuran: isQ,
        isPodcast: isP,
        category: detectedCategory,
        contentType: isQ ? 'quran' : (isP ? 'podcast' : 'music'),
        downloadedAt: new Date().toISOString(),
        fileSize: info.size,
      };

      newTracks.push(newTrack);
      existingIds.add(baseId);
      existingUris.add(fileUri);
      if (dedupeKey) existingKeys.add(dedupeKey);
      newlyFound++;
    }
  } catch {}

  if (newlyFound > 0) {
    const merged = deduplicateTrackList([...existing, ...newTracks]);
    await saveDownloadedTracks(merged);
    return { newlyFound, total: merged.length, tracks: merged };
  }

  return { newlyFound: 0, total: existing.length, tracks: existing };
};

export const importAudioFolderFromDevice = async () => {
  return scanOfflineVault();
};

export const importLocalAudioFiles = async () => {
  return scanOfflineVault();
};
