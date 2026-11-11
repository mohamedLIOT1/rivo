import React from 'react';
import { Play, Pause, GripVertical, MoreVertical, Trash2, X, ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { ArtistLinks } from '../../utils/artistUtils';
import { isQuranContent, cleanQuranTrackTitle, getQuranReciterName } from '../../utils/quranUtils';
import { normalizeCoverUrl, handleCoverImageError } from '../../utils/coverUtils';

const QueueTrackRow = React.memo(function QueueTrackRow({
  track,
  queueIdx,
  isDark = true,
  isActive = false,
  isPlaying = false,
  isLoadingTrack = false,
  isUserQueued = false,
  isAiItem = false,
  isPlayed = false,
  isDragging = false,
  isDragOver = false,
  canReorder = false,
  canRemove = false,
  isJam = false,
  showQuickMove = false,
  onSelectRow,
  onTogglePlay,
  onRemove,
  onMoveUp,
  onMoveDown,
  onOpenMenu,
  onSelectArtist,
  onDragOverRow,
  onDragLeaveRow,
  onDropRow,
  onDragStartRow,
  onDragEndRow,
  onTouchStartRow,
  onTouchMoveRow,
  onTouchEndRow,
}) {
  if (!track) return null;
  const isTrackQuran = isQuranContent(track);
  const title = isTrackQuran ? cleanQuranTrackTitle(track.title) : track.title;
  const subtitle = isTrackQuran ? getQuranReciterName(track) : (track.artist || 'Unknown Artist');

  return (
    <div
      data-queue-idx={queueIdx}
      onDragOver={
        canReorder
          ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              onDragOverRow?.(queueIdx);
            }
          : undefined
      }
      onDragLeave={canReorder ? () => onDragLeaveRow?.(queueIdx) : undefined}
      onDrop={
        canReorder
          ? (e) => {
              e.preventDefault();
              const fromIdx = Number(e.dataTransfer.getData('text/plain'));
              onDropRow?.(fromIdx, queueIdx);
            }
          : undefined
      }
      onClick={() => {
        if (isActive) {
          onTogglePlay?.();
        } else {
          onSelectRow?.(track, queueIdx);
        }
      }}
      className={`flex items-center gap-2.5 p-2 rounded-xl cursor-pointer transition-colors brutal-btn group select-none ${
        isDragging ? 'opacity-35 scale-[0.98]' : ''
      } ${
        isDragOver ? 'border-t-2 border-[#17a398] bg-[#17a398]/10 ring-2 ring-[#17a398]/40' : ''
      } ${
        isActive
          ? isDark
            ? 'bg-[#172824] border-2 border-[#26c4b7]/70 text-white shadow-[0_4px_16px_rgba(23,163,152,0.16)]'
            : 'bg-[#ede5d3] brutal-border brutal-shadow-sm'
          : isPlayed
          ? isDark
            ? 'bg-zinc-950/60 hover:bg-zinc-900 border border-zinc-800/70 text-zinc-400 opacity-75 hover:opacity-100'
            : 'bg-white/70 hover:bg-[#ede5d3] brutal-border opacity-75 hover:opacity-100'
          : isDark
          ? 'bg-zinc-900/80 hover:bg-zinc-800/90 border border-zinc-800 text-zinc-300'
          : 'bg-white hover:bg-[#ede5d3] brutal-border'
      }`}
    >
      {/* Cover + Hover/Active Play Overlay */}
      <div className="relative shrink-0">
        <img
          src={normalizeCoverUrl(track.cover, track)}
          alt={title || ''}
          loading="lazy"
          className="w-10 h-10 rounded-lg object-cover brutal-border bg-black"
          onError={handleCoverImageError}
        />
        {isActive ? (
          <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
            {isLoadingTrack ? (
              <Loader2 size={14} className="animate-spin text-[#26c4b7]" />
            ) : isPlaying ? (
              <Pause size={14} fill="currentColor" className="text-[#26c4b7]" />
            ) : (
              <Play size={14} fill="currentColor" className="text-[#26c4b7] ml-0.5" />
            )}
          </div>
        ) : (
          <div className="absolute inset-0 bg-black/45 rounded-lg opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
            <Play size={14} fill="currentColor" className="text-white ml-0.5" />
          </div>
        )}
      </div>

      {/* Track Title & Subtitle */}
      <div className="flex-1 min-w-0 pr-1">
        <div className="flex items-center gap-1.5">
          <p
            className={`text-xs truncate font-display font-black ${
              isActive ? 'text-[#26c4b7]' : isDark ? 'text-white' : 'text-[#0b1110]'
            }`}
          >
            {title}
          </p>
          {isUserQueued && !isActive && (
            <span className="shrink-0 px-1.5 py-0.2 rounded text-[8px] font-mono font-bold bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30">
              QUEUED
            </span>
          )}
          {isAiItem && !isUserQueued && (
            <span className="shrink-0 px-1 py-0.2 rounded text-[8px] font-mono font-bold bg-[#17a398]/15 text-[#17a398] border border-[#17a398]/30">
              AI
            </span>
          )}
        </div>
        {isTrackQuran ? (
          <span className={`text-[11px] truncate font-mono mt-0.5 block ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
            {subtitle}
          </span>
        ) : (
          <ArtistLinks
            track={track}
            onSelectArtist={onSelectArtist}
            className={`text-[11px] truncate font-sans mt-0.5 block ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
            linkClassName="hover:underline cursor-pointer"
          />
        )}
      </div>

      {/* Row Actions */}
      <div className="flex items-center gap-0.5 shrink-0">
        {isActive && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePlay?.();
            }}
            className="w-7 h-7 rounded-lg bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] flex items-center justify-center cursor-pointer mr-1"
            title={isPlaying ? 'Pause' : 'Play'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isLoadingTrack ? (
              <Loader2 size={13} className="animate-spin" />
            ) : isPlaying ? (
              <Pause size={13} fill="currentColor" />
            ) : (
              <Play size={13} fill="currentColor" className="ml-0.5" />
            )}
          </button>
        )}

        {showQuickMove && canReorder && !isActive && (
          <div className="hidden sm:flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp?.(queueIdx);
              }}
              className={`p-1 rounded-md cursor-pointer ${
                isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-500 hover:text-black hover:bg-[#ded2bb]'
              }`}
              title="Move up"
            >
              <ChevronUp size={14} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown?.(queueIdx);
              }}
              className={`p-1 rounded-md cursor-pointer ${
                isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-500 hover:text-black hover:bg-[#ded2bb]'
              }`}
              title="Move down"
            >
              <ChevronDown size={14} />
            </button>
          </div>
        )}

        {canRemove && !isActive && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove?.(queueIdx, track);
            }}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isJam
                ? isDark
                  ? 'text-zinc-400 hover:text-red-400'
                  : 'text-zinc-600 hover:text-red-600'
                : isDark
                ? 'text-zinc-500 hover:text-red-400 hover:bg-zinc-800 opacity-80 sm:opacity-0 sm:group-hover:opacity-100'
                : 'text-zinc-500 hover:text-red-600 hover:bg-[#ded2bb] opacity-80 sm:opacity-0 sm:group-hover:opacity-100'
            }`}
            title={isJam ? 'Remove from Jam Queue' : 'Remove from queue'}
          >
            {isJam ? <Trash2 size={14} /> : <X size={14} />}
          </button>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenMenu?.(track, queueIdx, isAiItem);
          }}
          className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
            isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-600 hover:text-black hover:bg-[#ded2bb]'
          }`}
          title="Track Options"
          aria-label="Track Options"
        >
          <MoreVertical size={15} />
        </button>

        {canReorder && !isActive && (
          <div
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              e.dataTransfer.setData('text/plain', String(queueIdx));
              e.dataTransfer.effectAllowed = 'move';
              onDragStartRow?.(queueIdx);
            }}
            onDragEnd={() => onDragEndRow?.()}
            onTouchStart={() => onTouchStartRow?.(queueIdx)}
            onTouchMove={(e) => onTouchMoveRow?.(e)}
            onTouchEnd={() => onTouchEndRow?.()}
            onClick={(e) => e.stopPropagation()}
            className={`p-1.5 rounded-lg transition-colors cursor-grab active:cursor-grabbing select-none touch-none ${
              isDark ? 'text-zinc-500 hover:text-[#26c4b7] hover:bg-zinc-800' : 'text-zinc-400 hover:text-[#17a398] hover:bg-[#ede5d3]'
            }`}
            title="Drag to reorder"
            aria-label="Drag to reorder"
          >
            <GripVertical size={15} />
          </div>
        )}
      </div>
    </div>
  );
});

export default QueueTrackRow;
