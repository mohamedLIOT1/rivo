import React from 'react';
import { BookOpen, Play } from 'lucide-react';
import { cleanQuranTrackTitle, getQuranReciterName } from '../../utils/quranUtils';

export const QuranPlaylistsTab = React.memo(function QuranPlaylistsTab({
  filteredPlaylists,
  quranPlaylists,
  onSelectPlaylist,
  openImportPlaylistModal,
  isDark,
  t,
}) {
  if (filteredPlaylists.length === 0) {
    return (
      <div className={`p-8 text-center rounded-xl brutal-border ${
        isDark ? 'bg-[#0f2421] border-emerald-900 text-white' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
      }`}>
        <BookOpen size={40} className="mx-auto mb-3 text-[#26c4b7] opacity-60" />
        <h3 className={`text-base font-bold mb-1 ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>{t('quran.noPlaylistsFound')}</h3>
        <p className={`text-xs mb-4 ${isDark ? 'text-emerald-300/70' : 'text-zinc-600'}`}>{t('quran.importPlaylistHint')}</p>
        {openImportPlaylistModal && (
          <button
            onClick={openImportPlaylistModal}
            className="px-4 py-2 bg-[#26c4b7] text-black font-black text-xs rounded-lg brutal-border brutal-shadow-sm cursor-pointer"
          >
            {t('quran.importNow')}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filteredPlaylists.map((pl, idx) => {
        const count = (pl.trackIds || []).length;
        const reciterName = getQuranReciterName(pl, quranPlaylists);

        return (
          <div
            key={pl.id || pl._id || idx}
            onClick={() => onSelectPlaylist(pl)}
            className={`rounded-2xl brutal-border p-3.5 flex flex-col justify-between cursor-pointer brutal-shadow hover:brutal-shadow-lg transition-all group ${
              isDark 
                ? 'bg-[#0e221f] border-emerald-900 hover:bg-[#132e2a]' 
                : 'bg-[#fdfbf7] border-[#082621] hover:bg-white'
            }`}
          >
            <div>
              <div className="w-full aspect-video rounded-xl brutal-border mb-3 overflow-hidden bg-black/20 relative">
                <img 
                  src={pl.cover || 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=600'} 
                  alt={pl.name} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=600'; }}
                />
                <span className="absolute bottom-2 right-2 text-[10px] font-mono font-black bg-[#041d1a]/90 text-[#26c4b7] px-2 py-0.5 rounded brutal-border border-emerald-800">
                  {count} {count > 100 ? (t('quran.surahsFull') || 'سورة (كامل)') : (t('quran.surahsShort') || 'سورة')}
                </span>
              </div>

              <h4 className={`font-display font-black text-sm line-clamp-1 transition-colors ${
                isDark 
                  ? 'text-white group-hover:text-[#26c4b7]' 
                  : 'text-[#0b1110] group-hover:text-[#0f756d]'
              }`}>
                {cleanQuranTrackTitle(pl.name)}
              </h4>
              <p className={`text-[11px] line-clamp-2 mt-1 font-medium ${
                isDark 
                  ? 'text-emerald-300/80' 
                  : 'text-[#0a3832]'
              }`}>
                {pl.description ? cleanQuranTrackTitle(pl.description) : t('quran.fullMushafBy', { reciter: reciterName })}
              </p>
            </div>

            <div className={`mt-3 pt-3 border-t flex items-center justify-between text-xs ${
              isDark ? 'border-emerald-900/60' : 'border-zinc-300'
            }`}>
              <span className={`font-mono text-[10px] font-bold ${
                isDark ? 'text-[#26c4b7]' : 'text-[#084c41]'
              }`}>
                Playlist
              </span>
              <div className="w-7 h-7 rounded-lg bg-[#26c4b7] text-[#041d1a] flex items-center justify-center font-bold">
                <Play size={12} fill="currentColor" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default QuranPlaylistsTab;
