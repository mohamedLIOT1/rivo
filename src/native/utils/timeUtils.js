/**
 * Time and duration utilities for Rivo Native.
 * Handles ms-vs-s normalization and H:MM:SS / M:SS formatting.
 */

const SECONDS_PER_DAY = 86400;

/**
 * Normalizes a duration value into whole seconds.
 * Converts milliseconds to seconds ONLY when num > 86400 and Math.round(num / 1000) <= 86400.
 */
export function sanitizeDuration(val, fallback = 0) {
  if (val === undefined || val === null || val === '') return fallback;
  const num = Number(val);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  if (num > SECONDS_PER_DAY) {
    const inSec = Math.round(num / 1000);
    if (inSec > 0 && inSec <= SECONDS_PER_DAY) return inSec;
    return fallback;
  }
  return Math.round(num);
}

/**
 * Formats seconds as H:MM:SS when hours > 0, otherwise M:SS.
 */
export function formatTime(secs) {
  const num = Number(secs);
  if (!Number.isFinite(num) || num <= 0) return '0:00';

  let totalSec;
  if (num > SECONDS_PER_DAY) {
    const inSec = Math.round(num / 1000);
    totalSec = inSec > 0 && inSec <= SECONDS_PER_DAY ? inSec : 0;
  } else {
    totalSec = Math.floor(num);
  }

  if (totalSec <= 0) return '0:00';

  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  if (h > 0) {
    return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  }
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

/**
 * Sanitizes and formats a track duration (default fallback 0 -> '0:00').
 */
export function formatDuration(secs, fallback = 0) {
  return formatTime(sanitizeDuration(secs, fallback));
}
