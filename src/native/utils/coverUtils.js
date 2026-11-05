import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { API_BASE_URL } from '../config';
import { getCachedDiskUriSync, cacheImageToDisk } from './diskImageCache';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&q=70&auto=format';

/**
 * Downscales remote cover URLs to lightweight thumbnail sizes (200-320px)
 * to prevent allocating massive bitmap buffers on low-spec/1.5GB RAM devices.
 */
export function downscaleCoverUri(uri) {
  if (!uri || typeof uri !== 'string') return uri;
  if (uri.includes('images.unsplash.com')) {
    if (uri.includes('w=')) {
      return uri.replace(/w=\d+/, 'w=200').replace(/q=\d+/, 'q=70');
    }
    return uri + (uri.includes('?') ? '&' : '?') + 'w=200&q=70&auto=format';
  }
  if (uri.includes('mzstatic.com')) {
    return uri.replace(/\/(\d+)x\d+bb\./, '/200x200bb.');
  }
  if (uri.includes('maxresdefault.jpg')) {
    return uri.replace('maxresdefault.jpg', Platform.OS === 'android' ? 'mqdefault.jpg' : 'hqdefault.jpg');
  }
  if (Platform.OS === 'android' && uri.includes('hqdefault.jpg')) {
    return uri.replace('hqdefault.jpg', 'mqdefault.jpg');
  }
  return uri;
}

/**
 * Normalizes any cover URI so it resolves properly in React Native.
 * Seamlessly integrates persistent disk caching:
 * - Checks persistent disk cache (FileSystem.cacheDirectory + 'covers/')
 * - If cached on disk, returns file:// URI synchronously (0 network latency, persists across app restarts)
 * - If not yet on disk, returns remote URL and queues background download to disk cache
 * - Prepend API_BASE_URL for relative paths like /uploads/covers/...
 * - Re-anchors iOS container UUIDs for local documents
 * - Extracts YouTube video thumbnails and provides authentic fallback
 */
const canonicalCoverCache = new Map();
const MAX_CANONICAL_CACHE = 600;

export function normalizeCoverUri(uri, track = null) {
  const cacheKey = (uri || '') + '_' + (track?._id || track?.id || track?.youtubeId || '');
  let canonical = cacheKey ? canonicalCoverCache.get(cacheKey) : null;
  if (!canonical) {
    canonical = _computeNormalizeCoverUri(uri, track);
    if (cacheKey) {
      if (canonicalCoverCache.size >= MAX_CANONICAL_CACHE) canonicalCoverCache.clear();
      canonicalCoverCache.set(cacheKey, canonical);
    }
  }

  if (!canonical || typeof canonical !== 'string') {
    return DEFAULT_COVER;
  }

  // If already a local file or data URI, return directly
  if (canonical.startsWith('file://') || canonical.startsWith('data:')) {
    return canonical;
  }

  // If remote HTTP/HTTPS URL: check persistent disk cache
  if (canonical.startsWith('http://') || canonical.startsWith('https://')) {
    const localDisk = getCachedDiskUriSync(canonical);
    if (localDisk) {
      return localDisk;
    }
    // Queue background download into persistent disk cache
    cacheImageToDisk(canonical);
    return canonical;
  }

  return canonical;
}

function _computeNormalizeCoverUri(uri, track = null) {
  if (uri && typeof uri === 'string') {
    let trimmed = uri.trim();
    if (trimmed.length > 0 && trimmed !== 'null' && trimmed !== 'undefined') {
      if (trimmed.includes('format=svg')) {
        trimmed = trimmed.replace('format=svg', 'format=png');
      }
      if (trimmed.startsWith('file://')) {
        if (trimmed.includes('/Documents/')) {
          const rel = trimmed.split('/Documents/')[1];
          return `${FileSystem.documentDirectory}${rel}`;
        }
        return trimmed;
      }
      if (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('data:')
      ) {
        return downscaleCoverUri(trimmed);
      }
      if (trimmed.startsWith('/')) {
        return downscaleCoverUri(`${API_BASE_URL}${trimmed}`);
      }
      return downscaleCoverUri(`${API_BASE_URL}/${trimmed}`);
    }
  }

  // Fallback 1: check remoteCoverUrl, originalCoverUrl, coverUrl, cover, coverImage, etc. on track
  if (track) {
    const remote = track.remoteCoverUrl || track.originalCoverUrl || track.coverUrl || track.cover || track.coverImage || track.thumbnail || track.artwork || track.albumCover;
    if (remote && typeof remote === 'string' && (remote.startsWith('http://') || remote.startsWith('https://'))) {
      return downscaleCoverUri(remote);
    }

    // Fallback 2: extract YouTube thumbnail from track audioUrl, youtubeId, or url
    const rawTarget = track.youtubeId || track.audioUrl || track.url || track._id || '';
    if (typeof rawTarget === 'string') {
      const m = rawTarget.match(/(?:v=|youtu\.be\/|\/embed\/|\/vi\/)([a-zA-Z0-9_-]{11})/i);
      if (m && m[1]) {
        return Platform.OS === 'android'
          ? `https://i.ytimg.com/vi/${m[1]}/mqdefault.jpg`
          : `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`;
      }
    }
  }

  return DEFAULT_COVER;
}

export { DEFAULT_COVER };
