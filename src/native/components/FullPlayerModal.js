import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, Image, TouchableOpacity, Modal, StyleSheet, Dimensions,
  ScrollView, Platform, FlatList, ActivityIndicator, Animated, TextInput, Alert,
  KeyboardAvoidingView, PanResponder
} from 'react-native';
import {
  ChevronDown, ChevronUp, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Heart,
  Moon, ListMusic, AlignLeft, Sparkles, Disc, Download, CheckCircle2, RotateCw,
  MoreHorizontal, Mic, Volume2, Edit3, Plus, Check, X, Trash2, GripVertical
} from 'lucide-react-native';
import { useAudioPlayer, useAudioProgress } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { colors } from '../theme/colors';
import { normalizeCoverUri } from '../utils/coverUtils';
import { API_BASE_URL } from '../config';
import { updateDownloadedTrackLyrics } from '../services/downloadManager';
import CassetteTag from '../ui/CassetteTag';
import SleepTimerModal from './SleepTimerModal';
import { parseLrcLyrics } from '../../utils/lrcParser';

const { width, height } = Dimensions.get('window');
const QUEUE_ROW_HEIGHT = 72;

function DraggableQueueList({
  queue,
  trackId,
  isDark,
  colors,
  deckBg,
  deckBorder,
  textTitle,
  playTrack,
  removeFromQueue,
  reorderQueue,
}) {
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [hoverIdx, setHoverIdx] = useState(null);
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const draggingIdxRef = useRef(null);
  const hoverIdxRef = useRef(null);
  const panY = useRef(new Animated.Value(0)).current;
  const listRef = useRef(null);
  const scrollOffsetRef = useRef(0);

  draggingIdxRef.current = draggingIdx;
  hoverIdxRef.current = hoverIdx;

  const shiftAnims = useRef(new Map()).current;
  const getShiftAnim = (idx) => {
    if (!shiftAnims.has(idx)) {
      shiftAnims.set(idx, new Animated.Value(0));
    }
    return shiftAnims.get(idx);
  };

  useEffect(() => {
    if (draggingIdx === null || hoverIdx === null) {
      queue.forEach((_, i) => {
        const anim = getShiftAnim(i);
        Animated.spring(anim, {
          toValue: 0,
          friction: 9,
          tension: 70,
          useNativeDriver: true,
        }).start();
      });
      return;
    }

    queue.forEach((_, i) => {
      if (i === draggingIdx) return;
      let targetShift = 0;
      if (draggingIdx < hoverIdx) {
        if (i > draggingIdx && i <= hoverIdx) {
          targetShift = -QUEUE_ROW_HEIGHT;
        }
      } else if (draggingIdx > hoverIdx) {
        if (i >= hoverIdx && i < draggingIdx) {
          targetShift = QUEUE_ROW_HEIGHT;
        }
      }
      const anim = getShiftAnim(i);
      Animated.spring(anim, {
        toValue: targetShift,
        friction: 9,
        tension: 70,
        useNativeDriver: true,
      }).start();
    });
  }, [draggingIdx, hoverIdx, queue.length]);

  const createPanResponder = (index) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 2,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => Math.abs(gestureState.dy) > 2,
      onPanResponderGrant: () => {
        setScrollEnabled(false);
        setDraggingIdx(index);
        setHoverIdx(index);
        panY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        panY.setValue(gestureState.dy);
        const deltaSlots = Math.round(gestureState.dy / QUEUE_ROW_HEIGHT);
        const nextHover = Math.max(0, Math.min(queue.length - 1, index + deltaSlots));
        if (hoverIdxRef.current !== nextHover) {
          setHoverIdx(nextHover);
        }
        if (listRef.current) {
          if (gestureState.moveY < 180 && scrollOffsetRef.current > 0) {
            scrollOffsetRef.current = Math.max(0, scrollOffsetRef.current - 8);
            listRef.current.scrollToOffset({ offset: scrollOffsetRef.current, animated: false });
          } else if (gestureState.moveY > height - 180) {
            scrollOffsetRef.current = scrollOffsetRef.current + 8;
            listRef.current.scrollToOffset({ offset: scrollOffsetRef.current, animated: false });
          }
        }
      },
      onPanResponderRelease: () => {
        const from = index;
        const to = hoverIdxRef.current;
        if (to !== null && to !== from && reorderQueue) {
          reorderQueue(from, to);
        }
        setDraggingIdx(null);
        setHoverIdx(null);
        setScrollEnabled(true);
        panY.setValue(0);
      },
      onPanResponderTerminate: () => {
        setDraggingIdx(null);
        setHoverIdx(null);
        setScrollEnabled(true);
        panY.setValue(0);
      },
    });
  };

  const panResponders = useMemo(() => {
    return queue.map((_, i) => createPanResponder(i));
  }, [queue.length, reorderQueue]);

  return (
    <FlatList
      ref={listRef}
      data={queue}
      scrollEnabled={scrollEnabled}
      onScroll={(e) => {
        scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={16}
      keyExtractor={(item, index) => `${item._id || item.id}-${index}`}
      renderItem={({ item, index }) => {
        const isItemPlaying = String(item._id || item.id) === trackId;
        const itemCover = normalizeCoverUri(item.coverUrl || item.cover, item);
        const isDragging = draggingIdx === index;
        const shift = isDragging ? panY : getShiftAnim(index);

        return (
          <Animated.View
            style={[
              styles.queueItem,
              {
                backgroundColor: deckBg,
                borderColor: isDragging
                  ? colors.mint
                  : isItemPlaying
                  ? colors.mint
                  : deckBorder,
                transform: [
                  { translateY: shift },
                  { scale: isDragging ? 1.03 : 1 }
                ],
                zIndex: isDragging ? 9999 : 1,
                elevation: isDragging ? 20 : 0,
                shadowColor: isDragging ? colors.mint : '#000',
                shadowOffset: { width: 0, height: isDragging ? 6 : 1 },
                shadowOpacity: isDragging ? 0.35 : 0.05,
                shadowRadius: isDragging ? 8 : 2,
              },
              isItemPlaying && !isDragging && {
                backgroundColor: isDark ? '#14201c' : '#e6f4f1'
              },
              isDragging && {
                backgroundColor: isDark ? '#182d27' : '#d5f0eb'
              }
            ]}
          >
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}
              onPress={() => playTrack(item, queue)}
              activeOpacity={0.75}
              disabled={isDragging}
            >
              <Image source={{ uri: itemCover }} style={styles.queueThumb} />
              <View style={{ flex: 1, marginHorizontal: 10 }}>
                <Text style={[styles.queueTitle, { color: isItemPlaying ? colors.mint : textTitle }]} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.queueArtist} numberOfLines={1}>{item.artist}</Text>
              </View>
            </TouchableOpacity>

            <View style={styles.queueControlsRow}>
              <TouchableOpacity
                onPress={() => removeFromQueue && removeFromQueue(index)}
                style={styles.queueActionBtn}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Trash2 size={15} color="#ef4444" />
              </TouchableOpacity>

              {queue.length > 1 && (
                <View
                  {...(panResponders[index] ? panResponders[index].panHandlers : {})}
                  style={[
                    styles.dragHandle,
                    isDragging && { backgroundColor: colors.mint + '33' }
                  ]}
                  hitSlop={{ top: 12, bottom: 12, left: 10, right: 10 }}
                >
                  <GripVertical size={18} color={isDragging ? colors.mint : (isDark ? '#94a3b8' : '#64748b')} />
                </View>
              )}
            </View>
          </Animated.View>
        );
      }}
      contentContainerStyle={styles.queueBody}
      ListEmptyComponent={
        <View style={{ padding: 40, alignItems: 'center' }}>
          <Text style={{ color: '#9ca3af', fontFamily: 'monospace' }}>Queue is empty.</Text>
        </View>
      }
    />
  );
}

