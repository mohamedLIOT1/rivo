import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Smile, Plus, X } from 'lucide-react';
import PremiumEmoji from './PremiumEmoji';

export const QUICK_EMOJIS = ['❤️', '😂', '🔥', '👍', '😮', '😢', '👏', '💀'];

export const EMOJI_CATEGORIES = [
  {
    id: 'smiles',
    label: '😃 Smiles',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', 
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😜', '🤪', 
      '🤗', '🤫', '🤔', '😐', '😏', '🙄', '😬', '😴', '😷', '🥵', 
      '🥶', '🥴', '😵', '🤯', '🥳', '😎', '🤓', '🧐', '🥺', '🥱'
    ]
  },
  {
    id: 'gestures',
    label: '👍 Hands',
    emojis: [
      '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘', 
      '👌', '🤌', '👈', '👉', '👆', '👇', '✋', '👋', '🤙', '💪', 
      '🙏', '🤝', '👏', '🙌', '👐', '🫡', '🤝'
    ]
  },
  {
    id: 'hearts',
    label: '❤️ Hearts',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', 
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '🔥', '✨', '⭐', 
      '🌟', '💥', '💯', '💀', '🎉', '👑', '💎', '👀', '🗿'
    ]
  },
  {
    id: 'vibes',
    label: '🎵 Vibes',
    emojis: [
      '🎵', '🎶', '🎧', '🎤', '☕', '🍕', '🍔', '🍺', '🍿', '🚀', 
      '⚡', '🏆', '🥇', '🥈', '🥉', '⚽', '🎮', '💡', '💣', '🪄'
    ]
  }
];

