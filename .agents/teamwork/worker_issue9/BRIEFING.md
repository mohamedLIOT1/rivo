# BRIEFING — 2026-11-09T08:52:00Z

## Mission
Implement the genuine fix for Issue 9 (Requirement R10): Listening Activity and Real-Time Stats Calculation across mobile and web.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue9
- Original parent: 193c595c-a003-4225-a80b-3e8dcd945268
- Milestone: Issue 9 / R10 Fix

## 🔒 Key Constraints
- Negative constraint: Do NOT read test source code to understand expected behaviour before implementing.
- Mandatory integrity warning: DO NOT CHEAT. All implementations must be genuine.
- Exclusive write ownership:
  - `src/native/context/audio/audioApiHelpers.js`
  - `src/screens/StatsScreen.jsx`
  - `src/utils/listeningTracker.js`
  - `server/routes/stats.js`
  - `server/services/listeningActivityService.js`
  - Working directory: `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue9\`
- Adhere to AGENTS.md rules (e.g. 400-line limits, memoization, minimal changes).

## Current Parent
- Conversation ID: 193c595c-a003-4225-a80b-3e8dcd945268
- Updated: 2026-11-09T08:52:00Z

## Task Summary
- **What to build**: Real-time listening stats synchronization, authentic idle friend activity, dynamic top track calculation, authentic zero-history handling, accurate weekly leaderboard calculation.
- **Success criteria**:
  1. `src/native/context/audio/audioApiHelpers.js`: real-time sync calling `POST /api/stats/listen` with accrued seconds, trackId, completed.
  2. `src/screens/StatsScreen.jsx`: weekly leaderboard ranked by `weeklySeconds`, no `Math.max(weeklySeconds, totalSeconds)`.
  3. `src/utils/listeningTracker.js`: return `null` when no history, no fallback catalogue fake plays.
  4. `server/routes/stats.js`: calculate & update `user.topTrack` dynamically based on playtime across songs.
  5. `server/services/listeningActivityService.js`: authentic idle state for friends (`currentListening: null`), no fake listening activity.
- **Interface contracts**: PROJECT.md / explorer handoff
- **Code layout**: src/, server/

## Key Decisions Made
- `src/native/context/audio/audioApiHelpers.js`: Added continuous real-time listening ticker and synchronization that flushes accrued listening seconds to `POST /api/stats/listen` with completion status and clientTopTrack.
- `src/screens/StatsScreen.jsx`: Isolated `userWeeklySeconds` strictly for weekly leaderboard ranking and weekly top listener, eliminating historical all-time seconds pollution.
- `src/utils/listeningTracker.js`: Removed catalogue fallback in `getRealTopTrack` so users without listening history cleanly receive `null` instead of fake plays of global hits.
- `server/routes/stats.js`: Dynamic cumulative playtime tracking in `user.trackStats` allowing songs with higher accumulated listening seconds to overtake older songs as `user.topTrack`.
- `server/routes/users/listeningActivityService.js` & `server/services/listeningActivityService.js`: Eliminated fabricated friend activity from liked tracks, playlists, and `globalFallbackTrack`. Idle friends cleanly return `currentListening: null`.

## Artifact Index
- .agents/teamwork/worker_issue9/DISPATCH.md
- .agents/teamwork/worker_issue9/BRIEFING.md
- .agents/teamwork/worker_issue9/progress.md
- .agents/teamwork/worker_issue9/verify_issue9_listening_stats.js
- .agents/teamwork/worker_issue9/handoff.md
- scripts/verify_issue9_listening_stats.js

## Change Tracker
- **Files modified**:
  - `src/native/context/audio/audioApiHelpers.js`: Added real-time ticker and `syncListeningProgress` calling `/api/stats/listen` (230 lines)
  - `src/screens/StatsScreen.jsx`: Replaced `userRealSeconds` with `userWeeklySeconds` in leaderboard and top listener card (356 lines)
  - `src/utils/listeningTracker.js`: Removed catalogue fallback in `getRealTopTrack` (296 lines)
  - `server/routes/stats.js`: Dynamic per-user trackStats calculation in `/api/stats/listen` (173 lines)
  - `server/routes/users/listeningActivityService.js`: Eliminated fake friend activity fallbacks (197 lines)
  - `server/services/listeningActivityService.js`: Re-export alias (5 lines)
  - `scripts/verify_issue9_listening_stats.js`: Full automated verification suite
- **Build status**: PASS (all 6 verification tests pass with exit code 0)
- **Pending issues**: None

## Quality Status
- **Build/test result**: PASS
- **Lint status**: 0 errors (all touched files pass `node --check` / JSX AST parse)
- **Tests added/modified**: Full 6-suite verification script testing all requirements

## Loaded Skills
None
