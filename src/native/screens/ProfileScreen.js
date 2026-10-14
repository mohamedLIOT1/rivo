import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User,
  Disc,
  Heart,
  Download,
  Radio,
  Users,
  MessageSquare,
  Settings as SettingsIcon,
  LogOut,
  LogIn,
  Check,
  Play,
  Shield,
  Sparkles,
  X,
  ArrowLeft,
  ChevronRight,
  UserPlus,
} from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { useAudioPlayer } from '../context/AudioContext';
import { useTheme } from '../context/ThemeContext';
import { normalizeCoverUri } from '../utils/coverUtils';
import { APP_VERSION } from '../version';
import { API_BASE_URL } from '../config';
import AlbumDetailModal from '../components/AlbumDetailModal';

const { width } = Dimensions.get('window');

export default function ProfileScreen({
  onOpenSettings,
  onOpenAuth,
  onOpenFriendActivity,
  onOpenJam,
  onOpenChat,
  onSelectPlaylist,
  onOpenFullPlayer,
}) {
  const { currentUser, logout, playlists = [], likedTrackIds = [], tracks: userTracks = [], token } = useUser();
  const { downloadedTracks = [], playPlaylist } = useAudioPlayer();
  const { isDark } = useTheme();

  const [discordStatus, setDiscordStatus] = useState(null);

  useEffect(() => {
    if (!token) {
      setDiscordStatus(null);
      return;
    }
    fetch(`${API_BASE_URL}/api/discord/status`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && !d.error) setDiscordStatus(d);
      })
      .catch(() => {});
  }, [token, currentUser]);

  const safeLikedCount = Array.isArray(likedTrackIds) ? likedTrackIds.length : 0;
  const safeCratesCount = Array.isArray(playlists) ? playlists.length : 0;
  const safeDownloadedCount = Array.isArray(downloadedTracks) ? downloadedTracks.length : 0;

  const followersCount = Array.isArray(currentUser?.followers) 
    ? currentUser.followers.length 
    : (currentUser?.followersCount || 0);

  const followingCount = Array.isArray(currentUser?.following) 
    ? currentUser.following.length 
    : (currentUser?.followingCount || 0);

  const [viewingProfile, setViewingProfile] = useState(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [selectedPlaylistModal, setSelectedPlaylistModal] = useState(null);

  const [socialModal, setSocialModal] = useState({
    isOpen: false,
    type: 'followers',
    title: 'Followers',
    users: [],
    loading: false,
  });

  const handleOpenSocialModal = async (type, targetUserId = null) => {
    const isFollowers = type === 'followers';
    setSocialModal({
      isOpen: true,
      type,
      title: isFollowers ? 'Followers' : 'Following',
      users: [],
      loading: true,
    });
    try {
      const uId = targetUserId || currentUser?._id || currentUser?.id;
      if (!uId) {
        setSocialModal(p => ({ ...p, loading: false }));
        return;
      }
      const token = await AsyncStorage.getItem('@rivo_auth_token_v2');
      const res = await fetch(`${API_BASE_URL}/api/users/${uId}/${isFollowers ? 'followers' : 'following'}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setSocialModal(p => ({
          ...p,
          users: isFollowers ? (data.followers || []) : (data.following || []),
          loading: false,
        }));
      } else {
        setSocialModal(p => ({ ...p, loading: false }));
      }
    } catch {
      setSocialModal(p => ({ ...p, loading: false }));
    }
  };

  const handleSelectSocialUser = async (u) => {
    const targetId = u?._id || u?.id;
    if (!targetId) return;
    setSocialModal(p => ({ ...p, isOpen: false }));
    if (String(targetId) === String(currentUser?._id || currentUser?.id)) {
      setViewingProfile(null);
      return;
    }
    setViewingLoading(true);
    try {
      const token = await AsyncStorage.getItem('@rivo_auth_token_v2');
      const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(targetId)}/profile`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await res.json();
      if (data?.success && data?.user) {
        setViewingProfile(data.user);
      }
    } catch {}
    setViewingLoading(false);
  };

  const handleToggleFollow = async () => {
    if (!viewingProfile || followLoading) return;
    const targetId = viewingProfile.id || viewingProfile._id;
    if (!targetId) return;
    setFollowLoading(true);
    try {
      const token = await AsyncStorage.getItem('@rivo_auth_token_v2');
      const isCurrentlyFollowing = viewingProfile.isFollowing;
      const endpoint = isCurrentlyFollowing ? 'unfollow' : 'follow';
      const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(targetId)}/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data?.success) {
        setViewingProfile(prev => ({
          ...prev,
          isFollowing: data.isFollowing,
          followersCount: data.followersCount,
        }));
      }
    } catch {}
    setFollowLoading(false);
  };

  const userIdStr = currentUser?._id || currentUser?.id || '';
  const shortId = userIdStr ? String(userIdStr).slice(-6).toUpperCase() : 'GUEST';

  const renderSocialModal = () => (
    <Modal
      visible={socialModal.isOpen}
      animationType="fade"
      transparent={true}
      onRequestClose={() => setSocialModal(p => ({ ...p, isOpen: false }))}
    >
      <TouchableOpacity
        style={styles.socialModalOverlay}
        activeOpacity={1}
        onPress={() => setSocialModal(p => ({ ...p, isOpen: false }))}
      >
        <View style={styles.socialModalCard}>
          <View style={styles.socialModalHeader}>
            <Text style={styles.socialModalTitle}>{socialModal.title}</Text>
            <TouchableOpacity onPress={() => setSocialModal(p => ({ ...p, isOpen: false }))} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>

          {socialModal.loading ? (
            <View style={{ padding: 28, alignItems: 'center' }}>
              <ActivityIndicator size="small" color="#17a398" />
            </View>
          ) : socialModal.users.length === 0 ? (
            <View style={{ padding: 28, alignItems: 'center' }}>
              <Text style={{ color: '#94a3b8', fontSize: 12 }}>No {socialModal.title.toLowerCase()} found</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {socialModal.users.map((u, i) => (
                <TouchableOpacity
                  key={u._id || u.id || String(i)}
                  style={styles.socialUserItem}
                  onPress={() => handleSelectSocialUser(u)}
                  activeOpacity={0.7}
                >
                  <View style={styles.socialUserAvatarWrap}>
                    {u.avatar ? (
                      <Image source={{ uri: normalizeCoverUri(u.avatar) }} style={styles.socialUserAvatar} />
                    ) : (
                      <Text style={styles.socialUserLetter}>{u.name ? u.name[0].toUpperCase() : 'U'}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.socialUserName} numberOfLines={1}>{u.name}</Text>
                    {u.bio ? <Text style={styles.socialUserBio} numberOfLines={1}>{u.bio}</Text> : null}
                  </View>
                  <ChevronRight size={16} color="#94a3b8" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );

  if (viewingLoading) {
    return (
      <View style={[styles.container, { alignItems: 'center', justifyContent: 'center' }, !isDark && styles.containerLight]}>
        <ActivityIndicator size="large" color="#17a398" />
        <Text style={{ color: '#94a3b8', marginTop: 12, fontFamily: 'monospace', fontSize: 12 }}>Loading Profile...</Text>
      </View>
    );
  }

  if (viewingProfile) {
    const isMe = String(viewingProfile.id || viewingProfile._id) === String(currentUser?._id || currentUser?.id);
    const vCrates = viewingProfile.publicPlaylists || [];
    const vFollowers = viewingProfile.followersCount || 0;
    const vFollowing = viewingProfile.followingCount || 0;

    return (
      <ScrollView
        style={[styles.container, !isDark && styles.containerLight]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Back Button Bar */}
        <TouchableOpacity
          style={styles.backNavBar}
          onPress={() => setViewingProfile(null)}
          activeOpacity={0.8}
        >
          <ArrowLeft size={16} color="#17a398" strokeWidth={2.5} />
          <Text style={styles.backNavText}>BACK TO MY PROFILE</Text>
        </TouchableOpacity>

        {/* Hero Card for Target User */}
        <View style={[styles.heroCard, !isDark && styles.heroCardLight]}>
          <View style={styles.cardHeaderBar}>
            <View style={styles.statusIndicatorRow}>
              <View style={[styles.pulseDot, { backgroundColor: '#17a398' }]} />
              <Text style={[styles.statusText, !isDark && styles.statusTextLight]}>
                USER PROFILE // @{viewingProfile.name || 'USER'}
              </Text>
            </View>
            <View style={styles.memberBadge}>
              <Text style={styles.memberBadgeText}>MEMBER</Text>
            </View>
          </View>

          <View style={styles.userHeaderRow}>
            <View style={styles.avatarWrap}>
              {viewingProfile.avatar ? (
                <Image
                  source={{ uri: normalizeCoverUri(viewingProfile.avatar) }}
                  style={styles.avatarImg}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarLetter}>
                    {viewingProfile.name ? viewingProfile.name[0].toUpperCase() : 'U'}
                  </Text>
                </View>
              )}
              {viewingProfile.isVerified && (
                <View style={styles.verifiedBadge}>
                  <Check size={10} color="#0b1110" strokeWidth={3} />
                </View>
              )}
            </View>

            <View style={styles.userInfoCol}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.userName, !isDark && styles.userNameLight]} numberOfLines={1}>
                  {viewingProfile.name || 'User'}
                </Text>
                {viewingProfile.isVerified && (
                  <Check size={14} color="#17a398" strokeWidth={3} />
                )}
              </View>

              {viewingProfile.bio ? (
                <Text style={styles.userBioText} numberOfLines={2}>
                  {viewingProfile.bio}
                </Text>
              ) : null}

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <View style={styles.rolePill}>
                  <Text style={styles.rolePillText}>LISTENER</Text>
                </View>
                <View style={styles.idPill}>
                  <Text style={styles.idPillText}>ID: #{String(viewingProfile.id || viewingProfile._id || '').slice(-6).toUpperCase()}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Social Stats */}
          <View style={styles.statsGrid}>
            <View style={[styles.statBox, !isDark && styles.statBoxLight]}>
              <Text style={[styles.statNumber, !isDark && styles.statNumberLight]}>{vCrates.length}</Text>
              <Text style={styles.statLabel}>PLAYLISTS</Text>
            </View>

            <TouchableOpacity
              style={[styles.statBox, !isDark && styles.statBoxLight]}
              onPress={() => handleOpenSocialModal('followers', viewingProfile.id || viewingProfile._id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.statNumber, { color: '#17a398' }]}>{vFollowers}</Text>
              <Text style={styles.statLabel}>FOLLOWERS</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.statBox, !isDark && styles.statBoxLight]}
              onPress={() => handleOpenSocialModal('following', viewingProfile.id || viewingProfile._id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.statNumber, { color: '#17a398' }]}>{vFollowing}</Text>
              <Text style={styles.statLabel}>FOLLOWING</Text>
            </TouchableOpacity>
          </View>

          {/* Follow / Unfollow and Message Buttons */}
          {!isMe && currentUser && (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[styles.actionFollowBtn, viewingProfile.isFollowing && styles.actionFollowingBtn]}
                onPress={handleToggleFollow}
                disabled={followLoading}
                activeOpacity={0.8}
              >
                {followLoading ? (
                  <ActivityIndicator size="small" color="#0b1110" />
                ) : viewingProfile.isFollowing ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Check size={14} color="#0b1110" strokeWidth={3} />
                    <Text style={styles.actionFollowBtnText}>FOLLOWING</Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <UserPlus size={14} color="#0b1110" strokeWidth={3} />
                    <Text style={styles.actionFollowBtnText}>FOLLOW</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionMsgBtn}
                onPress={() => onOpenChat && onOpenChat({
                  id: viewingProfile.id || viewingProfile._id,
                  name: viewingProfile.name,
                  avatar: viewingProfile.avatar
                })}
                activeOpacity={0.8}
              >
                <MessageSquare size={14} color="#17a398" strokeWidth={2.4} />
                <Text style={styles.actionMsgBtnText}>MESSAGE</Text>
              </TouchableOpacity>

              {onOpenJam && (
                <TouchableOpacity
                  style={styles.actionJamBtn}
                  onPress={() => onOpenJam({
                    id: viewingProfile.id || viewingProfile._id,
                    name: viewingProfile.name,
                    avatar: viewingProfile.avatar
                  })}
                  activeOpacity={0.8}
                >
                  <Radio size={14} color="#0b1110" strokeWidth={2.4} />
                  <Text style={styles.actionJamBtnText}>JAM</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Cyber-brutalist Bio Card matching Web & Images 1 & 2 */}
          <View style={[styles.bioCard, !isDark && styles.bioCardLight]}>
            <Text style={[styles.bioHeader, !isDark && styles.bioHeaderLight]}>// BIO & ABOUT:</Text>
            <Text style={[styles.bioContent, !isDark && styles.bioContentLight]}>
              {viewingProfile.bio || 'No bio written yet.'}
            </Text>
          </View>
        </View>

        {/* Public Playlists Section */}
        <View style={styles.sectionHeader}>
          <Disc size={16} color="#17a398" strokeWidth={2.5} />
          <Text style={styles.sectionTitle}>
            PUBLIC PLAYLISTS ({vCrates.length})
          </Text>
        </View>

        {vCrates.length === 0 ? (
          <View style={styles.emptyCard}>
            <Disc size={32} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No Public Playlists</Text>
            <Text style={styles.emptySub}>No public playlists published yet.</Text>
          </View>
        ) : (
          <View style={{ gap: 10, marginTop: 10 }}>
            {vCrates.map((crate, idx) => (
              <TouchableOpacity
                key={crate._id || crate.id || String(idx)}
                style={styles.crateItemCard}
                onPress={() => {
                  setSelectedPlaylistModal(crate);
                }}
                activeOpacity={0.8}
              >
                <View style={styles.crateItemCoverWrap}>
                  {crate.cover ? (
                    <Image source={{ uri: normalizeCoverUri(crate.cover) }} style={styles.crateItemCover} />
                  ) : (
                    <Disc size={20} color="#17a398" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.crateItemTitle} numberOfLines={1}>{crate.name}</Text>
                  <Text style={styles.crateItemSub}>{crate.trackCount || (crate.trackIds || []).length} TRACKS</Text>
                </View>
                <View style={styles.cratePlayPill}>
                  <Play size={12} color="#0b1110" fill="#0b1110" style={{ marginLeft: 1 }} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Social Modal within viewingProfile */}
        {renderSocialModal()}

        {/* Playlist Full View Modal */}
        <AlbumDetailModal
          visible={Boolean(selectedPlaylistModal)}
          album={selectedPlaylistModal ? {
            id: selectedPlaylistModal.id || selectedPlaylistModal._id,
            name: selectedPlaylistModal.name,
            artist: viewingProfile.name || 'Listener',
            cover: selectedPlaylistModal.cover || selectedPlaylistModal.tracks?.[0]?.coverUrl || selectedPlaylistModal.tracks?.[0]?.cover,
            tracks: selectedPlaylistModal.tracks || [],
            trackIds: selectedPlaylistModal.trackIds || [],
            isPlaylist: true,
          } : null}
          onClose={() => setSelectedPlaylistModal(null)}
          allTracks={userTracks || []}
          onOpenFullPlayer={onOpenFullPlayer}
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, !isDark && styles.containerLight]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── TOP HERO PROFILE CARD ── */}
      <View style={[styles.heroCard, !isDark && styles.heroCardLight]}>
        {/* Status Bar Header */}
        <View style={styles.cardHeaderBar}>
          <View style={styles.statusIndicatorRow}>
            <View style={[styles.pulseDot, { backgroundColor: currentUser ? '#17a398' : '#f59e0b' }]} />
            <Text style={[styles.statusText, !isDark && styles.statusTextLight]}>
              {currentUser ? `@${currentUser.name || 'listener'}` : 'GUEST LISTENER'}
            </Text>
          </View>
          <View style={styles.memberBadge}>
            <Text style={styles.memberBadgeText}>{currentUser ? 'MEMBER' : 'GUEST'}</Text>
          </View>
        </View>

        {/* Profile Avatar & Info Row */}
        <View style={styles.profileRow}>
          <View style={styles.avatarWrap}>
            {currentUser?.avatar ? (
              <Image source={{ uri: normalizeCoverUri(currentUser.avatar) }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarLetter}>
                  {currentUser?.name ? currentUser.name[0].toUpperCase() : 'R'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.profileInfo}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={[styles.userName, !isDark && styles.userNameLight]} numberOfLines={1}>
                {currentUser?.name || 'Guest Listener'}
              </Text>
              {currentUser && (
                <View style={styles.verifiedBadge}>
                  <Check size={10} color="#0b1110" strokeWidth={3} />
                </View>
              )}
            </View>

            <Text style={styles.userEmail} numberOfLines={1}>
              {currentUser?.email || 'Sign in to sync your playlists & Discord presence'}
            </Text>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>
                  {currentUser?.role === 'admin' ? 'ADMIN' : 'LISTENER'}
                </Text>
              </View>
              <View style={styles.idPill}>
                <Text style={styles.idPillText}>ID: #{shortId}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* PUNCH CARD STATS */}
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, !isDark && styles.statBoxLight]}>
            <Text style={[styles.statNumber, !isDark && styles.statNumberLight]}>{safeCratesCount}</Text>
            <Text style={styles.statLabel}>PLAYLISTS</Text>
          </View>

          <TouchableOpacity
            style={[styles.statBox, !isDark && styles.statBoxLight]}
            onPress={() => handleOpenSocialModal('followers')}
            activeOpacity={0.8}
          >
            <Text style={[styles.statNumber, { color: '#17a398' }]}>{followersCount}</Text>
            <Text style={styles.statLabel}>FOLLOWERS</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statBox, !isDark && styles.statBoxLight]}
            onPress={() => handleOpenSocialModal('following')}
            activeOpacity={0.8}
          >
            <Text style={[styles.statNumber, { color: '#17a398' }]}>{followingCount}</Text>
            <Text style={styles.statLabel}>FOLLOWING</Text>
          </TouchableOpacity>

          <View style={[styles.statBox, !isDark && styles.statBoxLight]}>
            <Text style={[styles.statNumber, !isDark && styles.statNumberLight, { color: '#ef4444' }]}>{safeLikedCount}</Text>
            <Text style={styles.statLabel}>LIKED SONGS</Text>
          </View>
        </View>
      </View>

      {/* ── GUEST SIGN IN BANNER ── */}
      {!currentUser && (
        <TouchableOpacity
          style={styles.guestBanner}
          onPress={onOpenAuth}
          activeOpacity={0.85}
        >
          <View style={styles.guestBannerIcon}>
            <Sparkles size={20} color="#0b1110" strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.guestBannerTitle}>Unlock Full Rivo Experience</Text>
            <Text style={styles.guestBannerSub}>Sign in to save playlists, follow friends & sync Discord.</Text>
          </View>
          <View style={styles.guestBannerBtn}>
            <LogIn size={13} color="#0b1110" strokeWidth={2.8} />
            <Text style={styles.guestBannerBtnText}>SIGN IN</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── DISCORD RICH PRESENCE INTEGRATION CARD ── */}
      <TouchableOpacity
        style={styles.discordCard}
        onPress={() => onOpenSettings && onOpenSettings()}
        activeOpacity={0.85}
      >
        <View style={styles.discordHeader}>
          <View style={styles.discordIconWrap}>
            <Radio size={16} color="#ffffff" strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.discordTitle}>DISCORD RICH PRESENCE</Text>
            <Text style={styles.discordSub}>
              {discordStatus?.linked
                ? (discordStatus.enabled ? `@${discordStatus.username} • Live sync active` : `@${discordStatus.username} • Sync disabled`)
                : 'Connect Discord account to broadcast tracks'}
            </Text>
          </View>
          <View style={[
            styles.discordPulseWrap,
            !(discordStatus?.linked && discordStatus?.enabled) && { backgroundColor: 'rgba(156,163,175,0.2)' }
          ]}>
            <View style={[
              styles.discordPulseDot,
              !(discordStatus?.linked && discordStatus?.enabled) && { backgroundColor: '#9ca3af' }
            ]} />
            <Text style={[
              styles.discordPulseText,
              !(discordStatus?.linked && discordStatus?.enabled) && { color: '#9ca3af' }
            ]}>
              {discordStatus?.linked
                ? (discordStatus.enabled ? 'SYNC ON' : 'SYNC OFF')
                : 'NOT LINKED'}
            </Text>
          </View>
        </View>
        <Text style={styles.discordDesc}>
          {discordStatus?.linked
            ? (discordStatus.enabled
                ? 'Songs playing on this device automatically sync to your Discord profile activity.'
                : 'Discord sync is currently paused. Tap here to open settings and enable.')
            : 'Tap here to link your Discord account and broadcast live listening activity.'}
        </Text>
      </TouchableOpacity>

      {/* ── USER PLAYLISTS SUMMARY ── */}
      {playlists.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, !isDark && styles.sectionTitleLight]}>YOUR PLAYLISTS ({playlists.length})</Text>
          </View>
          {playlists.map((pl) => (
            <TouchableOpacity
              key={pl._id || pl.id}
              style={[styles.playlistRow, !isDark && styles.playlistRowLight]}
              onPress={() => setSelectedPlaylistModal(pl)}
              activeOpacity={0.85}
            >
              <View style={styles.playlistThumb}>
                {pl.cover ? (
                  <Image source={{ uri: normalizeCoverUri(pl.cover) }} style={styles.playlistThumbImg} />
                ) : (
                  <Disc size={20} color="#17a398" />
                )}
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={[styles.playlistRowTitle, !isDark && styles.playlistRowTitleLight]} numberOfLines={1}>
                  {pl.name}
                </Text>
                <Text style={styles.playlistRowCount}>
                  {(pl.tracks || pl.trackIds || []).length} SONGS
                </Text>
              </View>
              <View style={styles.playlistPlayBtn}>
                <Play size={12} color="#0b1110" fill="#0b1110" />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── SETTINGS & LOG OUT BUTTONS ── */}
      <View style={{ marginTop: 24, marginBottom: 30, gap: 10 }}>
        <TouchableOpacity
          style={styles.actionCard}
          onPress={onOpenSettings}
          activeOpacity={0.85}
        >
          <View style={[styles.actionIconBox, { backgroundColor: 'rgba(148,163,184,0.18)', borderColor: '#94a3b8' }]}>
            <SettingsIcon size={18} color="#94a3b8" strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionCardTitle, !isDark && styles.actionCardTitleLight]}>Settings</Text>
            <Text style={styles.actionCardSub}>Audio buffer, theme & account</Text>
          </View>
          <ChevronRight size={16} color="#64748b" />
        </TouchableOpacity>

        {currentUser ? (
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={logout}
            activeOpacity={0.85}
          >
            <LogOut size={16} color="#ef4444" strokeWidth={2.5} />
            <Text style={styles.logoutBtnText}>LOG OUT</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={onOpenAuth}
            activeOpacity={0.85}
          >
            <LogIn size={16} color="#0b1110" strokeWidth={2.8} />
            <Text style={styles.signInBtnText}>SIGN IN / REGISTER</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* SOCIAL FOLLOWERS / FOLLOWING MODAL */}
      {renderSocialModal()}

      {/* Playlist Tracks Full View Modal */}
      <AlbumDetailModal
        visible={Boolean(selectedPlaylistModal)}
        album={selectedPlaylistModal ? {
          id: selectedPlaylistModal.id || selectedPlaylistModal._id,
          name: selectedPlaylistModal.name,
          artist: selectedPlaylistModal.ownerName || currentUser?.name || 'Listener',
          cover: selectedPlaylistModal.cover || selectedPlaylistModal.tracks?.[0]?.coverUrl || selectedPlaylistModal.tracks?.[0]?.cover,
          tracks: selectedPlaylistModal.tracks || [],
          trackIds: selectedPlaylistModal.trackIds || [],
          isPlaylist: true,
        } : null}
        onClose={() => setSelectedPlaylistModal(null)}
        allTracks={userTracks || []}
        onOpenFullPlayer={onOpenFullPlayer}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1110',
  },
  containerLight: {
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 110,
  },
  heroCard: {
    backgroundColor: '#141d1b',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#263330',
    padding: 16,
    marginBottom: 14,
  },
  heroCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  cardHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#263330',
    paddingBottom: 10,
    marginBottom: 12,
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  statusTextLight: {
    color: '#64748b',
  },
  memberBadge: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#17a398',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 4,
  },
  memberBadgeText: {
    color: '#17a398',
    fontSize: 9,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: '#0b1110',
    borderWidth: 1.5,
    borderColor: '#17a398',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: '#17a398',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#0b1110',
    fontSize: 24,
    fontWeight: '900',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14,
  },
  userName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  userNameLight: {
    color: '#0b1110',
  },
  verifiedBadge: {
    backgroundColor: '#17a398',
    width: 15,
    height: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userEmail: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  rolePill: {
    backgroundColor: '#17a398',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  rolePillText: {
    color: '#0b1110',
    fontSize: 9,
    fontWeight: '900',
  },
  idPill: {
    backgroundColor: '#1f2e2a',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  idPillText: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#0e1715',
    borderWidth: 1,
    borderColor: '#263330',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  statBoxLight: {
    backgroundColor: '#f1f5f9',
    borderColor: '#cbd5e1',
  },
  statNumber: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  statNumberLight: {
    color: '#0f172a',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  guestBanner: {
    backgroundColor: '#17a398',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 10,
  },
  guestBannerIcon: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestBannerTitle: {
    color: '#0b1110',
    fontSize: 13,
    fontWeight: '900',
  },
  guestBannerSub: {
    color: '#082621',
    fontSize: 10,
    fontWeight: '700',
  },
  guestBannerBtn: {
    backgroundColor: '#ffffff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  guestBannerBtnText: {
    color: '#0b1110',
    fontSize: 10,
    fontWeight: '900',
  },
  discordCard: {
    backgroundColor: '#192038',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#5865F2',
    padding: 14,
    marginBottom: 16,
  },
  discordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  discordIconWrap: {
    backgroundColor: '#5865F2',
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discordTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  discordSub: {
    color: '#94a3b8',
    fontSize: 10,
  },
  discordPulseWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(88,101,242,0.3)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  discordPulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#57F287',
  },
  discordPulseText: {
    color: '#57F287',
    fontSize: 9,
    fontWeight: '900',
  },
  discordDesc: {
    color: '#cbd5e1',
    fontSize: 11,
    lineHeight: 16,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  sectionTitleLight: {
    color: '#475569',
  },
  actionGrid: {
    gap: 8,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141d1b',
    borderWidth: 1,
    borderColor: '#263330',
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  actionCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  actionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionCardTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  actionCardTitleLight: {
    color: '#0f172a',
  },
  actionCardSub: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 1,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141d1b',
    borderWidth: 1,
    borderColor: '#263330',
    borderRadius: 12,
    padding: 8,
    marginBottom: 6,
  },
  playlistRowLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
  },
  playlistThumb: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#0b1110',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  playlistThumbImg: {
    width: '100%',
    height: '100%',
  },
  playlistRowTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  playlistRowTitleLight: {
    color: '#0f172a',
  },
  playlistRowCount: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 1,
  },
  playlistPlayBtn: {
    backgroundColor: '#17a398',
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1.5,
    borderColor: '#ef4444',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  logoutBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  signInBtn: {
    backgroundColor: '#17a398',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  signInBtnText: {
    color: '#0b1110',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  socialModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  socialModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#141d1b',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#263330',
    padding: 16,
  },
  socialModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#263330',
    marginBottom: 10,
  },
  socialModalTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  socialUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1c2826',
    gap: 10,
  },
  socialUserAvatarWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#17a398',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  socialUserAvatar: {
    width: '100%',
    height: '100%',
  },
  socialUserLetter: {
    color: '#0b1110',
    fontSize: 14,
    fontWeight: '900',
  },
  socialUserName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  socialUserBio: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 2,
  },
  backNavBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#141d1b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#263330',
    marginBottom: 14,
  },
  backNavText: {
    color: '#17a398',
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  userBioText: {
    color: '#94a3b8',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
  },
  actionFollowBtn: {
    flex: 1,
    height: 42,
    backgroundColor: '#17a398',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionFollowingBtn: {
    backgroundColor: '#34d399',
  },
  actionFollowBtnText: {
    color: '#0b1110',
    fontWeight: '900',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  actionMsgBtn: {
    flex: 1,
    height: 42,
    backgroundColor: '#141d1b',
    borderWidth: 1,
    borderColor: '#17a398',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionMsgBtnText: {
    color: '#17a398',
    fontWeight: '900',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  actionJamBtn: {
    flex: 1,
    height: 42,
    backgroundColor: '#f59e0b',
    borderWidth: 1,
    borderColor: '#000000',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionJamBtnText: {
    color: '#0b1110',
    fontWeight: '900',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  bioCard: {
    backgroundColor: '#0e1614',
    borderWidth: 1.5,
    borderColor: '#263330',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  bioCardLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#cbd5e1',
  },
  bioHeader: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '800',
    color: '#94a3b8',
    letterSpacing: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  bioHeaderLight: {
    color: '#64748b',
  },
  bioContent: {
    fontSize: 12.5,
    color: '#e2e8f0',
    lineHeight: 18,
  },
  bioContentLight: {
    color: '#0b1110',
  },
  crateItemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#141d1b',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#263330',
  },
  crateItemCoverWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#1d2a27',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  crateItemCover: {
    width: '100%',
    height: '100%',
  },
  crateItemTitle: {
    color: '#fdfbf7',
    fontSize: 13,
    fontWeight: '700',
  },
  crateItemSub: {
    color: '#94a3b8',
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  cratePlayPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#17a398',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#141d1b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#263330',
    marginTop: 10,
  },
  emptyTitle: {
    color: '#fdfbf7',
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 10,
  },
  emptySub: {
    color: '#94a3b8',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
});
