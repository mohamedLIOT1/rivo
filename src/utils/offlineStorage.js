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

// Save downloaded audio blob & track info locally
export async function saveTrackOffline(track) {
  if (!track || !track.id) return null;
  const trackId = String(track.id);

  try {
    const db = await openDB();
    let audioBlob = null;

    if (track.audioUrl && track.audioUrl.startsWith('http')) {
      try {
        const response = await fetch(track.audioUrl, { mode: 'cors' });
        if (response.ok) {
          audioBlob = await response.blob();
        }
      } catch (err) {
        console.warn('Direct fetch audio blob failed, storing metadata:', err);
      }
    }

    const offlineTrack = {
      ...track,
      id: trackId,
      downloaded: true,
      audioBlob: audioBlob,
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
          if (item.audioBlob) {
            const idStr = String(item.id);
            if (activeBlobUrls.has(idStr)) {
              try { URL.revokeObjectURL(activeBlobUrls.get(idStr)); } catch (e) {}
            }
            audioUrl = URL.createObjectURL(item.audioBlob);
            activeBlobUrls.set(idStr, audioUrl);
          }
          return { ...item, audioUrl, downloaded: true };
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
