import React, { useMemo } from 'react';
import { Disc } from 'lucide-react';
import { useUser } from '../../context/UserContext';

export default React.memo(function PlaylistCoverCollage({
  playlist,
  tracks: propTracks,
  className = 'w-full h-full',
  discSize = 24,
}) {
  const userCtx = typeof useUser === 'function' ? useUser() : null;
  const allTracks = propTracks || userCtx?.tracks || [];

  const { customCover, distinctCovers } = useMemo(() => {
    if (!playlist) return { customCover: null, distinctCovers: [] };
    if (playlist.cover && typeof playlist.cover === 'string' && playlist.cover.trim()) {
      return { customCover: playlist.cover.trim(), distinctCovers: [] };
    }

    const trackPoolMap = new Map();
    if (Array.isArray(allTracks)) {
      for (const t of allTracks) {
        if (t) {
          if (t.id) trackPoolMap.set(String(t.id), t);
          if (t._id) trackPoolMap.set(String(t._id), t);
        }
      }
    }

    const items = playlist.tracks || playlist.trackIds || [];
    const covers = [];
    const seen = new Set();

    for (const item of items) {
      let c = null;
      if (item && typeof item === 'object') {
        c = item.cover || item.coverUrl;
      } else if (item) {
        const found = trackPoolMap.get(String(item));
        c = found?.cover || found?.coverUrl;
      }
      if (c && typeof c === 'string' && c.trim() && !seen.has(c.trim())) {
        seen.add(c.trim());
        covers.push(c.trim());
        if (covers.length === 4) break;
      }
    }

    return { customCover: null, distinctCovers: covers };
  }, [playlist, allTracks]);

  if (customCover) {
    return (
      <img
        src={customCover}
        alt={playlist?.name || 'Playlist cover'}
        className={`${className} object-cover`}
        loading="lazy"
      />
    );
  }

  // 4 distinct track covers: 2x2 grid
  if (distinctCovers.length >= 4) {
    return (
      <div className={`grid grid-cols-2 grid-rows-2 w-full h-full overflow-hidden ${className}`}>
        {distinctCovers.slice(0, 4).map((c, i) => (
          <img
            key={i}
            src={c}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ))}
      </div>
    );
  }

  // 1 distinct track cover
  if (distinctCovers.length === 1) {
    return (
      <img
        src={distinctCovers[0]}
        alt={playlist?.name || 'Playlist cover'}
        className={`${className} object-cover`}
        loading="lazy"
      />
    );
  }

  // 2 or 3 distinct track covers: repeat to fill 2x2 grid
  if (distinctCovers.length > 1) {
    const gridCovers = [
      distinctCovers[0],
      distinctCovers[1],
      distinctCovers[2] || distinctCovers[0],
      distinctCovers[3] || distinctCovers[1] || distinctCovers[0]
    ];
    return (
      <div className={`grid grid-cols-2 grid-rows-2 w-full h-full overflow-hidden ${className}`}>
        {gridCovers.map((c, i) => (
          <img
            key={i}
            src={c}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ))}
      </div>
    );
  }

  // 0 covers: fallback placeholder
  return (
    <div className={`w-full h-full flex items-center justify-center bg-[#141d1b] ${className}`}>
      <Disc size={discSize} className="text-[#17a398]" />
    </div>
  );
});
