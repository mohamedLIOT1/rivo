import { NativeModules, DeviceEventEmitter, NativeEventEmitter, Platform, PermissionsAndroid, Linking } from 'react-native';
import { normalizeCoverUri } from '../utils/coverUtils';
import { isRadioTrack } from '../../utils/quranUtils';

const { RivoMediaControls } = NativeModules;

const MAX_NOTIFICATION_DURATION_SEC = 86400; // 24 hours (matches sanitizeDuration)

let lastNotificationState = {
  trackKey: '',
  duration: 0,
  isLive: false,
  isLiked: false,
};

function sanitizeNotificationSeconds(rawVal, allowZero = false) {
  if (rawVal === undefined || rawVal === null || rawVal === '') return null;
  const num = Number(rawVal);
  if (!Number.isFinite(num) || Number.isNaN(num)) return null;
  if (num < 0 || (!allowZero && num === 0)) return null;
  if (num > MAX_NOTIFICATION_DURATION_SEC) {
    const inSec = Math.round(num / 1000);
    if (inSec > 0 && inSec <= MAX_NOTIFICATION_DURATION_SEC) return inSec;
    return allowZero ? 0 : null;
  }
  return Math.round(num);
}

function getTrackIdentityKey(track) {
  if (!track || typeof track !== 'object') return '';
  const id = track._id || track.id || track.youtubeId || track.ytId;
  if (id) return `id:${String(id)}`;
  const title = String(track.title || track.name || '').trim();
  const artist = String(track.artist || '').trim();
  return title ? `meta:${title}:::${artist}` : '';
}

function buildPlaybackPayload({ track, isPlaying, repeatMode, isShuffle, isLiked, isInitialShow }) {
  const safeRepeatMode = typeof repeatMode === 'string' ? repeatMode : (repeatMode ? 'all' : 'off');
  const resolvedIsLiked = (isLiked !== undefined && isLiked !== null)
    ? Boolean(isLiked)
    : ((track && (track.liked !== undefined || track.isLiked !== undefined))
        ? Boolean(track.liked || track.isLiked)
        : lastNotificationState.isLiked);
  lastNotificationState.isLiked = resolvedIsLiked;

  const payload = {
    isPlaying: Boolean(isPlaying),
    repeatMode: safeRepeatMode,
    isRepeat: safeRepeatMode !== 'off',
    isShuffle: Boolean(isShuffle),
    isLiked: resolvedIsLiked,
  };
  if (!track) return payload;

  const isLive = Boolean(track.isLive || isRadioTrack(track));
  const trackKey = getTrackIdentityKey(track);
  const isNewTrack = Boolean(isInitialShow || (trackKey && lastNotificationState.trackKey && trackKey !== lastNotificationState.trackKey));
  const resetMeta = isNewTrack || !lastNotificationState.trackKey || lastNotificationState.isLive;

  payload.isLive = isLive;
  payload.title = track.title || 'Unknown Track';
  payload.artist = track.artist || 'Unknown Artist';
  const rawCover = track.coverUrl || track.cover || track.coverImage || track.thumbnail || '';
  payload.coverUrl = normalizeCoverUri(rawCover, track);

  if (isLive) {
    payload.duration = 0;
    payload.currentTime = 0;
    lastNotificationState.duration = 0;
  } else {
    const sanitizedDur = sanitizeNotificationSeconds(track.duration, false);
    if (sanitizedDur !== null) {
      payload.duration = sanitizedDur;
      lastNotificationState.duration = sanitizedDur;
    } else {
      payload.duration = resetMeta ? 0 : (lastNotificationState.duration > 0 ? lastNotificationState.duration : 0);
      if (resetMeta) lastNotificationState.duration = 0;
    }

    const sanitizedTime = sanitizeNotificationSeconds(track.currentTime, true);
    if (sanitizedTime !== null) {
      payload.currentTime = sanitizedTime;
    } else if (resetMeta) {
      payload.currentTime = 0;
    }
  }

  lastNotificationState = {
    trackKey: trackKey || lastNotificationState.trackKey,
    duration: lastNotificationState.duration,
    isLive,
    isLiked: resolvedIsLiked,
  };
  return payload;
}

