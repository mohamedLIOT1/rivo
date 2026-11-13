# BRIEFING — 2026-11-09T08:24:30Z

## Mission
Investigate and diagnose Issue 5 (Requirement R6): Playback Startup Latency & Stream Optimization, proxy caching, token renewal, and external cookies handling.

## 🔒 My Identity
- Archetype: explorer
- Roles: codebase investigation, root cause diagnosis, synthesis, handoff preparation
- Working directory: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_issue5\
- Original parent: 193c595c-a003-4225-a80b-3e8dcd945268
- Milestone: Issue 5 / R6 Diagnosis

## 🔒 Key Constraints
- Read-only investigation — do NOT implement or modify source code.
- Integrity mode: demo. DO NOT CHEAT. All findings and proposed fixes must be genuine.
- The team must NOT read test source code to understand expected behaviour before implementing.
- Avoid indexing/searching prohibited directories (node_modules, dist, build, etc.).
- Comply with AGENTS.md rules (e.g., 400-line limits, state isolation, abort signals, GoogleVideo 403 handling).

## Current Parent
- Conversation ID: 193c595c-a003-4225-a80b-3e8dcd945268
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `server/routes/tracks.js`, `server/routes/tracks/tracksStreamRouter.js`, `server/routes/tracks/tracksResolutionRouter.js`
  - `server/utils/audioCacheUtils.js`, `server/utils/youtubeStreamResolver.js`, `server/utils/streamFallbackProvider.js`, `server/utils/ytDlpWorker.js`, `server/utils/youtubeSearch.js`, `server/utils/security.js`
  - `src/context/AudioContext.jsx`, `src/utils/clientStreamResolver.js`, `src/native/context/audio/streamResolverHelper.js`, `src/native/services/youtubeResolver.js`, `cookies.txt`
- **Key findings**:
  1. Synchronous `execFileSync` (`ffprobe`, `ffmpeg`) blocks Node.js event loop synchronously for up to 35 seconds during playback/background caching.
  2. `audioCacheUtils.js` contains hardcoded `EMBEDDED_YOUTUBE_COOKIES` and auto-writes fake mock credentials to `cookies.txt`; yt-dlp fails signature solving and format availability when given mock cookies, but succeeds without cookies.
  3. `extractInnertubeDirectStream` timeout is set to an unrealistically short 1200ms, causing premature aborts and falling into 50s yt-dlp failure loops.
  4. Aggressive 60-second circuit breaker in `streamFallbackProvider.js` trips after 4s timeout and reroutes all users to failing public Invidious instances.
  5. Proxy route `/stream-proxy` in `tracks.js` has no chunk caching, does not check in-memory cache for `videoId`, and fails to cache renewed URLs upon 403 auto-recovery, triggering repeated 403 cascades on every HTTP range request.
  6. Client `AudioContext.jsx` runs sequential 7s timeouts on redundant endpoints (`/stream` then `/resolve-stream`) and fails to benefit from prefetching.
- **Unexplored areas**: None, full end-to-end stream lifecycle diagnosed.

## Key Decisions Made
- Confirmed external stream access does not currently require cookies when Innertube or clean yt-dlp is used.
- Formulated architectural fix: eliminate mock cookies, convert all `execFileSync` to async, optimize Innertube timeout to 3500ms, implement proxy range/chunk caching and URL remapping, proactive token renewal using `expire=` parameter, and explicit user prompt on bot block.

## Artifact Index
- DISPATCH.md — Incoming task instructions
- BRIEFING.md — Situational awareness and state
- progress.md — Liveness heartbeat and progress tracking
- handoff.md — Final investigation handoff report
