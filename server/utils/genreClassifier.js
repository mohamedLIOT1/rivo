/**
 * Rivo Intelligent Rules-Based Music Genre & Content Classifier
 * Detects authentic genres and Quran recitations from titles, artists, albums, tags, and metadata.
 */

const { GENRES, GENERIC_GENRES } = require('./genreRules/genreDefinitions');
const {
  normalizeSearchText,
  cleanTrackMetadata,
  hasArabicScript,
  matchesPattern
} = require('./genreRules/textNormalizer');

// Pre-compiled normalized lookup tables for high-performance matching
const ARTIST_INDEX = [];
const KEYWORD_INDEX = [];
const ALIAS_INDEX = new Map();

// Build normalized indices once at module load
for (const [key, def] of Object.entries(GENRES)) {
  // Aliases
  for (const alias of def.aliases) {
    ALIAS_INDEX.set(normalizeSearchText(alias), def);
  }
  ALIAS_INDEX.set(normalizeSearchText(def.name), def);
  ALIAS_INDEX.set(normalizeSearchText(def.arabicName), def);

  // Artists
  for (const artist of def.artists) {
    const norm = normalizeSearchText(artist);
    if (norm) {
      ARTIST_INDEX.push({
        normalized: norm,
        genre: def,
        isQuran: Boolean(def.isQuran),
        priority: def.isQuran ? 100 : (key === 'SHAABI' || key === 'RAP' ? 90 : 80)
      });
    }
  }

  // Keywords
  for (const kw of def.keywords) {
    const norm = normalizeSearchText(kw);
    if (norm) {
      KEYWORD_INDEX.push({
        normalized: norm,
        genre: def,
        isQuran: Boolean(def.isQuran),
        priority: def.isQuran ? 100 : (key === 'SHAABI' || key === 'RAP' ? 90 : 70)
      });
    }
  }
}

// Sort indices by descending priority and longer phrase length first
ARTIST_INDEX.sort((a, b) => b.priority - a.priority || b.normalized.length - a.normalized.length);
KEYWORD_INDEX.sort((a, b) => b.priority - a.priority || b.normalized.length - a.normalized.length);

/**
 * Checks if metadata represents Holy Quran recitation.
 */
function isQuranContent(title = '', artist = '', album = '', genre = '', description = '') {
  const combined = normalizeSearchText(`${title} ${artist} ${album} ${genre} ${description}`);
  if (!combined) return false;

  // Check Quran aliases & keywords
  for (const item of KEYWORD_INDEX) {
    if (item.isQuran && matchesPattern(combined, item.normalized)) {
      return true;
    }
  }

  // Check Quran reciter artists
  for (const item of ARTIST_INDEX) {
    if (item.isQuran && matchesPattern(combined, item.normalized)) {
      return true;
    }
  }

  return false;
}

/**
 * Core classifier function: deduces authentic genre from track metadata.
 */
