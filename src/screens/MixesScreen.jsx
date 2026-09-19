import React, { useState, useMemo, useEffect } from 'react';
import { 
  Play, Shuffle, Heart, Music, Disc, Sparkles, Volume2, Radio, 
  ArrowLeft, Search, RefreshCw, Zap
} from 'lucide-react';
import { useAudioPlayer } from '../context/AudioContext';
import { isQuranContent } from '../utils/quranUtils';
import { ArtistLinks } from '../utils/artistUtils';

const MOODS = [
  { 
    id: 'Daily', 
    label: 'Daily Mix ✨', 
    desc: 'Personalized mix dynamically generated from your first song of the day & daily taste',
    words: [],
    cover: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=600'
  },
  { 
    id: 'All', 
    label: 'All Vibes', 
    desc: 'Complete music collection across all styles',
    cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600'
  },
  { 
    id: 'Chill', 
    label: 'Chill ☕', 
    desc: 'Smooth lofi, acoustic, and laid-back rhythms', 
    words: ['chill', 'lofi', 'acoustic', 'ambient', 'slow', 'peace', 'relax', 'calm'],
    cover: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=600'
  },
  { 
    id: 'Energy', 
    label: 'Energy ⚡', 
    desc: 'High-octane rap, rock, trap, and heavy bass', 
    words: ['energy', 'rap', 'trap', 'rock', 'power', 'fast', 'drill', 'hype'],
    cover: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=600'
  },
  { 
    id: 'Happy', 
    label: 'Happy ☀️', 
    desc: 'Upbeat melodies, summer hits, and feel-good pop', 
    words: ['happy', 'pop', 'summer', 'dance', 'fun', 'joy', 'smile'],
    cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600'
  },
  { 
    id: 'Focus', 
    label: 'Focus 🧠', 
    desc: 'Instrumental concentration and study background', 
    words: ['focus', 'classical', 'instrumental', 'study', 'deep', 'piano'],
    cover: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?w=600'
  },
  { 
    id: 'Party', 
    label: 'Party 🎉', 
    desc: 'Club bangers, dance anthems, and festivals', 
    words: ['party', 'dance', 'edm', 'club', 'house', 'remix'],
    cover: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600'
  },
  { 
    id: 'Sad', 
    label: 'Sad 🌧️', 
    desc: 'Melancholic acoustics, heartbreak, and emotional depth', 
    words: ['sad', 'hurt', 'cry', 'alone', 'blue', 'heart', 'pain'],
    cover: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=600'
  },
  { 
    id: 'Workout', 
    label: 'Workout 💪', 
    desc: 'Pumping beats and high cadence rhythms', 
    words: ['workout', 'gym', 'run', 'cardio', 'pump', 'beast'],
    cover: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600'
  }
];

// ── 2x2 Collage Cover Component (blends covers of songs inside the mix) ──
function MixCoverCollage({ tracks = [], fallbackCover, moodLabel }) {
  const covers = useMemo(() => {
    const list = [];
    for (const t of tracks) {
      if (t?.cover && !list.includes(t.cover)) {
        list.push(t.cover);
      }
      if (list.length >= 4) break;
    }
    return list;
  }, [tracks]);

  return (
    <div className="w-44 h-44 md:w-52 md:h-52 bg-[#082621] brutal-border-thick brutal-shadow shrink-0 relative group overflow-hidden select-none">
      {covers.length >= 4 ? (
        <div className="w-full h-full grid grid-cols-2 grid-rows-2">
          {covers.slice(0, 4).map((c, i) => (
            <div key={i} className="relative overflow-hidden border-[0.5px] border-black/30 bg-black">
              <img 
                src={c} 
                alt="" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => { e.target.src = fallbackCover; }}
              />
            </div>
          ))}
        </div>
      ) : covers.length >= 2 ? (
        <div className="w-full h-full grid grid-cols-2">
          <div className="relative overflow-hidden border-r border-black/30 bg-black">
            <img 
              src={covers[0]} 
              alt="" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => { e.target.src = fallbackCover; }}
            />
          </div>
          <div className="relative overflow-hidden bg-black grid grid-rows-2">
            <img 
              src={covers[1]} 
              alt="" 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => { e.target.src = fallbackCover; }}
            />
            {covers[2] ? (
              <img 
                src={covers[2]} 
                alt="" 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 border-t border-black/30"
                onError={(e) => { e.target.src = fallbackCover; }}
              />
            ) : (
              <img 
                src={covers[0]} 
                alt="" 
                className="w-full h-full object-cover opacity-60 filter blur-xs"
                onError={(e) => { e.target.src = fallbackCover; }}
              />
            )}
          </div>
        </div>
      ) : (
        <img 
          src={covers[0] || fallbackCover} 
          alt={moodLabel} 
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
          onError={(e) => { e.target.src = fallbackCover; }}
        />
      )}

      {/* Retro Corner Badges */}
      <div className="absolute top-0 right-0 bg-[#0b1110] text-[#26c4b7] text-[9px] font-mono font-black px-1.5 py-0.5 z-10 border-b border-l border-black">
        RIVO-TAPE
      </div>
      <div className="absolute bottom-2 left-2 bg-[#082621]/90 text-[#f59e0b] text-[9px] font-mono font-black px-2 py-0.5 brutal-border z-10 flex items-center gap-1.5">
        {covers.length >= 2 && <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse" />}
        <span>{moodLabel.toUpperCase()}</span>
      </div>
    </div>
  );
}

