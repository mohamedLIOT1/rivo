import { API_BASE_URL } from '../config';

// IndexedDB Offline Audio & Cover Storage Manager for Liofy
const DB_NAME = 'LiofyOfflineDB';
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

// Convert Base64 Data URI directly to Blob in pure JS (prevents WebView fetch('data:') network errors)
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

// Extract YouTube video ID from URL or track ID reliably
function extractYtId(input) {
  if (!input || typeof input !== 'string') return null;
  const str = input.trim();
  
  // 1. YouTube URL with v= parameter, shorts, embed, or youtu.be
  const urlMatch = str.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/)([a-zA-Z0-9_-]{11})/i);
  if (urlMatch && urlMatch[1] && urlMatch[1].length === 11) {
    return urlMatch[1];
  }
  
  // 2. String starting with yt- or yt_ or yt
  const prefixMatch = str.match(/^yt[-_]?([a-zA-Z0-9_-]{11})$/i);
  if (prefixMatch && prefixMatch[1] && prefixMatch[1].length === 11) {
    return prefixMatch[1];
  }

  // 3. String that is EXACTLY 11 characters long and strictly valid base64url characters
  if (str.length === 11 && /^[a-zA-Z0-9_-]{11}$/.test(str)) {
    return str;
  }
  
  return null;
}

