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

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    audioCtx = new AudioContextClass();
    sourceNode = audioCtx.createMediaElementSource(audioElement);
    
    preAmpGainNode = audioCtx.createGain();
    preAmpGainNode.gain.value = 1.0;

    masterGainNode = audioCtx.createGain();
    masterGainNode.gain.value = 0.8;

    // Spotify-Grade Master Dynamics Compressor to prevent clipping distortion
    masterCompressorNode = audioCtx.createDynamicsCompressor();
    masterCompressorNode.threshold.setValueAtTime(-12, audioCtx.currentTime);
    masterCompressorNode.knee.setValueAtTime(30, audioCtx.currentTime);
    masterCompressorNode.ratio.setValueAtTime(12, audioCtx.currentTime);
    masterCompressorNode.attack.setValueAtTime(0.003, audioCtx.currentTime);
    masterCompressorNode.release.setValueAtTime(0.25, audioCtx.currentTime);

    // Pipeline: Source -> PreAmp -> EQ Filters (Cascade) -> MasterCompressor -> MasterGain -> Destination
    sourceNode.connect(preAmpGainNode);
    let previousNode = preAmpGainNode;

    BANDS.forEach(band => {
      const filter = audioCtx.createBiquadFilter();
      filter.type = band.type;
      filter.frequency.value = band.frequency;
      if (band.Q) filter.Q.value = band.Q;
      filter.gain.value = 0; // default flat

      filters[band.name] = filter;
      previousNode.connect(filter);
      previousNode = filter;
    });

    previousNode.connect(masterCompressorNode);
    masterCompressorNode.connect(masterGainNode);
    masterGainNode.connect(audioCtx.destination);

    isInitialized = true;
    console.log('✅ Spotify-Grade Web Audio API DSP Engine with Compressor initialized!');
  } catch (err) {
    console.warn('AudioContext initialization notice:', err.message);
  }
}

/**
 * Ensure AudioContext is resumed upon user gesture
 */
export function resumeAudioContext() {
  if (audioCtx && audioCtx.state === 'suspended') {
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
    const headroomFactor = maxBoost > 0 ? Math.pow(10, -maxBoost / 40) : 1.0;
    const now = audioCtx.currentTime;
    preAmpGainNode.gain.cancelScheduledValues(now);
    preAmpGainNode.gain.setTargetAtTime(headroomFactor, now, 0.05);
  }
}

/**
 * Master Volume Gain Control
 * @param {Number} volume Level from 0.0 to 1.0
 */
export function setMasterVolume(volume) {
  const normVol = Math.max(0, Math.min(1, volume));
  if (masterGainNode && audioCtx) {
    const now = audioCtx.currentTime;
    masterGainNode.gain.cancelScheduledValues(now);
    masterGainNode.gain.setTargetAtTime(normVol, now, 0.02);
  }
}

export function isAudioEngineReady() {
  return isInitialized;
}

