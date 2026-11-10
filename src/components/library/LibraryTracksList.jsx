import React from 'react';
import { Disc, Heart } from 'lucide-react';

export default function LibraryTracksList({
  tracks = [],
  filter = 'all',
  activeSection = 'music',
  isDark = true,
  isRTL = false,
  onSelectTrack,
  toggleLike
}) {
  const headingText = filter === 'downloads'
    ? (isRTL ? 'المقاطع المحفوظة أوفلاين' : 'Offline Downloaded Tracks')
    : (activeSection === 'quran'
        ? (isRTL ? 'التلاوات المحفوظة' : 'Saved Recitations')
        : (isRTL ? 'مقاطع القوائم المحفوظة' : 'Saved Playlist Tracks'));

  return (
    <div>
      <h2 className={`text-sm font-black font-display uppercase tracking-wider mb-3 transition-colors ${
        isDark ? 'text-emerald-300' : 'text-[#082621]'
      } ${isRTL ? 'font-sans' : ''}`}>
        {headingText}
      </h2>

      {tracks.length === 0 ? (
        <div className={`p-8 text-center rounded-2xl border transition-colors ${
          isDark ? 'border-emerald-900/60 bg-[#091714]' : 'border-[#0b1110] bg-[#ede5d3]'
        }`}>
          <Disc size={36} className={`mx-auto mb-2 opacity-60 ${isDark ? 'text-emerald-400' : 'text-[#17a398]'}`} />
          <p className={`text-xs font-bold mb-1 transition-colors ${isDark ? 'text-white' : 'text-[#082621]'}`}>
            {isRTL ? 'لا توجد مقاطع محفوظة في هذا القسم بعد' : 'No saved tracks in this section yet'}
          </p>
          <p className={`text-[11px] transition-colors ${isDark ? 'text-emerald-300/70' : 'text-[#082621]/70'}`}>
            {isRTL
              ? 'أعجب بالأغاني أو أضفها إلى قوائم التشغيل لتنظيمها في مكتبتك'
              : 'Like songs or add them to playlists to organize them in your library'}
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {tracks.slice(0, 50).map((t, idx) => (
            <div
              key={t.id || t._id || idx}
              onClick={() => onSelectTrack && onSelectTrack(t, tracks)}
              className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer group ${
                isDark 
                  ? 'border-emerald-950/60 bg-[#091714] hover:bg-[#0c201b] hover:border-emerald-500/40' 
                  : 'border-[#0b1110] bg-[#ede5d3] hover:bg-[#ded2bb] hover:border-[#082621]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`text-xs font-mono font-bold w-5 text-center ${
                  isDark ? 'text-emerald-500/60' : 'text-[#082621]/60'
                }`}>
                  {idx + 1}
                </span>
                <div className={`w-10 h-10 rounded-lg overflow-hidden shrink-0 border ${
                  isDark ? 'border-emerald-900/40 bg-black/30' : 'border-[#0b1110] bg-black/10'
                }`}>
                  <img src={t.cover} alt={t.title} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <h4 className={`text-xs sm:text-sm font-bold truncate transition-colors ${
                    isDark ? 'text-white group-hover:text-emerald-300' : 'text-[#082621] group-hover:text-black'
                  }`}>
                    {t.title}
                  </h4>
                  <p className={`text-[11px] truncate mt-0.5 transition-colors ${
                    isDark ? 'text-emerald-300/70' : 'text-[#082621]/70'
                  }`}>
                    {t.artist}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {toggleLike && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLike(t.id || t._id);
                    }}
                    className={`p-1 hover:text-red-500 cursor-pointer ${
                      isDark ? 'text-zinc-500' : 'text-[#082621]/60'
                    }`}
                    title={isRTL ? 'إعجاب' : 'Like'}
                  >
                    <Heart size={15} />
                  </button>
                )}
                <span className={`text-[10px] font-mono hidden sm:inline ${
                  isDark ? 'text-emerald-400/70' : 'text-[#082621]/70'
                }`}>
                  {t.album || ''}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
