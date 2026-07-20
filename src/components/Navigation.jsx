import React from 'react';
import { Home, Search, Library, Sparkles, Trophy, Plus, Heart, Music2, User, Radio, Users } from 'lucide-react';

export default function Navigation({ 
  currentScreen = 'home', 
  setCurrentScreen = () => {}, 
  playlists = [], 
  openCreatePlaylistModal = () => {}, 
  openSettings = () => {}, 
  openAddSongModal = () => {},
  openAuthModal = () => {},
  openJamModal = () => {},
  openBlendModal = () => {},
  currentUser,
  jamSession
}) {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'mixes', label: 'AI DJ & Mixes', icon: Sparkles },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'library', label: 'Your Library', icon: Library },
    { id: 'stats', label: 'Weekly Leaderboard', icon: Trophy }
  ];

  const safePlaylists = Array.isArray(playlists) ? playlists : [];

  return (
    <>
      {/* Desktop & Tablet Left Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-black p-4 gap-3 select-none shrink-0 h-full border-r border-zinc-900 overflow-y-auto">
        {/* Brand & User Profile Header */}
        <div className="flex items-center justify-between px-2 py-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#1DB954] flex items-center justify-center font-black text-black text-xl tracking-wider shadow-lg">
              L
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-white">Liofy</span>
          </div>

          <button
            onClick={openAuthModal}
            className="flex items-center gap-2 p-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-full border border-zinc-800 transition-colors"
            title="User Profile & Accounts"
          >
            {currentUser ? (
              <img src={currentUser.avatar} alt={currentUser.name} className="w-7 h-7 rounded-full object-cover" />
            ) : (
              <User size={18} className="text-zinc-300" />
            )}
          </button>
        </div>

        {/* Live Jam Room Button */}
        <button
          onClick={openJamModal}
          className={`w-full py-2.5 px-3.5 rounded-xl text-xs font-black flex items-center justify-between transition-all border ${
            jamSession 
              ? 'bg-cyan-950 border-cyan-500 text-cyan-300 shadow-lg' 
              : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Radio size={16} className={jamSession ? 'text-cyan-400 animate-pulse' : ''} />
            <span>{jamSession ? `Jam: ${jamSession.code}` : 'Start Jam Session'}</span>
          </div>
          {jamSession && <span className="text-[10px] bg-cyan-400 text-black px-2 py-0.5 rounded-full font-bold">Live</span>}
        </button>

        {/* Spotify Blend Button */}
        <button
          onClick={openBlendModal}
          className="w-full bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 font-extrabold py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-all text-xs"
        >
          <Users size={16} />
          <span>+ Create Friend Blend</span>
        </button>

        {/* Add Song & Timed Lyrics Studio Button */}
        <button
          onClick={openAddSongModal}
          className="w-full bg-gradient-to-r from-emerald-600 to-[#1DB954] text-black font-extrabold py-2 px-3 rounded-xl flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] active:scale-95 transition-all text-xs"
        >
          <Music2 size={16} />
          <span>+ Add Song & Lyrics</span>
        </button>

        <nav className="flex flex-col gap-1 bg-[#121212] p-2.5 rounded-xl border border-zinc-900">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentScreen(item.id)}
                className={`flex items-center gap-4 px-3.5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  active 
                    ? 'text-white bg-zinc-800/90 shadow-md border-l-4 border-[#1DB954]' 
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                }`}
              >
                <Icon size={19} className={active ? 'text-[#1DB954]' : ''} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Playlists List */}
        <div className="flex-1 bg-[#121212] p-3 rounded-xl flex flex-col gap-2 overflow-hidden border border-zinc-900 min-h-[140px]">
          <div className="flex items-center justify-between px-2 py-1 text-zinc-400 text-[11px] font-bold uppercase tracking-wider">
            <span>Playlists</span>
            <button 
              onClick={openCreatePlaylistModal}
              className="p-1 hover:text-white hover:bg-zinc-800 rounded-full transition-colors"
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-1">
            {safePlaylists.map((pl) => (
              <button
                key={pl.id || Math.random()}
                onClick={() => setCurrentScreen(`playlist:${pl.id}`)}
                className="flex items-center gap-3 p-2 rounded-lg text-left text-sm text-zinc-300 hover:text-white hover:bg-zinc-800/50 transition-colors group"
              >
                {pl.isLikedSongs ? (
                  <div className="w-8 h-8 rounded bg-gradient-to-br from-indigo-600 to-purple-800 flex items-center justify-center text-white shrink-0">
                    <Heart size={14} fill="currentColor" />
                  </div>
                ) : (
                  <img src={pl.cover} alt={pl.name} className="w-8 h-8 rounded object-cover shrink-0" />
                )}
                <div className="truncate flex-1">
                  <p className="font-medium truncate text-xs">{pl.name}</p>
                  <p className="text-[11px] text-zinc-500 truncate">{(pl.trackIds || []).length} tracks</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 backdrop-blur-xl border-t border-zinc-800/80 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = currentScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentScreen(item.id)}
              className={`flex flex-col items-center gap-1 text-[10px] font-medium transition-all ${
                active ? 'text-[#1DB954] scale-105 font-bold' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Icon size={19} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
