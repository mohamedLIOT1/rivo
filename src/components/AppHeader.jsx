import React from 'react';
import { Search as SearchIcon, X, Sun, Moon, Users, WifiOff, Menu } from 'lucide-react';
import { useUI } from '../context/UIContext';
import { useNavigation } from '../context/NavigationContext';
import RivoLogo from './RivoLogo';
import { buildUrl } from '../utils/router';

export default function AppHeader({ currentUser, handleUserAvatarClick }) {
  const {
    globalTheme,
    toggleGlobalTheme,
    isActivityPanelOpen,
    toggleActivityPanel,
    openMobileMenu,
    unreadChatCount,
  } = useUI();

  const {
    currentScreen,
    goToScreen,
    navigateTo,
    topSearchQuery,
    setTopSearchQuery,
  } = useNavigation();

  return (
    <header className="bg-[#0b1110] text-[#fdfbf7] brutal-border-thick border-x-0 border-t-0 px-2 sm:px-5 py-1.5 sm:py-2 flex items-center justify-between gap-1.5 sm:gap-3 z-30 shrink-0">
      {/* Brand identity: RIVO */}
      <div className="flex items-center gap-2 shrink-0 rivo-nav-logo">
        <div 
          onClick={() => goToScreen('home')} 
          className="cursor-pointer flex items-center shrink-0"
        >
          <RivoLogo size={32} showText={true} textClassName="text-white text-base sm:text-xl font-black" isDark={true} />
        </div>
      </div>

      {/* Retro Search Box - Visible on Both Mobile & Desktop */}
      <div className="flex flex-1 max-w-xs sm:max-w-md mx-1 sm:mx-4">
        <div className="relative w-full">
          <span className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3.5 flex items-center pointer-events-none text-emerald-400/70">
            <SearchIcon size={14} className="sm:w-4 sm:h-4" strokeWidth={2.5} />
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
            placeholder="ابحث عن سورة، قارئ، بودكاست..."
            className={`w-full text-[11px] sm:text-xs font-bold py-1.5 sm:py-2 pl-7 sm:pl-9 pr-6 sm:pr-8 rounded-full border focus:outline-none transition-colors ${
              globalTheme === 'dark' 
                ? 'bg-[#0f1d1a] border-emerald-900/80 text-white placeholder-emerald-400/40 focus:border-emerald-500' 
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
              className="absolute inset-y-0 right-0 pr-2 sm:pr-3 flex items-center text-zinc-400 hover:text-white cursor-pointer"
            >
              <X size={13} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Global Dark / Light Mode Switcher */}
          <button 
            onClick={toggleGlobalTheme}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 flex items-center justify-center cursor-pointer transition shrink-0"
            title={globalTheme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {globalTheme === 'dark' ? <Sun size={14} strokeWidth={2.5} /> : <Moon size={14} strokeWidth={2.5} />}
          </button>

          {/* Friend Activity Quick Toggle */}
          <button
            onClick={toggleActivityPanel}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center cursor-pointer transition shrink-0 ${
              isActivityPanelOpen
                ? 'bg-[#17a398] text-[#0b1110] border-2 border-black font-black'
                : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
            }`}
            title="Friend Activity"
          >
            <Users size={14} strokeWidth={2.5} />
          </button>

          {/* Quick Actions Drawer Toggle (☰ 3 bars) */}
          <button
            onClick={openMobileMenu}
            className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 flex items-center justify-center cursor-pointer transition shrink-0"
            title="Menu & Quick Tools"
          >
            <Menu size={15} strokeWidth={2.5} />
            {unreadChatCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white font-mono text-[9px] font-bold flex items-center justify-center">
                {unreadChatCount > 9 ? '9+' : unreadChatCount}
              </span>
            )}
          </button>
        </div>

        {/* User Avatar */}
        {currentUser && (
          <div 
            onClick={handleUserAvatarClick}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg overflow-hidden border border-emerald-500/40 cursor-pointer shrink-0 hover:scale-105 transition-transform"
            title={currentUser.name}
          >
            <img 
              src={currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name || 'U')}&background=10b981&color=000&bold=true`} 
              alt={currentUser.name} 
              className="w-full h-full object-cover" 
            />
          </div>
        )}
      </div>
    </header>
  );
}
