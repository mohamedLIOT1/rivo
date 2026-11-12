import React from 'react';
import { Play, Sparkles, Clock, ListMusic, ChevronRight } from 'lucide-react';
import { normalizeCoverUrl, handleCoverImageError } from '../utils/coverUtils';

const AiMoodMixCard = React.memo(function AiMoodMixCard({
  playlistObj,
  tracks = [],
  resolvedMoodLabel,
  currentTrack,
  isDark = true,
  isRTL = false,
  onSelectPlaylist,
  onSelectTrack,
}) {
  if (!playlistObj || !Array.isArray(tracks) || tracks.length === 0) return null;

  const activeId = currentTrack ? String(currentTrack.id || currentTrack._id || '') : '';

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles size={19} className="text-[#26c4b7]" />
          <h2 className="font-display font-black text-xl text-[#fdfbf7] tracking-tight drop-shadow-[1.5px_1.5px_0px_#082621]">
            {isRTL ? 'مُختارات لك • قائمة ذكاء ريفو' : 'Made For You • AI Mood Mix'}
          </h2>
          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-[#0b1110] text-[#26c4b7] px-2.5 py-0.5 rounded-full brutal-border">
            <Clock size={10} />
            <span>{isRTL ? 'تتجدد كل 12 ساعة' : 'Refreshes every 12h'}</span>
          </span>
        </div>
      </div>

      <div
        onClick={() => onSelectPlaylist?.(playlistObj)}
        className={`p-4 sm:p-5 rounded-2xl brutal-border-thick brutal-shadow cursor-pointer group transition-transform hover:-translate-y-0.5 ${
          isDark ? 'bg-[#141d1b] border-zinc-700 hover:bg-[#182320]' : 'bg-[#fdfbf7] border-black hover:bg-white'
        }`}
      >
        <div className="flex flex-col md:flex-row gap-4 sm:gap-5 items-stretch md:items-center">
          {/* 2x2 Mosaic Cover Collage */}
          <div className="relative w-32 h-32 sm:w-36 sm:h-36 rounded-xl overflow-hidden brutal-border-thick brutal-shadow-sm shrink-0 bg-[#082621] self-center md:self-auto">
            <div className="w-full h-full grid grid-cols-2 grid-rows-2">
              {tracks.slice(0, 4).map((tr, idx) => (
                <img
                  key={`mix-mosaic-${tr.id || tr._id || idx}`}
                  src={normalizeCoverUrl(tr.cover, tr)}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={handleCoverImageError}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectTrack?.(tracks[0], tracks);
              }}
              title={isRTL ? 'تشغيل القائمة' : 'Play Playlist'}
              className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border brutal-shadow-sm flex items-center justify-center transition-transform group-hover:scale-105 cursor-pointer"
            >
              <Play size={17} fill="currentColor" className="ml-0.5" />
            </button>
          </div>

          {/* Playlist Summary & Actions */}
          <div className="flex-1 min-w-0 flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-[#17a398]/20 text-[#26c4b7] border border-[#17a398]/50">
                  <ListMusic size={11} />
                  <span>{isRTL ? 'قائمة تشغيل ذكية' : 'AI PLAYLIST'}</span>
                </span>
                <span className="text-[10px] font-mono font-bold text-zinc-400">
                  {resolvedMoodLabel} • {tracks.length} {isRTL ? 'أغاني' : 'tracks'}
                </span>
              </div>
              <h3 className={`font-display font-black text-lg sm:text-xl truncate group-hover:text-[#17a398] transition-colors ${
                isDark ? 'text-white' : 'text-[#0b1110]'
              }`}>
                {playlistObj.name}
              </h3>
              <p className={`text-xs font-medium truncate mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {playlistObj.description}
              </p>
            </div>

            {/* Compact Track Preview Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {tracks.slice(0, 6).map((tr, idx) => {
                const tid = String(tr?.id || tr?._id || '');
                const isActive = Boolean(activeId && tid && activeId === tid);
                return (
                  <div
                    key={`ai-row-${tid || idx}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTrack?.(tr, tracks);
                    }}
                    className={`flex items-center gap-2 px-2 py-1 rounded-lg border text-left transition-colors cursor-pointer ${
                      isActive
                        ? 'border-[#17a398] bg-[#17a398]/15'
                        : isDark
                          ? 'border-zinc-800 bg-zinc-900/70 hover:border-[#17a398]/60'
                          : 'border-[#ded2bb] bg-[#f7f2e7] hover:border-black'
                    }`}
                  >
                    <span className="text-[10px] font-mono font-bold text-[#17a398] w-4 shrink-0">{idx + 1}.</span>
                    <div className="min-w-0 flex-1">
                      <div className={`text-[11px] font-bold truncate ${isDark ? 'text-zinc-100' : 'text-[#0b1110]'}`}>
                        {tr.title}
                      </div>
                      <div className="text-[9px] text-zinc-400 truncate">{tr.artist}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Open Full Playlist CTA */}
          <div className="flex md:flex-col items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSelectTrack?.(tracks[0], tracks);
              }}
              className="px-4 py-2 rounded-xl brutal-border brutal-shadow-sm bg-[#17a398] hover:bg-[#26c4b7] text-[#082621] font-mono font-black text-xs uppercase cursor-pointer flex items-center gap-1.5"
            >
              <Play size={13} fill="currentColor" />
              <span>{isRTL ? 'تشغيل القائمة' : 'Play Playlist'}</span>
            </button>
            <span className={`inline-flex items-center gap-1 text-[11px] font-mono font-bold ${isDark ? 'text-zinc-400 group-hover:text-[#26c4b7]' : 'text-zinc-700'}`}>
              <span>{isRTL ? 'عرض القائمة كاملة' : 'Open Playlist'}</span>
              <ChevronRight size={13} className={isRTL ? 'rotate-180' : ''} />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
});

export default AiMoodMixCard;
