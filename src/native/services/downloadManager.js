import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Share } from 'react-native';
import {
  resolveAudioStream,
  resolveClientSideYouTubeStream,
  searchYouTubeClientSide,
  extractYouTubeId,
  getStreamFromCache,
  getStreamDurationFromCache,
  clearStreamCache,
} from './youtubeResolver';
import { parseLrcLyrics } from '../../utils/lrcParser';
import { API_BASE_URL } from '../config';

const sanitizeDuration = (val, fallback = 210) => {
  if (val === undefined || val === null) return fallback;
  const num = Number(val);
  if (!isFinite(num) || isNaN(num) || num <= 0) return fallback;
  if (num > 86400) {
    const inSec = Math.round(num / 1000);
    if (inSec > 0 && inSec <= 86400) return inSec;
    return fallback;
  }
  return Math.round(num);
};

export const getTrackDedupeKey = (t) => {
  if (!t) return '';
  const cleanTitle = String(t.title || '')
    .toLowerCase()
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const cleanArtist = String(t.artist || '')
    .toLowerCase()
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return `${cleanTitle}___${cleanArtist}`;
};

export const deduplicateTrackList = (list) => {
  if (!Array.isArray(list)) return [];
  const map = new Map();
  for (const t of list) {
    if (!t) continue;
    const idKey = String(t._id || t.id || '');
    const titleKey = getTrackDedupeKey(t);
    const existingKey = map.has(idKey) ? idKey : (titleKey && map.has(titleKey) ? titleKey : null);
    if (!existingKey) {
      if (idKey) map.set(idKey, t);
      if (titleKey) map.set(titleKey, t);
    } else {
      const existing = map.get(existingKey);
      const hasLocalAudio = t.localAudioUri || t.nativeAudioUri;
      const merged = {
        ...existing,
        ...t,
        localAudioUri: t.localAudioUri || existing.localAudioUri,
        nativeAudioUri: t.nativeAudioUri || existing.nativeAudioUri,
        audioUrl: t.audioUrl || existing.audioUrl,
        downloaded: Boolean(existing.downloaded || t.downloaded || hasLocalAudio),
        isDownloaded: Boolean(existing.isDownloaded || t.isDownloaded || hasLocalAudio),
        lyrics: (Array.isArray(t.lyrics) && t.lyrics.length > 0) ? t.lyrics : existing.lyrics,
        coverUrl: t.coverUrl || existing.coverUrl,
        cover: t.cover || existing.cover,
      };
      if (idKey) map.set(idKey, merged);
      if (titleKey) map.set(titleKey, merged);
    }
  }
  return Array.from(new Set(map.values())).filter(Boolean);
};

const TRACKS_DIR = `${FileSystem.documentDirectory}rivo_tracks/`;
// On iOS, isolate covers in cacheDirectory so loose images never clutter the user's Files app:
const COVERS_DIR = Platform.OS === 'ios'
  ? `${FileSystem.cacheDirectory}rivo_covers/`
  : `${FileSystem.documentDirectory}rivo_covers/`;
const MANIFEST_FILE = `${TRACKS_DIR}manifest.json`;
const STORAGE_KEY = '@rivo_offline_tracks_v2';

// Dedicated persistent external music vault (persists across full app uninstalls & reinstalls)
const PERSISTENT_DIR = null;
const PERSISTENT_MANIFEST = null;

const LEGACY_STORAGE_KEYS = [
  '@rivo_offline_tracks_v2',
  '@rivo_offline_tracks',
  '@liofy_offline_tracks_v2',
  '@liofy_offline_tracks',
  '@offline_tracks',
];

const LEGACY_TRACKS_DIR = `${FileSystem.documentDirectory}liofy_tracks/`;
const LEGACY_COVERS_DIR = `${FileSystem.documentDirectory}liofy_covers/`;

const ensureDirs = async () => {
  try {
    const tInfo = await FileSystem.getInfoAsync(TRACKS_DIR);
    if (!tInfo.exists) await FileSystem.makeDirectoryAsync(TRACKS_DIR, { intermediates: true });

    const cInfo = await FileSystem.getInfoAsync(COVERS_DIR);
    if (!cInfo.exists) await FileSystem.makeDirectoryAsync(COVERS_DIR, { intermediates: true });

    // iOS Files App Cleanliness: remove any old loose covers folder in DocumentDirectory
    if (Platform.OS === 'ios') {
      try {
        const oldDocCovers = `${FileSystem.documentDirectory}rivo_covers/`;
        const oInfo = await FileSystem.getInfoAsync(oldDocCovers).catch(() => ({ exists: false }));
        if (oInfo.exists) {
          await FileSystem.deleteAsync(oldDocCovers, { idempotent: true }).catch(() => {});
        }
      } catch {}
    }

    if (PERSISTENT_DIR) {
      try {
        const pInfo = await FileSystem.getInfoAsync(PERSISTENT_DIR);
        if (!pInfo.exists) {
          await FileSystem.makeDirectoryAsync(PERSISTENT_DIR, { intermediates: true });
        } else {
          // Restore any tracks from external vault that may have been wiped during reinstall
          const pFiles = await FileSystem.readDirectoryAsync(PERSISTENT_DIR);
          for (const pf of pFiles) {
            if (pf.endsWith('.mp3') || pf.endsWith('.m4a')) {
              const target = `${TRACKS_DIR}${pf}`;
              const check = await FileSystem.getInfoAsync(target).catch(() => ({ exists: false }));
              if (!check.exists) {
                await FileSystem.copyAsync({ from: `${PERSISTENT_DIR}${pf}`, to: target }).catch(() => {});
              }
            } else if (pf.endsWith('.jpg')) {
              const targetCover = `${COVERS_DIR}${pf}`;
              const checkC = await FileSystem.getInfoAsync(targetCover).catch(() => ({ exists: false }));
              if (!checkC.exists) {
                await FileSystem.copyAsync({ from: `${PERSISTENT_DIR}${pf}`, to: targetCover }).catch(() => {});
              }
            }
          }
        }
      } catch {}
    }

    // Migrate from legacy liofy_tracks directory if present
    try {
      const legTrackInfo = await FileSystem.getInfoAsync(LEGACY_TRACKS_DIR);
      if (legTrackInfo.exists) {
        const legFiles = await FileSystem.readDirectoryAsync(LEGACY_TRACKS_DIR);
        for (const lf of legFiles) {
          try {
            await FileSystem.moveAsync({
              from: `${LEGACY_TRACKS_DIR}${lf}`,
              to: `${TRACKS_DIR}${lf}`
            });
          } catch {}
        }
      }
    } catch {}

    // Migrate from legacy liofy_covers directory if present
    try {
      const legCoverInfo = await FileSystem.getInfoAsync(LEGACY_COVERS_DIR);
      if (legCoverInfo.exists) {
        const legCovers = await FileSystem.readDirectoryAsync(LEGACY_COVERS_DIR);
        for (const lc of legCovers) {
          try {
            await FileSystem.moveAsync({
              from: `${LEGACY_COVERS_DIR}${lc}`,
              to: `${COVERS_DIR}${lc}`
            });
          } catch {}
        }
      }
    } catch {}
  } catch (e) {
    console.warn('[downloadManager] ensureDirs error:', e.message);
  }
};

const downloadChangeListeners = new Set();

export const subscribeToDownloadedTracks = (listener) => {
  if (typeof listener === 'function') {
    downloadChangeListeners.add(listener);
  }
  return () => {
    downloadChangeListeners.delete(listener);
  };
};

export const notifyDownloadedTracksChanged = (tracks) => {
  const cleanList = deduplicateTrackList(tracks || []);
  for (const fn of downloadChangeListeners) {
    try {
      fn(cleanList);
    } catch (e) {
      console.warn('[downloadManager] Listener notification error:', e.message);
    }
  }
};

const saveToStorageAndManifest = async (list) => {
  try {
    const jsonStr = JSON.stringify(list || []);
    await AsyncStorage.setItem(STORAGE_KEY, jsonStr).catch(() => {});
    await FileSystem.writeAsStringAsync(MANIFEST_FILE, jsonStr).catch(() => {});
    if (PERSISTENT_DIR && PERSISTENT_MANIFEST) {
      try {
        await FileSystem.writeAsStringAsync(PERSISTENT_MANIFEST, jsonStr);
      } catch {}
    }
  } catch (e) {
    console.warn('[downloadManager] saveToStorageAndManifest error:', e.message);
  }
  notifyDownloadedTracksChanged(list);
};

export const reanchorDocumentUri = (uri) => {
  if (!uri || typeof uri !== 'string') return uri;
  if (uri.startsWith('file://') && uri.includes('/Documents/')) {
    const rel = uri.split('/Documents/')[1];
    return `${FileSystem.documentDirectory}${rel}`;
  }
  return uri;
};

