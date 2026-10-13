import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { X, Plus, FolderPlus, Music, Check } from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';

export default function PlaylistPickerModal({ visible, track, onClose }) {
  const { playlists, createPlaylist, addToPlaylist, token } = useUser();
  const { showToast } = useToast();
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [addingId, setAddingId] = useState(null);

  if (!visible || !track) return null;

  const trackId = String(track._id || track.id);

  const handleCreateAndAdd = async () => {
    if (!newPlaylistName.trim()) {
      showToast('Please enter a playlist name', 'warning');
      return;
    }
    if (!token) {
      showToast('Please log in to manage playlists', 'warning');
      return;
    }
    try {
      setIsCreating(true);
      await createPlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
      showToast('Playlist created!', 'success');
    } catch {
      showToast('Failed to create playlist', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectPlaylist = async (playlist) => {
    const pId = playlist._id || playlist.id;
    if (!token) {
      showToast('Please log in to manage playlists', 'warning');
      return;
    }
    try {
      setAddingId(pId);
      await addToPlaylist(pId, trackId);
      showToast(`Added to "${playlist.name}"`, 'success');
      onClose();
    } catch {
      showToast('Failed to add track to playlist', 'error');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.cardOuter}>
          <View style={styles.hardShadow} />
          <View style={styles.modalBox}>
            {/* Header */}
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <CassetteTag label="PLAYLIST" bg={colors.ink} textColor={colors.mint} />
                <Text style={styles.title}>ADD TO PLAYLIST</Text>
                <Text style={styles.subTitle} numberOfLines={1}>
                  "{track.title}" - {track.artist || 'Unknown'}
                </Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={18} color={colors.ink} />
              </TouchableOpacity>
            </View>

            {/* Quick Create Box */}
            <View style={styles.createBox}>
              <TextInput
                style={styles.input}
                placeholder="New Playlist Name..."
                placeholderTextColor={colors.grayText}
                value={newPlaylistName}
                onChangeText={setNewPlaylistName}
              />
              <TouchableOpacity
                style={styles.createBtn}
                onPress={handleCreateAndAdd}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color={colors.ink} />
                ) : (
                  <>
                    <Plus size={16} color={colors.ink} strokeWidth={3} />
                    <Text style={styles.createBtnText}>NEW</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Playlist Items */}
            <Text style={styles.sectionLabel}>YOUR PLAYLISTS ({playlists.length})</Text>
            {playlists.length === 0 ? (
              <View style={styles.emptyBox}>
                <FolderPlus size={32} color={colors.teal} />
                <Text style={styles.emptyText}>No playlists found.</Text>
                <Text style={styles.emptySub}>Create your first one above!</Text>
              </View>
            ) : (
              <FlatList
                data={playlists}
                keyExtractor={(item, index) => String(item._id || item.id || index)}
                style={{ maxHeight: 280 }}
                renderItem={({ item }) => {
                  const pId = item._id || item.id;
                  const count = Array.isArray(item.tracks) ? item.tracks.length : 0;
                  const isProcessing = addingId === pId;

                  return (
                    <TouchableOpacity
                      style={styles.playlistItem}
                      onPress={() => handleSelectPlaylist(item)}
                      disabled={isProcessing}
                    >
                      <View style={styles.playlistIcon}>
                        <Music size={16} color={colors.mint} />
                      </View>
                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={styles.playlistName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        <Text style={styles.playlistCount}>{count} TRACKS</Text>
                      </View>
                      {isProcessing ? (
                        <ActivityIndicator size="small" color={colors.teal} />
                      ) : (
                        <View style={styles.addPill}>
                          <Check size={14} color={colors.ink} />
                          <Text style={styles.addPillText}>ADD</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cardOuter: {
    width: '100%',
    maxWidth: 420,
    position: 'relative',
  },
  hardShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    backgroundColor: colors.ink,
    borderRadius: 8,
  },
  modalBox: {
    backgroundColor: colors.paper,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 8,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.ink,
    paddingBottom: 10,
  },
  title: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 18,
    color: colors.ink,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  subTitle: {
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderWidth: 1.5,
    borderColor: colors.ink,
    backgroundColor: colors.paperMuted,
    borderRadius: 6,
  },
  createBox: {
    flexDirection: 'row',
    marginBottom: 14,
    gap: 8,
  },
  input: {
    flex: 1,
    height: 42,
    backgroundColor: colors.paperLight,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.ink,
    fontWeight: '700',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.teal,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 14,
    gap: 4,
  },
  createBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: colors.ink,
  },
  sectionLabel: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    letterSpacing: 1,
    color: colors.inkMuted,
    marginBottom: 8,
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paperMuted,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
  },
  emptyText: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 12,
    color: colors.ink,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: 2,
  },
  playlistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paperLight,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  playlistIcon: {
    width: 34,
    height: 34,
    backgroundColor: colors.ink,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistName: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 13,
    color: colors.ink,
  },
  playlistCount: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: colors.inkMuted,
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mint,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 3,
  },
  addPillText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.ink,
  },
});
