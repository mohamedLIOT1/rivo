import { AppState } from 'react-native';
import { API_BASE_URL } from '../../config.js';

let activeSession = {
  token: null,
  track: null,
  trackId: null,
  title: '',
  artist: '',
  cover: '',
  isPlaying: false,
  pendingSeconds: 0,
  sessionTotalSeconds: 0,
  lastPos: 0,
  lastTickTime: 0,
  ticker: null,
};

let localMobileStats = {
  weeklySeconds: 0,
  totalSeconds: 0,
  trackStats: {},
};

export const getListeningStats = () => ({ ...localMobileStats });

export const getRealTopTrack = () => {
  const entries = Object.values(localMobileStats.trackStats || {});
  if (entries.length === 0) return null;
  entries.sort((a, b) => {
    const secDiff = (Number(b.seconds) || 0) - (Number(a.seconds) || 0);
    if (secDiff !== 0) return secDiff;
    return (Number(b.plays) || 0) - (Number(a.plays) || 0);
  });
  const top = entries[0];
  if (top && (top.seconds > 0 || top.plays > 0)) {
    return {
      id: top.id,
      title: top.title,
      artist: top.artist,
      cover: top.cover,
      plays: top.plays || (top.seconds >= 15 ? 1 : 0),
      seconds: top.seconds || 0,
    };
  }
  return null;
};

/**
 * Sends accrued listening duration to POST /api/stats/listen
 */
export const syncListeningProgress = async (
  activeToken,
  track,
  accruedSeconds = 0,
  isCompleted = false,
  clientTopTrack = null
) => {
  if (!track && !activeSession.track) return null;
  const targetTrack = track || activeSession.track;
  const tid = String(targetTrack._id || targetTrack.id || '');
  const title = targetTrack.title || '';
  const artist = targetTrack.artist || '';
  const cover = targetTrack.coverUrl || targetTrack.cover || '';
  const sec = Math.max(0, Math.min(300, Math.round(Number(accruedSeconds) || 0)));
  const token = activeToken || activeSession.token;

  // Update in-memory local mobile stats
  if (sec > 0) {
    localMobileStats.totalSeconds += sec;
    localMobileStats.weeklySeconds += sec;
    const trackKey = tid || `${title}___${artist}`;
    if (trackKey) {
      if (!localMobileStats.trackStats[trackKey]) {
        localMobileStats.trackStats[trackKey] = {
          id: tid,
          title,
          artist,
          cover,
          seconds: 0,
          plays: 0,
        };
      }
      localMobileStats.trackStats[trackKey].seconds += sec;
      if (isCompleted) {
        localMobileStats.trackStats[trackKey].plays += 1;
      }
    }
  }

  const computedTopTrack = clientTopTrack || getRealTopTrack();

  try {
    const res = await fetch(`${API_BASE_URL}/api/stats/listen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        token: token || undefined,
        trackId: tid,
        title,
        artist,
        cover,
        seconds: sec,
        isCompleted: Boolean(isCompleted),
        clientTopTrack: computedTopTrack,
      }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  return null;
};

export const flushListeningStats = async (activeToken = null, isCompleted = false) => {
  if (!activeSession.track || activeSession.pendingSeconds <= 0) {
    if (isCompleted && activeSession.track) {
      return syncListeningProgress(activeToken || activeSession.token, activeSession.track, 0, true);
    }
    return null;
  }
  const secToSend = activeSession.pendingSeconds;
  activeSession.pendingSeconds = 0;
  return syncListeningProgress(activeToken || activeSession.token, activeSession.track, secToSend, isCompleted);
};

export const recordListeningTick = (track, elapsedSeconds = 1, activeToken = null) => {
  if (!track) return;
  const tid = String(track._id || track.id || `${track.title}___${track.artist}`);
  if (activeSession.trackId && activeSession.trackId !== tid) {
    flushListeningStats(activeToken, false);
  }

  activeSession.track = track;
  activeSession.trackId = tid;
  if (activeToken) activeSession.token = activeToken;

  const sec = Math.max(1, Math.min(60, Math.round(Number(elapsedSeconds) || 1)));
  activeSession.pendingSeconds += sec;
  activeSession.sessionTotalSeconds += sec;

  // Flush periodically when >= 15 seconds accrued
  if (activeSession.pendingSeconds >= 15) {
    flushListeningStats(activeToken, false);
  }
};

const stopTicker = () => {
  if (activeSession.ticker) {
    clearInterval(activeSession.ticker);
    activeSession.ticker = null;
  }
};

const startTicker = () => {
  if (activeSession.ticker) return;
  activeSession.lastTickTime = Date.now();
  activeSession.ticker = setInterval(() => {
    if (!activeSession.isPlaying || !activeSession.track) {
      stopTicker();
      return;
    }
    const now = Date.now();
    const delta = Math.floor((now - activeSession.lastTickTime) / 1000);
    if (delta >= 1) {
      const sec = Math.min(30, delta);
      activeSession.lastTickTime = now;
      activeSession.pendingSeconds += sec;
      activeSession.sessionTotalSeconds += sec;

      if (activeSession.pendingSeconds >= 15) {
        flushListeningStats(activeSession.token, false);
      }
    }
  }, 1000);
};

// Auto-flush pending listening seconds when app is minimized or backgrounded
try {
  if (AppState && typeof AppState.addEventListener === 'function') {
    AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        flushListeningStats(activeSession.token, false);
      }
    });
  }
} catch {}

export const autoPersistFinishedTrack = async (track) => {
  if (!track || !track.title) return;
  const tid = String(track._id || track.id || '');

  // Flush accrued duration with completion status to stats engine
  flushListeningStats(activeSession.token, true);

  if (/^[a-f0-9]{24}$/i.test(tid) && track.source === 'Rivo' && !track.isExternal) return;

  try {
    await fetch(`${API_BASE_URL}/api/tracks/auto-persist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: tid,
        title: track.title,
        artist: track.artist,
        album: track.album,
        cover: track.cover || track.coverUrl,
        audioUrl: track.audioUrl || track.streamUrl,
        duration: track.duration,
        youtubeId: track.youtubeId,
        source: track.source || 'YouTube',
      }),
    });
  } catch {}
};

