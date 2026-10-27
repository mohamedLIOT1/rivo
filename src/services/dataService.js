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
  async fetchAlbums() {
    const res = await fetch(`${API_BASE_URL}/api/albums`);
    const data = await res.json();
    if (data.success && Array.isArray(data.albums)) {
      return data.albums;
    }
    return [];
  },

  async deleteAlbum(albumId, deleteTracks = true) {
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
