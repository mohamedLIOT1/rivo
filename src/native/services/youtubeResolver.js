import * as FileSystem from 'expo-file-system';
import { API_BASE_URL } from '../config';

const streamCache = new Map();
const streamDurationCache = new Map();

export const getStreamFromCache = (trackId) => {
  if (!trackId) return null;
  return streamCache.get(String(trackId)) || null;
};

export const getStreamDurationFromCache = (trackId) => {
  if (!trackId) return null;
  return streamDurationCache.get(String(trackId)) || null;
};

let cachedVisitorData = '';
let cachedVisitorTimestamp = 0;
const VISITOR_CACHE_TTL = 3600 * 1000 * 12; // 12 hours

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
 * Resolves a playable direct audio URL for a given track.
 * 1. Checks local offline storage.
 * 2. Checks direct stream URLs.
 * 3. Resolves authentic official YouTube stream via backend proxy.
 * 4. Resolves via server stream resolver.
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

  // 1. Direct local file on device storage (by nativeAudioUri or downloadedTracks check)
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
  const { cleanTitle, cleanArtist } = getCleanQueries(rawTitle, rawArtist);

  // 1b. Check if track is saved in offline storage by clean title + artist
  try {
    const { getDownloadedTracks } = require('./downloadManager');
    const dls = await getDownloadedTracks();
    if (Array.isArray(dls) && dls.length > 0) {
      const found = dls.find(d => {
        if (!d) return false;
        if (trackId && String(d._id || d.id) === trackId) return true;
        const dTitle = (d.title || '').toLowerCase().trim();
        const dArtist = (d.artist || '').toLowerCase().trim();
        const cTitle = (cleanTitle || rawTitle).toLowerCase().trim();
        const cArtist = (cleanArtist || rawArtist).toLowerCase().trim();
        return (cTitle && dTitle === cTitle) && (!cArtist || !dArtist || dArtist === cArtist);
      });
      const dlUri = found?.localAudioUri || found?.nativeAudioUri;
      if (dlUri && dlUri.startsWith('file://')) {
        const info = await FileSystem.getInfoAsync(dlUri);
        if (info.exists && info.size > 10000) {
          if (trackId) streamCache.set(trackId, dlUri);
          return dlUri;
        }
      }
    }
  } catch {}

  // 2. Direct MP3/M4A/AAC stream URL (non-YouTube)
  if (
    rawUrl.startsWith('http') &&
    !rawUrl.includes('youtube.com') &&
    !rawUrl.includes('youtu.be') &&
    !rawUrl.includes('soundcloud.com') &&
    !rawUrl.includes('sndcdn.com') &&
    (rawUrl.endsWith('.mp3') || rawUrl.endsWith('.m4a'))
  ) {
    if (trackId) streamCache.set(trackId, rawUrl);
    return rawUrl;
  }

  // 3. Ultra-fast Client-side YouTube Audio Stream Resolution (resolves official Googlevideo stream directly on device in <1s)
  let ytId = extractYouTubeId(rawUrl) ||
             (track.source === 'YouTube' ? extractYouTubeId(trackId) : null);

  // If no direct ytId, search YouTube client-side directly (<300ms)
  if (!ytId && (cleanTitle || cleanArtist || rawTitle)) {
    try {
      const searchRes = await searchYouTubeClientSide(`${cleanArtist || rawArtist} ${cleanTitle || rawTitle}`.trim());
      if (searchRes?.videoId) {
        ytId = searchRes.videoId;
        if (searchRes.duration && trackId) {
          streamDurationCache.set(trackId, searchRes.duration);
        }
      }
    } catch (e) {}
  }

  if (ytId) {
    try {
      const directResult = await resolveClientSideYouTubeStream(ytId);
      const directStream = typeof directResult === 'string' ? directResult : directResult?.url;
      if (directStream) {
        if (trackId) {
          streamCache.set(trackId, directStream);
          if (directResult?.duration) streamDurationCache.set(trackId, directResult.duration);
        }
        return directStream;
      }
    } catch (e) {}
  }

  // 4. Server-side Stream Resolution via Proxy Fallback
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const serverStreamRes = await fetch(
      `${API_BASE_URL}/api/tracks/${encodeURIComponent(trackId || 'stream')}/stream?url=${encodeURIComponent(rawUrl)}&title=${encodeURIComponent(cleanTitle || rawTitle)}&artist=${encodeURIComponent(cleanArtist || rawArtist)}`,
      { signal: controller.signal }
    );
    clearTimeout(timeoutId);
    if (serverStreamRes.ok) {
      const data = await serverStreamRes.json();
      let streamUrl = data?.url || data?.directUrl;
      if (streamUrl) {
        if (streamUrl.startsWith('/')) {
          streamUrl = `${API_BASE_URL}${streamUrl}`;
        }
        if (trackId) streamCache.set(trackId, streamUrl);
        return streamUrl;
      }
    }
  } catch (e) {
    // Backend request timed out or failed
  }

  return rawUrl || null;
};

/**
 * Ultra-fast client-side YouTube search via Innertube API (<300ms).
 * Returns { videoId, duration, title, channel } with exact duration parsed from lengthText.
 */
