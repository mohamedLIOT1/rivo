import React from 'react';

export default function LibraryPlaylistsGrid({
  playlists = [],
  activeSection = 'music',
  isRTL = false,
  onSelectPlaylist
}) {
  if (!playlists || playlists.length === 0) return null;

  return (
    <div className="mb-7">
      <h2 className={`text-sm font-black font-display text-emerald-300 uppercase tracking-wider mb-3 ${isRTL ? 'font-sans' : ''}`}>
        {activeSection === 'quran'
          ? (isRTL ? 'قوائم التلاوة والمصاحف' : 'Quran Playlists & Mushafs')
          : (isRTL ? 'قوائم التشغيل' : 'Playlists')}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
        {playlists.map(pl => {
          const count = (pl.trackIds || []).length;
          const fallbackCover = pl.isLikedSongs
            ? 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400'
            : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400';

          return (
            <div
              key={pl.id || pl._id}
              onClick={() => onSelectPlaylist(pl)}
              className="group p-3 rounded-xl border border-emerald-950/70 bg-[#091714] hover:bg-[#0d221d] hover:border-emerald-500/40 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-2.5 bg-black/40 border border-emerald-900/40">
                <img
                  src={pl.cover || fallbackCover}
                  alt={pl.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <span className={`absolute bottom-1.5 ${isRTL ? 'left-1.5' : 'right-1.5'} px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-bold text-emerald-300 ${isRTL ? 'font-sans' : 'font-mono'}`}>
                  {count} {isRTL ? 'مقطع' : (count === 1 ? 'track' : 'tracks')}
                </span>
              </div>
              <h3 className="font-bold text-xs truncate text-white group-hover:text-emerald-300">
                {pl.isLikedSongs && isRTL ? 'الأغاني المفضلة' : pl.name}
              </h3>
              <p className="text-[10px] text-emerald-300/70 truncate mt-0.5 font-medium">
                {pl.isLikedSongs
                  ? (isRTL ? 'المفضلة' : 'Favorites')
                  : (pl.description || (isRTL ? 'قائمة محفوظة' : 'Saved Playlist'))}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