export const showMediaNotification = (
  track,
  isPlaying = true,
  repeatMode = 'off',
  isShuffle = false,
  isLiked = undefined
) => {
  if (!RivoMediaControls) return;
  try {
    RivoMediaControls.showNotification(
      buildPlaybackPayload({ track, isPlaying, repeatMode, isShuffle, isLiked, isInitialShow: true })
    );
  } catch (e) {}
};

export const updateMediaNotification = (
  isPlaying,
  repeatMode = 'off',
  isShuffle = false,
  isLiked = undefined,
  track = null
) => {
  if (!RivoMediaControls) return;
  try {
    RivoMediaControls.updatePlayback(
      buildPlaybackPayload({ track, isPlaying, repeatMode, isShuffle, isLiked, isInitialShow: false })
    );
  } catch (e) {}
};

export const hideMediaNotification = () => {
  if (!RivoMediaControls) return;
  try {
    lastNotificationState = { trackKey: '', duration: 0, isLive: false, isLiked: false };
    RivoMediaControls.hideNotification();
  } catch (e) {}
};

export const updateMediaQueue = (queue = [], currentTrack = null) => {
  if (!RivoMediaControls || typeof RivoMediaControls.updateQueue !== 'function') return;
  try {
    const safeQueue = Array.isArray(queue) ? queue.slice(0, 100) : [];
    const sanitized = safeQueue.map((t, idx) => ({
      id: String(t?._id || t?.id || idx),
      title: String(t?.title || 'Unknown Track'),
      artist: String(t?.artist || 'Unknown Artist'),
    }));
    const currentId = currentTrack ? String(currentTrack._id || currentTrack.id || '') : '';
    RivoMediaControls.updateQueue(sanitized, currentId);
  } catch (e) {}
};

export const updateLockScreenLyrics = (lyrics) => {
  if (!RivoMediaControls || typeof RivoMediaControls.updateLyrics !== 'function') return;
  try {
    if (!lyrics) {
      RivoMediaControls.updateLyrics(null);
      return;
    }
    if (Array.isArray(lyrics)) {
      const sanitized = lyrics
        .slice(0, 300)
        .map((item, idx) => ({
          time: typeof item?.time === 'number' && !isNaN(item.time) ? item.time : idx * 5,
          text: String(item?.text || '').trim(),
        }))
        .filter((item) => item.text.length > 0);
      RivoMediaControls.updateLyrics(sanitized);
    } else if (typeof lyrics === 'string') {
      RivoMediaControls.updateLyrics(lyrics);
    } else {
      RivoMediaControls.updateLyrics(null);
    }
  } catch (e) {}
};

