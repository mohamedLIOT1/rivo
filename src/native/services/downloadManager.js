import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveAudioStream } from './youtubeResolver';
import { API_BASE_URL } from '../config';

const TRACKS_DIR = `${FileSystem.documentDirectory}rivo_tracks/`;
const COVERS_DIR = `${FileSystem.documentDirectory}rivo_covers/`;
const STORAGE_KEY = '@rivo_offline_tracks_v2';

const ensureDirs = async () => {
  try {
    const tInfo = await FileSystem.getInfoAsync(TRACKS_DIR);
    if (!tInfo.exists) await FileSystem.makeDirectoryAsync(TRACKS_DIR, { intermediates: true });

    const cInfo = await FileSystem.getInfoAsync(COVERS_DIR);
    if (!cInfo.exists) await FileSystem.makeDirectoryAsync(COVERS_DIR, { intermediates: true });
  } catch (e) {
    console.warn('[downloadManager] ensureDirs error:', e.message);
  }
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

// Client-side YouTube audio stream resolution via public mirrors
async function resolveClientSideYouTubeStream(videoId) {
  if (!videoId) return null;

  // 1. Cobalt mirrors
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

  // 2. Invidious instances
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

export const getDownloadedTracks = async () => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    const cleaned = list.filter(t =>
      t &&
      t.source !== 'SoundCloud' &&
      t.album !== 'SoundCloud' &&
      !String(t.audioUrl || '').includes('soundcloud.com') &&
      !String(t.audioUrl || '').includes('sndcdn.com') &&
      !String(t.id || t._id || '').startsWith('sc-')
    );
    if (cleaned.length !== list.length) {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned)).catch(() => {});
    }
    return cleaned;
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
  const audioFileUri = `${TRACKS_DIR}${trackId}.mp3`;
  const coverFileUri = `${COVERS_DIR}${trackId}.jpg`;
  const cleanTitle = cleanMetadataString(track.title, 'Track');
  const cleanArtist = cleanMetadataString(track.artist, 'Artist');
  const cleanAlbum = (!track.album || /https?:\/\/|www\.|youtube|liofy/i.test(track.album)) ? 'Rivo' : cleanMetadataString(track.album, 'Rivo');

  if (onProgress) onProgress(5);

  // Check if audio file already exists locally on disk
  const existingLocalUri = (track.localAudioUri && track.localAudioUri.startsWith('file://')) ? track.localAudioUri :
                          (track.nativeAudioUri && track.nativeAudioUri.startsWith('file://')) ? track.nativeAudioUri :
                          audioFileUri;
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
        album: cleanAlbum || 'Rivo',
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
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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
    album: cleanAlbum || 'Rivo',
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
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

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
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
};
