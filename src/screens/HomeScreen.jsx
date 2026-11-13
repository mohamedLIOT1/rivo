import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { usePreferences, useTranslation } from '../context/PreferencesContext';
import { useNavigation } from '../context/NavigationContext';
import { API_BASE_URL } from '../config';
import ConfirmModal from '../components/ConfirmModal';
import TrackActionMenuModal from '../components/TrackActionMenuModal';
import HomeHeroBanner from '../components/HomeHeroBanner';
import HomeFeaturedAlbums from '../components/HomeFeaturedAlbums';
import HomePopularTracks from '../components/HomePopularTracks';
import { isQuranContent } from '../utils/quranUtils';
import { useAudioPlayer } from '../context/AudioContext';
import { sortTracksByPopularity, curateRotatingPopularTracks, getGlobalTrackScore } from '../utils/trackPopularity';
import { getCurrentTimeMood } from '../utils/tasteAlgorithm';
import { useHomeAiMoodMix } from '../hooks/useHomeAiMoodMix';
import {
  get12hBucket,
  curateFeaturedAlbums,
  cacheAlbumsToStorage,
} from '../utils/aiMoodMixCache';

export { getGlobalTrackScore };

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
  onNavigate,
}) {
  const isDark = globalTheme === 'dark';
  const { showMusic } = usePreferences();
  const { t, isRTL } = useTranslation();
  const { addToQueue } = useAudioPlayer();
  const { navigateTo } = useNavigation();

  const [deleteConfirmTrackId, setDeleteConfirmTrackId] = useState(null);
  const [actionMenuTrack, setActionMenuTrack] = useState(null);

  // Filtered tracks (Strictly excluding Quran content from Music Home)
  const displayTracks = useMemo(() => (tracks || []).filter(tr => !isQuranContent(tr)), [tracks]);
  const cacheOwnerId = String(currentUser?.id || currentUser?._id || 'guest');
  const currentMood = getCurrentTimeMood();
  const bucket12h = get12hBucket();

  const currentTrackId = currentTrack?.id || currentTrack?._id;
  const isTrackActive = useCallback((tr) => {
    if (!currentTrackId || !tr) return false;
    const tId = tr.id || tr._id;
    return Boolean(tId && String(currentTrackId) === String(tId));
  }, [currentTrackId]);

  // Sort tracks by global popularity with intelligent scoring and artist interleaving
  const popularTracks = useMemo(() => sortTracksByPopularity(displayTracks), [displayTracks]);

  // Personalized AI Mood & Taste Recommendations
  const {
    aiMoodMix,
    aiMoodPlaylistObj,
    handlePlaySmartCassette,
    heroCassetteArtists,
  } = useHomeAiMoodMix({
    showMusic,
    displayTracks,
    cacheOwnerId,
    bucket12h,
    currentMood,
    currentUser,
    isRTL,
    popularTracks,
    onSelectTrack,
  });

  const [fetchedAlbums, setFetchedAlbums] = useState(() => {
    try {
      const raw = localStorage.getItem('rivo_albums');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter(a => {
            const count = Number(a.trackCount || a.songsCount || 0);
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
        const count = Number(a.trackCount || a.songsCount || 0);
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
            const count = Number(a.trackCount || a.songsCount || 0);
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

  // Curation: Exactly top 16 curated Featured Albums with prestige ranking and 12-hour deterministic rotation
  const allAvailableAlbums = useMemo(() => {
    return (fetchedAlbums && fetchedAlbums.length > 0) ? fetchedAlbums : (albums || []);
  }, [fetchedAlbums, albums]);

  const totalAlbumsCount = allAvailableAlbums.length;

  const featured16Albums = useMemo(() => {
    return curateFeaturedAlbums(allAvailableAlbums, {
      ownerId: cacheOwnerId,
      limit: 16,
    });
  }, [allAvailableAlbums, cacheOwnerId, bucket12h]);

  const handleViewAllAlbums = useCallback(() => {
    if (onNavigate) {
      onNavigate('library', { filter: 'albums' });
      return;
    }
    if (navigateTo) {
      navigateTo('library', { filter: 'albums' });
    }
  }, [onNavigate, navigateTo]);

  // Curation: Top 24 Curated Popular Tracks with 12-hour deterministic rotation & diversity
  const curated24Tracks = useMemo(() => {
    return curateRotatingPopularTracks(displayTracks, { limit: 24 });
  }, [displayTracks, bucket12h]);

  const handleViewAllTracks = useCallback(() => {
    if (onNavigate) {
      onNavigate('library', { filter: 'songs' });
      return;
    }
    if (navigateTo) {
      navigateTo('library', { filter: 'songs' });
    }
  }, [onNavigate, navigateTo]);

  const badgeColors = ['#0f756d', '#111615', '#17a398', '#dc2626', '#f59e0b', '#1e3a8a', '#082621', '#3b82f6'];

  const getGreetingPrefix = useCallback(() => {
    const hour = new Date().getHours();
    if (hour >= 21 || hour < 5) return t('home.greetingNightShort');
    if (hour < 12) return t('home.greetingMorningShort');
    if (hour < 17) return t('home.greetingAfternoonShort');
    return t('home.greetingEveningShort');
  }, [t]);

  if (!showMusic) return null;

  return (
    <div
      className={`flex-1 overflow-y-auto select-none p-3.5 sm:p-6 ${isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'}`}
      style={{ paddingBottom: 'calc(var(--player-height) + 40px)', WebkitOverflowScrolling: 'touch', willChange: 'scroll-position' }}
    >
      <div className="max-w-[1440px] mx-auto w-full">
        {/* HERO BANNER */}
        <HomeHeroBanner
          resolvedMoodLabel={currentMood.label}
          getGreetingPrefix={getGreetingPrefix}
          currentUser={currentUser}
          t={t}
          isRTL={isRTL}
          handlePlaySmartCassette={handlePlaySmartCassette}
          openAddSongModal={openAddSongModal}
          aiMoodPlaylistObj={aiMoodPlaylistObj}
          aiMoodMix={aiMoodMix}
          onSelectPlaylist={onSelectPlaylist}
          heroCassetteArtists={heroCassetteArtists}
        />

        {/* 16 CURATED FEATURED ALBUMS */}
        <HomeFeaturedAlbums
          albums={featured16Albums}
          totalCount={totalAlbumsCount}
          onSelectAlbum={onSelectPlaylist}
          onSelectArtist={onSelectArtist}
          onViewAll={handleViewAllAlbums}
          isDark={isDark}
          isRTL={isRTL}
          t={t}
        />

        {/* 24 CURATED ROTATING POPULAR TRACKS */}
        <HomePopularTracks
          tracks={curated24Tracks}
          totalCount={displayTracks.length}
          isActive={isTrackActive}
          isPlaying={isPlaying}
          isDark={isDark}
          onSelectTrack={onSelectTrack}
          toggleLike={toggleLike}
          onOpenActionMenu={setActionMenuTrack}
          onSelectArtist={onSelectArtist}
          onViewAll={handleViewAllTracks}
          t={t}
          isRTL={isRTL}
        />

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
    </div>
  );
}