export const subscribeToMediaActions = (callbackOrHandlers) => {
  const noop = () => {};
  noop.remove = noop;
  if (!RivoMediaControls || !callbackOrHandlers) return noop;
  try {
    const emitter = Platform.OS === 'ios'
      ? new NativeEventEmitter(RivoMediaControls)
      : DeviceEventEmitter;

    const subscription = emitter.addListener('onMediaAction', (rawAction) => {
      try {
        if (!rawAction) return;

        if (typeof callbackOrHandlers === 'function') {
          callbackOrHandlers(rawAction);
          return;
        }

        if (typeof callbackOrHandlers === 'object' && callbackOrHandlers !== null) {
          let actionName = '';
          let seekPos = null;

          if (typeof rawAction === 'string') {
            const trimmed = rawAction.trim();
            if (trimmed.startsWith('seek:')) {
              actionName = 'seek';
              const parsed = parseFloat(trimmed.slice(5));
              seekPos = isNaN(parsed) ? 0 : parsed;
            } else {
              actionName = trimmed;
            }
          } else if (typeof rawAction === 'object') {
            actionName = rawAction.action || rawAction.name || rawAction.type || '';
            if (typeof actionName === 'string' && actionName.startsWith('seek:')) {
              const parsed = parseFloat(actionName.slice(5));
              seekPos = isNaN(parsed) ? 0 : parsed;
              actionName = 'seek';
            }
            const rawPos = rawAction.position ?? rawAction.pos ?? rawAction.currentTime ?? rawAction.seconds;
            if (rawPos !== undefined && rawPos !== null) {
              const parsed = Number(rawPos);
              seekPos = isNaN(parsed) ? 0 : parsed;
            }
          }

          const normalized = String(actionName || '').toLowerCase().trim();

          switch (normalized) {
            case 'play':
              if (typeof callbackOrHandlers.onPlay === 'function') callbackOrHandlers.onPlay();
              else if (typeof callbackOrHandlers.onPlayPause === 'function') callbackOrHandlers.onPlayPause();
              else if (typeof callbackOrHandlers.togglePlay === 'function') callbackOrHandlers.togglePlay();
              break;
            case 'pause':
              if (typeof callbackOrHandlers.onPause === 'function') callbackOrHandlers.onPause();
              else if (typeof callbackOrHandlers.onPlayPause === 'function') callbackOrHandlers.onPlayPause();
              else if (typeof callbackOrHandlers.togglePlay === 'function') callbackOrHandlers.togglePlay();
              break;
            case 'play_pause':
            case 'playpause':
            case 'toggle':
            case 'toggleplay':
              if (typeof callbackOrHandlers.onPlayPause === 'function') callbackOrHandlers.onPlayPause();
              else if (typeof callbackOrHandlers.togglePlay === 'function') callbackOrHandlers.togglePlay();
              else if (typeof callbackOrHandlers.onPlay === 'function') callbackOrHandlers.onPlay();
              break;
            case 'next':
              callbackOrHandlers.onNext?.();
              break;
            case 'prev':
            case 'previous':
              callbackOrHandlers.onPrev?.() || callbackOrHandlers.onPrevious?.();
              break;
            case 'seek':
              callbackOrHandlers.onSeek?.(seekPos !== null ? seekPos : 0);
              break;
            case 'like':
              callbackOrHandlers.onLike?.();
              break;
            case 'repeat':
              callbackOrHandlers.onRepeat?.();
              break;
            case 'shuffle':
              callbackOrHandlers.onShuffle?.();
              break;
            case 'forward':
              callbackOrHandlers.onForward?.();
              break;
            default:
              if (typeof callbackOrHandlers[actionName] === 'function') {
                callbackOrHandlers[actionName](seekPos);
              } else if (typeof callbackOrHandlers.onAction === 'function') {
                callbackOrHandlers.onAction(rawAction, seekPos);
              }
              break;
          }
        }
      } catch (handlerErr) {}
    });

    const unsubscribe = () => {
      try {
        if (subscription && typeof subscription.remove === 'function') {
          subscription.remove();
        }
      } catch (e) {}
    };
    unsubscribe.remove = unsubscribe;
    return unsubscribe;
  } catch (e) {
    return noop;
  }
};

export const checkNotificationPermission = async () => {
  if (Platform.OS === 'ios') return true;
  if (RivoMediaControls && typeof RivoMediaControls.checkNotificationPermission === 'function') {
    try {
      const res = await RivoMediaControls.checkNotificationPermission();
      if (typeof res === 'boolean') return res;
    } catch (e) {}
  }
  if (Platform.OS === 'android') {
    if (Platform.Version >= 33) {
      try {
        return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      } catch (e) {}
    }
    return true;
  }
  return false;
};

export const requestNotificationPermission = async () => {
  if (Platform.OS === 'ios') return true;
  if (RivoMediaControls && typeof RivoMediaControls.requestNotificationPermission === 'function') {
    try {
      const res = await RivoMediaControls.requestNotificationPermission();
      if (res === true) return true;
    } catch (e) {}
  }
  if (Platform.OS === 'android') {
    if (Platform.Version >= 33) {
      try {
        const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        return res === PermissionsAndroid.RESULTS.GRANTED;
      } catch (e) {}
    }
    return true;
  }
  return false;
};

