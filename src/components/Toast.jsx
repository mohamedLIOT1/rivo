import React from 'react';
import { Radio } from 'lucide-react';
import { useUI } from '../context/UIContext';

export default function Toast({ currentTrack, onJoinJam, onOpenChat }) {
  const { toastMessage, clearToast } = useUI();

  if (!toastMessage) return null;

  const isInteractive = typeof toastMessage === 'object' && (toastMessage?.sender || toastMessage?.roomCode);
  const isJamToast = typeof toastMessage === 'object' && toastMessage?.type === 'jam';
  const isChatToast = typeof toastMessage === 'object' && toastMessage?.sender;

  const handleClick = () => {
    if (isJamToast && toastMessage?.roomCode) {
      onJoinJam?.(toastMessage.roomCode);
      clearToast();
    } else if (isChatToast && toastMessage?.sender) {
      onOpenChat?.(toastMessage.sender);
      clearToast();
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`fixed left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl text-xs font-display font-black brutal-border-thick brutal-shadow-lg flex items-center gap-2.5 transition-all ${
        isInteractive
          ? 'cursor-pointer pointer-events-auto hover:scale-105 active:scale-95'
          : 'pointer-events-none'
      } ${
        isJamToast
          ? 'bg-[#082621] text-[#fdfbf7] border-[#f59e0b]'
          : 'bg-[#fdfbf7] text-[#0b1110]'
      }`}
      style={{
        bottom: currentTrack ? 'calc(var(--player-height) + 16px)' : '24px',
      }}
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
          <div className="flex flex-col text-left">
            <div className="flex items-center gap-1.5">
              <span className="font-display font-black text-[#f59e0b] text-[11px] uppercase tracking-wider">
                {toastMessage.title}
              </span>
              <span className="text-[8px] font-mono font-black px-1 py-0.2 rounded bg-[#f59e0b] text-black">
                LIVE
              </span>
            </div>
            <span className="text-zinc-300 font-mono font-medium text-[11px] max-w-[220px] truncate">
              {toastMessage.body}
            </span>
          </div>
          <span className="text-[10px] text-[#0b1110] font-mono font-black ml-1.5 bg-[#f59e0b] hover:bg-amber-300 brutal-border px-2.5 py-1 rounded shadow-sm flex items-center gap-1 shrink-0">
            <Radio size={11} className="animate-pulse" />
            Join Jam
          </span>
        </>
      ) : isChatToast ? (
        <>
          {toastMessage.sender.avatar ? (
            <img src={toastMessage.sender.avatar} alt="" className="w-6 h-6 rounded-lg object-cover brutal-border shrink-0" />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-[#17a398] shrink-0 animate-pulse" />
          )}
          <div className="flex flex-col text-left">
            <span className="font-display font-black text-[#0f756d] text-[11px]">{toastMessage.title}</span>
            <span className="text-zinc-700 font-mono font-medium text-[11px] max-w-[220px] truncate">
              {toastMessage.body}
            </span>
          </div>
          <span className="text-[10px] text-[#0b1110] font-mono font-bold ml-1 bg-[#ede5d3] brutal-border px-2 py-0.5 rounded">
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
    </div>
  );
}