export const getDownloadedTracks = async () => {
  try {
    await ensureDirs();

    // 1. Read primary AsyncStorage key
    let tracks = [];
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) tracks = JSON.parse(raw) || [];
    } catch {}

    // 2. Check disk manifest (resilient to APK updates / SQLite clearing)
    if (!Array.isArray(tracks) || tracks.length === 0) {
      try {
        const mInfo = await FileSystem.getInfoAsync(MANIFEST_FILE);
        if (mInfo.exists) {
          const mRaw = await FileSystem.readAsStringAsync(MANIFEST_FILE);
          if (mRaw) {
            const mList = JSON.parse(mRaw);
            if (Array.isArray(mList) && mList.length > 0) tracks = mList;
          }
        }
      } catch {}
    }

    // 2b. Check persistent external vault manifest (recovers all songs across full app uninstalls & reinstalls)
    if ((!Array.isArray(tracks) || tracks.length === 0) && PERSISTENT_MANIFEST) {
      try {
        const pInfo = await FileSystem.getInfoAsync(PERSISTENT_MANIFEST);
        if (pInfo.exists) {
          const pRaw = await FileSystem.readAsStringAsync(PERSISTENT_MANIFEST);
          if (pRaw) {
            const pList = JSON.parse(pRaw);
            if (Array.isArray(pList) && pList.length > 0) {
              tracks = pList;
              // Sync back to internal manifest and AsyncStorage
              await AsyncStorage.setItem(STORAGE_KEY, pRaw).catch(() => {});
              await FileSystem.writeAsStringAsync(MANIFEST_FILE, pRaw).catch(() => {});
            }
          }
        }
      } catch {}
    }

    // 3. Fallback to legacy AsyncStorage keys
    for (const key of LEGACY_STORAGE_KEYS) {
      if (key === STORAGE_KEY) continue;
      try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          const list = JSON.parse(raw);
          if (Array.isArray(list) && list.length > 0) {
            const existingIds = new Set(tracks.map(t => String(t._id || t.id)));
            const existingKeys = new Set(tracks.map(getTrackDedupeKey));
            list.forEach(t => {
              const tid = String(t._id || t.id);
              const tKey = getTrackDedupeKey(t);
              if (tid && !existingIds.has(tid) && (!tKey || !existingKeys.has(tKey))) {
                tracks.push(t);
                existingIds.add(tid);
                if (tKey) existingKeys.add(tKey);
              }
            });
          }
        }
      } catch {}
    }

    // 3.5 Re-anchor all local paths to current iOS container UUID & verify covers
    for (const t of tracks) {
      if (!t) continue;
      if (t.localAudioUri) t.localAudioUri = reanchorDocumentUri(t.localAudioUri);
      if (t.nativeAudioUri) t.nativeAudioUri = reanchorDocumentUri(t.nativeAudioUri);
      if (t.audioUrl && t.audioUrl.startsWith('file://')) t.audioUrl = reanchorDocumentUri(t.audioUrl);
      if (t.coverUrl && t.coverUrl.startsWith('file://')) t.coverUrl = reanchorDocumentUri(t.coverUrl);
      if (t.cover && t.cover.startsWith('file://')) t.cover = reanchorDocumentUri(t.cover);

      const tid = String(t._id || t.id);
      const stdCover = `${COVERS_DIR}${tid}.jpg`;
      const currentCover = t.coverUrl || t.cover;
      if (currentCover && currentCover.startsWith('file://')) {
        const cCheck = await FileSystem.getInfoAsync(currentCover).catch(() => ({ exists: false }));
        if (!cCheck.exists) {
          const stdCheck = await FileSystem.getInfoAsync(stdCover).catch(() => ({ exists: false }));
          if (stdCheck.exists) {
            t.coverUrl = stdCover;
            t.cover = stdCover;
          } else {
            const fallbackCover = t.remoteCoverUrl || t.originalCoverUrl;
            if (fallbackCover) {
              t.coverUrl = fallbackCover;
              t.cover = fallbackCover;
            }
          }
        }
      } else if (!t.coverUrl && !t.cover) {
        const stdCheck = await FileSystem.getInfoAsync(stdCover).catch(() => ({ exists: false }));
        if (stdCheck.exists) {
          t.coverUrl = stdCover;
          t.cover = stdCover;
        }
      }
    }

    // 4. Physical Disk Reconciliation: Scan TRACKS_DIR on device
    try {
      const dirInfo = await FileSystem.getInfoAsync(TRACKS_DIR);
      if (dirInfo.exists) {
        const diskFiles = await FileSystem.readDirectoryAsync(TRACKS_DIR);
        const trackMap = new Map();
        tracks.forEach(t => {
          if (t._id) trackMap.set(String(t._id), t);
          if (t.id) trackMap.set(String(t.id), t);
          const k = getTrackDedupeKey(t);
          if (k) trackMap.set(k, t);
        });
        let modified = false;

        for (const file of diskFiles) {
          if (!file.endsWith('.mp3') && !file.endsWith('.m4a') && !file.endsWith('.mp4')) continue;
          const trackId = file.replace(/\.(mp3|m4a|mp4)$/i, '');
          if (!trackId || trackId === 'temp') continue;

          const fileUri = `${TRACKS_DIR}${file}`;
          const fInfo = await FileSystem.getInfoAsync(fileUri);
          if (!fInfo.exists || fInfo.size < 10000) continue;

          let existing = trackMap.get(trackId);
          if (existing) {
            if (existing.localAudioUri !== fileUri || existing.nativeAudioUri !== fileUri) {
              existing.localAudioUri = fileUri;
              existing.nativeAudioUri = fileUri;
              existing.audioUrl = fileUri;
              existing.downloaded = true;
              existing.isDownloaded = true;
              modified = true;
            }
          } else {
            // Check if this audio file belongs to an existing track by ID3 tags or filename
            const isMongoId = /^[a-f0-9]{24}$/i.test(trackId);
            let id3Meta = { title: null, artist: null, album: null, lyrics: null, coverUrl: null };
            let fTitle = null;
            let fArtist = null;
            if (!isMongoId) {
              id3Meta = await extractId3Metadata(fileUri, trackId);
              const parsed = parseAudioMetadataFromFilename(file);
              fTitle = parsed.title;
              fArtist = parsed.artist;
            }
            const resolvedTitle = cleanMetadataString(id3Meta.title || fTitle || trackId, 'Offline Track');
            const resolvedArtist = cleanMetadataString(id3Meta.artist || fArtist || (isMongoId ? 'Rivo Artist' : 'Local Import'), 'Offline Artist');
            const normKey = getTrackDedupeKey({ title: resolvedTitle, artist: resolvedArtist });
            existing = trackMap.get(normKey);

            if (existing) {
              existing.localAudioUri = fileUri;
              existing.nativeAudioUri = fileUri;
              existing.audioUrl = fileUri;
              existing.downloaded = true;
              existing.isDownloaded = true;
              trackMap.set(trackId, existing);
              modified = true;
            } else {
              // File is on device disk but missing from index -> auto recover
              const coverUri = `${COVERS_DIR}${trackId}.jpg`;
              const coverInfo = await FileSystem.getInfoAsync(coverUri).catch(() => ({ exists: false }));
              const resolvedAlbum = cleanMetadataString(id3Meta.album || 'Downloaded', 'Downloaded');
              const finalCover = id3Meta.coverUrl || (coverInfo.exists ? coverUri : null);

              const recovered = {
                id: trackId,
                _id: trackId,
                title: resolvedTitle,
                artist: resolvedArtist,
                album: resolvedAlbum,
                source: 'Rivo',
                signature: 'Rivo',
                publisher: 'Rivo',
                localAudioUri: fileUri,
                nativeAudioUri: fileUri,
                audioUrl: fileUri,
                coverUrl: finalCover,
                cover: finalCover,
                lyrics: id3Meta.lyrics || null,
                embeddedLyrics: id3Meta.lyrics || null,
                isDownloaded: true,
                downloaded: true,
                downloadedAt: new Date().toISOString(),
              };
              tracks.push(recovered);
              trackMap.set(trackId, recovered);
              if (normKey) trackMap.set(normKey, recovered);
              modified = true;
            }
          }
        }

        // Verify, filter invalid records, and strictly deduplicate
        const verified = deduplicateTrackList(tracks.filter(t =>
          t &&
          t.source !== 'SoundCloud' &&
          t.album !== 'SoundCloud' &&
          !String(t.audioUrl || '').includes('soundcloud.com') &&
          !String(t.id || t._id || '').startsWith('sc-')
        ));

        if (modified || verified.length !== tracks.length) {
          tracks = verified;
          await saveToStorageAndManifest(tracks);
        }
      }
    } catch (diskErr) {
      console.warn('[downloadManager] disk reconciliation error:', diskErr.message);
    }

    // 5. Auto-heal damaged metadata for MongoDB ObjectId tracks or "Local Import"
    const damagedTracks = tracks.filter(t => {
      if (!t) return false;
      const tid = String(t._id || t.id || '');
      const tTitle = String(t.title || '');
      const tArtist = String(t.artist || '');
      const isHexId = /^[a-f0-9]{24}$/i.test(tid);
      const hasHexTitle = /^[a-f0-9]{24}$/i.test(tTitle) || tTitle === tid;
      const isDamaged = hasHexTitle || tArtist === 'Local Import' || !tTitle || tTitle === 'Offline Track';
      return isHexId && isDamaged;
    });

    if (damagedTracks.length > 0) {
      try {
        const idsToFetch = [...new Set(damagedTracks.map(t => String(t._id || t.id)))];
        const healController = new AbortController();
        const healTimeout = setTimeout(() => healController.abort(), 3500);
        const res = await fetch(`${API_BASE_URL}/api/tracks/by-ids`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: idsToFetch }),
          signal: healController.signal,
        });
        clearTimeout(healTimeout);

        if (res.ok) {
          const data = await res.json();
          if (data?.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
            const serverMap = new Map();
            data.tracks.forEach(st => serverMap.set(String(st._id || st.id), st));

            let repairedCount = 0;
            tracks = tracks.map(t => {
              if (!t) return t;
              const tid = String(t._id || t.id);
              const serverTrack = serverMap.get(tid);
              if (serverTrack && serverTrack.title && !/^[a-f0-9]{24}$/i.test(serverTrack.title)) {
                repairedCount++;
                return {
                  ...t,
                  title: cleanMetadataString(serverTrack.title, t.title),
                  artist: cleanMetadataString(serverTrack.artist, t.artist !== 'Local Import' ? t.artist : 'Artist'),
                  album: cleanMetadataString(serverTrack.album, t.album),
                  cover: serverTrack.cover || t.cover,
                  coverUrl: serverTrack.cover || t.coverUrl,
                  duration: serverTrack.duration || t.duration,
                  lyrics: (serverTrack.lyrics && serverTrack.lyrics.length > 0) ? serverTrack.lyrics : t.lyrics,
                };
              }
              return t;
            });

            if (repairedCount > 0) {
              await saveToStorageAndManifest(tracks);
            }
          }
        }
      } catch (healErr) {}
    }

    return deduplicateTrackList(tracks);
  } catch {
    return [];
  }
};

export const isTrackDownloaded = async (trackId) => {
  const list = await getDownloadedTracks();
  return list.some(t => String(t._id || t.id) === String(trackId));
};

function cleanMetadataString(str, fallback = '') {
  if (!str) return fallback;
  const cleaned = String(str)
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/www\.\S+/gi, '')
    .replace(/youtube\.com\S*/gi, '')
    .replace(/youtu\.be\S*/gi, '')
    .replace(/liofy\S*/gi, '')
    .replace(/[\[\(]?(?:official|lyrics|video|audio|hd|4k|remastered)[\]\)]?/gi, '')
    .replace(/[\[\(]?(?:mp3|128k|160k|256k|320k|m4a|wav|flac|mp3_\d+k)[\]\)]?/gi, '')
    .replace(/_\d+k/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}


function stringToUtf16LeBytes(str) {
  const bytes = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    bytes[i * 2] = code & 0xff;
    bytes[i * 2 + 1] = (code >> 8) & 0xff;
  }
  return bytes;
}

function concatUint8Arrays(arrays) {
  let total = 0;
  for (const a of arrays) total += a.length;
  const res = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    res.set(a, offset);
    offset += a.length;
  }
  return res;
}

function makeId3TextFrame(id, text) {
  if (!text) return null;
  const strBytes = stringToUtf16LeBytes(text);
  const payload = concatUint8Arrays([new Uint8Array([0x01, 0xff, 0xfe]), strBytes]);
  const header = new Uint8Array(10);
  for (let i = 0; i < 4; i++) header[i] = id.charCodeAt(i);
  const len = payload.length;
  header[4] = (len >> 24) & 0xff;
  header[5] = (len >> 16) & 0xff;
  header[6] = (len >> 8) & 0xff;
  header[7] = len & 0xff;
  return concatUint8Arrays([header, payload]);
}

/**
 * Embeds ID3v2.3 tags (Title, Artist, Album, Cover Art, Lyrics) directly into the MP3 audio file.
 * This guarantees the cover art and lyrics travel WITH the song file as a single standalone unit.
 */
