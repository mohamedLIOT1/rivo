import React, { useState, useMemo } from 'react';
import { Play, Pause, Plus, Heart, Radio, MessageSquare, Sparkles, Disc, Activity, Trash2, Edit2, MoreVertical } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import TrackActionMenuModal from '../components/TrackActionMenuModal';
import VerifiedBadge from '../components/VerifiedBadge';
import { ArtistLinks } from '../utils/artistUtils';
import { isQuranContent } from '../utils/quranUtils';
import { useAudioPlayer } from '../context/AudioContext';
import { getAlbumArtwork } from './ArtistScreen';
const MEGA_HITS = [
  'el bakht', 'البخت', 'el keif', 'الكيف', 'kan lak maaya', 'kan lak ma3aya', 'كان لك معايا',
  'ya abyad ya eswed', 'يا ابيض يا اسود', 'dorak gai', 'دورك جاي', 'ghaba', 'غابة',
  'el gemeza', 'الجميزة', 'sheraton', 'شيراتون', 'tamally maak', 'تملي معاك', 'nour el ein', 'نور العين',
  'habibi leh', 'حبيبي ليه', 'law kan', 'لو كان', 'kol haga betaady', 'كل حاجة بتعدي',
  'layla', 'ليلى', 'dinosaur', 'داينصور', 'betetmahey', 'بتتمحي', 'asef', 'اسف',
  'mab2etsh bahes', 'مابقتش باحس', 'roma', 'روما', 'james dean', 'جيمس دين',
  'ethbat makanak', 'اثبت مكانك', 'barbary', 'بربري', 'control', 'كنترول', 'sindbad', 'سندباد',
  'el halal', 'الحلال', 'tesla', 'تسلا', 'alshan feena', 'علشان فينا', 'tayer', 'طاير',
  'rivo', 'ريفو', '21', 'واحد وعشرين', 'keify keda', 'keif keda', 'كيفي كده', 'salka', 'سلكة',
  'asyad el balad', 'اسياد البلد', 'bazet', 'باظت', 'matigy n3eesh', 'ما تيجى نعيش',
  'leh benkhaby', 'ليه بنخبي', 'baet waheed', 'بقيت وحيد', 'seneen', 'سنين',
  'back to black', 'starboy'
];

const MAJOR_HITS = [
  'marboot be astek', 'marbout be astek', 'مربوط باستيك', 'مربوط بآستيك', 'noaata beida', 'نقطة بيضا',
  'nas w nas', 'ناس وناس', 'ناس و ناس', 'akher oghnya', 'اخر اغنية', 'ana el sout', 'أنا الصوت',
  'matkhafsh men el hokooma', 'متخافش من الحكومة', 'ghammed einak', 'غمض عينك',
  'samurai', 'ساموراي', 'basrah w atooho', 'بسرح واتوه', 'nefsy ahebbek', 'نفسي احبك',
  'helmy ana', 'حلمي انا', 'aandi fekra', 'عندي فكرة', 'zay shams w qamar', 'زي شمس وقمر',
  'zina', 'زينة', 'salamat', 'سلامات', 'mesh bel hazout', 'مش بالحظوظ', 'khashab', 'خشب',
  'bayaa', 'بياعة', 'kollaha ghaleyat', 'كلها غيرانة', 'ekhteyarat', 'اختياراتي',
  'tegy ntrahan', 'تيجي نتراهن', 'el mohakma', 'المحكمة', '24 kiraat', '24 قيراط',
  'batal 3alam', 'ابطال العالم', '7adota almany', 'haddouta almany', 'حدوتة الماني',
  'drogba', 'دروجبا', 'yom gedid', 'يوم جديد', 'saa\'b el ekhteyar', 'صعب الاختيار',
  'wayah', 'وياه', 'ragea', 'راجع', 'aks baad', 'عكس بعض', 'helwa el bedayat', 'حلوة البدايات',
  'wana maak', 'وانا معاك', 'hayeish yeftekerni', 'هيعيش يفتكرني', 'kol hayaty', 'كل حياتي',
  'ya ana ya la', 'يا انا يا لاء', 'amaken el sahar', 'اماكن السهر', 'enta el haz', 'انت الحظ',
  'tutu', 'توتو', 'awghad', 'أوغاد', 'hokomdar', 'حكمدار', 'balad el ghorba', 'بلد الغربة',
  'agzakhana', 'اجزاخانة', 'placebo', 'بلاسيبو', 'plan-b', 'بلان بي', 'tafeh', 'تفه',
  'tany', 'ثاني', 'mafesh mane3', 'مفيش مانع', 'fel galeed', 'في الجليد', 'tharthara', 'ثرثرة',
  'afareet', 'عفاريت', 'salmonella', 'سالمونيلا', 'el ghasala', 'الغسالة', 'khamsa', 'خمسة'
];

