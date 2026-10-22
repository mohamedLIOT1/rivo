import React from 'react';
import { Search as SearchIcon, X, Sun, Moon, Users, WifiOff, Menu } from 'lucide-react';
import { useUI } from '../context/UIContext';
import RivoLogo from './RivoLogo';
import { buildUrl } from '../utils/router';

export default function AppHeader({
  currentScreen,
  goToScreen,
  navigateTo,
  topSearchQuery,
  setTopSearchQuery,
  currentUser,
  handleUserAvatarClick,
}) {
  const {
    globalTheme,
    toggleGlobalTheme,
    isActivityPanelOpen,
    toggleActivityPanel,
    openMobileMenu,
    unreadChatCount,
  } = useUI();

  return (
    <header className="bg-[#0b1110] text-[#fdfbf7] brutal-border-thick border-x-0 border-t-0 px-2.5 sm:px-5 py-1.5 sm:py-2 flex items-center justify-between gap-1.5 sm:gap-3 z-30 shrink-0">
      {/* Brand identity: RIVO */}
      <div className="flex items-center gap-2 shrink-0 rivo-nav-logo">
        <div 
          onClick={() => goToScreen('home')} 
          className="cursor-pointer flex items-center shrink-0"
        >
          <RivoLogo size={34} showText={true} textClassName="text-white text-lg sm:text-xl" isDark={true} />
        </div>
      </div>

      {/* Retro Search Box */}
      <div className="hidden md:flex flex-1 max-w-md mx-4">
        <div className="relative w-full">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-500">
            <SearchIcon size={16} strokeWidth={2.5} />
          </span>
          <input 
            type="text" 
            value={topSearchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setTopSearchQuery(val);
              if (currentScreen !== 'search') {
                navigateTo('search', { query: val });
              } else if (typeof window !== 'undefined') {
                const targetUrl = buildUrl('search', { query: val });
                window.history.replaceState({ screen: 'search', params: { query: val } }, '', targetUrl);
              }
            }}
            placeholder="Search by dose, artist, prescription, or cassette..."
            className={`w-full text-xs font-bold py-2 pl-9 pr-8 rounded-full brutal-border focus:outline-none transition-colors brutal-shadow-sm ${
              globalTheme === 'dark' 
                ? 'bg-[#141d1b] border-zinc-700 text-white placeholder-zinc-500 focus:bg-[#182320]' 
                : 'bg-[#fdfbf7] border-black text-[#0b1110] placeholder-zinc-500 focus:bg-white'
            }`}
          />
          {topSearchQuery && (
            <button 
              onClick={() => {
                setTopSearchQuery('');
                if (currentScreen === 'search' && typeof window !== 'undefined') {
                  window.history.replaceState({ screen: 'search', params: { query: '' } }, '', '/search');
                }
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-500 hover:text-black cursor-pointer"
            >
              <X size={15} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Global Dark / Light Mode Switcher */}
          <button 
            onClick={toggleGlobalTheme}
            className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 flex items-center justify-center cursor-pointer transition shrink-0"
            title={globalTheme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {globalTheme === 'dark' ? <Sun size={15} strokeWidth={2.5} /> : <Moon size={15} strokeWidth={2.5} />}
          </button>

          {/* Friend Activity Quick Toggle */}
          <button
            onClick={toggleActivityPanel}
            className={`w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition shrink-0 ${
              isActivityPanelOpen
                ? 'bg-[#17a398] text-[#0b1110] border-2 border-black font-black'
                : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
            }`}
            title="Friend Activity"
          >
            <Users size={15} strokeWidth={2.5} />
          </button>

          {/* Direct Switch to Offline Vault Button (Mobile / Tablet) */}
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'SET_APP_MODE',
                  mode: 'offline'
                }));
              } else {
                goToScreen('library');
              }
            }}
            className="flex lg:hidden items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#17a398]/15 hover:bg-[#17a398]/25 text-[#17a398] border border-[#17a398]/40 cursor-pointer transition shrink-0 font-display font-black text-xs"
            title="Switch to Offline Mode (Local Vault)"
          >
            <WifiOff size={14} strokeWidth={2.5} />
            <span>Offline</span>
          </button>

          {/* Quick Actions Drawer Toggle (☰ 3 bars) */}
          <button
            onClick={openMobileMenu}
            className="relative w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 flex items-center justify-center cursor-pointer transition shrink-0"
            title="Menu & Quick Tools"
          >
            <Menu size={16} strokeWidth={2.5} />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#dc2626] rounded-full border border-black animate-pulse" />
            )}
          </button>
        </div>

        {/* User Profile Badge */}
        <div 
          onClick={handleUserAvatarClick}
          className="flex items-center gap-1.5 pl-1.5 sm:pl-2 border-l border-zinc-700/60 ml-0.5 sm:ml-1 cursor-pointer group shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-[#17a398] brutal-border flex items-center justify-center font-display font-black text-xs text-[#0b1110] brutal-shadow-sm overflow-hidden shrink-0 group-hover:scale-105 transition-transform">
            {currentUser?.avatar ? (
              <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              currentUser?.name?.[0] || 'R'
            )}
          </div>
          <div className="hidden sm:flex flex-col justify-center text-left">
            <span className="text-xs font-display font-bold leading-tight text-white truncate max-w-[90px] group-hover:text-[#17a398] transition-colors">
              {currentUser ? currentUser.name : 'Sign In'}
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${currentUser ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className="text-[8.5px] font-mono font-bold text-zinc-300 uppercase">
                {currentUser ? 'ONLINE' : 'GUEST'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
