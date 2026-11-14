import { useState, useEffect, useMemo, useRef } from 'react';
import { API_BASE_URL } from '../../config';
import { matchesArtist, getCanonicalArtistName, getArtistAliasNote } from '../../utils/artistUtils';
import { isQuranContent } from '../../utils/quranUtils';

// In-memory client cache for 0ms instant artist page loads
const clientArtistCache = new Map();
const CLIENT_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export function useArtistWebData({ initialArtist, tracks = [], albums = [] }) {
  const rawArtistName = useMemo(() => {
    if (!initialArtist) return '';
    if (typeof initialArtist === 'string') return initialArtist.trim();
    return (initialArtist.name || initialArtist.artist || '').trim();
  }, [initialArtist]);

  const canonicalName = useMemo(() => getCanonicalArtistName(rawArtistName), [rawArtistName]);
  const artistName = canonicalName || rawArtistName;
  const artistKey = artistName.toLowerCase();
  const aliasNote = useMemo(() => getArtistAliasNote(artistName), [artistName]);

  // Initialize immediately from client cache for 0ms instant open
  const cachedInitial = clientArtistCache.get(artistKey);
  const [remoteData, setRemoteData] = useState(cachedInitial ? cachedInitial.data : null);
  const [isLoading, setIsLoading] = useState(!cachedInitial);

  // Fetch full artist data from backend API (stale-while-revalidate)
  useEffect(() => {
    if (!artistName) {
      setRemoteData(null);
      setIsLoading(false);
      return;
    }

    const cached = clientArtistCache.get(artistKey);
    if (cached) {
      setRemoteData(cached.data);
      // If cached data is still fresh (< 5 mins), skip network request entirely
      if (Date.now() - cached.timestamp < CLIENT_CACHE_TTL / 2) {
        setIsLoading(false);
        return;
      }
    } else {
      setIsLoading(true);
    }

    let isMounted = true;
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/artists/${encodeURIComponent(artistName)}`, {
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.success && data?.artist) {
            clientArtistCache.set(artistKey, { data: data.artist, timestamp: Date.now() });
            setRemoteData(data.artist);
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn('[useArtistWebData] Notice fetching artist details:', err.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [artistName, artistKey]);

  // Local tracks filtered for this artist
  const localArtistTracks = useMemo(() => {
    return (tracks || []).filter((t) => {
      if (!t || !t.artist) return false;
      return matchesArtist(t, initialArtist) || matchesArtist(t, artistName);
    });
  }, [tracks, initialArtist, artistName]);

  // Merged deduplicated tracks (local + remote)
  const artistTracks = useMemo(() => {
    const map = new Map();
    (localArtistTracks || []).forEach(t => {
      const id = String(t.id || t._id || t.title);
      map.set(id, t);
    });
    if (remoteData?.tracks && Array.isArray(remoteData.tracks)) {
      remoteData.tracks.forEach(t => {
        const id = String(t.id || t._id || t.title);
        if (!map.has(id)) {
          map.set(id, t);
        } else {
          map.set(id, { ...map.get(id), ...t });
        }
      });
    }
    return Array.from(map.values());
  }, [localArtistTracks, remoteData]);

  // Merged deduplicated albums (local + remote)
  const artistAlbums = useMemo(() => {
    const albumMap = new Map();

    const combine = [
      ...(Array.isArray(albums) ? albums : []),
      ...(Array.isArray(remoteData?.albums) ? remoteData.albums : [])
    ];

    combine.forEach(a => {
      if (!a) return;
      if (a.artist && (matchesArtist(a, initialArtist) || matchesArtist(a, artistName) || a.artist.trim().toLowerCase() === artistKey)) {
        const matchingTracks = artistTracks.filter(t => 
          (a.trackIds || []).map(String).includes(String(t.id || t._id)) ||
          (t.album && t.album.toLowerCase().trim() === a.name.toLowerCase().trim())
        );
        const allTrackIds = Array.from(new Set([
          ...(a.trackIds || []).map(String),
          ...matchingTracks.map(t => String(t.id || t._id))
        ]));

        const key = a.name.toLowerCase().trim();
        if (!albumMap.has(key)) {
          albumMap.set(key, {
            ...a,
            id: a.id || a._id,
            name: a.name,
            artist: a.artist || artistName,
            releaseType: a.releaseType,
            trackIds: allTrackIds,
            trackCount: Number(a.trackCount || a.songsCount || allTrackIds.length),
            cover: a.cover || matchingTracks[0]?.cover || '',
            isAlbum: true,
            isPublic: true
          });
        }
      }
    });

    return Array.from(albumMap.values());
  }, [albums, remoteData, artistTracks, artistKey, artistName, initialArtist]);

  const isQuran = useMemo(() => {
    return Boolean(
      initialArtist?.isQuran ||
      remoteData?.isQuran ||
      isQuranContent(initialArtist) ||
      (artistTracks.length > 0 && artistTracks.every(t => isQuranContent(t)))
    );
  }, [initialArtist, remoteData, artistTracks]);

  const totalPlays = useMemo(() => {
    if (remoteData?.totalPlays) return remoteData.totalPlays;
    return artistTracks.reduce((acc, t) => acc + (Number(t.plays) || 0), 0);
  }, [artistTracks, remoteData]);

  const bio = remoteData?.bio || initialArtist?.bio || '';
  
  // Persistent avatar lock per artist to prevent drifting or flipping across track reorders
  const lockedAvatarRef = useRef({});
  const avatar = useMemo(() => {
    // 1. Highest priority: Fixed canonical remote data
    const canonicalRemote = remoteData?.cover || remoteData?.avatar;
    if (canonicalRemote) {
      lockedAvatarRef.current[artistKey] = canonicalRemote;
      return canonicalRemote;
    }

    // 2. Previously locked avatar for this artist in the current session
    if (lockedAvatarRef.current[artistKey]) {
      return lockedAvatarRef.current[artistKey];
    }

    // 3. Initial artist data (if carrying a dedicated portrait, not temporary)
    const initialImg = initialArtist?.cover || initialArtist?.avatar || initialArtist?.headerImage;
    if (initialImg) {
      lockedAvatarRef.current[artistKey] = initialImg;
      return initialImg;
    }

    return '';
  }, [remoteData, initialArtist, artistKey]);

  const banner = remoteData?.banner || initialArtist?.banner || '';
  const isVerified = Boolean(remoteData?.isVerified || initialArtist?.isVerified);

  // Helper release classifier
  const getAlbumType = (album) => {
    if (album?.releaseType) return album.releaseType.toLowerCase();
    const name = String(album?.name || album?.title || '').toLowerCase().trim();
    const count = Number(album?.trackCount || (Array.isArray(album?.trackIds) ? album.trackIds.length : 0));
    if (name.endsWith('- single') || name.endsWith('(single)') || count === 1) return 'single';
    if (name.endsWith('- ep') || name.endsWith('(ep)') || (count >= 2 && count <= 6)) return 'ep';
    return 'album';
  };

  // 1. Top Tracks (Most listened on server)
  const topTracks = useMemo(() => {
    if (remoteData?.topTracks && Array.isArray(remoteData.topTracks) && remoteData.topTracks.length > 0) {
      return remoteData.topTracks;
    }
    return [...artistTracks].sort((a, b) => (Number(b.plays) || 0) - (Number(a.plays) || 0));
  }, [remoteData, artistTracks]);

  // 2. Full Albums (> 6 tracks)
  const fullAlbums = useMemo(() => {
    if (remoteData?.fullAlbums && Array.isArray(remoteData.fullAlbums) && remoteData.fullAlbums.length > 0) {
      return remoteData.fullAlbums;
    }
    return artistAlbums.filter(a => getAlbumType(a) === 'album');
  }, [remoteData, artistAlbums]);

  // 3. EPs (2 - 6 tracks)
  const eps = useMemo(() => {
    if (remoteData?.eps && Array.isArray(remoteData.eps) && remoteData.eps.length > 0) {
      return remoteData.eps;
    }
    return artistAlbums.filter(a => getAlbumType(a) === 'ep');
  }, [remoteData, artistAlbums]);

  // 4. Singles (1 track)
  const singles = useMemo(() => {
    if (remoteData?.singles && Array.isArray(remoteData.singles) && remoteData.singles.length > 0) {
      return remoteData.singles;
    }
    return artistAlbums.filter(a => getAlbumType(a) === 'single');
  }, [remoteData, artistAlbums]);

  // 5. Collaborations / Features ("Appears On")
  const collaborations = useMemo(() => {
    if (remoteData?.collaborations && Array.isArray(remoteData.collaborations) && remoteData.collaborations.length > 0) {
      return remoteData.collaborations;
    }
    return artistTracks.filter(t => {
      const artList = Array.isArray(t.artists) && t.artists.length > 0 ? t.artists : (t.artist ? t.artist.split(/[,&]/) : []);
      const featList = Array.isArray(t.featuredArtists) ? t.featuredArtists : [];
      const hasFeat = featList.some(f => f.toLowerCase().trim() === artistKey);
      const isMulti = artList.length > 1 && artList.some(a => a.toLowerCase().trim() === artistKey);
      return hasFeat || isMulti;
    });
  }, [remoteData, artistTracks, artistKey]);

  return {
    artistName,
    rawArtistName,
    artistKey,
    aliasNote,
    artistTracks,
    artistAlbums,
    topTracks,
    fullAlbums,
    eps,
    singles,
    collaborations,
    isQuran,
    totalPlays,
    bio,
    avatar,
    banner,
    isVerified,
    isLoading,
    remoteData
  };
}
