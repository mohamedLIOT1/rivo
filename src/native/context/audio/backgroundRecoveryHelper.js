import { AppState } from 'react-native';
import { clearStreamCache } from '../../services/youtubeResolver';
import { isRadioTrack } from '../../../utils/quranUtils';
import { API_BASE_URL } from '../../config';
import { ensureBackgroundAudioMode } from './audioModeConfig';

const MAX_STALL_RECOVERY_ATTEMPTS = 4;
const MAX_PREMATURE_EOF_AT_SAME_POS = 3;
const PLAY_ASYNC_COOLDOWN_MS = 2500;
const HEALTHY_RESET_ELAPSED_MS = 20000;
const HEALTHY_RESET_PROGRESS_SEC = 15;
const RECOVERY_VERIFY_MS = 14000;

const FOREGROUND_STALL_DELAYS_MS = [4500, 6500, 9000, 12000];
const BACKGROUND_STALL_DELAYS_MS = [8000, 12000, 18000, 25000];
const ERROR_RETRY_DELAYS_MS = [350, 2500, 5000, 9000];

const recoveryState = {
  trackId: '',
  lastRequestSeq: 0,
  stallAttempts: 0,
  prematureEofAttempts: 0,
  lastPrematureEofPos: -1,
  lastPlayAsyncAttemptAt: 0,
  playAsyncInFlight: false,
  healthyStartAt: 0,
  healthyStartPos: 0,
  observedDurationSec: 0,
  watchdogTimer: null,
};

const clearWatchdogTimer = () => {
  if (recoveryState.watchdogTimer) {
    clearTimeout(recoveryState.watchdogTimer);
    recoveryState.watchdogTimer = null;
  }
};

/**
 * Resets internal background recovery tracking state (primarily for tests or hard resets).
 */
export const resetBackgroundRecoveryState = () => {
  clearWatchdogTimer();
  recoveryState.trackId = '';
  recoveryState.lastRequestSeq = 0;
  recoveryState.stallAttempts = 0;
  recoveryState.prematureEofAttempts = 0;
  recoveryState.lastPrematureEofPos = -1;
  recoveryState.lastPlayAsyncAttemptAt = 0;
  recoveryState.playAsyncInFlight = false;
  recoveryState.healthyStartAt = 0;
  recoveryState.healthyStartPos = 0;
  recoveryState.observedDurationSec = 0;
};

/**
 * Derives a stable identifier for a track across retries.
 */
export const getRecoveryTrackId = (track) => {
  if (!track || typeof track !== 'object') return '';
  return String(
    track._id ||
    track.id ||
    track.youtubeId ||
    (track.title && track.artist ? `${track.title}___${track.artist}` : (track.title || ''))
  );
};

/**
 * Synchronizes per-track recovery counters while preserving counters across retries.
 */
export const syncRecoveryTrackSession = (track, playbackStatusRef) => {
  const trackId = getRecoveryTrackId(track);
  const reqSeq = Number(playbackStatusRef?.current?.requestSeq || 0);
  const isTrackSwitch = trackId !== recoveryState.trackId;
  const isFreshNonRetryPlay = !track?.isRetry && reqSeq > 0 && reqSeq !== recoveryState.lastRequestSeq;

  if (isTrackSwitch || isFreshNonRetryPlay) {
    resetBackgroundRecoveryState();
    recoveryState.trackId = trackId;
    recoveryState.lastRequestSeq = reqSeq;
  } else if (reqSeq > 0 && reqSeq !== recoveryState.lastRequestSeq) {
    recoveryState.lastRequestSeq = reqSeq;
  }
};

/**
 * Clears any armed stall recovery and post-recovery verification timers.
 */
export const clearStallRecoveryTimer = (stallRecoveryTimerRef) => {
  if (stallRecoveryTimerRef?.current) {
    clearTimeout(stallRecoveryTimerRef.current);
    stallRecoveryTimerRef.current = null;
  }
  clearWatchdogTimer();
};

/**
 * Records steady playback progress so transient blips hours apart do not exhaust the retry budget.
 */
export const noteHealthyPlayback = ({ currentTime, statusDurSec, isBuffering, positionAdvanced, stallRecoveryTimerRef }) => {
  if (statusDurSec > recoveryState.observedDurationSec) {
    recoveryState.observedDurationSec = statusDurSec;
  }
  if (!isBuffering || positionAdvanced) {
    clearStallRecoveryTimer(stallRecoveryTimerRef);
  }
  if (!isBuffering && recoveryState.stallAttempts > 0) {
    const now = Date.now();
    if (!recoveryState.healthyStartAt) {
      recoveryState.healthyStartAt = now;
      recoveryState.healthyStartPos = currentTime;
    } else if (
      now - recoveryState.healthyStartAt >= HEALTHY_RESET_ELAPSED_MS ||
      currentTime - recoveryState.healthyStartPos >= HEALTHY_RESET_PROGRESS_SEC
    ) {
      recoveryState.stallAttempts = 0;
      recoveryState.healthyStartAt = 0;
      recoveryState.healthyStartPos = 0;
    }
  }
};

