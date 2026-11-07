import React, { useState, useMemo } from 'react';
import { 
  Play, Pause, Plus, Heart, Search, BookOpen, DownloadCloud, Radio, 
  Link2, Disc, User, Check, Sparkles, Volume2, ArrowRight, ArrowLeft
} from 'lucide-react';
import QuranRadioModal from '../components/QuranRadioModal';
import QuranSurahsTab from '../components/quran/QuranSurahsTab';
import QuranPlaylistsTab from '../components/quran/QuranPlaylistsTab';
import QuranHeroBanner from '../components/quran/QuranHeroBanner';
import { useTranslation } from '../context/PreferencesContext';
import { 
  isQuranContent, 
  getQuranReciterName, 
  cleanQuranTrackTitle, 
  normalizeArabicText,
  sortQuranTracks,
  getSurahNumber,
  getSurahName,
  isRadioTrack
} from '../utils/quranUtils';
import {
  getQuranRecitersList,
  getSurahsForReciter,
  filterQuranSurahs,
  fetchMp3QuranReciters,
} from '../utils/quranRecitersService';

export default function QuranScreen({
  tracks = [],
  playlists = [],
  onSelectTrack,
  onSelectPlaylist,
  onSelectArtist,
  toggleLike,
  openCreatePlaylistModal,
  openImportPlaylistModal,
  openImportSongModal,
  openAddSongModal,
  currentTrack,
  isPlaying,
  globalTheme = 'dark',
}) {
  const isDark = globalTheme === 'dark';
  const { t, isRTL } = useTranslation();
  const [activeTab, setActiveTab] = useState('reciters'); // Default is reciters view per user request
  const [selectedReciter, setSelectedReciter] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRadioOpen, setIsRadioOpen] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(50);

  React.useEffect(() => {
    setVisibleLimit(50);
  }, [searchQuery, activeTab, selectedReciter]);

  // Strictly filter only Quranic tracks & playlists with robust deduplication
  const quranTracks = useMemo(() => {
    const raw = (tracks || []).filter(t => isQuranContent(t) && !isRadioTrack(t));
    const seenAudio = new Set();
    const seenMeta = new Set();
    const deduped = [];
    for (const t of raw) {
      const reciter = getQuranReciterName(t, playlists);
      const cleanTitle = cleanQuranTrackTitle(t.title || '');
      const metaKey = `${normalizeArabicText(reciter)}:::${normalizeArabicText(cleanTitle)}`;
      
      let audioKey = null;
      if (t.audioUrl && typeof t.audioUrl === 'string' && t.audioUrl.length > 10) {
        const ytMatch = t.audioUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || t.audioUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
        audioKey = ytMatch ? `yt:${ytMatch[1]}` : `url:${t.audioUrl.trim().toLowerCase()}`;
      }

      if (audioKey && seenAudio.has(audioKey)) {
        continue;
      }
      if (metaKey && seenMeta.has(metaKey)) {
        continue;
      }

      if (audioKey) seenAudio.add(audioKey);
      if (metaKey) seenMeta.add(metaKey);
      deduped.push(t);
    }
    return deduped;
  }, [tracks, playlists]);

  const quranPlaylists = useMemo(() => {
    return (playlists || []).filter(p => isQuranContent(p) && !isRadioTrack(p) && !/إذاعة|اذاعة|راديو|بث مباشر/i.test(p.name || ''));
  }, [playlists]);

  const [apiReciters, setApiReciters] = useState([]);

  // Fetch full mp3quran reciters catalog asynchronously in background with cancellation support
  React.useEffect(() => {
    const controller = new AbortController();
    fetchMp3QuranReciters(controller.signal)
      .then((list) => {
        if (!controller.signal.aborted && Array.isArray(list) && list.length > 0) {
          setApiReciters(list);
        }
      })
      .catch(() => {});
    return () => {
      try { controller.abort(); } catch {}
    };
  }, []);

  // Reciters catalog combining canonical famous reciters (114 surahs each), custom DB reciters, and mp3quran
  const reciters = useMemo(() => {
    return getQuranRecitersList({ quranTracks, apiReciters });
  }, [quranTracks, apiReciters]);

  // Full Surahs Catalog (1 to 114) for selected reciter with instant CDN playback
  const reciterTracks = useMemo(() => {
    if (!selectedReciter) return [];
    return getSurahsForReciter(selectedReciter, { quranTracks, apiReciters });
  }, [selectedReciter, quranTracks, apiReciters]);

  // Filtered tracks with canonical Quranic sorting (1 to 114)
  const filteredTracks = useMemo(() => {
    if (!searchQuery.trim()) {
      return selectedReciter ? reciterTracks : sortQuranTracks(quranTracks);
    }
    const source = selectedReciter ? reciterTracks : quranTracks;
    return filterQuranSurahs(source, searchQuery);
  }, [selectedReciter, reciterTracks, quranTracks, searchQuery]);

  const filteredPlaylists = useMemo(() => {
    if (!searchQuery.trim()) return quranPlaylists;
    const q = searchQuery.toLowerCase().trim();
    const normQ = normalizeArabicText(q);

    return quranPlaylists.filter(p => {
      const reciter = getQuranReciterName(p, quranPlaylists);
      const name = p.name || '';
      const desc = p.description || '';

      const combined = `${name} ${desc} ${reciter}`;
      const normCombined = normalizeArabicText(combined);

      return normCombined.includes(normQ) || combined.toLowerCase().includes(q);
    });
  }, [quranPlaylists, searchQuery]);

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

  return (
    <div 
      className={`flex-1 overflow-y-auto select-none p-4 sm:p-6 ${
        isDark ? 'bg-[#081715] text-[#fdfbf7]' : 'bg-[#0f4c45] text-[#fdfbf7]'
      }`}
      style={{ paddingBottom: 'calc(var(--player-height) + 40px)' }}
    >
      {/* ── Quran Hero Banner ── */}
      <QuranHeroBanner
        isRTL={isRTL}
        t={t}
        filteredTracks={filteredTracks}
        onSelectTrack={onSelectTrack}
        openImportPlaylistModal={openImportPlaylistModal}
        openImportSongModal={openImportSongModal}
        openCreatePlaylistModal={openCreatePlaylistModal}
        quranTracksCount={quranTracks.length}
        quranPlaylistsCount={quranPlaylists.length}
      />

      {/* ── LIVE QURAN RADIO HERO BAR ── */}
      <div 
        onClick={() => setIsRadioOpen(true)}
        className="mb-5 p-3.5 rounded-xl bg-gradient-to-r from-[#0d1f1c] via-[#14332e] to-[#0d1f1c] border-2 border-[#d4af37]/50 flex items-center justify-between cursor-pointer hover:border-[#d4af37] transition-all shadow-[0_0_25px_rgba(212,175,55,0.2)] group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#d4af37]/20 border border-[#d4af37]/50 flex items-center justify-center text-[#d4af37] group-hover:scale-110 transition-transform">
            <Radio size={20} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-black text-sm text-[#fdfbf7]">{t('quran.radioLive')}</span>
              <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse">🔴 {t('quran.liveBadge')}</span>
            </div>
            <p className="text-xs text-emerald-200/80 font-medium">{t('quran.radioDesc')}</p>
          </div>
        </div>
        <button className="hidden sm:flex items-center gap-2 bg-[#d4af37] text-black font-display font-black text-xs px-4 py-2 rounded-xl shadow group-hover:bg-[#f1c40f] transition-all">
          <Play size={14} fill="currentColor" />
          <span>{t('quran.chooseStation')}</span>
        </button>
      </div>

      {/* ── Navigation Tabs & Search ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            data-radio-tab-btn="true"
            onClick={() => setIsRadioOpen(true)}
            className="px-3.5 py-2 rounded-lg text-xs font-display font-black transition-all brutal-btn whitespace-nowrap cursor-pointer bg-gradient-to-r from-amber-500 to-amber-400 text-black border border-black shadow-[0_0_15px_rgba(245,158,11,0.3)] flex items-center gap-1.5 shrink-0"
          >
            <Radio size={14} className="text-black animate-pulse" />
            <span>{t('quran.radioLive')}</span>
          </button>
          {[
            { id: 'reciters', label: t('quran.tabReciters', { count: reciters.length }) },
            { id: 'playlists', label: t('quran.tabPlaylists', { count: quranPlaylists.length }) },
            { 
              id: 'surahs', 
              label: selectedReciter 
                ? t('quran.tabSurahsOfSheikh', { name: selectedReciter.split(' ')[0], count: reciterTracks.length })
                : t('quran.tabSurahs', { count: quranTracks.length })
            },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-display font-bold transition-all brutal-btn whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-[#26c4b7] text-[#041d1a] font-black brutal-border brutal-shadow-sm'
                    : isDark
                      ? 'bg-[#102421] text-emerald-200 border border-emerald-900/80 hover:bg-[#15312d]'
                      : 'bg-[#fdfbf7] text-[#0b1110] brutal-border hover:bg-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search Bar inside Quran */}
        <div className="relative w-full sm:w-72">
          <Search size={15} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-emerald-400/70 pointer-events-none`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('quran.searchPlaceholder')}
            className={`w-full text-xs font-bold ${isRTL ? 'pr-9 pl-3 text-right' : 'pl-9 pr-3 text-left'} py-2 rounded-lg brutal-border focus:outline-none transition-colors ${
              isDark 
                ? 'bg-[#0c201d] text-white border-emerald-800 placeholder-emerald-400/50 focus:bg-[#102a26]' 
                : 'bg-[#fdfbf7] text-[#0b1110] border-black placeholder-zinc-500 focus:bg-white'
            }`}
          />
        </div>
      </div>

      {/* ── TAB 1: SURAHS & TRACKS ── */}
      {activeTab === 'surahs' && (
        <QuranSurahsTab
          selectedReciter={selectedReciter}
          setSelectedReciter={setSelectedReciter}
          setActiveTab={setActiveTab}
          filteredTracks={filteredTracks}
          reciters={reciters}
          searchQuery={searchQuery}
          onSelectTrack={onSelectTrack}
          isTrackActive={isTrackActive}
          isPlaying={isPlaying}
          formatDuration={formatDuration}
          toggleLike={toggleLike}
          visibleLimit={visibleLimit}
          setVisibleLimit={setVisibleLimit}
          quranPlaylists={quranPlaylists}
          openImportPlaylistModal={openImportPlaylistModal}
          isDark={isDark}
          t={t}
        />
      )}

      {/* ── TAB 2: PLAYLISTS & MUSHAFS ── */}
      {activeTab === 'playlists' && (
        <QuranPlaylistsTab
          filteredPlaylists={filteredPlaylists}
          quranPlaylists={quranPlaylists}
          onSelectPlaylist={onSelectPlaylist}
          openImportPlaylistModal={openImportPlaylistModal}
          isDark={isDark}
          t={t}
        />
      )}

      {/* ── TAB 3: RECITERS ── */}
      {activeTab === 'reciters' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
          {reciters.map((reciter, idx) => (
            <div
              key={idx}
              onClick={() => {
                setSelectedReciter(reciter.name);
                setSearchQuery('');
                setActiveTab('surahs');
              }}
              className={`p-3.5 rounded-xl brutal-border text-center cursor-pointer transition-all hover:scale-[1.02] group ${
                isDark 
                  ? 'bg-[#0e221f] border-emerald-900 hover:bg-[#14322d]' 
                  : 'bg-[#fdfbf7] border-[#082621] hover:bg-white shadow-sm'
              }`}
            >
              <div className="w-16 h-16 rounded-full mx-auto mb-2.5 brutal-border overflow-hidden bg-[#041d1a] ring-2 ring-[#26c4b7]/30 group-hover:scale-105 transition-transform">
                <img 
                  src={reciter.cover || 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=300'} 
                  alt={reciter.name} 
                  className="w-full h-full object-cover" 
                  onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1609599006353-e629aaabfeae?w=300'; }}
                />
              </div>
              <h4 className={`text-xs sm:text-sm font-display font-black truncate px-1 ${
                isDark 
                  ? 'text-white group-hover:text-[#26c4b7]' 
                  : 'text-[#0b1110] group-hover:text-[#0f756d]'
              }`}>
                {reciter.name}
              </h4>
              <p className={`text-[10px] font-mono font-bold mt-1 ${
                isDark ? 'text-[#26c4b7]' : 'text-[#084c41]'
              }`}>
                {t('quran.surahsCount', { count: reciter.count })}
              </p>
            </div>
          ))}
        </div>
      )}
      <QuranRadioModal isOpen={isRadioOpen} onClose={() => setIsRadioOpen(false)} globalTheme={globalTheme} />
    </div>
  );
}
