import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  ShieldCheck,
  Users,
  Music2,
  Disc,
  UserCheck,
  ListMusic,
  Trash2,
  Search,
  Play,
  RefreshCw,
  AlertTriangle,
  Lock,
  Globe,
  CheckCircle2,
} from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { useAudioPlayer } from '../context/AudioContext';
import { useToast } from '../context/ToastContext';
import { colors } from '../theme/colors';
import { API_BASE_URL } from '../config';

export default function AdminScreen() {
  const { currentUser, tracks = [], token, fetchPublicTracks } = useUser();
  const { playTrack } = useAudioPlayer();
  const { showToast } = useToast();

  const isAdmin = currentUser?.role === 'admin' || currentUser?.email?.includes('admin');

  // Active tab: 'tracks' | 'accounts' | 'albums' | 'artists' | 'playlists'
  const [activeTab, setActiveTab] = useState('tracks');

  // Search queries per tab
  const [trackQuery, setTrackQuery] = useState('');
  const [trackFilter, setTrackFilter] = useState('all'); // 'all' | 'songs' | 'quran'

  const [userQuery, setUserQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const [albumQuery, setAlbumQuery] = useState('');
  const [albums, setAlbums] = useState([]);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(false);

  const [artistQuery, setArtistQuery] = useState('');
  const [artists, setArtists] = useState([]);
  const [isLoadingArtists, setIsLoadingArtists] = useState(false);

  const [playlistQuery, setPlaylistQuery] = useState('');
  const [adminPlaylists, setAdminPlaylists] = useState([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);

  const [deletingId, setDeletingId] = useState(null);

  // 1. Fetch Users
  const fetchUsers = async () => {
    if (!token) return;
    try {
      setIsLoadingUsers(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.users)) {
          setUsers(data.users);
        }
      }
    } catch {
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // 2. Fetch Albums
  const fetchAlbums = async () => {
    try {
      setIsLoadingAlbums(true);
      const res = await fetch(`${API_BASE_URL}/api/albums`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.albums)) {
          setAlbums(data.albums);
        }
      }
    } catch {
    } finally {
      setIsLoadingAlbums(false);
    }
  };

  // 3. Fetch Artists
  const fetchArtists = async () => {
    try {
      setIsLoadingArtists(true);
      const res = await fetch(`${API_BASE_URL}/api/artists`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.artists)) {
          setArtists(data.artists);
        }
      }
    } catch {
    } finally {
      setIsLoadingArtists(false);
    }
  };

  // 4. Fetch Playlists
  const fetchPlaylists = async () => {
    if (!token) return;
    try {
      setIsLoadingPlaylists(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/playlists`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.playlists)) {
          setAdminPlaylists(data.playlists);
        }
      }
    } catch {
    } finally {
      setIsLoadingPlaylists(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'accounts') fetchUsers();
    else if (activeTab === 'albums') fetchAlbums();
    else if (activeTab === 'artists') fetchArtists();
    else if (activeTab === 'playlists') fetchPlaylists();
  }, [activeTab]);

  const handleRefreshCurrent = () => {
    if (activeTab === 'tracks') fetchPublicTracks();
    else if (activeTab === 'accounts') fetchUsers();
    else if (activeTab === 'albums') fetchAlbums();
    else if (activeTab === 'artists') fetchArtists();
    else if (activeTab === 'playlists') fetchPlaylists();
  };

  // Delete Track
  const handleDeleteSong = (track) => {
    Alert.alert(
      'DELETE TRACK',
      `Permanently delete "${track.title}" from the master database?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const id = track._id || track.id;
            try {
              setDeletingId(id);
              const res = await fetch(`${API_BASE_URL}/api/tracks/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) {
                showToast(`Deleted "${track.title}"`, 'info');
                fetchPublicTracks();
              } else {
                showToast('Failed to delete track', 'error');
              }
            } catch {
              showToast('Error deleting track', 'error');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  // Toggle User Role
  const handleToggleRole = async (user) => {
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    Alert.alert(
      'Change User Role',
      `Set ${user.name}'s role to "${newRole.toUpperCase()}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const res = await fetch(`${API_BASE_URL}/api/admin/users/${user._id || user.id}/role`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ role: newRole }),
              });
              if (res.ok) {
                showToast(`Updated role for ${user.name}`, 'success');
                fetchUsers();
              } else {
                showToast('Failed to update role', 'error');
              }
            } catch {
              showToast('Network error updating role', 'error');
            }
          },
        },
      ]
    );
  };

  // Delete Album
  const handleDeleteAlbum = (album) => {
    Alert.alert(
      'DELETE ALBUM',
      `Permanently delete album "${album.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const id = album._id || album.id;
              const res = await fetch(`${API_BASE_URL}/api/albums/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) {
                showToast(`Deleted album "${album.title}"`, 'info');
                fetchAlbums();
              }
            } catch {
              showToast('Error deleting album', 'error');
            }
          },
        },
      ]
    );
  };

  // Toggle Playlist Visibility
  const handleTogglePlaylist = async (playlist) => {
    const plId = playlist._id || playlist.id;
    try {
      const res = await fetch(`${API_BASE_URL}/api/playlists/${plId}/toggle-visibility`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showToast('Toggled playlist visibility', 'info');
        fetchPlaylists();
      }
    } catch {
      showToast('Error toggling playlist', 'error');
    }
  };

  // Filtered tracks
  const filteredTracks = useMemo(() => {
    let list = tracks || [];
    if (trackFilter === 'quran') {
      list = list.filter((t) => t?.category === 'quran' || t?.isQuran);
    } else if (trackFilter === 'songs') {
      list = list.filter((t) => t?.category !== 'quran' && !t?.isQuran);
    }
    if (trackQuery.trim()) {
      const q = trackQuery.toLowerCase().trim();
      list = list.filter(
        (t) =>
          (t?.title && t.title.toLowerCase().includes(q)) ||
          (t?.artist && t.artist.toLowerCase().includes(q)) ||
          (t?._id && String(t._id).toLowerCase().includes(q))
      );
    }
    return list;
  }, [tracks, trackFilter, trackQuery]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    if (!userQuery.trim()) return users;
    const q = userQuery.toLowerCase().trim();
    return users.filter(
      (u) =>
        (u?.name && u.name.toLowerCase().includes(q)) ||
        (u?.email && u.email.toLowerCase().includes(q))
    );
  }, [users, userQuery]);

  // Filtered albums
  const filteredAlbums = useMemo(() => {
    if (!albumQuery.trim()) return albums;
    const q = albumQuery.toLowerCase().trim();
    return albums.filter(
      (a) =>
        (a?.title && a.title.toLowerCase().includes(q)) ||
        (a?.artist && a.artist.toLowerCase().includes(q))
    );
  }, [albums, albumQuery]);

  // Filtered artists
  const filteredArtists = useMemo(() => {
    if (!artistQuery.trim()) return artists;
    const q = artistQuery.toLowerCase().trim();
    return artists.filter((ar) => ar?.name && ar.name.toLowerCase().includes(q));
  }, [artists, artistQuery]);

  // Filtered playlists
  const filteredPlaylists = useMemo(() => {
    if (!playlistQuery.trim()) return adminPlaylists;
    const q = playlistQuery.toLowerCase().trim();
    return adminPlaylists.filter(
      (p) =>
        (p?.name && p.name.toLowerCase().includes(q)) ||
        (p?.creatorName && p.creatorName.toLowerCase().includes(q))
    );
  }, [adminPlaylists, playlistQuery]);

  const TABS = [
    { id: 'tracks', label: 'SONGS', count: tracks.length, icon: Music2 },
    { id: 'accounts', label: 'ACCOUNTS', count: users.length, icon: Users },
    { id: 'albums', label: 'ALBUMS', count: albums.length, icon: Disc },
    { id: 'artists', label: 'ARTISTS', count: artists.length, icon: UserCheck },
    { id: 'playlists', label: 'PLAYLISTS', count: adminPlaylists.length, icon: ListMusic },
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={18} color={isAdmin ? colors.mint : colors.rust} />
            <Text style={styles.headerTitle}>ADMIN CONSOLE</Text>
          </View>
          <Text style={styles.headerSub}>CONTENT & COMMUNITY MANAGEMENT</Text>
        </View>

        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={handleRefreshCurrent}
          activeOpacity={0.8}
        >
          <RefreshCw size={13} color="#082621" />
          <Text style={styles.refreshText}>REFRESH</Text>
        </TouchableOpacity>
      </View>

      {/* Warning if not admin */}
      {!isAdmin && (
        <View style={styles.warningCard}>
          <AlertTriangle size={16} color={colors.rust} />
          <Text style={styles.warningText}>
            Read-only mode. You need admin permissions for destructive actions.
          </Text>
        </View>
      )}

      {/* Tab Switcher */}
      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.8}
              >
                <Icon size={13} color={active ? '#082621' : '#9ca3af'} />
                <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>
                      {tab.count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Content View ── */}
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ═══════════ TRACKS TAB ═══════════ */}
        {activeTab === 'tracks' && (
          <View>
            {/* Search and Filters */}
            <View style={styles.searchBox}>
              <Search size={14} color="#9ca3af" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search songs, artists, IDs..."
                placeholderTextColor="#6b7280"
                value={trackQuery}
                onChangeText={setTrackQuery}
                autoCorrect={false}
              />
            </View>

            <View style={styles.filterPillsRow}>
              {['all', 'songs', 'quran'].map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterPill, trackFilter === f && styles.filterPillActive]}
                  onPress={() => setTrackFilter(f)}
                >
                  <Text style={[styles.filterPillText, trackFilter === f && styles.filterPillTextActive]}>
                    {f.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
              <Text style={styles.resultsCountText}>
                SHOWING {filteredTracks.length} OF {tracks.length}
              </Text>
            </View>

            {/* Tracks List */}
            <View style={styles.itemsList}>
              {filteredTracks.map((track, idx) => {
                const tId = track._id || track.id || idx;
                const isDeleting = deletingId === tId;
                return (
                  <View key={tId} style={styles.itemRow}>
                    <Text style={styles.itemIdx}>{idx + 1}</Text>
                    <Image
                      source={{
                        uri:
                          track.coverUrl ||
                          track.cover ||
                          'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100',
                      }}
                      style={styles.itemCover}
                    />
                    <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                      <Text style={styles.itemMainTitle} numberOfLines={1}>
                        {track.title}
                      </Text>
                      <Text style={styles.itemSubtitle} numberOfLines={1}>
                        {track.artist || 'Unknown'} • {Math.floor((track.duration || 0) / 60)}:
                        {String(Math.floor((track.duration || 0) % 60)).padStart(2, '0')}
                      </Text>
                    </View>

                    <View style={styles.itemActions}>
                      <TouchableOpacity
                        style={styles.playTrackBtn}
                        onPress={() => playTrack(track, filteredTracks)}
                        activeOpacity={0.8}
                      >
                        <Play size={13} color="#082621" fill="#082621" />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteTrackBtn}
                        onPress={() => handleDeleteSong(track)}
                        disabled={isDeleting}
                        activeOpacity={0.8}
                      >
                        {isDeleting ? (
                          <ActivityIndicator size="small" color={colors.rust} />
                        ) : (
                          <Trash2 size={13} color={colors.rust} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ═══════════ ACCOUNTS TAB ═══════════ */}
        {activeTab === 'accounts' && (
          <View>
            <View style={styles.searchBox}>
              <Search size={14} color="#9ca3af" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search accounts by name, email..."
                placeholderTextColor="#6b7280"
                value={userQuery}
                onChangeText={setUserQuery}
                autoCorrect={false}
              />
            </View>

            <Text style={styles.resultsCountText}>
              FOUND {filteredUsers.length} REGISTERED ACCOUNTS
            </Text>

            {isLoadingUsers ? (
              <ActivityIndicator size="large" color={colors.mint} style={{ marginTop: 20 }} />
            ) : (
              <View style={styles.itemsList}>
                {filteredUsers.map((user) => {
                  const uId = user._id || user.id;
                  const isUserAdminRole = user.role === 'admin' || user.isAdmin;
                  return (
                    <View key={uId} style={styles.itemRow}>
                      <Image
                        source={{
                          uri:
                            user.avatar ||
                            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
                        }}
                        style={styles.userAvatar}
                      />
                      <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.itemMainTitle} numberOfLines={1}>
                            {user.name}
                          </Text>
                          <View
                            style={[
                              styles.roleBadge,
                              isUserAdminRole ? { backgroundColor: '#f59e0b' } : { backgroundColor: '#3f3f46' },
                            ]}
                          >
                            <Text style={styles.roleBadgeText}>
                              {isUserAdminRole ? 'ADMIN' : 'USER'}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.itemSubtitle} numberOfLines={1}>
                          {user.email}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.roleToggleBtn,
                          isUserAdminRole && { borderColor: colors.rust },
                        ]}
                        onPress={() => handleToggleRole(user)}
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.roleToggleText,
                            isUserAdminRole && { color: colors.rust },
                          ]}
                        >
                          {isUserAdminRole ? 'DEMOTE' : 'MAKE ADMIN'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ═══════════ ALBUMS TAB ═══════════ */}
        {activeTab === 'albums' && (
          <View>
            <View style={styles.searchBox}>
              <Search size={14} color="#9ca3af" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search albums..."
                placeholderTextColor="#6b7280"
                value={albumQuery}
                onChangeText={setAlbumQuery}
                autoCorrect={false}
              />
            </View>

            <Text style={styles.resultsCountText}>FOUND {filteredAlbums.length} ALBUMS</Text>

            {isLoadingAlbums ? (
              <ActivityIndicator size="large" color={colors.mint} style={{ marginTop: 20 }} />
            ) : (
              <View style={styles.itemsList}>
                {filteredAlbums.map((album) => {
                  const aId = album._id || album.id;
                  const trackCount = Array.isArray(album.tracks) ? album.tracks.length : 0;
                  return (
                    <View key={aId} style={styles.itemRow}>
                      <Image
                        source={{
                          uri:
                            album.cover ||
                            'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100',
                        }}
                        style={styles.itemCover}
                      />
                      <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                        <Text style={styles.itemMainTitle} numberOfLines={1}>
                          {album.title}
                        </Text>
                        <Text style={styles.itemSubtitle} numberOfLines={1}>
                          {album.artist || 'Various'} • {trackCount} SONGS
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.deleteTrackBtn}
                        onPress={() => handleDeleteAlbum(album)}
                      >
                        <Trash2 size={13} color={colors.rust} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ═══════════ ARTISTS TAB ═══════════ */}
        {activeTab === 'artists' && (
          <View>
            <View style={styles.searchBox}>
              <Search size={14} color="#9ca3af" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search artists..."
                placeholderTextColor="#6b7280"
                value={artistQuery}
                onChangeText={setArtistQuery}
                autoCorrect={false}
              />
            </View>

            <Text style={styles.resultsCountText}>FOUND {filteredArtists.length} ARTISTS</Text>

            {isLoadingArtists ? (
              <ActivityIndicator size="large" color={colors.mint} style={{ marginTop: 20 }} />
            ) : (
              <View style={styles.itemsList}>
                {filteredArtists.map((artist, idx) => {
                  const arId = artist._id || artist.id || idx;
                  return (
                    <View key={arId} style={styles.itemRow}>
                      <Image
                        source={{
                          uri:
                            artist.image ||
                            'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=100',
                        }}
                        style={styles.userAvatar}
                      />
                      <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                        <Text style={styles.itemMainTitle} numberOfLines={1}>
                          {artist.name}
                        </Text>
                        <Text style={styles.itemSubtitle} numberOfLines={1}>
                          {(artist.albums || []).length} ALBUMS • {(artist.tracks || []).length} SONGS
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ═══════════ PLAYLISTS TAB ═══════════ */}
        {activeTab === 'playlists' && (
          <View>
            <View style={styles.searchBox}>
              <Search size={14} color="#9ca3af" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search playlists..."
                placeholderTextColor="#6b7280"
                value={playlistQuery}
                onChangeText={setPlaylistQuery}
                autoCorrect={false}
              />
            </View>

            <Text style={styles.resultsCountText}>FOUND {filteredPlaylists.length} PLAYLISTS</Text>

            {isLoadingPlaylists ? (
              <ActivityIndicator size="large" color={colors.mint} style={{ marginTop: 20 }} />
            ) : (
              <View style={styles.itemsList}>
                {filteredPlaylists.map((pl) => {
                  const pId = pl._id || pl.id;
                  const isPublic = pl.isPublic !== false;
                  return (
                    <View key={pId} style={styles.itemRow}>
                      <Image
                        source={{
                          uri:
                            pl.cover ||
                            'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100',
                        }}
                        style={styles.itemCover}
                      />
                      <View style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                        <Text style={styles.itemMainTitle} numberOfLines={1}>
                          {pl.name}
                        </Text>
                        <Text style={styles.itemSubtitle} numberOfLines={1}>
                          Created by: {pl.creatorName || 'User'} • {(pl.tracks || []).length} TRACKS
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.visibilityPill,
                          isPublic ? { backgroundColor: '#10b981' } : { backgroundColor: '#6b7280' },
                        ]}
                        onPress={() => handleTogglePlaylist(pl)}
                        activeOpacity={0.8}
                      >
                        {isPublic ? (
                          <Globe size={11} color="#ffffff" />
                        ) : (
                          <Lock size={11} color="#ffffff" />
                        )}
                        <Text style={styles.visibilityText}>
                          {isPublic ? 'PUBLIC' : 'PRIVATE'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1110',
    padding: 14,
    paddingBottom: 90,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 18,
    color: '#ffffff',
  },
  headerSub: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: colors.mint,
    marginTop: 2,
    letterSpacing: 1,
  },
  refreshBtn: {
    backgroundColor: colors.mint,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  refreshText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: '#082621',
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f1311',
    borderWidth: 1.5,
    borderColor: colors.rust,
    borderRadius: 8,
    padding: 10,
    gap: 8,
    marginBottom: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 11,
    color: colors.rust,
  },
  tabsWrapper: {
    marginBottom: 12,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderWidth: 1.5,
    borderColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
  },
  tabBtnActive: {
    backgroundColor: colors.mint,
    borderColor: colors.mint,
  },
  tabBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: '#9ca3af',
  },
  tabBtnTextActive: {
    color: '#082621',
  },
  tabBadge: {
    backgroundColor: '#27272a',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 10,
  },
  tabBadgeActive: {
    backgroundColor: '#082621',
  },
  tabBadgeText: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 9,
    color: '#9ca3af',
  },
  tabBadgeTextActive: {
    color: colors.mint,
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderWidth: 1.5,
    borderColor: '#27272a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#ffffff',
    padding: 0,
  },
  filterPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  filterPill: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  filterPillActive: {
    backgroundColor: colors.mint,
    borderColor: colors.mint,
  },
  filterPillText: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 9,
    color: '#9ca3af',
  },
  filterPillTextActive: {
    color: '#082621',
  },
  resultsCountText: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 10,
    color: '#9ca3af',
    marginLeft: 'auto',
  },
  itemsList: {
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141d1b',
    borderWidth: 1.5,
    borderColor: '#27272a',
    borderRadius: 8,
    padding: 8,
  },
  itemIdx: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: '#6b7280',
    width: 20,
    textAlign: 'center',
  },
  itemCover: {
    width: 38,
    height: 38,
    borderRadius: 6,
    marginRight: 10,
    backgroundColor: '#27272a',
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
    backgroundColor: '#27272a',
  },
  itemMainTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  itemSubtitle: {
    fontSize: 10,
    color: '#9ca3af',
    marginTop: 2,
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playTrackBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.mint,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteTrackBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#1f1311',
    borderWidth: 1,
    borderColor: colors.rust,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  roleBadgeText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 8,
    color: '#082621',
  },
  roleToggleBtn: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  roleToggleText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 9,
    color: colors.mint,
  },
  visibilityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  visibilityText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 8,
    color: '#ffffff',
  },
});
