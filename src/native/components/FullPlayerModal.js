import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Animated, Platform, BackHandler,
} from 'react-native';
import { ChevronDown, MoreVertical } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LocalizationContext';
import { isQuranContent, isRadioTrack } from '../../utils/quranUtils';
import { isPodcastContent } from '../utils/podcastUtils';
import { normalizeCoverUri } from '../utils/coverUtils';
import { isArabicText } from '../theme/typography';
import QuranMushafViewer from './QuranMushafViewer';
import SleepTimerModal from './SleepTimerModal';

import { styles, colors } from './fullplayer/fullPlayerStyles';
import { FullPlayerArtwork } from './fullplayer/FullPlayerArtwork';
import { FullPlayerTrackInfo } from './fullplayer/FullPlayerTrackInfo';
import { FullPlayerControls } from './fullplayer/FullPlayerControls';
import { FullPlayerLyricsView } from './fullplayer/FullPlayerLyricsView';
import { FullPlayerQueueView } from './fullplayer/FullPlayerQueueView';

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=600&q=80';

export function FullPlayerModal({ visible, onClose, onTrackAction }) {
  const {
    currentTrack,
    isPlaying,
    isLoading,
    isShuffle,
    repeatMode,
    togglePlay,
    seekTo,
    playNextTrack,
    playPrevTrack,
    setIsShuffle,
    toggleShuffle,
    toggleRepeat,
    queue,
    playTrack,
    reorderQueue,
    removeFromQueue,
    clearQueue,
    lyrics,
    isLoadingLyrics,
    setLyrics,
    saveLyrics,
    downloadedTracks = [],
    downloadingIds = {},
    handleDownloadTrack,
    isTrackDownloaded,
    volume = 0.8,
    setVolume,
    vocalIsolationStatus,
    isMixMode = false,
    jumpBy,
    playbackRate,
    setPlaybackRate,
  } = useAudioPlayer();

  const { likedTrackIds = [], toggleLikeTrack } = useUser();
  const { isDark } = useTheme();
  const { t, isRTL } = useTranslation();

  const rtlTextStyle = useMemo(() => (
    isRTL ? {
      letterSpacing: 0,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    } : null
  ), [isRTL]);

  const [activeTab, setActiveTab] = useState('player'); // 'player' | 'lyrics' | 'queue'
  const [isSleepTimerOpen, setIsSleepTimerOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose?.();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  const trackId = String(currentTrack?._id || currentTrack?.id || '');
  const isLiked = likedTrackIds.some(id => String(id) === trackId);
  const isCurQuran = useMemo(() => isQuranContent(currentTrack), [currentTrack]);
  const isCurRadio = useMemo(() => isRadioTrack(currentTrack), [currentTrack]);
  const isCurPodcast = useMemo(() => isPodcastContent(currentTrack), [currentTrack]);

  useEffect(() => {
    if (isCurPodcast && activeTab === 'lyrics') {
      setActiveTab('player');
    }
  }, [isCurPodcast, activeTab]);

  const isDownloaded = useMemo(() => {
    if (!currentTrack) return false;
    if (typeof isTrackDownloaded === 'function' && isTrackDownloaded(currentTrack)) {
      return true;
    }
    if (currentTrack.isDownloaded || (currentTrack.localAudioUri && String(currentTrack.localAudioUri).startsWith('file://'))) {
      return true;
    }
    return (downloadedTracks || []).some(t => {
      const tid = String(t._id || t.id || '');
      if (trackId && tid && tid === trackId) return true;
      if (currentTrack.youtubeId && t.youtubeId && currentTrack.youtubeId === t.youtubeId) return true;
      return false;
    });
  }, [downloadedTracks, trackId, currentTrack, isTrackDownloaded]);

  const isDownloading = Boolean(
    downloadingIds &&
    (downloadingIds[trackId] !== undefined || (currentTrack?.youtubeId && downloadingIds[currentTrack.youtubeId] !== undefined))
  );

  // Reel spin animation for cassette spools
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let anim;
    if (isPlaying && Platform.OS !== 'android') {
      anim = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      );
      anim.start();
    } else {
      spinValue.setValue(0);
    }
    return () => anim?.stop();
  }, [isPlaying, spinValue]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const rawCover = currentTrack?.coverUrl || currentTrack?.cover || currentTrack?.coverImage || currentTrack?.thumbnail || currentTrack?.artwork || DEFAULT_COVER;
  const coverUri = normalizeCoverUri(rawCover, currentTrack);

  const isVerifiedLyrics = Boolean(currentTrack?.isVerifiedLyrics || lyrics?.isVerified);
  const lyricsVerifiedBy = currentTrack?.lyricsVerifiedBy || lyrics?.verifiedBy || '';

  const deckBg = isDark ? '#0c1815' : '#f4eee0';
  const deckBorder = isDark ? '#1d3630' : '#e2d7c0';
  const textTitle = isDark ? '#ffffff' : colors.ink;
  const textSub = isDark ? '#9ca3af' : '#64748b';

  if (!visible) return null;

  return (
    <View style={[styles.fullScreenOverlay, { backgroundColor: isDark ? '#07100e' : '#f9f6f0' }]}>
      <View style={[styles.container, { backgroundColor: isDark ? '#07100e' : '#f9f6f0' }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.topWhiteBtn} activeOpacity={0.8}>
            <ChevronDown size={22} color="#000000" strokeWidth={2.5} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.headerPill}>
              <Text style={styles.headerPillText}>RIVO AUDIO</Text>
            </View>
            <Text
              style={[
                styles.headerTitle,
                { color: textTitle },
                (isRTL || isArabicText(currentTrack?.title)) && {
                  letterSpacing: 0,
                  fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
                },
              ]}
              numberOfLines={1}
            >
              {currentTrack?.title || (isRTL ? 'يتم التشغيل الآن' : 'Now Playing')}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => {
              if (currentTrack && onTrackAction) {
                onTrackAction(currentTrack);
              }
            }}
            style={styles.topWhiteBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            activeOpacity={0.8}
          >
            <MoreVertical size={20} color="#000000" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>

        {/* Tab switch row */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            onPress={() => setActiveTab('player')}
            style={[styles.tabBtn, activeTab === 'player' && styles.activeTabBtn]}
          >
            <Text style={[styles.tabText, activeTab === 'player' && styles.activeTabText, rtlTextStyle]}>
              {isRTL ? (isCurPodcast ? 'المشغل' : 'يتم التشغيل') : 'Now Playing'}
            </Text>
          </TouchableOpacity>

          {!isCurRadio && !isCurPodcast && (
            <TouchableOpacity
              onPress={() => setActiveTab('lyrics')}
              style={[styles.tabBtn, activeTab === 'lyrics' && styles.activeTabBtn]}
            >
              <Text style={[styles.tabText, activeTab === 'lyrics' && styles.activeTabText, rtlTextStyle]}>
                {isRTL ? 'الكلمات' : 'Lyrics'}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => setActiveTab('queue')}
            style={[styles.tabBtn, activeTab === 'queue' && styles.activeTabBtn]}
          >
            <Text style={[styles.tabText, activeTab === 'queue' && styles.activeTabText, rtlTextStyle]}>
              {isRTL ? `قائمة الانتظار (${queue?.length || 0})` : `Queue (${queue?.length || 0})`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab contents */}
        {activeTab === 'player' && (
          <ScrollView
            contentContainerStyle={styles.playerScroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.deckCard, { backgroundColor: deckBg, borderColor: deckBorder }]}>
              <View style={styles.deckHeader}>
                <View style={styles.deckHeaderLeft}>
                  <View style={[styles.pulsingDot, isPlaying && styles.pulsingDotActive]} />
                  <Text style={[styles.deckTitle, rtlTextStyle]}>{isRTL ? 'مشغل الكاسيت' : 'CASSETTE DECK'}</Text>
                </View>
                <View style={styles.deckBadge}>
                  <Text style={[styles.deckBadgeText, rtlTextStyle]}>{isRTL ? 'دولبي NR' : 'DOLBY NR'}</Text>
                </View>
              </View>

              <FullPlayerArtwork
                currentTrack={currentTrack}
                coverUri={coverUri}
                isPlaying={isPlaying}
                isDark={isDark}
                spin={spin}
                isCurQuran={isCurQuran}
                isCurRadio={isCurRadio}
              />

              <FullPlayerTrackInfo
                currentTrack={currentTrack}
                trackId={trackId}
                isLiked={isLiked}
                toggleLikeTrack={toggleLikeTrack}
                vocalIsolationStatus={vocalIsolationStatus}
                isMixMode={!isCurQuran && Boolean(isMixMode && (currentTrack?.isMix || currentTrack?._isMix || queue?.isMix || queue?._isMix || (queue?.name && String(queue.name).toUpperCase().includes('MIX')) || (queue?._playlistName && String(queue._playlistName).toUpperCase().includes('MIX'))))}
                mixName={queue?._playlistName || queue?.name || currentTrack?.mixName}
              />

              <FullPlayerControls
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                isLoading={isLoading}
                isShuffle={isShuffle}
                repeatMode={repeatMode}
                togglePlay={togglePlay}
                seekTo={seekTo}
                playNextTrack={playNextTrack}
                playPrevTrack={playPrevTrack}
                toggleShuffle={toggleShuffle}
                setIsShuffle={setIsShuffle}
                toggleRepeat={toggleRepeat}
                volume={volume}
                setVolume={setVolume}
                isCurRadio={isCurRadio}
                isCurQuran={isCurQuran}
                isDownloaded={isDownloaded}
                isDownloading={isDownloading}
                handleDownloadTrack={handleDownloadTrack}
                setIsSleepTimerOpen={setIsSleepTimerOpen}
                setActiveTab={setActiveTab}
                isCurPodcast={isCurPodcast}
                jumpBy={jumpBy}
                playbackRate={playbackRate}
                setPlaybackRate={setPlaybackRate}
              />
            </View>
          </ScrollView>
        )}

        {activeTab === 'lyrics' && (
          isCurQuran ? (
            <View style={{ flex: 1, paddingHorizontal: 8, paddingBottom: 12 }}>
              <QuranMushafViewer track={currentTrack} globalTheme={isDark ? 'dark' : 'light'} />
            </View>
          ) : (
            <FullPlayerLyricsView
              lyrics={lyrics}
              isLoadingLyrics={isLoadingLyrics}
              isDark={isDark}
              deckBg={deckBg}
              deckBorder={deckBorder}
              textTitle={textTitle}
              textSub={textSub}
              seekTo={seekTo}
              onSaveLyrics={saveLyrics || setLyrics}
              isVerifiedLyrics={isVerifiedLyrics}
              lyricsVerifiedBy={lyricsVerifiedBy}
            />
          )
        )}

        {activeTab === 'queue' && (
          <FullPlayerQueueView
            queue={queue || []}
            trackId={trackId}
            isDark={isDark}
            deckBg={deckBg}
            deckBorder={deckBorder}
            textTitle={textTitle}
            playTrack={playTrack}
            removeFromQueue={removeFromQueue}
            reorderQueue={reorderQueue}
            clearQueue={clearQueue}
            isPlaying={isPlaying}
            togglePlay={togglePlay}
          />
        )}

        <SleepTimerModal visible={isSleepTimerOpen} onClose={() => setIsSleepTimerOpen(false)} />
      </View>
    </View>
  );
}

export default React.memo(FullPlayerModal);
