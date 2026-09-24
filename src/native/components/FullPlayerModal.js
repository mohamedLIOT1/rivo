import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, Image, TouchableOpacity, Modal, StyleSheet, Dimensions,
  ScrollView, Platform, FlatList, ActivityIndicator
} from 'react-native';
import {
  ChevronDown, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart,
  Moon, ListMusic, AlignLeft, Sparkles, Disc, Download, CheckCircle2
} from 'lucide-react-native';
import { useAudioPlayer, useAudioProgress } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { colors } from '../theme/colors';
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

  const [activeTab, setActiveTab] = useState('player'); // 'player' | 'lyrics' | 'queue'
  const [isSleepTimerOpen, setIsSleepTimerOpen] = useState(false);
  const lyricsScrollRef = useRef(null);

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
        y: Math.max(0, activeLyricIndex * 46 - 120),
        animated: true,
      });
    }
  }, [activeLyricIndex, activeTab]);

  if (!visible || !currentTrack) return null;

  const trackId = String(currentTrack._id || currentTrack.id || '');
  const isLiked = Array.isArray(likedTrackIds) ? likedTrackIds.includes(trackId) : false;
  const isDownloaded = (Array.isArray(downloadedTracks) ? downloadedTracks : []).some(t => String(t._id || t.id) === trackId);
  const isDownloading = Boolean(downloadingIds && downloadingIds[trackId] !== undefined);

  const formatTime = (secs) => {
    if (isNaN(secs) || secs === null) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const defaultCover = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800';

  const handleSeekPress = (e) => {
    const { locationX } = e.nativeEvent;
    const barWidth = width - 48;
    const targetPercent = Math.max(0, Math.min(1, locationX / barWidth));
    seekTo(targetPercent * duration);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top Apothecary Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconBox}>
            <ChevronDown size={22} color={colors.ink} />
          </TouchableOpacity>

          <View style={{ alignItems: 'center' }}>
            <CassetteTag label="CLINICAL AUDIO DECK" bg={colors.ink} textColor={colors.teal} />
            <Text style={styles.subHeader}>RIVO SONIC DISPENSARY</Text>
          </View>

          <TouchableOpacity onPress={() => setIsSleepTimerOpen(true)} style={styles.iconBox}>
            <Moon size={18} color={colors.ink} />
          </TouchableOpacity>
        </View>

        {/* Tab Switcher: Player / Lyrics / Queue */}
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'player' && styles.activeTabBtn]}
            onPress={() => setActiveTab('player')}
          >
            <Disc size={15} color={activeTab === 'player' ? colors.ink : colors.textMuted} />
            <Text style={[styles.tabText, activeTab === 'player' && styles.activeTabText]}>Vinyl Deck</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'lyrics' && styles.activeTabBtn]}
            onPress={() => setActiveTab('lyrics')}
          >
            <AlignLeft size={15} color={activeTab === 'lyrics' ? colors.ink : colors.textMuted} />
            <Text style={[styles.tabText, activeTab === 'lyrics' && styles.activeTabText]}>Lyrics</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'queue' && styles.activeTabBtn]}
            onPress={() => setActiveTab('queue')}
          >
            <ListMusic size={15} color={activeTab === 'queue' ? colors.ink : colors.textMuted} />
            <Text style={[styles.tabText, activeTab === 'queue' && styles.activeTabText]}>Queue ({queue.length})</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'player' && (
          <View style={styles.playerBody}>
            {/* Album Art Frame (Static, Zero-Lag) */}
            <View style={styles.artworkOuterFrame}>
              <View style={styles.artworkShadow} />
              <View style={styles.artworkBox}>
                <Image
                  source={{ uri: currentTrack.coverUrl || currentTrack.cover || defaultCover }}
                  style={styles.coverArt}
                  resizeMode="cover"
                />
                {/* Center Spindle Hole */}
                <View style={styles.centerHole} />
              </View>
            </View>

            {/* Track Info Card */}
            <View style={styles.trackCardOuter}>
              <View style={styles.trackCardShadow} />
              <View style={styles.trackCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title} numberOfLines={1}>
                    {currentTrack.title || 'Untitled Tape'}
                  </Text>
                  <Text style={styles.artist} numberOfLines={1}>
                    {currentTrack.artist || 'Unknown Artist'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => !isDownloaded && !isDownloading && handleDownloadTrack(currentTrack)}
                    style={styles.downloadBtn}
                    disabled={isDownloading || isDownloaded}
                    activeOpacity={0.8}
                  >
                    {isDownloading ? (
                      <ActivityIndicator size="small" color={colors.ink} />
                    ) : isDownloaded ? (
                      <CheckCircle2 size={22} color={colors.tealDark} />
                    ) : (
                      <Download size={22} color={colors.ink} />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => toggleLikeTrack(trackId)}
                    style={styles.likeBtn}
                  >
                    <Heart
                      size={24}
                      color={isLiked ? colors.crimson : colors.ink}
                      fill={isLiked ? colors.crimson : 'transparent'}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Progress Bar & Timestamps */}
            <View style={styles.seekSection}>
              <TouchableOpacity activeOpacity={1} onPress={handleSeekPress} style={styles.seekTouchArea}>
                <View style={styles.seekTrack}>
                  <View style={[styles.seekFill, { width: `${progressPercent}%` }]} />
                </View>
              </TouchableOpacity>
              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>
            </View>

            {/* Tactical Control Bar */}
            <View style={styles.controlsRow}>
              <TouchableOpacity
                style={styles.controlIcon}
                onPress={() => setIsShuffle(!isShuffle)}
              >
                <Shuffle size={20} color={isShuffle ? colors.tealLight : colors.textMuted} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.skipBtn} onPress={playPrevTrack}>
                <SkipBack size={26} color={colors.textWhite} />
              </TouchableOpacity>

              {/* Main Play Button with Hard Shadow */}
              <View style={styles.mainPlayWrapper}>
                <View style={styles.mainPlayShadow} />
                <TouchableOpacity
                  style={styles.mainPlayBtn}
                  onPress={togglePlay}
                  activeOpacity={0.8}
                >
                  {isPlaying ? (
                    <Pause size={28} color={colors.ink} fill={colors.ink} />
                  ) : (
                    <Play size={28} color={colors.ink} fill={colors.ink} style={{ marginLeft: 3 }} />
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.skipBtn} onPress={playNextTrack}>
                <SkipForward size={26} color={colors.textWhite} />
              </TouchableOpacity>

              <TouchableOpacity style={styles.controlIcon} onPress={toggleRepeat}>
                <Repeat size={20} color={repeatMode !== 'off' ? colors.tealLight : colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Extra Shortcuts (Sleep Timer) */}
            <View style={styles.shortcutsRow}>
              <TouchableOpacity
                style={[styles.shortcutBtn, { flex: 1 }]}
                onPress={() => setIsSleepTimerOpen(true)}
              >
                <Moon size={16} color={colors.ink} />
                <Text style={styles.shortcutText}>Sleep Timer</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Lyrics Tab */}
        {activeTab === 'lyrics' && (
          <ScrollView
            ref={lyricsScrollRef}
            contentContainerStyle={styles.lyricsBody}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.lyricsCard}>
              <View style={styles.lyricsCardHeaderRow}>
                <Text style={styles.lyricsHeader}>OFFICIAL TRANSCRIPT</Text>
                {isLoadingLyrics && (
                  <ActivityIndicator size="small" color={colors.tealLight} />
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
                        style={[styles.lyricLineBox, isActive && styles.lyricLineBoxActive]}
                      >
                        <Text style={[styles.lyricLineText, isActive && styles.lyricLineTextActive]}>
                          {line.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyLyricsBox}>
                  <Text style={styles.emptyLyricsText}>
                    {isLoadingLyrics ? 'Retrieving synchronized lyrics from dispensary...' : 'No synchronized lyrics available for this audio file.'}
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>
        )}

        {/* Queue Tab */}
        {activeTab === 'queue' && (
          <FlatList
            data={queue}
            keyExtractor={(item, index) => `${item._id || item.id}-${index}`}
            renderItem={({ item }) => {
              const isItemPlaying = String(item._id || item.id) === trackId;
              return (
                <TouchableOpacity
                  style={[styles.queueItem, isItemPlaying && styles.queueItemActive]}
                  onPress={() => playTrack(item, queue)}
                >
                  <Text style={[styles.queueTitle, isItemPlaying && styles.queueTitleActive]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={styles.queueArtist} numberOfLines={1}>{item.artist}</Text>
                </TouchableOpacity>
              );
            }}
            contentContainerStyle={styles.queueBody}
            ListEmptyComponent={
              <View style={{ padding: 40, alignItems: 'center' }}>
                <Text style={{ color: colors.textMuted }}>Queue is empty.</Text>
              </View>
            }
          />
        )}

        {/* Modals */}
        <SleepTimerModal visible={isSleepTimerOpen} onClose={() => setIsSleepTimerOpen(false)} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.deepForest,
    paddingTop: Platform.OS === 'ios' ? 44 : 24,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  iconBox: {
    width: 36,
    height: 36,
    backgroundColor: colors.teal,
    borderWidth: 2,
    borderColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subHeader: {
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontSize: 10,
    fontWeight: '900',
    color: colors.tealLight,
    marginTop: 4,
    letterSpacing: 1,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceDark,
    borderWidth: 2.5,
    borderColor: colors.ink,
    marginVertical: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  activeTabBtn: {
    backgroundColor: colors.teal,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
  },
  activeTabText: {
    color: colors.ink,
  },
  playerBody: {
    flex: 1,
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
  },
  artworkOuterFrame: {
    position: 'relative',
    marginVertical: 8,
  },
  artworkShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    backgroundColor: colors.ink,
    borderRadius: (width - 120) / 2,
  },
  artworkBox: {
    width: width - 120,
    height: width - 120,
    borderRadius: (width - 120) / 2,
    borderWidth: 3.5,
    borderColor: colors.ink,
    overflow: 'hidden',
    backgroundColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coverArt: {
    width: '100%',
    height: '100%',
  },
  centerHole: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.deepForest,
    borderWidth: 4,
    borderColor: colors.ink,
  },
  trackCardOuter: {
    width: '100%',
    position: 'relative',
    marginVertical: 8,
  },
  trackCardShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.ink,
  },
  trackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBg,
    borderWidth: 2.5,
    borderColor: colors.ink,
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    color: colors.ink,
  },
  artist: {
    fontSize: 13,
    color: colors.tealDark,
    fontWeight: '700',
    marginTop: 2,
  },
  likeBtn: {
    padding: 8,
  },
  seekSection: {
    width: '100%',
    marginVertical: 4,
  },
  seekTouchArea: {
    paddingVertical: 8,
  },
  seekTrack: {
    height: 6,
    backgroundColor: colors.ink,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.ink,
  },
  seekFill: {
    height: '100%',
    backgroundColor: colors.teal,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontSize: 11,
    color: colors.tealLight,
    fontWeight: '700',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 8,
    marginVertical: 4,
  },
  controlIcon: {
    padding: 10,
  },
  skipBtn: {
    padding: 10,
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
  },
  mainPlayBtn: {
    width: 60,
    height: 60,
    backgroundColor: colors.teal,
    borderWidth: 2.5,
    borderColor: colors.ink,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shortcutsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  shortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.paper,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  shortcutText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.ink,
    textTransform: 'uppercase',
  },
  downloadBtn: {
    padding: 8,
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 8,
  },
  lyricsBody: {
    paddingVertical: 16,
    paddingBottom: 40,
  },
  lyricsCard: {
    backgroundColor: colors.surfaceDark,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 8,
    padding: 16,
  },
  lyricsCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 8,
  },
  lyricsHeader: {
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontSize: 11,
    color: colors.tealLight,
    fontWeight: '900',
    letterSpacing: 1,
  },
  lyricsLinesList: {
    gap: 8,
  },
  lyricLineBox: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  lyricLineBoxActive: {
    backgroundColor: 'rgba(23, 163, 152, 0.18)',
    borderLeftWidth: 3,
    borderLeftColor: colors.mint,
  },
  lyricLineText: {
    fontSize: 15,
    color: 'rgba(253, 251, 247, 0.65)',
    lineHeight: 24,
    fontWeight: '600',
  },
  lyricLineTextActive: {
    color: colors.mint,
    fontSize: 17,
    fontWeight: '900',
  },
  emptyLyricsBox: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyLyricsText: {
    fontSize: 13,
    color: colors.paperMuted,
    textAlign: 'center',
  },
  lyricsText: {
    fontSize: 16,
    color: colors.textWhite,
    lineHeight: 28,
    fontWeight: '600',
  },
  queueBody: {
    paddingVertical: 8,
  },
  queueItem: {
    backgroundColor: colors.surfaceDark,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: 12,
    marginBottom: 8,
  },
  queueItemActive: {
    borderColor: colors.tealLight,
    backgroundColor: '#182924',
  },
  queueTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.textWhite,
  },
  queueTitleActive: {
    color: colors.tealLight,
  },
  queueArtist: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
