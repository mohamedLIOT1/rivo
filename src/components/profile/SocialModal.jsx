import React, { useState, useEffect } from 'react';
import { Loader2, User, Mic } from 'lucide-react';
import { getCanonicalArtistAvatar } from '../../utils/canonicalArtistAvatars';

export default function SocialModal({
  isOpen,
  title,
  type = 'following',
  loading,
  users = [],
  artists = [],
  isDark,
  onClose,
  onSelectUser,
  onSelectArtist,
  t,
}) {
  const [activeTab, setActiveTab] = useState('people'); // 'people' | 'artists'

  useEffect(() => {
    if (!isOpen) return;
    if (type === 'followers') {
      setActiveTab('people');
    } else if (type === 'following') {
      // If opened and no people but has artists, default directly to artists
      if (users.length === 0 && artists.length > 0) {
        setActiveTab('artists');
      }
    }
  }, [isOpen, type, users.length, artists.length]);

  if (!isOpen) return null;

  // Always show tabs for following to prevent tab flickering/disappearing
  const showTabs = type === 'following' || (Array.isArray(artists) && artists.length > 0);
  const currentList = activeTab === 'artists' ? artists : users;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`w-full max-w-sm rounded-2xl brutal-border p-4 brutal-shadow-lg ${
        isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
      }`}>
        <div className={`flex items-center justify-between border-b-2 pb-2 mb-3 ${
          isDark ? 'border-zinc-700' : 'border-black'
        }`}>
          <h3 className="font-display font-black text-sm">{title}</h3>
          <button 
            onClick={onClose}
            className={`w-6 h-6 rounded font-bold text-xs cursor-pointer ${
              isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-zinc-200 hover:bg-zinc-300 text-[#0b1110]'
            }`}
          >
            ✕
          </button>
        </div>

        {/* Tabs for following */}
        {showTabs && (
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setActiveTab('people')}
              className={`flex-1 py-1 rounded text-xs font-bold transition flex items-center justify-center gap-1.5 brutal-border ${
                activeTab === 'people'
                  ? 'bg-[#17a398] text-[#0b1110] font-black'
                  : isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-white text-zinc-600 border-zinc-300'
              }`}
            >
              <User size={12} />
              <span>{t ? (t('profile.people') || 'أشخاص') : 'أشخاص'} ({users.length})</span>
            </button>
            <button
              onClick={() => setActiveTab('artists')}
              className={`flex-1 py-1 rounded text-xs font-bold transition flex items-center justify-center gap-1.5 brutal-border ${
                activeTab === 'artists'
                  ? 'bg-[#17a398] text-[#0b1110] font-black'
                  : isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-white text-zinc-600 border-zinc-300'
              }`}
            >
              <Mic size={12} />
              <span>{t ? (t('profile.artists') || 'فنانين') : 'فنانين'} ({artists.length})</span>
            </button>
          </div>
        )}

        <div className="max-h-64 overflow-y-auto space-y-2">
          {loading ? (
            <div className="text-center py-6">
              <Loader2 size={20} className="animate-spin text-[#17a398] mx-auto" />
            </div>
          ) : currentList.length === 0 ? (
            <p className="text-xs text-zinc-400 text-center py-4">
              {activeTab === 'artists' ? 'لا يوجد فنانين متابعين' : (t ? t('profile.noUsersFound') : 'No users found')}
            </p>
          ) : (
            currentList.map(item => {
              const isArt = Boolean(item.isArtist || activeTab === 'artists');
              const avatarUri = item.avatar || item.cover || item.image || (isArt ? getCanonicalArtistAvatar(item.name) : null);

              return (
                <div 
                  key={item.id || item._id}
                  onClick={() => {
                    if (isArt) {
                      if (onSelectArtist) onSelectArtist(item.name);
                      if (onClose) onClose();
                    } else {
                      if (onSelectUser) onSelectUser(item.id || item._id);
                    }
                  }}
                  className={`p-2 rounded-lg brutal-border flex items-center justify-between cursor-pointer transition ${
                    isDark ? 'bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-white' : 'bg-white border-black hover:bg-[#ede5d3] text-[#0b1110]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate flex-1">
                    <div className="w-8 h-8 rounded-lg bg-[#17a398] brutal-border flex items-center justify-center font-bold text-xs text-[#0b1110] overflow-hidden shrink-0">
                      {avatarUri ? (
                        <img src={avatarUri} alt="" className="w-full h-full object-cover" />
                      ) : (
                        item.name?.[0] || 'U'
                      )}
                    </div>
                    <div className="truncate flex-1">
                      <p className={`font-display font-bold text-xs truncate ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
                        {item.name}
                      </p>
                      {item.bio ? (
                        <p className="text-[10px] text-zinc-400 truncate">{item.bio}</p>
                      ) : isArt ? (
                        <p className="text-[10px] text-zinc-400 truncate font-mono">فنان رسمي</p>
                      ) : null}
                    </div>
                  </div>
                  {isArt && (
                    <span className="text-[8px] font-mono font-bold px-1 py-0.5 rounded bg-zinc-800 text-[#17a398] border border-zinc-700 shrink-0">
                      ARTIST
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
