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
 * Checks whether a track belongs to an artist name or key (case-insensitive).
 */
export function matchesArtist(track, targetArtist) {
  if (!track || !targetArtist) return false;

  const targetName = (
    typeof targetArtist === 'string'
      ? targetArtist
      : (targetArtist.name || targetArtist.artist || '')
  ).trim().toLowerCase();

  if (!targetName) return false;

  const targetId = typeof targetArtist === 'object' ? targetArtist.id : null;
  if (targetId && track.artistId && String(track.artistId) === String(targetId)) {
    return true;
  }

  if (track.artist && track.artist.trim().toLowerCase() === targetName) {
    return true;
  }

  const artists = getTrackArtists(track).map(a => a.toLowerCase());
  return artists.includes(targetName) || artists.some(a => a === targetName);
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
