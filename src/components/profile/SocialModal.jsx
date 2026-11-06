import React from 'react';
import { Loader2 } from 'lucide-react';

export default function SocialModal({
  isOpen,
  title,
  loading,
  users = [],
  isDark,
  onClose,
  onSelectUser,
  t,
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`w-full max-w-sm rounded-2xl brutal-border p-4 brutal-shadow-lg ${
        isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
      }`}>
        <div className={`flex items-center justify-between border-b-2 pb-2 mb-3 ${
          isDark ? 'border-zinc-700' : 'border-black'
        }`}>
          <h3 className="font-display font-black text-sm">{title}</h3>
          <button 
            onClick={onClose}
            className={`w-6 h-6 rounded font-bold text-xs cursor-pointer ${
              isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-zinc-200 hover:bg-zinc-300 text-[#0b1110]'
            }`}
          >
            ✕
          </button>
        </div>

        <div className="max-h-60 overflow-y-auto space-y-2">
          {loading ? (
            <div className="text-center py-6">
              <Loader2 size={20} className="animate-spin text-[#17a398] mx-auto" />
            </div>
          ) : users.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-4">{t('profile.noUsersFound')}</p>
          ) : (
            users.map(u => (
              <div 
                key={u.id || u._id}
                onClick={() => onSelectUser(u.id || u._id)}
                className={`p-2 rounded-lg brutal-border flex items-center gap-2 cursor-pointer transition ${
                  isDark ? 'bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-white' : 'bg-white border-black hover:bg-[#ede5d3] text-[#0b1110]'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-[#17a398] brutal-border flex items-center justify-center font-bold text-xs text-[#0b1110] overflow-hidden shrink-0">
                  {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : u.name?.[0] || 'U'}
                </div>
                <div className="truncate flex-1">
                  <p className={`font-display font-bold text-xs truncate ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>{u.name}</p>
                  {u.bio ? <p className="text-[10px] text-zinc-400 truncate">{u.bio}</p> : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
