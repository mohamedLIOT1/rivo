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
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';
import { formatDuration, sanitizeDuration } from '../utils/timeUtils';
import { styles } from './addSongStyles';

export default function AddSongModal({ visible, onClose, onSuccess }) {
  const { token, syncUserData } = useUser();
  const { showToast } = useToast();
  const { isDark } = useTheme();

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
          duration: sanitizeDuration(track.duration, 180),
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

  return (
    <Modal visible={visible} animationType={Platform.OS === 'android' ? 'none' : 'slide'} transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheetOuter}>
          {!isDark && <View style={styles.hardShadow} />}
          <View style={[
            styles.sheet,
            {
              backgroundColor: isDark ? '#111a18' : colors.paper,
              borderColor: isDark ? '#27272a' : colors.ink,
            }
          ]}>
            {/* Header */}
            <View style={[
              styles.header,
              { borderBottomColor: isDark ? '#27272a' : colors.ink }
            ]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.iconBox, isDark && { borderColor: '#27272a' }]}>
                  {activeTab === 'search' ? (
                    <Search size={18} color={colors.ink} />
                  ) : (
                    <LinkIcon size={18} color={colors.ink} />
                  )}
                </View>
                <View>
                  <Text style={[styles.title, { color: isDark ? '#ffffff' : colors.ink }]}>ADD SONG</Text>
                  <CassetteTag
                    label="AUDIO STREAM"
                    bg={isDark ? '#141d1b' : colors.ink}
                    textColor={isDark ? '#26c4b7' : colors.tealLight}
                  />
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={isDark ? '#e4e4e7' : colors.ink} />
              </TouchableOpacity>
            </View>

            {/* Tab Switcher */}
            <View style={[
              styles.tabBar,
              {
                backgroundColor: isDark ? '#141d1b' : '#ede5d3',
                borderColor: isDark ? '#27272a' : colors.ink,
              }
            ]}>
              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  activeTab === 'search' && (isDark ? { backgroundColor: '#26c4b7' } : styles.tabBtnActive),
                ]}
                onPress={() => setActiveTab('search')}
              >
                <Text style={[
                  styles.tabBtnText,
                  { color: isDark ? '#9ca3af' : colors.ink },
                  activeTab === 'search' && (isDark ? { color: '#08110f' } : styles.tabBtnTextActive),
                ]}>
                  SEARCH BY NAME
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  activeTab === 'link' && (isDark ? { backgroundColor: '#26c4b7' } : styles.tabBtnActive),
                ]}
                onPress={() => setActiveTab('link')}
              >
                <Text style={[
                  styles.tabBtnText,
                  { color: isDark ? '#9ca3af' : colors.ink },
                  activeTab === 'link' && (isDark ? { color: '#08110f' } : styles.tabBtnTextActive),
                ]}>
                  PASTE LINK
                </Text>
              </TouchableOpacity>
            </View>

            {/* Tab 1: Search by Name */}
            {activeTab === 'search' ? (
              <View style={{ flex: 1 }}>
                <View style={[
                  styles.searchBar,
                  {
                    backgroundColor: isDark ? '#08110f' : '#ffffff',
                    borderColor: isDark ? '#27272a' : colors.ink,
                  }
                ]}>
                  <Search size={16} color={isDark ? '#9ca3af' : colors.ink} style={{ marginRight: 8 }} />
                  <TextInput
                    style={[
                      styles.searchInput,
                      { color: isDark ? '#ffffff' : colors.ink }
                    ]}
                    placeholder="Search song or artist name (e.g. Amr Diab, Lege-cy)..."
                    placeholderTextColor={isDark ? '#6b7280' : '#6b7280'}
                    value={searchQuery}
                    onChangeText={handleSearchChange}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {isSearching && <ActivityIndicator size="small" color={isDark ? '#26c4b7' : colors.ink} />}
                </View>

                <ScrollView style={styles.resultsList} showsVerticalScrollIndicator={false}>
                  {searchResults.map((track, idx) => {
                    const tId = String(track.id || track._id || idx);
                    const isAdded = addedIds.has(tId);
                    const isAdding = addingId === tId;

                    return (
                      <View
                        key={tId}
                        style={[
                          styles.resultItem,
                          {
                            backgroundColor: isDark ? '#141d1b' : '#ffffff',
                            borderColor: isDark ? '#27272a' : colors.ink,
                          }
                        ]}
                      >
                        <Image
                          source={{
                            uri:
                              track.cover ||
                              track.coverUrl ||
                              'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100',
                          }}
                          style={[styles.resultCover, isDark && { backgroundColor: '#08110f' }]}
                        />
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={[styles.resultTitle, { color: isDark ? '#ffffff' : colors.ink }]} numberOfLines={1}>
                            {track.title}
                          </Text>
                          <Text style={[styles.resultArtist, { color: isDark ? '#9ca3af' : '#4b5563' }]} numberOfLines={1}>
                            {track.artist || 'Unknown Artist'}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            <Clock size={10} color={isDark ? '#9ca3af' : '#6b7280'} />
                            <Text style={[styles.resultMeta, isDark && { color: '#9ca3af' }]}>
                              {formatDuration(track.duration, 180)} • {track.source || 'Online'}
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
                      <Text style={[styles.emptyText, { color: isDark ? '#ffffff' : colors.ink }]}>
                        No songs found for "{searchQuery}"
                      </Text>
                      <Text style={[styles.emptySub, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                        Try searching with artist name or switch to "PASTE LINK".
                      </Text>
                    </View>
                  )}

                  {!searchQuery.trim() && (
                    <View style={styles.emptyState}>
                      <Search size={28} color="#9ca3af" />
                      <Text style={[styles.emptyText, { color: isDark ? '#ffffff' : colors.ink }]}>Search Catalog</Text>
                      <Text style={[styles.emptySub, { color: isDark ? '#9ca3af' : '#6b7280' }]}>
                        Type any song or artist name to find and add tracks instantly to your library.
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </View>
            ) : (
              /* Tab 2: Paste Link */
              <View style={styles.linkContent}>
                <Text style={[styles.desc, { color: isDark ? '#9ca3af' : colors.ink }]}>
                  Paste a YouTube, Spotify or direct MP3 stream URL to add it directly to your library:
                </Text>

                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? '#08110f' : '#ffffff',
                      borderColor: isDark ? '#27272a' : colors.ink,
                      color: isDark ? '#ffffff' : colors.ink,
                    }
                  ]}
                  placeholder="https://youtu.be/... or https://example.com/audio.mp3"
                  placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
                  value={url}
                  onChangeText={setUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[
                      styles.cancelBtn,
                      {
                        backgroundColor: isDark ? '#1f2937' : '#ede5d3',
                        borderColor: isDark ? '#27272a' : colors.ink,
                      }
                    ]}
                    onPress={onClose}
                  >
                    <Text style={[styles.cancelText, { color: isDark ? '#e4e4e7' : colors.ink }]}>
                      CANCEL
                    </Text>
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
