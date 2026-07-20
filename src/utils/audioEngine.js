/**
 * Spotify-Grade Web Audio API Engine & Real DSP Equalizer Node Cascade
 */

let audioCtx = null;
let sourceNode = null;
let gainNode = null;
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
    gainNode = audioCtx.createGain();

    // Create 5-band BiquadFilterNodes
    let previousNode = sourceNode;

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

    // Connect last filter -> Master GainNode -> Destination
    previousNode.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    isInitialized = true;
    console.log('✅ Real Web Audio API DSP Engine initialized successfully!');
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
 * @param {Object} bandGains Map of band name to gain value in dB (e.g. { '60Hz': 6, ... })
 * @param {Boolean} enabled Whether equalizer processing is enabled
 */
export function setEqualizerBands(bandGains, enabled = true) {
  if (!isInitialized || !filters) return;

  resumeAudioContext();

  Object.keys(filters).forEach(bandName => {
    const filter = filters[bandName];
    if (filter) {
      const dbGain = enabled && bandGains && typeof bandGains[bandName] === 'number'
        ? bandGains[bandName]
        : 0;
      
      // Smoothly transition gain to prevent digital clicks/pops
      const now = audioCtx ? audioCtx.currentTime : 0;
      filter.gain.cancelScheduledValues(now);
      filter.gain.setTargetAtTime(dbGain, now, 0.05);
    }
  });
}

/**
 * Master Volume Gain Control
 * @param {Number} volume Level from 0.0 to 1.0
 */
export function setMasterVolume(volume) {
  const normVol = Math.max(0, Math.min(1, volume));
  if (gainNode && audioCtx) {
    const now = audioCtx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setTargetAtTime(normVol, now, 0.02);
  }
}

export function isAudioEngineReady() {
  return isInitialized;
}
