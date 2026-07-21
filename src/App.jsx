import React, { useState, useEffect, useRef } from 'react';
import Navigation from './components/Navigation';
import MiniPlayer from './components/MiniPlayer';
import FullPlayerModal from './components/FullPlayerModal';
import EqualizerModal from './components/EqualizerModal';
import SleepTimerModal from './components/SleepTimerModal';
import CreatePlaylistModal from './components/CreatePlaylistModal';
import AddToPlaylistModal from './components/AddToPlaylistModal';
import SettingsModal from './components/SettingsModal';
import AddSongModal from './components/AddSongModal';
import EditSongModal from './components/EditSongModal';
import AuthModal from './components/AuthModal';
import JamRoomModal from './components/JamRoomModal';
import BlendModal from './components/BlendModal';

import HomeScreen from './screens/HomeScreen';
import SearchScreen from './screens/SearchScreen';
import LibraryScreen from './screens/LibraryScreen';
import PodcastsScreen from './screens/PodcastsScreen';
import ArtistScreen from './screens/ArtistScreen';
import StatsScreen from './screens/StatsScreen';
import CarModeScreen from './screens/CarModeScreen';
import MixesScreen from './screens/MixesScreen';
import PlaylistScreen from './screens/PlaylistScreen';
import { API_BASE_URL } from './config';
import { saveTrackOffline, removeTrackOffline } from './utils/offlineStorage';
import { UserProvider, useUser } from './context/UserContext';
import { AudioProvider, useAudioPlayer } from './context/AudioContext';
import { joinJamRoom, syncJamPlayState, subscribeToJamRoom } from './utils/jamService';

