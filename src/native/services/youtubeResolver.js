import { isQuranContent, isRadioTrack } from '../../utils/quranUtils';
import * as FileSystem from 'expo-file-system';
import NetInfo from '@react-native-community/netinfo';
import { API_BASE_URL } from '../config';
import { INNERTUBE_KEY, CLIENT_CONFIGS } from '../../utils/streamClientConfigs';

const streamCache = new Map();
const streamDurationCache = new Map();
const trackToYoutubeIdMap = new Map();
const STREAM_CACHE_TTL = 3 * 3600 * 1000; // 3 hours
const STREAM_EXPIRY_BUFFER_SEC = 180; // Reject cached URLs within 3 minutes of expiry

/**
 * Sanitizes a track duration into whole seconds, handling ms-vs-sec mismatches and invalid values.
 */
export function sanitizeDuration(val, fallback = null) {
  if (val === undefined || val === null || val === '') return fallback;
  const num = Number(val);
  if (!isFinite(num) || isNaN(num) || num <= 0) return fallback;
  // Convert millisecond values (> 86400s / 24h) to seconds without breaking multi-hour recitations
  if (num > 86400) {
    const inSec = Math.round(num / 1000);
    if (inSec > 0 && inSec <= 86400) return inSec;
    return fallback;
  }
  return Math.round(num);
}

/**
 * Checks whether a stream URL (direct GoogleVideo or proxied stream URL) is empty, expired,
 * or within `bufferSeconds` of its `expire=` / `exp=` Unix timestamp.
 */
