import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, TextInput } from 'react-native';
import { Heart, ListMusic, ChevronLeft, Music, Edit2, Trash2, Check, X } from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { useAudioPlayer } from '../context/AudioContext';
import SongItem from '../components/SongItem';
import { API_BASE_URL } from '../config';

export default function LibraryScreen() {
  const { tracks, likedTrackIds, playlists, token, syncUserData } = useUser();
  const { playTrack } = useAudioPlayer();

  const [activeTab, setActiveTab] = useState('liked'); // 'liked' or 'playlists'
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);

  // Playlist Editing State
  const [editingPlaylistId, setEditingPlaylistId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const likedTracks = tracks.filter(t => likedTrackIds.includes(String(t._id || t.id)));

  // Resolve tracks for selected playlist
  const getPlaylistTracks = (pl) => {
    if (!pl || !tracks) return [];
    const trackIdList = (pl.trackIds || pl.tracks || []).map(String);
    return tracks.filter(t => trackIdList.includes(String(t._id || t.id)));
  };

  const handleUpdatePlaylist = async (plId) => {
    if (!editingName.trim() || !token) return;
    try {
      setIsSaving(true);
      const res = await fetch(`${API_BASE_URL}/api/playlists/${plId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editingName.trim() }),
      });
      if (res.ok) {
        await syncUserData();
        setEditingPlaylistId(null);
      }
    } catch (err) {
      console.warn('Update playlist error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlaylist = async (plId) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/playlists/${plId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await syncUserData();
        if (selectedPlaylist?.id === plId) setSelectedPlaylist(null);
      }
    } catch (err) {
      console.warn('Delete playlist error:', err);
    }
  };

  if (selectedPlaylist) {
    const plTracks = getPlaylistTracks(selectedPlaylist);
    return (
      <View style={styles.container}>
        <View style={styles.headerBar}>
          <TouchableOpacity onPress={() => setSelectedPlaylist(null)} style={styles.backBtn}>
            <ChevronLeft size={24} color="#ffffff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedPlaylist.name}</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.playlistHeaderBox}>
            <View style={styles.playlistIconBig}>
              {selectedPlaylist.cover ? (
                <Image source={{ uri: selectedPlaylist.cover }} style={styles.coverImg} />
              ) : (
                <ListMusic size={40} color="#1DB954" />
              )}
            </View>
            <Text style={styles.selectedPlTitle}>{selectedPlaylist.name}</Text>
            <Text style={styles.selectedPlSub}>{plTracks.length} Songs</Text>
          </View>

          <View style={styles.section}>
            {plTracks.length === 0 ? (
              <Text style={styles.emptyDesc}>No songs in this playlist yet</Text>
            ) : (
              plTracks.map((item) => (
                <SongItem key={item._id || item.id} track={item} onPlay={(t) => playTrack(t, plTracks)} />
              ))
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>My Music Library</Text>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'liked' && styles.activeTabBtn]} 
            onPress={() => setActiveTab('liked')}
          >
            <Heart size={16} color={activeTab === 'liked' ? '#000' : '#ffffff'} />
            <Text style={[styles.tabText, activeTab === 'liked' && styles.activeTabText]}>
              Liked ({likedTracks.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tabBtn, activeTab === 'playlists' && styles.activeTabBtn]} 
            onPress={() => setActiveTab('playlists')}
          >
            <ListMusic size={16} color={activeTab === 'playlists' ? '#000' : '#ffffff'} />
            <Text style={[styles.tabText, activeTab === 'playlists' && styles.activeTabText]}>
              Playlists ({playlists.length})
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'liked' ? (
          <View style={styles.section}>
            {likedTracks.length === 0 ? (
              <View style={styles.emptyBox}>
                <Heart size={40} color="#3f3f46" />
                <Text style={styles.emptyTitle}>No liked songs yet</Text>
                <Text style={styles.emptyDesc}>Tap the heart icon on any song to add it here</Text>
              </View>
            ) : (
              likedTracks.map((item) => (
                <SongItem key={item._id || item.id} track={item} onPlay={(t) => playTrack(t, likedTracks)} />
              ))
            )}
          </View>
        ) : (
          <View style={styles.section}>
            {playlists.length === 0 ? (
              <View style={styles.emptyBox}>
                <ListMusic size={40} color="#3f3f46" />
                <Text style={styles.emptyTitle}>No playlists</Text>
                <Text style={styles.emptyDesc}>Create and browse your personal playlists</Text>
              </View>
            ) : (
              playlists.map((pl, idx) => {
                const count = (pl.trackIds || pl.tracks || []).length;
                const isEditing = editingPlaylistId === pl.id;

                return (
                  <View key={pl.id || pl._id || idx} style={styles.playlistCard}>
                    <TouchableOpacity
                      style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}
                      onPress={() => setSelectedPlaylist(pl)}
                    >
                      <ListMusic size={24} color="#1DB954" />
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        {isEditing ? (
                          <TextInput
                            style={styles.editInput}
                            value={editingName}
                            onChangeText={setEditingName}
                            autoFocus
                          />
                        ) : (
                          <Text style={styles.playlistName}>{pl.name || 'Untitled Playlist'}</Text>
                        )}
                        <Text style={styles.playlistCount}>{count} Songs</Text>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.plActions}>
                      {isEditing ? (
                        <>
                          <TouchableOpacity onPress={() => handleUpdatePlaylist(pl.id)} disabled={isSaving}>
                            <Check size={20} color="#1DB954" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setEditingPlaylistId(null)}>
                            <X size={20} color="#ef4444" />
                          </TouchableOpacity>
                        </>
                      ) : (
                        <>
                          <TouchableOpacity onPress={() => { setEditingPlaylistId(pl.id); setEditingName(pl.name); }}>
                            <Edit2 size={18} color="#a1a1aa" />
                          </TouchableOpacity>
                          {!pl.isLikedSongs && (
                            <TouchableOpacity onPress={() => handleDeletePlaylist(pl.id)}>
                              <Trash2 size={18} color="#ef4444" />
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                    </View>
                  </View>
                );
              })
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
    backgroundColor: '#09090b',
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 44,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    backgroundColor: '#141416',
  },
  backBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginLeft: 12,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 44,
    paddingBottom: 120,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 16,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  tabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#18181b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  activeTabBtn: {
    backgroundColor: '#1DB954',
    borderColor: '#1DB954',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  activeTabText: {
    color: '#000000',
  },
  section: {
    marginTop: 8,
  },
  emptyBox: {
    alignItems: 'center',
    justify: 'center',
    padding: 32,
    backgroundColor: '#18181b',
    borderRadius: 20,
    marginTop: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    color: '#a1a1aa',
    textAlign: 'center',
    marginTop: 6,
  },
  playlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  plActions: {
    flexDirection: 'row',
    gap: 12,
    marginLeft: 8,
  },
  editInput: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    borderBottomWidth: 1,
    borderBottomColor: '#1DB954',
    padding: 0,
    margin: 0,
  },
  playlistName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  playlistCount: {
    fontSize: 13,
    color: '#a1a1aa',
    marginTop: 2,
  },
  playlistHeaderBox: {
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#27272a',
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
  coverImg: {
    width: '100%',
    height: '100%',
  },
  selectedPlTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff',
  },
  selectedPlSub: {
    fontSize: 13,
    color: '#1DB954',
    fontWeight: '700',
    marginTop: 4,
  },
});
