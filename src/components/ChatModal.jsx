import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Radio, Music, Loader2, User, Search, MessageSquare, ArrowLeft, Users, Bell } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function ChatModal({
  isOpen,
  onClose,
  targetUser,
  currentUser,
  socket,
  onStartJamWithUser,
  onPlayTrack
}) {
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#181818] border border-white/10 rounded-3xl w-full max-w-lg h-[580px] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* ─────────────────────────────────────────
            HEADER: DIRECT CHAT vs CONVERSATIONS HUB
            ───────────────────────────────────────── */}
        {activeUser ? (
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/80 shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setActiveUser(null);
                  fetchHubData();
                }}
                className="p-1.5 -ml-1 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                title="All Chats"
              >
                <ArrowLeft size={20} />
              </button>

              <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center shrink-0 border border-white/10 shadow">
                {activeUser.avatar ? (
                  <img src={activeUser.avatar} alt={activeUser.name} className="w-full h-full object-cover" />
                ) : (
                  <User size={20} className="text-zinc-400" />
                )}
              </div>
              <div className="truncate">
                <h3 className="font-bold text-white text-base leading-tight truncate">{activeUser.name}</h3>
                <p className="text-xs text-[#1DB954] font-medium">Direct Chat</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSendJamInvite}
                className="px-3 py-1.5 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                title="Invite to Jam"
              >
                <Radio size={14} className="text-cyan-400" />
                <span className="hidden sm:inline">Jam Invite</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        ) : (
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/80 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#1DB954] text-black flex items-center justify-center font-black shadow-lg shadow-[#1DB954]/20">
                <MessageSquare size={18} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base leading-tight">Messages</h3>
                <p className="text-xs text-zinc-400">Chat & share music with friends</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        )}

        {/* ─────────────────────────────────────────
            BODY: DIRECT CHAT OR CONVERSATIONS HUB
            ───────────────────────────────────────── */}
        {activeUser ? (
          <>
            {/* Message List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={24} className="animate-spin text-zinc-500" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 mb-2">
                    <Radio size={24} />
                  </div>
                  <p className="text-sm font-semibold text-zinc-300">Start the conversation</p>
                  <p className="text-xs text-zinc-500 mt-1 max-w-xs">
                    Say hello, share music, or invite {activeUser.name} to a Jam session!
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = String(msg.sender) === String(currentUser?.id || currentUser?._id);
                  return (
                    <div
                      key={msg._id || idx}
                      className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                          isMe
                            ? 'bg-[#1DB954] text-black font-semibold rounded-br-none'
                            : 'bg-zinc-800 text-white rounded-bl-none border border-white/5'
                        }`}
                      >
                        {msg.text && <p className="break-words">{msg.text}</p>}
                        
                        {/* Track attached */}
                        {msg.track && (
                          <div
                            onClick={() => onPlayTrack && onPlayTrack(msg.track)}
                            className={`mt-2 p-2 rounded-xl flex items-center gap-2.5 cursor-pointer ${
                              isMe ? 'bg-black/20 hover:bg-black/30' : 'bg-black/40 hover:bg-black/60'
                            }`}
                          >
                            <img
                              src={msg.track.cover}
                              alt=""
                              className="w-9 h-9 rounded-lg object-cover shadow"
                            />
                            <div className="truncate flex-1">
                              <p className="text-xs font-bold truncate">{msg.track.title}</p>
                              <p className="text-[10px] opacity-80 truncate">{msg.track.artist}</p>
                            </div>
                            <Music size={14} className="shrink-0" />
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-500 mt-1 px-1">
                        {msg.createdAt
                          ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-white/10 bg-zinc-900/40 flex items-center gap-2 shrink-0">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Message ${activeUser.name}...`}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#1DB954] transition-colors"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || sending}
                className="p-2.5 rounded-xl bg-[#1DB954] text-black hover:bg-[#1ed760] active:scale-95 disabled:opacity-40 disabled:hover:bg-[#1DB954] transition-all shadow-md cursor-pointer"
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </form>
          </>
        ) : (
          /* ── Conversations & Friends Hub ── */
          <div className="flex-1 flex flex-col overflow-hidden p-4">
            {/* Search Input */}
            <div className="relative mb-3 shrink-0">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search friends or find users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#1DB954] transition-colors"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Search Results */}
              {searchQuery.trim().length >= 2 && (
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-2">Search Results</h4>
                  {isSearchingUsers ? (
                    <div className="py-4 text-center"><Loader2 size={18} className="animate-spin text-zinc-500 mx-auto" /></div>
                  ) : searchResults.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-2 text-center">No users found matching "{searchQuery}"</p>
                  ) : (
                    <div className="space-y-1.5">
                      {searchResults.map((u) => (
                        <div
                          key={u.id || u._id}
                          onClick={() => setActiveUser(u)}
                          className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                        >
                          <img
                            src={u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                            alt={u.name}
                            className="w-10 h-10 rounded-full object-cover shadow"
                          />
                          <div className="truncate flex-1">
                            <p className="font-bold text-sm text-white truncate">{u.name}</p>
                            <p className="text-xs text-zinc-400 truncate">{u.bio || 'Liofy listener'}</p>
                          </div>
                          <span className="text-xs font-bold text-[#1DB954] bg-[#1DB954]/10 px-2.5 py-1 rounded-full border border-[#1DB954]/20">
                            Chat
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Recent Conversations */}
              <div>
                <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-2 flex items-center justify-between">
                  <span>Recent Conversations</span>
                  <span className="text-[10px] text-zinc-500 font-mono">{conversations.length}</span>
                </h4>

                {loadingHub ? (
                  <div className="py-6 text-center"><Loader2 size={20} className="animate-spin text-zinc-500 mx-auto" /></div>
                ) : conversations.length === 0 ? (
                  <div className="p-4 bg-white/5 rounded-2xl text-center border border-white/5 text-xs text-zinc-400">
                    <p>No recent messages yet.</p>
                    <p className="text-zinc-500 text-[11px] mt-1">Pick a friend below or search to send your first message!</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {conversations.map((c) => {
                      const u = c.user;
                      const last = c.lastMessage;
                      return (
                        <div
                          key={u.id}
                          onClick={() => setActiveUser(u)}
                          className="flex items-center gap-3 p-2.5 rounded-xl bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800/80 cursor-pointer transition-colors group"
                        >
                          <img
                            src={u.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                            alt={u.name}
                            className="w-10 h-10 rounded-full object-cover shadow shrink-0"
                          />
                          <div className="truncate flex-1">
                            <div className="flex items-center justify-between">
                              <p className="font-bold text-sm text-white truncate">{u.name}</p>
                              {last?.createdAt && (
                                <span className="text-[10px] text-zinc-500 shrink-0">
                                  {new Date(last.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-zinc-400 truncate mt-0.5">
                              {last?.track ? `🎵 ${last.track.title}` : (last?.text || 'Sent an attachment')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Friends & Followers list */}
              {friends.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-black uppercase tracking-wider text-zinc-400 mb-2">
                    Friends ({friends.length})
                  </h4>
                  <div className="space-y-1.5">
                    {friends.map((f) => (
                      <div
                        key={f.id}
                        onClick={() => setActiveUser(f)}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                      >
                        <img
                          src={f.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop'}
                          alt={f.name}
                          className="w-8 h-8 rounded-full object-cover shadow shrink-0"
                        />
                        <div className="truncate flex-1">
                          <p className="font-bold text-xs text-white truncate">{f.name}</p>
                          <p className="text-[10px] text-zinc-400 truncate">{f.bio || 'Friend on Liofy'}</p>
                        </div>
                        <span className="text-[10px] font-bold text-zinc-400 group-hover:text-white">
                          Chat →
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
