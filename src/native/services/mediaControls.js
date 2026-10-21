import { NativeModules, DeviceEventEmitter, NativeEventEmitter, Platform } from 'react-native';

const { RivoMediaControls } = NativeModules;

import { API_BASE_URL } from '../config';

const normalizeCoverUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('data:')) {
    return trimmed;
  }
  if (trimmed.startsWith('file://')) {
    return trimmed;
  }
  if (trimmed.startsWith('/var/') || trimmed.startsWith('/private/var/') || trimmed.startsWith('/Users/')) {
    return trimmed;
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return `${API_BASE_URL}${trimmed}`;
  }
  if (trimmed.startsWith('http://')) {
    return `https://${trimmed.slice(7)}`;
  }
  return trimmed;
};

export const showMediaNotification = (
  track,
  isPlaying = true,
  repeatMode = 'off',
  isShuffle = false,
  isLiked = false
) => {
  if (!RivoMediaControls) return;
  try {
    const rawCover = track?.coverUrl || track?.cover || '';
    const safeRepeatMode = typeof repeatMode === 'string'
      ? repeatMode
      : (repeatMode ? 'all' : 'off');
    RivoMediaControls.showNotification({
      title: track?.title || 'Unknown Track',
      artist: track?.artist || 'Unknown Artist',
      coverUrl: normalizeCoverUrl(rawCover),
      isPlaying: Boolean(isPlaying),
      repeatMode: safeRepeatMode,
      isRepeat: safeRepeatMode !== 'off',
      isShuffle: Boolean(isShuffle),
      isLiked: Boolean(isLiked !== undefined ? isLiked : (track?.liked || track?.isLiked)),
      duration: Number(track?.duration || 240),
      currentTime: Number(track?.currentTime !== undefined ? track.currentTime : 0),
    });
  } catch (e) {
    // Graceful fallback
  }
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
    const safeRepeatMode = typeof repeatMode === 'string'
      ? repeatMode
      : (repeatMode ? 'all' : 'off');
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
      payload.coverUrl = normalizeCoverUrl(track.coverUrl || track.cover || '');
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

export const subscribeToMediaActions = (callback) => {
  if (!RivoMediaControls) return () => {};
  try {
    const emitter = Platform.OS === 'ios'
      ? new NativeEventEmitter(RivoMediaControls)
      : DeviceEventEmitter;

    const subscription = emitter.addListener('onMediaAction', (action) => {
      if (callback) callback(action);
    });
    return () => {
      subscription.remove();
    };
  } catch (e) {
    return () => {};
  }
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
  if (!RivoMediaControls || !RivoMediaControls.installApk) {
    return;
  }
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
  if (!RivoMediaControls) return () => {};
  try {
    const emitter = Platform.OS === 'ios'
      ? new NativeEventEmitter(RivoMediaControls)
      : DeviceEventEmitter;

    const subscription = emitter.addListener('onOpenChatFromNotification', (data) => {
      if (callback) callback(data);
    });
    return () => {
      subscription.remove();
    };
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

