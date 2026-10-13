import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, Image, TouchableOpacity, Modal, StyleSheet, Dimensions,
  ScrollView, Platform, FlatList, ActivityIndicator, Animated
} from 'react-native';
import {
  ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart,
  Moon, ListMusic, AlignLeft, Sparkles, Disc, Download, CheckCircle2, RotateCw
} from 'lucide-react-native';
import { useAudioPlayer, useAudioProgress } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';
import { normalizeCoverUri } from '../utils/coverUtils';
import CassetteTag from '../ui/CassetteTag';
import SleepTimerModal from './SleepTimerModal';
import { parseLrcLyrics } from '../../utils/lrcParser';

const { width, height } = Dimensions.get('window');

export default function FullPlayerModal({ visible, onClose }) {
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
    toggleRepeat,
    queue,
    playTrack,
    lyrics,
    isLoadingLyrics,
    downloadedTracks = [],
    downloadingIds = {},
    handleDownloadTrack,
  } = useAudioPlayer();

  const { currentTime, duration } = useAudioProgress();
  const { likedTrackIds = [], toggleLikeTrack } = useUser();
  const { isDark } = useTheme();

  const [activeTab, setActiveTab] = useState('player'); // 'player' | 'lyrics' | 'queue'
  const [isSleepTimerOpen, setIsSleepTimerOpen] = useState(false);
  const lyricsScrollRef = useRef(null);

  // Reel spin animation for the cassette spools
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let anim;
    if (isPlaying) {
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
  }, [isPlaying]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Synced lyrics data structure normalized
  const lyricsList = useMemo(() => {
    if (!lyrics) return [];
    return parseLrcLyrics(lyrics);
  }, [lyrics]);

  const activeLyricIndex = useMemo(() => {
    if (!lyricsList.length) return -1;
    return lyricsList.findIndex((line, idx) => {
      const nextLine = lyricsList[idx + 1];
      const curTime = typeof currentTime === 'number' ? currentTime : 0;
      return curTime >= line.time && (!nextLine || curTime < nextLine.time);
    });
  }, [lyricsList, currentTime]);

  useEffect(() => {
    if (activeTab === 'lyrics' && activeLyricIndex >= 0 && lyricsScrollRef.current) {
      lyricsScrollRef.current.scrollTo({
        y: Math.max(0, activeLyricIndex * 48 - 120),
        animated: true,
      });
    }
  }, [activeLyricIndex, activeTab]);

  if (!visible || !currentTrack) return null;

  const trackId = String(currentTrack._id || currentTrack.id || '');
  const isLiked = Array.isArray(likedTrackIds) ? likedTrackIds.includes(trackId) : false;
  const isDownloaded = (Array.isArray(downloadedTracks) ? downloadedTracks : []).some(t => String(t._id || t.id) === trackId);
  const isDownloading = Boolean(downloadingIds && downloadingIds[trackId] !== undefined);
  const isVerifiedLyrics = Boolean(currentTrack.isVerified || currentTrack.isVerifiedLyrics);

  const formatTime = (secs) => {
    if (isNaN(secs) || secs === null || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const coverUri = normalizeCoverUri(currentTrack.coverUrl || currentTrack.cover);

  const handleSeekPress = (e) => {
    const { locationX } = e.nativeEvent;
    const barWidth = width - 64;
    const targetPercent = Math.max(0, Math.min(1, locationX / barWidth));
    seekTo(targetPercent * duration);
  };

  const deckBg = isDark ? '#0e1614' : '#fdfbf7';
  const deckBorder = isDark ? '#243632' : colors.ink;
  const tvBg = isDark ? '#14201c' : '#ede5d3';
  const textTitle = isDark ? '#fdfbf7' : colors.ink;
  const textSub = isDark ? colors.mint : colors.tealDark;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: isDark ? '#050a09' : '#082621' }]}>
        {/* Subtle Ambient Background Artwork */}
        <Image
          source={{ uri: coverUri }}
          style={styles.ambientCover}
          blurRadius={40}
        />
        <View style={[styles.ambientOverlay, { backgroundColor: isDark ? 'rgba(5, 10, 9, 0.88)' : 'rgba(8, 38, 33, 0.88)' }]} />

        {/* ── Top Header Bar ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.topBtn} activeOpacity={0.8}>
            <ChevronDown size={22} color={colors.ink} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.headerPill}>
              <Text style={styles.headerPillText}>RIVO HI-FI STEREO • 24-BIT MASTER</Text>
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {currentTrack.title || 'Unknown Track'}
            </Text>
          </View>

          <TouchableOpacity onPress={() => setIsSleepTimerOpen(true)} style={styles.topBtn} activeOpacity={0.8}>
            <Moon size={18} color={colors.ink} />
          </TouchableOpacity>
        </View>

        {/* ── Tab Switcher: Now Playing / Lyrics / Queue ── */}
        <View style={styles.tabsRow}>
          {[
            { id: 'player', label: 'Now Playing', icon: Disc },
            { id: 'lyrics', label: 'Lyrics', icon: AlignLeft },
            { id: 'queue', label: `Queue (${queue.length})`, icon: ListMusic },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const IconComponent = tab.icon;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tabBtn,
                  isActive && styles.activeTabBtn,
                ]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.8}
              >
                <IconComponent
                  size={14}
                  color={isActive ? colors.ink : '#9ca3af'}
                />
                <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Main Tab Content ── */}
        {activeTab === 'player' && (
          <ScrollView contentContainerStyle={styles.playerScroll} showsVerticalScrollIndicator={false} bounces={false}>
            {/* ── Master Cassette Audio Deck / CRT Console ── */}
            <View style={[styles.deckCard, { backgroundColor: deckBg, borderColor: deckBorder }]}>
              {/* Deck Top Label */}
              <View style={[styles.deckHeader, { borderBottomColor: isDark ? '#1f2e2a' : colors.ink }]}>
                <View style={styles.deckHeaderLeft}>
                  <View style={[styles.pulsingDot, isPlaying && styles.pulsingDotActive]} />
                  <Text style={[styles.deckTitle, { color: isDark ? colors.mint : '#082621' }]}>
                    RIVO STEREO DECK // CR-500
                  </Text>
                </View>
                <View style={styles.deckBadge}>
                  <Text style={styles.deckBadgeText}>24-BIT HI-FI</Text>
                </View>
              </View>

              {/* ── Retro TV / CRT Monitor Enclosure ── */}
              <View style={[styles.tvEnclosure, { backgroundColor: tvBg, borderColor: deckBorder }]}>
                <View style={styles.tvScreen}>
                  <Image
                    source={{ uri: coverUri }}
                    style={styles.coverImage}
                    resizeMode="cover"
                  />
                  {/* Subtle TV Scanline Overlay effect */}
                  <View style={styles.tvScanlines} pointerEvents="none" />
                </View>

                {/* Cassette Mechanical Spool Bar */}
                <View style={[styles.cassetteSpoolBar, { borderTopColor: isDark ? '#243531' : '#ded2bb' }]}>
                  <View style={styles.spoolLeft}>
                    <View style={[styles.liveDot, { backgroundColor: isPlaying ? '#10b981' : '#dc2626' }]} />
                    <Text style={styles.spoolText}>SIDE A // STEREO</Text>
                  </View>

                  {/* Spinning Tape Wheels */}
                  <View style={styles.spoolWheels}>
                    <Animated.View style={[styles.spoolWheel, { transform: [{ rotate: spin }] }]}>
                      <View style={styles.spoolInnerDot} />
                    </Animated.View>
                    <View style={styles.spoolBelt} />
                    <Animated.View style={[styles.spoolWheel, { transform: [{ rotate: spin }] }]}>
                      <View style={styles.spoolInnerDot} />
                    </Animated.View>
                  </View>

                  <Text style={styles.spoolText}>CRT HI-FI</Text>
                </View>
              </View>

              {/* ── Song Title & Action Info Bar ── */}
              <View style={styles.trackInfoRow}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <View style={styles.genreBadge}>
                    <Text style={styles.genreBadgeText}>
                      {(currentTrack.genre || 'STEREO').toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.songTitle, { color: textTitle }]} numberOfLines={1}>
                    {currentTrack.title || 'Untitled Track'}
                  </Text>
                  <Text style={[styles.songArtist, { color: textSub }]} numberOfLines={1}>
                    {currentTrack.artist || 'Unknown Artist'}
                  </Text>
                </View>

                {/* Download & Like Buttons */}
                <View style={styles.trackActions}>
                  <TouchableOpacity
                    onPress={() => !isDownloaded && !isDownloading && handleDownloadTrack(currentTrack)}
                    style={[styles.brutalIconBtn, { backgroundColor: isDark ? '#182421' : '#ffffff', borderColor: deckBorder }]}
                    disabled={isDownloading || isDownloaded}
                    activeOpacity={0.8}
                  >
                    {isDownloading ? (
                      <ActivityIndicator size="small" color={colors.tealLight} />
                    ) : isDownloaded ? (
                      <CheckCircle2 size={20} color={colors.tealLight} />
                    ) : (
                      <Download size={20} color={isDark ? '#fdfbf7' : colors.ink} />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => toggleLikeTrack(trackId)}
                    style={[styles.brutalIconBtn, { backgroundColor: isDark ? '#182421' : '#ffffff', borderColor: deckBorder }]}
                    activeOpacity={0.8}
                  >
                    <Heart
                      size={20}
                      color={isLiked ? colors.crimson : (isDark ? '#9ca3af' : colors.ink)}
                      fill={isLiked ? colors.crimson : 'transparent'}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* ── Seekbar ── */}
              <View style={styles.seekSection}>
                <TouchableOpacity activeOpacity={1} onPress={handleSeekPress} style={styles.seekTouchArea}>
                  <View style={[styles.seekTrack, { backgroundColor: isDark ? '#070c0a' : '#ded2bb', borderColor: deckBorder }]}>
                    <View style={[styles.seekFill, { width: `${progressPercent}%` }]} />
                  </View>
                </TouchableOpacity>
                <View style={styles.timeRow}>
                  <Text style={[styles.timeText, { color: textSub }]}>{formatTime(currentTime)}</Text>
                  <Text style={[styles.timeText, { color: textSub }]}>{formatTime(duration)}</Text>
                </View>
              </View>

              {/* ── Transport Controls ── */}
              <View style={styles.controlsRow}>
                {/* Shuffle Button */}
                <TouchableOpacity
                  style={styles.transportBtn}
                  onPress={() => setIsShuffle(!isShuffle)}
                  activeOpacity={0.7}
                >
                  <Shuffle size={20} color={isShuffle ? colors.mint : '#6b7280'} />
                </TouchableOpacity>

                {/* Skip Prev */}
                <TouchableOpacity style={styles.transportBtn} onPress={playPrevTrack} activeOpacity={0.7}>
                  <SkipBack size={26} color={textTitle} />
                </TouchableOpacity>

                {/* Center Brutalist Play/Pause Button */}
                <View style={styles.mainPlayWrapper}>
                  <View style={styles.mainPlayShadow} />
                  <TouchableOpacity
                    style={styles.mainPlayBtn}
                    onPress={togglePlay}
                    activeOpacity={0.8}
                  >
                    {isLoading ? (
                      <ActivityIndicator size="small" color={colors.ink} />
                    ) : isPlaying ? (
                      <Pause size={28} color={colors.ink} fill={colors.ink} />
                    ) : (
                      <Play size={28} color={colors.ink} fill={colors.ink} style={{ marginLeft: 3 }} />
                    )}
                  </TouchableOpacity>
                </View>

                {/* Skip Next */}
                <TouchableOpacity style={styles.transportBtn} onPress={playNextTrack} activeOpacity={0.7}>
                  <SkipForward size={26} color={textTitle} />
                </TouchableOpacity>

                {/* Repeat Button */}
                <TouchableOpacity style={styles.transportBtn} onPress={toggleRepeat} activeOpacity={0.7}>
                  <Repeat size={20} color={repeatMode !== 'off' ? colors.mint : '#6b7280'} />
                  {repeatMode === 'one' && (
                    <View style={styles.repeatOneBadge}>
                      <Text style={styles.repeatOneText}>1</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* ── Bottom Deck Footer: Sleep Timer ── */}
              <View style={styles.deckFooterRow}>
                <TouchableOpacity
                  style={[styles.footerPillBtn, { backgroundColor: isDark ? '#141d1b' : '#ede5d3', borderColor: deckBorder }]}
                  onPress={() => setIsSleepTimerOpen(true)}
                  activeOpacity={0.8}
                >
                  <Moon size={14} color={isDark ? colors.mint : colors.ink} />
                  <Text style={[styles.footerPillText, { color: textTitle }]}>Sleep Timer</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        )}

        {/* ── Lyrics Tab ── */}
        {activeTab === 'lyrics' && (
          <ScrollView
            ref={lyricsScrollRef}
            contentContainerStyle={styles.lyricsBody}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.lyricsCard, { backgroundColor: deckBg, borderColor: deckBorder }]}>
              <View style={[styles.lyricsCardHeaderRow, { borderBottomColor: isDark ? '#1f2e2a' : '#ded2bb' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {isVerifiedLyrics && (
                    <View style={styles.verifiedTag}>
                      <CheckCircle2 size={12} color={colors.mint} />
                      <Text style={styles.verifiedTagText}>VERIFIED</Text>
                    </View>
                  )}
                  <Text style={[styles.lyricsHeader, { color: textSub }]}>OFFICIAL TRANSCRIPT</Text>
                </View>
                {isLoadingLyrics && (
                  <ActivityIndicator size="small" color={colors.mint} />
                )}
              </View>

              {lyricsList.length > 0 ? (
                <View style={styles.lyricsLinesList}>
                  {lyricsList.map((line, idx) => {
                    const isActive = idx === activeLyricIndex;
                    return (
                      <TouchableOpacity
                        key={idx}
                        onPress={() => seekTo(line.time)}
                        activeOpacity={0.7}
                        style={[
                          styles.lyricLineBox,
                          isActive && {
                            backgroundColor: isDark ? 'rgba(23, 163, 152, 0.2)' : 'rgba(23, 163, 152, 0.15)',
                            borderColor: colors.mint,
                            borderWidth: 1.5,
                          }
                        ]}
                      >
                        <Text style={[
                          styles.lyricLineText,
                          { color: isActive ? (isDark ? '#ffffff' : colors.ink) : (isDark ? '#9ca3af' : '#4b5563') },
                          isActive && styles.lyricLineTextActive
                        ]}>
                          {line.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyLyricsBox}>
                  <ListMusic size={32} color={colors.mint} style={{ marginBottom: 12 }} />
                  <Text style={[styles.emptyLyricsTitle, { color: textTitle }]}>No Lyrics Found</Text>
                  <Text style={styles.emptyLyricsText}>
                    {isLoadingLyrics ? 'Retrieving synchronized lyrics from dispensary...' : 'Lyrics could not be loaded for this track.'}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}

        {/* ── Queue Tab ── */}
        {activeTab === 'queue' && (
          <FlatList
            data={queue}
            keyExtractor={(item, index) => `${item._id || item.id}-${index}`}
            renderItem={({ item, index }) => {
              const isItemPlaying = String(item._id || item.id) === trackId;
              const itemCover = normalizeCoverUri(item.coverUrl || item.cover);
              return (
                <TouchableOpacity
                  style={[
                    styles.queueItem,
                    { backgroundColor: deckBg, borderColor: isItemPlaying ? colors.mint : deckBorder },
                    isItemPlaying && { backgroundColor: isDark ? '#14201c' : '#e6f4f1' }
                  ]}
                  onPress={() => playTrack(item, queue, false, index)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: itemCover }} style={styles.queueThumb} />
                  <View style={{ flex: 1, marginHorizontal: 12 }}>
                    <Text style={[styles.queueTitle, { color: isItemPlaying ? colors.mint : textTitle }]} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text style={styles.queueArtist} numberOfLines={1}>{item.artist}</Text>
                  </View>
                  {isItemPlaying && (
                    <View style={styles.playingIndicator}>
                      <Play size={12} color={colors.ink} fill={colors.ink} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={styles.queueBody}
            ListEmptyComponent={
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ color: '#9ca3af', fontFamily: 'monospace' }}>Queue is empty.</Text>
              </View>
            }
          />
        )}

        {/* Sleep Timer Modal */}
        <SleepTimerModal visible={isSleepTimerOpen} onClose={() => setIsSleepTimerOpen(false)} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  ambientCover: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.35,
    transform: [{ scale: 1.3 }],
  },
  ambientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    zIndex: 10,
  },
  topBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#fdfbf7',
    borderWidth: 2,
    borderColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.ink,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  headerPill: {
    backgroundColor: colors.teal,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  headerPillText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontWeight: '900',
    color: colors.ink,
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#fdfbf7',
    marginTop: 4,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    padding: 3,
    marginVertical: 10,
    zIndex: 10,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 18,
  },
  activeTabBtn: {
    backgroundColor: colors.teal,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#9ca3af',
  },
  activeTabText: {
    color: colors.ink,
  },
  playerScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  deckCard: {
    borderRadius: 20,
    borderWidth: 2.5,
    padding: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.7,
    shadowRadius: 20,
    elevation: 10,
  },
  deckHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 1.5,
    marginBottom: 10,
  },
  deckHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.teal,
  },
  pulsingDotActive: {
    backgroundColor: '#10b981',
  },
  deckTitle: {
    fontSize: 10,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  deckBadge: {
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: colors.mint,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  deckBadgeText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontWeight: '900',
    color: colors.mint,
  },
  tvEnclosure: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  tvScreen: {
    width: '100%',
    height: Math.min(240, height * 0.3),
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000000',
    borderWidth: 2,
    borderColor: '#070b0a',
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  tvScanlines: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  cassetteSpoolBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    marginTop: 6,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: 4,
  },
  spoolLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  spoolText: {
    fontSize: 8,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontWeight: '900',
    color: colors.mint,
    letterSpacing: 0.5,
  },
  spoolWheels: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  spoolWheel: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.mint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spoolInnerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.mint,
  },
  spoolBelt: {
    width: 14,
    height: 2,
    backgroundColor: colors.mint,
    borderRadius: 1,
  },
  trackInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  genreBadge: {
    backgroundColor: colors.teal,
    alignSelf: 'flex-start',
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginBottom: 4,
  },
  genreBadgeText: {
    fontSize: 8,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontWeight: '900',
    color: colors.ink,
  },
  songTitle: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  songArtist: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  trackActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brutalIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  seekSection: {
    width: '100%',
    marginBottom: 10,
  },
  seekTouchArea: {
    paddingVertical: 8,
  },
  seekTrack: {
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
    overflow: 'hidden',
  },
  seekFill: {
    height: '100%',
    backgroundColor: colors.teal,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  timeText: {
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontSize: 10,
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    marginVertical: 4,
  },
  transportBtn: {
    padding: 10,
    position: 'relative',
  },
  repeatOneBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: colors.mint,
    borderRadius: 5,
    width: 10,
    height: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  repeatOneText: {
    fontSize: 7,
    fontWeight: '900',
    color: colors.ink,
  },
  mainPlayWrapper: {
    position: 'relative',
  },
  mainPlayShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.ink,
    borderRadius: 12,
  },
  mainPlayBtn: {
    width: 62,
    height: 62,
    borderRadius: 12,
    backgroundColor: colors.teal,
    borderWidth: 2.5,
    borderColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deckFooterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  footerPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  footerPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  lyricsBody: {
    paddingVertical: 10,
    paddingBottom: 40,
  },
  lyricsCard: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
  },
  lyricsCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  lyricsHeader: {
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  verifiedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(23, 163, 152, 0.15)',
    borderWidth: 1,
    borderColor: colors.mint,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  verifiedTagText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontWeight: '900',
    color: colors.mint,
  },
  lyricsLinesList: {
    gap: 8,
  },
  lyricLineBox: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  lyricLineText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  lyricLineTextActive: {
    fontWeight: '900',
    fontSize: 18,
  },
  emptyLyricsBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyLyricsTitle: {
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 4,
  },
  emptyLyricsText: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  queueBody: {
    paddingVertical: 10,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 10,
    marginBottom: 8,
  },
  queueThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#000000',
  },
  queueTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  queueArtist: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  playingIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.teal,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
