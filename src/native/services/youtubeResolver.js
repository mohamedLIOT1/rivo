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

  // 1. Direct local file on device storage
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

  // 2. Direct MP3/M4A/AAC stream URL
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

  // 3. Prioritize Official Stream from Backend Proxy (guarantees authentic audio without IP lock / 403)
  if (rawUrl && !rawUrl.includes('soundcloud.com') && !rawUrl.includes('sndcdn.com')) {
    const backendStreamUrl = `${API_BASE_URL}/api/tracks/download?url=${encodeURIComponent(rawUrl)}&title=${encodeURIComponent(cleanTitle || rawTitle)}&artist=${encodeURIComponent(cleanArtist || rawArtist)}&id=${encodeURIComponent(trackId)}`;
    if (trackId) streamCache.set(trackId, backendStreamUrl);
    return backendStreamUrl;
  }

  // 4. Fallback server stream resolver if rawUrl is empty or needs resolution
  if (trackId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const serverStreamRes = await fetch(
        `${API_BASE_URL}/api/tracks/${encodeURIComponent(trackId)}/stream?title=${encodeURIComponent(cleanTitle || rawTitle)}&artist=${encodeURIComponent(cleanArtist || rawArtist)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (serverStreamRes.ok) {
        const data = await serverStreamRes.json();
        if (data?.success && data?.url) {
          if (trackId) streamCache.set(trackId, data.url);
          return data.url;
        }
      }
    } catch (e) {
      // Backend request timed out or failed, continue
    }
  }

  return rawUrl || null;
};

export const resolveYouTubeStream = async (trackId) => {
  return null;
};
