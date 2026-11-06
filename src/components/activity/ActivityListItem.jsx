import React, { memo, useState } from 'react';
import { Play, Radio, MessageSquare, Disc, Clock, User, Volume2 } from 'lucide-react';
import VerifiedBadge from '../VerifiedBadge';
import { usePreferences } from '../../context/PreferencesContext';
import { normalizeCoverUrl, MUSIC_PLACEHOLDER_SVG, handleCoverImageError } from '../../utils/coverUtils';

function formatBadgePill(lastActiveAt, isRTL) {
  if (!lastActiveAt) return isRTL ? 'غير متصل' : 'Offline';
  const diffSec = Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 1000);
  if (isNaN(diffSec) || diffSec < 0) return isRTL ? 'غير متصل' : 'Offline';
  if (diffSec < 60) return isRTL ? 'نشط الآن' : 'Active now';
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
  if (days === 1) return isRTL ? 'منذ أمس' : 'Yesterday';
  if (days === 2) return isRTL ? 'منذ يومين' : '2d ago';
  return isRTL ? `منذ ${days} أيام` : `${days}d ago`;
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
  const trackCover = listening?.cover || listening?.coverUrl || '';

  return (
    <div
      className={`group relative p-3 rounded-2xl border transition-all duration-200 flex flex-col gap-2.5 ${
        isDark
          ? 'bg-[#141d1b] border-[#22332f] hover:border-[#384c47] hover:bg-[#182320]'
          : 'bg-[#ede5d3] border-[#0b1110] hover:bg-[#f6eedf]'
      }`}
    >
      {/* ── Top Row: User Avatar + Name + Status Pill + Direct Actions ── */}
      <div className="flex items-center justify-between gap-2">
        {/* Left: Avatar + Friend Name */}
        <div
          onClick={() => onOpenUserProfile?.(friend)}
          className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
          title={friend.name || 'Friend'}
        >
          {/* Avatar with Status Ring */}
          <div className="relative shrink-0">
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
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-[#17a398] flex items-center justify-center font-black text-xs text-[#0b1110] select-none">
                  {friend.name ? friend.name[0].toUpperCase() : 'U'}
                </div>
              )}
            </div>

            {/* Status Dot */}
            {isLive ? (
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#10b981] border-2 border-[#141d1b] rounded-full animate-pulse shadow-[0_0_6px_#10b981]" />
            ) : isOnline ? (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#141d1b] rounded-full" />
            ) : (
              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-zinc-500 border-2 border-[#141d1b] rounded-full" />
            )}
          </div>

          {/* Name + Verified */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-xs font-bold truncate hover:underline ${
                  isDark ? 'text-white' : 'text-[#082621]'
                } ${isRTL ? 'font-sans tracking-normal' : ''}`}
              >
                {friend.name || 'Friend'}
              </span>
              {friend.isVerified && <VerifiedBadge userOrName={friend} size={13} />}
            </div>

            {/* Status Text under Name */}
            <span
              className={`text-[10px] block truncate mt-0.5 ${
                isLive
                  ? 'text-[#10b981] font-bold'
                  : isOnline
                  ? 'text-emerald-400 font-semibold'
                  : 'text-zinc-400'
              } ${isRTL ? 'font-sans tracking-normal' : ''}`}
            >
              {isLive
                ? (isRTL ? 'يستمع الآن على ريفو' : 'Listening live on Rivo')
                : isOnline
                ? (isRTL ? 'متصل الآن' : 'Online now')
                : formatBadgePill(friend.lastActiveAt, isRTL)}
            </span>
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Jam Invite */}
          {onStartJamWithUser && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartJamWithUser(friend);
              }}
              className={`w-7 h-7 rounded-lg border flex items-center justify-center transition cursor-pointer ${
                isDark
                  ? 'bg-zinc-800/80 border-zinc-700/60 hover:bg-zinc-700 text-zinc-300'
                  : 'bg-white border-zinc-300 hover:bg-zinc-100 text-[#0b1110]'
              }`}
              title={isRTL ? `دعوة ${friend.name || ''} للجام` : `Invite ${friend.name || 'friend'} to Jam`}
            >
              <Radio size={12} strokeWidth={2.2} />
            </button>
          )}

          {/* Chat Message */}
          {openChatModal && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openChatModal(friend);
              }}
              className={`w-7 h-7 rounded-lg border flex items-center justify-center transition cursor-pointer ${
                isDark
                  ? 'bg-zinc-800/80 border-zinc-700/60 hover:bg-zinc-700 text-zinc-300'
                  : 'bg-white border-zinc-300 hover:bg-zinc-100 text-[#0b1110]'
              }`}
              title={isRTL ? `مراسلة ${friend.name || ''}` : `Message ${friend.name || 'friend'}`}
            >
              <MessageSquare size={12} strokeWidth={2} />
            </button>
          )}

          {/* Profile */}
          {onOpenUserProfile && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenUserProfile(friend);
              }}
              className={`w-7 h-7 rounded-lg border flex items-center justify-center transition cursor-pointer ${
                isDark
                  ? 'bg-zinc-800/80 border-zinc-700/60 hover:bg-zinc-700 text-zinc-300'
                  : 'bg-white border-zinc-300 hover:bg-zinc-100 text-[#0b1110]'
              }`}
              title={isRTL ? 'الملف الشخصي' : 'Profile'}
            >
              <User size={12} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>

      {/* ── Bottom Section: Dedicated Track Card (or Idle state) ── */}
      {hasTrack ? (
        <div
          onClick={(e) => {
            e.stopPropagation();
            onPlayFriendTrack?.(friend);
          }}
          className={`px-2.5 py-2 rounded-xl border flex items-center justify-between gap-2.5 cursor-pointer transition-all ${
            isLive
              ? isDark
                ? 'bg-[#0d1f1c] border-[#17a398]/40 hover:border-[#17a398]'
                : 'bg-[#e2f4ef] border-[#17a398] hover:bg-[#d5eee8]'
              : isDark
              ? 'bg-[#0b1110]/80 border-zinc-800 hover:border-zinc-700'
              : 'bg-white/80 border-[#0b1110]/15 hover:bg-white'
          }`}
          title={isRTL ? `تشغيل: ${trackTitle}` : `Play: ${trackTitle}`}
        >
          {/* Track Cover Thumbnail (36x36) */}
          <div className="relative w-9 h-9 rounded-lg overflow-hidden shrink-0 border border-black/30 bg-[#0b1110]">
            <img
              src={normalizeCoverUrl(trackCover, listening)}
              alt=""
              referrerPolicy="no-referrer"
              onError={handleCoverImageError}
              className="w-full h-full object-cover"
            />
            {isLive && (
              <div className="absolute inset-0 bg-[#10b981]/20 flex items-center justify-center">
                <Volume2 size={13} className="text-[#10b981] animate-pulse" />
              </div>
            )}
          </div>

          {/* Track Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`text-[9.5px] font-bold uppercase shrink-0 ${
                  isLive ? 'text-[#10b981]' : isDark ? 'text-zinc-400' : 'text-zinc-600'
                } ${isRTL ? 'font-sans tracking-normal' : 'font-mono'}`}
              >
                {isLive
                  ? (isRTL ? '▶ يستمع الآن' : '▶ LIVE')
                  : (isRTL ? '📻 آخر استماع' : '📻 LAST PLAYED')}
              </span>
            </div>
            <p
              className={`text-xs font-bold truncate mt-0.5 ${
                isDark ? 'text-zinc-100 group-hover:text-white' : 'text-[#0b1110]'
              } ${isRTL ? 'font-sans tracking-normal' : ''}`}
            >
              {trackTitle}
            </p>
            {trackArtist && (
              <p
                className={`text-[10px] truncate ${
                  isDark ? 'text-zinc-400' : 'text-zinc-600'
                } ${isRTL ? 'font-sans tracking-normal' : ''}`}
              >
                {trackArtist}
              </p>
            )}
          </div>

          {/* Quick Play Action Button */}
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-transform hover:scale-105 shadow-xs ${
              isLive
                ? 'bg-[#10b981] text-[#0b1110]'
                : 'bg-[#17a398] text-[#0b1110]'
            }`}
          >
            <Play size={11} fill="#0b1110" color="#0b1110" className="ms-0.5" />
          </div>
        </div>
      ) : (
        <div
          className={`px-2.5 py-1.5 rounded-xl border flex items-center gap-2 ${
            isDark ? 'bg-[#0b1110]/40 border-zinc-800/60' : 'bg-white/40 border-[#0b1110]/10'
          }`}
        >
          <Disc size={12} className="text-zinc-500 shrink-0" />
          <span
            className={`text-[10.5px] text-zinc-400 truncate ${
              isRTL ? 'font-sans tracking-normal' : ''
            }`}
          >
            {isOnline
              ? (isRTL ? 'يتصفح الموسيقى وقوائم التشغيل' : 'Browsing music & playlists')
              : (isRTL ? 'لم يستمع لأي مقطع مؤخراً' : 'No recent listening activity')}
          </span>
        </div>
      )}
    </div>
  );
}

export const ActivityListItem = memo(ActivityListItemComponent);
export default ActivityListItem;
