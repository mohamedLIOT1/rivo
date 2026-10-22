import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  useWindowDimensions,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  BackHandler,
  RefreshControl,
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
  Globe,
  Lock,
  ListPlus,
  Search,
  Sparkles,
  RefreshCw,
} from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useUser } from '../context/UserContext';
import { useConnectivity } from '../context/ConnectivityContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { colors } from '../theme/colors';
import { API_BASE_URL } from '../config';
import { normalizeCoverUri } from '../utils/coverUtils';
import { isQuranContent } from '../../utils/quranUtils';
import { deduplicateTrackList } from '../services/downloadManager';
import CassetteTag from '../ui/CassetteTag';
import SongItem from '../ui/SongItem';

const { width } = Dimensions.get('window');

export default function LibraryScreen({
  onOpenCreatePlaylist,
  onNavigateOffline,
  onTrackAction,
}) {
  const { width } = useWindowDimensions();
  const effectiveWidth = Math.min(width, 840);
  const numCols = width >= 1024 ? 4 : width >= 768 ? 3 : 2;
  const cardWidth = Math.floor((effectiveWidth - 28 - (numCols - 1) * 10) / numCols);

  const {
    playTrack,
    playPlaylist,
    tracks: audioTracks,
    downloadedTracks = [],
    handleDownloadTrack,
    handleDownloadPlaylist,
    addMultipleToQueue,
    setQueue,
  } = useAudioPlayer();
  const {
    currentUser,
    playlists = [],
    likedTrackIds = [],
    tracks: userTracks = [],
    fetchPublicTracks,
    updatePlaylist,
    uploadPlaylistCover,
    togglePlaylistVisibility,
    syncUserData,
    addToPlaylist,
    token,
  } = useUser();
  const { showToast } = useToast();
  const { appMode } = useConnectivity();
  const { isDark } = useTheme();
  const isOffline = appMode === 'offline';
  const [selectedView, setSelectedView] = useState(null); // 'liked' | playlistObject
  const [fetchedTracks, setFetchedTracks] = useState([]);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({ done: 0, total: 0 });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editCover, setEditCover] = useState('');
  const [editIsPublic, setEditIsPublic] = useState(true);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isTogglingVisibility, setIsTogglingVisibility] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [justAddedSongId, setJustAddedSongId] = useState(null);

  // Hardware Back button returns to library main view instead of closing app
  useEffect(() => {
    const onBackPress = () => {
      if (selectedView) {
        setSelectedView(null);
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [selectedView]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        syncUserData ? syncUserData() : Promise.resolve(),
        fetchPublicTracks ? fetchPublicTracks() : Promise.resolve()
      ]);
    } catch {}
    finally {
      setIsRefreshing(false);
    }
  };

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
    return deduplicateTrackList((allTracks || []).filter((t) =>
      safeLikedIds.includes(String(t?._id || t?.id))
    ));
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
    const plId = String(selectedView.id || selectedView._id || '');
    const currentPl = (playlists || []).find(p => String(p.id || p._id) === plId) || selectedView;
    const rawItems = currentPl.tracks || currentPl.trackIds || [];
    return rawItems.map(item => {
      const idStr = String(typeof item === 'object' ? (item._id || item.id) : item);
      const found = trackPoolMap.get(idStr);
      if (found) return found;
      if (typeof item === 'object' && item.title) return item;
      return null;
    }).filter(Boolean);
  }, [selectedView, playlists, trackPoolMap]);

  // Detect whether current open playlist is a Quran playlist
  const isSelectedPlQuran = useMemo(() => {
    if (!selectedView || typeof selectedView !== 'object' || selectedView === 'liked') return false;
    return Boolean(
      selectedView.isQuran ||
      isQuranContent(selectedView) ||
      (activePlaylistTracks && activePlaylistTracks.length > 0 && activePlaylistTracks.some(isQuranContent))
    );
  }, [selectedView, activePlaylistTracks]);

  // AI & Smart recommendations for filling the playlist
  const fetchAiRecommendations = async () => {
    if (!selectedView || typeof selectedView !== 'object' || selectedView === 'liked') return;
    setIsLoadingAi(true);
    try {
      const plId = String(selectedView.id || selectedView._id || '');
      const currentPl = (playlists || []).find(p => String(p.id || p._id) === plId) || selectedView;
      const tIds = (currentPl.tracks || currentPl.trackIds || []).map(t => typeof t === 'object' ? (t._id || t.id) : t);
      const res = await fetch(`${API_BASE_URL}/api/ai/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          playlistId: plId,
          trackIds: tIds,
          name: currentPl.name,
          isQuran: isSelectedPlQuran,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const rawRecs = data.recommendations || data.tracks || [];
        if (data.success && Array.isArray(rawRecs) && rawRecs.length > 0) {
          const filteredRecs = rawRecs.filter(t => {
            const isQ = isQuranContent(t);
            return isSelectedPlQuran ? isQ : !isQ;
          });
          if (filteredRecs.length > 0) {
            setAiRecommendations(filteredRecs);
            setIsLoadingAi(false);
            return;
          }
        }
      }
    } catch {}

    // Fallback: smart recommendations mix strictly matching playlist category (Music vs Quran)
    const existingIds = new Set((activePlaylistTracks || []).map(t => String(t._id || t.id)));
    const allAvailable = (userTracks && userTracks.length > 0) ? userTracks : (audioTracks || []);
    const candidates = allAvailable.filter(t => {
      if (existingIds.has(String(t._id || t.id))) return false;
      const isQ = isQuranContent(t);
      return isSelectedPlQuran ? isQ : !isQ;
    });
    const shuffled = [...candidates].sort(() => 0.5 - Math.random()).slice(0, 12);
    setAiRecommendations(shuffled);
    setIsLoadingAi(false);
  };

  useEffect(() => {
    if (selectedView && selectedView !== 'liked') {
      fetchAiRecommendations();
    } else {
      setAiRecommendations([]);
      setSongSearchQuery('');
    }
  }, [selectedView]);

  const handleQuickAddTrack = async (track) => {
    if (!selectedView || selectedView === 'liked' || !track) return;
    const plId = String(selectedView.id || selectedView._id || '');
    const tId = String(track._id || track.id);
    setJustAddedSongId(tId);
    if (addToPlaylist) {
      await addToPlaylist(plId, tId);
    }
    showToast(`Added "${track.title}" to crate! ✨`, 'success');
    setAiRecommendations(prev => prev.filter(r => String(r._id || r.id) !== tId));
    setTimeout(() => setJustAddedSongId(null), 1200);
  };

  const searchResultsForAdd = useMemo(() => {
    if (!songSearchQuery.trim()) return [];
    const q = songSearchQuery.toLowerCase().trim();
    const existingIds = new Set((activePlaylistTracks || []).map(t => String(t._id || t.id)));
    const pool = (userTracks && userTracks.length > 0) ? userTracks : (audioTracks || []);
    return pool
      .filter(t => {
        if (existingIds.has(String(t._id || t.id))) return false;
        const isQ = isQuranContent(t);
        if (isSelectedPlQuran ? !isQ : isQ) return false;
        return (
          (t.title && t.title.toLowerCase().includes(q)) ||
          (t.artist && t.artist.toLowerCase().includes(q))
        );
      })
      .slice(0, 15);
  }, [songSearchQuery, activePlaylistTracks, userTracks, audioTracks, isSelectedPlQuran]);

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

    try {
      if (handleDownloadPlaylist) {
        await handleDownloadPlaylist(toDownload);
      } else {
        for (const t of toDownload) {
          await handleDownloadTrack(t);
        }
      }
    } catch (err) {
      console.warn('Playlist track dl error:', err.message);
    }

    setIsDownloadingAll(false);
    showToast(`Saved all ${count} track(s) to Offline Vault!`, 'success');
  };

  const openEditPlaylist = (pl) => {
    setEditName(pl.name || '');
    setEditDesc(pl.description || '');
    setEditCover(pl.cover || '');
    setEditIsPublic(pl.isPublic !== false);
    setIsEditModalOpen(true);
  };

  const handleToggleCurrentPlaylistVisibility = async () => {
    if (!selectedView || typeof selectedView !== 'object' || selectedView === 'liked') return;
    const plId = String(selectedView.id || selectedView._id);
    setIsTogglingVisibility(true);
    try {
      const res = await togglePlaylistVisibility(plId);
      if (res && res.success) {
        const nextIsPublic = res.isPublic;
        setSelectedView(prev => (prev && String(prev.id || prev._id) === plId ? { ...prev, isPublic: nextIsPublic } : prev));
        showToast(nextIsPublic ? 'Playlist is now Public' : 'Playlist is now Private', 'success');
      } else {
        showToast(res?.error || 'Failed to update visibility', 'error');
      }
    } catch (e) {
      showToast('Error updating visibility', 'error');
    } finally {
      setIsTogglingVisibility(false);
    }
  };

  const handleSetPlaylistAsQueue = () => {
    if (!activePlaylistTracks || activePlaylistTracks.length === 0) {
      showToast('No tracks in playlist to queue', 'warning');
      return;
    }
    if (typeof setQueue === 'function') {
      setQueue(activePlaylistTracks);
      showToast(`Set crate as active queue (${activePlaylistTracks.length} tracks)`, 'success');
    } else if (typeof addMultipleToQueue === 'function') {
      addMultipleToQueue(activePlaylistTracks);
      showToast(`Added ${activePlaylistTracks.length} tracks to queue`, 'success');
    }
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
        isPublic: editIsPublic,
      });

      if (editIsPublic !== (selectedView.isPublic !== false)) {
        await togglePlaylistVisibility(plId);
      }

      if (updateRes && updateRes.success) {
        setSelectedView(prev => ({
          ...prev,
          name: editName.trim(),
          description: editDesc.trim(),
          cover: finalCover,
          isPublic: editIsPublic,
        }));
        setCoverFailed(false);
        showToast('Playlist updated successfully!', 'success');
        setIsEditModalOpen(false);
      } else {
        showToast(updateRes?.error || 'Failed to update playlist', 'error');
      }
    } catch (err) {
      showToast('Failed to save changes', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  return (
    <View style={[styles.container, !isDark && { backgroundColor: '#fdfbf7' }]}>
      {/* Header */}
      <View style={[styles.header, !isDark && styles.headerLight]}>
        {selectedView ? (
          <View style={styles.detailHeaderRow}>
            <TouchableOpacity onPress={() => setSelectedView(null)} style={styles.backBtn}>
              <ArrowLeft size={18} color={colors.ink} />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.headerTitle, !isDark && { color: '#0b1110' }]} numberOfLines={1}>
                {selectedView === 'liked' ? 'LIKED RECORDINGS' : selectedView.name}
              </Text>
              <Text style={[styles.headerSub, !isDark && { color: '#0f756d' }]}>
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
              <Text style={[styles.headerTitle, !isDark && { color: '#0b1110' }]}>YOUR LIBRARY</Text>
              <Text style={[styles.headerSub, !isDark && { color: '#0f756d' }]}>PLAYLISTS & DOWNLOADS</Text>
            </View>
            <TouchableOpacity style={styles.newPlaylistBtn} onPress={onOpenCreatePlaylist}>
              <Plus size={16} color={colors.ink} strokeWidth={3} />
              <Text style={styles.newPlaylistBtnText}>NEW</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {selectedView ? (
        <FlatList
          data={selectedView === 'liked' ? likedTracks : activePlaylistTracks}
          keyExtractor={(item, idx) => String(item._id || item.id || idx)}
          renderItem={({ item, index }) => (
            <SongItem
              key={item._id || item.id || String(index)}
              track={item}
              index={index + 1}
              onPlay={() => {
                if (selectedView === 'liked') {
                  if (typeof playPlaylist === 'function') {
                    playPlaylist(likedTracks, index);
                  } else if (typeof playTrack === 'function') {
                    playTrack(item, likedTracks);
                  }
                } else {
                  if (typeof playPlaylist === 'function') {
                    playPlaylist(activePlaylistTracks, index);
                  } else if (typeof playTrack === 'function') {
                    playTrack(item, activePlaylistTracks);
                  }
                }
              }}
              onMorePress={() => onTrackAction && onTrackAction(item)}
            />
          )}
          ListHeaderComponent={
            selectedView === 'liked' ? (
              <View>
                <View style={styles.likedHeroCard}>
                  <View style={styles.hardShadow} />
                  <View style={[styles.likedHero, !isDark && styles.likedHeroLight]}>
                    <View style={styles.heartBigBox}>
                      <Heart size={32} color={colors.rust} fill={colors.rust} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <CassetteTag label="FAVORITES" bg={!isDark ? '#0b1110' : colors.ink} textColor={colors.mint} />
                      <Text style={[styles.likedHeroTitle, !isDark && { color: '#0b1110' }]}>LIKED SONGS</Text>
                      <Text style={[styles.likedHeroSub, !isDark && { color: '#57534e' }]}>{likedTracks.length} songs preserved</Text>
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
                  <View style={[styles.emptyCard, !isDark && styles.emptyCardLight]}>
                    <Heart size={36} color={colors.rust} />
                    <Text style={[styles.emptyTitle, !isDark && { color: '#0b1110' }]}>No liked recordings yet</Text>
                    <Text style={[styles.emptySub, !isDark && { color: '#57534e' }]}>Tap the heart icon on any tape to archive it here.</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View>
                <View style={styles.playlistHeroCard}>
                  <View style={styles.hardShadow} />
                  <View style={[styles.playlistHero, !isDark && styles.playlistHeroLight]}>
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
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <CassetteTag label="CRATE PLAYLIST" bg={!isDark ? '#0b1110' : colors.ink} textColor={colors.tealLight} />
                          <TouchableOpacity
                            style={[
                              styles.visibilityHeroPill,
                              selectedView.isPublic !== false ? styles.visibilityHeroPillPublic : styles.visibilityHeroPillPrivate
                            ]}
                            onPress={handleToggleCurrentPlaylistVisibility}
                            disabled={isTogglingVisibility}
                            activeOpacity={0.7}
                          >
                            {isTogglingVisibility ? (
                              <ActivityIndicator size="small" color={selectedView.isPublic !== false ? '#17a398' : '#9ca3af'} />
                            ) : selectedView.isPublic !== false ? (
                              <>
                                <Globe size={11} color="#17a398" />
                                <Text style={[styles.visibilityHeroPillText, { color: '#17a398' }]}>PUBLIC</Text>
                              </>
                            ) : (
                              <>
                                <Lock size={11} color="#9ca3af" />
                                <Text style={[styles.visibilityHeroPillText, { color: '#9ca3af' }]}>PRIVATE</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                          style={styles.editHeroPill}
                          onPress={() => openEditPlaylist(selectedView)}
                          activeOpacity={0.7}
                        >
                          <Edit3 size={11} color={colors.mint} />
                          <Text style={styles.editHeroPillText}>EDIT</Text>
                        </TouchableOpacity>
                      </View>
                      <Text style={[styles.playlistHeroTitle, !isDark && { color: '#0b1110' }]}>{selectedView.name}</Text>
                      <Text style={[styles.playlistHeroSub, !isDark && { color: '#57534e' }]}>
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
                          style={styles.queueHeroBtn}
                          onPress={handleSetPlaylistAsQueue}
                          activeOpacity={0.8}
                        >
                          <ListPlus size={13} color="#17a398" />
                          <Text style={styles.queueHeroBtnText}>QUEUE</Text>
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
                  <View style={[styles.emptyCard, !isDark && styles.emptyCardLight, { paddingVertical: 40 }]}>
                    <ActivityIndicator size="large" color="#17a398" />
                    <Text style={[styles.emptyTitle, !isDark && { color: '#0b1110' }, { marginTop: 12 }]}>Loading playlist tracks...</Text>
                  </View>
                ) : activePlaylistTracks.length === 0 ? (
                  <View style={[styles.emptyCard, !isDark && styles.emptyCardLight, { paddingVertical: 24 }]}>
                    <Disc size={36} color={colors.mint} />
                    <Text style={[styles.emptyTitle, !isDark && { color: '#0b1110' }]}>This crate is empty</Text>
                    <Text style={[styles.emptySub, !isDark && { color: '#57534e' }]}>
                      Search below or pick from AI recommendations to add songs instantly!
                    </Text>
                  </View>
                ) : null}
              </View>
            )
          }
          ListFooterComponent={
            selectedView !== 'liked' ? (
              <View style={[styles.playlistAddSection, { marginBottom: 30 }]}>
                <View style={styles.playlistAddHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                    <Sparkles size={14} color="#17a398" strokeWidth={2.5} />
                    <Text style={styles.playlistAddTitle} numberOfLines={1}>
                      {songSearchQuery.trim()
                        ? `SEARCH RESULTS (${searchResultsForAdd.length})`
                        : `AI RECOMMENDATIONS FOR "${selectedView.name}"`}
                    </Text>
                  </View>
                  {!songSearchQuery.trim() && (
                    <TouchableOpacity
                      style={styles.refreshAiBtn}
                      onPress={fetchAiRecommendations}
                      disabled={isLoadingAi}
                      activeOpacity={0.7}
                    >
                      {isLoadingAi ? (
                        <ActivityIndicator size="small" color="#17a398" />
                      ) : (
                        <>
                          <RefreshCw size={11} color="#17a398" />
                          <Text style={styles.refreshAiText}>REFRESH</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.searchAddInputRow}>
                  <Search size={14} color="#6b7280" />
                  <TextInput
                    style={styles.searchAddInput}
                    placeholder="Search songs to add to this crate..."
                    placeholderTextColor="#6b7280"
                    value={songSearchQuery}
                    onChangeText={setSongSearchQuery}
                    autoCorrect={false}
                  />
                  {songSearchQuery.trim() ? (
                    <TouchableOpacity onPress={() => setSongSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <X size={14} color="#9ca3af" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Tracks List: Search Results or AI Recommendations */}
                {(songSearchQuery.trim() ? searchResultsForAdd : aiRecommendations).map((recTrack) => {
                  const recId = String(recTrack._id || recTrack.id);
                  const isJustAdded = justAddedSongId === recId;
                  return (
                    <View key={recId} style={styles.recItemRow}>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 }}
                        onPress={() => playTrack && playTrack(recTrack)}
                        activeOpacity={0.7}
                      >
                        <Image
                          source={{ uri: normalizeCoverUri(recTrack.cover || recTrack.coverUrl) }}
                          style={styles.recItemCover}
                        />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.recItemTitle} numberOfLines={1}>
                            {recTrack.title}
                          </Text>
                          <Text style={styles.recItemArtist} numberOfLines={1}>
                            {recTrack.artist || 'Unknown Artist'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.quickAddBtn, isJustAdded && styles.quickAddBtnDone]}
                        onPress={() => handleQuickAddTrack(recTrack)}
                        disabled={isJustAdded}
                        activeOpacity={0.8}
                      >
                        {isJustAdded ? (
                          <>
                            <Check size={12} color="#082621" strokeWidth={3} />
                            <Text style={styles.quickAddBtnTextDone}>ADDED</Text>
                          </>
                        ) : (
                          <>
                            <Plus size={12} color="#082621" strokeWidth={3} />
                            <Text style={styles.quickAddBtnText}>ADD</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ) : <View style={{ height: 32 }} />
          }
          getItemLayout={(data, index) => ({ length: 64, offset: 64 * index, index })}
          initialNumToRender={14}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={Platform.OS === 'android'}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.mint}
              colors={[colors.mint]}
            />
          }
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.mint}
              colors={[colors.mint]}
            />
          }
        >
          <View>
            {/* Liked Songs Cassette Card */}
            <TouchableOpacity
              style={styles.cardOuter}
              activeOpacity={0.9}
              onPress={() => setSelectedView('liked')}
            >
              <View style={styles.cardShadow} />
              <View style={[styles.likedBanner, !isDark && { backgroundColor: '#ede5d3', borderColor: '#0b1110' }]}>
                <View style={styles.likedBannerIcon}>
                  <Heart size={28} color={colors.rust} fill={colors.rust} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <CassetteTag label="FAVORITES" bg={!isDark ? '#0b1110' : colors.ink} textColor={colors.mint} />
                  <Text style={[styles.likedBannerTitle, !isDark && { color: '#0b1110' }]}>LIKED SONGS</Text>
                  <Text style={[styles.likedBannerSub, !isDark && { color: '#57534e' }]}>{likedTracks.length} SONGS SAVED</Text>
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
              <View style={[styles.likedBanner, !isDark ? { backgroundColor: '#ede5d3', borderColor: '#0b1110' } : { backgroundColor: '#162e2a' }]}>
                <View style={[styles.likedBannerIcon, { backgroundColor: colors.teal }]}>
                  <Download size={24} color={colors.ink} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <CassetteTag label="OFFLINE STORAGE" bg={!isDark ? '#0b1110' : colors.ink} textColor={colors.tealLight} />
                  <Text style={[styles.likedBannerTitle, !isDark && { color: '#0b1110' }]}>OFFLINE VAULT</Text>
                  <Text style={[styles.likedBannerSub, !isDark && { color: '#57534e' }]}>PLAY ANYWHERE WITHOUT WI-FI</Text>
                </View>
                <View style={styles.cardArrowPill}>
                  <Play size={14} color={colors.ink} fill={colors.ink} />
                </View>
              </View>
            </TouchableOpacity>

            {/* User Playlists */}
            <View style={[styles.cratesHeader, !isDark && { borderBottomColor: '#0b1110' }]}>
              <Text style={[styles.cratesTitle, !isDark && { color: '#0b1110' }]}>YOUR PLAYLISTS ({playlists.length})</Text>
              <CassetteTag label="COLLECTION" bg={!isDark ? '#0b1110' : colors.ink} textColor={colors.mint} />
            </View>

            {playlists.length === 0 ? (
              <View style={[styles.emptyCard, !isDark && styles.emptyCardLight]}>
                <FolderHeart size={36} color={colors.teal} />
                <Text style={[styles.emptyTitle, !isDark && { color: '#0b1110' }]}>No playlists created yet</Text>
                <Text style={[styles.emptySub, !isDark && { color: '#57534e' }]}>
                  Create custom playlists to organize your favorite songs.
                </Text>
              </View>
            ) : (
              <View style={styles.playlistGrid}>
                {playlists.map((playlist) => (
                  <TouchableOpacity
                    key={playlist._id || playlist.id}
                    style={[styles.playlistGridCard, !isDark && styles.playlistGridCardLight, { width: cardWidth }]}
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
                    <Text style={[styles.playlistCardName, !isDark && { color: '#0b1110' }]} numberOfLines={1}>
                      {playlist.name}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                      <Text style={[styles.playlistCardCount, !isDark && { color: '#57534e' }]}>
                        {(playlist.tracks || playlist.trackIds || []).length} TRACKS
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        {playlist.isPublic !== false ? (
                          <>
                            <Globe size={10} color="#17a398" />
                            <Text style={{ fontSize: 9, color: '#17a398', fontWeight: '800', fontFamily: 'monospace' }}>PUB</Text>
                          </>
                        ) : (
                          <>
                            <Lock size={10} color="#9ca3af" />
                            <Text style={{ fontSize: 9, color: '#9ca3af', fontWeight: '800', fontFamily: 'monospace' }}>PRIV</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}

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

              {/* Visibility toggle in modal */}
              <View style={{ marginTop: 14 }}>
                <Text style={[styles.inputLabel, { color: isDark ? colors.paperMuted : '#4b5563' }]}>PLAYLIST VISIBILITY</Text>
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 12,
                    borderRadius: 8,
                    borderWidth: 1.5,
                    borderColor: editIsPublic ? '#17a398' : '#374151',
                    backgroundColor: editIsPublic ? 'rgba(23,163,152,0.12)' : 'rgba(55,65,81,0.2)',
                  }}
                  onPress={() => setEditIsPublic(!editIsPublic)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                    {editIsPublic ? (
                      <Globe size={18} color="#17a398" />
                    ) : (
                      <Lock size={18} color="#9ca3af" />
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '900', color: editIsPublic ? '#17a398' : '#e2e8f0', fontSize: 13, fontFamily: 'monospace' }}>
                        {editIsPublic ? 'PUBLIC PLAYLIST' : 'PRIVATE PLAYLIST'}
                      </Text>
                      <Text style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                        {editIsPublic ? 'Visible to other listeners & appears in search' : 'Only visible to you in your library'}
                      </Text>
                    </View>
                  </View>
                  <View style={{
                    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                    borderColor: editIsPublic ? '#17a398' : '#6b7280',
                    backgroundColor: editIsPublic ? '#17a398' : 'transparent',
                    alignItems: 'center', justifyContent: 'center'
                  }}>
                    {editIsPublic && <Check size={14} color="#0b1110" strokeWidth={3} />}
                  </View>
                </TouchableOpacity>
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
    maxWidth: 840,
    width: '100%',
    alignSelf: 'center',
  },
  headerLight: {
    backgroundColor: '#ede5d3',
    borderBottomColor: '#0b1110',
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
    maxWidth: 840,
    width: '100%',
    alignSelf: 'center',
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
  emptyCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#0b1110',
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
  playlistGridCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#0b1110',
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
  likedHeroLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
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
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
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
  playlistHeroLight: {
    backgroundColor: '#ede5d3',
    borderColor: '#0b1110',
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
  visibilityHeroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1.5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  visibilityHeroPillPublic: {
    backgroundColor: 'rgba(23,163,152,0.15)',
    borderColor: '#17a398',
  },
  visibilityHeroPillPrivate: {
    backgroundColor: 'rgba(107,114,128,0.15)',
    borderColor: '#4b5563',
  },
  visibilityHeroPillText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 9,
  },
  queueHeroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a1714',
    borderWidth: 1.5,
    borderColor: '#17a398',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  queueHeroBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: '#17a398',
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
  playlistAddSection: {
    marginTop: 20,
    backgroundColor: '#0d1815',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1f2f2b',
    padding: 14,
    marginBottom: 40,
  },
  playlistAddHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  playlistAddTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  refreshAiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(23, 163, 152, 0.12)',
  },
  refreshAiText: {
    fontFamily: 'monospace',
    fontSize: 10,
    fontWeight: '900',
    color: '#17a398',
  },
  searchAddInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#070f0e',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#263330',
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 12,
    gap: 8,
  },
  searchAddInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 12,
    paddingVertical: 0,
  },
  recItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  recItemCover: {
    width: 38,
    height: 38,
    borderRadius: 6,
    backgroundColor: '#1b2a26',
  },
  recItemTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  recItemArtist: {
    color: '#9ca3af',
    fontSize: 11,
    marginTop: 2,
  },
  quickAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#17a398',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  quickAddBtnDone: {
    backgroundColor: '#10b981',
  },
  quickAddBtnText: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '900',
    color: '#082621',
  },
  quickAddBtnTextDone: {
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '900',
    color: '#082621',
  },
});
