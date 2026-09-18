import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, Heart, Plus, Minus, Search, ArrowLeft, Music, SlidersHorizontal, 
  Camera, Globe, Lock, Edit2, Loader2, Check, Trash2, X, Sliders, Wand2, 
  Sparkles, RefreshCw, Zap, Disc, ArrowRight
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import MiniMixerModal from '../components/MiniMixerModal';
import { getTrackMusicalData, checkHarmonicCompatibility, getRecommendedTransition } from '../utils/musicAnalysis';
import { useAudioPlayer } from '../context/AudioContext';

export default function PlaylistScreen({ 
  playlist, 
  tracks = [], 
  onSelectTrack, 
  toggleLike, 
  onBack,
  onAddTrackToPlaylist,
  onRemoveTrackFromPlaylist,
  onDeleteTrack,
  onUpdatePlaylist = () => {},
  onDeletePlaylist = () => {},
  onTogglePlaylistVisibility = () => {},
}) {
  const { isMixMode, setIsMixMode, activeTransitions, setActiveTransitions } = useAudioPlayer();
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdatingCover, setIsUpdatingCover] = useState(false);
  const [isTogglingPrivacy, setIsTogglingPrivacy] = useState(false);
  const [fetchedTracks, setFetchedTracks] = useState([]);

  // Spotify Mix & DJ Transitions State
  const [isMixActive, setIsMixActive] = useState(Boolean(playlist?.isMix));
  const [transitions, setTransitions] = useState(playlist?.transitions || {});
  const [activeMixerPair, setActiveMixerPair] = useState(null); // { trackA, trackB, pairKey }
  const [isAutoMixingAll, setIsAutoMixingAll] = useState(false);

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
      setIsMixActive(Boolean(playlist.isMix));
      setTransitions(playlist.transitions || {});
    }
  }, [playlist?.id]);

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

  // Preserve EXACT track order as stored in playlist.trackIds
  const playlistTracks = playlist.isLikedSongs 
    ? tracks.filter((t) => t.liked)
    : playlistTrackIds.map(id => trackMap.get(id)).filter(Boolean);

  const availableTracks = tracks.filter((t) => !playlistTrackIds.includes(String(t.id || t._id)));

  const filteredPlaylistTracks = playlistTracks.filter((t) => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
    await onTogglePlaylistVisibility(playlist.id);
    setIsTogglingPrivacy(false);
  };

  const handleToggleMix = async () => {
    const nextState = !isMixActive;
    setIsMixActive(nextState);
    setIsMixMode?.(nextState);
    if (nextState) {
      setActiveTransitions?.(transitions);
    }
    try {
      const token = localStorage.getItem('liofy_token');
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

  const handleAutoMixAll = async () => {
    if (!filteredPlaylistTracks || filteredPlaylistTracks.length < 2) return;
    setIsAutoMixingAll(true);
    const updatedTransitions = { ...transitions };

    for (let i = 0; i < filteredPlaylistTracks.length - 1; i++) {
      const tA = filteredPlaylistTracks[i];
      const tB = filteredPlaylistTracks[i + 1];
      const pairKey = `${String(tA.id || tA._id)}___${String(tB.id || tB._id)}`;
      const rec = getRecommendedTransition(tA, tB);
      updatedTransitions[pairKey] = {
        style: rec.style,
        duration: rec.duration,
        autoMatchBpm: true,
        name: rec.name
      };
    }

    setTransitions(updatedTransitions);
    setActiveTransitions?.(updatedTransitions);

    try {
      const token = localStorage.getItem('liofy_token');
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

    try {
      const token = localStorage.getItem('liofy_token');
      await fetch(`${API_BASE_URL}/api/playlists/${playlist.id}/transitions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ isMix: isMixActive, transitions: updated })
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
          playlistName: playlist.name,
          seedTracks: playlistTracks.slice(0, 6)
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.recommendations)) {
        setAiRecommendations(data.recommendations);
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
    if (window.confirm(`Are you sure you want to delete the playlist "${playlist.name}"?`)) {
      setIsDeleting(true);
      onDeletePlaylist(playlist.id);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto pb-32 select-none">
      {/* Header Banner */}
      <div className="relative p-6 md:p-8 bg-gradient-to-b from-red-950 via-zinc-900 to-[#121212] flex flex-col md:flex-row items-end gap-6 border-b border-zinc-800">
        <button 
          onClick={onBack}
          className="absolute top-4 left-4 p-2 text-zinc-300 hover:text-white bg-black/40 rounded-full"
        >
          <ArrowLeft size={20} />
        </button>

        {/* Cover Art (With Upload Overlay for Custom Playlists) */}
        <div className="w-44 h-44 md:w-52 md:h-52 rounded-2xl overflow-hidden shadow-2xl shrink-0 border border-white/10 mt-6 md:mt-0 relative group">
          {playlist.isLikedSongs ? (
            <div className="w-full h-full bg-gradient-to-br from-indigo-600 via-purple-700 to-pink-700 flex items-center justify-center text-white">
              <Heart size={64} fill="white" />
            </div>
          ) : (
            <>
              <img 
                src={playlist.cover || `https://ui-avatars.com/api/?name=${encodeURIComponent(playlist.name)}&background=1DB954&color=000&size=512&bold=true&format=svg`} 
                alt={playlist.name} 
                className="w-full h-full object-cover" 
              />
              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 cursor-pointer text-white">
                {isUpdatingCover ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <>
                    <Camera size={28} />
                    <span className="text-xs font-bold">Change Cover</span>
                  </>
                )}
                <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
              </label>
            </>
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-black uppercase tracking-widest text-[#1DB954]">
              {playlist.isLikedSongs ? 'Liked Songs Playlist' : 'Playlist'}
            </span>

            {/* Public/Private Badge & Action Buttons */}
            {!playlist.isLikedSongs && (
              <>
                <button
                  onClick={handleTogglePrivacy}
                  disabled={isTogglingPrivacy}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border transition-all cursor-pointer ${
                    isPublic 
                      ? 'bg-[#1DB954]/20 text-[#1DB954] border-[#1DB954]/40 hover:bg-[#1DB954]/30' 
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                  }`}
                  title="Tap to toggle profile visibility"
                >
                  {isTogglingPrivacy ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : isPublic ? (
                    <><Globe size={12} /><span>Public (Visible)</span></>
                  ) : (
                    <><Lock size={12} /><span>Private (Hidden)</span></>
                  )}
                </button>

                {/* Edit Button */}
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all cursor-pointer"
                  title="Edit name & description"
                >
                  <Edit2 size={12} />
                  <span>Edit</span>
                </button>

                {/* Delete Button */}
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-red-500/10 hover:bg-red-500/30 text-red-400 border border-red-500/30 transition-all cursor-pointer"
                  title="Delete playlist"
                >
                  <Trash2 size={12} />
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mt-1">
              {playlist.name}
            </h1>
            {!playlist.isLikedSongs && (
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="p-2 text-zinc-400 hover:text-white transition-colors"
                title="Edit playlist name"
              >
                <Edit2 size={22} />
              </button>
            )}
          </div>

          <p className="text-xs md:text-sm text-zinc-300 mt-2 font-medium">{playlist.description || 'Custom playlist'}</p>
          <p className="text-xs text-zinc-400 mt-2 font-bold">
            Liofy • {playlistTracks.length} songs, <span className="text-zinc-500 font-medium">{formatDurationSum()}</span>
          </p>
        </div>
      </div>

      {/* ── Edit Playlist Modal ── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#181818] border border-zinc-800 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => setIsEditModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white"
            >
              <X size={20} />
            </button>
            <h3 className="text-xl font-extrabold text-white mb-4">Edit Playlist</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">Playlist Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#1DB954]"
                  placeholder="Playlist name..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-400 mb-1">Description (optional)</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#1DB954] resize-none"
                  placeholder="Playlist description..."
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-5 py-2.5 rounded-full text-xs font-bold text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDetails}
                  className="px-6 py-2.5 rounded-full text-xs font-extrabold bg-[#1DB954] text-black hover:scale-105 active:scale-95 transition-all"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons & Search Row */}
      <div className="p-4 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center flex-wrap gap-3">
          <button
            disabled={filteredPlaylistTracks.length === 0}
            onClick={() => filteredPlaylistTracks.length > 0 && onSelectTrack(filteredPlaylistTracks[0], filteredPlaylistTracks)}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all ${
              filteredPlaylistTracks.length > 0
                ? 'bg-[#1DB954] hover:bg-[#1ed760] text-black hover:scale-105 active:scale-95 cursor-pointer'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            }`}
          >
            <Play size={26} fill={filteredPlaylistTracks.length > 0 ? "black" : "currentColor"} className="ml-1" />
          </button>

          {/* Spotify Mix DJ Mode Toggle Button */}
          {!playlist.isLikedSongs && (
            <button
              onClick={handleToggleMix}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-black text-xs transition-all shadow-lg cursor-pointer ${
                isMixActive
                  ? 'bg-gradient-to-r from-emerald-500 to-[#1DB954] text-black shadow-emerald-500/20 scale-105'
                  : 'bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500'
              }`}
              title="Toggle Spotify Mix (DJ Transitions & Auto BPM Sync)"
            >
              <Sliders size={16} />
              <span>Mix {isMixActive ? 'Active' : ''}</span>
              {isMixActive && (
                <span className="w-2 h-2 rounded-full bg-black animate-pulse" />
              )}
            </button>
          )}

          {/* Auto Mix All Button */}
          {isMixActive && filteredPlaylistTracks.length > 1 && (
            <button
              onClick={handleAutoMixAll}
              disabled={isAutoMixingAll}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full font-bold text-xs bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-500/30 transition-all cursor-pointer"
              title="Automatically match BPM and calculate optimal transitions for all songs"
            >
              {isAutoMixingAll ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              <span>Auto Mix All</span>
            </button>
          )}
        </div>

        {playlistTracks.length > 0 && (
          <div className="relative w-full sm:w-64">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search in playlist..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-full pl-9 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#1DB954]"
            />
          </div>
        )}
      </div>

      {/* Playlist Tracks List with DJ Mix BPM & Key Match Columns */}
      <div className="px-4 md:px-8 mb-12">
        {filteredPlaylistTracks.length > 0 ? (
          <>
            <div className="grid grid-cols-12 text-xs font-bold uppercase tracking-wider text-zinc-500 pb-3 border-b border-zinc-800 px-3">
              <span className="col-span-1 text-center">#</span>
              <span className="col-span-5 sm:col-span-4">Title</span>
              <span className="col-span-2 text-center">BPM</span>
              <span className="col-span-2 text-center">Key</span>
              <span className="col-span-2 text-right">Action</span>
            </div>

            <div className="flex flex-col mt-2">
              {filteredPlaylistTracks.map((track, i) => {
                const nextTrack = filteredPlaylistTracks[i + 1];
                const dataThis = getTrackMusicalData(track);
                const dataNext = nextTrack ? getTrackMusicalData(nextTrack) : null;
                const pairKey = nextTrack ? `${String(track.id || track._id)}___${String(nextTrack.id || nextTrack._id)}` : null;
                const curTransition = pairKey ? transitions[pairKey] : null;
                const compatibility = (nextTrack && dataNext) ? checkHarmonicCompatibility(dataThis.key, dataNext.key, dataThis.bpm, dataNext.bpm) : null;

                return (
                  <React.Fragment key={track.id || track._id || i}>
                    <div
                      onClick={() => onSelectTrack(track, filteredPlaylistTracks)}
                      className="grid grid-cols-12 items-center p-3 rounded-xl hover:bg-zinc-900/80 cursor-pointer group transition-colors border border-transparent hover:border-zinc-800"
                    >
                      <span className="col-span-1 text-xs font-black text-zinc-500 text-center">{i + 1}</span>
                      
                      {/* Title & Artist & Transition Pill */}
                      <div className="col-span-5 sm:col-span-4 flex items-center gap-3 truncate pr-2">
                        <img src={track.cover} alt={track.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        <div className="truncate">
                          <h4 className="text-sm font-bold text-white truncate group-hover:text-[#1DB954] transition-colors">{track.title}</h4>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-zinc-400 truncate">{track.artist}</p>
                            {curTransition && (
                              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
                                🎛️ {curTransition.style || 'Blend'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* BPM */}
                      <span className="col-span-2 text-xs font-bold text-zinc-300 text-center">{dataThis.bpm}</span>

                      {/* Harmonic Key Pill (2A, 3A, 4A) */}
                      <div className="col-span-2 flex justify-center">
                        <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                          {dataThis.key}
                        </span>
                      </div>

                      {/* Action */}
                      <div className="col-span-2 flex items-center justify-end gap-2 text-xs text-zinc-400">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLike(track.id || track._id);
                          }}
                          className="p-1.5 text-zinc-400 hover:text-white"
                          title="Like / Unlike"
                        >
                          <Heart size={16} className={track.liked ? 'fill-white text-white' : ''} />
                        </button>
                        {!playlist.isLikedSongs && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveTrackFromPlaylist(track.id || track._id, playlist.id);
                            }}
                            className="p-1.5 text-zinc-400 hover:text-amber-400 rounded-full hover:bg-zinc-800"
                            title="Remove from playlist"
                          >
                            <Minus size={16} />
                          </button>
                        )}
                        {onDeleteTrack && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.confirm(`Delete "${track.title}" permanently?`)) {
                                onDeleteTrack(track.id || track._id);
                              }
                            }}
                            className="p-1.5 text-zinc-400 hover:text-red-400 rounded-full hover:bg-zinc-800"
                            title="Delete song permanently"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Spotify Mix DJ Transition Connector Bar */}
                    {isMixActive && nextTrack && compatibility && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMixerPair({ trackA: track, trackB: nextTrack, pairKey });
                        }}
                        className="my-1.5 mx-2 py-1.5 px-4 rounded-xl bg-zinc-900/50 hover:bg-zinc-800/90 border border-dashed border-emerald-500/30 hover:border-emerald-500/80 flex items-center justify-between cursor-pointer transition-all group shadow-sm"
                        title="Click to customize transition in Mini-Mixer"
                      >
                        <div className="flex items-center gap-2">
                          <Sliders size={13} className="text-[#1DB954]" />
                          <span className="text-[11px] font-extrabold text-white">
                            {curTransition?.name || curTransition?.style || 'Equal Power Blend'} ({curTransition?.duration || 8}s)
                          </span>
                          <span className="text-[10px] text-zinc-400 hidden sm:inline">
                            • {compatibility.badge}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-400 group-hover:text-emerald-300">
                          <span>Edit Transition 🎛️</span>
                          <ArrowRight size={12} />
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </>
        ) : (
          <div className="text-center py-12 bg-zinc-900/40 rounded-3xl border border-zinc-800/80 p-8">
            <Music size={40} className="mx-auto text-zinc-600 mb-3" />
            <h3 className="text-lg font-bold text-white">This playlist is empty</h3>
            <p className="text-xs text-zinc-400 mt-1">Add songs from the suggestions below to build your playlist.</p>
          </div>
        )}
      </div>

      {/* AI Smart Suggestions / Enhance Playlist Section */}
      {!playlist.isLikedSongs && playlistTracks.length > 0 && (
        <section className="px-4 md:px-8 pt-6 pb-6 border-t border-zinc-800/80">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Sparkles size={18} className="text-emerald-400 fill-emerald-400" />
                AI Smart Suggestions for "{playlist.name}"
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">Recommendations tailored to this playlist's vibe and tempo</p>
            </div>
            <button
              onClick={handleFetchAiRecommendations}
              disabled={isLoadingRecs}
              className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 hover:text-emerald-300 text-xs font-extrabold rounded-full transition-all border border-emerald-500/20 cursor-pointer"
            >
              {isLoadingRecs ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
              <span>{aiRecommendations.length > 0 ? 'Refresh Suggestions' : 'Enhance with AI ✨'}</span>
            </button>
          </div>

          {aiRecommendations.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6">
              {aiRecommendations.map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 transition-all"
                >
                  <div 
                    onClick={() => onSelectTrack(rec)}
                    className="flex items-center gap-3 flex-1 truncate cursor-pointer"
                  >
                    <img src={rec.cover} alt={rec.title} className="w-11 h-11 rounded-xl object-cover" />
                    <div className="truncate">
                      <h4 className="text-sm font-bold text-white truncate">{rec.title}</h4>
                      <p className="text-xs text-zinc-400 truncate">{rec.artist}</p>
                      {rec.aiReason && (
                        <span className="text-[9px] font-bold text-emerald-400">{rec.aiReason}</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onAddTrackToPlaylist(rec.id, playlist.id)}
                    className="px-3 py-1.5 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold text-xs rounded-full flex items-center gap-1 transition-all shadow-md shrink-0"
                    title="Add to playlist"
                  >
                    <Plus size={14} />
                    <span>Add</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Add Songs to Playlist Section */}
      {!playlist.isLikedSongs && availableTracks.length > 0 && (
        <section className="px-4 md:px-8 pt-6 border-t border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-extrabold text-white">Add Songs to {playlist.name}</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Pick songs from your library to add to this playlist</p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {availableTracks.map((track) => (
              <div
                key={track.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-[#181818] border border-zinc-800 hover:bg-zinc-900 transition-all"
              >
                <div 
                  onClick={() => onSelectTrack(track)}
                  className="flex items-center gap-3 flex-1 truncate cursor-pointer"
                >
                  <img src={track.cover} alt={track.title} className="w-11 h-11 rounded-xl object-cover" />
                  <div className="truncate">
                    <h4 className="text-sm font-bold text-white truncate">{track.title}</h4>
                    <p className="text-xs text-zinc-400 truncate">{track.artist} • {track.album}</p>
                  </div>
                </div>

                <button
                  onClick={() => onAddTrackToPlaylist(track.id, playlist.id)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-[#1DB954] hover:text-black text-white font-extrabold text-xs rounded-full flex items-center gap-1.5 transition-all shadow-md shrink-0"
                >
                  <Plus size={16} />
                  <span>Add</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Mini-Mixer Modal for Custom DJ Transitions */}
      {activeMixerPair && (
        <MiniMixerModal
          isOpen={Boolean(activeMixerPair)}
          onClose={() => setActiveMixerPair(null)}
          trackA={activeMixerPair.trackA}
          trackB={activeMixerPair.trackB}
          initialTransition={transitions[activeMixerPair.pairKey]}
          onSaveTransition={handleSaveTransitionSettings}
        />
      )}
    </div>
  );
}
