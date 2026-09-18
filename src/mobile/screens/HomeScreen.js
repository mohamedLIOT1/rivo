import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, FlatList, useWindowDimensions } from 'react-native';
import { Wifi, WifiOff, Plus } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import SongItem from '../components/SongItem';
import AddSongModal from '../components/AddSongModal';

export default function HomeScreen({ navigation }) {
  const { tracks, fetchPublicTracks } = useUser();
  const { playTrack, downloadedTracks, isOfflineMode } = useAudioPlayer();
  const { width } = useWindowDimensions();
  const [isAddSongVisible, setIsAddSongVisible] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    // Entrance Animation
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 50, friction: 7, useNativeDriver: true })
    ]).start();
  }, []);

  const defaultCover = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80';

  const renderHeader = () => (
    <View>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <View style={styles.logoBadge}><Text style={{ color: '#000', fontWeight: '900', fontSize: 18 }}>L</Text></View>
          <Text style={styles.brandName}>LIOFY</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity
            style={styles.addSongBtn}
            onPress={() => setIsAddSongVisible(true)}
          >
            <Plus size={16} color="#000" />
            <Text style={styles.addSongText}>Add Song</Text>
          </TouchableOpacity>

          <View style={[styles.statusBadge, isOfflineMode && styles.offlineBadge]}>
            {isOfflineMode ? (
              <><WifiOff size={14} color="#ef4444" /><Text style={styles.statusOfflineText}>Offline</Text></>
            ) : (
              <><Wifi size={14} color="#1DB954" /><Text style={styles.statusOnlineText}>Online</Text></>
            )}
          </View>
        </View>
      </View>

      <AddSongModal
        visible={isAddSongVisible}
        onClose={() => setIsAddSongVisible(false)}
        onSuccess={() => {
          fetchPublicTracks();
        }}
      />


      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Listen to your favorite songs anytime</Text>
      </View>

      {(downloadedTracks || []).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Offline ({(downloadedTracks || []).length})</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={downloadedTracks || []}
            keyExtractor={(t) => `dl-${t._id || t.id}`}
            renderItem={({ item }) => {
              const cardWidth = width * 0.3; // Responsive width
              return (
                <TouchableOpacity style={[styles.card, { width: cardWidth }]} onPress={() => playTrack(item, downloadedTracks)}>
                  <Image source={{ uri: item.coverUrl || item.cover || defaultCover }} style={[styles.cardCover, { width: cardWidth, height: cardWidth }]} />
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}
      <Text style={styles.sectionTitle}>Global Library</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Animated.FlatList
        data={Array.isArray(tracks) ? tracks : []}
        keyExtractor={(item) => `main-${item._id || item.id}`}
        ListHeaderComponent={renderHeader}
        style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        contentContainerStyle={styles.scrollContent}
        renderItem={({ item }) => (
          <SongItem track={item} onPlay={(t) => playTrack(t, tracks)} />
        )}
        ListEmptyComponent={<View style={styles.emptyBox}><Text style={styles.emptyText}>Loading songs...</Text></View>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  scrollContent: { padding: 16, paddingTop: 40, paddingBottom: 100 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoBadge: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#1DB954', justifyContent: 'center', alignItems: 'center' },
  brandName: { fontSize: 22, fontWeight: '900', color: '#ffffff' },
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
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(29,185,84,0.1)', padding: 8, borderRadius: 20 },

  offlineBadge: { backgroundColor: 'rgba(239,68,68,0.1)' },
  statusOnlineText: { fontSize: 11, color: '#1DB954', fontWeight: 'bold' },
  statusOfflineText: { fontSize: 11, color: '#ef4444', fontWeight: 'bold' },
  banner: { backgroundColor: '#18181b', borderRadius: 16, padding: 20, marginBottom: 24 },
  bannerTitle: { fontSize: 16, fontWeight: '800', color: '#ffffff', textAlign: 'center' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#ffffff', marginBottom: 12, textAlign: 'left' },
  card: { marginRight: 12 },
  cardCover: { borderRadius: 12, backgroundColor: '#18181b' },
  cardTitle: { fontSize: 12, fontWeight: 'bold', color: '#ffffff', marginTop: 6 },
  emptyBox: { padding: 40, alignItems: 'center' },
  emptyText: { color: '#71717a' },
});
