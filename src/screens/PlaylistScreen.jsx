import React, { useState } from 'react';
import { Play, Heart, Plus, Minus, Search, ArrowLeft, Music, SlidersHorizontal, Camera, Globe, Lock, Edit2, Loader2, Check } from 'lucide-react';

export default function PlaylistScreen({ 
  playlist, 
  tracks = [], 
  onSelectTrack, 
  toggleLike, 
  onBack,
  onAddTrackToPlaylist,
  onRemoveTrackFromPlaylist,
  onUpdatePlaylist = () => {},
  onTogglePlaylistVisibility = () => {},
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdatingCover, setIsUpdatingCover] = useState(false);
  const [isTogglingPrivacy, setIsTogglingPrivacy] = useState(false);

  if (!playlist) return null;

  const playlistTrackIds = (playlist.trackIds || []).map(String);
  const playlistTracks = tracks.filter((t) => 
    playlist.isLikedSongs 
      ? t.liked 
      : (playlistTrackIds.includes(String(t.id)) || playlistTrackIds.includes(String(t._id)))
  );

  const availableTracks = tracks.filter((t) => !playlistTrackIds.includes(t.id));

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
                    <span className="text-xs font-bold">تغيير الصورة</span>
                  </>
                )}
                <input type="file" accept="image/*" onChange={handleCoverUpload} className="hidden" />
              </label>
            </>
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-black uppercase tracking-widest text-[#1DB954]">
              {playlist.isLikedSongs ? 'قائمة المفضلات' : 'قائمة تشغيل'}
            </span>

            {/* Public/Private Badge & Toggle Button */}
            {!playlist.isLikedSongs && (
              <button
                onClick={handleTogglePrivacy}
                disabled={isTogglingPrivacy}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold border transition-all cursor-pointer ${
                  isPublic 
                    ? 'bg-[#1DB954]/20 text-[#1DB954] border-[#1DB954]/40 hover:bg-[#1DB954]/30' 
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                }`}
                title="اضغط لتغيير ظهور القائمة بالبروفايل"
              >
                {isTogglingPrivacy ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : isPublic ? (
                  <><Globe size={12} /><span>عامة (تظهر بالبروفايل)</span></>
                ) : (
                  <><Lock size={12} /><span>خاصة (مخفية)</span></>
                )}
              </button>
            )}
          </div>

          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight mt-1">
            {playlist.name}
          </h1>
          <p className="text-xs md:text-sm text-zinc-300 mt-2 font-medium">{playlist.description || 'Custom playlist'}</p>
          <p className="text-xs text-zinc-400 mt-2 font-bold">
            Liofy • {playlistTracks.length} songs, <span className="text-zinc-500 font-medium">{formatDurationSum()}</span>
          </p>
        </div>
      </div>

      {/* Action Buttons & Search Row */}
      <div className="p-4 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            disabled={filteredPlaylistTracks.length === 0}
            onClick={() => filteredPlaylistTracks.length > 0 && onSelectTrack(filteredPlaylistTracks[0])}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all ${
              filteredPlaylistTracks.length > 0
                ? 'bg-[#1DB954] hover:bg-[#1ed760] text-black hover:scale-105 active:scale-95 cursor-pointer'
                : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            }`}
          >
            <Play size={26} fill={filteredPlaylistTracks.length > 0 ? "black" : "currentColor"} className="ml-1" />
          </button>
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

            <div className="flex flex-col gap-1 mt-2">
              {filteredPlaylistTracks.map((track, i) => (
                <div
                  key={track.id}
                  onClick={() => onSelectTrack(track)}
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
                        {track.transition && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300 border border-zinc-700">
                            ░ {track.transition}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* BPM */}
                  <span className="col-span-2 text-xs font-bold text-zinc-300 text-center">{track.bpm || 95}</span>

                  {/* Harmonic Key Pill (2A, 3A, 4A) */}
                  <div className="col-span-2 flex justify-center">
                    <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-500/40">
                      {track.key || '2A'}
                    </span>
                  </div>

                  {/* Action */}
                  <div className="col-span-2 flex items-center justify-end gap-2 text-xs text-zinc-400">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLike(track.id);
                      }}
                      className="p-1.5 text-zinc-400 hover:text-white"
                    >
                      <Heart size={16} className={track.liked ? 'fill-white text-white' : ''} />
                    </button>
                    {!playlist.isLikedSongs && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveTrackFromPlaylist(track.id, playlist.id);
                        }}
                        className="p-1.5 text-zinc-400 hover:text-red-400 rounded-full hover:bg-zinc-800"
                        title="Remove from playlist"
                      >
                        <Minus size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
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
    </div>
  );
}
