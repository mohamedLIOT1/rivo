import React, { useState, useRef, useEffect } from 'react';
import {
  MoreVertical,
  Edit2,
  Globe,
  Lock,
  Download,
  ListPlus,
  SlidersHorizontal,
  Trash2,
  Check,
  Loader2
} from 'lucide-react';

export default function PlaylistActionMenu({
  playlist,
  isOwner,
  isAdmin,
  isDark,
  isRTL,
  t,
  onEdit,
  onDelete,
  onTogglePrivacy,
  isTogglingPrivacy,
  onQueueAll,
  onDownloadAll,
  isDownloadingAll,
  downloadStats,
  allDownloaded,
  canBeMix,
  isMixActive,
  onToggleMix,
  jamSession,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const isPublic = playlist?.isPublic !== false;

  return (
    <div className="relative inline-block" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-10 h-10 sm:w-12 sm:h-12 brutal-border-thick brutal-shadow flex items-center justify-center transition-all cursor-pointer shrink-0 ${
          isDark
            ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 border-zinc-700'
            : 'bg-white hover:bg-[#ede5d3] text-black border-black'
        } ${isOpen ? 'ring-2 ring-[#17a398]' : ''}`}
        title={isRTL ? 'خيارات إضافية' : 'More Options'}
        aria-label="More Options"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <MoreVertical size={18} className="sm:w-5 sm:h-5" />
      </button>

      {isOpen && (
        <div
          className={`absolute top-full mt-2 z-50 w-56 sm:w-64 rounded-xl brutal-border brutal-shadow-lg p-1.5 flex flex-col gap-1 transition-all ${
            isRTL ? 'left-0' : 'right-0'
          } ${
            isDark
              ? 'bg-[#141d1b] border-zinc-700 text-zinc-100 shadow-2xl shadow-black/80'
              : 'bg-[#fdfbf7] border-black text-[#082621] shadow-2xl'
          }`}
        >
          {/* Edit Details (Owner / Admin) */}
          {(isOwner || isAdmin) && !playlist?.isLikedSongs && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onEdit?.();
              }}
              className={`w-full px-3 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
                isDark ? 'hover:bg-zinc-800/80 text-zinc-200' : 'hover:bg-[#ede5d3] text-[#082621]'
              } ${isRTL ? 'flex-row-reverse text-right' : ''}`}
            >
              <Edit2 size={15} className="text-[#17a398] shrink-0" />
              <span>{playlist?.isAlbum ? (isRTL ? 'تعديل الألبوم' : 'Edit Album') : (isRTL ? 'تعديل القائمة' : 'Edit Details')}</span>
            </button>
          )}

          {/* Visibility Toggle (Public / Private) */}
          {isOwner && !playlist?.isLikedSongs && !playlist?.isAlbum && (
            <button
              type="button"
              disabled={isTogglingPrivacy}
              onClick={() => {
                onTogglePrivacy?.();
              }}
              className={`w-full px-3 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
                isDark ? 'hover:bg-zinc-800/80 text-zinc-200' : 'hover:bg-[#ede5d3] text-[#082621]'
              } ${isRTL ? 'flex-row-reverse text-right' : ''}`}
            >
              {isTogglingPrivacy ? (
                <Loader2 size={15} className="animate-spin text-[#17a398] shrink-0" />
              ) : isPublic ? (
                <Globe size={15} className="text-[#17a398] shrink-0" />
              ) : (
                <Lock size={15} className="text-zinc-400 shrink-0" />
              )}
              <span>
                {isPublic
                  ? (isRTL ? 'تحويل إلى خاصة' : 'Make Private')
                  : (isRTL ? 'تحويل إلى عامة' : 'Make Public')}
              </span>
            </button>
          )}

          {/* Add to Queue */}
          <button
            type="button"
            onClick={() => {
              setIsOpen(false);
              onQueueAll?.();
            }}
            className={`w-full px-3 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
              isDark ? 'hover:bg-zinc-800/80 text-zinc-200' : 'hover:bg-[#ede5d3] text-[#082621]'
            } ${isRTL ? 'flex-row-reverse text-right' : ''}`}
          >
            <ListPlus size={15} className="text-[#17a398] shrink-0" />
            <span>{jamSession ? (isRTL ? 'إضافة إلى طابور جام' : 'Add to Jam Queue') : (isRTL ? 'إضافة للانتظار' : 'Queue All Songs')}</span>
          </button>

          {/* Download All */}
          <button
            type="button"
            disabled={isDownloadingAll}
            onClick={() => {
              setIsOpen(false);
              onDownloadAll?.();
            }}
            className={`w-full px-3 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
              isDark ? 'hover:bg-zinc-800/80 text-zinc-200' : 'hover:bg-[#ede5d3] text-[#082621]'
            } ${isRTL ? 'flex-row-reverse text-right' : ''}`}
          >
            {isDownloadingAll ? (
              <Loader2 size={15} className="animate-spin text-amber-400 shrink-0" />
            ) : allDownloaded ? (
              <Check size={15} className="text-emerald-500 shrink-0" />
            ) : (
              <Download size={15} className="text-[#17a398] shrink-0" />
            )}
            <span>
              {isDownloadingAll
                ? `${isRTL ? 'جاري التنزيل' : 'Downloading'} (${downloadStats?.current || 0}/${downloadStats?.total || 0})`
                : allDownloaded
                ? (isRTL ? 'تم التنزيل بالكامل' : 'All Downloaded')
                : (isRTL ? 'تنزيل جميع الأغاني' : 'Download All')}
            </span>
          </button>

          {/* Enable / Disable DJ Mix Mode */}
          {canBeMix && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onToggleMix?.();
              }}
              className={`w-full px-3 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2.5 transition-colors cursor-pointer text-left ${
                isDark ? 'hover:bg-zinc-800/80 text-zinc-200' : 'hover:bg-[#ede5d3] text-[#082621]'
              } ${isRTL ? 'flex-row-reverse text-right' : ''}`}
            >
              <SlidersHorizontal size={15} className={isMixActive ? 'text-amber-400 shrink-0' : 'text-[#17a398] shrink-0'} />
              <span>
                {isMixActive
                  ? (isRTL ? 'تعطيل مكس DJ' : 'Disable DJ Mix Mode')
                  : (isRTL ? 'تفعيل مكس DJ' : 'Enable DJ Mix Mode')}
              </span>
            </button>
          )}

          {/* Delete Playlist / Album (Owner / Admin) */}
          {(isOwner || isAdmin) && !playlist?.isLikedSongs && (
            <div className={`pt-1 mt-1 border-t ${isDark ? 'border-zinc-800' : 'border-zinc-200'}`}>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onDelete?.();
                }}
                className={`w-full px-3 py-2.5 rounded-lg text-xs font-mono font-bold flex items-center gap-2.5 transition-colors cursor-pointer text-red-500 hover:bg-red-500/10 text-left ${
                  isRTL ? 'flex-row-reverse text-right' : ''
                }`}
              >
                <Trash2 size={15} className="text-red-500 shrink-0" />
                <span>{playlist?.isAlbum ? (isRTL ? 'حذف الألبوم' : 'Delete Album') : (isRTL ? 'حذف القائمة' : 'Delete Playlist')}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
