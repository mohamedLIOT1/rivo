import { useRef, useEffect, useCallback } from 'react';
import { serializeQueueForStorage } from './webQueueStorage';

/**
 * Debounced queue & playback position persistence (>= 4s interval + synchronous flush on pause/unload).
 */
export function useWebQueuePersistence({
  currentTrackRef,
  currentQueueRef,
  currentQueueIndexRef,
  queueContextRef,
  currentTimeRef,
  currentQueue,
  currentQueueIndex,
  queueContext,
  isPlaying,
}) {
  const persistTimerRef = useRef(null);

  const flushQueuePersistence = useCallback(() => {
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    try {
      const track = currentTrackRef.current;
      if (track) {
        const { lyrics, ...liteTrack } = track;
        localStorage.setItem('rivo_last_played_track', JSON.stringify(liteTrack));
      }
      const q = currentQueueRef.current;
      if (Array.isArray(q) && q.length > 0) {
        const { items, adjustedIndex } = serializeQueueForStorage(q, currentQueueIndexRef.current, 100);
        localStorage.setItem('rivo_last_played_queue', JSON.stringify(items));
        localStorage.setItem('rivo_last_played_queue_index', String(adjustedIndex));
      }
      if (queueContextRef.current) {
        localStorage.setItem('rivo_last_played_queue_context', JSON.stringify(queueContextRef.current));
      }
      const curSec = Math.max(0, Number(currentTimeRef.current) || 0);
      localStorage.setItem('rivo_last_played_time', String(Math.floor(curSec)));
    } catch {}
  }, [currentTrackRef, currentQueueRef, currentQueueIndexRef, queueContextRef, currentTimeRef]);

  const scheduleQueuePersistence = useCallback(
    (delayMs = 4000) => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => {
        persistTimerRef.current = null;
        flushQueuePersistence();
      }, delayMs);
    },
    [flushQueuePersistence]
  );

  useEffect(() => {
    scheduleQueuePersistence(4000);
  }, [currentQueue, currentQueueIndex, queueContext, scheduleQueuePersistence]);

  useEffect(() => {
    if (!isPlaying) {
      flushQueuePersistence();
      return;
    }
    const interval = setInterval(() => {
      try {
        const curSec = Math.max(0, Number(currentTimeRef.current) || 0);
        localStorage.setItem('rivo_last_played_time', String(Math.floor(curSec)));
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [isPlaying, flushQueuePersistence, currentTimeRef]);

  useEffect(() => {
    const onUnload = () => flushQueuePersistence();
    window.addEventListener('beforeunload', onUnload);
    window.addEventListener('pagehide', onUnload);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      window.removeEventListener('pagehide', onUnload);
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [flushQueuePersistence]);

  return { flushQueuePersistence };
}
