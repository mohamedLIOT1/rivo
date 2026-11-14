/**
 * Native Search Artists Hook
 * Fetches canonical artist database catalog & counts with module-level caching
 * Resolves bilingual names, avatars, track counts, and aliases for instant 0-lag search.
 * Strictly modularized (< 400 lines) per AGENTS.md.
 */

import { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../config';
import { splitArtists, getCanonicalArtistName } from '../../utils/artistUtils.js';
import { getCanonicalArtist, getAllArtistAliases } from '../../utils/artistAliases.js';
import { isQuranContent } from '../../utils/quranUtils';

// Module-level in-memory cache to prevent re-fetching across tab navigations
let globalNativeArtistCountsCache = null;

export function useNativeSearchArtists({ allTracks = [], allAlbums = [] }) {
  const [dbCounts, setDbCounts] = useState(globalNativeArtistCountsCache || null);
  const [isLoadingArtists, setIsLoadingArtists] = useState(!globalNativeArtistCountsCache);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function fetchCounts() {
      if (globalNativeArtistCountsCache) {
        setIsLoadingArtists(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE_URL}/api/artists/counts`, {
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.success && data?.counts) {
            globalNativeArtistCountsCache = data.counts;
            setDbCounts(data.counts);
          }
        }
      } catch (err) {
        // Gracefully ignore abort or fallback to local tracks
      } finally {
        if (isMounted) setIsLoadingArtists(false);
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

    const addOrUpdateArtist = (rawName, cover, track = null, albumTracksCount = 0) => {
      if (!rawName || typeof rawName !== 'string') return;
      const canonical = getCanonicalArtist(rawName) || getCanonicalArtistName(rawName) || rawName.trim();
      if (!canonical) return;
      const key = canonical.toLowerCase().trim();

      if (!map.has(key)) {
        map.set(key, {
          id: `artist-${key}`,
          name: canonical,
          canonical,
          count: albumTracksCount || (track ? 1 : 0),
          cover: cover || '',
          aliases: getAllArtistAliases(canonical),
          tracks: track ? [track] : [],
        });
      } else {
        const entry = map.get(key);
        if (track) {
          entry.count += 1;
          if (entry.tracks.length < 10) {
            entry.tracks.push(track);
          }
        } else if (albumTracksCount) {
          entry.count += albumTracksCount;
        }
        if (!entry.cover && cover) {
          entry.cover = cover;
        }
      }
    };

    // 1. Scan safe local tracks
    (allTracks || []).forEach((t) => {
      if (!t.artist || isQuranContent(t)) return;
      const artistNames = splitArtists(t.artist);
      artistNames.forEach((raw) => {
        addOrUpdateArtist(raw, t.coverUrl || t.cover, t);
      });
    });

    // 2. Scan safe local albums
    (allAlbums || []).forEach((alb) => {
      if (!alb.artist || isQuranContent(alb)) return;
      const artistNames = splitArtists(alb.artist);
      const count = (alb.trackIds || []).length || (alb.tracks || []).length || 1;
      artistNames.forEach((raw) => {
        addOrUpdateArtist(raw, alb.cover || alb.coverUrl, null, count);
      });
    });

    // 3. Merge or inject canonical database counts & locked portraits
    if (dbCounts && typeof dbCounts === 'object') {
      // First update existing artists with official database stats
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

      // Next inject any artists from dbCounts that have tracks but were not in local tracks
      for (const [, dbMeta] of Object.entries(dbCounts)) {
        if (!dbMeta || !dbMeta.name) continue;
        const canonical = getCanonicalArtist(dbMeta.name) || getCanonicalArtistName(dbMeta.name) || dbMeta.name;
        const key = canonical.toLowerCase().trim();
        if (!map.has(key)) {
          const cnt = Number(dbMeta.trackCount || dbMeta.songsCount || 0);
          if (cnt > 0) {
            map.set(key, {
              id: `artist-${key}`,
              name: dbMeta.name,
              canonical,
              count: cnt,
              cover: dbMeta.cover || dbMeta.avatar || '',
              isVerified: Boolean(dbMeta.isVerified),
              aliases: getAllArtistAliases(canonical),
              tracks: [],
            });
          }
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [allTracks, allAlbums, dbCounts]);

  return { allArtists, dbCounts, isLoadingArtists };
}

export default useNativeSearchArtists;
