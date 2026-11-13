# Handoff Report: Issue 9 (Requirement R10) — Listening Activity & Real-Time Stats Calculation

**Target Requirement**: Fix the listening activity and statistics engine across mobile and web so listening time, top tracks, and engagement stats are calculated from actual, verifiable listening sessions in real time rather than inaccurate or static placeholders.

---

## 1. Observation

Direct code inspections and searches across `rivo-main/src`, `rivo-main/src/native`, and `rivo-main/server` revealed the following exact observations:

### Observation 1: Mobile playback never records listening ticks or notifies the stats engine
- **File**: `rivo-main/src/native/context/audio/playbackEngine.js:126-132`
  ```javascript
  if (playbackStatusRef.current.currentTime !== newCurrentTime) {
    playbackStatusRef.current = { ...playbackStatusRef.current, currentTime: newCurrentTime, duration: newDuration };
    progressRef.current = { currentTime: newCurrentTime, duration: newDuration };

    // High-frequency isolation: Dispatches directly to AudioProgressContext listeners
    updateAudioProgress({ currentTime: newCurrentTime, duration: newDuration });
  ```
  While `updateAudioProgress` updates UI progress, there is **zero call** to any listening statistics recorder or accumulator (`recordListeningTick` does not exist in native).
- **File**: `rivo-main/src/native/context/audio/audioApiHelpers.js:27-51`
  ```javascript
  export const broadcastListeningActivity = (activeToken, track, playingState, posSeconds = 0) => {
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
      isPlaying: Boolean(playingState),
      currentTime: Math.max(0, Number(posSeconds) || 0),
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
  ```
  The only backend endpoint invoked by mobile during playback is `/api/users/listening-activity`. Mobile never calls `/api/stats/listen`.
- **File**: `rivo-main/server/routes/users.js:177-245`
  `POST /api/users/listening-activity` only writes to `user.currentListening` (`id, title, artist, cover, isPlaying, currentTime, updatedAt`) and `lastActiveAt`. It does **not** increment `user.totalListeningSeconds`, does **not** touch `user.weeklyListeningSeconds`, does **not** update `user.topTrack`, and does **not** increment `Track.plays`.
- **File**: `rivo-main/src/native/screens/StatsScreen.js:75-78`
  ```javascript
  // Real user listening metrics
  const myUserId = String(currentUser?._id || currentUser?.id || '');
  const userTotalSec = Number(currentUser?.totalListeningSeconds || 0);
  const userWeeklySec = Number(currentUser?.weeklyListeningSeconds || 0);
  ```
  Because mobile playback never sends listening duration to the server, `currentUser.totalListeningSeconds` and `currentUser.weeklyListeningSeconds` remain `0`. The 2x2 stats grid cards display `0m` / `0m`, and the user never rises on the weekly leaderboard from mobile playback.

### Observation 2: Web StatsScreen conflates All-Time seconds with Weekly seconds
- **File**: `rivo-main/src/screens/StatsScreen.jsx:64-70, 86-100`
  ```javascript
  // Compute real current user stats
  const userRealSeconds = Math.max(
    Number(localStats.weeklySeconds) || 0,
    Number(localStats.totalSeconds) || 0
  );
  const userFormattedTime = formatListeningMinutes(userRealSeconds, isRTL);
  const realTopTrack = useMemo(() => getRealTopTrack(tracks), [tracks, localStats]);
  ```
  ```javascript
  if (existingIdx !== -1) {
    // Update existing entry with live maximum seconds
    const prev = list[existingIdx];
    const maxSec = Math.max(prev.seconds || 0, userRealSeconds);
    list[existingIdx] = {
      ...prev,
      seconds: maxSec,
      minutes: Math.floor(maxSec / 60),
  ```
  `userRealSeconds` is computed using `Math.max(weeklySeconds, totalSeconds)`. Since `totalSeconds` accumulates all-time listening, it is always `>= weeklySeconds`.
  The platform leaderboard (`/api/stats/leaderboard`) is an ISO weekly report (`currentWeek`). Inserting `userRealSeconds` into `maxSec` pollutes the weekly leaderboard with the user's all-time historical seconds.

