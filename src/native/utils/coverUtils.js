import * as FileSystem from 'expo-file-system';
import { API_BASE_URL } from '../config';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400';

/**
 * Normalizes any cover URI so it resolves properly in React Native.
 * Prepend API_BASE_URL for relative paths like /uploads/covers/...,
 * re-anchors iOS container UUIDs for local documents,
 * extracts YouTube video thumbnails, and provides an authentic fallback.
 */
export function normalizeCoverUri(uri, track = null) {
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
        return trimmed;
      }
      if (trimmed.startsWith('/')) {
        return `${API_BASE_URL}${trimmed}`;
      }
      return `${API_BASE_URL}/${trimmed}`;
    }
  }

  // Fallback 1: check remoteCoverUrl or originalCoverUrl on track
  if (track) {
    const remote = track.remoteCoverUrl || track.originalCoverUrl;
    if (remote && typeof remote === 'string' && (remote.startsWith('http://') || remote.startsWith('https://'))) {
      return remote;
    }

    // Fallback 2: extract YouTube thumbnail from track audioUrl, youtubeId, or url
    const rawTarget = track.youtubeId || track.audioUrl || track.url || track._id || '';
    if (typeof rawTarget === 'string') {
      const m = rawTarget.match(/(?:v=|youtu\.be\/|\/embed\/|\/vi\/)([a-zA-Z0-9_-]{11})/i);
      if (m && m[1]) {
        return `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg`;
      }
    }
  }

  return DEFAULT_COVER;
}

export { DEFAULT_COVER };