export async function embedId3v2TagsToMp3File(fileUri, { title, artist, album, lyrics, coverBase64, coverMime = 'image/jpeg' }) {
  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists || fileInfo.size < 1000) return false;

    // CRITICAL: NEVER embed ID3 tags into an MP4/M4A or WebM file!
    // Prepending an ID3 header corrupts MP4 atom offsets (stco/stts tables), breaking seekability completely.
    const headSample = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      length: 64,
      position: 0,
    }).catch(() => null);

    if (headSample) {
      const bytes = base64ToUint8Array(headSample);
      // MP4 / M4A begins with 'ftyp' atom at bytes 4..7
      if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
        console.log('[ID3] Skipping ID3 embedding: file is an MP4/M4A container, preserving seek table.');
        return false;
      }
      // WebM / Matroska begins with 0x1A 0x45 0xDF 0xA3
      if (bytes.length >= 4 && bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
        console.log('[ID3] Skipping ID3 embedding: file is a WebM container, preserving seekability.');
        return false;
      }
    }

    const frames = [];
    const fTitle = makeId3TextFrame('TIT2', title);
    if (fTitle) frames.push(fTitle);

    const fArtist = makeId3TextFrame('TPE1', artist);
    if (fArtist) frames.push(fArtist);

    const fAlbum = makeId3TextFrame('TALB', album);
    if (fAlbum) frames.push(fAlbum);

    if (lyrics && typeof lyrics === 'string' && lyrics.trim().length > 0) {
      const lyrBytes = stringToUtf16LeBytes(lyrics.trim());
      const payload = concatUint8Arrays([
        new Uint8Array([0x01, 0x65, 0x6e, 0x67, 0xff, 0xfe, 0x00, 0x00, 0xff, 0xfe]),
        lyrBytes
      ]);
      const header = new Uint8Array(10);
      const uslt = 'USLT';
      for (let i = 0; i < 4; i++) header[i] = uslt.charCodeAt(i);
      const len = payload.length;
      header[4] = (len >> 24) & 0xff;
      header[5] = (len >> 16) & 0xff;
      header[6] = (len >> 8) & 0xff;
      header[7] = len & 0xff;
      frames.push(concatUint8Arrays([header, payload]));
    }

    if (coverBase64 && typeof coverBase64 === 'string') {
      const imgBytes = base64ToUint8Array(coverBase64);
      const mime = coverMime || 'image/jpeg';
      const mimeBytes = new Uint8Array(mime.length + 1);
      for (let i = 0; i < mime.length; i++) mimeBytes[i] = mime.charCodeAt(i);
      mimeBytes[mime.length] = 0; // null terminator

      const payload = concatUint8Arrays([
        new Uint8Array([0x00]), // Latin-1 encoding for mime & desc
        mimeBytes,
        new Uint8Array([0x03, 0x00]), // Picture type 0x03 (Cover Front), empty description (0x00)
        imgBytes
      ]);

      const header = new Uint8Array(10);
      const apic = 'APIC';
      for (let i = 0; i < 4; i++) header[i] = apic.charCodeAt(i);
      const len = payload.length;
      header[4] = (len >> 24) & 0xff;
      header[5] = (len >> 16) & 0xff;
      header[6] = (len >> 8) & 0xff;
      header[7] = len & 0xff;
      frames.push(concatUint8Arrays([header, payload]));
    }

    if (frames.length === 0) return false;

    const allFrames = concatUint8Arrays(frames);
    const tagSize = allFrames.length;

    const b0 = (tagSize >> 21) & 0x7F;
    const b1 = (tagSize >> 14) & 0x7F;
    const b2 = (tagSize >> 7) & 0x7F;
    const b3 = tagSize & 0x7F;

    const id3Header = new Uint8Array([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, b0, b1, b2, b3]);
    const id3Tag = concatUint8Arrays([id3Header, allFrames]);

    // Read original audio file
    const origBase64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
    const origBytes = base64ToUint8Array(origBase64);

    let audioStartOffset = 0;
    // Check if original already has ID3 tag
    if (origBytes.length > 10 && origBytes[0] === 0x49 && origBytes[1] === 0x44 && origBytes[2] === 0x33) {
      const oldTagSize = ((origBytes[6] & 0x7F) << 21) |
                         ((origBytes[7] & 0x7F) << 14) |
                         ((origBytes[8] & 0x7F) << 7) |
                         (origBytes[9] & 0x7F);
      audioStartOffset = oldTagSize + 10;
    }

    const audioStreamBytes = audioStartOffset > 0 ? origBytes.subarray(audioStartOffset) : origBytes;
    const taggedAudio = concatUint8Arrays([id3Tag, audioStreamBytes]);

    const finalB64 = fastUint8ToBase64(taggedAudio);
    await FileSystem.writeAsStringAsync(fileUri, finalB64, { encoding: FileSystem.EncodingType.Base64 });
    return true;
  } catch (err) {
    console.warn('[ID3] embedId3v2TagsToMp3File error:', err.message);
    return false;
  }
}

function fastUint8ToBase64(bytes) {
  if (typeof btoa === 'function') {
    try {
      let bin = '';
      const len = bytes.byteLength;
      const step = 16384;
      for (let i = 0; i < len; i += step) {
        bin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + step, len)));
      }
      return btoa(bin);
    } catch (e) {}
  }
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let b64 = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    b64 += chars[b0 >> 2] + chars[((b0 & 3) << 4) | (b1 >> 4)] +
           (i + 1 < len ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=') +
           (i + 2 < len ? chars[b2 & 63] : '=');
  }
  return b64;
}

/**
 * Ultra-fast parallel range downloader for Google Video CDN streams.
 * Bypasses YouTube's 31 KB/s single-stream throttle by downloading concurrent Range chunks.
 * Achieves 2-5 MB/s transfer speeds (downloads entire song in 1-3 seconds).
 */
async function downloadViaParallelRanges(streamUrl, contentLength, targetUri, onProgressUpdate) {
  if (!streamUrl || !contentLength || contentLength < 100000) return false;

  const total = parseInt(contentLength, 10);
  if (!total || isNaN(total) || total <= 0) return false;

  // Split into chunks of ~1.2 MB (maximum 4 parallel chunks)
  const chunkSize = Math.max(1024 * 1024, Math.ceil(total / 4));
  const chunkDefs = [];
  for (let offset = 0; offset < total; offset += chunkSize) {
    const end = Math.min(offset + chunkSize - 1, total - 1);
    chunkDefs.push({ start: offset, end, size: end - offset + 1, index: chunkDefs.length });
  }

  let downloadedBytes = 0;
  const chunkResults = new Array(chunkDefs.length);

  const fetchChunk = async (def) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 35000);
    try {
      const res = await fetch(streamUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
          'Range': `bytes=${def.start}-${def.end}`,
          'Accept': '*/*',
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok && res.status !== 206 && res.status !== 200) {
        throw new Error(`Chunk ${def.index} HTTP ${res.status}`);
      }
      const arrayBuf = await res.arrayBuffer();
      const u8 = new Uint8Array(arrayBuf);
      chunkResults[def.index] = u8;
      downloadedBytes += u8.length;
      if (onProgressUpdate) {
        try {
          onProgressUpdate(downloadedBytes, total);
        } catch (pErr) {}
      }
      return true;
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  };

  // Run all chunks in parallel
  await Promise.all(chunkDefs.map(def => fetchChunk(def)));

  // Verify all chunks received
  for (let i = 0; i < chunkDefs.length; i++) {
    if (!chunkResults[i] || chunkResults[i].length === 0) {
      throw new Error(`Missing chunk ${i}`);
    }
  }

  // Assemble full file buffer
  const assembled = new Uint8Array(total);
  let writeOffset = 0;
  for (const chunk of chunkResults) {
    assembled.set(chunk, writeOffset);
    writeOffset += chunk.length;
  }

  if (assembled.length < 50000) {
    throw new Error('Assembled payload too small');
  }

  // Convert to base64 and write to device disk
  const b64 = fastUint8ToBase64(assembled);
  await FileSystem.writeAsStringAsync(targetUri, b64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const check = await FileSystem.getInfoAsync(targetUri);
  return check.exists && check.size > 50000;
}

/**
 * Resilient candidate downloader with activity-based stall detection.
 * Continuously monitors byte throughput and resets watchdog as long as data flows.
 * Aborts cleanly if no new bytes are received for stallTimeoutMs (25s).
 */
