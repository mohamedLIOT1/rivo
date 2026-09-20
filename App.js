import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import {
  Home,
  Search,
  Sparkles,
  FolderHeart,
  BookOpen,
  User,
  Radio,
  MessageSquare,
  Settings,
  Download,
  Activity,
  Sliders,
  Disc,
} from 'lucide-react-native';

// Providers
import { UserProvider } from './src/native/context/UserContext';
import { ToastProvider } from './src/native/context/ToastContext';
import { AudioProvider, useAudioPlayer } from './src/native/context/AudioContext';
import { SocketProvider, useSocket } from './src/native/context/SocketContext';

// Theme
import { colors } from './src/native/theme/colors';

// Screens
import HomeScreen from './src/native/screens/HomeScreen';
import SearchScreen from './src/native/screens/SearchScreen';
import MixesScreen from './src/native/screens/MixesScreen';
import LibraryScreen from './src/native/screens/LibraryScreen';
import QuranScreen from './src/native/screens/QuranScreen';
import PodcastsScreen from './src/native/screens/PodcastsScreen';
import StatsScreen from './src/native/screens/StatsScreen';
import ProfileScreen from './src/native/screens/ProfileScreen';
import OfflineScreen from './src/native/screens/OfflineScreen';
import AdminScreen from './src/native/screens/AdminScreen';

// Components & Modals
import MiniPlayer from './src/native/components/MiniPlayer';
import FullPlayerModal from './src/native/components/FullPlayerModal';
import TrackActionMenuModal from './src/native/components/TrackActionMenuModal';
import PlaylistPickerModal from './src/native/components/PlaylistPickerModal';
import AddSongModal from './src/native/components/AddSongModal';
import EqualizerModal from './src/native/components/EqualizerModal';
import SleepTimerModal from './src/native/components/SleepTimerModal';
import JamRoomModal from './src/native/components/JamRoomModal';
import ChatModal from './src/native/components/ChatModal';
import SettingsModal from './src/native/components/SettingsModal';

