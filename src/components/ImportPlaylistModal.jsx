import React, { useState } from 'react';
import { X, Link2, DownloadCloud, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function ImportPlaylistModal({ isOpen, onClose, onPlaylistImported }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);

  if (!isOpen) return null;

  const handleImport = async (e) => {
    e?.preventDefault();
    if (!url.trim()) return;

    setError('');
    setSuccess(null);
    setLoading(true);

    try {
      const token = localStorage.getItem('liofy_token');
      const res = await fetch(`${API_BASE_URL}/api/playlists/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ url: url.trim() })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to import playlist');
      }

      setSuccess({
        name: data.playlist.name,
        trackCount: data.trackCount
      });
      setUrl('');

      if (onPlaylistImported) {
        onPlaylistImported(data.playlist);
      }

      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err) {
      setError(err.message || 'Something went wrong while importing.');
    } finally {
      setLoading(false);
    }
  };

  const isSpotify = url.includes('spotify.com');
  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
  const isApple = url.includes('apple.com');

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#181818] border border-white/10 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1DB954]/20 text-[#1DB954] flex items-center justify-center font-bold">
              <DownloadCloud size={20} />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white">Import Playlist</h3>
              <p className="text-xs text-zinc-400">Spotify, YouTube, or Apple Music</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleImport} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
              Playlist Link / URL
            </label>
            <div className="relative">
              <Link2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://open.spotify.com/playlist/... or YouTube link"
                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#1DB954] transition-colors"
                autoFocus
              />
            </div>
          </div>

          {/* Badges for supported services */}
          <div className="flex items-center gap-2 pt-1">
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all ${
              isSpotify ? 'bg-[#1DB954] text-black font-bold shadow-md' : 'bg-white/5 text-zinc-400 border border-white/5'
            }`}>
              Spotify
            </span>
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all ${
              isYouTube ? 'bg-red-600 text-white font-bold shadow-md' : 'bg-white/5 text-zinc-400 border border-white/5'
            }`}>
              YouTube
            </span>
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all ${
              isApple ? 'bg-pink-600 text-white font-bold shadow-md' : 'bg-white/5 text-zinc-400 border border-white/5'
            }`}>
              Apple Music
            </span>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-xl flex items-center gap-2.5 text-xs text-red-400">
              <AlertCircle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-[#1DB954]/15 border border-[#1DB954]/30 rounded-xl flex items-center gap-2.5 text-xs text-[#1DB954]">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>Successfully imported "{success.name}" ({success.trackCount} tracks)!</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="w-full py-3 px-4 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] text-black font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-[#1DB954]"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Fetching & Resolving Tracks...</span>
                </>
              ) : (
                <>
                  <DownloadCloud size={18} />
                  <span>Import Playlist Now</span>
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
