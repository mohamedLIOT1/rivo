import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, Sliders, Volume2, Wand2, Play, Square, Check, Sparkles, Activity, Music2, 
  Disc, Zap, Radio, Layers, Plus, Minus, Info, Loader2
} from 'lucide-react';
import { getTrackMusicalData, checkHarmonicCompatibility, getRecommendedTransition, getCamelotColor, calculateBarsDuration } from '../utils/musicAnalysis';
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
  const compatibility = checkHarmonicCompatibility(dataA.key, dataB.key, dataA.bpm, dataB.bpm);
  const recommended = getRecommendedTransition(trackA, trackB);

  // Transition parameters state
  const [style, setStyle] = useState(initialTransition?.style || recommended.style || 'auto');
  const [bars, setBars] = useState(initialTransition?.bars || (recommended.style === 'slam' ? 2 : 4));
  const [duration, setDuration] = useState(
    initialTransition?.duration || 
    calculateBarsDuration(initialTransition?.bars || 4, dataA.bpm) || 8
  );

  // Cue Points: Mix-Out (Track A) and Mix-In (Track B)
  const defaultMixOut = Math.round(durA * 0.85);
  const [mixOutPoint, setMixOutPoint] = useState(() => {
    return initialTransition?.mixOutPoint ? Math.min(durA, Number(initialTransition.mixOutPoint)) : defaultMixOut;
  });
  const [mixInPoint, setMixInPoint] = useState(() => {
    return initialTransition?.mixInPoint ? Math.min(durB, Number(initialTransition.mixInPoint)) : 0;
  });

  const [autoMatchBpm, setAutoMatchBpm] = useState(initialTransition?.autoMatchBpm !== false);
  const [bassKill, setBassKill] = useState(Boolean(initialTransition?.bassKill));

  // Audition Engine State (Supports: Full Dual Transition, Deck A Solo, Deck B Solo)
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);
  const [soloPlayingDeck, setSoloPlayingDeck] = useState(null); // 'A' | 'B' | null
  const [soloProgress, setSoloProgress] = useState(0);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);

  const auditionCtxRef = useRef(null);
  const auditionDeckARef = useRef(null);
  const auditionDeckBRef = useRef(null);
  const auditionGainARef = useRef(null);
  const auditionGainBRef = useRef(null);
  const auditionFilterARef = useRef(null);
  const auditionFilterBRef = useRef(null);
  const auditionTimerRef = useRef(null);
  const auditionAnimRef = useRef(null);

  // Waveform peak data
  const peaksA = useMemo(() => generatePeaksForTrack(trackA, 100), [trackA?.id, trackA?._id, trackA?.title]);
  const peaksB = useMemo(() => generatePeaksForTrack(trackB, 100), [trackB?.id, trackB?._id, trackB?.title]);

  const camelotColA = getCamelotColor(dataA.key);
  const camelotColB = getCamelotColor(dataB.key);

  const trackAId = String(trackA?.id || trackA?._id || '');
  const trackBId = String(trackB?.id || trackB?._id || '');

  useEffect(() => {
    if (!isOpen) return;
    if (initialTransition) {
      setStyle(initialTransition.style || 'auto');
      const b = initialTransition.bars || (initialTransition.style === 'slam' ? 2 : 4);
      setBars(b);
      setDuration(initialTransition.duration || calculateBarsDuration(b, dataA.bpm) || 8);
      if (initialTransition.mixOutPoint) setMixOutPoint(Math.min(durA, Number(initialTransition.mixOutPoint)));
      if (initialTransition.mixInPoint) setMixInPoint(Math.min(durB, Number(initialTransition.mixInPoint)));
      setAutoMatchBpm(initialTransition.autoMatchBpm !== false);
      setBassKill(Boolean(initialTransition.bassKill));
    } else {
      setStyle(recommended.style);
      const b = recommended.bars || 4;
      setBars(b);
      setDuration(recommended.duration || calculateBarsDuration(b, dataA.bpm) || 8);
      setMixOutPoint(defaultMixOut);
      setMixInPoint(0);
    }
  }, [trackAId, trackBId, isOpen]);

  // Clean stop for isolated audition
  const stopAudition = () => {
    if (auditionTimerRef.current) clearInterval(auditionTimerRef.current);
    if (auditionAnimRef.current) cancelAnimationFrame(auditionAnimRef.current);
    if (auditionDeckARef.current) {
      try {
        auditionDeckARef.current.pause();
        auditionDeckARef.current.removeAttribute('src');
        auditionDeckARef.current.load();
      } catch {}
      auditionDeckARef.current = null;
    }
    if (auditionDeckBRef.current) {
      try {
        auditionDeckBRef.current.pause();
        auditionDeckBRef.current.removeAttribute('src');
        auditionDeckBRef.current.load();
      } catch {}
      auditionDeckBRef.current = null;
    }
    setIsPreviewing(false);
    setSoloPlayingDeck(null);
    setSoloProgress(0);
    setPreviewProgress(0);
    setIsLoadingAudio(false);
  };

  useEffect(() => {
    return () => {
      stopAudition();
      if (auditionCtxRef.current && auditionCtxRef.current.state !== 'closed') {
        try { auditionCtxRef.current.close(); } catch {}
      }
    };
  }, []);

  if (!isOpen || !trackA || !trackB) return null;

  // Max allowed seconds for slider (adapts to 16 bars without overflowing thumb)
  const maxAllowedSec = Math.max(32, Math.ceil(duration / 4) * 4);
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

  // ── Solo Deck A Audition (Mix-Out Point alone) ──
  const handlePreviewSoloA = async () => {
    if (soloPlayingDeck === 'A') {
      stopAudition();
      return;
    }
    stopAudition();
    if (isPlaying && togglePlay) togglePlay();

    setIsLoadingAudio(true);
    try {
      const resA = await resolvePlayableAudioStream(trackA);
      setIsLoadingAudio(false);
      const urlA = resA?.url ? (resA.url.startsWith('/') ? `${API_BASE_URL}${resA.url}` : resA.url) : '';
      if (!urlA) return;

      const audioA = new Audio(urlA);
      audioA.crossOrigin = 'anonymous';
      auditionDeckARef.current = audioA;

      const previewDuration = Math.min(duration, 10);
      const startSec = Math.max(0, mixOutPoint - previewDuration);
      audioA.currentTime = startSec;
      audioA.volume = 1.0;

      setSoloPlayingDeck('A');
      await audioA.play();

      const startTime = performance.now();
      const totalMs = previewDuration * 1000;

      const tick = () => {
        const elapsed = performance.now() - startTime;
        const p = Math.min(1, elapsed / totalMs);
        setSoloProgress(p);

        if (p < 1 && audioA && !audioA.paused) {
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
    if (isPlaying && togglePlay) togglePlay();

    setIsLoadingAudio(true);
    try {
      const resB = await resolvePlayableAudioStream(trackB);
      setIsLoadingAudio(false);
      const urlB = resB?.url ? (resB.url.startsWith('/') ? `${API_BASE_URL}${resB.url}` : resB.url) : '';
      if (!urlB) return;

      const audioB = new Audio(urlB);
      audioB.crossOrigin = 'anonymous';
      auditionDeckBRef.current = audioB;

      const previewDuration = Math.min(duration, 10);
      audioB.currentTime = Math.max(0, mixInPoint);
      audioB.volume = 1.0;

      setSoloPlayingDeck('B');
      await audioB.play();

      const startTime = performance.now();
      const totalMs = previewDuration * 1000;

      const tick = () => {
        const elapsed = performance.now() - startTime;
        const p = Math.min(1, elapsed / totalMs);
        setSoloProgress(p);

        if (p < 1 && audioB && !audioB.paused) {
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

  // ── Dual Track Transition DSP Audition Preview ──
  const handleToggleAudition = async () => {
    if (isPreviewing) {
      stopAudition();
      return;
    }
    stopAudition();
    if (isPlaying && togglePlay) togglePlay();

    setIsLoadingAudio(true);
    try {
      const [resA, resB] = await Promise.all([
        resolvePlayableAudioStream(trackA),
        resolvePlayableAudioStream(trackB)
      ]);
      setIsLoadingAudio(false);

      const urlA = resA?.url ? (resA.url.startsWith('/') ? `${API_BASE_URL}${resA.url}` : resA.url) : '';
      const urlB = resB?.url ? (resB.url.startsWith('/') ? `${API_BASE_URL}${resB.url}` : resB.url) : '';

      if (!urlA || !urlB) {
        console.warn('[Audition] Missing audio URLs');
        return;
      }

      // Initialize isolated AudioContext if not ready
      if (!auditionCtxRef.current || auditionCtxRef.current.state === 'closed') {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        auditionCtxRef.current = new AudioCtx();
      }
      const ctx = auditionCtxRef.current;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const audioA = new Audio(urlA);
      audioA.crossOrigin = 'anonymous';
      auditionDeckARef.current = audioA;

      const audioB = new Audio(urlB);
      audioB.crossOrigin = 'anonymous';
      auditionDeckBRef.current = audioB;

      const sourceA = ctx.createMediaElementSource(audioA);
      const filterA = ctx.createBiquadFilter();
      const gainA = ctx.createGain();
      sourceA.connect(filterA);
      filterA.connect(gainA);
      gainA.connect(ctx.destination);
      auditionFilterARef.current = filterA;
      auditionGainARef.current = gainA;

      const sourceB = ctx.createMediaElementSource(audioB);
      const filterB = ctx.createBiquadFilter();
      const gainB = ctx.createGain();
      sourceB.connect(filterB);
      filterB.connect(gainB);
      gainB.connect(ctx.destination);
      auditionFilterBRef.current = filterB;
      auditionGainBRef.current = gainB;

      filterA.type = 'allpass';
      filterA.frequency.value = 20000;
      filterB.type = 'allpass';
      filterB.frequency.value = 20000;
      gainA.gain.value = 1.0;
      gainB.gain.value = 0.0;

      const leadInSec = 3.0; // Play 3s of Track A leading into transition
      const seekA = Math.max(0, mixOutPoint - duration - leadInSec);
      audioA.currentTime = seekA;
      audioB.currentTime = mixInPoint;

      setIsPreviewing(true);
      setPreviewProgress(0);

      await audioA.play();

      const startTime = performance.now();
      const leadInMs = leadInSec * 1000;
      const transMs = Math.max(1, duration) * 1000;
      const tailMs = 2500;
      const totalMs = leadInMs + transMs + tailMs;

      let deckBStarted = false;

      const tick = () => {
        const elapsed = performance.now() - startTime;

        if (elapsed < leadInMs) {
          setPreviewProgress(0);
          gainA.gain.value = 1.0;
          gainB.gain.value = 0.0;
        } else if (elapsed <= leadInMs + transMs) {
          if (!deckBStarted) {
            deckBStarted = true;
            audioB.currentTime = mixInPoint;
            audioB.play().catch(() => {});
          }

          const p = (elapsed - leadInMs) / transMs;
          setPreviewProgress(p);

          if (style === 'rise') {
            filterA.type = 'highpass';
            filterA.frequency.value = 30 + Math.pow(p, 2) * 3500;
            gainA.gain.value = p < 0.75 ? 1.0 : Math.max(0, 1 - (p - 0.75) * 4);
            gainB.gain.value = Math.pow(p, 1.5);
          } else if (style === 'blend') {
            filterA.type = 'lowshelf';
            filterA.frequency.value = 250;
            filterA.gain.value = p < 0.45 ? 0 : -24 * ((p - 0.45) / 0.55);
            gainA.gain.value = p < 0.5 ? 1.0 : Math.max(0, (1 - p) * 2);
            gainB.gain.value = p < 0.5 ? p * 1.5 : 1.0;
          } else if (style === 'wave') {
            filterA.type = 'lowpass';
            filterA.frequency.value = Math.max(350, 20000 * (1 - p));
            gainA.gain.value = Math.cos(p * Math.PI / 2);
            gainB.gain.value = Math.sin(p * Math.PI / 2);
          } else if (style === 'slam') {
            gainA.gain.value = p < 0.85 ? 1.0 : 0.0;
            gainB.gain.value = p >= 0.85 ? 1.0 : 0.0;
          } else {
            gainA.gain.value = Math.cos(p * Math.PI / 2);
            gainB.gain.value = Math.sin(p * Math.PI / 2);
          }
        } else {
          setPreviewProgress(1);
          gainA.gain.value = 0;
          gainB.gain.value = 1.0;
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
    setIsMixMode?.(true);
    onSaveTransition({
      style,
      duration,
      bars,
      mixOutPoint,
      mixInPoint,
      autoMatchBpm,
      bassKill,
      keyA: dataA.key,
      keyB: dataB.key,
      bpmA: dataA.bpm,
      bpmB: dataB.bpm
    });
    onClose();
  };

  // Waveform zone percentages
  const overlapSec = duration;
  const overlapStartPctA = Math.max(0, ((mixOutPoint - overlapSec) / durA) * 100);
  const mixOutPctA = Math.min(100, (mixOutPoint / durA) * 100);

  const mixInPctB = Math.max(0, (mixInPoint / durB) * 100);
  const overlapEndPctB = Math.min(100, ((mixInPoint + overlapSec) / durB) * 100);

  // SVG Envelope Curve Preview - dynamic width 400x70
  const curvePointsA = [];
  const curvePointsB = [];
  for (let i = 0; i <= 32; i++) {
    const x = (i / 32) * 400;
    const p = i / 32;
    let gA, gB;

    if (style === 'slam') {
      gA = p < 0.85 ? 1 : 0;
      gB = p >= 0.85 ? 1 : 0;
    } else if (style === 'rise') {
      gA = p < 0.75 ? 1.0 : Math.max(0, 1 - Math.pow((p - 0.75) / 0.25, 2));
      gB = Math.pow(p, 1.5);
    } else if (style === 'blend') {
      gA = p < 0.45 ? 1 - 0.15 * Math.pow(p / 0.45, 2) : 0.85 * Math.pow((1 - p) / 0.55, 3);
      gB = p < 0.45 ? 0.35 * Math.pow(p / 0.45, 1.8) : 0.35 + 0.65 * Math.pow((p - 0.45) / 0.55, 0.6);
    } else if (style === 'wave') {
      gA = p < 0.5 ? 1 - 0.25 * Math.sin(p * Math.PI) : Math.pow((1 - p) / 0.5, 2.2);
      gB = p < 0.5 ? Math.pow(p / 0.5, 2.2) : 0.75 + 0.25 * Math.sin((p - 0.5) * Math.PI);
    } else if (style === 'melt') {
      gA = Math.pow(1 - p, 1.8);
      gB = Math.pow(p, 1.8);
    } else {
      gA = Math.cos(p * Math.PI / 2);
      gB = Math.sin(p * Math.PI / 2);
    }

    const yA = 60 - Math.max(0, Math.min(1, gA)) * 50;
    const yB = 60 - Math.max(0, Math.min(1, gB)) * 50;
    curvePointsA.push(`${x.toFixed(1)},${yA.toFixed(1)}`);
    curvePointsB.push(`${x.toFixed(1)},${yB.toFixed(1)}`);
  }

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

          {/* 1. DUAL INTERACTIVE WAVEFORMS (TRACK A & TRACK B) */}
          <div className="space-y-3 p-4 rounded-2xl bg-zinc-950 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Layers size={14} className="text-emerald-400" />
                Waveform Cue Points & Zone Resizing
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                Click waveform or use [-] [+] to adjust exact timing
              </span>
            </div>

            {/* DECK A WAVEFORM: MIX-OUT POINT & OVERLAP ZONE */}
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
                
                {/* Deck A Actions & Direct Time Adjusters */}
                <div className="flex items-center gap-2 text-xs font-mono">
                  {/* SOLO PREVIEW DECK A BUTTON */}
                  <button
                    type="button"
                    onClick={handlePreviewSoloA}
                    disabled={isLoadingAudio}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                      soloPlayingDeck === 'A'
                        ? 'bg-red-500 text-white border-red-400 shadow-[0_0_10px_rgba(239,68,68,0.5)] animate-pulse'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-red-300 border-red-500/30 hover:border-red-500/60'
                    }`}
                    title="Audition only Track A Mix-Out point"
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

                  {/* Mix-Out Time Adjuster */}
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

                  {/* Overlap Size Adjuster */}
                  <div className="flex items-center gap-1 bg-zinc-900 border border-white/10 rounded-lg px-2 py-0.5">
                    <span className="text-zinc-400 text-[10px]">Zone:</span>
                    <button
                      type="button"
                      onClick={() => setDuration(d => Math.max(1, Number((d - 1).toFixed(1))))}
                      className="text-zinc-400 hover:text-white px-1 font-bold"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="font-bold text-emerald-400">{duration}s</span>
                    <button
                      type="button"
                      onClick={() => setDuration(d => Math.min(48, Number((d + 1).toFixed(1))))}
                      className="text-zinc-400 hover:text-white px-1 font-bold"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Interactive Track A Waveform */}
              <div 
                className="relative h-14 bg-zinc-950 rounded-lg overflow-hidden cursor-crosshair border border-white/5 flex items-center px-1"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0.1, Math.min(1.0, (e.clientX - rect.left) / rect.width));
                  setMixOutPoint(Math.round(pct * durA));
                }}
              >
                {/* Waveform Amplitude Bars */}
                <div className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none opacity-40">
                  {peaksA.map((p, idx) => (
                    <div 
                      key={idx}
                      className="w-1 bg-zinc-400 rounded-full"
                      style={{ height: `${Math.max(10, p * 100)}%` }}
                    />
                  ))}
                </div>

                {/* Red Overlap Shaded Region (from mixOut - duration to mixOut) */}
                <div 
                  className="absolute top-0 bottom-0 bg-red-500/30 border-l-2 border-r-2 border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)] pointer-events-none"
                  style={{
                    left: `${overlapStartPctA}%`,
                    width: `${mixOutPctA - overlapStartPctA}%`
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-black text-red-200">
                    Overlap ({duration}s)
                  </div>
                </div>

                {/* Mix-Out Right Handle Marker */}
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-red-500 z-10 shadow-[0_0_10px_#ef4444]"
                  style={{ left: `${mixOutPctA}%` }}
                >
                  <div className="absolute top-0 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-red-600 text-white shadow pointer-events-none whitespace-nowrap">
                    Mix-Out: {formatTime(mixOutPoint)}
                  </div>
                </div>

                {/* Real-time Transition Audition Cursor */}
                {isPreviewing && (
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-white z-20 shadow-[0_0_8px_#ffffff]"
                    style={{ left: `${overlapStartPctA + previewProgress * (mixOutPctA - overlapStartPctA)}%` }}
                  />
                )}

                {/* Real-time Solo Deck A Cursor */}
                {soloPlayingDeck === 'A' && (
                  <div 
                    className="absolute top-0 bottom-0 w-1 bg-red-400 z-20 shadow-[0_0_10px_#ef4444]"
                    style={{ left: `${overlapStartPctA + soloProgress * (mixOutPctA - overlapStartPctA)}%` }}
                  />
                )}
              </div>

              {/* Quick Jump Cue Point Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                <span className="text-zinc-500">Quick Jump:</span>
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

            {/* DECK B WAVEFORM: MIX-IN POINT & ENTRY ZONE */}
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
                
                {/* Deck B Actions & Direct Time Adjusters */}
                <div className="flex items-center gap-2 text-xs font-mono">
                  {/* SOLO PREVIEW DECK B BUTTON */}
                  <button
                    type="button"
                    onClick={handlePreviewSoloB}
                    disabled={isLoadingAudio}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                      soloPlayingDeck === 'B'
                        ? 'bg-emerald-500 text-black border-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)] animate-pulse'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-emerald-300 border-emerald-500/30 hover:border-emerald-500/60'
                    }`}
                    title="Audition only Track B Mix-In point"
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

              {/* Interactive Track B Waveform */}
              <div 
                className="relative h-14 bg-zinc-950 rounded-lg overflow-hidden cursor-crosshair border border-white/5 flex items-center px-1"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pct = Math.max(0, Math.min(0.9, (e.clientX - rect.left) / rect.width));
                  setMixInPoint(Math.round(pct * durB));
                }}
              >
                {/* Waveform Amplitude Bars */}
                <div className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none opacity-40">
                  {peaksB.map((p, idx) => (
                    <div 
                      key={idx}
                      className="w-1 bg-zinc-400 rounded-full"
                      style={{ height: `${Math.max(10, p * 100)}%` }}
                    />
                  ))}
                </div>

                {/* Green Entry Shaded Region (from mixIn to mixIn + duration) */}
                <div 
                  className="absolute top-0 bottom-0 bg-emerald-500/30 border-l-2 border-r-2 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)] pointer-events-none"
                  style={{
                    left: `${mixInPctB}%`,
                    width: `${overlapEndPctB - mixInPctB}%`
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-black text-emerald-200">
                    Entry ({duration}s)
                  </div>
                </div>

                {/* Mix-In Left Handle Marker */}
                <div 
                  className="absolute top-0 bottom-0 w-1 bg-emerald-400 z-10 shadow-[0_0_10px_#10b981]"
                  style={{ left: `${mixInPctB}%` }}
                >
                  <div className="absolute top-0 -translate-x-1/2 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500 text-black shadow pointer-events-none whitespace-nowrap">
                    Mix-In: {formatTime(mixInPoint)}
                  </div>
                </div>

                {/* Real-time Transition Audition Cursor */}
                {isPreviewing && (
                  <div 
                    className="absolute top-0 bottom-0 w-0.5 bg-white z-20 shadow-[0_0_8px_#ffffff]"
                    style={{ left: `${mixInPctB + previewProgress * (overlapEndPctB - mixInPctB)}%` }}
                  />
                )}

                {/* Real-time Solo Deck B Cursor */}
                {soloPlayingDeck === 'B' && (
                  <div 
                    className="absolute top-0 bottom-0 w-1 bg-emerald-400 z-20 shadow-[0_0_10px_#10b981]"
                    style={{ left: `${mixInPctB + soloProgress * (overlapEndPctB - mixInPctB)}%` }}
                  />
                )}
              </div>

              {/* Quick Jump Cue Point Buttons */}
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                <span className="text-zinc-500">Quick Jump:</span>
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

          {/* 4. REALTIME DYNAMIC ENVELOPE CURVE GRAPH */}
          <div className="p-4 rounded-2xl bg-zinc-950 border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-red-400 truncate max-w-[150px] sm:max-w-[200px]">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block shrink-0" />
                Track A Out ({trackA.title})
              </span>

              <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 border border-white/10 text-emerald-400 font-bold">
                ⏱️ Window: {duration}s • {bars} {bars === 1 ? 'Bar' : 'Bars'} • {style.toUpperCase()}
              </span>

              <span className="flex items-center gap-1.5 text-emerald-400 truncate max-w-[150px] sm:max-w-[200px]">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block shrink-0" />
                Track B In ({trackB.title})
              </span>
            </div>

            {/* Dynamic Curve Container */}
            <div className="relative h-20 w-full flex flex-col justify-center overflow-hidden bg-zinc-900/60 rounded-xl border border-white/10 p-2">
              <svg viewBox="0 0 400 70" className="w-full h-full">
                {/* Background Grid Lines spaced by bar divisions */}
                <line x1="0" y1="35" x2="400" y2="35" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                <line x1="100" y1="0" x2="100" y2="70" stroke="rgba(255,255,255,0.06)" />
                <line x1="200" y1="0" x2="200" y2="70" stroke="rgba(255,255,255,0.12)" strokeDasharray="2 2" />
                <line x1="300" y1="0" x2="300" y2="70" stroke="rgba(255,255,255,0.06)" />

                {/* Red Track A Volume Curve */}
                <polyline
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="3"
                  strokeLinecap="round"
                  points={curvePointsA.join(' ')}
                />

                {/* Green Track B Volume Curve */}
                <polyline
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="3"
                  strokeLinecap="round"
                  points={curvePointsB.join(' ')}
                />

                {/* Real-time Transition Audition Playhead */}
                {isPreviewing && (
                  <line
                    x1={previewProgress * 400}
                    y1="0"
                    x2={previewProgress * 400}
                    y2="70"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                    strokeDasharray="4 2"
                  />
                )}
              </svg>

              {/* Dynamic Time Scale Ruler Under Curve */}
              <div className="flex justify-between items-center text-[9px] font-mono text-zinc-400 px-1 mt-1 border-t border-white/5 pt-1">
                <span>0s (Start)</span>
                <span>{(duration * 0.25).toFixed(1)}s</span>
                <span className="text-emerald-400 font-bold">Mid: {(duration * 0.5).toFixed(1)}s</span>
                <span>{(duration * 0.75).toFixed(1)}s</span>
                <span className="text-white font-bold">{duration}s (Full)</span>
              </div>
            </div>
          </div>

        </div>

        {/* ── Modal Footer Controls ── */}
        <div className="p-4 border-t border-white/10 bg-zinc-900/90 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleToggleAudition}
            disabled={isLoadingAudio}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-mono text-xs font-bold transition-all cursor-pointer ${
              isPreviewing
                ? 'bg-amber-500 text-black shadow-[0_0_15px_rgba(245,158,11,0.4)]'
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
          >
            {isLoadingAudio && isPreviewing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isPreviewing ? (
              <Square size={14} fill="currentColor" />
            ) : (
              <Play size={14} fill="currentColor" />
            )}
            <span>{isPreviewing ? 'Stop Audition' : 'Audition Transition'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { stopAudition(); onClose(); }}
              className="px-4 py-2.5 rounded-full text-xs font-bold text-zinc-300 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 cursor-pointer"
            >
              <Check size={15} />
              <span>Save Transition</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
