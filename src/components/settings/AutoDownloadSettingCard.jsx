import React from 'react';
import { HardDriveDownload } from 'lucide-react';
import { usePreferences } from '../../context/PreferencesContext';

/**
 * Toggle card for auto-downloading tracks after full playback completes.
 */
export default function AutoDownloadSettingCard({ isDark = true }) {
  const { autoDownloadFinished, toggleAutoDownloadFinished, language, isRTL, t } = usePreferences();
  const isAr = language === 'ar';
  const enabled = Boolean(autoDownloadFinished);

  const title = isAr
    ? 'تنزيل تلقائي بعد إكمال الاستماع للأغنية'
    : 'Auto-download on full listen';
  const description = isAr
    ? 'حفظ المسار تلقائياً في التخزين المحلي للاستماع بدون إنترنت عند انتهاء تشغيله بالكامل'
    : 'Automatically save tracks offline after listening through to the end';

  return (
    <div
      className={`flex items-center justify-between gap-3 py-3 border-b-2 ${
        isDark ? 'border-zinc-700' : 'border-[#0b1110]'
      }`}
    >
      <div className={`flex items-start gap-2.5 flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
        <HardDriveDownload
          size={16}
          className={`mt-0.5 shrink-0 ${enabled ? 'text-[#26c4b7]' : 'text-zinc-500'}`}
        />
        <div>
          <span
            className={`text-xs font-mono font-black block ${
              isDark ? 'text-white' : 'text-[#082621]'
            }`}
          >
            {title}
          </span>
          <p className={`text-[11px] leading-snug mt-0.5 ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
            {description}
          </p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={title}
        data-testid="toggle-auto-download-finished"
        onClick={() => toggleAutoDownloadFinished()}
        className={`brutal-btn px-2.5 py-1.5 text-[11px] font-mono font-black uppercase brutal-border brutal-shadow-sm flex items-center gap-2 shrink-0 cursor-pointer transition-colors ${
          enabled
            ? isDark
              ? 'bg-[#17a398] text-black border-[#26c4b7]'
              : 'bg-[#082621] text-[#26c4b7]'
            : isDark
              ? 'bg-zinc-800 text-zinc-300 border-zinc-700'
              : 'bg-[#ede5d3] text-[#082621]'
        }`}
      >
        <span
          className={`w-7 h-4 rounded-full relative inline-flex items-center transition-colors border ${
            enabled
              ? 'bg-black/25 border-black/40'
              : 'bg-black/30 border-zinc-600'
          }`}
        >
          <span
            className={`w-3 h-3 rounded-full transition-transform ${
              enabled ? 'translate-x-3.5 bg-white' : 'translate-x-0.5 bg-zinc-400'
            }`}
          />
        </span>
        <span>{enabled ? t('settings.active') : t('settings.disabled')}</span>
      </button>
    </div>
  );
}
