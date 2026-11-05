import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateMediaNotification } from '../../services/mediaControls';
import { updateAudioProgress } from '../AudioProgressContext';
import { reanchorDocumentUri } from '../../services/download/storageManifestService';

export const LAST_PLAYED_TRACK_KEY = 'rivo_last_played_track';
export const LAST_PLAYED_TRACK_FALLBACK_KEY = 'last_played_track';
export const LAST_QUEUE_KEY = 'rivo_last_queue';
export const LAST_QUEUE_FALLBACK_KEY = 'last_queue';
export const LAST_POSITION_KEY = 'rivo_last_position';
export const LAST_POSITION_FALLBACK_KEY = 'last_position';

let pendingSaveTimer = null;

const sanitizeTrackForPersistence = (t) => {
  if (!t) return null;
  return {
    id: t.id || t._id,
    _id: t._id || t.id,
    title: t.title,
    artist: t.artist,
    album: t.album,
    cover: t.cover,
    coverUrl: t.coverUrl,
    audioUrl: t.audioUrl,
    duration: t.duration,
    localAudioUri: t.localAudioUri,
    nativeAudioUri: t.nativeAudioUri,
    isQuran: t.isQuran,
  };
};

/**
 * Save last played track, queue, and playback position to AsyncStorage (debounced to avoid main-thread disk lag)
 */
export const saveLastPlayedState = (track, queue = [], position = 0) => {
  if (!track || !track.title) return;
  if (pendingSaveTimer) {
    clearTimeout(pendingSaveTimer);
  }
  pendingSaveTimer = setTimeout(async () => {
    try {
      const safePos = Math.max(0, Number(position) || 0);
      const safeTrack = {
        ...sanitizeTrackForPersistence(track),
        currentTime: safePos,
      };
      const trackStr = JSON.stringify(safeTrack);
      const safeQueueList = (Array.isArray(queue) && queue.length > 0 ? queue.slice(0, 30) : [safeTrack])
        .map(sanitizeTrackForPersistence)
        .filter(Boolean);
      const queueStr = JSON.stringify(safeQueueList);
      const posStr = String(safePos);

      await AsyncStorage.multiSet([
        [LAST_PLAYED_TRACK_KEY, trackStr],
        [LAST_PLAYED_TRACK_FALLBACK_KEY, trackStr],
        [LAST_QUEUE_KEY, queueStr],
        [LAST_QUEUE_FALLBACK_KEY, queueStr],
        [LAST_POSITION_KEY, posStr],
        [LAST_POSITION_FALLBACK_KEY, posStr],
      ]);
    } catch (err) {
      // Non-blocking disk write
    }
  }, 3000);
};

/**
 * Load last played track, queue, and playback position from AsyncStorage
 */
export const loadLastPlayedState = async () => {
  try {
    const [rawTrack, rawTrackAlt, rawQueue, rawQueueAlt, rawPos, rawPosAlt] = await Promise.all([
      AsyncStorage.getItem(LAST_PLAYED_TRACK_KEY).catch(() => null),
      AsyncStorage.getItem(LAST_PLAYED_TRACK_FALLBACK_KEY).catch(() => null),
      AsyncStorage.getItem(LAST_QUEUE_KEY).catch(() => null),
      AsyncStorage.getItem(LAST_QUEUE_FALLBACK_KEY).catch(() => null),
      AsyncStorage.getItem(LAST_POSITION_KEY).catch(() => null),
      AsyncStorage.getItem(LAST_POSITION_FALLBACK_KEY).catch(() => null),
    ]);

    const trackJson = rawTrack || rawTrackAlt;
    const queueJson = rawQueue || rawQueueAlt;
    const posStr = rawPos || rawPosAlt;

    let track = null;
    let queue = [];
    let position = 0;

    if (trackJson) {
      try {
        const parsed = JSON.parse(trackJson);
        if (parsed && (parsed.title || parsed.id || parsed._id)) {
          track = {
            ...parsed,
            localAudioUri: reanchorDocumentUri(parsed.localAudioUri),
            nativeAudioUri: reanchorDocumentUri(parsed.nativeAudioUri),
            audioUrl: reanchorDocumentUri(parsed.audioUrl),
          };
        }
      } catch (e) {}
    }

    if (queueJson) {
      try {
        const parsedQ = JSON.parse(queueJson);
        if (Array.isArray(parsedQ)) {
          queue = parsedQ
            .filter((t) => t && (t.title || t.id || t._id))
            .map((t) => ({
              ...t,
              localAudioUri: reanchorDocumentUri(t.localAudioUri),
              nativeAudioUri: reanchorDocumentUri(t.nativeAudioUri),
              audioUrl: reanchorDocumentUri(t.audioUrl),
            }));
        }
      } catch (e) {}
    }

    if (posStr !== null && posStr !== undefined) {
      const parsedPos = parseFloat(posStr);
      if (!isNaN(parsedPos) && parsedPos > 0) {
        position = parsedPos;
      }
    } else if (track && typeof track.currentTime === 'number' && track.currentTime > 0) {
      position = track.currentTime;
    }

    if (track && queue.length === 0) {
      queue = [track];
    }

    return { track, queue, position };
  } catch (err) {
    return { track: null, queue: [], position: 0 };
  }
};

/**
 * Custom hook to restore last played track & queue on cold boot
 */
export const useAudioPersistence = ({
  currentTrackRef,
  setCurrentTrack,
  queueRef,
  setQueue,
  playbackStatusRef,
  progressRef,
  repeatModeRef,
  isShuffleRef,
}) => {
  const isHydratedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const hydrate = async () => {
      try {
        const { track, queue, position } = await loadLastPlayedState();
        if (!isMounted) return;

        // Only restore if currentTrack is not yet loaded (cold boot)
        if (track && !currentTrackRef.current) {
          isHydratedRef.current = true;
          currentTrackRef.current = track;
          setCurrentTrack?.(track);

          if (Array.isArray(queue) && queue.length > 0 && (!queueRef.current || queueRef.current.length === 0)) {
            queueRef.current = queue;
            setQueue?.(queue);
          }

          const safePos = Math.max(0, Number(position) || 0);
          const safeDur = Number(track.duration || 0);

          if (playbackStatusRef?.current) {
            playbackStatusRef.current.currentTime = safePos;
            playbackStatusRef.current.duration = safeDur;
          }
          if (progressRef?.current) {
            progressRef.current.currentTime = safePos;
            progressRef.current.duration = safeDur;
          }
          updateAudioProgress({ currentTime: safePos, duration: safeDur });

          try {
            updateMediaNotification(
              false,
              repeatModeRef?.current || 'off',
              isShuffleRef?.current || false,
              false,
              {
                ...track,
                currentTime: safePos,
                duration: safeDur || 240,
              }
            );
          } catch (e) {}
        }
      } catch (err) {
        // Cold boot hydration fallback
      }
    };

    hydrate();

    return () => {
      isMounted = false;
    };
  }, [
    currentTrackRef,
    setCurrentTrack,
    queueRef,
    setQueue,
    playbackStatusRef,
    progressRef,
    repeatModeRef,
    isShuffleRef,
  ]);

  return { isHydratedRef };
};
