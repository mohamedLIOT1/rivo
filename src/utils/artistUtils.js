/**
 * Rivo Artist Utilities (Pure JS - Core Engine)
 * Strictly modularized (< 400 lines) per AGENTS.md.
 */

import React from 'react';

/**
 * Regex matching multiple artist separators:
 * - Comma, Arabic comma, ampersands, plus, forward slashes
 * - Words like: and, ft, feat, featuring, with, x
 * - Oxford commas: ", &", ", and", etc.
 */
export const ARTIST_DELIMITER_REGEX = /(?:\s*(?:,|،)\s*(?:&|and|\+|،)?|\s*&\s*|\s*\+\s*|\s*\/\s*|\s+(?:and|ft\.?|feat\.?|featuring|with|x|X)\s+)+/i;

/**
 * Built-in dictionary of canonical artists and their known aliases/members/typos.
 */
export const CANONICAL_ARTIST_MAP = [
  {
    canonical: 'Cairokee',
    aliases: [
      'cairokee', 'cairokeeoffical', 'cairokeeofficial', 'cairokee official',
      'amir eid', 'amireid', 'أمير عيد', 'كايروكي', 'cairokee كايروكي', 'كايروكي cairokee'
    ],
    displayAliasInfo: 'Includes Cairokee, CairokeeOfficial & Amir Eid solo works'
  },
  {
    canonical: 'Mohamed Hamaki',
    aliases: ['hamaki', 'mohamed hamaki', 'محمد حماقي', 'حماقي', 'mohamed hamaki محمد حماقي', 'محمد حماقي mohamed hamaki']
  },
  {
    canonical: 'Amr Diab',
    aliases: ['amr diab', 'عمرو دياب', 'elhadaba', 'el hadaba', 'الهضبة', 'amr diab عمرو دياب', 'عمرو دياب amr diab']
  },
  {
    canonical: 'Tamer Hosny',
    aliases: ['tamer hosny', 'tamer hosni', 'تامر حسني', 'tamer hosny تامر حسني', 'تامر حسني tamer hosny']
  },
  {
    canonical: 'Marwan Pablo',
    aliases: ['marwan pablo', 'pablo', 'مروان بابلو', 'بابلو', 'marwan pablo مروان بابلو', 'مروان بابلو marwan pablo']
  },
  {
    canonical: 'Wegz',
    aliases: ['wegz', 'ويجز', 'wegzz', 'ويجز wegz', 'wegz ويجز']
  },
  {
    canonical: 'Lege-Cy',
    aliases: ['lege-cy', 'lege cy', 'legecy', 'legi c', 'legi-c', 'legic', 'ليجيسي', 'ليجي', 'ليجسي', 'ليجي سي', 'ليجي-سي', 'lege-cy ليجيسي', 'ليجيسي lege-cy']
  },
  {
    canonical: 'El Joker',
    aliases: ['el joker', 'eljoker', 'joker', 'الجوكر', 'جوكر', 'el joker الجوكر']
  },
  {
    canonical: 'Tul8te',
    aliases: ['tul8te', 'toolete', 'tulet', 'تو ليت', 'توليت', 'توو ليت', 'tul8te توليت', 'توليت tul8te']
  },
  {
    canonical: 'Essam Sasa',
    aliases: ['essam sasa', 'sasa', 'عصام صاصا', 'صاصا', 'عصام صاصا essam sasa']
  },
  {
    canonical: 'Muslim',
    aliases: ['muslim', 'مسلم', 'مسلم muslim']
  },
  {
    canonical: 'Tamer Ashour',
    aliases: ['tamer ashour', 'ashour', 'تامر عاشور', 'عاشور', 'تامر عاشور tamer ashour']
  },
  {
    canonical: 'Abyusif',
    aliases: ['abyusif', 'أبيوسف', 'ابيوسف', 'abyusif أبيوسف']
  },
  {
    canonical: 'Marwan Moussa',
    aliases: ['marwan moussa', 'marwan mousa', 'مروان موسى', 'مروان موسى marwan moussa']
  },
  {
    canonical: 'Afroto',
    aliases: ['afroto', 'عفروتو', 'afroto عفروتو']
  },
  {
    canonical: 'Sharmoofers',
    aliases: ['sharmoofers', 'شارموفرز', 'شارموفرز sharmoofers']
  },
  {
    canonical: 'Massar Egbari',
    aliases: ['massar egbari', 'مسار إجباري', 'مسار اجباري']
  },
  {
    canonical: 'Ahmed Saad',
    aliases: ['ahmed saad', 'أحمد سعد', 'احمد سعد', 'ahmed saad أحمد سعد']
  },
  {
    canonical: 'Bahaa Sultan',
    aliases: ['bahaa sultan', 'بهاء سلطان']
  },
  {
    canonical: 'Sherine',
    aliases: ['sherine', 'sherine abdel-wahab', 'sherine abdel wahab', 'شيرين', 'شيرين عبد الوهاب']
  }
];