const downloadCandidateWithWatchdog = (
  targetUrl,
  chosenAudioUri,
  headers,
  onProgressChunk,
  stallTimeoutMs = 25000,
  maxTotalMs = 300000
) => {
  return new Promise((resolve, reject) => {
    let downloadResumable = null;
    let isSettled = false;
    let lastBytesWritten = 0;
    let lastActivityTime = Date.now();
    let stallWatchdog = null;
    let maxTimeoutTimer = null;

    const cleanup = () => {
      if (stallWatchdog) clearInterval(stallWatchdog);
      if (maxTimeoutTimer) clearTimeout(maxTimeoutTimer);
      stallWatchdog = null;
      maxTimeoutTimer = null;
    };

    const finishResolve = (res) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      resolve(res);
    };

    const finishReject = (err) => {
      if (isSettled) return;
      isSettled = true;
      cleanup();
      downloadResumable = null;
      reject(err);
    };

    // Overall max safety timeout (2.5 minutes)
    maxTimeoutTimer = setTimeout(() => {
      finishReject(new Error(`Download exceeded max duration of ${maxTotalMs / 1000}s`));
    }, maxTotalMs);

    // Stall watchdog: checks every 1000ms if no new bytes received for stallTimeoutMs (20s)
    stallWatchdog = setInterval(() => {
      if (isSettled) return;
      if (Date.now() - lastActivityTime > stallTimeoutMs) {
        finishReject(new Error(`Download stalled (no data for ${stallTimeoutMs / 1000}s)`));
      }
    }, 1000);

    try {
      downloadResumable = FileSystem.createDownloadResumable(
        targetUrl,
        chosenAudioUri,
        { headers },
        (progressEvent) => {
          if (isSettled) return;
          const written = progressEvent.totalBytesWritten || 0;
          if (written > lastBytesWritten) {
            lastBytesWritten = written;
            lastActivityTime = Date.now(); // Bytes are actively arriving -> keep watchdog happy
          }
          if (onProgressChunk) {
            try {
              onProgressChunk(progressEvent);
            } catch (pErr) {}
          }
        }
      );

      downloadResumable.downloadAsync()
        .then((res) => finishResolve(res))
        .catch(async (resumeErr) => {
          if (!isSettled) {
            try {
              const directRes = await FileSystem.downloadAsync(targetUrl, chosenAudioUri, { headers });
              finishResolve(directRes);
            } catch (directErr) {
              finishReject(resumeErr || directErr);
            }
          }
        });
    } catch (createErr) {
      FileSystem.downloadAsync(targetUrl, chosenAudioUri, { headers })
        .then((res) => finishResolve(res))
        .catch((dlErr) => finishReject(createErr || dlErr));
    }
  });
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

  const trackId = String(track._id || track.id);
  const audioFileUriMp3 = `${TRACKS_DIR}${trackId}.mp3`;
  const audioFileUriM4a = `${TRACKS_DIR}${trackId}.m4a`;
  const coverFileUri = `${COVERS_DIR}${trackId}.jpg`;
  const cleanTitle = cleanMetadataString(track.title, 'Track');
  const cleanArtist = cleanMetadataString(track.artist, 'Artist');
  const cleanAlbum = (!track.album || /https?:\/\/|www\.|youtube|liofy/i.test(track.album))
    ? (cleanTitle || 'Single')
    : cleanMetadataString(track.album, cleanTitle || 'Single');

  // Check if audio file already exists locally on disk (either .m4a or .mp3)
  let existingLocalUri = (track.localAudioUri && track.localAudioUri.startsWith('file://')) ? track.localAudioUri :
                         (track.nativeAudioUri && track.nativeAudioUri.startsWith('file://')) ? track.nativeAudioUri :
                         null;

  if (!existingLocalUri) {
    try {
      const infoM4a = await FileSystem.getInfoAsync(audioFileUriM4a);
      if (infoM4a.exists && infoM4a.size > 10000) existingLocalUri = audioFileUriM4a;
    } catch {}
    if (!existingLocalUri) {
      try {
        const infoMp3 = await FileSystem.getInfoAsync(audioFileUriMp3);
        if (infoMp3.exists && infoMp3.size > 10000) existingLocalUri = audioFileUriMp3;
      } catch {}
    }
  }

  let audioFileUri = audioFileUriMp3; // Default to mp3 for audio streams
  try {
    const existingInfo = await FileSystem.getInfoAsync(existingLocalUri);
    if (existingInfo.exists && existingInfo.size > 10000) {
      if (onProgress) onProgress(100);
      const existing = await getDownloadedTracks();
      const existingRecord = existing.find(t => String(t._id || t.id) === trackId);
      let rawLyrics = track.lyrics || existingRecord?.lyrics || null;
      let trackLyrics = rawLyrics ? parseLrcLyrics(rawLyrics) : null;
      if (!trackLyrics || (Array.isArray(trackLyrics) && trackLyrics.length === 0)) {
        try {
          const qTitle = encodeURIComponent(cleanTitle);
          const qArtist = encodeURIComponent(cleanArtist);
          const qId = encodeURIComponent(trackId);
          const lyricsRes = await fetch(`${API_BASE_URL}/api/tracks/lyrics?trackId=${qId}&title=${qTitle}&artist=${qArtist}`);
          if (lyricsRes.ok) {
            const lyricsData = await lyricsRes.json();
            if (lyricsData?.success && lyricsData?.lyrics) {
              trackLyrics = parseLrcLyrics(lyricsData.lyrics);
            }
          }
        } catch {}
      }

      // Embed ID3 tags directly into MP3 file so image & lyrics are bundled into the audio file itself!
  if (audioFileUri.endsWith('.mp3')) {
    try {
      let coverBase64 = null;
      let coverMime = 'image/jpeg';
      if (localCover && localCover.startsWith('file://')) {
        const cInfo = await FileSystem.getInfoAsync(localCover).catch(() => ({ exists: false }));
        if (cInfo.exists && cInfo.size > 0 && cInfo.size < 5000000) {
          coverBase64 = await FileSystem.readAsStringAsync(localCover, { encoding: FileSystem.EncodingType.Base64 });
          if (localCover.toLowerCase().endsWith('.png')) coverMime = 'image/png';
        }
      }
      const lyricsString = Array.isArray(trackLyrics) && trackLyrics.length > 0
        ? trackLyrics.map(l => l.text).join('\n')
        : (typeof rawLyrics === 'string' ? rawLyrics : '');

      await embedId3v2TagsToMp3File(audioFileUri, {
        title: cleanTitle,
        artist: cleanArtist,
        album: cleanAlbum,
        lyrics: lyricsString,
        coverBase64,
        coverMime,
      });
    } catch (tagErr) {
      console.warn('[downloadManager] ID3 tag embedding notice:', tagErr?.message);
    }
  }

  const record = {
        ...track,
        id: trackId,
        _id: trackId,
        title: cleanTitle,
        artist: cleanArtist,
        album: cleanAlbum,
        source: 'Rivo',
        publisher: 'Rivo',
        signature: 'Rivo',
        localAudioUri: existingLocalUri,
        nativeAudioUri: existingLocalUri,
        audioUrl: existingLocalUri,
        lyrics: trackLyrics,
        isDownloaded: true,
        downloaded: true,
        downloadedAt: new Date().toISOString(),
      };
      const dedupeKey = getTrackDedupeKey(record);
      const updated = [record, ...existing.filter(t =>
        String(t._id || t.id) !== trackId &&
        (!dedupeKey || getTrackDedupeKey(t) !== dedupeKey)
      )];
      const cleaned = deduplicateTrackList(updated);
      await saveToStorageAndManifest(cleaned);
      return record;
    }
  } catch {}

  let resolvedDuration = track.duration || getStreamDurationFromCache(trackId) || null;

  // 1. Check for already-active stream that online playback resolved/uses
  let activeStream = track.resolvedAudioUrl || getStreamFromCache(trackId);
  const rawTrackAudio = track.audioUrl || track.url || '';
  if (!activeStream && rawTrackAudio && typeof rawTrackAudio === 'string') {
    if (rawTrackAudio.startsWith('/uploads/') || rawTrackAudio.startsWith('/api/')) {
      activeStream = `${API_BASE_URL}${rawTrackAudio}`;
    } else if (rawTrackAudio.startsWith('http') && !rawTrackAudio.includes('youtube.com') && !rawTrackAudio.includes('youtu.be')) {
      activeStream = rawTrackAudio;
    }
  }

  // Normalize relative activeStream path to absolute URL
  if (activeStream && typeof activeStream === 'string' && activeStream.startsWith('/')) {
    activeStream = `${API_BASE_URL}${activeStream}`;
  }

  // 2. If no active stream yet, resolve the stream using the exact same authentic resolver as online playback
  if (!activeStream) {
    try {
      emitProgress(10);
      activeStream = await resolveAudioStream(track);
      if (activeStream && typeof activeStream === 'string' && activeStream.startsWith('/')) {
        activeStream = `${API_BASE_URL}${activeStream}`;
      }
      const cachedDur = getStreamDurationFromCache(trackId);
      if (cachedDur) resolvedDuration = cachedDur;
    } catch (e) {
      console.warn('[downloadManager] resolveAudioStream error:', e.message);
    }
  }

  // Check if activeStream is an authentic direct audio file (upload / direct mp3)
  const activeStreamIsDirectRemote = Boolean(
    activeStream &&
    typeof activeStream === 'string' &&
    activeStream.startsWith('http') &&
    !activeStream.includes('googlevideo.com') &&
    !activeStream.includes('youtube.com') &&
    !activeStream.includes('youtu.be')
  );

  // Gather candidate download URLs in order of priority
  const rawCandidates = [];
  let directGoogleStream = null;
  let directGoogleContentLength = null;

  // If activeStream was resolved:
  if (activeStream && typeof activeStream === 'string' && activeStream.startsWith('http') && !activeStream.includes('youtube.com/watch') && !activeStream.includes('youtu.be/')) {
    const isM4a = activeStream.includes('.m4a') || activeStream.includes('mime=audio%2Fmp4') || activeStream.includes('mime=audio/mp4') || activeStream.includes('itag=140');
    const ext = isM4a ? 'm4a' : 'mp3';
    rawCandidates.push({ url: activeStream, ext, source: 'active-online-stream' });
    if (activeStream.includes('googlevideo.com')) {
      directGoogleStream = activeStream;
      const proxyStreamUrl = `${API_BASE_URL}/api/tracks/stream-proxy?url=${encodeURIComponent(activeStream)}`;
      rawCandidates.push({ url: proxyStreamUrl, ext: 'm4a', source: 'backend-stream-proxy' });
    }
  }

  // Candidate 1: Direct remote audio URL (if already a clean remote audio file or upload)
  const isDirectRemote = (u) => {
    if (!u || typeof u !== 'string') return false;
    const trimmed = u.trim();
    if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/api/')) return true;
    return trimmed.startsWith('http') && !trimmed.includes('youtube.com') && !trimmed.includes('youtu.be') && !trimmed.includes('soundcloud.com');
  };
  const normalizeAudioUrl = (u) => (typeof u === 'string' && u.startsWith('/')) ? `${API_BASE_URL}${u}` : u;

  if (isDirectRemote(track.audioUrl)) {
    const directUrl = normalizeAudioUrl(track.audioUrl);
    rawCandidates.push({ url: directUrl, ext: directUrl.includes('.m4a') ? 'm4a' : 'mp3', source: 'track-audioUrl' });
  }
  if (isDirectRemote(track.nativeAudioUri)) {
    const directUrl = normalizeAudioUrl(track.nativeAudioUri);
    rawCandidates.push({ url: directUrl, ext: directUrl.includes('.m4a') ? 'm4a' : 'mp3', source: 'track-nativeAudioUri' });
  }

  // Candidate 2: If NOT already an authentic direct stream, fallback to YouTube ID resolution
  const rawUrl = track.audioUrl || track.url || '';
  let ytId = (!activeStreamIsDirectRemote) ? (
    extractYouTubeId(rawUrl) || (track.source === 'YouTube' ? extractYouTubeId(trackId) : null)
  ) : null;

  if (!activeStream && !ytId && (cleanTitle || cleanArtist)) {
    try {
      const searchRes = await searchYouTubeClientSide({
        artist: cleanArtist,
        title: cleanTitle,
        targetDuration: resolvedDuration || Number(track.duration) || null
      });
      if (searchRes?.videoId) {
        ytId = searchRes.videoId;
        if (searchRes.duration && !resolvedDuration) {
          const catDur = Number(track.duration) || null;
          if (!catDur || Math.abs(searchRes.duration - catDur) <= 60) {
            resolvedDuration = searchRes.duration;
          }
        }
      }
    } catch {}
  }

  if (ytId && !directGoogleStream && !activeStreamIsDirectRemote) {
    try {
      emitProgress(12);
      const ytRes = await resolveClientSideYouTubeStream(ytId);
      const resStream = typeof ytRes === 'string' ? ytRes : ytRes?.url;
      if (resStream && typeof resStream === 'string' && resStream.startsWith('http')) {
        directGoogleStream = resStream;
        directGoogleContentLength = ytRes?.contentLength || null;
        if (ytRes?.duration && !resolvedDuration) resolvedDuration = ytRes.duration;
        rawCandidates.push({ url: resStream, ext: 'm4a', source: 'direct-google-cdn' });
        const proxyStreamUrl = `${API_BASE_URL}/api/tracks/stream-proxy?url=${encodeURIComponent(resStream)}`;
        rawCandidates.push({ url: proxyStreamUrl, ext: 'm4a', source: 'backend-stream-proxy' });
      }
    } catch (e) {
      console.warn('[downloadManager] Direct client-side YouTube stream resolution error:', e.message);
    }
  }

  // Candidate 3: Backend Direct Downloader endpoint
  const backendDownloadUrl = `${API_BASE_URL}/api/tracks/download?url=${encodeURIComponent(track.audioUrl || '')}&title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}&id=${encodeURIComponent(trackId)}`;
  rawCandidates.push({ url: backendDownloadUrl, ext: 'm4a', source: 'backend-downloader' });

  // Candidate 4: Backend Stream Resolution endpoint
  const backendStreamUrl = `${API_BASE_URL}/api/tracks/${encodeURIComponent(trackId)}/stream?url=${encodeURIComponent(rawUrl)}&title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}`;
  rawCandidates.push({ url: backendStreamUrl, ext: 'm4a', source: 'backend-stream-endpoint' });

  // Deduplicate candidates preserving priority order
  const seenUrls = new Set();
  const candidates = [];
  for (const c of rawCandidates) {
    if (c && c.url && typeof c.url === 'string') {
      const trimmed = c.url.trim();
      if (trimmed.startsWith('http') && !seenUrls.has(trimmed)) {
        seenUrls.add(trimmed);
        candidates.push({ ...c, url: trimmed });
      }
    }
  }

  emitProgress(15);

  let success = false;

  // Standard mobile browser headers with Range header support to bypass YouTube throttling
  const downloadHeaders = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
    'Accept': '*/*',
    'Range': 'bytes=0-',
    'Connection': 'keep-alive',
  };

  // Try candidate URLs one by one until one produces a valid audio file
  if (!success) {
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const targetUrl = candidate.url;
      const chosenAudioUri = candidate.ext === 'm4a' ? audioFileUriM4a : audioFileUriMp3;

      try {
        // First clean up any corrupted partial file
        await FileSystem.deleteAsync(chosenAudioUri, { idempotent: true }).catch(() => {});

        const res = await downloadCandidateWithWatchdog(
          targetUrl,
          chosenAudioUri,
          downloadHeaders,
          (progressEvent) => {
            const written = progressEvent.totalBytesWritten || 0;
            const expected = progressEvent.totalBytesExpectedToWrite;
            if (expected > 0) {
              const fraction = written / expected;
              emitProgress(15 + fraction * 77); // Smooth progress from 15% to 92%
            } else {
              const estTotal = (resolvedDuration && resolvedDuration > 0)
                ? Math.max(1500000, resolvedDuration * 16000)
                : 4200000;
              const fraction = Math.min(0.95, written / estTotal);
              emitProgress(15 + fraction * 77);
            }
          },
          25000, // 25s stall watchdog (resets whenever data arrives; only fails if silent for 25s)
          300000 // 300s max safety timeout
        );

      if (res && (res.status === 200 || res.status === 206 || !res.status)) {
        const check = await FileSystem.getInfoAsync(chosenAudioUri);
        if (check.exists && check.size > 50000) {
          // Verify downloaded payload is valid audio and not an HTML or JSON error response
          let isPayloadCorrupt = false;
          try {
            const headSample = await FileSystem.readAsStringAsync(chosenAudioUri, {
              encoding: FileSystem.EncodingType.UTF8,
              length: 64,
              position: 0,
            });
            if (headSample && (
              headSample.startsWith('<!DOCTYPE') ||
              headSample.startsWith('<html') ||
              headSample.startsWith('{"') ||
              headSample.includes('<head>') ||
              headSample.includes('"error"')
            )) {
              isPayloadCorrupt = true;
            }
          } catch {}

          if (!isPayloadCorrupt) {
            success = true;
            audioFileUri = chosenAudioUri;
            break;
          } else {
            console.warn(`[downloadManager] Candidate ${i + 1} (${candidate.source}) returned text/html/json error payload instead of audio`);
            await FileSystem.deleteAsync(chosenAudioUri, { idempotent: true }).catch(() => {});
          }
        }
      }
    } catch (candidateErr) {
      console.warn(`[downloadManager] Candidate ${i + 1} (${candidate.source}) failed:`, candidateErr.message);
      await FileSystem.deleteAsync(chosenAudioUri, { idempotent: true }).catch(() => {});
    }
  }
}

  // If first-tier candidates failed, try direct client-side YouTube resolution as fallback with watchdog
  if (!success && ytId) {
    try {
      emitProgress(25);
      const mirrorRes = await resolveClientSideYouTubeStream(ytId);
      const mirrorUrl = typeof mirrorRes === 'string' ? mirrorRes : mirrorRes?.url;
      if (mirrorRes?.duration) resolvedDuration = mirrorRes.duration;

      if (mirrorUrl && typeof mirrorUrl === 'string' && mirrorUrl.startsWith('http')) {
        await FileSystem.deleteAsync(audioFileUriM4a, { idempotent: true }).catch(() => {});
        const mirrorResDl = await downloadCandidateWithWatchdog(
          mirrorUrl,
          audioFileUriM4a,
          downloadHeaders,
          (progressEvent) => {
            const written = progressEvent.totalBytesWritten || 0;
            const expected = progressEvent.totalBytesExpectedToWrite;
            const est = (expected > 0) ? expected : 4200000;
            emitProgress(25 + Math.min(0.95, written / est) * 67);
          },
          25000,
          150000
        );
        if (mirrorResDl && (mirrorResDl.status === 200 || mirrorResDl.status === 206 || !mirrorResDl.status)) {
          const check = await FileSystem.getInfoAsync(audioFileUriM4a);
          if (check.exists && check.size > 50000) {
            success = true;
            audioFileUri = audioFileUriM4a;
          }
        }
      }
    } catch (mirrorErr) {
      console.warn('[downloadManager] Direct fallback failed:', mirrorErr.message);
    }
  }

  if (!success) {
    await FileSystem.deleteAsync(audioFileUriMp3, { idempotent: true }).catch(() => {});
    await FileSystem.deleteAsync(audioFileUriM4a, { idempotent: true }).catch(() => {});
    throw new Error('Could not download audio stream from available servers');
  }

  emitProgress(92);

  // Cover art download & local caching (with 3-second timeout protection)
  let localCover = track.coverUrl || track.cover || '';
  if (localCover && typeof localCover === 'string') {
    if (localCover.startsWith('/') && !localCover.startsWith('//')) {
      localCover = `${API_BASE_URL}${localCover}`;
    }
    if (localCover.startsWith('http')) {
      try {
        const coverTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Cover dl timeout')), 3000));
        await Promise.race([FileSystem.downloadAsync(localCover, coverFileUri), coverTimeout]);
        localCover = coverFileUri;
      } catch {}
    }
  }

  // Lyrics fetch & embed (with 2.5-second timeout protection so lyrics never delay download)
  let rawLyrics = track.lyrics || null;
  let trackLyrics = rawLyrics ? parseLrcLyrics(rawLyrics) : null;
  if (!trackLyrics || (Array.isArray(trackLyrics) && trackLyrics.length === 0)) {
    try {
      const qTitle = encodeURIComponent(cleanTitle);
      const qArtist = encodeURIComponent(cleanArtist);
      const qId = encodeURIComponent(trackId);
      const lyrController = new AbortController();
      const lyrTimeout = setTimeout(() => lyrController.abort(), 2500);
      const lyricsRes = await fetch(`${API_BASE_URL}/api/tracks/lyrics?trackId=${qId}&title=${qTitle}&artist=${qArtist}`, {
        signal: lyrController.signal,
      });
      clearTimeout(lyrTimeout);
      if (lyricsRes.ok) {
        const lyricsData = await lyricsRes.json();
        if (lyricsData?.success && lyricsData?.lyrics) {
          trackLyrics = parseLrcLyrics(lyricsData.lyrics);
        }
      }
    } catch {}
  }

  // Sync to persistent external vault so it survives uninstall / reinstall
  if (PERSISTENT_DIR) {
    try {
      const extAudioDst = `${PERSISTENT_DIR}${trackId}.${audioFileUri.endsWith('.m4a') ? 'm4a' : 'mp3'}`;
      await FileSystem.copyAsync({ from: audioFileUri, to: extAudioDst }).catch(() => {});
      if (localCover && localCover.startsWith('file://')) {
        const extCoverDst = `${PERSISTENT_DIR}${trackId}.jpg`;
        await FileSystem.copyAsync({ from: localCover, to: extCoverDst }).catch(() => {});
      }
    } catch {}
  }

  const originalCoverUrl = track.remoteCoverUrl || track.originalCoverUrl || track.coverUrl || track.cover || '';

  const record = {
    ...track,
    id: trackId,
    _id: trackId,
    title: cleanTitle,
    artist: cleanArtist,
    album: cleanAlbum,
    source: 'Rivo',
    publisher: 'Rivo',
    signature: 'Rivo',
    remoteCoverUrl: originalCoverUrl,
    originalCoverUrl: originalCoverUrl,
    localAudioUri: audioFileUri,
    nativeAudioUri: audioFileUri,
    audioUrl: audioFileUri,
    duration: sanitizeDuration(resolvedDuration || track.duration || 210),
    coverUrl: localCover || originalCoverUrl,
    cover: localCover || originalCoverUrl,
    lyrics: trackLyrics,
    isDownloaded: true,
    downloaded: true,
    downloadedAt: new Date().toISOString(),
  };

  const existing = await getDownloadedTracks();
  const dedupeKey = getTrackDedupeKey(record);
  const updated = [record, ...existing.filter(t =>
    String(t._id || t.id) !== trackId &&
    (!dedupeKey || getTrackDedupeKey(t) !== dedupeKey)
  )];
  const cleaned = deduplicateTrackList(updated);
  await saveToStorageAndManifest(cleaned);

  if (onProgress) onProgress(100);
  return record;
};


