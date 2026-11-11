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

let lastAudioModeAppliedAt = 0;
let pendingAudioModePromise = null;
const AUDIO_MODE_REFRESH_COOLDOWN_MS = 5000;

/**
 * Applies Rivo's standard background-capable audio session configuration.
 */
export const applyStandardAudioMode = async () => {
  try {
    await Audio.setAudioModeAsync(STANDARD_AUDIO_CONFIG);
    lastAudioModeAppliedAt = Date.now();
    return true;
  } catch (err) {
    console.warn('[AudioMode] Failed to set audio mode:', err);
    return false;
  }
};

/**
 * Ensures the background audio mode stays active during overnight recovery
 * without flooding the native bridge with redundant calls.
 */
export const ensureBackgroundAudioMode = async (force = false) => {
  const now = Date.now();
  if (!force && lastAudioModeAppliedAt > 0 && now - lastAudioModeAppliedAt < AUDIO_MODE_REFRESH_COOLDOWN_MS) {
    return true;
  }
  if (pendingAudioModePromise) {
    return pendingAudioModePromise;
  }
  pendingAudioModePromise = applyStandardAudioMode().finally(() => {
    pendingAudioModePromise = null;
  });
  return pendingAudioModePromise;
};
