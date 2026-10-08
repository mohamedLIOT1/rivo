import React from 'react';
import { X, Moon, Clock } from 'lucide-react';

export default function SleepTimerModal({ isOpen, onClose, activeTimer, setSleepTimer }) {
  if (!isOpen) return null;

  const options = [
    { label: 'Off / Continuous Dispense', minutes: 0 },
    { label: '5 Minutes Acoustic Dose', minutes: 5 },
    { label: '15 Minutes Acoustic Dose', minutes: 15 },
    { label: '30 Minutes Acoustic Dose', minutes: 30 },
    { label: '45 Minutes Acoustic Dose', minutes: 45 },
    { label: '1 Hour Acoustic Session', minutes: 60 },
    { label: 'End of Current Cassette Track', minutes: -1 }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg max-w-sm w-full p-6 relative">
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#0b1110]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#17a398] brutal-border" />
            <h3 className="text-base font-mono font-black uppercase text-[#082621]">Automatic Dose Shutoff</h3>
          </div>
          <button onClick={onClose} className="brutal-btn p-1 bg-[#ede5d3] brutal-border hover:bg-[#ded2bb] text-[#0b1110]">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-[#082621]/70 font-sans my-3">
          Cease audio frequency transmission automatically upon session timer expiry.
        </p>

        <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
          {options.map((opt) => {
            const isSelected = activeTimer === opt.minutes;
            return (
              <button
                key={opt.label}
                onClick={() => {
                  setSleepTimer(opt.minutes);
                  onClose();
                }}
                className={`brutal-btn p-2.5 text-left text-xs font-mono font-black uppercase flex items-center justify-between brutal-border transition-all ${
                  isSelected 
                    ? 'bg-[#082621] text-[#26c4b7] brutal-shadow-sm' 
                    : 'bg-[#ede5d3] text-[#082621] hover:bg-white'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Clock size={15} />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
