import React, { memo } from 'react';
import { Play, Pause, Heart, MoreVertical, Loader2 } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioContext';
import { normalizeCoverUrl } from '../utils/coverUtils';
import { ArtistLinks } from '../utils/artistUtils';

const HomeTrackCard = memo(function HomeTrackCard({

  track,
  index,
  isActive,
  isPlaying,
  isDark,
  color,
  onSelectTrack,
  toggleLike,
  onOpenActionMenu,
  onSelectArtist,
  t,
}) {
  const { isLoadingTrack } = useAudioPlayer();
  const durationFormatted = track.duration 
    ? `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}`
    : '3:45';

  return (
    <div 
      onClick={onSelectTrack}
      className={`rounded-xl brutal-border p-3 flex flex-col justify-between cursor-pointer brutal-shadow-sm hover:brutal-shadow transition ${
        isDark 
          ? 'bg-[#141d1b] hover:bg-[#1a2623] border-zinc-700' 
          : 'bg-[#fdfbf7] hover:bg-white text-[#0b1110]'
      } ${
        isActive ? (isDark ? 'ring-2 ring-[#17a398] bg-[#1a2623]' : 'ring-2 ring-[#0b1110] bg-white') : ''
      }`}
    >
      <div>
        <div 
          className="w-full aspect-square rounded-lg brutal-border mb-2.5 p-2 flex flex-col justify-between relative overflow-hidden shrink-0 shadow-inner"
          style={{ backgroundColor: color }}
        >
          {track.cover && (
            <img 
              src={normalizeCoverUrl(track.cover, track)} 
              alt={track.title} 
              loading="lazy"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover opacity-35" 
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <div className="flex justify-between items-center z-10">
            <span className="text-[8px] font-mono font-bold bg-black/70 px-1.5 py-0.5 rounded uppercase text-white">
              {t('home.hqAudio')}
            </span>
            <div className="flex items-center gap-1">
              {toggleLike && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLike(track.id || track._id);
                  }}
                  className="p-1 rounded bg-black/50 hover:bg-black text-white hover:text-[#dc2626] transition cursor-pointer"
                  title="Like"
                >
                  <Heart size={11} fill={track.liked ? '#dc2626' : 'none'} className={track.liked ? 'text-[#dc2626]' : ''} />
                </button>
              )}
              <span className="text-[9px] font-mono font-bold text-white bg-black/50 px-1 rounded">
                {durationFormatted}
              </span>
            </div>
          </div>

          <div className="z-10 text-center my-auto px-1">
            <div className="font-display font-black text-sm text-white drop-shadow-[1px_1px_0px_#000] truncate">
              {track.title ? track.title.split('(')[0] : t('home.untitled')}
            </div>
            <ArtistLinks
              track={track}
              onSelectArtist={onSelectArtist}
              className="text-[10px] text-white/90 font-bold truncate block"
              linkClassName="hover:underline cursor-pointer"
            />
          </div>

          <div className="z-10 text-[8px] font-mono bg-black/60 px-1.5 py-0.5 rounded text-center truncate text-emerald-300 font-bold">
            {track.genre || 'Egyptian Rx'}
          </div>
        </div>

        <div className={`font-display font-bold text-xs truncate ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
          {track.title}
        </div>
        <ArtistLinks
          track={track}
          onSelectArtist={onSelectArtist}
          className={`text-[10px] font-bold truncate mb-2 block ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
          linkClassName="hover:underline cursor-pointer"
        />
      </div>

      <div className="flex items-center gap-1.5 w-full">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onSelectTrack();
          }}
          className="flex-1 bg-[#ded2bb] hover:bg-[#17a398] text-[#0b1110] font-display font-black text-[11px] py-1.5 rounded-lg brutal-border brutal-shadow-sm brutal-btn flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {isActive && isLoadingTrack ? (
            <>
              <Loader2 size={12} className="animate-spin text-[#0b1110]" />
              <span>{t('home.loading') || 'Loading...'}</span>
            </>
          ) : isActive && isPlaying ? (
            <>
              <Pause size={12} fill="currentColor" />
              <span>{t('home.pause')}</span>
            </>
          ) : (
            <>
              <Play size={12} fill="currentColor" />
              <span>{t('home.play')}</span>
            </>
          )}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenActionMenu(track);
          }}
          className="p-1.5 rounded-lg bg-white hover:bg-[#17a398] text-zinc-700 hover:text-black brutal-border brutal-shadow-sm transition cursor-pointer shrink-0"
          title="Track options"
          aria-label="Track options"
        >
          <MoreVertical size={14} />
        </button>
      </div>
    </div>
  );
});

export default HomeTrackCard;
