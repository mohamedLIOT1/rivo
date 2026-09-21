import * as FileSystem from 'expo-file-system';
import { API_BASE_URL } from '../config';

const SOUNDCLOUD_CLIENT_ID = 'Pb72ranhoyt6gw7hM7TkzUItXlMWSNSo';
const streamCache = new Map();

/**
 * Cleans track title and artist for high-accuracy audio stream resolution.
 * Strips Arabic & English movie notes, featured artist tags, video suffixes, etc.
 */
export function getCleanQueries(title = '', artist = '') {
  const cleanTitle = (title || '')
    .replace(/\s*[-–—]\s*(من فيلم|فيلم|أغنية|كليب|فيديو كليب|official|video|audio|lyrics|lyric|remix|clip|ost).*$/i, '')
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/(?:ft\.?|feat\.?|featuring)\s+.*$/i, '')
    .trim();

  const primaryTitle = cleanTitle.includes(' - ')
    ? cleanTitle.split(' - ')[0].trim()
    : cleanTitle;

  const cleanArtist = (artist || '')
    .split(/[-–—|/•,]/)[0]
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .trim();

  const queries = [];
  if (cleanArtist && primaryTitle) queries.push(`${cleanArtist} ${primaryTitle}`);
  if (primaryTitle) queries.push(primaryTitle);
  if (cleanArtist && cleanTitle && !queries.includes(`${cleanArtist} ${cleanTitle}`)) {
    queries.push(`${cleanArtist} ${cleanTitle}`);
  }
  if (artist && title && !queries.includes(`${artist} ${title}`)) {
    queries.push(`${artist} ${title}`);
  }

  return { cleanTitle: primaryTitle, cleanArtist, queries: [...new Set(queries.filter(Boolean))] };
}

/**
 * Ranks candidate SoundCloud tracks to ensure ONLY authentic original songs are played.
 * Strongly rejects remixes, sped up, slowed, covers, instrumentals, and random mashups.
 */
export function rankSoundCloudTrack(item, expectedTitle = '', expectedArtist = '', expectedDurationSec = 0) {
  let score = 100;
  const itemTitle = (item.title || '').toLowerCase();
  const userName = (item.user?.username || '').toLowerCase();
  const itemDurSec = (item.duration || 0) / 1000;
  const cleanTitle = (expectedTitle || '').toLowerCase().trim();
  const cleanArtist = (expectedArtist || '').toLowerCase().trim();

  // 1. Duration check
  if (expectedDurationSec > 30) {
    const diff = Math.abs(itemDurSec - expectedDurationSec);
    if (diff > 45) score -= 80;
    else if (diff <= 15) score += 30;
  } else {
    if (itemDurSec < 60 || itemDurSec > 600) score -= 80;
    else if (itemDurSec >= 120 && itemDurSec <= 360) score += 20;
  }

  // 2. Artist match boost
  if (cleanArtist) {
    if (userName.includes(cleanArtist) || itemTitle.includes(cleanArtist)) {
      score += 40;
    }
  }

  // 3. Title keywords match
  const words = cleanTitle.split(/\s+/).filter(w => w.length > 2);
  let matchedWords = 0;
  for (const w of words) {
    if (itemTitle.includes(w)) matchedWords++;
  }
  if (words.length > 0) {
    score += Math.round((matchedWords / words.length) * 40);
  }

  // 4. Heavily penalize unwanted variants unless explicitly part of the title
  const unwanted = [
    { key: 'remix', ar: 'ريمكس' },
    { key: 'cover', ar: 'كاور' },
    { key: 'piano', ar: 'بيانو' },
    { key: 'instrumental', ar: 'عزف' },
    { key: 'slowed', ar: 'مبطأ' },
    { key: 'sped', ar: 'مسرع' },
    { key: 'mashup', ar: 'ميكس' },
    { key: 'karaoke', ar: 'كاريوكي' },
    { key: 'nightcore', ar: 'نايتكور' },
    { key: '8d', ar: '8d' },
    { key: 'bass boosted', ar: 'بيس' },
    { key: 'leak', ar: 'مسرب' },
  ];

  for (const u of unwanted) {
    const requested = cleanTitle.includes(u.key) || cleanTitle.includes(u.ar);
    if (!requested) {
      if (itemTitle.includes(u.key) || itemTitle.includes(u.ar)) {
        score -= 90;
      }
    }
  }

  // 5. Official audio indicators
  if (item.user?.verified || itemTitle.includes('official') || itemTitle.includes('الأصلية') || itemTitle.includes('النسخة الأصلية')) {
    score += 30;
  }

  return score;
}

