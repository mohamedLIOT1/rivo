import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  ChevronLeft, ChevronRight, BookOpen, Sun, Moon, 
  ZoomIn, ZoomOut, RotateCcw, Sparkles, AlertCircle 
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
    <div className="relative flex flex-col h-full w-full bg-[#060b0a] text-white select-none overflow-hidden font-sans">
      {/* ── TOP ORNATE BAR ── */}
      <div className="shrink-0 flex items-center justify-between px-3 md:px-6 py-2.5 bg-black/60 border-b border-[#c29b38]/30 backdrop-blur-md z-20">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[#c29b38]/15 border border-[#c29b38]/40 flex items-center justify-center text-[#d4af37]">
            <BookOpen size={16} />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-bold text-[#f5ecd5] tracking-wide flex items-center gap-2">
              <span>{surahInfo?.name || 'القرآن الكريم'}</span>
              <span className="text-[10px] md:text-xs font-mono font-normal text-[#c29b38] px-1.5 py-0.5 rounded bg-[#c29b38]/10 border border-[#c29b38]/20">
                {surahInfo?.verses} آية
              </span>
            </h3>
          </div>
        </div>

        {/* Page counter & View Mode toggle */}
        <div className="flex items-center gap-2">
          <div className="text-xs font-mono font-bold text-[#c29b38] bg-[#0c1614] px-2.5 py-1 rounded border border-[#c29b38]/30">
            صفحة <span className="text-white font-black">{currentPage}</span> / {endPage}
          </div>

          {/* Toggle AMOLED Dark / Clean Paper */}
          <button
            onClick={() => setViewMode(v => v === 'dark' ? 'clean' : 'dark')}
            className="flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded border transition-colors cursor-pointer bg-[#0e1b19] border-white/10 hover:border-[#c29b38]/50 text-slate-300 hover:text-white"
            title="تبديل وضع العرض (داكن / أصلي)"
          >
            {viewMode === 'dark' ? <Moon size={13} className="text-[#c29b38]" /> : <Sun size={13} className="text-amber-400" />}
            <span className="hidden sm:inline text-[11px]">{viewMode === 'dark' ? 'داكن' : 'أصلي'}</span>
          </button>
        </div>
      </div>

      {/* ── MAIN MUSHAF PAGE CANVAS ── */}
      <div className="relative flex-1 min-h-0 flex items-center justify-center overflow-auto p-2 md:p-4 bg-[#070c0b]">
        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-black/40 backdrop-blur-xs">
            <div className="w-8 h-8 rounded-full border-2 border-[#c29b38] border-t-transparent animate-spin mb-2" />
            <span className="text-xs font-mono text-[#c29b38]">جاري تحميل الصفحة {currentPage}...</span>
          </div>
        )}

        {/* Error Fallback */}
        {hasError && (
          <div className="flex flex-col items-center justify-center p-6 text-center z-10">
            <AlertCircle size={32} className="text-amber-400 mb-2" />
            <p className="text-sm font-bold text-white mb-2">تعذر تحميل صفحة المصحف</p>
            <button
              onClick={() => { setHasError(false); setIsLoading(true); }}
              className="text-xs font-mono px-3 py-1.5 rounded bg-[#c29b38] text-black font-bold"
            >
              إعادة المحاولة
            </button>
          </div>
        )}

        {/* Page Canvas Container with Ornate Golden Border */}
        <div 
          className="relative max-h-full max-w-full flex items-center justify-center transition-transform duration-200"
          style={{ transform: `scale(${zoomLevel})` }}
        >
          <img
            key={currentImageUrl}
            src={currentImageUrl}
            alt={`مصحف المدينة - صفحة ${currentPage}`}
            onLoad={() => setIsLoading(false)}
            onError={() => { setIsLoading(false); setHasError(true); }}
            className={`max-h-[calc(100vh-230px)] md:max-h-[calc(100vh-260px)] w-auto object-contain transition-all duration-300 rounded shadow-2xl ${
              viewMode === 'dark'
                ? 'brightness-0 invert contrast-125'
                : 'bg-[#faf7ee] p-1'
            }`}
            style={{
              boxShadow: viewMode === 'dark' 
                ? '0 0 25px rgba(194, 155, 56, 0.15), 0 0 0 1px rgba(194, 155, 56, 0.25)' 
                : '0 4px 20px rgba(0,0,0,0.5)'
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
              : 'bg-black/70 hover:bg-[#c29b38] text-white hover:text-black border border-[#c29b38]/40 hover:scale-105 shadow-lg'
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
              : 'bg-black/70 hover:bg-[#c29b38] text-white hover:text-black border border-[#c29b38]/40 hover:scale-105 shadow-lg'
          }`}
          title="الصفحة السابقة (يمين)"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* ── BOTTOM PAGE SCRUBBER & JUMPER ── */}
      <div className="shrink-0 flex items-center justify-between gap-3 px-4 py-2 bg-black/80 border-t border-[#c29b38]/20 z-20">
        <button
          onClick={goToPrevPage}
          disabled={isFirstPage}
          className="flex items-center gap-1 text-xs font-mono font-bold px-3 py-1.5 rounded border border-white/10 hover:border-[#c29b38]/40 text-slate-300 hover:text-white disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed"
        >
          <ChevronRight size={14} />
          <span>السابق</span>
        </button>

        {/* Page progress bar slider if multi-page Surah */}
        {endPage > startPage ? (
          <div className="flex-1 max-w-md mx-2 flex items-center gap-2">
            <span className="text-[10px] font-mono text-[#c29b38]">{startPage}</span>
            <input
              type="range"
              min={startPage}
              max={endPage}
              value={currentPage}
              onChange={(e) => {
                setIsLoading(true);
                setCurrentPage(parseInt(e.target.value, 10));
              }}
              className="flex-1 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-[#c29b38]"
            />
            <span className="text-[10px] font-mono text-[#c29b38]">{endPage}</span>
          </div>
        ) : (
          <div className="text-xs font-mono text-[#c29b38]">صفحة واحدة</div>
        )}

        <button
          onClick={goToNextPage}
          disabled={isLastPage}
          className="flex items-center gap-1 text-xs font-mono font-bold px-3 py-1.5 rounded bg-[#c29b38] text-black hover:bg-[#dfb94a] disabled:opacity-25 cursor-pointer disabled:cursor-not-allowed"
        >
          <span>التالي</span>
          <ChevronLeft size={14} />
        </button>
      </div>
    </div>
  );
}
