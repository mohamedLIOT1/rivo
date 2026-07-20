import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('liofy_user');
      return saved ? JSON.parse(saved) : null;
    } catch(e) { return null; }
  });

  const [tracks, setTracks] = useState(() => {
    try {
      const saved = localStorage.getItem('liofy_tracks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {}
    return [];
  });

  const [playlists, setPlaylists] = useState(() => {
    try {
      const saved = localStorage.getItem('liofy_playlists');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch(e){}
    return [];
  });

  // Fetch initial tracks & profile sync ONCE on mount or user login
  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      try {
        const email = currentUser?.email || '';
        const token = localStorage.getItem('liofy_jwt_token');
        const url = email 
          ? `${API_BASE_URL}/api/user/sync?email=${encodeURIComponent(email)}` 
          : `${API_BASE_URL}/api/tracks`;
        
        const res = await fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });
        if (!res.ok || !isMounted) return;

        const data = await res.json();
        if (data.success && isMounted) {
          if (data.user && currentUser) {
            setCurrentUser(prev => prev ? { ...prev, avatar: data.user.avatar || prev.avatar, name: data.user.name || prev.name } : prev);
          }

          if (Array.isArray(data.tracks) && data.tracks.length > 0) {
            const formattedTracks = data.tracks
              .filter(t => t.audioUrl && !t.audioUrl.includes('itunes.apple.com'))
              .map(t => ({
                id: t._id || t.id,
                title: t.title,
                artist: t.artist,
                album: t.album || 'Single',
                cover: t.cover,
                audioUrl: t.audioUrl,
                lyrics: t.lyrics || [],
                duration: t.duration || 240,
                genre: t.genre || 'Pop',
                source: t.source || 'Liofy',
                liked: true
              }));

            setTracks(prev => {
              if (prev.length === 0) return formattedTracks;
              const existingIds = new Set(prev.map(x => String(x.id || x._id)));
              const newUnique = formattedTracks.filter(x => !existingIds.has(String(x.id)));
              return newUnique.length > 0 ? [...newUnique, ...prev] : prev;
            });
          }

          if (Array.isArray(data.playlists) && data.playlists.length > 0) {
            setPlaylists(prev => {
              if (prev.length === 0) return data.playlists;
              const existingIds = new Set(prev.map(p => String(p.id)));
              const newPls = data.playlists.filter(p => !existingIds.has(String(p.id)));
              return newPls.length > 0 ? [...prev, ...newPls] : prev;
            });
          }
        }
      } catch (err) {
        console.warn('Initial data sync notice:', err);
      }
    };

    fetchInitialData();
    return () => { isMounted = false; };
  }, [currentUser?.email]);

  // Persist User to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('liofy_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('liofy_user');
      localStorage.removeItem('liofy_jwt_token');
    }
  }, [currentUser]);

  // Persist tracks & playlists to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('liofy_tracks', JSON.stringify(tracks));
    } catch (err) {}
  }, [tracks]);

  useEffect(() => {
    try {
      localStorage.setItem('liofy_playlists', JSON.stringify(playlists));
    } catch (err) {}
  }, [playlists]);

  const value = {
    currentUser,
    setCurrentUser,
    tracks,
    setTracks,
    playlists,
    setPlaylists
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
