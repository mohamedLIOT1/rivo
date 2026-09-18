import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Sparkles, Disc, SkipForward, StopCircle, Music2, Mic2 } from 'lucide-react';
import { useAudioPlayer } from '../context/AudioContext';

const DJ_QUOTES = [
  "Here's a mix built just for you — sit back and enjoy the flow.",
  "Switching it up with some fresh vibes right now...",
  "Let's slow things down with some late-night chill tracks.",
  "Your taste is fire — keeping the energy going!",
  "Coming up next, something you're going to love.",
  "Dropping into a new vibe in 3... 2... 1...",
  "That track was 🔥 — here's what's next in your mix.",
  "Feeling the rhythm? This next one hits different.",
  "Your personal DJ is on the ones and twos tonight.",
  "Seamless transitions, all for you — just sit back.",
];

const STYLE_LABELS = {
  equal_power: 'Smooth Blend',
  bass_swap: 'Bass Swap',
  low_pass: 'Filter Sweep',
  cut: 'Instant Cut',
  vinyl_brake: 'Vinyl Brake',
  echo_out: 'Echo Out',
};

export default function MixesScreen({ tracks = [] }) {
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

    // Flash "transitioning" badge briefly
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

  // Progress through current track (for transition window indicator)
  const progress = duration > 0 ? currentTime / duration : 0;
  const remaining = duration > 0 ? duration - currentTime : 0;
  const transitionDuration = (activeTransitions && Object.values(activeTransitions)[0]?.duration) || 8;
  const inTransition = remaining > 0 && remaining <= transitionDuration && isMixMode;

  const djAvatarSvg = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2300E5FF"/><stop offset="100%" stop-color="%231DB954"/></linearGradient></defs><rect width="300" height="300" fill="%23121212"/><circle cx="150" cy="150" r="100" fill="url(%23g)" opacity="0.8"/><circle cx="150" cy="150" r="40" fill="%23121212"/><path d="M70,150 C70,105 105,70 150,70 C195,70 230,105 230,150" fill="none" stroke="%23FFF" stroke-width="12" stroke-linecap="round"/><rect x="55" y="130" width="25" height="40" rx="10" fill="%23FFF"/><rect x="220" y="130" width="25" height="40" rx="10" fill="%23FFF"/></svg>`;

  return (
    <div className="flex-1 overflow-y-auto pb-32 select-none px-4 md:px-8 py-6">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500 to-emerald-400 flex items-center justify-center text-black shadow-lg">
          <Sparkles size={22} />
        </div>
        <div>
          <h1 className="text-2xl md:text-4xl font-black text-white tracking-tight">AI DJ</h1>
          <p className="text-xs text-zinc-400">Spotify-style continuous mix with auto crossfade</p>
        </div>
      </div>

      {/* ── DJ Lio Card ── */}
      <div className="bg-gradient-to-r from-cyan-950 via-zinc-900 to-black p-5 md:p-8 rounded-3xl border border-cyan-500/30 mb-6 shadow-2xl relative overflow-hidden">

        {/* Animated background glow when active */}
        {isMixMode && (
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-emerald-500/5 animate-pulse pointer-events-none rounded-3xl" />
        )}

        <div className="flex flex-col md:flex-row items-center gap-5 relative">
          {/* DJ Avatar */}
          <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-2xl overflow-hidden shadow-2xl shrink-0 border border-cyan-400/40 bg-zinc-900">
            <img src={djAvatarSvg} alt="DJ Lio" className="w-full h-full object-cover" />
            {isMixMode && isPlaying && (
              <div className="absolute inset-0 bg-cyan-950/60 backdrop-blur-xs flex items-center justify-center">
                <Disc size={44} className="text-cyan-400 animate-spin" />
              </div>
            )}
            {/* LIVE badge */}
            {isMixMode && (
              <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-red-600 px-1.5 py-0.5 rounded text-[9px] font-black text-white uppercase tracking-wider">
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />
                LIVE
              </div>
            )}
          </div>

          <div className="flex-1 text-center md:text-left">
            <span className="text-[10px] uppercase font-black tracking-widest text-cyan-400">AI Host</span>
            <h2 className="text-2xl md:text-3xl font-black text-white mt-0.5">DJ Lio</h2>

            {/* Quote bubble */}
            <div className="flex items-start gap-2 mt-2 bg-cyan-950/40 p-3 rounded-2xl border border-cyan-500/20">
              <Mic2 size={14} className="text-cyan-400 shrink-0 mt-0.5" />
              <p className="text-xs md:text-sm text-zinc-200 font-medium italic leading-snug">
                "{djQuote}"
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-4">
              {!isMixMode ? (
                <button
                  disabled={tracks.length === 0}
                  onClick={() => startDjMode(tracks)}
                  className={`px-6 py-3 rounded-full font-extrabold text-sm flex items-center gap-2 transition-all shadow-xl ${
                    tracks.length > 0
                      ? 'bg-cyan-400 hover:bg-cyan-300 text-black hover:scale-105 active:scale-95 cursor-pointer'
                      : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  <Play size={16} fill="black" />
                  <span>Start DJ Mix</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={togglePlay}
                    className="px-5 py-3 rounded-full font-extrabold text-sm flex items-center gap-2 bg-cyan-400 hover:bg-cyan-300 text-black hover:scale-105 active:scale-95 transition-all shadow-xl cursor-pointer"
                  >
                    {isPlaying ? <Pause size={16} fill="black" /> : <Play size={16} fill="black" />}
                    <span>{isPlaying ? 'Pause' : 'Resume'}</span>
                  </button>

                  <button
                    onClick={playNextTrack}
                    className="px-4 py-3 rounded-full font-extrabold text-sm flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white hover:scale-105 active:scale-95 transition-all cursor-pointer border border-zinc-700"
                  >
                    <SkipForward size={15} />
                    <span>Skip</span>
                  </button>

                  <button
                    onClick={stopDjMode}
                    className="px-4 py-3 rounded-full font-extrabold text-sm flex items-center gap-2 bg-red-900/60 hover:bg-red-800/80 text-red-300 hover:scale-105 active:scale-95 transition-all cursor-pointer border border-red-700/40"
                  >
                    <StopCircle size={15} />
                    <span>Stop DJ</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Now Playing + Transition Status (only when active) ── */}
      {isMixMode && currentTrack && (
        <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* Now Playing Card */}
          <div className="bg-zinc-900/70 rounded-2xl border border-zinc-800 p-4 flex items-center gap-3 relative overflow-hidden">
            <div className="absolute top-0 left-0 h-1 w-full bg-zinc-800 rounded-t-2xl">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-t-2xl transition-all duration-300"
                style={{ width: `${Math.min(100, progress * 100)}%` }}
              />
            </div>
            <img src={currentTrack.cover} alt={currentTrack.title} className="w-12 h-12 rounded-xl object-cover shadow-lg shrink-0 mt-1" />
            <div className="min-w-0 flex-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-red-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" /> NOW PLAYING
              </span>
              <h4 className="text-sm font-bold text-white truncate">{currentTrack.title}</h4>
              <p className="text-xs text-zinc-400 truncate">{currentTrack.artist}</p>
            </div>
            {isPlaying && (
              <Disc size={20} className="text-cyan-400 animate-spin shrink-0" />
            )}
          </div>

          {/* Next Track / Transition Card */}
          {nextTrack && (
            <div className={`bg-zinc-900/70 rounded-2xl border p-4 flex items-center gap-3 transition-all ${
              inTransition ? 'border-emerald-500/50 bg-emerald-950/20' : 'border-zinc-800'
            }`}>
              <img src={nextTrack.cover} alt={nextTrack.title} className="w-12 h-12 rounded-xl object-cover shadow-lg shrink-0 opacity-80" />
              <div className="min-w-0 flex-1">
                <span className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1 ${inTransition ? 'text-emerald-400' : 'text-zinc-500'}`}>
                  {inTransition ? (
                    <><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" /> MIXING IN</>
                  ) : (
                    <><Music2 size={9} /> UP NEXT</>
                  )}
                </span>
                <h4 className="text-sm font-bold text-zinc-300 truncate">{nextTrack.title}</h4>
                <p className="text-xs text-zinc-500 truncate">{nextTrack.artist}</p>
              </div>
              <span className="text-[9px] font-bold px-2 py-1 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 shrink-0 whitespace-nowrap">
                {STYLE_LABELS[currentStyle] || 'Blend'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Transition Info strip ── */}
      {isMixMode && (
        <div className="mb-6 flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-900/40 border border-zinc-800/60 text-xs text-zinc-400">
          <Sparkles size={14} className="text-cyan-400 shrink-0" />
          <span>
            DJ Mix is <span className="text-white font-bold">active</span> — every track auto-crossfades with a{' '}
            <span className="text-emerald-400 font-bold">
              {STYLE_LABELS[currentStyle]} ({transitionDuration}s)
            </span>{' '}
            transition. Customize transitions in the{' '}
            <span className="text-cyan-400 font-bold">Full Player → Mix</span>.
          </span>
        </div>
      )}

      {/* ── Track Queue ── */}
      <section>
        <h3 className="text-lg font-extrabold text-white mb-3">
          {isMixMode ? '🎛 DJ Queue' : 'Your Library'}{' '}
          <span className="text-zinc-500 font-normal text-sm">({tracks.length} tracks)</span>
        </h3>

        {tracks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {tracks.map((t, i) => {
              const isActive = currentTrack && String(t.id || t._id) === String(currentTrack.id || currentTrack._id);
              const isNext = nextTrack && String(t.id || t._id) === String(nextTrack.id || nextTrack._id);
              return (
                <div
                  key={t.id || t._id || i}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                    isActive
                      ? 'bg-cyan-950/40 border-cyan-500/50'
                      : isNext && isMixMode
                      ? 'bg-emerald-950/30 border-emerald-500/30'
                      : 'bg-zinc-900/60 border-zinc-800/80'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <div className="relative shrink-0">
                      <img src={t.cover} alt={t.title} className="w-11 h-11 rounded-xl object-cover" />
                      {isActive && isPlaying && (
                        <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                          <Disc size={16} className="text-cyan-400 animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="truncate">
                      <h4 className={`font-bold text-sm truncate ${isActive ? 'text-cyan-300' : 'text-white'}`}>
                        {t.title}
                      </h4>
                      <p className="text-xs text-zinc-400 truncate">{t.artist}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isActive && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                        PLAYING
                      </span>
                    )}
                    {isNext && isMixMode && (
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                        NEXT
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-zinc-900/40 rounded-3xl border border-zinc-800/80 p-8 text-zinc-500 text-xs font-bold">
            Add songs to your library to start the AI DJ Mix!
          </div>
        )}
      </section>
    </div>
  );
}
