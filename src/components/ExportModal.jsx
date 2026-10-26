import React, { useState } from 'react';
import { Download, FileText, Check, Music, ShieldCheck, X } from 'lucide-react';

export default function ExportModal({
  isOpen,
  onClose,
  playlist = null,
  allTracks = [],
  likedTrackIds = [],
  userPlaylists = [],
  globalTheme = 'dark'
}) {
  const [exportedFormat, setExportedFormat] = useState(null);
  const isDark = globalTheme === 'dark';

  if (!isOpen) return null;

  // Resolve playlist tracks
  const resolvedTracks = (() => {
    if (!playlist) return [];
    if (playlist.tracks && playlist.tracks.length > 0 && typeof playlist.tracks[0] === 'object') {
      return playlist.tracks;
    }
    const ids = (playlist.trackIds || []).map(String);
    return (allTracks || []).filter(t => ids.includes(String(t.id || t._id)));
  })();

  // 1. Export as M3U Playlist file
  const handleExportM3U = () => {
    const lines = ['#EXTM3U', `#PLAYLIST:${playlist?.name || 'Rivo Playlist'}`];
    resolvedTracks.forEach(t => {
      const dur = Math.round(Number(t.duration) || 210);
      const artist = t.artist || 'Unknown Artist';
      const title = t.title || 'Unknown Title';
      lines.push(`#EXTINF:${dur},${artist} - ${title}`);
      lines.push(t.audioUrl || '');
    });

    const m3uContent = lines.join('\n');
    const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(playlist?.name || 'playlist').replace(/[/\\?%*:|"<>]/g, '_')}.m3u`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportedFormat('M3U');
    setTimeout(() => setExportedFormat(null), 3000);
  };

  // 2. Export as JSON file
  const handleExportJSON = () => {
    const exportData = {
      version: '2.0.3',
      exportedAt: new Date().toISOString(),
      playlist: {
        id: playlist?.id || playlist?._id,
        name: playlist?.name || 'Rivo Playlist',
        description: playlist?.description || '',
        cover: playlist?.cover || '',
        trackCount: resolvedTracks.length,
        tracks: resolvedTracks.map(t => ({
          id: t.id || t._id,
          title: t.title,
          artist: t.artist,
          album: t.album,
          duration: t.duration,
          audioUrl: t.audioUrl,
          cover: t.cover || t.coverUrl
        }))
      }
    };

    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(playlist?.name || 'playlist').replace(/[/\\?%*:|"<>]/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportedFormat('JSON');
    setTimeout(() => setExportedFormat(null), 3000);
  };

  // 3. Export Full Library Backup
  const handleExportFullLibrary = () => {
    const libraryBackup = {
      app: 'Rivo',
      version: '2.0.3',
      exportedAt: new Date().toISOString(),
      likedCount: (likedTrackIds || []).length,
      likedTrackIds: likedTrackIds || [],
      playlists: (userPlaylists || []).map(p => ({
        id: p.id || p._id,
        name: p.name,
        description: p.description,
        isPublic: p.isPublic,
        trackIds: p.trackIds || []
      }))
    };

    const jsonStr = JSON.stringify(libraryBackup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rivo_Library_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportedFormat('LIBRARY');
    setTimeout(() => setExportedFormat(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className={`brutal-border-thick rounded-2xl w-full max-w-md p-6 brutal-shadow-lg relative ${
          isDark ? 'bg-[#101918] border-zinc-700 text-white' : 'bg-[#fdfbf7] border-black text-[#0b1110]'
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#17a398]/20 border border-[#17a398] flex items-center justify-center text-[#17a398]">
            <Download size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="font-display font-black text-base uppercase">Export & Backup</h3>
            <p className="text-xs text-zinc-400 font-mono">
              {playlist ? playlist.name : 'Rivo Music Library'}
            </p>
          </div>
        </div>

        {exportedFormat && (
          <div className="mb-4 p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs flex items-center gap-2">
            <Check size={14} strokeWidth={3} />
            <span>Exported as {exportedFormat} successfully!</span>
          </div>
        )}

        <div className="space-y-3 font-mono">
          {/* M3U Export */}
          {playlist && (
            <button
              onClick={handleExportM3U}
              className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 text-left transition cursor-pointer brutal-btn ${
                isDark ? 'bg-zinc-900 border-zinc-700 hover:border-[#17a398]' : 'bg-white border-black hover:bg-[#ede5d3]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Music size={18} className="text-[#17a398]" />
                <div>
                  <div className="text-xs font-black uppercase text-white">M3U Playlist File</div>
                  <div className="text-[10px] text-zinc-400">Compatible with VLC, media players & cars</div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-[#17a398] text-black font-black uppercase">
                .M3U
              </span>
            </button>
          )}

          {/* JSON Playlist Export */}
          {playlist && (
            <button
              onClick={handleExportJSON}
              className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 text-left transition cursor-pointer brutal-btn ${
                isDark ? 'bg-zinc-900 border-zinc-700 hover:border-[#17a398]' : 'bg-white border-black hover:bg-[#ede5d3]'
              }`}
            >
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-amber-400" />
                <div>
                  <div className="text-xs font-black uppercase text-white">JSON Portable Data</div>
                  <div className="text-[10px] text-zinc-400">Full metadata & direct stream links</div>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-400 text-black font-black uppercase">
                .JSON
              </span>
            </button>
          )}

          {/* Full Library Backup */}
          <button
            onClick={handleExportFullLibrary}
            className={`w-full flex items-center justify-between p-3.5 rounded-xl border-2 text-left transition cursor-pointer brutal-btn ${
              isDark ? 'bg-zinc-900 border-zinc-700 hover:border-emerald-400' : 'bg-white border-black hover:bg-[#ede5d3]'
            }`}
          >
            <div className="flex items-center gap-3">
              <ShieldCheck size={18} className="text-emerald-400" />
              <div>
                <div className="text-xs font-black uppercase text-white">Full Library Backup</div>
                <div className="text-[10px] text-zinc-400">All playlists, liked tracks & IDs</div>
              </div>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-400 text-black font-black uppercase">
              BACKUP
            </span>
          </button>
        </div>

        <div className="mt-5 text-right">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-zinc-700 text-xs font-bold text-zinc-300 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
