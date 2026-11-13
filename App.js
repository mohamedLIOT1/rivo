import { LOGO_BASE64 } from './src/native/assets/logoBase64';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  SafeAreaView,
  TextInput,
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
  InteractionManager,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Boost touch responsiveness across Android & low-end devices (e.g. Galaxy A12)
if (TouchableOpacity.defaultProps == null) {
  TouchableOpacity.defaultProps = {};
}
TouchableOpacity.defaultProps.delayPressIn = 0;
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
import { LocalizationProvider, useTranslation, useLiteMode } from './src/native/context/LocalizationContext';
import { ToastProvider, useToast } from './src/native/context/ToastContext';
import { AudioProvider, useAudioPlayer } from './src/native/context/AudioContext';
import { SocketProvider, useSocket } from './src/native/context/SocketContext';
import { ConnectivityProvider, useConnectivity } from './src/native/context/ConnectivityContext';
import { ThemeProvider, useTheme } from './src/native/context/ThemeContext';
import { colors } from './src/native/theme/colors';
import { APP_VERSION, FULL_VERSION } from './src/native/version';
import { API_BASE_URL } from './src/native/config';
import { applyStandardAudioMode } from './src/native/context/audio/audioModeConfig';
import * as FileSystem from 'expo-file-system';
import {
  getInitialChatSenderId,
  subscribeToChatNotification,
  exitAndRemoveTask,
} from './src/native/services/mediaControls';

import ErrorBoundary from './src/native/components/ErrorBoundary';
import { getCurrentOtaVersion } from './src/native/services/otaService';
import { UpdateProvider } from './src/native/context/UpdateContext';
import UpdateModals from './src/native/components/UpdateModals';

import HomeScreen from './src/native/screens/HomeScreen';

const lazyScreensCache = {};
function getLazyScreen(key, loader) {
  if (!lazyScreensCache[key]) {
    lazyScreensCache[key] = loader();
  }
  return lazyScreensCache[key];
}

import MiniPlayer from './src/native/components/MiniPlayer';
import FloatingNavMenu from './src/native/components/FloatingNavMenu';
import { NavPreferencesProvider, useNavPreferences } from './src/native/context/NavPreferencesContext';
import MobileModals from './src/native/components/MobileModals';
import { styles } from './src/native/theme/appStyles';

const TABS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'library', label: 'Library', icon: Disc },
  { id: 'podcasts', label: 'Podcasts', icon: Radio },
  { id: 'quran', label: 'Quran', icon: BookOpen },
  { id: 'offline', label: 'Vault', icon: Download },
];

