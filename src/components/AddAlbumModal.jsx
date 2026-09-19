import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Disc, User, Image, Calendar, Tag, Check, Loader2, ShieldCheck, 
  Music2, Search, CheckSquare, Square, Link2, Sparkles, Layers
} from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function AddAlbumModal({
  isOpen,
  onClose,
  initialArtistName = '',
  artistTracks = [],
  artistAvatar = '',
  onAlbumCreated = () => {},
  globalTheme = 'dark'
}) {
  const isDark = globalTheme === 'dark';

  // Mode: 'link' (import via Spotify/YouTube) or 'manual' (pick existing tracks)
  const [activeTab, setActiveTab] = useState('link');

  // Link import state
  const [linkUrl, setLinkUrl] = useState('');

  // Common album state
  const [name, setName] = useState('');
  const [artist, setArtist] = useState(initialArtistName || '');
  const [cover, setCover] = useState('');
  const [releaseDate, setReleaseDate] = useState(new Date().getFullYear().toString());
  const [genre, setGenre] = useState('Pop');
  const [isQuran, setIsQuran] = useState(false);
  const [description, setDescription] = useState('');

  // Manual track selection state
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);
  const [trackSearchQuery, setTrackSearchQuery] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setActiveTab('link');
      setLinkUrl('');
      setName('');
      setArtist(initialArtistName || '');
      setCover(artistAvatar || artistTracks[0]?.cover || '');
      setReleaseDate(new Date().getFullYear().toString());
      setGenre('Pop');
      setIsQuran(false);
      setDescription('');
      setSelectedTrackIds([]);
      setTrackSearchQuery('');
      setError(null);
    }
  }, [isOpen, initialArtistName, artistAvatar]);

  // Detect link provider
  const detectedProvider = useMemo(() => {
    const u = (linkUrl || '').toLowerCase();
    if (u.includes('spotify.com/album') || u.includes('spotify:album')) return 'Spotify Album';
    if (u.includes('spotify.com/playlist') || u.includes('spotify:playlist')) return 'Spotify Playlist';
    if (u.includes('youtube.com/playlist') || u.includes('list=')) return 'YouTube Playlist';
    if (u.includes('music.apple.com')) return 'Apple Music';
    return null;
  }, [linkUrl]);

  const filteredTracks = useMemo(() => {
    if (!trackSearchQuery.trim()) return artistTracks;
    const q = trackSearchQuery.toLowerCase();
    return artistTracks.filter(t => (t.title || '').toLowerCase().includes(q));
  }, [artistTracks, trackSearchQuery]);

  if (!isOpen) return null;

  const handleToggleTrack = (trackId) => {
    const idStr = String(trackId);
    setSelectedTrackIds(prev =>
      prev.includes(idStr) ? prev.filter(id => id !== idStr) : [...prev, idStr]
    );
  };

  const handleSelectAllTracks = () => {
    setSelectedTrackIds(filteredTracks.map(t => String(t.id || t._id)));
  };

  const handleClearAllTracks = () => {
    setSelectedTrackIds([]);
  };

  // Submit Link Import
  const handleLinkImportSubmit = async (e) => {
    e.preventDefault();
    if (!linkUrl.trim()) {
      setError('Please provide a Spotify album or YouTube playlist link');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
      const res = await fetch(`${API_BASE_URL}/api/albums/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          url: linkUrl.trim(),
          name: name.trim(),
          artist: artist.trim(),
          cover: cover.trim(),
          releaseDate: releaseDate.trim(),
          genre: genre.trim() || (isQuran ? 'Quran' : 'Pop'),
          isQuran: Boolean(isQuran),
          description: description.trim()
        })
      });

      let data = {};
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => ({}));
      } else {
        const text = await res.text().catch(() => '');
        if (res.status === 404) {
          throw new Error('Album import service endpoint not found (404). Please ensure backend is running.');
        }
        throw new Error(text.slice(0, 120) || `Server returned ${res.status}`);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to import album');
      }

      const importedTracks = data.tracks || [];
      const importedTrackIds = importedTracks.map(t => String(t.id || t._id));
      onAlbumCreated(data.album, importedTrackIds, importedTracks);
      onClose();
    } catch (err) {
      console.error('Import album error:', err);
      setError(err.message || 'Error importing album from link');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Manual Form
  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Album title is required');
      return;
    }
    if (!artist.trim()) {
      setError('Artist name is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
      const res = await fetch(`${API_BASE_URL}/api/albums`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          artist: artist.trim(),
          cover: cover.trim() || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
          releaseDate: releaseDate.trim(),
          genre: genre.trim() || (isQuran ? 'Quran' : 'Pop'),
          isQuran: Boolean(isQuran),
          description: description.trim(),
          trackIds: selectedTrackIds
        })
      });

      let data = {};
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => ({}));
      } else {
        const text = await res.text().catch(() => '');
        throw new Error(text.slice(0, 120) || `Server returned ${res.status}`);
      }

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create album');
      }

      onAlbumCreated(data.album, selectedTrackIds, []);
      onClose();
    } catch (err) {
      console.error('Create album error:', err);
      setError(err.message || 'Error creating album');
    } finally {
      setIsSaving(false);
    }
  };

  const presetGenres = ['Pop', 'Hip-Hop', 'Rap', 'R&B', 'Rock', 'Electronic', 'Indie', 'Alternative', 'Quran', 'Classical', 'Acoustic'];

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none animate-fadeIn">
      <div 
        className={`w-full max-w-xl p-6 brutal-shadow-lg brutal-border-thick rounded-2xl relative max-h-[90vh] overflow-y-auto ${
          isDark ? 'bg-[#121816] text-white border-zinc-700' : 'bg-[#fdfbf7] text-[#0b1110] border-black'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-4 border-b-2 border-dashed border-zinc-700">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#17a398] text-[#0b1110] flex items-center justify-center brutal-border shrink-0">
              <Disc size={18} strokeWidth={2.5} />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-base sm:text-lg font-mono font-black uppercase">Upload New Album</h2>
                <span className="flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono font-bold bg-[#17a398]/20 text-[#17a398] border border-[#17a398]/40 rounded-full">
                  <ShieldCheck size={11} />
                  <span>Admin</span>
                </span>
              </div>
              <p className={`text-[11px] font-mono ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Create an official website album for discography
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg brutal-border cursor-pointer transition-colors ${
              isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' : 'bg-white hover:bg-zinc-100 text-black'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Switcher: Link Import vs Manual */}
        <div className="flex items-center gap-2 mb-4 p-1 rounded-xl brutal-border bg-black/10 dark:bg-zinc-900/60">
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-mono font-black uppercase rounded-lg transition-all cursor-pointer ${
              activeTab === 'link'
                ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm brutal-border'
                : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-black'
            }`}
          >
            <Sparkles size={14} />
            <span>Import from Link (Spotify / YouTube)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-mono font-black uppercase rounded-lg transition-all cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-[#17a398] text-[#0b1110] brutal-shadow-sm brutal-border'
                : isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-600 hover:text-black'
            }`}
          >
            <Layers size={14} />
            <span>Manual Selection</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/60 border border-red-500 rounded-lg text-red-200 text-xs font-mono font-bold">
            {error}
          </div>
        )}

        {/* ────────────────────────────────────────── */}
        {/* TAB 1: IMPORT FROM LINK (SPOTIFY / YOUTUBE) */}
        {/* ────────────────────────────────────────── */}
        {activeTab === 'link' ? (
          <form onSubmit={handleLinkImportSubmit} className="space-y-4">
            {/* Link Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-mono font-bold uppercase flex items-center gap-1.5">
                  <Link2 size={13} className="text-[#17a398]" />
                  <span>Album / Playlist URL *</span>
                </label>
                {detectedProvider && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#17a398]/20 text-[#17a398] border border-[#17a398]/40 font-bold">
                    {detectedProvider} Detected
                  </span>
                )}
              </div>
              <input
                type="url"
                required
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://open.spotify.com/album/... or https://www.youtube.com/playlist?list=..."
                className={`w-full p-2.5 text-xs rounded-xl brutal-border font-mono focus:outline-none focus:ring-2 focus:ring-[#17a398] ${
                  isDark ? 'bg-[#182320] border-zinc-700 text-white' : 'bg-white border-black text-black'
                }`}
              />
              <p className={`text-[10px] font-mono mt-1 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                Supports Spotify official albums/playlists and YouTube playlists (including full Quran playlists).
              </p>
            </div>

            {/* Artist Name */}
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
                <User size={13} className="text-[#17a398]" />
                <span>Artist Name (Optional override)</span>
              </label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder={initialArtistName ? initialArtistName : "Leave empty to auto-detect from link"}
                className={`w-full p-2.5 text-xs rounded-xl brutal-border font-sans focus:outline-none focus:ring-2 focus:ring-[#17a398] ${
                  isDark ? 'bg-[#182320] border-zinc-700 text-white' : 'bg-white border-black text-black'
                }`}
              />
            </div>

            {/* Album Title Override (Optional) */}
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
                <Disc size={13} className="text-[#17a398]" />
                <span>Album Title (Optional override)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Leave blank to use title from Spotify/YouTube"
                className={`w-full p-2.5 text-xs rounded-xl brutal-border font-sans focus:outline-none focus:ring-2 focus:ring-[#17a398] ${
                  isDark ? 'bg-[#182320] border-zinc-700 text-white' : 'bg-white border-black text-black'
                }`}
              />
            </div>

            {/* Release Date & Genre */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
                  <Calendar size={13} className="text-[#17a398]" />
                  <span>Release Year / Date</span>
                </label>
                <input
                  type="text"
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                  placeholder="e.g. 2024"
                  className={`w-full p-2.5 text-xs rounded-xl brutal-border font-sans focus:outline-none focus:ring-2 focus:ring-[#17a398] ${
                    isDark ? 'bg-[#182320] border-zinc-700 text-white' : 'bg-white border-black text-black'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
                  <Tag size={13} className="text-[#17a398]" />
                  <span>Genre</span>
                </label>
                <input
                  type="text"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="e.g. Pop, Hip-Hop, Quran"
                  list="import-genre-suggestions"
                  className={`w-full p-2.5 text-xs rounded-xl brutal-border font-sans focus:outline-none focus:ring-2 focus:ring-[#17a398] ${
                    isDark ? 'bg-[#182320] border-zinc-700 text-white' : 'bg-white border-black text-black'
                  }`}
                />
                <datalist id="import-genre-suggestions">
                  {presetGenres.map(g => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Category Toggle: Music vs Quran */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold uppercase">Type:</span>
              <div className={`inline-flex items-center p-0.5 rounded-lg brutal-border ${
                isDark ? 'bg-[#182320] border-zinc-700' : 'bg-white border-black'
              }`}>
                <button
                  type="button"
                  onClick={() => setIsQuran(false)}
                  className={`px-3 py-1 text-[11px] font-mono font-bold rounded-md cursor-pointer transition-all ${
                    !isQuran ? 'bg-[#17a398] text-[#0b1110]' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Music Album
                </button>
                <button
                  type="button"
                  onClick={() => setIsQuran(true)}
                  className={`px-3 py-1 text-[11px] font-mono font-bold rounded-md cursor-pointer transition-all ${
                    isQuran ? 'bg-[#17a398] text-[#0b1110]' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Quran Surah / Album
                </button>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase mb-1">
                Album Description / Liner Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Official studio album imported from streaming..."
                className={`w-full p-2.5 text-xs rounded-xl brutal-border font-sans focus:outline-none focus:ring-2 focus:ring-[#17a398] resize-none ${
                  isDark ? 'bg-[#182320] border-zinc-700 text-white' : 'bg-white border-black text-black'
                }`}
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-700/50">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 text-xs font-mono font-bold uppercase brutal-border rounded-xl cursor-pointer ${
                  isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-zinc-700' : 'bg-white text-black hover:bg-zinc-100 border-black'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="brutal-btn px-6 py-2.5 text-xs font-mono font-black uppercase rounded-xl bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border brutal-shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} strokeWidth={2.5} />}
                <span>{isSaving ? 'Importing Album & Tracks...' : 'Import & Create Album'}</span>
              </button>
            </div>
          </form>
        ) : (
          /* ────────────────────────────────────────── */
          /* TAB 2: MANUAL SETUP                       */
          /* ────────────────────────────────────────── */
          <form onSubmit={handleManualSubmit} className="space-y-4">
            {/* Album Title */}
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
                <Disc size={13} className="text-[#17a398]" />
                <span>Album Title *</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. After Hours, Dawn FM, Abbey Road"
                className={`w-full p-2.5 text-xs rounded-xl brutal-border font-sans focus:outline-none focus:ring-2 focus:ring-[#17a398] ${
                  isDark ? 'bg-[#182320] border-zinc-700 text-white' : 'bg-white border-black text-black'
                }`}
              />
            </div>

            {/* Artist Name */}
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
                <User size={13} className="text-[#17a398]" />
                <span>Artist Name *</span>
              </label>
              <input
                type="text"
                required
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="e.g. The Weeknd, Mishary Alafasy"
                className={`w-full p-2.5 text-xs rounded-xl brutal-border font-sans focus:outline-none focus:ring-2 focus:ring-[#17a398] ${
                  isDark ? 'bg-[#182320] border-zinc-700 text-white' : 'bg-white border-black text-black'
                }`}
              />
            </div>

            {/* Cover Art URL */}
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
                <Image size={13} className="text-[#17a398]" />
                <span>Album Cover Image URL</span>
              </label>
              <div className="flex gap-2.5 items-start">
                <div className="w-16 h-16 rounded-xl brutal-border overflow-hidden bg-black/20 shrink-0">
                  <img
                    src={cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600'}
                    alt="Preview"
                    className="w-full h-full object-cover"
                    onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600'; }}
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  <input
                    type="url"
                    value={cover}
                    onChange={(e) => setCover(e.target.value)}
                    placeholder="https://images.unsplash.com/... or image link"
                    className={`w-full p-2.5 text-xs rounded-xl brutal-border font-mono focus:outline-none focus:ring-2 focus:ring-[#17a398] ${
                      isDark ? 'bg-[#182320] border-zinc-700 text-white' : 'bg-white border-black text-black'
                    }`}
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {artistAvatar && (
                      <button
                        type="button"
                        onClick={() => setCover(artistAvatar)}
                        className="px-2 py-0.5 text-[10px] font-mono font-bold bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 rounded-md cursor-pointer"
                      >
                        Use Artist Photo
                      </button>
                    )}
                    {artistTracks[0]?.cover && (
                      <button
                        type="button"
                        onClick={() => setCover(artistTracks[0].cover)}
                        className="px-2 py-0.5 text-[10px] font-mono font-bold bg-zinc-800 text-zinc-300 border border-zinc-700 hover:bg-zinc-700 rounded-md cursor-pointer"
                      >
                        Use Track 1 Cover
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Release Date & Genre */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
                  <Calendar size={13} className="text-[#17a398]" />
                  <span>Release Year / Date</span>
                </label>
                <input
                  type="text"
                  value={releaseDate}
                  onChange={(e) => setReleaseDate(e.target.value)}
                  placeholder="e.g. 2024"
                  className={`w-full p-2.5 text-xs rounded-xl brutal-border font-sans focus:outline-none focus:ring-2 focus:ring-[#17a398] ${
                    isDark ? 'bg-[#182320] border-zinc-700 text-white' : 'bg-white border-black text-black'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
                  <Tag size={13} className="text-[#17a398]" />
                  <span>Genre</span>
                </label>
                <input
                  type="text"
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  placeholder="e.g. Pop, Hip-Hop"
                  list="manual-genre-suggestions"
                  className={`w-full p-2.5 text-xs rounded-xl brutal-border font-sans focus:outline-none focus:ring-2 focus:ring-[#17a398] ${
                    isDark ? 'bg-[#182320] border-zinc-700 text-white' : 'bg-white border-black text-black'
                  }`}
                />
                <datalist id="manual-genre-suggestions">
                  {presetGenres.map(g => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Category Toggle: Music vs Quran */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold uppercase">Type:</span>
              <div className={`inline-flex items-center p-0.5 rounded-lg brutal-border ${
                isDark ? 'bg-[#182320] border-zinc-700' : 'bg-white border-black'
              }`}>
                <button
                  type="button"
                  onClick={() => setIsQuran(false)}
                  className={`px-3 py-1 text-[11px] font-mono font-bold rounded-md cursor-pointer transition-all ${
                    !isQuran ? 'bg-[#17a398] text-[#0b1110]' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Music Album
                </button>
                <button
                  type="button"
                  onClick={() => setIsQuran(true)}
                  className={`px-3 py-1 text-[11px] font-mono font-bold rounded-md cursor-pointer transition-all ${
                    isQuran ? 'bg-[#17a398] text-[#0b1110]' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Quran Surah / Album
                </button>
              </div>
            </div>

            {/* Track Selector Section */}
            {artistTracks.length > 0 && (
              <div className={`p-3 rounded-xl brutal-border ${
                isDark ? 'bg-[#16211e] border-zinc-700' : 'bg-[#ded2bb]/50 border-black'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5 pb-2 border-b border-zinc-700/50">
                  <div className="flex items-center gap-1.5">
                    <Music2 size={14} className="text-[#17a398]" />
                    <span className="text-xs font-mono font-black uppercase">Assign Songs to this Album</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#17a398] text-[#0b1110] font-black">
                      {selectedTrackIds.length} / {artistTracks.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllTracks}
                      className="text-[10px] font-mono font-bold underline hover:text-[#17a398] cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-zinc-500">•</span>
                    <button
                      type="button"
                      onClick={handleClearAllTracks}
                      className="text-[10px] font-mono font-bold underline hover:text-[#17a398] cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {artistTracks.length > 6 && (
                  <div className="relative mb-2">
                    <Search size={12} className="absolute left-2.5 top-2.5 text-zinc-400" />
                    <input
                      type="text"
                      value={trackSearchQuery}
                      onChange={(e) => setTrackSearchQuery(e.target.value)}
                      placeholder="Search songs to add..."
                      className={`w-full pl-7 p-1.5 text-xs rounded-lg brutal-border font-mono ${
                        isDark ? 'bg-[#182320] border-zinc-700 text-white' : 'bg-white border-black text-black'
                      }`}
                    />
                  </div>
                )}

                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {filteredTracks.map((t, idx) => {
                    const tid = String(t.id || t._id);
                    const isChecked = selectedTrackIds.includes(tid);
                    return (
                      <div
                        key={tid}
                        onClick={() => handleToggleTrack(tid)}
                        className={`flex items-center gap-2.5 p-1.5 px-2 rounded-lg cursor-pointer transition-colors text-xs font-mono select-none ${
                          isChecked 
                            ? isDark ? 'bg-[#17a398]/20 border border-[#17a398]/50 text-white' : 'bg-[#17a398]/20 border border-[#17a398] text-black'
                            : isDark ? 'hover:bg-zinc-800 text-zinc-300' : 'hover:bg-white text-zinc-800'
                        }`}
                      >
                        <div className="text-[#17a398]">
                          {isChecked ? <CheckSquare size={15} /> : <Square size={15} className="text-zinc-500" />}
                        </div>
                        <span className="text-zinc-500 text-[10px] w-5 text-right">{idx + 1}.</span>
                        <img
                          src={t.cover}
                          alt=""
                          className="w-6 h-6 rounded object-cover brutal-border shrink-0"
                          onError={(e) => { e.target.src = 'https://ui-avatars.com/api/?name=S'; }}
                        />
                        <span className="truncate flex-1 font-bold">{t.title}</span>
                        {t.album && (
                          <span className="text-[10px] text-zinc-400 truncate max-w-[100px]">({t.album})</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase mb-1">
                Album Description / Liner Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Official studio album released in..."
                className={`w-full p-2.5 text-xs rounded-xl brutal-border font-sans focus:outline-none focus:ring-2 focus:ring-[#17a398] resize-none ${
                  isDark ? 'bg-[#182320] border-zinc-700 text-white' : 'bg-white border-black text-black'
                }`}
              />
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3 border-t border-zinc-700/50">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2 text-xs font-mono font-bold uppercase brutal-border rounded-xl cursor-pointer ${
                  isDark ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-zinc-700' : 'bg-white text-black hover:bg-zinc-100 border-black'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="brutal-btn px-6 py-2.5 text-xs font-mono font-black uppercase rounded-xl bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] brutal-border brutal-shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
                <span>{isSaving ? 'Uploading Album...' : 'Create Album'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
