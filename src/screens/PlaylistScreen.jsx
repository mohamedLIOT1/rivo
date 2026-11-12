import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Play, Pause, Shuffle, Heart, Plus, Minus, Search, ArrowLeft, Music, SlidersHorizontal, 
  Camera, Globe, Lock, Edit2, Loader2, Check, Trash2, X, Sliders, Wand2, 
  Sparkles, RefreshCw, Zap, Disc, ArrowRight, AlertTriangle, MoreVertical,
  Download, CheckCircle2, CheckSquare, Square, ListPlus, FolderPlus, GripVertical
} from 'lucide-react';
import PlaylistActionMenu from '../components/playlist/PlaylistActionMenu';
import { API_BASE_URL } from '../config';
import MiniMixerModal from '../components/MiniMixerModal';
import MixDownloadGate from '../components/MixDownloadGate';
import ExportModal from '../components/ExportModal';
import TrackActionMenuModal from '../components/TrackActionMenuModal';
import { getTrackMusicalData, checkHarmonicCompatibility, getRecommendedTransition, getCamelotColor, calculateBarsDuration } from '../utils/musicAnalysis';
import { useAudioPlayer, shuffleArray } from '../context/AudioContext';
import { useDownloadManager } from '../context/DownloadContext';
import { usePreferences } from '../context/PreferencesContext';
import { ArtistLinks } from '../utils/artistUtils';
import { isUserAdmin } from '../utils/adminUtils';
import { isQuranContent } from '../utils/quranUtils';
import { getListeningStats } from '../utils/listeningTracker';
import DeleteAlbumModal from '../components/DeleteAlbumModal';
import { getAlbumArtwork, OFFICIAL_ALBUM_COVERS } from './ArtistScreen';
import { normalizeCoverUrl, handleCoverImageError } from '../utils/coverUtils';

