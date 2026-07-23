import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function ConfirmModal({ isOpen, title, message, confirmText = 'حذف', cancelText = 'إلغاء', onConfirm, onCancel, isDanger = true }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="bg-[#181818] border border-white/15 rounded-3xl max-w-sm w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200 text-center relative overflow-hidden">
        
        {/* Top Glow Accent */}
        <div 
          className="absolute -top-12 left-1/2 -translate-x-1/2 w-32 h-32 rounded-full blur-2xl pointer-events-none"
          style={{ background: isDanger ? 'rgba(239, 68, 68, 0.25)' : 'rgba(29, 185, 84, 0.25)' }}
        />

        {/* Close Icon */}
        <button 
          onClick={onCancel}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full transition-colors"
        >
          <X size={18} />
        </button>

        {/* Icon */}
        <div className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center border shadow-xl ${
          isDanger 
            ? 'bg-red-500/10 border-red-500/20 text-red-400' 
            : 'bg-[#1DB954]/10 border-[#1DB954]/20 text-[#1DB954]'
        }`}>
          {isDanger ? <Trash2 size={26} /> : <AlertTriangle size={26} />}
        </div>

        {/* Title & Message */}
        <h3 className="text-lg font-extrabold text-white mb-2 tracking-tight">
          {title || 'هل أنت تأكد؟'}
        </h3>
        {message && (
          <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
            {message}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 mt-2">
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 font-extrabold text-xs rounded-full shadow-lg transition-all active:scale-95 ${
              isDanger 
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30' 
                : 'bg-[#1DB954] hover:bg-[#1ed760] text-black shadow-[#1DB954]/30'
            }`}
          >
            {confirmText}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs rounded-full border border-white/10 transition-all active:scale-95"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
