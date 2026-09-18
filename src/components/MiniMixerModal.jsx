import React, { useState, useEffect } from 'react';
import { 
  X, Sliders, Volume2, Wand2, Play, Check, Sparkles, Activity, Music2, 
  ArrowRight, Disc, Zap, Radio, RefreshCw, Gauge, Flame, Music, Layers, ShieldCheck
} from 'lucide-react';
import { getTrackMusicalData, checkHarmonicCompatibility, getRecommendedTransition } from '../utils/musicAnalysis';
import { useAudioPlayer } from '../context/AudioContext';

const TRANSITION_STYLES = [
  {
    id: 'equal_power',
    name: 'Equal Power Blend',
    desc: 'Smooth continuous volume blend with zero perceived volume dip',
    icon: Volume2,
    badge: 'Studio Standard',
    color: 'emerald'
  },
  {
    id: 'bass_swap',
    name: 'Bass Swap (High-Pass)',
    desc: 'Sweeps out Track A low-end so Track B kick & bass drop clean',
    icon: Activity,
    badge: 'Club DJ',
    color: 'purple'
  },
  {
    id: 'low_pass',
    name: 'Filter Sweep (Low-Pass)',
    desc: 'Muffles highs & vocals before the drop for massive buildup tension',
    icon: Sliders,
    badge: 'Festival EDM',
    color: 'amber'
  },
  {
    id: 'cut',
    name: 'Instant Cut / Downbeat',
    desc: 'Snaps cleanly directly on the downbeat with zero overlapping mush',
    icon: Music2,
    badge: 'Hip-Hop & Radio',
    color: 'rose'
  },
  {
    id: 'vinyl_brake',
    name: 'Vinyl Brake (Tape Stop)',
    desc: 'Classic turntable motor slowdown effect dropping into the new beat',
    icon: Disc,
    badge: 'Turntablist',
    color: 'cyan'
  },
  {
    id: 'echo_out',
    name: 'Echo Out (Dub Reverb)',
    desc: 'Outgoing track dissolves into an atmospheric reverb tail as Track B hits',
    icon: Radio,
    badge: 'Spacious Drop',
    color: 'indigo'
  }
];

const DJ_PRESETS = [
  {
    id: 'club_banger',
    name: 'Club Banger',
    desc: 'Bass Swap • 8s • BPM Sync • Bass Kill',
    icon: Flame,
    style: 'bass_swap',
    duration: 8,
    bassKill: true,
    autoMatchBpm: true
  },
  {
    id: 'festival_drop',
    name: 'Festival Drop',
    desc: 'Filter Sweep • 12s • High Cut',
    icon: Zap,
    style: 'low_pass',
    duration: 12,
    bassKill: false,
    highCut: true,
    autoMatchBpm: true
  },
  {
    id: 'radio_cut',
    name: 'Radio Cut',
    desc: 'Instant Snap Cut • 2s',
    icon: Music2,
    style: 'cut',
    duration: 2,
    bassKill: false,
    autoMatchBpm: false
  },
  {
    id: 'chill_lounge',
    name: 'Chill Lounge',
    desc: 'Equal Power • 16s Ambient Blend',
    icon: Sparkles,
    style: 'equal_power',
    duration: 16,
    bassKill: false,
    autoMatchBpm: true
  }
];

