import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { usePreferences, useTranslation } from '../context/PreferencesContext';
import { Play, Plus, Disc } from 'lucide-react';
import { API_BASE_URL } from '../config';
import ConfirmModal from '../components/ConfirmModal';
import TrackActionMenuModal from '../components/TrackActionMenuModal';
import HomeTrackCard from '../components/HomeTrackCard';
import { isQuranContent } from '../utils/quranUtils';
import { useAudioPlayer } from '../context/AudioContext';
import { getAlbumArtwork } from './ArtistScreen';
import { sortTracksByPopularity, getGlobalTrackScore } from '../utils/trackPopularity';
import { getSmartTasteAndMoodTracks, getCurrentTimeMood } from '../utils/tasteAlgorithm';
import { getListeningStats } from '../utils/listeningTracker';
import { normalizeCoverUrl, handleCoverImageError } from '../utils/coverUtils';
import {
  get12hBucket,
  loadCachedAiMoodMix,
  saveCachedAiMoodMix,
  rotateAlbumsForWindow,
} from '../utils/aiMoodMixCache';

export { getGlobalTrackScore };

// Safely debounces and limits cached album list in localStorage to prevent main thread lockups
function cacheAlbumsToStorage(albumsList) {
  if (!Array.isArray(albumsList) || albumsList.length === 0 || typeof window === 'undefined') return;

  const persist = () => {
    try {
      // Limit to max 30 items and only store lightweight fields (prevent multi-MB payloads)
      const sliceLimit = Math.min(albumsList.length, 30);
      const slim = [];
      for (let i = 0; i < sliceLimit; i++) {
        const a = albumsList[i];
        if (!a) continue;
        slim.push({
          id: a.id || a._id,
          _id: a._id || a.id,
          name: a.name || a.title || '',
          title: a.title || a.name || '',
          artist: a.artist || '',
          cover: a.cover || '',
          trackCount: Number(a.trackCount || a.songsCount || (Array.isArray(a.tracks) ? a.tracks.length : (a.trackIds ? a.trackIds.length : 0))),
          releaseType: a.releaseType || '',
          genre: a.genre || '',
          isQuran: Boolean(a.isQuran)
        });
      }
      localStorage.setItem('rivo_albums', JSON.stringify(slim));
    } catch {}
  };

  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(persist, { timeout: 3000 });
  } else {
    setTimeout(persist, 1000);
  }
}