export default function MessageReactions({
  message,
  currentUserId,
  onToggleReaction,
  isDark = true,
  isMe = false
}) {
  const [isQuickOpen, setIsQuickOpen] = useState(false);
  const [isExpandedOpen, setIsExpandedOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('smiles');
  const containerRef = useRef(null);

  // Group reactions by emoji
  const reactionGroups = useMemo(() => {
    const map = {};
    const reactions = Array.isArray(message?.reactions) ? message.reactions : [];
    const myIdStr = String(currentUserId || '');

    reactions.forEach(r => {
      const em = r.emoji;
      if (!em) return;
      if (!map[em]) {
        map[em] = { count: 0, hasMyReaction: false };
      }
      map[em].count += 1;
      const rUid = String(r.userId?._id || r.userId || '');
      if (myIdStr && rUid === myIdStr) {
        map[em].hasMyReaction = true;
      }
    });

    return Object.entries(map).map(([emoji, data]) => ({
      emoji,
      count: data.count,
      hasMyReaction: data.hasMyReaction
    }));
  }, [message?.reactions, currentUserId]);

  const handleToggle = (emoji) => {
    const msgId = message?._id || message?.id;
    if (onToggleReaction && msgId) {
      onToggleReaction(msgId, emoji);
    }
    setIsQuickOpen(false);
    setIsExpandedOpen(false);
  };

  // Close menus when clicking outside
  useEffect(() => {
    if (!isQuickOpen && !isExpandedOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsQuickOpen(false);
        setIsExpandedOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isQuickOpen, isExpandedOpen]);

  return (
    <div 
      ref={containerRef}
      className={`flex items-center flex-wrap gap-1.5 mt-1 relative select-none ${isMe ? 'justify-end' : 'justify-start'}`}
    >
      {/* Existing Reaction Badges with Premium Emojis */}
      {reactionGroups.map(({ emoji, count, hasMyReaction }) => (
        <button
          key={emoji}
          type="button"
          onClick={() => handleToggle(emoji)}
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs transition border cursor-pointer active:scale-95 ${
            hasMyReaction
              ? 'bg-[#17a398]/20 border-[#17a398] text-[#17a398] font-black shadow-sm ring-1 ring-[#17a398]/30'
              : isDark
                ? 'bg-zinc-800/90 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600'
                : 'bg-zinc-100 border-zinc-300 text-zinc-700 hover:bg-zinc-200'
          }`}
          title={`${count} reaction${count > 1 ? 's' : ''}`}
        >
          <PremiumEmoji emoji={emoji} className="w-3.5 h-3.5" />
          <span className="text-[10px] font-mono font-bold leading-none">{count}</span>
        </button>
      ))}

      {/* Add Reaction Button */}
      <div className="relative inline-block">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsQuickOpen(prev => !prev);
            setIsExpandedOpen(false);
          }}
          className={`p-1 rounded-full opacity-65 hover:opacity-100 transition border cursor-pointer flex items-center justify-center active:scale-90 ${
            isDark 
              ? 'bg-zinc-800/90 border-zinc-700 text-zinc-400 hover:text-white hover:bg-zinc-700' 
              : 'bg-zinc-100 border-zinc-300 text-zinc-600 hover:text-black hover:bg-zinc-200'
          }`}
          title="Add reaction"
        >
          <Smile size={12} />
        </button>

        {/* Floating Quick Bar with Premium Emojis */}
        {isQuickOpen && !isExpandedOpen && (
          <div
            className={`absolute bottom-full mb-1.5 z-40 flex items-center gap-1 p-1 rounded-full brutal-border shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 ${
              isMe ? 'right-0' : 'left-0'
            } ${
              isDark ? 'bg-[#141c1a]/95 border-[#243632]' : 'bg-[#fdfbf7] border-black'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {QUICK_EMOJIS.map(emoji => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleToggle(emoji)}
                className="w-7 h-7 flex items-center justify-center rounded-full hover:scale-125 hover:bg-[#17a398]/20 transition-all cursor-pointer p-0.5"
                title={emoji}
              >
                <PremiumEmoji emoji={emoji} className="w-5 h-5 pointer-events-none" />
              </button>
            ))}

            {/* '+' button to open full emoji catalog */}
            <button
              type="button"
              onClick={() => {
                setIsExpandedOpen(true);
                setIsQuickOpen(false);
              }}
              className={`w-7 h-7 flex items-center justify-center rounded-full transition-transform hover:scale-110 cursor-pointer ${
                isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-[#17a398] hover:text-black' : 'bg-zinc-200 text-black hover:bg-black hover:text-white'
              }`}
              title="More emojis"
            >
              <Plus size={13} strokeWidth={2.5} />
            </button>
          </div>
        )}

        {/* Expanded Rich Emoji Picker Popup */}
        {isExpandedOpen && (
          <div
            className={`absolute bottom-full mb-2 z-50 w-72 sm:w-80 max-w-[calc(100vw-3rem)] p-2.5 rounded-2xl brutal-border shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 ${
              isMe ? 'right-0' : 'left-0'
            } ${
              isDark ? 'bg-[#101715]/98 border-[#243632] text-white' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Tabs + Close */}
            <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-zinc-700/50">
              <div className="flex items-center gap-1 overflow-x-auto py-0.5" style={{ scrollbarWidth: 'none' }}>
                {EMOJI_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-2 py-0.5 rounded-full text-[11px] font-sans font-bold whitespace-nowrap transition cursor-pointer ${
                      activeCategory === cat.id
                        ? 'bg-[#17a398] text-[#082621] font-black'
                        : isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-600 hover:text-black hover:bg-zinc-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setIsExpandedOpen(false)}
                className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              >
                <X size={12} />
              </button>
            </div>

            {/* Grid of Premium Emojis */}
            <div className="grid grid-cols-7 gap-1 max-h-48 overflow-y-auto p-1" style={{ scrollbarWidth: 'thin' }}>
              {(EMOJI_CATEGORIES.find(c => c.id === activeCategory)?.emojis || []).map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleToggle(emoji)}
                  className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#17a398]/20 hover:scale-125 transition-all cursor-pointer p-1"
                >
                  <PremiumEmoji emoji={emoji} className="w-6 h-6 pointer-events-none" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