export function isStreamUrlLikelyExpired(url, bufferSeconds = STREAM_EXPIRY_BUFFER_SEC) {
  if (!url || typeof url !== 'string') return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('file://') || trimmed.startsWith('content://')) return false;

  const candidates = [trimmed];
  let decoded = trimmed;
  for (let i = 0; i < 2; i++) {
    try {
      const next = decodeURIComponent(decoded);
      if (next && next !== decoded) {
        candidates.push(next);
        decoded = next;
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  const nowMs = Date.now();
  const bufferMs = Math.max(0, Number(bufferSeconds) || 0) * 1000;
  for (const cand of candidates) {
    const matches = cand.matchAll(/[?&#](?:expire|exp)=([0-9]{9,13})(?:&|#|$)/gi);
    for (const match of matches) {
      const rawExp = Number(match[1]);
      if (!isFinite(rawExp) || rawExp <= 0) continue;
      const expMs = rawExp < 1e12 ? rawExp * 1000 : rawExp;
      if (expMs <= nowMs + bufferMs) {
        return true;
      }
    }
  }
  return false;
}

const isWatchPageUrl = (url) =>
  typeof url === 'string' && (url.includes('youtube.com/watch') || url.includes('youtu.be/'));

const applyValidatedDuration = (track, trackId, resolvedDurRaw) => {
  const existingValid = sanitizeDuration(track?.duration, null);
  const resolvedValid = sanitizeDuration(resolvedDurRaw, null);
  if (!resolvedValid) {
    if (existingValid && trackId) streamDurationCache.set(trackId, existingValid);
    if (existingValid && track && track.duration !== existingValid) {
      track.duration = existingValid;
    }
    return existingValid;
  }
  // Never overwrite a valid known duration (> 10s) with a tiny placeholder (< 5s)
  const finalDur = (existingValid && existingValid > 10 && resolvedValid < 5)
    ? existingValid
    : resolvedValid;
  if (trackId) streamDurationCache.set(trackId, finalDur);
  if (track && finalDur > 0) track.duration = finalDur;
  return finalDur;
};

const withChainedAbort = async (parentSignal, timeoutMs, fn) => {
  if (parentSignal?.aborted) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    try { controller.abort(); } catch {}
  }, timeoutMs);
  const onParentAbort = () => {
    clearTimeout(timeoutId);
    try { controller.abort(); } catch {}
  };
  if (parentSignal?.addEventListener) {
    parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }
  try {
    if (parentSignal?.aborted) return null;
    return await fn(controller.signal);
  } finally {
    clearTimeout(timeoutId);
    if (parentSignal?.removeEventListener) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  }
};

export const getStreamFromCache = (trackId) => {
  if (!trackId) return null;
  const key = String(trackId);
  const entry = streamCache.get(key);
  if (!entry) return null;
  const url = typeof entry === 'object' && entry !== null ? entry.url : (typeof entry === 'string' ? entry : null);
  const timestamp = typeof entry === 'object' && entry !== null ? (entry.timestamp || 0) : 0;
  if (!url || isWatchPageUrl(url) || (timestamp && Date.now() - timestamp > STREAM_CACHE_TTL) || isStreamUrlLikelyExpired(url)) {
    streamCache.delete(key);
    return null;
  }
  return url;
};

export const getStreamDurationFromCache = (trackId) => {
  if (!trackId) return null;
  return streamDurationCache.get(String(trackId)) || null;
};

export const clearStreamCache = (trackId, youtubeId = null) => {
  let resolvedTrackId = trackId;
  let resolvedYtId = youtubeId;
  if (trackId && typeof trackId === 'object') {
    resolvedYtId = resolvedYtId || trackId.youtubeId || extractYouTubeId(trackId.audioUrl || trackId.url);
    resolvedTrackId = trackId._id || trackId.id || '';
  }

  const keysToDelete = new Set();
  const urlsToInvalidate = new Set();

  const addKeyAndVariants = (rawKey) => {
    if (!rawKey) return;
    const str = String(rawKey).trim();
    if (!str) return;
    keysToDelete.add(str);
    keysToDelete.add(`${str}_vocal`);
    const extracted = extractYouTubeId(str);
    if (extracted) {
      keysToDelete.add(extracted);
      keysToDelete.add(`${extracted}_vocal`);
    }
  };

  if (resolvedTrackId) {
    const idStr = String(resolvedTrackId).trim();
    addKeyAndVariants(idStr);
    const mappedYt = trackToYoutubeIdMap.get(idStr);
    if (mappedYt) {
      addKeyAndVariants(mappedYt);
      trackToYoutubeIdMap.delete(idStr);
    }
  }

  if (resolvedYtId) {
    addKeyAndVariants(resolvedYtId);
  }

  for (const key of Array.from(keysToDelete)) {
    const entry = streamCache.get(key);
    const cachedUrl = typeof entry === 'object' && entry !== null ? entry.url : entry;
    if (cachedUrl && typeof cachedUrl === 'string' && !cachedUrl.startsWith('file://') && !cachedUrl.startsWith('content://')) {
      urlsToInvalidate.add(cachedUrl);
      const vidMatch = cachedUrl.match(/[?&]videoId=([a-zA-Z0-9_-]{11})/i);
      if (vidMatch?.[1]) {
        addKeyAndVariants(vidMatch[1]);
      }
    }
  }

  for (const key of keysToDelete) {
    streamCache.delete(key);
    streamDurationCache.delete(key);
  }

  if (urlsToInvalidate.size > 0) {
    for (const [k, entry] of streamCache.entries()) {
      const entryUrl = typeof entry === 'object' && entry !== null ? entry.url : entry;
      if (entryUrl && urlsToInvalidate.has(entryUrl)) {
        streamCache.delete(k);
      }
    }
  }
};

export const setStreamInCache = (key, url) => {
  if (!key || !url || typeof url !== 'string') return;
  const trimmed = url.trim();
  if (!trimmed || isWatchPageUrl(trimmed) || isStreamUrlLikelyExpired(trimmed)) return;
  streamCache.set(String(key), { url: trimmed, timestamp: Date.now() });
};

let cachedVisitorData = '';
let cachedVisitorTimestamp = 0;
let cachedSignatureTimestamp = 20744;
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

const resolveValidCachedStream = async (cacheKey, skipLocal, signal) => {
  if (!cacheKey || signal?.aborted) return null;
  const cachedEntry = streamCache.get(cacheKey);
  if (!cachedEntry) return null;
  const cachedUrl = typeof cachedEntry === 'object' && cachedEntry !== null ? cachedEntry.url : cachedEntry;
  const cachedTime = typeof cachedEntry === 'object' && cachedEntry !== null ? (cachedEntry.timestamp || 0) : 0;

  if (!cachedUrl || typeof cachedUrl !== 'string') {
    streamCache.delete(cacheKey);
    return null;
  }

  if (cachedUrl.startsWith('file://')) {
    if (skipLocal) return null;
    try {
      const info = await FileSystem.getInfoAsync(cachedUrl);
      if (signal?.aborted) return null;
      if (info.exists && info.size > 10000) return cachedUrl;
    } catch {}
    streamCache.delete(cacheKey);
    return null;
  }

  if (
    isWatchPageUrl(cachedUrl) ||
    (cachedTime && Date.now() - cachedTime > STREAM_CACHE_TTL) ||
    isStreamUrlLikelyExpired(cachedUrl)
  ) {
    streamCache.delete(cacheKey);
    return null;
  }

  return cachedUrl;
};

/**
 * Resolves a playable direct audio URL for a given track.
 * 1. Checks local offline storage.
 * 2. Checks direct stream URLs.
 * 3. Resolves authentic official YouTube stream via backend proxy.
 * 4. Resolves via server stream resolver.
 */
export const resolveAudioStream = async (track, isVocalOnly = false, onVocalStatus = null, signal = null) => {
  if (!track) return null;

  if (!signal && (track?._abortSignal || track?.signal)) {
    signal = track._abortSignal || track.signal;
  }

  if (signal && signal.aborted) {
    if (typeof onVocalStatus === 'function') onVocalStatus(null);
    return null;
  }

  const trackId = String(track._id || track.id || '');
  const earlyYtId = extractYouTubeId(track.youtubeId || track.audioUrl || track.url);
  if (trackId && earlyYtId) {
    trackToYoutubeIdMap.set(trackId, earlyYtId);
  }

  if (track.isRetry || track._clearCache) {
    clearStreamCache(trackId, earlyYtId);
  }

  const skipLocal = Boolean(track._skipLocal);
  const bypassCache = Boolean(track.isRetry || track._clearCache);
  const cacheKey = (isVocalOnly && !isQuranContent(track)) ? `${trackId}_vocal` : trackId;

  if (!bypassCache && cacheKey) {
    const cachedHit = await resolveValidCachedStream(cacheKey, skipLocal, signal);
    if (signal?.aborted) {
      if (typeof onVocalStatus === 'function') onVocalStatus(null);
      return null;
    }
    if (cachedHit) return cachedHit;
  }

  // Also check direct ytId cache
  if (!bypassCache && earlyYtId && !isVocalOnly) {
    const ytHit = await resolveValidCachedStream(earlyYtId, skipLocal, signal);
    if (signal?.aborted) {
      if (typeof onVocalStatus === 'function') onVocalStatus(null);
      return null;
    }
    if (ytHit) {
      if (trackId) setStreamInCache(trackId, ytHit);
      return ytHit;
    }
  }

  const rawUrl = track.audioUrl || (track.youtubeId ? `https://www.youtube.com/watch?v=${track.youtubeId}` : '');
  const rawTitle = (track.title || '').trim();
  const rawArtist = (track.artist || '').trim();
  const { cleanTitle, cleanArtist } = getCleanQueries(rawTitle, rawArtist);

  // 1. Vocal-Only Mode: check and stream isolated vocal stem FIRST
  // Strictly prevent playing standard music/audio when user has Vocal-Only mode enabled
  if (isVocalOnly && !isQuranContent(track)) {
    try {
      const qTitle = encodeURIComponent(cleanTitle || rawTitle || '');
      const qArtist = encodeURIComponent(cleanArtist || rawArtist || '');
      const qDur = encodeURIComponent(sanitizeDuration(track.duration, '') || '');
      const qUrl = encodeURIComponent(rawUrl || '');

      // 1a. Check if stem is already ready
      const statusData = await withChainedAbort(signal, 5000, async (reqSignal) => {
        const res = await fetch(
          `${API_BASE_URL}/api/tracks/vocal-status?id=${encodeURIComponent(trackId)}&url=${qUrl}&title=${qTitle}&artist=${qArtist}`,
          { signal: reqSignal }
        );
        return res.ok ? await res.json() : null;
      }).catch(() => null);

      if (signal?.aborted) {
        if (typeof onVocalStatus === 'function') onVocalStatus(null);
        return null;
      }

      if (statusData?.status === 'ready' && statusData.url) {
        if (typeof onVocalStatus === 'function') onVocalStatus(null);
        const fullVocalUrl = statusData.url.startsWith('/') ? `${API_BASE_URL}${statusData.url}` : statusData.url;
        if (cacheKey) setStreamInCache(cacheKey, fullVocalUrl);
        return fullVocalUrl;
      }

      // 1b. Not ready: notify UI with real-time progress banner (skip if failed)
      if (typeof onVocalStatus === 'function') {
        if (statusData?.status === 'failed') {
          onVocalStatus(null);
        } else {
          const initialProg = Math.min(80, statusData?.progress || 10);
          onVocalStatus({
            isProcessing: true,
            trackTitle: track.title,
            progress: initialProg,
            eta: statusData?.eta || `Isolating vocals... ${initialProg}%`
          });
        }
      }

      // 1c. Trigger priority isolation on server
      fetch(
        `${API_BASE_URL}/api/tracks/vocal-stream?id=${encodeURIComponent(trackId)}&url=${qUrl}&title=${qTitle}&artist=${qArtist}&duration=${qDur}&json=1&priority=1`,
        signal ? { signal } : undefined
      ).catch(() => {});

      // 1d. Poll every 1.4s until ready (max 6 attempts / ~8.4s before smooth fallback to standard audio)
      let pollAttempts = 0;
      let displayProgress = Math.max(12, statusData?.status === 'failed' ? 12 : (statusData?.progress || 12));
      while (pollAttempts < 6) {
        if (signal && signal.aborted) {
          if (typeof onVocalStatus === 'function') onVocalStatus(null);
          return null;
        }

        await new Promise(r => {
          let timeoutId;
          const onAbort = () => {
            clearTimeout(timeoutId);
            r();
          };
          timeoutId = setTimeout(() => {
            if (signal?.removeEventListener) signal.removeEventListener('abort', onAbort);
            r();
          }, 1400);
          if (signal?.addEventListener) {
            signal.addEventListener('abort', onAbort, { once: true });
          }
        });

        if (signal && signal.aborted) {
          if (typeof onVocalStatus === 'function') onVocalStatus(null);
          return null;
        }

        pollAttempts++;

        try {
          if (signal && signal.aborted) {
            if (typeof onVocalStatus === 'function') onVocalStatus(null);
            return null;
          }
          const curData = await withChainedAbort(signal, 4500, async (reqSignal) => {
            const pollRes = await fetch(
              `${API_BASE_URL}/api/tracks/vocal-status?id=${encodeURIComponent(trackId)}&url=${qUrl}&title=${qTitle}&artist=${qArtist}`,
              { signal: reqSignal }
            );
            return pollRes.ok ? await pollRes.json() : null;
          });
          if (signal && signal.aborted) {
            if (typeof onVocalStatus === 'function') onVocalStatus(null);
            return null;
          }
          if (curData) {
            if (curData.status === 'ready' && curData.url) {
              if (typeof onVocalStatus === 'function') {
                onVocalStatus({
                  isProcessing: true,
                  trackTitle: track.title,
                  progress: 100,
                  eta: 'Ready!'
                });
                const clearBannerTimer = setTimeout(() => {
                  if (signal?.removeEventListener) signal.removeEventListener('abort', onClearAbort);
                  if (!signal?.aborted) onVocalStatus(null);
                }, 1000);
                const onClearAbort = () => clearTimeout(clearBannerTimer);
                if (signal?.addEventListener) {
                  signal.addEventListener('abort', onClearAbort, { once: true });
                }
              }
              const fullVocalUrl = curData.url.startsWith('/') ? `${API_BASE_URL}${curData.url}` : curData.url;
              if (cacheKey) setStreamInCache(cacheKey, fullVocalUrl);
              return fullVocalUrl;
            } else if (curData.status === 'failed') {
              console.warn('[youtubeResolver] Server vocal isolation unavailable, smoothly playing original high-quality audio');
              if (typeof onVocalStatus === 'function') onVocalStatus(null);
              break;
            } else if (curData.status === 'processing') {
              const realProgress = Number(curData.progress) || 0;
              if (realProgress > 0) {
                displayProgress = Math.max(displayProgress, realProgress);
              } else {
                displayProgress = Math.min(92, displayProgress + 2);
              }
              const boundedProg = Math.min(99, displayProgress);
              if (typeof onVocalStatus === 'function') {
                onVocalStatus({
                  isProcessing: true,
                  trackTitle: track.title,
                  progress: boundedProg,
                  eta: curData.eta ? `${curData.eta} (${boundedProg}%)` : `Isolating vocals... ${boundedProg}%`
                });
              }
            } else if (curData.status === 'queued') {
              if (typeof onVocalStatus === 'function') {
                onVocalStatus({
                  isProcessing: true,
                  trackTitle: track.title,
                  progress: 10,
                  eta: curData.eta || 'Queued in line...'
                });
              }
            } else if (curData.status === 'idle') {
              displayProgress = Math.min(50, displayProgress + 1);
              if (pollAttempts % 5 === 0) {
                fetch(
                  `${API_BASE_URL}/api/tracks/vocal-stream?id=${encodeURIComponent(trackId)}&url=${qUrl}&title=${qTitle}&artist=${qArtist}&duration=${qDur}&json=1&priority=1`,
                  signal ? { signal } : undefined
                ).catch(() => {});
              }
              if (typeof onVocalStatus === 'function') {
                onVocalStatus({
                  isProcessing: true,
                  trackTitle: track.title,
                  progress: displayProgress,
                  eta: curData.eta || `Isolating vocals... ${displayProgress}%`
                });
              }
            }
          }
        } catch (pollErr) {
          if (signal && signal.aborted) {
            if (typeof onVocalStatus === 'function') onVocalStatus(null);
            return null;
          }
        }
      }

      if (typeof onVocalStatus === 'function') onVocalStatus(null);
    } catch (e) {
      if (typeof onVocalStatus === 'function') onVocalStatus(null);
    }
  } else {
    // Vocal-Only mode is OFF or content is Holy Quran -> strictly clear any vocal isolation banner
    if (typeof onVocalStatus === 'function') onVocalStatus(null);
  }

  if (signal?.aborted) return null;

  // 2. Direct local file on device storage (by nativeAudioUri or downloadedTracks check)
  if (!skipLocal) {
    const localUri = track.nativeAudioUri || track.localAudioUri;
    if (localUri && localUri.startsWith('file://')) {
      try {
        const info = await FileSystem.getInfoAsync(localUri);
        if (signal?.aborted) return null;
        if (info.exists && info.size > 10000) {
          if (cacheKey) setStreamInCache(cacheKey, localUri);
          return localUri;
        }
      } catch {}
    }

    // 2b. Check if track is saved in offline storage by exact track ID OR exact clean title AND artist
    try {
      const { getDownloadedTracks } = require('./downloadManager');
      const dls = await getDownloadedTracks();
      if (signal?.aborted) return null;
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
          if (signal?.aborted) return null;
          if (info.exists && info.size > 10000) {
            if (cacheKey) setStreamInCache(cacheKey, dlUri);
            return dlUri;
          }
        }
      }
    } catch {}
  }

  if (signal?.aborted) return null;

  // 2c. Direct local upload audio stream
  if (
    track.source === 'Upload' ||
    rawUrl.startsWith('/uploads/') ||
    rawUrl.includes('/uploads/')
  ) {
    const fullUrl = rawUrl.startsWith('/') ? `${API_BASE_URL}${rawUrl}` : (rawUrl.startsWith('http') ? rawUrl : `${API_BASE_URL}/${rawUrl}`);
    if (cacheKey) setStreamInCache(cacheKey, fullUrl);
    applyValidatedDuration(track, trackId, track.duration);
    return fullUrl;
  }

  // 2. Direct radio / live stream URL or direct MP3/M4A/AAC stream URL (non-YouTube)
  if (track.isRadio || track.isLive || isRadioTrack(track)) {
    const radioUrl = (track.isRetry && track.fallbackUrl) ? track.fallbackUrl : (rawUrl || track.audioUrl);
    if (radioUrl && radioUrl.startsWith('http')) {
      const full = radioUrl.startsWith('/') ? `${API_BASE_URL}${radioUrl}` : radioUrl;
      if (trackId) setStreamInCache(trackId, full);
      return full;
    }
  }

  if (
    !track.isRetry &&
    rawUrl.startsWith('http') &&
    !rawUrl.includes('youtube.com') &&
    !rawUrl.includes('freesound.org') &&
    !rawUrl.includes('example.com') &&
    !rawUrl.includes('youtu.be') &&
    !rawUrl.includes('soundcloud.com') &&
    !rawUrl.includes('sndcdn.com') &&
    !isStreamUrlLikelyExpired(rawUrl, 30) &&
    (
      rawUrl.endsWith('.mp3') ||
      rawUrl.endsWith('.m4a') ||
      rawUrl.endsWith('.aac') ||
      rawUrl.includes('/radio/') ||
      rawUrl.includes('/station/') ||
      rawUrl.includes('radiojar.com')
    )
  ) {
    if (trackId) setStreamInCache(trackId, rawUrl);
    return rawUrl;
  }

  const targetDuration = sanitizeDuration(track.duration, null);
  const durParam = targetDuration ? `&duration=${encodeURIComponent(targetDuration)}` : '';
  const albumParam = track.album ? `&album=${encodeURIComponent(track.album)}` : '';
  const retryParam = (track.isRetry && (cleanTitle || rawTitle || cleanArtist || rawArtist)) ? '&retryAlt=1' : '';

  // 3a. Direct fast stream endpoint: /api/tracks/:id/stream (own 9000ms timeout chained to parent signal)
  try {
    const serverData = await withChainedAbort(signal, 9000, async (reqSignal) => {
      const res = await fetch(
        `${API_BASE_URL}/api/tracks/${encodeURIComponent(trackId || 'stream')}/stream?url=${encodeURIComponent(rawUrl)}&title=${encodeURIComponent(cleanTitle || rawTitle)}&artist=${encodeURIComponent(cleanArtist || rawArtist)}${durParam}${albumParam}${retryParam}`,
        { signal: reqSignal }
      );
      if (!res.ok) return null;
      return await res.json();
    });
    if (signal?.aborted) return null;
    let streamUrl = serverData?.url || serverData?.directUrl;
    if (streamUrl && !isWatchPageUrl(streamUrl)) {
      if (streamUrl.startsWith('/')) {
        streamUrl = `${API_BASE_URL}${streamUrl}`;
      }
      if (!isStreamUrlLikelyExpired(streamUrl, 30)) {
        if (trackId) setStreamInCache(trackId, streamUrl);
        applyValidatedDuration(track, trackId, serverData?.duration);
        return streamUrl;
      }
    }
  } catch (e) {
    if (signal?.aborted) return null;
  }

  if (signal?.aborted) return null;

  // 3b. Resolve stream via /api/tracks/resolve-stream (own 7000ms timeout chained to parent signal)
  try {
    const resolveData = await withChainedAbort(signal, 7000, async (reqSignal) => {
      const res = await fetch(
        `${API_BASE_URL}/api/tracks/resolve-stream?stream=true&title=${encodeURIComponent(rawTitle || cleanTitle)}&artist=${encodeURIComponent(rawArtist || cleanArtist)}&url=${encodeURIComponent(rawUrl)}&id=${encodeURIComponent(trackId)}${durParam}${albumParam}${retryParam}`,
        { signal: reqSignal }
      );
      if (!res.ok) return null;
      return await res.json();
    });
    if (signal?.aborted) return null;
    if (resolveData?.success && resolveData?.url && !isWatchPageUrl(resolveData.url)) {
      let cand = resolveData.url;
      if (cand.startsWith('/')) cand = `${API_BASE_URL}${cand}`;
      if (!isStreamUrlLikelyExpired(cand, 30)) {
        if (trackId) setStreamInCache(trackId, cand);
        applyValidatedDuration(track, trackId, resolveData?.duration);
        return cand;
      }
    }
  } catch (e) {
    if (signal?.aborted) return null;
  }

  if (signal?.aborted) return null;

  // 4. Client-side YouTube Audio Stream Resolution Fallback
  let ytId = extractYouTubeId(rawUrl) ||
             (track.youtubeId ? extractYouTubeId(track.youtubeId) : null) ||
             (track.source === 'YouTube' ? extractYouTubeId(trackId) : null);

  // If no direct ytId, search YouTube client-side directly (<300ms)
  const isUploadTrack = track.source === 'Upload' || (rawUrl && (rawUrl.startsWith('/uploads/') || rawUrl.includes('/uploads/')));
  if (!isUploadTrack && !ytId && (cleanTitle || cleanArtist || rawTitle)) {
    if (signal?.aborted) return null;
    try {
      const searchRes = await searchYouTubeClientSide({
        artist: cleanArtist || rawArtist,
        title: cleanTitle || rawTitle,
        targetDuration
      }, signal);
      if (signal?.aborted) return null;
      if (searchRes?.videoId) {
        ytId = searchRes.videoId;
        if (trackId) trackToYoutubeIdMap.set(trackId, ytId);
        applyValidatedDuration(track, trackId, searchRes.duration);
      }
    } catch (e) {}
  }

  if (signal?.aborted) return null;

  if (ytId) {
    if (trackId) trackToYoutubeIdMap.set(trackId, ytId);
    try {
      const directResult = await resolveClientSideYouTubeStream(ytId, signal);
      if (signal?.aborted) return null;
      const directStream = typeof directResult === 'string' ? directResult : directResult?.url;
      if (directStream && !isWatchPageUrl(directStream) && !isStreamUrlLikelyExpired(directStream, 30)) {
        if (trackId) setStreamInCache(trackId, directStream);
        setStreamInCache(ytId, directStream);
        applyValidatedDuration(track, trackId, directResult?.duration);
        return directStream;
      }
    } catch (e) {}
  }

  // Safety guard: never pass HTML web URLs or expired direct URLs into audio player
  if (
    rawUrl &&
    rawUrl.startsWith('http') &&
    !rawUrl.includes('youtube.com') &&
    !rawUrl.includes('youtu.be') &&
    !rawUrl.includes('soundcloud.com') &&
    !rawUrl.includes('example.com') &&
    !rawUrl.includes('freesound.org') &&
    !isStreamUrlLikelyExpired(rawUrl, 30)
  ) {
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
export const searchYouTubeClientSide = async (queryOrOptions, maybeOptions = {}, passedSignal = null) => {
  const signal = passedSignal || (maybeOptions instanceof AbortSignal ? maybeOptions : maybeOptions?.signal) || (queryOrOptions && typeof queryOrOptions === 'object' ? queryOrOptions.signal : null) || null;
  if (signal?.aborted) return null;

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
    searchQueries.push(`${cleanArt} ${cleanTit} Topic`);
    searchQueries.push(`${cleanArt} ${cleanTit} official audio`);
    searchQueries.push(`"${cleanArt}" "${cleanTit}"`);
    searchQueries.push(`${cleanArt} ${cleanTit}`);
  } else if (cleanTit) {
    searchQueries.push(`${cleanTit} official audio`);
    searchQueries.push(cleanTit);
  } else if (query) {
    const cleanQ = query.replace(/\s+music$/i, '').trim();
    searchQueries.push(`${cleanQ} official audio`);
    searchQueries.push(cleanQ);
  }

  if (searchQueries.length === 0) return null;

  const key = INNERTUBE_KEY || 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';

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
    if (signal?.aborted) return null;
    try {
      const d = await withChainedAbort(signal, 4000, async (reqSignal) => {
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
          signal: reqSignal
        });
        if (!res.ok) return null;
        return await res.json();
      });

      if (signal?.aborted) return null;
      if (!d) continue;

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

        if (candChannel.includes('topic')) score += 90;
        else if (candChannel.includes('official') || candChannel.includes('vevo')) score += 30;

        if (candTitle.includes('official audio') || candTitle.includes('audio')) score += 70;
        else if (candTitle.includes('official lyric') || candTitle.includes('lyrics')) score += 30;
        else if (candTitle.includes('official video') || candTitle.includes('music video') || candTitle.includes('video') || candTitle.includes('كليب')) score -= 40;

        const isUnwantedModifier = !normTitle.includes('remix') && !normTitle.includes('ريمكس') &&
          (candTitle.includes('remix') || candTitle.includes('ريمكس') || candTitle.includes('slowed') || candTitle.includes('reverb') || candTitle.includes('cover') || candTitle.includes('كفر') || candTitle.includes('karaoke') || candTitle.includes('حفلة') || candTitle.includes('live') || candTitle.includes('concert'));
        if (isUnwantedModifier) score -= 200;

        if (!normTitle.includes('mix') && (candTitle.includes('mix') || candTitle.includes('full album') || candTitle.includes('playlist'))) score -= 100;
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
          duration: sanitizeDuration(best.duration, sanitizeDuration(targetDuration, null)),
          title: best.title,
          channel: best.channel
        };
      }
    } catch (e) {
      if (signal?.aborted) return null;
    }
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

