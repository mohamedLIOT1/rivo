import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { useState, useEffect } from 'react';

/**
 * High-Performance Persistent Disk Image Caching Layer for Rivo
 * - MD5 URL hashing
 * - In-memory O(1) index for instant synchronous resolution across app restarts
 * - Controlled concurrency queue (max 3) preventing I/O freezes
 * - Atomic temporary download to permanent file to prevent partial corruptions
 */

// Base cache directory (uses cacheDirectory, fallback to documentDirectory)
const CACHE_BASE = FileSystem.cacheDirectory || FileSystem.documentDirectory;
export const COVERS_CACHE_DIR = `${CACHE_BASE}covers/`;

// State
const diskFilesSet = new Set();
const memoryUriMap = new Map();
const activeDownloads = new Map();
const cacheListeners = new Map();
const downloadQueue = [];
let activeDownloadCount = 0;
const MAX_CONCURRENT_DOWNLOADS = 2;
const MAX_DISK_CACHE_FILES = 1500;
const filenameMemo = new Map();
const MAX_FILENAME_MEMO = 1500;

// Pure JS MD5 Implementation (RFC 1321 compliant, zero native dependencies)
function md5(string) {
  function rotateLeft(lValue, iShiftBits) {
    return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
  }
  function addUnsigned(lX, lY) {
    const lX4 = lX & 0x40000000;
    const lY4 = lY & 0x40000000;
    const lX8 = lX & 0x80000000;
    const lY8 = lY & 0x80000000;
    const lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff);
    if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
    if (lX4 | lY4) {
      if (lResult & 0x40000000) return lResult ^ 0xc0000000 ^ lX8 ^ lY8;
      return lResult ^ 0x40000000 ^ lX8 ^ lY8;
    }
    return lResult ^ lX8 ^ lY8;
  }
  function F(x, y, z) { return (x & y) | (~x & z); }
  function G(x, y, z) { return (x & z) | (y & ~z); }
  function H(x, y, z) { return x ^ y ^ z; }
  function I(x, y, z) { return y ^ (x | ~z); }

  function FF(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function GG(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function HH(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }
  function II(a, b, c, d, x, s, ac) {
    a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
    return addUnsigned(rotateLeft(a, s), b);
  }

  function convertToWordArray(str) {
    let lWordCount;
    const lMessageLength = str.length;
    const lNumberOfWords_temp1 = lMessageLength + 8;
    const lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
    const lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
    const lWordArray = Array(lNumberOfWords - 1);
    let lBytePosition = 0;
    let lByteCount = 0;
    while (lByteCount < lMessageLength) {
      lWordCount = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordCount] = (lWordArray[lWordCount] | (str.charCodeAt(lByteCount) << lBytePosition));
      lByteCount++;
    }
    lWordCount = (lByteCount - (lByteCount % 4)) / 4;
    lBytePosition = (lByteCount % 4) * 8;
    lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80 << lBytePosition);
    lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
    lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
    return lWordArray;
  }

  function wordToHex(lValue) {
    let wordToHexValue = '', wordToHexValue_temp = '', lByte, lCount;
    for (lCount = 0; lCount <= 3; lCount++) {
      lByte = (lValue >>> (lCount * 8)) & 255;
      wordToHexValue_temp = '0' + lByte.toString(16);
      wordToHexValue = wordToHexValue + wordToHexValue_temp.substr(wordToHexValue_temp.length - 2, 2);
    }
    return wordToHexValue;
  }

  const x = convertToWordArray(string);
  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476;
  const S11 = 7, S12 = 12, S13 = 17, S14 = 22;
  const S21 = 5, S22 = 9, S23 = 14, S24 = 20;
  const S31 = 4, S32 = 11, S33 = 16, S34 = 23;
  const S41 = 6, S42 = 10, S43 = 15, S44 = 21;

  for (let k = 0; k < x.length; k += 16) {
    const AA = a, BB = b, CC = c, DD = d;
    a = FF(a, b, c, d, x[k + 0], S11, 0xd76aa478);
    d = FF(d, a, b, c, x[k + 1], S12, 0xe8c7b756);
    c = FF(c, d, a, b, x[k + 2], S13, 0x242070db);
    b = FF(b, c, d, a, x[k + 3], S14, 0xc1bdceee);
    a = FF(a, b, c, d, x[k + 4], S11, 0xf57c0faf);
    d = FF(d, a, b, c, x[k + 5], S12, 0x4787c62a);
    c = FF(c, d, a, b, x[k + 6], S13, 0xa8304613);
    b = FF(b, c, d, a, x[k + 7], S14, 0xfd469501);
    a = FF(a, b, c, d, x[k + 8], S11, 0x698098d8);
    d = FF(d, a, b, c, x[k + 9], S12, 0x8b44f7af);
    c = FF(c, d, a, b, x[k + 10], S13, 0xffff5bb1);
    b = FF(b, c, d, a, x[k + 11], S14, 0x895cd7be);
    a = FF(a, b, c, d, x[k + 12], S11, 0x6b901122);
    d = FF(d, a, b, c, x[k + 13], S12, 0xfd987193);
    c = FF(c, d, a, b, x[k + 14], S13, 0xa679438e);
    b = FF(b, c, d, a, x[k + 15], S14, 0x49b40821);
    a = GG(a, b, c, d, x[k + 1], S21, 0xf61e2562);
    d = GG(d, a, b, c, x[k + 6], S22, 0xc040b340);
    c = GG(c, d, a, b, x[k + 11], S23, 0x265e5a51);
    b = GG(b, c, d, a, x[k + 0], S24, 0xe9b6c7aa);
    a = GG(a, b, c, d, x[k + 5], S21, 0xd62f105d);
    d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
    c = GG(c, d, a, b, x[k + 15], S23, 0xd8a1e681);
    b = GG(b, c, d, a, x[k + 4], S24, 0xe7d3fbc8);
    a = GG(a, b, c, d, x[k + 9], S21, 0x21e1cde6);
    d = GG(d, a, b, c, x[k + 14], S22, 0xc33707d6);
    c = GG(c, d, a, b, x[k + 3], S23, 0xf4d50d87);
    b = GG(b, c, d, a, x[k + 8], S24, 0x455a14ed);
    a = GG(a, b, c, d, x[k + 13], S21, 0xa9e3e905);
    d = GG(d, a, b, c, x[k + 2], S22, 0xfcefa3f8);
    c = GG(c, d, a, b, x[k + 7], S23, 0x676f02d9);
    b = GG(b, c, d, a, x[k + 12], S24, 0x8d2a4c8a);
    a = HH(a, b, c, d, x[k + 5], S31, 0xfffa3942);
    d = HH(d, a, b, c, x[k + 8], S32, 0x8771f681);
    c = HH(c, d, a, b, x[k + 11], S33, 0x6d9d6122);
    b = HH(b, c, d, a, x[k + 14], S34, 0xfde5380c);
    a = HH(a, b, c, d, x[k + 1], S31, 0xa4beea44);
    d = HH(d, a, b, c, x[k + 4], S32, 0x4bdecfa9);
    c = HH(c, d, a, b, x[k + 7], S33, 0xf6bb4b60);
    b = HH(b, c, d, a, x[k + 10], S34, 0xbebfbc70);
    a = HH(a, b, c, d, x[k + 13], S31, 0x289b7ec6);
    d = HH(d, a, b, c, x[k + 0], S32, 0xeaa127fa);
    c = HH(c, d, a, b, x[k + 3], S33, 0xd4ef3085);
    b = HH(b, c, d, a, x[k + 6], S34, 0x4881d05);
    a = HH(a, b, c, d, x[k + 9], S31, 0xd9d4d039);
    d = HH(d, a, b, c, x[k + 12], S32, 0xe6db99e5);
    c = HH(c, d, a, b, x[k + 15], S33, 0x1fa27cf8);
    b = HH(b, c, d, a, x[k + 2], S34, 0xc4ac5665);
    a = II(a, b, c, d, x[k + 0], S41, 0xf4292244);
    d = II(d, a, b, c, x[k + 7], S42, 0x432aff97);
    c = II(c, d, a, b, x[k + 14], S43, 0xab9423a7);
    b = II(b, c, d, a, x[k + 5], S44, 0xfc93a039);
    a = II(a, b, c, d, x[k + 12], S41, 0x655b59c3);
    d = II(d, a, b, c, x[k + 3], S42, 0x8f0ccc92);
    c = II(c, d, a, b, x[k + 10], S43, 0xffeff47d);
    b = II(b, c, d, a, x[k + 1], S44, 0x85845dd1);
    a = II(a, b, c, d, x[k + 8], S41, 0x6fa87e4f);
    d = II(d, a, b, c, x[k + 15], S42, 0xfe2ce6e0);
    c = II(c, d, a, b, x[k + 6], S43, 0xa3014314);
    b = II(b, c, d, a, x[k + 13], S44, 0x4e0811a1);
    a = II(a, b, c, d, x[k + 4], S41, 0xf7537e82);
    d = II(d, a, b, c, x[k + 11], S42, 0xbd3af235);
    c = II(c, d, a, b, x[k + 2], S43, 0x2ad7d2bb);
    b = II(b, c, d, a, x[k + 9], S44, 0xeb86d391);
    a = addUnsigned(a, AA);
    b = addUnsigned(b, BB);
    c = addUnsigned(c, CC);
    d = addUnsigned(d, DD);
  }
  return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
}

