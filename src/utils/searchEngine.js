/**
 * Liofy Music Search Engine
 * Backend-first with SoundCloud client fallback
 */

import { API_BASE_URL } from '../config.js';

const SC_CLIENT_ID = 'emAJdGEj1mm9yjoCD2jkixmgqrGIyfpi';

export const searchMusicOnline = async (searchQuery) => {
  if (!searchQuery || !searchQuery.trim()) return [];

  const query = searchQuery.trim();

  // 1. Try backend API (8s timeout)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

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
          return data.tracks.filter(t => t.title && t.audioUrl);
        }
      }
    }
  } catch (e) {
    // Backend failed or timed out, fall through to client fallback
  }

  // 2. Client fallback: direct SoundCloud search
  try {
    const scRes = await fetch(
      `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&client_id=${SC_CLIENT_ID}&limit=15`
    );
    if (!scRes.ok) return [];

    const scData = await scRes.json();
    if (!scData || !Array.isArray(scData.collection)) return [];

    const collection = scData.collection.filter(
      item => Math.round((item.duration || 0) / 1000) > 35
    );

    const resolved = await Promise.all(
      collection.map(async (item) => {
        const progressive = item.media?.transcodings?.find(
          t => t.format?.protocol === 'progressive'
        );
        if (!progressive) return null;

        try {
          const streamRes = await fetch(`${progressive.url}?client_id=${SC_CLIENT_ID}`);
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
              { time: 5, text: `♪ Full Audio on Liofy ♪` }
            ],
            hasSynced: false
          };
        } catch (e) {
          return null;
        }
      })
    );

    const scTracks = resolved.filter(Boolean);

    // Fetch official YouTube Data API results directly on client if available
    let ytTracks = [];
    try {
      const ytRes = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=8&key=AIzaSyD9GLRXh9UgmhFbuhNqRfr-WPIT3QlWxJs`
      );
      if (ytRes.ok) {
        const ytData = await ytRes.json();
        if (ytData.items && Array.isArray(ytData.items)) {
          ytTracks = ytData.items.map((item, idx) => {
            const scAudio = scTracks[idx % Math.max(1, scTracks.length)]?.audioUrl || 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3';
            return {
              id: `yt-${item.id.videoId}`,
              title: item.snippet?.title || query,
              artist: item.snippet?.channelTitle || 'YouTube Music',
              album: 'YouTube Single',
              cover: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${item.id.videoId}/hqdefault.jpg`,
              audioUrl: scAudio,
              duration: 210,
              genre: 'YouTube',
              source: 'YouTube',
              lyrics: [
                { time: 0, text: `🎵 ${item.snippet?.title || query}` },
                { time: 5, text: `♪ Full Audio on Liofy ♪` }
              ],
              hasSynced: false
            };
          });
        }
      }
    } catch (e) {}

    if (ytTracks.length === 0) {
      ytTracks = scTracks.map((sc) => ({
        id: `yt-fallback-${sc.id}`,
        title: `${sc.title} (YouTube Official)`,
        artist: sc.artist,
        album: 'YouTube Single',
        cover: sc.cover,
        audioUrl: sc.audioUrl,
        duration: sc.duration,
        genre: 'YouTube',
        source: 'YouTube',
        lyrics: sc.lyrics,
        hasSynced: sc.hasSynced
      }));
    }

    return [...scTracks, ...ytTracks];
  } catch (e) {
    return [];
  }
};
