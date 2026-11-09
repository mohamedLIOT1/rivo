// High-performance Quran Reciters & Full 114 Surahs Streaming Service
// Provides canonical CDN streaming URLs (zero-latency MP3s) and dynamic mp3quran.net discovery
import { SURAH_METADATA } from './quranMetadata.js';
import {
  normalizeArabicText,
  getQuranReciterName,
  getSurahNumber,
  cleanQuranTrackTitle,
  isAyahOrClip,
  sortQuranTracks
} from './quranUtils.js';
import { CANONICAL_RECITERS } from './canonicalRecitersData.js';

export { CANONICAL_RECITERS };

// In-memory cache for dynamically fetched mp3quran reciters
let dynamicRecitersCache = null;

/**
 * Fetches the full reciters catalog from mp3quran.net API v3
 * @param {AbortSignal} [signal] Cancellation signal
 * @returns {Promise<Array>} List of reciters with servers
 */
export async function fetchMp3QuranReciters(signal = null) {
  if (dynamicRecitersCache && dynamicRecitersCache.length > 0) {
    return dynamicRecitersCache;
  }
  try {
    const res = await fetch('https://mp3quran.net/api/v3/reciters?language=ar', { signal });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data || !Array.isArray(data.reciters)) return [];

    const reciters = data.reciters.map(r => {
      const moshafList = Array.isArray(r.moshaf) ? r.moshaf : [];
      let best = moshafList.find(m => m.surah_total === 114 && /حفص/i.test(m.name))
        || moshafList.find(m => m.surah_total === 114)
        || moshafList[0];
      return {
        id: `mp3quran-${r.id}`,
        name: r.name,
        server: best?.server || null,
        surahTotal: best?.surah_total || 114,
        surahList: best?.surah_list ? best.surah_list.split(',').map(n => parseInt(n.trim(), 10)) : null
      };
    }).filter(r => Boolean(r.server));

    dynamicRecitersCache = reciters;
    return reciters;
  } catch (e) {
    return [];
  }
}

/**
 * Resolves a reciter object from canonical table, dynamic API, or DB
 * @param {string} reciterName 
 * @param {Array} [apiReciters] 
 * @returns {Object|null}
 */
export function findReciter(reciterName, apiReciters = []) {
  if (!reciterName) return null;
  const normName = normalizeArabicText(reciterName);

  // 1. Check canonical table
  for (const c of CANONICAL_RECITERS) {
    const normC = normalizeArabicText(c.name);
    if (normC === normName || normC.includes(normName) || normName.includes(normC)) {
      return c;
    }
    if (c.aliases && c.aliases.some(a => normalizeArabicText(a) === normName)) {
      return c;
    }
  }

  // 2. Check dynamic API reciters
  const pool = (Array.isArray(apiReciters) && apiReciters.length > 0)
    ? apiReciters
    : (dynamicRecitersCache || []);
  for (const r of pool) {
    const normR = normalizeArabicText(r.name);
    if (normR === normName || normR.includes(normName) || normName.includes(normR)) {
      return r;
    }
  }

  return null;
}

/**
 * Builds the complete list of reciters for the Quran Screen
 * @param {Object} options
 * @param {Array} [options.quranTracks] MongoDB tracks
 * @param {Array} [options.downloadedTracks] Local offline tracks
 * @param {boolean} [options.isOffline] Offline mode flag
 * @param {Array} [options.apiReciters] Dynamically fetched reciters
 * @returns {Array} List of reciter objects with name, count, cover
 */
