import React from 'react';
import { Globe, Check } from 'lucide-react';
import { usePreferences } from '../../context/PreferencesContext';

export default function LanguageSettingCard({ isDark = true }) {
  const { language, setLanguage, t, isRTL } = usePreferences();

  return (
    <div className={`py-3.5 border-b-2 p-3 brutal-border mb-3 ${
      isDark ? 'border-zinc-700 bg-zinc-800/40' : 'border-[#0b1110] bg-[#f2ecde]/40'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Globe size={16} className="text-[#17a398]" />
          <span className={`text-xs font-mono font-black uppercase ${
            isDark ? 'text-white' : 'text-[#082621]'
          }`}>
            {t('settings.languageTitle')}
          </span>
        </div>
        <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
          {language === 'ar' ? 'العربية' : 'English'}
        </span>
      </div>

      <p className={`text-[11px] mb-3 leading-relaxed ${
        isDark ? 'text-zinc-300' : 'text-[#082621]/70'
      }`}>
        {t('settings.languageDesc')}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* English Button */}
        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={`flex items-center justify-between p-2.5 rounded-xl border brutal-btn cursor-pointer transition-all ${
            language === 'en'
              ? isDark
                ? 'bg-[#17362f] border-[#26c4b7] text-white shadow-sm'
                : 'bg-emerald-100 border-[#17a398] text-black shadow-sm'
              : isDark
                ? 'bg-zinc-900/80 border-zinc-700/80 text-zinc-300 hover:bg-zinc-800'
                : 'bg-[#ede5d3] border-zinc-300 text-[#0b1110] hover:bg-white'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              language === 'en'
                ? 'border-[#26c4b7] bg-[#26c4b7]'
                : 'border-zinc-500 bg-transparent'
            }`}>
              {language === 'en' && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
            </div>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <span className="text-xs font-bold block">English</span>
              <span className="text-[10px] opacity-75 block">LTR • Default</span>
            </div>
          </div>
          {language === 'en' && (
            <Check size={16} className="text-[#26c4b7] shrink-0" strokeWidth={2.5} />
          )}
        </button>

        {/* Arabic Button */}
        <button
          type="button"
          onClick={() => setLanguage('ar')}
          className={`flex items-center justify-between p-2.5 rounded-xl border brutal-btn cursor-pointer transition-all ${
            language === 'ar'
              ? isDark
                ? 'bg-[#17362f] border-[#26c4b7] text-white shadow-sm'
                : 'bg-emerald-100 border-[#17a398] text-black shadow-sm'
              : isDark
                ? 'bg-zinc-900/80 border-zinc-700/80 text-zinc-300 hover:bg-zinc-800'
                : 'bg-[#ede5d3] border-zinc-300 text-[#0b1110] hover:bg-white'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
              language === 'ar'
                ? 'border-[#26c4b7] bg-[#26c4b7]'
                : 'border-zinc-500 bg-transparent'
            }`}>
              {language === 'ar' && <div className="w-1.5 h-1.5 rounded-full bg-black" />}
            </div>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <span className="text-xs font-bold block font-sans">العربية</span>
              <span className="text-[10px] opacity-75 block font-sans">RTL • من اليمين لليسار</span>
            </div>
          </div>
          {language === 'ar' && (
            <Check size={16} className="text-[#26c4b7] shrink-0" strokeWidth={2.5} />
          )}
        </button>
      </div>
    </div>
  );
}
