import { useEffect, useRef, useCallback } from 'react';
import { AppState } from 'react-native';
import { applyStandardAudioMode } from './audioModeConfig';
import {
  subscribeToMediaActions,
  checkNotificationPermission,
  requestNotificationPermission,
  updateLockScreenLyrics,
  updateMediaNotification,
} from '../../services/mediaControls';
import { isRadioTrack } from '../../../utils/quranUtils';
import { sanitizeDuration } from '../../../utils/streamRecoveryHelper';

export const useAudioMediaSession = ({ playbackRef, queueRef, lyrics }) => {
  const isMountedRef = useRef(true);
  const syncStateRef = useRef({
    trackKey: '',
    duration: 0,
    isPlaying: false,
    isLive: false,
    lastPos: 0,
    lastSyncTs: 0,
    probeCount: 0,
    probing: false,
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    updateLockScreenLyrics(lyrics);
  }, [lyrics]);

  const syncNotificationMetadata = useCallback((forceSync = false) => {
    try {
      const pb = playbackRef?.current;
      if (!pb) return;
      const cur = pb.currentTrackRef?.current || pb.currentTrack;
      if (!cur) return;

      const trackKey = String(cur._id || cur.id || cur.youtubeId || cur.title || '');
      if (!trackKey) return;

      const isLive = Boolean(cur.isLive || isRadioTrack(cur));
      const isPlaying = Boolean(pb.isPlayingRef?.current ?? pb.isPlaying);
      const statusDur = sanitizeDuration(pb.playbackStatusRef?.current?.duration, 0);
      const trackDur = sanitizeDuration(cur.duration, 0);
      const curPos = Math.max(0, Math.round(Number(pb.playbackStatusRef?.current?.currentTime || 0)));
      const now = Date.now();
      const repeatMode = queueRef?.current?.repeatMode || 'off';
      const isShuffle = Boolean(queueRef?.current?.isShuffleRef?.current ?? queueRef?.current?.isShuffle);

      const isTrackSwitch = syncStateRef.current.trackKey !== trackKey;
      if (isTrackSwitch) {
        syncStateRef.current = {
          trackKey,
          duration: isLive ? 0 : trackDur,
          isPlaying,
          isLive,
          lastPos: curPos,
          lastSyncTs: now,
          probeCount: 0,
          probing: false,
        };
      }

      if (isLive) {
        if (forceSync === true || isTrackSwitch || !syncStateRef.current.isLive || syncStateRef.current.isPlaying !== isPlaying) {
          syncStateRef.current.isLive = true;
          syncStateRef.current.duration = 0;
          syncStateRef.current.isPlaying = isPlaying;
          syncStateRef.current.lastSyncTs = now;
          updateMediaNotification(isPlaying, repeatMode, isShuffle, undefined, {
            ...cur,
            isLive: true,
            duration: 0,
            currentTime: 0,
          });
        }
        return;
      }

      const bestDur = statusDur > 5 ? statusDur : (trackDur > 5 ? trackDur : (statusDur > 0 ? statusDur : trackDur));

      // Fallback probe for progressive streams where track.duration was missing and status duration lagged
      if (
        isPlaying &&
        trackDur === 0 &&
        (bestDur === 0 || bestDur === 240) &&
        syncStateRef.current.probeCount < 3 &&
        !syncStateRef.current.probing &&
        typeof pb.soundRef?.current?.getStatusAsync === 'function'
      ) {
        syncStateRef.current.probing = true;
        syncStateRef.current.probeCount += 1;
        const expectedKey = trackKey;
        pb.soundRef.current.getStatusAsync().then((st) => {
          if (!isMountedRef.current || syncStateRef.current.trackKey !== expectedKey) return;
          if (st?.isLoaded && st.durationMillis > 1000) {
            const nativeDur = sanitizeDuration(Math.floor(st.durationMillis / 1000), 0);
            if (nativeDur > 5 && Math.abs(nativeDur - syncStateRef.current.duration) > 2) {
              const latestPb = playbackRef?.current;
              const latestPlaying = Boolean(latestPb?.isPlayingRef?.current ?? latestPb?.isPlaying);
              const nativePos = Math.max(0, Math.round((st.positionMillis || 0) / 1000));
              syncStateRef.current.duration = nativeDur;
              syncStateRef.current.lastPos = nativePos;
              syncStateRef.current.lastSyncTs = Date.now();
              syncStateRef.current.isPlaying = latestPlaying;
              updateMediaNotification(
                latestPlaying,
                queueRef?.current?.repeatMode || 'off',
                Boolean(queueRef?.current?.isShuffleRef?.current ?? queueRef?.current?.isShuffle),
                undefined,
                { ...cur, duration: nativeDur, currentTime: nativePos }
              );
            }
          }
        }).catch(() => {}).finally(() => {
          if (syncStateRef.current.trackKey === expectedKey) {
            syncStateRef.current.probing = false;
          }
        });
      }

      // Compare live position against the clock last sent to MPNowPlayingInfoCenter (do NOT reset baseline on skipped ticks!)
      const elapsedSec = Math.max(0, (now - syncStateRef.current.lastSyncTs) / 1000);
      const expectedPos = syncStateRef.current.isPlaying
        ? (syncStateRef.current.lastPos + elapsedSec)
        : syncStateRef.current.lastPos;
      const playStateChanged = syncStateRef.current.isPlaying !== isPlaying;
      const durationChanged = bestDur > 5 && Math.abs(bestDur - syncStateRef.current.duration) > 2;
      const positionDrifted = Math.abs(curPos - expectedPos) >= 2.5;
      const heartbeatDue = isPlaying && (now - syncStateRef.current.lastSyncTs >= 10000);

      if (forceSync === true || isTrackSwitch || playStateChanged || durationChanged || positionDrifted || heartbeatDue) {
        const syncDur = bestDur > 0 ? bestDur : syncStateRef.current.duration;
        syncStateRef.current.duration = syncDur;
        syncStateRef.current.lastPos = curPos;
        syncStateRef.current.lastSyncTs = now;
        syncStateRef.current.isPlaying = isPlaying;
        updateMediaNotification(isPlaying, repeatMode, isShuffle, undefined, {
          ...cur,
          duration: syncDur,
          currentTime: curPos,
        });
      }
    } catch (_err) {}
  }, [playbackRef, queueRef]);

  const curTrack = playbackRef?.current?.currentTrack;
  const curPlaying = Boolean(playbackRef?.current?.isPlaying);
  const curLoading = Boolean(playbackRef?.current?.isLoading);

  useEffect(() => {
    syncNotificationMetadata();
  }, [curTrack, curPlaying, curLoading, syncNotificationMetadata]);

  useEffect(() => {
    applyStandardAudioMode();

    // Ensure notification permission is requested gracefully for Lock Screen & Dynamic Island
    checkNotificationPermission().then((allowed) => {
      if (!allowed) {
        requestNotificationPermission().catch(() => {});
      }
    }).catch(() => {});

    const syncTimer = setInterval(syncNotificationMetadata, 1000);
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        syncNotificationMetadata(true);
      }
    });

    const handleRemotePlay = () => {
      const pb = playbackRef.current;
      if (!pb) return;
      if (!pb.isPlayingRef?.current) {
        pb.togglePlay?.(true);
      } else if (!pb.soundRef?.current) {
        pb.togglePlay?.(true);
      } else {
        // Handle case where sound is paused in audio engine
        pb.soundRef.current.getStatusAsync?.().then((st) => {
          if (st?.isLoaded && !st.isPlaying) {
            pb.soundRef.current.playAsync?.().catch(() => {});
            if (pb.shouldBePlayingRef) pb.shouldBePlayingRef.current = true;
          }
        }).catch(() => {});
      }
    };

    const handleRemotePause = () => {
      const pb = playbackRef.current;
      if (!pb) return;
      if (typeof pb.pause === 'function') {
        pb.pause();
      } else if (pb.isPlayingRef?.current) {
        pb.togglePlay?.(true);
      } else {
        pb.soundRef?.current?.pauseAsync?.().catch(() => {});
        if (pb.shouldBePlayingRef) pb.shouldBePlayingRef.current = false;
        if (pb.isPlayingRef) pb.isPlayingRef.current = false;
        pb.setIsPlaying?.(false);
      }
    };

    const handleRemotePlayPause = () => {
      playbackRef.current?.togglePlay?.(true);
    };

    const handleMediaAction = (action, payload) => {
      try {
        const act = typeof action === 'string' ? action : action?.action || '';
        if (act === 'play') {
          handleRemotePlay();
        } else if (act === 'pause') {
          handleRemotePause();
        } else if (act === 'play_pause' || act === 'toggle') {
          handleRemotePlayPause();
        } else if (act === 'next') {
          queueRef.current?.playNextTrack?.();
        } else if (act === 'prev' || act === 'previous') {
          queueRef.current?.playPrevTrack?.();
        } else if (act.startsWith('seek:') || act === 'seek') {
          const pos = payload ?? (act.startsWith('seek:') ? parseFloat(act.slice(5)) : 0);
          playbackRef.current?.seekTo?.(pos);
        } else if (act.startsWith('play_queue_index:')) {
          const idx = parseInt(act.slice('play_queue_index:'.length), 10);
          const q = queueRef.current?.queueRef?.current;
          if (!isNaN(idx) && idx >= 0 && Array.isArray(q) && q[idx]) {
            playbackRef.current?.playTrack?.(q[idx], q);
          }
        } else if (act === 'interruption_ended_resume') {
          const pb = playbackRef.current;
          if (pb?.shouldBePlayingRef?.current && !pb?.isPlayingRef?.current && pb?.soundRef?.current) {
            pb.soundRef.current.playAsync().then(() => {
              if (!isMountedRef.current) return;
              pb.isPlayingRef.current = true;
              pb.setIsPlaying?.(true);
              syncNotificationMetadata();
            }).catch(() => {});
          }
        } else if (act === 'interruption_began' || act === 'interruption_ended') {
          // Handled via native AVAudioSession & playbackEngine without clearing shouldBePlayingRef
        }
      } catch (_err) {}
    };

    const sub = subscribeToMediaActions({
      onPlay: () => {
        try {
          handleRemotePlay();
        } catch (_e) {}
      },
      onPause: () => {
        try {
          handleRemotePause();
        } catch (_e) {}
      },
      onPlayPause: () => {
        try {
          handleRemotePlayPause();
        } catch (_e) {}
      },
      togglePlay: () => {
        try {
          handleRemotePlayPause();
        } catch (_e) {}
      },
      onNext: () => {
        try {
          queueRef.current?.playNextTrack?.();
        } catch (_e) {}
      },
      onPrev: () => {
        try {
          queueRef.current?.playPrevTrack?.();
        } catch (_e) {}
      },
      onSeek: (posSec) => {
        try {
          playbackRef.current?.seekTo?.(posSec);
        } catch (_e) {}
      },
      onAction: handleMediaAction,
    });

    return () => {
      clearInterval(syncTimer);
      try { appStateSub?.remove?.(); } catch (_e) {}
      try {
        if (typeof sub === 'function') {
          sub();
        } else if (sub && typeof sub.remove === 'function') {
          sub.remove();
        }
      } catch (_e) {}
    };
  }, [playbackRef, queueRef, syncNotificationMetadata]);
};
