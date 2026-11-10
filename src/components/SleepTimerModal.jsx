import React from 'react';
import { X, Moon, Clock, Ban } from 'lucide-react';
import { useSleepTimer } from '../context/SleepTimerContext';
import { useUI } from '../context/UIContext';

export default function SleepTimerModal({ isOpen, onClose, activeTimer, setSleepTimer }) {
  const contextTimer = useSleepTimer();
  const { globalTheme } = useUI();
  const isDark = globalTheme === 'dark';

  if (!isOpen) return null;

  const startTimer = setSleepTimer || contextTimer?.startSleepTimer;
  const cancelTimer = contextTimer?.cancelSleepTimer;
  const remaining = contextTimer?.sleepTimerRemaining;
  const mode = contextTimer?.sleepTimerMode || (activeTimer ? 'minutes' : 'off');
  const isActive = mode !== 'off' || remaining !== null;

  const formatRemaining = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const options = [
    { label: '5 Minutes Acoustic Dose', minutes: 5 },
    { label: '15 Minutes Acoustic Dose', minutes: 15 },
    { label: '30 Minutes Acoustic Dose', minutes: 30 },
    { label: '45 Minutes Acoustic Dose', minutes: 45 },
    { label: '1 Hour Acoustic Session', minutes: 60 },
    { label: 'End of Current Track', minutes: 'end_of_track' }
  ];

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className={`brutal-border-thick brutal-shadow-lg max-w-sm w-full p-6 relative transition-colors ${
        isDark ? 'bg-[#0e1715] text-[#fdfbf7] border-[#263330]' : 'bg-[#fdfbf7] text-[#082621] border-[#0b1110]'
      }`}>
        <div className={`flex items-center justify-between pb-3 border-b-2 ${
          isDark ? 'border-[#263330]' : 'border-[#0b1110]'
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#17a398] brutal-border" />
            <h3 className={`text-base font-mono font-black uppercase ${
              isDark ? 'text-white' : 'text-[#082621]'
            }`}>Automatic Dose Shutoff</h3>
          </div>
          <button
            onClick={onClose}
            className={`brutal-btn p-1 brutal-border transition-colors ${
              isDark ? 'bg-[#141d1b] text-white hover:bg-[#1f2d29] border-[#263330]' : 'bg-[#ede5d3] text-[#0b1110] hover:bg-[#ded2bb] border-[#0b1110]'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        <p className={`text-xs font-sans my-3 ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
          Cease audio frequency transmission automatically upon session timer expiry.
        </p>

        {isActive && (
          <div className={`mb-3 p-3 text-white brutal-border flex items-center justify-between ${
            isDark ? 'bg-[#141d1b] border-[#263330]' : 'bg-[#082621] border-[#0b1110]'
          }`}>
            <div>
              <div className="text-[10px] font-mono uppercase text-[#26c4b7] font-bold">Timer Active</div>
              <div className="text-sm font-mono font-black text-white">
                {mode === 'end_of_track' ? 'Stopping at end of track' : `Auto-stop in ${formatRemaining(remaining || 0)}`}
              </div>
            </div>
            <button
              onClick={() => {
                if (cancelTimer) cancelTimer();
                else if (setSleepTimer) setSleepTimer(0);
                onClose();
              }}
              className="brutal-btn px-2 py-1 bg-[#ff4a4a] text-white brutal-border text-xs font-mono font-bold flex items-center gap-1"
            >
              <Ban size={13} />
              <span>CANCEL</span>
            </button>
          </div>
        )}

        <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
          {options.map((opt) => {
            const isSelected = mode === 'end_of_track' ? opt.minutes === 'end_of_track' : activeTimer === opt.minutes;
            return (
              <button
                key={opt.label}
                onClick={() => {
                  if (startTimer) startTimer(opt.minutes);
                  onClose();
                }}
                className={`brutal-btn p-2.5 text-left text-xs font-mono font-black uppercase flex items-center justify-between brutal-border transition-all ${
                  isSelected 
                    ? (isDark ? 'bg-[#17a398] text-[#082621] brutal-shadow-sm border-[#17a398]' : 'bg-[#082621] text-[#26c4b7] brutal-shadow-sm border-[#0b1110]')
                    : (isDark ? 'bg-[#141d1b] text-zinc-300 hover:bg-[#1a2623] hover:text-white border-[#263330]' : 'bg-[#ede5d3] text-[#082621] hover:bg-white border-[#0b1110]')
                }`}
              >
                <span>{opt.label}</span>
                {isSelected ? <Clock size={15} /> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
