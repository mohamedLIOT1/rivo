import React, { memo, useState } from 'react';
import { Play, Radio, MessageSquare, Disc } from 'lucide-react';
import VerifiedBadge from '../VerifiedBadge';
import { usePreferences } from '../../context/PreferencesContext';

function formatTimeAgo(dateStr, isRTL) {
  if (!dateStr) return '';
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (isNaN(diffSec) || diffSec < 0) return '';
  if (diffSec < 60) return isRTL ? 'منذ قليل' : 'just now';
  if (diffSec < 3600) {
    const mins = Math.floor(diffSec / 60);
    return isRTL ? `منذ ${mins} د` : `${mins}m ago`;
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return isRTL ? `منذ ${hours} س` : `${hours}h ago`;
  }
  const days = Math.floor(diffSec / 86400);
  return isRTL ? `منذ ${days} يوم` : `${days}d ago`;
}

function formatCompactPill(lastActiveAt, isRTL) {
  if (!lastActiveAt) return isRTL ? 'غير متصل' : 'OFFLINE';
  const diffSec = Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 1000);
  if (isNaN(diffSec) || diffSec < 0) return isRTL ? 'غير متصل' : 'OFFLINE';
  if (diffSec < 60) return isRTL ? 'الآن' : 'NOW';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}M`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}H`;
  const days = Math.floor(diffSec / 86400);
  return `${days}D`;
}