export const searchYouTubeClientSide = async (query) => {
  if (!query || typeof query !== 'string') return null;
  try {
    const key = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`https://www.youtube.com/youtubei/v1/search?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20231201.00.00',
            hl: 'en',
            gl: 'US'
          }
        },
        query: `${query} music`
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const d = await res.json();
    const contents = d?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
    const candidates = contents
      .map(c => c.videoRenderer)
      .filter(v => v && v.videoId);

    // Prefer standard single tracks (< 12 minutes) over long DJ mixes or 1-hour loops
    const v = candidates.find(item => {
      const durText = item.lengthText?.simpleText || item.lengthText?.runs?.[0]?.text || '';
      const parts = durText.split(':');
      if (parts.length > 2) return false; // Contains hours
      const mins = parseInt(parts[0], 10);
      return !isNaN(mins) && mins < 12;
    }) || candidates[0];

    if (v) {
      const videoId = v.videoId;
      const durText = v.lengthText?.simpleText || v.lengthText?.runs?.[0]?.text || '';
      let durSec = 0;
      if (durText) {
        const parts = durText.split(':').map(p => parseInt(p, 10));
        if (parts.length === 2) durSec = parts[0] * 60 + parts[1];
        else if (parts.length === 3) durSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      return {
        videoId,
        duration: durSec || null,
        title: v.title?.runs?.[0]?.text || '',
        channel: v.ownerText?.runs?.[0]?.text || ''
      };
    }
  } catch (e) {}
  return null;
};

export function extractYouTubeId(input) {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();
  const m1 = str.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
  if (m1 && m1[1] && m1[1].length === 11) return m1[1];
  const m2 = str.match(/^yt[-_]?([a-zA-Z0-9_-]{11})$/i);
  if (m2 && m2[1] && m2[1].length === 11) return m2[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  return null;
}

export const resolveClientSideYouTubeStream = async (ytId) => {
  if (!ytId) return null;
  try {
    const key = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
    let visitorData = '';
    let cookies = '';

    // Fast official visitor_id token acquisition with in-memory caching
    if (cachedVisitorData && (Date.now() - cachedVisitorTimestamp < VISITOR_CACHE_TTL)) {
      visitorData = cachedVisitorData;
    } else {
      try {
        const vController = new AbortController();
        const vTimeout = setTimeout(() => vController.abort(), 2500);
        const vRes = await fetch(`https://www.youtube.com/youtubei/v1/visitor_id?key=${key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            context: {
              client: {
                clientName: 'VISIONOS',
                clientVersion: '1.02',
                deviceMake: 'Apple',
                deviceModel: 'RealityDevice17,1',
                osName: 'visionOS',
                osVersion: '26.5.23O471',
                hl: 'en',
                gl: 'US',
              }
            }
          }),
          signal: vController.signal,
        });
        clearTimeout(vTimeout);
        if (vRes.ok) {
          const vData = await vRes.json();
          visitorData = vData?.responseContext?.visitorData || '';
          if (visitorData) {
            cachedVisitorData = visitorData;
            cachedVisitorTimestamp = Date.now();
          }
        }
      } catch (e) {}
    }

    // Fallback: scrape watch page only if visitor_id was completely missing
    if (!visitorData) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const webRes = await fetch(`https://www.youtube.com/watch?v=${ytId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
          },
          signal: controller.signal,
        });
        const html = await webRes.text();
        clearTimeout(timeoutId);

        const visitorMatch = html.match(/"VISITOR_DATA":"([^"]+)"/);
        if (visitorMatch && visitorMatch[1]) {
          visitorData = visitorMatch[1];
          cachedVisitorData = visitorData;
          cachedVisitorTimestamp = Date.now();
        }
        cookies = webRes.headers?.get ? (webRes.headers.get('set-cookie') || '') : '';
      } catch (e) {}
    }

    const playerBody = {
      context: {
        client: {
          clientName: 'VISIONOS',
          clientVersion: '1.02',
          deviceMake: 'Apple',
          deviceModel: 'RealityDevice17,1',
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
          osName: 'visionOS',
          osVersion: '26.5.23O471',
          hl: 'en',
          gl: 'US',
          visitorData: visitorData || undefined,
        },
      },
      videoId: ytId,
    };

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
    };
    if (cookies) headers['Cookie'] = cookies;

    const playerController = new AbortController();
    const playerTimeout = setTimeout(() => playerController.abort(), 6000);

    const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${key}&prettyPrint=false`, {
      method: 'POST',
      headers,
      body: JSON.stringify(playerBody),
      signal: playerController.signal,
    });
    clearTimeout(playerTimeout);

    if (res.ok) {
      const data = await res.json();
      if (data?.playabilityStatus?.status === 'OK') {
        const formats = (data.streamingData?.adaptiveFormats || []).concat(data.streamingData?.formats || []);
        // itag 140 is official AAC/m4a audio 128kbps, itag 139 is 48kbps, itag 251 is opus
        const audio140 = formats.find(f => f.itag === 140 && f.url);
        const anyAudio = formats.find(f => f.mimeType?.startsWith('audio') && f.url);
        const chosen = audio140 || anyAudio;
        if (chosen?.url) {
          const rawSec = parseInt(data.videoDetails?.lengthSeconds, 10);
          const rawMs = parseInt(chosen.approxDurationMs, 10);
          const durationSec = (rawSec && !isNaN(rawSec) && rawSec > 0)
            ? rawSec
            : (rawMs && !isNaN(rawMs) && rawMs > 0 ? Math.round(rawMs / 1000) : null);

          return {
            url: chosen.url,
            duration: durationSec,
            contentLength: chosen.contentLength ? parseInt(chosen.contentLength, 10) : null,
            title: data.videoDetails?.title || null,
            author: data.videoDetails?.author || null,
            toString() { return this.url; }
          };
        }
      }
    }
  } catch (err) {}
  return null;
};

export const resolveYouTubeStream = async (trackId) => {
  return null;
};
