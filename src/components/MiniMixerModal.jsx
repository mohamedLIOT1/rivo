import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Sliders, Volume2, Wand2, Play, Square, Check, Sparkles, Activity, Music2, 
  Zap, Radio, Layers, Plus, Minus, Loader2, MoveHorizontal, Gauge
} from 'lucide-react';
import { getTrackMusicalData, checkHarmonicCompatibility, getRecommendedTransition, calculateBarsDuration } from '../utils/musicAnalysis';
import { calculateCrossfadeGains, resumeAudioContext } from '../utils/audioEngine';
import { useAudioPlayer, resolvePlayableAudioStream } from '../context/AudioContext';
import { API_BASE_URL } from '../config';

function generatePeaksForTrack(track, count = 100) {
  let seed = 0;
  const str = `${track?.title || ''}_${track?.artist || ''}_${track?.id || track?._id || ''}_${track?.duration || 180}`;
  for (let i = 0; i < str.length; i++) {
    seed = (seed << 5) - seed + str.charCodeAt(i);
    seed |= 0;
  }
  const abs = Math.abs(seed);
  const peaks = [];
  for (let i = 0; i < count; i++) {
    const progress = i / count;
    let envelope = 0.5 + 0.4 * Math.sin(progress * Math.PI);
    if (progress < 0.08) envelope = 0.2 + progress * 8 * 0.5;
    if (progress > 0.88) envelope = Math.max(0.15, (1 - progress) * 7 * 0.8);
    const noise = (((abs * (i + 13)) % 100) / 100) * 0.35;
    peaks.push(Math.min(1.0, Math.max(0.1, Number((envelope + noise).toFixed(2)))));
  }
  return peaks;
}

const TRANSITION_STYLES = [
  {
    id: 'auto',
    name: 'Auto',
    desc: 'Smart AI: analyzes BPM & harmonic key to craft the ideal transition',
    icon: Wand2,
    badge: 'AI Smart',
    color: '#10b981'
  },
  {
    id: 'rise',
    name: 'Rise',
    desc: 'High-pass tension sweep with punchy bass drop on the first downbeat',
    icon: Zap,
    badge: 'Buildup & Drop',
    color: '#f59e0b'
  },
  {
    id: 'blend',
    name: 'Blend',
    desc: 'Balanced 3-band EQ crossfade with sub-bass frequency swap',
    icon: Activity,
    badge: 'Bass Swap',
    color: '#10b981'
  },
  {
    id: 'wave',
    name: 'Wave',
    desc: 'Low-pass wave sweep rhythmically washing out highs into the new track',
    icon: Radio,
    badge: 'Filter Sweep',
    color: '#06b6d4'
  },
  {
    id: 'melt',
    name: 'Melt',
    desc: 'Harmonic frequency melting crossfade, ideal for melodic & vocal changes',
    icon: Sparkles,
    badge: 'Harmonic Melt',
    color: '#a855f7'
  },
  {
    id: 'slam',
    name: 'Slam',
    desc: 'Instant downbeat cut directly on the beat with zero overlapping clutter',
    icon: Music2,
    badge: 'Downbeat Cut',
    color: '#f43f5e'
  },
  {
    id: 'fade',
    name: 'Fade',
    desc: 'Classic equal-power crossfade preserving constant acoustic loudness',
    icon: Volume2,
    badge: 'Equal Power',
    color: '#3b82f6'
  }
];

const BAR_OPTIONS = [1, 2, 4, 8, 16];

