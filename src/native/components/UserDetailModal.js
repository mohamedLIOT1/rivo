import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  ArrowLeft,
  Users,
  MessageSquare,
  UserPlus,
  UserCheck,
  Disc,
  Play,
  Radio,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  Music,
} from 'lucide-react-native';
import { API_BASE_URL } from '../config';
import { useUser } from '../context/UserContext';
import { useAudioPlayer } from '../context/AudioContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { colors } from '../theme/colors';
import { normalizeCoverUri } from '../utils/coverUtils';
import MiniPlayer from './MiniPlayer';

const { width } = Dimensions.get('window');

export default function UserDetailModal({
  visible,
  user,
  userId,
  onClose,
  onOpenChat,
  onOpenFullPlayer,
}) {
  const { token, currentUser } = useUser();
  const { playTrack, currentTrack } = useAudioPlayer();
  const { isDark } = useTheme();
  const { showToast } = useToast();

  const [profile, setProfile] = useState(user || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isTogglingFollow, setIsTogglingFollow] = useState(false);
  const [playlists, setPlaylists] = useState([]);
  const [activity, setActivity] = useState(null);

  const targetId = String(userId || user?.id || user?._id || '');

  // Fetch full user profile & public playlists
  useEffect(() => {
    if (!visible || !targetId) return;

    let isMounted = true;
    setIsLoading(true);

    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(targetId)}/profile`, { headers })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data) return;
        const u = data.user || data;
        setProfile(u);
        setIsFollowing(Boolean(data.isFollowing || u.isFollowed));
        if (Array.isArray(data.playlists || u.publicPlaylists)) {
          setPlaylists(data.playlists || u.publicPlaylists);
        }
        if (data.activity || u.currentListening) {
          setActivity(data.activity || u.currentListening);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [visible, targetId, token]);

  if (!visible) return null;

  const currentProfile = profile || user || {};
  const displayName = currentProfile.name || 'Anonymous Listener';
  const initial = displayName.charAt(0).toUpperCase() || 'U';
  const avatarUrl = currentProfile.avatar;
  const followersCount = currentProfile.followersCount !== undefined
    ? currentProfile.followersCount
    : (Array.isArray(currentProfile.followers) ? currentProfile.followers.length : 0);
  const followingCount = currentProfile.followingCount !== undefined
    ? currentProfile.followingCount
    : (Array.isArray(currentProfile.following) ? currentProfile.following.length : 0);
  const isSelf = String(currentUser?._id || currentUser?.id || '') === targetId;

  const handleToggleFollow = async () => {
    if (!token) {
      showToast('Please sign in to follow listeners', 'info');
      return;
    }
    if (isSelf) return;

    setIsTogglingFollow(true);
    const prev = isFollowing;
    setIsFollowing(!prev);

    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(targetId)}/follow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        const active = data?.following ?? !prev;
        setIsFollowing(active);
        showToast(active ? `Following ${displayName}` : `Unfollowed ${displayName}`, 'info');
      } else {
        setIsFollowing(prev);
      }
    } catch {
      setIsFollowing(prev);
    } finally {
      setIsTogglingFollow(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.container, !isDark && styles.containerLight]}>
        {/* Top Header Bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.8}>
            <ArrowLeft size={18} color="#fdfbf7" strokeWidth={2.5} />
            <Text style={styles.backText}>RETURN</Text>
          </TouchableOpacity>

          <View style={styles.badgePill}>
            <Text style={styles.badgePillText}>COMMUNITY LISTENER PROFILE</Text>
          </View>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Section */}
          <View style={styles.heroCard}>
            <View style={styles.avatarWrap}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatarImg} resizeMode="cover" />
              ) : (
                <View style={styles.initialsBox}>
                  <Text style={styles.initialsText}>{initial}</Text>
                </View>
              )}
            </View>

            <View style={styles.nameRow}>
              <Text style={styles.userName}>{displayName}</Text>
              {(currentProfile.isVerified || currentProfile.role === 'admin') && (
                <View style={styles.verifiedBadge}>
                  <ShieldCheck size={14} color="#17a398" strokeWidth={2.5} />
                </View>
              )}
            </View>

            {currentProfile.bio ? (
              <Text style={styles.userBio}>{currentProfile.bio}</Text>
            ) : null}

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{followersCount}</Text>
                <Text style={styles.statLabel}>FOLLOWERS</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{followingCount}</Text>
                <Text style={styles.statLabel}>FOLLOWING</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNum}>{playlists.length}</Text>
                <Text style={styles.statLabel}>PLAYLISTS</Text>
              </View>
            </View>

            {/* Action Buttons: Follow & Chat */}
            {!isSelf && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.followBtn, isFollowing && styles.followBtnActive]}
                  onPress={handleToggleFollow}
                  disabled={isTogglingFollow}
                  activeOpacity={0.85}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck size={15} color="#0b1110" strokeWidth={2.5} />
                      <Text style={styles.followBtnTextActive}>FOLLOWING</Text>
                    </>
                  ) : (
                    <>
                      <UserPlus size={15} color="#0b1110" strokeWidth={2.5} />
                      <Text style={styles.followBtnText}>FOLLOW LISTENER</Text>
                    </>
                  )}
                </TouchableOpacity>

                {onOpenChat && (
                  <TouchableOpacity
                    style={styles.chatBtn}
                    onPress={() => {
                      onClose();
                      onOpenChat(currentProfile);
                    }}
                    activeOpacity={0.85}
                  >
                    <MessageSquare size={15} color="#26c4b7" strokeWidth={2.5} />
                    <Text style={styles.chatBtnText}>MESSAGE</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Real-time Listening Activity */}
          {activity && (activity.track || activity.title) && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Radio size={14} color="#f59e0b" strokeWidth={2.5} />
                  <Text style={styles.sectionTitle}>CURRENTLY STREAMING</Text>
                </View>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>LIVE</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.activityCard}
                onPress={() => {
                  const t = activity.track || activity;
                  if (t) playTrack(t);
                }}
                activeOpacity={0.85}
              >
                <Image
                  source={{ uri: normalizeCoverUri(activity.track?.coverUrl || activity.cover || activity.track?.cover) }}
                  style={styles.activityCover}
                />
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={styles.activityTitle} numberOfLines={1}>
                    {activity.track?.title || activity.title || 'Live Stream'}
                  </Text>
                  <Text style={styles.activityArtist} numberOfLines={1}>
                    {activity.track?.artist || activity.artist || displayName}
                  </Text>
                </View>
                <View style={styles.listenAlongBtn}>
                  <Play size={12} color="#0b1110" fill="#0b1110" />
                  <Text style={styles.listenAlongText}>LISTEN</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Public Playlists Section */}
          <View style={styles.sectionContainer}>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Disc size={14} color="#17a398" strokeWidth={2.5} />
                <Text style={styles.sectionTitle}>PUBLIC PLAYLISTS</Text>
              </View>
              <Text style={styles.sectionCounter}>{playlists.length} CREATED</Text>
            </View>

            {isLoading && playlists.length === 0 ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#17a398" />
              </View>
            ) : playlists.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No public playlists shared yet.</Text>
              </View>
            ) : (
              <View style={styles.playlistsList}>
                {playlists.map((pl, idx) => {
                  const plTracks = pl.tracks || pl.trackIds || [];
                  const plCover = pl.cover || plTracks[0]?.coverUrl || plTracks[0]?.cover;
                  return (
                    <TouchableOpacity
                      key={pl.id || pl._id || idx}
                      style={styles.playlistRow}
                      onPress={() => {
                        if (Array.isArray(pl.tracks) && pl.tracks.length > 0) {
                          playTrack(pl.tracks[0], pl.tracks);
                          showToast(`Playing "${pl.name}"`, 'success');
                        } else {
                          showToast(`Opening "${pl.name}"`, 'info');
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <Image
                        source={{ uri: normalizeCoverUri(plCover) }}
                        style={styles.playlistThumb}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.playlistName} numberOfLines={1}>
                          {pl.name || 'Untitled Playlist'}
                        </Text>
                        <Text style={styles.playlistTrackCount}>
                          {plTracks.length} recordings
                        </Text>
                      </View>
                      <View style={styles.playIconBtn}>
                        <Play size={11} color="#0b1110" fill="#0b1110" />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>

          <View style={{ height: currentTrack ? 120 : 60 }} />
        </ScrollView>

        {/* Floating Mini Player matching home screen experience */}
        {currentTrack && (
          <MiniPlayer
            onOpenFullPlayer={onOpenFullPlayer}
            bottomOffset={Platform.OS === 'ios' ? 24 : 12}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1110',
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
  },
  containerLight: {
    backgroundColor: '#f4ede1',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141d1b',
    borderWidth: 1.5,
    borderColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  backText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '900',
    color: '#fdfbf7',
    letterSpacing: 0.5,
  },
  badgePill: {
    backgroundColor: '#141d1b',
    borderWidth: 1,
    borderColor: '#26c4b7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgePillText: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '900',
    color: '#26c4b7',
    letterSpacing: 0.5,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  heroCard: {
    backgroundColor: '#141d1b',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.5, shadowRadius: 0 },
      android: { elevation: 4 },
    }),
  },
  avatarWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2.5,
    borderColor: '#17a398',
    overflow: 'hidden',
    backgroundColor: '#182320',
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  initialsBox: {
    width: '100%',
    height: '100%',
    backgroundColor: '#17a398',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialsText: {
    fontFamily: 'monospace',
    fontSize: 34,
    fontWeight: '900',
    color: '#0b1110',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  userName: {
    fontFamily: 'monospace',
    fontSize: 18,
    fontWeight: '900',
    color: '#fdfbf7',
  },
  verifiedBadge: {
    marginLeft: 2,
  },
  userBio: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#0b1110',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    width: '100%',
    marginVertical: 14,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNum: {
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '900',
    color: '#26c4b7',
  },
  statLabel: {
    fontFamily: 'monospace',
    fontSize: 8.5,
    fontWeight: '800',
    color: '#6b7280',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  followBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#17a398',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  followBtnActive: {
    backgroundColor: '#26c4b7',
  },
  followBtnText: {
    fontFamily: 'monospace',
    fontSize: 10.5,
    fontWeight: '900',
    color: '#0b1110',
    letterSpacing: 0.5,
  },
  followBtnTextActive: {
    fontFamily: 'monospace',
    fontSize: 10.5,
    fontWeight: '900',
    color: '#0b1110',
    letterSpacing: 0.5,
  },
  chatBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#182320',
    borderWidth: 1.5,
    borderColor: '#26c4b7',
    borderRadius: 8,
    paddingVertical: 10,
    gap: 6,
  },
  chatBtnText: {
    fontFamily: 'monospace',
    fontSize: 10.5,
    fontWeight: '900',
    color: '#26c4b7',
    letterSpacing: 0.5,
  },
  sectionContainer: {
    backgroundColor: '#141d1b',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 3, height: 3 }, shadowOpacity: 0.4, shadowRadius: 0 },
      android: { elevation: 3 },
    }),
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  sectionTitle: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '900',
    color: '#fdfbf7',
    letterSpacing: 0.5,
  },
  sectionCounter: {
    fontFamily: 'monospace',
    fontSize: 9.5,
    fontWeight: '800',
    color: '#17a398',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#f59e0b',
  },
  liveText: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '900',
    color: '#f59e0b',
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b1110',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    padding: 10,
  },
  activityCover: {
    width: 44,
    height: 44,
    borderRadius: 6,
    marginRight: 10,
    backgroundColor: '#182320',
  },
  activityTitle: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '800',
    color: '#fdfbf7',
    marginBottom: 2,
  },
  activityArtist: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: '#9ca3af',
  },
  listenAlongBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#17a398',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  listenAlongText: {
    fontFamily: 'monospace',
    fontSize: 9.5,
    fontWeight: '900',
    color: '#0b1110',
  },
  playlistsList: {
    gap: 8,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0b1110',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 8,
    padding: 8,
  },
  playlistThumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 10,
    backgroundColor: '#182320',
  },
  playlistName: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '800',
    color: '#fdfbf7',
    marginBottom: 2,
  },
  playlistTrackCount: {
    fontFamily: 'monospace',
    fontSize: 9.5,
    color: '#9ca3af',
  },
  playIconBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#17a398',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCard: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#6b7280',
  },
});
