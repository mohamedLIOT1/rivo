/**
 * Stream Recovery & Playback Watchdog Helper
 * Adheres to AGENTS.md (< 400 lines, request cancellation, isolated logic)
 */

export function sanitizeDuration(val, fallback = 210) {
  if (val === undefined || val === null) return fallback;
  const num = Number(val);
  if (!isFinite(num) || isNaN(num) || num <= 0) return fallback;
  if (num > 86400) {
    const inSec = Math.round(num / 1000);
    if (inSec > 0 && inSec <= 86400) return inSec;
    return fallback;
  }
  return Math.round(num);
}

/**
 * Requests an alternative stream from backend with retryAlt=1
 * Bypasses cached / blocked video IDs and resolves alternative source.
 * Cloud/uploaded tracks (/uploads/cloud/, /uploads/) recover via /api/tracks/:id/stream
 * or direct URL without attempting YouTube fallbacks.
 */
export async function requestAlternativeStream(track, apiBaseUrl, signal = null) {
  if (!track || signal?.aborted) return null;
  const trackId = String(track.id || track._id || '');
  const rawAudioUrl = String(track.audioUrl || track.resolvedAudioUrl || '').trim();
  const normalizedAudioUrl = rawAudioUrl.startsWith('uploads/') ? `/${rawAudioUrl}` : rawAudioUrl;
  const isCloudOrUpload = Boolean(
    track.cloudStorage?.provider ||
    normalizedAudioUrl.startsWith('/uploads/cloud/') ||
    normalizedAudioUrl.includes('/uploads/cloud/') ||
    normalizedAudioUrl.startsWith('/uploads/') ||
    normalizedAudioUrl.startsWith('/api/tracks/media/')
  );

  const qTitle = encodeURIComponent(track.title || '');
  const qArtist = encodeURIComponent(track.artist || '');
  const qAlbum = encodeURIComponent(track.album || '');
  const qDuration = encodeURIComponent(track.duration || '');
  const qUrl = encodeURIComponent(normalizedAudioUrl);
  const retryQuery = isCloudOrUpload ? '' : '&retryAlt=1';

  // 1. Try endpoint /api/tracks/:id/stream (timeout: 12s)
  const controller1 = new AbortController();
  const t1 = setTimeout(() => { try { controller1.abort(); } catch {} }, 12000);
  const onParentAbort1 = () => { clearTimeout(t1); try { controller1.abort(); } catch {} };
  if (signal) signal.addEventListener('abort', onParentAbort1, { once: true });

  try {
    const sRes = await fetch(
      `${apiBaseUrl}/api/tracks/${encodeURIComponent(trackId || 'stream')}/stream?url=${qUrl}&title=${qTitle}&artist=${qArtist}&album=${qAlbum}&duration=${qDuration}${retryQuery}`,
      { signal: controller1.signal }
    );

    if (sRes.ok) {
      const sData = await sRes.json();
      let cand = sData?.url || sData?.directUrl;
      if (cand && !cand.includes('youtube.com/watch') && !cand.includes('youtu.be/')) {
        if (cand.startsWith('/')) cand = `${apiBaseUrl}${cand}`;
        return {
          url: cand,
          duration: sanitizeDuration(sData.duration || track.duration, 210),
          cover: track.cover || track.coverUrl || sData.cover,
          track: sData.track || null
        };
      }
    }
  } catch {
    if (signal?.aborted) return null;
  } finally {
    clearTimeout(t1);
    if (signal) signal.removeEventListener('abort', onParentAbort1);
  }

  // Cloud / uploaded tracks: recover directly via URL and never fall back to YouTube
  if (isCloudOrUpload) {
    if (signal?.aborted || !normalizedAudioUrl) return null;
    const directCloudUrl = normalizedAudioUrl.startsWith('/')
      ? `${apiBaseUrl}${normalizedAudioUrl}`
      : normalizedAudioUrl;
    if (!directCloudUrl.includes('youtube.com') && !directCloudUrl.includes('youtu.be')) {
      return {
        url: directCloudUrl,
        duration: sanitizeDuration(track.duration, 210),
        cover: track.cover || track.coverUrl,
        track: null
      };
    }
    return null;
  }

  if (signal?.aborted) return null;

  // 2. Try endpoint /api/tracks/resolve-stream with retryAlt=1 (timeout: 12s)
  const controller2 = new AbortController();
  const t2 = setTimeout(() => { try { controller2.abort(); } catch {} }, 12000);
  const onParentAbort2 = () => { clearTimeout(t2); try { controller2.abort(); } catch {} };
  if (signal) signal.addEventListener('abort', onParentAbort2, { once: true });

  try {
    const res = await fetch(
      `${apiBaseUrl}/api/tracks/resolve-stream?stream=true&title=${qTitle}&artist=${qArtist}&id=${encodeURIComponent(trackId)}&album=${qAlbum}&duration=${qDuration}&retryAlt=1`,
      { signal: controller2.signal }
    );

    if (res.ok) {
      const d = await res.json();
      if (d.success && d.url && !d.url.includes('youtube.com/watch') && !d.url.includes('youtu.be/')) {
        let cand = d.url;
        if (cand.startsWith('/')) cand = `${apiBaseUrl}${cand}`;
        return {
          url: cand,
          duration: sanitizeDuration(d.duration || track.duration, 210),
          cover: track.cover || track.coverUrl || d.cover,
          track: d.track || null
        };
      }
    }
  } catch {
    if (signal?.aborted) return null;
  } finally {
    clearTimeout(t2);
    if (signal) signal.removeEventListener('abort', onParentAbort2);
  }

  return null;
}

/**
 * Creates a watchdog that detects 0:00 playback freeze or stall
 */
export function createPlaybackWatchdog({ getAudio, isPlayingRef, shouldPlayRef, onStall, timeoutMs = 12000 }) {
  let timerId = null;

  const start = () => {
    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(() => {
      const audio = typeof getAudio === 'function' ? getAudio() : getAudio;
      if (!audio) return;
      if (isPlayingRef?.current || shouldPlayRef?.current) {
        if (audio.currentTime === 0 && (audio.paused || audio.readyState < 3)) {
          if (typeof onStall === 'function') {
            onStall();
          }
        }
      }
    }, timeoutMs);
  };

  const clear = () => {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  return { start, clear };
}

/**
 * Emits clean, non-intrusive toast notification for unavailable audio stream
 */
export function notifyStreamUnavailable(triggerToast, trackTitle = '') {
  const msg = trackTitle
    ? `Audio stream unavailable for "${trackTitle}", attempting next track...`
    : 'Audio stream unavailable, attempting next track...';
  if (typeof triggerToast === 'function') {
    triggerToast(msg);
  } else if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rivo:toast', { detail: msg }));
  }
}
