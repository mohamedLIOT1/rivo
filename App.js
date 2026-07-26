import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { Home, Search, Library, CloudDownload, User } from 'lucide-react-native';
import { UserProvider } from './src/mobile/context/UserContext';
import { AudioProvider } from './src/mobile/context/AudioContext';

import HomeScreen from './src/mobile/screens/HomeScreen';
import SearchScreen from './src/mobile/screens/SearchScreen';
import LibraryScreen from './src/mobile/screens/LibraryScreen';
import OfflineScreen from './src/mobile/screens/OfflineScreen';
import ProfileScreen from './src/mobile/screens/ProfileScreen';

import MiniPlayer from './src/mobile/components/MiniPlayer';
import FullPlayerModal from './src/mobile/components/FullPlayerModal';

function MainNavigator() {
  const [currentTab, setCurrentTab] = useState('home');
  const [isFullPlayerVisible, setIsFullPlayerVisible] = useState(false);

  const renderScreen = () => {
    switch (currentTab) {
      case 'home':
        return <HomeScreen navigation={{ navigate: setCurrentTab }} />;
      case 'search':
        return <SearchScreen />;
      case 'library':
        return <LibraryScreen />;
      case 'offline':
        return <OfflineScreen />;
      case 'profile':
        return <ProfileScreen />;
      default:
        return <HomeScreen navigation={{ navigate: setCurrentTab }} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />

      {/* Screen Content */}
      <View style={styles.screenContainer}>
        {renderScreen()}
      </View>

      {/* Floating Mini Player */}
      <MiniPlayer onOpenFullPlayer={() => setIsFullPlayerVisible(true)} />

      {/* Full Screen Player Modal */}
      <FullPlayerModal 
        visible={isFullPlayerVisible} 
        onClose={() => setIsFullPlayerVisible(false)} 
      />

      {/* Bottom Navigation Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setCurrentTab('home')}
        >
          <Home size={22} color={currentTab === 'home' ? '#1DB954' : '#71717a'} />
          <Text style={[styles.tabLabel, currentTab === 'home' && styles.activeTabLabel]}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setCurrentTab('search')}
        >
          <Search size={22} color={currentTab === 'search' ? '#1DB954' : '#71717a'} />
          <Text style={[styles.tabLabel, currentTab === 'search' && styles.activeTabLabel]}>Search</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setCurrentTab('offline')}
        >
          <CloudDownload size={22} color={currentTab === 'offline' ? '#1DB954' : '#71717a'} />
          <Text style={[styles.tabLabel, currentTab === 'offline' && styles.activeTabLabel]}>Offline</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setCurrentTab('library')}
        >
          <Library size={22} color={currentTab === 'library' ? '#1DB954' : '#71717a'} />
          <Text style={[styles.tabLabel, currentTab === 'library' && styles.activeTabLabel]}>Library</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.tabItem} 
          onPress={() => setCurrentTab('profile')}
        >
          <User size={22} color={currentTab === 'profile' ? '#1DB954' : '#71717a'} />
          <Text style={[styles.tabLabel, currentTab === 'profile' && styles.activeTabLabel]}>Profile</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <UserProvider>
      <AudioProvider>
        <MainNavigator />
      </AudioProvider>
    </UserProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  screenContainer: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    height: 60,
    backgroundColor: '#09090b',
    borderTopWidth: 1,
    borderTopColor: '#18181b',
    justifyContent: 'space-around',
    alignItems: 'center',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#71717a',
    marginTop: 3,
  },
  activeTabLabel: {
    color: '#1DB954',
    fontWeight: '700',
  },
});
