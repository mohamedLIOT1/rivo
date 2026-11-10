import React from 'react';
import { X, FolderOpen, Download } from 'lucide-react';
import { usePreferences } from '../context/PreferencesContext';
import { FULL_VERSION } from '../version';
import { isTauriDesktop, openDesktopDownloadsDir } from '../utils/offlineStorage';
import LanguageSettingCard from './settings/LanguageSettingCard';
import ContentPreferencesCard from './settings/ContentPreferencesCard';
import DiscordSettingCard from './settings/DiscordSettingCard';

export default function SettingsModal({
  isOpen,
  onClose,
  isOfflineMode,
  setIsOfflineMode,
  globalTheme = 'dark'
}) {
  const isDark = globalTheme === 'dark';
  const { vocalOnlyMode, toggleVocalOnlyMode, t } = usePreferences();

  if (!isOpen) return null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className={`brutal-border-thick brutal-shadow-lg max-w-md w-full p-6 relative max-h-[92vh] overflow-y-auto ${
        isDark ? 'bg-[#121917] text-white border-zinc-700' : 'bg-[#fdfbf7] text-[#0b1110] border-[#0b1110]'
      }`}>
        <div className={`flex items-center justify-between pb-3 border-b-2 ${
          isDark ? 'border-zinc-700' : 'border-[#0b1110]'
        }`}>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#17a398] brutal-border" />
            <h3 className={`text-base font-mono font-black uppercase ${
              isDark ? 'text-[#26c4b7]' : 'text-[#082621]'
            }`}>
              {t('settings.settingsTitle')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`brutal-btn p-1 brutal-border cursor-pointer ${
              isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700' : 'bg-[#ede5d3] hover:bg-[#ded2bb] text-[#0b1110] border-[#0b1110]'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Quality Guarantee Badge */}
        <div className={`my-4 p-4 brutal-border brutal-shadow-sm flex items-center justify-between ${
          isDark ? 'bg-[#082621] border-[#17a398]/50 text-white' : 'bg-[#082621] text-[#fdfbf7] border-[#0b1110]'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#26c4b7] text-[#082621] brutal-border flex items-center justify-center font-mono font-black text-sm">
              R
            </div>
            <div>
              <h4 className="font-mono font-black uppercase text-sm text-[#26c4b7]">
                {t('settings.hifiAudio')}
              </h4>
              <p className={`text-[11px] ${isDark ? 'text-zinc-300' : 'text-[#ded2bb]'}`}>
                {t('settings.hifiDesc')}
              </p>
            </div>
          </div>
        </div>

        {/* ── 1. Language Setting Card (English / العربية) ── */}
        <LanguageSettingCard isDark={isDark} />

        {/* ── 2. Content Preferences (Music / Quran) ── */}
        <ContentPreferencesCard isDark={isDark} />

        {/* ── 3. Discord Rich Presence Integration ── */}
        <DiscordSettingCard isOpen={isOpen} isDark={isDark} />

        {/* ── 4. Offline Storage Mode ── */}
        <div className={`flex items-center justify-between py-3 border-b-2 ${
          isDark ? 'border-zinc-700' : 'border-[#0b1110]'
        }`}>
          <div>
            <span className={`text-xs font-mono font-black uppercase ${isDark ? 'text-white' : 'text-[#082621]'}`}>
              {t('settings.offlineStorageMode')}
            </span>
            <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
              {t('settings.offlineStorageDesc')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsOfflineMode(!isOfflineMode)}
            className={`brutal-btn px-3 py-1 text-xs font-mono font-black uppercase brutal-border brutal-shadow-sm cursor-pointer ${
              isOfflineMode 
                ? (isDark ? 'bg-[#17a398] text-white' : 'bg-[#082621] text-[#26c4b7]') 
                : (isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#082621]')
            }`}
          >
            {isOfflineMode ? t('settings.active') : t('settings.disabled')}
          </button>
        </div>

        {/* ── 5. Vocal-Only Mode Toggle (Music-Free) ── */}
        <div className={`flex items-center justify-between py-3 border-b-2 ${
          isDark ? 'border-zinc-700' : 'border-[#0b1110]'
        }`}>
          <div>
            <span className={`text-xs font-mono font-black uppercase ${isDark ? 'text-white' : 'text-[#082621]'}`}>
              {t('settings.vocalOnlyMode')}
            </span>
            <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
              {t('settings.vocalOnlyDesc')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => toggleVocalOnlyMode()}
            className={`brutal-btn px-3 py-1 text-xs font-mono font-black uppercase brutal-border brutal-shadow-sm cursor-pointer ${
              vocalOnlyMode 
                ? (isDark ? 'bg-[#17a398] text-white' : 'bg-[#082621] text-[#26c4b7]') 
                : (isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#082621]')
            }`}
          >
            {vocalOnlyMode ? t('settings.active') : t('settings.disabled')}
          </button>
        </div>

        {/* ── 6. Desktop Downloads Folder (Tauri Only) ── */}
        {isTauriDesktop && (
          <div className={`flex items-center justify-between py-3 border-b-2 ${
            isDark ? 'border-zinc-700' : 'border-[#0b1110]'
          }`}>
            <div>
              <span className={`text-xs font-mono font-black uppercase ${isDark ? 'text-white' : 'text-[#082621]'}`}>
                {t('settings.localImportTitle')}
              </span>
              <p className={`text-[11px] ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                {t('settings.localImportDesc')}
              </p>
            </div>
            <button
              type="button"
              onClick={openDesktopDownloadsDir}
              className={`brutal-btn px-3 py-1 text-xs font-mono font-black uppercase brutal-border brutal-shadow-sm flex items-center gap-1.5 cursor-pointer ${
                isDark ? 'bg-zinc-800 text-white hover:bg-zinc-700 border-zinc-600' : 'bg-[#ede5d3] text-[#0b1110] hover:bg-[#ded2bb] border-black'
              }`}
            >
              <FolderOpen size={13} />
              <span>Open Folder ↗</span>
            </button>
          </div>
        )}

        {/* ── Download Apps Banner ── */}
        <a
          href="/download"
          onClick={(e) => {
            e.preventDefault();
            onClose();
            if (typeof window !== 'undefined') {
              window.history.pushState({}, '', '/download');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }
          }}
          className="brutal-btn w-full mb-3 mt-4 py-2.5 bg-[#17a398] hover:bg-[#148f85] text-black font-mono text-xs font-black uppercase brutal-border flex items-center justify-center gap-2 cursor-pointer shadow-[2px_2px_0px_#000]"
        >
          <Download size={15} /> {t('settings.downloadApps')}
        </a>

        {/* ── Save Settings Button ── */}
        <button
          type="button"
          onClick={onClose}
          className="brutal-btn w-full py-2.5 bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] font-mono text-xs font-black uppercase brutal-border brutal-shadow cursor-pointer"
        >
          {t('settings.saveSettings')}
        </button>

        {/* ── Version Footer ── */}
        <div className={`mt-4 pt-3 border-t-2 text-center ${isDark ? 'border-zinc-700' : 'border-[#0b1110]'}`}>
          <p className="font-mono text-[11px] font-black uppercase tracking-wider text-[#17a398]">
            Rivo Music Streaming {FULL_VERSION}
          </p>
          <p className={`font-mono text-[9px] mt-0.5 ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`}>
            High Fidelity Audio • Offline & Synchronized
          </p>
        </div>
      </div>
    </div>
  );
}
