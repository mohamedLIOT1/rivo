/**
 * Text and script normalization utilities for accurate genre and language detection.
 * Handles Arabic diacritics, letter unification, video/tag cleanup, and tokenization.
 */

const ARABIC_DIACRITICS_REGEX = /[\u064B-\u065F\u0670]/g;
const ARABIC_TATWEEL_REGEX = /\u0640/g;
const BRACKET_TAGS_REGEX = /[\(\[\{][^\)\]\}]*[\)\]\}]/g;
const NOISE_WORDS_REGEX = /\b(official\s*(video|audio|music\s*video|clip|hd|hq|4k)|lyric\s*video|audio|visualizer|remastered|remaster)\b/gi;
const ARABIC_NOISE_REGEX = /(فيديو\s*كليب|كليب|حصريا|حصرياً|النسخة\s*الأصلية|النسخة\s*الاصلية|اوديو|رسمي|أغنية|اغنية)/gi;

/**
 * Normalizes Arabic characters (alef, yaa, taa marbuta) and strips diacritics.
 */
function normalizeArabic(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(ARABIC_DIACRITICS_REGEX, '')
    .replace(ARABIC_TATWEEL_REGEX, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي');
}

/**
 * Cleans metadata text by stripping bracketed noise, format suffixes, and extra spaces.
 */
function cleanTrackMetadata(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .replace(BRACKET_TAGS_REGEX, ' ')
    .replace(NOISE_WORDS_REGEX, ' ')
    .replace(ARABIC_NOISE_REGEX, ' ')
    .replace(/[\-_|–—:/\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generates a normalized search string for resilient substring and token matching.
 */
function normalizeSearchText(text) {
  if (!text || typeof text !== 'string') return '';
  const cleaned = cleanTrackMetadata(text);
  const arabicNorm = normalizeArabic(cleaned);
  return arabicNorm
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if a string contains Arabic characters.
 */
function hasArabicScript(text) {
  if (!text || typeof text !== 'string') return false;
  return /[\u0600-\u06FF]/.test(text);
}

/**
 * Extracts normalized tokens from a text string.
 */
function extractTokens(text) {
  const norm = normalizeSearchText(text);
  return norm ? norm.split(/\s+/).filter(Boolean) : [];
}

/**
 * Checks if a text haystack contains a needle using flexible token or phrase matching.
 */
function matchesPattern(haystackNorm, needleNorm) {
  if (!haystackNorm || !needleNorm) return false;
  if (haystackNorm === needleNorm) return true;
  
  // Enforce word boundary matching for all needles to prevent false substring collisions
  const escaped = escapeRegex(needleNorm);
  const regex = new RegExp(`(^|[^a-zA-Z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF])${escaped}([^a-zA-Z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]|$)`, 'i');
  return regex.test(haystackNorm);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  normalizeArabic,
  cleanTrackMetadata,
  normalizeSearchText,
  hasArabicScript,
  extractTokens,
  matchesPattern,
  escapeRegex
};
