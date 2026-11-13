## 2026-11-09T08:31:04Z
You are worker_issue1, an expert full-stack engineer.
Your task is to implement the genuine fix for Issue 1 (Requirement R2): AI Recommendations Refresh and Performance.

Authoritative User Request:
"Fix playlist AI recommendations so that recommended tracks properly refresh and change rather than remaining static. Optimize the track addition flow so adding recommended songs is fast and responsive, without UI freezes, blocking, or application hangs."

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

NEGATIVE CONSTRAINT:
The team must NOT: read test source code to understand expected behaviour before implementing.

ARCHITECTURAL BLUEPRINT & INVESTIGATION REPORT:
Read: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_issue1\handoff.md
Also read:
1. c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\ORIGINAL_REQUEST.md
2. c:\Users\mohamed\Downloads\rivo-main\AGENTS.md
3. c:\Users\mohamed\Downloads\rivo-main\PROJECT.md

EXCLUSIVE WRITE OWNERSHIP (You may ONLY edit these files):
- `server/routes/ai/recommendationService.js`
- `server/routes/ai.js`
- `src/native/context/UserContext.js`
- `src/native/screens/LibraryScreen.js`
- `src/screens/PlaylistScreen.jsx`
- `src/App.jsx`
- Your working directory: `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue1\`

IMPLEMENTATION REQUIREMENTS:
1. `server/routes/ai/recommendationService.js`:
   - Accept `excludeTrackIds = []` and `refresh = false`.
   - Add `excludeTrackIds` to `excludedIds`.
   - Diversely sample candidate tracks rather than a static `slice(0, 50)`.
   - In scoring fallback, add an exploration bonus (e.g. `Math.random() * 40`) when refreshing so new tracks rise to the top.
2. `server/routes/ai.js`:
   - Extract `excludeTrackIds` and `refresh` from `req.body` and pass them to `getCuratedRecommendations`.
3. `src/native/context/UserContext.js`:
   - In `addToPlaylist`, apply optimistic UI update immediately to `playlists` state.
   - Run the POST `/api/playlists/:id/add-track` in background without the blocking `await syncUserData()` waterfall.
   - Debounce `AsyncStorage` updates (minimum 3–5 seconds) per AGENTS.md.
4. `src/native/screens/LibraryScreen.js`:
   - In `fetchAiRecommendations`, send `excludeTrackIds`, `seedTracks`, and `refresh: true`.
   - In `handleQuickAddTrack`, provide instant UI feedback (`justAddedSongId`, toast, immediate filter from `aiRecommendations`).
5. `src/screens/PlaylistScreen.jsx`:
   - In `handleFetchAiRecommendations`, pass `excludeTrackIds`, full `trackIds`, and `refresh: true`.
   - Remove lines 705–712 (injecting recommendations into active audio playback queue `setCurrentQueue`).
   - Remove lines 775, 814, 836 (appending `aiRecommendations` to playback queue).
   - In `handleAddTrackWithCheck`, optimistically filter out added track from `aiRecommendations` and update playlist tracks.
6. `src/App.jsx`:
   - In `handleAddTrackToPlaylist`, remove lines calling `addToQueue(newTrack)`.

VERIFICATION:
Create and run a local verification script (e.g. `scripts/verify_issue1_recs.js`) verifying:
- Passing `excludeTrackIds` to `/api/ai/recommendations` yields 0% overlap with excluded IDs.
- Refresh returns varied candidates.
- Syntax check across all touched files (`node -c`).

OUTPUT:
Write your full implementation and test results to:
`c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue1\handoff.md`
Update your progress in `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue1\progress.md`
When complete, notify orchestrator (193c595c-a003-4225-a80b-3e8dcd945268) via send_message.