const ARTIST_GLOBAL_SCORES = {
  'wegz': 1600000,
  'cairokee': 1500000,
  'cairokeeofficial': 1500000,
  'amr diab': 1400000,
  'marwan pablo': 1300000,
  'amir eid': 1200000,
  'tul8te': 1100000,
  'lege-cy': 1050000,
  'marwan moussa': 1000000,
  'tamer ashour': 900000,
  'sherine': 900000,
  'mohamed mounir': 850000,
  'hamaki': 850000,
  'el joker': 800000
};

function normalizeArabicText(str = '') {
  return String(str)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^a-z0-9\u0600-\u06FF]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NORM_MEGA_HITS = MEGA_HITS.map(h => normalizeArabicText(h));
const NORM_MAJOR_HITS = MAJOR_HITS.map(h => normalizeArabicText(h));
const ARTIST_SCORES_ENTRIES = Object.entries(ARTIST_GLOBAL_SCORES);

export function getGlobalTrackScore(t) {
  if (!t) return 0;
  const normTitle = normalizeArabicText(t.title);
  const normArtist = normalizeArabicText(t.artist);
  let score = 0;

  // Real platform plays, views & likes
  const plays = Number(t.plays) || 0;
  const views = Number(t.views) || 0;
  const likes = Number(t.likes) || 0;
  score += plays * 100000;
  score += views;
  score += likes * 50000;
  if (t.popular) score += 10000000;

  // Global Mega Hits
  for (let i = 0; i < NORM_MEGA_HITS.length; i++) {
    const nh = NORM_MEGA_HITS[i];
    if (normTitle === nh || normTitle.includes(nh)) {
      score += 20000000;
      break;
    }
  }

  // Major Hits
  for (let i = 0; i < NORM_MAJOR_HITS.length; i++) {
    const nh = NORM_MAJOR_HITS[i];
    if (normTitle === nh || normTitle.includes(nh)) {
      score += 10000000;
      break;
    }
  }

  // Artist Global Stature
  for (let i = 0; i < ARTIST_SCORES_ENTRIES.length; i++) {
    const [art, weight] = ARTIST_SCORES_ENTRIES[i];
    if (normArtist.includes(art)) {
      score += weight;
      break;
    }
  }

  return score;
}

