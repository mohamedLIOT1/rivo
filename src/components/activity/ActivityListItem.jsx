import React, { memo, useState } from 'react';
import { Play, Radio, MessageSquare, Disc, Clock, User } from 'lucide-react';
import VerifiedBadge from '../VerifiedBadge';
import { usePreferences } from '../../context/PreferencesContext';

function formatTimeAgo(dateStr, isRTL) {
  if (!dateStr) return '';
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (isNaN(diffSec) || diffSec < 0) return '';
  if (diffSec < 60) return isRTL ? 'منذ قليل' : 'just now';
  if (diffSec < 3600) {
    const mins = Math.max(1, Math.floor(diffSec / 60));
    return isRTL ? `منذ ${mins} دقيقة` : `${mins}m ago`;
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return isRTL
      ? (hours === 1 ? 'منذ ساعة' : hours === 2 ? 'منذ ساعتين' : `منذ ${hours} ساعات`)
      : `${hours}h ago`;
  }
  const days = Math.floor(diffSec / 86400);
  if (isRTL) {
    if (days === 1) return 'أمس';
    if (days === 2) return 'منذ يومين';
    if (days <= 10) return `منذ ${days} أيام`;
    return `منذ ${days} يوماً`;
  }
  return days === 1 ? 'yesterday' : `${days}d ago`;
}

function formatBadgePill(lastActiveAt, isRTL) {
  if (!lastActiveAt) return isRTL ? 'غير متصل' : 'Offline';
  const diffSec = Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 1000);
  if (isNaN(diffSec) || diffSec < 0) return isRTL ? 'غير متصل' : 'Offline';
  if (diffSec < 60) return isRTL ? 'الآن' : 'Now';
  if (diffSec < 3600) {
    const mins = Math.max(1, Math.floor(diffSec / 60));
    return isRTL ? `${mins} د` : `${mins}m`;
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return isRTL ? `${hours} س` : `${hours}h`;
  }
  const days = Math.floor(diffSec / 86400);
  if (days === 1) return isRTL ? 'أمس' : '1d';
  return isRTL ? `${days} ي` : `${days}d`;
}

