import { NativeModules, DeviceEventEmitter, NativeEventEmitter, Platform, PermissionsAndroid, Linking } from 'react-native';
import { normalizeCoverUri } from '../utils/coverUtils';

const { RivoMediaControls } = NativeModules;

export const showMediaNotification = (
  track,
  isPlaying = true,
  repeatMode = 'off',
  isShuffle = false,
  isLiked = false
) => {
  if (!RivoMediaControls) return;
  try {
    const rawCover = track?.coverUrl || track?.cover || track?.coverImage || track?.thumbnail || '';
    const safeCover = normalizeCoverUri(rawCover, track);
    const safeRepeatMode = typeof repeatMode === 'string' ? repeatMode : (repeatMode ? 'all' : 'off');
    RivoMediaControls.showNotification({
      title: track?.title || 'Unknown Track',
      artist: track?.artist || 'Unknown Artist',
      coverUrl: safeCover,
      isPlaying: Boolean(isPlaying),
      repeatMode: safeRepeatMode,
      isRepeat: safeRepeatMode !== 'off',
      isShuffle: Boolean(isShuffle),
      isLiked: Boolean(isLiked !== undefined ? isLiked : (track?.liked || track?.isLiked)),
      duration: Number(track?.duration || 240),
      currentTime: Number(track?.currentTime !== undefined ? track.currentTime : 0),
    });
  } catch (e) {}
};

export const updateMediaNotification = (
  isPlaying,
  repeatMode = 'off',
  isShuffle = false,
  isLiked = false,
  track = null
) => {
  if (!RivoMediaControls) return;
  try {
    const safeRepeatMode = typeof repeatMode === 'string' ? repeatMode : (repeatMode ? 'all' : 'off');
    const payload = {
      isPlaying: Boolean(isPlaying),
      repeatMode: safeRepeatMode,
      isRepeat: safeRepeatMode !== 'off',
      isShuffle: Boolean(isShuffle),
      isLiked: Boolean(isLiked),
    };
    if (track) {
      payload.title = track.title || 'Unknown Track';
      payload.artist = track.artist || 'Unknown Artist';
      const rawCover = track.coverUrl || track.cover || track.coverImage || track.thumbnail || '';
      payload.coverUrl = normalizeCoverUri(rawCover, track);
      if (track.duration !== undefined && track.duration !== null) {
        payload.duration = Number(track.duration);
      }
      if (track.currentTime !== undefined && track.currentTime !== null) {
        payload.currentTime = Number(track.currentTime);
      }
      if (track.liked !== undefined || track.isLiked !== undefined) {
        payload.isLiked = Boolean(track.liked || track.isLiked);
      }
    }
    RivoMediaControls.updatePlayback(payload);
  } catch (e) {}
};

export const hideMediaNotification = () => {
  if (!RivoMediaControls) return;
  try {
    RivoMediaControls.hideNotification();
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

export const applyOtaBundle = async (filePath) => {
  if (!RivoMediaControls || !RivoMediaControls.applyOtaBundle) return null;
  return RivoMediaControls.applyOtaBundle(filePath);
};

export const reloadApp = async () => {
  if (!RivoMediaControls || !RivoMediaControls.reloadApp) return false;
  return RivoMediaControls.reloadApp();
};

export const clearOtaBundle = async () => {
  if (!RivoMediaControls || !RivoMediaControls.clearOtaBundle) return false;
  return RivoMediaControls.clearOtaBundle();
};

export const getOtaInfo = async () => {
  if (!RivoMediaControls || !RivoMediaControls.getOtaInfo) return { exists: false, size: 0 };
  return RivoMediaControls.getOtaInfo();
};

export const exitAndRemoveTask = async () => {
  if (RivoMediaControls && RivoMediaControls.exitAndRemoveTask) {
    try {
      await RivoMediaControls.exitAndRemoveTask();
      return true;
    } catch (e) {}
  }
  return false;
};

export const hasNativeProcessRestart = () => {
  return Boolean(RivoMediaControls && typeof RivoMediaControls.exitAndRemoveTask === 'function');
};

export const setLockScreenEnabled = (enabled) => {
  if (RivoMediaControls && typeof RivoMediaControls.setLockScreenEnabled === 'function') {
    try {
      RivoMediaControls.setLockScreenEnabled(Boolean(enabled));
    } catch (e) {}
  }
};

export const isLockScreenEnabled = async () => {
  if (RivoMediaControls && typeof RivoMediaControls.isLockScreenEnabled === 'function') {
    try {
      return await RivoMediaControls.isLockScreenEnabled();
    } catch (e) {}
  }
  return true;
};

export const canDrawOverlays = async () => {
  if (Platform.OS !== 'android') return true;
  if (RivoMediaControls && typeof RivoMediaControls.canDrawOverlays === 'function') {
    try {
      return await RivoMediaControls.canDrawOverlays();
    } catch (e) {}
  }
  return true;
};

export const requestOverlayPermission = async () => {
  if (Platform.OS !== 'android') return true;
  if (RivoMediaControls && typeof RivoMediaControls.requestOverlayPermission === 'function') {
    try {
      const res = await RivoMediaControls.requestOverlayPermission();
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
