import React, { useState, useEffect, useRef } from 'react';
import { X, Link2, Music, DownloadCloud, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function ImportModal({
  isOpen,
  onClose,
  initialTab = 'track',
  onTrackImported,
  onPlaylistImported,
  isQuran = false,
  globalTheme = 'dark'
}) {
  const [activeTab, setActiveTab] = useState(initialTab || 'track');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const closeTimerRef = useRef(null);

  const isDark = globalTheme === 'dark';

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || 'track');
      setUrl('');
      setError('');
      setSuccess(null);
      setLoading(false);
    }
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const handleUrlChange = (newUrl) => {
    setUrl(newUrl);
    if (error) setError('');

    const lower = newUrl.trim().toLowerCase();
    if (lower.includes('/playlist') || lower.includes('list=')) {
      if (activeTab !== 'playlist') {
        setActiveTab('playlist');
      }
    } else if (lower.includes('/track/') || lower.includes('watch?v=') || lower.includes('youtu.be/')) {
      if (activeTab !== 'track') {
        setActiveTab('track');
      }
    }
  };

  const handleImport = async (e) => {
    e?.preventDefault();
    if (!url.trim()) return;

    setError('');
    setSuccess(null);
    setLoading(true);

    if (url.includes('soundcloud.com')) {
      setError('SoundCloud is not supported. Please use a YouTube, Spotify, or Apple Music link.');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
      const endpoint = activeTab === 'playlist'
        ? `${API_BASE_URL}/api/playlists/import`
        : `${API_BASE_URL}/api/tracks/import`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ url: url.trim(), isQuran })
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
        throw new Error(data.error || `Failed to import ${activeTab === 'playlist' ? 'playlist' : 'track'}`);
      }

      if (activeTab === 'playlist') {
        setSuccess({
          type: 'playlist',
          name: data.playlist?.name || 'Playlist',
          trackCount: data.trackCount ?? data.tracks?.length ?? 0
        });
        setUrl('');
        if (onPlaylistImported) {
          onPlaylistImported(data.playlist, data.tracks);
        }
      } else {
        if (!data.track) {
          throw new Error(data.error || 'Failed to import track');
        }
        setSuccess({
          type: 'track',
          title: data.track.title,
          artist: data.track.artist,
          cover: data.track.cover,
          track: data.track
        });
        setUrl('');
        if (onTrackImported) {
          onTrackImported(data.track);
        }
      }

      closeTimerRef.current = setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setError(err.message || 'Something went wrong while importing.');
    } finally {
      setLoading(false);
    }
  };

  const lowerUrl = url.toLowerCase();
  const isSpotify = lowerUrl.includes('spotify.com');
  const isYouTube = lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be');
  const isApple = lowerUrl.includes('apple.com');

  const modalTitle = isQuran
    ? (activeTab === 'playlist' ? 'Import Quran Playlist' : 'Import Surah / Recitation')
    : (activeTab === 'playlist' ? 'Import External Tape' : 'Import External Track');

  const modalSubtitle = isQuran
    ? (activeTab === 'playlist'
      ? 'Resolve and convert Quran playlist from YouTube or Spotify'
      : 'Resolve and intake Quran recitation from YouTube or Spotify')
    : (activeTab === 'playlist'
      ? 'Resolve and convert Spotify, YouTube, or Apple Music'
      : 'Resolve and intake Spotify, YouTube, or Apple Music');

  const inputLabel = activeTab === 'playlist'
    ? (isQuran ? 'QURAN PLAYLIST URL' : 'EXTERNAL ARCHIVE / TAPE URL')
    : (isQuran ? 'EXTERNAL SURAH / AUDIO LINK' : 'EXTERNAL TRACK LINK');

  const inputPlaceholder = activeTab === 'playlist'
    ? (isQuran
      ? 'Paste YouTube Quran playlist or Spotify link...'
      : 'https://open.spotify.com/playlist/... or YouTube link')
    : (isQuran
      ? 'Paste Surah link (YouTube, Spotify, etc.)...'
      : 'https://open.spotify.com/track/... or YouTube link');

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`brutal-border-thick brutal-shadow-lg max-w-md w-full p-6 relative ${
          isDark ? 'bg-[#121917] text-white border-zinc-700' : 'bg-[#fdfbf7] text-[#0b1110] border-[#0b1110]'
        }`}
      >
        {/* Header */}
        <div className={`flex items-center justify-between pb-3 border-b-2 ${
          isDark ? 'border-zinc-700' : 'border-[#0b1110]'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 brutal-border flex items-center justify-center ${
              isDark ? 'bg-[#082621] text-[#26c4b7] border-zinc-700' : 'bg-[#082621] text-[#26c4b7] border-[#0b1110]'
            }`}>
              {activeTab === 'playlist' ? <DownloadCloud size={16} /> : <Music size={16} />}
            </div>
            <div>
              <h3 className={`text-base font-mono font-black uppercase ${isDark ? 'text-white' : 'text-[#082621]'}`}>
                {modalTitle}
              </h3>
              <p className={`text-[11px] font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                {modalSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`brutal-btn p-1 brutal-border cursor-pointer ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700'
                : 'bg-[#ede5d3] hover:bg-[#ded2bb] text-[#0b1110] border-[#0b1110]'
            }`}
          >
            <X size={16} />
          </button>
        </div>

        {/* Segmented Tab Control */}
        <div className={`grid grid-cols-2 p-1 gap-1 my-4 brutal-border ${
          isDark ? 'bg-black/40 border-zinc-700' : 'bg-[#ede5d3] border-[#0b1110]'
        }`}>
          <button
            type="button"
            onClick={() => setActiveTab('track')}
            className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-mono font-black uppercase transition-all cursor-pointer brutal-border ${
              activeTab === 'track'
                ? (isDark ? 'bg-[#082621] text-[#26c4b7] border-zinc-700 shadow-sm' : 'bg-[#082621] text-[#26c4b7] border-[#0b1110] shadow-sm')
                : (isDark ? 'bg-transparent text-zinc-400 border-transparent hover:text-white' : 'bg-transparent text-[#082621]/70 border-transparent hover:text-[#082621]')
            }`}
          >
            <Music size={14} />
            <span>{isQuran ? 'Surah / Recitation' : 'Single Track'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('playlist')}
            className={`flex items-center justify-center gap-2 py-2 px-3 text-xs font-mono font-black uppercase transition-all cursor-pointer brutal-border ${
              activeTab === 'playlist'
                ? (isDark ? 'bg-[#082621] text-[#26c4b7] border-zinc-700 shadow-sm' : 'bg-[#082621] text-[#26c4b7] border-[#0b1110] shadow-sm')
                : (isDark ? 'bg-transparent text-zinc-400 border-transparent hover:text-white' : 'bg-transparent text-[#082621]/70 border-transparent hover:text-[#082621]')
            }`}
          >
            <DownloadCloud size={14} />
            <span>{isQuran ? 'Quran Playlist' : 'Playlist / Tape'}</span>
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleImport} className="space-y-4">
          <div>
            <label className={`block text-[10px] font-mono font-black uppercase mb-1.5 ${
              isDark ? 'text-zinc-300' : 'text-[#082621]'
            }`}>
              {inputLabel}
            </label>
            <div className="relative">
              <Link2 size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${
                isDark ? 'text-zinc-500' : 'text-[#082621]/60'
              }`} />
              <input
                type="url"
                required
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder={inputPlaceholder}
                className={`w-full pl-9 pr-3 py-2 text-xs font-mono brutal-border focus:outline-none ${
                  isDark
                    ? 'bg-zinc-900 border-zinc-700 text-white placeholder-zinc-500 focus:bg-zinc-800 focus:border-[#26c4b7]'
                    : 'bg-[#ede5d3] border-[#0b1110] text-[#0b1110] placeholder-[#082621]/40 focus:bg-white focus:border-[#082621]'
                }`}
                autoFocus
              />
            </div>
          </div>

          {/* Badges for supported services */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className={`text-[10px] px-2.5 py-0.5 font-mono font-black uppercase brutal-border transition-colors ${
              isSpotify
                ? 'bg-[#082621] text-[#26c4b7] border-[#26c4b7]'
                : (isDark ? 'bg-zinc-900 text-zinc-500 border-zinc-800' : 'bg-[#ede5d3] text-[#082621]/70 border-[#0b1110]')
            }`}>
              Spotify
            </span>
            <span className={`text-[10px] px-2.5 py-0.5 font-mono font-black uppercase brutal-border transition-colors ${
              isYouTube
                ? 'bg-red-600/20 text-[#ef4444] border-[#ef4444]'
                : (isDark ? 'bg-zinc-900 text-zinc-500 border-zinc-800' : 'bg-[#ede5d3] text-[#082621]/70 border-[#0b1110]')
            }`}>
              YouTube
            </span>
            <span className={`text-[10px] px-2.5 py-0.5 font-mono font-black uppercase brutal-border transition-colors ${
              isApple
                ? 'bg-pink-600/20 text-pink-400 border-pink-400'
                : (isDark ? 'bg-zinc-900 text-zinc-500 border-zinc-800' : 'bg-[#ede5d3] text-[#082621]/70 border-[#0b1110]')
            }`}>
              Apple Music
            </span>
          </div>

          {/* Status Messages */}
          {error && (
            <div className="p-2.5 bg-red-500/10 border-2 border-[#dc2626] flex items-center gap-2 text-xs font-mono text-[#dc2626] font-bold">
              <AlertCircle size={15} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && success.type === 'track' && (
            <div className="p-2.5 bg-[#082621] text-[#26c4b7] brutal-border flex items-center gap-3 text-xs font-mono font-bold">
              {success.cover && (
                <img src={success.cover} alt={success.title} className="w-9 h-9 brutal-border object-cover shrink-0" />
              )}
              <div className="truncate flex-1">
                <div className="truncate text-white font-black">{success.title}</div>
                <div className="text-[10px] text-[#26c4b7] truncate">
                  {success.artist} ({isQuran ? 'ADDED TO SURAHS' : 'ADDED TO ARCHIVE'})
                </div>
              </div>
              <CheckCircle2 size={16} className="shrink-0 text-[#26c4b7]" />
            </div>
          )}

          {success && success.type === 'playlist' && (
            <div className="p-2.5 bg-[#082621] text-[#26c4b7] brutal-border flex items-center gap-2 text-xs font-mono font-bold">
              <CheckCircle2 size={15} className="shrink-0 text-[#26c4b7]" />
              <span className="truncate">
                IMPORTED "{success.name}" ({success.trackCount} {isQuran ? (success.trackCount === 1 ? 'SURAH' : 'SURAHS') : 'DOSES CONVERTED'})!
              </span>
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
                  <span>
                    {activeTab === 'track'
                      ? (isQuran ? 'RESOLVING & IMPORTING SURAH...' : 'RESOLVING & INTAKING TRACK...')
                      : (isQuran ? 'RESOLVING & IMPORTING SURAHS...' : 'RESOLVING & INTAKING TRACKS...')}
                  </span>
                </>
              ) : (
                <>
                  {activeTab === 'track' ? <Music size={15} /> : <DownloadCloud size={15} />}
                  <span>
                    {activeTab === 'track'
                      ? (isQuran ? 'IMPORT SURAH INTO RIVO' : 'INTAKE TRACK INTO RIVO')
                      : (isQuran ? 'IMPORT QURAN PLAYLIST' : 'IMPORT INTO RIVO ARCHIVE')}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
