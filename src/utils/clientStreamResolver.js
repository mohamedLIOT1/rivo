/**
 * Direct Client-Side YouTube Audio Stream Resolver via Innertube API
 * Zero-proxy, zero-delay direct client stream extraction.
 * Includes in-memory stream caching with TTL to guarantee instant (<1ms) playback starts.
 */

import { INNERTUBE_KEY, CLIENT_CONFIGS } from './streamClientConfigs';
import { calculateTitleSimilarity } from './titleSimilarity';

// ── In-Memory Stream Cache with TTL ──────────────────────────────────────────
const streamCache = new Map();
const STREAM_CACHE_TTL = 3 * 3600 * 1000; // 3 hours

export function getStreamFromCache(key) {
  if (!key) return null;
  const entry = streamCache.get(String(key));
  if (!entry) return null;
  if (Date.now() - (entry.timestamp || 0) > STREAM_CACHE_TTL) {
    streamCache.delete(String(key));
    return null;
  }
  return entry.data;
}

export function setStreamInCache(key, data) {
  if (!key || !data) return;
  streamCache.set(String(key), { data, timestamp: Date.now() });
}

export function clearStreamCache(key) {
  if (!key) return;
  streamCache.delete(String(key));
}

// In-memory visitor cache to speed up successive requests
let cachedVisitorData = '';
let cachedVisitorTimestamp = 0;
const VISITOR_CACHE_TTL = 12 * 3600 * 1000; // 12 hours

/**
 * Extracts YouTube 11-char video ID from various string formats (URL, embed, ID).
 */
export function extractYtId(input) {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();
  const urlMatch = str.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
  if (urlMatch && urlMatch[1] && urlMatch[1].length === 11) return urlMatch[1];
  const prefixMatch = str.match(/^yt[-_]?([a-zA-Z0-9_-]{11})$/i);
  if (prefixMatch && prefixMatch[1] && prefixMatch[1].length === 11) return prefixMatch[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) return str;
  return null;
}

/**
 * Fast client-side YouTube search via Innertube API (<300ms)
 */
