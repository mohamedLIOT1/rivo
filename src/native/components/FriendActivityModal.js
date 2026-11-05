import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {
  Users,
  Play,
  X,
  Search,
  Radio,
  RefreshCw,
  Disc,
} from 'lucide-react-native';
import { API_BASE_URL } from '../config';
import { useUser } from '../context/UserContext';
import { useAudioPlayer } from '../context/AudioContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { normalizeCoverUri } from '../utils/coverUtils';
import UserDetailModal from './UserDetailModal';

function formatLastSeenSubtitle(lastActiveAt) {
  if (!lastActiveAt) return 'Offline';
  const diffSec = Math.floor((Date.now() - new Date(lastActiveAt).getTime()) / 1000);
  if (isNaN(diffSec) || diffSec < 0) return 'Offline';
  if (diffSec < 60) return 'Active just now';
  if (diffSec < 3600) return `Active ${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `Last seen ${Math.floor(diffSec / 3600)}h ago`;
  const days = Math.floor(diffSec / 86400);
  return days === 1 ? 'Last seen yesterday' : `Last seen ${days}d ago`;
}

// Pure memoized card component for peak list performance
const FriendActivityCard = React.memo(function FriendActivityCard({
  item,
  isDark,
  onOpenProfile,
  onListenAlong,
}) {
  const rawListening = item.currentListening;
  const isDummyOffline = Boolean(
    rawListening?.title?.toLowerCase() === 'offline' ||
    rawListening?.name?.toLowerCase() === 'offline'
  );
  const listening = isDummyOffline ? null : rawListening;
  const isLive = Boolean(item.isLive && listening);

  return (
    <View style={[styles.friendCard, !isDark && styles.friendCardLight]}>
      {/* Avatar and name clickable to open profile */}
      <TouchableOpacity
        style={styles.cardMainTouch}
        onPress={() => onOpenProfile(item)}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          {item.avatar ? (
            <Image source={{ uri: normalizeCoverUri(item.avatar) }} style={styles.avatarImg} fadeDuration={0} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarLetter}>
                {item.name ? item.name[0].toUpperCase() : 'U'}
              </Text>
            </View>
          )}
          {isLive ? (
            <View style={[styles.onlineDot, { backgroundColor: '#10b981', borderColor: !isDark ? '#f4ede1' : '#0b1110', borderWidth: 2 }]} />
          ) : item.isOnline ? (
            <View style={[styles.onlineDot, { backgroundColor: '#34d399' }]} />
          ) : (
            <View style={[styles.onlineDot, { backgroundColor: '#64748b' }]} />
          )}
        </View>

        {/* Info Column - Expanded to full width */}
        <View style={styles.infoCol}>
          {/* Top Row: Name on left, time/status pill cleanly on right */}
          <View style={styles.nameRow}>
            <Text style={[styles.friendName, !isDark && styles.friendNameLight]} numberOfLines={1}>
              {item.name || 'Anonymous Listener'}
            </Text>
            {isLive ? (
              <View style={styles.liveBadge}>
                <Radio size={9} color="#0b1110" strokeWidth={3} />
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
            ) : item.isOnline ? (
              <View style={[styles.liveBadge, { backgroundColor: '#1e3a34' }]}>
                <Text style={[styles.liveBadgeText, { color: '#34d399' }]}>ONLINE</Text>
              </View>
            ) : null}
          </View>

          {/* Bottom Row: Full width track title & artist */}
          {isLive && listening ? (
            <View style={styles.trackInfoRow}>
              <Disc size={12} color="#26c4b7" strokeWidth={2.4} />
              <Text style={[styles.trackTitle, { color: '#26c4b7', fontWeight: '700' }]} numberOfLines={1}>
                Playing: {listening.title || 'Playing song'}
                {listening.artist ? ` • ${listening.artist}` : ''}
              </Text>
            </View>
          ) : listening && item.isOnline ? (
            <View style={styles.trackInfoRow}>
              <Disc size={11} color="#f59e0b" strokeWidth={2} />
              <Text style={[styles.trackTitle, { color: !isDark ? '#b45309' : '#fcd34d' }]} numberOfLines={1}>
                Paused: {listening.title || 'Track'}
                {listening.artist ? ` • ${listening.artist}` : ''}
              </Text>
            </View>
          ) : listening && !item.isOnline ? (
            <View style={styles.trackInfoRow}>
              <Disc size={11} color="#64748b" strokeWidth={1.8} />
              <Text style={[styles.trackTitle, { color: !isDark ? '#57534e' : '#94a3b8' }]} numberOfLines={1}>
                Last played: {listening.title || 'Track'}
                {listening.artist ? ` • ${listening.artist}` : ''}
                {item.lastActiveAt ? ` • ${formatLastSeenSubtitle(item.lastActiveAt)}` : ''}
              </Text>
            </View>
          ) : (
            <Text style={[styles.idleText, !isDark && styles.idleTextLight]} numberOfLines={1}>
              {item.isOnline ? 'Online • Browsing music' : formatLastSeenSubtitle(item.lastActiveAt)}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {/* 1-Tap Play Action on the right */}
      {isLive && listening && (
        <TouchableOpacity
          style={styles.listenAlongBtn}
          onPress={() => onListenAlong(item)}
          activeOpacity={0.85}
        >
          <Play size={11} color="#0b1110" fill="#0b1110" />
          <Text style={styles.listenAlongText}>TUNE IN</Text>
        </TouchableOpacity>
      )}
    </View>
  );
});

export default function FriendActivityModal({ visible, onClose, onViewProfile }) {
  const { token, currentUser } = useUser();
  const { playTrack } = useAudioPlayer();
  const { socket } = useSocket();
  const { isDark = true } = useTheme();

  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);

  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE_URL}/api/users/listening-activity`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.activities)) {
          setActivities(data.activities);
        }
      }
    } catch {}
    setIsLoading(false);
  }, [token]);

  useEffect(() => {
    if (!visible) return;
    fetchActivities();
    const interval = setInterval(fetchActivities, 20000);
    return () => clearInterval(interval);
  }, [visible, fetchActivities]);

  // Real-time socket updates for zero latency
  useEffect(() => {
    if (!socket || !visible) return;

    const handleActivityUpdated = (data) => {
      if (!data?.userId) return;
      setActivities((prev) =>
        prev.map((friend) => {
          if (String(friend.id || friend._id) === String(data.userId)) {
            return {
              ...friend,
              currentListening: data.currentListening !== undefined ? data.currentListening : friend.currentListening,
              lastActiveAt: data.lastActiveAt || friend.lastActiveAt,
              isLive: data.isLive !== undefined ? Boolean(data.isLive) : (data.isOnline && friend.isLive),
              isOnline: data.isOnline !== undefined ? Boolean(data.isOnline) : friend.isOnline,
            };
          }
          return friend;
        })
      );
    };

    const handleUserStatus = (data) => {
      if (!data?.userId) return;
      setActivities((prev) =>
        prev.map((friend) => {
          if (String(friend.id || friend._id) === String(data.userId)) {
            const isOnline = Boolean(data.isOnline);
            return {
              ...friend,
              isOnline,
              isLive: !isOnline ? false : (data.isLive !== undefined ? Boolean(data.isLive) : friend.isLive),
            };
          }
          return friend;
        })
      );
    };

    socket.on('activity:updated', handleActivityUpdated);
    socket.on('user:status', handleUserStatus);

    return () => {
      socket.off('activity:updated', handleActivityUpdated);
      socket.off('user:status', handleUserStatus);
    };
  }, [socket, visible]);

  const filtered = useMemo(() => {
    const myId = String(currentUser?.id || currentUser?._id || '');
    const myName = (currentUser?.name || '').trim().toLowerCase();
    let list = activities.filter((f) => {
      const friendId = String(f.id || f._id || '');
      if (myId && friendId === myId) return false;
      if (myName && (f.name || '').trim().toLowerCase() === myName) return false;
      return true;
    });

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((f) => {
      const nameMatch = f.name?.toLowerCase().includes(q);
      const songMatch = f.currentListening?.title?.toLowerCase().includes(q);
      const artistMatch = f.currentListening?.artist?.toLowerCase().includes(q);
      return nameMatch || songMatch || artistMatch;
    });
  }, [activities, searchQuery, currentUser]);

  const liveCount = useMemo(() => {
    return filtered.filter((a) => Boolean(a.isLive && a.currentListening)).length;
  }, [filtered]);

  const handleListenAlong = useCallback((friend) => {
    if (!friend.currentListening) return;
    const track = friend.currentListening;
    if (playTrack) {
      playTrack({
        _id: track.id || track._id || `friend_${friend.id}`,
        id: track.id || track._id || `friend_${friend.id}`,
        title: track.title || 'Untitled',
        artist: track.artist || 'Unknown',
        coverUrl: track.cover || friend.avatar,
        cover: track.cover || friend.avatar,
        audioUrl: track.audioUrl || '',
      });
      onClose();
    }
  }, [playTrack, onClose]);

  const handleOpenProfile = useCallback((friend) => {
    if (onViewProfile) {
      onClose();
      onViewProfile(friend);
    } else {
      setSelectedUser(friend);
    }
  }, [onViewProfile, onClose]);

  const renderFriendItem = useCallback(({ item }) => (
    <FriendActivityCard
      item={item}
      isDark={isDark}
      onOpenProfile={handleOpenProfile}
      onListenAlong={handleListenAlong}
    />
  ), [isDark, handleOpenProfile, handleListenAlong]);

  return (
    <Modal visible={visible} animationType={Platform.OS === 'android' ? 'none' : 'slide'} transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.container, !isDark && styles.containerLight]}>
          {/* Header */}
          <View style={[styles.header, !isDark && styles.headerLight]}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Users size={18} color="#0b1110" strokeWidth={2.8} />
              </View>
              <View>
                <Text style={[styles.headerTitle, !isDark && styles.headerTitleLight]}>FRIEND ACTIVITY</Text>
                <Text style={styles.headerSub}>
                  {liveCount > 0 ? `${liveCount} LISTENING LIVE` : 'DISCORD & COMMUNITY RADAR'}
                </Text>
              </View>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={fetchActivities}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#17a398" />
                ) : (
                  <RefreshCw size={16} color={!isDark ? '#0b1110' : '#94a3b8'} />
                )}
              </TouchableOpacity>
              <TouchableOpacity style={[styles.closeBtn, !isDark && styles.closeBtnLight]} onPress={onClose}>
                <X size={18} color={!isDark ? '#0b1110' : '#ffffff'} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Search Box */}
          <View style={[styles.searchBox, !isDark && styles.searchBoxLight]}>
            <Search size={15} color={!isDark ? '#0b1110' : '#64748b'} />
            <TextInput
              style={[styles.searchInput, !isDark && styles.searchInputLight]}
              placeholder="Search friends or tracks..."
              placeholderTextColor={!isDark ? '#78716c' : '#64748b'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={14} color={!isDark ? '#0b1110' : '#94a3b8'} />
              </TouchableOpacity>
            )}
          </View>

          {/* List */}
          {isLoading && activities.length === 0 ? (
            <View style={styles.emptyWrap}>
              <ActivityIndicator size="large" color="#17a398" />
              <Text style={[styles.emptyTitle, !isDark && styles.emptyTitleLight]}>Scanning friend radar...</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Users size={40} color="#17a398" />
              <Text style={[styles.emptyTitle, !isDark && styles.emptyTitleLight]}>No activity found</Text>
              <Text style={[styles.emptyDesc, !isDark && styles.emptyDescLight]}>
                When your friends or community members play songs on Rivo or Discord, their tracks will appear here live.
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item, index) => item.id || item._id || String(index)}
              renderItem={renderFriendItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              initialNumToRender={Platform.OS === 'android' ? 5 : 8}
              maxToRenderPerBatch={Platform.OS === 'android' ? 3 : 6}
              windowSize={Platform.OS === 'android' ? 3 : 5}
              updateCellsBatchingPeriod={50}
              removeClippedSubviews={Platform.OS === 'android'}
            />
          )}
        </View>
      </View>

      {!onViewProfile && (
        <UserDetailModal
          visible={Boolean(selectedUser)}
          user={selectedUser}
          userId={selectedUser?.id || selectedUser?._id}
          onClose={() => setSelectedUser(null)}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#0e1715',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1.5,
    borderColor: '#263330',
    borderBottomWidth: 0,
    maxHeight: '85%',
    minHeight: '55%',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1c2825',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#17a398',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerSub: {
    color: '#17a398',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  refreshBtn: {
    padding: 6,
  },
  closeBtn: {
    backgroundColor: '#162220',
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#263330',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141d1b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#263330',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 10,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 8,
    color: '#ffffff',
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#141d1b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#263330',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  cardMainTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 11,
    flexShrink: 0,
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#17a398',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#0b1110',
    fontWeight: '900',
    fontSize: 16,
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#0e1715',
  },
  infoCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingRight: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 3,
  },
  friendName: {
    color: '#ffffff',
    fontSize: 13.5,
    fontWeight: '800',
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#17a398',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 3,
    flexShrink: 0,
  },
  liveBadgeText: {
    color: '#0b1110',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  trackInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  trackTitle: {
    color: '#94a3b8',
    fontSize: 11.5,
    flex: 1,
    minWidth: 0,
  },
  idleText: {
    color: '#64748b',
    fontSize: 11.5,
    width: '100%',
    flex: 1,
    minWidth: 0,
  },
  listenAlongBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#17a398',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
    marginLeft: 8,
    flexShrink: 0,
  },
  listenAlongText: {
    color: '#0b1110',
    fontSize: 10,
    fontWeight: '900',
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 12,
    marginBottom: 6,
  },
  emptyDesc: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  // ── Light Theme Adaptations ──
  containerLight: {
    backgroundColor: '#f4ede1',
    borderColor: '#0b1110',
  },
  headerLight: {
    borderBottomColor: '#d6c8b0',
  },
  headerTitleLight: {
    color: '#0b1110',
  },
  closeBtnLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  searchBoxLight: {
    backgroundColor: '#fdfbf7',
    borderColor: '#0b1110',
  },
  searchInputLight: {
    color: '#0b1110',
  },
  friendCardLight: {
    backgroundColor: '#fdfbf7',
    borderColor: '#0b1110',
  },
  friendNameLight: {
    color: '#0b1110',
  },
  idleTextLight: {
    color: '#57534e',
  },
  emptyTitleLight: {
    color: '#0b1110',
  },
  emptyDescLight: {
    color: '#57534e',
  },
});
