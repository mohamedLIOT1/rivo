import React from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useTranslation } from '../context/PreferencesContext';
import { useProfileScreenData } from '../hooks/useProfileScreenData';
import SocialModal from '../components/profile/SocialModal';
import ViewingUserProfile from '../components/profile/ViewingUserProfile';
import ProfileHeroCard from '../components/profile/ProfileHeroCard';
import ProfilePlaylists from '../components/profile/ProfilePlaylists';
import ProfileTopBar from '../components/profile/ProfileTopBar';

export default function ProfileScreen({ 
  currentUser, 
  playlists = [], 
  onBack, 
  logout, 
  openAuthModal,
  openSettings,
  onSelectPlaylist,
  onOpenChat,
  onStartJamWithUser,
  onTogglePlaylistVisibility,
  onSavePlaylist,
  onUnsavePlaylist,
  userPlaylists = [],
  globalTheme = 'dark',
  viewingUserId = null,
  onClearViewingUser,
  onNavigateScreen,
}) {
  const isDark = globalTheme === 'dark';
  const { t, isRTL } = useTranslation();

  const {
    isEditingName,
    setIsEditingName,
    isEditingBio,
    setIsEditingBio,
    nameInput,
    setNameInput,
    bioInput,
    setBioInput,
    isSaving,
    localUser,
    localPlaylists,
    togglingId,
    isUploadingAvatar,
    avatarInputRef,
    viewingProfile,
    setViewingProfile,
    followLoading,
    savingPlId,
    socialModal,
    setSocialModal,
    allUserPlaylists,
    handleOpenSocialModal,
    handleAvatarChange,
    handleSaveName,
    handleSaveBio,
    handleToggleVisibility,
    handleViewUserProfile,
    handleToggleFollow,
    handleQuickSave,
  } = useProfileScreenData({
    currentUser,
    playlists,
    viewingUserId,
    userPlaylists,
    onTogglePlaylistVisibility,
    onSavePlaylist,
    onUnsavePlaylist,
    t,
  });

  const isViewingOther = Boolean(
    viewingUserId &&
    String(viewingUserId).trim() !== String(currentUser?._id || currentUser?.id || '').trim()
  );

  if (isViewingOther && !viewingProfile) {
    return (
      <div className={`flex-1 flex flex-col overflow-hidden select-none font-sans transition-colors ${
        isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'
      }`}>
        <div className={`flex items-center gap-3 px-4 py-3 brutal-border border-x-0 border-t-0 shrink-0 ${
          isDark ? 'bg-[#101716] border-zinc-800 text-white' : 'bg-[#0b1110] text-[#fdfbf7]'
        }`}>
          <button 
            onClick={() => {
              setViewingProfile(null);
              if (onClearViewingUser) onClearViewingUser();
              if (onBack) onBack();
            }} 
            className={`w-8 h-8 rounded-lg brutal-border flex items-center justify-center brutal-btn cursor-pointer ${
              isDark ? 'bg-zinc-800 text-zinc-200 border-zinc-700' : 'bg-[#fdfbf7] text-[#0b1110]'
            }`}
            title={t('profile.back')}
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-black text-sm text-white">{t('profile.loadingDossier')}</h1>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-2xl brutal-border bg-[#10b981] flex items-center justify-center brutal-shadow mb-4">
            <Loader2 size={26} className="text-[#0b1110] animate-spin" />
          </div>
          <p className="font-display font-black text-sm tracking-wider uppercase mb-1 text-white">{t('profile.retrievingPrescription')}</p>
          <p className="font-mono text-xs opacity-60 text-zinc-300">{t('profile.connectingNetwork')}</p>
        </div>
      </div>
    );
  }

  // Viewing another user's profile
  if (viewingProfile) {
    return (
      <>
        <ViewingUserProfile
          viewingProfile={viewingProfile}
          currentUser={currentUser}
          isDark={isDark}
          onCloseViewing={() => {
            setViewingProfile(null);
            if (onClearViewingUser) onClearViewingUser();
            if (viewingUserId) onBack();
          }}
          handleOpenSocialModal={handleOpenSocialModal}
          handleToggleFollow={handleToggleFollow}
          followLoading={followLoading}
          onOpenChat={onOpenChat}
          onStartJamWithUser={onStartJamWithUser}
          onNavigateScreen={onNavigateScreen}
          onSelectPlaylist={onSelectPlaylist}
          allUserPlaylists={allUserPlaylists}
          handleQuickSave={handleQuickSave}
          savingPlId={savingPlId}
          t={t}
        />
        <SocialModal
          isOpen={socialModal.isOpen}
          title={socialModal.title}
          loading={socialModal.loading}
          users={socialModal.users}
          isDark={isDark}
          onClose={() => setSocialModal(prev => ({ ...prev, isOpen: false }))}
          onSelectUser={(uid) => {
            setSocialModal(prev => ({ ...prev, isOpen: false }));
            handleViewUserProfile(uid);
          }}
          t={t}
        />
      </>
    );
  }

  // Main User's Own Profile View
  return (
    <div className={`flex-1 flex flex-col overflow-hidden select-none font-sans transition-colors ${
      isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'
    }`}>
      {/* Top Bar */}
      <ProfileTopBar
        currentUser={currentUser}
        isDark={isDark}
        onBack={onBack}
        logout={logout}
        openAuthModal={openAuthModal}
        openSettings={openSettings}
        t={t}
      />

      <div className="flex-1 overflow-y-auto p-2.5 sm:p-6" style={{ paddingBottom: 'calc(var(--player-height) + 40px)' }}>
        {/* Guest Alert Banner */}
        {!currentUser && (
          <div className={`brutal-border-thick rounded-2xl p-3 sm:p-4 mb-3 sm:mb-4 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 brutal-shadow-sm ${
            isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-[#ede5d3] border-black'
          }`}>
            <div className="flex items-center gap-2 sm:gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b] animate-pulse shrink-0" />
              <div>
                <p className={`text-xs font-display font-black ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>{t('profile.guestMode')}</p>
                <p className={`text-[10px] sm:text-[11px] font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>{t('profile.guestDesc')}</p>
              </div>
            </div>
            <button
              onClick={openAuthModal}
              className="shrink-0 px-3.5 py-1.5 sm:px-4 sm:py-2 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] rounded-xl brutal-border font-display font-black text-xs brutal-btn brutal-shadow-sm cursor-pointer"
            >
              {t('profile.signInNow')}
            </button>
          </div>
        )}

        {/* Profile Hero Card */}
        <ProfileHeroCard
          localUser={localUser}
          currentUser={currentUser}
          isDark={isDark}
          t={t}
          isUploadingAvatar={isUploadingAvatar}
          avatarInputRef={avatarInputRef}
          handleAvatarChange={handleAvatarChange}
          isEditingName={isEditingName}
          setIsEditingName={setIsEditingName}
          nameInput={nameInput}
          setNameInput={setNameInput}
          handleSaveName={handleSaveName}
          isSaving={isSaving}
          localPlaylists={localPlaylists}
          handleOpenSocialModal={handleOpenSocialModal}
          isEditingBio={isEditingBio}
          setIsEditingBio={setIsEditingBio}
          bioInput={bioInput}
          setBioInput={setBioInput}
          handleSaveBio={handleSaveBio}
        />

        {/* Playlists Section */}
        <ProfilePlaylists
          localPlaylists={localPlaylists}
          isDark={isDark}
          togglingId={togglingId}
          handleToggleVisibility={handleToggleVisibility}
          onSelectPlaylist={onSelectPlaylist}
          t={t}
        />
      </div>

      {/* Social Modal */}
      <SocialModal
        isOpen={socialModal.isOpen}
        title={socialModal.title}
        loading={socialModal.loading}
        users={socialModal.users}
        isDark={isDark}
        onClose={() => setSocialModal(prev => ({ ...prev, isOpen: false }))}
        onSelectUser={(uid) => {
          setSocialModal(prev => ({ ...prev, isOpen: false }));
          handleViewUserProfile(uid);
        }}
        t={t}
      />
    </div>
  );
}
