import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API = (() => {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined') {
    const { hostname, protocol, host } = window.location;
    if (
      window.Capacitor ||
      protocol === 'capacitor:' ||
      protocol === 'file:' ||
      (hostname === 'localhost' && !host.includes('5000'))
    ) {
      return 'https://liofy-production.up.railway.app';
    }
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
    return `${protocol}//${host}`;
  }
  return 'https://liofy-production.up.railway.app';
})();

export const API_BASE_URL = API;

const getToken = () => {
  try { return localStorage.getItem('liofy_token') || ''; } catch { return ''; }
};

const authHeaders = () => ({
  'Content-Type': 'application/json',
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

// ── API helpers ──────────────────────────────────────
export const api = {
  get:  (path)       => fetch(`${API}${path}`, { headers: authHeaders() }).then(r => r.json()),
  post: (path, body) => fetch(`${API}${path}`, { method: 'POST', headers: authHeaders(), body: JSON.stringify(body) }).then(r => r.json()),
  del:  (path)       => fetch(`${API}${path}`, { method: 'DELETE', headers: authHeaders() }).then(r => r.json()),
};

// ── Context ──────────────────────────────────────────
const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('liofy_user') || 'null'); } catch { return null; }
  });

  const [tracks, setTracks] = useState(() => {
    try {
      const s = localStorage.getItem('liofy_tracks');
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });

  const [playlists, setPlaylists] = useState(() => {
    try {
      const s = localStorage.getItem('liofy_playlists');
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });

  const [likedTrackIds, setLikedTrackIds] = useState(() => {
    try {
      const s = localStorage.getItem('liofy_liked');
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  });

  const [isSyncing, setIsSyncing] = useState(false);

  // ── Persist to localStorage ──────────────────────────
  useEffect(() => {
    if (currentUser) localStorage.setItem('liofy_user', JSON.stringify(currentUser));
    else { localStorage.removeItem('liofy_user'); localStorage.removeItem('liofy_token'); }
  }, [currentUser]);

  useEffect(() => {
    try { localStorage.setItem('liofy_tracks', JSON.stringify(tracks)); } catch {}
  }, [tracks]);

  useEffect(() => {
    try { localStorage.setItem('liofy_playlists', JSON.stringify(playlists)); } catch {}
  }, [playlists]);

  useEffect(() => {
    try { localStorage.setItem('liofy_liked', JSON.stringify(likedTrackIds)); } catch {}
  }, [likedTrackIds]);

  // ── Full sync from server ────────────────────────────
  const syncFromServer = useCallback(async () => {
    if (!getToken()) {
      // No user logged in — just fetch public tracks
      try {
        const data = await api.get('/api/tracks');
        if (data.success && Array.isArray(data.tracks)) {
          setTracks(data.tracks);
        }
      } catch {}
      return;
    }

    setIsSyncing(true);
    try {
      const data = await api.get('/api/sync');
      if (data.success) {
        if (data.user) {
          setCurrentUser(prev => ({ ...prev, ...data.user }));
        }
        if (Array.isArray(data.tracks)) {
          const liked = new Set(data.likedTrackIds || []);
          const formatted = data.tracks.map(t => ({ ...t, liked: liked.has(t.id) }));
          setTracks(formatted);
        }
        if (Array.isArray(data.playlists)) {
          setPlaylists(data.playlists);
        }
        if (Array.isArray(data.likedTrackIds)) {
          setLikedTrackIds(data.likedTrackIds);
        }
      }
    } catch (err) {
      console.warn('Sync failed (offline?):', err);
    }
    setIsSyncing(false);
  }, []);

  // Sync on mount and when user changes
  useEffect(() => {
    syncFromServer();
  }, [currentUser?.email]);

  // ── Login handler ────────────────────────────────────
  const login = useCallback((user, token) => {
    if (token) localStorage.setItem('liofy_token', token);
    setCurrentUser(user);
  }, []);

  // ── Logout ───────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('liofy_token');
    setCurrentUser(null);
    setLikedTrackIds([]);
    setPlaylists([]);
    setTracks([]);
  }, []);

  // ── Like / Unlike ────────────────────────────────────
  const toggleLike = useCallback(async (trackId) => {
    const wasLiked = likedTrackIds.includes(trackId);
    // Optimistic update
    setLikedTrackIds(prev => wasLiked ? prev.filter(id => id !== trackId) : [...prev, trackId]);
    setTracks(prev => prev.map(t => t.id === trackId ? { ...t, liked: !wasLiked } : t));
    setPlaylists(prev => prev.map(pl => {
      if (!pl.isLikedSongs) return pl;
      return {
        ...pl,
        trackIds: wasLiked
          ? (pl.trackIds || []).filter(id => id !== trackId)
          : [...(pl.trackIds || []), trackId],
      };
    }));

    // Sync to server if logged in
    if (getToken()) {
      try { await api.post(`/api/tracks/${trackId}/like`, {}); } catch {}
    }
  }, [likedTrackIds]);

  const value = {
    currentUser, setCurrentUser, login, logout,
    tracks, setTracks,
    playlists, setPlaylists,
    likedTrackIds, setLikedTrackIds,
    toggleLike,
    isSyncing,
    syncFromServer,
    API_BASE_URL: API,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be inside UserProvider');
  return ctx;
}
