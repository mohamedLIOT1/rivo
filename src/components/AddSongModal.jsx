import React, { useState } from 'react';
import { X, Upload, Music, Image, Search, Loader2, Check, Plus, Trash2, Link2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

const getToken = () => {
  try {
    return localStorage.getItem('rivo_token') || localStorage.getItem('liofy_token') || localStorage.getItem('token') || '';
  } catch {
    return '';
  }
};

export default function AddSongModal({ isOpen, onClose, onAddSong }) {
  const [tab, setTab] = useState('search'); // 'search' | 'link' | 'upload'
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addedIds, setAddedIds] = useState(new Set());
  const [searchError, setSearchError] = useState('');
  const [addingId, setAddingId] = useState(null);

  // Link Import form
  const [linkUrl, setLinkUrl] = useState('');
  const [isImportingLink, setIsImportingLink] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState(null);

  // Upload form
  const [title, setTitle]   = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum]   = useState('');
  const [genre, setGenre]   = useState('Pop');
  const [audioFile, setAudioFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Lyrics
  const [lyrics, setLyrics] = useState([]);

  if (!isOpen) return null;

  // ── Search ────────────────────────────────────────
  const handleSearch = async (e) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;
    setIsSearching(true);
    setResults([]);
    setSearchError('');

    // Check if user pasted a link (Spotify, YouTube, SoundCloud, etc.)
    if (/^(https?:\/\/|spotify:|youtu)/i.test(q)) {
      try {
        const token = getToken();
        const res = await fetch(`${API_BASE_URL}/api/tracks/import`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ url: q })
        });
        const data = await res.json();
        if (data.success && data.track) {
          setResults([data.track]);
          setIsSearching(false);
          return;
        } else {
          setSearchError(data.error || 'Failed to resolve link.');
        }
      } catch (err) {
        setSearchError('Network error while resolving link.');
      }
      setIsSearching(false);
      return;
    }

    // 1. Try Backend Search Engine
    try {
      const res = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.tracks) && data.tracks.length > 0) {
        setResults(data.tracks);
        setIsSearching(false);
        return;
      }
    } catch (err) {}

    // 2. Direct SoundCloud HD Full Track Search Fallback
    const SOUNDCLOUD_CLIENT_IDS = [
      'Mxv2e5wxnWei6krLywjIXpztX7S0VCeK',
      'iZ8g4v72mUqvA8jGFBsFoxWYuERgZaWi'
    ];

    for (const clientId of SOUNDCLOUD_CLIENT_IDS) {
      try {
        const scRes = await fetch(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(q)}&client_id=${clientId}&limit=15`);
        if (!scRes.ok) continue;
        const scData = await scRes.json();
        if (scData && Array.isArray(scData.collection) && scData.collection.length > 0) {
          const items = [];
          for (const item of scData.collection) {
            if ((item.duration || 0) < 30000) continue;
            const prog = item.media?.transcodings?.find(t => t.format?.protocol === 'progressive');
            if (!prog) continue;

            try {
              const streamRes = await fetch(`${prog.url}?client_id=${clientId}`);
              if (!streamRes.ok) continue;
              const streamData = await streamRes.json();
              if (!streamData.url) continue;

              items.push({
                id: `sc-${item.id}`,
                title: item.title || q,
                artist: item.user?.username || 'Artist',
                album: 'Single',
                cover: item.artwork_url
                  ? item.artwork_url.replace('-large', '-t500x500')
                  : (item.user?.avatar_url || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600'),
                audioUrl: streamData.url,
                duration: Math.round((item.duration || 180000) / 1000),
                source: 'SoundCloud',
              });
            } catch (err) {}
          }

          if (items.length > 0) {
            setResults(items);
            setIsSearching(false);
            return;
          }
        }
      } catch (err) {}
    }

    setIsSearching(false);
  };

  const handleAddSearchResult = async (track) => {
    setAddingId(track.id);
    setSearchError('');
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          title: track.title,
          artist: track.artist,
          album: track.album || 'Single',
          cover: track.cover,
          audioUrl: track.audioUrl,
          duration: track.duration || 180,
          genre: 'Pop',
          source: track.source || 'Online',
          lyrics: []
        })
      });
      const data = await res.json();
      if (data.success) {
        onAddSong?.(data.track);
        setAddedIds(prev => new Set([...prev, track.id]));
      } else {
        setSearchError(data.message || data.error || 'Failed to add song.');
      }
    } catch (err) {
      console.warn('Failed to save searched track:', err);
      setSearchError('Network error while adding song.');
    } finally {
      setAddingId(null);
    }
  };
  const handleAddFromSearch = handleAddSearchResult;

  // ── Link Import ───────────────────────────────────
  const handleImportLink = async (e) => {
    e?.preventDefault();
    const cleanUrl = linkUrl.trim();
    if (!cleanUrl) return;

    setIsImportingLink(true);
    setLinkError('');
    setLinkSuccess(null);

    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/tracks/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ url: cleanUrl })
      });

      const data = await res.json();
      if (!res.ok || !data.success || !data.track) {
        throw new Error(data.error || 'Failed to import track from link.');
      }

      setLinkSuccess(data.track);
      onAddSong?.(data.track);
      setLinkUrl('');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setLinkError(err.message || 'Something went wrong while importing the track.');
    } finally {
      setIsImportingLink(false);
    }
  };

  // ── Upload ────────────────────────────────────────
  const handleCoverChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    const reader = new FileReader();
    reader.onload = () => setCoverPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleAudioChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    if (!title) {
      const name = file.name.replace(/\.[^/.]+$/, '');
      const parts = name.split(' - ');
      if (parts.length === 2) {
        setArtist(parts[0].trim());
        setTitle(parts[1].trim());
      } else {
        setTitle(name);
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!title.trim() || !artist.trim()) {
      setUploadError('Title and artist are required.');
      return;
    }
    if (!audioFile) {
      setUploadError('Please choose an audio file.');
      return;
    }

    setIsUploading(true);
    setUploadError('');

    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('artist', artist.trim());
      formData.append('album', album.trim() || 'Single');
      formData.append('genre', genre);
      formData.append('audio', audioFile);
      if (coverFile) formData.append('cover', coverFile);
      formData.append('lyrics', JSON.stringify(lyrics));

      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/api/tracks/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setUploadDone(true);
        onAddSong?.(data.track);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setUploadError(data.message || 'Upload failed.');
      }
    } catch (err) {
      setUploadError('Network error during upload.');
    } finally {
      setIsUploading(false);
    }
  };

  const addLyricLine = () => {
    const lastTime = lyrics.length > 0 ? lyrics[lyrics.length - 1].time + 15 : 0;
    setLyrics([...lyrics, { time: lastTime, text: '' }]);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-5 border-b-2 border-[#0b1110] bg-[#ede5d3]">
          <div>
            <div className="text-[10px] font-mono font-black uppercase text-[#17a398]">
              RIVO MUSIC INTAKE
            </div>
            <h2 className="text-lg font-mono font-black uppercase text-[#082621]">
              ADD NEW SONG
            </h2>
          </div>
          <button 
            onClick={onClose} 
            className="brutal-btn p-1.5 bg-[#fdfbf7] brutal-border hover:bg-[#ede5d3] text-[#0b1110]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex border-b-2 border-[#0b1110] bg-[#fdfbf7]">
          <button
            type="button"
            onClick={() => setTab('search')}
            className={`flex-1 py-3 text-xs font-mono font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              tab === 'search' 
                ? 'bg-[#17a398] text-[#0b1110] border-b-2 border-[#0b1110]' 
                : 'text-[#082621]/60 hover:bg-[#ede5d3] hover:text-[#082621]'
            }`}
          >
            <Search size={14} />
            <span>Search & Add</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('link')}
            className={`flex-1 py-3 text-xs font-mono font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all border-l-2 border-[#0b1110] ${
              tab === 'link' 
                ? 'bg-[#17a398] text-[#0b1110] border-b-2 border-[#0b1110]' 
                : 'text-[#082621]/60 hover:bg-[#ede5d3] hover:text-[#082621]'
            }`}
          >
            <Link2 size={14} />
            <span>By Link</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('upload')}
            className={`flex-1 py-3 text-xs font-mono font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all border-l-2 border-[#0b1110] ${
              tab === 'upload' 
                ? 'bg-[#17a398] text-[#0b1110] border-b-2 border-[#0b1110]' 
                : 'text-[#082621]/60 hover:bg-[#ede5d3] hover:text-[#082621]'
            }`}
          >
            <Upload size={14} />
            <span>Direct Upload</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 md:p-5 overflow-y-auto flex-1">
          {/* ── SEARCH TAB ── */}
          {tab === 'search' && (
            <div className="flex flex-col gap-3">
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Track title, artist name, YouTube / Spotify link..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  className="flex-1 bg-[#ede5d3] text-[#0b1110] text-xs font-sans font-bold px-3 py-2.5 brutal-border focus:outline-none focus:bg-white placeholder-[#082621]/50"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isSearching || !query.trim()}
                  className="brutal-btn px-4 bg-[#082621] hover:bg-[#0b1110] text-[#26c4b7] font-mono text-xs font-black uppercase brutal-border brutal-shadow flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSearching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                  <span>Search</span>
                </button>
              </form>

              {searchError && (
                <div className="p-2.5 bg-red-100 border-2 border-[#dc2626] text-[#dc2626] text-xs font-mono font-bold">
                  {searchError}
                </div>
              )}

              {/* Search Results List */}
              <div className="flex flex-col gap-2 mt-1">
                {results.map((track) => (
                  <div 
                    key={track.id}
                    className="flex items-center gap-3 p-2.5 bg-[#ede5d3] brutal-border hover:bg-white transition-colors"
                  >
                    <img 
                      src={track.cover} 
                      alt={track.title} 
                      className="w-12 h-12 brutal-border object-cover shrink-0 bg-[#082621]"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display font-black text-xs text-[#082621] truncate">{track.title}</h4>
                      <p className="text-[11px] font-sans text-[#082621]/70 truncate">{track.artist}</p>
                      <span className="text-[9px] font-mono font-bold text-[#17a398]">{track.duration}</span>
                    </div>
                    <button
                      onClick={() => handleAddSearchResult(track)}
                      disabled={addingId === track.id || addedIds.has(track.id)}
                      className={`brutal-btn px-3 py-1.5 font-mono text-[11px] font-black uppercase brutal-border brutal-shadow-sm flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-60 ${
                        addedIds.has(track.id) ? 'bg-[#082621] text-[#26c4b7]' : 'bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110]'
                      }`}
                    >
                      {addedIds.has(track.id) ? (
                        <><Check size={13} /> Added</>
                      ) : addingId === track.id ? (
                        <><Loader2 size={12} className="animate-spin" /> Adding</>
                      ) : (
                        <><Plus size={13} /> Add</>
                      )}
                    </button>
                  </div>
                ))}

                {results.length === 0 && !isSearching && query && (
                  <p className="text-center text-xs font-mono text-[#082621]/60 py-6">
                    No results found. Try a different query or switch to Direct Upload.
                  </p>
                )}

                {results.length === 0 && !isSearching && !query && (
                  <p className="text-center text-xs font-mono text-[#082621]/70 py-6">
                    Search online and add directly to your library!
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── LINK TAB ── */}
          {tab === 'link' && (
            <form onSubmit={handleImportLink} className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-mono font-black uppercase text-[#082621] mb-1.5">
                  EXTERNAL TRACK LINK
                </label>
                <div className="relative">
                  <Link2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#082621]/60" />
                  <input
                    type="url"
                    required
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://open.spotify.com/track/... or YouTube / SoundCloud link"
                    className="w-full bg-[#ede5d3] brutal-border pl-9 pr-3 py-2.5 text-xs font-mono text-[#0b1110] placeholder-[#082621]/40 focus:outline-none focus:bg-white"
                    autoFocus
                  />
                </div>
              </div>

              {/* Badges for supported services */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className={`text-[10px] px-2.5 py-0.5 font-mono font-black uppercase brutal-border ${
                  linkUrl.includes('spotify.com') ? 'bg-[#082621] text-[#26c4b7]' : 'bg-[#ede5d3] text-[#082621]/70'
                }`}>
                  Spotify
                </span>
                <span className={`text-[10px] px-2.5 py-0.5 font-mono font-black uppercase brutal-border ${
                  linkUrl.includes('youtube.com') || linkUrl.includes('youtu.be') ? 'bg-red-100 text-[#dc2626]' : 'bg-[#ede5d3] text-[#082621]/70'
                }`}>
                  YouTube
                </span>
                <span className={`text-[10px] px-2.5 py-0.5 font-mono font-black uppercase brutal-border ${
                  linkUrl.includes('soundcloud.com') ? 'bg-orange-100 text-orange-600' : 'bg-[#ede5d3] text-[#082621]/70'
                }`}>
                  SoundCloud
                </span>
                <span className={`text-[10px] px-2.5 py-0.5 font-mono font-black uppercase brutal-border ${
                  linkUrl.includes('apple.com') ? 'bg-pink-100 text-pink-700' : 'bg-[#ede5d3] text-[#082621]/70'
                }`}>
                  Apple Music
                </span>
              </div>

              {linkError && (
                <div className="p-2.5 bg-red-100 border-2 border-[#dc2626] flex items-center gap-2 text-xs font-mono text-[#dc2626] font-bold">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{linkError}</span>
                </div>
              )}

              {linkSuccess && (
                <div className="p-2.5 bg-[#082621] text-[#26c4b7] brutal-border flex items-center gap-3 text-xs font-mono font-bold">
                  {linkSuccess.cover && (
                    <img src={linkSuccess.cover} alt={linkSuccess.title} className="w-10 h-10 brutal-border object-cover shrink-0" />
                  )}
                  <div className="truncate flex-1">
                    <div className="truncate text-white font-black">{linkSuccess.title}</div>
                    <div className="text-[10px] text-[#26c4b7] truncate">{linkSuccess.artist} (ADDED TO ARCHIVE)</div>
                  </div>
                  <CheckCircle2 size={16} className="shrink-0 text-[#26c4b7]" />
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isImportingLink || !linkUrl.trim()}
                  className="brutal-btn w-full py-2.5 bg-[#082621] hover:bg-[#0b1110] text-[#26c4b7] font-mono text-xs font-black uppercase brutal-border brutal-shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isImportingLink ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      <span>RESOLVING & INTAKING TRACK...</span>
                    </>
                  ) : (
                    <>
                      <Link2 size={15} />
                      <span>INTAKE SONG BY LINK</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ── UPLOAD TAB ── */}
          {tab === 'upload' && (
            <form onSubmit={handleUpload} className="flex flex-col gap-4">
              {uploadError && (
                <div className="p-3 bg-red-100 border-2 border-[#dc2626] text-[#dc2626] text-xs font-mono font-bold">
                  {uploadError}
                </div>
              )}

              {uploadDone && (
                <div className="p-3 bg-[#082621] text-[#26c4b7] brutal-border text-xs font-mono font-bold flex items-center gap-2">
                  <Check size={16} /> SONG ADDED TO LIBRARY!
                </div>
              )}

              {/* Cover + Audio */}
              <div className="flex gap-3">
                {/* Cover */}
                <label className="w-24 h-24 bg-[#ede5d3] brutal-border border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-white transition-colors overflow-hidden shrink-0">
                  {coverPreview ? (
                    <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Image size={24} className="text-[#082621]/60" />
                      <span className="text-[10px] font-mono font-black uppercase text-[#082621] mt-1">COVER</span>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
                </label>

                {/* Audio File */}
                <label className={`flex-1 h-24 bg-[#ede5d3] brutal-border border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${audioFile ? 'bg-[#fdfbf7] border-solid' : 'hover:bg-white'}`}>
                  {audioFile ? (
                    <>
                      <Music size={24} className="text-[#17a398]" />
                      <span className="text-xs font-mono text-[#082621] mt-1 font-bold text-center px-2 truncate max-w-full">{audioFile.name}</span>
                    </>
                  ) : (
                    <>
                      <Upload size={24} className="text-[#082621]/60" />
                      <span className="text-xs font-mono font-black uppercase text-[#082621] mt-1">SELECT AUDIO FILE (MP3)</span>
                    </>
                  )}
                  <input type="file" accept="audio/*" onChange={handleAudioChange} className="hidden" />
                </label>
              </div>

              {/* Fields */}
              {[
                { label: 'TRACK TITLE *', value: title, setter: setTitle, placeholder: 'e.g. Song Title' },
                { label: 'ARTIST *', value: artist, setter: setArtist, placeholder: 'e.g. Artist Name' },
                { label: 'ALBUM', value: album, setter: setAlbum, placeholder: 'e.g. Album Name' },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-[10px] font-mono font-black uppercase text-[#082621] block mb-1">{f.label}</label>
                  <input
                    value={f.value}
                    onChange={e => f.setter(e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full bg-[#ede5d3] text-[#0b1110] text-xs font-sans font-bold px-3 py-2 brutal-border focus:outline-none focus:bg-white"
                  />
                </div>
              ))}

              {/* Genre */}
              <div>
                <label className="text-[10px] font-mono font-black uppercase text-[#082621] block mb-1">GENRE</label>
                <select
                  value={genre}
                  onChange={e => setGenre(e.target.value)}
                  className="w-full bg-[#ede5d3] text-[#0b1110] text-xs font-mono font-bold px-3 py-2 brutal-border focus:outline-none focus:bg-white"
                >
                  {['Pop', 'Hip-Hop', 'R&B', 'Electronic', 'Rock', 'Jazz', 'Classical', 'Arab Pop', 'Mahragan', 'Sha3bi', 'Other'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              {/* Lyrics (optional) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-mono font-black uppercase text-[#082621]">SYNCED LYRICS TIMESTAMPS</label>
                  <button type="button" onClick={addLyricLine} className="text-[10px] font-mono font-black uppercase text-[#17a398] hover:underline">+ ADD TIMESTAMP</button>
                </div>
                {lyrics.map((line, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      type="number"
                      value={line.time}
                      onChange={e => setLyrics(prev => prev.map((l, idx) => idx === i ? { ...l, time: Number(e.target.value) } : l))}
                      placeholder="0"
                      className="w-16 bg-[#ede5d3] text-[#0b1110] text-xs font-mono px-2 py-1.5 brutal-border focus:outline-none focus:bg-white"
                    />
                    <input
                      value={line.text}
                      onChange={e => setLyrics(prev => prev.map((l, idx) => idx === i ? { ...l, text: e.target.value } : l))}
                      placeholder="Lyric line..."
                      className="flex-1 bg-[#ede5d3] text-[#0b1110] text-xs px-3 py-1.5 brutal-border focus:outline-none focus:bg-white"
                    />
                    <button type="button" onClick={() => setLyrics(prev => prev.filter((_, idx) => idx !== i))} className="text-[#dc2626] p-1 hover:bg-red-100">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={isUploading}
                className="brutal-btn w-full py-3 bg-[#082621] hover:bg-[#0b1110] text-[#26c4b7] font-mono text-xs font-black uppercase brutal-border brutal-shadow flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {isUploading ? (
                  <><Loader2 size={16} className="animate-spin" /> UPLOADING SONG...</>
                ) : (
                  <><Upload size={16} /> UPLOAD & SAVE SONG</>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
