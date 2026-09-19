import React, { useState, useEffect } from 'react';
import { X, Music, AlignLeft, Edit3, Trash2, Sparkles, ShieldCheck, Check, Loader2, Tag, Image, Volume2 } from 'lucide-react';
import { API_BASE_URL } from '../config';
import ConfirmModal from './ConfirmModal';

export default function EditSongModal({ 
  isOpen, 
  onClose, 
  track, 
  onUpdateSong, 
  onDeleteSong,
  globalTheme = 'dark'
}) {
  const isDark = globalTheme === 'dark';

  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [genre, setGenre] = useState('');
  const [cover, setCover] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [lyricsText, setLyricsText] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const parseTimestamp = (str) => {
    const match = str.match(/\[?(\d+):(\d+)\]?/);
    if (match) {
      return parseInt(match[1]) * 60 + parseInt(match[2]);
    }
    return 0;
  };

  useEffect(() => {
    if (track) {
      setTitle(track.title || '');
      setArtist(track.artist || '');
      setAlbum(track.album || '');
      setGenre(track.genre || '');
      setCover(track.cover || '');
      setAudioUrl(track.audioUrl || '');
      
      const lyricsString = (track.lyrics || [])
        .map(line => `[${formatTime(line.time)}] ${line.text}`)
        .join('\n');
      setLyricsText(lyricsString);
    }
  }, [track, isOpen]);

  if (!isOpen || !track) return null;

  const handleSubmit = (e) => {
    e.preventDefault();

    const parsedLyrics = lyricsText
      .split('\n')
      .filter(line => line.trim())
      .map((line, idx) => {
        const time = parseTimestamp(line) || idx * 10;
        const text = line.replace(/\[\d+:\d+\]/, '').trim();
        return { time, text };
      });

    const updated = {
      ...track,
      title: title.trim(),
      artist: artist.trim(),
      album: album.trim() || 'Single',
      genre: genre.trim() || 'Pop',
      cover: cover.trim() || 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600',
      audioUrl: audioUrl.trim(),
      lyrics: parsedLyrics
    };

    onUpdateSong(updated);
    onClose();
  };

  const handleAiSyncTimestamps = async () => {
    if (!lyricsText || !lyricsText.trim()) return;
    setIsAutoSyncing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/ai/sync-timestamps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: lyricsText,
          title,
          artist,
          duration: track?.duration || 180
        })
      });
      const data = await res.json();
      if (data.success && data.timestampedText) {
        setLyricsText(data.timestampedText);
      }
    } catch (e) {
      console.warn('AI Sync Timestamps error:', e);
    }
    setIsAutoSyncing(false);
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
                  Admin: Edit Song Details
                </h3>
                <span className="text-[9px] font-mono font-black uppercase px-1.5 py-0.5 rounded bg-[#f59e0b] text-black">
                  Admin Exclusive
                </span>
              </div>
              <p className={`text-[11px] font-sans ${isDark ? 'text-zinc-400' : 'text-[#082621]/70'}`}>
                Editing song: <strong>{track.title}</strong> — {track.artist}
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
              <Music size={13} className="text-[#17a398]" /> Song Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className={`w-full p-2.5 text-xs font-bold rounded-lg brutal-border focus:outline-none ${
                isDark ? 'bg-[#1a2421] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
              }`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
                <Edit3 size={13} className="text-[#17a398]" /> Artist
              </label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                required
                className={`w-full p-2.5 text-xs font-bold rounded-lg brutal-border focus:outline-none ${
                  isDark ? 'bg-[#1a2421] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
                }`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
                <AlignLeft size={13} className="text-[#17a398]" /> Album
              </label>
              <input
                type="text"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                placeholder="Single / Album Name"
                className={`w-full p-2.5 text-xs font-bold rounded-lg brutal-border focus:outline-none ${
                  isDark ? 'bg-[#1a2421] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
                <Image size={13} className="text-[#17a398]" /> Cover Artwork URL
              </label>
              <input
                type="text"
                value={cover}
                onChange={(e) => setCover(e.target.value)}
                className={`w-full p-2.5 text-xs font-mono rounded-lg brutal-border focus:outline-none ${
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
                placeholder="Pop, Hip-Hop, etc."
                className={`w-full p-2.5 text-xs font-bold rounded-lg brutal-border focus:outline-none ${
                  isDark ? 'bg-[#1a2421] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
                }`}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono font-bold uppercase mb-1 flex items-center gap-1.5">
              <Volume2 size={13} className="text-[#17a398]" /> Audio Stream URL (Optional / MP3 Source)
            </label>
            <input
              type="text"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              placeholder="Leave blank for auto dynamic SoundCloud/YouTube resolution"
              className={`w-full p-2.5 text-xs font-mono rounded-lg brutal-border focus:outline-none ${
                isDark ? 'bg-[#1a2421] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-[11px] font-mono font-bold uppercase flex items-center gap-1.5">
                <AlignLeft size={13} className="text-[#17a398]" /> Synced Lyrics Timestamps
              </label>
              <button
                type="button"
                onClick={handleAiSyncTimestamps}
                disabled={isAutoSyncing || !lyricsText.trim()}
                className="text-[10px] font-mono font-black uppercase flex items-center gap-1 bg-[#26c4b7] text-[#082621] px-2 py-0.5 rounded brutal-border disabled:opacity-40 cursor-pointer"
              >
                <Sparkles size={11} />
                <span>{isAutoSyncing ? 'CALIBRATING...' : 'AI TIMESTAMP SYNC'}</span>
              </button>
            </div>
            <textarea
              rows="5"
              value={lyricsText}
              onChange={(e) => setLyricsText(e.target.value)}
              placeholder="Paste plain lyrics text or format manually:&#10;[0:00] Line 1&#10;[0:15] Line 2"
              className={`w-full p-2.5 text-xs font-mono rounded-lg brutal-border focus:outline-none resize-none leading-relaxed ${
                isDark ? 'bg-[#1a2421] text-white border-zinc-700 focus:border-[#17a398]' : 'bg-white text-black border-black focus:border-[#17a398]'
              }`}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-[#17a398] hover:bg-[#26c4b7] text-[#0b1110] font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm flex items-center justify-center gap-2 cursor-pointer rounded-xl"
            >
              <Check size={16} />
              <span>SAVE SONG</span>
            </button>
            {onDeleteSong && (
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(true)}
                className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-500 font-mono text-xs font-bold uppercase brutal-border border-red-500/40 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={15} />
                <span>DELETE</span>
              </button>
            )}
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

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title={`Delete "${title}"?`}
        message="Are you sure you want to permanently delete this song from the global website database?"
        confirmText="Delete Song"
        cancelText="Cancel"
        onConfirm={() => {
          setIsDeleteConfirmOpen(false);
          onDeleteSong(track?.id || track?._id);
          onClose();
        }}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />
    </div>
  );
}