/**
 * Resolves a playable direct audio URL for a given track.
 * 1. Checks local offline storage.
 * 2. Checks direct stream URLs.
 * 3. Resolves authentic official YouTube stream via backend proxy / yt-dlp.
 * 4. Falls back to strictly ranked SoundCloud streams.
 */
export const resolveAudioStream = async (track) => {
  if (!track) return null;

  const trackId = String(track._id || track.id || '');
  if (trackId && streamCache.has(trackId)) {
    const cached = streamCache.get(trackId);
    // If it's a file URI, ensure it still exists on disk
    if (cached.startsWith('file://')) {
      try {
        const info = await FileSystem.getInfoAsync(cached);
        if (info.exists && info.size > 10000) return cached;
      } catch {}
      streamCache.delete(trackId);
    } else {
      return cached;
    }
  }

  // 1. Direct local file on device storage
  const localUri = track.nativeAudioUri || track.localAudioUri;
  if (localUri && localUri.startsWith('file://')) {
    try {
      const info = await FileSystem.getInfoAsync(localUri);
      if (info.exists && info.size > 10000) {
        if (trackId) streamCache.set(trackId, localUri);
        return localUri;
      }
    } catch {}
  }

  const rawUrl = track.audioUrl || '';
  const rawTitle = (track.title || '').trim();
  const rawArtist = (track.artist || '').trim();
  const expectedDuration = Number(track.duration || 0);
  const { cleanTitle, cleanArtist, queries } = getCleanQueries(rawTitle, rawArtist);

  // 2. Direct MP3/M4A/AAC stream URL
  if (
    rawUrl.startsWith('http') &&
    !rawUrl.includes('youtube.com') &&
    !rawUrl.includes('youtu.be') &&
    (rawUrl.endsWith('.mp3') || rawUrl.endsWith('.m4a') || rawUrl.includes('cf-media.sndcdn.com'))
  ) {
    if (trackId) streamCache.set(trackId, rawUrl);
    return rawUrl;
  }

  // 3. Prioritize Official Stream from Backend
  if (rawUrl || trackId) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const serverStreamRes = await fetch(
        `${API_BASE_URL}/api/tracks/${encodeURIComponent(trackId || 'stream')}/stream?url=${encodeURIComponent(rawUrl)}&title=${encodeURIComponent(cleanTitle || rawTitle)}&artist=${encodeURIComponent(cleanArtist || rawArtist)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (serverStreamRes.ok) {
        const data = await serverStreamRes.json();
        if (data?.success && data?.url) {
          if (trackId) streamCache.set(trackId, data.url);
          return data.url;
        }
      }
    } catch (e) {
      // Backend request timed out or failed, continue
    }
  }

  // 4. Backend direct stream proxy (guarantees authentic original audio from server)
  if (rawUrl) {
    const backendStreamUrl = `${API_BASE_URL}/api/tracks/download?url=${encodeURIComponent(rawUrl)}&title=${encodeURIComponent(cleanTitle || rawTitle)}&artist=${encodeURIComponent(cleanArtist || rawArtist)}&id=${encodeURIComponent(trackId)}`;
    if (trackId) streamCache.set(trackId, backendStreamUrl);
    return backendStreamUrl;
  }

  // 5. Fallback: Client-side SoundCloud resolution with STRICT authenticity ranking
  for (const q of queries) {
    try {
      const searchUrl = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(q)}&client_id=${SOUNDCLOUD_CLIENT_ID}&limit=12`;
      const searchRes = await fetch(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const collection = searchData.collection || [];
        const candidates = collection.filter(
          item => item.policy !== 'SNIP' && (item.duration || 0) > 45000
        );

        const ranked = candidates
          .map(item => ({
            item,
            score: rankSoundCloudTrack(item, cleanTitle || rawTitle, cleanArtist || rawArtist, expectedDuration)
          }))
          .filter(c => c.score >= 60)
          .sort((a, b) => b.score - a.score);

        for (const { item } of ranked) {
          const prog = item.media?.transcodings?.find(
            t => t.format?.protocol === 'progressive' && !t.snipped
          );
          if (prog && prog.url) {
            const streamRes = await fetch(`${prog.url}?client_id=${SOUNDCLOUD_CLIENT_ID}`);
            if (streamRes.ok) {
              const streamData = await streamRes.json();
              if (streamData?.url) {
                if (trackId) streamCache.set(trackId, streamData.url);
                return streamData.url;
              }
            }
          }
        }
      }
    } catch (e) {}
  }

  return rawUrl || null;
};

export const resolveYouTubeStream = async (trackId) => {
  return null;
};
