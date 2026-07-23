import React, { useState, useEffect } from 'react';
import { X, Music, AlignLeft, Edit3, Trash2, Sparkles } from 'lucide-react';
import { API_BASE_URL } from '../config';

import ConfirmModal from './ConfirmModal';

export default function EditSongModal({ isOpen, onClose, track, onUpdateSong, onDeleteSong }) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [cover, setCover] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [lyricsText, setLyricsText] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (track) {
      setTitle(track.title || '');
      setArtist(track.artist || '');
      setAlbum(track.album || '');
      setCover(track.cover || '');
      setAudioUrl(track.audioUrl || '');
      
      const lyricsString = (track.lyrics || [])
        .map(line => `[${formatTime(line.time)}] ${line.text}`)
        .join('\n');
      setLyricsText(lyricsString);
    }
  }, [track]);

  if (!isOpen || !track) return null;

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
      title,
      artist,
      album,
      cover: cover || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%231DB954"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23000" font-size="80">🎵</text></svg>',
      audioUrl,
      lyrics: parsedLyrics
    };

    onUpdateSong(updated);
    onClose();
  };

  const [isAutoSyncing, setIsAutoSyncing] = useState(false);

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
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none">
      <div className="bg-[#181818] border border-zinc-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Edit3 className="text-[#1DB954]" size={20} />
            <h3 className="text-lg font-bold text-white">Edit Song & Timed Lyrics</h3>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-white rounded-full">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 my-4 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label className="text-xs uppercase font-extrabold text-zinc-400 block mb-1">Song Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#1DB954]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase font-extrabold text-zinc-400 block mb-1">Artist Name</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#1DB954]"
              />
            </div>
            <div>
              <label className="text-xs uppercase font-extrabold text-zinc-400 block mb-1">Album</label>
              <input
                type="text"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#1DB954]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase font-extrabold text-zinc-400 block mb-1">Cover Artwork URL</label>
            <input
              type="text"
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#1DB954]"
            />
          </div>

          <div>
            <label className="text-xs uppercase font-extrabold text-zinc-400 block mb-1">Audio Stream MP3 URL</label>
            <input
              type="text"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              required
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#1DB954]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs uppercase font-extrabold text-zinc-400">Synced Timed Lyrics</label>
              <button
                type="button"
                onClick={handleAiSyncTimestamps}
                disabled={isAutoSyncing || !lyricsText.trim()}
                className="text-[11px] font-bold text-[#1DB954] hover:text-[#1ed760] flex items-center gap-1 bg-[#1DB954]/10 hover:bg-[#1DB954]/20 px-2.5 py-1 rounded-full border border-[#1DB954]/30 transition-all disabled:opacity-40"
              >
                <Sparkles size={12} />
                <span>{isAutoSyncing ? 'Syncing...' : '🪄 AI Sync Timestamps'}</span>
              </button>
            </div>
            <textarea
              rows="5"
              value={lyricsText}
              onChange={(e) => setLyricsText(e.target.value)}
              placeholder="Paste plain lyrics text here and click 'AI Sync Timestamps' 🪄&#10;&#10;Or type manually:&#10;[0:00] First Line&#10;[0:15] Second Line"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-[#1DB954]"
            />
          </div>

          <div className="flex gap-2 mt-2">
            <button
              type="submit"
              className="flex-1 py-3 bg-[#1DB954] hover:bg-[#1ed760] text-black font-extrabold rounded-xl transition-all text-xs shadow-lg"
            >
              Save Changes & Timed Lyrics
            </button>
            <button
              type="button"
              onClick={() => setIsDeleteConfirmOpen(true)}
              className="py-3 px-4 bg-red-600/20 hover:bg-red-600/40 text-red-400 font-extrabold text-xs rounded-xl border border-red-500/30 transition-colors flex items-center gap-1"
            >
              <Trash2 size={16} />
              <span>Delete</span>
            </button>
          </div>
        </form>
      </div>

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title={`حذف "${title}"؟`}
        message="هل أنت تأكد من رغبتك في حذف هذه الأغنية؟ لا يمكن التراجع عن هذا الإجراء."
        confirmText="حذف الأغنية"
        cancelText="إلغاء"
        onConfirm={() => {
          setIsDeleteConfirmOpen(false);
          onDeleteSong(track.id);
          onClose();
        }}
        onCancel={() => setIsDeleteConfirmOpen(false)}
      />
    </div>
  );
}
