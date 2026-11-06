import { Platform } from 'react-native';

/**
 * Checks if a string contains Arabic characters.
 */
export function isArabicText(text) {
  if (typeof text !== 'string') return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}

/**
 * Returns the recommended font family for clean, pleasant Arabic text rendering.
 */
export function getArabicFontFamily() {
  if (Platform.OS === 'ios') {
    return 'Geeza Pro';
  }
  return 'sans-serif';
}

/**
 * Sanitizes and elevates typography styles for Arabic / RTL context:
 * - Eliminates positive letter spacing (which breaks Arabic cursive ligatures)
 * - Sets pleasant font family fallback
 * - Increases line height so vertical diacritics and dots do not get clipped
 */
export function getTypographyStyle(baseStyle = {}, isRTL = false, textContent = '') {
  const isAr = isRTL || isArabicText(textContent);
  if (!isAr) return baseStyle;

  const sanitized = { ...baseStyle };

  // Crucial rule: Never apply letterSpacing to Arabic text
  if (sanitized.letterSpacing !== undefined) {
    sanitized.letterSpacing = 0;
  }

  // Remove uppercase text transforms which look unnatural or error-prone
  if (sanitized.textTransform === 'uppercase') {
    sanitized.textTransform = 'none';
  }

  // Replace monospace with clean Arabic font
  if (
    sanitized.fontFamily === 'monospace' ||
    sanitized.fontFamily === 'Menlo' ||
    sanitized.fontFamily === 'Space Mono' ||
    sanitized.fontFamily === 'Courier' ||
    sanitized.fontFamily === 'Courier-Bold' ||
    sanitized.fontFamily === 'Courier New'
  ) {
    sanitized.fontFamily = getArabicFontFamily();
  }

  // Elevate line height to prevent clipping of Arabic accents (harakat)
  if (sanitized.fontSize && (!sanitized.lineHeight || sanitized.lineHeight < sanitized.fontSize * 1.35)) {
    sanitized.lineHeight = Math.round(sanitized.fontSize * 1.45);
  }

  return sanitized;
}

export default {
  isArabicText,
  getArabicFontFamily,
  getTypographyStyle,
};
