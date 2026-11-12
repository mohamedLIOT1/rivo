import { API_BASE_URL } from '../../config';
import { isQuranContent } from '../../utils/quranUtils';
import { normalizeCoverUrl } from '../../utils/coverUtils';

/**
 * Sanitize track duration values (handles milliseconds, missing, NaN, or infinite values).
 */
export function sanitizeDuration(val, fallback = 210) {
  if (val === undefined || val === null) return fallback;
  const num = Number(val);
  if (!isFinite(num) || isNaN(num) || num <= 0) return fallback;
  // Convert millisecond values (> 24h) to seconds without breaking long recitations
  if (num > 86400) {
    const inSec = Math.round(num / 1000);
    if (inSec > 0 && inSec <= 86400) return inSec;
    return fallback;
  }
  return Math.round(num);
}

function abortableSleep(ms, signal) {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (signal) signal.removeEventListener('abort', onAbort);
      resolve();
    };
    const onAbort = () => {
      clearTimeout(timer);
      finish();
    };
    const timer = setTimeout(finish, ms);
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
  });
}

function dispatchVocalStatus(statusObj, isPrefetch) {
  if (isPrefetch) return;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('rivo-vocal-status-update', { detail: statusObj }));
  }
}

/**
 * Resolve isolated vocal stem stream when Vocal-Only Mode is active.
 * Returns stream metadata object if ready, or null to fall back gracefully.
 */