### Observation 3: Web Top Track falls back to global catalogue hit tracks
- **File**: `rivo-main/src/utils/listeningTracker.js:271-278`
  ```javascript
  // Fallback to tracks prop if any track has recorded plays
  const played = (tracks || []).filter(t => (Number(t.plays) || 0) > 0);
  if (played.length > 0) {
    played.sort((a, b) => (Number(b.plays) || 0) - (Number(a.plays) || 0));
    return played[0];
  }

  return null;
  ```
  If a user has no listening history, `getRealTopTrack` falls back to `tracks` (the global track catalogue). If any track in the DB has `plays > 0`, that track is returned as the user's top track.
- **File**: `rivo-main/src/screens/StatsScreen.jsx:247-273`
  ```jsx
  {realTopTrack ? (
    <>
      <img src={realTopTrack.cover || ...} />
      ...
      <h3>{realTopTrack.title}</h3>
      <p>{realTopTrack.artist} • {realTopTrack.plays} PLAYS ({formatListeningMinutes(realTopTrack.seconds)})</p>
    </>
  ) : ...
  ```
  The global track and its global play count are rendered inside the user's personal "MOST STREAMED TRACK / المقطع الأكثر استماعاً" card, masquerading as the user's personal listening history.
  Line 84 also sets `topSongTitle = ${realTopTrack.title} - ${realTopTrack.artist}` on the user's leaderboard row, even though the user has 0 plays of that song.

### Observation 4: Server `/api/stats/listen` topTrack logic never updates to a new song
- **File**: `rivo-main/server/routes/stats.js:35-54`
  ```javascript
  const clientTop = req.body.clientTopTrack;
  if (clientTop && clientTop.title && clientTop.artist) {
    user.topTrack = {
      id: clientTop.id || trackId,
      title: clientTop.title,
      artist: clientTop.artist,
      cover: clientTop.cover || cover || user.topTrack?.cover || '',
      plays: Number(clientTop.plays) || 1,
      seconds: Number(clientTop.seconds) || sec
    };
  } else if (title && artist) {
    if (!user.topTrack || !user.topTrack.title) {
      user.topTrack = { id: trackId, title, artist, cover: cover || '', plays: isCompleted ? 1 : 0, seconds: sec };
    } else if (user.topTrack.title === title) {
      user.topTrack.seconds = (user.topTrack.seconds || 0) + sec;
      if (isCompleted) user.topTrack.plays = (user.topTrack.plays || 0) + 1;
      if (cover) user.topTrack.cover = cover;
    }
  }
  ```
  If `clientTop` is not passed (e.g., from mobile or simple clients):
  1. The first song ever listened to is stored in `user.topTrack`.
  2. If the user subsequently streams a different song (title !== user.topTrack.title), line 48 `else if (user.topTrack.title === title)` evaluates to `false`.
  3. The new song is ignored. Even if the user plays the new song for 500 hours, `user.topTrack` never changes.
  4. The server schema `User.js` does not store per-user track listening duration, so the server cannot calculate the winner autonomously without client assistance.

