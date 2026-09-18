import React, { useState, useEffect } from 'react';
import { X, Sliders, Volume2, Wand2, Play, Check, Sparkles, Activity, Music2, ArrowRight } from 'lucide-react';
import { getTrackMusicalData, checkHarmonicCompatibility, getRecommendedTransition } from '../utils/musicAnalysis';
import { useAudioPlayer } from '../context/AudioContext';

const TRANSITION_STYLES = [
  {
    id: 'equal_power',
    name: 'Equal Power Crossfade',
    desc: 'Smooth volume blend without perceived volume drop',
    icon: Volume2,
    badge: 'Standard'
  },
  {
    id: 'bass_swap',
    name: 'Bass Swap (High-Pass)',
    desc: 'Sweeps out track A bass so track B kick drops clean',
    icon: Activity,
    badge: 'Club DJ'
  },
  {
    id: 'low_pass',
    name: 'Filter Sweep (Low-Pass)',
    desc: 'Removes highs & vocals before drop for massive impact',
    icon: Sliders,
    badge: 'Festival'
  },
  {
    id: 'cut',
    name: 'Instant Cut / Drop',
    desc: 'Instant beat transition directly on the downbeat',
    icon: Music2,
    badge: 'Fast'
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
  const [style, setStyle] = useState(initialTransition?.style || 'equal_power');
  const [duration, setDuration] = useState(initialTransition?.duration || 8);
  const [autoMatchBpm, setAutoMatchBpm] = useState(initialTransition?.autoMatchBpm !== false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewProgress, setPreviewProgress] = useState(0);

  const dataA = getTrackMusicalData(trackA);
  const dataB = getTrackMusicalData(trackB);
  const compatibility = checkHarmonicCompatibility(dataA.key, dataB.key, dataA.bpm, dataB.bpm);
  const recommended = getRecommendedTransition(trackA, trackB);

  useEffect(() => {
    if (initialTransition) {
      setStyle(initialTransition.style || 'equal_power');
      setDuration(initialTransition.duration || 8);
      setAutoMatchBpm(initialTransition.autoMatchBpm !== false);
    } else {
      setStyle(recommended.style);
      setDuration(recommended.duration);
    }
  }, [trackA?.id, trackB?.id]);

  if (!isOpen || !trackA || !trackB) return null;

  const handleApplyAuto = () => {
    setStyle(recommended.style);
    setDuration(recommended.duration);
    setAutoMatchBpm(true);
  };

  const handlePreview = () => {
    if (isPreviewing) return;
    setIsPreviewing(true);
    setPreviewProgress(0);

    // Play actual audio transition through AudioContext!
    if (previewDjTransition) {
      previewDjTransition(trackA, trackB, { style, duration, autoMatchBpm });
    }

    const start = Date.now();
    const totalMs = (duration + 3) * 1000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const prog = Math.min(1, elapsed / totalMs);
      setPreviewProgress(prog);
      if (prog >= 1) {
        clearInterval(interval);
        setTimeout(() => {
          setIsPreviewing(false);
          setPreviewProgress(0);
        }, 500);
      }
    }, 50);
  };

  const handleSave = () => {
    setIsMixMode?.(true);
    onSaveTransition({
      style,
      duration,
      autoMatchBpm,
      keyA: dataA.key,
      keyB: dataB.key,
      bpmA: dataA.bpm,
      bpmB: dataB.bpm
    });
    onClose();
  };

  // SVG envelope preview calculation
  const curvePointsA = [];
  const curvePointsB = [];
  for (let i = 0; i <= 20; i++) {
    const x = i * 15;
    const p = i / 20;
    let yA, yB;
    if (style === 'equal_power') {
      yA = 60 - Math.cos(p * Math.PI / 2) * 50;
      yB = 60 - Math.sin(p * Math.PI / 2) * 50;
    } else if (style === 'linear') {
      yA = 60 - (1 - p) * 50;
      yB = 60 - p * 50;
    } else if (style === 'cut') {
      yA = p < 0.5 ? 10 : 60;
      yB = p >= 0.5 ? 10 : 60;
    } else {
      // Filter sweep
      yA = 60 - Math.pow(1 - p, 1.8) * 50;
      yB = 60 - Math.pow(p, 1.8) * 50;
    }
    curvePointsA.push(`${x},${yA}`);
    curvePointsB.push(`${x},${yB}`);
  }

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-[#121212] border border-zinc-800 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-[#121212]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1DB954] to-emerald-700 flex items-center justify-center text-black shadow-lg">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                Spotify Mix • Mini-Mixer
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  DJ Transition
                </span>
              </h3>
              <p className="text-xs text-zinc-400">Custom seamless transition between tracks</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-full hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Track Compare Deck Header */}
        <div className="p-4 bg-zinc-900/60 border-b border-zinc-800 grid grid-cols-11 items-center gap-2">
          {/* Deck A */}
          <div className="col-span-5 flex items-center gap-2.5 p-2 rounded-xl bg-zinc-900/90 border border-zinc-800/80">
            <img src={trackA.cover} alt={trackA.title} className="w-11 h-11 rounded-lg object-cover shrink-0" />
            <div className="truncate">
              <span className="text-[9px] font-black uppercase text-zinc-500">Outgoing (Track A)</span>
              <h4 className="text-xs font-bold text-white truncate">{trackA.title}</h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-bold text-[#1DB954]">{dataA.bpm} BPM</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-emerald-400 font-bold">
                  {dataA.key}
                </span>
              </div>
            </div>
          </div>

          {/* Transition Icon */}
          <div className="col-span-1 flex justify-center">
            <ArrowRight size={16} className="text-zinc-500" />
          </div>

          {/* Deck B */}
          <div className="col-span-5 flex items-center gap-2.5 p-2 rounded-xl bg-zinc-900/90 border border-zinc-800/80">
            <img src={trackB.cover} alt={trackB.title} className="w-11 h-11 rounded-lg object-cover shrink-0" />
            <div className="truncate">
              <span className="text-[9px] font-black uppercase text-zinc-500">Incoming (Track B)</span>
              <h4 className="text-xs font-bold text-white truncate">{trackB.title}</h4>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-bold text-[#1DB954]">{dataB.bpm} BPM</span>
                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-emerald-400 font-bold">
                  {dataB.key}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Harmonic Compatibility Badge */}
        <div className="px-5 py-2.5 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">{compatibility.badge}</span>
            <span className="text-zinc-400 text-[11px] hidden sm:inline">• {compatibility.desc}</span>
          </div>
          <button
            onClick={handleApplyAuto}
            className="flex items-center gap-1 text-[11px] font-extrabold text-[#1DB954] hover:text-[#1ed760] transition-colors"
          >
            <Wand2 size={12} />
            <span>Auto Mix Recommendation</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[55vh]">
          
          {/* Transition Styles */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2.5">
              Transition Style & Filters
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
                        ? 'bg-emerald-500/10 border-[#1DB954] shadow-sm shadow-[#1DB954]/10'
                        : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className={`p-2 rounded-xl shrink-0 ${isSelected ? 'bg-[#1DB954] text-black' : 'bg-zinc-800 text-zinc-400'}`}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{st.name}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-white/5 text-zinc-400">
                          {st.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-1 leading-snug">{st.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Duration Slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Transition Overlap Length
              </label>
              <span className="text-sm font-extrabold text-[#1DB954]">{duration}s</span>
            </div>
            <input
              type="range"
              min="2"
              max="16"
              step="1"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#1DB954]"
            />
            <div className="flex justify-between text-[10px] text-zinc-500 font-bold mt-1">
              <span>Quick (2s)</span>
              <span>Standard (8s)</span>
              <span>Long Mix (16s)</span>
            </div>
          </div>

          {/* Envelope Graphic Preview */}
          <div className="p-3 bg-zinc-950 rounded-2xl border border-zinc-800/80">
            <div className="flex items-center justify-between mb-2 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              <span className="flex items-center gap-1 text-red-400">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                Track A Fade-Out
              </span>
              <span className="flex items-center gap-1 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-[#1DB954] inline-block"></span>
                Track B Fade-In
              </span>
            </div>
            <div className="relative h-16 w-full flex items-center justify-center overflow-hidden">
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
                    strokeWidth="2"
                    strokeDasharray="2 2"
                  />
                )}
              </svg>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-zinc-950 border-t border-zinc-800/80 flex items-center justify-between gap-3">
          <button
            onClick={handlePreview}
            disabled={isPreviewing}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold transition-all ${
              isPreviewing
                ? 'bg-zinc-800 text-zinc-400 cursor-wait'
                : 'bg-zinc-800 hover:bg-zinc-700 text-white cursor-pointer'
            }`}
          >
            <Play size={14} fill="currentColor" />
            <span>{isPreviewing ? `Simulating ${Math.round(previewProgress * 100)}%...` : 'Simulate Transition'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-full text-xs font-bold text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-full text-xs font-extrabold bg-[#1DB954] hover:bg-[#1ed760] text-black hover:scale-105 active:scale-95 transition-all shadow-lg"
            >
              <Check size={14} />
              <span>Save Transition</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
