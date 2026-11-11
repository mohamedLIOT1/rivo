import React, { useState, useMemo, useCallback } from 'react';
import { Sparkles, Repeat, Repeat1, Shuffle, ChevronDown, ChevronRight, ListMusic, Trash2 } from 'lucide-react';
import { useTranslation } from '../../context/PreferencesContext';
import { splitQueueSections, resolveQueueContextLabel, getTrackId } from '../../context/audio/webQueueUtils';
import QueueTrackRow from './QueueTrackRow';

const INITIAL_CONTEXT_RENDER_LIMIT = 40;

const WebQueuePanel = React.memo(function WebQueuePanel({
  displayQueue = [],
  currentTrack = null,
  currentQueueIndex = -1,
  queueContext = null,
  selectedPlaylist = null,
  isPlaying = false,
  isLoadingTrack = false,
  isDark = true,
  isCurQuran = false,
  isCurRadio = false,
  isCurPodcast = false,
  isShuffle = false,
  repeatMode = 'off',
  isRepeat = false,
  jamSession = null,
  onTogglePlay,
  onQueueTrackClick,
  onReorderQueue,
  onMoveQueueItem,
  onRemoveFromQueue,
  onRemoveFromJamQueue,
  onClearManualQueue,
  onClearQueue,
  onOpenTrackMenu,
  onSelectArtist,
  onShowToast,
}) {
  const { language } = useTranslation();
  const isAr = language === 'ar';

  const [draggedQueueIdx, setDraggedQueueIdx] = useState(null);
  const [dragOverQueueIdx, setDragOverQueueIdx] = useState(null);
  const [showAllContext, setShowAllContext] = useState(false);
  const [showPlayedHistory, setShowPlayedHistory] = useState(false);

  const { activeIndex, nowPlaying, played, manualQueue, contextQueue, aiQueue } = useMemo(
    () => splitQueueSections(displayQueue, currentQueueIndex, currentTrack),
    [displayQueue, currentQueueIndex, currentTrack]
  );

  const contextLabel = useMemo(
    () =>
      resolveQueueContextLabel({
        queue: displayQueue,
        queueContext,
        selectedPlaylist,
        currentTrack,
        contextQueue,
        aiQueue,
        isCurQuran,
        isCurRadio,
        isCurPodcast,
        jamSession,
        language,
      }),
    [displayQueue, queueContext, selectedPlaylist, currentTrack, contextQueue, aiQueue, isCurQuran, isCurRadio, isCurPodcast, jamSession, language]
  );

  const visibleContextQueue = useMemo(() => {
    if (showAllContext || contextQueue.length <= INITIAL_CONTEXT_RENDER_LIMIT) return contextQueue;
    return contextQueue.slice(0, INITIAL_CONTEXT_RENDER_LIMIT);
  }, [contextQueue, showAllContext]);

  const visiblePlayed = useMemo(() => {
    if (played.length <= 30) return played;
    return played.slice(-30);
  }, [played]);

  const canReorder = Boolean(onReorderQueue && displayQueue.length > 1);
  const canRemove = Boolean((jamSession && onRemoveFromJamQueue) || onRemoveFromQueue);

  const handleDragOverRow = useCallback((idx) => {
    setDragOverQueueIdx((prev) => (prev === idx ? prev : idx));
  }, []);

  const handleDragLeaveRow = useCallback((idx) => {
    setDragOverQueueIdx((prev) => (prev === idx ? null : prev));
  }, []);

  const handleDropRow = useCallback(
    (fromIdx, toIdx) => {
      if (!isNaN(fromIdx) && fromIdx !== toIdx && onReorderQueue) {
        onReorderQueue(fromIdx, toIdx);
        onShowToast?.(isAr ? 'تم إعادة ترتيب القائمة' : 'Queue reordered');
      }
      setDraggedQueueIdx(null);
      setDragOverQueueIdx(null);
    },
    [onReorderQueue, onShowToast, isAr]
  );

  const handleDragEndRow = useCallback(() => {
    setDraggedQueueIdx(null);
    setDragOverQueueIdx(null);
  }, []);

  const handleTouchMoveRow = useCallback((e) => {
    const touch = e.touches?.[0];
    if (!touch) return;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const queueRow = el?.closest('[data-queue-idx]');
    if (queueRow) {
      const targetIdx = Number(queueRow.getAttribute('data-queue-idx'));
      if (!isNaN(targetIdx)) {
        setDragOverQueueIdx((prev) => (prev === targetIdx ? prev : targetIdx));
      }
    }
  }, []);

  const handleTouchEndRow = useCallback(() => {
    if (draggedQueueIdx !== null && dragOverQueueIdx !== null && draggedQueueIdx !== dragOverQueueIdx) {
      onReorderQueue?.(draggedQueueIdx, dragOverQueueIdx);
      onShowToast?.(isAr ? 'تم إعادة ترتيب القائمة' : 'Queue reordered');
    }
    setDraggedQueueIdx(null);
    setDragOverQueueIdx(null);
  }, [draggedQueueIdx, dragOverQueueIdx, onReorderQueue, onShowToast, isAr]);

  const handleRemoveRow = useCallback(
    (idx, track) => {
      if (jamSession && onRemoveFromJamQueue) {
        onRemoveFromJamQueue(idx, getTrackId(track));
        onShowToast?.(isAr ? 'تمت الإزالة من قائمة جام' : 'Removed from Jam queue');
      } else if (onRemoveFromQueue) {
        onRemoveFromQueue(idx);
        onShowToast?.(isAr ? 'تمت الإزالة من قائمة الانتظار' : 'Removed from queue');
      }
    },
    [jamSession, onRemoveFromJamQueue, onRemoveFromQueue, onShowToast, isAr]
  );

  const handleMoveUp = useCallback(
    (idx) => {
      if (onMoveQueueItem) {
        onMoveQueueItem(idx, 'up');
      } else if (onReorderQueue && idx > 0) {
        onReorderQueue(idx, idx - 1);
      }
    },
    [onMoveQueueItem, onReorderQueue]
  );

  const handleMoveDown = useCallback(
    (idx) => {
      if (onMoveQueueItem) {
        onMoveQueueItem(idx, 'down');
      } else if (onReorderQueue && idx < displayQueue.length - 1) {
        onReorderQueue(idx, idx + 1);
      }
    },
    [onMoveQueueItem, onReorderQueue, displayQueue.length]
  );

  const renderRow = (item, opts = {}) => {
    const { track, index } = item;
    const isActive = index === activeIndex;
    const key = track._queueUid || `${getTrackId(track)}-${index}`;
    return (
      <QueueTrackRow
        key={key}
        track={track}
        queueIdx={index}
        isDark={isDark}
        isActive={isActive}
        isPlaying={isPlaying}
        isLoadingTrack={isLoadingTrack}
        isUserQueued={Boolean(opts.isUserQueued || track._isUserQueued)}
        isAiItem={Boolean(opts.isAiItem)}
        isPlayed={Boolean(opts.isPlayed)}
        isDragging={draggedQueueIdx === index}
        isDragOver={dragOverQueueIdx === index && draggedQueueIdx !== index}
        canReorder={canReorder && !opts.isPlayed}
        canRemove={canRemove}
        isJam={Boolean(jamSession)}
        showQuickMove={Boolean(opts.showQuickMove)}
        onSelectRow={onQueueTrackClick}
        onTogglePlay={onTogglePlay}
        onRemove={handleRemoveRow}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        onOpenMenu={onOpenTrackMenu}
        onSelectArtist={onSelectArtist}
        onDragOverRow={handleDragOverRow}
        onDragLeaveRow={handleDragLeaveRow}
        onDropRow={handleDropRow}
        onDragStartRow={setDraggedQueueIdx}
        onDragEndRow={handleDragEndRow}
        onTouchStartRow={setDraggedQueueIdx}
        onTouchMoveRow={handleTouchMoveRow}
        onTouchEndRow={handleTouchEndRow}
      />
    );
  };

  return (
    <div className="flex-1 overflow-y-auto space-y-5 pb-24 select-none pr-1 min-h-0 w-full" style={{ scrollbarWidth: 'thin' }}>
      {/* Jam Session Notice */}
      {jamSession && (
        <div className="p-3 bg-[#17a398]/10 border-2 border-[#17a398] rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#17a398]" />
            <p className={`text-xs font-mono font-bold uppercase ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
              Jam Queue — {displayQueue.length}
            </p>
          </div>
          <span className="text-[10px] font-mono font-black bg-[#0b1110] text-[#26c4b7] px-2 py-0.5 rounded brutal-border">
            PIN: {jamSession.code}
          </span>
        </div>
      )}

      {/* Playback Mode Status Pills */}
      {(repeatMode !== 'off' || isShuffle) && (
        <div className="flex items-center gap-2 flex-wrap">
          {isShuffle && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-[#17a398]/15 text-[#26c4b7] border border-[#17a398]/35">
              <Shuffle size={11} />
              {isShuffle === 'smart'
                ? isAr ? 'خلط ذكي' : 'SMART SHUFFLE'
                : isAr ? 'تشغيل عشوائي' : 'SHUFFLE ON'}
            </span>
          )}
          {repeatMode !== 'off' && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-black ${
                repeatMode === 'one'
                  ? 'bg-[#26c4b7]/20 text-[#26c4b7] border border-[#26c4b7]/40'
                  : 'bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40'
              }`}
            >
              {repeatMode === 'one' ? <Repeat1 size={11} /> : <Repeat size={11} />}
              {repeatMode === 'one'
                ? isAr ? 'تكرار المقطع الحالي' : 'REPEAT ONE'
                : isAr ? 'تكرار القائمة' : 'REPEAT ALL'}
            </span>
          )}
        </div>
      )}

      {/* SECTION 1: NOW PLAYING */}
      {nowPlaying && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[11px] font-mono font-black uppercase tracking-wider ${isDark ? 'text-[#26c4b7]' : 'text-[#082621]'}`}>
              {isAr ? 'قيد التشغيل الآن' : 'Now Playing'}
            </span>
          </div>
          {renderRow(nowPlaying)}
        </div>
      )}

      {/* SECTION 2: NEXT IN QUEUE (User-Queued Tracks) */}
      {manualQueue.length > 0 && (
        <div>
          <div className={`flex items-center justify-between pb-1.5 border-b border-dashed ${isDark ? 'border-zinc-800' : 'border-[#ded2bb]'} mb-2.5`}>
            <span className={`text-[11px] font-mono font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
              {isAr ? `التالي في قائمة الانتظار (${manualQueue.length})` : `Next in Queue (${manualQueue.length})`}
            </span>
            {onClearManualQueue && (
              <button
                type="button"
                onClick={() => {
                  onClearManualQueue();
                  onShowToast?.(isAr ? 'تم مسح قائمة الانتظار المضافة' : 'Cleared queued songs');
                }}
                className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  isDark ? 'text-zinc-400 hover:text-red-400 hover:bg-zinc-800' : 'text-zinc-600 hover:text-red-600 hover:bg-[#ede5d3]'
                }`}
              >
                <Trash2 size={11} />
                <span>{isAr ? 'مسح الانتظار' : 'Clear queue'}</span>
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {manualQueue.map((item) => renderRow(item, { isUserQueued: true, showQuickMove: true }))}
          </div>
        </div>
      )}

      {/* SECTION 3: NEXT FROM CONTEXT (Playlist / Album / Artist / Radio) */}
      {contextQueue.length > 0 && (
        <div>
          <div className={`flex items-center justify-between pb-1.5 border-b border-dashed ${isDark ? 'border-zinc-800' : 'border-[#ded2bb]'} mb-2.5 gap-2`}>
            <span className={`text-[11px] font-mono font-black uppercase tracking-wider truncate ${isDark ? 'text-zinc-300' : 'text-zinc-800'}`}>
              {isAr ? `التالي من: ${contextLabel}` : `Next From: ${contextLabel}`} ({contextQueue.length})
            </span>
            {onClearQueue && manualQueue.length === 0 && (
              <button
                type="button"
                onClick={() => {
                  onClearQueue();
                  onShowToast?.(isAr ? 'تم مسح القائمة القادمة' : 'Upcoming queue cleared');
                }}
                className={`shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  isDark ? 'text-zinc-400 hover:text-red-400 hover:bg-zinc-800' : 'text-zinc-600 hover:text-red-600 hover:bg-[#ede5d3]'
                }`}
              >
                {isAr ? 'مسح' : 'Clear'}
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {visibleContextQueue.map((item) => renderRow(item))}
          </div>
          {!showAllContext && contextQueue.length > INITIAL_CONTEXT_RENDER_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAllContext(true)}
              className={`mt-2.5 w-full py-2 rounded-xl text-xs font-mono font-bold cursor-pointer transition-colors ${
                isDark
                  ? 'bg-zinc-900 hover:bg-zinc-800 text-[#26c4b7] border border-zinc-800'
                  : 'bg-[#ede5d3] hover:bg-[#ded2bb] text-[#082621] brutal-border'
              }`}
            >
              {isAr
                ? `عرض باقي القائمة (${contextQueue.length - INITIAL_CONTEXT_RENDER_LIMIT} مقطع)`
                : `Show all ${contextQueue.length} upcoming tracks`}
            </button>
          )}
        </div>
      )}

      {/* SECTION 4: AI DISCOVERY */}
      {aiQueue.length > 0 && (
        <div>
          <div className={`flex items-center justify-between pb-1.5 border-b border-dashed ${isDark ? 'border-zinc-800' : 'border-[#ded2bb]'} mb-2.5`}>
            <div className="flex items-center gap-1.5 flex-wrap">
              <Sparkles size={13} className="text-[#26c4b7]" />
              <span className={`text-[11px] font-mono font-black uppercase tracking-wider ${isDark ? 'text-[#26c4b7]' : 'text-[#082621]'}`}>
                {isAr ? `مقترحات ذكية (${aiQueue.length})` : `AI Suggestions (${aiQueue.length})`}
              </span>
              {isRepeat ? (
                <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/30">
                  {isAr ? 'متوقف مؤقتاً (التكرار مفعل)' : 'Paused (Repeat active)'}
                </span>
              ) : (
                <span className="text-[9px] font-mono font-bold text-[#17a398] bg-[#17a398]/10 px-1.5 py-0.5 rounded border border-[#17a398]/30">
                  {isAr ? 'يعمل تلقائياً' : 'Autoplay'}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            {aiQueue.map((item) => renderRow(item, { isAiItem: true }))}
          </div>
        </div>
      )}

      {/* SECTION 5: PREVIOUSLY PLAYED (Collapsible) */}
      {visiblePlayed.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowPlayedHistory((v) => !v)}
            className={`w-full flex items-center justify-between py-1.5 px-2 rounded-lg text-[11px] font-mono font-bold uppercase tracking-wider cursor-pointer transition-colors ${
              isDark ? 'text-zinc-400 hover:text-white hover:bg-zinc-900' : 'text-zinc-600 hover:text-black hover:bg-[#ede5d3]'
            }`}
          >
            <span className="flex items-center gap-1.5">
              {showPlayedHistory ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span>{isAr ? `تم تشغيلها سابقاً (${played.length})` : `Played Earlier (${played.length})`}</span>
            </span>
          </button>
          {showPlayedHistory && (
            <div className="space-y-1.5 mt-2">
              {visiblePlayed.map((item) => renderRow(item, { isPlayed: true }))}
            </div>
          )}
        </div>
      )}

      {displayQueue.length === 0 && (
        <div className={`py-12 text-center text-xs font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
          <ListMusic size={28} className="mx-auto mb-2 opacity-60" />
          <p className="font-bold">{isAr ? 'قائمة الانتظار فارغة حالياً.' : 'The queue is currently empty.'}</p>
          <p className="mt-1 text-zinc-500">
            {isCurQuran
              ? isAr ? 'أضف سوراً من مكتبة القرآن.' : 'Add surahs from the Quran library.'
              : isAr ? 'أضف أغاني عبر "إضافة إلى القائمة" أو "تشغيل التالي".' : 'Use "Add to Queue" or "Play Next" on any track.'}
          </p>
        </div>
      )}
    </div>
  );
});

export default WebQueuePanel;
