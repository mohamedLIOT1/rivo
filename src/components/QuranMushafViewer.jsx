import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ChevronLeft, ChevronRight, BookOpen, Sun, Moon, 
  ZoomIn, ZoomOut, RotateCcw, Sparkles, AlertCircle, Maximize2, Minimize2 
} from 'lucide-react';
import { getSurahPageRange, getMushafPageUrl } from '../utils/quranMetadata';

export default function QuranMushafViewer({ track, globalTheme = 'dark' }) {
  const surahInfo = useMemo(() => {
    return getSurahPageRange(track?.title || track?.name || '', track?.artist || '');
  }, [track?.title, track?.name, track?.artist]);

  const startPage = surahInfo?.startPage || 1;
  const endPage = surahInfo?.endPage || 604;

  const [currentPage, setCurrentPage] = useState(startPage);
  const [viewMode, setViewMode] = useState('dark'); // 'dark' (AMOLED) | 'clean' (Original Paper)
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Sync to surah startPage when track changes
  useEffect(() => {
    if (surahInfo?.startPage) {
      setCurrentPage(surahInfo.startPage);
    }
  }, [surahInfo?.startPage, track?.id, track?._id]);

  // Preload adjacent pages for instantaneous flipping
  useEffect(() => {
    if (currentPage < endPage) {
      const nextImg = new Image();
      nextImg.src = getMushafPageUrl(currentPage + 1);
    }
    if (currentPage > startPage) {
      const prevImg = new Image();
      prevImg.src = getMushafPageUrl(currentPage - 1);
    }
  }, [currentPage, startPage, endPage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // In Arabic reading: Left arrow advances to next page, Right arrow goes back
      if (e.key === 'ArrowLeft') {
        goToNextPage();
      } else if (e.key === 'ArrowRight') {
        goToPrevPage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, startPage, endPage]);

  const goToNextPage = () => {
    if (currentPage < endPage) {
      setIsLoading(true);
      setCurrentPage(p => p + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > startPage) {
      setIsLoading(true);
      setCurrentPage(p => p - 1);
    }
  };

  const currentImageUrl = getMushafPageUrl(currentPage);
  const isFirstPage = currentPage <= startPage;
  const isLastPage = currentPage >= endPage;

  return (
    <div className={`flex flex-col w-full bg-[#070e0c] text-white select-none overflow-hidden font-sans border border-emerald-500/30 rounded-2xl shadow-[0_0_40px_rgba(16,185,129,0.12)] ${isFullscreen ? "fixed inset-0 z-[1000] h-screen p-2 md:p-6 bg-black/95 backdrop-blur-md rounded-none border-none" : "relative h-full"}`}>
      {/* ── TOP RETRO HI-FI DECK BAR ── */}
      <div className="shrink-0 flex items-center justify-between px-3 md:px-5 py-2.5 bg-gradient-to-r from-[#040f0c] via-[#091f1a] to-[#040f0c] border-b border-emerald-500/25 backdrop-blur-md z-20">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.25)]">
            <BookOpen size={17} />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-black text-white tracking-wide flex items-center gap-2 font-display">
              <span>{surahInfo?.name || 'القرآن الكريم'}</span>
              <span className="text-[10px] md:text-xs font-mono font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/60">
                {surahInfo?.verses} آية
              </span>
            </h3>
          </div>
        </div>

        {/* Page counter & View Mode toggle */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="text-xs font-mono font-bold text-emerald-300 bg-[#061411] px-2.5 py-1 rounded-lg border border-emerald-500/30 shadow-inner">
            صفحة <span className="text-white font-black">{currentPage}</span> / {endPage}
          </div>

          {/* Toggle AMOLED Dark / Clean Paper */}
          <button
            onClick={() => setIsFullscreen(f => !f)}
            className="flex items-center gap-1 text-xs font-mono px-2 py-1 rounded-lg border transition-colors cursor-pointer bg-emerald-950/40 border-emerald-500/30 hover:bg-emerald-500 hover:text-black text-emerald-300"
            title={isFullscreen ? 'تصغير' : 'ملء الشاشة'}
          >
            {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span className="hidden sm:inline text-[11px] font-bold">{isFullscreen ? 'تصغير' : 'تكبير'}</span>
          </button>

          {/* Zoom controls */}
          <button
            onClick={() => setZoomLevel(z => Math.min(2, z + 0.15))}
            className="p-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 hover:bg-emerald-500 hover:text-black text-emerald-300 transition-colors cursor-pointer"
            title="تكبير"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => setZoomLevel(z => Math.max(0.8, z - 0.15))}
            className="p-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 hover:bg-emerald-500 hover:text-black text-emerald-300 transition-colors cursor-pointer"
            title="تصغير"
          >
            <ZoomOut size={14} />
          </button>

          <button
            onClick={() => setViewMode(v => v === 'dark' ? 'clean' : 'dark')}
            className="flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer bg-emerald-950/40 border-emerald-500/30 hover:bg-emerald-500 hover:text-black text-emerald-300"
            title="تبديل وضع العرض (داكن / أصلي)"
          >
            {viewMode === 'dark' ? <Moon size={13} className="text-emerald-400" /> : <Sun size={13} className="text-amber-400" />}
            <span className="hidden sm:inline text-[11px]">{viewMode === 'dark' ? 'داكن' : 'أصلي'}</span>
          </button>
        </div>
      </div>

      {/* ── MAIN MUSHAF PAGE CANVAS ── */}
      <div className="relative flex-1 min-h-0 flex flex-col items-center justify-start overflow-y-auto p-2 sm:p-4 bg-[#050b09]">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/60 backdrop-blur-xs">
            <div className="w-8 h-8 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin mb-2" />
            <span className="text-xs font-mono text-emerald-300 font-bold">جاري تحميل صفحة المصحف {currentPage}...</span>
          </div>
        )}

        {/* Error Fallback */}
        {hasError && (
          <div className="flex flex-col items-center justify-center p-6 text-center z-10 my-auto">
            <AlertCircle size={32} className="text-amber-400 mb-2" />
            <p className="text-sm font-bold text-white mb-2">تعذر تحميل صفحة المصحف</p>
            <button
              onClick={() => { setHasError(false); setIsLoading(true); }}
              className="text-xs font-mono px-3.5 py-1.5 rounded-lg bg-emerald-500 text-black font-bold hover:bg-emerald-400 cursor-pointer"
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        {/* Page Container: Aligned to TOP, large width, scrollable, zoomable */}
        <div 
          className="w-full flex flex-col items-center justify-start my-auto transition-transform duration-200"
          style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
        >
          <img
            key={currentImageUrl}
            src={currentImageUrl}
            alt={`مصحف المدينة - صفحة ${currentPage}`}
            onLoad={() => setIsLoading(false)}
            onError={() => { setIsLoading(false); setHasError(true); }}
            className={`w-full max-w-xl md:max-w-2xl h-auto object-contain transition-all duration-300 rounded-lg ${
              viewMode === 'dark'
                ? 'brightness-0 invert contrast-125'
                : 'bg-[#faf7ee] p-2'
            }`}
            style={{
              boxShadow: viewMode === 'dark' 
                ? '0 0 35px rgba(16, 185, 129, 0.18), 0 0 0 1px rgba(16, 185, 129, 0.25)' 
                : '0 4px 25px rgba(0,0,0,0.6)'
            }}
          />
        </div>

        {/* Left Arrow (Next page in Arabic RTL reading) */}
        <button
          onClick={goToNextPage}
          disabled={isLastPage}
          className={`absolute left-2 md:left-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center z-20 transition-all cursor-pointer ${
            isLastPage 
              ? 'opacity-20 cursor-not-allowed bg-black/40 text-zinc-600' 
              : 'bg-black/85 hover:bg-emerald-400 text-white hover:text-black border border-emerald-500/40 hover:scale-105 shadow-[0_0_20px_rgba(0,0,0,0.6)]'
          }`}
          title="الصفحة التالية (يسار)"
        >
          <ChevronLeft size={24} />
        </button>

        {/* Right Arrow (Previous page in Arabic RTL reading) */}
        <button
          onClick={goToPrevPage}
          disabled={isFirstPage}
          className={`absolute right-2 md:right-4 top-1/2 -translate-y-1/2 w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center z-20 transition-all cursor-pointer ${
            isFirstPage 
              ? 'opacity-20 cursor-not-allowed bg-black/40 text-zinc-600' 
              : 'bg-black/85 hover:bg-emerald-400 text-white hover:text-black border border-emerald-500/40 hover:scale-105 shadow-[0_0_20px_rgba(0,0,0,0.6)]'
          }`}
          title="الصفحة السابقة (يمين)"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* ── BOTTOM PAGE SCRUBBER & JUMPER ── */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 bg-[#040d0b] border-t border-emerald-500/20 z-20">
        <button
          onClick={goToPrevPage}
          disabled={isFirstPage}
          className="flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 hover:bg-emerald-500 hover:text-black text-emerald-300 disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={14} />
          <span>السابق</span>
        </button>

        {/* Page progress bar slider if multi-page Surah */}
        {endPage > startPage ? (
          <div className="flex-1 max-w-md mx-2 flex items-center gap-2">
            <span className="text-[10px] font-mono font-bold text-emerald-400">{startPage}</span>
            <input
              type="range"
              min={startPage}
              max={endPage}
              value={currentPage}
              onChange={(e) => {
                setIsLoading(true);
                setCurrentPage(parseInt(e.target.value, 10));
              }}
              className="flex-1 h-1.5 bg-emerald-950 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
            <span className="text-[10px] font-mono font-bold text-emerald-400">{endPage}</span>
          </div>
        ) : (
          <div className="text-xs font-mono font-bold text-emerald-400">صفحة واحدة</div>
        )}

        <button
          onClick={goToNextPage}
          disabled={isLastPage}
          className="flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed transition-colors shadow-md"
        >
          <span>التالي</span>
          <ChevronLeft size={14} />
        </button>
      </div>
    </div>
  );
}
