import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  resolveAudioStream,
  resolveClientSideYouTubeStream,
  extractYouTubeId,
  getStreamFromCache,
  getStreamDurationFromCache,
} from './youtubeResolver';
import { parseLrcLyrics } from '../../utils/lrcParser';
import { API_BASE_URL } from '../config';

const sanitizeDuration = (val, fallback = 210) => {
  if (val === undefined || val === null) return fallback;
  const num = Number(val);
  if (!isFinite(num) || isNaN(num) || num <= 0) return fallback;
  if (num > 10000) return Math.max(1, Math.round(num / 1000));
  if (num > 86400) return fallback;
  return Math.round(num);
};

const TRACKS_DIR = `${FileSystem.documentDirectory}rivo_tracks/`;
const COVERS_DIR = `${FileSystem.documentDirectory}rivo_covers/`;
const MANIFEST_FILE = `${TRACKS_DIR}manifest.json`;
const STORAGE_KEY = '@rivo_offline_tracks_v2';

// Dedicated persistent external music vault (persists across full app uninstalls & reinstalls)
const PERSISTENT_DIR = Platform.OS === 'android' ? 'file:///storage/emulated/0/Music/Rivo/' : null;
const PERSISTENT_MANIFEST = PERSISTENT_DIR ? `${PERSISTENT_DIR}manifest.json` : null;

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
            list.forEach(t => {
              const tid = String(t._id || t.id);
              if (tid && !existingIds.has(tid)) {
                tracks.push(t);
                existingIds.add(tid);
              }
            });
          }
        }
      } catch {}
    }

    // 4. Physical Disk Reconciliation: Scan TRACKS_DIR on device
    try {
      const dirInfo = await FileSystem.getInfoAsync(TRACKS_DIR);
      if (dirInfo.exists) {
        const diskFiles = await FileSystem.readDirectoryAsync(TRACKS_DIR);
        const trackMap = new Map(tracks.map(t => [String(t._id || t.id), t]));
        let modified = false;

        for (const file of diskFiles) {
          if (!file.endsWith('.mp3') && !file.endsWith('.m4a') && !file.endsWith('.mp4')) continue;
          const trackId = file.replace(/\.(mp3|m4a|mp4)$/i, '');
          if (!trackId || trackId === 'temp') continue;

          const fileUri = `${TRACKS_DIR}${file}`;
          const fInfo = await FileSystem.getInfoAsync(fileUri);
          if (!fInfo.exists || fInfo.size < 10000) continue;

          const existing = trackMap.get(trackId);
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
            // File is on device disk but missing from index (e.g. after APK update) -> auto recover with ID3 tags & lyrics!
            const coverUri = `${COVERS_DIR}${trackId}.jpg`;
            const coverInfo = await FileSystem.getInfoAsync(coverUri).catch(() => ({ exists: false }));
            const id3Meta = await extractId3Metadata(fileUri, trackId);
            const { title: fTitle, artist: fArtist } = parseAudioMetadataFromFilename(file);
            const resolvedTitle = cleanMetadataString(id3Meta.title || fTitle || trackId, 'Offline Track');
            const resolvedArtist = cleanMetadataString(id3Meta.artist || fArtist, 'Offline Artist');
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
            modified = true;
          }
        }

        // Verify and filter invalid records
        const verified = tracks.filter(t =>
          t &&
          t.source !== 'SoundCloud' &&
          t.album !== 'SoundCloud' &&
          !String(t.audioUrl || '').includes('soundcloud.com') &&
          !String(t.id || t._id || '').startsWith('sc-')
        );

        if (modified || verified.length !== tracks.length) {
          tracks = verified;
          await saveToStorageAndManifest(tracks);
        }
      }
    } catch (diskErr) {
      console.warn('[downloadManager] disk reconciliation error:', diskErr.message);
    }

    return tracks;
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
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || fallback;
}