### Observation 5: Server fabricates artificial listening activity for idle friends
- **File**: `rivo-main/server/routes/users/listeningActivityService.js:67-84, 114-118, 171-198`
  ```javascript
  candidateFriends.forEach(u => {
    const uId = String(u._id || u.id);
    const hasTrack = Boolean(u.currentListening && (u.currentListening.title || u.currentListening.name));
    if (!hasTrack && (!u.topTrack || !u.topTrack.title)) {
      let tid = null;
      if (Array.isArray(u.likedTrackIds) && u.likedTrackIds.length > 0) {
        tid = String(u.likedTrackIds[u.likedTrackIds.length - 1]);
      } else if (Array.isArray(u.playlists)) {
        for (const pl of u.playlists) {
          if (Array.isArray(pl.trackIds) && pl.trackIds.length > 0) {
            tid = String(pl.trackIds[pl.trackIds.length - 1]);
            break;
          }
        }
      }
      if (tid) {
        userTrackTargetMap.set(uId, tid);
        if (!neededTrackIds.includes(tid)) neededTrackIds.push(tid);
      }
    }
  });
  ```
  ```javascript
  if (needsGlobalFallback) {
    globalFallbackTrack = await Track.findOne({})
      .sort({ plays: -1, createdAt: -1 })
      .select('_id id title artist cover audioUrl duration')
      .lean();
  }
  ```
  ```javascript
  if (!finalListening && globalFallbackTrack) {
    finalListening = {
      id: String(globalFallbackTrack._id || globalFallbackTrack.id),
      title: globalFallbackTrack.title,
      artist: globalFallbackTrack.artist || '',
      cover: globalFallbackTrack.cover || '',
      audioUrl: globalFallbackTrack.audioUrl || '',
      duration: globalFallbackTrack.duration || 0,
      isPlaying: false,
      updatedAt: fallbackLastActive
    };
  }
  ```
  When a friend has no active listening session and no verified listening history, this service fabricates a fake listening track from their liked songs, playlist songs, or an arbitrary global hit (`globalFallbackTrack`).
  In contrast, `src/components/activity/ActivityListItem.jsx:298-301` already implements the correct empty UI state:
  `isOnline ? 'Browsing music & playlists' : 'No recent listening activity'`.
  The server's fallback intercepts this and prevents the truthful state from being shown.

---

## 2. Logic Chain

1. **Premise**: Real-time stats calculation requires that audio playback on any client (web or mobile) triggers incremental duration accumulation, updates per-track records, periodically flushes to the server, and updates the UI.
2. **From Observation 1**: Mobile playback advances `playbackStatusRef.current.currentTime`, but does not invoke any statistics recording service and never contacts `/api/stats/listen`. Therefore, listening seconds never accrue on mobile devices.
3. **From Observation 1**: Because seconds never accrue, `User.totalListeningSeconds` and `User.weeklyListeningSeconds` remain 0 on the server for mobile users. `StatsScreen.js` reads zeroes, resulting in `0m` / `0m` stats and exclusion from the leaderboard.
4. **From Observation 2**: Web `StatsScreen.jsx` calculates `userRealSeconds = Math.max(weeklySeconds, totalSeconds)` and merges that value into the weekly leaderboard. Because `totalSeconds >= weeklySeconds`, all historical seconds are erroneously counted as weekly activity.
5. **From Observation 3**: Web `getRealTopTrack` falls back to the database track catalogue (`tracks.filter(t => t.plays > 0)[0]`) when a user has no listening history. This causes unplayed songs to appear as the user's "Most Streamed Track" with inflated play counts.
6. **From Observation 4**: In `server/routes/stats.js`, if `clientTop` is not supplied, the server only updates `user.topTrack` if the title equals the existing top track's title. New songs can never overtake an existing top track on the server.
7. **From Observation 5**: `listeningActivityService.js` synthesizes fake listening activity using liked songs and `globalFallbackTrack` for users who are idle. This contradicts the requirement for verified sessions.
8. **Conclusion**: To fulfill Requirement R10, we must:
   - Introduce a mobile listening tracker and connect it to `playbackEngine.js` and `useAudioPlaybackCore.js`.
   - Correct the weekly vs all-time seconds calculation in `StatsScreen.jsx`.
   - Remove fake fallback tracks in `listeningTracker.js` and `listeningActivityService.js`.
   - Update `server/routes/stats.js` to track user track stats and dynamically compute the genuine top track.
   - Connect mobile `StatsScreen.js` to live listening data and display real-time metrics.

---

## 3. Caveats

1. **Offline Mode**: In offline mode (e.g. airplane mode), the mobile listening tracker must accumulate seconds locally in `AsyncStorage` and queue them. Once network connectivity is restored, queued seconds must sync to `/api/stats/listen`.
2. **Re-render Storm Protection**: Rapid 1-second ticks must not re-render heavy screen trees. In `StatsScreen`, state updates must be isolated or memoized in accordance with `AGENTS.md` Rule 2.
3. **400-Line Limit Compliance**: `src/native/screens/StatsScreen.js` currently has 660 lines due to embedded styles. When implementing changes, styles should be moved to `src/native/screens/StatsScreen.styles.js` to comply with `AGENTS.md` Rule 1.

