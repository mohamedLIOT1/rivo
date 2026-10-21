import React from 'react';

export default function RivoLogo({ size = 36, className = '', showText = false, textClassName = '', isDark }) {
  const innerSize = typeof size === 'number' ? size : parseInt(size, 10) || 36;
  const darkMode = isDark !== undefined 
    ? isDark 
    : (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  return (
    <div className={`inline-flex items-center gap-2 sm:gap-2.5 ${className}`}>
      {/* ── Official 3D Glossy Rivo Logo ── */}
      <div 
        className="relative shrink-0 select-none cursor-pointer group flex items-center justify-center"
        style={{ width: `${innerSize}px`, height: `${innerSize}px` }}
      >
        <img 
          src="/logo.png" 
          alt="Rivo" 
          className="w-full h-full object-contain drop-shadow-[0_2px_8px_rgba(23,163,152,0.4)] transition-transform duration-200 group-hover:scale-105 select-none" 
        />
      </div>

      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className={`font-black tracking-tight leading-none ${
              textClassName ? textClassName : (darkMode ? 'text-white text-xl font-display' : 'text-[#0b1110] text-xl font-display')
            }`}>
              RIVO
            </span>
            <span className="hidden sm:inline font-mono font-black text-[9px] text-[#0b1110] bg-[#17a398] px-1.5 py-0.5 rounded uppercase brutal-border shrink-0">
              RIVO-RX
            </span>
          </div>
          <span className={`text-[10px] font-mono font-bold flex items-center gap-1 mt-0.5 hidden sm:flex ${
            darkMode ? 'text-zinc-400' : 'text-zinc-500'
          }`}>
            <span>Sound Relief</span>
            <span className="w-1.5 h-1.5 bg-[#17a398] rounded-full inline-block"></span>
            <span className={darkMode ? 'text-[#26c4b7]' : 'text-[#0f756d]'}>EST. 1954</span>
          </span>
        </div>
      )}
    </div>
  );
}
