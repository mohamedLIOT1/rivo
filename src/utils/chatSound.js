import { getAudioContext, resumeAudioContext } from './audioEngine';

let lastPlayedAt = 0;

/**
 * Plays a gentle, pleasant dual-tone chime notification
 * Throttled to avoid sound spamming when multiple messages arrive quickly.
 */
export function playNotificationSound() {
  if (typeof window === 'undefined') return;
  const nowMs = Date.now();
  if (nowMs - lastPlayedAt < 600) return; // Debounce 600ms
  lastPlayedAt = nowMs;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended' || ctx.state === 'interrupted') {
      resumeAudioContext();
    }
    const t = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';

    // Tone 1: E5 (659.25 Hz) -> G#5 (830.61 Hz)
    osc1.frequency.setValueAtTime(659.25, t);
    osc1.frequency.exponentialRampToValueAtTime(830.61, t + 0.08);

    // Tone 2: Harmonious subtle overtone B5 (987.77 Hz)
    osc2.frequency.setValueAtTime(987.77, t + 0.04);

    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.12, t + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(t);
    osc2.start(t + 0.04);
    osc1.stop(t + 0.36);
    osc2.stop(t + 0.36);
  } catch (err) {
    // Non-blocking fallback
  }
}