export function getQuranRecitersList({ quranTracks = [], downloadedTracks = [], isOffline = false, apiReciters = [] } = {}) {
  if (isOffline) {
    const map = new Map();
    (downloadedTracks || []).forEach(t => {
      const name = getQuranReciterName(t);
      if (name && name !== 'قارئ غير معروف') {
        if (!map.has(name)) {
          map.set(name, { name, count: 0, cover: t.coverUrl || t.cover });
        }
        map.get(name).count += 1;
      }
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }

  const reciterMap = new Map();

  // 1. Add all 30 canonical famous reciters (each with full 114 surahs)
  for (const c of CANONICAL_RECITERS) {
    reciterMap.set(c.name, {
      name: c.name,
      count: c.surahTotal || 114,
      cover: c.cover,
      server: c.server,
      isCanonical: true
    });
  }

  // 2. Scan DB tracks for custom reciters (e.g. Abdulrahman Mosad)
  const dbReciters = new Map();
  (quranTracks || []).forEach(t => {
    const name = getQuranReciterName(t);
    if (name && name !== 'قارئ غير معروف' && name !== 'تلاوات قرآنية') {
      if (!dbReciters.has(name)) {
        dbReciters.set(name, { name, count: 0, cover: t.coverUrl || t.cover });
      }
      dbReciters.get(name).count += 1;
    }
  });

  for (const [name, info] of dbReciters.entries()) {
    const existing = findReciter(name, apiReciters);
    if (!existing) {
      reciterMap.set(name, {
        name,
        count: info.count,
        cover: info.cover || null,
        isCanonical: false
      });
    }
  }

  return Array.from(reciterMap.values());
}

/**
 * Returns the complete list of Surahs (1 to 114) for a given reciter
 * Uses direct high-speed CDN MP3 stream URLs with zero latency and zero AVPlayer errors.
 * Merges local offline downloaded tracks when available.
 * @param {string} reciterName 
 * @param {Object} options
 * @param {Array} [options.quranTracks] MongoDB tracks
 * @param {Array} [options.downloadedTracks] Local offline tracks
 * @param {boolean} [options.isOffline] Offline mode flag
 * @param {Array} [options.apiReciters] Dynamically fetched reciters
 * @returns {Array} List of Surah track objects
 */
/**
 * Returns the complete list of Surahs (1 to 114) and custom Ayahs for a given reciter.
 * Supports multiple recitations of the same surah (e.g. multiple recitations of Surah Hud).
 * Disambiguates duplicate recitations and cleanly appends custom ayahs/clips.
 * Uses direct high-speed CDN MP3 stream URLs with zero latency and zero AVPlayer errors.
 * Merges local offline downloaded tracks when available.
 * @param {string} reciterName 
 * @param {Object} options
 * @param {Array} [options.quranTracks] MongoDB tracks
 * @param {Array} [options.downloadedTracks] Local offline tracks
 * @param {boolean} [options.isOffline] Offline mode flag
 * @param {Array} [options.apiReciters] Dynamically fetched reciters
 * @returns {Array} List of Surah track objects
 */
export function getSurahsForReciter(reciterName, { quranTracks = [], downloadedTracks = [], isOffline = false, apiReciters = [] } = {}) {
  if (!reciterName) return [];
  const reciter = findReciter(reciterName, apiReciters);
  const normReciter = normalizeArabicText(reciter ? reciter.name : reciterName);

  const matchesReciter = (t) => {
    if (!t) return false;
    const tReciter = normalizeArabicText(getQuranReciterName(t));
    return tReciter === normReciter || tReciter.includes(normReciter) || normReciter.includes(tReciter);
  };

  if (isOffline) {
    const matched = (downloadedTracks || []).filter(matchesReciter);
    return sortQuranTracks(matched);
  }

  // Find all DB and downloaded tracks for this reciter
  const reciterDbTracks = (quranTracks || []).filter(matchesReciter);
  const reciterDlTracks = (downloadedTracks || []).filter(matchesReciter);

  if (reciter && reciter.server) {
    const slug = (reciter.id || normalizeArabicText(reciter.name)).replace(/[^a-z0-9_-]/gi, '-');
    const reciterServer = reciter.server.endsWith('/') ? reciter.server : `${reciter.server}/`;
    const reciterCover = reciter.cover || null;

    // Multi-map: local downloads grouped by surah number
    const localDownloadedBySurah = new Map();
    reciterDlTracks.forEach(t => {
      const sNum = getSurahNumber(t);
      if (sNum >= 1 && sNum <= 114) {
        if (!localDownloadedBySurah.has(sNum)) {
          localDownloadedBySurah.set(sNum, []);
        }
        localDownloadedBySurah.get(sNum).push(t);
      }
    });

    // Multi-map: DB tracks grouped by surah number + custom ayahs/clips array
    const dbTracksBySurah = new Map(); // surahId (1..114) => Array<track>
    const customAyahsAndClips = [];

    reciterDbTracks.forEach(t => {
      const sNum = getSurahNumber(t);
      const isClip = isAyahOrClip(t);

      if (isClip || sNum < 1 || sNum > 114) {
        // Individual ayah, clip, or general recitation
        customAyahsAndClips.push({
          ...t,
          isAyah: true,
          _surahNum: sNum,
          surahNumber: sNum >= 1 && sNum <= 114 ? sNum : 999
        });
      } else {
        // Full recitation of surah sNum
        if (!dbTracksBySurah.has(sNum)) {
          dbTracksBySurah.set(sNum, []);
        }
        dbTracksBySurah.get(sNum).push(t);
      }
    });

    const surahsList = reciter.surahList || SURAH_METADATA.map(s => s.id);
    const catalog = [];

    surahsList.forEach(surahId => {
      const meta = SURAH_METADATA.find(s => s.id === surahId) || {
        id: surahId,
        name: `سورة ${surahId}`,
        verses: 50
      };

      const surahPad = String(surahId).padStart(3, '0');
      const directAudioUrl = `${reciterServer}${surahPad}.mp3`;
      const dbTracks = dbTracksBySurah.get(surahId) || [];
      const dlTracks = localDownloadedBySurah.get(surahId) || [];
      const estimatedDuration = Math.max(45, (meta.verses || 30) * 14);

      if (dbTracks.length === 0) {
        // Canonical CDN track (default)
        const localDl = dlTracks[0];
        catalog.push({
          _id: localDl?._id || `quran-${slug}-${surahId}`,
          id: localDl?.id || `quran-${slug}-${surahId}`,
          title: `سورة ${meta.name}`,
          englishTitle: meta.englishName || `Surah ${meta.name}`,
          artist: reciter.name,
          album: 'القرآن الكريم',
          audioUrl: localDl?.localAudioUri || localDl?.audioUrl || directAudioUrl,
          localAudioUri: localDl?.localAudioUri || null,
          isDownloaded: Boolean(localDl?.isDownloaded || localDl?.localAudioUri),
          cover: reciterCover,
          coverUrl: reciterCover,
          duration: localDl?.duration || estimatedDuration,
          verses: meta.verses || 0,
          isQuran: true,
          genre: 'Quran',
          surahNumber: surahId,
          _surahNum: surahId
        });
      } else if (dbTracks.length === 1) {
        // Single DB track for this Surah
        const dbTrack = dbTracks[0];
        const localDl = dlTracks.find(d => String(d.id || d._id) === String(dbTrack.id || dbTrack._id)) || dlTracks[0];
        const rawClean = cleanQuranTrackTitle(dbTrack.title || '');
        const displayTitle = (rawClean && rawClean.includes(meta.name))
          ? rawClean
          : `سورة ${meta.name}`;

        catalog.push({
          ...dbTrack,
          _id: dbTrack._id || dbTrack.id || localDl?._id || `quran-${slug}-${surahId}`,
          id: dbTrack.id || dbTrack._id || localDl?.id || `quran-${slug}-${surahId}`,
          title: displayTitle,
          englishTitle: meta.englishName || `Surah ${meta.name}`,
          artist: reciter.name,
          album: dbTrack.album || 'القرآن الكريم',
          audioUrl: localDl?.localAudioUri || dbTrack.audioUrl || directAudioUrl,
          localAudioUri: localDl?.localAudioUri || dbTrack.localAudioUri || null,
          isDownloaded: Boolean(localDl?.isDownloaded || dbTrack.isDownloaded),
          cover: dbTrack.cover || dbTrack.coverUrl || reciterCover,
          coverUrl: dbTrack.coverUrl || dbTrack.cover || reciterCover,
          duration: dbTrack.duration || localDl?.duration || estimatedDuration,
          verses: meta.verses || 0,
          isQuran: true,
          genre: 'Quran',
          surahNumber: surahId,
          _surahNum: surahId
        });
      } else {
        // Multiple DB recitations for this Surah (e.g. Surah Hud has two recitations!)
        const cleanTitles = dbTracks.map(t => cleanQuranTrackTitle(t.title || ''));
        const areTitlesIdentical = cleanTitles.every(t => t === cleanTitles[0]);

        dbTracks.forEach((dbTrack, vIdx) => {
          const localDl = dlTracks.find(d => String(d.id || d._id) === String(dbTrack.id || dbTrack._id));
          let displayTitle = cleanTitles[vIdx];
          if (!displayTitle || !displayTitle.includes(meta.name)) {
            displayTitle = `سورة ${meta.name}`;
          }
          if (areTitlesIdentical || displayTitle === `سورة ${meta.name}`) {
            displayTitle = `${displayTitle} (تلاوة ${vIdx + 1})`;
          }

          catalog.push({
            ...dbTrack,
            _id: dbTrack._id || dbTrack.id || `quran-${slug}-${surahId}-v${vIdx + 1}`,
            id: dbTrack.id || dbTrack._id || `quran-${slug}-${surahId}-v${vIdx + 1}`,
            title: displayTitle,
            englishTitle: `${meta.englishName || `Surah ${meta.name}`} (Recitation ${vIdx + 1})`,
            artist: reciter.name,
            album: dbTrack.album || 'القرآن الكريم',
            audioUrl: localDl?.localAudioUri || dbTrack.audioUrl || directAudioUrl,
            localAudioUri: localDl?.localAudioUri || dbTrack.localAudioUri || null,
            isDownloaded: Boolean(localDl?.isDownloaded || dbTrack.isDownloaded),
            cover: dbTrack.cover || dbTrack.coverUrl || reciterCover,
            coverUrl: dbTrack.coverUrl || dbTrack.cover || reciterCover,
            duration: dbTrack.duration || localDl?.duration || estimatedDuration,
            verses: meta.verses || 0,
            isQuran: true,
            genre: 'Quran',
            surahNumber: surahId,
            _surahNum: surahId,
            recitationVariation: vIdx + 1
          });
        });
      }
    });

    // Append custom ayahs and clips for this reciter cleanly at the appropriate location
    if (customAyahsAndClips.length > 0) {
      const sortedClips = sortQuranTracks(customAyahsAndClips);
      sortedClips.forEach((clip, cIdx) => {
        catalog.push({
          ...clip,
          _id: clip._id || clip.id || `quran-${slug}-clip-${cIdx}`,
          id: clip.id || clip._id || `quran-${slug}-clip-${cIdx}`,
          title: cleanQuranTrackTitle(clip.title || ''),
          artist: reciter.name,
          isQuran: true,
          isAyah: true,
          genre: 'Quran'
        });
      });
    }

    return catalog;
  }

  // Custom reciter without CDN server (e.g. Abdulrahman Mosad): return their DB tracks sorted
  return sortQuranTracks(reciterDbTracks);
}

/**
 * Filter surah tracks by search query (surah name, reciter name, or surah number)
 * @param {Array} tracks 
 * @param {string} query 
 * @returns {Array}
 */
export function filterQuranSurahs(tracks = [], query = '') {
  if (!query || !query.trim()) return tracks;
  const normQ = normalizeArabicText(query.trim());
  return (tracks || []).filter(t => {
    const text = normalizeArabicText(`${t.title || ''} ${t.artist || ''} ${t.album || ''} ${t.surahNumber || ''}`);
    return text.includes(normQ);
  });
}
