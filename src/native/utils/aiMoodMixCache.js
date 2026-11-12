import AsyncStorage from '@react-native-async-storage/async-storage';
import { isQuranContent } from '../../utils/quranUtils';

export const AI_MIX_CACHE_KEY = '@rivo_native_ai_mood_mix_v1';
export const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

let memoryCache = null;

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
    youtubeId: tr.youtubeId,
    isSmartMoodQueue: true,
    isAiSuggestion: true,
  };
}

function hydrateFromPayload(parsed, ownerId, displayTracks, now) {
  if (!parsed) return null;
  const expiresAt = Number(parsed?.expiresAt || ((Number(parsed?.savedAt || 0) || 0) + TWELVE_HOURS_MS));
  const ownerMatches =
    !parsed.ownerId ||
    parsed.ownerId === ownerId ||
    parsed.ownerId === 'guest' ||
    ownerId === 'guest';
  if (
    !ownerMatches ||
    now >= expiresAt ||
    !Array.isArray(parsed.tracks) ||
    parsed.tracks.length === 0
  ) {
    return null;
  }

  const trackById = new Map();
  if (Array.isArray(displayTracks) && displayTracks.length > 0) {
    for (let i = 0; i < displayTracks.length; i++) {
      const tr = displayTracks[i];
      const id = String(tr?.id || tr?._id || '');
      if (id) trackById.set(id, tr);
    }
  }

  const hydrated = parsed.tracks
    .map((tr) => trackById.get(String(tr?.id || tr?._id || '')) || tr)
    .filter((tr) => tr && !isQuranContent(tr))
    .map((tr) => ({ ...tr, isSmartMoodQueue: true, isAiSuggestion: true }));

  return hydrated.length > 0 ? hydrated : null;
}

export function getMemoryCachedAiMoodMix(ownerId, displayTracks, now = Date.now()) {
  return hydrateFromPayload(memoryCache, ownerId, displayTracks, now);
}

/**
 * Load persisted 12-hour AI Mood Mix from AsyncStorage on mount (with in-memory fast path).
 */
export async function loadCachedAiMoodMix(ownerId, displayTracks, now = Date.now()) {
  const memHit = hydrateFromPayload(memoryCache, ownerId, displayTracks, now);
  if (memHit) return memHit;

  try {
    const raw = await AsyncStorage.getItem(AI_MIX_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    memoryCache = parsed;
    return hydrateFromPayload(parsed, ownerId, displayTracks, now);
  } catch {
    return null;
  }
}

export function saveCachedAiMoodMix({ ownerId, moodId, name, description, tracks, now = Date.now() }) {
  const slimTracks = (Array.isArray(tracks) ? tracks : []).slice(0, 15).map(slimAiTrack);
  const payload = {
    ownerId: ownerId || 'guest',
    bucket12h: get12hBucket(now),
    savedAt: now,
    expiresAt: now + TWELVE_HOURS_MS,
    moodId,
    name,
    description,
    tracks: slimTracks,
  };
  memoryCache = payload;
  AsyncStorage.setItem(AI_MIX_CACHE_KEY, JSON.stringify(payload)).catch(() => {});
}

/**
 * Deterministically rotate non-Quran albums per 12-hour window and interleave
 * artists so back-to-back albums by the same artist don't cluster at the top.
 */
export function rotateAlbumsForWindow(albumsList, ownerId = 'guest', now = Date.now()) {
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
