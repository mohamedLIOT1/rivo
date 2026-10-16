import React, { useState, useEffect, useRef } from 'react';
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
import { X, Send, MessageSquare, ArrowLeft, Search, User, Users, CheckCheck, Check, Radio, Headphones, Sparkles } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSocket } from '../context/SocketContext';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { API_BASE_URL } from '../config';
import { normalizeCoverUri } from '../utils/coverUtils';

export default function ChatModal({ visible, onClose, initialTargetUser = null, onOpenJam = null, onViewProfile = null }) {
  const { socket, jamSession, joinJam } = useSocket();
  const { currentUser, token } = useUser();
  const { showToast } = useToast();

  const [activeUser, setActiveUser] = useState(initialTargetUser);
  const [conversations, setConversations] = useState([]);
  const [friends, setFriends] = useState([]);
  const [messages, setMessages] = useState([]);
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

  useEffect(() => {
    if (initialTargetUser) {
      setActiveUser(initialTargetUser);
    }
  }, [initialTargetUser]);

  useEffect(() => {
    if (visible && !activeUser) {
      fetchHubData();
    }
  }, [visible, activeUser]);

  // Load conversations and friends
  const fetchHubData = async () => {
    setLoadingHub(true);
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
          setConversations(convData.conversations || []);
        }
      }

      if (friendsRes && friendsRes.ok) {
        const friendsData = await friendsRes.json();
        if (friendsData.success) {
          setFriends(friendsData.friends || []);
        }
      }
    } catch {}
    setLoadingHub(false);
  };

  // Load message history with active user & mark thread as read
  useEffect(() => {
    const activeUserId = activeUser?._id || activeUser?.id;
    if (!visible || !activeUserId) return;

    fetchMessages(activeUserId);
    if (socket) {
      socket.emit('chat:mark_read', { senderId: activeUserId });
    }
  }, [visible, activeUser, socket]);

  const fetchMessages = async (userId) => {
    setLoadingMessages(true);
    try {
      const activeToken = token || (await AsyncStorage.getItem('@rivo_auth_token_v2'));
      const res = await fetch(`${API_BASE_URL}/api/chat/${userId}`, {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setMessages(data.messages || []);
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

          // Deduplicate: If this message matches my own pending temp message, replace it instead of appending!
          const tempIdx = prev.findIndex(
            (m) =>
              m._id &&
              String(m._id).startsWith('temp-') &&
              String(m.sender) === String(msg.sender) &&
              String(m.recipient) === String(msg.recipient) &&
              (m.text === msg.text || (m.jamInvite?.roomCode && m.jamInvite.roomCode === msg.jamInvite?.roomCode))
          );
          if (tempIdx !== -1) {
            const updated = [...prev];
            updated[tempIdx] = msg;
            return updated;
          }

          return [...prev, msg];
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

  const handleInputChange = (val) => {
    setInputText(val);
    const activeUserId = activeUser?._id || activeUser?.id;
    if (socket && activeUserId) {
      socket.emit('chat:typing', { recipientId: activeUserId, isTyping: true });
      if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
      myTypingTimeoutRef.current = setTimeout(() => {
        socket.emit('chat:typing', { recipientId: activeUserId, isTyping: false });
      }, 2500);
    }
  };

  const handleSend = async () => {
    const text = inputText.trim();
    const activeUserId = activeUser?._id || activeUser?.id;
    if (!text || !activeUserId || isSending) return;

    if (socket && activeUserId) {
      socket.emit('chat:typing', { recipientId: activeUserId, isTyping: false });
    }
    if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);

    setIsSending(true);
    setInputText('');

    const tempMsg = {
      _id: `temp-${Date.now()}`,
      sender: currentUser?._id || currentUser?.id,
      recipient: activeUserId,
      text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

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
          setMessages((prev) => {
            const hasReal = prev.some((m) => String(m._id || m.id) === String(data.message._id));
            if (hasReal) {
              return prev.filter((m) => m._id !== tempMsg._id);
            }
            return prev.map((m) => (m._id === tempMsg._id ? data.message : m));
          });
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

  const renderMessage = ({ item }) => {
    const myId = String(currentUser?._id || currentUser?.id || '');
    const isMe = String(item.sender) === myId;
    const timeStr = item.createdAt
      ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <View style={[styles.msgRow, isMe ? styles.myMsgRow : styles.otherMsgRow]}>
        <View style={{ alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
          <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
            {item.jamInvite?.roomCode ? (
              <View style={styles.jamInviteCard}>
                <View style={styles.jamInviteHeader}>
                  <Radio size={13} color="#17a398" />
                  <Text style={styles.jamInviteTag}>JAM SESSION INVITE</Text>
                </View>
                <Text style={styles.jamInviteCode}>{item.jamInvite.roomCode}</Text>
                <Text style={styles.jamInviteSub}>Tap to join and listen together in sync</Text>
                <TouchableOpacity
                  style={styles.jamInviteJoinBtn}
                  onPress={() => {
                    joinJam(item.jamInvite.roomCode);
                    if (onOpenJam) {
                      onOpenJam();
                    }
                  }}
                  activeOpacity={0.85}
                >
                  <Headphones size={13} color="#082621" />
                  <Text style={styles.jamInviteJoinBtnText}>JOIN JAM NOW</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={[styles.msgText, isMe ? styles.myMsgText : styles.otherMsgText]}>
                {item.text}
              </Text>
            )}
          </View>
          <View style={[styles.msgMetaRow, isMe ? styles.myMetaRow : styles.otherMetaRow]}>
            {timeStr ? <Text style={styles.msgTimeText}>{timeStr}</Text> : null}
            {isMe && (
              item.read ? (
                <View style={styles.seenBadge}>
                  <CheckCheck size={12} color="#26c4b7" strokeWidth={2.4} />
                  <Text style={styles.seenText}>Seen</Text>
                </View>
              ) : (
                <View style={styles.sentBadge}>
                  <Check size={11} color="#64748b" strokeWidth={2.0} />
                  <Text style={styles.sentText}>Sent</Text>
                </View>
              )
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardWrap}
        >
          <View style={styles.sheetCard}>
            {/* ── HEADER ── */}
            <View style={styles.header}>
              {activeUser ? (
                <View style={styles.activeUserHeaderRow}>
                  <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => setActiveUser(null)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <ArrowLeft size={18} color="#17a398" strokeWidth={2.5} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0, marginRight: 8 }}
                    onPress={() => {
                      if (onViewProfile) {
                        onViewProfile(activeUser);
                        onClose();
                      }
                    }}
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
                      <Text style={styles.activeUserName} numberOfLines={1}>
                        {activeUser.name || 'Friend'}
                      </Text>
                      <Text style={[styles.activeUserStatus, isOtherTyping && { color: '#17a398', fontWeight: '800' }]}>
                        {isOtherTyping ? 'typing...' : 'DIRECT MESSAGE'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.headerJamInviteBtn}
                    onPress={handleInviteToJam}
                    activeOpacity={0.8}
                  >
                    <Radio size={12} color="#082621" />
                    <Text style={styles.headerJamInviteText}>JAM</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.hubHeaderRow}>
                  <View style={styles.hubIconBox}>
                    <MessageSquare size={16} color="#17a398" strokeWidth={2.5} />
                  </View>
                  <View>
                    <Text style={styles.title}>DIRECT MESSAGES</Text>
                    <Text style={styles.subTitle}>Chat with followed listeners</Text>
                  </View>
                </View>
              )}

              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={18} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* ── VIEW 1: CONVERSATIONS / FRIENDS HUB ── */}
            {!activeUser && (
              <View style={styles.hubContainer}>
                {/* Search Input */}
                <View style={styles.searchBar}>
                  <Search size={15} color="#64748b" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search followers / friends..."
                    placeholderTextColor="#64748b"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                </View>

                {/* Tabs Switcher: Chats vs Following */}
                <View style={styles.tabSwitch}>
                  <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'chats' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('chats')}
                  >
                    <Text style={[styles.tabBtnText, activeTab === 'chats' && styles.tabBtnTextActive]}>
                      CHATS ({conversations.length})
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'friends' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('friends')}
                  >
                    <Text style={[styles.tabBtnText, activeTab === 'friends' && styles.tabBtnTextActive]}>
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
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.userListItem}
                        onPress={() => setActiveUser(item.user)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.listAvatarWrap}>
                          {item.user?.avatar ? (
                            <Image
                              source={{ uri: normalizeCoverUri(item.user.avatar) }}
                              style={styles.listAvatar}
                            />
                          ) : (
                            <Text style={styles.listAvatarLetter}>
                              {item.user?.name ? item.user.name[0].toUpperCase() : 'U'}
                            </Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.listUserName} numberOfLines={1}>
                            {item.user?.name || 'Listener'}
                          </Text>
                          <Text style={styles.listLastMsg} numberOfLines={1}>
                            {item.lastMessage?.text || 'Sent an attachment'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <View style={styles.emptyBox}>
                        <Users size={32} color="#334155" style={{ marginBottom: 8 }} />
                        <Text style={styles.emptyTitle}>No active chats yet</Text>
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
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.userListItem}
                        onPress={() => setActiveUser(item)}
                        activeOpacity={0.8}
                      >
                        <View style={styles.listAvatarWrap}>
                          {item.avatar ? (
                            <Image
                              source={{ uri: normalizeCoverUri(item.avatar) }}
                              style={styles.listAvatar}
                            />
                          ) : (
                            <Text style={styles.listAvatarLetter}>
                              {item.name ? item.name[0].toUpperCase() : 'U'}
                            </Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.listUserName} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {item.bio ? (
                            <Text style={styles.listLastMsg} numberOfLines={1}>
                              {item.bio}
                            </Text>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      <View style={styles.emptyBox}>
                        <Users size={32} color="#334155" style={{ marginBottom: 8 }} />
                        <Text style={styles.emptyTitle}>Not following anyone yet</Text>
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
                    data={messages}
                    keyExtractor={(item, index) => item._id || item.id || String(index)}
                    renderItem={renderMessage}
                    contentContainerStyle={{ paddingVertical: 12 }}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                    ListFooterComponent={
                      isOtherTyping ? (
                        <View style={styles.typingIndicatorRow}>
                          <View style={styles.typingBubble}>
                            <View style={styles.typingDot} />
                            <View style={[styles.typingDot, { opacity: 0.7 }]} />
                            <View style={[styles.typingDot, { opacity: 0.4 }]} />
                            <Text style={styles.typingIndicatorText}>{activeUser.name || 'Friend'} is typing...</Text>
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
                <View style={styles.inputBar}>
                  <TouchableOpacity
                    style={styles.inputJamBtn}
                    onPress={handleInviteToJam}
                    activeOpacity={0.8}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <Radio size={16} color="#17a398" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.textInput}
                    placeholder={`Message ${activeUser.name}...`}
                    placeholderTextColor="#64748b"
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
  msgRow: {
    marginVertical: 4,
    flexDirection: 'row',
  },
  myMsgRow: {
    justifyContent: 'flex-end',
  },
  otherMsgRow: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '100%',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
  },
  myBubble: {
    backgroundColor: '#17a398',
    borderBottomRightRadius: 3,
  },
  otherBubble: {
    backgroundColor: '#1a2725',
    borderWidth: 1.5,
    borderColor: '#263330',
    borderBottomLeftRadius: 3,
  },
  msgMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    paddingHorizontal: 2,
  },
  myMetaRow: {
    justifyContent: 'flex-end',
  },
  otherMetaRow: {
    justifyContent: 'flex-start',
  },
  msgTimeText: {
    fontSize: 9.5,
    color: '#64748b',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  seenBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seenText: {
    fontSize: 9.5,
    color: '#26c4b7',
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  sentText: {
    fontSize: 9,
    color: '#64748b',
  },
  msgText: {
    fontSize: 13,
    lineHeight: 18,
  },
  myMsgText: {
    color: '#0b1110',
    fontWeight: '700',
  },
  otherMsgText: {
    color: '#ffffff',
    fontWeight: '500',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
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
  jamInviteCard: {
    backgroundColor: '#111c19',
    borderWidth: 1.5,
    borderColor: '#263d38',
    borderRadius: 12,
    padding: 10,
    minWidth: 190,
  },
  jamInviteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  jamInviteTag: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '900',
    fontSize: 9,
    color: '#17a398',
    letterSpacing: 0.5,
  },
  jamInviteCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '900',
    fontSize: 18,
    color: '#f59e0b',
    letterSpacing: 1,
    marginBottom: 2,
  },
  jamInviteSub: {
    fontSize: 10,
    color: '#94a3b8',
    marginBottom: 8,
  },
  jamInviteJoinBtn: {
    backgroundColor: '#17a398',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  jamInviteJoinBtnText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: '#082621',
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
});
