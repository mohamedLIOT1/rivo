import { API_BASE_URL } from '../config';

const SOUNDCLOUD_CLIENT_ID = 'Pb72ranhoyt6gw7hM7TkzUItXlMWSNSo';
const streamCache = new Map();

/**
 * Resolves a playable direct audio URL for a given track.
 * Checks local/cached stream, queries SoundCloud progressive MP3 streams,
 * and falls back to Railway backend stream proxy.
 */
export const resolveAudioStream = async (track) => {
  if (!track) return null;

  const trackId = String(track._id || track.id || '');
  if (trackId && streamCache.has(trackId)) {
    return streamCache.get(trackId);
  }

  // 1. If already a direct local file
  if (track.nativeAudioUri || track.localAudioUri) {
    return track.nativeAudioUri || track.localAudioUri;
  }

  const rawUrl = track.audioUrl || '';

  // 2. Direct MP3/M4A/AAC stream URL
  if (
    rawUrl.startsWith('http') &&
    !rawUrl.includes('youtube.com') &&
    !rawUrl.includes('youtu.be') &&
    (rawUrl.endsWith('.mp3') || rawUrl.endsWith('.m4a') || rawUrl.includes('cf-media.sndcdn.com'))
  ) {
    streamCache.set(trackId, rawUrl);
    return rawUrl;
  }

  // 3. Try Railway backend direct stream resolver (using yt-dlp & server cache)
  const title = (track.title || '').trim();
  const artist = (track.artist || '').trim();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const serverStreamRes = await fetch(
      `${API_BASE_URL}/api/tracks/${encodeURIComponent(trackId)}/stream?url=${encodeURIComponent(rawUrl)}&title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`,
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
    // Continue to client-side resolver
  }

  // 4. Fast client-side SoundCloud progressive stream resolution

  const queries = [];
  if (artist && title) queries.push(`${artist} ${title}`);
  if (title) queries.push(title);

  for (const q of queries) {
    try {
      const searchUrl = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(q)}&client_id=${SOUNDCLOUD_CLIENT_ID}&limit=6`;
      const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        const collection = searchData.collection || [];
        for (const item of collection) {
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
    } catch (e) {
      // Continue to next query / fallback
    }
  }

  // 4. Backend Railway direct download / stream proxy
  if (rawUrl) {
    const backendStreamUrl = `${API_BASE_URL}/api/tracks/download?url=${encodeURIComponent(rawUrl)}&title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&id=${encodeURIComponent(trackId)}`;
    if (trackId) streamCache.set(trackId, backendStreamUrl);
    return backendStreamUrl;
  }

  return rawUrl || null;
};

export const resolveYouTubeStream = async (trackId) => {
  return null;
};
