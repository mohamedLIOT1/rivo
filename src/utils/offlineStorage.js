import { API_BASE_URL } from '../config';
import { parseLrcLyrics, formatLrcLyrics } from './lrcParser';

export const isTauriDesktop = typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);

let tauriCorePromise = null;
export async function getTauriCore() {
  if (!isTauriDesktop) return null;
  if (!tauriCorePromise) {
    tauriCorePromise = import('@tauri-apps/api/core').catch(() => null);
  }
  return tauriCorePromise;
}

export async function openDesktopDownloadsDir() {
  const tauri = await getTauriCore();
  if (!tauri) return null;
  try {
    return await tauri.invoke('open_desktop_downloads_dir');
  } catch (e) {
    console.warn('Failed to open downloads dir:', e);
    return null;
  }
}

export async function getDesktopDownloadsDir() {
  const tauri = await getTauriCore();
  if (!tauri) return null;
  try {
    return await tauri.invoke('get_desktop_downloads_dir');
  } catch {
    return null;
  }
}

// IndexedDB Offline Audio & Cover Storage Manager for Rivo (Pure Web & PWA)
const DB_NAME = 'RivoOfflineDB';
const DB_VERSION = 2;
const STORE_NAME = 'downloaded_tracks';
const LEGACY_DB_NAMES = ['LiofyOfflineDB', 'liofy_offline_db', 'rivo_offline_db'];

// Track active Blob URLs in memory and revoke when no longer needed to prevent RAM memory leaks
const activeBlobUrls = new Map();

export function revokeAllBlobUrls() {
  activeBlobUrls.forEach((url) => {
    try { URL.revokeObjectURL(url); } catch (e) {}
  });
  activeBlobUrls.clear();
}

// Request persistent storage so browsers don't auto-evict IndexedDB
if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

// Migrate data from a legacy IndexedDB to the current RivoOfflineDB
async function migrateLegacyDB(legacyDbName) {
  try {
    const legacyReq = indexedDB.open(legacyDbName, 1);
    const legacyDb = await new Promise((resolve, reject) => {
      legacyReq.onsuccess = (e) => resolve(e.target.result);
      legacyReq.onerror = () => resolve(null);
      legacyReq.onblocked = () => resolve(null);
    });
    if (!legacyDb) return;
    if (!legacyDb.objectStoreNames.contains(STORE_NAME)) {
      legacyDb.close();
      return;
    }
    const items = await new Promise((resolve) => {
      const tx = legacyDb.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
    legacyDb.close();
    if (!items.length) return;
    const db = await openDB();
    const putTx = db.transaction(STORE_NAME, 'readwrite');
    const store = putTx.objectStore(STORE_NAME);
    for (const item of items) {
      try { store.put(item); } catch {}
    }
    await new Promise((resolve, reject) => {
      putTx.oncomplete = resolve;
      putTx.onerror = resolve; // non-fatal
    });
    // Delete the legacy DB after migration
    try { indexedDB.deleteDatabase(legacyDbName); } catch {}
  } catch {}
}

// Run legacy migrations once on startup
(async () => {
  try {
    for (const name of LEGACY_DB_NAMES) {
      await migrateLegacyDB(name).catch(() => {});
    }
  } catch {}
})();

// Convert Base64 Data URI directly to Blob in pure JS
function dataURItoBlob(dataURI) {
  try {
    if (!dataURI || typeof dataURI !== 'string' || !dataURI.startsWith('data:')) return null;
    const parts = dataURI.split(',');
    if (parts.length < 2) return null;
    const header = parts[0];
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'audio/mpeg';
    const isBase64 = header.includes('base64');
    
    let byteString;
    if (isBase64) {
      byteString = atob(parts[1]);
    } else {
      byteString = decodeURIComponent(parts[1]);
    }
    
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mime });
  } catch (e) {
    console.error('dataURItoBlob error:', e);
    return null;
  }
}

