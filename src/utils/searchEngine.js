/**
 * Rivo Music Search Engine
 * High-performance Backend Search Engine & Fallback Stream Resolver
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

  // 1. Primary Backend Search Engine API Call
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
          return data.tracks.filter(t => t.title && t.audioUrl && isMusicTrack(t.title, t.artist));
        }
      }
    }
  } catch (e) {
    console.warn('Backend search API unreachable or timed out:', e.message);
  }

  // 2. Client-side Safe Search Fallback
  try {
    const scRes = await fetch(
      `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&limit=12`
    ).catch(() => null);

    if (!scRes || !scRes.ok) return [];

    const scData = await scRes.json();
    if (!scData || !Array.isArray(scData.collection)) return [];

    const collection = scData.collection.filter(
      item => Math.round((item.duration || 0) / 1000) > 30 && isMusicTrack(item.title, item.user?.username)
    );

    const resolved = await Promise.all(
      collection.map(async (item) => {
        const progressive = item.media?.transcodings?.find(
          t => t.format?.protocol === 'progressive'
        );
        if (!progressive) return null;

        try {
          const streamRes = await fetch(progressive.url);
          if (!streamRes.ok) return null;
          const streamData = await streamRes.json();
          if (!streamData.url) return null;

          return {
            id: `sc-${item.id}`,
            title: item.title || query,
            artist: item.user?.username || 'SoundCloud Artist',
            album: 'SoundCloud',
            cover: item.artwork_url
              ? item.artwork_url.replace('-large', '-t500x500')
              : (item.user?.avatar_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600'),
            audioUrl: streamData.url,
            duration: Math.round((item.duration || 180000) / 1000),
            genre: 'SoundCloud',
            source: 'SoundCloud',
            lyrics: [
              { time: 0, text: `🎵 ${item.title || query}` },
              { time: 5, text: `♪ Full Audio on Rivo ♪` }
            ],
            hasSynced: false
          };
        } catch (e) {
          return null;
        }
      })
    );

    return resolved.filter(Boolean).filter(t => isMusicTrack(t.title, t.artist));
  } catch (e) {
    return [];
  }
};
