import { API_BASE_URL } from '../config';

/**
 * Resilient inline SVG data URI placeholder (Dark-mode Vinyl Record).
 * Guaranteed to display instantly even offline, on HTTP 404, or when CDNs are blocked.
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
    <!-- Background card -->
    <rect width="300" height="300" fill="url(#rivoBg)" />
    <!-- Outer vinyl disc body -->
    <circle cx="150" cy="150" r="126" fill="url(#rivoVinyl)" stroke="#1a2e2b" stroke-width="2" />
    <!-- Concentric vinyl micro-grooves -->
    <circle cx="150" cy="150" r="114" fill="none" stroke="#223b37" stroke-width="1.2" stroke-dasharray="4 6" opacity="0.6" />
    <circle cx="150" cy="150" r="100" fill="none" stroke="#223b37" stroke-width="1" opacity="0.45" />
    <circle cx="150" cy="150" r="86" fill="none" stroke="#223b37" stroke-width="1" stroke-dasharray="3 5" opacity="0.55" />
    <circle cx="150" cy="150" r="72" fill="none" stroke="#223b37" stroke-width="1" opacity="0.4" />
    <circle cx="150" cy="150" r="58" fill="none" stroke="#223b37" stroke-width="1.2" stroke-dasharray="2 4" opacity="0.5" />
    <!-- Center Label -->
    <circle cx="150" cy="150" r="44" fill="url(#rivoMint)" stroke="#0b1110" stroke-width="3" />
    <!-- Center Spindle Hole -->
    <circle cx="150" cy="150" r="15" fill="#0b1110" stroke="#26c4b7" stroke-width="2" />
    <circle cx="150" cy="150" r="5" fill="#26c4b7" />
    <!-- Retro cassette tape / waveform motif in center label -->
    <path d="M141 140 v20 m18 -24 v24 m-18 -18 h18" fill="none" stroke="#0b1110" stroke-width="2.5" stroke-linecap="round" />
  </svg>`
)}`;

export const DEFAULT_COVER_FALLBACK = MUSIC_PLACEHOLDER_SVG;
export const DEFAULT_COVER = MUSIC_PLACEHOLDER_SVG;
export const QURAN_COVER_FALLBACK = 'https://rivo-m.duckdns.org/public/assets/quran/tarateel.jpg';

/**
 * Reusable bulletproof onError handler for <img> elements.
 * Prevents infinite onError loops and swaps in MUSIC_PLACEHOLDER_SVG.
 */
export function handleCoverImageError(e, fallback = DEFAULT_COVER_FALLBACK) {
  if (!e || !e.currentTarget) return;
  const target = e.currentTarget;
  if (target.dataset.hasFallback) return;
  target.dataset.hasFallback = 'true';
  try {
    target.removeAttribute('alt');
  } catch {}
  target.src = fallback;
}

/**
 * Normalizes cover URLs so relative paths (e.g. /uploads/...) resolve
 * against API_BASE_URL instead of tauri.localhost on Windows desktop.
 */
const coverCache = new Map();
const MAX_COVER_CACHE = 600;

export function normalizeCoverUrl(cover, track = null) {
  const trackKey = track?._id || track?.id || track?.youtubeId || track?.ytId || track?.audioUrl || track?.url || track?.title || track?.name || '';
  const cacheKey = (cover || trackKey) ? ((cover || '') + '_' + trackKey) : null;
  if (cacheKey && coverCache.has(cacheKey)) {
    return coverCache.get(cacheKey);
  }
  const result = _computeNormalizeCoverUrl(cover, track);
  if (cacheKey) {
    if (coverCache.size >= MAX_COVER_CACHE) coverCache.clear();
    coverCache.set(cacheKey, result);
  }
  return result;
}

