import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import {
  Heart,
  Plus,
  ArrowLeft,
  Music,
  FolderHeart,
  Download,
  Play,
  Shuffle,
  Disc,
  Edit3,
  Check,
  X,
  Image as ImageIcon,
  FolderPlus,
} from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { colors } from '../theme/colors';
import { API_BASE_URL } from '../config';
import { normalizeCoverUri } from '../utils/coverUtils';
import CassetteTag from '../ui/CassetteTag';
import SongItem from '../ui/SongItem';

const { width } = Dimensions.get('window');

export default function LibraryScreen({
  onOpenCreatePlaylist,
  onNavigateOffline,
  onTrackAction,
}) {
  const { playTrack, playPlaylist, tracks: audioTracks, downloadedTracks = [], handleDownloadTrack } = useAudioPlayer();
  const { currentUser, playlists, likedTrackIds, tracks: userTracks, updatePlaylist, uploadPlaylistCover } = useUser();
  const { showToast } = useToast();
  const { appMode } = useConnectivity();
  const { isDark } = useTheme();
  const isOffline = appMode === 'offline';
  const [selectedView, setSelectedView] = useState(null); // 'liked' | playlistObject
  const [fetchedTracks, setFetchedTracks] = useState([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ done: 0, total: 0 });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCover, setEditCover] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);

  useEffect(() => {
    setCoverFailed(false);
  }, [selectedView?.id, selectedView?._id]);

  const allTracks = isOffline
    ? (Array.isArray(downloadedTracks) ? downloadedTracks : [])
    : ((userTracks && userTracks.length > 0) ? userTracks : (audioTracks || []));
  const safeLikedIds = Array.isArray(likedTrackIds) ? likedTrackIds : [];

  // Unified track pool
  const trackPoolMap = useMemo(() => {
    const list = [...(allTracks || []), ...(fetchedTracks || [])];
    const map = new Map();
    for (const t of list) {
      if (t) {
        const id = String(t._id || t.id || '');
        if (id) map.set(id, t);
      }
    }
    return map;
  }, [allTracks, fetchedTracks]);

  // Liked tracks
  const likedTracks = useMemo(() => {
    return (allTracks || []).filter((t) =>
      safeLikedIds.includes(String(t?._id || t?.id))
    );
  }, [allTracks, safeLikedIds]);

  // Fetch tracks for currently selected playlist if they aren't in trackPoolMap
  useEffect(() => {
    if (!selectedView || typeof selectedView !== 'object' || selectedView === 'liked') return;
    const rawItems = selectedView.tracks || selectedView.trackIds || [];
    if (rawItems.length === 0) return;

    const missingIds = rawItems
      .map(item => typeof item === 'object' ? String(item._id || item.id) : String(item))
      .filter(id => id && !trackPoolMap.has(id));

    if (missingIds.length > 0) {
      setIsLoadingTracks(true);
      fetch(`${API_BASE_URL}/api/tracks/by-ids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: missingIds })
      })
        .then(r => r.json())
        .then(data => {
          if (data?.success && Array.isArray(data.tracks)) {
            setFetchedTracks(prev => {
              const merged = [...prev, ...data.tracks];
              const seen = new Set();
              return merged.filter(t => {
                const id = String(t._id || t.id);
                if (seen.has(id)) return false;
                seen.add(id);
                return true;
              });
            });
          }
        })
        .catch(() => {})
        .finally(() => setIsLoadingTracks(false));
    }
  }, [selectedView, trackPoolMap]);

  // Real tracks list for currently selected playlist
  const activePlaylistTracks = useMemo(() => {
    if (!selectedView || typeof selectedView !== 'object' || selectedView === 'liked') return [];
    const rawItems = selectedView.tracks || selectedView.trackIds || [];
    return rawItems.map(item => {
      const idStr = String(typeof item === 'object' ? (item._id || item.id) : item);
      const found = trackPoolMap.get(idStr);
      if (found) return found;
      if (typeof item === 'object' && item.title) return item;
      return null;
    }).filter(Boolean);
  }, [selectedView, trackPoolMap]);

  const handlePlayLiked = (shuffle = false) => {
    if (!likedTracks || likedTracks.length === 0) return;
    const list = [...likedTracks];
    if (shuffle) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
    if (typeof playPlaylist === 'function') {
      playPlaylist(list, 0);
    } else if (typeof playTrack === 'function' && list.length > 0) {
      playTrack(list[0], list);
    }
  };

  const handlePlayPlaylist = (playlist, shuffle = false) => {
    if (!playlist) return;
    const list = [...activePlaylistTracks];
    if (list.length === 0) return;
    if (shuffle) {
      for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
      }
    }
    if (typeof playPlaylist === 'function') {
      playPlaylist(list, 0);
    } else if (typeof playTrack === 'function' && list.length > 0) {
      playTrack(list[0], list);
    }
  };

  const handleDownloadAllPlaylist = async () => {
    if (!activePlaylistTracks || activePlaylistTracks.length === 0) {
      showToast('No tracks in crate to download', 'warning');
      return;
    }
    const downloadedSet = new Set((downloadedTracks || []).map(t => String(t._id || t.id)));
    const toDownload = activePlaylistTracks.filter(t => !downloadedSet.has(String(t._id || t.id)));

    if (toDownload.length === 0) {
      showToast('All tracks are already saved in Offline Vault!', 'info');
      return;
    }

    setIsDownloadingAll(true);
    setDownloadProgress({ done: 0, total: toDownload.length });
    showToast(`Downloading ${toDownload.length} track(s)...`, 'info');

    let count = 0;
    for (const t of toDownload) {
      try {
        await handleDownloadTrack(t);
        count++;
        setDownloadProgress({ done: count, total: toDownload.length });
      } catch (err) {
        console.warn('Playlist track dl error:', err.message);
      }
    }

    setIsDownloadingAll(false);
    showToast(`Saved all ${count} track(s) to Offline Vault!`, 'success');
  };

  const openEditPlaylist = (pl) => {
    setEditName(pl.name || '');
    setEditDesc(pl.description || '');
    setEditCover(pl.cover || '');
    setIsEditModalOpen(true);
  };

  const handlePickCoverFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: 'image/*',
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      const asset = res.assets ? res.assets[0] : res;
      if (asset?.uri) {
        setEditCover(asset.uri);
      }
    } catch {
      showToast('Failed to pick image file', 'error');
    }
  };

  const handleSavePlaylistEdit = async () => {
    if (!editName.trim()) {
      showToast('Please enter a playlist name', 'warning');
      return;
    }
    setIsSavingEdit(true);
    try {
      const plId = String(selectedView.id || selectedView._id);
      let finalCover = editCover;

      if (editCover && editCover.startsWith('file://')) {
        const upRes = await uploadPlaylistCover(plId, editCover);
        if (upRes?.cover) {
          finalCover = upRes.cover;
        }
      }

      const updateRes = await updatePlaylist(plId, {
        name: editName.trim(),
        description: editDesc.trim(),
        cover: finalCover,
      });

      if (updateRes && updateRes.success) {
        setSelectedView(prev => ({
          ...prev,
          name: editName.trim(),
          description: editDesc.trim(),
          cover: finalCover,
        }));
        setCoverFailed(false);
        showToast('Playlist updated successfully!', 'success');
        setIsEditModalOpen(false);
      } else {
        showToast(updateRes?.error || 'Failed to update playlist', 'error');
      }
    } catch (err) {
      showToast('Failed to update playlist: ' + err.message, 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <View style={[styles.container, !isDark && { backgroundColor: '#fdfbf7' }]}>
      {/* Header */}
      <View style={styles.header}>
        {selectedView ? (
          <View style={styles.detailHeaderRow}>
            <TouchableOpacity onPress={() => setSelectedView(null)} style={styles.backBtn}>
              <ArrowLeft size={18} color={colors.ink} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {selectedView === 'liked' ? 'LIKED RECORDINGS' : selectedView.name}
              </Text>
              <Text style={styles.headerSub}>
                PLAYLIST •{' '}
                {selectedView === 'liked'
                  ? `${likedTracks.length} SONGS`
                  : `${(selectedView.tracks || selectedView.trackIds || []).length} SONGS`}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.headerMainRow}>
            <View>
              <Text style={styles.headerTitle}>YOUR LIBRARY</Text>
              <Text style={styles.headerSub}>PLAYLISTS & DOWNLOADS</Text>
            </View>
            <TouchableOpacity style={styles.newPlaylistBtn} onPress={onOpenCreatePlaylist}>
              <Plus size={16} color={colors.ink} strokeWidth={3} />
              <Text style={styles.newPlaylistBtnText}>NEW</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {selectedView === 'liked' ? (
          /* Detailed Liked Tracks */
          <View>
            <View style={styles.likedHeroCard}>
              <View style={styles.hardShadow} />
              <View style={styles.likedHero}>
                <View style={styles.heartBigBox}>
                  <Heart size={32} color={colors.rust} fill={colors.rust} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <CassetteTag label="FAVORITES" bg={colors.ink} textColor={colors.mint} />
                  <Text style={styles.likedHeroTitle}>LIKED SONGS</Text>
                  <Text style={styles.likedHeroSub}>{likedTracks.length} songs preserved</Text>
                  <View style={styles.likedBtnRow}>
                    <TouchableOpacity
                      style={styles.playHeroBtn}
                      onPress={() => handlePlayLiked(false)}
                    >
                      <Play size={14} color={colors.ink} fill={colors.ink} />
                      <Text style={styles.playHeroBtnText}>PLAY ALL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.shuffleHeroBtn}
                      onPress={() => handlePlayLiked(true)}
                    >
                      <Shuffle size={14} color={colors.paper} />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {likedTracks.length === 0 ? (
              <View style={styles.emptyCard}>
                <Heart size={36} color={colors.rust} />
                <Text style={styles.emptyTitle}>No liked recordings yet</Text>
                <Text style={styles.emptySub}>Tap the heart icon on any tape to archive it here.</Text>
              </View>
            ) : (
              <View style={styles.tracksList}>
                {likedTracks.map((track, idx) => (
                  <SongItem
                    key={track._id || track.id || idx}
                    track={track}
                    index={idx + 1}
                    onMorePress={() => onTrackAction && onTrackAction(track)}
                  />
                ))}
              </View>
            )}
          </View>
        ) : selectedView && typeof selectedView === 'object' ? (
          /* Detailed Playlist View */
          <View>
            <View style={styles.playlistHeroCard}>
              <View style={styles.hardShadow} />
              <View style={styles.playlistHero}>
                <View style={styles.playlistBigBox}>
                  <View style={StyleSheet.absoluteFillObject}>
                    <Disc size={32} color={colors.mint} style={{ alignSelf: 'center', marginTop: 12 }} />
                  </View>
                  {((!coverFailed && selectedView.cover) || (activePlaylistTracks[0]?.cover || activePlaylistTracks[0]?.coverUrl)) ? (
                    <Image
                      source={{
                        uri: normalizeCoverUri(
                          (!coverFailed && selectedView.cover)
                            ? selectedView.cover
                            : (activePlaylistTracks[0]?.cover || activePlaylistTracks[0]?.coverUrl)
                        ),
                      }}
                      style={{ width: '100%', height: '100%', borderRadius: 8 }}
                      resizeMode="cover"
                      onError={() => setCoverFailed(true)}
                    />
                  ) : null}
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <CassetteTag label="CRATE PLAYLIST" bg={colors.ink} textColor={colors.tealLight} />
                    <TouchableOpacity
                      style={styles.editHeroPill}
                      onPress={() => openEditPlaylist(selectedView)}
                      activeOpacity={0.7}
                    >
                      <Edit3 size={11} color={colors.mint} />
                      <Text style={styles.editHeroPillText}>EDIT</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.playlistHeroTitle}>{selectedView.name}</Text>
                  <Text style={styles.playlistHeroSub}>
                    {(selectedView.tracks || selectedView.trackIds || activePlaylistTracks || []).length} recordings compiled
                  </Text>
                  <View style={styles.likedBtnRow}>
                    <TouchableOpacity
                      style={styles.playHeroBtn}
                      onPress={() => handlePlayPlaylist(selectedView, false)}
                    >
                      <Play size={14} color={colors.ink} fill={colors.ink} />
                      <Text style={styles.playHeroBtnText}>PLAY</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.shuffleHeroBtn}
                      onPress={() => handlePlayPlaylist(selectedView, true)}
                    >
                      <Shuffle size={14} color={colors.paper} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.downloadHeroBtn, isDownloadingAll && { opacity: 0.7 }]}
                      onPress={handleDownloadAllPlaylist}
                      disabled={isDownloadingAll}
                      activeOpacity={0.8}
                    >
                      {isDownloadingAll ? (
                        <ActivityIndicator size="small" color={colors.ink} />
                      ) : (
                        <Download size={13} color={colors.ink} />
                      )}
                      <Text style={styles.downloadHeroBtnText}>
                        {isDownloadingAll ? `${downloadProgress.done}/${downloadProgress.total}` : 'DOWNLOAD ALL'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            {isLoadingTracks && activePlaylistTracks.length === 0 ? (
              <View style={[styles.emptyCard, { paddingVertical: 40 }]}>
                <ActivityIndicator size="large" color="#17a398" />
                <Text style={[styles.emptyTitle, { marginTop: 12 }]}>Loading playlist tracks...</Text>
              </View>
            ) : activePlaylistTracks.length === 0 ? (
              <View style={styles.emptyCard}>
                <Disc size={36} color={colors.mint} />
                <Text style={styles.emptyTitle}>No tracks in this crate yet</Text>
                <Text style={styles.emptySub}>Add songs from Home or Search to fill this crate.</Text>
              </View>
            ) : (
              <View style={styles.tracksList}>
                {activePlaylistTracks.map((track, idx) => (
                  <SongItem
                    key={track._id || track.id || idx}
                    track={track}
                    index={idx + 1}
                    onPlay={() => {
                      if (typeof playPlaylist === 'function') {
                        playPlaylist(activePlaylistTracks, idx);
                      } else if (typeof playTrack === 'function') {
                        playTrack(track, activePlaylistTracks);
                      }
                    }}
                    onMorePress={() => onTrackAction && onTrackAction(track)}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          /* Main Library Overview */
          <View>
            {/* Liked Songs Cassette Card */}
            <TouchableOpacity
              style={styles.cardOuter}
              activeOpacity={0.9}
              onPress={() => setSelectedView('liked')}
            >
              <View style={styles.cardShadow} />
              <View style={styles.likedBanner}>
                <View style={styles.likedBannerIcon}>
                  <Heart size={28} color={colors.rust} fill={colors.rust} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <CassetteTag label="FAVORITES" bg={colors.ink} textColor={colors.mint} />
                  <Text style={styles.likedBannerTitle}>LIKED SONGS</Text>
                  <Text style={styles.likedBannerSub}>{likedTracks.length} SONGS SAVED</Text>
                </View>
                <View style={styles.cardArrowPill}>
                  <Play size={14} color={colors.ink} fill={colors.ink} />
                </View>
              </View>
            </TouchableOpacity>

            {/* Offline Recordings Shortcut Card */}
            <TouchableOpacity
              style={styles.cardOuter}
              activeOpacity={0.9}
              onPress={onNavigateOffline}
            >
              <View style={styles.cardShadow} />
              <View style={[styles.likedBanner, { backgroundColor: '#162e2a' }]}>
                <View style={[styles.likedBannerIcon, { backgroundColor: colors.teal }]}>
                  <Download size={24} color={colors.ink} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <CassetteTag label="OFFLINE STORAGE" bg={colors.ink} textColor={colors.tealLight} />
                  <Text style={styles.likedBannerTitle}>OFFLINE VAULT</Text>
                  <Text style={styles.likedBannerSub}>PLAY ANYWHERE WITHOUT WI-FI</Text>
                </View>
                <View style={styles.cardArrowPill}>
                  <Play size={14} color={colors.ink} fill={colors.ink} />
                </View>
              </View>
            </TouchableOpacity>

            {/* User Playlists */}
            <View style={styles.cratesHeader}>
              <Text style={styles.cratesTitle}>YOUR PLAYLISTS ({playlists.length})</Text>
              <CassetteTag label="COLLECTION" bg={colors.ink} textColor={colors.mint} />
            </View>

            {playlists.length === 0 ? (
              <View style={styles.emptyCard}>
                <FolderHeart size={36} color={colors.teal} />
                <Text style={styles.emptyTitle}>No playlists created yet</Text>
                <Text style={styles.emptySub}>
                  Create custom playlists to organize your favorite songs.
                </Text>
              </View>
            ) : (
              <View style={styles.playlistGrid}>
                {playlists.map((playlist) => (
                  <TouchableOpacity
                    key={playlist._id || playlist.id}
                    style={styles.playlistGridCard}
                    activeOpacity={0.85}
                    onPress={() => setSelectedView(playlist)}
                  >
                    <View style={styles.playlistCoverBox}>
                      {playlist.cover ? (
                        <Image
                          source={{ uri: normalizeCoverUri(playlist.cover) }}
                          style={{ width: '100%', height: '100%' }}
                          resizeMode="cover"
                        />
                      ) : (
                        <Disc size={28} color={colors.mint} />
                      )}
                    </View>
                    <Text style={styles.playlistCardName} numberOfLines={1}>
                      {playlist.name}
                    </Text>
                    <Text style={styles.playlistCardCount}>
                      {(playlist.tracks || playlist.trackIds || []).length} TRACKS
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Edit Playlist Modal ── */}
      <Modal
        visible={isEditModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#111a18' : '#fdfbf7' }]}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: isDark ? colors.paper : colors.ink }]}>EDIT CRATE</Text>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={20} color={isDark ? colors.paper : colors.ink} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Cover Preview & Pick Row */}
              <View style={styles.editCoverRow}>
                <View style={styles.editCoverPreview}>
                  {editCover ? (
                    <Image
                      source={{ uri: normalizeCoverUri(editCover) }}
                      style={{ width: '100%', height: '100%', borderRadius: 8 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Disc size={30} color={colors.mint} />
                  )}
                </View>
                <View style={{ flex: 1, marginLeft: 12, gap: 6 }}>
                  <TouchableOpacity
                    style={styles.pickFileBtn}
                    onPress={handlePickCoverFile}
                    activeOpacity={0.8}
                  >
                    <FolderPlus size={14} color={colors.ink} />
                    <Text style={styles.pickFileBtnText}>CHOOSE PHOTO</Text>
                  </TouchableOpacity>
                  <Text style={styles.pickFileHint}>Upload JPG/PNG from device</Text>
                </View>
              </View>

              {/* Quick Pick From Playlist Tracks */}
              {activePlaylistTracks && activePlaylistTracks.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.inputLabel, { color: isDark ? colors.paperMuted : '#4b5563' }]}>OR USE TRACK ARTWORK:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 4 }}>
                    {activePlaylistTracks.slice(0, 8).map((t, idx) => {
                      const tCover = t.cover || t.coverUrl;
                      if (!tCover) return null;
                      return (
                        <TouchableOpacity
                          key={t._id || t.id || idx}
                          onPress={() => setEditCover(tCover)}
                          style={[
                            styles.trackThumbBtn,
                            editCover === tCover && { borderColor: colors.mint, borderWidth: 2 }
                          ]}
                          activeOpacity={0.8}
                        >
                          <Image
                            source={{ uri: normalizeCoverUri(tCover, t) }}
                            style={{ width: 44, height: 44, borderRadius: 6 }}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Title input */}
              <View style={{ marginTop: 14 }}>
                <Text style={[styles.inputLabel, { color: isDark ? colors.paperMuted : '#4b5563' }]}>PLAYLIST TITLE</Text>
                <TextInput
                  value={editName}
                  onChangeText={setEditName}
                  placeholder="e.g. My Favorite Tracks"
                  placeholderTextColor="#6b7280"
                  style={[styles.modalInput, { backgroundColor: isDark ? '#08110f' : '#ffffff', color: isDark ? colors.paper : colors.ink }]}
                />
              </View>

              {/* Description input */}
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.inputLabel, { color: isDark ? colors.paperMuted : '#4b5563' }]}>DESCRIPTION (OPTIONAL)</Text>
                <TextInput
                  value={editDesc}
                  onChangeText={setEditDesc}
                  placeholder="Describe this collection..."
                  placeholderTextColor="#6b7280"
                  style={[styles.modalInput, { backgroundColor: isDark ? '#08110f' : '#ffffff', color: isDark ? colors.paper : colors.ink }]}
                />
              </View>

              {/* Custom Cover URL */}
              <View style={{ marginTop: 12 }}>
                <Text style={[styles.inputLabel, { color: isDark ? colors.paperMuted : '#4b5563' }]}>IMAGE URL (OPTIONAL)</Text>
                <TextInput
                  value={editCover.startsWith('file://') ? '' : editCover}
                  onChangeText={setEditCover}
                  placeholder="https://images... / direct image link"
                  placeholderTextColor="#6b7280"
                  style={[styles.modalInput, { backgroundColor: isDark ? '#08110f' : '#ffffff', color: isDark ? colors.paper : colors.ink }]}
                  autoCapitalize="none"
                />
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsEditModalOpen(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelBtnText}>CANCEL</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSavePlaylistEdit}
                disabled={isSavingEdit}
                activeOpacity={0.8}
              >
                {isSavingEdit ? (
                  <ActivityIndicator size="small" color={colors.ink} />
                ) : (
                  <>
                    <Check size={14} color={colors.ink} strokeWidth={2.5} />
                    <Text style={styles.modalSaveBtnText}>SAVE CRATE</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  header: {
    backgroundColor: colors.deepForest,
    borderBottomWidth: 2.5,
    borderBottomColor: colors.ink,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  headerMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    padding: 6,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.paper,
    borderRadius: 6,
  },
  headerTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 18,
    color: colors.paper,
    letterSpacing: 0.5,
  },
  headerSub: {
    fontFamily: 'monospace',
    fontSize: 9,
    fontWeight: '800',
    color: colors.mint,
    marginTop: 2,
  },
  newPlaylistBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mint,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  newPlaylistBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.ink,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 110,
  },
  cardOuter: {
    position: 'relative',
    marginBottom: 14,
  },
  cardShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.tealDark,
    borderRadius: 10,
  },
  likedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 10,
    padding: 12,
  },
  likedBannerIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likedBannerTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 14,
    color: colors.paper,
    marginTop: 2,
  },
  likedBannerSub: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: colors.paperMuted,
    marginTop: 2,
  },
  cardArrowPill: {
    backgroundColor: colors.paper,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    padding: 8,
  },
  cratesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingBottom: 6,
  },
  cratesTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 13,
    color: colors.paper,
  },
  emptyCard: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceDark,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 10,
  },
  emptyTitle: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 14,
    color: colors.paper,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 11,
    color: colors.paperMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  playlistGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  playlistGridCard: {
    width: (width - 38) / 2,
    backgroundColor: colors.surfaceDark,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    padding: 10,
  },
  playlistCoverBox: {
    width: '100%',
    height: 80,
    backgroundColor: colors.deepForest,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  playlistCardName: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    color: colors.paper,
  },
  playlistCardCount: {
    fontFamily: 'monospace',
    fontSize: 10,
    color: colors.paperMuted,
    marginTop: 2,
  },
  likedHeroCard: {
    position: 'relative',
    marginBottom: 16,
  },
  hardShadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: colors.tealDark,
    borderRadius: 10,
  },
  likedHero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 10,
    padding: 14,
  },
  heartBigBox: {
    width: 60,
    height: 60,
    backgroundColor: '#3f1717',
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likedHeroTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 18,
    color: colors.paper,
    marginTop: 2,
  },
  likedHeroSub: {
    fontSize: 11,
    color: colors.paperMuted,
    marginTop: 2,
  },
  likedBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  playHeroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mint,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    gap: 4,
  },
  playHeroBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.ink,
  },
  shuffleHeroBtn: {
    backgroundColor: colors.surfaceDark,
    borderWidth: 1.5,
    borderColor: colors.paperMuted,
    borderRadius: 6,
    padding: 6,
  },
  playlistHeroCard: {
    position: 'relative',
    marginBottom: 16,
  },
  playlistHero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceDark,
    borderWidth: 2.5,
    borderColor: colors.ink,
    borderRadius: 10,
    padding: 14,
  },
  playlistBigBox: {
    width: 60,
    height: 60,
    backgroundColor: colors.deepForest,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playlistHeroTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 18,
    color: colors.paper,
    marginTop: 2,
  },
  playlistHeroSub: {
    fontSize: 11,
    color: colors.paperMuted,
    marginTop: 2,
  },
  tracksList: {
    gap: 8,
  },
  editHeroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a1714',
    borderWidth: 1.5,
    borderColor: colors.mint,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  editHeroPillText: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 10,
    color: colors.mint,
  },
  downloadHeroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mint,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  downloadHeroBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.ink,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.ink,
    padding: 18,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingBottom: 10,
  },
  modalTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  editCoverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  editCoverPreview: {
    width: 64,
    height: 64,
    borderRadius: 8,
    backgroundColor: colors.deepForest,
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  pickFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mint,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
    alignSelf: 'flex-start',
  },
  pickFileBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.ink,
  },
  pickFileHint: {
    fontSize: 10,
    color: colors.paperMuted,
  },
  trackThumbBtn: {
    width: 48,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: '#05110f',
  },
  inputLabel: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 10,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    borderTopWidth: 1.5,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingTop: 14,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#1f2937',
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 11,
    color: colors.paper,
  },
  modalSaveBtn: {
    flex: 2,
    flexDirection: 'row',
    backgroundColor: colors.mint,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  modalSaveBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.ink,
  },
});
