import React from 'react';
import { X, Command, Play, SkipForward, SkipBack, Volume2, VolumeX, Heart, Shuffle, Repeat, HelpCircle } from 'lucide-react';

export default function ShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const shortcuts = [
    {
      category: 'Playback Controls',
      items: [
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
      <div className="bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg w-full max-w-lg overflow-hidden relative">
        
        {/* Header */}
        <div className="px-5 py-4 border-b-2 border-[#0b1110] flex items-center justify-between bg-[#ede5d3]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#082621] text-[#26c4b7] brutal-border flex items-center justify-center">
              <Command size={16} />
            </div>
            <div>
              <h3 className="font-mono font-black uppercase text-[#082621] text-sm">Keyboard Shortcuts</h3>
              <p className="text-[11px] text-[#082621]/70 font-sans">Navigate Liofy with keyboard shortcuts</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="brutal-btn p-1 bg-[#fdfbf7] brutal-border hover:bg-[#ded2bb] text-[#0b1110]"
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
                    className="flex items-center justify-between py-1.5 px-2 bg-[#ede5d3] brutal-border text-xs"
                  >
                    <span className="text-xs text-[#082621] font-medium font-sans">{item.desc}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="min-w-[22px] px-2 py-0.5 bg-[#fdfbf7] brutal-border text-[#082621] font-mono text-[10px] font-black text-center"
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
        <div className="px-5 py-2.5 border-t-2 border-[#0b1110] bg-[#ede5d3] flex items-center justify-between text-xs font-mono text-[#082621]">
          <span>Tap <kbd className="px-1 py-0.5 bg-[#fdfbf7] brutal-border font-bold">?</kbd> anytime to toggle</span>
          <button
            onClick={onClose}
            className="brutal-btn px-4 py-1 bg-[#082621] text-[#26c4b7] font-mono font-black text-xs uppercase brutal-border brutal-shadow-sm cursor-pointer"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
}
