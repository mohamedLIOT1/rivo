import React, { useState, useEffect } from 'react';
import { X, Play, Music, Radio, MessageSquare, RefreshCw, Users, Search, Disc } from 'lucide-react';
import { API_BASE_URL } from '../config';
import VerifiedBadge from './VerifiedBadge';
import { useAudioPlayer } from '../context/AudioContext';
import { usePreferences } from '../context/PreferencesContext';

export default function ListeningActivityPanel({
  isOpen,
  onClose,
  onSelectTrack,
  openProfileScreen,
  openChatModal,
  onStartJamWithUser,
  currentUser,
  globalTheme = 'dark',
  socket
}) {
  const isDark = globalTheme === 'dark';
  const { language } = usePreferences();
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { currentTrack, isPlaying } = useAudioPlayer();

  const handleOpenUserProfile = (user) => {
    if (onViewProfile) {
      onViewProfile(user);
    } else if (openProfileScreen) {
      openProfileScreen(user);
    }
  };

  const fetchActivity = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
      const res = await fetch(`${API_BASE_URL}/api/users/listening-activity`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.activities)) {
          setActivities(data.activities);
        }
      }
    } catch (err) {
      console.warn('Error fetching listening activity:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchActivity();
    const interval = setInterval(fetchActivity, 25000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Real-time socket event listeners for instant activity & presence updates
  useEffect(() => {
    if (!socket) return;

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
              // If user went offline, they cannot be live listening
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
  }, [socket]);

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return 'now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const handlePlayFriendTrack = (friend) => {
    if (!friend.currentListening) return;
    const t = friend.currentListening;
    onSelectTrack?.({
      id: t.id || `friend_track_${friend.id}`,
      title: t.title,
      artist: t.artist,
      cover: t.cover || friend.avatar,
      audioUrl: t.audioUrl || ''
    });
  };

  if (!isOpen) return null;

  const liveCount = activities.filter((a) => Boolean(a.isLive)).length;

  const filteredActivities = activities.filter((friend) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = friend.name?.toLowerCase().includes(q);
    const trackMatch = friend.currentListening?.title?.toLowerCase().includes(q);
    const artistMatch = friend.currentListening?.artist?.toLowerCase().includes(q);
    return nameMatch || trackMatch || artistMatch;
  });

  return (
    /* Outer container: On mobile (< md) renders as centered popup modal overlay matching ChatModal.
       On desktop (md:), docks cleanly as right sidebar. */
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none md:static md:inset-auto md:bg-transparent md:backdrop-blur-none md:p-0 md:z-10 md:w-72 md:h-full md:shrink-0 md:flex md:items-stretch md:justify-start"
    >
      {/* Panel Box */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md h-[580px] max-h-[85vh] rounded-2xl flex flex-col brutal-shadow-lg brutal-border-thick overflow-hidden animate-in zoom-in-95 duration-200 md:w-full md:h-full md:max-w-none md:max-h-none md:rounded-none md:border-y-0 md:border-r-0 md:border-l-[2.5px] md:shadow-none md:animate-none transition-colors ${
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
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#17a398] text-[#0b1110] brutal-border flex items-center justify-center font-display font-black text-sm shrink-0">
              <Users size={16} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-mono font-black uppercase tracking-wider">
                  FRIEND ACTIVITY
                </h3>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-[#082621] text-[#26c4b7] rounded">
                  {activities.length}
                </span>
              </div>
              <span className="text-[9.5px] font-mono text-zinc-400 block mt-0.5">
                {liveCount > 0 
                  ? `🎧 ${liveCount} live right now` 
                  : 'Live listening status'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchActivity}
              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white' : 'bg-white text-[#082621] border-black hover:bg-[#ded2bb]'
              }`}
              title="Refresh Activity"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            </button>
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

        {/* Search Filter when 3+ friends */}
        {activities.length > 2 && (
          <div className={`p-2 border-b shrink-0 ${isDark ? 'border-zinc-800 bg-[#121917]' : 'border-[#0b1110]/20 bg-[#f5efe3]'}`}>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search friend or song..."
                className={`w-full text-xs font-mono pl-7.5 pr-6 py-1.5 rounded-lg border focus:outline-none ${
                  isDark ? 'bg-[#182320] border-zinc-700 text-white placeholder-zinc-500' : 'bg-white border-black text-[#0b1110] placeholder-zinc-400'
                }`}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Friends Activity List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
          {filteredActivities.length > 0 ? (
            filteredActivities.map((friend) => {
              const listening = friend.currentListening;
              const isLive = Boolean(friend.isLive);
              const isOnline = Boolean(friend.isOnline);
              const timeAgo = formatTimeAgo(friend.lastActiveAt || listening?.updatedAt);

              return (
                <div
                  key={friend.id}
                  className={`group relative p-2.5 rounded-xl brutal-border transition-all flex items-center gap-2.5 ${
                    isDark
                      ? 'bg-[#182320] border-zinc-700 hover:bg-[#202f2b]'
                      : 'bg-[#ede5d3] border-black hover:bg-white'
                  }`}
                >
                  {/* User Avatar - click opens profile */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenUserProfile(friend);
                    }}
                    className="relative shrink-0 cursor-pointer hover:scale-105 transition-transform"
                    title={`View ${friend.name}'s profile`}
                  >
                    <div className="w-10 h-10 rounded-lg brutal-border overflow-hidden bg-white">
                      <img
                        src={friend.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                        alt={friend.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {isLive ? (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border border-[#0b1110] rounded-full animate-pulse flex items-center justify-center shadow-[0_0_8px_#10b981]" title="Listening Live Now">
                        <span className="w-1.5 h-1.5 bg-white rounded-full" />
                      </span>
                    ) : isOnline ? (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border border-[#0b1110] rounded-full" title="Online (Idle)" />
                    ) : (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-zinc-500 border border-[#0b1110] rounded-full" title="Offline" />
                    )}
                  </div>

                  {/* Friend Info & Current Track */}
                  <div className="flex-1 min-w-0 pr-1">
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenUserProfile(friend);
                      }}
                      className="flex items-center gap-1.5 mb-0.5 cursor-pointer"
                    >
                      <span className={`text-xs font-bold truncate max-w-[110px] hover:underline ${isDark ? 'text-white' : 'text-[#082621]'}`}>
                        {friend.name}
                      </span>
                      {friend.isVerified && <VerifiedBadge userOrName={friend} size={11} />}

                      {isLive ? (
                        <span className="text-[9px] font-mono font-black px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 uppercase shrink-0">
                          Listening Now
                        </span>
                      ) : isOnline ? (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-700/50 text-zinc-300 border border-zinc-600/50 uppercase shrink-0">
                          Online
                        </span>
                      ) : (
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/40 uppercase shrink-0">
                          Offline {timeAgo ? `• ${timeAgo}` : ''}
                        </span>
                      )}
                    </div>

                    {isLive && listening ? (
                      <div
                        onClick={() => handlePlayFriendTrack(friend)}
                        className="flex items-center gap-1.5 truncate cursor-pointer hover:opacity-85 transition"
                        title={`Listening now: ${listening.title}`}
                      >
                        <Disc size={11} className="shrink-0 text-[#17a398] animate-spin" style={{ animationDuration: '3s' }} />
                        <p className="text-[11px] truncate leading-tight text-[#17a398] font-bold">
                          {listening.title} <span className="opacity-50">•</span> {listening.artist}
                        </p>
                      </div>
                    ) : listening && isOnline ? (
                      <div
                        onClick={() => handlePlayFriendTrack(friend)}
                        className="flex items-center gap-1.5 truncate cursor-pointer hover:opacity-85 transition"
                        title={`Last played: ${listening.title}`}
                      >
                        <Disc size={11} className="shrink-0 text-zinc-400" />
                        <p className={`text-[10.5px] truncate leading-tight ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                          <span className="opacity-60 text-[9.5px]">Paused:</span> {listening.title} <span className="opacity-50">•</span> {listening.artist}
                        </p>
                      </div>
                    ) : listening && !isOnline ? (
                      <div
                        onClick={() => handlePlayFriendTrack(friend)}
                        className="flex items-center gap-1.5 truncate cursor-pointer hover:opacity-85 transition"
                        title={`Last played before disconnect: ${listening.title}`}
                      >
                        <Disc size={11} className="shrink-0 text-zinc-600" />
                        <p className={`text-[10px] truncate leading-tight ${isDark ? 'text-zinc-500' : 'text-[#082621]/50'}`}>
                          <span className="opacity-60 text-[9px]">Last played:</span> {listening.title}
                        </p>
                      </div>
                    ) : (
                      <p className={`text-[10px] font-mono ${isDark ? 'text-zinc-500' : 'text-[#082621]/50'}`}>
                        {isOnline ? 'Online • Browsing crates' : 'Offline'}
                      </p>
                    )}
                  </div>

                  {/* Actions: Always visible on mobile for easy touch, visible on hover on desktop */}
                  <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    {/* Play friend track */}
                    {listening && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayFriendTrack(friend);
                        }}
                        className="w-7 h-7 bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] brutal-border flex items-center justify-center transition-all cursor-pointer rounded-lg brutal-shadow-xs"
                        title={`Listen to ${listening.title}`}
                      >
                        <Play size={11} fill="currentColor" className="ml-0.5 text-[#0b1110]" />
                      </button>
                    )}

                    {/* Jam Session Invite */}
                    {onStartJamWithUser && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onStartJamWithUser(friend);
                        }}
                        className="w-7 h-7 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border flex items-center justify-center transition-all cursor-pointer rounded-lg brutal-shadow-xs"
                        title={`Invite ${friend.name} to Jam`}
                      >
                        <Radio size={12} strokeWidth={2.5} className="animate-pulse" />
                      </button>
                    )}

                    {/* Direct Chat */}
                    {openChatModal && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openChatModal(friend);
                        }}
                        className={`w-7 h-7 brutal-border flex items-center justify-center transition-all cursor-pointer rounded-lg brutal-shadow-xs ${
                          isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-white hover:bg-zinc-100 text-[#0b1110]'
                        }`}
                        title={`Message ${friend.name}`}
                      >
                        <MessageSquare size={12} strokeWidth={2} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 px-3">
              <Users size={30} className={`mx-auto mb-2 ${isDark ? 'text-zinc-600' : 'text-[#082621]/40'}`} />
              <h4 className={`text-xs font-mono font-black uppercase mb-1 ${isDark ? 'text-zinc-300' : 'text-[#082621]'}`}>
                {searchQuery 
                  ? 'NO MATCHING FRIENDS' 
                  : 'NO FRIEND ACTIVITY'}
              </h4>
              <p className={`text-[11px] font-sans leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                {searchQuery
                  ? `No friends or tracks matching "${searchQuery}".`
                  : 'Follow other users to see what they are listening to in real-time.'}
              </p>
            </div>
          )}
        </div>

        {/* Footer info banner */}
        <div
          className={`p-2.5 border-t-2 flex items-center justify-between text-[11px] font-mono shrink-0 ${
            isDark ? 'bg-[#141d1b] border-zinc-800 text-zinc-400' : 'bg-[#ede5d3] border-[#0b1110] text-[#082621]/70'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#17a398] animate-ping" />
            <span className="font-bold">RIVO LIVE SYNC</span>
          </div>
          <button
            onClick={() => openChatModal?.()}
            className={`flex items-center gap-1 font-black uppercase cursor-pointer px-2.5 py-1 rounded-lg brutal-border text-[10px] brutal-shadow-xs ${
              isDark ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-white text-[#082621] hover:bg-[#ded2bb]'
            }`}
          >
            <MessageSquare size={11} />
            <span>MESSAGES</span>
          </button>
        </div>
      </div>
    </div>
  );
}
