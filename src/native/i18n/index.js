import en from './en.js';
import ar from './ar.js';

export const translations = { en, ar };

export const SUPPORTED_LANGUAGES = [
  { code: 'ar', label: 'العربية', nativeName: 'العربية', dir: 'rtl' },
  { code: 'en', label: 'English', nativeName: 'English', dir: 'ltr' },
];

export const DEFAULT_LANGUAGE = 'en';

/**
 * Safely resolves nested keys such as 'nav.home' from a dictionary object.
 */
export function getNestedTranslation(dictionary, keyPath) {
  if (!dictionary || typeof keyPath !== 'string') return null;
  const parts = keyPath.split('.');
  let current = dictionary;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return null;
    }
  }
  return typeof current === 'string' ? current : null;
}

/**
 * Safely replaces {name} or {{name}} with params[name].
 */
export function interpolate(template, params) {
  if (typeof template !== 'string') return template;
  if (!params || typeof params !== 'object') return template;
  return template.replace(/\{{1,2}\s*([\w.]+)\s*\}{1,2}/g, (match, paramKey) => {
    return params[paramKey] !== undefined ? String(params[paramKey]) : match;
  });
}

/**
 * Core translation function with multi-tier fallback:
 * 1. Target language dictionary
 * 2. Fallback to English dictionary
 * 3. Fallback to key itself (prevents crashes)
 */
export function translate(lang, keyPath, params) {
  const activeDict = translations[lang] || translations[DEFAULT_LANGUAGE];
  let res = getNestedTranslation(activeDict, keyPath);

  // Fallback to English if missing in active language
  if (res === null && lang !== 'en') {
    res = getNestedTranslation(translations.en, keyPath);
  }

  // Final fallback to key path itself
  if (res === null) {
    res = keyPath;
  }

  return interpolate(res, params);
}

export default {
  translations,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  getNestedTranslation,
  interpolate,
  translate,
};
