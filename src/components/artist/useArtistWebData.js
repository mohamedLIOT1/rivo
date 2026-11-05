import { useState, useEffect, useMemo } from 'react';
import { API_BASE_URL } from '../../config';
import { matchesArtist, getCanonicalArtistName, getArtistAliasNote } from '../../utils/artistUtils';
import { isQuranContent } from '../../utils/quranUtils';

export function useArtistWebData({ initialArtist, tracks = [], albums = [] }) {
  const [remoteData, setRemoteData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const rawArtistName = useMemo(() => {
    if (!initialArtist) return '';
    if (typeof initialArtist === 'string') return initialArtist.trim();
    return (initialArtist.name || initialArtist.artist || '').trim();
  }, [initialArtist]);

  const canonicalName = useMemo(() => getCanonicalArtistName(rawArtistName), [rawArtistName]);
  const artistName = canonicalName || rawArtistName;
  const artistKey = artistName.toLowerCase();
  const aliasNote = useMemo(() => getArtistAliasNote(artistName), [artistName]);

  // Fetch full artist data from backend API
  useEffect(() => {
    if (!artistName) {
      setRemoteData(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/artists/${encodeURIComponent(artistName)}`, {
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data?.success && data?.artist) {
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
  }, [artistName]);

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
            trackIds: allTrackIds,
            trackCount: allTrackIds.length,
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
  const avatar = remoteData?.avatar || remoteData?.cover || initialArtist?.headerImage || initialArtist?.avatar || artistTracks[0]?.cover || '';
  const banner = remoteData?.banner || initialArtist?.banner || '';
  const isVerified = Boolean(remoteData?.isVerified || initialArtist?.isVerified);

  return {
    artistName,
    rawArtistName,
    artistKey,
    aliasNote,
    artistTracks,
    artistAlbums,
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
