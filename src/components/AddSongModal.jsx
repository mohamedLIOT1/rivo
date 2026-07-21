import React, { useState } from 'react';
import { X, Upload, Music, Image, Search, Loader2, Check, Plus, Trash2 } from 'lucide-react';
import { API_BASE_URL } from '../config';

const getToken = () => localStorage.getItem('liofy_token') || '';

export default function AddSongModal({ isOpen, onClose, onAddSong }) {
  const [tab, setTab] = useState('search'); // 'search' | 'upload'
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [addedIds, setAddedIds] = useState(new Set());

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
      'emAJdGEj1mm9yjoCD2jkixmgqrGIyfpi',
      'iZ8g4v72mUqvA8jGFBsFoxWYuERgZaWi',
      '2t9mstKWWiYskyqsqfVJ5zZZsEyeTKYd',
      '02a2b475b0870932a326622d992f9d85'
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

  const handleAddFromSearch = async (track) => {
    if (addedIds.has(track.id)) return;
    setAddedIds(p => new Set(p).add(track.id));
    const newTrack = { ...track, liked: false };
    await onAddSong(newTrack);
  };

  // ── File Upload ───────────────────────────────────
  const handleCoverChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setCoverPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleAudioChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!title || !artist) { setUploadError('Title and artist required'); return; }
    if (!audioFile)         { setUploadError('Please select an MP3 file'); return; }

    setIsUploading(true);
    setUploadError('');

    try {
      const token = getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Upload audio
      const audioForm = new FormData();
      audioForm.append('audio', audioFile);
      const audioRes = await fetch(`${API_BASE_URL}/api/upload/audio`, {
        method: 'POST', headers, body: audioForm,
      });
      const audioData = await audioRes.json();
      if (!audioData.success) throw new Error(audioData.error || 'Audio upload failed');

      // Upload cover (optional)
      let coverUrl = '';
      if (coverFile) {
        const coverForm = new FormData();
        coverForm.append('cover', coverFile);
        const coverRes = await fetch(`${API_BASE_URL}/api/upload/cover`, {
          method: 'POST', headers, body: coverForm,
        });
        const coverData = await coverRes.json();
        if (coverData.success) coverUrl = coverData.url;
      }

      // Save track to global library
      const trackData = {
        title, artist, album: album || 'Single', genre,
        audioUrl: audioData.url,
        cover: coverUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(title)}&background=1DB954&color=000&size=512&bold=true&format=svg`,
        source: 'Upload',
        lyrics,
      };

      const saveRes = await fetch(`${API_BASE_URL}/api/tracks/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(trackData),
      });
      const saveData = await saveRes.json();
      if (!saveData.success) throw new Error(saveData.error || 'Save failed');

      await onAddSong({ ...saveData.track, liked: false });
      setUploadDone(true);

      // Reset form
      setTimeout(() => {
        setTitle(''); setArtist(''); setAlbum(''); setGenre('Pop');
        setAudioFile(null); setCoverFile(null); setCoverPreview('');
        setLyrics([]); setUploadDone(false);
      }, 2000);
    } catch (err) {
      setUploadError(err.message);
    }
    setIsUploading(false);
  };

  // ── Lyrics editor ─────────────────────────────────
  const addLyricLine = () => {
    const lastTime = lyrics.length > 0 ? lyrics[lyrics.length - 1].time + 15 : 0;
    setLyrics([...lyrics, { time: lastTime, text: '' }]);
  };

  return (
    <div className="fixed inset-0 z-[150] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#121212] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-extrabold text-white">Add Song</h2>
          <button onClick={onClose} className="p-1.5 text-[#b3b3b3] hover:text-white rounded-full hover:bg-white/10 transition-all">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {[
            { id: 'search', label: '🔍 Search Online' },
            { id: 'upload', label: '⬆️ Upload MP3' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 py-3 text-sm font-bold transition-all"
              style={tab === t.id
                ? { color: '#1DB954', borderBottom: '2px solid #1DB954' }
                : { color: '#b3b3b3' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">

          {/* ── SEARCH TAB ── */}
          {tab === 'search' && (
            <div>
              <form onSubmit={handleSearch} className="flex gap-2 mb-5">
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search YouTube, SoundCloud..."
                  className="flex-1 bg-[#282828] text-white text-sm px-4 py-2.5 rounded-full border border-white/10 focus:outline-none focus:border-[#1DB954]"
                />
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-4 py-2.5 bg-[#1DB954] text-black text-sm font-bold rounded-full hover:bg-[#1ed760] transition-all disabled:opacity-50"
                >
                  {isSearching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                </button>
              </form>

              {isSearching && (
                <div className="text-center py-10">
                  <Loader2 size={32} className="animate-spin text-[#1DB954] mx-auto" />
                  <p className="text-sm text-[#b3b3b3] mt-3">Searching YouTube & SoundCloud...</p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {results.map(track => (
                  <div key={track.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#181818] hover:bg-[#282828] transition-colors border border-white/5">
                    <img
                      src={track.cover || `https://ui-avatars.com/api/?name=${encodeURIComponent(track.title)}&background=1DB954&color=000`}
                      alt={track.title}
                      className="w-12 h-12 rounded-lg object-cover shrink-0"
                      onError={e => { e.target.src = `https://ui-avatars.com/api/?name=Music&background=1DB954&color=000`; }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{track.title}</p>
                      <p className="text-xs text-[#b3b3b3] truncate">{track.artist}</p>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block"
                        style={{
                          background: track.source === 'YouTube' ? '#ff000020' : '#1DB95420',
                          color: track.source === 'YouTube' ? '#ff4444' : '#1DB954',
                        }}
                      >
                        {track.source}
                      </span>
                    </div>
                    <button
                      onClick={() => handleAddFromSearch(track)}
                      disabled={addedIds.has(track.id)}
                      className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all"
                      style={{
                        background: addedIds.has(track.id) ? '#1DB954' : '#282828',
                        color: addedIds.has(track.id) ? 'black' : 'white',
                      }}
                    >
                      {addedIds.has(track.id) ? <Check size={16} /> : <Plus size={16} />}
                    </button>
                  </div>
                ))}

                {results.length === 0 && !isSearching && query && (
                  <p className="text-center text-sm text-[#b3b3b3] py-8">No results found. Try a different search.</p>
                )}

                {results.length === 0 && !isSearching && !query && (
                  <p className="text-center text-sm text-[#b3b3b3] py-8">
                    Search for any song and add it to the shared library for everyone!
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── UPLOAD TAB ── */}
          {tab === 'upload' && (
            <form onSubmit={handleUpload} className="flex flex-col gap-4">
              {uploadError && (
                <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-400 text-sm">
                  {uploadError}
                </div>
              )}

              {uploadDone && (
                <div className="p-3 bg-[#1DB954]/20 border border-[#1DB954]/40 rounded-xl text-[#1DB954] text-sm flex items-center gap-2">
                  <Check size={16} /> Song uploaded and added to the shared library!
                </div>
              )}

              {/* Cover + Audio */}
              <div className="flex gap-3">
                {/* Cover */}
                <label className="w-24 h-24 rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center cursor-pointer hover:border-[#1DB954] transition-colors overflow-hidden shrink-0">
                  {coverPreview ? (
                    <img src={coverPreview} alt="cover" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Image size={24} className="text-[#b3b3b3]" />
                      <span className="text-[10px] text-[#b3b3b3] mt-1">Cover</span>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleCoverChange} className="hidden" />
                </label>

                {/* Audio File */}
                <label className={`flex-1 h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${audioFile ? 'border-[#1DB954] bg-[#1DB954]/10' : 'border-white/20 hover:border-[#1DB954]'}`}>
                  {audioFile ? (
                    <>
                      <Music size={24} className="text-[#1DB954]" />
                      <span className="text-xs text-[#1DB954] mt-1 font-bold text-center px-2 truncate max-w-full">{audioFile.name}</span>
                    </>
                  ) : (
                    <>
                      <Upload size={24} className="text-[#b3b3b3]" />
                      <span className="text-xs text-[#b3b3b3] mt-1">Upload MP3</span>
                    </>
                  )}
                  <input type="file" accept="audio/*" onChange={handleAudioChange} className="hidden" />
                </label>
              </div>

              {/* Fields */}
              {[
                { label: 'Song Title *', value: title, setter: setTitle, placeholder: 'e.g. Blinding Lights' },
                { label: 'Artist *', value: artist, setter: setArtist, placeholder: 'e.g. The Weeknd' },
                { label: 'Album', value: album, setter: setAlbum, placeholder: 'e.g. After Hours' },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-xs font-bold text-[#b3b3b3] block mb-1">{f.label}</label>
                  <input
                    value={f.value}
                    onChange={e => f.setter(e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full bg-[#282828] text-white text-sm px-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-[#1DB954]"
                  />
                </div>
              ))}

              {/* Genre */}
              <div>
                <label className="text-xs font-bold text-[#b3b3b3] block mb-1">Genre</label>
                <select
                  value={genre}
                  onChange={e => setGenre(e.target.value)}
                  className="w-full bg-[#282828] text-white text-sm px-4 py-2.5 rounded-xl border border-white/10 focus:outline-none focus:border-[#1DB954]"
                >
                  {['Pop', 'Hip-Hop', 'R&B', 'Electronic', 'Rock', 'Jazz', 'Classical', 'Arab Pop', 'Mahragan', 'Sha3bi', 'Other'].map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              {/* Lyrics (optional) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-[#b3b3b3]">Synced Lyrics (optional)</label>
                  <button type="button" onClick={addLyricLine} className="text-xs text-[#1DB954] font-bold">+ Add Line</button>
                </div>
                {lyrics.map((line, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input
                      type="number"
                      value={line.time}
                      onChange={e => setLyrics(prev => prev.map((l, idx) => idx === i ? { ...l, time: Number(e.target.value) } : l))}
                      placeholder="0"
                      className="w-16 bg-[#282828] text-white text-xs px-2 py-2 rounded-lg border border-white/10 focus:outline-none"
                    />
                    <input
                      value={line.text}
                      onChange={e => setLyrics(prev => prev.map((l, idx) => idx === i ? { ...l, text: e.target.value } : l))}
                      placeholder="Lyric line..."
                      className="flex-1 bg-[#282828] text-white text-xs px-3 py-2 rounded-lg border border-white/10 focus:outline-none"
                    />
                    <button type="button" onClick={() => setLyrics(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-300">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                disabled={isUploading}
                className="w-full py-3 bg-[#1DB954] text-black font-extrabold text-sm rounded-full hover:bg-[#1ed760] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <><Loader2 size={16} className="animate-spin" /> Uploading...</>
                ) : (
                  <><Upload size={16} /> Upload & Share with Everyone</>
                )}
              </button>

              <p className="text-xs text-center text-[#b3b3b3]">
                Uploaded songs appear in the shared library for all users 🌍
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
