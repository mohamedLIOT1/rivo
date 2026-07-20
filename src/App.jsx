import React, { useState, useRef, useEffect } from 'react';
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

export default function App() {
  // User Account State (Prompt Sign Up / Login if null)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('liofy_user');
      return saved ? JSON.parse(saved) : null;
    } catch(e) { return null; }
  });

  // Jam Session State
  const [jamSession, setJamSession] = useState(null);

  // Tracks State
  const [tracks, setTracks] = useState(() => {
    try {
      const saved = localStorage.getItem('liofy_tracks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {}
    return [];
  });

  // Playlists State
  const [playlists, setPlaylists] = useState(() => {
    try {
      const saved = localStorage.getItem('liofy_playlists');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch(e){}
    return [];
  });

  const [currentTrack, setCurrentTrack] = useState(() => tracks[0] || null);
  const [currentQueue, setCurrentQueue] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(180);
  const [volume, setVolume] = useState(0.8);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);

  const isRepeatRef = useRef(isRepeat);
  const isShuffleRef = useRef(isShuffle);
  const currentQueueRef = useRef(currentQueue);
  const tracksRef = useRef(tracks);
  const currentTrackRef = useRef(currentTrack);

  useEffect(() => { isRepeatRef.current = isRepeat; }, [isRepeat]);
  useEffect(() => { isShuffleRef.current = isShuffle; }, [isShuffle]);
  useEffect(() => { currentQueueRef.current = currentQueue; }, [currentQueue]);
  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { currentTrackRef.current = currentTrack; }, [currentTrack]);

  // Equalizer State
  const [eqEnabled, setEqEnabled] = useState(true);
  const [eqPreset, setEqPreset] = useState('Bass Booster');
  const [eqBands, setEqBands] = useState({
    '60Hz': 6,
    '230Hz': 4,
    '910Hz': 0,
    '3.6kHz': -2,
    '14kHz': 3
  });

  const applyEqPreset = (name) => {
    setEqPreset(name);
    if (name === 'Bass Booster') {
      setEqBands({ '60Hz': 7, '230Hz': 5, '910Hz': 0, '3.6kHz': -2, '14kHz': 1 });
    } else if (name === 'Vocal Booster') {
      setEqBands({ '60Hz': -2, '230Hz': 1, '910Hz': 6, '3.6kHz': 5, '14kHz': 2 });
    } else if (name === 'Electronic') {
      setEqBands({ '60Hz': 5, '230Hz': 4, '910Hz': 1, '3.6kHz': 4, '14kHz': 6 });
    } else if (name === 'Rock') {
      setEqBands({ '60Hz': 6, '230Hz': 3, '910Hz': -1, '3.6kHz': 3, '14kHz': 5 });
    } else if (name === 'Acoustic') {
      setEqBands({ '60Hz': 3, '230Hz': 1, '910Hz': 2, '3.6kHz': 4, '14kHz': 3 });
    } else {
      setEqBands({ '60Hz': 0, '230Hz': 0, '910Hz': 0, '3.6kHz': 0, '14kHz': 0 });
    }
  };

  // Settings State
  const [audioQuality, setAudioQuality] = useState('320');
  const [crossfade, setCrossfade] = useState(4);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

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

  const audioRef = useRef(null);
  const ytIframeRef = useRef(null);

  // Prompt Auth modal on first boot if no user signed in
  useEffect(() => {
    if (!currentUser) {
      setIsAuthOpen(true);
    }
  }, [currentUser]);

  // Live Real-Time Data & Account Sync across Web, Tablet, Phone
  useEffect(() => {
    const syncWithDatabase = async () => {
      try {
        const email = currentUser?.email || '';
        const url = email ? `${API_BASE_URL}/api/user/sync?email=${encodeURIComponent(email)}` : `${API_BASE_URL}/api/tracks`;
        const res = await fetch(url);
        if (!res.ok) return;

        const data = await res.json();
        if (data.success) {
          // Sync User Avatar and Profile Details
          if (data.user && currentUser) {
            const serverAvatar = data.user.avatar;
            const serverName = data.user.name;
            if (serverAvatar && (serverAvatar !== currentUser.avatar || serverName !== currentUser.name)) {
              setCurrentUser(prev => prev ? { ...prev, avatar: serverAvatar, name: serverName } : prev);
            }
          }

          // Sync Global & User Uploaded Songs
          if (Array.isArray(data.tracks) && data.tracks.length > 0) {
            const formattedTracks = data.tracks
              .filter(t => t.audioUrl && !t.audioUrl.includes('itunes.apple.com') && !t.audioUrl.includes('apple-assets'))
              .map(t => ({
                id: t._id || t.id,
                title: t.title,
                artist: t.artist,
                album: t.album || 'Single',
                cover: t.cover,
                audioUrl: t.audioUrl,
                lyrics: t.lyrics || [],
                duration: t.duration || 240,
                genre: t.genre || 'Pop',
                source: t.source || 'Liofy',
                liked: true
              }));

            setTracks(prev => {
              const cleanedPrev = prev.filter(x => x.audioUrl && !x.audioUrl.includes('itunes.apple.com'));
              if (cleanedPrev.length === 0) return formattedTracks;
              const existingIds = new Set(cleanedPrev.map(x => String(x.id || x._id)));
              const newUnique = formattedTracks.filter(x => !existingIds.has(String(x.id)));
              if (newUnique.length === 0) return prev;
              return [...newUnique, ...cleanedPrev];
            });
          }

          // Sync User Playlists
          if (Array.isArray(data.playlists) && data.playlists.length > 0) {
            setPlaylists(prev => {
              if (prev.length === 0) return data.playlists;
              const existingIds = new Set(prev.map(p => String(p.id)));
              const newPls = data.playlists.filter(p => !existingIds.has(String(p.id)));
              if (newPls.length === 0) return prev;
              return [...prev, ...newPls];
            });
          }
        }
      } catch (err) {
        console.warn('Live sync status:', err);
      }
    };

    syncWithDatabase();
    const syncInterval = setInterval(syncWithDatabase, 5000);
    return () => clearInterval(syncInterval);
  }, [currentUser?.email]);

  // Persist user account state to Railway MongoDB Atlas Database
  useEffect(() => {
    if (!currentUser?.email || tracks.length === 0) return;
    const saveTimer = setTimeout(() => {
      try {
        fetch(`${API_BASE_URL}/api/user/save-state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: currentUser.email,
            avatar: currentUser.avatar,
            name: currentUser.name,
            tracks,
            playlists
          })
        }).catch(() => {});
      } catch(e) {}
    }, 2000);
    return () => clearTimeout(saveTimer);
  }, [currentUser?.email, currentUser?.avatar, tracks.length, playlists.length]);

  // Save currentUser to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('liofy_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('liofy_user');
    }
  }, [currentUser]);

  // Save tracks & playlists to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('liofy_tracks', JSON.stringify(tracks));
    } catch (err) {}
  }, [tracks]);

  useEffect(() => {
    try {
      localStorage.setItem('liofy_playlists', JSON.stringify(playlists));
    } catch (err) {}
  }, [playlists]);

  // Create Audio instance
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      if (audio && !isNaN(audio.currentTime)) {
        setCurrentTime(audio.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      if (audio && !isNaN(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      if (isRepeatRef.current) {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
      } else {
        playNextTrack();
      }
    };

    const handleError = (e) => {
      console.warn('Audio stream error handled safely:', e);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
    };
  }, []);

  // Web MediaSession API integration for Background Audio Playback
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: currentTrack.album || 'Liofy',
          artwork: [{ src: currentTrack.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600', sizes: '512x512', type: 'image/png' }]
        });

        navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
        navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
        navigator.mediaSession.setActionHandler('previoustrack', () => playPrevTrack());
        navigator.mediaSession.setActionHandler('nexttrack', () => playNextTrack());
      } catch (err) {}
    }
  }, [currentTrack]);

  // Automatic Full Audio Upgrader for 30s preview tracks via Backend YouTube/SoundCloud
  useEffect(() => {
    if (!currentTrack || !currentTrack.audioUrl) return;
    const is30sPreview = currentTrack.audioUrl.includes('itunes.apple.com') || currentTrack.audioUrl.includes('apple.com') || (currentTrack.duration && currentTrack.duration <= 35);
    
    if (is30sPreview) {
      const upgradeAudioToFullLength = async () => {
        try {
          const cleanTitle = (currentTrack.title || '')
            .replace(/\(.*?\)/g, '')
            .replace(/\[.*?\]/g, '')
            .replace(/ft\..*$/i, '')
            .replace(/feat\..*$/i, '')
            .trim();

          const query = `${currentTrack.artist || ''} ${cleanTitle}`.trim();
          const res = await fetch(`${API_BASE_URL}/api/search/external?q=${encodeURIComponent(query)}`);
          if (res.ok) {
            const data = await res.json();
            if (data && data.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
              const fullTrack = data.tracks.find(t => t.audioUrl && (!t.duration || t.duration > 35) && !t.audioUrl.includes('itunes.apple.com'));
              if (fullTrack) {
                const fullAudioUrl = fullTrack.audioUrl;
                const fullDuration = fullTrack.duration || 210;

                setCurrentTrack((prev) => (prev && prev.id === currentTrack.id ? { ...prev, audioUrl: fullAudioUrl, duration: fullDuration } : prev));
                setTracks((prev) => prev.map((t) => (t.id === currentTrack.id ? { ...t, audioUrl: fullAudioUrl, duration: fullDuration } : t)));
              }
            }
          }
        } catch (err) {
          console.warn('Full audio upgrade status:', err);
        }
      };
      upgradeAudioToFullLength();
    }
  }, [currentTrack?.id]);

  const isYouTubeTrack = Boolean(
    currentTrack && (
      currentTrack.source === 'YouTube' ||
      (currentTrack.id && String(currentTrack.id).startsWith('yt-')) ||
      !!currentTrack.videoId
    )
  );

  const ytVideoId = isYouTubeTrack
    ? (currentTrack.videoId || String(currentTrack.id).replace(/^yt-/, '').replace(/^fallback-/, ''))
    : null;

  // Single Unified Audio & YouTube Playback Controller
  useEffect(() => {
    const audio = audioRef.current;
    if (!currentTrack) return;

    if (isYouTubeTrack && ytVideoId) {
      if (audio) audio.pause();

      const iframe = ytIframeRef.current;
      if (iframe) {
        const targetSrc = `https://www.youtube.com/embed/${ytVideoId}?enablejsapi=1&autoplay=1&controls=0&origin=${window.location.origin}`;
        if (!iframe.src || !iframe.src.includes(ytVideoId)) {
          iframe.src = targetSrc;
        } else {
          const cmd = isPlaying ? 'playVideo' : 'pauseVideo';
          iframe.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: cmd, args: [] }), '*');
        }
      }
    } else if (audio && currentTrack.audioUrl) {
      if (ytIframeRef.current && ytIframeRef.current.src) {
        ytIframeRef.current.contentWindow?.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*');
      }

      if (audio.src !== currentTrack.audioUrl) {
        audio.src = currentTrack.audioUrl;
      }

      if (isPlaying) {
        audio.play().catch((err) => console.warn('Safe audio playback:', err));
      } else {
        audio.pause();
      }
    }
  }, [currentTrack, isPlaying, isYouTubeTrack, ytVideoId]);

  // YouTube progress timer
  useEffect(() => {
    if (!isYouTubeTrack || !isPlaying) return;
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const nextTime = prev + 1;
        if (duration > 0 && nextTime >= duration) {
          playNextTrack();
          return 0;
        }
        return nextTime;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isYouTubeTrack, isPlaying, duration]);

  // Sync Volume
  useEffect(() => {
    const normVol = Math.max(0, Math.min(1, volume));
    if (audioRef.current) {
      audioRef.current.volume = normVol;
    }
    if (ytIframeRef.current) {
      ytIframeRef.current.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'setVolume', args: [normVol * 100] }), '*'
      );
    }
  }, [volume]);

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

  const togglePlay = () => {
    if (!currentTrack) return;
    if (isOfflineMode && !currentTrack.downloaded) {
      alert('Offline mode is active! Download this song first to listen offline.');
      return;
    }
    setIsPlaying((prev) => !prev);
  };

  const playTrack = (track, newQueue = null) => {
    if (!track) return;
    if (isOfflineMode && !track.downloaded) {
      alert('Offline mode is active! Download this song first to listen offline.');
      return;
    }

    if (newQueue && Array.isArray(newQueue) && newQueue.length > 0) {
      setCurrentQueue(newQueue);
    } else if (currentQueueRef.current.length === 0 && tracksRef.current.length > 0) {
      setCurrentQueue(tracksRef.current);
    }

    setTracks((prev) => {
      const exists = prev.some((t) => t.id === track.id);
      if (!exists) return [track, ...prev];
      return prev.map((t) => (t.id === track.id ? { ...t, plays: (Number(t.plays) || 0) + 1 } : t));
    });

    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const playNextTrack = () => {
    const rawQueue = currentQueueRef.current.length > 0 ? currentQueueRef.current : tracksRef.current;
    if (!rawQueue || rawQueue.length === 0) return;
    const activeList = isOfflineMode ? rawQueue.filter(t => t.downloaded) : rawQueue;
    if (activeList.length === 0) return;

    if (isShuffleRef.current) {
      const randomIdx = Math.floor(Math.random() * activeList.length);
      playTrack(activeList[randomIdx]);
    } else {
      const currentIdx = activeList.findIndex((t) => t.id === (currentTrackRef.current ? currentTrackRef.current.id : ''));
      const nextIdx = currentIdx === -1 ? 0 : (currentIdx + 1) % activeList.length;
      playTrack(activeList[nextIdx]);
    }
  };

  const playPrevTrack = () => {
    const rawQueue = currentQueueRef.current.length > 0 ? currentQueueRef.current : tracksRef.current;
    if (!rawQueue || rawQueue.length === 0) return;
    const activeList = isOfflineMode ? rawQueue.filter(t => t.downloaded) : rawQueue;
    if (activeList.length === 0) return;

    const currentIdx = activeList.findIndex((t) => t.id === (currentTrackRef.current ? currentTrackRef.current.id : ''));
    const prevIdx = currentIdx <= 0 ? activeList.length - 1 : currentIdx - 1;
    playTrack(activeList[prevIdx]);
  };

  const toggleLike = (trackId) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === trackId ? { ...t, liked: !t.liked } : t))
    );
  };

  const toggleDownload = (trackId) => {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id === trackId) {
          return { ...t, downloaded: !t.downloaded };
        }
        return t;
      })
    );
  };

  const seekTo = (seconds) => {
    if (!isNaN(seconds)) {
      setCurrentTime(seconds);
      if (isYouTubeTrack && ytIframeRef.current) {
        ytIframeRef.current.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func: 'seekTo', args: [seconds, true] }), '*'
        );
      } else if (audioRef.current) {
        audioRef.current.currentTime = seconds;
      }
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
    setCurrentTrack(songToSave);
    setIsPlaying(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/tracks/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(songToSave)
      });
      const data = await response.json();
      if (data.success && data.track) {
        console.log('✅ Track synced successfully to Railway MongoDB!');
      }
    } catch (err) {
      console.warn('Backend sync status:', err);
    }
  };

  const handleOpenEditSong = (track) => {
    setEditingTrack(track);
    setIsEditSongOpen(true);
  };

  const handleUpdateSong = (updatedTrack) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === updatedTrack.id ? updatedTrack : t))
    );
    if (currentTrack && currentTrack.id === updatedTrack.id) {
      setCurrentTrack(updatedTrack);
    }
    alert(`Updated "${updatedTrack.title}" & timed lyrics!`);
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
    const newSession = {
      code,
      hostId: currentUser ? currentUser.id : 'user-main',
      members: [
        { id: currentUser ? currentUser.id : 'user-main', name: currentUser ? currentUser.name : 'Host', avatar: currentUser ? currentUser.avatar : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80', isHost: true }
      ]
    };
    setJamSession(newSession);
  };

  const handleJoinJam = (code) => {
    const joinedSession = {
      code,
      hostId: 'user-friend',
      members: [
        { id: 'user-friend', name: 'Friend (Host)', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80', isHost: true },
        { id: currentUser ? currentUser.id : 'user-main', name: currentUser ? currentUser.name : 'You', avatar: currentUser ? currentUser.avatar : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80', isHost: false }
      ]
    };
    setJamSession(joinedSession);
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
    setCurrentTrack(podTrack);
    setIsPlaying(true);
  };

  const handleSelectMix = (mix) => {
    if (mix && mix.trackIds && mix.trackIds.length > 0 && tracks.length > 0) {
      const mixTrack = tracks.find(t => mix.trackIds.includes(t.id)) || tracks[0];
      playTrack(mixTrack);
    }
  };

  return (
    <div className="flex h-screen bg-[#121212] text-white overflow-hidden relative select-none">
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
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#121212]">
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

      {/* Hidden YouTube Audio Player Iframe */}
      <iframe
        ref={ytIframeRef}
        title="YouTube Player"
        className="fixed -top-[9999px] -left-[9999px] w-1 h-1 opacity-0 pointer-events-none"
        allow="autoplay"
      />
    </div>
  );
}
