import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, TextInput, ActivityIndicator, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Heart, ListMusic, ChevronLeft, Music, Edit2, Trash2, Check, X, Download, Camera, Plus } from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { useAudioPlayer } from '../context/AudioContext';
import { useToast } from '../context/ToastContext';
import SongItem from '../components/SongItem';

export default function LibraryScreen() {
  const { tracks, likedTrackIds, playlists, syncUserData, createPlaylist, updatePlaylist, deletePlaylist } = useUser();
  const { playTrack, handleDownloadPlaylist } = useAudioPlayer();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('liked');
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);

  // UI States
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [newPlName, setNewPlName] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCover, setEditCover] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const likedTracks = (tracks || []).filter(t => (likedTrackIds || []).includes(String(t._id || t.id)));

  const getPlaylistTracks = (pl) => {
    if (!pl || !tracks) return [];
    const ids = (pl.trackIds || []).map(String);
    return (tracks || []).filter(t => ids.includes(String(t._id || t.id)));
  };

  const handlePickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3,
      base64: true,
    });
    if (!res.canceled && res.assets[0].base64) {
      setEditCover(`data:image/jpeg;base64,${res.assets[0].base64}`);
    }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim() || !selectedPlaylist) return;
    try {
      setIsSaving(true);
      await updatePlaylist(selectedPlaylist.id, { name: editName, cover: editCover });
      setSelectedPlaylist(prev => ({ ...prev, name: editName, cover: editCover }));
      setIsEditing(false);
    } catch (e) {
    } finally {
      setIsSaving(false);
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
          {!selectedPlaylist.isLikedSongs && (
            <TouchableOpacity
              onPress={() => {
                setEditName(selectedPlaylist.name);
                setEditCover(selectedPlaylist.cover || '');
                setIsEditing(true);
              }}
              style={{ marginLeft: 'auto', padding: 8 }}
            >
              <Edit2 size={20} color="#a1a1aa" />
            </TouchableOpacity>
          )}
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

            <TouchableOpacity style={styles.downloadAllBtn} onPress={() => handleDownloadPlaylist(plTracks)}>
              <Download size={18} color="#000" />
              <Text style={styles.downloadAllText}>Download All</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            {plTracks.map((item) => (
              <SongItem
                key={item._id || item.id}
                track={item}
                onPlay={(t) => playTrack(t, plTracks)}
                showDelete={true}
              />
            ))}
          </View>
        </ScrollView>

        {/* Edit Modal */}
        <Modal visible={isEditing} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.editModal}>
              <Text style={styles.modalTitle}>Edit Playlist</Text>

              <TouchableOpacity style={styles.imagePickerBtn} onPress={handlePickImage}>
                {editCover ? (
                  <Image source={{ uri: editCover }} style={styles.pickerImg} />
                ) : (
                  <View style={styles.pickerPlaceholder}>
                    <Camera size={32} color="#71717a" />
                    <Text style={{ color: '#71717a', fontSize: 12, marginTop: 8 }}>Change Cover</Text>
                  </View>
                )}
              </TouchableOpacity>

              <TextInput
                style={styles.editInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Playlist Name"
                placeholderTextColor="#71717a"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
                  <Text style={{ color: '#fff' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit} disabled={isSaving}>
                  {isSaving ? <ActivityIndicator size="small" color="#000" /> : <Text style={{ fontWeight: 'bold' }}>Save Changes</Text>}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={async () => {
                  await deletePlaylist(selectedPlaylist.id);
                  showToast('Playlist deleted');
                  setSelectedPlaylist(null);
                  setIsEditing(false);
                }}
              >
                <Trash2 size={18} color="#ef4444" />
                <Text style={{ color: '#ef4444', marginLeft: 8 }}>Delete Playlist</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>My Library</Text>
        <View style={styles.tabsRow}>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'liked' && styles.activeTabBtn]} onPress={() => setActiveTab('liked')}>
            <Text style={[styles.tabText, activeTab === 'liked' && styles.activeTabText]}>Liked</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === 'playlists' && styles.activeTabBtn]} onPress={() => setActiveTab('playlists')}>
            <Text style={[styles.tabText, activeTab === 'playlists' && styles.activeTabText]}>Playlists</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'playlists' && (
          <View style={styles.section}>
            {showCreateInput ? (
              <View style={styles.createInputBox}>
                <TextInput style={{ flex: 1, color: '#fff' }} value={newPlName} onChangeText={setNewPlName} placeholder="Name..." placeholderTextColor="#71717a" autoFocus />
                <TouchableOpacity onPress={async () => { await createPlaylist(newPlName); setNewPlName(''); setShowCreateInput(false); }}><Check size={24} color="#1DB954" /></TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateInput(true)}><Plus size={20} color="#000" /><Text style={{ fontWeight: 'bold', marginLeft: 8 }}>New Playlist</Text></TouchableOpacity>
            )}
            {playlists.map(pl => (
              <TouchableOpacity key={pl.id} style={styles.playlistCard} onPress={() => setSelectedPlaylist(pl)}>
                <Music size={24} color="#1DB954" />
                <Text style={styles.playlistName}>{pl.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeTab === 'liked' && (
          <View style={styles.section}>
            {likedTracks.map(t => <SongItem key={t._id || t.id} track={t} onPlay={(track) => playTrack(track, likedTracks)} />)}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  headerBar: { flexDirection: 'row', alignItems: 'center', paddingTop: 44, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#141416' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginLeft: 12 },
  scrollContent: { padding: 16, paddingTop: 44, paddingBottom: 100 },
  title: { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 20 },
  tabsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  tabBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#18181b' },
  activeTabBtn: { backgroundColor: '#1DB954' },
  tabText: { color: '#a1a1aa', fontWeight: 'bold' },
  activeTabText: { color: '#000' },
  section: { marginTop: 10 },
  playlistCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181b', padding: 16, borderRadius: 16, marginBottom: 12 },
  playlistName: { color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 12 },
  createBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1DB954', padding: 16, borderRadius: 16, marginBottom: 12, justifyContent: 'center' },
  createInputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181b', padding: 12, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1DB954' },
  playlistHeaderBox: { alignItems: 'center', backgroundColor: '#18181b', borderRadius: 24, padding: 24, marginBottom: 20 },
  playlistIconBig: { width: 120, height: 120, borderRadius: 20, backgroundColor: '#09090b', justifyContent: 'center', alignItems: 'center', marginBottom: 16, overflow: 'hidden' },
  coverImg: { width: '100%', height: '100%' },
  selectedPlTitle: { fontSize: 22, fontWeight: '900', color: '#fff' },
  selectedPlSub: { color: '#1DB954', marginTop: 4, fontWeight: '700' },
  downloadAllBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1DB954', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, marginTop: 16 },
  downloadAllText: { color: '#000', fontWeight: 'bold', marginLeft: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  editModal: { backgroundColor: '#18181b', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: '#27272a' },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 20, textAlign: 'center' },
  imagePickerBtn: { width: 140, height: 140, borderRadius: 20, backgroundColor: '#09090b', alignSelf: 'center', marginBottom: 20, overflow: 'hidden' },
  pickerPlaceholder: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pickerImg: { width: '100%', height: '100%' },
  editInput: { backgroundColor: '#09090b', color: '#fff', padding: 16, borderRadius: 16, fontSize: 16, marginBottom: 20, borderWidth: 1, borderColor: '#27272a' },
  modalActions: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 16, backgroundColor: '#27272a', alignItems: 'center' },
  saveBtn: { flex: 2, padding: 16, borderRadius: 16, backgroundColor: '#1DB954', alignItems: 'center' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, padding: 12 },
});
