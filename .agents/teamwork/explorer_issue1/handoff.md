# Issue 1 (Requirement R2) Investigation Report: AI Recommendations Refresh and Performance

## 1. Observation

Direct observations from the codebase investigation:

### A. Server Recommendations Route & Service
1. **`server/routes/ai.js` (lines 11–37)**:
   ```javascript
   router.post('/recommendations', optionalAuth, async (req, res) => {
     try {
       const { 
         mood, 
         timeOfDay, 
         recentTracks = [], 
         seedTracks = [], 
         availableTracks = [], 
         isQuran = false, 
         name = '', 
         playlistName = '', 
         trackIds = [] 
       } = req.body || {};
       ...
       const finalRecs = await getCuratedRecommendations({
         mood,
         timeOfDay,
         recentTracks,
         seedTracks,
         availableTracks,
         isQuran: isPlQuran,
         effectiveName,
         trackIds
       });
   ```
   **Finding**: The route does not extract `excludeTrackIds` or `refresh` from `req.body`, nor does it forward them to `getCuratedRecommendations`.

2. **`server/routes/ai/recommendationService.js` (lines 35–88)**:
   ```javascript
   let pool = availableTracks;
   if (!pool || pool.length === 0) {
     if (isPlQuran) {
       pool = await Track.find({ ... }).sort({ plays: -1 }).limit(200).lean();
     } else {
       pool = await Track.find({ ... }).sort({ plays: -1 }).limit(200).lean();
     }
   }
   const filteredPool = pool.filter(t => {
     if (excludedIds.has(String(t._id || t.id))) return false;
     const q = isQuranTrack(t);
     return isPlQuran ? q : !q;
   });
   ...
   const trackList = filteredPool.slice(0, 50).map(t => `"${t.title}" by ${t.artist}`).join(', ');
   ```
   **Finding**: `pool` is strictly ordered by `{ plays: -1 }`. `trackList` passed to Gemini is always the first 50 elements (`slice(0, 50)`). Without random exploration, temperature adjustment, or excluding prior recommendations, the model prompt is deterministic and returns the exact same recommendations.

3. **`server/routes/ai/recommendationService.js` (lines 90–106)**:
   ```javascript
   if (finalRecs.length === 0) {
     const seedArtists = new Set();
     rawSeeds.forEach(t => {
       if (typeof t === 'object' && t.artist) seedArtists.add(getPrimaryArtistNormalized(t.artist));
     });

     const scoredPool = filteredPool.map(t => {
       let score = Math.random() * 15;
       const art = getPrimaryArtistNormalized(t.artist);
       if (seedArtists.has(art)) score += 30;
       score += Math.min(20, Math.log10((Number(t.plays) || 0) + 1) * 5);
       return { track: t, score };
     });

     scoredPool.sort((a, b) => b.score - a.score);
     finalRecs = capTracksByArtist(scoredPool.map(s => s.track), 10, 2);
   }
   ```
   **Finding**: In the non-Gemini fallback algorithm, artist match grants +30 and play count grants up to +20. The random component is only 0–15. Thus, high-play tracks from seed artists will always score ~50–65, completely outscoring all other tracks (which score 0–35). Because `capTracksByArtist` selects greedily from the top of the sorted list, the exact same tracks are returned every single time.

### B. Client Recommendation Refresh Calling Logic
4. **`src/screens/PlaylistScreen.jsx` (lines 685–713)**:
   ```javascript
   const handleFetchAiRecommendations = async () => {
     if (isLoadingRecs) return;
     setIsLoadingRecs(true);
     try {
       const res = await fetch(`${API_BASE_URL}/api/ai/recommendations`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           playlistName: playlist?.name || 'Playlist',
           seedTracks: playlistTracks.slice(0, 6)
         })
       });
       const data = await res.json();
       if (data.success && Array.isArray(data.recommendations) && data.recommendations.length > 0) {
         const markedRecs = data.recommendations.map(t => ({
           ...t,
           isAiSuggestion: true
         }));
         setAiRecommendations(markedRecs);
         // Automatically add the recommendations to active playback queue
         if (setCurrentQueue) {
           setCurrentQueue(prev => {
             const currentList = Array.isArray(prev) ? prev : [];
             const existingIds = new Set(currentList.map(t => String(t.id || t._id)));
             const newRecs = markedRecs.filter(t => !existingIds.has(String(t.id || t._id)));
             return [...currentList, ...newRecs];
           });
         }
       }
   ```
   **Finding**:
   - `handleFetchAiRecommendations` only sends the first 6 tracks of `playlistTracks` as `seedTracks`. It does NOT send `trackIds` (leaving tracks 7+ and added tracks unprotected from being recommended).
   - It does NOT send `excludeTrackIds` or the existing `aiRecommendations`.
   - It does NOT pass `isQuran`.
   - Lines 705–712: It silently injects all recommendations into the active audio playback queue (`setCurrentQueue`), polluting playback and causing audio context re-renders whenever recommendations are fetched or refreshed.
   - Lines 774–776, 814, 836: When playing a track from the playlist, it appends all `aiRecommendations` to the playback queue!