function MainAppShell() {
  const { currentTrack } = useAudioPlayer();

  // Navigation state
  const [activeTab, setActiveTab] = useState('home');

  // Modals state
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const [actionTrack, setActionTrack] = useState(null);
  const [playlistTrack, setPlaylistTrack] = useState(null);
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [isEqualizerOpen, setIsEqualizerOpen] = useState(false);
  const [isJamOpen, setIsJamOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const TABS = [
    { id: 'home', label: 'HOME', icon: Home },
    { id: 'search', label: 'SEARCH', icon: Search },
    { id: 'mixes', label: 'MIXES', icon: Sparkles },
    { id: 'library', label: 'CRATES', icon: FolderHeart },
    { id: 'quran', label: 'QURAN', icon: BookOpen },
    { id: 'profile', label: 'DOSSIER', icon: User },
  ];

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'home':
        return (
          <HomeScreen
            onOpenJam={() => setIsJamOpen(true)}
            onOpenChat={() => setIsChatOpen(true)}
            onOpenAddSong={() => setIsAddSongOpen(true)}
            onOpenEqualizer={() => setIsEqualizerOpen(true)}
            onTrackAction={(track) => setActionTrack(track)}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        );
      case 'search':
        return <SearchScreen onTrackAction={(track) => setActionTrack(track)} />;
      case 'mixes':
        return <MixesScreen onTrackAction={(track) => setActionTrack(track)} />;
      case 'library':
        return (
          <LibraryScreen
            onOpenCreatePlaylist={() => setIsAddSongOpen(true)}
            onNavigateOffline={() => setActiveTab('offline')}
            onTrackAction={(track) => setActionTrack(track)}
          />
        );
      case 'quran':
        return <QuranScreen onTrackAction={(track) => setActionTrack(track)} />;
      case 'podcasts':
        return <PodcastsScreen />;
      case 'stats':
        return <StatsScreen />;
      case 'profile':
        return <ProfileScreen onOpenSettings={() => setIsSettingsOpen(true)} />;
      case 'offline':
        return <OfflineScreen />;
      case 'admin':
        return <AdminScreen />;
      default:
        return <HomeScreen onTrackAction={(track) => setActionTrack(track)} />;
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#082621" />

      {/* Top Header Bar */}
      <View style={styles.topHeader}>
        {/* Left Branding */}
        <TouchableOpacity
          style={styles.brandingRow}
          onPress={() => setActiveTab('home')}
          activeOpacity={0.8}
        >
          <View style={styles.logoStarburst}>
            <Text style={styles.logoLetter}>R</Text>
          </View>
          <View style={{ marginLeft: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <Text style={styles.brandTitle}>RIVO</Text>
              <View style={styles.onlinePill}>
                <View style={styles.pulseDot} />
                <Text style={styles.onlineText}>LIVE</Text>
              </View>
            </View>
            <Text style={styles.brandSub}>SONIC DISPENSARY</Text>
          </View>
        </TouchableOpacity>

        {/* Right Action Icons */}
        <View style={styles.topActions}>
          <TouchableOpacity
            style={styles.topIconBtn}
            onPress={() => setIsJamOpen(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Radio size={16} color={colors.rust} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.topIconBtn}
            onPress={() => setIsChatOpen(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MessageSquare size={16} color={colors.teal} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.topIconBtn, activeTab === 'offline' && styles.topIconBtnActive]}
            onPress={() => setActiveTab(activeTab === 'offline' ? 'home' : 'offline')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Download size={16} color={colors.mint} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.topIconBtn}
            onPress={() => setIsSettingsOpen(true)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Settings size={16} color={colors.paper} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Screen Content */}
      <View style={styles.screenContainer}>{renderActiveScreen()}</View>

      {/* Floating MiniPlayer */}
      {currentTrack && (
        <View style={styles.miniPlayerAnchor}>
          <MiniPlayer onOpenFullPlayer={() => setIsFullPlayerOpen(true)} />
        </View>
      )}

      {/* Bottom Brutal Navigation Bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          const Icon = tab.icon;

          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabBtn, active && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.8}
            >
              <Icon
                size={20}
                color={active ? colors.ink : colors.paperMuted}
                strokeWidth={active ? 2.5 : 2}
              />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* All Modal Overlays */}
      <FullPlayerModal
        visible={isFullPlayerOpen}
        onClose={() => setIsFullPlayerOpen(false)}
      />

      <TrackActionMenuModal
        visible={!!actionTrack}
        track={actionTrack}
        onClose={() => setActionTrack(null)}
        onOpenAddToPlaylist={(track) => {
          setPlaylistTrack(track);
        }}
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

      <EqualizerModal
        visible={isEqualizerOpen}
        onClose={() => setIsEqualizerOpen(false)}
      />

      <JamRoomModal
        visible={isJamOpen}
        onClose={() => setIsJamOpen(false)}
      />

      <ChatModal
        visible={isChatOpen}
        onClose={() => setIsChatOpen(false)}
      />

      <SettingsModal
        visible={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <UserProvider>
      <ToastProvider>
        <AudioProvider>
          <SocketProvider>
            <MainAppShell />
          </SocketProvider>
        </AudioProvider>
      </ToastProvider>
    </UserProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.deepForest,
  },
  topHeader: {
    height: 58,
    backgroundColor: colors.deepForest,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 2.5,
    borderBottomColor: colors.ink,
  },
  brandingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoStarburst: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.mint,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 18,
    color: colors.ink,
  },
  brandTitle: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 17,
    letterSpacing: 1,
    color: colors.paper,
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a3622',
    borderWidth: 1,
    borderColor: colors.ink,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
    gap: 4,
  },
  pulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.mint,
  },
  onlineText: {
    fontFamily: 'monospace',
    fontWeight: '900',
    fontSize: 8,
    color: colors.mint,
  },
  brandSub: {
    fontFamily: 'monospace',
    fontSize: 8,
    fontWeight: '800',
    color: colors.tealLight,
    letterSpacing: 0.5,
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topIconBtn: {
    padding: 7,
    backgroundColor: colors.surfaceDark,
    borderWidth: 1.5,
    borderColor: colors.ink,
    borderRadius: 6,
  },
  topIconBtnActive: {
    backgroundColor: colors.teal,
  },
  screenContainer: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  miniPlayerAnchor: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 66,
    zIndex: 99,
  },
  tabBar: {
    height: 60,
    backgroundColor: colors.surfaceDark,
    borderTopWidth: 2.5,
    borderTopColor: colors.ink,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 4,
  },
  tabBtn: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: colors.mint,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  tabLabel: {
    fontFamily: 'monospace',
    fontWeight: '800',
    fontSize: 9,
    color: colors.paperMuted,
    marginTop: 2,
  },
  tabLabelActive: {
    color: colors.ink,
    fontWeight: '900',
  },
});