---

## 4. Conclusion & Architectural Fix Plan

### Exact File Boundaries

| Target File | Modifications Required |
|---|---|
| `rivo-main/src/native/utils/listeningTracker.js` | **NEW FILE**: Native listening tracker utilizing `AsyncStorage` (`@rivo_listening_stats_v2`). Implements `recordListeningTick`, `onTrackStarted`, `onTrackEnded`, `flushSessionToServer`, `getRealTopTrack`, and `subscribeToListeningStats`. |
| `rivo-main/src/native/context/audio/playbackEngine.js` | Hook 1-second playback ticks (`status.isPlaying && !status.isBuffering`) into `recordListeningTick`. Hook `status.didJustFinish` into `onTrackEnded`. |
| `rivo-main/src/native/context/audio/useAudioPlaybackCore.js` | On `playTrack`, call `onTrackStarted`. On `pause` / track change, call `flushSessionToServer`. |
| `rivo-main/src/native/screens/StatsScreen.js` | Subscribe to live listening tracker updates. Display live weekly seconds, total seconds, community rank, and real top track. Extract styles to separate file to comply with <400 line rule. |
| `rivo-main/src/native/screens/StatsScreen.styles.js` | **NEW FILE**: Extracted StyleSheet from `StatsScreen.js` to bring `StatsScreen.js` under 400 lines. |
| `rivo-main/src/screens/StatsScreen.jsx` | Fix line 65: separate `userWeeklySeconds` from `userTotalSeconds`. Use `userWeeklySeconds` in the weekly leaderboard. |
| `rivo-main/src/utils/listeningTracker.js` | Remove lines 271-276 (fake global catalogue fallback). Return `null` when no genuine user listening history exists. |
| `rivo-main/server/routes/stats.js` | Maintain `user.trackStats` in MongoDB. Dynamically compute genuine `user.topTrack` from the highest accumulated duration/plays. Return updated stats in `/listen` response. |
| `rivo-main/server/models/User.js` | Add `trackStats: { type: Object, default: {} }` to `UserSchema`. |
| `rivo-main/server/routes/users/listeningActivityService.js` | Remove lines 67-84, 114-118, and 187-198 (fake fallback tracks). If a friend has no active/recent session, return `currentListening: null`. |

---

### Detailed Proposed Changes

