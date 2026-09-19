import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Camera, Edit2, Check, X, Music, Heart, Globe, Lock,
  Eye, EyeOff, Search, User, Calendar, LogOut, LogIn, ChevronRight, Loader2,
  MessageSquare, UserPlus, UserCheck, Radio, Disc, Plus
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import VerifiedBadge from '../components/VerifiedBadge';
import { isQuranContent } from '../utils/quranUtils';

const getToken = () => {
  try {
    return localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
  } catch {
    return '';
  }
};

export default function ProfileScreen({ 
  currentUser, 
  playlists = [], 
  onBack, 
  logout, 
  openAuthModal,
  onSelectPlaylist,
  onOpenChat,
  onStartJamWithUser,
  onTogglePlaylistVisibility,
  onSavePlaylist,
  onUnsavePlaylist,
  userPlaylists = [],
  globalTheme = 'dark',
  viewingUserId = null,
  onClearViewingUser,
}) {
  const isDark = globalTheme === 'dark';
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

  const [viewingProfile, setViewingProfile] = useState(null);

  // Social Followers / Following Modal State
  const [socialModal, setSocialModal] = useState({
    isOpen: false,
    type: 'followers', // 'followers' | 'following'
    title: '',
    users: [],
    loading: false
  });

  const handleOpenSocialModal = async (targetUserId, type, name = '') => {
    if (!targetUserId) return;
    const cleanUserId = encodeURIComponent(String(targetUserId).trim());
    const isFollowers = type === 'followers';
    setSocialModal({
      isOpen: true,
      type,
      title: isFollowers ? `Followers • ${name || 'User'}` : `Following • ${name || 'User'}`,
      users: [],
      loading: true
    });

    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/users/${cleanUserId}/${type}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success) {
        setSocialModal(prev => ({
          ...prev,
          users: isFollowers ? (data.followers || []) : (data.following || []),
          loading: false
        }));
      } else {
        setSocialModal(prev => ({ ...prev, loading: false }));
      }
    } catch {
      setSocialModal(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    setLocalUser(currentUser);
    setNameInput(currentUser?.name || '');
    setBioInput(currentUser?.bio || '');

    // Fetch fresh profile with follower counts
    const token = getToken();
    if (token) {
      fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(r => r.json())
      .then(d => {
        if (d.success && d.user) {
          setLocalUser(d.user);
        }
      })
      .catch(() => {});
    }
  }, [currentUser]);

  useEffect(() => {
    setLocalPlaylists(playlists);
  }, [playlists]);

  // ── Handle avatar change ──
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAvatar(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result;
        const token = getToken();
        const res = await fetch(`${API_BASE_URL}/api/auth/update-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ avatar: base64 }),
        });
        const data = await res.json();
        if (data.success) {
          setLocalUser(data.user);
          localStorage.setItem('rivo_user', JSON.stringify(data.user));
          localStorage.setItem('liofy_user', JSON.stringify(data.user));
          if (data.token) {
            localStorage.setItem('rivo_token', data.token);
            localStorage.setItem('liofy_token', data.token);
          }
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
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/auth/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setLocalUser(data.user);
        localStorage.setItem('rivo_user', JSON.stringify(data.user));
        localStorage.setItem('liofy_user', JSON.stringify(data.user));
        if (data.token) {
          localStorage.setItem('rivo_token', data.token);
          localStorage.setItem('liofy_token', data.token);
        }
      }
    } catch {}
    setIsSaving(false);
    setIsEditingName(false);
  };

  // ── Save bio ──
  const handleSaveBio = async () => {
    setIsSaving(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/auth/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bio: bioInput }),
      });
      const data = await res.json();
      if (data.success) {
        setLocalUser(data.user);
        localStorage.setItem('rivo_user', JSON.stringify(data.user));
        localStorage.setItem('liofy_user', JSON.stringify(data.user));
        if (data.token) {
          localStorage.setItem('rivo_token', data.token);
          localStorage.setItem('liofy_token', data.token);
        }
      }
    } catch {}
    setIsSaving(false);
    setIsEditingBio(false);
  };

  // ── Toggle playlist visibility ──
  const handleToggleVisibility = async (pl) => {
    if (!pl || pl.isLikedSongs) return;
    const plId = String(pl.id || pl._id);
    setTogglingId(plId);

    const currentIsPublic = pl.isPublic !== false;
    const targetIsPublic = !currentIsPublic;

    setLocalPlaylists(prev => prev.map(p =>
      String(p.id || p._id) === plId ? { ...p, isPublic: targetIsPublic } : p
    ));

    if (onTogglePlaylistVisibility) {
      try {
        await onTogglePlaylistVisibility(plId);
      } catch (err) {
        console.warn('onTogglePlaylistVisibility error:', err);
      }
    }

    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/playlists/${encodeURIComponent(plId)}/toggle-visibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      const data = await res.json();
      if (data.success && typeof data.isPublic === 'boolean') {
        setLocalPlaylists(prev => prev.map(p =>
          String(p.id || p._id) === plId ? { ...p, isPublic: data.isPublic } : p
        ));
      }
    } catch (err) {
      console.warn('API toggle-visibility error:', err);
    }
    setTogglingId(null);
  };

  useEffect(() => {
    if (viewingUserId) {
      handleViewUserProfile(viewingUserId);
    }
  }, [viewingUserId]);

  const [followLoading, setFollowLoading] = useState(false);

  // ── View another user's profile ──
  const handleViewUserProfile = async (userId) => {
    if (!userId) return;
    try {
      const cleanUserId = encodeURIComponent(String(userId).trim());
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/users/${cleanUserId}/profile`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success) setViewingProfile(data.user);
    } catch {}
  };

  // ── Toggle Follow ──
  const handleToggleFollow = async () => {
    if (!viewingProfile || followLoading) return;
    const targetUserId = viewingProfile.id || viewingProfile._id;
    if (!targetUserId) return;
    setFollowLoading(true);
    const token = getToken();
    const isCurrentlyFollowing = viewingProfile.isFollowing;
    const endpoint = isCurrentlyFollowing ? 'unfollow' : 'follow';
    const cleanUserId = encodeURIComponent(String(targetUserId).trim());

    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${cleanUserId}/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setViewingProfile(prev => ({
          ...prev,
          isFollowing: data.isFollowing,
          followersCount: data.followersCount
        }));
      }
    } catch {}
    setFollowLoading(false);
  };

  // ── Social Modal Component (rendered in both own & other profile views) ──
  const renderSocialModal = () => {
    if (!socialModal.isOpen) return null;
    return (
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
        <div className={`brutal-border-thick rounded-2xl w-full max-w-sm p-4 brutal-shadow-lg ${
          isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
        }`}>
          <div className={`flex items-center justify-between border-b-2 pb-2 mb-3 ${
            isDark ? 'border-zinc-700' : 'border-black'
          }`}>
            <h3 className="font-display font-black text-sm">{socialModal.title}</h3>
            <button 
              onClick={() => setSocialModal(prev => ({ ...prev, isOpen: false }))}
              className={`w-6 h-6 rounded font-bold text-xs ${
                isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-white' : 'bg-zinc-200 hover:bg-zinc-300 text-[#0b1110]'
              }`}
            >
              ✕
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-2">
            {socialModal.loading ? (
              <div className="text-center py-6">
                <Loader2 size={20} className="animate-spin text-[#17a398] mx-auto" />
              </div>
            ) : socialModal.users.length === 0 ? (
              <p className="text-xs text-zinc-400 text-center py-4">No users found</p>
            ) : (
              socialModal.users.map(u => (
                <div 
                  key={u.id || u._id}
                  onClick={() => {
                    setSocialModal(prev => ({ ...prev, isOpen: false }));
                    handleViewUserProfile(u.id || u._id);
                  }}
                  className={`p-2 rounded-lg brutal-border flex items-center gap-2 cursor-pointer transition ${
                    isDark ? 'bg-zinc-900 border-zinc-700 hover:bg-zinc-800 text-white' : 'bg-white border-black hover:bg-[#ede5d3] text-[#0b1110]'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-[#17a398] brutal-border flex items-center justify-center font-bold text-xs text-[#0b1110] overflow-hidden shrink-0">
                    {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : u.name?.[0] || 'U'}
                  </div>
                  <div className="truncate flex-1">
                    <p className={`font-display font-bold text-xs truncate ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>{u.name}</p>
                    {u.bio ? <p className="text-[10px] text-zinc-400 truncate">{u.bio}</p> : null}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const allUserPlaylists = userPlaylists.length > 0 ? userPlaylists : (playlists || []);
  const [savingPlId, setSavingPlId] = useState(null);

  const handleQuickSave = async (pl) => {
    const plId = String(pl.id || pl._id);
    const isAlreadySaved = allUserPlaylists.some(p =>
      String(p.sourcePlaylistId) === plId || (String(p.id) === plId && p.sourcePlaylistId)
    );
    setSavingPlId(plId);
    try {
      if (isAlreadySaved) {
        if (onUnsavePlaylist) await onUnsavePlaylist(plId);
      } else {
        if (onSavePlaylist) await onSavePlaylist(pl);
      }
    } catch {}
    setSavingPlId(null);
  };

  // ── Viewing another user's profile ──
  if (viewingProfile) {
    const viewingId = viewingProfile.id || viewingProfile._id;
    const isMe = String(viewingId) === String(currentUser?.id || currentUser?._id);

    return (
      <div className={`flex-1 flex flex-col overflow-hidden select-none font-sans transition-colors ${
        isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'
      }`}>
        <div className={`flex items-center gap-3 px-4 py-3 brutal-border border-x-0 border-t-0 shrink-0 ${
          isDark ? 'bg-[#101716] border-zinc-800 text-white' : 'bg-[#0b1110] text-[#fdfbf7]'
        }`}>
          <button 
            onClick={() => {
              setViewingProfile(null);
              if (onClearViewingUser) onClearViewingUser();
              if (viewingUserId) onBack();
            }} 
            className={`w-8 h-8 rounded-lg brutal-border flex items-center justify-center brutal-btn cursor-pointer ${
              isDark ? 'bg-zinc-800 text-zinc-200 border-zinc-700' : 'bg-[#fdfbf7] text-[#0b1110]'
            }`}
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
          </button>
          <div className="flex items-center gap-2">
            <h1 className="font-display font-black text-sm text-white">{viewingProfile.name}</h1>
            <VerifiedBadge userOrName={viewingProfile} size={14} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6" style={{ paddingBottom: 'calc(var(--player-height) + 40px)' }}>
          {/* Profile Hero Card (Apothecary Dispensary Dossier Card) */}
          <div className={`rounded-2xl brutal-border-thick p-4 sm:p-6 mb-6 brutal-shadow-lg relative overflow-hidden ${
            isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#0b1110] paper-texture'
          }`}>
            {/* Profile Header Bar */}
            <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b-2 mb-4 ${
              isDark ? 'border-zinc-700' : 'border-[#0b1110]'
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-[#17a398] animate-pulse shrink-0" />
                <span className={`font-mono font-bold text-[10px] sm:text-xs tracking-wider truncate ${
                  isDark ? 'text-zinc-300' : 'text-zinc-700'
                }`}>
                  USER PROFILE // @{viewingProfile.name}
                </span>
              </div>
              <div className="self-start sm:self-auto border-2 border-dashed border-[#17a398] text-[#17a398] px-2 py-0.5 rounded font-mono font-black text-[9px] sm:text-[10px] -rotate-1 select-none shrink-0">
                MEMBER
              </div>
            </div>

            {/* Profile Body */}
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Photo Frame */}
              <div className="shrink-0 flex flex-col items-center">
                <div className={`w-32 h-32 sm:w-36 sm:h-36 rounded-2xl overflow-hidden brutal-border-thick brutal-shadow-sm relative ${
                  isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-[#ede5d3] border-black'
                }`}>
                  {viewingProfile.avatar ? (
                    <img src={viewingProfile.avatar} alt={viewingProfile.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User size={48} className={isDark ? "text-zinc-400" : "text-[#0b1110]"} />
                    </div>
                  )}
                </div>
                <span className={`mt-2 text-[10px] font-mono font-bold brutal-border px-2 py-0.5 rounded ${
                  isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-[#ede5d3] text-zinc-700'
                }`}>
                  ID: #{String(viewingProfile.id || viewingProfile._id || '').slice(-6)}
                </span>
              </div>

              {/* Profile Details & Social Stats */}
              <div className="flex-1 w-full text-center md:text-left">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-1">
                  <h2 className={`text-2xl sm:text-3xl font-display font-black ${
                    isDark ? 'text-white' : 'text-[#0b1110]'
                  }`}>
                    {viewingProfile.name}
                  </h2>
                  <VerifiedBadge userOrName={viewingProfile} size={20} />
                  <span className="text-[10px] font-mono font-bold bg-[#17a398] text-[#0b1110] px-2 py-0.5 rounded brutal-border">
                    LISTENER
                  </span>
                </div>

                {/* Bio */}
                <div className={`brutal-border rounded-xl p-3 sm:p-4 my-3 text-left ${
                  isDark ? 'bg-zinc-900/90 border-zinc-700' : 'bg-[#ede5d3] border-black'
                }`}>
                  <span className={`text-[11px] font-mono font-bold uppercase tracking-wider block mb-1 ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
                  }`}>
                    // Bio & About:
                  </span>
                  <p className={`text-sm sm:text-base font-sans font-medium leading-relaxed ${isDark ? 'text-zinc-100' : 'text-[#0b1110]'}`}>
                    {viewingProfile.bio || <span className="italic text-zinc-400">No bio written yet.</span>}
                  </p>
                </div>

                {/* Punch Card Stats */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 my-4">
                  <div className={`rounded-xl brutal-border p-2.5 brutal-shadow-sm text-center ${
                    isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-black text-[#0b1110]'
                  }`}>
                    <span className={`font-display font-black text-xl block leading-none mb-1 ${
                      isDark ? 'text-white' : 'text-[#0b1110]'
                    }`}>
                      {viewingProfile.playlistCount || 0}
                    </span>
                    <span className={`text-[9px] font-mono font-bold uppercase ${
                      isDark ? 'text-zinc-400' : 'text-zinc-600'
                    }`}>Playlists</span>
                  </div>

                  <div 
                    onClick={() => handleOpenSocialModal(viewingProfile.id || viewingProfile._id, 'followers', viewingProfile.name)}
                    className={`rounded-xl brutal-border p-2.5 brutal-shadow-sm text-center cursor-pointer transition ${
                      isDark ? 'bg-zinc-900 border-zinc-700 hover:bg-zinc-800' : 'bg-white border-black hover:bg-[#ede5d3]'
                    }`}
                  >
                    <span className="font-display font-black text-xl text-[#17a398] block leading-none mb-1">
                      {viewingProfile.followersCount || 0}
                    </span>
                    <span className={`text-[9px] font-mono font-bold uppercase ${
                      isDark ? 'text-zinc-400' : 'text-zinc-600'
                    }`}>Followers</span>
                  </div>

                  <div 
                    onClick={() => handleOpenSocialModal(viewingProfile.id || viewingProfile._id, 'following', viewingProfile.name)}
                    className={`rounded-xl brutal-border p-2.5 brutal-shadow-sm text-center cursor-pointer transition ${
                      isDark ? 'bg-zinc-900 border-zinc-700 hover:bg-zinc-800' : 'bg-white border-black hover:bg-[#ede5d3]'
                    }`}
                  >
                    <span className="font-display font-black text-xl text-[#17a398] block leading-none mb-1">
                      {viewingProfile.followingCount || 0}
                    </span>
                    <span className={`text-[9px] font-mono font-bold uppercase ${
                      isDark ? 'text-zinc-400' : 'text-zinc-600'
                    }`}>Following</span>
                  </div>
                </div>

                {/* Actions Bar (Follow, Chat, Jam) */}
                {!isMe && (
                  <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
                    <button
                      onClick={handleToggleFollow}
                      disabled={followLoading}
                      className={`px-4 py-2 rounded-xl font-display font-black text-xs brutal-border brutal-shadow-sm brutal-btn cursor-pointer ${
                        viewingProfile.isFollowing
                          ? isDark ? 'bg-zinc-800 text-white border-zinc-700' : 'bg-white text-[#0b1110]'
                          : 'bg-[#17a398] text-[#0b1110]'
                      }`}
                    >
                      {viewingProfile.isFollowing ? 'Following ✓' : '+ Follow'}
                    </button>

                    <button
                      onClick={() => onOpenChat && onOpenChat(viewingProfile)}
                      className={`px-4 py-2 rounded-xl font-display font-bold text-xs brutal-border brutal-shadow-sm brutal-btn cursor-pointer flex items-center gap-1.5 ${
                        isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700' : 'bg-white text-[#0b1110] hover:bg-[#ede5d3]'
                      }`}
                    >
                      <MessageSquare size={14} className="text-[#dc2626]" />
                      <span>Chat</span>
                    </button>

                    <button
                      onClick={() => onStartJamWithUser && onStartJamWithUser(viewingProfile)}
                      className="px-4 py-2 rounded-xl bg-[#f59e0b] hover:bg-[#fbb739] text-[#0b1110] font-display font-bold text-xs brutal-border brutal-shadow-sm brutal-btn cursor-pointer flex items-center gap-1.5"
                    >
                      <Radio size={14} className="animate-pulse" />
                      <span>Jam</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Public Playlists */}
          <div>
            <h3 className={`font-display font-black text-xl mb-3 ${
              isDark ? 'text-white' : 'text-[#fdfbf7] drop-shadow-[1.5px_1.5px_0px_#082621]'
            }`}>
              Public Playlists
            </h3>
            {viewingProfile.publicPlaylists?.filter(pl => !pl.isLikedSongs).length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {viewingProfile.publicPlaylists.filter(pl => !pl.isLikedSongs).map(pl => {
                  const plId = String(pl.id || pl._id);
                  const isSaved = allUserPlaylists.some(p =>
                    String(p.sourcePlaylistId) === plId || (String(p.id) === plId && p.sourcePlaylistId)
                  );
                  const isSavingThis = savingPlId === plId;

                  return (
                    <div 
                      key={pl.id || pl._id} 
                      onClick={() => onSelectPlaylist && onSelectPlaylist(pl)}
                      className={`p-3 rounded-xl brutal-border flex items-center gap-3 cursor-pointer brutal-shadow-sm hover:brutal-shadow transition ${
                        isDark ? 'bg-[#141d1b] border-zinc-700 hover:bg-zinc-900' : 'bg-[#fdfbf7] border-black hover:bg-[#ede5d3]'
                      }`}
                    >
                      <div className="w-12 h-12 rounded-lg bg-[#17a398] brutal-border shrink-0 flex items-center justify-center font-bold text-white">
                        {pl.cover ? <img src={pl.cover} alt="" className="w-full h-full object-cover rounded-md" /> : <Disc size={20} />}
                      </div>
                      <div className="truncate flex-1">
                        <p className={`font-display font-black text-xs truncate ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>{pl.name}</p>
                        <p className={`text-[10px] font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                          {(() => {
                            const isQ = Boolean(pl.isQuran || isQuranContent(pl));
                            const count = pl.trackCount || (pl.trackIds || []).length;
                            return `${count} ${isQ ? (count === 1 ? 'surah' : 'surahs') : (count === 1 ? 'song' : 'songs')}`;
                          })()}
                        </p>
                      </div>
                      {onSavePlaylist && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickSave(pl);
                          }}
                          disabled={isSavingThis}
                          className={`p-1.5 rounded-lg brutal-border flex items-center justify-center transition cursor-pointer shrink-0 ${
                            isSaved 
                              ? isDark ? 'bg-zinc-800 text-emerald-400 border-zinc-700 hover:bg-zinc-700' : 'bg-white text-emerald-600 border-black hover:bg-[#ede5d3]'
                              : 'bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110]'
                          }`}
                          title={isSaved ? "Saved in your library (Click to remove)" : "Save to your library"}
                        >
                          {isSavingThis ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : isSaved ? (
                            <Check size={14} strokeWidth={2.5} />
                          ) : (
                            <Plus size={14} strokeWidth={2.5} />
                          )}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className={`text-xs font-bold ${isDark ? 'text-zinc-400' : 'text-[#082621]'}`}>No public playlists available.</p>
            )}
          </div>
        </div>

        {/* Followers / Following Modal */}
        {renderSocialModal()}
      </div>
    );
  }

  // ── Main Profile View ──
  return (
    <div className={`flex-1 flex flex-col overflow-hidden select-none font-sans transition-colors ${
      isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'
    }`}>
      {/* ── Top Header ── */}
      <div className={`flex items-center justify-between px-4 py-2.5 brutal-border border-x-0 border-t-0 shrink-0 ${
        isDark ? 'bg-[#101716] border-zinc-800 text-white' : 'bg-[#0b1110] text-[#fdfbf7]'
      }`}>
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button 
            onClick={onBack} 
            className={`w-8 h-8 rounded-lg brutal-border flex items-center justify-center brutal-btn cursor-pointer shrink-0 ${
              isDark ? 'bg-zinc-800 text-zinc-200 border-zinc-700' : 'bg-[#fdfbf7] text-[#0b1110]'
            }`}
            title="Back"
          >
            <ArrowLeft size={16} strokeWidth={2.5} />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <h1 className={`font-display font-black text-sm sm:text-base truncate ${
              isDark ? 'text-white' : 'text-[#0b1110]'
            }`}>
              {currentUser ? currentUser.name : 'My Profile'}
            </h1>
            {currentUser && <VerifiedBadge userOrName={currentUser} size={14} />}
          </div>
        </div>

        {currentUser ? (
          <button
            onClick={logout}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 bg-[#dc2626] text-white rounded-lg brutal-border brutal-shadow-sm text-xs font-display font-black brutal-btn cursor-pointer shrink-0"
            title="Log Out"
          >
            <LogOut size={13} strokeWidth={2.5} />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        ) : (
          <button
            onClick={openAuthModal}
            className="flex items-center gap-1 px-2.5 sm:px-3.5 py-1.5 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] rounded-lg brutal-border brutal-shadow-sm text-xs font-display font-black brutal-btn cursor-pointer shrink-0"
            title="Sign In / Register"
          >
            <LogIn size={14} strokeWidth={2.5} />
            <span className="hidden sm:inline">Sign In</span>
          </button>
        )}
      </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-6" style={{ paddingBottom: 'calc(var(--player-height) + 40px)' }}>
          {/* Guest Alert Banner */}
          {!currentUser && (
            <div className={`brutal-border-thick rounded-2xl p-4 mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 brutal-shadow-sm ${
              isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-[#ede5d3] border-black'
            }`}>
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full bg-[#f59e0b] animate-pulse shrink-0" />
                <div>
                  <p className={`text-xs font-display font-black ${isDark ? 'text-white' : 'text-[#0b1110]'}`}>Guest Mode</p>
                  <p className={`text-[11px] font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-700'}`}>Sign in to save custom playlists, follow friends, and sync your music.</p>
                </div>
              </div>
              <button
                onClick={openAuthModal}
                className="shrink-0 px-4 py-2 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] rounded-xl brutal-border font-display font-black text-xs brutal-btn brutal-shadow-sm cursor-pointer"
              >
                Sign In Now
              </button>
            </div>
          )}

          {/* Profile Hero Card */}
          <div className={`rounded-2xl brutal-border-thick p-3 sm:p-6 mb-4 brutal-shadow-lg relative overflow-hidden ${
            isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#0b1110] paper-texture'
          }`}>
            
            {/* Header Bar */}
            <div className={`flex items-center justify-between pb-2.5 border-b-2 mb-3 ${
              isDark ? 'border-zinc-700' : 'border-[#0b1110]'
            }`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full ${currentUser ? 'bg-[#17a398]' : 'bg-[#f59e0b]'} animate-pulse shrink-0" />
                <span className={`font-mono font-bold text-[10px] sm:text-xs tracking-wider truncate ${
                  isDark ? 'text-zinc-300' : 'text-zinc-700'
                }`}>
                  USER PROFILE // @{localUser?.name || 'user'}
                </span>
              </div>
              <div className={`border-2 border-dashed ${currentUser ? 'border-[#17a398] text-[#17a398]' : 'border-[#f59e0b] text-[#0b1110]'} px-2 py-0.5 rounded font-mono font-black text-[9px] sm:text-[10px] -rotate-1 select-none shrink-0`}>
                {currentUser ? 'MEMBER' : 'GUEST'}
              </div>
            </div>

            {/* Profile Body: Horizontal layout */}
            <div className="flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6">
              
              {/* Photo Frame */}
              <div className="shrink-0 flex flex-col items-center">
                <div className="relative">
                  <div className={`w-32 h-32 sm:w-36 sm:h-36 rounded-2xl overflow-hidden brutal-border-thick brutal-shadow-sm flex items-center justify-center ${
                    isDark ? 'bg-zinc-900 border-zinc-700' : 'bg-[#ede5d3] border-black'
                  }`}>
                    {isUploadingAvatar ? (
                      <Loader2 size={36} className="animate-spin text-[#17a398]" />
                    ) : localUser?.avatar ? (
                      <img src={localUser.avatar} alt={localUser?.name} className="w-full h-full object-cover" />
                    ) : (
                      <User size={48} className={isDark ? "text-zinc-400" : "text-[#0b1110]"} />
                    )}
                  </div>
                  <button
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="absolute -bottom-2 -right-2 w-9 h-9 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] rounded-xl brutal-border flex items-center justify-center brutal-shadow-sm brutal-btn cursor-pointer"
                    title="Change Profile Photo"
                  >
                    <Camera size={15} strokeWidth={2.5} />
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>
                <span className={`mt-3 text-[10px] font-mono font-bold brutal-border px-2 py-0.5 rounded ${
                  isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-[#ede5d3] text-zinc-700'
                }`}>
                  ID: #{String(localUser?._id || localUser?.id || '001').slice(-6).toUpperCase()}
                </span>
              </div>

              {/* Profile Details & Social Stats */}
              <div className="flex-1 w-full text-center md:text-left">
                {/* Name */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-1">
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={nameInput}
                        onChange={e => setNameInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                        className={`brutal-border rounded-lg px-3 py-1 text-base font-display font-black focus:outline-none max-w-[220px] ${
                          isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-black text-[#0b1110]'
                        }`}
                        autoFocus
                      />
                      <button onClick={handleSaveName} disabled={isSaving} className="p-1.5 bg-[#17a398] rounded-lg brutal-border text-[#0b1110] cursor-pointer">
                        {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} strokeWidth={2.5} />}
                      </button>
                      <button onClick={() => setIsEditingName(false)} className={`p-1.5 rounded-lg brutal-border cursor-pointer ${
                        isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-zinc-200 text-[#0b1110]'
                      }`}>
                        <X size={13} strokeWidth={2.5} />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h1 className={`text-2xl sm:text-3xl font-display font-black tracking-tight ${
                        isDark ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]' : 'text-[#0b1110]'
                      }`}>
                        {localUser?.name || 'User'}
                      </h1>
                      <VerifiedBadge userOrName={localUser} size={20} />
                      <button 
                        onClick={() => setIsEditingName(true)} 
                        className={`p-1 transition cursor-pointer ${
                          isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-black'
                        }`}
                        title="Edit Name"
                      >
                        <Edit2 size={14} />
                      </button>
                      <span className="text-[10px] font-mono font-bold bg-[#17a398] text-[#0b1110] px-2 py-0.5 rounded brutal-border shrink-0">
                        LISTENER
                      </span>
                    </>
                  )}
                </div>

                {/* Bio */}
                <div className={`brutal-border rounded-xl p-3.5 sm:p-4 my-3 text-left ${
                  isDark ? 'bg-zinc-900/90 border-zinc-700' : 'bg-[#ede5d3] border-black'
                }`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[11px] font-mono font-bold uppercase tracking-wider ${
                      isDark ? 'text-zinc-400' : 'text-zinc-600'
                    }`}>
                      // Bio & About:
                    </span>
                    {!isEditingBio && (
                      <button 
                        onClick={() => setIsEditingBio(true)} 
                        className="text-xs font-mono font-bold text-[#17a398] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 size={12} /> Edit Bio
                      </button>
                    )}
                  </div>

                  {isEditingBio ? (
                    <div className="flex flex-col gap-2 mt-1">
                      <textarea
                        value={bioInput}
                        onChange={e => setBioInput(e.target.value)}
                        placeholder="Write a bio about yourself..."
                        rows={3}
                        className={`brutal-border rounded-lg p-2.5 text-sm sm:text-base font-sans focus:outline-none resize-none font-medium w-full leading-relaxed ${
                          isDark ? 'bg-zinc-900 text-white border-zinc-700' : 'bg-white text-[#0b1110] border-black'
                        }`}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button onClick={handleSaveBio} disabled={isSaving} className="px-3.5 py-1.5 bg-[#17a398] text-[#0b1110] font-bold text-xs rounded-lg brutal-border cursor-pointer">
                          {isSaving ? <Loader2 size={12} className="animate-spin" /> : 'Save Bio'}
                        </button>
                        <button onClick={() => setIsEditingBio(false)} className={`px-3.5 py-1.5 font-bold text-xs rounded-lg brutal-border cursor-pointer ${
                          isDark ? 'bg-zinc-800 text-zinc-300 border-zinc-700' : 'bg-zinc-200 text-[#0b1110]'
                        }`}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className={`text-sm sm:text-base font-sans font-medium leading-relaxed ${isDark ? 'text-zinc-100' : 'text-[#0b1110]'}`}>
                      {localUser?.bio || <span className="italic text-zinc-400">No bio written yet. Click "Edit Bio" to add one.</span>}
                    </p>
                  )}
                </div>

                {/* Archival Punch Card Stats */}
                <div className="grid grid-cols-3 gap-1.5 sm:gap-3 my-4">
                  <div className={`rounded-xl brutal-border p-2 sm:p-2.5 brutal-shadow-sm text-center ${
                    isDark ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-white border-black text-[#0b1110]'
                  }`}>
                    <span className={`font-display font-black text-lg sm:text-xl block leading-none mb-1 ${
                      isDark ? 'text-white' : 'text-[#0b1110]'
                    }`}>
                      {localPlaylists.filter(p => !p.isLikedSongs).length}
                    </span>
                    <span className={`text-[8px] sm:text-[9px] font-mono font-bold uppercase truncate block ${
                      isDark ? 'text-zinc-400' : 'text-zinc-600'
                    }`}>Playlists</span>
                  </div>

                  <div 
                    onClick={() => handleOpenSocialModal(localUser?._id || localUser?.id, 'followers', localUser?.name)}
                    className={`rounded-xl brutal-border p-2 sm:p-2.5 brutal-shadow-sm text-center cursor-pointer transition ${
                      isDark ? 'bg-zinc-900 border-zinc-700 hover:bg-zinc-800' : 'bg-white border-black hover:bg-[#ede5d3]'
                    }`}
                  >
                    <span className="font-display font-black text-lg sm:text-xl text-[#17a398] block leading-none mb-1">
                      {localUser?.followersCount ?? (Array.isArray(localUser?.followers) ? localUser.followers.length : 0)}
                    </span>
                    <span className={`text-[8px] sm:text-[9px] font-mono font-bold uppercase truncate block ${
                      isDark ? 'text-zinc-400' : 'text-zinc-600'
                    }`}>Followers</span>
                  </div>

                  <div 
                    onClick={() => handleOpenSocialModal(localUser?._id || localUser?.id, 'following', localUser?.name)}
                    className={`rounded-xl brutal-border p-2 sm:p-2.5 brutal-shadow-sm text-center cursor-pointer transition ${
                      isDark ? 'bg-zinc-900 border-zinc-700 hover:bg-zinc-800' : 'bg-white border-black hover:bg-[#ede5d3]'
                    }`}
                  >
                    <span className="font-display font-black text-lg sm:text-xl text-[#17a398] block leading-none mb-1">
                      {localUser?.followingCount ?? (Array.isArray(localUser?.following) ? localUser.following.length : 0)}
                    </span>
                    <span className={`text-[8px] sm:text-[9px] font-mono font-bold uppercase truncate block ${
                      isDark ? 'text-zinc-400' : 'text-zinc-600'
                    }`}>Following</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Playlists Section ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className={`font-display font-black text-xl tracking-tight ${
                isDark ? 'text-white' : 'text-[#fdfbf7] drop-shadow-[1.5px_1.5px_0px_#082621]'
              }`}>
                Playlists
              </h2>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded brutal-border ${
                isDark ? 'bg-zinc-800 border-zinc-700 text-zinc-300' : 'bg-[#fdfbf7] text-[#0b1110]'
              }`}>
                TAP EYE FOR PUBLIC / PRIVATE
              </span>
            </div>

            {localPlaylists.filter(p => !p.isLikedSongs).length === 0 ? (
              <div className={`text-center py-10 brutal-border rounded-xl p-4 ${
                isDark ? 'bg-[#141d1b] border-zinc-700 text-zinc-400' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
              }`}>
                <Music size={32} className="mx-auto mb-2 text-zinc-500" />
                <p className="text-xs font-bold">No playlists created yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {localPlaylists.filter(p => !p.isLikedSongs).map(pl => {
                  const isPublic = pl.isPublic !== false;
                  const isToggling = togglingId === pl.id;

                  return (
                    <div 
                      key={pl.id} 
                      className={`p-3 rounded-xl brutal-border flex items-center justify-between brutal-shadow-sm hover:brutal-shadow transition ${
                        isDark ? 'bg-[#141d1b] border-zinc-700 hover:bg-zinc-900' : 'bg-[#fdfbf7] border-black hover:bg-[#ede5d3]'
                      }`}
                    >
                      {/* Cover & Title */}
                      <button 
                        onClick={() => onSelectPlaylist && onSelectPlaylist(pl)}
                        className="flex items-center gap-3 text-left min-w-0 flex-1 cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-lg bg-[#17a398] brutal-border shrink-0 flex items-center justify-center font-bold text-white overflow-hidden">
                          {pl.cover ? (
                            <img src={pl.cover} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Disc size={20} className={isDark ? "text-white" : "text-[#0b1110]"} />
                          )}
                        </div>
                        <div className="truncate">
                          <p className={`font-display font-black text-xs truncate ${
                            isDark ? 'text-white' : 'text-[#0b1110]'
                          }`}>{pl.name}</p>
                          <p className={`text-[10px] font-bold ${
                            isDark ? 'text-zinc-400' : 'text-zinc-600'
                          }`}>
                            {(() => {
                              const isQ = Boolean(pl.isQuran || isQuranContent(pl));
                              const count = (pl.trackIds || []).length;
                              return `${count} ${isQ ? (count === 1 ? 'surah' : 'surahs') : (count === 1 ? 'song' : 'songs')}`;
                            })()}
                          </p>
                        </div>
                      </button>

                      {/* Visibility toggle button */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleVisibility(pl);
                          }}
                          disabled={isToggling}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg brutal-border text-[10px] font-bold cursor-pointer ${
                            isDark 
                              ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700' 
                              : 'bg-white border-black hover:bg-[#ede5d3] text-[#0b1110]'
                          }`}
                          title={isPublic ? 'Public — Click to make private' : 'Private — Click to make public'}
                        >
                          {isToggling ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : isPublic ? (
                            <>
                              <Eye size={12} className="text-[#17a398]" />
                              <span>Public</span>
                            </>
                          ) : (
                            <>
                              <EyeOff size={12} className="text-zinc-400" />
                              <span>Private</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      {/* Social Modal (Followers / Following) */}
      {renderSocialModal()}
    </div>
  );
}