function blobToDataURI(blob) {
  return new Promise((resolve) => {
    if (!blob) { resolve(null); return; }
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}

// Extract YouTube video ID from URL or track ID reliably
function extractYtId(input) {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();
  
  const urlMatch = str.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
  if (urlMatch && urlMatch[1] && urlMatch[1].length === 11) {
    return urlMatch[1];
  }
  
  const prefixMatch = str.match(/^yt[-_]?([a-zA-Z0-9_-]{11})$/i);
  if (prefixMatch && prefixMatch[1] && prefixMatch[1].length === 11) {
    return prefixMatch[1];
  }

  if (/^[a-zA-Z0-9_-]{11}$/.test(str)) {
    return str;
  }
  
  return null;
}

// Client-side YouTube Audio Stream Resolver via public mirrors
async function resolveYouTubeAudioClientSide(videoId) {
  if (!videoId) return null;

  const cobaltEndpoints = [
    'https://api.cobalt.tools/api/json',
    'https://cobalt.stream/api/json',
    'https://co.wuk.sh/api/json'
  ];
  for (const ep of cobaltEndpoints) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          downloadMode: 'audio',
          audioFormat: 'mp3',
          audioBitrate: '128',
          isAudioOnly: true
        })
      });
      if (res.ok) {
        const data = await res.json();
        const streamUrl = data.url || data.audio || (data.picker && data.picker[0]?.url);
        if (streamUrl) return streamUrl;
      }
    } catch {}
  }

  const invidiousInstances = [
    'https://inv.nadeko.net',
    'https://yewtu.be',
    'https://yt.artemislena.eu',
    'https://invidious.nerdvpn.de',
    'https://inv.us.projectsegfau.lt'
  ];
  for (const base of invidiousInstances) {
    try {
      const res = await fetch(`${base}/api/v1/videos/${videoId}?fields=adaptiveFormats`);
      if (res.ok) {
        const data = await res.json();
        const formats = data.adaptiveFormats || [];
        const audio = formats.find(f => f.type?.includes('audio/mp4')) || formats.find(f => f.type?.includes('audio'));
        if (audio?.url) return audio.url;
      }
    } catch {}
  }

  return null;
}

