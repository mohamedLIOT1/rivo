import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getOfflineTracks } from '../utils/offlineStorage';

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

  const deduplicateTracks = (trackList) => {
    if (!Array.isArray(trackList)) return [];
    const map = new Map();
    trackList.forEach(t => {
      const key = (t.title || '').trim().toLowerCase();
      if (!map.has(key) || (t.lyrics && t.lyrics.length > (map.get(key)?.lyrics?.length || 0))) {
        map.set(key, t);
      }
    });
    return Array.from(map.values());
  };

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

  // ── Full sync from server ────────────────────────────
  const syncFromServer = useCallback(async () => {
    let offlineTracks = [];
    try {
      offlineTracks = await getOfflineTracks();
    } catch {}
    const offlineMap = new Map(offlineTracks.map(t => [String(t.id), t]));

    const token = getToken();
    if (!token) {
      // No user logged in — just fetch public tracks
      try {
        const data = await api.get('/api/tracks');
        if (data && data.success && Array.isArray(data.tracks)) {
          const merged = data.tracks.map(t => {
            const off = offlineMap.get(String(t.id));
            return off ? { ...t, ...off, downloaded: true } : t;
          });
          // Add any offline tracks not in public list
          const existingIds = new Set(merged.map(m => String(m.id)));
          offlineTracks.forEach(o => {
            if (!existingIds.has(String(o.id))) merged.push(o);
          });
          setTracks(deduplicateTracks(merged));
          return;
        }
      } catch (err) {
        if (offlineTracks.length > 0) {
          setTracks(offlineTracks);
        }
      }
      return;
    }

    setIsSyncing(true);
    try {
      const data = await api.get('/api/sync');
      if (data && data.success) {
        if (data.user) {
          setCurrentUser(prev => ({ ...prev, ...data.user }));
        }
        if (Array.isArray(data.tracks)) {
          const liked = new Set((data.likedTrackIds || []).map(String));
          const merged = data.tracks.map(t => {
            const cleanId = String(t.id || t._id);
            const off = offlineMap.get(cleanId);
            return {
              ...t,
              ...(off || {}),
              liked: liked.has(cleanId),
              downloaded: !!off
            };
          });
          const existingIds = new Set(merged.map(m => String(m.id)));
          offlineTracks.forEach(o => {
            if (!existingIds.has(String(o.id))) merged.push(o);
          });
          setTracks(deduplicateTracks(merged));
        }
        if (Array.isArray(data.playlists)) {
          setPlaylists(data.playlists);
        }
        if (Array.isArray(data.likedTrackIds)) {
          setLikedTrackIds(data.likedTrackIds.map(String));
        }
      } else if (data && data.error && (data.error.includes('token') || data.error.includes('jwt') || data.error.includes('Unauthorized'))) {
        logout();
      }
    } catch (err) {
      console.warn('Sync failed (offline?):', err);
      if (offlineTracks.length > 0) {
        setTracks(offlineTracks);
      }
    }
    setIsSyncing(false);
  }, [logout]);

  // Sync on mount and when user changes
  useEffect(() => {
    // Load offline tracks immediately on mount to refresh Blob URLs (audio & cover)
    (async () => {
      try {
        const offlineTracks = await getOfflineTracks();
        if (offlineTracks && offlineTracks.length > 0) {
          const offlineMap = new Map(offlineTracks.map(t => [String(t.id), t]));
          setTracks(prev => {
            const updated = prev.map(t => {
              const off = offlineMap.get(String(t.id || t._id));
              return off ? { ...t, ...off, downloaded: true } : t;
            });
            const existingIds = new Set(updated.map(u => String(u.id || u._id)));
            offlineTracks.forEach(o => {
              if (!existingIds.has(String(o.id || o._id))) updated.push(o);
            });
            return deduplicateTracks(updated);
          });
        }
      } catch (e) {}
    })();
    syncFromServer();
  }, [currentUser?.email]);

  // ── Like / Unlike ────────────────────────────────────
  const toggleLike = useCallback(async (trackId) => {
    if (!trackId) return;
    const cleanId = String(trackId);
    const wasLiked = likedTrackIds.some(id => String(id) === cleanId);
    
    setLikedTrackIds(prev => wasLiked 
      ? prev.filter(id => String(id) !== cleanId) 
      : [...prev, cleanId]
    );
    setTracks(prev => prev.map(t => 
      (String(t.id) === cleanId || String(t._id) === cleanId) 
        ? { ...t, liked: !wasLiked } 
        : t
    ));
    setPlaylists(prev => prev.map(pl => {
      if (!pl.isLikedSongs) return pl;
      return {
        ...pl,
        trackIds: wasLiked
          ? (pl.trackIds || []).filter(id => String(id) !== cleanId)
          : [...(pl.trackIds || []), cleanId],
      };
    }));

    // Sync to server if logged in
    if (getToken()) {
      try { await api.post(`/api/tracks/${encodeURIComponent(cleanId)}/like`, {}); } catch {}
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
