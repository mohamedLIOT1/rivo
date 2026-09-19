import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, TouchableWithoutFeedback } from 'react-native';
import { Music, Plus, X, AlertTriangle, ArrowLeft, Check } from 'lucide-react-native';
import { useUser } from '../context/UserContext';

export default function PlaylistPickerModal({ visible, onClose, onSelect, onRemove, trackId, trackTitle }) {
  const { playlists } = useUser();
  const [duplicatePlaylist, setDuplicatePlaylist] = useState(null);

  useEffect(() => {
    if (!visible) {
      setDuplicatePlaylist(null);
    }
  }, [visible]);

  const handlePressPlaylist = (pl) => {
    const isAlready = trackId && (pl.trackIds || []).map(String).includes(String(trackId));
    if (isAlready) {
      setDuplicatePlaylist(pl);
    } else {
      onSelect?.(pl.id, false);
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modal}>
              <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {duplicatePlaylist && (
                    <TouchableOpacity onPress={() => setDuplicatePlaylist(null)} style={{ padding: 4 }}>
                      <ArrowLeft size={20} color="#a1a1aa" />
                    </TouchableOpacity>
                  )}
                  <Text style={styles.title}>
                    {duplicatePlaylist ? 'Already in Playlist' : 'Add to Playlist'}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose}>
                  <X size={24} color="#a1a1aa" />
                </TouchableOpacity>
              </View>

              {duplicatePlaylist ? (
                /* Duplicate Confirmation View */
                <View style={styles.confirmContainer}>
                  <View style={styles.alertBox}>
                    <AlertTriangle size={24} color="#f59e0b" style={{ alignSelf: 'center', marginBottom: 8 }} />
                    <Text style={styles.confirmTitle}>
                      "{trackTitle || 'This track'}" is already in "{duplicatePlaylist.name}".
                    </Text>
                    <Text style={styles.confirmSub}>
                      Do you want to add it again?
                    </Text>
                  </View>

                  {/* 2 Main Options */}
                  <View style={styles.btnRow}>
                    <TouchableOpacity
                      style={styles.addAgainBtn}
                      onPress={() => {
                        onSelect?.(duplicatePlaylist.id, true);
                        setDuplicatePlaylist(null);
                        onClose();
                      }}
                    >
                      <Text style={styles.addAgainText}>Add Again</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => setDuplicatePlaylist(null)}
                    >
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>

                  {/* 3rd Option: Small text below the 2 options */}
                  <TouchableOpacity
                    style={styles.removeTextBtn}
                    onPress={() => {
                      onRemove?.(duplicatePlaylist.id);
                      setDuplicatePlaylist(null);
                      onClose();
                    }}
                  >
                    <Text style={styles.removeText}>Remove from playlist</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* Playlist List View */
                <ScrollView style={styles.list}>
                  {playlists.map(pl => {
                    const isAlready = trackId && (pl.trackIds || []).map(String).includes(String(trackId));
                    return (
                      <TouchableOpacity
                        key={pl.id}
                        style={styles.item}
                        onPress={() => handlePressPlaylist(pl)}
                      >
                        <View style={[styles.iconBox, isAlready && { backgroundColor: '#092520' }]}>
                          {isAlready ? <Check size={20} color="#1DB954" /> : <Music size={20} color="#1DB954" />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name}>{pl.name}</Text>
                          {isAlready && (
                            <Text style={styles.badgeText}>Already in playlist</Text>
                          )}
                        </View>
                        {isAlready ? (
                          <Check size={18} color="#1DB954" />
                        ) : (
                          <Plus size={18} color="#71717a" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    backgroundColor: '#18181b',
    borderRadius: 20,
    maxHeight: '65%',
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  list: {
    marginBottom: 10,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#09090b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  name: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  badgeText: {
    fontSize: 11,
    color: '#1DB954',
    fontWeight: '700',
    marginTop: 2,
  },
  confirmContainer: {
    paddingVertical: 10,
  },
  alertBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    marginBottom: 16,
    alignItems: 'center',
  },
  confirmTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  confirmSub: {
    color: '#a1a1aa',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  addAgainBtn: {
    flex: 1,
    backgroundColor: '#1DB954',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  addAgainText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 14,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#27272a',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  removeTextBtn: {
    marginTop: 14,
    alignItems: 'center',
    padding: 6,
  },
  removeText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