export default function HomeScreen({ 
  tracks = [], 
  playlists = [], 
  albums = [], 
  artists = [], 
  onSelectTrack, 
  onSelectPlaylist, 
  toggleLike, 
  onSelectArtist,
  openAddSongModal,
  openEditSongModal,
  onDeleteTrack,
  openAddToPlaylist,
  currentTrack,
  isPlaying,
  currentUser,
  logout = () => {},
  openAuthModal = () => {},
  openProfileScreen = () => {},
  openJamModal = () => {},
  jamSession = null,
  openChatModal = () => {},
  unreadChatCount = 0,
  isActivityPanelOpen = false,
  toggleActivityPanel = () => {},
  globalTheme = 'dark',
}) {
  const isDark = globalTheme === 'dark';
  const { addToQueue } = useAudioPlayer();
  const [activeFilter, setActiveFilter] = useState('all');
  const [deleteConfirmTrackId, setDeleteConfirmTrackId] = useState(null);
  const [actionMenuTrack, setActionMenuTrack] = useState(null);
  const [visibleCount, setVisibleCount] = useState(36);

  const isTrackActive = (t) => {
    if (!currentTrack || !t) return false;
    const curId = currentTrack.id || currentTrack._id;
    const tId = t.id || t._id;
    return Boolean(curId && tId && String(curId) === String(tId));
  };

  // Filtered tracks (Strictly excluding Quran content from Music Home)
  const displayTracks = useMemo(() => {
    return (tracks || []).filter(t => !isQuranContent(t));
  }, [tracks]);

  // Sort tracks by global popularity with single-pass score caching (O(N) scoring instead of O(N log N * hits))
  const popularTracks = useMemo(() => {
    const scoreMap = new Map();
    for (let i = 0; i < displayTracks.length; i++) {
      const t = displayTracks[i];
      scoreMap.set(t, getGlobalTrackScore(t));
    }
    const list = [...displayTracks];
    return list.sort((a, b) => {
      const scoreA = scoreMap.get(a) || 0;
      const scoreB = scoreMap.get(b) || 0;
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }
      return (a.title || '').localeCompare(b.title || '');
    });
  }, [displayTracks]);

  // Strictly filter out any Quran recitations/albums from Featured Albums on Home
  const displayAlbums = useMemo(() => {
    return (albums || []).filter(alb => !isQuranContent(alb));
  }, [albums]);

  // Preset vibrant badge colors for blister packs
  const badgeColors = ['#0f756d', '#111615', '#17a398', '#dc2626', '#f59e0b', '#1e3a8a', '#082621', '#3b82f6'];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div 
      className={`flex-1 overflow-y-auto select-none p-3.5 sm:p-6 ${
        isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'
      }`}
      style={{ 
        paddingBottom: 'calc(var(--player-height) + 40px)',
        WebkitOverflowScrolling: 'touch',
        willChange: 'scroll-position',
      }}
    >
      {/* ─────────────────────────────────────────
          HERO BANNER (MUSIC STREAMING LAB)
          ───────────────────────────────────────── */}
      <section className="mb-6 bg-[#082621] rounded-2xl brutal-border-thick p-5 sm:p-7 text-[#fdfbf7] brutal-shadow-teal relative overflow-hidden">
        
        {/* Large Background Watermark */}
        <div className="absolute -right-6 -bottom-10 opacity-10 text-white font-display font-black text-9xl select-none pointer-events-none tracking-tighter">
          RIVO
        </div>

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sm:gap-6 relative z-10">
          
          {/* Left Text & CTA */}
          <div className="max-w-xl text-left w-full">
            <div className="inline-flex items-center gap-1.5 bg-[#fdfbf7] text-[#0b1110] px-2.5 py-0.5 rounded-full brutal-border text-[10px] sm:text-xs font-display font-bold mb-2.5 brutal-shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#17a398] animate-pulse"></span>
              <span>🎵 UNLIMITED HI-FI STREAMING • CAIRO MUSIC LAB</span>
            </div>

            <h1 className="font-display text-2xl sm:text-4xl lg:text-5xl font-black leading-tight mb-2 tracking-tight text-white">
              {getGreeting()}, <span className="text-[#17a398]">{currentUser?.name ? currentUser.name.split(' ')[0] : 'Listener'}</span>.
            </h1>

            <p className="text-emerald-100/90 text-xs sm:text-sm font-medium leading-relaxed mb-3.5 line-clamp-2 sm:line-clamp-none">
              Stream Egyptian rap, indie hits, retro cassettes, and personalized mixes. Crystal-clear 24-bit audio, zero ads, seamless listening.
            </p>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button 
                onClick={() => {
                  if (popularTracks.length > 0) {
                    onSelectTrack(popularTracks[0], popularTracks);
                  }
                }}
                className="flex-1 sm:flex-initial bg-[#fdfbf7] hover:bg-white text-[#0b1110] font-display font-black text-xs sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl brutal-border brutal-shadow-sm brutal-btn flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play size={15} fill="currentColor" />
                <span>PLAY TOP CHARTS</span>
              </button>

              <button 
                onClick={openAddSongModal}
                className="w-full sm:w-auto bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] font-display font-bold text-xs px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl brutal-border brutal-shadow-sm brutal-btn flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} strokeWidth={2.5} />
                <span>Add Track</span>
              </button>
            </div>
          </div>

          {/* Authentic Rivo Cassette Deck Graphic (Shown on tablets and desktop) */}
          <div className="hidden md:flex relative shrink-0 items-center justify-center self-center lg:self-auto mt-2 lg:mt-0">
            <div className="w-56 sm:w-64 bg-[#fdfbf7] text-[#0b1110] rounded-xl brutal-border-thick p-3.5 sm:p-4 brutal-shadow-lg transform rotate-2 hover:rotate-0 transition duration-300">
              <div className="border-2 border-dashed border-[#0b1110] rounded-lg p-2.5 sm:p-3 bg-white text-center">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold border-b-2 border-black pb-1 mb-2">
                  <span>RIVO SOUND LAB</span>
                  <span>HI-FI STEREO</span>
                </div>

                <div className="py-2">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-2 rounded-full bg-[#17a398] flex items-center justify-center brutal-border brutal-shadow-sm">
                    <Disc size={30} className="text-[#0b1110]" strokeWidth={2.2} />
                  </div>
                  <div className="font-display font-black text-lg sm:text-xl text-[#0b1110] leading-tight">RIVO CASSETTE</div>
                  <div className="text-[10px] sm:text-[11px] text-zinc-600 font-bold">Daily Tape Rotation</div>
                </div>

                <div className="bg-[#0b1110] text-[#17a398] text-[9px] sm:text-[10px] font-mono py-1 rounded mt-1.5 font-bold">
                  NOW STREAMING • ZERO ADS
                </div>
              </div>
            </div>

            {/* Serrated Starburst Badge Sticker */}
            <div className="sawtooth-badge w-20 h-20 sm:w-24 sm:h-24 bg-[#dc2626] text-white flex flex-col items-center justify-center p-2 text-center absolute -top-3 -right-3 sm:-top-4 sm:-right-4 transform -rotate-12 brutal-border shadow-md">
              <span className="font-display text-[8px] sm:text-[9px] font-bold">100%</span>
              <span className="font-display font-black text-sm sm:text-base leading-tight">STEREO</span>
              <span className="text-[7px] sm:text-[8px] font-mono font-bold">TOP PICKS</span>
            </div>
          </div>

        </div>
      </section>



      {/* ─────────────────────────────────────────
          FEATURED ALBUMS & DISCOGRAPHY SPOTLIGHT
          ───────────────────────────────────────── */}
      {displayAlbums && displayAlbums.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Disc size={20} className="text-amber-400" />
              <h2 className="font-display font-black text-xl text-[#fdfbf7] tracking-tight drop-shadow-[1.5px_1.5px_0px_#082621]">
                Featured Albums
              </h2>
              <span className="text-[10px] font-mono font-bold bg-[#0b1110] text-[#17a398] px-2 py-0.5 rounded-full brutal-border">
                {displayAlbums.length} {displayAlbums.length === 1 ? 'ALBUM' : 'ALBUMS'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {displayAlbums.slice(0, 6).map((alb) => (
              <div
                key={alb.id || alb._id || alb.name}
                onClick={() => onSelectPlaylist?.(alb)}
                className={`p-3 rounded-xl brutal-border brutal-shadow-sm cursor-pointer group transition-transform hover:-translate-y-1 ${
                  isDark ? 'bg-[#141d1b] border-zinc-700 hover:bg-[#182320]' : 'bg-[#fdfbf7] border-black hover:bg-white'
                }`}
              >
                <div className="relative aspect-square mb-2.5 overflow-hidden rounded-lg brutal-border bg-black/10">
                  <img
                    src={getAlbumArtwork(alb, alb.cover)}
                    alt={alb.name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600'; }}
                  />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-9 h-9 rounded-full bg-[#f59e0b] text-black flex items-center justify-center brutal-border brutal-shadow-sm shadow-md">
                      <Play size={16} fill="currentColor" className="ml-0.5" />
                    </div>
                  </div>
                </div>

                <div className={`font-display font-black text-xs truncate group-hover:text-[#17a398] transition-colors ${
                  isDark ? 'text-white' : 'text-[#0b1110]'
                }`}>
                  {alb.name}
                </div>

                <div 
                  onClick={(e) => {
                    if (onSelectArtist && alb.artist) {
                      e.stopPropagation();
                      onSelectArtist(alb.artist);
                    }
                  }}
                  className={`text-[10px] font-bold truncate hover:underline cursor-pointer ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  {alb.artist || 'Artist'}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────
          MOST POPULAR & TOP LISTENED TRACKS (SINGLE UNIFIED SECTION)
          ───────────────────────────────────────── */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-black text-xl text-[#fdfbf7] tracking-tight drop-shadow-[1.5px_1.5px_0px_#082621]">
              Most Popular & Top Listened
            </h2>
            <span className="text-[10px] font-mono font-bold bg-[#0b1110] text-[#17a398] px-2 py-0.5 rounded-full brutal-border">
              TOP CHARTS • GLOBAL HITS
            </span>
          </div>
          <span className="text-[11px] font-mono font-bold text-emerald-100/70">
            {popularTracks.length} Tracks
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {popularTracks.slice(0, visibleCount).map((track, index) => {
            const active = isTrackActive(track);
            const color = badgeColors[index % badgeColors.length];
            const durationFormatted = track.duration 
              ? `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}`
              : '3:45';

            return (
              <div 
                key={track.id || track._id || index}
                onClick={() => onSelectTrack(track, popularTracks)}
                className={`rounded-xl brutal-border p-3 flex flex-col justify-between cursor-pointer brutal-shadow-sm hover:brutal-shadow transition ${
                  isDark 
                    ? 'bg-[#141d1b] hover:bg-[#1a2623] border-zinc-700' 
                    : 'bg-[#fdfbf7] hover:bg-white text-[#0b1110]'
                } ${
                  active ? (isDark ? 'ring-2 ring-[#17a398] bg-[#1a2623]' : 'ring-2 ring-[#0b1110] bg-white') : ''
                }`}
              >
                <div>
                  <div 
                    className="w-full aspect-square rounded-lg brutal-border mb-2.5 p-2 flex flex-col justify-between relative overflow-hidden shrink-0 shadow-inner"
                    style={{ backgroundColor: color }}
                  >
                    {track.cover && (
                      <img 
                        src={track.cover} 
                        alt={track.title} 
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 w-full h-full object-cover opacity-35" 
                      />
                    )}
                    <div className="flex justify-between items-center z-10">
                      <span className="text-[8px] font-mono font-bold bg-black/70 px-1.5 py-0.5 rounded uppercase text-white">
                        HQ AUDIO
                      </span>
                      <div className="flex items-center gap-1">
                        {toggleLike && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLike(track.id || track._id);
                            }}
                            className="p-1 rounded bg-black/50 hover:bg-black text-white hover:text-[#dc2626] transition cursor-pointer"
                            title="Like"
                          >
                            <Heart size={11} fill={track.liked ? '#dc2626' : 'none'} className={track.liked ? 'text-[#dc2626]' : ''} />
                          </button>
                        )}
                        <span className="text-[9px] font-mono font-bold text-white bg-black/50 px-1 rounded">
                          {durationFormatted}
                        </span>
                      </div>
                    </div>

                    <div className="z-10 text-center my-auto px-1">
                      <div className="font-display font-black text-sm text-white drop-shadow-[1px_1px_0px_#000] truncate">
                        {track.title ? track.title.split('(')[0] : 'Untitled'}
                      </div>
                      <ArtistLinks
                        track={track}
                        onSelectArtist={onSelectArtist}
                        className="text-[10px] text-white/90 font-bold truncate block"
                        linkClassName="hover:underline cursor-pointer"
                      />
                    </div>

                    <div className="z-10 text-[8px] font-mono bg-black/60 px-1.5 py-0.5 rounded text-center truncate text-emerald-300 font-bold">
                      {track.genre || 'Egyptian Rx'}
                    </div>
                  </div>

                  <div className={`font-display font-bold text-xs truncate ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
                    {track.title}
                  </div>
                  <ArtistLinks
                    track={track}
                    onSelectArtist={onSelectArtist}
                    className={`text-[10px] font-bold truncate mb-2 block ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
                    linkClassName="hover:underline cursor-pointer"
                  />
                </div>

                <div className="flex items-center gap-1.5 w-full">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTrack(track, popularTracks);
                    }}
                    className="flex-1 bg-[#ded2bb] hover:bg-[#17a398] text-[#0b1110] font-display font-black text-[11px] py-1.5 rounded-lg brutal-border brutal-shadow-sm brutal-btn flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {active && isPlaying ? (
                      <>
                        <Pause size={12} fill="currentColor" />
                        <span>PAUSE</span>
                      </>
                    ) : (
                      <>
                        <Play size={12} fill="currentColor" />
                        <span>PLAY</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActionMenuTrack(track);
                    }}
                    className="p-1.5 rounded-lg bg-white hover:bg-[#17a398] text-zinc-700 hover:text-black brutal-border brutal-shadow-sm transition cursor-pointer shrink-0"
                    title="Track options"
                    aria-label="Track options"
                  >
                    <MoreVertical size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {visibleCount < popularTracks.length && (
          <div className="mt-6 flex justify-center pb-2">
            <button
              onClick={() => setVisibleCount(prev => prev + 36)}
              className="px-6 py-2.5 rounded-xl brutal-border brutal-shadow-sm font-display font-black text-xs uppercase bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] cursor-pointer transition active:scale-95"
            >
              Load More Tracks ({popularTracks.length - visibleCount} remaining)
            </button>
          </div>
        )}
      </section>

      {/* Confirm Delete Modal */}
      {deleteConfirmTrackId && (
        <ConfirmModal
          isOpen={Boolean(deleteConfirmTrackId)}
          onClose={() => setDeleteConfirmTrackId(null)}
          onConfirm={() => {
            onDeleteTrack(deleteConfirmTrackId);
            setDeleteConfirmTrackId(null);
          }}
          title="Delete Track?"
          message="Are you sure you want to remove this track from your library?"
          confirmText="Delete"
        />
      )}

      {/* Track 3-Dots Action Menu Modal */}
      {actionMenuTrack && (
        <TrackActionMenuModal
          isOpen={Boolean(actionMenuTrack)}
          onClose={() => setActionMenuTrack(null)}
          track={actionMenuTrack}
          onPlayTrack={onSelectTrack}
          onAddToQueue={addToQueue}
          openAddToPlaylist={openAddToPlaylist}
          openEditSongModal={openEditSongModal}
          onDeleteTrack={onDeleteTrack}
          currentUser={currentUser}
          globalTheme={globalTheme}
        />
      )}
    </div>
  );
}
