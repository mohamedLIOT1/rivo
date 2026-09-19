import React, { useState, useEffect, useRef } from 'react';
import { 
  Search as SearchIcon, Play, Heart, PlusCircle, X, Trash2, Sparkles, Disc, 
  Music, Mic, Headphones, Radio, Flame, Coffee, Zap, Compass, Waves, Loader2 
} from 'lucide-react';
import { searchMusicOnline, isMusicTrack } from '../utils/searchEngine';

const TRENDING_TAGS = [
  { label: 'بوب عربي', query: 'أغاني بوب عربي' },
  { label: 'عمرو دياب', query: 'عمرو دياب' },
  { label: 'تامر حسني', query: 'تامر حسني' },
  { label: 'Egyptian Trap', query: 'Trap' },
  { label: 'Abyusif', query: 'Abyusif' },
  { label: 'Deep Focus', query: 'Chill' },
  { label: 'Retro Cassette', query: 'Retro' },
  { label: 'Workout Beats', query: 'Workout' },
];

const GENRE_CATEGORIES = [
  { id: 'g-1', name: 'Pop (بوب عربي)', searchQuery: 'أغاني بوب عربي', color: '#ec4899', bgLight: '#fdf2f8', darkBg: '#2a1120', Icon: Music, code: 'POP', desc: 'أفضل أغاني البوب العربي والمصري' },
  { id: 'g-2', name: 'Hip-Hop', searchQuery: 'Hip-Hop راب مصري', color: '#f97316', bgLight: '#fff7ed', darkBg: '#2d1606', Icon: Mic, code: 'HIP-HOP', desc: 'Egyptian Rap & Beats' },
  { id: 'g-3', name: 'Electronic', color: '#06b6d4', bgLight: '#ecfeff', darkBg: '#08252a', Icon: Headphones, code: 'SYNTH', desc: 'Club & Deep Bass' },
  { id: 'g-4', name: 'Arab Pop', searchQuery: 'طرب عربي', color: '#eab308', bgLight: '#fefce8', darkBg: '#271f05', Icon: Radio, code: 'TARAB', desc: 'Classic & Modern Eastern' },
  { id: 'g-5', name: 'Rock', color: '#ef4444', bgLight: '#fef2f2', darkBg: '#290c0c', Icon: Flame, code: 'ROCK', desc: 'Alternative & Raw Distortion' },
  { id: 'g-6', name: 'Chill & Lofi', color: '#a855f7', bgLight: '#faf5ff', darkBg: '#200d33', Icon: Coffee, code: 'LO-FI', desc: 'Relaxation & Study Tape' },
  { id: 'g-7', name: 'Workout', color: '#22c55e', bgLight: '#f0fdf4', darkBg: '#092712', Icon: Zap, code: 'ENERGY', desc: 'High Tempo Adrenaline' },
  { id: 'g-8', name: 'Podcasts', color: '#3b82f6', bgLight: '#eff6ff', darkBg: '#0a1a33', Icon: Mic, code: 'TALK', desc: 'Shows & Audio Series' },
  { id: 'g-9', name: 'Indie', color: '#14b8a6', bgLight: '#f0fdfa', darkBg: '#062622', Icon: Compass, code: 'INDIE', desc: 'Underground Sound' },
  { id: 'g-10', name: 'Jazz & Soul', color: '#8b5cf6', bgLight: '#f5f3ff', darkBg: '#1c1033', Icon: Disc, code: 'JAZZ', desc: 'Organic Groove Blend' },
  { id: 'g-11', name: 'Ambient', color: '#64748b', bgLight: '#f8fafc', darkBg: '#131b25', Icon: Waves, code: 'ATMOS', desc: 'Atmospheric Frequencies' },
  { id: 'g-12', name: 'Club & Dance', color: '#d946ef', bgLight: '#fdf4ff', darkBg: '#270c2d', Icon: Sparkles, code: 'CLUB', desc: 'Peak Midnight BPM' },
];

