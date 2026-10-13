import React, { useState, useEffect } from 'react';
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
import { ToastProvider } from './src/native/context/ToastContext';
import { AudioProvider, useAudioPlayer } from './src/native/context/AudioContext';
import { SocketProvider } from './src/native/context/SocketContext';
import { ConnectivityProvider, useConnectivity } from './src/native/context/ConnectivityContext';
import { ThemeProvider, useTheme } from './src/native/context/ThemeContext';
import { colors } from './src/native/theme/colors';
import { APP_VERSION, FULL_VERSION } from './src/native/version';
import { API_BASE_URL } from './src/native/config';

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
import AddSongModal from './src/native/components/AddSongModal';
import ChatModal from './src/native/components/ChatModal';
import SettingsModal from './src/native/components/SettingsModal';
import JamRoomModal from './src/native/components/JamRoomModal';
import FriendActivityModal from './src/native/components/FriendActivityModal';
import IntroAuthModal from './src/native/components/IntroAuthModal';

const TABS = [
  { id: 'offline', label: 'Vault', icon: Download },
  { id: 'quran', label: 'Quran', icon: BookOpen },
  { id: 'library', label: 'Library', icon: Disc },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'home', label: 'Home', icon: Home },
];

function MainAppShell() {
  const { appMode } = useConnectivity();
  const isOnline = appMode === 'online';
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => {});
    }
    checkAppUpdates();
  }, []);

  const checkAppUpdates = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/app/version`);
      if (!res.ok) return;
      const data = await res.json();
      const currentPlatform = Platform.OS === 'ios' ? 'ios' : 'android';
      const remotePlatform = data?.platforms?.[currentPlatform];
      const remoteVersion = remotePlatform?.version || data?.version;

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
        onRequestClose={() => setIsUpdateModalOpen(false)}
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

            <TouchableOpacity
              style={styles.updateDownloadBtn}
              onPress={() => {
                if (updateInfo?.downloadUrl) {
                  Linking.openURL(updateInfo.downloadUrl);
                }
                setIsUpdateModalOpen(false);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.updateDownloadBtnText}>DOWNLOAD UPDATE NOW</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.updateCancelBtn}
              onPress={() => setIsUpdateModalOpen(false)}
              activeOpacity={0.85}
            >
              <Text style={styles.updateCancelBtnText}>STAY ON CURRENT VERSION</Text>
            </TouchableOpacity>
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
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isJamOpen, setIsJamOpen] = useState(false);
  const [isFriendActivityOpen, setIsFriendActivityOpen] = useState(false);
  const [isIntroAuthOpen, setIsIntroAuthOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [chatTargetUser, setChatTargetUser] = useState(null);

  const { currentTrack } = useAudioPlayer();
  const { currentUser } = useUser();
  const { isDark, toggleTheme } = useTheme();

  // First launch auto-intro for guests
  useEffect(() => {
    AsyncStorage.getItem('@rivo_intro_seen_v15').then((seen) => {
      if (!seen && !currentUser) {
        setIsIntroAuthOpen(true);
        AsyncStorage.setItem('@rivo_intro_seen_v15', 'true').catch(() => {});
      }
    }).catch(() => {});
  }, [currentUser]);

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
        return <SearchScreen onTrackAction={(track) => setActionTrack(track)} />;
      case 'library':
        return (
          <LibraryScreen
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
              <Text style={styles.menuTitle}>RIVO TOOLS</Text>
              <TouchableOpacity onPress={() => setIsMenuOpen(false)}>
                <X size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setIsMenuOpen(false);
                setIsFriendActivityOpen(true);
              }}
            >
              <Users size={18} color="#17a398" strokeWidth={2.4} />
              <Text style={styles.menuItemText}>Friend Activity Radar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setIsMenuOpen(false);
                setIsJamOpen(true);
              }}
            >
              <Radio size={18} color="#f59e0b" strokeWidth={2.4} />
              <Text style={styles.menuItemText}>Live Jam Room</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setIsMenuOpen(false);
                setIsChatOpen(true);
              }}
            >
              <MessageSquare size={18} color="#38bdf8" strokeWidth={2.4} />
              <Text style={styles.menuItemText}>Direct Messages / Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setIsMenuOpen(false);
                setActiveTab('profile');
              }}
            >
              <User size={18} color="#10b981" />
              <Text style={styles.menuItemText}>My Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setIsMenuOpen(false);
                setActiveTab('stats');
              }}
            >
              <Activity size={18} color="#f59e0b" />
              <Text style={styles.menuItemText}>Stats & History</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setIsMenuOpen(false);
                setActiveTab('offline');
              }}
            >
              <Download size={18} color="#38bdf8" />
              <Text style={styles.menuItemText}>Offline Vault</Text>
            </TouchableOpacity>

            {(currentUser?.role === 'admin' || currentUser?.email?.includes('admin')) && (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  setActiveTab('admin');
                }}
              >
                <Shield size={18} color="#dc2626" />
                <Text style={styles.menuItemText}>Admin Console</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setIsMenuOpen(false);
                setIsSettingsOpen(true);
              }}
            >
              <SettingsIcon size={18} color="#ede5d3" />
              <Text style={styles.menuItemText}>Settings</Text>
            </TouchableOpacity>

            {/* Version Information Footer */}
            <View style={styles.menuFooter}>
              <Text style={styles.menuFooterVersion}>{FULL_VERSION}</Text>
              <Text style={styles.menuFooterSub}>Sonic Dispensary • Pure Sound Relief</Text>
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
  },
  bottomBarLight: {
    backgroundColor: '#ede5d3',
    borderTopColor: '#d6c8b0',
  },
  tabBtn: {
    flex: 1,
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
    width: 200,
    backgroundColor: '#141d1b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#263330',
    padding: 12,
  },
  menuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#263330',
    paddingBottom: 8,
    marginBottom: 8,
  },
  menuTitle: {
    fontSize: 12,
    fontWeight: '900',
    color: '#17a398',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: 6,
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
});
