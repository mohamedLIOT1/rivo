import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { WifiOff, Wifi, Search, ListPlus, Trash2 } from 'lucide-react-native';
import { useAudioPlayer } from '../context/AudioContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LocalizationContext';
import { colors } from '../theme/colors';
import { isQuranContent } from '../../utils/quranUtils';
import OfflineTrackItem from '../components/offline/OfflineTrackItem';
import OfflineHeroHeader from '../components/offline/OfflineHeroHeader';
import { useOfflineOperations } from '../hooks/useOfflineOperations';
import { styles } from './OfflineScreen.styles';

function OfflineScreen() {
  const {
    playTrack,
    currentTrack,
    isPlaying,
    togglePlay,
    addMultipleToQueue,
    removeDownloadedTrack: contextRemoveTrack,
    removeDownloadedTracksBatch: contextRemoveBatch,
    downloadedTracks = [],
  } = useAudioPlayer();
  const { showToast } = useToast();
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [folderTab, setFolderTab] = useState('all'); // 'all' | 'music' | 'quran'

  const {
    offlineTracks,
    storageUsed,
    storageInfo,
    actionLoading,
    handleImportAudio,
    handleImportFolder,
    handleScanVault,
    formatBytes,
    handleDelete,
    handleBatchDelete,
    handlePlayOffline,
    handleExportTrack,
  } = useOfflineOperations({
    contextRemoveTrack,
    contextRemoveBatch,
    downloadedTracks,
    playTrack,
    currentTrack,
    togglePlay,
    addMultipleToQueue,
    showToast,
  });

  const filteredOfflineTracks = useMemo(() => {
    if (!searchQuery.trim()) return offlineTracks || [];
    const q = searchQuery.toLowerCase().trim();
    return (offlineTracks || []).filter((t) => {
      const title = (t.title || '').toLowerCase();
      const artist = (t.artist || '').toLowerCase();
      const album = (t.album || '').toLowerCase();
      return title.includes(q) || artist.includes(q) || album.includes(q);
    });
  }, [offlineTracks, searchQuery]);

  const quranCount = useMemo(() => (offlineTracks || []).filter(isQuranContent).length, [offlineTracks]);
  const musicCount = useMemo(() => (offlineTracks || []).filter((t) => !isQuranContent(t)).length, [offlineTracks]);

  const displayedTracks = useMemo(() => {
    return (filteredOfflineTracks || []).filter((t) => {
      if (!t) return false;
      const isQ = isQuranContent(t);
      if (folderTab === 'music') return !isQ;
      if (folderTab === 'quran') return isQ;
      return true;
    });
  }, [filteredOfflineTracks, folderTab]);

  const toggleSelectTrack = useCallback((trackId) => {
    const sId = String(trackId);
    setSelectedIds((prev) =>
      prev.includes(sId) ? prev.filter((id) => id !== sId) : [...prev, sId]
    );
  }, []);

  const handleSelectAll = useCallback(() => {
    const targetList = (searchQuery.trim() ? filteredOfflineTracks : offlineTracks) || [];
    const allIds = targetList.map((t) => String(t._id || t.id));
    if (selectedIds.length === allIds.length && allIds.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
    }
  }, [filteredOfflineTracks, offlineTracks, searchQuery, selectedIds.length]);

  const getSelectedTracks = useCallback(() => {
    return (offlineTracks || []).filter((t) => selectedIds.includes(String(t._id || t.id)));
  }, [offlineTracks, selectedIds]);

  const handleBatchQueue = useCallback(() => {
    const sel = getSelectedTracks();
    if (sel.length === 0) return;
    if (typeof addMultipleToQueue === 'function') {
      addMultipleToQueue(sel);
    } else {
      sel.forEach((t) => playTrack(t));
    }
    showToast(`Added ${sel.length} song(s) to queue`, 'info');
    setIsSelectMode(false);
    setSelectedIds([]);
  }, [getSelectedTracks, addMultipleToQueue, playTrack, showToast]);

  const onConfirmBatchDelete = useCallback(() => {
    const sel = getSelectedTracks();
    handleBatchDelete(sel, () => {
      setSelectedIds([]);
      setIsSelectMode(false);
    });
  }, [getSelectedTracks, handleBatchDelete]);

  const keyExtractor = useCallback((track, idx) => {
    return String(track?._id || track?.id || idx);
  }, []);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const renderTrackItem = useCallback(({ item: track, index }) => {
    if (!track) return null;
    const trackId = String(track._id || track.id || index);
    const currentId = String(currentTrack?._id || currentTrack?.id || '');
    const active = Boolean(currentTrack && trackId === currentId);
    const isSelected = selectedSet.has(trackId);

    return (
      <OfflineTrackItem
        key={trackId}
        track={track}
        trackId={trackId}
        isActive={active}
        isPlaying={isPlaying}
        isSelected={isSelected}
        isSelectMode={isSelectMode}
        isDark={isDark}
        styles={styles}
        onPress={() => {
          if (isSelectMode) {
            toggleSelectTrack(trackId);
          } else {
            handlePlayOffline(track);
          }
        }}
        onPlay={() => handlePlayOffline(track)}
        onExport={() => handleExportTrack(track)}
        onDelete={() => handleDelete(track)}
      />
    );
  }, [
    currentTrack,
    isPlaying,
    selectedSet,
    isSelectMode,
    isDark,
    toggleSelectTrack,
    handlePlayOffline,
    handleExportTrack,
    handleDelete,
  ]);

  const renderHeader = useMemo(() => {
    return (
      <OfflineHeroHeader
        styles={styles}
        isDark={isDark}
        t={t}
        storageInfo={storageInfo}
        storageUsed={storageUsed}
        formatBytes={formatBytes}
        offlineTracksCount={(offlineTracks || []).length}
        actionLoading={actionLoading}
        isSelectMode={isSelectMode}
        setIsSelectMode={setIsSelectMode}
        setSelectedIds={setSelectedIds}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        displayedTracksCount={displayedTracks.length}
        folderTab={folderTab}
        setFolderTab={setFolderTab}
        musicCount={musicCount}
        quranCount={quranCount}
        handleImportAudio={handleImportAudio}
        handleImportFolder={handleImportFolder}
        handleScanVault={handleScanVault}
      />
    );
  }, [
    isDark,
    t,
    storageInfo,
    storageUsed,
    formatBytes,
    offlineTracks,
    actionLoading,
    isSelectMode,
    searchQuery,
    displayedTracks.length,
    folderTab,
    musicCount,
    quranCount,
    handleImportAudio,
    handleImportFolder,
    handleScanVault,
  ]);

  const renderEmpty = useCallback(() => {
    if (!offlineTracks || offlineTracks.length === 0) {
      return (
        <View style={[styles.emptyCard, !isDark && styles.emptyCardLight]}>
          <WifiOff size={40} color={colors.teal} />
          <Text style={[styles.emptyTitle, !isDark && styles.emptyTitleLight]}>{t('offline.noOfflineSongs')}</Text>
          <Text style={[styles.emptySub, !isDark && styles.emptySubLight]}>
            {t('offline.noOfflineSub')}
          </Text>
          <View style={styles.goOnlineBanner}>
            <Wifi size={13} color={colors.teal} />
            <Text style={styles.goOnlineText}>
              {t('offline.goOnlineText')}
            </Text>
          </View>
        </View>
      );
    }
    if (filteredOfflineTracks.length === 0 && searchQuery.trim().length > 0) {
      return (
        <View style={[styles.emptyCard, !isDark && styles.emptyCardLight, { paddingVertical: 28 }]}>
          <Search size={36} color={colors.mint} />
          <Text style={[styles.emptyTitle, !isDark && styles.emptyTitleLight, { marginTop: 8 }]}>{t('offline.noMatchingSongs')}</Text>
          <Text style={[styles.emptySub, !isDark && styles.emptySubLight]}>
            {t('offline.noMatchingSub', { query: searchQuery })}
          </Text>
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={[styles.heroActionBtnSec, { marginTop: 12, paddingHorizontal: 16 }]}
            activeOpacity={0.8}
          >
            <Text style={styles.heroActionTextSec}>{t('offline.clearSearch')}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (displayedTracks.length === 0) {
      return (
        <View style={[styles.emptyCard, !isDark && styles.emptyCardLight, { paddingVertical: 28 }]}>
          <Text style={[styles.emptyTitle, !isDark && styles.emptyTitleLight]}>
            {folderTab === 'quran' ? 'No Quran Recitations' : 'No Music Tracks'}
          </Text>
          <Text style={[styles.emptySub, !isDark && styles.emptySubLight]}>
            {folderTab === 'quran'
              ? 'No Quran audio files found in offline storage.'
              : 'No music audio files found in offline storage.'}
          </Text>
        </View>
      );
    }
    return null;
  }, [
    offlineTracks,
    filteredOfflineTracks.length,
    searchQuery,
    displayedTracks.length,
    folderTab,
    isDark,
    t,
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: !isDark ? '#fdfbf7' : colors.ink }}>
      <FlatList
        style={[styles.container, !isDark && { backgroundColor: '#fdfbf7' }]}
        data={displayedTracks}
        keyExtractor={keyExtractor}
        renderItem={renderTrackItem}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={[styles.content, isSelectMode && { paddingBottom: 110 }]}
        showsVerticalScrollIndicator={false}
        windowSize={Platform.OS === 'android' ? 3 : 5}
        initialNumToRender={Platform.OS === 'android' ? 6 : 8}
        maxToRenderPerBatch={Platform.OS === 'android' ? 4 : 6}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={Platform.OS === 'android'}
      />

      {/* Floating Tactical Multi-Select Bottom Action Deck */}
      {isSelectMode && (
        <View style={[styles.selectActionBar, { bottom: currentTrack ? (Platform.OS === 'ios' ? 134 : 118) : 20 }]}>
          <View style={styles.selectInfoRow}>
            <Text style={styles.selectCountBadge}>{selectedIds.length}</Text>
            <Text style={styles.selectCountText}>{t('offline.selectedCount')}</Text>
          </View>
          <TouchableOpacity onPress={handleSelectAll} style={styles.selectActionBtnSec}>
            <Text style={styles.selectActionBtnTextSec}>
              {selectedIds.length > 0 && selectedIds.length === ((searchQuery.trim() ? filteredOfflineTracks : offlineTracks) || []).length ? t('offline.deselectAll') : t('offline.selectAll')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleBatchQueue}
            disabled={selectedIds.length === 0}
            style={[styles.selectActionBtn, selectedIds.length === 0 && { opacity: 0.4 }]}
          >
            <ListPlus size={14} color={colors.ink} />
            <Text style={styles.selectActionBtnText}>{t('offline.queueSelected')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onConfirmBatchDelete}
            disabled={selectedIds.length === 0}
            style={[styles.selectActionBtnDanger, selectedIds.length === 0 && { opacity: 0.4 }]}
          >
            <Trash2 size={14} color="#ffffff" />
            <Text style={styles.selectActionBtnTextDanger}>{t('offline.deleteSelected')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default React.memo(OfflineScreen);