5. **`src/native/screens/LibraryScreen.js` (lines 476–500)**:
   ```javascript
   const plId = String(selectedView.id || selectedView._id || '');
   const currentPl = (playlists || []).find(p => String(p.id || p._id) === plId) || selectedView;
   const tIds = (currentPl.tracks || currentPl.trackIds || []).map(t => typeof t === 'object' ? (t._id || t.id) : t);
   const res = await fetch(`${API_BASE_URL}/api/ai/recommendations`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
     body: JSON.stringify({
       playlistId: plId,
       trackIds: tIds,
       name: currentPl.name,
       isQuran: isSelectedPlQuran,
     }),
   });
   ```
   **Finding**: `LibraryScreen.js` sends `trackIds: tIds` but does NOT send `excludeTrackIds`, seed tracks, or a refresh flag. When the server returns the same static recommendations, `filteredRecs` is set to the same static array.

### C. Track Addition Flow Bottlenecks & Hangs
6. **`src/native/context/UserContext.js` (lines 335–343)**:
   ```javascript
   const addToPlaylist = async (playlistId, trackId) => {
     if (!token) return;
     const res = await fetch(`${API_BASE_URL}/api/playlists/${playlistId}/add-track`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
       body: JSON.stringify({ trackId }),
     });
     if (res.ok) await syncUserData();
   };
   ```
   **Finding**:
   - Unlike `removeTrackFromPlaylist` (which immediately performs an optimistic `setPlaylists` update), `addToPlaylist` has zero optimistic update.
   - It blocks on a sequential network waterfall: first POST `/api/playlists/:id/add-track`, then `await syncUserData()`.
   - `syncUserData()` calls GET `/api/auth/me`, re-fetches the entire user document, calls `setCurrentUser(data.user)` and `setPlaylists(normalized)`.
   - `syncUserData()` synchronously executes `AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user))` and `AsyncStorage.setItem(CACHE_PLAYLISTS_KEY, JSON.stringify(normalized))` without debouncing, writing multi-megabyte JSON strings to disk on the main JS thread during real-time song addition.
   - Updating `currentUser` triggers re-render storms across virtually every screen and component in the app that consumes `useUser()`.

7. **`src/native/screens/LibraryScreen.js` (lines 525–536)**:
   ```javascript
   const handleQuickAddTrack = async (track) => {
     if (!selectedView || selectedView === 'liked' || !track) return;
     const plId = String(selectedView.id || selectedView._id || '');
     const tId = String(track._id || track.id);
     setJustAddedSongId(tId);
     if (addToPlaylist) {
       await addToPlaylist(plId, tId);
     }
     showToast(`Added "${track.title}" to crate! ✨`, 'success');
     setAiRecommendations(prev => prev.filter(r => String(r._id || r.id) !== tId));
     setTimeout(() => setJustAddedSongId(null), 1200);
   };
   ```
   **Finding**:
   - `handleQuickAddTrack` awaits `await addToPlaylist(plId, tId)`.
   - Because `addToPlaylist` executes a 2-request waterfall and disk serialization, the function is paused for 1–3+ seconds.
   - During this time, `showToast` is NOT shown, `setAiRecommendations` is NOT called (the track remains visible), and the UI is locked up.
   - If the user taps multiple recommended tracks in succession, multiple concurrent `syncUserData` calls and AsyncStorage writes fire in parallel, causing thread contention, lag, and UI lockup.

8. **`src/screens/PlaylistScreen.jsx` (lines 213–222 & 1772–1780)**:
   ```javascript
   const handleAddTrackWithCheck = (trackToAdd) => {
     if (!trackToAdd) return;
     const trackIdStr = String(trackToAdd.id || trackToAdd._id);
     const alreadyInPlaylist = (playlist?.trackIds || []).map(String).includes(trackIdStr);
     if (alreadyInPlaylist) {
       setDuplicateConfirmTrack(trackToAdd);
     } else {
       onAddTrackToPlaylist(trackIdStr, playlist.id || playlist._id, false);
     }
   };
   ```
   **Finding**:
   - When a recommended track is added, `handleAddTrackWithCheck` does NOT remove it from `aiRecommendations`!
   - The track remains in the AI recommendations box. If the user clicks it again, `alreadyInPlaylist` triggers the duplicate modal.
   - Furthermore, `remotePlaylist.tracks` in `PlaylistScreen.jsx` is not updated, causing state desynchronization between `initialPlaylist` and `remotePlaylist`.

