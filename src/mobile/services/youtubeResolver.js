/**
 * YouTube to Direct Stream URL Resolver for Liofy Mobile
 * Optimized for speed using Parallel Racing and reliable instances.
 */

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.privacydev.net',
  'https://pipedapi.palvelu.org',
  'https://pipedapi.adminforge.de',
  'https://pipedapi.syra.net'
];

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://yewtu.be',
  'https://yt.artemislena.eu',
  'https://invidious.nerdvpn.de'
];

export function extractVideoId(urlOrId) {
  if (!urlOrId) return null;
  const match = urlOrId.match(/(?:v=|\/|embed\/|shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : (urlOrId.length === 11 ? urlOrId : null);
}

async function fetchWithTimeout(url, options = {}, timeout = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

export async function resolveYouTubeStream(urlOrId) {
  const videoId = extractVideoId(urlOrId);
  if (!videoId) return null;

  console.log(`[YouTubeResolver] Resolving for ${videoId}...`);

  // 1. Race Cobalt Endpoints (Highly Reliable)
  const cobaltEndpoints = [
    'https://api.cobalt.tools/api/json',
    'https://cobalt.stream/api/json',
    'https://co.wuk.sh/api/json'
  ];

  try {
    const cobaltPromises = cobaltEndpoints.map(ep =>
      fetchWithTimeout(ep, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36'
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          downloadMode: 'audio',
          audioFormat: 'mp3',
          isAudioOnly: true
        })
      }, 6000)
      .then(async res => {
        if (res.ok) {
          const data = await res.json();
          const url = data.url || data.audio || (data.picker && data.picker[0]?.url);
          if (url && url.startsWith('http')) return url;
        }
        throw new Error('No valid URL');
      })
    );
    return await Promise.any(cobaltPromises);
  } catch (e) {
    console.log(`[YouTubeResolver] Cobalt failed, trying Piped/Invidious`);
  }

  // 2. Simultaneous Piped Scan
  try {
    const pipedPromises = PIPED_INSTANCES.map(base =>
      fetchWithTimeout(`${base}/streams/${videoId}`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      }, 6000)
      .then(async res => {
        if (res.ok) {
          const data = await res.json();
          const audio = data.audioStreams?.find(s => s.mimeType?.includes('audio/mp4')) || data.audioStreams?.[0];
          if (audio?.url) return audio.url;
        }
        throw new Error('Fail');
      })
    );
    return await Promise.any(pipedPromises);
  } catch (e) {}

  return null;
}
