import React, { useState, useEffect, useCallback } from 'react';
import { X, Send, Radio, MessageSquare, ArrowLeft, Loader2, ChevronUp } from 'lucide-react';
import { API_BASE_URL } from '../config';
import VerifiedBadge from './VerifiedBadge';
import { usePreferences } from '../context/PreferencesContext';
import { useUI } from '../context/UIContext';
import ChatMessageItem from './chat/ChatMessageItem';
import ChatHubView from './chat/ChatHubView';
import ChatEmptyState from './chat/ChatEmptyState';
import { useChatMessages, getToken } from './chat/useChatMessages';

export default function ChatModal({
  isOpen,
  onClose,
  targetUser,
  currentUser,
  socket,
  onStartJamWithUser,
  onJoinJam,
  onPlayTrack,
  globalTheme = 'dark',
  onViewProfile
}) {
  const { isRTL = false } = usePreferences() || {};
  const { setUnreadChatCount, setChatTargetUser } = useUI() || {};
  const isDark = globalTheme === 'dark' || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  const [activeUser, setActiveUser] = useState(targetUser || null);
  const [conversations, setConversations] = useState([]);
  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loadingHub, setLoadingHub] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [activeTab, setActiveTab] = useState('chats');

  // Sync activeUser if targetUser prop changes
  useEffect(() => {
    setActiveUser(targetUser || null);
  }, [targetUser]);

  // Load Conversations and Friends when in hub mode
  const fetchHubData = useCallback(async () => {
    setLoadingHub(true);
    try {
      const token = getToken();
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
  }, []);

  const handleSelectPartner = useCallback((u) => {
    setActiveUser(u);
    setChatTargetUser?.(u);
  }, [setChatTargetUser]);

  const handleBackToHub = useCallback(() => {
    setActiveUser(null);
    setChatTargetUser?.(null);
    fetchHubData();
  }, [fetchHubData, setChatTargetUser]);

  const handleModalClose = useCallback(() => {
    setActiveUser(null);
    setChatTargetUser?.(null);
    onClose?.();
  }, [onClose, setChatTargetUser]);

  useEffect(() => {
    if (isOpen && !activeUser) {
      fetchHubData();
    }
  }, [isOpen, activeUser, fetchHubData]);

  // User search
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

  const {
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
    handleSendJamInvite
  } = useChatMessages({
    isOpen,
    activeUser,
    currentUser,
    socket,
    setUnreadChatCount,
    onStartJamWithUser,
    fetchHubData
  });

  if (!isOpen) return null;

  return (
    <div
      dir={isRTL ? 'rtl' : 'ltr'}
      onClick={markCurrentChatAsRead}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 select-none"
    >
      <div
        className={`rounded-2xl w-full max-w-lg md:max-w-xl h-[620px] flex flex-col brutal-shadow-lg overflow-hidden animate-in zoom-in-95 duration-200 ${
          isDark ? 'bg-[#121212] text-white border-2 border-zinc-800' : 'bg-[#fdfbf7] text-[#0b1110] brutal-border-thick'
        }`}
      >
        {/* Header */}
        <div
          className={`p-3.5 flex items-center justify-between shrink-0 border-b-2 ${
            isDark ? 'bg-zinc-900 border-zinc-800 text-white' : 'bg-[#0b1110] border-black text-[#fdfbf7]'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {activeUser ? (
              <button
                onClick={handleBackToHub}
                className={`w-8 h-8 rounded-lg flex items-center justify-center brutal-btn cursor-pointer me-1 brutal-border ${
                  isDark ? 'bg-zinc-800 text-white border-zinc-700 hover:bg-zinc-700' : 'bg-[#fdfbf7] text-[#0b1110]'
                }`}
                title={isRTL ? 'الرجوع للمحادثات' : 'Back to Chats'}
              >
                <ArrowLeft size={16} strokeWidth={2.5} className={isRTL ? 'rotate-180' : ''} />
              </button>
            ) : null}

            {/* Clickable Profile Avatar & Name */}
            <div
              onClick={() => {
                if (onViewProfile && activeUser) {
                  onViewProfile(activeUser);
                }
              }}
              className="flex items-center gap-2.5 truncate cursor-pointer hover:opacity-85 transition group"
              title={activeUser ? (isRTL ? 'عرض الملف الشخصي' : 'View User Profile') : undefined}
            >
              {activeUser?.avatar ? (
                <img
                  src={activeUser.avatar}
                  alt={activeUser.name}
                  className="w-8 h-8 rounded-lg object-cover brutal-border shrink-0 shadow-sm group-hover:scale-105 transition-transform"
                />
              ) : activeUser ? (
                <div className="w-8 h-8 rounded-lg bg-[#17a398] text-[#0b1110] brutal-border flex items-center justify-center font-display font-black text-sm shrink-0 group-hover:scale-105 transition-transform">
                  {activeUser.name?.[0]?.toUpperCase() || 'U'}
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-[#17a398] text-[#0b1110] brutal-border flex items-center justify-center font-display font-black text-sm shrink-0">
                  <MessageSquare size={16} />
                </div>
              )}

              <div className="truncate">
                <div className="flex items-center gap-1.5 truncate">
                  <h3
                    style={{ letterSpacing: 'normal' }}
                    className="font-bold text-sm leading-none text-white truncate group-hover:text-[#17a398] transition-colors tracking-normal"
                  >
                    {activeUser ? activeUser.name : (isRTL ? 'الرسائل' : 'Chat')}
                  </h3>
                  {activeUser && <VerifiedBadge userOrName={activeUser} size={13} />}
                  {(activeUser?.isBot || activeUser?.name === 'Rivo Bot') && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#17a398] text-[#082621]">
                      [BOT]
                    </span>
                  )}
                </div>
                <span
                  style={{ letterSpacing: 'normal' }}
                  className={`text-[10px] block mt-0.5 tracking-normal ${
                    isOtherTyping ? 'text-emerald-400 font-bold animate-pulse' : 'text-zinc-400'
                  }`}
                >
                  {isOtherTyping
                    ? (isRTL ? 'يكتب الآن...' : 'typing...')
                    : (activeUser
                      ? (isRTL ? 'محادثة مباشرة • عرض الملف' : 'Direct Chat • View Profile')
                      : (isRTL ? 'الرسائل والأصدقاء' : 'Messages & Friends'))}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeUser && !(activeUser?.isBot || activeUser?.name === 'Rivo Bot' || activeUser?.email === 'bot@rivo.app') && (
              <button
                onClick={handleSendJamInvite}
                style={{ letterSpacing: 'normal' }}
                className="px-2.5 py-1 rounded bg-[#f59e0b] text-[#0b1110] font-black text-[11px] brutal-border brutal-shadow-sm brutal-btn flex items-center gap-1 cursor-pointer tracking-normal"
                title={isRTL ? 'دعوة لجلسة جام' : 'Invite to Jam'}
              >
                <Radio size={12} className="animate-pulse" strokeWidth={2.5} />
                <span>{isRTL ? 'جلسة جام' : 'Jam Invite'}</span>
              </button>
            )}

            <button
              onClick={handleModalClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer"
            >
              <X size={17} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Body */}
        {activeUser ? (
          <>
            {/* Messages Stream */}
            <div
              ref={messagesContainerRef}
              className={`flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3 ${
                isDark ? 'bg-[#121212]' : 'bg-[#fdfbf7] paper-texture'
              }`}
            >
              {hasMore && (
                <div className="flex justify-center py-1">
                  <button
                    type="button"
                    onClick={loadEarlierMessages}
                    disabled={loadingEarlier}
                    className={`px-3 py-1 rounded-full text-xs font-mono font-bold flex items-center gap-1.5 transition brutal-border cursor-pointer shadow-sm ${
                      isDark
                        ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border-zinc-700'
                        : 'bg-[#ede5d3] text-[#0b1110] hover:bg-[#ded2bb] border-black'
                    }`}
                  >
                    {loadingEarlier ? (
                      <Loader2 size={12} className="animate-spin text-[#17a398]" />
                    ) : (
                      <ChevronUp size={12} />
                    )}
                    <span>{isRTL ? 'تحميل رسائل سابقة' : 'Load earlier messages'}</span>
                  </button>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={26} className="animate-spin text-[#17a398]" />
                </div>
              ) : messages.length === 0 ? (
                <ChatEmptyState isDark={isDark} isRTL={isRTL} activeUserName={activeUser?.name || 'Friend'} />
              ) : (
                messages.map((msg, idx) => {
                  const isMe = String(msg.sender) === String(currentUser?.id || currentUser?._id);
                  return (
                    <ChatMessageItem
                      key={msg._id || idx}
                      msg={msg}
                      currentUser={currentUser}
                      activeUser={activeUser}
                      isMe={isMe}
                      isDark={isDark}
                      isRTL={isRTL}
                      onPlayTrack={onPlayTrack}
                      onJoinJam={onJoinJam}
                      onClose={onClose}
                      onToggleReaction={toggleReaction}
                    />
                  );
                })
              )}

              {isOtherTyping && (
                <div className="flex items-center gap-2 p-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold w-fit animate-pulse">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span>{activeUser.name} is typing...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Chat Input Field */}
            <div
              className={`p-3 border-t-2 shrink-0 ${
                isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-[#ded2bb] border-black'
              }`}
            >
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  dir="auto"
                  style={{ letterSpacing: 'normal' }}
                  value={inputText}
                  onFocus={markCurrentChatAsRead}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInputText(val);
                    if (socket && activeUser) {
                      const recipientId = activeUser.id || activeUser._id;
                      socket.emit('chat:typing', { recipientId, isTyping: val.length > 0 });
                      if (myTypingTimeoutRef.current) clearTimeout(myTypingTimeoutRef.current);
                      myTypingTimeoutRef.current = setTimeout(() => {
                        socket.emit('chat:typing', { recipientId, isTyping: false });
                      }, 2500);
                    }
                  }}
                  placeholder={isRTL ? `اكتب رسالة إلى ${activeUser.name}...` : `Type a message for ${activeUser.name}...`}
                  className={`flex-1 text-xs font-sans font-semibold px-3 py-2.5 rounded-lg brutal-border focus:outline-none focus:ring-2 focus:ring-[#17a398] tracking-normal ${
                    isDark
                      ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500'
                      : 'bg-white border-black text-[#0b1110]'
                  }`}
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || sending}
                  style={{ letterSpacing: 'normal' }}
                  className="bg-[#17a398] hover:bg-[#26c4b7] text-black px-4 py-2 rounded-lg font-bold text-xs brutal-border brutal-shadow-sm brutal-btn flex items-center gap-1.5 cursor-pointer disabled:opacity-40 tracking-normal shrink-0"
                >
                  {sending ? (
                    <Loader2 size={14} className="animate-spin text-black" />
                  ) : (
                    <Send size={14} className={`text-black ${isRTL ? 'rotate-180' : ''}`} strokeWidth={2.5} />
                  )}
                  <span>{isRTL ? 'إرسال' : 'Send'}</span>
                </button>
              </form>
            </div>
          </>
        ) : (
          <ChatHubView
            isDark={isDark}
            isRTL={isRTL}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            conversations={conversations}
            friends={friends}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchResults={searchResults}
            isSearchingUsers={isSearchingUsers}
            loadingHub={loadingHub}
            onSelectUser={handleSelectPartner}
          />
        )}
      </div>
    </div>
  );
}
