import React, { memo, useState } from 'react';
import { Play, Radio, MessageSquare, Disc } from 'lucide-react';
import VerifiedBadge from '../VerifiedBadge';

function formatLastSeen(dateStr, isOnline) {
  if (isOnline) return 'Active now';
  if (!dateStr) return 'Offline';
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (isNaN(diffSec) || diffSec < 0) return 'Offline';
  if (diffSec < 60) return 'Active just now';
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return `Active ${mins}m ago`;
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return `Offline ${hours}h ago`;
  }
  const days = Math.floor(diffSec / 86400);
  return `Offline ${days}d ago`;
}

function ActivityListItemComponent({
  friend,
  isDark = true,
  onPlayFriendTrack,
  onOpenUserProfile,
  onStartJamWithUser,
  openChatModal
}) {
  const [imgError, setImgError] = useState(false);
  const listening = friend.currentListening;
  const isLive = Boolean(friend.isLive && friend.currentListening);
  const isOnline = Boolean(friend.isOnline);
  const hasAvatar = Boolean(friend.avatar && !imgError);

  return (
    <div
      className={`group relative p-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
        isDark
          ? 'bg-[#141d1b] border-[#263330] hover:border-[#384c47]'
          : 'bg-[#ede5d3] border-[#0b1110] hover:bg-white'
      }`}
    >
      {/* Left side: Avatar + Friend Info (clickable to view profile) */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onOpenUserProfile?.(friend);
        }}
        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
        title={`View ${friend.name || 'user'}'s profile`}
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          {hasAvatar ? (
            <img
              src={friend.avatar}
              alt={friend.name || 'Friend'}
              onError={() => setImgError(true)}
              className="w-10 h-10 rounded-xl object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-[#17a398] flex items-center justify-center font-black text-sm text-[#0b1110] select-none">
              {friend.name ? friend.name[0].toUpperCase() : 'U'}
            </div>
          )}

          {/* Status Dot */}
          {isLive ? (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#10b981] border-2 border-[#0b1110] rounded-full animate-pulse shadow-[0_0_6px_#10b981]"
              title="Listening Live"
            />
          ) : isOnline ? (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#34d399] border-2 border-[#0b1110] rounded-full"
              title="Online"
            />
          ) : (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-[#64748b] border-2 border-[#0b1110] rounded-full"
              title="Offline"
            />
          )}
        </div>

        {/* Friend Info & Current Track */}
        <div className="flex-1 min-w-0 pr-1">
          {/* Name & Status Badge Row */}
          <div className="flex items-center gap-1.5 mb-0.5">
            <span
              className={`text-xs font-extrabold truncate max-w-[110px] hover:underline ${
                isDark ? 'text-white' : 'text-[#082621]'
              }`}
            >
              {friend.name || 'Anonymous Listener'}
            </span>
            {friend.isVerified && <VerifiedBadge userOrName={friend} size={11} />}

            {isLive ? (
              <span className="flex items-center gap-1 text-[8px] font-mono font-black px-1.5 py-0.5 rounded bg-[#17a398] text-[#0b1110] uppercase shrink-0">
                <Radio size={9} strokeWidth={3} className="shrink-0" />
                LISTENING NOW
              </span>
            ) : isOnline ? (
              <span className="text-[8px] font-mono font-black px-1.5 py-0.5 rounded bg-[#334155] text-[#cbd5e1] uppercase shrink-0">
                ONLINE
              </span>
            ) : (
              <span className="text-[8px] font-mono font-black px-1.5 py-0.5 rounded bg-[#1e293b] text-[#94a3b8] uppercase shrink-0">
                {formatLastSeen(friend.lastActiveAt, false).toUpperCase()}
              </span>
            )}
          </div>

          {/* Listening State / Track Info Row */}
          {isLive && listening ? (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onPlayFriendTrack?.(friend);
              }}
              className="flex items-center gap-1.5 truncate cursor-pointer hover:opacity-85 transition"
              title={`Playing: ${listening.title || 'Playing song'}`}
            >
              <Disc
                size={12}
                className="shrink-0 text-[#26c4b7] animate-spin"
                style={{ animationDuration: '3s' }}
                strokeWidth={2.4}
              />
              <p className="text-[11px] truncate leading-tight text-[#26c4b7] font-bold">
                Playing: {listening.title || 'Playing song'}
                {listening.artist ? ` • ${listening.artist}` : ''}
              </p>
            </div>
          ) : listening && isOnline ? (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onPlayFriendTrack?.(friend);
              }}
              className="flex items-center gap-1.5 truncate cursor-pointer hover:opacity-85 transition"
              title={`Paused: ${listening.title || 'Track'}`}
            >
              <Disc size={11} className="shrink-0 text-[#f59e0b]" strokeWidth={2} />
              <p
                className={`text-[11px] truncate leading-tight ${
                  isDark ? 'text-[#fcd34d]' : 'text-[#b45309]'
                }`}
              >
                Paused: {listening.title || 'Track'}
                {listening.artist ? ` • ${listening.artist}` : ''}
              </p>
            </div>
          ) : listening && !isOnline ? (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onPlayFriendTrack?.(friend);
              }}
              className="flex items-center gap-1.5 truncate cursor-pointer hover:opacity-85 transition"
              title={`Last played: ${listening.title || 'Track'}`}
            >
              <Disc size={11} className="shrink-0 text-[#64748b]" strokeWidth={1.8} />
              <p className="text-[11px] truncate leading-tight text-[#64748b]">
                Last played: {listening.title || 'Track'}
                {listening.artist ? ` • ${listening.artist}` : ''}
              </p>
            </div>
          ) : (
            <p className="text-[11px] font-mono text-[#64748b] truncate leading-tight">
              {isOnline
                ? 'Online • Browsing crates'
                : friend.lastActiveAt
                ? `Offline • ${formatLastSeen(friend.lastActiveAt, false)}`
                : 'Offline'}
            </p>
          )}
        </div>
      </div>

      {/* Action: 1-Tap TUNE IN when live, or quick action shortcuts on hover */}
      {isLive && listening ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPlayFriendTrack?.(friend);
          }}
          className="flex items-center gap-1 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] px-2.5 py-1.5 rounded-lg text-[10px] font-black brutal-border cursor-pointer transition shrink-0 brutal-shadow-xs"
          title={`Tune in to ${friend.name}`}
        >
          <Play size={11} fill="#0b1110" color="#0b1110" />
          <span>TUNE IN</span>
        </button>
      ) : (
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {onStartJamWithUser && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartJamWithUser(friend);
              }}
              className="w-7 h-7 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border flex items-center justify-center transition cursor-pointer rounded-lg brutal-shadow-xs"
              title={`Invite ${friend.name || 'friend'} to Jam`}
            >
              <Radio size={12} strokeWidth={2.5} className="animate-pulse" />
            </button>
          )}

          {openChatModal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openChatModal(friend);
              }}
              className={`w-7 h-7 brutal-border flex items-center justify-center transition cursor-pointer rounded-lg brutal-shadow-xs ${
                isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-white hover:bg-zinc-100 text-[#0b1110]'
              }`}
              title={`Message ${friend.name || 'friend'}`}
            >
              <MessageSquare size={12} strokeWidth={2} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const ActivityListItem = memo(ActivityListItemComponent);
export default ActivityListItem;
