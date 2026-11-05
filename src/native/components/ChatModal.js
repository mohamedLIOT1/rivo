import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Send, MessageSquare, ArrowLeft, Search, Users, Radio } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSocket } from '../context/SocketContext';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { API_BASE_URL } from '../config';
import { normalizeCoverUri } from '../utils/coverUtils';
import ChatMessageItem from './ChatMessageItem';
import {
  getCachedConversations,
  loadCachedConversationsAsync,
  setCachedConversations,
  getCachedFriends,
  loadCachedFriendsAsync,
  setCachedFriends,
  getCachedMessages,
  loadCachedMessagesAsync,
  setCachedMessages,
  appendCachedMessage,
} from '../services/chatCache';

export default function ChatModal({
  visible,
  onClose,
  initialTargetUser = null,
  onOpenJam = null,
  onViewProfile = null,
}) {
  const { socket, jamSession, joinJam } = useSocket();
  const { currentUser, token } = useUser();
  const { showToast } = useToast();
  const { isDark = true } = useTheme();

  const [activeUser, setActiveUser] = useState(initialTargetUser);
  const [conversations, setConversations] = useState(() => getCachedConversations());
  const [friends, setFriends] = useState(() => getCachedFriends());
  const [messages, setMessages] = useState(() => {
    const id = initialTargetUser?._id || initialTargetUser?.id;
    return id ? getCachedMessages(id) : [];
  });
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'friends'
  const [loadingHub, setLoadingHub] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const myTypingTimeoutRef = useRef(null);

  // Pre-load stored cache when component mounts
  useEffect(() => {
    loadCachedConversationsAsync().then((cached) => {
      if (cached && cached.length > 0) {
        setConversations((prev) => (prev.length === 0 ? cached : prev));
      }
    });
    loadCachedFriendsAsync().then((cached) => {
      if (cached && cached.length > 0) {
        setFriends((prev) => (prev.length === 0 ? cached : prev));
      }
    });
  }, []);

  useEffect(() => {
    if (visible) {
      if (initialTargetUser) {
        setActiveUser(initialTargetUser);
      } else {
        setActiveUser(null);
      }
    } else {
      setActiveUser(null);
      setMessages([]);
    }
  }, [visible, initialTargetUser]);

  useEffect(() => {
    if (visible && !activeUser) {
      fetchHubData();
    }
  }, [visible, activeUser]);

  // Load conversations and friends
  const fetchHubData = async () => {
    if (conversations.length === 0 && friends.length === 0) {
      setLoadingHub(true);
    }
    try {
      const activeToken = token || (await AsyncStorage.getItem('@rivo_auth_token_v2'));
      if (!activeToken) {
        setLoadingHub(false);
        return;
      }

      const headers = { Authorization: `Bearer ${activeToken}` };
      const [convRes, friendsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/chat/conversations`, { headers }).catch(() => null),
        fetch(`${API_BASE_URL}/api/users/friends`, { headers }).catch(() => null),
      ]);

      if (convRes && convRes.ok) {
        const convData = await convRes.json();
        if (convData.success) {
          const list = convData.conversations || [];
          setConversations(list);
          setCachedConversations(list);
        }
      }

      if (friendsRes && friendsRes.ok) {
        const friendsData = await friendsRes.json();
        if (friendsData.success) {
          const list = friendsData.friends || [];
          setFriends(list);
          setCachedFriends(list);
        }
      }
    } catch {}
    setLoadingHub(false);
  };

  // Load message history with active user & mark thread as read
  useEffect(() => {
    const activeUserId = activeUser?._id || activeUser?.id;
    if (!visible || !activeUserId) return;

    // 1. Immediately hydrate from instant memory cache (0ms lag)
    const cached = getCachedMessages(activeUserId);
    if (cached && cached.length > 0) {
      setMessages(cached);
      setLoadingMessages(false);
    } else {
      loadCachedMessagesAsync(activeUserId).then((stored) => {
        if (stored && stored.length > 0) {
          setMessages(stored);
          setLoadingMessages(false);
        }
      });
    }

    // 2. Fetch fresh messages in background
    fetchMessages(activeUserId);

    if (socket) {
      socket.emit('chat:mark_read', { senderId: activeUserId });
    }
  }, [visible, activeUser?._id, activeUser?.id, socket]);

  const fetchMessages = async (userId) => {
    const cached = getCachedMessages(userId);
    if (!cached || cached.length === 0) {
      setLoadingMessages(true);
    }
    try {
      const activeToken = token || (await AsyncStorage.getItem('@rivo_auth_token_v2'));
      const res = await fetch(`${API_BASE_URL}/api/chat/${userId}`, {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const fresh = data.messages || [];
          setMessages(fresh);
          setCachedMessages(userId, fresh);
        }
      }
    } catch {}
    setLoadingMessages(false);
  };

  // Socket listener for real-time private messages and seen receipts
  useEffect(() => {
    if (!socket || !visible) return;

    const onIncomingMessage = (msg) => {
      const activeUserId = String(activeUser?._id || activeUser?.id || '');
      const myId = String(currentUser?._id || currentUser?.id || '');

      const isBotMsg = Boolean(msg.isBot || msg.senderName === 'Rivo Bot');
      const isTargetBot = Boolean(
        activeUser?.isBot || activeUser?.name === 'Rivo Bot' || activeUser?.email === 'bot@rivo.app'
      );

      if (isBotMsg && !isTargetBot) {
        fetchHubData();
        return;
      }
      if (!isBotMsg && isTargetBot) {
        fetchHubData();
        return;
      }

      const isForActiveThread =
        (String(msg.sender) === activeUserId && String(msg.recipient) === myId) ||
        (String(msg.sender) === myId && String(msg.recipient) === activeUserId);

      if (isForActiveThread) {
        if (String(msg.sender) === activeUserId) {
          socket.emit('chat:mark_read', { senderId: activeUserId });
        }
        setMessages((prev) => {
          const exists = prev.some((m) => String(m._id || m.id) === String(msg._id || msg.id));
          if (exists) return prev;

          // Deduplicate temp message
          const tempIdx = prev.findIndex(
            (m) =>
              m._id &&
              String(m._id).startsWith('temp-') &&
              String(m.sender) === String(msg.sender) &&
              String(m.recipient) === String(msg.recipient) &&
              (m.text === msg.text ||
                (m.jamInvite?.roomCode && m.jamInvite.roomCode === msg.jamInvite?.roomCode))
          );
          if (tempIdx !== -1) {
            const updated = [...prev];
            updated[tempIdx] = msg;
            appendCachedMessage(activeUserId, msg);
            return updated;
          }

          const next = [...prev, msg];
          appendCachedMessage(activeUserId, msg);
          return next;
        });
      }

      // Update conversations hub in background
      fetchHubData();
    };

    const onSeen = (data) => {
      const activeUserId = String(activeUser?._id || activeUser?.id || '');
      const myId = String(currentUser?._id || currentUser?.id || '');

      if (String(data?.seenBy) === activeUserId) {
        setMessages((prev) =>
          prev.map((m) => (String(m.sender) === myId ? { ...m, read: true } : m))
        );
      }
    };

    const onTyping = (data) => {
      const activeUserId = String(activeUser?._id || activeUser?.id || '');
      if (String(data?.senderId) === activeUserId) {
        setIsOtherTyping(Boolean(data?.isTyping));
        if (data?.isTyping) {
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setIsOtherTyping(false);
          }, 3500);
        }
      }
    };

    socket.on('chat:message', onIncomingMessage);
    socket.on('chat:seen', onSeen);
    socket.on('chat:typing', onTyping);

    return () => {
      socket.off('chat:message', onIncomingMessage);
      socket.off('chat:seen', onSeen);
      socket.off('chat:typing', onTyping);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
    };
  }, [socket, visible, activeUser, currentUser]);

  // Smooth & deterministic scroll to absolute bottom
  const scrollToBottom = useCallback((animated = false) => {
    if (flatListRef.current) {
      flatListRef.current.scrollToEnd({ animated });
    }
  }, []);

  const triggerStaggeredScroll = useCallback(() => {
    scrollToBottom(false);
    const frame = requestAnimationFrame(() => {
      scrollToBottom(false);
    });
    const timer1 = setTimeout(() => {
      scrollToBottom(false);
    }, 80);
    const timer2 = setTimeout(() => {
      scrollToBottom(false);
    }, 250);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [scrollToBottom]);

  useEffect(() => {
    if (activeUser && messages.length > 0) {
      return triggerStaggeredScroll();
    }
  }, [activeUser, messages.length, loadingMessages, triggerStaggeredScroll]);

  const handleInputChange = (val) => {
    setInputText(val);
    const activeUserId = activeUser?._id || activeUser?.id;
    if (socket && activeUserId) {
      socket.emit('chat:typing', { recipientId: activeUserId, isTyping: true });
      if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
      myTypingTimeoutRef.current = setTimeout(() => {
        socket.emit('chat:typing', { recipientId: activeUserId, isTyping: false });
      }, 2000);
    }
  };

  const handleViewProfile = useCallback(
    (user) => {
      if (onViewProfile && user) {
        onViewProfile(user);
        onClose();
      }
    },
    [onViewProfile, onClose]
  );

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending || !activeUser) return;

    const activeUserId = activeUser?._id || activeUser?.id;
    if (!activeUserId) return;

    setIsSending(true);
    setInputText('');

    if (socket) {
      socket.emit('chat:typing', { recipientId: activeUserId, isTyping: false });
    }

    const tempMsg = {
      _id: `temp-${Date.now()}`,
      sender: currentUser?._id || currentUser?.id,
      recipient: activeUserId,
      text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    appendCachedMessage(activeUserId, tempMsg);

    try {
      const activeToken = token || (await AsyncStorage.getItem('@rivo_auth_token_v2'));
      const res = await fetch(`${API_BASE_URL}/api/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({
          recipientId: activeUserId,
          text,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.message) {
          const msgRecipient = String(data.message.recipient || '');
          const msgSender = String(data.message.sender || '');
          const isBelongsToThread =
            msgRecipient === String(activeUserId) || msgSender === String(activeUserId);

          if (!isBelongsToThread) {
            setMessages((prev) => prev.filter((m) => m._id !== tempMsg._id));
            fetchHubData();
          } else {
            setMessages((prev) => {
              const hasReal = prev.some((m) => String(m._id || m.id) === String(data.message._id));
              if (hasReal) {
                return prev.filter((m) => m._id !== tempMsg._id);
              }
              return prev.map((m) => (m._id === tempMsg._id ? data.message : m));
            });
            appendCachedMessage(activeUserId, data.message);
          }
        }
      }
    } catch {}
    setIsSending(false);
  };

  const handleInviteToJam = async () => {
    const activeUserId = activeUser?._id || activeUser?.id;
    if (!activeUserId) return;

    let roomCode = jamSession?.code || jamSession?.roomCode;
    if (!roomCode) {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      roomCode = `JAM-${randomNum}`;
      joinJam(roomCode);
    }

    const invitePayload = {
      roomCode,
      hostName: currentUser?.name || 'Listener',
      hostAvatar: currentUser?.avatar || '',
    };

    const tempMsg = {
      _id: `temp-${Date.now()}`,
      sender: currentUser?._id || currentUser?.id,
      recipient: activeUserId,
      text: `📻 Let's listen together in real-time! Jam Room: ${roomCode}`,
      jamInvite: invitePayload,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);
    appendCachedMessage(activeUserId, tempMsg);

    try {
      const activeToken = token || (await AsyncStorage.getItem('@rivo_auth_token_v2'));
      await fetch(`${API_BASE_URL}/api/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({
          recipientId: activeUserId,
          text: `📻 Let's listen together in real-time! Jam Room: ${roomCode}`,
          jamInvite: invitePayload,
        }),
      });
    } catch {}

    showToast(`Sent Jam invite (${roomCode}) to ${activeUser.name}`, 'success');
  };

  // Filter friends / conversations by search query
  const filteredConversations = conversations.filter((c) => {
    const name = c.user?.name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredFriends = friends.filter((f) => {
    const name = f.name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const renderMessage = useCallback(
    ({ item }) => {
      const myId = String(currentUser?._id || currentUser?.id || '');
      return (
        <ChatMessageItem
          item={item}
          isMe={String(item.sender) === myId}
          activeUser={activeUser}
          isDark={isDark}
          onOpenJam={onOpenJam}
          joinJam={joinJam}
          onViewProfile={handleViewProfile}
        />
      );
    },
    [currentUser, activeUser, isDark, onOpenJam, joinJam, handleViewProfile]
  );

  return (
    <Modal visible={visible} animationType={Platform.OS === 'android' ? 'none' : 'slide'} transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardWrap}
        >
          <View style={[styles.sheetCard, !isDark && styles.sheetCardLight]}>
            {/* ── HEADER ── */}
            <View style={[styles.header, !isDark && styles.headerLight]}>
              {activeUser ? (
                <View style={styles.activeUserHeaderRow}>
                  <TouchableOpacity
                    style={[styles.backBtn, !isDark && styles.backBtnLight]}
                    onPress={() => setActiveUser(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <ArrowLeft size={18} color={!isDark ? '#0b1110' : '#17a398'} strokeWidth={2.5} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, marginRight: 8 }}
                    onPress={() => handleViewProfile(activeUser)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.activeAvatarWrap}>
                      {activeUser.avatar ? (
                        <Image
                          source={{ uri: normalizeCoverUri(activeUser.avatar) }}
                          style={styles.activeAvatar}
                        />
                      ) : (
                        <Text style={styles.activeAvatarLetter}>
                          {activeUser.name ? activeUser.name[0].toUpperCase() : 'U'}
                        </Text>
                      )}
                    </View>

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <Text style={[styles.activeUserName, !isDark && styles.activeUserNameLight]} numberOfLines={1}>
                          {activeUser.name || 'Friend'}
                        </Text>
                        {(activeUser?.isBot || activeUser?.name === 'Rivo Bot') && (
                          <View style={styles.botBadge}>
                            <Text style={styles.botBadgeText}>BOT</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.activeUserStatus, isOtherTyping && { color: '#17a398', fontWeight: '800' }]}>
                        {isOtherTyping ? 'typing...' : (activeUser?.isBot || activeUser?.name === 'Rivo Bot' ? 'SYSTEM BOT' : 'DIRECT MESSAGE')}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {!(activeUser?.isBot || activeUser?.name === 'Rivo Bot' || activeUser?.email === 'bot@rivo.app') && (
                    <TouchableOpacity
                      style={styles.headerJamInviteBtn}
                      onPress={handleInviteToJam}
                      activeOpacity={0.8}
                    >
                      <Radio size={12} color="#082621" />
                      <Text style={styles.headerJamInviteText}>JAM</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <View style={styles.hubHeaderRow}>
                  <View style={styles.hubIconBox}>
                    <MessageSquare size={16} color="#17a398" strokeWidth={2.5} />
                  </View>
                  <View>
                    <Text style={[styles.title, !isDark && styles.titleLight]}>DIRECT MESSAGES</Text>
                    <Text style={[styles.subTitle, !isDark && styles.subTitleLight]}>Chat with followed listeners</Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                onPress={onClose}
                style={[styles.closeBtn, !isDark && styles.closeBtnLight]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color={!isDark ? '#0b1110' : '#94a3b8'} />
              </TouchableOpacity>
            </View>

            {/* ── VIEW 1: CONVERSATIONS / FRIENDS HUB ── */}
            {!activeUser && (
              <View style={styles.hubContainer}>
                {/* Search Input */}
                <View style={[styles.searchBar, !isDark && styles.searchBarLight]}>
                  <Search size={15} color={!isDark ? '#0b1110' : '#64748b'} />
                  <TextInput
                    style={[styles.searchInput, !isDark && styles.searchInputLight]}
                    placeholder="Search followers / friends..."
                    placeholderTextColor={!isDark ? '#78716c' : '#64748b'}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>

                {/* Tabs Switcher: Chats vs Following */}
                <View style={[styles.tabSwitch, !isDark && styles.tabSwitchLight]}>
                  <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'chats' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('chats')}
                  >
                    <Text style={[styles.tabBtnText, !isDark && styles.tabBtnTextLight, activeTab === 'chats' && styles.tabBtnTextActive]}>
                      CHATS ({conversations.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'friends' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('friends')}
                  >
                    <Text style={[styles.tabBtnText, !isDark && styles.tabBtnTextLight, activeTab === 'friends' && styles.tabBtnTextActive]}>
                      FOLLOWING ({friends.length})
                    </Text>
                  </TouchableOpacity>
                </View>

                {loadingHub ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="small" color="#17a398" />
                  </View>
                ) : activeTab === 'chats' ? (
                  <FlatList
                    data={filteredConversations}
                    keyExtractor={(item, index) => item.user?._id || item.user?.id || String(index)}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={Platform.OS === 'android' ? 5 : 8}
                    maxToRenderPerBatch={Platform.OS === 'android' ? 3 : 6}
                    windowSize={Platform.OS === 'android' ? 3 : 5}
                    updateCellsBatchingPeriod={50}
                    removeClippedSubviews={Platform.OS === 'android'}
                    renderItem={({ item }) => (
                      <View style={[styles.userListItem, !isDark && styles.userListItemLight]}>
                        <TouchableOpacity
                          onPress={() => handleViewProfile(item.user)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.listAvatarWrap}>
                            {item.user?.avatar ? (
                              <Image
                                source={{ uri: normalizeCoverUri(item.user.avatar) }}
                                style={styles.listAvatar}
                                fadeDuration={0}
                              />
                            ) : (
                              <Text style={styles.listAvatarLetter}>
                                {item.user?.name ? item.user.name[0].toUpperCase() : 'U'}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ flex: 1 }}
                          onPress={() => setActiveUser(item.user)}
                          activeOpacity={0.7}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Text style={[styles.listUserName, !isDark && styles.listUserNameLight]} numberOfLines={1}>
                              {item.user?.name || 'Listener'}
                            </Text>
                            {(item.user?.isBot || item.user?.name === 'Rivo Bot') && (
                              <View style={styles.botBadge}>
                                <Text style={styles.botBadgeText}>BOT</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.listLastMsg} numberOfLines={1}>
                            {item.lastMessage?.text || 'Sent an attachment'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                    ListEmptyComponent={
                      <View style={styles.emptyBox}>
                        <Users size={32} color={!isDark ? '#a8a29e' : '#334155'} style={{ marginBottom: 8 }} />
                        <Text style={[styles.emptyTitle, !isDark && styles.emptyTitleLight]}>No active chats yet</Text>
                        <Text style={styles.emptyText}>
                          Select someone from Following to begin a direct conversation!
                        </Text>
                      </View>
                    }
                  />
                ) : (
                  <FlatList
                    data={filteredFriends}
                    keyExtractor={(item, index) => item._id || item.id || String(index)}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={Platform.OS === 'android' ? 6 : 10}
                    maxToRenderPerBatch={Platform.OS === 'android' ? 5 : 8}
                    windowSize={Platform.OS === 'android' ? 3 : 5}
                    updateCellsBatchingPeriod={50}
                    removeClippedSubviews={Platform.OS === 'android'}
                    renderItem={({ item }) => (
                      <View style={[styles.userListItem, !isDark && styles.userListItemLight]}>
                        <TouchableOpacity
                          onPress={() => handleViewProfile(item)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.listAvatarWrap}>
                            {item.avatar ? (
                              <Image
                                source={{ uri: normalizeCoverUri(item.avatar) }}
                                style={styles.listAvatar}
                                fadeDuration={0}
                              />
                            ) : (
                              <Text style={styles.listAvatarLetter}>
                                {item.name ? item.name[0].toUpperCase() : 'U'}
                              </Text>
                            )}
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={{ flex: 1 }}
                          onPress={() => setActiveUser(item)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.listUserName, !isDark && styles.listUserNameLight]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {item.bio ? (
                            <Text style={styles.listLastMsg} numberOfLines={1}>
                              {item.bio}
                            </Text>
                          ) : null}
                        </TouchableOpacity>
                      </View>
                    )}
                    ListEmptyComponent={
                      <View style={styles.emptyBox}>
                        <Users size={32} color={!isDark ? '#a8a29e' : '#334155'} style={{ marginBottom: 8 }} />
                        <Text style={[styles.emptyTitle, !isDark && styles.emptyTitleLight]}>Not following anyone yet</Text>
                        <Text style={styles.emptyText}>
                          Follow friends from their profiles or live listening radar!
                        </Text>
                      </View>
                    }
                  />
                )}
              </View>
            )}

            {/* ── VIEW 2: 1-ON-1 MESSAGES THREAD ── */}
            {activeUser && (
              <View style={styles.threadContainer}>
                {loadingMessages ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="small" color="#17a398" />
                  </View>
                ) : (
                  <FlatList
                    ref={flatListRef}
                    style={{ flex: 1 }}
                    data={messages}
                    keyExtractor={(item, index) => item._id || item.id || String(index)}
                    renderItem={renderMessage}
                    contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={(w, h) => {
                      flatListRef.current?.scrollToEnd({ animated: false });
                    }}
                    onLayout={() => {
                      flatListRef.current?.scrollToEnd({ animated: false });
                    }}
                    initialNumToRender={Platform.OS === 'android' ? 6 : 14}
                    maxToRenderPerBatch={Platform.OS === 'android' ? 4 : 12}
                    windowSize={Platform.OS === 'android' ? 3 : 5}
                    updateCellsBatchingPeriod={50}
                    removeClippedSubviews={Platform.OS === 'android'}
                    keyboardShouldPersistTaps="handled"
                    ListFooterComponent={
                      isOtherTyping ? (
                        <View style={styles.typingIndicatorRow}>
                          <View style={[styles.typingBubble, !isDark && styles.typingBubbleLight]}>
                            <View style={styles.typingDot} />
                            <View style={[styles.typingDot, { opacity: 0.7 }]} />
                            <View style={[styles.typingDot, { opacity: 0.4 }]} />
                            <Text style={[styles.typingIndicatorText, !isDark && { color: '#0b1110' }]}>
                              {activeUser.name || 'Friend'} is typing...
                            </Text>
                          </View>
                        </View>
                      ) : null
                    }
                    ListEmptyComponent={
                      <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>
                          No messages yet. Say hello to {activeUser.name}!
                        </Text>
                      </View>
                    }
                  />
                )}

                {/* Input Bar */}
                <View style={[styles.inputBar, !isDark && styles.inputBarLight]}>
                  {!(activeUser?.isBot || activeUser?.name === 'Rivo Bot' || activeUser?.email === 'bot@rivo.app') && (
                    <TouchableOpacity
                      style={[styles.inputJamBtn, !isDark && styles.inputJamBtnLight]}
                      onPress={handleInviteToJam}
                      activeOpacity={0.8}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Radio size={16} color={!isDark ? '#082621' : '#17a398'} />
                    </TouchableOpacity>
                  )}
                  <TextInput
                    style={[styles.textInput, !isDark && styles.textInputLight]}
                    placeholder={`Message ${activeUser.name}...`}
                    placeholderTextColor={!isDark ? '#78716c' : '#64748b'}
                    value={inputText}
                    onChangeText={handleInputChange}
                    onSubmitEditing={handleSend}
                  />
                  <TouchableOpacity
                    style={[styles.sendBtn, !inputText.trim() && { opacity: 0.5 }]}
                    onPress={handleSend}
                    disabled={!inputText.trim() || isSending}
                  >
                    {isSending ? (
                      <ActivityIndicator size="small" color="#0b1110" />
                    ) : (
                      <Send size={15} color="#0b1110" strokeWidth={2.5} />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  keyboardWrap: {
    width: '100%',
    height: '90%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  sheetCard: {
    flex: 1,
    backgroundColor: '#0e1715',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1.5,
    borderColor: '#263330',
    overflow: 'hidden',
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#263330',
  },
  hubHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  hubIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(23,163,152,0.18)',
    borderWidth: 1,
    borderColor: '#17a398',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.8,
  },
  subTitle: {
    fontSize: 10,
    color: '#94a3b8',
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#162220',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#263330',
  },
  activeUserHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  backBtn: {
    padding: 6,
    backgroundColor: '#162220',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#263330',
  },
  activeAvatarWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#17a398',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  activeAvatar: {
    width: '100%',
    height: '100%',
  },
  activeAvatarLetter: {
    color: '#0b1110',
    fontSize: 13,
    fontWeight: '900',
  },
  activeUserName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  activeUserStatus: {
    color: '#17a398',
    fontSize: 9,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hubContainer: {
    flex: 1,
    paddingTop: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141d1b',
    borderWidth: 1,
    borderColor: '#263330',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    padding: 0,
  },
  tabSwitch: {
    flexDirection: 'row',
    backgroundColor: '#141d1b',
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#263330',
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#17a398',
  },
  tabBtnText: {
    color: '#94a3b8',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tabBtnTextActive: {
    color: '#0b1110',
    fontWeight: '900',
  },
  userListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1c2826',
    gap: 12,
  },
  listAvatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#17a398',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  listAvatar: {
    width: '100%',
    height: '100%',
  },
  listAvatarLetter: {
    color: '#0b1110',
    fontSize: 15,
    fontWeight: '900',
  },
  listUserName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  listLastMsg: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  threadContainer: {
    flex: 1,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 4 : 2,
    borderTopWidth: 1,
    borderTopColor: '#263330',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#141d1b',
    borderWidth: 1,
    borderColor: '#263330',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: '#ffffff',
    fontSize: 13,
  },
  sendBtn: {
    backgroundColor: '#17a398',
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 4,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  headerJamInviteBtn: {
    backgroundColor: '#17a398',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerJamInviteText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: '#082621',
  },
  inputJamBtn: {
    backgroundColor: '#162421',
    borderWidth: 1,
    borderColor: '#263330',
    borderRadius: 10,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typingIndicatorRow: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b2a26',
    borderWidth: 1,
    borderColor: '#263d38',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#17a398',
  },
  typingIndicatorText: {
    fontSize: 11,
    color: '#94a3b8',
    marginLeft: 4,
    fontWeight: '600',
  },
  botBadge: {
    backgroundColor: '#17a398',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  botBadgeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '900',
    fontSize: 9,
    color: '#082621',
  },
  // ── Light Theme Adaptations ──
  sheetCardLight: {
    backgroundColor: '#f4ede1',
    borderColor: '#0b1110',
  },
  headerLight: {
    borderBottomColor: '#d6c8b0',
  },
  titleLight: {
    color: '#0b1110',
  },
  subTitleLight: {
    color: '#57534e',
  },
  closeBtnLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  backBtnLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  activeUserNameLight: {
    color: '#0b1110',
  },
  searchBarLight: {
    backgroundColor: '#fdfbf7',
    borderColor: '#0b1110',
  },
  searchInputLight: {
    color: '#0b1110',
  },
  tabSwitchLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  tabBtnTextLight: {
    color: '#57534e',
  },
  userListItemLight: {
    borderBottomColor: '#e7ddcb',
  },
  listUserNameLight: {
    color: '#0b1110',
  },
  emptyTitleLight: {
    color: '#0b1110',
  },
  inputBarLight: {
    borderTopColor: '#d6c8b0',
  },
  inputJamBtnLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
  },
  textInputLight: {
    backgroundColor: '#fdfbf7',
    borderColor: '#0b1110',
    color: '#0b1110',
  },
  typingBubbleLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#d6c8b0',
  },
});
