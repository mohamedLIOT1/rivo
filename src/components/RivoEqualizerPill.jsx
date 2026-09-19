import React from 'react';

export default function RivoEqualizerPill({ isPlaying = true, className = '', size = 'md' }) {
  const isSmall = size === 'sm';
  const width = isSmall ? 'w-14 h-7' : 'w-20 h-9';
  const barWidth = isSmall ? 'w-1.5' : 'w-2';

  return (
    <div 
      className={`inline-flex items-end justify-center gap-1 bg-[#6c7271] border-2 border-[#0b1110] rounded-xl px-2 py-1 shadow-[2px_2px_0px_#0b1110] shrink-0 select-none overflow-hidden ${width} ${className}`}
      title={isPlaying ? "Playing audio" : "Paused"}
    >
      {/* Bar 1: Turquoise */}
      <div 
        className={`${barWidth} rounded-t-sm bg-[#7ee7db] border-t border-x border-[#0b1110]/40 transition-all ${isPlaying ? 'animate-eq-1' : 'h-2'}`}
        style={{ height: isPlaying ? undefined : '7px' }}
      />

      {/* Bar 2: Turquoise */}
      <div 
        className={`${barWidth} rounded-t-sm bg-[#7ee7db] border-t border-x border-[#0b1110]/40 transition-all ${isPlaying ? 'animate-eq-2' : 'h-4'}`}
        style={{ height: isPlaying ? undefined : '14px' }}
      />

      {/* Bar 3: Yellow/Amber */}
      <div 
        className={`${barWidth} rounded-t-sm bg-[#fbd175] border-t border-x border-[#0b1110]/40 transition-all ${isPlaying ? 'animate-eq-3' : 'h-1.5'}`}
        style={{ height: isPlaying ? undefined : '5px' }}
      />

      {/* Bar 4: Coral/Pink (tallest) */}
      <div 
        className={`${barWidth} rounded-t-sm bg-[#f28b82] border-t border-x border-[#0b1110]/40 transition-all ${isPlaying ? 'animate-eq-4' : 'h-5'}`}
        style={{ height: isPlaying ? undefined : '18px' }}
      />

      {/* Bar 5: Turquoise */}
      <div 
        className={`${barWidth} rounded-t-sm bg-[#7ee7db] border-t border-x border-[#0b1110]/40 transition-all ${isPlaying ? 'animate-eq-5' : 'h-2'}`}
        style={{ height: isPlaying ? undefined : '8px' }}
      />
    </div>
  );
}