export const resolveClientSideYouTubeStream = async (ytId, signal = null) => {
  if (!ytId || signal?.aborted) return null;
  try {
    const key = INNERTUBE_KEY || 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
    let visitorData = '';
    let cookies = '';
    let sts = cachedSignatureTimestamp || 20744;

    if (cachedVisitorData && Date.now() - cachedVisitorTimestamp < VISITOR_CACHE_TTL) {
      visitorData = cachedVisitorData;
    } else {
      try {
        const watchData = await withChainedAbort(signal, 4000, async (reqSignal) => {
          const webRes = await fetch(`https://www.youtube.com/watch?v=${ytId}`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9',
            },
            signal: reqSignal,
          });
          const html = await webRes.text();
          let cookieHdr = '';
          if (webRes.headers?.getSetCookie) {
            const sc = webRes.headers.getSetCookie();
            if (Array.isArray(sc) && sc.length > 0) {
              cookieHdr = sc.map(c => c.split(';')[0]).join('; ');
            }
          } else if (webRes.headers?.get) {
            cookieHdr = webRes.headers.get('set-cookie') || '';
          }
          return { html, cookieHdr };
        });

        if (signal?.aborted) return null;
        if (watchData?.html) {
          const visitorMatch = watchData.html.match(/"VISITOR_DATA":"([^"]+)"/);
          if (visitorMatch && visitorMatch[1]) {
            visitorData = visitorMatch[1];
            cachedVisitorData = visitorData;
            cachedVisitorTimestamp = Date.now();
          }
          const stsMatch = watchData.html.match(/"signatureTimestamp":(\d+)/);
          if (stsMatch && stsMatch[1]) {
            sts = parseInt(stsMatch[1], 10);
            cachedSignatureTimestamp = sts;
          }
          cookies = watchData.cookieHdr || '';
        }
      } catch (e) {
        if (signal?.aborted) return null;
      }
    }

    if (signal?.aborted) return null;

    const configs = (CLIENT_CONFIGS && CLIENT_CONFIGS.length > 0) ? CLIENT_CONFIGS : [{
      name: 'VISIONOS',
      client: {
        clientName: 'VISIONOS', clientVersion: '1.02', deviceMake: 'Apple', deviceModel: 'RealityDevice17,1',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
        osName: 'visionOS', osVersion: '26.5.23O471', hl: 'en', timeZone: 'UTC', utcOffsetMinutes: 0
      },
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
        'X-Youtube-Client-Name': '101', 'X-Youtube-Client-Version': '1.02', 'Origin': 'https://www.youtube.com'
      }
    }];

    for (const cfg of configs) {
      if (signal?.aborted) return null;
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
      if (cookies) headers['Cookie'] = cookies;
      if (visitorData) headers['X-Goog-Visitor-Id'] = visitorData;

      try {
        const data = await withChainedAbort(signal, 4500, async (reqSignal) => {
          const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${key}&prettyPrint=false`, {
            method: 'POST',
            headers,
            body: JSON.stringify(playerBody),
            signal: reqSignal,
          });
          if (!res.ok) return null;
          return await res.json();
        });

        if (signal?.aborted) return null;
        if (data?.playabilityStatus?.status === 'OK') {
          const formats = (data.streamingData?.adaptiveFormats || []).concat(data.streamingData?.formats || []);
          // Prioritize universal AAC/MP4 (140, 139, audio/mp4) before WebM/Opus (251) so iOS AVPlayer never stalls
          const audio140 = formats.find(f => f.itag === 140 && f.url);
          const audio139 = formats.find(f => f.itag === 139 && f.url);
          const audioMp4 = formats.find(f => f.mimeType?.includes('audio/mp4') && f.url);
          const audio251 = formats.find(f => f.itag === 251 && f.url);
          const anyAudio = formats.find(f => f.mimeType?.startsWith('audio') && f.url);
          const muxed18 = formats.find(f => f.itag === 18 && f.url);
          const chosen = audio140 || audio139 || audioMp4 || audio251 || anyAudio || muxed18;

          if (chosen?.url && !isStreamUrlLikelyExpired(chosen.url, 30)) {
            const rawSec = parseInt(data.videoDetails?.lengthSeconds, 10);
            const rawMs = parseInt(chosen.approxDurationMs, 10);
            const durationSec = sanitizeDuration(
              rawSec > 0 ? rawSec : (rawMs > 0 ? Math.round(rawMs / 1000) : null),
              null
            );

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
      } catch (e) {
        if (signal?.aborted) return null;
      }
    }
  } catch (err) {}
  return null;
};

/**
 * Non-blocking stream pre-warm helper for cold-boot readiness.
 * Skips local files and live radio; checks connectivity & respects AbortSignal.
 */
export const prewarmTrackStream = async (track, signalOrOptions = null) => {
  const signal = (signalOrOptions && typeof signalOrOptions === 'object' && 'aborted' in signalOrOptions)
    ? signalOrOptions
    : signalOrOptions?.signal || null;

  if (!track || signal?.aborted) return null;

  const localCandidate = track.localAudioUri || track.nativeAudioUri || track.audioUrl || '';
  if (typeof localCandidate === 'string' && (localCandidate.startsWith('file://') || localCandidate.startsWith('content://'))) {
    return null;
  }
  if (track.isRadio || track.isLive || isRadioTrack(track)) {
    return null;
  }

  const trackId = String(track._id || track.id || '');
  const ytId = extractYouTubeId(track.youtubeId || track.audioUrl || track.url);
  if ((trackId && getStreamFromCache(trackId)) || (ytId && getStreamFromCache(ytId))) {
    return getStreamFromCache(trackId) || getStreamFromCache(ytId);
  }

  try {
    const netState = await NetInfo.fetch().catch(() => null);
    if (signal?.aborted) return null;
    const isOnline = netState ? (netState.isConnected && netState.isInternetReachable !== false) : true;
    if (!isOnline) return null;

    // Resolve silently on a shallow copy without vocal isolation or UI banners
    return await resolveAudioStream({ ...track }, false, null, signal);
  } catch {
    return null;
  }
};

export const resolveYouTubeStream = async (trackId) => {
  return null;
};
