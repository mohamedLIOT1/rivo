import { updateAudioProgress } from '../AudioProgressContext';
import { clearStreamCache } from '../../services/youtubeResolver';
import { isQuranContent } from '../../../utils/quranUtils';

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
    if (shouldBePlayingRef.current && !isPlayingRef?.current && typeof setIsPlaying === 'function') {
      setIsPlaying(true);
    }
  } else if (!status.isBuffering && !isLoadingRef?.current && !shouldBePlayingRef?.current) {
    if (isPlayingRef?.current && typeof setIsPlaying === 'function') {
      setIsPlaying(false);
    }
  }

  // Stall & Auto-play watchdog: If AVPlayer is paused or buffering when shouldBePlaying is true
  if (status.isPlaying === false && shouldBePlayingRef.current && !isLoadingRef.current && !isSeekingRef.current) {
    if (!status.isBuffering && soundRef.current) {
      soundRef.current.playAsync().then(() => {
        if (typeof setIsPlaying === 'function') setIsPlaying(true);
      }).catch(() => {});
    }

    if (!stallRecoveryTimerRef.current) {
      stallRecoveryTimerRef.current = setTimeout(() => {
        stallRecoveryTimerRef.current = null;
        if (shouldBePlayingRef.current && !isLoadingRef.current && soundRef.current) {
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

  if (playbackStatusRef.current.currentTime !== newCurrentTime) {
    playbackStatusRef.current = { ...playbackStatusRef.current, currentTime: newCurrentTime, duration: newDuration };
    progressRef.current = { currentTime: newCurrentTime, duration: newDuration };

    // High-frequency isolation: Dispatches directly to AudioProgressContext listeners
    updateAudioProgress({ currentTime: newCurrentTime, duration: newDuration });

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

          const remTime = newDuration - newCurrentTime;
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
            const gainA = Math.cos((p * Math.PI) / 2);
            const gainB = Math.sin((p * Math.PI) / 2);
            if (soundRef?.current) {
              soundRef.current.setVolumeAsync(Math.max(0.01, masterVol * gainA)).catch(() => {});
            }
            if (nextSoundRef.current) {
              nextSoundRef.current.setVolumeAsync(Math.max(0.01, masterVol * gainB)).catch(() => {});
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

  if (status.didJustFinish) {
    const finishedTrack = currentTrackRef.current;
    if (finishedTrack) {
      autoPersistFinishedTrack?.(finishedTrack);
      if (autoDownloadFinishedRef?.current && handleDownloadTrack) {
        handleDownloadTrack(finishedTrack, true);
      }
    }

    if (repeatModeRef?.current === 'one') {
      if (soundRef?.current) {
        soundRef.current.replayAsync().catch(() => {});
      }
      return;
    }

    if (playNextTrack) {
      playNextTrack();
    }
  }
};