export const openNotificationSettings = async () => {
  if (RivoMediaControls && typeof RivoMediaControls.openNotificationSettings === 'function') {
    try {
      const res = await RivoMediaControls.openNotificationSettings();
      if (res) return true;
    } catch (e) {}
  }
  try {
    if (Linking && typeof Linking.openSettings === 'function') {
      await Linking.openSettings();
      return true;
    }
  } catch (e) {}
  return false;
};

export const showChatNotification = (options) => {
  if (!RivoMediaControls || !RivoMediaControls.showChatNotification) return;
  try {
    RivoMediaControls.showChatNotification({
      senderId: String(options.senderId || options.sender || ''),
      senderName: String(options.senderName || options.title || 'Friend'),
      message: String(options.message || options.body || options.preview || ''),
      isJam: Boolean(options.isJam),
      roomCode: options.roomCode ? String(options.roomCode) : undefined,
    });
  } catch (e) {}
};

export const dismissChatNotification = (senderId) => {
  if (!RivoMediaControls || !RivoMediaControls.dismissChatNotification) return;
  try {
    RivoMediaControls.dismissChatNotification(String(senderId));
  } catch (e) {}
};

export const dismissAllChatNotifications = () => {
  if (!RivoMediaControls || !RivoMediaControls.dismissAllChatNotifications) return;
  try {
    RivoMediaControls.dismissAllChatNotifications();
  } catch (e) {}
};

export const installApk = async (filePath) => {
  if (!RivoMediaControls || !RivoMediaControls.installApk) return;
  return RivoMediaControls.installApk(filePath);
};

export const getInitialChatSenderId = async () => {
  if (!RivoMediaControls || !RivoMediaControls.getInitialChatSenderId) return null;
  try {
    return await RivoMediaControls.getInitialChatSenderId();
  } catch (e) {
    return null;
  }
};

export const subscribeToChatNotification = (callback) => {
  if (!RivoMediaControls || Platform.OS === 'ios') return () => {};
  try {
    const emitter = DeviceEventEmitter;

    const subscription = emitter.addListener('onOpenChatFromNotification', (data) => {
      if (callback) callback(data);
    });
    return () => { subscription.remove(); };
  } catch (e) {
    return () => {};
  }
};

export const applyOtaBundle = async (filePath) => RivoMediaControls?.applyOtaBundle?.(filePath) ?? null;
export const reloadApp = async () => RivoMediaControls?.reloadApp?.() ?? false;
export const clearOtaBundle = async () => RivoMediaControls?.clearOtaBundle?.() ?? false;
export const getOtaInfo = async () => RivoMediaControls?.getOtaInfo?.() ?? { exists: false, size: 0 };

export const exitAndRemoveTask = async () => {
  try {
    await RivoMediaControls?.exitAndRemoveTask?.();
    return true;
  } catch (e) {
    return false;
  }
};

export const hasNativeProcessRestart = () => {
  return Boolean(RivoMediaControls && typeof RivoMediaControls.exitAndRemoveTask === 'function');
};

export const setLockScreenEnabled = (enabled) => {
  try {
    RivoMediaControls?.setLockScreenEnabled?.(Boolean(enabled));
  } catch (e) {}
};

export const isLockScreenEnabled = async () => {
  try {
    return (await RivoMediaControls?.isLockScreenEnabled?.()) ?? true;
  } catch (e) {
    return true;
  }
};

export const canDrawOverlays = async () => {
  if (Platform.OS !== 'android') return true;
  try {
    return (await RivoMediaControls?.canDrawOverlays?.()) ?? true;
  } catch (e) {
    return true;
  }
};

export const requestOverlayPermission = async () => {
  if (Platform.OS !== 'android') return true;
  try {
    if (await RivoMediaControls?.requestOverlayPermission?.()) return true;
    if (Linking?.openSettings) {
      await Linking.openSettings();
      return true;
    }
  } catch (e) {}
  return false;
};
