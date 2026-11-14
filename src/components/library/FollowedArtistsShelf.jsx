import React, { useState, useEffect, useMemo } from 'react';
import { User, Users } from 'lucide-react';
import { useUser } from '../../context/UserContext';
import { getCanonicalArtistAvatar } from '../../utils/canonicalArtistAvatars';
import { API_BASE_URL } from '../../config';

let cachedDbArtistAvatars = null;

export default React.memo(function FollowedArtistsShelf({
  followedArtists: propArtists = [],
  tracks = [],
  albums = [],
  onSelectArtist,
  isDark = true,
  isRTL = false,
}) {
  const userCtx = typeof useUser === 'function' ? useUser() : null;
  const rawList = propArtists.length > 0 ? propArtists : (userCtx?.followedArtists || []);

  const [dbAvatars, setDbAvatars] = useState(cachedDbArtistAvatars || {});

  useEffect(() => {
    if (cachedDbArtistAvatars) return;
    let isMounted = true;
    const controller = new AbortController();

    fetch(`${API_BASE_URL}/api/artists/counts`, { signal: controller.signal })
      .then(r => r.json())
      .then(d => {
        if (isMounted && d?.success && d?.counts) {
          const map = {};
          for (const [key, val] of Object.entries(d.counts)) {
            if (val?.cover || val?.avatar) {
              map[key.toLowerCase().trim()] = val.cover || val.avatar;
            }
          }
          cachedDbArtistAvatars = map;
          setDbAvatars(map);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  // Hydrate each artist with avatar
  const hydratedArtists = useMemo(() => {
    if (!Array.isArray(rawList) || rawList.length === 0) return [];

    const trackArtistMap = new Map();
    for (const t of tracks) {
      if (t?.artist && (t.cover || t.coverUrl)) {
        const norm = t.artist.toLowerCase().trim();
        if (!trackArtistMap.has(norm)) {
          trackArtistMap.set(norm, t.cover || t.coverUrl);
        }
      }
    }

    return rawList.map(name => {
      if (!name) return null;
      const cleanName = typeof name === 'object' ? (name.name || '') : String(name).trim();
      if (!cleanName) return null;

      const lower = cleanName.toLowerCase().trim();
      const directObjAvatar = typeof name === 'object' ? (name.avatar || name.cover || name.image) : null;
      const canonical = getCanonicalArtistAvatar(cleanName);
      const fromDb = dbAvatars[lower] || dbAvatars[lower.replace(/\s+/g, '-')];
      const fromTrack = trackArtistMap.get(lower);

      const avatar = directObjAvatar || canonical || fromDb || fromTrack || null;

      return {
        id: lower,
        name: cleanName,
        avatar,
      };
    }).filter(Boolean);
  }, [rawList, tracks, dbAvatars]);

  if (hydratedArtists.length === 0) return null;

  return (
    <div className="mb-7">
      <div className="flex items-center justify-between mb-3">
        <h2 className={`text-sm font-black font-display uppercase tracking-wider transition-colors ${
          isDark ? 'text-emerald-300' : 'text-[#082621]'
        } ${isRTL ? 'font-sans' : ''}`}>
          {isRTL ? 'الفنانين المتابعون' : 'Followed Artists'}
        </h2>
        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
          isDark ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 'bg-black/5 text-[#082621]'
        }`}>
          {hydratedArtists.length} {isRTL ? 'فنان' : (hydratedArtists.length === 1 ? 'artist' : 'artists')}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
        {hydratedArtists.map(artist => (
          <div
            key={artist.id}
            onClick={() => onSelectArtist && onSelectArtist(artist.name)}
            className={`group p-3 rounded-xl border transition-all cursor-pointer flex flex-col items-center text-center ${
              isDark 
                ? 'border-emerald-950/70 bg-[#091714] hover:bg-[#0d221d] hover:border-emerald-500/40' 
                : 'border-[#0b1110] bg-[#ede5d3] hover:bg-[#ded2bb] hover:border-[#082621]'
            }`}
          >
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden mb-2.5 brutal-border bg-[#17a398] flex items-center justify-center shrink-0">
              {artist.avatar ? (
                <img
                  src={artist.avatar}
                  alt={artist.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                  onError={(e) => {
                    // Fallback on image load error
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextSibling) {
                      e.currentTarget.nextSibling.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div
                className={`w-full h-full items-center justify-center font-black text-lg text-[#082621] ${
                  artist.avatar ? 'hidden' : 'flex'
                }`}
              >
                {artist.name.charAt(0).toUpperCase()}
              </div>
            </div>

            <h3 className={`font-bold text-xs truncate max-w-full transition-colors ${
              isDark ? 'text-white group-hover:text-emerald-300' : 'text-[#082621] group-hover:text-black'
            }`}>
              {artist.name}
            </h3>
            <span className="text-[10px] font-mono font-bold text-[#17a398] mt-0.5">
              {isRTL ? 'فنان متابع' : 'ARTIST'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
