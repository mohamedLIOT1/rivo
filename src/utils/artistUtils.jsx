import React from 'react';

/**
 * Regex matching multiple artist separators:
 * - Comma, Arabic comma, ampersands, plus, forward slashes
 * - Words like: and, ft, feat, featuring, with, x
 * - Oxford commas: ", &", ", and", etc.
 */
export const ARTIST_DELIMITER_REGEX = /(?:\s*(?:,|،)\s*(?:&|and|\+|،)?|\s*&\s*|\s*\+\s*|\s*\/\s*|\s+(?:and|ft\.?|feat\.?|featuring|with|x|X)\s+)+/i;

/**
 * Splits an artist string into an array of distinct artist names.
 * Example: "Marwan Pablo, Lege-Cy, & HatemBas" -> ["Marwan Pablo", "Lege-Cy", "HatemBas"]
 */
export function splitArtists(artistStr) {
  if (!artistStr || typeof artistStr !== 'string') return [];
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
 * Detects featured artists embedded in the title (e.g. "(feat. Lege-Cy & HatemBas)").
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

  // 1. Process artists from the artist field
  if (artistStr) {
    const parts = artistStr.split(ARTIST_DELIMITER_REGEX).map(s => s.trim()).filter(Boolean);
    parts.forEach(add);
  }

  // 2. Extract featured artists from title if present (e.g. "Song Name (feat. Artist 2)")
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
 * Example: ["Marwan Pablo", "Lege-Cy", "HatemBas"] -> "Marwan Pablo, Lege-Cy & HatemBas"
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
 * Normalizes an artist name by stripping uploader suffixes and punctuation.
 * E.g. "CairokeeOffical" -> "Cairokee", "Marwan Pablo - Topic" -> "Marwan Pablo"
 */
export function normalizeArtistName(raw) {
  if (!raw || typeof raw !== 'string') return '';
  let clean = raw.trim();

  // Strip trailing " - Topic"
  clean = clean.replace(/\s*-\s*topic\b/gi, '');

  // Strip common YouTube/uploader channel suffixes
  clean = clean.replace(/\b(official(?:\s*(?:channel|music|video|audio|records|tv|page))?|offical|vevo|topic|channel)\b/gi, '');

  // Strip surrounding quotes or brackets
  clean = clean.replace(/^["'\[\(]+|["'\]\)]+$/g, '');

  // Normalize multiple spaces
  clean = clean.replace(/\s+/g, ' ').trim();

  return clean;
}

/**
 * Built-in dictionary of canonical artists and their known aliases/members/typos.
 */
export const CANONICAL_ARTIST_MAP = [
  {
    canonical: 'Cairokee',
    aliases: [
      'cairokee', 'cairokeeoffical', 'cairokeeofficial', 'cairokee official',
      'amir eid', 'amireid', 'أمير عيد', 'كايروكي'
    ],
    displayAliasInfo: 'Includes Cairokee, CairokeeOfficial & Amir Eid solo works'
  },
  {
    canonical: 'Mohamed Hamaki',
    aliases: ['hamaki', 'mohamed hamaki', 'محمد حماقي', 'حماقي']
  },
  {
    canonical: 'Amr Diab',
    aliases: ['amr diab', 'عمرو دياب', 'elhadaba', 'el hadaba']
  },
  {
    canonical: 'Tamer Hosny',
    aliases: ['tamer hosny', 'tamer hosni', 'تامر حسني']
  },
  {
    canonical: 'Marwan Pablo',
    aliases: ['marwan pablo', 'pablo', 'مروان بابلو', 'بابلو']
  },
  {
    canonical: 'Wegz',
    aliases: ['wegz', 'ويجز']
  },
  {
    canonical: 'Lege-Cy',
    aliases: ['lege-cy', 'lege cy', 'legecy', 'ليجي سي', 'ليجي-سي']
  },
  {
    canonical: 'Abyusif',
    aliases: ['abyusif', 'أبيوسف', 'ابيوسف']
  },
  {
    canonical: 'Marwan Moussa',
    aliases: ['marwan moussa', 'marwan mousa', 'مروان موسى']
  },
  {
    canonical: 'Afroto',
    aliases: ['afroto', 'عفروتو']
  },
  {
    canonical: 'Sharmoofers',
    aliases: ['sharmoofers', 'شارموفرز']
  },
  {
    canonical: 'Massar Egbari',
    aliases: ['massar egbari', 'مسار إجباري', 'مسار اجباري']
  },
  {
    canonical: 'Ahmed Saad',
    aliases: ['ahmed saad', 'أحمد سعد', 'احمد سعد']
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

  // If no predefined group matched, return the cleaned name
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
 * Returns display info about aliases (e.g. "Includes Cairokee, Amir Eid solo works")
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
 * Checks whether a track belongs to an artist name or key (case-insensitive, supporting aliases & features).
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

  // 1. Direct match on track.artist
  if (track.artist) {
    const rawTrackArtist = track.artist.trim().toLowerCase();
    const canonicalTrackArtist = getCanonicalArtistName(track.artist).toLowerCase();
    if (targetAliases.has(rawTrackArtist) || targetAliases.has(canonicalTrackArtist)) {
      return true;
    }
  }

  // 2. Multi-artist extraction from track (features, delimiters)
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
 * React Component to render clickable artist links for multi-artist tracks.
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

  return (
    <span className={className}>
      {artistList.map((artName, index) => {
        const isLast = index === artistList.length - 1;
        const isPenultimate = index === artistList.length - 2;
        const separator = isLast ? '' : isPenultimate ? ' & ' : ', ';

        return (
          <React.Fragment key={`${artName}-${index}`}>
            <span
              onClick={(e) => {
                if (onSelectArtist) {
                  e.stopPropagation();
                  if (onClickExtra) onClickExtra();
                  onSelectArtist(artName);
                }
              }}
              className={onSelectArtist ? (linkClassName || 'hover:underline cursor-pointer') : ''}
              title={onSelectArtist ? `View ${artName}` : undefined}
            >
              {artName}
            </span>
            {separator && <span className={separatorClassName}>{separator}</span>}
          </React.Fragment>
        );
      })}
    </span>
  );
}

export default ArtistLinks;
