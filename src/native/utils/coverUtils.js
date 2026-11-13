import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { API_BASE_URL } from '../config';
import { getCachedDiskUriSync, cacheImageToDisk } from './diskImageCache';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=200&q=70&auto=format';

/**
 * Resilient inline SVG data URI placeholder (Dark-mode Vinyl Record).
 */
export const MUSIC_PLACEHOLDER_SVG = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" width="100%" height="100%">
    <defs>
      <linearGradient id="rivoBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0b1110" />
        <stop offset="100%" stop-color="#142321" />
      </linearGradient>
      <radialGradient id="rivoVinyl" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#1a2e2b" />
        <stop offset="65%" stop-color="#0f1917" />
        <stop offset="100%" stop-color="#050807" />
      </radialGradient>
      <linearGradient id="rivoMint" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#26c4b7" />
        <stop offset="100%" stop-color="#17a398" />
      </linearGradient>
    </defs>
    <rect width="300" height="300" fill="url(#rivoBg)" />
    <circle cx="150" cy="150" r="126" fill="url(#rivoVinyl)" stroke="#1a2e2b" stroke-width="2" />
    <circle cx="150" cy="150" r="114" fill="none" stroke="#223b37" stroke-width="1.2" stroke-dasharray="4 6" opacity="0.6" />
    <circle cx="150" cy="150" r="100" fill="none" stroke="#223b37" stroke-width="1" opacity="0.45" />
    <circle cx="150" cy="150" r="86" fill="none" stroke="#223b37" stroke-width="1" stroke-dasharray="3 5" opacity="0.55" />
    <circle cx="150" cy="150" r="72" fill="none" stroke="#223b37" stroke-width="1" opacity="0.4" />
    <circle cx="150" cy="150" r="58" fill="none" stroke="#223b37" stroke-width="1.2" stroke-dasharray="2 4" opacity="0.5" />
    <circle cx="150" cy="150" r="44" fill="url(#rivoMint)" stroke="#0b1110" stroke-width="3" />
    <circle cx="150" cy="150" r="15" fill="#0b1110" stroke="#26c4b7" stroke-width="2" />
    <circle cx="150" cy="150" r="5" fill="#26c4b7" />
    <path d="M141 140 v20 m18 -24 v24 m-18 -18 h18" fill="none" stroke="#0b1110" stroke-width="2.5" stroke-linecap="round" />
  </svg>`
)}`;

export const DEFAULT_COVER_FALLBACK = MUSIC_PLACEHOLDER_SVG;
export const QURAN_COVER_FALLBACK = 'https://rivo-m.duckdns.org/public/assets/quran/tarateel.jpg';

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
  if ((uri.includes('upload.wikimedia.org') || uri.includes('commons.wikimedia.org') || uri.includes('assabile.com')) && !uri.includes('images.weserv.nl')) {
    const stripped = uri.replace(/^https?:\/\//, '');
    return `https://images.weserv.nl/?url=${stripped}&w=300`;
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
  const trackKey = track?._id || track?.id || track?.youtubeId || track?.ytId || track?.audioUrl || track?.url || track?.title || track?.name || '';
  const cacheKey = (uri || trackKey) ? ((uri || '') + '_' + trackKey) : null;
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
  const trackTitle = String(track?.title || track?.name || '').trim().toLowerCase();
  const trackArtist = String(track?.artist || '').trim().toLowerCase();

  // Hardcoded guarantee for ANONYMOUS by TUL8TE & Lege-Cy
  if (trackTitle.includes('anonymous')) {
    if (trackArtist.includes('tul8te') || trackArtist.includes('تووليت') || trackArtist.includes('lege-cy') || trackArtist.includes('ليجي') || !trackArtist) {
      return 'https://i.ytimg.com/vi/Lp8StQkBuUQ/hqdefault.jpg';
    }
  }

  // Hardcoded guarantee for Ethbat Makanak (feat. Nayer Nagui) / Cairokee
  if (trackTitle.includes('ethbat makanak') || trackTitle.includes('اثبت مكانك')) {
    if (trackTitle.includes('nayer nagui') || trackTitle.includes('ناير ناجي') || trackArtist.includes('cairokee') || trackArtist.includes('كايروكي') || !trackArtist) {
      return Platform.OS === 'android'
        ? 'https://i.ytimg.com/vi/0hhXwSen-Vw/mqdefault.jpg'
        : 'https://i.ytimg.com/vi/0hhXwSen-Vw/hqdefault.jpg';
    }
  }

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
      const base = String(API_BASE_URL || '').replace(/\/+$/, '');
      const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
      return downscaleCoverUri(`${base}${cleanPath}`);
    }
  }

  // Fallback 1: check remoteCoverUrl, originalCoverUrl, coverUrl, cover, coverImage, etc. on track
  if (track) {
    const remote = track.remoteCoverUrl || track.originalCoverUrl || track.coverUrl || track.cover || track.coverImage || track.thumbnail || track.artwork || track.albumCover;
    if (remote && typeof remote === 'string' && (remote.startsWith('http://') || remote.startsWith('https://'))) {
      return downscaleCoverUri(remote);
    }

    // Direct YouTube 11-char ID check (e.g. track.youtubeId or track.ytId without URL prefix)
    const directYtId = (typeof track.youtubeId === 'string' && track.youtubeId.trim()) || (typeof track.ytId === 'string' && track.ytId.trim()) || '';
    if (directYtId && /^[a-zA-Z0-9_-]{11}$/.test(directYtId)) {
      return Platform.OS === 'android'
        ? `https://i.ytimg.com/vi/${directYtId}/mqdefault.jpg`
        : `https://i.ytimg.com/vi/${directYtId}/hqdefault.jpg`;
    }

    // Fallback 2: extract YouTube thumbnail from track audioUrl, youtubeId, streamUrl, or url
    const rawTarget = track.youtubeId || track.audioUrl || track.url || track.streamUrl || track.sourceUrl || track._id || '';
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
