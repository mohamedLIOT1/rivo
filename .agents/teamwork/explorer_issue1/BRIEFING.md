# BRIEFING — 2026-11-09T08:23:15Z

## Mission
Investigate and diagnose Issue 1 (Requirement R2): AI Recommendations Refresh and Performance.

## 🔒 My Identity
- Archetype: explorer
- Roles: technical investigator, problem analyzer, findings synthesizer
- Working directory: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_issue1
- Original parent: 193c595c-a003-4225-a80b-3e8dcd945268
- Milestone: Issue 1 (R2) Investigation

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Integrity mode: demo. DO NOT CHEAT. All findings and proposed fixes must be genuine.
- The team must NOT read test source code to understand expected behaviour before implementing.
- Write only to .agents/teamwork/explorer_issue1/

## Current Parent
- Conversation ID: 193c595c-a003-4225-a80b-3e8dcd945268
- Updated: 2026-11-09T08:15:15Z

## Investigation State
- **Explored paths**:
  - `server/routes/ai.js` (POST /recommendations route handler)
  - `server/routes/ai/recommendationService.js` (`getCuratedRecommendations` logic, candidate pool query, Gemini prompting, scoring fallback)
  - `server/routes/playlists.js` (`POST /:id/add-track` handler)
  - `src/screens/PlaylistScreen.jsx` (`handleFetchAiRecommendations`, `handleAddTrackWithCheck`, audio queue pollution)
  - `src/native/screens/LibraryScreen.js` (`fetchAiRecommendations`, `handleQuickAddTrack`, track pool and fallback shuffle)
  - `src/native/context/UserContext.js` (`addToPlaylist`, blocking `syncUserData`, un-debounced AsyncStorage persistence)
  - `src/App.jsx` (`handleAddTrackToPlaylist`, incorrect `addToQueue(newTrack)`)
- **Key findings**:
  1. Recommendations remain static because:
     - Neither client sends `excludeTrackIds` or full playlist `trackIds` on refresh.
     - Server candidate pool is strictly sorted by `{ plays: -1 }` and deterministically sliced `filteredPool.slice(0, 50)`.
     - In fallback scoring, seed artist match (+30) and high plays (+20) dominate over random factor (+15), picking identical songs repeatedly.
     - Server has no mechanism to exclude previously recommended tracks or randomize exploration.
  2. Track addition freezes/hangs because:
     - Mobile `addToPlaylist` lacks optimistic updates, blocks on a 2-request waterfall (`add-track` followed by `syncUserData` calling `/api/auth/me`), and stringifies/writes multi-megabyte user manifests to `AsyncStorage` on the main thread during addition.
     - `LibraryScreen.js` awaits `await addToPlaylist(...)` before giving UI feedback or removing the track from recommendations.
     - Web `PlaylistScreen.jsx` fails to remove added tracks from `aiRecommendations`, fails to update local playlist tracks, and erroneously mutates the global playback queue with `addToQueue(newTrack)` and `setCurrentQueue(markedRecs)`.
- **Unexplored areas**: None. All relevant boundaries explored and mapped.

## Key Decisions Made
- Fully documented root causes and formulated precise architectural fixes for both server and clients (web & mobile).
- Specified automated verification plan with reproduction tests.

## Artifact Index
- DISPATCH.md — Dispatch log
- BRIEFING.md — Working memory
- progress.md — Liveness heartbeat and progress tracker
- handoff.md — Final investigation report