// Save downloaded audio blob & track info locally in browser storage (IndexedDB)
export async function saveTrackOffline(track, options = {}) {
  if (!track || (!track.id && !track._id)) return null;
  const trackId = String(track.id || track._id);
  const signal = options?.signal;

  if (signal?.aborted) return null;

  const cleanTitle = (track.title || 'Track')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/www\.\S+/gi, '')
    .replace(/youtube\.com\S*/gi, '')
    .replace(/youtu\.be\S*/gi, '')
    .replace(/liofy\S*/gi, '')
    .replace(/[\[\(]?(?:official|lyrics|video|audio|hd|4k|remastered)[\]\)]?/gi, '')
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Track';

  const cleanArtist = (track.artist || 'Artist')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/www\.\S+/gi, '')
    .replace(/youtube\.com\S*/gi, '')
    .replace(/youtu\.be\S*/gi, '')
    .replace(/liofy\S*/gi, '')
    .replace(/[/\\?%*:|"<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim() || 'Artist';

  const cleanAlbum = (!track.album || /https?:\/\/|www\.|youtube|liofy/i.test(track.album))
    ? (cleanTitle || 'Single')
    : track.album;

  // ── Native Bridge (iOS & Android): route download to device storage via postMessage ──
  if (typeof window !== 'undefined' && window.RIVO_NATIVE && window.RIVO_DOWNLOAD) {
    try {
      window.RIVO_DOWNLOAD({
        id: trackId,
        _id: trackId,
        title: cleanTitle,
        artist: cleanArtist,
        audioUrl: track.audioUrl || '',
        coverUrl: track.cover || track.coverUrl || '',
        cover: track.cover || track.coverUrl || '',
        source: 'Rivo',
        album: cleanAlbum,
        duration: track.duration || 0,
      });

      return await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          window.removeEventListener('rivo-track-download-completed', handler);
          resolve({ ...track, id: trackId, downloaded: true, savedAt: Date.now() });
        }, 180000);

        function handler(e) {
          if (e && e.detail && String(e.detail.id) === trackId) {
            clearTimeout(timeout);
            window.removeEventListener('rivo-track-download-completed', handler);
            if (e.detail.success) {
              const dlRecord = {
                ...track,
                id: trackId,
                _id: trackId,
                title: cleanTitle,
                artist: cleanArtist,
                album: cleanAlbum,
                downloaded: true,
                savedAt: Date.now(),
              };
              openDB().then(dbInst => {
                const putTx = dbInst.transaction(STORE_NAME, 'readwrite');
                putTx.objectStore(STORE_NAME).put(dlRecord);
              }).catch(() => {});
              resolve(dlRecord);
            } else {
              resolve(null);
            }
          }
        }

        window.addEventListener('rivo-track-download-completed', handler);
      });
    } catch (e) {
      console.error('Native bridge download error:', e);
    }
  }

  try {
    let targetUrl = track.audioUrl || '';
    let audioBlob = null;

    if (signal?.aborted) return null;

    // 1. Data URI
    if (targetUrl.startsWith('data:')) {
      audioBlob = dataURItoBlob(targetUrl);
    } else if (targetUrl.startsWith('blob:')) {
      try {
        const res = await fetch(targetUrl, { signal });
        if (res.ok) {
          const b = await res.blob();
          if (b && b.size > 20000) audioBlob = b;
        }
      } catch (e) {
        if (signal?.aborted) return null;
      }
    }

    // 2. Direct audio / MP3 URLs
    if (!audioBlob && targetUrl && !targetUrl.includes('youtube.com') && !targetUrl.includes('youtu.be')) {
      try {
        if (signal?.aborted) return null;
        let directRes = await fetch(targetUrl, { signal }).catch(() => null);
        if (!directRes || !directRes.ok) {
          if (signal?.aborted) return null;
          directRes = await fetch(`${API_BASE_URL}/api/proxy-audio?url=${encodeURIComponent(targetUrl)}`, { signal }).catch(() => null);
        }
        if (directRes && directRes.ok) {
          const ct = directRes.headers.get('content-type') || '';
          if (!ct.includes('html') && !ct.includes('json')) {
            const b = await directRes.blob();
            if (b && b.size > 20000) audioBlob = b;
          }
        }
      } catch (e) {
        if (signal?.aborted) return null;
      }
    }

    // 3. YouTube tracks
    const ytId = extractYtId(targetUrl) || (track.source === 'YouTube' ? extractYtId(track.id || track._id) : null);
    if (!audioBlob && ytId) {
      try {
        if (signal?.aborted) return null;
        const directStreamUrl = await resolveYouTubeAudioClientSide(ytId);
        if (directStreamUrl) {
          if (signal?.aborted) return null;
          const streamRes = await fetch(directStreamUrl, { signal }).catch(() => null);
          if (streamRes && streamRes.ok) {
            const ct = streamRes.headers.get('content-type') || '';
            if (!ct.includes('html') && !ct.includes('json')) {
              const b = await streamRes.blob();
              if (b && b.size > 20000) audioBlob = b;
            }
          }
        }
      } catch (e) {
        if (signal?.aborted) return null;
      }
    }

    // 4. Server-Side Audio Resolver Fallback
    if (!audioBlob) {
      try {
        if (signal?.aborted) return null;
        const serverDownloadUrl = `${API_BASE_URL}/api/tracks/download?url=${encodeURIComponent(targetUrl)}&title=${encodeURIComponent(track.title || '')}&artist=${encodeURIComponent(track.artist || '')}&id=${encodeURIComponent(trackId)}`;
        const serverRes = await fetch(serverDownloadUrl, { signal }).catch(() => null);
        if (serverRes && serverRes.ok) {
          const ct = serverRes.headers.get('content-type') || '';
          if (!ct.includes('html') && !ct.includes('json')) {
            const b = await serverRes.blob();
            if (b && b.size > 20000) audioBlob = b;
          }
        }
      } catch (e) {
        if (signal?.aborted) return null;
      }
    }

    // Cover image blob handling
    let coverBlob = null;
    if (track.cover) {
      if (track.cover.startsWith('data:')) {
        coverBlob = dataURItoBlob(track.cover);
      } else if (track.cover.startsWith('http')) {
        try {
          let coverRes = await fetch(track.cover).catch(() => null);
          if (!coverRes || !coverRes.ok) {
            coverRes = await fetch(`${API_BASE_URL}/api/proxy-image?url=${encodeURIComponent(track.cover)}`).catch(() => null);
          }
          if (coverRes && coverRes.ok) {
            const cb = await coverRes.blob();
            if (cb && !cb.type.includes('html')) coverBlob = cb;
          }
        } catch {}
      }
    }

    let coverBase64 = null;
    if (coverBlob) {
      coverBase64 = await blobToDataURI(coverBlob);
    }

    // ── Verified Lyrics & Desktop App Folder Storage ──
    let parsedLyrics = [];
    let isVerifiedLyrics = Boolean(
      track.isVerified || 
      track.lyricsVerified || 
      track.isVerifiedLyrics || 
      track.isLyricsVerified
    );
    let lyricsVerifiedBy = track.verifiedBy || track.lyricsVerifiedBy || null;

    if (track.lyrics) {
      parsedLyrics = parseLrcLyrics(track.lyrics);
    }

    if (!parsedLyrics.length || !isVerifiedLyrics) {
      try {
        const lyricsRes = await fetch(`${API_BASE_URL}/api/tracks/lyrics?trackId=${encodeURIComponent(trackId)}&title=${encodeURIComponent(cleanTitle)}&artist=${encodeURIComponent(cleanArtist)}`, { signal }).catch(() => null);
        if (lyricsRes && lyricsRes.ok) {
          const lData = await lyricsRes.json();
          if (lData.success && Array.isArray(lData.lyrics) && lData.lyrics.length > 0) {
            parsedLyrics = parseLrcLyrics(lData.lyrics);
            isVerifiedLyrics = Boolean(lData.isVerified);
            lyricsVerifiedBy = lData.verifiedBy || null;
          }
        }
      } catch {}
    }

    let desktopRecord = null;
    let assetAudioUrl = null;
    let audioBase64 = null;
    if (audioBlob) {
      audioBase64 = await blobToDataURI(audioBlob);
    }

    if (isTauriDesktop && audioBase64) {
      try {
        const tauri = await getTauriCore();
        if (tauri) {
          const lyricsLrc = formatLrcLyrics(parsedLyrics);
          const lyricsText = parsedLyrics.map(l => l.text).join('\n');
          desktopRecord = await tauri.invoke('save_desktop_downloaded_track', {
            payload: {
              id: trackId,
              title: cleanTitle,
              artist: cleanArtist,
              album: cleanAlbum,
              duration: track.duration || 0,
              audio_base64: audioBase64,
              cover_base64: coverBase64,
              lyrics_text: lyricsText || null,
              lyrics_lrc: lyricsLrc || null,
              is_verified_lyrics: Boolean(isVerifiedLyrics),
              verified_by: lyricsVerifiedBy || null,
            }
          });
          if (desktopRecord?.file_path && tauri.convertFileSrc) {
            assetAudioUrl = tauri.convertFileSrc(desktopRecord.file_path);
          }
        }
      } catch (err) {
        console.error('Failed to save track in desktop app folder:', err);
      }
    }

    const db = await openDB();
    const offlineTrack = {
      ...track,
      id: trackId,
      _id: trackId,
      title: cleanTitle,
      artist: cleanArtist,
      album: cleanAlbum,
      source: 'Rivo',
      publisher: 'Rivo',
      signature: 'Rivo',
      downloaded: true,
      localFilePath: desktopRecord?.file_path || track.localFilePath || null,
      lrcPath: desktopRecord?.lrc_path || track.lrcPath || null,
      coverPath: desktopRecord?.cover_path || track.coverPath || null,
      isVerified: Boolean(isVerifiedLyrics),
      lyricsVerified: Boolean(isVerifiedLyrics),
      isVerifiedLyrics: Boolean(isVerifiedLyrics),
      verifiedBy: lyricsVerifiedBy || null,
      lyrics: parsedLyrics.length > 0 ? parsedLyrics : track.lyrics,
      audioBlob: audioBlob || null,
      coverBlob: coverBlob || null,
      coverBase64: coverBase64 || null,
      cover: coverBase64 || track.cover,
      audioUrl: assetAudioUrl || (audioBlob ? URL.createObjectURL(audioBlob) : targetUrl),
      savedAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const allReq = store.getAll();
      allReq.onsuccess = () => {
        const items = allReq.result || [];
        const normTitle = cleanTitle.toLowerCase();
        const normArtist = cleanArtist.toLowerCase();
        items.forEach(it => {
          if (String(it.id) !== trackId) {
            const itTitle = String(it.title || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').trim();
            const itArtist = String(it.artist || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').trim();
            if (itTitle === normTitle && (!normArtist || !itArtist || itArtist === normArtist)) {
              try { store.delete(it.id); } catch {}
            }
          }
        });
        store.put(offlineTrack);
      };
      tx.oncomplete = () => resolve(offlineTrack);
      tx.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error('Offline save error:', err);
    return null;
  }
}

export async function getOfflineTrackAudioUrl(trackId, title = null, artist = null) {
  if (!trackId && !title) return null;
  const idStr = trackId ? String(trackId) : null;
  const normTitle = (title || '').toLowerCase().trim().replace(/[/\\?%*:|"<>]/g, '');
  const normArtist = (artist || '').toLowerCase().trim();

  // 1. FAST NATIVE FIRST CHECK (Prioritize local storage over website stream in Online Mode)
  if (typeof window !== 'undefined') {
    const downloadedTracks = Array.isArray(window.__RIVO_DOWNLOADED_TRACKS) ? window.__RIVO_DOWNLOADED_TRACKS : [];
    if (downloadedTracks.length > 0) {
      const foundNative = downloadedTracks.find(nt => {
        const ntId = String(nt.id || nt._id || '');
        if (idStr && (ntId === idStr || ntId.includes(idStr) || idStr.includes(ntId))) return true;
        const ntTitle = (nt.title || '').toLowerCase().trim().replace(/[/\\?%*:|"<>]/g, '');
        const ntArtist = (nt.artist || '').toLowerCase().trim();
        return normTitle && ntTitle && normTitle === ntTitle && (!normArtist || !ntArtist || normArtist === ntArtist);
      });
      const localUri = foundNative?.localAudioUri || foundNative?.nativeAudioUri || foundNative?.audioUrl;
      if (localUri && (localUri.startsWith('file://') || localUri.startsWith('content://') || localUri.startsWith('blob:') || localUri.startsWith('data:'))) {
        return localUri;
      }
    }
  }

  // 1b. FAST TAURI DESKTOP LOCAL FILE CHECK
  if (isTauriDesktop) {
    try {
      const db = await openDB();
      const localItem = await new Promise((res) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        if (idStr) {
          const req = store.get(idStr);
          req.onsuccess = () => res(req.result || null);
          req.onerror = () => res(null);
        } else {
          res(null);
        }
      });
      if (localItem?.localFilePath) {
        const tauri = await getTauriCore();
        if (tauri?.convertFileSrc) {
          return tauri.convertFileSrc(localItem.localFilePath);
        }
      }
    } catch {}
  }

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      const handleFound = (item) => {
        if (item && item.audioBlob && item.audioBlob.size > 10000) {
          const key = String(item.id || item._id || idStr || 'found');
          if (activeBlobUrls.has(key)) {
            try { URL.revokeObjectURL(activeBlobUrls.get(key)); } catch (e) {}
          }
          const blobUrl = URL.createObjectURL(item.audioBlob);
          activeBlobUrls.set(key, blobUrl);
          resolve(blobUrl);
          return true;
        }
        return false;
      };

      if (idStr) {
        const req = store.get(idStr);
        req.onsuccess = () => {
          if (handleFound(req.result)) return;
          searchByTitleArtist();
        };
        req.onerror = () => searchByTitleArtist();
      } else {
        searchByTitleArtist();
      }

      function searchByTitleArtist() {
        const allReq = store.getAll();
        allReq.onsuccess = () => {
          const all = allReq.result || [];
          const normTitle = (title || '').toLowerCase().trim().replace(/[/\\?%*:|"<>]/g, '');
          const normArtist = (artist || '').toLowerCase().trim();

          const found = all.find(item => {
            if (!item.audioBlob || item.audioBlob.size < 10000) return false;
            const itemId = String(item.id || item._id || '');
            if (idStr && (itemId === idStr || itemId.includes(idStr) || idStr.includes(itemId))) {
              return true;
            }
            if (normTitle && item.title) {
              const itemTitle = item.title.toLowerCase().trim().replace(/[/\\?%*:|"<>]/g, '');
              if (itemTitle === normTitle) {
                if (!normArtist || !item.artist) return true;
                const itemArtist = item.artist.toLowerCase().trim();
                return itemArtist === normArtist || itemArtist.includes(normArtist) || normArtist.includes(itemArtist);
              }
            }
            return false;
          });

          if (found && handleFound(found)) {
            return;
          }

          const isIOS = typeof navigator !== 'undefined' && (
            /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
            (/Macintosh/i.test(navigator.userAgent) && typeof window !== 'undefined' && window.ReactNativeWebView)
          );
          if (isIOS) {
            // On iOS WKWebView, resolve null immediately to avoid freezing track transitions
            resolve(null);
            return;
          }

          let matchedNativeId = idStr;
          if (typeof window !== 'undefined' && window.ReactNativeWebView) {
            const downloadedIds = Array.isArray(window.__RIVO_NATIVE_DOWNLOADED_IDS) ? window.__RIVO_NATIVE_DOWNLOADED_IDS : [];
            const downloadedTracks = Array.isArray(window.__RIVO_DOWNLOADED_TRACKS) ? window.__RIVO_DOWNLOADED_TRACKS : [];

            if (!matchedNativeId || !downloadedIds.includes(matchedNativeId)) {
              const matchByTitle = downloadedTracks.find(nt => {
                const ntTitle = (nt.title || '').toLowerCase().trim().replace(/[/\\?%*:|"<>]/g, '');
                const ntArtist = (nt.artist || '').toLowerCase().trim();
                return normTitle && ntTitle && normTitle === ntTitle && (!normArtist || !ntArtist || normArtist === ntArtist);
              });
              if (matchByTitle) {
                matchedNativeId = String(matchByTitle.id || matchByTitle._id);
              }
            }

            const foundNative = downloadedTracks.find(nt => {
              if (matchedNativeId && String(nt.id || nt._id) === matchedNativeId) return true;
              const ntTitle = (nt.title || '').toLowerCase().trim().replace(/[/\\?%*:|"<>]/g, '');
              const ntArtist = (nt.artist || '').toLowerCase().trim();
              return normTitle && ntTitle && normTitle === ntTitle && (!normArtist || !ntArtist || normArtist === ntArtist);
            });
            if (foundNative?.localAudioUri && foundNative.localAudioUri.startsWith('file://')) {
              resolve(foundNative.localAudioUri);
              return;
            }

            if (matchedNativeId && (downloadedIds.includes(matchedNativeId) || foundNative)) {
              const timeout = setTimeout(() => {
                window.removeEventListener('rivo-receive-offline-audio', onReceive);
                resolve(null);
              }, 1500);

              function onReceive(e) {
                if (e && e.detail && String(e.detail.id) === matchedNativeId && e.detail.dataUri) {
                  clearTimeout(timeout);
                  window.removeEventListener('rivo-receive-offline-audio', onReceive);
                  try {
                    const blob = dataURItoBlob(e.detail.dataUri);
                    if (blob && blob.size > 10000) {
                      openDB().then(dbInst => {
                        const putTx = dbInst.transaction(STORE_NAME, 'readwrite');
                        putTx.objectStore(STORE_NAME).put({
                          id: matchedNativeId,
                          _id: matchedNativeId,
                          title: title || 'Track',
                          artist: artist || 'Artist',
                          source: 'Rivo',
                          publisher: 'Rivo',
                          signature: 'Rivo',
                          audioBlob: blob,
                          downloaded: true,
                          savedAt: Date.now()
                        });
                      }).catch(() => {});
                      const blobUrl = URL.createObjectURL(blob);
                      activeBlobUrls.set(matchedNativeId, blobUrl);
                      resolve(blobUrl);
                      return;
                    }
                  } catch (err) {}
                  resolve(null);
                }
              }

              window.__RIVO_RECEIVE_OFFLINE_AUDIO = (recvId, dataUri) => {
                onReceive({ detail: { id: recvId, dataUri } });
              };
              window.addEventListener('rivo-receive-offline-audio', onReceive);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'REQUEST_OFFLINE_AUDIO',
                id: matchedNativeId
              }));
              return;
            }
          }

          resolve(null);
        };
        allReq.onerror = () => resolve(null);
      }
    });
  } catch (err) {
    return null;
  }
}

// Helper to check if track is saved offline in IndexedDB or Native Storage
export async function isTrackSavedOffline(trackId, title = null, artist = null) {
  if (!trackId && !title) return false;
  const idStr = trackId ? String(trackId) : '';

  if (typeof window !== 'undefined' && Array.isArray(window.__RIVO_NATIVE_DOWNLOADED_IDS)) {
    if (idStr && window.__RIVO_NATIVE_DOWNLOADED_IDS.includes(idStr)) {
      return true;
    }
  }

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      if (idStr) {
        const req = store.get(idStr);
        req.onsuccess = () => {
          if (req.result) {
            resolve(true);
            return;
          }
          searchFallback();
        };
        req.onerror = () => searchFallback();
      } else {
        searchFallback();
      }

      function searchFallback() {
        if (!title) { resolve(false); return; }
        const allReq = store.getAll();
        allReq.onsuccess = () => {
          const all = allReq.result || [];
          const normTitle = (title || '').toLowerCase().trim().replace(/[/\\?%*:|"<>]/g, '');
          const normArtist = (artist || '').toLowerCase().trim();
          const exists = all.some(item => {
            if (!item.title) return false;
            const itemTitle = item.title.toLowerCase().trim().replace(/[/\\?%*:|"<>]/g, '');
            if (itemTitle === normTitle) {
              if (!normArtist || !item.artist) return true;
              return item.artist.toLowerCase().trim() === normArtist;
            }
            return false;
          });
          resolve(exists);
        };
        allReq.onerror = () => resolve(false);
      }
    });
  } catch {
    return false;
  }
}

export function deduplicateOfflineTracks(list) {
  if (!Array.isArray(list)) return [];
  const map = new Map();
  for (const t of list) {
    if (!t) continue;
    const idKey = String(t._id || t.id || '');
    const cleanTitle = String(t.title || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, ' ').trim();
    const cleanArtist = String(t.artist || '').toLowerCase().replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, ' ').trim();
    const titleKey = (cleanTitle && cleanArtist) ? `${cleanTitle}___${cleanArtist}` : null;
    const existingKey = map.has(idKey) ? idKey : (titleKey && map.has(titleKey) ? titleKey : null);
    if (!existingKey) {
      if (idKey) map.set(idKey, t);
      if (titleKey) map.set(titleKey, t);
    } else {
      const existing = map.get(existingKey);
      const merged = { ...existing, ...t, downloaded: true };
      if (idKey) map.set(idKey, merged);
      if (titleKey) map.set(titleKey, merged);
    }
  }
  return Array.from(new Set(map.values())).filter(Boolean);
}

// Get all downloaded tracks with fresh Blob URLs
export async function getOfflineTracks() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        const nonSoundCloud = items.filter(item => 
          item &&
          item.source !== 'SoundCloud' &&
          item.album !== 'SoundCloud' &&
          !String(item.audioUrl || '').includes('soundcloud.com') &&
          !String(item.audioUrl || '').includes('sndcdn.com') &&
          !String(item.id || '').startsWith('sc-')
        );

        // Clean up any soundcloud items in background
        if (nonSoundCloud.length !== items.length) {
          const removed = items.filter(item => !nonSoundCloud.includes(item));
          removed.forEach(r => {
            if (r.id) removeTrackOffline(r.id).catch(() => {});
          });
        }

        const formatted = nonSoundCloud.map(item => {
          let audioUrl = item.audioUrl;
          let cover = item.coverBase64 || item.cover;
          const idStr = String(item.id);

          if (item.audioBlob) {
            if (activeBlobUrls.has(idStr)) {
              try { URL.revokeObjectURL(activeBlobUrls.get(idStr)); } catch (e) {}
            }
            audioUrl = URL.createObjectURL(item.audioBlob);
            activeBlobUrls.set(idStr, audioUrl);
          }

          if (item.coverBase64) {
            cover = item.coverBase64;
          } else if (item.coverBlob) {
            try { cover = URL.createObjectURL(item.coverBlob); } catch (e) {}
          }

          return { ...item, audioUrl, cover, downloaded: true };
        });

        // Merge Desktop App Folder Downloads
        (async () => {
          let merged = [...formatted];
          if (isTauriDesktop) {
            try {
              const tauri = await getTauriCore();
              if (tauri) {
                const dtList = await tauri.invoke('list_desktop_downloaded_tracks');
                if (Array.isArray(dtList)) {
                  for (const dt of dtList) {
                    const normDtTitle = (dt.title || '').toLowerCase().trim();
                    const normDtArtist = (dt.artist || '').toLowerCase().trim();
                    const existingIdx = merged.findIndex(f => 
                      String(f.id) === String(dt.id) || 
                      (f.title && f.title.toLowerCase().trim() === normDtTitle && (!normDtArtist || f.artist?.toLowerCase().trim() === normDtArtist))
                    );
                    const audioUrl = tauri.convertFileSrc ? tauri.convertFileSrc(dt.file_path) : '';
                    const cover = (dt.cover_path && tauri.convertFileSrc) ? tauri.convertFileSrc(dt.cover_path) : null;
                    const mapped = {
                      id: dt.id,
                      _id: dt.id,
                      title: dt.title,
                      artist: dt.artist,
                      album: dt.album,
                      duration: dt.duration,
                      localFilePath: dt.file_path,
                      lrcPath: dt.lrc_path,
                      coverPath: dt.cover_path,
                      audioUrl: audioUrl || (existingIdx >= 0 ? merged[existingIdx].audioUrl : ''),
                      cover: cover || (existingIdx >= 0 ? merged[existingIdx].cover : null),
                      isVerified: dt.is_verified_lyrics,
                      lyricsVerified: dt.is_verified_lyrics,
                      isVerifiedLyrics: dt.is_verified_lyrics,
                      verifiedBy: dt.verified_by,
                      hasLyrics: dt.has_lyrics,
                      downloaded: true,
                      savedAt: dt.saved_at ? dt.saved_at * 1000 : Date.now(),
                    };
                    if (existingIdx >= 0) {
                      merged[existingIdx] = { ...merged[existingIdx], ...mapped };
                    } else {
                      merged.push(mapped);
                    }
                  }
                }
              }
            } catch (e) {
              console.warn('Desktop offline tracks scan error:', e);
            }
          }
          resolve(deduplicateOfflineTracks(merged));
        })();
      };
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    return [];
  }
}

// Get all offline downloaded track IDs
export async function getOfflineTrackIds() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const keys = (req.result || []).map(k => String(k));
        resolve(new Set(keys));
      };
      req.onerror = () => resolve(new Set());
    });
  } catch (err) {
    return new Set();
  }
}

// Remove track from offline storage
export async function removeTrackOffline(trackId) {
  if (!trackId) return false;
  const idStr = String(trackId);

  if (isTauriDesktop) {
    try {
      getTauriCore().then(tauri => {
        if (tauri) tauri.invoke('delete_desktop_downloaded_track', { id: idStr });
      }).catch(() => {});
    } catch {}
  }

  if (activeBlobUrls.has(idStr)) {
    try { URL.revokeObjectURL(activeBlobUrls.get(idStr)); } catch (e) {}
    activeBlobUrls.delete(idStr);
  }

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(idStr);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch (err) {
    return false;
  }
}