function classifyGenre({
  title = '',
  artist = '',
  album = '',
  genre = '',
  tags = [],
  description = ''
} = {}) {
  const rawGenre = String(genre || '').trim();
  const normExplicit = normalizeSearchText(rawGenre);
  const normArtist = normalizeSearchText(artist);
  const normTitle = normalizeSearchText(title);
  const normAlbum = normalizeSearchText(album);
  const tagStr = Array.isArray(tags) ? tags.join(' ') : String(tags || '');
  const normTags = normalizeSearchText(tagStr);
  const normDescription = normalizeSearchText(description);

  const fullText = `${normTitle} ${normArtist} ${normAlbum} ${normTags} ${normDescription}`.trim();

  // 1. Highest Priority Check: Holy Quran & Recitations
  if (isQuranContent(title, artist, album, rawGenre, description)) {
    const q = GENRES.QURAN;
    return {
      genre: q.name,
      arabicGenre: q.arabicName,
      genreCode: q.code,
      color: q.color,
      isQuran: true,
      confidence: 0.98,
      matchedBy: 'quran_rule',
      matchedTerm: 'Quran/Recitation'
    };
  }

  // 2. Exact or Alias Match on Valid User-Supplied Genre (excluding generic 'Pop', 'Imported', etc.)
  if (normExplicit && !GENERIC_GENRES.has(normExplicit)) {
    const aliasMatch = ALIAS_INDEX.get(normExplicit);
    if (aliasMatch) {
      return {
        genre: aliasMatch.name,
        arabicGenre: aliasMatch.arabicName,
        genreCode: aliasMatch.code,
        color: aliasMatch.color,
        isQuran: Boolean(aliasMatch.isQuran),
        confidence: 0.95,
        matchedBy: 'explicit_alias',
        matchedTerm: rawGenre
      };
    }
    // Specific custom genre (e.g., 'Acoustic', 'Country', 'Reggae')
    return {
      genre: rawGenre,
      arabicGenre: rawGenre,
      genreCode: 'CUSTOM',
      color: '#6b7280',
      isQuran: false,
      confidence: 0.90,
      matchedBy: 'explicit_custom',
      matchedTerm: rawGenre
    };
  }

  // 3. Artist Matching (First match exact artist, then search in full text)
  if (normArtist) {
    for (const item of ARTIST_INDEX) {
      if (matchesPattern(normArtist, item.normalized)) {
        return {
          genre: item.genre.name,
          arabicGenre: item.genre.arabicName,
          genreCode: item.genre.code,
          color: item.genre.color,
          isQuran: Boolean(item.genre.isQuran),
          confidence: 0.92,
          matchedBy: 'artist_match',
          matchedTerm: item.normalized
        };
      }
    }
  }

  // 4. Keyword & Tag Matching in Title & Full Text
  for (const item of KEYWORD_INDEX) {
    if (matchesPattern(fullText, item.normalized)) {
      return {
        genre: item.genre.name,
        arabicGenre: item.genre.arabicName,
        genreCode: item.genre.code,
        color: item.genre.color,
        isQuran: Boolean(item.genre.isQuran),
        confidence: 0.85,
        matchedBy: 'keyword_match',
        matchedTerm: item.normalized
      };
    }
  }

  // 5. Fallback artist search within title (e.g. "Wegz - El Bakht" where artist is in title)
  for (const item of ARTIST_INDEX) {
    if (matchesPattern(fullText, item.normalized)) {
      return {
        genre: item.genre.name,
        arabicGenre: item.genre.arabicName,
        genreCode: item.genre.code,
        color: item.genre.color,
        isQuran: Boolean(item.genre.isQuran),
        confidence: 0.80,
        matchedBy: 'title_artist_match',
        matchedTerm: item.normalized
      };
    }
  }

  // 6. Linguistic / Script Heuristic
  // If track text is in Arabic and has not matched specific genres, it's Arabic Pop rather than international Pop
  const rawCombined = `${title} ${artist} ${album}`;
  if (hasArabicScript(rawCombined)) {
    const ap = GENRES.ARABIC_POP;
    return {
      genre: ap.name,
      arabicGenre: ap.arabicName,
      genreCode: ap.code,
      color: ap.color,
      isQuran: false,
      confidence: 0.65,
      matchedBy: 'script_heuristic',
      matchedTerm: 'Arabic Script'
    };
  }

  // 7. General Fallback
  const pop = GENRES.POP;
  return {
    genre: pop.name,
    arabicGenre: pop.arabicName,
    genreCode: pop.code,
    color: pop.color,
    isQuran: false,
    confidence: 0.50,
    matchedBy: 'fallback',
    matchedTerm: 'default'
  };
}

/**
 * Helper to enrich a track object or payload with intelligent genre and Quran detection.
 */
function enrichTrackMetadata(track = {}) {
  if (!track || typeof track !== 'object') return track;
  const classification = classifyGenre({
    title: track.title,
    artist: track.artist,
    album: track.album,
    genre: track.genre,
    tags: track.tags,
    description: track.description
  });

  return {
    ...track,
    genre: classification.genre,
    arabicGenre: classification.arabicGenre,
    isQuran: Boolean(track.isQuran || classification.isQuran),
    contentType: classification.isQuran ? 'quran' : (track.contentType || 'music')
  };
}

/**
 * Returns the list of all defined genres.
 */
function getAllGenres() {
  return Object.values(GENRES).map(g => ({
    id: g.id,
    name: g.name,
    arabicName: g.arabicName,
    code: g.code,
    color: g.color,
    isQuran: Boolean(g.isQuran)
  }));
}

module.exports = {
  classifyGenre,
  enrichTrackMetadata,
  isQuranContent,
  getAllGenres,
  GENRES,
  GENERIC_GENRES
};
