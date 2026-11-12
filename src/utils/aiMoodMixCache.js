import { isQuranContent } from './quranUtils';

export const AI_MIX_CACHE_KEY = 'rivo_ai_mood_mix_v1';
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

/**
 * Load persisted 12-hour AI Mood Mix, rehydrating track objects from the active library.
 * Uses rolling 12-hour expiration (`expiresAt`) and gracefully preserves cache across
 * guest -> authenticated user hydration during page refresh.
 */
export function loadCachedAiMoodMix(ownerId, displayTracks, now = Date.now()) {
  try {
    const rawCache = localStorage.getItem(AI_MIX_CACHE_KEY);
    if (!rawCache) return null;
    const parsed = JSON.parse(rawCache);
    const expiresAt = Number(parsed?.expiresAt || ((Number(parsed?.savedAt || 0) || 0) + TWELVE_HOURS_MS));
    const ownerMatches =
      parsed.ownerId === ownerId ||
      parsed.ownerId === 'guest' ||
      ownerId === 'guest';
    if (
      !parsed ||
      !ownerMatches ||
      now >= expiresAt ||
      !Array.isArray(parsed.tracks) ||
      parsed.tracks.length === 0
    ) {
      return null;
    }

    const trackById = new Map();
    (displayTracks || []).forEach((tr) => {
      const id = String(tr?.id || tr?._id || '');
      if (id) trackById.set(id, tr);
    });

    const hydrated = parsed.tracks
      .map((tr) => trackById.get(String(tr?.id || tr?._id || '')) || tr)
      .filter((tr) => tr && !isQuranContent(tr))
      .map((tr) => ({ ...tr, isSmartMoodQueue: true, isAiSuggestion: true }));

    return hydrated.length > 0 ? hydrated : null;
  } catch {
    return null;
  }
}

export function saveCachedAiMoodMix({ ownerId, moodId, name, description, tracks, now = Date.now() }) {
  try {
    localStorage.setItem(
      AI_MIX_CACHE_KEY,
      JSON.stringify({
        ownerId,
        bucket12h: get12hBucket(now),
        savedAt: now,
        expiresAt: now + TWELVE_HOURS_MS,
        moodId,
        name,
        description,
        tracks,
      })
    );
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
