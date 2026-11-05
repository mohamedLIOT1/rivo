import React from 'react';
import { BookOpen, Play, DownloadCloud, Link2, Plus } from 'lucide-react';

export const QuranHeroBanner = React.memo(function QuranHeroBanner({
  isRTL,
  t,
  filteredTracks,
  onSelectTrack,
  openImportPlaylistModal,
  openImportSongModal,
  openCreatePlaylistModal,
  quranTracksCount,
  quranPlaylistsCount,
}) {
  return (
    <section className="mb-6 bg-[#041d1a] rounded-2xl brutal-border-thick p-5 sm:p-7 text-[#fdfbf7] brutal-shadow-teal relative overflow-hidden border-[#17a398]">
      {/* Subtle Calligraphy/Watermark */}
      <div className="absolute -right-4 -bottom-6 opacity-10 text-white font-serif font-black text-8xl sm:text-9xl select-none pointer-events-none tracking-tighter">
        قرآن
      </div>

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className={`max-w-xl ${isRTL ? 'text-right' : 'text-left'}`}>
          <div className="inline-flex items-center gap-2 bg-[#17a398] text-[#041d1a] px-3 py-0.5 rounded-full brutal-border text-[11px] font-mono font-black mb-2.5 shadow-sm">
            <BookOpen size={14} />
            <span>{t('quran.holyQuranAudio')}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black font-display leading-tight mb-2 text-white">
            {isRTL ? (
              <span>{t('quran.title')} • <span className="text-[#26c4b7]">{t('quran.completeMushaf')}</span></span>
            ) : (
              <span>Soulful Recitations & <span className="text-[#26c4b7]">Complete Mushaf</span></span>
            )}
          </h1>

          <p className="text-emerald-100/90 text-xs sm:text-sm font-medium leading-relaxed mb-4">
            {t('quran.heroRecitationsDesc')}
          </p>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5">
            {filteredTracks.length > 0 && (
              <button
                onClick={() => onSelectTrack(filteredTracks[0], filteredTracks)}
                className="bg-[#26c4b7] hover:bg-[#17a398] text-[#041d1a] font-display font-black text-xs sm:text-sm px-4 py-2 rounded-xl brutal-border brutal-shadow-sm brutal-btn flex items-center gap-2 cursor-pointer transition-all"
              >
                <Play size={15} fill="currentColor" />
                <span>{t('quran.playAllRecitations', { count: filteredTracks.length })}</span>
              </button>
            )}

            {openImportPlaylistModal && (
              <button
                onClick={openImportPlaylistModal}
                className="bg-[#fdfbf7] hover:bg-white text-[#0b1110] font-display font-bold text-xs px-3.5 py-2 rounded-xl brutal-border brutal-shadow-sm brutal-btn flex items-center gap-1.5 cursor-pointer"
                title={t('quran.importQuranPlaylist')}
              >
                <DownloadCloud size={15} strokeWidth={2.5} className="text-[#0f756d]" />
                <span>{t('quran.importQuranPlaylist')}</span>
              </button>
            )}

            {openImportSongModal && (
              <button
                onClick={openImportSongModal}
                className="bg-[#0b1110] hover:bg-zinc-900 text-emerald-300 font-display font-bold text-xs px-3.5 py-2 rounded-xl brutal-border border-[#17a398] brutal-btn flex items-center gap-1.5 cursor-pointer"
                title={t('quran.addSurahLink')}
              >
                <Link2 size={15} strokeWidth={2.5} />
                <span>{t('quran.addSurahLink')}</span>
              </button>
            )}

            {openCreatePlaylistModal && (
              <button
                onClick={openCreatePlaylistModal}
                className="bg-amber-400 hover:bg-amber-300 text-black font-display font-bold text-xs px-3 py-2 rounded-xl brutal-border brutal-btn flex items-center gap-1.5 cursor-pointer"
                title={t('quran.newPlaylist')}
              >
                <Plus size={15} strokeWidth={2.5} />
                <span>{t('quran.newPlaylist')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Badge Widget */}
        <div className="shrink-0 bg-[#082621]/90 rounded-xl brutal-border border-[#26c4b7] p-4 text-center min-w-[170px] shadow-lg">
          <span className="text-[10px] font-mono font-bold text-[#26c4b7] block mb-1 uppercase">
            {t('quran.quranLibrary')}
          </span>
          <div className="text-3xl font-black font-display text-white mb-0.5">
            {quranTracksCount}
          </div>
          <div className="text-xs text-emerald-200/80 font-medium">{t('quran.recitationsAvailable', { count: quranTracksCount })}</div>
          <div className="mt-2 pt-2 border-t border-emerald-900/60 text-[11px] text-emerald-400 font-mono">
            {t('quran.playlistsCount', { count: quranPlaylistsCount })}
          </div>
        </div>
      </div>
    </section>
  );
});

export default QuranHeroBanner;
