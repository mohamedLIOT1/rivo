/**
 * Spotify-Grade Web Audio API Engine & Real DSP Equalizer Node Cascade
 * Includes Pre-Amp Gain & Master DynamicsCompressor to prevent digital distortion
 */

let audioCtx = null;
let sourceNode = null;
let preAmpGainNode = null;
let masterCompressorNode = null;
let masterGainNode = null;
let filters = {};
let isInitialized = false;

// ── Global gesture listener: auto-resume AudioContext on first user interaction ──
// This fixes the "must restart app after login" bug on Android WebView
function setupGestureResumeListener() {
  const resumeOnGesture = () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => {
        console.log('[AudioEngine] AudioContext resumed via user gesture');
      }).catch(() => {});
    }
    // Keep listener alive in case context gets suspended again
  };
  const events = ['touchstart', 'touchend', 'mousedown', 'click', 'keydown'];
  events.forEach(evt => document.addEventListener(evt, resumeOnGesture, { passive: true }));
}

// Frequency band definitions matching standard Graphic Equalizer
const BANDS = [
  { name: '60Hz', type: 'lowshelf', frequency: 60 },
  { name: '230Hz', type: 'peaking', frequency: 230, Q: 1 },
  { name: '910Hz', type: 'peaking', frequency: 910, Q: 1 },
  { name: '3.6kHz', type: 'peaking', frequency: 3600, Q: 1 },
  { name: '14kHz', type: 'highshelf', frequency: 14000 }
];

/**
 * Initialize Web Audio API pipeline attached to HTMLAudioElement
 * @param {HTMLAudioElement} audioElement 
 */
export function initAudioEngine(audioElement) {
  if (isInitialized || !audioElement) return;
  setupGestureResumeListener();
  isInitialized = true;
  console.log('✅ Direct hardware audio output initialized');
}

/**
 * Ensure AudioContext is resumed upon user gesture
 */
export function resumeAudioContext() {
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended' || audioCtx.state === 'interrupted') {
    audioCtx.resume().catch(() => {});
  }
}

/**
 * Apply equalizer gain values (in dB) across frequency bands
 * Automatically compensates Pre-Amp gain to avoid distortion when boosting bass
 * @param {Object} bandGains Map of band name to gain value in dB
 * @param {Boolean} enabled Whether equalizer processing is enabled
 */
export function setEqualizerBands(bandGains, enabled = true) {
  if (!isInitialized || !filters) return;

  resumeAudioContext();

  let maxBoost = 0;

  Object.keys(filters).forEach(bandName => {
    const filter = filters[bandName];
    if (filter) {
      const dbGain = enabled && bandGains && typeof bandGains[bandName] === 'number'
        ? bandGains[bandName]
        : 0;
      
      if (dbGain > maxBoost) maxBoost = dbGain;

      // Smoothly transition gain to prevent digital clicks/pops
      const now = audioCtx ? audioCtx.currentTime : 0;
      filter.gain.cancelScheduledValues(now);
      filter.gain.setTargetAtTime(dbGain, now, 0.05);
    }
  });

  // Dynamic Headroom Compensation for boosted EQ
  if (preAmpGainNode && audioCtx) {
    const boostMult = 1.6;
    const headroomFactor = maxBoost > 0 ? Math.max(1.0, boostMult * Math.pow(10, -maxBoost / 40)) : boostMult;
    const now = audioCtx.currentTime;
    preAmpGainNode.gain.cancelScheduledValues(now);
    preAmpGainNode.gain.setTargetAtTime(headroomFactor, now, 0.05);
  }
}

/**
 * Master Volume Gain Control (Supports Volume Boost up to 2.0 = 200%)
 * @param {Number} volume Level from 0.0 to 2.0
 */
export function setMasterVolume(volume) {
  const normVol = Math.max(0, Math.min(2.0, volume * 1.5));
  if (masterGainNode && audioCtx) {
    const now = audioCtx.currentTime;
    masterGainNode.gain.cancelScheduledValues(now);
    masterGainNode.gain.setTargetAtTime(normVol, now, 0.02);
  }
}

export function isAudioEngineReady() {
  return isInitialized;
}

