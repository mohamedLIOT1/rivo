/**
 * Rivo DJ Web Audio API Engine & DJ Transition DSP
 */

let audioCtx = null;
let masterGainNode = null;
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
      masterGainNode = audioCtx.createGain();
      masterGainNode.gain.value = 1.0;
    }
  } catch (err) {
    console.warn('[AudioEngine] Web Audio API init notice:', err.message);
  }

  isInitialized = true;
  console.log('✅ Rivo DJ Audio Engine Initialized');
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
 * Calculate dynamic DJ crossfade gains matching real DJ styles and non-linear crossover bias
 * @param {number} progress 0.0 (Track A 100%) to 1.0 (Track B 100%)
 * @param {string} style transition preset style ('rise', 'slam', 'blend', 'wave', 'melt', 'fade', 'auto')
 * @param {number} crossoverBias 0.15 to 0.85 (0.5 is centered)
 * @returns {{ gainA: number, gainB: number }}
 */
export function calculateCrossfadeGains(progress, style = 'fade', crossoverBias = 0.5) {
  const rawP = Math.max(0, Math.min(1, progress));
  const bias = Math.max(0.15, Math.min(0.85, Number(crossoverBias) || 0.5));
  
  // Warp progress around crossover bias so the intersection point shifts precisely:
  // When rawP === bias, p = 0.5 (the exact crossover point)
  let p = rawP;
  if (Math.abs(bias - 0.5) >= 0.01) {
    if (rawP < bias) {
      p = (rawP / bias) * 0.5;
    } else {
      p = 0.5 + ((rawP - bias) / (1 - bias)) * 0.5;
    }
  }

  if (style === 'linear') {
    return { gainA: 1 - p, gainB: p };
  }

  // 1. SLAM (Direct Drop Cut / Instant Hit):
  // Track A stays at 100% until 90% of the transition window.
  // At 90%, Track A instantly drops to 0, and Track B slams in at 100%!
  if (style === 'cut' || style === 'slam') {
    return { 
      gainA: p < 0.90 ? 1.0 : 0.0, 
      gainB: p >= 0.90 ? 1.0 : 0.0 
    };
  }

  // 2. RISE (Buildup & Drop):
  // Track A stays dominant at 100% until 75%, then ducks sharply to zero creating huge drop tension.
  // Track B builds up underneath (rising energy) and drops with 100% power on the climax (75%+).
  if (style === 'rise') {
    const gainA = p < 0.75 ? 1.0 : Math.max(0, 1.0 - Math.pow((p - 0.75) / 0.25, 2));
    const gainB = p < 0.35 
      ? 0.15 * Math.pow(p / 0.35, 2) 
      : 0.15 + 0.85 * Math.pow((p - 0.35) / 0.65, 1.5);
    return { 
      gainA: Math.max(0, Math.min(1, gainA)), 
      gainB: Math.max(0, Math.min(1, gainB)) 
    };
  }

  // 3. BLEND (Club EQ Bass Swap):
  // Track A stays strong (1.0 -> 0.85) up to 45%, then ducks sharply as Track B takes over.
  // Track B enters gently (35%) up to 45%, then punches in hard to 100% taking over the low end.
  if (style === 'blend' || style === 'bass_swap') {
    const gainA = p < 0.45 
      ? 1.0 - 0.15 * Math.pow(p / 0.45, 2) 
      : 0.85 * Math.pow((1 - p) / 0.55, 2.5);
    const gainB = p < 0.45 
      ? 0.35 * Math.pow(p / 0.45, 1.8) 
      : 0.35 + 0.65 * Math.pow((p - 0.45) / 0.55, 0.7);
    return { 
      gainA: Math.max(0, Math.min(1, gainA)), 
      gainB: Math.max(0, Math.min(1, gainB)) 
    };
  }

  // 4. WAVE (Rolling Wave Crossfade):
  // S-curve wave crossfade where Track A rolls out gently and Track B rolls in smoothly.
  if (style === 'wave') {
    const gainA = p < 0.5 ? 1.0 - 0.25 * Math.sin(p * Math.PI) : Math.pow((1 - p) / 0.5, 2.0);
    const gainB = p < 0.5 ? Math.pow(p / 0.5, 2.0) : 0.75 + 0.25 * Math.sin((p - 0.5) * Math.PI);
    return {
      gainA: Math.max(0, Math.min(1, gainA)),
      gainB: Math.max(0, Math.min(1, gainB))
    };
  }

  // 5. MELT (Harmonic Melodic Crossfade):
  // Exponential melt curve with smooth center dip to avoid harmonic clutter.
  if (style === 'melt') {
    const gainA = Math.pow(1 - p, 1.8);
    const gainB = Math.pow(p, 1.8);
    return {
      gainA: Math.max(0, Math.min(1, gainA)),
      gainB: Math.max(0, Math.min(1, gainB))
    };
  }

  // 6. FADE / AUTO / EQUAL_POWER (Constant Acoustic Energy):
  // Standard equal-power crossfade (cos/sin curve)
  const angle = p * (Math.PI / 2);
  return {
    gainA: Math.cos(angle),
    gainB: Math.sin(angle)
  };
}

export function calculateDjFilterParams(progress, filterType) {
  const p = Math.max(0, Math.min(1, progress));
  if (filterType === 'highpass') {
    return { frequency: 30 + Math.pow(p, 2) * 3500 };
  }
  if (filterType === 'lowpass') {
    return { frequency: Math.max(350, 20000 * (1 - p)) };
  }
  return { frequency: 20000 };
}

export function setMasterVolume(volume) {
  if (masterGainNode) {
    masterGainNode.gain.value = Math.max(0, Math.min(1, Number(volume) || 0));
  }
}

export function isAudioEngineReady() {
  return isInitialized;
}

export function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

export async function playTrueRivoMix({
  songUrl1,
  songUrl2,
  transitionDuration = 16,
  style = 'equal_power',
  previewOnly = false,
  startOffsetA = null,
  onEnd = null
}) {
  const ctx = getAudioContext();
  if (!ctx) return null;
  resumeAudioContext();
  return {
    stop: () => {
      onEnd?.();
    }
  };
}

export const playTrueSpotifyMix = playTrueRivoMix;
