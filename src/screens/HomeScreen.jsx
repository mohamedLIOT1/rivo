import React, { useState } from 'react';
import { Play, Heart, Plus, Edit3, Trash2, Pause, User, LogOut, ChevronDown, Settings, Radio, MessageSquare } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

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
}) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [deleteConfirmTrackId, setDeleteConfirmTrackId] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

  const defaultTrackCover = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%231DB954"/><circle cx="150" cy="150" r="90" fill="%23121212"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="%231DB954" font-size="80">🎵</text></svg>`;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const isTrackActive = (t) => {
    if (!currentTrack || !t) return false;
    const curId = currentTrack.id || currentTrack._id;
    const tId = t.id || t._id;
    return Boolean(curId && tId && String(curId) === String(tId));
  };

  const displayTracks = React.useMemo(() => {
    if (!tracks || tracks.length === 0) return [];
    if (activeFilter === 'podcasts') {
      const podTracks = tracks.filter(t => t.isPodcast || t.album?.toLowerCase().includes('podcast') || t.artist?.toLowerCase().includes('podcast'));
      return podTracks.length > 0 ? podTracks : tracks;
    }
    return [...tracks];
  }, [tracks, activeFilter]);

  const quickItems = displayTracks.slice(0, 6);
  const suggestedItems = displayTracks;
  const recentItems = displayTracks.slice(0, 8);

  return (
    <div 
      className="flex-1 overflow-y-auto select-none"
      style={{ 
        background: 'linear-gradient(180deg, #1a1a2e 0%, #121212 40%)',
        paddingBottom: 'calc(var(--player-height) + 80px)',
      }}
    >
      {/* ─────────────────────────────────────────
          TOP GRADIENT HEADER
          ───────────────────────────────────────── */}
      <div 
        className="relative px-4 md:px-6 pt-4 md:pt-8 pb-4"
        style={{
          background: 'linear-gradient(180deg, rgba(29,185,84,0.18) 0%, transparent 100%)'
        }}
      >
        {/* Top Action Bar: Profile (Left) + Actions (Right) */}
        <div className="flex items-center justify-between gap-2 mb-3">
          {/* Profile Avatar & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="flex items-center gap-2 p-1 bg-black/40 hover:bg-black/70 border border-white/10 rounded-full transition-all cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-[#1DB954] flex items-center justify-center font-bold text-black text-sm uppercase overflow-hidden shrink-0">
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  currentUser?.name?.[0] || 'U'
                )}
              </div>
              <span className="hidden md:inline text-xs font-bold text-white pr-1 max-w-[100px] truncate">
                {currentUser?.name || 'Account'}
              </span>
              <ChevronDown size={14} className="text-zinc-400 hidden md:inline mr-1" />
            </button>

            {/* Profile Dropdown Menu */}
            {isProfileMenuOpen && (
              <div className="absolute left-0 mt-2 w-52 bg-[#282828] border border-white/10 rounded-xl shadow-2xl py-2 z-50 animate-in fade-in duration-150">
                <div className="px-4 py-2 border-b border-white/10">
                  <p className="text-xs font-bold text-white truncate">{currentUser?.name || 'Liofy User'}</p>
                  <p className="text-[10px] text-zinc-400 truncate">{currentUser?.email || 'Guest Account'}</p>
                </div>
                {currentUser ? (
                  <>
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        openProfileScreen();
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <User size={14} className="text-[#1DB954]" />
                      <span>بروفايلي (Profile)</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-400 hover:bg-white/10 flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut size={14} />
                      <span>Log Out</span>
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      openAuthModal();
                    }}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-[#1DB954] hover:bg-white/10 flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <User size={14} />
                    <span>Log In</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center gap-2">
            {/* Messages Button */}
            <button
              onClick={openChatModal}
              className="relative p-2 md:px-3.5 md:py-2 flex items-center gap-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition-all active:scale-95 shadow-sm"
              title="Direct Messages"
            >
              <MessageSquare size={16} className="text-[#1DB954]" />
              <span className="hidden sm:inline text-xs font-bold">Messages</span>
              {unreadChatCount > 0 && (
                <span className="absolute -top-1 -right-1 md:static px-1.5 py-0.5 rounded-full bg-[#1DB954] text-black font-black text-[9px] animate-pulse">
                  {unreadChatCount}
                </span>
              )}
            </button>

            {/* Jam Session Button */}
            <button
              onClick={openJamModal}
              className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 bg-cyan-950/70 hover:bg-cyan-900/90 px-3 py-2 rounded-full border border-cyan-500/30 shadow-sm transition-all active:scale-95"
              title="Spotify Jam Session"
            >
              <Radio size={14} className={`text-cyan-400 ${jamSession ? 'animate-pulse' : ''}`} />
              <span className="hidden sm:inline">{jamSession ? `Jam (${jamSession.code})` : 'Jam'}</span>
              <span className="sm:hidden font-bold">Jam</span>
            </button>

            {/* Add Song Button */}
            <button
              onClick={openAddSongModal}
              className="p-2 md:px-3.5 md:py-2 flex items-center gap-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-[#b3b3b3] hover:text-white transition-all active:scale-95"
              title="Add Song"
            >
              <Plus size={16} />
              <span className="hidden sm:inline text-xs font-bold">Add Song</span>
            </button>
          </div>
        </div>

        {/* Spacious Greeting Heading */}
        <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mt-2 mb-3">
          {getGreeting()}
        </h1>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
          {['all', 'music', 'podcasts'].map((pill) => (
            <button
              key={pill}
              onClick={() => setActiveFilter(pill)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold capitalize transition-all shrink-0 ${
                activeFilter === pill
                  ? 'bg-white text-black font-extrabold shadow-sm'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {pill === 'all' ? 'All' : pill === 'music' ? 'Music' : 'Podcasts'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 md:px-6">
        {tracks.length > 0 ? (
          <>
            {/* ─────────────────────────────────────────
                QUICK GRID (Home shortcut items)
                ───────────────────────────────────────── */}
            {quickItems.length > 0 && (
              <section className="mb-6 md:mb-8">
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 md:gap-2.5">
                  {quickItems.map((track) => {
                    const isCurrentAndPlaying = isTrackActive(track) && isPlaying;
                    return (
                      <div
                        key={track.id}
                        onClick={() => onSelectTrack(track, quickItems)}
                        className="sp-quick-item group"
                      >
                        <img 
                          src={track.cover || defaultTrackCover} 
                          onError={(e) => { e.target.src = defaultTrackCover; }}
                          alt={track.title} 
                          className="sp-quick-img"
                        />
                        <span className="sp-quick-label">{track.title}</span>
                        <button
                          className="sp-quick-play hidden md:flex"
                          onClick={(e) => { e.stopPropagation(); onSelectTrack(track, quickItems); }}
                        >
                          {isCurrentAndPlaying 
                            ? <Pause size={18} fill="black" />
                            : <Play size={18} fill="black" className="ml-0.5" />
                          }
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ─────────────────────────────────────────
                RECENTLY PLAYED
                ───────────────────────────────────────── */}
            {recentItems.length > 0 && (
              <section className="mb-6 md:mb-8">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <h2 className="sp-section-title">Recently played</h2>
                  <button className="sp-section-link">Show all</button>
                </div>
                <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 scrollbar-none md:grid md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 md:gap-4 md:mx-0 md:px-0">
                  {recentItems.slice(0, 8).map((track) => {
                    const isCurrentAndPlaying = isTrackActive(track) && isPlaying;
                    return (
                      <div
                        key={`recent-${track.id}`}
                        onClick={() => onSelectTrack(track, recentItems)}
                        className="sp-card w-[136px] shrink-0 md:w-auto relative group"
                      >
                        <div className="relative aspect-square mb-2.5">
                          <img 
                            src={track.cover || defaultTrackCover} 
                            onError={(e) => { e.target.src = defaultTrackCover; }}
                            alt={track.title} 
                            className="sp-card-img"
                            style={{ marginBottom: 0, borderRadius: '6px' }}
                          />
                          <button
                            className="sp-card-play hidden md:flex"
                            onClick={(e) => { e.stopPropagation(); onSelectTrack(track, recentItems); }}
                          >
                            {isCurrentAndPlaying 
                              ? <Pause size={20} fill="black" />
                              : <Play size={20} fill="black" className="ml-0.5" />
                            }
                          </button>
                        </div>
                        <p className="sp-card-title">{track.title}</p>
                        <p className="sp-card-subtitle">{track.artist}</p>
                        
                        {/* Edit/Delete on hover */}
                        <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1">
                          {onDeleteTrack && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmTrackId(track.id || track._id);
                              }}
                              className="w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                          {openEditSongModal && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); openEditSongModal(track); }}
                              className="w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-[#b3b3b3] hover:text-white transition-colors"
                            >
                              <Edit3 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ─────────────────────────────────────────
                MADE FOR YOU
                ───────────────────────────────────────── */}
            {suggestedItems.length > 6 && (
              <section className="mb-6 md:mb-8">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <h2 className="sp-section-title">Made for you</h2>
                  <button className="sp-section-link">Show all</button>
                </div>
                <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 scrollbar-none md:grid md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 md:gap-4 md:mx-0 md:px-0">
                  {suggestedItems.slice(6, 14).map((track) => {
                    const isCurrentAndPlaying = isTrackActive(track) && isPlaying;
                    return (
                      <div
                        key={`made-${track.id}`}
                        onClick={() => onSelectTrack(track, suggestedItems)}
                        className="sp-card w-[136px] shrink-0 md:w-auto relative group"
                      >
                        <div className="relative aspect-square mb-2.5">
                          <img 
                            src={track.cover || defaultTrackCover} 
                            onError={(e) => { e.target.src = defaultTrackCover; }}
                            alt={track.title} 
                            className="sp-card-img"
                            style={{ marginBottom: 0, borderRadius: '6px' }}
                          />
                          <button
                            className="sp-card-play hidden md:flex"
                            onClick={(e) => { e.stopPropagation(); onSelectTrack(track, suggestedItems); }}
                          >
                            {isCurrentAndPlaying 
                              ? <Pause size={20} fill="black" />
                              : <Play size={20} fill="black" className="ml-0.5" />
                            }
                          </button>
                        </div>
                        <p className="sp-card-title">{track.title}</p>
                        <p className="sp-card-subtitle">{track.artist}</p>
                        
                        <div className="absolute top-2 right-2 hidden group-hover:flex items-center gap-1">
                          {onDeleteTrack && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmTrackId(track.id || track._id);
                              }}
                              className="w-7 h-7 rounded-full bg-black/70 flex items-center justify-center text-red-400 hover:text-red-300 transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ─────────────────────────────────────────
                YOUR PLAYLISTS (if any)
                ───────────────────────────────────────── */}
            {playlists.length > 1 && (
              <section className="mb-6 md:mb-8">
                <div className="flex items-center justify-between mb-3 md:mb-4">
                  <h2 className="sp-section-title">Your playlists</h2>
                  <button className="sp-section-link">Show all</button>
                </div>
                <div className="flex overflow-x-auto gap-3 pb-2 -mx-4 px-4 scrollbar-none md:grid md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 md:gap-4 md:mx-0 md:px-0">
                  {playlists.slice(1, 8).map((pl) => (
                    <div
                      key={pl.id}
                      onClick={() => onSelectPlaylist(pl)}
                      className="sp-card w-[136px] shrink-0 md:w-auto relative group"
                    >
                      <div className="relative aspect-square mb-2.5">
                        {pl.isLikedSongs ? (
                          <div 
                            className="w-full h-full rounded-md flex items-center justify-center"
                            style={{ background: 'linear-gradient(135deg, #450af5, #c4efd9)' }}
                          >
                            <Heart size={36} fill="white" className="text-white" />
                          </div>
                        ) : (
                          <img 
                            src={pl.cover} 
                            alt={pl.name}
                            className="sp-card-img"
                            style={{ marginBottom: 0, borderRadius: '6px' }}
                          />
                        )}
                        <button className="sp-card-play hidden md:flex">
                          <Play size={20} fill="black" className="ml-0.5" />
                        </button>
                      </div>
                      <p className="sp-card-title">{pl.name}</p>
                      <p className="sp-card-subtitle">{pl.description || `${(pl.trackIds||[]).length} songs`}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ─────────────────────────────────────────
                ALL SONGS (Complete Collection)
                ───────────────────────────────────────── */}
            {suggestedItems.length > 0 && (
              <section className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="sp-section-title">All songs ({tracks.length})</h2>
                </div>
                
                {/* Track List — Spotify table style */}
                <div className="flex flex-col">
                  {/* Table Header (desktop) */}
                  <div 
                    className="hidden md:grid gap-4 px-4 mb-2"
                    style={{ 
                      gridTemplateColumns: '16px minmax(120px, 4fr) minmax(120px, 2fr) auto',
                      borderBottom: '1px solid rgba(255,255,255,0.07)',
                      paddingBottom: '8px',
                    }}
                  >
                    <span style={{ color: '#b3b3b3', fontSize: '12px', fontWeight: 700 }}>#</span>
                    <span style={{ color: '#b3b3b3', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Title</span>
                    <span style={{ color: '#b3b3b3', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Artist</span>
                    <span style={{ color: '#b3b3b3', fontSize: '12px', fontWeight: 700 }}></span>
                  </div>

                  {suggestedItems.map((track, idx) => {
                    const isCurrentTrack = isTrackActive(track);
                    const isCurrentAndPlaying = isCurrentTrack && isPlaying;
                    return (
                      <div
                        key={`all-${track.id}`}
                        onClick={() => onSelectTrack(track)}
                        className="flex items-center gap-3 md:grid px-4 py-2 rounded-md cursor-pointer group transition-colors hover:bg-white/5"
                        style={{ gridTemplateColumns: '16px minmax(120px, 4fr) minmax(120px, 2fr) auto' }}
                      >
                        {/* Track number / Equalizer */}
                        <div className="hidden md:flex items-center justify-center w-4 shrink-0">
                          {isCurrentAndPlaying ? (
                            <div className="flex items-end gap-0.5 h-4">
                              <div className="sp-eq-bar" style={{ height: '8px' }} />
                              <div className="sp-eq-bar" style={{ height: '14px' }} />
                              <div className="sp-eq-bar" style={{ height: '6px' }} />
                            </div>
                          ) : (
                            <span className="text-sm group-hover:hidden" style={{ color: isCurrentTrack ? '#1DB954' : '#b3b3b3' }}>
                              {idx + 1}
                            </span>
                          )}
                          <Play 
                            size={14} 
                            fill="white" 
                            className="hidden group-hover:block text-white" 
                          />
                        </div>

                        {/* Title + Cover */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <img 
                            src={track.cover || defaultTrackCover} 
                            onError={(e) => { e.target.src = defaultTrackCover; }}
                            alt={track.title}
                            className="w-10 h-10 rounded object-cover shrink-0 shadow-md"
                          />
                          <div className="truncate">
                            <p className="text-sm font-semibold truncate" style={{ color: isCurrentTrack ? '#1DB954' : 'white' }}>
                              {track.title}
                            </p>
                            <p className="text-xs truncate md:hidden" style={{ color: '#b3b3b3' }}>{track.artist}</p>
                          </div>
                        </div>

                        {/* Artist (desktop) */}
                        <p className="hidden md:block text-sm truncate" style={{ color: '#b3b3b3' }}>
                          {track.artist}
                        </p>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleLike(track.id); }}
                            className="p-1.5 transition-all"
                            title="Like"
                          >
                            <Heart 
                              size={15} 
                              className={track.liked ? 'fill-white text-white' : 'text-[#b3b3b3] hover:text-white'}
                            />
                          </button>
                          {openEditSongModal && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); openEditSongModal(track); }}
                              className="p-1.5 text-[#b3b3b3] hover:text-white transition-colors"
                            >
                              <Edit3 size={14} />
                            </button>
                          )}
                          {onDeleteTrack && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteConfirmTrackId(track.id || track._id);
                              }}
                              className="p-1.5 text-[#b3b3b3] hover:text-red-400 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        ) : (
          /* ─────────────────────────────────────────
              EMPTY STATE — Spotify Style
              ───────────────────────────────────────── */
          <div className="flex flex-col items-center justify-center text-center py-20 px-8 max-w-sm mx-auto">
            <div 
              className="w-24 h-24 rounded-full flex items-center justify-center mb-6"
              style={{ background: 'linear-gradient(135deg, #450af5, #1DB954)' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-12 h-12">
                <path d="M9 3v10.55A4 4 0 1 0 11 17V7h4V3H9Z"/>
              </svg>
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-2">
              Start listening
            </h2>
            <p className="text-sm mb-8" style={{ color: '#b3b3b3' }}>
              Add your custom songs and synced lyrics to start your music journey.
            </p>
            <button
              onClick={openAddSongModal}
              className="sp-btn-primary"
            >
              Add your first song
            </button>
          </div>
        )}
      {/* Custom Confirm Delete Modal */}
      <ConfirmModal
        isOpen={Boolean(deleteConfirmTrackId)}
        title="Are you sure you want to delete this song?"
        message="This song will be permanently deleted from your library."
        confirmText="Delete Song"
        cancelText="Cancel"
        onConfirm={() => {
          if (deleteConfirmTrackId && onDeleteTrack) {
            onDeleteTrack(deleteConfirmTrackId);
          }
          setDeleteConfirmTrackId(null);
        }}
        onCancel={() => setDeleteConfirmTrackId(null)}
      />
      </div>
    </div>
  );
}
