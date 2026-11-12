import { API_BASE_URL } from '../../config';
import { getOfflineTrackAudioUrl } from '../../utils/offlineStorage';
import { isRadioTrack } from '../../utils/quranUtils';
import { normalizeCoverUrl } from '../../utils/coverUtils';
import { resolveDirectYouTubeAudio } from '../../utils/clientStreamResolver';
import { sanitizeDuration, resolveVocalOnlyStream } from './webVocalResolver';

export { sanitizeDuration };

// ── Client-side Stream Cache (Instant 0ms repeated playbacks) ──
export const clientStreamCache = new Map();
const activeFullTrackCache = new Map();
const CLIENT_CACHE_TTL = 3 * 3600 * 1000; // 3 hours

export function clearAllTrackBlobCache() {
  activeFullTrackCache.forEach((url) => {
    if (url && url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }
  });
  activeFullTrackCache.clear();
}

export function clearStreamCacheForTrack(trackId) {
  if (!trackId) return;
  const tid = String(trackId);
  clientStreamCache.delete(tid);
  clientStreamCache.delete(`${tid}_vocal`);
}

function buildTimedFetchSignal(parentSignal, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    try {
      controller.abort();
    } catch {}
  }, timeoutMs);

  const onParentAbort = () => {
    clearTimeout(timeoutId);
    try {
      controller.abort();
    } catch {}
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      clearTimeout(timeoutId);
      try {
        controller.abort();
      } catch {}
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      if (parentSignal) parentSignal.removeEventListener('abort', onParentAbort);
    },
  };
}

export async function resolvePlayableAudioStream(track, signal = null, isPrefetch = false, isRetryAlt = false) {
  if (!track || signal?.aborted) return null;
  const isVocalOnly = typeof window !== 'undefined' && localStorage.getItem('rivo_vocal_only') === 'true';
  const trackId = String(track.id || track._id || '');
  const cacheKey = isVocalOnly ? `${trackId}_vocal` : trackId;

  if (!isRetryAlt && cacheKey && clientStreamCache.has(cacheKey)) {
    const cached = clientStreamCache.get(cacheKey);
    if (Date.now() - cached.timestamp < CLIENT_CACHE_TTL) {
      return cached.data;
    }
    clientStreamCache.delete(cacheKey);
  } else if (isRetryAlt && cacheKey) {
    clientStreamCache.delete(cacheKey);
  }

  const result = await doResolvePlayableAudioStream(track, signal, isVocalOnly, isPrefetch, isRetryAlt);
  if (!isRetryAlt && cacheKey && result?.url) {
    clientStreamCache.set(cacheKey, { data: result, timestamp: Date.now() });
    try {
      if (typeof window !== 'undefined' && result.url.startsWith('http')) {
        const preloader = new Audio();
        preloader.preload = 'auto';
        preloader.src = result.url;
      }
    } catch {}
  }
  return result;
}

/**
 * Direct Audio Stream Resolver for HTML5 <audio> and Web Audio API.
 */
