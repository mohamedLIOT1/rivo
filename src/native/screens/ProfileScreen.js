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
} from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { useAudioPlayer } from '../context/AudioContext';
import { useTheme } from '../context/ThemeContext';
import { normalizeCoverUri } from '../utils/coverUtils';
import { APP_VERSION } from '../version';
import { API_BASE_URL } from '../config';

const { width } = Dimensions.get('window');

export default function ProfileScreen({
  onOpenSettings,
  onOpenAuth,
  onOpenFriendActivity,
  onOpenJam,
  onOpenChat,
  onSelectPlaylist,
}) {
  const { currentUser, logout, playlists = [], likedTrackIds = [] } = useUser();
  const { downloadedTracks = [], playPlaylist } = useAudioPlayer();
  const { isDark } = useTheme();

  const safeLikedCount = Array.isArray(likedTrackIds) ? likedTrackIds.length : 0;
  const safeCratesCount = Array.isArray(playlists) ? playlists.length : 0;
  const safeDownloadedCount = Array.isArray(downloadedTracks) ? downloadedTracks.length : 0;

  const followersCount = Array.isArray(currentUser?.followers) 
    ? currentUser.followers.length 
    : (currentUser?.followersCount || 0);

  const followingCount = Array.isArray(currentUser?.following) 
    ? currentUser.following.length 
    : (currentUser?.followingCount || 0);

  const [socialModal, setSocialModal] = useState({
    isOpen: false,
    type: 'followers',
    title: 'Followers',
    users: [],
    loading: false,
  });

  const handleOpenSocialModal = async (type) => {
    const isFollowers = type === 'followers';
    setSocialModal({
      isOpen: true,
      type,
      title: isFollowers ? 'Followers' : 'Following',
      users: [],
      loading: true,
    });
    try {
      const uId = currentUser?._id || currentUser?.id;
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

  const userIdStr = currentUser?._id || currentUser?.id || '';
  const shortId = userIdStr ? String(userIdStr).slice(-6).toUpperCase() : 'GUEST';

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
              {currentUser ? `USER PROFILE // @${currentUser.name || 'listener'}` : 'GUEST MODE // ANONYMOUS'}
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
              {currentUser?.email || 'Sign in to sync your crates & Discord presence'}
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

        {/* PUNCH CARD STATS (Web Style & Image 4) */}
        <View style={styles.statsGrid}>
          <View style={[styles.statBox, !isDark && styles.statBoxLight]}>
            <Text style={[styles.statNumber, !isDark && styles.statNumberLight]}>{safeCratesCount}</Text>
            <Text style={styles.statLabel}>CRATES</Text>
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
            <Text style={styles.statLabel}>LIKED</Text>
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
            <Text style={styles.guestBannerSub}>Sign in to save crates, follow friends & sync Discord.</Text>
          </View>
          <View style={styles.guestBannerBtn}>
            <LogIn size={13} color="#0b1110" strokeWidth={2.8} />
            <Text style={styles.guestBannerBtnText}>SIGN IN</Text>
          </View>
        </TouchableOpacity>
      )}

      {/* ── DISCORD RICH PRESENCE INTEGRATION CARD ── */}
      <View style={styles.discordCard}>
        <View style={styles.discordHeader}>
          <View style={styles.discordIconWrap}>
            <Radio size={16} color="#ffffff" strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.discordTitle}>DISCORD RICH PRESENCE</Text>
            <Text style={styles.discordSub}>
              {currentUser ? 'Zero-latency live track sync enabled' : 'Connect account to broadcast tracks'}
            </Text>
          </View>
          <View style={styles.discordPulseWrap}>
            <View style={styles.discordPulseDot} />
            <Text style={styles.discordPulseText}>SYNC ON</Text>
          </View>
        </View>
        <Text style={styles.discordDesc}>
          Songs playing on this device automatically sync to your Discord profile activity as "Listening to Rivo".
        </Text>
      </View>

      {/* ── QUICK ACTIONS (FRIEND ACTIVITY, JAM, CHAT, SETTINGS) ── */}
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, !isDark && styles.sectionTitleLight]}>COMMUNITY & SOUND TOOLS</Text>
      </View>

      <View style={styles.actionGrid}>
        {/* Friend Activity */}
        <TouchableOpacity
          style={[styles.actionCard, !isDark && styles.actionCardLight]}
          onPress={onOpenFriendActivity}
          activeOpacity={0.85}
        >
          <View style={[styles.actionIconBox, { backgroundColor: 'rgba(23,163,152,0.18)', borderColor: '#17a398' }]}>
            <Users size={18} color="#17a398" strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionCardTitle, !isDark && styles.actionCardTitleLight]}>Friend Activity</Text>
            <Text style={styles.actionCardSub}>Live radar & listen along</Text>
          </View>
        </TouchableOpacity>

        {/* Live Jam Rooms */}
        <TouchableOpacity
          style={[styles.actionCard, !isDark && styles.actionCardLight]}
          onPress={onOpenJam}
          activeOpacity={0.85}
        >
          <View style={[styles.actionIconBox, { backgroundColor: 'rgba(245,158,11,0.18)', borderColor: '#f59e0b' }]}>
            <Radio size={18} color="#f59e0b" strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionCardTitle, !isDark && styles.actionCardTitleLight]}>Live Jam Room</Text>
            <Text style={styles.actionCardSub}>Group synchronizer</Text>
          </View>
        </TouchableOpacity>

        {/* Community Chat */}
        <TouchableOpacity
          style={[styles.actionCard, !isDark && styles.actionCardLight]}
          onPress={onOpenChat}
          activeOpacity={0.85}
        >
          <View style={[styles.actionIconBox, { backgroundColor: 'rgba(56,189,248,0.18)', borderColor: '#38bdf8' }]}>
            <MessageSquare size={18} color="#38bdf8" strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionCardTitle, !isDark && styles.actionCardTitleLight]}>Cairo Chat</Text>
            <Text style={styles.actionCardSub}>Share tapes & messages</Text>
          </View>
        </TouchableOpacity>

        {/* Settings */}
        <TouchableOpacity
          style={[styles.actionCard, !isDark && styles.actionCardLight]}
          onPress={onOpenSettings}
          activeOpacity={0.85}
        >
          <View style={[styles.actionIconBox, { backgroundColor: 'rgba(148,163,184,0.18)', borderColor: '#94a3b8' }]}>
            <SettingsIcon size={18} color="#94a3b8" strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.actionCardTitle, !isDark && styles.actionCardTitleLight]}>Engine Settings</Text>
            <Text style={styles.actionCardSub}>Audio buffer & vault</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* ── USER CRATES / PLAYLISTS SUMMARY ── */}
      {playlists.length > 0 && (
        <View style={{ marginTop: 20 }}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, !isDark && styles.sectionTitleLight]}>YOUR CRATES ({playlists.length})</Text>
          </View>
          {playlists.map((pl) => (
            <TouchableOpacity
              key={pl._id || pl.id}
              style={[styles.playlistRow, !isDark && styles.playlistRowLight]}
              onPress={() => onSelectPlaylist && onSelectPlaylist(pl)}
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
                  {(pl.tracks || pl.trackIds || []).length} TAPES
                </Text>
              </View>
              <View style={styles.playlistPlayBtn}>
                <Play size={12} color="#0b1110" fill="#0b1110" />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── LOG OUT / SIGN IN FOOTER BUTTON ── */}
      <View style={{ marginTop: 24, marginBottom: 30 }}>
        {currentUser ? (
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={logout}
            activeOpacity={0.85}
          >
            <LogOut size={16} color="#ef4444" strokeWidth={2.5} />
            <Text style={styles.logoutBtnText}>LOG OUT OF CITIZEN IDENTITY</Text>
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
                  <View key={u._id || u.id || String(i)} style={styles.socialUserItem}>
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
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
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
});
