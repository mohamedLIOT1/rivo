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
} from 'react-native';
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
  Shield,
  User,
} from 'lucide-react-native';

import { UserProvider, useUser } from './src/native/context/UserContext';
import { ToastProvider } from './src/native/context/ToastContext';
import { AudioProvider, useAudioPlayer } from './src/native/context/AudioContext';
import { SocketProvider } from './src/native/context/SocketContext';
import { ConnectivityProvider, useConnectivity } from './src/native/context/ConnectivityContext';
import { ThemeProvider, useTheme } from './src/native/context/ThemeContext';
import { colors } from './src/native/theme/colors';

import OnlineWebView from './src/native/screens/OnlineWebView';
import ModeToggle from './src/native/components/ModeToggle';
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

const TABS = [
  { id: 'offline', label: 'Offline', icon: Download },
  { id: 'home', label: 'Home', icon: Home },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'library', label: 'Library', icon: Disc },
  { id: 'quran', label: 'Quran', icon: BookOpen },
];

function MainAppShell() {
  const { appMode } = useConnectivity();
  const isOnline = appMode === 'online';

  useEffect(() => {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => {});
    }
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0b1110" />

      {/* ─── ONLINE MODE: WebView (stays mounted, hidden when offline) ─── */}
      <View style={[styles.modeContainer, !isOnline && styles.hiddenMode]}>
        <OnlineWebView />
      </View>

      {/* ─── OFFLINE MODE: Native React Native UI ─── */}
      <View style={[styles.modeContainer, isOnline && styles.hiddenMode]}>
        <ErrorBoundary>
          <OfflineNativeShell />
        </ErrorBoundary>
      </View>

      {/* ─── FLOATING MODE TOGGLE (always visible) ─── */}
      <ModeToggle />
    </SafeAreaView>
  );
}

/**
 * OfflineNativeShell
 *
 * The original native React Native app shell (header, screens, tabs,
 * mini-player, modals). Extracted so it can coexist with the WebView.
 */
function OfflineNativeShell() {
  const [activeTab, setActiveTab] = useState('offline');
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const [actionTrack, setActionTrack] = useState(null);
  const [playlistTrack, setPlaylistTrack] = useState(null);
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isJamOpen, setIsJamOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const { currentTrack } = useAudioPlayer();
  const { currentUser } = useUser();
  const { isDark, toggleTheme } = useTheme();

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
        return <ProfileScreen onOpenSettings={() => setIsSettingsOpen(true)} />;
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
        {/* Brand Logo: [R] RIVO */}
        <TouchableOpacity
          style={styles.brandingRow}
          onPress={() => setActiveTab('home')}
          activeOpacity={0.8}
        >
          <View style={styles.logoBadge}>
            <View style={styles.logoTealOffset} />
            <View style={styles.logoCreamDisc}>
              <Text style={styles.logoLetter}>R</Text>
            </View>
          </View>
          <Text style={[styles.brandTitle, !isDark && styles.brandTitleLight]}>RIVO</Text>
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

          {/* User Profile Avatar */}
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => setActiveTab('profile')}
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
                setActiveTab('offline');
              }}
            >
              <Download size={18} color="#38bdf8" />
              <Text style={styles.menuItemText}>Offline Vault</Text>
            </TouchableOpacity>

            {currentUser?.role === 'admin' && (
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
              <User size={18} color="#ede5d3" />
              <Text style={styles.menuItemText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─────────────────────────────────────────
          MODALS
          ───────────────────────────────────────── */}
      <FullPlayerModal
        visible={isFullPlayerOpen}
        onClose={() => setIsFullPlayerOpen(false)}
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
        onClose={() => setIsChatOpen(false)}
      />

      <SettingsModal
        visible={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <JamRoomModal
        visible={isJamOpen}
        onClose={() => setIsJamOpen(false)}
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
});
