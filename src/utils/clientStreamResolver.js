/**
 * Direct Client-Side YouTube Audio Stream Resolver via Innertube API
 * Zero-proxy, zero-delay direct client stream extraction.
 * Handles client contexts: VISIONOS, ANDROID_VR, ANDROID, WEB_EMBEDDED_PLAYER.
 */

const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

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
        const top = candidates[0];
        let dur = null;
        const durText = top.lengthText?.simpleText || top.lengthText?.runs?.[0]?.text || '';
        if (durText) {
          const parts = durText.split(':').map(p => parseInt(p, 10));
          if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) dur = parts[0] * 60 + parts[1];
          else if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) dur = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }

        return {
          videoId: top.videoId,
          title: top.title?.runs?.[0]?.text || '',
          duration: dur || targetDuration
        };
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

  try {
    let visitorData = '';
    let sts = 20744;

    if (cachedVisitorData && Date.now() - cachedVisitorTimestamp < VISITOR_CACHE_TTL) {
      visitorData = cachedVisitorData;
    }

    // Try fetching watch page if visitor data not yet cached
    if (!visitorData) {
      const pageController = new AbortController();
      const pageTimeout = setTimeout(() => pageController.abort(), 2500);
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

    // Client contexts: VISIONOS and ANDROID_VR provide direct non-ciphered stream URLs
    // followed by ANDROID and WEB_EMBEDDED_PLAYER
    const clientConfigs = [
      {
        name: 'VISIONOS',
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
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
          'X-Youtube-Client-Name': '101',
          'X-Youtube-Client-Version': '1.02',
          'Origin': 'https://www.youtube.com'
        }
      },
      {
        name: 'ANDROID_VR',
        client: {
          clientName: 'ANDROID_VR',
          clientVersion: '1.61.48',
          deviceMake: 'Oculus',
          deviceModel: 'Quest 3',
          osName: 'Android',
          osVersion: '12',
          hl: 'en',
          gl: 'US'
        },
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Quest 3) AppleWebKit/537.36 (KHTML, like Gecko) OculusBrowser/34.0.0.12 Chrome/122.0.6261.120 VR Safari/537.36',
          'X-Youtube-Client-Name': '28',
          'X-Youtube-Client-Version': '1.61.48'
        }
      },
      {
        name: 'ANDROID',
        client: {
          clientName: 'ANDROID',
          clientVersion: '19.29.35',
          androidSdkVersion: 30,
          osName: 'Android',
          osVersion: '11',
          hl: 'en',
          gl: 'US'
        },
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'com.google.android.youtube/19.29.35 (Linux; U; Android 11) gzip',
          'X-Youtube-Client-Name': '3',
          'X-Youtube-Client-Version': '19.29.35'
        }
      },
      {
        name: 'WEB_EMBEDDED_PLAYER',
        client: {
          clientName: 'WEB_EMBEDDED_PLAYER',
          clientVersion: '1.20240726.01.00',
          hl: 'en',
          gl: 'US'
        },
        thirdParty: {
          embedUrl: 'https://www.google.com'
        },
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'X-Youtube-Client-Name': '56',
          'X-Youtube-Client-Version': '1.20240726.01.00',
          'Origin': 'https://www.youtube.com'
        }
      }
    ];

    for (const cfg of clientConfigs) {
      if (signal?.aborted) return null;

      const playerController = new AbortController();
      const playerTimeout = setTimeout(() => playerController.abort(), 4000);
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
            // Prioritize official AAC (itag 140), then Opus (itag 251), then AAC-LC (itag 139), then any audio stream
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
 * Extracts video ID, searches if missing, and resolves direct stream.
 */
export async function resolveDirectYouTubeAudio(track, signal = null) {
  if (!track || signal?.aborted) return null;

  const targetUrl = track.resolvedAudioUrl || track.audioUrl || track.url || '';
  const trackId = String(track.id || track._id || '');

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

        return {
          url: directStream,
          duration,
          cover: track.cover || track.coverUrl || `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
          track: {
            ...track,
            duration,
            youtubeId: ytId
          }
        };
      }
    } catch (e) {
      if (signal?.aborted) return null;
    }
  }

  return null;
}
