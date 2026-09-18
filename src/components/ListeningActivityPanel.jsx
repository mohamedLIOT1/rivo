import React, { useState, useEffect } from 'react';
import { X, Play, Music, Radio, MessageSquare, ExternalLink, RefreshCw, UserCheck, Users, Volume2 } from 'lucide-react';
import { API_BASE_URL } from '../config';
import VerifiedBadge from './VerifiedBadge';
import { useAudioPlayer } from '../context/AudioContext';

export default function ListeningActivityPanel({
  isOpen,
  onClose,
  onSelectTrack,
  openProfileScreen,
  openChatModal,
  currentUser
}) {
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { currentTrack, isPlaying } = useAudioPlayer();

  const fetchActivity = async () => {
    try {
      const token = localStorage.getItem('liofy_token');
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

  // Format relative time (e.g. 2h, 45m, 2d)
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
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-200"
      />

      {/* Panel Container (Desktop Right Sidebar / Mobile Slide-Over) */}
      <aside 
        className="fixed md:static top-0 right-0 bottom-0 z-50 md:z-auto w-80 md:w-72 bg-[#121212] md:bg-[#121212] border-l border-zinc-800/80 flex flex-col shrink-0 select-none shadow-2xl md:shadow-none animate-in slide-in-from-right duration-250"
        style={{ height: '100%' }}
      >
        {/* Header */}
        <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-white tracking-tight flex items-center gap-2">
              Listening activity
            </h3>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-zinc-300">
              {activities.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={fetchActivity}
              className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors"
              title="Refresh Activity"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors"
              title="Close Panel"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Friends Activity List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {activities.length > 0 ? (
            activities.map((friend) => {
              const listening = friend.currentListening;
              const isLive = Boolean(friend.isLive || listening?.isPlaying);
              const timeAgo = formatTimeAgo(friend.lastActiveAt || listening?.updatedAt);

              return (
                <div
                  key={friend.id}
                  onClick={() => handlePlayFriendTrack(friend)}
                  className="group relative p-2 rounded-2xl hover:bg-white/5 transition-all cursor-pointer flex items-center gap-3 border border-transparent hover:border-white/5"
                >
                  {/* User Avatar with overlapping Track Art Badge */}
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700">
                      <img
                        src={friend.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}
                        alt={friend.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Mini Track Artwork badge overlapping on bottom-right */}
                    {listening?.cover && (
                      <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-md overflow-hidden border-2 border-[#121212] shadow-md bg-zinc-900">
                        <img
                          src={listening.cover}
                          alt={listening.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Live Online Pulse Dot */}
                    {isLive && (
                      <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-[#1DB954] ring-2 ring-[#121212] animate-pulse" />
                    )}
                  </div>

                  {/* Friend Info & Current Track */}
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-bold text-white truncate max-w-[120px]">
                        {friend.name}
                      </span>
                      {friend.isVerified && <VerifiedBadge userOrName={friend} size={11} />}
                      
                      {!isLive && timeAgo && (
                        <span className="text-[10px] text-zinc-500 font-medium shrink-0">
                          • {timeAgo}
                        </span>
                      )}
                    </div>

                    {listening ? (
                      <div className="flex items-center gap-1.5 truncate">
                        {isLive ? (
                          // Animated Soundwave Equalizer
                          <span className="flex items-end gap-[1.5px] h-3 w-3 shrink-0 pb-0.5" title="Listening Now">
                            <span className="w-[2px] bg-[#1DB954] rounded-full animate-[spEq1_0.8s_ease-in-out_infinite]" style={{ height: '70%' }} />
                            <span className="w-[2px] bg-[#1DB954] rounded-full animate-[spEq2_0.8s_ease-in-out_infinite]" style={{ height: '100%' }} />
                            <span className="w-[2px] bg-[#1DB954] rounded-full animate-[spEq1_0.8s_ease-in-out_infinite_0.2s]" style={{ height: '50%' }} />
                          </span>
                        ) : (
                          <Music size={11} className="text-zinc-500 shrink-0" />
                        )}

                        <p className={`text-[11px] truncate leading-tight ${isLive ? 'text-[#1DB954] font-semibold' : 'text-zinc-400'}`}>
                          {listening.title} <span className="text-zinc-500">•</span> {listening.artist}
                        </p>
                      </div>
                    ) : (
                      <p className="text-[10px] text-zinc-500">Not listening to anything</p>
                    )}
                  </div>

                  {/* Play on Hover Button */}
                  {listening && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayFriendTrack(friend);
                      }}
                      className="opacity-0 group-hover:opacity-100 w-8 h-8 rounded-full bg-[#1DB954] hover:scale-105 active:scale-95 text-black flex items-center justify-center shadow-lg transition-all shrink-0 cursor-pointer"
                      title={`Listen to ${listening.title}`}
                    >
                      <Play size={13} fill="currentColor" className="ml-0.5" />
                    </button>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 px-4">
              <Users size={36} className="mx-auto text-zinc-600 mb-3" />
              <h4 className="text-xs font-bold text-white mb-1">See what friends are playing</h4>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Follow friends and creators to discover fresh music and see their live listening activity here.
              </p>
            </div>
          )}
        </div>

        {/* Footer info banner */}
        <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between text-[11px]">
          <span className="text-zinc-400 font-medium">Real-time sync</span>
          <button
            onClick={() => openChatModal?.()}
            className="flex items-center gap-1 font-bold text-[#1DB954] hover:text-[#1ed760] transition-colors"
          >
            <MessageSquare size={12} />
            <span>Chat</span>
          </button>
        </div>
      </aside>
    </>
  );
}
