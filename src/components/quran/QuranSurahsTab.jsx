import React from 'react';
import { Play, Volume2, Heart, BookOpen, ArrowRight } from 'lucide-react';
import {
  cleanQuranTrackTitle,
  getQuranReciterName,
  getSurahNumber,
  getSurahName,
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
              title="Back to all reciters"
            >
              <ArrowRight size={14} />
              <span>← {t('quran.backToReciters')}</span>
            </button>
            <div>
              <h3 className="font-display font-black text-sm sm:text-base text-white">
                {t('quran.sheikhName', { name: selectedReciter })}
              </h3>
              <p className="text-[11px] text-emerald-300 font-mono font-medium">
                {t('quran.surahsOrdered', { count: filteredTracks.length })}
              </p>
            </div>
          </div>

          {filteredTracks.length > 0 && (
            <button
              onClick={() => onSelectTrack(filteredTracks[0], filteredTracks)}
              className="px-3.5 py-1.5 rounded-lg bg-[#fdfbf7] hover:bg-white text-[#041d1a] font-display font-black text-xs brutal-border flex items-center gap-1.5 cursor-pointer transition-transform hover:scale-105"
            >
              <Play size={13} fill="currentColor" />
              <span>{t('quran.playFromSurah', { surah: getSurahName(filteredTracks[0]) || 'Start' })}</span>
            </button>
          )}
        </div>
      )}

      {/* If no reciter is selected and no search: show reciters selection */}
      {!selectedReciter && !searchQuery.trim() ? (
        <div className={`p-6 rounded-2xl brutal-border text-center ${
          isDark ? 'bg-[#0a231f] border-emerald-900' : 'bg-[#fdfbf7] border-[#082621]'
        }`}>
          <BookOpen size={42} className="mx-auto mb-3 text-[#26c4b7] opacity-80" />
          <h3 className="text-base sm:text-lg font-display font-black mb-1.5 text-white">
            {t('quran.selectReciterTitle')}
          </h3>
          <p className="text-xs text-emerald-200/80 mb-5 max-w-md mx-auto">
            {t('quran.selectReciterSub')}
          </p>

          {/* Reciters Quick Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-w-4xl mx-auto">
            {reciters.map((reciter, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setSelectedReciter(reciter.name);
                }}
                className={`p-3 rounded-xl brutal-border text-center cursor-pointer transition-all hover:scale-[1.03] group ${
                  isDark ? 'bg-[#0e2c26] border-emerald-800 hover:bg-[#143d35]' : 'bg-white border-[#082621]'
                }`}
              >
                <div className="w-14 h-14 rounded-full mx-auto mb-2 brutal-border overflow-hidden bg-[#041d1a] ring-2 ring-[#26c4b7]/40 group-hover:scale-105 transition-transform">
                  <img 
                    src={reciter.cover || 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=300'} 
                    alt={reciter.name} 
                    className="w-full h-full object-cover" 
                    onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=300'; }}
                  />
                </div>
                <h4 className="text-xs font-display font-black truncate text-white group-hover:text-[#26c4b7]">
                  {reciter.name}
                </h4>
                <p className="text-[10px] font-mono font-bold mt-0.5 text-[#26c4b7]">
                  {t('quran.surahCount', { count: reciter.count })}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : filteredTracks.length === 0 ? (
        <div className={`p-8 text-center rounded-xl brutal-border ${
          isDark ? 'bg-[#0f2421] border-emerald-900 text-white' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
        }`}>
          <BookOpen size={40} className="mx-auto mb-3 text-[#26c4b7] opacity-60" />
          <h3 className={`text-base font-bold mb-1 ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>{t('quran.noSurahsFound')}</h3>
          <p className={`text-xs mb-4 ${isDark ? 'text-emerald-300/70' : 'text-zinc-600'}`}>{t('quran.importSurahHint')}</p>
          {openImportPlaylistModal && (
            <button
              onClick={openImportPlaylistModal}
              className="px-4 py-2 bg-[#26c4b7] text-black font-black text-xs rounded-lg brutal-border brutal-shadow-sm cursor-pointer"
            >
              {t('quran.importNow')}
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
            const displayNum = (surahNum >= 1 && surahNum <= 114) ? surahNum : (idx + 1);

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
                  <div className={`w-8 text-center font-mono text-xs font-bold shrink-0 ${
                    active 
                      ? 'text-[#041d1a]' 
                      : isDark 
                        ? 'text-emerald-400/80 group-hover:text-white' 
                        : 'text-zinc-600 group-hover:text-black'
                  }`}>
                    {active && isPlaying ? (
                      <Volume2 size={16} className="animate-pulse text-[#041d1a] mx-auto" />
                    ) : (
                      <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-950/60 text-emerald-300 font-mono text-[11px] border border-emerald-800/50">
                        {displayNum}
                      </span>
                    )}
                  </div>

                  {/* Cover */}
                  <div className="w-10 h-10 rounded-lg brutal-border overflow-hidden shrink-0 bg-[#041d1a] relative">
                    <img 
                      src={track.cover || 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=300'} 
                      alt={track.title} 
                      className="w-full h-full object-cover" 
                      onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=300'; }}
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <Play size={14} fill="currentColor" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <h4 className={`text-xs sm:text-sm font-bold truncate leading-tight transition-colors ${
                      active 
                        ? 'text-[#041d1a]' 
                        : isDark 
                          ? 'text-white group-hover:text-[#26c4b7]' 
                          : 'text-[#0b1110] group-hover:text-[#0f756d]'
                    }`}>
                      {cleanTitle}
                    </h4>
                    <p className={`text-[11px] truncate mt-0.5 font-medium ${
                      active 
                        ? 'text-[#041d1a]/80 font-bold' 
                        : isDark 
                          ? 'text-emerald-300/80' 
                          : 'text-[#084c41]'
                    }`}>
                      <span className="font-bold">{reciterName}</span>
                      {surahNum >= 1 && surahNum <= 114 ? ` • ${t('quran.surahNum', { num: surahNum })}` : ''}
                      {track.album ? ` • ${cleanQuranTrackTitle(track.album)}` : ''}
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
                {t('quran.showMoreRecitations', { count: filteredTracks.length - visibleLimit })}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default QuranSurahsTab;
