import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Platform,
  AppState,
} from 'react-native';
import {
  Users,
  X,
  Search,
  RefreshCw,
} from 'lucide-react-native';
import { API_BASE_URL } from '../config';
import { useUser } from '../context/UserContext';
import { useAudioPlayer } from '../context/AudioContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { useLocalization, useLiteMode } from '../context/LocalizationContext';
import FriendActivityCard from './FriendActivityCard';
import UserDetailModal from './UserDetailModal';
import { styles } from './friendActivityModalStyles';

export default function FriendActivityModal({ visible, onClose, onViewProfile }) {
  const { token, currentUser } = useUser();
  const { playTrack } = useAudioPlayer();
  const { socket } = useSocket();
  const { isDark = true } = useTheme();
  const { isRTL = false } = useLocalization() || {};
  const { isLiteMode } = useLiteMode();

  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [isAppActive, setIsAppActive] = useState(() => AppState.currentState === 'active');
  const fetchAbortRef = useRef(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      setIsAppActive(nextState === 'active');
    });
    return () => sub?.remove?.();
  }, []);

  const fetchActivities = useCallback(async () => {
    if (fetchAbortRef.current) {
      try { fetchAbortRef.current.abort(); } catch {}
    }
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setIsLoading(true);
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE_URL}/api/users/listening-activity`, {
        headers,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (res.ok) {
        const data = await res.json();
        if (!controller.signal.aborted && data?.success && Array.isArray(data.activities)) {
          setActivities(data.activities);
        }
      }
    } catch {}
    if (!controller.signal.aborted) {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!visible || !isAppActive) {
      if (fetchAbortRef.current) {
        try { fetchAbortRef.current.abort(); } catch {}
      }
      return undefined;
    }
    fetchActivities();
    const pollMs = isLiteMode ? 45000 : 20000;
    const interval = setInterval(fetchActivities, pollMs);
    return () => {
      clearInterval(interval);
      if (fetchAbortRef.current) {
        try { fetchAbortRef.current.abort(); } catch {}
      }
    };
  }, [visible, isAppActive, isLiteMode, fetchActivities]);

  // Real-time socket updates for zero latency without wiping offline tracks
  useEffect(() => {
    if (!socket || !visible) return;

    const handleActivityUpdated = (data) => {
      if (!data?.userId) return;
      setActivities((prev) =>
        prev.map((friend) => {
          if (String(friend.id || friend._id) === String(data.userId)) {
            let nextListening = friend.currentListening;
            if (data.currentListening !== undefined) {
              if (data.currentListening && (data.currentListening.title || data.currentListening.name)) {
                nextListening = data.currentListening;
              } else if (friend.currentListening) {
                nextListening = {
                  ...friend.currentListening,
                  isPlaying: Boolean(data.currentListening?.isPlaying),
                };
              }
            } else if (data.isOnline === false && nextListening) {
              nextListening = { ...nextListening, isPlaying: false };
            }

            return {
              ...friend,
              currentListening: nextListening,
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
              currentListening: friend.currentListening
                ? { ...friend.currentListening, isPlaying: !isOnline ? false : friend.currentListening.isPlaying }
                : null,
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
    <Modal visible={visible} animationType={isLiteMode || Platform.OS === 'android' ? 'none' : 'slide'} transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.container, !isDark && styles.containerLight]}>
          {/* Header */}
          <View style={[styles.header, !isDark && styles.headerLight, isRTL && styles.rowReverse]}>
            <View style={[styles.headerLeft, isRTL && styles.rowReverse]}>
              <View style={styles.iconCircle}>
                <Users size={18} color="#0b1110" strokeWidth={2.8} />
              </View>
              <View style={isRTL ? styles.alignEnd : styles.alignStart}>
                <Text style={[styles.headerTitle, !isDark && styles.headerTitleLight, isRTL && styles.arabicHeaderTitle]}>
                  {isRTL ? 'نشاط الأصدقاء' : 'FRIEND ACTIVITY'}
                </Text>
                <Text style={[styles.headerSub, isRTL && styles.arabicHeaderSub]}>
                  {liveCount > 0
                    ? `${liveCount} ${isRTL ? 'يستمعون الآن' : 'LISTENING LIVE'}`
                    : (isRTL ? 'رادار الأصدقاء' : 'COMMUNITY RADAR')}
                </Text>
              </View>
            </View>
            <View style={[styles.headerActions, isRTL && styles.rowReverse]}>
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
          <View style={[styles.searchBox, !isDark && styles.searchBoxLight, isRTL && styles.rowReverse]}>
            <Search size={15} color={!isDark ? '#0b1110' : '#64748b'} />
            <TextInput
              style={[styles.searchInput, !isDark && styles.searchInputLight, isRTL && styles.arabicSearchInput, isRTL && styles.textRight]}
              placeholder={isRTL ? 'ابحث عن أصدقاء أو مقاطع...' : 'Search friends or tracks...'}
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
              <Text style={[styles.emptyTitle, !isDark && styles.emptyTitleLight]}>
                {isRTL ? 'جاري فحص رادار الأصدقاء...' : 'Scanning friend radar...'}
              </Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Users size={36} color="#17a398" />
              <Text style={[styles.emptyTitle, !isDark && styles.emptyTitleLight]}>
                {isRTL ? 'لا يوجد نشاط حالياً' : 'No activity found'}
              </Text>
              <Text style={[styles.emptyDesc, !isDark && styles.emptyDescLight]}>
                {isRTL
                  ? 'عندما يشغل أصدقاؤك مقاطع على ريفو، ستظهر هنا مباشرة.'
                  : 'When your friends play songs on Rivo, their tracks will appear here live.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item, index) => item.id || item._id || String(index)}
              renderItem={renderFriendItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              initialNumToRender={Platform.OS === 'android' ? 6 : 10}
              maxToRenderPerBatch={Platform.OS === 'android' ? 4 : 8}
              windowSize={Platform.OS === 'android' ? 3 : 5}
              updateCellsBatchingPeriod={50}
              removeClippedSubviews={Platform.OS === 'android'}
            />
          )}
        </View>
      </View>

      {!onViewProfile && Boolean(selectedUser) && (
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
