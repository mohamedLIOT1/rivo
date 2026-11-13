import { API_BASE_URL } from '../config';

const getStoredToken = () => {
  try {
    return localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
  } catch {
    return '';
  }
};

const getHeaders = () => {
  const token = getStoredToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

let memoryAlbumsCache = null;
let memoryAlbumsCacheTime = 0;
const CLIENT_ALBUMS_TTL = 10 * 60 * 1000; // 10 minutes

export const dataService = {
  // ── Tracks ──────────────────────────────────────────────────────────
  async addTrack(song) {
    const res = await fetch(`${API_BASE_URL}/api/tracks/add`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(song),
    });
    return await res.json();
  },

  async updateTrack(trackId, trackData) {
    const res = await fetch(`${API_BASE_URL}/api/tracks/${encodeURIComponent(trackId)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({
        title: trackData.title,
        artist: trackData.artist,
        album: trackData.album,
        genre: trackData.genre,
        cover: trackData.cover,
        audioUrl: trackData.audioUrl,
        lyrics: trackData.lyrics,
      }),
    });
    return await res.json();
  },

  async deleteTrack(trackId) {
    const res = await fetch(`${API_BASE_URL}/api/tracks/${encodeURIComponent(trackId)}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return await res.json();
  },

  // ── Albums ──────────────────────────────────────────────────────────
  async fetchAlbums({ bypassCache = false } = {}) {
    if (!bypassCache && memoryAlbumsCache && (Date.now() - memoryAlbumsCacheTime < CLIENT_ALBUMS_TTL)) {
      return memoryAlbumsCache;
    }

    try {
      if (!bypassCache && !memoryAlbumsCache) {
        const stored = sessionStorage.getItem('rivo_cached_albums');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            memoryAlbumsCache = parsed;
            memoryAlbumsCacheTime = Date.now();
            // Stale-while-revalidate: return cached immediately, fetch fresh in background
            fetch(`${API_BASE_URL}/api/albums`)
              .then(r => r.json())
              .then(d => {
                if (d.success && Array.isArray(d.albums)) {
                  memoryAlbumsCache = d.albums;
                  memoryAlbumsCacheTime = Date.now();
                  sessionStorage.setItem('rivo_cached_albums', JSON.stringify(d.albums));
                }
              })
              .catch(() => {});
            return parsed;
          }
        }
      }

      const res = await fetch(`${API_BASE_URL}/api/albums`);
      const data = await res.json();
      if (data.success && Array.isArray(data.albums)) {
        memoryAlbumsCache = data.albums;
        memoryAlbumsCacheTime = Date.now();
        try {
          sessionStorage.setItem('rivo_cached_albums', JSON.stringify(data.albums));
        } catch {}
        return data.albums;
      }
    } catch (err) {
      if (memoryAlbumsCache) return memoryAlbumsCache;
    }
    return [];
  },

  async deleteAlbum(albumId, deleteTracks = true) {
    memoryAlbumsCache = null;
    try { sessionStorage.removeItem('rivo_cached_albums'); } catch {}
    const res = await fetch(`${API_BASE_URL}/api/albums/${encodeURIComponent(albumId)}`, {
      method: 'DELETE',
      headers: getHeaders(),
      body: JSON.stringify({ deleteTracks: Boolean(deleteTracks) }),
    });
    return await res.json();
  },

  // ── Playlists ───────────────────────────────────────────────────────
  async createPlaylist(name, description, cover = '', isPublic = true, isQuran = false, isMix = false, trackIds = []) {
    const res = await fetch(`${API_BASE_URL}/api/playlists/create`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, description, cover, isPublic, isQuran, isMix, trackIds }),
    });
    return await res.json();
  },

  async updatePlaylist(playlistId, data) {
    const res = await fetch(`${API_BASE_URL}/api/playlists/${encodeURIComponent(playlistId)}`, {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    return await res.json();
  },

  async deletePlaylist(playlistId) {
    const res = await fetch(`${API_BASE_URL}/api/playlists/${encodeURIComponent(playlistId)}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return await res.json();
  },

  async addTrackToPlaylist(playlistId, trackId, allowDuplicate = false) {
    const res = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/add-track`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ trackId, allowDuplicate }),
    });
    return await res.json();
  },

  async togglePlaylistVisibility(playlistId, isPublic) {
    const res = await fetch(`${API_BASE_URL}/api/playlists/${encodeURIComponent(playlistId)}/visibility`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ isPublic }),
    });
    return await res.json();
  },
};
