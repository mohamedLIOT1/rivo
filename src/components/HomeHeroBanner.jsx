import React from 'react';
import { Play, Plus, Disc } from 'lucide-react';
import { normalizeCoverUrl, handleCoverImageError } from '../utils/coverUtils';

export default function HomeHeroBanner({
  resolvedMoodLabel,
  getGreetingPrefix,
  currentUser,
  t,
  isRTL,
  handlePlaySmartCassette,
  openAddSongModal,
  aiMoodPlaylistObj,
  aiMoodMix = [],
  onSelectPlaylist,
  heroCassetteArtists,
}) {
  return (
    <section className="mb-6 bg-[#082621] rounded-2xl brutal-border-thick p-5 sm:p-7 text-[#fdfbf7] brutal-shadow-teal relative overflow-hidden">
      <div className="absolute -right-6 -bottom-10 opacity-10 text-white font-display font-black text-9xl select-none pointer-events-none tracking-tighter">
        RIVO
      </div>
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sm:gap-6 relative z-10">
        <div className="max-w-xl text-left w-full">
          <div className="inline-flex items-center gap-1.5 bg-[#fdfbf7] text-[#0b1110] px-2.5 py-0.5 rounded-full brutal-border text-[10px] sm:text-xs font-display font-bold mb-2.5 brutal-shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#17a398]" />
            <span>{resolvedMoodLabel}</span>
          </div>
          <h1 className="font-display text-2xl sm:text-4xl lg:text-5xl font-black leading-tight mb-2 tracking-tight text-white">
            {getGreetingPrefix()}{isRTL ? '، ' : ', '}
            <span className="text-[#17a398]">{currentUser?.name ? currentUser.name.split(' ')[0] : t('home.listener')}</span>
            {isRTL ? '' : '.'}
          </h1>
          <p className="text-emerald-100/90 text-xs sm:text-sm font-medium leading-relaxed mb-3.5 line-clamp-2 sm:line-clamp-none">
            {t('home.heroSubtitle')}
          </p>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={handlePlaySmartCassette}
              className="flex-1 sm:flex-initial bg-[#fdfbf7] hover:bg-white text-[#0b1110] font-display font-black text-xs sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl brutal-border brutal-shadow-sm brutal-btn flex items-center justify-center gap-2 cursor-pointer"
              title={aiMoodPlaylistObj ? aiMoodPlaylistObj.name : t('home.playTopChartsTitle')}
            >
              <Play size={15} fill="currentColor" />
              <span>
                {aiMoodMix.length > 0
                  ? (isRTL ? `تشغيل قائمة الذكاء (${aiMoodMix.length})` : `PLAY AI MOOD MIX (${aiMoodMix.length})`)
                  : t('home.playTopCharts')}
              </span>
            </button>
            <button
              onClick={openAddSongModal}
              className="w-full sm:w-auto bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] font-display font-bold text-xs px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl brutal-border brutal-shadow-sm brutal-btn flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus size={15} strokeWidth={2.5} />
              <span>{t('home.addTrack')}</span>
            </button>
          </div>
        </div>

        <div
          onClick={() => (aiMoodPlaylistObj ? onSelectPlaylist?.(aiMoodPlaylistObj) : handlePlaySmartCassette())}
          title={aiMoodPlaylistObj ? (isRTL ? 'فتح قائمة ذكاء ريفو' : 'Open AI Mood Mix Playlist') : t('home.playTopChartsTitle')}
          className="hidden md:flex relative shrink-0 items-center justify-center self-center lg:self-auto mt-2 lg:mt-0 cursor-pointer"
        >
          <div className="w-72 lg:w-80 bg-[#fdfbf7] text-[#0b1110] rounded-xl brutal-border-thick p-3 sm:p-3.5 brutal-shadow-lg transform rotate-1 hover:rotate-0 transition-transform duration-200">
            <div className="border-2 border-dashed border-[#0b1110] rounded-lg p-2.5 sm:p-3 bg-white">
              <div className="flex items-center justify-between text-[9px] font-mono font-bold border-b-2 border-black pb-1 mb-2.5">
                <span>{t('home.soundLab')}</span>
                <span>{aiMoodMix.length > 0 ? (isRTL ? 'تتجدد كل 12 ساعة' : '12H AI PLAYLIST') : t('home.hiFiStereo')}</span>
              </div>
              <div className="flex items-center gap-3 text-left">
                <div className="w-20 h-20 rounded-lg bg-[#17a398] overflow-hidden brutal-border brutal-shadow-sm shrink-0 relative">
                  {aiMoodMix.length > 0 ? (
                    <div className="w-full h-full grid grid-cols-2 grid-rows-2">
                      {aiMoodMix.slice(0, 4).map((tr, idx) => (
                        <img
                          key={`hero-cov-${tr.id || tr._id || idx}`}
                          src={normalizeCoverUrl(tr.cover, tr)}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={handleCoverImageError}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Disc size={30} className="text-[#0b1110]" strokeWidth={2.2} />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-display font-black text-sm sm:text-base text-[#0b1110] leading-tight truncate">
                    {aiMoodMix.length > 0 ? (isRTL ? 'قائمة ذكاء ريفو' : 'AI Mood Mix') : t('home.rivoCassette')}
                  </div>
                  <div className="text-[10px] font-bold text-[#0f756d] truncate mt-0.5">
                    {resolvedMoodLabel}
                    {aiMoodMix.length > 0 ? ` • ${aiMoodMix.length} ${isRTL ? 'أغاني' : 'tracks'}` : ''}
                  </div>
                  {heroCassetteArtists && (
                    <div className="text-[10px] text-zinc-600 font-medium line-clamp-2 mt-0.5 leading-snug">
                      {heroCassetteArtists}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlaySmartCassette();
                    }}
                    className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0b1110] hover:bg-[#17a398] hover:text-[#0b1110] text-[#17a398] text-[10px] font-mono font-black uppercase transition-colors cursor-pointer"
                  >
                    <Play size={10} fill="currentColor" />
                    <span>{isRTL ? 'تشغيل القائمة' : 'Play Playlist'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="sawtooth-badge w-16 h-16 sm:w-20 sm:h-20 bg-[#dc2626] text-white flex flex-col items-center justify-center p-1.5 text-center absolute -top-3 -right-3 transform -rotate-12 brutal-border shadow-md">
            <span className="font-display text-[7px] sm:text-[8px] font-bold">12H</span>
            <span className="font-display font-black text-xs sm:text-sm leading-tight">AI MIX</span>
            <span className="text-[6px] sm:text-[7px] font-mono font-bold">{t('home.topPicks')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
