import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Sparkles, Disc, SkipForward, StopCircle, Music2, Mic2, Sliders } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioContext';

const DJ_QUOTES = [
  "Rivo formulation active — dispensing continuous harmonic remedies.",
  "Calibrating acoustic tempo for optimal patient equilibrium.",
  "Switching frequency spectra to relieve auditory tension.",
  "Your sound prescription is performing at peak clinical resonance.",
  "Preparing smooth frequency crossfade for seamless listening therapy.",
  "Clinical balance verified. Dispensing next dose now.",
  "Acoustic relief in progress — keeping the rhythm steady.",
  "Certified sonic blend engaged. Sit back and absorb the frequency.",
];

const STYLE_LABELS = {
  equal_power: 'Equal Power Blend',
  bass_swap: 'Low-End Swap',
  low_pass: 'Acoustic Filter Sweep',
  cut: 'Instant Splice',
  vinyl_brake: 'Tape Brake',
  echo_out: 'Clinical Echo Out',
};

export default function MixesScreen({ tracks = [], globalTheme = 'dark' }) {
  const isDark = globalTheme === 'dark';
  const {
    isMixMode, startDjMode, stopDjMode,
    currentTrack, isPlaying, togglePlay,
    playNextTrack, activeTransitions,
    currentTime, duration,
  } = useAudioPlayer();

  const [djQuote, setDjQuote] = useState(DJ_QUOTES[0]);
  const [quoteIdx, setQuoteIdx] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const lastTrackIdRef = useRef(null);
  const quoteTimerRef = useRef(null);

  // Cycle DJ quote on every track change
  useEffect(() => {
    if (!currentTrack) return;
    const id = String(currentTrack.id || currentTrack._id);
    if (id === lastTrackIdRef.current) return;
    lastTrackIdRef.current = id;

    const next = (quoteIdx + 1) % DJ_QUOTES.length;
    setQuoteIdx(next);
    setDjQuote(DJ_QUOTES[next]);

    setIsTransitioning(true);
    if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current);
    quoteTimerRef.current = setTimeout(() => setIsTransitioning(false), 4000);
  }, [currentTrack?.id, currentTrack?._id]);

  useEffect(() => () => { if (quoteTimerRef.current) clearTimeout(quoteTimerRef.current); }, []);

  // Find next track in queue
  const nextTrack = (() => {
    if (!currentTrack || tracks.length < 2) return null;
    const curId = String(currentTrack.id || currentTrack._id || '');
    const idx = tracks.findIndex(t => String(t.id || t._id) === curId);
    if (idx === -1) return null;
    return tracks[(idx + 1) % tracks.length];
  })();

  // Current transition style for this pair
  const currentStyle = (() => {
    if (!currentTrack || !nextTrack) return 'equal_power';
    const key = Object.keys(activeTransitions || {}).find(k => {
      const [a] = k.split('___');
      return a === String(currentTrack.id || currentTrack._id);
    });
    return (key && activeTransitions[key]?.style) || 'equal_power';
  })();

  const progress = duration > 0 ? currentTime / duration : 0;
  const remaining = duration > 0 ? duration - currentTime : 0;
  const transitionDuration = (activeTransitions && Object.values(activeTransitions)[0]?.duration) || 8;
  const inTransition = remaining > 0 && remaining <= transitionDuration && isMixMode;

  return (
    <div className={`flex-1 overflow-y-auto pb-32 select-none p-4 md:p-8 transition-colors ${
      isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'
    }`}>
      {/* ── Apothecary DJ Master Deck Card ── */}
      <div className={`brutal-border-thick brutal-shadow-lg p-6 md:p-8 mb-8 relative transition-colors ${
        isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-[#0b1110] text-[#082621]'
      }`}>
        <div className={`flex justify-between items-center pb-3 mb-4 border-b-2 ${
          isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110] text-[#082621]'
        }`}>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-[#f59e0b] brutal-border inline-block" />
            <span className="text-xs font-mono font-black uppercase tracking-wider">
              RIVO AUTOMATED APOTHECARY MIXER • CONSOLE #01
            </span>
          </div>
          <div className={`text-[10px] font-mono font-black px-2 py-0.5 brutal-border ${
            isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
          }`}>
            CONTINUOUS DISPENSE
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Deck Cassette Spool Indicator */}
          <div className="w-28 h-28 md:w-36 md:h-36 bg-[#082621] brutal-border-thick brutal-shadow shrink-0 relative flex flex-col items-center justify-center text-[#26c4b7]">
            <Disc size={54} className={isPlaying && isMixMode ? "animate-spin" : ""} />
            <span className="text-[9px] font-mono font-black uppercase tracking-widest text-[#f59e0b] mt-1">
              {isMixMode ? (isPlaying ? 'DISPENSING' : 'IDLE') : 'STANDBY'}
            </span>
            {isMixMode && (
              <div className="absolute top-2 left-2 flex items-center gap-1 bg-[#dc2626] text-white px-1.5 py-0.5 text-[8px] font-mono font-black">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
              </div>
            )}
          </div>

          <div className="flex-1 text-center md:text-left">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 brutal-border text-[10px] font-mono font-black uppercase mb-2 ${
              isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
            }`}>
              <Sparkles size={12} className="text-[#17a398]" />
              <span>ALGORITHMIC CROSSFADE ENGINE</span>
            </div>

            <h2 className={`text-2xl md:text-4xl font-display font-black ${
              isDark ? 'text-white' : 'text-[#082621]'
            }`}>
              Rivo Sonic Dispatcher
            </h2>

            {/* Clinical Quote Pill */}
            <div className={`mt-3 p-3 brutal-border flex items-start gap-2 max-w-xl ${
              isDark ? 'bg-[#0b1110] text-zinc-200 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
            }`}>
              <Mic2 size={16} className={`shrink-0 mt-0.5 ${isDark ? 'text-zinc-400' : 'text-[#082621]'}`} />
              <p className="text-xs font-mono font-medium italic leading-snug">
                "{djQuote}"
              </p>
            </div>

            {/* Deck Controls */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-5">
              {!isMixMode ? (
                <button
                  disabled={tracks.length === 0}
                  onClick={() => startDjMode(tracks)}
                  className={`brutal-btn px-6 py-3 font-mono text-xs font-black uppercase brutal-border-thick brutal-shadow flex items-center gap-2 ${
                    tracks.length > 0
                      ? 'bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] cursor-pointer'
                      : 'bg-[#ded2bb] text-[#0b1110]/40 cursor-not-allowed'
                  }`}
                >
                  <Play size={16} fill="currentColor" />
                  <span>ENGAGE APOTHECARY MIX</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={togglePlay}
                    className="brutal-btn px-5 py-2.5 bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] font-mono text-xs font-black uppercase brutal-border-thick brutal-shadow flex items-center gap-2 cursor-pointer"
                  >
                    {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                    <span>{isPlaying ? 'PAUSE DISPENSE' : 'RESUME'}</span>
                  </button>

                  <button
                    onClick={playNextTrack}
                    className={`brutal-btn px-4 py-2.5 font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm flex items-center gap-1.5 cursor-pointer ${
                      isDark 
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700' 
                        : 'bg-[#ede5d3] hover:bg-[#ded2bb] text-[#082621] border-black'
                    }`}
                  >
                    <SkipForward size={14} />
                    <span>ADVANCE DOSE</span>
                  </button>

                  <button
                    onClick={stopDjMode}
                    className="brutal-btn px-4 py-2.5 bg-red-100 hover:bg-red-200 text-[#dc2626] font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <StopCircle size={14} />
                    <span>HALT MIX</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Active Status Cards (When Mix is engaged) ── */}
      {isMixMode && currentTrack && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Active Dose */}
          <div className={`brutal-border brutal-shadow p-4 relative overflow-hidden ${
            isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
          }`}>
            <div className="text-[10px] font-mono font-black uppercase text-[#dc2626] flex items-center gap-1.5 mb-2">
              <span className="w-2 h-2 bg-[#dc2626] rounded-full animate-pulse" />
              CURRENT ACOUSTIC DOSE
            </div>
            <div className="flex items-center gap-3">
              <img src={currentTrack.cover} alt={currentTrack.title} className="w-12 h-12 brutal-border object-cover bg-white shrink-0" />
              <div className="truncate flex-1">
                <h4 className={`font-bold text-sm truncate ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>{currentTrack.title}</h4>
                <p className={`text-xs truncate font-medium ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>{currentTrack.artist}</p>
              </div>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 brutal-border ${
                isDark ? 'bg-zinc-800 text-zinc-200 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
              }`}>
                {Math.round(progress * 100)}%
              </span>
            </div>
          </div>

          {/* Incoming Dose */}
          {nextTrack && (
            <div className={`p-4 brutal-border brutal-shadow transition-colors ${
              inTransition 
                ? 'bg-[#082621] text-white border-zinc-700' 
                : (isDark ? 'bg-[#182320] border-zinc-700 text-zinc-100' : 'bg-[#ede5d3] border-black text-[#0b1110]')
            }`}>
              <div className="text-[10px] font-mono font-black uppercase flex items-center justify-between mb-2">
                <span className={inTransition ? 'text-[#26c4b7]' : (isDark ? 'text-zinc-400' : 'text-[#082621]/70')}>
                  {inTransition ? 'SPLICE IN PROGRESS...' : 'NEXT IN DISPENSARY QUEUE'}
                </span>
                <span className={`px-2 py-0.5 text-[9px] brutal-border ${
                  isDark ? 'bg-zinc-800 text-zinc-200 border-zinc-700' : 'bg-[#fdfbf7] text-[#082621] border-black'
                }`}>
                  {STYLE_LABELS[currentStyle] || 'Blend'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <img src={nextTrack.cover} alt={nextTrack.title} className="w-12 h-12 brutal-border object-cover bg-white shrink-0" />
                <div className="truncate flex-1">
                  <h4 className="font-bold text-sm truncate">{nextTrack.title}</h4>
                  <p className={`text-xs truncate font-medium ${isDark ? 'text-zinc-400' : 'opacity-70'}`}>{nextTrack.artist}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Library / Queue Blister Cards ── */}
      <section className={`brutal-border-thick brutal-shadow-lg p-6 ${
        isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-[#0b1110] text-[#082621]'
      }`}>
        <div className={`flex items-center justify-between pb-3 mb-4 border-b-2 ${
          isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110] text-[#082621]'
        }`}>
          <h3 className="text-lg font-mono font-black uppercase tracking-wider">
            {isMixMode ? 'AUTOMATED MIX QUEUE' : 'DISPENSARY INVENTORY QUEUE'}
          </h3>
          <span className={`text-xs font-mono font-bold ${
            isDark ? 'text-zinc-400' : 'text-[#082621]/60'
          }`}>
            {tracks.length} CASSETTES READY
          </span>
        </div>

        {tracks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {tracks.map((t, i) => {
              const isActive = currentTrack && String(t.id || t._id) === String(currentTrack.id || currentTrack._id);
              const isNext = nextTrack && String(t.id || t._id) === String(nextTrack.id || nextTrack._id);
              return (
                <div
                  key={t.id || t._id || i}
                  className={`flex items-center justify-between p-3 brutal-border transition-transform ${
                    isActive
                      ? 'bg-[#082621] text-[#fdfbf7] brutal-shadow translate-x-1 border-teal-500'
                      : isNext && isMixMode
                      ? 'bg-[#26c4b7] text-[#082621] brutal-shadow-sm border-black'
                      : isDark
                      ? 'bg-[#182320] text-zinc-100 hover:bg-[#202f2b] border-zinc-700'
                      : 'bg-[#ede5d3] text-[#0b1110] hover:bg-white border-black'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate flex-1">
                    <img src={t.cover} alt={t.title} className="w-10 h-10 brutal-border object-cover bg-white shrink-0" />
                    <div className="truncate">
                      <h4 className="font-bold text-xs sm:text-sm truncate">
                        {t.title}
                      </h4>
                      <p className={`text-[11px] truncate font-medium ${
                        isActive ? 'text-teal-200' : isNext && isMixMode ? 'text-emerald-950' : isDark ? 'text-zinc-400' : 'opacity-70'
                      }`}>{t.artist}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    {isActive && (
                      <span className="text-[9px] font-mono font-black px-2 py-0.5 bg-[#f59e0b] text-[#0b1110] brutal-border">
                        PLAYING
                      </span>
                    )}
                    {isNext && isMixMode && (
                      <span className="text-[9px] font-mono font-black px-2 py-0.5 bg-[#082621] text-[#26c4b7] brutal-border">
                        UP NEXT
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`text-center py-8 text-xs font-mono ${
            isDark ? 'text-zinc-400' : 'text-[#082621]/70'
          }`}>
            NO AUDIO RECORDINGS AVAILABLE IN LIBRARY.
          </div>
        )}
      </section>
    </div>
  );
}
