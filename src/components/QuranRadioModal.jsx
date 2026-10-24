import React from 'react';
import { 
  X, Radio, Play, Pause, Volume2, Sparkles, 
  Disc, CheckCircle2, Waves, RadioTower
} from 'lucide-react';
import { QURAN_LIVE_STATIONS } from '../data/quranLiveStations';
import { useAudioPlayer } from '../context/AudioContext';

export default function QuranRadioModal({ isOpen, onClose, globalTheme = 'dark' }) {
  const { currentTrack, isPlaying, playTrack, togglePlay } = useAudioPlayer();

  if (!isOpen) return null;

  const handlePlayStation = (station) => {
    // If clicking current playing station, toggle play/pause
    if (currentTrack?.id === station.id) {
      togglePlay();
      return;
    }
    // Play with live flags
    playTrack({
      ...station,
      isLive: true,
      isRadio: true,
      isQuran: true,
      duration: Infinity
    });
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#070e0c] border border-emerald-500/30 shadow-[0_0_60px_rgba(16,185,129,0.18)] rounded-2xl overflow-hidden font-sans">
        
        {/* ── RETRO HI-FI DECK HEADER ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-500/25 bg-gradient-to-r from-[#040f0c] via-[#091f1a] to-[#040f0c]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <Radio size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-white tracking-wide font-display">
                  Holy Quran Radio • Live 24/7
                </h2>
                <span className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/40 text-red-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                  LIVE
                </span>
              </div>
              <p className="text-xs text-emerald-300/80 font-mono mt-0.5">
                RIVO RETRO STEREO DECK // Official 24/7 Live Broadcasts
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-700/40 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── STATIONS LIST ── */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-2.5">
          {QURAN_LIVE_STATIONS.map((station) => {
            const isCurrent = currentTrack?.id === station.id;
            const isCurrentPlaying = isCurrent && isPlaying;

            return (
              <div
                key={station.id}
                onClick={() => handlePlayStation(station)}
                className={`group relative flex items-center justify-between p-3 sm:p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                  isCurrent
                    ? 'bg-[#0f2e26] border-emerald-400/90 shadow-[0_0_25px_rgba(16,185,129,0.25)]'
                    : 'bg-[#091512] border-emerald-950/70 hover:border-emerald-500/40 hover:bg-[#0c1c18]'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Station Cover Artwork */}
                  <div className="relative w-13 h-13 sm:w-14 sm:h-14 rounded-lg overflow-hidden shrink-0 border border-emerald-900/60 bg-black/40">
                    <img 
                      src={station.cover} 
                      alt={station.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                    {isCurrentPlaying ? (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-0.5">
                        <span className="w-1 h-3 bg-emerald-400 animate-pulse rounded-full" />
                        <span className="w-1 h-5 bg-emerald-300 animate-pulse delay-75 rounded-full" />
                        <span className="w-1 h-2 bg-emerald-400 animate-pulse delay-150 rounded-full" />
                      </div>
                    ) : isCurrent ? (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      </div>
                    ) : null}
                  </div>

                  {/* Station Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`text-sm sm:text-base font-bold truncate ${isCurrent ? 'text-emerald-300' : 'text-white'}`}>
                        {station.title}
                      </h4>
                      {isCurrent && (
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                          {isCurrentPlaying ? 'PLAYING NOW' : 'PAUSED'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-emerald-200/70 truncate mt-0.5 font-medium">{station.artist}</p>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5 hidden sm:block">{station.description}</p>
                  </div>
                </div>

                {/* Play / Pause Action Button */}
                <div className="flex items-center gap-3 shrink-0 mr-1 sm:mr-2">
                  <span className="hidden md:inline-block text-[10px] font-mono text-emerald-400/80 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/60">
                    HI-FI 24/7
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayStation(station);
                    }}
                    className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-md ${
                      isCurrentPlaying
                        ? 'bg-emerald-400 text-black shadow-[0_0_20px_rgba(16,185,129,0.5)] scale-105'
                        : 'bg-emerald-950/60 hover:bg-emerald-500 text-emerald-300 hover:text-black border border-emerald-500/40'
                    }`}
                  >
                    {isCurrentPlaying ? <Pause size={17} /> : <Play size={17} className="translate-x-0.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── FOOTER STATUS BAR ── */}
        <div className="px-5 py-2.5 border-t border-emerald-500/20 bg-[#040c0a] flex items-center justify-between text-[11px] text-emerald-400/70 font-mono">
          <div className="flex items-center gap-2">
            <RadioTower size={14} className="text-emerald-400" />
            <span>Uninterrupted Broadcast • Auto-synced with Rivo Player</span>
          </div>
          <span className="hidden sm:inline">RIVO STEREO RECEIVER 24/7</span>
        </div>
      </div>
    </div>
  );
}
