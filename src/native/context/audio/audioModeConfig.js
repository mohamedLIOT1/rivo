import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from 'expo-av';

export const STANDARD_AUDIO_CONFIG = {
  allowsRecordingIOS: false,
  staysActiveInBackground: true,
  playsInSilentModeIOS: true,
  interruptionModeIOS: InterruptionModeIOS.DoNotMix,
  interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
  shouldDuckAndroid: false, // Ensures playback pauses when external apps (Reels, TikTok, etc.) play audio
  playThroughEarpieceAndroid: false,
};

export const applyStandardAudioMode = async () => {
  try {
    await Audio.setAudioModeAsync(STANDARD_AUDIO_CONFIG);
  } catch (err) {
    console.warn('[AudioMode] Failed to set audio mode:', err);
  }
};
