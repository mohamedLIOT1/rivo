import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Alert,
  Clipboard,
  useWindowDimensions,
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
  ChevronUp,
  ChevronDown,
  Crown,
  UserMinus,
  Search,
  Shuffle,
  Sparkles,
  Play,
  Pause,
  SkipBack,
  SkipForward,
} from 'lucide-react-native';
import { useSocket } from '../context/SocketContext';
import { useUser } from '../context/UserContext';
import { useAudioPlayer } from '../context/AudioContext';
import { useToast } from '../context/ToastContext';
import { colors } from '../theme/colors';
import UserDetailModal from './UserDetailModal';

export default function JamRoomModal({ visible, onClose }) {
  const {
    socket,
    jamSession,
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
  const { currentTrack, isPlaying, playTrack, togglePlay, playNextTrack, playPrevTrack, syncRemotePlayState, likedTrackIds = [] } = useAudioPlayer();
  const { showToast } = useToast();

  const [inputCode, setInputCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [justAddedId, setJustAddedId] = useState(null);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);

  const { width, height } = useWindowDimensions();
  const isLandscape = (width > height && width >= 480) || width >= 650;

  // Modal visibility handled by <Modal visible={visible}>

  const handleCopyCode = () => {
    const code = jamSession?.code || jamSession?.roomCode;
    if (code) {
      try {
        Clipboard.setString(code);
      } catch {}
      setCopied(true);
      showToast('Jam code copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleTuneIn = () => {
    const roomCode = jamSession?.code || jamSession?.roomCode;
    if (socket && roomCode) {
      socket.emit('jam:request_sync', { roomCode });
    }
    if (jamSession?.currentTrack) {
      let liveTime = Number(jamSession.currentTime) || 0;
      if (jamSession.isPlaying && jamSession.updatedAt) {
        const elapsed = (Date.now() - jamSession.updatedAt) / 1000;
        if (liveTime <= 2 && elapsed > 2) {
          liveTime = Math.min(2, liveTime);
        } else if (elapsed > 0 && elapsed < 3600) {
          liveTime += elapsed;
        }
      }
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
      showToast('Audio resynced with Jam room', 'info');
    } else if (currentTrack) {
      playTrack(currentTrack);
      showToast('Broadcasting track to Jam room', 'info');
    }
  };

  const handleCreateJam = () => {
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const code = `JAM-${randomNum}`;
    joinJam(code);
    showToast(`Created Jam Room ${code}`, 'success');
    if (currentTrack) {
      setTimeout(() => {
        syncJamPlayState?.(isPlaying, currentTrack, 0);
      }, 500);
    }
  };

  const handleJoin = () => {
    if (!inputCode.trim()) return;
    const cleanCode = inputCode.trim().toUpperCase();
    joinJam(cleanCode);
    setInputCode('');
    showToast(`Joining ${cleanCode}...`, 'info');
  };

  const handleAddTrack = (track) => {
    if (!track) return;
    addToJamQueue(track);
    const tId = track._id || track.id;
    setJustAddedId(tId);
    showToast(`Added "${track.title}" to Jam queue`, 'success');
    setTimeout(() => setJustAddedId(null), 1500);
  };

  const handleReorder = (fromIdx, toIdx) => {
    if (fromIdx < 0 || toIdx < 0) return;
    if (fromIdx >= (jamSession?.queue?.length || 0)) return;
    if (toIdx >= (jamSession?.queue?.length || 0)) return;
    reorderJamQueue(fromIdx, toIdx);
  };

  // Smart recommendations: user liked tracks + randomized library mix instead of chronological uploads
  const smartRecommendations = useMemo(() => {
    if (!Array.isArray(tracks) || tracks.length === 0) return [];
    const liked = tracks.filter((t) =>
      likedTrackIds.some((id) => String(id) === String(t._id || t.id))
    );
    const others = tracks.filter((t) =>
      !likedTrackIds.some((id) => String(id) === String(t._id || t.id))
    );
    const shuffledOthers = [...others].sort(() => 0.5 - Math.random());
    const mixed = [...liked, ...shuffledOthers];
    return mixed.slice(0, 18);
  }, [tracks, likedTrackIds, shuffleSeed]);

  const filteredTracks = searchQuery.trim()
    ? (tracks || []).filter(
        (t) =>
          (t?.title && t.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
          (t?.artist && t.artist.toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 20)
    : smartRecommendations;

  const myId = String(currentUser?._id || currentUser?.id || '');
  const isCurrentUserHost = Boolean(
    jamSession &&
      ((jamSession.hostUserId && myId && String(jamSession.hostUserId) === myId) ||
        (jamSession.hostId && socket?.id && jamSession.hostId === socket.id) ||
        (jamSession.members || []).some(m => (m.socketId === socket?.id || (myId && String(m.id || m._id) === myId)) && m.isHost))
  );

  const renderBanner = () => (
    <View style={styles.codeCard}>
      <Text style={styles.codeSubtitle}>ACTIVE JAM ROOM CODE</Text>
      <Text style={styles.codeText}>{jamSession.code || jamSession.roomCode || 'LIVE'}</Text>
      <Text style={styles.codeDesc}>
        Share this code with friends to synchronize listening.
      </Text>

      <View style={styles.codeBtnRow}>
        <TouchableOpacity
          style={styles.copyBtn}
          onPress={handleCopyCode}
          activeOpacity={0.8}
        >
          {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} color="#ffffff" />}
          <Text style={styles.copyBtnText}>{copied ? 'COPIED!' : 'COPY CODE'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.syncBtn}
          onPress={handleTuneIn}
          activeOpacity={0.8}
        >
          <Headphones size={14} color="#082621" />
          <Text style={styles.syncBtnText}>SYNC AUDIO</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCurrentTrack = () => (
    currentTrack ? (
      <View style={styles.syncedTrackCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%' }}>
          <Image
            source={{
              uri:
                currentTrack.coverUrl ||
                currentTrack.cover ||
                'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200',
            }}
            style={styles.syncedTrackCover}
          />
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.syncStatusRow}>
              <Text style={styles.syncStatusText}>
                {isPlaying ? 'PLAYING IN SYNC' : 'PLAYBACK PAUSED'}
              </Text>
              <View
                style={[
                  styles.statusPulseDot,
                  { backgroundColor: isPlaying ? colors.mint : '#f59e0b' },
                ]}
              />
            </View>
            <Text style={styles.syncedTrackTitle} numberOfLines={1}>
              {currentTrack.title}
            </Text>
            <Text style={styles.syncedTrackArtist} numberOfLines={1}>
              {currentTrack.artist}
            </Text>
          </View>
        </View>

        {/* Live Controls & Sync Row */}
        <View style={styles.syncedControlsRow}>
          <View style={styles.controlsLeft}>
            {isCurrentUserHost ? (
              <View style={styles.hostControls}>
                <TouchableOpacity
                  style={styles.controlBtn}
                  onPress={playPrevTrack}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <SkipBack size={16} color="#ffffff" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.playPauseBtn}
                  onPress={() => togglePlay()}
                  activeOpacity={0.8}
                >
                  {isPlaying ? (
                    <Pause size={16} color="#082621" fill="#082621" />
                  ) : (
                    <Play size={16} color="#082621" fill="#082621" />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.controlBtn}
                  onPress={playNextTrack}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <SkipForward size={16} color="#ffffff" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.listenerBadge}>
                <Text style={styles.listenerBadgeText}>HOST CONTROLS PLAYBACK</Text>
              </View>
            )}
          </View>

          <TouchableOpacity
            style={styles.quickSyncBtn}
            onPress={handleTuneIn}
            activeOpacity={0.8}
          >
            <Headphones size={13} color="#082621" />
            <Text style={styles.quickSyncBtnText}>SYNC</Text>
          </TouchableOpacity>
        </View>
      </View>
    ) : null
  );

  const renderMembers = () => (
    <View style={styles.membersCard}>
      <View style={styles.membersHeader}>
        <Users size={14} color={colors.mint} />
        <Text style={styles.membersTitle}>
          LISTENERS IN ROOM ({jamSession.members?.length || 1})
        </Text>
      </View>

      <View style={styles.membersList}>
        {(jamSession.members || []).map((m) => {
          const mId = m.id || m._id || m.socketId;
          return (
            <View key={mId} style={styles.memberItem}>
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
                  style={styles.memberAvatar}
                />
                <Text style={styles.memberName} numberOfLines={1}>
                  {m.name || 'Listener'}
                </Text>
              </TouchableOpacity>

              <View style={styles.memberRight}>
                {m.isHost && (
                  <View style={styles.hostBadge}>
                    <Crown size={10} color="#082621" strokeWidth={3} />
                    <Text style={styles.hostBadgeText}>HOST</Text>
                  </View>
                )}

                {isCurrentUserHost && !m.isHost && (
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={styles.makeHostBtn}
                      onPress={() => {
                        Alert.alert(
                          'Transfer Host',
                          `Make ${m.name} the host of this Jam?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Make Host',
                              onPress: () => transferJamHost(m),
                            },
                          ]
                        );
                      }}
                    >
                      <Crown size={10} color="#082621" />
                      <Text style={styles.makeHostText}>MAKE HOST</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.kickBtn}
                      onPress={() => {
                        Alert.alert(
                          'Disconnect Listener',
                          `Disconnect ${m.name} from this Jam?`,
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Disconnect',
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
    <TouchableOpacity style={styles.leaveBtn} onPress={leaveJam} activeOpacity={0.8}>
      <Text style={styles.leaveBtnText}>LEAVE JAM ROOM</Text>
    </TouchableOpacity>
  );

  const renderQueue = () => (
    <View style={styles.queueCard}>
      <View style={styles.queueHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Music size={15} color={colors.mint} />
          <Text style={styles.queueTitle}>
            JAM QUEUE ({jamSession.queue?.length || 0})
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addSongToggleBtn}
          onPress={() => setIsSearchOpen((p) => !p)}
          activeOpacity={0.8}
        >
          <Plus size={13} color="#082621" />
          <Text style={styles.addSongToggleText}>
            {isSearchOpen ? 'CLOSE' : 'ADD SONG'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Add Song Drawer */}
      {isSearchOpen && (
        <View style={styles.searchDrawer}>
          <View style={styles.searchBox}>
            <Search size={14} color="#9ca3af" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search songs to queue..."
              placeholderTextColor="#6b7280"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={13} color="#9ca3af" />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.recsHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Sparkles size={11} color={colors.mint} />
              <Text style={styles.recsHeaderTitle}>
                {searchQuery.trim() ? `RESULTS (${filteredTracks.length})` : 'YOUR FAVORITES & DISCOVERIES'}
              </Text>
            </View>
            {!searchQuery.trim() && (
              <TouchableOpacity
                style={styles.recsShuffleBtn}
                onPress={() => setShuffleSeed((s) => s + 1)}
                activeOpacity={0.8}
              >
                <Shuffle size={11} color="#17a398" />
                <Text style={styles.recsShuffleBtnText}>SHUFFLE</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView
            nestedScrollEnabled={true}
            style={styles.searchResultsList}
            contentContainerStyle={{ gap: 6, paddingBottom: 6 }}
            showsVerticalScrollIndicator={true}
          >
            {filteredTracks.map((track) => {
              const tId = track._id || track.id;
              const isQueued = justAddedId === tId;
              return (
                <View key={tId} style={styles.searchResultItem}>
                  <Image
                    source={{
                      uri:
                        track.cover ||
                        'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100',
                    }}
                    style={styles.resultCover}
                  />
                  <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                    <Text style={styles.resultTitle} numberOfLines={1}>
                      {track.title}
                    </Text>
                    <Text style={styles.resultArtist} numberOfLines={1}>
                      {track.artist}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.queueAddBtn,
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
                    <Text style={styles.queueAddBtnText}>
                      {isQueued ? 'QUEUED' : 'QUEUE'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Shared Queue List Items */}
      {Array.isArray(jamSession.queue) && jamSession.queue.length > 0 ? (
        <View style={styles.queueList}>
          {jamSession.queue.map((qTrack, idx) => {
            const qId = qTrack._id || qTrack.id || idx;
            return (
              <View key={`${qId}-${idx}`} style={styles.queueItem}>
                <Text style={styles.queueIndex}>{idx + 1}</Text>
                <Image
                  source={{
                    uri:
                      qTrack.cover ||
                      'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100',
                  }}
                  style={styles.queueCover}
                />
                <View style={{ flex: 1, minWidth: 0, marginRight: 6 }}>
                  <Text style={styles.queueTrackTitle} numberOfLines={1}>
                    {qTrack.title}
                  </Text>
                  <Text style={styles.queueTrackArtist} numberOfLines={1}>
                    {qTrack.artist}
                  </Text>
                </View>
                <View style={styles.queueActionsRow}>
                  <TouchableOpacity
                    disabled={idx === 0}
                    onPress={() => handleReorder(idx, idx - 1)}
                    style={[styles.reorderBtn, idx === 0 && { opacity: 0.2 }]}
                  >
                    <ChevronUp size={14} color="#ffffff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    disabled={idx === jamSession.queue.length - 1}
                    onPress={() => handleReorder(idx, idx + 1)}
                    style={[
                      styles.reorderBtn,
                      idx === jamSession.queue.length - 1 && { opacity: 0.2 },
                    ]}
                  >
                    <ChevronDown size={14} color="#ffffff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => removeFromJamQueue(idx, qId)}
                    style={styles.removeQueueBtn}
                  >
                    <Trash2 size={13} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.emptyQueueText}>JAM QUEUE IS CURRENTLY EMPTY.</Text>
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, isLandscape && { justifyContent: 'center', alignItems: 'center' }]}>
        <View style={[styles.sheetOuter, isLandscape && { width: '94%', maxWidth: 960, height: '94%', maxHeight: '94%' }]}>
          <View style={styles.hardShadow} />
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <View style={styles.iconBox}>
                  <Radio size={18} color="#082621" />
                </View>
                <View>
                  <View style={styles.titleRow}>
                    <Text style={styles.title}>JAM SESSION</Text>
                    {jamSession && <View style={styles.liveDot} />}
                  </View>
                  <Text style={styles.subTitle}>Listen together with friends in real-time</Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
                <X size={18} color={colors.ink} />
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
                  <View style={styles.actionCard}>
                    <Text style={styles.actionCardTitle}>HOST A JAM</Text>
                    <Text style={styles.actionCardDesc}>
                      Start a live Jam room and invite friends to listen together in real-time.
                    </Text>
                    <TouchableOpacity
                      style={styles.createJamBtn}
                      onPress={handleCreateJam}
                      activeOpacity={0.8}
                    >
                      <Radio size={16} color="#082621" />
                      <Text style={styles.createJamBtnText}>CREATE JAM</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Join Card */}
                  <View style={styles.actionCard}>
                    <Text style={styles.actionCardTitle}>JOIN A JAM</Text>
                    <Text style={styles.actionCardDesc}>
                      Enter the Jam room code provided by another listener.
                    </Text>

                    <View style={styles.joinInputRow}>
                      <TextInput
                        style={styles.joinInput}
                        placeholder="e.g. JAM-9921"
                        placeholderTextColor="#6b7280"
                        value={inputCode}
                        onChangeText={(t) => setInputCode(t.toUpperCase())}
                        autoCapitalize="characters"
                        autoCorrect={false}
                      />
                      <TouchableOpacity
                        style={[styles.joinSubmitBtn, !inputCode.trim() && { opacity: 0.5 }]}
                        onPress={handleJoin}
                        disabled={!inputCode.trim()}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.joinSubmitBtnText}>JOIN</Text>
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
    padding: 10,
  },
  sheetOuter: {
    position: 'relative',
    height: '88%',
    maxHeight: '88%',
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
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 4,
  },
  syncedControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    width: '100%',
  },
  controlsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hostControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  controlBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playPauseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#17a398',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listenerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  listenerBadgeText: {
    fontSize: 9,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#9ca3af',
  },
  quickSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#17a398',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  quickSyncBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: '#082621',
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
  reorderBtn: {
    padding: 3,
  },
  removeQueueBtn: {
    padding: 4,
    marginLeft: 2,
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
});