export default function SearchScreen({ 
  tracks = [], 
  initialQuery = '', 
  onSelectTrack, 
  toggleLike, 
  onOpenAddSongModal,
  onDeleteTrack,
  globalTheme = 'dark'
}) {
  const isDark = globalTheme === 'dark';
  const [query, setQuery] = useState(initialQuery);
  const [onlineResults, setOnlineResults] = useState([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    if (initialQuery !== undefined) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  const cleanQuery = (query || '').trim().toLowerCase();
  const isPopSearch = /^(pop|the pop|pop music|pops|بوب|بوب عربي|arabic pop|أغاني بوب عربي)$/i.test(cleanQuery);

  // Local tracks matching
  const localFiltered = (tracks || []).filter((t) => {
    if (!cleanQuery) return false;
    if (!isMusicTrack(t.title, t.artist)) return false;
    const titleMatch = t.title && t.title.toLowerCase().includes(cleanQuery);
    const artistMatch = t.artist && t.artist.toLowerCase().includes(cleanQuery);
    const genreMatch = t.genre && t.genre.toLowerCase().includes(cleanQuery);
    const albumMatch = t.album && t.album.toLowerCase().includes(cleanQuery);

    if (isPopSearch) {
      const popKeywords = ['pop', 'بوب', 'عربي', 'arabic', 'عمرو', 'تامر', 'سعد', 'حماقي', 'شيرين', 'دياب', 'حسني'];
      const text = `${t.title || ''} ${t.artist || ''} ${t.genre || ''} ${t.album || ''}`.toLowerCase();
      if (popKeywords.some(kw => text.includes(kw))) return true;
    }

    return titleMatch || artistMatch || genreMatch || albumMatch;
  });

  // Debounced Online / AI Search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (!cleanQuery || cleanQuery.length < 2) {
      setOnlineResults([]);
      setIsSearchingOnline(false);
      return;
    }

    setIsSearchingOnline(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchMusicOnline(cleanQuery);
        // Exclude tracks that already exist locally or are non-music/cartoons
        const localIds = new Set((tracks || []).map(t => String(t.id || t._id)));
        const filteredOnline = (results || []).filter(t => 
          !localIds.has(String(t.id || t._id)) && isMusicTrack(t.title, t.artist)
        );
        setOnlineResults(filteredOnline);
      } catch (err) {
        console.warn('Online music search error:', err);
      } finally {
        setIsSearchingOnline(false);
      }
    }, 450);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [cleanQuery, tracks]);

  const handleDelete = (e, track) => {
    e.stopPropagation();
    if (!onDeleteTrack) return;
    const trackName = track.title || 'this track';
    if (window.confirm(`Are you sure you want to delete "${trackName}" from your library?`)) {
      onDeleteTrack(track.id || track._id);
    }
  };

  const handlePlayOnlineTrack = (track) => {
    onSelectTrack(track, [...localFiltered, ...onlineResults]);
  };

  return (
    <div 
      className={`flex-1 overflow-y-auto pb-32 select-none p-4 md:p-8 transition-colors ${
        isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'
      }`}
    >
      <div className="max-w-6xl mx-auto">
        {/* ── Apothecary Search Master Deck Card (Identical to Image 3 DJ Console) ── */}
        <div className={`brutal-border-thick brutal-shadow-lg p-6 md:p-8 mb-8 relative transition-colors ${
          isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-[#0b1110] text-[#0b1110]'
        }`}>
          {/* Deck Header Bar */}
          <div className={`flex justify-between items-center pb-3 mb-4 border-b-2 ${
            isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110] text-[#082621]'
          }`}>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-[#f59e0b] brutal-border inline-block" />
              <span className="text-xs font-mono font-black uppercase tracking-wider">
                RIVO ACOUSTIC SEARCH ENGINE • CONSOLE #02
              </span>
            </div>
            <div className={`text-[10px] font-mono font-black px-2 py-0.5 brutal-border ${
              isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
            }`}>
              INSTANT STREAMING
            </div>
          </div>

          {/* Deck Body */}
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Search Scanner Box (matches spool box from Image 3) */}
            <div className="w-28 h-28 md:w-36 md:h-36 bg-[#082621] brutal-border-thick brutal-shadow shrink-0 relative flex flex-col items-center justify-center text-[#26c4b7]">
              <SearchIcon size={52} strokeWidth={2.5} className={isSearchingOnline ? "animate-pulse" : ""} />
              <span className="text-[9px] font-mono font-black uppercase tracking-widest text-[#f59e0b] mt-1">
                {isSearchingOnline ? 'SCANNING' : 'ONLINE RX'}
              </span>
              <div className="absolute top-2 left-2 flex items-center gap-1 bg-[#dc2626] text-white px-1.5 py-0.5 text-[8px] font-mono font-black">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
              </div>
            </div>

            <div className="flex-1 w-full text-center md:text-left">
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 brutal-border text-[10px] font-mono font-black uppercase mb-2 ${
                isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
              }`}>
                <Sparkles size={12} className="text-[#17a398]" />
                <span>SOUNDCLOUD & YOUTUBE STREAMING LAB</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <h2 className={`text-2xl md:text-4xl font-display font-black leading-tight ${
                  isDark ? 'text-white' : 'text-[#082621]'
                }`}>
                  Rivo Acoustic Search Engine
                </h2>

                {onOpenAddSongModal && (
                  <button
                    onClick={onOpenAddSongModal}
                    className="self-center sm:self-auto flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-mono font-black uppercase bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border brutal-shadow-sm brutal-btn cursor-pointer shrink-0"
                  >
                    <PlusCircle size={14} strokeWidth={2.5} />
                    <span>Add Song / Link</span>
                  </button>
                )}
              </div>

              {/* Tactile Search Input Box */}
              <div className="relative mb-3">
                <SearchIcon 
                  className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                    isDark ? 'text-zinc-500' : 'text-[#082621]/70'
                  }`} 
                  size={18} 
                  strokeWidth={2.5}
                />
                <input
                  id="search-input"
                  type="text"
                  placeholder="Search by dose, artist, prescription, or cassette..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                  className={`w-full font-mono text-xs sm:text-sm py-2.5 pl-10 pr-10 brutal-border focus:outline-none transition-all ${
                    isDark 
                      ? 'bg-[#0b1110] text-white placeholder-zinc-500 border-zinc-700 focus:bg-[#141d1b]' 
                      : 'bg-[#ede5d3] text-[#0b1110] placeholder-[#082621]/60 border-black focus:bg-white'
                  }`}
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center transition cursor-pointer brutal-border ${
                      isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700' : 'bg-[#ded2bb] text-[#0b1110] hover:bg-black hover:text-white'
                    }`}
                    title="Clear search"
                  >
                    <X size={13} strokeWidth={2.5} />
                  </button>
                )}
              </div>

              {/* Trending Quick Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap justify-center md:justify-start">
                <span className={`text-[10px] font-mono font-black uppercase mr-1 ${
                  isDark ? 'text-zinc-400' : 'text-[#082621]/70'
                }`}>
                  TRENDING:
                </span>
                {TRENDING_TAGS.map((tag) => {
                  const isSelected = query.toLowerCase() === tag.query.toLowerCase();
                  return (
                    <button
                      key={tag.label}
                      onClick={() => setQuery(isSelected ? '' : tag.query)}
                      className={`px-2.5 py-1 text-xs font-mono font-bold brutal-border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#17a398] text-[#0b1110] font-black scale-105'
                          : isDark 
                            ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700' 
                            : 'bg-[#ede5d3] hover:bg-white text-[#0b1110] border-black'
                      }`}
                    >
                      {tag.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Content Card (Matches Image 3 Automated Mix Queue Card) ── */}
        <div className={`brutal-border-thick brutal-shadow-lg p-6 relative transition-colors ${
          isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-[#0b1110] text-[#0b1110]'
        }`}>
          {query ? (
            /* ── Search Results ── */
            <div>
              <div className={`flex items-center justify-between pb-3 mb-4 border-b-2 ${
                isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110] text-[#082621]'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-[#17a398] brutal-border inline-block animate-pulse" />
                  <span className="text-xs font-mono font-black uppercase tracking-wider">
                    DOSAGE AUDIT RESULTS FOR "{query.toUpperCase()}"
                  </span>
                  {isSearchingOnline && (
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 brutal-border ${
                      isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
                    }`}>
                      <Loader2 size={10} className="animate-spin text-[#17a398]" />
                      <span>Scanning streams...</span>
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setQuery('')}
                  className={`text-xs font-mono font-black uppercase hover:underline cursor-pointer ${
                    isDark ? 'text-zinc-400 hover:text-white' : 'text-[#082621]/70 hover:text-black'
                  }`}
                >
                  Clear Results
                </button>
              </div>

              {/* Local Library Matches */}
              {localFiltered.length > 0 && (
                <div className="mb-6">
                  <p className={`text-xs font-mono font-black uppercase mb-2.5 ${
                    isDark ? 'text-zinc-400' : 'text-[#082621]/70'
                  }`}>
                    Local Dispensary Matches ({localFiltered.length})
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {localFiltered.map((track, idx) => (
                      <div
                        key={track.id || track._id || idx}
                        onClick={() => onSelectTrack(track, localFiltered)}
                        className={`flex items-center justify-between p-3 brutal-border transition-transform hover:translate-x-1 cursor-pointer group ${
                          isDark 
                            ? 'bg-[#182320] border-zinc-700 text-white hover:bg-[#202f2b]' 
                            : 'bg-[#ede5d3] border-black text-[#0b1110] hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                          <img 
                            src={track.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100'} 
                            alt={track.title} 
                            className="w-10 h-10 brutal-border object-cover bg-white shrink-0" 
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                          <div className="truncate flex-1">
                            <p className="text-xs sm:text-sm font-mono font-black truncate group-hover:text-[#17a398] transition-colors">
                              {track.title}
                            </p>
                            <p className={`text-[11px] font-mono truncate ${
                              isDark ? 'text-zinc-400' : 'text-[#082621]/70'
                            }`}>
                              {track.artist || 'Unknown Practitioner'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              toggleLike(track.id || track._id); 
                            }}
                            className="p-1 text-zinc-400 hover:text-[#dc2626] transition cursor-pointer"
                            title="Like"
                          >
                            <Heart 
                              size={15} 
                              fill={track.liked ? '#dc2626' : 'none'} 
                              className={track.liked ? 'text-[#dc2626]' : ''}
                            />
                          </button>
                          {onDeleteTrack && (
                            <button
                              onClick={(e) => handleDelete(e, track)}
                              className="p-1 text-zinc-400 hover:text-red-500 transition cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          <button
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              onSelectTrack(track, localFiltered); 
                            }}
                            className="w-8 h-8 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border flex items-center justify-center brutal-btn cursor-pointer"
                            title="Play"
                          >
                            <Play size={13} fill="currentColor" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Online Results */}
              {onlineResults.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Sparkles size={14} className="text-[#17a398]" />
                    <p className={`text-xs font-mono font-black uppercase tracking-wider ${
                      isDark ? 'text-zinc-400' : 'text-[#082621]/70'
                    }`}>
                      Online Streaming Formulations ({onlineResults.length})
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {onlineResults.map((track) => (
                      <div
                        key={`online-${track.id}`}
                        onClick={() => handlePlayOnlineTrack(track)}
                        className={`flex items-center justify-between p-3 brutal-border transition-transform hover:translate-x-1 cursor-pointer group ${
                          isDark 
                            ? 'bg-[#182320] border-zinc-700 text-white hover:bg-[#202f2b]' 
                            : 'bg-[#ede5d3] border-black text-[#0b1110] hover:bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                          <div className="relative shrink-0">
                            <img 
                              src={track.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100'} 
                              alt={track.title} 
                              className="w-10 h-10 brutal-border object-cover bg-white" 
                            />
                            <span className="absolute -bottom-1 -right-1 text-[8px] font-mono font-black bg-[#17a398] text-[#0b1110] px-1 brutal-border">
                              WEB
                            </span>
                          </div>
                          <div className="truncate flex-1">
                            <p className="text-xs sm:text-sm font-mono font-black truncate group-hover:text-[#17a398] transition-colors">
                              {track.title}
                            </p>
                            <p className={`text-[11px] font-mono truncate ${
                              isDark ? 'text-zinc-400' : 'text-[#082621]/70'
                            }`}>
                              {track.artist || 'Online Stream'}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handlePlayOnlineTrack(track); 
                          }}
                          className="w-8 h-8 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border flex items-center justify-center brutal-btn shrink-0 cursor-pointer"
                          title="Stream Now"
                        >
                          <Play size={13} fill="currentColor" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Zero Results */}
              {localFiltered.length === 0 && onlineResults.length === 0 && !isSearchingOnline && (
                <div className={`brutal-border-thick p-8 text-center max-w-md mx-auto my-6 ${
                  isDark ? 'bg-[#0b1110] border-zinc-700 text-white' : 'bg-[#ede5d3] border-black text-[#0b1110]'
                }`}>
                  <Music size={28} className="mx-auto text-[#17a398] mb-3" />
                  <h3 className="font-mono font-black text-sm uppercase mb-1">
                    No Direct Formulations for "{query}"
                  </h3>
                  <p className={`text-xs font-mono mb-4 ${
                    isDark ? 'text-zinc-400' : 'text-[#082621]/70'
                  }`}>
                    Paste any YouTube or SoundCloud link directly using the Add Song button!
                  </p>
                  {onOpenAddSongModal && (
                    <button
                      onClick={onOpenAddSongModal}
                      className="px-4 py-2 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-mono font-black text-xs uppercase brutal-border brutal-btn cursor-pointer"
                    >
                      + Add "{query}" to Library
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ── Browse Categories / Genres (Exact Image 3 Apothecary Style) ── */
            <div>
              <div className={`flex justify-between items-center pb-3 mb-4 border-b-2 ${
                isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110] text-[#082621]'
              }`}>
                <div className="flex items-center gap-2">
                  <Disc size={16} className="text-[#17a398]" />
                  <span className="text-xs font-mono font-black uppercase tracking-wider">
                    EXPLORE GENRES & SOUND CHANNELS
                  </span>
                </div>
                <div className={`text-[10px] font-mono font-black px-2 py-0.5 brutal-border ${
                  isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
                }`}>
                  12 CHANNELS READY
                </div>
              </div>

              {/* 2-Column Grid (Exact layout as Image 3 queue) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {GENRE_CATEGORIES.map((genre) => {
                  const IconComponent = genre.Icon;
                  return (
                    <div
                      key={genre.id}
                      onClick={() => setQuery(genre.searchQuery || genre.name)}
                      className={`flex items-center justify-between p-3 brutal-border transition-transform hover:translate-x-1 cursor-pointer group ${
                        isDark 
                          ? 'bg-[#182320] border-zinc-700 hover:bg-[#202f2b] text-white' 
                          : 'bg-[#ede5d3] border-black hover:bg-white text-[#0b1110]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                        <div 
                          className="w-10 h-10 brutal-border flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform"
                          style={{ backgroundColor: genre.color }}
                        >
                          <IconComponent size={20} />
                        </div>
                        <div className="truncate">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-black text-xs sm:text-sm uppercase truncate">
                              {genre.name}
                            </span>
                            <span 
                              className="text-[8px] font-mono font-black px-1.5 py-0.5 brutal-border text-white shadow-xs"
                              style={{ backgroundColor: genre.color }}
                            >
                              {genre.code}
                            </span>
                          </div>
                          <p className={`text-[11px] font-mono truncate mt-0.5 ${
                            isDark ? 'text-zinc-400' : 'text-[#082621]/70'
                          }`}>
                            {genre.desc}
                          </p>
                        </div>
                      </div>

                      <span className={`text-[9px] font-mono font-black px-2 py-0.5 brutal-border shrink-0 ${
                        isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#fdfbf7] text-[#082621] border-black'
                      }`}>
                        SELECT
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
