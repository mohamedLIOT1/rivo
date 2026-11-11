import { updateAudioProgress } from '../AudioProgressContext';
import { isQuranContent, isRadioTrack } from '../../../utils/quranUtils';
import { calculateCrossfadeGains } from '../../utils/musicAnalysis';
import { recordListeningTick, flushListeningStats } from './audioApiHelpers';
import {
  syncRecoveryTrackSession,
  clearStallRecoveryTimer,
  noteHealthyPlayback,
  handlePlaybackError,
  handlePlaybackStallOrInterruption,
  tryRecoverPrematureFinish,
} from './backgroundRecoveryHelper';

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
  const notifyMediaState = (playing) => {
    if (typeof updateMediaNotification !== 'function') return;
    const cur = currentTrackRef.current;
    const isLikedTrack = cur ? likedTrackIds.some(id => String(id) === String(cur._id || cur.id)) : false;
    updateMediaNotification(
      playing,
      repeatModeRef?.current || 'off',
      isShuffleRef?.current || false,
      isLikedTrack,
      cur
    );
  };

  if (!status.isLoaded) {
    if (status.error) {
      syncRecoveryTrackSession(currentTrackRef.current, playbackStatusRef);
      handlePlaybackError({
        currentTrackRef,
        queueRef,
        playbackStatusRef,
        shouldBePlayingRef,
        isLoadingRef,
        isSeekingRef,
        interruptedByOsRef,
        soundRef,
        isPlayingRef,
        stallRecoveryTimerRef,
        playTrack,
        playNextTrack,
        setIsPlaying,
        notifyPaused: () => notifyMediaState(false),
      });
    }
    return;
  }

  // Safety: Ensure sound matches active track before mutating playback state
  const curTrack = currentTrackRef.current;
  const currentActiveId = String(curTrack?._id || curTrack?.id || '');
  if (loadedTrackIdRef.current && currentActiveId && loadedTrackIdRef.current !== currentActiveId) {
    if (soundRef.current) {
      soundRef.current.stopAsync().catch(() => {});
      soundRef.current.unloadAsync().catch(() => {});
    }
    return;
  }

  syncRecoveryTrackSession(curTrack, playbackStatusRef);

  const newCurrentTime = Math.floor((status.positionMillis || 0) / 1000);
  const statusDurSec = Math.floor((status.durationMillis || 0) / 1000);
  const isLiveStream = Boolean(curTrack && (isRadioTrack(curTrack) || curTrack.isLive));
  const knownDur = Number(curTrack?.duration || playbackStatusRef.current?.duration || 0);
  const hasRealDuration = !isLiveStream && (knownDur > 0 || statusDurSec > 1);

  const newDuration = isLiveStream
    ? (statusDurSec > 1 ? statusDurSec : knownDur)
    : (statusDurSec > 1 && (knownDur <= 0 || statusDurSec > knownDur + 5))
      ? statusDurSec
      : (knownDur > 0 ? knownDur : (statusDurSec > 1 ? statusDurSec : 240));

  const clampedCurrentTime = (!isLiveStream && newDuration > 0 && newCurrentTime > newDuration)
    ? newDuration
    : newCurrentTime;
  const positionAdvanced = playbackStatusRef.current.currentTime !== clampedCurrentTime;

  const isFinished = Boolean(
    status.didJustFinish ||
    (hasRealDuration && statusDurSec > 5 && newCurrentTime >= statusDurSec - 1) ||
    (hasRealDuration && newDuration > 5 && newCurrentTime >= Math.max(1, newDuration - 1))
  );

  // Synchronize playing state with native player & run background-capable recovery
  if (status.isPlaying) {
    noteHealthyPlayback({
      currentTime: clampedCurrentTime,
      statusDurSec,
      isBuffering: Boolean(status.isBuffering),
      positionAdvanced,
      stallRecoveryTimerRef,
    });
    if (interruptedByOsRef) interruptedByOsRef.current = false;
    if (shouldBePlayingRef) shouldBePlayingRef.current = true;
    if (!isPlayingRef?.current && typeof setIsPlaying === 'function') {
      setIsPlaying(true);
      notifyMediaState(true);
    }
  } else if (!shouldBePlayingRef?.current) {
    clearStallRecoveryTimer(stallRecoveryTimerRef);
    if (isPlayingRef?.current && typeof setIsPlaying === 'function') {
      setIsPlaying(false);
      notifyMediaState(false);
    }
  } else if (!isLoadingRef?.current && !isSeekingRef?.current && !status.didJustFinish && !isFinished) {
    handlePlaybackStallOrInterruption({
      status,
      soundRef,
      currentTrackRef,
      queueRef,
      playbackStatusRef,
      shouldBePlayingRef,
      isLoadingRef,
      isSeekingRef,
      interruptedByOsRef,
      isPlayingRef,
      setIsPlaying,
      stallRecoveryTimerRef,
      playTrack,
      playNextTrack,
      notifyPaused: () => notifyMediaState(false),
    });
  }

  if (isSeekingRef.current || (Date.now() - (lastSeekTimestampRef.current || 0) < 1200)) {
    return;
  }

  if (positionAdvanced) {
    playbackStatusRef.current = { ...playbackStatusRef.current, currentTime: clampedCurrentTime, duration: newDuration };
    progressRef.current = { currentTime: clampedCurrentTime, duration: newDuration };

    // High-frequency isolation: Dispatches directly to AudioProgressContext listeners
    updateAudioProgress({ currentTime: clampedCurrentTime, duration: newDuration });

    if (status.isPlaying && curTrack) {
      recordListeningTick(curTrack, 1);
    }

    // RIVO DJ ENGINE: Dual-Player Lookahead Crossfade with Smooth Volume Ramping
    if (isMixModeRef?.current && !isLiveStream && status.isPlaying && statusDurSec > 10) {
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
    curTrack?._id ||
    curTrack?.id ||
    curTrack?.youtubeId ||
    (curTrack?.title && curTrack?.artist ? `${curTrack.title}___${curTrack.artist}` : '')
  );

  // If track restarts or is early in playback, clear completion handled flag so loops/repeats work
  if (newCurrentTime < 2 && trackCompletionHandledRef?.current === curActiveId && !status.didJustFinish) {
    trackCompletionHandledRef.current = null;
  }

  if (isFinished) {
    if (curActiveId && trackCompletionHandledRef?.current === curActiveId) {
      return;
    }

    const recovered = tryRecoverPrematureFinish({
      cur: curTrack,
      status,
      newCurrentTime,
      statusDurSec,
      newDuration,
      isLiveStream,
      shouldBePlayingRef,
      isLoadingRef,
      interruptedByOsRef,
      playbackStatusRef,
      stallRecoveryTimerRef,
      soundRef,
      currentTrackRef,
      queueRef,
      isPlayingRef,
      playTrack,
      playNextTrack,
      setIsPlaying,
      notifyPaused: () => notifyMediaState(false),
    });
    if (recovered) {
      return;
    }

    clearStallRecoveryTimer(stallRecoveryTimerRef);

    if (trackCompletionHandledRef && curActiveId) {
      trackCompletionHandledRef.current = curActiveId;
    }
    if (isMixTransitioningRef?.current) {
      return;
    }
    const finishedTrack = curTrack ? {
      ...curTrack,
      resolvedAudioUrl: curTrack.resolvedAudioUrl || soundRef?.current?._uri || null,
      duration: newDuration || curTrack.duration,
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
