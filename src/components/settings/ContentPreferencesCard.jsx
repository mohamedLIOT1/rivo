import React from 'react';
import { Music, BookOpen } from 'lucide-react';
import { usePreferences } from '../../context/PreferencesContext';

export default function ContentPreferencesCard({ isDark = true }) {
  const { contentModes, toggleContentMode, t } = usePreferences();

  return (
    <div className={`py-3.5 border-b-2 p-3 brutal-border mb-3 ${
      isDark ? 'border-zinc-700 bg-zinc-800/40' : 'border-[#0b1110] bg-[#f2ecde]/40'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-mono font-black uppercase ${isDark ? 'text-white' : 'text-[#082621]'}`}>
          {t('settings.contentPreferences')}
        </span>
        <span className="text-[9px] font-mono font-bold text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
          {t('settings.cloudSynced')}
        </span>
      </div>
      <p className={`text-[11px] mb-3 leading-relaxed ${isDark ? 'text-zinc-300' : 'text-[#082621]/70'}`}>
        {t('settings.contentPreferencesDesc')}
      </p>

      <div className="space-y-2">
        {/* Music Toggle */}
        <div className={`flex items-center justify-between p-2.5 rounded-xl border ${
          isDark ? 'bg-zinc-900/80 border-zinc-700/80' : 'bg-[#ede5d3] border-zinc-300'
        }`}>
          <div className="flex items-center gap-2.5">
            <Music size={16} className={contentModes.music !== false ? 'text-emerald-400' : 'text-zinc-500'} />
            <div>
              <span className={`text-xs font-bold block ${isDark ? 'text-white' : 'text-black'}`}>
                {t('settings.musicSongs')}
              </span>
              <span className={`text-[10px] block ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {contentModes.music !== false ? t('settings.musicEnabledDesc') : t('settings.musicHiddenDesc')}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleContentMode('music', contentModes.music === false)}
            className={`px-3 py-1 text-[11px] font-mono font-black rounded-lg border transition-all cursor-pointer ${
              contentModes.music !== false
                ? 'bg-emerald-500 text-black border-emerald-400 shadow-sm'
                : 'bg-zinc-800 text-zinc-400 border-zinc-600 hover:text-white'
            }`}
          >
            {contentModes.music !== false ? t('settings.enabled') : t('settings.hidden')}
          </button>
        </div>

        {/* Quran Toggle */}
        <div className={`flex items-center justify-between p-2.5 rounded-xl border ${
          isDark ? 'bg-zinc-900/80 border-zinc-700/80' : 'bg-[#ede5d3] border-zinc-300'
        }`}>
          <div className="flex items-center gap-2.5">
            <BookOpen size={16} className="text-emerald-400" />
            <div>
              <span className={`text-xs font-bold block ${isDark ? 'text-white' : 'text-black'}`}>
                {t('settings.holyQuran')}
              </span>
              <span className={`text-[10px] block ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {t('settings.quranDesc')}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => toggleContentMode('quran', contentModes.quran === false)}
            className={`px-3 py-1 text-[11px] font-mono font-black rounded-lg border transition-all cursor-pointer ${
              contentModes.quran !== false
                ? 'bg-emerald-500 text-black border-emerald-400 shadow-sm'
                : 'bg-zinc-800 text-zinc-400 border-zinc-600 hover:text-white'
            }`}
          >
            {contentModes.quran !== false ? t('settings.enabled') : t('settings.hidden')}
          </button>
        </div>
      </div>
    </div>
  );
}
