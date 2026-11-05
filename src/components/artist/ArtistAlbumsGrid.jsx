import React from 'react';
import { Disc, Play, Edit, Plus } from 'lucide-react';
import { useTranslation } from '../../context/PreferencesContext';

export default function ArtistAlbumsGrid({
  artistAlbums = [],
  isQuran = false,
  isAdmin = false,
  isDark = true,
  onOpenAlbum,
  onOpenAddAlbum,
  openEditAlbumModal
}) {
  const { t, isRTL } = useTranslation();

  if (artistAlbums.length === 0 && !isAdmin) {
    return null;
  }

  return (
    <div className={`brutal-border-thick brutal-shadow-lg p-4 sm:p-6 mb-6 sm:mb-8 rounded-xl ${
      isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#082621]'
    }`}>
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 mb-4 sm:mb-5 border-b-2 ${
        isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110] text-[#082621]'
      }`}>
        <div className="flex items-center gap-2">
          <Disc size={18} className="text-[#17a398] sm:w-5 sm:h-5 shrink-0" />
          <h2 className="text-base sm:text-lg font-mono font-black uppercase truncate">
            {isQuran ? t('profile.discographyRecitations') : t('profile.discography')}
          </h2>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3">
          <span className={`text-[10px] font-mono font-bold ${isDark ? 'text-zinc-400' : 'text-[#082621]/60'}`}>
            {isQuran ? t('profile.collectionsCount', { count: artistAlbums.length }) : t('profile.albumsCount', { count: artistAlbums.length })}
          </span>
          {isAdmin && (
            <button
              onClick={onOpenAddAlbum}
              className="brutal-btn flex items-center gap-1.5 px-2.5 sm:px-3 py-1 text-[10px] sm:text-[11px] font-mono font-black uppercase bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border rounded-lg cursor-pointer shrink-0"
              title={isQuran ? "Admin: Upload New Collection" : "Admin: Upload New Album"}
            >
              <Plus size={12} strokeWidth={3} />
              <span>{isQuran ? t('profile.addCollection') : t('profile.addAlbum')}</span>
            </button>
          )}
        </div>
      </div>

      {artistAlbums.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {artistAlbums.map((album) => (
            <div
              key={album.id || album.name}
              onClick={() => onOpenAlbum && onOpenAlbum(album)}
              className={`p-3 brutal-border brutal-shadow-sm rounded-xl cursor-pointer group transition-transform hover:-translate-y-1 ${
                isDark ? 'bg-[#182320] border-zinc-700 hover:bg-[#22332e]' : 'bg-[#ede5d3] border-black hover:bg-white'
              }`}
            >
              <div className="relative aspect-square mb-2.5 overflow-hidden rounded-lg brutal-border bg-black/10">
                <img
                  src={album.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600'}
                  alt={album.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600'; }}
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-[#f59e0b] text-black flex items-center justify-center brutal-border brutal-shadow-sm shadow-md">
                    <Play size={18} fill="currentColor" className="ml-0.5" />
                  </div>
                </div>
              </div>

              <h3 className={`font-display font-black text-xs sm:text-sm truncate group-hover:text-[#17a398] transition-colors ${
                isDark ? 'text-white' : 'text-[#0b1110]'
              }`}>
                {album.name}
              </h3>
              <div className="flex items-center justify-between mt-1 text-[10px] font-mono text-zinc-400">
                <span className="uppercase font-bold text-[#17a398]">{isQuran ? t('quran.collection') || 'مصحف' : t('common.albums')}</span>
                {album.trackCount > 0 && (
                  <span>{isQuran ? t('profile.surahsCount', { count: album.trackCount }) : t('profile.tracksCount', { count: album.trackCount })}</span>
                )}
              </div>

              {isAdmin && openEditAlbumModal && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openEditAlbumModal(album);
                  }}
                  className="w-full mt-2 py-1 px-2 bg-[#f59e0b] hover:bg-amber-400 text-black font-mono text-[10px] font-black uppercase brutal-border rounded-md flex items-center justify-center gap-1 cursor-pointer"
                  title={isQuran ? "Admin: Edit Collection" : "Admin: Edit Album"}
                >
                  <Edit size={11} />
                  <span>{isQuran ? t('profile.editCollection') : t('profile.editAlbum')}</span>
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className={`p-8 text-center font-mono text-xs rounded-xl brutal-border ${
          isDark ? 'bg-[#182320] border-zinc-700 text-zinc-400' : 'bg-white/60 border-black text-zinc-600'
        }`}>
          <p className="mb-3 font-medium">
            {isQuran ? t('profile.noCollections') : t('profile.noAlbums')}
          </p>
          <button
            onClick={onOpenAddAlbum}
            className="brutal-btn inline-flex items-center gap-1.5 px-4 py-2 text-xs font-mono font-black uppercase bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border rounded-lg cursor-pointer"
          >
            <Plus size={13} strokeWidth={3} />
            <span>{isQuran ? t('profile.uploadFirstCollection') : t('profile.uploadFirstAlbum')}</span>
          </button>
        </div>
      )}
    </div>
  );
}
