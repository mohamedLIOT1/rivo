import React, { useState } from 'react';
import { X, Link2, Music, Loader2, CheckCircle2, AlertCircle, Play } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function ImportSongModal({ isOpen, onClose, onTrackImported, isQuran = false }) {
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
      const res = await fetch(`${API_BASE_URL}/api/tracks/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ url: url.trim(), isQuran })
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.track) {
        throw new Error(data.error || 'Failed to import track');
      }

      setSuccess({
        title: data.track.title,
        artist: data.track.artist,
        cover: data.track.cover,
        track: data.track
      });
      setUrl('');

      if (onTrackImported) {
        onTrackImported(data.track);
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
  const isSoundCloud = url.includes('soundcloud.com');
  const isApple = url.includes('apple.com');

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg max-w-md w-full p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#0b1110]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#082621] text-[#26c4b7] brutal-border flex items-center justify-center">
              <Music size={16} />
            </div>
            <div>
              <h3 className="text-base font-mono font-black uppercase text-[#082621]">
                {isQuran ? 'Import Surah / Recitation' : 'Import External Track'}
              </h3>
              <p className="text-[11px] text-[#082621]/70 font-sans">
                {isQuran ? 'Resolve and intake Quran recitation from YouTube, Spotify, or SoundCloud' : 'Resolve and intake Spotify, YouTube, SoundCloud, or Apple Music'}
              </p>
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
              {isQuran ? 'EXTERNAL SURAH / AUDIO LINK' : 'EXTERNAL TRACK LINK'}
            </label>
            <div className="relative">
              <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#082621]/60" />
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={isQuran ? "Paste Surah link (YouTube, Spotify, etc.)..." : "https://open.spotify.com/track/... or YouTube link"}
                className="w-full bg-[#ede5d3] brutal-border pl-9 pr-3 py-2 text-xs font-mono text-[#0b1110] placeholder-[#082621]/40 focus:outline-none focus:bg-white"
                autoFocus
              />
            </div>
          </div>

          {/* Badges for supported services */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
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
              isSoundCloud ? 'bg-orange-100 text-orange-700' : 'bg-[#ede5d3] text-[#082621]/70'
            }`}>
              SoundCloud
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
            <div className="p-2.5 bg-[#082621] text-[#26c4b7] brutal-border flex items-center gap-3 text-xs font-mono font-bold">
              {success.cover && (
                <img src={success.cover} alt={success.title} className="w-9 h-9 brutal-border object-cover shrink-0" />
              )}
              <div className="truncate flex-1">
                <div className="truncate text-white font-black">{success.title}</div>
                <div className="text-[10px] text-[#26c4b7] truncate">{success.artist} (ADDED TO ARCHIVE)</div>
              </div>
              <CheckCircle2 size={16} className="shrink-0 text-[#26c4b7]" />
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
                  <span>{isQuran ? 'RESOLVING & IMPORTING SURAH...' : 'RESOLVING & INTAKING TRACK...'}</span>
                </>
              ) : (
                <>
                  <Music size={15} />
                  <span>{isQuran ? 'IMPORT SURAH INTO RIVO' : 'INTAKE TRACK INTO RIVO'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