export default function MixesScreen({ 
  tracks = [], 
  toggleLike, 
  onSelectArtist, 
  onBack,
  globalTheme = 'dark' 
}) {
  const isDark = globalTheme === 'dark';
  const [selectedMood, setSelectedMood] = useState('Daily');
  const [searchQuery, setSearchQuery] = useState('');
  const { playTrack, currentTrack, isPlaying, setCurrentQueue, setIsShuffle, setIsMixMode } = useAudioPlayer();

  // Daily listening seed track tracking (seeded from the first music track played today)
  const [dailySeed, setDailySeed] = useState(() => {
    try {
      const today = new Date().toDateString();
      const savedDate = localStorage.getItem('rivo_daily_seed_date') || localStorage.getItem('liofy_daily_seed_date');
      if (savedDate === today) {
        const raw = localStorage.getItem('rivo_daily_seed_track') || localStorage.getItem('liofy_daily_seed_track');
        if (raw) return JSON.parse(raw);
      }
      const lastRaw = localStorage.getItem('rivo_last_played_music_track') || localStorage.getItem('liofy_last_played_music_track');
      if (lastRaw) return JSON.parse(lastRaw);
    } catch {}
    return null;
  });

  // Listen for real-time seed updates when tracks are played
  useEffect(() => {
    const handleSeedUpdate = () => {
      try {
        const raw = localStorage.getItem('rivo_daily_seed_track') || localStorage.getItem('liofy_daily_seed_track');
        if (raw) setDailySeed(JSON.parse(raw));
      } catch {}
    };
    window.addEventListener('rivo:daily-seed-updated', handleSeedUpdate);
    window.addEventListener('liofy:daily-seed-updated', handleSeedUpdate);
    return () => {
      window.removeEventListener('rivo:daily-seed-updated', handleSeedUpdate);
      window.removeEventListener('liofy:daily-seed-updated', handleSeedUpdate);
    };
  }, []);

  // Strictly filter out any Quran content from music mixes
  const safeMusicTracks = useMemo(() => {
    return (tracks || []).filter(t => !isQuranContent(t));
  }, [tracks]);

  // If no seed exists yet, default to currentTrack if it's music or the first track
  useEffect(() => {
    if (!dailySeed && currentTrack && !isQuranContent(currentTrack)) {
      setDailySeed({
        id: currentTrack.id || currentTrack._id,
        title: currentTrack.title,
        artist: currentTrack.artist,
        genre: currentTrack.genre,
        cover: currentTrack.cover
      });
    }
  }, [currentTrack, dailySeed]);

  // Compute tracks matching selected mood or Daily seed
  const moodTracks = useMemo(() => {
    if (selectedMood === 'Daily') {
      const effectiveSeed = dailySeed || (currentTrack && !isQuranContent(currentTrack) ? currentTrack : safeMusicTracks[0]);
      if (!effectiveSeed) return safeMusicTracks;

      const seedTitle = (effectiveSeed.title || '').toLowerCase().trim();
      const seedArtist = (effectiveSeed.artist || '').toLowerCase().trim();
      const seedGenre = (effectiveSeed.genre || '').toLowerCase().trim();

      // Score tracks by similarity to daily seed
      const scored = safeMusicTracks.map(track => {
        let score = 0;
        const trackTitle = (track.title || '').toLowerCase().trim();
        const trackArtist = (track.artist || '').toLowerCase().trim();
        const trackGenre = (track.genre || '').toLowerCase().trim();

        // Exact seed track gets highest priority
        if (track.id && effectiveSeed.id && String(track.id) === String(effectiveSeed.id)) {
          score += 150;
        } else if (trackTitle === seedTitle) {
          score += 130;
        }

        // Same artist
        if (seedArtist && trackArtist && (trackArtist.includes(seedArtist) || seedArtist.includes(trackArtist))) {
          score += 50;
        }

        // Same genre
        if (seedGenre && trackGenre && (trackGenre.includes(seedGenre) || seedGenre.includes(trackGenre))) {
          score += 30;
        }

        // Keyword overlap
        const seedKeywords = `${seedArtist} ${seedGenre}`.split(/\s+/).filter(w => w.length > 2);
        for (const kw of seedKeywords) {
          if (`${trackTitle} ${trackArtist}`.includes(kw)) score += 15;
        }

        // Variety jitter so it forms a full rich mix
        const hash = (track.id || track.title || '').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        score += (hash % 10);

        return { track, score };
      });

      scored.sort((a, b) => b.score - a.score);
      return scored.map(s => s.track);
    }

    if (selectedMood === 'All') return safeMusicTracks;

    const moodObj = MOODS.find(m => m.id === selectedMood);
    const words = moodObj?.words || [];
    
    const matched = safeMusicTracks.filter(track => {
      const text = `${track.title || ''} ${track.artist || ''} ${track.genre || ''} ${track.album || ''}`.toLowerCase();
      return words.some(w => text.includes(w));
    });

    // Fallback: If strict keyword match yields less than 4 tracks, pad with general tracks
    if (matched.length < 4 && safeMusicTracks.length > 0) {
      const remaining = safeMusicTracks.filter(t => !matched.some(m => String(m.id || m._id) === String(t.id || t._id)));
      return [...matched, ...remaining.slice(0, Math.max(10, safeMusicTracks.length))];
    }
    return matched;
  }, [safeMusicTracks, selectedMood, dailySeed, currentTrack]);

  const filteredMoodTracks = useMemo(() => {
    if (!searchQuery.trim()) return moodTracks;
    const q = searchQuery.toLowerCase().trim();
    return moodTracks.filter(t => 
      (t.title && t.title.toLowerCase().includes(q)) ||
      (t.artist && t.artist.toLowerCase().includes(q)) ||
      (t.album && t.album.toLowerCase().includes(q))
    );
  }, [moodTracks, searchQuery]);

  const currentMoodObj = MOODS.find(m => m.id === selectedMood) || MOODS[0];

  const handleReSeedFromCurrent = () => {
    if (!currentTrack || isQuranContent(currentTrack)) return;
    const newSeed = {
      id: currentTrack.id || currentTrack._id,
      title: currentTrack.title,
      artist: currentTrack.artist,
      genre: currentTrack.genre,
      cover: currentTrack.cover
    };
    try {
      const todayStr = new Date().toDateString();
      const seedJson = JSON.stringify(newSeed);
      localStorage.setItem('rivo_daily_seed_date', todayStr);
      localStorage.setItem('liofy_daily_seed_date', todayStr);
      localStorage.setItem('rivo_daily_seed_track', seedJson);
      localStorage.setItem('liofy_daily_seed_track', seedJson);
    } catch {}
    setDailySeed(newSeed);
  };

  const handlePlayAll = (shuffle = false) => {
    if (!filteredMoodTracks.length) return;
    let queue = [...filteredMoodTracks];
    setIsMixMode?.(true);
    if (shuffle) {
      queue.sort(() => Math.random() - 0.5);
      setIsShuffle?.(true);
    }
    setCurrentQueue(queue);
    playTrack(queue[0]);
  };

  const handlePlayTrack = (track) => {
    setIsMixMode?.(true);
    setCurrentQueue(filteredMoodTracks);
    playTrack(track);
  };

  const isTrackActive = (t) => {
    if (!currentTrack || !t) return false;
    const curId = currentTrack.id || currentTrack._id;
    const tId = t.id || t._id;
    return Boolean(curId && tId && String(curId) === String(tId));
  };

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const totalDurationSum = useMemo(() => {
    const totalSecs = filteredMoodTracks.reduce((acc, t) => acc + (t.duration || 180), 0);
    const mins = Math.floor(totalSecs / 60);
    return `${mins} MIN`;
  }, [filteredMoodTracks]);

  return (
    <div 
      className={`flex-1 overflow-y-auto pb-32 select-none p-4 md:p-8 transition-colors ${
        isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'
      }`}
      style={{ paddingBottom: 'calc(var(--player-height) + 40px)' }}
    >
      {/* ── Apothecary Playlist Master Header (Matches PlaylistScreen UI) ── */}
      <div className={`brutal-border-thick brutal-shadow-lg p-6 md:p-8 mb-8 relative transition-colors ${
        isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#082621]'
      }`}>
        {/* Back button */}
        {onBack && (
          <button 
            onClick={onBack}
            className={`absolute top-4 left-4 brutal-btn p-2 brutal-border brutal-shadow-sm z-20 flex items-center gap-1 text-xs font-mono font-black uppercase cursor-pointer ${
              isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-zinc-700' : 'bg-[#fdfbf7] hover:bg-[#ede5d3] text-[#0b1110] border-black'
            }`}
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Return</span>
          </button>
        )}

        {/* Top vintage stamp */}
        <div className="flex justify-end items-center mb-4">
          <div className={`inline-flex items-center gap-2 px-3 py-1 brutal-border text-[10px] font-mono font-black uppercase ${
            isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
          }`}>
            <span>OFFICIAL AUDIO PRESCRIPTION</span>
            <span>•</span>
            <span>BATCH #MIX-{selectedMood.toUpperCase()}</span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center md:items-end gap-6 pt-2">
          {/* Cover Art Box: 2x2 Collage blend of tracks inside */}
          <MixCoverCollage 
            tracks={filteredMoodTracks} 
            fallbackCover={currentMoodObj.cover} 
            moodLabel={selectedMood} 
          />

          <div className="flex-1 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2 flex-wrap">
              <span className="bg-[#082621] text-[#26c4b7] text-[10px] font-mono font-black uppercase px-2.5 py-1 brutal-border">
                PLAYLIST
              </span>
              <span className="bg-[#26c4b7] text-[#082621] text-[10px] font-mono font-black uppercase px-2.5 py-1 brutal-border">
                SPOTIFY MIX DJ
              </span>
              <span className="bg-[#f59e0b] text-[#082621] text-[10px] font-mono font-black uppercase px-2.5 py-1 brutal-border">
                {selectedMood === 'Daily' ? 'DAILY PERSONALIZED' : 'DYNAMIC MIX'}
              </span>
            </div>

            <h1 className={`text-3xl sm:text-4xl md:text-5xl font-display font-black tracking-tight leading-tight ${
              isDark ? 'text-white' : 'text-[#0b1110]'
            }`}>
              {currentMoodObj.label}
            </h1>

            <p className={`text-xs sm:text-sm mt-2 font-medium max-w-xl ${
              isDark ? 'text-zinc-300' : 'text-[#082621]/80'
            }`}>
              {selectedMood === 'Daily' && dailySeed ? (
                <>
                  Dynamic mix generated from your first song of the day: <span className="font-bold text-[#17a398]">"{dailySeed.title}"</span> by <span className="font-bold">{dailySeed.artist}</span>. Automatically learns as you listen.
                </>
              ) : (
                <>{currentMoodObj.desc} • Curated continuous stream matching your current listening mood with automated DJ crossfades.</>
              )}
            </p>

            {/* Daily Seed Action Bar */}
            {selectedMood === 'Daily' && dailySeed && (
              <div className="mt-3 flex items-center justify-center md:justify-start gap-2 flex-wrap">
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono font-bold brutal-border ${
                  isDark ? 'bg-zinc-800/90 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] text-[#082621] border-black'
                }`}>
                  <Zap size={11} className="text-[#f59e0b]" />
                  <span>SEED: {dailySeed.title} ({dailySeed.artist})</span>
                </div>

                {currentTrack && !isQuranContent(currentTrack) && String(currentTrack.id || currentTrack._id) !== String(dailySeed.id) && (
                  <button
                    onClick={handleReSeedFromCurrent}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-mono font-bold brutal-border cursor-pointer brutal-btn transition-colors ${
                      isDark ? 'bg-[#17a398] text-[#0b1110] border-zinc-700' : 'bg-[#17a398] text-[#0b1110] border-black'
                    }`}
                    title="Change seed to currently playing track"
                  >
                    <RefreshCw size={10} />
                    <span>Re-seed with "{currentTrack.title?.slice(0, 16)}..."</span>
                  </button>
                )}
              </div>
            )}

            {/* Pill: PLAYLIST • X TRACKS • Y MIN */}
            <div className={`inline-flex items-center gap-2 mt-4 text-[11px] font-mono font-black uppercase tracking-wider ${
              isDark ? 'text-zinc-400' : 'text-[#082621]'
            }`}>
              <span className={`px-2 py-0.5 brutal-border ${
                isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] border-black'
              }`}>PLAYLIST</span>
              <span>•</span>
              <span>{filteredMoodTracks.length} TRACKS</span>
              <span>•</span>
              <span>{totalDurationSum}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Action Buttons & Search Row (Matches PlaylistScreen) ── */}
      <div className={`brutal-border brutal-shadow p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isDark ? 'bg-[#141d1b] border-zinc-700' : 'bg-[#fdfbf7] border-black'
      }`}>
        <div className="flex items-center flex-wrap gap-3">
          <button
            disabled={filteredMoodTracks.length === 0}
            onClick={() => handlePlayAll(false)}
            className={`brutal-btn w-12 h-12 brutal-border-thick brutal-shadow flex items-center justify-center transition-all ${
              filteredMoodTracks.length > 0
                ? 'bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] cursor-pointer'
                : 'bg-[#ded2bb] text-[#0b1110]/40 cursor-not-allowed'
            }`}
            title="Play mix"
          >
            <Play size={22} fill="currentColor" className="ml-0.5 text-[#0b1110]" />
          </button>

          <button
            disabled={filteredMoodTracks.length === 0}
            onClick={() => handlePlayAll(true)}
            className={`brutal-btn w-12 h-12 brutal-border-thick brutal-shadow flex items-center justify-center transition-all ${
              filteredMoodTracks.length > 0
                ? 'bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] cursor-pointer'
                : 'bg-[#ded2bb] text-[#0b1110]/40 cursor-not-allowed'
            }`}
            title="Shuffle mix"
          >
            <Shuffle size={20} className="text-[#0b1110]" />
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${
            isDark ? 'text-zinc-500' : 'text-[#082621]/60'
          }`} />
          <input
            type="text"
            placeholder="Search in mix tracks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full brutal-border pl-9 pr-4 py-2 text-xs font-mono focus:outline-none ${
              isDark 
                ? 'bg-[#0b1110] border-zinc-700 text-white placeholder-zinc-500 focus:bg-[#182320]' 
                : 'bg-[#ede5d3] border-black text-[#0b1110] placeholder-[#082621]/50 focus:bg-white'
            }`}
          />
        </div>
      </div>

      {/* ── Mood Selector Pills (Vibes) ── */}
      <div className="mb-6 flex flex-wrap gap-2">
        {MOODS.map(m => {
          const active = selectedMood === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setSelectedMood(m.id)}
              className={`px-3.5 py-2 rounded-lg text-xs font-mono font-bold transition-all brutal-btn cursor-pointer ${
                active
                  ? 'bg-[#17a398] text-[#0b1110] font-black brutal-border brutal-shadow-sm'
                  : isDark
                    ? 'bg-[#141d1b] text-zinc-300 border border-zinc-700 hover:bg-zinc-800'
                    : 'bg-[#fdfbf7] text-[#0b1110] brutal-border hover:bg-[#ede5d3]'
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* ── Tracks List (Matches PlaylistScreen grid & layout) ── */}
      <div className="mb-8">
        {filteredMoodTracks.length > 0 ? (
          <div className="space-y-2">
            {/* Table Header */}
            <div className={`grid grid-cols-12 text-[10px] font-mono font-black uppercase tracking-wider brutal-border p-2.5 ${
              isDark ? 'bg-[#101716] text-zinc-300 border-zinc-700' : 'bg-[#ded2bb] text-[#082621] border-black'
            }`}>
              <span className="col-span-1 text-center">#</span>
              <span className="col-span-6 md:col-span-5">TITLE & ARTIST</span>
              <span className="hidden md:block col-span-3">ALBUM</span>
              <span className="col-span-5 md:col-span-3 text-right pr-2">ACTIONS</span>
            </div>

            {filteredMoodTracks.map((track, i) => {
              const active = isTrackActive(track);
              return (
                <div
                  key={track.id || track._id || i}
                  onClick={() => handlePlayTrack(track)}
                  className={`grid grid-cols-12 items-center p-3 brutal-border brutal-shadow-sm hover:translate-x-1 transition-transform cursor-pointer group ${
                    active
                      ? isDark ? 'bg-[#1c2e29] border-[#17a398]' : 'bg-[#ede5d3] border-black font-black'
                      : isDark ? 'bg-[#141d1b] border-zinc-700 hover:bg-[#182320]' : 'bg-[#fdfbf7] border-black hover:bg-[#ede5d3]'
                  }`}
                >
                  <span className={`col-span-1 text-xs font-mono font-black text-center ${
                    active ? 'text-[#17a398]' : isDark ? 'text-zinc-400' : 'text-[#082621]'
                  }`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>

                  {/* Title & Artist */}
                  <div className="col-span-6 md:col-span-5 flex items-center gap-3 truncate pr-2">
                    <img 
                      src={track.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300'} 
                      alt={track.title} 
                      className="w-10 h-10 brutal-border object-cover shrink-0 bg-[#ede5d3]" 
                      onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=R&background=082621&color=26c4b7`; }}
                    />
                    <div className="truncate">
                      <h4 className={`text-xs sm:text-sm font-bold truncate transition-colors ${
                        active ? 'text-[#17a398]' : isDark ? 'text-white group-hover:text-[#17a398]' : 'text-[#0b1110] group-hover:text-[#0f756d]'
                      }`}>
                        {track.title}
                      </h4>
                      <ArtistLinks
                        track={track}
                        onSelectArtist={onSelectArtist}
                        className={`text-[10px] font-bold truncate block ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
                        linkClassName="hover:underline cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Album */}
                  <div className="hidden md:block col-span-3 text-xs font-mono truncate pr-2 text-zinc-500">
                    {track.album || 'Single'}
                  </div>

                  {/* Actions */}
                  <div className="col-span-5 md:col-span-3 flex items-center justify-end gap-3 text-right">
                    <span className="text-xs font-mono text-zinc-500">
                      {formatDuration(track.duration)}
                    </span>

                    {toggleLike && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleLike(track.id || track._id);
                        }}
                        className="p-1 rounded hover:scale-110 transition-transform cursor-pointer"
                      >
                        <Heart
                          size={15}
                          fill={track.liked ? '#dc2626' : 'none'}
                          className={track.liked ? 'text-[#dc2626]' : isDark ? 'text-zinc-500' : 'text-zinc-400'}
                        />
                      </button>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayTrack(track);
                      }}
                      className="w-8 h-8 rounded-lg bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border flex items-center justify-center brutal-btn shrink-0 cursor-pointer"
                      title="Play track"
                    >
                      {active && isPlaying ? (
                        <Volume2 size={14} className="animate-pulse" />
                      ) : (
                        <Play size={13} fill="currentColor" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`p-8 text-center rounded-xl brutal-border ${
            isDark ? 'bg-[#141d1b] border-zinc-700 text-zinc-400' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
          }`}>
            No tracks found matching your search.
          </div>
        )}
      </div>
    </div>
  );
}
