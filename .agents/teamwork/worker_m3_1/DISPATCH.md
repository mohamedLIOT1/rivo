## 2026-11-04T20:59:12Z
You are worker_m3_1, a high-precision React Native state and UI hydration engineer.
Your Working Directory: c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_m3_1\
Mandatory inputs to read before starting:
1. `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\ORIGINAL_REQUEST.md`
2. `c:\Users\mohamed\Downloads\rivo-main\PROJECT.md`
3. `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\explorer_survey_2\survey_startup_layout.md`
4. `c:\Users\mohamed\Downloads\rivo-main\AGENTS.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Scope & Assigned Milestone:
Milestone M3: Cold Boot Content Layout Stability & User Data Hydration (Requirement R5).
Target: Eliminate cold boot content flashing, placeholder/alternate album jumps, and layout shifts when launching the app.

Your Exclusive File Ownership:
- `c:\Users\mohamed\Downloads\rivo-main\rivo-main\src\native\data\initialTracks.js`
- `c:\Users\mohamed\Downloads\rivo-main\rivo-main\src\native\context\UserContext.js`
- `c:\Users\mohamed\Downloads\rivo-main\rivo-main\src\native\screens\HomeScreen.js`

Technical Tasks:
1. In `src/native/data/initialTracks.js`:
   Remove `INITIAL_ALBUMS` and dummy placeholder albums. Initial state should be clean/empty or use stable skeleton placeholders without hardcoding fake or alternate albums that cause content flicker.
2. In `src/native/context/UserContext.js`:
   Eliminate artificial delays (such as `setTimeout(..., 0)` or delayed state dispatching) during initial AsyncStorage hydration. Ensure cached playlists and user preferences are loaded directly and deterministically.
3. In `src/native/screens/HomeScreen.js`:
   Stabilize `displayAlbums` and playlist rendering so that the default home playlists render stably without layout shifts or album cover flashing. Adhere strictly to AGENTS.md rule 4 (virtualized lists, no main thread blocking).

Verification Requirements:
- Run `python scripts/run_e2e_tests.py` from `c:\Users\mohamed\Downloads\rivo-main\rivo-main` and verify that all test tiers pass without regressions.
- Update `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_m3_1\progress.md` continuously.
- Deliver `c:\Users\mohamed\Downloads\rivo-main\.agents\teamwork\worker_m3_1\handoff.md` with:
  - Observation: Files modified and exact changes made.
  - Logic Chain: Why this permanently eliminates startup layout shift and placeholder flashing.
  - Verification: Test command execution logs and results.
- Send a message back to parent when completed.
