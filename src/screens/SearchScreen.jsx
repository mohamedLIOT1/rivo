import React, { useState, useEffect, useRef } from 'react';
import { 
  Search as SearchIcon, Play, Heart, PlusCircle, X, Trash2, Sparkles, Disc, 
  Music, Mic, Headphones, Radio, Flame, Coffee, Zap, Compass, Waves, Loader2,
  User, Users, Edit2
} from 'lucide-react';
import { searchMusicOnline, isMusicTrack } from '../utils/searchEngine';
import VerifiedBadge from '../components/VerifiedBadge';
import { API_BASE_URL } from '../config';
import { getTrackArtists, ArtistLinks } from '../utils/artistUtils';
import { isQuranContent } from '../utils/quranUtils';
import { isUserAdmin } from '../utils/adminUtils';

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
  albums = [],
  initialQuery = '', 
  onSelectTrack, 
  onSelectPlaylist,
  onSelectArtist,
  toggleLike, 
  onOpenAddSongModal,
  onAddToLibrary,
  onDeleteTrack,
  onViewProfile,
  currentUser,
  openEditSongModal,
  globalTheme = 'dark'
}) {
  const isDark = globalTheme === 'dark';
  const [query, setQuery] = useState(initialQuery);
  const [filterType, setFilterType] = useState('all'); // 'all' | 'songs' | 'artists' | 'albums' | 'people'
  const [onlineResults, setOnlineResults] = useState([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [userResults, setUserResults] = useState([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const searchTimeoutRef = useRef(null);
  const userSearchTimeoutRef = useRef(null);

  useEffect(() => {
    if (initialQuery !== undefined) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  const cleanQuery = (query || '').trim().toLowerCase();
  const isPopSearch = /^(pop|the pop|pop music|pops|بوب|بوب عربي|arabic pop|أغاني بوب عربي)$/i.test(cleanQuery);

  // Strictly filter out any Quran content from Music Search
  const safeTracks = React.useMemo(() => (tracks || []).filter(t => !isQuranContent(t)), [tracks]);
  const safeAlbums = React.useMemo(() => (albums || []).filter(a => !isQuranContent(a)), [albums]);

  // Extract all artists from tracks & albums (supporting multiple artists per track)
  const allArtists = React.useMemo(() => {
    const map = new Map();
    safeTracks.forEach(t => {
      if (!t.artist || !isMusicTrack(t.title, t.artist)) return;
      const artistNames = getTrackArtists(t.artist, t.title);
      artistNames.forEach(name => {
        const key = name.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { name, count: 1, cover: t.cover });
        } else {
          map.get(key).count += 1;
        }
      });
    });
    safeAlbums.forEach(a => {
      if (!a.artist) return;
      const artistNames = getTrackArtists(a.artist);
      artistNames.forEach(name => {
        const key = name.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { name, count: (a.trackIds || []).length, cover: a.cover });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [safeTracks, safeAlbums]);

  // Matching Artists
  const matchedArtists = (filterType === 'people' || filterType === 'albums' || filterType === 'songs') ? [] : (
    cleanQuery ? allArtists.filter(a => a.name.toLowerCase().includes(cleanQuery)) : (filterType === 'artists' ? allArtists : [])
  );

  // Matching Albums
  const matchedAlbums = (filterType === 'people' || filterType === 'artists' || filterType === 'songs') ? [] : safeAlbums.filter(a => {
    if (filterType === 'albums' && !cleanQuery) return true;
    if (!cleanQuery) return false;
    const nameMatch = a.name && a.name.toLowerCase().includes(cleanQuery);
    const artistMatch = a.artist && a.artist.toLowerCase().includes(cleanQuery);
    return nameMatch || artistMatch;
  });

  // Local tracks matching
  const localFiltered = (filterType === 'people' || filterType === 'artists' || filterType === 'albums') ? [] : safeTracks.filter((t) => {
    if (!cleanQuery) return false;
    if (!isMusicTrack(t.title, t.artist)) return false;
    const titleMatch = t.title && t.title.toLowerCase().includes(cleanQuery);
    const trackArtists = getTrackArtists(t.artist, t.title).map(a => a.toLowerCase());
    const artistMatch = (t.artist && t.artist.toLowerCase().includes(cleanQuery)) || trackArtists.some(a => a.includes(cleanQuery));
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

    if (filterType === 'people' || !cleanQuery || cleanQuery.length < 2) {
      setOnlineResults([]);
      setIsSearchingOnline(false);
      return;
    }

    setIsSearchingOnline(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchMusicOnline(cleanQuery);
        // Exclude tracks that already exist locally or are non-music or Quran
        const localIds = new Set(safeTracks.map(t => String(t.id || t._id)));
        const filteredOnline = (results || []).filter(t => 
          !localIds.has(String(t.id || t._id)) && isMusicTrack(t.title, t.artist) && !isQuranContent(t)
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
  }, [cleanQuery, tracks, filterType]);

  // Debounced User / People Search
  useEffect(() => {
    if (userSearchTimeoutRef.current) clearTimeout(userSearchTimeoutRef.current);

    if (filterType === 'songs') {
      setUserResults([]);
      setIsSearchingUsers(false);
      return;
    }

    // When filter is people and query is empty, fetch suggested listeners
    if (!cleanQuery && filterType === 'people') {
      setIsSearchingUsers(true);
      fetch(`${API_BASE_URL}/api/users/search`)
        .then(res => res.json())
        .then(data => {
          if (data.success) setUserResults(data.users || []);
        })
        .catch(() => {})
        .finally(() => setIsSearchingUsers(false));
      return;
    }

    if (!cleanQuery || cleanQuery.length < 2) {
      setUserResults([]);
      setIsSearchingUsers(false);
      return;
    }

    setIsSearchingUsers(true);
    userSearchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/users/search?q=${encodeURIComponent(cleanQuery)}`);
        const data = await res.json();
        if (data.success) {
          setUserResults(data.users || []);
        }
      } catch (err) {
        console.warn('User search error:', err);
      } finally {
        setIsSearchingUsers(false);
      }
    }, 350);

    return () => {
      if (userSearchTimeoutRef.current) clearTimeout(userSearchTimeoutRef.current);
    };
  }, [cleanQuery, filterType]);

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
      className={`flex-1 overflow-y-auto pb-32 select-none p-3 sm:p-4 md:p-8 transition-colors ${
        isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'
      }`}
    >
      <div className="max-w-6xl mx-auto">
        {/* ── Search Header Card — compact on mobile ── */}
        <div className={`brutal-border-thick brutal-shadow-lg p-2.5 sm:p-4 md:p-8 mb-3 md:mb-8 relative transition-colors ${
          isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-[#0b1110] text-[#0b1110]'
        }`}>
          {/* Deck Header Bar — hidden on mobile */}
          <div className={`hidden sm:flex justify-between items-center pb-2.5 mb-3 border-b-2 ${
            isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110] text-[#082621]'
          }`}>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#f59e0b] brutal-border inline-block" />
              <span className="text-[11px] font-mono font-black uppercase tracking-wider">
                MUSIC & PEOPLE SEARCH ENGINE
              </span>
            </div>
            <div className={`text-[9px] font-mono font-black px-2 py-0.5 brutal-border ${
              isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
            }`}>
              INSTANT STREAMING
            </div>
          </div>

          {/* Deck Body */}
          <div className="flex flex-col md:flex-row items-center gap-3 md:gap-6">
            {/* Search Scanner Box — Desktop only */}
            <div className="hidden md:flex w-28 h-28 md:w-36 md:h-36 bg-[#082621] brutal-border-thick brutal-shadow shrink-0 relative flex-col items-center justify-center text-[#26c4b7]">
              {filterType === 'people' ? (
                <Users size={48} strokeWidth={2.5} className={isSearchingUsers ? "animate-pulse" : ""} />
              ) : (
                <SearchIcon size={48} strokeWidth={2.5} className={isSearchingOnline ? "animate-pulse" : ""} />
              )}
              <span className="text-[9px] font-mono font-black uppercase tracking-widest text-[#f59e0b] mt-1">
                {filterType === 'people' 
                  ? (isSearchingUsers ? 'SEARCHING' : 'LISTENERS') 
                  : (isSearchingOnline ? 'SCANNING' : 'ONLINE SEARCH')}
              </span>
              <div className="absolute top-2 left-2 flex items-center gap-1 bg-[#dc2626] text-white px-1.5 py-0.5 text-[8px] font-mono font-black">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE
              </div>
            </div>

            <div className="flex-1 w-full text-left">
              {/* Title row — compact on mobile */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <h2 className={`text-base sm:text-2xl md:text-4xl font-display font-black leading-tight ${
                  isDark ? 'text-white' : 'text-[#082621]'
                }`}>
                  Search Music & People
                </h2>

                {onOpenAddSongModal && (
                  <button
                    onClick={onOpenAddSongModal}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-[11px] sm:text-xs font-mono font-black uppercase bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border brutal-shadow-sm brutal-btn cursor-pointer shrink-0"
                  >
                    <PlusCircle size={14} strokeWidth={2.5} />
                    <span className="hidden xs:inline sm:inline">ADD SONG / LINK</span>
                  </button>
                )}
              </div>

              {/* Tactile Search Input Box */}
              <div className="relative mb-2.5">
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
                  placeholder={
                    filterType === 'people' 
                      ? "Search listeners by name or handle..." 
                      : filterType === 'songs' 
                        ? "Search songs, artists, or albums..." 
                        : "Search songs, artists, or listeners..."
                  }
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                  className={`w-full font-mono text-xs sm:text-sm py-2 sm:py-2.5 pl-10 pr-10 brutal-border focus:outline-none transition-all ${
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

              {/* ── Search Type Filter Options (All / Songs / People) ── */}
              <div className="flex items-center gap-2 mb-2.5 overflow-x-auto no-scrollbar py-0.5">
                <span className={`text-[10px] font-mono font-black uppercase tracking-wider shrink-0 ${
                  isDark ? 'text-zinc-400' : 'text-[#082621]/70'
                }`}>
                  FILTER:
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {[
                    { id: 'all', label: 'All', icon: Sparkles },
                    { id: 'songs', label: 'Songs', icon: Music },
                    { id: 'artists', label: 'Artists', icon: Mic, count: cleanQuery ? matchedArtists.length : allArtists.length },
                    { id: 'albums', label: 'Albums', icon: Disc, count: cleanQuery ? matchedAlbums.length : (albums || []).length },
                    { id: 'people', label: 'People', icon: Users, count: userResults.length },
                  ].map(({ id, label, icon: FilterIcon, count }) => {
                    const isActive = filterType === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setFilterType(id)}
                        className={`shrink-0 flex items-center gap-1.5 px-2.5 sm:px-3 py-1 text-xs font-mono font-bold brutal-border transition-all cursor-pointer rounded-lg ${
                          isActive
                            ? 'bg-[#17a398] text-[#0b1110] font-black scale-105 brutal-shadow-sm'
                            : isDark
                              ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700'
                              : 'bg-[#ede5d3] hover:bg-white text-[#0b1110] border-black'
                        }`}
                      >
                        <FilterIcon size={12} strokeWidth={2.5} />
                        <span>{label}</span>
                        {count !== undefined && count > 0 && id !== 'all' && id !== 'songs' && (
                          <span className={`px-1.5 py-0.2 text-[9px] font-mono font-black rounded-full ${
                            isActive ? 'bg-[#0b1110] text-[#17a398]' : 'bg-[#17a398] text-[#0b1110]'
                          }`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Trending Quick Filter Pills */}
              {filterType !== 'people' && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  <span className={`text-[10px] font-mono font-black uppercase mr-1 shrink-0 ${
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
                        className={`shrink-0 px-2.5 py-1 text-xs font-mono font-bold brutal-border transition-all cursor-pointer ${
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
              )}
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
                    SEARCH RESULTS FOR "{query.toUpperCase()}"
                  </span>
                  {isSearchingOnline && (
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 brutal-border ${
                      isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
                    }`}>
                      <Loader2 size={10} className="animate-spin text-[#17a398]" />
                      <span>Scanning streams...</span>
                    </span>
                  )}
                  {isSearchingUsers && (
                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 brutal-border ${
                      isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
                    }`}>
                      <Loader2 size={10} className="animate-spin text-[#17a398]" />
                      <span>Locating listeners...</span>
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

              {/* ── PEOPLE ONLY RESULTS ── */}
              {filterType === 'people' && (
                <div>
                  {isSearchingUsers ? (
                    <div className="text-center py-12">
                      <Loader2 size={28} className="animate-spin text-[#17a398] mx-auto mb-2" />
                      <p className="font-mono text-xs font-bold">Searching listeners...</p>
                    </div>
                  ) : userResults.length === 0 ? (
                    <div className={`brutal-border-thick p-8 text-center max-w-md mx-auto my-6 ${
                      isDark ? 'bg-[#0b1110] border-zinc-700 text-white' : 'bg-[#ede5d3] border-black text-[#0b1110]'
                    }`}>
                      <User size={32} className="mx-auto text-zinc-500 mb-2" />
                      <h3 className="font-display font-bold text-sm">No listeners found matching "{query}"</h3>
                      <p className={`text-xs font-mono mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        Try searching by exact name or check your spelling.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {userResults.map((u) => (
                        <div
                          key={u.id || u._id}
                          onClick={() => onViewProfile && onViewProfile(u.id || u._id)}
                          className={`p-3.5 rounded-xl brutal-border flex flex-col justify-between cursor-pointer transition hover:translate-x-1 hover:-translate-y-0.5 brutal-shadow-sm group ${
                            isDark 
                              ? 'bg-[#182320] border-zinc-700 hover:bg-[#202f2b] text-white' 
                              : 'bg-[#ede5d3] border-black hover:bg-white text-[#0b1110]'
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2.5 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-[#17a398] brutal-border flex items-center justify-center font-bold text-sm text-[#0b1110] overflow-hidden shrink-0">
                              {u.avatar ? (
                                <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="font-display font-black text-base">{u.name?.[0]?.toUpperCase() || 'U'}</span>
                              )}
                            </div>
                            <div className="truncate flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 font-display font-black text-sm truncate">
                                <span className="truncate group-hover:text-[#17a398] transition-colors">{u.name}</span>
                                <VerifiedBadge userOrName={u} size={13} />
                              </div>
                              <p className={`text-[11px] font-mono truncate mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                {u.bio || (u.followersCount ? `${u.followersCount} followers` : 'Rivo Listener')}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-dashed border-zinc-700/40 mt-auto">
                            <span className="text-[10px] font-mono font-bold text-[#17a398]">
                              {u.publicPlaylists?.length || 0} playlists • {u.followersCount || 0} followers
                            </span>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onViewProfile && onViewProfile(u.id || u._id);
                              }}
                              className="px-2.5 py-1 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-display font-bold text-xs rounded-lg brutal-border brutal-btn cursor-pointer shrink-0"
                            >
                              View Profile →
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── ARTISTS ONLY RESULTS ── */}
              {filterType === 'artists' && (
                <div>
                  {matchedArtists.length === 0 ? (
                    <div className={`brutal-border-thick p-8 text-center max-w-md mx-auto my-6 ${
                      isDark ? 'bg-[#0b1110] border-zinc-700 text-white' : 'bg-[#ede5d3] border-black text-[#0b1110]'
                    }`}>
                      <Mic size={32} className="mx-auto text-zinc-500 mb-2" />
                      <h3 className="font-display font-bold text-sm">No artists found matching "{query}"</h3>
                      <p className={`text-xs font-mono mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        Check spelling or search by song title instead.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {matchedArtists.map((art) => (
                        <div
                          key={art.name}
                          onClick={() => onSelectArtist && onSelectArtist(art.name)}
                          className={`p-3.5 rounded-xl brutal-border flex items-center justify-between cursor-pointer transition hover:translate-x-1 hover:-translate-y-0.5 brutal-shadow-sm group ${
                            isDark ? 'bg-[#182320] border-zinc-700 hover:bg-[#202f2b] text-white' : 'bg-[#ede5d3] border-black hover:bg-white text-[#0b1110]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                            <div className="w-12 h-12 rounded-full bg-[#082621] border-2 border-[#17a398] flex items-center justify-center font-bold text-sm text-[#26c4b7] overflow-hidden shrink-0">
                              {art.cover ? (
                                <img src={art.cover} alt={art.name} className="w-full h-full object-cover" />
                              ) : (
                                <Mic size={20} />
                              )}
                            </div>
                            <div className="truncate flex-1 min-w-0">
                              <p className="font-display font-black text-sm truncate group-hover:text-[#17a398] transition-colors">
                                {art.name}
                              </p>
                              <span className={`text-[11px] font-mono truncate block mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                {art.count} {art.count === 1 ? 'song' : 'songs'} in library
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectArtist && onSelectArtist(art.name);
                            }}
                            className="px-2.5 py-1 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-display font-bold text-xs rounded-lg brutal-border brutal-btn shrink-0 cursor-pointer"
                          >
                            View Artist →
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── ALBUMS ONLY RESULTS ── */}
              {filterType === 'albums' && (
                <div>
                  {matchedAlbums.length === 0 ? (
                    <div className={`brutal-border-thick p-8 text-center max-w-md mx-auto my-6 ${
                      isDark ? 'bg-[#0b1110] border-zinc-700 text-white' : 'bg-[#ede5d3] border-black text-[#0b1110]'
                    }`}>
                      <Disc size={32} className="mx-auto text-zinc-500 mb-2" />
                      <h3 className="font-display font-bold text-sm">No albums found matching "{query}"</h3>
                      <p className={`text-xs font-mono mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        Albums are created automatically when songs from an album are added.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {matchedAlbums.map((alb) => (
                        <div
                          key={alb.id || alb._id}
                          onClick={() => onSelectPlaylist && onSelectPlaylist(alb)}
                          className={`p-3.5 rounded-xl brutal-border flex items-center justify-between cursor-pointer transition hover:translate-x-1 hover:-translate-y-0.5 brutal-shadow-sm group ${
                            isDark ? 'bg-[#182320] border-zinc-700 hover:bg-[#202f2b] text-white' : 'bg-[#ede5d3] border-black hover:bg-white text-[#0b1110]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                            <div className="w-12 h-12 rounded-xl bg-black/10 brutal-border overflow-hidden shrink-0">
                              <img 
                                src={alb.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300'} 
                                alt={alb.name} 
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                                onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300'; }}
                              />
                            </div>
                            <div className="truncate flex-1 min-w-0">
                              <p className="font-display font-black text-sm truncate group-hover:text-[#17a398] transition-colors">
                                {alb.name}
                              </p>
                              <div className={`text-[11px] font-mono truncate mt-0.5 flex items-center gap-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                <ArtistLinks
                                  track={alb}
                                  onSelectArtist={onSelectArtist}
                                  linkClassName="hover:underline hover:text-[#17a398] transition-colors cursor-pointer"
                                />
                                <span>• {(alb.trackIds || []).length} songs</span>
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectPlaylist && onSelectPlaylist(alb);
                            }}
                            className="px-2.5 py-1 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-display font-bold text-xs rounded-lg brutal-border brutal-btn shrink-0 cursor-pointer"
                          >
                            Open Album →
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── ALL FILTER: MATCHED ARTISTS PREVIEW ── */}
              {filterType === 'all' && matchedArtists.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <Mic size={14} className="text-[#17a398]" />
                      <p className={`text-xs font-mono font-black uppercase tracking-wider ${
                        isDark ? 'text-zinc-400' : 'text-[#082621]/70'
                      }`}>
                        Artists ({matchedArtists.length})
                      </p>
                    </div>
                    {matchedArtists.length > 3 && (
                      <button
                        onClick={() => setFilterType('artists')}
                        className="text-xs font-mono font-black text-[#17a398] hover:underline cursor-pointer"
                      >
                        View All ({matchedArtists.length}) →
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {matchedArtists.slice(0, 3).map((art) => (
                      <div
                        key={`all-art-${art.name}`}
                        onClick={() => onSelectArtist && onSelectArtist(art.name)}
                        className={`p-3 rounded-xl brutal-border flex items-center justify-between cursor-pointer transition hover:translate-x-0.5 brutal-shadow-sm group ${
                          isDark 
                            ? 'bg-[#182320] border-zinc-700 hover:bg-[#202f2b] text-white' 
                            : 'bg-[#ede5d3] border-black hover:bg-white text-[#0b1110]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                          <div className="w-10 h-10 rounded-full bg-[#082621] border border-[#17a398] flex items-center justify-center font-bold text-xs text-[#26c4b7] overflow-hidden shrink-0">
                            {art.cover ? (
                              <img src={art.cover} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Mic size={16} />
                            )}
                          </div>
                          <div className="truncate flex-1 min-w-0">
                            <span className="truncate group-hover:text-[#17a398] transition-colors font-display font-black text-xs block">
                              {art.name}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-400 truncate block">
                              {art.count} {art.count === 1 ? 'song' : 'songs'}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectArtist && onSelectArtist(art.name);
                          }}
                          className="px-2 py-0.5 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-display font-bold text-[11px] rounded-md brutal-border brutal-btn shrink-0 cursor-pointer"
                        >
                          View →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── ALL FILTER: MATCHED ALBUMS PREVIEW ── */}
              {filterType === 'all' && matchedAlbums.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <Disc size={14} className="text-[#17a398]" />
                      <p className={`text-xs font-mono font-black uppercase tracking-wider ${
                        isDark ? 'text-zinc-400' : 'text-[#082621]/70'
                      }`}>
                        Albums ({matchedAlbums.length})
                      </p>
                    </div>
                    {matchedAlbums.length > 3 && (
                      <button
                        onClick={() => setFilterType('albums')}
                        className="text-xs font-mono font-black text-[#17a398] hover:underline cursor-pointer"
                      >
                        View All ({matchedAlbums.length}) →
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {matchedAlbums.slice(0, 3).map((alb) => (
                      <div
                        key={`all-alb-${alb.id || alb._id}`}
                        onClick={() => onSelectPlaylist && onSelectPlaylist(alb)}
                        className={`p-3 rounded-xl brutal-border flex items-center justify-between cursor-pointer transition hover:translate-x-0.5 brutal-shadow-sm group ${
                          isDark 
                            ? 'bg-[#182320] border-zinc-700 hover:bg-[#202f2b] text-white' 
                            : 'bg-[#ede5d3] border-black hover:bg-white text-[#0b1110]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                          <div className="w-10 h-10 rounded-lg bg-black/10 brutal-border overflow-hidden shrink-0">
                            <img 
                              src={alb.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300'} 
                              alt="" 
                              className="w-full h-full object-cover" 
                              onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300'; }}
                            />
                          </div>
                          <div className="truncate flex-1 min-w-0">
                            <span className="truncate group-hover:text-[#17a398] transition-colors font-display font-black text-xs block">
                              {alb.name}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-400 truncate block">
                              {alb.artist || 'Artist'} • {(alb.trackIds || []).length} songs
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPlaylist && onSelectPlaylist(alb);
                          }}
                          className="px-2 py-0.5 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-display font-bold text-[11px] rounded-md brutal-border brutal-btn shrink-0 cursor-pointer"
                        >
                          Album →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── ALL FILTER: MATCHED PEOPLE PREVIEW ── */}
              {filterType === 'all' && userResults.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <Users size={14} className="text-[#17a398]" />
                      <p className={`text-xs font-mono font-black uppercase tracking-wider ${
                        isDark ? 'text-zinc-400' : 'text-[#082621]/70'
                      }`}>
                        People & Listeners ({userResults.length})
                      </p>
                    </div>
                    {userResults.length > 3 && (
                      <button
                        onClick={() => setFilterType('people')}
                        className="text-xs font-mono font-black text-[#17a398] hover:underline cursor-pointer"
                      >
                        View All ({userResults.length}) →
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                    {userResults.slice(0, 3).map((u) => (
                      <div
                        key={`all-user-${u.id || u._id}`}
                        onClick={() => onViewProfile && onViewProfile(u.id || u._id)}
                        className={`p-3 rounded-xl brutal-border flex items-center justify-between cursor-pointer transition hover:translate-x-0.5 brutal-shadow-sm group ${
                          isDark 
                            ? 'bg-[#182320] border-zinc-700 hover:bg-[#202f2b] text-white' 
                            : 'bg-[#ede5d3] border-black hover:bg-white text-[#0b1110]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-2">
                          <div className="w-9 h-9 rounded-lg bg-[#17a398] brutal-border flex items-center justify-center font-bold text-xs text-[#0b1110] overflow-hidden shrink-0">
                            {u.avatar ? (
                              <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-display font-black text-sm">{u.name?.[0]?.toUpperCase() || 'U'}</span>
                            )}
                          </div>
                          <div className="truncate flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 font-display font-black text-xs truncate">
                              <span className="truncate group-hover:text-[#17a398] transition-colors">{u.name}</span>
                              <VerifiedBadge userOrName={u} size={12} />
                            </div>
                            <span className="text-[10px] font-mono text-zinc-400 truncate block">
                              {u.followersCount || 0} followers
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewProfile && onViewProfile(u.id || u._id);
                          }}
                          className="px-2 py-0.5 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-display font-bold text-[11px] rounded-md brutal-border brutal-btn shrink-0"
                        >
                          View →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── SONG RESULTS (For ALL & SONGS filters) ── */}
              {(filterType === 'all' || filterType === 'songs') && (
                <>
                  {/* Local Library Matches */}
                  {localFiltered.length > 0 && (
                    <div className="mb-6">
                      <p className={`text-xs font-mono font-black uppercase mb-2.5 ${
                        isDark ? 'text-zinc-400' : 'text-[#082621]/70'
                      }`}>
                        Local Library Songs ({localFiltered.length})
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
                                <ArtistLinks
                                  track={track}
                                  onSelectArtist={onSelectArtist}
                                  className={`text-[11px] font-mono truncate block ${
                                    isDark ? 'text-zinc-400' : 'text-[#082621]/70'
                                  }`}
                                  linkClassName="hover:underline hover:text-[#17a398] transition-colors cursor-pointer"
                                />
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
                              {openEditSongModal && isUserAdmin(currentUser) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditSongModal(track);
                                  }}
                                  className="p-1 text-zinc-400 hover:text-[#17a398] transition cursor-pointer"
                                  title="Admin: Edit Song"
                                >
                                  <Edit2 size={14} />
                                </button>
                              )}
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
                          Online Streaming Songs ({onlineResults.length})
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
                              <ArtistLinks
                                track={track}
                                onSelectArtist={onSelectArtist}
                                className={`text-[11px] font-mono truncate block ${
                                  isDark ? 'text-zinc-400' : 'text-[#082621]/70'
                                }`}
                                linkClassName="hover:underline hover:text-[#17a398] transition-colors cursor-pointer"
                              />
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
                {localFiltered.length === 0 && onlineResults.length === 0 && userResults.length === 0 && matchedArtists.length === 0 && matchedAlbums.length === 0 && !isSearchingOnline && (
                  <div className={`brutal-border-thick p-8 text-center max-w-md mx-auto my-6 ${
                    isDark ? 'bg-[#0b1110] border-zinc-700 text-white' : 'bg-[#ede5d3] border-black text-[#0b1110]'
                  }`}>
                    <Music size={28} className="mx-auto text-[#17a398] mb-3" />
                    <h3 className="font-mono font-black text-sm uppercase mb-1">
                      No Results Found for "{query}"
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
              </>
            )}
          </div>
        ) : (
          /* ── When query is empty (Browse Genres or Discover Listeners) ── */
          <div>
            {filterType === 'people' ? (
              /* ── Discover Listeners View ── */
              <div>
                <div className={`flex justify-between items-center pb-3 mb-4 border-b-2 ${
                  isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110] text-[#082621]'
                }`}>
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-[#17a398]" />
                    <span className="text-xs font-mono font-black uppercase tracking-wider">
                      DISCOVER LISTENERS & MEMBERS
                    </span>
                  </div>
                  <div className={`text-[10px] font-mono font-black px-2 py-0.5 brutal-border ${
                    isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
                  }`}>
                    COMMUNITY
                  </div>
                </div>

                {isSearchingUsers ? (
                  <div className="text-center py-12">
                    <Loader2 size={28} className="animate-spin text-[#17a398] mx-auto mb-2" />
                    <p className="font-mono text-xs font-bold">Loading members...</p>
                  </div>
                ) : userResults.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {userResults.map((u) => (
                      <div
                        key={u.id || u._id}
                        onClick={() => onViewProfile && onViewProfile(u.id || u._id)}
                        className={`p-3.5 rounded-xl brutal-border flex flex-col justify-between cursor-pointer transition hover:translate-x-1 hover:-translate-y-0.5 brutal-shadow-sm group ${
                          isDark 
                            ? 'bg-[#182320] border-zinc-700 hover:bg-[#202f2b] text-white' 
                            : 'bg-[#ede5d3] border-black hover:bg-white text-[#0b1110]'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2.5 min-w-0">
                          <div className="w-11 h-11 rounded-xl bg-[#17a398] brutal-border flex items-center justify-center font-bold text-sm text-[#0b1110] overflow-hidden shrink-0">
                            {u.avatar ? (
                              <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-display font-black text-base">{u.name?.[0]?.toUpperCase() || 'U'}</span>
                            )}
                          </div>
                          <div className="truncate flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 font-display font-black text-sm truncate">
                              <span className="truncate group-hover:text-[#17a398] transition-colors">{u.name}</span>
                              <VerifiedBadge userOrName={u} size={13} />
                            </div>
                            <p className={`text-[11px] font-mono truncate mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                              {u.bio || (u.followersCount ? `${u.followersCount} followers` : 'Rivo Listener')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-dashed border-zinc-700/40 mt-auto">
                          <span className="text-[10px] font-mono font-bold text-[#17a398]">
                            {u.publicPlaylists?.length || 0} playlists • {u.followersCount || 0} followers
                          </span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewProfile && onViewProfile(u.id || u._id);
                            }}
                            className="px-2.5 py-1 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-display font-bold text-xs rounded-lg brutal-border brutal-btn cursor-pointer shrink-0"
                          >
                            View Profile →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`brutal-border-thick p-8 text-center max-w-md mx-auto my-6 ${
                    isDark ? 'bg-[#0b1110] border-zinc-700 text-white' : 'bg-[#ede5d3] border-black text-[#0b1110]'
                  }`}>
                    <Users size={32} className="mx-auto text-zinc-500 mb-2" />
                    <h3 className="font-display font-bold text-sm">Find Listeners</h3>
                    <p className={`text-xs font-mono mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      Type any listener name in the search bar above to locate their profile and playlists.
                    </p>
                  </div>
                )}
              </div>
            ) : filterType === 'artists' ? (
              /* ── Discover Artists View ── */
              <div>
                <div className={`flex justify-between items-center pb-3 mb-4 border-b-2 ${
                  isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110] text-[#082621]'
                }`}>
                  <div className="flex items-center gap-2">
                    <Mic size={16} className="text-[#17a398]" />
                    <span className="text-xs font-mono font-black uppercase tracking-wider">
                      DISCOVER ARTISTS ({allArtists.length})
                    </span>
                  </div>
                  <div className={`text-[10px] font-mono font-black px-2 py-0.5 brutal-border ${
                    isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
                  }`}>
                    DISCOGRAPHY
                  </div>
                </div>

                {allArtists.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {allArtists.map((art) => (
                      <div
                        key={`browse-art-${art.name}`}
                        onClick={() => onSelectArtist && onSelectArtist(art.name)}
                        className={`p-3.5 rounded-xl brutal-border flex items-center justify-between cursor-pointer transition hover:translate-x-1 hover:-translate-y-0.5 brutal-shadow-sm group ${
                          isDark ? 'bg-[#182320] border-zinc-700 hover:bg-[#202f2b] text-white' : 'bg-[#ede5d3] border-black hover:bg-white text-[#0b1110]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                          <div className="w-12 h-12 rounded-full bg-[#082621] border-2 border-[#17a398] flex items-center justify-center font-bold text-sm text-[#26c4b7] overflow-hidden shrink-0">
                            {art.cover ? (
                              <img src={art.cover} alt={art.name} className="w-full h-full object-cover" />
                            ) : (
                              <Mic size={20} />
                            )}
                          </div>
                          <div className="truncate flex-1 min-w-0">
                            <p className="font-display font-black text-sm truncate group-hover:text-[#17a398] transition-colors">
                              {art.name}
                            </p>
                            <span className={`text-[11px] font-mono truncate block mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                              {art.count} {art.count === 1 ? 'song' : 'songs'}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectArtist && onSelectArtist(art.name);
                          }}
                          className="px-2.5 py-1 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-display font-bold text-xs rounded-lg brutal-border brutal-btn shrink-0 cursor-pointer"
                        >
                          View Artist →
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`brutal-border-thick p-8 text-center max-w-md mx-auto my-6 ${
                    isDark ? 'bg-[#0b1110] border-zinc-700 text-white' : 'bg-[#ede5d3] border-black text-[#0b1110]'
                  }`}>
                    <Mic size={32} className="mx-auto text-zinc-500 mb-2" />
                    <h3 className="font-display font-bold text-sm">No Artists Yet</h3>
                    <p className={`text-xs font-mono mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      Add songs to your library or import albums to discover artist pages.
                    </p>
                  </div>
                )}
              </div>
            ) : filterType === 'albums' ? (
              /* ── Discover Albums View ── */
              <div>
                <div className={`flex justify-between items-center pb-3 mb-4 border-b-2 ${
                  isDark ? 'border-zinc-700 text-zinc-300' : 'border-[#0b1110] text-[#082621]'
                }`}>
                  <div className="flex items-center gap-2">
                    <Disc size={16} className="text-[#17a398]" />
                    <span className="text-xs font-mono font-black uppercase tracking-wider">
                      DISCOVER ALBUMS ({(albums || []).length})
                    </span>
                  </div>
                  <div className={`text-[10px] font-mono font-black px-2 py-0.5 brutal-border ${
                    isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
                  }`}>
                    OFFICIAL ALBUMS
                  </div>
                </div>

                {(albums || []).length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {(albums || []).map((alb) => (
                      <div
                        key={`browse-alb-${alb.id || alb._id}`}
                        onClick={() => onSelectPlaylist && onSelectPlaylist(alb)}
                        className={`p-3 rounded-xl brutal-border flex flex-col justify-between cursor-pointer transition hover:translate-x-0.5 hover:-translate-y-0.5 brutal-shadow-sm group ${
                          isDark ? 'bg-[#182320] border-zinc-700 hover:bg-[#202f2b] text-white' : 'bg-[#ede5d3] border-black hover:bg-white text-[#0b1110]'
                        }`}
                      >
                        <div className="w-full aspect-square rounded-lg bg-black/10 brutal-border overflow-hidden mb-2">
                          <img 
                            src={alb.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400'} 
                            alt={alb.name} 
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                            onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400'; }}
                          />
                        </div>
                        <div className="truncate">
                          <p className="font-display font-black text-xs sm:text-sm truncate group-hover:text-[#17a398] transition-colors">
                            {alb.name}
                          </p>
                          <p 
                            onClick={(e) => {
                              if (onSelectArtist && alb.artist) {
                                e.stopPropagation();
                                onSelectArtist(alb.artist);
                              }
                            }}
                            className={`text-[10px] font-mono hover:underline cursor-pointer truncate mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
                          >
                            {alb.artist || 'Artist'} • {(alb.trackIds || []).length} songs
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={`brutal-border-thick p-8 text-center max-w-md mx-auto my-6 ${
                    isDark ? 'bg-[#0b1110] border-zinc-700 text-white' : 'bg-[#ede5d3] border-black text-[#0b1110]'
                  }`}>
                    <Disc size={32} className="mx-auto text-zinc-500 mb-2" />
                    <h3 className="font-display font-bold text-sm">No Albums Detected Yet</h3>
                    <p className={`text-xs font-mono mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      When songs from an album are uploaded or added, they appear here automatically.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* ── Browse Categories / Genres ── */
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

                {/* 2-Column Grid */}
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
        )}
      </div>
    </div>
  </div>
);
}