export const broadcastListeningActivity = (firstArg, secondArg, thirdArg, fourthArg = 0) => {
  let activeToken = null;
  let track = null;
  let playingState = false;
  let posSeconds = 0;

  if (typeof firstArg === 'string') {
    activeToken = firstArg;
    track = secondArg;
    playingState = Boolean(thirdArg);
    posSeconds = Number(fourthArg) || 0;
  } else {
    track = firstArg;
    playingState = Boolean(secondArg);
    posSeconds = Number(thirdArg) || 0;
    activeToken = activeSession.token || null;
  }

  const isPlaying = Boolean(playingState);
  const curPos = Math.max(0, Number(posSeconds) || 0);

  if (activeToken) {
    activeSession.token = activeToken;
  }

  // 1. Maintain real-time session tracking and stats accumulation
  if (track && track.title) {
    const tid = String(track._id || track.id || `${track.title}___${track.artist}`);
    if (activeSession.trackId && activeSession.trackId !== tid) {
      // Switched tracks: flush previous track stats
      flushListeningStats(activeToken, false);
      activeSession.sessionTotalSeconds = 0;
      activeSession.pendingSeconds = 0;
    }

    activeSession.track = track;
    activeSession.trackId = tid;
    activeSession.title = track.title || '';
    activeSession.artist = track.artist || '';
    activeSession.cover = track.coverUrl || track.cover || '';
    activeSession.isPlaying = isPlaying;
    activeSession.lastPos = curPos;

    if (isPlaying) {
      startTicker();
    } else {
      stopTicker();
      flushListeningStats(activeToken, false);
    }
  } else if (!isPlaying) {
    activeSession.isPlaying = false;
    stopTicker();
    flushListeningStats(activeToken, false);
  }

  // 2. Broadcast listening activity for friend radar
  if (!activeToken) return;

  const payload = {
    track: track ? {
      id: track._id || track.id,
      title: track.title,
      artist: track.artist,
      cover: track.coverUrl || track.cover,
      audioUrl: track.audioUrl,
      duration: track.duration,
    } : null,
    isPlaying,
    currentTime: curPos,
  };

  fetch(`${API_BASE_URL}/api/users/listening-activity`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${activeToken}`,
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
};
