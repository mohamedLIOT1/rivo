import React from 'react';
import { X, Command, Play, SkipForward, SkipBack, Volume2, VolumeX, Heart, Shuffle, Repeat, HelpCircle } from 'lucide-react';

export default function ShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const shortcuts = [
    {
      category: 'Playback',
      items: [
        { keys: ['Space'], desc: 'Play / Pause', icon: Play },
        { keys: ['Ctrl', '→'], desc: 'Next track', icon: SkipForward },
        { keys: ['Ctrl', '←'], desc: 'Previous track', icon: SkipBack },
        { keys: ['→'], desc: 'Seek forward 5s (Shift + → for 10s)' },
        { keys: ['←'], desc: 'Seek backward 5s (Shift + ← for 10s)' },
        { keys: ['K'], desc: 'Play / Pause (alternative)' },
        { keys: ['J'], desc: 'Seek backward 10s' },
      ],
    },
    {
      category: 'Volume & Audio',
      items: [
        { keys: ['↑'], desc: 'Volume up (+5%)', icon: Volume2 },
        { keys: ['↓'], desc: 'Volume down (-5%)', icon: Volume2 },
        { keys: ['M'], desc: 'Mute / Unmute', icon: VolumeX },
      ],
    },
    {
      category: 'Controls & Navigation',
      items: [
        { keys: ['L'], desc: 'Save to / Remove from Liked Songs', icon: Heart },
        { keys: ['S'], desc: 'Toggle Shuffle', icon: Shuffle },
        { keys: ['R'], desc: 'Toggle Repeat', icon: Repeat },
        { keys: ['?'], desc: 'Show / Hide Keyboard Shortcuts', icon: HelpCircle },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-in fade-in duration-150">
      <div className="bg-[#181818] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1DB954]/20 border border-[#1DB954]/40 flex items-center justify-center text-[#1DB954]">
              <Command size={18} />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base leading-tight">Keyboard Shortcuts</h3>
              <p className="text-xs text-zinc-400">Quickly control Liofy without a mouse</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto space-y-5">
          {shortcuts.map((cat) => (
            <div key={cat.category}>
              <h4 className="text-[11px] font-black uppercase tracking-wider text-[#1DB954] mb-2.5">
                {cat.category}
              </h4>
              <div className="space-y-2">
                {cat.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1.5 px-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] transition-colors"
                  >
                    <span className="text-xs text-zinc-200 font-medium">{item.desc}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="min-w-[24px] px-2 py-1 rounded bg-[#282828] border border-white/10 text-white font-mono text-[11px] font-bold text-center shadow-inner"
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
        <div className="px-6 py-3 border-t border-white/10 bg-zinc-900/60 flex items-center justify-between text-xs text-zinc-400">
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono font-bold">?</kbd> anytime to toggle</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-full bg-white text-black font-bold text-xs hover:bg-zinc-200 transition-colors"
          >
            Got it
          </button>
        </div>

      </div>
    </div>
  );
}
