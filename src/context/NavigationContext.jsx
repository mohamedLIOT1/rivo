import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { buildUrl, parseLocation } from '../utils/router';
import { isQuranContent } from '../utils/quranUtils';
import { isPodcastContent } from '../utils/podcastUtils';

const NavigationContext = createContext(null);

export function NavigationProvider({ children, likedTrackIds = [], playlists = [], albums = [] }) {
  const playlistsRef = useRef(playlists);
  const albumsRef = useRef(albums);
  useEffect(() => { playlistsRef.current = playlists; }, [playlists]);
  useEffect(() => { albumsRef.current = albums; }, [albums]);

  const getIsMusicDisabled = () => {
    try {
      const saved = localStorage.getItem('rivo_content_modes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.music === false) return true;
      }
    } catch {}
    return false;
  };

  const initialNav = useMemo(() => {
    if (typeof window === 'undefined') return { screen: 'home', params: {} };
    const loc = parseLocation(window.location.pathname, window.location.search);
    if (getIsMusicDisabled() && (loc.screen === 'home' || !loc.screen)) {
      return { screen: 'quran', params: loc.params || {} };
    }
    return loc;
  }, []);

  const [currentScreen, setCurrentScreen] = useState(() => {
    if (getIsMusicDisabled() && (initialNav.screen === 'home' || !initialNav.screen)) {
      return 'quran';
    }
    return initialNav.screen || 'home';
  });
  const [topSearchQuery, setTopSearchQuery] = useState(initialNav.params?.query || '');
  const [searchFilter, setSearchFilter] = useState(initialNav.params?.filter || 'all');
  const [selectedArtist, setSelectedArtist] = useState(() => {
    if (initialNav.screen === 'artist' && initialNav.params?.name) {
      return { name: initialNav.params.name, id: initialNav.params.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-') };
    }
    return null;
  });

  const [selectedPlaylist, setSelectedPlaylist] = useState(() => {
    if (initialNav.screen === 'playlist') {
      if (initialNav.params?.id === 'liked') {
        return { id: 'liked', name: 'Liked Songs', isLikedSongs: true };
      }
      if (initialNav.params?.id) {
        return { id: initialNav.params.id, name: 'Playlist' };
      }
      if (initialNav.params?.albumName) {
        return { name: initialNav.params.albumName, isAlbum: true };
      }
    }
    return null;
  });

  const [libraryMode, setLibraryMode] = useState(
    initialNav.screen === 'quran' ? 'quran' : initialNav.screen === 'podcasts' ? 'podcasts' : 'music'
  );
  const [viewingProfileUserId, setViewingProfileUserId] = useState(initialNav.params?.userId || null);
  const [topSearchFilter, setTopSearchFilter] = useState('all');

  const getLikedSongsPlaylist = useCallback(() => ({
    id: 'liked',
    _id: 'liked',
    name: 'Liked Songs',
    description: 'Your favorite tracks in one place.',
    isLikedSongs: true,
    isAlbum: false,
    trackIds: (likedTrackIds || []).map(String),
    cover: '',
  }), [likedTrackIds]);

  const navigateTo = useCallback((screen, params = {}, options = {}) => {
    const { replace = false } = options;
    const targetUrl = buildUrl(screen, params);

    if (typeof window !== 'undefined') {
      const currentUrl = window.location.pathname + window.location.search;
      const shouldReplace = replace || Boolean(window.history.state?.modal);
      if (currentUrl !== targetUrl || shouldReplace) {
        if (shouldReplace) {
          window.history.replaceState({ screen, params }, '', targetUrl);
        } else {
          window.history.pushState({ screen, params }, '', targetUrl);
        }
      }
    }

    setCurrentScreen(screen);

    if (screen === 'home') {
      setSelectedArtist(null);
      setSelectedPlaylist(null);
      setViewingProfileUserId(null);
    } else if (screen === 'search') {
      if (params.query !== undefined) setTopSearchQuery(params.query);
      if (params.filter !== undefined) setTopSearchFilter(params.filter);
      setSelectedArtist(null);
      setSelectedPlaylist(null);
      setViewingProfileUserId(null);
    } else if (screen === 'library') {
      setLibraryMode('music');
      setSelectedArtist(null);
      setSelectedPlaylist(null);
      setViewingProfileUserId(null);
    } else if (screen === 'quran') {
      setLibraryMode('quran');
      setSelectedArtist(null);
      setSelectedPlaylist(null);
      setViewingProfileUserId(null);
    } else if (screen === 'podcasts') {
      setLibraryMode('podcasts');
      setSelectedArtist(null);
      setSelectedPlaylist(null);
      setViewingProfileUserId(null);
    } else if (screen === 'stats' || screen === 'admin' || screen === 'download') {
      setSelectedArtist(null);
      setSelectedPlaylist(null);
      setViewingProfileUserId(null);
    } else if (screen === 'profile') {
      setViewingProfileUserId(params.userId || null);
      setSelectedArtist(null);
      setSelectedPlaylist(null);
    } else if (screen === 'artist') {
      const artParam = params.artist;
      const nameParam = params.name || (typeof artParam === 'string' ? artParam : artParam?.name);
      if (artParam && typeof artParam === 'object') {
        const safeId = artParam.id || encodeURIComponent(artParam.name || '').toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        setSelectedArtist({ ...artParam, id: safeId });
      } else if (nameParam) {
        const cleanName = String(nameParam).trim();
        const safeId = encodeURIComponent(cleanName).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
        setSelectedArtist(prev => {
          if (prev && prev.name && prev.name.toLowerCase() === cleanName.toLowerCase()) {
            return prev;
          }
          return { name: cleanName, id: safeId };
        });
      }
      setSelectedPlaylist(null);
      setViewingProfileUserId(null);
    } else if (screen === 'playlist') {
      if (params.playlist) {
        setSelectedPlaylist(params.playlist);
        const isP = Boolean(params.playlist?.isPodcast || isPodcastContent(params.playlist));
        const isQ = Boolean(params.playlist?.isQuran || isQuranContent(params.playlist));
        if (isP) {
          setLibraryMode('podcasts');
        } else if (isQ) {
          setLibraryMode('quran');
        } else {
          setLibraryMode(prev => prev === 'podcasts' ? 'podcasts' : 'music');
        }
      } else if (params.id) {
        const idStr = String(params.id);
        if (idStr === 'liked') {
          setSelectedPlaylist(getLikedSongsPlaylist());
          setLibraryMode(prev => (prev === 'quran' || prev === 'podcasts') ? prev : 'music');
        } else {
          const found = playlistsRef.current.find(p => String(p.id || p._id) === idStr);
          if (found) {
            setSelectedPlaylist(found);
            const isP = Boolean(found.isPodcast || isPodcastContent(found));
            const isQ = Boolean(found.isQuran || isQuranContent(found));
            if (isP) {
              setLibraryMode('podcasts');
            } else if (isQ) {
              setLibraryMode('quran');
            } else {
              setLibraryMode(prev => prev === 'podcasts' ? 'podcasts' : 'music');
            }
          } else {
            const alb = albumsRef.current.find(a => String(a.id || a._id) === idStr);
            if (alb) {
              setSelectedPlaylist({ ...alb, isAlbum: true });
            } else {
              setSelectedPlaylist({ id: idStr, name: params.albumName || 'Playlist', isAlbum: Boolean(params.albumName || idStr.startsWith('album-')) });
            }
          }
        }
      }
      setSelectedArtist(null);
      setViewingProfileUserId(null);
    }
  }, [getLikedSongsPlaylist]);

  const goToScreen = useCallback((screen, extra = {}) => {
    if (screen === 'home' && getIsMusicDisabled()) {
      screen = 'quran';
    }
    if (screen === 'liked' || screen === 'playlist:liked') {
      navigateTo('playlist', { id: 'liked', playlist: getLikedSongsPlaylist() });
      return;
    }
    if (typeof screen === 'string' && screen.startsWith('playlist:')) {
      const plId = screen.slice('playlist:'.length);
      const foundPl = (playlistsRef.current || []).find(p => String(p.id || p._id) === plId) || { id: plId, name: 'Playlist' };
      if (foundPl.isLikedSongs || plId === 'liked') {
        navigateTo('playlist', { id: 'liked', playlist: getLikedSongsPlaylist() });
        return;
      }
      setSelectedPlaylist(foundPl);
      navigateTo('playlist', { id: foundPl.id || foundPl._id || plId, playlist: foundPl });
      return;
    }
    navigateTo(screen, extra);
  }, [navigateTo, getLikedSongsPlaylist]);

  const handleNavigateBack = useCallback((fallbackScreen = 'home') => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back();
    } else {
      goToScreen(fallbackScreen);
    }
  }, [goToScreen]);

  const handleSelectArtist = useCallback((artist) => {
    if (!artist) return;
    const name = typeof artist === 'string' ? artist.trim() : (artist.name || artist.artist || '').trim();
    if (!name) return;
    const safeId = encodeURIComponent(name).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const artistObj = typeof artist === 'string'
      ? { name, id: safeId }
      : { ...artist, name, id: artist.id || safeId };
    setSelectedArtist(artistObj);
    navigateTo('artist', { name: artistObj.name, artist: artistObj });
  }, [navigateTo]);

  const handleSelectPlaylistView = useCallback((pl) => {
    if (!pl) return;
    if (pl.isLikedSongs || pl.id === 'liked') {
      goToScreen('liked');
      return;
    }
    const isP = Boolean(pl.isPodcast || isPodcastContent(pl));
    const isQ = Boolean(pl.isQuran || isQuranContent(pl));
    if (isP) {
      setLibraryMode('podcasts');
    } else if (isQ) {
      setLibraryMode('quran');
    } else {
      setLibraryMode(prev => prev === 'podcasts' ? 'podcasts' : 'music');
    }
    setSelectedPlaylist(pl);
    navigateTo('playlist', { id: pl.id || pl._id, playlist: pl, albumName: pl.isAlbum ? pl.name : undefined });
  }, [goToScreen, navigateTo]);

  // Window Popstate Listener
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handlePopState = (e) => {
      const state = e.state;
      if (state?.modal) return;

      const { screen, params } = parseLocation(window.location.pathname, window.location.search);
      setCurrentScreen(screen || 'home');

      if (screen === 'home') {
        setSelectedArtist(null);
        setSelectedPlaylist(null);
        setViewingProfileUserId(null);
      } else if (screen === 'search') {
        setTopSearchQuery(params.query || '');
        if (params.filter !== undefined) setTopSearchFilter(params.filter);
        setSelectedArtist(null);
        setSelectedPlaylist(null);
        setViewingProfileUserId(null);
      } else if (screen === 'library') {
        setLibraryMode('music');
        setSelectedArtist(null);
        setSelectedPlaylist(null);
        setViewingProfileUserId(null);
      } else if (screen === 'quran') {
        setLibraryMode('quran');
        setSelectedArtist(null);
        setSelectedPlaylist(null);
        setViewingProfileUserId(null);
      } else if (screen === 'podcasts') {
        setLibraryMode('podcasts');
        setSelectedArtist(null);
        setSelectedPlaylist(null);
        setViewingProfileUserId(null);
      } else if (screen === 'profile') {
        setViewingProfileUserId(params.userId || null);
        setSelectedArtist(null);
        setSelectedPlaylist(null);
      } else if (screen === 'artist') {
        const artName = params.name;
        if (artName) {
          const cleanName = String(artName).trim();
          const safeId = encodeURIComponent(cleanName).toLowerCase().replace(/[^a-z0-9_-]/g, '-');
          setSelectedArtist(prev => {
            if (prev && prev.name && prev.name.toLowerCase() === cleanName.toLowerCase()) {
              return prev;
            }
            return { name: cleanName, id: safeId };
          });
        }
        setSelectedPlaylist(null);
        setViewingProfileUserId(null);
      } else if (screen === 'playlist') {
        if (params.id) {
          const selId = String(params.id);
          if (selId === 'liked') {
            setSelectedPlaylist(getLikedSongsPlaylist());
            setLibraryMode(prev => (prev === 'quran' || prev === 'podcasts') ? prev : 'music');
          } else {
            const foundPl = playlistsRef.current.find(p => String(p.id || p._id) === selId);
            if (foundPl) {
              setSelectedPlaylist(foundPl);
              const isP = Boolean(foundPl.isPodcast || isPodcastContent(foundPl));
              const isQ = Boolean(foundPl.isQuran || isQuranContent(foundPl));
              if (isP) {
                setLibraryMode('podcasts');
              } else if (isQ) {
                setLibraryMode('quran');
              } else {
                setLibraryMode(prev => prev === 'podcasts' ? 'podcasts' : 'music');
              }
            } else {
              const foundAlb = albumsRef.current.find(a => String(a.id || a._id) === selId);
              if (foundAlb) {
                setSelectedPlaylist({ ...foundAlb, isAlbum: true });
              } else {
                setSelectedPlaylist({ id: selId, name: 'Playlist' });
              }
            }
          }
        }
        setSelectedArtist(null);
        setViewingProfileUserId(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [getLikedSongsPlaylist]);

  const value = useMemo(() => ({
    currentScreen,
    setCurrentScreen,
    topSearchQuery,
    setTopSearchQuery,
    topSearchFilter,
    setTopSearchFilter,
    selectedArtist,
    setSelectedArtist,
    selectedPlaylist,
    setSelectedPlaylist,
    libraryMode,
    setLibraryMode,
    viewingProfileUserId,
    setViewingProfileUserId,
    navigateTo,
    goToScreen,
    handleNavigateBack,
    handleSelectArtist,
    handleSelectPlaylistView,
    getLikedSongsPlaylist,
  }), [
    currentScreen,
    topSearchQuery,
    topSearchFilter,
    selectedArtist,
    selectedPlaylist,
    libraryMode,
    viewingProfileUserId,
    navigateTo,
    goToScreen,
    handleNavigateBack,
    handleSelectArtist,
    handleSelectPlaylistView,
    getLikedSongsPlaylist,
  ]);

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigation() {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error('useNavigation must be used within a NavigationProvider');
  }
  return ctx;
}
