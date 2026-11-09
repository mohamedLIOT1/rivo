import React from 'react';
import { Music, Radio, Check, CheckCheck } from 'lucide-react';
import MessageReactions from './MessageReactions';

export default function ChatMessageItem({
  msg,
  currentUser,
  activeUser,
  isMe,
  isDark,
  isRTL,
  onPlayTrack,
  onJoinJam,
  onClose,
  onToggleReaction
}) {
  const timeFormatted = msg.createdAt
    ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'NOW';

  return (
    <div
      className={`flex flex-col ${
        isMe
          ? (isRTL ? 'items-start max-w-[85%] me-auto' : 'items-end max-w-[85%] ms-auto')
          : (isRTL ? 'items-end max-w-[85%]' : 'items-start max-w-[85%]')
      }`}
    >
      <div
        className={`p-3 rounded-xl brutal-border brutal-shadow-sm space-y-1 ${
          isMe
            ? (isRTL ? 'bg-[#17a398] text-[#082621] font-bold rounded-tl-none' : 'bg-[#17a398] text-[#082621] font-bold rounded-tr-none')
            : isDark
              ? (isRTL ? 'bg-zinc-800 text-white font-bold border-zinc-700 rounded-tr-none' : 'bg-zinc-800 text-white font-bold border-zinc-700 rounded-tl-none')
              : (isRTL ? 'bg-white text-[#0b1110] font-bold rounded-tr-none' : 'bg-white text-[#0b1110] font-bold rounded-tl-none')
        }`}
      >
        {/* Message Meta Header */}
        <div
          className={`flex items-center justify-between border-b pb-1 mb-1 text-[10px] gap-4 tracking-normal ${
            isMe
              ? 'border-black/20 text-[#082621]/80 font-bold'
              : isDark
                ? 'border-zinc-700 text-zinc-400'
                : 'border-dashed border-zinc-300 text-zinc-500'
          }`}
        >
          <span className="flex items-center gap-1 font-sans">
            {isMe ? (currentUser?.name || (isRTL ? 'أنت' : 'You')) : (activeUser?.name || (isRTL ? 'صديق' : 'Friend'))}
            {!isMe && (activeUser?.isBot || activeUser?.name === 'Rivo Bot' || msg.isBot) && (
              <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-[#17a398] text-[#082621]">
                [BOT]
              </span>
            )}
          </span>
          <span className="font-mono">{timeFormatted}</span>
        </div>

        {/* Message Text */}
        {msg.text && (
          <p
            dir="auto"
            style={{ letterSpacing: 'normal' }}
            className="break-words font-sans font-semibold text-[13.5px] md:text-[14px] leading-relaxed tracking-normal"
          >
            {msg.text}
          </p>
        )}

        {/* Track attached */}
        {msg.track && (
          <div
            onClick={() => onPlayTrack && onPlayTrack(msg.track)}
            className={`mt-2 p-2 rounded-lg brutal-border flex items-center justify-between gap-2.5 cursor-pointer transition ${
              isDark
                ? 'bg-zinc-900 border-zinc-700 hover:bg-zinc-850'
                : 'bg-white hover:bg-[#ede5d3]'
            }`}
          >
            <img
              src={msg.track.cover}
              alt=""
              className="w-10 h-10 rounded brutal-border object-cover shrink-0"
            />
            <div className="truncate flex-1 min-w-0">
              <span className="text-[8px] font-mono font-bold bg-[#f59e0b] px-1 rounded text-black">
                SHARED TRACK
              </span>
              <p className={`text-xs font-display font-black truncate mt-0.5 ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
                {msg.track.title}
              </p>
              <p className={`text-[10px] font-bold truncate ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {msg.track.artist}
              </p>
            </div>
            <div className="w-7 h-7 rounded bg-[#17a398] brutal-border flex items-center justify-center shrink-0">
              <Music size={13} className="text-[#0b1110]" />
            </div>
          </div>
        )}

        {/* Jam Session Invite Card */}
        {msg.jamInvite && (
          <div
            className={`mt-2 p-2.5 rounded-xl brutal-border flex flex-col gap-2 ${
              isDark ? 'bg-zinc-900/95 border-zinc-700 text-white' : 'bg-[#ded2bb] border-black text-[#0b1110]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Radio size={14} className="text-[#f59e0b] animate-pulse shrink-0" strokeWidth={2.5} />
                <span className="text-[10px] font-mono font-black uppercase text-[#f59e0b] tracking-wider">
                  LIVE JAM SESSION
                </span>
              </div>
              <span className="text-[9px] font-mono font-black bg-[#0b1110] text-[#f59e0b] px-1.5 py-0.5 rounded brutal-border">
                {msg.jamInvite.roomCode}
              </span>
            </div>
            <p className="text-xs font-bold leading-tight">
              {msg.jamInvite.hostName ? `${msg.jamInvite.hostName} invites you to listen together!` : 'Invited to a live music jam!'}
            </p>
            <button
              type="button"
              onClick={() => {
                if (onJoinJam && msg.jamInvite.roomCode) {
                  onJoinJam(msg.jamInvite.roomCode);
                  onClose?.();
                }
              }}
              className="w-full py-1.5 px-3 rounded-lg bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] font-display font-black text-xs brutal-border brutal-shadow-sm brutal-btn flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <Radio size={13} className="text-[#0b1110]" strokeWidth={2.5} />
              <span>Join Jam Session</span>
            </button>
          </div>
        )}
      </div>

      <MessageReactions
        message={msg}
        currentUserId={currentUser?.id || currentUser?._id}
        onToggleReaction={onToggleReaction}
        isDark={isDark}
        isMe={isMe}
      />

      <div className={`flex items-center gap-1.5 mt-1 px-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
        <span className="text-[9px] font-mono text-zinc-500 font-medium">{timeFormatted}</span>
        {isMe && (
          msg.read ? (
            <span className="flex items-center gap-0.5 text-[#17a398] text-[9.5px] font-mono font-bold" title="Seen">
              <CheckCheck size={12} strokeWidth={2.5} className="text-[#17a398]" />
              <span className="text-[8.5px]">Seen</span>
            </span>
          ) : (
            <span className="flex items-center gap-0.5 text-zinc-400 text-[9.5px] font-mono" title="Sent">
              <Check size={11} strokeWidth={2} />
            </span>
          )
        )}
      </div>
    </div>
  );
}
