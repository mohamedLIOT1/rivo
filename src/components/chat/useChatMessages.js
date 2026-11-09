import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../../config';
import { getToken, isWindowActiveAndFocused, apiSendChatMessage } from './chatHelpers';
import { useChatScroll } from './useChatScroll';

export { getToken, isWindowActiveAndFocused } from './chatHelpers';

export function useChatMessages({
  isOpen,
  activeUser,
  currentUser,
  socket,
  setUnreadChatCount,
  onStartJamWithUser,
  fetchHubData
}) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);

  const typingTimeoutRef = useRef(null);
  const myTypingTimeoutRef = useRef(null);

  const activeUserId = activeUser?.id || activeUser?._id;

  const {
    messagesEndRef,
    messagesContainerRef,
    scrollToBottom,
    scheduleScrollToBottom
  } = useChatScroll({
    isOpen,
    activeUserId,
    messagesCount: messages.length,
    loading,
    loadingEarlier
  });

  const markCurrentChatAsRead = useCallback(() => {
    if (!isOpen || !activeUserId || !isWindowActiveAndFocused()) return;

    if (socket && socket.connected) {
      socket.emit('chat:mark_read', { senderId: activeUserId });
    }
    const token = getToken();
    if (token) {
      fetch(`${API_BASE_URL}/api/chat/${activeUserId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {});

      if (setUnreadChatCount) {
        fetch(`${API_BASE_URL}/api/chat/unread-count`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then((res) => res.json())
          .then((data) => {
            if (data && typeof data.count === 'number') {
              setUnreadChatCount(data.count);
            }
          })
          .catch(() => {});
      }
    }
  }, [isOpen, activeUserId, socket, setUnreadChatCount]);

  // Window visibility & focus listener for seen receipt
  useEffect(() => {
    if (!isOpen || !activeUser) return;
    const handleFocusOrVisible = () => markCurrentChatAsRead();

    window.addEventListener('visibilitychange', handleFocusOrVisible);
    window.addEventListener('focus', handleFocusOrVisible);
    return () => {
      window.removeEventListener('visibilitychange', handleFocusOrVisible);
      window.removeEventListener('focus', handleFocusOrVisible);
    };
  }, [isOpen, activeUser, markCurrentChatAsRead]);

  // Load message history when activeUser changes
  useEffect(() => {
    if (!isOpen || !activeUserId) return;

    setMessages([]);
    setHasMore(false);
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const token = getToken();
        const shouldMark = isWindowActiveAndFocused();
        const markQuery = shouldMark ? '&markRead=1' : '';
        const res = await fetch(`${API_BASE_URL}/api/chat/${activeUserId}?limit=40${markQuery}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setMessages(data.messages || []);
          setHasMore(Boolean(data.hasMore));
        } else {
          setMessages([]);
          setHasMore(false);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
        setMessages([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
    if (socket && isWindowActiveAndFocused()) {
      socket.emit('chat:mark_read', { senderId: activeUserId });
    }
    const token = getToken();
    if (token && setUnreadChatCount) {
      fetch(`${API_BASE_URL}/api/chat/unread-count`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then((res) => res.json())
        .then((data) => {
          if (data && typeof data.count === 'number') {
            setUnreadChatCount(data.count);
          }
        })
        .catch(() => {});
    }
  }, [isOpen, activeUserId, socket, setUnreadChatCount]);

  const loadEarlierMessages = async () => {
    if (loadingEarlier || !hasMore || messages.length === 0 || !activeUserId) return;

    const oldest = messages[0];
    if (!oldest?.createdAt) return;

    setLoadingEarlier(true);
    const scrollContainer = messagesContainerRef.current;
    const oldScrollHeight = scrollContainer ? scrollContainer.scrollHeight : 0;

    try {
      const token = getToken();
      const res = await fetch(
        `${API_BASE_URL}/api/chat/${activeUserId}?limit=40&before=${encodeURIComponent(oldest.createdAt)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (data?.success && Array.isArray(data.messages)) {
        setMessages((prev) => [...data.messages, ...prev]);
        setHasMore(Boolean(data.hasMore));

        setTimeout(() => {
          if (scrollContainer) {
            const newScrollHeight = scrollContainer.scrollHeight;
            scrollContainer.scrollTop = newScrollHeight - oldScrollHeight;
          }
        }, 40);
      } else {
        setHasMore(false);
      }
    } catch (e) {
      console.error('Failed to load earlier messages:', e);
    } finally {
      setLoadingEarlier(false);
    }
  };

  const toggleReaction = async (messageId, emoji) => {
    if (!messageId || !emoji) return;
    const myId = String(currentUser?.id || currentUser?._id || '');
    if (!myId) return;

    setMessages((prev) =>
      prev.map((m) => {
        if (String(m._id) !== String(messageId)) return m;
        const existing = Array.isArray(m.reactions) ? [...m.reactions] : [];
        const idx = existing.findIndex((r) => String(r.userId) === myId && r.emoji === emoji);
        if (idx >= 0) {
          existing.splice(idx, 1);
        } else {
          existing.push({ emoji, userId: myId });
        }
        return { ...m, reactions: existing };
      })
    );

    if (socket && socket.connected) {
      socket.emit('chat:reaction', { messageId, emoji });
    } else {
      try {
        const token = getToken();
        if (token) {
          fetch(`${API_BASE_URL}/api/chat/react`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ messageId, emoji })
          }).catch(() => {});
        }
      } catch {}
    }
  };

  // Socket listener for chat messages, seen receipts, typing, reactions
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg) => {
      const myId = String(currentUser?.id || currentUser?._id || '');
      const activeId = String(activeUser?.id || activeUser?._id || '');
      const isBotMsg = Boolean(msg.isBot || msg.senderName === 'Rivo Bot');
      const isTargetBot = Boolean(activeUser?.isBot || activeUser?.name === 'Rivo Bot' || activeUser?.email === 'bot@rivo.app');

      if ((isBotMsg && !isTargetBot) || (!isBotMsg && isTargetBot)) {
        // Ignore
      } else if (
        (String(msg.sender) === activeId && String(msg.recipient) === myId) ||
        (String(msg.sender) === myId && String(msg.recipient) === activeId)
      ) {
        setMessages((prev) => {
          if (prev.some((m) => String(m._id) === String(msg._id))) return prev;
          return [...prev, msg];
        });

        if (String(msg.sender) === activeId && isWindowActiveAndFocused()) {
          socket.emit('chat:mark_read', { senderId: activeId });
        }
      }
    };

    const handleSeen = (data) => {
      const myId = String(currentUser?.id || currentUser?._id || '');
      const activeId = String(activeUser?.id || activeUser?._id || '');
      if (String(data.seenBy) === activeId) {
        setMessages((prev) =>
          prev.map((m) => (String(m.sender) === myId ? { ...m, read: true } : m))
        );
      }
    };

    const handleTyping = (data) => {
      const activeId = String(activeUser?.id || activeUser?._id || '');
      if (String(data?.senderId) === activeId) {
        setIsOtherTyping(Boolean(data?.isTyping));
        if (data?.isTyping) {
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            setIsOtherTyping(false);
          }, 3500);
        }
      }
    };

    const handleReactionUpdated = (data) => {
      if (!data?.messageId) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(data.messageId)
            ? { ...m, reactions: data.reactions }
            : m
        )
      );
    };

    socket.on('chat:message', handleMessage);
    socket.on('chat:seen', handleSeen);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:reaction_updated', handleReactionUpdated);
    return () => {
      socket.off('chat:message', handleMessage);
      socket.off('chat:seen', handleSeen);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:reaction_updated', handleReactionUpdated);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
    };
  }, [socket, activeUser?.id, activeUser?._id, currentUser?.id, currentUser?._id]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || sending || !activeUser) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const data = await apiSendChatMessage({
        recipientId: activeUser.id || activeUser._id,
        text
      });
      if (data.success && data.message) {
        const activeId = String(activeUser.id || activeUser._id || '');
        const msgRecipient = String(data.message.recipient || '');
        const msgSender = String(data.message.sender || '');
        if (msgRecipient === activeId || msgSender === activeId) {
          setMessages((prev) => {
            if (prev.some((m) => String(m._id) === String(data.message._id))) return prev;
            return [...prev, data.message];
          });
          scheduleScrollToBottom();
        } else {
          fetchHubData?.();
        }
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
    setSending(false);
  };

  const handleSendJamInvite = async () => {
    if (!activeUser) return;
    setSending(true);
    let roomCode = null;
    if (onStartJamWithUser) {
      roomCode = await onStartJamWithUser(activeUser);
    }
    if (!roomCode) {
      roomCode = `JAM-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    try {
      const data = await apiSendChatMessage({
        recipientId: activeUser.id || activeUser._id,
        text: `🎧 I started a Jam Session! Come join me to listen together in sync.`,
        jamInvite: {
          roomCode,
          hostName: currentUser?.name || 'Friend',
          hostAvatar: currentUser?.avatar || ''
        }
      });
      if (data.success && data.message) {
        setMessages((prev) => {
          if (prev.some((m) => String(m._id) === String(data.message._id))) return prev;
          return [...prev, data.message];
        });
        scheduleScrollToBottom();
      }
    } catch (err) {
      console.error('Failed to send Jam invite:', err);
    }
    setSending(false);
  };

  return {
    messages,
    inputText,
    setInputText,
    loading,
    sending,
    isOtherTyping,
    hasMore,
    loadingEarlier,
    messagesEndRef,
    messagesContainerRef,
    myTypingTimeoutRef,
    markCurrentChatAsRead,
    loadEarlierMessages,
    toggleReaction,
    handleSendMessage,
    handleSendJamInvite,
    scrollToBottom
  };
}
