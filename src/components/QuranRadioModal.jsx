import React from 'react';
import { 
  X, Radio, Play, Pause, Volume2, Sparkles, 
  ExternalLink, Disc, CheckCircle2 
} from 'lucide-react';
import { QURAN_LIVE_STATIONS } from '../data/quranLiveStations';
import { useAudioPlayer } from '../context/AudioContext';

export default function QuranRadioModal({ isOpen, onClose, globalTheme = 'dark' }) {
  const { currentTrack, isPlaying, playTrack, togglePlay } = useAudioPlayer();

  if (!isOpen) return null;

  const handlePlayStation = (station) => {
    // If clicking current playing station, toggle
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
    <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col bg-[#070c0b] border-2 border-[#c29b38]/40 shadow-[0_0_50px_rgba(194,155,56,0.15)] rounded-2xl overflow-hidden font-sans">
        
        {/* ── MODAL HEADER ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#c29b38]/30 bg-gradient-to-r from-black via-[#0a1412] to-black">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#c29b38]/15 border border-[#c29b38]/40 flex items-center justify-center text-[#d4af37] shadow-[0_0_15px_rgba(212,175,55,0.2)]">
              <Radio size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">إذاعة القرآن الكريم</h2>
                <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                  بث مباشر 24/7
                </span>
              </div>
              <p className="text-xs text-[#c29b38]/80 font-mono mt-0.5">محطات رسمية مباشرة بأعلى جودة نقاء صوتية</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── STATIONS GRID ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {QURAN_LIVE_STATIONS.map((station) => {
            const isCurrent = currentTrack?.id === station.id;
            const isCurrentPlaying = isCurrent && isPlaying;

            return (
              <div
                key={station.id}
                onClick={() => handlePlayStation(station)}
                className={`group relative flex items-center justify-between p-3.5 sm:p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                  isCurrent
                    ? 'bg-[#111f1b] border-[#c29b38] shadow-[0_0_20px_rgba(194,155,56,0.2)]'
                    : 'bg-[#0a1210] border-white/5 hover:border-[#c29b38]/40 hover:bg-[#0e1b17]'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {/* Station Artwork */}
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 border border-white/10">
                    <img 
                      src={station.cover} 
                      alt={station.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                    {isCurrentPlaying && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#d4af37] animate-ping" />
                      </div>
                    )}
                  </div>

                  {/* Station Info */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`text-sm sm:text-base font-bold truncate ${isCurrent ? 'text-[#d4af37]' : 'text-white'}`}>
                        {station.title}
                      </h4>
                      {isCurrent && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#c29b38]/20 text-[#d4af37] border border-[#c29b38]/30 shrink-0">
                          قيد التشغيل
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{station.artist}</p>
                    <p className="text-[11px] text-zinc-500 truncate mt-0.5 hidden sm:block">{station.description}</p>
                  </div>
                </div>

                {/* Play / Pause Action Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayStation(station);
                  }}
                  className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer shadow-md ${
                    isCurrentPlaying
                      ? 'bg-[#d4af37] text-black shadow-[0_0_15px_rgba(212,175,55,0.4)]'
                      : 'bg-white/10 hover:bg-[#d4af37] text-white hover:text-black border border-white/15'
                  }`}
                >
                  {isCurrentPlaying ? <Pause size={18} /> : <Play size={18} className="translate-x-0.5" />}
                </button>
              </div>
            );
          })}
        </div>

        {/* ── MODAL FOOTER ── */}
        <div className="px-5 py-3 border-t border-[#c29b38]/20 bg-black/60 flex items-center justify-between text-xs font-mono text-zinc-400">
          <div className="flex items-center gap-1.5 text-[#c29b38]">
            <Sparkles size={13} />
            <span>بث غير منقطع • يعمل في الخلفية</span>
          </div>
          <span className="text-zinc-500">مزامنة مع مشغل ريفو</span>
        </div>

      </div>
    </div>
  );
}
