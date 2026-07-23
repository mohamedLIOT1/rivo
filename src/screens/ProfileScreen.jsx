import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Camera, Edit2, Check, X, Music, Heart, Globe, Lock,
  Eye, EyeOff, Search, User, Calendar, LogOut, ChevronRight, Loader2
} from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function ProfileScreen({ currentUser, playlists = [], onBack, logout, onSelectPlaylist }) {
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'search'
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [nameInput, setNameInput] = useState(currentUser?.name || '');
  const [bioInput, setBioInput] = useState(currentUser?.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [localUser, setLocalUser] = useState(currentUser);
  const [localPlaylists, setLocalPlaylists] = useState(playlists);
  const [togglingId, setTogglingId] = useState(null);

  // Avatar upload
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const avatarInputRef = useRef(null);

  // User search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [viewingProfile, setViewingProfile] = useState(null);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    setLocalUser(currentUser);
    setNameInput(currentUser?.name || '');
    setBioInput(currentUser?.bio || '');
  }, [currentUser]);

  useEffect(() => {
    setLocalPlaylists(playlists);
  }, [playlists]);

  // ── Avatar upload from local file ──
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAvatar(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result;
        const token = localStorage.getItem('liofy_token');
        const res = await fetch(`${API_BASE_URL}/api/auth/update-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ avatar: base64 }),
        });
        const data = await res.json();
        if (data.success) {
          setLocalUser(data.user);
          localStorage.setItem('liofy_user', JSON.stringify(data.user));
          if (data.token) localStorage.setItem('liofy_token', data.token);
        }
        setIsUploadingAvatar(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setIsUploadingAvatar(false);
    }
  };

  // ── Save name ──
  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setIsSaving(true);
    try {
      const token = localStorage.getItem('liofy_token');
      const res = await fetch(`${API_BASE_URL}/api/auth/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setLocalUser(data.user);
        localStorage.setItem('liofy_user', JSON.stringify(data.user));
        if (data.token) localStorage.setItem('liofy_token', data.token);
      }
    } catch {}
    setIsSaving(false);
    setIsEditingName(false);
  };

  // ── Save bio ──
  const handleSaveBio = async () => {
    setIsSaving(true);
    try {
      const token = localStorage.getItem('liofy_token');
      const res = await fetch(`${API_BASE_URL}/api/auth/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bio: bioInput }),
      });
      const data = await res.json();
      if (data.success) {
        setLocalUser(data.user);
        localStorage.setItem('liofy_user', JSON.stringify(data.user));
        if (data.token) localStorage.setItem('liofy_token', data.token);
      }
    } catch {}
    setIsSaving(false);
    setIsEditingBio(false);
  };

  // ── Toggle playlist visibility ──
  const handleToggleVisibility = async (pl) => {
    if (pl.isLikedSongs) return; // Can't toggle Liked Songs visibility
    setTogglingId(pl.id);
    try {
      const token = localStorage.getItem('liofy_token');
      const res = await fetch(`${API_BASE_URL}/api/playlists/${pl.id}/toggle-visibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setLocalPlaylists(prev => prev.map(p =>
          p.id === pl.id ? { ...p, isPublic: data.isPublic } : p
        ));
      }
    } catch {}
    setTogglingId(null);
  };

  // ── Search users ──
  const handleSearchChange = (q) => {
    setSearchQuery(q);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!q.trim() || q.length < 2) { setSearchResults([]); return; }
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`${API_BASE_URL}/api/users/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (data.success) setSearchResults(data.users || []);
      } catch {}
      setIsSearching(false);
    }, 500);
  };

  // ── View another user's profile ──
  const handleViewUserProfile = async (userId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${userId}/profile`);
      const data = await res.json();
      if (data.success) setViewingProfile(data.user);
    } catch {}
  };

  const joinedDate = localUser?.createdAt
    ? new Date(localUser.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' })
    : null;

  const publicPlaylists = localPlaylists.filter(p => p.isPublic !== false);
  const privatePlaylists = localPlaylists.filter(p => p.isPublic === false);

  // ── Viewing another user's profile ──
  if (viewingProfile) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#121212' }}>
        <div className="flex items-center gap-3 px-4 py-4 border-b border-white/10">
          <button onClick={() => setViewingProfile(null)} className="p-2 text-white hover:text-zinc-400 transition-colors">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-lg font-extrabold text-white">{viewingProfile.name}</h1>
        </div>
        <div className="flex-1 overflow-y-auto">
          {/* Profile Header */}
          <div className="px-6 py-8 text-center"
            style={{ background: 'linear-gradient(180deg, #1DB95440 0%, transparent 100%)' }}>
            <div className="w-28 h-28 rounded-full mx-auto mb-4 overflow-hidden border-4 border-white/20 shadow-2xl bg-zinc-800 flex items-center justify-center">
              {viewingProfile.avatar ? (
                <img src={viewingProfile.avatar} alt={viewingProfile.name} className="w-full h-full object-cover" />
              ) : (
                <User size={48} className="text-zinc-400" />
              )}
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-1">{viewingProfile.name}</h2>
            {viewingProfile.bio && (
              <p className="text-sm text-zinc-400 mt-2 max-w-xs mx-auto">{viewingProfile.bio}</p>
            )}
            <div className="flex items-center justify-center gap-4 mt-4">
              <span className="text-sm text-zinc-400">
                <span className="text-white font-bold">{viewingProfile.playlistCount}</span> قائمة تشغيل عامة
              </span>
            </div>
          </div>

          {/* Public Playlists */}
          <div className="px-4 pb-8">
            <h3 className="text-base font-bold text-white mb-4">القوائم العامة</h3>
            {viewingProfile.publicPlaylists?.length > 0 ? (
              <div className="space-y-2">
                {viewingProfile.publicPlaylists.map(pl => (
                  <div key={pl.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-800 shrink-0 flex items-center justify-center">
                      {pl.isLikedSongs ? (
                        <div className="w-full h-full flex items-center justify-center"
                          style={{ background: 'linear-gradient(135deg, #450af5, #c4efd9)' }}>
                          <Heart size={18} fill="white" className="text-white" />
                        </div>
                      ) : pl.cover ? (
                        <img src={pl.cover} alt={pl.name} className="w-full h-full object-cover" />
                      ) : (
                        <Music size={20} className="text-zinc-500" />
                      )}
                    </div>
                    <div className="flex-1 truncate">
                      <p className="text-sm font-semibold text-white truncate">{pl.name}</p>
                      <p className="text-xs text-zinc-500">{pl.trackCount} أغنية</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500 text-center py-8">لا توجد قوائم تشغيل عامة</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: '#121212' }}>
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 shrink-0">
        <button onClick={onBack} className="p-2 text-white hover:text-zinc-400 transition-colors">
          <ArrowLeft size={22} />
        </button>
        <div className="flex-1 flex gap-2">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
              activeTab === 'profile' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            بروفايلي
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${
              activeTab === 'search' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white'
            }`}
          >
            ابحث عن ناس
          </button>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/15 hover:bg-red-500/30 border border-red-500/30 rounded-full text-xs font-bold text-red-400 transition-all"
          title="تسجيل الخروج"
        >
          <LogOut size={14} />
          <span>خروج</span>
        </button>
      </div>

      {/* ── PROFILE TAB ── */}
      {activeTab === 'profile' && (
        <div className="flex-1 overflow-y-auto">
          {/* Profile Header with Gradient */}
          <div className="relative px-6 pb-6 pt-8 text-center"
            style={{ background: 'linear-gradient(180deg, #1DB95450 0%, transparent 100%)' }}>
            
            {/* Avatar */}
            <div className="relative inline-block mb-4">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white/20 shadow-2xl bg-zinc-800 flex items-center justify-center mx-auto">
                {isUploadingAvatar ? (
                  <Loader2 size={32} className="animate-spin text-[#1DB954]" />
                ) : localUser?.avatar ? (
                  <img src={localUser.avatar} alt={localUser?.name} className="w-full h-full object-cover" />
                ) : (
                  <User size={48} className="text-zinc-400" />
                )}
              </div>
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={isUploadingAvatar}
                className="absolute bottom-0 right-0 w-9 h-9 bg-[#1DB954] hover:bg-[#1ed760] rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110 active:scale-95 disabled:opacity-50"
              >
                <Camera size={16} className="text-black" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>

            {/* Name */}
            <div className="mb-3">
              {isEditingName ? (
                <div className="flex items-center gap-2 justify-center">
                  <input
                    value={nameInput}
                    onChange={e => setNameInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                    className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white text-xl font-bold text-center focus:outline-none focus:border-[#1DB954] max-w-[240px]"
                    autoFocus
                  />
                  <button onClick={handleSaveName} disabled={isSaving} className="p-2 bg-[#1DB954] rounded-full text-black hover:bg-[#1ed760] transition-all disabled:opacity-50">
                    {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  </button>
                  <button onClick={() => setIsEditingName(false)} className="p-2 bg-white/10 rounded-full text-white hover:bg-white/20 transition-all">
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 justify-center">
                  <h1 className="text-3xl font-extrabold text-white">{localUser?.name || 'مستخدم'}</h1>
                  <button onClick={() => setIsEditingName(true)} className="p-1.5 text-zinc-400 hover:text-white transition-colors">
                    <Edit2 size={16} />
                  </button>
                </div>
              )}
            </div>

            {/* Bio */}
            <div className="max-w-xs mx-auto mb-4">
              {isEditingBio ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={bioInput}
                    onChange={e => setBioInput(e.target.value)}
                    placeholder="اكتب نبذة عنك..."
                    rows={3}
                    className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white text-sm text-center focus:outline-none focus:border-[#1DB954] resize-none"
                    autoFocus
                  />
                  <div className="flex gap-2 justify-center">
                    <button onClick={handleSaveBio} disabled={isSaving} className="px-4 py-1.5 bg-[#1DB954] rounded-full text-black text-xs font-bold hover:bg-[#1ed760] transition-all disabled:opacity-50 flex items-center gap-1">
                      {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      <span>حفظ</span>
                    </button>
                    <button onClick={() => setIsEditingBio(false)} className="px-4 py-1.5 bg-white/10 rounded-full text-white text-xs font-bold hover:bg-white/20 transition-all">
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setIsEditingBio(true)} className="group flex items-center gap-1.5 justify-center w-full hover:opacity-80 transition-opacity">
                  <p className="text-base text-zinc-300 font-medium">
                    {localUser?.bio || <span className="text-zinc-600 italic text-sm">اضغط لإضافة نبذة...</span>}
                  </p>
                  <Edit2 size={13} className="text-zinc-600 group-hover:text-zinc-400 transition-colors shrink-0" />
                </button>
              )}
            </div>

            {/* Stats row */}
            <div className="flex items-center justify-center gap-8 mt-6">
              <div className="text-center">
                <p className="text-2xl font-extrabold text-white">{localPlaylists.filter(p => !p.isLikedSongs).length}</p>
                <p className="text-xs text-zinc-500 mt-0.5">قوائم التشغيل</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <p className="text-2xl font-extrabold text-white">{publicPlaylists.filter(p => !p.isLikedSongs).length}</p>
                <p className="text-xs text-zinc-500 mt-0.5">عامة</p>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div className="text-center">
                <p className="text-2xl font-extrabold text-white">{privatePlaylists.filter(p => !p.isLikedSongs).length}</p>
                <p className="text-xs text-zinc-500 mt-0.5">خاصة</p>
              </div>
            </div>
          </div>

          {/* ── Playlists Section ── */}
          <div className="px-4 pb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-white">قوائم التشغيل</h2>
              <p className="text-xs text-zinc-500">اضغط 👁 لتغيير الظهور</p>
            </div>

            {localPlaylists.filter(p => !p.isLikedSongs).length === 0 ? (
              <div className="text-center py-12">
                <Music size={48} className="mx-auto mb-3 text-zinc-700" />
                <p className="text-sm text-zinc-500">لا توجد قوائم تشغيل بعد</p>
              </div>
            ) : (
              <div className="space-y-2">
                {localPlaylists.filter(p => !p.isLikedSongs).map(pl => {
                  const isPublic = pl.isPublic !== false;
                  const isToggling = togglingId === pl.id;
                  return (
                    <div key={pl.id}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors group">
                      
                      {/* Cover */}
                      <button onClick={() => onSelectPlaylist && onSelectPlaylist(pl)} className="shrink-0">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-zinc-800 flex items-center justify-center">
                          {pl.isLikedSongs ? (
                            <div className="w-full h-full flex items-center justify-center"
                              style={{ background: 'linear-gradient(135deg, #450af5, #c4efd9)' }}>
                              <Heart size={18} fill="white" className="text-white" />
                            </div>
                          ) : pl.cover ? (
                            <img src={pl.cover} alt={pl.name} className="w-full h-full object-cover"
                              onError={e => { e.target.style.display = 'none'; }} />
                          ) : (
                            <Music size={20} className="text-zinc-500" />
                          )}
                        </div>
                      </button>

                      {/* Info */}
                      <button onClick={() => onSelectPlaylist && onSelectPlaylist(pl)} className="flex-1 text-left truncate">
                        <p className="text-sm font-semibold text-white truncate">{pl.name}</p>
                        <p className="text-xs text-zinc-500">{(pl.trackIds || []).length} أغنية</p>
                      </button>

                      {/* Visibility toggle */}
                      {!pl.isLikedSongs && (
                        <button
                          onClick={() => handleToggleVisibility(pl)}
                          disabled={isToggling}
                          className={`p-2 rounded-full transition-all hover:scale-110 active:scale-95 ${
                            isPublic ? 'text-[#1DB954] hover:text-[#1DB954]/80' : 'text-zinc-600 hover:text-zinc-400'
                          }`}
                          title={isPublic ? 'عامة — اضغط لتخصيص' : 'خاصة — اضغط لعرض للعامة'}
                        >
                          {isToggling ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : isPublic ? (
                            <Eye size={16} />
                          ) : (
                            <EyeOff size={16} />
                          )}
                        </button>
                      )}

                      {/* Badge */}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        isPublic
                          ? 'bg-[#1DB954]/15 text-[#1DB954] border border-[#1DB954]/30'
                          : 'bg-white/5 text-zinc-500 border border-white/10'
                      }`}>
                        {isPublic ? 'عام' : 'خاص'}
                      </span>

                      <ChevronRight size={14} className="text-zinc-700 shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SEARCH TAB ── */}
      {activeTab === 'search' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search Input */}
          <div className="px-4 py-3 border-b border-white/10">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => handleSearchChange(e.target.value)}
                placeholder="ابحث بالاسم أو الإيميل..."
                className="w-full bg-white/10 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#1DB954] transition-colors"
                autoFocus
              />
              {isSearching && (
                <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 animate-spin" />
              )}
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {searchQuery.length < 2 ? (
              <div className="text-center py-16">
                <Search size={48} className="mx-auto mb-3 text-zinc-700" />
                <p className="text-sm text-zinc-500">ابحث عن أي مستخدم</p>
              </div>
            ) : searchResults.length === 0 && !isSearching ? (
              <div className="text-center py-16">
                <User size={48} className="mx-auto mb-3 text-zinc-700" />
                <p className="text-sm text-zinc-500">لا توجد نتائج</p>
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map(user => (
                  <button
                    key={user.id}
                    onClick={() => handleViewUserProfile(user.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left active:scale-[0.99]"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-800 shrink-0 flex items-center justify-center">
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <User size={20} className="text-zinc-500" />
                      )}
                    </div>
                    <div className="flex-1 truncate">
                      <p className="text-sm font-semibold text-white">{user.name}</p>
                      <p className="text-xs text-zinc-500 truncate">
                        {user.publicPlaylists?.length || 0} قائمة عامة
                        {user.bio ? ` • ${user.bio}` : ''}
                      </p>
                    </div>
                    <ChevronRight size={16} className="text-zinc-600 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
