import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
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
  const [tracks, setTracks] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [likedTrackIds, setLikedTrackIds] = useState([]);

  const tokenRef = useRef(token);
  tokenRef.current = token;
  const likedTrackIdsRef = useRef(likedTrackIds);
  likedTrackIdsRef.current = likedTrackIds;
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  const playlistSaveTimerRef = useRef(null);

  const savePlaylistsDebounced = useCallback((playlistsToSave) => {
    if (playlistSaveTimerRef.current) {
      clearTimeout(playlistSaveTimerRef.current);
    }
    playlistSaveTimerRef.current = setTimeout(() => {
      AsyncStorage.setItem(CACHE_PLAYLISTS_KEY, JSON.stringify(playlistsToSave)).catch(() => {});
    }, 3500); // Debounce minimum 3-5 seconds per AGENTS.md
  }, []);

  useEffect(() => {
    return () => {
      if (playlistSaveTimerRef.current) {
        clearTimeout(playlistSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    loadStoredAuth();
    fetchPublicTracks();
  }, []);

  const loadStoredAuth = async () => {
    try {
      // 1. FAST PATH: Read token & user profile in parallel and apply immediately (0ms delay!)
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem(TOKEN_KEY),
        AsyncStorage.getItem(USER_KEY)
      ]);

      let userObj = null;
      let activeToken = storedToken;

      if (storedUser) {
        try {
          userObj = JSON.parse(storedUser);
        } catch {}
      }

      // Check legacy keys fallback if not found
      if (!userObj || !activeToken) {
        try {
          const [legacyToken, legacyUser] = await Promise.all([
            AsyncStorage.getItem('rivo_token'),
            AsyncStorage.getItem('rivo_user')
          ]);
          if (!activeToken && legacyToken) {
            activeToken = legacyToken;
            AsyncStorage.setItem(TOKEN_KEY, legacyToken).catch(() => {});
          }
          if (!userObj && legacyUser) {
            try {
              userObj = JSON.parse(legacyUser);
              AsyncStorage.setItem(USER_KEY, legacyUser).catch(() => {});
            } catch {}
          }
        } catch {}
      }

      if (userObj) {
        setCurrentUser(userObj);
        setLikedTrackIds(userObj.likedTrackIds || []);
      }
      if (activeToken) {
        setToken(activeToken);
      }

      // Mark auth as loaded immediately! Header, username, avatar and account render instantly!
      setIsAuthLoaded(true);

      // Background network sync
      if (activeToken) {
        syncUserData(activeToken).catch(() => {});
      }

      // 2. Direct deterministic cache hydration without setTimeout artificial delay
      try {
        const [cachedTracks, cachedPlaylists, cachedAlbums] = await Promise.all([
          AsyncStorage.getItem(CACHE_TRACKS_KEY),
          AsyncStorage.getItem(CACHE_PLAYLISTS_KEY),
          AsyncStorage.getItem(CACHE_ALBUMS_KEY)
        ]);

        if (cachedAlbums) {
          try {
            const parsedAlb = JSON.parse(cachedAlbums);
            if (Array.isArray(parsedAlb)) {
              setAlbums(prev => (prev && prev.length > 0 ? prev : parsedAlb));
            }
          } catch {}
        }

        if (cachedPlaylists) {
          try {
            const parsedPl = JSON.parse(cachedPlaylists);
            if (Array.isArray(parsedPl)) {
              setPlaylists(prev => (prev && prev.length > 0 ? prev : normalizePlaylists(parsedPl)));
            }
          } catch {}
        }

        if (cachedTracks) {
          try {
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
              if (cleaned.length > 0) {
                setTracks(prev => (prev && prev.length > 0 ? prev : cleaned));
              }
            }
          } catch {}
        }
      } catch (err) {
        console.warn('Direct cache load notice:', err);
      }
    } catch (e) {
      console.warn('loadStoredAuth error:', e);
      setIsAuthLoaded(true);
    }
  };

  const fetchPublicTracks = useCallback(async () => {
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
          setTracks(prev => {
            if (
              prev &&
              prev.length === cleaned.length &&
              (prev[0]?._id || prev[0]?.id) === (cleaned[0]?._id || cleaned[0]?.id) &&
              (prev[prev.length - 1]?._id || prev[prev.length - 1]?.id) === (cleaned[cleaned.length - 1]?._id || cleaned[cleaned.length - 1]?.id)
            ) {
              return prev;
            }
            return cleaned;
          });
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
          setAlbums(prev => {
            if (
              prev &&
              prev.length === albList.length &&
              (prev[0]?._id || prev[0]?.id) === (albList[0]?._id || albList[0]?.id) &&
              (prev[prev.length - 1]?._id || prev[prev.length - 1]?.id) === (albList[albList.length - 1]?._id || albList[albList.length - 1]?.id)
            ) {
              return prev;
            }
            return albList;
          });
          AsyncStorage.setItem(CACHE_ALBUMS_KEY, JSON.stringify(albList)).catch(() => {});
        }
      }
    } catch {}
  }, []);

  const syncUserData = useCallback(async (activeToken) => {
    const t = activeToken || tokenRef.current;
    if (!t) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          const normalized = normalizePlaylists(data.user.playlists || []);
          setCurrentUser(data.user);
          setLikedTrackIds(data.user.likedTrackIds || []);
          setPlaylists(normalized);
          AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user)).catch(() => {});
          savePlaylistsDebounced(normalized);
        }
      }
    } catch {}
  }, [savePlaylistsDebounced]);

  const login = useCallback(async (email, password) => {
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
      await AsyncStorage.setItem('rivo_token', data.token).catch(() => {});
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user));
      await AsyncStorage.setItem(CACHE_PLAYLISTS_KEY, JSON.stringify(normalized));
      return data.user;
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') throw new Error('Connection timed out. Please check your network.');
      throw e;
    }
  }, []);

  const register = useCallback(async (name, email, password) => {
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
  }, [login]);

  const logout = useCallback(async () => {
    setCurrentUser(null);
    setToken(null);
    setLikedTrackIds([]);
    setPlaylists([]);
    await AsyncStorage.removeItem(TOKEN_KEY);
    await AsyncStorage.removeItem('rivo_token').catch(() => {});
    await AsyncStorage.removeItem(USER_KEY);
  }, []);

  const updateProfile = useCallback(async (updates) => {
    const t = tokenRef.current;
    if (!t) return;
    const res = await fetch(`${API_BASE_URL}/api/auth/update-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${t}`,
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
  }, []);

  const toggleLikeTrack = useCallback(async (trackId) => {
    const idStr = String(trackId);
    const safeLiked = Array.isArray(likedTrackIdsRef.current) ? likedTrackIdsRef.current : [];
    const isLiked = safeLiked.includes(idStr);
    const updated = isLiked ? safeLiked.filter(id => id !== idStr) : [...safeLiked, idStr];
    setLikedTrackIds(updated);

    const t = tokenRef.current;
    if (t) {
      fetch(`${API_BASE_URL}/api/tracks/${idStr}/like`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}` },
      }).then(() => syncUserData()).catch(() => {});
    }
  }, [syncUserData]);

  const createPlaylist = useCallback(async (name) => {
    const t = tokenRef.current;
    if (!t) return;
    const res = await fetch(`${API_BASE_URL}/api/playlists/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      body: JSON.stringify({ name }),
    });
    if (res.ok) await syncUserData();
  }, [syncUserData]);

  const addToPlaylist = useCallback(async (playlistId, trackId, trackObj = null) => {
    const plIdStr = String(playlistId);
    const tIdStr = String(trackId);

    if (trackObj && typeof trackObj === 'object' && trackObj.title) {
      setTracks(prev => {
        if (prev.some(t => String(t._id || t.id) === tIdStr)) return prev;
        return [...prev, trackObj];
      });
    }

    // 1. Instant optimistic update to playlists state
    setPlaylists(prev => {
      const next = prev.map(p => {
        if (String(p.id || p._id) === plIdStr) {
          const prevTrackIds = Array.isArray(p.trackIds) ? p.trackIds : [];
          if (prevTrackIds.map(String).includes(tIdStr)) return p;
          const nextTrackIds = [...prevTrackIds, tIdStr];

          let nextTracks = Array.isArray(p.tracks) ? [...p.tracks] : [];
          const foundTrack = (trackObj && typeof trackObj === 'object' && trackObj.title)
            ? trackObj
            : (tracksRef.current || []).find(t => String(t._id || t.id) === tIdStr);
          if (foundTrack) {
            nextTracks.push(foundTrack);
          } else {
            nextTracks.push(tIdStr);
          }
          return {
            ...p,
            trackIds: nextTrackIds,
            tracks: nextTracks,
          };
        }
        return p;
      });
      savePlaylistsDebounced(next);
      return next;
    });

    const t = tokenRef.current;
    if (!t) return { success: true };

    // 2. Run POST in background without blocking syncUserData() waterfall
    try {
      const res = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/add-track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ trackId: tIdStr }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success && Array.isArray(data.trackIds)) {
        setPlaylists(prev => prev.map(p => {
          if (String(p.id || p._id) === plIdStr) {
            return { ...p, trackIds: data.trackIds };
          }
          return p;
        }));
      }
      return data;
    } catch (e) {
      console.warn('[addToPlaylist background error]', e.message);
      return { success: false, error: e.message };
    }
  }, [savePlaylistsDebounced]);

  const removeTrackFromPlaylist = useCallback(async (playlistId, trackId) => {
    const plIdStr = String(playlistId);
    const tIdStr = String(trackId);
    setPlaylists(prev => {
      const next = prev.map(p => {
        if (String(p.id || p._id) === plIdStr) {
          const nextTrackIds = (p.trackIds || []).filter(id => String(id) !== tIdStr);
          const nextTracks = Array.isArray(p.tracks)
            ? p.tracks.filter(t => String(typeof t === 'object' ? (t._id || t.id) : t) !== tIdStr)
            : [];
          return { ...p, trackIds: nextTrackIds, tracks: nextTracks };
        }
        return p;
      });
      savePlaylistsDebounced(next);
      return next;
    });

    const t = tokenRef.current;
    if (!t) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/remove-track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ trackId }),
      });
      if (res.ok) await syncUserData();
    } catch {}
  }, [savePlaylistsDebounced, syncUserData]);

  const updatePlaylist = useCallback(async (playlistId, { name, description, cover, trackIds }) => {
    const plIdStr = String(playlistId);
    setPlaylists(prev => {
      const next = prev.map(p => {
        if (String(p.id || p._id) === plIdStr) {
          return {
            ...p,
            ...(name !== undefined ? { name } : {}),
            ...(description !== undefined ? { description } : {}),
            ...(cover !== undefined ? { cover } : {}),
            ...(trackIds !== undefined ? { trackIds, tracks: trackIds } : {}),
          };
        }
        return p;
      });
      savePlaylistsDebounced(next);
      return next;
    });

    const t = tokenRef.current;
    if (!t) return { success: true };
    try {
      const res = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
        body: JSON.stringify({ name, description, cover, trackIds }),
      });
      const data = await res.json().catch(() => ({ success: false }));
      if (res.ok && data.success) {
        await syncUserData();
      }
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [savePlaylistsDebounced, syncUserData]);

  const updatePlaylistTransitions = useCallback(async (playlistId, { isMix, transitions }) => {
    const plIdStr = String(playlistId);
    setPlaylists(prev => {
      const next = prev.map(p => {
        if (String(p.id || p._id) === plIdStr) {
          return {
            ...p,
            ...(isMix !== undefined ? { isMix } : {}),
            ...(transitions !== undefined ? { transitions } : {}),
          };
        }
        return p;
      });
      savePlaylistsDebounced(next);
      return next;
    });

    const t = tokenRef.current;
    if (!t) return { success: true };
    try {
      const res = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/transitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${t}`
        },
        body: JSON.stringify({ isMix, transitions }),
      });
      return await res.json().catch(() => ({ success: false }));
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, [savePlaylistsDebounced]);

  const uploadPlaylistCover = useCallback(async (playlistId, fileUri) => {
    const t = tokenRef.current;
    if (!t) return { success: false, error: 'Not authenticated' };
    try {
      const formData = new FormData();
      const filename = fileUri.split('/').pop() || 'cover.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      formData.append('cover', { uri: fileUri, name: filename, type });

      const res = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/upload-cover`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${t}`,
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
  }, [syncUserData]);

  const togglePlaylistVisibility = useCallback(async (playlistId) => {
    const t = tokenRef.current;
    if (!t) return { success: false, error: 'Not authenticated' };
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
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
  }, [syncUserData]);

  const deletePlaylist = useCallback(async (playlistId) => {
    const t = tokenRef.current;
    if (!t) return;
    const res = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${t}` },
    });
    if (res.ok) await syncUserData();
  }, [syncUserData]);

  const value = useMemo(() => ({
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
    updatePlaylistTransitions,
    uploadPlaylistCover,
    togglePlaylistVisibility,
    addToPlaylist,
    removeTrackFromPlaylist,
    deletePlaylist,
  }), [
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
    updatePlaylistTransitions,
    uploadPlaylistCover,
    togglePlaylistVisibility,
    addToPlaylist,
    removeTrackFromPlaylist,
    deletePlaylist,
  ]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => useContext(UserContext);