export const downloadTrack = async (track, onProgress) => {
  if (!track) throw new Error('No track provided');
  await ensureDirs();

  const trackId = String(track._id || track.id);
  const audioFileUriMp3 = `${TRACKS_DIR}${trackId}.mp3`;
  const audioFileUriM4a = `${TRACKS_DIR}${trackId}.m4a`;
  const coverFileUri = `${COVERS_DIR}${trackId}.jpg`;
  const cleanTitle = cleanMetadataString(track.title, 'Track');
  const cleanArtist = cleanMetadataString(track.artist, 'Artist');
  const cleanAlbum = (!track.album || /https?:\/\/|www\.|youtube|liofy/i.test(track.album))
    ? (cleanTitle || 'Single')
    : cleanMetadataString(track.album, cleanTitle || 'Single');

  if (onProgress) onProgress(5);

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
      const updated = [record, ...existing.filter(t => String(t._id || t.id) !== trackId)];
      await saveToStorageAndManifest(updated);
      return record;
    }
  } catch {}

  let resolvedDuration = null;

  // Extract YouTube ID if present
  const rawUrl = track.audioUrl || track.url || '';
  const ytId = extractYouTubeId(rawUrl) ||
               (track.source === 'YouTube' ? extractYouTubeId(trackId) : null);

  // Gather candidate download URLs in order of priority
  const candidates = [];

  // Candidate 0: In-memory stream cache (Instant download if track was recently played or resolved)
  const cachedStream = getStreamFromCache(trackId);
  const cachedDur = getStreamDurationFromCache(trackId);
  if (cachedDur) resolvedDuration = cachedDur;
  if (cachedStream && typeof cachedStream === 'string' && cachedStream.startsWith('http') && !cachedStream.includes('youtube.com/watch') && !cachedStream.includes('youtu.be/')) {
    candidates.push({ url: cachedStream, ext: cachedStream.includes('.m4a') ? 'm4a' : 'mp3' });
  }

  // Candidate 1: Direct remote audio URL (if already a clean remote audio file)
  const isDirectRemote = (u) => typeof u === 'string' && u.startsWith('http') && !u.includes('youtube.com') && !u.includes('youtu.be') && !u.includes('soundcloud.com');
  if (isDirectRemote(track.audioUrl)) candidates.push({ url: track.audioUrl, ext: track.audioUrl.includes('.m4a') ? 'm4a' : 'mp3' });
  if (isDirectRemote(track.nativeAudioUri)) candidates.push({ url: track.nativeAudioUri, ext: track.nativeAudioUri.includes('.m4a') ? 'm4a' : 'mp3' });

  // Candidate 2: Ultra-fast Direct Client-side YouTube Audio Stream Resolution (resolves official Googlevideo stream directly on device in <1s)
  if (ytId) {
    try {
      if (onProgress) onProgress(10);
      const ytRes = await resolveClientSideYouTubeStream(ytId);
      const directGoogleStream = typeof ytRes === 'string' ? ytRes : ytRes?.url;
      if (ytRes?.duration) resolvedDuration = ytRes.duration;

      if (directGoogleStream && typeof directGoogleStream === 'string' && directGoogleStream.startsWith('http')) {
        // High-speed direct stream from Google CDN edge directly to device storage first (<1-2s)
        candidates.push({ url: directGoogleStream, ext: 'm4a' });
        // Proxied URL fallback with Range header support in case of direct CDN blockage
        const proxyStreamUrl = `${API_BASE_URL}/api/tracks/stream-proxy?url=${encodeURIComponent(directGoogleStream)}`;
        candidates.push({ url: proxyStreamUrl, ext: 'm4a' });
      }
    } catch (e) {
      console.warn('[downloadManager] Direct client-side YouTube stream resolution error:', e.message);
    }
  }

  // Candidate 3: Backend Direct Downloader endpoint
  const backendDownloadUrl = `${API_BASE_URL}/api/tracks/download?url=${encodeURIComponent(track.audioUrl || '')}&title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}&id=${encodeURIComponent(trackId)}`;
  candidates.push({ url: backendDownloadUrl, ext: 'm4a' });

  if (onProgress) onProgress(15);

  let success = false;
  // Use matching Safari/VisionOS headers to prevent Google Video CDN 403 Forbidden and speed throttling
  const downloadHeaders = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
    'Accept': '*/*',
    'Accept-Encoding': 'identity',
    'Connection': 'keep-alive',
  };

  // Try candidate URLs one by one until one produces a valid audio file
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const targetUrl = candidate.url;
    const chosenAudioUri = candidate.ext === 'm4a' ? audioFileUriM4a : audioFileUriMp3;

    try {
      // First clean up any corrupted partial file
      await FileSystem.deleteAsync(chosenAudioUri, { idempotent: true }).catch(() => {});

      let res = null;
      // Per-candidate timeout (15s) so a stalled stream connection never hangs the download
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Download candidate timeout')), 15000)
      );

      try {
        const downloadResumable = FileSystem.createDownloadResumable(
          targetUrl,
          chosenAudioUri,
          { headers: downloadHeaders },
          (progressEvent) => {
            if (progressEvent.totalBytesExpectedToWrite > 0) {
              const progress = progressEvent.totalBytesWritten / progressEvent.totalBytesExpectedToWrite;
              if (onProgress) onProgress(Math.min(90, Math.round(15 + progress * 75)));
            } else {
              if (onProgress) onProgress(50);
            }
          }
        );
        res = await Promise.race([downloadResumable.downloadAsync(), timeoutPromise]);
      } catch (resumeErr) {
        try {
          res = await Promise.race([
            FileSystem.downloadAsync(targetUrl, chosenAudioUri, { headers: downloadHeaders }),
            timeoutPromise
          ]);
        } catch (dlErr) {}
      }

      if (res && (res.status === 200 || res.status === 206)) {
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
            console.warn(`[downloadManager] Candidate ${i + 1} returned text/html/json error payload instead of audio`);
            await FileSystem.deleteAsync(chosenAudioUri, { idempotent: true }).catch(() => {});
          }
        }
      }
    } catch (candidateErr) {
      console.warn(`[downloadManager] Candidate ${i + 1} failed:`, candidateErr.message);
    }
  }

  // If first-tier candidates failed, try direct client-side YouTube resolution as fallback
  if (!success && ytId) {
    try {
      if (onProgress) onProgress(30);
      const mirrorRes = await resolveClientSideYouTubeStream(ytId);
      const mirrorUrl = typeof mirrorRes === 'string' ? mirrorRes : mirrorRes?.url;
      if (mirrorRes?.duration) resolvedDuration = mirrorRes.duration;

      if (mirrorUrl) {
        await FileSystem.deleteAsync(audioFileUriM4a, { idempotent: true }).catch(() => {});
        const mirrorDownloadRes = await FileSystem.downloadAsync(mirrorUrl, audioFileUriM4a, { headers: downloadHeaders });
        if (mirrorDownloadRes && (mirrorDownloadRes.status === 200 || mirrorDownloadRes.status === 206)) {
          const check = await FileSystem.getInfoAsync(audioFileUriM4a);
          if (check.exists && check.size > 10000) {
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

  if (onProgress) onProgress(92);

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
    localAudioUri: audioFileUri,
    nativeAudioUri: audioFileUri,
    audioUrl: audioFileUri,
    duration: sanitizeDuration(resolvedDuration || track.duration || 210),
    coverUrl: localCover,
    cover: localCover,
    lyrics: trackLyrics,
    isDownloaded: true,
    downloaded: true,
    downloadedAt: new Date().toISOString(),
  };

  const existing = await getDownloadedTracks();
  const updated = [record, ...existing.filter(t => String(t._id || t.id) !== trackId)];
  await saveToStorageAndManifest(updated);

  if (onProgress) onProgress(100);
  return record;
};

export const removeDownloadedTrack = async (trackId) => {
  const idStr = String(trackId);
  const audioFileUriMp3 = `${TRACKS_DIR}${idStr}.mp3`;
  const audioFileUriM4a = `${TRACKS_DIR}${idStr}.m4a`;
  const coverFileUri = `${COVERS_DIR}${idStr}.jpg`;

  await FileSystem.deleteAsync(audioFileUriMp3, { idempotent: true }).catch(() => {});
  await FileSystem.deleteAsync(audioFileUriM4a, { idempotent: true }).catch(() => {});
  await FileSystem.deleteAsync(coverFileUri, { idempotent: true }).catch(() => {});

  if (PERSISTENT_DIR) {
    await FileSystem.deleteAsync(`${PERSISTENT_DIR}${idStr}.mp3`, { idempotent: true }).catch(() => {});
    await FileSystem.deleteAsync(`${PERSISTENT_DIR}${idStr}.m4a`, { idempotent: true }).catch(() => {});
    await FileSystem.deleteAsync(`${PERSISTENT_DIR}${idStr}.jpg`, { idempotent: true }).catch(() => {});
  }

  const existing = await getDownloadedTracks();
  const updated = existing.filter(t => String(t._id || t.id) !== idStr);
  await saveToStorageAndManifest(updated);
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
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists || fileInfo.size < 128) return result;

    const sampleLength = Math.min(fileInfo.size, 393216);
    const headB64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
      length: sampleLength,
      position: 0,
    }).catch(() => null);

    if (headB64) {
      const bytes = base64ToUint8Array(headB64);
      if (bytes.length >= 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
        const version = bytes[3];
        const flags = bytes[5];
        const tagSize = readSynchSafeInt(bytes[6], bytes[7], bytes[8], bytes[9]);
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

    if ((!result.title || !result.artist) && fileInfo.size >= 128) {
      const tailB64 = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
        length: 128,
        position: fileInfo.size - 128,
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

export const importLocalAudioFiles = async () => {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['audio/*'],
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

        if (PERSISTENT_DIR) {
          try {
            await FileSystem.copyAsync({
              from: destAudioPath,
              to: `${PERSISTENT_DIR}${fileId}.${ext}`,
            }).catch(() => {});
          } catch {}
        }

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
      const updated = [...newTracks, ...existing];
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

      const id3Meta = await extractId3Metadata(fileUri, baseId);
      const { title: fTitle, artist: fArtist } = parseAudioMetadataFromFilename(f);
      const title = cleanMetadataString(id3Meta.title || fTitle, 'Offline Track');
      const artist = cleanMetadataString(id3Meta.artist || fArtist, 'Offline Artist');
      const album = cleanMetadataString(id3Meta.album || 'Offline Vault', 'Offline Vault');
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
            newlyFound++;
          }
        }
      }
    } catch (err) {
      console.warn('[downloadManager] scan PERSISTENT_DIR error:', err.message);
    }
  }

  if (newTracks.length > 0) {
    const updated = [...newTracks, ...existing];
    await saveToStorageAndManifest(updated);
    return { newlyFound, tracks: updated };
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
