import React from 'react';

export default function LibraryMixesSection({
  mixPlaylists = [],
  tracks = [],
  isDark = true,
  isRTL = false,
  onSelectPlaylist
}) {
  if (!mixPlaylists || mixPlaylists.length === 0) return null;

  return (
    <div className="mb-7">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">🎛️</span>
        <h2 className={`text-sm font-black font-display text-[#17a398] uppercase tracking-wider ${isRTL ? 'font-sans' : ''}`}>
          {isRTL ? 'مكساتك الخاصة' : 'YOUR MIXES'}
        </h2>
        <span className="text-[10px] font-mono bg-[#17a398]/20 text-[#17a398] px-2 py-0.5 rounded-full font-bold">
          {mixPlaylists.length}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {mixPlaylists.map(mix => {
          const mixTrackIds = (mix.trackIds || []).map(String);
          const mixTracks = tracks.filter(t => mixTrackIds.includes(String(t.id || t._id)));
          const notDownloaded = mixTracks.filter(t => !t.downloaded).length;
          const isAllDownloaded = notDownloaded === 0 && mixTracks.length > 0;
          return (
            <div
              key={mix.id || mix._id}
              onClick={() => onSelectPlaylist(mix)}
              className={`group p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-3 brutal-shadow-sm hover:scale-[1.02] ${
                isDark ? 'bg-[#091714]' : 'bg-[#fdfbf7]'
              } ${
                notDownloaded > 0
                  ? 'border-[#f59e0b] hover:border-amber-400'
                  : 'border-[#17a398] hover:border-emerald-400'
              }`}
            >
              <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-black/40 border border-[#17a398]/30">
                <img
                  src={mix.cover || (mixTracks[0] ? mixTracks[0].cover : 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400')}
                  alt={mix.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
                <span className="absolute bottom-1 right-1 text-[8px] font-mono font-black bg-black/80 text-[#17a398] px-1 rounded">
                  🎛️
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-xs sm:text-sm truncate text-white group-hover:text-[#17a398]">
                    {mix.name}
                  </h3>
                  <span className="text-[8px] font-mono font-black bg-[#17a398] text-[#0b1110] px-1 py-0.2 rounded shrink-0">
                    {isRTL ? 'مكس' : 'MIX'}
                  </span>
                </div>
                <div className="text-[10px] mt-1 flex items-center gap-1.5 font-bold">
                  {isAllDownloaded ? (
                    <span className="text-[#17a398] flex items-center gap-1">
                      <span>✓</span> {isRTL ? 'تم تنزيل الكل' : 'ALL DOWNLOADED'}
                    </span>
                  ) : notDownloaded > 0 ? (
                    <span className="text-[#f59e0b] flex items-center gap-1">
                      <span>⬇</span> {notDownloaded} {isRTL ? 'مقاطع غير منزلة' : 'songs not downloaded'}
                    </span>
                  ) : (
                    <span className="text-zinc-400">
                      {mixTracks.length} {isRTL ? 'مقطع' : 'tracks'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
