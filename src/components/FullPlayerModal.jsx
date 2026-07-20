import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, 
  Heart, Volume2, Sliders, Moon, PlusCircle, Share2, Download, Disc, Sparkles
} from 'lucide-react';

export default function FullPlayerModal({
  currentTrack,
  isPlaying,
  togglePlay,
  playNext,
  playPrev,
  toggleLike,
  toggleDownload,
  isOpen,
  onClose,
  currentTime,
  duration,
  seekTo,
  volume,
  setVolume,
  isShuffle,
  toggleShuffle,
  isRepeat,
  toggleRepeat,
  queue = [],
  openEqualizer,
  openSleepTimer,
  openAddToPlaylist
}) {
  const [activeTab, setActiveTab] = useState('player');
  const [isVinylMode, setIsVinylMode] = useState(false);
  const lyricRefs = useRef({});

  const lyrics = currentTrack && Array.isArray(currentTrack.lyrics) ? currentTrack.lyrics : [];

  const activeLyricIndex = lyrics.length > 0
    ? lyrics.findIndex((line, idx) => {
        const nextLine = lyrics[idx + 1];
        return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
      })
    : -1;

  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const scrollTimeoutRef = useRef(null);

  const handleUserScroll = () => {
    setIsUserScrolling(true);
    if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false);
    }, 4000);
  };

  useEffect(() => {
    if (isOpen && activeTab === 'lyrics' && activeLyricIndex !== -1 && lyricRefs.current[activeLyricIndex] && !isUserScrolling) {
      try {
        lyricRefs.current[activeLyricIndex].scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      } catch (err) {}
    }
  }, [activeLyricIndex, activeTab, isOpen, isUserScrolling]);

  if (!isOpen || !currentTrack) return null;

  const formatTime = (secs) => {
    if (!secs || isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#09090b] flex flex-col overflow-hidden animate-in fade-in duration-300 select-none">
      {/* Background Dynamic Ambient Color Glow */}
      <div 
        className="absolute inset-0 opacity-60 blur-3xl transition-all duration-1000 pointer-events-none scale-125"
        style={{
          background: `radial-gradient(circle at 50% 30%, ${currentTrack.color || '#1DB954'}, #000000 80%)`
        }}
      />
      <div className="absolute inset-0 bg-black/40 backdrop-blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <div className="relative z-10 p-4 md:p-6 flex items-center justify-between border-b border-white/5">
        <button 
          onClick={onClose} 
          className="p-2.5 text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-full transition-all border border-white/10"
        >
          <ChevronDown size={24} />
        </button>

        <div className="text-center truncate px-4">
          <p className="text-[10px] uppercase font-black tracking-widest text-[#1DB954]">Playing From Library</p>
          <h3 className="text-sm md:text-base font-extrabold text-white truncate mt-0.5">{currentTrack.album || currentTrack.title}</h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsVinylMode(!isVinylMode)}
            className={`p-2.5 rounded-full transition-all border ${
              isVinylMode 
                ? 'bg-[#1DB954] text-black border-[#1DB954] shadow-lg' 
                : 'text-zinc-300 bg-white/5 hover:bg-white/10 border-white/10'
            }`}
            title="Vinyl Record Mode"
          >
            <Disc size={20} className={isPlaying && isVinylMode ? 'animate-spin-slow' : ''} />
          </button>
          <button 
            onClick={openAddToPlaylist} 
            className="p-2.5 text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-full transition-all border border-white/10"
            title="Add to Playlist"
          >
            <PlusCircle size={20} />
          </button>
        </div>
      </div>

      {/* Tab Selector Pill */}
      <div className="relative z-10 flex justify-center gap-2 px-4 mt-4 mb-2">
        <div className="bg-black/60 backdrop-blur-xl p-1.5 rounded-full border border-white/10 flex items-center gap-1 shadow-2xl">
          <button
            onClick={() => setActiveTab('player')}
            className={`px-5 py-2 rounded-full text-xs font-black transition-all ${
              activeTab === 'player' ? 'bg-[#1DB954] text-black shadow-lg scale-105' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Cover Art
          </button>
          <button
            onClick={() => setActiveTab('lyrics')}
            className={`px-5 py-2 rounded-full text-xs font-black transition-all ${
              activeTab === 'lyrics' ? 'bg-[#1DB954] text-black shadow-lg scale-105' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Synced Lyrics 🎵
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`px-5 py-2 rounded-full text-xs font-black transition-all ${
              activeTab === 'queue' ? 'bg-[#1DB954] text-black shadow-lg scale-105' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Queue ({queue.length})
          </button>
        </div>
      </div>

      {/* Main Display Area */}
      <div className="relative z-10 flex-1 flex flex-col justify-between max-w-2xl mx-auto w-full px-6 py-4 overflow-hidden">
        {activeTab === 'player' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-8 my-auto w-full">
            {/* Artwork Container with Glowing Vinyl Effect */}
            <div className="relative group max-w-[280px] sm:max-w-[340px] md:max-w-[380px] w-full aspect-square flex items-center justify-center">
              {isVinylMode ? (
                /* Vinyl Disc View */
                <div className="relative w-full h-full flex items-center justify-center">
                  <div className={`w-full h-full rounded-full bg-zinc-950 border-4 border-zinc-800 shadow-2xl flex items-center justify-center relative overflow-hidden ${isPlaying ? 'animate-spin-slow' : ''}`}>
                    <div className="absolute inset-0 border-[16px] border-zinc-900/40 rounded-full" />
                    <div className="absolute inset-0 border-[32px] border-zinc-900/30 rounded-full" />
                    <div className="w-2/5 h-2/5 rounded-full overflow-hidden border-4 border-black shadow-xl">
                      <img src={currentTrack.cover} alt={currentTrack.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="w-6 h-6 rounded-full bg-zinc-900 border-2 border-white/20 shadow-inner z-10" />
                  </div>
                </div>
              ) : (
                /* Sleek Album Cover View */
                <div className="w-full h-full rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/15 relative">
                  <img 
                    src={currentTrack.cover} 
                    alt={currentTrack.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  {isPlaying && (
                    <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-1.5 shadow-xl">
                      <div className="w-1.5 h-4 bg-[#1DB954] rounded-full animate-bounce" />
                      <div className="w-1.5 h-6 bg-[#1DB954] rounded-full animate-bounce delay-100" />
                      <div className="w-1.5 h-3 bg-[#1DB954] rounded-full animate-bounce delay-200" />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Song Title & Actions */}
            <div className="w-full flex items-center justify-between px-2">
              <div className="truncate">
                <h2 className="text-2xl md:text-4xl font-black text-white truncate tracking-tight">{currentTrack.title}</h2>
                <p className="text-sm md:text-base font-bold text-zinc-400 truncate mt-1">{currentTrack.artist}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button 
                  onClick={() => toggleDownload(currentTrack.id)} 
                  className={`p-3 rounded-2xl transition-all ${
                    currentTrack.downloaded ? 'text-[#1DB954] bg-[#1DB954]/10 border border-[#1DB954]/30' : 'text-zinc-400 hover:text-white bg-white/5'
                  }`}
                  title={currentTrack.downloaded ? 'Downloaded Offline' : 'Download Track'}
                >
                  <Download size={22} />
                </button>
                <button 
                  onClick={() => toggleLike(currentTrack.id)}
                  className="p-3 text-zinc-400 hover:text-white bg-white/5 rounded-2xl transition-transform active:scale-125"
                >
                  <Heart size={24} className={currentTrack.liked ? 'fill-[#1DB954] text-[#1DB954]' : ''} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Timed Karaoke Lyrics Tab */}
        {activeTab === 'lyrics' && (
          <div onScroll={handleUserScroll} onTouchStart={handleUserScroll} className="flex-1 bg-black/70 backdrop-blur-2xl rounded-3xl p-6 border border-white/10 overflow-y-auto flex flex-col gap-6 my-2 scroll-smooth shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#1DB954] flex items-center gap-2">
                <Sparkles size={16} />
                <span>Live Synced Karaoke Lyrics</span>
              </h4>
              <span className="text-[11px] text-zinc-400 font-semibold">Click line to jump</span>
            </div>
            {lyrics.length > 0 ? (
              lyrics.map((line, idx) => {
                const isActive = idx === activeLyricIndex;
                return (
                  <p 
                    key={idx}
                    ref={(el) => (lyricRefs.current[idx] = el)}
                    onClick={() => seekTo(line.time)}
                    className={`text-xl md:text-3xl font-black cursor-pointer transition-all duration-300 leading-snug py-2.5 px-4 rounded-2xl ${
                      isActive 
                        ? 'text-[#1DB954] bg-[#1DB954]/15 scale-105 origin-left shadow-xl border-l-4 border-[#1DB954]' 
                        : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'
                    }`}
                  >
                    {line.text}
                  </p>
                );
              })
            ) : (
              <div className="text-center py-20 text-zinc-500 font-medium">No synced lyrics uploaded for this track yet.</div>
            )}
          </div>
        )}

        {/* Queue Tab */}
        {activeTab === 'queue' && (
          <div className="flex-1 bg-black/70 backdrop-blur-2xl rounded-3xl p-6 border border-white/10 overflow-y-auto flex flex-col gap-3 my-2 shadow-2xl">
            <h4 className="text-xs font-black uppercase tracking-wider text-zinc-400 pb-2 border-b border-white/10">Up Next Queue</h4>
            {queue.map((track, i) => (
              <div 
                key={`${track.id}-${i}`}
                onClick={() => seekTo(0)}
                className={`flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer ${
                  track.id === currentTrack.id ? 'bg-zinc-800/90 border border-[#1DB954]/50' : 'hover:bg-white/5'
                }`}
              >
                <img src={track.cover} alt={track.title} className="w-12 h-12 rounded-xl object-cover" />
                <div className="flex-1 truncate">
                  <p className={`text-sm font-extrabold truncate ${track.id === currentTrack.id ? 'text-[#1DB954]' : 'text-white'}`}>
                    {track.title}
                  </p>
                  <p className="text-xs text-zinc-400 truncate">{track.artist}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Player Controls Container */}
        <div className="w-full bg-black/40 backdrop-blur-xl p-4 md:p-6 rounded-3xl border border-white/10 shadow-2xl mt-auto">
          {/* Seekbar Slider */}
          <div className="w-full group mb-4">
            <input 
              type="range"
              min="0"
              max={duration || 100}
              value={currentTime || 0}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="w-full accent-[#1DB954] cursor-pointer"
              style={{
                background: `linear-gradient(to right, #1DB954 ${duration > 0 ? (currentTime / duration) * 100 : 0}%, #27272a ${duration > 0 ? (currentTime / duration) * 100 : 0}%)`
              }}
            />
            <div className="flex justify-between text-xs text-zinc-400 font-black mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Transport Controls */}
          <div className="flex items-center justify-between w-full py-2">
            <button 
              onClick={toggleShuffle} 
              className={`p-2.5 rounded-full transition-all ${isShuffle ? 'text-[#1DB954] bg-[#1DB954]/10' : 'text-zinc-400 hover:text-white'}`}
              title="Shuffle"
            >
              <Shuffle size={20} />
            </button>

            <button 
              onClick={playPrev} 
              className="p-2 text-white hover:scale-110 active:scale-95 transition-transform"
            >
              <SkipBack size={28} fill="white" />
            </button>

            <button 
              onClick={togglePlay} 
              className="w-16 h-16 rounded-full bg-[#1DB954] hover:bg-[#1ed760] text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-[0_0_30px_rgba(29,185,84,0.4)]"
            >
              {isPlaying ? <Pause size={28} fill="black" /> : <Play size={28} fill="black" className="ml-1" />}
            </button>

            <button 
              onClick={playNext} 
              className="p-2 text-white hover:scale-110 active:scale-95 transition-transform"
            >
              <SkipForward size={28} fill="white" />
            </button>

            <button 
              onClick={toggleRepeat} 
              className={`p-2.5 rounded-full transition-all ${isRepeat ? 'text-[#1DB954] bg-[#1DB954]/10' : 'text-zinc-400 hover:text-white'}`}
              title="Repeat"
            >
              <Repeat size={20} />
            </button>
          </div>

          {/* Volume & Equalizer Tools */}
          <div className="flex items-center justify-between pt-3 border-t border-white/10 mt-3">
            <div className="flex items-center gap-3 w-36">
              <Volume2 size={16} className="text-zinc-400 shrink-0" />
              <input 
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full accent-[#1DB954] cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2">
              <button 
                onClick={openEqualizer}
                className="p-2 text-zinc-400 hover:text-[#1DB954] hover:bg-white/5 rounded-xl transition-colors"
                title="Audio Equalizer"
              >
                <Sliders size={18} />
              </button>
              <button 
                onClick={openSleepTimer}
                className="p-2 text-zinc-400 hover:text-[#1DB954] hover:bg-white/5 rounded-xl transition-colors"
                title="Sleep Timer"
              >
                <Moon size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
