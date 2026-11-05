import { InteractionManager, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

export const STORAGE_KEY = '@rivo_downloaded_tracks_v3';
export const LEGACY_STORAGE_KEYS = [
  '@rivo_downloaded_tracks_v2',
  '@rivo_downloaded_tracks',
  'downloaded_tracks',
  '@downloaded_tracks',
  '@rivo_offline_tracks_v1',
  '@rivo_cached_tracks',
];

export const MANIFEST_FILE = `${FileSystem.documentDirectory}rivo_tracks/manifest.json`;
export const PERSISTENT_DIR = Platform.OS === 'android' ? `${FileSystem.documentDirectory}rivo_vault/` : null;
export const PERSISTENT_MANIFEST = PERSISTENT_DIR ? `${PERSISTENT_DIR}manifest.json` : null;

export const getTrackDedupeKey = (t) => {
  if (!t || typeof t !== 'object') return '';
  const clean = (s) => (s || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').trim();
  const cTitle = clean(t.title);
  const cArtist = clean(t.artist);
  if (cTitle && cArtist) return `${cTitle}___${cArtist}`;
  if (t.youtubeId) return `yt_${t.youtubeId}`;
  return String(t._id || t.id || '');
};

export const deduplicateTrackList = (list) => {
  // Guard against non-array input
  if (!Array.isArray(list)) return [];
  const seenIds = new Set();
  const seenKeys = new Set();
  const result = [];

  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    if (!t) continue;
    const tId = String(t._id || t.id || '');
    const dKey = getTrackDedupeKey(t);

    if (tId && seenIds.has(tId)) continue;
    if (dKey && seenKeys.has(dKey)) continue;

    if (tId) seenIds.add(tId);
    if (dKey) seenKeys.add(dKey);
    result.push(t);
  }

  return result;
};

export const listeners = new Set();

export const subscribeToDownloadedTracks = (listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const notifyDownloadedTracksChanged = (tracks) => {
  const safeList = deduplicateTrackList(tracks || []);
  for (const listener of listeners) {
    try {
      listener(safeList);
    } catch {}
  }
};

let debouncedSaveTimer = null;
let pendingSaveList = null;
let inMemoryDownloadedTracks = null;
let isCommittingSave = false;
let needsRecommitSave = false;

export const commitToStorageAndManifest = async (list) => {
  if (isCommittingSave) {
    needsRecommitSave = true;
    return;
  }
  isCommittingSave = true;
  try {
    const jsonStr = JSON.stringify(list || []);
    await AsyncStorage.setItem(STORAGE_KEY, jsonStr).catch(() => {});
    await FileSystem.writeAsStringAsync(MANIFEST_FILE, jsonStr).catch(() => {});
    if (PERSISTENT_DIR && PERSISTENT_MANIFEST) {
      await FileSystem.writeAsStringAsync(PERSISTENT_MANIFEST, jsonStr).catch(() => {});
    }
  } catch (e) {
    console.warn('[downloadManager] commitToStorageAndManifest error:', e.message);
  } finally {
    isCommittingSave = false;
    if (needsRecommitSave && pendingSaveList !== null) {
      needsRecommitSave = false;
      const nextList = pendingSaveList;
      pendingSaveList = null;
      commitToStorageAndManifest(nextList);
    }
  }
};

export const flushDownloadedTracksSave = async () => {
  if (debouncedSaveTimer) {
    clearTimeout(debouncedSaveTimer);
    debouncedSaveTimer = null;
  }
  if (pendingSaveList !== null) {
    const toSave = pendingSaveList;
    pendingSaveList = null;
    await commitToStorageAndManifest(toSave);
  }
};

export const saveDownloadedTracks = async (list, { immediate = false } = {}) => {
  const cleaned = deduplicateTrackList(list || []);
  inMemoryDownloadedTracks = cleaned;
  notifyDownloadedTracksChanged(cleaned);
  pendingSaveList = cleaned;

  if (immediate) {
    return await flushDownloadedTracksSave();
  }

  if (debouncedSaveTimer) {
    clearTimeout(debouncedSaveTimer);
  }
  // Minimum 3.5s debouncing to prevent UI freezes on the main JS thread
  debouncedSaveTimer = setTimeout(() => {
    debouncedSaveTimer = null;
    if (pendingSaveList !== null) {
      const toSave = pendingSaveList;
      pendingSaveList = null;
      if (InteractionManager && typeof InteractionManager.runAfterInteractions === 'function') {
        InteractionManager.runAfterInteractions(() => {
          commitToStorageAndManifest(toSave);
        });
      } else {
        commitToStorageAndManifest(toSave);
      }
    }
  }, 3500);
};

export const reanchorDocumentUri = (uri) => {
  if (!uri || typeof uri !== 'string') return uri;
  // If remote URL or data URI, do not modify
  if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('data:')) return uri;

  const docDir = FileSystem.documentDirectory;
  if (!docDir) return uri;
  const baseDir = docDir.endsWith('/') ? docDir : `${docDir}/`;

  // 1. Check for standard Rivo subdirectories (rivo_tracks, rivo_covers, rivo_vault)
  const rivoTrackMatch = uri.match(/rivo_tracks\/(.+)$/);
  if (rivoTrackMatch && rivoTrackMatch[1]) {
    return `${baseDir}rivo_tracks/${rivoTrackMatch[1].replace(/^\/+/, '')}`;
  }

  const rivoCoverMatch = uri.match(/rivo_covers\/(.+)$/);
  if (rivoCoverMatch && rivoCoverMatch[1]) {
    return `${baseDir}rivo_covers/${rivoCoverMatch[1].replace(/^\/+/, '')}`;
  }

  const rivoVaultMatch = uri.match(/rivo_vault\/(.+)$/);
  if (rivoVaultMatch && rivoVaultMatch[1]) {
    return `${baseDir}rivo_vault/${rivoVaultMatch[1].replace(/^\/+/, '')}`;
  }

  // 2. Check for iOS /Documents/ path
  if (uri.includes('/Documents/')) {
    const rel = uri.split('/Documents/')[1].replace(/^\/+/, '');
    return `${baseDir}${rel}`;
  }

  // 3. Check for Android /files/ path
  if (uri.includes('/files/')) {
    const rel = uri.split('/files/')[1].replace(/^\/+/, '');
    return `${baseDir}${rel}`;
  }

  // 4. If it's a relative path without leading slash or protocol
  if (!uri.startsWith('file://') && !uri.startsWith('/')) {
    return `${baseDir}${uri}`;
  }

  return uri;
};

export const updateTrackDownloadRecord = async (trackIdOrObj, updates = {}) => {
  if (!trackIdOrObj || !updates || Object.keys(updates).length === 0) return;
  const targetId = typeof trackIdOrObj === 'object' ? String(trackIdOrObj._id || trackIdOrObj.id || '') : String(trackIdOrObj);
  const targetKey = typeof trackIdOrObj === 'object' ? getTrackDedupeKey(trackIdOrObj) : '';

  const existing = await getDownloadedTracks();
  let found = false;
  const updated = existing.map(t => {
    if (!t) return t;
    const tId = String(t._id || t.id || '');
    const tKey = getTrackDedupeKey(t);
    if ((targetId && tId === targetId) || (targetKey && tKey && tKey === targetKey)) {
      found = true;
      return { ...t, ...updates };
    }
    return t;
  });

  if (found) {
    const cleaned = deduplicateTrackList(updated);
    await saveDownloadedTracks(cleaned, { immediate: true });
  }
};

export const getDownloadedTracks = async (forceRefresh = false) => {
  if (inMemoryDownloadedTracks && !forceRefresh) {
    return inMemoryDownloadedTracks;
  }

  let raw = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);

  if (!raw) {
    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      try {
        const legRaw = await AsyncStorage.getItem(legacyKey);
        if (legRaw) {
          raw = legRaw;
          break;
        }
      } catch {}
    }
  }

  if (!raw) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(MANIFEST_FILE);
      if (fileInfo.exists) {
        raw = await FileSystem.readAsStringAsync(MANIFEST_FILE);
      }
    } catch {}
  }

  let list = [];
  try {
    list = raw ? JSON.parse(raw) : [];
  } catch {
    list = [];
  }

  const cleaned = deduplicateTrackList(list).map(t => ({
    ...t,
    localAudioUri: reanchorDocumentUri(t.localAudioUri),
    nativeAudioUri: reanchorDocumentUri(t.nativeAudioUri),
    audioUrl: reanchorDocumentUri(t.audioUrl),
  }));

  inMemoryDownloadedTracks = cleaned;
  return cleaned;
};

export const isTrackDownloaded = async (trackId) => {
  if (!trackId) return false;
  const sId = String(trackId);
  const list = await getDownloadedTracks();
  return list.some(t => String(t._id || t.id) === sId);
};
