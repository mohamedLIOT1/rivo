import React, { useState, useEffect, useMemo } from 'react';

/**
 * Extracts a concise display name and initials for Islamic calligraphy fallback avatars.
 * @param {string} name 
 * @returns {{ initials: string, shortName: string }}
 */
export function getReciterBadge(name) {
  if (!name || typeof name !== 'string') {
    return { initials: 'قرآن', shortName: 'القارئ' };
  }
  const clean = name.replace(/^(الشيخ|القارئ|الدكتور|فضيلة الشيخ)\s+/i, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { initials: 'قرآن', shortName: 'القارئ' };
  }

  // Compound names like عبد الباسط, أبو بكر
  if ((parts[0] === 'عبد' || parts[0] === 'أبو' || parts[0] === 'ابو') && parts.length >= 2) {
    return {
      initials: `${parts[0][0]}•${parts[1][0]}`,
      shortName: `${parts[0]} ${parts[1]}`,
    };
  }

  const first = parts[0];
  const last = parts[parts.length - 1];
  return {
    initials: parts.length > 1 ? `${first[0]}•${last[0]}` : first.slice(0, 2),
    shortName: first,
  };
}

/**
 * High-performance, pure Quran Reciter Avatar with authentic portrait display
 * and a stylish Islamic geometric gradient + calligraphy fallback.
 */
export const QuranReciterAvatar = React.memo(function QuranReciterAvatar({
  src,
  name,
  className = '',
  shape = 'circle',
  showRing = true,
  alt,
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const badge = useMemo(() => getReciterBadge(name), [name]);
  const isCircle = shape === 'circle';
  const shapeClass = isCircle ? 'rounded-full' : 'rounded-lg';
  const ringClass = showRing ? 'ring-2 ring-[#26c4b7]/30 group-hover:ring-[#26c4b7]/60' : '';

  // Use image if valid and hasn't errored
  const hasValidSrc = Boolean(src && typeof src === 'string' && src.trim().length > 5 && !src.includes('photo-1609599006353'));

  if (hasValidSrc && !hasError) {
    return (
      <div className={`overflow-hidden bg-[#041d1a] shrink-0 brutal-border ${shapeClass} ${ringClass} ${className}`}>
        <img
          src={src}
          alt={alt || name || 'قارئ'}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setHasError(true)}
        />
      </div>
    );
  }

  // Elegant Islamic Geometric Gradient + Calligraphy Fallback
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden select-none bg-gradient-to-br from-[#062c26] via-[#0a3e35] to-[#041d1a] border border-[#d4af37]/50 shadow-inner shrink-0 ${shapeClass} ${ringClass} ${className}`}
      title={name || 'القارئ'}
    >
      {/* Islamic 8-pointed star watermark */}
      <svg
        className="absolute inset-0 w-full h-full opacity-20 text-[#d4af37] pointer-events-none p-1"
        viewBox="0 0 100 100"
        fill="currentColor"
        aria-hidden="true"
      >
        <polygon points="50,0 62,25 88,12 75,38 100,50 75,62 88,88 62,75 50,100 38,75 12,88 25,62 0,50 25,38 12,12 38,25" />
        <circle cx="50" cy="50" r="28" fill="none" stroke="currentColor" strokeWidth="2.5" />
        <circle cx="50" cy="50" r="18" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>

      <div className="relative z-10 flex flex-col items-center justify-center text-center px-1">
        <span className="text-[#d4af37] text-[10px] sm:text-xs leading-none mb-0.5 opacity-90 select-none">۞</span>
        <span className="font-display font-black text-[#f2e2a8] leading-tight drop-shadow-sm text-[11px] sm:text-xs truncate max-w-full">
          {badge.shortName}
        </span>
      </div>
    </div>
  );
});

export default QuranReciterAvatar;
