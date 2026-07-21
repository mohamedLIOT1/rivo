import React, { useState } from 'react';
import { Heart, Plus, Download, Grid, List, Search } from 'lucide-react';

export default function LibraryScreen({ playlists, tracks, onSelectPlaylist, onSelectTrack, openCreatePlaylistModal, toggleLike }) {
  const [filter, setFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'grid'
  const [search, setSearch] = useState('');

  const likedTracks = tracks.filter((t) => t.liked);
  const downloadedTracks = tracks.filter((t) => t.downloaded);

  const allItems = [
    // Liked Songs — always first
    ...(playlists.length > 0 ? [playlists[0]] : []),
    // Other playlists
    ...playlists.slice(1)
  ].filter(item => {
    if (filter === 'playlists') return true;
    if (filter === 'downloads') return false;
    return true;
  }).filter(item => {
    if (!search) return true;
    return item.name.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div 
      className="flex-1 overflow-y-auto select-none"
      style={{ 
        background: '#121212',
        paddingBottom: 'calc(var(--player-height) + 32px)',
      }}
    >
      {/* ── Library Header ── */}
      <div className="px-4 md:px-6 pt-6 pb-2">
        {/* Title + Actions */}
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Your Library</h1>
          <button
            onClick={openCreatePlaylistModal}
            className="w-9 h-9 flex items-center justify-center rounded-full text-[#b3b3b3] hover:text-white hover:bg-white/10 transition-all"
            title="Create playlist"
          >
            <Plus size={22} />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {[
            { id: 'all', label: 'All' },
            { id: 'playlists', label: 'Playlists' },
            { id: 'downloads', label: 'Downloads' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className="px-3 py-1.5 rounded-full text-sm font-bold shrink-0 transition-all"
              style={filter === f.id
                ? { background: 'white', color: 'black' }
                : { background: '#2a2a2a', color: 'white' }
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search + View Toggle (when there are playlists) */}
        {playlists.length > 2 && (
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1 max-w-xs">
              <Search 
                size={16} 
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" 
                style={{ color: '#b3b3b3' }}
              />
              <input
                type="text"
                placeholder="Search in library"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-sm font-semibold pl-9 pr-3 py-2 rounded-md"
                style={{ background: '#2a2a2a', color: 'white', border: 'none', outline: 'none' }}
              />
            </div>
            <button
              onClick={() => setViewMode(v => v === 'list' ? 'grid' : 'list')}
              className="p-2 rounded transition-colors"
              style={{ color: viewMode === 'grid' ? 'white' : '#b3b3b3' }}
              title="Toggle view"
            >
              {viewMode === 'list' ? <Grid size={20} /> : <List size={20} />}
            </button>
          </div>
        )}
      </div>

      <div className="px-4 md:px-6">
        {/* ── Playlists ── */}
        {filter !== 'downloads' && (
          viewMode === 'list' ? (
            /* List View */
            <div className="flex flex-col gap-1 mb-6">
              {allItems.map((pl) => {
                if (!pl) return null;
                return (
                  <button
                    key={pl.id}
                    onClick={() => onSelectPlaylist(pl)}
                    className="flex items-center gap-3 p-2 rounded-md text-left transition-colors group w-full hover:bg-white/10"
                  >
                    {pl.isLikedSongs ? (
                      <div 
                        className="w-12 h-12 rounded flex items-center justify-center shrink-0 shadow-lg"
                        style={{ background: 'linear-gradient(135deg, #450af5, #c4efd9)' }}
                      >
                        <Heart size={22} fill="white" className="text-white" />
                      </div>
                    ) : (
                      <img 
                        src={pl.cover} 
                        alt={pl.name} 
                        className="w-12 h-12 rounded object-cover shrink-0 shadow-md"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{pl.name}</p>
                      <p className="text-xs truncate mt-0.5" style={{ color: '#b3b3b3' }}>
                        {pl.isLikedSongs ? `Playlist • ${(pl.trackIds||[]).length} songs` : `Playlist • ${(pl.trackIds||[]).length} songs`}
                      </p>
                    </div>
                    {pl.isBlend && (
                      <span 
                        className="text-[10px] font-black px-2 py-1 rounded-full shrink-0"
                        style={{ background: '#1DB95420', color: '#1DB954' }}
                      >
                        Blend
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            /* Grid View */
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
              {allItems.map((pl) => {
                if (!pl) return null;
                return (
                  <div
                    key={pl.id}
                    onClick={() => onSelectPlaylist(pl)}
                    className="sp-card cursor-pointer"
                  >
                    {pl.isLikedSongs ? (
                      <div 
                        className="w-full aspect-square rounded mb-3 flex items-center justify-center shadow-2xl"
                        style={{ background: 'linear-gradient(135deg, #450af5, #c4efd9)' }}
                      >
                        <Heart size={52} fill="white" className="text-white" />
                      </div>
                    ) : (
                      <img 
                        src={pl.cover} 
                        alt={pl.name} 
                        className="sp-card-img"
                        onError={(e) => { e.target.style.display = 'none'; }}
                      />
                    )}
                    <p className="sp-card-title">{pl.name}</p>
                    <p className="sp-card-subtitle">Playlist • {(pl.trackIds||[]).length} songs</p>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── Empty State ── */}
        {filter !== 'downloads' && playlists.length <= 1 && (
          <div 
            className="mx-auto max-w-xs p-6 rounded-lg mb-6"
            style={{ background: '#282828' }}
          >
            <h3 className="text-base font-extrabold text-white mb-2">Create your first playlist</h3>
            <p className="text-sm mb-4" style={{ color: '#b3b3b3' }}>It's easy, we'll help you</p>
            <button
              onClick={openCreatePlaylistModal}
              className="px-5 py-2 bg-white text-black text-sm font-bold rounded-full hover:scale-105 transition-transform"
            >
              Create playlist
            </button>
          </div>
        )}

        {/* ── Downloads Section ── */}
        {(filter === 'all' || filter === 'downloads') && downloadedTracks.length > 0 && (
          <section className="mt-2 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Download size={18} style={{ color: '#1DB954' }} />
              <h2 className="text-xl font-extrabold text-white">Downloaded</h2>
              <span 
                className="text-xs font-bold px-2 py-1 rounded-full"
                style={{ background: '#1DB95420', color: '#1DB954' }}
              >
                {downloadedTracks.length}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              {downloadedTracks.map((track) => (
                <div
                  key={track.id}
                  onClick={() => onSelectTrack(track)}
                  className="flex items-center gap-3 p-2 rounded-md cursor-pointer hover:bg-white/10 transition-colors group"
                >
                  <img src={track.cover} alt={track.title} className="w-12 h-12 rounded object-cover shadow-md shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate group-hover:text-[#1DB954] transition-colors">
                      {track.title}
                    </p>
                    <p className="text-xs truncate" style={{ color: '#b3b3b3' }}>{track.artist}</p>
                  </div>
                  <span 
                    className="text-xs font-bold px-2 py-1 rounded-full shrink-0"
                    style={{ background: '#1DB95415', color: '#1DB954', border: '1px solid #1DB95440' }}
                  >
                    Offline
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {filter === 'downloads' && downloadedTracks.length === 0 && (
          <div className="text-center py-20">
            <Download size={48} className="mx-auto mb-4 opacity-30 text-white" />
            <p className="text-lg font-bold text-white mb-2">No downloaded songs</p>
            <p className="text-sm" style={{ color: '#b3b3b3' }}>Download songs to listen offline</p>
          </div>
        )}
      </div>
    </div>
  );
}
