import React, { useState, useEffect } from 'react';
import { X, Play, Music, Radio, MessageSquare, RefreshCw, Users } from 'lucide-react';
import { API_BASE_URL } from '../config';
import VerifiedBadge from './VerifiedBadge';
import { useAudioPlayer } from '../context/AudioContext';

export default function ListeningActivityPanel({
  isOpen,
  onClose,
  onSelectTrack,
  openProfileScreen,
  openChatModal,
  currentUser,
  globalTheme = 'dark'
}) {
  const isDark = globalTheme === 'dark';
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { currentTrack, isPlaying } = useAudioPlayer();

  const fetchActivity = async () => {
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
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchActivity();
    const interval = setInterval(fetchActivity, 25000);
    return () => clearInterval(interval);
  }, [isOpen]);

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

  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
      />

      {/* Panel Container (Desktop Right Sidebar / Mobile Slide-Over) */}
      <aside 
        className={`fixed md:relative top-0 md:top-auto right-0 bottom-0 md:bottom-auto z-40 md:z-10 w-80 md:w-72 border-l-2 md:border-l-[2.5px] flex flex-col shrink-0 select-none shadow-2xl md:shadow-none animate-in slide-in-from-right duration-250 h-full transition-colors ${
          isDark ? 'bg-[#101716] border-zinc-800 text-white' : 'bg-[#fdfbf7] border-[#0b1110] text-[#0b1110]'
        }`}
      >
        {/* Header */}
        <div className={`p-3.5 border-b-2 flex items-center justify-between ${
          isDark ? 'bg-[#141d1b] border-zinc-800 text-white' : 'bg-[#ede5d3] border-[#0b1110] text-[#082621]'
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 bg-[#17a398] brutal-border" />
            <h3 className="text-xs font-mono font-black uppercase">
              FRIEND ACTIVITY
            </h3>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 bg-[#082621] text-[#26c4b7]">
              {activities.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={fetchActivity}
              className={`p-1 transition-colors cursor-pointer ${
                isDark ? 'text-zinc-400 hover:text-white' : 'text-[#082621] hover:bg-[#ded2bb]'
              }`}
              title="Refresh Activity"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className={`p-1 transition-colors cursor-pointer ${
                isDark ? 'text-zinc-400 hover:text-white' : 'text-[#082621] hover:bg-[#ded2bb]'
              }`}
              title="Close Panel"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Friends Activity List */}
        <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
          {activities.length > 0 ? (
            activities.map((friend) => {
              const listening = friend.currentListening;
              const isLive = Boolean(friend.isLive || listening?.isPlaying);
              const timeAgo = formatTimeAgo(friend.lastActiveAt || listening?.updatedAt);

              return (
                <div
                  key={friend.id}
                  onClick={() => handlePlayFriendTrack(friend)}
                  className={`group relative p-2 brutal-border transition-all cursor-pointer flex items-center gap-2.5 ${
                    isDark 
                      ? 'bg-[#182320] border-zinc-700 hover:bg-[#202f2b]' 
                      : 'bg-[#ede5d3] border-black hover:bg-white'
                  }`}
                >
                  {/* User Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 brutal-border overflow-hidden bg-white">
                      <img
                        src={friend.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                        alt={friend.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {isLive && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#dc2626] border border-[#0b1110] animate-pulse" />
                    )}
                  </div>

                  {/* Friend Info & Current Track */}
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center gap-1 mb-0.5">
                      <span className={`text-xs font-bold truncate max-w-[110px] ${isDark ? 'text-white' : 'text-[#082621]'}`}>
                        {friend.name}
                      </span>
                      {friend.isVerified && <VerifiedBadge userOrName={friend} size={11} />}
                      
                      {!isLive && timeAgo && (
                        <span className={`text-[9px] font-mono shrink-0 ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`}>
                          • {timeAgo}
                        </span>
                      )}
                    </div>

                    {listening ? (
                      <div className="flex items-center gap-1 truncate">
                        <p className={`text-[11px] truncate leading-tight ${
                          isLive 
                            ? 'text-[#17a398] font-bold' 
                            : (isDark ? 'text-zinc-300' : 'text-[#082621]/70')
                        }`}>
                          {listening.title} <span className="opacity-50">•</span> {listening.artist}
                        </p>
                      </div>
                    ) : (
                      <p className={`text-[10px] font-mono ${isDark ? 'text-zinc-500' : 'text-[#082621]/50'}`}>IDLE • NO DOSE ACTIVE</p>
                    )}
                  </div>

                  {/* Play on Hover Button */}
                  {listening && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayFriendTrack(friend);
                      }}
                      className="opacity-0 group-hover:opacity-100 w-7 h-7 bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] brutal-border flex items-center justify-center transition-all shrink-0 cursor-pointer"
                      title={`Listen to ${listening.title}`}
                    >
                      <Play size={12} fill="currentColor" className="ml-0.5 text-[#0b1110]" />
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 px-3">
              <Users size={30} className={`mx-auto mb-2 ${isDark ? 'text-zinc-600' : 'text-[#082621]/40'}`} />
              <h4 className={`text-xs font-mono font-black uppercase mb-1 ${isDark ? 'text-zinc-300' : 'text-[#082621]'}`}>NO FRIEND ACTIVITY</h4>
              <p className={`text-[11px] font-sans leading-relaxed ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                Follow other users to see what they are listening to in real-time.
              </p>
            </div>
          )}
        </div>

        {/* Footer info banner */}
        <div className={`p-2.5 border-t-2 flex items-center justify-between text-[11px] font-mono ${
          isDark ? 'bg-[#141d1b] border-zinc-800 text-zinc-400' : 'bg-[#ede5d3] border-[#0b1110] text-[#082621]/70'
        }`}>
          <span className="font-bold">RIVO SYNC</span>
          <button
            onClick={() => openChatModal?.()}
            className={`flex items-center gap-1 font-black uppercase cursor-pointer ${
              isDark ? 'text-zinc-300 hover:text-[#17a398]' : 'text-[#082621] hover:text-[#17a398]'
            }`}
          >
            <MessageSquare size={12} />
            <span>CHAT</span>
          </button>
        </div>
      </aside>
    </>
  );
}
