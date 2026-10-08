import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function ConfirmModal({ isOpen, title, message, confirmText = 'Delete', cancelText = 'Cancel', onConfirm, onCancel, isDanger = true }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg max-w-sm w-full p-6 text-center relative overflow-hidden">
        
        {/* Close Icon */}
        <button 
          onClick={onCancel}
          className="brutal-btn absolute top-3.5 right-3.5 text-[#0b1110] p-1 bg-[#ede5d3] brutal-border hover:bg-[#ded2bb]"
        >
          <X size={16} />
        </button>

        {/* Icon */}
        <div className={`w-12 h-12 mx-auto mb-3 flex items-center justify-center brutal-border ${
          isDanger 
            ? 'bg-red-100 text-[#dc2626]' 
            : 'bg-[#082621] text-[#26c4b7]'
        }`}>
          {isDanger ? <Trash2 size={22} /> : <AlertTriangle size={22} />}
        </div>

        {/* Title & Message */}
        <h3 className="text-base font-mono font-black uppercase text-[#082621] mb-1.5 tracking-tight">
          {title || 'Confirm Action'}
        </h3>
        {message && (
          <p className="text-xs text-[#082621]/70 mb-5 font-sans leading-relaxed">
            {message}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onConfirm}
            className={`brutal-btn flex-1 py-2 font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm ${
              isDanger 
                ? 'bg-red-100 hover:bg-red-200 text-[#dc2626]' 
                : 'bg-[#082621] hover:bg-[#0b1110] text-[#26c4b7]'
            }`}
          >
            {confirmText}
          </button>
          <button
            onClick={onCancel}
            className="brutal-btn flex-1 py-2 bg-[#ede5d3] hover:bg-[#ded2bb] text-[#082621] font-mono font-black text-xs uppercase brutal-border brutal-shadow-sm"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
