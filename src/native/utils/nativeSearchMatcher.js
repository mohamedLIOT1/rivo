/**
 * Native Search Matcher & Bilingual Query Engine
 * Provides instant 0-lag in-memory matching for Artists, Songs, and Albums
 * Supports Arabic, English, Franco-Arabic transliteration, and canonical aliases.
 * Strictly modularized (< 400 lines) per AGENTS.md.
 */

import { splitArtists, getCanonicalArtistName } from '../../utils/artistUtils.js';
import { getCanonicalArtist, getAllArtistAliases } from '../../utils/artistAliases.js';
import { getExpandedSearchTerms } from '../../utils/searchSynonyms.js';

export const normalizeFuzzy = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[-_.\s/\\,:+()~`'"!?#@*&^%$[\]{}|<>]+/g, '')
    .trim();
};

/**
 * Prepares search query context for ultra-fast loop execution.
 */
export function prepareSearchContext(rawQuery) {
  const query = (rawQuery || '').trim();
  if (!query) {
    return {
      query: '',
      cleanQuery: '',
      fuzzyQuery: '',
      queryCanonical: '',
      expandedTerms: [],
      hasSearch: false,
    };
  }

  const cleanQuery = query.toLowerCase();
  const fuzzyQuery = normalizeFuzzy(cleanQuery);
  const queryCanonical = (getCanonicalArtist(cleanQuery) || getCanonicalArtistName(cleanQuery) || '').toLowerCase().trim();
  const expandedTerms = getExpandedSearchTerms(query);

  return {
    query,
    cleanQuery,
    fuzzyQuery,
    queryCanonical,
    expandedTerms,
    hasSearch: true,
  };
}

/**
 * Matches an artist object against the prepared search context.
 */
export function matchArtistBilingual(artist, ctx) {
  if (!artist || !ctx.hasSearch) return true;

  const { cleanQuery, fuzzyQuery, queryCanonical, expandedTerms } = ctx;
  const artName = (artist.name || '').toLowerCase();
  const normArtName = normalizeFuzzy(artist.name);

  // 1. Direct name match or reverse substring
  if (artName.includes(cleanQuery) || (fuzzyQuery && normArtName.includes(fuzzyQuery))) {
    return true;
  }
  if (cleanQuery.includes(artName) || (normArtName && fuzzyQuery.includes(normArtName))) {
    return true;
  }

  // 2. Canonical artist match (e.g. typing "عمرو دياب" matching "Amr Diab")
  const artistCanonical = (
    artist.canonical ||
    getCanonicalArtist(artist.name) ||
    getCanonicalArtistName(artist.name) ||
    artist.name
  ).toLowerCase().trim();

  if (queryCanonical && artistCanonical && (queryCanonical === artistCanonical || queryCanonical.includes(artistCanonical) || artistCanonical.includes(queryCanonical))) {
    return true;
  }

  // 3. Known aliases of artist
  const aliases = Array.isArray(artist.aliases) ? artist.aliases : getAllArtistAliases(artist.name);
  for (let i = 0; i < aliases.length; i++) {
    const al = (aliases[i] || '').toLowerCase();
    const normAl = normalizeFuzzy(al);
    if (al.includes(cleanQuery) || (fuzzyQuery && normAl.includes(fuzzyQuery))) {
      return true;
    }
    if (cleanQuery.includes(al) || (normAl && fuzzyQuery.includes(normAl))) {
      return true;
    }
  }

  // 4. Expanded synonyms & Franco-Arabic terms
  for (let i = 0; i < expandedTerms.length; i++) {
    const term = (expandedTerms[i] || '').toLowerCase();
    const termFz = normalizeFuzzy(term);
    if (!term) continue;

    if (artName.includes(term) || (termFz && normArtName.includes(termFz))) {
      return true;
    }
    for (let j = 0; j < aliases.length; j++) {
      const al = (aliases[j] || '').toLowerCase();
      const normAl = normalizeFuzzy(al);
      if (al.includes(term) || (termFz && normAl.includes(termFz))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Matches a track against the prepared search context.
 */
export function matchTrackBilingual(track, ctx) {
  if (!track || !ctx.hasSearch) return true;

  const { cleanQuery, fuzzyQuery, queryCanonical, expandedTerms } = ctx;
  const titleLower = (track.title || '').toLowerCase();
  const artistLower = (track.artist || '').toLowerCase();
  const albumLower = (track.album || '').toLowerCase();

  const titleFuzzy = normalizeFuzzy(track.title);
  const artistFuzzy = normalizeFuzzy(track.artist);
  const albumFuzzy = normalizeFuzzy(track.album);

  // 1. Direct field match
  if (
    titleLower.includes(cleanQuery) ||
    artistLower.includes(cleanQuery) ||
    albumLower.includes(cleanQuery) ||
    (fuzzyQuery && titleFuzzy.includes(fuzzyQuery)) ||
    (fuzzyQuery && artistFuzzy.includes(fuzzyQuery)) ||
    (fuzzyQuery && albumFuzzy.includes(fuzzyQuery))
  ) {
    return true;
  }

  // 2. Artist canonical match
  const trackArtistCanonical = (getCanonicalArtist(track.artist) || getCanonicalArtistName(track.artist) || '').toLowerCase().trim();
  if (queryCanonical && trackArtistCanonical && (queryCanonical === trackArtistCanonical || trackArtistCanonical.includes(queryCanonical))) {
    return true;
  }

  // 3. Track artists aliases (Arabic + English + Franco)
  const artistNames = splitArtists(track.artist);
  const trackAliases = [];
  for (let i = 0; i < artistNames.length; i++) {
    const a = artistNames[i];
    trackAliases.push(a.toLowerCase());
    const aliases = getAllArtistAliases(a);
    for (let j = 0; j < aliases.length; j++) {
      trackAliases.push(aliases[j].toLowerCase());
    }
  }

  // Direct check of query against track artist aliases
  for (let i = 0; i < trackAliases.length; i++) {
    const al = trackAliases[i];
    const normAl = normalizeFuzzy(al);
    if (al.includes(cleanQuery) || (fuzzyQuery && normAl.includes(fuzzyQuery))) {
      return true;
    }
  }

  // 4. Expanded terms (Bilingual & Synonyms)
  for (let i = 0; i < expandedTerms.length; i++) {
    const term = expandedTerms[i];
    const termFz = normalizeFuzzy(term);
    if (!term) continue;

    if (
      titleLower.includes(term) ||
      artistLower.includes(term) ||
      albumLower.includes(term) ||
      (termFz && titleFuzzy.includes(termFz)) ||
      (termFz && artistFuzzy.includes(termFz)) ||
      (termFz && albumFuzzy.includes(termFz))
    ) {
      return true;
    }

    for (let j = 0; j < trackAliases.length; j++) {
      const al = trackAliases[j];
      const normAl = normalizeFuzzy(al);
      if (al.includes(term) || (termFz && normAl.includes(termFz))) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Matches an album against the prepared search context.
 */
export function matchAlbumBilingual(album, ctx) {
  if (!album || !ctx.hasSearch) return true;

  const { cleanQuery, fuzzyQuery, queryCanonical, expandedTerms } = ctx;
  const nameLower = (album.name || '').toLowerCase();
  const artistLower = (album.artist || '').toLowerCase();
  const nameFuzzy = normalizeFuzzy(album.name);
  const artistFuzzy = normalizeFuzzy(album.artist);

  if (
    nameLower.includes(cleanQuery) ||
    artistLower.includes(cleanQuery) ||
    (fuzzyQuery && nameFuzzy.includes(fuzzyQuery)) ||
    (fuzzyQuery && artistFuzzy.includes(fuzzyQuery))
  ) {
    return true;
  }

  const albArtistCanonical = (getCanonicalArtist(album.artist) || getCanonicalArtistName(album.artist) || '').toLowerCase().trim();
  if (queryCanonical && albArtistCanonical && (queryCanonical === albArtistCanonical || albArtistCanonical.includes(queryCanonical))) {
    return true;
  }

  for (let i = 0; i < expandedTerms.length; i++) {
    const term = expandedTerms[i];
    const termFz = normalizeFuzzy(term);
    if (!term) continue;

    if (
      nameLower.includes(term) ||
      artistLower.includes(term) ||
      (termFz && nameFuzzy.includes(termFz)) ||
      (termFz && artistFuzzy.includes(termFz))
    ) {
      return true;
    }
  }

  return false;
}
