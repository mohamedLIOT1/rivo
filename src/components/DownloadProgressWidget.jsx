import React from 'react';
import { Download, X } from 'lucide-react';
import { useDownloadManager } from '../context/DownloadContext';

export default function DownloadProgressWidget({ tracks = [] }) {
  const downloadManager = useDownloadManager();
  if (!downloadManager) return null;

  const { downloadingTrackId, downloadProgress, cancelTrackDownload, isBatchDownloading, batchStats } = downloadManager;
  if (!downloadingTrackId) return null;

  const currentTrack = (tracks || []).find(t => String(t.id || t._id) === String(downloadingTrackId));
  const trackTitle = currentTrack?.title || 'Downloading Track';
  const percent = downloadProgress?.percent || 0;
  const speedText = downloadProgress?.speedText || 'Calculating...';
  const loadedMb = downloadProgress?.loadedMb || '0';
  const totalMb = downloadProgress?.totalMb || '?';

  return (
    <div className="fixed bottom-24 right-4 z-50 bg-[#0f1918] border-2 border-[#17a398] shadow-[4px_4px_0px_#000] p-3 rounded-xl max-w-xs w-full animate-in fade-in slide-in-from-bottom-2 text-white font-mono select-none">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-5 h-5 rounded bg-[#17a398]/20 flex items-center justify-center text-[#17a398] animate-bounce shrink-0">
            <Download size={13} strokeWidth={2.5} />
          </div>
          <span className="text-xs font-black truncate text-white">{trackTitle}</span>
        </div>
        <button
          onClick={() => cancelTrackDownload(downloadingTrackId)}
          className="text-zinc-400 hover:text-red-400 transition cursor-pointer p-0.5 rounded"
          title="Cancel Download"
        >
          <X size={14} />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden mb-1.5 border border-zinc-700">
        <div
          className="bg-[#17a398] h-full transition-all duration-300 rounded-full"
          style={{ width: `${Math.max(5, percent)}%` }}
        />
      </div>

      {/* Stats Row */}
      <div className="flex items-center justify-between text-[10px] font-bold text-zinc-300">
        <span className="text-[#17a398]">{speedText}</span>
        <span>{loadedMb}MB / {totalMb}MB</span>
        <span className="bg-zinc-800 px-1 rounded text-teal-300">{percent}%</span>
      </div>

      {isBatchDownloading && batchStats?.total > 1 && (
        <div className="mt-1 pt-1 border-t border-zinc-800 text-[9px] text-zinc-400 text-center">
          Batch: {batchStats.current + 1} of {batchStats.total} ({batchStats.playlistName || 'Playlist'})
        </div>
      )}
    </div>
  );
}
