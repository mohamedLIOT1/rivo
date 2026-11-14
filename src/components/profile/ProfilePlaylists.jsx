import React from 'react';
import { Music, Disc, Eye, EyeOff, Loader2 } from 'lucide-react';
import { isQuranContent } from '../../utils/quranUtils';

export default function ProfilePlaylists({
  localPlaylists = [],
  isDark,
  togglingId,
  handleToggleVisibility,
  onSelectPlaylist,
  t,
}) {
  const filtered = localPlaylists.filter(p => !p.isLikedSongs);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className={`font-display font-black text-xl tracking-tight ${
          isDark ? 'text-white' : 'text-[#fdfbf7] drop-shadow-[1.5px_1.5px_0px_#082621]'
        }`}>
          {t('profile.playlists')}
        </h2>
        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded brutal-border ${
          isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-[#fdfbf7] text-[#0b1110]'
        }`}>
          {t('profile.privacyHint')}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className={`text-center py-10 brutal-border rounded-xl p-4 ${
          isDark ? 'bg-[#141d1b] border-zinc-700 text-zinc-400' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
        }`}>
          <Music size={32} className="mx-auto mb-2 text-zinc-500" />
          <p className="text-xs font-bold">{t('profile.noPlaylistsCreated')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(pl => {
            const isPublic = pl.isPublic !== false;
            const isToggling = togglingId === pl.id;

            return (
              <div 
                key={pl.id} 
                className={`p-3 rounded-xl brutal-border flex items-center justify-between brutal-shadow-sm hover:brutal-shadow transition ${
                  isDark ? 'bg-[#141d1b] border-zinc-700 hover:bg-zinc-900' : 'bg-[#fdfbf7] border-black hover:bg-[#ede5d3]'
                }`}
              >
                {/* Cover & Title */}
                <button 
                  onClick={() => onSelectPlaylist && onSelectPlaylist(pl)}
                  className="flex items-center gap-3 text-left min-w-0 flex-1 cursor-pointer"
                >
                  <div className="w-11 h-11 rounded-lg bg-[#17a398] brutal-border shrink-0 flex items-center justify-center font-bold text-white overflow-hidden">
                    {pl.cover ? (
                      <img src={pl.cover} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <img 
                        src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400" 
                        alt="" 
                        className="w-full h-full object-cover" 
                      />
                    )}
                  </div>
                  <div className="truncate">
                    <p className={`font-display font-black text-xs truncate ${
                      isDark ? 'text-white' : 'text-[#0b1110]'
                    }`}>{pl.name}</p>
                    <p className={`text-[10px] font-bold ${
                      isDark ? 'text-zinc-400' : 'text-zinc-600'
                    }`}>
                      {(() => {
                        const isQ = Boolean(pl.isQuran || isQuranContent(pl));
                        const count = (pl.trackIds || []).length;
                        return `${count} ${isQ ? (count === 1 ? t('profile.surah') : t('profile.surahs')) : (count === 1 ? t('profile.song') : t('profile.songs'))}`;
                      })()}
                    </p>
                  </div>
                </button>

                {/* Visibility toggle button */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleVisibility(pl);
                    }}
                    disabled={isToggling}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg brutal-border text-[10px] font-bold cursor-pointer ${
                      isDark 
                        ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700' 
                        : 'bg-white border-black hover:bg-[#ede5d3] text-[#0b1110]'
                    }`}
                    title={isPublic ? t('profile.publicClickPrivate') : t('profile.privateClickPublic')}
                  >
                    {isToggling ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : isPublic ? (
                      <>
                        <Eye size={12} className="text-[#17a398]" />
                        <span>{t('profile.publicTag')}</span>
                      </>
                    ) : (
                      <>
                        <EyeOff size={12} className="text-zinc-400" />
                        <span>{t('profile.privateTag')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