/**
 * Ensures the covers directory exists and populates in-memory Set of existing files.
 * Runs once on app startup or module import.
 */
let initPromise = null;
export function initDiskCache() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const info = await FileSystem.getInfoAsync(COVERS_CACHE_DIR).catch(() => ({ exists: false }));
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(COVERS_CACHE_DIR, { intermediates: true }).catch(() => {});
      }
      const files = await FileSystem.readDirectoryAsync(COVERS_CACHE_DIR).catch(() => []);
      for (let i = 0; i < files.length; i++) {
        diskFilesSet.add(files[i]);
      }
    } catch (e) {
      // Non-fatal
    }
  })();
  return initPromise;
}

// Auto-initialize on import
initDiskCache();

/**
 * Returns deterministic filename based on MD5 of URL + extension.
 */
export function getCacheFilename(url) {
  if (!url || typeof url !== 'string') return null;
  const cached = filenameMemo.get(url);
  if (cached) return cached;
  const clean = url.split('?')[0].split('#')[0].toLowerCase();
  let ext = '.jpg';
  if (clean.endsWith('.png')) ext = '.png';
  else if (clean.endsWith('.webp')) ext = '.webp';
  else if (clean.endsWith('.jpeg')) ext = '.jpg';
  const result = `${md5(url)}${ext}`;
  if (filenameMemo.size >= MAX_FILENAME_MEMO) filenameMemo.clear();
  filenameMemo.set(url, result);
  return result;
}

