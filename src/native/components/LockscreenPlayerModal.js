import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Heart,
  X,
  ListMusic,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react-native';
import { useAudioPlayer, useAudioProgress } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { colors } from '../theme/colors';
import { parseLrcLyrics } from '../../utils/lrcParser';
import {
  isQuranContent,
  getSurahName,
  getSurahNumber,
  cleanQuranTrackTitle,
  getQuranReciterName,
} from '../../utils/quranUtils';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DEFAULT_COVER = 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=600&auto=format&fit=crop';
const DEFAULT_QURAN_COVER = 'https://images.unsplash.com/photo-1564769625905-50e93615e769?q=80&w=600&auto=format&fit=crop';

// Sample Mushaf Pages data for demo/offline recitations
const SAMPLE_MUSHAF_AYAT = [
  { id: 1, text: 'تَبَٰرَكَ ٱلَّذِي بِيَدِهِ ٱلۡمُلۡكُ وَهُوَ عَلَىٰ كُلِّ شَيۡءٖ قَدِيرٌ', num: '١', startSec: 0, endSec: 8 },
  { id: 2, text: 'ٱلَّذِي خَلَقَ ٱلۡمَوۡتَ وَٱلۡحَيَوٰةَ لِيَبۡلُوَكُمۡ أَيُّكُمۡ أَحۡسَنُ عَمَلٗاۚ وَهُوَ ٱلۡعَزِيزُ ٱلۡغَفُورُ', num: '٢', startSec: 8, endSec: 22 },
  { id: 3, text: 'ٱلَّذِي خَلَقَ سَبۡعَ سَمَٰوَٰتٖ طِبَاقٗاۖ مَّا تَرَىٰ فِي خَلۡقِ ٱلرَّحۡمَٰنِ مِن تَفَٰوُتٖۖ فَٱرۡجِعِ ٱلۡبَصَرَ هَلۡ تَرَىٰ مِن فُطُورٖ', num: '٣', startSec: 22, endSec: 40 },
  { id: 4, text: 'ثُمَّ ٱرۡجِعِ ٱلۡبَصَرَ كَرَّتَيۡنِ يَنقَلِبۡ إِلَيۡكَ ٱلۡبَصَرُ خَاسِئٗا وَهُوَ حَسِيرٞ', num: '٤', startSec: 40, endSec: 58 },
  { id: 5, text: 'وَلَقَدۡ زَيَّنَّا ٱلسَّمَآءَ ٱلدُّنۡيَا بِمَصَٰبِيحَ وَجَعَلۡنَٰهَا رُجُومٗا لِّلشَّيَٰطِينِۖ وَأَعۡتَدۡنَا لَهُمۡ عَذَابَ ٱلسَّعِيرِ', num: '٥', startSec: 58, endSec: 76 },
];

