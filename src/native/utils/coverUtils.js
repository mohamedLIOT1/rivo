import { API_BASE_URL } from '../config';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400';

/**
 * Normalizes any cover URI so it resolves properly in React Native.
 * Prepend API_BASE_URL for relative paths like /uploads/covers/...,
 * handles SVG / data URIs and provides an authentic fallback.
 */
export function normalizeCoverUri(uri) {
  if (!uri || typeof uri !== 'string') return DEFAULT_COVER;
  const trimmed = uri.trim();
  if (!trimmed) return DEFAULT_COVER;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('file://') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }

  if (trimmed.startsWith('/')) {
    return `${API_BASE_URL}${trimmed}`;
  }

  return `${API_BASE_URL}/${trimmed}`;
}

export { DEFAULT_COVER };
