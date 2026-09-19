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
      setCover(track.cover || '');
      setAudioUrl(track.audioUrl || '');
      
      const lyricsString = (track.lyrics || [])
        .map(line => `[${formatTime(line.time)}] ${line.text}`)
        .join('\n');
      setLyricsText(lyricsString);
    }
  }, [track]);

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
      title,
      artist,
      album,
      cover: cover || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23082621"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%2326c4b7" font-size="80">R</text></svg>',
      audioUrl,
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 select-none">
      <div className="bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg max-w-lg w-full p-6 relative">
        <div className="flex items-center justify-between pb-3 border-b-2 border-[#0b1110]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-[#17a398] brutal-border" />
            <h3 className="text-base font-mono font-black uppercase text-[#082621]">Edit Song Details</h3>
          </div>
          <button onClick={onClose} className="brutal-btn p-1 bg-[#ede5d3] brutal-border hover:bg-[#ded2bb] text-[#0b1110]">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 my-4 max-h-[70vh] overflow-y-auto pr-1">
          <div>
            <label className="text-[10px] font-mono font-black uppercase text-[#082621] block mb-1">Song Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-[#ede5d3] brutal-border px-3 py-2 text-xs font-sans font-bold text-[#0b1110] focus:outline-none focus:bg-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono font-black uppercase text-[#082621] block mb-1">Artist</label>
              <input
                type="text"
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                required
                className="w-full bg-[#ede5d3] brutal-border px-3 py-2 text-xs font-sans font-bold text-[#0b1110] focus:outline-none focus:bg-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono font-black uppercase text-[#082621] block mb-1">Album</label>
              <input
                type="text"
                value={album}
                onChange={(e) => setAlbum(e.target.value)}
                className="w-full bg-[#ede5d3] brutal-border px-3 py-2 text-xs font-sans font-bold text-[#0b1110] focus:outline-none focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono font-black uppercase text-[#082621] block mb-1">Cover Artwork URL</label>
            <input
              type="text"
              value={cover}
              onChange={(e) => setCover(e.target.value)}
              className="w-full bg-[#ede5d3] brutal-border px-3 py-2 text-xs font-sans font-bold text-[#0b1110] focus:outline-none focus:bg-white"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono font-black uppercase text-[#082621] block mb-1">Audio Source Stream URL</label>
            <input
              type="text"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
              required
              className="w-full bg-[#ede5d3] brutal-border px-3 py-2 text-xs font-sans font-bold text-[#0b1110] focus:outline-none focus:bg-white"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-mono font-black uppercase text-[#082621]">Synced Lyrics Timestamps</label>
              <button
                type="button"
                onClick={handleAiSyncTimestamps}
                disabled={isAutoSyncing || !lyricsText.trim()}
                className="brutal-btn text-[10px] font-mono font-black uppercase text-[#082621] flex items-center gap-1 bg-[#26c4b7] px-2 py-0.5 brutal-border disabled:opacity-40"
              >
                <Sparkles size={11} />
                <span>{isAutoSyncing ? 'CALIBRATING...' : '🪄 AI TIMESTAMP SYNC'}</span>
              </button>
            </div>
            <textarea
              rows="4"
              value={lyricsText}
              onChange={(e) => setLyricsText(e.target.value)}
              placeholder="Paste plain lyrics text or format manually:&#10;[0:00] Line 1&#10;[0:15] Line 2"
              className="w-full bg-[#ede5d3] brutal-border p-2.5 text-xs text-[#0b1110] font-mono focus:outline-none focus:bg-white"
            />
          </div>

          <div className="flex gap-2 mt-2">
            <button
              type="submit"
              className="brutal-btn flex-1 py-2.5 bg-[#082621] hover:bg-[#0b1110] text-[#26c4b7] font-mono text-xs font-black uppercase brutal-border brutal-shadow"
            >
              SAVE SONG
            </button>
            <button
              type="button"
              onClick={() => setIsDeleteConfirmOpen(true)}
              className="brutal-btn py-2.5 px-4 bg-red-100 hover:bg-red-200 text-[#dc2626] font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm flex items-center gap-1"
            >
              <Trash2 size={15} />
              <span>DELETE</span>
            </button>
          </div>
        </form>
      </div>

      <ConfirmModal
        isOpen={isDeleteConfirmOpen}
        title={`Delete "${title}"?`}
        message="Are you sure you want to permanently delete this song?"
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