/**
 * Instant synchronous check: returns local file URI if cached on disk, otherwise null.
 */
export function getCachedDiskUriSync(remoteUri) {
  if (!remoteUri || typeof remoteUri !== 'string') return null;
  if (remoteUri.startsWith('file://') || remoteUri.startsWith('data:')) return remoteUri;
  if (!remoteUri.startsWith('http://') && !remoteUri.startsWith('https://')) return null;

  const mem = memoryUriMap.get(remoteUri);
  if (mem) return mem;

  const filename = getCacheFilename(remoteUri);
  if (filename && diskFilesSet.has(filename)) {
    const localUri = `${COVERS_CACHE_DIR}${filename}`;
    memoryUriMap.set(remoteUri, localUri);
    return localUri;
  }
  return null;
}

/**
 * Caches image to disk asynchronously via throttled background queue.
 * Resolves with local URI once saved, or original URL if download fails.
 */
export function cacheImageToDisk(remoteUri) {
  if (!remoteUri || typeof remoteUri !== 'string') return Promise.resolve(null);
  if (remoteUri.startsWith('file://') || remoteUri.startsWith('data:')) return Promise.resolve(remoteUri);
  if (!remoteUri.startsWith('http://') && !remoteUri.startsWith('https://')) return Promise.resolve(remoteUri);

  const filename = getCacheFilename(remoteUri);
  if (!filename) return Promise.resolve(remoteUri);

  const localUri = `${COVERS_CACHE_DIR}${filename}`;

  if (diskFilesSet.has(filename)) {
    memoryUriMap.set(remoteUri, localUri);
    return Promise.resolve(localUri);
  }

  if (activeDownloads.has(remoteUri)) {
    return activeDownloads.get(remoteUri);
  }

  const p = new Promise((resolve) => {
    downloadQueue.push({ remoteUri, filename, localUri, resolve });
    _processQueue();
  });

  activeDownloads.set(remoteUri, p);
  return p;
}

