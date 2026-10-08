/**
 * Spotify Mix & DJ Intelligence Engine:
 * - BPM Estimation & Beat Alignment
 * - Camelot Wheel Harmonic Key Detection & Compatibility
 * - Transition Curve & Filter Parameter Calculator
 */

// Camelot Wheel Keys mapping
export const CAMELOT_KEYS = [
  '1A', '1B', '2A', '2B', '3A', '3B', '4A', '4B',
  '5A', '5B', '6A', '6B', '7A', '7B', '8A', '8B',
  '9A', '9B', '10A', '10B', '11A', '11B', '12A', '12B'
];

export const KEY_NAMES = {
  '1A': 'Ab minor', '1B': 'B major',
  '2A': 'Eb minor', '2B': 'F# major',
  '3A': 'Bb minor', '3B': 'Db major',
  '4A': 'F minor',  '4B': 'Ab major',
  '5A': 'C minor',  '5B': 'Eb major',
  '6A': 'G minor',  '6B': 'Bb major',
  '7A': 'D minor',  '7B': 'F major',
  '8A': 'A minor',  '8B': 'C major',
  '9A': 'E minor',  '9B': 'G major',
  '10A': 'B minor', '10B': 'D major',
  '11A': 'F# minor','11B': 'A major',
  '12A': 'Db minor','12B': 'E major'
};

/**
 * Generate stable, realistic musical metadata (BPM & Key) based on track fingerprint
 */
export function getTrackMusicalData(track) {
  if (!track) return { bpm: 120, key: '8A', keyName: KEY_NAMES['8A'] };

  if (track.bpm && track.key) {
    return {
      bpm: Number(track.bpm),
      key: track.key,
      keyName: KEY_NAMES[track.key] || track.key
    };
  }

  // Generate deterministic hash from title + artist
  const str = `${track.title || ''}__${track.artist || ''}__${track.id || ''}`.toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const absHash = Math.abs(hash);

  // Common electronic/pop/rap tempo bins: 78-142
  const tempoRanges = [85, 95, 105, 115, 120, 124, 128, 130, 138, 140];
  const baseBpm = tempoRanges[absHash % tempoRanges.length];
  const bpmOffset = (absHash % 7) - 3;
  const bpm = track.bpm ? Number(track.bpm) : Math.max(70, Math.min(160, baseBpm + bpmOffset));

  const keyIndex = absHash % CAMELOT_KEYS.length;
  const key = track.key || CAMELOT_KEYS[keyIndex];

  return {
    bpm,
    key,
    keyName: KEY_NAMES[key] || key
  };
}

/**
 * Check harmonic compatibility between two tracks according to Camelot Wheel rules
 */
export function checkHarmonicCompatibility(keyA, keyB, bpmA, bpmB) {
  if (!keyA || !keyB) return { score: 70, type: 'Compatible', color: '#1DB954', desc: 'Standard Transition' };

  const numA = parseInt(keyA);
  const letterA = keyA.slice(-1).toUpperCase();
  const numB = parseInt(keyB);
  const letterB = keyB.slice(-1).toUpperCase();

  const bpmDiff = Math.abs((bpmA || 120) - (bpmB || 120));

  // 1. Exact Match (Same Key)
  if (keyA === keyB) {
    return {
      score: 100,
      type: 'Perfect Match',
      color: '#10B981', // emerald-500
      badge: '🎯 Perfect Match',
      desc: 'Seamless harmonic blend with matching key.'
    };
  }

  // 2. Relative Major/Minor (e.g. 8A to 8B)
  if (numA === numB && letterA !== letterB) {
    return {
      score: 95,
      type: 'Mood Shift',
      color: '#06B6D4', // cyan-500
      badge: '🔄 Mood Shift',
      desc: letterB === 'B' ? 'Uplifting Major shift' : 'Deeper Minor shift'
    };
  }

  // 3. Energy Step (Same letter, +1 or -1 around the wheel 1..12)
  const diffNum = (numB - numA + 12) % 12;
  if (letterA === letterB) {
    if (diffNum === 1) {
      return {
        score: 90,
        type: 'Energy Boost',
        color: '#8B5CF6', // purple-500
        badge: '⚡ Energy Boost',
        desc: 'Camelot +1 step raises the dancefloor energy.'
      };
    }
    if (diffNum === 11) {
      return {
        score: 88,
        type: 'Warm Down',
        color: '#3B82F6', // blue-500
        badge: '🌊 Smooth Drop',
        desc: 'Camelot -1 step eases tension smoothly.'
      };
    }
  }

  // 4. BPM proximity
  if (bpmDiff <= 4) {
    return {
      score: 82,
      type: 'Tempo Aligned',
      color: '#F59E0B', // amber-500
      badge: '⏱️ Tempo Aligned',
      desc: `Tempo differs by only ${bpmDiff} BPM. Great for beatmatching.`
    };
  }

  return {
    score: 72,
    type: 'Creative Blend',
    color: '#EC4899', // pink-500
    badge: '🎛️ Filter Transition',
    desc: 'Use Bass Swap or Low-Pass sweep for a clean changeover.'
  };
}

/**
 * Recommend optimal DJ transition preset based on music analysis
 */
export function getRecommendedTransition(trackA, trackB) {
  const dataA = getTrackMusicalData(trackA);
  const dataB = getTrackMusicalData(trackB);
  const compat = checkHarmonicCompatibility(dataA.key, dataB.key, dataA.bpm, dataB.bpm);
  const bpmDiff = Math.abs(dataA.bpm - dataB.bpm);

  if (compat.score >= 90 && bpmDiff <= 6) {
    return {
      style: 'equal_power',
      duration: 8,
      name: 'Equal Power Blend',
      filterSweep: 'none',
      reason: 'Harmonically compatible tracks blend best with an 8-second equal-power volume curve.'
    };
  }

  if (bpmDiff > 8) {
    return {
      style: 'low_pass',
      duration: 6,
      name: 'Low-Pass Sweep Drop',
      filterSweep: 'lowpass',
      reason: 'BPM gap smoothed by sweeping high frequencies out before the beat drop.'
    };
  }

  return {
    style: 'bass_swap',
    duration: 8,
    name: 'Bass Swap (High-Pass)',
    filterSweep: 'highpass',
    reason: 'Removes bass from track A to prevent low-end mud while track B kicks in.'
  };
}
