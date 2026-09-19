import React, { useState } from 'react';
import { X, Link2, DownloadCloud, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function ImportPlaylistModal({ isOpen, onClose, onPlaylistImported, isQuran = false }) {
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
      const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
      const res = await fetch(`${API_BASE_URL}/api/playlists/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ url: url.trim(), isQuran })
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
        onPlaylistImported(data.playlist, data.tracks);
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg max-w-md w-full p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#0b1110]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#082621] text-[#26c4b7] brutal-border flex items-center justify-center">
              <DownloadCloud size={16} />
            </div>
            <div>
              <h3 className="text-base font-mono font-black uppercase text-[#082621]">Import External Tape</h3>
              <p className="text-[11px] text-[#082621]/70 font-sans">Resolve and convert Spotify, YouTube, or Apple Music</p>
            </div>
          </div>
          <button onClick={onClose} className="brutal-btn p-1 bg-[#ede5d3] brutal-border hover:bg-[#ded2bb] text-[#0b1110]">
            <X size={16} />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleImport} className="mt-4 space-y-4">
          <div>
            <label className="block text-[10px] font-mono font-black uppercase text-[#082621] mb-1.5">
              EXTERNAL ARCHIVE URL
            </label>
            <div className="relative">
              <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#082621]/60" />
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://open.spotify.com/playlist/... or YouTube link"
                className="w-full bg-[#ede5d3] brutal-border pl-9 pr-3 py-2 text-xs font-mono text-[#0b1110] placeholder-[#082621]/40 focus:outline-none focus:bg-white"
                autoFocus
              />
            </div>
          </div>

          {/* Badges for supported services */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className={`text-[10px] px-2.5 py-0.5 font-mono font-black uppercase brutal-border ${
              isSpotify ? 'bg-[#082621] text-[#26c4b7]' : 'bg-[#ede5d3] text-[#082621]/70'
            }`}>
              Spotify
            </span>
            <span className={`text-[10px] px-2.5 py-0.5 font-mono font-black uppercase brutal-border ${
              isYouTube ? 'bg-red-100 text-[#dc2626]' : 'bg-[#ede5d3] text-[#082621]/70'
            }`}>
              YouTube
            </span>
            <span className={`text-[10px] px-2.5 py-0.5 font-mono font-black uppercase brutal-border ${
              isApple ? 'bg-pink-100 text-pink-700' : 'bg-[#ede5d3] text-[#082621]/70'
            }`}>
              Apple Music
            </span>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="p-2.5 bg-red-100 border-2 border-[#dc2626] flex items-center gap-2 text-xs font-mono text-[#dc2626] font-bold">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-2.5 bg-[#082621] text-[#26c4b7] brutal-border flex items-center gap-2 text-xs font-mono font-bold">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>IMPORTED "{success.name}" ({success.trackCount} DOSES CONVERTED)!</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || !url.trim()}
              className="brutal-btn w-full py-2.5 bg-[#082621] hover:bg-[#0b1110] text-[#26c4b7] font-mono text-xs font-black uppercase brutal-border brutal-shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>RESOLVING & INTAKING TRACKS...</span>
                </>
              ) : (
                <>
                  <DownloadCloud size={15} />
                  <span>IMPORT INTO RIVO ARCHIVE</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
