import React from 'react';
import { Search, Loader2, MessageSquare, Users } from 'lucide-react';
import VerifiedBadge from '../VerifiedBadge';

export default function ChatHubView({
  isDark,
  isRTL,
  activeTab,
  setActiveTab,
  conversations,
  friends,
  searchQuery,
  setSearchQuery,
  searchResults,
  isSearchingUsers,
  loadingHub,
  onSelectUser
}) {
  return (
    <>
      {/* Sub-header Tabs */}
      <div
        style={{ letterSpacing: 'normal' }}
        className={`p-2 border-b-2 flex gap-1.5 overflow-x-auto text-xs font-bold shrink-0 tracking-normal ${
          isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-[#ded2bb] border-black'
        }`}
      >
        <button
          type="button"
          onClick={() => setActiveTab('chats')}
          style={{ letterSpacing: 'normal' }}
          className={`px-3 py-1 rounded brutal-border transition font-bold tracking-normal cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'chats'
              ? (isDark ? 'bg-[#17a398] text-black font-black brutal-shadow-sm' : 'bg-[#0b1110] text-white brutal-shadow-sm')
              : (isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700' : 'bg-white text-[#0b1110]')
          }`}
        >
          <span>{isRTL ? `المحادثات (${conversations.length})` : `Chats (${conversations.length})`}</span>
          {conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0) > 0 && (
            <span className="min-w-4 h-4 px-1 rounded-full bg-red-600 text-white font-mono font-black text-[9px] flex items-center justify-center animate-pulse">
              {conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0)}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('friends')}
          style={{ letterSpacing: 'normal' }}
          className={`px-3 py-1 rounded brutal-border transition font-bold tracking-normal cursor-pointer ${
            activeTab === 'friends'
              ? (isDark ? 'bg-[#17a398] text-black font-black brutal-shadow-sm' : 'bg-[#0b1110] text-white brutal-shadow-sm')
              : (isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700' : 'bg-white text-[#0b1110]')
          }`}
        >
          {isRTL ? `الأصدقاء (${friends.length})` : `Friends (${friends.length})`}
        </button>
      </div>

      {/* Hub Body */}
      <div
        className={`flex-1 flex flex-col overflow-hidden p-3.5 sm:p-4 ${
          isDark ? 'bg-[#121212]' : 'bg-[#fdfbf7] paper-texture'
        }`}
      >
        {/* Search Input */}
        <div className="relative mb-3 shrink-0">
          <Search
            size={16}
            className={`absolute start-3.5 top-1/2 -translate-y-1/2 ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}
            strokeWidth={2.5}
          />
          <input
            type="text"
            dir="auto"
            style={{ letterSpacing: 'normal' }}
            placeholder={isRTL ? 'ابحث عن أصدقاء أو محادثات...' : 'Search friends or conversations...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full brutal-border rounded-xl ps-10 pe-4 py-2 text-xs font-sans font-semibold focus:outline-none brutal-shadow-sm tracking-normal ${
              isDark
                ? 'bg-zinc-800 border-zinc-700 text-white placeholder-zinc-500'
                : 'bg-white border-black text-[#0b1110] placeholder-zinc-500'
            }`}
          />
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto space-y-2">
          {searchQuery.trim() ? (
            /* Search Results */
            <div>
              <p className="text-[10px] font-bold uppercase text-zinc-500 mb-2 tracking-normal">
                {isRTL ? `نتائج البحث (${searchResults.length})` : `Search Results (${searchResults.length})`}
              </p>
              {isSearchingUsers ? (
                <div className="text-center py-6">
                  <Loader2 size={20} className="animate-spin text-[#17a398] mx-auto" />
                </div>
              ) : searchResults.length === 0 ? (
                <p className="text-xs text-zinc-500 text-center py-4">
                  {isRTL ? 'لم يتم العثور على مستخدمين' : 'No users found'}
                </p>
              ) : (
                searchResults.map((u) => (
                  <div
                    key={u.id || u._id}
                    onClick={() => onSelectUser(u)}
                    className={`p-2.5 rounded-xl brutal-border flex items-center justify-between cursor-pointer transition brutal-shadow-sm mb-2 ${
                      isDark ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-white' : 'bg-white hover:bg-[#ede5d3]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#17a398] brutal-border flex items-center justify-center font-bold text-xs text-[#0b1110] overflow-hidden shrink-0">
                        {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : u.name?.[0] || 'U'}
                      </div>
                      <div className="truncate">
                        <div className={`flex items-center gap-1.5 font-sans font-bold text-xs ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
                          <span>{u.name}</span>
                          <VerifiedBadge userOrName={u} size={12} />
                        </div>
                        <span className="text-[10px] text-zinc-500 tracking-normal">{isRTL ? 'إرسال رسالة' : 'Send Message'}</span>
                      </div>
                    </div>
                    <button
                      style={{ letterSpacing: 'normal' }}
                      className={`px-3 py-1 font-bold text-[11px] rounded-lg brutal-border tracking-normal ${
                        isDark ? 'bg-[#17a398] text-black' : 'bg-[#0b1110] text-white'
                      }`}
                    >
                      {isRTL ? 'محادثة ←' : 'Chat →'}
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
                  <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>{isRTL ? 'لا توجد محادثات بعد' : 'No Chats Yet'}</p>
                  <p className="text-xs text-zinc-500 mt-1">{isRTL ? 'ابحث عن مستخدمين بالأعلى أو اختر صديقاً لبدء المحادثة.' : 'Search for users above or choose a friend to begin chatting.'}</p>
                </div>
              ) : (
                conversations.map((conv) => {
                  const other = conv.user;
                  if (!other) return null;
                  return (
                    <div
                      key={other.id || other._id}
                      onClick={() => onSelectUser(other)}
                      className={`p-2.5 rounded-xl brutal-border flex items-center justify-between cursor-pointer transition brutal-shadow-sm mb-2 ${
                        conv.unreadCount > 0
                          ? isDark
                            ? 'bg-zinc-900 border-red-500/70 shadow-[0_0_10px_rgba(239,68,68,0.2)] text-white hover:bg-zinc-800'
                            : 'bg-red-50/70 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.2)] text-black hover:bg-red-100/60'
                          : isDark
                          ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-white'
                          : 'bg-white hover:bg-[#ede5d3]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="relative w-10 h-10 rounded-lg bg-[#17a398] brutal-border flex items-center justify-center font-bold text-xs text-[#0b1110] overflow-hidden shrink-0">
                          {other.avatar ? <img src={other.avatar} alt="" className="w-full h-full object-cover" /> : other.name?.[0] || 'U'}
                          {conv.unreadCount > 0 && (
                            <span className="absolute top-0.5 end-0.5 w-2 h-2 rounded-full bg-red-600 animate-ping" />
                          )}
                        </div>
                        <div className="truncate flex-1 min-w-0">
                          <div className={`flex items-center gap-1.5 font-sans font-bold text-xs ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
                            <span className="truncate">{other.name}</span>
                            <VerifiedBadge userOrName={other} size={12} />
                            {(other?.isBot || other?.name === 'Rivo Bot') && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[#17a398] text-[#082621]">
                                [BOT]
                              </span>
                            )}
                          </div>
                          <p
                            dir="auto"
                            style={{ letterSpacing: 'normal' }}
                            className={`text-[11.5px] font-sans truncate mt-0.5 tracking-normal ${
                              conv.unreadCount > 0
                                ? isDark ? 'text-zinc-100 font-bold' : 'text-zinc-950 font-bold'
                                : isDark ? 'text-zinc-400 font-medium' : 'text-zinc-600 font-medium'
                            }`}
                          >
                            {conv.lastMessage?.text || (conv.lastMessage?.track ? (isRTL ? '🎵 شارك مقطعاً صوتياً' : '🎵 Shared a track') : (isRTL ? 'بدأ محادثة' : 'Started a conversation'))}
                          </p>
                        </div>
                      </div>
                      {conv.unreadCount > 0 ? (
                        <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white font-mono font-black text-[11px] flex items-center justify-center brutal-border brutal-shadow-xs animate-pulse shrink-0">
                          {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
                        </span>
                      ) : (
                        <span
                          style={{ letterSpacing: 'normal' }}
                          className={`text-[10px] font-sans font-semibold px-2 py-0.5 rounded shrink-0 tracking-normal ${
                            isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-[#ede5d3] text-zinc-700'
                          }`}
                        >
                          {isRTL ? 'محادثة' : 'Chat'}
                        </span>
                      )}
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
                  <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>{isRTL ? 'لا يوجد أصدقاء بعد' : 'No Friends Added Yet'}</p>
                  <p className="text-xs text-zinc-500 mt-1">{isRTL ? 'ابحث وتواصل مع الأصدقاء على ريفو.' : 'Search and connect with friends on Rivo.'}</p>
                </div>
              ) : (
                friends.map((f) => (
                  <div
                    key={f.id || f._id}
                    onClick={() => onSelectUser(f)}
                    className={`p-2.5 rounded-xl brutal-border flex items-center justify-between cursor-pointer transition brutal-shadow-sm mb-2 ${
                      isDark ? 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-white' : 'bg-white hover:bg-[#ede5d3]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-[#17a398] brutal-border flex items-center justify-center font-bold text-xs text-[#0b1110] overflow-hidden shrink-0">
                        {f.avatar ? <img src={f.avatar} alt="" className="w-full h-full object-cover" /> : f.name?.[0] || 'F'}
                      </div>
                      <div className="truncate flex-1 min-w-0">
                        <div className={`flex items-center gap-1.5 font-sans font-bold text-xs ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
                          <span className="truncate">{f.name}</span>
                          <VerifiedBadge userOrName={f} size={12} />
                        </div>
                        <span className="text-[10px] text-emerald-500 font-bold tracking-normal">{isRTL ? 'متصل' : 'ONLINE'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {f.unreadCount > 0 && (
                        <span className="min-w-5 h-5 px-1.5 rounded-full bg-red-600 text-white font-mono font-black text-[11px] flex items-center justify-center brutal-border brutal-shadow-xs animate-pulse">
                          {f.unreadCount > 99 ? '99+' : f.unreadCount}
                        </span>
                      )}
                      <button
                        style={{ letterSpacing: 'normal' }}
                        className="px-3 py-1 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-bold text-xs rounded-lg brutal-border brutal-shadow-sm brutal-btn tracking-normal"
                      >
                        {isRTL ? 'محادثة ←' : 'Chat →'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
