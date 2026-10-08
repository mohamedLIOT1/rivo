import React, { useState, useEffect, useMemo } from 'react';
import { X, Disc, User, Image, Calendar, Tag, Check, Trash2, Loader2, ShieldCheck, Link2, Sparkles } from 'lucide-react';
import { API_BASE_URL } from '../config';
import DeleteAlbumModal from './DeleteAlbumModal';

export default function EditAlbumModal({
  isOpen,
  onClose,
  album,
  onSaved = () => {},
  onDelete = () => {},
  globalTheme = 'dark'
}) {
  const isDark = globalTheme === 'dark';

  const [linkUrl, setLinkUrl] = useState('');
  const [name, setName] = useState('');
  const [artist, setArtist] = useState('');
  const [cover, setCover] = useState('');
  const [releaseDate, setReleaseDate] = useState('');
  const [genre, setGenre] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupSuccess, setLookupSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (album) {
      setLinkUrl(album.linkUrl || album.url || '');
      setName(album.name || '');
      setArtist(album.artist || '');
      setCover(album.cover || '');
      setReleaseDate(album.releaseDate || '');
      setGenre(album.genre || '');
      setError(null);
      setIsLookingUp(false);
      setLookupSuccess(false);
    }
  }, [album, isOpen]);

  // Detect link provider
  const detectedProvider = useMemo(() => {
    const u = (linkUrl || '').toLowerCase();
    if (u.includes('spotify.com/album') || u.includes('spotify:album')) return 'Spotify Album';
    if (u.includes('spotify.com/playlist') || u.includes('spotify:playlist')) return 'Spotify Playlist';
    if (u.includes('youtube.com/playlist') || u.includes('list=')) return 'YouTube Playlist';
    if (u.includes('music.apple.com')) return 'Apple Music';
    return null;
  }, [linkUrl]);

  const handleAutoLookup = async () => {
    const q = (linkUrl || name || artist).trim();
    if (!q) {
      setError('Please enter an album link or album name to auto-grab metadata');
      return;
    }
    setIsLookingUp(true);
    setError(null);
    try {
      const isUrl = q.startsWith('http://') || q.startsWith('https://');
      const param = isUrl ? `url=${encodeURIComponent(q)}` : `query=${encodeURIComponent(`${artist} ${name}`.trim())}`;
      const res = await fetch(`${API_BASE_URL}/api/albums/lookup?${param}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No metadata found for this album');
      }
      if (data.name) setName(data.name);
      if (data.artist) setArtist(data.artist);
      if (data.cover) setCover(data.cover);
      if (data.releaseDate) setReleaseDate(data.releaseDate);
      if (data.genre) setGenre(data.genre);
      setLookupSuccess(true);
      setTimeout(() => setLookupSuccess(false), 3500);
    } catch (err) {
      console.warn('Metadata lookup notice:', err.message);
      setError(err.message || 'Auto metadata lookup failed');
    } finally {
      setIsLookingUp(false);
    }
  };

  if (!isOpen || !album) return null;

  const albumId = album.id || album._id || album.name;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !artist.trim()) {
      setError('Album name and artist name are required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
      const res = await fetch(`${API_BASE_URL}/api/albums/${encodeURIComponent(albumId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: name.trim(),
          artist: artist.trim(),
          cover: cover.trim(),
          linkUrl: linkUrl.trim(),
          releaseDate: releaseDate.trim(),
          genre: genre.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update album');
      }

      onSaved(data.album || {
        ...album,
        name: name.trim(),
        artist: artist.trim(),
        cover: cover.trim(),
        linkUrl: linkUrl.trim(),
        releaseDate: releaseDate.trim(),
        genre: genre.trim()
      });
      onClose();
    } catch (err) {
      console.error('Save album error:', err);
      setError(err.message || 'Error updating album');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAlbum = async (deleteTracks = true) => {
    try {
      const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
      await fetch(`${API_BASE_URL}/api/albums/${encodeURIComponent(albumId)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ deleteTracks: Boolean(deleteTracks) })
      });
      if (onDelete) onDelete(albumId, album, deleteTracks);
      setIsDeleteConfirmOpen(false);
      onClose();
    } catch (err) {
      console.error('Delete album error:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs select-none animate-fadeIn">
      <div 
        className={`w-full max-w-lg p-6 brutal-shadow-lg brutal-border-thick rounded-2xl relative max-h-[90vh] overflow-y-auto ${
          isDark ? 'bg-[#121816] text-white border-zinc-700' : 'bg-[#fdfbf7] text-[#0b1110] border-black'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b-2 border-dashed border-zinc-700">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#f59e0b] text-black flex items-center justify-center brutal-border shrink-0">
              <ShieldCheck size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display font-black text-sm uppercase tracking-wider">
                  Admin: Edit Album
                </h3>
                <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-[#f59e0b] text-black">
                  Admin Exclusive
                </span>
              </div>
              <p className={`text-[11px] font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                Editing discography album: <strong>{album.name}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
              isDark ? 'hover:bg-zinc-800 text-zinc-400 hover:text-white' : 'hover:bg-black/10 text-zinc-600'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border-2 border-red-500 text-red-500 text-xs font-bold font-mono">
            {error}
          </div>
        )}

        {lookupSuccess && (
          <div className="mb-4 p-3 rounded-lg bg-[#17a398]/20 border-2 border-[#17a398] text-[#17a398] text-xs font-bold font-mono flex items-center gap-2">
            <Check size={15} />
            <span>Official metadata & HD square artwork auto-grabbed!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Album Link Input & Auto Grab */}
          <div className={`p-3.5 rounded-xl brutal-border ${
            isDark ? 'bg-[#182320] border-zinc-700' : 'bg-[#f4efe4] border-black'
          }`}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-mono font-bold uppercase flex items-center gap-1.5">
                <Link2 size={13} className="text-[#17a398]" /> Album Link (Spotify / YouTube / Apple Music)
              </label>
              {detectedProvider && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#17a398] text-[#0b1110]">
                  {detectedProvider}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://open.spotify.com/album/... or playlist link"
                className={`flex-1 p-2 text-xs font-mono rounded-lg brutal-border focus:outline-none ${
                  isDark ? 'bg-[#121816] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
                }`}
              />
              <button
                type="button"
                onClick={handleAutoLookup}
                disabled={isLookingUp}
                className="px-3 py-1.5 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-mono text-[10px] font-black uppercase brutal-border rounded-lg flex items-center gap-1 cursor-pointer shrink-0 disabled:opacity-50"
                title="Auto-fetch high-res cover, title, artist, year and genre from link or name"
              >
                {isLookingUp ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                <span>{isLookingUp ? 'FETCHING...' : 'AUTO-GRAB'}</span>
              </button>
            </div>
            <p className="text-[10px] font-mono text-zinc-400 mt-1.5">
              Paste a Spotify or YouTube album link to auto-fill high-res artwork, release year & genre.
            </p>
          </div>

          {/* Cover Preview & Cover URL */}
          <div className="flex gap-3 items-start">
            <div className="w-20 h-20 rounded-xl overflow-hidden brutal-border shrink-0 aspect-square bg-black/20 relative shadow-sm">
              <img
                src={cover || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400'}
                alt="Album Cover Preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400';
                }}
              />
              <span className="absolute bottom-1 right-1 text-[8px] font-mono px-1 py-0.5 rounded bg-black/70 text-white font-bold">1:1</span>
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
                <Image size={13} className="text-[#17a398]" /> Artwork Cover URL
              </label>
              <input
                type="url"
                value={cover}
                onChange={(e) => setCover(e.target.value)}
                placeholder="https://images.unsplash.com/... or iTunes HD cover"
                className={`w-full p-2.5 text-xs font-mono rounded-lg brutal-border focus:outline-none ${
                  isDark ? 'bg-[#1a2421] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
                }`}
              />
              <p className="text-[10px] font-mono text-zinc-400 mt-1">
                Enter an image URL or click "AUTO-GRAB" above to fetch official HD square cover.
              </p>
            </div>
          </div>

          {/* Album Title */}
          <div>
            <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
              <Disc size={13} className="text-[#17a398]" /> Album Title / Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. CTRL, Blonde, El Mabda2"
              className={`w-full p-2.5 text-xs font-bold rounded-lg brutal-border focus:outline-none ${
                isDark ? 'bg-[#1a2421] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
              }`}
              required
            />
          </div>

          {/* Artist Name */}
          <div>
            <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
              <User size={13} className="text-[#17a398]" /> Album Artist
            </label>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="e.g. Marwan Pablo"
              className={`w-full p-2.5 text-xs font-bold rounded-lg brutal-border focus:outline-none ${
                isDark ? 'bg-[#1a2421] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
              }`}
              required
            />
          </div>

          {/* Release Date & Genre */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
                <Calendar size={13} className="text-[#17a398]" /> Release Date / Year
              </label>
              <input
                type="text"
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                placeholder="e.g. 2024 or Oct 2023"
                className={`w-full p-2.5 text-xs font-medium rounded-lg brutal-border focus:outline-none ${
                  isDark ? 'bg-[#1a2421] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
                }`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
                <Tag size={13} className="text-[#17a398]" /> Genre
              </label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="e.g. Hip-Hop, Pop, R&B"
                className={`w-full p-2.5 text-xs font-medium rounded-lg brutal-border focus:outline-none ${
                  isDark ? 'bg-[#1a2421] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
                }`}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 rounded-xl"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              <span>{isSaving ? 'SAVING...' : 'SAVE ALBUM'}</span>
            </button>
            <button
              type="button"
              onClick={() => setIsDeleteConfirmOpen(true)}
              className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-500 font-mono text-xs font-bold uppercase brutal-border border-red-500/40 rounded-xl flex items-center gap-1.5 cursor-pointer"
              title="Delete Album"
            >
              <Trash2 size={15} />
              <span>DELETE</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className={`px-4 py-2.5 font-mono text-xs font-bold uppercase brutal-border rounded-xl cursor-pointer ${
                isDark ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-zinc-700' : 'bg-[#ede5d3] hover:bg-[#ded2bb] text-black border-black'
              }`}
            >
              CANCEL
            </button>
          </div>
        </form>
      </div>

      <DeleteAlbumModal
        isOpen={isDeleteConfirmOpen}
        onClose={() => setIsDeleteConfirmOpen(false)}
        album={{ ...album, name, artist, cover }}
        tracksCount={(album?.trackIds || []).length}
        onConfirm={handleDeleteAlbum}
        globalTheme={globalTheme}
      />
    </div>
  );
}
