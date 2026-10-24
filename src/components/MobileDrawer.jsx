import React from 'react';
import { X, Plus, Radio, MessageSquare, Users, WifiOff, User, Activity, ShieldCheck, Moon, Sun, Settings } from 'lucide-react';
import { useUI } from '../context/UIContext';
import { usePreferences } from '../context/PreferencesContext';
import RivoLogo from './RivoLogo';
import { isUserAdmin } from '../utils/adminUtils';

export default function MobileDrawer({
  currentUser,
  currentScreen,
  onNavigate,
  onOpenAuth,
  onOpenJam,
  onOpenChat,
  onOpenAddSong,
}) {
  const {
    isMobileMenuOpen,
    closeMobileMenu,
    globalTheme,
    toggleGlobalTheme,
    setIsSettingsOpen,
    unreadChatCount,
    isActivityPanelOpen,
    toggleActivityPanel,
  } = useUI();
  const { language } = usePreferences();

  if (!isMobileMenuOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end select-none animate-in fade-in duration-200">
      {/* Backdrop */}
      <div 
        onClick={closeMobileMenu} 
        className="fixed inset-0 bg-black/75 backdrop-blur-xs cursor-pointer" 
      />

      {/* Drawer Panel */}
      <div className={`relative w-72 max-w-[85vw] h-full flex flex-col brutal-border-thick border-y-0 border-r-0 shadow-2xl z-10 animate-in slide-in-from-right duration-200 ${
        globalTheme === 'dark' ? 'bg-[#101716] text-white border-zinc-800' : 'bg-[#fdfbf7] text-[#0b1110] border-black'
      }`}>
        {/* Header */}
        <div className={`p-3.5 border-b-2 flex items-center justify-between shrink-0 ${
          globalTheme === 'dark' ? 'border-zinc-800 bg-[#0b1110]' : 'border-black bg-[#ede5d3]'
        }`}>
          <RivoLogo size={28} showText={true} isDark={globalTheme === 'dark'} />
          <button
            onClick={closeMobileMenu}
            className={`w-8 h-8 rounded-lg brutal-border flex items-center justify-center brutal-btn cursor-pointer ${
              globalTheme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-white hover:bg-[#ded2bb] text-black'
            }`}
          >
            <X size={17} strokeWidth={2.5} />
          </button>
        </div>

        {/* Menu Links & Tools */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 font-display font-bold text-xs">
          {/* Quick Actions */}
          <div className="space-y-1">
            <div className="text-[10px] font-mono font-black uppercase tracking-wider text-zinc-500 mb-1 px-1">
              {language === 'ar' ? 'إجراءات سريعة' : 'Quick Actions'}
            </div>

            <button
              onClick={() => { onOpenAddSong?.(); closeMobileMenu(); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border brutal-shadow-sm brutal-btn cursor-pointer font-black"
            >
              <Plus size={17} strokeWidth={3} />
              <span>{language === 'ar' ? 'إضافة أغنية / رابط' : 'Add Song / Link'}</span>
            </button>

            <button
              onClick={() => { onOpenJam?.(); closeMobileMenu(); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg brutal-border brutal-shadow-sm brutal-btn cursor-pointer ${
                globalTheme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-white hover:bg-[#ede5d3] text-[#0b1110]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Radio size={16} className="text-[#f59e0b] animate-pulse" strokeWidth={2.5} />
                <span>{language === 'ar' ? 'جلسة مباشرة' : 'Jam Session'}</span>
              </div>
              <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-[#f59e0b] text-black brutal-border">
                LIVE
              </span>
            </button>

            <button
              onClick={() => { onOpenChat?.(null); closeMobileMenu(); }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg brutal-border brutal-shadow-sm brutal-btn cursor-pointer ${
                globalTheme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-white hover:bg-[#ede5d3] text-[#0b1110]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MessageSquare size={16} className="text-[#17a398]" strokeWidth={2.5} />
                <span>{language === 'ar' ? 'الرسائل والمحادثات' : 'Messages & Chat'}</span>
              </div>
              {unreadChatCount > 0 && (
                <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded-full bg-[#dc2626] text-white">
                  {unreadChatCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                toggleActivityPanel();
                closeMobileMenu();
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg brutal-border brutal-shadow-sm brutal-btn cursor-pointer ${
                globalTheme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-white hover:bg-[#ede5d3] text-[#0b1110]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Users size={16} className="text-[#17a398]" strokeWidth={2.5} />
                <span>{language === 'ar' ? 'نشاط الاستماع' : 'Listening Activity'}</span>
              </div>
              {isActivityPanelOpen && (
                <span className="w-2 h-2 rounded-full bg-[#17a398]" />
              )}
            </button>

            {/* Switch to Offline Mode ONLY when running in native webview container */}
            {typeof window !== 'undefined' && Boolean(window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') && (
              <button
                onClick={() => {
                  closeMobileMenu();
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'SET_APP_MODE',
                    mode: 'offline'
                  }));
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg brutal-border brutal-shadow-sm brutal-btn cursor-pointer ${
                  globalTheme === 'dark' ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-white hover:bg-[#ede5d3] text-[#0b1110]'
                }`}
              >
                <WifiOff size={16} className="text-amber-500" />
                <span>{language === 'ar' ? 'الخزنة المحلية (بدون إنترنت)' : 'Offline Music Vault'}</span>
              </button>
            )}
          </div>

          {/* Navigation Links */}
          <div className="space-y-1 pt-2 border-t-2 border-dashed border-zinc-800">
            <div className="text-[10px] font-mono font-black uppercase tracking-wider text-zinc-500 mb-1 px-1">
              {language === 'ar' ? 'الحساب والتنقل' : 'Account & Navigation'}
            </div>

            <a
              href="/profile"
              onClick={(e) => {
                e.preventDefault();
                if (currentUser) {
                  onNavigate('profile');
                } else {
                  onOpenAuth();
                }
                closeMobileMenu();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg brutal-btn cursor-pointer ${
                currentScreen === 'profile' 
                  ? 'bg-[#17a398] text-[#0b1110] font-black brutal-border' 
                  : globalTheme === 'dark' ? 'text-zinc-300 hover:bg-zinc-800/80' : 'text-[#0b1110] hover:bg-[#ede5d3]'
              }`}
            >
              <User size={16} className="text-[#17a398]" strokeWidth={2.5} />
              <span>{currentUser ? (language === 'ar' ? 'الملف الشخصي' : 'My Profile') : (language === 'ar' ? 'تسجيل الدخول' : 'Sign In')}</span>
            </a>

            <a
              href="/stats"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('stats');
                closeMobileMenu();
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg brutal-btn cursor-pointer ${
                currentScreen === 'stats' 
                  ? 'bg-[#17a398] text-[#0b1110] font-black brutal-border' 
                  : globalTheme === 'dark' ? 'text-zinc-300 hover:bg-zinc-800/80' : 'text-[#0b1110] hover:bg-[#ede5d3]'
              }`}
            >
              <Activity size={16} className="text-[#17a398]" strokeWidth={2.5} />
              <span>{language === 'ar' ? 'الإحصائيات والسجل' : 'Stats & History'}</span>
            </a>

            {isUserAdmin(currentUser) && (
              <a
                href="/admin"
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate('admin');
                  closeMobileMenu();
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg brutal-btn cursor-pointer ${
                  currentScreen === 'admin'
                    ? 'bg-[#f59e0b] text-[#0b1110] font-black brutal-border'
                    : 'bg-[#f59e0b]/20 hover:bg-[#f59e0b]/30 text-[#f59e0b] brutal-border border-[#f59e0b]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} strokeWidth={2.5} />
                  <span>{language === 'ar' ? 'لوحة الإدارة' : 'Admin Portal'}</span>
                </div>
                <span className="text-[8px] font-mono font-black px-1.5 py-0.5 rounded bg-[#f59e0b] text-black">
                  ADMIN
                </span>
              </a>
            )}
          </div>

          {/* Preferences */}
          <div className="space-y-1.5 pt-2 border-t-2 border-dashed border-zinc-800">
            <div className="text-[10px] font-mono font-black uppercase tracking-wider text-zinc-500 px-1">
              {language === 'ar' ? 'التفضيلات' : 'Preferences'}
            </div>

            <button
              onClick={toggleGlobalTheme}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg brutal-border brutal-shadow-sm brutal-btn cursor-pointer ${
                globalTheme === 'dark' ? 'bg-zinc-800 text-white' : 'bg-white text-[#0b1110]'
              }`}
            >
              <div className="flex items-center gap-2">
                {globalTheme === 'dark' ? <Moon size={15} className="text-amber-400" /> : <Sun size={15} className="text-amber-500" />}
                <span>{globalTheme === 'dark' ? (language === 'ar' ? 'الوضع الداكن' : 'Dark Theme') : (language === 'ar' ? 'الوضع الفاتح' : 'Light Theme')}</span>
              </div>
              <span className="text-[9px] font-mono font-black px-1.5 py-0.5 rounded bg-zinc-700/50">
                {globalTheme === 'dark' ? 'NIGHT' : 'DAY'}
              </span>
            </button>

            <button
              onClick={() => {
                setIsSettingsOpen(true);
                closeMobileMenu();
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white brutal-border brutal-shadow-sm brutal-btn cursor-pointer font-bold"
            >
              <div className="flex items-center gap-2">
                <Radio size={15} className="animate-pulse text-[#57F287]" />
                <span>{language === 'ar' ? 'الإعدادات والربط' : 'Settings & Integrations'}</span>
              </div>
              <Settings size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
