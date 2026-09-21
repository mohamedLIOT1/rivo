import { NativeModules, DeviceEventEmitter, NativeEventEmitter, Platform } from 'react-native';

const { RivoMediaControls } = NativeModules;

export const showMediaNotification = (track, isPlaying = true, isRepeat = false, isShuffle = false) => {
  if (!RivoMediaControls) return;
  try {
    RivoMediaControls.showNotification({
      title: track?.title || 'Unknown Track',
      artist: track?.artist || 'Unknown Artist',
      coverUrl: track?.coverUrl || track?.cover || '',
      isPlaying: Boolean(isPlaying),
      isRepeat: Boolean(isRepeat),
      isShuffle: Boolean(isShuffle),
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
      payload.coverUrl = track.coverUrl || track.cover || '';
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
