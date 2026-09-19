import React from 'react';
import { X, Settings, ShieldCheck, Check } from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  audioQuality,
  setAudioQuality,
  crossfade,
  setCrossfade,
  isOfflineMode,
  setIsOfflineMode
}) {
  if (!isOpen) return null;

  const qualities = [
    { label: 'Lossless Master (320 kbps Studio)', value: '320' },
    { label: 'High Fidelity (256 kbps Balanced)', value: '256' },
    { label: 'Standard Quality (160 kbps Data-Saver)', value: '160' },
    { label: 'Automatic (Adaptive Network)', value: 'auto' }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg max-w-md w-full p-6 relative">
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#0b1110]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#17a398] brutal-border" />
            <h3 className="text-base font-mono font-black uppercase text-[#082621]">Audio & App Settings</h3>
          </div>
          <button onClick={onClose} className="brutal-btn p-1 bg-[#ede5d3] brutal-border hover:bg-[#ded2bb] text-[#0b1110]">
            <X size={18} />
          </button>
        </div>

        {/* Quality Guarantee Badge */}
        <div className="my-4 bg-[#082621] text-[#fdfbf7] p-4 brutal-border brutal-shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#26c4b7] text-[#082621] brutal-border flex items-center justify-center font-mono font-black text-sm">
              R
            </div>
            <div>
              <h4 className="font-mono font-black uppercase text-sm text-[#26c4b7]">Rivo Hi-Fi Audio</h4>
              <p className="text-[11px] text-[#ded2bb]">Unlimited Streaming • 24-Bit Acoustic Fidelity • Zero Loss</p>
            </div>
          </div>
        </div>

        {/* Offline Mode Toggle */}
        <div className="flex items-center justify-between py-3 border-b-2 border-[#0b1110]">
          <div>
            <span className="text-xs font-mono font-black uppercase text-[#082621]">Offline Storage Mode</span>
            <p className="text-[11px] text-[#082621]/70">Only play downloaded offline tracks</p>
          </div>
          <button
            onClick={() => setIsOfflineMode(!isOfflineMode)}
            className={`brutal-btn px-3 py-1 text-xs font-mono font-black uppercase brutal-border brutal-shadow-sm ${
              isOfflineMode ? 'bg-[#082621] text-[#26c4b7]' : 'bg-[#ede5d3] text-[#082621]'
            }`}
          >
            {isOfflineMode ? 'ACTIVE' : 'DISABLED'}
          </button>
        </div>

        {/* Crossfade Slider */}
        <div className="py-4 border-b-2 border-[#0b1110]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono font-black uppercase text-[#082621]">Crossfade</span>
            <span className="text-xs font-mono font-bold text-[#17a398] bg-[#ede5d3] px-2 py-0.5 brutal-border">
              {crossfade} SECONDS
            </span>
          </div>
          <div className="relative w-full group h-4 flex items-center cursor-pointer">
            <div className="w-full h-2.5 rounded-full overflow-hidden brutal-border bg-[#ede5d3]">
              <div 
                className="h-full bg-[#17a398] group-hover:bg-[#26c4b7] transition-all duration-75"
                style={{ width: `${Math.min(100, Math.max(0, (crossfade / 12) * 100))}%` }}
              />
            </div>
            <div 
              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full brutal-border shadow-md pointer-events-none transition-transform group-hover:scale-125 z-10"
              style={{ left: `calc(${Math.min(100, Math.max(0, (crossfade / 12) * 100))}% - 8px)` }}
            />
            <input
              type="range"
              min="0"
              max="12"
              step="1"
              value={crossfade}
              onChange={(e) => setCrossfade(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />
          </div>
        </div>

        {/* Audio Streaming Quality */}
        <div className="py-4">
          <label className="text-[10px] font-mono font-black uppercase text-[#082621] block mb-2">
            AUDIO FIDELITY & STREAMING QUALITY
          </label>
          <div className="flex flex-col gap-1.5">
            {qualities.map((q) => (
              <button
                key={q.value}
                onClick={() => setAudioQuality(q.value)}
                className={`brutal-btn p-2.5 text-left text-xs font-mono font-bold flex items-center justify-between brutal-border ${
                  audioQuality === q.value 
                    ? 'bg-[#082621] text-[#26c4b7] brutal-shadow-sm' 
                    : 'bg-[#ede5d3] text-[#082621] hover:bg-white'
                }`}
              >
                <span>{q.label}</span>
                {audioQuality === q.value && <Check size={16} />}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="brutal-btn w-full py-2.5 bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] font-mono text-xs font-black uppercase brutal-border brutal-shadow cursor-pointer"
        >
          SAVE SETTINGS
        </button>
      </div>
    </div>
  );
}
