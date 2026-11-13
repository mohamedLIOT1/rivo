/**
 * Album Curation Algorithm for Rivo
 * - Popularity & Prestige Ranking
 * - 12-Hour Deterministic Seed Rotation (Refreshes twice daily)
 * - Strict Artist Interleaving (Zero consecutive releases from the same artist)
 * - Curates top 16 releases
 */

const { isQuranContent } = require('../../utils/helpers');

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

function get12hBucket(now = Date.now()) {
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

const ARTIST_PRESTIGE_SCORES = {
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
  'rubi': 1000000
};

function getAlbumPrestigeScore(album) {
  if (!album) return 0;
  let score = 0;
  const normArtist = String(album.artist || '').toLowerCase().trim();

  for (const [artistKey, prestige] of Object.entries(ARTIST_PRESTIGE_SCORES)) {
    if (normArtist.includes(artistKey)) {
      score += prestige;
      break;
    }
  }

  const count = Number(album.trackCount || album.songsCount || 0);
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

function curateFeaturedAlbums(albumsList, { ownerId = 'global', now = Date.now(), limit = 16 } = {}) {
  if (!Array.isArray(albumsList) || albumsList.length === 0) return [];

  const bucket12h = get12hBucket(now);

  const realAlbums = albumsList.filter((a) => {
    if (!a) return false;
    if (a.isQuran || a.genre === 'Holy Quran' || a.genre === 'Quran') return false;
    const rawName = String(a.name || a.title || '');
    if (isQuranContent(rawName, a.artist, rawName, a.genre)) return false;

    const type = (a.releaseType || '').toLowerCase();
    if (type === 'single') return false;
    const count = Number(a.trackCount || a.songsCount || 0);
    if (count <= 1) return false;
    const lowerName = rawName.toLowerCase().trim();
    if (lowerName.endsWith('- single') || lowerName.endsWith('(single)')) return false;

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

module.exports = {
  get12hBucket,
  seededHash,
  getAlbumPrestigeScore,
  curateFeaturedAlbums
};
