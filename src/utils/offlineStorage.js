import { API_BASE_URL } from '../config';

// IndexedDB Offline Audio & Cover Storage Manager for Rivo (Pure Web & PWA)
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

  if ((str.includes('youtube.com') || str.includes('youtu.be')) && /^[a-zA-Z0-9_-]{11}$/.test(str)) {
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
export async function saveTrackOffline(track) {
  if (!track || (!track.id && !track._id)) return null;
  const trackId = String(track.id || track._id);

  // ── Native APK Bridge: route download to device storage via postMessage ──
  // When running inside the Rivo APK WebView, window.RIVO_NATIVE is set by
  // the injected JS. Downloads go to expo-file-system instead of IndexedDB.
  if (typeof window !== 'undefined' && window.RIVO_NATIVE && window.RIVO_DOWNLOAD) {
    try {
      window.RIVO_DOWNLOAD({
        id: trackId,
        _id: trackId,
        title: track.title || 'Unknown',
        artist: track.artist || 'Unknown Artist',
        audioUrl: track.audioUrl || '',
        coverUrl: track.cover || track.coverUrl || '',
        cover: track.cover || track.coverUrl || '',
        source: track.source || '',
        album: track.album || '',
        duration: track.duration || 0,
      });
      // Return a synthetic record so the UI can update immediately
      return { ...track, id: trackId, downloaded: true, savedAt: Date.now() };
    } catch (e) {
      console.error('Native bridge download error:', e);
      // Fall through to web download as fallback
    }
  }

  try {
    let targetUrl = track.audioUrl || '';
    let audioBlob = null;

    // 1. Data URI
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

    // 3. YouTube tracks
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

    const db = await openDB();
    const offlineTrack = {
      ...track,
      id: trackId,
      downloaded: true,
      audioBlob: audioBlob || null,
      coverBlob: coverBlob || null,
      coverBase64: coverBase64 || null,
      cover: coverBase64 || track.cover,
      audioUrl: audioBlob ? URL.createObjectURL(audioBlob) : targetUrl,
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
        if (item && item.audioBlob) {
          if (activeBlobUrls.has(idStr)) {
            try { URL.revokeObjectURL(activeBlobUrls.get(idStr)); } catch (e) {}
          }
          const blobUrl = URL.createObjectURL(item.audioBlob);
          activeBlobUrls.set(idStr, blobUrl);
          resolve(blobUrl);
          return;
        }
        resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
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

// Remove track from offline storage
export async function removeTrackOffline(trackId) {
  if (!trackId) return false;
  const idStr = String(trackId);

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
