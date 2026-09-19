import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Users, Music2, FileText, CheckCircle2, XCircle, Search, 
  Trash2, Edit, RefreshCw, Loader2, UserCheck, Check, ArrowLeft, Disc,
  Calendar, Mail, ShieldAlert, Sparkles, ExternalLink
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import { isUserAdmin } from '../utils/adminUtils';
import EditArtistModal from '../components/EditArtistModal';
import VerifiedBadge from '../components/VerifiedBadge';

export default function AdminScreen({
  currentUser,
  tracks = [],
  onDeleteTrack,
  onSelectArtist,
  onSelectTrack,
  onBack,
  globalTheme = 'dark'
}) {
  const isDark = globalTheme === 'dark';
  const isAdmin = isUserAdmin(currentUser);

  const [activeTab, setActiveTab] = useState('accounts'); // 'accounts' | 'tracks' | 'lyrics'
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [userFilterQuery, setUserFilterQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState(null);

  // Edit Artist State
  const [editingArtist, setEditingArtist] = useState(null);

  const token = localStorage.getItem('liofy_token') || '';

  // Fetch all accounts without searching
  const fetchAllUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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

  useEffect(() => {
    if (isAdmin) {
      fetchAllUsers();
    }
  }, [isAdmin]);

  const handleToggleAdminRole = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role: newRole })
      });
      const data = await res.json();
      if (data.success) {
        setUsers(prev => prev.map(u => u.id === userId || u._id === userId ? { ...u, role: newRole, isAdmin: newRole === 'admin' } : u));
        setStatusMessage(`Updated role for user to ${newRole.toUpperCase()}`);
        setTimeout(() => setStatusMessage(null), 3000);
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
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isVerified: newVerified })
      });
      const data = await res.json();
      if (data.success) {
        setUsers(prev => prev.map(u => u.id === userId || u._id === userId ? { ...u, isVerified: newVerified } : u));
        setStatusMessage(`Updated verified status for user`);
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err) {
      console.error('Update verified error:', err);
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
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-[#17a398] text-[#0b1110] font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm cursor-pointer rounded-xl"
        >
          Return to Home
        </button>
      </div>
    );
  }

  // Filtered accounts if admin optionally types in the filter box
  const displayedUsers = userFilterQuery.trim()
    ? users.filter(u => 
        (u.name && u.name.toLowerCase().includes(userFilterQuery.toLowerCase())) ||
        (u.email && u.email.toLowerCase().includes(userFilterQuery.toLowerCase()))
      )
    : users;

  return (
    <div className={`flex-1 overflow-y-auto pb-32 select-none p-4 md:p-8 transition-colors ${
      isDark ? 'bg-[#0b1110] text-[#fdfbf7]' : 'bg-[#f4efe4] text-[#0b1110]'
    }`}>
      {/* ── Top Bar ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b-2 border-dashed border-zinc-700">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className={`p-2 brutal-border rounded-xl cursor-pointer ${
                isDark ? 'bg-[#182320] hover:bg-[#22332e] text-white border-zinc-700' : 'bg-[#ede5d3] hover:bg-white text-black border-black'
              }`}
              title="Go Back"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-[#f59e0b] text-black flex items-center justify-center brutal-border brutal-shadow-sm shrink-0">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-display font-black uppercase tracking-wider">
                Administrator Dashboard
              </h1>
              <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 rounded-full bg-[#f59e0b] text-black">
                Admin
              </span>
            </div>
            <p className={`text-xs font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
              Logged in as <strong>{currentUser?.name || 'Administrator'}</strong> • Full Website Control
            </p>
          </div>
        </div>

        {/* Global Statistics Badges */}
        <div className="flex items-center gap-2">
          <div className={`px-3 py-2 rounded-xl brutal-border font-mono text-xs flex items-center gap-2 ${
            isDark ? 'bg-[#182320] border-zinc-700' : 'bg-[#ede5d3] border-black'
          }`}>
            <Users size={14} className="text-[#17a398]" />
            <span><strong>{users.length}</strong> Registered Accounts</span>
          </div>
          <div className={`px-3 py-2 rounded-xl brutal-border font-mono text-xs flex items-center gap-2 ${
            isDark ? 'bg-[#182320] border-zinc-700' : 'bg-[#ede5d3] border-black'
          }`}>
            <Music2 size={14} className="text-[#f59e0b]" />
            <span><strong>{tracks.length}</strong> Total Songs</span>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/15 border-2 border-emerald-500 text-emerald-400 text-xs font-mono font-black flex items-center gap-2">
          <Check size={16} /> {statusMessage}
        </div>
      )}

      {/* ── Navigation Tabs ── */}
      <div className="flex items-center gap-2 mb-6 border-b-2 border-zinc-700/50 pb-2">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-black uppercase tracking-wider brutal-border transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'accounts'
              ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
              : isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:bg-[#22332e]' : 'bg-[#ede5d3] text-[#082621] border-black hover:bg-white'
          }`}
        >
          <Users size={14} />
          <span>Every Account ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('tracks')}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-black uppercase tracking-wider brutal-border transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'tracks'
              ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
              : isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:bg-[#22332e]' : 'bg-[#ede5d3] text-[#082621] border-black hover:bg-white'
          }`}
        >
          <Music2 size={14} />
          <span>Songs & Deletion ({tracks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('lyrics')}
          className={`px-4 py-2 rounded-xl font-mono text-xs font-black uppercase tracking-wider brutal-border transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'lyrics'
              ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm'
              : isDark ? 'bg-[#182320] text-zinc-300 border-zinc-700 hover:bg-[#22332e]' : 'bg-[#ede5d3] text-[#082621] border-black hover:bg-white'
          }`}
        >
          <FileText size={14} />
          <span>Lyrics Verification Hub</span>
        </button>
      </div>

      {/* ── TAB 1: ACCOUNTS LISTING (Every Account Created Without Searching) ── */}
      {activeTab === 'accounts' && (
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-mono font-black uppercase flex items-center gap-2">
                <Users size={18} className="text-[#17a398]" />
                All Created User Accounts (Without Searching)
              </h2>
              <p className={`text-xs font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                Complete registry of every user registered on the website, sorted by newest registration.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={userFilterQuery}
                onChange={(e) => setUserFilterQuery(e.target.value)}
                placeholder="Quick filter..."
                className={`p-2 text-xs font-mono rounded-lg brutal-border focus:outline-none w-48 ${
                  isDark ? 'bg-[#182320] text-white border-zinc-700' : 'bg-white text-black border-black'
                }`}
              />
              <button
                onClick={fetchAllUsers}
                className={`p-2 rounded-lg brutal-border cursor-pointer ${
                  isDark ? 'bg-[#182320] text-zinc-300 hover:bg-[#22332e] border-zinc-700' : 'bg-[#ede5d3] text-black hover:bg-white border-black'
                }`}
                title="Refresh Accounts List"
              >
                <RefreshCw size={15} className={isLoadingUsers ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {isLoadingUsers ? (
            <div className="text-center py-16">
              <Loader2 size={32} className="animate-spin mx-auto text-[#17a398] mb-2" />
              <p className="text-xs font-mono">LOADING ALL ACCOUNTS...</p>
            </div>
          ) : displayedUsers.length === 0 ? (
            <div className={`text-center py-12 brutal-border rounded-xl p-8 font-mono text-xs ${
              isDark ? 'bg-[#182320] text-zinc-400 border-zinc-700' : 'bg-white text-zinc-600 border-black'
            }`}>
              NO ACCOUNTS FOUND
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedUsers.map((user) => {
                const isUserAnAdmin = isUserAdmin(user);
                const isUserVerifiedAcc = Boolean(user.isVerified);
                const joinDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A';

                return (
                  <div
                    key={user.id || user._id}
                    className={`p-4 brutal-border brutal-shadow-sm rounded-xl transition-all ${
                      isDark 
                        ? 'bg-[#141d1b] border-zinc-700 text-white hover:border-[#17a398]' 
                        : 'bg-[#ede5d3] border-black text-[#0b1110] hover:border-black'
                    }`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <img
                        src={user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=1DB954&color=000&size=128&bold=true`}
                        alt={user.name}
                        className="w-12 h-12 rounded-xl brutal-border object-cover bg-[#ede5d3] shrink-0"
                        onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=1DB954&color=000&size=128&bold=true`; }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-display font-black text-sm truncate">
                            {user.name}
                          </h3>
                          {isUserVerifiedAcc && <VerifiedBadge size={14} />}
                          {isUserAnAdmin && (
                            <span className="text-[8px] font-mono font-black uppercase px-1.5 py-0.2 rounded bg-[#f59e0b] text-black">
                              ADMIN
                            </span>
                          )}
                        </div>
                        <p className={`text-[11px] font-mono truncate flex items-center gap-1 ${
                          isDark ? 'text-zinc-400' : 'text-[#082621]/70'
                        }`}>
                          <Mail size={11} className="shrink-0" />
                          <span className="truncate">{user.email}</span>
                        </p>
                        <p className="text-[10px] font-mono text-zinc-500 mt-0.5 flex items-center gap-1">
                          <Calendar size={10} className="shrink-0" />
                          <span>Joined {joinDate}</span>
                        </p>
                      </div>
                    </div>

                    {/* Stats & Playlists */}
                    <div className={`p-2 rounded-lg brutal-border text-[11px] font-mono grid grid-cols-2 gap-2 mb-3 ${
                      isDark ? 'bg-[#182320] border-zinc-700/70' : 'bg-white border-black/30'
                    }`}>
                      <div>
                        <span className="text-zinc-400 block text-[9px] uppercase">Playlists</span>
                        <strong>{user.playlistsCount || 0} created</strong>
                      </div>
                      <div>
                        <span className="text-zinc-400 block text-[9px] uppercase">Liked Songs</span>
                        <strong>{user.likedSongsCount || 0} tracks</strong>
                      </div>
                    </div>

                    {/* Admin Action Buttons */}
                    <div className="flex items-center gap-2 pt-1 border-t border-zinc-700/40">
                      <button
                        onClick={() => handleToggleAdminRole(user.id || user._id, user.role)}
                        className={`flex-1 py-1.5 px-2 text-[10px] font-mono font-bold uppercase rounded-lg brutal-border cursor-pointer transition-colors ${
                          isUserAnAdmin
                            ? 'bg-red-500/20 text-red-400 border-red-500 hover:bg-red-500 hover:text-white'
                            : 'bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b] hover:bg-[#f59e0b] hover:text-black'
                        }`}
                      >
                        {isUserAnAdmin ? 'Revoke Admin' : 'Make Admin'}
                      </button>

                      <button
                        onClick={() => handleToggleUserVerified(user.id || user._id, user.isVerified)}
                        className={`flex-1 py-1.5 px-2 text-[10px] font-mono font-bold uppercase rounded-lg brutal-border cursor-pointer transition-colors ${
                          isUserVerifiedAcc
                            ? 'bg-zinc-700 text-zinc-300 border-zinc-600 hover:bg-zinc-600'
                            : 'bg-[#17a398]/20 text-[#17a398] border-[#17a398] hover:bg-[#17a398] hover:text-[#0b1110]'
                        }`}
                      >
                        {isUserVerifiedAcc ? 'Unverify' : 'Verify Badge'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: SONGS & DELETION MANAGEMENT ── */}
      {activeTab === 'tracks' && (
        <div>
          <div className="mb-4">
            <h2 className="text-base font-mono font-black uppercase flex items-center gap-2">
              <Music2 size={18} className="text-[#f59e0b]" />
              Website Songs Management & Deletion
            </h2>
            <p className={`text-xs font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
              Only administrators can delete songs permanently from the global website database.
            </p>
          </div>

          <div className="space-y-2">
            {tracks.map((track, idx) => (
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
                  {onSelectArtist && (
                    <button
                      onClick={() => onSelectArtist(track.artist)}
                      className={`px-2.5 py-1.5 rounded-lg brutal-border font-mono text-[10px] font-bold uppercase cursor-pointer ${
                        isDark ? 'bg-[#182320] hover:bg-[#22332e] text-zinc-300 border-zinc-700' : 'bg-white hover:bg-zinc-100 text-black border-black'
                      }`}
                      title="View Artist Page"
                    >
                      Artist Page
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
                      title="Delete song permanently from website"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TAB 3: LYRICS VERIFICATION HUB ── */}
      {activeTab === 'lyrics' && (
        <div>
          <div className="mb-4">
            <h2 className="text-base font-mono font-black uppercase flex items-center gap-2">
              <FileText size={18} className="text-[#17a398]" />
              Song Lyrics Verification Hub
            </h2>
            <p className={`text-xs font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
              Verify if song lyrics are correct or inaccurate. Correct verified lyrics are locked and badged across all players; unverified songs continue using the normal dynamic search function.
            </p>
          </div>

          <div className="space-y-3">
            {tracks.map((track) => {
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
                    {onSelectTrack && (
                      <button
                        onClick={() => onSelectTrack(track)}
                        className={`px-3 py-1.5 rounded-lg brutal-border font-mono text-[11px] font-bold uppercase cursor-pointer flex items-center gap-1.5 ${
                          isDark ? 'bg-[#17a398] text-[#0b1110]' : 'bg-[#17a398] text-[#0b1110]'
                        }`}
                      >
                        <FileText size={13} />
                        <span>Inspect in Player</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
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
            setStatusMessage(`Saved profile changes for artist ${updated.name}`);
            setTimeout(() => setStatusMessage(null), 3000);
          }}
          globalTheme={globalTheme}
        />
      )}
    </div>
  );
}