export default function FullPlayerModal({ visible, onClose, onTrackAction }) {
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
    downloadedTracks = [],
    downloadingIds = {},
    handleDownloadTrack,
    volume = 0.8,
    setVolume,
  } = useAudioPlayer();

  const { currentTime, duration } = useAudioProgress();
  const { likedTrackIds = [], toggleLikeTrack, token, currentUser } = useUser();
  const { isDark } = useTheme();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('player'); // 'player' | 'lyrics' | 'queue'
  const [isSleepTimerOpen, setIsSleepTimerOpen] = useState(false);
  const [isEditLyricsOpen, setIsEditLyricsOpen] = useState(false);
  const [lyricsInputText, setLyricsInputText] = useState('');
  const [isSavingLyrics, setIsSavingLyrics] = useState(false);
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

  const handleOpenEditLyrics = () => {
    if (Array.isArray(lyricsList) && lyricsList.length > 0) {
      const formatted = lyricsList.map(l => {
        const m = Math.floor(l.time / 60);
        const s = Math.floor(l.time % 60);
        const cs = Math.floor((l.time % 1) * 100);
        return `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}] ${l.text}`;
      }).join('\n');
      setLyricsInputText(formatted);
    } else {
      setLyricsInputText('');
    }
    setIsEditLyricsOpen(true);
  };

  const handleSaveLyrics = async () => {
    if (!currentTrack) return;
    if (!token) {
      if (showToast) showToast('Please log in to add or edit lyrics', 'warning');
      return;
    }
    const raw = lyricsInputText.trim();
    if (!raw) {
      if (showToast) showToast('Please enter lyrics lines', 'warning');
      return;
    }
    setIsSavingLyrics(true);
    try {
      const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
      const parsed = lines.map((line, idx) => {
        const match = line.match(/\[?(\d+):(\d+)(?:\.(\d+))?\]?\s*(.*)/);
        if (match) {
          const m = parseInt(match[1]);
          const s = parseInt(match[2]);
          const cs = match[3] ? parseInt(match[3].padEnd(2, '0').slice(0, 2)) : 0;
          const time = m * 60 + s + cs / 100;
          return { time: Math.round(time * 100) / 100, text: match[4].trim() || line };
        } else {
          const songDur = duration || currentTrack?.duration || 180;
          const step = Math.max(2, (songDur - 10) / Math.max(1, lines.length));
          return { time: Math.round((5 + idx * step) * 100) / 100, text: line };
        }
      });

      const trackId = currentTrack._id || currentTrack.id;
      const res = await fetch(`${API_BASE_URL}/api/tracks/${trackId}/lyrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          trackId,
          title: currentTrack.title,
          artist: currentTrack.artist,
          lyrics: parsed,
          isVerified: true
        })
      });

      if (res.ok) {
        if (setLyrics) setLyrics(parsed);
        currentTrack.lyrics = parsed;
        currentTrack.isVerifiedLyrics = true;
        await updateDownloadedTrackLyrics(currentTrack, parsed).catch(() => {});
        if (showToast) showToast('Lyrics saved & synced!', 'success');
        setIsEditLyricsOpen(false);
      } else {
        const res2 = await fetch(`${API_BASE_URL}/api/tracks/update-lyrics`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            trackId,
            title: currentTrack.title,
            artist: currentTrack.artist,
            lyrics: parsed,
            isVerified: true
          })
        });
        if (res2.ok) {
          if (setLyrics) setLyrics(parsed);
          currentTrack.lyrics = parsed;
          currentTrack.isVerifiedLyrics = true;
          await updateDownloadedTrackLyrics(currentTrack, parsed).catch(() => {});
          if (showToast) showToast('Lyrics saved & synced!', 'success');
          setIsEditLyricsOpen(false);
        } else {
          if (showToast) showToast('Failed to save lyrics', 'error');
        }
      }
    } catch (err) {
      if (showToast) showToast(`Save error: ${err.message}`, 'error');
    } finally {
      setIsSavingLyrics(false);
    }
  };

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
  const coverUri = normalizeCoverUri(currentTrack.coverUrl || currentTrack.cover, currentTrack);

  const handleSeekPress = (e) => {
    const { locationX } = e.nativeEvent;
    const barWidth = width - 64;
    const targetPercent = Math.max(0, Math.min(1, locationX / barWidth));
    seekTo(targetPercent * duration);
  };

  const handleVolumePress = (e) => {
    try {
      const x = e?.nativeEvent?.locationX;
      if (typeof x === 'number' && x >= 0) {
        const ratio = Math.max(0, Math.min(1, x / 75));
        if (setVolume) setVolume(ratio);
        return;
      }
    } catch {}
    if (setVolume) {
      setVolume((volume || 0.8) > 0.1 ? 0 : 0.8);
    }
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

        {/* ── Top Header Bar (Matching Reference Screenshot) ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.topWhiteBtn} activeOpacity={0.8}>
            <ChevronDown size={20} color="#000000" strokeWidth={3} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.headerPill}>
              <Text style={styles.headerPillText}>RIVO HI-FI STEREO • 24-BIT MASTER</Text>
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {currentTrack.title || 'Unknown Track'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => onTrackAction && onTrackAction(currentTrack)}
            style={styles.topWhiteBtn}
            activeOpacity={0.8}
          >
            <MoreHorizontal size={20} color="#000000" strokeWidth={3} />
          </TouchableOpacity>
        </View>

        {/* ── Tab Switcher: Now Playing / Lyrics / Queue ── */}
        <View style={styles.tabsRow}>
          {[
            { id: 'player', label: 'Now Playing' },
            { id: 'lyrics', label: 'Lyrics' },
            { id: 'queue', label: `Queue (${queue.length})` },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
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
            <View style={styles.deckCard}>
              {/* Deck Top Label */}
              <View style={styles.deckHeader}>
                <View style={styles.deckHeaderLeft}>
                  <View style={[styles.pulsingDot, isPlaying && styles.pulsingDotActive]} />
                  <Text style={styles.deckTitle}>
                    RIVO STEREO DECK // CR-500
                  </Text>
                </View>
                <View style={styles.deckBadge}>
                  <Text style={styles.deckBadgeText}>24-BIT HI-FI</Text>
                </View>
              </View>

              {/* ── Retro TV / CRT Monitor Enclosure ── */}
              <View style={styles.tvEnclosure}>
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
                <View style={styles.cassetteSpoolBar}>
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
                      {(currentTrack.genre || 'IMPORTED').toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.songTitle} numberOfLines={1}>
                    {currentTrack.title || 'Untitled Track'}
                  </Text>
                  <Text style={styles.songArtist} numberOfLines={1}>
                    {currentTrack.artist || 'Unknown Artist'}
                  </Text>
                </View>

                {/* Rounded Heart Button */}
                <TouchableOpacity
                  onPress={() => toggleLikeTrack(trackId)}
                  style={styles.deckHeartBtn}
                  activeOpacity={0.8}
                >
                  <Heart
                    size={20}
                    color={isLiked ? colors.crimson : '#9ca3af'}
                    fill={isLiked ? colors.crimson : 'transparent'}
                  />
                </TouchableOpacity>
              </View>

              {/* ── Seekbar with White Circular Thumb Indicator ── */}
              <View style={styles.seekSection}>
                <TouchableOpacity activeOpacity={1} onPress={handleSeekPress} style={styles.seekTouchArea}>
                  <View style={styles.seekTrack}>
                    <View style={[styles.seekFill, { width: `${progressPercent}%` }]} />
                    <View style={[styles.seekThumb, { left: `${Math.max(0, Math.min(100, progressPercent))}%` }]} />
                  </View>
                </TouchableOpacity>
                <View style={styles.timeRow}>
                  <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
                  <Text style={styles.timeText}>{formatTime(duration)}</Text>
                </View>
              </View>

              {/* ── Transport Controls ── */}
              <View style={styles.controlsRow}>
                {/* Shuffle Button */}
                <TouchableOpacity
                  style={styles.transportBtnBox}
                  onPress={() => toggleShuffle ? toggleShuffle() : setIsShuffle(!isShuffle)}
                  activeOpacity={0.7}
                >
                  <Shuffle size={18} color={isShuffle ? colors.mint : '#9ca3af'} />
                </TouchableOpacity>

                {/* Skip Prev */}
                <TouchableOpacity style={styles.transportBtnBox} onPress={playPrevTrack} activeOpacity={0.7}>
                  <SkipBack size={20} color="#ffffff" fill="#ffffff" />
                </TouchableOpacity>

                {/* Center Brutalist Play/Pause Button */}
                <TouchableOpacity
                  style={styles.mainPlayBtn}
                  onPress={togglePlay}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#0b1110" />
                  ) : isPlaying ? (
                    <Pause size={24} color="#0b1110" fill="#0b1110" />
                  ) : (
                    <Play size={24} color="#0b1110" fill="#0b1110" style={{ marginLeft: 2 }} />
                  )}
                </TouchableOpacity>

                {/* Skip Next */}
                <TouchableOpacity style={styles.transportBtnBox} onPress={playNextTrack} activeOpacity={0.7}>
                  <SkipForward size={20} color="#ffffff" fill="#ffffff" />
                </TouchableOpacity>

                {/* Repeat Button */}
                <TouchableOpacity style={styles.transportBtnBox} onPress={toggleRepeat} activeOpacity={0.7}>
                  <Repeat size={18} color={repeatMode !== 'off' ? colors.mint : '#9ca3af'} />
                  {repeatMode === 'one' && (
                    <View style={styles.repeatOneBadge}>
                      <Text style={styles.repeatOneText}>1</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* ── Dashed Divider ── */}
              <View style={styles.dashedDivider} />

              {/* ── Audio Toolbar Row: Volume + Quick Actions ── */}
              <View style={styles.audioToolbarRow}>
                {/* Left: Volume Control */}
                <View style={styles.volumeGroup}>
                  <Volume2 size={16} color="#94a3b8" />
                  <TouchableOpacity activeOpacity={1} onPress={handleVolumePress} style={styles.volTouchArea}>
                    <View style={styles.volTrack}>
                      <View style={[styles.volFill, { width: `${Math.round((volume || 0.8) * 100)}%` }]} />
                      <View style={[styles.volThumb, { left: `${Math.round((volume || 0.8) * 100)}%` }]} />
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.volPercentText}>{Math.round((volume || 0.8) * 100)}%</Text>
                </View>

                {/* Right: Quick Action Buttons */}
                <View style={styles.quickActionsGroup}>
                  {/* Vinyl Disc Toggle */}
                  <TouchableOpacity
                    style={styles.quickToolBtn}
                    onPress={() => setIsSleepTimerOpen(true)}
                    activeOpacity={0.8}
                  >
                    <Disc size={17} color="#94a3b8" />
                  </TouchableOpacity>

                  {/* Lyrics Quick Button (Teal Box) */}
                  <TouchableOpacity
                    style={styles.quickToolBtnTeal}
                    onPress={() => setActiveTab('lyrics')}
                    activeOpacity={0.8}
                  >
                    <Mic size={17} color="#0b1110" strokeWidth={2.4} />
                  </TouchableOpacity>

                  {/* Download Button */}
                  <TouchableOpacity
                    style={styles.quickToolBtn}
                    onPress={() => !isDownloaded && !isDownloading && handleDownloadTrack(currentTrack)}
                    disabled={isDownloading || isDownloaded}
                    activeOpacity={0.8}
                  >
                    {isDownloading ? (
                      <ActivityIndicator size="small" color="#17a398" />
                    ) : isDownloaded ? (
                      <CheckCircle2 size={17} color="#17a398" />
                    ) : (
                      <Download size={17} color="#94a3b8" />
                    )}
                  </TouchableOpacity>
                </View>
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
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {isLoadingLyrics && (
                    <ActivityIndicator size="small" color={colors.mint} />
                  )}
                  <TouchableOpacity
                    onPress={handleOpenEditLyrics}
                    style={styles.lyricsActionBtn}
                    activeOpacity={0.8}
                  >
                    <Edit3 size={14} color="#000000" strokeWidth={2.5} />
                    <Text style={styles.lyricsActionBtnText}>EDIT</Text>
                  </TouchableOpacity>
                </View>
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
                    {isLoadingLyrics ? 'Retrieving synchronized lyrics...' : 'Lyrics could not be loaded for this track.'}
                  </Text>
                  <TouchableOpacity
                    onPress={handleOpenEditLyrics}
                    style={[styles.lyricsActionBtn, { marginTop: 16, paddingHorizontal: 16 }]}
                    activeOpacity={0.8}
                  >
                    <Plus size={15} color="#000000" strokeWidth={2.5} />
                    <Text style={styles.lyricsActionBtnText}>ADD / SYNC LYRICS</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </ScrollView>
        )}

        {/* ── Queue Tab ── */}
        {activeTab === 'queue' && (
          <View style={{ flex: 1 }}>
            {queue.length > 0 && (
              <View style={styles.queueHeaderRow}>
                <Text style={[styles.queueHeaderTitle, { color: isDark ? colors.mint : colors.ink }]}>
                  UP NEXT ({queue.length})
                </Text>
                <TouchableOpacity
                  style={styles.clearQueueBtn}
                  onPress={() => {
                    Alert.alert(
                      'Clear Queue',
                      'Remove all upcoming songs from queue?',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Clear All', style: 'destructive', onPress: clearQueue }
                      ]
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.clearQueueBtnText}>CLEAR ALL</Text>
                </TouchableOpacity>
              </View>
            )}

            <DraggableQueueList
              queue={queue}
              trackId={trackId}
              isDark={isDark}
              colors={colors}
              deckBg={deckBg}
              deckBorder={deckBorder}
              textTitle={textTitle}
              playTrack={playTrack}
              removeFromQueue={removeFromQueue}
              reorderQueue={reorderQueue}
            />
          </View>
        )}

        {/* Edit / Add Lyrics Modal */}
        <Modal
          visible={isEditLyricsOpen}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setIsEditLyricsOpen(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.editLyricsOverlay}
          >
            <View style={[styles.editLyricsCard, { backgroundColor: isDark ? '#0e1614' : '#fdfbf7', borderColor: deckBorder }]}>
              <View style={styles.editLyricsHeader}>
                <View>
                  <Text style={[styles.editLyricsTitle, { color: textTitle }]}>
                    {lyricsList.length > 0 ? 'Edit Synchronized Lyrics' : 'Add Synchronized Lyrics'}
                  </Text>
                  <Text style={[styles.editLyricsSubtitle, { color: textSub }]}>
                    Format: [mm:ss.xx] Lyric text OR line-by-line
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setIsEditLyricsOpen(false)}
                  style={styles.editLyricsCloseBtn}
                >
                  <X size={18} color={textTitle} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={[
                  styles.editLyricsInput,
                  {
                    backgroundColor: isDark ? '#14201c' : '#ede5d3',
                    color: textTitle,
                    borderColor: deckBorder,
                  }
                ]}
                multiline
                value={lyricsInputText}
                onChangeText={setLyricsInputText}
                placeholder={"[00:12.50] Lyric line 1\n[00:15.80] Lyric line 2..."}
                placeholderTextColor={isDark ? '#4b5563' : '#9ca3af'}
                textAlignVertical="top"
              />

              <View style={styles.editLyricsActions}>
                <TouchableOpacity
                  style={[styles.editLyricsCancelBtn, { borderColor: deckBorder }]}
                  onPress={() => setIsEditLyricsOpen(false)}
                  disabled={isSavingLyrics}
                >
                  <Text style={[styles.editLyricsCancelText, { color: textTitle }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.editLyricsSaveBtn, isSavingLyrics && { opacity: 0.6 }]}
                  onPress={handleSaveLyrics}
                  disabled={isSavingLyrics}
                >
                  {isSavingLyrics ? (
                    <ActivityIndicator size="small" color="#000000" />
                  ) : (
                    <>
                      <Check size={16} color="#000000" strokeWidth={3} />
                      <Text style={styles.editLyricsSaveText}>SAVE & SYNC</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

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
    paddingTop: Platform.OS === 'ios' ? 44 : 12,
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 10,
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
  },
  topWhiteBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  headerPill: {
    backgroundColor: 'rgba(23,163,152,0.18)',
    borderWidth: 1,
    borderColor: '#17a398',
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  headerPillText: {
    fontSize: 8.5,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontWeight: '900',
    color: '#17a398',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 3,
  },
  tabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
    zIndex: 10,
    maxWidth: 400,
    width: '100%',
    alignSelf: 'center',
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  activeTabBtn: {
    backgroundColor: '#262f2d',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
  },
  activeTabText: {
    color: '#ffffff',
    fontWeight: '900',
  },
  playerScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  deckCard: {
    backgroundColor: '#0c1815',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#1d3630',
    padding: 14,
    marginHorizontal: 14,
    marginBottom: 18,
    maxWidth: 620,
    width: '100%',
    alignSelf: 'center',
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
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1d3630',
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
    backgroundColor: '#17a398',
  },
  pulsingDotActive: {
    backgroundColor: '#10b981',
  },
  deckTitle: {
    fontSize: 9.5,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontWeight: '900',
    color: '#17a398',
    letterSpacing: 0.6,
  },
  deckBadge: {
    backgroundColor: '#0c1815',
    borderWidth: 1,
    borderColor: '#17a398',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  deckBadgeText: {
    fontSize: 8.5,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontWeight: '900',
    color: '#17a398',
  },
  tvEnclosure: {
    backgroundColor: '#11201c',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#233d36',
    padding: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  tvScreen: {
    width: '100%',
    height: Math.min(210, height * 0.26),
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#000000',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
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
    borderTopColor: '#1d3630',
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
    color: '#17a398',
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
    borderColor: '#17a398',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spoolInnerDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#17a398',
  },
  spoolBelt: {
    width: 14,
    height: 2,
    backgroundColor: '#17a398',
    borderRadius: 1,
  },
  trackInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  genreBadge: {
    backgroundColor: '#17a398',
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  genreBadgeText: {
    fontSize: 8,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontWeight: '900',
    color: '#0b1110',
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.2,
  },
  songArtist: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9ca3af',
    marginTop: 2,
  },
  deckHeartBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#13231f',
    borderWidth: 1,
    borderColor: '#243a34',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seekSection: {
    width: '100%',
    marginBottom: 10,
  },
  seekTouchArea: {
    paddingVertical: 8,
  },
  seekTrack: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#182b26',
    position: 'relative',
  },
  seekFill: {
    height: '100%',
    backgroundColor: '#17a398',
    borderRadius: 1.5,
  },
  seekThumb: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ffffff',
    position: 'absolute',
    top: -4.5,
    marginLeft: -6,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontSize: 10,
    fontWeight: '800',
    color: '#17a398',
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginVertical: 4,
  },
  transportBtnBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#13231f',
    borderWidth: 1,
    borderColor: '#243a34',
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatOneBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#17a398',
    borderRadius: 5,
    width: 10,
    height: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  repeatOneText: {
    fontSize: 7,
    fontWeight: '900',
    color: '#0b1110',
  },
  mainPlayBtn: {
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: '#4fd1c5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4fd1c5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  dashedDivider: {
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#1f3630',
    marginVertical: 14,
  },
  audioToolbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  volumeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 14,
  },
  volTouchArea: {
    flex: 1,
    paddingVertical: 8,
  },
  volTrack: {
    height: 3,
    backgroundColor: '#182b26',
    borderRadius: 1.5,
    position: 'relative',
  },
  volFill: {
    height: '100%',
    backgroundColor: '#17a398',
    borderRadius: 1.5,
  },
  volThumb: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
    position: 'absolute',
    top: -3.5,
    marginLeft: -5,
  },
  volPercentText: {
    color: '#17a398',
    fontSize: 10.5,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontWeight: '800',
  },
  quickActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quickToolBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#13231f',
    borderWidth: 1,
    borderColor: '#243a34',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickToolBtnTeal: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#4fd1c5',
    alignItems: 'center',
    justifyContent: 'center',
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
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
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
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
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
  queueHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  queueHeaderTitle: {
    fontSize: 12,
    fontWeight: '900',
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  clearQueueBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  clearQueueBtnText: {
    color: '#ef4444',
    fontSize: 10,
    fontWeight: '900',
    fontFamily: 'monospace',
  },
  queueControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  queueActionBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  playingIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.teal,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lyricsActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.mint,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  lyricsActionBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#000000',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },
  editLyricsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  editLyricsCard: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 0,
    elevation: 8,
  },
  editLyricsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  editLyricsTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  editLyricsSubtitle: {
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  editLyricsCloseBtn: {
    padding: 4,
  },
  editLyricsInput: {
    height: 300,
    borderRadius: 8,
    borderWidth: 1.5,
    padding: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  editLyricsActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  editLyricsCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  editLyricsCancelText: {
    fontSize: 13,
    fontWeight: '800',
  },
  editLyricsSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.mint,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#000000',
  },
  editLyricsSaveText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#000000',
  },
});
