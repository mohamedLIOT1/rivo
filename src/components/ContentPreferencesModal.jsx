import React from 'react';
import { X } from 'lucide-react';
import ContentPreferencesCard from './settings/ContentPreferencesCard';
import { usePreferences } from '../context/PreferencesContext';

export { ContentPreferencesCard };

export default function ContentPreferencesModal({ isOpen, onClose, globalTheme = 'dark' }) {
  const isDark = globalTheme === 'dark';
  const { t } = usePreferences();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className={`brutal-border-thick brutal-shadow-lg max-w-md w-full p-6 relative max-h-[92vh] overflow-y-auto ${
          isDark ? 'bg-[#121917] text-white border-zinc-700' : 'bg-[#fdfbf7] text-[#0b1110] border-[#0b1110]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between pb-3 border-b-2 mb-4 ${
          isDark ? 'border-zinc-700' : 'border-[#0b1110]'
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#17a398] brutal-border" />
            <h3 className={`text-base font-mono font-black uppercase ${
              isDark ? 'text-[#26c4b7]' : 'text-[#082621]'
            }`}>
              {t('settings.contentPreferences') || 'Content Preferences'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`brutal-btn p-1 brutal-border cursor-pointer ${
              isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700' : 'bg-[#ede5d3] hover:bg-[#ded2bb] text-[#0b1110] border-[#0b1110]'
            }`}
          >
            <X size={18} />
          </button>
        </div>
        <ContentPreferencesCard isDark={isDark} />
      </div>
    </div>
  );
}