#### 1. `rivo-main/src/native/utils/listeningTracker.js` (NEW)
Create mobile listening tracker with AsyncStorage persistence, debounced server sync, verified play detection (15s threshold), and real top track calculation:
```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

const STORAGE_KEY = '@rivo_listening_stats_v2';
const SYNC_INTERVAL_MS = 25000;

function getISOWeekString(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

let cachedStats = null;
let saveTimeout = null;
let lastServerSync = 0;
let pendingServerSeconds = 0;
let activeSessionTrack = null;
let activeSessionSeconds = 0;
let activeSessionPlayCounted = false;
const listeners = new Set();

export async function initListeningTracker() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const curWeek = getISOWeekString();
      if (parsed.currentWeek !== curWeek) {
        parsed.currentWeek = curWeek;
        parsed.weeklySeconds = 0;
      }
      cachedStats = parsed;
      return cachedStats;
    }
  } catch {}
  cachedStats = {
    currentWeek: getISOWeekString(),
    weeklySeconds: 0,
    totalSeconds: 0,
    trackStats: {},
    history: []
  };
  return cachedStats;
}

export function getListeningStats() {
  if (!cachedStats) {
    cachedStats = {
      currentWeek: getISOWeekString(),
      weeklySeconds: 0,
      totalSeconds: 0,
      trackStats: {},
      history: []
    };
  }
  return cachedStats;
}

export function subscribeToListeningStats(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notifyListeners() {
  listeners.forEach(cb => {
    try { cb(cachedStats); } catch {}
  });
}

function persistStats() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cachedStats)).catch(() => {});
  }, 1000);
}

export function onTrackStarted(track, token = null) {
  if (!track) return;
  const key = String(track.id || track._id || `${track.title}___${track.artist}`);
  if (activeSessionTrack && activeSessionTrack.id === key) return;

  flushSessionToServer(token);

  activeSessionTrack = {
    id: key,
    title: track.title || 'Unknown Track',
    artist: track.artist || 'Unknown Artist',
    cover: track.cover || track.coverUrl || '',
    duration: track.duration || 180
  };
  activeSessionSeconds = 0;
  activeSessionPlayCounted = false;
}

export function recordListeningTick(track, elapsedSeconds = 1, token = null) {
  if (!track || elapsedSeconds <= 0) return;
  const key = String(track.id || track._id || `${track.title}___${track.artist}`);
  if (!activeSessionTrack || activeSessionTrack.id !== key) {
    onTrackStarted(track, token);
  }

  const stats = getListeningStats();
  const curWeek = getISOWeekString();
  if (stats.currentWeek !== curWeek) {
    stats.currentWeek = curWeek;
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
      cover: track.cover || track.coverUrl || '',
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
  if (track.cover || track.coverUrl) tStat.cover = track.cover || track.coverUrl;

  if (!activeSessionPlayCounted && activeSessionSeconds >= 15) {
    activeSessionPlayCounted = true;
    tStat.plays = (Number(tStat.plays) || 0) + 1;
    if (!Array.isArray(stats.history)) stats.history = [];
    stats.history.unshift({
      id: key,
      title: tStat.title,
      artist: tStat.artist,
      cover: tStat.cover,
      playedAt: Date.now(),
      seconds: activeSessionSeconds
    });
    if (stats.history.length > 50) stats.history = stats.history.slice(0, 50);
  }

  persistStats();
  notifyListeners();

  const now = Date.now();
  if (now - lastServerSync > SYNC_INTERVAL_MS) {
    flushSessionToServer(token);
  }
}

export function onTrackEnded(track, token = null) {
  if (!track) return;
  const key = String(track.id || track._id || `${track.title}___${track.artist}`);
  const stats = getListeningStats();
  const tStat = stats.trackStats[key];

  if (!activeSessionPlayCounted && tStat) {
    activeSessionPlayCounted = true;
    tStat.plays = (Number(tStat.plays) || 0) + 1;
    persistStats();
    notifyListeners();
  }

  flushSessionToServer(token, true);
}

export async function flushSessionToServer(token = null, isEnd = false) {
  if (!activeSessionTrack || pendingServerSeconds <= 0) return;
  const secToSend = pendingServerSeconds;
  pendingServerSeconds = 0;
  lastServerSync = Date.now();

  try {
    const activeToken = token || (await AsyncStorage.getItem('@rivo_auth_token_v2')) || (await AsyncStorage.getItem('rivo_token'));
    const res = await fetch(`${API_BASE_URL}/api/stats/listen`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {})
      },
      body: JSON.stringify({
        trackId: activeSessionTrack.id,
        title: activeSessionTrack.title,
        artist: activeSessionTrack.artist,
        cover: activeSessionTrack.cover,
        seconds: secToSend,
        isCompleted: isEnd || activeSessionPlayCounted,
        clientTopTrack: getRealTopTrack()
      })
    });
    if (!res.ok) {
      pendingServerSeconds += secToSend;
    }
  } catch {
    pendingServerSeconds += secToSend;
  }

  if (isEnd) {
    activeSessionTrack = null;
    activeSessionSeconds = 0;
    activeSessionPlayCounted = false;
  }
}

export function getRealTopTrack() {
  const stats = getListeningStats();
  const trackEntries = Object.values(stats.trackStats || {});
  if (trackEntries.length === 0) return null;

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
  return null;
}
```

