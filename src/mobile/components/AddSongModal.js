import React, { useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Image
} from 'react-native';
import { X, Search, Link as LinkIcon, Plus, Check, Save, Music } from 'lucide-react-native';
import { API_BASE_URL } from '../config';

export default function AddSongModal({ visible, onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState('search'); // 'search' | 'link' | 'manual'

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addedTrackIds, setAddedTrackIds] = useState(new Set());

  // Link Import State
  const [linkUrl, setLinkUrl] = useState('');
  const [isImportingLink, setIsImportingLink] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState(null);

  // Manual Input State
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [genre, setGenre] = useState('Pop');
  const [audioUrl, setAudioUrl] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Search Online (YouTube / SoundCloud via API)
  const handleOnlineSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setIsSearching(true);
    setSearchResults([]);

    // Check if input is a URL (Spotify, YouTube, SoundCloud, Apple Music, direct)
    if (/^(https?:\/\/|spotify:|youtu)/i.test(q)) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/tracks/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: q })
        });
        const data = await res.json();
        if (data.success && data.track) {
          setSearchResults([data.track]);
          setIsSearching(false);
          return;
        }
      } catch (err) {
        console.warn('Link resolve error in search:', err);
      }
    }

    try {
      // 1. Try Backend Search Endpoint
      const res = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
        setSearchResults(data.tracks);
        setIsSearching(false);
        return;
      }
    } catch (err) {
      console.warn('Backend search error:', err);
    }

    // 2. Direct SoundCloud API Fallback
    const SOUNDCLOUD_CLIENT_IDS = [
      'Mxv2e5wxnWei6krLywjIXpztX7S0VCeK',
      'iZ8g4v72mUqvA8jGFBsFoxWYuERgZaWi'
    ];

    for (const clientId of SOUNDCLOUD_CLIENT_IDS) {
      try {
        const scRes = await fetch(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(q)}&client_id=${clientId}&limit=12`);
        if (!scRes.ok) continue;
        const scData = await scRes.json();
        if (scData && Array.isArray(scData.collection) && scData.collection.length > 0) {
          const items = [];
          for (const item of scData.collection) {
            if ((item.duration || 0) < 30000) continue;
            const prog = item.media?.transcodings?.find(t => t.format?.protocol === 'progressive');
            if (!prog) continue;

            try {
              const streamRes = await fetch(`${prog.url}?client_id=${clientId}`);
              if (!streamRes.ok) continue;
              const streamData = await streamRes.json();
              if (!streamData.url) continue;

              items.push({
                id: `sc-${item.id}`,
                title: item.title || q,
                artist: item.user?.username || 'Artist',
                album: 'Single',
                cover: item.artwork_url
                  ? item.artwork_url.replace('-large', '-t500x500')
                  : (item.user?.avatar_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600'),
                audioUrl: streamData.url,
                duration: Math.round((item.duration || 180000) / 1000),
                source: 'SoundCloud',
              });
            } catch (err) {}
          }

          if (items.length > 0) {
            setSearchResults(items);
            setIsSearching(false);
            return;
          }
        }
      } catch (err) {}
    }

    setIsSearching(false);
  };

  const handleAddTrack = async (track) => {
    if (addedTrackIds.has(track.id)) return;
    try {
      setAddedTrackIds(prev => new Set(prev).add(track.id));
      const res = await fetch(`${API_BASE_URL}/api/tracks/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: track.title,
          artist: track.artist,
          album: track.album || 'Single',
          genre: track.genre || 'Pop',
          cover: track.cover,
          audioUrl: track.audioUrl,
          duration: track.duration || 180,
          source: track.source || 'YouTube',
        }),
      });

      if (res.ok && onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.warn('Failed adding track to DB:', err);
    }
  };

  const handleManualSave = async () => {
    if (!title || !artist || !audioUrl) {
      setError('Please enter song title, artist and audio URL');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const res = await fetch(`${API_BASE_URL}/api/tracks/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, artist, album: album || 'Single', genre, audioUrl,
          cover: coverUrl || undefined,
          source: 'Manual',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save song');

      if (onSuccess) onSuccess();
      setTitle(''); setArtist(''); setAlbum(''); setAudioUrl(''); setCoverUrl('');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkImport = async () => {
    const q = linkUrl.trim();
    if (!q) {
      setLinkError('Please paste a song link');
      return;
    }

    try {
      setIsImportingLink(true);
      setLinkError('');
      setLinkSuccess(null);

      const res = await fetch(`${API_BASE_URL}/api/tracks/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: q })
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.track) {
        throw new Error(data.error || 'Failed to import track');
      }

      setLinkSuccess(data.track);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setLinkUrl('');
        onClose();
      }, 1500);
    } catch (err) {
      setLinkError(err.message || 'Error importing link');
    } finally {
      setIsImportingLink(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Add Song (Global Library)</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={22} color="#a1a1aa" />
            </TouchableOpacity>
          </View>

          {/* Sub Navigation Tabs */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'search' && styles.activeTabBtn]}
              onPress={() => setActiveTab('search')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'search' && styles.activeTabBtnText]}>
                🔍 Search
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'link' && styles.activeTabBtn]}
              onPress={() => setActiveTab('link')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'link' && styles.activeTabBtnText]}>
                🔗 By Link
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'manual' && styles.activeTabBtn]}
              onPress={() => setActiveTab('manual')}
            >
              <Text style={[styles.tabBtnText, activeTab === 'manual' && styles.activeTabBtnText]}>
                ✏️ Manual
              </Text>
            </TouchableOpacity>
          </View>

          {activeTab === 'search' ? (
            <View style={{ flex: 1 }}>
              {/* Search Bar */}
              <View style={styles.searchBarRow}>
                <TextInput
                  style={styles.searchBarInput}
                  placeholder="Search YouTube & SoundCloud..."
                  placeholderTextColor="#71717a"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleOnlineSearch}
                  returnKeyType="search"
                />
                <TouchableOpacity style={styles.searchSubmitBtn} onPress={handleOnlineSearch} disabled={isSearching}>
                  {isSearching ? <ActivityIndicator size="small" color="#000" /> : <Search size={18} color="#000" />}
                </TouchableOpacity>
              </View>

              {/* Search Results */}
              <ScrollView style={{ flex: 1, marginTop: 10 }} showsVerticalScrollIndicator={false}>
                {searchResults.map((track) => {
                  const isAdded = addedTrackIds.has(track.id);
                  return (
                    <View key={track.id} style={styles.trackResultCard}>
                      <Image
                        source={{ uri: track.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600' }}
                        style={styles.trackCover}
                      />
                      <View style={{ flex: 1, marginHorizontal: 10 }}>
                        <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
                        <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
                        <View style={styles.sourceTag}>
                          <Text style={styles.sourceTagText}>{track.source || 'Online'}</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={[styles.addTrackBtn, isAdded && styles.addedTrackBtn]}
                        onPress={() => handleAddTrack(track)}
                        disabled={isAdded}
                      >
                        {isAdded ? <Check size={18} color="#000" /> : <Plus size={18} color="#000" />}
                      </TouchableOpacity>
                    </View>
                  );
                })}

                {searchResults.length === 0 && !isSearching && (
                  <Text style={styles.emptyText}>
                    Search for any song name or paste a link and it will be added to the global library 🌍
                  </Text>
                )}
              </ScrollView>
            </View>
          ) : activeTab === 'link' ? (
            /* Link Import Form */
            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Song Link / URL *</Text>
                <TextInput
                  style={styles.input}
                  value={linkUrl}
                  onChangeText={setLinkUrl}
                  placeholder="Spotify, YouTube, SoundCloud or MP3 link..."
                  placeholderTextColor="#52525b"
                  autoCapitalize="none"
                />
              </View>

              <Text style={[styles.emptyText, { marginVertical: 8, textAlign: 'left' }]}>
                Supported: Spotify tracks, YouTube videos/shorts, SoundCloud tracks, Apple Music, and direct MP3 audio files.
              </Text>

              {!!linkError && <Text style={styles.errorText}>{linkError}</Text>}

              {!!linkSuccess && (
                <View style={{ backgroundColor: '#092520', padding: 12, borderRadius: 10, marginVertical: 10, borderWidth: 1, borderColor: '#17a398' }}>
                  <Text style={{ color: '#17a398', fontWeight: 'bold', fontSize: 13 }}>
                    ✅ Imported "{linkSuccess.title}" by {linkSuccess.artist}!
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: '#17a398' }]}
                onPress={handleLinkImport}
                disabled={isImportingLink || !linkUrl.trim()}
              >
                {isImportingLink ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <>
                    <LinkIcon size={18} color="#000" />
                    <Text style={styles.saveBtnText}>Resolve & Add to Library</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          ) : (
            /* Manual Form */
            <ScrollView style={styles.form} showsVerticalScrollIndicator={false}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Song Title *</Text>
                <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="e.g. Blinding Lights" placeholderTextColor="#52525b" />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Artist *</Text>
                <TextInput style={styles.input} value={artist} onChangeText={setArtist} placeholder="e.g. The Weeknd" placeholderTextColor="#52525b" />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Album</Text>
                <TextInput style={styles.input} value={album} onChangeText={setAlbum} placeholder="e.g. After Hours" placeholderTextColor="#52525b" />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Genre</Text>
                <TextInput style={styles.input} value={genre} onChangeText={setGenre} placeholder="e.g. Pop" placeholderTextColor="#52525b" />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Audio MP3 or Stream URL *</Text>
                <TextInput style={styles.input} value={audioUrl} onChangeText={setAudioUrl} placeholder="https://..." placeholderTextColor="#52525b" />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>Cover Image URL (Optional)</Text>
                <TextInput style={styles.input} value={coverUrl} onChangeText={setCoverUrl} placeholder="https://..." placeholderTextColor="#52525b" />
              </View>

              {!!error && <Text style={styles.errorText}>{error}</Text>}

              <TouchableOpacity style={styles.saveBtn} onPress={handleManualSave} disabled={loading}>
                {loading ? <ActivityIndicator color="#000" /> : (
                  <>
                    <Save size={18} color="#000" />
                    <Text style={styles.saveBtnText}>Save to Global Library</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#18181b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '88%',
    minHeight: '65%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  closeBtn: {
    padding: 4,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#09090b',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTabBtn: {
    backgroundColor: '#1DB954',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#71717a',
  },
  activeTabBtnText: {
    color: '#000000',
  },
  searchBarRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchBarInput: {
    flex: 1,
    backgroundColor: '#09090b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#27272a',
    fontSize: 14,
    textAlign: 'left',
  },
  searchSubmitBtn: {
    backgroundColor: '#1DB954',
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#09090b',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  trackCover: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  trackTitle: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  trackArtist: {
    color: '#a1a1aa',
    fontSize: 12,
    marginTop: 2,
  },
  sourceTag: {
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  sourceTagText: {
    color: '#1DB954',
    fontSize: 10,
    fontWeight: '700',
  },
  addTrackBtn: {
    backgroundColor: '#1DB954',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addedTrackBtn: {
    backgroundColor: '#3f3f46',
  },
  emptyText: {
    color: '#71717a',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 30,
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  form: {
    marginBottom: 10,
  },
  inputContainer: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#a1a1aa',
    marginBottom: 6,
    textAlign: 'left',
  },
  input: {
    backgroundColor: '#09090b',
    borderRadius: 12,
    padding: 10,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: '#27272a',
    fontSize: 14,
    textAlign: 'left',
  },
  saveBtn: {
    backgroundColor: '#1DB954',
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
  },
  saveBtnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 15,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginBottom: 10,
    textAlign: 'left',
  },
});
