import { LOGO_BASE64 } from './src/native/assets/logoBase64';
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
  BackHandler,
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
import { installApk, getInitialChatSenderId, subscribeToChatNotification, exitAndRemoveTask, hasNativeProcessRestart } from './src/native/services/mediaControls';
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
import MobileModals from './src/native/components/MobileModals';
import { styles } from './src/native/theme/appStyles';

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
  const [activeOtaVersion, setActiveOtaVersion] = useState(null);

  useEffect(() => {
    getCurrentOtaVersion().then(v => {
      if (v) setActiveOtaVersion(v);
    }).catch(() => {});
  }, []);

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
      const isBetaTester = isAdmin || BETA_TESTER_EMAILS.includes(userEmail) || APP_VERSION.startsWith('1.9.6');
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
        const activeRunningVersion = (currentOta && isNewerVersion(currentOta, APP_VERSION)) ? currentOta : APP_VERSION;
        
        // If client is already running latest version (via active OTA or base APK), do nothing!
        if (activeRunningVersion && !isNewerVersion(ota.version, activeRunningVersion) && !isNewerVersion(remoteVersion, activeRunningVersion)) {
          return;
        }

        const isOtaNewer = isNewerVersion(ota.version, activeRunningVersion);
        const isBaseCompatible = !ota.minAppVersion || !isNewerVersion(ota.minAppVersion, APP_VERSION);

        if (isOtaNewer && isBaseCompatible) {
          setOtaUpdateInfo({
            enabled: true,
            version: ota.version,
            notes: ota.notes || remotePlatform?.notes || 'تحديث هوائي سريع فوري بدون إعادة تثبيت التطبيق • إصلاحات في الأداء وسرعة الاستجابة',
            notesEn: ota.notesEn || ota.notes_en || 'Instant in-app OTA update • Performance enhancements, smoother audio playback, and bug fixes.',
            bundleUrl: ota.bundleUrl.startsWith('http') ? ota.bundleUrl : `${API_BASE_URL}${ota.bundleUrl}`,
            minAppVersion: ota.minAppVersion,
            bundleSize: ota.bundleSize,
            sizeMb: ota.sizeMb || (ota.bundleSize ? `${(ota.bundleSize / 1048576).toFixed(2)} MB` : null)
          });
          setIsOtaModalOpen(true);
          return; // Handled via lightweight OTA!
        }
      } catch (e) {
        console.warn('OTA manifest check error:', e);
      }
    }

    // ─── 2. Fallback to full binary update (APK / IPA) ───
    const currentOta = await getCurrentOtaVersion().catch(() => null);
    const activeVersion = (currentOta && isNewerVersion(currentOta, APP_VERSION)) ? currentOta : APP_VERSION;

    if (remoteVersion && isNewerVersion(remoteVersion, activeVersion)) {
      setUpdateInfo({
        remoteVersion,
        releaseNotes: remotePlatform?.notesEn || remotePlatform?.notes || data?.releaseNotes || 'New improvements and bug fixes.',
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

  useEffect(() => {
    if (currentUser?.email) {
      checkAppUpdates();
    }
  }, [currentUser?.email]);

  const checkAppUpdates = async () => {
    try {
      const token = (await AsyncStorage.getItem('rivo_token')) || (await AsyncStorage.getItem('token')) || currentUser?.token;
      let email = (currentUser?.email || '').trim().toLowerCase();
      if (!email) {
        try {
          const cachedUserStr = (await AsyncStorage.getItem('rivo_user')) || (await AsyncStorage.getItem('user'));
          if (cachedUserStr) {
            const cachedUser = JSON.parse(cachedUserStr);
            email = (cachedUser?.email || '').trim().toLowerCase();
          }
        } catch {}
      }
      const params = new URLSearchParams();
      if (email) params.set('email', email);
      params.set('currentVersion', APP_VERSION);
      params.set('platform', Platform.OS);
      const query = `?${params.toString()}`;
      const headers = {
        'x-app-version': APP_VERSION,
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      };
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
        if (res.version) setActiveOtaVersion(res.version);
      } else if (res?.reason === 'already_up_to_date') {
        Alert.alert('محدث بالفعل', 'تطبيق ريفو محدث بالفعل لآخر إصدار هوائي.');
        setIsOtaModalOpen(false);
      } else {
        setOtaError(res?.reason || 'تعذر استكمال التحديث');
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
      setIsOtaModalOpen(false);

      // Check if native APK supports AlarmManager rebirth & exitAndRemoveTask
      const hasNativeColdRestart = hasNativeProcessRestart();

      if (hasNativeColdRestart) {
        // Modern APK: schedule clean reboot and terminate process
        await restartToApplyOta().catch(() => {});
        return;
      }

      // Legacy base APK fallback:
      Alert.alert(
        'تم تثبيت التحديث بنجاح! 🎉',
        'لتفعيل التحديث على هذا الإصدار:\nيرجى مسح التطبيق من شاشة التطبيقات الحديثة (Recent Apps) ثم إعادة فتحه ليتم تحميل الإصدار الجديد فوراً.',
        [
          {
            text: 'إغلاق التطبيق الآن',
            onPress: () => {
              if (Platform.OS === 'android') {
                BackHandler.exitApp();
              }
            }
          },
          {
            text: 'لاحقاً',
            style: 'cancel'
          }
        ],
        { cancelable: false }
      );
    } catch (err) {
      if (Platform.OS === 'android') {
        BackHandler.exitApp();
      }
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
              Current: v{(typeof activeOtaVersion !== 'undefined' && activeOtaVersion) ? activeOtaVersion : APP_VERSION} → New: v{updateInfo?.remoteVersion}
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
              Instant in-app update {otaUpdateInfo?.sizeMb ? `(${otaUpdateInfo.sizeMb})` : (otaUpdateInfo?.bundleSize ? `(${(otaUpdateInfo.bundleSize / 1048576).toFixed(2)} MB)` : '')} • No reinstallation required
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
  const [activeOtaVersion, setActiveOtaVersion] = useState(null);

  useEffect(() => {
    getCurrentOtaVersion().then(v => {
      if (v) setActiveOtaVersion(v);
    }).catch(() => {});
  }, []);
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
          <View style={styles.logoBadge}>
            <View style={styles.logoTealOffset} />
            <View style={styles.logoWhiteDisc}>
              <Text style={styles.logoLetter}>R</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.brandTitle, !isDark && styles.brandTitleLight]}>RIVO</Text>
            <View style={{ backgroundColor: 'rgba(23,163,152,0.18)', borderWidth: 1, borderColor: '#17a398', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
              <Text style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: '900', color: '#17a398' }}>v{(typeof activeOtaVersion !== 'undefined' && activeOtaVersion) ? activeOtaVersion : APP_VERSION}</Text>
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

      {/* ── Mobile Modals ── */}
      <MobileModals
        isFullPlayerOpen={isFullPlayerOpen}
        setIsFullPlayerOpen={setIsFullPlayerOpen}
        actionTrack={actionTrack}
        setActionTrack={setActionTrack}
        playlistTrack={playlistTrack}
        setPlaylistTrack={setPlaylistTrack}
        isCreatePlaylistOpen={isCreatePlaylistOpen}
        setIsCreatePlaylistOpen={setIsCreatePlaylistOpen}
        isAddSongOpen={isAddSongOpen}
        setIsAddSongOpen={setIsAddSongOpen}
        isChatOpen={isChatOpen}
        setIsChatOpen={setIsChatOpen}
        chatTargetUser={chatTargetUser}
        setChatTargetUser={setChatTargetUser}
        isJamOpen={isJamOpen}
        setIsJamOpen={setIsJamOpen}
        viewingUser={viewingUser}
        setViewingUser={setViewingUser}
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
        isFriendActivityOpen={isFriendActivityOpen}
        setIsFriendActivityOpen={setIsFriendActivityOpen}
        isIntroAuthOpen={isIntroAuthOpen}
        setIsIntroAuthOpen={setIsIntroAuthOpen}
        currentUser={currentUser}
        setActiveTab={setActiveTab}
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