export async function searchYouTubeClientSide(queryOrOptions, signal = null) {
  if (signal?.aborted) return null;

  let title = '';
  let artist = '';
  let targetDuration = null;

  if (queryOrOptions && typeof queryOrOptions === 'object') {
    title = queryOrOptions.title || '';
    artist = queryOrOptions.artist || '';
    targetDuration = Number(queryOrOptions.targetDuration || queryOrOptions.duration) || null;
    if (!title && queryOrOptions.query) {
      title = queryOrOptions.query;
    }
  } else if (typeof queryOrOptions === 'string') {
    title = queryOrOptions.trim();
  }

  const cleanArt = String(artist || '').replace(/["']/g, ' ').trim();
  const cleanTit = String(title || '')
    .replace(/\s*[-–—]\s*(من فيلم|فيلم|أغنية|كليب|فيديو كليب|official|video|audio|lyrics|lyric|remix|clip|ost).*$/i, '')
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/(?:ft\.?|feat\.?|featuring)\s+.*$/i, '')
    .replace(/["']/g, ' ')
    .trim();

  const queries = [];
  if (cleanArt && cleanTit) {
    queries.push(`${cleanArt} ${cleanTit} official audio`);
    queries.push(`${cleanArt} ${cleanTit}`);
    queries.push(`"${cleanArt}" "${cleanTit}"`);
  } else if (cleanTit) {
    queries.push(`${cleanTit} official audio`);
    queries.push(cleanTit);
  }

  if (queries.length === 0) return null;

  for (const q of queries) {
    if (signal?.aborted) return null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const onAbort = () => {
      clearTimeout(timeoutId);
      try { controller.abort(); } catch {}
    };

    if (signal) {
      if (signal.aborted) {
        clearTimeout(timeoutId);
        return null;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    try {
      const res = await fetch(`https://www.youtube.com/youtubei/v1/search?key=${INNERTUBE_KEY}`, {
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

      clearTimeout(timeoutId);
      if (signal && onAbort) signal.removeEventListener('abort', onAbort);

      if (!res.ok) continue;

      const d = await res.json();
      const contents = d?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
      const candidates = contents.map(c => c.videoRenderer).filter(v => v && v.videoId);

      if (candidates.length > 0) {
        const normTitle = cleanTit.toLowerCase();
        const normArtist = cleanArt.toLowerCase();

        let scored = candidates.map(v => {
          const candTitle = (v.title?.runs?.[0]?.text || '').toLowerCase();
          const candChannel = (v.ownerText?.runs?.[0]?.text || '').toLowerCase();
          let dur = null;
          const durText = v.lengthText?.simpleText || v.lengthText?.runs?.[0]?.text || '';
          if (durText) {
            const parts = durText.split(':').map(p => parseInt(p, 10));
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) dur = parts[0] * 60 + parts[1];
            else if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) dur = parts[0] * 3600 + parts[1] * 60 + parts[2];
          }

          let score = 0;
          const similarity = calculateTitleSimilarity(cleanTit, candTitle, cleanArt);
          score += Math.round(similarity * 60);

          let durationDiff = targetDuration && dur > 0 ? Math.abs(dur - targetDuration) : null;
          if (durationDiff !== null) {
            if (durationDiff <= 5) score += 60;
            else if (durationDiff <= 15) score += 40;
            else if (durationDiff <= 25) score += 10;
            else score -= 200;
          }

          if (normTitle && candTitle.includes(normTitle)) score += 30;
          if (normArtist && (candTitle.includes(normArtist) || candChannel.includes(normArtist))) score += 30;

          if (candChannel.includes('topic')) {
            if (normArtist && (candChannel.includes(normArtist) || candTitle.includes(normArtist))) score += 90;
            else if (normArtist) score -= 150;
            else score += 20;
          } else if (candChannel.includes('official') || candChannel.includes('vevo')) {
            score += 30;
          }

          if (candTitle.includes('official audio') || candTitle.includes('audio')) score += 50;

          // Penalize concerts/compilations when searching a normal track
          const isComp = /(?:كاملة|حفلة\s*كاملة|ألبوم\s*كامل|سهرة|تجميعة|ميدلي|medley|full\s*concert|full\s*live|full\s*album)/i.test(candTitle);
          if (isComp) score -= 400;

          if (dur > 600 && (!targetDuration || targetDuration < 600)) score -= 500;

          return {
            videoId: v.videoId,
            title: v.title?.runs?.[0]?.text || '',
            duration: dur || targetDuration,
            score,
            similarity
          };
        });

        // Filter valid candidates
        scored = scored.filter(c => {
          if ((!targetDuration || targetDuration < 600) && c.duration && c.duration > 660) return false;
          if (cleanTit && c.similarity < 0.25) return false;
          return true;
        });

        scored.sort((a, b) => b.score - a.score);
        if (scored.length > 0 && scored[0].score > -100) {
          return {
            videoId: scored[0].videoId,
            title: scored[0].title,
            duration: scored[0].duration
          };
        }
      }
    } catch (e) {
      clearTimeout(timeoutId);
      if (signal && onAbort) signal.removeEventListener('abort', onAbort);
      if (signal?.aborted) return null;
    }
  }

  return null;
}

/**
 * Resolves direct playable audio URL for a YouTube video ID using Innertube API.
 * Uses fallback across VISIONOS, ANDROID_VR, ANDROID, and WEB_EMBEDDED_PLAYER contexts.
 */
export async function resolveClientSideYouTubeStream(ytId, signal = null) {
  if (!ytId || signal?.aborted) return null;

  // 1. Check in-memory stream cache first (<1ms)
  const cached = getStreamFromCache(ytId);
  if (cached) return cached;

  try {
    let visitorData = '';
    let sts = 20744;

    if (cachedVisitorData && Date.now() - cachedVisitorTimestamp < VISITOR_CACHE_TTL) {
      visitorData = cachedVisitorData;
    }

    // Try fetching watch page if visitor data not yet cached
    if (!visitorData) {
      const pageController = new AbortController();
      const pageTimeout = setTimeout(() => pageController.abort(), 2000);
      const onPageAbort = () => {
        clearTimeout(pageTimeout);
        try { pageController.abort(); } catch {}
      };

      if (signal) {
        if (signal.aborted) {
          clearTimeout(pageTimeout);
          return null;
        }
        signal.addEventListener('abort', onPageAbort, { once: true });
      }

      try {
        const pageRes = await fetch(`https://www.youtube.com/watch?v=${ytId}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
          },
          signal: pageController.signal
        });
        clearTimeout(pageTimeout);
        if (signal && onPageAbort) signal.removeEventListener('abort', onPageAbort);

        if (pageRes.ok) {
          const html = await pageRes.text();
          const vm = html.match(/"VISITOR_DATA":"([^"]+)"/);
          if (vm && vm[1]) {
            visitorData = vm[1];
            cachedVisitorData = visitorData;
            cachedVisitorTimestamp = Date.now();
          }
          const sm = html.match(/"signatureTimestamp":(\d+)/);
          if (sm && sm[1]) {
            sts = parseInt(sm[1], 10);
          }
        }
      } catch (e) {
        clearTimeout(pageTimeout);
        if (signal && onPageAbort) signal.removeEventListener('abort', onPageAbort);
      }
    }

    if (signal?.aborted) return null;

    for (const cfg of CLIENT_CONFIGS) {
      if (signal?.aborted) return null;

      const playerController = new AbortController();
      const playerTimeout = setTimeout(() => playerController.abort(), 3500);
      const onPlayerAbort = () => {
        clearTimeout(playerTimeout);
        try { playerController.abort(); } catch {}
      };

      if (signal) {
        if (signal.aborted) {
          clearTimeout(playerTimeout);
          return null;
        }
        signal.addEventListener('abort', onPlayerAbort, { once: true });
      }

      try {
        const playerBody = {
          context: { client: cfg.client },
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

        const headers = { ...cfg.headers };
        if (visitorData) headers['X-Goog-Visitor-Id'] = visitorData;

        const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${INNERTUBE_KEY}&prettyPrint=false`, {
          method: 'POST',
          headers,
          body: JSON.stringify(playerBody),
          signal: playerController.signal
        });

        clearTimeout(playerTimeout);
        if (signal && onPlayerAbort) signal.removeEventListener('abort', onPlayerAbort);

        if (res.ok) {
          const data = await res.json();
          if (data?.playabilityStatus?.status === 'OK') {
            const formats = (data.streamingData?.adaptiveFormats || []).concat(data.streamingData?.formats || []);
            const audio140 = formats.find(f => f.itag === 140 && f.url);
            const audio251 = formats.find(f => f.itag === 251 && f.url);
            const audio139 = formats.find(f => f.itag === 139 && f.url);
            const anyAudio = formats.find(f => (f.mimeType?.startsWith('audio') || f.mimeType?.includes('audio')) && f.url);
            const chosen = audio140 || audio251 || audio139 || anyAudio || formats.find(f => f.url);

            if (chosen?.url) {
              const rawSec = parseInt(data.videoDetails?.lengthSeconds, 10);
              const rawMs = parseInt(chosen.approxDurationMs, 10);
              const durationSec = (rawSec && !isNaN(rawSec) && rawSec > 0)
                ? rawSec
                : (rawMs && !isNaN(rawMs) && rawMs > 0 ? Math.round(rawMs / 1000) : null);

              const result = {
                url: chosen.url,
                duration: durationSec,
                contentLength: chosen.contentLength ? parseInt(chosen.contentLength, 10) : null,
                title: data.videoDetails?.title || null,
                author: data.videoDetails?.author || null,
                toString() { return this.url; }
              };

              setStreamInCache(ytId, result);
              return result;
            }
          }
        }
      } catch (err) {
        clearTimeout(playerTimeout);
        if (signal && onPlayerAbort) signal.removeEventListener('abort', onPlayerAbort);
        if (signal?.aborted) return null;
      }
    }
  } catch (err) {}

  return null;
}

/**
 * High-level YouTube stream resolver for a Track object.
 * Extracts video ID, searches if missing, and resolves direct stream with caching.
 */
export async function resolveDirectYouTubeAudio(track, signal = null) {
  if (!track || signal?.aborted) return null;

  const trackId = String(track.id || track._id || '');
  const cachedTrack = getStreamFromCache(trackId);
  if (cachedTrack) {
    return {
      url: cachedTrack.url,
      duration: cachedTrack.duration || track.duration,
      cover: track.cover || track.coverUrl,
      track: { ...track, duration: cachedTrack.duration || track.duration }
    };
  }

  const targetUrl = track.resolvedAudioUrl || track.audioUrl || track.url || '';

  let ytId = extractYtId(track.youtubeId) ||
             extractYtId(targetUrl) ||
             extractYtId(track.audioUrl) ||
             extractYtId(track.url) ||
             extractYtId(trackId);

  // If no explicit YouTube ID, perform ultra-fast client-side search via Innertube
  if (!ytId && (track.title || track.artist)) {
    try {
      const searchRes = await searchYouTubeClientSide({
        title: track.title,
        artist: track.artist,
        targetDuration: track.duration
      }, signal);
      if (searchRes?.videoId) {
        ytId = searchRes.videoId;
        if (searchRes.duration && !track.duration) {
          track.duration = searchRes.duration;
        }
      }
    } catch (e) {}
  }

  if (ytId && !signal?.aborted) {
    try {
      const directResult = await resolveClientSideYouTubeStream(ytId, signal);
      const directStream = typeof directResult === 'string' ? directResult : directResult?.url;
      if (directStream) {
        const duration = (directResult?.duration && directResult.duration > 0)
          ? directResult.duration
          : (Number(track.duration) || 210);

        const resultObj = {
          url: directStream,
          duration,
          cover: track.cover || track.coverUrl || `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
          track: {
            ...track,
            duration,
            youtubeId: ytId
          }
        };

        if (trackId) setStreamInCache(trackId, resultObj);
        return resultObj;
      }
    } catch (e) {
      if (signal?.aborted) return null;
    }
  }

  return null;
}
