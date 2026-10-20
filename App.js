import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  Modal,
  Platform,
  PermissionsAndroid,
  Linking,
  AppState,
  Alert,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Home,
  Search,
  Disc,
  BookOpen,
  MessageSquare,
  Sun,
  Moon,
  Menu,
  X,
  Radio,
  Download,
  BarChart2,
  Wifi,
  WifiOff,
  Shield,
  User,
  Activity,
  Settings as SettingsIcon,
  Globe,
  Users,
} from 'lucide-react-native';

import { UserProvider, useUser } from './src/native/context/UserContext';
import { ToastProvider, useToast } from './src/native/context/ToastContext';
import { AudioProvider, useAudioPlayer } from './src/native/context/AudioContext';
import { SocketProvider, useSocket } from './src/native/context/SocketContext';
import { ConnectivityProvider, useConnectivity } from './src/native/context/ConnectivityContext';
import { ThemeProvider, useTheme } from './src/native/context/ThemeContext';
import { colors } from './src/native/theme/colors';
import { APP_VERSION, FULL_VERSION } from './src/native/version';
import { API_BASE_URL } from './src/native/config';
import * as FileSystem from 'expo-file-system';
import { installApk, getInitialChatSenderId, subscribeToChatNotification } from './src/native/services/mediaControls';
import { initOtaCrashGuard, checkAndDownloadOta, restartToApplyOta, getCurrentOtaVersion } from './src/native/services/otaService';

import ErrorBoundary from './src/native/components/ErrorBoundary';

import HomeScreen from './src/native/screens/HomeScreen';
import SearchScreen from './src/native/screens/SearchScreen';
import LibraryScreen from './src/native/screens/LibraryScreen';
import QuranScreen from './src/native/screens/QuranScreen';
import ProfileScreen from './src/native/screens/ProfileScreen';
import StatsScreen from './src/native/screens/StatsScreen';
import OfflineScreen from './src/native/screens/OfflineScreen';
import AdminScreen from './src/native/screens/AdminScreen';

import MiniPlayer from './src/native/components/MiniPlayer';
import FullPlayerModal from './src/native/components/FullPlayerModal';
import TrackActionMenuModal from './src/native/components/TrackActionMenuModal';
import PlaylistPickerModal from './src/native/components/PlaylistPickerModal';
import CreatePlaylistModal from './src/native/components/CreatePlaylistModal';
import AddSongModal from './src/native/components/AddSongModal';
import ChatModal from './src/native/components/ChatModal';
import SettingsModal from './src/native/components/SettingsModal';
import JamRoomModal from './src/native/components/JamRoomModal';
import FriendActivityModal from './src/native/components/FriendActivityModal';
import IntroAuthModal from './src/native/components/IntroAuthModal';
import UserDetailModal from './src/native/components/UserDetailModal';

const TABS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'library', label: 'Library', icon: Disc },
  { id: 'quran', label: 'Quran', icon: BookOpen },
  { id: 'offline', label: 'Vault', icon: Download },
];

const BETA_TESTER_EMAILS = [
  'whooareyou152@gmail.com',
  'alicrafter85@gmail.com',
  'test@liofy.com',
  'lio@gmail.com',
  'test1@gmail.com',
  'test@gmail.com',
  't1@gmail.com'
];