export const removeDownloadedTracksBatch = async (tracksOrIds = []) => {
  if (!Array.isArray(tracksOrIds) || tracksOrIds.length === 0) return await getDownloadedTracks();

  const existing = await getDownloadedTracks();
  if (existing.length === 0) return [];

  const targetIds = new Set();
  const targetKeys = new Set();
  const fileUrisToDelete = new Set();

  for (const item of tracksOrIds) {
    if (!item) continue;
    const idStr = (typeof item === 'object') ? String(item._id || item.id || '') : String(item);
    if (idStr) targetIds.add(idStr);

    const targetObj = (typeof item === 'object')
      ? item
      : existing.find(t => String(t._id || t.id) === idStr);

    const key = getTrackDedupeKey(targetObj);
    if (key) targetKeys.add(key);

    if (targetObj) {
      const uris = [targetObj.localAudioUri, targetObj.nativeAudioUri, targetObj.audioUrl, targetObj.coverUrl, targetObj.cover];
      for (const u of uris) {
        if (u && typeof u === 'string' && u.startsWith('file://')) {
          fileUrisToDelete.add(u);
        }
      }
    }
  }

  // Also match existing items that match any targetKeys
  for (const t of existing) {
    if (!t) continue;
    const tid = String(t._id || t.id);
    const tKey = getTrackDedupeKey(t);
    if (targetIds.has(tid) || (tKey && targetKeys.has(tKey))) {
      targetIds.add(tid);
      const uris = [t.localAudioUri, t.nativeAudioUri, t.audioUrl, t.coverUrl, t.cover];
      for (const u of uris) {
        if (u && typeof u === 'string' && u.startsWith('file://')) {
          fileUrisToDelete.add(u);
        }
      }
    }
  }

  // Prepare standard paths for all target IDs
  for (const tid of targetIds) {
    clearStreamCache(tid);
    fileUrisToDelete.add(`${TRACKS_DIR}${tid}.mp3`);
    fileUrisToDelete.add(`${TRACKS_DIR}${tid}.m4a`);
    fileUrisToDelete.add(`${COVERS_DIR}${tid}.jpg`);
    if (PERSISTENT_DIR) {
      fileUrisToDelete.add(`${PERSISTENT_DIR}${tid}.mp3`);
      fileUrisToDelete.add(`${PERSISTENT_DIR}${tid}.m4a`);
      fileUrisToDelete.add(`${PERSISTENT_DIR}${tid}.jpg`);
    }
  }

  // Delete all disk files concurrently
  const deletePromises = Array.from(fileUrisToDelete).map(uri =>
    FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})
  );
  await Promise.all(deletePromises);

  // Filter existing tracks list in one pass
  const updated = existing.filter(t => {
    if (!t) return false;
    const tid = String(t._id || t.id);
    if (targetIds.has(tid)) return false;
    const tKey = getTrackDedupeKey(t);
    if (tKey && targetKeys.has(tKey)) return false;
    return true;
  });

  // Single commit to storage and manifest
  await saveToStorageAndManifest(updated);

  // Single pass through legacy storage keys
  for (const legKey of LEGACY_STORAGE_KEYS) {
    if (legKey === STORAGE_KEY) continue;
    try {
      const raw = await AsyncStorage.getItem(legKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const legFiltered = parsed.filter(t => {
            if (!t) return false;
            const tid = String(t._id || t.id);
            if (targetIds.has(tid)) return false;
            const tKey = getTrackDedupeKey(t);
            if (tKey && targetKeys.has(tKey)) return false;
            return true;
          });
          await AsyncStorage.setItem(legKey, JSON.stringify(legFiltered));
        }
      }
    } catch {}
  }

  return updated;
};

