import * as FileSystem from 'expo-file-system';
import { API_BASE_URL } from '../config';

const streamCache = new Map();

/**
 * Cleans track title and artist for high-accuracy audio stream resolution.
 * Strips Arabic & English movie notes, featured artist tags, video suffixes, etc.
 */
export function getCleanQueries(title = '', artist = '') {
  const cleanTitle = (title || '')
    .replace(/\s*[-–—]\s*(من فيلم|فيلم|أغنية|كليب|فيديو كليب|official|video|audio|lyrics|lyric|remix|clip|ost).*$/i, '')
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/(?:ft\.?|feat\.?|featuring)\s+.*$/i, '')
    .trim();

  const primaryTitle = cleanTitle.includes(' - ')
    ? cleanTitle.split(' - ')[0].trim()
    : cleanTitle;

  const cleanArtist = (artist || '')
    .split(/[-–—|/•,]/)[0]
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .trim();

  const queries = [];
  if (cleanArtist && primaryTitle) queries.push(`${cleanArtist} ${primaryTitle}`);
  if (primaryTitle) queries.push(primaryTitle);
  if (cleanArtist && cleanTitle && !queries.includes(`${cleanArtist} ${cleanTitle}`)) {
    queries.push(`${cleanArtist} ${cleanTitle}`);
  }
  if (artist && title && !queries.includes(`${artist} ${title}`)) {
    queries.push(`${artist} ${title}`);
  }

  return { cleanTitle: primaryTitle, cleanArtist, queries: [...new Set(queries.filter(Boolean))] };
}

/**
 * Resolves a playable direct audio URL for a given track.
 * 1. Checks local offline storage.
 * 2. Checks direct stream URLs.
 * 3. Resolves authentic official YouTube stream via backend proxy.
 * 4. Resolves via server stream resolver.
 */
export const resolveAudioStream = async (track) => {
  if (!track) return null;

  const trackId = String(track._id || track.id || '');
  if (trackId && streamCache.has(trackId)) {
    const cached = streamCache.get(trackId);
    // If it's a file URI, ensure it still exists on disk
    if (cached.startsWith('file://')) {
      try {
        const info = await FileSystem.getInfoAsync(cached);
        if (info.exists && info.size > 10000) return cached;
      } catch {}
      streamCache.delete(trackId);
    } else {
      return cached;
    }
  }

  // 1. Direct local file on device storage (by nativeAudioUri or downloadedTracks check)
  const localUri = track.nativeAudioUri || track.localAudioUri;
  if (localUri && localUri.startsWith('file://')) {
    try {
      const info = await FileSystem.getInfoAsync(localUri);
      if (info.exists && info.size > 10000) {
        if (trackId) streamCache.set(trackId, localUri);
        return localUri;
      }
    } catch {}
  }

  const rawUrl = track.audioUrl || '';
  const rawTitle = (track.title || '').trim();
  const rawArtist = (track.artist || '').trim();
  const { cleanTitle, cleanArtist } = getCleanQueries(rawTitle, rawArtist);

  // 1b. Check if track is saved in offline storage by clean title + artist
  try {
    const { getDownloadedTracks } = require('./downloadManager');
    const dls = await getDownloadedTracks();
    if (Array.isArray(dls) && dls.length > 0) {
      const found = dls.find(d => {
        if (!d) return false;
        if (trackId && String(d._id || d.id) === trackId) return true;
        const dTitle = (d.title || '').toLowerCase().trim();
        const dArtist = (d.artist || '').toLowerCase().trim();
        const cTitle = (cleanTitle || rawTitle).toLowerCase().trim();
        const cArtist = (cleanArtist || rawArtist).toLowerCase().trim();
        return (cTitle && dTitle === cTitle) && (!cArtist || !dArtist || dArtist === cArtist);
      });
      const dlUri = found?.localAudioUri || found?.nativeAudioUri;
      if (dlUri && dlUri.startsWith('file://')) {
        const info = await FileSystem.getInfoAsync(dlUri);
        if (info.exists && info.size > 10000) {
          if (trackId) streamCache.set(trackId, dlUri);
          return dlUri;
        }
      }
    }
  } catch {}

  // 2. Direct MP3/M4A/AAC stream URL (non-YouTube)
  if (
    rawUrl.startsWith('http') &&
    !rawUrl.includes('youtube.com') &&
    !rawUrl.includes('youtu.be') &&
    !rawUrl.includes('soundcloud.com') &&
    !rawUrl.includes('sndcdn.com') &&
    (rawUrl.endsWith('.mp3') || rawUrl.endsWith('.m4a'))
  ) {
    if (trackId) streamCache.set(trackId, rawUrl);
    return rawUrl;
  }

  // 3. Fast Server-side Stream Resolution via Proxy (starts playing in < 1 second, zero lag)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const serverStreamRes = await fetch(
      `${API_BASE_URL}/api/tracks/${encodeURIComponent(trackId || 'stream')}/stream?url=${encodeURIComponent(rawUrl)}&title=${encodeURIComponent(cleanTitle || rawTitle)}&artist=${encodeURIComponent(cleanArtist || rawArtist)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (serverStreamRes.ok) {
      const data = await serverStreamRes.json();
      if (data?.success && data?.url) {
        let streamUrl = data.url;
        if (streamUrl.startsWith('/')) {
          streamUrl = `${API_BASE_URL}${streamUrl}`;
        }
        if (trackId) streamCache.set(trackId, streamUrl);
        return streamUrl;
      }
    }
  } catch (e) {
    // Backend request timed out or failed, proceed to mirror fallback
  }

  // 5. Client-side mirror fallback
  const ytId = rawUrl?.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i)?.[1] ||
               (rawUrl?.length === 11 ? rawUrl : null);
  if (ytId) {
    const mirrorStream = await resolveClientSideYouTubeStream(ytId);
    if (mirrorStream) {
      if (trackId) streamCache.set(trackId, mirrorStream);
      return mirrorStream;
    }
  }

  return rawUrl || null;
};

export const resolveClientSideYouTubeStream = async (ytId) => {
  if (!ytId) return null;
  const mirrors = [
    `https://inv.nadeko.net/api/v1/videos/${ytId}?fields=adaptiveFormats`,
    `https://invidious.jing.rocks/api/v1/videos/${ytId}?fields=adaptiveFormats`,
    `https://yt.artemislena.eu/api/v1/videos/${ytId}?fields=adaptiveFormats`,
    `https://pipedapi.kavin.rocks/streams/${ytId}`,
  ];
  for (const ep of mirrors) {
    try {
      const res = await fetch(ep, { headers: { 'Accept': 'application/json' } });
      if (res.ok) {
        const d = await res.json();
        const formats = d.adaptiveFormats || d.audioStreams || [];
        const audio = formats.find(f => f.type?.includes('audio/mp4') || f.mimeType?.includes('audio/mp4')) ||
                      formats.find(f => f.type?.includes('audio') || f.mimeType?.includes('audio'));
        if (audio?.url) {
          return audio.url;
        }
      }
    } catch {}
  }
  return null;
};

export const resolveYouTubeStream = async (trackId) => {
  return null;
};
