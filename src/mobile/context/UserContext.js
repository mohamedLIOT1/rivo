import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import io from 'socket.io-client';
import { API_BASE_URL } from '../config';

const UserContext = createContext();
const TOKEN_KEY = '@liofy_auth_token_v1';
const USER_KEY = '@liofy_current_user_v1';

export const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [likedTrackIds, setLikedTrackIds] = useState([]);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    loadStoredAuth();
    fetchPublicTracks();
  }, []);

  // Connect socket.io when token/server changes
  useEffect(() => {
    const socketInstance = io(API_BASE_URL, {
      transports: ['websocket'],
      autoConnect: true,
    });

    socketInstance.on('connect', () => {
      console.log('⚡ Socket connected to server');
    });

    socketInstance.on('library_updated', () => {
      fetchPublicTracks();
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem(TOKEN_KEY);
      const storedUser = await AsyncStorage.getItem(USER_KEY);
      if (storedToken && storedUser) {
        setToken(storedToken);
        setCurrentUser(JSON.parse(storedUser));
        syncUserData(storedToken);
      }
    } catch (err) {
      console.warn('Error loading stored auth:', err);
    }
  };

  const fetchPublicTracks = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tracks`);
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data?.tracks) ? data.tracks : Array.isArray(data) ? data : [];
        setTracks(list);
      } else {
        setTracks([]);
      }
    } catch (err) {
      console.warn('Could not fetch online tracks:', err.message);
      setTracks([]);
    }
  };

  const syncUserData = async (authToken) => {
    const activeToken = authToken || token;
    if (!activeToken) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        setLikedTrackIds(data.user.likedTrackIds || []);
        setPlaylists(data.user.playlists || []);
      }
    } catch (err) {
      console.warn('Error syncing user data:', err);
    }
  };

  const login = async (email, password) => {
    try {
      console.log('Attempting login at:', `${API_BASE_URL}/api/auth/login`);
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      }).catch(err => {
        throw new Error(`Could not connect to server (${err.message}). Check your connection.`);
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Login failed');

      setToken(data.token);
      setCurrentUser(data.user);
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
      await syncUserData(data.token);
      return data.user;
    } catch (err) {
      console.error('Login Error:', err);
      throw err;
    }
  };

  const register = async (name, email, password) => {
    try {
      console.log('Attempting register at:', `${API_BASE_URL}/api/auth/register`);
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      }).catch(err => {
        throw new Error(`Could not connect to server (${err.message}).`);
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'Registration failed');

      return await login(email, password);
    } catch (err) {
      console.error('Register Error:', err);
      throw err;
    }
  };

  const updateProfile = async (updates) => {
    if (!token) return;
    try {
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
      } else {
        throw new Error(data.error || 'Failed to update profile');
      }
    } catch (err) {
      console.error('Update profile error:', err);
      throw err;
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

  const toggleLikeTrack = async (trackId) => {
    const isLiked = likedTrackIds.includes(trackId);
    const updatedLikes = isLiked
      ? likedTrackIds.filter(id => id !== trackId)
      : [...likedTrackIds, trackId];

    setLikedTrackIds(updatedLikes);

    if (token) {
      try {
        await fetch(`${API_BASE_URL}/api/tracks/${trackId}/like`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.warn('Like sync error:', err);
      }
    }
  };

  return (
    <UserContext.Provider value={{
      currentUser,
      token,
      tracks,
      playlists,
      likedTrackIds,
      socket,
      login,
      register,
      logout,
      updateProfile,
      toggleLikeTrack,
      fetchPublicTracks,
      syncUserData,
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);

