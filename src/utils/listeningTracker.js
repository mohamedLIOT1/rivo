/**
 * Liofy Real Listening Activity & Statistics Tracker
 * Accurately tracks actual playback duration (in seconds), verified plays,
 * weekly listening leaderboards, and top streamed tracks.
 */

import { API_BASE_URL } from '../config';

const STORAGE_KEY = 'liofy_listening_stats_v2';
const SYNC_INTERVAL_MS = 25000;

function getISOWeekString(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getDefaultStats() {
  return {
    currentWeek: getISOWeekString(),
    weeklySeconds: 0,
    totalSeconds: 0,
    trackStats: {}, // trackKey -> { id, title, artist, cover, seconds, plays, lastPlayed }
    history: []     // [{ id, title, artist, cover, playedAt, seconds }]
  };
}

let cachedStats = null;
let saveTimeout = null;
let lastServerSync = 0;
let pendingServerSeconds = 0;
let activeSessionTrack = null;
let activeSessionSeconds = 0;
let activeSessionPlayCounted = false;

export function getListeningStats() {
  if (cachedStats) return cachedStats;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const currentWeek = getISOWeekString();
      if (parsed.currentWeek !== currentWeek) {
        // New week: reset weekly counter, retain total and track history
        parsed.currentWeek = currentWeek;
        parsed.weeklySeconds = 0;
      }
      cachedStats = parsed;
      return cachedStats;
    }
  } catch (e) {
    console.warn('[ListeningTracker] Error loading stats:', e);
  }

  cachedStats = getDefaultStats();
  return cachedStats;
}

export function saveListeningStats(stats) {
  cachedStats = stats;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedStats));
      // Notify components about stats update
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('liofy:listening_stats_updated', { detail: cachedStats }));
      }
    } catch (e) {
      console.warn('[ListeningTracker] Error saving stats:', e);
    }
  }, 1000);
}

function getTrackKey(track) {
  if (!track) return 'unknown';
  return String(track.id || track._id || `${(track.title || '').trim()}___${(track.artist || '').trim()}`);
}

/**
 * Called when a new track begins playing
 */
export function onTrackStarted(track) {
  if (!track) return;
  const key = getTrackKey(track);
  if (activeSessionTrack && getTrackKey(activeSessionTrack) === key) {
    // Already active track
    return;
  }

  // End previous track session if any
  flushSessionToServer();

  activeSessionTrack = {
    id: key,
    title: track.title || 'Unknown Track',
    artist: track.artist || 'Unknown Artist',
    cover: track.cover || '',
    duration: track.duration || 180
  };
  activeSessionSeconds = 0;
  activeSessionPlayCounted = false;
}

/**
 * Called every second that audio is actively advancing and playing
 */
export function recordListeningTick(track, elapsedSeconds = 1) {
  if (!track || elapsedSeconds <= 0) return;
  const key = getTrackKey(track);
  if (!activeSessionTrack || getTrackKey(activeSessionTrack) !== key) {
    onTrackStarted(track);
  }

  const stats = getListeningStats();
  const currentWeek = getISOWeekString();
  if (stats.currentWeek !== currentWeek) {
    stats.currentWeek = currentWeek;
    stats.weeklySeconds = 0;
  }

  const sec = Math.min(5, Math.max(1, Math.round(elapsedSeconds)));
  stats.totalSeconds = (Number(stats.totalSeconds) || 0) + sec;
  stats.weeklySeconds = (Number(stats.weeklySeconds) || 0) + sec;
  activeSessionSeconds += sec;
  pendingServerSeconds += sec;

  if (!stats.trackStats[key]) {
    stats.trackStats[key] = {
      id: key,
      title: track.title || 'Unknown Track',
      artist: track.artist || 'Unknown Artist',
      cover: track.cover || '',
      seconds: 0,
      plays: 0,
      lastPlayed: Date.now()
    };
  }

  const tStat = stats.trackStats[key];
  tStat.seconds = (Number(tStat.seconds) || 0) + sec;
  tStat.lastPlayed = Date.now();
  if (track.title) tStat.title = track.title;
  if (track.artist) tStat.artist = track.artist;
  if (track.cover) tStat.cover = track.cover;

  // A play is officially counted when listened to for at least 15 seconds
  if (!activeSessionPlayCounted && activeSessionSeconds >= 15) {
    activeSessionPlayCounted = true;
    tStat.plays = (Number(tStat.plays) || 0) + 1;

    // Add to recent history
    if (!Array.isArray(stats.history)) stats.history = [];
    stats.history.unshift({
      id: key,
      title: tStat.title,
      artist: tStat.artist,
      cover: tStat.cover,
      playedAt: Date.now(),
      seconds: activeSessionSeconds
    });
    if (stats.history.length > 50) {
      stats.history = stats.history.slice(0, 50);
    }
  }

  saveListeningStats(stats);

  // Periodic server sync
  const now = Date.now();
  if (now - lastServerSync > SYNC_INTERVAL_MS) {
    flushSessionToServer();
  }
}

