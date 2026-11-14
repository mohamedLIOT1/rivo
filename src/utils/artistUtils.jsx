import React from 'react';
import { getTrackArtists } from './artistUtils.js';

export * from './artistUtils.js';

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
