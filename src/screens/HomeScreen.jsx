import React, { useState, useMemo, useCallback } from 'react';
import { usePreferences, useTranslation } from '../context/PreferencesContext';
import { Play, Plus, Disc } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import TrackActionMenuModal from '../components/TrackActionMenuModal';
import HomeTrackCard from '../components/HomeTrackCard';
import { isQuranContent } from '../utils/quranUtils';
import { useAudioPlayer } from '../context/AudioContext';
import { getAlbumArtwork } from './ArtistScreen';
import { sortTracksByPopularity, getGlobalTrackScore } from '../utils/trackPopularity';
import { getSmartTasteAndMoodTracks, getCurrentTimeMood } from '../utils/tasteAlgorithm';
import { handleCoverImageError } from '../utils/coverUtils';

export { getGlobalTrackScore };

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
  const { showMusic } = usePreferences();
  const { t, isRTL } = useTranslation();
  const { addToQueue } = useAudioPlayer();
  const [deleteConfirmTrackId, setDeleteConfirmTrackId] = useState(null);
  const [actionMenuTrack, setActionMenuTrack] = useState(null);
  const [visibleCount, setVisibleCount] = useState(36);

  const isTrackActive = useCallback((tr) => {
    if (!currentTrack || !tr) return false;
    const curId = currentTrack.id || currentTrack._id;
    const tId = tr.id || tr._id;
    return Boolean(curId && tId && String(curId) === String(tId));
  }, [currentTrack]);

  // Filtered tracks (Strictly excluding Quran content from Music Home)
  const displayTracks = useMemo(() => {
    return (tracks || []).filter(tr => !isQuranContent(tr));
  }, [tracks]);

  // Sort tracks by global popularity with intelligent scoring and artist interleaving
  const popularTracks = useMemo(() => {
    return sortTracksByPopularity(displayTracks);
  }, [displayTracks]);

  // Resilient album state with automatic on-demand fetch fallback so featured albums never disappear
  const [fetchedAlbums, setFetchedAlbums] = useState(albums || []);
  React.useEffect(() => {
    if (albums && albums.length > 0) {
      setFetchedAlbums(albums);
    }
  }, [albums]);

  React.useEffect(() => {
    if (!fetchedAlbums || fetchedAlbums.length === 0) {
      fetch('/api/albums')
        .then(r => r.json())
        .then(d => {
          if (d && d.success && Array.isArray(d.albums) && d.albums.length > 0) {
            setFetchedAlbums(d.albums);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Strictly filter out any Quran recitations/albums from Featured Albums on Home
  const displayAlbums = useMemo(() => {
    const list = (fetchedAlbums && fetchedAlbums.length > 0) ? fetchedAlbums : (albums || []);
    return list.filter(alb => !isQuranContent(alb));
  }, [fetchedAlbums, albums]);

  // Preset vibrant badge colors for blister packs
  const badgeColors = ['#0f756d', '#111615', '#17a398', '#dc2626', '#f59e0b', '#1e3a8a', '#082621', '#3b82f6'];

  const getGreetingPrefix = useCallback(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('home.greetingMorningShort');
    if (hour < 18) return t('home.greetingAfternoonShort');
    return t('home.greetingEveningShort');
  }, [t]);

  const handlePlaySmartCassette = useCallback(() => {
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
      limit: 10,
    });

    if (smart10.length > 0) {
      const tagged = smart10.map(tr => ({ ...tr, isSmartMoodQueue: true }));
      onSelectTrack(tagged[0], tagged);
    } else if (popularTracks.length > 0) {
      onSelectTrack(popularTracks[0], popularTracks.slice(0, 10));
    }
  }, [displayTracks, currentUser, popularTracks, onSelectTrack]);

  const currentMood = getCurrentTimeMood();

  const getMoodLabel = useCallback((moodId) => {
    switch (moodId) {
      case 'morning': return t('home.flowMorning');
      case 'afternoon': return t('home.flowAfternoon');
      case 'evening': return t('home.flowEvening');
      case 'night': return t('home.flowNight');
      default: return currentMood.label;
    }
  }, [t, currentMood.label]);

  if (!showMusic) return null;

  const resolvedMoodLabel = getMoodLabel(currentMood.id);

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
              <span>{resolvedMoodLabel}</span>
            </div>

            <h1 className="font-display text-2xl sm:text-4xl lg:text-5xl font-black leading-tight mb-2 tracking-tight text-white">
              {getGreetingPrefix()}{isRTL ? '، ' : ', '}
              <span className="text-[#17a398]">
                {currentUser?.name ? currentUser.name.split(' ')[0] : t('home.listener')}
              </span>
              {isRTL ? '' : '.'}
            </h1>

            <p className="text-emerald-100/90 text-xs sm:text-sm font-medium leading-relaxed mb-3.5 line-clamp-2 sm:line-clamp-none">
              {t('home.heroSubtitle')}
            </p>

            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <button 
                onClick={handlePlaySmartCassette}
                className="flex-1 sm:flex-initial bg-[#fdfbf7] hover:bg-white text-[#0b1110] font-display font-black text-xs sm:text-sm px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl brutal-border brutal-shadow-sm brutal-btn flex items-center justify-center gap-2 cursor-pointer"
                title={t('home.playTopChartsTitle')}
              >
                <Play size={15} fill="currentColor" />
                <span>{t('home.playTopCharts')}</span>
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

          {/* Authentic Rivo Cassette Deck Graphic (Shown on tablets and desktop) */}
          <div 
            onClick={handlePlaySmartCassette}
            title={t('home.playTopChartsTitle')}
            className="hidden md:flex relative shrink-0 items-center justify-center self-center lg:self-auto mt-2 lg:mt-0 cursor-pointer"
          >
            <div className="w-56 sm:w-64 bg-[#fdfbf7] text-[#0b1110] rounded-xl brutal-border-thick p-3.5 sm:p-4 brutal-shadow-lg transform rotate-2 hover:rotate-0 transition duration-300">
              <div className="border-2 border-dashed border-[#0b1110] rounded-lg p-2.5 sm:p-3 bg-white text-center">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold border-b-2 border-black pb-1 mb-2">
                  <span>{t('home.soundLab')}</span>
                  <span>{t('home.hiFiStereo')}</span>
                </div>

                <div className="py-2">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-2 rounded-full bg-[#17a398] flex items-center justify-center brutal-border brutal-shadow-sm">
                    <Disc size={30} className="text-[#0b1110]" strokeWidth={2.2} />
                  </div>
                  <div className="font-display font-black text-lg sm:text-xl text-[#0b1110] leading-tight">
                    {t('home.rivoCassette')}
                  </div>
                  <div className="text-[10px] sm:text-[11px] text-zinc-600 font-bold">{resolvedMoodLabel}</div>
                </div>

                <div className="bg-[#0b1110] text-[#17a398] text-[9px] sm:text-[10px] font-mono py-1 rounded mt-1.5 font-bold">
                  {t('home.nowStreaming')}
                </div>
              </div>
            </div>

            {/* Serrated Starburst Badge Sticker */}
            <div className="sawtooth-badge w-20 h-20 sm:w-24 sm:h-24 bg-[#dc2626] text-white flex flex-col items-center justify-center p-2 text-center absolute -top-3 -right-3 sm:-top-4 sm:-right-4 transform -rotate-12 brutal-border shadow-md">
              <span className="font-display text-[8px] sm:text-[9px] font-bold">100%</span>
              <span className="font-display font-black text-sm sm:text-base leading-tight">{t('home.stereo')}</span>
              <span className="text-[7px] sm:text-[8px] font-mono font-bold">{t('home.topPicks')}</span>
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
                {t('home.featuredAlbums')}
              </h2>
              <span className="text-[10px] font-mono font-bold bg-[#0b1110] text-[#17a398] px-2 py-0.5 rounded-full brutal-border">
                {displayAlbums.length} {displayAlbums.length === 1 ? t('home.album') : t('home.albums')}
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
                    onError={handleCoverImageError}
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
                  {alb.artist || t('home.artist')}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─────────────────────────────────────────
          MOST POPULAR & TOP LISTENED TRACKS
          ───────────────────────────────────────── */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-black text-xl text-[#fdfbf7] tracking-tight drop-shadow-[1.5px_1.5px_0px_#082621]">
              {t('home.mostPopular')}
            </h2>
            <span className="text-[10px] font-mono font-bold bg-[#0b1110] text-[#17a398] px-2 py-0.5 rounded-full brutal-border">
              {t('home.topChartsBadge')}
            </span>
          </div>
          <span className="text-[11px] font-mono font-bold text-emerald-100/70">
            {t('home.tracksCount', { count: popularTracks.length })}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
          {popularTracks.slice(0, visibleCount).map((track, index) => {
            const active = isTrackActive(track);
            const color = badgeColors[index % badgeColors.length];

            return (
              <HomeTrackCard
                key={track.id || track._id || index}
                track={track}
                index={index}
                isActive={active}
                isPlaying={isPlaying}
                isDark={isDark}
                color={color}
                onSelectTrack={() => onSelectTrack(track, popularTracks)}
                toggleLike={toggleLike}
                onOpenActionMenu={setActionMenuTrack}
                onSelectArtist={onSelectArtist}
                t={t}
              />
            );
          })}
        </div>

        {visibleCount < popularTracks.length && (
          <div className="mt-6 flex justify-center pb-2">
            <button
              onClick={() => setVisibleCount(prev => prev + 36)}
              className="px-6 py-2.5 rounded-xl brutal-border brutal-shadow-sm font-display font-black text-xs uppercase bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] cursor-pointer transition active:scale-95"
            >
              {t('home.loadMoreTracks', { count: popularTracks.length - visibleCount })}
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
          title={t('home.deleteTrackConfirmTitle')}
          message={t('home.deleteTrackConfirmMessage')}
          confirmText={t('home.delete')}
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
