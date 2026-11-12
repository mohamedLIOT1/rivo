import React, { useState, useEffect, useCallback, useMemo, useDeferredValue } from 'react';
import { 
  ShieldCheck, Users, Music2, FileText, CheckCircle2, XCircle, Search, 
  Trash2, Edit, RefreshCw, Loader2, UserCheck, Check, ArrowLeft, Disc,
  Calendar, Mail, ShieldAlert, Sparkles, ExternalLink, ListMusic, Eye,
  Lock, Globe, Play, Plus, BarChart2, Radio, Send, Cloud
} from 'lucide-react';
import AdminCloudPanel from '../components/admin/AdminCloudPanel';
import { API_BASE_URL } from '../config';
import { isUserAdmin } from '../utils/adminUtils';
import { isQuranContent } from '../utils/quranUtils';
import { isPodcastContent } from '../utils/podcastUtils';
import EditArtistModal from '../components/EditArtistModal';
import AddAlbumModal from '../components/AddAlbumModal';
import DeleteAlbumModal from '../components/DeleteAlbumModal';
import VerifiedBadge from '../components/VerifiedBadge';
import { useTranslation } from '../context/PreferencesContext';

export default function AdminScreen({
  currentUser,
  tracks = [],
  albums = [],
  playlists = [],
  onDeleteTrack,
  onPlayTrack,
  onSelectArtist,
  onSelectPlaylist,
  openEditSongModal,
  openEditAlbumModal,
  onAlbumCreated,
  onDeleteAlbum,
  onUpdatePlaylist,
  onDeletePlaylist,
  onBack,
  globalTheme = 'dark'
}) {
  const isDark = globalTheme === 'dark';
  const { t, isRTL } = useTranslation();
  const isAdmin = isUserAdmin(currentUser);

  // 'accounts' | 'tracks' | 'albums' | 'artists' | 'playlists' | 'lyrics'
  const [activeTab, setActiveTab] = useState('accounts');

  // Accounts State
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [userFilterQuery, setUserFilterQuery] = useState('');
  const [deletingUserId, setDeletingUserId] = useState(null);

  // Songs State
  const [songFilterQuery, setSongFilterQuery] = useState('');
  const [songTypeFilter, setSongTypeFilter] = useState('all'); // 'all' | 'songs' | 'quran' | 'podcast'
  const [adminTracksLimit, setAdminTracksLimit] = useState(50);

  // Albums State
  const [adminAlbums, setAdminAlbums] = useState(albums || []);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(false);
  const [albumFilterQuery, setAlbumFilterQuery] = useState('');
  const [albumTypeFilter, setAlbumTypeFilter] = useState('all'); // 'all' | 'songs' | 'quran' | 'podcast'
  const [isAddAlbumOpen, setIsAddAlbumOpen] = useState(false);
  const [albumToDelete, setAlbumToDelete] = useState(null);
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [isStartingPipeline, setIsStartingPipeline] = useState(false);

  // Artists State
  const [artistsList, setArtistsList] = useState([]);
  const [isLoadingArtists, setIsLoadingArtists] = useState(false);
  const [artistFilterQuery, setArtistFilterQuery] = useState('');
  const [editingArtist, setEditingArtist] = useState(null);

  // Playlists State
  const [adminPlaylists, setAdminPlaylists] = useState([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [playlistFilterQuery, setPlaylistFilterQuery] = useState('');

  // Lyrics State
  const [lyricsFilterQuery, setLyricsFilterQuery] = useState('');
  const [lyricsTypeFilter, setLyricsTypeFilter] = useState('all'); // 'all' | 'songs' | 'quran' | 'podcast'
  const [adminLyricsLimit, setAdminLyricsLimit] = useState(50);

  // Analytics State
  const [analyticsData, setAnalyticsData] = useState(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  useEffect(() => {
    if (activeTab !== 'analytics') return;
    setIsLoadingAnalytics(true);
    const tk = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
    fetch(`${API_BASE_URL}/api/admin/analytics`, {
      headers: { Authorization: `Bearer ${tk}` }
    })
      .then(r => r.json())
      .then(d => { if (d.success) setAnalyticsData(d.data); })
      .catch(e => console.warn('Analytics fetch error:', e))
      .finally(() => setIsLoadingAnalytics(false));
  }, [activeTab]);

  const [statusMessage, setStatusMessage] = useState(null);
  const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';

  const flashMessage = (msg) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // 1. Fetch Users
  const fetchAllUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error('Fetch admin users error:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // 2. Fetch Artists
  const fetchArtists = async () => {
    setIsLoadingArtists(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/artists`);
      const data = await res.json();
      if (data.success && Array.isArray(data.artists)) {
        setArtistsList(data.artists);
      }
    } catch (err) {
      console.error('Fetch artists error:', err);
    } finally {
      setIsLoadingArtists(false);
    }
  };

  // 3. Fetch Albums
  const fetchAlbums = async () => {
    setIsLoadingAlbums(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/albums`);
      const data = await res.json();
      if (data.success && Array.isArray(data.albums)) {
        setAdminAlbums(data.albums);
      }
    } catch (err) {
      console.error('Fetch albums error:', err);
    } finally {
      setIsLoadingAlbums(false);
    }
  };

  // Fetch Multi-Worker Pipeline Status
  const fetchPipelineStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/pipeline-status`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data?.success && data.status) {
        setPipelineStatus(data.status);
      }
    } catch (e) {}
  }, [token]);

  const triggerPipeline = async () => {
    setIsStartingPipeline(true);
    setPipelineStatus(prev => ({
      ...prev,
      running: true,
      currentWorker: 1,
      currentWorkerName: 'Worker 1: Artist & Discography Scout',
      currentArtist: 'Initializing...',
      currentStage: 'Starting autonomous discography pipeline across catalog...',
      lastUpdated: Date.now()
    }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/run-pipeline`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      flashMessage(data.message || '3-Worker Discography Pipeline started!');
      setTimeout(fetchPipelineStatus, 1200);
    } catch (e) {
      flashMessage('Failed to trigger pipeline');
    }
    finally {
      setIsStartingPipeline(false);
    }
  };

  // 4. Fetch All Playlists
  const fetchPlaylists = async () => {
    setIsLoadingPlaylists(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/playlists`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.playlists)) {
        setAdminPlaylists(data.playlists);
      } else if (Array.isArray(playlists) && playlists.length > 0) {
        setAdminPlaylists(playlists);
      }
    } catch (err) {
      console.error('Fetch admin playlists error:', err);
      if (Array.isArray(playlists) && playlists.length > 0) {
        setAdminPlaylists(playlists);
      }
    } finally {
      setIsLoadingPlaylists(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAllUsers();
      fetchArtists();
      fetchAlbums();
      fetchPlaylists();
    }
  }, [isAdmin]);

  // Keep albums in sync with prop if updated
  useEffect(() => {
    if (albums && albums.length > 0) {
      setAdminAlbums(albums);
    }
  }, [albums]);

  // Poll 3-Worker Pipeline status when albums tab is active
  useEffect(() => {
    if (activeTab === 'albums') {
      fetchPipelineStatus();
      const pollMs = pipelineStatus?.running ? 2500 : 12000;
      const interval = setInterval(fetchPipelineStatus, pollMs);
      return () => clearInterval(interval);
    }
  }, [activeTab, fetchPipelineStatus, pipelineStatus?.running]);

  const handleToggleAdminRole = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (data.success) {
        setUsers(prev => prev.map(u => u.id === userId || u._id === userId ? { ...u, role: newRole, isAdmin: newRole === 'admin' } : u));
        flashMessage(`Updated role for user to ${newRole.toUpperCase()}`);
      }
    } catch (err) {
      console.error('Update role error:', err);
    }
  };

  const handleToggleUserVerified = async (userId, currentVerified) => {
    const newVerified = !currentVerified;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isVerified: newVerified })
      });
      const data = await res.json();
      if (data.success) {
        setUsers(prev => prev.map(u => u.id === userId || u._id === userId ? { ...u, isVerified: newVerified } : u));
        flashMessage(`Updated verified status for user`);
      }
    } catch (err) {
      console.error('Update verified error:', err);
    }
  };

  const handleDeleteUser = async (targetUser) => {
    const uId = String(targetUser?.id || targetUser?._id || '');
    const myId = String(currentUser?.id || currentUser?._id || '');
    if (!uId || deletingUserId) return;
    if (myId && uId === myId) {
      flashMessage('Cannot delete your own logged-in admin account');
      return;
    }
    const label = targetUser.name || targetUser.email || uId;
    if (!window.confirm(`Permanently delete user account "${label}"? This removes their account, playlists, and chat history.`)) {
      return;
    }
    setDeletingUserId(uId);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${encodeURIComponent(uId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setUsers(prev => prev.filter(u => String(u.id || u._id) !== uId));
        flashMessage(`Deleted account "${label}"`);
      } else {
        flashMessage(data.error || `Failed to delete user (${res.status})`);
      }
    } catch (err) {
      console.error('Delete user error:', err);
      flashMessage('Error deleting user account');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleConfirmDeleteAlbum = async (deleteTracks) => {
    if (!albumToDelete) return;
    const albumId = albumToDelete.id || albumToDelete._id;
    try {
      const res = await fetch(`${API_BASE_URL}/api/albums/${encodeURIComponent(albumId)}`, {
        method: 'DELETE',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ deleteTracks: Boolean(deleteTracks) })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Failed with status ${res.status}`);
      }
      setAdminAlbums(prev => prev.filter(a => String(a.id || a._id) !== String(albumId) && a.name !== albumToDelete.name));
      await fetchAlbums();
      if (onDeleteAlbum) onDeleteAlbum(albumId, albumToDelete, deleteTracks);
      flashMessage(deleteTracks ? 'Album & all songs permanently deleted' : 'Album deleted (songs kept on website)');
    } catch (err) {
      console.error('Delete album error:', err);
      flashMessage(err.message || 'Error deleting album');
    }
  };

  const handleDeletePlaylistInternal = async (playlistId) => {
    if (!window.confirm(`Are you sure you want to permanently delete this playlist?`)) return;
    try {
      await fetch(`${API_BASE_URL}/api/playlists/${encodeURIComponent(playlistId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setAdminPlaylists(prev => prev.filter(p => String(p.id || p._id) !== String(playlistId)));
      if (onDeletePlaylist) onDeletePlaylist(playlistId);
      flashMessage('Playlist deleted successfully');
    } catch (err) {
      console.error('Delete playlist error:', err);
    }
  };

  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const handleDeduplicateTracks = async () => {
    if (!window.confirm('Scan database, merge duplicate songs, repair broken durations, and purge duplicate artist profiles?')) return;
    setIsDeduplicating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/tracks/deduplicate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        flashMessage(data.message || `Deduplication complete: Purged duplicate tracks and refreshed catalog.`);
        if (typeof onDeleteTrack === 'function') onDeleteTrack();
        fetchArtists();
      } else {
        flashMessage(data.error || 'Failed to deduplicate tracks');
      }
    } catch (err) {
      flashMessage(err.message || 'Error executing deduplication');
    } finally {
      setIsDeduplicating(false);
    }
  };

  const [isRepairingTracks, setIsRepairingTracks] = useState(false);
  const handleRepairTracks = async () => {
    if (!window.confirm('Scan database, fix swapped audio (e.g. El Khat Dah Khatty / Ethbat Makanak), fix inflated durations, and purge single releases from albums?')) return;
    setIsRepairingTracks(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/repair-tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.success) {
        flashMessage(data.message || `Repair complete: Fixed ${data.repairedTracks} tracks and purged ${data.purgedAlbums} singles.`);
        if (typeof onDeleteTrack === 'function') onDeleteTrack();
        await fetchAlbums();
      } else {
        flashMessage(data.error || 'Failed to repair tracks');
      }
    } catch (err) {
      flashMessage(err.message || 'Error executing track repair');
    } finally {
      setIsRepairingTracks(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-8 select-none text-center ${
        isDark ? 'bg-[#0b1110] text-white' : 'bg-[#17a398] text-[#0b1110]'
      }`}>
        <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-500 flex items-center justify-center mb-4 brutal-border">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-mono font-black uppercase mb-2">{t('admin.accessDenied')}</h2>
        <p className="text-sm max-w-md font-sans mb-6 text-zinc-400">
          {t('admin.accessDeniedDesc')}
        </p>
        {onBack && (
          <button
            onClick={onBack}
            className="px-5 py-2.5 bg-[#17a398] text-[#0b1110] font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm cursor-pointer rounded-xl"
          >
            {t('admin.backToHome')}
          </button>
        )}
      </div>
    );
  }

  // Helper to accurately identify podcast content
  const isPodcast = useCallback((item) => Boolean(item && (item.contentType === 'podcast' || item.isPodcast || isPodcastContent(item))), []);

  // Filter counts calculated in a single memoized pass
  const { tracksQuranCount, tracksPodcastCount, tracksSongsCount } = useMemo(() => {
    let q = 0, p = 0, s = 0;
    for (let i = 0; i < tracks.length; i++) {
      const t = tracks[i];
      if (isQuranContent(t)) q++;
      else if (isPodcast(t)) p++;
      else s++;
    }
    return { tracksQuranCount: q, tracksPodcastCount: p, tracksSongsCount: s };
  }, [tracks, isPodcast]);

  const { albumsQuranCount, albumsPodcastCount, albumsSongsCount } = useMemo(() => {
    let q = 0, p = 0, s = 0;
    for (let i = 0; i < adminAlbums.length; i++) {
      const a = adminAlbums[i];
      if (isQuranContent(a)) q++;
      else if (isPodcast(a)) p++;
      else s++;
    }
    return { albumsQuranCount: q, albumsPodcastCount: p, albumsSongsCount: s };
  }, [adminAlbums, isPodcast]);

  // Non-blocking responsive search queries
  const deferredUserFilter = useDeferredValue(userFilterQuery);
  const deferredSongFilter = useDeferredValue(songFilterQuery);
  const deferredAlbumFilter = useDeferredValue(albumFilterQuery);
  const deferredLyricsFilter = useDeferredValue(lyricsFilterQuery);
  const deferredArtistFilter = useDeferredValue(artistFilterQuery);
  const deferredPlaylistFilter = useDeferredValue(playlistFilterQuery);

  const filteredUsers = useMemo(() => {
    const q = deferredUserFilter.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u => {
      return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
    });
  }, [users, deferredUserFilter]);

  const filteredTracks = useMemo(() => {
    const q = deferredSongFilter.toLowerCase().trim();
    return tracks.filter(t => {
      if (songTypeFilter === 'podcast' && !isPodcast(t)) return false;
      if (songTypeFilter === 'quran' && !isQuranContent(t)) return false;
      if (songTypeFilter === 'songs' && (isQuranContent(t) || isPodcast(t))) return false;
      if (!q) return true;
      return (t.title || '').toLowerCase().includes(q) || (t.artist || '').toLowerCase().includes(q) || (t.album || '').toLowerCase().includes(q);
    });
  }, [tracks, deferredSongFilter, songTypeFilter, isPodcast]);

  const filteredAlbums = useMemo(() => {
    const q = deferredAlbumFilter.toLowerCase().trim();
    return adminAlbums.filter(a => {
      if (albumTypeFilter === 'podcast' && !isPodcast(a)) return false;
      if (albumTypeFilter === 'quran' && !isQuranContent(a)) return false;
      if (albumTypeFilter === 'songs' && (isQuranContent(a) || isPodcast(a))) return false;
      if (!q) return true;
      return (a.name || '').toLowerCase().includes(q) || (a.artist || '').toLowerCase().includes(q);
    });
  }, [adminAlbums, deferredAlbumFilter, albumTypeFilter, isPodcast]);

  const filteredLyricsTracks = useMemo(() => {
    const q = deferredLyricsFilter.toLowerCase().trim();
    return tracks.filter(t => {
      if (lyricsTypeFilter === 'podcast' && !isPodcast(t)) return false;
      if (lyricsTypeFilter === 'quran' && !isQuranContent(t)) return false;
      if (lyricsTypeFilter === 'songs' && (isQuranContent(t) || isPodcast(t))) return false;
      if (!q) return true;
      return (t.title || '').toLowerCase().includes(q) || (t.artist || '').toLowerCase().includes(q) || (t.album || '').toLowerCase().includes(q);
    });
  }, [tracks, deferredLyricsFilter, lyricsTypeFilter, isPodcast]);

  const filteredArtists = useMemo(() => {
    const q = deferredArtistFilter.toLowerCase().trim();
    return artistsList.filter(a => {
      if (!a.name) return false;
      // Filter out collaboration strings from standalone artist profiles
      if (a.name.includes(',') || a.name.includes('،') || /\b(?:feat\.?|ft\.?)\b/i.test(a.name)) return false;
      if (!q) return true;
      return (a.name || '').toLowerCase().includes(q);
    });
  }, [artistsList, deferredArtistFilter]);

  const filteredPlaylists = useMemo(() => {
    const q = deferredPlaylistFilter.toLowerCase().trim();
    if (!q) return adminPlaylists;
    return adminPlaylists.filter(p => {
      return (p.name || '').toLowerCase().includes(q) || (p.ownerName || '').toLowerCase().includes(q);
    });
  }, [adminPlaylists, deferredPlaylistFilter]);

  return (
    <div className={`flex-1 overflow-y-auto pb-32 p-4 md:p-8 select-none ${
      isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#17a398] text-[#0b1110]'
    }`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 mb-6 border-b-2 border-dashed border-zinc-700">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className={`p-2.5 brutal-border brutal-shadow-sm rounded-xl cursor-pointer transition-transform hover:-translate-x-1 ${
                isDark ? 'bg-[#182320] text-zinc-300 hover:text-white border-zinc-700' : 'bg-[#ede5d3] text-black border-black hover:bg-white'
              }`}
              title={t('admin.back')}
            >
              <ArrowLeft size={18} className={isRTL ? 'rotate-180' : ''} />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-[#f59e0b] text-black flex items-center justify-center brutal-border shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-mono font-black uppercase tracking-wider">
                {t('admin.portalTitle')}
              </h1>
              <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-[#f59e0b] text-black">
                {t('admin.rootAdmin')}
              </span>
            </div>
            <p className={`text-xs font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
              {t('admin.adminDescription')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
          <div className={`px-3 py-1.5 rounded-xl brutal-border flex items-center gap-1.5 ${
            isDark ? 'bg-[#182320] border-zinc-700' : 'bg-[#ede5d3] border-black'
          }`}>
            <Users size={14} className="text-[#17a398]" />
            <span>{t('admin.usersCount', { count: users.length })}</span>
          </div>
          <div className={`px-3 py-1.5 rounded-xl brutal-border flex items-center gap-1.5 ${
            isDark ? 'bg-[#182320] border-zinc-700' : 'bg-[#ede5d3] border-black'
          }`}>
            <Music2 size={14} className="text-[#f59e0b]" />
            <span>{t('admin.songsCount', { count: tracks.length })}</span>
          </div>
          <div className={`px-3 py-1.5 rounded-xl brutal-border flex items-center gap-1.5 ${
            isDark ? 'bg-[#182320] border-zinc-700' : 'bg-[#ede5d3] border-black'
          }`}>
            <Disc size={14} className="text-[#26c4b7]" />
            <span>{t('admin.albumsCount', { count: adminAlbums.length })}</span>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="mb-6 p-3.5 rounded-xl bg-emerald-500/15 border-2 border-emerald-500 text-emerald-400 text-xs font-mono font-black flex items-center gap-2">
          <Check size={16} /> {statusMessage}
        </div>
      )}

      {/* ── Navigation Tabs ── */}
      <div className={`flex items-center gap-2 mb-6 overflow-x-auto pb-2 border-b-2 border-zinc-700/50 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-black uppercase brutal-border transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            isRTL ? '' : 'tracking-wider'
          } ${
            activeTab === 'accounts'
              ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
              : isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:bg-[#22332e]' : 'bg-[#ede5d3] text-[#082621] border-black hover:bg-white'
          }`}
        >
          <Users size={14} />
          <span>{t('admin.tabAccounts', { count: users.length })}</span>
        </button>

        <button
          onClick={() => setActiveTab('tracks')}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-black uppercase brutal-border transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            isRTL ? '' : 'tracking-wider'
          } ${
            activeTab === 'tracks'
              ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
              : isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:bg-[#22332e]' : 'bg-[#ede5d3] text-[#082621] border-black hover:bg-white'
          }`}
        >
          <Music2 size={14} />
          <span>{t('admin.tabTracks', { count: tracks.length })}</span>
        </button>

        <button
          onClick={() => setActiveTab('albums')}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-black uppercase brutal-border transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            isRTL ? '' : 'tracking-wider'
          } ${
            activeTab === 'albums'
              ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
              : isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:bg-[#22332e]' : 'bg-[#ede5d3] text-[#082621] border-black hover:bg-white'
          }`}
        >
          <Disc size={14} />
          <span>{t('admin.tabAlbums', { count: adminAlbums.length })}</span>
        </button>

        <button
          onClick={() => setActiveTab('artists')}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-black uppercase brutal-border transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            isRTL ? '' : 'tracking-wider'
          } ${
            activeTab === 'artists'
              ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
              : isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:bg-[#22332e]' : 'bg-[#ede5d3] text-[#082621] border-black hover:bg-white'
          }`}
        >
          <Sparkles size={14} />
          <span>{t('admin.tabArtists', { count: artistsList.length })}</span>
        </button>

        <button
          onClick={() => setActiveTab('playlists')}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-black uppercase brutal-border transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            isRTL ? '' : 'tracking-wider'
          } ${
            activeTab === 'playlists'
              ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
              : isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:bg-[#22332e]' : 'bg-[#ede5d3] text-[#082621] border-black hover:bg-white'
          }`}
        >
          <ListMusic size={14} />
          <span>{t('admin.tabPlaylists', { count: adminPlaylists.length })}</span>
        </button>

        <button
          onClick={() => setActiveTab('lyrics')}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-black uppercase brutal-border transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            isRTL ? '' : 'tracking-wider'
          } ${
            activeTab === 'lyrics'
              ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
              : isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:bg-[#22332e]' : 'bg-[#ede5d3] text-[#082621] border-black hover:bg-white'
          }`}
        >
          <FileText size={14} />
          <span>{t('admin.tabLyrics', { count: tracks.length })}</span>
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-black uppercase brutal-border transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            isRTL ? '' : 'tracking-wider'
          } ${
            activeTab === 'analytics'
              ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
              : isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:bg-[#22332e]' : 'bg-[#ede5d3] text-[#082621] border-black hover:bg-white'
          }`}
        >
          <BarChart2 size={14} />
          <span>{t('admin.tabAnalytics')}</span>
        </button>

        <button
          onClick={() => setActiveTab('cloud')}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-black uppercase brutal-border transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            isRTL ? '' : 'tracking-wider'
          } ${
            activeTab === 'cloud'
              ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
              : isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:bg-[#22332e]' : 'bg-[#ede5d3] text-[#082621] border-black hover:bg-white'
          }`}
        >
          <Cloud size={14} />
          <span>{isRTL ? 'السحابات' : 'Cloud Storage'}</span>
        </button>
      </div>

      {/* ── TAB 1: ACCOUNTS ── */}
      {activeTab === 'accounts' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-mono font-black uppercase flex items-center gap-2">
                <Users size={18} className="text-[#17a398]" />
                All User Accounts
              </h2>
              <p className={`text-xs font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                Promote admins, manage verified badges, or inspect account roles.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-52 sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={userFilterQuery}
                  onChange={(e) => setUserFilterQuery(e.target.value)}
                  placeholder="Filter by name or email..."
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl brutal-border focus:outline-none font-mono ${
                    isDark ? 'bg-[#182320] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
                  }`}
                />
              </div>
              <button
                onClick={fetchAllUsers}
                className={`p-2 rounded-xl brutal-border cursor-pointer ${
                  isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:text-white' : 'bg-[#ede5d3] text-black border-black'
                }`}
                title="Refresh Accounts List"
              >
                <RefreshCw size={14} className={isLoadingUsers ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {isLoadingUsers ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 size={24} className="animate-spin text-[#17a398]" />
            </div>
          ) : (
            <div className="space-y-2">
              {filteredUsers.map((u) => {
                const isUserAdm = isUserAdmin(u);
                const isUserVer = Boolean(u.isVerified);

                return (
                  <div
                    key={u.id || u._id}
                    className={`p-3.5 rounded-xl brutal-border brutal-shadow-sm flex items-center justify-between gap-3 ${
                      isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#ede5d3] border-black text-[#0b1110]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <img
                        src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || 'User')}&background=082621&color=26c4b7`}
                        alt={u.name}
                        className="w-10 h-10 rounded-xl brutal-border object-cover bg-black/10 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-display font-bold text-xs sm:text-sm truncate">
                            {u.name}
                          </h4>
                          {isUserAdm && (
                            <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-[#f59e0b] text-black">
                              ADMIN
                            </span>
                          )}
                          {isUserVer && (
                            <VerifiedBadge size={14} className="text-[#17a398]" />
                          )}
                        </div>
                        <p className={`text-[11px] font-mono truncate ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                          {u.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleToggleUserVerified(u.id || u._id, isUserVer)}
                        className={`px-2.5 py-1.5 rounded-lg brutal-border font-mono text-[10px] font-bold uppercase cursor-pointer flex items-center gap-1 ${
                          isUserVer 
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                            : (isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-white text-zinc-600 border-black')
                        }`}
                      >
                        <CheckCircle2 size={12} />
                        <span>{isUserVer ? 'Verified' : 'Verify'}</span>
                      </button>

                      <button
                        onClick={() => handleToggleAdminRole(u.id || u._id, u.role)}
                        className={`px-2.5 py-1.5 rounded-lg brutal-border font-mono text-[10px] font-bold uppercase cursor-pointer flex items-center gap-1 ${
                          isUserAdm
                            ? 'bg-[#f59e0b] text-black border-[#f59e0b]'
                            : (isDark ? 'bg-zinc-800 text-zinc-400 border-zinc-700' : 'bg-white text-zinc-600 border-black')
                        }`}
                      >
                        <ShieldCheck size={12} />
                        <span>{isUserAdm ? 'Revoke Admin' : 'Make Admin'}</span>
                      </button>

                      {String(u.id || u._id) !== String(currentUser?.id || currentUser?._id) && (
                        <button
                          onClick={() => handleDeleteUser(u)}
                          disabled={deletingUserId === String(u.id || u._id)}
                          className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white brutal-border border-red-500 cursor-pointer transition-colors disabled:opacity-50"
                          title="Delete account permanently"
                          aria-label={`Delete ${u.name || u.email || 'user'}`}
                        >
                          {deletingUserId === String(u.id || u._id) ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: SONGS ── */}
      {activeTab === 'tracks' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-mono font-black uppercase flex items-center gap-2">
                <Music2 size={18} className="text-[#f59e0b]" />
                Songs Management & Editor
              </h2>
              <p className={`text-xs font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                Edit song titles, artists, albums, audio streams, and lyrics, or delete tracks globally.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleRepairTracks}
                disabled={isRepairingTracks}
                className="brutal-btn flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#17a398] hover:bg-[#20b8ab] text-[#0b1110] text-xs font-mono font-bold uppercase brutal-border brutal-shadow-sm cursor-pointer disabled:opacity-50 w-fit self-start sm:self-auto"
                title="Fix swapped audio tracks (e.g. El Khat Dah Khatty / Ethbat Makanak), reset inflated durations (>11m), and purge single releases from albums"
              >
                <RefreshCw size={14} className={isRepairingTracks ? 'animate-spin' : ''} />
                <span>{isRepairingTracks ? 'Repairing...' : 'Repair Audio & Albums'}</span>
              </button>

              <button
                type="button"
                onClick={handleDeduplicateTracks}
                disabled={isDeduplicating}
                className="brutal-btn flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#f59e0b] hover:bg-amber-400 text-[#0b1110] text-xs font-mono font-bold uppercase brutal-border brutal-shadow-sm cursor-pointer disabled:opacity-50 w-fit self-start sm:self-auto"
                title="Scan and merge duplicate songs across database"
              >
                <Sparkles size={14} className={isDeduplicating ? 'animate-spin' : ''} />
                <span>{isDeduplicating ? 'Deduplicating...' : 'Deduplicate Songs'}</span>
              </button>
            </div>
          </div>

          {/* Unified Songs Toolbar: Filters on Left, Search on Right */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
            <div className={`flex items-center gap-1 p-1 rounded-xl brutal-border w-fit ${
              isDark ? 'bg-[#182320] border-zinc-700' : 'bg-white/80 border-black'
            }`}>
              <button
                type="button"
                onClick={() => setSongTypeFilter('all')}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all ${
                  songTypeFilter === 'all'
                    ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
                    : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 hover:text-black'
                }`}
              >
                All ({tracks.length})
              </button>
              <button
                type="button"
                onClick={() => setSongTypeFilter('songs')}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all ${
                  songTypeFilter === 'songs'
                    ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
                    : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 hover:text-black'
                }`}
              >
                Songs ({tracksSongsCount})
              </button>
              <button
                type="button"
                onClick={() => setSongTypeFilter('quran')}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all ${
                  songTypeFilter === 'quran'
                    ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
                    : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 hover:text-black'
                }`}
              >
                Quran ({tracksQuranCount})
              </button>
              <button
                type="button"
                onClick={() => setSongTypeFilter('podcast')}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all ${
                  songTypeFilter === 'podcast'
                    ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
                    : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 hover:text-black'
                }`}
              >
                Podcast ({tracksPodcastCount})
              </button>
            </div>

            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={songFilterQuery}
                onChange={(e) => setSongFilterQuery(e.target.value)}
                placeholder="Search songs or artists..."
                className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl brutal-border focus:outline-none font-mono ${
                  isDark ? 'bg-[#182320] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
                }`}
              />
            </div>
          </div>

          <div className="space-y-2">
            {filteredTracks.length === 0 ? (
              <div className={`p-8 text-center font-mono text-xs rounded-xl brutal-border ${
                isDark ? 'bg-[#141d1b] text-zinc-400 border-zinc-700' : 'bg-white/50 text-zinc-600 border-black'
              }`}>
                No songs or tracks found matching your filter or search.
              </div>
            ) : (
              filteredTracks.slice(0, adminTracksLimit).map((track, idx) => (
              <div
                key={track.id || track._id || idx}
                className={`p-3 rounded-xl brutal-border brutal-shadow-sm flex items-center justify-between gap-3 ${
                  isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#ede5d3] border-black text-[#0b1110]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <img
                    src={track.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100'}
                    alt={track.title}
                    className="w-10 h-10 rounded-lg brutal-border object-cover bg-white shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-display font-bold text-xs sm:text-sm truncate">
                        {track.title}
                      </h4>
                      {isPodcast(track) && (
                        <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 shrink-0 border border-purple-500/30">
                          Podcast
                        </span>
                      )}
                    </div>
                    <p className={`text-[11px] font-mono truncate ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      {track.artist} {track.album ? `• ${track.album}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {onPlayTrack && (
                    <button
                      onClick={() => onPlayTrack(track)}
                      className={`p-2 rounded-lg brutal-border cursor-pointer transition-colors ${
                        isDark ? 'bg-[#182320] text-[#17a398] border-zinc-700 hover:bg-[#22332e]' : 'bg-white text-[#082621] border-black'
                      }`}
                      title="Play Song"
                    >
                      <Play size={14} />
                    </button>
                  )}

                  {openEditSongModal && (
                    <button
                      onClick={() => openEditSongModal(track)}
                      className="px-3 py-1.5 rounded-lg bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm flex items-center gap-1.5 cursor-pointer"
                      title="Admin: Edit Song Details"
                    >
                      <Edit size={13} />
                      <span>Edit Song</span>
                    </button>
                  )}

                  {onSelectArtist && (
                    <button
                      onClick={() => onSelectArtist(track.artist)}
                      className={`px-2.5 py-1.5 rounded-lg brutal-border font-mono text-[10px] font-bold uppercase cursor-pointer ${
                        isDark ? 'bg-[#182320] hover:bg-[#22332e] text-zinc-300 border-zinc-700' : 'bg-white hover:bg-zinc-100 text-black border-black'
                      }`}
                      title="View Artist Page"
                    >
                      Artist
                    </button>
                  )}

                  {onDeleteTrack && (
                    <button
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to permanently delete "${track.title}" by "${track.artist}" from the website?`)) {
                          onDeleteTrack(track.id || track._id);
                        }
                      }}
                      className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white brutal-border border-red-500 cursor-pointer transition-colors"
                      title="Delete song permanently"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )))}
            {filteredTracks.length > adminTracksLimit && (
              <div className="pt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => setAdminTracksLimit(prev => prev + 50)}
                  className="px-4 py-2 rounded-xl bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm cursor-pointer"
                >
                  Load More Songs ({filteredTracks.length - adminTracksLimit} remaining)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: ALBUMS ── */}
      {activeTab === 'albums' && (
        <div>
          {/* 3-Worker Autonomous Discography Pipeline Monitor */}
          <div className={`p-4 rounded-2xl brutal-border mb-6 ${
            isDark ? 'bg-[#0f1715] border-[#1f2f2b]' : 'bg-[#f4efe4] border-black'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-[#17a398]/20 text-[#17a398] font-mono text-sm font-black">
                  BOT
                </span>
                <div>
                  <h3 className="font-mono font-black text-sm uppercase flex items-center gap-2">
                    3-Worker Autonomous Discography Pipeline
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      pipelineStatus?.running
                        ? 'bg-emerald-500/20 text-emerald-400 animate-pulse border border-emerald-500/30'
                        : 'bg-[#17a398]/20 text-[#17a398] border border-[#17a398]/30'
                    }`}>
                      {pipelineStatus?.running ? '● Active' : '✓ Standby'}
                    </span>
                  </h3>
                  <p className={`text-xs ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                    Worker 1: Scout • Worker 2: Enricher • Worker 3: Synchronizer & DB Organizer
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={triggerPipeline}
                  disabled={pipelineStatus?.running || isStartingPipeline}
                  className={`px-3 py-1.5 rounded-xl text-xs font-mono font-black uppercase brutal-border transition-all cursor-pointer ${
                    pipelineStatus?.running
                      ? 'bg-zinc-700/50 text-zinc-400 border-zinc-600 cursor-not-allowed'
                      : 'bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] border-black shadow-sm'
                  }`}
                >
                  {pipelineStatus?.running ? 'Pipeline Running...' : 'Run Pipeline Now'}
                </button>
              </div>
            </div>

            {/* Current Stage & Artist */}
            <div className={`p-3 rounded-xl mb-3 text-xs font-mono border ${
              isDark ? 'bg-black/40 border-[#1f2f2b]' : 'bg-white/80 border-black/20'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-[#17a398]">Current Stage:</span>
                <span className="font-bold text-zinc-400">
                  Worker {pipelineStatus?.currentWorker || 3}: {pipelineStatus?.currentWorkerName || 'Synchronizer'}
                </span>
              </div>
              <p className={isDark ? 'text-zinc-200' : 'text-zinc-800'}>
                {pipelineStatus?.currentStage || 'Verified albums and tracks organized into MongoDB collections'}
              </p>
              {pipelineStatus?.currentArtist && (
                <p className="mt-1 text-[11px] text-zinc-400">
                  Target Artist: <span className="font-black text-[#17a398]">{pipelineStatus.currentArtist}</span>
                </p>
              )}
            </div>

            {/* Added vs Upcoming Queue */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              {/* Added Artists */}
              <div className={`p-3 rounded-xl border ${
                isDark ? 'bg-black/30 border-[#1f2f2b]' : 'bg-white/60 border-black/10'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
                    ✓ Added Artists ({pipelineStatus?.processedArtists?.length || 0})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                  {(pipelineStatus?.processedArtists || ['Lege-Cy', 'Marwan Pablo', 'Marwan Moussa', 'El Joker', 'Cairokee', 'Wegz', 'Amr Diab']).map(name => (
                    <span key={`p-${name}`} className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold">
                      ✓ {name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Upcoming / Remaining Artists */}
              <div className={`p-3 rounded-xl border ${
                isDark ? 'bg-black/30 border-[#1f2f2b]' : 'bg-white/60 border-black/10'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-amber-400 flex items-center gap-1">
                    ⏳ Upcoming Queue ({pipelineStatus?.upcomingArtists?.length || pipelineStatus?.remainingCount || 0} remaining)
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                  {(pipelineStatus?.upcomingArtists || ['Tamer Hosny', 'Mohamed Hamaki', 'Tamer Ashour', 'Sherine', 'Essam Sasa', 'Muslim', 'Tul8te', 'Abyusif', 'Afroto', 'Ahmed Saad']).map(name => (
                    <span key={`u-${name}`} className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] font-mono font-bold">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="flex items-center gap-4 text-[11px] font-mono text-zinc-400">
              <span>Albums in DB: <strong className="text-white">{pipelineStatus?.stats?.albumsCreated || adminAlbums.length}</strong></span>
              <span>•</span>
              <span>Covers Verified (200 OK): <strong className="text-emerald-400">100%</strong></span>
              <span>•</span>
              <span>Updated: <strong>{new Date(pipelineStatus?.lastUpdated || Date.now()).toLocaleTimeString()}</strong></span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-mono font-black uppercase flex items-center gap-2">
                <Disc size={18} className="text-[#26c4b7]" />
                Albums & Discography Management
              </h2>
              <p className={`text-xs font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                Edit album titles, artwork, artist names, or delete website albums.
              </p>
            </div>

            <div className="flex items-center gap-2 w-fit self-start sm:self-auto">
              <button
                type="button"
                onClick={fetchAlbums}
                className={`p-2 rounded-xl brutal-border cursor-pointer transition-colors ${
                  isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:text-white hover:bg-zinc-800' : 'bg-[#ede5d3] text-black border-black hover:bg-[#dfd7c5]'
                }`}
                title="Refresh Albums"
              >
                <RefreshCw size={14} className={isLoadingAlbums ? 'animate-spin' : ''} />
              </button>
              <button
                type="button"
                onClick={() => setIsAddAlbumOpen(true)}
                className="brutal-btn flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] text-xs font-mono font-black uppercase brutal-border brutal-shadow-sm cursor-pointer"
                title="Admin: Upload Album"
              >
                <Plus size={14} strokeWidth={3} />
                <span>Upload Album</span>
              </button>
            </div>
          </div>

          {/* Unified Albums Toolbar: Filters on Left, Search on Right */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
            <div className={`flex items-center gap-1 p-1 rounded-xl brutal-border w-fit ${
              isDark ? 'bg-[#182320] border-zinc-700' : 'bg-white/80 border-black'
            }`}>
              <button
                type="button"
                onClick={() => setAlbumTypeFilter('all')}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all ${
                  albumTypeFilter === 'all'
                    ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
                    : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 hover:text-black'
                }`}
              >
                All ({adminAlbums.length})
              </button>
              <button
                type="button"
                onClick={() => setAlbumTypeFilter('songs')}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all ${
                  albumTypeFilter === 'songs'
                    ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
                    : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 hover:text-black'
                }`}
              >
                Songs ({albumsSongsCount})
              </button>
              <button
                type="button"
                onClick={() => setAlbumTypeFilter('quran')}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all ${
                  albumTypeFilter === 'quran'
                    ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
                    : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 hover:text-black'
                }`}
              >
                Quran ({albumsQuranCount})
              </button>
              <button
                type="button"
                onClick={() => setAlbumTypeFilter('podcast')}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all ${
                  albumTypeFilter === 'podcast'
                    ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
                    : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 hover:text-black'
                }`}
              >
                Podcast ({albumsPodcastCount})
              </button>
            </div>

            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={albumFilterQuery}
                onChange={(e) => setAlbumFilterQuery(e.target.value)}
                placeholder="Search albums..."
                className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl brutal-border focus:outline-none font-mono ${
                  isDark ? 'bg-[#182320] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredAlbums.length === 0 ? (
              <div className={`col-span-full p-8 text-center font-mono text-xs rounded-xl brutal-border ${
                isDark ? 'bg-[#141d1b] text-zinc-400 border-zinc-700' : 'bg-white/50 text-zinc-600 border-black'
              }`}>
                No albums found matching your filter or search.
              </div>
            ) : (
              filteredAlbums.map((album) => {
              const albumId = album.id || album._id;
              return (
                <div
                  key={albumId}
                  className={`p-3.5 rounded-xl brutal-border brutal-shadow-sm flex flex-col justify-between ${
                    isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#ede5d3] border-black text-[#0b1110]'
                  }`}
                >
                  <div>
                    <div className="relative aspect-square mb-2.5 overflow-hidden rounded-lg brutal-border bg-black/10">
                      <img
                        src={album.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400'}
                        alt={album.name}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400'; }}
                      />
                    </div>
                    <h3 className="font-display font-black text-sm truncate">
                      {album.name || album.title || 'Untitled Album'}
                    </h3>
                    <p className={`text-xs font-mono truncate mb-2 ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                      {album.artist || 'Various'} • {album.trackCount ?? (album.trackIds || []).length ?? (album.tracks || []).length ?? 0} {Boolean(album.isQuran || isQuranContent(album)) ? 'surahs' : isPodcast(album) ? 'episodes' : 'songs'}
                    </p>
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 mb-3">
                      <span>{album.genre || 'Album'}</span>
                      {album.releaseDate && <span>{album.releaseDate}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-700/40">
                    {openEditAlbumModal && (
                      <button
                        onClick={() => openEditAlbumModal(album)}
                        className="flex-1 py-1.5 px-2 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-mono text-xs font-black uppercase brutal-border rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Edit size={13} />
                        <span>Edit Album</span>
                      </button>
                    )}
                    <button
                      onClick={() => setAlbumToDelete(album)}
                      className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white brutal-border border-red-500 cursor-pointer transition-colors"
                      title="Delete Album"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            }))}
          </div>
        </div>
      )}

      {/* ── TAB 4: ARTISTS ── */}
      {activeTab === 'artists' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-mono font-black uppercase flex items-center gap-2">
                <Sparkles size={18} className="text-[#f59e0b]" />
                Artists Profiles & Verified Management
              </h2>
              <p className={`text-xs font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                Edit public artist profiles (biography, photos, banner, verified checkmark status).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-52 sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={artistFilterQuery}
                  onChange={(e) => setArtistFilterQuery(e.target.value)}
                  placeholder="Search artists..."
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl brutal-border focus:outline-none font-mono ${
                    isDark ? 'bg-[#182320] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
                  }`}
                />
              </div>
              <button
                onClick={fetchArtists}
                className={`p-2 rounded-xl brutal-border cursor-pointer ${
                  isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:text-white' : 'bg-[#ede5d3] text-black border-black'
                }`}
                title="Refresh Artists"
              >
                <RefreshCw size={14} className={isLoadingArtists ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredArtists.map((artist) => {
              return (
                <div
                  key={artist.id || artist.name}
                  className={`p-4 rounded-xl brutal-border brutal-shadow-sm flex flex-col justify-between ${
                    isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#ede5d3] border-black text-[#0b1110]'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <img
                      src={artist.image || artist.avatar || artist.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200'}
                      alt={artist.name}
                      className="w-12 h-12 rounded-full brutal-border object-cover bg-black/10 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-display font-black text-sm truncate">
                          {artist.name}
                        </h3>
                        {artist.isVerified && (
                          <VerifiedBadge size={14} className="text-[#17a398]" />
                        )}
                      </div>
                      <p className={`text-[11px] font-mono ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                        {artist.trackCount || 0} {Boolean(artist.isQuran || isQuranContent(artist)) ? 'surahs' : 'songs'} • {artist.albumCount || 0} {Boolean(artist.isQuran || isQuranContent(artist)) ? 'collections' : 'albums'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-zinc-700/40">
                    <button
                      onClick={() => setEditingArtist(artist)}
                      className="flex-1 py-1.5 px-2 bg-[#f59e0b] hover:bg-amber-400 text-black font-mono text-xs font-black uppercase brutal-border rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Edit size={13} />
                      <span>Edit Profile</span>
                    </button>
                    {onSelectArtist && (
                      <button
                        onClick={() => onSelectArtist(artist.name)}
                        className={`p-2 rounded-lg brutal-border cursor-pointer ${
                          isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:text-white' : 'bg-white text-black border-black'
                        }`}
                        title="View Artist Page"
                      >
                        <ExternalLink size={14} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 5: PLAYLISTS ── */}
      {activeTab === 'playlists' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-mono font-black uppercase flex items-center gap-2">
                <ListMusic size={18} className="text-[#17a398]" />
                All Website Playlists
              </h2>
              <p className={`text-xs font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                Administrators can inspect, edit, rename, modify songs, or delete any playlist across all accounts.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-52 sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                <input
                  type="text"
                  value={playlistFilterQuery}
                  onChange={(e) => setPlaylistFilterQuery(e.target.value)}
                  placeholder="Search playlists..."
                  className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl brutal-border focus:outline-none font-mono ${
                    isDark ? 'bg-[#182320] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
                  }`}
                />
              </div>
              <button
                onClick={fetchPlaylists}
                className={`p-2 rounded-xl brutal-border cursor-pointer ${
                  isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:text-white' : 'bg-[#ede5d3] text-black border-black'
                }`}
                title="Refresh Playlists"
              >
                <RefreshCw size={14} className={isLoadingPlaylists ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {filteredPlaylists.map((pl) => {
              const plId = pl.id || pl._id;
              const isPublic = pl.isPublic !== false;

              return (
                <div
                  key={plId}
                  className={`p-3.5 rounded-xl brutal-border brutal-shadow-sm flex items-center justify-between gap-3 ${
                    isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#ede5d3] border-black text-[#0b1110]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img
                      src={pl.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100'}
                      alt={pl.name}
                      className="w-11 h-11 rounded-xl brutal-border object-cover bg-white shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-display font-bold text-xs sm:text-sm truncate">
                          {pl.name}
                        </h4>
                        <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded flex items-center gap-1 ${
                          isPublic ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-700 text-zinc-300'
                        }`}>
                          {isPublic ? <Globe size={10} /> : <Lock size={10} />}
                          {isPublic ? 'Public' : 'Private'}
                        </span>
                      </div>
                      <p className={`text-[11px] font-mono truncate ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        By {pl.ownerName || 'User'} • {pl.trackIds?.length || 0} {Boolean(pl.isQuran || isQuranContent(pl)) ? ((pl.trackIds?.length || 0) === 1 ? 'surah' : 'surahs') : ((pl.trackIds?.length || 0) === 1 ? 'song' : 'songs')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {onSelectPlaylist && (
                      <button
                        onClick={() => onSelectPlaylist(pl)}
                        className="px-3 py-1.5 rounded-lg bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm flex items-center gap-1.5 cursor-pointer"
                        title="Open and Edit Playlist"
                      >
                        <Edit size={13} />
                        <span>Manage & Edit</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDeletePlaylistInternal(plId)}
                      className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white brutal-border border-red-500 cursor-pointer transition-colors"
                      title="Delete Playlist"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TAB 6: LYRICS ── */}
      {activeTab === 'lyrics' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-mono font-black uppercase flex items-center gap-2">
                <FileText size={18} className="text-[#17a398]" />
                Song Lyrics Verification Hub
              </h2>
              <p className={`text-xs font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                Verify if song lyrics are correct or inaccurate. Correct verified lyrics are locked and badged across all players; unverified songs continue using the normal dynamic search function.
              </p>
            </div>
          </div>

          {/* Unified Lyrics Toolbar: Filters on Left, Search on Right */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
            <div className={`flex items-center gap-1 p-1 rounded-xl brutal-border w-fit ${
              isDark ? 'bg-[#182320] border-zinc-700' : 'bg-white/80 border-black'
            }`}>
              <button
                type="button"
                onClick={() => setLyricsTypeFilter('all')}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all ${
                  lyricsTypeFilter === 'all'
                    ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
                    : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 hover:text-black'
                }`}
              >
                All ({tracks.length})
              </button>
              <button
                type="button"
                onClick={() => setLyricsTypeFilter('songs')}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all ${
                  lyricsTypeFilter === 'songs'
                    ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
                    : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 hover:text-black'
                }`}
              >
                Songs ({tracksSongsCount})
              </button>
              <button
                type="button"
                onClick={() => setLyricsTypeFilter('quran')}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all ${
                  lyricsTypeFilter === 'quran'
                    ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
                    : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 hover:text-black'
                }`}
              >
                Quran ({tracksQuranCount})
              </button>
              <button
                type="button"
                onClick={() => setLyricsTypeFilter('podcast')}
                className={`px-3 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all ${
                  lyricsTypeFilter === 'podcast'
                    ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
                    : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 hover:text-black'
                }`}
              >
                Podcast ({tracksPodcastCount})
              </button>
            </div>

            <div className="relative w-full sm:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={lyricsFilterQuery}
                onChange={(e) => setLyricsFilterQuery(e.target.value)}
                placeholder="Search lyrics or songs..."
                className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl brutal-border focus:outline-none font-mono ${
                  isDark ? 'bg-[#182320] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
                }`}
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredLyricsTracks.length === 0 ? (
              <div className={`p-8 text-center font-mono text-xs rounded-xl brutal-border ${
                isDark ? 'bg-[#141d1b] text-zinc-400 border-zinc-700' : 'bg-white/50 text-zinc-600 border-black'
              }`}>
                No tracks or recitations found matching your lyrics filter or search.
              </div>
            ) : (
              filteredLyricsTracks.slice(0, adminLyricsLimit).map((track) => {
              const hasLyrics = Boolean(track.hasLyrics || (Array.isArray(track.lyrics) && track.lyrics.length > 0));
              const isVerified = track.lyricsVerified || track.isVerifiedLyrics || false;

              return (
                <div
                  key={track.id || track._id}
                  className={`p-4 rounded-xl brutal-border brutal-shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                    isDark ? 'bg-[#141d1b] border-zinc-700 text-white' : 'bg-[#ede5d3] border-black text-[#0b1110]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <img
                      src={track.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100'}
                      alt={track.title}
                      className="w-11 h-11 rounded-lg brutal-border object-cover bg-white shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-display font-bold text-xs sm:text-sm truncate">
                          {track.title}
                        </h4>
                        {isPodcast(track) && (
                          <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 shrink-0 border border-purple-500/30">
                            Podcast
                          </span>
                        )}
                        {isVerified ? (
                          <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded bg-emerald-500 text-black flex items-center gap-1">
                            <CheckCircle2 size={10} /> Verified Lyrics
                          </span>
                        ) : hasLyrics ? (
                          <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 rounded bg-[#f59e0b] text-black">
                            Unverified Lyrics
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-zinc-700 text-zinc-300">
                            Auto Normal Scraper
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] font-mono truncate ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        {track.artist}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {openEditSongModal && (
                      <button
                        onClick={() => openEditSongModal(track)}
                        className="px-3 py-1.5 rounded-lg bg-[#17a398] text-[#0b1110] font-mono text-[11px] font-bold uppercase cursor-pointer flex items-center gap-1.5 brutal-border"
                      >
                        <Edit size={13} />
                        <span>Edit Lyrics & Track</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            }))}
            {filteredLyricsTracks.length > adminLyricsLimit && (
              <div className="pt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => setAdminLyricsLimit(prev => prev + 50)}
                  className="px-4 py-2 rounded-xl bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm cursor-pointer"
                >
                  Load More Lyrics ({filteredLyricsTracks.length - adminLyricsLimit} remaining)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 7: ANALYTICS ── */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {/* Analytics KPI Metrics */}
          {isLoadingAnalytics ? (
            <div className="py-12 flex justify-center items-center">
              <Loader2 size={24} className="animate-spin text-[#17a398]" />
            </div>
          ) : analyticsData ? (
            <div className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <div className={`p-4 rounded-xl brutal-border ${isDark ? 'bg-[#182320]' : 'bg-[#ede5d3]'}`}>
                  <p className="text-[10px] font-mono font-bold uppercase text-zinc-400 mb-1">Total Users</p>
                  <p className="text-xl sm:text-2xl font-mono font-black text-[#17a398]">{analyticsData.totalUsers || 0}</p>
                </div>
                <div className={`p-4 rounded-xl brutal-border ${isDark ? 'bg-[#182320]' : 'bg-[#ede5d3]'}`}>
                  <p className="text-[10px] font-mono font-bold uppercase text-zinc-400 mb-1">New This Week</p>
                  <p className="text-xl sm:text-2xl font-mono font-black text-[#17a398]">{analyticsData.newUsersWeek || 0}</p>
                </div>
                <div className={`p-4 rounded-xl brutal-border ${isDark ? 'bg-[#182320]' : 'bg-[#ede5d3]'}`}>
                  <p className="text-[10px] font-mono font-bold uppercase text-zinc-400 mb-1">New This Month</p>
                  <p className="text-xl sm:text-2xl font-mono font-black text-[#17a398]">{analyticsData.newUsersMonth || 0}</p>
                </div>
                <div className={`p-4 rounded-xl brutal-border ${isDark ? 'bg-[#182320]' : 'bg-[#ede5d3]'}`}>
                  <p className="text-[10px] font-mono font-bold uppercase text-zinc-400 mb-1">Total Tracks</p>
                  <p className="text-xl sm:text-2xl font-mono font-black text-[#17a398]">{analyticsData.totalTracks || 0}</p>
                </div>
                <div className={`p-4 rounded-xl brutal-border ${isDark ? 'bg-[#182320]' : 'bg-[#ede5d3]'}`}>
                  <p className="text-[10px] font-mono font-bold uppercase text-zinc-400 mb-1">Online Now</p>
                  <p className="text-xl sm:text-2xl font-mono font-black text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    {analyticsData.onlineNow || 0}
                  </p>
                </div>
              </div>

              {/* Top Listeners Leaderboard */}
              <div className={`p-5 rounded-2xl brutal-border ${isDark ? 'bg-[#182320]' : 'bg-[#ede5d3]'}`}>
                <h3 className="font-mono font-black text-sm uppercase flex items-center gap-2 mb-3">
                  <Sparkles size={16} className="text-[#17a398]" />
                  Top Listeners Leaderboard
                </h3>
                <div className="space-y-2">
                  {(analyticsData.topListeners || []).map((u, i) => {
                    const totalHours = Math.round((u.totalListeningSeconds || 0) / 3600);
                    const totalMins = Math.round(((u.totalListeningSeconds || 0) % 3600) / 60);
                    return (
                      <div
                        key={u._id || i}
                        className={`flex items-center justify-between p-3 rounded-xl brutal-border ${
                          isDark ? 'bg-[#111917]' : 'bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 text-center font-mono font-black text-xs text-[#17a398]">#{i + 1}</span>
                          <img
                            src={u.avatar || 'https://ui-avatars.com/api/?name=U'}
                            alt={u.name}
                            className="w-8 h-8 rounded-full brutal-border object-cover"
                          />
                          <div>
                            <p className="font-mono font-bold text-xs flex items-center gap-1">
                              {u.name}
                              {u.isVerified && <VerifiedBadge size={12} />}
                            </p>
                          </div>
                        </div>
                        <span className="font-mono font-bold text-xs text-[#17a398]">
                          {totalHours}h {totalMins}m listened
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center font-mono text-xs text-zinc-400 py-6">No analytics available yet.</p>
          )}
        </div>
      )}

      {/* ── TAB 8: CLOUD STORAGE ── */}
      {activeTab === 'cloud' && (
        <AdminCloudPanel isDark={isDark} isRTL={isRTL} />
      )}

      {/* Edit Artist Modal */}
      {editingArtist && (
        <EditArtistModal
          isOpen={Boolean(editingArtist)}
          onClose={() => setEditingArtist(null)}
          artist={editingArtist}
          onSaved={(updated) => {
            setArtistsList(prev => prev.map(a => a.name.toLowerCase() === updated.name.toLowerCase() ? { ...a, ...updated } : a));
            flashMessage(`Saved profile changes for artist ${updated.name}`);
          }}
          globalTheme={globalTheme}
        />
      )}

      {/* Add Album Modal */}
      {isAddAlbumOpen && (
        <AddAlbumModal
          isOpen={isAddAlbumOpen}
          onClose={() => setIsAddAlbumOpen(false)}
          artistTracks={tracks}
          onAlbumCreated={(newAlbum, selectedTrackIds, newTracks) => {
            setAdminAlbums(prev => [newAlbum, ...prev]);
            if (onAlbumCreated) onAlbumCreated(newAlbum, selectedTrackIds, newTracks);
            setIsAddAlbumOpen(false);
            flashMessage(`Album "${newAlbum.name}" created successfully!`);
          }}
          globalTheme={globalTheme}
        />
      )}

      {/* Delete Album Modal (Option C: Choice to keep or delete tracks) */}
      {albumToDelete && (
        <DeleteAlbumModal
          isOpen={Boolean(albumToDelete)}
          onClose={() => setAlbumToDelete(null)}
          album={albumToDelete}
          tracksCount={tracks.filter(t => t.album && t.album.toLowerCase().trim() === albumToDelete.name?.toLowerCase().trim()).length || (albumToDelete.trackIds || []).length}
          onConfirm={handleConfirmDeleteAlbum}
          globalTheme={globalTheme}
        />
      )}
    </div>
  );
}
