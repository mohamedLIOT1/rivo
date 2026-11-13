## 2026-11-04T20:59:40Z

[Message] timestamp=2026-11-04T20:59:40Z sender=aba6c41f-d31e-4240-8bd7-f180d3aa6ab8 priority=MESSAGE_PRIORITY_HIGH content=You are worker_m5_1, a principal software architect and React Native modularization engineer.
Your Working Directory: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_m5_1\
Mandatory inputs to read before starting:
1. `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\ORIGINAL_REQUEST.md`
2. `c:\Users\mohamed\Downloads\rivo-main\PROJECT.md`
3. `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\spec_miner_survey_1\survey_spec.md`
4. `c:\Users\mohamed\Downloads\rivo-main\AGENTS.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Assigned Milestone:
Milestone M5: High-Frequency State Isolation & AGENTS.md Modularization (Requirement R2).
Target: Enforce all AGENTS.md architectural rules:
- File size limit: strictly under 400 lines for any modified or new files. Split monolithic files into specialized custom hooks, utilities, or sub-components.
- High-Frequency State Isolation: NEVER place rapidly updating state (e.g., currentTime, progress ticks 250ms, download percentage) inside a general root Context provider value. Isolate ticks into `AudioProgressContext` or use ref-based listeners.
- Provider Memoization: ALL Context Provider value objects MUST be wrapped in `useMemo()`.
- Prop Callbacks: All event handlers passed down to screen trees must be stabilized with `useCallback()`.
- Main-Thread I/O: Eliminate main-thread multi-megabyte string operations in downloadManager.

Your Exclusive File Ownership:
- `c:\Users\mohamed\Downloads\rivo-main\rivo-main\src\native\context\AudioContext.js`
- `c:\Users\mohamed\Downloads\rivo-main\rivo-main\src\native\context\AudioProgressContext.js`
- `c:\Users\mohamed\Downloads\rivo-main\rivo-main\src\native\services\downloadManager.js`
- `c:\Users\mohamed\Downloads\rivo-main\rivo-main\src\native\components\FullPlayerModal.js`
- `c:\Users\mohamed\Downloads\rivo-main\rivo-main\server\routes\tracks.js`

Technical Tasks:
1. Extract High-Frequency Audio State:
   Create or complete `AudioProgressContext.js` for `currentTime`, `duration`, `progress` (250ms updates) and download progress. In `AudioContext.js`, remove rapid 250ms progress state so that consumers of `useAudio()` don't experience 4 re-renders every second.
2. Context Memoization & Callback Stabilization:
   In `AudioContext.js`, wrap the context value in `useMemo()` and wrap all playback handler functions in `useCallback()`.
3. Modularize Monolithic Files under 400 Lines:
   Split `FullPlayerModal.js` (and any related files exceeding 400 lines) into clean sub-components (e.g. `FullPlayerControls.js`, `FullPlayerQueue.js`).
   Ensure `downloadManager.js` and `server/routes/tracks.js` are modularized and stay under the 400-line limit.
4. Main-Thread I/O Optimization:
   Ensure `downloadManager.js` does not block the UI thread with synchronous multi-megabyte base64 operations.

Verification Requirements:
- Run `python scripts/run_e2e_tests.py` from `c:\Users\mohamed\Downloads\rivo-main\rivo-main` and verify that all test tiers pass without regressions.
- Update `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_m5_1\progress.md` continuously.
- Deliver `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_m5_1\handoff.md` with:
  - Observation: Files modified, files split, and line count verification (<400 lines).
  - Logic Chain: Why this satisfies AGENTS.md rules and eliminates re-render storms.
  - Verification: Test command execution logs and results.
- Send a message back to parent when completed.
