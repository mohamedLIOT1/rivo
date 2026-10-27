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

      // Master Gain Node
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
    // Sharp DJ Drop Cut: Track A stays at full volume until the drop (85%), then instantly cuts to 0, Track B drops at 100%
    return { 
      gainA: p < 0.85 ? 1 : 0, 
      gainB: p >= 0.85 ? 1 : 0 
    };
  }

  if (style === 'bass_swap') {
    // Club DJ Bass Swap: Track A stays dominant and loud until swap point (~45-50%), then ducks sharply.
    // Track B begins subtle and punches in hard to take over the low-end & beat.
    const gainA = p < 0.45 
      ? 1 - 0.15 * Math.pow(p / 0.45, 2) 
      : 0.85 * Math.pow((1 - p) / 0.55, 3);
    const gainB = p < 0.45 
      ? 0.35 * Math.pow(p / 0.45, 1.8) 
      : 0.35 + 0.65 * Math.pow((p - 0.45) / 0.55, 0.6);
    return { 
      gainA: Math.max(0, Math.min(1, gainA)), 
      gainB: Math.max(0, Math.min(1, gainB)) 
    };
  }

  if (style === 'low_pass') {
    // Filter Sweep: Exponential fade-out of Track A (feels like filtering out highs/energy)
    // and gradual dynamic swelling of Track B into the drop
    const gainA = Math.pow(1 - p, 2.5);
    const gainB = Math.pow(p, 1.8);
    return { 
      gainA: Math.max(0, Math.min(1, gainA)), 
      gainB: Math.max(0, Math.min(1, gainB)) 
    };
  }

  if (style === 'vinyl_brake') {
    // Turntable Tape Stop: Track A holds volume until 60%, then decelerates down sharply like a vinyl motor brake,
    // Track B hits hard on the drop
    const gainA = p < 0.6 ? 1.0 : Math.max(0, 1 - Math.pow((p - 0.6) / 0.4, 2));
    const gainB = p < 0.7 ? 0 : Math.min(1, Math.pow((p - 0.7) / 0.3, 0.7));
    return { gainA, gainB };
  }

  if (style === 'echo_out') {
    // Dub Echo / Reverb Out: Track A decays with an atmospheric echo trail,
    // Track B emerges cleanly underneath
    const gainA = Math.pow(1 - p, 1.6) * (0.8 + 0.2 * Math.sin(p * Math.PI * 6));
    const gainB = Math.pow(p, 1.4);
    return { 
      gainA: Math.max(0, Math.min(1, gainA)), 
      gainB: Math.max(0, Math.min(1, gainB)) 
    };
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

export function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  return audioCtx;
}

/**
 * True Rivo Mix Web Audio API Engine
 * Dual-buffer overlapping player with Equal Power crossfade curves,
 * dynamic BiquadFilter sweeps (High-pass bass cutoff on A, Low-pass open on B),
 * running on the sample-accurate hardware audio clock.
 */
async function fetchAudioBuffer(ctx, url) {
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    const res = await fetch(url);
    const ab = await res.arrayBuffer();
    return ctx.decodeAudioData(ab);
  }
  const res = await fetch(url);
  const ab = await res.arrayBuffer();
  return ctx.decodeAudioData(ab);
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

  try {
    const [buffer1, buffer2] = await Promise.all([
      fetchAudioBuffer(ctx, songUrl1),
      fetchAudioBuffer(ctx, songUrl2)
    ]);

    const duration1 = buffer1.duration;
    const transDur = Math.min(Math.max(2, Number(transitionDuration) || 16), duration1 - 1);
    const transitionStartTime = Math.max(0, duration1 - transDur);

    // If previewing, start 3.5 seconds before transition so user immediately hears the mix!
    const offsetA = (startOffsetA !== null && startOffsetA !== undefined)
      ? Math.max(0, startOffsetA)
      : (previewOnly ? Math.max(0, transitionStartTime - 3.5) : 0);

    const now = ctx.currentTime;
    const playerAStartTime = now;
    const remainingUntilTrans = Math.max(0, transitionStartTime - offsetA);
    const transStartCtxTime = playerAStartTime + remainingUntilTrans;
    const transEndCtxTime = transStartCtxTime + transDur;

    // ── Player A: Source + Filter + Gain ──
    const playerA = ctx.createBufferSource();
    playerA.buffer = buffer1;

    const filterA = ctx.createBiquadFilter();
    filterA.type = style === 'low_pass' ? 'lowpass' : (style === 'bass_swap' || style === 'high_pass') ? 'highpass' : 'allpass';
    filterA.frequency.setValueAtTime(style === 'low_pass' ? 20000 : 20, now);

    const gainA = ctx.createGain();
    gainA.gain.setValueAtTime(1, now);

    playerA.connect(filterA).connect(gainA).connect(ctx.destination);

    // ── Player B: Source + Filter + Gain ──
    const playerB = ctx.createBufferSource();
    playerB.buffer = buffer2;

    const filterB = ctx.createBiquadFilter();
    filterB.type = (style === 'bass_swap' || style === 'low_pass') ? 'lowpass' : 'allpass';
    filterB.frequency.setValueAtTime(style === 'low_pass' ? 350 : 20000, now);

    const gainB = ctx.createGain();
    gainB.gain.setValueAtTime(0, now);

    playerB.connect(filterB).connect(gainB).connect(ctx.destination);

    // ── Transition Volume Curves ──
    const steps = 30;
    const curveA = new Float32Array(steps);
    const curveB = new Float32Array(steps);
    for (let i = 0; i < steps; i++) {
      const p = i / (steps - 1);
      const { gainA: gA, gainB: gB } = calculateCrossfadeGains(p, style);
      curveA[i] = gA;
      curveB[i] = gB;
    }

    gainA.gain.setValueCurveAtTime(curveA, transStartCtxTime, transDur);
    gainB.gain.setValueCurveAtTime(curveB, transStartCtxTime, transDur);

    // ── Filter Automation ──
    if (style === 'bass_swap' || style === 'high_pass') {
      filterA.frequency.setValueAtTime(20, transStartCtxTime);
      filterA.frequency.linearRampToValueAtTime(1200, transEndCtxTime);
      filterB.frequency.setValueAtTime(20000, transStartCtxTime);
    } else if (style === 'low_pass') {
      filterA.frequency.setValueAtTime(20000, transStartCtxTime);
      filterA.frequency.exponentialRampToValueAtTime(350, transEndCtxTime);
      filterB.frequency.setValueAtTime(350, transStartCtxTime);
      filterB.frequency.exponentialRampToValueAtTime(20000, transEndCtxTime);
    }

    // ── Audio Clock Launch ──
    playerA.start(playerAStartTime, offsetA);
    playerB.start(transStartCtxTime, 0);

    const timeoutMs = (remainingUntilTrans + transDur + (previewOnly ? 3.5 : buffer2.duration)) * 1000;
    const endTimer = setTimeout(() => {
      onEnd?.();
    }, timeoutMs);

    return {
      playerA,
      playerB,
      gainA,
      gainB,
      stop: () => {
        clearTimeout(endTimer);
        try { playerA.stop(); } catch {}
        try { playerB.stop(); } catch {}
        try { playerA.disconnect(); } catch {}
        try { playerB.disconnect(); } catch {}
      }
    };
  } catch (err) {
    console.warn('[RivoDJ] Engine playback error:', err);
    return null;
  }
}

export const playTrueSpotifyMix = playTrueRivoMix;
