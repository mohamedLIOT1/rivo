import { isQuranContent } from './quranUtils';

export const AI_MIX_CACHE_KEY = 'rivo_ai_mood_mix_v2';
export const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

export function get12hBucket(now = Date.now()) {
  return Math.floor(now / TWELVE_HOURS_MS);
}

export function seededHash(str) {
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

export const ARTIST_PRESTIGE_SCORES = {
  'cairokee': 2500000,
  'cairokeeofficial': 2500000,
  'amr diab': 2400000,
  'wegz': 2300000,
  'marwan pablo': 2200000,
  'tul8te': 2100000,
  'amir eid': 2000000,
  'lege-cy': 1950000,
  'hamaki': 1900000,
  'mohamed mounir': 1850000,
  'tamer ashour': 1800000,
  'sherine': 1750000,
  'marwan moussa': 1700000,
  'afroto': 1650000,
  'el joker': 1600000,
  'abyusif': 1550000,
  'shahyn': 1500000,
  'mousv': 1450000,
  'massar egbari': 1400000,
  'sharmoofers': 1350000,
  'autostrad': 1300000,
  'angham': 1250000,
  'nancy ajram': 1200000,
  'elissa': 1150000,
  'tamer hosny': 1100000,
  'bahaa sultan': 1050000,
  'rubi': 1000000,
};

export function getAlbumPrestigeScore(album) {
  if (!album) return 0;
  let score = 0;
  const normArtist = String(album.artist || '').toLowerCase().trim();

  for (const [artistKey, prestige] of Object.entries(ARTIST_PRESTIGE_SCORES)) {
    if (normArtist.includes(artistKey)) {
      score += prestige;
      break;
    }
  }

  const count = Number(album.trackCount || album.songsCount || (Array.isArray(album.tracks) ? album.tracks.length : (album.trackIds ? album.trackIds.length : 0))) || 0;
  if (count >= 8) {
    score += 800000;
  } else if (count >= 4) {
    score += 400000;
  }
  score += Math.min(count, 20) * 20000;

  if (album.isVerified) score += 300000;
  if (album.isSystem) score += 200000;

  const yearMatch = String(album.releaseDate || '').match(/\b(19\d\d|20\d\d)\b/);
  if (yearMatch) {
    const year = parseInt(yearMatch[1], 10);
    if (year >= 2020) score += 150000;
    else if (year >= 2010) score += 100000;
    else if (year >= 1990) score += 75000;
  }

  if (album.cover && typeof album.cover === 'string' && album.cover.startsWith('http')) {
    score += 50000;
  }

  return score;
}

/**
 * Curate top featured albums with:
 * 1. Filter out singles and Quran recitations
 * 2. Rank albums by popularity and prestige
 * 3. 12-hour deterministic seed rotation (refreshes twice daily)
 * 4. Strict artist interleaving (never show consecutive albums by the same artist)
 * 5. Returns curated list of albums (default 16)
 */
export function curateFeaturedAlbums(albumsList, { ownerId = 'guest', now = Date.now(), limit = 16 } = {}) {
  if (!Array.isArray(albumsList) || albumsList.length === 0) return [];

  const bucket12h = get12hBucket(now);

  const realAlbums = albumsList.filter((a) => {
    if (!a) return false;
    if (a.isQuran || a.genre === 'Holy Quran' || a.genre === 'Quran' || isQuranContent(a)) return false;
    const type = (a.releaseType || '').toLowerCase();
    if (type === 'single') return false;
    const count = Number(a.trackCount || a.songsCount || (Array.isArray(a.tracks) ? a.tracks.length : (a.trackIds ? a.trackIds.length : 0)));
    if (count <= 1) return false;
    const name = String(a.name || a.title || '').toLowerCase().trim();
    if (name.endsWith('- single') || name.endsWith('(single)')) return false;
    return true;
  });

  if (realAlbums.length === 0) return [];

  const scored = realAlbums.map((alb) => {
    const prestige = getAlbumPrestigeScore(alb);
    const albId = String(alb.id || alb._id || alb.name || '');
    const seedKey = `${bucket12h}:${ownerId}:${albId}`;
    const hash = seededHash(seedKey);
    const rotationJitter = hash % 1500000;
    const totalScore = prestige + rotationJitter;

    return {
      album: alb,
      totalScore,
      normArtist: String(alb.artist || 'unknown').trim().toLowerCase(),
    };
  });

  scored.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return String(a.album.name || '').localeCompare(String(b.album.name || ''));
  });

  const result = [];
  const picked = new Uint8Array(scored.length);
  let lastArtist = '';
  const targetCount = Math.min(limit, scored.length);

  while (result.length < targetCount) {
    let pickIndex = -1;

    for (let i = 0; i < scored.length; i++) {
      if (picked[i]) continue;
      const art = scored[i].normArtist;
      if (art && art === lastArtist) continue;
      pickIndex = i;
      break;
    }

    if (pickIndex === -1) {
      for (let i = 0; i < scored.length; i++) {
        if (!picked[i]) {
          pickIndex = i;
          break;
        }
      }
    }

    if (pickIndex === -1) break;

    picked[pickIndex] = 1;
    const chosen = scored[pickIndex];
    result.push(chosen.album);
    lastArtist = chosen.normArtist;
  }

  return result;
}

/**
 * Deterministically rotate albums per 12-hour window and interleave artists.
 * Defaults to top 16 curated releases.
 */
export function rotateAlbumsForWindow(albumsList, ownerId, now = Date.now(), limit = 16) {
  return curateFeaturedAlbums(albumsList, { ownerId, now, limit });
}

/**
 * Safely debounces and limits cached album list in localStorage to prevent main thread lockups
 */
export function cacheAlbumsToStorage(albumsList) {
  if (!Array.isArray(albumsList) || albumsList.length === 0 || typeof window === 'undefined') return;

  const persist = () => {
    try {
      const sliceLimit = Math.min(albumsList.length, 30);
      const slim = [];
      for (let i = 0; i < sliceLimit; i++) {
        const a = albumsList[i];
        if (!a) continue;
        slim.push({
          id: a.id || a._id,
          _id: a._id || a.id,
          name: a.name || a.title || '',
          artist: a.artist || '',
          cover: a.cover || '',
          trackCount: Number(a.trackCount || a.songsCount || 0),
          releaseType: a.releaseType || '',
          genre: a.genre || '',
          isQuran: Boolean(a.isQuran)
        });
      }
      localStorage.setItem('rivo_albums', JSON.stringify(slim));
    } catch {}
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(persist, { timeout: 3000 });
  } else {
    setTimeout(persist, 1000);
  }
}

