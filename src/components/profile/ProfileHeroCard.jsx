import React from 'react';
import { Camera, Edit2, Check, X, User, Loader2 } from 'lucide-react';
import VerifiedBadge from '../VerifiedBadge';

export default function ProfileHeroCard({
  localUser,
  currentUser,
  isDark,
  t,
  isUploadingAvatar,
  avatarInputRef,
  handleAvatarChange,
  isEditingName,
  setIsEditingName,
  nameInput,
  setNameInput,
  handleSaveName,
  isSaving,
  localPlaylists,
  handleOpenSocialModal,
  isEditingBio,
  setIsEditingBio,
  bioInput,
  setBioInput,
  handleSaveBio,
}) {
  return (
    <div className={`rounded-2xl brutal-border-thick p-3 sm:p-6 mb-3 sm:mb-4 brutal-shadow-lg relative overflow-hidden ${
      isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#0b1110] paper-texture'
    }`}>
      {/* Header Bar */}
      <div className={`flex items-center justify-between pb-2 border-b-2 mb-2.5 sm:mb-3 ${
        isDark ? 'border-zinc-700' : 'border-[#0b1110]'
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full ${currentUser ? 'bg-[#17a398]' : 'bg-[#f59e0b]'} animate-pulse shrink-0`} />
          <span className={`font-mono font-bold text-[10px] sm:text-xs tracking-wider truncate ${
            isDark ? 'text-zinc-300' : 'text-zinc-700'
          }`}>
            {t('profile.userProfile', { name: localUser?.name || 'user' })}
          </span>
        </div>
        <div className={`border-2 border-dashed ${currentUser ? 'border-[#17a398] text-[#17a398]' : 'border-[#f59e0b] text-[#0b1110]'} px-1.5 sm:px-2 py-0.5 rounded font-mono font-black text-[9px] sm:text-[10px] -rotate-1 select-none shrink-0`}>
          {currentUser ? t('profile.member') : t('profile.guest')}
        </div>
      </div>

      {/* Profile Body */}
      <div className="flex flex-col md:flex-row items-stretch md:items-start gap-3 sm:gap-6">
        {/* Photo Frame & Mobile Header Row */}
        <div className="flex items-center gap-3 sm:gap-4 md:flex-col md:items-center shrink-0">
          <div className="relative shrink-0">
            <div className={`w-20 h-20 sm:w-28 sm:h-28 md:w-36 md:h-36 rounded-2xl overflow-hidden brutal-border-thick brutal-shadow-sm flex items-center justify-center ${
              isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-[#ede5d3] border-black'
            }`}>
              {isUploadingAvatar ? (
                <Loader2 size={24} className="animate-spin text-[#17a398]" />
              ) : localUser?.avatar ? (
                <img src={localUser.avatar} alt={localUser?.name} className="w-full h-full object-cover" />
              ) : (
                <User size={36} className={isDark ? "text-zinc-400" : "text-[#0b1110]"} />
              )}
            </div>
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="absolute -bottom-1.5 -right-1.5 w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] rounded-lg sm:rounded-xl brutal-border flex items-center justify-center brutal-shadow-sm brutal-btn cursor-pointer"
              title={t('profile.changeAvatar')}
            >
              <Camera size={13} strokeWidth={2.5} className="sm:w-3.5 sm:h-3.5" />
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          {/* Mobile Name, ID & Badges Row */}
          <div className="flex-1 min-w-0 md:hidden text-left">
            {isEditingName ? (
              <div className="flex items-center gap-1.5 mb-1">
                <input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                  className={`brutal-border rounded-lg px-2 py-0.5 text-sm font-display font-black focus:outline-none w-full max-w-[150px] ${
                    isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-black text-[#0b1110]'
                  }`}
                  autoFocus
                />
                <button onClick={handleSaveName} disabled={isSaving} className="p-1 bg-[#17a398] rounded-lg brutal-border text-[#0b1110] cursor-pointer">
                  {isSaving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} strokeWidth={2.5} />}
                </button>
                <button onClick={() => setIsEditingName(false)} className={`p-1 rounded-lg brutal-border cursor-pointer ${
                  isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-zinc-200 text-[#0b1110]'
                }`}>
                  <X size={11} strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                <h1 className={`text-lg sm:text-2xl font-display font-black tracking-tight truncate ${
                  isDark ? 'text-white' : 'text-[#0b1110]'
                }`}>
                  {localUser?.name || 'User'}
                </h1>
                <VerifiedBadge userOrName={localUser} size={15} />
                <button 
                  onClick={() => setIsEditingName(true)} 
                  className={`p-0.5 transition cursor-pointer ${
                    isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-black'
                  }`}
                  title={t('profile.editName')}
                >
                  <Edit2 size={13} />
                </button>
              </div>
            )}

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] font-mono font-bold bg-[#17a398] text-[#0b1110] px-1.5 py-0.2 rounded brutal-border shrink-0">
                {t('profile.listener')}
              </span>
              <span className={`text-[9px] font-mono font-bold brutal-border px-1.5 py-0.2 rounded shrink-0 ${
                isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-[#ede5d3] text-zinc-700'
              }`}>
                {t('profile.idLabel', { id: String(localUser?._id || localUser?.id || '001').slice(-6).toUpperCase() })}
              </span>
            </div>
          </div>

          {/* Desktop ID badge */}
          <span className={`hidden md:inline-block mt-3 text-[10px] font-mono font-bold brutal-border px-2 py-0.5 rounded ${
            isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-[#ede5d3] text-zinc-700'
          }`}>
            {t('profile.idLabel', { id: String(localUser?._id || localUser?.id || '001').slice(-6).toUpperCase() })}
          </span>
        </div>

        {/* Profile Details, Stats & Bio */}
        <div className="flex-1 w-full text-left">
          {/* Desktop Name */}
          <div className="hidden md:flex flex-wrap items-center gap-2 mb-1">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                  className={`brutal-border rounded-lg px-3 py-1 text-base font-display font-black focus:outline-none max-w-[220px] ${
                    isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-black text-[#0b1110]'
                  }`}
                  autoFocus
                />
                <button onClick={handleSaveName} disabled={isSaving} className="p-1.5 bg-[#17a398] rounded-lg brutal-border text-[#0b1110] cursor-pointer">
                  {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={2.5} />}
                </button>
                <button onClick={() => setIsEditingName(false)} className={`p-1.5 rounded-lg brutal-border cursor-pointer ${
                  isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-zinc-200 text-[#0b1110]'
                }`}>
                  <X size={13} strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <>
                <h1 className={`text-2xl sm:text-3xl font-display font-black tracking-tight ${
                  isDark ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : 'text-[#0b1110]'
                }`}>
                  {localUser?.name || 'User'}
                </h1>
                <VerifiedBadge userOrName={localUser} size={20} />
                <button 
                  onClick={() => setIsEditingName(true)} 
                  className={`p-1 transition cursor-pointer ${
                    isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-black'
                  }`}
                  title={t('profile.editName')}
                >
                  <Edit2 size={14} />
                </button>
                <span className="text-[10px] font-mono font-bold bg-[#17a398] text-[#0b1110] px-2 py-0.5 rounded brutal-border shrink-0">
                  {t('profile.listener')}
                </span>
              </>
            )}
          </div>

          {/* Archival Punch Card Stats */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-3 my-2 sm:my-3">
            <div className={`rounded-xl brutal-border p-1.5 sm:p-2.5 brutal-shadow-sm text-center ${
              isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-black text-[#0b1110]'
            }`}>
              <span className={`font-display font-black text-base sm:text-xl block leading-none mb-0.5 sm:mb-1 ${
                isDark ? 'text-white' : 'text-[#0b1110]'
              }`}>
                {localPlaylists.filter(p => !p.isLikedSongs).length}
              </span>
              <span className={`text-[8px] sm:text-[9px] font-mono font-bold uppercase truncate block ${
                isDark ? 'text-zinc-400' : 'text-zinc-600'
              }`}>{t('profile.playlists')}</span>
            </div>

            <div 
              onClick={() => handleOpenSocialModal(localUser?._id || localUser?.id, 'followers', localUser?.name)}
              className={`rounded-xl brutal-border p-1.5 sm:p-2.5 brutal-shadow-sm text-center cursor-pointer transition ${
                isDark ? 'bg-zinc-900 border-zinc-700 hover:bg-zinc-800' : 'bg-white border-black hover:bg-[#ede5d3]'
              }`}
            >
              <span className="font-display font-black text-base sm:text-xl text-[#17a398] block leading-none mb-0.5 sm:mb-1">
                {localUser?.followersCount ?? (Array.isArray(localUser?.followers) ? localUser.followers.length : 0)}
              </span>
              <span className={`text-[8px] sm:text-[9px] font-mono font-bold uppercase truncate block ${
                isDark ? 'text-zinc-400' : 'text-zinc-600'
              }`}>{t('profile.followers')}</span>
            </div>

            <div 
              onClick={() => handleOpenSocialModal(localUser?._id || localUser?.id, 'following', localUser?.name)}
              className={`rounded-xl brutal-border p-1.5 sm:p-2.5 brutal-shadow-sm text-center cursor-pointer transition ${
                isDark ? 'bg-zinc-900 border-zinc-700 hover:bg-zinc-800' : 'bg-white border-black hover:bg-[#ede5d3]'
              }`}
            >
              <span className="font-display font-black text-base sm:text-xl text-[#17a398] block leading-none mb-0.5 sm:mb-1">
                {localUser?.followingCount ?? (Array.isArray(localUser?.following) ? localUser.following.length : 0)}
              </span>
              <span className={`text-[8px] sm:text-[9px] font-mono font-bold uppercase truncate block ${
                isDark ? 'text-zinc-400' : 'text-zinc-600'
              }`}>{t('profile.following')}</span>
            </div>
          </div>

          {/* Bio */}
          <div className={`brutal-border rounded-xl p-2.5 sm:p-4 my-1.5 sm:my-3 text-left ${
            isDark ? 'bg-zinc-900/90 border-zinc-700' : 'bg-[#ede5d3] border-black'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider ${
                isDark ? 'text-zinc-400' : 'text-zinc-600'
              }`}>
                {t('profile.aboutBio')}
              </span>
              {!isEditingBio && (
                <button 
                  onClick={() => setIsEditingBio(true)} 
                  className="text-[11px] sm:text-xs font-mono font-bold text-[#17a398] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Edit2 size={11} /> {t('profile.editBio')}
                </button>
              )}
            </div>

            {isEditingBio ? (
              <div className="flex flex-col gap-2 mt-1">
                <textarea
                  value={bioInput}
                  onChange={e => setBioInput(e.target.value)}
                  placeholder={t('profile.bioPlaceholder')}
                  rows={3}
                  className={`brutal-border rounded-lg p-2 sm:p-2.5 text-xs sm:text-base font-sans focus:outline-none resize-none font-medium w-full leading-relaxed ${
                    isDark ? 'bg-zinc-900 text-white border-zinc-700' : 'bg-white text-[#0b1110] border-black'
                  }`}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveBio} disabled={isSaving} className="px-3 py-1 bg-[#17a398] text-[#0b1110] font-bold text-xs rounded-lg brutal-border cursor-pointer">
                    {isSaving ? <Loader2 size={12} className="animate-spin" /> : t('profile.saveBio')}
                  </button>
                  <button onClick={() => setIsEditingBio(false)} className={`px-3 py-1 font-bold text-xs rounded-lg brutal-border cursor-pointer ${
                    isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-zinc-200 text-[#0b1110]'
                  }`}>
                    {t('profile.cancelBio')}
                  </button>
                </div>
              </div>
            ) : (
              <p className={`text-xs sm:text-base font-sans font-medium leading-relaxed ${isDark ? 'text-zinc-100' : 'text-[#0b1110]'}`}>
                {localUser?.bio || <span className="italic text-zinc-400">{t('profile.noBio')}</span>}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
