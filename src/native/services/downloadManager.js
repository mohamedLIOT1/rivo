import * as FileSystem from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { resolveAudioStream, resolveClientSideYouTubeStream, extractYouTubeId } from './youtubeResolver';
import { API_BASE_URL } from '../config';

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
            // File is on device disk but missing from index (e.g. after APK update) -> auto recover!
            const coverUri = `${COVERS_DIR}${trackId}.jpg`;
            const coverInfo = await FileSystem.getInfoAsync(coverUri).catch(() => ({ exists: false }));
            const recovered = {
              id: trackId,
              _id: trackId,
              title: cleanMetadataString(trackId, 'Offline Track'),
              artist: 'Offline Artist',
              album: 'Downloaded',
              source: 'Rivo',
              signature: 'Rivo',
              publisher: 'Rivo',
              localAudioUri: fileUri,
              nativeAudioUri: fileUri,
              audioUrl: fileUri,
              coverUrl: coverInfo.exists ? coverUri : null,
              cover: coverInfo.exists ? coverUri : null,
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
      let trackLyrics = track.lyrics || existingRecord?.lyrics || null;
      if (!trackLyrics || (Array.isArray(trackLyrics) && trackLyrics.length === 0)) {
        try {
          const qTitle = encodeURIComponent(cleanTitle);
          const qArtist = encodeURIComponent(cleanArtist);
          const qId = encodeURIComponent(trackId);
          const lyricsRes = await fetch(`${API_BASE_URL}/api/tracks/lyrics?trackId=${qId}&title=${qTitle}&artist=${qArtist}`);
          if (lyricsRes.ok) {
            const lyricsData = await lyricsRes.json();
            if (lyricsData?.success && lyricsData?.lyrics) {
              trackLyrics = lyricsData.lyrics;
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

  // Extract YouTube ID if present
  const rawUrl = track.audioUrl || track.url || '';
  const ytId = extractYouTubeId(rawUrl) ||
               (track.source === 'YouTube' ? extractYouTubeId(trackId) : null);

  // Gather candidate download URLs in order of priority
  const candidates = [];

  // Candidate 1: Direct remote audio URL (if already an audio file)
  const isDirectRemote = (u) => typeof u === 'string' && u.startsWith('http') && !u.includes('youtube.com') && !u.includes('youtu.be') && !u.includes('soundcloud.com');
  if (isDirectRemote(track.audioUrl)) candidates.push({ url: track.audioUrl, ext: track.audioUrl.includes('.m4a') ? 'm4a' : 'mp3' });
  if (isDirectRemote(track.nativeAudioUri)) candidates.push({ url: track.nativeAudioUri, ext: track.nativeAudioUri.includes('.m4a') ? 'm4a' : 'mp3' });

  // Candidate 2: Ultra-fast Direct Client-side YouTube Audio Stream Resolution (resolves official Googlevideo stream directly on device in <1s)
  if (ytId) {
    try {
      if (onProgress) onProgress(10);
      const directGoogleStream = await resolveClientSideYouTubeStream(ytId);
      if (directGoogleStream && typeof directGoogleStream === 'string' && directGoogleStream.startsWith('http')) {
        // High-speed proxied URL with Range header support first
        const proxyStreamUrl = `${API_BASE_URL}/api/tracks/stream-proxy?url=${encodeURIComponent(directGoogleStream)}`;
        candidates.push({ url: proxyStreamUrl, ext: 'm4a' });
        candidates.push({ url: directGoogleStream, ext: 'm4a' });
      }
    } catch (e) {
      console.warn('[downloadManager] Direct client-side YouTube stream resolution error:', e.message);
    }
  }

  // Candidate 3: Backend Direct Downloader endpoint
  const backendDownloadUrl = `${API_BASE_URL}/api/tracks/download?url=${encodeURIComponent(track.audioUrl || '')}&title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}&id=${encodeURIComponent(trackId)}`;
  candidates.push({ url: backendDownloadUrl, ext: 'm4a' });

  // Candidate 4: Backend Stream Resolver
  const isValidAudioStreamUrl = (u) => typeof u === 'string' && (u.startsWith('http') || u.startsWith('/')) && !u.includes('youtube.com/watch') && !u.includes('youtu.be/') && !u.includes('sndcdn.com/preview');

  try {
    const streamRes = await fetch(`${API_BASE_URL}/api/tracks/${encodeURIComponent(trackId)}/stream?url=${encodeURIComponent(track.audioUrl || '')}&title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}`);
    if (streamRes.ok) {
      const streamData = await streamRes.json();
      let sUrl = streamData?.url || streamData?.directUrl;
      if (isValidAudioStreamUrl(sUrl)) {
        if (sUrl.startsWith('/')) sUrl = `${API_BASE_URL}${sUrl}`;
        candidates.push({ url: sUrl, ext: sUrl.includes('.m4a') ? 'm4a' : 'mp3' });
      }
    }
  } catch (e) {}

  if (onProgress) onProgress(15);

  let success = false;
  const downloadHeaders = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    'Accept': '*/*',
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
        res = await downloadResumable.downloadAsync();
      } catch (resumeErr) {
        res = await FileSystem.downloadAsync(targetUrl, chosenAudioUri, { headers: downloadHeaders });
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

  // If backend candidates failed, try direct client-side YouTube resolution as final fallback
  if (!success && ytId) {
    try {
      if (onProgress) onProgress(30);
      const mirrorUrl = await resolveClientSideYouTubeStream(ytId);
      if (mirrorUrl) {
        await FileSystem.deleteAsync(audioFileUriM4a, { idempotent: true }).catch(() => {});
        const mirrorRes = await FileSystem.downloadAsync(mirrorUrl, audioFileUriM4a);
        if (mirrorRes && (mirrorRes.status === 200 || mirrorRes.status === 206)) {
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

  // Cover art download & local caching
  let localCover = track.coverUrl || track.cover || '';
  if (localCover && typeof localCover === 'string') {
    if (localCover.startsWith('/') && !localCover.startsWith('//')) {
      localCover = `${API_BASE_URL}${localCover}`;
    }
    if (localCover.startsWith('http')) {
      try {
        await FileSystem.downloadAsync(localCover, coverFileUri);
        localCover = coverFileUri;
      } catch {}
    }
  }

  // Lyrics fetch & embed
  let trackLyrics = track.lyrics || null;
  if (!trackLyrics || (Array.isArray(trackLyrics) && trackLyrics.length === 0)) {
    try {
      const qTitle = encodeURIComponent(cleanTitle);
      const qArtist = encodeURIComponent(cleanArtist);
      const qId = encodeURIComponent(trackId);
      const lyricsRes = await fetch(`${API_BASE_URL}/api/tracks/lyrics?trackId=${qId}&title=${qTitle}&artist=${qArtist}`);
      if (lyricsRes.ok) {
        const lyricsData = await lyricsRes.json();
        if (lyricsData?.success && lyricsData?.lyrics) {
          trackLyrics = lyricsData.lyrics;
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

        const { title, artist } = parseAudioMetadataFromFilename(originalName);

        const newTrack = {
          id: fileId,
          _id: fileId,
          title: title || originalName.replace(/\.[^/.]+$/, ''),
          artist: artist || 'Local Import',
          album: 'Device Storage',
          source: 'Local',
          publisher: 'Local',
          signature: 'Local',
          localAudioUri: destAudioPath,
          nativeAudioUri: destAudioPath,
          audioUrl: destAudioPath,
          coverUrl: null,
          cover: null,
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

      const { title, artist } = parseAudioMetadataFromFilename(f);
      const newTrack = {
        id: baseId,
        _id: baseId,
        title,
        artist,
        album: 'Offline Vault',
        source: 'Vault',
        publisher: 'Rivo',
        signature: 'Rivo',
        localAudioUri: fileUri,
        nativeAudioUri: fileUri,
        audioUrl: fileUri,
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
          const { title, artist } = parseAudioMetadataFromFilename(df);
          const newTrack = {
            id: `ios_${baseId}`,
            _id: `ios_${baseId}`,
            title,
            artist,
            album: 'Files App',
            source: 'Local',
            publisher: 'Rivo',
            signature: 'Rivo',
            localAudioUri: targetUri,
            nativeAudioUri: targetUri,
            audioUrl: targetUri,
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
            const { title, artist } = parseAudioMetadataFromFilename(pf);
            const newTrack = {
              id: baseId,
              _id: baseId,
              title,
              artist,
              album: 'Music Vault',
              source: 'Local',
              publisher: 'Rivo',
              signature: 'Rivo',
              localAudioUri: targetUri,
              nativeAudioUri: targetUri,
              audioUrl: targetUri,
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
      console.warn('[downloadManager] scan Android persistentDir error:', err.message);
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
