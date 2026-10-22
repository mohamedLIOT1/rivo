import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Switch, Alert, TextInput, ActivityIndicator, Platform } from 'react-native';
import { X, Server, Trash2, ShieldCheck, Info, Wifi, Volume2, Cpu, LogOut, HardDrive, FolderPlus, RefreshCw, Radio, Copy, Check, Unlink } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../context/UserContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { useAudioPlayer } from '../context/AudioContext';
import { API_BASE_URL } from '../config';
import { colors } from '../theme/colors';
import { FULL_VERSION } from '../version';
import CassetteTag from '../ui/CassetteTag';
import {
  importLocalAudioFiles,
  scanOfflineVault,
  getStorageLocationInfo,
} from '../services/downloadManager';

export default function SettingsModal({ visible, onClose }) {
  const { currentUser, token, logout } = useUser();
  const { showToast } = useToast();
  const { isDark } = useTheme();
  const { autoDownloadFinished = true, toggleAutoDownloadFinished } = useAudioPlayer();

  const [audioQuality, setAudioQuality] = useState('320'); // '320' | '256' | '128'
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [storageInfo, setStorageInfo] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Discord State
  const [discordStatus, setDiscordStatus] = useState(null);
  const [discordLoading, setDiscordLoading] = useState(false);
  const [linkCode, setLinkCode] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (visible) {
      loadStorageInfo();
      fetchDiscordStatus();
    }
  }, [visible]);

  const loadStorageInfo = async () => {
    try {
      const info = await getStorageLocationInfo();
      setStorageInfo(info);
    } catch {}
  };

  const fetchDiscordStatus = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/discord/status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.error) setDiscordStatus(data);
    } catch {}
  };

  const handleGenerateDiscordCode = async () => {
    if (!token) return;
    setDiscordLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/discord/link-code`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.code) {
        setLinkCode(data.code);
        showToast('Send code to Rivo Bot on Discord!', 'info');
      }
    } catch {
      showToast('Failed to generate code', 'error');
    } finally {
      setDiscordLoading(false);
    }
  };

  const handleLinkDiscordToken = async () => {
    if (!tokenInput || tokenInput.length < 30) {
      showToast('Please enter a valid token', 'error');
      return;
    }
    setDiscordLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/discord/link-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ token: tokenInput })
      });
      const data = await res.json();
      if (data.success) {
        setDiscordStatus({ linked: true, username: data.username, enabled: true });
        setShowTokenInput(false);
        setTokenInput('');
        showToast(`Linked as @${data.username}!`, 'success');
      } else {
        showToast(data.error || 'Failed to link Discord', 'error');
      }
    } catch {
      showToast('Failed to connect to Rivo server', 'error');
    } finally {
      setDiscordLoading(false);
    }
  };

  const handleToggleDiscord = async () => {
    if (!discordStatus || !token) return;
    const nextState = !discordStatus.enabled;
    try {
      await fetch(`${API_BASE_URL}/api/discord/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: nextState })
      });
      setDiscordStatus({ ...discordStatus, enabled: nextState });
      showToast(`Discord Rich Presence ${nextState ? 'Enabled' : 'Disabled'}`, 'info');
    } catch {
      showToast('Failed to toggle Discord sync', 'error');
    }
  };

  const handleUnlinkDiscord = async () => {
    if (!token) return;
    Alert.alert(
      'UNLINK DISCORD',
      'Disconnect your Discord account from Rivo Rich Presence?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            try {
              await fetch(`${API_BASE_URL}/api/discord/unlink`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
              });
              setDiscordStatus({ linked: false, username: '', enabled: false });
              showToast('Discord account unlinked', 'info');
            } catch {
              showToast('Failed to unlink Discord', 'error');
            }
          }
        }
      ]
    );
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

  const sheetBg = isDark ? '#0e1715' : colors.paper;
  const cardBg = isDark ? '#141d1b' : colors.paperLight;
  const borderColor = isDark ? '#263330' : colors.ink;
  const textTitle = isDark ? '#fdfbf7' : colors.ink;
  const textMuted = isDark ? '#9ca3af' : colors.inkMuted;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalCard}>
          <View style={[styles.hardShadow, { backgroundColor: isDark ? '#050a09' : colors.ink }]} />
          <View style={[styles.sheet, { backgroundColor: sheetBg, borderColor }]}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
              <View style={{ flex: 1 }}>
                <CassetteTag label="SYSTEM CONSOLE" bg={colors.ink} textColor={colors.mint} />
                <Text style={[styles.headerTitle, { color: textTitle }]}>SETTINGS & ENGINE</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: cardBg, borderColor }]}>
                <X size={20} color={textTitle} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {/* ── Discord Rich Presence ── */}
              <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
                <View style={[styles.sectionHeader, { borderBottomColor: borderColor }]}>
                  <Radio size={18} color={colors.mint} />
                  <Text style={[styles.sectionTitle, { color: textTitle }]}>DISCORD RICH PRESENCE</Text>
                </View>

                {discordStatus?.linked ? (
                  <View style={{ gap: 12, marginTop: 4 }}>
                    <View style={styles.infoRow}>
                      <Text style={[styles.label, { color: textMuted }]}>Linked Profile:</Text>
                      <View style={styles.discordUserPill}>
                        <View style={styles.greenDot} />
                        <Text style={styles.discordUserText}>@{discordStatus.username}</Text>
                      </View>
                    </View>

                    <View style={styles.switchRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.switchTitle, { color: textTitle }]}>Sync Playing Track</Text>
                        <Text style={[styles.switchDesc, { color: textMuted }]}>Displays "Listening to Rivo" on your Discord</Text>
                      </View>
                      <Switch
                        value={discordStatus.enabled}
                        onValueChange={handleToggleDiscord}
                        trackColor={{ false: '#374151', true: colors.teal }}
                        thumbColor="#fdfbf7"
                      />
                    </View>

                    <TouchableOpacity style={styles.unlinkBtn} onPress={handleUnlinkDiscord} activeOpacity={0.8}>
                      <Unlink size={14} color={colors.crimson} />
                      <Text style={styles.unlinkBtnText}>DISCONNECT DISCORD</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={{ gap: 10, marginTop: 4 }}>
                    <Text style={[styles.aboutText, { color: textMuted }]}>
                      Sync your music status live to your Discord profile as "Listening to Rivo".
                    </Text>

                    {linkCode ? (
                      <View style={styles.codeBox}>
                        <Text style={styles.codeLabel}>YOUR LINK CODE:</Text>
                        <Text style={styles.codeText}>{linkCode}</Text>
                        <Text style={styles.codeDesc}>Send this code in DM to @RIVO bot on Discord.</Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                        <TouchableOpacity
                          style={[styles.primaryBtn, { flex: 1 }]}
                          onPress={handleGenerateDiscordCode}
                          disabled={discordLoading}
                          activeOpacity={0.8}
                        >
                          {discordLoading ? (
                            <ActivityIndicator size="small" color={colors.ink} />
                          ) : (
                            <Text style={styles.primaryBtnText}>GET LINK CODE</Text>
                          )}
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.secBtn, { flex: 1, borderColor }]}
                          onPress={() => setShowTokenInput(!showTokenInput)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.secBtnText, { color: textTitle }]}>
                            {showTokenInput ? 'CANCEL' : 'ENTER TOKEN'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {showTokenInput && (
                      <View style={{ marginTop: 8, gap: 8 }}>
                        <TextInput
                          value={tokenInput}
                          onChangeText={setTokenInput}
                          placeholder="Paste Discord User Token..."
                          placeholderTextColor="#6b7280"
                          secureTextEntry
                          style={[styles.inputBox, { backgroundColor: isDark ? '#0a100e' : '#ffffff', color: textTitle, borderColor }]}
                        />
                        <TouchableOpacity
                          style={styles.primaryBtn}
                          onPress={handleLinkDiscordToken}
                          disabled={discordLoading}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.primaryBtnText}>VERIFY & CONNECT</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>

              {/* ── Audio Streaming Quality ── */}
              <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
                <View style={[styles.sectionHeader, { borderBottomColor: borderColor }]}>
                  <Volume2 size={18} color={colors.teal} />
                  <Text style={[styles.sectionTitle, { color: textTitle }]}>STREAMING FIDELITY</Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  {[
                    { id: '320', label: '320 kbps', sub: 'Lossless Hi-Fi' },
                    { id: '256', label: '256 kbps', sub: 'High Quality' },
                    { id: '128', label: '128 kbps', sub: 'Data Saver' },
                  ].map((tier) => {
                    const isSelected = audioQuality === tier.id;
                    return (
                      <TouchableOpacity
                        key={tier.id}
                        style={[
                          styles.qualityCard,
                          { borderColor: isSelected ? colors.mint : borderColor },
                          isSelected && { backgroundColor: isDark ? '#1a2b26' : '#e6f4f1' }
                        ]}
                        onPress={() => setAudioQuality(tier.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.qualityLabel, { color: isSelected ? colors.mint : textTitle }]}>
                          {tier.label}
                        </Text>
                        <Text style={styles.qualitySub}>{tier.sub}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={[styles.switchRow, { borderBottomWidth: 0, paddingBottom: 0, marginTop: 10 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.switchTitle, { color: textTitle }]}>Tactile Brutalist Haptics</Text>
                    <Text style={[styles.switchDesc, { color: textMuted }]}>Physical vibrations on vinyl controls</Text>
                  </View>
                  <Switch
                    value={hapticFeedback}
                    onValueChange={setHapticFeedback}
                    trackColor={{ false: '#374151', true: colors.mint }}
                    thumbColor="#fdfbf7"
                  />
                </View>
              </View>

              {/* ── Offline Storage & Vault Section ── */}
              <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
                <View style={[styles.sectionHeader, { borderBottomColor: borderColor }]}>
                  <HardDrive size={18} color={colors.mint} />
                  <Text style={[styles.sectionTitle, { color: textTitle }]}>OFFLINE VAULT & STORAGE</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={[styles.label, { color: textMuted }]}>Location:</Text>
                  <Text style={[styles.valueMono, { color: textTitle }]} numberOfLines={1}>
                    {storageInfo?.folderLabel || 'Internal App Storage'}
                  </Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={[styles.label, { color: textMuted }]}>Vault Files:</Text>
                  <Text style={[styles.valueMono, { color: textTitle }]}>
                    {storageInfo ? `${storageInfo.totalCount} tracks (${(storageInfo.totalBytes / 1048576).toFixed(1)} MB)` : 'Scanning...'}
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
                    style={[styles.storageActionBtn, styles.storageActionBtnSec, { borderColor }]}
                    onPress={handleScanVault}
                    disabled={actionLoading}
                    activeOpacity={0.8}
                  >
                    <RefreshCw size={13} color={colors.mint} />
                    <Text style={styles.storageActionTextSec}>RE-SYNC VAULT</Text>
                  </TouchableOpacity>
                </View>

                <View style={[styles.switchRow, { borderBottomWidth: 0, paddingBottom: 0, marginTop: 12 }]}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.switchTitle, { color: textTitle }]}>Auto-Cache Completed Songs</Text>
                    <Text style={[styles.switchDesc, { color: textMuted }]}>Automatically save songs to Vault when listened to the end</Text>
                  </View>
                  <Switch
                    value={Boolean(autoDownloadFinished)}
                    onValueChange={toggleAutoDownloadFinished}
                    trackColor={{ false: '#374151', true: colors.mint }}
                    thumbColor="#fdfbf7"
                  />
                </View>
              </View>

              {/* ── Server Status Matrix ── */}
              <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
                <View style={[styles.sectionHeader, { borderBottomColor: borderColor }]}>
                  <Server size={18} color={colors.mint} />
                  <Text style={[styles.sectionTitle, { color: textTitle }]}>AUDIO CLOUD MATRIX</Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.label, { color: textMuted }]}>Endpoint:</Text>
                  <Text style={[styles.valueMono, { color: textTitle }]} numberOfLines={1}>
                    {API_BASE_URL.replace('https://', '')}
                  </Text>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.label, { color: textMuted }]}>Status:</Text>
                  <View style={styles.statusPill}>
                    <View style={styles.greenDot} />
                    <Text style={styles.statusText}>OPERATIONAL</Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <Text style={[styles.label, { color: textMuted }]}>Build & Version:</Text>
                  <Text style={[styles.valueMono, { color: textTitle }]}>{FULL_VERSION}</Text>
                </View>
              </View>

              {/* ── Account Section ── */}
              {currentUser && (
                <View style={[styles.sectionCard, { backgroundColor: cardBg, borderColor }]}>
                  <View style={[styles.sectionHeader, { borderBottomColor: borderColor }]}>
                    <ShieldCheck size={18} color={colors.teal} />
                    <Text style={[styles.sectionTitle, { color: textTitle }]}>ACCOUNT DETAILS</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.label, { color: textMuted }]}>Username:</Text>
                    <Text style={[styles.valueMono, { color: textTitle }]}>@{currentUser.name || currentUser.username}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={[styles.label, { color: textMuted }]}>Email:</Text>
                    <Text style={[styles.valueMono, { color: textTitle }]}>{currentUser.email}</Text>
                  </View>
                  <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
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
    height: '86%',
    width: '100%',
    position: 'relative',
  },
  hardShadow: {
    position: 'absolute',
    top: -4,
    left: 4,
    right: 4,
    bottom: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  sheet: {
    flex: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 2.5,
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  headerTitle: {
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontWeight: '900',
    fontSize: 17,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  closeBtn: {
    padding: 8,
    borderWidth: 2,
    borderRadius: 8,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  sectionCard: {
    borderWidth: 2,
    borderRadius: 10,
    padding: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderBottomWidth: 1.5,
    paddingBottom: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  valueMono: {
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontSize: 12,
    fontWeight: '700',
    maxWidth: '65%',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(23, 163, 152, 0.15)',
    borderWidth: 1,
    borderColor: colors.teal,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  statusText: {
    fontSize: 9,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontWeight: '900',
    color: colors.teal,
  },
  discordUserPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(38, 196, 183, 0.15)',
    borderWidth: 1,
    borderColor: colors.mint,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  discordUserText: {
    fontSize: 11,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontWeight: '900',
    color: colors.mint,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  switchTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  switchDesc: {
    fontSize: 11,
    marginTop: 2,
  },
  qualityCard: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  qualityLabel: {
    fontSize: 12,
    fontWeight: '900',
  },
  qualitySub: {
    fontSize: 9,
    color: '#9ca3af',
    marginTop: 2,
    textAlign: 'center',
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
    backgroundColor: colors.teal,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
    paddingVertical: 8,
  },
  storageActionText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.ink,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
  },
  storageActionBtnSec: {
    backgroundColor: 'transparent',
  },
  storageActionTextSec: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.mint,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
  },
  aboutText: {
    fontSize: 12,
    lineHeight: 18,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.rust,
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 10,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
  },
  logoutBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.rust,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
  },
  unlinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.crimson,
    borderRadius: 6,
    paddingVertical: 6,
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
  },
  unlinkBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.crimson,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
  },
  primaryBtn: {
    backgroundColor: colors.teal,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  primaryBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: colors.ink,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
  },
  secBtn: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingVertical: 9,
    alignItems: 'center',
  },
  secBtnText: {
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
  },
  inputBox: {
    borderWidth: 1.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  codeBox: {
    backgroundColor: 'rgba(23, 163, 152, 0.1)',
    borderWidth: 1.5,
    borderColor: colors.mint,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 9,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontWeight: '900',
    color: colors.mint,
  },
  codeText: {
    fontSize: 22,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Menlo',
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 3,
    marginVertical: 4,
  },
  codeDesc: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
  },
});
