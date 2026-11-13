# BRIEFING — 2026-11-09T08:28:00Z

## Mission
Investigate and diagnose Issue 9 (Requirement R10): Listening Activity and Real-Time Stats Calculation across mobile, web, and server.

## 🔒 My Identity
- Archetype: explorer
- Roles: investigation, synthesis
- Working directory: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_issue9
- Original parent: 193c595c-a003-4225-a80b-3e8dcd945268
- Milestone: Issue 9 Investigation

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Integrity mode: demo. DO NOT CHEAT.
- Do NOT read test source code to understand expected behaviour before implementing.
- No modifying source code files or running mutating tests.
- Deliver findings in handoff.md following 5-component protocol.

## Current Parent
- Conversation ID: 193c595c-a003-4225-a80b-3e8dcd945268
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `src/screens/StatsScreen.jsx` & `src/utils/listeningTracker.js`
  - `src/native/screens/StatsScreen.js`
  - `src/native/context/AudioContext.js`, `playbackEngine.js`, `useAudioPlaybackCore.js`, `audioApiHelpers.js`
  - `src/context/AudioContext.jsx` & `UserContext.jsx`
  - `src/native/context/UserContext.js`
  - `server/routes/stats.js` & `server/routes/users.js`
  - `server/routes/users/listeningActivityService.js`
  - `server/models/User.js` & `server/models/Track.js`
  - `src/components/ListeningActivityPanel.jsx` & `ActivityListItem.jsx`
  - `src/utils/trackPopularity.js` & `tasteAlgorithm.js`
- **Key findings**:
  1. Mobile playback NEVER accrues or reports listening duration (`recordListeningTick` does not exist on mobile; `/api/stats/listen` is never called). Mobile StatsScreen stays at 0m/0m.
  2. Web StatsScreen confuses all-time total seconds with weekly seconds (`Math.max(weeklySeconds, totalSeconds)`), corrupting the weekly leaderboard.
  3. Web `getRealTopTrack` falls back to the global catalogue tracks (`tracks.filter(t => t.plays > 0)[0]`), attributing arbitrary hit songs to new users as their "most streamed track".
  4. Server `/api/stats/listen` topTrack logic never replaces an initial top track with a new winning song when `clientTop` is absent because `else if (user.topTrack.title === title)` ignores other songs.
  5. Server `listeningActivityService.js` fabricates fake listening tracks (`globalFallbackTrack` and liked/playlist songs) for idle friends instead of returning `null` (which the UI gracefully handles as "No recent listening activity").
- **Unexplored areas**: None for Issue 9 boundary.

## Key Decisions Made
- Fully documented 5 root causes across client and server.
- Formulated complete architectural fix plan with exact file boundaries and code snippet proposals.
- Structured automated reproduction and verification strategy without touching test files.

## Artifact Index
- DISPATCH.md — incoming dispatch instructions
- BRIEFING.md — persistent working memory
- progress.md — liveness heartbeat and progress tracking
- handoff.md — final 5-component report
