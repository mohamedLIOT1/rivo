import { API_BASE_URL } from '../config';

const isFullTrackObject = (t) => Boolean(t && typeof t === 'object' && (t.title || t.audioUrl));

/**
 * Resolves full track objects for an album locally first, then fetches from API if needed.
 * @param {Object} album
 * @param {Array} localPool
 * @param {AbortSignal} [signal]
 * @returns {Promise<Array>}
 */
export async function resolveAlbumTracks(album, localPool = [], signal = undefined) {
  if (!album) return [];

  if (Array.isArray(album.tracks) && album.tracks.length > 0 && album.tracks.every(isFullTrackObject)) {
    return album.tracks;
  }

  const rawIds = [
    ...(Array.isArray(album.trackIds) ? album.trackIds : []),
    ...(Array.isArray(album.tracks) ? album.tracks : []),
  ]
    .map((item) => (typeof item === 'object' && item !== null ? String(item._id || item.id || '') : String(item || '')))
    .filter(Boolean);

  if (rawIds.length > 0 && Array.isArray(localPool) && localPool.length > 0) {
    const idMatches = rawIds
      .map((id) => localPool.find((t) => isFullTrackObject(t) && String(t._id || t.id) === id))
      .filter(Boolean);
    if (idMatches.length > 0) return idMatches;
  }

  const albName = String(album.name || album.title || '').trim().toLowerCase();
  const cleanAlbName = albName.replace(/^album-/, '').replace(/[-_\s]+/g, ' ').trim();
  if (albName && Array.isArray(localPool) && localPool.length > 0) {
    const nameMatches = localPool.filter((t) => {
      if (!isFullTrackObject(t)) return false;
      const tAlb = String(t.album || '').trim().toLowerCase();
      const cleanTAlb = tAlb.replace(/[-_\s]+/g, ' ').trim();
      return tAlb === albName || cleanTAlb === cleanAlbName;
    });
    if (nameMatches.length > 0) return nameMatches;
  }

  if (signal?.aborted) return [];

  const albId = String(album._id || album.id || '');
  const cleanId = albId.replace(/^album-/, '');
  const queryName = album.name || album.title || cleanId || albId || '';
  const albumUrl = (albId && albId.length === 24)
    ? `${API_BASE_URL}/api/albums/${encodeURIComponent(albId)}`
    : cleanId && cleanId.length === 24
      ? `${API_BASE_URL}/api/albums/${encodeURIComponent(cleanId)}`
      : `${API_BASE_URL}/api/albums/${encodeURIComponent(cleanId || queryName)}`;

  try {
    let res = await fetch(albumUrl, { signal });
    if (signal?.aborted) return [];
    if (!res.ok && queryName) {
      res = await fetch(`${API_BASE_URL}/api/tracks?album=${encodeURIComponent(queryName)}`, { signal });
    }
    if (signal?.aborted || !res.ok) return [];
    const data = await res.json();
    const list = data?.album?.tracks || data?.tracks || (Array.isArray(data) ? data : []);
    return Array.isArray(list) ? list.filter(isFullTrackObject) : [];
  } catch {
    return [];
  }
}