export default function LockscreenPlayerModal({ visible, onClose }) {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    playNextTrack,
    playPrevTrack,
    seekTo,
    isShuffle,
    toggleShuffle,
    repeatMode,
    toggleRepeat,
    queue,
    playTrack,
    lyrics: contextLyrics,
  } = useAudioPlayer();

  const { currentTime, duration } = useAudioProgress();
  const { likedTrackIds = [], toggleLikeTrack, toggleLike } = useUser() || {};

  // View Mode: 'artwork' (default for both) | 'lyrics' | 'mushaf' | 'queue'
  const [centerMode, setCenterMode] = useState('artwork');
  const [mushafPage, setMushafPage] = useState(562);

  // Live Clock
  const [currentTimeStr, setCurrentTimeStr] = useState('09:41');
  const [currentDateStr, setCurrentDateStr] = useState('Sunday, October 25');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      setCurrentTimeStr(`${hours}:${mins}`);
      const options = { weekday: 'long', month: 'long', day: 'numeric' };
      setCurrentDateStr(now.toLocaleDateString(undefined, options));
    };
    updateTime();
    const timer = setInterval(updateTime, 10000);
    return () => clearInterval(timer);
  }, []);

  const isQuran = useMemo(() => isQuranContent(currentTrack), [currentTrack]);

  // Default to 'artwork' when track changes
  useEffect(() => {
    setCenterMode('artwork');
  }, [currentTrack?.id, currentTrack?._id]);

  const activeCover = useMemo(() => {
    if (currentTrack?.coverUrl) return currentTrack.coverUrl;
    if (currentTrack?.cover) return currentTrack.cover;
    return isQuran ? DEFAULT_QURAN_COVER : DEFAULT_COVER;
  }, [currentTrack, isQuran]);

  const isLiked = useMemo(() => {
    const id = String(currentTrack?.id || currentTrack?._id || '');
    return likedTrackIds.includes(id);
  }, [likedTrackIds, currentTrack]);

  // Lyrics Parsing
  const parsedLyrics = useMemo(() => {
    const raw = currentTrack?.lyrics || contextLyrics;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return parseLrcLyrics(raw);
  }, [currentTrack?.lyrics, contextLyrics]);

  // Active Lyric Index based on currentTime
  const activeLyricIndex = useMemo(() => {
    if (!parsedLyrics.length) return -1;
    for (let i = parsedLyrics.length - 1; i >= 0; i--) {
      if (currentTime >= (parsedLyrics[i].time || 0)) {
        return i;
      }
    }
    return 0;
  }, [parsedLyrics, currentTime]);

  // Active Ayah Index based on currentTime
  const activeAyahIndex = useMemo(() => {
    for (let i = SAMPLE_MUSHAF_AYAT.length - 1; i >= 0; i--) {
      if (currentTime >= SAMPLE_MUSHAF_AYAT[i].startSec) {
        return i;
      }
    }
    return 0;
  }, [currentTime]);

  const effectiveDuration = duration > 0 ? duration : (Number(currentTrack?.duration) || 210);
  const progressPercent = effectiveDuration > 0 ? Math.min(100, (currentTime / effectiveDuration) * 100) : 0;

  const formatTime = (sec) => {
    if (!sec || isNaN(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleScrub = (event) => {
    const { locationX } = event.nativeEvent;
    const barWidth = SCREEN_WIDTH - 72;
    if (barWidth <= 0) return;
    const fraction = Math.max(0, Math.min(1, locationX / barWidth));
    seekTo(fraction * effectiveDuration);
  };

  const cleanTitle = useMemo(() => {
    if (!currentTrack) return 'No Track Playing';
    if (isQuran) return cleanQuranTrackTitle(currentTrack.title || '');
    return currentTrack.title || 'Unknown Title';
  }, [currentTrack, isQuran]);

  const cleanArtist = useMemo(() => {
    if (!currentTrack) return 'Rivo Music';
    if (isQuran) return getQuranReciterName(currentTrack);
    return currentTrack.artist || 'Unknown Artist';
  }, [currentTrack, isQuran]);

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <View style={styles.container}>
        {/* Full-Screen Ambient Blurred Cover Art Backdrop */}
        <Image
          source={{ uri: activeCover }}
          style={styles.ambientCoverBg}
          blurRadius={Platform.OS === 'ios' ? 32 : 22}
          resizeMode="cover"
        />
        {/* Cinematic Vignette Overlay */}
        <View style={styles.vignetteOverlay} />

        <View style={styles.contentSafeArea}>
          {/* Top Bar: Dismiss Pill & Clock */}
          <View style={styles.topBarRow}>
            <TouchableOpacity style={styles.dismissBtn} onPress={onClose} activeOpacity={0.8}>
              <X size={18} color="#ffffff" strokeWidth={2.5} />
            </TouchableOpacity>

            <View style={styles.clockHeader}>
              <Text style={styles.clockTimeText}>{currentTimeStr}</Text>
              <Text style={styles.clockDateText}>{currentDateStr}</Text>
            </View>

            <View style={{ width: 36 }} />
          </View>

          {/* Floating View Mode Switcher: Art (Default) • Lyrics/Mushaf • Queue */}
          <View style={styles.floatingModeBar}>
            <TouchableOpacity
              style={[styles.fPill, centerMode === 'artwork' && (isQuran ? styles.fPillGoldActive : styles.fPillActive)]}
              onPress={() => setCenterMode('artwork')}
              activeOpacity={0.8}
            >
              <Text style={[styles.fPillText, centerMode === 'artwork' && (isQuran ? styles.fPillGoldActiveText : styles.fPillActiveText)]}>
                Art
              </Text>
            </TouchableOpacity>

            {isQuran ? (
              <TouchableOpacity
                style={[styles.fPill, centerMode === 'mushaf' && styles.fPillGoldActive]}
                onPress={() => setCenterMode('mushaf')}
                activeOpacity={0.8}
              >
                <Text style={[styles.fPillText, centerMode === 'mushaf' && styles.fPillGoldActiveText]}>
                  Mushaf
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.fPill, centerMode === 'lyrics' && styles.fPillActive]}
                onPress={() => setCenterMode('lyrics')}
                activeOpacity={0.8}
              >
                <Text style={[styles.fPillText, centerMode === 'lyrics' && styles.fPillActiveText]}>
                  Lyrics
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.fPill, centerMode === 'queue' && (isQuran ? styles.fPillGoldActive : styles.fPillActive)]}
              onPress={() => setCenterMode('queue')}
              activeOpacity={0.8}
            >
              <Text style={[styles.fPillText, centerMode === 'queue' && (isQuran ? styles.fPillGoldActiveText : styles.fPillActiveText)]}>
                Queue
              </Text>
            </TouchableOpacity>
          </View>

          {/* Center Viewport */}
          <View style={styles.centerViewport}>
            {/* 1. ARTWORK (DEFAULT) */}
            {centerMode === 'artwork' && (
              <TouchableOpacity
                style={styles.artworkWrapper}
                onPress={() => setCenterMode(isQuran ? 'mushaf' : 'lyrics')}
                activeOpacity={0.92}
              >
                <Image source={{ uri: activeCover }} style={styles.artworkImage} resizeMode="cover" />
              </TouchableOpacity>
            )}

            {/* 2. SYNCED LYRICS (MUSIC) */}
            {centerMode === 'lyrics' && (
              <View style={styles.lyricsViewport}>
                <ScrollView contentContainerStyle={styles.lyricsScrollContent} showsVerticalScrollIndicator={false}>
                  {parsedLyrics.length > 0 ? (
                    parsedLyrics.map((line, idx) => {
                      const isActive = idx === activeLyricIndex;
                      const isPassed = idx < activeLyricIndex;
                      return (
                        <TouchableOpacity
                          key={idx}
                          onPress={() => seekTo(line.time || 0)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.lyricLine,
                              isActive && styles.lyricLineActive,
                              isPassed && styles.lyricLinePassed,
                            ]}
                          >
                            {line.text}
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={styles.emptyLyricsText}>No synchronized lyrics found for this song</Text>
                  )}
                </ScrollView>
              </View>
            )}

            {/* 3. SURAH MUSHAF PAGE (QURAN) */}
            {centerMode === 'mushaf' && (
              <View style={styles.mushafCard}>
                <View style={styles.mushafHeader}>
                  <Text style={styles.mushafSurahName}>
                    {getSurahName(currentTrack) || 'سُورَةُ المُلْك'}
                  </Text>
                  <Text style={styles.mushafJuzPill}>جُزْء ٢٩</Text>
                </View>

                <ScrollView style={styles.mushafScroll} showsVerticalScrollIndicator={false}>
                  <Text style={styles.mushafTextContainer}>
                    {SAMPLE_MUSHAF_AYAT.map((ayah, idx) => {
                      const isActive = idx === activeAyahIndex;
                      return (
                        <Text
                          key={ayah.id}
                          style={[styles.mushafAyah, isActive && styles.mushafAyahActive]}
                          onPress={() => seekTo(ayah.startSec)}
                        >
                          {ayah.text} <Text style={styles.ayahMarker}>﴿{ayah.num}﴾</Text>{' '}
                        </Text>
                      );
                    })}
                  </Text>
                </ScrollView>

                <View style={styles.mushafFooter}>
                  <TouchableOpacity
                    style={styles.pageBtn}
                    onPress={() => setMushafPage((p) => Math.max(1, p - 1))}
                    activeOpacity={0.7}
                  >
                    <ChevronLeft size={16} color={colors.gold || '#dfb15b'} />
                    <Text style={styles.pageBtnText}>P. {mushafPage - 1}</Text>
                  </TouchableOpacity>

                  <Text style={styles.pageNumberText}>PAGE {mushafPage} / 604</Text>

                  <TouchableOpacity
                    style={styles.pageBtn}
                    onPress={() => setMushafPage((p) => Math.min(604, p + 1))}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.pageBtnText}>P. {mushafPage + 1}</Text>
                    <ChevronRight size={16} color={colors.gold || '#dfb15b'} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* 4. UP NEXT QUEUE */}
            {centerMode === 'queue' && (
              <View style={styles.queueViewCard}>
                <View style={styles.queueHeader}>
                  <Text style={[styles.queueTitleText, isQuran && { color: colors.gold || '#dfb15b' }]}>
                    UP NEXT QUEUE
                  </Text>
                  <Text style={styles.queueCountText}>{queue.length} items</Text>
                </View>

                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  {queue.slice(0, 30).map((item, idx) => {
                    const isItemPlaying = String(item.id || item._id) === String(currentTrack?.id || currentTrack?._id);
                    return (
                      <TouchableOpacity
                        key={item.id || item._id || idx}
                        style={[
                          styles.queueItemRow,
                          isItemPlaying && (isQuran ? styles.queueRowGoldActive : styles.queueRowActive),
                        ]}
                        onPress={() => playTrack(item, queue, false, idx)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.queueIdxText, isQuran && { color: colors.gold || '#dfb15b' }]}>
                          {isItemPlaying ? '▶' : idx + 1}
                        </Text>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.queueItemTitle} numberOfLines={1}>
                            {item.title}
                          </Text>
                          <Text style={styles.queueItemArtist} numberOfLines={1}>
                            {item.artist}
                          </Text>
                        </View>
                        <Text style={styles.queueItemDur}>{formatTime(item.duration)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Bottom Glass Card: Full-Width Title & Classic 5-Button Controls */}
          <View style={styles.bottomControlsGlass}>
            {/* Full-Width Title Row (Unclipped!) */}
            <View style={styles.trackHeaderRow}>
              <View style={styles.trackTitleCol}>
                <Text style={styles.trackTitleText} numberOfLines={1}>
                  {cleanTitle}
                </Text>
                <Text style={styles.trackArtistText} numberOfLines={1}>
                  {cleanArtist}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => {
                  const fn = toggleLikeTrack || toggleLike;
                  if (currentTrack && fn) fn(currentTrack.id || currentTrack._id);
                }}
                activeOpacity={0.7}
                style={styles.heartBtn}
              >
                <Heart
                  size={22}
                  color={isLiked ? '#ff4757' : '#ffffff'}
                  fill={isLiked ? '#ff4757' : 'none'}
                  strokeWidth={2.2}
                />
              </TouchableOpacity>
            </View>

            {/* Scrub Bar */}
            <View style={styles.scrubContainer}>
              <TouchableOpacity activeOpacity={1} onPress={handleScrub} style={styles.scrubBarTrack}>
                <View
                  style={[
                    styles.scrubFill,
                    isQuran && styles.scrubFillGold,
                    { width: `${progressPercent}%` },
                  ]}
                />
              </TouchableOpacity>

              <View style={styles.scrubTimesRow}>
                <Text style={styles.scrubTimeText}>{formatTime(currentTime)}</Text>
                <Text style={styles.scrubTimeText}>{formatTime(effectiveDuration)}</Text>
              </View>
            </View>

            {/* Classic 5-Button Playback Controls: [Shuffle] [Prev] [Play] [Next] [Repeat] */}
            <View style={styles.controlsRow}>
              <TouchableOpacity style={styles.ctrlBtn} onPress={toggleShuffle} activeOpacity={0.7}>
                <Shuffle
                  size={20}
                  color={isShuffle ? (isQuran ? colors.gold || '#dfb15b' : colors.mint) : '#ffffff'}
                  strokeWidth={2.4}
                />
              </TouchableOpacity>

              <TouchableOpacity style={styles.ctrlBtn} onPress={playPrevTrack} activeOpacity={0.7}>
                <SkipBack size={26} color="#ffffff" strokeWidth={2.4} fill="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.playPauseBtn, isQuran && styles.playPauseBtnGold]}
                onPress={togglePlay}
                activeOpacity={0.88}
              >
                {isPlaying ? (
                  <Pause size={24} color="#050a09" strokeWidth={2.6} fill="#050a09" />
                ) : (
                  <Play size={24} color="#050a09" strokeWidth={2.6} fill="#050a09" style={{ marginLeft: 3 }} />
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.ctrlBtn} onPress={playNextTrack} activeOpacity={0.7}>
                <SkipForward size={26} color="#ffffff" strokeWidth={2.4} fill="#ffffff" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.ctrlBtn} onPress={toggleRepeat} activeOpacity={0.7}>
                <Repeat
                  size={20}
                  color={repeatMode !== 'off' ? (isQuran ? colors.gold || '#dfb15b' : colors.mint) : '#ffffff'}
                  strokeWidth={2.4}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030807',
  },
  ambientCoverBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    opacity: 0.45,
  },
  vignetteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 8, 7, 0.65)',
  },
  contentSafeArea: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 48 : 36,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  topBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dismissBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clockHeader: {
    alignItems: 'center',
  },
  clockTimeText: {
    fontSize: 54,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -1.5,
    includeFontPadding: false,
  },
  clockDateText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: colors.mint,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 2,
  },

  /* Floating View Mode Switcher */
  floatingModeBar: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: 'rgba(8, 22, 19, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 20,
    padding: 3,
    gap: 4,
    marginTop: 10,
    marginBottom: 8,
  },
  fPill: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 14,
  },
  fPillActive: {
    backgroundColor: '#082621',
    borderColor: colors.teal,
    borderWidth: 1,
  },
  fPillGoldActive: {
    backgroundColor: 'rgba(223, 177, 91, 0.22)',
    borderColor: '#dfb15b',
    borderWidth: 1,
  },
  fPillText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    fontWeight: '700',
    color: '#88b0a7',
    textTransform: 'uppercase',
  },
  fPillActiveText: {
    color: colors.mint,
  },
  fPillGoldActiveText: {
    color: '#dfb15b',
  },

  /* Center Viewport */
  centerViewport: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    minHeight: 250,
  },
  artworkWrapper: {
    width: SCREEN_WIDTH * 0.62,
    height: SCREEN_WIDTH * 0.62,
    borderRadius: 24,
    elevation: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 18,
    overflow: 'hidden',
  },
  artworkImage: {
    width: '100%',
    height: '100%',
  },

  /* Lyrics View */
  lyricsViewport: {
    width: '100%',
    height: 260,
  },
  lyricsScrollContent: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 14,
  },
  lyricLine: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.35)',
    textAlign: 'center',
    lineHeight: 22,
  },
  lyricLineActive: {
    fontSize: 19,
    fontWeight: '900',
    color: '#ffffff',
  },
  lyricLinePassed: {
    color: colors.teal,
    opacity: 0.6,
  },
  emptyLyricsText: {
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginTop: 80,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
  },

  /* Quran Mushaf View */
  mushafCard: {
    width: '100%',
    height: 280,
    backgroundColor: 'rgba(8, 26, 22, 0.88)',
    borderWidth: 1.5,
    borderColor: '#dfb15b',
    borderRadius: 18,
    padding: 12,
  },
  mushafHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(223, 177, 91, 0.3)',
    paddingBottom: 6,
    marginBottom: 6,
  },
  mushafSurahName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#dfb15b',
  },
  mushafJuzPill: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    color: '#dfb15b',
    backgroundColor: 'rgba(223, 177, 91, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    fontWeight: '700',
  },
  mushafScroll: {
    flex: 1,
  },
  mushafTextContainer: {
    fontSize: 16.5,
    lineHeight: 28,
    textAlign: 'justify',
    color: '#f1f8f6',
    direction: 'rtl',
  },
  mushafAyah: {
    color: '#f1f8f6',
  },
  mushafAyahActive: {
    backgroundColor: 'rgba(223, 177, 91, 0.3)',
    color: '#ffffff',
  },
  ayahMarker: {
    color: '#dfb15b',
    fontWeight: '700',
  },
  mushafFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(223, 177, 91, 0.3)',
    paddingTop: 6,
    marginTop: 4,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(223, 177, 91, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  pageBtnText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    color: '#dfb15b',
    fontWeight: '700',
  },
  pageNumberText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    color: '#dfb15b',
    fontWeight: '700',
  },

  /* Queue View */
  queueViewCard: {
    width: '100%',
    height: 270,
    backgroundColor: 'rgba(7, 20, 18, 0.92)',
    borderWidth: 1.5,
    borderColor: 'rgba(38, 196, 183, 0.35)',
    borderRadius: 18,
    padding: 12,
  },
  queueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 6,
    marginBottom: 6,
  },
  queueTitleText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    fontWeight: '900',
    color: colors.mint,
    letterSpacing: 1,
  },
  queueCountText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    color: '#88b0a7',
  },
  queueItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    marginBottom: 4,
    gap: 8,
  },
  queueRowActive: {
    backgroundColor: 'rgba(38, 196, 183, 0.2)',
    borderColor: colors.teal,
    borderWidth: 1,
  },
  queueRowGoldActive: {
    backgroundColor: 'rgba(223, 177, 91, 0.2)',
    borderColor: '#dfb15b',
    borderWidth: 1,
  },
  queueIdxText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    fontWeight: '700',
    color: colors.mint,
    width: 18,
    textAlign: 'center',
  },
  queueItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
  },
  queueItemArtist: {
    fontSize: 11,
    color: '#88b0a7',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 1,
  },
  queueItemDur: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10.5,
    color: '#88b0a7',
  },

  /* Bottom Controls Glass */
  bottomControlsGlass: {
    backgroundColor: 'rgba(10, 24, 21, 0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 24,
    padding: 16,
    gap: 12,
  },
  trackHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  trackTitleCol: {
    flex: 1,
    marginRight: 10,
  },
  trackTitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.3,
  },
  trackArtistText: {
    fontSize: 12.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#88b0a7',
    marginTop: 2,
  },
  heartBtn: {
    padding: 6,
  },

  /* Scrub Bar */
  scrubContainer: {
    gap: 4,
  },
  scrubBarTrack: {
    height: 4,
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 2,
    justifyContent: 'center',
  },
  scrubFill: {
    height: '100%',
    backgroundColor: colors.mint,
    borderRadius: 2,
  },
  scrubFillGold: {
    backgroundColor: '#dfb15b',
  },
  scrubTimesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scrubTimeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 10,
    color: '#88b0a7',
  },

  /* Classic 5-Button Controls: [Shuffle] [Prev] [Play] [Next] [Repeat] */
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  ctrlBtn: {
    padding: 8,
  },
  playPauseBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: colors.mint,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  playPauseBtnGold: {
    backgroundColor: '#dfb15b',
    shadowColor: '#dfb15b',
  },
});
