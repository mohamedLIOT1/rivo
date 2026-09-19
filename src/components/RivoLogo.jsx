import React from 'react';

export default function RivoLogo({ size = 36, className = '', showText = false, textClassName = '', isDark }) {
  const innerSize = typeof size === 'number' ? size : parseInt(size, 10) || 36;
  const offset = Math.max(2, Math.round(innerSize * 0.08));
  const fontSize = Math.round(innerSize * 0.58);

  const darkMode = isDark !== undefined 
    ? isDark 
    : (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  return (
    <div className={`inline-flex items-center gap-2 sm:gap-2.5 ${className}`}>
      {/* ── Circular 'R' Badge with teal offset backing ── */}
      <div 
        className="relative shrink-0 select-none cursor-pointer group"
        style={{ width: `${innerSize}px`, height: `${innerSize}px` }}
      >
        {/* Teal Offset Disc */}
        <div 
          className="absolute inset-0 rounded-full bg-[#17a398] transition-transform duration-150 group-hover:translate-x-[3px] group-hover:translate-y-[3px]"
          style={{
            transform: `translate(${offset}px, ${offset}px)`,
            border: '2px solid #0b1110',
          }}
        />

        {/* Front Cream Disc */}
        <div 
          className="absolute inset-0 rounded-full bg-[#fdfbf7] flex items-center justify-center transition-transform duration-150 group-hover:-translate-x-[1px] group-hover:-translate-y-[1px]"
          style={{
            border: '2.5px solid #0b1110',
          }}
        >
          {/* Letter R with subtle chromatic aberration offset */}
          <span 
            className="font-black leading-none text-[#0b1110] select-none"
            style={{ 
              fontFamily: '"Space Grotesk", "Plus Jakarta Sans", sans-serif',
              fontSize: `${fontSize}px`,
              textShadow: '1px 0px 0px rgba(23,163,152,0.8), -0.8px 0px 0px rgba(220,38,38,0.5)',
              transform: 'translateY(-0.5px)'
            }}
          >
            R
          </span>
        </div>
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
