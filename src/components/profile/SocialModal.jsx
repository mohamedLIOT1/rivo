import React, { useMemo } from 'react';
import { Loader2, Mic, User as UserIcon } from 'lucide-react';
import { getCanonicalArtistAvatar } from '../../utils/canonicalArtistAvatars';
import { normalizeCoverUrl, handleCoverImageError } from '../../utils/coverUtils';

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
  isRTL = false,
}) {
  const unifiedList = useMemo(() => {
    const list = [];
    // 1. Followed Artists first
    if (Array.isArray(artists)) {
      artists.forEach((art) => {
        if (!art) return;
        const artName = typeof art === 'string' ? art : (art.name || '');
        if (!artName) return;
        list.push({
          id: typeof art === 'object' ? (art.id || art._id || artName) : artName,
          name: artName,
          avatar: typeof art === 'object' ? (art.avatar || art.cover || art.image) : null,
          bio: typeof art === 'object' ? art.bio : '',
          isArtist: true,
        });
      });
    }

    // 2. Followed Users
    if (Array.isArray(users)) {
      users.forEach((u) => {
        if (!u) return;
        list.push({
          ...u,
          id: u.id || u._id,
          isArtist: Boolean(u.isArtist),
        });
      });
    }

    return list;
  }, [users, artists]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className={`w-full max-w-sm rounded-2xl brutal-border p-4 brutal-shadow-lg ${
        isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b-2 pb-2.5 mb-3 ${
          isDark ? 'border-zinc-700' : 'border-black'
        }`}>
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="font-display font-black text-sm truncate">{title}</h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#17a398]/20 text-[#17a398] border border-[#17a398]/30">
              {unifiedList.length}
            </span>
          </div>
          <button 
            onClick={onClose}
            type="button"
            className={`w-6 h-6 rounded-lg font-bold text-xs flex items-center justify-center cursor-pointer transition ${
              isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-zinc-200 hover:bg-zinc-300 text-[#0b1110]'
            }`}
          >
            ✕
          </button>
        </div>

        {/* Unified List (Artists + People together) */}
        <div className="max-h-72 overflow-y-auto space-y-2 pr-0.5">
          {loading ? (
            <div className="text-center py-8">
              <Loader2 size={22} className="animate-spin text-[#17a398] mx-auto" />
            </div>
          ) : unifiedList.length === 0 ? (
            <div className="text-center py-8 px-4">
              <UserIcon size={32} className="mx-auto text-zinc-500 mb-2 opacity-50" />
              <p className="text-xs text-zinc-400 font-bold">
                {type === 'followers'
                  ? (isRTL ? 'لا يوجد متابعون حتى الآن' : 'No followers yet')
                  : (isRTL ? 'لا تتابع أي حسابات أو فنانين بعد' : 'Not following any accounts or artists yet')}
              </p>
            </div>
          ) : (
            unifiedList.map((item) => {
              const isArt = Boolean(item.isArtist);
              const avatarUri = item.avatar || item.cover || item.image || (isArt ? getCanonicalArtistAvatar(item.name) : null);

              return (
                <div 
                  key={String(item.id || item._id || item.name)}
                  onClick={() => {
                    if (isArt) {
                      if (onSelectArtist) onSelectArtist(item.name);
                      if (onClose) onClose();
                    } else {
                      if (onSelectUser) onSelectUser(item.id || item._id);
                      if (onClose) onClose();
                    }
                  }}
                  className={`p-2.5 rounded-xl brutal-border flex items-center justify-between cursor-pointer transition-transform hover:translate-x-0.5 ${
                    isDark 
                      ? 'bg-zinc-900/90 border-zinc-800 hover:bg-zinc-800 text-white' 
                      : 'bg-white border-black hover:bg-[#ede5d3] text-[#0b1110]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate flex-1 min-w-0 mr-2">
                    <div className="w-9 h-9 rounded-full bg-[#17a398] brutal-border flex items-center justify-center font-bold text-xs text-[#0b1110] overflow-hidden shrink-0">
                      {avatarUri ? (
                        <img 
                          src={normalizeCoverUrl(avatarUri)} 
                          alt={item.name} 
                          onError={handleCoverImageError}
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        item.name?.[0]?.toUpperCase() || 'U'
                      )}
                    </div>
                    <div className="truncate flex-1 min-w-0">
                      <p className={`font-display font-bold text-xs truncate ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>
                        {item.name}
                      </p>
                      {item.bio ? (
                        <p className="text-[10px] text-zinc-400 truncate">{item.bio}</p>
                      ) : (
                        <p className="text-[10px] text-zinc-500 truncate font-mono">
                          {isArt ? (isRTL ? 'فنان رسمي' : 'Official Artist') : (isRTL ? 'مستخدم' : 'Community Member')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Verification Badge: Microphone for artists as requested */}
                  {isArt ? (
                    <span 
                      className="inline-flex items-center gap-1 text-[9px] font-mono font-black px-2 py-0.5 rounded-full bg-[#17a398]/15 text-[#17a398] border border-[#17a398]/40 shrink-0"
                      title={isRTL ? 'فنان موثق' : 'Verified Artist'}
                    >
                      <Mic size={11} className="text-[#17a398]" strokeWidth={2.5} />
                      <span>ARTIST</span>
                    </span>
                  ) : item.isVerified ? (
                    <span 
                      className="inline-flex items-center gap-1 text-[9px] font-mono font-black px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-400 border border-cyan-500/40 shrink-0"
                      title="Verified User"
                    >
                      <span>VERIFIED</span>
                    </span>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
