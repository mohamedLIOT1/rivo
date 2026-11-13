import { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../config';
import { getTrackArtists, getCanonicalArtistName, getArtistAliases } from '../utils/artistUtils';
import { isMusicTrack } from '../utils/searchEngine';

// Module-level in-memory cache to prevent re-fetching across tab navigations
let globalArtistCountsCache = null;

export function useSearchArtists({ safeTracks = [], safeAlbums = [] }) {
  const [dbCounts, setDbCounts] = useState(globalArtistCountsCache || null);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function fetchCounts() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/artists/counts`, {
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.success && data?.counts) {
            globalArtistCountsCache = data.counts;
            setDbCounts(data.counts);
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          // Gracefully fallback to local track counts
          console.warn('[useSearchArtists] Notice fetching canonical counts:', err.message);
        }
      }
    }

    fetchCounts();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const allArtists = useMemo(() => {
    const map = new Map();

    // 1. Scan safe local tracks
    safeTracks.forEach(t => {
      if (!t.artist || !isMusicTrack(t.title, t.artist)) return;
      const artistNames = getTrackArtists(t.artist, t.title);
      artistNames.forEach(rawName => {
        const canonical = getCanonicalArtistName(rawName);
        if (!canonical) return;
        const key = canonical.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            name: canonical,
            count: 1,
            cover: t.cover,
            aliases: getArtistAliases(canonical)
          });
        } else {
          const existing = map.get(key);
          existing.count += 1;
          if (!existing.cover && t.cover) existing.cover = t.cover;
        }
      });
    });

    // 2. Scan safe local albums
    safeAlbums.forEach(a => {
      if (!a.artist) return;
      const artistNames = getTrackArtists(a.artist);
      artistNames.forEach(rawName => {
        const canonical = getCanonicalArtistName(rawName);
        if (!canonical) return;
        const key = canonical.toLowerCase();
        const albCount = (a.trackIds || []).length || 1;
        if (!map.has(key)) {
          map.set(key, {
            name: canonical,
            count: albCount,
            cover: a.cover,
            aliases: getArtistAliases(canonical)
          });
        } else {
          const existing = map.get(key);
          if (!existing.cover && a.cover) existing.cover = a.cover;
        }
      });
    });

    // 3. Merge or inject canonical database counts & locked portraits
    if (dbCounts && typeof dbCounts === 'object') {
      // First update existing local artists
      for (const [key, item] of map.entries()) {
        const dbMeta = dbCounts[key] || dbCounts[key.replace(/\s+/g, '-')];
        if (dbMeta) {
          item.count = Number(dbMeta.trackCount || dbMeta.songsCount || item.count);
          if (dbMeta.cover || dbMeta.avatar) {
            item.cover = dbMeta.cover || dbMeta.avatar;
          }
          if (dbMeta.isVerified !== undefined) {
            item.isVerified = Boolean(dbMeta.isVerified);
          }
        }
      }

      // Next inject any artists from dbCounts that have tracks but were not in startup slice
      for (const [dbKey, dbMeta] of Object.entries(dbCounts)) {
        if (!dbMeta || !dbMeta.name) continue;
        const canonical = getCanonicalArtistName(dbMeta.name) || dbMeta.name;
        const key = canonical.toLowerCase().trim();
        if (!map.has(key)) {
          const cnt = Number(dbMeta.trackCount || dbMeta.songsCount || 0);
          if (cnt > 0) {
            map.set(key, {
              name: canonical,
              count: cnt,
              cover: dbMeta.cover || dbMeta.avatar || '',
              isVerified: Boolean(dbMeta.isVerified),
              aliases: getArtistAliases(canonical)
            });
          }
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [safeTracks, safeAlbums, dbCounts]);

  return { allArtists, dbCounts };
}
