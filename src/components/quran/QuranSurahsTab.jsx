import React, { useMemo } from 'react';
import { Play, Volume2, Heart, BookOpen } from 'lucide-react';
import QuranReciterAvatar from './QuranReciterAvatar';
import {
  cleanQuranTrackTitle,
  getQuranReciterName,
  getSurahNumber,
  getSurahName,
  isAyahOrClip,
} from '../../utils/quranUtils';

export const QuranSurahsTab = React.memo(function QuranSurahsTab({
  selectedReciter,
  setSelectedReciter,
  setActiveTab,
  filteredTracks,
  reciters,
  searchQuery,
  onSelectTrack,
  isTrackActive,
  isPlaying,
  formatDuration,
  toggleLike,
  visibleLimit,
  setVisibleLimit,
  quranPlaylists,
  openImportPlaylistModal,
  isDark,
  t,
}) {
  const selectedReciterObj = useMemo(() => {
    if (!selectedReciter) return null;
    return (reciters || []).find((r) => r.name === selectedReciter) || null;
  }, [reciters, selectedReciter]);

  return (
    <div>
      {/* If a reciter is selected, show their header & clear button */}
      {selectedReciter && (
        <div className={`p-3.5 sm:p-4 mb-4 rounded-xl brutal-border flex flex-wrap items-center justify-between gap-3 ${
          isDark ? 'bg-[#092b25] border-[#17a398]' : 'bg-[#e0f4f0] border-[#082621]'
        }`}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setSelectedReciter(null);
                setActiveTab('reciters');
              }}
              className="px-3 py-1.5 rounded-lg bg-[#26c4b7] hover:bg-[#17a398] text-[#041d1a] font-display font-black text-xs brutal-border flex items-center gap-1.5 cursor-pointer transition-transform hover:scale-105"
              title={t('quran.backToReciters') || 'العودة للقراء'}
            >
              <span>{t('quran.backToReciters') || '← العودة إلى القراء'}</span>
            </button>
            <div className="flex items-center gap-2.5">
              <QuranReciterAvatar
                src={selectedReciterObj?.cover}
                name={selectedReciter}
                className="w-10 h-10 ring-2 ring-[#26c4b7]/50"
              />
              <div>
                <h3 className="font-display font-black text-sm sm:text-base text-white">
                  {t('quran.sheikhName', { name: selectedReciter }) || t('quran.sheikh', { name: selectedReciter }) || `الشيخ ${selectedReciter}`}
                </h3>
                <p className="text-[11px] text-emerald-300 font-mono font-medium">
                  {t('quran.surahsOrdered', { count: filteredTracks.length }) || t('quran.surahsAvailableCount', { count: filteredTracks.length }) || `${filteredTracks.length} سورة متاحة`}
                </p>
              </div>
            </div>
          </div>

          {filteredTracks.length > 0 && (
            <button
              onClick={() => onSelectTrack(filteredTracks[0], filteredTracks)}
              className="px-3.5 py-1.5 rounded-lg bg-[#fdfbf7] hover:bg-white text-[#041d1a] font-display font-black text-xs brutal-border flex items-center gap-1.5 cursor-pointer transition-transform hover:scale-105"
            >
              <Play size={13} fill="currentColor" />
              <span>{t('quran.playFromSurah', { surah: getSurahName(filteredTracks[0]) || 'الفاتحة', name: getSurahName(filteredTracks[0]) || 'الفاتحة' }) || t('quran.playAllFromSurah', { name: getSurahName(filteredTracks[0]) || 'الفاتحة' }) || 'تشغيل الكل'}</span>
            </button>
          )}
        </div>
      )}

      {/* If no reciter is selected and no search: show top reciter selector bar */}
      {!selectedReciter && !searchQuery.trim() && (
        <div className={`p-4 sm:p-5 mb-5 rounded-2xl brutal-border ${
          isDark ? 'bg-[#0a231f] border-emerald-900' : 'bg-[#fdfbf7] border-[#082621]'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BookOpen size={20} className="text-[#26c4b7]" />
              <div>
                <h3 className={`text-sm sm:text-base font-display font-black ${isDark ? 'text-white' : 'text-[#082621]'}`}>
                  {t('quran.selectReciterTitle') || 'اختر القارئ للاستماع للمصحف كاملاً'}
                </h3>
                <p className="text-[11px] text-emerald-400/80 font-medium">
                  {t('quran.selectReciterSub') || 'أو تصفح كافة التلاوات والآيات المسجلة أدناه مباشرة'}
                </p>
              </div>
            </div>
            {setActiveTab && (
              <button
                onClick={() => setActiveTab('reciters')}
                className="text-xs text-[#26c4b7] hover:underline font-bold font-mono cursor-pointer shrink-0"
              >
                {t('quran.allReciters') || 'كافة القراء'} ({reciters.length}) →
              </button>
            )}
          </div>

          {/* Reciters Pills / Horizontal Scroll */}
          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-thin">
            {reciters.slice(0, 16).map((reciter, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedReciter(reciter.name)}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl brutal-border shrink-0 cursor-pointer transition-transform hover:scale-105 ${
                  isDark ? 'bg-[#0e2c26] hover:bg-[#143d35] text-white border-emerald-800' : 'bg-white hover:bg-[#e0f4f0] text-[#082621] border-[#082621]'
                }`}
              >
                <QuranReciterAvatar
                  src={reciter.cover}
                  name={reciter.name}
                  className="w-7 h-7 shrink-0"
                  showRing={false}
                />
                <span className="text-xs font-display font-bold group-hover:text-[#26c4b7]">{reciter.name}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/50 text-[#26c4b7] font-bold">
                  {reciter.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Library Section Header when no reciter is selected */}
      {!selectedReciter && (
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="font-display font-black text-xs sm:text-sm text-white">
              {searchQuery.trim() 
                ? (t('quran.searchResults') || 'نتائج البحث') 
                : (t('quran.allTracksTitle') || 'جميع التلاوات والآيات المسجلة')}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 font-mono text-[11px] font-bold border border-emerald-800/60">
              {filteredTracks.length}
            </span>
          </div>
          {filteredTracks.length > 0 && (
            <button
              onClick={() => onSelectTrack(filteredTracks[0], filteredTracks)}
              className="px-3 py-1 rounded-lg bg-[#26c4b7] hover:bg-[#17a398] text-[#041d1a] font-display font-black text-xs brutal-border flex items-center gap-1.5 cursor-pointer transition-transform hover:scale-105"
            >
              <Play size={12} fill="currentColor" />
              <span>{t('quran.playAllRecitations', { count: filteredTracks.length }) || 'تشغيل الكل'}</span>
            </button>
          )}
        </div>
      )}

      {/* Main Track List or Empty State */}
      {filteredTracks.length === 0 ? (
        <div className={`p-8 text-center rounded-xl brutal-border ${
          isDark ? 'bg-[#0f2421] border-emerald-900 text-white' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
        }`}>
          <BookOpen size={40} className="mx-auto mb-3 text-[#26c4b7] opacity-60" />
          <h3 className={`text-base font-bold mb-1 ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
            {t('quran.noSurahsFound') || 'لم يتم العثور على تلاوات'}
          </h3>
          <p className={`text-xs mb-4 ${isDark ? 'text-emerald-300/70' : 'text-zinc-600'}`}>
            {t('quran.importSurahHint') || 'يمكنك استيراد مصحف أو إضافة سور وآيات برابط مباشر'}
          </p>
          {openImportPlaylistModal && (
            <button
              onClick={openImportPlaylistModal}
              className="px-4 py-2 bg-[#26c4b7] text-black font-black text-xs rounded-lg brutal-border brutal-shadow-sm cursor-pointer"
            >
              {t('quran.importNow') || 'استيراد الآن'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filteredTracks.slice(0, visibleLimit).map((track, idx) => {
            const active = isTrackActive(track);
            const reciterName = getQuranReciterName(track, quranPlaylists);
            const cleanTitle = cleanQuranTrackTitle(track.title);
            const surahNum = getSurahNumber(track);
            const isAyah = track.isAyah || isAyahOrClip(track);
            const displayNum = isAyah 
              ? 'آية' 
              : (surahNum >= 1 && surahNum <= 114 ? surahNum : (idx + 1));

            return (
              <div
                key={track.id || track._id || idx}
                onClick={() => onSelectTrack(track, filteredTracks)}
                className={`group flex items-center justify-between p-2.5 rounded-xl brutal-border cursor-pointer transition-all ${
                  active
                    ? 'bg-[#17a398] text-[#041d1a] brutal-shadow-sm font-black'
                    : isDark
                      ? 'bg-[#0e221f] hover:bg-[#132c28] text-white border-emerald-950'
                      : 'bg-[#fdfbf7] hover:bg-white text-[#0b1110] border-[#082621]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-9 text-center font-mono text-xs font-bold shrink-0 ${
                    active 
                      ? 'text-[#041d1a]' 
                      : isDark 
                        ? 'text-emerald-400/80 group-hover:text-white' 
                        : 'text-zinc-600 group-hover:text-black'
                  }`}>
                    {active && isPlaying ? (
                      <Volume2 size={16} className="animate-pulse text-[#041d1a] mx-auto" />
                    ) : isAyah ? (
                      <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] border border-amber-500/40">
                        آية
                      </span>
                    ) : (
                      <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 font-mono text-[11px] border border-emerald-800/50">
                        {displayNum}
                      </span>
                    )}
                  </div>

                  {/* Cover */}
                  <div className="w-10 h-10 rounded-lg brutal-border overflow-hidden shrink-0 bg-[#041d1a] relative group/cover">
                    <QuranReciterAvatar
                      src={track.cover}
                      name={reciterName || track.title}
                      shape="rounded"
                      className="w-full h-full"
                      showRing={false}
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <Play size={14} fill="currentColor" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className={`text-xs sm:text-sm font-bold truncate leading-tight transition-colors ${
                        active 
                          ? 'text-[#041d1a]' 
                          : isDark 
                            ? 'text-white group-hover:text-[#26c4b7]' 
                            : 'text-[#0b1110] group-hover:text-[#0f756d]'
                      }`}>
                        {cleanTitle}
                      </h4>
                      {track.recitationVariation && (
                        <span className="px-1.5 py-0.2 rounded bg-[#26c4b7]/20 text-[#26c4b7] text-[10px] font-mono font-bold border border-[#26c4b7]/40 shrink-0">
                          {t('quran.recitationNum', { num: track.recitationVariation }) || `تلاوة ${track.recitationVariation}`}
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] truncate mt-0.5 font-medium ${
                      active 
                        ? 'text-[#041d1a]/80 font-bold' 
                        : isDark 
                          ? 'text-emerald-300/80' 
                          : 'text-[#084c41]'
                    }`}>
                      <span className="font-bold">{reciterName}</span>
                      {isAyah ? (
                        <span className="text-amber-300/90 font-medium">
                          {surahNum >= 1 && surahNum <= 114 
                            ? ` • ${t('quran.ayahFromSurah', { surah: getSurahName(surahNum) }) || `آية من سورة ${getSurahName(surahNum)}`}` 
                            : ` • ${t('quran.ayahOrClip') || 'آيات / مقطع خاشع'}`}
                        </span>
                      ) : (
                        <>
                          {surahNum >= 1 && surahNum <= 114 ? ` • ${t('quran.surahNum', { num: surahNum }) || `سورة رقم ${surahNum}`}` : ''}
                        </>
                      )}
                      {track.album && track.album !== 'القرآن الكريم' ? ` • ${cleanQuranTrackTitle(track.album)}` : ''}
                    </p>
                  </div>
                </div>

                {/* Actions & Duration */}
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <span className={`text-[11px] font-mono font-bold ${
                    active 
                      ? 'text-[#041d1a]' 
                      : isDark 
                        ? 'text-emerald-400/80' 
                        : 'text-zinc-600'
                  }`}>
                    {formatDuration(track.duration)}
                  </span>

                  {toggleLike && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleLike(track.id || track._id);
                      }}
                      className="p-1 rounded hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Heart 
                        size={16} 
                        className={track.liked ? 'text-red-500 fill-red-500' : active ? 'text-[#041d1a]' : isDark ? 'text-zinc-400' : 'text-zinc-500'} 
                      />
                    </button>
                  )}

                  <div className={`w-8 h-8 rounded-lg brutal-border flex items-center justify-center ${
                    active ? 'bg-[#041d1a] text-[#26c4b7]' : 'bg-[#26c4b7] text-[#041d1a]'
                  }`}>
                    <Play size={14} fill="currentColor" />
                  </div>
                </div>
              </div>
            );
          })}

          {filteredTracks.length > visibleLimit && (
            <div className="text-center pt-4 pb-2">
              <button
                onClick={() => setVisibleLimit((prev) => prev + 40)}
                className="px-6 py-2.5 bg-[#17a398] hover:bg-[#26c4b7] text-black font-mono font-black text-xs brutal-border brutal-shadow-sm cursor-pointer transition-transform hover:scale-105"
              >
                {t('quran.showMoreRecitations', { count: filteredTracks.length - visibleLimit }) || 'عرض المزيد'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default QuranSurahsTab;