export const removeDownloadedTrack = async (trackOrId) => {
  if (!trackOrId) return [];
  const idStr = (typeof trackOrId === 'object' && trackOrId !== null)
    ? String(trackOrId._id || trackOrId.id || '')
    : String(trackOrId);

  const existing = await getDownloadedTracks();
  const target = (typeof trackOrId === 'object' && trackOrId !== null)
    ? trackOrId
    : existing.find(t => String(t._id || t.id) === idStr);

  const targetKey = getTrackDedupeKey(target);

  const toRemove = existing.filter(t => {
    if (!t) return false;
    const tid = String(t._id || t.id);
    if (idStr && tid === idStr) return true;
    if (targetKey && getTrackDedupeKey(t) === targetKey) return true;
    return false;
  });

  const idsToDelete = new Set([idStr, ...toRemove.map(t => String(t._id || t.id)).filter(Boolean)]);

  for (const tid of idsToDelete) {
    clearStreamCache(tid);
    await FileSystem.deleteAsync(`${TRACKS_DIR}${tid}.mp3`, { idempotent: true }).catch(() => {});
    await FileSystem.deleteAsync(`${TRACKS_DIR}${tid}.m4a`, { idempotent: true }).catch(() => {});
    await FileSystem.deleteAsync(`${COVERS_DIR}${tid}.jpg`, { idempotent: true }).catch(() => {});
    if (PERSISTENT_DIR) {
      await FileSystem.deleteAsync(`${PERSISTENT_DIR}${tid}.mp3`, { idempotent: true }).catch(() => {});
      await FileSystem.deleteAsync(`${PERSISTENT_DIR}${tid}.m4a`, { idempotent: true }).catch(() => {});
      await FileSystem.deleteAsync(`${PERSISTENT_DIR}${tid}.jpg`, { idempotent: true }).catch(() => {});
    }
  }

  // Also delete specific localAudioUri / nativeAudioUri if they point to file://
  for (const t of toRemove) {
    const uris = [t.localAudioUri, t.nativeAudioUri, t.audioUrl, t.coverUrl, t.cover];
    for (const u of uris) {
      if (u && typeof u === 'string' && u.startsWith('file://')) {
        await FileSystem.deleteAsync(u, { idempotent: true }).catch(() => {});
      }
    }
  }

  const updated = existing.filter(t => {
    if (!t) return false;
    const tid = String(t._id || t.id);
    if (idsToDelete.has(tid)) return false;
    if (targetKey && getTrackDedupeKey(t) === targetKey) return false;
    return true;
  });

  await saveToStorageAndManifest(updated);

  // Also purge removed items from legacy storage keys so they never resurrect
  for (const legKey of LEGACY_STORAGE_KEYS) {
    if (legKey === STORAGE_KEY) continue;
    try {
      const raw = await AsyncStorage.getItem(legKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const legFiltered = parsed.filter(t => {
            if (!t) return false;
            const tid = String(t._id || t.id);
            if (idsToDelete.has(tid)) return false;
            if (targetKey && getTrackDedupeKey(t) === targetKey) return false;
            return true;
          });
          await AsyncStorage.setItem(legKey, JSON.stringify(legFiltered));
        }
      }
    } catch {}
  }

  return updated;
};

function base64ToUint8Array(b64) {
  if (!b64 || typeof b64 !== 'string') return new Uint8Array(0);
  const clean = b64.replace(/[\r\n\t =]/g, '');
  const len = clean.length;
  if (len === 0) return new Uint8Array(0);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Uint8Array(256);
  for (let i = 0; i < chars.length; i++) lookup[chars.charCodeAt(i)] = i;

  const byteLen = Math.floor((len * 3) / 4);
  const bytes = new Uint8Array(byteLen);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const b0 = lookup[clean.charCodeAt(i)];
    const b1 = lookup[clean.charCodeAt(i + 1)];
    const b2 = lookup[clean.charCodeAt(i + 2)];
    const b3 = lookup[clean.charCodeAt(i + 3)];
    bytes[p++] = (b0 << 2) | (b1 >> 4);
    if (p < byteLen) bytes[p++] = ((b1 & 15) << 4) | (b2 >> 2);
    if (p < byteLen) bytes[p++] = ((b2 & 3) << 6) | b3;
  }
  return bytes;
}

function uint8ArrayToBase64(bytes) {
  if (!bytes || bytes.length === 0) return '';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let b64 = '';
  const len = bytes.length;
  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < len ? bytes[i + 1] : 0;
    const b2 = i + 2 < len ? bytes[i + 2] : 0;
    b64 += chars[b0 >> 2];
    b64 += chars[((b0 & 3) << 4) | (b1 >> 4)];
    b64 += i + 1 < len ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    b64 += i + 2 < len ? chars[b2 & 63] : '=';
  }
  return b64;
}

function decodeId3String(bytes, encoding = 0) {
  if (!bytes || bytes.length === 0) return '';
  try {
    if (encoding === 3) {
      if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder('utf-8').decode(bytes).replace(/\0/g, '').trim();
      }
    } else if (encoding === 1) {
      if (bytes.length >= 2) {
        if (bytes[0] === 0xFF && bytes[1] === 0xFE) {
          if (typeof TextDecoder !== 'undefined') {
            return new TextDecoder('utf-16le').decode(bytes.slice(2)).replace(/\0/g, '').trim();
          }
        } else if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
          if (typeof TextDecoder !== 'undefined') {
            return new TextDecoder('utf-16be').decode(bytes.slice(2)).replace(/\0/g, '').trim();
          }
        }
      }
      if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder('utf-16').decode(bytes).replace(/\0/g, '').trim();
      }
    } else if (encoding === 2) {
      if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder('utf-16be').decode(bytes).replace(/\0/g, '').trim();
      }
    }
  } catch (e) {}

  if (encoding === 1 || encoding === 2) {
    let offset = 0;
    let isLE = true;
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
      isLE = false;
      offset = 2;
    } else if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
      isLE = true;
      offset = 2;
    } else if (encoding === 2) {
      isLE = false;
    }
    let str = '';
    for (let i = offset; i + 1 < bytes.length; i += 2) {
      const code = isLE ? (bytes[i] | (bytes[i + 1] << 8)) : ((bytes[i] << 8) | bytes[i + 1]);
      if (code !== 0) str += String.fromCharCode(code);
    }
    return str.trim();
  }

  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    if (c !== 0) str += String.fromCharCode(c);
  }
  try {
    return decodeURIComponent(escape(str)).trim();
  } catch {
    return str.trim();
  }
}

function readSynchSafeInt(b0, b1, b2, b3) {
  return ((b0 & 0x7F) << 21) | ((b1 & 0x7F) << 14) | ((b2 & 0x7F) << 7) | (b3 & 0x7F);
}

function readInt32(b0, b1, b2, b3) {
  return ((b0 << 24) >>> 0) | (b1 << 16) | (b2 << 8) | b3;
}

export async function extractId3Metadata(fileUri, trackId = null) {
  const result = {
    title: null,
    artist: null,
    album: null,
    lyrics: null,
    coverUrl: null,
  };

  if (!fileUri) return result;

  try {
    const isContentUri = typeof fileUri === 'string' && fileUri.startsWith('content://');
    const fileInfo = await FileSystem.getInfoAsync(fileUri).catch(() => ({ exists: isContentUri }));
    if (!fileInfo || (!fileInfo.exists && !isContentUri)) return result;

    const fileSize = (typeof fileInfo.size === 'number' && fileInfo.size > 0) ? fileInfo.size : null;
    if (fileSize !== null && fileSize < 128) return result;

    const sampleLength = fileSize ? Math.min(fileSize, 32768) : 32768;
    const headB64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      length: sampleLength,
      position: 0,
    }).catch(() => null);

    if (headB64) {
      let bytes = base64ToUint8Array(headB64);
      if (bytes.length >= 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
        const version = bytes[3];
        const flags = bytes[5];
        const tagSize = readSynchSafeInt(bytes[6], bytes[7], bytes[8], bytes[9]);

        // If the tag size is larger than the sample, read the full tag up to 3MB to preserve embedded covers/lyrics
        if (tagSize + 10 > bytes.length && tagSize < 65536) {
          const fullTagB64 = await FileSystem.readAsStringAsync(fileUri, {
            encoding: FileSystem.EncodingType.Base64,
            length: Math.min(tagSize + 10, 65536),
            position: 0,
          }).catch(() => null);
          if (fullTagB64) {
            bytes = base64ToUint8Array(fullTagB64);
          }
        }

        let offset = 10;

        if (version === 4 && (flags & 0x40)) {
          if (offset + 4 <= bytes.length) {
            const extSize = readSynchSafeInt(bytes[offset], bytes[offset+1], bytes[offset+2], bytes[offset+3]);
            offset += extSize;
          }
        } else if (version === 3 && (flags & 0x40)) {
          if (offset + 4 <= bytes.length) {
            const extSize = readInt32(bytes[offset], bytes[offset+1], bytes[offset+2], bytes[offset+3]);
            offset += 4 + extSize;
          }
        }

        const maxOffset = Math.min(bytes.length, tagSize + 10);
        while (offset + (version === 2 ? 6 : 10) <= maxOffset) {
          if (bytes[offset] === 0) break;

          let frameId = '';
          let frameSize = 0;

          if (version === 2) {
            frameId = String.fromCharCode(bytes[offset], bytes[offset+1], bytes[offset+2]);
            frameSize = (bytes[offset+3] << 16) | (bytes[offset+4] << 8) | bytes[offset+5];
            offset += 6;
          } else {
            frameId = String.fromCharCode(bytes[offset], bytes[offset+1], bytes[offset+2], bytes[offset+3]);
            if (version === 4) {
              frameSize = readSynchSafeInt(bytes[offset+4], bytes[offset+5], bytes[offset+6], bytes[offset+7]);
            } else {
              frameSize = readInt32(bytes[offset+4], bytes[offset+5], bytes[offset+6], bytes[offset+7]);
            }
            offset += 10;
          }

          if (frameSize <= 0 || offset + frameSize > bytes.length) {
            break;
          }

          const frameData = bytes.slice(offset, offset + frameSize);
          offset += frameSize;

          if (frameData.length === 0) continue;
          const encoding = frameData[0];

          if ((frameId === 'TIT2' || frameId === 'TT2') && !result.title) {
            const text = decodeId3String(frameData.slice(1), encoding);
            if (text) result.title = text;
          } else if ((frameId === 'TPE1' || frameId === 'TP1') && !result.artist) {
            const text = decodeId3String(frameData.slice(1), encoding);
            if (text) result.artist = text;
          } else if ((frameId === 'TALB' || frameId === 'TAL') && !result.album) {
            const text = decodeId3String(frameData.slice(1), encoding);
            if (text) result.album = text;
          } else if ((frameId === 'USLT' || frameId === 'ULT') && !result.lyrics) {
            if (frameData.length > 4) {
              let descEnd = 4;
              if (encoding === 1 || encoding === 2) {
                while (descEnd + 1 < frameData.length && (frameData[descEnd] !== 0 || frameData[descEnd + 1] !== 0)) {
                  descEnd += 2;
                }
                descEnd += 2;
              } else {
                while (descEnd < frameData.length && frameData[descEnd] !== 0) {
                  descEnd++;
                }
                descEnd++;
              }
              const lyricsText = decodeId3String(frameData.slice(descEnd), encoding);
              if (lyricsText && lyricsText.length > 5) {
                const parsed = parseLrcLyrics(lyricsText);
                result.lyrics = (parsed && parsed.length > 0) ? parsed : lyricsText;
                result.rawLyrics = lyricsText;
              }
            }
          } else if (frameId === 'SYLT' && !result.lyrics) {
            const text = decodeId3String(frameData.slice(6), encoding);
            if (text && text.length > 5) {
              const parsed = parseLrcLyrics(text);
              result.lyrics = (parsed && parsed.length > 0) ? parsed : text;
              result.rawLyrics = text;
            }
          } else if ((frameId === 'APIC' || frameId === 'PIC') && !result.coverUrl && trackId) {
            try {
              let imgStart = -1;
              for (let j = 1; j < frameData.length - 3; j++) {
                if (frameData[j] === 0xFF && frameData[j+1] === 0xD8 && frameData[j+2] === 0xFF) {
                  imgStart = j;
                  break;
                }
                if (frameData[j] === 0x89 && frameData[j+1] === 0x50 && frameData[j+2] === 0x4E && frameData[j+3] === 0x47) {
                  imgStart = j;
                  break;
                }
              }
              if (imgStart !== -1 && imgStart < frameData.length - 100) {
                const imgBytes = frameData.slice(imgStart);
                const imgB64 = uint8ArrayToBase64(imgBytes);
                const coverTarget = `${COVERS_DIR}${trackId}.jpg`;
                await FileSystem.writeAsStringAsync(coverTarget, imgB64, {
                  encoding: FileSystem.EncodingType.Base64,
                });
                if (PERSISTENT_DIR) {
                  await FileSystem.writeAsStringAsync(`${PERSISTENT_DIR}${trackId}.jpg`, imgB64, {
                    encoding: FileSystem.EncodingType.Base64,
                  }).catch(() => {});
                }
                result.coverUrl = coverTarget;
              }
            } catch (covErr) {
              console.warn('[ID3] cover extraction error:', covErr.message);
            }
          }
        }
      }
    }

    if ((!result.title || !result.artist) && fileSize && fileSize >= 128) {
      const tailB64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
        length: 128,
        position: fileSize - 128,
      }).catch(() => null);

      if (tailB64) {
        const tailBytes = base64ToUint8Array(tailB64);
        if (tailBytes.length >= 128 && tailBytes[0] === 0x54 && tailBytes[1] === 0x41 && tailBytes[2] === 0x47) {
          if (!result.title) {
            const t = decodeId3String(tailBytes.slice(3, 33), 0);
            if (t) result.title = t;
          }
          if (!result.artist) {
            const a = decodeId3String(tailBytes.slice(33, 63), 0);
            if (a) result.artist = a;
          }
          if (!result.album) {
            const al = decodeId3String(tailBytes.slice(63, 93), 0);
            if (al) result.album = al;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[ID3] extractId3Metadata failed:', err.message);
  }

  return result;
}

export function parseAudioMetadataFromFilename(filename) {
  if (!filename) return { title: 'Local Track', artist: 'Local Import' };
  let name = filename.replace(/\.(mp3|m4a|wav|aac|flac|ogg|opus)$/i, '').trim();
  if (/^[a-f0-9]{24}$/i.test(name)) {
    return { title: '', artist: '', isMongoId: true };
  }
  name = cleanMetadataString(name, 'Local Track');

  if (name.includes(' - ')) {
    const parts = name.split(' - ');
    const artist = cleanMetadataString(parts[0], 'Local Artist');
    const title = cleanMetadataString(parts.slice(1).join(' - '), 'Local Track');
    return { title, artist };
  }

  if (name.includes(' _ ')) {
    const parts = name.split(' _ ');
    const artist = cleanMetadataString(parts[0], 'Local Artist');
    const title = cleanMetadataString(parts.slice(1).join(' _ '), 'Local Track');
    return { title, artist };
  }

  return {
    title: name || 'Local Track',
    artist: 'Local Import',
  };
}

export const importAudioFolderFromDevice = async () => {
  try {
    if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
      const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permissions.granted) {
        return { success: false, count: 0, tracks: [], message: 'Permission not granted' };
      }
      const dirUri = permissions.directoryUri;
      const fileUris = await FileSystem.StorageAccessFramework.readDirectoryAsync(dirUri);

      const audioUris = (fileUris || []).filter(uri => {
        const decoded = decodeURIComponent(uri).toLowerCase();
        return /\.(mp3|m4a|wav|aac|flac|ogg|opus)$/i.test(decoded);
      });

      if (audioUris.length === 0) {
        return { success: false, count: 0, tracks: [], message: 'No audio files found in selected folder' };
      }

      await ensureDirs();
      const existing = await getDownloadedTracks();
      const existingUris = new Set(existing.map(t => t.localAudioUri || t.nativeAudioUri || t.audioUrl));
      const newTracks = [];

      for (const uri of audioUris) {
        try {
          if (existingUris.has(uri)) continue;
          const decoded = decodeURIComponent(uri);
          const parts = decoded.split('/');
          const rawName = parts[parts.length - 1] || 'Track.mp3';
          const cleanName = rawName.replace(/^.*%2F/, '');
          const fileId = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          
          const id3Meta = await extractId3Metadata(uri, fileId);
          const { title: filenameTitle, artist: filenameArtist } = parseAudioMetadataFromFilename(cleanName);

          const title = cleanMetadataString(id3Meta.title || filenameTitle || cleanName.replace(/\.[^/.]+$/, ''), 'Local Track');
          const artist = cleanMetadataString(id3Meta.artist || (filenameArtist !== 'Local Import' ? filenameArtist : null) || 'Device Music', 'Device Music');
          const album = cleanMetadataString(id3Meta.album || 'Device Music Folder', 'Device Music Folder');
          const coverUrl = id3Meta.coverUrl || null;
          const lyrics = id3Meta.lyrics ? parseLrcLyrics(id3Meta.lyrics) : null;

          const newTrack = {
            id: fileId,
            _id: fileId,
            title,
            artist,
            album,
            source: 'Device Folder',
            publisher: 'Device Folder',
            signature: 'Device Folder',
            localAudioUri: uri,
            nativeAudioUri: uri,
            audioUrl: uri,
            coverUrl,
            cover: coverUrl,
            lyrics,
            embeddedLyrics: lyrics,
            isDownloaded: true,
            downloaded: true,
            isLocalImport: true,
            isDirectFolderLink: true,
            downloadedAt: new Date().toISOString(),
            fileSize: 0,
          };

          newTracks.push(newTrack);
        } catch (e) {
          console.warn('[downloadManager] Error indexing folder track:', uri, e);
        }
      }

      if (newTracks.length > 0) {
        const updated = deduplicateTrackList([...newTracks, ...existing]);
        await saveToStorageAndManifest(updated);
        return { success: true, count: newTracks.length, tracks: updated };
      }

      return { success: true, count: 0, tracks: existing, message: 'Folder tracks are already indexed' };
    }

    // Fallback for iOS or platforms without SAF
    return await importLocalAudioFiles();
  } catch (err) {
    console.warn('[downloadManager] importAudioFolderFromDevice failed:', err);
    throw err;
  }
};