function MainAppShell() {
  const { t, isRTL } = useTranslation();

  const rtlTextStyle = useMemo(() => (
    isRTL ? {
      letterSpacing: 0,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
      textTransform: 'none',
    } : null
  ), [isRTL]);

  useEffect(() => {
    applyStandardAudioMode();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0b1110" />

      {/* ─── 100% PURE NATIVE APP SHELL (NO WEBVIEW) ─── */}
      <View style={styles.modeContainer}>
        <ErrorBoundary>
          <NativeAppShell />
        </ErrorBoundary>
      </View>

      {/* ─── IN-APP UPDATE MODALS (Triggered on-demand via UpdateBanner/Details) ─── */}
      <UpdateModals />
    </SafeAreaView>
  );
}

function FullPlayerHandlerRegistrar({ onOpen }) {
  const { registerFullPlayerHandler } = useAudioPlayer() || {};
  useEffect(() => {
    if (typeof registerFullPlayerHandler === 'function') {
      registerFullPlayerHandler(onOpen);
    }
  }, [registerFullPlayerHandler, onOpen]);
  return null;
}

const MiniPlayerSlot = React.memo(function MiniPlayerSlot({ onOpenFullPlayer, bottomOffset }) {
  const { currentTrack } = useAudioPlayer() || {};
  if (!currentTrack) return null;
  return <MiniPlayer onOpenFullPlayer={onOpenFullPlayer} bottomOffset={bottomOffset} />;
});

/**
 * NativeAppShell
 *
 * Native React Native UI for Offline Vault, Quran, and local storage playback.
 */
function NativeAppShell() {
  const { t, isRTL } = useTranslation();
  const { isLiteMode } = useLiteMode();

  const rtlTextStyle = useMemo(() => (
    isRTL ? {
      letterSpacing: 0,
      fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
      textTransform: 'none',
    } : null
  ), [isRTL]);
  const { currentUser, isAuthLoaded, tracks: userTracks = [], albums: userAlbums = [] } = useUser();
  const { appMode, setAppMode } = useConnectivity();
  const { navStyle, visibleMenuItems, firstVisibleTab, hiddenMenuItems, isLoaded: isNavLoaded } = useNavPreferences();
  const [activeTab, setActiveTab] = useState('home');
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [activeOtaVersion, setActiveOtaVersion] = useState(null);

  useEffect(() => {
    applyStandardAudioMode();

    getCurrentOtaVersion().then(v => {
      if (v) setActiveOtaVersion(v);
    }).catch(() => {});
  }, []);
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [selectedArtist, setSelectedArtist] = useState(null);
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

  const handleOpenFullPlayer = useCallback(() => {
    setIsFullPlayerOpen(true);
  }, []);

  const handleTrackAction = useCallback((track) => {
    setActionTrack(track);
  }, []);

  const handleOpenChat = useCallback((target) => {
    if (target) setChatTargetUser(target);
    setIsChatOpen(true);
  }, []);

  const handleSelectAlbum = useCallback((alb) => {
    setSelectedAlbum(alb);
  }, []);

  const handleSelectArtist = useCallback((art) => {
    setSelectedArtist(art);
  }, []);

  const handleClearViewingUser = useCallback(() => {
    setViewingUser(null);
  }, []);

  const handleOpenCreatePlaylist = useCallback(() => {
    setIsCreatePlaylistOpen(true);
  }, []);

  const handleNavigateOffline = useCallback(() => {
    setActiveTab('offline');
  }, []);

  const handleOpenAddSong = useCallback(() => {
    setIsAddSongOpen(true);
  }, []);

  const handleOpenSettings = useCallback(() => {
    setIsSettingsOpen(true);
  }, []);

  const handleOpenAuth = useCallback(() => {
    setIsIntroAuthOpen(true);
  }, []);

  const handleOpenFriendActivity = useCallback(() => {
    setIsFriendActivityOpen(true);
  }, []);

  const handleOpenJam = useCallback(() => {
    setIsJamOpen(true);
  }, []);

  const handleSelectPlaylist = useCallback(() => {
    setActiveTab('library');
  }, []);

  const handleQueryChange = useCallback((txt) => {
    setHeaderSearchText(txt);
  }, []);

  const handleLogoPress = useCallback(() => {
    setActiveTab('home');
  }, []);

  const handleClearSearch = useCallback(() => {
    setHeaderSearchText('');
  }, []);

  const handleOpenMessages = useCallback(() => {
    setUnreadChatCount(0);
    setIsChatOpen(true);
  }, []);

  const handleOpenMenu = useCallback(() => {
    setIsMenuOpen(true);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setIsMenuOpen(false);
  }, []);

  const handleAvatarPress = useCallback(() => {
    setViewingUser(null);
    if (currentUser) {
      setActiveTab('profile');
    } else {
      setIsIntroAuthOpen(true);
    }
  }, [currentUser]);

  const [headerSearchText, setHeaderSearchText] = useState('');
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
      setUnreadChatCount((prev) => prev + 1);

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
    let resumeTimerId = null;
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        if (resumeTimerId) clearTimeout(resumeTimerId);
        resumeTimerId = setTimeout(() => {
          if (AppState.currentState === 'active') {
            getInitialChatSenderId().then((senderId) => {
              if (senderId) {
                handleOpenChatFromNotification(senderId);
              }
            }).catch(() => {});
          }
        }, 1500);
      }
    });

    return () => {
      unsubscribe();
      appStateSub.remove();
      if (resumeTimerId) clearTimeout(resumeTimerId);
    };
  }, [handleOpenChatFromNotification]);

  // Auto-switch to first visible tab if activeTab is hidden on startup
  useEffect(() => {
    if (isNavLoaded && visibleMenuItems.length > 0) {
      const isCurrentHidden = hiddenMenuItems.includes(activeTab) ||
        ((activeTab === 'home' || activeTab === 'music') && hiddenMenuItems.includes('music'));
      if (isCurrentHidden) {
        setActiveTab(firstVisibleTab);
      }
    }
  }, [isNavLoaded, hiddenMenuItems, firstVisibleTab, activeTab]);

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

  const handleTabPress = useCallback((tabId) => {
    if (tabId === 'chat') {
      setIsChatOpen(true);
    } else {
      setSelectedAlbum(null);
      setSelectedArtist(null);
      if (tabId === 'profile') {
        setViewingUser(null);
      }
      setActiveTab(tabId);
    }
  }, []);

  const normalizedTab = useMemo(() => {
    if (activeTab === 'music') return 'home';
    const valid = ['home', 'search', 'library', 'podcasts', 'quran', 'offline', 'profile', 'stats', 'admin'];
    return valid.includes(activeTab) ? activeTab : 'home';
  }, [activeTab]);

  // Track primary content modes (Music, Podcasts, Quran) visited so far: lazy-mount on first visit, then keep warm
  // while secondary tabs (search, library, offline, profile, stats, admin) unmount cleanly when inactive.
  const [visitedPrimaryTabs, setVisitedPrimaryTabs] = useState({ home: true, podcasts: false, quran: false });
  useEffect(() => {
    if (normalizedTab === 'podcasts' || normalizedTab === 'quran' || normalizedTab === 'home') {
      setVisitedPrimaryTabs((prev) => (prev[normalizedTab] ? prev : { ...prev, [normalizedTab]: true }));
    }
  }, [normalizedTab]);

  return (
    <View style={[styles.offlineShell, !isDark && styles.offlineShellLight]}>
      <View style={[styles.topHeader, !isDark && styles.topHeaderLight]}>
        {/* Brand Logo: [Icon] RIVO */}
        <TouchableOpacity
          style={styles.brandingRow}
          onPress={handleLogoPress}
          activeOpacity={0.8}
          delayPressIn={0}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <View style={styles.logoBadge}>
            <View style={styles.logoTealOffset} />
            <View style={styles.logoWhiteDisc}>
              <Text style={styles.logoLetter}>R</Text>
            </View>
          </View>
          <Text style={[styles.brandTitle, !isDark && styles.brandTitleLight]}>RIVO</Text>
        </TouchableOpacity>

        {/* ── Top Header Search Bar (Interactive input with live query sync) ── */}
        <View style={[styles.headerSearchBar, !isDark && styles.headerSearchBarLight]}>
          <Search size={13} color={isDark ? '#64748b' : '#78716c'} strokeWidth={2.2} />
          <TextInput
            style={[styles.headerSearchInput, !isDark && styles.headerSearchInputLight, isRTL && { textAlign: 'right' }]}
            placeholder={t('search.placeholder')}
            placeholderTextColor={isDark ? '#64748b' : '#78716c'}
            value={headerSearchText}
            onChangeText={(txt) => {
              setHeaderSearchText(txt);
              if (activeTab !== 'search') setActiveTab('search');
            }}
            onFocus={() => {
              if (activeTab !== 'search') setActiveTab('search');
            }}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {Boolean(headerSearchText) && (
            <TouchableOpacity
              onPress={handleClearSearch}
              delayPressIn={0}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={{ padding: 2 }}
            >
              <X size={13} color={isDark ? '#94a3b8' : '#78716c'} strokeWidth={2.2} />
            </TouchableOpacity>
          )}
        </View>

        {/* Right Actions: Chat, Menu (☰), User Avatar */}
        <View style={styles.topActions}>
          {/* Chat / Messages Button (replaces theme toggle in header) */}
          <TouchableOpacity
            style={[styles.topIconBtn, !isDark && styles.topIconBtnLight]}
            onPress={handleOpenMessages}
            activeOpacity={0.8}
            delayPressIn={0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MessageSquare size={16} color={isDark ? '#38bdf8' : '#0b1110'} strokeWidth={2.4} />
            {unreadChatCount > 0 && (
              <View style={styles.headerChatBadge}>
                <Text style={styles.headerChatBadgeText}>{unreadChatCount > 9 ? '9+' : unreadChatCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Menu Drawer Toggle (☰ 3 bars) */}
          <TouchableOpacity
            style={styles.topIconBtn}
            onPress={handleOpenMenu}
            activeOpacity={0.8}
            delayPressIn={0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Menu size={16} color="#ffffff" strokeWidth={2.5} />
          </TouchableOpacity>

          {/* User Profile Avatar / Sign In */}
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={handleAvatarPress}
            activeOpacity={0.8}
            delayPressIn={0}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {currentUser?.avatar ? (
              <Image source={{ uri: currentUser.avatar }} style={styles.avatarImg} fadeDuration={0} />
            ) : (
              <Text style={styles.avatarLetter}>
                {currentUser?.name ? currentUser.name[0].toUpperCase() : 'R'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ─────────────────────────────────────────
          ACTIVE SCREEN (Lazy Keep-Alive for Music/Podcasts/Quran + Unmount Secondary Tabs)
          ───────────────────────────────────────── */}
      <View style={[styles.screenContainer, !isDark && styles.screenContainerLight]}>
        {visitedPrimaryTabs.home && (
          <View style={[{ flex: 1 }, normalizedTab === 'home' ? { display: 'flex' } : { display: 'none' }]}>
            <HomeScreen
              initialFilter="all"
              onOpenAddSong={handleOpenAddSong}
              onTrackAction={handleTrackAction}
              onOpenFullPlayer={handleOpenFullPlayer}
              onSelectAlbum={handleSelectAlbum}
              onSelectArtist={handleSelectArtist}
            />
          </View>
        )}

        {normalizedTab === 'search' && (() => {
          const SearchScreenComp = getLazyScreen('search', () => require('./src/native/screens/SearchScreen').default);
          return (
            <View style={{ flex: 1 }}>
              <SearchScreenComp
                initialQuery={headerSearchText}
                onQueryChange={handleQueryChange}
                onTrackAction={handleTrackAction}
                onOpenChat={handleOpenChat}
                onOpenFullPlayer={handleOpenFullPlayer}
                onSelectAlbum={handleSelectAlbum}
                onSelectArtist={handleSelectArtist}
              />
            </View>
          );
        })()}

        {normalizedTab === 'library' && (() => {
          const LibraryScreenComp = getLazyScreen('library', () => require('./src/native/screens/LibraryScreen').default);
          return (
            <View style={{ flex: 1 }}>
              <LibraryScreenComp
                onOpenCreatePlaylist={handleOpenCreatePlaylist}
                onNavigateOffline={handleNavigateOffline}
                onTrackAction={handleTrackAction}
              />
            </View>
          );
        })()}

        {normalizedTab === 'podcasts' && (() => {
          const PodcastScreenComp = getLazyScreen('podcasts', () => require('./src/native/screens/PodcastScreen').default);
          return (
            <View style={{ flex: 1 }}>
              <PodcastScreenComp onTrackAction={handleTrackAction} />
            </View>
          );
        })()}

        {normalizedTab === 'quran' && (() => {
          const QuranScreenComp = getLazyScreen('quran', () => require('./src/native/screens/QuranScreen').default);
          return (
            <View style={{ flex: 1 }}>
              <QuranScreenComp onTrackAction={handleTrackAction} />
            </View>
          );
        })()}

        {normalizedTab === 'offline' && (() => {
          const OfflineScreenComp = getLazyScreen('offline', () => require('./src/native/screens/OfflineScreen').default);
          return (
            <View style={{ flex: 1 }}>
              <OfflineScreenComp />
            </View>
          );
        })()}

        {normalizedTab === 'profile' && (() => {
          const ProfileScreenComp = getLazyScreen('profile', () => require('./src/native/screens/ProfileScreen').default);
          return (
            <View style={{ flex: 1 }}>
              <ProfileScreenComp
                onOpenSettings={handleOpenSettings}
                onOpenAuth={handleOpenAuth}
                onOpenFriendActivity={handleOpenFriendActivity}
                onOpenJam={handleOpenJam}
                onOpenChat={handleOpenChat}
                onSelectPlaylist={handleSelectPlaylist}
                onOpenFullPlayer={handleOpenFullPlayer}
                onSelectAlbum={handleSelectAlbum}
                onSelectArtist={handleSelectArtist}
                viewingUser={viewingUser}
                onClearViewingUser={handleClearViewingUser}
              />
            </View>
          );
        })()}

        {normalizedTab === 'stats' && (() => {
          const StatsScreenComp = getLazyScreen('stats', () => require('./src/native/screens/StatsScreen').default);
          return (
            <View style={{ flex: 1 }}>
              <StatsScreenComp />
            </View>
          );
        })()}

        {normalizedTab === 'admin' && (() => {
          const AdminScreenComp = getLazyScreen('admin', () => require('./src/native/screens/AdminScreen').default);
          return (
            <View style={{ flex: 1 }}>
              <AdminScreenComp />
            </View>
          );
        })()}
      </View>

      {/* ─────────────────────────────────────────
          FLOATING MINI PLAYER & HANDLER BRIDGE (Isolated from Root Shell Re-renders)
          ───────────────────────────────────────── */}
      <FullPlayerHandlerRegistrar onOpen={handleOpenFullPlayer} />
      <MiniPlayerSlot
        onOpenFullPlayer={handleOpenFullPlayer}
        bottomOffset={navStyle === 'fab' ? (Platform.OS === 'ios' ? 14 : 10) : (Platform.OS === 'ios' ? 70 : 56)}
      />

      {/* ─────────────────────────────────────────
          NAVIGATION (Floating Action Hub or Classic Bar)
          ───────────────────────────────────────── */}
      {navStyle === 'fab' ? (
        <FloatingNavMenu
          activeTab={activeTab}
          onTabPress={handleTabPress}
        />
      ) : (
        <View style={[styles.bottomBar, !isDark && styles.bottomBarLight]}>
          {visibleMenuItems.map((tab) => {
            const active = activeTab === tab.screen;
            const Icon = tab.icon;

            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabBtn, active && styles.tabBtnActive]}
                onPress={() => handleTabPress(tab.screen)}
                activeOpacity={0.8}
                delayPressIn={0}
                hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
              >
                <Icon
                  size={18}
                  color={active ? '#0b1110' : (!isDark ? '#57534e' : '#94a3b8')}
                  strokeWidth={active ? 2.8 : 2}
                />
                <Text style={[styles.tabLabel, !isDark && styles.tabLabelLight, active && styles.tabLabelActive]}>
                  {t(`nav.${tab.id}`, tab.label)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ─────────────────────────────────────────
          QUICK TOOLS & SHORTCUTS MENU DRAWER
          ───────────────────────────────────────── */}
      {isMenuOpen && (
      <Modal
        visible={isMenuOpen}
        transparent={true}
        animationType={isLiteMode || Platform.OS === 'android' ? 'none' : 'fade'}
        onRequestClose={handleCloseMenu}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={handleCloseMenu}
        >
          <View style={[styles.menuSheet, !isDark && styles.menuSheetLight]}>
            <View style={[styles.menuHeader, !isDark && styles.menuHeaderLight]}>
              <Text style={[styles.menuTitle, !isDark && styles.menuTitleLight, rtlTextStyle]}>{t('nav.rivoMenu')}</Text>
              <TouchableOpacity onPress={handleCloseMenu} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={18} color={isDark ? '#ffffff' : '#475569'} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>

            {/* Category: Community & Live */}
            <View style={styles.menuSection}>
              <Text style={[styles.menuSectionHeader, !isDark && styles.menuSectionHeaderLight, rtlTextStyle]}>{t('nav.communityLive')}</Text>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  setIsFriendActivityOpen(true);
                }}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: isDark ? 'rgba(23,163,152,0.18)' : '#e6f7f5' }]}>
                  <Users size={15} color="#17a398" strokeWidth={2.4} />
                </View>
                <Text style={[styles.menuItemText, !isDark && styles.menuItemTextLight]}>{t('nav.friendActivity')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  setIsJamOpen(true);
                }}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: isDark ? 'rgba(245,158,11,0.18)' : '#fef3c7' }]}>
                  <Radio size={15} color="#f59e0b" strokeWidth={2.4} />
                </View>
                <Text style={[styles.menuItemText, !isDark && styles.menuItemTextLight]}>{t('nav.jamSession')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  setIsChatOpen(true);
                }}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: isDark ? 'rgba(56,189,248,0.18)' : '#e0f2fe' }]}>
                  <MessageSquare size={15} color="#0284c7" strokeWidth={2.4} />
                </View>
                <Text style={[styles.menuItemText, !isDark && styles.menuItemTextLight]}>{t('modals.chatTitle')}</Text>
              </TouchableOpacity>
            </View>

            {/* Category: Music & Library */}
            <View style={styles.menuSection}>
              <Text style={[styles.menuSectionHeader, !isDark && styles.menuSectionHeaderLight, rtlTextStyle]}>{t('nav.library')}</Text>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  setViewingUser(null);
                  setActiveTab('profile');
                }}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: isDark ? 'rgba(16,185,129,0.18)' : '#ecfdf5' }]}>
                  <User size={15} color="#059669" />
                </View>
                <Text style={[styles.menuItemText, !isDark && styles.menuItemTextLight]}>{t('nav.profile')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  setActiveTab('stats');
                }}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: isDark ? 'rgba(245,158,11,0.18)' : '#fef3c7' }]}>
                  <Activity size={15} color="#d97706" />
                </View>
                <Text style={[styles.menuItemText, !isDark && styles.menuItemTextLight]}>{t('nav.stats')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  setActiveTab('offline');
                }}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: isDark ? 'rgba(56,189,248,0.18)' : '#e0f2fe' }]}>
                  <Download size={15} color="#0284c7" />
                </View>
                <Text style={[styles.menuItemText, !isDark && styles.menuItemTextLight]}>{t('nav.offlineVault')}</Text>
              </TouchableOpacity>
            </View>

            {/* Category: System */}
            <View style={styles.menuSection}>
              <Text style={[styles.menuSectionHeader, !isDark && styles.menuSectionHeaderLight, rtlTextStyle]}>{t('nav.preferences')}</Text>
              {/* Theme Toggle inside Drawer */}
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  toggleTheme();
                }}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: isDark ? 'rgba(245,158,11,0.18)' : '#f1f5f9' }]}>
                  {isDark ? (
                    <Sun size={15} color="#f59e0b" strokeWidth={2.5} />
                  ) : (
                    <Moon size={15} color="#0b1110" strokeWidth={2.5} />
                  )}
                </View>
                <Text style={[styles.menuItemText, !isDark && styles.menuItemTextLight]}>{isDark ? t('nav.lightTheme') : t('nav.darkTheme')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setIsMenuOpen(false);
                  setIsSettingsOpen(true);
                }}
              >
                <View style={[styles.menuIconWrap, { backgroundColor: isDark ? 'rgba(237,229,211,0.15)' : '#f1f5f9' }]}>
                  <SettingsIcon size={15} color={isDark ? '#ede5d3' : '#475569'} />
                </View>
                <Text style={[styles.menuItemText, !isDark && styles.menuItemTextLight]}>{t('nav.settings')}</Text>
              </TouchableOpacity>

              {(currentUser?.role === 'admin' || currentUser?.email?.includes('admin')) && (
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setIsMenuOpen(false);
                    setActiveTab('admin');
                  }}
                >
                  <View style={[styles.menuIconWrap, { backgroundColor: isDark ? 'rgba(220,38,38,0.18)' : '#fee2e2' }]}>
                    <Shield size={15} color="#dc2626" />
                  </View>
                  <Text style={[styles.menuItemText, !isDark && styles.menuItemTextLight]}>{t('nav.adminPortal')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Version Information Footer */}
            <View style={[styles.menuFooter, !isDark && styles.menuFooterLight]}>
              <Text style={[styles.menuFooterVersion, !isDark && styles.menuFooterVersionLight]}>{FULL_VERSION}</Text>
              <Text style={[styles.menuFooterSub, rtlTextStyle]}>{t('nav.brandingSubtitle')}</Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
      )}

      {/* ── Mobile Modals ── */}
      <MobileModals
        tracks={userTracks}
        albums={userAlbums}
        isFullPlayerOpen={isFullPlayerOpen}
        setIsFullPlayerOpen={setIsFullPlayerOpen}
        selectedAlbum={selectedAlbum}
        setSelectedAlbum={setSelectedAlbum}
        selectedArtist={selectedArtist}
        setSelectedArtist={setSelectedArtist}
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
            <LocalizationProvider>
              <ToastProvider>
                <AudioProvider>
                  <SocketProvider>
                    <NavPreferencesProvider>
                      <UpdateProvider>
                        <MainAppShell />
                      </UpdateProvider>
                    </NavPreferencesProvider>
                  </SocketProvider>
                </AudioProvider>
              </ToastProvider>
            </LocalizationProvider>
          </UserProvider>
        </ConnectivityProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
