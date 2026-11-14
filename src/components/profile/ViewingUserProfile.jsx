import React from 'react';
import { ArrowLeft, User, Disc, MessageSquare, Radio, Activity, ShieldCheck, Check, Plus, Loader2 } from 'lucide-react';
import VerifiedBadge from '../VerifiedBadge';
import { isQuranContent } from '../../utils/quranUtils';
import { isUserAdmin } from '../../utils/adminUtils';

export default function ViewingUserProfile({
  viewingProfile,
  currentUser,
  isDark,
  onCloseViewing,
  handleOpenSocialModal,
  handleToggleFollow,
  followLoading,
  onOpenChat,
  onStartJamWithUser,
  onNavigateScreen,
  onSelectPlaylist,
  allUserPlaylists = [],
  onSavePlaylist,
  handleQuickSave,
  savingPlId,
  t,
}) {
  const viewingId = viewingProfile.id || viewingProfile._id;
  const isMe = String(viewingId) === String(currentUser?.id || currentUser?._id);
  const isBot = Boolean(viewingProfile.isBot || viewingProfile.name === 'Rivo Bot' || viewingProfile.email === 'bot@rivo.app');

  return (
    <div className={`flex-1 flex flex-col overflow-hidden select-none font-sans transition-colors ${
      isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'
    }`}>
      {/* Top Bar */}
      <div className={`flex items-center gap-3 px-4 py-3 brutal-border border-x-0 border-t-0 shrink-0 ${
        isDark ? 'bg-[#101716] border-zinc-800 text-white' : 'bg-[#0b1110] text-[#fdfbf7]'
      }`}>
        <button 
          onClick={onCloseViewing}
          className={`w-8 h-8 rounded-lg brutal-border flex items-center justify-center brutal-btn cursor-pointer ${
            isDark ? 'bg-zinc-800 text-zinc-200 border-zinc-700' : 'bg-[#fdfbf7] text-[#0b1110]'
          }`}
          title={t('profile.back')}
        >
          <ArrowLeft size={16} strokeWidth={2.5} />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="font-display font-black text-sm text-white">{viewingProfile.name}</h1>
          <VerifiedBadge userOrName={viewingProfile} size={14} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2.5 sm:p-6" style={{ paddingBottom: 'calc(var(--player-height) + 40px)' }}>
        {/* Profile Hero Card */}
        <div className={`rounded-2xl brutal-border-thick p-3 sm:p-6 mb-3 sm:mb-4 brutal-shadow-lg relative overflow-hidden ${
          isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#0b1110] paper-texture'
        }`}>
          {/* Header Bar */}
          <div className={`flex items-center justify-between pb-2 border-b-2 mb-2.5 sm:mb-3 ${
            isDark ? 'border-zinc-700' : 'border-[#0b1110]'
          }`}>
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-[#17a398] animate-pulse shrink-0" />
              <span className={`font-mono font-bold text-[10px] sm:text-xs tracking-wider truncate ${
                isDark ? 'text-zinc-300' : 'text-zinc-700'
              }`}>
                {t('profile.userProfile', { name: viewingProfile.name })}
              </span>
            </div>
            <div className="border-2 border-dashed border-[#17a398] text-[#17a398] px-1.5 sm:px-2 py-0.5 rounded font-mono font-black text-[9px] sm:text-[10px] -rotate-1 select-none shrink-0">
              {t('profile.member')}
            </div>
          </div>

          {/* Profile Body */}
          <div className="flex flex-col md:flex-row items-stretch md:items-start gap-3 sm:gap-6">
            {/* Photo Frame & Mobile Header Row */}
            <div className="flex items-center gap-3 sm:gap-4 md:flex-col md:items-center shrink-0">
              <div className={`w-20 h-20 sm:w-28 sm:h-28 md:w-36 md:h-36 rounded-2xl overflow-hidden brutal-border-thick brutal-shadow-sm shrink-0 flex items-center justify-center relative ${
                isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-[#ede5d3] border-black'
              }`}>
                {(isBot && (!viewingProfile.avatar || viewingProfile.avatar.includes('unsplash'))) ? (
                  <img src="https://rivo-m.duckdns.org/public/assets/rivo-bot.png" alt={viewingProfile.name} className="w-full h-full object-cover" />
                ) : viewingProfile.avatar ? (
                  <img src={viewingProfile.avatar} alt={viewingProfile.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User size={36} className={isDark ? "text-zinc-400" : "text-[#0b1110]"} />
                  </div>
                )}
              </div>

              {/* Mobile Name & Badges Row */}
              <div className="flex-1 min-w-0 md:hidden text-left">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                  <h2 className={`text-lg sm:text-2xl font-display font-black truncate ${
                    isDark ? 'text-white' : 'text-[#0b1110]'
                  }`}>
                    {viewingProfile.name}
                  </h2>
                  <VerifiedBadge userOrName={viewingProfile} size={15} />
                  <span className="text-[9px] font-mono font-bold bg-[#17a398] text-[#0b1110] px-1.5 py-0.2 rounded brutal-border">
                    {isBot ? t('profile.systemBot') : t('profile.listener')}
                  </span>
                </div>
                <span className={`inline-block text-[9px] font-mono font-bold brutal-border px-1.5 py-0.2 rounded ${
                  isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-[#ede5d3] text-zinc-700'
                }`}>
                  {t('profile.idLabel', { id: String(viewingProfile.id || viewingProfile._id || '').slice(-6).toUpperCase() })}
                </span>
              </div>

              {/* Desktop ID Badge */}
              <span className={`hidden md:inline-block mt-2 text-[10px] font-mono font-bold brutal-border px-2 py-0.5 rounded ${
                isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-[#ede5d3] text-zinc-700'
              }`}>
                {t('profile.idLabel', { id: String(viewingProfile.id || viewingProfile._id || '').slice(-6).toUpperCase() })}
              </span>
            </div>

            {/* Profile Details, Punch Card Stats & Actions */}
            <div className="flex-1 w-full text-left">
              {/* Desktop Name */}
              <div className="hidden md:flex flex-wrap items-center gap-2 mb-1">
                <h2 className={`text-2xl sm:text-3xl font-display font-black ${
                  isDark ? 'text-white' : 'text-[#0b1110]'
                }`}>
                  {viewingProfile.name}
                </h2>
                <VerifiedBadge userOrName={viewingProfile} size={20} />
                <span className="text-[10px] font-mono font-bold bg-[#17a398] text-[#0b1110] px-2 py-0.5 rounded brutal-border">
                  {isBot ? t('profile.systemBot') : t('profile.listener')}
                </span>
              </div>

              {/* Punch Card Stats */}
              <div className="grid grid-cols-3 gap-1.5 sm:gap-3 my-2 sm:my-3">
                <div className={`rounded-xl brutal-border p-1.5 sm:p-2.5 brutal-shadow-sm text-center ${
                  isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-black text-[#0b1110]'
                }`}>
                  <span className={`font-display font-black text-base sm:text-xl block leading-none mb-0.5 sm:mb-1 ${
                    isDark ? 'text-white' : 'text-[#0b1110]'
                  }`}>
                    {viewingProfile.playlistCount || 0}
                  </span>
                  <span className={`text-[8px] sm:text-[9px] font-mono font-bold uppercase truncate block ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
                  }`}>
                    {t('profile.playlists')}
                  </span>
                </div>

                <div 
                  onClick={() => handleOpenSocialModal(viewingProfile.id || viewingProfile._id, 'followers', viewingProfile.name)}
                  className={`rounded-xl brutal-border p-1.5 sm:p-2.5 brutal-shadow-sm text-center cursor-pointer transition ${
                    isDark ? 'bg-zinc-900 border-zinc-700 hover:bg-zinc-800' : 'bg-white border-black hover:bg-[#ede5d3]'
                  }`}
                >
                  <span className="font-display font-black text-base sm:text-xl text-[#17a398] block leading-none mb-0.5 sm:mb-1">
                    {viewingProfile.followersCount || 0}
                  </span>
                  <span className={`text-[8px] sm:text-[9px] font-mono font-bold uppercase truncate block ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
                  }`}>
                    {t('profile.followers')}
                  </span>
                </div>

                <div 
                  onClick={() => handleOpenSocialModal(viewingProfile.id || viewingProfile._id, 'following', viewingProfile.name)}
                  className={`rounded-xl brutal-border p-1.5 sm:p-2.5 brutal-shadow-sm text-center cursor-pointer transition ${
                    isDark ? 'bg-zinc-900 border-zinc-700 hover:bg-zinc-800' : 'bg-white border-black hover:bg-[#ede5d3]'
                  }`}
                >
                  <span className="font-display font-black text-base sm:text-xl text-[#17a398] block leading-none mb-0.5 sm:mb-1">
                    {viewingProfile.followingCount ?? ((Array.isArray(viewingProfile.following) ? viewingProfile.following.length : 0) + (Array.isArray(viewingProfile.followedArtists) ? viewingProfile.followedArtists.length : 0))}
                  </span>
                  <span className={`text-[8px] sm:text-[9px] font-mono font-bold uppercase truncate block ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
                  }`}>
                    {t('profile.following')}
                  </span>
                </div>
              </div>

              {/* Actions Bar (Follow, Chat, Jam) */}
              {!isMe && (
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 my-2">
                  {!isBot && (
                    <button
                      onClick={handleToggleFollow}
                      disabled={followLoading}
                      className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-display font-black text-xs brutal-border brutal-shadow-sm brutal-btn cursor-pointer ${
                        viewingProfile.isFollowing
                          ? isDark ? 'bg-zinc-800 text-white border-zinc-700' : 'bg-white text-[#0b1110]'
                          : 'bg-[#17a398] text-[#0b1110]'
                      }`}
                    >
                      {viewingProfile.isFollowing ? t('profile.followingActive') : t('profile.follow')}
                    </button>
                  )}

                  <button
                    onClick={() => onOpenChat && onOpenChat(viewingProfile)}
                    className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-display font-bold text-xs brutal-border brutal-shadow-sm brutal-btn cursor-pointer flex items-center gap-1.5 ${
                      isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700' : 'bg-white text-[#0b1110] hover:bg-[#ede5d3]'
                    }`}
                  >
                    <MessageSquare size={13} className="text-[#dc2626]" />
                    <span>{t('profile.chat')}</span>
                  </button>

                  {!isBot && (
                    <button
                      onClick={() => onStartJamWithUser && onStartJamWithUser(viewingProfile)}
                      className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-[#f59e0b] hover:bg-[#fbb739] text-[#0b1110] font-display font-bold text-xs brutal-border brutal-shadow-sm brutal-btn cursor-pointer flex items-center gap-1.5"
                    >
                      <Radio size={13} className="animate-pulse" />
                      <span>{t('profile.jam')}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Current User Quick Navigation Actions */}
              {isMe && (
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 my-2">
                  <button
                    onClick={() => onNavigateScreen ? onNavigateScreen('stats') : (window.location.href = '/stats')}
                    className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl font-display font-bold text-xs brutal-border brutal-shadow-sm brutal-btn cursor-pointer flex items-center gap-1.5 ${
                      isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700' : 'bg-white text-[#0b1110] hover:bg-[#ede5d3]'
                    }`}
                  >
                    <Activity size={13} className="text-[#17a398]" />
                    <span>{t('profile.listeningStats')}</span>
                  </button>

                  {currentUser && isUserAdmin(currentUser) && (
                    <button
                      onClick={() => onNavigateScreen ? onNavigateScreen('admin') : (window.location.href = '/admin')}
                      className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-[#f59e0b] hover:bg-[#fbb739] text-[#0b1110] font-display font-black text-xs brutal-border brutal-shadow-sm brutal-btn cursor-pointer flex items-center gap-1.5"
                    >
                      <ShieldCheck size={13} />
                      <span>{t('profile.adminPortal')}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Bio */}
              <div className={`brutal-border rounded-xl p-2.5 sm:p-4 my-1.5 sm:my-3 text-left ${
                isDark ? 'bg-zinc-900/90 border-zinc-700' : 'bg-[#ede5d3] border-black'
              }`}>
                <span className={`text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider block mb-0.5 sm:mb-1 ${
                  isDark ? 'text-zinc-400' : 'text-zinc-600'
                }`}>
                  {t('profile.aboutBio')}
                </span>
                <p className={`text-xs sm:text-base font-sans font-medium leading-relaxed ${isDark ? 'text-zinc-100' : 'text-[#0b1110]'}`}>
                  {viewingProfile.bio || <span className="italic text-zinc-400">{t('profile.noBioShort')}</span>}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Public Playlists */}
        <div>
          <h3 className={`font-display font-black text-xl mb-3 ${
            isDark ? 'text-white' : 'text-[#fdfbf7] drop-shadow-[1.5px_1.5px_0px_#082621]'
          }`}>
            {t('profile.publicPlaylists')}
          </h3>
          {viewingProfile.publicPlaylists?.filter(pl => !pl.isLikedSongs).length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {viewingProfile.publicPlaylists.filter(pl => !pl.isLikedSongs).map(pl => {
                const plId = String(pl.id || pl._id);
                const isSaved = allUserPlaylists.some(p =>
                  String(p.sourcePlaylistId) === plId || (String(p.id) === plId && p.sourcePlaylistId)
                );
                const isSavingThis = savingPlId === plId;

                return (
                  <div 
                    key={pl.id || pl._id} 
                    onClick={() => onSelectPlaylist && onSelectPlaylist(pl)}
                    className={`p-3 rounded-xl brutal-border flex items-center gap-3 cursor-pointer brutal-shadow-sm hover:brutal-shadow transition ${
                      isDark ? 'bg-[#141d1b] border-zinc-700 hover:bg-zinc-900' : 'bg-[#fdfbf7] border-black hover:bg-[#ede5d3]'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-[#17a398] brutal-border shrink-0 flex items-center justify-center font-bold text-white">
                      {pl.cover ? <img src={pl.cover} alt="" className="w-full h-full object-cover rounded-md" /> : <Disc size={20} />}
                    </div>
                    <div className="truncate flex-1">
                      <p className={`font-display font-black text-xs truncate ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>{pl.name}</p>
                      <p className={`text-[10px] font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        {(() => {
                          const isQ = Boolean(pl.isQuran || isQuranContent(pl));
                          const count = pl.trackCount || (pl.trackIds || []).length;
                          return `${count} ${isQ ? (count === 1 ? t('profile.surah') : t('profile.surahs')) : (count === 1 ? t('profile.song') : t('profile.songs'))}`;
                        })()}
                      </p>
                    </div>
                    {(onSavePlaylist || handleQuickSave) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (handleQuickSave) {
                            handleQuickSave(pl);
                          } else if (onSavePlaylist) {
                            onSavePlaylist(pl);
                          }
                        }}
                        disabled={isSavingThis}
                        className={`p-1.5 rounded-lg brutal-border flex items-center justify-center transition cursor-pointer shrink-0 ${
                          isSaved 
                            ? isDark ? 'bg-zinc-800 text-emerald-400 border-zinc-700 hover:bg-zinc-700' : 'bg-white text-emerald-600 border-black hover:bg-[#ede5d3]'
                            : 'bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110]'
                        }`}
                        title={isSaved ? t('profile.savedInLibrary') : t('profile.saveToLibrary')}
                      >
                        {isSavingThis ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : isSaved ? (
                          <Check size={14} strokeWidth={2.5} />
                        ) : (
                          <Plus size={14} strokeWidth={2.5} />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-[#082621]'}`}>{t('profile.noPlaylistsCreated')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
