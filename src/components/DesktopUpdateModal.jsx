import React, { useState, useEffect } from 'react';
import { Download, Sparkles, X, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function DesktopUpdateModal() {
  const [updateHandle, setUpdateHandle] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    // Only run if running inside Tauri desktop app
    const isTauri = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
    if (!isTauri) return;

    let isMounted = true;

    async function checkForUpdates() {
      try {
        const { check } = await import('@tauri-apps/plugin-updater');
        const update = await check();
        if (update && isMounted) {
          setUpdateHandle(update);
          setIsOpen(true);
        }
      } catch (err) {
        // Silently ignore check errors (e.g. offline)
        console.warn('[DesktopUpdate] Check failed:', err);
      }
    }

    // Check after 3 seconds so app renders first smoothly
    const timer = setTimeout(checkForUpdates, 3000);
    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  if (!isOpen || !updateHandle) return null;

  const handleUpdateNow = async () => {
    try {
      setIsDownloading(true);
      setError(null);
      setDownloadStatus('Downloading update...');
      setDownloadProgress(0);

      let contentLength = 0;
      let downloaded = 0;

      await updateHandle.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          contentLength = event.data.contentLength || 0;
          setDownloadStatus('Download started...');
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength;
          if (contentLength > 0) {
            const pct = Math.min(100, Math.round((downloaded / contentLength) * 100));
            setDownloadProgress(pct);
            const downloadedMB = (downloaded / (1024 * 1024)).toFixed(1);
            const totalMB = (contentLength / (1024 * 1024)).toFixed(1);
            setDownloadStatus(`Downloading: ${downloadedMB} MB / ${totalMB} MB (${pct}%)`);
          } else {
            const downloadedMB = (downloaded / (1024 * 1024)).toFixed(1);
            setDownloadStatus(`Downloaded ${downloadedMB} MB...`);
          }
        } else if (event.event === 'Finished') {
          setDownloadProgress(100);
          setDownloadStatus('Update verified! Restarting Rivo...');
        }
      });

      // Relaunch the app into the new version
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch (err) {
      console.error('[DesktopUpdate] Failed to install:', err);
      setError(err?.message || 'Failed to download update. Please try again later.');
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[600] bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      <div className="bg-[#fdfbf7] brutal-border-thick brutal-shadow-lg max-w-md w-full p-6 text-center relative overflow-hidden">
        
        {/* Close Button */}
        {!isDownloading && (
          <button 
            onClick={() => setIsOpen(false)}
            className="brutal-btn absolute top-3.5 right-3.5 text-[#0b1110] p-1 bg-[#ede5d3] brutal-border hover:bg-[#ded2bb] cursor-pointer"
            title="Remind me later"
          >
            <X size={16} />
          </button>
        )}

        {/* Icon */}
        <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center brutal-border bg-[#082621] text-[#26c4b7]">
          {isDownloading ? (
            <RefreshCw size={22} className="animate-spin text-[#26c4b7]" />
          ) : (
            <Sparkles size={22} className="text-[#26c4b7]" />
          )}
        </div>

        {/* Header */}
        <h3 className="text-base font-mono font-black uppercase text-[#082621] mb-1 tracking-tight">
          New Update Available
        </h3>
        <p className="text-xs font-mono font-bold text-[#17a398] mb-3">
          Rivo v{updateHandle.version}
        </p>

        {/* Notes */}
        {updateHandle.body && (
          <div className="bg-[#ede5d3]/60 brutal-border p-3 mb-4 text-left max-h-32 overflow-y-auto">
            <span className="text-[10px] font-mono font-black text-[#082621]/60 uppercase tracking-wider block mb-1">
              Release Notes
            </span>
            <p className="text-xs text-[#082621] font-sans whitespace-pre-wrap leading-relaxed">
              {updateHandle.body}
            </p>
          </div>
        )}

        {/* Progress Bar (when downloading) */}
        {isDownloading ? (
          <div className="mb-2">
            <div className="w-full bg-[#ede5d3] brutal-border h-4 relative overflow-hidden mb-2">
              <div 
                className="bg-[#17a398] h-full transition-all duration-200"
                style={{ width: `${downloadProgress}%` }}
              />
            </div>
            <p className="text-[11px] font-mono text-[#082621]/80 font-bold">
              {downloadStatus}
            </p>
          </div>
        ) : (
          /* Error message if any */
          error && (
            <div className="bg-red-50 text-red-600 brutal-border p-2 mb-4 text-xs font-mono">
              {error}
            </div>
          )
        )}

        {/* Action Buttons */}
        {!isDownloading && (
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={handleUpdateNow}
              className="brutal-btn flex-1 py-2.5 bg-[#082621] hover:bg-[#0b1110] text-[#26c4b7] font-mono text-xs font-black uppercase brutal-border brutal-shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download size={14} />
              Update Now
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="brutal-btn flex-1 py-2.5 bg-[#ede5d3] hover:bg-[#ded2bb] text-[#082621] font-mono font-black text-xs uppercase brutal-border brutal-shadow-sm cursor-pointer"
            >
              Later
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
