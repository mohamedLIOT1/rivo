import { useEffect } from 'react';
import { applyStandardAudioMode } from './audioModeConfig';
import {
  subscribeToMediaActions,
  checkNotificationPermission,
  requestNotificationPermission,
} from '../../services/mediaControls';

export const useAudioMediaSession = ({ playbackRef, queueRef }) => {
  useEffect(() => {
    applyStandardAudioMode();

    // Ensure notification permission is requested gracefully for Lock Screen & Dynamic Island
    checkNotificationPermission().then((allowed) => {
      if (!allowed) {
        requestNotificationPermission().catch(() => {});
      }
    }).catch(() => {});

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
      try {
        if (typeof sub === 'function') {
          sub();
        } else if (sub && typeof sub.remove === 'function') {
          sub.remove();
        }
      } catch (_e) {}
    };
  }, [playbackRef, queueRef]);
};
