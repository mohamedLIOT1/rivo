import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  Image,
  Alert,
  Clipboard,
  useWindowDimensions,
  Animated,
  PanResponder,
  Platform,
} from 'react-native';
import {
  X,
  Radio,
  Users,
  Copy,
  Check,
  Headphones,
  Music,
  Plus,
  Trash2,
  Crown,
  UserMinus,
  Search,
  Shuffle,
  Sparkles,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Lock,
  GripVertical,
  BookOpen,
} from 'lucide-react-native';
import { isQuranContent } from '../../utils/quranUtils';
import { useSocket } from '../context/SocketContext';
import { useUser } from '../context/UserContext';
import { useAudioPlayer, useAudioProgress } from '../context/AudioContext';
import { useToast } from '../context/ToastContext';
import { useLocalization } from '../context/LocalizationContext';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';
import { formatTime, sanitizeDuration } from '../utils/timeUtils';
import UserDetailModal from './UserDetailModal';

const JAM_ROW_HEIGHT = 68;

function DraggableJamQueue({
  queue,
  isCurrentUserHost,
  jamSession,
  playTrack,
  showToast,
  handleReorder,
  removeFromJamQueue,
  styles,
  t,
  isRTL,
  rtlTextStyle,
  isDark = true,
}) {
  const [draggingIdx, setDraggingIdx] = useState(null);
  const [hoverIdx, setHoverIdx] = useState(null);
  const draggingIdxRef = useRef(null);
  const hoverIdxRef = useRef(null);
  const panY = useRef(new Animated.Value(0)).current;

  draggingIdxRef.current = draggingIdx;
  hoverIdxRef.current = hoverIdx;

  const createPanResponder = (index) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 3,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => Math.abs(gestureState.dy) > 3,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        setDraggingIdx(index);
        setHoverIdx(index);
        panY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        panY.setValue(gestureState.dy);
        const deltaSlots = Math.round(gestureState.dy / JAM_ROW_HEIGHT);
        const nextHover = Math.max(0, Math.min(queue.length - 1, index + deltaSlots));
        if (hoverIdxRef.current !== nextHover) {
          setHoverIdx(nextHover);
        }
      },
      onPanResponderRelease: () => {
        const from = index;
        const to = hoverIdxRef.current;
        if (to !== null && to !== from && handleReorder) {
          handleReorder(from, to);
        }
        setDraggingIdx(null);
        setHoverIdx(null);
        panY.setValue(0);
      },
      onPanResponderTerminate: () => {
        setDraggingIdx(null);
        setHoverIdx(null);
        panY.setValue(0);
      },
    });
  };

  const panResponders = useMemo(() => {
    return queue.map((_, i) => createPanResponder(i));
  }, [queue.length, handleReorder]);

  return (
    <View style={styles.queueList}>
      {queue.map((qTrack, idx) => {
        const qId = qTrack._id || qTrack.id || idx;
        const isDragging = draggingIdx === idx;
        const isTargetHover = draggingIdx !== null && hoverIdx === idx && !isDragging;

        return (
          <Animated.View
            key={`${qId}-${idx}`}
            style={[
              styles.queueItem,
              !isDark && styles.queueItemLight,
              isDragging && {
                transform: [{ translateY: panY }, { scale: 1.03 }],
                zIndex: 9999,
                elevation: Platform.OS === 'android' ? 0 : 12,
                borderColor: '#17a398',
                backgroundColor: isDark ? '#1a2e29' : '#e0f2f1',
                shadowColor: '#17a398',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.4,
                shadowRadius: 8,
              },
              isTargetHover && {
                borderTopWidth: hoverIdx < draggingIdx ? 3.5 : 1,
                borderBottomWidth: hoverIdx > draggingIdx ? 3.5 : 1,
                borderColor: '#17a398',
                backgroundColor: 'rgba(23, 163, 152, 0.15)',
              }
            ]}
          >
            <TouchableOpacity
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0, marginHorizontal: 6 }}
              onPress={() => {
                const canControl = isCurrentUserHost || !jamSession?.hostOnlyControl;
                if (canControl) {
                  playTrack(qTrack);
                  showToast(t ? t('jam.playingInJam', { title: qTrack.title }) : `Playing "${qTrack.title}"`, 'info');
                }
              }}
              activeOpacity={0.7}
              disabled={isDragging}
            >
              <Text style={[styles.queueIndex, !isDark && styles.queueIndexLight]}>{idx + 1}</Text>
              <Image
                source={{
                  uri:
                    qTrack.cover ||
                    'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100',
                }}
                style={[styles.queueCover, !isDark && styles.queueCoverLight]}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.queueTrackTitle, !isDark && styles.queueTrackTitleLight, rtlTextStyle]} numberOfLines={1}>
                  {qTrack.title}
                </Text>
                <Text style={[styles.queueTrackArtist, !isDark && styles.queueTrackArtistLight, rtlTextStyle]} numberOfLines={1}>
                  {qTrack.artist}
                </Text>
              </View>
            </TouchableOpacity>

            <View style={styles.queueActionsRow}>
              <TouchableOpacity
                onPress={() => removeFromJamQueue(idx, qId)}
                style={styles.removeQueueBtn}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Trash2 size={13} color="#ef4444" />
              </TouchableOpacity>

              {queue.length > 1 && (
                <View
                  {...(panResponders[idx] ? panResponders[idx].panHandlers : {})}
                  style={[
                    styles.dragHandle,
                    !isDark && styles.dragHandleLight,
                    isDragging && { backgroundColor: 'rgba(23, 163, 152, 0.3)' }
                  ]}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <GripVertical size={16} color={isDragging ? '#17a398' : (!isDark ? '#57534e' : '#94a3b8')} />
                </View>
              )}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

export default function JamRoomModal({ visible, onClose }) {
  const {
    socket,
    jamSession,
    isCurrentUserHost: socketIsHost,
    createJam,
    joinJam,
    leaveJam,
    addToJamQueue,
    removeFromJamQueue,
    reorderJamQueue,
    transferJamHost,
    kickJamMember,
    syncJamPlayState,
  } = useSocket();

  const { currentUser, tracks = [] } = useUser();
  const {
    currentTrack,
    isPlaying,
    playTrack,
    syncRemotePlayState,
    likedTrackIds = [],
    togglePlay,
    seekTo,
    playNextTrack,
    playPrevTrack,
  } = useAudioPlayer();
  const progress = useAudioProgress();
  const { showToast } = useToast();
  const { t, isRTL } = useLocalization();
  const { isDark = true } = useTheme();

  const rtlTextStyle = useMemo(() => (
    isRTL ? {
      letterSpacing: 0,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    } : null
  ), [isRTL]);

  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [justAddedId, setJustAddedId] = useState(null);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [progressBarWidth, setProgressBarWidth] = useState(0);
  const [jamContentFilter, setJamContentFilter] = useState('songs'); // 'songs' | 'quran'
  const [stableRecommendations, setStableRecommendations] = useState([]);

  const { width, height } = useWindowDimensions();
  const isLandscape = (width > height && width >= 480) || width >= 650;

  const handleCopyCode = () => {
    const code = jamSession?.code || jamSession?.roomCode;
    if (code) {
      try {
        Clipboard.setString(code);
      } catch {}
      setCopied(true);
      showToast(t('jam.codeCopiedToast'), 'success');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleTuneIn = () => {
    const roomCode = jamSession?.code || jamSession?.roomCode;
    if (socket && roomCode) {
      socket.emit('jam:request_sync', { roomCode });
    }
    if (jamSession?.currentTrack) {
      const liveTime = Number(jamSession.currentTime) || 0;
      if (syncRemotePlayState) {
        syncRemotePlayState({
          isPlaying: jamSession.isPlaying,
          currentTrack: jamSession.currentTrack,
          currentTime: liveTime,
          updatedAt: Date.now(),
        });
      } else {
        playTrack(jamSession.currentTrack, null, false, liveTime);
      }
      showToast(t('jam.audioResynced'), 'info');
    } else if (currentTrack) {
      playTrack(currentTrack);
      showToast(t('jam.broadcastingTrack'), 'info');
    }
  };

  const handleCreateJam = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const code = `JAM-${randomNum}`;
    if (typeof createJam === 'function') { createJam(code, currentTrack, isPlaying, progress?.currentTime || 0); } else { joinJam(code, currentTrack, isPlaying, progress?.currentTime || 0); }
    showToast(t('jam.createdRoom', { code }), 'success');
  };

  const handleJoin = () => {
    if (!inputCode.trim()) return;
    const cleanCode = inputCode.trim().toUpperCase();
    joinJam(cleanCode);
    setInputCode('');
    showToast(t('jam.joiningRoom', { code: cleanCode }), 'info');
  };

  const handleAddTrack = (track) => {
    if (!track) return;
    addToJamQueue(track);
    const tId = track._id || track.id;
    setJustAddedId(tId);
    showToast(t('jam.addedToQueue', { title: track.title }), 'success');
    setTimeout(() => setJustAddedId(null), 1500);
  };

  const handleReorder = (fromIdx, toIdx) => {
    if (fromIdx < 0 || toIdx < 0) return;
    if (fromIdx >= (jamSession?.queue?.length || 0)) return;
    if (toIdx >= (jamSession?.queue?.length || 0)) return;
    reorderJamQueue(fromIdx, toIdx);
  };

  // Stable recommendations: populated when drawer opens, filter switches, or user taps SHUFFLE
  useEffect(() => {
    if (!isSearchOpen || !Array.isArray(tracks) || tracks.length === 0) return;

    // Filter by content type first (Songs vs Quran)
    const contentPool = tracks.filter((t) => {
      const isQ = isQuranContent(t);
      return jamContentFilter === 'quran' ? isQ : !isQ;
    });

    const liked = contentPool.filter((t) =>
      likedTrackIds.some((id) => String(id) === String(t._id || t.id))
    );
    const others = contentPool.filter((t) =>
      !likedTrackIds.some((id) => String(id) === String(t._id || t.id))
    );

    const shuffledOthers = [...others].sort(() => 0.5 - Math.random());
    const mixed = [...liked, ...shuffledOthers];
    setStableRecommendations(mixed.slice(0, 24));
  }, [isSearchOpen, jamContentFilter, shuffleSeed, tracks.length]);

  const filteredTracks = useMemo(() => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return (tracks || [])
        .filter((t) => {
          const isQ = isQuranContent(t);
          const matchesFilter = jamContentFilter === 'quran' ? isQ : !isQ;
          if (!matchesFilter) return false;
          return (
            (t?.title && t.title.toLowerCase().includes(q)) ||
            (t?.artist && t.artist.toLowerCase().includes(q))
          );
        })
        .slice(0, 25);
    }
    return stableRecommendations;
  }, [searchQuery, jamContentFilter, stableRecommendations, tracks]);

  const myId = String(currentUser?._id || currentUser?.id || '');
  const isCurrentUserHost = Boolean(
    socketIsHost ||
    (jamSession &&
      ((jamSession.hostUserId && myId && String(jamSession.hostUserId) === myId) ||
        (jamSession.hostId && socket?.id && jamSession.hostId === socket.id) ||
        (jamSession.members || []).some(m => (m.socketId === socket?.id || (myId && String(m.id || m._id) === myId)) && m.isHost) ||
        (jamSession.members?.length === 1 && jamSession.members[0]?.isHost)))
  );
  const canControl = isCurrentUserHost || !jamSession?.hostOnlyControl;

  const renderBanner = () => (
    <View style={[styles.codeCard, !isDark && styles.codeCardLight]}>
      <Text style={[styles.codeSubtitle, !isDark && styles.codeSubtitleLight, rtlTextStyle]}>{t('jam.activeCode')}</Text>
      <Text style={[styles.codeText, !isDark && styles.codeTextLight]}>{jamSession.code || jamSession.roomCode || 'LIVE'}</Text>
      <Text style={[styles.codeDesc, !isDark && styles.codeDescLight, rtlTextStyle]}>
        {t('jam.shareCodeDesc')}
      </Text>

      <View style={styles.codeBtnRow}>
        <TouchableOpacity
          style={[styles.copyBtn, !isDark && styles.copyBtnLight]}
          onPress={handleCopyCode}
          activeOpacity={0.8}
        >
          {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} color={!isDark ? '#082621' : '#ffffff'} />}
          <Text style={[styles.copyBtnText, !isDark && styles.copyBtnTextLight, rtlTextStyle]}>{copied ? t('jam.copied') : t('jam.copyCode')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.syncBtn}
          onPress={handleTuneIn}
          activeOpacity={0.8}
        >
          <Headphones size={14} color="#082621" />
          <Text style={[styles.syncBtnText, rtlTextStyle]}>{t('jam.syncAudio')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderControlModeBanner = () => {
    const isHostOnly = Boolean(jamSession?.hostOnlyControl);
    const roomCode = jamSession?.code || jamSession?.roomCode;

    return (
      <View style={[styles.controlModeBanner, !isDark && styles.controlModeBannerLight]}>
        <View style={{ flex: 1, minWidth: 0, marginHorizontal: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Radio size={13} color={isHostOnly ? '#f59e0b' : (isDark ? colors.mint : '#0f756d')} />
            <Text style={[
              styles.controlModeTitle,
              !isDark && styles.controlModeTitleLight,
              isHostOnly && { color: isDark ? '#f59e0b' : '#b45309' },
              rtlTextStyle
            ]}>
              {isHostOnly ? t('jam.hostLockedTitle') : t('jam.collabControlTitle')}
            </Text>
          </View>
          <Text style={[styles.controlModeDesc, !isDark && styles.controlModeDescLight, rtlTextStyle]}>
            {isHostOnly
              ? t('jam.hostLockedDesc')
              : t('jam.collabControlDesc')}
          </Text>
        </View>

        {isCurrentUserHost && (
          <TouchableOpacity
            style={[styles.toggleControlBtn, isHostOnly ? styles.toggleControlBtnActive : null]}
            onPress={() => {
              const nextMode = !isHostOnly;
              if (socket && roomCode) {
                socket.emit('jam:set_control_mode', { roomCode, hostOnlyControl: nextMode });
              }
            }}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleControlBtnText, isHostOnly && { color: '#000000' }, rtlTextStyle]}>
              {isHostOnly ? t('jam.unlockForAll') : t('jam.lockToHost')}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderCurrentTrack = () => {
    const activeTrack = jamSession?.currentTrack || currentTrack;
    const isRoomPlaying = isCurrentUserHost
      ? isPlaying
      : (jamSession?.isPlaying !== undefined ? Boolean(jamSession.isPlaying) : isPlaying);
    const curTime = (progress?.currentTime !== undefined && progress?.currentTime > 0)
      ? progress.currentTime
      : (jamSession?.currentTime || progress?.currentTime || 0);
    const durTime = progress?.duration || sanitizeDuration(activeTrack?.duration, 240);
    const progressPercent = durTime > 0 ? Math.min(100, Math.max(0, (curTime / durTime) * 100)) : 0;

    const handleTogglePlay = () => {
      if (!canControl) return;
      const nextPlaying = !isRoomPlaying;
      togglePlay();
      if (syncJamPlayState) {
        syncJamPlayState(nextPlaying, activeTrack, curTime);
      }
    };

    return activeTrack ? (
      <View style={[styles.syncedTrackCard, !isDark && styles.syncedTrackCardLight]}>
        <View style={styles.syncedTrackTopRow}>
          <Image
            source={{
              uri:
                activeTrack.coverUrl ||
                activeTrack.cover ||
                'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200',
            }}
            style={[styles.syncedTrackCover, !isDark && styles.syncedTrackCoverLight]}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.syncStatusRow}>
              <Text style={[styles.syncStatusText, !isDark && styles.syncStatusTextLight, rtlTextStyle]}>
                {isRoomPlaying ? t('jam.playingInSync') : t('jam.playbackPaused')}
              </Text>
              <View
                style={[
                  styles.statusPulseDot,
                  { backgroundColor: isRoomPlaying ? (isDark ? colors.mint : '#0f756d') : '#f59e0b' },
                ]}
              />
            </View>
            <Text style={[styles.syncedTrackTitle, !isDark && styles.syncedTrackTitleLight, rtlTextStyle]} numberOfLines={1}>
              {activeTrack.title}
            </Text>
            <Text style={[styles.syncedTrackArtist, !isDark && styles.syncedTrackArtistLight, rtlTextStyle]} numberOfLines={1}>
              {activeTrack.artist}
            </Text>
          </View>
        </View>

        {/* Progress Scrubber */}
        <View
          style={styles.playerProgressContainer}
          onLayout={(e) => setProgressBarWidth(e.nativeEvent.layout.width)}
        >
          <TouchableOpacity
            activeOpacity={1}
            disabled={!canControl}
            onPress={(e) => {
              if (!canControl || durTime <= 0 || progressBarWidth <= 0) return;
              const locX = e?.nativeEvent?.locationX ?? 0;
              const ratio = Math.max(0, Math.min(1, locX / progressBarWidth));
              const targetSec = Math.round(ratio * durTime);
              seekTo(targetSec);
            }}
            style={[styles.progressBarBg, !isDark && styles.progressBarBgLight]}
          >
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </TouchableOpacity>
          <View style={styles.progressTimeRow}>
            <Text style={[styles.progressTimeText, !isDark && styles.progressTimeTextLight]}>{formatTime(curTime)}</Text>
            <Text style={[styles.progressTimeText, !isDark && styles.progressTimeTextLight]}>{formatTime(durTime)}</Text>
          </View>
        </View>

        {/* Transport Controls (Skip Prev, Play/Pause, Skip Next) */}
        <View style={styles.playerControlsRow}>
          <TouchableOpacity
            style={[styles.playerControlBtn, !isDark && styles.playerControlBtnLight, !canControl && { opacity: 0.35 }]}
            disabled={!canControl}
            onPress={playPrevTrack}
            activeOpacity={0.7}
          >
            <SkipBack size={18} color={!isDark ? '#082621' : '#ffffff'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.playerPlayPauseBtn, !isDark && styles.playerPlayPauseBtnLight, !canControl && { opacity: 0.35 }]}
            disabled={!canControl}
            onPress={handleTogglePlay}
            activeOpacity={0.8}
          >
            {isRoomPlaying ? (
              <Pause size={20} color="#082621" />
            ) : (
              <Play size={20} color="#082621" style={{ marginLeft: 2 }} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.playerControlBtn, !isDark && styles.playerControlBtnLight, !canControl && { opacity: 0.35 }]}
            disabled={!canControl}
            onPress={playNextTrack}
            activeOpacity={0.7}
          >
            <SkipForward size={18} color={!isDark ? '#082621' : '#ffffff'} />
          </TouchableOpacity>
        </View>

        {!canControl && (
          <View style={styles.hostLockedNotice}>
            <Lock size={11} color={!isDark ? '#b45309' : '#f59e0b'} />
            <Text style={[styles.hostLockedNoticeText, !isDark && styles.hostLockedNoticeTextLight, rtlTextStyle]}>{t('jam.hostLockedNotice')}</Text>
          </View>
        )}
      </View>
    ) : null;
  };

  const renderMembers = () => (
    <View style={[styles.membersCard, !isDark && styles.membersCardLight]}>
      <View style={styles.membersHeader}>
        <Users size={14} color={isDark ? colors.mint : '#0f756d'} />
        <Text style={[styles.membersTitle, !isDark && styles.membersTitleLight, rtlTextStyle]}>
          {t('jam.listenersInRoom', { count: jamSession.members?.length || 1 })}
        </Text>
      </View>

      <View style={styles.membersList}>
        {(jamSession.members || []).map((m) => {
          const mId = m.id || m._id || m.socketId;
          return (
            <View key={mId} style={[styles.memberItem, !isDark && styles.memberItemLight]}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                onPress={() => setSelectedUser(m)}
                activeOpacity={0.7}
              >
                <Image
                  source={{
                    uri:
                      m.avatar ||
                      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
                  }}
                  style={[styles.memberAvatar, !isDark && styles.memberAvatarLight]}
                />
                <Text style={[styles.memberName, !isDark && styles.memberNameLight, rtlTextStyle]} numberOfLines={1}>
                  {m.name || t('profile.listener')}
                </Text>
              </TouchableOpacity>

              <View style={styles.memberRight}>
                {m.isHost && (
                  <View style={styles.hostBadge}>
                    <Crown size={10} color="#082621" strokeWidth={3} />
                    <Text style={[styles.hostBadgeText, rtlTextStyle]}>{t('jam.host')}</Text>
                  </View>
                )}

                {isCurrentUserHost && !m.isHost && (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={styles.makeHostBtn}
                      onPress={() => {
                        Alert.alert(
                          t('jam.transferHost'),
                          t('jam.transferHostPrompt', { name: m.name }),
                          [
                            { text: t('jam.cancel'), style: 'cancel' },
                            {
                              text: t('jam.makeHost'),
                              onPress: () => transferJamHost(m),
                            },
                          ]
                        );
                      }}
                    >
                      <Crown size={10} color="#082621" />
                      <Text style={[styles.makeHostText, rtlTextStyle]}>{t('jam.makeHost')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.kickBtn}
                      onPress={() => {
                        Alert.alert(
                          t('jam.disconnectListener'),
                          t('jam.disconnectPrompt', { name: m.name }),
                          [
                            { text: t('jam.cancel'), style: 'cancel' },
                            {
                              text: t('jam.disconnect'),
                              style: 'destructive',
                              onPress: () => kickJamMember(m),
                            },
                          ]
                        );
                      }}
                    >
                      <UserMinus size={12} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );

  const renderLeaveBtn = () => (
    <TouchableOpacity style={[styles.leaveBtn, !isDark && styles.leaveBtnLight]} onPress={leaveJam} activeOpacity={0.8}>
      <Text style={[styles.leaveBtnText, !isDark && styles.leaveBtnTextLight, rtlTextStyle]}>{t('jam.leaveJam')}</Text>
    </TouchableOpacity>
  );

  const renderQueue = () => (
    <View style={[styles.queueCard, !isDark && styles.queueCardLight]}>
      <View style={[styles.queueHeader, !isDark && styles.queueHeaderLight]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Music size={15} color={isDark ? colors.mint : '#0f756d'} />
          <Text style={[styles.queueTitle, !isDark && styles.queueTitleLight, rtlTextStyle]}>
            {t('jam.jamQueue', { count: jamSession.queue?.length || 0 })}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addSongToggleBtn, !isDark && styles.addSongToggleBtnLight]}
          onPress={() => setIsSearchOpen((p) => !p)}
          activeOpacity={0.8}
        >
          <Plus size={13} color="#082621" />
          <Text style={[styles.addSongToggleText, rtlTextStyle]}>
            {isSearchOpen ? t('jam.closeAddSong') : t('jam.addSong')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Add Song Drawer */}
      {isSearchOpen && (
        <View style={[styles.searchDrawer, !isDark && styles.searchDrawerLight]}>
          {/* Content Type Filter: Songs vs Quran */}
          <View style={styles.filterTabRow}>
            <TouchableOpacity
              style={[
                styles.filterTabBtn,
                !isDark && styles.filterTabBtnLight,
                jamContentFilter === 'songs' && styles.filterTabBtnActive,
                !isDark && jamContentFilter === 'songs' && styles.filterTabBtnActiveLight,
              ]}
              onPress={() => setJamContentFilter('songs')}
              activeOpacity={0.8}
            >
              <Music size={12} color={jamContentFilter === 'songs' ? '#082621' : (!isDark ? '#57534e' : '#9ca3af')} />
              <Text
                style={[
                  styles.filterTabText,
                  !isDark && styles.filterTabTextLight,
                  jamContentFilter === 'songs' && styles.filterTabTextActive,
                  rtlTextStyle,
                ]}
              >
                {t('jam.songsTab')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.filterTabBtn,
                !isDark && styles.filterTabBtnLight,
                jamContentFilter === 'quran' && styles.filterTabBtnActive,
                !isDark && jamContentFilter === 'quran' && styles.filterTabBtnActiveLight,
              ]}
              onPress={() => setJamContentFilter('quran')}
              activeOpacity={0.8}
            >
              <BookOpen size={12} color={jamContentFilter === 'quran' ? '#082621' : (!isDark ? '#57534e' : '#9ca3af')} />
              <Text
                style={[
                  styles.filterTabText,
                  !isDark && styles.filterTabTextLight,
                  jamContentFilter === 'quran' && styles.filterTabTextActive,
                  rtlTextStyle,
                ]}
              >
                {t('jam.quranTab')}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.searchBox, !isDark && styles.searchBoxLight]}>
            <Search size={14} color={!isDark ? '#57534e' : '#9ca3af'} />
            <TextInput
              style={[styles.searchInput, !isDark && styles.searchInputLight, rtlTextStyle]}
              placeholder={jamContentFilter === 'quran' ? t('jam.searchQuranPlaceholder') : t('jam.searchSongsPlaceholder')}
              placeholderTextColor={!isDark ? '#71717a' : '#6b7280'}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={13} color={!isDark ? '#082621' : '#9ca3af'} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.recsHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Sparkles size={11} color={isDark ? colors.mint : '#0f756d'} />
              <Text style={[styles.recsHeaderTitle, !isDark && styles.recsHeaderTitleLight, rtlTextStyle]}>
                {searchQuery.trim()
                  ? t('jam.resultsCount', { count: filteredTracks.length })
                  : (jamContentFilter === 'quran' ? t('jam.quranRecitations') : t('jam.discoveries'))}
              </Text>
            </View>
            {!searchQuery.trim() && (
              <TouchableOpacity
                style={[styles.recsShuffleBtn, !isDark && styles.recsShuffleBtnLight]}
                onPress={() => setShuffleSeed((s) => s + 1)}
                activeOpacity={0.8}
              >
                <Shuffle size={11} color={!isDark ? '#0f756d' : '#17a398'} />
                <Text style={[styles.recsShuffleBtnText, !isDark && styles.recsShuffleBtnTextLight, rtlTextStyle]}>{t('jam.shuffle')}</Text>
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            nestedScrollEnabled={true}
            style={styles.searchResultsList}
            contentContainerStyle={{ gap: 6, paddingBottom: 6 }}
            showsVerticalScrollIndicator={true}
            data={filteredTracks}
            keyExtractor={(track) => String(track._id || track.id)}
            windowSize={3}
            maxToRenderPerBatch={8}
            initialNumToRender={8}
            removeClippedSubviews={true}
            renderItem={({ item: track }) => {
              const tId = track._id || track.id;
              const isQueued = justAddedId === tId;
              return (
                <View key={tId} style={[styles.searchResultItem, !isDark && styles.searchResultItemLight]}>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0, marginHorizontal: 8 }}
                    activeOpacity={0.7}
                    onPress={() => {
                      const canControl = isCurrentUserHost || !jamSession?.hostOnlyControl;
                      if (canControl) {
                        playTrack(track);
                        showToast(t('jam.playingInJam', { title: track.title }), 'info');
                      } else {
                        handleAddTrack(track);
                      }
                    }}
                  >
                    <Image
                      source={{
                        uri:
                          track.cover ||
                          'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100',
                      }}
                      style={[styles.resultCover, !isDark && styles.resultCoverLight]}
                    />
                    <View style={{ flex: 1, minWidth: 0, marginHorizontal: 8 }}>
                      <Text style={[styles.resultTitle, !isDark && styles.resultTitleLight, rtlTextStyle]} numberOfLines={1}>
                        {track.title}
                      </Text>
                      <Text style={[styles.resultArtist, !isDark && styles.resultArtistLight, rtlTextStyle]} numberOfLines={1}>
                        {track.artist}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.queueAddBtn,
                      !isDark && styles.queueAddBtnLight,
                      isQueued && { backgroundColor: colors.mint },
                    ]}
                    onPress={() => handleAddTrack(track)}
                    activeOpacity={0.8}
                  >
                    {isQueued ? (
                      <Check size={11} color="#082621" />
                    ) : (
                      <Plus size={11} color="#082621" />
                    )}
                    <Text style={[styles.queueAddBtnText, rtlTextStyle]}>
                      {isQueued ? t('jam.queued') : t('jam.queueBtn')}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            }}
          />
        </View>
      )}

      {/* Shared Queue List Items */}
      {Array.isArray(jamSession.queue) && jamSession.queue.length > 0 ? (
        <DraggableJamQueue
          queue={jamSession.queue}
          isCurrentUserHost={isCurrentUserHost}
          jamSession={jamSession}
          playTrack={playTrack}
          showToast={showToast}
          handleReorder={handleReorder}
          removeFromJamQueue={removeFromJamQueue}
          styles={styles}
          t={t}
          isRTL={isRTL}
          rtlTextStyle={rtlTextStyle}
          isDark={isDark}
        />
      ) : (
        <Text style={[styles.emptyQueueText, !isDark && styles.emptyQueueTextLight, rtlTextStyle]}>{t('jam.queueEmpty')}</Text>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType={Platform.OS === 'android' ? 'none' : 'slide'} transparent onRequestClose={onClose}>
      <View style={[styles.overlay, isLandscape && { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={[styles.sheetOuter, isLandscape && { width: '94%', maxWidth: 960, height: '94%', maxHeight: '94%' }]}>
          <View style={[styles.hardShadow, !isDark && styles.hardShadowLight]} />
          <View style={[styles.sheet, !isDark && styles.sheetLight]}>
            {/* Header */}
            <View style={[styles.header, !isDark && styles.headerLight]}>
              <View style={styles.headerLeft}>
                <View style={styles.iconBox}>
                  <Radio size={18} color="#082621" />
                </View>
                <View>
                  <View style={styles.titleRow}>
                    <Text style={[styles.title, !isDark && styles.titleLight, rtlTextStyle]}>{t('jam.title')}</Text>
                    {jamSession && <View style={styles.liveDot} />}
                  </View>
                  <Text style={[styles.subTitle, !isDark && styles.subTitleLight, rtlTextStyle]}>{t('jam.subtitle')}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={[styles.closeBtn, !isDark && styles.closeBtnLight]} activeOpacity={0.8}>
                <X size={18} color={!isDark ? '#082621' : '#ffffff'} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {jamSession ? (
                /* ── Active Jam Room View ── */
                isLandscape ? (
                  <View style={styles.landscapeGrid}>
                    <View style={styles.landscapeCol}>
                      {renderBanner()}
                      {renderControlModeBanner()}
                      {renderCurrentTrack()}
                      {renderMembers()}
                      {renderLeaveBtn()}
                    </View>
                    <View style={styles.landscapeCol}>
                      {renderQueue()}
                    </View>
                  </View>
                ) : (
                  <View style={styles.activeContainer}>
                    {renderBanner()}
                    {renderControlModeBanner()}
                    {renderCurrentTrack()}
                    {renderQueue()}
                    {renderMembers()}
                    {renderLeaveBtn()}
                  </View>
                )
              ) : (
                /* ── Inactive View: Host or Join ── */
                <View style={styles.inactiveContainer}>
                  {/* Host Card */}
                  <View style={[styles.actionCard, !isDark && styles.actionCardLight]}>
                    <Text style={[styles.actionCardTitle, !isDark && styles.actionCardTitleLight, rtlTextStyle]}>{t('jam.hostJam')}</Text>
                    <Text style={[styles.actionCardDesc, !isDark && styles.actionCardDescLight, rtlTextStyle]}>
                      {t('jam.hostJamDesc')}
                    </Text>
                    <TouchableOpacity
                      style={styles.createJamBtn}
                      onPress={handleCreateJam}
                      activeOpacity={0.8}
                    >
                      <Radio size={16} color="#082621" />
                      <Text style={[styles.createJamBtnText, rtlTextStyle]}>{t('jam.createJamBtn')}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Join Card */}
                  <View style={[styles.actionCard, !isDark && styles.actionCardLight]}>
                    <Text style={[styles.actionCardTitle, !isDark && styles.actionCardTitleLight, rtlTextStyle]}>{t('jam.joinJam')}</Text>
                    <Text style={[styles.actionCardDesc, !isDark && styles.actionCardDescLight, rtlTextStyle]}>
                      {t('jam.joinJamDesc')}
                    </Text>

                    <View style={styles.joinInputRow}>
                      <TextInput
                        style={[styles.joinInput, !isDark && styles.joinInputLight, rtlTextStyle]}
                        placeholder={t('jam.joinInputPlaceholder')}
                        placeholderTextColor={!isDark ? '#71717a' : '#6b7280'}
                        value={inputCode}
                        onChangeText={(tVal) => setInputCode(tVal.toUpperCase())}
                        autoCapitalize="characters"
                        autoCorrect={false}
                      />
                      <TouchableOpacity
                        style={[styles.joinSubmitBtn, !inputCode.trim() && { opacity: 0.5 }]}
                        onPress={handleJoin}
                        disabled={!inputCode.trim()}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.joinSubmitBtnText, rtlTextStyle]}>{t('jam.joinBtn')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </View>

      <UserDetailModal
        visible={Boolean(selectedUser)}
        user={selectedUser}
        userId={selectedUser?.id || selectedUser?._id}
        onClose={() => setSelectedUser(null)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 10,
  },
  sheetOuter: {
    position: 'relative',
    height: '88%',
    maxHeight: '88%',
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  hardShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    backgroundColor: '#000000',
    borderRadius: 16,
  },
  sheet: {
    flex: 1,
    backgroundColor: '#121212',
    borderWidth: 2,
    borderColor: '#27272a',
    borderRadius: 16,
    padding: 16,
    paddingBottom: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: '#27272a',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBox: {
    width: 32,
    height: 32,
    backgroundColor: '#17a398',
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#0b1110',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 15,
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#17a398',
  },
  subTitle: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    backgroundColor: '#27272a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3f3f46',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollArea: {
    flex: 1,
    marginTop: 10,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  // Inactive
  inactiveContainer: {
    gap: 12,
    paddingTop: 8,
  },
  actionCard: {
    backgroundColor: '#18181b',
    borderWidth: 1.5,
    borderColor: '#27272a',
    borderRadius: 12,
    padding: 14,
  },
  actionCardTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 14,
    color: '#ffffff',
    textTransform: 'uppercase',
  },
  actionCardDesc: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
    marginBottom: 12,
  },
  createJamBtn: {
    backgroundColor: '#17a398',
    borderWidth: 1.5,
    borderColor: '#0b1110',
    borderRadius: 8,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  createJamBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: '#082621',
    textTransform: 'uppercase',
  },
  joinInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  joinInput: {
    flex: 1,
    backgroundColor: '#09090b',
    borderWidth: 1.5,
    borderColor: '#3f3f46',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 13,
    color: '#ffffff',
  },
  joinSubmitBtn: {
    backgroundColor: '#17a398',
    borderWidth: 1.5,
    borderColor: '#0b1110',
    borderRadius: 8,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinSubmitBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: '#082621',
  },
  // Active
  activeContainer: {
    gap: 12,
    paddingTop: 6,
  },
  landscapeGrid: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    width: '100%',
  },
  landscapeCol: {
    flex: 1,
    gap: 12,
  },
  codeCard: {
    backgroundColor: '#18181b',
    borderWidth: 1.5,
    borderColor: '#27272a',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  codeSubtitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: '#17a398',
    textTransform: 'uppercase',
  },
  codeText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 28,
    color: '#f59e0b',
    marginVertical: 4,
    letterSpacing: 2,
  },
  codeDesc: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 10,
  },
  codeBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  copyBtn: {
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  copyBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: '#ffffff',
  },
  syncBtn: {
    backgroundColor: '#17a398',
    borderWidth: 1,
    borderColor: '#082621',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: '#082621',
  },
  syncedTrackCard: {
    backgroundColor: '#18181b',
    borderWidth: 1.5,
    borderColor: '#27272a',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  syncedTrackTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  playerProgressContainer: {
    width: '100%',
    paddingTop: 4,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#27272a',
    borderRadius: 3,
    overflow: 'hidden',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#17a398',
    borderRadius: 3,
  },
  progressTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  progressTimeText: {
    fontFamily: 'monospace',
    fontSize: 9.5,
    color: '#9ca3af',
  },
  playerControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingTop: 2,
  },
  playerControlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#27272a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerPlayPauseBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#17a398',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hostLockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingTop: 2,
  },
  hostLockedNoticeText: {
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#f59e0b',
  },
  syncedTrackCover: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#27272a',
  },
  syncStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncStatusText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 9,
    color: '#17a398',
  },
  statusPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  syncedTrackTitle: {
    fontWeight: 'bold',
    fontSize: 13,
    color: '#ffffff',
    marginTop: 2,
  },
  syncedTrackArtist: {
    fontSize: 11,
    color: '#9ca3af',
  },
  // Queue Card
  queueCard: {
    backgroundColor: '#18181b',
    borderWidth: 1.5,
    borderColor: '#27272a',
    borderRadius: 12,
    padding: 12,
  },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  queueTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: '#ffffff',
  },
  addSongToggleBtn: {
    backgroundColor: '#17a398',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addSongToggleText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: '#082621',
  },
  searchDrawer: {
    backgroundColor: '#27272a',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  filterTabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  filterTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: '#18181b',
    borderWidth: 1.5,
    borderColor: '#3f3f46',
  },
  filterTabBtnActive: {
    backgroundColor: '#17a398',
    borderColor: '#17a398',
  },
  filterTabText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10.5,
    color: '#9ca3af',
  },
  filterTabTextActive: {
    color: '#082621',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#ffffff',
    padding: 0,
  },
  recsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  recsHeaderTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 9.5,
    color: '#9ca3af',
    letterSpacing: 0.5,
  },
  recsShuffleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  recsShuffleBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 8.5,
    color: colors.mint,
  },
  searchResultsList: {
    maxHeight: 220,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 6,
    padding: 6,
  },
  resultCover: {
    width: 30,
    height: 30,
    borderRadius: 4,
    marginRight: 8,
  },
  resultTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  resultArtist: {
    fontSize: 10,
    color: '#9ca3af',
  },
  queueAddBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  queueAddBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 9,
    color: '#082621',
  },
  queueList: {
    marginTop: 8,
    gap: 6,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272a',
    borderRadius: 8,
    padding: 8,
  },
  queueIndex: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: '#9ca3af',
    width: 18,
    textAlign: 'center',
  },
  queueCover: {
    width: 32,
    height: 32,
    borderRadius: 4,
    marginHorizontal: 6,
  },
  queueTrackTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  queueTrackArtist: {
    fontSize: 10,
    color: '#9ca3af',
  },
  queueActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  removeQueueBtn: {
    padding: 4,
    marginLeft: 2,
  },
  dragHandle: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  emptyQueueText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 14,
  },
  // Members Card
  membersCard: {
    backgroundColor: '#18181b',
    borderWidth: 1.5,
    borderColor: '#27272a',
    borderRadius: 12,
    padding: 12,
  },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  membersTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: '#9ca3af',
  },
  membersList: {
    gap: 6,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272a',
    borderRadius: 8,
    padding: 8,
  },
  memberAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    marginRight: 8,
  },
  memberName: {
    flex: 1,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  memberRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hostBadge: {
    backgroundColor: '#17a398',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  hostBadgeText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 9,
    color: '#082621',
  },
  makeHostBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  makeHostText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 9,
    color: '#082621',
  },
  kickBtn: {
    padding: 4,
  },
  leaveBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1.5,
    borderColor: '#ef4444',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  leaveBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: '#ef4444',
  },
  controlModeBanner: {
    backgroundColor: '#1b2a26',
    borderWidth: 1.5,
    borderColor: '#263d38',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'between',
  },
  controlModeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.mint,
  },
  controlModeDesc: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
    lineHeight: 14,
  },
  toggleControlBtn: {
    backgroundColor: colors.mint,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#0b1110',
  },
  toggleControlBtnActive: {
    backgroundColor: '#f59e0b',
  },
  toggleControlBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: '#082621',
  },
  // ── Light Theme Adaptations (Apothecary Brutalist) ──
  hardShadowLight: {
    backgroundColor: '#0b1110',
  },
  sheetLight: {
    backgroundColor: '#fdfbf7',
    borderColor: '#0b1110',
  },
  headerLight: {
    borderBottomColor: '#d6c8b0',
  },
  titleLight: {
    color: '#082621',
  },
  subTitleLight: {
    color: '#57534e',
  },
  closeBtnLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  actionCardLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  actionCardTitleLight: {
    color: '#082621',
  },
  actionCardDescLight: {
    color: '#57534e',
  },
  joinInputLight: {
    backgroundColor: '#ffffff',
    borderColor: '#0b1110',
    color: '#0b1110',
  },
  codeCardLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  codeSubtitleLight: {
    color: '#0f756d',
  },
  codeTextLight: {
    color: '#d97706',
  },
  codeDescLight: {
    color: '#57534e',
  },
  copyBtnLight: {
    backgroundColor: '#ffffff',
    borderColor: '#0b1110',
  },
  copyBtnTextLight: {
    color: '#082621',
  },
  controlModeBannerLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  controlModeTitleLight: {
    color: '#0f756d',
  },
  controlModeDescLight: {
    color: '#57534e',
  },
  toggleControlBtnLight: {
    borderColor: '#0b1110',
  },
  syncedTrackCardLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  syncedTrackCoverLight: {
    backgroundColor: '#ded2bb',
    borderWidth: 1,
    borderColor: '#0b1110',
  },
  syncStatusTextLight: {
    color: '#0f756d',
  },
  syncedTrackTitleLight: {
    color: '#082621',
  },
  syncedTrackArtistLight: {
    color: '#57534e',
  },
  progressBarBgLight: {
    backgroundColor: '#ded2bb',
  },
  progressTimeTextLight: {
    color: '#57534e',
  },
  playerControlBtnLight: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#0b1110',
  },
  playerPlayPauseBtnLight: {
    borderWidth: 1,
    borderColor: '#0b1110',
  },
  hostLockedNoticeTextLight: {
    color: '#b45309',
  },
  membersCardLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  membersTitleLight: {
    color: '#082621',
  },
  memberItemLight: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#0b1110',
  },
  memberAvatarLight: {
    borderWidth: 1,
    borderColor: '#0b1110',
  },
  memberNameLight: {
    color: '#082621',
  },
  leaveBtnLight: {
    backgroundColor: '#fee2e2',
    borderColor: '#dc2626',
  },
  leaveBtnTextLight: {
    color: '#dc2626',
  },
  queueCardLight: {
    backgroundColor: '#fdfbf7',
    borderColor: '#0b1110',
  },
  queueHeaderLight: {
    borderBottomColor: '#d6c8b0',
  },
  queueTitleLight: {
    color: '#082621',
  },
  addSongToggleBtnLight: {
    borderWidth: 1,
    borderColor: '#0b1110',
  },
  searchDrawerLight: {
    backgroundColor: '#ede5d3',
    borderWidth: 1,
    borderColor: '#0b1110',
  },
  filterTabBtnLight: {
    backgroundColor: '#ffffff',
    borderColor: '#0b1110',
  },
  filterTabBtnActiveLight: {
    backgroundColor: '#17a398',
    borderColor: '#0b1110',
  },
  filterTabTextLight: {
    color: '#57534e',
  },
  searchBoxLight: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#0b1110',
  },
  searchInputLight: {
    color: '#0b1110',
  },
  recsHeaderTitleLight: {
    color: '#57534e',
  },
  recsShuffleBtnLight: {
    backgroundColor: '#ffffff',
    borderColor: '#0b1110',
  },
  recsShuffleBtnTextLight: {
    color: '#0f756d',
  },
  searchResultItemLight: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1c7b7',
  },
  resultCoverLight: {
    borderWidth: 1,
    borderColor: '#0b1110',
  },
  resultTitleLight: {
    color: '#082621',
  },
  resultArtistLight: {
    color: '#57534e',
  },
  queueAddBtnLight: {
    borderWidth: 1,
    borderColor: '#0b1110',
  },
  queueItemLight: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#0b1110',
  },
  queueIndexLight: {
    color: '#57534e',
  },
  queueCoverLight: {
    borderWidth: 1,
    borderColor: '#0b1110',
  },
  queueTrackTitleLight: {
    color: '#082621',
  },
  queueTrackArtistLight: {
    color: '#57534e',
  },
  dragHandleLight: {
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  emptyQueueTextLight: {
    color: '#78716c',
  },
});
