import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { INITIAL_TRACKS, INITIAL_ALBUMS } from '../data/initialTracks';
import { deduplicateTrackList } from '../services/downloadManager';

const UserContext = createContext();
const TOKEN_KEY = '@rivo_auth_token_v2';
const USER_KEY = '@rivo_current_user_v2';
const CACHE_TRACKS_KEY = '@rivo_cached_tracks_v2';
const CACHE_PLAYLISTS_KEY = '@rivo_cached_playlists_v2';
const CACHE_ALBUMS_KEY = '@rivo_cached_albums_v2';

const normalizePlaylists = (rawList) => {
  if (!Array.isArray(rawList)) return [];
  return rawList.map(p => {
    const pTracks = (Array.isArray(p.tracks) && p.tracks.length > 0) ? p.tracks : (p.trackIds || []);
    const pTrackIds = (Array.isArray(p.trackIds) && p.trackIds.length > 0) ? p.trackIds : (p.tracks || []);
    return {
      ...p,
      tracks: pTracks,
      trackIds: pTrackIds,
    };
  });
};

export const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthLoaded, setIsAuthLoaded] = useState(false);
  const [tracks, setTracks] = useState(INITIAL_TRACKS);
  const [playlists, setPlaylists] = useState([]);
  const [albums, setAlbums] = useState(INITIAL_ALBUMS || []);
  const [likedTrackIds, setLikedTrackIds] = useState([]);

  useEffect(() => {
    loadStoredAuth();
    fetchPublicTracks();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      const storedUser = await AsyncStorage.getItem(USER_KEY);
      const cachedTracks = await AsyncStorage.getItem(CACHE_TRACKS_KEY);
      const cachedPlaylists = await AsyncStorage.getItem(CACHE_PLAYLISTS_KEY);
      const cachedAlbums = await AsyncStorage.getItem(CACHE_ALBUMS_KEY);

      if (cachedAlbums) {
        try {
          const parsedAlb = JSON.parse(cachedAlbums);
          if (Array.isArray(parsedAlb)) setAlbums(parsedAlb);
        } catch {}
      }

      if (cachedTracks) {
        const parsed = JSON.parse(cachedTracks);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = deduplicateTrackList(parsed.filter(t => 
            t &&
            t.source !== 'SoundCloud' &&
            t.album !== 'SoundCloud' &&
            !String(t.audioUrl || '').includes('soundcloud.com') &&
            !String(t.audioUrl || '').includes('sndcdn.com') &&
            !String(t.id || t._id || '').startsWith('sc-')
          ));
          setTracks(cleaned);
          if (cleaned.length !== parsed.length) {
            AsyncStorage.setItem(CACHE_TRACKS_KEY, JSON.stringify(cleaned)).catch(() => {});
          }
        }
      }
      if (cachedPlaylists) {
        const parsedPl = JSON.parse(cachedPlaylists);
        if (Array.isArray(parsedPl)) {
          setPlaylists(normalizePlaylists(parsedPl));
        }
      }

      if (storedToken && storedUser) {
        setToken(storedToken);
        const userObj = JSON.parse(storedUser);
        setCurrentUser(userObj);
        setLikedTrackIds(userObj.likedTrackIds || []);
        syncUserData(storedToken);
      }
    } catch {} finally {
      setIsAuthLoaded(true);
    }
  };

  const fetchPublicTracks = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tracks`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data?.tracks) ? data.tracks : Array.isArray(data) ? data : [];
        const cleaned = deduplicateTrackList(list.filter(t => 
          t &&
          t.source !== 'SoundCloud' &&
          t.album !== 'SoundCloud' &&
          !String(t.audioUrl || '').includes('soundcloud.com') &&
          !String(t.audioUrl || '').includes('sndcdn.com') &&
          !String(t.id || t._id || '').startsWith('sc-')
        ));
        if (cleaned.length > 0) {
          setTracks(cleaned);
          AsyncStorage.setItem(CACHE_TRACKS_KEY, JSON.stringify(cleaned)).catch(() => {});
        }
      }
    } catch {}

    // Fetch discography albums
    try {
      const albRes = await fetch(`${API_BASE_URL}/api/albums`);
      if (albRes.ok) {
        const albData = await albRes.json();
        const albList = Array.isArray(albData?.albums) ? albData.albums : [];
        if (albList.length > 0) {
          setAlbums(albList);
          AsyncStorage.setItem(CACHE_ALBUMS_KEY, JSON.stringify(albList)).catch(() => {});
        }
      }
    } catch {}
  };

  const syncUserData = async (activeToken) => {
    const t = activeToken || token;
    if (!t) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          const normalized = normalizePlaylists(data.user.playlists || []);
          setCurrentUser(data.user);
          setLikedTrackIds(data.user.likedTrackIds || []);
          setPlaylists(normalized);
          AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user)).catch(() => {});
          AsyncStorage.setItem(CACHE_PLAYLISTS_KEY, JSON.stringify(normalized)).catch(() => {});
        }
      }
    } catch {}
  };

  const login = async (email, password) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Login failed');

      const normalized = normalizePlaylists(data.user?.playlists || []);
      setToken(data.token);
      setCurrentUser(data.user);
      setLikedTrackIds(data.user?.likedTrackIds || []);
      setPlaylists(normalized);
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
      await AsyncStorage.setItem(CACHE_PLAYLISTS_KEY, JSON.stringify(normalized));
      return data.user;
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') throw new Error('Connection timed out. Please check your network.');
      throw e;
    }
  };

  const register = async (name, email, password) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Registration failed');
      return await login(email, password);
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') throw new Error('Connection timed out. Please check your network.');
      throw e;
    }
  };

  const logout = async () => {
    setCurrentUser(null);
    setToken(null);
    setLikedTrackIds([]);
    setPlaylists([]);
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem(USER_KEY);
  };

  const updateProfile = async (updates) => {
    if (!token) return;
    const res = await fetch(`${API_BASE_URL}/api/auth/update-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });
    const data = await res.json();
    if (data.success && data.user) {
      setCurrentUser(data.user);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data.user;
    }
    throw new Error(data.error || 'Failed to update profile');
  };

  const toggleLikeTrack = async (trackId) => {
    const idStr = String(trackId);
    const safeLiked = Array.isArray(likedTrackIds) ? likedTrackIds : [];
    const isLiked = safeLiked.includes(idStr);
    const updated = isLiked ? safeLiked.filter(id => id !== idStr) : [...safeLiked, idStr];
    setLikedTrackIds(updated);

    if (token) {
      fetch(`${API_BASE_URL}/api/tracks/${idStr}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).then(() => syncUserData()).catch(() => {});
    }
  };

  const createPlaylist = async (name) => {
    if (!token) return;
    const res = await fetch(`${API_BASE_URL}/api/playlists/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
    if (res.ok) await syncUserData();
  };

  const addToPlaylist = async (playlistId, trackId) => {
    if (!token) return;
    const res = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/add-track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ trackId }),
    });
    if (res.ok) await syncUserData();
  };

  const removeTrackFromPlaylist = async (playlistId, trackId) => {
    if (!token) return;
    const res = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/remove-track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ trackId }),
    });
    if (res.ok) await syncUserData();
  };

  const updatePlaylist = async (playlistId, { name, description, cover }) => {
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const res = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name, description, cover }),
      });
      const data = await res.json().catch(() => ({ success: false }));
      if (res.ok && data.success) {
        setPlaylists(prev => prev.map(p => {
          if (String(p.id || p._id) === String(playlistId)) {
            return {
              ...p,
              name: name !== undefined ? name : p.name,
              description: description !== undefined ? description : p.description,
              cover: cover !== undefined ? cover : p.cover,
            };
          }
          return p;
        }));
        await syncUserData();
      }
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const uploadPlaylistCover = async (playlistId, fileUri) => {
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const formData = new FormData();
      const filename = fileUri.split('/').pop() || 'cover.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      formData.append('cover', { uri: fileUri, name: filename, type });

      const res = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/upload-cover`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await res.json().catch(() => ({ success: false }));
      if (res.ok && data.success) {
        setPlaylists(prev => prev.map(p => {
          if (String(p.id || p._id) === String(playlistId)) {
            return { ...p, cover: data.cover };
          }
          return p;
        }));
        await syncUserData();
      }
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const togglePlaylistVisibility = async (playlistId) => {
    if (!token) return { success: false, error: 'Not authenticated' };
    const pIdStr = String(playlistId);
    let nextState = true;

    // Optimistic update so UI toggles instantly without lag
    setPlaylists(prev => prev.map(p => {
      if (String(p.id) === pIdStr || String(p._id) === pIdStr) {
        nextState = p.isPublic === false ? true : false;
        return { ...p, isPublic: nextState };
      }
      return p;
    }));

    setCurrentUser(prevUser => {
      if (!prevUser || !Array.isArray(prevUser.playlists)) return prevUser;
      return {
        ...prevUser,
        playlists: prevUser.playlists.map(p => {
          if (String(p.id) === pIdStr || String(p._id) === pIdStr) {
            return { ...p, isPublic: nextState };
          }
          return p;
        })
      };
    });

    try {
      const res = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/toggle-visibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({ success: false }));
      if (res.ok && data.success) {
        setPlaylists(prev => prev.map(p => {
          if (String(p.id) === pIdStr || String(p._id) === pIdStr) {
            return { ...p, isPublic: data.isPublic };
          }
          return p;
        }));
        setCurrentUser(prevUser => {
          if (!prevUser || !Array.isArray(prevUser.playlists)) return prevUser;
          return {
            ...prevUser,
            playlists: prevUser.playlists.map(p => {
              if (String(p.id) === pIdStr || String(p._id) === pIdStr) {
                return { ...p, isPublic: data.isPublic };
              }
              return p;
            })
          };
        });
        await syncUserData();
        return { success: true, isPublic: data.isPublic };
      }
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const deletePlaylist = async (playlistId) => {
    if (!token) return;
    const res = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) await syncUserData();
  };

  return (
    <UserContext.Provider
      value={{
        currentUser,
        token,
        isAuthLoaded,
        tracks,
        playlists,
        albums,
        likedTrackIds,
        login,
        register,
        logout,
        updateProfile,
        toggleLikeTrack,
        fetchPublicTracks,
        syncUserData,
        createPlaylist,
        updatePlaylist,
        uploadPlaylistCover,
        togglePlaylistVisibility,
        addToPlaylist,
        removeTrackFromPlaylist,
        deletePlaylist,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
