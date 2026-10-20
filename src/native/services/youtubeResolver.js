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

export const clearStreamCache = (trackId) => {
  if (!trackId) return;
  const idStr = String(trackId);
  streamCache.delete(idStr);
  streamDurationCache.delete(idStr);
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

  const cleanArtist = (artist || '')
    .split(/[-–—|/•,]/)[0]
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .trim();

  let primaryTitle = cleanTitle;
  if (cleanTitle.includes(' - ')) {
    const parts = cleanTitle.split(' - ');
    const firstPart = parts[0].trim();
    const rest = parts.slice(1).join(' - ').trim();
    // Do NOT split by ' - ' if remaining title matches artist or if length under 3
    if (cleanArtist && firstPart.toLowerCase() === cleanArtist.toLowerCase() && rest.length >= 3) {
      primaryTitle = rest; // "Wegz - عفاريت الأسفلت" -> "عفاريت الأسفلت"
    } else if (cleanArtist && rest.toLowerCase() === cleanArtist.toLowerCase() && firstPart.length >= 3) {
      primaryTitle = firstPart;
    } else if (firstPart.length < 3) {
      primaryTitle = cleanTitle; // keep full title
    } else {
      primaryTitle = cleanTitle; // keep full title
    }
  }

  const queries = [];
  if (cleanArtist && primaryTitle) queries.push(`${cleanArtist} ${primaryTitle}`);
  if (cleanArtist && cleanTitle && cleanTitle !== primaryTitle) queries.push(`${cleanArtist} ${cleanTitle}`);
  if (primaryTitle) queries.push(primaryTitle);
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

  // 1b. Check if track is saved in offline storage by exact track ID OR exact clean title AND artist
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
        // Exact title AND artist match required. Never fallback to loose title-only match.
        return Boolean(cTitle && cArtist && dTitle && dArtist && dTitle === cTitle && dArtist === cArtist);
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

  // 1c. Direct local upload audio stream
  if (
    track.source === 'Upload' ||
    rawUrl.startsWith('/uploads/') ||
    rawUrl.includes('/uploads/')
  ) {
    const fullUrl = rawUrl.startsWith('/') ? `${API_BASE_URL}${rawUrl}` : (rawUrl.startsWith('http') ? rawUrl : `${API_BASE_URL}/${rawUrl}`);
    if (trackId) streamCache.set(trackId, fullUrl);
    if (track.duration && trackId) streamDurationCache.set(trackId, track.duration);
    return fullUrl;
  }

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

  const targetDuration = Number(track.duration) || null;

  // 3. Server-side Stream Resolution (Primary: /stream endpoint checks local cache, uploads & DB instantly)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const durParam = targetDuration ? `&duration=${encodeURIComponent(targetDuration)}` : '';

    // 3a. Direct fast stream endpoint: /api/tracks/:id/stream (same as Web)
    try {
      const serverStreamRes = await fetch(
        `${API_BASE_URL}/api/tracks/${encodeURIComponent(trackId || 'stream')}/stream?url=${encodeURIComponent(rawUrl)}&title=${encodeURIComponent(cleanTitle || rawTitle)}&artist=${encodeURIComponent(cleanArtist || rawArtist)}${durParam}`,
        { signal: controller.signal }
      );
      if (serverStreamRes.ok) {
        const data = await serverStreamRes.json();
        let streamUrl = data?.url || data?.directUrl;
        if (streamUrl && !streamUrl.includes('youtube.com/watch') && !streamUrl.includes('youtu.be/')) {
          if (streamUrl.startsWith('/')) {
            streamUrl = `${API_BASE_URL}${streamUrl}`;
          }
          clearTimeout(timeoutId);
          if (trackId) streamCache.set(trackId, streamUrl);
          if (data?.duration && trackId) {
            streamDurationCache.set(trackId, data.duration);
          }
          return streamUrl;
        }
      }
    } catch {}

    // 3b. Resolve stream via /api/tracks/resolve-stream
    try {
      const resolveRes = await fetch(
        `${API_BASE_URL}/api/tracks/resolve-stream?stream=true&title=${encodeURIComponent(rawTitle || cleanTitle)}&artist=${encodeURIComponent(rawArtist || cleanArtist)}&url=${encodeURIComponent(rawUrl)}&id=${encodeURIComponent(trackId)}${durParam}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (resolveRes.ok) {
        const d = await resolveRes.json();
        if (d.success && d.url && !d.url.includes('youtube.com/watch') && !d.url.includes('youtu.be/')) {
          let cand = d.url;
          if (cand.startsWith('/')) cand = `${API_BASE_URL}${cand}`;
          if (trackId) streamCache.set(trackId, cand);
          if (d.duration && trackId) {
            streamDurationCache.set(trackId, d.duration);
          }
          return cand;
        }
      }
    } catch {}
  } catch (e) {
    // Backend request failed or timed out, fallback to client-side
  }

  // 4. Client-side YouTube Audio Stream Resolution Fallback
  let ytId = extractYouTubeId(rawUrl) ||
             (track.source === 'YouTube' ? extractYouTubeId(trackId) : null);

  // If no direct ytId, search YouTube client-side directly (<300ms)
  const isUploadTrack = track.source === 'Upload' || (rawUrl && (rawUrl.startsWith('/uploads/') || rawUrl.includes('/uploads/')));
  if (!isUploadTrack && !ytId && (cleanTitle || cleanArtist || rawTitle)) {
    try {
      const searchRes = await searchYouTubeClientSide({
        artist: cleanArtist || rawArtist,
        title: cleanTitle || rawTitle,
        targetDuration
      });
      if (searchRes?.videoId) {
        ytId = searchRes.videoId;
        if (searchRes.duration && trackId) {
          if (!targetDuration || Math.abs(searchRes.duration - targetDuration) <= 60) {
            streamDurationCache.set(trackId, searchRes.duration);
          }
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
          if (directResult?.duration) {
            if (!targetDuration || Math.abs(directResult.duration - targetDuration) <= 60) {
              streamDurationCache.set(trackId, directResult.duration);
            }
          }
        }
        return directStream;
      }
    } catch (e) {}
  }

  // Safety guard: never pass HTML web URLs (youtube.com / youtu.be) into audio player
  if (rawUrl && !rawUrl.includes('youtube.com') && !rawUrl.includes('youtu.be')) {
    return rawUrl;
  }

  return null;
};

export function calculateTitleSimilarity(targetTitle = '', candTitle = '', targetArtist = '') {
  const t = String(targetTitle || '').toLowerCase().replace(/[/\\?%*:|"<>_]/g, ' ').trim();
  const c = String(candTitle || '').toLowerCase().replace(/[/\\?%*:|"<>_]/g, ' ').trim();
  const a = String(targetArtist || '').toLowerCase().replace(/[/\\?%*:|"<>_]/g, ' ').trim();
  if (!t || !c) return 0;
  if (c === t || (t.length >= 4 && c.includes(t))) return 1.0;

  const tTokens = t.split(/\s+/).filter(w => w.length > 1);
  const cTokens = c.split(/\s+/).filter(w => w.length > 1);
  if (tTokens.length === 0) return 0;

  let matched = 0;
  for (const tok of tTokens) {
    if (cTokens.includes(tok) || c.includes(tok)) matched++;
  }
  let score = matched / tTokens.length;
  if (a && (c.includes(a) || cTokens.includes(a))) {
    score = Math.min(1.0, score + 0.2);
  }
  return score;
}

/**
 * Ultra-fast client-side YouTube search via Innertube API (<300ms).
 * Returns { videoId, duration, title, channel } with exact duration parsed from lengthText.
 * Enforces strict duration filter (diff <= 15s-25s) and title/channel scoring.
 */
export const searchYouTubeClientSide = async (queryOrOptions, maybeOptions = {}) => {
  let query = '';
  let targetDuration = null;
  let artist = '';
  let title = '';

  if (queryOrOptions && typeof queryOrOptions === 'object') {
    query = queryOrOptions.query || '';
    targetDuration = Number(queryOrOptions.targetDuration || queryOrOptions.duration) || null;
    artist = queryOrOptions.artist || '';
    title = queryOrOptions.title || '';
  } else if (typeof queryOrOptions === 'string') {
    query = queryOrOptions.trim();
    if (typeof maybeOptions === 'number') {
      targetDuration = maybeOptions;
    } else if (maybeOptions && typeof maybeOptions === 'object') {
      targetDuration = Number(maybeOptions.targetDuration || maybeOptions.duration) || null;
      artist = maybeOptions.artist || '';
      title = maybeOptions.title || '';
    }
  }

  if (!artist && !title && query && query.includes(' - ')) {
    const parts = query.split(' - ');
    artist = parts[0].trim();
    title = parts.slice(1).join(' - ').trim();
  }

  const cleanArt = String(artist || '').replace(/["']/g, ' ').trim();
  const cleanTit = String(title || '').replace(/["']/g, ' ').trim();

  // Search queries according to strict guidelines:
  // Primary: "${cleanArtist}" "${cleanTitle}"
  // Secondary: "${cleanTitle}" ${cleanArtist} official audio
  const searchQueries = [];
  if (cleanArt && cleanTit) {
    searchQueries.push(`"${cleanArt}" "${cleanTit}"`);
    searchQueries.push(`"${cleanTit}" ${cleanArt} official audio`);
  } else if (query) {
    const cleanQ = query.replace(/\s+music$/i, '').trim();
    searchQueries.push(cleanQ);
    searchQueries.push(`${cleanQ} official audio`);
  }

  if (searchQueries.length === 0) return null;

  const key = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

  const parseSec = (renderer) => {
    const durText = renderer.lengthText?.simpleText || renderer.lengthText?.runs?.[0]?.text || '';
    if (!durText) return 0;
    const parts = durText.split(':').map(p => parseInt(p, 10));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return parts[0] * 60 + parts[1];
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  };

  const normArtist = cleanArt.toLowerCase();
  const normTitle = cleanTit.toLowerCase();

  for (const q of searchQueries) {
    try {
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
          query: q
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!res.ok) continue;

      const d = await res.json();
      const contents = d?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
      const candidates = contents
        .map(c => c.videoRenderer)
        .filter(v => v && v.videoId);

      if (candidates.length === 0) continue;

      let scoredCandidates = candidates.map(item => {
        const vidId = item.videoId;
        const durSec = parseSec(item);
        const candTitle = (item.title?.runs?.[0]?.text || '').toLowerCase();
        const candChannel = (item.ownerText?.runs?.[0]?.text || '').toLowerCase();

        let score = 0;
        let durationDiff = targetDuration && durSec > 0 ? Math.abs(durSec - targetDuration) : null;
        const similarity = calculateTitleSimilarity(cleanTit, candTitle, cleanArt);

        if (durationDiff !== null) {
          if (durationDiff <= 5) score += 60;
          else if (durationDiff <= 15) score += 40;
          else if (durationDiff <= 25) score += 10;
          else score -= 200; // Over 25s difference rejected
        }

        score += Math.round(similarity * 50);

        if (normTitle && candTitle.includes(normTitle)) score += 40;
        if (normArtist && (candTitle.includes(normArtist) || candChannel.includes(normArtist))) score += 30;

        if (candChannel.includes('topic') || candChannel.includes('official') || candChannel.includes('vevo')) score += 30;
        if (candTitle.includes('official audio') || candTitle.includes('official lyric') || candTitle.includes('official video')) score += 20;

        if (!normTitle.includes('mix') && (candTitle.includes('mix') || candTitle.includes('full album') || candTitle.includes('playlist'))) score -= 100;
        if (!normTitle.includes('live') && candTitle.includes('live') && !normTitle.includes('حفلة')) score -= 50;
        if (durSec > 900 && (!targetDuration || targetDuration < 900)) score -= 100;

        return {
          videoId: vidId,
          duration: durSec || null,
          title: item.title?.runs?.[0]?.text || '',
          channel: item.ownerText?.runs?.[0]?.text || '',
          score,
          durationDiff,
          similarity
        };
      });

      // Strict duration & title filter:
      // If targetDuration exists, candidate duration difference MUST be within 15 seconds (max 25s allowed with high similarity).
      // If difference > 25 seconds or title similarity is low, REJECT the candidate.
      scoredCandidates = scoredCandidates.filter(c => {
        if (targetDuration && c.durationDiff !== null) {
          if (c.durationDiff > 25) return false;
          if (c.durationDiff > 15 && c.similarity < 0.5) return false;
        }
        if (cleanTit && c.similarity < 0.25) return false;
        return true;
      });

      if (scoredCandidates.length > 0) {
        scoredCandidates.sort((a, b) => b.score - a.score);
        const best = scoredCandidates[0];
        return {
          videoId: best.videoId,
          duration: best.duration || targetDuration || null,
          title: best.title,
          channel: best.channel
        };
      }
    } catch (e) {}
  }

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
    let sts = 20744;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

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

      const stsMatch = html.match(/"signatureTimestamp":(\d+)/);
      if (stsMatch && stsMatch[1]) {
        sts = parseInt(stsMatch[1], 10);
      }

      if (webRes.headers?.getSetCookie) {
        const sc = webRes.headers.getSetCookie();
        if (Array.isArray(sc) && sc.length > 0) {
          cookies = sc.map(c => c.split(';')[0]).join('; ');
        }
      } else if (webRes.headers?.get) {
        cookies = webRes.headers.get('set-cookie') || '';
      }
    } catch (e) {}

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
          timeZone: 'UTC',
          utcOffsetMinutes: 0
        },
      },
      videoId: ytId,
      playbackContext: {
        contentPlaybackContext: {
          html5Preference: 'HTML5_PREF_WANTS',
          signatureTimestamp: sts
        }
      },
      contentCheckOk: true,
      racyCheckOk: true
    };

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
      'X-Youtube-Client-Name': '101',
      'X-Youtube-Client-Version': '1.02',
      'Origin': 'https://www.youtube.com'
    };
    if (cookies) headers['Cookie'] = cookies;
    if (visitorData) headers['X-Goog-Visitor-Id'] = visitorData;

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
        // Prioritize official AAC (itag 140), then Opus (itag 251), then any audio
        const audio140 = formats.find(f => f.itag === 140 && f.url);
        const audio251 = formats.find(f => f.itag === 251 && f.url);
        const anyAudio = formats.find(f => f.mimeType?.startsWith('audio') && f.url);
        const chosen = audio140 || audio251 || anyAudio;
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
