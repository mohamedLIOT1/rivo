import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView, TouchableWithoutFeedback } from 'react-native';
import { Music, Plus, X } from 'lucide-react-native';
import { useUser } from '../context/UserContext';

export default function PlaylistPickerModal({ visible, onClose, onSelect }) {
  const { playlists, createPlaylist } = useUser();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modal}>
              <View style={styles.header}>
                <Text style={styles.title}>Add to Playlist</Text>
                <TouchableOpacity onPress={onClose}>
                  <X size={24} color="#a1a1aa" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.list}>
                {playlists.map(pl => (
                  <TouchableOpacity
                    key={pl.id}
                    style={styles.item}
                    onPress={() => {
                      onSelect(pl.id);
                      onClose();
                    }}
                  >
                    <View style={styles.iconBox}>
                      <Music size={20} color="#1DB954" />
                    </View>
                    <Text style={styles.name}>{pl.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
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
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    width: '100%',
    backgroundColor: '#18181b',
    borderRadius: 20,
    maxHeight: '60%',
    padding: 20,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
});