const stripCacheBuster = (url) => {
  if (!url || typeof url !== 'string') return '';
  return url.replace(/([?&])_t=\d+(&|$)/, (_, sep, trailing) => (trailing === '&' ? sep : '')).replace(/[?&]$/, '');
};

const normalizeStreamUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  return url.startsWith('/') ? `${API_BASE_URL}${url}` : url;
};

const appendCacheBuster = (url) => {
  const clean = stripCacheBuster(normalizeStreamUrl(url));
  if (!clean) return '';
  return `${clean}${clean.includes('?') ? '&' : '?'}_t=${Date.now()}`;
};

/**
 * Builds a clean retry track object for either live radio or on-demand/Quran streams.
 */
export const buildRecoveryRetryTrack = (cur, attemptIndex = 0, preferPrimaryFirst = false) => {
  if (!cur) return null;
  const isLive = Boolean(isRadioTrack(cur) || cur.isLive);
  const origAudio = cur._originalAudioUrl !== undefined ? cur._originalAudioUrl : (cur.audioUrl || '');

  if (isLive) {
    const origFallback = cur._originalFallbackUrl !== undefined ? cur._originalFallbackUrl : (cur.fallbackUrl || '');
    const cleanPrimary = stripCacheBuster(normalizeStreamUrl(origAudio));
    const cleanFallback = stripCacheBuster(normalizeStreamUrl(origFallback));
    const hasDistinctFallback = Boolean(cleanFallback && cleanFallback !== cleanPrimary);
    const useFallback = hasDistinctFallback && (preferPrimaryFirst ? attemptIndex % 2 === 1 : attemptIndex % 2 === 0);

    return {
      ...cur,
      _originalAudioUrl: origAudio,
      _originalFallbackUrl: origFallback,
      audioUrl: useFallback ? origAudio : (cleanPrimary ? appendCacheBuster(origAudio) : origAudio),
      fallbackUrl: useFallback ? appendCacheBuster(origFallback) : null,
      resolvedAudioUrl: null,
      isRetry: true,
      _clearCache: true,
    };
  }

  const isEphemeralGoogleUrl = typeof origAudio === 'string' && origAudio.includes('googlevideo.com') && Boolean(cur.youtubeId || cur.title);
  return {
    ...cur,
    _originalAudioUrl: origAudio,
    audioUrl: isEphemeralGoogleUrl ? '' : origAudio,
    resolvedAudioUrl: null,
    isRetry: true,
    _clearCache: true,
  };
};

const clearTrackCaches = (cur) => {
  const tid = String(cur?._id || cur?.id || '');
  if (tid) clearStreamCache(tid);
  if (cur?.youtubeId && String(cur.youtubeId) !== tid) {
    clearStreamCache(String(cur.youtubeId));
  }
};

const fallbackOrPause = ({ playNextTrack, setIsPlaying, notifyPaused }) => {
  if (typeof playNextTrack === 'function') {
    playNextTrack();
    return;
  }
  if (typeof setIsPlaying === 'function') setIsPlaying(false);
  notifyPaused?.();
};

const canRecover = (ctx) => Boolean(
  ctx?.shouldBePlayingRef?.current &&
  !ctx?.isLoadingRef?.current &&
  !ctx?.isSeekingRef?.current &&
  !ctx?.interruptedByOsRef?.current
);