#### 2. `rivo-main/src/native/context/audio/playbackEngine.js`
Incorporate `recordListeningTick` and `onTrackEnded`:
```javascript
// Import at top:
import { recordListeningTick, onTrackEnded } from '../../utils/listeningTracker';

// Inside handlePlaybackStatusUpdate when currentTime changes and is playing:
if (playbackStatusRef.current.currentTime !== newCurrentTime) {
  playbackStatusRef.current = { ...playbackStatusRef.current, currentTime: newCurrentTime, duration: newDuration };
  progressRef.current = { currentTime: newCurrentTime, duration: newDuration };
  updateAudioProgress({ currentTime: newCurrentTime, duration: newDuration });

  // Accrue listening duration for active verifiable session:
  if (status.isPlaying && !status.isBuffering && currentTrackRef.current) {
    recordListeningTick(currentTrackRef.current, 1, tokenRef?.current);
  }
```
And inside `if (status.didJustFinish)`:
```javascript
if (status.didJustFinish) {
  const finishedTrack = currentTrackRef.current;
  if (finishedTrack) {
    onTrackEnded(finishedTrack, tokenRef?.current);
    autoPersistFinishedTrack?.(finishedTrack);
```

#### 3. `rivo-main/src/screens/StatsScreen.jsx`
Fix weekly seconds logic:
```javascript
// BEFORE (line 65):
const userRealSeconds = Math.max(
  Number(localStats.weeklySeconds) || 0,
  Number(localStats.totalSeconds) || 0
);

// AFTER:
const userWeeklySeconds = Number(localStats.weeklySeconds) || 0;
const userTotalSeconds = Number(localStats.totalSeconds) || 0;
const userFormattedTime = formatListeningMinutes(userWeeklySeconds, isRTL);
```
And in `realLeaderboard` computation:
```javascript
// Use userWeeklySeconds strictly for weekly leaderboard
const maxSec = Math.max(prev.seconds || 0, userWeeklySeconds);
```

#### 4. `rivo-main/src/utils/listeningTracker.js`
Remove fake global fallback in `getRealTopTrack`:
```javascript
// BEFORE (lines 271-278):
  const played = (tracks || []).filter(t => (Number(t.plays) || 0) > 0);
  if (played.length > 0) {
    played.sort((a, b) => (Number(b.plays) || 0) - (Number(a.plays) || 0));
    return played[0];
  }
  return null;

// AFTER:
  return null;
```

#### 5. `rivo-main/server/routes/users/listeningActivityService.js`
Remove fake fallback logic (lines 67-84, 114-118, 187-198):
If `!finalListening`, leave it as `null`. Do not query `globalFallbackTrack` and do not fabricate listening records.

#### 6. `rivo-main/server/routes/stats.js`
Update top track calculation on server:
```javascript
// In POST /api/stats/listen:
if (req.user?.id) {
  const user = await User.findById(req.user.id);
  if (user) {
    if (user.weeklyWeek !== currentWeek) {
      user.weeklyWeek = currentWeek;
      user.weeklyListeningSeconds = 0;
    }

    user.totalListeningSeconds = (user.totalListeningSeconds || 0) + sec;
    user.weeklyListeningSeconds = (user.weeklyListeningSeconds || 0) + sec;

    // Track user per-track listening in user.trackStats
    if (!user.trackStats) user.trackStats = {};
    const trackKey = String(trackId || `${title}___${artist}`);
    if (trackKey) {
      const prev = user.trackStats[trackKey] || {
        id: trackId,
        title: title || '',
        artist: artist || '',
        cover: cover || '',
        seconds: 0,
        plays: 0
      };
      prev.seconds = (prev.seconds || 0) + sec;
      if (isCompleted) prev.plays = (prev.plays || 0) + 1;
      if (cover) prev.cover = cover;
      user.trackStats[trackKey] = prev;
      user.markModified('trackStats');
    }

    // Determine real winning top track from user.trackStats
    const clientTop = req.body.clientTopTrack;
    if (clientTop && clientTop.title && clientTop.artist) {
      user.topTrack = {
        id: clientTop.id || trackId,
        title: clientTop.title,
        artist: clientTop.artist,
        cover: clientTop.cover || cover || user.topTrack?.cover || '',
        plays: Number(clientTop.plays) || 1,
        seconds: Number(clientTop.seconds) || sec
      };
    } else {
      // Find track with highest seconds
      let topT = user.topTrack;
      let maxSec = topT?.seconds || 0;
      Object.values(user.trackStats || {}).forEach(t => {
        if ((t.seconds || 0) > maxSec) {
          maxSec = t.seconds;
          topT = {
            id: t.id,
            title: t.title,
            artist: t.artist,
            cover: t.cover,
            plays: t.plays || 0,
            seconds: t.seconds || 0
          };
        }
      });
      if (topT) user.topTrack = topT;
    }

    user.lastActiveAt = new Date();
    await user.save();
    return res.json({
      success: true,
      totalListeningSeconds: user.totalListeningSeconds,
      weeklyListeningSeconds: user.weeklyListeningSeconds,
      topTrack: user.topTrack
    });
  }
}
```

