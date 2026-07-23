import React, { useState } from 'react';
import { Home, Search, Library, Plus, Heart, User, Trophy } from 'lucide-react';

export default function Navigation({ 
  currentScreen = 'home', 
  setCurrentScreen = () => {}, 
  playlists = [], 
  openCreatePlaylistModal = () => {}, 
  openSettings = () => {},
  openAddSongModal = () => {},
  openAuthModal = () => {},
  currentUser,
}) {
  const [libraryFilter, setLibraryFilter] = useState('all');

  const mainNavItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
  ];

  const mobileNavItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'library', label: 'Your Library', icon: Library },
    { id: 'stats', label: 'Stats', icon: Trophy },
  ];

  const safePlaylists = Array.isArray(playlists) ? playlists : [];

  return (
    <>
      {/* =============================================
          DESKTOP LEFT SIDEBAR
          ============================================= */}
      <aside className="hidden md:flex flex-col h-full shrink-0 gap-2 p-2" style={{ width: 'var(--nav-width)' }}>
        
        {/* ── Top Nav Panel ── */}
        <div className="bg-[#121212] rounded-lg p-3 flex flex-col gap-1">
          {/* Logo */}
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1ed760] to-[#12833b] flex items-center justify-center shadow-lg shadow-[#1DB954]/20 shrink-0">
              <svg width="60%" height="60%" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M 195 330 A 40 40 0 1 1 235 290 L 235 155 L 345 125 L 345 270 A 40 40 0 1 1 385 230 L 385 105 A 12 12 0 0 0 372 93 L 207 132 A 12 12 0 0 0 195 144 Z" fill="#000000" />
              </svg>
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white">Liofy</span>
          </div>

          {/* Main Nav Links */}
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const active = currentScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentScreen(item.id)}
                className="sp-nav-link"
                style={active ? { color: '#fff' } : {}}
              >
                <Icon 
                  size={24} 
                  fill={active ? 'white' : 'none'}
                  strokeWidth={active ? 0 : 2}
                  style={{ color: active ? '#fff' : '#b3b3b3', flexShrink: 0 }}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── Library Panel ── */}
        <div className="sp-library-panel flex-1 min-h-0">
          {/* Library Header */}
          <div className="flex items-center justify-between px-4 py-3">
            <button
              onClick={() => setCurrentScreen('library')}
              className="flex items-center gap-3 group"
            >
              <Library 
                size={24} 
                style={{ color: currentScreen === 'library' ? '#fff' : '#b3b3b3' }}
                fill={currentScreen === 'library' ? 'white' : 'none'}
                strokeWidth={currentScreen === 'library' ? 0 : 2}
              />
              <span className="font-bold text-sm" style={{ color: currentScreen === 'library' ? '#fff' : '#b3b3b3' }}>
                Your Library
              </span>
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={openAddSongModal}
                title="Add Song"
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-[#b3b3b3] hover:text-white transition-all"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 px-3 pb-2 overflow-x-auto">
            {['All', 'Playlists', 'Artists'].map((f) => (
              <button
                key={f}
                onClick={() => setLibraryFilter(f.toLowerCase())}
                className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all ${
                  libraryFilter === f.toLowerCase()
                    ? 'bg-white text-black'
                    : 'bg-[#2a2a2a] text-white hover:bg-[#3a3a3a]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Playlist List */}
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {safePlaylists.map((pl) => {
              const isActive = currentScreen === `playlist:${pl.id}` || currentScreen === 'playlist';
              return (
                <button
                  key={pl.id || Math.random()}
                  onClick={() => setCurrentScreen(`playlist:${pl.id}`)}
                  className={`w-full flex items-center gap-3 px-2 py-2 rounded-md text-left transition-all group ${
                    isActive ? 'bg-white/10' : 'hover:bg-white/10'
                  }`}
                >
                  {pl.isLikedSongs ? (
                    <div className="w-10 h-10 rounded flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg, #450af5, #c4efd9)' }}>
                      <Heart size={16} fill="white" className="text-white" />
                    </div>
                  ) : (
                    <img 
                      src={pl.cover} 
                      alt={pl.name} 
                      className="w-10 h-10 rounded object-cover shrink-0 shadow-md" 
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <div className="truncate flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate text-white">
                      {pl.name}
                    </p>
                    <p className="text-xs truncate" style={{ color: '#b3b3b3' }}>
                      Playlist • {(pl.trackIds || []).length} songs
                    </p>
                  </div>
                </button>
              );
            })}

            {safePlaylists.length === 0 && (
              <div className="px-4 py-6 text-center">
                <p className="text-sm font-bold text-white mb-1">Create your first playlist</p>
                <p className="text-xs mb-4" style={{ color: '#b3b3b3' }}>It's easy, we'll help you</p>
                <button 
                  onClick={openCreatePlaylistModal}
                  className="px-4 py-2 bg-white text-black text-sm font-bold rounded-full hover:scale-105 transition-transform"
                >
                  Create playlist
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── User Profile (Bottom) ── */}
        <div className="bg-[#121212] rounded-lg">
          <button
            onClick={openAuthModal}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 rounded-lg transition-all group"
          >
            {currentUser ? (
              <img src={currentUser.avatar} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover shadow-md" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#535353] flex items-center justify-center shrink-0">
                <User size={16} className="text-white" />
              </div>
            )}
            <span className="text-sm font-bold text-white truncate flex-1 text-left">
              {currentUser ? currentUser.name : 'Log in'}
            </span>
          </button>
        </div>
      </aside>

      {/* =============================================
          MOBILE BOTTOM NAVIGATION — Spotify Style
          ============================================= */}
      <nav className="md:hidden sp-mobile-nav">
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const active = currentScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentScreen(item.id)}
              className="flex flex-col items-center gap-1 transition-all px-2"
            >
              <Icon 
                size={22} 
                fill={active ? 'white' : 'none'} 
                strokeWidth={active ? 0 : 2}
                style={{ color: active ? '#fff' : '#b3b3b3' }}
              />
              <span 
                className="text-[10px] font-bold"
                style={{ color: active ? '#fff' : '#b3b3b3' }}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
