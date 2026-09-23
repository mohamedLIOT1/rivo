import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Switch, Alert } from 'react-native';
import { X, Server, Trash2, ShieldCheck, Info, Wifi, Volume2, Cpu, LogOut, HardDrive, FolderPlus, RefreshCw } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { API_BASE_URL } from '../config';
import { colors } from '../theme/colors';
import CassetteTag from '../ui/CassetteTag';
import BrutalButton from '../ui/BrutalButton';
import {
  importLocalAudioFiles,
  scanOfflineVault,
  getStorageLocationInfo,
} from '../services/downloadManager';

export default function SettingsModal({ visible, onClose }) {
  const { currentUser, logout } = useUser();
  const { showToast } = useToast();
  const [highQuality, setHighQuality] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [cacheSize, setCacheSize] = useState('14.2 MB');
  const [storageInfo, setStorageInfo] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadStorageInfo();
    }
  }, [visible]);

  const loadStorageInfo = async () => {
    try {
      const info = await getStorageLocationInfo();
      setStorageInfo(info);
    } catch {}
  };

  const handleImportAudio = async () => {
    try {
      setActionLoading(true);
      const res = await importLocalAudioFiles();
      if (res && res.success) {
        showToast(`Imported ${res.count} tracks to Vault!`, 'success');
        await loadStorageInfo();
      }
    } catch {
      showToast('Failed to import audio files', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleScanVault = async () => {
    try {
      setActionLoading(true);
      const res = await scanOfflineVault();
      if (res && res.newlyFound > 0) {
        showToast(`Found ${res.newlyFound} new local tracks!`, 'success');
      } else {
        showToast('Storage scan complete — all tracks synced', 'info');
      }
      await loadStorageInfo();
    } catch {
      showToast('Failed scanning vault', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (!visible) return null;

  const handleClearCache = async () => {
    try {
      await AsyncStorage.removeItem('@rivo_cached_tracks_v2');
      setCacheSize('0.0 KB');
      showToast('Cache purged successfully', 'success');
    } catch {
      showToast('Failed to clear cache', 'error');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'DISENGAGE SESSION',
      'Are you sure you want to log out from Rivo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            showToast('Logged out', 'info');
            onClose();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={styles.hardShadow} />
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <CassetteTag label="SYSTEM CONSOLE" bg={colors.ink} textColor={colors.mint} />
                <Text style={styles.headerTitle}>SETTINGS & ENGINE</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <X size={20} color={colors.ink} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* Server Connection Status */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Server size={18} color={colors.mint} />
                  <Text style={styles.sectionTitle}>AUDIO CLOUD MATRIX</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Endpoint:</Text>
                  <Text style={styles.valueMono} numberOfLines={1}>
                    {API_BASE_URL.replace('https://', '')}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Status:</Text>
                  <View style={styles.statusPill}>
                    <View style={styles.greenDot} />
                    <Text style={styles.statusText}>OPERATIONAL</Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <Text style={styles.label}>Package ID:</Text>
                  <Text style={styles.valueMono}>com.rivo.app</Text>
                </View>
              </View>

              {/* Audio Preferences */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Volume2 size={18} color={colors.teal} />
                  <Text style={styles.sectionTitle}>PLAYBACK & STREAMING</Text>
                </View>

                <View style={styles.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>320kbps High Fidelity</Text>
                    <Text style={styles.switchDesc}>Lossless stream priority when available</Text>
                  </View>
                  <Switch
                    value={highQuality}
                    onValueChange={setHighQuality}
                    trackColor={{ false: colors.paperDark, true: colors.teal }}
                    thumbColor={colors.paper}
                  />
                </View>

                <View style={[styles.switchRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.switchTitle}>Tactile Brutalist Haptics</Text>
                    <Text style={styles.switchDesc}>Physical feedback on vinyl controls</Text>
                  </View>
                  <Switch
                    value={hapticFeedback}
                    onValueChange={setHapticFeedback}
                    trackColor={{ false: colors.paperDark, true: colors.mint }}
                    thumbColor={colors.paper}
                  />
                </View>
              </View>

              {/* Offline Storage & Vault Section */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <HardDrive size={18} color={colors.mint} />
                  <Text style={styles.sectionTitle}>OFFLINE VAULT & STORAGE</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.label}>Location:</Text>
                  <Text style={styles.valueMono} numberOfLines={1}>
                    {storageInfo?.folderLabel || 'Internal App Storage'}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.label}>Vault Files:</Text>
                  <Text style={styles.valueMono}>
                    {storageInfo ? `${storageInfo.totalCount} files (${(storageInfo.totalBytes / 1048576).toFixed(1)} MB)` : 'Scanning...'}
                  </Text>
                </View>

                <View style={styles.storageActionsRow}>
                  <TouchableOpacity
                    style={styles.storageActionBtn}
                    onPress={handleImportAudio}
                    disabled={actionLoading}
                    activeOpacity={0.8}
                  >
                    <FolderPlus size={14} color={colors.ink} />
                    <Text style={styles.storageActionText}>IMPORT MP3s</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.storageActionBtn, styles.storageActionBtnSec]}
                    onPress={handleScanVault}
                    disabled={actionLoading}
                    activeOpacity={0.8}
                  >
                    <RefreshCw size={13} color={colors.mint} />
                    <Text style={styles.storageActionTextSec}>RE-SYNC VAULT</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* About Rivo Engine */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <Cpu size={18} color={colors.mint} />
                  <Text style={styles.sectionTitle}>RIVO ARCHITECTURE</Text>
                </View>
                <Text style={styles.aboutText}>
                  Rivo Sonic Dispensary v1.0.0 is compiled with Pure Native React Native architecture. Zero WebViews.
                  Engineered with tactile physical controls, real-time audio synchronization, and offline tape reel storage.
                </Text>
              </View>

              {/* Account Section */}
              {currentUser && (
                <View style={styles.sectionCard}>
                  <View style={styles.sectionHeader}>
                    <ShieldCheck size={18} color={colors.teal} />
                    <Text style={styles.sectionTitle}>ACTIVE CITIZEN</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Handle:</Text>
                    <Text style={styles.valueMono}>@{currentUser.name || currentUser.username}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.label}>Identity:</Text>
                    <Text style={styles.valueMono}>{currentUser.email}</Text>
                  </View>
                  <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                    <LogOut size={16} color={colors.rust} />
                    <Text style={styles.logoutBtnText}>DISENGAGE SESSION</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    height: '85%',
    width: '100%',
    position: 'relative',
  },
  hardShadow: {
    position: 'absolute',
    top: -4,
    left: 4,
    right: 4,
    bottom: 0,
    backgroundColor: colors.ink,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.paper,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 2.5,
    borderBottomWidth: 0,
    borderColor: colors.ink,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: colors.ink,
    backgroundColor: colors.paperLight,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  headerTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 18,
    color: colors.ink,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  closeBtn: {
    padding: 8,
    borderWidth: 2,
    borderColor: colors.ink,
    backgroundColor: colors.paperMuted,
    borderRadius: 8,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  sectionCard: {
    backgroundColor: colors.paperLight,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 8,
    padding: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.ink,
    paddingBottom: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.5,
    color: colors.ink,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkMuted,
  },
  valueMono: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '900',
    color: colors.ink,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a3622',
    borderWidth: 1.5,
    borderColor: colors.ink,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 6,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.mint,
  },
  statusText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.mint,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.paperDark,
  },
  switchTitle: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 13,
    color: colors.ink,
  },
  switchDesc: {
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: 2,
  },
  purgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fbe9e7',
    borderWidth: 2,
    borderColor: colors.rust,
    borderRadius: 6,
    paddingVertical: 10,
    gap: 8,
    marginTop: 6,
  },
  purgeBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.rust,
  },
  aboutText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: colors.inkMuted,
    lineHeight: 16,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fee2e2',
    borderWidth: 2,
    borderColor: colors.rust,
    borderRadius: 6,
    paddingVertical: 10,
    gap: 8,
    marginTop: 10,
  },
  logoutBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: colors.rust,
  },
  storageActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  storageActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.mint,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingVertical: 9,
  },
  storageActionText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.ink,
    letterSpacing: 0.5,
  },
  storageActionBtnSec: {
    backgroundColor: colors.ink,
    borderColor: colors.mint,
  },
  storageActionTextSec: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 10,
    color: colors.mint,
    letterSpacing: 0.5,
  },
});