export const importLocalAudioFiles = async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: Platform.OS === 'ios'
        ? ['public.audio', 'public.mp3', 'com.apple.m4a-audio', 'audio/*']
        : ['audio/*'],
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { success: false, count: 0, tracks: [] };
    }

    await ensureDirs();
    const existing = await getDownloadedTracks();
    const newTracks = [];

    for (const asset of result.assets) {
      try {
        const originalName = asset.name || 'local_audio.mp3';
        const extMatch = originalName.match(/\.(mp3|m4a|wav|aac|flac|ogg|opus)$/i);
        const ext = extMatch ? extMatch[1].toLowerCase() : 'mp3';
        const fileId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const destAudioPath = `${TRACKS_DIR}${fileId}.${ext}`;

        await FileSystem.copyAsync({
          from: asset.uri,
          to: destAudioPath,
        });

        const { title: filenameTitle, artist: filenameArtist } = parseAudioMetadataFromFilename(originalName);
        const id3Meta = await extractId3Metadata(destAudioPath, fileId);

        const title = cleanMetadataString(id3Meta.title || filenameTitle || originalName.replace(/\.[^/.]+$/, ''), 'Local Track');
        const artist = cleanMetadataString(id3Meta.artist || filenameArtist || 'Local Import', 'Local Artist');
        const album = cleanMetadataString(id3Meta.album || 'Device Storage', 'Device Storage');
        const coverUrl = id3Meta.coverUrl || null;
        const lyrics = id3Meta.lyrics ? parseLrcLyrics(id3Meta.lyrics) : null;

        const newTrack = {
          id: fileId,
          _id: fileId,
          title,
          artist,
          album,
          source: 'Local',
          publisher: 'Local',
          signature: 'Local',
          localAudioUri: destAudioPath,
          nativeAudioUri: destAudioPath,
          audioUrl: destAudioPath,
          coverUrl,
          cover: coverUrl,
          lyrics,
          embeddedLyrics: lyrics,
          isDownloaded: true,
          downloaded: true,
          isLocalImport: true,
          downloadedAt: new Date().toISOString(),
          fileSize: asset.size || 0,
        };

        newTracks.push(newTrack);
      } catch (fileErr) {
        console.warn('[downloadManager] Error importing single file:', asset.name, fileErr);
      }
    }

    if (newTracks.length > 0) {
      const updated = deduplicateTrackList([...newTracks, ...existing]);
      await saveToStorageAndManifest(updated);
      return { success: true, count: newTracks.length, tracks: updated };
    }

    return { success: false, count: 0, tracks: existing };
  } catch (err) {
    console.warn('[downloadManager] importLocalAudioFiles failed:', err);
    throw err;
  }
};

