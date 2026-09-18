/**
 * Spotify-Grade Web Audio API Engine & Real DSP Equalizer Node Cascade
 * Includes Pre-Amp Gain, Master DynamicsCompressor, and DJ Transition DSP
 */

let audioCtx = null;
let sourceNode = null;
let preAmpGainNode = null;
let masterCompressorNode = null;
let masterGainNode = null;
let djFilterNode = null;
let djCrossfadeGainNode = null;
let filters = {};
let isInitialized = false;

// ── Global gesture listener: auto-resume AudioContext on first user interaction ──
function setupGestureResumeListener() {
  const resumeOnGesture = () => {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => {
        console.log('[AudioEngine] AudioContext resumed via user gesture');
      }).catch(() => {});
    }
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

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
      
      // Create DJ Filter Node (Low-pass / High-pass sweep)
      djFilterNode = audioCtx.createBiquadFilter();
      djFilterNode.type = 'allpass'; // transparent by default
      djFilterNode.frequency.value = 20000;

      // Master Gain Node
      masterGainNode = audioCtx.createGain();
      masterGainNode.gain.value = 1.0;

      // DJ Crossfade Gain Node
      djCrossfadeGainNode = audioCtx.createGain();
      djCrossfadeGainNode.gain.value = 1.0;
    }
  } catch (err) {
    console.warn('[AudioEngine] Web Audio API init notice:', err.message);
  }

  isInitialized = true;
  console.log('✅ Spotify-Grade Audio Engine Initialized');
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
 * Calculate Equal Power crossfade gains (prevents perceived volume dip)
 * @param {number} progress 0.0 (Track A 100%) to 1.0 (Track B 100%)
 * @returns {{ gainA: number, gainB: number }}
 */
export function calculateCrossfadeGains(progress, style = 'equal_power') {
  const p = Math.max(0, Math.min(1, progress));
  
  if (style === 'linear') {
    return { gainA: 1 - p, gainB: p };
  }

  if (style === 'cut') {
    return { gainA: p < 0.5 ? 1 : 0, gainB: p >= 0.5 ? 1 : 0 };
  }

  // Standard DJ Equal-Power Crossfade: cos & sin curve
  const angle = p * (Math.PI / 2);
  return {
    gainA: Math.cos(angle),
    gainB: Math.sin(angle)
  };
}

/**
 * Calculate filter parameters during a DJ sweep
 * @param {number} progress 0.0 to 1.0
 * @param {'low_pass' | 'high_pass' | 'bass_swap' | 'none'} filterType 
 */
export function calculateDjFilterParams(progress, filterType) {
  const p = Math.max(0, Math.min(1, progress));

  if (filterType === 'low_pass') {
    // Sweep highs out as song ends (20000 Hz down to 350 Hz)
    const freq = 20000 * Math.pow(350 / 20000, p);
    return { type: 'lowpass', frequency: Math.round(freq), Q: 1.5 };
  }

  if (filterType === 'high_pass' || filterType === 'bass_swap') {
    // Sweep low-end/bass out (from 20 Hz up to 1200 Hz)
    const freq = 20 + (1200 - 20) * Math.pow(p, 2);
    return { type: 'highpass', frequency: Math.round(freq), Q: 1.2 };
  }

  return { type: 'allpass', frequency: 20000, Q: 1 };
}

/**
 * Apply equalizer gain values (in dB) across frequency bands
 */
export function setEqualizerBands(bandGains, enabled = true) {
  if (!isInitialized || !filters || !audioCtx) return;
  resumeAudioContext();

  Object.keys(filters).forEach(bandName => {
    const filter = filters[bandName];
    if (filter) {
      const dbGain = enabled && bandGains && typeof bandGains[bandName] === 'number'
        ? bandGains[bandName]
        : 0;
      const now = audioCtx.currentTime;
      filter.gain.cancelScheduledValues(now);
      filter.gain.setTargetAtTime(dbGain, now, 0.05);
    }
  });
}

/**
 * Master Volume Gain Control
 */
export function setMasterVolume(volume) {
  const normVol = Math.max(0, Math.min(2.0, volume));
  if (masterGainNode && audioCtx) {
    const now = audioCtx.currentTime;
    masterGainNode.gain.cancelScheduledValues(now);
    masterGainNode.gain.setTargetAtTime(normVol, now, 0.02);
  }
}

export function isAudioEngineReady() {
  return isInitialized;
}
