import { API_BASE_URL } from '../config';

export const DEFAULT_COVER = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600';

/**
 * Normalizes cover URLs so relative paths (e.g. /uploads/...) resolve
 * against API_BASE_URL instead of tauri.localhost on Windows desktop.
 */
export function normalizeCoverUrl(cover, track = null) {
  if (cover && typeof cover === 'string') {
    let trimmed = cover.trim();
    if (trimmed.length > 0 && trimmed !== 'null' && trimmed !== 'undefined') {
      if (
        trimmed.startsWith('data:') ||
        trimmed.startsWith('blob:') ||
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://')
      ) {
        return trimmed;
      }
      if (trimmed.startsWith('/')) {
        return `${API_BASE_URL}${trimmed}`;
      }
      return `${API_BASE_URL}/${trimmed}`;
    }
  }

  if (track) {
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

export default {
  normalizeCoverUrl,
  DEFAULT_COVER,
};
