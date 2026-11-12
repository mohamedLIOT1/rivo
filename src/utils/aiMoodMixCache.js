import { isQuranContent } from './quranUtils';

export const AI_MIX_CACHE_KEY = 'rivo_ai_mood_mix_v2';
export const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

export function get12hBucket(now = Date.now()) {
  return Math.floor(now / TWELVE_HOURS_MS);
}

function seededHash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function slimAiTrack(tr) {
  if (!tr || typeof tr !== 'object') return tr;
  return {
    id: tr.id || tr._id,
    _id: tr._id || tr.id,
    title: tr.title,
    artist: tr.artist,
    album: tr.album,
    cover: tr.cover,
    duration: tr.duration,
    genre: tr.genre,
    audioUrl: tr.audioUrl,
    isSmartMoodQueue: true,
    isAiSuggestion: true,
  };
}

/**
 * Load persisted 12-hour AI Mood Mix immediately on mount (never blocking on library sync).
 */
export function loadCachedAiMoodMix(ownerId, displayTracks, now = Date.now()) {
  const tryParse = (storage) => {
    try {
      const raw = storage?.getItem?.(AI_MIX_CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  try {
    const parsed = tryParse(localStorage) || tryParse(typeof sessionStorage !== 'undefined' ? sessionStorage : null);
    if (!parsed) return null;
    const currentBucket = get12hBucket(now);
    const expiresAt = Number(parsed?.expiresAt || ((Number(parsed?.savedAt || 0) || 0) + TWELVE_HOURS_MS));
    const bucketMatches = Number(parsed?.bucket12h) === currentBucket;
    const ownerMatches = parsed.ownerId === ownerId;
    if (
      !ownerMatches ||
      !bucketMatches ||
      now >= expiresAt ||
      !Array.isArray(parsed.tracks) ||
      parsed.tracks.length === 0
    ) {
      return null;
    }

    const trackById = new Map();
    if (Array.isArray(displayTracks) && displayTracks.length > 0) {
      displayTracks.forEach((tr) => {
        const id = String(tr?.id || tr?._id || '');
        if (id) trackById.set(id, tr);
      });
    }

    const hydrated = parsed.tracks
      .map((tr) => trackById.get(String(tr?.id || tr?._id || '')) || tr)
      .filter((tr) => tr && !isQuranContent(tr))
      .map((tr) => ({ ...tr, isSmartMoodQueue: true, isAiSuggestion: true }));

    if (hydrated.length === 0) return null;
    try {
      Object.defineProperty(hydrated, '__source', { value: parsed.source || 'server', enumerable: false });
    } catch {}
    return hydrated;
  } catch {
    return null;
  }
}

export function saveCachedAiMoodMix({ ownerId, moodId, name, description, tracks, bucket12h, source = 'server', now = Date.now() }) {
  const slimTracks = (Array.isArray(tracks) ? tracks : []).slice(0, 15).map(slimAiTrack);
  const serialized = JSON.stringify({
    ownerId: ownerId || 'guest',
    bucket12h: Number.isFinite(Number(bucket12h)) ? Number(bucket12h) : get12hBucket(now),
    source,
    savedAt: now,
    expiresAt: now + TWELVE_HOURS_MS,
    moodId,
    name,
    description,
    tracks: slimTracks,
  });

  try {
    localStorage.setItem(AI_MIX_CACHE_KEY, serialized);
  } catch {
    // Reclaim quota from legacy duplicate keys and retry
    try {
      localStorage.removeItem('liofy_tracks');
      localStorage.removeItem('liofy_playlists');
      localStorage.setItem(AI_MIX_CACHE_KEY, serialized);
    } catch {}
  }

  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(AI_MIX_CACHE_KEY, serialized);
    }
  } catch {}
}

/**
 * Deterministically rotate non-Quran albums per 12-hour window and interleave
 * artists so back-to-back albums by the same artist don't cluster at the top.
 */
export function rotateAlbumsForWindow(albumsList, ownerId, now = Date.now()) {
  const bucket12h = get12hBucket(now);
  const musicAlbs = (albumsList || []).filter((alb) => !isQuranContent(alb));
  const scored = [...musicAlbs].sort((a, b) => {
    const keyA = `${bucket12h}:${ownerId}:${String(a.id || a._id || a.name || '')}`;
    const keyB = `${bucket12h}:${ownerId}:${String(b.id || b._id || b.name || '')}`;
    return seededHash(keyA) - seededHash(keyB);
  });

  const rotated = [];
  const overflow = [];
  let lastArtist = '';
  for (const alb of scored) {
    const art = String(alb.artist || '').trim().toLowerCase();
    if (art && art === lastArtist) {
      overflow.push(alb);
    } else {
      rotated.push(alb);
      lastArtist = art;
    }
  }
  return [...rotated, ...overflow];
}
