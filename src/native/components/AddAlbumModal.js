import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import {
  X,
  Disc,
  Link2,
  Sparkles,
  Music,
  Check,
  CheckSquare,
  Square,
  Search,
  Plus,
} from 'lucide-react-native';
import { API_BASE_URL } from '../config';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { normalizeCoverUri } from '../utils/coverUtils';

export default function AddAlbumModal({
  visible,
  onClose,
  initialArtistName = '',
  artistTracks = [],
  artistAvatar = '',
  onAlbumCreated = () => {},
}) {
  const { token, fetchPublicTracks } = useUser();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('link'); // 'link' | 'tracks'
  const [linkUrl, setLinkUrl] = useState('');
  const [name, setName] = useState('');
  const [artist, setArtist] = useState(initialArtistName || '');
  const [cover, setCover] = useState('');
  const [releaseDate, setReleaseDate] = useState(new Date().getFullYear().toString());
  const [genre, setGenre] = useState('Pop');
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);
  const [trackSearch, setTrackSearch] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lookupSuccess, setLookupSuccess] = useState(false);

  useEffect(() => {
    if (visible) {
      setActiveTab('link');
      setLinkUrl('');
      setName('');
      setArtist(initialArtistName || '');
      setCover(artistAvatar || artistTracks[0]?.coverUrl || artistTracks[0]?.cover || '');
      setReleaseDate(new Date().getFullYear().toString());
      setGenre('Pop');
      setSelectedTrackIds(artistTracks.map(t => String(t._id || t.id)));
      setTrackSearch('');
      setIsLookingUp(false);
      setIsSaving(false);
      setLookupSuccess(false);
    }
  }, [visible, initialArtistName, artistAvatar, artistTracks]);

  const handleAutoLookup = async () => {
    const q = (linkUrl || name || artist).trim();
    if (!q) {
      showToast('Enter an album name or paste a link first', 'error');
      return;
    }

    setIsLookingUp(true);
    try {
      const isUrl = q.startsWith('http://') || q.startsWith('https://');
      const param = isUrl ? `url=${encodeURIComponent(q)}` : `query=${encodeURIComponent(q)}`;
      const res = await fetch(`${API_BASE_URL}/api/albums/lookup?${param}`);
      const data = await res.json();

      if (res.ok && data.success) {
        if (data.name) setName(data.name);
        if (data.artist) setArtist(data.artist);
        if (data.cover) setCover(data.cover);
        if (data.releaseDate) setReleaseDate(String(data.releaseDate));
        if (data.genre) setGenre(data.genre);
        setLookupSuccess(true);
        showToast(`Found: ${data.name || 'Album metadata'}`, 'success');
      } else {
        showToast(data.error || 'Could not find metadata', 'info');
      }
    } catch {
      showToast('Metadata lookup failed', 'error');
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleCreateAlbum = async () => {
    if (!name.trim()) {
      showToast('Album name is required', 'error');
      return;
    }
    if (!artist.trim()) {
      showToast('Artist name is required', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        artist: artist.trim(),
        cover: cover.trim() || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
        releaseDate: releaseDate.trim() || new Date().getFullYear().toString(),
        genre: genre.trim() || 'Pop',
        trackIds: selectedTrackIds,
        importUrl: linkUrl.trim(),
      };

      const res = await fetch(`${API_BASE_URL}/api/albums`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok && (data.success || data.album)) {
        showToast(`Album "${name}" created successfully!`, 'success');
        if (fetchPublicTracks) fetchPublicTracks();
        if (onAlbumCreated) onAlbumCreated(data.album || data);
        onClose();
      } else {
        showToast(data.error || 'Failed to create album', 'error');
      }
    } catch {
      showToast('Error creating album', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleTrack = (id) => {
    setSelectedTrackIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filteredCandidateTracks = useMemo(() => {
    if (!trackSearch.trim()) return artistTracks;
    const q = trackSearch.toLowerCase().trim();
    return artistTracks.filter(t => (t.title && t.title.toLowerCase().includes(q)));
  }, [artistTracks, trackSearch]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="formSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Disc size={20} color="#17a398" strokeWidth={2.5} />
            <Text style={styles.headerTitle}>ADD NEW ALBUM</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <X size={20} color="#fdfbf7" />
          </TouchableOpacity>
        </View>

        {/* Tab Switcher */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'link' && styles.tabActive]}
            onPress={() => setActiveTab('link')}
            activeOpacity={0.8}
          >
            <Link2 size={14} color={activeTab === 'link' ? '#0b1110' : '#9ca3af'} strokeWidth={2.4} />
            <Text style={[styles.tabText, activeTab === 'link' && styles.tabTextActive]}>
              AUTO-GRAB / LINK
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'tracks' && styles.tabActive]}
            onPress={() => setActiveTab('tracks')}
            activeOpacity={0.8}
          >
            <Music size={14} color={activeTab === 'tracks' ? '#0b1110' : '#9ca3af'} strokeWidth={2.4} />
            <Text style={[styles.tabText, activeTab === 'tracks' && styles.tabTextActive]}>
              SELECT SONGS ({selectedTrackIds.length})
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {activeTab === 'link' ? (
            <View style={styles.formSection}>
              {/* Auto Lookup Input */}
              <Text style={styles.fieldLabel}>SPOTIFY / YOUTUBE / ITUNES LINK OR NAME</Text>
              <View style={styles.lookupRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Paste URL or album title..."
                  placeholderTextColor="#6b7280"
                  value={linkUrl}
                  onChangeText={setLinkUrl}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.lookupBtn}
                  onPress={handleAutoLookup}
                  disabled={isLookingUp}
                  activeOpacity={0.8}
                >
                  {isLookingUp ? (
                    <ActivityIndicator size="small" color="#0b1110" />
                  ) : (
                    <>
                      <Sparkles size={14} color="#0b1110" strokeWidth={2.5} />
                      <Text style={styles.lookupBtnText}>GRAB</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* Album Name */}
              <Text style={styles.fieldLabel}>ALBUM TITLE *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. MATADOR"
                placeholderTextColor="#6b7280"
                value={name}
                onChangeText={setName}
              />

              {/* Artist Name */}
              <Text style={styles.fieldLabel}>ARTIST *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Marwan Moussa"
                placeholderTextColor="#6b7280"
                value={artist}
                onChangeText={setArtist}
              />

              {/* Cover Art URL */}
              <Text style={styles.fieldLabel}>COVER ARTWORK URL</Text>
              <TextInput
                style={styles.input}
                placeholder="https://..."
                placeholderTextColor="#6b7280"
                value={cover}
                onChangeText={setCover}
                autoCapitalize="none"
              />

              {cover ? (
                <View style={styles.previewBox}>
                  <Image source={{ uri: normalizeCoverUri(cover) }} style={styles.previewImage} resizeMode="cover" />
                  <Text style={styles.previewText}>Artwork Preview</Text>
                </View>
              ) : null}

              {/* Release Year & Genre */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>YEAR</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="2026"
                    placeholderTextColor="#6b7280"
                    value={releaseDate}
                    onChangeText={setReleaseDate}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>GENRE</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Hip-Hop, Rap, Pop"
                    placeholderTextColor="#6b7280"
                    value={genre}
                    onChangeText={setGenre}
                  />
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.formSection}>
              {/* Search tracks */}
              <Text style={styles.fieldLabel}>FILTER SONGS TO INCLUDE IN THIS ALBUM</Text>
              <View style={styles.searchBar}>
                <Search size={16} color="#6b7280" style={{ marginRight: 8 }} />
                <TextInput
                  style={{ flex: 1, color: '#fdfbf7', fontSize: 13, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }}
                  placeholder="Search artist songs..."
                  placeholderTextColor="#6b7280"
                  value={trackSearch}
                  onChangeText={setTrackSearch}
                />
              </View>

              <View style={styles.trackList}>
                {filteredCandidateTracks.map((t, idx) => {
                  const tid = String(t._id || t.id);
                  const isSelected = selectedTrackIds.includes(tid);
                  return (
                    <TouchableOpacity
                      key={tid || idx}
                      style={[styles.trackItem, isSelected && styles.trackItemActive]}
                      onPress={() => toggleTrack(tid)}
                      activeOpacity={0.7}
                    >
                      {isSelected ? (
                        <CheckSquare size={18} color="#17a398" strokeWidth={2.5} />
                      ) : (
                        <Square size={18} color="#6b7280" strokeWidth={2} />
                      )}
                      <Text style={[styles.trackItemTitle, isSelected && { color: '#fdfbf7', fontWeight: 'bold' }]} numberOfLines={1}>
                        {t.title}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={styles.createBtn}
            onPress={handleCreateAlbum}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator color="#0b1110" />
            ) : (
              <>
                <Plus size={16} color="#0b1110" strokeWidth={3} />
                <Text style={styles.createBtnText}>CONFIRM & SAVE ALBUM</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b1110',
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderColor: '#17a398',
    marginBottom: 16,
  },
  headerTitle: {
    color: '#fdfbf7',
    fontSize: 16,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#162321',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#243b37',
  },
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#162321',
    borderWidth: 1.5,
    borderColor: '#243b37',
  },
  tabActive: {
    backgroundColor: '#17a398',
    borderColor: '#17a398',
  },
  tabText: {
    color: '#9ca3af',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  tabTextActive: {
    color: '#0b1110',
    fontWeight: '900',
  },
  scroll: {
    flex: 1,
  },
  formSection: {
    marginBottom: 20,
  },
  fieldLabel: {
    color: '#9ca3af',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 6,
    marginTop: 10,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#141d1b',
    borderWidth: 1.5,
    borderColor: '#243b37',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fdfbf7',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  lookupRow: {
    flexDirection: 'row',
    gap: 8,
  },
  lookupBtn: {
    backgroundColor: '#17a398',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: '#17a398',
  },
  lookupBtnText: {
    color: '#0b1110',
    fontSize: 12,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  previewBox: {
    marginTop: 12,
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#141d1b',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#243b37',
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  previewText: {
    color: '#17a398',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#141d1b',
    borderWidth: 1.5,
    borderColor: '#243b37',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  trackList: {
    backgroundColor: '#141d1b',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#243b37',
    padding: 6,
    maxHeight: 350,
  },
  trackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderColor: '#1f2f2b',
  },
  trackItemActive: {
    backgroundColor: 'rgba(23,163,152,0.1)',
  },
  trackItemTitle: {
    color: '#9ca3af',
    fontSize: 13,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  createBtn: {
    backgroundColor: '#17a398',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: '#0b1110',
    shadowColor: '#17a398',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
    marginTop: 10,
  },
  createBtnText: {
    color: '#0b1110',
    fontSize: 13,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 0.5,
  },
});
