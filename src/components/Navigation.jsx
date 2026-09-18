import React, { useState } from 'react';
import { Home, Search, Library, Plus, Heart, User, Trophy, Radio, DownloadCloud, MessageSquare, Command } from 'lucide-react';
import VerifiedBadge, { isUserVerified } from './VerifiedBadge';

export default function Navigation({ 
  currentScreen = 'home', 
  setCurrentScreen = () => {}, 
  playlists = [], 
  openCreatePlaylistModal = () => {}, 
  openSettings = () => {},
  openAddSongModal = () => {},
  openAuthModal = () => {},
  openImportPlaylistModal = () => {},
  openJamModal = () => {},
  openChatModal = () => {},
  openShortcutsModal = () => {},
  unreadChatCount = 0,
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
    { id: 'chat', label: 'Chat', icon: MessageSquare, badge: unreadChatCount },
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
          <div className="flex items-center gap-2 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-[#1DB954] flex items-center justify-center font-black text-black text-lg shadow-lg shrink-0">
              L
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
                className={`sp-nav-link ${active ? 'active text-white' : ''}`}
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

          <button
            onClick={openJamModal}
            className={`sp-nav-link ${currentScreen === 'jam' ? 'active' : ''}`}
            title="Start or Join Jam Session"
          >
            <Radio size={24} className="text-cyan-400 shrink-0" strokeWidth={2} />
            <span className="font-bold text-cyan-400">Jam Session</span>
          </button>

          <button
            onClick={openChatModal}
            className="sp-nav-link text-zinc-300 hover:text-white transition-colors relative"
            title="Direct Messages & Friends"
          >
            <MessageSquare size={24} className="text-[#b3b3b3] group-hover:text-white shrink-0" strokeWidth={2} />
            <span className="font-bold text-[#b3b3b3] group-hover:text-white flex-1 text-left">Messages</span>
            {unreadChatCount > 0 && (
              <span className="min-w-[22px] h-[22px] px-1.5 flex items-center justify-center rounded-full bg-[#1DB954] text-black text-xs font-black shadow-lg shadow-[#1DB954]/30 tracking-tight ml-auto">
                {unreadChatCount}
              </span>
            )}
          </button>
        </div>

        {/* ── Library Panel ── */}
        <div className="sp-library-panel flex-1 min-h-0">
          {/* Library Header */}
          <div className="flex items-center justify-between px-4 py-3 gap-2">
            <button
              onClick={() => setCurrentScreen('library')}
              className="flex items-center gap-3 group shrink-0"
            >
              <Library 
                size={24} 
                style={{ color: currentScreen === 'library' ? '#fff' : '#b3b3b3' }}
                fill={currentScreen === 'library' ? 'white' : 'none'}
                strokeWidth={currentScreen === 'library' ? 0 : 2}
                className="shrink-0"
              />
              <span className="font-bold text-sm whitespace-nowrap" style={{ color: currentScreen === 'library' ? '#fff' : '#b3b3b3' }}>
                Your Library
              </span>
            </button>

            <div className="flex items-center gap-1">
              <button
                onClick={openImportPlaylistModal}
                title="Import Spotify/YouTube/Apple playlist"
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer hover:scale-105 active:scale-95"
              >
                <DownloadCloud size={19} />
              </button>
              <button
                onClick={openCreatePlaylistModal}
                title="Create new playlist"
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-all cursor-pointer hover:scale-105 active:scale-95"
              >
                <Plus size={22} />
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

        {/* ── User Profile & Shortcuts (Bottom) ── */}
        <div className="bg-[#121212] rounded-lg flex items-center justify-between p-1">
          <button
            onClick={openAuthModal}
            className="flex-1 flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded-lg transition-all group min-w-0"
          >
            {currentUser ? (
              <img src={currentUser.avatar} alt={currentUser.name} className="w-8 h-8 rounded-full object-cover shadow-md" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-[#535353] flex items-center justify-center shrink-0">
                <User size={16} className="text-white" />
              </div>
            )}
            <span className="text-sm font-bold text-white truncate flex-1 text-left flex items-center gap-1">
              <span className="truncate">{currentUser ? currentUser.name : 'Log in'}</span>
              {currentUser && isUserVerified(currentUser) && <VerifiedBadge size={14} />}
            </span>
          </button>
          {openShortcutsModal && (
            <button
              onClick={openShortcutsModal}
              title="Keyboard Shortcuts (?)"
              className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all mr-1 shrink-0"
            >
              <Command size={16} />
            </button>
          )}
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
              onClick={() => {
                if (item.id === 'chat') {
                  openChatModal();
                } else {
                  setCurrentScreen(item.id);
                }
              }}
              className="flex flex-col items-center gap-1 transition-all px-2 relative"
            >
              <div className="relative">
                <Icon 
                  size={22} 
                  fill={active ? 'white' : 'none'} 
                  strokeWidth={active ? 0 : 2}
                  style={{ color: active ? '#fff' : '#b3b3b3' }}
                />
                {item.badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-4 px-1 rounded-full bg-[#1DB954] text-black font-black text-[9px] flex items-center justify-center shadow-md animate-pulse">
                    {item.badge}
                  </span>
                )}
              </div>
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