/**
 * Normalizes an artist name by stripping uploader suffixes and punctuation.
 */
export function normalizeArtistName(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let clean = raw.trim();
  clean = clean.replace(/\s*-\s*topic\b/gi, '');
  clean = clean.replace(/\b(official(?:\s*(?:channel|music|video|audio|records|tv|page))?|offical|vevo|topic|channel)\b/gi, '');
  clean = clean.replace(/^["'\[\(]+|["'\]\)]+$/g, '');
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean;
}

/**
 * Splits an artist string into an array of distinct artist names.
 */
export function splitArtists(artistStr) {
  if (!artistStr || typeof artistStr !== 'string') return [];

  const hasArabic = /[\u0600-\u06FF]/.test(artistStr);
  const hasLatin = /[a-zA-Z]/.test(artistStr);
  if (hasArabic && hasLatin && !artistStr.match(ARTIST_DELIMITER_REGEX)) {
    const arabicPart = artistStr.replace(/[^\u0600-\u06FF\s]/g, '').trim().toLowerCase();
    const latinPart = artistStr.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim().toLowerCase();
    let arabicMatch = null;
    let latinMatch = null;
    for (const group of CANONICAL_ARTIST_MAP) {
      if (arabicPart && group.aliases.includes(arabicPart)) arabicMatch = group.canonical;
      if (latinPart && group.aliases.includes(latinPart)) latinMatch = group.canonical;
    }
    if (arabicMatch && latinMatch && arabicMatch === latinMatch) {
      return [arabicMatch];
    }
    if (arabicMatch && !latinMatch) return [arabicMatch];
    if (latinMatch && !arabicMatch) return [latinMatch];
  }

  const parts = artistStr.split(ARTIST_DELIMITER_REGEX);
  const result = [];
  const seen = new Set();

  for (let raw of parts) {
    const clean = raw.trim();
    if (!clean) continue;
    const lower = clean.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(clean);
    }
  }

  return result.length > 0 ? result : [artistStr.trim()];
}

/**
 * Extracts all artists from a track or from artist & title strings.
 */
export function getTrackArtists(artistOrTrack, optionalTitle) {
  let artistStr = '';
  let titleStr = '';

  if (artistOrTrack && typeof artistOrTrack === 'object') {
    artistStr = artistOrTrack.artist || '';
    titleStr = artistOrTrack.title || '';
  } else {
    artistStr = typeof artistOrTrack === 'string' ? artistOrTrack : '';
    titleStr = typeof optionalTitle === 'string' ? optionalTitle : '';
  }

  const result = [];
  const seen = new Set();

  function add(name) {
    if (!name) return;
    const clean = name.trim();
    if (!clean) return;
    const lower = clean.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(clean);
    }
  }

  if (artistStr) {
    const parts = artistStr.split(ARTIST_DELIMITER_REGEX).map(s => s.trim()).filter(Boolean);
    parts.forEach(add);
  }

  if (titleStr) {
    const featMatch = titleStr.match(/[\(\[]\s*(?:feat\.?|ft\.?|featuring|with)\s+([^\]\)]+)[\)\]]/i);
    if (featMatch && featMatch[1]) {
      const featParts = featMatch[1].split(ARTIST_DELIMITER_REGEX).map(s => s.trim()).filter(Boolean);
      featParts.forEach(add);
    }
  }

  if (result.length > 0) return result;
  if (artistStr && artistStr.trim()) return [artistStr.trim()];
  return ['Unknown Artist'];
}

/**
 * Formats an array of artist names into a human-friendly string.
 */
export function formatArtists(artistsList) {
  if (!artistsList) return '';
  const arr = Array.isArray(artistsList) ? artistsList : splitArtists(artistsList);
  if (arr.length === 0) return '';
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return `${arr[0]} & ${arr[1]}`;
  return `${arr.slice(0, -1).join(', ')} & ${arr[arr.length - 1]}`;
}

/**
 * Returns the canonical artist name for a given raw name or alias.
 */