9. **`src/App.jsx` (lines 323–345)**:
   ```javascript
   const handleAddTrackToPlaylist = async (trackId, playlistId, allowDuplicate = false) => {
     const cleanTrackId = String(trackId);
     const cleanPlId = String(playlistId);
     ...
     const newTrack = (tracks || []).find(t => String(t.id || t._id) === cleanTrackId);
     if (newTrack && addToQueue) {
       addToQueue(newTrack);
     }
     try {
       await dataService.addTrackToPlaylist(cleanPlId, cleanTrackId, allowDuplicate);
     } catch {}
   };
   ```
   **Finding**: Adding a track to a playlist erroneously calls `addToQueue(newTrack)`, silently adding every added song into the user's active playback queue, which triggers unwanted player re-renders and queue changes.

---

## 2. Logic Chain

1. **Why Recommendations Remain Static**:
   - From Observations 1 & 2: When the user requests recommendations or clicks "Refresh Recommendations", the server queries the database sorted strictly by `{ plays: -1 }` and takes `slice(0, 50)`.
   - From Observation 3: In the fallback scoring algorithm, the weights for `seedArtists` (+30) and `plays` (+20) dominate over random noise (+15). The same songs will always have the highest scores.
   - From Observations 1, 4 & 5: Neither web (`PlaylistScreen.jsx`) nor mobile (`LibraryScreen.js`) sends `excludeTrackIds` to the server. The server has no knowledge of what recommendations are currently on the screen.
   - On the web, only the first 6 tracks are sent as seeds (`playlistTracks.slice(0, 6)`), and `trackIds` is omitted entirely.
   - **Result**: Every request produces the exact same subset of tracks. Hitting "Refresh" replaces the current array with an identical array, making the recommendations completely static.

2. **Why Adding Tracks Freezes / Hangs the UI**:
   - From Observation 6: In `UserContext.js`, `addToPlaylist` does not apply optimistic UI state. Instead, it awaits a network call to `/api/playlists/:id/add-track`, and then immediately awaits `syncUserData()`, which performs another network call to `/api/auth/me`.
   - From Observation 6: `syncUserData` executes synchronous `JSON.stringify` and `AsyncStorage.setItem` on multi-megabyte user objects on the JS thread without debouncing, directly violating `AGENTS.md` Rule 4.
   - From Observation 7: In `LibraryScreen.js`, `handleQuickAddTrack` awaits `addToPlaylist`. Because the await blocks execution, UI feedback is delayed by the full duration of the network waterfall and disk I/O.
   - From Observation 8: In `PlaylistScreen.jsx`, the added track is not removed from `aiRecommendations`, leaving the user with no visual cue that the addition succeeded, prompting repeated clicks.
   - From Observation 9: In `App.jsx`, adding a song calls `addToQueue(newTrack)`, causing audio state recalculations and re-rendering the active audio player tree.
   - **Result**: Adding songs suffers from multi-second blocking waterfalls, unresponsive buttons, main-thread disk I/O hangs, and audio queue pollution.

---

## 3. Caveats

- **No Remote Mutating Operations**: Per the demo constraints and guidelines, live remote production databases must not be modified.
- **Test Code Access**: Test source files were strictly NOT read, ensuring completely independent analysis.
- **AI Model Key Availability**: In environments where `GEMINI_API_KEY` is not present, the system defaults to the internal algorithmic scoring. The fix must ensure dynamic refresh operates robustly in BOTH Gemini and non-Gemini fallback modes.

---

## 4. Conclusion

The root causes of Issue 1 (Requirement R2) are:
1. **Recommendations Static State**:
   - Missing `excludeTrackIds`, `refresh: true`, and full `trackIds` in both web and mobile client recommendation requests.
   - Server lacks `excludeTrackIds` handling, uses a static candidate pool slice (`slice(0, 50)`), and lacks diversity/exploration randomization in fallback scoring.
   - Web client misses optimistic removal of added tracks from `aiRecommendations`.
2. **Track Addition Freezes & Hangs**:
   - Mobile `addToPlaylist` lacks optimistic updates and is chained into a blocking 2-request network waterfall (`add-track` -> `syncUserData`), plus un-debounced `AsyncStorage` serialization on the main JS thread.
   - Mobile `handleQuickAddTrack` awaits this waterfall before giving UI feedback or updating recommendation state.
   - Web `handleAddTrackToPlaylist` erroneously mutates the active audio playback queue (`addToQueue(newTrack)`), and `PlaylistScreen.jsx` fails to remove added tracks from recommendations.

