/**
 * Rivo Intelligent Rules-Based Music Genre & Content Classifier
 * Detects authentic genres and Quran recitations from titles, artists, albums, tags, and metadata.
 */

const { GENRES, GENERIC_GENRES } = require('./genreRules/genreDefinitions');
const {
  normalizeSearchText,
  cleanTrackMetadata,
  hasArabicScript,
  matchesPattern,
  escapeRegex
} = require('./genreRules/textNormalizer');

const AMBIGUOUS_ARTISTS = new Set([
  'future', 'queen', 'santa', 'flex', 'flx', 'rose', 'star', 'legend', 'hero', 'angel', 'free', 'ghost',
  'وردة', 'صباح', 'شهاب', 'مهاب', 'شاهين', 'الضبع', 'عنبة', 'كزبرة', 'فيلو', 'مسلم', 'نور', 'سيف'
]);

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
        isPodcast: Boolean(def.isPodcast),
        priority: def.isQuran ? 100 : (def.isPodcast ? 95 : 80)
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
        isPodcast: Boolean(def.isPodcast),
        priority: def.isQuran ? 100 : (def.isPodcast ? 95 : 70)
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
 * Checks if metadata represents Podcast content.
 */
function isPodcastContent(title = '', artist = '', album = '', genre = '', description = '') {
  const normGenre = normalizeSearchText(genre);
  if (normGenre === 'podcast' || normGenre === 'بودكاست') return true;

  const combined = normalizeSearchText(`${title} ${artist} ${album} ${genre} ${description}`);
  if (!combined) return false;

  // Check Podcast aliases & keywords
  for (const item of KEYWORD_INDEX) {
    if (item.isPodcast && matchesPattern(combined, item.normalized)) {
      return true;
    }
  }

  // Check Podcast creator artists
  for (const item of ARTIST_INDEX) {
    if (item.isPodcast && matchesPattern(combined, item.normalized)) {
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
      isPodcast: false,
      confidence: 0.98,
      matchedBy: 'quran_rule',
      matchedTerm: 'Quran/Recitation'
    };
  }

  // 1.1 Priority Check: Podcasts & Shows
  if (isPodcastContent(title, artist, album, rawGenre, description)) {
    const p = GENRES.PODCAST;
    return {
      genre: p.name,
      arabicGenre: p.arabicName,
      genreCode: p.code,
      color: p.color,
      isQuran: false,
      isPodcast: true,
      confidence: 0.96,
      matchedBy: 'podcast_rule',
      matchedTerm: 'Podcast/Episode'
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
        isPodcast: Boolean(aliasMatch.isPodcast),
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
      isPodcast: rawGenre.toLowerCase() === 'podcast' || rawGenre === 'بودكاست',
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
          isPodcast: Boolean(item.genre.isPodcast),
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
        isPodcast: Boolean(item.genre.isPodcast),
        confidence: 0.85,
        matchedBy: 'keyword_match',
        matchedTerm: item.normalized
      };
    }
  }

  // 5. Fallback artist search within title (e.g. "Wegz - El Bakht" where artist is in title)
  for (const item of ARTIST_INDEX) {
    if (item.isQuran || item.isPodcast) continue;
    if (AMBIGUOUS_ARTISTS.has(item.normalized)) {
      const escaped = escapeRegex(item.normalized);
      const artistPosRegex = new RegExp(`(?:^|[-_|/:]\\s*|(?:feat|ft|featuring|prod|with|by)\\.?\\s+)${escaped}(?:\\s*[-_|/:]|\\s*$)`, 'iu');
      if (!artistPosRegex.test(title)) continue;
    }
    if (matchesPattern(normTitle, item.normalized)) {
      return {
        genre: item.genre.name,
        arabicGenre: item.genre.arabicName,
        genreCode: item.genre.code,
        color: item.genre.color,
        isQuran: false,
        isPodcast: false,
        confidence: 0.80,
        matchedBy: 'title_artist_match',
        matchedTerm: item.normalized
      };
    }
  }

  // 6. Multi-Feature Cue Detection (Rock, Metal, Indie, Classical, Tarab, Jazz, Electronic, R&B, Soundtrack, Shaabi, Mahraganat)
  const FEATURE_RULES = [
    { genre: GENRES.CLASSICAL, patterns: ['symphony', 'concerto', 'sonata', 'philharmonic', 'orchestral', 'orchestra', 'chamber music', 'opera', 'سيمفونية', 'اوركسترا', 'أوركسترا', 'موسيقى كلاسيكية', 'كونشيرتو', 'سوناتا'] },
    { genre: GENRES.SOUNDTRACK, patterns: ['soundtrack', 'original soundtrack', 'ost', 'film score', 'movie score', 'main theme', 'motion picture score', 'instrumental', 'game soundtrack', 'anime ost', 'موسيقى تصويرية', 'اوست'] },
    { genre: GENRES.METAL, patterns: ['heavy metal', 'death metal', 'black metal', 'thrash metal', 'metalcore', 'doom metal', 'ميتال', 'الميتال'] },
    { genre: GENRES.ROCK, patterns: ['hard rock', 'alternative rock', 'classic rock', 'grunge', 'punk rock', 'indie rock', 'روك', 'الروك'] },
    { genre: GENRES.INDIE, patterns: ['underground', 'acoustic version', 'unplugged', 'garage rock', 'indie folk', 'إندي', 'اندي', 'بديل', 'اندرجراوند'] },
    { genre: GENRES.TARAB, patterns: ['طرب أصيل', 'طرب اصيل', 'طرب', 'سلطنة', 'تخت شرقي', 'تقاسيم عود', 'موشحات', 'قدود حلبية', 'قصيدة مغناة', 'موال طربي'] },
    { genre: GENRES.MAHRAGANAT, patterns: ['مهرجان', 'مهرجانات', 'سرسجي', 'توزيع درامز', 'درامز جديد', 'electro shaabi'] },
    { genre: GENRES.SHAABI, patterns: ['أغاني شعبية', 'اغاني شعبية', 'شعبيات مصرية', 'موال شعبي', 'شعبي قديم', 'egyptian shaabi'] },
    { genre: GENRES.JAZZ, patterns: ['smooth jazz', 'bebop', 'swing jazz', 'saxophone solo', 'جاز', 'بلوز'] },
    { genre: GENRES.ELECTRONIC, patterns: ['deep house', 'synthwave', 'techno remix', 'club mix', 'dubstep', 'extended mix', 'إلكترونيك', 'دي جي'] },
    { genre: GENRES.LOFI, patterns: ['chillhop', 'study beats', 'chill beats', 'sleep beats', 'lofi hip hop', 'لوفاي', 'لو فاي'] },
    { genre: GENRES.RNB, patterns: ['neo soul', 'rnb soul', 'motown', 'آر آند بي', 'سول'] },
    { genre: GENRES.BOLLYWOOD_INDIC, patterns: ['bollywood', 'punjabi song', 'hindi song', 'bhangra', 'filmi', 'بوليوود', 'اغاني هندية', 'هندي'] },
    { genre: GENRES.KHALEEJI, patterns: ['شيلات حصرية', 'شيلة جديدة', 'سامري', 'جلسة طرب', 'جلسة خليجية'] }
  ];

  for (const rule of FEATURE_RULES) {
    if (rule.genre && rule.patterns.some(p => matchesPattern(fullText, normalizeSearchText(p)))) {
      return {
        genre: rule.genre.name,
        arabicGenre: rule.genre.arabicName,
        genreCode: rule.genre.code,
        color: rule.genre.color,
        isQuran: false,
        isPodcast: false,
        confidence: 0.70,
        matchedBy: 'multi_feature_cue',
        matchedTerm: rule.genre.name
      };
    }
  }

  // 7. Linguistic / Script Heuristic
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
      isPodcast: false,
      confidence: 0.60,
      matchedBy: 'script_heuristic',
      matchedTerm: 'Arabic Script'
    };
  }

  // 8. General Fallback
  const pop = GENRES.POP;
  return {
    genre: pop.name,
    arabicGenre: pop.arabicName,
    genreCode: pop.code,
    color: pop.color,
    isQuran: false,
    isPodcast: false,
    confidence: 0.50,
    matchedBy: 'fallback',
    matchedTerm: 'default'
  };
}

/**
 * Helper to enrich a track object or payload with intelligent genre, podcast, and Quran detection.
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

  const isQuran = Boolean(track.isQuran || classification.isQuran);
  const isPodcast = !isQuran && Boolean(track.isPodcast || classification.isPodcast || track.contentType === 'podcast');

  return {
    ...track,
    genre: classification.genre,
    arabicGenre: classification.arabicGenre,
    isQuran,
    isPodcast,
    contentType: isQuran ? 'quran' : (isPodcast ? 'podcast' : (track.contentType || 'music'))
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
    isQuran: Boolean(g.isQuran),
    isPodcast: Boolean(g.isPodcast)
  }));
}

module.exports = {
  classifyGenre,
  enrichTrackMetadata,
  isQuranContent,
  isPodcastContent,
  getAllGenres,
  GENRES,
  GENERIC_GENRES
};
