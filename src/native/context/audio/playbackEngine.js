import { AppState } from 'react-native';
import { updateAudioProgress } from '../AudioProgressContext';
import { clearStreamCache } from '../../services/youtubeResolver';
import { isQuranContent } from '../../../utils/quranUtils';
import { calculateCrossfadeGains } from '../../utils/musicAnalysis';
import { recordListeningTick, flushListeningStats } from './audioApiHelpers';

export const handlePlaybackStatusUpdate = ({
  status,
  playbackStatusRef,
  progressRef,
  currentTrackRef,
  soundRef,
  shouldBePlayingRef,
  isLoadingRef,
  loadedTrackIdRef,
  isSeekingRef,
  lastSeekTimestampRef,
  stallRecoveryTimerRef,
  isMixModeRef,
  activeTransRef,
  queueRef,
  volumeRef,
  lastMixBridgeUpdateRef,
  nextSoundRef,
  nextSoundPlayingRef,
  isMixTransitioningRef,
  completeSeamlessHandoff,
  preloadNextTrackForDjMix,
  playTrack,
  playNextTrack,
  repeatModeRef,
  autoPersistFinishedTrack,
  handleDownloadTrack,
  autoDownloadFinishedRef,
  updateMediaNotification,
  likedTrackIds = [],
  isShuffleRef,
  setIsPlaying,
  isPlayingRef,
  trackCompletionHandledRef,
  interruptedByOsRef,
}) => {
  if (!status.isLoaded) {
    if (status.error) {
      if (stallRecoveryTimerRef.current) {
        clearTimeout(stallRecoveryTimerRef.current);
        stallRecoveryTimerRef.current = null;
      }
      if (shouldBePlayingRef.current && !isLoadingRef.current) {
        const cur = currentTrackRef.current;
        const tid = String(cur?._id || cur?.id || '');
        if (tid) clearStreamCache(tid);
        if (cur && !cur._retryDone) {
          cur._retryDone = true;
          playTrack({ ...cur, resolvedAudioUrl: null, isRetry: true }, queueRef.current, true, playbackStatusRef.current?.currentTime || 0, false, false, true);
        } else if (playNextTrack) {
          playNextTrack();
        }
      }
    }
    return;
  }

  const newCurrentTime = Math.floor((status.positionMillis || 0) / 1000);
  const statusDurSec = Math.floor((status.durationMillis || 0) / 1000);

  // Synchronize playing state with native AVPlayer
  if (status.isPlaying) {
    if (stallRecoveryTimerRef.current) {
      clearTimeout(stallRecoveryTimerRef.current);
      stallRecoveryTimerRef.current = null;
    }
    if (interruptedByOsRef) interruptedByOsRef.current = false;
    if (shouldBePlayingRef) shouldBePlayingRef.current = true;
    if (!isPlayingRef?.current && typeof setIsPlaying === 'function') {
      setIsPlaying(true);
      const cur = currentTrackRef.current;
      const isLikedTrack = cur ? likedTrackIds.some(id => String(id) === String(cur._id || cur.id)) : false;
      if (typeof updateMediaNotification === 'function') {
        updateMediaNotification(
          true,
          repeatModeRef?.current || 'off',
          isShuffleRef?.current || false,
          isLikedTrack,
          cur
        );
      }
    }
  } else if (!status.isBuffering && !isLoadingRef?.current && !isSeekingRef?.current) {
    // If the OS paused audio (interrupted by another app like Reels, video, phone call), update state to paused
    if (shouldBePlayingRef?.current) {
      if (interruptedByOsRef) interruptedByOsRef.current = true;
      if (isPlayingRef?.current && typeof setIsPlaying === 'function') {
        setIsPlaying(false);
        const cur = currentTrackRef.current;
        const isLikedTrack = cur ? likedTrackIds.some(id => String(id) === String(cur._id || cur.id)) : false;
        if (typeof updateMediaNotification === 'function') {
          updateMediaNotification(
            false,
            repeatModeRef?.current || 'off',
            isShuffleRef?.current || false,
            isLikedTrack,
            cur
          );
        }
      }
      if (stallRecoveryTimerRef.current) {
        clearTimeout(stallRecoveryTimerRef.current);
        stallRecoveryTimerRef.current = null;
      }
    } else {
      if (isPlayingRef?.current && typeof setIsPlaying === 'function') {
        setIsPlaying(false);
        const cur = currentTrackRef.current;
        const isLikedTrack = cur ? likedTrackIds.some(id => String(id) === String(cur._id || cur.id)) : false;
        if (typeof updateMediaNotification === 'function') {
          updateMediaNotification(
            false,
            repeatModeRef?.current || 'off',
            isShuffleRef?.current || false,
            isLikedTrack,
            cur
          );
        }
      }
    }
  }

  // Stall & Auto-play watchdog: Only recover if app is in active foreground and genuinely stalled during buffering
  if (status.isPlaying === false && shouldBePlayingRef.current && !isLoadingRef.current && !isSeekingRef.current && !interruptedByOsRef?.current) {
    if (AppState.currentState !== 'active') {
      // Audio focus lost to another app while in background -> cleanly wait without force-retrying
      if (stallRecoveryTimerRef.current) {
        clearTimeout(stallRecoveryTimerRef.current);
        stallRecoveryTimerRef.current = null;
      }
    } else if (status.isBuffering) {
      // Still buffering, wait for buffer
    } else if (soundRef.current) {
      soundRef.current.playAsync().then(() => {
        if (interruptedByOsRef) interruptedByOsRef.current = false;
        if (typeof setIsPlaying === 'function') setIsPlaying(true);
      }).catch(() => {
        // Audio focus rejected by OS (another app has audio focus) -> wait cleanly
        if (interruptedByOsRef) interruptedByOsRef.current = true;
        if (typeof setIsPlaying === 'function') setIsPlaying(false);
      });
    }

    if (!stallRecoveryTimerRef.current && !interruptedByOsRef?.current && AppState.currentState === 'active') {
      stallRecoveryTimerRef.current = setTimeout(() => {
        stallRecoveryTimerRef.current = null;
        if (shouldBePlayingRef.current && !isLoadingRef.current && soundRef.current && !interruptedByOsRef?.current) {
          const cur = currentTrackRef.current;
          const tid = String(cur?._id || cur?.id || '');
          if (tid) clearStreamCache(tid);
          if (cur && !cur._retryDone) {
            cur._retryDone = true;
            playTrack({ ...cur, resolvedAudioUrl: null, isRetry: true }, queueRef.current, true, playbackStatusRef.current?.currentTime || 0, false, false, true);
          } else if (playNextTrack) {
            playNextTrack();
          }
        }
      }, 4500);
    }
  } else if (status.isPlaying) {
    if (stallRecoveryTimerRef.current) {
      clearTimeout(stallRecoveryTimerRef.current);
      stallRecoveryTimerRef.current = null;
    }
  }

  // Safety: Ensure sound matches active track
  const currentActiveId = String(currentTrackRef.current?._id || currentTrackRef.current?.id || '');
  if (loadedTrackIdRef.current && currentActiveId && loadedTrackIdRef.current !== currentActiveId) {
    if (soundRef.current) {
      soundRef.current.stopAsync().catch(() => {});
      soundRef.current.unloadAsync().catch(() => {});
    }
    return;
  }

  if (isSeekingRef.current || (Date.now() - (lastSeekTimestampRef.current || 0) < 1200)) {
    return;
  }

  const knownDur = Number(currentTrackRef.current?.duration || playbackStatusRef.current?.duration || 0);
  const newDuration = (knownDur > 0) ? knownDur : (statusDurSec > 1 ? statusDurSec : 240);
  const clampedCurrentTime = (newDuration > 0 && newCurrentTime > newDuration) ? newDuration : newCurrentTime;

  if (playbackStatusRef.current.currentTime !== clampedCurrentTime) {
    playbackStatusRef.current = { ...playbackStatusRef.current, currentTime: clampedCurrentTime, duration: newDuration };
    progressRef.current = { currentTime: clampedCurrentTime, duration: newDuration };

    // High-frequency isolation: Dispatches directly to AudioProgressContext listeners
    updateAudioProgress({ currentTime: clampedCurrentTime, duration: newDuration });

    if (status.isPlaying && currentTrackRef.current) {
      recordListeningTick(currentTrackRef.current, 1);
    }

    // RIVO DJ ENGINE: Dual-Player Lookahead Crossfade with Smooth Volume Ramping
    if (isMixModeRef?.current && status.isPlaying && statusDurSec > 10) {
      const curTrack = currentTrackRef.current;
      if (!isQuranContent(curTrack)) {
        const curId = String(curTrack?._id || curTrack?.id || '');
        const q = queueRef.current || [];
        const curIdx = q.findIndex(t => String(t._id || t.id) === curId);
        const nextTrack = (curIdx >= 0 && curIdx + 1 < q.length) ? q[curIdx + 1] : q[0];

        if (nextTrack && !isQuranContent(nextTrack)) {
          const nextId = String(nextTrack._id || nextTrack.id || '');
          const pairKey = `${curId}___${nextId}`;
          const transConf = activeTransRef?.current?.[pairKey] || activeTransRef?.current?.[`${curId}_${nextId}`] || {};
          const transDur = Math.max(3, Math.min(12, Number(transConf.duration) || 6));
          const mixInPoint = Number(transConf.mixInPoint) || 0;
          const speedB = Number(transConf.speedB) || 1.0;
          const masterVol = volumeRef?.current !== undefined ? volumeRef.current : 0.8;
          const multA = (transConf.volA !== undefined ? Number(transConf.volA) : 100) / 100;
          const multB = (transConf.volB !== undefined ? Number(transConf.volB) : 100) / 100;
          const style = transConf.style || 'fade';
          const bias = transConf.crossoverBias !== undefined ? Number(transConf.crossoverBias) : 0.5;

          const effectiveOut = (transConf.mixOutPoint && Number(transConf.mixOutPoint) > 0)
            ? Math.min(newDuration, Number(transConf.mixOutPoint))
            : newDuration;
          const remTime = effectiveOut - newCurrentTime;

          if (remTime <= Math.max(12, transDur + 6) && !nextSoundRef?.current && preloadNextTrackForDjMix) {
            preloadNextTrackForDjMix(mixInPoint, speedB);
          }
          if (remTime <= transDur && nextSoundRef?.current && !isMixTransitioningRef?.current) {
            if (!nextSoundPlayingRef?.current) {
              if (nextSoundPlayingRef) nextSoundPlayingRef.current = true;
              nextSoundRef.current.setVolumeAsync(0.01).catch(() => {});
              nextSoundRef.current.playAsync().catch(() => {});
            }
            const p = Math.min(1.0, Math.max(0.0, 1 - (remTime / transDur)));
            const { gainA, gainB } = calculateCrossfadeGains(p, style, bias);
            if (soundRef?.current) {
              soundRef.current.setVolumeAsync(Math.max(0.01, Math.min(1.0, masterVol * gainA * multA))).catch(() => {});
            }
            if (nextSoundRef.current) {
              nextSoundRef.current.setVolumeAsync(Math.max(0.01, Math.min(1.0, masterVol * gainB * multB))).catch(() => {});
            }
          }
          if (remTime <= 1 && nextSoundRef?.current && !isMixTransitioningRef?.current && completeSeamlessHandoff) {
            isMixTransitioningRef.current = true;
            completeSeamlessHandoff();
          }
        }
      }
    }
  }

  const curActiveId = String(
    currentTrackRef.current?._id ||
    currentTrackRef.current?.id ||
    currentTrackRef.current?.youtubeId ||
    (currentTrackRef.current?.title && currentTrackRef.current?.artist ? `${currentTrackRef.current.title}___${currentTrackRef.current.artist}` : '')
  );

  // If track restarts or is early in playback, clear completion handled flag so loops/repeats work
  if (newCurrentTime < 2 && trackCompletionHandledRef?.current === curActiveId && !status.didJustFinish) {
    trackCompletionHandledRef.current = null;
  }

  const isFinished = Boolean(
    status.didJustFinish ||
    (statusDurSec > 5 && newCurrentTime >= statusDurSec - 1) ||
    (newDuration > 5 && newCurrentTime >= Math.max(1, newDuration - 1))
  );

  if (isFinished) {
    const cur = currentTrackRef.current;
    if (curActiveId && trackCompletionHandledRef?.current === curActiveId) {
      return;
    }
    if (trackCompletionHandledRef && curActiveId) {
      trackCompletionHandledRef.current = curActiveId;
    }
    if (isMixTransitioningRef?.current) {
      return;
    }
    const finishedTrack = cur ? {
      ...cur,
      resolvedAudioUrl: cur.resolvedAudioUrl || soundRef?.current?._uri || null,
      duration: newDuration || cur.duration,
    } : null;
    if (finishedTrack) {
      autoPersistFinishedTrack?.(finishedTrack);
      flushListeningStats(null, true);
      const isAutoDownload = autoDownloadFinishedRef?.current ?? true;
      if (isAutoDownload && handleDownloadTrack) {
        handleDownloadTrack(finishedTrack, true);
      }
    }

    if (repeatModeRef?.current === 'one') {
      if (trackCompletionHandledRef) {
        setTimeout(() => {
          if (trackCompletionHandledRef.current === curActiveId) {
            trackCompletionHandledRef.current = null;
          }
        }, 1200);
      }
      if (soundRef?.current) {
        soundRef.current.replayAsync().catch(() => {});
      }
      return;
    }

    if (soundRef?.current) {
      soundRef.current.stopAsync().catch(() => {});
    }

    if (playNextTrack) {
      playNextTrack();
    }
  }
};
