import React from 'react';
import { Disc, Download, Play, X, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import { normalizeCoverUrl } from '../utils/coverUtils';

export default function MixDownloadGate({
  isOpen,
  onClose,
  playlist,
  tracks = [],
  onDownloadAndMix,
  onPlayWithoutMix,
  globalTheme = 'dark'
}) {
  if (!isOpen || !playlist) return null;

  const isDark = globalTheme === 'dark';
  const notDownloaded = (tracks || []).filter(t => !t.downloaded);
  const totalCount = tracks.length;
  const downloadedCount = totalCount - notDownloaded.length;
  const totalSizeMB = (notDownloaded.length * 4.2).toFixed(1);

  // If all tracks are already downloaded, invoke mix directly
  if (notDownloaded.length === 0) {
    if (onDownloadAndMix) {
      onDownloadAndMix();
    }
    return null;
  }

  const coverUrl = playlist.cover || (tracks[0] ? normalizeCoverUrl(tracks[0].cover, tracks[0]) : null);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className={`w-full max-w-lg rounded-t-2xl sm:rounded-2xl border-2 brutal-shadow-lg p-5 sm:p-6 transition-all max-h-[90vh] overflow-y-auto ${
          isDark 
            ? 'bg-[#101716] border-[#17a398] text-white' 
            : 'bg-[#fdfbf7] border-black text-[#0b1110]'
        }`}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b-2 border-dashed border-[#17a398]/30 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🎛️</span>
            <div>
              <h3 className="text-sm sm:text-base font-black font-display uppercase tracking-wider text-[#17a398]">
                DJ Mix Download Gate
              </h3>
              <p className="text-[10px] font-mono text-zinc-400">
                OFFLINE DUAL-BUFFER ENGINE
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-1.5 rounded-lg brutal-border cursor-pointer transition-colors ${
              isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-800'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Playlist Mini Hero */}
        <div className={`p-3.5 rounded-xl border-2 mb-4 flex items-center gap-3.5 ${
          isDark ? 'bg-[#141d1b] border-zinc-800' : 'bg-emerald-50/60 border-black'
        }`}>
          {coverUrl ? (
            <img 
              src={coverUrl} 
              alt={playlist.name} 
              className="w-14 h-14 rounded-lg object-cover brutal-border shrink-0" 
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-[#0b1110] text-[#17a398] brutal-border flex items-center justify-center shrink-0">
              <Disc size={28} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm sm:text-base truncate">
                {playlist.name}
              </h4>
              <span className="text-[9px] font-mono font-black bg-[#17a398] text-[#0b1110] px-1.5 py-0.5 rounded">
                MIX
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-mono mt-0.5">
              {downloadedCount} / {totalCount} songs available offline
            </p>
          </div>
        </div>

        {/* Technical Notice */}
        <div className={`p-3 rounded-xl border mb-4 text-xs ${
          isDark ? 'bg-[#0d1514] border-[#17a398]/40 text-zinc-300' : 'bg-amber-50 border-amber-300 text-amber-950'
        }`}>
          <div className="flex items-start gap-2.5">
            <Sparkles size={16} className="text-[#17a398] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-white text-[11px] sm:text-xs">
                استماع Offline DJ Mix بدون إنترنت
              </p>
              <p className="text-[10px] sm:text-[11px] leading-relaxed text-zinc-400">
                يعمل محرك الـ Dual-Deck Mix فوراً سواء عبر الستريمنج المباشر أو أوفلاين. يمكنك تحميل الأغاني الآن للاستمتاع بالميكس والانتقالات في أي وقت بدون استهلاك للإنترنت وبأعلى جودة صوتية.
              </p>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-2.5 mb-5 font-mono text-center">
          <div className={`p-2.5 rounded-lg border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
            <div className="text-[10px] text-zinc-500 uppercase">مطلوب تحميل</div>
            <div className="text-base sm:text-lg font-black text-[#f59e0b]">
              {notDownloaded.length} أغاني
            </div>
          </div>
          <div className={`p-2.5 rounded-lg border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-zinc-200'}`}>
            <div className="text-[10px] text-zinc-500 uppercase">الحجم التقديري</div>
            <div className="text-base sm:text-lg font-black text-[#17a398]">
              ~{totalSizeMB} MB
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5 font-display font-black text-xs">
          <button
            onClick={onDownloadAndMix}
            className="w-full py-3 px-4 rounded-xl bg-[#17a398] hover:bg-[#20b8ab] text-[#0b1110] brutal-border brutal-shadow brutal-btn flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Download size={16} strokeWidth={2.5} />
            <span>تحميل الأغاني وبدء DJ Mix (~{totalSizeMB} MB)</span>
          </button>

          <button
            onClick={onPlayWithoutMix}
            className={`w-full py-2.5 px-4 rounded-xl brutal-border flex items-center justify-center gap-2 cursor-pointer transition-all ${
              isDark 
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700' 
                : 'bg-white hover:bg-zinc-100 text-[#0b1110] border-black'
            }`}
          >
            <Play size={14} fill="currentColor" />
            <span>تشغيل عادي بدون مِكس (Streaming)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
