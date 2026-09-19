import React, { useState } from 'react';
import { Home, Search, Disc, Plus, Heart, User, Radio, DownloadCloud, MessageSquare, Command, Users, Sparkles, Link2, Music, ShieldCheck } from 'lucide-react';
import VerifiedBadge, { isUserVerified } from './VerifiedBadge';
import { isUserAdmin } from '../utils/adminUtils';
import RivoLogo from './RivoLogo';

export default function Navigation({ 
  currentScreen = 'home', 
  setCurrentScreen = () => {}, 
  playlists = [], 
  openCreatePlaylistModal = () => {}, 
  openSettings = () => {},
  openAddSongModal = () => {},
  openAuthModal = () => {},
  openImportPlaylistModal = () => {},
  openImportSongModal = () => {},
  openJamModal = () => {},
  openChatModal = () => {},
  openShortcutsModal = () => {},
  unreadChatCount = 0,
  currentUser,
  isActivityPanelOpen = false,
  toggleActivityPanel = () => {},
  globalTheme = 'dark',
}) {
  const isDark = globalTheme === 'dark';
  const [libraryFilter, setLibraryFilter] = useState('all');

  const mainNavItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'mixes', label: 'DJ Mix', icon: Radio },
    { id: 'stats', label: 'Stats & History', icon: Disc },
  ];

  const mobileNavItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'library', label: 'Library', icon: Disc },
    { id: 'mixes', label: 'DJ Mix', icon: Radio },
  ];

  const safePlaylists = Array.isArray(playlists) ? playlists : [];
  const filteredPlaylists = safePlaylists.filter(pl => {
    if (libraryFilter === 'playlists') return !pl.isArtistMix;
    if (libraryFilter === 'artists') return Boolean(pl.isArtistMix);
    return true;
  });

  return (
    <>
      {/* =============================================
          DESKTOP LEFT APOTHECARY SIDEBAR
          ============================================= */}
      <aside 
        className={`hidden md:flex flex-col h-full shrink-0 brutal-border border-y-0 border-l-0 p-3.5 justify-between select-none overflow-hidden transition-colors ${
          isDark 
            ? 'bg-[#101716] border-zinc-800 text-white' 
            : 'bg-[#fdfbf7] border-[#0b1110] text-[#0b1110]'
        }`} 
        style={{ width: 'var(--nav-width)' }}
      >
        <div className="flex flex-col h-full space-y-3.5 overflow-hidden">
          
          {/* ── Brand Header (Rivo) ── */}
          <div className={`px-1 pt-1 pb-2 border-b-2 border-dashed ${
            isDark ? 'border-zinc-800' : 'border-[#ded2bb]'
          }`}>
            <RivoLogo size={36} showText={true} isDark={isDark} />
          </div>

          {/* ── Primary Navigation ── */}
          <div className="space-y-1">
            <div className={`text-[10px] font-mono font-bold uppercase px-2 mb-1 ${
              isDark ? 'text-zinc-500' : 'text-zinc-500'
            }`}>
              Navigation
            </div>

            {mainNavItems.map((item) => {
              const Icon = item.icon;
              const active = currentScreen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentScreen(item.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-display font-bold text-xs transition-all brutal-btn ${
                    active 
                      ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm brutal-border font-black' 
                      : isDark
                        ? 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                        : 'text-[#0b1110] hover:bg-[#ede5d3]'
                  }`}
                >
                  <Icon 
                    size={17} 
                    className={active ? 'text-[#0b1110] shrink-0' : isDark ? 'text-zinc-400 shrink-0' : 'text-zinc-600 shrink-0'}
                    strokeWidth={2.5}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* Jam Session Button */}
            <button
              onClick={openJamModal}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-display font-bold text-xs transition-all brutal-btn ${
                currentScreen === 'jam'
                  ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm brutal-border font-black'
                  : isDark
                    ? 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white'
                    : 'text-[#0b1110] hover:bg-[#ede5d3]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Radio size={17} className={currentScreen === 'jam' ? 'text-[#0b1110] shrink-0' : 'text-[#17a398] shrink-0'} strokeWidth={2.5} />
                <span>Jam Session</span>
              </div>
              <span className="font-mono text-[9px] bg-[#f59e0b] text-[#0b1110] font-black px-1 rounded brutal-border">
                LIVE
              </span>
            </button>

            {/* Telegram / Messages Drawer Toggle */}
            <button
              onClick={openChatModal}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-display font-bold text-xs transition-all brutal-btn ${
                isDark 
                  ? 'text-zinc-300 hover:bg-zinc-800/80 hover:text-white' 
                  : 'text-[#0b1110] hover:bg-[#ede5d3]'
              }`}
            >
              <div className="flex items-center gap-3">
                <MessageSquare size={17} className="text-[#dc2626] shrink-0" strokeWidth={2.5} />
                <span>Messages</span>
              </div>
              {unreadChatCount > 0 ? (
                <span className="bg-[#dc2626] text-white text-[9px] font-mono px-1.5 py-0.2 rounded-full font-bold brutal-border animate-pulse">
                  {unreadChatCount}
                </span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-[#17a398]"></span>
              )}
            </button>

            <button
              onClick={toggleActivityPanel}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg font-display font-bold text-xs transition-all brutal-btn ${
                isActivityPanelOpen 
                  ? isDark ? 'bg-zinc-800 text-white font-black' : 'bg-[#ede5d3] text-[#0b1110] font-black' 
                  : isDark ? 'text-zinc-300 hover:bg-zinc-800/80' : 'text-[#0b1110] hover:bg-[#ede5d3]'
              }`}
            >
              <Users size={17} className="text-[#17a398] shrink-0" strokeWidth={2.5} />
              <span>Listening Activity</span>
            </button>

            {/* Admin Portal Button */}
            {isUserAdmin(currentUser) && (
              <button
                onClick={() => setCurrentScreen('admin')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg font-display font-bold text-xs transition-all brutal-btn ${
                  currentScreen === 'admin'
                    ? 'bg-[#f59e0b] text-[#0b1110] brutal-shadow-sm brutal-border font-black'
                    : isDark
                      ? 'text-[#f59e0b] hover:bg-zinc-800/80 hover:text-amber-300'
                      : 'text-[#b45309] hover:bg-[#ede5d3]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <ShieldCheck size={17} className={currentScreen === 'admin' ? 'text-[#0b1110] shrink-0' : 'text-[#f59e0b] shrink-0'} strokeWidth={2.5} />
                  <span>Admin Dashboard</span>
                </div>
                <span className="font-mono text-[8px] bg-[#f59e0b] text-[#0b1110] font-black px-1.5 py-0.5 rounded-full brutal-border">
                  ADMIN
                </span>
              </button>
            )}
          </div>

          {/* ── "Your Dispensary" Library Section ── */}
          <div className={`pt-2 border-t-2 border-dashed flex-1 flex flex-col min-h-0 ${
            isDark ? 'border-zinc-800' : 'border-[#ded2bb]'
          }`}>
            <div className="flex items-center justify-between px-2 mb-2">
              <div className={`flex items-center gap-1.5 text-[11px] font-display font-bold ${
                isDark ? 'text-zinc-200' : 'text-[#0b1110]'
              }`}>
                <Disc size={15} className="text-[#17a398]" strokeWidth={2.5} />
                <span>Your Library</span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={openImportSongModal}
                  title="Import Song by Link"
                  className={`w-6 h-6 rounded brutal-border flex items-center justify-center font-bold text-xs transition ${
                    isDark 
                      ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-[#17a398]' 
                      : 'bg-white hover:bg-[#ede5d3] text-[#082621]'
                  }`}
                >
                  <Link2 size={12} />
                </button>
                <button
                  onClick={openImportPlaylistModal}
                  title="Import Playlist"
                  className={`w-6 h-6 rounded brutal-border flex items-center justify-center font-bold text-xs transition ${
                    isDark 
                      ? 'bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-200' 
                      : 'bg-white hover:bg-[#ede5d3] text-[#0b1110]'
                  }`}
                >
                  <DownloadCloud size={12} />
                </button>
                <button
                  onClick={openCreatePlaylistModal}
                  title="New Playlist"
                  className="w-6 h-6 rounded brutal-border bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] flex items-center justify-center font-bold text-xs transition brutal-shadow-sm"
                >
                  +
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex gap-1 mb-2 px-1">
              {['All', 'Playlists', 'Artists'].map((f) => {
                const active = libraryFilter === f.toLowerCase();
                return (
                  <button
                    key={f}
                    onClick={() => setLibraryFilter(f.toLowerCase())}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                      active
                        ? 'bg-[#17a398] text-[#0b1110] brutal-border font-black'
                        : isDark
                          ? 'bg-zinc-800/80 text-zinc-300 border border-zinc-700 hover:bg-zinc-700'
                          : 'bg-white text-zinc-700 border border-[#0b1110] hover:bg-[#ede5d3]'
                    }`}
                  >
                    {f}
                  </button>
                );
              })}
            </div>

            {/* Playlists List */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs font-bold">
              {/* Liked Songs */}
              <div
                onClick={() => setCurrentScreen('library')}
                className={`p-2 rounded-lg brutal-border flex items-center justify-between cursor-pointer transition group ${
                  isDark 
                    ? 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800 text-white' 
                    : 'bg-white hover:bg-[#ede5d3] text-[#0b1110]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded bg-[#dc2626] text-white flex items-center justify-center shrink-0">
                    <Heart size={12} fill="currentColor" />
                  </div>
                  <div className="truncate">
                    <div className={`truncate leading-none ${isDark ? 'text-zinc-200' : 'text-[#0b1110]'}`}>
                      Liked Songs
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500 font-normal">Favorites</span>
                  </div>
                </div>
                <span className="text-[9px] font-mono text-zinc-400 font-bold">AUTO</span>
              </div>

              {filteredPlaylists.map((pl, idx) => {
                const isActive = currentScreen === `playlist:${pl.id}` || (currentScreen === 'playlist' && pl.id);
                const count = (pl.trackIds || []).length;
                const colors = ['#1e3a8a', '#f59e0b', '#0f756d', '#dc2626', '#ec4899'];
                const badgeColor = colors[idx % colors.length];

                return (
                  <div
                    key={pl.id || idx}
                    onClick={() => setCurrentScreen(`playlist:${pl.id}`)}
                    className={`p-2 rounded-lg brutal-border flex items-center justify-between cursor-pointer transition ${
                      isActive 
                        ? isDark ? 'bg-zinc-800 border-zinc-600 brutal-shadow-sm' : 'bg-[#ede5d3] brutal-shadow-sm'
                        : isDark ? 'bg-zinc-900/90 border-zinc-800 hover:bg-zinc-800 text-zinc-300' : 'bg-white hover:bg-[#ede5d3]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {pl.cover ? (
                        <img 
                          src={pl.cover} 
                          alt={pl.name} 
                          className="w-6 h-6 rounded object-cover border border-zinc-700 shrink-0" 
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div 
                          className="w-6 h-6 rounded text-white flex items-center justify-center shrink-0 font-mono text-[10px] font-bold"
                          style={{ backgroundColor: badgeColor }}
                        >
                          {pl.name ? pl.name[0].toUpperCase() : 'P'}
                        </div>
                      )}
                      <div className="truncate">
                        <div className={`truncate leading-none ${isDark ? 'text-zinc-200' : 'text-[#0b1110]'}`}>{pl.name}</div>
                        <span className="text-[10px] font-mono text-zinc-500 font-normal">
                          {count} {count === 1 ? 'song' : 'songs'}
                        </span>
                      </div>
                    </div>
                    <span className={`text-[8px] font-mono font-bold px-1 py-0.5 rounded ${
                      isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-[#ede5d3] text-[#0b1110]'
                    }`}>
                      LIST
                    </span>
                  </div>
                );
              })}

              {filteredPlaylists.length === 0 && (
                <div className={`p-3 text-center rounded-lg border border-dashed ${
                  isDark ? 'bg-zinc-900/60 border-zinc-700' : 'bg-white border-zinc-400'
                }`}>
                  <p className={`text-[11px] font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>No playlists yet</p>
                  <button
                    onClick={openCreatePlaylistModal}
                    className="mt-1.5 px-2.5 py-1 bg-[#17a398] text-[#0b1110] text-[10px] font-bold rounded brutal-border brutal-shadow-sm"
                  >
                    + Create Playlist
                  </button>
                </div>
              )}
            </div>

            {/* Quality Guarantee Badge */}
            <div className={`mt-2 p-2.5 rounded-xl brutal-border text-center shrink-0 ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-[#ded2bb] border-[#0b1110]'
            }`}>
              <div className={`text-[10px] font-display font-black tracking-wide ${
                isDark ? 'text-zinc-200' : 'text-[#0b1110]'
              }`}>
                HI-FI AUDIO QUALITY
              </div>
              <p className={`text-[9px] leading-snug mt-0.5 font-medium ${
                isDark ? 'text-zinc-400' : 'text-zinc-700'
              }`}>
                High fidelity • Seamless streaming
              </p>
              <div className={`text-[8px] font-mono font-bold pt-1 ${
                isDark ? 'text-zinc-500' : 'text-zinc-600'
              }`}>
                LIOFY MUSIC
              </div>
            </div>

          </div>

          {/* ── User & Shortcuts Bar (Bottom) ── */}
          <div className={`p-2 rounded-xl brutal-border flex items-center justify-between gap-2.5 mt-auto shrink-0 ${
            isDark ? 'bg-[#141d1b] border-zinc-800' : 'bg-[#ede5d3] border-black'
          }`}>
            <button
              onClick={openAuthModal}
              className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer group"
              title={currentUser ? "Account Profile" : "Log In"}
            >
              <div className="w-9 h-9 rounded-lg bg-[#17a398] brutal-border flex items-center justify-center font-display font-black text-xs text-[#0b1110] brutal-shadow-sm shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
                {currentUser?.avatar ? (
                  <img src={currentUser.avatar} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  currentUser?.name?.[0] || 'R'
                )}
              </div>
              <div className="min-w-0 flex-1 flex flex-col justify-center pt-1">
                <div className={`text-xs font-display font-black truncate flex items-center gap-1 leading-snug ${
                  isDark ? 'text-zinc-100 group-hover:text-white' : 'text-[#0b1110] group-hover:text-black'
                }`}>
                  <span className="truncate">{currentUser ? currentUser.name : 'Sign In'}</span>
                  {currentUser && isUserVerified(currentUser) && <VerifiedBadge size={13} />}
                </div>
                <div className="mt-0.5 flex items-center gap-1">
                  <span className={`inline-flex items-center text-[8px] font-mono font-black uppercase px-1.5 py-0.5 rounded brutal-border leading-none ${
                    currentUser && isUserAdmin(currentUser) 
                      ? 'bg-[#f59e0b] text-[#0b1110]' 
                      : currentUser 
                        ? 'bg-[#17a398] text-[#0b1110]' 
                        : 'bg-[#f59e0b] text-[#0b1110]'
                  }`}>
                    {currentUser && isUserAdmin(currentUser) ? 'ADMIN' : currentUser ? 'ONLINE' : 'GUEST'}
                  </span>
                </div>
              </div>
            </button>

            {openShortcutsModal && (
              <button
                onClick={openShortcutsModal}
                title="Keyboard Shortcuts (?)"
                className={`w-9 h-9 rounded-lg brutal-border flex items-center justify-center transition shrink-0 cursor-pointer ${
                  isDark 
                    ? 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white' 
                    : 'bg-white border-[#0b1110] text-[#0b1110] hover:bg-[#ded2bb]'
                }`}
              >
                <Command size={14} strokeWidth={2.5} />
              </button>
            )}
          </div>

        </div>
      </aside>

      {/* =============================================
          MOBILE BOTTOM NAVIGATION — Rivo Apothecary Style
          ============================================= */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-40 brutal-border-thick border-x-0 border-b-0 py-2 px-3 flex items-center justify-around shadow-2xl transition-colors ${
        isDark 
          ? 'bg-[#101716] border-zinc-800 text-white' 
          : 'bg-[#fdfbf7] border-black text-[#0b1110]'
      }`}>
        {mobileNavItems.map((item) => {
          const Icon = item.icon;
          const active = currentScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentScreen(item.id)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition ${
                active 
                  ? 'bg-[#17a398] text-[#0b1110] brutal-border font-bold' 
                  : isDark 
                    ? 'text-zinc-400 hover:text-white' 
                    : 'text-[#0b1110]'
              }`}
            >
              <Icon 
                size={18} 
                className={active ? 'text-[#0b1110]' : isDark ? 'text-zinc-400' : 'text-[#0b1110]'} 
                strokeWidth={2.5} 
              />
              <span className="text-[9px] font-display font-bold">
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
