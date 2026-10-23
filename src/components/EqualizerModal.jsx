import React from 'react';
import { X, Sliders, Check } from 'lucide-react';

export default function EqualizerModal({ 
  isOpen, 
  onClose, 
  enabled, 
  setEnabled, 
  preset, 
  applyPreset, 
  bands, 
  setBands 
}) {
  if (!isOpen) return null;

  const presets = ['Flat', 'Bass Booster', 'Vocal Booster', 'Electronic', 'Rock', 'Acoustic'];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg max-w-md w-full p-6 relative">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#0b1110]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#17a398] brutal-border" />
            <h3 className="text-base font-mono font-black uppercase text-[#082621]">Acoustic Spectrum Calibrator</h3>
          </div>
          <button onClick={onClose} className="brutal-btn p-1 bg-[#ede5d3] brutal-border hover:bg-[#ded2bb] text-[#0b1110]">
            <X size={18} />
          </button>
        </div>

        {/* Enable Equalizer Toggle Switch */}
        <div className="flex items-center justify-between my-4 bg-[#ede5d3] p-3 brutal-border">
          <div>
            <span className="text-xs font-mono font-black uppercase text-[#082621]">Equalizer Processing</span>
            <p className="text-[10px] text-[#082621]/70 font-sans">Active WebAudio frequency filter matrix</p>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`brutal-btn px-3 py-1 text-xs font-mono font-black uppercase brutal-border brutal-shadow-sm ${
              enabled ? 'bg-[#082621] text-[#26c4b7]' : 'bg-[#fdfbf7] text-[#082621]'
            }`}
          >
            {enabled ? 'FILTER ENGAGED' : 'BYPASSED'}
          </button>
        </div>

        {/* Preset Profiles Grid */}
        <div className="mb-5">
          <label className="text-[10px] uppercase font-mono font-black tracking-wider text-[#082621] block mb-1.5">
            CLINICAL FILTER PRESETS
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => applyPreset(p)}
                className={`brutal-btn py-1.5 px-2.5 text-[11px] font-mono font-bold flex items-center justify-between brutal-border transition-all ${
                  preset === p 
                    ? 'bg-[#082621] text-[#26c4b7] brutal-shadow-sm' 
                    : 'bg-[#ede5d3] text-[#082621] hover:bg-white'
                }`}
              >
                <span className="truncate">{p}</span>
                {preset === p && <Check size={12} />}
              </button>
            ))}
          </div>
        </div>

        {/* 5-Band Vertical Frequency Controls */}
        <div className="bg-[#ede5d3] p-4 brutal-border mb-5">
          <div className="flex justify-between items-end gap-2 h-40">
            {Object.entries(bands).map(([freq, val]) => (
              <div key={freq} className="flex flex-col items-center justify-between h-full flex-1">
                {/* dB Display */}
                <span className="text-[10px] font-mono font-black text-[#082621] bg-[#fdfbf7] px-1 brutal-border">
                  {val > 0 ? `+${val}` : val}dB
                </span>

                {/* Vertical Slider Track Container */}
                <div className="relative w-6 flex-1 flex items-center justify-center my-2">
                  <div className="w-2 h-full bg-[#fdfbf7] brutal-border overflow-hidden absolute inset-0 mx-auto">
                    <div 
                      className="w-full bg-[#17a398] transition-all"
                      style={{ height: `${((val + 10) / 20) * 100}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min="-10"
                    max="10"
                    step="1"
                    value={val}
                    disabled={!enabled}
                    onChange={(e) => {
                      const newVal = Number(e.target.value);
                      setBands({ ...bands, [freq]: newVal });
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>

                {/* Frequency Label */}
                <span className="text-[9px] font-mono font-black uppercase text-[#082621]">
                  {freq}
                </span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="brutal-btn w-full py-2.5 bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] font-mono text-xs font-black uppercase brutal-border brutal-shadow cursor-pointer"
        >
          CONFIRM FREQUENCY PROFILE
        </button>
      </div>
    </div>
  );
}