async function _processQueue() {
  if (activeDownloadCount >= MAX_CONCURRENT_DOWNLOADS || downloadQueue.length === 0) {
    return;
  }
  const task = downloadQueue.shift();
  if (!task) return;

  activeDownloadCount++;
  const { remoteUri, filename, localUri, resolve } = task;

  try {
    await initDiskCache();

    if (diskFilesSet.has(filename)) {
      memoryUriMap.set(remoteUri, localUri);
      activeDownloads.delete(remoteUri);
      _notifyListeners(remoteUri, localUri);
      resolve(localUri);
      activeDownloadCount--;
      _processQueue();
      return;
    }

    const tempPath = `${COVERS_CACHE_DIR}${filename}.tmp_${Date.now()}`;
    const res = await FileSystem.downloadAsync(remoteUri, tempPath).catch(() => null);

    if (res && res.status === 200) {
      await FileSystem.moveAsync({ from: tempPath, to: localUri }).catch(() => {});
      diskFilesSet.add(filename);
      memoryUriMap.set(remoteUri, localUri);
      activeDownloads.delete(remoteUri);
      _notifyListeners(remoteUri, localUri);
      resolve(localUri);
    } else {
      await FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => {});
      activeDownloads.delete(remoteUri);
      resolve(remoteUri);
    }
  } catch (e) {
    activeDownloads.delete(remoteUri);
    resolve(remoteUri);
  } finally {
    activeDownloadCount--;
    setTimeout(_processQueue, 80);
  }
}

function _notifyListeners(remoteUri, diskUri) {
  const set = cacheListeners.get(remoteUri);
  if (set) {
    set.forEach((cb) => {
      try { cb(diskUri); } catch {}
    });
    cacheListeners.delete(remoteUri);
  }
}

export function addCacheListener(remoteUri, callback) {
  if (!cacheListeners.has(remoteUri)) {
    cacheListeners.set(remoteUri, new Set());
  }
  cacheListeners.get(remoteUri).add(callback);
}

export function removeCacheListener(remoteUri, callback) {
  const set = cacheListeners.get(remoteUri);
  if (set) {
    set.delete(callback);
    if (set.size === 0) cacheListeners.delete(remoteUri);
  }
}

/**
 * Hook for components wanting automatic real-time swap from remote to local disk URI.
 */
export function useCachedImageUri(remoteUri) {
  const [uri, setUri] = useState(() => {
    return getCachedDiskUriSync(remoteUri) || remoteUri;
  });

  useEffect(() => {
    if (!remoteUri) {
      setUri(remoteUri);
      return;
    }
    const cached = getCachedDiskUriSync(remoteUri);
    if (cached) {
      setUri(cached);
      return;
    }

    setUri(remoteUri);

    let isMounted = true;
    const handleCached = (diskUri) => {
      if (isMounted) setUri(diskUri);
    };

    addCacheListener(remoteUri, handleCached);
    cacheImageToDisk(remoteUri).then((diskUri) => {
      if (isMounted && diskUri) setUri(diskUri);
    }).catch(() => {});

    return () => {
      isMounted = false;
      removeCacheListener(remoteUri, handleCached);
    };
  }, [remoteUri]);

  return uri;
}

/**
 * Clears the persistent disk image cache.
 */
export async function clearDiskImageCache() {
  try {
    await FileSystem.deleteAsync(COVERS_CACHE_DIR, { idempotent: true });
    diskFilesSet.clear();
    memoryUriMap.clear();
    await initDiskCache();
  } catch {}
}
