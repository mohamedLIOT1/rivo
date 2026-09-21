import { NativeModules, DeviceEventEmitter, Platform } from 'react-native';

const { RivoMediaControls } = NativeModules;

export const showMediaNotification = (track, isPlaying = true, isRepeat = false, isShuffle = false) => {
  if (Platform.OS !== 'android' || !RivoMediaControls) return;
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
  if (Platform.OS !== 'android' || !RivoMediaControls) return;
  try {
    const payload = {
      isPlaying: Boolean(isPlaying),
      isRepeat: Boolean(isRepeat),
      isShuffle: Boolean(isShuffle),
    };
    if (track) {
      payload.title = track.title || 'Unknown Track';
      payload.artist = track.artist || 'Unknown Artist';
    }
    RivoMediaControls.updatePlayback(payload);
  } catch (e) {}
};

export const hideMediaNotification = () => {
  if (Platform.OS !== 'android' || !RivoMediaControls) return;
  try {
    RivoMediaControls.hideNotification();
  } catch (e) {}
};

export const subscribeToMediaActions = (callback) => {
  if (Platform.OS !== 'android') return () => {};
  const subscription = DeviceEventEmitter.addListener('onMediaAction', (action) => {
    if (callback) callback(action);
  });
  return () => {
    subscription.remove();
  };
};
