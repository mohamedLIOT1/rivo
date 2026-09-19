import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Radio, Music, Loader2, User, Search, MessageSquare, ArrowLeft, Users, Disc } from 'lucide-react';
import { API_BASE_URL } from '../config';
import VerifiedBadge from './VerifiedBadge';

export default function ChatModal({
  isOpen,
  onClose,
  targetUser,
  currentUser,
  socket,
  onStartJamWithUser,
  onPlayTrack,
  globalTheme = 'dark'
}) {
  const isDark = globalTheme === 'dark' || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
  const [activeUser, setActiveUser] = useState(targetUser || null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  // Conversations Hub state
  const [conversations, setConversations] = useState([]);
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loadingHub, setLoadingHub] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [activeTab, setActiveTab] = useState('chats'); // 'chats' | 'friends'

  // Sync activeUser if targetUser prop changes
  useEffect(() => {
    if (targetUser) {
      setActiveUser(targetUser);
    }
  }, [targetUser]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Load Conversations and Friends when in hub mode
  const fetchHubData = async () => {
    setLoadingHub(true);
    try {
      const token = localStorage.getItem('liofy_token');
      const [convRes, friendsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/chat/conversations`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => null),
        fetch(`${API_BASE_URL}/api/users/friends`, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(() => null)
      ]);

      if (convRes && convRes.ok) {
        const convData = await convRes.json();
        if (convData.success) setConversations(convData.conversations || []);
      }
      if (friendsRes && friendsRes.ok) {
        const friendsData = await friendsRes.json();
        if (friendsData.success) setFriends(friendsData.friends || []);
      }
    } catch (e) {
      console.warn('Failed to load chat hub data:', e);
    }
    setLoadingHub(false);
  };

  useEffect(() => {
    if (isOpen && !activeUser) {
      fetchHubData();
    }
  }, [isOpen, activeUser]);

  // Load message history when an active direct chat user is chosen
  useEffect(() => {
    if (!isOpen || !activeUser?.id) return;

    const fetchHistory = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('liofy_token');
        const res = await fetch(`${API_BASE_URL}/api/chat/${activeUser.id}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      }
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    };

    fetchHistory();
  }, [isOpen, activeUser?.id]);

  // Search users to start new chat
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingUsers(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/users/search?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await res.json();
        if (data.success) {
          const myId = String(currentUser?.id || currentUser?._id || '');
          setSearchResults((data.users || []).filter(u => String(u.id || u._id) !== myId));
        }
      } catch (e) {
        console.warn('User search error:', e);
      }
      setIsSearchingUsers(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, currentUser?.id, currentUser?._id]);

  // Listen to real-time incoming socket messages
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (msg) => {
      const myId = String(currentUser?.id || currentUser?._id || '');
      const activeId = String(activeUser?.id || activeUser?._id || '');

      if (
        (String(msg.sender) === activeId && String(msg.recipient) === myId) ||
        (String(msg.sender) === myId && String(msg.recipient) === activeId)
      ) {
        setMessages((prev) => {
          if (prev.some((m) => String(m._id) === String(msg._id))) return prev;
          return [...prev, msg];
        });
        setTimeout(scrollToBottom, 100);
      }

      // Update conversations list in real-time
      setConversations((prev) => {
        const otherId = String(msg.sender) === myId ? String(msg.recipient) : String(msg.sender);
        const exists = prev.find(c => String(c.user?.id) === otherId);
        if (exists) {
          return [
            { ...exists, lastMessage: msg },
            ...prev.filter(c => String(c.user?.id) !== otherId)
          ];
        }
        return prev;
      });
    };

    socket.on('chat:message', handleMessage);
    return () => socket.off('chat:message', handleMessage);
  }, [socket, activeUser?.id, currentUser?.id, currentUser?._id]);

  if (!isOpen) return null;

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || sending || !activeUser) return;

    const text = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const token = localStorage.getItem('liofy_token');
      const res = await fetch(`${API_BASE_URL}/api/chat/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          recipientId: activeUser.id || activeUser._id,
          text
        })
      });
      const data = await res.json();
      if (data.success && data.message) {
        setMessages((prev) => {
          if (prev.some((m) => String(m._id) === String(data.message._id))) return prev;
          return [...prev, data.message];
        });
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
    }
    setSending(false);
  };

  const handleSendJamInvite = async () => {
    if (onStartJamWithUser && activeUser) {
      onStartJamWithUser(activeUser);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none">
      <div className={`rounded-2xl w-full max-w-lg md:max-w-xl h-[620px] flex flex-col brutal-shadow-lg overflow-hidden animate-in zoom-in-95 duration-200 ${
        isDark ? 'bg-[#121212] text-white border-2 border-zinc-800' : 'bg-[#fdfbf7] text-[#0b1110] brutal-border-thick'
      }`}>
        
        {/* ─────────────────────────────────────────
            HEADER: CHAT HEADER
            ───────────────────────────────────────── */}
        <div className={`p-3.5 flex items-center justify-between shrink-0 border-b-2 ${
          isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-[#0b1110] border-black text-[#fdfbf7]'
        }`}>
          <div className="flex items-center gap-2.5 min-w-0">
            {activeUser ? (
              <button
                onClick={() => {
                  setActiveUser(null);
                  fetchHubData();
                }}
                className={`w-8 h-8 rounded-lg flex items-center justify-center brutal-btn cursor-pointer mr-1 brutal-border ${
                  isDark ? 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700' : 'bg-[#fdfbf7] text-[#0b1110]'
                }`}
                title="Back to Chats"
              >
                <ArrowLeft size={16} strokeWidth={2.5} />
              </button>
            ) : null}

            {/* Profile Avatar */}
            {activeUser?.avatar ? (
              <img 
                src={activeUser.avatar} 
                alt={activeUser.name} 
                className="w-8 h-8 rounded-lg object-cover brutal-border shrink-0 shadow-sm" 
              />
            ) : activeUser ? (
              <div className="w-8 h-8 rounded-lg bg-[#17a398] text-[#0b1110] brutal-border flex items-center justify-center font-display font-black text-sm shrink-0">
                {activeUser.name?.[0]?.toUpperCase() || 'U'}
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-[#17a398] text-[#0b1110] brutal-border flex items-center justify-center font-display font-black text-sm shrink-0">
                <MessageSquare size={16} />
              </div>
            )}

            <div className="truncate">
              <div className="flex items-center gap-1.5 truncate">
                <h3 className="font-display font-bold text-sm leading-none text-white truncate">
                  {activeUser ? activeUser.name : 'Chat'}
                </h3>
                {activeUser && <VerifiedBadge userOrName={activeUser} size={13} />}
              </div>
              <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">
                {activeUser ? 'Direct Chat' : 'Messages & Friends'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeUser && (
              <button
                onClick={handleSendJamInvite}
                className="px-2.5 py-1 rounded bg-[#f59e0b] text-[#0b1110] font-display font-black text-[11px] brutal-border brutal-shadow-sm brutal-btn flex items-center gap-1 cursor-pointer"
                title="Invite to Jam"
              >
                <Radio size={12} className="animate-pulse" strokeWidth={2.5} />
                <span>Jam Invite</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            >
              <X size={17} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* ─────────────────────────────────────────
            SUB-HEADER TABS (WHEN IN HUB MODE)
            ───────────────────────────────────────── */}
        {!activeUser && (
          <div className={`p-2 border-b-2 flex gap-1.5 overflow-x-auto text-xs font-display font-bold shrink-0 ${
            isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-[#ded2bb] border-black'
          }`}>
            <button
              onClick={() => setActiveTab('chats')}
              className={`px-3 py-1 rounded brutal-border transition ${
                activeTab === 'chats' 
                  ? (isDark ? 'bg-[#17a398] text-black font-black brutal-shadow-sm' : 'bg-[#0b1110] text-white brutal-shadow-sm') 
                  : (isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700' : 'bg-white text-[#0b1110]')
              }`}
            >
              Chats ({conversations.length})
            </button>
            <button
              onClick={() => setActiveTab('friends')}
              className={`px-3 py-1 rounded brutal-border transition ${
                activeTab === 'friends' 
                  ? (isDark ? 'bg-[#17a398] text-black font-black brutal-shadow-sm' : 'bg-[#0b1110] text-white brutal-shadow-sm') 
                  : (isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700' : 'bg-white text-[#0b1110]')
              }`}
            >
              Friends ({friends.length})
            </button>
          </div>
        )}

        {/* ─────────────────────────────────────────
            BODY: DIRECT CHAT OR CONVERSATIONS HUB
            ───────────────────────────────────────── */}
        {activeUser ? (
          <>
            {/* Messages Stream */}
            <div className={`flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3 ${
              isDark ? 'bg-[#121212]' : 'bg-[#fdfbf7] paper-texture'
            }`}>
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={26} className="animate-spin text-[#17a398]" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 brutal-shadow-sm brutal-border ${
                    isDark ? 'bg-zinc-800 text-white border-zinc-700' : 'bg-[#ede5d3] text-[#0b1110]'
                  }`}>
                    <MessageSquare size={28} />
                  </div>
                  <p className={`text-base font-display font-black ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>No messages yet</p>
                  <p className={`text-xs font-medium mt-1 max-w-xs leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    Say hello, share music, or invite {activeUser.name} to a Jam session!
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = String(msg.sender) === String(currentUser?.id || currentUser?._id);
                  const timeFormatted = msg.createdAt
                    ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'NOW';

                  return (
                    <div
                      key={msg._id || idx}
                      className={`flex flex-col ${isMe ? 'items-end max-w-[85%] ml-auto' : 'items-start max-w-[85%]'}`}
                    >
                      <div
                        className={`p-3 rounded-xl brutal-border brutal-shadow-sm space-y-1 ${
                          isMe
                            ? 'bg-[#17a398] text-[#082621] font-bold rounded-tr-none'
                            : isDark
                              ? 'bg-zinc-800 text-white font-bold border-zinc-700 rounded-tl-none'
                              : 'bg-white text-[#0b1110] font-bold rounded-tl-none'
                        }`}
                      >
                        {/* Message Meta Header */}
                        <div className={`flex items-center justify-between border-b pb-1 mb-1 font-mono text-[10px] gap-4 ${
                          isMe 
                            ? 'border-black/20 text-[#082621]/80 font-bold' 
                            : isDark ? 'border-zinc-700 text-zinc-400' : 'border-dashed border-zinc-300 text-zinc-500'
                        }`}>
                          <span>{isMe ? (currentUser?.name || 'You') : (activeUser.name || 'Friend')}</span>
                          <span>{timeFormatted}</span>
                        </div>

                        {/* Bolder Chat Text */}
                        {msg.text && (
                          <p className="break-words font-bold text-[13.5px] md:text-[14px] leading-snug tracking-normal">
                            {msg.text}
                          </p>
                        )}

                        {/* Track attached */}
                        {msg.track && (
                          <div
                            onClick={() => onPlayTrack && onPlayTrack(msg.track)}
                            className={`mt-2 p-2 rounded-lg brutal-border flex items-center justify-between gap-2.5 cursor-pointer transition ${
                              isDark 
                                ? 'bg-zinc-900 border-zinc-700 hover:bg-zinc-850' 
                                : 'bg-white hover:bg-[#ede5d3]'
                            }`}
                          >
                            <img
                              src={msg.track.cover}
                              alt=""
                              className="w-10 h-10 rounded brutal-border object-cover shrink-0"
                            />
                            <div className="truncate flex-1 min-w-0">
                              <span className="text-[8px] font-mono font-bold bg-[#f59e0b] px-1 rounded text-black">
                                SHARED TRACK
                              </span>
                              <p className={`text-xs font-display font-black truncate mt-0.5 ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
                                {msg.track.title}
                              </p>
                              <p className={`text-[10px] font-bold truncate ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                {msg.track.artist}
                              </p>
                            </div>
                            <div className="w-7 h-7 rounded bg-[#17a398] brutal-border flex items-center justify-center shrink-0">
                              <Music size={13} className="text-[#0b1110]" />
                            </div>
                          </div>
                        )}
                      </div>

                      <span className="text-[9px] font-mono text-zinc-500 mt-1 px-1 font-medium">
                        {timeFormatted}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Field */}
            <div className={`p-3 border-t-2 shrink-0 ${
              isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-[#ded2bb] border-black'
            }`}>
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Type a message for ${activeUser.name}...`}
                  className={`flex-1 text-xs font-bold px-3 py-2.5 rounded-lg brutal-border focus:outline-none focus:ring-2 focus:ring-[#17a398] ${
                    isDark 
                      ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500' 
                      : 'bg-white border-black text-[#0b1110]'
                  }`}
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || sending}
                  className="bg-[#17a398] hover:bg-[#26c4b7] text-black px-4 py-2 rounded-lg font-display font-black text-xs brutal-border brutal-shadow-sm brutal-btn flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  {sending ? (
                    <Loader2 size={14} className="animate-spin text-black" />
                  ) : (
                    <Send size={14} className="text-black" strokeWidth={2.5} />
                  )}
                  <span>Send</span>
                </button>
              </form>
            </div>
          </>
        ) : (
          /* ── Conversations & Friends Hub ── */
          <div className={`flex-1 flex flex-col overflow-hidden p-3.5 sm:p-4 ${
            isDark ? 'bg-[#121212]' : 'bg-[#fdfbf7] paper-texture'
          }`}>
            {/* Search Input */}
            <div className="relative mb-3 shrink-0">
              <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`} strokeWidth={2.5} />
              <input
                type="text"
                placeholder="Search friends or conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full brutal-border rounded-xl pl-10 pr-4 py-2 text-xs font-bold focus:outline-none brutal-shadow-sm ${
                  isDark 
                    ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500' 
                    : 'bg-white border-black text-[#0b1110] placeholder-zinc-500'
                }`}
              />
            </div>

            {/* Content List */}
            <div className="flex-1 overflow-y-auto space-y-2">
              {/* Search Results */}
              {searchQuery.trim() ? (
                <div>
                  <p className="text-[10px] font-mono font-bold uppercase text-zinc-500 mb-2">
                    Search Results ({searchResults.length})
                  </p>
                  {isSearchingUsers ? (
                    <div className="text-center py-6">
                      <Loader2 size={20} className="animate-spin text-[#17a398] mx-auto" />
                    </div>
                  ) : searchResults.length === 0 ? (
                    <p className="text-xs text-zinc-500 text-center py-4">No users found</p>
                  ) : (
                    searchResults.map((u) => (
                      <div
                        key={u.id || u._id}
                        onClick={() => setActiveUser(u)}
                        className={`p-2.5 rounded-xl brutal-border flex items-center justify-between cursor-pointer transition brutal-shadow-sm ${
                          isDark ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-white' : 'bg-white hover:bg-[#ede5d3]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-lg bg-[#17a398] brutal-border flex items-center justify-center font-bold text-xs text-[#0b1110] overflow-hidden shrink-0">
                            {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : u.name?.[0] || 'U'}
                          </div>
                          <div className="truncate">
                            <div className={`flex items-center gap-1.5 font-display font-bold text-xs ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
                              <span>{u.name}</span>
                              <VerifiedBadge userOrName={u} size={12} />
                            </div>
                            <span className="text-[10px] font-mono text-zinc-500">Send Message</span>
                          </div>
                        </div>
                        <button className={`px-3 py-1 font-display font-bold text-[11px] rounded-lg brutal-border ${
                          isDark ? 'bg-[#17a398] text-black' : 'bg-[#0b1110] text-white'
                        }`}>
                          Chat →
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : activeTab === 'chats' ? (
                /* Conversations List */
                <div>
                  {loadingHub ? (
                    <div className="text-center py-8">
                      <Loader2 size={24} className="animate-spin text-[#17a398] mx-auto" />
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className={`text-center py-10 rounded-xl brutal-border p-5 ${
                      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white'
                    }`}>
                      <MessageSquare size={32} className="mx-auto text-zinc-400 mb-2" />
                      <p className={`font-display font-bold text-sm ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>No Chats Yet</p>
                      <p className="text-xs text-zinc-500 mt-1">Search for users above or choose a friend to begin chatting.</p>
                    </div>
                  ) : (
                    conversations.map((conv) => {
                      const other = conv.user;
                      if (!other) return null;
                      return (
                        <div
                          key={other.id || other._id}
                          onClick={() => setActiveUser(other)}
                          className={`p-2.5 rounded-xl brutal-border flex items-center justify-between cursor-pointer transition brutal-shadow-sm mb-2 ${
                            isDark ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-white' : 'bg-white hover:bg-[#ede5d3]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-lg bg-[#17a398] brutal-border flex items-center justify-center font-bold text-xs text-[#0b1110] overflow-hidden shrink-0">
                              {other.avatar ? <img src={other.avatar} alt="" className="w-full h-full object-cover" /> : other.name?.[0] || 'U'}
                            </div>
                            <div className="truncate flex-1">
                              <div className={`flex items-center gap-1.5 font-display font-black text-xs ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
                                <span>{other.name}</span>
                                <VerifiedBadge userOrName={other} size={12} />
                              </div>
                              <p className={`text-[11px] font-medium truncate mt-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                {conv.lastMessage?.text || (conv.lastMessage?.track ? '🎵 Shared a track' : 'Started a conversation')}
                              </p>
                            </div>
                          </div>
                          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded shrink-0 ${
                            isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-[#ede5d3] text-zinc-700'
                          }`}>
                            Chat
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                /* Friends List */
                <div>
                  {friends.length === 0 ? (
                    <div className={`text-center py-10 rounded-xl brutal-border p-5 ${
                      isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white'
                    }`}>
                      <Users size={32} className="mx-auto text-zinc-400 mb-2" />
                      <p className={`font-display font-bold text-sm ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>No Friends Added Yet</p>
                      <p className="text-xs text-zinc-500 mt-1">Search and connect with friends on Liofy.</p>
                    </div>
                  ) : (
                    friends.map((f) => (
                      <div
                        key={f.id || f._id}
                        onClick={() => setActiveUser(f)}
                        className={`p-2.5 rounded-xl brutal-border flex items-center justify-between cursor-pointer transition brutal-shadow-sm mb-2 ${
                          isDark ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-white' : 'bg-white hover:bg-[#ede5d3]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-[#17a398] brutal-border flex items-center justify-center font-bold text-xs text-[#0b1110] overflow-hidden shrink-0">
                            {f.avatar ? <img src={f.avatar} alt="" className="w-full h-full object-cover" /> : f.name?.[0] || 'F'}
                          </div>
                          <div className="truncate">
                            <div className={`flex items-center gap-1.5 font-display font-bold text-xs ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
                              <span>{f.name}</span>
                              <VerifiedBadge userOrName={f} size={12} />
                            </div>
                            <span className="text-[10px] font-mono text-emerald-500 font-bold">ONLINE</span>
                          </div>
                        </div>
                        <button className="px-3 py-1 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-display font-bold text-xs rounded-lg brutal-border brutal-shadow-sm brutal-btn">
                          Chat →
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