function MainAppShell() {
  const { appMode } = useConnectivity();
  const isOnline = appMode === 'online';
  const { socket } = useSocket();
  const { currentUser } = useUser();
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // OTA Fast Update States
  const [otaUpdateInfo, setOtaUpdateInfo] = useState(null);
  const [isOtaModalOpen, setIsOtaModalOpen] = useState(false);
  const [isDownloadingOta, setIsDownloadingOta] = useState(false);
  const [otaProgress, setOtaProgress] = useState(0);
  const [otaBytes, setOtaBytes] = useState({ written: 0, total: 0 });
  const [isOtaReadyToRestart, setIsOtaReadyToRestart] = useState(false);
  const [otaError, setOtaError] = useState(null);
  const [otaChangelogLang, setOtaChangelogLang] = useState('ar');
  const [isOtaDetailsExpanded, setIsOtaDetailsExpanded] = useState(false);

  const handleRemoteUpdateManifest = async (data) => {
    if (!data) return;

    // Beta Channel Gate: if update is marked for beta, only alert designated testers or admins
    if (data?.channel === 'beta') {
      const userEmail = (currentUser?.email || '').toLowerCase().trim();
      const isAdmin = currentUser?.role === 'admin' || currentUser?.isAdmin;
      const isBetaTester = isAdmin || BETA_TESTER_EMAILS.includes(userEmail);
      if (!isBetaTester) {
        return; // Normal users are NEVER spammed with test builds!
      }
    }

    const currentPlatform = Platform.OS === 'ios' ? 'ios' : 'android';
    const remotePlatform = data?.platforms?.[currentPlatform];
    const remoteVersion = remotePlatform?.version || data?.version;

    // ─── 1. Check Fast OTA Update first (Android only) ───
    if (Platform.OS === 'android' && remotePlatform?.ota?.enabled) {
      try {
        const ota = remotePlatform.ota;
        const currentOta = await getCurrentOtaVersion();
        const isOtaNewer = currentOta 
          ? isNewerVersion(ota.version, currentOta) 
          : isNewerVersion(ota.version, APP_VERSION);
        
        const isBaseCompatible = !ota.minAppVersion || !isNewerVersion(ota.minAppVersion, APP_VERSION);

        if (isOtaNewer && isBaseCompatible) {
          setOtaUpdateInfo({
            enabled: true,
            version: ota.version,
            notes: ota.notes || remotePlatform?.notes || 'تحديث هوائي سريع فوري بدون إعادة تثبيت التطبيق • إصلاحات في الأداء وسرعة الاستجابة',
            notesEn: ota.notesEn || ota.notes_en || 'Instant in-app OTA update • Performance enhancements, smoother audio playback, and bug fixes.',
            bundleUrl: ota.bundleUrl.startsWith('http') ? ota.bundleUrl : `${API_BASE_URL}${ota.bundleUrl}`,
            minAppVersion: ota.minAppVersion
          });
          setIsOtaModalOpen(true);
          return; // Handled via lightweight OTA!
        }
      } catch (e) {
        console.warn('OTA manifest check error:', e);
      }
    }

    // ─── 2. Fallback to full binary update (APK / IPA) ───
    if (remoteVersion && isNewerVersion(remoteVersion, APP_VERSION)) {
      setUpdateInfo({
        remoteVersion,
        releaseNotes: remotePlatform?.notes || data?.releaseNotes || 'New improvements and bug fixes.',
        downloadUrl: remotePlatform?.downloadUrl 
          ? (remotePlatform.downloadUrl.startsWith('http') ? remotePlatform.downloadUrl : `${API_BASE_URL}${remotePlatform.downloadUrl}`)
          : `${API_BASE_URL}/downloads/Rivo.${Platform.OS === 'ios' ? 'ipa' : 'apk'}`
      });
      setIsUpdateModalOpen(true);
    }
  };

  const cleanupOldApkInstallers = async () => {
    try {
      const dirs = [FileSystem.cacheDirectory, FileSystem.documentDirectory];
      for (const dir of dirs) {
        if (!dir) continue;
        const normalizedDir = dir.endsWith('/') ? dir : `${dir}/`;
        const files = await FileSystem.readDirectoryAsync(normalizedDir).catch(() => []);
        for (const file of files) {
          const lower = file.toLowerCase();
          if (lower.endsWith('.apk') || lower.endsWith('.ipa') || lower.startsWith('rivo_ota_temp')) {
            await FileSystem.deleteAsync(`${normalizedDir}${file}`, { idempotent: true }).catch(() => {});
          }
        }
      }
    } catch {}
  };

  useEffect(() => {
    initOtaCrashGuard();
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => {});
    }
    cleanupOldApkInstallers();
    checkAppUpdates();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        checkAppUpdates();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onUpdateManifest = (data) => {
      handleRemoteUpdateManifest(data);
    };
    socket.on('app:update_manifest', onUpdateManifest);
    socket.on('app:update_available', onUpdateManifest);
    return () => {
      socket.off('app:update_manifest', onUpdateManifest);
      socket.off('app:update_available', onUpdateManifest);
    };
  }, [socket]);

  const checkAppUpdates = async () => {
    try {
      const token = (await AsyncStorage.getItem('rivo_token')) || (await AsyncStorage.getItem('token')) || currentUser?.token;
      const email = currentUser?.email || '';
      const query = email ? `?email=${encodeURIComponent(email)}` : '';
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${API_BASE_URL}/api/app/version${query}`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      handleRemoteUpdateManifest(data);
    } catch {}
  };

  const isNewerVersion = (remote, current) => {
    try {
      const r = remote.replace(/[^0-9.]/g, '').split('.').map(Number);
      const c = current.replace(/[^0-9.]/g, '').split('.').map(Number);
      for (let i = 0; i < Math.max(r.length, c.length); i++) {
        const rv = r[i] || 0;
        const cv = c[i] || 0;
        if (rv > cv) return true;
        if (rv < cv) return false;
      }
      return false;
    } catch {
      return false;
    }
  };

  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadBytes, setDownloadBytes] = useState({ written: 0, total: 0 });
  const [downloadError, setDownloadError] = useState(null);

  const handleDownloadOta = async () => {
    if (!otaUpdateInfo) return;
    try {
      setIsDownloadingOta(true);
      setOtaError(null);
      setOtaProgress(0);

      const res = await checkAndDownloadOta(otaUpdateInfo, (progress, written, total) => {
        setOtaProgress(progress);
        setOtaBytes({ written, total });
      });

      if (res?.success) {
        setIsOtaReadyToRestart(true);
      }
    } catch (err) {
      console.warn('OTA Download error:', err);
      setOtaError(err?.message || 'Error downloading fast update');
    } finally {
      setIsDownloadingOta(false);
    }
  };

  const handleApplyOtaRestart = async () => {
    try {
      await restartToApplyOta();
    } catch (err) {
      Alert.alert('Notice', 'Please restart Rivo to apply the update.');
      setIsOtaModalOpen(false);
    }
  };

  const handleDownloadAndInstall = async () => {
    if (Platform.OS === 'ios') {
      if (updateInfo?.downloadUrl) {
        Linking.openURL(updateInfo.downloadUrl);
      }
      setIsUpdateModalOpen(false);
      return;
    }

    try {
      setIsDownloadingUpdate(true);
      setDownloadError(null);
      setDownloadProgress(0);

      // Purge all legacy downloaded APKs before starting download
      await cleanupOldApkInstallers();

      const downloadUrl = updateInfo.downloadUrl;
      // Use cacheDirectory to match FileProvider <cache-path name="internal_cache" path="." />
      const targetUri = `${FileSystem.cacheDirectory}Rivo-v${updateInfo.remoteVersion}.apk`;

      // Clean up previous downloaded installer if exists
      try {
        const fileInfo = await FileSystem.getInfoAsync(targetUri);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(targetUri, { idempotent: true });
        }
      } catch (e) {}

      const downloadResumable = FileSystem.createDownloadResumable(
        downloadUrl,
        targetUri,
        {},
        (progress) => {
          const written = progress.totalBytesWritten;
          const total = progress.totalBytesExpectedToWrite;
          setDownloadBytes({ written, total });
          if (total > 0) {
            setDownloadProgress(Math.min(1, written / total));
          }
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (result && result.uri) {
        setDownloadProgress(1);
        try {
          await installApk(result.uri);
          setIsUpdateModalOpen(false);
        } catch (e) {
          console.warn('installApk error:', e);
          const msg = e?.message || 'Could not launch package installer.';
          setDownloadError(msg);
          if (e?.code === 'PERMISSION_REQUIRED') {
            Alert.alert(
              'Permission Required',
              'Please allow Rivo to install apps from this source in the settings page that just opened, then tap update again.'
            );
          } else {
            Alert.alert(
              'Installation Error',
              `${msg}\n\nWould you like to open the download in your browser?`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Browser', onPress: () => Linking.openURL(downloadUrl) }
              ]
            );
          }
        }
      }
    } catch (err) {
      setDownloadError(err.message || 'Download error');
      Alert.alert(
        'Download Failed',
        `${err.message || 'Error downloading update.'}\n\nWould you like to download via browser?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Browser', onPress: () => updateInfo?.downloadUrl && Linking.openURL(updateInfo.downloadUrl) }
        ]
      );
    } finally {
      setIsDownloadingUpdate(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0b1110" />

      {/* ─── 100% PURE NATIVE APP SHELL (NO WEBVIEW) ─── */}
      <View style={styles.modeContainer}>
        <ErrorBoundary>
          <NativeAppShell />
        </ErrorBoundary>
      </View>

      {/* ─── IN-APP AUTO-UPDATE MODAL (Global) ─── */}
      <Modal
        visible={isUpdateModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!isDownloadingUpdate) setIsUpdateModalOpen(false);
        }}
      >
        <View style={styles.updateModalOverlay}>
          <View style={styles.updateModalBox}>
            <View style={styles.updateHeaderRow}>
              <View style={styles.updateBadge}>
                <Text style={styles.updateBadgeText}>UPDATE AVAILABLE</Text>
              </View>
              <Text style={styles.updateTitle}>RIVO v{updateInfo?.remoteVersion}</Text>
            </View>

            <Text style={styles.updateVersionText}>
              Current: v{APP_VERSION} → New: v{updateInfo?.remoteVersion}
            </Text>

            <Text style={styles.updateNotesText}>
              {updateInfo?.releaseNotes}
            </Text>

            {isDownloadingUpdate ? (
              <View style={styles.downloadProgressWrap}>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.round(downloadProgress * 100)}%` },
                    ]}
                  />
                </View>
                <View style={styles.progressInfoRow}>
                  <Text style={styles.progressPctText}>{Math.round(downloadProgress * 100)}%</Text>
                  {downloadBytes.total > 0 && (
                    <Text style={styles.progressMbText}>
                      {(downloadBytes.written / 1024 / 1024).toFixed(1)} MB /{' '}
                      {(downloadBytes.total / 1024 / 1024).toFixed(1)} MB
                    </Text>
                  )}
                </View>
                <Text style={styles.installingNoteText}>
                  {downloadProgress >= 1
                    ? 'Launching package installer...'
                    : 'Downloading APK update directly in app...'}
                </Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.updateDownloadBtn}
                  onPress={handleDownloadAndInstall}
                  activeOpacity={0.85}
                >
                  <Text style={styles.updateDownloadBtnText}>1-CLICK IN-APP UPDATE & INSTALL</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.updateBrowserBtn}
                  onPress={() => {
                    if (updateInfo?.downloadUrl) Linking.openURL(updateInfo.downloadUrl);
                    setIsUpdateModalOpen(false);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.updateBrowserBtnText}>OPEN DOWNLOAD IN BROWSER</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.updateCancelBtn}
                  onPress={() => setIsUpdateModalOpen(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.updateCancelBtnText}>STAY ON CURRENT VERSION</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── IN-APP FAST OTA UPDATE MODAL ─── */}
      <Modal
        visible={isOtaModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          if (!isDownloadingOta) setIsOtaModalOpen(false);
        }}
      >
        <View style={styles.updateModalOverlay}>
          <View style={[styles.updateModalBox, { borderColor: '#17a398' }]}>
            <View style={styles.updateHeaderRow}>
              <View style={[styles.updateBadge, { backgroundColor: '#17a398' }]}>
                <Text style={styles.updateBadgeText}>⚡ FAST OTA UPDATE</Text>
              </View>
              <Text style={styles.updateTitle}>RIVO v{otaUpdateInfo?.version}</Text>
            </View>

            <Text style={[styles.updateVersionText, { fontSize: 13, color: '#17a398' }]}>
              Instant in-app update (~3 MB) • No reinstallation required
            </Text>

            {/* ─── RELEASE NOTES & CHANGELOG BOX ─── */}
            <View style={{ width: '100%', marginBottom: 16 }}>
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#162321',
                  borderWidth: 1,
                  borderColor: '#1f3d38',
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  borderRadius: 8
                }}
                onPress={() => setIsOtaDetailsExpanded(!isOtaDetailsExpanded)}
                activeOpacity={0.8}
              >
                <Text style={{ color: '#17a398', fontSize: 12.5, fontWeight: '700' }}>
                  📋 What's New & Release Notes
                </Text>
                <Text style={{ color: '#94a3b8', fontSize: 11.5, fontWeight: 'bold' }}>
                  {isOtaDetailsExpanded ? '▲ Hide' : '▼ View Details'}
                </Text>
              </TouchableOpacity>

              {isOtaDetailsExpanded && (
                <View style={{
                  marginTop: 6,
                  backgroundColor: '#0c1413',
                  borderWidth: 1,
                  borderColor: '#1e2928',
                  borderRadius: 8,
                  padding: 12
                }}>
                  <ScrollView style={{ maxHeight: 110 }} nestedScrollEnabled={true}>
                    <Text style={{
                      color: '#cbd5e1',
                      fontSize: 12,
                      lineHeight: 18,
                      textAlign: 'left'
                    }}>
                      {otaUpdateInfo?.notesEn || otaUpdateInfo?.notes || 'Instant in-app OTA update • Performance enhancements, smoother audio playback, and bug fixes.'}
                    </Text>
                  </ScrollView>
                </View>
              )}
            </View>

            {isDownloadingOta ? (
              <View style={styles.downloadProgressWrap}>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${Math.round(otaProgress * 100)}%`, backgroundColor: '#17a398' },
                    ]}
                  />
                </View>
                <View style={styles.progressInfoRow}>
                  <Text style={styles.progressPctText}>{Math.round(otaProgress * 100)}%</Text>
                  {otaBytes.total > 0 && (
                    <Text style={styles.progressMbText}>
                      {(otaBytes.written / 1024 / 1024).toFixed(1)} MB /{' '}
                      {(otaBytes.total / 1024 / 1024).toFixed(1)} MB
                    </Text>
                  )}
                </View>
                <Text style={styles.installingNoteText}>
                  Downloading fast update in background...
                </Text>
              </View>
            ) : isOtaReadyToRestart ? (
              <>
                <View style={{ backgroundColor: 'rgba(23,163,152,0.15)', padding: 12, borderRadius: 8, marginBottom: 14 }}>
                  <Text style={{ color: '#17a398', fontSize: 13, fontWeight: '700', textAlign: 'center' }}>
                    ✅ Update ready! Tap below to restart & apply immediately.
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.updateDownloadBtn, { backgroundColor: '#17a398' }]}
                  onPress={handleApplyOtaRestart}
                  activeOpacity={0.85}
                >
                  <Text style={styles.updateDownloadBtnText}>🚀 RESTART & APPLY UPDATE</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.updateCancelBtn}
                  onPress={() => setIsOtaModalOpen(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.updateCancelBtnText}>APPLY ON NEXT LAUNCH</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {otaError && (
                  <Text style={{ color: '#ef4444', fontSize: 12, marginBottom: 10, textAlign: 'center' }}>
                    {otaError}
                  </Text>
                )}

                <TouchableOpacity
                  style={styles.updateDownloadBtn}
                  onPress={handleDownloadOta}
                  activeOpacity={0.85}
                >
                  <Text style={styles.updateDownloadBtnText}>⚡ FAST UPDATE NOW (2 SECONDS)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.updateCancelBtn}
                  onPress={() => setIsOtaModalOpen(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.updateCancelBtnText}>REMIND ME LATER</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/**
 * NativeAppShell
 *
 * Native React Native UI for Offline Vault, Quran, and local storage playback.
 */
function NativeAppShell() {
  const { appMode, setAppMode } = useConnectivity();
  const [activeTab, setActiveTab] = useState('home');
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const [actionTrack, setActionTrack] = useState(null);
  const [playlistTrack, setPlaylistTrack] = useState(null);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isJamOpen, setIsJamOpen] = useState(false);
  const [isFriendActivityOpen, setIsFriendActivityOpen] = useState(false);
  const [isIntroAuthOpen, setIsIntroAuthOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [chatTargetUser, setChatTargetUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);

  const { currentTrack } = useAudioPlayer();
  const { currentUser, isAuthLoaded } = useUser();
  const { isDark, toggleTheme } = useTheme();
  const { socket } = useSocket();
  const { showToast } = useToast();

  const currentChatRef = useRef({ isChatOpen: false, chatTargetUser: null });
  useEffect(() => {
    currentChatRef.current = { isChatOpen, chatTargetUser };
  }, [isChatOpen, chatTargetUser]);

  // Real-time chat notification banner with 1-click direct navigation to friend's chat
  useEffect(() => {
    if (!socket) return;
    const handleIncomingChatMessage = (msg) => {
      if (!msg) return;
      const myId = String(currentUser?._id || currentUser?.id || '');
      const senderId = String(msg.sender?._id || msg.sender || msg.senderId || '');
      const recipientId = String(msg.recipient?._id || msg.recipient || msg.recipientId || '');

      // Don't toast if the message is from me
      if (senderId && myId && senderId === myId) return;
      // Don't toast if recipient is specified and not for me
      if (recipientId && myId && recipientId !== myId) return;

      const senderName = msg.senderName || msg.sender?.name || 'Friend';
      const senderAvatar = msg.senderAvatar || msg.sender?.avatar || '';
      const text = msg.text || (msg.track ? `Shared song: ${msg.track.title || 'a track'}` : (msg.jamInvite ? 'Invited you to a Jam Session' : 'Sent an attachment'));

      const targetUser = {
        _id: senderId,
        id: senderId,
        name: senderName,
        avatar: senderAvatar,
      };

      // Don't show toast if already chatting with this sender
      const { isChatOpen: chatOpen, chatTargetUser: activeChatUser } = currentChatRef.current;
      if (chatOpen && activeChatUser && String(activeChatUser._id || activeChatUser.id) === senderId) {
        return;
      }

      showToast(text, 'chat', {
        title: senderName,
        avatar: senderAvatar,
        onPress: () => {
          setIsFullPlayerOpen(false);
          setIsJamOpen(false);
          setChatTargetUser(targetUser);
          setIsChatOpen(true);
        }
      });
    };

    socket.on('chat:message', handleIncomingChatMessage);
    socket.on('new_chat_message', handleIncomingChatMessage);
    return () => {
      socket.off('chat:message', handleIncomingChatMessage);
      socket.off('new_chat_message', handleIncomingChatMessage);
    };
  }, [socket, currentUser, showToast]);

  // Handle opening direct chat when tapping an Android system notification
  const handleOpenChatFromNotification = useCallback((data) => {
    if (!data) return;
    const senderId = typeof data === 'string' ? data : (data?.senderId || data?.sender);
    if (!senderId) return;
    setIsFullPlayerOpen(false);
    setIsJamOpen(false);
    setChatTargetUser({
      _id: senderId,
      id: senderId,
      name: data?.senderName || 'Friend',
      avatar: data?.senderAvatar || ''
    });
    setIsChatOpen(true);
  }, []);

  useEffect(() => {
    // 1. Cold start / initial launch from notification
    getInitialChatSenderId().then((senderId) => {
      if (senderId) {
        handleOpenChatFromNotification(senderId);
      }
    }).catch(() => {});

    // 2. Active app runtime notification tap
    const unsubscribe = subscribeToChatNotification((data) => {
      handleOpenChatFromNotification(data);
    });

    // 3. Resume from background
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        getInitialChatSenderId().then((senderId) => {
          if (senderId) {
            handleOpenChatFromNotification(senderId);
          }
        }).catch(() => {});
      }
    });

    return () => {
      unsubscribe();
      appStateSub.remove();
    };
  }, [handleOpenChatFromNotification]);

  // Launch login / register prompt for unauthenticated users, exactly matching the iOS IPA
  const hasPromptedAuthOnLaunchRef = useRef(false);
  useEffect(() => {
    if (isAuthLoaded && !hasPromptedAuthOnLaunchRef.current) {
      hasPromptedAuthOnLaunchRef.current = true;
      if (!currentUser) {
        setIsIntroAuthOpen(true);
      }
    }
  }, [isAuthLoaded, currentUser]);

  const handleTabPress = (tabId) => {
    if (tabId === 'chat') {
      setIsChatOpen(true);
    } else {
      setActiveTab(tabId);
    }
  };

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'search':
        return (
          <SearchScreen
            onTrackAction={(track) => setActionTrack(track)}
            onOpenChat={(target) => {
              if (target) setChatTargetUser(target);
              setIsChatOpen(true);
            }}
            onOpenFullPlayer={() => setIsFullPlayerOpen(true)}
          />
        );
      case 'library':
        return (
          <LibraryScreen
            onOpenCreatePlaylist={() => setIsCreatePlaylistOpen(true)}
            onNavigateOffline={() => setActiveTab('offline')}
            onTrackAction={(track) => setActionTrack(track)}
          />
        );
      case 'quran':
        return <QuranScreen onTrackAction={(track) => setActionTrack(track)} />;
      case 'profile':
        return (
          <ProfileScreen
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenAuth={() => setIsIntroAuthOpen(true)}
            onOpenFriendActivity={() => setIsFriendActivityOpen(true)}
            onOpenJam={() => setIsJamOpen(true)}
            onOpenChat={(target) => {
              if (target) setChatTargetUser(target);
              setIsChatOpen(true);
            }}
            onSelectPlaylist={() => setActiveTab('library')}
            onOpenFullPlayer={() => setIsFullPlayerOpen(true)}
          />
        );
      case 'stats':
        return <StatsScreen />;
      case 'offline':
        return <OfflineScreen />;
      case 'admin':
        return <AdminScreen />;
      default:
        return (
          <HomeScreen
            onOpenAddSong={() => setIsAddSongOpen(true)}
            onTrackAction={(track) => setActionTrack(track)}
            onOpenFullPlayer={() => setIsFullPlayerOpen(true)}
          />
        );
    }
  };

  return (
    <View style={[styles.offlineShell, !isDark && styles.offlineShellLight]}>
      <View style={[styles.topHeader, !isDark && styles.topHeaderLight]}>
        {/* Brand Logo: [Icon] RIVO v1.5.0 */}
        <TouchableOpacity
          style={styles.brandingRow}
          onPress={() => setActiveTab('home')}
          activeOpacity={0.8}
        >
          <Image
            source={require('./assets/logo.png')}
            style={{ width: 28, height: 28, borderRadius: 14, marginRight: 6 }}
            resizeMode="contain"
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.brandTitle, !isDark && styles.brandTitleLight]}>RIVO</Text>
            <View style={{ backgroundColor: 'rgba(23,163,152,0.18)', borderWidth: 1, borderColor: '#17a398', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
              <Text style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: '900', color: '#17a398' }}>v{APP_VERSION}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Right Actions: Sun/Moon, Menu (☰), User Avatar */}
        <View style={styles.topActions}>
          {/* Sun / Moon (Theme toggle) */}
          <TouchableOpacity
            style={[styles.topIconBtn, !isDark && styles.topIconBtnLight]}
            onPress={toggleTheme}
            activeOpacity={0.8}
          >
            {isDark ? (
              <Sun size={15} color="#f59e0b" strokeWidth={2.5} />
            ) : (
              <Moon size={15} color="#0b1110" strokeWidth={2.5} />
            )}
          </TouchableOpacity>

          {/* Menu Drawer Toggle (☰ 3 bars) */}
          <TouchableOpacity
            style={styles.topIconBtn}
            onPress={() => setIsMenuOpen(true)}
            activeOpacity={0.8}
          >
            <Menu size={16} color="#ffffff" strokeWidth={2.5} />
          </TouchableOpacity>

          {/* User Profile Avatar / Sign In */}
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => {
              if (currentUser) {
                setActiveTab('profile');
              } else {
                setIsIntroAuthOpen(true);
              }
            }}
            activeOpacity={0.8}
          >
            {currentUser?.avatar ? (
              <Image source={{ uri: currentUser.avatar }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarLetter}>
                {currentUser?.name ? currentUser.name[0].toUpperCase() : 'R'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ─────────────────────────────────────────
          ACTIVE SCREEN
          ───────────────────────────────────────── */}
      <View style={[styles.screenContainer, !isDark && styles.screenContainerLight]}>
        {renderActiveScreen()}
      </View>

      {/* ─────────────────────────────────────────
          FLOATING MINI PLAYER
          ───────────────────────────────────────── */}
      {currentTrack && (
        <MiniPlayer onOpenFullPlayer={() => setIsFullPlayerOpen(true)} />
      )}

      {/* ─────────────────────────────────────────
          BOTTOM NAVIGATION BAR (5 Tabs)
          Active tab highlighted with teal pill
          ───────────────────────────────────────── */}
      <View style={[styles.bottomBar, !isDark && styles.bottomBarLight]}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              onPress={() => handleTabPress(tab.id)}
              activeOpacity={0.8}
            >
              <Icon
                size={18}
                color={active ? '#0b1110' : (!isDark ? '#57534e' : '#94a3b8')}
                strokeWidth={active ? 2.8 : 2}
              />
              <Text style={[styles.tabLabel, !isDark && styles.tabLabelLight, active && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ─────────────────────────────────────────
          QUICK TOOLS & SHORTCUTS MENU DRAWER
          ───────────────────────────────────────── */}
      <Modal
        visible={isMenuOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsMenuOpen(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setIsMenuOpen(false)}
        >
          <View style={styles.menuSheet}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>RIVO MENU</Text>
              <TouchableOpacity onPress={() => setIsMenuOpen(false)}>
                <X size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>

            {/* Category: Community & Live */}
            <View style={styles.menuSection}>
              <Text style={styles.menuSectionHeader}>COMMUNITY & LIVE</Text>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  setIsFriendActivityOpen(true);
                }}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(23,163,152,0.18)' }]}>
                  <Users size={15} color="#17a398" strokeWidth={2.4} />
                </View>
                <Text style={styles.menuItemText}>Friend Activity</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  setIsJamOpen(true);
                }}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(245,158,11,0.18)' }]}>
                  <Radio size={15} color="#f59e0b" strokeWidth={2.4} />
                </View>
                <Text style={styles.menuItemText}>Live Jam Room</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  setIsChatOpen(true);
                }}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(56,189,248,0.18)' }]}>
                  <MessageSquare size={15} color="#38bdf8" strokeWidth={2.4} />
                </View>
                <Text style={styles.menuItemText}>Messages & Chat</Text>
              </TouchableOpacity>
            </View>

            {/* Category: Music & Library */}
            <View style={styles.menuSection}>
              <Text style={styles.menuSectionHeader}>LIBRARY & STATS</Text>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  setActiveTab('profile');
                }}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(16,185,129,0.18)' }]}>
                  <User size={15} color="#10b981" />
                </View>
                <Text style={styles.menuItemText}>My Profile</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  setActiveTab('stats');
                }}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(245,158,11,0.18)' }]}>
                  <Activity size={15} color="#f59e0b" />
                </View>
                <Text style={styles.menuItemText}>Listening Stats</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  setActiveTab('offline');
                }}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(56,189,248,0.18)' }]}>
                  <Download size={15} color="#38bdf8" />
                </View>
                <Text style={styles.menuItemText}>Offline Vault</Text>
              </TouchableOpacity>
            </View>

            {/* Category: System */}
            <View style={styles.menuSection}>
              <Text style={styles.menuSectionHeader}>PREFERENCES</Text>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  setIsSettingsOpen(true);
                }}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(237,229,211,0.15)' }]}>
                  <SettingsIcon size={15} color="#ede5d3" />
                </View>
                <Text style={styles.menuItemText}>Settings</Text>
              </TouchableOpacity>

              {(currentUser?.role === 'admin' || currentUser?.email?.includes('admin')) && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setIsMenuOpen(false);
                    setActiveTab('admin');
                  }}
                >
                  <View style={[styles.menuIconWrap, { backgroundColor: 'rgba(220,38,38,0.18)' }]}>
                    <Shield size={15} color="#dc2626" />
                  </View>
                  <Text style={styles.menuItemText}>Admin Portal</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Version Information Footer */}
            <View style={styles.menuFooter}>
              <Text style={styles.menuFooterVersion}>{FULL_VERSION}</Text>
              <Text style={styles.menuFooterSub}>Rivo Music Streaming</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─────────────────────────────────────────
          MODALS
          ───────────────────────────────────────── */}
      <FullPlayerModal
        visible={isFullPlayerOpen}
        onClose={() => setIsFullPlayerOpen(false)}
        onTrackAction={(track) => setActionTrack(track)}
      />

      <TrackActionMenuModal
        visible={!!actionTrack}
        track={actionTrack}
        onClose={() => setActionTrack(null)}
        onOpenAddToPlaylist={(track) => setPlaylistTrack(track)}
      />

      <PlaylistPickerModal
        visible={!!playlistTrack}
        track={playlistTrack}
        onClose={() => setPlaylistTrack(null)}
      />

      <CreatePlaylistModal
        visible={isCreatePlaylistOpen}
        onClose={() => setIsCreatePlaylistOpen(false)}
        onSuccess={() => setIsCreatePlaylistOpen(false)}
      />

      <AddSongModal
        visible={isAddSongOpen}
        onClose={() => setIsAddSongOpen(false)}
        onSuccess={() => setIsAddSongOpen(false)}
      />

      <ChatModal
        visible={isChatOpen}
        onClose={() => {
          setIsChatOpen(false);
          setChatTargetUser(null);
        }}
        initialTargetUser={chatTargetUser}
        onOpenJam={() => {
          setIsChatOpen(false);
          setIsJamOpen(true);
        }}
        onViewProfile={(target) => {
          setIsChatOpen(false);
          const myId = currentUser?._id || currentUser?.id;
          const targetId = target?._id || target?.id;
          if (targetId && myId && String(targetId) === String(myId)) {
            setActiveTab('profile');
          } else {
            setViewingUser(target);
          }
        }}
      />

      <UserDetailModal
        visible={Boolean(viewingUser)}
        user={viewingUser}
        userId={viewingUser?._id || viewingUser?.id}
        onClose={() => setViewingUser(null)}
        onOpenChat={(target) => {
          setViewingUser(null);
          setChatTargetUser(target);
          setIsChatOpen(true);
        }}
        onOpenJam={() => {
          setViewingUser(null);
          setIsJamOpen(true);
        }}
        onOpenFullPlayer={() => setIsFullPlayerOpen(true)}
      />

      <SettingsModal
        visible={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <JamRoomModal
        visible={isJamOpen}
        onClose={() => setIsJamOpen(false)}
      />

      <FriendActivityModal
        visible={isFriendActivityOpen}
        onClose={() => setIsFriendActivityOpen(false)}
      />

      <IntroAuthModal
        visible={isIntroAuthOpen}
        onClose={() => setIsIntroAuthOpen(false)}
      />
    </View>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ConnectivityProvider>
          <UserProvider>
            <ToastProvider>
              <AudioProvider>
                <SocketProvider>
                  <MainAppShell />
                </SocketProvider>
              </AudioProvider>
            </ToastProvider>
          </UserProvider>
        </ConnectivityProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0b1110',
  },
  // ─── Mode routing containers ───
  modeContainer: {
    flex: 1,
  },
  hiddenMode: {
    // Keep mounted but invisible (height 0, overflow hidden)
    flex: 0,
    height: 0,
    overflow: 'hidden',
  },
  offlineShell: {
    flex: 1,
    backgroundColor: '#0b1110',
  },
  offlineShellLight: {
    backgroundColor: '#fdfbf7',
  },
  topHeader: {
    height: 52,
    backgroundColor: '#0b1110',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a2624',
  },
  topHeaderLight: {
    backgroundColor: '#ede5d3',
    borderBottomColor: '#d6c8b0',
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoBadge: {
    width: 28,
    height: 28,
    position: 'relative',
  },
  logoTealOffset: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: -2,
    bottom: -2,
    borderRadius: 14,
    backgroundColor: '#17a398',
    borderWidth: 1,
    borderColor: '#0b1110',
  },
  logoCreamDisc: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    backgroundColor: '#fdfbf7',
    borderWidth: 1.5,
    borderColor: '#0b1110',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    fontWeight: '900',
    fontSize: 15,
    color: '#0b1110',
  },
  brandTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  brandTitleLight: {
    color: '#0b1110',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  topIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#182321',
    borderWidth: 1,
    borderColor: '#263330',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topIconBtnLight: {
    backgroundColor: '#e2d7c0',
    borderColor: '#cfc1a5',
  },
  avatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#17a398',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarLetter: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0b1110',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#0b1110',
  },
  screenContainerLight: {
    backgroundColor: '#fdfbf7',
  },
  bottomBar: {
    height: 56,
    backgroundColor: '#0b1110',
    borderTopWidth: 1,
    borderTopColor: '#1a2624',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    width: '100%',
    maxWidth: 680,
    alignSelf: 'center',
  },
  bottomBarLight: {
    backgroundColor: '#ede5d3',
    borderTopColor: '#d6c8b0',
  },
  tabBtn: {
    flex: 1,
    maxWidth: 120,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginHorizontal: 2,
  },
  tabBtnActive: {
    backgroundColor: '#17a398',
  },
  tabLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94a3b8',
    marginTop: 2,
  },
  tabLabelLight: {
    color: '#78716c',
  },
  tabLabelActive: {
    color: '#0b1110',
    fontWeight: '900',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 54,
    paddingRight: 14,
  },
  menuSheet: {
    width: 224,
    backgroundColor: '#0f1716',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1e2e2a',
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1e2e2a',
    paddingBottom: 8,
    marginBottom: 6,
  },
  menuTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#17a398',
    letterSpacing: 1,
    fontFamily: 'monospace',
  },
  menuSection: {
    marginBottom: 6,
  },
  menuSectionHeader: {
    fontSize: 8.5,
    fontFamily: 'monospace',
    fontWeight: '900',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 3,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 5,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  menuIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fdfbf7',
  },
  headerModePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#141d1b',
    borderWidth: 1.5,
    borderColor: '#17a398',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
  },
  headerModePillText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 9,
    color: '#17a398',
    letterSpacing: 0.5,
  },
  onlineFixedHeader: {
    height: 44,
    backgroundColor: '#0b1110',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#162220',
  },
  onlineFixedModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#101d1a',
    borderWidth: 1.2,
    borderColor: '#10b981',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  onlineStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  onlineFixedModeBtnText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 9.5,
    color: '#10b981',
    letterSpacing: 0.5,
  },
  vaultPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#141d1b',
    borderWidth: 1,
    borderColor: '#1e332f',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  vaultPillText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 9,
    color: '#17a398',
    letterSpacing: 0.5,
  },
  menuFooter: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1e332f',
    alignItems: 'center',
  },
  menuFooterVersion: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 11,
    color: '#17a398',
    letterSpacing: 0.5,
  },
  menuFooterSub: {
    fontFamily: 'monospace',
    fontSize: 9,
    color: '#64748b',
    marginTop: 2,
  },
  updateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  updateModalBox: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0e1716',
    borderWidth: 2,
    borderColor: '#17a398',
    borderRadius: 8,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 0,
    elevation: 8,
  },
  updateHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  updateBadge: {
    backgroundColor: '#17a398',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  updateBadgeText: {
    color: '#0b1110',
    fontWeight: '900',
    fontFamily: 'monospace',
    fontSize: 10,
  },
  updateTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  updateVersionText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#17a398',
    fontWeight: '700',
    marginBottom: 10,
  },
  updateNotesText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 20,
  },
  updateDownloadBtn: {
    backgroundColor: '#17a398',
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 10,
  },
  updateDownloadBtnText: {
    color: '#0b1110',
    fontWeight: '900',
    fontFamily: 'monospace',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  updateCancelBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  updateCancelBtnText: {
    color: '#94a3b8',
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
  },
  updateBrowserBtn: {
    backgroundColor: '#162321',
    borderWidth: 1,
    borderColor: '#17a398',
    paddingVertical: 10,
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 8,
  },
  updateBrowserBtnText: {
    color: '#17a398',
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  downloadProgressWrap: {
    paddingVertical: 10,
    marginBottom: 8,
  },
  progressBarTrack: {
    height: 10,
    backgroundColor: '#1a2624',
    borderRadius: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2d3748',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#17a398',
    borderRadius: 4,
  },
  progressInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressPctText: {
    color: '#17a398',
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 13,
  },
  progressMbText: {
    color: '#94a3b8',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  installingNoteText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginTop: 4,
  },
});
