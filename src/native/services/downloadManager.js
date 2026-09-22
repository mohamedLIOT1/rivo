import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveAudioStream } from './youtubeResolver';
import { API_BASE_URL } from '../config';

const TRACKS_DIR = `${FileSystem.documentDirectory}rivo_tracks/`;
const COVERS_DIR = `${FileSystem.documentDirectory}rivo_covers/`;
const MANIFEST_FILE = `${TRACKS_DIR}manifest.json`;
const STORAGE_KEY = '@rivo_offline_tracks_v2';

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

function extractYouTubeId(input) {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();
  const m1 = str.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
  if (m1 && m1[1] && m1[1].length === 11) return m1[1];
  const m2 = str.match(/^yt[-_]?([a-zA-Z0-9_-]{11})$/i);
  if (m2 && m2[1] && m2[1].length === 11) return m2[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  return null;
}

async function resolveClientSideYouTubeStream(videoId) {
  if (!videoId) return null;
  const cobaltEndpoints = [
    'https://api.cobalt.tools/api/json',
    'https://cobalt.stream/api/json',
    'https://co.wuk.sh/api/json'
  ];
  for (const ep of cobaltEndpoints) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          downloadMode: 'audio',
          audioFormat: 'mp3',
          isAudioOnly: true
        })
      });
      if (res.ok) {
        const data = await res.json();
        const u = data.url || data.audio || (data.picker && data.picker[0]?.url);
        if (u) return u;
      }
    } catch {}
  }
  const invidious = [
    'https://inv.nadeko.net',
    'https://yewtu.be',
    'https://yt.artemislena.eu',
    'https://invidious.jing.rocks',
    'https://invidious.nerdvpn.de'
  ];
  for (const base of invidious) {
    try {
      const res = await fetch(`${base}/api/v1/videos/${videoId}?fields=adaptiveFormats`);
      if (res.ok) {
        const data = await res.json();
        const formats = data.adaptiveFormats || [];
        const audio = formats.find(f => f.type?.includes('audio/mp4')) || formats.find(f => f.type?.includes('audio'));
        if (audio?.url) return audio.url;
      }
    } catch {}
  }
  return null;
}

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

  let audioFileUri = audioFileUriM4a; // Default to m4a for YouTube streams
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

  // Gather candidate download URLs in order of priority
  const candidates = [];

  // Candidate 1: Direct remote audio URL (if already an audio file)
  const isDirectRemote = (u) => typeof u === 'string' && u.startsWith('http') && !u.includes('youtube.com') && !u.includes('youtu.be') && !u.includes('soundcloud.com');
  if (isDirectRemote(track.audioUrl)) candidates.push(track.audioUrl);
  if (isDirectRemote(track.nativeAudioUri)) candidates.push(track.nativeAudioUri);

  // Candidate 2: Backend Direct Downloader endpoint
  const backendDownloadUrl = `${API_BASE_URL}/api/tracks/download?url=${encodeURIComponent(track.audioUrl || '')}&title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}&id=${encodeURIComponent(trackId)}`;
  candidates.push(backendDownloadUrl);

  // Candidate 3: Backend Stream Resolver
  try {
    const streamRes = await fetch(`${API_BASE_URL}/api/tracks/${encodeURIComponent(trackId)}/stream?title=${encodeURIComponent(track.title || '')}&artist=${encodeURIComponent(track.artist || '')}`);
    if (streamRes.ok) {
      const streamData = await streamRes.json();
      if (streamData?.url && typeof streamData.url === 'string') {
        candidates.push(streamData.url);
      }
    }
  } catch (e) {}

  // Candidate 4: Client-side YouTube mirror resolution
  const ytId = extractYouTubeId(track.audioUrl) || extractYouTubeId(trackId) || (track.source === 'YouTube' ? extractYouTubeId(track._id) : null);

  if (onProgress) onProgress(15);

  let success = false;

  // Try candidate URLs one by one until one produces a valid audio file
  for (let i = 0; i < candidates.length; i++) {
    const targetUrl = candidates[i];
    try {
      // First clean up any corrupted partial file
      await FileSystem.deleteAsync(audioFileUri, { idempotent: true }).catch(() => {});

      let res = null;
      try {
        const downloadResumable = FileSystem.createDownloadResumable(
          targetUrl,
          audioFileUri,
          {},
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
        res = await FileSystem.downloadAsync(targetUrl, audioFileUri);
      }

      if (res && (res.status === 200 || res.status === 206)) {
        const check = await FileSystem.getInfoAsync(audioFileUri);
        if (check.exists && check.size > 10000) {
          success = true;
          break;
        }
      }
    } catch (candidateErr) {
      console.warn(`[downloadManager] Candidate ${i + 1} failed:`, candidateErr.message);
    }
  }

  // If backend candidates failed, try client-side direct YouTube mirror as final fallback
  if (!success && ytId) {
    try {
      if (onProgress) onProgress(30);
      const mirrorUrl = await resolveClientSideYouTubeStream(ytId);
      if (mirrorUrl) {
        await FileSystem.deleteAsync(audioFileUri, { idempotent: true }).catch(() => {});
        const mirrorRes = await FileSystem.downloadAsync(mirrorUrl, audioFileUri);
        if (mirrorRes && (mirrorRes.status === 200 || mirrorRes.status === 206)) {
          const check = await FileSystem.getInfoAsync(audioFileUri);
          if (check.exists && check.size > 10000) {
            success = true;
          }
        }
      }
    } catch (mirrorErr) {
      console.warn('[downloadManager] Mirror fallback failed:', mirrorErr.message);
    }
  }

  if (!success) {
    await FileSystem.deleteAsync(audioFileUri, { idempotent: true }).catch(() => {});
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
  const audioFileUri = `${TRACKS_DIR}${idStr}.mp3`;
  const coverFileUri = `${COVERS_DIR}${idStr}.jpg`;

  await FileSystem.deleteAsync(audioFileUri, { idempotent: true }).catch(() => {});
  await FileSystem.deleteAsync(coverFileUri, { idempotent: true }).catch(() => {});

  const existing = await getDownloadedTracks();
  const updated = existing.filter(t => String(t._id || t.id) !== idStr);
  await saveToStorageAndManifest(updated);
  return updated;
};
