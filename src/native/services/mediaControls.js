import { NativeModules, DeviceEventEmitter, NativeEventEmitter, Platform } from 'react-native';

const { RivoMediaControls } = NativeModules;

import { API_BASE_URL } from '../config';

const normalizeCoverUrl = (url) => {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
    return `${API_BASE_URL}${trimmed}`;
  }
  return trimmed;
};

export const showMediaNotification = (track, isPlaying = true, isRepeat = false, isShuffle = false) => {
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
      duration: Number(track?.duration || 240),
      currentTime: Number(track?.currentTime || 0),
    });
  } catch (e) {
    // Graceful fallback
  }
};

export const updateMediaNotification = (isPlaying, isRepeat = false, isShuffle = false, track = null) => {
  if (!RivoMediaControls) return;
  try {
    const payload = {
      isPlaying: Boolean(isPlaying),
      isRepeat: Boolean(isRepeat),
      isShuffle: Boolean(isShuffle),
    };
    if (track) {
      payload.title = track.title || 'Unknown Track';
      payload.artist = track.artist || 'Unknown Artist';
      payload.coverUrl = normalizeCoverUrl(track.coverUrl || track.cover || '');
      if (track.duration) payload.duration = Number(track.duration);
      if (track.currentTime) payload.currentTime = Number(track.currentTime);
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
