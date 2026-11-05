import React from 'react';
import { View, Text, TouchableOpacity, TextInput, Platform } from 'react-native';
import {
  HardDrive,
  FolderPlus,
  RefreshCw,
  CheckSquare,
  Search,
  X,
} from 'lucide-react-native';
import { colors } from '../../theme/colors';
import CassetteTag from '../../ui/CassetteTag';

export const OfflineHeroHeader = React.memo(function OfflineHeroHeader({
  styles,
  isDark,
  t,
  storageInfo,
  storageUsed,
  formatBytes,
  offlineTracksCount,
  actionLoading,
  isSelectMode,
  setIsSelectMode,
  setSelectedIds,
  searchQuery,
  setSearchQuery,
  displayedTracksCount,
  folderTab,
  setFolderTab,
  musicCount,
  quranCount,
  handleImportAudio,
  handleImportFolder,
  handleScanVault,
}) {
  return (
    <View>
      {/* Offline Storage Status Card */}
      <View style={styles.heroOuter}>
        <View style={styles.heroShadow} />
        <View style={[styles.heroCard, !isDark && styles.heroCardLight]}>
          <View style={styles.topRow}>
            <CassetteTag label="NO WI-FI REQUIRED" bg={!isDark ? '#0b1110' : colors.ink} textColor={colors.mint} />
          </View>

          <Text style={[styles.heroTitle, !isDark && styles.heroTitleLight]}>{t('offline.title')}</Text>
          <Text style={[styles.heroSub, !isDark && styles.heroSubLight, { marginBottom: 12 }]}>
            {t('offline.subtitle')}
          </Text>

          {/* Storage & Location Info Box */}
          <View style={[styles.vaultInfoBox, !isDark && styles.vaultInfoBoxLight]}>
            <View style={styles.vaultInfoRow}>
              <HardDrive size={13} color={colors.mint} />
              <Text style={[styles.vaultPathText, !isDark && styles.vaultPathTextLight]} numberOfLines={1}>
                {storageInfo?.folderLabel || 'Internal Storage'}
              </Text>
            </View>
            <Text style={[styles.vaultSizeText, !isDark && styles.vaultSizeTextLight]}>
              {formatBytes(storageUsed)} • {offlineTracksCount} SONGS
            </Text>
          </View>

          {/* Action Buttons: Import MP3, Scan Vault, Select */}
          <View style={styles.heroActionsRow}>
            <TouchableOpacity
              style={styles.heroActionBtn}
              onPress={handleImportAudio}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              <FolderPlus size={14} color={colors.ink} />
              <Text style={styles.heroActionText}>{t('offline.importBtn')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.heroActionBtn, { backgroundColor: '#10b981' }]}
              onPress={handleImportFolder}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              <HardDrive size={13} color={colors.ink} />
              <Text style={styles.heroActionText}>{t('offline.folderBtn')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.heroActionBtn, styles.heroActionBtnSec]}
              onPress={handleScanVault}
              disabled={actionLoading}
              activeOpacity={0.8}
            >
              <RefreshCw size={13} color={colors.mint} />
              <Text style={styles.heroActionTextSec}>{t('offline.scanBtn')}</Text>
            </TouchableOpacity>

            {offlineTracksCount > 0 && (
              <TouchableOpacity
                style={[
                  styles.heroActionBtn,
                  isSelectMode ? { backgroundColor: colors.rust, borderColor: colors.rust } : styles.heroActionBtnSec,
                ]}
                onPress={() => {
                  setIsSelectMode((p) => !p);
                  setSelectedIds([]);
                }}
                disabled={actionLoading}
                activeOpacity={0.8}
              >
                <CheckSquare size={13} color={isSelectMode ? '#ffffff' : colors.mint} />
                <Text style={[styles.heroActionTextSec, isSelectMode && { color: '#ffffff' }]}>
                  {isSelectMode ? t('offline.cancelBtn') : t('offline.selectBtn')}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Offline Vault Search Bar */}
          {offlineTracksCount > 0 && (
            <View style={styles.vaultSearchBar}>
              <Search size={16} color="#6b7280" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.vaultSearchInput}
                placeholder="Search in offline vault by title, artist, album..."
                placeholderTextColor="#6b7280"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7} style={{ padding: 4 }}>
                  <X size={15} color="#9ca3af" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Offline Tracks List Header */}
      <View style={styles.listSection}>
        <View style={[styles.listHeader, !isDark && { borderBottomColor: '#0b1110' }]}>
          <Text style={[styles.listTitle, !isDark && styles.listTitleLight]}>{t('offline.downloadedVault')}</Text>
          <Text style={[styles.listCount, !isDark && styles.listCountLight]}>
            {searchQuery
              ? t('offline.filteredCount', { filtered: displayedTracksCount, total: offlineTracksCount })
              : t('offline.savedCount', { count: offlineTracksCount })}
          </Text>
        </View>

        {/* Category Folder Filter Tabs */}
        {offlineTracksCount > 0 && (
          <View style={styles.folderTabBar}>
            <TouchableOpacity
              style={[
                styles.folderTabBtn,
                !isDark && styles.folderTabBtnLight,
                folderTab === 'all' && styles.folderTabBtnActive,
              ]}
              onPress={() => setFolderTab('all')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.folderTabText,
                  !isDark && styles.folderTabTextLight,
                  folderTab === 'all' && styles.folderTabTextActive,
                ]}
                numberOfLines={1}
              >
                ALL ({offlineTracksCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.folderTabBtn,
                !isDark && styles.folderTabBtnLight,
                folderTab === 'music' && styles.folderTabBtnActive,
              ]}
              onPress={() => setFolderTab('music')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.folderTabText,
                  !isDark && styles.folderTabTextLight,
                  folderTab === 'music' && styles.folderTabTextActive,
                ]}
                numberOfLines={1}
              >
                🎵 MUSIC ({musicCount})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.folderTabBtn,
                !isDark && styles.folderTabBtnLight,
                folderTab === 'quran' && styles.folderTabBtnActive,
              ]}
              onPress={() => setFolderTab('quran')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.folderTabText,
                  !isDark && styles.folderTabTextLight,
                  folderTab === 'quran' && styles.folderTabTextActive,
                ]}
                numberOfLines={1}
              >
                📖 QURAN ({quranCount})
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
});

export default OfflineHeroHeader;