export function getCanonicalArtistName(rawName) {
  if (!rawName || typeof rawName !== 'string') return '';
  const trimmed = rawName.trim();
  const lower = trimmed.toLowerCase();
  const normalized = normalizeArtistName(trimmed).toLowerCase();

  for (const group of CANONICAL_ARTIST_MAP) {
    if (group.aliases.includes(lower) || group.aliases.includes(normalized)) {
      return group.canonical;
    }
  }

  const hasArabic = /[\u0600-\u06FF]/.test(trimmed);
  const hasLatin = /[a-zA-Z]/.test(trimmed);
  if (hasArabic && hasLatin) {
    const arabicPart = trimmed.replace(/[^\u0600-\u06FF\s]/g, '').trim().toLowerCase();
    const latinPart = trimmed.replace(/[^a-zA-Z0-9\s\-_]/g, '').trim().toLowerCase();

    for (const group of CANONICAL_ARTIST_MAP) {
      if ((arabicPart && group.aliases.includes(arabicPart)) || (latinPart && group.aliases.includes(latinPart))) {
        return group.canonical;
      }
    }
  }

  const parts = splitArtists(trimmed);
  if (parts.length > 1) {
    for (const part of parts) {
      const partLower = part.toLowerCase().trim();
      for (const group of CANONICAL_ARTIST_MAP) {
        if (group.aliases.includes(partLower)) {
          return group.canonical;
        }
      }
    }
    return parts[0];
  }

  const clean = normalizeArtistName(trimmed);
  return clean || trimmed;
}

/**
 * Returns all aliases associated with an artist.
 */
export function getArtistAliases(artistName) {
  if (!artistName || typeof artistName !== 'string') return [];
  const canonical = getCanonicalArtistName(artistName).toLowerCase();
  for (const group of CANONICAL_ARTIST_MAP) {
    if (group.canonical.toLowerCase() === canonical) {
      return group.aliases;
    }
  }
  return [artistName.toLowerCase().trim()];
}

/**
 * Returns display info about aliases.
 */
export function getArtistAliasNote(artistName) {
  if (!artistName || typeof artistName !== 'string') return null;
  const canonical = getCanonicalArtistName(artistName).toLowerCase();
  for (const group of CANONICAL_ARTIST_MAP) {
    if (group.canonical.toLowerCase() === canonical && group.displayAliasInfo) {
      return group.displayAliasInfo;
    }
  }
  return null;
}

/**
 * Checks whether a track belongs to an artist name or key.
 */
export function matchesArtist(track, targetArtist) {
  if (!track || !targetArtist) return false;

  const rawTarget = (
    typeof targetArtist === 'string'
      ? targetArtist
      : (targetArtist.name || targetArtist.artist || '')
  ).trim();

  if (!rawTarget) return false;

  const canonicalTarget = getCanonicalArtistName(rawTarget).toLowerCase();
  const targetAliases = new Set([
    rawTarget.toLowerCase(),
    canonicalTarget,
    ...getArtistAliases(rawTarget).map(a => a.toLowerCase()),
    ...getArtistAliases(canonicalTarget).map(a => a.toLowerCase())
  ]);

  const targetId = typeof targetArtist === 'object' ? targetArtist.id : null;
  if (targetId && track.artistId && String(track.artistId) === String(targetId)) {
    return true;
  }

  if (track.artist) {
    const rawTrackArtist = track.artist.trim().toLowerCase();
    const canonicalTrackArtist = getCanonicalArtistName(track.artist).toLowerCase();
    if (targetAliases.has(rawTrackArtist) || targetAliases.has(canonicalTrackArtist)) {
      return true;
    }
  }

  const trackArtists = getTrackArtists(track);
  for (const a of trackArtists) {
    const rawA = a.toLowerCase().trim();
    const canA = getCanonicalArtistName(a).toLowerCase();
    if (targetAliases.has(rawA) || targetAliases.has(canA)) {
      return true;
    }
  }

  return false;
}

/**
 * Component to render clickable artist links for multi-artist tracks (Pure JS via createElement).
 */
export function ArtistLinks({
  track,
  artist,
  title,
  onSelectArtist,
  className = '',
  linkClassName = '',
  separatorClassName = '',
  onClickExtra
}) {
  const artistList = track ? getTrackArtists(track) : getTrackArtists(artist, title);
  if (!artistList || artistList.length === 0) return null;

  const children = [];
  artistList.forEach((artName, index) => {
    const isLast = index === artistList.length - 1;
    const isPenultimate = index === artistList.length - 2;
    const separator = isLast ? '' : isPenultimate ? ' & ' : ', ';

    const linkProps = {
      key: `${artName}-${index}`,
      className: onSelectArtist ? (linkClassName || 'hover:underline cursor-pointer') : '',
      title: onSelectArtist ? `View ${artName}` : undefined,
    };
    if (onSelectArtist) {
      linkProps.onClick = (e) => {
        e.stopPropagation();
        if (onClickExtra) onClickExtra();
        onSelectArtist(artName);
      };
    }

    const spanEl = React.createElement('span', linkProps, artName);
    if (separator) {
      const sepEl = React.createElement('span', { key: `sep-${index}`, className: separatorClassName }, separator);
      children.push(React.createElement(React.Fragment, { key: `grp-${index}` }, spanEl, sepEl));
    } else {
      children.push(spanEl);
    }
  });

  return React.createElement('span', { className }, children);
}

export default ArtistLinks;
