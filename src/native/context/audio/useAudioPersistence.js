import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateMediaNotification } from '../../services/mediaControls';
import { updateAudioProgress } from '../AudioProgressContext';
import { reanchorDocumentUri } from '../../services/download/storageManifestService';
import {
  prewarmTrackStream,
  sanitizeDuration,
  isStreamUrlLikelyExpired,
} from '../../services/youtubeResolver';
import { isRadioTrack } from '../../../utils/quranUtils';

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
    youtubeId: t.youtubeId,
    source: t.source,
    duration: sanitizeDuration(t.duration, 0),
    localAudioUri: t.localAudioUri,
    nativeAudioUri: t.nativeAudioUri,
    isQuran: t.isQuran,
    isPodcast: t.isPodcast,
    contentType: t.contentType,
    isRadio: t.isRadio,
    isLive: t.isLive,
    fallbackUrl: t.fallbackUrl,
  };
};

const sanitizeHydratedTrack = (rawTrack) => {
  if (!rawTrack || typeof rawTrack !== 'object') return null;
  if (!rawTrack.title && !rawTrack.id && !rawTrack._id) return null;

  const cleanDuration = sanitizeDuration(rawTrack.duration, 0);
  const reanchoredAudio = reanchorDocumentUri(rawTrack.audioUrl);
  const safeAudioUrl = (
    reanchoredAudio &&
    typeof reanchoredAudio === 'string' &&
    (reanchoredAudio.includes('googlevideo.com') || reanchoredAudio.includes('/api/tracks/stream-proxy')) &&
    isStreamUrlLikelyExpired(reanchoredAudio)
  )
    ? ''
    : reanchoredAudio;

  return {
    ...rawTrack,
    localAudioUri: reanchorDocumentUri(rawTrack.localAudioUri),
    nativeAudioUri: reanchorDocumentUri(rawTrack.nativeAudioUri),
    audioUrl: safeAudioUrl,
    resolvedAudioUrl: null,
    duration: cleanDuration,
  };
};

const sanitizeHydratedPosition = (rawPos, trackDuration = 0) => {
  const num = Number(rawPos);
  if (!isFinite(num) || isNaN(num) || num <= 0) return 0;
  let posSec = num;
  if (posSec > 86400) {
    const converted = Math.round(posSec / 1000);
    posSec = converted <= 86400 ? converted : 0;
  }
  if (trackDuration > 5 && posSec >= trackDuration - 1) {
    return 0;
  }
  return Math.max(0, posSec);
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
        track = sanitizeHydratedTrack(JSON.parse(trackJson));
      } catch (e) {}
    }

    if (queueJson) {
      try {
        const parsedQ = JSON.parse(queueJson);
        if (Array.isArray(parsedQ)) {
          queue = parsedQ.map(sanitizeHydratedTrack).filter(Boolean);
        }
      } catch (e) {}
    }

    if (posStr !== null && posStr !== undefined) {
      position = sanitizeHydratedPosition(parseFloat(posStr), track?.duration || 0);
    } else if (track && typeof track.currentTime === 'number') {
      position = sanitizeHydratedPosition(track.currentTime, track?.duration || 0);
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
    const abortController = new AbortController();

    const hydrate = async () => {
      try {
        const { track, queue, position } = await loadLastPlayedState();
        if (!isMounted || abortController.signal.aborted) return;

        // Only restore if currentTrack is not yet loaded (cold boot)
        if (track && !currentTrackRef.current) {
          const cleanTrack = { ...track, resolvedAudioUrl: null };
          const cleanQueue = Array.isArray(queue)
            ? queue.map((item) => (item ? { ...item, resolvedAudioUrl: null } : item)).filter(Boolean)
            : [];

          isHydratedRef.current = true;
          currentTrackRef.current = cleanTrack;
          setCurrentTrack?.(cleanTrack);

          if (cleanQueue.length > 0 && (!queueRef.current || queueRef.current.length === 0)) {
            queueRef.current = cleanQueue;
            setQueue?.(cleanQueue);
          }

          const safePos = sanitizeHydratedPosition(position, cleanTrack.duration);
          const safeDur = sanitizeDuration(cleanTrack.duration, 0);

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
                ...cleanTrack,
                currentTime: safePos,
                duration: safeDur || 240,
              }
            );
          } catch (e) {}

          const hasLocalFile = Boolean(
            (cleanTrack.localAudioUri && (cleanTrack.localAudioUri.startsWith('file://') || cleanTrack.localAudioUri.startsWith('content://'))) ||
            (cleanTrack.nativeAudioUri && (cleanTrack.nativeAudioUri.startsWith('file://') || cleanTrack.nativeAudioUri.startsWith('content://')))
          );
          const isLiveOrRadio = Boolean(cleanTrack.isRadio || cleanTrack.isLive || isRadioTrack(cleanTrack));
          if (!hasLocalFile && !isLiveOrRadio && !abortController.signal.aborted) {
            prewarmTrackStream(cleanTrack, abortController.signal).catch(() => {});
          }
        }
      } catch (err) {
        // Cold boot hydration fallback
      }
    };

    hydrate();

    return () => {
      isMounted = false;
      abortController.abort();
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