export const scanOfflineVault = async () => {
  await ensureDirs();
  const existing = await getDownloadedTracks();
  const existingUris = new Set(existing.map(t => t.localAudioUri || t.nativeAudioUri || t.audioUrl));
  const existingIds = new Set(existing.map(t => String(t._id || t.id)));
  const existingKeys = new Set(existing.map(getTrackDedupeKey).filter(Boolean));

  let newlyFound = 0;
  const newTracks = [];

  // 1. Scan primary TRACKS_DIR
  try {
    const tFiles = await FileSystem.readDirectoryAsync(TRACKS_DIR);
    for (const f of tFiles) {
      if (!/\.(mp3|m4a|wav|aac|flac|ogg)$/i.test(f)) continue;
      const fileUri = `${TRACKS_DIR}${f}`;
      const baseId = f.replace(/\.(mp3|m4a|wav|aac|flac|ogg)$/i, '');
      if (existingIds.has(baseId) || existingUris.has(fileUri)) continue;

      const info = await FileSystem.getInfoAsync(fileUri);
      if (!info.exists || info.size < 5000) continue;

      const isMongoId = /^[a-f0-9]{24}$/i.test(baseId);
      const id3Meta = isMongoId ? { title: null, artist: null, album: null, lyrics: null, coverUrl: null } : await extractId3Metadata(fileUri, baseId);
      const { title: fTitle, artist: fArtist } = parseAudioMetadataFromFilename(f);
      const title = cleanMetadataString(id3Meta.title || fTitle, isMongoId ? 'Rivo Track' : 'Offline Track');
      const artist = cleanMetadataString(id3Meta.artist || fArtist, isMongoId ? 'Rivo Artist' : 'Offline Artist');
      const album = cleanMetadataString(id3Meta.album || 'Offline Vault', 'Offline Vault');
      const dedupeKey = getTrackDedupeKey({ title, artist, id: baseId });
      if (dedupeKey && existingKeys.has(dedupeKey)) continue;

      const coverUri = `${COVERS_DIR}${baseId}.jpg`;
      const coverInfo = await FileSystem.getInfoAsync(coverUri).catch(() => ({ exists: false }));
      const coverUrl = id3Meta.coverUrl || (coverInfo.exists ? coverUri : null);

      const newTrack = {
        id: baseId,
        _id: baseId,
        title,
        artist,
        album,
        source: 'Vault',
        publisher: 'Rivo',
        signature: 'Rivo',
        localAudioUri: fileUri,
        nativeAudioUri: fileUri,
        audioUrl: fileUri,
        coverUrl,
        cover: coverUrl,
        lyrics: id3Meta.lyrics || null,
        embeddedLyrics: id3Meta.lyrics || null,
        isDownloaded: true,
        downloaded: true,
        isLocalImport: true,
        downloadedAt: new Date().toISOString(),
        fileSize: info.size,
      };
      newTracks.push(newTrack);
      existingIds.add(baseId);
      existingUris.add(fileUri);
      if (dedupeKey) existingKeys.add(dedupeKey);
      newlyFound++;
    }
  } catch (err) {
    console.warn('[downloadManager] scan TRACKS_DIR error:', err.message);
  }

  // 2. Scan iOS Document Directory (files dropped directly into Files app: On My iPhone > Rivo)
  if (Platform.OS === 'ios') {
    try {
      const docFiles = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
      for (const df of docFiles) {
        if (!/\.(mp3|m4a|wav|aac|flac|ogg)$/i.test(df)) continue;
        const srcUri = `${FileSystem.documentDirectory}${df}`;
        const targetUri = `${TRACKS_DIR}${df}`;

        const check = await FileSystem.getInfoAsync(targetUri).catch(() => ({ exists: false }));
        if (!check.exists) {
          await FileSystem.copyAsync({ from: srcUri, to: targetUri }).catch(() => {});
        }

        const baseId = df.replace(/\.(mp3|m4a|wav|aac|flac|ogg)$/i, '');
        if (!existingIds.has(baseId) && !existingUris.has(targetUri)) {
          const info = await FileSystem.getInfoAsync(targetUri);
          const id3Meta = await extractId3Metadata(targetUri, baseId);
          const { title: fTitle, artist: fArtist } = parseAudioMetadataFromFilename(df);
          const title = cleanMetadataString(id3Meta.title || fTitle, 'Offline Track');
          const artist = cleanMetadataString(id3Meta.artist || fArtist, 'Offline Artist');
          const album = cleanMetadataString(id3Meta.album || 'Files App', 'Files App');
          const dedupeKey = getTrackDedupeKey({ title, artist, id: `ios_${baseId}` });
          if (dedupeKey && existingKeys.has(dedupeKey)) continue;

          const coverUri = `${COVERS_DIR}${baseId}.jpg`;
          const coverInfo = await FileSystem.getInfoAsync(coverUri).catch(() => ({ exists: false }));
          const coverUrl = id3Meta.coverUrl || (coverInfo.exists ? coverUri : null);

          const newTrack = {
            id: `ios_${baseId}`,
            _id: `ios_${baseId}`,
            title,
            artist,
            album,
            source: 'Local',
            publisher: 'Rivo',
            signature: 'Rivo',
            localAudioUri: targetUri,
            nativeAudioUri: targetUri,
            audioUrl: targetUri,
            coverUrl,
            cover: coverUrl,
            lyrics: id3Meta.lyrics || null,
            embeddedLyrics: id3Meta.lyrics || null,
            isDownloaded: true,
            downloaded: true,
            isLocalImport: true,
            downloadedAt: new Date().toISOString(),
            fileSize: info.size || 0,
          };
          newTracks.push(newTrack);
          existingIds.add(newTrack.id);
          existingUris.add(targetUri);
          if (dedupeKey) existingKeys.add(dedupeKey);
          newlyFound++;
        }
      }
    } catch (err) {
      console.warn('[downloadManager] scan iOS docFiles error:', err.message);
    }
  }

  // 3. Scan Android PERSISTENT_DIR (/Music/Rivo/)
  if (Platform.OS === 'android' && PERSISTENT_DIR) {
    try {
      const pInfo = await FileSystem.getInfoAsync(PERSISTENT_DIR);
      if (pInfo.exists) {
        const pFiles = await FileSystem.readDirectoryAsync(PERSISTENT_DIR);
        for (const pf of pFiles) {
          if (!/\.(mp3|m4a|wav|aac|flac|ogg)$/i.test(pf)) continue;
          const pSrcUri = `${PERSISTENT_DIR}${pf}`;
          const targetUri = `${TRACKS_DIR}${pf}`;

          const check = await FileSystem.getInfoAsync(targetUri).catch(() => ({ exists: false }));
          if (!check.exists) {
            await FileSystem.copyAsync({ from: pSrcUri, to: targetUri }).catch(() => {});
          }

          const baseId = pf.replace(/\.(mp3|m4a|wav|aac|flac|ogg)$/i, '');
          if (!existingIds.has(baseId) && !existingUris.has(targetUri)) {
            const info = await FileSystem.getInfoAsync(targetUri);
            const id3Meta = await extractId3Metadata(targetUri, baseId);
            const { title: fTitle, artist: fArtist } = parseAudioMetadataFromFilename(pf);
            const title = cleanMetadataString(id3Meta.title || fTitle, 'Offline Track');
            const artist = cleanMetadataString(id3Meta.artist || fArtist, 'Offline Artist');
            const album = cleanMetadataString(id3Meta.album || 'Music Vault', 'Music Vault');
            const dedupeKey = getTrackDedupeKey({ title, artist, id: baseId });
            if (dedupeKey && existingKeys.has(dedupeKey)) continue;

            const coverUri = `${COVERS_DIR}${baseId}.jpg`;
            const coverInfo = await FileSystem.getInfoAsync(coverUri).catch(() => ({ exists: false }));
            const coverUrl = id3Meta.coverUrl || (coverInfo.exists ? coverUri : null);

            const newTrack = {
              id: baseId,
              _id: baseId,
              title,
              artist,
              album,
              source: 'Local',
              publisher: 'Rivo',
              signature: 'Rivo',
              localAudioUri: targetUri,
              nativeAudioUri: targetUri,
              audioUrl: targetUri,
              coverUrl,
              cover: coverUrl,
              lyrics: id3Meta.lyrics || null,
              embeddedLyrics: id3Meta.lyrics || null,
              isDownloaded: true,
              downloaded: true,
              isLocalImport: true,
              downloadedAt: new Date().toISOString(),
              fileSize: info.size || 0,
            };
            newTracks.push(newTrack);
            existingIds.add(baseId);
            existingUris.add(targetUri);
            if (dedupeKey) existingKeys.add(dedupeKey);
            newlyFound++;
          }
        }
      }
    } catch (err) {
      console.warn('[downloadManager] scan PERSISTENT_DIR error:', err.message);
    }
  }

  // 4. Enrich existing tracks with missing metadata, cover art, or lyrics
  let enrichedCount = 0;
  const enrichedExisting = await Promise.all((existing || []).map(async (t) => {
    if (!t) return t;
    const uri = t.localAudioUri || t.nativeAudioUri || t.audioUrl;
    const needsEnrichment = !t.coverUrl || !t.lyrics || t.artist === 'Local Import' || t.artist === 'Device Music' || /\(mp3_\d+k\)/i.test(t.title || '');
    if (!uri || !needsEnrichment) return t;

    try {
      const fileId = t.id || t._id || `track_${Date.now()}`;
      const id3Meta = await extractId3Metadata(uri, fileId);
      let updated = false;
      const copy = { ...t };

      if (id3Meta.title && id3Meta.title !== copy.title) {
        copy.title = cleanMetadataString(id3Meta.title, copy.title);
        updated = true;
      } else if (copy.title) {
        const cleaned = cleanMetadataString(copy.title, copy.title);
        if (cleaned !== copy.title) {
          copy.title = cleaned;
          updated = true;
        }
      }

      if (id3Meta.artist && (copy.artist === 'Local Import' || copy.artist === 'Device Music' || !copy.artist)) {
        copy.artist = cleanMetadataString(id3Meta.artist, copy.artist);
        updated = true;
      }

      if (id3Meta.album && (copy.album === 'Device Music Folder' || !copy.album)) {
        copy.album = cleanMetadataString(id3Meta.album, copy.album);
        updated = true;
      }

      if (!copy.coverUrl && id3Meta.coverUrl) {
        copy.coverUrl = id3Meta.coverUrl;
        copy.cover = id3Meta.coverUrl;
        updated = true;
      }

      if (!copy.lyrics && id3Meta.lyrics) {
        const parsed = parseLrcLyrics(id3Meta.lyrics);
        copy.lyrics = parsed;
        copy.embeddedLyrics = parsed;
        updated = true;
      }

      if (updated) {
        enrichedCount++;
        return copy;
      }
    } catch (e) {
      console.warn('[downloadManager] error enriching track:', t.title, e.message);
    }
    return t;
  }));

  const allTracks = [...newTracks, ...enrichedExisting];
  if (newTracks.length > 0 || enrichedCount > 0) {
    const updated = deduplicateTrackList(allTracks);
    await saveToStorageAndManifest(updated);
    return { newlyFound: newlyFound + enrichedCount, tracks: updated };
  }

  return { newlyFound: 0, tracks: existing };
};

export const getStorageLocationInfo = async () => {
  const isAndroid = Platform.OS === 'android';
  const isIOS = Platform.OS === 'ios';

  let folderLabel = isAndroid
    ? 'Phone Storage: /Music/Rivo/'
    : isIOS
    ? 'Files App: On My iPhone > Rivo'
    : 'Local App Storage';

  let totalSize = 0;
  let count = 0;

  try {
    const dirInfo = await FileSystem.getInfoAsync(TRACKS_DIR);
    if (dirInfo.exists) {
      const files = await FileSystem.readDirectoryAsync(TRACKS_DIR);
      for (const file of files) {
        if (/\.(mp3|m4a|wav|aac|flac|ogg)$/i.test(file)) {
          count++;
          try {
            const fInfo = await FileSystem.getInfoAsync(`${TRACKS_DIR}${file}`);
            if (fInfo.exists && fInfo.size) totalSize += fInfo.size;
          } catch {}
        }
      }
    }
  } catch {}

  return {
    isAndroid,
    isIOS,
    folderLabel,
    tracksDir: TRACKS_DIR,
    persistentDir: PERSISTENT_DIR,
    totalCount: count,
    totalBytes: totalSize,
  };
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
    await saveToStorageAndManifest(cleaned);
  }
};

export const exportTrackAudioFile = async (track) => {
  if (!track) throw new Error('No track provided');
  const trackId = String(track._id || track.id || '');

  // 1. Locate the physical audio file
  let sourceUri = track.localAudioUri;
  if (sourceUri && typeof sourceUri === 'string' && sourceUri.startsWith('file://')) {
    const info = await FileSystem.getInfoAsync(sourceUri).catch(() => null);
    if (!info || !info.exists) {
      sourceUri = null;
    }
  } else {
    sourceUri = null;
  }

  if (!sourceUri) {
    const candidates = [
      `${TRACKS_DIR}${trackId}.mp3`,
      `${TRACKS_DIR}${trackId}.m4a`,
      `${TRACKS_DIR}${trackId}.wav`,
      `${TRACKS_DIR}${trackId}.aac`,
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

  if (!sourceUri) {
    const all = await getDownloadedTracks();
    const found = all.find(t => String(t._id || t.id) === trackId);
    if (found && found.localAudioUri) {
      sourceUri = found.localAudioUri;
    }
  }

  if (!sourceUri) {
    throw new Error('Audio file not found on disk. Please ensure track is downloaded.');
  }

  // 2. Prepare a clean human-friendly filename
  const cleanStr = (s) => (s || '').replace(/[/\\?%*:|"<>]/g, '_').trim();
  const rawTitle = cleanStr(track.title) || 'Track';
  const rawArtist = cleanStr(track.artist) || 'Rivo';
  const extMatch = sourceUri.match(/\.(mp3|m4a|wav|aac|flac|ogg)$/i);
  const ext = extMatch ? extMatch[1].toLowerCase() : 'mp3';
  const cleanFileName = `${rawTitle} - ${rawArtist}.${ext}`;

  // 3. Create a clean file in cacheDirectory
  const targetUri = `${FileSystem.cacheDirectory}${cleanFileName}`;
  try {
    await FileSystem.copyAsync({
      from: sourceUri,
      to: targetUri,
    });
  } catch (e) {
    await FileSystem.deleteAsync(targetUri, { idempotent: true }).catch(() => {});
    await FileSystem.copyAsync({ from: sourceUri, to: targetUri });
  }

  // 4. Share / Export natively
  if (Platform.OS === 'ios') {
    await Share.share({
      url: targetUri,
      title: `${rawTitle} - ${rawArtist}`,
    });
  } else {
    try {
      if (FileSystem.StorageAccessFramework) {
        const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
        if (permissions && permissions.granted) {
          const mimeType = ext === 'm4a' ? 'audio/mp4' : 'audio/mpeg';
          const newFileUri = await FileSystem.StorageAccessFramework.createFileAsync(
            permissions.directoryUri,
            cleanFileName,
            mimeType
          );
          const base64 = await FileSystem.readAsStringAsync(targetUri, {
            encoding: FileSystem.EncodingType.Base64,
          });
          await FileSystem.writeAsStringAsync(newFileUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          return { success: true, uri: newFileUri, method: 'saf' };
        }
      }
    } catch (safErr) {
      console.warn('SAF export fallback:', safErr);
    }

    await Share.share({
      url: targetUri,
      title: `${rawTitle} - ${rawArtist}`,
    });
  }

  return { success: true, uri: targetUri };
};