export async function resolveVocalOnlyStream(track, targetUrl, signal = null, isPrefetch = false) {
  if (!track || isQuranContent(track)) return null;
  if (signal?.aborted) return null;

  const trackId = String(track.id || track._id || '');

  try {
    const qTitle = encodeURIComponent(track.title || '');
    const qArtist = encodeURIComponent(track.artist || '');
    const qDur = encodeURIComponent(track.duration || '');
    const qUrl = encodeURIComponent(targetUrl || '');

    const statusRes = await fetch(
      `${API_BASE_URL}/api/tracks/vocal-status?id=${encodeURIComponent(trackId)}&url=${qUrl}&title=${qTitle}&artist=${qArtist}`,
      { signal }
    );
    const statusData = statusRes.ok ? await statusRes.json() : null;

    if (statusData?.status === 'ready' && statusData.url) {
      dispatchVocalStatus(null, isPrefetch);
      const fullVocalUrl = statusData.url.startsWith('/') ? `${API_BASE_URL}${statusData.url}` : statusData.url;
      return {
        url: fullVocalUrl,
        duration: sanitizeDuration(track.duration, 210),
        cover: normalizeCoverUrl(track.cover || track.coverUrl),
        isVocalOnly: true,
      };
    }

    if (isPrefetch) {
      fetch(
        `${API_BASE_URL}/api/tracks/vocal-stream?id=${encodeURIComponent(trackId)}&url=${qUrl}&title=${qTitle}&artist=${qArtist}&duration=${qDur}&json=1&prefetch=1`,
        { signal }
      ).catch(() => {});
      return null;
    }

    dispatchVocalStatus(
      {
        isProcessing: true,
        trackTitle: track.title,
        progress: statusData?.progress || 1,
        eta: statusData?.eta || 'Preparing audio...',
      },
      isPrefetch
    );

    fetch(
      `${API_BASE_URL}/api/tracks/vocal-stream?id=${encodeURIComponent(trackId)}&url=${qUrl}&title=${qTitle}&artist=${qArtist}&duration=${qDur}&json=1&priority=1`,
      { signal }
    ).catch(() => {});

    let pollAttempts = 0;
    let displayProgress = Math.max(8, statusData?.progress || 8);
    const pollStartTime = Date.now();
    const MAX_VOCAL_POLL_MS = 9000;

    while (!signal?.aborted && Date.now() - pollStartTime < MAX_VOCAL_POLL_MS && pollAttempts < 6) {
      await abortableSleep(1500, signal);
      if (signal?.aborted) break;

      const checkRes = await fetch(
        `${API_BASE_URL}/api/tracks/vocal-status?id=${encodeURIComponent(trackId)}&url=${qUrl}&title=${qTitle}&artist=${qArtist}`,
        { signal }
      );
      if (checkRes.ok) {
        const curData = await checkRes.json();
        if (curData.status === 'ready' && (curData.url || curData.vocalUrl)) {
          dispatchVocalStatus(
            {
              isProcessing: true,
              trackTitle: track.title,
              progress: 100,
              eta: 'Ready!',
            },
            isPrefetch
          );
          setTimeout(() => dispatchVocalStatus(null, isPrefetch), 1200);
          const rawUrl = curData.vocalUrl || curData.url;
          const fullVocalUrl = rawUrl.startsWith('/') ? `${API_BASE_URL}${rawUrl}` : rawUrl;
          const fullInstUrl = curData.instUrl ? (curData.instUrl.startsWith('/') ? `${API_BASE_URL}${curData.instUrl}` : curData.instUrl) : null;

          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('rivo-stem-ready', {
              detail: { trackId, vocalUrl: fullVocalUrl, instUrl: fullInstUrl, title: track.title }
            }));
          }

          return {
            url: fullVocalUrl,
            duration: sanitizeDuration(track.duration, 210),
            cover: normalizeCoverUrl(track.cover || track.coverUrl),
            isVocalOnly: true,
          };
        } else if (curData.status === 'processing') {
          const realProgress = Number(curData.progress) || 0;
          displayProgress = realProgress > 0 ? realProgress : Math.min(30, displayProgress + 2);
          dispatchVocalStatus(
            {
              isProcessing: true,
              trackTitle: track.title,
              progress: Math.min(99, displayProgress),
              eta: curData.eta || (displayProgress > 50 ? 'Extracting pure vocals...' : 'Isolating vocals with AI...'),
            },
            isPrefetch
          );
        } else if (curData.status === 'queued') {
          dispatchVocalStatus(
            {
              isProcessing: true,
              trackTitle: track.title,
              progress: 5,
              eta: curData.eta || 'Queued behind active isolation...',
            },
            isPrefetch
          );
        } else if (curData.status === 'failed') {
          dispatchVocalStatus(
            {
              isProcessing: false,
              error: 'Vocal isolation unavailable, smoothly playing original high-quality audio',
            },
            isPrefetch
          );
          setTimeout(() => dispatchVocalStatus(null, isPrefetch), 3000);
          break;
        } else {
          displayProgress = Math.min(15, displayProgress + 1);
          dispatchVocalStatus(
            {
              isProcessing: true,
              trackTitle: track.title,
              progress: displayProgress,
              eta: 'Preparing audio stream...',
            },
            isPrefetch
          );
          if (pollAttempts > 0 && pollAttempts % 4 === 0) {
            fetch(
              `${API_BASE_URL}/api/tracks/vocal-stream?id=${encodeURIComponent(trackId)}&url=${qUrl}&title=${qTitle}&artist=${qArtist}&duration=${qDur}&json=1&priority=1`,
              { signal }
            ).catch(() => {});
          }
        }
      }
      pollAttempts++;
    }
  } catch (e) {
    if (e.name === 'AbortError') {
      dispatchVocalStatus(null, isPrefetch);
      throw e;
    }
    console.warn('[AudioContext] Vocal stream resolve notice:', e.message);
  }

  dispatchVocalStatus(null, isPrefetch);
  if (!isPrefetch && trackId) {
    startBackgroundStemPoller({ trackId, qUrl, qTitle, qArtist, trackTitle: track.title });
  }
  return null;
}

function startBackgroundStemPoller({ trackId, qUrl, qTitle, qArtist, trackTitle }) {
  let attempts = 0;
  const maxAttempts = 20;
  const interval = setInterval(async () => {
    attempts++;
    if (attempts > maxAttempts) {
      clearInterval(interval);
      return;
    }
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/tracks/vocal-status?id=${encodeURIComponent(trackId)}&url=${qUrl}&title=${qTitle}&artist=${qArtist}`
      );
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'ready' && (data.url || data.vocalUrl)) {
          clearInterval(interval);
          const rawUrl = data.vocalUrl || data.url;
          const fullVocalUrl = rawUrl.startsWith('/') ? `${API_BASE_URL}${rawUrl}` : rawUrl;
          const fullInstUrl = data.instUrl ? (data.instUrl.startsWith('/') ? `${API_BASE_URL}${data.instUrl}` : data.instUrl) : null;
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('rivo-stem-ready', {
              detail: { trackId, vocalUrl: fullVocalUrl, instUrl: fullInstUrl, title: trackTitle }
            }));
          }
        } else if (data.status === 'failed') {
          clearInterval(interval);
        }
      }
    } catch {
      clearInterval(interval);
    }
  }, 3500);
}