const executeRecoveryPlayTrack = async (ctx, { attemptIndex = 0, resumeSec = null, preferPrimaryFirst = false } = {}) => {
  const { currentTrackRef, queueRef, playbackStatusRef, shouldBePlayingRef, isLoadingRef, interruptedByOsRef, isPlayingRef, stallRecoveryTimerRef, playTrack } = ctx;
  const cur = currentTrackRef?.current;
  if (!cur || !shouldBePlayingRef?.current || isLoadingRef?.current || interruptedByOsRef?.current) return;

  const expectedTrackId = getRecoveryTrackId(cur);
  await ensureBackgroundAudioMode(true).catch(() => false);

  if (!shouldBePlayingRef?.current || isLoadingRef?.current || interruptedByOsRef?.current || getRecoveryTrackId(currentTrackRef?.current) !== expectedTrackId) {
    return;
  }

  clearTrackCaches(cur);
  const isLive = Boolean(isRadioTrack(cur) || cur.isLive);
  const retryTrack = buildRecoveryRetryTrack(cur, attemptIndex, preferPrimaryFirst);
  const targetSec = isLive ? 0 : Math.max(0, Number(resumeSec ?? playbackStatusRef?.current?.currentTime) || 0);

  clearWatchdogTimer();
  if (typeof playTrack === 'function' && retryTrack) {
    playTrack(retryTrack, queueRef?.current || [], true, targetSec, false, false, true);
    recoveryState.watchdogTimer = setTimeout(() => {
      recoveryState.watchdogTimer = null;
      if (
        !shouldBePlayingRef?.current || isLoadingRef?.current || interruptedByOsRef?.current ||
        isPlayingRef?.current || getRecoveryTrackId(currentTrackRef?.current) !== expectedTrackId ||
        stallRecoveryTimerRef?.current
      ) {
        return;
      }
      scheduleBackgroundRecovery({ ...ctx, isSeekingRef: null, isError: true });
    }, RECOVERY_VERIFY_MS);
  }
};

/**
 * Schedules a backed-off foreground or background recovery attempt, or advances once retries exhaust.
 */
export const scheduleBackgroundRecovery = (ctx) => {
  const { currentTrackRef, soundRef, stallRecoveryTimerRef, isError = false, interruptedByOsRef, shouldBePlayingRef } = ctx;
  if (!canRecover(ctx) || stallRecoveryTimerRef?.current || !currentTrackRef?.current || interruptedByOsRef?.current || !shouldBePlayingRef?.current) return;

  if (recoveryState.stallAttempts >= MAX_STALL_RECOVERY_ATTEMPTS) {
    fallbackOrPause(ctx);
    return;
  }

  const attemptIndex = recoveryState.stallAttempts;
  const isBackground = AppState?.currentState !== 'active';
  const table = isError ? ERROR_RETRY_DELAYS_MS : (isBackground ? BACKGROUND_STALL_DELAYS_MS : FOREGROUND_STALL_DELAYS_MS);
  const delayMs = table[Math.min(attemptIndex, table.length - 1)];

  recoveryState.healthyStartAt = 0;
  recoveryState.healthyStartPos = 0;

  stallRecoveryTimerRef.current = setTimeout(async () => {
    stallRecoveryTimerRef.current = null;
    if (!canRecover(ctx) || interruptedByOsRef?.current || !shouldBePlayingRef?.current) return;

    const activeSound = soundRef?.current;
    if (!isError && activeSound && typeof activeSound.getStatusAsync === 'function') {
      try {
        const liveStatus = await activeSound.getStatusAsync();
        if (liveStatus?.isLoaded && liveStatus?.isPlaying && !liveStatus?.isBuffering) return;
      } catch {}
    }
    if (!canRecover(ctx) || interruptedByOsRef?.current || !shouldBePlayingRef?.current) return;

    if (recoveryState.stallAttempts >= MAX_STALL_RECOVERY_ATTEMPTS) {
      fallbackOrPause(ctx);
      return;
    }

    const currentAttempt = recoveryState.stallAttempts;
    recoveryState.stallAttempts += 1;
    await executeRecoveryPlayTrack(ctx, { attemptIndex: currentAttempt });
  }, delayMs);
};

/**
 * Handles `!status.isLoaded && status.error` with backed-off retries before advancing.
 */
export const handlePlaybackError = (ctx) => {
  clearStallRecoveryTimer(ctx.stallRecoveryTimerRef);
  if (!ctx.shouldBePlayingRef?.current || ctx.isLoadingRef?.current || ctx.interruptedByOsRef?.current) return;
  scheduleBackgroundRecovery({ ...ctx, isError: true });
};

/**
 * Attempts `playAsync()` before treating a pause event as an OS interruption,
 * and keeps stall recovery armed in both foreground and background.
 */