function _computeNormalizeCoverUrl(cover, track = null) {
  const trackTitle = String(track?.title || track?.name || '').trim().toLowerCase();
  const trackArtist = String(track?.artist || '').trim().toLowerCase();

  // Hardcoded guarantee for ANONYMOUS by TUL8TE & Lege-Cy to prevent wrong cached covers
  if (trackTitle === 'anonymous' || trackTitle.includes('anonymous')) {
    if (trackArtist.includes('tul8te') || trackArtist.includes('تووليت') || trackArtist.includes('lege-cy') || trackArtist.includes('ليجي') || !trackArtist) {
      return 'https://i.ytimg.com/vi/Lp8StQkBuUQ/hqdefault.jpg';
    }
  }

  // Hardcoded guarantee for Ethbat Makanak (feat. Nayer Nagui) / Cairokee
  if (trackTitle.includes('ethbat makanak') || trackTitle.includes('اثبت مكانك')) {
    if (trackTitle.includes('nayer nagui') || trackTitle.includes('ناير ناجي') || trackArtist.includes('cairokee') || trackArtist.includes('كايروكي') || !trackArtist) {
      return 'https://i.ytimg.com/vi/0hhXwSen-Vw/hqdefault.jpg';
    }
  }

  if (cover && typeof cover === 'string') {
    let trimmed = cover.trim();
    if (trimmed.includes('6221216529510_cover.png') && trackTitle.includes('anonymous')) {
      return 'https://i.ytimg.com/vi/Lp8StQkBuUQ/hqdefault.jpg';
    }

    // Replace maxresdefault with hqdefault because YouTube returns 404 for maxresdefault on non-1080p uploads
    if (trimmed.includes('maxresdefault.jpg')) {
      trimmed = trimmed.replace('maxresdefault.jpg', 'hqdefault.jpg');
    }

    // Proxy Wikimedia & Assabile hotlinked images through images.weserv.nl CDN to prevent HTTP 403 Forbidden
    if ((trimmed.includes('upload.wikimedia.org') || trimmed.includes('commons.wikimedia.org') || trimmed.includes('assabile.com')) && !trimmed.includes('images.weserv.nl')) {
      const stripped = trimmed.replace(/^https?:\/\//, '');
      return `https://images.weserv.nl/?url=${stripped}&w=300`;
    }

    if (trimmed.length > 0 && trimmed !== 'null' && trimmed !== 'undefined') {
      if (
        trimmed.startsWith('data:') ||
        trimmed.startsWith('blob:') ||
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://')
      ) {
        return trimmed;
      }
      const base = String(API_BASE_URL || '').replace(/\/+$/, '');
      const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
      return `${base}${cleanPath}`;
    }
  }

  if (track) {
    // Check alternative cover fields on the track object
    const candidate = track.coverUrl || track.remoteCoverUrl || track.originalCoverUrl || track.thumbnail || track.artwork || track.albumCover || track.coverImage || track.image;
    if (candidate && typeof candidate === 'string' && candidate !== cover && candidate !== 'null' && candidate !== 'undefined') {
      const resolvedCandidate = _computeNormalizeCoverUrl(candidate, { ...track, coverUrl: undefined, remoteCoverUrl: undefined, thumbnail: undefined });
      if (resolvedCandidate && resolvedCandidate !== DEFAULT_COVER) {
        return resolvedCandidate;
      }
    }

    // Direct YouTube 11-char ID check (e.g. track.youtubeId or track.ytId without URL prefix)
    const directYtId = (typeof track.youtubeId === 'string' && track.youtubeId.trim()) || (typeof track.ytId === 'string' && track.ytId.trim()) || '';
    if (directYtId && /^[a-zA-Z0-9_-]{11}$/.test(directYtId)) {
      return `https://i.ytimg.com/vi/${directYtId}/hqdefault.jpg`;
    }

    // Extract YouTube ID from track audioUrl, url, streamUrl, or _id
    const rawTarget = track.youtubeId || track.audioUrl || track.url || track.streamUrl || track.sourceUrl || track._id || '';
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
  MUSIC_PLACEHOLDER_SVG,
  DEFAULT_COVER_FALLBACK,
  DEFAULT_COVER,
  handleCoverImageError,
};
