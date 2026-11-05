import React from 'react';
import { Users, LogIn, Radio, Music, Sparkles } from 'lucide-react';

export default function GuestActivityCard({ onOpenAuth, isDark = true }) {
  return (
    <div className="p-4 sm:p-5 flex flex-col items-center text-center justify-center h-full min-h-[360px]">
      {/* Visual icon badge */}
      <div className="relative mb-4">
        <div className="w-16 h-16 rounded-2xl bg-[#17a398] text-[#0b1110] brutal-border brutal-shadow flex items-center justify-center font-display">
          <Users size={32} strokeWidth={2.5} />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#f59e0b] text-[#0b1110] brutal-border flex items-center justify-center">
          <Radio size={12} strokeWidth={3} className="animate-pulse" />
        </div>
      </div>

      {/* Heading */}
      <h3 className={`text-base font-mono font-black uppercase tracking-wider mb-2 ${
        isDark ? 'text-white' : 'text-[#082621]'
      }`}>
        Friend &amp; Community Activity
      </h3>

      {/* Subtitle */}
      <p className={`text-xs font-sans leading-relaxed max-w-[260px] mb-5 ${
        isDark ? 'text-zinc-400' : 'text-[#082621]/80'
      }`}>
        Sign in to connect with friends, share your live music sessions, and see what others are playing in real-time.
      </p>

      {/* Value prop pills */}
      <div className="flex flex-wrap justify-center gap-1.5 mb-6 max-w-[280px]">
        <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded-md border flex items-center gap-1 ${
          isDark ? 'bg-zinc-800/80 border-zinc-700 text-zinc-300' : 'bg-white border-black/30 text-[#082621]'
        }`}>
          <Sparkles size={10} className="text-[#17a398]" /> Live Sync
        </span>
        <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded-md border flex items-center gap-1 ${
          isDark ? 'bg-zinc-800/80 border-zinc-700 text-zinc-300' : 'bg-white border-black/30 text-[#082621]'
        }`}>
          <Radio size={10} className="text-[#f59e0b]" /> Jam Sessions
        </span>
        <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded-md border flex items-center gap-1 ${
          isDark ? 'bg-zinc-800/80 border-zinc-700 text-zinc-300' : 'bg-white border-black/30 text-[#082621]'
        }`}>
          <Music size={10} className="text-emerald-400" /> Share Vibes
        </span>
      </div>

      {/* CTA Button */}
      <button
        onClick={onOpenAuth}
        className="w-full max-w-[240px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#17a398] hover:bg-[#26c4b7] active:translate-y-0.5 text-[#0b1110] font-mono font-black text-xs uppercase tracking-wide brutal-border brutal-shadow-xs transition-all cursor-pointer"
      >
        <LogIn size={15} strokeWidth={2.5} />
        <span>Sign In / Create Account</span>
      </button>

      <span className="text-[10px] font-mono text-zinc-500 mt-3">
        Free forever • Instant access
      </span>
    </div>
  );
}
