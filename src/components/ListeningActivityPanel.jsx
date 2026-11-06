import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, RefreshCw, Users, Search, Radio } from 'lucide-react';
import { API_BASE_URL } from '../config';
import { usePreferences } from '../context/PreferencesContext';
import { useUI } from '../context/UIContext';
import GuestActivityCard from './activity/GuestActivityCard';
import ActivityListItem from './activity/ActivityListItem';

export default function ListeningActivityPanel({
  isOpen,
  onClose,
  onSelectTrack,
  onPlayTrack,
  openProfileScreen,
  onViewProfile,
  openChatModal,
  onOpenChat,
  onStartJamWithUser,
  currentUser,
  globalTheme = 'dark',
  socket,
  onOpenAuth
}) {
  const isDark = globalTheme === 'dark';
  const { t, isRTL } = usePreferences();
  const { setIsAuthOpen } = useUI() || {};

  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleOpenAuth = useCallback(() => {
    if (onOpenAuth) {
      onOpenAuth();
    } else if (setIsAuthOpen) {
      setIsAuthOpen(true);
    }
  }, [onOpenAuth, setIsAuthOpen]);

  const handleOpenUserProfile = useCallback((user) => {
    if (onViewProfile) {
      onViewProfile(user);
    } else if (openProfileScreen) {
      openProfileScreen(user);
    }
  }, [onViewProfile, openProfileScreen]);

  const handlePlayFriendTrack = useCallback((friend) => {
    if (!friend.currentListening) return;
    const t = friend.currentListening;
    const trackPayload = {
      id: t.id || `friend_track_${friend.id}`,
      title: t.title,
      artist: t.artist,
      cover: t.cover || friend.avatar,
      audioUrl: t.audioUrl || ''
    };
    if (onPlayTrack) {
      onPlayTrack(trackPayload);
    } else if (onSelectTrack) {
      onSelectTrack(trackPayload);
    }
  }, [onPlayTrack, onSelectTrack]);

  const handleChatWithUser = useCallback((friend) => {
    if (openChatModal) {
      openChatModal(friend);
    } else if (onOpenChat) {
      onOpenChat(friend);
    }
  }, [openChatModal, onOpenChat]);

  const fetchActivity = useCallback(async (signal) => {
    if (!currentUser) {
      setActivities([]);
      return;
    }
    setIsLoading(true);
    try {
      const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
      const res = await fetch(`${API_BASE_URL}/api/users/listening-activity`, {
        signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.activities)) {
          setActivities(data.activities);
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn('Error fetching listening activity:', err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  // Fetch when opened, poll every 25s if user is logged in
  useEffect(() => {
    if (!isOpen || !currentUser) {
      setActivities([]);
      return;
    }
    const controller = new AbortController();
    fetchActivity(controller.signal);

    const interval = setInterval(() => {
      fetchActivity();
    }, 25000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [isOpen, currentUser, fetchActivity]);

  // Real-time socket event listeners for instant activity & presence updates
  useEffect(() => {
    if (!socket || !currentUser) return;

    const handleActivityUpdated = (data) => {
      if (!data || !data.userId) return;
      setActivities((prev) =>
        prev.map((friend) => {
          if (String(friend.id) === String(data.userId)) {
            return {
              ...friend,
              currentListening: data.currentListening !== undefined ? data.currentListening : friend.currentListening,
              lastActiveAt: data.lastActiveAt || friend.lastActiveAt,
              isLive: data.isLive !== undefined ? Boolean(data.isLive) : (data.isOnline !== undefined ? (data.isOnline && friend.isLive) : friend.isLive),
              isOnline: data.isOnline !== undefined ? Boolean(data.isOnline) : friend.isOnline
            };
          }
          return friend;
        })
      );
    };

    const handleUserStatus = (data) => {
      if (!data || !data.userId) return;
      setActivities((prev) =>
        prev.map((friend) => {
          if (String(friend.id) === String(data.userId)) {
            const isOnline = Boolean(data.isOnline);
            return {
              ...friend,
              isOnline,
              isLive: !isOnline ? false : (data.isLive !== undefined ? Boolean(data.isLive) : friend.isLive)
            };
          }
          return friend;
        })
      );
    };

    socket.on('activity:updated', handleActivityUpdated);
    socket.on('user:status', handleUserStatus);

    return () => {
      socket.off('activity:updated', handleActivityUpdated);
      socket.off('user:status', handleUserStatus);
    };
  }, [socket, currentUser]);

  // Show all followed friends (online, offline, recent or inactive); community suggestions only when online & listening
  const validActivities = useMemo(() => {
    if (!currentUser) return [];
    const myId = String(currentUser.id || currentUser._id || '');
    const myName = (currentUser.name || '').trim().toLowerCase();
    const myEmail = (currentUser.email || '').trim().toLowerCase();

    return activities.filter((friend) => {
      // Exclude the logged-in user themselves so their own track never appears as a friend
      const friendId = String(friend.id || friend._id || '');
      if (myId && friendId === myId) return false;
      if (myName && (friend.name || '').trim().toLowerCase() === myName) return false;
      if (myEmail && (friend.email || '').trim().toLowerCase() === myEmail) return false;

      // Community listeners: MUST be online and actually listening
      if (friend.isCommunity) {
        return Boolean(friend.isOnline && (friend.isLive || friend.currentListening?.isPlaying));
      }
      // Followed friends: show all followed friends
      return true;
    });
  }, [activities, currentUser]);

  const filteredActivities = useMemo(() => {
    if (!searchQuery.trim()) return validActivities;
    const q = searchQuery.toLowerCase();
    return validActivities.filter((friend) => {
      const nameMatch = friend.name?.toLowerCase().includes(q);
      const trackMatch = friend.currentListening?.title?.toLowerCase().includes(q);
      const artistMatch = friend.currentListening?.artist?.toLowerCase().includes(q);
      return nameMatch || trackMatch || artistMatch;
    });
  }, [validActivities, searchQuery]);

  if (!isOpen) return null;

  const isGuest = !currentUser;
  const liveCount = validActivities.filter((a) => Boolean(a.isLive && a.currentListening)).length;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none md:static md:inset-auto md:bg-transparent md:backdrop-blur-none md:p-0 md:z-10 md:w-80 lg:w-[340px] md:h-full md:shrink-0 md:flex md:items-stretch md:justify-start"
    >
      {/* Panel Box */}
      <div
        onClick={(e) => e.stopPropagation()}
        dir={isRTL ? 'rtl' : 'ltr'}
        className={`w-full max-w-lg h-[600px] max-h-[85vh] rounded-2xl flex flex-col brutal-shadow-lg brutal-border-thick overflow-hidden animate-in zoom-in-95 duration-200 md:w-full md:h-full md:max-w-none md:max-h-none md:rounded-none md:border-y-0 md:border-r-0 md:border-l-[2.5px] md:rtl:border-l-0 md:rtl:border-r-[2.5px] md:shadow-none md:animate-none transition-colors ${
          isDark ? 'bg-[#101716] border-zinc-800 text-white' : 'bg-[#fdfbf7] border-[#0b1110] text-[#0b1110]'
        }`}
      >
        {/* Mobile touch pill */}
        <div className="w-10 h-1 bg-zinc-600/70 rounded-full mx-auto my-1.5 shrink-0 md:hidden" />

        {/* Header */}
        <div
          className={`p-3.5 border-b-2 flex items-center justify-between shrink-0 ${
            isDark ? 'bg-[#141d1b] border-zinc-800 text-white' : 'bg-[#ede5d3] border-[#0b1110] text-[#082621]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-8 h-8 rounded-lg bg-[#17a398] text-[#0b1110] brutal-border flex items-center justify-center font-display font-black text-sm shrink-0">
              <Users size={16} strokeWidth={2.5} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <h3 className={`text-xs font-black uppercase truncate ${isRTL ? 'font-sans tracking-normal' : 'font-mono tracking-wider'}`}>
                  {t?.('common.friendActivityTitle') || (isRTL ? 'نشاط الأصدقاء' : 'FRIEND ACTIVITY')}
                </h3>
                <span className="text-[10px] font-bold px-1.5 py-0.2 bg-[#082621] text-[#26c4b7] rounded shrink-0">
                  {isGuest ? 0 : filteredActivities.length}
                </span>
              </div>
              <span className={`text-[9.5px] text-zinc-400 block mt-0.5 truncate ${isRTL ? 'font-sans' : 'font-mono uppercase'}`}>
                {isGuest
                  ? (t?.('common.connectShare') || (isRTL ? 'تواصل وشارك في الوقت الفعلي' : 'Connect & share in real-time'))
                  : liveCount > 0
                  ? `${liveCount} ${t?.('common.listeningLive') || (isRTL ? 'يستمعون الآن' : 'LISTENING LIVE')}`
                  : (t?.('common.discordRadar') || (isRTL ? 'رادار المجتمع والأصدقاء' : 'DISCORD & COMMUNITY RADAR'))}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {!isGuest && (
              <button
                onClick={() => fetchActivity()}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white' : 'bg-white text-[#082621] border-black hover:bg-[#ded2bb]'
                }`}
                title={t?.('common.refreshActivity') || (isRTL ? 'تحديث النشاط' : 'Refresh Activity')}
              >
                <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              </button>
            )}
            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white' : 'bg-white text-[#082621] border-black hover:bg-[#ded2bb]'
              }`}
              title="Close Panel"
            >
              <X size={15} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Search Filter when 3+ items */}
        {!isGuest && validActivities.length > 2 && (
          <div className={`p-2.5 border-b shrink-0 ${isDark ? 'border-zinc-800 bg-[#121917]' : 'border-[#0b1110]/20 bg-[#f5efe3]'}`}>
            <div className={`flex items-center px-3 py-1.5 rounded-xl border ${
              isDark ? 'bg-[#182320] border-zinc-700/80 text-white' : 'bg-white border-black text-[#0b1110]'
            }`}>
              <Search size={14} className="shrink-0 text-zinc-400 me-2" />
              <input
                type="text"
                dir="auto"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t?.('common.searchFriendOrSong') || (isRTL ? 'ابحث عن صديق أو أغنية...' : 'Search friend or song...')}
                className="w-full text-xs font-sans font-medium bg-transparent outline-none placeholder:text-zinc-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="shrink-0 text-zinc-400 hover:text-white cursor-pointer ms-1.5"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {isGuest ? (
            <GuestActivityCard onOpenAuth={handleOpenAuth} isDark={isDark} />
          ) : filteredActivities.length > 0 ? (
            filteredActivities.map((friend) => (
              <ActivityListItem
                key={friend.id}
                friend={friend}
                isDark={isDark}
                onPlayFriendTrack={handlePlayFriendTrack}
                onOpenUserProfile={handleOpenUserProfile}
                onStartJamWithUser={onStartJamWithUser}
                openChatModal={handleChatWithUser}
              />
            ))
          ) : (
            <div className="text-center py-10 px-3">
              <div className="w-12 h-12 rounded-xl bg-zinc-800/60 brutal-border flex items-center justify-center mx-auto mb-3 text-zinc-400">
                <Radio size={22} className="opacity-70" />
              </div>
              <h4 className={`text-xs font-black uppercase mb-1.5 ${isRTL ? 'font-sans tracking-normal' : 'font-mono tracking-wider'} ${
                isDark ? 'text-zinc-200' : 'text-[#082621]'
              }`}>
                {searchQuery ? (isRTL ? 'لا يوجد أصدقاء مطابقون' : 'NO MATCHING FRIENDS') : (isRTL ? 'لا توجد جلسات بث حالياً' : 'NO LIVE SESSIONS')}
              </h4>
              <p className={`text-[11px] font-sans leading-relaxed max-w-[220px] mx-auto ${
                isDark ? 'text-zinc-400' : 'text-[#082621]/70'
              }`}>
                {searchQuery
                  ? (isRTL ? `لا يوجد أصدقاء أو مقاطع مطابقة لـ "${searchQuery}".` : `No friends or tracks matching "${searchQuery}".`)
                  : (isRTL ? 'لا توجد جلسات استماع حية الآن • شغل مقطعاً لبدء الأجواء!' : 'No live sessions right now • Play a track to start the vibe!')}
              </p>
            </div>
          )}
        </div>

        {/* Footer info banner */}
        <div
          className={`p-2.5 border-t-2 flex items-center justify-between text-[11px] shrink-0 ${isRTL ? 'font-sans' : 'font-mono'} ${
            isDark ? 'bg-[#141d1b] border-zinc-800 text-zinc-400' : 'bg-[#ede5d3] border-[#0b1110] text-[#082621]/70'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#17a398] animate-ping" />
            <span className="font-bold">{isRTL ? 'مزامنة ريفو الحية' : 'RIVO LIVE SYNC'}</span>
          </div>
          {isGuest ? (
            <button
              onClick={handleOpenAuth}
              className="flex items-center gap-1 font-black uppercase cursor-pointer px-2.5 py-1 rounded-lg brutal-border text-[10px] brutal-shadow-xs bg-[#17a398] text-[#0b1110] hover:bg-[#26c4b7]"
            >
              <span>{t?.('profile.signInBtn') || (isRTL ? 'تسجيل الدخول' : 'SIGN IN')}</span>
            </button>
          ) : (
            <button
              onClick={() => handleChatWithUser()}
              className={`flex items-center gap-1 font-black uppercase cursor-pointer px-2.5 py-1 rounded-lg brutal-border text-[10px] brutal-shadow-xs ${
                isDark ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-white text-[#082621] hover:bg-[#ded2bb]'
              }`}
            >
              <span>{isRTL ? 'الرسائل' : 'MESSAGES'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
