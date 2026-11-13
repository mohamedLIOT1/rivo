## 2026-11-09T08:32:36Z
You are worker_issue9, an expert stats and analytics engineer.
Your task is to implement the genuine fix for Issue 9 (Requirement R10): Listening Activity and Real-Time Stats Calculation.

Authoritative User Request:
"Fix the listening activity and statistics engine across mobile and web so listening time, top tracks, and engagement stats are calculated from actual, verifiable listening sessions in real time rather than inaccurate or static placeholders."

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

NEGATIVE CONSTRAINT:
The team must NOT: read test source code to understand expected behaviour before implementing.

ARCHITECTURAL BLUEPRINT & INVESTIGATION REPORT:
Read: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_issue9\handoff.md
Also read:
1. c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\ORIGINAL_REQUEST.md
2. c:\Users\mohamed\Downloads\rivo-main\AGENTS.md
3. c:\Users\mohamed\Downloads\rivo-main\PROJECT.md

EXCLUSIVE WRITE OWNERSHIP (You may ONLY edit these files):
- `src/native/context/audio/audioApiHelpers.js`
- `src/screens/StatsScreen.jsx`
- `src/utils/listeningTracker.js`
- `server/routes/stats.js`
- `server/services/listeningActivityService.js`
- Your working directory: `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue9\`

IMPLEMENTATION REQUIREMENTS:
1. `src/native/context/audio/audioApiHelpers.js`:
   - Implement real-time listening synchronization: when track playback progresses in mobile, call `POST /api/stats/listen` with the actual accrued listening duration, trackId, and completion status so mobile listening increments `user.totalListeningSeconds`, `user.weeklyListeningSeconds`, and updates `user.topTrack`.
2. `src/screens/StatsScreen.jsx`:
   - Fix weekly leaderboard metric confusion: use actual `weeklySeconds` (NOT `Math.max(weeklySeconds, totalSeconds)`) for weekly leaderboard ranking so all-time historical seconds do not contaminate the weekly competition.
3. `src/utils/listeningTracker.js`:
   - Eliminate fallback to global hit tracks: when a user has no listening history, do NOT fall back to catalogue tracks (`tracks.filter(t => t.plays > 0)[0]`) and fabricate hundreds of fake plays. Return `null` so the UI cleanly displays the authentic "No listening activity recorded yet" state.
4. `server/routes/stats.js`:
   - In `/api/stats/listen`, calculate and update `user.topTrack` dynamically based on real playtime across songs rather than freezing permanently on the first song ever played.
5. `server/services/listeningActivityService.js`:
   - Eliminate fabricated friend activity: when a friend is idle / offline, do NOT invent fake listening activity from liked tracks or random database tracks (`globalFallbackTrack`). Report authentic idle state.

VERIFICATION:
Create and run a local verification script (e.g. `scripts/verify_issue9_listening_stats.js`) asserting:
- Listening sessions accurately accrue seconds to weekly and total listening metrics.
- Leaderboard uses weekly listening seconds without all-time pollution.
- Users with zero listening history show null top track without fake catalogue placeholders.
- Syntax check across all touched files (`node -c`).

OUTPUT:
Write your full implementation and test results to:
`c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue9\handoff.md`
Update your progress in `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_issue9\progress.md`
When complete, notify orchestrator (193c595c-a003-4225-a80b-3e8dcd945268) via send_message.
