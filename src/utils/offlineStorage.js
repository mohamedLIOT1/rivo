import { API_BASE_URL } from '../config';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

// IndexedDB Offline Audio & Cover Storage Manager for Rivo
const DB_NAME = 'RivoOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'downloaded_tracks';

// Track active Blob URLs in memory and revoke when no longer needed to prevent RAM memory leaks
const activeBlobUrls = new Map();

export function revokeAllBlobUrls() {
  activeBlobUrls.forEach((url) => {
    try { URL.revokeObjectURL(url); } catch (e) {}
  });
  activeBlobUrls.clear();
}

// Request persistent storage so Android WebView doesn't auto-evict IndexedDB
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

// Ensure dedicated "Rivo" folder exists on device filesystem
async function ensureRivoDir() {
  try {
    if (Capacitor.isNativePlatform() || window.Capacitor) {
      await Filesystem.mkdir({
        path: 'Rivo',
        directory: Directory.Data,
        recursive: true,
      });
    }
  } catch (e) {}
}
const ensureLiofyDir = ensureRivoDir;

// Convert Blob to Base64 (with UI thread yielding to prevent app lag/stutter)
function blobToBase64(blob) {
  return new Promise((resolve) => {
    if (!blob) { resolve(''); return; }
    const reader = new FileReader();
    reader.onloadend = () => {
      // Yield to main UI thread so animation/audio stays smooth
      setTimeout(() => {
        const res = reader.result || '';
        const base64 = typeof res === 'string' ? (res.split(',')[1] || res) : '';
        resolve(base64);
      }, 0);
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(blob);
  });
}

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
  
  // 1. YouTube URL with v= parameter, shorts, embed, or youtu.be
  const urlMatch = str.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
  if (urlMatch && urlMatch[1] && urlMatch[1].length === 11) {
    return urlMatch[1];
  }
  
  // 2. String starting with yt- or yt_
  const prefixMatch = str.match(/^yt[-_]?([a-zA-Z0-9_-]{11})$/i);
  if (prefixMatch && prefixMatch[1] && prefixMatch[1].length === 11) {
    return prefixMatch[1];
  }

  // 3. Only match 11 chars if explicit YouTube URL or youtube domain string
  if ((str.includes('youtube.com') || str.includes('youtu.be')) && /^[a-zA-Z0-9_-]{11}$/.test(str)) {
    return str;
  }
  
  return null;
}

// Client-side YouTube Audio Stream Resolver via public Cobalt, Piped & Invidious mirrors
async function resolveYouTubeAudioClientSide(videoId) {
  if (!videoId) return null;

  // 1. Cobalt APIs (Modern high-speed downloaders)
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

  // 2. Invidious API v1 (Reliable fallback for 2026)
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

  // 3. Piped API instances
  const pipedInstances = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.privacydev.net',
    'https://pipedapi.adminforge.de'
  ];
  for (const base of pipedInstances) {
    try {
      const res = await fetch(`${base}/streams/${videoId}`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data && data.audioStreams && data.audioStreams.length > 0) {
        const stream = data.audioStreams.find(s => s.mimeType && s.mimeType.includes('audio/mp4')) || data.audioStreams[0];
        if (stream && stream.url) return stream.url;
      }
    } catch {}
  }

  return null;
}

