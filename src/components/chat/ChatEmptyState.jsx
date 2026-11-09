import React from 'react';
import { MessageSquare } from 'lucide-react';

export default function ChatEmptyState({ isDark, isRTL, activeUserName }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <div
        className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 brutal-shadow-sm brutal-border ${
          isDark ? 'bg-zinc-800 text-white border-zinc-700' : 'bg-[#ede5d3] text-[#0b1110]'
        }`}
      >
        <MessageSquare size={28} />
      </div>
      <p className={`text-base font-black ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
        {isRTL ? 'لا توجد رسائل بعد' : 'No messages yet'}
      </p>
      <p className={`text-xs font-medium mt-1 max-w-xs leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
        {isRTL
          ? `قل مرحباً، شارك الموسيقى، أو ادعُ ${activeUserName} لجلسة استماع مشتركة!`
          : `Say hello, share music, or invite ${activeUserName} to a Jam session!`}
      </p>
    </div>
  );
}