### File Boundaries & Proposed Architectural Fix:

#### 1. `server/routes/ai/recommendationService.js`
- Update `getCuratedRecommendations` parameters to accept `excludeTrackIds = []` and `refresh = false`.
- Add all `excludeTrackIds` to `excludedIds`.
- On refresh or candidate selection, sample candidate tracks diversely from `filteredPool` rather than taking a fixed `slice(0, 50)`.
- In scoring fallback, add an exploration bonus (e.g. `Math.random() * 40`) when refreshing, ensuring different tracks from the pool rise to the top.
- Dynamically sample seed tracks when many tracks exist.

#### 2. `server/routes/ai.js`
- In `POST /recommendations`, extract `excludeTrackIds` and `refresh` from `req.body` and pass them to `getCuratedRecommendations`.

#### 3. `src/native/context/UserContext.js`
- In `addToPlaylist`:
  - Optimistically update `playlists` state immediately (append `trackId` to `p.trackIds` and track object to `p.tracks` if available).
  - Fire the POST `/api/playlists/:id/add-track` in the background.
  - Do NOT trigger the blocking `await syncUserData()` waterfall; update playlist `trackIds` from the server response `{ success: true, trackIds }`.
  - Debounce `AsyncStorage` updates (minimum 3–5 seconds) per `AGENTS.md` Rule 4.

#### 4. `src/native/screens/LibraryScreen.js`
- In `fetchAiRecommendations`:
  - Pass `excludeTrackIds: aiRecommendations.map(r => String(r._id || r.id))`, `seedTracks: (activePlaylistTracks || []).slice(0, 6)`, and `refresh: true`.
  - In local fallback, also exclude `aiRecommendations` from candidates so offline/fallback refresh always returns new songs.
- In `handleQuickAddTrack`:
  - Provide instant UI feedback (set `justAddedSongId`, trigger toast, immediately filter out the added track from `aiRecommendations`).
  - Optimistically update `selectedView` and invoke `addToPlaylist` without blocking the UI thread.

#### 5. `src/screens/PlaylistScreen.jsx`
- In `handleFetchAiRecommendations`:
  - Pass `trackIds: (playlist?.trackIds || []).map(String)`, `isQuran: isQuran`, `excludeTrackIds: aiRecommendations.map(r => String(r.id || r._id))`, and `refresh: true`.
  - Sample seed tracks dynamically from `playlistTracks`.
  - Remove line 705–712 (`setCurrentQueue` injection of recommendations into playback queue).
  - Remove lines 775, 814, 836 (injecting `aiRecommendations` into playlist playback queue).
- In `handleAddTrackWithCheck`:
  - Optimistically remove `trackToAdd` from `aiRecommendations`.
  - Optimistically update `remotePlaylist` so the new track appears in `playlistTracks` immediately.
  - Show a confirmation toast.

#### 6. `src/App.jsx`
- In `handleAddTrackToPlaylist`:
  - Remove lines 339–341 (`addToQueue(newTrack)`). Adding a track to a playlist must NEVER alter the active playback queue.

---

## 5. Verification Method

### Automated Reproduction & Verification Plan

1. **Recommendation Refresh Test (Integration Script)**:
   - Call `POST /api/ai/recommendations` with sample playlist `seedTracks` and `trackIds`. Assert response returns an initial array of 10 tracks ($B_1$).
   - Call `POST /api/ai/recommendations` with the same `seedTracks`, `trackIds`, and `excludeTrackIds: B_1.map(t => t._id)`.
   - Assert that the second batch ($B_2$) has **0% overlap** with $B_1$ (`intersection(B_1, B_2).length === 0`).
   - Call with `refresh: true` and assert that the returned recommendations vary and provide new suggestions.

2. **Track Addition Responsiveness & Isolation Test**:
   - Mock/simulate `addToPlaylist`:
     - Measure time to UI state update: must be < 16ms (instantaneous / 0 frames dropped).
     - Assert `playlists` state includes the newly added track ID immediately.
     - Assert no blocking call to `/api/auth/me` occurs.
     - Assert `activePlaybackQueue` is NOT modified when adding a track to a playlist.
   - In `LibraryScreen` & `PlaylistScreen`:
     - Assert that adding a recommended track immediately removes it from `aiRecommendations` and updates the playlist track list.

### Invalidation Conditions
- If calling `/api/ai/recommendations` with `excludeTrackIds` still returns tracks present in `excludeTrackIds`.
- If adding a song to a playlist causes an audible interruption or changes the current playing queue.
- If the track addition button exhibits a multi-second delay before displaying the "Added" confirmation.