// Save downloaded audio blob & track info locally in app private storage (IndexedDB + Native Filesystem Rivo folder)
export async function saveTrackOffline(track) {
  if (!track || (!track.id && !track._id)) return null;
  const trackId = String(track.id || track._id);

  try {
    let targetUrl = track.audioUrl || '';
    let audioBlob = null;

    // 1. Data URI (Uploaded tracks with Base64 audio)
    if (targetUrl.startsWith('data:')) {
      audioBlob = dataURItoBlob(targetUrl);
    } else if (targetUrl.startsWith('blob:')) {
      try {
        const res = await fetch(targetUrl);
        if (res.ok) {
          const b = await res.blob();
          if (b && b.size > 20000) audioBlob = b;
        }
      } catch (e) {}
    }

    // 2. Direct audio / MP3 URLs
    if (!audioBlob && targetUrl && !targetUrl.includes('youtube.com') && !targetUrl.includes('youtu.be')) {
      try {
        let directRes = await fetch(targetUrl).catch(() => null);
        if (!directRes || !directRes.ok) {
          directRes = await fetch(`${API_BASE_URL}/api/proxy-audio?url=${encodeURIComponent(targetUrl)}`).catch(() => null);
        }
        if (directRes && directRes.ok) {
          const ct = directRes.headers.get('content-type') || '';
          if (!ct.includes('html') && !ct.includes('json')) {
            const b = await directRes.blob();
            if (b && b.size > 20000) audioBlob = b;
          }
        }
      } catch (e) {}
    }

    // 3. YouTube tracks: Stream resolution & download without any timeout limit
    const ytId = extractYtId(targetUrl) || (track.source === 'YouTube' ? extractYtId(track.id || track._id) : null);
    if (!audioBlob && ytId) {
      try {
        const directStreamUrl = await resolveYouTubeAudioClientSide(ytId);
        if (directStreamUrl) {
          const streamRes = await fetch(directStreamUrl).catch(() => null);
          if (streamRes && streamRes.ok) {
            const ct = streamRes.headers.get('content-type') || '';
            if (!ct.includes('html') && !ct.includes('json')) {
              const b = await streamRes.blob();
              if (b && b.size > 20000) audioBlob = b;
            }
          }
        }
      } catch (e) {}
    }

    // 4. Server-Side Audio Resolver Fallback
    if (!audioBlob) {
      try {
        const serverDownloadUrl = `${API_BASE_URL}/api/tracks/download?url=${encodeURIComponent(targetUrl)}&title=${encodeURIComponent(track.title || '')}&artist=${encodeURIComponent(track.artist || '')}&id=${encodeURIComponent(trackId)}`;
        const serverRes = await fetch(serverDownloadUrl).catch(() => null);
        if (serverRes && serverRes.ok) {
          const ct = serverRes.headers.get('content-type') || '';
          if (!ct.includes('html') && !ct.includes('json')) {
            const b = await serverRes.blob();
            if (b && b.size > 20000) audioBlob = b;
          }
        }
      } catch (e) {}
    }

    // Cover image blob handling (Direct + Proxy fallback)
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

    // Write audio to Native Device Filesystem if binary blob is available
    let nativeAudioUri = null;
    let nativeCoverUri = null;
    let fileAudioSrc = null;
    let fileCoverSrc = null;

    if (audioBlob && (Capacitor.isNativePlatform() || window.Capacitor)) {
      try {
        await ensureRivoDir();
        const audioB64 = await blobToBase64(audioBlob);
        if (audioB64) {
          await Filesystem.writeFile({
            path: `Rivo/${trackId}.mp3`,
            data: audioB64,
            directory: Directory.Data,
          });
          const uriRes = await Filesystem.getUri({
            path: `Rivo/${trackId}.mp3`,
            directory: Directory.Data,
          });
          nativeAudioUri = uriRes.uri;
          fileAudioSrc = Capacitor.convertFileSrc(uriRes.uri);
        }
      } catch (fileErr) {
        console.warn('Native filesystem write warning:', fileErr);
      }
    }

    const isNative = Capacitor.isNativePlatform() || !!window.Capacitor;

    const db = await openDB();
    const offlineTrack = {
      ...track,
      id: trackId,
      downloaded: true,
      audioBlob: audioBlob || null,
      coverBlob: coverBlob || null,
      coverBase64: coverBase64 || null,
      cover: fileCoverSrc || coverBase64 || track.cover,
      audioUrl: fileAudioSrc || (audioBlob ? URL.createObjectURL(audioBlob) : targetUrl),
      nativeAudioUri: nativeAudioUri,
      nativeCoverUri: nativeCoverUri,
      savedAt: Date.now()
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(offlineTrack);
      tx.oncomplete = () => resolve(offlineTrack);
      tx.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error('Offline save error:', err);
    return null;
  }
}

// Get offline saved track audio blob URL dynamically
export async function getOfflineTrackAudioUrl(trackId) {
  if (!trackId) return null;
  const idStr = String(trackId);

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(idStr);
      req.onsuccess = () => {
        const item = req.result;
        if (item) {
          if (item.nativeAudioUri && (Capacitor.isNativePlatform() || window.Capacitor)) {
            resolve(Capacitor.convertFileSrc(item.nativeAudioUri));
            return;
          }
          if (item.audioBlob) {
            if (activeBlobUrls.has(idStr)) {
              try { URL.revokeObjectURL(activeBlobUrls.get(idStr)); } catch (e) {}
            }
            const blobUrl = URL.createObjectURL(item.audioBlob);
            activeBlobUrls.set(idStr, blobUrl);
            resolve(blobUrl);
            return;
          }
        }
        resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

// Get all downloaded tracks with fresh native FileSrc / Blob URLs
export async function getOfflineTracks() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = req.result || [];
        const formatted = items.map(item => {
          let audioUrl = item.audioUrl;
          let cover = item.coverBase64 || item.cover;
          const idStr = String(item.id);

          if (item.nativeAudioUri && (Capacitor.isNativePlatform() || window.Capacitor)) {
            audioUrl = Capacitor.convertFileSrc(item.nativeAudioUri);
          } else if (item.audioBlob) {
            if (activeBlobUrls.has(idStr)) {
              try { URL.revokeObjectURL(activeBlobUrls.get(idStr)); } catch (e) {}
            }
            audioUrl = URL.createObjectURL(item.audioBlob);
            activeBlobUrls.set(idStr, audioUrl);
          }

          if (item.nativeCoverUri && (Capacitor.isNativePlatform() || window.Capacitor)) {
            cover = Capacitor.convertFileSrc(item.nativeCoverUri);
          } else if (item.coverBase64) {
            cover = item.coverBase64;
          } else if (item.coverBlob) {
            try { cover = URL.createObjectURL(item.coverBlob); } catch (e) {}
          }

          return { ...item, audioUrl, cover, downloaded: true };
        });
        resolve(formatted);
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

// Remove track from offline storage & native filesystem
export async function removeTrackOffline(trackId) {
  if (!trackId) return false;
  const idStr = String(trackId);

  if (activeBlobUrls.has(idStr)) {
    try { URL.revokeObjectURL(activeBlobUrls.get(idStr)); } catch (e) {}
    activeBlobUrls.delete(idStr);
  }

  // Delete native files from Rivo / Liofy folder
  if (Capacitor.isNativePlatform() || window.Capacitor) {
    try {
      await Filesystem.deleteFile({
        path: `Rivo/${idStr}.mp3`,
        directory: Directory.Data,
      }).catch(() => {});
      await Filesystem.deleteFile({
        path: `Rivo/${idStr}_cover.jpg`,
        directory: Directory.Data,
      }).catch(() => {});
      await Filesystem.deleteFile({
        path: `Liofy/${idStr}.mp3`,
        directory: Directory.Data,
      }).catch(() => {});
      await Filesystem.deleteFile({
        path: `Liofy/${idStr}_cover.jpg`,
        directory: Directory.Data,
      }).catch(() => {});
    } catch (e) {}
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
