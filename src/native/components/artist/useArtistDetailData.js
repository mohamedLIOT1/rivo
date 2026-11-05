import { useState, useMemo, useEffect } from 'react';
import { API_BASE_URL } from '../../config';
import { INITIAL_TRACKS } from '../../data/initialTracks';
import { matchesArtist } from '../../../utils/artistUtils.jsx';

export function useArtistDetailData({
  artist,
  artistName,
  rawArtistName,
  artistKey,
  visible,
  allTracks = [],
  allAlbums = [],
}) {
  const [remoteTracks, setRemoteTracks] = useState([]);
  const [remoteAlbums, setRemoteAlbums] = useState([]);

  useEffect(() => {
    if (!visible || !artistName) {
      setRemoteTracks([]);
      setRemoteAlbums([]);
      return;
    }
    let isMounted = true;
    (async () => {
      try {
        const cleanName = encodeURIComponent(artistName);
        const [trRes, albRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/tracks?artist=${cleanName}`),
          fetch(`${API_BASE_URL}/api/albums?artist=${cleanName}`)
        ]);
        if (trRes.ok) {
          const trData = await trRes.json();
          const list = Array.isArray(trData) ? trData : (trData.tracks || []);
          if (isMounted && list.length > 0) setRemoteTracks(list);
        }
        if (albRes.ok) {
          const albData = await albRes.json();
          const list = Array.isArray(albData) ? albData : (albData.albums || []);
          if (isMounted && list.length > 0) setRemoteAlbums(list);
        }
      } catch (err) {
        console.warn('ArtistDetailModal fetch error:', err);
      }
    })();
    return () => { isMounted = false; };
  }, [visible, artistName]);

  // Filter local artist tracks (supporting aliases, multiple artists per track)
  const effectiveAllTracks = (allTracks && allTracks.length > 0) ? allTracks : INITIAL_TRACKS;
  const artistTracks = useMemo(() => {
    if (!artistName) return [];
    return (effectiveAllTracks || []).filter((t) => {
      if (!t || !t.artist) return false;
      return matchesArtist(t, artist) || matchesArtist(t, artistName) || matchesArtist(t, rawArtistName) || t.artist.toLowerCase().includes(artistKey);
    });
  }, [effectiveAllTracks, artist, artistName, rawArtistName, artistKey]);

  // Merge local tracks + remote database tracks deduplicated
  const finalTracks = useMemo(() => {
    const map = new Map();
    artistTracks.forEach(t => {
      const id = String(t.id || t._id || t.title);
      map.set(id, t);
    });
    remoteTracks.forEach(t => {
      const id = String(t.id || t._id || t.title);
      if (!map.has(id)) {
        map.set(id, t);
      } else {
        map.set(id, { ...map.get(id), ...t });
      }
    });
    return Array.from(map.values());
  }, [artistTracks, remoteTracks]);

  // Discography Albums for this artist strictly like Web ArtistScreen.jsx
  const combinedAlbums = useMemo(() => {
    const map = new Map();
    (remoteAlbums || []).forEach(a => {
      if (!a) return;
      const key = (a.name || a.title || '').toLowerCase().trim();
      if (key) map.set(key, a);
    });
    (allAlbums || []).forEach(a => {
      if (!a) return;
      const key = (a.name || a.title || '').toLowerCase().trim();
      if (key && !map.has(key)) map.set(key, a);
    });
    return Array.from(map.values());
  }, [remoteAlbums, allAlbums]);

  const finalAlbums = useMemo(() => {
    if (!artistName) return [];
    const albumMap = new Map();

    combinedAlbums.forEach(a => {
      if (!a || !a.artist) return;
      if (
        matchesArtist(a, artist) ||
        matchesArtist(a, artistName) ||
        matchesArtist(a, rawArtistName) ||
        a.artist.trim().toLowerCase() === artistKey ||
        a.artist.toLowerCase().includes(artistKey)
      ) {
        // Collect all tracks belonging to this album from finalTracks
        const matchingTracks = finalTracks.filter(t => {
          if (!t) return false;
          const tId = String(t.id || t._id || '');
          const inIds = Array.isArray(a.trackIds) && a.trackIds.map(String).includes(tId);
          const tAlb = (t.album || '').trim().toLowerCase();
          const aName = (a.name || a.title || '').trim().toLowerCase();
          return inIds || (tAlb && aName && tAlb === aName);
        });

        const allTrackIds = Array.from(new Set([
          ...(Array.isArray(a.trackIds) ? a.trackIds.map(String) : []),
          ...matchingTracks.map(t => String(t.id || t._id))
        ]));

        const resolvedCover = a.cover || a.coverUrl || matchingTracks[0]?.cover || matchingTracks[0]?.coverUrl;
        const key = (a.name || a.title || '').toLowerCase().trim();

        if (key && !albumMap.has(key)) {
          albumMap.set(key, {
            ...a,
            id: a.id || a._id,
            name: a.name || a.title,
            artist: a.artist || artistName,
            tracks: matchingTracks,
            trackIds: allTrackIds,
            trackCount: Math.max(allTrackIds.length, matchingTracks.length, a.trackCount || 0, a.songsCount || 0),
            cover: resolvedCover,
            isAlbum: true,
            isPublic: true,
          });
        }
      }
    });

    return Array.from(albumMap.values());
  }, [combinedAlbums, finalTracks, artistKey, artistName, rawArtistName, artist]);

  const artistCover = (typeof artist === 'object' && (artist.avatar || artist.cover || artist.coverUrl))
    ? (artist.avatar || artist.cover || artist.coverUrl)
    : (finalTracks[0]?.coverUrl || finalTracks[0]?.cover || '');

  return {
    remoteTracks,
    remoteAlbums,
    artistTracks,
    finalTracks,
    finalAlbums,
    artistCover,
  };
}
