import { deduplicateTrackList } from '../services/downloadManager';
import { sortTracksByPopularity } from '../../utils/trackPopularity';
import { isQuranContent, getQuranReciterName, cleanQuranTrackTitle, normalizeArabicText, isRadioTrack } from '../../utils/quranUtils';
import { getQuranRecitersList } from '../../utils/quranRecitersService';

// Nested WeakMap memoization keyed by array references so switching tabs never re-sorts or re-dedupes static catalogs.
const downloadedMusicCache = new WeakMap();
const onlineMusicCache = new WeakMap();
const derivedAlbumsCache = new WeakMap();
const quranTracksCache = new WeakMap();
const quranRecitersCache = new WeakMap();

const EMPTY = [];

/**
 * Returns pre-deduplicated & popularity-sorted music tracks for HomeScreen in O(1) when track references match.
 */
export function getCachedMusicTracks({ userTracks, downloadedTracks, isOffline, activeFilter }) {
  if (isOffline || activeFilter === 'downloaded') {
    const src = Array.isArray(downloadedTracks) ? downloadedTracks : EMPTY;
    let cached = downloadedMusicCache.get(src);
    if (!cached) {
      const musicOnly = deduplicateTrackList(src.filter((t) => !isQuranContent(t)));
      cached = sortTracksByPopularity(musicOnly);
      downloadedMusicCache.set(src, cached);
    }
    return cached;
  }

  const src = Array.isArray(userTracks) ? userTracks : EMPTY;
  let cached = onlineMusicCache.get(src);
  if (!cached) {
    const musicOnly = deduplicateTrackList(src.filter((t) => !isQuranContent(t)));
    cached = sortTracksByPopularity(musicOnly);
    onlineMusicCache.set(src, cached);
  }
  return cached;
}

/**
 * Returns filtered/derived Featured Albums for HomeScreen in O(1) when albums & userTracks references match.
 */
export function getCachedHomeAlbums(albums, userTracks) {
  const safeAlbums = Array.isArray(albums) ? albums : EMPTY;
  const dbAlbums = safeAlbums.filter((alb) => !isQuranContent(alb));
  if (dbAlbums.length > 0) return dbAlbums;

  const src = Array.isArray(userTracks) ? userTracks : EMPTY;
  let cached = derivedAlbumsCache.get(src);
  if (!cached) {
    const map = new Map();
    for (let i = 0; i < src.length; i++) {
      const t = src[i];
      if (t?.album && t.album.trim() && !isQuranContent(t)) {
        const key = t.album.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            id: `derived-${key}`,
            name: t.album.trim(),
            artist: t.artist || 'Various Artists',
            cover: t.cover,
            tracks: [t],
          });
        } else {
          map.get(key).tracks.push(t);
        }
      }
    }
    cached = Array.from(map.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 16);
    derivedAlbumsCache.set(src, cached);
  }
  return cached;
}

/**
 * Returns deduplicated Quran tracks from a raw catalog in O(1) when the source array is unchanged.
 */
export function getCachedQuranTracks(allTracks) {
  const src = Array.isArray(allTracks) ? allTracks : EMPTY;
  let cached = quranTracksCache.get(src);
  if (cached) return cached;

  const raw = src.filter((t) => isQuranContent(t) && !isRadioTrack(t));
  const seenAudio = new Set();
  const seenMeta = new Set();
  const deduped = [];

  for (let i = 0; i < raw.length; i++) {
    const t = raw[i];
    const reciter = getQuranReciterName(t);
    const cleanTitle = cleanQuranTrackTitle(t.title || '');
    const metaKey = `${normalizeArabicText(reciter)}:::${normalizeArabicText(cleanTitle)}`;

    let audioKey = null;
    if (t.audioUrl && typeof t.audioUrl === 'string' && t.audioUrl.length > 10) {
      const ytMatch = t.audioUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || t.audioUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
      audioKey = ytMatch ? `yt:${ytMatch[1]}` : `url:${t.audioUrl.trim().toLowerCase()}`;
    }

    if (audioKey && seenAudio.has(audioKey)) continue;
    if (metaKey && seenMeta.has(metaKey)) continue;

    if (audioKey) seenAudio.add(audioKey);
    if (metaKey) seenMeta.add(metaKey);
    deduped.push(t);
  }

  quranTracksCache.set(src, deduped);
  return deduped;
}

/**
 * Caches built Quran reciters list keyed by source tracks, offline flag, and API reciters array.
 */
export function getCachedQuranRecitersList({ quranTracks, downloadedTracks, isOffline, apiReciters }) {
  const primaryKey = isOffline ? (downloadedTracks || EMPTY) : (quranTracks || EMPTY);
  const secondaryKey = Array.isArray(apiReciters) ? apiReciters : EMPTY;

  let outer = quranRecitersCache.get(primaryKey);
  if (!outer) {
    outer = new WeakMap();
    quranRecitersCache.set(primaryKey, outer);
  }
  const existing = outer.get(secondaryKey);
  if (existing) return existing;

  const built = getQuranRecitersList({ quranTracks, downloadedTracks, isOffline, apiReciters });
  outer.set(secondaryKey, built);
  return built;
}
