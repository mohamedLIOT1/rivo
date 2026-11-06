import React from 'react';
import { ArrowLeft, LogOut, LogIn, Radio, Settings } from 'lucide-react';
import VerifiedBadge from '../VerifiedBadge';

export default function ProfileTopBar({
  currentUser,
  isDark,
  onBack,
  logout,
  openAuthModal,
  openSettings,
  t,
}) {
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 brutal-border border-x-0 border-t-0 shrink-0 ${
      isDark ? 'bg-[#101716] border-zinc-800 text-white' : 'bg-[#0b1110] text-[#fdfbf7]'
    }`}>
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button 
          onClick={onBack} 
          className={`w-8 h-8 rounded-lg brutal-border flex items-center justify-center brutal-btn cursor-pointer shrink-0 ${
            isDark ? 'bg-zinc-800 text-zinc-200 border-zinc-700' : 'bg-[#fdfbf7] text-[#0b1110]'
          }`}
          title={t('profile.back')}
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <h1 className={`font-display font-black text-sm sm:text-base truncate ${
            isDark ? 'text-white' : 'text-[#0b1110]'
          }`}>
            {currentUser ? currentUser.name : t('profile.myProfile')}
          </h1>
          {currentUser && <VerifiedBadge userOrName={currentUser} size={14} />}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {currentUser && openSettings && (
          <button
            onClick={openSettings}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg brutal-border brutal-shadow-sm text-xs font-display font-black brutal-btn cursor-pointer shrink-0 transition active:scale-95 shadow-md"
            title={t('profile.discordPresence')}
          >
            <Radio size={13} className="animate-pulse text-[#57F287]" />
            <span className="font-bold">{t('profile.discordPresence')}</span>
            <Settings size={13} />
          </button>
        )}

        {currentUser ? (
          <button
            onClick={logout}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-[#dc2626] text-white rounded-lg brutal-border brutal-shadow-sm text-xs font-display font-black brutal-btn cursor-pointer shrink-0"
            title={t('profile.logout')}
          >
            <LogOut size={13} strokeWidth={2.5} />
            <span className="hidden sm:inline">{t('profile.logout')}</span>
          </button>
        ) : (
          <button
            onClick={openAuthModal}
            className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] rounded-lg brutal-border brutal-shadow-sm text-xs font-display font-black brutal-btn cursor-pointer shrink-0"
            title={t('profile.signInRegisterBtn')}
          >
            <LogIn size={14} strokeWidth={2.5} />
            <span className="hidden sm:inline">{t('profile.signInBtn')}</span>
          </button>
        )}
      </div>
    </div>
  );
}
