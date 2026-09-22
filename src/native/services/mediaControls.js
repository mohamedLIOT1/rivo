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
  isRepeat = false,
  isShuffle = false,
  isLiked = false
) => {
  if (!RivoMediaControls) return;
  try {
    const rawCover = track?.coverUrl || track?.cover || '';
    RivoMediaControls.showNotification({
      title: track?.title || 'Unknown Track',
      artist: track?.artist || 'Unknown Artist',
      coverUrl: normalizeCoverUrl(rawCover),
      isPlaying: Boolean(isPlaying),
      isRepeat: Boolean(isRepeat),
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
  isRepeat = false,
  isShuffle = false,
  isLiked = false,
  track = null
) => {
  if (!RivoMediaControls) return;
  try {
    const payload = {
      isPlaying: Boolean(isPlaying),
      isRepeat: Boolean(isRepeat),
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
