import React from 'react';
import { Disc, Heart } from 'lucide-react';

export default function LibraryTracksList({
  tracks = [],
  filter = 'all',
  activeSection = 'music',
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
      <h2 className={`text-sm font-black font-display text-emerald-300 uppercase tracking-wider mb-3 ${isRTL ? 'font-sans' : ''}`}>
        {headingText}
      </h2>

      {tracks.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-emerald-900/60 bg-[#091714]">
          <Disc size={36} className="mx-auto mb-2 text-emerald-400 opacity-60" />
          <p className="text-xs font-bold text-white mb-1">
            {isRTL ? 'لا توجد مقاطع محفوظة في هذا القسم بعد' : 'No saved tracks in this section yet'}
          </p>
          <p className="text-[11px] text-emerald-300/70">
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
              className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl border border-emerald-950/60 bg-[#091714] hover:bg-[#0c201b] hover:border-emerald-500/40 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-mono font-bold text-emerald-500/60 w-5 text-center">
                  {idx + 1}
                </span>
                <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-emerald-900/40 bg-black/30">
                  <img src={t.cover} alt={t.title} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold truncate text-white group-hover:text-emerald-300">
                    {t.title}
                  </h4>
                  <p className="text-[11px] text-emerald-300/70 truncate mt-0.5">
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
                    className="p-1 text-zinc-500 hover:text-red-500 cursor-pointer"
                    title={isRTL ? 'إعجاب' : 'Like'}
                  >
                    <Heart size={15} />
                  </button>
                )}
                <span className="text-[10px] font-mono text-emerald-400/70 hidden sm:inline">
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
