import React from 'react';
import { Play, ListPlus, UserPlus, Check, Sparkles, Plus, Edit } from 'lucide-react';
import VerifiedBadge from '../VerifiedBadge';
import { useTranslation } from '../../context/PreferencesContext';

export default function ArtistHero({
  artistName,
  avatar,
  banner,
  aliasNote,
  isQuran,
  artistTracks = [],
  artistAlbums = [],
  totalPlays = 0,
  isFollowing,
  onToggleFollow,
  onPlayAll,
  onAddToQueue,
  jamSession,
  isAdmin,
  onOpenAddAlbum,
  onOpenEditArtist,
  isDark = true,
}) {
  const { t, isRTL } = useTranslation();
  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(artistName || 'Artist')}&background=082621&color=26c4b7&size=512&bold=true&format=svg`;

  return (
    <div className={`brutal-border-thick brutal-shadow-lg p-4 sm:p-6 md:p-8 mb-6 sm:mb-8 relative transition-colors rounded-xl overflow-hidden ${
      isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#082621]'
    }`}>
      {banner && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20 pointer-events-none"
          style={{ backgroundImage: `url(${banner})` }}
        />
      )}

      <div className="relative z-10 flex flex-col md:flex-row items-center md:items-end gap-4 sm:gap-6 pt-1 sm:pt-2">
        {/* Artist Photo */}
        <div className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 bg-[#ded2bb] brutal-border-thick brutal-shadow shrink-0 relative overflow-hidden rounded-xl">
          <img
            src={avatar || fallbackAvatar}
            alt={artistName}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.src = fallbackAvatar; }}
          />
        </div>

        <div className={`flex-1 ${isRTL ? 'text-center md:text-right' : 'text-center md:text-left'} min-w-0`}>
          <div className="inline-flex items-center gap-1.5 mb-1.5 sm:mb-2">
            <span className={`px-2 sm:px-2.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-mono font-black uppercase brutal-border ${
              isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
            }`}>
              {isQuran ? t('profile.verifiedReciter') : t('profile.verifiedArtist')}
            </span>
            <VerifiedBadge name={artistName} />
          </div>

          <h1 className={`text-2xl sm:text-3xl md:text-5xl font-display font-black leading-tight truncate ${
            isDark ? 'text-white' : 'text-[#082621]'
          }`}>
            {artistName}
          </h1>

          {aliasNote && (
            <div className="mt-1.5 sm:mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-md text-[10px] sm:text-[11px] font-mono font-bold bg-[#17a398]/15 text-[#17a398] brutal-border border-[#17a398]/40">
              <Sparkles size={12} className="shrink-0" />
              <span>{aliasNote}</span>
            </div>
          )}

          <div className={`flex flex-wrap items-center justify-center ${isRTL ? 'md:justify-start' : 'md:justify-start'} gap-2 sm:gap-3 mt-2 sm:mt-3 text-[11px] sm:text-xs font-mono font-bold ${
            isDark ? 'text-zinc-300' : 'text-[#082621]'
          }`}>
            <span className={`px-2 py-0.5 brutal-border rounded-md ${
              isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] border-black'
            }`}>
              {isQuran ? t('profile.surahsCount', { count: artistTracks.length }) : t('profile.tracksCount', { count: artistTracks.length })}
            </span>
            <span>•</span>
            <span className={`px-2 py-0.5 brutal-border rounded-md ${
              isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] border-black'
            }`}>
              {isQuran ? t('profile.collectionsCount', { count: artistAlbums.length }) : t('profile.albumsCount', { count: artistAlbums.length })}
            </span>
            {totalPlays > 0 && (
              <>
                <span>•</span>
                <span>{totalPlays.toLocaleString()} {isQuran ? t('profile.listensCount', { count: totalPlays }) : t('profile.playsCount', { count: totalPlays })}</span>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className={`flex flex-wrap items-center justify-center ${isRTL ? 'md:justify-start' : 'md:justify-start'} gap-2 sm:gap-3 mt-4 sm:mt-6 w-full`}>
            <button
              onClick={onPlayAll}
              disabled={artistTracks.length === 0}
              className="brutal-btn w-10 h-10 sm:w-12 sm:h-12 bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] brutal-border-thick brutal-shadow flex items-center justify-center cursor-pointer rounded-xl shrink-0 disabled:opacity-40"
              title={isQuran ? t('profile.playAllSurahs') : t('profile.playAllTracks')}
            >
              <Play size={18} fill="currentColor" className="ml-0.5 sm:w-5 sm:h-5 text-[#0b1110]" />
            </button>

            <button
              disabled={artistTracks.length === 0}
              onClick={onAddToQueue}
              className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-display font-black text-xs brutal-border brutal-shadow-sm brutal-btn flex items-center gap-1.5 sm:gap-2 transition-all shrink-0 ${
                artistTracks.length > 0
                  ? isDark 
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700 cursor-pointer' 
                    : 'bg-white hover:bg-[#ede5d3] text-black border-black cursor-pointer'
                  : 'opacity-40 cursor-not-allowed'
              }`}
              title={jamSession ? "Add to Jam Queue" : "Add to Queue"}
            >
              <ListPlus size={16} strokeWidth={2.5} className="text-[#26c4b7]" />
              <span>{jamSession ? t('profile.addToJam') : t('profile.queueAll')}</span>
            </button>

            <button
              onClick={onToggleFollow}
              className={`brutal-btn flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 text-[11px] sm:text-xs font-mono font-black uppercase brutal-border brutal-shadow-sm cursor-pointer rounded-xl ${
                isFollowing 
                  ? 'bg-[#17a398] text-[#0b1110] font-black' 
                  : isDark 
                    ? 'bg-zinc-800 text-zinc-200 border-zinc-700 hover:bg-zinc-700' 
                    : 'bg-[#ede5d3] text-[#082621] hover:bg-[#ded2bb] border-black'
              }`}
            >
              {isFollowing ? <Check size={13} strokeWidth={3} /> : <UserPlus size={13} strokeWidth={2.5} />}
              <span>{isFollowing ? t('profile.followActive') : t('profile.follow')}</span>
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={onOpenAddAlbum}
                  className="brutal-btn flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-mono font-black uppercase brutal-border brutal-shadow-sm cursor-pointer rounded-xl bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110]"
                  title={isQuran ? t('profile.addCollection') : t('profile.addAlbum')}
                >
                  <Plus size={13} strokeWidth={3} />
                  <span>{isQuran ? t('profile.addCollection') : t('profile.addAlbum')}</span>
                </button>

                <button
                  onClick={onOpenEditArtist}
                  className="brutal-btn flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-xs font-mono font-black uppercase brutal-border brutal-shadow-sm cursor-pointer rounded-xl bg-[#f59e0b] hover:bg-amber-400 text-black"
                  title={isQuran ? t('profile.editReciterPage') : t('profile.editArtistPage')}
                >
                  <Edit size={13} />
                  <span>{isQuran ? t('profile.editReciterPage') : t('profile.editArtistPage')}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