function ActivityListItemComponent({
  friend,
  isDark = true,
  onPlayFriendTrack,
  onOpenUserProfile,
  onStartJamWithUser,
  openChatModal
}) {
  const { t, isRTL } = usePreferences();
  const [imgError, setImgError] = useState(false);
  const rawListening = friend.currentListening;
  const isDummyOffline = Boolean(
    rawListening?.title?.toLowerCase() === 'offline' ||
    rawListening?.name?.toLowerCase() === 'offline'
  );
  const listening = isDummyOffline ? null : rawListening;
  const isLive = Boolean(friend.isLive && listening);
  const isOnline = Boolean(friend.isOnline);
  const hasAvatar = Boolean(friend.avatar && !imgError);

  return (
    <div
      className={`group relative p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
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
        className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
        title={`View ${friend.name || 'user'}'s profile`}
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          {hasAvatar ? (
            <img
              src={friend.avatar}
              alt={friend.name || 'Friend'}
              onError={() => setImgError(true)}
              className="w-10.5 h-10.5 rounded-xl object-cover ring-1 ring-black/10"
            />
          ) : (
            <div className="w-10.5 h-10.5 rounded-xl bg-[#17a398] flex items-center justify-center font-black text-sm text-[#0b1110] select-none shadow-xs">
              {friend.name ? friend.name[0].toUpperCase() : 'U'}
            </div>
          )}

          {/* Status Dot */}
          {isLive ? (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#10b981] border-2 border-[#0b1110] rounded-full animate-pulse shadow-[0_0_6px_#10b981]"
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

        {/* Friend Info & Current Track - Takes full available width */}
        <div className="flex-1 min-w-0">
          {/* Name & Status / Time Pill Row */}
          <div className="flex items-center justify-between gap-2 mb-1 w-full min-w-0">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span
                className={`text-xs font-black truncate hover:underline ${
                  isDark ? 'text-white' : 'text-[#082621]'
                }`}
                title={friend.name || 'Anonymous Listener'}
              >
                {friend.name || 'Anonymous Listener'}
              </span>
              {friend.isVerified && <VerifiedBadge userOrName={friend} size={12} />}
            </div>

            {/* Time / Status pill cleanly positioned on the top-right */}
            {isLive ? (
              <span className="flex items-center gap-1 text-[8.5px] font-mono font-black px-1.5 py-0.5 rounded-md bg-[#17a398] text-[#0b1110] uppercase shrink-0 shadow-xs">
                <Radio size={9} strokeWidth={3} className="shrink-0 animate-pulse" />
                {isRTL ? 'مباشر' : 'LIVE'}
              </span>
            ) : isOnline ? (
              <span className="text-[8.5px] font-mono font-black px-1.5 py-0.5 rounded-md bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 uppercase shrink-0">
                {isRTL ? 'متصل' : 'ONLINE'}
              </span>
            ) : (
              <span
                className={`text-[8.5px] font-mono font-bold px-1.5 py-0.5 rounded-md uppercase shrink-0 ${
                  isDark ? 'bg-zinc-800 text-zinc-400 border border-zinc-700/60' : 'bg-[#e5dcce] text-zinc-600 border border-[#0b1110]/15'
                }`}
                title={friend.lastActiveAt ? (isRTL ? `آخر نشاط: ${formatTimeAgo(friend.lastActiveAt, isRTL)}` : `Last active: ${formatTimeAgo(friend.lastActiveAt, false)}`) : 'Offline'}
              >
                {formatCompactPill(friend.lastActiveAt, isRTL)}
              </span>
            )}
          </div>

          {/* Listening State / Track Info Row - Full flex width */}
          {isLive && listening ? (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onPlayFriendTrack?.(friend);
              }}
              className="flex items-center gap-1.5 min-w-0 w-full cursor-pointer hover:opacity-85 transition"
              title={`${isRTL ? 'يستمع إلى' : 'Playing'}: ${listening.title || 'Playing song'}`}
            >
              <Disc
                size={12}
                className="shrink-0 text-[#26c4b7] animate-spin"
                style={{ animationDuration: '3s' }}
                strokeWidth={2.4}
              />
              <p className="text-[11px] truncate leading-tight text-[#26c4b7] font-bold flex-1 min-w-0">
                {isRTL ? 'يستمع إلى: ' : 'Playing: '}{listening.title || 'Playing song'}
                {listening.artist ? ` • ${listening.artist}` : ''}
              </p>
            </div>
          ) : listening && isOnline ? (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onPlayFriendTrack?.(friend);
              }}
              className="flex items-center gap-1.5 min-w-0 w-full cursor-pointer hover:opacity-85 transition"
              title={`${isRTL ? 'متوقف مؤقتاً' : 'Paused'}: ${listening.title || 'Track'}`}
            >
              <Disc size={11} className="shrink-0 text-[#f59e0b]" strokeWidth={2} />
              <p
                className={`text-[11px] truncate leading-tight flex-1 min-w-0 ${
                  isDark ? 'text-[#fcd34d]' : 'text-[#b45309]'
                }`}
              >
                {isRTL ? 'متوقف مؤقتاً: ' : 'Paused: '}{listening.title || 'Track'}
                {listening.artist ? ` • ${listening.artist}` : ''}
              </p>
            </div>
          ) : listening && !isOnline ? (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onPlayFriendTrack?.(friend);
              }}
              className="flex items-center gap-1.5 min-w-0 w-full cursor-pointer hover:opacity-85 transition"
              title={`${isRTL ? 'آخر استماع' : 'Last played'}: ${listening.title || 'Track'}`}
            >
              <Disc size={11} className="shrink-0 text-[#64748b]" strokeWidth={1.8} />
              <p className="text-[11px] truncate leading-tight text-[#94a3b8] flex-1 min-w-0">
                {isRTL ? 'آخر استماع: ' : 'Last played: '}{listening.title || 'Track'}
                {listening.artist ? ` • ${listening.artist}` : ''}
              </p>
            </div>
          ) : (
            <p className="text-[11px] font-mono text-[#64748b] truncate leading-tight flex-1 min-w-0">
              {isOnline
                ? (isRTL ? 'متصل • يتصفح الموسيقى' : 'Online • Exploring music')
                : friend.lastActiveAt
                ? (isRTL ? `آخر نشاط ${formatTimeAgo(friend.lastActiveAt, isRTL)}` : `Last active ${formatTimeAgo(friend.lastActiveAt, false)}`)
                : (isRTL ? 'غير متصل' : 'Offline')}
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
          className="flex items-center gap-1.5 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] px-3 py-1.5 rounded-lg text-[10.5px] font-black uppercase brutal-border cursor-pointer transition shrink-0 brutal-shadow-xs ml-1"
          title={`Tune in to ${friend.name}`}
        >
          <Play size={11} fill="#0b1110" color="#0b1110" />
          <span>TUNE IN</span>
        </button>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
          {onStartJamWithUser && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartJamWithUser(friend);
              }}
              className="w-7.5 h-7.5 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border flex items-center justify-center transition cursor-pointer rounded-lg brutal-shadow-xs"
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
              className={`w-7.5 h-7.5 brutal-border flex items-center justify-center transition cursor-pointer rounded-lg brutal-shadow-xs ${
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
