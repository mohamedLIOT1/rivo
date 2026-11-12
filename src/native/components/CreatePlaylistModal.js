import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Switch,
  ScrollView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import {
  X,
  Plus,
  DownloadCloud,
  Disc,
  ArrowLeft,
  Sliders,
  CheckSquare,
  Square,
  Search,
  HardDrive,
} from 'lucide-react-native';
import { API_BASE_URL } from '../config';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';
import { getDownloadedTracks, deduplicateTrackList } from '../services/downloadManager';
import { normalizeCoverUri } from '../utils/coverUtils';
import { formatDuration } from '../utils/timeUtils';
import { styles } from './createPlaylistStyles';

export default function CreatePlaylistModal({ visible, onClose, onSuccess, allTracks = [] }) {
  const { token, syncUserData, setPlaylists } = useUser();
  const { showToast } = useToast();
  const { isDark } = useTheme();

  // 'select_type' | 'form'
  const [step, setStep] = useState('select_type');
  const [playlistType, setPlaylistType] = useState('standard'); // 'standard' | 'mix'
  const [activeTab, setActiveTab] = useState('create'); // 'create' | 'import' (for standard)

  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [importUrl, setImportUrl] = useState('');
  const [loading, setLoading] = useState(false);

  // Device tracks for DJ Mix
  const [deviceTracks, setDeviceTracks] = useState([]);
  const [loadingDeviceTracks, setLoadingDeviceTracks] = useState(false);
  const [trackSearch, setTrackSearch] = useState('');
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);

  useEffect(() => {
    if (visible) {
      setStep('select_type');
      setPlaylistType('standard');
      setActiveTab('create');
      setName('');
      setDesc('');
      setImportUrl('');
      setTrackSearch('');
      setSelectedTrackIds([]);
      loadDeviceTracks();
    }
  }, [visible]);

  const loadDeviceTracks = async () => {
    setLoadingDeviceTracks(true);
    try {
      const offlineList = await getDownloadedTracks().catch(() => []);
      const pool = [...(offlineList || [])];

      // Add any allTracks marked as downloaded or offline
      if (Array.isArray(allTracks)) {
        allTracks.forEach((t) => {
          if (t && (t.downloaded || t.isOffline)) {
            pool.push(t);
          }
        });
      }

      const deduplicated = deduplicateTrackList(pool);
      setDeviceTracks(deduplicated);

      // Auto-select all device tracks by default
      const ids = deduplicated.map((t) => String(t._id || t.id));
      setSelectedTrackIds(ids);
    } catch {
      setDeviceTracks([]);
    } finally {
      setLoadingDeviceTracks(false);
    }
  };

  const filteredDeviceTracks = useMemo(() => {
    if (!trackSearch.trim()) return deviceTracks;
    const q = trackSearch.toLowerCase().trim();
    return (deviceTracks || []).filter((t) => {
      const title = (t.title || '').toLowerCase();
      const artist = (t.artist || '').toLowerCase();
      return title.includes(q) || artist.includes(q);
    });
  }, [deviceTracks, trackSearch]);

  const toggleTrack = (id) => {
    setSelectedTrackIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const selectAllFiltered = () => {
    const idsToAdd = filteredDeviceTracks.map((t) => String(t._id || t.id));
    setSelectedTrackIds((prev) => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const deselectAllFiltered = () => {
    const idsToRemove = new Set(filteredDeviceTracks.map((t) => String(t._id || t.id)));
    setSelectedTrackIds((prev) => prev.filter((id) => !idsToRemove.has(id)));
  };

  const handleCreateStandard = async () => {
    if (!name.trim()) {
      showToast('Please enter a playlist name', 'error');
      return;
    }
    setLoading(true);
    try {
      if (!token) {
        const localPl = {
          id: `pl-${Date.now()}`,
          name: name.trim(),
          description: desc.trim(),
          isPublic: Boolean(isPublic),
          isQuran: false,
          isMix: false,
          trackIds: [],
          tracks: [],
        };
        if (typeof setPlaylists === 'function') {
          setPlaylists((prev) => [localPl, ...(prev || [])]);
        }
        showToast(`Playlist "${name.trim()}" created!`, 'success');
        setName('');
        setDesc('');
        if (onSuccess) onSuccess(localPl);
        onClose();
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/playlists/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: desc.trim(),
          isPublic,
          isQuran: false,
          isMix: false,
          trackIds: [],
        }),
      });

      const data = await res.json();
      if (res.ok && (data.success || data.playlist)) {
        showToast(`Playlist "${name.trim()}" created!`, 'success');
        setName('');
        setDesc('');
        await syncUserData();
        if (onSuccess) onSuccess(data.playlist);
        onClose();
      } else {
        showToast(data.error || data.message || 'Failed to create playlist', 'error');
      }
    } catch {
      showToast('Network error creating playlist', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMix = async () => {
    if (!name.trim()) {
      showToast('Please enter a DJ Mix name', 'error');
      return;
    }
    setLoading(true);
    try {
      if (!token) {
        const localPl = {
          id: `pl-${Date.now()}`,
          name: name.trim(),
          description: desc.trim(),
          isPublic: Boolean(isPublic),
          isQuran: false,
          isMix: true,
          trackIds: selectedTrackIds,
          tracks: selectedTrackIds,
        };
        if (typeof setPlaylists === 'function') {
          setPlaylists((prev) => [localPl, ...(prev || [])]);
        }
        showToast(`DJ Mix "${name.trim()}" created!`, 'success');
        setName('');
        setDesc('');
        setSelectedTrackIds([]);
        if (onSuccess) onSuccess(localPl);
        onClose();
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/playlists/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: desc.trim(),
          isPublic,
          isQuran: false,
          isMix: true,
          trackIds: selectedTrackIds,
        }),
      });

      const data = await res.json();
      if (res.ok && (data.success || data.playlist)) {
        showToast(`DJ Mix "${name.trim()}" created with ${selectedTrackIds.length} tracks!`, 'success');
        setName('');
        setDesc('');
        setSelectedTrackIds([]);
        await syncUserData();
        if (onSuccess) onSuccess(data.playlist);
        onClose();
      } else {
        showToast(data.error || data.message || 'Failed to create DJ Mix', 'error');
      }
    } catch {
      showToast('Network error creating DJ Mix', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!importUrl.trim()) {
      showToast('Please paste a Spotify or YouTube playlist URL', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/playlists/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          url: importUrl.trim(),
          isQuran: false,
        }),
      });

      const data = await res.json();
      if (res.ok && (data.success || data.playlist)) {
        showToast(`Imported playlist "${data.playlist?.name || 'New Tape'}"!`, 'success');
        setImportUrl('');
        await syncUserData();
        if (onSuccess) onSuccess(data.playlist);
        onClose();
      } else {
        showToast(data.error || data.message || 'Failed to import playlist', 'error');
      }
    } catch {
      showToast('Network error importing playlist', 'error');
    } finally {
      setLoading(false);
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
              backgroundColor: isDark ? '#111a18' : '#fdfbf7',
              borderColor: isDark ? '#27272a' : colors.ink,
            }
          ]}>
            {/* Header */}
            <View style={[
              styles.header,
              { borderBottomColor: isDark ? '#27272a' : colors.ink }
            ]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                {step === 'form' && (
                  <TouchableOpacity
                    onPress={() => setStep('select_type')}
                    style={[
                      styles.backBtn,
                      isDark && { backgroundColor: '#141d1b', borderColor: '#27272a' }
                    ]}
                    activeOpacity={0.7}
                  >
                    <ArrowLeft size={18} color={isDark ? '#e4e4e7' : colors.ink} />
                  </TouchableOpacity>
                )}
                <View style={[styles.iconBox, isDark && { borderColor: '#27272a' }]}>
                  {step === 'select_type' ? (
                    <Plus size={18} color={colors.ink} />
                  ) : playlistType === 'mix' ? (
                    <Sliders size={18} color={colors.ink} />
                  ) : activeTab === 'create' ? (
                    <Plus size={18} color={colors.ink} />
                  ) : (
                    <DownloadCloud size={18} color={colors.ink} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: isDark ? '#ffffff' : colors.ink }]} numberOfLines={1}>
                    {step === 'select_type'
                      ? 'CHOOSE PLAYLIST TYPE'
                      : playlistType === 'mix'
                      ? 'NEW DJ MIX'
                      : activeTab === 'create'
                      ? 'NEW PLAYLIST'
                      : 'IMPORT TAPE'}
                  </Text>
                  <CassetteTag
                    label={playlistType === 'mix' ? 'PRO DJ MIX' : 'LIBRARY ARCHIVE'}
                    bg={isDark ? '#141d1b' : colors.ink}
                    textColor={playlistType === 'mix' ? '#f59e0b' : (isDark ? '#26c4b7' : colors.tealLight)}
                  />
                </View>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={[
                  styles.closeBtn,
                  isDark && { backgroundColor: '#141d1b', borderColor: '#27272a' }
                ]}
              >
                <X size={20} color={isDark ? '#e4e4e7' : colors.ink} />
              </TouchableOpacity>
            </View>

            {/* ── STEP 1: CHOOSE PLAYLIST TYPE ───────────────────────────────── */}
            {step === 'select_type' ? (
              <View style={{ flex: 1, paddingTop: 12 }}>
                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                  <Text style={[styles.sectionSubtitle, { color: isDark ? '#9ca3af' : colors.ink }]}>
                    Select what type of playlist you want to create:
                  </Text>

                  {/* Standard Playlist Option */}
                  <TouchableOpacity
                    style={[
                      styles.typeCard,
                      {
                        backgroundColor: isDark ? '#141d1b' : '#ede5d3',
                        borderColor: isDark ? '#27272a' : colors.ink,
                      }
                    ]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setPlaylistType('standard');
                      setName('');
                      setStep('form');
                    }}
                  >
                    <View style={styles.typeIconBox}>
                      <Disc size={26} color={colors.mint} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.typeHeaderRow}>
                        <Text style={[styles.typeTitle, { color: isDark ? '#ffffff' : colors.ink }]}>
                          Standard Playlist
                        </Text>
                        <View style={[styles.typeTag, isDark && { backgroundColor: '#1f2e2a', borderColor: '#27272a' }]}>
                          <Text style={[styles.typeTagText, isDark && { color: '#26c4b7' }]}>STREAMING</Text>
                        </View>
                      </View>
                      <Text style={[styles.typeDesc, { color: isDark ? '#9ca3af' : '#4b5563' }]}>
                        Classic playlist for streaming and organizing your favorite songs and albums in custom order.
                      </Text>
                      <View style={styles.selectTypeActionRow}>
                        <Text style={[styles.selectTypeActionText, isDark && { color: '#26c4b7' }]}>
                          SELECT STANDARD →
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* DJ Mix Playlist Option */}
                  <TouchableOpacity
                    style={[
                      styles.typeCard,
                      styles.typeCardMix,
                      {
                        backgroundColor: isDark ? '#0f2420' : '#e6f7f5',
                        borderColor: isDark ? '#10b981' : colors.teal,
                      }
                    ]}
                    activeOpacity={0.8}
                    onPress={() => {
                      setPlaylistType('mix');
                      setName('My DJ Mix');
                      setStep('form');
                    }}
                  >
                    <View style={[styles.typeIconBox, styles.typeIconBoxMix]}>
                      <Sliders size={26} color={colors.ink} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.typeHeaderRow}>
                        <Text style={[styles.typeTitle, { color: isDark ? '#ffffff' : colors.ink }]}>
                          🎛️ DJ Mix Playlist
                        </Text>
                        <View style={[styles.typeTag, styles.typeTagMix]}>
                          <Text style={styles.typeTagTextMix}>OFFLINE ENGINE</Text>
                        </View>
                      </View>
                      <Text style={[styles.typeDesc, { color: isDark ? '#9ca3af' : '#4b5563' }]}>
                        Continuous seamless mix with sample-accurate crossfades using local songs stored on your device.
                      </Text>
                      <View style={styles.selectTypeActionRow}>
                        <Text style={[styles.selectTypeActionText, { color: isDark ? '#10b981' : '#082621' }]}>
                          CREATE DJ MIX →
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </ScrollView>

                <TouchableOpacity
                  style={[
                    styles.cancelBtnFull,
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
              </View>
            ) : (
              /* ── STEP 2: CREATION FORM ──────────────────────────────────────── */
              <View style={{ flex: 1, paddingTop: 6 }}>
                {playlistType === 'standard' ? (
                  <View style={{ flex: 1 }}>
                    {/* Tab Switcher for Standard */}
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
                          activeTab === 'create' && (isDark ? { backgroundColor: '#26c4b7' } : styles.tabBtnActive)
                        ]}
                        onPress={() => setActiveTab('create')}
                      >
                        <Text
                          style={[
                            styles.tabBtnText,
                            { color: isDark ? '#9ca3af' : colors.ink },
                            activeTab === 'create' && (isDark ? { color: '#08110f' } : styles.tabBtnTextActive),
                          ]}
                        >
                          CREATE NEW
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.tabBtn,
                          activeTab === 'import' && (isDark ? { backgroundColor: '#26c4b7' } : styles.tabBtnActive)
                        ]}
                        onPress={() => setActiveTab('import')}
                      >
                        <Text
                          style={[
                            styles.tabBtnText,
                            { color: isDark ? '#9ca3af' : colors.ink },
                            activeTab === 'import' && (isDark ? { color: '#08110f' } : styles.tabBtnTextActive),
                          ]}
                        >
                          IMPORT LINK
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                      {activeTab === 'create' ? (
                        <View style={styles.formContent}>
                          <Text style={[styles.label, { color: isDark ? '#e4e4e7' : colors.ink }]}>
                            PLAYLIST NAME *
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
                            placeholder="e.g. Midnight Waves, Arabic Hip-Hop..."
                            placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                          />

                          <Text style={[styles.label, { color: isDark ? '#e4e4e7' : colors.ink }]}>
                            DESCRIPTION (OPTIONAL)
                          </Text>
                          <TextInput
                            style={[
                              styles.input,
                              {
                                height: 60,
                                textAlignVertical: 'top',
                                backgroundColor: isDark ? '#08110f' : '#ffffff',
                                borderColor: isDark ? '#27272a' : colors.ink,
                                color: isDark ? '#ffffff' : colors.ink,
                              }
                            ]}
                            placeholder="Short description or mood for this playlist..."
                            placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
                            value={desc}
                            onChangeText={setDesc}
                            multiline
                          />

                          <View style={[
                            styles.switchRow,
                            isDark && { backgroundColor: '#141d1b', borderColor: '#27272a' }
                          ]}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <Text style={[styles.switchTitle, { color: isDark ? '#ffffff' : colors.ink }]}>
                                Make Playlist Public
                              </Text>
                              <Text style={[styles.switchDesc, { color: isDark ? '#9ca3af' : colors.ink }]}>
                                Visible to others on your profile and search.
                              </Text>
                            </View>
                            <Switch
                              value={isPublic}
                              onValueChange={setIsPublic}
                              trackColor={{ false: '#27272a', true: colors.mint }}
                              thumbColor="#ffffff"
                            />
                          </View>
                        </View>
                      ) : (
                        <View style={styles.formContent}>
                          <Text style={[styles.desc, { color: isDark ? '#9ca3af' : colors.ink }]}>
                            Paste a Spotify or YouTube playlist URL to convert and import it directly into your Rivo library:
                          </Text>

                          <Text style={[styles.label, { color: isDark ? '#e4e4e7' : colors.ink }]}>
                            PLAYLIST URL *
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
                            placeholder="https://open.spotify.com/playlist/... or youtube.com/playlist?list=..."
                            placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
                            value={importUrl}
                            onChangeText={setImportUrl}
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                        </View>
                      )}
                    </ScrollView>

                    {/* Bottom Action Bar */}
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
                        style={[
                          styles.submitBtn,
                          ((activeTab === 'create' ? !name.trim() : !importUrl.trim()) || loading) && { opacity: 0.6 },
                        ]}
                        onPress={activeTab === 'create' ? handleCreateStandard : handleImport}
                        disabled={(activeTab === 'create' ? !name.trim() : !importUrl.trim()) || loading}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color={colors.ink} />
                        ) : (
                          <Text style={styles.submitText}>
                            {activeTab === 'create' ? 'CREATE PLAYLIST' : 'IMPORT PLAYLIST'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  /* ── DJ MIX FORM WITH DEVICE TRACK PICKER ────────────────── */
                  <View style={{ flex: 1 }}>
                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      style={{ flex: 1 }}
                      contentContainerStyle={{ paddingBottom: 10 }}
                    >
                      <View style={styles.formContent}>
                        <Text style={[styles.label, { color: isDark ? '#e4e4e7' : colors.ink }]}>
                          DJ MIX NAME *
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
                          placeholder="e.g. Weekend Club Mix, High-Energy Mix..."
                          placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
                          value={name}
                          onChangeText={setName}
                          autoCapitalize="words"
                        />

                        <Text style={[styles.label, { color: isDark ? '#e4e4e7' : colors.ink }]}>
                          DESCRIPTION (OPTIONAL)
                        </Text>
                        <TextInput
                          style={[
                            styles.input,
                            {
                              height: 46,
                              textAlignVertical: 'top',
                              backgroundColor: isDark ? '#08110f' : '#ffffff',
                              borderColor: isDark ? '#27272a' : colors.ink,
                              color: isDark ? '#ffffff' : colors.ink,
                            }
                          ]}
                          placeholder="Continuous seamless crossfades with zero buffer latency..."
                          placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
                          value={desc}
                          onChangeText={setDesc}
                          multiline
                        />

                        <View style={[
                          styles.switchRow,
                          isDark && { backgroundColor: '#141d1b', borderColor: '#27272a' }
                        ]}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={[styles.switchTitle, { color: isDark ? '#ffffff' : colors.ink }]}>
                              Make DJ Mix Public
                            </Text>
                            <Text style={[styles.switchDesc, { color: isDark ? '#9ca3af' : colors.ink }]}>
                              Visible on your profile and accessible to other listeners.
                            </Text>
                          </View>
                          <Switch
                            value={isPublic}
                            onValueChange={setIsPublic}
                            trackColor={{ false: '#27272a', true: colors.mint }}
                            thumbColor="#ffffff"
                          />
                        </View>

                        {/* Device Tracks Recommendation Section */}
                        <View style={[
                          styles.deviceTracksSection,
                          isDark && { backgroundColor: '#141d1b', borderColor: '#27272a' }
                        ]}>
                          <View style={styles.deviceTracksHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <HardDrive size={15} color={colors.teal} />
                              <Text style={[styles.deviceTracksTitle, { color: isDark ? '#ffffff' : colors.ink }]}>
                                DEVICE TRACKS ({filteredDeviceTracks.length})
                              </Text>
                            </View>
                            <View style={styles.deviceTrackCountBadge}>
                              <Text style={styles.deviceTrackCountText}>
                                {selectedTrackIds.length} SELECTED
                              </Text>
                            </View>
                          </View>

                          <Text style={[styles.deviceTracksDesc, { color: isDark ? '#9ca3af' : colors.ink }]}>
                            Select songs saved on this device to include in your DJ mix. Local files enable zero-latency sample crossfades.
                          </Text>

                          {/* Search Bar & Action Buttons */}
                          <View style={styles.searchRow}>
                            <View style={[
                              styles.searchBox,
                              isDark && { backgroundColor: '#08110f', borderColor: '#27272a' }
                            ]}>
                              <Search size={14} color="#9ca3af" style={{ marginRight: 6 }} />
                              <TextInput
                                style={[styles.searchInput, isDark && { color: '#ffffff' }]}
                                placeholder="Search device tracks..."
                                placeholderTextColor="#9ca3af"
                                value={trackSearch}
                                onChangeText={setTrackSearch}
                              />
                            </View>
                            <TouchableOpacity
                              style={[
                                styles.miniBtn,
                                isDark && { backgroundColor: '#1f2e2a', borderColor: '#27272a' }
                              ]}
                              onPress={selectAllFiltered}
                            >
                              <Text style={[styles.miniBtnText, { color: isDark ? '#e4e4e7' : colors.ink }]}>
                                ALL
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.miniBtn,
                                isDark && { backgroundColor: '#1f2e2a', borderColor: '#27272a' }
                              ]}
                              onPress={deselectAllFiltered}
                            >
                              <Text style={[styles.miniBtnText, { color: isDark ? '#e4e4e7' : colors.ink }]}>
                                CLEAR
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {/* Scrollable Track List */}
                          <View style={[
                            styles.deviceTracksList,
                            isDark && { backgroundColor: '#08110f', borderColor: '#27272a' }
                          ]}>
                            {loadingDeviceTracks ? (
                              <View style={styles.emptyDeviceBox}>
                                <ActivityIndicator size="small" color={colors.teal} />
                                <Text style={[styles.emptyDeviceText, isDark && { color: '#9ca3af' }]}>
                                  Scanning device Vault...
                                </Text>
                              </View>
                            ) : filteredDeviceTracks.length === 0 ? (
                              <View style={styles.emptyDeviceBox}>
                                <Disc size={24} color="#9ca3af" />
                                <Text style={[styles.emptyDeviceTitle, { color: isDark ? '#ffffff' : colors.ink }]}>
                                  {deviceTracks.length === 0
                                    ? 'No downloaded tracks on this device'
                                    : 'No matching tracks found'}
                                </Text>
                                <Text style={[styles.emptyDeviceText, isDark && { color: '#9ca3af' }]}>
                                  {deviceTracks.length === 0
                                    ? 'Download tracks to your Vault first so the DJ engine can mix them.'
                                    : 'Try another search keyword.'}
                                </Text>
                              </View>
                            ) : (
                              <FlatList
                                nestedScrollEnabled={true}
                                style={{ maxHeight: 200 }}
                                showsVerticalScrollIndicator={true}
                                data={filteredDeviceTracks}
                                keyExtractor={(t) => String(t._id || t.id)}
                                windowSize={3}
                                maxToRenderPerBatch={8}
                                initialNumToRender={8}
                                removeClippedSubviews={true}
                                renderItem={({ item: t }) => {
                                  const id = String(t._id || t.id);
                                  const isChecked = selectedTrackIds.includes(id);
                                  return (
                                    <TouchableOpacity
                                      key={id}
                                      style={[
                                        styles.deviceTrackItem,
                                        {
                                          backgroundColor: isDark ? '#141d1b' : '#ffffff',
                                          borderColor: isDark ? '#27272a' : colors.ink,
                                          borderBottomColor: isDark ? '#27272a' : '#ede5d3',
                                        },
                                        isChecked && (isDark ? { backgroundColor: '#0f2e28' } : styles.deviceTrackItemChecked),
                                      ]}
                                      activeOpacity={0.7}
                                      onPress={() => toggleTrack(id)}
                                    >
                                      <View style={{ marginRight: 8 }}>
                                        {isChecked ? (
                                          <CheckSquare size={18} color={colors.teal} />
                                        ) : (
                                          <Square size={18} color="#9ca3af" />
                                        )}
                                      </View>

                                      <View style={[styles.trackThumbBox, isDark && { backgroundColor: '#08110f', borderColor: '#27272a' }]}>
                                        {t.cover || t.coverUrl ? (
                                          <Image
                                            source={{ uri: normalizeCoverUri(t.cover || t.coverUrl) }}
                                            style={styles.trackThumb}
                                            resizeMode="cover"
                                          />
                                        ) : (
                                          <Disc size={16} color={colors.mint} />
                                        )}
                                      </View>

                                      <View style={{ flex: 1, paddingRight: 6 }}>
                                        <Text style={[styles.trackTitle, { color: isDark ? '#ffffff' : colors.ink }]} numberOfLines={1}>
                                          {t.title}
                                        </Text>
                                        <Text style={[styles.trackArtist, { color: isDark ? '#9ca3af' : colors.ink }]} numberOfLines={1}>
                                          {t.artist || 'Unknown Artist'}
                                        </Text>
                                      </View>

                                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                                        <Text style={[styles.trackDuration, { color: isDark ? '#9ca3af' : colors.ink }]}>
                                          {formatDuration(t.duration, 180)}
                                        </Text>
                                        <View style={[styles.vaultTag, isDark && { backgroundColor: '#08110f', borderColor: '#27272a' }]}>
                                          <Text style={[styles.vaultTagText, { color: isDark ? '#26c4b7' : colors.ink }]}>
                                            VAULT
                                          </Text>
                                        </View>
                                      </View>
                                    </TouchableOpacity>
                                  );
                                }}
                              />
                            )}
                          </View>
                        </View>
                      </View>
                    </ScrollView>

                    {/* Fixed Bottom Action Bar */}
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
                        style={[
                          styles.submitBtn,
                          styles.submitBtnMix,
                          (!name.trim() || loading) && { opacity: 0.6 },
                        ]}
                        onPress={handleCreateMix}
                        disabled={!name.trim() || loading}
                      >
                        {loading ? (
                          <ActivityIndicator size="small" color={colors.ink} />
                        ) : (
                          <Text style={styles.submitText}>
                            CREATE DJ MIX ({selectedTrackIds.length})
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
