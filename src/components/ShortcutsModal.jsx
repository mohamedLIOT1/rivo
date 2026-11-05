import React from 'react';
import { X, Command, Play, SkipForward, SkipBack, Volume2, VolumeX, Heart, Shuffle, Repeat, HelpCircle } from 'lucide-react';
import { useUI } from '../context/UIContext';

export default function ShortcutsModal({ isOpen, onClose }) {
  const { globalTheme } = useUI();
  const isDark = globalTheme === 'dark';

  if (!isOpen) return null;

  const shortcuts = [
    {
      category: 'Playback Controls',
      items: [
        { keys: ['F5'], desc: 'Play / Pause', icon: Play },
        { keys: ['F6'], desc: 'Next Track', icon: SkipForward },
        { keys: ['F4'], desc: 'Previous Track', icon: SkipBack },
        { keys: ['Space'], desc: 'Play / Pause', icon: Play },
        { keys: ['Ctrl', '→'], desc: 'Next Track', icon: SkipForward },
        { keys: ['Ctrl', '←'], desc: 'Previous Track', icon: SkipBack },
        { keys: ['→'], desc: 'Seek forward 5s (Shift + → for 10s)' },
        { keys: ['←'], desc: 'Seek backward 5s (Shift + ← for 10s)' },
        { keys: ['K'], desc: 'Toggle playback' },
        { keys: ['J'], desc: 'Rewind 10s' },
      ],
    },
    {
      category: 'Volume & Audio',
      items: [
        { keys: ['↑'], desc: 'Volume Up (+5%)', icon: Volume2 },
        { keys: ['↓'], desc: 'Volume Down (-5%)', icon: Volume2 },
        { keys: ['M'], desc: 'Mute / Unmute', icon: VolumeX },
      ],
    },
    {
      category: 'Navigation & Controls',
      items: [
        { keys: ['L'], desc: 'Like / Unlike Track', icon: Heart },
        { keys: ['S'], desc: 'Toggle Shuffle', icon: Shuffle },
        { keys: ['R'], desc: 'Toggle Repeat', icon: Repeat },
        { keys: ['?'], desc: 'Show Keyboard Shortcuts', icon: HelpCircle },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className={`brutal-border-thick brutal-shadow-lg w-full max-w-lg overflow-hidden relative transition-colors ${
        isDark ? 'bg-[#0e1715] text-[#fdfbf7] border-[#263330]' : 'bg-[#fdfbf7] text-[#082621] border-[#0b1110]'
      }`}>
        
        {/* Header */}
        <div className={`px-5 py-4 border-b-2 flex items-center justify-between transition-colors ${
          isDark ? 'border-[#263330] bg-[#141d1b]' : 'border-[#0b1110] bg-[#ede5d3]'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 brutal-border flex items-center justify-center ${
              isDark ? 'bg-[#17a398] text-[#082621] border-[#17a398]' : 'bg-[#082621] text-[#26c4b7] border-[#0b1110]'
            }`}>
              <Command size={16} />
            </div>
            <div>
              <h3 className={`font-mono font-black uppercase text-sm ${isDark ? 'text-white' : 'text-[#082621]'}`}>
                Keyboard Shortcuts
              </h3>
              <p className={`text-[11px] font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                Navigate Rivo with keyboard shortcuts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`brutal-btn p-1 brutal-border transition-colors ${
              isDark ? 'bg-[#1b2623] text-white hover:bg-[#263531] border-[#263330]' : 'bg-[#fdfbf7] text-[#0b1110] hover:bg-[#ded2bb] border-[#0b1110]'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 max-h-[65vh] overflow-y-auto space-y-4">
          {shortcuts.map((cat) => (
            <div key={cat.category}>
              <h4 className="text-[10px] font-mono font-black uppercase tracking-wider text-[#17a398] mb-1.5">
                {cat.category}
              </h4>
              <div className="space-y-1.5">
                {cat.items.map((item, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between py-1.5 px-2 brutal-border text-xs transition-colors ${
                      isDark ? 'bg-[#141d1b] border-[#263330]' : 'bg-[#ede5d3] border-[#0b1110]'
                    }`}
                  >
                    <span className={`text-xs font-medium font-sans ${isDark ? 'text-zinc-200' : 'text-[#082621]'}`}>
                      {item.desc}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className={`min-w-[22px] px-2 py-0.5 brutal-border font-mono text-[10px] font-black text-center ${
                            isDark ? 'bg-[#0b1110] text-[#17a398] border-[#263330]' : 'bg-[#fdfbf7] text-[#082621] border-[#0b1110]'
                          }`}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className={`px-5 py-2.5 border-t-2 flex items-center justify-between text-xs font-mono transition-colors ${
          isDark ? 'border-[#263330] bg-[#141d1b] text-zinc-400' : 'border-[#0b1110] bg-[#ede5d3] text-[#082621]'
        }`}>
          <span>Tap <kbd className={`px-1 py-0.5 brutal-border font-bold ${
            isDark ? 'bg-[#0b1110] text-white border-[#263330]' : 'bg-[#fdfbf7] text-[#082621] border-[#0b1110]'
          }`}>?</kbd> anytime to toggle</span>
          <button
            onClick={onClose}
            className={`brutal-btn px-4 py-1 font-mono font-black text-xs uppercase brutal-border brutal-shadow-sm cursor-pointer ${
              isDark ? 'bg-[#17a398] text-[#082621] border-[#17a398]' : 'bg-[#082621] text-[#26c4b7] border-[#0b1110]'
            }`}
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
}