export default function MiniMixerModal({
  isOpen,
  onClose,
  trackA,
  trackB,
  initialTransition = null,
  onSaveTransition
}) {
  const { previewDjTransition, setIsMixMode } = useAudioPlayer();
  const [activeTab, setActiveTab] = useState('fx'); // 'fx' | 'decks' | 'harmony' | 'presets'
  const [style, setStyle] = useState(initialTransition?.style || 'equal_power');
  const [duration, setDuration] = useState(initialTransition?.duration || 8);
  const [autoMatchBpm, setAutoMatchBpm] = useState(initialTransition?.autoMatchBpm !== false);
  const [bassKill, setBassKill] = useState(Boolean(initialTransition?.bassKill));
  const [highCut, setHighCut] = useState(Boolean(initialTransition?.highCut));
  const [crossfaderPos, setCrossfaderPos] = useState(50); // 0 (Deck A) to 100 (Deck B)
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);

  const dataA = getTrackMusicalData(trackA);
  const dataB = getTrackMusicalData(trackB);
  const compatibility = checkHarmonicCompatibility(dataA.key, dataB.key, dataA.bpm, dataB.bpm);
  const recommended = getRecommendedTransition(trackA, trackB);

  const bpmDiff = Math.abs((dataA.bpm || 120) - (dataB.bpm || 120));
  const bpmPercentShift = (((dataB.bpm - dataA.bpm) / (dataA.bpm || 120)) * 100).toFixed(1);

  useEffect(() => {
    if (initialTransition) {
      setStyle(initialTransition.style || 'equal_power');
      setDuration(initialTransition.duration || 8);
      setAutoMatchBpm(initialTransition.autoMatchBpm !== false);
      setBassKill(Boolean(initialTransition.bassKill));
      setHighCut(Boolean(initialTransition.highCut));
    } else {
      setStyle(recommended.style);
      setDuration(recommended.duration);
    }
  }, [trackA?.id, trackB?.id]);

  if (!isOpen || !trackA || !trackB) return null;

  const handleApplyPreset = (preset) => {
    setStyle(preset.style);
    setDuration(preset.duration);
    setAutoMatchBpm(preset.autoMatchBpm);
    if (preset.bassKill !== undefined) setBassKill(preset.bassKill);
    if (preset.highCut !== undefined) setHighCut(preset.highCut);
  };

  const handleApplyAuto = () => {
    setStyle(recommended.style);
    setDuration(recommended.duration);
    setAutoMatchBpm(true);
  };

  const handlePreview = () => {
    if (isPreviewing) return;
    setIsPreviewing(true);
    setPreviewProgress(0);

    if (previewDjTransition) {
      previewDjTransition(trackA, trackB, { 
        style, 
        duration, 
        autoMatchBpm,
        bassKill,
        highCut
      });
    }

    const start = Date.now();
    const leadInMs = 1500;
    const transMs = duration * 1000;
    const tailMs = 1500;
    const totalMs = leadInMs + transMs + tailMs;

    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed < leadInMs) {
        setPreviewProgress(0);
        setCrossfaderPos(0);
      } else if (elapsed <= leadInMs + transMs) {
        const p = (elapsed - leadInMs) / transMs;
        setPreviewProgress(p);
        setCrossfaderPos(Math.round(p * 100));
      } else {
        setPreviewProgress(1);
        setCrossfaderPos(100);
      }

      if (elapsed >= totalMs) {
        clearInterval(interval);
        setTimeout(() => {
          setIsPreviewing(false);
          setPreviewProgress(0);
          setCrossfaderPos(50);
        }, 300);
      }
    }, 40);
  };

  const handleSave = () => {
    setIsMixMode?.(true);
    onSaveTransition({
      style,
      duration,
      autoMatchBpm,
      bassKill,
      highCut,
      keyA: dataA.key,
      keyB: dataB.key,
      bpmA: dataA.bpm,
      bpmB: dataB.bpm
    });
    onClose();
  };

  // SVG envelope preview calculation for all 6 styles
  const curvePointsA = [];
  const curvePointsB = [];
  for (let i = 0; i <= 20; i++) {
    const x = i * 15;
    const p = i / 20;
    let gA, gB;
    if (style === 'equal_power') {
      gA = Math.cos(p * Math.PI / 2);
      gB = Math.sin(p * Math.PI / 2);
    } else if (style === 'cut') {
      gA = p < 0.85 ? 1 : 0;
      gB = p >= 0.85 ? 1 : 0;
    } else if (style === 'bass_swap') {
      gA = p < 0.45 ? 1 - 0.15 * Math.pow(p / 0.45, 2) : 0.85 * Math.pow((1 - p) / 0.55, 3);
      gB = p < 0.45 ? 0.35 * Math.pow(p / 0.45, 1.8) : 0.35 + 0.65 * Math.pow((p - 0.45) / 0.55, 0.6);
    } else if (style === 'low_pass') {
      gA = Math.pow(1 - p, 2.5);
      gB = Math.pow(p, 1.8);
    } else if (style === 'vinyl_brake') {
      gA = p < 0.6 ? 1.0 : Math.max(0, 1 - Math.pow((p - 0.6) / 0.4, 2));
      gB = p < 0.7 ? 0 : Math.min(1, Math.pow((p - 0.7) / 0.3, 0.7));
    } else if (style === 'echo_out') {
      gA = Math.pow(1 - p, 1.6) * (0.8 + 0.2 * Math.sin(p * Math.PI * 6));
      gB = Math.pow(p, 1.4);
    } else {
      gA = 1 - p;
      gB = p;
    }
    const yA = 60 - Math.max(0, Math.min(1, gA)) * 50;
    const yB = 60 - Math.max(0, Math.min(1, gB)) * 50;
    curvePointsA.push(`${x},${yA.toFixed(1)}`);
    curvePointsB.push(`${x},${yB.toFixed(1)}`);
  }

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4 select-none">
      
      {/* Modal Card Shell: Mobile Bottom Sheet + Desktop Modal */}
      <div className="bg-[#121212] border border-zinc-800 rounded-t-[28px] sm:rounded-3xl w-full sm:max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[94vh] sm:max-h-[88vh] relative animate-in slide-in-from-bottom-5 sm:zoom-in-95 duration-200">
        
        {/* Mobile Drag Indicator */}
        <div className="w-12 h-1 bg-zinc-700 rounded-full mx-auto mt-2.5 mb-1 sm:hidden shrink-0" />

        {/* ── Header ── */}
        <div className="p-4 sm:p-5 border-b border-zinc-800 flex items-center justify-between bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-[#121212] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1DB954] to-emerald-700 flex items-center justify-center text-black shadow-lg shrink-0">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                Spotify DJ Mix
                <span className="text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Smart Transition
                </span>
              </h3>
              <p className="text-[11px] text-zinc-400 truncate">Seamless beat & harmonic mix between songs</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Dual DJ Decks (Responsive Card Layout) ── */}
        <div className="p-3 sm:p-4 bg-zinc-900/60 border-b border-zinc-800 flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
          {/* Deck A (Outgoing) */}
          <div className="flex-1 w-full flex items-center gap-3 p-2.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 relative overflow-hidden">
            <div className="relative shrink-0">
              <img src={trackA.cover} alt={trackA.title} className="w-12 h-12 rounded-xl object-cover" />
              {/* Spinning Vinyl Badge */}
              <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-black border border-zinc-700 flex items-center justify-center ${isPreviewing && previewProgress < 0.85 ? 'animate-spin' : ''}`}>
                <Disc size={12} className="text-[#1DB954]" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-red-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block animate-pulse" /> Deck A (Outgoing)
              </span>
              <h4 className="text-xs font-bold text-white truncate">{trackA.title}</h4>
              <p className="text-[10px] text-zinc-400 truncate">{trackA.artist}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-extrabold text-[#1DB954]">{dataA.bpm} BPM</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-emerald-400 font-bold border border-emerald-500/20">
                  {dataA.key}
                </span>
              </div>
            </div>
          </div>

          {/* Center Connector Indicator */}
          <div className="flex items-center justify-center shrink-0">
            <div className="w-7 h-7 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 shadow-md">
              <ArrowRight size={14} />
            </div>
          </div>

          {/* Deck B (Incoming) */}
          <div className="flex-1 w-full flex items-center gap-3 p-2.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 relative overflow-hidden">
            <div className="relative shrink-0">
              <img src={trackB.cover} alt={trackB.title} className="w-12 h-12 rounded-xl object-cover" />
              {/* Spinning Vinyl Badge */}
              <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-black border border-zinc-700 flex items-center justify-center ${isPreviewing && previewProgress > 0.15 ? 'animate-spin' : ''}`}>
                <Disc size={12} className="text-emerald-400" />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#1DB954] inline-block animate-pulse" /> Deck B (Incoming)
              </span>
              <h4 className="text-xs font-bold text-white truncate">{trackB.title}</h4>
              <p className="text-[10px] text-zinc-400 truncate">{trackB.artist}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-extrabold text-[#1DB954]">{dataB.bpm} BPM</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-emerald-400 font-bold border border-emerald-500/20">
                  {dataB.key}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Segmented Navigation Tabs ── */}
        <div className="px-3 pt-2 bg-zinc-950/80 border-b border-zinc-800 flex items-center gap-1 overflow-x-auto scrollbar-none shrink-0">
          <button
            onClick={() => setActiveTab('fx')}
            className={`px-3 py-2 text-xs font-extrabold rounded-t-xl border-b-2 transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'fx'
                ? 'border-[#1DB954] text-white bg-white/5'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Sliders size={13} className={activeTab === 'fx' ? 'text-[#1DB954]' : ''} />
            <span>Transition FX & Overlap</span>
          </button>

          <button
            onClick={() => setActiveTab('decks')}
            className={`px-3 py-2 text-xs font-extrabold rounded-t-xl border-b-2 transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'decks'
                ? 'border-[#1DB954] text-white bg-white/5'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Disc size={13} className={activeTab === 'decks' ? 'text-[#1DB954]' : ''} />
            <span>Live Crossfader & EQ</span>
          </button>

          <button
            onClick={() => setActiveTab('harmony')}
            className={`px-3 py-2 text-xs font-extrabold rounded-t-xl border-b-2 transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'harmony'
                ? 'border-[#1DB954] text-white bg-white/5'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Gauge size={13} className={activeTab === 'harmony' ? 'text-[#1DB954]' : ''} />
            <span>BPM & Key Harmony</span>
          </button>

          <button
            onClick={() => setActiveTab('presets')}
            className={`px-3 py-2 text-xs font-extrabold rounded-t-xl border-b-2 transition-all shrink-0 flex items-center gap-1.5 ${
              activeTab === 'presets'
                ? 'border-[#1DB954] text-white bg-white/5'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            <Sparkles size={13} className={activeTab === 'presets' ? 'text-[#1DB954]' : ''} />
            <span>DJ Presets</span>
          </button>
        </div>

        {/* ── Scrollable Body Area ── */}
        <div className="p-4 sm:p-5 space-y-5 overflow-y-auto flex-1">

          {/* TAB 1: TRANSITION FX & OVERLAP */}
          {activeTab === 'fx' && (
            <div className="space-y-5">
              {/* 6 Pro Transition FX Cards */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5">
                  Select DJ Transition Style
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {TRANSITION_STYLES.map((st) => {
                    const Icon = st.icon;
                    const isSelected = style === st.id;
                    return (
                      <button
                        key={st.id}
                        onClick={() => setStyle(st.id)}
                        className={`p-3 rounded-2xl text-left border transition-all flex items-start gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-500/10 border-[#1DB954] shadow-md shadow-[#1DB954]/10'
                            : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className={`p-2 rounded-xl shrink-0 ${isSelected ? 'bg-[#1DB954] text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white truncate">{st.name}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-white/5 text-zinc-400 shrink-0">
                              {st.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-1 leading-snug line-clamp-2">{st.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Transition Overlap Duration Slider */}
              <div className="p-3.5 bg-zinc-900/40 rounded-2xl border border-zinc-800/80">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Transition Overlap Length
                  </label>
                  <span className="text-sm font-extrabold text-[#1DB954]">{duration}s</span>
                </div>

                <div className="relative flex items-center h-7 group my-1">
                  {/* Visible Track Background */}
                  <div className="w-full h-2 rounded-full bg-zinc-800 border border-zinc-700/80 overflow-hidden relative shadow-inner">
                    {/* Spotify Green Active Fill */}
                    <div 
                      className="h-full bg-gradient-to-r from-emerald-500 to-[#1DB954] rounded-full transition-all duration-75"
                      style={{ width: `${((duration - 2) / (16 - 2)) * 100}%` }}
                    />
                  </div>

                  {/* Range Input for dragging */}
                  <input
                    type="range"
                    min="2"
                    max="16"
                    step="1"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  />

                  {/* Crisp White Thumb */}
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg shadow-black/80 pointer-events-none transition-transform duration-75 group-hover:scale-125 z-10 border border-zinc-300"
                    style={{ left: `calc(${((duration - 2) / (16 - 2)) * 100}% - 8px)` }}
                  />
                </div>

                <div className="flex justify-between text-[10px] text-zinc-500 font-bold mt-1">
                  <span className={duration <= 4 ? 'text-white' : ''}>Quick (2s)</span>
                  <span className={duration >= 6 && duration <= 10 ? 'text-[#1DB954]' : ''}>Standard (8s)</span>
                  <span className={duration >= 14 ? 'text-white' : ''}>Long Mix (16s)</span>
                </div>
              </div>

              {/* Envelope Graphic Preview with Animated Cursor */}
              <div className="p-3.5 bg-zinc-950 rounded-2xl border border-zinc-800/80">
                <div className="flex items-center justify-between mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  <span className="flex items-center gap-1 text-red-400">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    Track A Fade-Out
                  </span>
                  <span className="flex items-center gap-1 text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-[#1DB954] inline-block" />
                    Track B Fade-In
                  </span>
                </div>
                <div className="relative h-16 w-full flex items-center justify-center overflow-hidden bg-zinc-900/30 rounded-xl">
                  <svg viewBox="0 0 300 70" className="w-full h-full">
                    {/* Track A line */}
                    <polyline
                      fill="none"
                      stroke="#EF4444"
                      strokeWidth="2.5"
                      points={curvePointsA.join(' ')}
                    />
                    {/* Track B line */}
                    <polyline
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="2.5"
                      points={curvePointsB.join(' ')}
                    />
                    {/* Realtime playback cursor indicator */}
                    {isPreviewing && (
                      <line
                        x1={previewProgress * 300}
                        y1="0"
                        x2={previewProgress * 300}
                        y2="70"
                        stroke="#FFFFFF"
                        strokeWidth="2.5"
                        strokeDasharray="2 2"
                      />
                    )}
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIVE CROSSFADER & DJ EQ */}
          {activeTab === 'decks' && (
            <div className="space-y-5">
              {/* Interactive Live Crossfader Slider */}
              <div className="p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-zinc-400">Interactive DJ Crossfader</span>
                  <span className="text-xs font-extrabold text-[#1DB954]">
                    {crossfaderPos < 45 ? 'Deck A (Outgoing)' : crossfaderPos > 55 ? 'Deck B (Incoming)' : 'Center Blend (50/50)'}
                  </span>
                </div>

                <div className="relative flex items-center h-10 group">
                  <div className="w-full h-3 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden relative flex">
                    <div className="h-full bg-red-500/80 transition-all" style={{ width: `${100 - crossfaderPos}%` }} />
                    <div className="h-full bg-emerald-500/80 transition-all" style={{ width: `${crossfaderPos}%` }} />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={crossfaderPos}
                    onChange={(e) => setCrossfaderPos(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                  />
                  <div 
                    className="absolute top-1/2 -translate-y-1/2 w-6 h-8 bg-zinc-200 border-2 border-zinc-900 rounded-md shadow-xl flex items-center justify-center pointer-events-none transition-transform group-hover:scale-105 z-10"
                    style={{ left: `calc(${crossfaderPos}% - 12px)` }}
                  >
                    <div className="w-0.5 h-4 bg-zinc-600 rounded-full" />
                  </div>
                </div>

                <div className="flex justify-between text-[11px] font-black">
                  <span className="text-red-400">Deck A (100%)</span>
                  <button 
                    onClick={() => setCrossfaderPos(50)}
                    className="text-[10px] font-bold text-zinc-400 hover:text-white px-2 py-0.5 rounded bg-zinc-800"
                  >
                    Center Lock
                  </button>
                  <span className="text-emerald-400">Deck B (100%)</span>
                </div>
              </div>

              {/* EQ Isolator & Kill Switches */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-white">Deck A Bass Kill</h5>
                    <p className="text-[10px] text-zinc-400">Cuts low frequencies below 200Hz</p>
                  </div>
                  <button
                    onClick={() => setBassKill(!bassKill)}
                    className={`px-3 py-1.5 rounded-full text-xs font-black transition-all ${
                      bassKill ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {bassKill ? 'ACTIVE (-∞dB)' : 'OFF'}
                  </button>
                </div>

                <div className="p-3.5 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-white">Deck B High Filter</h5>
                    <p className="text-[10px] text-zinc-400">Sweeps highs smoothly into the drop</p>
                  </div>
                  <button
                    onClick={() => setHighCut(!highCut)}
                    className={`px-3 py-1.5 rounded-full text-xs font-black transition-all ${
                      highCut ? 'bg-[#1DB954] text-black shadow-lg shadow-emerald-500/20' : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {highCut ? 'ACTIVE' : 'OFF'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BPM & HARMONIC WHEEL */}
          {activeTab === 'harmony' && (
            <div className="space-y-4">
              {/* Camelot Wheel Harmonic Card */}
              <div className="p-4 bg-zinc-900/60 rounded-2xl border border-zinc-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-zinc-400">Camelot Wheel Harmony</span>
                  <span className="text-xs font-bold text-emerald-400">{compatibility.badge}</span>
                </div>

                <div className="flex items-center justify-around py-3 bg-zinc-950/80 rounded-xl border border-zinc-800">
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-zinc-500 block mb-0.5">Track A Key</span>
                    <span className="text-base font-black text-emerald-400 font-mono px-3 py-1 rounded-lg bg-emerald-950/50 border border-emerald-500/30 inline-block">
                      {dataA.key}
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-1">{dataA.keyName}</span>
                  </div>

                  <div className="text-center px-2">
                    <span className="text-xs font-extrabold text-zinc-400">➔</span>
                  </div>

                  <div className="text-center">
                    <span className="text-[10px] font-bold text-zinc-500 block mb-0.5">Track B Key</span>
                    <span className="text-base font-black text-emerald-400 font-mono px-3 py-1 rounded-lg bg-emerald-950/50 border border-emerald-500/30 inline-block">
                      {dataB.key}
                    </span>
                    <span className="text-[10px] text-zinc-400 block mt-1">{dataB.keyName}</span>
                  </div>
                </div>

                <p className="text-xs text-zinc-400">{compatibility.desc}</p>
              </div>

              {/* BPM Sync Engine */}
              <div className="p-4 bg-zinc-900/60 rounded-2xl border border-zinc-800 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="text-xs font-bold text-white">Auto Beat Sync & BPM Lock</h5>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      {bpmDiff === 0 ? 'Exact Match' : `${bpmDiff} BPM Diff (${bpmPercentShift}%)`}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Locks Deck B tempo to Deck A for an aligned downbeat drop</p>
                </div>
                <button
                  onClick={() => setAutoMatchBpm(!autoMatchBpm)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-black transition-all ${
                    autoMatchBpm ? 'bg-[#1DB954] text-black' : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {autoMatchBpm ? 'SYNCED' : 'MANUAL'}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: DJ PRESETS */}
          {activeTab === 'presets' && (
            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                1-Tap Pro DJ Profiles
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {DJ_PRESETS.map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset)}
                      className="p-3.5 rounded-2xl bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 hover:border-emerald-500/50 text-left transition-all group flex items-start gap-3 cursor-pointer shadow-sm"
                    >
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 text-[#1DB954] group-hover:bg-[#1DB954] group-hover:text-black transition-colors shrink-0">
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-extrabold text-white group-hover:text-emerald-300">{preset.name}</h4>
                        <p className="text-[11px] text-zinc-400 mt-0.5">{preset.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </div>

        {/* ── Footer Action Buttons ── */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800 flex items-center justify-between gap-3 shrink-0">
          <button
            onClick={handlePreview}
            disabled={isPreviewing}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold transition-all shrink-0 ${
              isPreviewing
                ? 'bg-zinc-800 text-zinc-400 cursor-wait'
                : 'bg-zinc-800 hover:bg-zinc-700 text-white cursor-pointer'
            }`}
          >
            <Play size={13} fill="currentColor" />
            <span>{isPreviewing ? `Auditioning ${Math.round(previewProgress * 100)}%...` : 'Simulate Transition'}</span>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onClose}
              className="px-3.5 py-2.5 rounded-full text-xs font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-5 sm:px-6 py-2.5 rounded-full text-xs font-extrabold bg-[#1DB954] hover:bg-[#1ed760] text-black hover:scale-105 active:scale-95 transition-all shadow-lg cursor-pointer"
            >
              <Check size={14} />
              <span>Save Mix</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
