import { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../config';

const getToken = () => {
  try {
    return localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
  } catch {
    return '';
  }
};

export function useProfileScreenData({
  currentUser,
  playlists = [],
  viewingUserId = null,
  userPlaylists = [],
  onTogglePlaylistVisibility,
  onSavePlaylist,
  onUnsavePlaylist,
  t,
}) {
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
  const [viewingLoading, setViewingLoading] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [savingPlId, setSavingPlId] = useState(null);

  // Social Followers / Following Modal State
  const [socialModal, setSocialModal] = useState({
    isOpen: false,
    type: 'followers',
    title: '',
    users: [],
    artists: [],
    loading: false
  });

  const handleOpenSocialModal = useCallback(async (targetUserId, type, name = '') => {
    if (!targetUserId) return;
    const cleanUserId = encodeURIComponent(String(targetUserId).trim());
    const isFollowers = type === 'followers';
    const typeLabel = isFollowers ? t('profile.followers') : t('profile.following');
    setSocialModal({
      isOpen: true,
      type,
      title: `${typeLabel} • ${name || 'User'}`,
      users: [],
      artists: [],
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
          artists: !isFollowers ? (data.artists || []) : [],
          loading: false
        }));
      } else {
        setSocialModal(prev => ({ ...prev, loading: false }));
      }
    } catch {
      setSocialModal(prev => ({ ...prev, loading: false }));
    }
  }, [t]);

  useEffect(() => {
    setLocalUser(currentUser);
    setNameInput(currentUser?.name || '');
    setBioInput(currentUser?.bio || '');

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

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return;

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

  const handleViewUserProfile = useCallback(async (userId) => {
    if (!userId) return;
    setViewingLoading(true);
    try {
      const cleanUserId = encodeURIComponent(String(userId).trim());
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/users/${cleanUserId}/profile`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const data = await res.json();
      if (data.success && data.user) setViewingProfile(data.user);
    } catch (e) {
      console.warn('[ProfileScreen] Load user profile error:', e);
    } finally {
      setViewingLoading(false);
    }
  }, []);

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

  const allUserPlaylists = userPlaylists.length > 0 ? userPlaylists : (playlists || []);

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

  useEffect(() => {
    if (viewingUserId && String(viewingUserId).trim() !== String(currentUser?._id || currentUser?.id || '').trim()) {
      handleViewUserProfile(viewingUserId);
    } else {
      setViewingProfile(null);
    }
  }, [viewingUserId, currentUser, handleViewUserProfile]);

  return {
    isEditingName,
    setIsEditingName,
    isEditingBio,
    setIsEditingBio,
    nameInput,
    setNameInput,
    bioInput,
    setBioInput,
    isSaving,
    localUser,
    localPlaylists,
    togglingId,
    isUploadingAvatar,
    avatarInputRef,
    viewingProfile,
    setViewingProfile,
    viewingLoading,
    followLoading,
    savingPlId,
    socialModal,
    setSocialModal,
    allUserPlaylists,
    handleOpenSocialModal,
    handleAvatarChange,
    handleSaveName,
    handleSaveBio,
    handleToggleVisibility,
    handleViewUserProfile,
    handleToggleFollow,
    handleQuickSave,
  };
}
