import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { INITIAL_TRACKS } from '../data/initialTracks';

const UserContext = createContext();
const TOKEN_KEY = '@rivo_auth_token_v2';
const USER_KEY = '@rivo_current_user_v2';
const CACHE_TRACKS_KEY = '@rivo_cached_tracks_v2';
const CACHE_PLAYLISTS_KEY = '@rivo_cached_playlists_v2';

export const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null);
  const [tracks, setTracks] = useState(INITIAL_TRACKS);
  const [playlists, setPlaylists] = useState([]);
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

      if (cachedTracks) {
        const parsed = JSON.parse(cachedTracks);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTracks(parsed);
        }
      }
      if (cachedPlaylists) setPlaylists(JSON.parse(cachedPlaylists));

      if (storedToken && storedUser) {
        setToken(storedToken);
        const userObj = JSON.parse(storedUser);
        setCurrentUser(userObj);
        setLikedTrackIds(userObj.likedTrackIds || []);
        syncUserData(storedToken);
      }
    } catch {}
  };

  const fetchPublicTracks = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tracks`, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data?.tracks) ? data.tracks : Array.isArray(data) ? data : [];
        if (list.length > 0) {
          setTracks(list);
          AsyncStorage.setItem(CACHE_TRACKS_KEY, JSON.stringify(list)).catch(() => {});
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
          setCurrentUser(data.user);
          setLikedTrackIds(data.user.likedTrackIds || []);
          setPlaylists(data.user.playlists || []);
          AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user)).catch(() => {});
          AsyncStorage.setItem(CACHE_PLAYLISTS_KEY, JSON.stringify(data.user.playlists || [])).catch(() => {});
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

      setToken(data.token);
      setCurrentUser(data.user);
      setLikedTrackIds(data.user?.likedTrackIds || []);
      setPlaylists(data.user?.playlists || []);
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
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
    const isLiked = likedTrackIds.includes(idStr);
    const updated = isLiked ? likedTrackIds.filter(id => id !== idStr) : [...likedTrackIds, idStr];
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
        tracks,
        playlists,
        likedTrackIds,
        login,
        register,
        logout,
        updateProfile,
        toggleLikeTrack,
        fetchPublicTracks,
        syncUserData,
        createPlaylist,
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