export const handlePlaybackStallOrInterruption = (ctx) => {
  const { status, soundRef, shouldBePlayingRef, isLoadingRef, isSeekingRef, interruptedByOsRef, isPlayingRef, setIsPlaying, stallRecoveryTimerRef, notifyPaused } = ctx;
  if (!shouldBePlayingRef?.current || isLoadingRef?.current || isSeekingRef?.current || interruptedByOsRef?.current) {
    clearStallRecoveryTimer(stallRecoveryTimerRef);
    return;
  }

  const isBackground = AppState?.currentState !== 'active';

  // If already marked as interrupted or app is in background while unbuffered pause occurred (external app playing sound)
  if (interruptedByOsRef?.current || (isBackground && !status?.isBuffering)) {
    if (interruptedByOsRef) interruptedByOsRef.current = true;
    if (shouldBePlayingRef) shouldBePlayingRef.current = false;
    clearStallRecoveryTimer(stallRecoveryTimerRef);
    if (isPlayingRef?.current && typeof setIsPlaying === 'function') {
      setIsPlaying(false);
      notifyPaused?.();
    }
    return;
  }

  if (!status?.isBuffering && soundRef?.current) {
    const now = Date.now();
    if (!recoveryState.playAsyncInFlight && now - recoveryState.lastPlayAsyncAttemptAt >= PLAY_ASYNC_COOLDOWN_MS) {
      recoveryState.playAsyncInFlight = true;
      recoveryState.lastPlayAsyncAttemptAt = now;
      const targetSound = soundRef.current;

      targetSound.playAsync().then((playStatus) => {
        recoveryState.playAsyncInFlight = false;
        if (!shouldBePlayingRef?.current || soundRef?.current !== targetSound || isLoadingRef?.current || interruptedByOsRef?.current) return;
        if (playStatus?.isPlaying) {
          if (interruptedByOsRef) interruptedByOsRef.current = false;
          if (!isPlayingRef?.current && typeof setIsPlaying === 'function') setIsPlaying(true);
          if (!playStatus.isBuffering) clearStallRecoveryTimer(stallRecoveryTimerRef);
        }
      }).catch(() => {
        recoveryState.playAsyncInFlight = false;
        if (interruptedByOsRef) interruptedByOsRef.current = true;
        if (shouldBePlayingRef) shouldBePlayingRef.current = false;
        if (typeof setIsPlaying === 'function') setIsPlaying(false);
        notifyPaused?.();
        clearStallRecoveryTimer(stallRecoveryTimerRef);
      });
    }
    return;
  }

  if (!interruptedByOsRef?.current && shouldBePlayingRef?.current) {
    scheduleBackgroundRecovery({ ...ctx, isError: false });
  }
};

/**
 * Intercepts premature `didJustFinish` on long streams (e.g. GoogleVideo 403/EOF)
 * and live radio disconnects, recovering playback instead of ending the track.
 */
export const tryRecoverPrematureFinish = (ctx) => {
  const { cur, status, newCurrentTime, statusDurSec, newDuration, isLiveStream, shouldBePlayingRef, isLoadingRef, interruptedByOsRef, playbackStatusRef, stallRecoveryTimerRef } = ctx;
  if (!cur || !status?.didJustFinish || !shouldBePlayingRef?.current || isLoadingRef?.current || interruptedByOsRef?.current) {
    return false;
  }

  if (isLiveStream) {
    if (recoveryState.stallAttempts >= MAX_STALL_RECOVERY_ATTEMPTS) return false;
    clearStallRecoveryTimer(stallRecoveryTimerRef);
    const attemptIndex = recoveryState.stallAttempts;
    recoveryState.stallAttempts += 1;
    recoveryState.healthyStartAt = 0;
    recoveryState.healthyStartPos = 0;
    executeRecoveryPlayTrack(ctx, { attemptIndex, resumeSec: 0, preferPrimaryFirst: true });
    return true;
  }

  const effectiveCurTime = newCurrentTime > 0 ? newCurrentTime : Math.max(0, Number(playbackStatusRef?.current?.currentTime) || 0);
  const knownPlayerDur = Math.max(statusDurSec, recoveryState.observedDurationSec);
  const isPrematureEof = (
    newDuration > 120 &&
    effectiveCurTime < newDuration - 30 &&
    (statusDurSec === 0 || effectiveCurTime < statusDurSec - 20 || (knownPlayerDur > 120 && statusDurSec < knownPlayerDur - 30))
  );
  if (!isPrematureEof) return false;

  const nearSamePos = recoveryState.lastPrematureEofPos >= 0 && Math.abs(effectiveCurTime - recoveryState.lastPrematureEofPos) <= 20;
  if (nearSamePos && recoveryState.prematureEofAttempts >= MAX_PREMATURE_EOF_AT_SAME_POS) return false;

  if (nearSamePos) {
    recoveryState.prematureEofAttempts += 1;
  } else {
    recoveryState.lastPrematureEofPos = effectiveCurTime;
    recoveryState.prematureEofAttempts = 1;
  }

  clearStallRecoveryTimer(stallRecoveryTimerRef);
  executeRecoveryPlayTrack(ctx, {
    attemptIndex: Math.max(0, recoveryState.prematureEofAttempts - 1),
    resumeSec: effectiveCurTime,
  });
  return true;
};
