import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, Heart, Plus, Minus, Search, ArrowLeft, Music, SlidersHorizontal, 
  Camera, Globe, Lock, Edit2, Loader2, Check, Trash2, X, Sliders, Wand2, 
  Sparkles, RefreshCw, Zap, Disc, ArrowRight, AlertTriangle
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import MiniMixerModal from '../components/MiniMixerModal';
import { getTrackMusicalData, checkHarmonicCompatibility, getRecommendedTransition } from '../utils/musicAnalysis';
import { useAudioPlayer } from '../context/AudioContext';
import { ArtistLinks } from '../utils/artistUtils';
import { isUserAdmin } from '../utils/adminUtils';
import { isQuranContent } from '../utils/quranUtils';
import DeleteAlbumModal from '../components/DeleteAlbumModal';

export default function PlaylistScreen({ 
  playlist, 
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
  onDeleteAlbum,
  onTogglePlaylistVisibility = () => {},
  onSavePlaylist,
  onUnsavePlaylist,
  userPlaylists = [],
  onSelectArtist,
  openEditSongModal,
  openEditAlbumModal,
  globalTheme = 'dark',
}) {
  const isDark = globalTheme === 'dark';
  const { isMixMode, setIsMixMode, activeTransitions, setActiveTransitions, currentQueue, setCurrentQueue } = useAudioPlayer();
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdatingCover, setIsUpdatingCover] = useState(false);
  const [isTogglingPrivacy, setIsTogglingPrivacy] = useState(false);
  const [fetchedTracks, setFetchedTracks] = useState([]);

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
  const isOwner = Boolean(
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

  // Spotify Mix & DJ Transitions State
  const [isMixActive, setIsMixActive] = useState(Boolean(playlist?.isMix));
  const [transitions, setTransitions] = useState(playlist?.transitions || {});
  const [activeMixerPair, setActiveMixerPair] = useState(null); // { trackA, trackB, pairKey }
  const [isAutoMixingAll, setIsAutoMixingAll] = useState(false);

  // Duplicate Track Confirmation State
  const [duplicateConfirmTrack, setDuplicateConfirmTrack] = useState(null);
  const [isDeleteAlbumModalOpen, setIsDeleteAlbumModalOpen] = useState(false);

  const handleAddTrackWithCheck = (trackToAdd) => {
    if (!trackToAdd) return;
    const trackIdStr = String(trackToAdd.id || trackToAdd._id);
    const alreadyInPlaylist = (playlist?.trackIds || []).map(String).includes(trackIdStr);
    if (alreadyInPlaylist) {
      setDuplicateConfirmTrack(trackToAdd);
    } else {
      onAddTrackToPlaylist(trackIdStr, playlist.id || playlist._id, false);
    }
  };

  // AI Smart Recommendations State
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [isLoadingRecs, setIsLoadingRecs] = useState(false);

  // Edit Name & Description Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState(playlist?.name || '');
  const [editDesc, setEditDesc] = useState(playlist?.description || '');
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (playlist) {
      setEditName(playlist.name || '');
      setEditDesc(playlist.description || '');
      const mixOn = Boolean(playlist.isMix);
      setIsMixActive(mixOn);
      const t = playlist.transitions || {};
      setTransitions(t);
    }
  }, [playlist?.id, playlist?.isMix]);

  const playlistTrackIds = (playlist?.trackIds || []).map(String);

  // Dynamically fetch any tracks in playlist that are missing from global tracks state
  useEffect(() => {
    if (!playlist || !playlist.trackIds || playlist.trackIds.length === 0) {
      setFetchedTracks([]);
      return;
    }
    const knownIds = new Set(tracks.map(t => String(t.id || t._id)));
    const missing = playlist.trackIds.map(String).filter(id => !knownIds.has(id));

    if (missing.length > 0) {
      fetch(`${API_BASE_URL}/api/tracks/by-ids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  if (!playlist) return null;

  const allAvailable = [...tracks, ...fetchedTracks];
  const trackMap = new Map(allAvailable.map(t => [String(t.id || t._id), t]));

  const isLikedPlaylist = Boolean(playlist.isLikedSongs || playlist.id === 'liked');

  // Preserve EXACT track order as stored in playlist.trackIds, or strictly filter liked tracks for Liked Songs
  const playlistTracks = useMemo(() => {
    if (!isLikedPlaylist) {
      return playlistTrackIds.map(id => trackMap.get(id)).filter(Boolean);
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

    return result;
  }, [isLikedPlaylist, JSON.stringify(playlistTrackIds), JSON.stringify(likedTrackIds || []), allAvailable]);

  const isQuran = Boolean(
    playlist?.isQuran ||
    isQuranContent(playlist) ||
    (playlistTracks.length > 0 && playlistTracks.some(isQuranContent))
  );

  const availableTracks = isLikedPlaylist ? [] : tracks.filter((t) => !playlistTrackIds.includes(String(t.id || t._id)));

  const filteredPlaylistTracks = playlistTracks.filter((t) => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Auto-fetch AI recommendations on load if playlist has tracks
  useEffect(() => {
    if (!playlist?.isLikedSongs && playlistTracks.length > 0 && aiRecommendations.length === 0 && !isLoadingRecs) {
      handleFetchAiRecommendations();
    }
  }, [playlist?.id, playlistTracks.length]);

  const formatDurationSum = () => {
    const totalSecs = playlistTracks.reduce((acc, t) => acc + (t.duration || 180), 0);
    const mins = Math.floor(totalSecs / 60);
    return `${mins} min`;
  };

  const isMixView = playlist.isMix || playlist.name.toUpperCase().includes('MIX');
  const isPublic = playlist.isPublic !== false;

  const handleCoverUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUpdatingCover(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      onUpdatePlaylist({ ...playlist, cover: reader.result });
      setIsUpdatingCover(false);
    };
    reader.readAsDataURL(file);
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

  const handleToggleMix = async () => {
    const nextState = !isMixActive;
    setIsMixActive(nextState);
    setIsMixMode?.(nextState);
    if (nextState) {
      setActiveTransitions?.(transitions);
    }

    try {
      const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
      await fetch(`${API_BASE_URL}/api/playlists/${playlist.id}/transitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ isMix: nextState, transitions })
      });
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
      updatedTransitions[pairKey] = {
        style: rec.style,
        duration: rec.duration,
        autoMatchBpm: true
      };
    }

    setTransitions(updatedTransitions);
    setActiveTransitions?.(updatedTransitions);
    setIsMixActive(true);
    setIsMixMode?.(true);

    try {
      localStorage.setItem('rivo_active_transitions', JSON.stringify(updatedTransitions));
      localStorage.setItem('liofy_active_transitions', JSON.stringify(updatedTransitions));
    } catch {}

    try {
      const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
      await fetch(`${API_BASE_URL}/api/playlists/${playlist.id}/transitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ isMix: true, transitions: updatedTransitions })
      });
    } catch {}
    setTimeout(() => setIsAutoMixingAll(false), 500);
  };

  const handleSaveTransitionSettings = async (settings) => {
    if (!activeMixerPair) return;
    const { pairKey } = activeMixerPair;
    const updated = { ...transitions, [pairKey]: settings };
    setTransitions(updated);
    setActiveTransitions?.(updated);
    setIsMixActive(true);
    setIsMixMode?.(true);

    try {
      localStorage.setItem('rivo_active_transitions', JSON.stringify(updated));
      localStorage.setItem('liofy_active_transitions', JSON.stringify(updated));
    } catch {}

    try {
      const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
      await fetch(`${API_BASE_URL}/api/playlists/${playlist.id}/transitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ isMix: true, transitions: updated })
      });
    } catch {}
  };

  const handleFetchAiRecommendations = async () => {
    if (isLoadingRecs) return;
    setIsLoadingRecs(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playlistName: playlist?.name || 'Playlist',
          seedTracks: playlistTracks.slice(0, 6)
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
        setAiRecommendations(data.recommendations);
        // Automatically add the recommendations to active playback queue
        if (setCurrentQueue) {
          setCurrentQueue(prev => {
            const currentList = Array.isArray(prev) ? prev : [];
            const existingIds = new Set(currentList.map(t => String(t.id || t._id)));
            const newRecs = data.recommendations.filter(t => !existingIds.has(String(t.id || t._id)));
            return [...currentList, ...newRecs];
          });
        }
      }
    } catch (err) {
      console.warn('AI recommendations error:', err);
    }
    setIsLoadingRecs(false);
  };

  const handleSaveDetails = () => {
    if (!editName.trim()) return;
    onUpdatePlaylist({
      ...playlist,
      name: editName.trim(),
      description: editDesc.trim(),
    });
    setIsEditModalOpen(false);
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

  const handlePlayPlaylistTrack = (track) => {
    const baseQueue = filteredPlaylistTracks;
    const existingIds = new Set(baseQueue.map(t => String(t.id || t._id)));
    const extraRecs = aiRecommendations.filter(r => !existingIds.has(String(r.id || r._id)));
    const fullQueue = [...baseQueue, ...extraRecs];
    onSelectTrack(track, fullQueue);
  };

  return (
    <div className={`flex-1 overflow-y-auto pb-32 select-none p-4 md:p-8 transition-colors ${
      isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'
    }`}>
      {/* ── Apothecary Playlist Master Header ── */}
      <div className={`brutal-border-thick brutal-shadow-lg p-6 md:p-8 mb-8 relative transition-colors ${
        isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#082621]'
      }`}>
        {/* Back button */}
        <button 
          onClick={onBack}
          className={`absolute top-4 left-4 brutal-btn p-2 brutal-border brutal-shadow-sm z-20 flex items-center gap-1 text-xs font-mono font-black uppercase ${
            isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700' : 'bg-[#fdfbf7] hover:bg-[#ede5d3] text-[#0b1110] border-black'
          }`}
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Return</span>
        </button>

        {/* Top vintage stamp */}
        <div className="flex justify-end items-center mb-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1 brutal-border text-[10px] font-mono font-black uppercase ${
            isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
          }`}>
            <span>OFFICIAL AUDIO PRESCRIPTION</span>
            <span>•</span>
            <span>BATCH #{String(playlist.id || '99').slice(-4)}</span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 pt-2">
          {/* Cover Art (With Upload Overlay for Custom Playlists) */}
          <div className="w-44 h-44 md:w-52 md:h-52 bg-[#ded2bb] brutal-border-thick brutal-shadow shrink-0 relative group overflow-hidden">
            {playlist.isLikedSongs ? (
              <div className="w-full h-full bg-[#dc2626] flex flex-col items-center justify-center text-[#fdfbf7] p-4 text-center">
                <Heart size={64} fill="#fdfbf7" />
                <span className="font-mono text-xs font-black uppercase tracking-widest mt-2">{isQuran ? 'FAVORITE SURAHS' : 'LIKED SONGS'}</span>
              </div>
            ) : (
              <>
                <img 
                  src={playlist.cover || `https://ui-avatars.com/api/?name=${encodeURIComponent(playlist.name)}&background=082621&color=26c4b7&size=512&bold=true&format=svg`} 
                  alt={playlist.name} 
                  className="w-full h-full object-cover" 
                />
                {isOwner && (
                  <label className="absolute inset-0 bg-[#082621]/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 cursor-pointer text-[#26c4b7]">
                    {isUpdatingCover ? (
                      <Loader2 size={24} className="animate-spin text-white" />
                    ) : (
                      <>
                        <Camera size={28} />
                        <span className="text-xs font-mono font-black uppercase text-white">CHANGE COVER</span>
                      </>
                    )}
                    <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
                  </label>
                )}
              </>
            )}
            {/* Corner retro badge */}
            <div className="absolute top-0 right-0 bg-[#0b1110] text-[#26c4b7] text-[9px] font-mono font-black px-1.5 py-0.5">
              RIVO-TAPE
            </div>
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2 flex-wrap">
              <span className="bg-[#082621] text-[#26c4b7] text-[10px] font-mono font-black uppercase px-2.5 py-1 brutal-border">
                {isSiteAlbum ? (isQuran ? 'SURAH COLLECTION' : 'OFFICIAL ALBUM') : playlist.isLikedSongs ? (isQuran ? 'FAVORITE SURAHS' : 'LIKED SONGS') : (isQuran ? 'QURAN PLAYLIST' : 'PLAYLIST')}
              </span>

              {/* Public/Private Badge & Action Buttons (Hidden for Site Albums) */}
              {!playlist.isLikedSongs && !isSiteAlbum && (
                isOwner ? (
                  <>
                    <button
                      onClick={handleTogglePrivacy}
                      disabled={isTogglingPrivacy}
                      className={`brutal-btn flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono font-black uppercase brutal-border brutal-shadow-sm ${
                        isPublic 
                          ? 'bg-[#26c4b7] text-[#082621]' 
                          : 'bg-[#f59e0b] text-[#082621]'
                      }`}
                      title="Tap to toggle profile visibility"
                    >
                      {isTogglingPrivacy ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : isPublic ? (
                        <><Globe size={12} /><span>PUBLIC ARCHIVE</span></>
                      ) : (
                        <><Lock size={12} /><span>PRIVATE DISPENSE</span></>
                      )}
                    </button>

                    {/* Edit Button */}
                    <button
                      onClick={() => {
                        if (isSiteAlbum && openEditAlbumModal) {
                          openEditAlbumModal(playlist);
                        } else {
                          setIsEditModalOpen(true);
                        }
                      }}
                      className={`brutal-btn flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono font-black uppercase brutal-border brutal-shadow-sm ${
                        isDark ? 'bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700' : 'bg-[#ede5d3] text-[#0b1110] border-black hover:bg-[#ded2bb]'
                      }`}
                      title={isSiteAlbum ? "Admin: Edit Album" : "Edit name & description"}
                    >
                      <Edit2 size={12} />
                      <span>{isSiteAlbum ? "EDIT ALBUM" : "EDIT RECORD"}</span>
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={handleDelete}
                      disabled={isDeleting}
                      className="brutal-btn flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono font-black uppercase bg-red-100 text-[#dc2626] brutal-border brutal-shadow-sm hover:bg-red-200 cursor-pointer"
                      title={isSiteAlbum || playlist?.isAlbum ? "Delete album and all its tracks" : "Delete playlist"}
                    >
                      <Trash2 size={12} />
                      <span>DISCARD</span>
                    </button>
                  </>
                ) : (
                  <span className={`flex items-center gap-1.5 px-3 py-1 text-[11px] font-mono font-black uppercase brutal-border ${
                    isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#0b1110] border-black'
                  }`}>
                    {isPublic ? <Globe size={12} /> : <Lock size={12} />}
                    <span>{isPublic ? 'PUBLIC RECORD' : 'CONFIDENTIAL'}</span>
                  </span>
                )
              )}
            </div>

            <div className="flex items-center justify-center md:justify-start gap-3">
              <h1 className={`text-3xl md:text-5xl font-display font-black tracking-tight leading-tight ${
                isDark ? 'text-white' : 'text-[#082621]'
              }`}>
                {playlist.name}
              </h1>
              {!playlist.isLikedSongs && isOwner && (
                <button
                  onClick={() => {
                    if (isSiteAlbum && openEditAlbumModal) {
                      openEditAlbumModal(playlist);
                    } else {
                      setIsEditModalOpen(true);
                    }
                  }}
                  className={`p-1.5 transition-colors cursor-pointer ${
                    isDark ? 'text-zinc-400 hover:text-white' : 'text-[#0b1110] hover:text-[#17a398]'
                  }`}
                  title={isSiteAlbum ? "Admin: Edit Album" : "Edit playlist name"}
                >
                  <Edit2 size={20} />
                </button>
              )}
            </div>

            {isSiteAlbum && playlist.artist && (
              <div className="mt-1 text-xs font-mono font-bold flex items-center justify-center md:justify-start gap-1">
                <span className={isDark ? 'text-zinc-400' : 'text-[#082621]/70'}>{isQuran ? 'Recitations by' : 'Album by'}</span>
                <ArtistLinks
                  artist={playlist.artist}
                  onSelectArtist={onSelectArtist}
                  className="text-[#17a398] font-black uppercase inline-block"
                  linkClassName="hover:underline cursor-pointer"
                />
              </div>
            )}

            <p className={`text-sm sm:text-base md:text-lg mt-2.5 font-sans font-normal leading-relaxed max-w-2xl ${
              isDark ? 'text-zinc-200' : 'text-[#082621]'
            }`}>
              {playlist.description || (isSiteAlbum ? (isQuran ? `Recitations by ${playlist.artist || 'Reciter'}` : `Official album by ${playlist.artist || 'Artist'}`) : (isQuran ? 'Quran playlist on Rivo.' : 'Custom playlist on Rivo.'))}
            </p>

            <div className={`flex items-center justify-center md:justify-start gap-3 mt-4 pt-3 border-t text-xs font-mono font-bold ${
              isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110]/15 text-[#082621]'
            }`}>
              <span className={`px-2 py-0.5 brutal-border ${
                isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] border-black'
              }`}>{isSiteAlbum ? (isQuran ? 'COLLECTION' : 'ALBUM') : (isQuran ? 'QURAN' : 'PLAYLIST')}</span>
              <span>•</span>
              <span>{playlistTracks.length} {isQuran ? (playlistTracks.length === 1 ? 'SURAH' : 'SURAHS') : (playlistTracks.length === 1 ? 'TRACK' : 'TRACKS')}</span>
              <span>•</span>
              <span>{formatDurationSum()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Edit Playlist Modal ── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg p-6 w-full max-w-md relative">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 text-[#0b1110] hover:bg-[#ede5d3] p-1 brutal-border"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-[#0b1110]">
              <div className="w-3 h-3 bg-[#17a398] brutal-border" />
              <h3 className="text-lg font-mono font-black uppercase text-[#082621]">{isQuran ? 'Edit Quran Playlist Details' : 'Edit Playlist Details'}</h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-black uppercase text-[#082621] mb-1">{isQuran ? 'Collection / Playlist Name' : 'Playlist Name'}</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#ede5d3] brutal-border px-3 py-2 text-sm text-[#0b1110] font-sans font-bold focus:outline-none focus:bg-white"
                  placeholder={isQuran ? "Collection name..." : "Playlist name..."}
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-black uppercase text-[#082621] mb-1">Description</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-[#ede5d3] brutal-border px-3 py-2 text-sm text-[#0b1110] font-sans font-medium focus:outline-none focus:bg-white resize-none"
                  placeholder="Playlist description..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="brutal-btn px-4 py-2 bg-[#ede5d3] brutal-border text-xs font-mono font-black uppercase text-[#0b1110]"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDetails}
                  className="brutal-btn px-5 py-2 bg-[#082621] text-[#26c4b7] brutal-border brutal-shadow-sm text-xs font-mono font-black uppercase hover:bg-[#0b1110]"
                >
                  Save Details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Action Buttons & Search Row ── */}
      <div className={`brutal-border brutal-shadow p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isDark ? 'bg-[#141d1b] border-zinc-700' : 'bg-[#fdfbf7] border-black'
      }`}>
        <div className="flex items-center flex-wrap gap-3">
          <button
            disabled={filteredPlaylistTracks.length === 0}
            onClick={() => filteredPlaylistTracks.length > 0 && handlePlayPlaylistTrack(filteredPlaylistTracks[0])}
            className={`brutal-btn w-12 h-12 brutal-border-thick brutal-shadow flex items-center justify-center transition-all ${
              filteredPlaylistTracks.length > 0
                ? 'bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] cursor-pointer'
                : 'bg-[#ded2bb] text-[#0b1110]/40 cursor-not-allowed'
            }`}
            title="Play playlist"
          >
            <Play size={22} fill="currentColor" className="ml-0.5 text-[#0b1110]" />
          </button>

          {/* Save to Library button (for other users' public playlists or albums) */}
          {!isUserPlaylist && !playlist?.isLikedSongs && (
            <button
              onClick={handleToggleSavePlaylist}
              disabled={isSavingPlaylist}
              className={`px-4 py-2.5 rounded-xl font-display font-black text-xs brutal-border brutal-shadow-sm brutal-btn cursor-pointer flex items-center gap-2 transition-all ${
                isSavedInLibrary
                  ? isDark ? 'bg-zinc-800 text-emerald-400 border-zinc-700 hover:bg-zinc-700' : 'bg-white text-emerald-600 border-black hover:bg-[#ede5d3]'
                  : 'bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110]'
              }`}
              title={isSavedInLibrary ? "In your Library (Click to remove)" : "Save this playlist to your Library"}
            >
              {isSavingPlaylist ? (
                <Loader2 size={16} className="animate-spin" />
              ) : isSavedInLibrary ? (
                <>
                  <Check size={16} strokeWidth={3} />
                  <span>Saved in Library</span>
                </>
              ) : (
                <>
                  <Plus size={16} strokeWidth={3} />
                  <span>Save to Library</span>
                </>
              )}
            </button>
          )}

          {saveSuccessMsg && (
            <span className="text-xs font-mono font-bold text-emerald-500 flex items-center gap-1">
              ✓ {saveSuccessMsg}
            </span>
          )}
        </div>

        {playlistTracks.length > 0 && (
          <div className="relative w-full sm:w-72">
            <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${
              isDark ? 'text-zinc-500' : 'text-[#082621]/60'
            }`} />
            <input
              type="text"
              placeholder="Search in prescription list..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full brutal-border pl-9 pr-4 py-2 text-xs font-mono focus:outline-none ${
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
          <div className="space-y-2">
            {/* Table Header */}
            <div className={`grid grid-cols-12 text-[10px] font-mono font-black uppercase tracking-wider brutal-border p-2.5 ${
              isDark ? 'bg-[#101716] text-zinc-300 border-zinc-700' : 'bg-[#ded2bb] text-[#082621] border-black'
            }`}>
              <span className="col-span-1 text-center">#</span>
              <span className="col-span-6 md:col-span-5">{isQuran ? 'SURAH & RECITER' : 'TITLE & ARTIST'}</span>
              <span className="hidden md:block col-span-3">{isQuran ? 'COLLECTION' : 'ALBUM'}</span>
              <span className="col-span-5 md:col-span-3 text-right pr-2">ACTIONS</span>
            </div>

            {filteredPlaylistTracks.map((track, i) => {
              return (
                <React.Fragment key={track.id || track._id || i}>
                  <div
                    onClick={() => handlePlayPlaylistTrack(track)}
                    className={`grid grid-cols-12 items-center p-3 brutal-border brutal-shadow-sm hover:translate-x-1 transition-transform cursor-pointer group ${
                      isDark 
                        ? 'bg-[#141d1b] border-zinc-700 hover:bg-[#182320]' 
                        : 'bg-[#fdfbf7] border-black hover:bg-[#ede5d3]'
                    }`}
                  >
                    <span className={`col-span-1 text-xs font-mono font-black text-center ${
                      isDark ? 'text-zinc-400' : 'text-[#082621]'
                    }`}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    
                    {/* Title & Artist */}
                    <div className="col-span-6 md:col-span-5 flex items-center gap-3 truncate pr-2">
                      <img 
                        src={track.cover} 
                        alt={track.title} 
                        className="w-10 h-10 brutal-border object-cover shrink-0 bg-[#ede5d3]" 
                        onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=R&background=082621&color=26c4b7`; }}
                      />
                      <div className="truncate">
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
                      </div>
                    </div>

                    {/* Album */}
                    <div className="hidden md:block col-span-3 text-xs text-zinc-400 truncate pr-2 font-medium">
                      {track.album || playlist.name}
                    </div>

                    {/* Action & Duration */}
                    <div className="col-span-5 md:col-span-3 flex items-center justify-end gap-2 text-xs">
                      <span className="text-xs font-mono text-zinc-400 mr-2">
                        {track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : '3:00'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(track.id || track._id);
                        }}
                        className={`p-1.5 transition-colors cursor-pointer ${
                          isDark ? 'text-zinc-400 hover:text-[#dc2626]' : 'text-[#0b1110] hover:text-[#dc2626]'
                        }`}
                        title="Favorite"
                      >
                        <Heart 
                          size={16} 
                          className={
                            (likedTrackIds || []).some(id => String(id) === String(track?.id || track?._id)) || Boolean(track?.liked)
                              ? 'fill-[#dc2626] text-[#dc2626]' 
                              : ''
                          } 
                        />
                      </button>
                      {playlist.isLikedSongs ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLike(track.id || track._id);
                          }}
                          className={`p-1.5 transition-colors cursor-pointer ${
                            isDark ? 'text-zinc-400 hover:text-[#dc2626]' : 'text-[#0b1110] hover:text-[#dc2626]'
                          }`}
                          title={isQuran ? "Remove from Favorites" : "Remove from Liked Songs"}
                        >
                          <Minus size={16} />
                        </button>
                      ) : (
                        isOwner && onRemoveTrackFromPlaylist && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveTrackFromPlaylist(track.id || track._id, playlist.id || playlist._id);
                            }}
                            className={`p-1.5 transition-colors cursor-pointer ${
                              isDark ? 'text-zinc-400 hover:text-[#f59e0b]' : 'text-[#0b1110] hover:text-[#f59e0b]'
                            }`}
                            title={isQuran ? "Remove surah from playlist" : "Remove song from playlist"}
                            aria-label={isQuran ? "Remove surah from playlist" : "Remove song from playlist"}
                          >
                            <Minus size={16} />
                          </button>
                        )
                      )}
                      {isUserAdmin(currentUser) && openEditSongModal && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditSongModal(track);
                          }}
                          className={`p-1.5 transition-colors cursor-pointer rounded-md ${
                            isDark ? 'text-zinc-400 hover:text-[#17a398]' : 'text-[#0b1110] hover:text-[#17a398]'
                          }`}
                          title={isQuran ? "Admin: Edit Surah Details" : "Admin: Edit Song Details"}
                        >
                          <Edit2 size={15} />
                        </button>
                      )}
                      {onDeleteTrack && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (window.confirm(`Delete "${track.title}" permanently from Rivo archive?`)) {
                              onDeleteTrack(track.id || track._id);
                            }
                          }}
                          className={`p-1.5 transition-colors cursor-pointer ${
                            isDark ? 'text-zinc-400 hover:text-[#dc2626]' : 'text-[#0b1110] hover:text-[#dc2626]'
                          }`}
                          title="Delete permanently"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
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
                    <img src={rec.cover} alt={rec.title} className="w-11 h-11 brutal-border object-cover shrink-0" />
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
          } flex items-center justify-between`}>
            <div>
              <h3 className={`text-sm font-mono font-black uppercase ${
                isDark ? 'text-white' : 'text-[#082621]'
              }`}>
                {isQuran ? 'ADD SURAHS FROM YOUR LIBRARY' : 'ADD TRACKS FROM YOUR DISPENSARY'}
              </h3>
              <p className={`text-[11px] font-sans ${
                isDark ? 'text-zinc-400' : 'text-[#082621]/70'
              }`}>
                {isQuran ? 'Click ADD to append these surahs to this collection' : 'Click ADD to append these records to this cassette'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            {availableTracks.map(track => (
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
                  <img src={track.cover} alt={track.title} className="w-10 h-10 brutal-border object-cover shrink-0" />
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
        </section>
      )}


      {/* Duplicate Track Confirmation Modal */}
      {duplicateConfirmTrack && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 select-none">
          <div className="bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg p-6 w-full max-w-sm relative">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#0b1110]">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-600" />
                <h3 className="text-base font-mono font-black uppercase text-[#082621]">Already in Playlist</h3>
              </div>
              <button 
                onClick={() => setDuplicateConfirmTrack(null)} 
                className="brutal-btn p-1 bg-[#ede5d3] brutal-border hover:bg-[#ded2bb] text-[#0b1110]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="my-4 text-center">
              <p className="text-xs font-mono font-bold text-[#082621]">
                "<span className="font-black">{duplicateConfirmTrack.title}</span>" is already in this playlist.
              </p>
              <p className="text-[11px] font-sans text-[#082621]/70 mt-1">
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
                className="flex-1 py-2.5 bg-[#ede5d3] hover:bg-[#ded2bb] text-[#082621] font-mono text-xs font-black uppercase brutal-border cursor-pointer flex items-center justify-center"
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
                className="text-[11px] font-mono font-bold text-[#dc2626] hover:text-red-700 hover:underline cursor-pointer bg-transparent border-0 inline-block p-1"
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
    </div>
  );
}
