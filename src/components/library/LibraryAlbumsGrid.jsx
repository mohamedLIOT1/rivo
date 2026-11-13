import React from 'react';
import { Disc } from 'lucide-react';

export default function LibraryAlbumsGrid({
  albums = [],
  isDark = true,
  isRTL = false,
  onSelectPlaylist
}) {
  if (!albums || albums.length === 0) return null;

  return (
    <div className="mb-7">
      <div className="flex items-center gap-2 mb-3">
        <Disc size={18} className="text-[#17a398]" />
        <h2 className={`text-sm font-black font-display uppercase tracking-wider transition-colors ${
          isDark ? 'text-emerald-300' : 'text-[#082621]'
        } ${isRTL ? 'font-sans' : ''}`}>
          {isRTL ? 'الألبومات الرسمية' : 'Official Albums'}
        </h2>
        <span className="text-[10px] font-mono font-bold bg-[#0b1110] text-[#17a398] px-2 py-0.5 rounded-full brutal-border">
          {albums.length}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
        {albums.map((alb) => {
          const albumKey = alb.id || alb._id || alb.name;
          const fallbackCover = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400';
          const coverUrl = alb.cover || alb.coverUrl || fallbackCover;
          const artistName = alb.artist || (isRTL ? 'فنان غير محدد' : 'Various Artists');

          return (
            <div
              key={albumKey}
              onClick={() => onSelectPlaylist && onSelectPlaylist(alb)}
              className={`group p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                isDark
                  ? 'border-emerald-950/70 bg-[#091714] hover:bg-[#0d221d] hover:border-emerald-500/40'
                  : 'border-[#0b1110] bg-[#ede5d3] hover:bg-[#ded2bb] hover:border-[#082621]'
              }`}
            >
              <div className={`relative w-full aspect-square rounded-lg overflow-hidden mb-2.5 border ${
                isDark ? 'bg-black/40 border-emerald-900/40' : 'bg-black/10 border-[#0b1110]'
              }`}>
                <img
                  src={coverUrl}
                  alt={alb.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  onError={(e) => { e.target.src = fallbackCover; }}
                />
                <span className={`absolute bottom-1.5 ${isRTL ? 'left-1.5' : 'right-1.5'} px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  isDark ? 'bg-black/80 text-emerald-300' : 'bg-[#082621] text-[#26c4b7]'
                } ${isRTL ? 'font-sans' : 'font-mono'}`}>
                  {alb.tracks?.length || alb.trackIds?.length || 0} {isRTL ? 'تراك' : 'tracks'}
                </span>
              </div>
              <div className="truncate">
                <p className={`font-display font-black text-xs sm:text-sm truncate transition-colors ${
                  isDark ? 'text-white group-hover:text-emerald-300' : 'text-[#082621] group-hover:text-[#17a398]'
                }`}>
                  {alb.name}
                </p>
                <p className={`text-[11px] font-mono truncate mt-0.5 ${
                  isDark ? 'text-emerald-400/70' : 'text-[#082621]/70'
                }`}>
                  {artistName}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