/**
 * Called when audio reaches the end of track
 */
export function onTrackEnded(track) {
  if (!track) return;
  const key = getTrackKey(track);
  const stats = getListeningStats();
  const tStat = stats.trackStats[key];

  if (!activeSessionPlayCounted && tStat) {
    activeSessionPlayCounted = true;
    tStat.plays = (Number(tStat.plays) || 0) + 1;
    saveListeningStats(stats);
  }

  flushSessionToServer(true);
}

/**
 * Flush accumulated seconds to server
 */
export async function flushSessionToServer(isEnd = false) {
  if (!activeSessionTrack || pendingServerSeconds <= 0) return;
  const secToSend = pendingServerSeconds;
  pendingServerSeconds = 0;
  lastServerSync = Date.now();

  try {
    const token = localStorage.getItem('liofy_token') || localStorage.getItem('token');
    const res = await fetch(`${API_BASE_URL}/api/stats/listen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        trackId: activeSessionTrack.id,
        title: activeSessionTrack.title,
        artist: activeSessionTrack.artist,
        cover: activeSessionTrack.cover,
        seconds: secToSend,
        isCompleted: isEnd || activeSessionPlayCounted
      })
    });
    if (!res.ok) {
      // Re-queue seconds if server failed
      pendingServerSeconds += secToSend;
    }
  } catch (err) {
    // Re-queue seconds for next sync
    pendingServerSeconds += secToSend;
  }

  if (isEnd) {
    activeSessionTrack = null;
    activeSessionSeconds = 0;
    activeSessionPlayCounted = false;
  }
}

/**
 * Returns the real top listened track for the current user
 */
export function getRealTopTrack(tracks = []) {
  const stats = getListeningStats();
  const trackEntries = Object.values(stats.trackStats || {});

  if (trackEntries.length > 0) {
    // Sort by seconds listened, then by verified plays
    trackEntries.sort((a, b) => {
      const secDiff = (Number(b.seconds) || 0) - (Number(a.seconds) || 0);
      if (secDiff !== 0) return secDiff;
      return (Number(b.plays) || 0) - (Number(a.plays) || 0);
    });

    const top = trackEntries[0];
    if (top && (top.seconds > 0 || top.plays > 0)) {
      return {
        id: top.id,
        title: top.title,
        artist: top.artist,
        cover: top.cover,
        plays: top.plays || (top.seconds >= 15 ? 1 : 0),
        seconds: top.seconds || 0
      };
    }
  }

  // Fallback to tracks prop if any track has recorded plays
  const played = (tracks || []).filter(t => (Number(t.plays) || 0) > 0);
  if (played.length > 0) {
    played.sort((a, b) => (Number(b.plays) || 0) - (Number(a.plays) || 0));
    return played[0];
  }

  return null;
}

/**
 * Formats seconds into human-readable stats (e.g., '18 MIN', '42 SEC', '2H 15M')
 */
export function formatListeningMinutes(totalSeconds) {
  const sec = Math.max(0, Number(totalSeconds) || 0);
  if (sec === 0) return '0 MIN';
  if (sec < 60) return `${sec} SEC`;
  const mins = Math.floor(sec / 60);
  if (mins < 60) return `${mins} MIN`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}H ${remMins}M` : `${hours}H`;
}
