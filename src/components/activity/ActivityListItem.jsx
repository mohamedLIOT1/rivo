import React, { memo, useState } from 'react';
import { Play, Radio, MessageSquare, Disc, Clock, User } from 'lucide-react';
import VerifiedBadge from '../VerifiedBadge';
import { usePreferences } from '../../context/PreferencesContext';

function formatTimeAgo(dateStr, isRTL) {
  if (!dateStr) return '';
  const diffSec = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (isNaN(diffSec) || diffSec < 0) return '';
  if (diffSec < 60) return isRTL ? 'الآن' : 'just now';
  if (diffSec < 3600) {
    const mins = Math.max(1, Math.floor(diffSec / 60));
    return isRTL ? `منذ ${mins} د` : `${mins}m ago`;
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return isRTL
      ? (hours === 1 ? 'منذ ساعة' : hours === 2 ? 'منذ ساعتين' : `منذ ${hours} س`)
      : `${hours}h ago`;
  }
  const days = Math.floor(diffSec / 86400);
  if (isRTL) {
    if (days === 1) return 'أمس';
    if (days === 2) return 'منذ يومين';
    return `منذ ${days} ي`;
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
  const hasTrack = Boolean(listening && (listening.title || listening.name));
  const isLive = Boolean(friend.isLive && hasTrack);
  const isOnline = Boolean(friend.isOnline);
  const hasAvatar = Boolean(friend.avatar && !imgError);

  const trackTitle = listening?.title || listening?.name || '';
  const trackArtist = listening?.artist || '';

  return (
    <div
      className={`group relative px-3 py-2.5 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
        isDark
          ? 'bg-[#141d1b] border-[#263330] hover:border-[#384c47] hover:bg-[#182320]'
          : 'bg-[#ede5d3] border-[#0b1110] hover:bg-[#f6eedf]'
      }`}
    >
      {/* Left side: Avatar + Friend Info + Track */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Friend Avatar (w-10 h-10) with crisp status ring */}
        <div
          onClick={(e) => {
            e.stopPropagation();
            onOpenUserProfile?.(friend);
          }}
          className="relative shrink-0 cursor-pointer"
          title={friend.name || 'User'}
        >
          <div
            className={`w-10 h-10 rounded-full p-[2px] transition-transform group-hover:scale-105 ${
              isLive
                ? 'ring-2 ring-[#10b981] bg-[#10b981]/20 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                : isOnline
                ? 'ring-2 ring-emerald-400 bg-emerald-400/20'
                : isDark
                ? 'ring-1.5 ring-zinc-600 bg-zinc-800'
                : 'ring-1.5 ring-zinc-400 bg-zinc-200'
            }`}
          >
            {hasAvatar ? (
              <img
                src={friend.avatar}
                alt={friend.name || 'Friend'}
                onError={() => setImgError(true)}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-[#17a398] flex items-center justify-center font-black text-xs text-[#0b1110] select-none">
                {friend.name ? friend.name[0].toUpperCase() : 'U'}
              </div>
            )}
          </div>

          {/* Crisp Status Dot */}
          {isLive ? (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#10b981] border-2 border-[#141d1b] rounded-full animate-pulse shadow-[0_0_6px_#10b981]"
              title="Listening Live"
            />
          ) : isOnline ? (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#141d1b] rounded-full"
              title="Online"
            />
          ) : (
            <span
              className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-zinc-500 border-2 border-[#141d1b] rounded-full"
              title="Offline"
            />
          )}
        </div>

        {/* Friend Info & Song Details */}
        <div className="flex-1 min-w-0">
          {/* Top Row: Name + Verified Badge */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              onClick={(e) => {
                e.stopPropagation();
                onOpenUserProfile?.(friend);
              }}
              className={`text-xs font-bold truncate cursor-pointer hover:underline ${
                isDark ? 'text-white' : 'text-[#082621]'
              } ${isRTL ? 'font-sans' : ''}`}
              title={friend.name || 'Friend'}
            >
              {friend.name || 'Friend'}
            </span>
            {friend.isVerified && <VerifiedBadge userOrName={friend} size={12} />}
          </div>

          {/* Second Row: Track Status or Offline Details */}
          {isLive && hasTrack ? (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onPlayFriendTrack?.(friend);
              }}
              className="flex items-center gap-1.5 min-w-0 w-full cursor-pointer hover:opacity-90 transition mt-0.5"
              title={`${isRTL ? 'يستمع إلى' : 'Listening'}: ${trackTitle}${trackArtist ? ` • ${trackArtist}` : ''}`}
            >
              <Disc
                size={11}
                className="shrink-0 text-[#26c4b7] animate-spin"
                style={{ animationDuration: '3s' }}
                strokeWidth={2.4}
              />
              <p className="text-[11px] truncate leading-tight text-[#26c4b7] font-medium flex-1 min-w-0">
                <span className="font-bold text-white">{trackTitle}</span>
                {trackArtist && <span className="opacity-80"> • {trackArtist}</span>}
              </p>
            </div>
          ) : hasTrack ? (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onPlayFriendTrack?.(friend);
              }}
              className="flex items-center gap-1.5 min-w-0 w-full cursor-pointer hover:opacity-90 transition mt-0.5"
              title={`${isRTL ? 'آخر تشغيل' : 'Last played'}: ${trackTitle}${trackArtist ? ` • ${trackArtist}` : ''}`}
            >
              <Disc size={11} className="shrink-0 text-zinc-400 group-hover:text-[#26c4b7] transition-colors" strokeWidth={1.8} />
              <p className={`text-[11px] truncate leading-tight flex-1 min-w-0 ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
                <span className={`text-[10px] ${isRTL ? 'font-sans' : ''} ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  {isRTL ? 'آخر تشغيل: ' : 'Last played: '}
                </span>
                <span className={`font-semibold ${isDark ? 'text-zinc-200 group-hover:text-white' : 'text-zinc-900'} transition-colors`}>
                  {trackTitle}
                </span>
                {trackArtist && <span className={`${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}> • {trackArtist}</span>}
              </p>
            </div>
          ) : (
            <p
              dir="auto"
              className={`text-[11px] truncate leading-tight flex-1 min-w-0 mt-0.5 ${isRTL ? 'font-sans' : ''} ${
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

      {/* Right Side: Status Pill on rest, Quick Actions on Hover */}
      <div className="shrink-0 flex items-center justify-end relative">
        {/* REST STATE: Status / Time Pill */}
        <div className="flex items-center group-hover:hidden transition-all">
          {isLive ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-[#17a398] text-[#0b1110] shadow-xs uppercase">
              <Radio size={9} strokeWidth={3} className="shrink-0 animate-pulse" />
              <span className={isRTL ? 'font-sans' : ''}>{isRTL ? 'مباشر' : 'LIVE'}</span>
            </span>
          ) : isOnline ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className={isRTL ? 'font-sans' : ''}>{isRTL ? 'متصل' : 'ONLINE'}</span>
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full ${isRTL ? 'font-sans' : ''} ${
                isDark
                  ? 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/50'
                  : 'bg-[#ded4c1] text-zinc-700 border border-[#0b1110]/20'
              }`}
            >
              <Clock size={10} className="shrink-0 text-zinc-400" />
              <span>{formatBadgePill(friend.lastActiveAt, isRTL)}</span>
            </span>
          )}
        </div>

        {/* HOVER STATE: 1-Tap Tune In / Play + Jam + Chat Quick Actions */}
        <div className="hidden group-hover:flex items-center gap-1 transition-all">
          {/* 1-Tap Tune in / Play track button */}
          {hasTrack && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPlayFriendTrack?.(friend);
              }}
              className={`flex items-center justify-center rounded-lg brutal-border cursor-pointer transition shadow-xs ${
                isLive
                  ? 'bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] px-2 py-1 text-[10px] font-black gap-1 uppercase'
                  : isDark
                  ? 'w-7 h-7 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110]'
                  : 'w-7 h-7 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110]'
              }`}
              title={isLive ? (isRTL ? 'استماع مباشر' : 'Tune In') : (isRTL ? 'تشغيل المقطع' : 'Play Track')}
            >
              <Play size={10} fill="#0b1110" color="#0b1110" className={!isLive ? 'ms-0.5' : ''} />
              {isLive && <span className={isRTL ? 'font-sans' : ''}>{isRTL ? 'استماع' : 'TUNE IN'}</span>}
            </button>
          )}

          {/* Jam Invite button */}
          {onStartJamWithUser && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartJamWithUser(friend);
              }}
              className={`w-7 h-7 brutal-border flex items-center justify-center transition cursor-pointer rounded-lg shadow-xs ${
                isDark
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  : 'bg-white hover:bg-zinc-100 text-[#0b1110]'
              }`}
              title={isRTL ? `دعوة ${friend.name || ''} للجام` : `Invite ${friend.name || 'friend'} to Jam`}
            >
              <Radio size={12} strokeWidth={2.2} />
            </button>
          )}

          {/* Chat button */}
          {openChatModal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openChatModal(friend);
              }}
              className={`w-7 h-7 brutal-border flex items-center justify-center transition cursor-pointer rounded-lg shadow-xs ${
                isDark
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  : 'bg-white hover:bg-zinc-100 text-[#0b1110]'
              }`}
              title={isRTL ? `مراسلة ${friend.name || ''}` : `Message ${friend.name || 'friend'}`}
            >
              <MessageSquare size={12} strokeWidth={2} />
            </button>
          )}

          {/* View Profile fallback if no chat/jam */}
          {!openChatModal && !onStartJamWithUser && onOpenUserProfile && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenUserProfile(friend);
              }}
              className={`w-7 h-7 brutal-border flex items-center justify-center transition cursor-pointer rounded-lg shadow-xs ${
                isDark
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
                  : 'bg-white hover:bg-zinc-100 text-[#0b1110]'
              }`}
              title={isRTL ? 'الملف الشخصي' : 'Profile'}
            >
              <User size={12} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export const ActivityListItem = memo(ActivityListItemComponent);
export default ActivityListItem;
