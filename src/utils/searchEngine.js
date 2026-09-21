/**
 * Rivo Music Search Engine
 * High-performance Backend Search Engine & Stream Resolver
 */

import { API_BASE_URL } from '../config.js';

export const isMusicTrack = (title = '', artist = '') => {
  const NON_MUSIC_REGEX = /(سبونج\s*بوب|سبونجبوب|spongebob|sponge\s*bob|بوب\s*القطار|bob\s*the\s*train|كرتون|رسوم\s*متحركة|حلقة\s*\d+|الموسم|حلقات|سلسلة|أنمي|انمي|نيكيلوديون|nickelodeon|mbc\s*3|mbc3|سبيستون|spacetoon|أطفال|اطفال|حكايات\s*أطفال|قصة\s*قبل\s*النوم|مسلسل|فيلم\s*كامل|مشهد\s*مضحك|كارتون|براعم|طيور\s*الجنة|كراميش|baby\s*shark|cocomelon|cartoon|animation|episode|full\s*episode)/i;
  const text = `${title || ''} ${artist || ''}`.toLowerCase();
  return !NON_MUSIC_REGEX.test(text);
};

export const searchMusicOnline = async (searchQuery) => {
  if (!searchQuery || !searchQuery.trim()) return [];

  let query = searchQuery.trim();

  // Redirect Western Pop / Bob to Arabic Pop Songs
  if (/^(pop|the pop|pop music|pops|بوب|بوب عربي|arabic pop)$/i.test(query)) {
    query = 'أغاني بوب عربي عمرو دياب تامر حسني';
  } else if (query === 'بوب') {
    query = 'أغاني بوب عربي';
  }

  // Primary Backend Search Engine API Call
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const backendRes = await fetch(
      `${API_BASE_URL}/api/search/external?q=${encodeURIComponent(query)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);

    if (backendRes.ok) {
      const contentType = backendRes.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await backendRes.json();
        if (data.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
          return data.tracks.filter(t => 
            t &&
            t.title &&
            t.source !== 'SoundCloud' &&
            t.album !== 'SoundCloud' &&
            !String(t.audioUrl || '').includes('soundcloud.com') &&
            !String(t.audioUrl || '').includes('sndcdn.com') &&
            !String(t.id || '').startsWith('sc-') &&
            isMusicTrack(t.title, t.artist)
          );
        }
      }
    }
  } catch (e) {
    console.warn('Backend search API unreachable or timed out:', e.message);
  }

  return [];
};