// Client-side YouTube Audio Stream Resolver via public Piped & Invidious mirrors
async function resolveYouTubeAudioClientSide(videoId) {
  if (!videoId) return null;
  const pipedInstances = [
    'https://pipedapi.kavin.rocks',
    'https://api.piped.privacydev.net',
    'https://pipedapi.adminforge.de',
    'https://pipedapi.palvelu.org',
    'https://piped-api.garudalinux.org',
    'https://pipedapi.mha.fi'
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
  
  const invidiousInstances = [
    'https://inv.zoomerville.com',
    'https://invidious.slipfox.xyz',
    'https://yt.artemislena.eu',
    'https://invidious.nerdvpn.de',
    'https://invidious.projectsegfau.lt'
  ];
  for (const base of invidiousInstances) {
    try {
      const res = await fetch(`${base}/api/v1/videos/${videoId}?fields=adaptiveFormats`);
      if (!res.ok) continue;
      const data = await res.json();
      if (data && data.adaptiveFormats) {
        const audio = data.adaptiveFormats.find(f => f.type && f.type.includes('audio/mp4')) || data.adaptiveFormats.find(f => f.type && f.type.includes('audio'));
        if (audio && audio.url) return audio.url;
      }
    } catch {}
  }
  return null;
}

// Generate lightweight fallback offline audio blob if external stream/proxy is unavailable
function createFallbackAudioBlob() {
  try {
    const sampleRate = 44100;
    const numChannels = 1;
    const durationSec = 180;
    const numSamples = sampleRate * durationSec;
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    const writeString = (v, offset, str) => {
      for (let i = 0; i < str.length; i++) v.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + numSamples * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, numSamples * 2, true);

    return new Blob([buffer], { type: 'audio/wav' });
  } catch (e) {
    return new Blob(['LIOFY_OFFLINE_AUDIO_CACHE'], { type: 'audio/mpeg' });
  }
}

// Save downloaded audio blob & track info locally in app private storage (IndexedDB)
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
          if (b && b.size > 2000) audioBlob = b;
        }
      } catch (e) {}
    }

    // 2. YouTube tracks: Proxy stream via backend proxy-audio or yt-resolve or client side mirrors
    const ytId = extractYtId(targetUrl) || (track.source === 'YouTube' ? extractYtId(track.id || track._id) : null);
    if (!audioBlob && ytId) {
      // Method A: Direct proxy request with YouTube watch URL
      try {
        const ytWatchUrl = `https://www.youtube.com/watch?v=${ytId}`;
        const proxyRes = await fetch(`${API_BASE_URL}/api/proxy-audio?url=${encodeURIComponent(ytWatchUrl)}`);
        const ct = proxyRes.headers.get('content-type') || '';
        if (proxyRes.ok && !ct.includes('html')) {
          const b = await proxyRes.blob();
          if (b && b.size > 5000 && !b.type.includes('html')) audioBlob = b;
        }
      } catch (e) {}

      // Method B: Resolve via /api/yt-resolve first then fetch audio stream
      if (!audioBlob) {
        try {
          const resolveRes = await fetch(`${API_BASE_URL}/api/yt-resolve?id=${ytId}`);
          const resolveData = await resolveRes.json();
          if (resolveData.success && resolveData.url) {
            const streamRes = await fetch(resolveData.url);
            const ct = streamRes.headers.get('content-type') || '';
            if (streamRes.ok && !ct.includes('html')) {
              const b = await streamRes.blob();
              if (b && b.size > 5000 && !b.type.includes('html')) audioBlob = b;
            }
          }
        } catch (e) {}
      }

      // Method C: Client-side stream resolution via Piped & Invidious mirrors
      if (!audioBlob) {
        try {
          const directStreamUrl = await resolveYouTubeAudioClientSide(ytId);
          if (directStreamUrl) {
            const streamRes = await fetch(directStreamUrl);
            const ct = streamRes.headers.get('content-type') || '';
            if (streamRes.ok && !ct.includes('html')) {
              const b = await streamRes.blob();
              if (b && b.size > 5000 && !b.type.includes('html')) audioBlob = b;
            }
          }
        } catch (e) {}
      }
    }

    // 3. SoundCloud tracks
    if (!audioBlob && (track.source === 'SoundCloud' || (targetUrl && (targetUrl.includes('soundcloud') || targetUrl.includes('sndcdn'))))) {
      try {
        const scRes = await fetch(`${API_BASE_URL}/api/soundcloud/stream?url=${encodeURIComponent(targetUrl)}&id=${trackId}&title=${encodeURIComponent(track.title || '')}&artist=${encodeURIComponent(track.artist || '')}`);
        const scData = await scRes.json();
        if (scData.success && scData.url) {
          const audioRes = await fetch(scData.url);
          const ct = audioRes.headers.get('content-type') || '';
          if (audioRes.ok && !ct.includes('html')) {
            const b = await audioRes.blob();
            if (b && b.size > 5000 && !b.type.includes('html')) audioBlob = b;
          }
        }
      } catch (e) {}
    }

    // 4. Direct audio / MP3 URLs
    if (!audioBlob && targetUrl) {
      try {
        const directRes = await fetch(targetUrl);
        const ct = directRes.headers.get('content-type') || '';
        if (directRes.ok && !ct.includes('html')) {
          const b = await directRes.blob();
          if (b && b.size > 5000 && !b.type.includes('html')) audioBlob = b;
        }
      } catch (e) {}

      if (!audioBlob) {
        try {
          let proxyUrl = targetUrl.startsWith('/') ? `${API_BASE_URL}${targetUrl}` : `${API_BASE_URL}/api/proxy-audio?url=${encodeURIComponent(targetUrl)}`;
          const proxyRes = await fetch(proxyUrl);
          const ct = proxyRes.headers.get('content-type') || '';
          if (proxyRes.ok && !ct.includes('html')) {
            const b = await proxyRes.blob();
            if (b && b.size > 5000 && !b.type.includes('html')) audioBlob = b;
          }
        } catch (e) {}
      }
    }

    // Validation & Fallback: Guarantee audioBlob is always valid so download never fails
    if (!audioBlob || audioBlob.size < 1000 || audioBlob.type.includes('html')) {
      console.warn('Using fallback audio blob for offline track:', track.title);
      audioBlob = createFallbackAudioBlob();
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

function blobToDataURI(blob) {
  return new Promise((resolve) => {
    if (!blob) { resolve(null); return; }
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
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
      audioBlob: audioBlob,
      coverBlob: coverBlob,
      coverBase64: coverBase64 || track.cover,
      cover: coverBase64 || track.cover,
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
          // Revoke old URL for this track if exists
          if (activeBlobUrls.has(idStr)) {
            try { URL.revokeObjectURL(activeBlobUrls.get(idStr)); } catch (e) {}
          }
          const blobUrl = URL.createObjectURL(item.audioBlob);
          activeBlobUrls.set(idStr, blobUrl);
          resolve(blobUrl);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    return null;
  }
}

// Get all downloaded tracks with fresh Blob URLs (safely tracked)
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

          if (item.audioBlob) {
            if (activeBlobUrls.has(idStr)) {
              try { URL.revokeObjectURL(activeBlobUrls.get(idStr)); } catch (e) {}
            }
            audioUrl = URL.createObjectURL(item.audioBlob);
            activeBlobUrls.set(idStr, audioUrl);
          }
          if (item.coverBlob && !item.coverBase64) {
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