export default function PlaylistScreen({
  playlist: initialPlaylist, 
  tracks = [], 
  likedTrackIds = [],
  currentUser,
  onSelectTrack, 
  toggleLike, 
  onBack,
  onAddTrackToPlaylist,
  onRemoveTrackFromPlaylist,
  onDeleteTrack,
  onDeletePlaylist = () => {},
  onUpdatePlaylist = () => {},
  onDeleteAlbum,
  onTogglePlaylistVisibility = () => {},
  onSavePlaylist,
  onUnsavePlaylist,
  userPlaylists = [],
  onSelectArtist,
  openEditSongModal,
  openEditAlbumModal,
  openAddToPlaylist,
  onViewProfile,
  libraryMode = 'music',
  globalTheme = 'dark',
  onToast = () => {},
}) {
  const isDark = globalTheme === 'dark';
  const { language, t, isRTL } = usePreferences();
  const [remotePlaylist, setRemotePlaylist] = useState(null);

  const playlist = useMemo(() => {
    if (!initialPlaylist) return remotePlaylist;
    if (!remotePlaylist) return initialPlaylist;
    return {
      ...initialPlaylist,
      ...remotePlaylist,
      name: (remotePlaylist.name && remotePlaylist.name !== 'Playlist') ? remotePlaylist.name : initialPlaylist.name,
      trackIds: (Array.isArray(remotePlaylist.trackIds) && remotePlaylist.trackIds.length > 0)
        ? remotePlaylist.trackIds
        : (Array.isArray(initialPlaylist.trackIds) ? initialPlaylist.trackIds : []),
      tracks: (Array.isArray(remotePlaylist.tracks) && remotePlaylist.tracks.length > 0)
        ? remotePlaylist.tracks
        : (Array.isArray(initialPlaylist.tracks) ? initialPlaylist.tracks : [])
    };
  }, [initialPlaylist, remotePlaylist]);

  useEffect(() => {
    const plId = initialPlaylist?.id || initialPlaylist?._id;
    setRemotePlaylist(null);
    setFetchedTracks([]);
    if (!plId || plId === 'liked') {
      return;
    }

    // Synthetic 12-hour AI Mood Mix playlist: never fetch non-existent /api/playlists/ai-mood-mix
    if (String(plId) === 'ai-mood-mix' || initialPlaylist?.isAiMoodPlaylist) {
      if (!Array.isArray(initialPlaylist?.tracks) || initialPlaylist.tracks.length === 0) {
        try {
          const raw = localStorage.getItem('rivo_ai_mood_mix_v1');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed?.tracks) && parsed.tracks.length > 0) {
              setRemotePlaylist({
                id: 'ai-mood-mix',
                name: parsed.name || initialPlaylist?.name || 'Made For You • AI Mood Mix',
                description: parsed.description || initialPlaylist?.description || '',
                isAiMoodPlaylist: true,
                tracks: parsed.tracks,
                trackIds: parsed.tracks.map(t => String(t.id || t._id)),
              });
            }
          }
        } catch {}
      }
      return;
    }

    const controller = new AbortController();
    const hasTracks = (Array.isArray(initialPlaylist?.trackIds) && initialPlaylist.trackIds.length > 0) || (Array.isArray(initialPlaylist?.tracks) && initialPlaylist.tracks.length > 0);
    const isAlb = String(plId).startsWith('album-') || Boolean(initialPlaylist?.isAlbum);
    if (!hasTracks || isAlb || !initialPlaylist?.name || initialPlaylist.name === 'Playlist') {
      const url = isAlb
        ? `${API_BASE_URL}/api/albums/${encodeURIComponent(plId)}`
        : `${API_BASE_URL}/api/playlists/${encodeURIComponent(plId)}`;
      const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      fetch(url, { headers, signal: controller.signal })
        .then(r => r.json())
        .then(data => {
          if (controller.signal.aborted) return;
          if (data.success) {
            const fetched = data.album || data.playlist;
            if (fetched) {
              const fTrackIds = Array.isArray(fetched.trackIds) && fetched.trackIds.length > 0
                ? fetched.trackIds.map(String)
                : (Array.isArray(data.tracks) ? data.tracks.map(t => String(t.id || t._id)) : []);
              const cleanTracks = (data.tracks || fetched.tracks || []).map(t => {
                const title = String(t.title || t.name || '').trim().toLowerCase();
                const isAnon = title === 'anonymous' || title.includes('anonymous');
                return {
                  ...t,
                  album: isAnon ? 'Single' : (t.album || 'Single'),
                  cover: isAnon ? 'https://i.ytimg.com/vi/Lp8StQkBuUQ/hqdefault.jpg' : normalizeCoverUrl(t.cover, t)
                };
              });
              const enrichedPl = {
                ...fetched,
                isAlbum: isAlb || fetched.isAlbum,
                trackIds: fTrackIds,
                tracks: cleanTracks
              };
              setRemotePlaylist(enrichedPl);
              try { onUpdatePlaylist(enrichedPl); } catch {}
              if (cleanTracks.length > 0) {
                setFetchedTracks(cleanTracks);
              }
            }
          }
        })
        .catch(() => {});
    }
    return () => controller.abort();
  }, [initialPlaylist?.id, initialPlaylist?._id, initialPlaylist?.name]);
  const { currentTrack, isPlaying, isLoadingTrack, togglePlay, togglePlayPause, isMixMode, setIsMixMode, activeTransitions, setActiveTransitions, currentQueue, setCurrentQueue, addToQueue, jamSession } = useAudioPlayer();
  const downloadManager = useDownloadManager();
  const {
    downloadTrack,
    cancelTrackDownload,
    downloadAllTracks,
    cancelAllDownloads,
    isTrackDownloading,
    isTrackQueued,
    isBatchDownloading,
    batchStats,
  } = downloadManager || {};
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdatingCover, setIsUpdatingCover] = useState(false);
  const [isTogglingPrivacy, setIsTogglingPrivacy] = useState(false);
  const [fetchedTracks, setFetchedTracks] = useState([]);
  const [actionMenuTrack, setActionMenuTrack] = useState(null);

  // Ownership verification: owner or admin can edit, delete, add/remove tracks, change cover
  const myId = String(currentUser?.id || currentUser?._id || '');
  const isAdmin = isUserAdmin(currentUser);

  // Playlists available in user's library
  const allUserPlaylists = (userPlaylists && userPlaylists.length > 0) ? userPlaylists : (currentUser?.playlists || []);
  const currentPlaylistId = String(playlist?.id || playlist?._id || '');

  // Is this playlist in the user's personal created playlists (not a saved copy)?
  const isUserPlaylist = Boolean(
    allUserPlaylists.some(p => String(p?.id || p?._id) === currentPlaylistId && !p?.sourcePlaylistId)
  );
  const isSiteAlbum = Boolean(playlist?.isAlbum && !isUserPlaylist && !playlist?.isLikedSongs);

  // Is this playlist already saved in user's library from another source?
  const isSavedInLibrary = Boolean(
    allUserPlaylists.some(p =>
      (p?.sourcePlaylistId && String(p.sourcePlaylistId) === currentPlaylistId) ||
      (String(p?.id || p?._id) === currentPlaylistId && p?.sourcePlaylistId)
    )
  );

  // Ownership: can edit, delete, add/remove tracks
  const isAiMoodPlaylist = Boolean(playlist?.isAiMoodPlaylist || currentPlaylistId === 'ai-mood-mix');
  const isOwner = !isAiMoodPlaylist && Boolean(
    isAdmin ||
    playlist?.isLikedSongs ||
    isUserPlaylist ||
    (myId && String(playlist?.ownerId || playlist?.userId || playlist?.owner?._id || playlist?.owner?.id || playlist?.owner || '') === myId)
  );

  const [isSavingPlaylist, setIsSavingPlaylist] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  const handleToggleSavePlaylist = async () => {
    if (isSavingPlaylist) return;
    setIsSavingPlaylist(true);
    try {
      if (isSavedInLibrary) {
        if (onUnsavePlaylist) {
          const idToUnsave = playlist?.sourcePlaylistId || currentPlaylistId;
          await onUnsavePlaylist(idToUnsave);
        }
        setSaveSuccessMsg('Removed from library');
      } else {
        if (onSavePlaylist) {
          const res = await onSavePlaylist({
            ...playlist,
            trackIds: playlist.trackIds || (playlistTracks || []).map(t => String(t.id || t._id)),
            tracks: playlistTracks
          });
          if (res?.success) {
            setSaveSuccessMsg('Saved to your library!');
          }
        }
      }
      setTimeout(() => setSaveSuccessMsg(''), 3000);
    } catch (err) {
      console.warn('handleToggleSavePlaylist error:', err);
    }
    setIsSavingPlaylist(false);
  };

  // Rivo Mix & DJ Transitions State
  const [isMixActive, setIsMixActive] = useState(Boolean(playlist?.isMix));
  const [transitions, setTransitions] = useState(playlist?.transitions || {});
  const [activeMixerPair, setActiveMixerPair] = useState(null); // { trackA, trackB, pairKey }
  const [isAutoMixingAll, setIsAutoMixingAll] = useState(false);

  // Duplicate Track Confirmation State
  const [duplicateConfirmTrack, setDuplicateConfirmTrack] = useState(null);
  const [isDeleteAlbumModalOpen, setIsDeleteAlbumModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [showMixGate, setShowMixGate] = useState(false);
  const [pendingMixTrack, setPendingMixTrack] = useState(null);

  const handleAddTrackWithCheck = (trackToAdd) => {
    if (!trackToAdd) return;
    const trackIdStr = String(trackToAdd.id || trackToAdd._id);
    const alreadyInPlaylist = (playlist?.trackIds || []).map(String).includes(trackIdStr);
    if (alreadyInPlaylist) {
      setDuplicateConfirmTrack(trackToAdd);
    } else {
      // Optimistically remove from recommendations so UI updates instantly
      setAiRecommendations(prev => prev.filter(r => String(r.id || r._id) !== trackIdStr));
      // Optimistically update playlist tracks in remotePlaylist
      setRemotePlaylist(prev => {
        const base = prev || playlist || {};
        const baseTrackIds = Array.isArray(base.trackIds) ? base.trackIds.map(String) : [];
        const baseTracks = Array.isArray(base.tracks) ? [...base.tracks] : [];
        return {
          ...base,
          trackIds: [...baseTrackIds, trackIdStr],
          tracks: [...baseTracks, trackToAdd]
        };
      });
      onAddTrackToPlaylist(trackIdStr, playlist.id || playlist._id, false);
    }
  };

  // AI Smart Recommendations State
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);
  const recsAbortRef = useRef(null);

  useEffect(() => {
    return () => {
      recsAbortRef.current?.abort();
      setIsLoadingRecs(false);
    };
  }, [playlist?.id]);

  // Edit Name & Description Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(playlist?.name || '');
  const [editDesc, setEditDesc] = useState(playlist?.description || '');
  const [editIsMix, setEditIsMix] = useState(Boolean(playlist?.isMix || playlist?.name?.toUpperCase()?.includes('MIX')));
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (playlist) {
      setEditName(playlist.name || '');
      setEditDesc(playlist.description || '');
      const isAlb = Boolean(playlist.isAlbum || String(playlist.id || '').startsWith('album-'));
      const isLk = Boolean(playlist.id === 'liked' || playlist.isLikedSongs);
      const mixOn = !isAlb && !isLk && Boolean(playlist.isMix);
      setIsMixActive(mixOn);
      const t = playlist.transitions || {};
      setTransitions(t);
    }
  }, [playlist?.id, playlist?.isMix, playlist?.isAlbum]);

  const rawTrackIds = playlist?.trackIds;
  const playlistTrackIds = useMemo(() => (rawTrackIds || []).map(String), [rawTrackIds]);

  // Dynamically fetch any tracks in playlist that are missing from global tracks state
  useEffect(() => {
    if (!playlist || !playlist.trackIds || playlist.trackIds.length === 0) {
      setFetchedTracks([]);
      return;
    }
    const knownIds = new Set();
    tracks.forEach(t => {
      if (!t) return;
      if (t._id) knownIds.add(String(t._id));
      if (t.id) knownIds.add(String(t.id));
    });
    const missing = playlist.trackIds.map(String).filter(id => !knownIds.has(id));

    if (missing.length > 0) {
      const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      fetch(`${API_BASE_URL}/api/tracks/by-ids`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ids: missing })
      })
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.tracks) && d.tracks.length > 0) {
          setFetchedTracks(d.tracks);
        }
      })
      .catch(() => {});
    } else {
      setFetchedTracks(prev => prev.filter(t => playlist.trackIds.map(String).includes(String(t.id || t._id))));
    }
  }, [playlist?.id, JSON.stringify(playlist?.trackIds || []), tracks.length]);


  const allAvailable = useMemo(() => [...tracks, ...fetchedTracks], [tracks, fetchedTracks]);
  const trackMap = useMemo(() => {
    const map = new Map();
    allAvailable.forEach(t => {
      if (!t) return;
      if (t._id) map.set(String(t._id), t);
      if (t.id) map.set(String(t.id), t);
    });
    return map;
  }, [allAvailable]);

  const isLikedPlaylist = Boolean(playlist?.isLikedSongs || playlist?.id === 'liked');

  // Preserve EXACT track order as stored in playlist.trackIds, or strictly filter liked tracks for Liked Songs
  const playlistTracks = useMemo(() => {
    if (!playlist) return [];
    if (!isLikedPlaylist) {
      let list = [];
      if (Array.isArray(playlist.tracks) && playlist.tracks.length > 0) {
        list = playlist.tracks.map(t => trackMap.get(String(t.id || t._id)) || t);
      } else {
        list = playlistTrackIds.map(id => trackMap.get(id)).filter(Boolean);
      }

      const hasExplicitTracks = Array.isArray(playlist.tracks) && playlist.tracks.length > 0;
      if (!hasExplicitTracks && (playlist.isAlbum || playlist.name?.startsWith('Album -') || playlist.id?.startsWith('album-'))) {
        const cleanAlbName = (playlist.name || playlist.title || '').replace(/^album\s*-\s*/i, '').trim().toLowerCase();
        const albNorm = (playlist.name || playlist.title || '').trim().toLowerCase();
        list = list.filter(t => {
          if (!t) return false;
          if (t.album) {
            const trackAlb = (t.album || '').trim().toLowerCase();
            const trackClean = trackAlb.replace(/^album\s*-\s*/i, '');
            if (trackAlb !== albNorm && trackClean !== cleanAlbName && !albNorm.includes(trackClean) && !trackClean.includes(cleanAlbName)) {
              return false;
            }
          }
          return true;
        });
      }

      if (playlist.isAlbum || playlist.name?.startsWith('Album -') || playlist.id?.startsWith('album-')) {

        const seen = new Set();
        list = list.filter(t => {
          const baseTitle = (t.title || '').replace(/\s*\(feat\.[^)]+\)/i, '').trim().toLowerCase();
          const artist = (t.artist || '').trim().toLowerCase();
          const key = `${baseTitle}|${artist}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      }

      return list;
    }
    const likedSet = new Set([
      ...(playlistTrackIds || []),
      ...((likedTrackIds || []).map(String))
    ]);

    const result = [];
    const addedIds = new Set();

    // Preserve order if present in playlistTrackIds
    playlistTrackIds.forEach(id => {
      const t = trackMap.get(id);
      if (t && !addedIds.has(id)) {
        result.push(t);
        addedIds.add(id);
      }
    });

    // Add any remaining liked tracks from allAvailable
    allAvailable.forEach(t => {
      const id = String(t.id || t._id);
      if ((likedSet.has(id) || t.liked) && !addedIds.has(id)) {
        result.push(t);
        addedIds.add(id);
      }
    });

    // Filter liked tracks by active libraryMode (music vs quran) to match sidebar count
    return result.filter(t => libraryMode === 'quran' ? isQuranContent(t) : !isQuranContent(t));
  }, [isLikedPlaylist, playlistTrackIds, likedTrackIds, trackMap, allAvailable, libraryMode]);

  const isQuran = Boolean(
    !isLikedPlaylist
      ? (playlist?.isQuran || isQuranContent(playlist) || (playlistTracks.length > 0 && playlistTracks.every(isQuranContent)))
      : (libraryMode === 'quran' || (playlistTracks.length > 0 && playlistTracks.every(isQuranContent)))
  );

  const isAlbum = Boolean(playlist?.isAlbum || String(playlist?.id || '').startsWith('album-'));
  const isLiked = Boolean(isLikedPlaylist || playlist?.id === 'liked');
  const canBeMix = !isQuran && !isAlbum && !isLiked;
  const isPlaylistMixActive = canBeMix && Boolean(isMixActive);

  const [availableLimit, setAvailableLimit] = useState(30);
  const [availableSearch, setAvailableSearch] = useState('');

  const availableTracks = useMemo(() => {
    if (isLikedPlaylist) return [];
    const set = new Set(playlistTrackIds);
    let list = tracks.filter((t) => !set.has(String(t.id || t._id)));
    if (availableSearch) {
      const q = availableSearch.toLowerCase();
      list = list.filter(t => (t.title && t.title.toLowerCase().includes(q)) || (t.artist && t.artist.toLowerCase().includes(q)));
    }
    return list;
  }, [isLikedPlaylist, tracks, playlistTrackIds, availableSearch]);

  const filteredPlaylistTracks = useMemo(() => {
    if (!searchQuery) return playlistTracks;
    const q = searchQuery.toLowerCase();
    return playlistTracks.filter((t) => 
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.artist && t.artist.toLowerCase().includes(q))
    );
  }, [playlistTracks, searchQuery]);

  const [visibleLimit, setVisibleLimit] = useState(60);
  useEffect(() => {
    setVisibleLimit(60);
  }, [playlist?.id, playlist?._id, searchQuery]);

  // Multi-Select state & batch actions
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedTrackIds, setSelectedTrackIds] = useState(new Set());

  const toggleTrackSelect = (trackId) => {
    setSelectedTrackIds(prev => {
      const next = new Set(prev);
      const sId = String(trackId);
      if (next.has(sId)) next.delete(sId);
      else next.add(sId);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedTrackIds.size === filteredPlaylistTracks.length) {
      setSelectedTrackIds(new Set());
    } else {
      setSelectedTrackIds(new Set(filteredPlaylistTracks.map(t => String(t.id || t._id))));
    }
  };

  const getSelectedTracks = () => {
    return filteredPlaylistTracks.filter(t => selectedTrackIds.has(String(t.id || t._id)));
  };

  const handleBatchQueue = () => {
    const sel = getSelectedTracks();
    if (sel.length === 0) return;
    addToQueue?.(sel);
    if (onToast) {
      onToast(jamSession ? `Added ${sel.length} song${sel.length > 1 ? 's' : ''} to Jam queue` : `Added ${sel.length} song${sel.length > 1 ? 's' : ''} to queue`);
    }
    setIsSelectMode(false);
    setSelectedTrackIds(new Set());
  };

  const handleBatchPlaylist = () => {
    const sel = getSelectedTracks();
    if (sel.length === 0) return;
    openAddToPlaylist?.(sel);
    setIsSelectMode(false);
    setSelectedTrackIds(new Set());
  };

  const handleBatchDownload = () => {
    const sel = getSelectedTracks();
    if (sel.length === 0) return;
    const toDownload = sel.filter(t => !t.downloaded);
    if (toDownload.length > 0) {
      downloadAllTracks?.(toDownload, playlist?.name || 'Selected Tracks');
    }
    setIsSelectMode(false);
    setSelectedTrackIds(new Set());
  };

  const handleBatchDelete = async () => {
    const sel = getSelectedTracks();
    if (sel.length === 0) return;
    const count = sel.length;
    if (!window.confirm(`Are you sure you want to remove ${count} selected track(s)?`)) return;

    if (playlist.isLikedSongs) {
      sel.forEach(t => toggleLike?.(t.id || t._id));
    } else if (onRemoveTrackFromPlaylist) {
      for (const t of sel) {
        await onRemoveTrackFromPlaylist(t.id || t._id, playlist.id || playlist._id);
      }
    } else if (onDeleteTrack) {
      for (const t of sel) {
        await onDeleteTrack(t.id || t._id);
      }
    }
    setSelectedTrackIds(new Set());
    setIsSelectMode(false);
  };

  // Debounced auto-fetch AI recommendations on load so page renders with 0ms delay (skip for albums and Quran)
  useEffect(() => {
    if (!isQuran && !playlist?.isAlbum && !playlist?.isLikedSongs && playlistTracks.length > 0 && aiRecommendations.length === 0 && !isLoadingRecs) {
      const timer = setTimeout(() => {
        handleFetchAiRecommendations();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [playlist?.id, playlistTracks.length, isQuran, playlist?.isAlbum]);

  const formatDurationSum = () => {
    const totalSecs = playlistTracks.reduce((acc, t) => acc + (t.duration || 180), 0);
    const mins = Math.floor(totalSecs / 60);
    return `${mins} min`;
  };

  const isMixView = Boolean(playlist?.isMix || playlist?.name?.toUpperCase()?.includes('MIX'));
  const isPublic = playlist?.isPublic !== false;

  if (!playlist) return null;

  const resolvePlaylistCover = (cover) => {
    const rawName = (playlist?.name || '').trim();
    const cleanKey = rawName.replace(/^Album\s*[-–—:]\s*/i, '').trim().toLowerCase();
    if (OFFICIAL_ALBUM_COVERS?.[cleanKey]) {
      return OFFICIAL_ALBUM_COVERS[cleanKey];
    }
    for (const [key, val] of Object.entries(OFFICIAL_ALBUM_COVERS || {})) {
      if (cleanKey && (cleanKey === key || cleanKey.includes(key) || key.includes(cleanKey))) {
        return val;
      }
    }
    if (!cover) return `https://ui-avatars.com/api/?name=${encodeURIComponent(playlist?.name || 'Playlist')}&background=082621&color=26c4b7&size=512&bold=true&format=svg`;
    if (cover.startsWith('/uploads/')) {
      return `${API_BASE_URL}${cover}`;
    }
    return cover;
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUpdatingCover(true);
    const plId = String(playlist?.id || playlist?._id || '');
    const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
    try {
      if (token && plId) {
        const formData = new FormData();
        formData.append('cover', file);
        const res = await fetch(`${API_BASE_URL}/api/playlists/${encodeURIComponent(plId)}/upload-cover`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        const data = await res.json();
        if (data.success && data.cover) {
          onUpdatePlaylist({ ...playlist, cover: data.cover });
          if (onToast) onToast('Playlist cover updated successfully', 'success');
          return;
        }
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdatePlaylist({ ...playlist, cover: reader.result });
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.warn('Cover upload failed, falling back:', err);
      const reader = new FileReader();
      reader.onloadend = () => {
        onUpdatePlaylist({ ...playlist, cover: reader.result });
      };
      reader.readAsDataURL(file);
    } finally {
      setIsUpdatingCover(false);
    }
  };

  const handleTogglePrivacy = async () => {
    setIsTogglingPrivacy(true);
    await onTogglePlaylistVisibility(playlist.id, !isPublic);
    setIsTogglingPrivacy(false);
  };

  const getTransitionDisplayName = (st) => {
    if (!st) return 'Equal Power Blend';
    if (st === 'bass_swap') return 'Bass Swap';
    if (st === 'low_pass') return 'Filter Sweep';
    if (st === 'cut') return 'Instant Cut';
    if (st === 'equal_power') return 'Equal Power Blend';
    return st;
  };

  const [draggedTrackIdx, setDraggedTrackIdx] = useState(null);
  const [dragOverTrackIdx, setDragOverTrackIdx] = useState(null);

  const handleReorderTracks = useCallback(async (fromIdx, toIdx) => {
    if (fromIdx === toIdx || fromIdx < 0 || toIdx < 0) return;
    const reordered = [...playlistTracks];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const newTrackIds = reordered.map(t => String(t.id || t._id));
    if (onUpdatePlaylist) {
      onUpdatePlaylist({ ...playlist, trackIds: newTrackIds });
    }
    if (onToast) {
      onToast(isRTL ? 'تم إعادة ترتيب القائمة' : 'Playlist reordered');
    }
  }, [playlistTracks, playlist, onUpdatePlaylist, onToast, isRTL]);

  const handleToggleMix = async () => {
    if (!canBeMix) return;
    const nextState = !isMixActive;
    setIsMixActive(nextState);
    if (nextState) {
      setIsMixMode?.(true);
      if ((!playlist?.isMix || Object.keys(transitions).length === 0) && playlistTracks.length > 1) {
        handleAutoMixAll();
        return;
      } else {
        setActiveTransitions?.(transitions);
      }
    } else {
      setIsMixMode?.(false);
      setActiveTransitions?.({});
    }

    try {
      const plId = playlist?.id || playlist?._id;
      if (plId && plId !== 'liked') {
        const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
        const res = await fetch(`${API_BASE_URL}/api/playlists/${encodeURIComponent(plId)}/transitions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ isMix: nextState, transitions })
        });
        if (res.ok && playlist) {
          onUpdatePlaylist?.({ ...playlist, isMix: nextState, transitions }, { localOnly: true });
        }
      }
    } catch {}
  };
  const handleToggleMixMode = handleToggleMix;

  const handleAutoMixAll = async () => {
    setIsAutoMixingAll(true);
    const updatedTransitions = { ...transitions };

    for (let i = 0; i < playlistTracks.length - 1; i++) {
      const tA = playlistTracks[i];
      const tB = playlistTracks[i + 1];
      const pairKey = `${String(tA.id || tA._id)}___${String(tB.id || tB._id)}`;
      const rec = getRecommendedTransition(tA, tB);
      const bpmA = tA.bpm || 120;
      const bars = rec.style === 'slam' || rec.style === 'cut' ? 2 : 4;
      const calcDur = calculateBarsDuration(bars, bpmA);
      updatedTransitions[pairKey] = {
        style: rec.style,
        duration: calcDur || rec.duration || 8,
        bars: bars,
        autoMatchBpm: true
      };
    }

    setTransitions(updatedTransitions);
    setActiveTransitions?.(updatedTransitions);
    setIsMixActive(true);
    setIsMixMode?.(true);

    try {
      localStorage.setItem('rivo_active_transitions', JSON.stringify(updatedTransitions));
    } catch {}

    try {
      const plId = playlist?.id || playlist?._id;
      if (plId && plId !== 'liked') {
        onUpdatePlaylist?.({ ...playlist, isMix: true, transitions: updatedTransitions }, { localOnly: true });
        const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
        await fetch(`${API_BASE_URL}/api/playlists/${encodeURIComponent(plId)}/transitions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ isMix: true, transitions: updatedTransitions })
        });
      }
    } catch {}
    setTimeout(() => setIsAutoMixingAll(false), 500);
  };

  const handleSaveTransitionSettings = async (settings) => {
    if (!activeMixerPair) return;
    const { pairKey, trackA, trackB } = activeMixerPair;
    const idA = String(trackA?.id || trackA?._id || '');
    const idB = String(trackB?.id || trackB?._id || '');
    const k1 = idA && idB ? `${idA}___${idB}` : '';
    const k2 = idA && idB ? `${idA}_${idB}` : '';
    const safePairKey = String(pairKey || k1 || '').replace(/\./g, '_').replace(/^\$/, '_');
    const updated = {
      ...transitions,
      ...(safePairKey ? { [safePairKey]: settings } : {}),
      ...(k1 ? { [k1]: settings } : {}),
      ...(k2 ? { [k2]: settings } : {}),
    };
    setTransitions(updated);
    setActiveTransitions?.(updated);
    setIsMixActive(true);
    setIsMixMode?.(true);

    try {
      localStorage.setItem('rivo_active_transitions', JSON.stringify(updated));
    } catch {}

    const plId = playlist?.id || playlist?._id;
    if (playlist && plId && plId !== 'liked') {
      onUpdatePlaylist?.({ ...playlist, isMix: true, transitions: updated }, { localOnly: true });
    }

    try {
      const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
      if (plId && plId !== 'liked' && token) {
        const res = await fetch(`${API_BASE_URL}/api/playlists/${encodeURIComponent(plId)}/transitions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ isMix: true, transitions: updated })
        });
        if (res.ok) {
          onToast?.('Transition saved ✓');
        } else {
          onToast?.('Failed to sync transition to server');
        }
      }
    } catch {
      onToast?.('Offline: transition saved locally');
    }
  };

  const handleFetchAiRecommendations = async () => {
    if (isLoadingRecs) return;
    recsAbortRef.current?.abort();
    const controller = new AbortController();
    recsAbortRef.current = controller;
    setIsLoadingRecs(true);
    try {
      const currentTrackIds = (playlist?.trackIds || []).map(String);
      const currentRecIds = (aiRecommendations || []).map(r => String(r.id || r._id));
      const seeds = playlistTracks.length > 6
        ? [...playlistTracks].sort(() => 0.5 - Math.random()).slice(0, 6)
        : playlistTracks.slice(0, 6);
      const token = currentUser?.token || localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
      const isPlQuran = Boolean(isQuran || playlist?.isQuran);
      let recentHistory = [];
      try {
        const rawHist = getListeningStats()?.history?.slice(0, 10) || [];
        recentHistory = rawHist.filter(item => isPlQuran ? isQuranContent(item) : !isQuranContent(item));
      } catch {}
      const hour = new Date().getHours();
      const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 22 ? 'evening' : 'night';

      const res = await fetch(`${API_BASE_URL}/api/ai/recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          playlistName: playlist?.name || 'Playlist',
          seedTracks: seeds,
          recentTracks: recentHistory,
          timeOfDay,
          trackIds: currentTrackIds,
          excludeTrackIds: currentRecIds,
          isQuran: isPlQuran,
          refresh: true
        }),
        signal: controller.signal
      });
      if (!res.ok || controller.signal.aborted) return;
      const data = await res.json();
      if (!controller.signal.aborted && data.success && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
        const markedRecs = data.recommendations.map(t => ({
          ...t,
          isAiSuggestion: true
        }));
        setAiRecommendations(markedRecs);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.warn('AI recommendations error:', err);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingRecs(false);
      }
    }
  };

  const handleSaveDetails = async () => {
    if (!editName.trim()) return;
    const isM = Boolean(editIsMix || editName.toUpperCase().includes('MIX'));
    const updated = {
      ...playlist,
      name: editName.trim(),
      description: editDesc.trim(),
      isMix: isM
    };
    onUpdatePlaylist(updated);
    setIsMixActive(isM);
    setIsMixMode?.(isM);
    setIsEditModalOpen(false);

    try {
      const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
      await fetch(`${API_BASE_URL}/api/playlists/${playlist.id}/transitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ isMix: isM, transitions })
      });
    } catch {}
  };

  const handleDelete = () => {
    if (isSiteAlbum || playlist?.isAlbum) {
      setIsDeleteAlbumModalOpen(true);
    } else {
      if (window.confirm(`Are you sure you want to delete the playlist "${playlist.name}"?`)) {
        setIsDeleting(true);
        onDeletePlaylist(playlist.id || playlist._id);
      }
    }
  };

  const handleConfirmDeleteAlbum = async (deleteTracks) => {
    setIsDeleting(true);
    try {
      if (onDeleteAlbum) {
        await onDeleteAlbum(playlist.id || playlist._id, playlist, deleteTracks);
      } else {
        onDeletePlaylist(playlist.id || playlist._id);
      }
    } finally {
      setIsDeleting(false);
      setIsDeleteAlbumModalOpen(false);
    }
  };

  const handlePlayPlaylistTrack = (track, customQueue = null) => {
    const baseQueue = Array.isArray(customQueue) && customQueue.length > 0 ? customQueue : filteredPlaylistTracks;
    const isAiMix = Boolean(playlist?.isAiMoodPlaylist || String(playlist?.id || '') === 'ai-mood-mix');
    const fullQueue = isAiMix
      ? [...baseQueue]
      : baseQueue.map(t => (t && (t.isAiSuggestion || t.isSmartShuffle || t.isSmartMoodQueue))
          ? { ...t, isAiSuggestion: false, isSmartShuffle: false, isSmartMoodQueue: false }
          : t);

    fullQueue._isExplicitPlaylist = !isAiMix;
    fullQueue._playlistId = playlist?.id || playlist?._id;
    fullQueue._playlistName = playlist?.name;
    fullQueue.name = playlist?.name;

    if (isPlaylistMixActive) {
      setIsMixMode?.(true);
      if (Object.keys(transitions).length > 0) {
        setActiveTransitions?.(transitions);
      }
      fullQueue._isMix = true;
      fullQueue._transitions = transitions;
    } else {
      setIsMixMode?.(false);
      setActiveTransitions?.({});
      fullQueue._isMix = false;
      fullQueue._transitions = {};
    }

    onSelectTrack(track, fullQueue);
  };

  const handleConfirmDownloadAndMix = () => {
    const notDownloaded = playlistTracks.filter(t => !t.downloaded);
    if (notDownloaded.length > 0 && downloadAllTracks) {
      downloadAllTracks(notDownloaded, playlist?.name || 'DJ Mix');
    }
    setShowMixGate(false);
    setIsMixActive(true);
    setIsMixMode?.(true);
    if (playlist?.id || playlist?._id) {
      try {
        localStorage.setItem('rivo_mix_consented_' + (playlist.id || playlist._id), 'true');
      } catch {}
    }
    const trackToPlay = pendingMixTrack || filteredPlaylistTracks[0];
    if (trackToPlay) {
      const baseQueue = filteredPlaylistTracks;
      const fullQueue = [...baseQueue];
      fullQueue._isMix = true;
      fullQueue._transitions = transitions;
      fullQueue._playlistName = playlist?.name;
      fullQueue.name = playlist?.name;
      if (Object.keys(transitions).length > 0) {
        setActiveTransitions?.(transitions);
      }
      onSelectTrack(trackToPlay, fullQueue);
    }
    setPendingMixTrack(null);
  };

  const handlePlayWithoutMixMode = () => {
    setShowMixGate(false);
    setIsMixActive(false);
    setIsMixMode?.(false);
    const trackToPlay = pendingMixTrack || filteredPlaylistTracks[0];
    if (trackToPlay) {
      const baseQueue = filteredPlaylistTracks;
      const fullQueue = [...baseQueue];
      onSelectTrack(trackToPlay, fullQueue);
    }
    setPendingMixTrack(null);
  };

  return (
    <div className={`flex-1 overflow-y-auto pb-32 select-none p-3 sm:p-6 md:p-8 transition-colors ${
      isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'
    }`}>
      <div className="max-w-[1440px] mx-auto w-full">
      {/* ── Apothecary Playlist Master Header ── */}
      <div className={`brutal-border-thick brutal-shadow-lg p-3.5 sm:p-6 md:p-8 mb-4 sm:mb-8 relative transition-colors ${
        isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#082621]'
      }`}>
        {/* Top bar: Back button & Vintage Stamp */}
        <div className="flex items-center justify-between gap-2 mb-3 sm:mb-5">
          <button 
            onClick={onBack}
            className={`brutal-btn p-1.5 sm:p-2 brutal-border brutal-shadow-sm flex items-center gap-1 text-xs font-mono font-black uppercase shrink-0 cursor-pointer ${
              isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700' : 'bg-[#fdfbf7] hover:bg-[#ede5d3] text-[#0b1110] border-black'
            }`}
          >
            <ArrowLeft size={15} className={isRTL ? "rotate-180" : ""} />
            <span className="hidden sm:inline">{t?.('library.returnBtn') || 'Return'}</span>
          </button>

          <div className={`inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-0.5 sm:py-1 brutal-border text-[9px] sm:text-[10px] font-mono font-black uppercase truncate ${
            isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
          }`}>
            <span className="hidden sm:inline">{t?.('library.officialPlaylist') || 'OFFICIAL AUDIO PRESCRIPTION'}</span>
            <span className="sm:hidden">{t?.('library.officialPlaylist') || 'PRESCRIPTION'}</span>
            <span>•</span>
            <span>BATCH #{String(playlist.id || '99').slice(-4)}</span>
          </div>
        </div>

        <div className="flex flex-row items-center sm:items-end gap-3 sm:gap-6 pt-1">
          {/* Cover Art (With Upload Overlay for Custom Playlists) */}
          <div className="w-24 h-24 xs:w-28 xs:h-28 sm:w-44 sm:h-44 md:w-52 md:h-52 bg-[#ded2bb] brutal-border-thick brutal-shadow shrink-0 relative group overflow-hidden">
            {playlist.isLikedSongs ? (
              <div className="w-full h-full bg-[#dc2626] flex flex-col items-center justify-center text-[#fdfbf7] p-2 sm:p-4 text-center">
                <Heart className="w-8 h-8 sm:w-16 sm:h-16" fill="#fdfbf7" />
                <span className="font-mono text-[8px] sm:text-xs font-black uppercase mt-1 sm:mt-2">{isQuran ? (t?.('library.favoriteSurahs') || 'FAVORITE SURAHS') : (t?.('library.likedSongs') || 'LIKED SONGS')}</span>
              </div>
            ) : isAiMoodPlaylist && playlistTracks.length >= 2 && !playlist.cover ? (
              <div className="w-full h-full grid grid-cols-2 grid-rows-2 bg-[#082621]">
                {playlistTracks.slice(0, 4).map((tr, idx) => (
                  <img
                    key={`ai-cov-${tr.id || tr._id || idx}`}
                    src={normalizeCoverUrl(tr.cover, tr)}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={handleCoverImageError}
                  />
                ))}
              </div>
            ) : (
              <>
                <img 
                  src={(playlist.isAlbum || isSiteAlbum) ? getAlbumArtwork(playlist, playlist.cover) : resolvePlaylistCover(playlist.cover)} 
                  alt={playlist.name} 
                  className="w-full h-full object-cover" 
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    const official = getAlbumArtwork(playlist, '');
                    if (official && !official.includes('ui-avatars.com')) {
                      e.currentTarget.src = official;
                    } else {
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80';
                    }
                  }}
                />
                {isUpdatingCover && (
                  <div className="absolute inset-0 bg-[#082621]/80 flex flex-col items-center justify-center gap-1 sm:gap-2 text-[#26c4b7] z-10 pointer-events-none">
                    <Loader2 size={24} className="animate-spin text-white" />
                    <span className="text-[9px] sm:text-xs font-mono font-black uppercase text-white">UPDATING...</span>
                  </div>
                )}
                {isOwner && !isUpdatingCover && (
                  <label className="absolute inset-0 bg-[#082621]/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 sm:gap-2 cursor-pointer text-[#26c4b7]">
                    <Camera size={20} className="sm:w-7 sm:h-7" />
                    <span className="text-[9px] sm:text-xs font-mono font-black uppercase text-white text-center px-1">CHANGE</span>
                    <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                  </label>
                )}
              </>
            )}
            {/* Corner retro badge */}
            <div className="absolute top-0 right-0 bg-[#0b1110] text-[#26c4b7] text-[8px] sm:text-[9px] font-mono font-black px-1.5 py-0.5 border-b border-l border-black">
              RIVO-TAPE
            </div>
          </div>

          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2 flex-wrap">
              <span className="bg-[#082621] text-[#26c4b7] text-[9px] sm:text-[10px] font-mono font-black uppercase px-2 py-0.5 sm:px-2.5 sm:py-1 brutal-border">
                {isSiteAlbum ? (isQuran ? (t?.('library.surahCollection') || 'SURAH COLLECTION') : (t?.('library.officialAlbum') || 'OFFICIAL ALBUM')) : playlist.isLikedSongs ? (isQuran ? (t?.('library.favoriteSurahs') || 'FAVORITE SURAHS') : (t?.('library.likedSongs') || 'LIKED SONGS')) : (isQuran ? (t?.('library.quranPlaylist') || 'QURAN PLAYLIST') : (t?.('library.playlist') || 'PLAYLIST'))}
              </span>

              {/* Public/Private Badge (Hidden for Site Albums) */}
              {!playlist.isLikedSongs && !isSiteAlbum && (
                <span className={`flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-mono font-black uppercase brutal-border ${
                  isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#0b1110] border-black'
                }`}>
                  {isPublic ? <Globe size={11} /> : <Lock size={11} />}
                  <span>{isPublic ? 'PUBLIC' : 'PRIVATE'}</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <h1 className={`text-xl sm:text-3xl md:text-5xl font-display font-black tracking-tight leading-tight line-clamp-2 ${
                isDark ? 'text-white' : 'text-[#082621]'
              }`}>
                {playlist.isLikedSongs 
                  ? (isQuran ? (t?.('library.favoriteSurahs') || 'Favorite Surahs') : (t?.('library.likedSongs') || 'Liked Songs'))
                  : playlist.name}
              </h1>
            </div>

            {isSiteAlbum && playlist.artist && (
              <div className="mt-0.5 text-[11px] sm:text-xs font-mono font-bold flex items-center gap-1 truncate">
                <span className={isDark ? 'text-zinc-400' : 'text-[#082621]/70'}>{isQuran ? 'Recitations by' : 'Album by'}</span>
                <ArtistLinks
                  artist={playlist.artist}
                  onSelectArtist={onSelectArtist}
                  className="text-[#17a398] font-black uppercase inline-block truncate"
                  linkClassName="hover:underline cursor-pointer"
                />
              </div>
            )}

            {!isSiteAlbum && !playlist.isLikedSongs && (playlist.ownerName || playlist.owner) && (
              <div className="mt-1 text-[11px] sm:text-xs font-mono font-bold flex items-center gap-1.5 truncate">
                <span className={isDark ? 'text-zinc-400' : 'text-[#082621]/70'}>Curated by</span>
                <span
                  onClick={() => {
                    const targetUid = playlist.ownerId || (typeof playlist.owner === 'object' ? (playlist.owner._id || playlist.owner.id) : playlist.owner);
                    if (targetUid && onViewProfile) {
                      onViewProfile(targetUid);
                    }
                  }}
                  className="text-[#17a398] font-black uppercase hover:underline cursor-pointer flex items-center gap-1"
                  title={`View profile of ${playlist.ownerName || 'creator'}`}
                >
                  {playlist.ownerAvatar && (
                    <img src={playlist.ownerAvatar} alt="" className="w-4 h-4 rounded-full object-cover inline-block" />
                  )}
                  <span>@{playlist.ownerName || 'Listener'}</span>
                </span>
              </div>
            )}

            {/* Desktop Description */}
            <p className={`hidden sm:block text-sm sm:text-base md:text-lg mt-2.5 font-sans font-normal leading-relaxed max-w-2xl ${
              isDark ? 'text-zinc-200' : 'text-[#082621]'
            }`}>
              {playlist.description || (playlist.isLikedSongs 
                ? (isQuran ? (t?.('library.likedQuranDesc') || 'Your favorite surahs and recitations in one place.') : (t?.('library.likedSongsDesc') || 'Your favorite tracks in one place.'))
                : (isSiteAlbum ? (isQuran ? `Recitations by ${playlist.artist || 'Reciter'}` : `Official album by ${playlist.artist || 'Artist'}`) : (isQuran ? 'Quran playlist on Rivo.' : 'Custom playlist on Rivo.')))}
            </p>

            <div className={`flex items-center gap-2 sm:gap-3 mt-1.5 sm:mt-4 pt-1 sm:pt-3 sm:border-t text-[10px] sm:text-xs font-mono font-bold ${
              isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110]/15 text-[#082621]'
            }`}>
              <span className={`px-1.5 py-0.2 sm:px-2 sm:py-0.5 brutal-border ${
                isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] border-black'
              }`}>{isSiteAlbum ? (isQuran ? (t?.('library.surahCollection') || 'COLLECTION') : (t?.('library.officialAlbum') || 'ALBUM')) : (isQuran ? (t?.('library.quranPlaylist') || 'QURAN') : (t?.('library.playlist') || 'PLAYLIST'))}</span>
              <span>•</span>
              <span>{playlistTracks.length} {isQuran ? (playlistTracks.length === 1 ? (t?.('library.surahSingle') || 'سورة') : (t?.('library.surahPlural') || 'سور')) : (playlistTracks.length === 1 ? (t?.('library.songSingle') || t?.('library.trackSingle') || 'أغنية') : (t?.('library.songPlural') || t?.('library.trackPlural') || 'أغانٍ'))}</span>
              <span>•</span>
              <span>{formatDurationSum()}</span>
            </div>
          </div>
        </div>

        {/* Mobile Description & Mobile Action Buttons */}
        <div className="block sm:hidden">
          {playlist.description && (
            <p className={`text-xs mt-2.5 pt-2 border-t font-sans font-normal leading-snug line-clamp-2 ${
              isDark ? 'border-zinc-800 text-zinc-300' : 'border-[#0b1110]/10 text-[#082621]'
            }`}>
              {playlist.description}
            </p>
          )}
          {!playlist.isLikedSongs && !isSiteAlbum && isOwner && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#0b1110]/10">
              <button
                onClick={() => setIsEditModalOpen(true)}
                className={`brutal-btn flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-mono font-black uppercase brutal-border ${
                  isDark ? 'bg-zinc-800 text-zinc-200 border-zinc-700' : 'bg-[#ede5d3] text-[#0b1110] border-black'
                }`}
              >
                <Edit2 size={11} />
                <span>EDIT</span>
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="brutal-btn flex-1 flex items-center justify-center gap-1 py-1 text-[10px] font-mono font-black uppercase bg-red-100 text-[#dc2626] brutal-border"
              >
                <Trash2 size={11} />
                <span>DISCARD</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Edit Playlist Modal ── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className={`${isDark ? 'bg-[#111a18] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-[#0b1110] text-[#082621]'} brutal-border-thick brutal-shadow-lg p-6 w-full max-w-md relative`}>
            <button
              onClick={() => setIsEditModalOpen(false)}
              className={`absolute top-4 right-4 p-1 brutal-border ${isDark ? 'text-zinc-300 hover:bg-zinc-800 border-zinc-700' : 'text-[#0b1110] hover:bg-[#ede5d3] border-black'}`}
            >
              <X size={18} />
            </button>
            <div className={`flex items-center gap-2 mb-4 pb-2 border-b-2 ${isDark ? 'border-zinc-700' : 'border-[#0b1110]'}`}>
              <div className="w-3 h-3 bg-[#17a398] brutal-border" />
              <h3 className={`text-lg font-mono font-black uppercase ${isDark ? 'text-white' : 'text-[#082621]'}`}>{isQuran ? 'Edit Quran Playlist Details' : 'Edit Playlist Details'}</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className={`block text-xs font-mono font-black uppercase mb-1 ${isDark ? 'text-zinc-300' : 'text-[#082621]'}`}>{isQuran ? 'Collection / Playlist Name' : 'Playlist Name'}</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={`w-full brutal-border px-3 py-2 text-sm font-sans font-bold focus:outline-none ${isDark ? 'bg-zinc-900 border-zinc-700 text-white focus:bg-black' : 'bg-[#ede5d3] border-black text-[#0b1110] focus:bg-white'}`}
                  placeholder={isQuran ? "Collection name..." : "Playlist name..."}
                />
              </div>

              <div>
                <label className={`block text-xs font-mono font-black uppercase mb-1 ${isDark ? 'text-zinc-300' : 'text-[#082621]'}`}>Description</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  className={`w-full brutal-border px-3 py-2 text-sm font-sans font-medium focus:outline-none resize-none ${isDark ? 'bg-zinc-900 border-zinc-700 text-white focus:bg-black' : 'bg-[#ede5d3] border-black text-[#0b1110] focus:bg-white'}`}
                  placeholder="Playlist description..."
                />
              </div>

              {!isQuran && (
                <div
                  onClick={() => setEditIsMix(!editIsMix)}
                  className={`p-3 brutal-border flex items-center justify-between cursor-pointer transition-colors ${
                    editIsMix 
                      ? 'bg-[#17a398]/20 border-[#17a398]' 
                      : isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-[#ede5d3] border-black'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">🎛️</span>
                    <div>
                      <div className={`text-xs font-mono font-black ${isDark ? 'text-white' : 'text-[#082621]'}`}>DJ MIX PLAYLIST</div>
                      <div className={`text-[10px] ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>Seamless dual-buffer crossfading</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`brutal-btn px-2.5 py-1 brutal-border text-[10px] font-mono font-black uppercase ${
                      editIsMix ? 'bg-[#17a398] text-[#0b1110]' : isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#fdfbf7] text-[#082621]'
                    }`}
                  >
                    {editIsMix ? 'MIX ON' : 'OFF'}
                  </button>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className={`brutal-btn px-4 py-2 brutal-border text-xs font-mono font-black uppercase ${isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700' : 'bg-[#ede5d3] text-[#0b1110] border-black hover:bg-[#ded2bb]'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDetails}
                  className={`brutal-btn px-5 py-2 brutal-border brutal-shadow-sm text-xs font-mono font-black uppercase ${isDark ? 'bg-[#10b981] text-[#0b1110] hover:bg-emerald-400 border-black' : 'bg-[#082621] text-[#26c4b7] hover:bg-[#0b1110] border-black'}`}
                >
                  Save Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Action Buttons & Search Row ── */}
      <div className={`brutal-border brutal-shadow p-2.5 sm:p-4 mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 ${
        isDark ? 'bg-[#141d1b] border-zinc-700' : 'bg-[#fdfbf7] border-black'
      }`}>
        <div className="flex items-center flex-wrap gap-2.5 sm:gap-3">
          {(() => {
            const isCurPlPlaying = currentTrack && filteredPlaylistTracks.some(t => String(t.id || t._id) === String(currentTrack.id || currentTrack._id));
            return (
              <button
                disabled={filteredPlaylistTracks.length === 0}
                onClick={() => {
                  if (filteredPlaylistTracks.length === 0) return;
                  if (isCurPlPlaying) {
                    if (typeof togglePlay === "function") togglePlay();
                    else togglePlayPause?.();
                  } else {
                    handlePlayPlaylistTrack(filteredPlaylistTracks[0]);
                  }
                }}
                className={`brutal-btn w-10 h-10 sm:w-12 sm:h-12 brutal-border-thick brutal-shadow flex items-center justify-center transition-all shrink-0 ${
                  filteredPlaylistTracks.length > 0
                    ? 'bg-[#10b981] hover:bg-emerald-400 text-[#0b1110] cursor-pointer'
                    : 'bg-[#ded2bb] text-[#0b1110]/40 cursor-not-allowed'
                }`}
                title={isCurPlPlaying && isLoadingTrack ? "Loading..." : isCurPlPlaying && isPlaying ? "Pause playlist" : "Play playlist"}
              >
                {isCurPlPlaying && isLoadingTrack ? (
                  <Loader2 size={18} className="animate-spin text-[#0b1110]" />
                ) : isCurPlPlaying && isPlaying ? (
                  <Pause size={18} fill="currentColor" className="text-[#0b1110] sm:w-5 sm:h-5" />
                ) : (
                  <Play size={18} fill="currentColor" className="ml-0.5 text-[#0b1110] sm:w-5 sm:h-5" />
                )}
              </button>
            );
          })()}

          {/* 3-Dots Playlist Action Menu */}
          <PlaylistActionMenu
            playlist={playlist}
            isOwner={isOwner}
            isAdmin={isSiteAlbum}
            isDark={isDark}
            isRTL={isRTL}
            t={t}
            onEdit={() => {
              if (isSiteAlbum && openEditAlbumModal) {
                openEditAlbumModal(playlist);
              } else {
                setIsEditModalOpen(true);
              }
            }}
            onDelete={handleDelete}
            onTogglePrivacy={handleTogglePrivacy}
            isTogglingPrivacy={isTogglingPrivacy}
            onQueueAll={() => {
              if (filteredPlaylistTracks.length > 0) {
                addToQueue?.(filteredPlaylistTracks);
                if (onToast) {
                  onToast(jamSession ? `Added playlist (${filteredPlaylistTracks.length} tracks) to Jam queue` : `Added playlist to queue`);
                }
              }
            }}
            onDownloadAll={() => {
              if (playlistTracks.length > 0) {
                downloadAllTracks?.(playlistTracks, playlist?.name || 'Playlist');
              }
            }}
            isDownloadingAll={isBatchDownloading}
            downloadStats={batchStats}
            allDownloaded={playlistTracks.length > 0 && playlistTracks.every(t => t.downloaded)}
            canBeMix={canBeMix}
            isMixActive={isMixActive}
            onToggleMix={handleToggleMix}
            jamSession={jamSession}
          />

          {/* Save to Library button (for other users' public playlists or albums) */}
          {!isUserPlaylist && !playlist?.isLikedSongs && (
            <button
              onClick={handleToggleSavePlaylist}
              disabled={isSavingPlaylist}
              className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-display font-black text-xs brutal-border brutal-shadow-sm brutal-btn cursor-pointer flex items-center gap-1.5 sm:gap-2 transition-all ${
                isSavedInLibrary
                  ? isDark ? 'bg-zinc-800 text-emerald-400 border-zinc-700 hover:bg-zinc-700' : 'bg-white text-emerald-600 border-black hover:bg-[#ede5d3]'
                  : 'bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110]'
              }`}
              title={isSavedInLibrary ? "In your Library (Click to remove)" : "Save this playlist to your Library"}
            >
              {isSavingPlaylist ? (
                <Loader2 size={14} className="animate-spin sm:w-4 sm:h-4" />
              ) : isSavedInLibrary ? (
                <>
                  <Check size={14} strokeWidth={3} className="sm:w-4 sm:h-4" />
                  <span>Saved in Library</span>
                </>
              ) : (
                <>
                  <Plus size={14} strokeWidth={3} className="sm:w-4 sm:h-4" />
                  <span>Save to Library</span>
                </>
              )}
            </button>
          )}

          {saveSuccessMsg && (
            <span className="text-[11px] sm:text-xs font-mono font-bold text-emerald-500 flex items-center gap-1">
              ✓ {saveSuccessMsg}
            </span>
          )}

          {/* Download progress active chip */}
          {playlistTracks.length > 0 && isBatchDownloading && (
            <div className="flex items-center gap-2">
              <div className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-display font-black text-xs brutal-border brutal-shadow-sm bg-amber-400 text-black flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                <span>
                  Downloading {batchStats.current + 1}/{batchStats.total}
                </span>
              </div>
              <button
                onClick={cancelAllDownloads}
                className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-display font-black text-xs brutal-border brutal-shadow-sm brutal-btn bg-[#dc2626] hover:bg-red-600 text-white flex items-center gap-1.5 cursor-pointer transition-all"
                title="Cancel all playlist downloads"
              >
                <X size={14} strokeWidth={3} />
                <span>Cancel All</span>
              </button>
            </div>
          )}

          {/* Rivo Mix Mode Toggle Button - ONLY shown if DJ Mix playlist */}
          {canBeMix && (playlist?.isMix || isMixActive) && playlistTracks.length > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleMix}
                className={`px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl font-display font-black text-xs brutal-border brutal-shadow-sm brutal-btn flex items-center gap-1.5 sm:gap-2 transition-all cursor-pointer ${
                  isMixActive
                    ? 'bg-[#10b981] text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]'
                    : isDark 
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700' 
                      : 'bg-white hover:bg-[#ede5d3] text-[#0b1110] border-black'
                }`}
                title={isMixActive ? "Mix Mode is active - click to return to normal playlist" : "Turn on Mix Mode for continuous DJ transitions"}
              >
                <span>🎛️</span>
                <span>{isMixActive ? 'Mix: ON' : 'Mix'}</span>
              </button>
            </div>
          )}

          {playlistTracks.length > 0 && (
            <button
              onClick={() => {
                setIsSelectMode(prev => !prev);
                setSelectedTrackIds(new Set());
              }}
              className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-display font-black text-xs brutal-border brutal-shadow-sm brutal-btn cursor-pointer flex items-center gap-1.5 transition-all ${
                isSelectMode
                  ? 'bg-[#17a398] text-[#0b1110] border-black font-black'
                  : isDark
                    ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-zinc-700'
                    : 'bg-white text-[#0b1110] hover:bg-[#ede5d3] border-black'
              }`}
              title="Toggle multi-select mode"
            >
              <CheckSquare size={14} strokeWidth={2.5} className={isSelectMode ? 'text-[#0b1110]' : 'text-[#17a398]'} />
              <span>{isSelectMode ? (t?.('library.cancelSelect') || 'Cancel Select') : (t?.('library.select') || 'Select')}</span>
            </button>
          )}
        </div>

        {playlistTracks.length > 0 && (
          <div className="relative w-full sm:w-72">
            <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${
              isDark ? 'text-zinc-500' : 'text-[#082621]/60'
            }`} />
            <input
              type="text"
              placeholder={t?.('library.searchInPlaylist') || 'Search in prescription list...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full brutal-border pl-8 sm:pl-9 pr-3 sm:pr-4 py-1.5 sm:py-2 text-xs font-mono focus:outline-none ${
                isDark 
                  ? 'bg-[#0b1110] border-zinc-700 text-white placeholder-zinc-500 focus:bg-[#182320]' 
                  : 'bg-[#ede5d3] border-black text-[#0b1110] placeholder-[#082621]/50 focus:bg-white'
              }`}
            />
          </div>
        )}
      </div>

      {/* ── Playlist Tracks List with DJ Mix BPM & Key Match Columns ── */}
      <div className="mb-8">
        {filteredPlaylistTracks.length > 0 ? (
          <div className="space-y-1.5 sm:space-y-2">
            {/* Table Header */}
            <div className={`grid grid-cols-12 text-[9px] sm:text-[10px] font-mono font-black uppercase tracking-wider brutal-border p-1.5 sm:p-2.5 ${
              isDark ? 'bg-[#101716] text-zinc-300 border-zinc-700' : 'bg-[#ded2bb] text-[#082621] border-black'
            }`}>
              <span className="col-span-1 text-center flex items-center justify-center">
                {isSelectMode ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectAll();
                    }}
                    className="p-1 hover:text-[#17a398] cursor-pointer"
                    title={selectedTrackIds.size === filteredPlaylistTracks.length ? 'Deselect all' : 'Select all'}
                  >
                    {selectedTrackIds.size === filteredPlaylistTracks.length && filteredPlaylistTracks.length > 0 ? (
                      <CheckSquare size={14} className="text-[#17a398]" />
                    ) : (
                      <Square size={14} />
                    )}
                  </button>
                ) : (
                  '#'
                )}
              </span>
              <span className={isPlaylistMixActive ? "col-span-6 md:col-span-4" : "col-span-6 md:col-span-5"}>{isQuran ? (t?.('library.surahs') || (isRTL ? 'السور والتلاوات' : 'SURAH & RECITER')) : (t?.('library.titleHeader') || 'TITLE')}</span>
              {isPlaylistMixActive && (
                <>
                  <span className="hidden sm:block col-span-1 text-center text-emerald-400 font-mono font-bold">BPM</span>
                  <span className="hidden sm:block col-span-1 text-center text-emerald-400 font-mono font-bold">KEY</span>
                </>
              )}
              <span className="hidden md:block col-span-2">{isQuran ? (t?.('library.collectionHeader') || 'COLLECTION') : (t?.('library.albumHeader') || 'ALBUM')}</span>
              <span className="hidden lg:block col-span-2 font-mono text-zinc-400">{t?.('library.dateAddedHeader') || 'DATE ADDED'}</span>
              <span className={isPlaylistMixActive ? "col-span-5 md:col-span-1 text-right pr-2" : "col-span-5 md:col-span-2 text-right pr-2"}>{t?.('library.actionsHeader') || 'ACTIONS'}</span>
            </div>

            {filteredPlaylistTracks.slice(0, visibleLimit).map((track, i) => {
              const isSelected = selectedTrackIds.has(String(track.id || track._id));
              const isMixOn = isPlaylistMixActive;
              const musical = isMixOn ? getTrackMusicalData(track) : null;
              const camelotCol = isMixOn && musical ? getCamelotColor(musical.key) : null;

              return (
                <React.Fragment key={track.id || track._id || i}>
                  <div
                    draggable={Boolean(isOwner && !playlist?.isLikedSongs && !isSelectMode)}
                    onDragStart={(e) => {
                      if (!isOwner || playlist?.isLikedSongs || isSelectMode) return;
                      e.dataTransfer.setData('text/plain', String(i));
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggedTrackIdx(i);
                    }}
                    onDragOver={(e) => {
                      if (!isOwner || playlist?.isLikedSongs || isSelectMode) return;
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      if (dragOverTrackIdx !== i) {
                        setDragOverTrackIdx(i);
                      }
                    }}
                    onDragLeave={() => {
                      if (dragOverTrackIdx === i) setDragOverTrackIdx(null);
                    }}
                    onDrop={(e) => {
                      if (!isOwner || playlist?.isLikedSongs || isSelectMode) return;
                      e.preventDefault();
                      const raw = e.dataTransfer.getData('text/plain');
                      const fromIdx = raw ? parseInt(raw, 10) : draggedTrackIdx;
                      if (!isNaN(fromIdx) && fromIdx !== i) {
                        handleReorderTracks(fromIdx, i);
                      }
                      setDraggedTrackIdx(null);
                      setDragOverTrackIdx(null);
                    }}
                    onClick={() => {
                      if (isSelectMode) {
                        toggleTrackSelect(track.id || track._id);
                      } else {
                        handlePlayPlaylistTrack(track);
                      }
                    }}
                    className={`grid grid-cols-12 items-center p-2 sm:p-3 brutal-border brutal-shadow-sm hover:translate-x-1 transition-all cursor-pointer group ${
                      dragOverTrackIdx === i ? 'border-t-4 border-t-[#17a398]' : ''
                    } ${draggedTrackIdx === i ? 'opacity-40' : ''} ${
                      isSelected
                        ? isDark ? 'bg-[#17a398]/20 border-[#17a398]' : 'bg-[#17a398]/15 border-[#17a398]'
                        : isDark 
                          ? 'bg-[#141d1b] border-zinc-700 hover:bg-[#182320]' 
                          : 'bg-[#fdfbf7] border-black hover:bg-[#ede5d3]'
                    }`}
                  >
                    <span className={`col-span-1 text-xs font-mono font-black text-center flex items-center justify-center ${
                      isDark ? 'text-zinc-400' : 'text-[#082621]'
                    }`}>
                      {isSelectMode ? (
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTrackSelect(track.id || track._id);
                          }}
                          className={`w-5 h-5 rounded flex items-center justify-center brutal-border ${
                            isSelected ? 'bg-[#17a398] text-[#0b1110] border-black' : 'bg-transparent text-transparent border-zinc-500'
                          }`}
                        >
                          <Check size={13} strokeWidth={3} className={isSelected ? 'text-[#0b1110]' : 'opacity-0'} />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-0.5">
                          {isOwner && !playlist?.isLikedSongs && (
                            <GripVertical size={13} className="opacity-0 group-hover:opacity-60 hover:opacity-100 transition-opacity cursor-grab text-[#17a398]" />
                          )}
                          <span>{String(i + 1).padStart(2, '0')}</span>
                        </div>
                      )}
                    </span>
                    
                    {/* Title & Artist & DJ Transition Tag */}
                    <div className={`${isMixOn ? 'col-span-6 md:col-span-4' : 'col-span-6 md:col-span-5'} flex items-center gap-2 sm:gap-3 truncate pr-1 sm:pr-2`}>
                      <img 
                        src={normalizeCoverUrl(track.cover, track)} 
                        alt={track.title} 
                        className="w-10 h-10 sm:w-12 sm:h-12 brutal-border object-cover shrink-0 bg-[#ede5d3]" 
                        onError={handleCoverImageError}
                      />
                      <div className="truncate flex-1">
                        <h4 className={`text-xs sm:text-sm font-bold truncate group-hover:text-[#17a398] transition-colors ${
                          isDark ? 'text-white' : 'text-[#0b1110]'
                        }`}>
                          {track.title}
                        </h4>
                        <div className="flex items-center gap-2">
                          <ArtistLinks
                            track={track}
                            onSelectArtist={onSelectArtist}
                            className={`text-[11px] truncate font-medium ${
                              isDark ? 'text-zinc-400' : 'text-[#082621]/70'
                            }`}
                            linkClassName="hover:underline cursor-pointer"
                          />
                        </div>
                        {(isPlaylistMixActive || playlist?.isMix) && playlist?.name && (
                          <span className="text-[10px] text-emerald-400 font-bold block mt-0.5 truncate">
                            🎛️ {playlist.name}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Rivo BPM & Camelot Key Columns */}
                    {isMixOn && musical && (
                      <>
                        <div className="hidden sm:flex col-span-1 items-center justify-center font-mono text-[11px] text-zinc-300 font-bold">
                          {musical.bpm}
                        </div>
                        <div className="hidden sm:flex col-span-1 items-center justify-center font-mono text-[11px]">
                          <span 
                            className="px-1.5 py-0.5 rounded text-[10px] font-black border"
                            style={{ backgroundColor: camelotCol.bg, color: camelotCol.text, borderColor: camelotCol.border }}
                          >
                            {musical.key}
                          </span>
                        </div>
                      </>
                    )}

                    {/* Album */}
                    <div className="hidden md:block col-span-2 text-xs text-zinc-400 truncate pr-2 font-medium">
                      {track.album || playlist.name}
                    </div>

                    {/* Date added */}
                    <div className="hidden lg:block col-span-2 text-[11px] font-mono text-zinc-500 truncate">
                      {track.createdAt ? new Date(track.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Dec 31, 2025'}
                    </div>

                    {/* Action & Duration */}
                    <div className={`${isMixOn ? 'col-span-5 md:col-span-1' : 'col-span-5 md:col-span-2'} flex items-center justify-end gap-1 sm:gap-2 text-xs`}>
                      {/* Track download / cancel button */}
                      {isTrackDownloading?.(track.id || track._id) ? (
                        <div className="flex items-center gap-0.5 sm:gap-1">
                          <Loader2 size={14} className="animate-spin text-[#17a398]" title="Downloading song..." />
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelTrackDownload?.(track.id || track._id);
                            }}
                            className="p-1 text-red-500 hover:text-red-400 cursor-pointer rounded transition-colors"
                            title="Cancel download"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : isTrackQueued?.(track.id || track._id) ? (
                        <div className="flex items-center gap-0.5 sm:gap-1">
                          <span className="text-[9px] font-mono font-bold text-amber-500 bg-amber-500/10 px-1 py-0.5 rounded">Queued</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelTrackDownload?.(track.id || track._id);
                            }}
                            className="p-1 text-red-500 hover:text-red-400 cursor-pointer rounded transition-colors"
                            title="Cancel queued download"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : track.downloaded ? (
                        <span title="Downloaded offline" className="p-1 sm:p-1.5 text-emerald-500 flex items-center">
                          <CheckCircle2 size={14} />
                        </span>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            downloadTrack?.(track);
                          }}
                          className={`p-1 sm:p-1.5 transition-colors cursor-pointer rounded ${
                            isDark ? 'text-zinc-500 hover:text-[#17a398]' : 'text-zinc-400 hover:text-[#17a398]'
                          }`}
                          title="Download offline"
                        >
                          <Download size={14} />
                        </button>
                      )}

                      <span className="text-[11px] sm:text-xs font-mono text-zinc-400 mr-1 sm:mr-2">
                        {track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : '3:00'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(track.id || track._id);
                        }}
                        className={`p-1 sm:p-1.5 transition-colors cursor-pointer ${
                          isDark ? 'text-zinc-400 hover:text-[#dc2626]' : 'text-[#0b1110] hover:text-[#dc2626]'
                        }`}
                        title="Favorite"
                      >
                        <Heart 
                          size={15} 
                          className={
                            (likedTrackIds || []).some(id => String(id) === String(track?.id || track?._id)) || Boolean(track?.liked)
                              ? 'fill-[#dc2626] text-[#dc2626]' 
                              : ''
                          } 
                        />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActionMenuTrack(track);
                        }}
                        className={`p-1 sm:p-1.5 transition-colors cursor-pointer rounded-lg ${
                          isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-[#0b1110] hover:text-black hover:bg-[#ede5d3]'
                        }`}
                        title="Song Options"
                        aria-label="Song Options"
                      >
                        <MoreVertical size={16} />
                      </button>
                    </div>
                  </div>

                  {/* ── Rivo Mixed Playlists Transition Chip ── */}
                  {isMixOn && i < filteredPlaylistTracks.length - 1 && (() => {
                    const nextTrack = filteredPlaylistTracks[i + 1];
                    const tAId = String(track.id || track._id || '');
                    const tBId = String(nextTrack.id || nextTrack._id || '');
                    const pairKey = `${tAId}___${tBId}`;
                    const pairKeyAlt = `${tAId}_${tBId}`;
                    const trans = transitions[pairKey] || transitions[pairKeyAlt] || { style: 'auto', duration: 8, bars: 4 };
                    const mA = musical;
                    const mB = getTrackMusicalData(nextTrack);
                    const compat = checkHarmonicCompatibility(mA.key, mB.key, mA.bpm, mB.bpm);

                    const styleLabel = trans.style === 'rise' ? '⚡ Rise' :
                                       trans.style === 'blend' || trans.style === 'bass_swap' ? '🌊 Blend' :
                                       trans.style === 'wave' ? '〰️ Wave' :
                                       trans.style === 'melt' ? '🧊 Melt' :
                                       trans.style === 'slam' ? '💥 Slam' :
                                       trans.style === 'fade' || trans.style === 'equal_power' ? '🎚️ Fade' :
                                       trans.style === 'cut' ? '✂️ Cut' :
                                       trans.style === 'custom' ? '🎛️ Custom' : '✨ Auto';

                    const lengthLabel = trans.bars ? `${trans.bars} bars` : `${trans.duration || 8}s`;
                    const cueLabel = trans.mixOutPoint ? ` • at ${Math.floor(trans.mixOutPoint / 60)}:${String(trans.mixOutPoint % 60).padStart(2, '0')}` : '';

                    return (
                      <div className="py-1 px-2 flex items-center justify-center relative my-0.5 group/trans">
                        <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-[1px] border-t border-dashed border-zinc-700/60 group-hover/trans:border-[#17a398]/60 transition-colors pointer-events-none" />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMixerPair({ trackA: track, trackB: nextTrack, pairKey });
                          }}
                          className={`relative z-10 px-3 py-1 rounded-full text-[10px] font-mono font-black border brutal-shadow-sm flex items-center gap-1.5 transition-all cursor-pointer hover:scale-105 ${
                            isDark 
                              ? 'bg-[#101716] hover:bg-[#182320] text-zinc-200 border-zinc-700 hover:border-[#17a398]' 
                              : 'bg-white hover:bg-[#ede5d3] text-[#0b1110] border-black hover:border-[#17a398]'
                          }`}
                          title={`Click to customize transition between "${track.title}" and "${nextTrack.title}"`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: compat.color || '#10b981' }} />
                          <span>{styleLabel}</span>
                          <span className="text-zinc-500">•</span>
                          <span className="text-zinc-400">{lengthLabel}{cueLabel}</span>
                        </button>
                      </div>
                    );
                  })()}
                </React.Fragment>
              );
            })}

            {filteredPlaylistTracks.length > visibleLimit && (
              <div className="pt-4 pb-8 flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleLimit(prev => prev + 60)}
                  className="px-6 py-2.5 rounded-xl brutal-border font-mono text-xs font-black uppercase bg-[#17a398] text-[#0b1110] hover:bg-[#26c4b7] transition-all brutal-shadow-sm cursor-pointer"
                >
                  {isRTL ? 'عرض المزيد من المقاطع' : 'Load More Tracks'} ({filteredPlaylistTracks.length - visibleLimit} {isRTL ? 'متبقية' : 'remaining'})
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className={`text-center py-12 brutal-border-thick brutal-shadow p-8 ${
            isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#082621]'
          }`}>
            {playlist.isLikedSongs ? (
              <Heart size={40} className="mx-auto text-[#dc2626] mb-3 opacity-80" />
            ) : (
              <Music size={40} className={`mx-auto mb-3 opacity-60 ${isDark ? 'text-zinc-400' : 'text-[#082621]'}`} />
            )}
            <h3 className="text-lg font-mono font-black uppercase">
              {playlist.isLikedSongs ? (isQuran ? 'NO FAVORITE SURAHS YET' : 'NO LIKED SONGS YET') : (isQuran ? 'NO SURAHS IN THIS PLAYLIST' : 'NO SONGS IN THIS PLAYLIST')}
            </h3>
            <p className={`text-xs mt-1 font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/80'}`}>
              {playlist.isLikedSongs 
                ? (isQuran ? 'Tap the heart icon on any surah to add it to your Favorite Surahs.' : 'Tap the heart icon on any song to add it to your Liked Songs.') 
                : (isQuran ? 'Add surahs from your library below to build your playlist.' : 'Add tracks from your library below to build your playlist.')}
            </p>
          </div>
        )}
      </div>

      {/* ── AI Smart Suggestions / Enhance Playlist Section ── */}
      {!playlist.isLikedSongs && playlistTracks.length > 0 && (
        <section className="bg-[#082621] text-[#fdfbf7] brutal-border-thick brutal-shadow-lg p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#26c4b7]/30">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-[#f59e0b]" />
                <h3 className="text-lg font-mono font-black uppercase text-[#26c4b7]">
                  AI RECOMMENDATIONS FOR "{playlist.name}"
                </h3>
              </div>
              <p className="text-xs text-[#ded2bb] mt-0.5">Matching tracks suggested based on this playlist</p>
            </div>
            <button
              onClick={handleFetchAiRecommendations}
              disabled={isLoadingRecs}
              className="brutal-btn flex items-center gap-2 px-4 py-2 bg-[#26c4b7] hover:bg-[#17a398] text-[#082621] text-xs font-mono font-black uppercase brutal-border brutal-shadow-sm cursor-pointer"
            >
              {isLoadingRecs ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              <span>{aiRecommendations.length > 0 ? 'REFRESH RECOMMENDATIONS' : 'GET AI RECOMMENDATIONS ✨'}</span>
            </button>
          </div>

          {aiRecommendations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {aiRecommendations.map((rec) => (
                <div
                  key={rec.id}
                  className={`flex items-center justify-between p-3 brutal-border ${
                    isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
                  }`}
                >
                  <div 
                    onClick={() => handlePlayPlaylistTrack(rec)}
                    className="flex items-center gap-3 flex-1 truncate cursor-pointer"
                  >
                    <img src={normalizeCoverUrl(rec.cover, rec)} alt={rec.title} className="w-11 h-11 brutal-border object-cover shrink-0" onError={handleCoverImageError} />
                    <div className="truncate">
                      <h4 className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>{rec.title}</h4>
                      <p className={`text-[11px] truncate ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>{rec.artist}</p>
                      {rec.aiReason && (
                        <span className="text-[9px] font-mono font-bold text-[#17a398]">{rec.aiReason}</span>
                      )}
                    </div>
                  </div>
                  {isOwner && (
                    <button
                      onClick={() => handleAddTrackWithCheck(rec)}
                      className="brutal-btn px-3 py-1.5 bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] font-mono text-[11px] font-black uppercase brutal-border brutal-shadow-sm flex items-center gap-1 shrink-0 ml-2 cursor-pointer"
                      title="Add to playlist"
                    >
                      <Plus size={14} />
                      <span>ADD</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className={`text-center py-6 text-xs font-mono ${isDark ? 'text-zinc-400' : 'text-[#ded2bb]'}`}>
              Click "GET AI RECOMMENDATIONS" to retrieve matching tracks for this playlist.
            </div>
          )}
        </section>
      )}

      {/* ── Add Songs from Available Library Section (Owner Only) ── */}
      {!playlist.isLikedSongs && isOwner && availableTracks.length > 0 && (
        <section className={`brutal-border-thick brutal-shadow-lg p-6 ${
          isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-[#0b1110] text-[#082621]'
        }`}>
          <div className={`mb-4 pb-3 border-b-2 ${
            isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110] text-[#082621]'
          } flex flex-col sm:flex-row sm:items-center justify-between gap-2`}>
            <div>
              <h3 className={`text-sm font-mono font-black uppercase ${
                isDark ? 'text-white' : 'text-[#082621]'
              }`}>
                {isQuran ? 'ADD SURAHS FROM YOUR LIBRARY' : 'ADD TRACKS FROM YOUR LIBRARY'}
              </h3>
              <p className={`text-[11px] font-sans ${
                isDark ? 'text-zinc-400' : 'text-[#082621]/70'
              }`}>
                {isQuran ? 'Click ADD to append these surahs to this collection' : 'Click ADD to append these tracks to this playlist'}
              </p>
            </div>
            <div className="relative w-full sm:w-56">
              <input
                type="text"
                value={availableSearch}
                onChange={(e) => setAvailableSearch(e.target.value)}
                placeholder="Filter tracks to add..."
                className={`w-full text-xs font-mono px-3 py-1.5 rounded-lg brutal-border focus:outline-none ${
                  isDark ? 'bg-[#0b1110] text-white border-zinc-700' : 'bg-[#ede5d3] text-[#0b1110] border-black'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            {availableTracks.slice(0, availableLimit).map(track => (
              <div
                key={track.id}
                className={`flex items-center justify-between p-2.5 brutal-border transition-colors ${
                  isDark ? 'bg-[#182320] border-zinc-700 text-white hover:bg-[#22332e]' : 'bg-[#ede5d3] border-black hover:bg-white text-[#0b1110]'
                }`}
              >
                <div 
                  onClick={() => onSelectTrack(track)}
                  className="flex items-center gap-3 flex-1 truncate cursor-pointer"
                >
                  <img src={normalizeCoverUrl(track.cover, track)} alt={track.title} className="w-10 h-10 brutal-border object-cover shrink-0" onError={handleCoverImageError} />
                  <div className="truncate">
                    <h4 className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>{track.title}</h4>
                    <p className={`text-[11px] truncate ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>{track.artist} • {track.album}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleAddTrackWithCheck(track)}
                  className="brutal-btn px-3 py-1 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm flex items-center gap-1 shrink-0 ml-2 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>ADD</span>
                </button>
              </div>
            ))}
          </div>

          {availableTracks.length > availableLimit && (
            <div className="mt-3 text-center">
              <button
                onClick={() => setAvailableLimit(prev => prev + 30)}
                className={`px-4 py-2 text-xs font-mono font-bold brutal-border brutal-shadow-sm rounded-lg transition-colors ${
                  isDark ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border-zinc-700' : 'bg-[#ede5d3] text-[#0b1110] hover:bg-white border-black'
                }`}
              >
                SHOW MORE ({availableTracks.length - availableLimit} REMAINING)
              </button>
            </div>
          )}
        </section>
      )}


      {/* Duplicate Track Confirmation Modal */}
      {duplicateConfirmTrack && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 select-none">
          <div className={`${isDark ? 'bg-[#111a18] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-[#0b1110] text-[#082621]'} brutal-border-thick brutal-shadow-lg p-6 w-full max-w-sm relative`}>
            <div className={`flex items-center justify-between pb-3 border-b-2 ${isDark ? 'border-zinc-700' : 'border-[#0b1110]'}`}>
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                <h3 className={`text-base font-mono font-black uppercase ${isDark ? 'text-white' : 'text-[#082621]'}`}>Already in Playlist</h3>
              </div>
              <button 
                onClick={() => setDuplicateConfirmTrack(null)} 
                className={`brutal-btn p-1 brutal-border ${isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700' : 'bg-[#ede5d3] text-[#0b1110] border-black hover:bg-[#ded2bb]'}`}
              >
                <X size={16} />
              </button>
            </div>

            <div className="my-4 text-center">
              <p className={`text-xs font-mono font-bold ${isDark ? 'text-zinc-200' : 'text-[#082621]'}`}>
                "<span className="font-black">{duplicateConfirmTrack.title}</span>" is already in this playlist.
              </p>
              <p className={`text-[11px] font-sans mt-1 ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                Do you want to add it again?
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onAddTrackToPlaylist(duplicateConfirmTrack.id || duplicateConfirmTrack._id, playlist.id, true);
                  setDuplicateConfirmTrack(null);
                }}
                className="flex-1 py-2.5 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={14} strokeWidth={3} />
                <span>Add Again</span>
              </button>

              <button
                type="button"
                onClick={() => setDuplicateConfirmTrack(null)}
                className={`flex-1 py-2.5 font-mono text-xs font-black uppercase brutal-border cursor-pointer flex items-center justify-center ${isDark ? 'bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black hover:bg-[#ded2bb]'}`}
              >
                <span>Cancel</span>
              </button>
            </div>

            <div className="text-center pt-3">
              <button
                type="button"
                onClick={() => {
                  onRemoveTrackFromPlaylist?.(duplicateConfirmTrack.id || duplicateConfirmTrack._id, playlist.id);
                  setDuplicateConfirmTrack(null);
                }}
                className="text-[11px] font-mono font-bold text-[#dc2626] hover:text-red-400 hover:underline cursor-pointer bg-transparent border-0 inline-block p-1"
              >
                Remove from playlist
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeleteAlbumModalOpen && (
        <DeleteAlbumModal
          isOpen={isDeleteAlbumModalOpen}
          onClose={() => setIsDeleteAlbumModalOpen(false)}
          album={playlist}
          tracksCount={playlistTracks.length || (playlist?.trackIds || []).length}
          onConfirm={handleConfirmDeleteAlbum}
          globalTheme={globalTheme}
        />
      )}

      {actionMenuTrack && (
        <TrackActionMenuModal
          isOpen={Boolean(actionMenuTrack)}
          onClose={() => setActionMenuTrack(null)}
          track={actionMenuTrack}
          playlist={playlist}
          onPlayTrack={handlePlayPlaylistTrack}
          onAddToQueue={addToQueue}
          openAddToPlaylist={openAddToPlaylist}
          onRemoveTrackFromPlaylist={isOwner ? onRemoveTrackFromPlaylist : undefined}
          openEditSongModal={openEditSongModal}
          onDeleteTrack={onDeleteTrack}
          currentUser={currentUser}
          globalTheme={globalTheme}
        />
      )}

      {/* ── Tactical Multi-Select Bottom Action Deck ── */}
      {isSelectMode && (
        <div className={`fixed ${currentTrack ? 'bottom-[126px] md:bottom-24' : 'bottom-16 md:bottom-20'} left-1/2 -translate-x-1/2 z-50 px-3 sm:px-4 py-2.5 sm:py-3 rounded-2xl brutal-border-thick brutal-shadow-xl flex items-center gap-2 sm:gap-3 flex-wrap max-w-[95vw] sm:max-w-2xl transition-all ${
          isDark ? 'bg-[#0e1715] border-[#17a398] text-white' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
        }`}>
          <div className="flex items-center gap-2 pr-2 border-r border-[#17a398]/30">
            <span className="font-mono text-xs font-black bg-[#17a398] text-[#0b1110] px-2 py-0.5 rounded-full">
              {selectedTrackIds.size}
            </span>
            <span className="font-display font-black text-xs hidden sm:inline">{t?.('library.selected') || (isRTL ? 'محدد' : 'Selected')}</span>
          </div>

          {/* Select All / Deselect All */}
          <button
            onClick={handleSelectAll}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold brutal-border cursor-pointer transition ${
              isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200' : 'bg-[#ede5d3] hover:bg-[#ded2bb] text-[#0b1110]'
            }`}
          >
            {selectedTrackIds.size === filteredPlaylistTracks.length ? (t?.('common.deselectAll') || 'Deselect All') : (t?.('common.selectAll') || 'Select All')}
          </button>

          {/* Add to Queue */}
          <button
            disabled={selectedTrackIds.size === 0}
            onClick={handleBatchQueue}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#082621] text-[#26c4b7] hover:bg-[#0b1110] text-xs font-mono font-black uppercase brutal-border disabled:opacity-40 cursor-pointer"
            title={isRTL ? "إضافة المقاطع المحددة إلى قائمة الانتظار" : "Add selected tracks to queue"}
          >
            <ListPlus size={14} />
            <span className="hidden sm:inline">{t?.('common.queue') || 'Queue'}</span>
          </button>

          {/* Add to Playlist */}
          <button
            disabled={selectedTrackIds.size === 0}
            onClick={handleBatchPlaylist}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#17a398] text-[#0b1110] hover:bg-[#26c4b7] text-xs font-mono font-black uppercase brutal-border disabled:opacity-40 cursor-pointer"
            title={isRTL ? "إضافة المقاطع المحددة إلى قائمة تشغيل" : "Add selected tracks to a playlist"}
          >
            <FolderPlus size={14} strokeWidth={2.5} />
            <span className="hidden sm:inline">{t?.('library.playlist') || 'Playlist'}</span>
          </button>

          {/* Download */}
          <button
            disabled={selectedTrackIds.size === 0}
            onClick={handleBatchDownload}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-black uppercase brutal-border disabled:opacity-40 cursor-pointer ${
              isDark ? 'bg-zinc-800 text-teal-400 hover:bg-zinc-700' : 'bg-white text-teal-700 hover:bg-[#ede5d3]'
            }`}
            title={isRTL ? "تحميل المقاطع المحددة بدون إنترنت" : "Download selected tracks offline"}
          >
            <Download size={14} />
            <span className="hidden sm:inline">{isRTL ? 'تحميل' : 'Download'}</span>
          </button>

          {/* Delete / Remove (if allowed) */}
          {(isOwner || playlist.isLikedSongs || isUserPlaylist) && (
            <button
              disabled={selectedTrackIds.size === 0}
              onClick={handleBatchDelete}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-500 hover:bg-red-500/30 text-xs font-mono font-black uppercase brutal-border disabled:opacity-40 cursor-pointer"
              title={isRTL ? "إزالة المقاطع المحددة" : "Remove selected tracks"}
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">{t?.('common.remove') || 'Remove'}</span>
            </button>
          )}

          {/* Close */}
          <button
            onClick={() => {
              setIsSelectMode(false);
              setSelectedTrackIds(new Set());
            }}
            className="p-1.5 rounded-lg hover:bg-zinc-500/20 cursor-pointer ml-auto"
            title="Exit select mode"
          >
            <X size={16} />
          </button>
        </div>
      )}

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        playlist={playlist}
        allTracks={tracks}
        globalTheme={globalTheme}
      />

      {activeMixerPair && (
        <MiniMixerModal
          isOpen={Boolean(activeMixerPair)}
          onClose={() => setActiveMixerPair(null)}
          trackA={activeMixerPair.trackA}
          trackB={activeMixerPair.trackB}
          initialTransition={
            transitions[activeMixerPair.pairKey] ||
            transitions[`${activeMixerPair.trackA.id || activeMixerPair.trackA._id}_${activeMixerPair.trackB.id || activeMixerPair.trackB._id}`]
          }
          onSaveTransition={handleSaveTransitionSettings}
        />
      )}

      <MixDownloadGate
        isOpen={showMixGate}
        onClose={() => { setShowMixGate(false); setPendingMixTrack(null); }}
        playlist={playlist}
        tracks={playlistTracks}
        onDownloadAndMix={handleConfirmDownloadAndMix}
        onPlayWithoutMix={handlePlayWithoutMixMode}
        globalTheme={globalTheme}
      />
      </div>
    </div>
  );
}