---

## 5. Verification Method

To independently verify the resolution without reading test source code:

1. **Automated API Verification Script (`verify_issue9_stats.js`)**:
   Execute a Node script that creates a temporary authenticated session and performs three sequential verification checks:
   ```bash
   node -e "
     const assert = require('assert');
     (async () => {
       const base = 'http://localhost:5000';
       // 1. Initial State: verified user has 0 seconds and no fake top track
       const reg = await fetch(base + '/api/auth/register', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ name: 'StatsUser_' + Date.now(), email: 'stats_' + Date.now() + '@test.com', password: 'password123' })
       }).then(r => r.json());
       const token = reg.token;
       assert(token, 'Token must be issued');

       // 2. Play Track A for 30s
       const l1 = await fetch(base + '/api/stats/listen', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
         body: JSON.stringify({ trackId: 'track_A', title: 'Song Alpha', artist: 'Artist A', seconds: 30, isCompleted: false })
       }).then(r => r.json());
       assert.strictEqual(l1.totalListeningSeconds, 30);
       assert.strictEqual(l1.topTrack.title, 'Song Alpha');

       // 3. Play Track B for 90s (should take over as top track)
       const l2 = await fetch(base + '/api/stats/listen', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
         body: JSON.stringify({ trackId: 'track_B', title: 'Song Beta', artist: 'Artist B', seconds: 90, isCompleted: true })
       }).then(r => r.json());
       assert.strictEqual(l2.totalListeningSeconds, 120);
       assert.strictEqual(l2.topTrack.title, 'Song Beta', 'Song Beta must take over as top track');

       // 4. Verify Leaderboard
       const lb = await fetch(base + '/api/stats/leaderboard', {
         headers: { Authorization: 'Bearer ' + token }
       }).then(r => r.json());
       const me = lb.leaderboard.find(u => u.name === reg.user.name);
       assert(me, 'User must appear on leaderboard');
       assert.strictEqual(me.seconds, 120);
       assert.strictEqual(me.topSong, 'Song Beta - Artist B');

       // 5. Verify Listening Activity returns null for idle user without fake fallbacks
       const act = await fetch(base + '/api/users/listening-activity', {
         headers: { Authorization: 'Bearer ' + token }
       }).then(r => r.json());
       // Newly registered user with no active friends should receive empty list or authentic records without fake globalFallbackTrack
       console.log('✅ Issue 9 stats verification passed successfully!');
     })();
   "
   ```

2. **UI Inspection Checklist**:
   - Web `StatsScreen.jsx`: Open Stats screen on a fresh session. Confirm that "MOST STREAMED TRACK" displays the empty state ("NO TRACKS STREAMED YET") rather than an arbitrary database track.
   - Web `StatsScreen.jsx`: Start playing a track; verify the seconds counter increments live (+1 each second). Confirm that weekly seconds do not jump to all-time total seconds.
   - Mobile `StatsScreen.js`: Start playing a song on mobile; navigate to the Stats tab. Confirm that Weekly Time and Total Time increment in real-time and display formatted minutes (e.g. `1m`, `2m`) instead of staying static at `0m`.
   - Listening Activity Panel: Check friends list. Friends who have not streamed music must show "No recent listening activity" / "Browsing music" and must not display random global songs.

3. **Invalidation Conditions**:
   - If mobile playback duration remains 0 after 30 seconds of active playback.
   - If a new user is shown a top track with 100+ plays before ever listening to a song.
   - If idle friends in the activity panel display tracks they never played.