function formatTime(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function MiniMixerModal({
  isOpen,
  onClose,
  trackA,
  trackB,
  initialTransition = null,
  onSaveTransition
}) {
  const { setIsMixMode, isPlaying, togglePlay } = useAudioPlayer();

  const durA = Math.max(10, Math.round(Number(trackA?.duration) || 180));
  const durB = Math.max(10, Math.round(Number(trackB?.duration) || 210));

  const dataA = getTrackMusicalData(trackA);
  const dataB = getTrackMusicalData(trackB);
  const recommended = getRecommendedTransition(trackA, trackB);

  // Transition parameters state
  const [style, setStyle] = useState(initialTransition?.style || recommended.style || 'auto');
  const [bars, setBars] = useState(initialTransition?.bars || (recommended.style === 'slam' ? 2 : 4));
  const [duration, setDuration] = useState(
    initialTransition?.duration || 
    calculateBarsDuration(initialTransition?.bars || 4, dataA.bpm) || 8
  );

  // Interactive Crossover Bias state (0.20 to 0.80, default 0.50 center)
  const [crossoverBias, setCrossoverBias] = useState(Number(initialTransition?.crossoverBias) || 0.5);

  // Cue Points: Mix-Out (Track A) and Mix-In (Track B)
  const defaultMixOut = Math.round(durA * 0.85);
  const [mixOutPoint, setMixOutPoint] = useState(() => {
    return initialTransition?.mixOutPoint ? Math.min(durA, Number(initialTransition.mixOutPoint)) : defaultMixOut;
  });
  const [mixInPoint, setMixInPoint] = useState(() => {
    return initialTransition?.mixInPoint ? Math.min(durB, Number(initialTransition.mixInPoint)) : 0;
  });

  // Volume Trim & Speed Controls for Deck A & Deck B
  const [volA, setVolA] = useState(initialTransition?.volA !== undefined ? Number(initialTransition.volA) : 100);
  const [volB, setVolB] = useState(initialTransition?.volB !== undefined ? Number(initialTransition.volB) : 100);
  const [speedA, setSpeedA] = useState(initialTransition?.speedA !== undefined ? Number(initialTransition.speedA) : 1.0);
  const [speedB, setSpeedB] = useState(initialTransition?.speedB !== undefined ? Number(initialTransition.speedB) : 1.0);

  const [autoMatchBpm, setAutoMatchBpm] = useState(initialTransition?.autoMatchBpm !== false);
  const [bassKill, setBassKill] = useState(Boolean(initialTransition?.bassKill));
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  // Dragging states
  const [isDraggingDeckA, setIsDraggingDeckA] = useState(false);
  const [isDraggingDeckB, setIsDraggingDeckB] = useState(false);
  const [isDraggingCurve, setIsDraggingCurve] = useState(false);

  // Audition State
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [soloPlayingDeck, setSoloPlayingDeck] = useState(null); // 'A' | 'B' | null
  const [soloProgress, setSoloProgress] = useState(0);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [liveGainA, setLiveGainA] = useState(100);
  const [liveGainB, setLiveGainB] = useState(0);

  const auditionDeckARef = useRef(null);
  const auditionDeckBRef = useRef(null);
  const auditionAnimRef = useRef(null);

  // Waveform peak data
  const peaksA = useMemo(() => generatePeaksForTrack(trackA, 90), [trackA?.id, trackA?._id, trackA?.title]);
  const peaksB = useMemo(() => generatePeaksForTrack(trackB, 90), [trackB?.id, trackB?._id, trackB?.title]);

  const trackAId = String(trackA?.id || trackA?._id || '');
  const trackBId = String(trackB?.id || trackB?._id || '');

  useEffect(() => {
    if (!isOpen) return;
    if (initialTransition) {
      setStyle(initialTransition.style || 'auto');
      const b = initialTransition.bars || (initialTransition.style === 'slam' ? 2 : 4);
      setBars(b);
      setDuration(initialTransition.duration || calculateBarsDuration(b, dataA.bpm) || 8);
      setCrossoverBias(Number(initialTransition.crossoverBias) || 0.5);
      if (initialTransition.mixOutPoint) setMixOutPoint(Math.min(durA, Number(initialTransition.mixOutPoint)));
      if (initialTransition.mixInPoint) setMixInPoint(Math.min(durB, Number(initialTransition.mixInPoint)));
      setVolA(initialTransition.volA !== undefined ? Number(initialTransition.volA) : 100);
      setVolB(initialTransition.volB !== undefined ? Number(initialTransition.volB) : 100);
      setSpeedA(initialTransition.speedA !== undefined ? Number(initialTransition.speedA) : 1.0);
      setSpeedB(initialTransition.speedB !== undefined ? Number(initialTransition.speedB) : 1.0);
      setAutoMatchBpm(initialTransition.autoMatchBpm !== false);
      setBassKill(Boolean(initialTransition.bassKill));
    } else {
      setStyle(recommended.style);
      const b = recommended.bars || 4;
      setBars(b);
      setDuration(recommended.duration || calculateBarsDuration(b, dataA.bpm) || 8);
      setCrossoverBias(0.5);
      setMixOutPoint(defaultMixOut);
      setMixInPoint(0);
      setVolA(100);
      setVolB(100);
      setSpeedA(1.0);
      setSpeedB(1.0);
    }
    setIsSavedNotice(false);
  }, [trackAId, trackBId, isOpen]);

  // Clean stop for audition & solo previews
  const stopAudition = () => {
    if (auditionAnimRef.current) {
      cancelAnimationFrame(auditionAnimRef.current);
      auditionAnimRef.current = null;
    }
    if (auditionDeckARef.current) {
      try {
        auditionDeckARef.current.pause();
        auditionDeckARef.current.src = '';
      } catch {}
      auditionDeckARef.current = null;
    }
    if (auditionDeckBRef.current) {
      try {
        auditionDeckBRef.current.pause();
        auditionDeckBRef.current.src = '';
      } catch {}
      auditionDeckBRef.current = null;
    }
    setIsPreviewing(false);
    setSoloPlayingDeck(null);
    setSoloProgress(0);
    setPreviewProgress(0);
    setLiveGainA(100);
    setLiveGainB(0);
    setIsLoadingAudio(false);
  };

  useEffect(() => {
    return () => {
      stopAudition();
    };
  }, []);

  if (!isOpen || !trackA || !trackB) return null;

  const maxAllowedSec = 48;
  const thumbPct = Math.max(0, Math.min(100, ((duration - 1) / (maxAllowedSec - 1)) * 100));

  const handleSelectBars = (numBars) => {
    setBars(numBars);
    const calcSec = calculateBarsDuration(numBars, dataA.bpm);
    setDuration(calcSec);
  };

  const handleSelectStyle = (newStyle) => {
    setStyle(newStyle);
    if (newStyle === 'slam' && bars > 2) {
      setBars(2);
      setDuration(calculateBarsDuration(2, dataA.bpm));
    }
  };

  // ── Drag Handlers for Deck A Waveform ──
  const updateDeckAPositionFromEvent = (clientX, targetRect) => {
    if (!targetRect || targetRect.width <= 0) return;
    const pct = Math.max(0.05, Math.min(1.0, (clientX - targetRect.left) / targetRect.width));
    setMixOutPoint(Math.round(pct * durA));
  };

  const handlePointerDownDeckA = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingDeckA(true);
    const rect = e.currentTarget.getBoundingClientRect();
    updateDeckAPositionFromEvent(e.clientX, rect);
  };

  const handlePointerMoveDeckA = (e) => {
    if (!isDraggingDeckA) return;
    const rect = e.currentTarget.getBoundingClientRect();
    updateDeckAPositionFromEvent(e.clientX, rect);
  };

  const handlePointerUpDeckA = () => {
    setIsDraggingDeckA(false);
  };

  // ── Drag Handlers for Deck B Waveform ──
  const updateDeckBPositionFromEvent = (clientX, targetRect) => {
    if (!targetRect || targetRect.width <= 0) return;
    const pct = Math.max(0.0, Math.min(0.95, (clientX - targetRect.left) / targetRect.width));
    setMixInPoint(Math.round(pct * durB));
  };

  const handlePointerDownDeckB = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingDeckB(true);
    const rect = e.currentTarget.getBoundingClientRect();
    updateDeckBPositionFromEvent(e.clientX, rect);
  };

  const handlePointerMoveDeckB = (e) => {
    if (!isDraggingDeckB) return;
    const rect = e.currentTarget.getBoundingClientRect();
    updateDeckBPositionFromEvent(e.clientX, rect);
  };

  const handlePointerUpDeckB = () => {
    setIsDraggingDeckB(false);
  };

  // ── Drag Handlers for Interactive Curve Crossover Point ──
  const updateCrossoverFromEvent = (clientX, targetRect) => {
    if (!targetRect || targetRect.width <= 0) return;
    const pct = Math.max(0.20, Math.min(0.80, (clientX - targetRect.left) / targetRect.width));
    setCrossoverBias(Number(pct.toFixed(2)));
  };

  const handlePointerDownCurve = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingCurve(true);
    const rect = e.currentTarget.getBoundingClientRect();
    updateCrossoverFromEvent(e.clientX, rect);
  };

  const handlePointerMoveCurve = (e) => {
    if (!isDraggingCurve) return;
    const rect = e.currentTarget.getBoundingClientRect();
    updateCrossoverFromEvent(e.clientX, rect);
  };

  const handlePointerUpCurve = () => {
    setIsDraggingCurve(false);
  };

  // Helper to safely prepare, seek, and play HTML5 audio across browsers without dropping currentTime
  const safePlayAudio = async (audio, startTime, volume, speed) => {
    resumeAudioContext();
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.playbackRate = Number(speed) || 1.0;

    if (audio.readyState < 1) {
      await new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (!done) {
            done = true;
            resolve();
          }
        };
        audio.addEventListener('loadedmetadata', finish, { once: true });
        audio.addEventListener('canplay', finish, { once: true });
        audio.addEventListener('error', finish, { once: true });
        setTimeout(finish, 3500);
      });
    }

    try {
      if (startTime > 0) {
        audio.currentTime = startTime;
      }
    } catch (e) {}

    await audio.play();

    // Verify currentTime after play begins in case browser reset it
    try {
      if (startTime > 0 && Math.abs(audio.currentTime - startTime) > 1.5) {
        audio.currentTime = startTime;
      }
    } catch (e) {}
  };

  // ── Solo Deck A Audition (Mix-Out Point alone) ──
  const handlePreviewSoloA = async () => {
    if (soloPlayingDeck === 'A') {
      stopAudition();
      return;
    }
    stopAudition();
    resumeAudioContext();

    setSoloPlayingDeck('A');
    setIsLoadingAudio(true);
    try {
      const resA = await resolvePlayableAudioStream(trackA);
      const urlA = resA?.url ? (resA.url.startsWith('/') ? `${API_BASE_URL}${resA.url}` : resA.url) : '';
      if (!urlA) {
        stopAudition();
        return;
      }

      const audioA = new Audio(urlA);
      audioA.preload = 'auto';
      auditionDeckARef.current = audioA;

      const previewDuration = Math.min(duration, 8);
      const startSec = Math.max(0, mixOutPoint - previewDuration);
      const targetVol = Math.max(0, Math.min(1, (Number(volA) || 100) / 100));
      const spd = Number(speedA) || 1.0;

      await safePlayAudio(audioA, startSec, targetVol, spd);
      setIsLoadingAudio(false);

      const startTime = performance.now();
      const totalMs = (previewDuration / spd) * 1000;

      const tick = () => {
        if (!auditionDeckARef.current) return;
        const elapsed = performance.now() - startTime;
        const p = Math.min(1, elapsed / totalMs);
        setSoloProgress(p);

        if (p < 1 && !audioA.ended) {
          auditionAnimRef.current = requestAnimationFrame(tick);
        } else {
          stopAudition();
        }
      };
      auditionAnimRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.warn('[Solo A] error:', err);
      stopAudition();
    }
  };

  // ── Solo Deck B Audition (Mix-In Point alone) ──
  const handlePreviewSoloB = async () => {
    if (soloPlayingDeck === 'B') {
      stopAudition();
      return;
    }
    stopAudition();
    resumeAudioContext();

    setSoloPlayingDeck('B');
    setIsLoadingAudio(true);
    try {
      const resB = await resolvePlayableAudioStream(trackB);
      const urlB = resB?.url ? (resB.url.startsWith('/') ? `${API_BASE_URL}${resB.url}` : resB.url) : '';
      if (!urlB) {
        stopAudition();
        return;
      }

      const audioB = new Audio(urlB);
      audioB.preload = 'auto';
      auditionDeckBRef.current = audioB;

      const previewDuration = Math.min(duration, 8);
      const startSec = Math.max(0, mixInPoint);
      const targetVol = Math.max(0, Math.min(1, (Number(volB) || 100) / 100));
      const spd = Number(speedB) || 1.0;

      await safePlayAudio(audioB, startSec, targetVol, spd);
      setIsLoadingAudio(false);

      const startTime = performance.now();
      const totalMs = (previewDuration / spd) * 1000;

      const tick = () => {
        if (!auditionDeckBRef.current) return;
        const elapsed = performance.now() - startTime;
        const p = Math.min(1, elapsed / totalMs);
        setSoloProgress(p);

        if (p < 1 && !audioB.ended) {
          auditionAnimRef.current = requestAnimationFrame(tick);
        } else {
          stopAudition();
        }
      };
      auditionAnimRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.warn('[Solo B] error:', err);
      stopAudition();
    }
  };

  // ── Full Dual-Deck Transition Audition ──
  const handleAuditionTransition = async () => {
    if (isPreviewing) {
      stopAudition();
      return;
    }
    stopAudition();
    resumeAudioContext();

    setIsPreviewing(true);
    setIsLoadingAudio(true);
    try {
      const [resA, resB] = await Promise.all([
        resolvePlayableAudioStream(trackA),
        resolvePlayableAudioStream(trackB)
      ]);

      const urlA = resA?.url ? (resA.url.startsWith('/') ? `${API_BASE_URL}${resA.url}` : resA.url) : '';
      const urlB = resB?.url ? (resB.url.startsWith('/') ? `${API_BASE_URL}${resB.url}` : resB.url) : '';
      if (!urlA || !urlB) {
        stopAudition();
        return;
      }

      const audioA = new Audio(urlA);
      const audioB = new Audio(urlB);
      audioA.preload = 'auto';
      audioB.preload = 'auto';
      auditionDeckARef.current = audioA;
      auditionDeckBRef.current = audioB;

      const multA = (Number(volA) || 100) / 100;
      const multB = (Number(volB) || 100) / 100;
      const spdA = Number(speedA) || 1.0;
      const spdB = Number(speedB) || 1.0;

      const leadInSec = 2.0;
      const seekA = Math.max(0, mixOutPoint - duration - leadInSec);
      const seekB = Math.max(0, mixInPoint);

      // Pre-warm Deck B in parallel
      audioB.playbackRate = spdB;
      audioB.volume = 0.0;
      const prepDeckBPromise = new Promise((resolve) => {
        if (audioB.readyState >= 1) {
          try { audioB.currentTime = seekB; } catch {}
          resolve();
        } else {
          const onMeta = () => {
            try { audioB.currentTime = seekB; } catch {}
            resolve();
          };
          audioB.addEventListener('loadedmetadata', onMeta, { once: true });
          setTimeout(resolve, 3500);
        }
        audioB.load();
      });

      // Play Deck A
      await Promise.all([
        safePlayAudio(audioA, seekA, 1.0 * multA, spdA),
        prepDeckBPromise
      ]);

      setIsLoadingAudio(false);
      setPreviewProgress(0);
      setLiveGainA(Math.round(100 * multA));
      setLiveGainB(0);

      const startTime = performance.now();
      const leadInMs = (leadInSec / spdA) * 1000;
      const transMs = Math.max(1, duration) * 1000;
      const tailMs = 2500;
      const totalMs = leadInMs + transMs + tailMs;

      let deckBStarted = false;

      const tick = () => {
        if (!auditionDeckARef.current && !auditionDeckBRef.current) return;
        const elapsed = performance.now() - startTime;

        if (elapsed < leadInMs) {
          setPreviewProgress(0);
          audioA.volume = Math.max(0, Math.min(1, 1.0 * multA));
          audioB.volume = 0.0;
          setLiveGainA(Math.round(100 * multA));
          setLiveGainB(0);
        } else if (elapsed <= leadInMs + transMs) {
          if (!deckBStarted) {
            deckBStarted = true;
            try {
              if (Math.abs(audioB.currentTime - seekB) > 1.0) {
                audioB.currentTime = seekB;
              }
            } catch {}
            audioB.play().catch(() => {});
          }

          const rawP = (elapsed - leadInMs) / transMs;
          const { gainA, gainB } = calculateCrossfadeGains(rawP, style, crossoverBias);

          audioA.volume = Math.max(0, Math.min(1, gainA * multA));
          audioB.volume = Math.max(0, Math.min(1, gainB * multB));
          setPreviewProgress(rawP);
          setLiveGainA(Math.round(gainA * multA * 100));
          setLiveGainB(Math.round(gainB * multB * 100));
        } else {
          setPreviewProgress(1);
          audioA.volume = 0.0;
          audioB.volume = Math.max(0, Math.min(1, 1.0 * multB));
          setLiveGainA(0);
          setLiveGainB(Math.round(100 * multB));
          if (!audioA.paused) audioA.pause();
        }

        if (elapsed < totalMs) {
          auditionAnimRef.current = requestAnimationFrame(tick);
        } else {
          stopAudition();
        }
      };

      auditionAnimRef.current = requestAnimationFrame(tick);
    } catch (err) {
      console.warn('[Audition] Error:', err);
      stopAudition();
    }
  };

  const handleSave = () => {
    stopAudition();
    setIsSavedNotice(true);
    setIsMixMode?.(true);
    onSaveTransition({
      style,
      duration,
      bars,
      crossoverBias,
      mixOutPoint,
      mixInPoint,
      volA,
      volB,
      speedA,
      speedB,
      autoMatchBpm,
      bassKill,
      keyA: dataA.key,
      keyB: dataB.key,
      bpmA: dataA.bpm,
      bpmB: dataB.bpm
    });
    setTimeout(() => {
      onClose();
    }, 200);
  };

  // Waveform zone percentages
  const overlapSec = duration;
  const overlapStartPctA = Math.max(0, ((mixOutPoint - overlapSec) / durA) * 100);
  const mixOutPctA = Math.min(100, (mixOutPoint / durA) * 100);

  const mixInPctB = Math.max(0, (mixInPoint / durB) * 100);
  const overlapEndPctB = Math.min(100, ((mixInPoint + overlapSec) / durB) * 100);

  // SVG Envelope Curve Points (500x70 resolution)
  const curvePointsA = [];
  const curvePointsB = [];
  const sampleSteps = 40;
  for (let i = 0; i <= sampleSteps; i++) {
    const rawP = i / sampleSteps;
    const x = rawP * 500;
    const { gainA, gainB } = calculateCrossfadeGains(rawP, style, crossoverBias);
    const yA = 62 - Math.max(0, Math.min(1, gainA)) * 52;
    const yB = 62 - Math.max(0, Math.min(1, gainB)) * 52;
    curvePointsA.push(`${x.toFixed(1)},${yA.toFixed(1)}`);
    curvePointsB.push(`${x.toFixed(1)},${yB.toFixed(1)}`);
  }

  const crossoverHandleX = crossoverBias * 500;
  const { gainA: crossA, gainB: crossB } = calculateCrossfadeGains(crossoverBias, style, crossoverBias);
  const crossoverHandleY = 62 - Math.max(0, Math.min(1, (crossA + crossB) / 2)) * 52;

  return (
    <div 
      className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-200"
      onClick={() => { stopAudition(); onClose(); }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        className="bg-[#121212] border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col overflow-hidden text-white relative animate-in zoom-in-95 duration-200"
      >
        {/* ── Modal Header ── */}
        <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between bg-zinc-900/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
              <Sliders size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Edit Transition
                </h3>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Spotify Automix
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate max-w-[280px] sm:max-w-md">
                {trackA.title} → {trackB.title}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { stopAudition(); onClose(); }}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Scrollable Body Area ── */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">

          {/* 1. DUAL WAVEFORMS & INTUITIVE CUE CONTROLS */}
          <div className="space-y-3 p-4 rounded-2xl bg-zinc-950 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Layers size={14} className="text-emerald-400" />
                Waveform Cue Points & Zone Resizing
              </span>
              <span className="text-[11px] font-mono text-zinc-400 flex items-center gap-1">
                <MoveHorizontal size={12} className="text-emerald-400" />
                Click waveform or drag sliders to position cue points
              </span>
            </div>

            {/* DECK A: MIX-OUT POINT */}
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0" />
                  <span className="font-bold text-white truncate max-w-[150px] sm:max-w-[220px]">
                    Deck A: {trackA.title}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 font-bold bg-white/5 px-1.5 py-0.5 rounded">
                    {dataA.bpm} BPM • {dataA.key}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-xs font-mono">
                  {/* SOLO PREVIEW DECK A */}
                  <button
                    type="button"
                    onClick={handlePreviewSoloA}
                    disabled={isLoadingAudio}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                      soloPlayingDeck === 'A'
                        ? 'bg-red-500 text-white border-red-400 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-red-300 border-red-500/30 hover:border-red-500/60'
                    }`}
                    title="Audition Track A Mix-Out point"
                  >
                    {isLoadingAudio && soloPlayingDeck === 'A' ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : soloPlayingDeck === 'A' ? (
                      <Square size={11} fill="currentColor" />
                    ) : (
                      <Play size={11} fill="currentColor" />
                    )}
                    <span>{soloPlayingDeck === 'A' ? 'Stop Mix-Out' : 'Preview Mix-Out'}</span>
                  </button>

                  {/* Mix-Out Fine Tune Buttons */}
                  <div className="flex items-center gap-1 bg-zinc-900 border border-red-500/40 rounded-lg px-2 py-0.5">
                    <span className="text-red-400 font-bold text-[10px]">Mix-Out:</span>
                    <button
                      type="button"
                      onClick={() => setMixOutPoint(p => Math.max(5, p - 1))}
                      className="text-zinc-400 hover:text-white px-1 font-bold"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="font-bold text-white">{formatTime(mixOutPoint)}</span>
                    <button
                      type="button"
                      onClick={() => setMixOutPoint(p => Math.min(durA, p + 1))}
                      className="text-zinc-400 hover:text-white px-1 font-bold"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Direct Mix-Out Scrubber Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                  <span className="text-red-400 font-bold">
                    Mix-Out: {formatTime(mixOutPoint)} / {formatTime(durA)} ({Math.round((mixOutPoint / durA) * 100)}%)
                  </span>
                  <span>Remaining: {formatTime(Math.max(0, durA - mixOutPoint))}</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max={durA}
                  step="1"
                  value={mixOutPoint}
                  onChange={(e) => setMixOutPoint(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
              </div>

              {/* Interactive Draggable Deck A Waveform */}
              <div 
                className="relative h-14 bg-zinc-950 rounded-lg overflow-hidden cursor-ew-resize border border-white/10 flex items-center px-1 select-none"
                onPointerDown={handlePointerDownDeckA}
                onPointerMove={handlePointerMoveDeckA}
                onPointerUp={handlePointerUpDeckA}
                onPointerCancel={handlePointerUpDeckA}
                title="Click anywhere or drag to set Mix-Out point"
              >
                <div className="absolute inset-0 flex items-center justify-between px-1 pointer-events-none opacity-40">
                  {peaksA.map((p, idx) => (
                    <div 
                      key={idx}
                      className="w-1 bg-zinc-400 rounded-full"
                      style={{ height: `${Math.max(10, p * 100)}%` }}
                    />
                  ))}
                </div>

                {/* Shaded Red Overlap Region */}
                <div 
                  className="absolute top-0 bottom-0 bg-red-500/30 border-l border-r-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.25)] pointer-events-none"
                  style={{
                    left: `${overlapStartPctA}%`,
                    width: `${Math.max(1, mixOutPctA - overlapStartPctA)}%`
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-black text-red-200">
                    Overlap ({duration}s)
                  </div>
                </div>

                {/* Mix-Out Marker */}
                <div 
                  className="absolute top-0 bottom-0 w-2 bg-red-500 z-10 shadow-[0_0_12px_#ef4444] cursor-ew-resize flex items-center justify-center"
                  style={{ left: `${mixOutPctA}%` }}
                >
                  <div className="w-0.5 h-6 bg-white/70 rounded-full" />
                  <div className="absolute top-0 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-red-600 text-white shadow pointer-events-none whitespace-nowrap">
                    Mix-Out: {formatTime(mixOutPoint)}
                  </div>
                </div>

                {/* Transition Audition Cursor */}
                {isPreviewing && (
                  <div 
                    className="absolute top-0 bottom-0 w-1 bg-white z-20 shadow-[0_0_8px_#ffffff]"
                    style={{ left: `${overlapStartPctA + previewProgress * (mixOutPctA - overlapStartPctA)}%` }}
                  />
                )}

                {/* Solo Deck A Cursor */}
                {soloPlayingDeck === 'A' && (
                  <div 
                    className="absolute top-0 bottom-0 w-1 bg-red-400 z-20 shadow-[0_0_10px_#ef4444]"
                    style={{ left: `${overlapStartPctA + soloProgress * (mixOutPctA - overlapStartPctA)}%` }}
                  />
                )}
              </div>

              {/* Deck A Level & Speed Tweaks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-white/5 text-[10px] font-mono">
                {/* Volume Level */}
                <div className="space-y-1">
                  <div className="flex justify-between text-zinc-400">
                    <span className="flex items-center gap-1 text-red-400 font-bold">
                      <Volume2 size={12} />
                      Volume: {volA}%
                    </span>
                    <span className="text-zinc-500">{volA === 100 ? '100% (Default)' : volA > 100 ? `+${volA - 100}% Boost` : `${volA - 100}% Cut`}</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="140"
                    step="5"
                    value={volA}
                    onChange={(e) => setVolA(Number(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-red-500"
                  />
                </div>

                {/* Speed / Tempo */}
                <div className="space-y-1">
                  <div className="flex justify-between text-zinc-400">
                    <span className="flex items-center gap-1 text-amber-400 font-bold">
                      <Gauge size={12} />
                      Speed: {speedA.toFixed(2)}x
                    </span>
                    <button 
                      type="button" 
                      onClick={() => setSpeedA(1.0)} 
                      className="text-[9px] text-zinc-400 hover:text-white underline cursor-pointer"
                    >
                      Reset (1.0x)
                    </button>
                  </div>
                  <input
                    type="range"
                    min="0.85"
                    max="1.15"
                    step="0.01"
                    value={speedA}
                    onChange={(e) => setSpeedA(Number(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-amber-500"
                  />
                </div>
              </div>

              {/* Quick Jump Cue Point Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-[10px] font-mono">
                <div className="flex flex-wrap items-center gap-1 text-zinc-400">
                  <span className="text-zinc-500 mr-1">Quick Jump:</span>
                  <button
                    type="button"
                    onClick={() => setMixOutPoint(Math.round(durA * 0.45))}
                    className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 cursor-pointer"
                  >
                    Radio Cut (45%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMixOutPoint(Math.round(durA * 0.65))}
                    className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 cursor-pointer"
                  >
                    Chorus 2 (65%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMixOutPoint(Math.round(durA * 0.85))}
                    className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 cursor-pointer"
                  >
                    Outro (85%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMixOutPoint(Math.max(5, durA - 2))}
                    className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 cursor-pointer"
                  >
                    Full Song (99%)
                  </button>
                </div>
              </div>
            </div>

            {/* DECK B: MIX-IN POINT */}
            <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-white/5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="font-bold text-white truncate max-w-[150px] sm:max-w-[220px]">
                    Deck B: {trackB.title}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400 font-bold bg-white/5 px-1.5 py-0.5 rounded">
                    {dataB.bpm} BPM • {dataB.key}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-xs font-mono">
                  {/* SOLO PREVIEW DECK B */}
                  <button
                    type="button"
                    onClick={handlePreviewSoloB}
                    disabled={isLoadingAudio}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                      soloPlayingDeck === 'B'
                        ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-emerald-300 border-emerald-500/30 hover:border-emerald-500/60'
                    }`}
                    title="Audition Track B Mix-In point"
                  >
                    {isLoadingAudio && soloPlayingDeck === 'B' ? (
                      <Loader2 size={11} className="animate-spin" />
                    ) : soloPlayingDeck === 'B' ? (
                      <Square size={11} fill="currentColor" />
                    ) : (
                      <Play size={11} fill="currentColor" />
                    )}
                    <span>{soloPlayingDeck === 'B' ? 'Stop Mix-In' : 'Preview Mix-In'}</span>
                  </button>

                  {/* Mix-In Fine Tune Buttons */}
                  <div className="flex items-center gap-1 bg-zinc-900 border border-emerald-500/40 rounded-lg px-2 py-0.5">
                    <span className="text-emerald-400 font-bold text-[10px]">Mix-In:</span>
                    <button
                      type="button"
                      onClick={() => setMixInPoint(p => Math.max(0, p - 1))}
                      className="text-zinc-400 hover:text-white px-1 font-bold"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="font-bold text-white">{formatTime(mixInPoint)}</span>
                    <button
                      type="button"
                      onClick={() => setMixInPoint(p => Math.min(durB - 5, p + 1))}
                      className="text-zinc-400 hover:text-white px-1 font-bold"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Direct Mix-In Scrubber Slider */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                  <span className="text-emerald-400 font-bold">
                    Mix-In: {formatTime(mixInPoint)} / {formatTime(durB)} ({Math.round((mixInPoint / durB) * 100)}%)
                  </span>
                  <span>Starts exactly at: {formatTime(mixInPoint)} (Skips intro)</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.max(0, durB - 5)}
                  step="1"
                  value={mixInPoint}
                  onChange={(e) => setMixInPoint(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Interactive Draggable Deck B Waveform */}
              <div 
                className="relative h-14 bg-zinc-950 rounded-lg overflow-hidden cursor-ew-resize border border-white/10 flex items-center px-1 select-none"
                onPointerDown={handlePointerDownDeckB}
                onPointerMove={handlePointerMoveDeckB}
                onPointerUp={handlePointerUpDeckB}
                onPointerCancel={handlePointerUpDeckB}
                title="Click anywhere or drag to set Mix-In point"
              >
                <div className="absolute inset-0 flex items-center justify-between px-1 pointer-events-none opacity-40">
                  {peaksB.map((p, idx) => (
                    <div 
                      key={idx}
                      className="w-1 bg-zinc-400 rounded-full"
                      style={{ height: `${Math.max(10, p * 100)}%` }}
                    />
                  ))}
                </div>

                {/* Shaded Emerald Entry Region */}
                <div 
                  className="absolute top-0 bottom-0 bg-emerald-500/30 border-l-2 border-r border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.25)] pointer-events-none"
                  style={{
                    left: `${mixInPctB}%`,
                    width: `${Math.max(1, overlapEndPctB - mixInPctB)}%`
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-black text-emerald-200">
                    Entry ({duration}s)
                  </div>
                </div>

                {/* Mix-In Marker */}
                <div 
                  className="absolute top-0 bottom-0 w-2 bg-emerald-400 z-10 shadow-[0_0_12px_#10b981] cursor-ew-resize flex items-center justify-center"
                  style={{ left: `${mixInPctB}%` }}
                >
                  <div className="w-0.5 h-6 bg-black/70 rounded-full" />
                  <div className="absolute top-0 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500 text-black shadow pointer-events-none whitespace-nowrap">
                    Mix-In: {formatTime(mixInPoint)}
                  </div>
                </div>

                {/* Transition Audition Cursor */}
                {isPreviewing && (
                  <div 
                    className="absolute top-0 bottom-0 w-1 bg-white z-20 shadow-[0_0_8px_#ffffff]"
                    style={{ left: `${mixInPctB + previewProgress * (overlapEndPctB - mixInPctB)}%` }}
                  />
                )}

                {/* Solo Deck B Cursor */}
                {soloPlayingDeck === 'B' && (
                  <div 
                    className="absolute top-0 bottom-0 w-1 bg-emerald-400 z-20 shadow-[0_0_10px_#10b981]"
                    style={{ left: `${mixInPctB + soloProgress * (overlapEndPctB - mixInPctB)}%` }}
                  />
                )}
              </div>

              {/* Deck B Level & Speed Tweaks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-white/5 text-[10px] font-mono">
                {/* Volume Level */}
                <div className="space-y-1">
                  <div className="flex justify-between text-zinc-400">
                    <span className="flex items-center gap-1 text-emerald-400 font-bold">
                      <Volume2 size={12} />
                      Volume: {volB}%
                    </span>
                    <span className="text-zinc-500">{volB === 100 ? '100% (Default)' : volB > 100 ? `+${volB - 100}% Boost` : `${volB - 100}% Cut`}</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="140"
                    step="5"
                    value={volB}
                    onChange={(e) => setVolB(Number(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                {/* Speed / Tempo + BPM Sync */}
                <div className="space-y-1">
                  <div className="flex justify-between text-zinc-400">
                    <span className="flex items-center gap-1 text-teal-400 font-bold">
                      <Gauge size={12} />
                      Speed: {speedB.toFixed(2)}x
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button 
                        type="button" 
                        onClick={() => {
                          const ratio = Number((dataA.bpm / dataB.bpm).toFixed(2));
                          setSpeedB(Math.max(0.85, Math.min(1.15, ratio)));
                        }} 
                        className="text-[9px] text-emerald-400 hover:text-emerald-300 font-bold cursor-pointer bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/30"
                        title={`Match Deck B speed to Deck A tempo (${dataA.bpm} BPM)`}
                      >
                        ⚡ Sync BPM ({dataA.bpm})
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setSpeedB(1.0)} 
                        className="text-[9px] text-zinc-400 hover:text-white underline cursor-pointer"
                      >
                        1.0x
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="0.85"
                    max="1.15"
                    step="0.01"
                    value={speedB}
                    onChange={(e) => setSpeedB(Number(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded appearance-none cursor-pointer accent-teal-400"
                  />
                </div>
              </div>

              {/* Quick Jump Cue Point Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 text-[10px] font-mono">
                <div className="flex flex-wrap items-center gap-1 text-zinc-400">
                  <span className="text-zinc-500 mr-1">Quick Jump:</span>
                  <button
                    type="button"
                    onClick={() => setMixInPoint(0)}
                    className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 cursor-pointer"
                  >
                    Start (0:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMixInPoint(Math.min(durB, 12))}
                    className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 cursor-pointer"
                  >
                    Skip Intro (+12s)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMixInPoint(Math.min(durB, 24))}
                    className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 cursor-pointer"
                  >
                    Drop Start (+24s)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* 2. SPOTIFY TRANSITION PRESETS */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Transition Style • Spotify Presets
              </label>
              <span className="text-[11px] font-mono text-emerald-400 font-bold">
                {TRANSITION_STYLES.find(t => t.id === style)?.badge || 'Custom'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TRANSITION_STYLES.map((st) => {
                const Icon = st.icon;
                const isSelected = style === st.id;
                return (
                  <button
                    key={st.id}
                    onClick={() => handleSelectStyle(st.id)}
                    className={`p-3 rounded-2xl text-left border transition-all flex items-start gap-3 cursor-pointer group ${
                      isSelected
                        ? 'bg-zinc-800/95 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/50'
                        : 'bg-zinc-900/50 border-white/5 hover:border-white/20 hover:bg-zinc-900/80'
                    }`}
                  >
                    <div 
                      className="p-2 rounded-xl shrink-0 transition-transform group-hover:scale-105"
                      style={{ 
                        backgroundColor: isSelected ? st.color : 'rgba(255,255,255,0.06)', 
                        color: isSelected ? '#000' : st.color 
                      }}
                    >
                      <Icon size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-white">{st.name}</span>
                        {isSelected && (
                          <Check size={14} className="text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug line-clamp-2">
                        {st.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. BARS & OVERLAP DURATION */}
          <div className="p-4 rounded-2xl bg-zinc-900/60 border border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Duration & Quantized Bars
              </label>
              <div className="flex items-center gap-1.5 font-mono">
                <span className="text-xs font-bold text-zinc-400">{bars} Bars</span>
                <span className="text-xs text-zinc-500">•</span>
                <span className="text-sm font-black text-emerald-400">{duration}s</span>
              </div>
            </div>

            {/* Quick Bar Buttons */}
            <div className="grid grid-cols-5 gap-2">
              {BAR_OPTIONS.map((b) => {
                const sec = calculateBarsDuration(b, dataA.bpm);
                const isSelected = bars === b;
                return (
                  <button
                    key={b}
                    type="button"
                    onClick={() => handleSelectBars(b)}
                    className={`py-2 px-1.5 rounded-xl text-center border font-mono transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500 text-black border-emerald-400 font-black shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                        : 'bg-zinc-800/80 text-zinc-300 border-white/5 hover:border-white/20 hover:bg-zinc-800 font-bold'
                    }`}
                  >
                    <div className="text-xs">{b} {b === 1 ? 'Bar' : 'Bars'}</div>
                    <div className={`text-[10px] mt-0.5 ${isSelected ? 'text-black/80 font-bold' : 'text-zinc-400'}`}>
                      ~{sec}s
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Fine Tuning Slider */}
            <div className="pt-2">
              <div className="relative flex items-center h-6 group">
                <div className="w-full h-2 rounded-full bg-zinc-800 border border-white/5 overflow-hidden relative shadow-inner">
                  <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-75"
                    style={{ width: `${thumbPct}%` }}
                  />
                </div>
                <input
                  type="range"
                  min="1"
                  max={maxAllowedSec}
                  step="0.5"
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                />
                <div 
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg pointer-events-none transition-transform duration-75 group-hover:scale-125 z-10 border border-zinc-300"
                  style={{ left: `calc(${thumbPct}% - 8px)` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-500 font-mono mt-1">
                <span>Fast Snap (1s)</span>
                <span>Standard DJ Overlap (4-8s)</span>
                <span>Max Mix ({maxAllowedSec}s)</span>
              </div>
            </div>
          </div>

          {/* 4. REALTIME INTERACTIVE ENVELOPE CURVE GRAPH & CROSSOVER TUNER */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-white/10 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono font-bold uppercase tracking-wider">
              {/* Live Track A Meter */}
              <span className="flex items-center gap-1.5 text-red-400">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shrink-0" />
                <span>Track A Out ({trackA.title})</span>
                <span className="bg-red-500/20 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded font-black">
                  {liveGainA}%
                </span>
              </span>

              {/* Preset Crossover Buttons */}
              <div className="flex items-center gap-1">
                <span className="text-zinc-500 mr-1 hidden sm:inline">Bias:</span>
                <button
                  type="button"
                  onClick={() => setCrossoverBias(0.30)}
                  className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                    crossoverBias <= 0.35
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-black'
                      : 'bg-zinc-900 text-zinc-400 border-white/5 hover:border-white/20'
                  }`}
                  title="Track A ducks early, Track B takes over sooner"
                >
                  Early (30%)
                </button>
                <button
                  type="button"
                  onClick={() => setCrossoverBias(0.50)}
                  className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                    crossoverBias > 0.35 && crossoverBias < 0.65
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-black'
                      : 'bg-zinc-900 text-zinc-400 border-white/5 hover:border-white/20'
                  }`}
                  title="Centered 50% crossover"
                >
                  Center (50%)
                </button>
                <button
                  type="button"
                  onClick={() => setCrossoverBias(0.70)}
                  className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                    crossoverBias >= 0.65
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-black'
                      : 'bg-zinc-900 text-zinc-400 border-white/5 hover:border-white/20'
                  }`}
                  title="Track A holds energy longer before drop"
                >
                  Late (70%)
                </button>
              </div>

              {/* Live Track B Meter */}
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-black">
                  {liveGainB}%
                </span>
                <span>Track B In ({trackB.title})</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shrink-0" />
              </span>
            </div>

            {/* Fully Interactive Curve Area: Drag anywhere to shift crossover! */}
            <div 
              className="relative h-28 w-full flex flex-col justify-center overflow-hidden bg-zinc-900/60 rounded-xl border border-white/10 p-2 select-none cursor-ew-resize group"
              onPointerDown={handlePointerDownCurve}
              onPointerMove={handlePointerMoveCurve}
              onPointerUp={handlePointerUpCurve}
              onPointerCancel={handlePointerUpCurve}
              title="Click or drag anywhere left/right to adjust crossover point"
            >
              <svg viewBox="0 0 500 70" className="w-full h-full pointer-events-none">
                {/* Background Grid Lines representing time divisions */}
                <line x1="0" y1="35" x2="500" y2="35" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <line x1="125" y1="0" x2="125" y2="70" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 2" />
                <line x1="250" y1="0" x2="250" y2="70" stroke="rgba(255,255,255,0.12)" strokeDasharray="2 2" />
                <line x1="375" y1="0" x2="375" y2="70" stroke="rgba(255,255,255,0.06)" strokeDasharray="2 2" />

                {/* Vertical Crossover Bias Indicator Line */}
                <line 
                  x1={crossoverHandleX} 
                  y1="0" 
                  x2={crossoverHandleX} 
                  y2="70" 
                  stroke="rgba(16,185,129,0.5)" 
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />

                {/* Track A Red Fade-Out Curve */}
                <polyline 
                  fill="none" 
                  stroke="#ef4444" 
                  strokeWidth="2.5" 
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={curvePointsA.join(' ')} 
                />

                {/* Track B Green Fade-In Curve */}
                <polyline 
                  fill="none" 
                  stroke="#10b981" 
                  strokeWidth="2.5" 
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={curvePointsB.join(' ')} 
                />

                {/* Draggable Crossover Intersection Handle */}
                <circle 
                  cx={crossoverHandleX} 
                  cy={crossoverHandleY} 
                  r="7" 
                  fill="#10b981" 
                  stroke="#ffffff" 
                  strokeWidth="2" 
                  className="filter drop-shadow-[0_0_8px_rgba(16,185,129,0.9)]"
                />

                {/* Audition Active Sweep Playhead */}
                {isPreviewing && (
                  <line 
                    x1={previewProgress * 500} 
                    y1="0" 
                    x2={previewProgress * 500} 
                    y2="70" 
                    stroke="#ffffff" 
                    strokeWidth="2" 
                    className="filter drop-shadow-[0_0_8px_#ffffff]"
                  />
                )}
              </svg>

              {/* Dynamic Time Markers strictly matching the selected Duration */}
              <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400 px-1 pt-1 border-t border-white/5">
                <span>0.0s (Start)</span>
                <span>{(duration * 0.25).toFixed(1)}s</span>
                <span className="text-emerald-400 font-bold">Mid: {(duration * 0.5).toFixed(1)}s</span>
                <span>{(duration * 0.75).toFixed(1)}s</span>
                <span className="text-zinc-200 font-bold">{duration}s (Full Drop)</span>
              </div>
            </div>

            {/* Direct Crossover Point Slider */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                <span className="text-emerald-400 font-bold">
                  Crossover Point: {Math.round(crossoverBias * 100)}%
                </span>
                <span>
                  {crossoverBias <= 0.35 
                    ? 'Track A ducks earlier, Track B drops sooner' 
                    : crossoverBias >= 0.65 
                    ? 'Track A holds full energy longer before drop' 
                    : 'Balanced centered crossover'}
                </span>
              </div>
              <input
                type="range"
                min="0.20"
                max="0.80"
                step="0.01"
                value={crossoverBias}
                onChange={(e) => setCrossoverBias(Number(e.target.value))}
                className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
          </div>
        </div>

        {/* ── Modal Footer: Audition & Save Controls ── */}
        <div className="p-4 border-t border-white/10 bg-zinc-900/90 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Transition Audition Button */}
          <button
            type="button"
            onClick={handleAuditionTransition}
            disabled={isLoadingAudio}
            className={`px-4 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all cursor-pointer border ${
              isPreviewing
                ? 'bg-red-500 text-white border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
                : 'bg-zinc-800 hover:bg-zinc-700 text-white border-white/10 hover:border-white/30'
            }`}
          >
            {isLoadingAudio && isPreviewing ? (
              <Loader2 size={14} className="animate-spin text-emerald-400" />
            ) : isPreviewing ? (
              <Square size={14} fill="currentColor" />
            ) : (
              <Play size={14} fill="currentColor" />
            )}
            <span>{isPreviewing ? 'Stop Audition' : 'Audition Transition'}</span>
          </button>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { stopAudition(); onClose(); }}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer font-sans shadow-lg ${
                isSavedNotice
                  ? 'bg-emerald-400 text-black shadow-emerald-400/40 scale-105'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
              }`}
            >
              <Check size={14} />
              <span>{isSavedNotice ? 'Saved!' : 'Save Transition'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
