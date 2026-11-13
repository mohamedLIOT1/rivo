import { InteractionManager, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { isQuranContent } from '../../../utils/quranUtils';
import { isPodcastContent } from '../../utils/podcastUtils';

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
  return () => { listeners.delete(listener); };
};
export const notifyDownloadedTracksChanged = (tracks) => {
  const safeList = deduplicateTrackList(tracks || []);
  for (const listener of listeners) {
    try { listener(safeList); } catch {}
  }
};

let debouncedSaveTimer = null;
let pendingSaveList = null;
let inMemoryDownloadedTracks = null;
let isCommittingSave = false;
let needsRecommitSave = false;

const normalizeFuzzy = (s) => (s || '')
  .toLowerCase()
  .replace(/https?:\/\/\S+/gi, '')
  .replace(/[\[\(]?(?:official|audio|video|lyrics|hd|4k|remastered|remix|clip|prod|prod\..*?|feat\..*?|ft\..*?)[\]\)]?/gi, '')
  .replace(/[/\\?%*:|"<>]/g, '')
  .replace(/[^\p{L}\p{N}\s]/gu, '')
  .trim()
  .replace(/\s+/g, ' ');

/**
 * Synchronous in-memory lookup so online playback never blocks on AsyncStorage or FileSystem checks.
 */
export const findDownloadedTrackFast = (track) => {
  if (!Array.isArray(inMemoryDownloadedTracks)) {
    return { ready: false, match: null };
  }
  if (!track || inMemoryDownloadedTracks.length === 0) {
    return { ready: true, match: null };
  }
  const trackId = String(track._id || track.id || '');
  const dedupeKey = getTrackDedupeKey(track);
  const cleanT = normalizeFuzzy(track.title);
  const cleanA = normalizeFuzzy(track.artist);

  for (let i = 0; i < inMemoryDownloadedTracks.length; i++) {
    const item = inMemoryDownloadedTracks[i];
    if (!item) continue;
    const itemId = String(item._id || item.id || '');
    if (
      (trackId && itemId && itemId === trackId) ||
      (track.youtubeId && item.youtubeId && track.youtubeId === item.youtubeId) ||
      (dedupeKey && getTrackDedupeKey(item) === dedupeKey)
    ) {
      return { ready: true, match: item };
    }

    if (cleanT) {
      const itemT = normalizeFuzzy(item.title);
      const itemA = normalizeFuzzy(item.artist);
      if (itemT && cleanT === itemT && (!cleanA || !itemA || cleanA.includes(itemA) || itemA.includes(cleanA))) {
        return { ready: true, match: item };
      }
    }
  }
  return { ready: true, match: null };
};

export const commitToStorageAndManifest = async (list) => {
  if (isCommittingSave) {
    needsRecommitSave = true;
    return;
  }
  isCommittingSave = true;
  try {
    const jsonStr = JSON.stringify(list || []);
    await AsyncStorage.setItem(STORAGE_KEY, jsonStr).catch(() => {});

    try {
      const parentDir = `${FileSystem.documentDirectory}rivo_tracks/`;
      await FileSystem.makeDirectoryAsync(parentDir, { intermediates: true }).catch(() => {});
      await FileSystem.writeAsStringAsync(MANIFEST_FILE, jsonStr).catch(() => {});
    } catch {}

    if (PERSISTENT_DIR && PERSISTENT_MANIFEST) {
      try {
        await FileSystem.makeDirectoryAsync(PERSISTENT_DIR, { intermediates: true }).catch(() => {});
        await FileSystem.writeAsStringAsync(PERSISTENT_MANIFEST, jsonStr).catch(() => {});
      } catch {}
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

  const candidateLists = [];

  // 1. Primary current v3 storage
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) candidateLists.push(parsed);
    }
  } catch {}

  // 2. Scan all legacy keys to rescue older downloads
  for (const legacyKey of LEGACY_STORAGE_KEYS) {
    try {
      const legRaw = await AsyncStorage.getItem(legacyKey);
      if (legRaw) {
        const parsed = JSON.parse(legRaw);
        if (Array.isArray(parsed) && parsed.length > 0) candidateLists.push(parsed);
      }
    } catch {}
  }

  // 3. Scan filesystem manifest files
  try {
    const fileInfo = await FileSystem.getInfoAsync(MANIFEST_FILE);
    if (fileInfo.exists) {
      const manRaw = await FileSystem.readAsStringAsync(MANIFEST_FILE);
      if (manRaw) {
        const parsed = JSON.parse(manRaw);
        if (Array.isArray(parsed) && parsed.length > 0) candidateLists.push(parsed);
      }
    }
  } catch {}

  if (PERSISTENT_MANIFEST) {
    try {
      const pInfo = await FileSystem.getInfoAsync(PERSISTENT_MANIFEST);
      if (pInfo.exists) {
        const pRaw = await FileSystem.readAsStringAsync(PERSISTENT_MANIFEST);
        if (pRaw) {
          const parsed = JSON.parse(pRaw);
          if (Array.isArray(parsed) && parsed.length > 0) candidateLists.push(parsed);
        }
      }
    } catch {}
  }

  const list = deduplicateTrackList(candidateLists.flat());
  const primaryCount = candidateLists[0] ? candidateLists[0].length : 0;
  let hasClassificationUpdates = list.length > primaryCount;
  const cleaned = deduplicateTrackList(list).map(t => {
    if (!t) return t;
    const isQ = Boolean(
      t.isQuran === true ||
      t.isQuran === 'true' ||
      t.category === 'quran' ||
      t.contentType === 'quran' ||
      isQuranContent(t)
    );
    const isP = !isQ && Boolean(
      t.isPodcast === true ||
      t.isPodcast === 'true' ||
      t.contentType === 'podcast' ||
      isPodcastContent(t)
    );

    let updated = t;
    if (isQ && (!t.isQuran || t.category !== 'quran' || t.contentType !== 'quran')) {
      updated = {
        ...updated,
        isQuran: true,
        category: 'quran',
        contentType: 'quran',
      };
      hasClassificationUpdates = true;
    } else if (isP && (!t.isPodcast || t.contentType !== 'podcast')) {
      updated = {
        ...updated,
        isPodcast: true,
        category: t.category && t.category !== 'music' ? t.category : 'podcast',
        contentType: 'podcast',
      };
      hasClassificationUpdates = true;
    }

    return {
      ...updated,
      localAudioUri: reanchorDocumentUri(updated.localAudioUri),
      nativeAudioUri: reanchorDocumentUri(updated.nativeAudioUri),
      audioUrl: reanchorDocumentUri(updated.audioUrl),
    };
  });

  if (hasClassificationUpdates) {
    saveDownloadedTracks(cleaned);
  }

  inMemoryDownloadedTracks = cleaned;
  return cleaned;
};

export const isTrackDownloaded = async (trackIdOrObj) => {
  if (!trackIdOrObj) return false;
  const list = await getDownloadedTracks();
  if (typeof trackIdOrObj === 'object') {
    const tid = String(trackIdOrObj._id || trackIdOrObj.id || '');
    const ytId = String(trackIdOrObj.youtubeId || '');
    const key = getTrackDedupeKey(trackIdOrObj);
    const cleanT = normalizeFuzzy(trackIdOrObj.title);
    const cleanA = normalizeFuzzy(trackIdOrObj.artist);
    return list.some(t => {
      const did = String(t._id || t.id || '');
      if (tid && did && did === tid) return true;
      if (ytId && t.youtubeId && t.youtubeId === ytId) return true;
      if (key && getTrackDedupeKey(t) === key) return true;
      if (cleanT) {
        const itemT = normalizeFuzzy(t.title);
        const itemA = normalizeFuzzy(t.artist);
        if (itemT && cleanT === itemT && (!cleanA || !itemA || cleanA.includes(itemA) || itemA.includes(cleanA))) return true;
      }
      return false;
    });
  }
  const sId = String(trackIdOrObj);
  return list.some(t => String(t._id || t.id) === sId || t.youtubeId === sId || getTrackDedupeKey(t) === sId);
};