export default function HomeScreen({
  tracks = [],
  albums = [],
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
  globalTheme = 'dark',
}) {
  const isDark = globalTheme === 'dark';
  const { showMusic } = usePreferences();
  const { t, isRTL } = useTranslation();
  const { addToQueue } = useAudioPlayer();
  const [deleteConfirmTrackId, setDeleteConfirmTrackId] = useState(null);
  const [actionMenuTrack, setActionMenuTrack] = useState(null);
  const [visibleCount, setVisibleCount] = useState(36);
  const [showAllAlbums, setShowAllAlbums] = useState(false);

  // Filtered tracks (Strictly excluding Quran content from Music Home)
  const displayTracks = useMemo(() => (tracks || []).filter(tr => !isQuranContent(tr)), [tracks]);

  const cacheOwnerId = String(currentUser?.id || currentUser?._id || 'guest');
  const [aiMoodMix, setAiMoodMix] = useState(() => loadCachedAiMoodMix(cacheOwnerId, displayTracks) || []);

  const currentTrackId = currentTrack?.id || currentTrack?._id;
  const isTrackActive = useCallback((tr) => {
    if (!currentTrackId || !tr) return false;
    const tId = tr.id || tr._id;
    return Boolean(tId && String(currentTrackId) === String(tId));
  }, [currentTrackId]);

  // Sort tracks by global popularity with intelligent scoring and artist interleaving
  const popularTracks = useMemo(() => sortTracksByPopularity(displayTracks), [displayTracks]);

  const [fetchedAlbums, setFetchedAlbums] = useState(() => {
    try {
      const raw = localStorage.getItem('rivo_albums');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(a => {
            const count = Number(a.trackCount || a.songsCount || (Array.isArray(a.tracks) ? a.tracks.length : (a.trackIds ? a.trackIds.length : 0)));
            const type = (a.releaseType || '').toLowerCase();
            return type !== 'single' && count > 1;
          });
          if (valid.length > 0) return valid;
        }
      }
    } catch {}
    return (Array.isArray(albums) && albums.length > 0) ? albums : [];
  });

  const prevAlbumsLenRef = useRef(0);
  useEffect(() => {
    if (albums && albums.length > 0) {
      if (fetchedAlbums.length > 0 && albums.length === prevAlbumsLenRef.current) {
        return;
      }
      prevAlbumsLenRef.current = albums.length;
      const valid = albums.filter(a => {
        const count = Number(a.trackCount || a.songsCount || (Array.isArray(a.tracks) ? a.tracks.length : (a.trackIds ? a.trackIds.length : 0)));
        const type = (a.releaseType || '').toLowerCase();
        return type !== 'single' && count > 1;
      });
      if (valid.length > 0) {
        setFetchedAlbums(prev => {
          if (prev && prev.length === valid.length && prev[0]?.id === valid[0]?.id) return prev;
          return valid;
        });
      }
    }
  }, [albums, fetchedAlbums.length]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE_URL}/api/albums`, { signal: controller.signal })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!controller.signal.aborted && d?.success && Array.isArray(d.albums)) {
          const valid = d.albums.filter(a => {
            const count = Number(a.trackCount || a.songsCount || (Array.isArray(a.tracks) ? a.tracks.length : (a.trackIds ? a.trackIds.length : 0)));
            const type = (a.releaseType || '').toLowerCase();
            return type !== 'single' && count > 1;
          });
          setFetchedAlbums(valid);
          cacheAlbumsToStorage(valid);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const currentMood = getCurrentTimeMood();
  const bucket12h = get12hBucket();

  // Personalized AI Mood & Taste Recommendations (Persisted for 12 hours; instant read even before tracks hydrate)
  useEffect(() => {
    if (!showMusic) return;

    const cached = loadCachedAiMoodMix(cacheOwnerId, displayTracks);
    if (cached) {
      setAiMoodMix(cached);
      if (cached.__source === 'server') return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      const token = currentUser?.token || localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
      let followed = [];
      try {
        const raw = localStorage.getItem('rivo_followed_artists') || localStorage.getItem('liofy_followed_artists');
        if (raw) followed = JSON.parse(raw);
      } catch {}
      const localSeeds = displayTracks.length > 0
        ? getSmartTasteAndMoodTracks({
            allTracks: displayTracks,
            currentUser,
            followedArtists: followed,
            likedTrackIds: currentUser?.likedTrackIds || currentUser?.likedTracks || [],
            limit: 12,
          })
        : [];

      fetch(`${API_BASE_URL}/api/ai/mood-mix`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          mood: currentMood.id,
          timeOfDay: currentMood.id,
          seedTracks: localSeeds.slice(0, 5),
          followedArtists: followed,
          limit: 15,
          isQuran: false,
        }),
        signal: controller.signal,
      })
        .then(r => (r.ok ? r.json() : null))
        .then(d => {
          if (controller.signal.aborted) return;
          const recs = (d?.tracks || d?.recommendations || []).filter(tr => !isQuranContent(tr));
          const pool = recs.length > 0 ? recs : localSeeds;
          const merged = [];
          const seen = new Set();
          for (const tr of pool) {
            const tid = String(tr?.id || tr?._id || '');
            if (tid && !seen.has(tid)) {
              seen.add(tid);
              merged.push({ ...tr, isSmartMoodQueue: true, isAiSuggestion: true });
            }
            if (merged.length >= 15) break;
          }
          if (merged.length > 0) {
            setAiMoodMix(merged);
            saveCachedAiMoodMix({
              ownerId: cacheOwnerId,
              moodId: d?.mood || currentMood.id,
              bucket12h: d?.bucket12h,
              source: recs.length > 0 ? 'server' : 'local',
              name: isRTL ? 'مُختارات لك • قائمة ذكاء ريفو' : 'Made For You • AI Mood Mix',
              description: `${currentMood.label} • Auto-refreshes every 12h`,
              tracks: merged,
            });
          }
        })
        .catch(() => {});
    }, 80);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [showMusic, displayTracks, cacheOwnerId, bucket12h, currentMood.id, currentMood.label, currentUser, isRTL]);

  // Filter out singles & Quran albums and apply 12-hour seeded rotation so Featured Albums only contains real Albums and EPs
  const hasFetchedAlbums = Boolean(fetchedAlbums && fetchedAlbums.length > 0);
  const displayAlbums = useMemo(() => {
    const list = hasFetchedAlbums ? fetchedAlbums : (albums || []);
    if (!list || list.length === 0) return [];
    const realAlbums = list.filter(a => {
      if (!a) return false;
      const type = (a.releaseType || '').toLowerCase();
      if (type === 'single') return false;
      const count = Number(a.trackCount || a.songsCount || (Array.isArray(a.tracks) ? a.tracks.length : (a.trackIds ? a.trackIds.length : 0)));
      if (count <= 1) return false;
      const name = (a.name || a.title || '').toLowerCase();
      if (name.endsWith('- single') || name.endsWith('(single)')) return false;
      return true;
    });
    return rotateAlbumsForWindow(realAlbums, cacheOwnerId);
  }, [hasFetchedAlbums ? fetchedAlbums : albums, bucket12h, cacheOwnerId]);

  // Preset vibrant badge colors for blister packs
  const badgeColors = ['#0f756d', '#111615', '#17a398', '#dc2626', '#f59e0b', '#1e3a8a', '#082621', '#3b82f6'];

  const getGreetingPrefix = useCallback(() => {
    const hour = new Date().getHours();
    if (hour >= 21 || hour < 5) return t('home.greetingNightShort');
    if (hour < 12) return t('home.greetingMorningShort');
    if (hour < 17) return t('home.greetingAfternoonShort');
    return t('home.greetingEveningShort');
  }, [t]);

  const handlePlaySmartCassette = useCallback(() => {
    if (aiMoodMix && aiMoodMix.length > 0) {
      onSelectTrack?.(aiMoodMix[0], aiMoodMix);
      return;
    }

    let followed = [];
    try {
      const raw = localStorage.getItem('rivo_followed_artists') || localStorage.getItem('liofy_followed_artists');
      if (raw) followed = JSON.parse(raw);
    } catch {}

    const smart10 = getSmartTasteAndMoodTracks({
      allTracks: displayTracks,
      currentUser,
      followedArtists: followed,
      likedTrackIds: currentUser?.likedTrackIds || currentUser?.likedTracks || [],
      limit: 12,
    });

    if (smart10.length > 0) {
      onSelectTrack?.(smart10[0], smart10.map(tr => ({ ...tr, isSmartMoodQueue: true })));
    } else if (popularTracks.length > 0) {
      onSelectTrack?.(popularTracks[0], popularTracks.slice(0, 10));
    }
  }, [displayTracks, currentUser, aiMoodMix, popularTracks, onSelectTrack]);

  const getMoodLabel = useCallback((moodId) => {
    switch (moodId) {
      case 'morning': return t('home.flowMorning');
      case 'afternoon': return t('home.flowAfternoon');
      case 'evening': return t('home.flowEvening');
      case 'night': return t('home.flowNight');
      default: return currentMood.label;
    }
  }, [t, currentMood.label]);

  const resolvedMoodLabel = getMoodLabel(currentMood.id);

  const aiMoodPlaylistObj = useMemo(() => {
    if (!aiMoodMix || aiMoodMix.length === 0) return null;
    const artistsSummary = Array.from(
      new Set(aiMoodMix.map(tr => tr?.artist).filter(Boolean))
    ).slice(0, 4).join(' • ');
    return {
      id: 'ai-mood-mix',
      name: isRTL ? 'مُختارات لك • قائمة ذكاء ريفو' : 'Made For You • AI Mood Mix',
      description: artistsSummary
        ? `${resolvedMoodLabel} — ${artistsSummary}`
        : resolvedMoodLabel,
      isAiMoodPlaylist: true,
      tracks: aiMoodMix,
      trackIds: aiMoodMix.map(tr => String(tr.id || tr._id)),
    };
  }, [aiMoodMix, isRTL, resolvedMoodLabel]);

  if (!showMusic) return null;

  const heroCassetteArtists = Array.from(new Set((aiMoodMix || []).map(tr => tr?.artist).filter(Boolean))).slice(0, 3).join(' • ');

  return (
    <div
      className={`flex-1 overflow-y-auto select-none p-3.5 sm:p-6 ${isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'}`}
      style={{ paddingBottom: 'calc(var(--player-height) + 40px)', WebkitOverflowScrolling: 'touch', willChange: 'scroll-position' }}
    >
      <div className="max-w-[1440px] mx-auto w-full">
      {/* HERO BANNER */}
      <section className="mb-6 bg-[#082621] rounded-2xl brutal-border-thick p-5 sm:p-7 text-[#fdfbf7] brutal-shadow-teal relative overflow-hidden">
        <div className="absolute -right-6 -bottom-10 opacity-10 text-white font-display font-black text-9xl select-none pointer-events-none tracking-tighter">RIVO</div>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sm:gap-6 relative z-10">
          <div className="max-w-xl text-left w-full">
            <div className="inline-flex items-center gap-1.5 bg-[#fdfbf7] text-[#0b1110] px-2.5 py-0.5 rounded-full brutal-border text-[10px] sm:text-xs font-display font-bold mb-2.5 brutal-shadow-sm">
              <span className="w-2 h-2 rounded-full bg-[#17a398]" />
              <span>{resolvedMoodLabel}</span>
            </div>
            <h1 className="font-display text-2xl sm:text-4xl lg:text-5xl font-black leading-tight mb-2 tracking-tight text-white">
              {getGreetingPrefix()}{isRTL ? '، ' : ', '}
              <span className="text-[#17a398]">{currentUser?.name ? currentUser.name.split(' ')[0] : t('home.listener')}</span>
              {isRTL ? '' : '.'}
            </h1>
            <p className="text-emerald-100/90 text-xs sm:text-sm font-medium leading-relaxed mb-3.5 line-clamp-2 sm:line-clamp-none">{t('home.heroSubtitle')}</p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button
                onClick={handlePlaySmartCassette}
                className="flex-1 sm:flex-initial bg-[#fdfbf7] hover:bg-white text-[#0b1110] font-display font-black text-xs sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl brutal-border brutal-shadow-sm brutal-btn flex items-center justify-center gap-2 cursor-pointer"
                title={aiMoodPlaylistObj ? aiMoodPlaylistObj.name : t('home.playTopChartsTitle')}
              >
                <Play size={15} fill="currentColor" />
                <span>{aiMoodMix.length > 0 ? (isRTL ? `تشغيل قائمة الذكاء (${aiMoodMix.length})` : `PLAY AI MOOD MIX (${aiMoodMix.length})`) : t('home.playTopCharts')}</span>
              </button>
              <button
                onClick={openAddSongModal}
                className="w-full sm:w-auto bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] font-display font-bold text-xs px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl brutal-border brutal-shadow-sm brutal-btn flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={15} strokeWidth={2.5} />
                <span>{t('home.addTrack')}</span>
              </button>
            </div>
          </div>

          <div
            onClick={() => aiMoodPlaylistObj ? onSelectPlaylist?.(aiMoodPlaylistObj) : handlePlaySmartCassette()}
            title={aiMoodPlaylistObj ? (isRTL ? 'فتح قائمة ذكاء ريفو' : 'Open AI Mood Mix Playlist') : t('home.playTopChartsTitle')}
            className="hidden md:flex relative shrink-0 items-center justify-center self-center lg:self-auto mt-2 lg:mt-0 cursor-pointer"
          >
            <div className="w-72 lg:w-80 bg-[#fdfbf7] text-[#0b1110] rounded-xl brutal-border-thick p-3 sm:p-3.5 brutal-shadow-lg transform rotate-1 hover:rotate-0 transition-transform duration-200">
              <div className="border-2 border-dashed border-[#0b1110] rounded-lg p-2.5 sm:p-3 bg-white">
                <div className="flex items-center justify-between text-[9px] font-mono font-bold border-b-2 border-black pb-1 mb-2.5">
                  <span>{t('home.soundLab')}</span>
                  <span>{aiMoodMix.length > 0 ? (isRTL ? 'تتجدد كل 12 ساعة' : '12H AI PLAYLIST') : t('home.hiFiStereo')}</span>
                </div>
                <div className="flex items-center gap-3 text-left">
                  {/* Playlist 2x2 Mosaic Cover replacing the green circle */}
                  <div className="w-20 h-20 rounded-lg bg-[#17a398] overflow-hidden brutal-border brutal-shadow-sm shrink-0 relative">
                    {aiMoodMix.length > 0 ? (
                      <div className="w-full h-full grid grid-cols-2 grid-rows-2">
                        {aiMoodMix.slice(0, 4).map((tr, idx) => (
                          <img
                            key={`hero-cov-${tr.id || tr._id || idx}`}
                            src={normalizeCoverUrl(tr.cover, tr)}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={handleCoverImageError}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Disc size={30} className="text-[#0b1110]" strokeWidth={2.2} />
                      </div>
                    )}
                  </div>

                  {/* Playlist Name & Artists beside Cover */}
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-black text-sm sm:text-base text-[#0b1110] leading-tight truncate">
                      {aiMoodMix.length > 0 ? (isRTL ? 'قائمة ذكاء ريفو' : 'AI Mood Mix') : t('home.rivoCassette')}
                    </div>
                    <div className="text-[10px] font-bold text-[#0f756d] truncate mt-0.5">
                      {resolvedMoodLabel}{aiMoodMix.length > 0 ? ` • ${aiMoodMix.length} ${isRTL ? 'أغاني' : 'tracks'}` : ''}
                    </div>
                    {heroCassetteArtists && (
                      <div className="text-[10px] text-zinc-600 font-medium line-clamp-2 mt-0.5 leading-snug">
                        {heroCassetteArtists}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlaySmartCassette();
                      }}
                      className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#0b1110] hover:bg-[#17a398] hover:text-[#0b1110] text-[#17a398] text-[10px] font-mono font-black uppercase transition-colors cursor-pointer"
                    >
                      <Play size={10} fill="currentColor" />
                      <span>{isRTL ? 'تشغيل القائمة' : 'Play Playlist'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="sawtooth-badge w-16 h-16 sm:w-20 sm:h-20 bg-[#dc2626] text-white flex flex-col items-center justify-center p-1.5 text-center absolute -top-3 -right-3 transform -rotate-12 brutal-border shadow-md">
              <span className="font-display text-[7px] sm:text-[8px] font-bold">12H</span>
              <span className="font-display font-black text-xs sm:text-sm leading-tight">AI MIX</span>
              <span className="text-[6px] sm:text-[7px] font-mono font-bold">{t('home.topPicks')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED ALBUMS & DISCOGRAPHY SPOTLIGHT */}
      {displayAlbums && displayAlbums.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2">
              <Disc size={20} className="text-amber-400" />
              <h2 className="font-display font-black text-xl text-[#fdfbf7] tracking-tight drop-shadow-[1.5px_1.5px_0px_#082621]">{t('home.featuredAlbums')}</h2>
              <span className="text-[10px] font-mono font-bold bg-[#0b1110] text-[#17a398] px-2 py-0.5 rounded-full brutal-border">
                {displayAlbums.length} {displayAlbums.length === 1 ? t('home.album') : t('home.albums')}
              </span>
            </div>
            {displayAlbums.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAllAlbums(prev => !prev)}
                className="px-3 py-1 rounded-lg brutal-border bg-[#0b1110] hover:bg-[#141d1b] text-[#26c4b7] font-mono font-black text-[11px] uppercase cursor-pointer"
              >
                {showAllAlbums ? (isRTL ? 'إظهار أقل' : 'Show Less') : (isRTL ? `عرض الكل (${displayAlbums.length})` : `View All (${displayAlbums.length})`)}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3.5">
            {(showAllAlbums ? displayAlbums : displayAlbums.slice(0, 6)).map((alb) => (
              <div
                key={alb.id || alb._id || alb.name}
                onClick={() => onSelectPlaylist?.(alb)}
                className={`p-3 rounded-xl brutal-border brutal-shadow-sm cursor-pointer group transition-transform hover:-translate-y-1 ${isDark ? 'bg-[#141d1b] border-zinc-700 hover:bg-[#182320]' : 'bg-[#fdfbf7] border-black hover:bg-white'}`}
              >
                <div className="relative aspect-square mb-2.5 overflow-hidden rounded-lg brutal-border bg-black/10">
                  <img src={getAlbumArtwork(alb, alb.cover)} alt={alb.name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" onError={handleCoverImageError} />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-9 h-9 rounded-full bg-[#f59e0b] text-black flex items-center justify-center brutal-border brutal-shadow-sm shadow-md">
                      <Play size={16} fill="currentColor" className="ml-0.5" />
                    </div>
                  </div>
                </div>
                <div className={`font-display font-black text-xs truncate group-hover:text-[#17a398] transition-colors ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>{alb.name}</div>
                <div
                  onClick={(e) => { if (onSelectArtist && alb.artist) { e.stopPropagation(); onSelectArtist(alb.artist); } }}
                  className={`text-[10px] font-bold truncate hover:underline cursor-pointer ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
                >
                  {alb.artist || t('home.artist')}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MOST POPULAR & TOP LISTENED TRACKS */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-black text-xl text-[#fdfbf7] tracking-tight drop-shadow-[1.5px_1.5px_0px_#082621]">{t('home.mostPopular')}</h2>
            <span className="text-[10px] font-mono font-bold bg-[#0b1110] text-[#17a398] px-2 py-0.5 rounded-full brutal-border">{t('home.topChartsBadge')}</span>
          </div>
          <span className="text-[11px] font-mono font-bold text-emerald-100/70">{t('home.tracksCount', { count: popularTracks.length })}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
          {popularTracks.slice(0, visibleCount).map((track, index) => (
            <HomeTrackCard
              key={track.id || track._id || index}
              track={track}
              index={index}
              isActive={isTrackActive(track)}
              isPlaying={isPlaying}
              isDark={isDark}
              color={badgeColors[index % badgeColors.length]}
              onSelectTrack={() => onSelectTrack(track, popularTracks)}
              toggleLike={toggleLike}
              onOpenActionMenu={setActionMenuTrack}
              onSelectArtist={onSelectArtist}
              t={t}
            />
          ))}
        </div>
        {visibleCount < popularTracks.length && (
          <div className="mt-6 flex justify-center pb-2">
            <button onClick={() => setVisibleCount(prev => prev + 36)} className="px-6 py-2.5 rounded-xl brutal-border brutal-shadow-sm font-display font-black text-xs uppercase bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] cursor-pointer transition active:scale-95">
              {t('home.loadMoreTracks', { count: popularTracks.length - visibleCount })}
            </button>
          </div>
        )}
      </section>

      {deleteConfirmTrackId && (
        <ConfirmModal
          isOpen={Boolean(deleteConfirmTrackId)} onClose={() => setDeleteConfirmTrackId(null)}
          onConfirm={() => { onDeleteTrack(deleteConfirmTrackId); setDeleteConfirmTrackId(null); }}
          title={t('home.deleteTrackConfirmTitle')} message={t('home.deleteTrackConfirmMessage')} confirmText={t('home.delete')}
        />
      )}
      {actionMenuTrack && (
        <TrackActionMenuModal
          isOpen={Boolean(actionMenuTrack)} onClose={() => setActionMenuTrack(null)} track={actionMenuTrack}
          onPlayTrack={onSelectTrack} onAddToQueue={addToQueue} openAddToPlaylist={openAddToPlaylist}
          openEditSongModal={openEditSongModal} onDeleteTrack={onDeleteTrack} currentUser={currentUser} globalTheme={globalTheme}
        />
      )}
      </div>
    </div>
  );
}
