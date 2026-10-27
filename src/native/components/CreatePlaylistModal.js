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
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';
import { getDownloadedTracks, deduplicateTrackList } from '../services/downloadManager';
import { normalizeCoverUri } from '../utils/coverUtils';

export default function CreatePlaylistModal({ visible, onClose, onSuccess, allTracks = [] }) {
  const { token, syncUserData, setPlaylists } = useUser();
  const { showToast } = useToast();

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

  const formatDuration = (secs) => {
    if (!secs || isNaN(secs)) return '3:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
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
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                {step === 'form' && (
                  <TouchableOpacity
                    onPress={() => setStep('select_type')}
                    style={styles.backBtn}
                    activeOpacity={0.7}
                  >
                    <ArrowLeft size={18} color={colors.ink} />
                  </TouchableOpacity>
                )}
                <View style={styles.iconBox}>
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
                  <Text style={styles.title} numberOfLines={1}>
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
                    bg={colors.ink}
                    textColor={playlistType === 'mix' ? '#f59e0b' : colors.tealLight}
                  />
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={colors.ink} />
              </TouchableOpacity>
            </View>

            {/* ── STEP 1: CHOOSE PLAYLIST TYPE ───────────────────────────────── */}
            {step === 'select_type' ? (
              <View style={{ flex: 1, paddingTop: 12 }}>
                <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                  <Text style={styles.sectionSubtitle}>
                    Select what type of playlist you want to create:
                  </Text>

                  {/* Standard Playlist Option */}
                  <TouchableOpacity
                    style={styles.typeCard}
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
                        <Text style={styles.typeTitle}>Standard Playlist</Text>
                        <View style={styles.typeTag}>
                          <Text style={styles.typeTagText}>STREAMING</Text>
                        </View>
                      </View>
                      <Text style={styles.typeDesc}>
                        Classic playlist for streaming and organizing your favorite songs and albums in custom order.
                      </Text>
                      <View style={styles.selectTypeActionRow}>
                        <Text style={styles.selectTypeActionText}>SELECT STANDARD →</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {/* DJ Mix Playlist Option */}
                  <TouchableOpacity
                    style={[styles.typeCard, styles.typeCardMix]}
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
                        <Text style={styles.typeTitle}>🎛️ DJ Mix Playlist</Text>
                        <View style={[styles.typeTag, styles.typeTagMix]}>
                          <Text style={styles.typeTagTextMix}>OFFLINE ENGINE</Text>
                        </View>
                      </View>
                      <Text style={styles.typeDesc}>
                        Continuous seamless mix with sample-accurate crossfades using local songs stored on your device.
                      </Text>
                      <View style={styles.selectTypeActionRow}>
                        <Text style={[styles.selectTypeActionText, { color: '#082621' }]}>
                          CREATE DJ MIX →
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </ScrollView>

                <TouchableOpacity style={styles.cancelBtnFull} onPress={onClose}>
                  <Text style={styles.cancelText}>CANCEL</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ── STEP 2: CREATION FORM ──────────────────────────────────────── */
              <View style={{ flex: 1, paddingTop: 6 }}>
                {playlistType === 'standard' ? (
                  <View style={{ flex: 1 }}>
                    {/* Tab Switcher for Standard */}
                    <View style={styles.tabBar}>
                      <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'create' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('create')}
                      >
                        <Text
                          style={[styles.tabBtnText, activeTab === 'create' && styles.tabBtnTextActive]}
                        >
                          CREATE NEW
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.tabBtn, activeTab === 'import' && styles.tabBtnActive]}
                        onPress={() => setActiveTab('import')}
                      >
                        <Text
                          style={[styles.tabBtnText, activeTab === 'import' && styles.tabBtnTextActive]}
                        >
                          IMPORT LINK
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                      {activeTab === 'create' ? (
                        <View style={styles.formContent}>
                          <Text style={styles.label}>PLAYLIST NAME *</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="e.g. Midnight Waves, Arabic Hip-Hop..."
                            placeholderTextColor="#9ca3af"
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                          />

                          <Text style={styles.label}>DESCRIPTION (OPTIONAL)</Text>
                          <TextInput
                            style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                            placeholder="Short description or mood for this playlist..."
                            placeholderTextColor="#9ca3af"
                            value={desc}
                            onChangeText={setDesc}
                            multiline
                          />

                          <View style={styles.switchRow}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <Text style={styles.switchTitle}>Make Playlist Public</Text>
                              <Text style={styles.switchDesc}>
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
                          <Text style={styles.desc}>
                            Paste a Spotify or YouTube playlist URL to convert and import it directly into your Rivo library:
                          </Text>

                          <Text style={styles.label}>PLAYLIST URL *</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="https://open.spotify.com/playlist/... or youtube.com/playlist?list=..."
                            placeholderTextColor="#9ca3af"
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
                      <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                        <Text style={styles.cancelText}>CANCEL</Text>
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
                        <Text style={styles.label}>DJ MIX NAME *</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="e.g. Weekend Club Mix, High-Energy Mix..."
                          placeholderTextColor="#9ca3af"
                          value={name}
                          onChangeText={setName}
                          autoCapitalize="words"
                        />

                        <Text style={styles.label}>DESCRIPTION (OPTIONAL)</Text>
                        <TextInput
                          style={[styles.input, { height: 46, textAlignVertical: 'top' }]}
                          placeholder="Continuous seamless crossfades with zero buffer latency..."
                          placeholderTextColor="#9ca3af"
                          value={desc}
                          onChangeText={setDesc}
                          multiline
                        />

                        <View style={styles.switchRow}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.switchTitle}>Make DJ Mix Public</Text>
                            <Text style={styles.switchDesc}>
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
                        <View style={styles.deviceTracksSection}>
                          <View style={styles.deviceTracksHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <HardDrive size={15} color={colors.teal} />
                              <Text style={styles.deviceTracksTitle}>
                                DEVICE TRACKS ({filteredDeviceTracks.length})
                              </Text>
                            </View>
                            <View style={styles.deviceTrackCountBadge}>
                              <Text style={styles.deviceTrackCountText}>
                                {selectedTrackIds.length} SELECTED
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.deviceTracksDesc}>
                            Select songs saved on this device to include in your DJ mix. Local files enable zero-latency sample crossfades.
                          </Text>

                          {/* Search Bar & Action Buttons */}
                          <View style={styles.searchRow}>
                            <View style={styles.searchBox}>
                              <Search size={14} color="#9ca3af" style={{ marginRight: 6 }} />
                              <TextInput
                                style={styles.searchInput}
                                placeholder="Search device tracks..."
                                placeholderTextColor="#9ca3af"
                                value={trackSearch}
                                onChangeText={setTrackSearch}
                              />
                            </View>
                            <TouchableOpacity style={styles.miniBtn} onPress={selectAllFiltered}>
                              <Text style={styles.miniBtnText}>ALL</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.miniBtn} onPress={deselectAllFiltered}>
                              <Text style={styles.miniBtnText}>CLEAR</Text>
                            </TouchableOpacity>
                          </View>

                          {/* Scrollable Track List */}
                          <View style={styles.deviceTracksList}>
                            {loadingDeviceTracks ? (
                              <View style={styles.emptyDeviceBox}>
                                <ActivityIndicator size="small" color={colors.teal} />
                                <Text style={styles.emptyDeviceText}>Scanning device Vault...</Text>
                              </View>
                            ) : filteredDeviceTracks.length === 0 ? (
                              <View style={styles.emptyDeviceBox}>
                                <Disc size={24} color="#9ca3af" />
                                <Text style={styles.emptyDeviceTitle}>
                                  {deviceTracks.length === 0
                                    ? 'No downloaded tracks on this device'
                                    : 'No matching tracks found'}
                                </Text>
                                <Text style={styles.emptyDeviceText}>
                                  {deviceTracks.length === 0
                                    ? 'Download tracks to your Vault first so the DJ engine can mix them.'
                                    : 'Try another search keyword.'}
                                </Text>
                              </View>
                            ) : (
                              <ScrollView
                                nestedScrollEnabled={true}
                                style={{ maxHeight: 200 }}
                                showsVerticalScrollIndicator={true}
                              >
                                {filteredDeviceTracks.map((t) => {
                                  const id = String(t._id || t.id);
                                  const isChecked = selectedTrackIds.includes(id);
                                  return (
                                    <TouchableOpacity
                                      key={id}
                                      style={[
                                        styles.deviceTrackItem,
                                        isChecked && styles.deviceTrackItemChecked,
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

                                      <View style={styles.trackThumbBox}>
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
                                        <Text style={styles.trackTitle} numberOfLines={1}>
                                          {t.title}
                                        </Text>
                                        <Text style={styles.trackArtist} numberOfLines={1}>
                                          {t.artist || 'Unknown Artist'}
                                        </Text>
                                      </View>

                                      <View style={{ alignItems: 'flex-end', gap: 2 }}>
                                        <Text style={styles.trackDuration}>
                                          {formatDuration(t.duration)}
                                        </Text>
                                        <View style={styles.vaultTag}>
                                          <Text style={styles.vaultTagText}>VAULT</Text>
                                        </View>
                                      </View>
                                    </TouchableOpacity>
                                  );
                                })}
                              </ScrollView>
                            )}
                          </View>
                        </View>
                      </View>
                    </ScrollView>

                    {/* Fixed Bottom Action Bar */}
                    <View style={styles.btnRow}>
                      <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                        <Text style={styles.cancelText}>CANCEL</Text>
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  sheetOuter: {
    position: 'relative',
    height: '86%',
    maxHeight: '92%',
    width: '100%',
  },
  hardShadow: {
    position: 'absolute',
    top: -4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.ink,
    borderRadius: 16,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.paper,
    borderRadius: 16,
    borderWidth: 2.5,
    borderColor: colors.ink,
    padding: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
  },
  backBtn: {
    padding: 6,
    backgroundColor: '#ede5d3',
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
  },
  iconBox: {
    width: 32,
    height: 32,
    backgroundColor: colors.mint,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 13,
    color: colors.ink,
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#ede5d3',
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
  },
  sectionSubtitle: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.ink,
    opacity: 0.75,
    marginBottom: 10,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ede5d3',
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  typeCardMix: {
    backgroundColor: '#e6f7f5',
    borderColor: colors.teal,
  },
  typeIconBox: {
    width: 44,
    height: 44,
    backgroundColor: colors.ink,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeIconBoxMix: {
    backgroundColor: colors.mint,
  },
  typeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  typeTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 13,
    color: colors.ink,
  },
  typeTag: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeTagMix: {
    backgroundColor: colors.teal,
  },
  typeTagText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 9,
    color: colors.ink,
  },
  typeTagTextMix: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 9,
    color: '#ffffff',
  },
  typeDesc: {
    fontSize: 11,
    color: colors.ink,
    opacity: 0.8,
    lineHeight: 16,
  },
  selectTypeActionRow: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  selectTypeActionText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.teal,
    textDecorationLine: 'underline',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#ede5d3',
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 8,
    padding: 3,
    marginBottom: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: colors.ink,
  },
  tabBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.ink,
  },
  tabBtnTextActive: {
    color: colors.mint,
  },
  formContent: {
    paddingVertical: 6,
    gap: 8,
  },
  label: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.ink,
  },
  desc: {
    fontSize: 12,
    color: colors.ink,
    opacity: 0.85,
    lineHeight: 18,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    color: colors.ink,
    fontWeight: 'bold',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ede5d3',
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 8,
    padding: 8,
  },
  switchTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.ink,
  },
  switchDesc: {
    fontSize: 9,
    color: colors.ink,
    opacity: 0.75,
    marginTop: 2,
  },
  deviceTracksSection: {
    backgroundColor: '#ede5d3',
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 8,
    padding: 8,
    gap: 6,
  },
  deviceTracksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceTracksTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.ink,
  },
  deviceTrackCountBadge: {
    backgroundColor: colors.teal,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.ink,
  },
  deviceTrackCountText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 9,
    color: '#ffffff',
  },
  deviceTracksDesc: {
    fontSize: 10,
    color: colors.ink,
    opacity: 0.8,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 32,
  },
  searchInput: {
    flex: 1,
    fontSize: 11,
    color: colors.ink,
    paddingVertical: 0,
    fontFamily: 'monospace',
  },
  miniBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 8,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 9,
    color: colors.ink,
  },
  deviceTracksList: {
    maxHeight: 200,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 6,
    overflow: 'hidden',
  },
  deviceTrackItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ede5d3',
  },
  deviceTrackItemChecked: {
    backgroundColor: '#e6f7f5',
  },
  trackThumbBox: {
    width: 32,
    height: 32,
    backgroundColor: '#ede5d3',
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 8,
  },
  trackThumb: {
    width: '100%',
    height: '100%',
  },
  trackTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: colors.ink,
  },
  trackArtist: {
    fontSize: 9,
    color: colors.ink,
    opacity: 0.7,
  },
  trackDuration: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: colors.ink,
    opacity: 0.7,
  },
  vaultTag: {
    backgroundColor: '#ede5d3',
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  vaultTagText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 7,
    color: colors.ink,
  },
  emptyDeviceBox: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  emptyDeviceTitle: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: 11,
    color: colors.ink,
  },
  emptyDeviceText: {
    fontSize: 9,
    color: colors.ink,
    opacity: 0.7,
    textAlign: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#ede5d3',
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnFull: {
    backgroundColor: '#ede5d3',
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.ink,
  },
  submitBtn: {
    flex: 2,
    backgroundColor: colors.mint,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  submitBtnMix: {
    backgroundColor: colors.mint,
  },
  submitText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.ink,
  },
});
