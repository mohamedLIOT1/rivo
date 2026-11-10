import { isQuranContent, isRadioTrack } from '../../../utils/quranUtils';
import { isPodcastContent } from '../../utils/podcastUtils';
import { QURAN_LIVE_STATIONS } from '../../data/quranLiveStations';

/**
 * Checks if a candidate track matches the content type of the active playing track.
 * Guarantees strict segregation:
 * - Quran Content / Radio -> ONLY Quran Content or Quran Radio.
 * - Podcast -> ONLY Podcast.
 * - Secular Music -> ONLY Secular Music (no Quran, no Radio, no Podcast).
 */
export function isMatchingContentType(cur, track) {
  if (!track) return false;
  if (!cur) return true;

  const isCurRadio = isRadioTrack(cur);
  const isCurQuran = isCurRadio || isQuranContent(cur);
  const isCurPodcast = !isCurQuran && isPodcastContent(cur);

  if (isCurQuran) {
    return Boolean(isQuranContent(track) || isRadioTrack(track));
  }
  if (isCurPodcast) {
    return Boolean(isPodcastContent(track));
  }
  return !isRadioTrack(track) && !isQuranContent(track) && !isPodcastContent(track);
}

/**
 * Strict Quran Radio loop navigation (24/7 continuous wrap-around).
 */
export function handleQuranRadioNext(cur, queue, playTrackCallback, setQueue) {
  const radioPool = (Array.isArray(queue) && queue.length > 0 && queue.some(isRadioTrack))
    ? queue.filter(isRadioTrack)
    : QURAN_LIVE_STATIONS;
  const currentId = String(cur?._id || cur?.id || '');
  let idx = radioPool.findIndex(t => String(t._id || t.id) === currentId);
  const nextIdx = (idx >= 0 && idx < radioPool.length - 1) ? idx + 1 : 0;
  setQueue(radioPool);
  if (typeof playTrackCallback === 'function') {
    playTrackCallback(radioPool[nextIdx], radioPool);
  }
}

/**
 * Strict Quran Recitation queue progression:
 * - Plays next Quran track in queue.
 * - If queue ends, checks user/downloaded Quran library.
 * - If none remain, loops to start or falls back to official 24/7 Quran Live Stations.
 * - NEVER falls back to secular music!
 */
export function handleQuranContentNext(cur, queue, userTracks, downloadedTracks, playTrackCallback, setQueue) {
  const currentId = String(cur?._id || cur?.id || '');
  const q = (Array.isArray(queue) ? queue : []).filter(t => isQuranContent(t) || isRadioTrack(t));
  let idx = q.findIndex(t => String(t._id || t.id) === currentId);

  // 1. Advance within current Quran queue
  if (idx >= 0 && idx < q.length - 1) {
    setQueue(q);
    if (typeof playTrackCallback === 'function') {
      playTrackCallback(q[idx + 1], q);
    }
    return true;
  }

  // 2. Search library for unplayed Quran tracks
  const allQuran = [
    ...(Array.isArray(userTracks) ? userTracks : []),
    ...(Array.isArray(downloadedTracks) ? downloadedTracks : [])
  ].filter(t => isQuranContent(t) && String(t._id || t.id) !== currentId);

  if (allQuran.length > 0) {
    const newQ = cur ? [cur, ...allQuran] : allQuran;
    setQueue(newQ);
    if (typeof playTrackCallback === 'function') {
      playTrackCallback(allQuran[0], newQ);
    }
    return true;
  }

  // 3. Wrap around existing Quran queue
  if (q.length > 1) {
    setQueue(q);
    if (typeof playTrackCallback === 'function') {
      playTrackCallback(q[0], q);
    }
    return true;
  }

  // 4. Seamlessly transition to 24/7 Quran Live Stations
  const stations = QURAN_LIVE_STATIONS;
  setQueue(stations);
  if (typeof playTrackCallback === 'function') {
    playTrackCallback(stations[0], stations);
  }
  return true;
}

/**
 * Backwards navigation for Quran Radio and Quran content.
 */
export function handleQuranPrev(cur, queue, playTrackCallback, setQueue) {
  const isRadio = isRadioTrack(cur);
  const pool = isRadio
    ? ((Array.isArray(queue) && queue.length > 0 && queue.some(isRadioTrack)) ? queue.filter(isRadioTrack) : QURAN_LIVE_STATIONS)
    : (Array.isArray(queue) ? queue : []).filter(t => isQuranContent(t) || isRadioTrack(t));

  const currentId = String(cur?._id || cur?.id || '');
  let idx = pool.findIndex(t => String(t._id || t.id) === currentId);
  const prevIdx = idx > 0 ? idx - 1 : (pool.length > 1 ? pool.length - 1 : 0);

  const finalPool = pool.length > 0 ? pool : (isRadio ? QURAN_LIVE_STATIONS : [cur]);
  setQueue(finalPool);
  if (typeof playTrackCallback === 'function' && finalPool[prevIdx]) {
    playTrackCallback(finalPool[prevIdx], finalPool);
  }
}