export async function doResolvePlayableAudioStream(
  track,
  signal = null,
  isVocalOnly = false,
  isPrefetch = false,
  isRetryAlt = false
) {
  if (!track || signal?.aborted) return null;
  const trackId = String(track.id || track._id || '');
  let targetUrl =
    track.resolvedAudioUrl ||
    track.audioUrl ||
    (track.youtubeId ? `https://www.youtube.com/watch?v=${track.youtubeId}` : '');

  if (isRetryAlt) {
    if (track.fallbackUrl) {
      targetUrl = track.fallbackUrl;
    } else if (targetUrl.includes('qurango.net/radio')) {
      targetUrl = targetUrl.replace('qurango.net/radio', 'backup.qurango.net/radio');
    } else if (targetUrl.includes('backup.qurango.net/radio')) {
      targetUrl = targetUrl.replace('backup.qurango.net/radio', 'qurango.net/radio');
    } else {
      targetUrl = '';
    }
  }

  // Direct Live / Quran Radio stream handling
  if (track.isRadio || track.isLive || isRadioTrack(track)) {
    const radioStream = isRetryAlt && track.fallbackUrl ? track.fallbackUrl : targetUrl || track.audioUrl;
    if (radioStream) {
      const fullUrl = radioStream.startsWith('/') ? `${API_BASE_URL}${radioStream}` : radioStream;
      return {
        url: fullUrl,
        duration: Infinity,
        cover: normalizeCoverUrl(track.cover || track.coverUrl),
        isLive: true,
        isRadio: true,
        isQuran: true,
      };
    }
  }

  // Vocal-Only Mode: check and stream isolated vocal stem
  if (isVocalOnly) {
    const vocalResult = await resolveVocalOnlyStream(track, targetUrl, signal, isPrefetch);
    if (vocalResult?.url) return vocalResult;
    if (signal?.aborted) return null;
  }

  // 1. Prioritize offline storage / IndexedDB
  try {
    const offlineBlob = await getOfflineTrackAudioUrl(trackId, track.title, track.artist);
    if (offlineBlob) {
      return {
        url: offlineBlob,
        duration: sanitizeDuration(track.duration, 210),
        cover: track.cover || track.coverUrl,
        isOffline: true,
      };
    }
  } catch {}
  if (signal?.aborted) return null;

  // 2. Local device files (Capacitor / native files) or Blobs
  const isBlobUrl = targetUrl.startsWith('blob:') || targetUrl.startsWith('data:');
  const isLocalNativeUrl =
    targetUrl &&
    (targetUrl.includes('/_capacitor_file_/') ||
      targetUrl.includes('capacitor://') ||
      targetUrl.startsWith('file://') ||
      targetUrl.startsWith('content://') ||
      (targetUrl.startsWith('http://localhost') && !targetUrl.includes(':5000')));

  if (isBlobUrl || isLocalNativeUrl) {
    return {
      url: targetUrl,
      duration: sanitizeDuration(track.duration, 210),
      cover: track.cover || track.coverUrl,
    };
  }

  // 2b. Direct server-uploaded audio files
  if (
    track.source === 'Upload' ||
    (targetUrl && (targetUrl.startsWith('/uploads/') || targetUrl.includes('/uploads/') || targetUrl.startsWith('/mix-demo/')))
  ) {
    const fullUrl = targetUrl.startsWith('/')
      ? `${API_BASE_URL}${targetUrl}`
      : targetUrl.startsWith('http')
      ? targetUrl
      : `${API_BASE_URL}/${targetUrl}`;
    return {
      url: fullUrl,
      duration: sanitizeDuration(track.duration, 210),
      cover: track.cover || track.coverUrl,
    };
  }

  // 2c. Direct HTTP audio stream URL
  if (
    !isRetryAlt &&
    targetUrl &&
    (targetUrl.startsWith('http://') || targetUrl.startsWith('https://')) &&
    !targetUrl.includes('youtube.com/watch') &&
    !targetUrl.includes('youtu.be/') &&
    !targetUrl.includes('googlevideo.com') &&
    !targetUrl.includes('/api/tracks/stream-proxy')
  ) {
    return {
      url: targetUrl,
      duration: sanitizeDuration(track.duration, 210),
      cover: track.cover || track.coverUrl,
    };
  }

  // 3. Native mobile device client-side stream resolution
  if (typeof window !== 'undefined' && typeof window.RIVO_RESOLVE_STREAM === 'function') {
    try {
      const nativeStreamPromise = new Promise((resolve) => {
        let timeoutTimer = null;
        const onResolved = (ev) => {
          if (ev.detail && (ev.detail.trackId === trackId || (trackId && ev.detail.trackId?.includes(trackId)))) {
            if (timeoutTimer) clearTimeout(timeoutTimer);
            window.removeEventListener('rivo-receive-resolved-stream', onResolved);
            resolve({
              url: ev.detail.url || null,
              duration: ev.detail.duration ? sanitizeDuration(ev.detail.duration) : null,
            });
          }
        };
        window.addEventListener('rivo-receive-resolved-stream', onResolved);
        timeoutTimer = setTimeout(() => {
          window.removeEventListener('rivo-receive-resolved-stream', onResolved);
          resolve(null);
        }, 3000);
      });
      window.RIVO_RESOLVE_STREAM(track);
      const resolvedData = await nativeStreamPromise;
      if (resolvedData?.url) {
        return {
          url: resolvedData.url,
          duration: resolvedData.duration || sanitizeDuration(track.duration, 210),
          cover: track.cover || track.coverUrl,
        };
      }
    } catch {}
  }
  if (signal?.aborted) return null;

  // 4. Already a direct stream proxy URL
  if (!isRetryAlt && targetUrl && (targetUrl.includes('/api/tracks/stream-proxy') || targetUrl.includes('/api/proxy-audio'))) {
    const fullUrl = targetUrl.startsWith('/') ? `${API_BASE_URL}${targetUrl}` : targetUrl;
    return {
      url: fullUrl,
      duration: sanitizeDuration(track.duration, 210),
      cover: track.cover || track.coverUrl,
    };
  }

  const qTitle = encodeURIComponent(track.title || '');
  const qArtist = encodeURIComponent(track.artist || '');
  const qAlbum = encodeURIComponent(track.album || '');
  const qDuration = encodeURIComponent(track.duration || '');
  const retryParam = isRetryAlt ? '&retryAlt=1' : '';

  // 5. Direct backend audio stream endpoint (fast 5000ms timeout)
  const backendTimer = buildTimedFetchSignal(signal, 5000);
  try {
    const sRes = await fetch(
      `${API_BASE_URL}/api/tracks/${encodeURIComponent(trackId || 'stream')}/stream?url=${encodeURIComponent(targetUrl)}&title=${qTitle}&artist=${qArtist}&album=${qAlbum}&duration=${qDuration}${retryParam}`,
      { signal: backendTimer.signal }
    );
    backendTimer.cleanup();

    if (sRes.ok) {
      const sData = await sRes.json();
      let cand = sData?.url || sData?.directUrl;
      if (cand && !cand.includes('youtube.com/watch') && !cand.includes('youtu.be/')) {
        if (cand.startsWith('/')) cand = `${API_BASE_URL}${cand}`;
        return {
          url: cand,
          duration: sanitizeDuration(sData.duration || track.duration, 210),
          cover: normalizeCoverUrl(track.cover || track.coverUrl || sData.cover),
          track: sData.track || null,
        };
      }
    }
  } catch {
    backendTimer.cleanup();
    if (signal?.aborted) return null;
  }

  // 5b. Direct client-side YouTube stream resolution fallback
  if (!signal?.aborted) {
    try {
      const clientDirectStream = await resolveDirectYouTubeAudio(track, signal);
      if (clientDirectStream?.url) {
        return {
          url: clientDirectStream.url,
          duration: sanitizeDuration(clientDirectStream.duration || track.duration, 210),
          cover: normalizeCoverUrl(clientDirectStream.cover || track.cover || track.coverUrl),
          track: clientDirectStream.track || null,
        };
      }
    } catch {
      if (signal?.aborted) return null;
    }
  }

  // 6. Direct backend resolve-stream fallback
  if (!signal?.aborted) {
    const resolveTimer = buildTimedFetchSignal(signal, 5000);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/tracks/resolve-stream?stream=true&title=${qTitle}&artist=${qArtist}&url=${encodeURIComponent(targetUrl)}&id=${encodeURIComponent(trackId)}&album=${qAlbum}&duration=${qDuration}${retryParam}`,
        { signal: resolveTimer.signal }
      );
      resolveTimer.cleanup();

      if (res.ok) {
        const d = await res.json();
        if (d.success && d.url && !d.url.includes('youtube.com/watch') && !d.url.includes('youtu.be/')) {
          let cand = d.url;
          if (cand.startsWith('/')) cand = `${API_BASE_URL}${cand}`;
          return {
            url: cand,
            duration: sanitizeDuration(d.duration || track.duration, 210),
            cover: normalizeCoverUrl(track.cover || track.coverUrl || d.cover),
            track: d.track || null,
          };
        }
      }
    } catch {
      resolveTimer.cleanup();
      if (signal?.aborted) return null;
    }
  }

  // 7. Last-resort fallback for plain mp3/m4a URLs
  if (targetUrl && (targetUrl.endsWith('.mp3') || targetUrl.endsWith('.m4a'))) {
    const proxied =
      targetUrl.startsWith('http') && !targetUrl.includes('/api/proxy-audio')
        ? `${API_BASE_URL}/api/proxy-audio?url=${encodeURIComponent(targetUrl)}`
        : targetUrl;
    return {
      url: proxied,
      duration: sanitizeDuration(track.duration, 210),
      cover: track.cover || track.coverUrl,
    };
  }

  return null;
}
