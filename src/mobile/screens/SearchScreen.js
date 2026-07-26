import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Search, Plus } from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { useAudioPlayer } from '../context/AudioContext';
import SongItem from '../components/SongItem';
import AddSongModal from '../components/AddSongModal';

export default function SearchScreen() {
  const { tracks, fetchPublicTracks } = useUser();
  const { playTrack } = useAudioPlayer();

  const [query, setQuery] = useState('');
  const [isAddSongVisible, setIsAddSongVisible] = useState(false);

  const filteredTracks = tracks.filter(track => {
    const q = query.toLowerCase();
    return (
      (track.title && track.title.toLowerCase().includes(q)) ||
      (track.artist && track.artist.toLowerCase().includes(q))
    );
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Title and Top Add Song Button */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>Search & Discover</Text>
          <TouchableOpacity style={styles.addSongBtn} onPress={() => setIsAddSongVisible(true)}>
            <Plus size={16} color="#000" />
            <Text style={styles.addSongText}>Add Song</Text>
          </TouchableOpacity>
        </View>

        {/* Search Input */}
        <View style={styles.searchBar}>
          <Search size={20} color="#a1a1aa" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search for song, artist, or album..."
            placeholderTextColor="#71717a"
            value={query}
            onChangeText={setQuery}
          />
        </View>

        {/* Modal for adding songs */}
        <AddSongModal
          visible={isAddSongVisible}
          onClose={() => setIsAddSongVisible(false)}
          onSuccess={fetchPublicTracks}
        />

        {/* Search Results */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {query ? `Search Results (${filteredTracks.length})` : 'All Available Library'}
          </Text>

          {filteredTracks.map((item) => (
            <SongItem key={item._id || item.id} track={item} onPlay={(t) => playTrack(t, filteredTracks)} />
          ))}

          {filteredTracks.length === 0 && (
            <Text style={styles.emptyText}>No matching songs found</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 48,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#ffffff',
  },
  addSongBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1DB954',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addSongText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#27272a',
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    marginLeft: 10,
    textAlign: 'left',
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 12,
  },
  emptyText: {
    color: '#71717a',
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 30,
  },
});
