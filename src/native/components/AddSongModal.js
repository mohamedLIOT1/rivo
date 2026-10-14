import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Plus, Search, Link as LinkIcon, Music, Check, Clock } from 'lucide-react-native';
import { API_BASE_URL } from '../config';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';

export default function AddSongModal({ visible, onClose, onSuccess }) {
  const { token, syncUserData } = useUser();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'link'
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const [addedIds, setAddedIds] = useState(new Set());

  // Link import
  const [url, setUrl] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);

  const searchTimerRef = useRef(null);

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!text.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(text.trim())}`);
        const data = await res.json();
        if (data?.success && Array.isArray(data.tracks)) {
          setSearchResults(data.tracks.filter(t => t.source !== 'SoundCloud' && !t.audioUrl?.includes('soundcloud.com')));
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  };

  const handleAddTrack = async (track) => {
    const tId = String(track.id || track._id || '');
    setAddingId(tId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: track.title,
          artist: track.artist,
          album: track.album || 'Single',
          cover: track.cover || track.coverUrl,
          audioUrl: track.audioUrl,
          duration: track.duration || 180,
          genre: track.genre || 'Pop',
          source: track.source || 'Online',
          lyrics: track.lyrics || [],
        }),
      });

      const data = await res.json();
      if (res.ok && (data.success || data.track)) {
        setAddedIds((prev) => new Set([...prev, tId]));
        showToast(`Added "${track.title}" to library!`, 'success');
        await syncUserData();
        if (onSuccess) onSuccess(data.track);
      } else {
        showToast(data.message || data.error || 'Failed to add song', 'error');
      }
    } catch {
      showToast('Network error adding song', 'error');
    } finally {
      setAddingId(null);
    }
  };

  const handleImportLink = async () => {
    if (!url.trim()) return;
    try {
      setLinkLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/tracks/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await res.json();
      if (res.ok && (data.success || data.track)) {
        showToast(`Imported: ${data.track?.title || 'Song added!'}`, 'success');
        setUrl('');
        await syncUserData();
        if (onSuccess) onSuccess(data.track);
        onClose();
      } else {
        showToast(data.message || data.error || 'Failed to resolve link', 'error');
      }
    } catch {
      showToast('Network error importing song', 'error');
    } finally {
      setLinkLoading(false);
    }
  };

  const formatDuration = (sec) => {
    const s = parseInt(sec, 10) || 180;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheetOuter}>
          <View style={styles.hardShadow} />
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.header}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={styles.iconBox}>
                  {activeTab === 'search' ? (
                    <Search size={18} color={colors.ink} />
                  ) : (
                    <LinkIcon size={18} color={colors.ink} />
                  )}
                </View>
                <View>
                  <Text style={styles.title}>ADD SONG</Text>
                  <CassetteTag label="AUDIO STREAM" bg={colors.ink} textColor={colors.tealLight} />
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={colors.ink} />
              </TouchableOpacity>
            </View>

            {/* Tab Switcher */}
            <View style={styles.tabBar}>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'search' && styles.tabBtnActive]}
                onPress={() => setActiveTab('search')}
              >
                <Text style={[styles.tabBtnText, activeTab === 'search' && styles.tabBtnTextActive]}>
                  SEARCH BY NAME
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabBtn, activeTab === 'link' && styles.tabBtnActive]}
                onPress={() => setActiveTab('link')}
              >
                <Text style={[styles.tabBtnText, activeTab === 'link' && styles.tabBtnTextActive]}>
                  PASTE LINK
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab 1: Search by Name */}
            {activeTab === 'search' ? (
              <View style={{ flex: 1 }}>
                <View style={styles.searchBar}>
                  <Search size={16} color={colors.ink} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search song or artist name (e.g. Amr Diab, Lege-cy)..."
                    placeholderTextColor="#6b7280"
                    value={searchQuery}
                    onChangeText={handleSearchChange}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {isSearching && <ActivityIndicator size="small" color={colors.ink} />}
                </View>

                <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
                  {searchResults.map((track, idx) => {
                    const tId = String(track.id || track._id || idx);
                    const isAdded = addedIds.has(tId);
                    const isAdding = addingId === tId;

                    return (
                      <View key={tId} style={styles.resultItem}>
                        <Image
                          source={{
                            uri:
                              track.cover ||
                              track.coverUrl ||
                              'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100',
                          }}
                          style={styles.resultCover}
                        />
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.resultTitle} numberOfLines={1}>
                            {track.title}
                          </Text>
                          <Text style={styles.resultArtist} numberOfLines={1}>
                            {track.artist || 'Unknown Artist'}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <Clock size={10} color="#6b7280" />
                            <Text style={styles.resultMeta}>
                              {formatDuration(track.duration)} • {track.source || 'Online'}
                            </Text>
                          </View>
                        </View>

                        <TouchableOpacity
                          style={[
                            styles.addBtn,
                            isAdded && styles.addBtnDone,
                            isAdding && { opacity: 0.6 },
                          ]}
                          onPress={() => !isAdded && !isAdding && handleAddTrack(track)}
                          disabled={isAdded || isAdding}
                        >
                          {isAdding ? (
                            <ActivityIndicator size="small" color={colors.ink} />
                          ) : isAdded ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Check size={12} color={colors.ink} />
                              <Text style={styles.addBtnText}>ADDED</Text>
                            </View>
                          ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Plus size={12} color={colors.ink} />
                              <Text style={styles.addBtnText}>ADD</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })}

                  {!isSearching && searchQuery.trim() !== '' && searchResults.length === 0 && (
                    <View style={styles.emptyState}>
                      <Music size={28} color="#9ca3af" />
                      <Text style={styles.emptyText}>No songs found for "{searchQuery}"</Text>
                      <Text style={styles.emptySub}>
                        Try searching with artist name or switch to "PASTE LINK".
                      </Text>
                    </View>
                  )}

                  {!searchQuery.trim() && (
                    <View style={styles.emptyState}>
                      <Search size={28} color="#9ca3af" />
                      <Text style={styles.emptyText}>Search Catalog</Text>
                      <Text style={styles.emptySub}>
                        Type any song or artist name to find and add tracks instantly to your library.
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            ) : (
              /* Tab 2: Paste Link */
              <View style={styles.linkContent}>
                <Text style={styles.desc}>
                  Paste a YouTube, Spotify or direct MP3 stream URL to add it directly to your library:
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="https://youtu.be/... or https://example.com/audio.mp3"
                  placeholderTextColor="#9ca3af"
                  value={url}
                  onChangeText={setUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <View style={styles.btnRow}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                    <Text style={styles.cancelText}>CANCEL</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.submitBtn, (!url.trim() || linkLoading) && { opacity: 0.6 }]}
                    onPress={handleImportLink}
                    disabled={!url.trim() || linkLoading}
                  >
                    {linkLoading ? (
                      <ActivityIndicator size="small" color={colors.ink} />
                    ) : (
                      <Text style={styles.submitText}>ADD SONG</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
    padding: 12,
  },
  sheetOuter: {
    position: 'relative',
    height: '80%',
    maxHeight: '80%',
  },
  hardShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
    backgroundColor: colors.ink,
    borderRadius: 16,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.paper,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
    marginBottom: 10,
  },
  iconBox: {
    width: 34,
    height: 34,
    backgroundColor: colors.mint,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 15,
    color: colors.ink,
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 4,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ede5d3',
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    padding: 2,
    marginBottom: 10,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: colors.ink,
  },
  tabBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.ink,
  },
  tabBtnTextActive: {
    color: colors.mint,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.ink,
    fontWeight: 'bold',
  },
  resultsList: {
    flex: 1,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  resultCover: {
    width: 44,
    height: 44,
    borderRadius: 6,
    marginRight: 10,
    backgroundColor: '#ede5d3',
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.ink,
  },
  resultArtist: {
    fontSize: 11,
    color: '#4b5563',
    marginTop: 1,
  },
  resultMeta: {
    fontSize: 10,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  addBtn: {
    backgroundColor: colors.mint,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDone: {
    backgroundColor: '#86efac',
  },
  addBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.ink,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 13,
    color: colors.ink,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
  linkContent: {
    paddingTop: 8,
  },
  desc: {
    fontSize: 12,
    color: colors.ink,
    opacity: 0.85,
    lineHeight: 18,
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: colors.ink,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#ede5d3',
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: colors.ink,
  },
  submitBtn: {
    flex: 2,
    backgroundColor: colors.mint,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: colors.ink,
  },
});
