import React, { useState, useMemo } from 'react';
import { Play, Pause, Plus, Heart, Radio, MessageSquare, Sparkles, Disc, Activity, Trash2 } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import VerifiedBadge from '../components/VerifiedBadge';

export default function HomeScreen({ 
  tracks = [], 
  playlists = [], 
  artists = [], 
  onSelectTrack, 
  onSelectPlaylist, 
  toggleLike, 
  onSelectArtist,
  openAddSongModal,
  openEditSongModal,
  onDeleteTrack,
  currentTrack,
  isPlaying,
  currentUser,
  logout = () => {},
  openAuthModal = () => {},
  openProfileScreen = () => {},
  openJamModal = () => {},
  jamSession = null,
  openChatModal = () => {},
  unreadChatCount = 0,
  isActivityPanelOpen = false,
  toggleActivityPanel = () => {},
  globalTheme = 'dark',
}) {
  const isDark = globalTheme === 'dark';
  const [activeFilter, setActiveFilter] = useState('all');
  const [deleteConfirmTrackId, setDeleteConfirmTrackId] = useState(null);

  const isTrackActive = (t) => {
    if (!currentTrack || !t) return false;
    const curId = currentTrack.id || currentTrack._id;
    const tId = t.id || t._id;
    return Boolean(curId && tId && String(curId) === String(tId));
  };

  // Filtered tracks
  const displayTracks = useMemo(() => {
    if (!tracks || tracks.length === 0) return [];
    if (activeFilter === 'podcasts') {
      const podTracks = tracks.filter(t => t.isPodcast || t.album?.toLowerCase().includes('podcast') || t.artist?.toLowerCase().includes('podcast'));
      return podTracks.length > 0 ? podTracks : tracks;
    }
    return [...tracks];
  }, [tracks, activeFilter]);

  const quickItems = displayTracks.slice(0, 6);
  const recentItems = displayTracks;

  // Preset vibrant badge colors for blister packs
  const badgeColors = ['#0f756d', '#111615', '#17a398', '#dc2626', '#f59e0b', '#1e3a8a', '#082621', '#3b82f6'];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div 
      className={`flex-1 overflow-y-auto select-none p-3.5 sm:p-6 transition-colors duration-300 ${
        isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'
      }`}
      style={{ 
        paddingBottom: 'calc(var(--player-height) + 40px)',
      }}
    >
      {/* ─────────────────────────────────────────
          HERO BANNER (MUSIC STREAMING LAB)
          ───────────────────────────────────────── */}
      <section className="mb-6 bg-[#082621] rounded-2xl brutal-border-thick p-5 sm:p-7 text-[#fdfbf7] brutal-shadow-teal relative overflow-hidden">
        
        {/* Large Background Watermark */}
        <div className="absolute -right-6 -bottom-10 opacity-10 text-white font-display font-black text-9xl select-none pointer-events-none tracking-tighter">
          RIVO
        </div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          
          {/* Left Text & CTA */}
          <div className="max-w-xl text-left">
            <div className="inline-flex items-center gap-2 bg-[#fdfbf7] text-[#0b1110] px-3 py-1 rounded-full brutal-border text-xs font-display font-bold mb-3 brutal-shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#17a398] animate-pulse"></span>
              <span>🎵 UNLIMITED HI-FI STREAMING • CAIRO MUSIC LAB</span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black leading-tight mb-3 tracking-tight text-white">
              {getGreeting()}, {currentUser?.name ? currentUser.name.split(' ')[0] : 'Listener'}. <br />
              <span className="bg-[#fdfbf7] text-[#0b1110] px-3 py-0.5 rounded-xl brutal-border inline-block transform -rotate-1 shadow-[4px_4px_0px_#f59e0b] mt-1">
                Pure Sound Experience.
              </span>
            </h1>

            <p className="text-emerald-100 text-xs sm:text-sm font-medium leading-relaxed mb-4">
              Stream Egyptian rap, indie hits, retro cassettes, and personalized mixes. Crystal-clear 24-bit audio, zero ads, seamless listening.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <button 
                onClick={() => {
                  if (displayTracks.length > 0) {
                    onSelectTrack(displayTracks[0]);
                  }
                }}
                className="bg-[#fdfbf7] hover:bg-white text-[#0b1110] font-display font-black text-xs sm:text-sm px-5 py-2.5 rounded-xl brutal-border brutal-shadow brutal-btn flex items-center gap-2 cursor-pointer"
              >
                <Play size={16} fill="currentColor" />
                <span>PLAY DAILY MIX</span>
              </button>

              <button 
                onClick={openChatModal}
                className="bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-display font-bold text-xs px-4 py-2.5 rounded-xl brutal-border brutal-shadow-sm brutal-btn flex items-center gap-2 cursor-pointer"
              >
                <Sparkles size={16} strokeWidth={2.5} />
                <span>AI Music DJ</span>
              </button>

              <button 
                onClick={openAddSongModal}
                className="bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] font-display font-bold text-xs px-4 py-2.5 rounded-xl brutal-border brutal-shadow-sm brutal-btn flex items-center gap-2 cursor-pointer"
              >
                <Plus size={16} strokeWidth={2.5} />
                <span>Add Song / Link</span>
              </button>
            </div>
          </div>

          {/* Authentic Rivo Cassette Deck Graphic */}
          <div className="relative shrink-0 flex items-center justify-center self-center lg:self-auto mt-2 lg:mt-0">
            <div className="w-64 bg-[#fdfbf7] text-[#0b1110] rounded-xl brutal-border-thick p-4 brutal-shadow-lg transform rotate-2 hover:rotate-0 transition duration-300">
              <div className="border-2 border-dashed border-[#0b1110] rounded-lg p-3 bg-white text-center">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold border-b-2 border-black pb-1 mb-2">
                  <span>RIVO SOUND LAB</span>
                  <span>HI-FI STEREO</span>
                </div>

                <div className="py-2">
                  <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-[#17a398] flex items-center justify-center brutal-border brutal-shadow-sm">
                    <Disc size={32} className="text-[#0b1110]" strokeWidth={2.2} />
                  </div>
                  <div className="font-display font-black text-xl text-[#0b1110] leading-tight">RIVO CASSETTE</div>
                  <div className="text-[11px] text-zinc-600 font-bold">Daily Tape Rotation</div>
                </div>

                <div className="bg-[#0b1110] text-[#17a398] text-[10px] font-mono py-1 rounded mt-2 font-bold">
                  NOW STREAMING • ZERO ADS
                </div>
              </div>
            </div>

            {/* Serrated Starburst Badge Sticker */}
            <div className="sawtooth-badge w-24 h-24 bg-[#dc2626] text-white flex flex-col items-center justify-center p-2 text-center absolute -top-4 -right-4 transform -rotate-12 brutal-border shadow-md">
              <span className="font-display text-[9px] font-bold">100%</span>
              <span className="font-display font-black text-base leading-tight">STEREO</span>
              <span className="text-[8px] font-mono font-bold">TOP PICKS</span>
            </div>
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────
          QUICK ROTATION 6-PACK GRID
          ───────────────────────────────────────── */}
      <section className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-black text-lg sm:text-xl text-[#fdfbf7] tracking-tight drop-shadow-[1.5px_1.5px_0px_#082621]">
              Daily Rotation & Favorites
            </h2>
            <span className="text-[10px] font-mono font-bold bg-[#0b1110] text-[#17a398] px-2 py-0.5 rounded-full brutal-border">
              TOP TRACKS
            </span>
          </div>

          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button 
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-display font-bold brutal-border brutal-btn transition cursor-pointer ${
                activeFilter === 'all' 
                  ? 'bg-[#0b1110] text-[#fdfbf7] brutal-shadow-sm' 
                  : 'bg-[#fdfbf7] text-[#0b1110] hover:bg-white'
              }`}
            >
              All
            </button>
            <button 
              onClick={() => setActiveFilter('music')}
              className={`px-3 py-1 rounded-lg text-xs font-display font-bold brutal-border brutal-btn transition cursor-pointer ${
                activeFilter === 'music' 
                  ? 'bg-[#0b1110] text-[#fdfbf7] brutal-shadow-sm' 
                  : 'bg-[#fdfbf7] text-[#0b1110] hover:bg-white'
              }`}
            >
              Music
            </button>
            <button 
              onClick={() => setActiveFilter('podcasts')}
              className={`px-3 py-1 rounded-lg text-xs font-display font-bold brutal-border brutal-btn transition cursor-pointer ${
                activeFilter === 'podcasts' 
                  ? 'bg-[#0b1110] text-[#fdfbf7] brutal-shadow-sm' 
                  : 'bg-[#fdfbf7] text-[#0b1110] hover:bg-white'
              }`}
            >
              Podcasts
            </button>
          </div>
        </div>

        {/* 2x3 Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickItems.map((track, index) => {
            const active = isTrackActive(track);
            const color = badgeColors[index % badgeColors.length];

            return (
              <div 
                key={track.id || track._id || index}
                onClick={() => onSelectTrack(track)}
                className={`rounded-xl brutal-border p-2 flex items-center justify-between cursor-pointer brutal-shadow-sm hover:brutal-shadow transition ${
                  isDark 
                    ? 'bg-[#141d1b] hover:bg-[#1a2623] border-zinc-700' 
                    : 'bg-[#fdfbf7] hover:bg-white text-[#0b1110]'
                } ${
                  active ? (isDark ? 'ring-2 ring-[#17a398] bg-[#1a2623]' : 'ring-2 ring-[#0b1110] bg-white') : ''
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {track.cover ? (
                    <img 
                      src={track.cover} 
                      alt={track.title} 
                      className="w-11 h-11 rounded-lg brutal-border object-cover shrink-0" 
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div 
                      className="w-11 h-11 rounded-lg brutal-border flex items-center justify-center shrink-0 text-white font-mono font-bold text-xs" 
                      style={{ backgroundColor: color }}
                    >
                      RX{index + 1}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className={`font-display font-black text-xs truncate ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
                      {track.title}
                    </div>
                    <div className={`text-[10px] font-bold truncate ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      {track.artist || 'Unknown Artist'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 mr-1">
                  {toggleLike && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLike(track.id || track._id);
                      }}
                      className="p-1 text-zinc-400 hover:text-[#dc2626] transition cursor-pointer" 
                      title="Like"
                    >
                      <Heart 
                        size={15} 
                        fill={track.liked ? '#dc2626' : 'none'} 
                        className={track.liked ? 'text-[#dc2626]' : ''} 
                      />
                    </button>
                  )}
                  {onDeleteTrack && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmTrackId(track.id || track._id);
                      }}
                      className="p-1 text-zinc-400 hover:text-red-600 transition cursor-pointer" 
                      title="Delete Track"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTrack(track);
                    }}
                    className="w-8 h-8 rounded-lg bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border flex items-center justify-center brutal-btn shrink-0 cursor-pointer" 
                    title="Play"
                  >
                    {active && isPlaying ? (
                      <Pause size={13} fill="currentColor" />
                    ) : (
                      <Play size={13} fill="currentColor" />
                    )}
                  </button>
                </div>
              </div>
            );
          })}

          {quickItems.length === 0 && (
            <div className="col-span-full bg-[#fdfbf7] brutal-border rounded-xl p-6 text-center">
              <p className="font-display font-bold text-sm text-[#0b1110]">No tracks found in current filter.</p>
              <button 
                onClick={openAddSongModal}
                className="mt-3 px-4 py-2 bg-[#17a398] text-[#0b1110] font-display font-bold text-xs rounded-lg brutal-border brutal-shadow-sm brutal-btn"
              >
                + Add Songs
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ─────────────────────────────────────────
          RECENTLY DISPENSED / POPULAR TRACKS
          ───────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-black text-xl text-[#fdfbf7] tracking-tight drop-shadow-[1.5px_1.5px_0px_#082621]">
              Recently Played & Discoveries
            </h2>
            <span className="text-[10px] font-mono font-bold bg-[#0b1110] text-[#17a398] px-2 py-0.5 rounded-full brutal-border">
              RECENT
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {recentItems.map((track, index) => {
            const active = isTrackActive(track);
            const color = badgeColors[index % badgeColors.length];
            const durationFormatted = track.duration 
              ? `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}`
              : '3:45';

            return (
              <div 
                key={track.id || track._id || index}
                onClick={() => onSelectTrack(track)}
                className={`rounded-xl brutal-border p-3 flex flex-col justify-between cursor-pointer brutal-shadow-sm hover:brutal-shadow transition ${
                  isDark 
                    ? 'bg-[#141d1b] hover:bg-[#1a2623] border-zinc-700' 
                    : 'bg-[#fdfbf7] hover:bg-white text-[#0b1110]'
                } ${
                  active ? (isDark ? 'ring-2 ring-[#17a398] bg-[#1a2623]' : 'ring-2 ring-[#0b1110] bg-white') : ''
                }`}
              >
                <div>
                  <div 
                    className="w-full aspect-square rounded-lg brutal-border mb-2.5 p-2 flex flex-col justify-between relative overflow-hidden shrink-0 shadow-inner"
                    style={{ backgroundColor: color }}
                  >
                    {track.cover && (
                      <img 
                        src={track.cover} 
                        alt={track.title} 
                        className="absolute inset-0 w-full h-full object-cover opacity-35" 
                      />
                    )}
                    <div className="flex justify-between items-center z-10">
                      <span className="text-[8px] font-mono font-bold bg-black/70 px-1.5 py-0.5 rounded uppercase text-white">
                        HQ AUDIO
                      </span>
                      <div className="flex items-center gap-1">
                        {toggleLike && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLike(track.id || track._id);
                            }}
                            className="p-1 rounded bg-black/50 hover:bg-black text-white hover:text-[#dc2626] transition cursor-pointer"
                            title="Like"
                          >
                            <Heart size={11} fill={track.liked ? '#dc2626' : 'none'} className={track.liked ? 'text-[#dc2626]' : ''} />
                          </button>
                        )}
                        <span className="text-[9px] font-mono font-bold text-white bg-black/50 px-1 rounded">
                          {durationFormatted}
                        </span>
                      </div>
                    </div>

                    <div className="z-10 text-center my-auto px-1">
                      <div className="font-display font-black text-sm text-white drop-shadow-[1px_1px_0px_#000] truncate">
                        {track.title ? track.title.split('(')[0] : 'Untitled'}
                      </div>
                      <div className="text-[10px] text-white/90 font-bold truncate">
                        {track.artist || 'Rivo Artist'}
                      </div>
                    </div>

                    <div className="z-10 text-[8px] font-mono bg-black/60 px-1.5 py-0.5 rounded text-center truncate text-emerald-300 font-bold">
                      {track.genre || 'Egyptian Rx'}
                    </div>
                  </div>

                  <div className={`font-display font-bold text-xs truncate ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
                    {track.title}
                  </div>
                  <div className={`text-[10px] font-bold truncate mb-2 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    {track.artist}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 w-full">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTrack(track);
                    }}
                    className="flex-1 bg-[#ded2bb] hover:bg-[#17a398] text-[#0b1110] font-display font-black text-[11px] py-1.5 rounded-lg brutal-border brutal-shadow-sm brutal-btn flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {active && isPlaying ? (
                      <>
                        <Pause size={12} fill="currentColor" />
                        <span>PAUSE</span>
                      </>
                    ) : (
                      <>
                        <Play size={12} fill="currentColor" />
                        <span>PLAY</span>
                      </>
                    )}
                  </button>
                  {onDeleteTrack && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirmTrackId(track.id || track._id);
                      }}
                      className="p-1.5 rounded-lg bg-white hover:bg-red-50 text-zinc-500 hover:text-red-600 brutal-border brutal-shadow-sm transition cursor-pointer shrink-0"
                      title="Delete track"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Confirm Delete Modal */}
      {deleteConfirmTrackId && (
        <ConfirmModal
          isOpen={Boolean(deleteConfirmTrackId)}
          onClose={() => setDeleteConfirmTrackId(null)}
          onConfirm={() => {
            onDeleteTrack(deleteConfirmTrackId);
            setDeleteConfirmTrackId(null);
          }}
          title="Delete Track?"
          message="Are you sure you want to remove this track from your library?"
          confirmText="Delete"
        />
      )}
    </div>
  );
}