function ActivityListItemComponent({
  friend,
  isDark = true,
  onPlayFriendTrack,
  onOpenUserProfile,
  onStartJamWithUser,
  openChatModal
}) {
  const { isRTL } = usePreferences();
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
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#17a398] text-[#0b1110] shrink-0 shadow-xs">
                <Radio size={10} strokeWidth={3} className="shrink-0 animate-pulse" />
                <span>{isRTL ? 'مباشر' : 'LIVE'}</span>
              </span>
            ) : isOnline ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>{isRTL ? 'متصل' : 'ONLINE'}</span>
              </span>
            ) : (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full shrink-0 ${
                  isDark
                    ? 'bg-zinc-800/90 text-zinc-300 border border-zinc-700/60'
                    : 'bg-[#ded4c1] text-zinc-700 border border-[#0b1110]/20'
                }`}
                title={
                  friend.lastActiveAt
                    ? isRTL
                      ? `آخر نشاط: ${formatTimeAgo(friend.lastActiveAt, true)}`
                      : `Last active: ${formatTimeAgo(friend.lastActiveAt, false)}`
                    : isRTL
                    ? 'غير متصل'
                    : 'Offline'
                }
              >
                <Clock size={11} className="shrink-0 text-zinc-400" />
                <span>{formatBadgePill(friend.lastActiveAt, isRTL)}</span>
              </span>
            )}
          </div>

          {/* Listening State / Track Info Row - Full width allocated to track title */}
          {isLive && listening ? (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onPlayFriendTrack?.(friend);
              }}
              className="flex items-center gap-1.5 min-w-0 w-full cursor-pointer hover:opacity-85 transition"
              title={`${isRTL ? 'يستمع إلى' : 'Playing'}: ${listening.title || 'Playing song'}${listening.artist ? ` • ${listening.artist}` : ''}`}
            >
              <Disc
                size={12}
                className="shrink-0 text-[#26c4b7] animate-spin"
                style={{ animationDuration: '3s' }}
                strokeWidth={2.4}
              />
              <p className="text-xs truncate leading-snug text-[#26c4b7] font-bold flex-1 min-w-0">
                <span>{listening.title || 'Playing song'}</span>
                {listening.artist ? <span className="opacity-80 font-medium"> • {listening.artist}</span> : ''}
              </p>
            </div>
          ) : listening && isOnline ? (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onPlayFriendTrack?.(friend);
              }}
              className="flex items-center gap-1.5 min-w-0 w-full cursor-pointer hover:opacity-85 transition"
              title={`${isRTL ? 'متوقف مؤقتاً' : 'Paused'}: ${listening.title || 'Track'}${listening.artist ? ` • ${listening.artist}` : ''}`}
            >
              <Disc size={11} className="shrink-0 text-[#f59e0b]" strokeWidth={2} />
              <p
                className={`text-xs truncate leading-snug flex-1 min-w-0 font-medium ${
                  isDark ? 'text-[#fcd34d]' : 'text-[#b45309]'
                }`}
              >
                <span>{listening.title || 'Track'}</span>
                {listening.artist ? <span className="opacity-80"> • {listening.artist}</span> : ''}
              </p>
            </div>
          ) : listening && !isOnline ? (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onPlayFriendTrack?.(friend);
              }}
              className="flex items-center gap-1.5 min-w-0 w-full cursor-pointer hover:opacity-85 transition"
              title={`${isRTL ? 'آخر استماع' : 'Last played'}: ${listening.title || 'Track'}${listening.artist ? ` • ${listening.artist}` : ''}`}
            >
              <Disc size={11} className="shrink-0 text-zinc-500" strokeWidth={1.8} />
              <p className="text-xs truncate leading-snug text-zinc-300 font-medium flex-1 min-w-0">
                <span className="font-semibold text-white">{listening.title || 'Track'}</span>
                {listening.artist ? <span className="text-zinc-400"> • {listening.artist}</span> : ''}
              </p>
            </div>
          ) : (
            <p
              dir="auto"
              className={`text-xs truncate leading-snug flex-1 min-w-0 font-sans ${
                isDark ? 'text-zinc-400' : 'text-zinc-600'
              }`}
            >
              {isOnline
                ? (isRTL ? 'متصل • يتصفح الموسيقى' : 'Online • Exploring music')
                : friend.lastActiveAt
                ? (isRTL ? `غير متصل • ${formatTimeAgo(friend.lastActiveAt, true)}` : `Offline • Last seen ${formatTimeAgo(friend.lastActiveAt, false)}`)
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
          className="flex items-center gap-1.5 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] px-3 py-1.5 rounded-lg text-[10.5px] font-black uppercase brutal-border cursor-pointer transition shrink-0 brutal-shadow-xs ms-1"
          title={`Tune in to ${friend.name}`}
        >
          <Play size={11} fill="#0b1110" color="#0b1110" />
          <span>{isRTL ? 'استماع' : 'TUNE IN'}</span>
        </button>
      ) : (
        <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ms-1">
          {onStartJamWithUser && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartJamWithUser(friend);
              }}
              className="w-7.5 h-7.5 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border flex items-center justify-center transition cursor-pointer rounded-lg brutal-shadow-xs"
              title={isRTL ? `دعوة ${friend.name || 'الصديق'} للجام` : `Invite ${friend.name || 'friend'} to Jam`}
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
              title={isRTL ? `مراسلة ${friend.name || 'الصديق'}` : `Message ${friend.name || 'friend'}`}
            >
              <MessageSquare size={12} strokeWidth={2} />
            </button>
          )}

          {onOpenUserProfile && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenUserProfile(friend);
              }}
              className={`w-7.5 h-7.5 brutal-border flex items-center justify-center transition cursor-pointer rounded-lg brutal-shadow-xs ${
                isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-white hover:bg-zinc-100 text-[#0b1110]'
              }`}
              title={isRTL ? `عرض الملف الشخصي لـ ${friend.name || 'المستخدم'}` : `View ${friend.name || 'user'}'s profile`}
            >
              <User size={12} strokeWidth={2} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export const ActivityListItem = memo(ActivityListItemComponent);
export default ActivityListItem;
