import React, { useState, useMemo, useEffect } from 'react';

/**
 * Convert an emoji string to its Twemoji hex codepoint sequence.
 */
export function emojiToHex(emoji) {
  if (!emoji) return '';
  const comp = [];
  for (let i = 0; i < emoji.length; i++) {
    const code = emoji.codePointAt(i);
    comp.push(code.toString(16));
    if (code > 0xffff) i++;
  }
  return comp.filter(c => c !== 'fe0f').join('-');
}

/**
 * Premium Crisp Vector SVG Emoji Component (Twemoji Discord / Twitter aesthetic).
 * Automatically falls back to native unicode character on image load error or offline.
 */
function PremiumEmoji({ emoji, className = 'w-4 h-4', style = {}, alt = '' }) {
  const [hasError, setHasError] = useState(false);
  const hex = useMemo(() => emojiToHex(emoji), [emoji]);

  useEffect(() => {
    setHasError(false);
  }, [emoji]);

  if (!emoji) return null;

  if (hasError || !hex) {
    return <span className="inline-block leading-none select-none text-base" style={style}>{emoji}</span>;
  }

  return (
    <img
      src={`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${hex}.svg`}
      alt={alt || emoji}
      className={`${className} inline-block object-contain select-none align-middle pointer-events-none`}
      style={{ ...style }}
      loading="lazy"
      draggable={false}
      onError={() => setHasError(true)}
    />
  );
}

export default React.memo(PremiumEmoji);
