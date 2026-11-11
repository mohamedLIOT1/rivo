import { useEffect, useRef, useCallback } from 'react';
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

  const syncNotificationMetadata = useCallback(() => {
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

      if (syncStateRef.current.trackKey !== trackKey) {
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

      const repeatMode = queueRef?.current?.repeatMode || 'off';
      const isShuffle = Boolean(queueRef?.current?.isShuffleRef?.current ?? queueRef?.current?.isShuffle);

      if (isLive) {
        if (!syncStateRef.current.isLive) {
          syncStateRef.current.isLive = true;
          syncStateRef.current.duration = 0;
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

      const elapsedSec = Math.max(0, (now - syncStateRef.current.lastSyncTs) / 1000);
      const expectedPos = syncStateRef.current.isPlaying
        ? (syncStateRef.current.lastPos + elapsedSec)
        : syncStateRef.current.lastPos;
      const durationChanged = bestDur > 5 && Math.abs(bestDur - syncStateRef.current.duration) > 2;
      const positionJumped = Math.abs(curPos - expectedPos) >= 5;

      if (durationChanged || positionJumped) {
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
      } else {
        syncStateRef.current.lastPos = curPos;
        syncStateRef.current.lastSyncTs = now;
        syncStateRef.current.isPlaying = isPlaying;
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

    const handleMediaAction = (action, payload) => {
      try {
        const act = typeof action === 'string' ? action : action?.action || '';
        if (act === 'play') {
          if (!playbackRef.current?.isPlayingRef?.current) {
            playbackRef.current?.togglePlay?.();
          }
        } else if (act === 'pause') {
          if (playbackRef.current?.isPlayingRef?.current) {
            playbackRef.current?.togglePlay?.();
          }
        } else if (act === 'play_pause' || act === 'toggle') {
          playbackRef.current?.togglePlay?.();
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
          if (!playbackRef.current?.isPlayingRef?.current) {
            playbackRef.current?.togglePlay?.();
          }
        } catch (_e) {}
      },
      onPause: () => {
        try {
          if (playbackRef.current?.isPlayingRef?.current) {
            playbackRef.current?.togglePlay?.();
          }
        } catch (_e) {}
      },
      onPlayPause: () => {
        try {
          playbackRef.current?.togglePlay?.();
        } catch (_e) {}
      },
      togglePlay: () => {
        try {
          playbackRef.current?.togglePlay?.();
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
