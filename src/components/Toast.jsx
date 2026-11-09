import React from 'react';
import { Radio, MessageSquare, X } from 'lucide-react';
import { useUI } from '../context/UIContext';

export default function Toast({ currentTrack, onJoinJam, onOpenChat }) {
  const { toastMessage, clearToast } = useUI();

  if (!toastMessage) return null;

  const isJamToast = typeof toastMessage === 'object' && toastMessage?.type === 'jam';
  const isChatToast = typeof toastMessage === 'object' && (toastMessage?.type === 'chat' || Boolean(toastMessage?.sender));
  const isTopToast = isChatToast || isJamToast || toastMessage?.position === 'top';
  const isInteractive = Boolean(isJamToast || isChatToast);

  const handleClick = (e) => {
    e.stopPropagation();
    if (isJamToast && toastMessage?.roomCode) {
      onJoinJam?.(toastMessage.roomCode);
      clearToast();
    } else if (isChatToast && toastMessage?.sender) {
      onOpenChat?.(toastMessage.sender);
      clearToast();
    }
  };

  const handleDismiss = (e) => {
    e.stopPropagation();
    clearToast();
  };

  return (
    <div
      onClick={isInteractive ? handleClick : undefined}
      className={`fixed left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-2xl text-xs font-display font-black brutal-border-thick brutal-shadow-lg flex items-center gap-2.5 transition-all max-w-[94vw] sm:max-w-md ${
        isTopToast ? 'animate-in slide-in-from-top-4 duration-200' : 'animate-in slide-in-from-bottom-4 duration-200'
      } ${
        isInteractive
          ? 'cursor-pointer pointer-events-auto hover:scale-[1.02] active:scale-[0.98]'
          : 'pointer-events-none'
      } ${
        isJamToast
          ? 'bg-[#082621] text-[#fdfbf7] border-[#f59e0b]'
          : 'bg-[#fdfbf7] text-[#0b1110] dark:bg-[#18181b] dark:text-white dark:border-zinc-700'
      }`}
      style={
        isTopToast
          ? { top: '20px' }
          : { bottom: currentTrack ? 'calc(var(--player-height) + 16px)' : '24px' }
      }
    >
      {isJamToast ? (
        <>
          {toastMessage.sender?.avatar ? (
            <div className="relative shrink-0">
              <img src={toastMessage.sender.avatar} alt="" className="w-8 h-8 rounded-lg object-cover brutal-border" />
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#f59e0b] border border-black animate-ping" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-lg bg-[#f59e0b] text-black brutal-border flex items-center justify-center shrink-0">
              <Radio size={16} className="animate-pulse" />
            </div>
          )}
          <div className="flex flex-col text-left min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="font-display font-black text-[#f59e0b] text-[11px] uppercase tracking-wider truncate">
                {toastMessage.title}
              </span>
              <span className="text-[8px] font-mono font-black px-1 py-0.2 rounded bg-[#f59e0b] text-black shrink-0">
                LIVE
              </span>
            </div>
            <span className="text-zinc-300 font-mono font-medium text-[11px] max-w-[220px] truncate">
              {toastMessage.body}
            </span>
          </div>
          <span className="text-[10px] text-[#0b1110] font-mono font-black ms-1.5 bg-[#f59e0b] hover:bg-amber-300 brutal-border px-2.5 py-1 rounded shadow-sm flex items-center gap-1 shrink-0">
            <Radio size={11} className="animate-pulse" />
            Join
          </span>
        </>
      ) : isChatToast ? (
        <>
          {toastMessage.sender?.avatar ? (
            <img src={toastMessage.sender.avatar} alt="" className="w-7 h-7 rounded-lg object-cover brutal-border shrink-0" />
          ) : (
            <div className="w-7 h-7 rounded-lg bg-[#17a398] text-black brutal-border flex items-center justify-center font-bold text-xs shrink-0">
              <MessageSquare size={14} />
            </div>
          )}
          <div className="flex flex-col text-left min-w-0 flex-1">
            <span className="font-display font-black text-[#0f756d] dark:text-[#2dd4bf] text-[11px] truncate">
              {toastMessage.title}
            </span>
            <span className="text-zinc-700 dark:text-zinc-300 font-mono font-medium text-[11px] max-w-[220px] truncate">
              {toastMessage.body}
            </span>
          </div>
          <span className="text-[10px] text-[#0b1110] dark:text-white font-mono font-bold ms-1 bg-[#ede5d3] dark:bg-zinc-800 brutal-border px-2 py-0.5 rounded shrink-0">
            Open
          </span>
        </>
      ) : (
        <>
          <span className="w-2.5 h-2.5 rounded-full bg-[#17a398] shrink-0" />
          <span className="font-mono text-xs">
            {typeof toastMessage === 'string' ? toastMessage : toastMessage?.text || ''}
          </span>
        </>
      )}

      {isInteractive && (
        <button
          onClick={handleDismiss}
          className="w-5 h-5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 flex items-center justify-center text-zinc-500 hover:text-zinc-800 dark:hover:text-white ms-1 cursor-pointer transition shrink-0"
          title="Dismiss"
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
