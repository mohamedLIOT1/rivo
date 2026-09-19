import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Image, Alert
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  User, LogIn, LogOut, Edit2, Check, X, RefreshCw, Search,
  Eye, EyeOff, Music, ChevronRight
} from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { useAudioPlayer } from '../context/AudioContext';
import { API_BASE_URL } from '../config';
import SongItem from '../components/SongItem';

export default function ProfileScreen() {
  const { currentUser, token, login, register, logout, updateProfile, syncUserData, playlists: userPlaylists, tracks } = useUser();
  const { playTrack } = useAudioPlayer();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'search'

  // Auth Form State
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Profile Edit State
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(currentUser?.name || '');
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [bioInput, setBioInput] = useState(currentUser?.bio || '');
  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [avatarInput, setAvatarInput] = useState(currentUser?.avatar || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // User Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [viewingUserProfile, setViewingUserProfile] = useState(null);

  // Playlist Navigation State
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);

  // Playlist Visibility State
  const [localPlaylists, setLocalPlaylists] = useState(userPlaylists || []);
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    if (currentUser) {
      setNameInput(currentUser.name || '');
      setBioInput(currentUser.bio || '');
      setAvatarInput(currentUser.avatar || '');
    }
  }, [currentUser]);

  useEffect(() => {
    setLocalPlaylists(userPlaylists || []);
  }, [userPlaylists]);

  const handleAuthSubmit = async () => {
    setAuthError('');
    if (!authEmail || !authPassword || (isRegisterMode && !authName)) {
      setAuthError('Please fill all required fields');
      return;
    }
    try {
      setAuthLoading(true);
      if (isRegisterMode) {
        await register(authName, authEmail, authPassword);
      } else {
        await login(authEmail, authPassword);
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication error occurred');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    try {
      setSavingProfile(true);
      await updateProfile({ name: nameInput.trim() });
      setIsEditingName(false);
    } catch (err) {
      Alert.alert('Error', 'Could not update name');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveBio = async () => {
    try {
      setSavingProfile(true);
      await updateProfile({ bio: bioInput.trim() });
      setIsEditingBio(false);
    } catch (err) {
      Alert.alert('Error', 'Could not update bio');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSaveAvatar = async () => {
    try {
      setSavingProfile(true);
      await updateProfile({ avatar: avatarInput.trim() });
      setIsEditingAvatar(false);
    } catch (err) {
      Alert.alert('Error', 'Could not update profile picture');
    } finally {
      setSavingProfile(false);
    }
  };

  const pickImage = async () => {
    try {
      console.log('Requesting media library permissions...');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to change your avatar.');
        return;
      }

      console.log('Launching image library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.3,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const selected = result.assets[0];
        console.log('Image selected, size:', selected.base64?.length);
        const base64Image = `data:image/jpeg;base64,${selected.base64}`;

        setSavingProfile(true);
        const updatedUser = await updateProfile({ avatar: base64Image });
        if (updatedUser) {
          Alert.alert('Success', 'Profile picture updated successfully!');
        }
      }
    } catch (err) {
      console.error('Pick Image Error:', err);
      Alert.alert('Error', 'An error occurred while picking the image.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleTogglePlaylistVisibility = async (pl) => {
    if (pl.isLikedSongs || !token) return;
    setTogglingId(pl.id);
    try {
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
    } catch (err) {
      console.warn('Toggle visibility error:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleSearchUsers = async (q) => {
    setSearchQuery(q);
    if (!q.trim() || q.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success) setSearchResults(data.users || []);
    } catch (err) {
      console.warn('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleViewUserProfile = async (userId) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/users/${userId}/profile`);
      const data = await res.json();
      if (data.success) setViewingUserProfile(data.user);
    } catch (err) {
      Alert.alert('Error', 'Could not fetch user profile');
    }
  };

  // Resolve tracks for selected playlist
  const getPlaylistTracks = (pl) => {
    if (!pl || !tracks) return [];
    const trackIdList = (pl.trackIds || pl.tracks || []).map(String);
    return (tracks || []).filter(t => trackIdList.includes(String(t._id || t.id)));
  };

  // Viewing specific playlist detail
  if (selectedPlaylist) {
    const plTracks = getPlaylistTracks(selectedPlaylist);
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setSelectedPlaylist(null)} style={styles.backBtn}>
            <X size={22} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedPlaylist.name || 'Playlist'}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.profileHeaderBox}>
            <View style={styles.playlistIconBig}>
              {selectedPlaylist.cover ? (
                <Image source={{ uri: selectedPlaylist.cover }} style={styles.avatarImg} />
              ) : (
                <Music size={40} color="#1DB954" />
              )}
            </View>
            <Text style={styles.userName}>{selectedPlaylist.name || 'Untitled'}</Text>
            <Text style={styles.publicPlCount}>
              {(plTracks || []).length} {Boolean(selectedPlaylist.isQuran) ? ((plTracks || []).length === 1 ? 'Surah' : 'Surahs') : 'Songs'}
            </Text>
          </View>

          <Text style={styles.sectionHeader}>{Boolean(selectedPlaylist.isQuran) ? 'Surah List' : 'Playlist Tracks'}</Text>
          <View style={{ marginBottom: 40 }}>
            {(!plTracks || plTracks.length === 0) ? (
              <Text style={styles.emptyText}>{Boolean(selectedPlaylist.isQuran) ? 'No surahs in this playlist' : 'No songs in this playlist'}</Text>
            ) : (
              (plTracks || []).map((track, idx) => (
                <SongItem
                  key={track?._id || track?.id || `pl-track-${idx}`}
                  track={track}
                  onPlay={(t) => playTrack(t, plTracks)}
                />
              ))
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  // Viewing another user's profile view
  if (viewingUserProfile) {
    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => setViewingUserProfile(null)} style={styles.backBtn}>
            <X size={22} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{viewingUserProfile.name}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.profileHeaderBox}>
            <View style={styles.avatarCircle}>
              {viewingUserProfile.avatar ? (
                <Image source={{ uri: viewingUserProfile.avatar }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarInitial}>
                  {viewingUserProfile.name ? viewingUserProfile.name[0].toUpperCase() : 'U'}
                </Text>
              )}
            </View>
            <Text style={styles.userName}>{viewingUserProfile.name}</Text>
            {!!viewingUserProfile.bio && <Text style={styles.userBio}>{viewingUserProfile.bio}</Text>}
            <Text style={styles.publicPlCount}>
              {viewingUserProfile.playlistCount || 0} Public Playlists
            </Text>
          </View>

          <Text style={styles.sectionHeader}>Public Playlists</Text>
          {viewingUserProfile.publicPlaylists?.length > 0 ? (
            viewingUserProfile.publicPlaylists.map(pl => (
              <TouchableOpacity key={pl.id} style={styles.playlistRow} onPress={() => setSelectedPlaylist(pl)}>
                <Music size={20} color="#1DB954" />
                <View style={{ flex: 1, marginHorizontal: 10 }}>
                  <Text style={styles.playlistName}>{pl.name}</Text>
                  <Text style={styles.playlistSub}>{pl.trackCount || 0} {Boolean(pl.isQuran) ? 'Surahs' : 'Songs'}</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyText}>No public playlists found</Text>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {currentUser ? (
        <>
          {/* Top Bar Navigation Tabs */}
          <View style={styles.topTabBar}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'profile' && styles.activeTabBtn]}
              onPress={() => setActiveTab('profile')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'profile' && styles.activeTabBtnText]}>
                My Profile
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'search' && styles.activeTabBtn]}
              onPress={() => setActiveTab('search')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'search' && styles.activeTabBtnText]}>
                Find People
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.topLogoutBtn} onPress={logout}>
              <LogOut size={16} color="#ef4444" />
              <Text style={styles.topLogoutText}>Logout</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {activeTab === 'profile' ? (
              <>
                {/* User Profile Info Card */}
                <View style={styles.profileHeaderBox}>
                  <TouchableOpacity
                    style={styles.avatarCircle}
                    onPress={pickImage}
                  >
                    {currentUser.avatar ? (
                      <Image source={{ uri: currentUser.avatar }} style={styles.avatarImg} />
                    ) : (
                      <Text style={styles.avatarInitial}>
                        {currentUser.name ? currentUser.name[0].toUpperCase() : 'U'}
                      </Text>
                    )}
                    <View style={styles.avatarEditOverlay}>
                      {savingProfile ? <ActivityIndicator size="small" color="#fff" /> : <Edit2 size={16} color="#fff" />}
                    </View>
                  </TouchableOpacity>

                  {/* Avatar URL Editing */}
                  {isEditingAvatar && (
                    <View style={styles.editRowVertical}>
                      <TextInput
                        style={[styles.editInput, { width: '100%' }]}
                        value={avatarInput}
                        onChangeText={setAvatarInput}
                        placeholder="Image URL (http...)"
                        placeholderTextColor="#71717a"
                      />
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                        <TouchableOpacity style={styles.saveBioBtn} onPress={handleSaveAvatar} disabled={savingProfile}>
                          <Text style={styles.saveBioText}>Save Image</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBioBtn} onPress={() => setIsEditingAvatar(false)}>
                          <Text style={styles.cancelBioText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {/* Name Editing */}
                  {isEditingName ? (
                    <View style={styles.editRow}>
                      <TextInput
                        style={styles.editInput}
                        value={nameInput}
                        onChangeText={setNameInput}
                        placeholder="Name"
                        placeholderTextColor="#71717a"
                      />
                      <TouchableOpacity style={styles.iconCheckBtn} onPress={handleSaveName} disabled={savingProfile}>
                        {savingProfile ? <ActivityIndicator size="small" color="#000" /> : <Check size={18} color="#000" />}
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.iconCancelBtn} onPress={() => setIsEditingName(false)}>
                        <X size={18} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.nameRow}>
                      <Text style={styles.userName}>{currentUser.name || 'Rivo User'}</Text>
                      <TouchableOpacity onPress={() => setIsEditingName(true)}>
                        <Edit2 size={16} color="#a1a1aa" />
                      </TouchableOpacity>
                    </View>
                  )}

                  <Text style={styles.userEmail}>{currentUser.email}</Text>

                  {/* Bio Editing */}
                  {isEditingBio ? (
                    <View style={styles.editRowVertical}>
                      <TextInput
                        style={[styles.editInput, { width: '100%', height: 60 }]}
                        value={bioInput}
                        onChangeText={setBioInput}
                        placeholder="Enter your bio..."
                        placeholderTextColor="#71717a"
                        multiline
                      />
                      <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                        <TouchableOpacity style={styles.saveBioBtn} onPress={handleSaveBio} disabled={savingProfile}>
                          <Text style={styles.saveBioText}>Save Bio</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelBioBtn} onPress={() => setIsEditingBio(false)}>
                          <Text style={styles.cancelBioText}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.bioContainer} onPress={() => setIsEditingBio(true)}>
                      <Text style={styles.userBio}>
                        {currentUser.bio || 'Tap to add a bio...'}
                      </Text>
                      <Edit2 size={14} color="#71717a" />
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={styles.syncBtn} onPress={() => syncUserData()}>
                    <RefreshCw size={16} color="#1DB954" />
                    <Text style={styles.syncBtnText}>Sync Data with Server</Text>
                  </TouchableOpacity>
                </View>

                {/* User Playlists & Visibility Control */}
                <Text style={styles.sectionHeader}>Your Playlists (Visibility 👁)</Text>
                {(localPlaylists || []).filter(p => !p.isLikedSongs).length > 0 ? (
                  (localPlaylists || []).filter(p => !p.isLikedSongs).map(pl => {
                    const isPublic = pl.isPublic !== false;
                    const isToggling = togglingId === pl.id;
                    return (
                      <TouchableOpacity
                        key={pl.id}
                        style={styles.playlistRow}
                        onPress={() => setSelectedPlaylist(pl)}
                      >
                        <Music size={20} color="#1DB954" />
                        <View style={{ flex: 1, marginHorizontal: 10 }}>
                          <Text style={styles.playlistName}>{pl.name}</Text>
                          <Text style={styles.playlistSub}>{(pl.trackIds || []).length} {Boolean(pl.isQuran) ? 'Surahs' : 'Songs'}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.eyeBtn}
                          onPress={() => handleTogglePlaylistVisibility(pl)}
                          disabled={isToggling}
                        >
                          {isToggling ? (
                            <ActivityIndicator size="small" color="#1DB954" />
                          ) : isPublic ? (
                            <Eye size={20} color="#1DB954" />
                          ) : (
                            <EyeOff size={20} color="#71717a" />
                          )}
                        </TouchableOpacity>
                        <View style={[styles.badge, isPublic ? styles.publicBadge : styles.privateBadge]}>
                          <Text style={[styles.badgeText, isPublic ? styles.publicBadgeText : styles.privateBadgeText]}>
                            {isPublic ? 'Public' : 'Private'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>No playlists yet</Text>
                )}
              </>
            ) : (
              /* Search Users Tab */
              <View>
                <View style={styles.searchBoxContainer}>
                  <Search size={18} color="#71717a" style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search by name or email..."
                    placeholderTextColor="#71717a"
                    value={searchQuery}
                    onChangeText={handleSearchUsers}
                  />
                  {isSearching && <ActivityIndicator size="small" color="#1DB954" />}
                </View>

                {searchResults.length > 0 ? (
                  searchResults.map(u => (
                    <TouchableOpacity
                      key={u.id}
                      style={styles.userResultRow}
                      onPress={() => handleViewUserProfile(u.id)}
                    >
                      <View style={styles.smallAvatar}>
                        <Text style={styles.smallAvatarText}>{u.name ? u.name[0].toUpperCase() : 'U'}</Text>
                      </View>
                      <View style={{ flex: 1, marginHorizontal: 10 }}>
                        <Text style={styles.userName}>{u.name}</Text>
                        <Text style={styles.userSub}>{u.publicPlaylists?.length || 0} Public Playlists</Text>
                      </View>
                      <ChevronRight size={18} color="#71717a" />
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.emptyText}>
                    {searchQuery.length >= 2 ? 'No users found' : 'Search for any user to view their profile and public playlists'}
                  </Text>
                )}
              </View>
            )}
          </ScrollView>
        </>
      ) : (
        /* Login / Register View */
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Rivo Account</Text>
          <View style={styles.authBox}>
            <View style={styles.authHeader}>
              <LogIn size={24} color="#1DB954" />
              <Text style={styles.authTitle}>
                {isRegisterMode ? 'Create New Account' : 'Login to Rivo'}
              </Text>
            </View>
            <Text style={styles.authSubtitle}>
              Login to sync your songs, playlists, and settings across devices.
            </Text>

            {isRegisterMode && (
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#71717a"
                value={authName}
                onChangeText={setAuthName}
              />
            )}

            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor="#71717a"
              keyboardType="email-address"
              autoCapitalize="none"
              value={authEmail}
              onChangeText={setAuthEmail}
            />

            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#71717a"
              secureTextEntry
              value={authPassword}
              onChangeText={setAuthPassword}
            />

            {!!authError && <Text style={styles.errorText}>{authError}</Text>}

            <TouchableOpacity style={styles.submitBtn} onPress={handleAuthSubmit} disabled={authLoading}>
              {authLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.submitBtnText}>
                  {isRegisterMode ? 'Create Account' : 'Login'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsRegisterMode(!isRegisterMode)} style={styles.switchAuthBtn}>
              <Text style={styles.switchAuthText}>
                {isRegisterMode ? 'Already have an account? Login' : "Don't have an account? Register"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  topTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 12,
    backgroundColor: '#141416',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    gap: 8,
  },
  tabBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#27272a',
  },
  activeTabBtn: {
    backgroundColor: '#1DB954',
  },
  tabBtnText: {
    color: '#a1a1aa',
    fontWeight: '700',
    fontSize: 13,
  },
  activeTabBtnText: {
    color: '#000000',
  },
  topLogoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  topLogoutText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 44,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginLeft: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 20,
    marginTop: 40,
  },
  profileHeaderBox: {
    backgroundColor: '#18181b',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 20,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1DB954',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  avatarEditOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playlistIconBig: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: 'rgba(29,185,84,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontSize: 32,
    fontWeight: '900',
    color: '#000000',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  userEmail: {
    fontSize: 13,
    color: '#a1a1aa',
    marginTop: 2,
  },
  userBio: {
    fontSize: 15,
    lineHeight: 22,
    color: '#f4f4f5',
    textAlign: 'center',
  },
  bioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginVertical: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#27272a',
    borderRadius: 12,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 8,
  },
  editRowVertical: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 8,
  },
  editInput: {
    backgroundColor: '#09090b',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#1DB954',
    fontSize: 14,
  },
  iconCheckBtn: {
    backgroundColor: '#1DB954',
    padding: 8,
    borderRadius: 10,
  },
  iconCancelBtn: {
    backgroundColor: '#3f3f46',
    padding: 8,
    borderRadius: 10,
  },
  saveBioBtn: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  saveBioText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 12,
  },
  cancelBioBtn: {
    backgroundColor: '#3f3f46',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 10,
  },
  cancelBioText: {
    color: '#fff',
    fontSize: 12,
  },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 12,
  },
  syncBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1DB954',
  },
  sectionHeader: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
    marginTop: 8,
  },
  playlistRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  playlistName: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  playlistSub: {
    color: '#71717a',
    fontSize: 12,
  },
  eyeBtn: {
    padding: 8,
    marginRight: 4,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  publicBadge: {
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
  },
  privateBadge: {
    backgroundColor: 'rgba(113, 113, 122, 0.2)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  publicBadgeText: {
    color: '#1DB954',
  },
  privateBadgeText: {
    color: '#71717a',
  },
  emptyText: {
    color: '#71717a',
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 24,
  },
  searchBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  userResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  smallAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1DB954',
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallAvatarText: {
    color: '#000',
    fontWeight: '800',
  },
  userSub: {
    color: '#71717a',
    fontSize: 12,
  },
  publicPlCount: {
    color: '#1DB954',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
  },
  authBox: {
    backgroundColor: '#18181b',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  authHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  authTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  authSubtitle: {
    fontSize: 13,
    color: '#a1a1aa',
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#09090b',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 12,
    textAlign: 'left',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'left',
  },
  submitBtn: {
    backgroundColor: '#1DB954',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
  },
  switchAuthBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  switchAuthText: {
    fontSize: 13,
    color: '#1DB954',
    fontWeight: '600',
  },
});
