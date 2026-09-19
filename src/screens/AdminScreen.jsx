import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Users, Music2, FileText, CheckCircle2, XCircle, Search, 
  Trash2, Edit, RefreshCw, Loader2, UserCheck, Check, ArrowLeft, Disc,
  Calendar, Mail, ShieldAlert, Sparkles, ExternalLink, ListMusic, Eye,
  Lock, Globe, Play, Plus
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { isUserAdmin } from '../utils/adminUtils';
import { isQuranContent } from '../utils/quranUtils';
import EditArtistModal from '../components/EditArtistModal';
import AddAlbumModal from '../components/AddAlbumModal';
import VerifiedBadge from '../components/VerifiedBadge';

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
  const isAdmin = isUserAdmin(currentUser);

  // 'accounts' | 'tracks' | 'albums' | 'artists' | 'playlists' | 'lyrics'
  const [activeTab, setActiveTab] = useState('accounts');

  // Accounts State
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [userFilterQuery, setUserFilterQuery] = useState('');

  // Songs State
  const [songFilterQuery, setSongFilterQuery] = useState('');
  const [songTypeFilter, setSongTypeFilter] = useState('all'); // 'all' | 'songs' | 'quran'

  // Albums State
  const [adminAlbums, setAdminAlbums] = useState(albums || []);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(false);
  const [albumFilterQuery, setAlbumFilterQuery] = useState('');
  const [albumTypeFilter, setAlbumTypeFilter] = useState('all'); // 'all' | 'songs' | 'quran'
  const [isAddAlbumOpen, setIsAddAlbumOpen] = useState(false);

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
  const [lyricsTypeFilter, setLyricsTypeFilter] = useState('all'); // 'all' | 'songs' | 'quran'

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

  const handleDeleteAlbumInternal = async (albumId) => {
    if (!window.confirm(`Are you sure you want to permanently delete this album?`)) return;
    try {
      await fetch(`${API_BASE_URL}/api/albums/${encodeURIComponent(albumId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      setAdminAlbums(prev => prev.filter(a => String(a.id || a._id) !== String(albumId)));
      if (onDeleteAlbum) onDeleteAlbum(albumId);
      flashMessage('Album deleted successfully');
    } catch (err) {
      console.error('Delete album error:', err);
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

  if (!isAdmin) {
    return (
      <div className={`flex-1 flex flex-col items-center justify-center p-8 select-none text-center ${
        isDark ? 'bg-[#0b1110] text-white' : 'bg-[#17a398] text-[#0b1110]'
      }`}>
        <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-500 flex items-center justify-center mb-4 brutal-border">
          <ShieldAlert size={32} />
        </div>
        <h2 className="text-xl font-mono font-black uppercase mb-2">Access Denied</h2>
        <p className="text-sm max-w-md font-sans mb-6 text-zinc-400">
          Administrator privileges are required to access this portal. Designated site administrators: <strong>Lio</strong>, <strong>Ali</strong>, and <strong>Tester</strong>.
        </p>
        {onBack && (
          <button
            onClick={onBack}
            className="px-5 py-2.5 bg-[#17a398] text-[#0b1110] font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm cursor-pointer rounded-xl"
          >
            Back to Home
          </button>
        )}
      </div>
    );
  }

  // Filter lists & counts
  const tracksQuranCount = tracks.filter(t => isQuranContent(t)).length;
  const tracksSongsCount = tracks.length - tracksQuranCount;

  const albumsQuranCount = adminAlbums.filter(a => isQuranContent(a)).length;
  const albumsSongsCount = adminAlbums.length - albumsQuranCount;

  const filteredUsers = users.filter(u => {
    const q = userFilterQuery.toLowerCase();
    return (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
  });

  const filteredTracks = tracks.filter(t => {
    if (songTypeFilter === 'quran' && !isQuranContent(t)) return false;
    if (songTypeFilter === 'songs' && isQuranContent(t)) return false;
    const q = songFilterQuery.toLowerCase();
    return (t.title || '').toLowerCase().includes(q) || (t.artist || '').toLowerCase().includes(q) || (t.album || '').toLowerCase().includes(q);
  });

  const filteredAlbums = adminAlbums.filter(a => {
    if (albumTypeFilter === 'quran' && !isQuranContent(a)) return false;
    if (albumTypeFilter === 'songs' && isQuranContent(a)) return false;
    const q = albumFilterQuery.toLowerCase();
    return (a.name || '').toLowerCase().includes(q) || (a.artist || '').toLowerCase().includes(q);
  });

  const filteredLyricsTracks = tracks.filter(t => {
    if (lyricsTypeFilter === 'quran' && !isQuranContent(t)) return false;
    if (lyricsTypeFilter === 'songs' && isQuranContent(t)) return false;
    const q = lyricsFilterQuery.toLowerCase();
    return (t.title || '').toLowerCase().includes(q) || (t.artist || '').toLowerCase().includes(q) || (t.album || '').toLowerCase().includes(q);
  });

  const filteredArtists = artistsList.filter(a => {
    const q = artistFilterQuery.toLowerCase();
    return (a.name || '').toLowerCase().includes(q);
  });

  const filteredPlaylists = adminPlaylists.filter(p => {
    const q = playlistFilterQuery.toLowerCase();
    return (p.name || '').toLowerCase().includes(q) || (p.ownerName || '').toLowerCase().includes(q);
  });

  return (
    <div className={`flex-1 overflow-y-auto pb-32 p-4 md:p-8 select-none transition-colors ${
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
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-[#f59e0b] text-black flex items-center justify-center brutal-border shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-mono font-black uppercase tracking-wider">
                Admin Control Center
              </h1>
              <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded bg-[#f59e0b] text-black">
                Root Admin
              </span>
            </div>
            <p className={`text-xs font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
              Full administrative privileges: Edit artists, albums, songs, playlists, user roles, and lyrics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
          <div className={`px-3 py-1.5 rounded-xl brutal-border flex items-center gap-1.5 ${
            isDark ? 'bg-[#182320] border-zinc-700' : 'bg-[#ede5d3] border-black'
          }`}>
            <Users size={14} className="text-[#17a398]" />
            <span><strong>{users.length}</strong> Users</span>
          </div>
          <div className={`px-3 py-1.5 rounded-xl brutal-border flex items-center gap-1.5 ${
            isDark ? 'bg-[#182320] border-zinc-700' : 'bg-[#ede5d3] border-black'
          }`}>
            <Music2 size={14} className="text-[#f59e0b]" />
            <span><strong>{tracks.length}</strong> Songs</span>
          </div>
          <div className={`px-3 py-1.5 rounded-xl brutal-border flex items-center gap-1.5 ${
            isDark ? 'bg-[#182320] border-zinc-700' : 'bg-[#ede5d3] border-black'
          }`}>
            <Disc size={14} className="text-[#26c4b7]" />
            <span><strong>{adminAlbums.length}</strong> Albums</span>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="mb-6 p-3.5 rounded-xl bg-emerald-500/15 border-2 border-emerald-500 text-emerald-400 text-xs font-mono font-black flex items-center gap-2">
          <Check size={16} /> {statusMessage}
        </div>
      )}

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 border-b-2 border-zinc-700/50">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-black uppercase tracking-wider brutal-border transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'accounts'
              ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
              : isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:bg-[#22332e]' : 'bg-[#ede5d3] text-[#082621] border-black hover:bg-white'
          }`}
        >
          <Users size={14} />
          <span>Accounts ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tracks')}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-black uppercase tracking-wider brutal-border transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'tracks'
              ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
              : isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:bg-[#22332e]' : 'bg-[#ede5d3] text-[#082621] border-black hover:bg-white'
          }`}
        >
          <Music2 size={14} />
          <span>Songs ({tracks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('albums')}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-black uppercase tracking-wider brutal-border transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'albums'
              ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
              : isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:bg-[#22332e]' : 'bg-[#ede5d3] text-[#082621] border-black hover:bg-white'
          }`}
        >
          <Disc size={14} />
          <span>Albums ({adminAlbums.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('artists')}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-black uppercase tracking-wider brutal-border transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'artists'
              ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
              : isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:bg-[#22332e]' : 'bg-[#ede5d3] text-[#082621] border-black hover:bg-white'
          }`}
        >
          <Sparkles size={14} />
          <span>Artists ({artistsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('playlists')}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-black uppercase tracking-wider brutal-border transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'playlists'
              ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
              : isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:bg-[#22332e]' : 'bg-[#ede5d3] text-[#082621] border-black hover:bg-white'
          }`}
        >
          <ListMusic size={14} />
          <span>Playlists ({adminPlaylists.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('lyrics')}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-black uppercase tracking-wider brutal-border transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'lyrics'
              ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
              : isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:bg-[#22332e]' : 'bg-[#ede5d3] text-[#082621] border-black hover:bg-white'
          }`}
        >
          <FileText size={14} />
          <span>Lyrics Hub</span>
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
              <input
                type="text"
                value={userFilterQuery}
                onChange={(e) => setUserFilterQuery(e.target.value)}
                placeholder="Filter by name or email..."
                className={`p-2 px-3 text-xs rounded-xl brutal-border focus:outline-none w-52 sm:w-64 font-mono ${
                  isDark ? 'bg-[#182320] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
                }`}
              />
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-mono font-black uppercase flex items-center gap-2">
                <Music2 size={18} className="text-[#f59e0b]" />
                Songs Management & Editor
              </h2>
              <p className={`text-xs font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                Edit song titles, artists, albums, audio streams, and lyrics, or delete tracks globally.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className={`flex items-center gap-1 p-1 rounded-xl brutal-border ${
                isDark ? 'bg-[#182320] border-zinc-700' : 'bg-white/80 border-black'
              }`}>
                <button
                  type="button"
                  onClick={() => setSongTypeFilter('all')}
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all ${
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
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all ${
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
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all ${
                    songTypeFilter === 'quran'
                      ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
                      : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 hover:text-black'
                  }`}
                >
                  Quran ({tracksQuranCount})
                </button>
              </div>

              <input
                type="text"
                value={songFilterQuery}
                onChange={(e) => setSongFilterQuery(e.target.value)}
                placeholder="Search songs..."
                className={`p-2 px-3 text-xs rounded-xl brutal-border focus:outline-none w-48 sm:w-56 font-mono ${
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
              filteredTracks.map((track, idx) => (
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
                    <h4 className="font-display font-bold text-xs sm:text-sm truncate">
                      {track.title}
                    </h4>
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
          </div>
        </div>
      )}

      {/* ── TAB 3: ALBUMS ── */}
      {activeTab === 'albums' && (
        <div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-mono font-black uppercase flex items-center gap-2">
                <Disc size={18} className="text-[#26c4b7]" />
                Albums & Discography Management
              </h2>
              <p className={`text-xs font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                Edit album titles, artwork, artist names, or delete website albums.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className={`flex items-center gap-1 p-1 rounded-xl brutal-border ${
                isDark ? 'bg-[#182320] border-zinc-700' : 'bg-white/80 border-black'
              }`}>
                <button
                  type="button"
                  onClick={() => setAlbumTypeFilter('all')}
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all ${
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
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all ${
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
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all ${
                    albumTypeFilter === 'quran'
                      ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
                      : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 hover:text-black'
                  }`}
                >
                  Quran ({albumsQuranCount})
                </button>
              </div>

              <input
                type="text"
                value={albumFilterQuery}
                onChange={(e) => setAlbumFilterQuery(e.target.value)}
                placeholder="Search albums..."
                className={`p-2 px-3 text-xs rounded-xl brutal-border focus:outline-none w-48 sm:w-56 font-mono ${
                  isDark ? 'bg-[#182320] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
                }`}
              />
              <button
                onClick={fetchAlbums}
                className={`p-2 rounded-xl brutal-border cursor-pointer ${
                  isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:text-white' : 'bg-[#ede5d3] text-black border-black'
                }`}
                title="Refresh Albums"
              >
                <RefreshCw size={14} className={isLoadingAlbums ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setIsAddAlbumOpen(true)}
                className="brutal-btn flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] text-xs font-mono font-black uppercase brutal-border brutal-shadow-sm cursor-pointer"
                title="Admin: Upload Album"
              >
                <Plus size={14} strokeWidth={3} />
                <span>Upload Album</span>
              </button>
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
                      {album.name}
                    </h3>
                    <p className={`text-xs font-mono truncate mb-2 ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                      {album.artist}
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
                      onClick={() => handleDeleteAlbumInternal(albumId)}
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
              <input
                type="text"
                value={artistFilterQuery}
                onChange={(e) => setArtistFilterQuery(e.target.value)}
                placeholder="Search artists..."
                className={`p-2 px-3 text-xs rounded-xl brutal-border focus:outline-none w-52 sm:w-64 font-mono ${
                  isDark ? 'bg-[#182320] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
                }`}
              />
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
                      src={artist.avatar || artist.cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=200'}
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
              <input
                type="text"
                value={playlistFilterQuery}
                onChange={(e) => setPlaylistFilterQuery(e.target.value)}
                placeholder="Search playlists..."
                className={`p-2 px-3 text-xs rounded-xl brutal-border focus:outline-none w-52 sm:w-64 font-mono ${
                  isDark ? 'bg-[#182320] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
                }`}
              />
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-mono font-black uppercase flex items-center gap-2">
                <FileText size={18} className="text-[#17a398]" />
                Song Lyrics Verification Hub
              </h2>
              <p className={`text-xs font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                Verify if song lyrics are correct or inaccurate. Correct verified lyrics are locked and badged across all players; unverified songs continue using the normal dynamic search function.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className={`flex items-center gap-1 p-1 rounded-xl brutal-border ${
                isDark ? 'bg-[#182320] border-zinc-700' : 'bg-white/80 border-black'
              }`}>
                <button
                  type="button"
                  onClick={() => setLyricsTypeFilter('all')}
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all ${
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
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all ${
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
                  className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg cursor-pointer transition-all ${
                    lyricsTypeFilter === 'quran'
                      ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
                      : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-700 hover:text-black'
                  }`}
                >
                  Quran ({tracksQuranCount})
                </button>
              </div>

              <input
                type="text"
                value={lyricsFilterQuery}
                onChange={(e) => setLyricsFilterQuery(e.target.value)}
                placeholder="Search lyrics..."
                className={`p-2 px-3 text-xs rounded-xl brutal-border focus:outline-none w-48 sm:w-56 font-mono ${
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
              filteredLyricsTracks.map((track) => {
              const hasLyrics = Array.isArray(track.lyrics) && track.lyrics.length > 0;
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
          </div>
        </div>
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
    </div>
  );
}