function AppContent() {
  const { currentUser, setCurrentUser, tracks, setTracks, playlists, setPlaylists } = useUser();
  const audio = useAudioPlayer();

  const {
    currentTrack, setCurrentTrack, isPlaying, setIsPlaying, currentTime, duration,
    volume, setVolume, isShuffle, setIsShuffle, isRepeat, setIsRepeat,
    isOfflineMode, setIsOfflineMode, eqEnabled, setEqEnabled, eqPreset, eqBands, setEqBands, applyEqPreset,
    togglePlay, playTrack, playNextTrack, playPrevTrack, seekTo
  } = audio;

  // Jam Session State & Echo Prevention Flag
  const [jamSession, setJamSession] = useState(null);
  const isRemoteUpdateRef = useRef(false);

  // Screen Navigation State
  const [currentScreen, setCurrentScreen] = useState('home');
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);

  // Modals state
  const [isFullPlayerOpen, setIsFullPlayerOpen] = useState(false);
  const [isEqualizerOpen, setIsEqualizerOpen] = useState(false);
  const [isSleepTimerOpen, setIsSleepTimerOpen] = useState(false);
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [isAddToPlaylistOpen, setIsAddToPlaylistOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAddSongOpen, setIsAddSongOpen] = useState(false);
  const [isEditSongOpen, setIsEditSongOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isJamOpen, setIsJamOpen] = useState(false);
  const [isBlendOpen, setIsBlendOpen] = useState(false);

  const [sleepTimer, setSleepTimer] = useState(0);
  const [audioQuality, setAudioQuality] = useState('320');
  const [crossfade, setCrossfade] = useState(4);

  // Prompt Auth modal on first boot if no user signed in
  useEffect(() => {
    if (!currentUser) {
      setIsAuthOpen(true);
    }
  }, [currentUser]);

  // Subscribe to Socket.io Jam Room events safely (preventing echo loops)
  useEffect(() => {
    const unsubscribe = subscribeToJamRoom(
      (updatedRoom) => {
        setJamSession(updatedRoom);
      },
      ({ isPlaying: remoteIsPlaying, currentTrackId, currentTime: remoteTime }) => {
        isRemoteUpdateRef.current = true;
        setIsPlaying(remoteIsPlaying);
        if (remoteTime !== undefined && Math.abs(currentTime - remoteTime) > 2) {
          seekTo(remoteTime);
        }
      }
    );
    return unsubscribe;
  }, [currentTime]);

  // Sync state changes with active Jam session only if user initiated
  useEffect(() => {
    if (isRemoteUpdateRef.current) {
      isRemoteUpdateRef.current = false;
      return;
    }
    if (jamSession && jamSession.code) {
      syncJamPlayState(jamSession.code, isPlaying, currentTrack?.id, currentTime);
    }
  }, [isPlaying, currentTrack?.id]);

  // Sleep Timer countdown
  useEffect(() => {
    if (sleepTimer > 0) {
      const timer = setTimeout(() => {
        setIsPlaying(false);
        setSleepTimer(0);
      }, sleepTimer * 60 * 1000);
      return () => clearTimeout(timer);
    }
  }, [sleepTimer]);

  const toggleLike = (trackId) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, liked: !t.liked } : t))
    );
  };

  const toggleDownload = async (trackId) => {
    const targetTrack = tracks.find((t) => t.id === trackId);
    if (!targetTrack) return;

    const isCurrentlyDownloaded = !!targetTrack.downloaded;
    if (isCurrentlyDownloaded) {
      await removeTrackOffline(trackId);
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, downloaded: false } : t))
      );
    } else {
      await saveTrackOffline(targetTrack);
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, downloaded: true } : t))
      );
    }
  };

  const handleAddSong = async (newSong) => {
    if (!newSong) return;
    const songToSave = {
      ...newSong,
      userEmail: currentUser?.email || '',
      cover: newSong.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
      audioUrl: newSong.audioUrl || 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3'
    };

    setTracks((prev) => {
      const exists = prev.some(x => x.id === songToSave.id);
      if (exists) return prev;
      return [songToSave, ...prev];
    });
    playTrack(songToSave);

    try {
      await fetch(`${API_BASE_URL}/api/tracks/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(songToSave)
      });
    } catch (err) {}
  };

  const handleOpenEditSong = (track) => {
    setEditingTrack(track);
    setIsEditSongOpen(true);
  };

  const handleDeleteTrack = async (trackId) => {
    if (!trackId) return;
    setTracks((prev) => prev.filter((t) => String(t.id || t._id) !== String(trackId)));
    if (currentTrack && String(currentTrack.id || currentTrack._id) === String(trackId)) {
      setIsPlaying(false);
      setCurrentTrack(null);
    }
    try {
      await fetch(`${API_BASE_URL}/api/tracks/${encodeURIComponent(trackId)}`, { method: 'DELETE' });
    } catch (err) {}
  };

  const handleUpdateSong = (updatedTrack) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === updatedTrack.id ? updatedTrack : t))
    );
    if (currentTrack && currentTrack.id === updatedTrack.id) {
      setCurrentTrack(updatedTrack);
    }
  };

  const handleDeleteSong = (trackId) => {
    setTracks((prev) => prev.filter((t) => t.id !== trackId));
    if (currentTrack && currentTrack.id === trackId) {
      setCurrentTrack(null);
      setIsPlaying(false);
    }
  };

  const handleCreatePlaylist = (name, description) => {
    const newPl = {
      id: `pl-${Date.now()}`,
      name,
      description: description || 'My Custom Playlist',
      cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&auto=format&fit=crop&q=80',
      trackIds: []
    };
    setPlaylists((prev) => [...prev, newPl]);
    setSelectedPlaylist(newPl);
    setCurrentScreen('playlist');
  };

  const handleCreateBlend = (friendName, friendGenre, tasteMatchScore) => {
    const newBlend = {
      id: `blend-${Date.now()}`,
      name: `Blend with ${friendName}`,
      description: `${tasteMatchScore}% Taste Match • Shared Blend`,
      cover: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
      trackIds: [],
      isBlend: true,
      tasteMatchScore
    };
    setPlaylists((prev) => [...prev, newBlend]);
    setSelectedPlaylist(newBlend);
    setCurrentScreen('playlist');
  };

  const handleStartJam = () => {
    const code = `JAM-${Math.floor(1000 + Math.random() * 9000)}`;
    const userObj = {
      id: currentUser ? currentUser.id : 'user-main',
      name: currentUser ? currentUser.name : 'Host',
      avatar: currentUser ? currentUser.avatar : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'
    };
    joinJamRoom(code, userObj);
  };

  const handleJoinJam = (code) => {
    const userObj = {
      id: currentUser ? currentUser.id : 'user-main',
      name: currentUser ? currentUser.name : 'Guest',
      avatar: currentUser ? currentUser.avatar : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'
    };
    joinJamRoom(code, userObj);
  };

  const handleAddTrackToPlaylist = (trackId, playlistId) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id === playlistId) {
          const existingIds = pl.trackIds || [];
          if (!existingIds.includes(trackId)) {
            return { ...pl, trackIds: [...existingIds, trackId] };
          }
        }
        return pl;
      })
    );
  };

  const handleRemoveTrackFromPlaylist = (trackId, playlistId) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id === playlistId) {
          return { ...pl, trackIds: (pl.trackIds || []).filter(id => id !== trackId) };
        }
        return pl;
      })
    );
  };

  const handleSelectArtist = (artist) => {
    setSelectedArtist(artist);
    setCurrentScreen('artist');
  };

  const handleSelectPlaylistView = (pl) => {
    setSelectedPlaylist(pl);
    setCurrentScreen('playlist');
  };

  const handlePlayPodcastEpisode = (episode, podcast) => {
    const podTrack = {
      id: episode.id,
      title: episode.title,
      artist: podcast.author,
      album: podcast.title,
      cover: podcast.cover,
      audioUrl: episode.audioUrl,
      duration: 180,
      liked: false,
      color: '#3F51B5',
      lyrics: [{ time: 0, text: episode.description }]
    };
    playTrack(podTrack);
  };

  const handleSelectMix = (mix) => {
    if (mix && mix.trackIds && mix.trackIds.length > 0 && tracks.length > 0) {
      const mixTrack = tracks.find(t => mix.trackIds.includes(t.id)) || tracks[0];
      playTrack(mixTrack);
    }
  };

  return (
    <div className="flex text-white overflow-hidden relative select-none" style={{ height: '100dvh', background: '#000' }}>
      {/* Navigation Layout */}
      <Navigation
        currentScreen={currentScreen}
        setCurrentScreen={(screen) => {
          if (typeof screen === 'string' && screen.startsWith('playlist:')) {
            const plId = screen.split(':')[1];
            const foundPl = playlists.find(p => p.id === plId);
            if (foundPl) handleSelectPlaylistView(foundPl);
          } else {
            setCurrentScreen(screen);
          }
        }}
        playlists={playlists}
        openCreatePlaylistModal={() => setIsCreatePlaylistOpen(true)}
        openSettings={() => setIsSettingsOpen(true)}
        openAddSongModal={() => setIsAddSongOpen(true)}
        openAuthModal={() => setIsAuthOpen(true)}
        openJamModal={() => setIsJamOpen(true)}
        openBlendModal={() => setIsBlendOpen(true)}
        currentUser={currentUser}
        jamSession={jamSession}
      />

      {/* Main Screen Content View */}
      <main className="flex-1 flex flex-col overflow-hidden" style={{ background: '#121212', paddingBottom: currentTrack ? 'var(--player-height)' : 0 }}>
        {currentScreen === 'home' && (
          <HomeScreen
            tracks={tracks}
            playlists={playlists}
            artists={[]}
            onSelectTrack={playTrack}
            onSelectPlaylist={handleSelectPlaylistView}
            toggleLike={toggleLike}
            onSelectArtist={handleSelectArtist}
            openAddSongModal={() => setIsAddSongOpen(true)}
            openEditSongModal={handleOpenEditSong}
            onDeleteTrack={handleDeleteTrack}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
          />
        )}


        {currentScreen === 'mixes' && (
          <MixesScreen
            tracks={tracks}
            onSelectTrack={playTrack}
            onSelectMix={handleSelectMix}
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            togglePlay={togglePlay}
          />
        )}

        {currentScreen === 'search' && (
          <SearchScreen
            tracks={tracks}
            onSelectTrack={playTrack}
            toggleLike={toggleLike}
            onOpenAddSongModal={() => setIsAddSongOpen(true)}
          />
        )}

        {currentScreen === 'library' && (
          <LibraryScreen
            playlists={playlists}
            tracks={tracks}
            onSelectPlaylist={handleSelectPlaylistView}
            onSelectTrack={playTrack}
            openCreatePlaylistModal={() => setIsCreatePlaylistOpen(true)}
            toggleLike={toggleLike}
          />
        )}

        {currentScreen === 'playlist' && selectedPlaylist && (
          <PlaylistScreen
            playlist={playlists.find(p => p.id === selectedPlaylist.id) || selectedPlaylist}
            tracks={tracks}
            onSelectTrack={playTrack}
            toggleLike={toggleLike}
            toggleDownload={toggleDownload}
            onBack={() => setCurrentScreen('library')}
            onAddTrackToPlaylist={handleAddTrackToPlaylist}
            onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
          />
        )}

        {currentScreen === 'podcasts' && (
          <PodcastsScreen onPlayEpisode={handlePlayPodcastEpisode} />
        )}

        {currentScreen === 'artist' && selectedArtist && (
          <ArtistScreen
            artist={selectedArtist}
            tracks={tracks}
            onSelectTrack={playTrack}
            toggleLike={toggleLike}
          />
        )}

        {currentScreen === 'stats' && <StatsScreen tracks={tracks} currentUser={currentUser} />}

        {currentScreen === 'carmode' && currentTrack && (
          <CarModeScreen
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            togglePlay={togglePlay}
            playNext={playNextTrack}
            playPrev={playPrevTrack}
            exitCarMode={() => setCurrentScreen('home')}
          />
        )}
      </main>

      {/* Bottom Sticky Mini Player */}
      {currentScreen !== 'carmode' && currentTrack && (
        <MiniPlayer
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          togglePlay={togglePlay}
          playNext={playNextTrack}
          playPrev={playPrevTrack}
          isShuffle={isShuffle}
          toggleShuffle={() => setIsShuffle((prev) => !prev)}
          isRepeat={isRepeat}
          toggleRepeat={() => setIsRepeat((prev) => !prev)}
          toggleLike={toggleLike}
          openFullPlayer={() => setIsFullPlayerOpen(true)}
          openEqualizer={() => setIsEqualizerOpen(true)}
          openSleepTimer={() => setIsSleepTimerOpen(true)}
          openAddToPlaylist={() => setIsAddToPlaylistOpen(true)}
          currentTime={currentTime}
          duration={duration}
        />
      )}

      {/* Full Screen Player Modal */}
      <FullPlayerModal
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        togglePlay={togglePlay}
        playNext={playNextTrack}
        playPrev={playPrevTrack}
        toggleLike={toggleLike}
        toggleDownload={toggleDownload}
        isOpen={isFullPlayerOpen}
        onClose={() => setIsFullPlayerOpen(false)}
        currentTime={currentTime}
        duration={duration}
        seekTo={seekTo}
        volume={volume}
        setVolume={setVolume}
        isShuffle={isShuffle}
        toggleShuffle={() => setIsShuffle((prev) => !prev)}
        isRepeat={isRepeat}
        toggleRepeat={() => setIsRepeat((prev) => !prev)}
        queue={tracks}
        openEqualizer={() => setIsEqualizerOpen(true)}
        openSleepTimer={() => setIsSleepTimerOpen(true)}
        openAddToPlaylist={() => setIsAddToPlaylistOpen(true)}
      />

      {/* Audio Equalizer Modal */}
      <EqualizerModal
        isOpen={isEqualizerOpen}
        onClose={() => setIsEqualizerOpen(false)}
        enabled={eqEnabled}
        setEnabled={setEqEnabled}
        preset={eqPreset}
        applyPreset={applyEqPreset}
        bands={eqBands}
        setBands={setEqBands}
      />

      {/* Sleep Timer Modal */}
      <SleepTimerModal
        isOpen={isSleepTimerOpen}
        onClose={() => setIsSleepTimerOpen(false)}
        activeTimer={sleepTimer}
        setSleepTimer={setSleepTimer}
      />

      {/* Create Playlist Modal */}
      <CreatePlaylistModal
        isOpen={isCreatePlaylistOpen}
        onClose={() => setIsCreatePlaylistOpen(false)}
        onCreatePlaylist={handleCreatePlaylist}
      />

      {/* Add To Playlist Modal */}
      <AddToPlaylistModal
        isOpen={isAddToPlaylistOpen}
        onClose={() => setIsAddToPlaylistOpen(false)}
        track={currentTrack}
        playlists={playlists}
        onAddTrackToPlaylist={handleAddTrackToPlaylist}
      />

      {/* Edit Song & Timed Lyrics Modal */}
      <EditSongModal
        isOpen={isEditSongOpen}
        onClose={() => setIsEditSongOpen(false)}
        track={editingTrack}
        onUpdateSong={handleUpdateSong}
        onDeleteSong={handleDeleteSong}
      />

      {/* Settings & Premium Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        audioQuality={audioQuality}
        setAudioQuality={setAudioQuality}
        crossfade={crossfade}
        setCrossfade={setCrossfade}
        isOfflineMode={isOfflineMode}
        setIsOfflineMode={setIsOfflineMode}
      />

      {/* Add Song & Timed Lyrics Studio Modal */}
      <AddSongModal
        isOpen={isAddSongOpen}
        onClose={() => setIsAddSongOpen(false)}
        onAddSong={handleAddSong}
      />

      {/* User Accounts & Profile Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onLogin={(user) => setCurrentUser(user)}
        onLogout={() => setCurrentUser(null)}
      />

      {/* Jam Room Live Sync Modal */}
      <JamRoomModal
        isOpen={isJamOpen}
        onClose={() => setIsJamOpen(false)}
        jamSession={jamSession}
        onStartJam={handleStartJam}
        onJoinJam={handleJoinJam}
        onLeaveJam={() => setJamSession(null)}
        currentTrack={currentTrack}
        isPlaying={isPlaying}
      />

      {/* Spotify Blend Modal */}
      <BlendModal
        isOpen={isBlendOpen}
        onClose={() => setIsBlendOpen(false)}
        onCreateBlend={handleCreateBlend}
        currentUser={currentUser}
      />
    </div>
  );
}

export default function App() {
  const { tracks, setTracks } = useUser();
  return (
    <AudioProvider tracks={tracks} setTracks={setTracks}>
      <AppContent />
    </AudioProvider>
  );
}
